# Skills Marketplace

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code) of packaged Claude skills, consumed via `/plugin`. There's no application or build system here — the deliverables are the skills themselves.

Each skill ships as its **own** plugin so they can be installed independently. By convention each plugin holds a single skill of the same name, unpacked as a plain `SKILL.md` (YAML frontmatter + instruction body) and auto-discovered under `skills/`.

## Plugins

| Plugin | Version | Access | Description |
| --- | --- | --- | --- |
| [`trading-agent`](plugins/trading-agent/skills/trading-agent/SKILL.md) | [3.0.0](plugins/trading-agent/skills/trading-agent/CHANGELOG.md) | Read + **write** | Autonomous Agentic-Account trader. Places trades via the Robinhood MCP with standing protective orders (stop-loss/take-profit), a tunable horizon bias, a leveraged/inverse ETF screen, and GitHub-backed risk parameters with a cross-session note. |
| [`trading-report`](plugins/trading-report/skills/trading-report/SKILL.md) | [3.0.0](plugins/trading-report/skills/trading-report/CHANGELOG.md) | **Read-only** | Reporting half. Reads Robinhood via MCP and publishes a portfolio snapshot (`data.json`) to the dashboard repo via the GitHub Contents API, driving a GitHub Pages dashboard. Never places or mutates orders. |

Both skills operate the same external trading system, scoped to the **Agentic Account only**. `trading-agent` is the only skill that trades; `trading-report` is strictly read-only against Robinhood.

## Install

```bash
/plugin marketplace add HappypsychoX/Skills-Marketplace
/plugin install trading-agent@skills-marketplace
/plugin install trading-report@skills-marketplace
```

## Configuration

Both skills read every environment-specific value — the GitHub token, the dashboard repo, the in-repo file paths, and the account scope — from a single runtime config file, **`trading-config.json`**, kept **outside this repo** and never committed. To set up:

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

```
.claude-plugin/marketplace.json        # marketplace manifest (name, owner, plugins[])
plugins/<plugin-name>/
  .claude-plugin/plugin.json           # plugin manifest (name, version, …)
  skills/<skill-name>/SKILL.md         # unpacked skill, auto-discovered
```

## Versioning

Every skill carries a SemVer version as a bracketed `[vMAJOR.MINOR.PATCH]` prefix at the start of its `SKILL.md` frontmatter `description`. **Every edit to a `SKILL.md` bumps the version**, and each plugin's `plugin.json` `version` is kept in **lockstep** with that description tag (the description version is the single source of truth). Bump by impact:

- **MAJOR** — a breaking behavior change (the read-only vs. write boundary moves, a capability is removed/renamed, or required infra changes).
- **MINOR** — a backward-compatible capability or new trigger phrases.
- **PATCH** — wording, clarifications, or instruction fixes with no behavioral change.

Each skill also keeps **its own** [Keep a Changelog](https://keepachangelog.com/)-style `CHANGELOG.md` next to its `SKILL.md`, and every version bump adds an entry in the same commit:

- [`trading-agent` changelog](plugins/trading-agent/skills/trading-agent/CHANGELOG.md)
- [`trading-report` changelog](plugins/trading-report/skills/trading-report/CHANGELOG.md)

See [CLAUDE.md](CLAUDE.md) for the full conventions.
