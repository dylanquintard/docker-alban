import {
  getGalleryThumbnailUrl,
  isAbsoluteHttpUrl,
  sanitizeAbsoluteHttpUrl,
  sanitizeInternalOrAbsoluteHttpUrl,
  sanitizeMediaUrl,
} from "./url";

test("isAbsoluteHttpUrl only accepts http/https absolute urls", () => {
  expect(isAbsoluteHttpUrl("https://example.com")).toBe(true);
  expect(isAbsoluteHttpUrl("http://example.com/path")).toBe(true);
  expect(isAbsoluteHttpUrl("/relative-path")).toBe(false);
  expect(isAbsoluteHttpUrl("javascript:alert(1)")).toBe(false);
});

test("sanitizeAbsoluteHttpUrl rejects non-http schemes", () => {
  expect(sanitizeAbsoluteHttpUrl("https://example.com")).toBe("https://example.com");
  expect(sanitizeAbsoluteHttpUrl("mailto:test@example.com")).toBe("");
  expect(sanitizeAbsoluteHttpUrl("javascript:alert(1)")).toBe("");
});

test("sanitizeMediaUrl allows safe relative and absolute http urls", () => {
  expect(sanitizeMediaUrl("/images/logo.webp")).toBe("/images/logo.webp");
  expect(sanitizeMediaUrl("https://cdn.example.com/logo.webp")).toBe("https://cdn.example.com/logo.webp");
  expect(sanitizeMediaUrl("//cdn.example.com/logo.webp")).toBe("");
});

test("sanitizeInternalOrAbsoluteHttpUrl allows internal routes and absolute http urls", () => {
  expect(sanitizeInternalOrAbsoluteHttpUrl("/contact")).toBe("/contact");
  expect(sanitizeInternalOrAbsoluteHttpUrl("https://example.com/contact")).toBe(
    "https://example.com/contact"
  );
  expect(sanitizeInternalOrAbsoluteHttpUrl("javascript:alert(1)")).toBe("");
});

test("getGalleryThumbnailUrl returns the thumbnail variant when possible", () => {
  expect(getGalleryThumbnailUrl("/uploads/gallery/gallery-123.webp")).toBe(
    "/uploads/gallery/thumbs/gallery-123.webp"
  );
  expect(getGalleryThumbnailUrl("https://api.example.com/uploads/gallery/gallery-123.webp")).toBe(
    "https://api.example.com/uploads/gallery/thumbs/gallery-123.webp"
  );
  expect(getGalleryThumbnailUrl("https://api.example.com/uploads/gallery/thumbs/gallery-123.webp")).toBe(
    "https://api.example.com/uploads/gallery/thumbs/gallery-123.webp"
  );
  expect(getGalleryThumbnailUrl("https://cdn.example.com/logo.webp")).toBe(
    "https://cdn.example.com/logo.webp"
  );
});
