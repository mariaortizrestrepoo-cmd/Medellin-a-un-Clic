# Medellín a un clic — instrucciones para Claude Code

App turística de Medellín (PWA) de **Mokea Digital LLC**. Dueña: **María Ortiz** (info@mokeadigital.com).
Objetivo de esta etapa: **publicar la app en Google Play** (y después en la App Store de Apple).

## Cómo trabajar con María (obligatorio)

- Hablarle **siempre en español**, de "usted", con pasos cortos, **uno a la vez**. No es programadora.
- **Nada se publica sin su aprobación.** Mostrar primero una imagen o vista previa.
- **Validar todo antes de entregarlo** (que abra, que no tenga errores). No decir que algo funciona sin comprobarlo.
- Los textos para el turista van en **inglés y español**; María revisa en español.
- **Nunca pedir ni mostrar contraseñas, tarjetas ni llaves secretas en el chat.** Ella las escribe directo en cada servicio.
- Aliados: **no** poner el logo ni el nombre "Transportes R.T". Sí el nombre y la foto de **Paola Tobón**.
- No usar el celular personal de María en la app. Su WhatsApp de empresa es +1 689 323 6560.

## Estructura

```
app/                      Código fuente de la app (HTML/CSS/JS en un solo index.html, sin framework)
  index.html              Toda la app (42 "páginas" <section class="page" id="...">), textos EN/ES
  sw.js                   Service worker. Subir VERSION en cada cambio.
  manifest.json           Manifiesto PWA (nombre, iconos, colores)
  privacidad.html, terminos.html
  img/                    Fotos (creadas con IA; la app lo indica en el pie)
herramientas-candado/     Arma la versión con candado (contenido cifrado) para Netlify
  prep.py                 Copia app/index.html a src/index.src.html y pone las marcas del candado
  build.mjs               Cifra el contenido (AES-GCM) y arma dist/
  src/lock.*              Pantalla de candado (correo + código)
  supabase/               Función medellin-access (Deno) y tabla mde_buyers (referencia)
  qa-revision.py          Revisión automática (Playwright) de las páginas
```

## Cómo se arma y publica la web (Netlify)

```bash
cd herramientas-candado
python3 prep.py
node build.mjs "https://kipooidlqcvivpngtebr.supabase.co/functions/v1/medellin-access" \
               "https://apps.mokeadigital.com/medellin" "$CONTENT_KEY"
# dist/ se comprime en .zip y María lo arrastra en Netlify → proyecto medellin-mokea → Deploys
```

- `CONTENT_KEY` es **secreta**. Está guardada en Supabase (proyecto "medellin a un click" → Edge Functions → Secrets → `CONTENT_KEY`). Debe ser **la misma** que usa la función; si se cambia, hay que cambiarla en los dos lados.
- Dominio: https://medellin.mokeadigital.com · Pago: Systeme.io (https://apps.mokeadigital.com/medellin, US$19.99).
- Acceso: tabla `mde_buyers` en Supabase. Acceso de cortesía = insertar el correo.
- `/welcome` redirige al pago (es el QR impreso en la hoja del carro; **no cambiar esa ruta**).
- Verificar en vivo: `https://medellin.mokeadigital.com/sw.js` debe mostrar la VERSION nueva.

## Versión actual

`medellin-lock-1795281462731` (sw.js de la app: `medellin-v149`), en vivo desde el 21 nov 2026.
Subida por María a Netlify y revisada en vivo por Claude del chat.

Cambios de la v149 (sobre la v147):
- **Candado rediseñado** con el estilo de la app: Plus Jakarta Sans, azul noche #0B1626 y dorado, ícono arriba,
  sin cursiva, sin "¡Qué chimba, parce!", sin emojis ni flechas, tarjeta crema con letra oscura y grande,
  botones que no se salen en celulares pequeños (probado a 320 px). El diseño del candado vive **solo** en
  `herramientas-candado/src/lock.css` (se quitaron las reglas `#lock` viejas de `app/index.html`).
- **Modo tienda (Google Play):** si la app se abre con `?fuente=play` (o desde el paquete `com.mokeadigital.medellin`),
  se guarda `mde-tienda=1` en el celular y se ocultan los enlaces de compra, el consejo de instalación y el botón
  "Instalar la app" (clases `solo-web` / `solo-tienda`). En la web no cambia nada. Los botones de tours con Paola se quedan.
- Se quitaron las letras **Great Vibes** y **Pacifico**, que ya no usaba ninguna página.
- `build.mjs` copia `app/.well-known/assetlinks.json` a `dist/.well-known/` **si existe** (lo revisa antes de tocar `dist/`).

