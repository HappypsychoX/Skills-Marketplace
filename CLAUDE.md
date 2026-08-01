# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection ("marketplace") of packaged Claude skills, shipped as a **Claude Code plugin marketplace** (`.claude-plugin/marketplace.json` + `plugins/`) and consumed via `/plugin`. There is no application, build system, or test suite — the deliverables are the skills themselves.

Each skill lives as a plain `SKILL.md`: Markdown with a YAML frontmatter block (`name`, `description`) followed by the skill's instruction body. The `description` is what a Claude agent matches against to decide when to invoke the skill, so it is written as a long trigger-phrase list, not prose.

## Plugin marketplace layout

```
.claude-plugin/marketplace.json        # marketplace manifest (name, owner, plugins[])
plugins/<plugin-name>/
  .claude-plugin/plugin.json           # plugin manifest (name required)
  skills/<skill-name>/SKILL.md         # unpacked skills, auto-discovered
```

Each skill ships as its **own** plugin so they can be installed independently — `trading-agent` (trades) and `trading-report` (read-only), matching the read/write split of the live system (see below). By convention each plugin holds a single skill of the same name. Skills under `skills/` are auto-discovered — they are not listed in `plugin.json`. A plugin `source` in `marketplace.json` is a relative path that must start with `./` and resolves from the repo root.

Users install a plugin with:
```bash
/plugin marketplace add HappypsychoX/Skills-Marketplace
/plugin install trading-agent@skills-marketplace
/plugin install trading-report@skills-marketplace
```

When asked to "change a skill", the edit belongs in that skill's `plugins/<plugin-name>/skills/<skill-name>/SKILL.md` — a plain Markdown file you can Read and Edit directly. (This repo used to also ship each skill as a `.skill` ZIP archive at the root; those were removed once the unpacked `SKILL.md` files became the single source of truth.)

## The two current skills share one live system

Both skills operate the same external trading system, so a change to shared conventions (repo names, file paths, the read-only rule) usually needs to be mirrored in both:

- **`trading-agent`** — the autonomous trading agent. Reads market/account data and **places trades** in the Agentic Account via the Robinhood MCP. Fetches its risk parameters fresh each session from `config/risk-parameters.json`, falling back to a hardcoded table.
- **`trading-report`** — the reporting half. **Read-only** against Robinhood; its one write is publishing a portfolio snapshot to `docs/data/data.json`, which drives a GitHub Pages dashboard.

Shared infrastructure both skills assume:
- **Robinhood MCP** for account/market data (and, for trading-agent only, order placement).
- **GitHub REST Contents API** — writes/reads go to the `HappypsychoX/Trading-Dashboard` repo, `main` branch, **not** to this repo. Skills use the raw REST API (`curl`), never `git` clones or local checkouts, so they run identically from a fresh unattended session.
- **Token** read from a `github.json` secrets file (`{"github": {"token": "ghp_..."}}`). Never print the token in chat.
- **Scope: the "Agentic Account" only.** Other Robinhood accounts must never appear in queries or output.

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

**Keep `plugin.json` `version` in lockstep with the description tag**, using the description version as the single source of truth: on every skill edit, set both the `SKILL.md` `[vX.Y.Z]` and that plugin's `plugin.json` `version` to the same bumped SemVer. This repo is one-skill-per-plugin, so one honest number is clearer than two, the `/plugin` picker shows the version the skill advertises, and — because a static unchanged `plugin.json` `version` means installers don't receive the update — tying the plugin bump to the mandatory description bump guarantees a skill change can't ship without moving the version that gates delivery.

**Caveat:** this lockstep holds only while it's one skill per plugin. If a plugin ever bundles multiple skills, switch models — `plugin.json` `version` becomes a package-level rollup (or omit it to fall back to the git commit SHA) and each skill keeps its own independent description version. Do not apply lockstep to a multi-skill plugin.

- **Never hardcode a machine-specific filesystem path or username** in skill bodies — locate secrets via whatever folder is connected, so the same skill text runs across different PCs. (Note: some existing skills still contain absolute `C:/Users/...` paths; prefer the connected-folder pattern over copying those.)
- Keep the **read-only vs. write** boundary explicit and intact — `trading-report` must never place/cancel orders or mutate account state; trading-agent is the only skill that trades.
- The `description` frontmatter is a triggering surface: when adding capabilities, extend its trigger phrases rather than shortening it.
