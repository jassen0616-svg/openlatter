import "server-only";

type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatCompletionOptions = {
  messages: ChatMessage[];
  maxTokens?: number;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

export type ImageGenerationOptions = {
  prompt: string;
  model?: string;
  n?: number;
  responseFormat?: "b64_json" | "url";
  size?: string;
  timeoutMs?: number;
};

export type GeneratedImage = {
  b64Json?: string;
  revisedPrompt?: string;
  url?: string;
};

export class AiGatewayError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AiGatewayError";
    this.status = status;
  }
}

const DEFAULT_BASE_URL = "https://ai.mdldm.club/v1";
const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function readGatewayConfig() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    throw new AiGatewayError("Missing required environment variable: AI_GATEWAY_API_KEY");
  }

  return {
    apiKey,
    baseUrl: trimTrailingSlash(process.env.AI_GATEWAY_BASE_URL || DEFAULT_BASE_URL),
    imageModel: process.env.AI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
    textModel: process.env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL
  };
}

async function postJson<TResponse>(
  pathname: string,
  body: Record<string, unknown>,
  timeoutMs = 120000
) {
  const config = readGatewayConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      throw new AiGatewayError(text || `AI gateway request failed with ${response.status}`, response.status);
    }

    return JSON.parse(text) as TResponse;
  } catch (error) {
    if (error instanceof AiGatewayError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      throw new AiGatewayError("AI gateway request timed out");
    }

    throw new AiGatewayError(error instanceof Error ? error.message : "AI gateway request failed");
  } finally {
    clearTimeout(timer);
  }
}

export async function createChatCompletion(options: ChatCompletionOptions) {
  const config = readGatewayConfig();

  return postJson<ChatCompletionResponse>(
    "/chat/completions",
    {
      max_tokens: options.maxTokens,
      messages: options.messages,
      model: options.model || config.textModel,
      temperature: options.temperature
    },
    options.timeoutMs
  );
}

export async function generateText(options: ChatCompletionOptions) {
  const response = await createChatCompletion(options);
  const content = response.choices?.[0]?.message?.content;

  if (!content) {
    throw new AiGatewayError("AI gateway returned an empty text response");
  }

  return content;
}

function normalizeImageResponse(value: unknown): GeneratedImage[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const response = value as {
    data?: unknown[];
    output?: unknown[];
  };
  const items = response.data || response.output || [];

  return items
    .map((item): GeneratedImage | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const image = item as {
        b64_json?: string;
        image_url?: { url?: string };
        revised_prompt?: string;
        url?: string;
      };

      return {
        b64Json: image.b64_json,
        revisedPrompt: image.revised_prompt,
        url: image.url || image.image_url?.url
      };
    })
    .filter((image): image is GeneratedImage => image !== null && Boolean(image.b64Json || image.url));
}

export async function generateImage(options: ImageGenerationOptions) {
  const config = readGatewayConfig();
  const response = await postJson<unknown>(
    "/images/generations",
    {
      model: options.model || config.imageModel,
      n: options.n || 1,
      prompt: options.prompt,
      response_format: options.responseFormat,
      size: options.size || "1024x576"
    },
    options.timeoutMs || 180000
  );
  const images = normalizeImageResponse(response);

  if (!images.length) {
    throw new AiGatewayError("AI gateway returned an empty image response");
  }

  return images[0];
}
