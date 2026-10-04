// Every setting the server reads. Real values live in Render's Environment
// settings; names are listed in .env.example. Never log these values.

function read(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export interface Config {
  port: number;
  production: boolean;
  appBaseUrl: string;
  databaseUrl: string;
  sessionSigningKey: string;
  tokenEncryptionKey: string;
  frameAncestors: string[];
  boutiqly: {
    appId: string;
    clientId: string;
    clientSecret: string;
    sharedSecret: string;
    apiBase: string;
  };
  claudeModel: string;
  anthropicApiKey: string;
  // Anthropic's fast mode: the same model writes up to ~2.5x faster at 2x the
  // token price. On unless CLAUDE_FAST_MODE=off.
  claudeFastMode: boolean;
  // Studio credits per cent of Claude cost (1 credit = 1 cent of Claude cost x markup)
  creditMarkup: number;
  walletBillingMode: "off" | "test" | "live";
}

// Domains allowed to show the tab inside a frame. The platform's own app
// domains are unavoidable here; Boutiqly's white-label domain is added
// through BOUTIQLY_APP_DOMAINS.
const PLATFORM_FRAME_ANCESTORS = [
  "https://app.gohighlevel.com",
  "https://*.gohighlevel.com",
  "https://*.leadconnectorhq.com",
];

export function loadConfig(): Config {
  const production = read("NODE_ENV") === "production";
  const extraDomains = read("BOUTIQLY_APP_DOMAINS")
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("http") ? d : `https://${d}`));

  const config: Config = {
    port: Number(read("PORT", "3000")),
    production,
    appBaseUrl: read("APP_BASE_URL", read("RENDER_EXTERNAL_URL", "http://localhost:3000")),
    databaseUrl: read("DATABASE_URL", "postgres://localhost:5432/social_studio"),
    sessionSigningKey: read("SESSION_SIGNING_KEY"),
    tokenEncryptionKey: read("TOKEN_ENCRYPTION_KEY"),
    frameAncestors: [...PLATFORM_FRAME_ANCESTORS, ...extraDomains],
    boutiqly: {
      appId: read("BOUTIQLY_APP_ID"),
      clientId: read("BOUTIQLY_CLIENT_ID"),
      clientSecret: read("BOUTIQLY_CLIENT_SECRET"),
      sharedSecret: read("BOUTIQLY_SHARED_SECRET"),
      apiBase: read("BOUTIQLY_API_BASE", "https://services.leadconnectorhq.com"),
    },
    claudeModel: read("CLAUDE_MODEL", "claude-opus-5-5"),
    anthropicApiKey: read("ANTHROPIC_API_KEY"),
    claudeFastMode: read("CLAUDE_FAST_MODE", "on").toLowerCase() !== "off",
    creditMarkup: Number(read("CREDIT_MARKUP", "2")) || 2,
    walletBillingMode: (["off", "test", "live"].includes(read("WALLET_BILLING_MODE"))
      ? read("WALLET_BILLING_MODE")
      : "off") as Config["walletBillingMode"],
  };

  if (production && (!config.sessionSigningKey || !config.tokenEncryptionKey)) {
    throw new Error("SESSION_SIGNING_KEY and TOKEN_ENCRYPTION_KEY must be set in production.");
  }
  if (!config.sessionSigningKey) config.sessionSigningKey = "local-dev-only-signing-key";
  if (!config.tokenEncryptionKey) config.tokenEncryptionKey = "local-dev-only-encryption-key";
  return config;
}

// Settings that must be filled in before the tab can work inside Boutiqly.
// Shown by name only on the health page so Katy can see what's missing.
export function missingSettings(config: Config): string[] {
  const missing: string[] = [];
  if (!config.boutiqly.sharedSecret) missing.push("BOUTIQLY_SHARED_SECRET");
  if (!config.boutiqly.clientId) missing.push("BOUTIQLY_CLIENT_ID");
  if (!config.boutiqly.clientSecret) missing.push("BOUTIQLY_CLIENT_SECRET");
  if (!config.anthropicApiKey) missing.push("ANTHROPIC_API_KEY");
  return missing;
}

// Claude's prices in US dollars per million tokens, so credits follow the
// real cost when the model changes. Check against Anthropic's pricing page
// when adding a model. Cache writes are the 5-minute kind (1.25x input).
export interface ModelPrice {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export const CLAUDE_PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-7": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

// A model missing from the table is charged at the highest price we know,
// so a gap never makes Claude look cheaper than it is.
export const UNKNOWN_MODEL_PRICE: ModelPrice = { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 };

export const WEB_SEARCH_DOLLARS_PER_1000 = 10;

// Fast mode charges this multiple of the token prices (not of web searches).
export const FAST_MODE_MULTIPLIER = 2;
