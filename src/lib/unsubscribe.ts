import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_CONTEXT = "openlatter-unsubscribe:v1:";

function requireUnsubscribeSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET;

  if (!secret) {
    throw new Error("Missing required environment variable: UNSUBSCRIBE_SECRET");
  }

  return secret;
}

function getSiteOrigin() {
  const configuredUrl = process.env.SITE_URL?.trim();
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const rawUrl = configuredUrl || (vercelUrl ? `https://${vercelUrl}` : "http://127.0.0.1:3000");
  const url = new URL(rawUrl);

  return url.origin;
}

export function normalizeSubscriberEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createUnsubscribeToken(email: string) {
  const normalizedEmail = normalizeSubscriberEmail(email);

  return createHmac("sha256", requireUnsubscribeSecret())
    .update(`${TOKEN_CONTEXT}${normalizedEmail}`, "utf8")
    .digest("base64url");
}

export function verifyUnsubscribeToken(email: string, token: string) {
  const expectedToken = createUnsubscribeToken(email);
  const expectedBuffer = Buffer.from(expectedToken, "utf8");
  const tokenBuffer = Buffer.from(token, "utf8");

  return expectedBuffer.length === tokenBuffer.length && timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function createUnsubscribeUrl(email: string) {
  const normalizedEmail = normalizeSubscriberEmail(email);
  const url = new URL("/unsubscribe", getSiteOrigin());

  url.searchParams.set("email", normalizedEmail);
  url.searchParams.set("token", createUnsubscribeToken(normalizedEmail));

  return url.toString();
}
