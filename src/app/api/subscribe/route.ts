import { NextRequest, NextResponse } from "next/server";

import { sendWelcomeEmail } from "@/lib/directMail";

export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubscribeRequestBody = {
  email?: unknown;
};

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function insertSubscriber(email: string, userAgent: string | null) {
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const supabasePublishableKey = requireEnv("SUPABASE_PUBLISHABLE_KEY");

  return fetch(`${supabaseUrl}/rest/v1/newsletter_subscribers`, {
    method: "POST",
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      email,
      status: "subscribed",
      source: "homepage",
      user_agent: userAgent
    })
  });
}

export async function POST(request: NextRequest) {
  let body: SubscribeRequestBody;

  try {
    body = (await request.json()) as SubscribeRequestBody;
  } catch {
    return jsonResponse({ ok: false, message: "请求格式不正确。" }, 400);
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!EMAIL_PATTERN.test(email)) {
    return jsonResponse({ ok: false, message: "请输入一个有效的邮箱地址。" }, 400);
  }

  let response: Response;

  try {
    response = await insertSubscriber(email, request.headers.get("user-agent"));
  } catch (error) {
    console.error("Failed to connect to Supabase", error);
    return jsonResponse({ ok: false, message: "暂时无法完成绑定，请稍后再试。" }, 502);
  }

  if (response.ok) {
    try {
      const welcomeEmail = await sendWelcomeEmail(email);
      return jsonResponse({ ok: true, email, welcomeEmailSent: true, welcomeEmail }, 201);
    } catch (error) {
      console.error("Failed to send welcome email", error);
      return jsonResponse({ ok: true, email, welcomeEmailSent: false }, 201);
    }
  }

  let errorCode = "";
  try {
    const error = (await response.json()) as { code?: string };
    errorCode = error.code || "";
  } catch {
    errorCode = "";
  }

  if (response.status === 409 || errorCode === "23505") {
    return jsonResponse({ ok: true, email, alreadySubscribed: true }, 200);
  }

  return jsonResponse({ ok: false, message: "暂时无法完成绑定，请稍后再试。" }, 502);
}
