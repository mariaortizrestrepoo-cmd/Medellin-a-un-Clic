// Prueba de la función medellin-reservas SIN internet: Bold, Google, Resend y la base de datos son de mentira.
// Correr:  deno run --allow-read pruebas/prueba-funcion.ts
import { crearManejador, type Almacen, type Fila } from "../functions/medellin-reservas/logica.ts";
import { type Config, firmaAvisoBold, firmaBold, masDias, hoyCO, revisar } from "../functions/medellin-reservas/precios.ts";

let fallas = 0, pasan = 0;
const ok = (c: unknown, nombre: string) => { if (c) pasan++; else { fallas++; console.log("  FALLA:", nombre); } };

// ---- Configuración igual a setup-reservas.sql ----
const T = (id: string, es: string, p: number[], horas: number, extra: Record<string, unknown> = {}) => ({ id, es, en: es, precios: p, horas, activo: true, ...extra });
const CFG: Config = {
  tasa: 3461, anticipo: 0.2, diasMinimos: 2, grupos: ["1-3", "4-6", "7-10", "11-16"], horaExtra: [30, 30, 35, 40],
  aeroRecargo: 10, aeroMunicipios: ["Bello", "Copacabana", "Girardota", "Barbosa", "Itagüí", "Envigado", "Sabaneta", "La Estrella", "Caldas"],
  aeroSinRecargo: ["Rionegro", "Llanogrande", "La Ceja"], aeroGuatapeUSD: [115, 140, 170, 190],
  nocturno: { desde: "22:00", hasta: "04:00", porcentaje: 15 }, lucesTemporada: { desde: "12-01", hasta: "01-10" },
  tours: [
    T("aeropuerto", "Aeropuerto", [60, 65, 80, 115], 2, { aeropuerto: true }), T("city", "City Tour", [95, 105, 120, 135], 5),
    T("comuna13", "Comuna 13", [95, 105, 120, 135], 4), T("flores", "Tour de Flores (Santa Elena)", [95, 105, 120, 135], 5),
    T("luces", "Tour de Luces", [95, 105, 120, 135], 4, { temporada: "luces" }), T("tequendamita", "Tequendamita", [100, 115, 125, 150], 5),
    T("sanfelix", "San Félix", [125, 140, 170, 210], 5), T("cuatrimotos", "Cuatrimotos", [175, 215, 260, 285], 5),
    T("guatape", "Guatapé y El Peñol", [230, 275, 295, 320], 10), T("rioclaro", "Río Claro", [315, 385, 435, 490], 12),
    T("napoles", "Hacienda Nápoles", [490, 590, 660, 835], 14),
  ],
};

// ---- Base de datos en memoria ----
const filas = new Map<string, Fila>();
const almacen: Almacen = {
  config: async () => CFG,
  insertar: async (f) => { filas.set(f.orden, { creada: new Date().toISOString(), eventos: [], avisos: null, ...structuredClone(f) }); },
  buscar: async (o) => (filas.has(o) ? structuredClone(filas.get(o)!) : null),
  marcarPagada: async (o, id) => { const f = filas.get(o); if (!f || f.estado === "pagada") return null; Object.assign(f, { estado: "pagada", bold_id: id, pagada_en: new Date().toISOString() }); return structuredClone(f); },
  marcarRechazada: async (o) => { const f = filas.get(o); if (f && f.estado === "pendiente") f.estado = "rechazada"; },
  actualizar: async (o, c) => { const f = filas.get(o); if (f) Object.assign(f, c); },
  recientesPorCorreo: async (c) => [...filas.values()].filter((f) => f.correo === c).length,
  limpiar: async () => {},
};

