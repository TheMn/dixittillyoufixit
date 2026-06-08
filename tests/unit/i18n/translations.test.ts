import { describe, it, expect } from "vitest";
import { t } from "../../../src/i18n/index";
import { en } from "../../../src/i18n/en";
import { fa } from "../../../src/i18n/fa";

describe("t() — i18n translation function", () => {
  it("should return the correct English string for a known key", () => {
    expect(t("game.created", "en")).toBe(en["game.created"]);
  });

  it("should return the correct Persian string for a known key", () => {
    expect(t("game.created", "fa")).toBe(fa["game.created"]);
  });

  it("should interpolate a single {{param}} in English", () => {
    const result = t("round.start", "en", { round: 3 });
    expect(result).toContain("3");
    expect(result).not.toContain("{{round}}");
  });

  it("should interpolate a single {{param}} in Persian", () => {
    const result = t("round.start", "fa", { round: 5 });
    expect(result).toContain("5");
    expect(result).not.toContain("{{round}}");
  });

  it("should interpolate multiple {{params}} in one string", () => {
    const result = t("game.winner", "en", { username: "Alice", score: 30 });
    expect(result).toContain("Alice");
    expect(result).toContain("30");
    expect(result).not.toContain("{{username}}");
    expect(result).not.toContain("{{score}}");
  });

  it("should fall back to the key name when the key does not exist", () => {
    expect(t("nonexistent.key", "en")).toBe("nonexistent.key");
  });

  it("should not crash when params are omitted for a parameterized key", () => {
    expect(() => t("round.start", "en")).not.toThrow();
    expect(t("round.start", "en")).toContain("{{round}}");
  });

  it("should not crash when extra params are passed", () => {
    expect(() =>
      t("game.created", "en", { unused: "value", alsoUnused: 99 })
    ).not.toThrow();
  });

  it("should fall back to English when an unknown language is passed", () => {
    expect(t("game.created", "xx" as any)).toBe(en["game.created"]);
  });

  it("Persian strings should contain Persian Unicode characters", () => {
    const persianRange = /[؀-ۿ]/;
    const persianValues = Object.values(fa);
    expect(persianValues.every((v) => persianRange.test(v))).toBe(true);
  });
});
