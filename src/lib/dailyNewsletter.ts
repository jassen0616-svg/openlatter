import "server-only";

import { generateImage, generateText } from "@/lib/aiGateway";
import { sendEmail, type SendEmailResult } from "@/lib/directMail";
import {
  assertAsciiOnly,
  assertNoQuestionMarkMojibake,
  decodeNumericHtmlEntities,
  encodeHtmlEntities,
  escapeHtml
} from "@/lib/emailEncoding";
import { archiveNewsletter, type NewsletterArchiveResult } from "@/lib/newsletterArchive";

type XTweet = {
  createdAt?: string;
  likes?: number;
  text?: string;
  url?: string;
};

type XBuilder = {
  bio?: string;
  handle?: string;
  name?: string;
  tweets?: XTweet[];
};

type XFeed = {
  generatedAt?: string;
  x?: XBuilder[];
};

type PodcastItem = {
  name?: string;
  publishedAt?: string;
  title?: string;
  transcript?: string;
  url?: string;
};

type PodcastFeed = {
  generatedAt?: string;
  podcasts?: PodcastItem[];
};

type BlogItem = {
  content?: string;
  name?: string;
  publishedAt?: string;
  summary?: string;
  text?: string;
  title?: string;
  url?: string;
};

type BlogFeed = {
  blogs?: BlogItem[];
  generatedAt?: string;
};

type SourceCandidate = {
  date?: string;
  score: number;
  source: string;
  sourceName: string;
  text: string;
  title: string;
  type: "x" | "podcast" | "blog";
  url: string;
};

export type DailyNewsletterHotspot = {
  body: string[];
  headline: string;
  sources: string[];
};

export type DailyNewsletterContent = {
  date: string;
  hotspots: DailyNewsletterHotspot[];
  intro: string[];
  preheader: string;
  takeaway: string[];
  title: string;
};

export type DailyNewsletterEmail = {
  html: string;
  imageUrl: string;
  subject: string;
};

export type DailyNewsletterRunOptions = {
  date?: Date;
  dryRun?: boolean;
  recipients?: string[];
  source?: "cron" | "manual";
};

export type DailyNewsletterRunResult = {
  archive: NewsletterArchiveResult;
  dryRun: boolean;
  email: {
    htmlBytes: number;
    imageUrl: string;
    subject: string;
  };
  feed: {
    blogsGeneratedAt?: string;
    candidates: number;
    podcastsGeneratedAt?: string;
    xGeneratedAt?: string;
  };
  recipients: string[];
  sent: Array<{
    email: string;
    result: SendEmailResult;
  }>;
  source: "cron" | "manual";
  title: string;
};

