# Codemagic — cómo se arma la app (Medellín a un clic)

El archivo `codemagic.yaml` (en la raíz del repositorio) tiene dos flujos. Los dos se inician **a mano**
en Codemagic con **Start new build**, y **ninguno publica nada en las tiendas**: solo arman el archivo para descargarlo.

| Flujo en Codemagic | Qué arma | Cuándo |
|---|---|---|
| **Android · Google Play (.aab firmado)** (`android-google-play`) | `Medellin-a-un-clic-2.0.0-tienda-N.aab` | Ya |
| **iPhone · App Store (.ipa)** (`iphone-app-store`) | `App.ipa` | Cuando Apple apruebe la cuenta |

Al iniciar cada armada, Codemagic pregunta **version_web**:
- **tienda** (viene marcada): sin reservas con pago; los tours se piden a Paola por WhatsApp. Es la que se envía a revisión.
- **prueba**: reservas en modo de prueba. Solo para pruebas internas, nunca para enviar a revisión.

Las llaves y contraseñas **no** están en el archivo ni en GitHub. Se suben una sola vez en Codemagic,
con los nombres exactos de abajo. María las escribe directo en Codemagic, nunca en el chat.

## Android (ahora)

En Codemagic: **su cuenta personal → Settings → codemagic.yaml settings → Code signing identities → Android keystores**.

| Campo en Codemagic | Qué poner |
|---|---|
| Archivo | `mokea-medellinaunclic-subida.keystore` (la llave de subida que guarda en Google Drive) |
| Keystore password | la contraseña de la llave (está en su archivo aparte de contraseñas) |
| Key alias | `mokea-medellinaunclic` |
| Key password | la contraseña de la clave (en el mismo archivo) |
| **Reference name** | **`medellin_subida`** (exactamente así, en minúscula y con guion bajo) |

Comprobaciones automáticas en cada armada:
- Si falta la llave `medellin_subida`, la armada se detiene con un aviso.
- Si el .aab sale firmado con otra llave, la armada falla. La huella correcta es
  `35:94:F9:DE:0C:F4:14:40:FF:4B:77:F6:B3:E0:60:73:15:26:8E:3D:E1:79:EB:6C:5E:4A:2F:E4:E7:1A:58:CC`.
- El número interno de versión sube solo en cada armada (empieza en 2). La versión visible es 2.0.0.

## iPhone (cuando Apple apruebe la cuenta)

1. En Apple Developer: crear el identificador de la app `com.mokeadigital.medellinaunclic` y, en App Store Connect,
   la llave de API (rol App Manager). La llave `.p8` se descarga una sola vez: guardarla junto a la de Android.
2. En Codemagic: **Settings → Integrations → Developer Portal → Manage keys → Add key**.
   Nombre de la llave: **`Mokea App Store`**. Ahí van el Issuer ID, el Key ID y el archivo `.p8`.
3. **Code signing identities → iOS certificates → Generate certificate**: tipo **Apple Distribution**,
   Reference name **`medellin_distribucion`**. Codemagic lo deja descargar **una sola vez** con su contraseña:
   guardarlo junto a las otras llaves y subirlo (pestaña Upload certificate) con el mismo nombre.
4. **Code signing identities → iOS provisioning profiles → Fetch profiles**: el perfil **App Store** de
   `com.mokeadigital.medellinaunclic`, Reference name **`medellin_app_store`**.

El flujo encuentra el certificado y el perfil solo, por el tipo (App Store) y el paquete.
La subida a TestFlight se agrega al archivo después, con la aprobación de María.

## Costo

Plan gratis de cuenta personal: 500 minutos al mes en Mac mini M2 (los dos flujos usan esa máquina).
Cada armada de Android toma unos minutos; las de iPhone, un poco más.
