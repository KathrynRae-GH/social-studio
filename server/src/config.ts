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
  return missing;
}
