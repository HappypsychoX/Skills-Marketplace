# Skills Marketplace

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code) of packaged Claude skills, consumed via `/plugin`. There's no application or build system here — this repo is a thin index, and each skill lives in **its own standalone repo** referenced by the marketplace manifest.

Each skill ships as its **own** plugin in its **own** repo so they can be installed and versioned independently. By convention each plugin holds a single skill of the same name, unpacked as a plain `SKILL.md` (YAML frontmatter + instruction body) and auto-discovered under `skills/`.

## Plugins

| Plugin | Repo | Access | Description |
| --- | --- | --- | --- |
| `trading-agent` | [HappypsychoX/trading-agent](https://github.com/HappypsychoX/trading-agent) | Read + **write** | Autonomous Agentic-Account trader. Places trades via the Robinhood MCP with standing protective orders (stop-loss/take-profit), a tunable horizon bias, a leveraged/inverse ETF screen, and GitHub-backed risk parameters with a cross-session note. |
| `trading-report` | [HappypsychoX/trading-report](https://github.com/HappypsychoX/trading-report) | **Read-only** | Reporting half. Reads Robinhood via MCP and publishes a portfolio snapshot (`data.json`) to the dashboard repo via the GitHub Contents API, driving a GitHub Pages dashboard. Never places or mutates orders. |
| `independent-review` | [HappypsychoX/independent-review](https://github.com/HappypsychoX/independent-review) | **Read-only** | Codebase reviewer. Analyzes code quality, architecture, performance, security, testing, and documentation, then produces a structured findings report ranked by severity and ROI. Never modifies, refactors, or rewrites the code. |

The two trading skills operate the same external trading system, scoped to the **Agentic Account only**. `trading-agent` is the only skill that trades; `trading-report` is strictly read-only against Robinhood. `independent-review` is unrelated to trading — a standalone read-only code reviewer.

## Install

```bash
/plugin marketplace add HappypsychoX/Skills-Marketplace
/plugin install trading-agent@skills-marketplace
/plugin install trading-report@skills-marketplace
/plugin install independent-review@skills-marketplace
```

## Configuration

`independent-review` needs no configuration — it reviews whatever codebase you point it at and takes no secrets or runtime config file.

The two **trading** skills read every environment-specific value — the GitHub token, the dashboard repo, the in-repo file paths, and the account scope — from a single runtime config file, **`trading-config.json`**, kept **outside this repo** and never committed. To set up:

1. Copy the committed template `trading-config.example.json` (one ships next to each skill) to `trading-config.json`.
2. Put it in a folder you connect to the skill at runtime. Suggested location: `%LOCALAPPDATA%/<skill-name>` (e.g. `%LOCALAPPDATA%/trading-agent`, `%LOCALAPPDATA%/trading-report`); a shared secrets folder works too since both skills use the same file shape.
3. Fill in your own values:

   ```json
   {
     "github": { "token": "ghp_…", "owner": "you", "repo": "your-dashboard-repo", "branch": "main" },
     "paths":  { "risk_parameters": "config/risk-parameters.json", "dashboard_data": "docs/data/data.json" },
     "account": { "scope": "Agentic Account" }
   }
   ```

The skills locate this file via the connected folder — no hardcoded path or username — so a fresh clone on any machine works once you create that one file. The token needs `repo` scope on your dashboard repo and is never printed in chat.

## Layout

This repo holds only the manifest:

```
.claude-plugin/marketplace.json        # marketplace manifest (name, owner, plugins[])
```

Each `plugins[]` entry's `source` is a GitHub reference (`{ "source": "github", "repo": "HappypsychoX/<skill-name>" }`) to the skill's own repo, which carries the plugin/skill tree:

```
HappypsychoX/<skill-name>              # standalone per-skill repo
  .claude-plugin/plugin.json           # plugin manifest (name, version, …)
  skills/<skill-name>/SKILL.md         # unpacked skill, auto-discovered
```

## Versioning

Every skill carries a SemVer version as a bracketed `[vMAJOR.MINOR.PATCH]` prefix at the start of its `SKILL.md` frontmatter `description`. **Every edit to a `SKILL.md` bumps the version**, and each plugin's `plugin.json` `version` is kept in **lockstep** with that description tag (the description version is the single source of truth). Bump by impact:

- **MAJOR** — a breaking behavior change (the read-only vs. write boundary moves, a capability is removed/renamed, or required infra changes).
- **MINOR** — a backward-compatible capability or new trigger phrases.
- **PATCH** — wording, clarifications, or instruction fixes with no behavioral change.

Each skill also keeps **its own** [Keep a Changelog](https://keepachangelog.com/)-style `CHANGELOG.md` next to its `SKILL.md` in its own repo, and every version bump adds an entry in the same commit:

- [`trading-agent` changelog](https://github.com/HappypsychoX/trading-agent/blob/main/skills/trading-agent/CHANGELOG.md)
- [`trading-report` changelog](https://github.com/HappypsychoX/trading-report/blob/main/skills/trading-report/CHANGELOG.md)
- [`independent-review` changelog](https://github.com/HappypsychoX/independent-review/blob/main/skills/independent-review/CHANGELOG.md)

See [CLAUDE.md](CLAUDE.md) for the full conventions.
