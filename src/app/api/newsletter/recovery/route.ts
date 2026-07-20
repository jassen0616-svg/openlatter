import { NextRequest, NextResponse } from "next/server";

import {
  resolveDailyNewsletterRecipients,
  runDailyNewsletterWorkflow
} from "@/lib/dailyNewsletter";
import { findNewsletterDeliveryRecoveryState } from "@/lib/newsletterArchive";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return jsonResponse({ ok: false, message: "Unauthorized" }, 401);
  }

  const date = new Date().toISOString().slice(0, 10);

  try {
    const recoveryState = await findNewsletterDeliveryRecoveryState(date);
    const acceptedEmails = new Set(recoveryState.acceptedEmails);
    const activeRecipients = await resolveDailyNewsletterRecipients();
    const recipients = activeRecipients.filter(
      (email) => !acceptedEmails.has(email)
    );

    if (!recipients.length) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "all-current-recipients-already-accepted",
        acceptedRecipients: acceptedEmails.size,
        activeRecipients: activeRecipients.length,
        delivery: recoveryState.completedDelivery
      });
    }

    const result = await runDailyNewsletterWorkflow({ recipients, source: "recovery" });

    return jsonResponse({
      ok: true,
      skipped: false,
      excludedAcceptedRecipients: acceptedEmails.size,
      activeRecipients: activeRecipients.length,
      result
    });
  } catch (error) {
    console.error("Daily newsletter recovery failed", error);

    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Daily newsletter recovery failed"
      },
      500
    );
  }
}
