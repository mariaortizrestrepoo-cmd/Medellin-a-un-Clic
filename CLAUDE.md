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
- **Sin límite de celulares** (22 nov 2026, aprobado por María): los correos del secreto `SIN_LIMITE` de Supabase
  (hoy solo `info@mokeadigital.com`, separados por coma; se comparan sin espacios y en minúsculas) no cuentan cambios
  de equipo y comparten un mismo pase, así ninguno saca al otro. Igual necesitan el código del correo. Los demás
  compradores siguen igual: un celular a la vez y máximo 3 cambios (`MAX_MOVES`). Función `medellin-access` versión 9.
- `/welcome` redirige al pago (es el QR impreso en la hoja del carro; **no cambiar esa ruta**).
- Verificar en vivo: `https://medellin.mokeadigital.com/sw.js` debe mostrar la VERSION nueva.

## Versión actual

**v158** (sw.js de la app: `medellin-v158`), en vivo en Netlify, revisada por Claude del chat. Incluye todo lo de la
v150 a la v157 (detalle abajo) y además: el archivo de verificación `assetlinks.json` y el modo tienda que reconoce
solo el paquete `com.mokeadigital.medellinaunclic`.

**Netlify no publica carpetas que empiezan con punto** (como `.well-known`) cuando se arrastra el .zip. Claude del chat
lo resolvió en vivo con `assetlinks.json` en la raíz y la regla `/.well-known/assetlinks.json  /assetlinks.json  200`
en `_redirects`. Desde ahora `build.mjs` hace eso solo. Verificar en vivo:
https://medellin.mokeadigital.com/.well-known/assetlinks.json debe mostrar el paquete y la huella `35:94:…:58:CC`.

Versión anterior: v157 (`medellin-lock-1795299039833`).

**v158.1 (lista, sin publicar):** la v158 en vivo + solo un arreglo: los 8 cuadros de aviso de seguridad (Consejos,
Río Claro, Hacienda Nápoles y Cisneros, en EN y ES) tenían fondo rosado claro `#FDE3E6` con letra crema invisible;
ahora usan la clase `.nota.alerta` (tono coral oscuro, letra clara). sw.js `medellin-v158-1`. Código en la rama
`v158.1-avisos` (`/home/user/medellin/v158.1/`, zip `medellin-codigo-v158.1.zip`), para publicarla sin las reservas.
El mismo arreglo ya está en la v159. **Pendiente de María:** el botón "Colombian coffee →" / "Café colombiano →"
(página Comida) tiene letra café oscura sobre café (casi no se lee); no se tocó.

Versiones anteriores en vivo: v150 (`medellin-lock-1795283981798`), v149 (`medellin-lock-1795281462731`).

Cambios de la v150: la app abre en el idioma que mostró el candado (`mde-idioma`); el título de la Embajada en SOS
ya no se sale de su caja; la tabla de "Planee su viaje" cabe en celulares pequeños.

**Cambios de la v151 a la v157 (en vivo):**
- **Sin precios** (pedido de Cristina, 21 nov 2026): se quitaron todos los valores de actividades, entradas, tours,
  comida, restaurantes, transporte y hotel, en español e inglés. Las actividades, tours, restaurantes y lugares se quedan
  con su descripción y los datos útiles ("solo en efectivo", "lleve efectivo", "reserve"). Se quedan los "gratis" y los
  datos históricos (premio de 300.000 dólares, moneda de 20.000 pesos, billetes de US$50/US$100). **No volver a poner
  precios**: cambian con la temporada.
- Tours: recuadro "El precio del tour no incluye actividades, entradas ni alimentación. Pregúntale a Paola si quieres
  que te armemos un plan con todo incluido." (y en inglés).
- Botones "Pregúntale a Paola por el transporte" (WhatsApp +57 319 463 5142 con mensaje prellenado) en Llegada al
  aeropuerto y en el plan del día de Cisneros.
- Se quitaron las fuentes cuyo tema era una tarifa o un precio (taxi, bus, peaje, pasaje, bandeja, tarifas de ingreso).
- Enlaces nuevos (pestaña nueva): step.state.gov, la advertencia de viaje de EE. UU. para Colombia,
  migracioncolombia.gov.co (Check-MIG) y haciendanapoles.com.
- Foto real de Elcielo (`img/elcielo-restaurante.jpg`, 941 × 624, 59 KB) en la tarjeta "Alta cocina: Elcielo".
  Ojo: `img/el-cielo.jpg` es del **Mirador El Cielo**, no del restaurante. María usa la foto bajo su responsabilidad.

