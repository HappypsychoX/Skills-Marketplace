# Changelog — trading-report

All notable changes to the `trading-report` skill. Format follows [Keep a Changelog](https://keepachangelog.com/); versions match the `[vX.Y.Z]` tag in `SKILL.md` and `plugin.json` `version`.

## [3.0.0] — 2026-08-01
- **Changed:** Externalized every environment-specific value into a single runtime config file, `trading-config.json`, located via the connected folder (suggested `%LOCALAPPDATA%/trading-report`) — no hardcoded repo owner/name, file path, or account scope remains in the skill body.
- **Changed:** The GitHub token, dashboard repo (`owner`/`repo`/`branch`), published-data path, and account scope are all read from that config file; the fetch and publish curl commands compose their URLs from those values.
- **Added:** A sanitized `trading-config.example.json` template (token and repo blanked) to copy and fill in; the real config lives outside the repo and is git-ignored.

## [2.0.1] — 2026-08-01
- **Fixed:** Instruction and wording cleanup in the skill body; no behavioral change. The skill remains read-only against Robinhood, publishing only the dashboard snapshot.

## [2.0.0] — 2026-08-01
- **Changed:** Baseline under the versioning convention.
- **Changed:** Point the published dashboard snapshot at the `HappypsychoX/Trading-Dashboard` repo via the GitHub Contents API.
- **Changed:** Locate secrets via the connected folder instead of a hardcoded machine-specific path.
