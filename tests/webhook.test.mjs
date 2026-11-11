// node --test tests/webhook.test.mjs
import test from "node:test";
import { strict as assert } from "node:assert";
import { handleRequest, hmacHex, parseEvent, verifySignature } from "../supabase/functions/payments-webhook/handler.js";

const SECRET = "secreto-de-prueba";
const USER = "11111111-1111-4111-8111-111111111111";
const body = (extra = {}) => JSON.stringify({ id: "evt_1", type: "invoice.paid", user_id: USER, plan_id: "investor_pro", status: "active", current_period_end: "2027-01-10T00:00:00Z", provider: "mercadopago", provider_ref: "sub_9", ...extra });
const fakeDb = (role = "investor") => {
  const state = { events: new Set(), subscriptions: [] };
  return Object.assign(state, {
    roleOf: async () => role,
    recordEvent: async (event) => { if (state.events.has(event.id)) return false; state.events.add(event.id); return true; },
    saveSubscription: async (row) => { state.subscriptions.push(row); }
  });
};
const send = async (db, raw, { secret = SECRET, signature, method = "POST" } = {}) =>
  handleRequest(db, SECRET, method, raw, signature ?? await hmacHex(secret, raw));

test("una firma válida se acepta, con o sin prefijo sha256=", async () => {
  const raw = body();
  const signature = await hmacHex(SECRET, raw);
  assert.equal(await verifySignature(SECRET, raw, signature), true);
  assert.equal(await verifySignature(SECRET, raw, `sha256=${signature.toUpperCase()}`), true);
});

test("firma ausente, ajena o de otro cuerpo se rechaza con 401 y no escribe nada", async () => {
  const db = fakeDb();
  assert.equal((await send(db, body(), { signature: "" })).status, 401);
  assert.equal((await send(db, body(), { secret: "otro-secreto" })).status, 401);
  assert.equal((await handleRequest(db, SECRET, "POST", body({ status: "expired" }), await hmacHex(SECRET, body()))).status, 401);
  assert.equal((await handleRequest(db, "", "POST", body(), await hmacHex(SECRET, body()))).status, 401, "sin secreto configurado nunca se acepta");
  assert.equal(db.subscriptions.length, 0);
});

test("un evento válido actualiza la suscripción", async () => {
  const db = fakeDb();
  const result = await send(db, body());
  assert.deepEqual([result.status, result.body.duplicated], [200, false]);
  assert.equal(db.subscriptions.length, 1);
  assert.deepEqual([db.subscriptions[0].user_id, db.subscriptions[0].plan_id, db.subscriptions[0].status, db.subscriptions[0].current_period_end], [USER, "investor_pro", "active", "2027-01-10T00:00:00.000Z"]);
});

test("el mismo evento reenviado no se procesa dos veces", async () => {
  const db = fakeDb();
  await send(db, body());
  const again = await send(db, body());
  assert.deepEqual([again.status, again.body.duplicated], [200, true]);
  assert.equal(db.subscriptions.length, 1);
});

test("un evento nuevo con el mismo usuario sí se procesa (renovación, cancelación)", async () => {
  const db = fakeDb();
  await send(db, body());
  await send(db, body({ id: "evt_2", status: "canceled" }));
  assert.deepEqual(db.subscriptions.map((row) => row.status), ["active", "canceled"]);
});

test("datos inválidos devuelven 400 sin escribir", async () => {
  const db = fakeDb();
  for (const raw of ["no es json", body({ id: "" }), body({ user_id: "abc" }), body({ status: "gratis-para-siempre" }), body({ current_period_end: "mañana" }), body({ plan_id: "" })]) {
    assert.equal((await send(db, raw)).status, 400, raw.slice(0, 40));
  }
  assert.equal(db.subscriptions.length, 0);
});

test("un plan que no corresponde al rol del usuario se rechaza", async () => {
  const db = fakeDb("startup");
  assert.equal((await send(db, body())).status, 422);
  assert.equal(db.subscriptions.length, 0);
  assert.equal((await send(fakeDb(null), body())).status, 404);
});

test("solo POST", async () => {
  assert.equal((await send(fakeDb(), body(), { method: "GET" })).status, 405);
});

test("parseEvent acota textos largos y normaliza fechas", () => {
  const { event } = parseEvent(body({ type: "x".repeat(500), trial_ends_at: "2027-02-01" }));
  assert.equal(event.type.length, 100);
  assert.match(event.trial_ends_at, /^2027-02-01T/);
});
