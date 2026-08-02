// Real content for the Skills Marketplace site. Each entry mirrors a plugin in
// .claude-plugin/marketplace.json — its own standalone repo, installed via /plugin.
export const CATEGORIES = ["Trading", "Development"];

export const SKILLS = [
  {
    id: "trading-agent",
    name: "Trading Agent",
    category: "Trading",
    icon: "trendingUp",
    access: "Read + write",
    repo: "HappypsychoX/trading-agent",
    description: "Autonomously trade the Agentic Account via the Robinhood MCP.",
    longDescription: "Trading Agent runs an autonomous trading session against your designated Agentic Account: it reads market and account data through the Robinhood MCP, places trades, and attaches a standing protective order — stop-loss or take-profit — to each position. A tunable horizon bias slides it between short-term trading and long-term holding, a screen blocks new leveraged and inverse ETFs, and it pulls risk parameters from a GitHub-backed config each session, carrying a note forward to the next run.",
    install: "/plugin install trading-agent@skills-marketplace",
    triggers: "Kicks in when you ask Claude to run the trading agent, execute trades, trade autonomously, start an agentic trading session, or buy/sell stocks in the Agentic Account — and whenever you mention protective/stop-loss/take-profit orders, horizon bias, the leveraged-ETF rules, risk parameters, or the trading-config file.",
    configuration: "Reads its risk parameters fresh each session from a GitHub-backed config whose repo, branch, and path come from the external trading-config file (with a hardcoded fallback). A tunable HORIZON_BIAS scale slides it between short-term trading and long-term holding, and a screen blocks new leveraged or inverse ETF positions (e.g. TQQQ, SQQQ, SOXL). It carries a cross-session note forward so its reasoning and goals reach the next run.",
    requirements: [
      "Robinhood MCP — for market/account data and order placement.",
      "An external trading-config file (kept outside the repo, never committed) holding the GitHub token, owner/repo/branch, and file paths.",
      "Scoped to the Agentic Account only — no other Robinhood account is touched."
    ],
    usageTitle: "Ask Claude to run an agentic trading session",
    usagePrompt: "“Run the trading agent — trade the Agentic Account for today and set protective orders on anything you open.”",
    usageNote: "The only skill that places orders. It trades the Agentic Account exclusively and reads its risk limits fresh from the trading-config file each session.",
    related: ["trading-report", "independent-review"]
  },
  {
    id: "trading-report",
    name: "Trading Report",
    category: "Trading",
    icon: "barChart",
    access: "Read-only",
    repo: "HappypsychoX/trading-report",
    description: "Publish a daily read-only portfolio snapshot to the dashboard.",
    longDescription: "Trading Report is the read-only half of the trading system. It reads the Agentic Account through the Robinhood MCP, builds a daily portfolio snapshot — positions, P&L and account performance — and publishes it as JSON straight to GitHub through the Contents API, driving a GitHub Pages dashboard. It never places or cancels an order; its one write is the snapshot file.",
    install: "/plugin install trading-report@skills-marketplace",
    triggers: "Kicks in when you ask for a portfolio report, daily summary, account performance, or a P&L update, ask how the Agentic Account is doing, or want to update/publish/push the trading dashboard — including any mention of data.json, the dashboard repo, or the trading-config file.",
    configuration: "The target repo, branch, and dashboard file path all come from the external trading-config file. It reads the account through the Robinhood MCP and publishes the snapshot JSON straight to GitHub via the Contents API — that published snapshot is its one and only write.",
    requirements: [
      "Robinhood MCP — read-only; it never places or cancels orders.",
      "An external trading-config file holding the GitHub token, owner/repo/branch, and the dashboard-data path.",
      "Scoped to the Agentic Account only — no other Robinhood account appears in output."
    ],
    usageTitle: "Ask Claude for a portfolio update",
    usagePrompt: "“Give me today's Agentic Account report and push the dashboard.”",
    usageNote: "Strictly read-only against Robinhood — it can't trade. The target repo, branch and file path all come from the external trading-config file.",
    related: ["trading-agent", "independent-review"]
  },
  {
    id: "independent-review",
    name: "Independent Review",
    category: "Development",
    icon: "shieldCheck",
    access: "Read-only",
    repo: "HappypsychoX/independent-review",
    description: "Review a codebase for quality, security and risk — never edits.",
    longDescription: "Independent Review reads a codebase and produces a structured findings report across quality, architecture, performance, security, testing and documentation — each finding ranked by severity and ROI so the highest-leverage fixes surface first. It's strictly read-only: it analyzes and reports, but never modifies, refactors or rewrites the code.",
    install: "/plugin install independent-review@skills-marketplace",
    triggers: "Kicks in when you ask for an independent review, a code review, a quality/security/architecture audit, or a findings report — anything where you want a codebase analyzed and its issues ranked by severity and ROI.",
    configuration: "None. It's config-free — it takes no secrets and no runtime config file. Point it at any codebase and it reports.",
    requirements: [
      "Just a codebase to point it at — no MCP, token, or account scope required."
    ],
    usageTitle: "Ask Claude to review a codebase",
    usagePrompt: "“Do an independent review of this repo and rank the findings by severity and ROI.”",
    usageNote: "Read-only and config-free — point it at any codebase and it reports without touching a line.",
    related: ["trading-agent", "trading-report"]
  }
];

export const ICON_SHAPES = {
  trendingUp: [
    { tag: "polyline", attrs: { points: "3 17 9 11 13 15 21 7" } },
    { tag: "polyline", attrs: { points: "14 7 21 7 21 14" } }
  ],
  barChart: [
    { tag: "line", attrs: { x1: 4, y1: 20, x2: 20, y2: 20 } },
    { tag: "rect", attrs: { x: 6, y: 12, width: 3, height: 8 } },
    { tag: "rect", attrs: { x: 11, y: 7, width: 3, height: 13 } },
    { tag: "rect", attrs: { x: 16, y: 15, width: 3, height: 5 } }
  ],
  shieldCheck: [
    { tag: "path", attrs: { d: "M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" } },
    { tag: "polyline", attrs: { points: "9 12 11 14 15 9.5" } }
  ]
};
