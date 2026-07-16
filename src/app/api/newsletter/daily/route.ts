import { NextRequest, NextResponse } from "next/server";

import {
  runDailyNewsletterWorkflow,
  type DailyNewsletterContentSource
} from "@/lib/dailyNewsletter";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

type DailyNewsletterRequestBody = {
  contentSource?: unknown;
  dryRun?: unknown;
  recipients?: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET || process.env.NEWSLETTER_ADMIN_SECRET;
  const authHeader = request.headers.get("authorization");

  return Boolean(secret && authHeader === `Bearer ${secret}`);
}

function parseRecipients(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function parseContentSource(value: unknown): DailyNewsletterContentSource | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === "ai-gateway" || value === "ai-hot") {
    return value;
  }

  return undefined;
}

async function run(
  request: NextRequest,
  options: { contentSource?: DailyNewsletterContentSource; dryRun?: boolean; recipients?: string[] }
) {
  if (!isAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  try {
    const result = await runDailyNewsletterWorkflow({
      contentSource: options.contentSource,
      dryRun: options.dryRun,
      recipients: options.recipients,
      source: request.method === "GET" ? "cron" : "manual"
    });

    return jsonResponse({ ok: true, result });
  } catch (error) {
    console.error("Daily newsletter workflow failed", error);

    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Daily newsletter workflow failed"
      },
      500
    );
  }
}

export async function GET(request: NextRequest) {
  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";

  return run(request, { dryRun });
}

export async function POST(request: NextRequest) {
  let body: DailyNewsletterRequestBody = {};

  try {
    body = (await request.json()) as DailyNewsletterRequestBody;
  } catch {
    body = {};
  }

  const contentSource = parseContentSource(body.contentSource);

  if (body.contentSource !== undefined && contentSource === undefined) {
    return jsonResponse({ ok: false, message: "Invalid contentSource" }, 400);
  }

  return run(request, {
    contentSource,
    dryRun: body.dryRun === true,
    recipients: parseRecipients(body.recipients)
  });
}
