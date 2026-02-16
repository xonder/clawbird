import { readFileSync, existsSync } from "node:fs";
import { extname } from "node:path";
import type { Client } from "@xdevplatform/xdk";

/**
 * Allowed MIME types for X API one-shot media upload (tweet_image).
 */
type ImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "image/bmp"
  | "image/pjpeg"
  | "image/tiff";

const KNOWN_MIMES = new Set<string>([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/pjpeg",
  "image/tiff",
]);

function isKnownMime(mime: string): mime is ImageMimeType {
  return KNOWN_MIMES.has(mime);
}

/**
 * Map file extensions to supported MIME types.
 */
const MIME_TYPES: Record<string, ImageMimeType> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
};

/**
 * Detect MIME type from a URL or file path.
 * Falls back to image/jpeg if unknown.
 */
export function detectMimeType(urlOrPath: string): ImageMimeType {
  // Strip query params for URL
  const clean = urlOrPath.split("?")[0].split("#")[0];
  const ext = extname(clean).toLowerCase();
  return MIME_TYPES[ext] ?? "image/jpeg";
}

/**
 * Load image data as a base64 string from a URL or local file path.
 */
export async function loadImageAsBase64(
  urlOrPath: string,
): Promise<{ base64: string; mimeType: ImageMimeType }> {
  const mimeType = detectMimeType(urlOrPath);

  // Check if it's a URL
  if (urlOrPath.startsWith("http://") || urlOrPath.startsWith("https://")) {
    const response = await fetch(urlOrPath);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from ${urlOrPath}: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    // Use content-type from response if it's a known type
    const contentType = response.headers.get("content-type")?.split(";")[0];
    const resolvedMime =
      contentType && isKnownMime(contentType)
        ? contentType
        : mimeType;
    return { base64, mimeType: resolvedMime };
  }

  // Local file path
  if (!existsSync(urlOrPath)) {
    throw new Error(`Image file not found: ${urlOrPath}`);
  }
  const buffer = readFileSync(urlOrPath);
  const base64 = buffer.toString("base64");
  return { base64, mimeType };
}

/**
 * Upload an image to X and return the media ID.
 *
 * @param client - Authenticated X API client (OAuth1 required for upload)
 * @param urlOrPath - URL or local file path to the image
 * @returns The media ID string to use in tweet creation
 */
export async function uploadImage(
  client: Client,
  urlOrPath: string,
): Promise<string> {
  const { base64, mimeType } = await loadImageAsBase64(urlOrPath);

  const response = await client.media.upload({
    body: {
      media: base64,
      mediaCategory: "tweet_image",
      mediaType: mimeType,
    },
  });

  const mediaId =
    (response?.data as Record<string, unknown>)?.id ??
    (response?.data as Record<string, unknown>)?.media_id_string ??
    (response?.data as Record<string, unknown>)?.mediaId;

  if (!mediaId) {
    throw new Error("Media upload failed — no media ID returned");
  }

  return String(mediaId);
}
