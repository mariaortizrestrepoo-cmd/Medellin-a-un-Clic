// Función de Supabase "medellin-reservas" — Mokea Digital LLC
// Rutas (POST, JSON):
//   /precios         → tasa y precios públicos (para que la app use los mismos de la tabla)
//   /disponibilidad  {desde}  → días CERRADO del calendario de Paola
//   /crear           {datos de la reserva} → guarda la reserva "pendiente" y devuelve los datos firmados para Bold
//   /confirmar       {orden}  → al volver de Bold: pregunta a Bold el estado y confirma la reserva
//   /webhook-bold    (lo llama Bold) → aviso firmado de pago aprobado o rechazado
// Al confirmarse el pago (por /confirmar o por el webhook, lo que llegue primero, UNA sola vez):
//   crea el evento en el Google Calendar de Paola y manda los correos al cliente y a Paola.
import { type Config, firmaAvisoBold, firmaBold, hoyCO, igualSeguro, masDias, nuevaOrden, type Reserva, revisar } from "./precios.ts";

export type Fila = Record<string, any>;
export interface Almacen {
  config(): Promise<Config>;
  insertar(f: Fila): Promise<void>;
  buscar(orden: string): Promise<Fila | null>;
  marcarPagada(orden: string, boldId: string): Promise<Fila | null>;   // devuelve la fila SOLO si este llamado la pasó a pagada
  marcarRechazada(orden: string): Promise<void>;
  actualizar(orden: string, cambios: Fila): Promise<void>;
  recientesPorCorreo(correo: string): Promise<number>;
  limpiar(): Promise<void>;
}
export type Ajustes = {
  modo: "prueba" | "real";
  boldIdentidad: string; boldSecreta: string;
  googleCuenta: { client_email: string; private_key: string; token_uri?: string } | null;
  calendario: string; paolaCorreo: string; paolaWhatsapp: string;
  resendKey: string; remitente: string; appUrl: string;
};
export type Dependencias = {
  almacen: Almacen; ajustes: Ajustes;
  fetch: typeof fetch;
  enFondo: (p: Promise<unknown>) => void;     // trabajo que sigue después de responder (EdgeRuntime.waitUntil)
  ahora?: () => Date;
  log?: (...a: unknown[]) => void;
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const ORDEN_RE = /^MDE-[A-Z0-9-]{6,56}$/;
const fmtCOP = (n: number) => n.toLocaleString("es-CO");
const fmtUSD = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
// Siempre dólares primero y su conversión a pesos (lo que cobra Bold)
const plata = (usd: number, cop: number) => "US$" + fmtUSD(Number(usd)) + " · COP " + fmtCOP(Number(cop));

export function crearManejador(dep: Dependencias) {
  const { almacen, ajustes: A } = dep;
  const ahora = dep.ahora ?? (() => new Date());
  const log = dep.log ?? console.log;
  const prueba = A.modo !== "real";

  // ---------- Google Calendar (cuenta de servicio) ----------
  let token: { v: string; vence: number } | null = null;
  const b64url = (b: Uint8Array | string) => {
    const s = typeof b === "string" ? btoa(unescape(encodeURIComponent(b))) : btoa(String.fromCharCode(...b));
    return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  async function tokenGoogle() {
    if (!A.googleCuenta) throw new Error("google: falta la cuenta de servicio");
    if (token && token.vence > Date.now() + 60000) return token.v;
    const c = A.googleCuenta, aud = c.token_uri || "https://oauth2.googleapis.com/token", t = Math.floor(Date.now() / 1000);
    const sinFirma = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      b64url(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/calendar.events", aud, iat: t, exp: t + 3600 }));
    const pem = c.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
    const der = Uint8Array.from(atob(pem), (ch) => ch.charCodeAt(0));
    const llave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
    const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", llave, new TextEncoder().encode(sinFirma)));
    const r = await dep.fetch(aud, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: sinFirma + "." + b64url(firma) }),
    });
    if (!r.ok) throw new Error("google token " + r.status + " " + (await r.text()).slice(0, 200));
    const j = await r.json();
    token = { v: j.access_token, vence: Date.now() + (j.expires_in ?? 3600) * 1000 };
    return token.v;
  }
  const urlCal = () => "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(A.calendario) + "/events";

  // Días con un evento que diga "CERRADO" en el calendario de Paola
  let cacheCerrados: { desde: string; dias: string[]; vence: number } | null = null;
  async function diasCerrados(desde: string): Promise<string[]> {
    if (!A.googleCuenta || !A.calendario) return [];
    if (cacheCerrados && cacheCerrados.desde === desde && cacheCerrados.vence > Date.now()) return cacheCerrados.dias;
    const hasta = masDias(desde, 420), dias = new Set<string>();
    let pagina = "";
    for (let vuelta = 0; vuelta < 10; vuelta++) {
      const q = new URLSearchParams({ timeMin: desde + "T00:00:00-05:00", timeMax: hasta + "T00:00:00-05:00", singleEvents: "true", maxResults: "2500", q: "CERRADO", fields: "items(summary,start,end),nextPageToken" });
      if (pagina) q.set("pageToken", pagina);
      const r = await dep.fetch(urlCal() + "?" + q, { headers: { Authorization: "Bearer " + (await tokenGoogle()) } });
      if (!r.ok) throw new Error("google lista " + r.status + " " + (await r.text()).slice(0, 200));
      const j = await r.json();
      for (const ev of j.items ?? []) {
        if (!/cerrado/i.test(ev.summary ?? "")) continue;
        const ini = ev.start?.date ?? fechaCO(ev.start?.dateTime);
        // Todo el día: "end.date" es el día siguiente (no incluido). Con hora: incluye el día en que termina.
        const fin = ev.end?.date ? masDias(ev.end.date, -1) : fechaCO(ev.end?.dateTime) ?? ini;
        if (!ini) continue;
        for (let f = ini, n = 0; f <= (fin ?? ini) && n < 400; f = masDias(f, 1), n++) dias.add(f);
      }
      pagina = j.nextPageToken ?? ""; if (!pagina) break;
    }
    const lista = [...dias].sort();
    cacheCerrados = { desde, dias: lista, vence: Date.now() + 60000 };
    return lista;
  }
  const fechaCO = (iso?: string) => (iso ? hoyCO(new Date(iso)) : undefined);
  const sumarHoras = (fecha: string, hora: string, horas: number) => {
    const [y, m, d] = fecha.split("-").map(Number), [H, M] = hora.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, d, H, M) + horas * 3600000).toISOString().slice(0, 16) + ":00";
  };

  async function crearEventos(f: Fila): Promise<string[]> {
    const det = f.detalle, cfg = await almacen.config();
    const tour = cfg.tours.find((t) => t.id === f.tour);
    const ids: string[] = [];
    for (const tr of det.trayectos as Reserva["trayectos"]) {
      const nombreTr = tr.tipo === "recogida" ? "Recogida aeropuerto → hotel" : tr.tipo === "llevada" ? "Llevada hotel → aeropuerto" : "";
      const titulo = (prueba ? "[PRUEBA] " : "") + (tour?.es ?? f.tour) + (nombreTr ? " · " + nombreTr : "") + " · " + f.grupo + " pers · " + f.nombre;
      const lineas = [
        "Orden: " + f.orden,
        "Cliente: " + f.nombre, "WhatsApp: " + f.whatsapp, "Correo: " + f.correo, "Idioma: " + (f.idioma === "es" ? "español" : "inglés"),
        "Personas: " + f.grupo,
        (tr.tipo === "tour" ? "Recogida: " : "Hotel: ") + det.sitio + (det.municipio ? " (" + det.municipio + ")" : ""),
        tr.tipo === "recogida" ? "Vuelo: " + det.vuelo + " · aterriza " + tr.hora : "",
        tr.tipo === "llevada" ? "Vuelo de salida: " + det.horaVuelo + " · recoger en el hotel " + tr.hora : "",
        tr.noche ? "Incluye recargo nocturno" : "",
        "Pagado en Bold: " + plata(f.cobro_usd, f.cobro_cop) + (f.pago === "anticipo" ? " (anticipo)" : " (total)"),
        f.resto_cop ? "POR COBRAR el día: " + plata(f.resto_usd, f.resto_cop) : "Ya está pagado completo",
        prueba ? "\nRESERVA DE PRUEBA: no es un cliente real." : "",
      ].filter(Boolean);
      const horas = tr.tipo === "tour" ? (tour?.horas ?? 4) : 2;
      const r = await dep.fetch(urlCal(), {
        method: "POST",
        headers: { Authorization: "Bearer " + (await tokenGoogle()), "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: titulo, description: lineas.join("\n"),
          start: { dateTime: tr.fecha + "T" + tr.hora + ":00", timeZone: "America/Bogota" },
          end: { dateTime: sumarHoras(tr.fecha, tr.hora, horas), timeZone: "America/Bogota" },
          reminders: { useDefault: true },
        }),
      });
      if (!r.ok) throw new Error("google evento " + r.status + " " + (await r.text()).slice(0, 200));
      ids.push((await r.json()).id);
    }
    return ids;
  }

  // ---------- Correos (Resend) ----------
  async function correo(para: string, asunto: string, html: string) {
    const r = await dep.fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + A.resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: A.remitente, to: [para], subject: asunto, html }),
    });
    if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
  }
  const fechaLarga = (f: string, es: boolean) =>
    new Date(f + "T12:00:00Z").toLocaleDateString(es ? "es-CO" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  function textoCliente(f: Fila, es: boolean, cfg: Config) {
    const t = cfg.tours.find((x) => x.id === f.tour), det = f.detalle;
    const fila = (k: string, v: string) => `<tr><td style="padding:4px 10px 4px 0;color:#5b6170">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`;
    let filas = fila(es ? "Orden" : "Order", f.orden) + fila("Tour", es ? t?.es ?? f.tour : t?.en ?? f.tour) + fila(es ? "Personas" : "People", f.grupo);
    for (const tr of det.trayectos) {
      const k = tr.tipo === "recogida" ? (es ? "Recogida en el aeropuerto" : "Airport pickup") : tr.tipo === "llevada" ? (es ? "Recogida en el hotel (vuelo de salida)" : "Hotel pickup (departure flight)") : (es ? "Fecha y hora de recogida" : "Date and pickup time");
      filas += fila(k, fechaLarga(tr.fecha, es) + " · " + tr.hora + (tr.tipo === "recogida" ? " · " + det.vuelo : ""));
    }
    filas += fila(es ? "Recogida / hotel" : "Pickup / hotel", det.sitio + (det.municipio ? " (" + det.municipio + ")" : ""));
    filas += fila(es ? "Pagado ahora" : "Paid now", plata(f.cobro_usd, f.cobro_cop));
    if (f.resto_cop) filas += fila(es ? "Por pagar el día del tour" : "To pay on the tour day", plata(f.resto_usd, f.resto_cop));
    const extra = es
      ? "Las horas adicionales no están incluidas: si necesitas más tiempo, cada hora adicional se le paga a Paola el día del tour."
      : "Extra hours are not included: if you need more time, each extra hour is paid to Paola on the day of the tour.";
    return `<h3 style="color:#121e6c;margin:18px 0 6px">${es ? "¡Tu tour quedó reservado!" : "Your tour is booked!"}</h3>
      <p>${es ? "Paola te escribirá por WhatsApp para confirmar los detalles." : "Paola will message you on WhatsApp to confirm the details."}</p>
      <table style="font-size:15px;border-collapse:collapse">${filas}</table>
      <p style="font-size:14px;color:#5b6170">${extra}</p>`;
  }
  async function correosConfirmacion(f: Fila) {
    const cfg = await almacen.config(), es = f.idioma === "es";
    const wa = "https://wa.me/" + A.paolaWhatsapp;
    const marcaPrueba = prueba ? `<p style="background:#fff4d6;border:1px solid #e0b400;padding:8px;border-radius:8px"><b>TEST / PRUEBA</b> — no real charge / no se cobró nada real.</p>` : "";
    const htmlCliente = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1d1d1b">
      <h2 style="color:#121e6c;margin:0 0 4px">Medellín a un clic</h2>${marcaPrueba}
      ${textoCliente(f, es, cfg)}
      <p><a href="${wa}" style="display:inline-block;background:#1f8f4e;color:#fff;padding:10px 16px;border-radius:10px;text-decoration:none">${es ? "Escríbele a Paola por WhatsApp" : "Message Paola on WhatsApp"}</a></p>
      <hr style="border:none;border-top:1px solid #ddd;margin:20px 0">
      ${textoCliente(f, !es, cfg)}
      <p style="color:#8a857a;font-size:12px;margin-top:20px">Mokea Digital LLC · Medellín a un clic</p></div>`;
    const asuntoCliente = (prueba ? "[PRUEBA] " : "") + (es ? "Tu reserva " : "Your booking ") + f.orden;
    const errores: string[] = [];
    try { await correo(f.correo, asuntoCliente, htmlCliente); } catch (e) { errores.push("correo cliente: " + (e as Error).message); }
    if (A.paolaCorreo) {
      const t = cfg.tours.find((x) => x.id === f.tour), det = f.detalle;
      const lis = [
        ["Orden", f.orden], ["Tour", t?.es ?? f.tour], ["Personas", f.grupo],
        ...det.trayectos.map((tr: Reserva["trayectos"][number]) => [tr.tipo === "recogida" ? "Recogida aeropuerto" : tr.tipo === "llevada" ? "Recogida hotel → aeropuerto" : "Fecha y hora", fechaLarga(tr.fecha, true) + " · " + tr.hora + (tr.noche ? " (nocturno)" : "")]),
        det.vuelo ? ["Vuelo de llegada", det.vuelo] : null, det.horaVuelo ? ["Hora del vuelo de salida", det.horaVuelo] : null,
        ["Recogida / hotel", det.sitio + (det.municipio ? " (" + det.municipio + ")" : "")],
        ["Cliente", f.nombre], ["WhatsApp", f.whatsapp], ["Correo", f.correo], ["Idioma", es ? "español" : "inglés"],
        ["Pagado en Bold", plata(f.cobro_usd, f.cobro_cop) + (f.pago === "anticipo" ? " (anticipo 20 %)" : " (total)")],
        ["Por cobrar el día", f.resto_cop ? plata(f.resto_usd, f.resto_cop) : "nada, ya pagó todo"],
      ].filter(Boolean) as string[][];
      const htmlPaola = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1d1d1b">
        <h2 style="color:#121e6c;margin:0 0 4px">Nueva reserva pagada</h2>${marcaPrueba}
        <table style="font-size:15px;border-collapse:collapse">${lis.map(([k, v]) => `<tr><td style="padding:4px 10px 4px 0;color:#5b6170">${esc(k)}</td><td><b>${esc(v)}</b></td></tr>`).join("")}</table>
        <p style="font-size:14px">Ya quedó en su Google Calendar.</p></div>`;
      try { await correo(A.paolaCorreo, (prueba ? "[PRUEBA] " : "") + "Nueva reserva: " + (t?.es ?? f.tour) + " · " + f.grupo + " pers", htmlPaola); }
      catch (e) { errores.push("correo Paola: " + (e as Error).message); }
    }
    return errores;
  }

  // Lo que pasa UNA sola vez cuando se confirma el pago
  async function alPagar(f: Fila) {
    const avisos: string[] = [];
    let eventos: string[] = [];
    if (A.googleCuenta && A.calendario) {
      try { eventos = await crearEventos(f); } catch (e) { avisos.push("calendario: " + (e as Error).message); }
    } else avisos.push("calendario: sin conectar");
    avisos.push(...(await correosConfirmacion(f)));
    await almacen.actualizar(f.orden, { eventos, avisos: avisos.join(" | ") || null });
    if (avisos.length) log("alPagar avisos", f.orden, avisos.join(" | "));
  }
  async function confirmarPago(orden: string, boldId: string, montoCOP: number | null) {
    const f = await almacen.buscar(orden);
    if (!f) { log("pago de una orden desconocida", orden); return "desconocida"; }
    if (f.estado === "pagada") return "pagada";
    if (montoCOP !== null && Math.round(montoCOP) !== f.cobro_cop) {
      await almacen.actualizar(orden, { avisos: "Bold aprobó COP " + montoCOP + " pero se esperaban COP " + f.cobro_cop + ". Revisar." });
      log("monto distinto", orden, montoCOP, f.cobro_cop);
      return "revisar";
    }
    const pagada = await almacen.marcarPagada(orden, boldId);
    if (pagada) await alPagar(pagada);
    return "pagada";
  }

  // ---------- Rutas ----------
  async function precios() {
    const c = await almacen.config();
    return json({ ok: true, modo: A.modo, tasa: c.tasa, anticipo: c.anticipo, diasMinimos: c.diasMinimos, grupos: c.grupos, horaExtra: c.horaExtra,
      aeroRecargo: c.aeroRecargo, aeroMunicipios: c.aeroMunicipios, aeroSinRecargo: c.aeroSinRecargo, aeroGuatapeUSD: c.aeroGuatapeUSD,
      nocturno: c.nocturno, lucesTemporada: c.lucesTemporada, tours: c.tours.filter((t) => t.activo !== false).map((t) => ({ id: t.id, precios: t.precios })) });
  }
  async function disponibilidad(b: Fila) {
    const c = await almacen.config();
    const minimo = masDias(hoyCO(ahora()), c.diasMinimos);
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(String(b.desde)) && String(b.desde) > minimo ? String(b.desde) : minimo;
    try { return json({ ok: true, cerrados: await diasCerrados(desde) }); }
    catch (e) { log("disponibilidad", (e as Error).message); return json({ ok: false, cerrados: [] }, 502); }
  }
  async function crear(b: Fila) {
    await almacen.limpiar().catch((e) => log("limpiar", (e as Error).message));
    const cfg = await almacen.config();
    let cerrados: string[] = [];
    try { cerrados = await diasCerrados(masDias(hoyCO(ahora()), cfg.diasMinimos)); }
    catch (e) { log("crear: no se pudo leer el calendario", (e as Error).message); }
    const v = revisar(cfg, b, cerrados, ahora());
    if (!v.ok) return json({ ok: false, en: v.en, es: v.es }, 400);
    const r = v.r;
    if ((await almacen.recientesPorCorreo(r.correo)) >= 10) {
      return json({ ok: false, en: "Too many attempts today. Please message Paola on WhatsApp.", es: "Demasiados intentos hoy. Por favor escríbele a Paola por WhatsApp." }, 429);
    }
    const orden = nuevaOrden(r.tour.id, ahora().getTime());
    const borrar = new Date(r.ultimaFecha + "T12:00:00Z"); borrar.setUTCMonth(borrar.getUTCMonth() + 18);
    await almacen.insertar({
      orden, modo: A.modo, estado: "pendiente", tour: r.tour.id, grupo: r.grupo, pago: r.pago,
      nombre: r.nombre, whatsapp: r.whatsapp, correo: r.correo, idioma: r.idioma,
      detalle: { sitio: r.sitio, tramo: r.tramo ?? null, municipio: r.municipio ?? null, vuelo: r.vuelo ?? null, horaVuelo: r.horaVuelo ?? null, trayectos: r.trayectos },
      tasa: cfg.tasa, total_usd: r.totalUSD, total_cop: r.totalCOP, cobro_cop: r.cobroCOP, resto_cop: r.restoCOP, cobro_usd: r.cobroUSD, resto_usd: r.restoUSD,
      ultima_fecha: r.ultimaFecha, borrar_despues: borrar.toISOString().slice(0, 10),
    });
    const nombreTour = r.idioma === "es" ? r.tour.es : r.tour.en;
    const descripcion = (nombreTour + " · " + r.grupo + (r.idioma === "es" ? " personas" : " people") + (r.pago === "anticipo" ? (r.idioma === "es" ? " · anticipo" : " · deposit") : "")).slice(0, 100);
    return json({
      ok: true, orden, modo: A.modo, totalUSD: r.totalUSD, totalCOP: r.totalCOP, cobroUSD: r.cobroUSD, restoUSD: r.restoUSD, cobroCOP: r.cobroCOP, restoCOP: r.restoCOP,
      bold: {
        apiKey: A.boldIdentidad, orderId: orden, amount: String(r.cobroCOP), currency: "COP",
        signature: await firmaBold(orden, r.cobroCOP, "COP", A.boldSecreta),
        description: descripcion, redirectionUrl: A.appUrl.replace(/\/$/, "") + "/?reserva=" + orden,
      },
    });
  }
  async function confirmar(b: Fila) {
    const orden = String(b.orden ?? "");
    if (!ORDEN_RE.test(orden)) return json({ ok: false }, 400);
    let f = await almacen.buscar(orden);
    if (!f) return json({ ok: false, estado: "desconocida" }, 404);
    if (f.estado !== "pagada") {
      // Bold puede tardar unos minutos en mostrar la venta; la app vuelve a preguntar.
      const r = await dep.fetch("https://payments.api.bold.co/v2/payment-voucher/" + encodeURIComponent(orden), { headers: { Authorization: "x-api-key " + A.boldIdentidad } });
      if (r.ok) {
        const j = await r.json();
        const st = String(j.payment_status ?? "");
        if (st === "APPROVED") await confirmarPago(orden, String(j.transaction_id ?? ""), typeof j.total === "number" ? j.total : null);
        else if (st === "REJECTED" || st === "FAILED") await almacen.marcarRechazada(orden);
      } else log("confirmar: Bold respondió", r.status);
      f = await almacen.buscar(orden);
    }
    const estado = f!.estado === "pagada" ? "pagada" : f!.estado === "rechazada" ? "rechazada" : "pendiente";
    // Solo datos del pago; los datos personales ya los tiene el celular del cliente.
    return json({ ok: true, estado, orden, cobroUSD: Number(f!.cobro_usd), restoUSD: Number(f!.resto_usd), cobroCOP: f!.cobro_cop, restoCOP: f!.resto_cop, modo: f!.modo });
  }
  async function webhook(req: Request) {
    const crudo = new Uint8Array(await req.arrayBuffer());
    const firma = (req.headers.get("x-bold-signature") ?? "").trim().toLowerCase();
    if (!A.boldSecreta || !firma || !igualSeguro(await firmaAvisoBold(crudo, A.boldSecreta), firma)) {
      log("webhook: firma no válida");
      return json({ ok: false }, 400);
    }
    let ev: Fila; try { ev = JSON.parse(new TextDecoder().decode(crudo)); } catch { return json({ ok: false }, 400); }
    const orden = String(ev?.data?.metadata?.reference ?? "");
    const tipo = String(ev?.type ?? "");
    // Bold pide responder en menos de 2 segundos: se responde ya y se sigue trabajando por detrás.
    dep.enFondo((async () => {
      try {
        if (!ORDEN_RE.test(orden)) { log("webhook sin orden nuestra", tipo); return; }
        if (tipo === "SALE_APPROVED") await confirmarPago(orden, String(ev.data?.payment_id ?? ev.subject ?? ""), Number(ev.data?.amount?.total ?? NaN) || null);
        else if (tipo === "SALE_REJECTED") { const f = await almacen.buscar(orden); if (f && f.estado === "pendiente") await almacen.marcarRechazada(orden); }
        else if (tipo === "VOID_APPROVED") await almacen.actualizar(orden, { avisos: "Bold anuló este pago (VOID_APPROVED). Revisar con Paola." });
      } catch (e) { log("webhook trabajo", (e as Error).message); }
    })());
    return json({ ok: true });
  }

  return async function (req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
    if (req.method !== "POST") return json({ ok: false }, 405);
    const ruta = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
    try {
      if (ruta === "webhook-bold") return await webhook(req);
      let b: Fila = {};
      try { const t = await req.text(); b = t.length > 8000 ? {} : (JSON.parse(t || "{}") ?? {}); } catch { return json({ ok: false }, 400); }
      if (ruta === "precios") return await precios();
      if (ruta === "disponibilidad") return await disponibilidad(b);
      if (ruta === "crear") return await crear(b);
      if (ruta === "confirmar") return await confirmar(b);
      return json({ ok: false }, 404);
    } catch (e) {
      log("error", ruta, (e as Error).message);
      return json({ ok: false, en: "Something went wrong. Please try again or message Paola.", es: "Algo falló. Inténtalo otra vez o escríbele a Paola." }, 500);
    }
  };
}

