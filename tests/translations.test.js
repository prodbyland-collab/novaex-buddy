import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import ts from "typescript";
import { translationCatalog } from "../src/lib/translation-catalog.js";
import { translateMessage, uiTranslations } from "../src/lib/ui-translations.js";
import { formatDateTime } from "../src/lib/locale.js";

test("English and Georgian catalogs cover the same keys and preserve template variables", () => {
  assert.deepEqual(
    Object.keys(translationCatalog.en).sort(),
    Object.keys(translationCatalog.ka).sort(),
  );
  for (const [key, english] of Object.entries(translationCatalog.en)) {
    const georgian = translationCatalog.ka[key];
    assert.ok(typeof georgian === "string" && georgian.trim(), key);
    const variables = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(variables(english), variables(georgian), key);
  }
});

test("every literal translation key used by components and routes exists in both languages", async () => {
  const missing = [];
  for (const directory of ["../src/components/", "../src/routes/"]) {
    const base = new URL(directory, import.meta.url);
    for (const file of await readdir(base, { recursive: true })) {
      if (!/\.[jt]sx$/.test(file)) continue;
      const source = await readFile(new URL(file.replaceAll("\\", "/"), base), "utf8");
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const walk = (node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === "t" &&
          ts.isStringLiteral(node.arguments[0])
        ) {
          const key = node.arguments[0].text;
          if (!translationCatalog.en[key] || !translationCatalog.ka[key])
            missing.push(`${file}: ${key}`);
        }
        ts.forEachChild(node, walk);
      };
      walk(ast);
    }
  }
  assert.deepEqual(missing, []);
});

test("payment statuses and audit actions have readable English and Georgian labels", () => {
  for (const key of [
    "waiting",
    "partially_paid",
    "finished",
    "completed",
    "failed",
    "balance.adjust",
    "plan.set",
    "account.suspend",
  ]) {
    assert.ok(/[\u10a0-\u10ff]/.test(uiTranslations.ka[key]), key);
    assert.ok(!/[_.]/.test(uiTranslations.en[key]), key);
  }
});

test("server errors, successful code replies and dynamic payment limits translate", () => {
  assert.equal(translateMessage("Invalid login credentials", "ka"), "ელფოსტა ან პაროლი არასწორია");
  assert.equal(
    translateMessage("Minimum deposit for BTC is $500", "ka"),
    "BTC-ის მინიმალური დეპოზიტია $500",
  );
  assert.equal(translateMessage("3 accounts paid", "ka"), "თანხა დაერიცხა 3 ანგარიშს");
  assert.equal(
    translateMessage("Boost unlocked: +1% for today", "ka"),
    "ბონუსი გააქტიურდა: +1% დღეს",
  );
  assert.equal(translateMessage("Unexpected backend issue", "ka"), "შეცდომა მოხდა. სცადე ხელახლა.");
  assert.equal(translateMessage("Unexpected backend issue", "en"), "Unexpected backend issue");
  assert.equal(translateMessage("ბალანსი არასაკმარისია", "ka"), "ბალანსი არასაკმარისია");
});

test("Georgian dates never fall back to English month names and retain Georgian time", () => {
  assert.equal(formatDateTime("2026-10-04T16:00:00Z", "ka"), "4 ოქტ. 2026, 20:00");
  assert.equal(formatDateTime("2026-10-04T16:00:00Z", "en"), "4 Oct 2026, 20:00");
  assert.equal(formatDateTime("2026-10-04", "ka", false), "4 ოქტ. 2026");
  assert.equal(formatDateTime(null, "ka"), "—");
});

test("static interface text and accessibility labels use translations instead of English literals", async () => {
  const allowed = new Set(["GNG", "G", "EN", "AI", "USD", "BTC / USD", "© 2026 GNG"]),
    untranslated = [];
  const base = new URL("../src/components/", import.meta.url);
  for (const file of await readdir(base, { recursive: true })) {
    if (!/\.[jt]sx$/.test(file)) continue;
    const source = await readFile(new URL(file.replaceAll("\\", "/"), base), "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const walk = (node) => {
      let literal;
      if (ts.isJsxText(node)) literal = node.text.trim().replace(/\s+/g, " ");
      if (
        ts.isJsxAttribute(node) &&
        ["aria-label", "title", "alt"].includes(node.name.text) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer)
      )
        literal = node.initializer.text;
      if (literal && /[A-Za-z]{2}/.test(literal) && !allowed.has(literal))
        untranslated.push(`${file}: ${literal}`);
      ts.forEachChild(node, walk);
    };
    walk(ast);
  }
  assert.deepEqual(untranslated, []);
});