// ---- Servicios de mentira ----
const par = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", par.privateKey));
const pem = "-----BEGIN PRIVATE KEY-----\n" + btoa(String.fromCharCode(...pkcs8)).replace(/(.{64})/g, "$1\n") + "\n-----END PRIVATE KEY-----\n";
const SECRETA = "llave-secreta-DE-PRUEBA-123", IDENTIDAD = "llave-identidad-DE-PRUEBA";
const enviados: Fila[] = [], eventos: Fila[] = [];
let tokensPedidos = 0, voucher: Fila = { payment_status: "NO_TRANSACTION_FOUND" };
const cerradosCal: Fila[] = [];
const resp = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
const falso: typeof fetch = async (u, init) => {
  const url = String(u), h = new Headers(init?.headers);
  if (url === "https://oauth2.googleapis.com/token") {
    tokensPedidos++;
    const jwt = new URLSearchParams(String(init!.body)).get("assertion")!.split(".");
    const des = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
    const valida = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", par.publicKey, des(jwt[2]), new TextEncoder().encode(jwt[0] + "." + jwt[1]));
    const claims = JSON.parse(new TextDecoder().decode(des(jwt[1])));
    if (!valida || claims.iss !== "reservas@proyecto.iam.gserviceaccount.com" || !/calendar\.events/.test(claims.scope)) return resp({ error: "invalid_grant" }, 400);
    return resp({ access_token: "tok-google", expires_in: 3600 });
  }
  if (url.startsWith("https://www.googleapis.com/calendar/v3/calendars/paola%40gmail.com/events")) {
    if (h.get("authorization") !== "Bearer tok-google") return resp({}, 401);
    if (init?.method === "POST") { const ev = JSON.parse(String(init.body)); eventos.push(ev); return resp({ id: "ev" + eventos.length }); }
    return resp({ items: cerradosCal });
  }
  if (url === "https://api.resend.com/emails") { enviados.push(JSON.parse(String(init!.body))); return resp({ id: "m" }); }
  if (url.startsWith("https://payments.api.bold.co/v2/payment-voucher/")) {
    if (h.get("authorization") !== "x-api-key " + IDENTIDAD) return resp({}, 401);
    return resp(voucher);
  }
  throw new Error("fetch inesperado " + url);
};
const pendientes: Promise<unknown>[] = [];
const ajustes = {
  modo: "prueba" as const, boldIdentidad: IDENTIDAD, boldSecreta: SECRETA,
  googleCuenta: { client_email: "reservas@proyecto.iam.gserviceaccount.com", private_key: pem },
  calendario: "paola@gmail.com", paolaCorreo: "paola@gmail.com", paolaWhatsapp: "573194635142",
  resendKey: "re_prueba", remitente: "Medellín a un clic <reservas@acceso.mokeadigital.com>", appUrl: "https://medellin.mokeadigital.com",
};
const logs: string[] = [];
const app = crearManejador({ almacen, ajustes, fetch: falso, enFondo: (p) => pendientes.push(p), log: (...a) => logs.push(a.join(" ")) });
const post = async (ruta: string, cuerpo: unknown, headers: Record<string, string> = {}) => {
  const r = await app(new Request("https://x.supabase.co/functions/v1/medellin-reservas/" + ruta, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo) }));
  return { s: r.status, j: await r.json() };
};
const esperar = async () => { await Promise.all(pendientes.splice(0)); };

const hoy = hoyCO(), min = masDias(hoy, 2);
const base = { grupo: "4-6", pago: "anticipo", nombre: "Ana Prueba", whatsapp: "+1 555 123 4567", correo: "ana@ejemplo.com", sitio: "Hotel Prueba, El Poblado", idioma: "es" };

console.log("1. Firma de integridad de Bold (SHA256 de orden+monto+divisa+llave)");
{
  const esperado = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("inv033439400COPkgfq2nN0o52XqnuXZWIN2F")))).map((b) => b.toString(16).padStart(2, "0")).join("");
  ok(await firmaBold("inv0334", 39400, "COP", "kgfq2nN0o52XqnuXZWIN2F") === esperado, "hash del ejemplo de Bold");
  ok(!!Deno.args[0] && esperado === Deno.args[0], "hash igual al de Python");
}

