import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

const BASE = process.env.TEST_BASE_URL;
const DB_PATH = process.env.TEST_DB_PATH;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!BASE || !DB_PATH || !ADMIN_SECRET) {
  throw new Error("Run this suite through `npm run test:integration`.");
}

class Jar {
  constructor() {
    this.cookies = new Map();
  }
  store(res) {
    const list = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const raw of list) {
      const pair = raw.split(";")[0];
      const index = pair.indexOf("=");
      if (index < 0) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value) this.cookies.set(name, value);
      else this.cookies.delete(name);
    }
  }
}

async function call(jar, method, path, body) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (jar) {
    const cookie = [...jar.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    if (cookie) headers.cookie = cookie;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar?.store(res);
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, data };
}

function openDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

function insertScript(db, { id, licenseId, accountId, title }) {
  const now = Date.now();
  db.prepare(
    `INSERT INTO scripts (id, license_id, account_id, title, hook, body, niche, duration, mode, provider, model, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    licenseId,
    accountId,
    title,
    "Test hook",
    "Test script body.\n\nSecond paragraph.",
    "test niche",
    30,
    "balanced",
    "test-provider",
    "test-model",
    now,
    now,
  );
}

const admin = new Jar();
const db = openDb();
const state = {};

test("license management system", async (t) => {
  await t.test("admin authentication is required for every license endpoint", async () => {
    const anon = new Jar();
    assert.equal((await call(anon, "GET", "/api/admin/licenses")).status, 401);
    assert.equal(
      (await call(anon, "POST", "/api/admin/licenses", { customerName: "x" })).status,
      401,
    );

    const wrong = new Jar();
    const bad = await call(wrong, "POST", "/api/admin/session", { password: "wrong-password" });
    assert.equal(bad.status, 401);

    const good = await call(admin, "POST", "/api/admin/session", { password: ADMIN_SECRET });
    assert.equal(good.status, 200);
    assert.equal(good.data.authenticated, true);
  });

  await t.test("bulk generation returns HM-XXXX-XXXX-XXXX keys once and stores only hashes", async () => {
    const created = await call(admin, "POST", "/api/admin/licenses", {
      customerName: "Bulk Customer",
      quantity: 3,
      expiry: "lifetime",
      generationLimit: 0,
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.created.length, 3);

    for (const item of created.data.created) {
      assert.match(item.key, /^HM-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);
      assert.ok(item.accountId.startsWith("acc_"));

      const row = db.prepare("SELECT key_hash, key_prefix, key_last4, account_id FROM licenses WHERE id = ?").get(item.id);
      assert.equal(row.key_hash.length, 64);
      assert.notEqual(row.key_hash.toLowerCase(), item.key.toLowerCase());
      assert.equal(row.key_last4, item.key.slice(-4));
      assert.equal(row.account_id, item.accountId);
    }

    const keys = new Set(created.data.created.map((item) => item.key));
    assert.equal(keys.size, 3, "generated keys must be unique");

    const listed = await call(admin, "GET", "/api/admin/licenses");
    assert.equal(listed.status, 200);
    const serialized = JSON.stringify(listed.data);
    for (const item of created.data.created) {
      assert.ok(!serialized.includes(item.key), "plaintext key must never be returned");
    }

    state.bulk = created.data.created;
  });

  await t.test("a new key activates, creates a session and becomes active", async () => {
    const created = await call(admin, "POST", "/api/admin/licenses", {
      customerName: "Primary Customer",
      expiry: "30",
    });
    assert.equal(created.status, 201);
    state.primary = created.data.created[0];

    const before = await call(admin, "GET", "/api/admin/licenses?q=Primary Customer");
    assert.equal(before.data.licenses[0].status, "unused");
    assert.equal(before.data.licenses[0].activatedAt, null);

    state.jarA = new Jar();
    const activated = await call(state.jarA, "POST", "/api/license/verify", { key: state.primary.key });
    assert.equal(activated.status, 200);
    assert.equal(activated.data.license.status, "active");
    assert.equal(activated.data.license.accountId, state.primary.accountId);
    assert.ok(state.jarA.cookies.get("hm_session"), "session cookie must be issued");

    const row = db.prepare("SELECT activated_at, account_id FROM licenses WHERE id = ?").get(state.primary.id);
    assert.ok(row.activated_at > 0, "activation timestamp must be persisted");
    assert.equal(row.account_id, state.primary.accountId);

    const session = await call(state.jarA, "GET", "/api/license/session");
    assert.equal(session.status, 200);
    assert.equal(session.data.authenticated, true);
  });

  await t.test("an invented key is rejected", async () => {
    const jar = new Jar();
    const res = await call(jar, "POST", "/api/license/verify", { key: "HM-ZZZZ-ZZZZ-ZZZZ" });
    assert.equal(res.status, 401);
    assert.equal(res.data.error.code, "invalid_license");
    assert.equal(jar.cookies.get("hm_session"), undefined);
  });

  await t.test("an expired key is rejected", async () => {
    const created = await call(admin, "POST", "/api/admin/licenses", {
      customerName: "Expired Customer",
      expiry: "30",
    });
    const license = created.data.created[0];
    db.prepare("UPDATE licenses SET expires_at = ? WHERE id = ?").run(Date.now() - 60_000, license.id);

    const jar = new Jar();
    const res = await call(jar, "POST", "/api/license/verify", { key: license.key });
    assert.equal(res.status, 401);
    assert.equal(res.data.error.code, "license_expired");
    assert.equal(jar.cookies.get("hm_session"), undefined);
  });

  await t.test("a revoked key is rejected and its sessions are destroyed", async () => {
    const created = await call(admin, "POST", "/api/admin/licenses", {
      customerName: "Revoked Customer",
      expiry: "90",
    });
    const license = created.data.created[0];

    const jar = new Jar();
    assert.equal((await call(jar, "POST", "/api/license/verify", { key: license.key })).status, 200);
    assert.equal((await call(jar, "GET", "/api/scripts")).status, 200);

    const revoked = await call(admin, "PATCH", `/api/admin/licenses/${license.id}`, { action: "revoke" });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.data.license.status, "revoked");

    assert.equal((await call(jar, "GET", "/api/scripts")).status, 401);
    const jar2 = new Jar();
    const res = await call(jar2, "POST", "/api/license/verify", { key: license.key });
    assert.equal(res.status, 401);
    assert.equal(res.data.error.code, "license_revoked");
  });

  await t.test("the same account sees its history from a second device", async () => {
    insertScript(db, {
      id: "scr_shared_history",
      licenseId: state.primary.id,
      accountId: state.primary.accountId,
      title: "Shared history script",
    });

    const secondDevice = new Jar();
    const res = await call(secondDevice, "POST", "/api/license/verify", { key: state.primary.key });
    assert.equal(res.status, 200);

    for (const jar of [state.jarA, secondDevice]) {
      const list = await call(jar, "GET", "/api/scripts");
      assert.equal(list.status, 200);
      assert.ok(
        list.data.scripts.some((script) => script.id === "scr_shared_history"),
        "both devices must see the same account history",
      );
      const detail = await call(jar, "GET", "/api/scripts/scr_shared_history");
      assert.equal(detail.status, 200);
      assert.equal(detail.data.script.title, "Shared history script");
    }

    state.jarA2 = secondDevice;
  });

  await t.test("two different licenses cannot read or modify each other's data", async () => {
    const created = await call(admin, "POST", "/api/admin/licenses", {
      customerName: "Other Customer",
      expiry: "lifetime",
    });
    state.other = created.data.created[0];

    const jarB = new Jar();
    assert.equal((await call(jarB, "POST", "/api/license/verify", { key: state.other.key })).status, 200);

    const list = await call(jarB, "GET", "/api/scripts");
    assert.equal(list.status, 200);
    assert.ok(!list.data.scripts.some((script) => script.id === "scr_shared_history"));

    assert.equal((await call(jarB, "GET", "/api/scripts/scr_shared_history")).status, 404);
    assert.equal(
      (await call(jarB, "PATCH", "/api/scripts/scr_shared_history", { title: "hijacked" })).status,
      404,
    );
    assert.equal((await call(jarB, "DELETE", "/api/scripts/scr_shared_history")).status, 404);

    const check = db.prepare("SELECT title FROM scripts WHERE id = ?").get("scr_shared_history");
    assert.equal(check.title, "Shared history script");

    state.jarB = jarB;
  });

  await t.test("AI provider configuration is scoped to the account", async () => {
    const saved = await call(state.jarA, "PUT", "/api/config/ai", {
      provider: "openai",
      model: "gpt-6-luna",
      apiKey: "sk-test-account-a",
      keyMode: "stored",
    });
    assert.equal(saved.status, 200);

    const own = await call(state.jarA2, "GET", "/api/config/ai");
    assert.equal(own.status, 200);
    assert.equal(own.data.config.hasKey, true);

    const other = await call(state.jarB, "GET", "/api/config/ai");
    assert.equal(other.status, 200);
    assert.equal(other.data.config.hasKey, false);
    assert.equal(other.data.config.maskedKey, null);
  });

  await t.test("unauthenticated clients cannot reach account data", async () => {
    const anon = new Jar();
    assert.equal((await call(anon, "GET", "/api/scripts")).status, 401);
    assert.equal((await call(anon, "GET", "/api/scripts/scr_shared_history")).status, 401);
    assert.equal((await call(anon, "GET", "/api/config/ai")).status, 401);
    assert.equal((await call(anon, "GET", "/api/jobs")).status, 401);
  });

  await t.test("license management actions are admin-only", async () => {
    const asUser = state.jarA;
    assert.equal((await call(asUser, "GET", "/api/admin/licenses")).status, 401);
    assert.equal(
      (await call(asUser, "POST", "/api/admin/licenses", { customerName: "nope" })).status,
      401,
    );
    assert.equal(
      (await call(asUser, "PATCH", `/api/admin/licenses/${state.other.id}`, { action: "revoke" })).status,
      401,
    );

    const stillActive = db.prepare("SELECT status FROM licenses WHERE id = ?").get(state.other.id);
    assert.equal(stillActive.status, "active");
  });
});

test.after(() => {
  db.close();
});
