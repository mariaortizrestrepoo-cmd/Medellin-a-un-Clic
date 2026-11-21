# Paquete de Android (Google Play) — Medellín a un clic

Se arma con **Bubblewrap 1.27.0** (herramienta oficial de Google para Trusted Web Activity).

- Configuración: `android/twa-manifest.json` (sin secretos).
- Requisitos en la máquina que arma el paquete: **Java 17** (Bubblewrap no acepta otra versión) y las herramientas de
  Android (build-tools 36.1.0, plataforma 36). En la nube de Claude Code se descargan de dl.google.com (permitido en el
  entorno "Predeterminado" el 21 nov 2026).
- Paquete: `com.mokeadigital.medellinaunclic` (no se puede cambiar después de publicar).
- La app abre `https://medellin.mokeadigital.com/?fuente=play` (activa el modo tienda: sin enlaces de compra).
- **Llave de subida (upload key):** NO va en el proyecto, ni en el .zip, ni en Netlify. La guarda María en dos copias
  (Google Drive privado de info@mokeadigital.com y su computador), con las contraseñas en un archivo aparte.
  Se usa **Play App Signing**: Google guarda la llave que firma la app para los clientes; si se pierde la llave de
  subida, el dueño de la cuenta pide a Google cambiarla.
- `assetlinks.json` (en `app/.well-known/`, lo copia build.mjs) debe tener la huella SHA-256 de la llave de subida
  (para probar el .apk) y, cuando exista la cuenta, la huella de la llave de Google (Play Console → Integridad de la app).
