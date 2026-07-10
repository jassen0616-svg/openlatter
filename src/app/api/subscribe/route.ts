import { NextRequest, NextResponse } from "next/server";

import { sendWelcomeEmail } from "@/lib/directMail";
import { subscribeNewsletterEmail } from "@/lib/newsletterSubscribers";

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

  let subscription: Awaited<ReturnType<typeof subscribeNewsletterEmail>>;

  try {
    subscription = await subscribeNewsletterEmail(email, request.headers.get("user-agent"));
  } catch (error) {
    console.error("Failed to connect to Supabase", error);
    return jsonResponse({ ok: false, message: "暂时无法完成绑定，请稍后再试。" }, 502);
  }

  if (subscription.state === "already_subscribed") {
    return jsonResponse({ ok: true, email, alreadySubscribed: true }, 200);
  }

  try {
    const welcomeEmail = await sendWelcomeEmail(email);
    return jsonResponse(
      {
        ok: true,
        email,
        restored: subscription.state === "restored",
        welcomeEmailSent: true,
        welcomeEmail
      },
      subscription.state === "created" ? 201 : 200
    );
  } catch (error) {
    console.error("Failed to send welcome email", error);
    return jsonResponse(
      {
        ok: true,
        email,
        restored: subscription.state === "restored",
        welcomeEmailSent: false
      },
      subscription.state === "created" ? 201 : 200
    );
  }
}
