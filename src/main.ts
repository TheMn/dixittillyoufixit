import { createSheetsClient } from "./sheets/client";
import { createBot } from "./commands";
import { TELEGRAM_TOKEN } from "./vars";

// GAS webhook entry point — receives all incoming Telegram updates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).doPost = function (e: { postData: { contents: string } }): void {
  const sheets = createSheetsClient();
  const bot = createBot(sheets, TELEGRAM_TOKEN);
  const update = JSON.parse(e.postData.contents) as Record<string, unknown>;
  void bot.handleUpdate(update);
};
