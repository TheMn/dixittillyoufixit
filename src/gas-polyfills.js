// GAS V8 runtime does not expose TextEncoder. grammY calls `new TextEncoder()`
// at module init time (for multipart file uploads), crashing the entire script
// before doPost is registered. Injected via esbuild --inject so it runs first.
if (typeof TextEncoder === "undefined") {
  globalThis.TextEncoder = function TextEncoder() {};
  globalThis.TextEncoder.prototype.encode = function (s) {
    return new Uint8Array(Array.from(unescape(encodeURIComponent(s)), function (c) { return c.charCodeAt(0); }));
  };
}
