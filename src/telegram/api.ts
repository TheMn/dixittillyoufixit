import { TELEGRAM_URL } from "../vars";

export interface SendMessageParams {
  chat_id: string | number;
  text: string;
  parse_mode?: "HTML" | "Markdown";
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
