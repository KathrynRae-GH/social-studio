// The only door to Claude. Every call goes through callClaude, which:
//   1. refuses if Claude is off for the shop, or the shop is at its monthly cap;
//   2. runs the call on the configured model (never hard-coded);
//   3. writes one usage_ledger row with tokens, web searches, cost and credits.
// Wallet charges (Milestone 6) will be matched against these rows.
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db/pool.ts";
import { brands, usageLedger } from "../db/schema.ts";
import { AccessError, type Brand } from "../brands.ts";
import { CLAUDE_PRICES, UNKNOWN_MODEL_PRICE, WEB_SEARCH_DOLLARS_PER_1000, type Config, type ModelPrice } from "../config.ts";

export type StreamParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
export type ClaudeMessage = Anthropic.Beta.BetaMessage;

// What the app needs from the Anthropic SDK. Tests swap in a scripted fake.
export interface ClaudeApi {
  send(params: StreamParams, onText?: (delta: string) => void): Promise<ClaudeMessage>;
}

export function anthropicApi(apiKey: string): ClaudeApi {
  const client = new Anthropic({ apiKey, maxRetries: 2 });
  return {
    async send(params, onText) {
      const stream = client.beta.messages.stream(params);
      if (onText) stream.on("text", (delta) => onText(delta));
      return stream.finalMessage();
    },
  };
}

export class ClaudePausedError extends AccessError {
  constructor(message: string) {
    super(message, 402);
  }
}

export interface ClaudeDeps {
  db: Db;
  config: Config;
  api: ClaudeApi;
}

export interface CallContext {
  brand: Brand;
  userId: string;
  purpose: "ask_claude" | "tag_asset";
  refId?: string | null;
}

// ---- Money ----

export interface UsageNumbers {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
}

export function priceFor(model: string): ModelPrice {
  return CLAUDE_PRICES[model] ?? UNKNOWN_MODEL_PRICE;
}

// Cost in cents, unrounded (the ledger keeps four decimal places).
export function costCents(u: UsageNumbers): number {
  const p = priceFor(u.model);
  const dollars =
    (u.inputTokens * p.input + u.outputTokens * p.output + u.cacheReadTokens * p.cacheRead + u.cacheWriteTokens * p.cacheWrite) / 1_000_000 +
    (u.webSearches * WEB_SEARCH_DOLLARS_PER_1000) / 1000;
  return dollars * 100;
}

// A response can hold several model runs (a refusal fallback answers on a
// second model). Each run is priced at its own model's rates.
export function usageRows(message: ClaudeMessage, requestedModel: string): UsageNumbers[] {
  const u = message.usage;
  const searches = u.server_tool_use?.web_search_requests ?? 0;
  const runs = (u.iterations ?? []).filter(
    (it): it is Anthropic.Beta.BetaMessageIterationUsage | Anthropic.Beta.BetaFallbackMessageIterationUsage =>
      it.type === "message" || it.type === "fallback_message",
  );
  if (runs.length > 0) {
    const byModel = new Map<string, UsageNumbers>();
    for (const r of runs) {
      const model = r.model ?? requestedModel;
      const row = byModel.get(model) ?? { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, webSearches: 0 };
      row.inputTokens += r.input_tokens;
      row.outputTokens += r.output_tokens;
      row.cacheReadTokens += r.cache_read_input_tokens ?? 0;
      row.cacheWriteTokens += r.cache_creation_input_tokens ?? 0;
      byModel.set(model, row);
    }
    const rows = [...byModel.values()];
    rows[0]!.webSearches = searches;
    return rows;
  }
  return [
    {
      model: message.model || requestedModel,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      cacheReadTokens: u.cache_read_input_tokens ?? 0,
      cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      webSearches: searches,
    },
  ];
}

function monthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// Claude cost so far this calendar month (UTC), in cents.
export async function spentThisMonth(db: Db, brandId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ cents: sql<string>`coalesce(sum(${usageLedger.costCents}), 0)` })
    .from(usageLedger)
    .where(and(eq(usageLedger.brandId, brandId), gte(usageLedger.createdAt, monthStart(now))));
  return Number(row?.cents ?? 0);
}

export async function assertCanSpend(deps: ClaudeDeps, brandId: string): Promise<void> {
  const [b] = await deps.db.select().from(brands).where(eq(brands.id, brandId));
  if (!b?.claudeEnabled) throw new ClaudePausedError("Claude isn't turned on for this shop yet. Boutiqly's team turns it on from the Brand screen.");
  if (!deps.config.anthropicApiKey) throw new ClaudePausedError("Claude isn't connected yet (the Claude API key is missing).");
  const spent = await spentThisMonth(deps.db, brandId);
  if (spent >= b.claudeCapCents) {
    throw new ClaudePausedError(
      `Claude is paused for this shop: it has used this month's limit ($${(b.claudeCapCents / 100).toFixed(2)}). Boutiqly's team can raise the limit on the Brand screen.`,
    );
  }
}

export async function recordUsage(deps: ClaudeDeps, ctx: CallContext, rows: UsageNumbers[]): Promise<number> {
  let total = 0;
  for (const u of rows) {
    const cents = costCents(u);
    total += cents;
    await deps.db.insert(usageLedger).values({
      brandId: ctx.brand.id,
      userId: ctx.userId,
      purpose: ctx.purpose,
      refId: ctx.refId ?? null,
      model: u.model,
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cacheReadTokens: u.cacheReadTokens,
      cacheWriteTokens: u.cacheWriteTokens,
      webSearches: u.webSearches,
      costCents: cents.toFixed(4),
      credits: (cents * deps.config.creditMarkup).toFixed(4),
    });
  }
  return total;
}

// ---- The call ----

export interface CallOptions {
  system: Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  tools?: Anthropic.Beta.BetaToolUnion[];
  maxTokens?: number;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  jsonSchema?: Record<string, unknown>; // structured output
  onText?: (delta: string) => void;
}

export async function callClaude(deps: ClaudeDeps, ctx: CallContext, opts: CallOptions): Promise<{ message: ClaudeMessage; costCents: number }> {
  await assertCanSpend(deps, ctx.brand.id);
  const model = deps.config.claudeModel;
  const message = await deps.api.send(
    {
      model,
      max_tokens: opts.maxTokens ?? 32000,
      system: opts.system,
      messages: opts.messages,
      ...(opts.tools?.length ? { tools: opts.tools } : {}),
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "high",
        ...(opts.jsonSchema ? { format: { type: "json_schema" as const, schema: opts.jsonSchema } } : {}),
      },
      // If a safety check declines, Anthropic retries on a fallback model in
      // the same call; usageRows prices that run at its own model's rates.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    opts.onText,
  );
  const cents = await recordUsage(deps, ctx, usageRows(message, model));
  return { message, costCents: cents };
}

// ---- Settings (Boutiqly's team only) ----

export interface ClaudeSettings {
  enabled: boolean;
  capCents: number;
  spentCents: number;
  connected: boolean;
}

export async function claudeSettings(deps: ClaudeDeps, brand: Brand): Promise<ClaudeSettings> {
  const [b] = await deps.db.select().from(brands).where(eq(brands.id, brand.id));
  return {
    enabled: !!b?.claudeEnabled,
    capCents: b?.claudeCapCents ?? 0,
    spentCents: Math.round((await spentThisMonth(deps.db, brand.id)) * 100) / 100,
    connected: !!deps.config.anthropicApiKey,
  };
}
