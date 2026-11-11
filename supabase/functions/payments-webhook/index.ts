// Edge Function: recibe los eventos de la pasarela de pagos y escribe las suscripciones.
// Es el ÚNICO lugar que modifica `subscriptions`; usa la clave service_role, que vive solo en el servidor.
// Despliegue:  supabase functions deploy payments-webhook --no-verify-jwt
// Secretos:    supabase secrets set PAYMENTS_WEBHOOK_SECRET=...   (SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya existen)
import { createClient } from "npm:@supabase/supabase-js@2";
import { handleRequest } from "./handler.js";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const db = {
  async roleOf(userId: string) {
    const { data, error } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data?.role ?? null;
  },
  async recordEvent(event: { id: string; user_id: string; type: string }) {
    const { error } = await admin.from("payment_events").insert({ id: event.id, user_id: event.user_id, type: event.type, payload: event });
    if (error?.code === "23505") return false; // ya procesado
    if (error) throw error;
    return true;
  },
  async saveSubscription(row: Record<string, unknown>) {
    const { error } = await admin.from("subscriptions").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
  },
};

Deno.serve(async (request) => {
  try {
    const result = await handleRequest(db, Deno.env.get("PAYMENTS_WEBHOOK_SECRET") ?? "", request.method, await request.text(), request.headers.get("x-signature"));
    return new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });
  } catch (error) {
    console.error("payments-webhook:", error);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