- **Sentry** (organización Mokea Digital, proyecto Browser JavaScript, solo Error Monitoring), en el `<head>` de
  `app/index.html`: `window.sentryOnLoad` + Loader `js.sentry-cdn.com/0a7b23497c05ba1856f294d2e8ffd6dc.min.js` (clave
  pública, no es secreta). `sendDefaultPii: false`; Tracing, Session Replay y Logs en 0/false; `beforeBreadcrumb` descarta
  lo escrito (`ui.input`) y la consola; `beforeSend` borra `user` y cookies, reemplaza cualquier correo por `[correo]` y
  agrega las etiquetas `pantalla` (candado/app) y `version` (web/tienda). `environment`: produccion en
  medellin.mokeadigital.com, pruebas en otro lugar. En `lock.js`, `avisar()` reporta si la llave guardada no abre la app
  (`candado-abrir`) o si el servidor de acceso responde 5xx (`candado-pedir-codigo`, `candado-verificar`).
- Política de privacidad: sección nueva "Detección de fallas" / "Error monitoring" (Sentry, sin datos personales).
- No hay Content-Security-Policy (ni en `_headers` ni en las páginas), así que nada bloquea a Sentry. Si algún día se
  agrega una CSP, debe permitir `js.sentry-cdn.com`, `browser.sentry-cdn.com` y `*.ingest.sentry.io`.
- SOS, Embajada: cada número llama a su propio teléfono. La tarjeta es un `<div class="sos-btn sos-emb">` (no llama) y
  cada línea es un enlace `a.tel-l` (`tel:+576012752000` y `tel:+576012754021`), con el número en dorado y una zona
  para tocar de al menos 44 px de alto. Probado con toques simulados en los dos idiomas y en 320/360/390 px.
- SOS: cada teléfono de la Embajada va en su propia línea con su nombre ("Línea principal:" / "Fuera de horario:";
  "Main line:" / "After hours:"; clase `tel-l`) y ningún número se parte (clase `tel-n`). En celulares pequeños el
  nombre queda arriba de su número.
- Capturas de SOS (español e inglés) rehechas. Imagen destacada con frases más grandes (`tienda/destacada/`).
- Sin emojis en la app: la bandera de EE. UU. del botón de la Embajada (SOS) es ahora un ícono de línea (edificio con
  columnas) y el 📍 del botón "Cerca de mí" del menú es un pin de línea, del mismo estilo que los demás íconos.
- Se quedan como están, por decisión de María: ♡/♥ (favoritos), las flechas ← → de navegación y el 💛 del mensaje
  prellenado de WhatsApp a Paola (no se ve en la app).

Cambios de la v149 (sobre la v147):
- **Candado rediseñado** con el estilo de la app: Plus Jakarta Sans, azul noche #0B1626 y dorado, ícono arriba,
  sin cursiva, sin "¡Qué chimba, parce!", sin emojis ni flechas, tarjeta crema con letra oscura y grande,
  botones que no se salen en celulares pequeños (probado a 320 px). El diseño del candado vive **solo** en
  `herramientas-candado/src/lock.css` (se quitaron las reglas `#lock` viejas de `app/index.html`).
- **Modo tienda (Google Play):** si la app se abre con `?fuente=play` (o desde el paquete `com.mokeadigital.medellinaunclic`),
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
- Paso 5: aprobado. 7 capturas en español (`tienda/capturas/es/`) y 7 en inglés (`tienda/capturas/en/`), modo tienda,
  1080 × 1920; imagen destacada 1024 × 500 en español e inglés (`tienda/destacada/`). Capturas de SOS rehechas con la v154.
- Paso 5: capturas e imagen destacada aprobadas.
- Paso 6: paquete de Android listo (ver "Paquete de Android" abajo). **Falta la prueba en un celular**, que se hará con
  la prueba interna de Google Play cuando exista la cuenta (ver abajo).
- Paso 4: textos de la tienda aprobados en `tienda/textos-tienda-es.txt` y `tienda/textos-tienda-en.txt`.
  Nombres: "Medellín a un clic – Guía" / "Medellín a un clic – Guide"; se le habla de "tú"; sin mencionar compra ni precio.
  La marca es "Medellín a un clic" (con "clic", correcto en español) en todas partes. Única excepción aprobada: la primera
  frase de la descripción en inglés dice "Medellín a un clic (Medellín, one click away)", para que aparezca "click".

Lo que falta:

1. **Cuenta de desarrollador a nombre de Mokea Digital LLC.** Necesita el número **D-U-N-S** (pedido gratis a
   Dun & Bradstreet el 21 nov 2026; llega a info@mokeadigital.com). Sin él no se puede abrir la cuenta de organización.
