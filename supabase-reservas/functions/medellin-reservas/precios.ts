// Reglas de precio y validación de reservas — Mokea Digital LLC
// Es la MISMA cuenta que hace el formulario de la app (app/index.html, RESERVAS).
// El servidor no confía en el precio que manda el celular: lo vuelve a calcular aquí.

export type Tour = {
  id: string; es: string; en: string;
  precios: number[];            // US$ por grupo [1-3, 4-6, 7-10, 11-16]
  horas: number;                // duración aproximada (para el evento del calendario)
  aeropuerto?: boolean; temporada?: string | null; activo?: boolean;
};
export type Config = {
  tasa: number; anticipo: number; diasMinimos: number;
  horasMinimas?: number;        // reservar con mínimo estas horas antes de la hora de recogida (48)
  grupos: string[]; horaExtra: number[];
  aeroRecargo: number; aeroMunicipios: string[]; aeroSinRecargo: string[];
  aeroGuatapeUSD: number[];     // Aeropuerto ↔ Guatapé, US$ por trayecto
  nocturno: { desde: string; hasta: string; porcentaje: number };
  lucesTemporada: { desde: string; hasta: string };
  tours: Tour[];
};

export const aCOP = (cfg: Config, usd: number) => Math.ceil(usd * cfg.tasa / 1000) * 1000;
export const hoyCO = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
export const masDias = (f: string, n: number) => { const d = new Date(f + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const nocturna = (cfg: Config, hhmm?: string) => {
  if (!hhmm) return false; const n = cfg.nocturno;
  return n.desde > n.hasta ? (hhmm >= n.desde || hhmm < n.hasta) : (hhmm >= n.desde && hhmm < n.hasta);
};
export function ventanaLuces(cfg: Config, minimo: string) {
  const t = cfg.lucesTemporada; let y = Number(minimo.slice(0, 4)) - 1;
  for (let k = 0; k < 3; k++, y++) {
    const ini = y + "-" + t.desde, fin = (t.hasta < t.desde ? y + 1 : y) + "-" + t.hasta;
    if (fin >= minimo) return { ini: ini > minimo ? ini : minimo, fin };
  }
  return { ini: minimo, fin: minimo };
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/, CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const fechaValida = (f: string) => FECHA.test(f) && new Date(f + "T12:00:00Z").toISOString().slice(0, 10) === f;

export type Trayecto = { tipo: "tour" | "recogida" | "llevada"; fecha: string; hora: string; noche: boolean; precioUSD: number };
export type Reserva = {
  tour: Tour; grupoIdx: number; grupo: string; pago: "anticipo" | "total";
  nombre: string; whatsapp: string; correo: string; sitio: string; idioma: "en" | "es";
  tramo?: string; municipio?: string; vuelo?: string; horaVuelo?: string;
  trayectos: Trayecto[];
  totalUSD: number; totalCOP: number; cobroUSD: number; restoUSD: number; cobroCOP: number; restoCOP: number;
  ultimaFecha: string;
};

// Devuelve la reserva con su precio, o un error con el texto para el cliente (en y es).
export const MSG_48 = {
  en: "Bookings need at least 48 hours before the pickup time. For sooner, message Paola on WhatsApp.",
  es: "Las reservas son con mínimo 48 horas antes de la hora de recogida. Para antes, escríbele a Paola por WhatsApp.",
};

export function revisar(cfg: Config, d: Record<string, unknown>, cerrados: string[], ahora = new Date()):
  { ok: true; r: Reserva } | { ok: false; en: string; es: string } {
  const no = (en: string, es: string) => ({ ok: false as const, en, es });
  const tour = cfg.tours.find((t) => t.id === d.tour && t.activo !== false);
  if (!tour) return no("This tour is not available.", "Este tour no está disponible.");
  const grupoIdx = cfg.grupos.indexOf(String(d.grupo));
  if (grupoIdx < 0) return no("Please choose the group size.", "Escoge el número de personas.");
  // Aeropuerto: se paga completo al reservar. Tours: anticipo o total.
  const pago = tour.aeropuerto ? "total" : d.pago === "total" ? "total" : d.pago === "anticipo" ? "anticipo" : null;
  if (!pago) return no("Please choose how to pay.", "Escoge cómo quieres pagar.");
  const nombre = txt(d.nombre, 80), whatsapp = txt(d.whatsapp, 25), correo = txt(d.correo, 120).toLowerCase(), sitio = txt(d.sitio, 160);
  const idioma = d.idioma === "es" ? "es" : "en";
  if (sitio.length < 4) return no("Please write the pickup place or hotel address.", "Escribe el sitio de recogida o la dirección del hotel.");
  if (nombre.length < 3) return no("Please write your full name.", "Escribe tu nombre completo.");
  if (whatsapp.replace(/\D/g, "").length < 8) return no("Please write your WhatsApp number with the country code.", "Escribe tu WhatsApp con el código del país.");
  if (!CORREO.test(correo)) return no("Please write a valid email.", "Escribe un correo válido.");

  const minimo = masDias(hoyCO(ahora), cfg.diasMinimos);
  const fechaOk = (f: string) => {
    if (!fechaValida(f)) return no("Please check the date.", "Revisa la fecha.");
    if (f < minimo) return no(MSG_48.en, MSG_48.es);
    if (f > masDias(minimo, 400)) return no("Please choose a closer date.", "Escoge una fecha más cercana.");
    if (cerrados.includes(f)) return no("Paola is not available on that date. Please choose another date.", "Paola no tiene disponibilidad ese día. Por favor escoge otra fecha.");
    return null;
  };

  const trayectos: Trayecto[] = [];
  let tramo: string | undefined, municipio: string | undefined, vuelo: string | undefined, horaVuelo: string | undefined;
  if (tour.aeropuerto) {
    tramo = ["recogida", "llevada", "ida-regreso"].includes(String(d.tramo)) ? String(d.tramo) : "";
    if (!tramo) return no("Please choose the trip.", "Escoge el trayecto.");
    municipio = String(d.municipio ?? "");
    const zonas = ["Medellín", ...cfg.aeroSinRecargo, ...cfg.aeroMunicipios, "Guatapé"];
    if (!zonas.includes(municipio)) return no("For that place, message Paola on WhatsApp and she’ll give you a price.", "Para ese lugar, escríbele a Paola por WhatsApp y te cotiza el trayecto.");
    const base = municipio === "Guatapé" ? cfg.aeroGuatapeUSD[grupoIdx]
      : tour.precios[grupoIdx] + (cfg.aeroMunicipios.includes(municipio) ? cfg.aeroRecargo : 0);
    const precio = (noche: boolean) => noche ? Math.round(base * (1 + cfg.nocturno.porcentaje / 100) * 100) / 100 : base;
    if (tramo !== "llevada") {
      const f = String(d.fechaLlegada ?? ""), h = String(d.horaLlegada ?? ""); vuelo = txt(d.vuelo, 12).toUpperCase();
      if (!f || !HORA.test(h) || vuelo.length < 3) return no("Please add your arrival date, landing time and flight number.", "Escribe la fecha, la hora de llegada y el número de vuelo.");
      const e = fechaOk(f); if (e) return e;
      const noche = nocturna(cfg, h); trayectos.push({ tipo: "recogida", fecha: f, hora: h, noche, precioUSD: precio(noche) });
    }
    if (tramo !== "recogida") {
      const f = String(d.fechaSalida ?? ""), h = String(d.horaRecogidaHotel ?? ""); horaVuelo = String(d.horaVuelo ?? "");
      if (!f || !HORA.test(h) || !HORA.test(horaVuelo)) return no("Please add your departure date, flight time and pickup time at your hotel.", "Escribe la fecha, la hora de tu vuelo y la hora de recogida en el hotel.");
      const e = fechaOk(f); if (e) return e;
      const noche = nocturna(cfg, h); trayectos.push({ tipo: "llevada", fecha: f, hora: h, noche, precioUSD: precio(noche) });
    }
    if (trayectos.length === 2 && trayectos[1].fecha < trayectos[0].fecha) return no("Your departure date must be after your arrival.", "La fecha de salida debe ser después de la llegada.");
  } else {
    const f = String(d.fecha ?? ""), h = String(d.hora ?? "");
    if (!f || !HORA.test(h)) return no("Please choose the date and pickup time.", "Escoge la fecha y la hora de recogida.");
    const e = fechaOk(f); if (e) return e;
    if (tour.temporada === "luces") {
      const v = ventanaLuces(cfg, minimo);
      if (f < v.ini || f > v.fin) return no("The Christmas Lights Tour can only be booked during the lights season.", "El Tour de Luces solo se puede reservar en la temporada de alumbrados.");
    }
    trayectos.push({ tipo: "tour", fecha: f, hora: h, noche: false, precioUSD: tour.precios[grupoIdx] });
  }
  // Mínimo 48 horas antes de la hora de recogida (hora de Colombia, UTC-5)
  const horas = cfg.horasMinimas ?? 48;
  for (const t of trayectos) {
    if (Date.parse(t.fecha + "T" + t.hora + ":00-05:00") - ahora.getTime() < horas * 3600_000) return no(MSG_48.en, MSG_48.es);
  }
  const totalUSD = Math.round(trayectos.reduce((s, t) => s + t.precioUSD, 0) * 100) / 100;
  const totalCOP = aCOP(cfg, totalUSD), anticipoCOP = aCOP(cfg, totalUSD * cfg.anticipo);
  const cobroCOP = pago === "total" ? totalCOP : anticipoCOP;
  const cobroUSD = pago === "total" ? totalUSD : Math.round(totalUSD * cfg.anticipo * 100) / 100;
  return {
    ok: true,
    r: {
      tour, grupoIdx, grupo: cfg.grupos[grupoIdx], pago, nombre, whatsapp, correo, sitio, idioma,
      tramo, municipio, vuelo, horaVuelo, trayectos, totalUSD, totalCOP, cobroUSD, restoUSD: Math.round((totalUSD - cobroUSD) * 100) / 100, cobroCOP,
      restoCOP: totalCOP - cobroCOP, ultimaFecha: trayectos.map((t) => t.fecha).sort().pop()!,
    },
  };
}

// Identificador de la venta para Bold: letras, números y guiones, máximo 60.
export function nuevaOrden(tourId: string, ahora = Date.now()) {
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(3))).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return ("MDE-" + tourId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) + "-" + ahora.toString(36).toUpperCase() + "-" + azar).slice(0, 60);
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
// Firma de integridad de Bold: SHA256 de {orden}{monto}{divisa}{llave secreta}
export async function firmaBold(orden: string, monto: number, divisa: string, secreta: string) {
  return hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(orden + monto + divisa + secreta)));
}
// Firma del aviso (webhook) de Bold: HMAC-SHA256 en hexadecimal del cuerpo pasado a Base64
export async function firmaAvisoBold(cuerpo: Uint8Array, secreta: string) {
  let bin = ""; for (const b of cuerpo) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreta), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(b64)));
}
export function igualSeguro(a: string, b: string) {
  if (a.length !== b.length) return false; let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