console.log("2. Reglas de precio");
{
  const c = (d: Fila) => revisar(CFG, { ...base, ...d }, []);
  let r: any = c({ tour: "guatape", fecha: min, hora: "06:00" });
  ok(r.ok && r.r.totalUSD === 275 && r.r.totalCOP === 952000 && r.r.cobroCOP === 191000 && r.r.restoCOP === 761000, "Guatapé 4-6 anticipo");
  r = c({ tour: "guatape", fecha: min, hora: "06:00", pago: "total" });
  ok(r.ok && r.r.cobroCOP === 952000 && r.r.restoCOP === 0, "Guatapé total");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "recogida", municipio: "Medellín", fechaLlegada: min, horaLlegada: "15:00", vuelo: "av123" });
  ok(r.ok && r.r.totalUSD === 60 && r.r.trayectos.length === 1 && r.r.vuelo === "AV123", "aeropuerto recogida Medellín");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "ida-regreso", municipio: "Envigado", fechaLlegada: min, horaLlegada: "23:30", vuelo: "AV1", fechaSalida: masDias(min, 5), horaVuelo: "09:00", horaRecogidaHotel: "05:30" });
  ok(r.ok && r.r.totalUSD === 70 * 1.15 + 70 && r.r.trayectos[0].noche && !r.r.trayectos[1].noche, "ida y regreso Envigado con una noche");
  r = c({ tour: "aeropuerto", grupo: "7-10", tramo: "llevada", municipio: "Guatapé", fechaSalida: min, horaVuelo: "12:00", horaRecogidaHotel: "07:00" });
  ok(r.ok && r.r.totalUSD === 170 && r.r.totalCOP === 589000 && r.r.cobroCOP === 118000, "aeropuerto Guatapé US$170 → COP 589.000, anticipo 118.000");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "ida-regreso", municipio: "Guatapé", fechaLlegada: min, horaLlegada: "23:00", vuelo: "AV1", fechaSalida: masDias(min, 2), horaVuelo: "12:00", horaRecogidaHotel: "08:00" });
  ok(r.ok && r.r.totalUSD === 115 * 1.15 + 115, "Guatapé ida y regreso = doble, nocturno solo en la recogida");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "recogida", municipio: "Rionegro", fechaLlegada: min, horaLlegada: "03:59", vuelo: "AV1" });
  ok(r.ok && r.r.totalUSD === 69, "Rionegro sin recargo, 03:59 nocturno");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "recogida", municipio: "Rionegro", fechaLlegada: min, horaLlegada: "04:00", vuelo: "AV1" });
  ok(r.ok && r.r.totalUSD === 60, "04:00 ya no es nocturno");
  r = c({ tour: "aeropuerto", grupo: "1-3", tramo: "recogida", municipio: "El Retiro", fechaLlegada: min, horaLlegada: "12:00", vuelo: "AV1" });
  ok(!r.ok, "El Retiro va a WhatsApp");
  ok(!c({ tour: "city", fecha: masDias(hoy, 1), hora: "09:00" }).ok, "menos de 2 días: no");
  ok(!revisar(CFG, { ...base, tour: "city", fecha: min, hora: "09:00" }, [min]).ok, "día CERRADO: no");
  ok(!c({ tour: "city", fecha: "2027-02-30", hora: "09:00" }).ok, "fecha imposible: no");
  ok(!c({ tour: "city", fecha: min, hora: "25:00" }).ok, "hora imposible: no");
  ok(!c({ tour: "inventado", fecha: min, hora: "09:00" }).ok, "tour que no existe: no");
  ok(!c({ tour: "city", grupo: "20", fecha: min, hora: "09:00" }).ok, "grupo que no existe: no");
  ok(!c({ tour: "city", fecha: min, hora: "09:00", correo: "malo" }).ok, "correo malo: no");
  r = c({ tour: "city", fecha: min, hora: "09:00", precio: 1, totalCOP: 1000, cobroCOP: 1000 });
  ok(r.ok && r.r.totalCOP === 364000 && r.r.cobroCOP === 73000, "el precio que manda el celular se ignora");
  // Tour de Luces: el 15 de marzo no; el 20 de diciembre sí (con "hoy" = 1 de marzo de 2027)
  const marzo = new Date("2027-03-01T15:00:00Z");
  ok(!revisar(CFG, { ...base, tour: "luces", fecha: "2027-03-15", hora: "18:00" }, [], marzo).ok, "Luces fuera de temporada: no");
  ok(revisar(CFG, { ...base, tour: "luces", fecha: "2027-12-20", hora: "18:00" }, [], marzo).ok, "Luces en temporada: sí");
  ok(revisar(CFG, { ...base, tour: "luces", fecha: "2028-01-10", hora: "18:00" }, [], marzo).ok, "Luces 10 de enero: sí");
  ok(!revisar(CFG, { ...base, tour: "luces", fecha: "2028-01-11", hora: "18:00" }, [], marzo).ok, "Luces 11 de enero: no");
  r = c({ tour: "aeropuerto", tramo: "ida-regreso", municipio: "Medellín", fechaLlegada: masDias(min, 3), horaLlegada: "10:00", vuelo: "AV1", fechaSalida: min, horaVuelo: "09:00", horaRecogidaHotel: "06:00" });
  ok(!r.ok, "salida antes de la llegada: no");
}