2. **Empaquetar como TWA** (Trusted Web Activity), p. ej. con Bubblewrap o PWABuilder, apuntando a
   https://medellin.mokeadigital.com. Paquete: `com.mokeadigital.medellinaunclic` (aprobado por María; no se puede cambiar después de publicar).
   - Publicar `/.well-known/assetlinks.json` en Netlify. `build.mjs` ya lo copia; falta crear el archivo con la huella
     SHA-256 de la llave de firma (Paso 6). El paquete debe abrir `https://medellin.mokeadigital.com/?fuente=play`.
   - **La llave de firma (keystore) es secreta y no se puede perder:** guardarla fuera del repositorio y explicarle a María dónde queda.
3. **Material de la tienda** (inglés y español): descripción corta/larga, capturas, imagen destacada 1024×500, icono 512.
4. **Cuenta de prueba para los revisores:** dar acceso de cortesía a un correo de prueba en `mde_buyers`.
5. **Formulario "Seguridad de los datos":** se guarda el correo (acceso); la ubicación se usa solo en el celular; Meta Pixel en la página de pago.
6. **Cobro:** hoy se paga por fuera (Systeme). Revisar las reglas **vigentes** de Google Play sobre pagos externos antes de enviar.

## Reservas de tours con pago y calendario (proyecto nuevo, 22 nov 2026)

**Estado: v159 en MODO DE PRUEBA, guardada y sin publicar.** El formulario está en la página de Tours
(`#reserva`, código `// ===== Reservas de tours` en `app/index.html`, dentro de la parte cifrada). Mientras
`RESERVAS.modo = 'prueba'`, el pago es una simulación ("Aprobar / Rechazar"), con una franja "MODO DE PRUEBA".
**No publicar la v159** hasta tener la parte de Supabase, Bold y el calendario conectada y aprobada.

- Se reservan con pago 11 tours: Aeropuerto, City Tour, Comuna 13, Tour de Flores (= Santa Elena silletera), Tour de
  Luces, Tequendamita, San Félix, Cuatrimotos (en Rionegro), Guatapé, Río Claro, Hacienda Nápoles. Santa Fe, Jardín,
  Medellín esencial y Ciudad y naturaleza siguen solo con WhatsApp (Paola confirma sus precios).
- **Precios de los tours de Paola en la app:** decisión nueva de María (22 nov 2026). Las actividades y entradas siguen
  sin precio.
- Todo lo que cambia está en el objeto `RESERVAS` (al principio del código): `modo`, `api`, `tasa` (3.461; el cobro en
  pesos se redondea a miles hacia arriba), `anticipo` (20 %), `diasMinimos` (2), `grupos`, `horaExtra` (se paga el día
  del tour), precios en US$ por grupo, `aeroRecargo` (US$10 por trayecto) y `aeroMunicipios` (Bello, Copacabana,
  Girardota, Barbosa, Itagüí, Envigado, Sabaneta, La Estrella, Caldas), `aeroSinRecargo` (Rionegro, Llanogrande,
  La Ceja), `aeroGuatapeUSD` (Aeropuerto ↔ Guatapé, US$ por trayecto, precio final:
  115/140/170/190; se cobra en pesos con la misma tasa), `nocturno` (22:00 a 04:00, 15 % por trayecto) y `lucesTemporada`
  (1 dic a 10 ene).
- Aeropuerto: Recogida (fecha, vuelo, hora de llegada), Llevada (fecha, hora del vuelo, hora de recogida en el hotel)
  o Ida y regreso (dos trayectos, se cobra cada uno). "Otro lugar (El Retiro u otro)" → cotizar por WhatsApp.
  El 20 % del anticipo se calcula sobre el total con recargos (aprobado).
- Hora de recogida libre; Paola la confirma por WhatsApp. Fechas desde pasado mañana (hora de Colombia); los días con
  un evento de todo el día "CERRADO" en el calendario de Paola no se ofrecen (en modo de prueba hay dos días falsos).
- Bold a nombre de Transportes R.T (aprobado por María: aparece solo en el pago y el comprobante; en la app, "Paola").
- Datos que se guardan: nombre, WhatsApp, correo y lo de la reserva; se borran 1,5 años después del tour.
- **Todo en dólares, con su conversión a pesos al lado** (decisión de María, 22 nov 2026): precios, anticipo, resto,
  resumen, simulación de pago, correos y calendario muestran "US$… · COP …". Bold cobra en pesos.
