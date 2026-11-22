// Supabase Edge Function: medellin-reservas — Mokea Digital LLC
// Aquí solo se conecta con Supabase y se leen los secretos. La lógica está en logica.ts.
// Secretos (Supabase → Edge Functions → Secrets). NUNCA van en el código ni en el chat:
//   RESERVAS_MODO          prueba | real
//   BOLD_LLAVE_IDENTIDAD   llave de identidad del Botón de pagos (la de pruebas mientras sea prueba)
//   BOLD_LLAVE_SECRETA     llave secreta del Botón de pagos (la de pruebas mientras sea prueba)
//   GOOGLE_CUENTA_JSON     el archivo JSON completo de la cuenta de servicio de Google
//   PAOLA_CALENDARIO       el correo de Gmail de Paola (su calendario compartido con la cuenta de servicio)
//   PAOLA_CORREO           a dónde llega el aviso de cada reserva
//   RESEND_API_KEY         (ya existe, es la misma del candado)
//   RESERVAS_REMITENTE     opcional, p. ej. Medellín a un clic <reservas@acceso.mokeadigital.com>
//   APP_URL                opcional, https://medellin.mokeadigital.com
import { createClient } from "npm:@supabase/supabase-js@2";
import { crearManejador, type Almacen } from "./logica.ts";
import type { Config } from "./precios.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const env = (k: string, d = "") => (Deno.env.get(k) ?? d).trim();

let cfgCache: { c: Config; vence: number } | null = null;
const almacen: Almacen = {
  async config() {
    if (cfgCache && cfgCache.vence > Date.now()) return cfgCache.c;
    const [a, t] = await Promise.all([
      db.from("mde_ajustes").select("clave, valor"),
      db.from("mde_tours").select("*").order("orden"),
    ]);
    if (a.error || t.error) throw new Error("config: " + (a.error ?? t.error)!.message);
    const v: Record<string, any> = Object.fromEntries(a.data!.map((x) => [x.clave, x.valor]));
    const c: Config = {
      tasa: Number(v.tasa), anticipo: Number(v.anticipo), diasMinimos: Number(v.diasMinimos),
      grupos: v.grupos, horaExtra: v.horaExtra, aeroRecargo: Number(v.aeroRecargo),
      aeroMunicipios: v.aeroMunicipios, aeroSinRecargo: v.aeroSinRecargo, aeroGuatapeUSD: v.aeroGuatapeUSD,
      nocturno: v.nocturno, lucesTemporada: v.lucesTemporada,
      tours: t.data!.map((x) => ({
        id: x.id, es: x.nombre_es, en: x.nombre_en,
        precios: [x.precio_1_3, x.precio_4_6, x.precio_7_10, x.precio_11_16].map(Number),
        horas: Number(x.horas), aeropuerto: x.aeropuerto, temporada: x.temporada, activo: x.activo,
      })),
    };
    if (!(c.tasa > 0) || !c.tours.length) throw new Error("config incompleta");
    cfgCache = { c, vence: Date.now() + 60000 };
    return c;
  },
  async insertar(f) { const r = await db.from("mde_reservas").insert(f); if (r.error) throw new Error("insertar: " + r.error.message); },
  async buscar(orden) {
    const r = await db.from("mde_reservas").select("*").eq("orden", orden).maybeSingle();
    if (r.error) throw new Error("buscar: " + r.error.message); return r.data;
  },
  async marcarPagada(orden, boldId) {
    // Un solo UPDATE: si llegan el webhook y la app al mismo tiempo, solo uno "gana".
    const r = await db.from("mde_reservas").update({ estado: "pagada", pagada_en: new Date().toISOString(), bold_id: boldId || null })
      .eq("orden", orden).neq("estado", "pagada").select("*").maybeSingle();
    if (r.error) throw new Error("pagar: " + r.error.message); return r.data;
  },
  async marcarRechazada(orden) {
    const r = await db.from("mde_reservas").update({ estado: "rechazada" }).eq("orden", orden).eq("estado", "pendiente");
    if (r.error) throw new Error("rechazar: " + r.error.message);
  },
  async actualizar(orden, cambios) { const r = await db.from("mde_reservas").update(cambios).eq("orden", orden); if (r.error) throw new Error("actualizar: " + r.error.message); },
  async recientesPorCorreo(correo) {
    const r = await db.from("mde_reservas").select("orden", { count: "exact", head: true })
      .eq("correo", correo).gte("creada", new Date(Date.now() - 86400000).toISOString());
    return r.count ?? 0;
  },
  async limpiar() { await db.rpc("mde_borrar_vencidas"); },
};

let googleCuenta = null;
try { const j = env("GOOGLE_CUENTA_JSON"); if (j) googleCuenta = JSON.parse(j); } catch { console.log("GOOGLE_CUENTA_JSON no es un JSON válido"); }

const manejar = crearManejador({
  almacen, fetch,
  enFondo: (p) => { try { (globalThis as any).EdgeRuntime?.waitUntil(p); } catch { /* sigue igual */ } },
  ajustes: {
    modo: env("RESERVAS_MODO", "prueba") === "real" ? "real" : "prueba",
    boldIdentidad: env("BOLD_LLAVE_IDENTIDAD"), boldSecreta: env("BOLD_LLAVE_SECRETA"),
    googleCuenta, calendario: env("PAOLA_CALENDARIO"), paolaCorreo: env("PAOLA_CORREO"),
    paolaWhatsapp: env("PAOLA_WHATSAPP", "573194635142"),
    resendKey: env("RESEND_API_KEY"),
    remitente: env("RESERVAS_REMITENTE", "Medellín a un clic <reservas@acceso.mokeadigital.com>"),
    appUrl: env("APP_URL", "https://medellin.mokeadigital.com"),
  },
});
Deno.serve(manejar);
