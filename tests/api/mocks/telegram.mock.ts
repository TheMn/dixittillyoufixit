import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

export interface CapturedSendMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: string;
}

export interface CapturedCallbackAnswer {
  callback_query_id: string;
  text?: string;
  show_alert?: boolean;
}

// Captures every sendMessage and answerCallbackQuery call made during a test.
export function createTelegramServer() {
  const messages: CapturedSendMessage[] = [];
  const callbackAnswers: CapturedCallbackAnswer[] = [];

  const handlers = [
    http.post(/https:\/\/api\.telegram\.org\/bot.*\/sendMessage/, async ({ request }) => {
      const body = (await request.json()) as CapturedSendMessage;
      messages.push(body);
      return HttpResponse.json({ ok: true, result: { message_id: 1 } });
    }),
    http.post(/https:\/\/api\.telegram\.org\/bot.*\/answerCallbackQuery/, async ({ request }) => {
      const body = (await request.json()) as CapturedCallbackAnswer;
      callbackAnswers.push(body);
      return HttpResponse.json({ ok: true, result: true });
    }),
  ];

  const server = setupServer(...handlers);

  return {
    server,
    /** All sendMessage calls captured so far. */
    get messages() {
      return messages;
    },
    /** All answerCallbackQuery calls captured so far. */
    get callbackAnswers() {
      return callbackAnswers;
    },
    /** Reset all captured calls between tests. */
    reset() {
      messages.length = 0;
      callbackAnswers.length = 0;
    },
  };
}
