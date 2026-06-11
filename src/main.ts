import { createSheetsClient } from "./sheets/client";
import { createBot } from "./commands";
import { TELEGRAM_TOKEN } from "./vars";
import { gasAdapterFetch } from "./telegram/api";

// GAS webhook entry point — receives all incoming Telegram updates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).doPost = async function (e: { postData: { contents: string } }): Promise<void> {
  const sheets = createSheetsClient();
  // In GAS, fetch is not available globally — pass a UrlFetchApp-based adapter so
  // grammY's internal HTTP client (ctx.reply etc.) can make Telegram API calls.
  const inGas = "UrlFetchApp" in globalThis;
  const bot = createBot(sheets, TELEGRAM_TOKEN, inGas ? gasAdapterFetch : undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update = JSON.parse(e.postData.contents) as any;
  await bot.handleUpdate(update);
};
