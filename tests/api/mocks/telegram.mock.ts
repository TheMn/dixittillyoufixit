import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export interface CapturedSendMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: string;
}

// Captures every sendMessage call made during a test.
export function createTelegramServer() {
  const captured: CapturedSendMessage[] = [];

  const handlers = [
    http.post(/https:\/\/api\.telegram\.org\/bot.*\/sendMessage/, async ({ request }) => {
      const body = (await request.json()) as CapturedSendMessage;
      captured.push(body);
      return HttpResponse.json({ ok: true, result: { message_id: 1 } });
    }),
  ];

  const server = setupServer(...handlers);

  return {
    server,
    /** All sendMessage calls captured so far. */
    get messages() {
      return captured;
    },
    /** Reset captured messages between tests. */
    reset() {
      captured.length = 0;
    },
  };
}
