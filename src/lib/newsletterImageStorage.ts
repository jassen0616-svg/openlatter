import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { GeneratedImage } from "@/lib/aiGateway";

export type StoredNewsletterImage = {
  bucket: string;
  bytes: number;
  contentType: string;
  generatedAt: string;
  path: string;
  publicUrl: string;
  source: "b64_json" | "url";
};

type ImagePayload = {
  bytes: Buffer;
  contentType: string;
  source: "b64_json" | "url";
};

type SupabaseAdminClient = ReturnType<typeof createSupabaseAdminClient>;

const DEFAULT_IMAGE_BUCKET = "newsletter-images";
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

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

function getImageBucket() {
  return process.env.NEWSLETTER_IMAGE_BUCKET || DEFAULT_IMAGE_BUCKET;
}

function isNotFoundError(error: { message?: string; statusCode?: string | number }) {
  return String(error.statusCode) === "404" || /not found/i.test(error.message || "");
}

async function ensurePublicImageBucket(bucket: string): Promise<SupabaseAdminClient> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.getBucket(bucket);

  if (!error) {
    if (data.public !== true) {
      const { error: updateError } = await supabase.storage.updateBucket(bucket, {
        allowedMimeTypes: IMAGE_MIME_TYPES,
        fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
        public: true
      });

      if (updateError) {
        throw new Error(`Failed to make Supabase image bucket public: ${updateError.message}`);
      }
    }

    return supabase;
  }

  if (!isNotFoundError(error)) {
    throw new Error(`Failed to read Supabase image bucket: ${error.message}`);
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    allowedMimeTypes: IMAGE_MIME_TYPES,
    fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
    public: true
  });

  if (createError && !/already exists/i.test(createError.message)) {
    throw new Error(`Failed to create Supabase image bucket: ${createError.message}`);
  }

  return supabase;
}

function normalizeContentType(value: string | null) {
  const contentType = value?.split(";")[0]?.trim().toLowerCase();

  if (contentType && IMAGE_MIME_TYPES.includes(contentType)) {
    return contentType;
  }

  return undefined;
}

function detectImageContentType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }

  if (bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return "image/jpeg";
  }

  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }

  return "image/png";
}

function extensionForContentType(contentType: string) {
  if (contentType === "image/jpeg") {
    return "jpg";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "png";
}

function assertImageSize(bytes: Buffer) {
  if (!bytes.length) {
    throw new Error("Generated newsletter image is empty");
  }

  if (bytes.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Generated newsletter image is too large: ${bytes.byteLength} bytes`);
  }
}

function decodeBase64Image(value: string): ImagePayload {
  const dataUrl = value.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i);
  const encoded = dataUrl?.[2] || value;
  const bytes = Buffer.from(encoded, "base64");
  const contentType = normalizeContentType(dataUrl?.[1] || null) || detectImageContentType(bytes);

  assertImageSize(bytes);

  return { bytes, contentType, source: "b64_json" };
}

async function fetchImage(url: string): Promise<ImagePayload> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: IMAGE_MIME_TYPES.join(", ")
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch generated newsletter image: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = normalizeContentType(response.headers.get("content-type")) || detectImageContentType(bytes);

  assertImageSize(bytes);

  return { bytes, contentType, source: "url" };
}

async function readGeneratedImage(image: GeneratedImage) {
  if (image.b64Json) {
    return decodeBase64Image(image.b64Json);
  }

  if (image.url) {
    return fetchImage(image.url);
  }

  throw new Error("Generated newsletter image has no usable payload");
}

function createImagePath(date: string, generatedAt: string, extension: string) {
  const [year, month, day] = date.split("-");
  const stamp = generatedAt.replace(/[:.]/g, "-");

  return `daily/${year}/${month}/${day}/${date}-${stamp}.${extension}`;
}

function toBlobPart(bytes: Buffer) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function storeNewsletterImage(date: string, image: GeneratedImage): Promise<StoredNewsletterImage> {
  const payload = await readGeneratedImage(image);
  const bucket = getImageBucket();
  const generatedAt = new Date().toISOString();
  const path = createImagePath(date, generatedAt, extensionForContentType(payload.contentType));
  const supabase = await ensurePublicImageBucket(bucket);
  const { error } = await supabase.storage.from(bucket).upload(path, new Blob([toBlobPart(payload.bytes)], {
    type: payload.contentType
  }), {
    cacheControl: "31536000",
    contentType: payload.contentType,
    upsert: true
  });

  if (error) {
    throw new Error(`Failed to upload generated newsletter image: ${error.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);

  if (!data.publicUrl) {
    throw new Error("Supabase did not return a public URL for generated newsletter image");
  }

  return {
    bucket,
    bytes: payload.bytes.byteLength,
    contentType: payload.contentType,
    generatedAt,
    path,
    publicUrl: data.publicUrl,
    source: payload.source
  };
}
