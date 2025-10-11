#!/usr/bin/env node
const chokidar = require('chokidar');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('👁️  Starting real-time TypeScript validation...');

// Debounce function
let timeout;
const debounce = (func, wait) => {
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// Check a single file
const checkFile = (filePath) => {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
  
  console.log(`\n🔍 Checking ${filePath}...`);
  
  // Run TypeScript check
  const tsc = spawn('npx', ['tsc', '--noEmit', '--skipLibCheck', filePath], {
    stdio: 'pipe'
  });
  
  let errors = '';
  tsc.stderr.on('data', (data) => {
    errors += data.toString();
  });
  
  tsc.on('close', (code) => {
    if (code !== 0 && errors) {
      console.log('❌ TypeScript errors found:');
      console.log(errors);
    } else {
      console.log('✅ No TypeScript errors');
    }
  });
  
  // Run ESLint
  const eslint = spawn('npx', ['eslint', filePath, '--quiet'], {
    stdio: 'pipe'
  });
  
  let lintErrors = '';
  eslint.stdout.on('data', (data) => {
    lintErrors += data.toString();
  });
  
  eslint.on('close', (code) => {
    if (code !== 0 && lintErrors) {
      console.log('⚠️  ESLint warnings:');
      console.log(lintErrors);
    }
  });
};

// Watch for changes
const watcher = chokidar.watch('src/**/*.{ts,tsx}', {
  persistent: true,
  ignoreInitial: true
});

const debouncedCheck = debounce(checkFile, 1000);

watcher
  .on('add', path => {
    console.log(`✨ New file: ${path}`);
    debouncedCheck(path);
  })
  .on('change', path => {
    debouncedCheck(path);
  });

console.log('✅ Watching for TypeScript file changes...');
console.log('   Press Ctrl+C to stop\n');
