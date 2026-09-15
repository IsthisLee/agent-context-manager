#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Compile `src/` to `dist/` for the npm package. The published package must be
 * JavaScript: Node does not strip TypeScript types from files under node_modules.
 */
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tsc = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');

// Start from an empty dist/ so files deleted from src/ do not linger in the package.
fs.rmSync(path.join(repoRoot, 'dist'), { recursive: true, force: true });
// `npm pack --json` parses stdout as JSON, so compiler output and this notice go to stderr.
execFileSync(process.execPath, [tsc, '-p', path.join(repoRoot, 'tsconfig.build.json')], { stdio: ['ignore', 2, 2] });
console.error('Built dist/ from src/.');