- **Parte de Supabase (modo de prueba, sin instalar):** carpeta `supabase-reservas/` (ver `LEEME-RESERVAS.md`):
  tablas `mde_ajustes`, `mde_tours`, `mde_reservas` con borrado automático; función `medellin-reservas` (`/precios`,
  `/disponibilidad`, `/crear`, `/confirmar`, `/webhook-bold`); 68 pruebas sin internet (`bash pruebas/correr.sh`).
  Para instalarla, María da una llave de acceso de Supabase por el formulario seguro (opción b) y la borra al terminar.
- **Falta:** tablas y función en Supabase (modo de prueba), claves de prueba de Bold (las pone Paola en los secretos de
  Supabase), Gmail de Paola y cuenta de servicio de Google para el calendario, Política de privacidad y Términos
  (regla del anticipo; conviene revisión de un abogado), y la aprobación final de María.

## Paquete de Android (Paso 6, 21 nov 2026)

- Bubblewrap 1.27.0, Java 17, build-tools 36.1.0, Android 16 (target 36), **mínimo Android 7 (nivel 24)**, que es lo que
  exige la biblioteca de Google (androidbrowserhelper 2.7.4). Configuración en `android/twa-manifest.json`
  (`appVersion` 1.0.0, `appVersionCode` 1). Ver `android/LEEME-ANDROID.md`.
- Paquete `com.mokeadigital.medellinaunclic`; nombre "Medellín a un clic"; bajo el ícono "Medellín"; abre
  `https://medellin.mokeadigital.com/?fuente=play`; sin permisos especiales (ni ubicación).
- Llave de subida: `mokea-medellinaunclic-subida.keystore` (PKCS12, RSA 4096, alias `mokea-medellinaunclic`, válida
  hasta 2054). Huella SHA-256: `35:94:F9:DE:0C:F4:14:40:FF:4B:77:F6:B3:E0:60:73:15:26:8E:3D:E1:79:EB:6C:5E:4A:2F:E4:E7:1A:58:CC`.
  **Solo la tiene María** (Google Drive: MOKEA DIGITAL / LLAVE APP MEDELLIN UN CLIC, y su computador), con las
  contraseñas en un archivo aparte. Se borró de la nube al terminar el Paso 6. Para volver a firmar, María la sube.
- El `.aab` (`Medellin-a-un-clic-1.0.0-GooglePlay.aab`, versión 1.0.0) lo guarda María junto a la llave.
- **Prueba en el celular pendiente:** el .apk de prueba no se pudo instalar en el Samsung Galaxy Z Fold de María porque
  el "Bloqueador automático" de Samsung lo impide, y María decidió no desactivarlo. La prueba se hará desde Google Play
  (**prueba interna**) cuando llegue el D-U-N-S, con la lista de pruebas (celular cerrado y abierto).
- `app/.well-known/assetlinks.json` tiene la huella de la llave de subida. **Al crear la app en Play Console, agregar la
  huella de la llave de Google** (Play Console → Integridad de la app) y volver a publicar el sitio.
- Ícono de la tienda: usar la versión cuadrada completa (`icon-maskable-512.png`); en `icon-512.png` las montañas se
  salen por las esquinas de abajo.

## Apple (después)

- Requiere una **Mac** (María tiene Windows) o un servicio de compilación en la nube.
- Riesgo de rechazo por la guía 4.2 ("solo una página web"); por eso se agregaron favoritos, uso sin internet, Cerca de mí, SOS y frases con audio.
- También requiere el D-U-N-S.

## Pendientes

- **Sentry configurado en la cuenta (María, 21 nov 2026):** sin IP, sin Tracing, sin Session Replay y sin Logs.
- **Precios de los tours** de Paola: ya están en el formulario de reservas (v159, modo de prueba). Faltan los de
  Santa Fe, Jardín, Medellín esencial y Ciudad y naturaleza.
- El resto de la app le habla al turista de "usted"; "Quiénes somos" y los textos nuevos usan "tú". Unificar a "tú" con cuidado.
- **"Phrases" en el menú:** queda como está. El botón tiene la clase `en` y solo se ve en inglés, a propósito
  (las frases son para el turista que habla inglés). Decisión de María, 21 nov 2026.
- **Lista de fotos con IA** que muestran negocios o personas reales (p. ej. el 903 de Maluma), para que María decida
  cuáles cambiar, antes de enviar a Google.
- **Términos:** mencionan el precio US$19.99; revisarlos junto con la Política de privacidad (Supabase y Resend).
- **El contenido cifrado** solo se puede armar con la `CONTENT_KEY`. Claude del chat la guarda y arma el .zip para
  Netlify; Claude Code trabaja con una llave de prueba y nunca la pide en el chat.
