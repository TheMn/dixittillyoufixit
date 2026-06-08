import { en } from "./en";
import { fa } from "./fa";

type Lang = "en" | "fa";

const locales: Record<Lang, Record<string, string>> = { en, fa };

export function t(
  key: string,
  lang: Lang,
  params?: Record<string, string | number>
): string {
  const locale = locales[lang] ?? locales["en"];
  let message = locale[key] ?? key;

  if (params) {
    for (const [param, value] of Object.entries(params)) {
      message = message.replaceAll(`{{${param}}}`, String(value));
    }
  }

  return message;
}
