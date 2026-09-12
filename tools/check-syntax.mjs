#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkedDirectories = ['bin', 'tools', 'evals'];

function collectJavaScriptFiles(directory, result = []) {
  for (const entry of fs.readdirSync(path.join(repoRoot, directory), { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) collectJavaScriptFiles(relative, result);
    else if (entry.isFile() && entry.name.endsWith('.mjs')) result.push(relative);
  }
  return result;
}

const files = checkedDirectories.flatMap(directory => collectJavaScriptFiles(directory)).sort();
for (const relative of files) execFileSync(process.execPath, ['--check', path.join(repoRoot, relative)], { stdio: 'inherit' });
console.log(`Syntax check passed for ${files.length} JavaScript files.`);
