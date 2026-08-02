# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection ("marketplace") of packaged Claude skills, shipped as a **Claude Code plugin marketplace** (`.claude-plugin/marketplace.json`) and consumed via `/plugin`. This repo is a **thin index**: the manifest points at each skill's own standalone GitHub repo, and **no skill source lives here**. There is no build system or test suite — the deliverables are the skills themselves. The one piece of non-manifest content is a static browsable **site under `docs/`** (see below); it has no build step.

Each skill lives as a plain `SKILL.md` in its own repo: Markdown with a YAML frontmatter block (`name`, `description`) followed by the skill's instruction body. The `description` is what a Claude agent matches against to decide when to invoke the skill, so it is written as a long trigger-phrase list, not prose.

## Plugin marketplace layout

This repo holds the manifest plus the static site:

```
.claude-plugin/marketplace.json        # marketplace manifest (name, owner, plugins[])
docs/                                  # static browsable site (GitHub Pages from /docs)
  index.html                           # entry point → redirects to Landing.dc.html
  Landing.dc.html                      # skill listing
  Detail.dc.html                       # per-skill detail (?skill=<id>)
  skills-data.js                       # the listing's data — mirror of plugins[]
  support.js                           # DC runtime (loads React/Babel from unpkg at runtime)
  _ds/modernist-<uuid>/                # imported Modernist design system (styles.css, bundle, …)
```

Each `plugins[]` entry's `source` points at the skill's **own repo**, which carries the plugin/skill tree:

```
HappypsychoX/<skill-name>              # standalone per-skill repo (one plugin each)
  .claude-plugin/plugin.json           # plugin manifest (name, version)
  skills/<skill-name>/SKILL.md         # unpacked skill, auto-discovered
```

