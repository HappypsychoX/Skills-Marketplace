# Skills Marketplace

A [Claude Code plugin marketplace](https://docs.claude.com/en/docs/claude-code) of packaged Claude skills, consumed via `/plugin`. There's no application or build system here — the deliverables are the skills themselves.

Each skill ships as its **own** plugin so they can be installed independently. By convention each plugin holds a single skill of the same name, unpacked as a plain `SKILL.md` (YAML frontmatter + instruction body) and auto-discovered under `skills/`.

## Plugins

| Plugin | Version | Access | Description |
| --- | --- | --- | --- |
| [`trading-agent`](plugins/trading-agent/skills/trading-agent/SKILL.md) | 2.0.1 | Read + **write** | Autonomous Agentic-Account trader. Places trades via the Robinhood MCP with standing protective orders (stop-loss/take-profit), a tunable horizon bias, a leveraged/inverse ETF screen, and GitHub-backed risk parameters with a cross-session note. |
| [`trading-report`](plugins/trading-report/skills/trading-report/SKILL.md) | 2.0.1 | **Read-only** | Reporting half. Reads Robinhood via MCP and publishes a portfolio snapshot (`data.json`) to the Trading-Dashboard repo via the GitHub Contents API, driving a GitHub Pages dashboard. Never places or mutates orders. |

Both skills operate the same external trading system, scoped to the **Agentic Account only**. `trading-agent` is the only skill that trades; `trading-report` is strictly read-only against Robinhood.

## Install

```bash
/plugin marketplace add HappypsychoX/Skills-Marketplace
/plugin install trading-agent@skills-marketplace
/plugin install trading-report@skills-marketplace
```

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

See [CLAUDE.md](CLAUDE.md) for the full conventions.
