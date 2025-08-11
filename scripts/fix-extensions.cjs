#!/usr/bin/env node
/* Post-build fix: add .js to extensionless relative imports in dist */
const fs = require('fs');
const path = require('path');

const distDir = path.resolve(__dirname, '..', 'dist');

function listJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(full));
    else if (entry.isFile() && full.endsWith('.js')) out.push(full);
  }
  return out;
}

function tryResolveJs(spec, fileDir) {
  if (!spec.startsWith('./') && !spec.startsWith('../')) return null;
  const base = path.resolve(fileDir, spec);
  const candidates = [base + '.js', path.join(base, 'index.js')];
  for (const c of candidates) {
    if (fs.existsSync(c)) return { resolved: c, needsIndex: c.endsWith('/index.js') };
  }
  return null;
}

const importRegex = /(import\s+[^'";]+from\s+['"])(\.\.\/.+?|\.\/.+?)(['"];)/g;
const exportRegex = /(export\s+[^'";]*from\s+['"])(\.\.\/.+?|\.\/.+?)(['"];)/g;
const dynamicRegex = /(import\(\s*['"])(\.\.\/.+?|\.\/.+?)(['"]\s*\))/g;
const aliasRegex = /(from\s+['"]@\/(.+?)['"])/g;

const files = listJsFiles(distDir);
let patched = 0;
for (const file of files) {
  const dir = path.dirname(file);
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;
  function replacer(_m, p1, spec, p3) {
    if (/\.(js|json|node)$/.test(spec)) return p1 + spec + p3;
    const r = tryResolveJs(spec, dir);
    if (!r) return p1 + spec + p3;
    const newSpec = r.needsIndex
      ? spec.endsWith('/')
        ? spec + 'index.js'
        : spec + '/index.js'
      : spec + '.js';
    changed = true;
    return p1 + newSpec + p3;
  }
  src = src.replace(importRegex, replacer);
  src = src.replace(exportRegex, replacer);
  src = src.replace(dynamicRegex, replacer);
  // Rewrite path alias '@/...' to relative paths at runtime
  if (src.includes('@/')) {
    src = src.replace(aliasRegex, (m, _full, subpath) => {
      const rel = './' + subpath;
      const r = tryResolveJs(rel, dir);
      if (r) {
        const spec = r.needsIndex
          ? rel.endsWith('/')
            ? rel + 'index.js'
            : rel + '/index.js'
          : rel + '.js';
        return `from '${spec}'`;
      }
      return `from '${rel}.js'`;
    });
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(file, src, 'utf8');
    patched++;
  }
}
console.log(`Patched ${patched} files for ESM extensions`);
