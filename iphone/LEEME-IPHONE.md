# Versión para iPhone (App Store) — PRUEBA, sin publicar (23 nov 2026)

Copia aparte (rama `iphone-prueba`, sobre la v158.2). No cambia la web, la v158.2 aprobada ni la v159.

## Qué hay
- Proyecto de iPhone hecho con **Capacitor 8.6.2** (`iphone/`), con Swift Package Manager (no necesita CocoaPods).
  Paquete `com.mokeadigital.medellinaunclic` (igual que Android), nombre bajo el ícono "Medellín", solo iPhone
  (sin iPad), solo vertical, ícono 1024 nuevo, pantalla de arranque azul noche con el ícono.
- **La app va DENTRO del iPhone** (`www/` = la versión con candado de `herramientas-candado/dist`): abre sin internet.
  Para la versión real, `dist/` se arma con la CONTENT_KEY real (Claude del chat) y luego: `npm run sync`.
  En esta prueba se usó la **llave de prueba**.
- **Modo tienda en iPhone:** `lock.html` reconoce la App Store por `capacitor://localhost` o `?fuente=appstore`
  y guarda `mde-tienda=1` (esconde enlaces de compra, consejo de instalación y botón "Instalar la app").
- Permiso de ubicación con su explicación (EN/ES) para "Cerca de mí" (Apple lo exige).

## Probado (Chromium simulando iPhone 16 Pro Max y iPhone SE; no es Safari)
- 42 páginas, EN/ES: 0 enlaces de compra visibles, 0 botones de instalar, 0 errores. Control: en la web normal
  el enlace de compra sí aparece. Modo avión: la app abre y se ve completa.

## Falta (antes de enviarla a Apple)
1. Compilar en un Mac en la nube (Codemagic, Capawesome o Capgo, con Xcode 26) y probar con TestFlight en un iPhone real.
2. Funciones del iPhone: recordatorio del tour, compartir del iPhone, abrir en Apple Maps, ubicación nativa.
3. Pago de Apple (US$19.99) para quien compre dentro de la app (regla 3.1.3(b)); quien compró por fuera solo pone su correo.
4. Botón "Borrar mis datos".
5. Cuenta de prueba para el revisor con código fijo (también sirve para Google).
6. Letras (Plus Jakarta Sans) dentro de la app: hoy se bajan de internet; sin internet usa la letra del sistema.
