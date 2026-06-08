// PropertiesService is a GAS global — undefined in Node.js/tests
declare const PropertiesService:
  | GoogleAppsScript.Properties.PropertiesService
  | undefined;

function getConfig(key: string): string {
  if (typeof PropertiesService !== "undefined") {
    return PropertiesService.getScriptProperties().getProperty(key) ?? "";
  }
  return process.env[key] ?? "";
}

export const TELEGRAM_TOKEN = getConfig("TELEGRAM_BOT_TOKEN");
export const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
export const WEBAPP_URL = getConfig("WEBAPP_URL");
export const SPREADSHEET_ID = getConfig("SPREADSHEET_ID");
