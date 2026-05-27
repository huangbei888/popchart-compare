import type { ChartAnalystResult } from "@/lib/ai/chartPrompt";

type ChatMessage = {
  role: string;
  content: string;
};

type ProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function stripCodeFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function getProviderConfig(): ProviderConfig | null {
  const provider = (process.env.AI_PROVIDER || "qwen").toLowerCase();

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return {
      apiKey,
      baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/chat/completions",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }

  const apiKey = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    model: process.env.QWEN_MODEL || "qwen-plus",
  };
}

export async function callOpenAICompatibleJson(messages: ChatMessage[]): Promise<ChartAnalystResult> {
  const config = getProviderConfig();
  if (!config) {
    throw new Error("Missing AI provider API key. Set QWEN_API_KEY or DEEPSEEK_API_KEY in .env.local.");
  }

  const response = await fetch(config.baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.8,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI provider request failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("AI provider returned an empty response.");
  }

  return JSON.parse(stripCodeFence(content)) as ChartAnalystResult;
}