La app incluye: diseño premium oscuro, portada nueva (celular y computador), fotos en vez de emojis, buscador,
favoritos, "Úsala sin internet", botón "Instalar la app", **SOS / Emergencias** (123, 911, Embajada EE. UU.,
enviar ubicación), **Cerca de mí** (geolocalización, solo en el dispositivo), **Tours con Paola** (WhatsApp
+57 319 463 5142 con mensaje prellenado), **Frases útiles con audio** (Web Speech API, solo en inglés),
**Quiénes somos** con María y Paola, vehículos, Política de privacidad y Términos.

## Plan para Google Play

**Decisión (21 nov 2026): Opción 1.** En Google Play la app es gratis y solo entran quienes ya compraron, con su correo.
La venta sigue por fuera (QR del carro, Systeme, anuncios). En la app de la tienda no hay ningún enlace de compra.
El plan paso a paso y su avance están en el documento "Medellín a un clic — Diagnóstico y plan para Google Play"
(https://claude.ai/artifact/Po3DMxUpdJqXKoAkNZaHGd).

Hecho:
- Paso 1: decisión de cobro (Opción 1).
- Paso 2: candado en modo tienda y rediseño del candado (publicado en la web con la v149).
- Paso 3: `build.mjs` listo para `assetlinks.json` (el archivo se crea en el Paso 6).
- Paso 4: textos de la tienda aprobados en `tienda/textos-tienda-es.txt` y `tienda/textos-tienda-en.txt`.
  Nombres: "Medellín a un clic – Guía" / "Medellín a un clic – Guide"; se le habla de "tú"; sin mencionar compra ni precio.

Lo que falta:

1. **Cuenta de desarrollador a nombre de Mokea Digital LLC.** Necesita el número **D-U-N-S** (pedido gratis a
   Dun & Bradstreet el 21 nov 2026; llega a info@mokeadigital.com). Sin él no se puede abrir la cuenta de organización.
2. **Empaquetar como TWA** (Trusted Web Activity), p. ej. con Bubblewrap o PWABuilder, apuntando a
   https://medellin.mokeadigital.com. Paquete sugerido: `com.mokeadigital.medellin`.
   - Publicar `/.well-known/assetlinks.json` en Netlify. `build.mjs` ya lo copia; falta crear el archivo con la huella
     SHA-256 de la llave de firma (Paso 6). El paquete debe abrir `https://medellin.mokeadigital.com/?fuente=play`.
   - **La llave de firma (keystore) es secreta y no se puede perder:** guardarla fuera del repositorio y explicarle a María dónde queda.
3. **Material de la tienda** (inglés y español): descripción corta/larga, capturas, imagen destacada 1024×500, icono 512.
4. **Cuenta de prueba para los revisores:** dar acceso de cortesía a un correo de prueba en `mde_buyers`.
5. **Formulario "Seguridad de los datos":** se guarda el correo (acceso); la ubicación se usa solo en el celular; Meta Pixel en la página de pago.
6. **Cobro:** hoy se paga por fuera (Systeme). Revisar las reglas **vigentes** de Google Play sobre pagos externos antes de enviar.

## Apple (después)

- Requiere una **Mac** (María tiene Windows) o un servicio de compilación en la nube.
- Riesgo de rechazo por la guía 4.2 ("solo una página web"); por eso se agregaron favoritos, uso sin internet, Cerca de mí, SOS y frases con audio.
- También requiere el D-U-N-S.

## Pendientes

- DSN de **Sentry** (monitor de errores, plan gratis) — María debe crear la cuenta con info@mokeadigital.com.
- **Precios de los tours** de Paola (hoy dice "pregúntale por WhatsApp").
- El resto de la app le habla al turista de "usted"; "Quiénes somos" y los textos nuevos usan "tú". Unificar a "tú" con cuidado.
- **Lista para el próximo .zip de Netlify (v150, aprobada y probada, sin publicar):**
  - La app abre en el idioma del candado: si la persona toca EN/ES en el candado se guarda en `mde-idioma`
    (el que lee la app); si nunca escogió, al desbloquear se usa el idioma que mostró el candado (p. ej. celular en español).
  - SOS: el título "Embajada de EE. UU. en Bogotá" ya no se sale de su caja (`.sos-btn span b` puede bajar de línea).
  - "Planee su viaje": en celulares pequeños (menos de 360 px) la tabla cabe en su caja (letra y márgenes un poco menores).
- **"Phrases" en el menú:** queda como está. El botón tiene la clase `en` y solo se ve en inglés, a propósito
  (las frases son para el turista que habla inglés). Decisión de María, 21 nov 2026.
- **Lista de fotos con IA** que muestran negocios o personas reales (p. ej. el 903 de Maluma), para que María decida
  cuáles cambiar, antes de enviar a Google.
- **Términos:** mencionan el precio US$19.99; revisarlos junto con la Política de privacidad (Supabase y Resend).
- **El contenido cifrado** solo se puede armar con la `CONTENT_KEY`. Claude del chat la guarda y arma el .zip para
  Netlify; Claude Code trabaja con una llave de prueba y nunca la pide en el chat.
