import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatInitials,
  formatNumber,
} from "@/lib/utils/formatter";

test("file sizes retain adaptive units, precision and invalid-value handling", () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 0])
    assert.equal(formatFileSize(value), "0 B");
  assert.equal(formatFileSize(1023), "1023 B");
  assert.equal(formatFileSize(1024), "1.0 KB");
  assert.equal(formatFileSize(10 * 1024), "10 KB");
  assert.equal(formatFileSize(1024 ** 2), "1.0 MB");
  assert.equal(formatFileSize(1024 ** 3), "1.0 GB");
  assert.equal(formatFileSize(1024 ** 4), "1.0 TB");
  assert.equal(formatFileSize(1024 ** 5), "1024 TB");
});

test("dates and numbers preserve the user's locale and timezone", () => {
  for (const value of [0, 1_791_342_123_000]) {
    const date = new Date(value);
    assert.equal(
      formatDate(value),
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(value),
    );
    assert.equal(formatDate(date), formatDate(value));
    assert.equal(formatDateTime(value), date.toLocaleString());
    assert.equal(formatDateTime(date), date.toLocaleString());
    assert.equal(date.getTime(), value);
  }
  assert.equal(formatDateTime(NaN), new Date(NaN).toLocaleString());
  assert.throws(() => formatDate(NaN), RangeError);
  for (const value of [0, 1234567.89, -12345, NaN, Infinity])
    assert.equal(formatNumber(value), new Intl.NumberFormat().format(value));
});

test("avatar initials preserve spacing, uppercase and fallback behavior", () => {
  assert.equal(formatInitials(""), "G");
  assert.equal(formatInitials("  \t "), "G");
  assert.equal(formatInitials("gorth"), "G");
  assert.equal(formatInitials("  Gorth   Browser  User "), "GB");
  assert.equal(formatInitials("nguyễn\nvăn an"), "NV");
});

import {
  formatAddress,
  formatDownloadBytes,
  formatRemainingTime,
  formatTransferRate,
} from "@/lib/utils/formatter";

test("download sizes preserve localized units and handle sub-byte rates", () => {
  for (const value of [NaN, Infinity, -1, 0])
    assert.equal(formatDownloadBytes(value), "0 B");
  for (const [bytes, value, unit, digits] of [
    [0.1, 0.1, "B", 0],
    [1, 1, "B", 0],
    [1023, 1023, "B", 0],
    [1024, 1, "KB", 1],
    [1536, 1.5, "KB", 1],
    [1024 ** 2, 1, "MB", 1],
    [1024 ** 3, 1, "GB", 1],
    [1024 ** 4, 1, "TB", 1],
    [1024 ** 5, 1024, "TB", 1],
  ] as const) {
    assert.equal(
      formatDownloadBytes(bytes),
      value.toLocaleString(undefined, { maximumFractionDigits: digits }) +
        " " +
        unit,
    );
    assert.equal(formatTransferRate(bytes), formatDownloadBytes(bytes) + "/s");
  }
});

test("remaining time retains seconds and round-up-to-minute display", () => {
  assert.equal(formatRemainingTime(0), "0s");
  assert.equal(formatRemainingTime(59), "59s");
  assert.equal(formatRemainingTime(60), "1 min");
  assert.equal(formatRemainingTime(61), "2 min");
  assert.equal(formatRemainingTime(120), "2 min");
});

test("short addresses strip only web scheme/www and the root trailing slash", () => {
  assert.equal(formatAddress("https://www.google.com/"), "google.com");
  assert.equal(formatAddress("HTTP://WWW.google.com/"), "google.com");
  assert.equal(
    formatAddress("https://www.youtube.com/watch?v=abc&list=xyz#play"),
    "youtube.com/watch?v=abc&list=xyz#play",
  );
  assert.equal(formatAddress("https://example.com/path/"), "example.com/path/");
  assert.equal(
    formatAddress("https://example.com/?q=test"),
    "example.com/?q=test",
  );
  assert.equal(formatAddress("https://example.com:8443/"), "example.com:8443");
  assert.equal(formatAddress("gorth://settings/help"), "gorth://settings/help");
  assert.equal(formatAddress("file:///tmp/file"), "file:///tmp/file");
  assert.equal(formatAddress(""), "");
});
