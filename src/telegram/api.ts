import { TELEGRAM_URL } from "../vars";
import type { InlineKeyboardMarkup } from "grammy/types";

export interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: "HTML" | "Markdown";
  reply_markup?: InlineKeyboardMarkup;
}

// GAS-compatible fetch adapter — wraps UrlFetchApp in the standard fetch interface
// that grammY expects. Passed to createBot() when running inside GAS.
export function gasAdapterFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gasResponse = (globalThis as any).UrlFetchApp.fetch(url, {
    method: (init?.method ?? "GET").toLowerCase(),
    contentType: "application/json",
    payload: init?.body ?? undefined,
    muteHttpExceptions: true,
  });
  const text: string = gasResponse.getContentText();
  const status: number = gasResponse.getResponseCode();
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(JSON.parse(text)),
    text: () => Promise.resolve(text),
  } as Response);
}

export async function sendMessage(params: SendMessageParams): Promise<void> {
  const url = `${TELEGRAM_URL}/sendMessage`;
  if ("UrlFetchApp" in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(params),
    });
  } else {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }
}