console.log("3. Días CERRADO desde el calendario");
{
  cerradosCal.push({ summary: "CERRADO", start: { date: masDias(min, 3) }, end: { date: masDias(min, 5) } });       // 2 días
  cerradosCal.push({ summary: "cerrado - viaje", start: { dateTime: masDias(min, 9) + "T08:00:00-05:00" }, end: { dateTime: masDias(min, 9) + "T18:00:00-05:00" } });
  cerradosCal.push({ summary: "Cita médica (no cerrado)", start: { date: masDias(min, 12) }, end: { date: masDias(min, 13) } }); // dice "cerrado" → también cuenta
  cerradosCal.push({ summary: "Reunión", start: { date: masDias(min, 14) }, end: { date: masDias(min, 15) } });
  const { s, j } = await post("disponibilidad", { desde: min });
  ok(s === 200 && JSON.stringify(j.cerrados) === JSON.stringify([masDias(min, 3), masDias(min, 4), masDias(min, 9), masDias(min, 12)]), "lista de días: " + JSON.stringify(j.cerrados));
  const r = await post("crear", { ...base, tour: "city", fecha: masDias(min, 4), hora: "09:00" });
  ok(r.s === 400 && /disponibilidad/.test(r.j.es), "crear en día CERRADO: no");
}

console.log("4. Reserva normal: crear → Bold avisa → calendario y correos");
let orden1 = "";
{
  const { s, j } = await post("crear", { ...base, tour: "guatape", fecha: masDias(min, 1), hora: "06:00", totalCOP: 1000 });
  orden1 = j.orden;
  ok(s === 200 && j.ok && /^MDE-GUATAPE-[A-Z0-9]+-[A-F0-9]{6}$/.test(j.orden) && j.orden.length <= 60, "orden: " + j.orden);
  ok(j.cobroCOP === 191000 && j.bold.amount === "191000" && j.bold.currency === "COP" && j.bold.apiKey === IDENTIDAD, "datos para Bold");
  ok(j.bold.signature === await firmaBold(j.orden, 191000, "COP", SECRETA), "firma de integridad correcta");
  ok(!JSON.stringify(j).includes(SECRETA), "la llave secreta NUNCA sale hacia el celular");
  ok(j.bold.redirectionUrl === "https://medellin.mokeadigital.com/?reserva=" + j.orden, "regresa a la app");
  ok(j.bold.description.length >= 2 && j.bold.description.length <= 100 && !/https?:/.test(j.bold.description), "descripción válida: " + j.bold.description);
  ok(filas.get(j.orden)!.estado === "pendiente" && filas.get(j.orden)!.borrar_despues === (() => { const d = new Date(masDias(min, 1) + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 18); return d.toISOString().slice(0, 10); })(), "guardada pendiente, se borra en 1,5 años");

  const aviso = JSON.stringify({ id: "u1", type: "SALE_APPROVED", subject: "TX1", data: { payment_id: "TX1", amount: { currency: "COP", total: 191000 }, metadata: { reference: j.orden }, payment_method: "CARD_WEB" } });
  const malo = await post("webhook-bold", aviso, { "x-bold-signature": "0".repeat(64) });
  ok(malo.s === 400 && filas.get(j.orden)!.estado === "pendiente", "aviso con firma falsa: rechazado");
  const sinFirma = await post("webhook-bold", aviso);
  ok(sinFirma.s === 400, "aviso sin firma: rechazado");
  const firma = await firmaAvisoBold(new TextEncoder().encode(aviso), SECRETA);
  const fijo = '{"type":"SALE_APPROVED","data":{"metadata":{"reference":"MDE-X"}},"nota":"Guatapé ñ"}';
  ok(!!Deno.args[1] && (await firmaAvisoBold(new TextEncoder().encode(fijo), "kgfq2nN0o52XqnuXZWIN2F")) === Deno.args[1], "firma del aviso igual a la del código de ejemplo de Bold (Python)");
  const t0 = performance.now();
  const bueno = await post("webhook-bold", aviso, { "x-bold-signature": firma });
  ok(bueno.s === 200 && performance.now() - t0 < 2000, "aviso bueno: responde 200 enseguida");
  await esperar();
  const f = filas.get(j.orden)!;
  ok(f.estado === "pagada" && f.bold_id === "TX1", "reserva pagada");
  ok(eventos.length === 1 && eventos[0].summary.startsWith("[PRUEBA] Guatapé y El Peñol · 4-6 pers · Ana Prueba"), "evento en el calendario: " + eventos[0]?.summary);
  ok(eventos[0].start.dateTime === masDias(min, 1) + "T06:00:00" && eventos[0].end.dateTime === masDias(min, 1) + "T16:00:00" && eventos[0].start.timeZone === "America/Bogota", "hora del evento (6:00 a 16:00, Bogotá)");
  ok(/POR COBRAR el día: COP 761\.000/.test(eventos[0].description) && /\+1 555 123 4567/.test(eventos[0].description), "el evento dice cuánto cobrar y el WhatsApp");
  ok(enviados.length === 2 && enviados[0].to[0] === "ana@ejemplo.com" && enviados[1].to[0] === "paola@gmail.com", "2 correos: cliente y Paola");
  ok(/\[PRUEBA\]/.test(enviados[0].subject) && /¡Tu tour quedó reservado!/.test(enviados[0].html) && /Your tour is booked!/.test(enviados[0].html), "correo del cliente en español e inglés");
  ok(/761\.000/.test(enviados[1].html) && /Nueva reserva pagada/.test(enviados[1].html), "correo de Paola con lo que falta por cobrar");
  ok(f.eventos.length === 1 && !f.avisos, "sin avisos de error");

  // Bold reintenta el mismo aviso y además la app pregunta: no se duplica nada
  await post("webhook-bold", aviso, { "x-bold-signature": firma }); await esperar();
  voucher = { payment_status: "APPROVED", transaction_id: "TX1", total: 191000 };
  const c = await post("confirmar", { orden: j.orden });
  ok(c.j.estado === "pagada" && eventos.length === 1 && enviados.length === 2, "aviso repetido + confirmar: no duplica eventos ni correos");
  ok(!JSON.stringify(c.j).includes("ana@") && !JSON.stringify(c.j).includes("Ana"), "confirmar no devuelve datos personales");
}

