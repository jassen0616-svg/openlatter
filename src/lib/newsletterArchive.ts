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

export type CompletedNewsletterDelivery = {
  completedAt?: string;
  path: string;
  prefix: string;
  recipients: number;
};

export type NewsletterDeliveryRecoveryState = {
  acceptedEmails: string[];
  completedDelivery: CompletedNewsletterDelivery | null;
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

export async function writeNewsletterArchiveJson(
  archive: Pick<NewsletterArchiveResult, "bucket" | "prefix">,
  name: string,
  value: unknown
) {
  if (!/^[a-z0-9-]+$/i.test(name)) {
    throw new Error("Archive JSON object name contains unsupported characters");
  }

  const path = `${archive.prefix}/${name}.json`;

  await uploadArchiveObject(
    archive.bucket,
    path,
    JSON.stringify(value, null, 2),
    "application/json"
  );

  return path;
}

export async function findNewsletterDeliveryRecoveryState(
  date: string
): Promise<NewsletterDeliveryRecoveryState> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Newsletter delivery lookup date is invalid");
  }

  const [year, month, day] = date.split("-");
  const datePrefix = `daily/${year}/${month}/${day}`;
  const bucket = getArchiveBucket();
  const supabase = await ensureArchiveBucket(bucket);
  const { data: runs, error: listError } = await supabase.storage.from(bucket).list(datePrefix, {
    limit: 100,
    sortBy: { column: "name", order: "desc" }
  });

  if (listError) {
    throw new Error(`Failed to list newsletter delivery archives: ${listError.message}`);
  }

  const acceptedEmails = new Set<string>();
  let completedDelivery: CompletedNewsletterDelivery | null = null;

  for (const run of runs || []) {
    if (!run.name || run.metadata) {
      continue;
    }

    const prefix = `${datePrefix}/${run.name}`;
    const path = `${prefix}/delivery.json`;
    const { data, error } = await supabase.storage.from(bucket).download(path);

    if (error) {
      if (isNotFoundError(error)) {
        continue;
      }

      throw new Error(`Failed to read newsletter delivery archive ${path}: ${error.message}`);
    }

    try {
      const report = JSON.parse(await data.text()) as {
        completedAt?: unknown;
        recipients?: Array<{ email?: unknown; status?: unknown }>;
        status?: unknown;
      };
      const recipients = Array.isArray(report.recipients) ? report.recipients : [];

      for (const recipient of recipients) {
        if (recipient.status !== "accepted" || typeof recipient.email !== "string") {
          continue;
        }

        const email = recipient.email.trim().toLowerCase();

        if (email) {
          acceptedEmails.add(email);
        }
      }

      const allAccepted = recipients.length > 0 && recipients.every(
        (recipient) => recipient.status === "accepted"
      );

      if (!completedDelivery && report.status === "completed" && allAccepted) {
        completedDelivery = {
          completedAt: typeof report.completedAt === "string" ? report.completedAt : undefined,
          path,
          prefix,
          recipients: recipients.length
        };
      }
    } catch (error) {
      console.warn(`Ignoring malformed newsletter delivery archive ${path}`, error);
    }
  }

  return {
    acceptedEmails: Array.from(acceptedEmails),
    completedDelivery
  };
}
