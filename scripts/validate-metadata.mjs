#!/usr/bin/env node
// Validates that the plugin metadata in the marketplace manifest and the docs
// site data agree, so a rename or added/removed plugin can't silently drift
// (see issue #28). Scope is the two machine-readable sources only:
//   .claude-plugin/marketplace.json  -> plugins[] (name, source.repo)  — what /plugin installs
//   docs/skills-data.js              -> SKILLS   (id, repo)            — what the Pages site lists
// The README table is intentionally left to human review.
//
// Zero-dependency: the site data is an ES module (`export const SKILLS`) but the
// repo has no package.json, so we import it via a data: URL, which Node always
// treats as ESM regardless of the repo's module type.
//
// Exits 0 when the sources agree, 1 (with a grouped report) when they don't.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, '.claude-plugin', 'marketplace.json');
const dataPath = path.join(root, 'docs', 'skills-data.js');

// --- Manifest: name -> repo ---
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const manifestRepos = new Map(
  (manifest.plugins ?? []).map((p) => [p.name, p.source?.repo])
);

// --- Site data: id -> repo (imported as ESM via a data: URL) ---
const dataSrc = await readFile(dataPath, 'utf8');
const { SKILLS } = await import(
  'data:text/javascript,' + encodeURIComponent(dataSrc)
);
const siteRepos = new Map((SKILLS ?? []).map((s) => [s.id, s.repo]));

// --- Compare (collect every problem, don't stop at the first) ---
const problems = [];

for (const name of manifestRepos.keys()) {
  if (!siteRepos.has(name)) {
    problems.push(`Plugin "${name}" is in marketplace.json but missing from docs/skills-data.js SKILLS.`);
  }
}
for (const id of siteRepos.keys()) {
  if (!manifestRepos.has(id)) {
    problems.push(`Skill "${id}" is in docs/skills-data.js SKILLS but missing from marketplace.json plugins[].`);
  }
}
for (const [name, repo] of manifestRepos) {
  if (siteRepos.has(name) && siteRepos.get(name) !== repo) {
    problems.push(
      `Repo mismatch for "${name}": marketplace.json has "${repo}", docs/skills-data.js has "${siteRepos.get(name)}".`
    );
  }
}

// Also flag entries missing the fields we compare on, so a typo'd key surfaces.
for (const [name, repo] of manifestRepos) {
  if (!repo) problems.push(`Plugin "${name}" in marketplace.json has no source.repo.`);
}
for (const [id, repo] of siteRepos) {
  if (!repo) problems.push(`Skill "${id}" in docs/skills-data.js has no repo.`);
}

if (problems.length > 0) {
  console.error('Metadata validation FAILED — marketplace.json and docs/skills-data.js disagree:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nFix the sources so plugin ids/names and repos match, then re-run.');
  process.exit(1);
}

const names = [...manifestRepos.keys()].sort();
console.log(`Metadata OK — ${names.length} plugin(s) consistent across manifest and site: ${names.join(', ')}.`);
