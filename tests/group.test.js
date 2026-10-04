import test from "node:test";
import assert from "node:assert/strict";
import { validateNews, codeIsActive } from "../src/lib/group.js";
import { publishAdministratorNews } from "../src/lib/group.server.js";

test("news is trimmed and empty, invalid and oversized inputs are rejected", () => {
  assert.deepEqual(validateNews({ body: " News " }), { body: "News" });
  for (const value of [undefined, {}, { body: 1 }, { body: " " }, { body: "x".repeat(3001) }])
    assert.throws(() => validateNews(value));
  assert.equal(validateNews({ body: "x".repeat(3000) }).body.length, 3000);
});

test("codes expire exactly at their deadline and old-day codes are inactive", () => {
  const post = {
    kind: "code",
    code: "GNG-TESTCODE",
    code_date: "2026-10-04",
    created_at: "2026-10-04T16:00:00Z",
    expires_at: "2026-10-04T16:10:00Z",
  };
  assert.equal(codeIsActive(post, Date.parse("2026-10-04T16:09:59Z")), true);
  assert.equal(codeIsActive(post, Date.parse(post.expires_at)), false);
  assert.equal(
    codeIsActive(
      { ...post, expires_at: "2026-10-05T18:00:00Z" },
      Date.parse("2026-10-05T16:00:00Z"),
    ),
    false,
  );
  assert.equal(codeIsActive({ ...post, kind: "news" }, Date.parse("2026-10-04T16:00:00Z")), false);
});

test("members and failed role checks cannot access the writer or publish", async () => {
  for (const result of [
    { data: false },
    { data: null },
    { data: "true" },
    { data: true, error: new Error("failed") },
  ]) {
    let writerLoaded = false;
    const context = {
      userId: "member",
      input: { body: "hello" },
      supabase: { rpc: async () => result },
    };
    await assert.rejects(
      publishAdministratorNews(context, async () => {
        writerLoaded = true;
      }),
      /Forbidden/,
    );
    assert.equal(writerLoaded, false);
  }
});

test("administrator can publish only a news record under their own identity", async () => {
  let inserted;
  const context = {
    userId: "admin-id",
    input: { body: " Update ", kind: "code", author_id: "someone-else" },
    supabase: {
      rpc: async (method, args) => {
        assert.equal(method, "has_role");
        assert.equal(args._user_id, "admin-id");
        return { data: true };
      },
    },
  };
  const result = await publishAdministratorNews(context, async () => ({
    from: (table) => {
      assert.equal(table, "group_announcements");
      return {
        insert: async (row) => {
          inserted = row;
          return {};
        },
      };
    },
  }));
  assert.deepEqual(inserted, { kind: "news", body: "Update", author_id: "admin-id" });
  assert.deepEqual(result, { ok: true });
});

test("invalid news never reaches the writer and failed inserts do not report success", async () => {
  const context = {
    userId: "admin",
    input: { body: "" },
    supabase: { rpc: async () => ({ data: true }) },
  };
  await assert.rejects(
    publishAdministratorNews(context, async () => {
      throw new Error("Writer should not load");
    }),
    /News must/,
  );
  await assert.rejects(
    publishAdministratorNews({ ...context, input: { body: "News" } }, async () => ({
      from: () => ({ insert: async () => ({ error: "write failed" }) }),
    })),
    /Could not publish/,
  );
});