console.log("5. Ida y regreso al aeropuerto: 2 eventos; confirmado por la app (sin webhook, como en pruebas de Bold)");
{
  const { j } = await post("crear", { ...base, idioma: "en", pago: "total", grupo: "1-3", tour: "aeropuerto", tramo: "ida-regreso", municipio: "Sabaneta", fechaLlegada: min, horaLlegada: "22:15", vuelo: "UA1234", fechaSalida: masDias(min, 6), horaVuelo: "14:00", horaRecogidaHotel: "10:30" });
  ok(j.ok && j.totalUSD === 70 * 1.15 + 70 && j.cobroCOP === Math.ceil((80.5 + 70) * 3461 / 1000) * 1000, "precio ida y regreso: US$" + j.totalUSD + " COP " + j.cobroCOP);
  voucher = { payment_status: "NO_TRANSACTION_FOUND" };
  let c = await post("confirmar", { orden: j.orden });
  ok(c.j.estado === "pendiente", "Bold todavía no la tiene: pendiente");
  voucher = { payment_status: "APPROVED", transaction_id: "TX2", total: j.cobroCOP };
  c = await post("confirmar", { orden: j.orden });
  ok(c.j.estado === "pagada" && c.j.cobroCOP === j.cobroCOP && c.j.restoCOP === 0, "confirmada por la app");
  ok(eventos.length === 3 && /Recogida aeropuerto → hotel/.test(eventos[1].summary) && /Llevada hotel → aeropuerto/.test(eventos[2].summary), "2 eventos nuevos");
  ok(eventos[1].start.dateTime === min + "T22:15:00" && eventos[1].end.dateTime === masDias(min, 1) + "T00:15:00", "evento que pasa la medianoche");
  ok(/UA1234/.test(eventos[1].description) && /nocturno/.test(eventos[1].description) && /Ya está pagado completo/.test(eventos[2].description), "detalle de los eventos");
  ok(enviados.length === 4 && /^\[PRUEBA\] Your booking/.test(enviados[2].subject) && enviados[2].html.indexOf("Your tour is booked!") < enviados[2].html.indexOf("¡Tu tour quedó reservado!"), "correo en inglés primero");
}

