// Supabase Edge Function: medellin-access — Mokea Digital LLC
// Rutas (POST):  /webhook?key=WEBHOOK_SECRET   (Systeme.io → nueva venta)
//                /request-code  {email}
//                /verify        {email, code, device}
//                /check         {email, device, token}
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const CONTENT_KEY = Deno.env.get("CONTENT_KEY") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ?? "Medellín a un clic <acceso@acceso.mokeadigital.com>";
const MAX_MOVES = Number(Deno.env.get("MAX_MOVES") ?? "3");
const TABLE = "mde_buyers";
const CODE_WAIT_MS = Number(Deno.env.get("CODE_WAIT_MS") ?? "60000");
// Correos sin límite de celulares (la dueña, para revisar la app). Secreto SIN_LIMITE, separados por coma.
const SIN_LIMITE = (Deno.env.get("SIN_LIMITE") ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (e: unknown) => String(e ?? "").trim().toLowerCase();

async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, "0");
}
function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// Busca el correo del COMPRADOR dentro del JSON que manda Systeme.io.
// Prefiere los correos que están dentro de "customer" o "contact".
function findEmails(o: unknown): { best: string[]; all: string[] } {
  const found: { path: string; email: string }[] = [];
  const walk = (v: unknown, path: string) => {
    if (v && typeof v === "object") {
      for (const [k, vv] of Object.entries(v as Record<string, unknown>)) walk(vv, path + "." + k.toLowerCase());
    } else if (typeof v === "string" && EMAIL_RE.test(v.trim())) {
      found.push({ path, email: clean(v) });
    }
  };
  walk(o, "");
  const uniq = (a: string[]) => [...new Set(a)];
  const best = uniq(found.filter((f) => /customer|contact|buyer/.test(f.path)).map((f) => f.email));
  console.log("webhook emails:", JSON.stringify(found.map((f) => f.path + "=" + f.email.replace(/^(.).*(@.*)$/, "$1***$2"))));
  return { best, all: uniq(found.map((f) => f.email)) };
}
async function readBody(req: Request): Promise<Record<string, unknown>> {
  const txt = await req.text();
  try { return JSON.parse(txt); } catch { /* no es JSON */ }
  try { return Object.fromEntries(new URLSearchParams(txt)); } catch { return {}; }
}

async function sendMail(to: string, code: string) {
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1d1d1b">
    <h2 style="color:#1F5A3A;margin:0 0 8px">Medellín a un clic</h2>
    <p>Your access code is / Tu código de acceso es:</p>
    <p style="font-size:34px;font-weight:bold;letter-spacing:8px;background:#FBF6EC;border:2px solid #F4B63F;border-radius:12px;padding:14px;text-align:center;margin:12px 0">${code}</p>
    <p>Type it in the app to unlock it. It expires in 15 minutes.<br>
    Escríbelo en la app para desbloquearla. Vence en 15 minutos.</p>
    <p style="color:#8a857a;font-size:13px">Didn't ask for it? Ignore this email. / ¿No lo pediste? Ignora este correo.<br>Mokea Digital LLC</p>
  </div>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject: `Your Medellín code / Tu código: ${code}`, html }),
  });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const url = new URL(req.url);
  const route = url.pathname.split("/").filter(Boolean).pop();
  const body: Record<string, unknown> = await readBody(req);

  try {
    // --- Systeme.io: nueva venta
    if (route === "webhook") {
      if (!WEBHOOK_SECRET || url.searchParams.get("key") !== WEBHOOK_SECRET) return json({ ok: false, error: "forbidden" }, 403);
      const { best, all } = findEmails(body);
      const emails = best.length ? best : all;
      if (!emails.length) { console.log("webhook sin correo, llaves:", Object.keys(body).join(",")); return json({ ok: false, error: "no_email" }, 400); }
      const { error } = await db.from(TABLE).upsert(emails.map((email) => ({ email, source: "systeme" })), { onConflict: "email", ignoreDuplicates: true });
      if (error) throw error;
      return json({ ok: true, count: emails.length });
    }

    const email = clean(body.email);
    if (!EMAIL_RE.test(email)) return json({ ok: false, error: "bad_email" }, 400);
    const { data: buyer, error: e1 } = await db.from(TABLE).select("*").eq("email", email).maybeSingle();
    if (e1) throw e1;
    const sinLimite = SIN_LIMITE.includes(email);

    // --- pedir código
    if (route === "request-code") {
      if (!buyer) return json({ ok: false, error: "not_buyer" }, 404);
      if (buyer.last_code_sent && Date.now() - new Date(buyer.last_code_sent).getTime() < CODE_WAIT_MS)
        return json({ ok: false, error: "wait" }, 429);
      const code = randomCode();
      await db.from(TABLE).update({
        code_hash: await sha(email + ":" + code),
        code_expires: new Date(Date.now() + 15 * 60_000).toISOString(),
        code_attempts: 0,
        last_code_sent: new Date().toISOString(),
      }).eq("email", email);
      await sendMail(email, code);
      return json({ ok: true });
    }

    // --- verificar código
    if (route === "verify") {
      if (!buyer) return json({ ok: false, error: "not_buyer" }, 404);
      const device = String(body.device ?? "").slice(0, 80);
      const code = String(body.code ?? "").replace(/\D/g, "");
      if (!buyer.code_hash || !buyer.code_expires || new Date(buyer.code_expires).getTime() < Date.now())
        return json({ ok: false, error: "expired" }, 401);
      if ((buyer.code_attempts ?? 0) >= 5) return json({ ok: false, error: "expired" }, 401);
      if ((await sha(email + ":" + code)) !== buyer.code_hash) {
        await db.from(TABLE).update({ code_attempts: (buyer.code_attempts ?? 0) + 1 }).eq("email", email);
        return json({ ok: false, error: "bad_code" }, 401);
      }
      let moves = buyer.moves ?? 0;
      if (!sinLimite && buyer.device_id && buyer.device_id !== device) {
        if (moves >= MAX_MOVES) {
          await db.from(TABLE).update({ code_hash: null }).eq("email", email);
          return json({ ok: false, error: "limit" }, 403);
        }
        moves += 1;
      }
      // Sin límite: todos sus equipos comparten el mismo pase, así ninguno saca al otro.
      const token = sinLimite && buyer.session_token ? buyer.session_token : randomToken();
      await db.from(TABLE).update({
        device_id: device, session_token: token, moves, code_hash: null, code_expires: null,
        code_attempts: 0, activated_at: new Date().toISOString(),
      }).eq("email", email);
      return json({ ok: true, token, key: CONTENT_KEY });
    }

    // --- ¿sigue siendo este el celular activo?
    if (route === "check") {
      const ok = !!buyer && buyer.session_token === String(body.token ?? "") && (sinLimite || buyer.device_id === String(body.device ?? ""));
      return json({ ok });
    }

    return json({ ok: false, error: "route" }, 404);
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "server" }, 500);
  }
});
