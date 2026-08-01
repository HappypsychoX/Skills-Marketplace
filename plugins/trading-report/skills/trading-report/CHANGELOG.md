# Changelog — trading-report

All notable changes to the `trading-report` skill. Format follows [Keep a Changelog](https://keepachangelog.com/); versions match the `[vX.Y.Z]` tag in `SKILL.md` and `plugin.json` `version`.

## [2.0.1] — 2026-08-01
- **Fixed:** Instruction and wording cleanup in the skill body; no behavioral change. The skill remains read-only against Robinhood, publishing only the dashboard snapshot.

## [2.0.0] — 2026-08-01
- **Changed:** Baseline under the versioning convention.
- **Changed:** Point the published dashboard snapshot at the `HappypsychoX/Trading-Dashboard` repo via the GitHub Contents API.
- **Changed:** Locate secrets via the connected folder instead of a hardcoded machine-specific path.
