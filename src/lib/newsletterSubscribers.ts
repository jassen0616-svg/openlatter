import "server-only";

import { createClient } from "@supabase/supabase-js";

const SUBSCRIBERS_TABLE = "newsletter_subscribers";

type SubscriberRow = {
  id: string;
  status: string;
};

export type SubscribeNewsletterResult = {
  state: "already_subscribed" | "created" | "restored";
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function createSupabaseAdminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function findSubscriber(email: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from(SUBSCRIBERS_TABLE)
    .select("id,status")
    .eq("email", email)
    .maybeSingle<SubscriberRow>();

  if (error) {
    throw new Error(`Failed to read newsletter subscriber: ${error.message}`);
  }

  return data;
}

async function restoreSubscriber(email: string, userAgent: string | null) {
  const { error } = await createSupabaseAdminClient()
    .from(SUBSCRIBERS_TABLE)
    .update({
      source: "homepage",
      status: "subscribed",
      updated_at: new Date().toISOString(),
      user_agent: userAgent
    })
    .eq("email", email);

  if (error) {
    throw new Error(`Failed to restore newsletter subscriber: ${error.message}`);
  }
}

export async function subscribeNewsletterEmail(
  email: string,
  userAgent: string | null
): Promise<SubscribeNewsletterResult> {
  const existing = await findSubscriber(email);

  if (existing?.status === "subscribed") {
    return { state: "already_subscribed" };
  }

  if (existing?.status === "unsubscribed") {
    await restoreSubscriber(email, userAgent);
    return { state: "restored" };
  }

  if (existing) {
    throw new Error(`Subscriber status cannot be restored: ${existing.status}`);
  }

  const { error } = await createSupabaseAdminClient().from(SUBSCRIBERS_TABLE).insert({
    email,
    source: "homepage",
    status: "subscribed",
    user_agent: userAgent
  });

  if (!error) {
    return { state: "created" };
  }

  if (error.code !== "23505") {
    throw new Error(`Failed to create newsletter subscriber: ${error.message}`);
  }

  const racedSubscriber = await findSubscriber(email);

  if (racedSubscriber?.status === "subscribed") {
    return { state: "already_subscribed" };
  }

  if (racedSubscriber?.status === "unsubscribed") {
    await restoreSubscriber(email, userAgent);
    return { state: "restored" };
  }

  throw new Error("Failed to resolve concurrent newsletter subscription");
}

export async function unsubscribeNewsletterEmail(email: string) {
  const { error } = await createSupabaseAdminClient()
    .from(SUBSCRIBERS_TABLE)
    .update({
      status: "unsubscribed",
      updated_at: new Date().toISOString()
    })
    .eq("email", email);

  if (error) {
    throw new Error(`Failed to unsubscribe newsletter subscriber: ${error.message}`);
  }
}
