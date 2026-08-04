#!/usr/bin/env node
// Validates that the plugin metadata across the marketplace manifests, the docs
// site data, and the pages' static fallback lists agree, so a rename or
// added/removed plugin can't silently drift (see issues #28, #27, #39):
//   .claude-plugin/marketplace.json  -> plugins[] (name, source.repo)  — what /plugin installs (Claude Code)
//   .agents/plugins/marketplace.json -> plugins[] (name, source.url)   — what `codex plugin marketplace add` installs
//   docs/skills-data.js              -> SKILLS   (id, repo)            — what the Pages site lists
//   docs/Landing.dc.html, Detail.dc.html -> #fallback block           — the JS-free fallback list
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
const codexManifestPath = path.join(root, '.agents', 'plugins', 'marketplace.json');
const dataPath = path.join(root, 'docs', 'skills-data.js');

// --- Manifest: name -> repo ---
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const manifestRepos = new Map(
  (manifest.plugins ?? []).map((p) => [p.name, p.source?.repo])
);

// --- Codex manifest: name -> repo (derived from the git URL) ---
// The Codex marketplace (.agents/plugins/marketplace.json) is the OpenAI-side
// mirror of the Claude manifest. It carries the same plugin set, but each entry
// uses a git-backed source ({ source:"url", url:"https://github.com/<owner>/<repo>.git" })
// instead of Claude's { source:"github", repo:"<owner>/<repo>" }. Normalize the
// URL back to "<owner>/<repo>" so it can be compared against the Claude manifest.
const codexManifest = JSON.parse(await readFile(codexManifestPath, 'utf8'));
const CODEX_ALLOWED_CATEGORIES = new Set([
  'Productivity', 'Developer Tools', 'Finance', 'Communication',
  'Business & Operations', 'Data & Analytics', 'Creativity',
  'Education & Research', 'Security', 'Travel', 'Infrastructure', 'Other',
]);
const CODEX_INSTALLATION = new Set(['AVAILABLE', 'INSTALLED_BY_DEFAULT', 'NOT_AVAILABLE']);
const CODEX_AUTHENTICATION = new Set(['ON_INSTALL', 'ON_USE']);
const repoFromGitUrl = (url) =>
  typeof url === 'string'
    ? url.replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '') || undefined
    : undefined;
const codexRepos = new Map(
  (codexManifest.plugins ?? []).map((p) => [p.name, repoFromGitUrl(p.source?.url)])
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

// --- Codex manifest must mirror the Claude manifest (same set + same repos) ---
for (const name of manifestRepos.keys()) {
  if (!codexRepos.has(name)) {
    problems.push(`Plugin "${name}" is in .claude-plugin/marketplace.json but missing from .agents/plugins/marketplace.json.`);
  }
}
for (const name of codexRepos.keys()) {
  if (!manifestRepos.has(name)) {
    problems.push(`Plugin "${name}" is in .agents/plugins/marketplace.json but missing from .claude-plugin/marketplace.json.`);
  }
}
for (const [name, repo] of manifestRepos) {
  if (codexRepos.has(name) && codexRepos.get(name) !== repo) {
    problems.push(
      `Repo mismatch for "${name}": .claude-plugin/marketplace.json has "${repo}", .agents/plugins/marketplace.json resolves to "${codexRepos.get(name)}".`
    );
  }
}

// Validate the Codex-specific required fields on each entry.
for (const p of codexManifest.plugins ?? []) {
  const where = `Codex plugin "${p.name}" in .agents/plugins/marketplace.json`;
  if (!repoFromGitUrl(p.source?.url)) {
    problems.push(`${where} has no git-backed source.url (expected https://github.com/<owner>/<repo>.git).`);
  }
  if (!CODEX_INSTALLATION.has(p.policy?.installation)) {
    problems.push(`${where} has an invalid policy.installation ("${p.policy?.installation}"); expected one of ${[...CODEX_INSTALLATION].join(', ')}.`);
  }
  if (!CODEX_AUTHENTICATION.has(p.policy?.authentication)) {
    problems.push(`${where} has an invalid policy.authentication ("${p.policy?.authentication}"); expected one of ${[...CODEX_AUTHENTICATION].join(', ')}.`);
  }
  if (!CODEX_ALLOWED_CATEGORIES.has(p.category)) {
    problems.push(`${where} has an unknown category ("${p.category}").`);
  }
}

// --- Static fallback lists (docs/Landing.dc.html, docs/Detail.dc.html) ---
// Each page carries a JS-free #fallback block that hardcodes every skill (repo
// link + install command). It can't be data-driven (it's the fallback for when
// the runtime doesn't load), so verify it lists exactly the SKILLS set.
const REPO_LINK_RE = /github\.com\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)/g;
for (const page of ['Landing.dc.html', 'Detail.dc.html']) {
  const html = await readFile(path.join(root, 'docs', page), 'utf8');
  const startIdx = html.indexOf('id="fallback"');
  if (startIdx === -1) {
    problems.push(`docs/${page} has no #fallback block.`);
    continue;
  }
  // The fallback <div> is immediately followed by the watchdog <script>; slice to
  // there so nav/other links can't be mistaken for fallback entries.
  const scriptIdx = html.indexOf('<script', startIdx);
  const block = html.slice(startIdx, scriptIdx === -1 ? undefined : scriptIdx);

  for (const s of SKILLS) {
    if (s.repo && !block.includes('github.com/' + s.repo)) {
      problems.push(`docs/${page} #fallback is missing a repo link for "${s.id}" (github.com/${s.repo}).`);
    }
    if (s.install && !block.includes(s.install)) {
      problems.push(`docs/${page} #fallback is missing the install command for "${s.id}" ("${s.install}").`);
    }
  }

  const known = new Set(SKILLS.map((s) => s.repo));
  const linked = new Set();
  let m;
  while ((m = REPO_LINK_RE.exec(block)) !== null) linked.add(m[1]);
  REPO_LINK_RE.lastIndex = 0;
  for (const repo of linked) {
    if (!known.has(repo)) {
      problems.push(`docs/${page} #fallback links repo "${repo}", which is not in docs/skills-data.js SKILLS.`);
    }
  }
}

if (problems.length > 0) {
  console.error('Metadata validation FAILED — marketplace.json and docs/skills-data.js disagree:\n');
  for (const p of problems) console.error(`  • ${p}`);
  console.error('\nFix the sources so plugin ids/names and repos match, then re-run.');
  process.exit(1);
}

const names = [...manifestRepos.keys()].sort();
console.log(`Metadata OK — ${names.length} plugin(s) consistent across the Claude manifest, the Codex manifest, the site data, and the static fallback lists in Landing.dc.html / Detail.dc.html: ${names.join(', ')}.`);