const DEFAULT_FEED_BASE_URL = "https://raw.githubusercontent.com/zarazhangrui/follow-builders/main";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimText(value: string, maxLength: number) {
  const normalized = normalizeWhitespace(value);

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function hasCjk(value: string) {
  return /[\u3400-\u9FFF]/.test(value);
}

function getFeedUrl(name: "x" | "podcasts" | "blogs") {
  const envName = {
    blogs: "FOLLOW_BUILDERS_BLOGS_FEED_URL",
    podcasts: "FOLLOW_BUILDERS_PODCASTS_FEED_URL",
    x: "FOLLOW_BUILDERS_X_FEED_URL"
  }[name];

  return process.env[envName] || `${DEFAULT_FEED_BASE_URL}/feed-${name}.json`;
}

async function fetchJson<TValue>(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return (await response.json()) as TValue;
}

async function fetchFollowBuildersFeeds() {
  const [xFeed, podcastFeed, blogFeed] = await Promise.all([
    fetchJson<XFeed>(getFeedUrl("x")),
    fetchJson<PodcastFeed>(getFeedUrl("podcasts")),
    fetchJson<BlogFeed>(getFeedUrl("blogs"))
  ]);

  return { blogFeed, podcastFeed, xFeed };
}

function createCandidates(xFeed: XFeed, podcastFeed: PodcastFeed, blogFeed: BlogFeed) {
  const candidates: SourceCandidate[] = [];

  for (const builder of xFeed.x || []) {
    for (const tweet of builder.tweets || []) {
      if (!tweet.text || !tweet.url) {
        continue;
      }

      const text = trimText(tweet.text, 700);

      if (text.length < 30 || /^https?:\/\//.test(text)) {
        continue;
      }

      candidates.push({
        date: tweet.createdAt,
        score: tweet.likes || 0,
        source: builder.handle ? `@${builder.handle}` : builder.name || "X",
        sourceName: builder.name || builder.handle || "X",
        text,
        title: `${builder.name || builder.handle || "Builder"} on X`,
        type: "x",
        url: tweet.url
      });
    }
  }

  for (const podcast of podcastFeed.podcasts || []) {
    if (!podcast.transcript || !podcast.url) {
      continue;
    }

    candidates.push({
      date: podcast.publishedAt,
      score: 800,
      source: podcast.name || "Podcast",
      sourceName: podcast.name || "Podcast",
      text: trimText(podcast.transcript, 5000),
      title: podcast.title || podcast.name || "Podcast episode",
      type: "podcast",
      url: podcast.url
    });
  }

  for (const blog of blogFeed.blogs || []) {
    if (!blog.url) {
      continue;
    }

    const text = trimText(blog.content || blog.text || blog.summary || blog.title || "", 3500);

    if (!text) {
      continue;
    }

    candidates.push({
      date: blog.publishedAt,
      score: 700,
      source: blog.name || "Blog",
      sourceName: blog.name || "Blog",
      text,
      title: blog.title || blog.name || "Blog post",
      type: "blog",
      url: blog.url
    });
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, Number.parseInt(process.env.NEWSLETTER_SOURCE_LIMIT || "18", 10));
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```json\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1] || value;
  const start = jsonText.indexOf("{");
  const end = jsonText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not contain a JSON object");
  }

  return JSON.parse(jsonText.slice(start, end + 1)) as unknown;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function normalizeContent(value: unknown, date: string): DailyNewsletterContent {
  if (!value || typeof value !== "object") {
    throw new Error("AI newsletter content is not an object");
  }

  const source = value as {
    hotspots?: unknown;
    intro?: unknown;
    preheader?: unknown;
    takeaway?: unknown;
    title?: unknown;
  };
  const hotspots = Array.isArray(source.hotspots) ? source.hotspots : [];

  if (hotspots.length !== 3) {
    throw new Error("AI newsletter content must contain exactly 3 hotspots");
  }

  const normalizedHotspots = hotspots.map((hotspot, index) => {
    if (!hotspot || typeof hotspot !== "object") {
      throw new Error(`Hotspot ${index + 1} is invalid`);
    }

    const item = hotspot as {
      body?: unknown;
      headline?: unknown;
      sources?: unknown;
    };
    const body = asStringArray(item.body);
    const sources = asStringArray(item.sources).filter((sourceUrl) => /^https?:\/\//.test(sourceUrl));

    if (typeof item.headline !== "string" || !item.headline.trim() || body.length === 0 || sources.length === 0) {
      throw new Error(`Hotspot ${index + 1} is incomplete`);
    }

    return {
      body,
      headline: item.headline.trim(),
      sources
    };
  });

  const content: DailyNewsletterContent = {
    date,
    hotspots: normalizedHotspots,
    intro: asStringArray(source.intro),
    preheader: typeof source.preheader === "string" ? source.preheader.trim() : "",
    takeaway: asStringArray(source.takeaway),
    title: typeof source.title === "string" ? source.title.trim() : ""
  };

  if (!content.title || content.intro.length === 0 || content.takeaway.length === 0) {
    throw new Error("AI newsletter content is missing title, intro, or takeaway");
  }

  const joined = JSON.stringify(content);
  assertNoQuestionMarkMojibake(joined, "newsletter content");

  if (!hasCjk(joined)) {
    throw new Error("AI newsletter content must contain Chinese text");
  }

  return content;
}

async function generateDailyNewsletterContent(candidates: SourceCandidate[], date: string) {
  const systemPrompt = `你是 openlatter 的中文 newsletter 作者。你要把 AI builder 信息写成普通读者能读懂的每日邮件。

规则：
- 只使用用户给出的候选素材和 URL，不编造事实。
- 只输出 3 条 AI 热点，每条 2 段左右。
- 每条热点下方必须保留来源 URL。
- 语气要口语化，像认真作者写给订阅者，不要像新闻稿。
- 少用术语；如果必须用术语，要顺手解释成人话。
- 避免 AI 腔：不要堆“此外、值得注意、标志着、关键、格局、赋能、生态、革命、深刻、不可忽视”。
- 避免“不仅……而且……”结构，不要 emoji，不要用大段排比。
- 输出 JSON，不要 markdown code fence。`;

  const userPrompt = JSON.stringify(
    {
      audience: "对 AI 感兴趣，但不是研究员或专业工程师的订阅用户",
      date,
      desiredShape: {
        hotspots: "exactly 3 items, each with headline, body:string[], sources:string[]",
        intro: "string[]",
        preheader: "string",
        takeaway: "string[]",
        title: "string"
      },
      sources: candidates
    },
    null,
    2
  );

  const response = await generateText({
    maxTokens: 2600,
    messages: [
      { content: systemPrompt, role: "system" },
      { content: userPrompt, role: "user" }
    ],
    temperature: 0.45,
    timeoutMs: 120000
  });

  return normalizeContent(extractJsonObject(response), date);
}

function createImagePrompt(content: DailyNewsletterContent) {
  const topic = `${content.hotspots.map((hotspot) => hotspot.headline).join(" / ")} -> ${content.title}`;

  return `Generate one standalone 16:9 horizontal Chinese article illustration.

Visual DNA: pure white background, minimalist black hand-drawn line art, slightly wobbly pen lines, lots of empty white space, sparse red/orange/blue handwritten Chinese annotations, clean absurd product-sketch feeling.

Recurring IP character required: 小黑, a small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression. 小黑 must perform the core conceptual action, not decorate the scene.

Theme: ${topic}

Composition: three loose AI news slips enter a strange low-tech mailroom machine. 小黑 is inside the machine, seriously pressing a pedal and pushing a lever. The output is one clear openlatter daily email. Keep the labels short and readable: 代码页 / 反馈闭环 / 脑内信号 / 今日 AI 信 / 能读懂.

Constraints: 16:9, pure white, no top-left title, no PPT look, no dense diagram, no cute mascot poster, at most 5 short Chinese labels.`;
}

async function resolveImageUrl(content: DailyNewsletterContent) {
  if (process.env.NEWSLETTER_GENERATE_IMAGE === "true") {
    const image = await generateImage({
      prompt: createImagePrompt(content),
      responseFormat: "url",
      size: "1024x576",
      timeoutMs: 180000
    });

    if (image.url) {
      return image.url;
    }
  }

  return (
    process.env.NEWSLETTER_DEFAULT_IMAGE_URL ||
    "https://jassen.asia/newsletter/openlatter-daily-default.png"
  );
}

function paragraph(text: string) {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.78;color:#34302a;">${encodeHtmlEntities(text)}</p>`;
}

function link(url: string) {
  const safeUrl = escapeHtml(url);

  return `<a href="${safeUrl}" style="color:#7b4b18;text-decoration:underline;word-break:break-all;">${safeUrl}</a>`;
}

export function renderDailyNewsletterEmail(content: DailyNewsletterContent, imageUrl: string): DailyNewsletterEmail {
  const subject = `openlatter Daily ${content.date}`;
  const hotspotHtml = content.hotspots
    .map(
      (item, index) => `
  <tr>
    <td style="padding:0 34px 28px;">
      <div style="border-top:1px solid #e8ddca;padding-top:26px;">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9b7a4b;margin-bottom:10px;">0${index + 1}</div>
        <h2 style="margin:0 0 16px;font-size:22px;line-height:1.38;font-weight:700;color:#1d1a16;">${encodeHtmlEntities(item.headline)}</h2>
        ${item.body.map(paragraph).join("\n")}
        <div style="margin-top:18px;background:#f6efe2;border:1px solid #e5d7c2;border-radius:10px;padding:14px 16px;">
          <div style="font-size:14px;color:#6f5b3d;margin-bottom:8px;">${encodeHtmlEntities("来源：")}</div>
          ${item.sources
            .map((source) => `<div style="font-size:13px;line-height:1.55;margin:0 0 6px;">${link(source)}</div>`)
            .join("\n")}
        </div>
      </div>
    </td>
  </tr>`
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f4efe5;color:#1d1a16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,'Microsoft YaHei',sans-serif;line-height:1.7;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${encodeHtmlEntities(content.preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe5;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf8;border:1px solid #ded3c2;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:32px 34px 18px;">
                <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#9b7a4b;margin-bottom:14px;">openlatter Daily</div>
                <h1 style="margin:0 0 14px;font-size:30px;line-height:1.28;font-weight:750;color:#1d1a16;">${encodeHtmlEntities(content.title)}</h1>
                ${content.intro.map(paragraph).join("\n")}
              </td>
            </tr>
            <tr>
              <td style="padding:0 24px 28px;">
                <img src="${escapeHtml(imageUrl)}" width="632" alt="openlatter daily illustration" style="display:block;width:100%;max-width:632px;height:auto;border:1px solid #ece2d2;border-radius:12px;background:#ffffff;" />
              </td>
            </tr>
            ${hotspotHtml}
            <tr>
              <td style="padding:0 34px 34px;">
                <div style="border-top:1px solid #e8ddca;padding-top:26px;">
                  <h2 style="margin:0 0 14px;font-size:21px;line-height:1.38;font-weight:700;color:#1d1a16;">${encodeHtmlEntities("我的判断")}</h2>
                  ${content.takeaway.map(paragraph).join("\n")}
                  <div style="margin-top:22px;background:#1d1a16;border-radius:12px;padding:18px 20px;color:#fffdf8;">
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#fffdf8;">${encodeHtmlEntities("如果想一起学习探讨 AI，欢迎加我的微信：18834032600")}</p>
                  </div>
                  <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8a7b69;">${encodeHtmlEntities("这是一封 openlatter 每日 AI 资讯邮件。")}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  assertAsciiOnly(html, "newsletter html");
  assertNoQuestionMarkMojibake(html, "newsletter html");

  const decoded = decodeNumericHtmlEntities(html);
  if (!decoded.includes(content.title) || !decoded.includes("来源")) {
    throw new Error("Newsletter HTML entity decode check failed");
  }

  return { html, imageUrl, subject };
}

export function renderDailyNewsletterMarkdown(content: DailyNewsletterContent) {
  return [
    `# ${content.title}`,
    "",
    ...content.intro,
    "",
    ...content.hotspots.flatMap((hotspot, index) => [
      `## ${index + 1}. ${hotspot.headline}`,
      "",
      ...hotspot.body,
      "",
      "来源：",
      ...hotspot.sources.map((source) => `- ${source}`),
      ""
    ]),
    "## 我的判断",
    "",
    ...content.takeaway,
    ""
  ].join("\n");
}

function parseRecipients(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\n;]/)
    .map((email) => email.trim().toLowerCase())
    .filter((email, index, array) => EMAIL_PATTERN.test(email) && array.indexOf(email) === index);
}

