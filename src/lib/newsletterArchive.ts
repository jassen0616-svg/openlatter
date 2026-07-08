import "server-only";

import { createClient } from "@supabase/supabase-js";

export type NewsletterArchiveFile = {
  content: string;
  contentType: string;
  extension: "html" | "json" | "md";
  name: string;
};

export type NewsletterArchiveInput = {
  date: string;
  files: NewsletterArchiveFile[];
  metadata: Record<string, unknown>;
};

export type NewsletterArchiveResult = {
  bucket: string;
  generatedAt: string;
  objects: Array<{
    contentType: string;
    path: string;
  }>;
  prefix: string;
};

const DEFAULT_ARCHIVE_BUCKET = "newsletter-archives";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getArchiveBucket() {
  return process.env.NEWSLETTER_ARCHIVE_BUCKET || DEFAULT_ARCHIVE_BUCKET;
}

function createSupabaseAdminClient() {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function isNotFoundError(error: { message?: string; statusCode?: string | number }) {
  return String(error.statusCode) === "404" || /not found/i.test(error.message || "");
}

async function ensureArchiveBucket(bucket: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.getBucket(bucket);

  if (!error) {
    return supabase;
  }

  if (!isNotFoundError(error)) {
    throw new Error(`Failed to read Supabase archive bucket: ${error.message}`);
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    allowedMimeTypes: ["application/json", "text/markdown", "text/html"],
    public: false
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Failed to create Supabase archive bucket: ${createError.message}`);
  }

  return supabase;
}

function createArchivePrefix(date: string, generatedAt: string) {
  const [year, month, day] = date.split("-");
  const stamp = generatedAt.replace(/[:.]/g, "-");

  return `daily/${year}/${month}/${day}/${date}-${stamp}`;
}

async function uploadArchiveObject(
  bucket: string,
  path: string,
  content: string,
  contentType: string
) {
  const supabase = await ensureArchiveBucket(bucket);
  const body = new Blob([content], { type: `${contentType}; charset=utf-8` });
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: `${contentType}; charset=utf-8`,
    upsert: true
  });

  if (error) {
    throw new Error(`Failed to upload Supabase archive object ${path}: ${error.message}`);
  }
}

export async function archiveNewsletter(input: NewsletterArchiveInput): Promise<NewsletterArchiveResult> {
  const bucket = getArchiveBucket();
  const generatedAt = new Date().toISOString();
  const prefix = createArchivePrefix(input.date, generatedAt);
  const metadataFile: NewsletterArchiveFile = {
    content: JSON.stringify(
      {
        ...input.metadata,
        archivedAt: generatedAt,
        date: input.date
      },
      null,
      2
    ),
    contentType: "application/json",
    extension: "json",
    name: "metadata"
  };
  const files = [...input.files, metadataFile];
  const objects = files.map((file) => ({
    contentType: file.contentType,
    path: `${prefix}/${file.name}.${file.extension}`
  }));

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const object = objects[index];

    await uploadArchiveObject(bucket, object.path, file.content, file.contentType);
  }

  return { bucket, generatedAt, objects, prefix };
}
