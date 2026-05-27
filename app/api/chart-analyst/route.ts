import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  buildChartAnalystMessages,
  fallbackChartAnalysis,
  type ChartAnalystResult,
  type ChartAnalystInput,
} from "@/lib/ai/chartPrompt";
import { callOpenAICompatibleJson } from "@/lib/ai/providers/openaiCompatible";

export const runtime = "nodejs";

type CachedResponse = {
  result: ChartAnalystResult;
  provider: string;
  fallback: boolean;
  cached?: boolean;
};

type RateState = {
  day: string;
  count: number;
  lastAt: number;
};

const cache = new Map<string, { expiresAt: number; response: CachedResponse }>();
const rateState = new Map<string, RateState>();

const enabled = () => process.env.AI_ANALYST_ENABLED !== "false";
const dailyLimit = () => Number(process.env.AI_ANALYST_DAILY_LIMIT ?? 20);
const minIntervalMs = () => Number(process.env.AI_ANALYST_MIN_INTERVAL_SECONDS ?? 15) * 1000;
const cacheTtlMs = () => Number(process.env.AI_ANALYST_CACHE_TTL_SECONDS ?? 86400) * 1000;

function isValidPayload(value: unknown): value is ChartAnalystInput {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ChartAnalystInput>;
  return Array.isArray(payload.metrics) && typeof payload.platform === "string" && typeof payload.region === "string";
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function makeCacheKey(input: ChartAnalystInput) {
  const compact = {
    platform: input.platform,
    region: input.region,
    timelineMode: input.timelineMode,
    valueMode: input.valueMode,
    metrics: input.metrics.map((metric) => ({
      work_id: metric.work_id,
      peakRank: metric.peakRank,
      debutRank: metric.debutRank,
      latestRank: metric.latestRank,
      totalEntries: metric.totalEntries,
      weeksAtNumberOne: metric.weeksAtNumberOne,
      weeksInTop10: metric.weeksInTop10,
      biggestRise: metric.biggestRise,
      biggestDrop: metric.biggestDrop,
      status: metric.status,
      reEntryCount: metric.reEntryCount,
      maxStreams: metric.maxStreams,
    })),
  };
  return createHash("sha256").update(JSON.stringify(compact)).digest("hex");
}

function checkRateLimit(ip: string) {
  const now = Date.now();
  const day = todayKey();
  const current = rateState.get(ip);
  const state = current && current.day === day ? current : { day, count: 0, lastAt: 0 };
  const waitMs = minIntervalMs() - (now - state.lastAt);

  if (waitMs > 0) {
    return {
      ok: false,
      status: 429,
      message: `AI analysis is cooling down. Try again in ${Math.ceil(waitMs / 1000)} seconds.`,
      retryAfter: Math.ceil(waitMs / 1000),
    };
  }

  if (state.count >= dailyLimit()) {
    return {
      ok: false,
      status: 429,
      message: "Daily AI analysis limit reached for this visitor.",
      retryAfter: 60 * 60,
    };
  }

  rateState.set(ip, { ...state, count: state.count + 1, lastAt: now });
  return { ok: true };
}

export async function POST(request: Request) {
  try {
    if (!enabled()) {
      return NextResponse.json({ error: "AI Chart Analyst is disabled." }, { status: 503 });
    }

    const payload = (await request.json()) as unknown;
    if (!isValidPayload(payload)) {
      return NextResponse.json({ error: "Invalid chart analyst payload." }, { status: 400 });
    }

    const input: ChartAnalystInput = {
      ...payload,
      metrics: payload.metrics.slice(0, 5),
    };
    const cacheKey = makeCacheKey(input);
    const cached = cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.response, cached: true }, { headers: { "X-AI-Cache": "HIT" } });
    }

    const rateLimit = checkRateLimit(getClientIp(request));
    if (!rateLimit.ok) {
      return NextResponse.json(
        {
          error: rateLimit.message,
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: rateLimit.status,
          headers: { "Retry-After": String(rateLimit.retryAfter) },
        },
      );
    }

    try {
      const result = await callOpenAICompatibleJson(buildChartAnalystMessages(input));
      const response = { result, provider: process.env.AI_PROVIDER || "qwen", fallback: false };
      cache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs(), response });
      return NextResponse.json(response, { headers: { "X-AI-Cache": "MISS" } });
    } catch (error) {
      const response = {
        result: fallbackChartAnalysis(input),
        provider: process.env.AI_PROVIDER || "local-rule",
        fallback: true,
      };
      cache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs(), response });
      return NextResponse.json(response, { headers: { "X-AI-Cache": "MISS" } });
    }
  } catch {
    return NextResponse.json({ error: "Could not parse request body." }, { status: 400 });
  }
}
