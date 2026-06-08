// PropertiesService is a GAS global. In Node.js it does not exist on globalThis,
// so we detect the runtime with an "in" check instead of a declare that would
// conflict when @types/google-apps-script is loaded for the build type-check.
function getConfig(key: string): string {
  if ("PropertiesService" in globalThis) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).PropertiesService
      .getScriptProperties()
      .getProperty(key) ?? "";
  }
  return process.env[key] ?? "";
}

export const TELEGRAM_TOKEN = getConfig("TELEGRAM_BOT_TOKEN");
export const TELEGRAM_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
export const WEBAPP_URL = getConfig("WEBAPP_URL");
export const SPREADSHEET_ID = getConfig("SPREADSHEET_ID");
