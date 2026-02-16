import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectMimeType, loadImageAsBase64, uploadImage } from "../src/media.js";
import { createMockClient, type MockClient } from "./helpers.js";

describe("detectMimeType", () => {
  it("detects jpeg", () => {
    expect(detectMimeType("photo.jpg")).toBe("image/jpeg");
    expect(detectMimeType("photo.jpeg")).toBe("image/jpeg");
  });

  it("detects png", () => {
    expect(detectMimeType("image.png")).toBe("image/png");
  });

  it("detects webp", () => {
    expect(detectMimeType("photo.webp")).toBe("image/webp");
  });

  it("detects bmp", () => {
    expect(detectMimeType("image.bmp")).toBe("image/bmp");
  });

  it("strips query params from URLs", () => {
    expect(detectMimeType("https://example.com/photo.png?w=800")).toBe("image/png");
  });

  it("strips hash from URLs", () => {
    expect(detectMimeType("https://example.com/photo.png#section")).toBe("image/png");
  });

  it("defaults to image/jpeg for unknown extensions", () => {
    expect(detectMimeType("https://example.com/image")).toBe("image/jpeg");
    expect(detectMimeType("data")).toBe("image/jpeg");
  });

  it("is case-insensitive on extensions", () => {
    expect(detectMimeType("photo.PNG")).toBe("image/png");
    expect(detectMimeType("photo.JPG")).toBe("image/jpeg");
  });
});

describe("loadImageAsBase64", () => {
  it("fetches image from URL", async () => {
    const mockArrayBuffer = new TextEncoder().encode("fake image data").buffer;
    const mockResponse = {
      ok: true,
      arrayBuffer: async () => mockArrayBuffer,
      headers: new Headers({ "content-type": "image/png" }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

    const result = await loadImageAsBase64("https://example.com/photo.png");

    expect(result.base64).toBeTruthy();
    expect(result.mimeType).toBe("image/png");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("https://example.com/photo.png");

    vi.unstubAllGlobals();
  });

  it("throws on failed fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" }),
    );

    await expect(
      loadImageAsBase64("https://example.com/missing.png"),
    ).rejects.toThrow("Failed to fetch image");

    vi.unstubAllGlobals();
  });

  it("throws on missing local file", async () => {
    await expect(
      loadImageAsBase64("/tmp/nonexistent-clawbird-test-image.png"),
    ).rejects.toThrow("Image file not found");
  });

  it("uses content-type from response when available", async () => {
    const mockArrayBuffer = new TextEncoder().encode("data").buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
        headers: new Headers({ "content-type": "image/webp; charset=utf-8" }),
      }),
    );

    const result = await loadImageAsBase64("https://example.com/image");
    expect(result.mimeType).toBe("image/webp");

    vi.unstubAllGlobals();
  });
});

describe("uploadImage", () => {
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
  });

  it("uploads base64 image and returns media ID", async () => {
    // Mock loadImageAsBase64 indirectly by mocking fetch
    const mockArrayBuffer = new TextEncoder().encode("image bytes").buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
        headers: new Headers({ "content-type": "image/jpeg" }),
      }),
    );

    (mockClient as any).media = {
      upload: vi.fn().mockResolvedValue({
        data: { id: "media_123" },
      }),
    };

    const mediaId = await uploadImage(mockClient as any, "https://example.com/photo.jpg");

    expect(mediaId).toBe("media_123");
    expect((mockClient as any).media.upload).toHaveBeenCalledWith({
      body: {
        media: expect.any(String),
        mediaCategory: "tweet_image",
        mediaType: "image/jpeg",
      },
    });

    vi.unstubAllGlobals();
  });

  it("throws when upload returns no media ID", async () => {
    const mockArrayBuffer = new TextEncoder().encode("data").buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockArrayBuffer,
        headers: new Headers({ "content-type": "image/png" }),
      }),
    );

    (mockClient as any).media = {
      upload: vi.fn().mockResolvedValue({ data: {} }),
    };

    await expect(
      uploadImage(mockClient as any, "https://example.com/photo.png"),
    ).rejects.toThrow("Media upload failed");

    vi.unstubAllGlobals();
  });
});
