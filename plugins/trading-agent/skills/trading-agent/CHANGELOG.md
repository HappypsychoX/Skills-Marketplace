# Changelog — trading-agent

All notable changes to the `trading-agent` skill. Format follows [Keep a Changelog](https://keepachangelog.com/); versions match the `[vX.Y.Z]` tag in `SKILL.md` and `plugin.json` `version`.

## [2.0.1] — 2026-08-01
- **Fixed:** Instruction and wording cleanup in the skill body; no behavioral change to trading logic, protective orders, horizon bias, the leveraged-ETF screen, or risk-parameter sourcing.

## [2.0.0] — 2026-08-01
- **Changed:** Baseline under the versioning convention; renamed from the legacy `trading-skill-v4` to `trading-agent`.
- **Changed:** Point GitHub-backed infra at the `HappypsychoX/Trading-Dashboard` repo.
- **Changed:** Locate secrets via the connected folder instead of a hardcoded machine-specific path.
