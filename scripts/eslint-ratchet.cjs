#!/usr/bin/env node
/*
  ESLint ratchet: fails CI only on new violations relative to a baseline.
  - Baseline file: .eslint-baseline.json (can be committed/updated as tech debt burns down)
*/
const { execSync } = require('node:child_process');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');

const BASELINE = '.eslint-baseline.json';

function runESLint() {
  try {
    const output = execSync('npx eslint src --ext .ts,.tsx -f json', {
      stdio: ['ignore', 'pipe', 'pipe'],
    }).toString();
    return JSON.parse(output);
  } catch (e) {
    // Even when there are errors, ESLint exits with code 1 but still prints JSON
    const out = e.stdout?.toString() || '[]';
    try {
      return JSON.parse(out);
    } catch {
      return [];
    }
  }
}

function indexByFile(messages) {
  const map = new Map();
  for (const file of messages) {
    if (!file.messages || file.messages.length === 0) continue;
    const entries = file.messages.map((m) => ({
      ruleId: m.ruleId || '',
      line: m.line || 0,
      column: m.column || 0,
      message: m.message || '',
    }));
    map.set(file.filePath, entries);
  }
  return map;
}

function toKey(m) {
  return `${m.ruleId}:${m.line}:${m.column}:${m.message}`;
}

function main() {
  const results = runESLint();
  const current = indexByFile(results);

  if (!existsSync(BASELINE)) {
    // Create initial baseline and succeed
    writeFileSync(BASELINE, JSON.stringify(results, null, 2));
    console.log('Created initial ESLint baseline (.eslint-baseline.json).');
    process.exit(0);
  }

  const baseline = indexByFile(JSON.parse(readFileSync(BASELINE, 'utf8')));

  let newCount = 0;
  for (const [file, msgs] of current.entries()) {
    const baseMsgs = baseline.get(file) || [];
    const baseSet = new Set(baseMsgs.map(toKey));
    for (const m of msgs) {
      if (!baseSet.has(toKey(m))) newCount++;
    }
  }

  if (newCount > 0) {
    console.error(`ESLint ratchet failed: ${newCount} new violation(s) detected.`);
    process.exit(1);
  }

  console.log('ESLint ratchet passed: no new violations.');
}

main();
