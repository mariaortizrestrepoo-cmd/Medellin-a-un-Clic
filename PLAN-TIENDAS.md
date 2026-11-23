# Medellín a un clic — Plan para Google Play y App Store (app de pago, sin candado)

**Decisión de María (23 nov 2026):** la app se publica en Google Play y en la App Store como una app normal de pago
(US$19.99): el turista la busca, paga en la tienda y la descarga. **Sin candado, sin correo ni código.** Debe sentirse
como una app de verdad. Las reservas con Paola (Bold) siguen en modo de prueba hasta que Bold active el botón de pago.
Nada se publica en vivo sin aprobación de María.

## Cómo se arma (decisión técnica)

- **Capacitor 8** (`nativa/`): un solo código para Android y iPhone. La app (`app/`) va DENTRO del celular, sin candado,
  con sus fotos y letras: abre y funciona sin internet desde el primer momento.
- `nativa/armar-web.mjs` copia `app/` a `nativa/www/` y le quita lo de página web (instalar, service worker,
  manifiesto, letras de internet, zoom). `app/` no se toca.
- `nativa/nativa.css` + `nativa.js`: comportamiento de app (atrás de Android, deslizar para volver en iPhone,
  transiciones, vibración, navegador interno, Apple Maps en iPhone, voz nativa en Frases, arranque azul noche,
  bienvenida solo la primera vez).
- **Android:** se compila aquí (Linux, Java 21, SDK en `/home/user/android-sdk`). El .aab se firma con la llave de
  subida de María (ella la sube solo en ese momento). Mismo paquete `com.mokeadigital.medellinaunclic`.
- **iPhone:** se compila en un Mac en la nube (Codemagic recomendado; Xcode 26). Necesita el código en un repositorio
  privado de GitHub de Mokea y la llave de API de App Store Connect (María la pega en Codemagic).
- Comandos: `cd nativa && npm run sync` (arma www y copia a Android/iPhone) · `python3 iconos-nativos.py` (íconos y
  arranque) · Android: `cd android && ./gradlew bundleRelease` (con la llave) / `assembleDebug` (prueba).

## Etapas

1. **App nativa (en curso, prueba aparte `app-nativa`):** proyecto Android + iPhone, sin candado, comportamiento de app.
2. **Pulido "de app real":** recordatorio del tour (notificación local), compartir nativo, ubicación nativa,
   aviso de privacidad de iPhone (PrivacyInfo), pantallas vacías y mensajes sin internet, revisión en celulares reales.
3. **Material de tiendas:** capturas nuevas (Android 1080×1920; iPhone 6,9" 1320×2868) EN/ES, textos (sin "candado",
   con precio en la tienda), política de privacidad y términos nuevos, clasificación por edad, notas para revisores.
4. **Página web de presentación:** medellin.mokeadigital.com pasa a ser vitrina con botones de las dos tiendas;
   `/welcome` (QR del carro) manda a la tienda correcta según el celular. La guía completa ya no queda abierta en la web.
5. **Cuentas (al llegar el D-U-N-S):** Google Play (organización, perfil de pagos) y Apple Developer (Acuerdo de apps
   de pago, banco, impuestos W-9, programa para empresas pequeñas 15 %). Prueba interna / TestFlight en el Fold y un iPhone.
6. **Envío a revisión y lanzamiento** coordinado en las dos tiendas, con la web nueva publicada el mismo día.
7. **Reservas en vivo** cuando Bold active el botón: actualización de la app en las dos tiendas.

## Decisiones pendientes de María

- Reservas mientras Bold no esté activo: ¿se esconde el formulario en la app de las tiendas (queda WhatsApp)?
  Una app con "MODO DE PRUEBA" o pagos simulados la rechazan (regla 2.1 de Apple).
- Página web y QR `/welcome`: pasar a vitrina con botones de las tiendas (cambia la regla "no cambiar /welcome").
- Systeme.io (US$19.99 por fuera): apagar la venta web cuando salgan las tiendas.
- Fotos con IA de negocios o personas reales (903 de Maluma, Casa Eterna, etc.): cuáles cambiar (riesgo de rechazo).
- Países donde se vende (sugerido: todos, o al menos EE. UU., Panamá, México, Colombia, Canadá, España).
