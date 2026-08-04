# OpenAI / ChatGPT compatibility

Investigation for [issue #39](https://github.com/HappypsychoX/Skills-Marketplace/issues/39): what it takes to make the skills in this marketplace consumable by OpenAI's ecosystem, and what we've implemented.

## TL;DR

OpenAI has **two** distinct surfaces, and they are not equivalent:

1. **Codex CLI** — a local coding agent (like Claude Code) with a **repo-based plugin marketplace**. This is a near drop-in second target: same `SKILL.md` format, same thin-index model, an analogous `marketplace.json`, and — because Codex runs locally — the trading skills' local `trading-config.json` + Robinhood MCP + local GitHub token model ports essentially unchanged. **This is what we implemented.**
2. **ChatGPT app directory (Apps SDK)** — apps that run inside the hosted ChatGPT product. There is **no repo-based ingestion**; each app is submitted individually through a web portal and reviewed, and connectors authenticate via OAuth (no local secrets file). This is a heavier, separate path with real caveats for the trading skills.

## Concept mapping

| Piece | Claude Code (this repo) | Codex CLI | ChatGPT app directory (Apps SDK) |
| --- | --- | --- | --- |
| Marketplace manifest | `.claude-plugin/marketplace.json` | `.agents/plugins/marketplace.json` | none — per-app portal submission |
| Add command | `/plugin marketplace add HappypsychoX/Skills-Marketplace` | `codex plugin marketplace add HappypsychoX/Skills-Marketplace --ref main` | submit at platform.openai.com/plugins |
| Per-plugin manifest | `.claude-plugin/plugin.json` | `.codex-plugin/plugin.json` (`name`, `version`, `description`, `skills:"./skills/"`) | listing metadata in the portal form |
| Skill file | `skills/<name>/SKILL.md` | `skills/<name>/SKILL.md` — **identical** | `skills/<name>/SKILL.md` (skills-only plugins are supported) |
| Thin-index (external repo) source | `source:{source:"github", repo:"owner/name"}` | `source:{source:"url", url:"https://github.com/owner/name.git", ref}` | n/a |
| Tool backend | Robinhood MCP (remote) | same MCP, added locally | remote HTTPS MCP connector (OAuth / none) |
| Read/write split | description copy | `policy.authentication` + tool hints | `readOnlyHint` / `destructiveHint` / `openWorldHint` tool annotations |

The convergence is real: OpenAI's plugin model uses a `SKILL.md` file with a name + description + instruction body, the same shape this marketplace already ships. A plugin "can consist of skills alone; the MCP server is optional."

## Codex marketplace entry shape

The Codex manifest lives at [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json). Top-level `name` + `interface.displayName` + `plugins[]`. Each entry:

```json
{
  "name": "trading-agent",
  "source": {
    "source": "url",
    "url": "https://github.com/HappypsychoX/trading-agent.git",
    "ref": "main"
  },
  "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
  "category": "Finance"
}
```

- `source:"url"` = the plugin lives at the **repo root** (which is where each per-skill repo's `.codex-plugin/plugin.json` will live). Use `source:"git-subdir"` with an extra `path` for subdirectory plugins; use `source:"local"` with `path` to vendor in-repo. We use `url` to preserve this repo's thin-index model — no re-vendoring of skill source.
- `policy.installation` ∈ `AVAILABLE` | `INSTALLED_BY_DEFAULT` | `NOT_AVAILABLE`.
- `policy.authentication` ∈ `ON_INSTALL` | `ON_USE`. The two trading skills need config present, so `ON_INSTALL`; `independent-review` takes no secrets, so `ON_USE`.
- `category` is a fixed vocabulary (Finance, Developer Tools, …).

> **Note:** the exact `source:"url"` field name is inferred from the documented `git-subdir` example (same `url`/`ref` keys, minus `path`). Verify against the installed Codex version before relying on it in production.

## Source-of-truth discipline

The Codex manifest is a **derived mirror** of `.claude-plugin/marketplace.json`, not a hand-maintained parallel. [`scripts/validate-metadata.mjs`](../scripts/validate-metadata.mjs) now treats it as a third sync target (alongside `docs/skills-data.js` and the pages' `#fallback` lists): it checks the same plugin set, that each `source.url` normalizes to the same `owner/repo` as the Claude manifest, and that every entry has a valid `policy`/`category`. CI runs this on every PR, so the two marketplaces can't drift.

## Per-surface portability verdict

| Skill | Codex CLI | ChatGPT app directory |
| --- | --- | --- |
| `independent-review` | ✅ trivial — read-only, config-free | ✅ ports cleanly (skills-only, no auth) |
| `trading-report` | ✅ local config + Robinhood MCP + GitHub token work as-is | ⚠️ needs the GitHub-write + token moved into an OAuth-authenticated MCP server; no local `trading-config.json` |
| `trading-agent` | ✅ same as above; places trades locally as today | ⚠️ same auth caveat, plus write/`destructiveHint` review scrutiny for a skill that trades real money |

## What's implemented vs. pending

- **Done (this repo):** the Codex marketplace manifest (Phase A) and this writeup (Phase D), plus the validator extension keeping the manifest in sync.
- **Prerequisite, pending (per-skill repos):** each `HappypsychoX/<skill-name>` repo needs a `.codex-plugin/plugin.json` at its root. **Until that lands, the Codex manifest entries resolve to repos Codex can't load** — Phase A is wired but not yet functional. Tracked as a follow-up issue.
- **Pending (docs surfacing):** Codex install instructions in the README and `docs/` site, and the tiered Codex-vs-ChatGPT usage story. Tracked as a follow-up issue.
- **Out of scope for now:** ChatGPT app-directory submission (portal + review + OAuth connector work), given the trading-config/auth caveats above.

## Sources

- [Introducing apps in ChatGPT and the Apps SDK](https://openai.com/index/introducing-apps-in-chatgpt/)
- [Skills concept – Apps SDK](https://developers.openai.com/plugins/concepts/skills)
- [MCP server concept – Apps SDK](https://developers.openai.com/apps-sdk/concepts/mcp-server)
- [Submit plugins – OpenAI Developers](https://developers.openai.com/plugins/deploy/submission)
- [openai/plugins repository](https://github.com/openai/plugins)
- [Developer mode and MCP apps in ChatGPT – OpenAI Help Center](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