console.log("6. Pagos rechazados, montos raros y entradas malas");
{
  let { j } = await post("crear", { ...base, tour: "city", fecha: masDias(min, 2), hora: "09:00" });
  const rech = JSON.stringify({ type: "SALE_REJECTED", data: { payment_id: "TX3", amount: { total: j.cobroCOP }, metadata: { reference: j.orden } } });
  await post("webhook-bold", rech, { "x-bold-signature": await firmaAvisoBold(new TextEncoder().encode(rech), SECRETA) }); await esperar();
  ok(filas.get(j.orden)!.estado === "rechazada" && eventos.length === 3, "rechazado: sin evento");
  // el cliente reintenta en el mismo pago y esta vez se aprueba
  const apr = JSON.stringify({ type: "SALE_APPROVED", data: { payment_id: "TX4", amount: { total: j.cobroCOP }, metadata: { reference: j.orden } } });
  await post("webhook-bold", apr, { "x-bold-signature": await firmaAvisoBold(new TextEncoder().encode(apr), SECRETA) }); await esperar();
  ok(filas.get(j.orden)!.estado === "pagada" && eventos.length === 4, "rechazado y luego aprobado: queda pagada");

  ({ j } = await post("crear", { ...base, tour: "napoles", fecha: masDias(min, 2), hora: "05:00" }));
  const raro = JSON.stringify({ type: "SALE_APPROVED", data: { payment_id: "TX5", amount: { total: 1000 }, metadata: { reference: j.orden } } });
  await post("webhook-bold", raro, { "x-bold-signature": await firmaAvisoBold(new TextEncoder().encode(raro), SECRETA) }); await esperar();
  ok(filas.get(j.orden)!.estado === "pendiente" && /Revisar/.test(filas.get(j.orden)!.avisos) && eventos.length === 4, "monto distinto: no se confirma y queda aviso");

  ok((await post("confirmar", { orden: "'; drop table" })).s === 400, "orden con caracteres raros: no");
  ok((await post("confirmar", { orden: "MDE-NOEXISTE-123" })).s === 404, "orden que no existe");
  ok((await post("crear", "esto no es json")).s === 400, "cuerpo que no es JSON");
  ok((await post("nada", {})).s === 404, "ruta que no existe");
  const r = await app(new Request("https://x/functions/v1/medellin-reservas/precios", { method: "OPTIONS" }));
  ok(r.status === 200 && r.headers.get("access-control-allow-origin") === "*", "CORS para la app");
  const p = await post("precios", {});
  ok(p.j.tasa === 3461 && p.j.tours.length === 11 && !JSON.stringify(p.j).includes(SECRETA), "precios públicos sin llaves");
  // límite de intentos por correo
  for (let i = 0; i < 12; i++) await post("crear", { ...base, correo: "spam@ejemplo.com", tour: "city", fecha: masDias(min, 2), hora: "09:00" });
  ok((await post("crear", { ...base, correo: "spam@ejemplo.com", tour: "city", fecha: masDias(min, 2), hora: "09:00" })).s === 429, "más de 10 intentos al día: frena");
  ok(tokensPedidos === 1, "el permiso de Google se reutiliza (" + tokensPedidos + " pedido)");
}

console.log("7. Si Google o el correo fallan, la reserva igual queda pagada y con aviso");
{
  const app2 = crearManejador({ almacen, ajustes: { ...ajustes, googleCuenta: null }, fetch: async (u, i) => (String(u).includes("resend") ? new Response("caído", { status: 500 }) : falso(u, i)), enFondo: (p) => pendientes.push(p), log: () => {} });
  const r = await app2(new Request("https://x/f/crear", { method: "POST", body: JSON.stringify({ ...base, tour: "comuna13", fecha: masDias(min, 2), hora: "10:00" }) }));
  const j = await r.json();
  const apr = JSON.stringify({ type: "SALE_APPROVED", data: { payment_id: "TX9", amount: { total: j.cobroCOP }, metadata: { reference: j.orden } } });
  await app2(new Request("https://x/f/webhook-bold", { method: "POST", headers: { "x-bold-signature": await firmaAvisoBold(new TextEncoder().encode(apr), SECRETA) }, body: apr })); await esperar();
  const f = filas.get(j.orden)!;
  ok(f.estado === "pagada" && /calendario: sin conectar/.test(f.avisos) && /correo cliente: resend 500/.test(f.avisos), "aviso: " + f.avisos);
}

console.log(`\n${pasan} pruebas bien, ${fallas} con falla`);
if (fallas) Deno.exit(1);
