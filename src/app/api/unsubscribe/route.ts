import { NextRequest, NextResponse } from "next/server";

import { unsubscribeNewsletterEmail } from "@/lib/newsletterSubscribers";
import { normalizeSubscriberEmail, verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirectToResult(request: NextRequest, status: "error" | "invalid" | "success") {
  const url = new URL("/unsubscribe", request.url);
  url.searchParams.set("status", status);

  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function redirectToConfirmation(request: NextRequest, email: string, token: string) {
  const url = new URL("/unsubscribe", request.url);
  url.searchParams.set("email", email);
  url.searchParams.set("token", token);

  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function isValidUnsubscribeRequest(email: string, token: string) {
  return EMAIL_PATTERN.test(email) && Boolean(token) && verifyUnsubscribeToken(email, token);
}

export async function GET(request: NextRequest) {
  const email = normalizeSubscriberEmail(request.nextUrl.searchParams.get("email") || "");
  const token = request.nextUrl.searchParams.get("token") || "";

  try {
    if (!isValidUnsubscribeRequest(email, token)) {
      return redirectToResult(request, "invalid");
    }

    // Keep links from previously sent emails working without allowing GET requests to change state.
    return redirectToConfirmation(request, email, token);
  } catch (error) {
    console.error("Failed to validate newsletter unsubscribe link", error);
    return redirectToResult(request, "error");
  }
}

export async function POST(request: NextRequest) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return redirectToResult(request, "invalid");
  }

  const rawEmail = formData.get("email");
  const rawToken = formData.get("token");
  const email = normalizeSubscriberEmail(typeof rawEmail === "string" ? rawEmail : "");
  const token = typeof rawToken === "string" ? rawToken : "";

  try {
    if (!isValidUnsubscribeRequest(email, token)) {
      return redirectToResult(request, "invalid");
    }

    await unsubscribeNewsletterEmail(email);
    return redirectToResult(request, "success");
  } catch (error) {
    console.error("Failed to unsubscribe newsletter recipient", error);
    return redirectToResult(request, "error");
  }
}