async function fetchSubscribedRecipients() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for production newsletter sends");
  }

  const response = await fetch(
    `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/newsletter_subscribers?select=email&status=eq.subscribed`,
    {
      cache: "no-store",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch newsletter subscribers: ${response.status}`);
  }

  const rows = (await response.json()) as Array<{ email?: string }>;

  return rows
    .map((row) => row.email?.trim().toLowerCase() || "")
    .filter((email, index, array) => EMAIL_PATTERN.test(email) && array.indexOf(email) === index);
}

async function resolveRecipients(overrideRecipients?: string[]) {
  const override = overrideRecipients
    ?.map((email) => email.trim().toLowerCase())
    .filter((email, index, array) => EMAIL_PATTERN.test(email) && array.indexOf(email) === index);

  if (override?.length) {
    return override;
  }

  if (process.env.NEWSLETTER_SEND_MODE === "production") {
    return fetchSubscribedRecipients();
  }

  const testRecipients = parseRecipients(process.env.NEWSLETTER_TEST_RECIPIENTS);

  if (testRecipients.length) {
    return testRecipients;
  }

  throw new Error("No newsletter recipients configured");
}

export async function runDailyNewsletterWorkflow(
  options: DailyNewsletterRunOptions = {}
): Promise<DailyNewsletterRunResult> {
  const date = formatDate(options.date || new Date());
  const { blogFeed, podcastFeed, xFeed } = await fetchFollowBuildersFeeds();
  const candidates = createCandidates(xFeed, podcastFeed, blogFeed);

  if (!candidates.length) {
    throw new Error("No follow-builders source candidates found");
  }

  const recipients = await resolveRecipients(options.recipients);
  const content = await generateDailyNewsletterContent(candidates, date);
  const imageUrl = await resolveImageUrl(content);
  const email = renderDailyNewsletterEmail(content, imageUrl);
  const markdown = renderDailyNewsletterMarkdown(content);
  const archive = await archiveNewsletter({
    date,
    files: [
      {
        content: JSON.stringify(content, null, 2),
        contentType: "application/json",
        extension: "json",
        name: "content"
      },
      {
        content: markdown,
        contentType: "text/markdown",
        extension: "md",
        name: "content"
      },
      {
        content: email.html,
        contentType: "text/html",
        extension: "html",
        name: "email"
      }
    ],
    metadata: {
      dryRun: Boolean(options.dryRun),
      email: {
        imageUrl: email.imageUrl,
        subject: email.subject
      },
      feed: {
        blogsGeneratedAt: blogFeed.generatedAt,
        podcastsGeneratedAt: podcastFeed.generatedAt,
        xGeneratedAt: xFeed.generatedAt
      },
      recipients,
      source: options.source || "manual"
    }
  });
  const dryRun = Boolean(options.dryRun);
  const sent: DailyNewsletterRunResult["sent"] = [];

  if (!dryRun) {
    for (const recipient of recipients) {
      const result = await sendEmail({
        htmlBody: email.html,
        subject: email.subject,
        toAddress: recipient
      });
      sent.push({ email: recipient, result });
    }
  }

  return {
    archive,
    dryRun,
    email: {
      htmlBytes: Buffer.byteLength(email.html),
      imageUrl: email.imageUrl,
      subject: email.subject
    },
    feed: {
      blogsGeneratedAt: blogFeed.generatedAt,
      candidates: candidates.length,
      podcastsGeneratedAt: podcastFeed.generatedAt,
      xGeneratedAt: xFeed.generatedAt
    },
    recipients,
    sent,
    source: options.source || "manual",
    title: content.title
  };
}
