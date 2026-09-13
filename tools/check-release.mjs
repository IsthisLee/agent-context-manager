#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function checkRelease(tag) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
  if (!tag) throw new Error('A release tag is required, for example v0.1.0.');
  const version = tag.replace(/^v/, '');
  assert.equal(version, packageJson.version, `Release tag ${tag} does not match package version ${packageJson.version}.`);
  const changelogHeading = `## [${version}]`;
  const hasChangelogEntry = changelog.split('\n').some(line => line.startsWith(changelogHeading));
  assert.ok(hasChangelogEntry, `CHANGELOG.md is missing version ${version}.`);
  console.log(`Release contract passed for ${tag}.`);
}

try {
  checkRelease(process.argv.slice(2).find(argument => argument !== '--'));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
