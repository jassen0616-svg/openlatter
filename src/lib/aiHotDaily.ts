import "server-only";

import { assertNoQuestionMarkMojibake } from "@/lib/emailEncoding";

const AI_HOT_BASE_URL = "https://aihot.virxact.com";
const AI_HOT_DAILY_PATH = "/api/public/daily";
const AI_HOT_USER_AGENT = "aihot-skill/0.3.5 (+https://aihot.virxact.com/aihot-skill/)";
const AI_HOT_HOTSPOT_COUNT = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

type AiHotDailyItem = {
  permalink?: unknown;
  sourceName?: unknown;
  sourceUrl?: unknown;
  summary?: unknown;
  title?: unknown;
};

type AiHotDailySection = {
  items?: unknown;
  label?: unknown;
};

export type AiHotDailySourceItem = {
  label: string;
  sourceName: string;
  summary: string;
  title: string;
  urls: string[];
};

export type AiHotDailyMetadata = {
  canonical: string;
  date: string;
  generatedAt?: string;
  selectedItems: number;
  sections: number;
};

export type AiHotDailySourceResult = {
  items: AiHotDailySourceItem[];
  metadata: AiHotDailyMetadata;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readHttpUrl(value: unknown) {
  const rawValue = readString(value);

  if (!rawValue) {
    return "";
  }

  try {
    const url = new URL(rawValue);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchAiHotDailyJson() {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${AI_HOT_BASE_URL}${AI_HOT_DAILY_PATH}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": AI_HOT_USER_AGENT
        },
        signal: controller.signal
      });

      if (response.ok) {
        return (await response.json()) as unknown;
      }

      const message = `AI HOT daily request failed with ${response.status}`;

      if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
        lastError = new Error(message);
        await sleep(30_000);
        continue;
      }

      if (response.status >= 500 && attempt < MAX_ATTEMPTS - 1) {
        lastError = new Error(message);
        await sleep(1_000 * 2 ** attempt);
        continue;
      }

      throw new Error(message);
    } catch (error) {
      lastError = error;

      if ((isAbortError(error) || error instanceof TypeError) && attempt < MAX_ATTEMPTS - 1) {
        await sleep(1_000 * 2 ** attempt);
        continue;
      }

      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("AI HOT daily request failed");
}

function parseSection(value: unknown): { items: AiHotDailySourceItem[]; label: string } | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const section = value as AiHotDailySection;
  const label = readString(section.label);
  const rawItems = Array.isArray(section.items) ? section.items : [];
  const items = rawItems
    .map((rawItem): AiHotDailySourceItem | null => {
      if (!rawItem || typeof rawItem !== "object") {
        return null;
      }

      const item = rawItem as AiHotDailyItem;
      const title = readString(item.title);
      const summary = readString(item.summary);
      const urls = [readHttpUrl(item.permalink), readHttpUrl(item.sourceUrl)].filter(
        (url, index, values): url is string => Boolean(url) && values.indexOf(url) === index
      );

      if (!title || !summary || urls.length === 0) {
        return null;
      }

      return {
        label,
        sourceName: readString(item.sourceName),
        summary,
        title,
        urls
      };
    })
    .filter((item): item is AiHotDailySourceItem => item !== null);

  return label && items.length ? { items, label } : null;
}

function selectHotspots(sections: Array<{ items: AiHotDailySourceItem[]; label: string }>) {
  const selected: AiHotDailySourceItem[] = [];
  const seen = new Set<string>();

  const addItem = (item: AiHotDailySourceItem) => {
    const canonicalUrl = item.urls[0];

    if (selected.length >= AI_HOT_HOTSPOT_COUNT || seen.has(canonicalUrl)) {
      return;
    }

    selected.push(item);
    seen.add(canonicalUrl);
  };

  for (const section of sections) {
    if (section.items[0]) {
      addItem(section.items[0]);
    }
  }

  for (const section of sections) {
    for (const item of section.items) {
      addItem(item);
    }
  }

  if (selected.length !== AI_HOT_HOTSPOT_COUNT) {
    throw new Error(`AI HOT daily must provide at least ${AI_HOT_HOTSPOT_COUNT} complete items`);
  }

  return selected;
}

export async function fetchAiHotDailySource(): Promise<AiHotDailySourceResult> {
  const value = await fetchAiHotDailyJson();

  if (!value || typeof value !== "object") {
    throw new Error("AI HOT daily response is not an object");
  }

  const daily = value as {
    attribution?: { canonical?: unknown; source?: unknown };
    date?: unknown;
    generatedAt?: unknown;
    sections?: unknown;
  };
  const date = readString(daily.date);
  const canonical = readHttpUrl(daily.attribution?.canonical);
  const attributionSource = readString(daily.attribution?.source);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("AI HOT daily response has an invalid date");
  }

  if (!canonical || attributionSource !== "AI HOT") {
    throw new Error("AI HOT daily response is missing canonical attribution");
  }

  const sections = (Array.isArray(daily.sections) ? daily.sections : [])
    .map(parseSection)
    .filter((section): section is { items: AiHotDailySourceItem[]; label: string } => section !== null);
  const selected = selectHotspots(sections);

  const serialized = JSON.stringify(selected);
  assertNoQuestionMarkMojibake(serialized, "AI HOT daily source");

  if (!/[\u3400-\u9FFF]/.test(serialized)) {
    throw new Error("AI HOT daily source must contain Chinese text");
  }

  return {
    items: selected,
    metadata: {
      canonical,
      date,
      generatedAt: readString(daily.generatedAt) || undefined,
      sections: sections.length,
      selectedItems: selected.length
    }
  };
}
