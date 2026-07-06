import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://inmshbmejdjlgqpkklwt.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_vp0Hk0XYwDHOoAVCnV57gQ_BT59_Tkf";
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

  const response = await fetch(`${SUPABASE_URL}/rest/v1/newsletter_subscribers`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      email,
      status: "subscribed",
      source: "homepage",
      user_agent: request.headers.get("user-agent")
    })
  });

  if (response.ok) {
    return jsonResponse({ ok: true, email }, 201);
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
