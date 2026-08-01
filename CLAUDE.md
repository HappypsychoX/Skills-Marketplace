# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection ("marketplace") of packaged Claude skills, one `.skill` file per skill. There is no application, build system, or test suite — the deliverables are the `.skill` archives themselves.

A `.skill` file is a **ZIP archive** whose single entry is `<skill-name>/SKILL.md`. `SKILL.md` is Markdown with a YAML frontmatter block (`name`, `description`) followed by the skill's instruction body. The `description` is what a Claude agent matches against to decide when to invoke the skill, so it is written as a long trigger-phrase list, not prose.

## Working with `.skill` files

These are binary (ZIP) — you cannot Read or Edit them directly. Extract, edit the inner `SKILL.md`, then re-zip.

Inspect an archive's contents:
```bash
unzip -l trading-skill-v4.skill
```

Extract to inspect/edit the `SKILL.md`:
```bash
unzip -o trading-skill-v4.skill -d ./_work
```

Repackage after editing (the archive path inside the zip must stay `<skill-name>/SKILL.md`):
```bash
cd ./_work && zip -r ../trading-skill-v4.skill trading-skill-v4/SKILL.md
```

When asked to "change a skill", the edit almost always belongs in the inner `SKILL.md`, not in any file at the repo root.

## The two current skills share one live system

Both skills operate the same external trading system, so a change to shared conventions (repo names, file paths, the read-only rule) usually needs to be mirrored in both:

- **`trading-skill-v4`** — the autonomous trading agent. Reads market/account data and **places trades** in the Agentic Account via the Robinhood MCP. Fetches its risk parameters fresh each session from `config/risk-parameters.json`, falling back to a hardcoded table.
- **`trading-report`** — the reporting half. **Read-only** against Robinhood; its one write is publishing a portfolio snapshot to `docs/data/data.json`, which drives a GitHub Pages dashboard.

Shared infrastructure both skills assume:
- **Robinhood MCP** for account/market data (and, for v4 only, order placement).
- **GitHub REST Contents API** — writes/reads go to the `HappypsychoX/Trading-Agent` repo, `main` branch, **not** to this repo. Skills use the raw REST API (`curl`), never `git` clones or local checkouts, so they run identically from a fresh unattended session.
- **Token** read from a `github.json` secrets file (`{"github": {"token": "ghp_..."}}`). Never print the token in chat.
- **Scope: the "Agentic Account" only.** Other Robinhood accounts must never appear in queries or output.

## Conventions to preserve when editing skills

- **Never hardcode a machine-specific filesystem path or username** in skill bodies — locate secrets via whatever folder is connected, so the same skill text runs across different PCs. (Note: some existing skills still contain absolute `C:/Users/...` paths; prefer the connected-folder pattern over copying those.)
- Keep the **read-only vs. write** boundary explicit and intact — `trading-report` must never place/cancel orders or mutate account state; v4 is the only skill that trades.
- The `description` frontmatter is a triggering surface: when adding capabilities, extend its trigger phrases rather than shortening it.