Each skill ships as its **own** plugin in its **own** repo so they can be installed and versioned independently — [`trading-agent`](https://github.com/HappypsychoX/trading-agent) (trades) and [`trading-report`](https://github.com/HappypsychoX/trading-report) (read-only), matching the read/write split of the live system (see below). By convention each plugin holds a single skill of the same name. Skills under `skills/` are auto-discovered — they are not listed in `plugin.json`. A plugin `source` in `marketplace.json` is a GitHub repo reference — `{ "source": "github", "repo": "HappypsychoX/<skill-name>" }` — not a local path.

Users install a plugin with:
```bash
/plugin marketplace add HappypsychoX/Skills-Marketplace
/plugin install trading-agent@skills-marketplace
/plugin install trading-report@skills-marketplace
```

When asked to "change a skill", the edit belongs in that skill's **own repo** (`HappypsychoX/<skill-name>`), under `skills/<skill-name>/SKILL.md` — not in this marketplace repo, which only holds the manifest and the site. This repo used to vendor every skill under `plugins/<plugin-name>/`; those trees were split out into per-skill repos (and the marketplace `source` repointed at them) once each skill became its own repo. Changing this marketplace repo is limited to the manifest, this file, the README, and the `docs/` site.

## The `docs/` site

A static, data-driven marketplace site: a landing page listing every skill and a per-skill detail page (description, install command, example usage, link to the skill's own repo). It renders client-side via the vendored **DC runtime** (`support.js`, which pulls React/ReactDOM/Babel from the unpkg CDN at load time and mounts the `<x-dc>` template) over the imported **Modernist** design system in `docs/_ds/` — so it needs no build step and works from any static host; publish it by pointing GitHub Pages at the `/docs` folder. `_ds/` and `support.js` are imported artifacts — treat them as vendored and edit only `Landing.dc.html`, `Detail.dc.html`, and `skills-data.js`. **The listing is driven by `docs/skills-data.js`, which must stay in sync with `marketplace.json`'s `plugins[]`** — when a plugin is added, removed, or renamed in the manifest, mirror it in `skills-data.js` (`id`, `name`, `access`, `repo`, and the copy fields).

## The two current skills share one live system

Both skills operate the same external trading system, so a change to shared conventions (repo names, file paths, the read-only rule) usually needs to be mirrored across **both skill repos**:

- **`trading-agent`** — the autonomous trading agent. Reads market/account data and **places trades** in the Agentic Account via the Robinhood MCP. Fetches its risk parameters fresh each session from the configured `paths.risk_parameters` file (e.g. `config/risk-parameters.json`), falling back to a hardcoded table.
- **`trading-report`** — the reporting half. **Read-only** against Robinhood; its one write is publishing a portfolio snapshot to the configured `paths.dashboard_data` file (e.g. `docs/data/data.json`), which drives a GitHub Pages dashboard.

Shared infrastructure both skills assume:
- **Robinhood MCP** for account/market data (and, for trading-agent only, order placement).
- **GitHub REST Contents API** — writes/reads go to the dashboard repo configured in `trading-config.json` (owner/repo/branch), **not** to this repo. Skills use the raw REST API (`curl`), never `git` clones or local checkouts, so they run identically from a fresh unattended session.
- **One external runtime config file, `trading-config.json`**, holds every environment-specific value — GitHub token (`github.token`, shape `{"github": {"token": "ghp_..."}}` plus `owner`/`repo`/`branch`), the in-repo file paths (`paths.risk_parameters`, `paths.dashboard_data`), and the account scope (`account.scope`). It lives **outside this repo**, located at runtime via a connected folder (suggested `%LOCALAPPDATA%/{skill-name}`) — never a hardcoded path or username. Only the sanitized `trading-config.example.json` template is committed (one next to each skill); the real file is git-ignored. Never print the token in chat.
- **Scope: the configured account only** (`account.scope`, default "Agentic Account"). Other Robinhood accounts must never appear in queries or output.

## Conventions to preserve when editing skills

### Skill versioning

Every skill carries a SemVer version as a bracketed prefix at the very start of its `SKILL.md` frontmatter `description`:

```
[vMAJOR.MINOR.PATCH] <existing trigger-phrase description…>
```

The leading `^\[v\d+\.\d+\.\d+\]` tag is visually distinct, regex-updatable, and adds no competing trigger phrases.

**Every edit to a `SKILL.md` bumps the version — no silent changes.** Bump by impact:

| Part | Bump when… |
| --- | --- |
| **MAJOR** | A breaking behavior change — the read-only vs. write boundary moves, a capability is removed/renamed, or required infra (repo, paths, token shape) changes. |
| **MINOR** | A backward-compatible capability or new trigger phrases are added. |
| **PATCH** | Wording, clarifications, or instruction fixes with no behavioral change. |

**Keep `plugin.json` `version` in lockstep with the description tag**, using the description version as the single source of truth: on every skill edit, set both the `SKILL.md` `[vX.Y.Z]` and that plugin's `plugin.json` `version` to the same bumped SemVer. Each skill repo is one-skill-per-plugin, so one honest number is clearer than two, the `/plugin` picker shows the version the skill advertises, and — because a static unchanged `plugin.json` `version` means installers don't receive the update — tying the plugin bump to the mandatory description bump guarantees a skill change can't ship without moving the version that gates delivery.

**Caveat:** this lockstep holds only while it's one skill per plugin. If a plugin ever bundles multiple skills, switch models — `plugin.json` `version` becomes a package-level rollup (or omit it to fall back to the git commit SHA) and each skill keeps its own independent description version. Do not apply lockstep to a multi-skill plugin.

### Skill changelog

Each skill keeps **its own** `CHANGELOG.md` next to its `SKILL.md`, in the skill's own repo:

```
HappypsychoX/<skill-name> : skills/<skill-name>/CHANGELOG.md
```

One changelog per skill — never a single marketplace-wide changelog — so a skill's history travels with the skill and matches the one-repo-per-skill, install-independently model.

**Every version bump adds a changelog entry in the same commit as the `SKILL.md`/`plugin.json` change.** No version moves without a corresponding entry. Format ([Keep a Changelog](https://keepachangelog.com/) style, newest first):

```markdown
## [X.Y.Z] — YYYY-MM-DD
- **Changed/Added/Removed/Fixed:** <one line per change>
```

- The heading version must equal the new `[vX.Y.Z]` description tag and `plugin.json` `version` — all three move together (see versioning above).
- Use the bump-impact label as the group: MAJOR changes go under **Changed**/**Removed**, MINOR under **Added**/**Changed**, PATCH under **Fixed**/**Changed**.
- Keep entries user-facing: describe what the skill now does differently, not the wording diff.

- **Never hardcode a machine-specific filesystem path or username** in skill bodies — locate `trading-config.json` (and any notes folder) via whatever folder is connected, so the same skill text runs across different PCs.
- Keep the **read-only vs. write** boundary explicit and intact — `trading-report` must never place/cancel orders or mutate account state; trading-agent is the only skill that trades.
- The `description` frontmatter is a triggering surface: when adding capabilities, extend its trigger phrases rather than shortening it.
