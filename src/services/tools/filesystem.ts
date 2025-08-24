import { promises as fs } from 'fs';
import path from 'path';

export interface FileInfo { name: string; path: string; isDir: boolean; size?: number }

function isPathInside(parent: string, target: string): boolean {
  const rel = path.relative(parent, target);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export async function listFilesSafe(root: string, subpath = '.', maxEntries = 200): Promise<FileInfo[]> {
  const base = path.resolve(root);
  const target = path.resolve(base, subpath);
  if (!isPathInside(base, target) && target !== base) {return [];}
  const entries = await fs.readdir(target, { withFileTypes: true });
  const out: FileInfo[] = [];
  for (const e of entries.slice(0, maxEntries)) {
    const p = path.join(target, e.name);
    const stat = await fs.stat(p);
    out.push({ name: e.name, path: p, isDir: e.isDirectory(), size: e.isFile() ? stat.size : undefined });
  }
  return out;
}

export async function readFileSnippetSafe(root: string, subpath: string, maxBytes = 32_768): Promise<string> {
  const base = path.resolve(root);
  const target = path.resolve(base, subpath);
  if (!isPathInside(base, target)) {return '';}
  const fh = await fs.open(target, 'r');
  try {
    const buf = Buffer.alloc(Math.min(maxBytes, 32_768));
    const { bytesRead } = await fh.read({ buffer: buf, position: 0, length: buf.length });
    return buf.subarray(0, bytesRead).toString('utf8');
  } finally {
    await fh.close();
  }
}
