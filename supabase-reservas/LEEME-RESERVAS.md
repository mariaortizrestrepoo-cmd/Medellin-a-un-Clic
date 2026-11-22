# Reservas de tours: la parte de Supabase (MODO DE PRUEBA)

Esto es lo que funciona "detrás" del formulario de reservas de la app. Nada de esto está instalado ni publicado todavía.

## Qué hace

1. **El cliente llena el formulario.** La app le manda los datos a la función `medellin-reservas`.
2. **El servidor vuelve a calcular el precio.** Usa la tabla de precios y no confía en el que manda el celular. Revisa también:
   - que falten al menos 2 días;
   - que no sea un día CERRADO de Paola;
   - la temporada del Tour de Luces.
3. **El servidor guarda la reserva como "pendiente".** Firma el cobro con la llave secreta de Bold. La llave secreta nunca sale del servidor.
4. **El cliente paga en Bold.** Bold avisa al servidor (webhook firmado). La app también pregunta a Bold al volver. Lo que llegue primero confirma la reserva, **una sola vez**.
5. **Al confirmarse el pago:**
   - se crea el evento en el Google Calendar de Paola (2 eventos si es ida y regreso al aeropuerto);
   - le llega un correo al cliente, en inglés y español;
   - le llega un correo a Paola con lo que falta por cobrar.
6. **Borrado automático:**
   - las reservas pagadas se borran 1 año y medio después del tour;
   - las que nunca se pagaron se borran a los 7 días.

## Archivos

| Archivo | Qué es |
|---|---|
| `setup-reservas.sql` | Las 3 tablas: ajustes (tasa, recargos), tours y precios, y reservas. Se corre una vez en SQL Editor. |
| `functions/medellin-reservas/index.ts` | Conexión con Supabase y lectura de los secretos. |
| `functions/medellin-reservas/logica.ts` | Rutas, Bold, Google Calendar y correos. |
| `functions/medellin-reservas/precios.ts` | Reglas de precio: la misma cuenta que hace el formulario. |
| `pruebas/prueba-funcion.ts` | 65 pruebas sin internet: Bold, Google y los correos son de mentira. |

## Cambiar precios o la tasa del dólar

En Supabase, abra **Table Editor**:

- **`mde_ajustes`** para la tasa, el anticipo y los recargos.
- **`mde_tours`** para los precios por grupo.

Se edita como una hoja de cálculo. Por ahora, la app también tiene los precios escritos (RESERVAS en `app/index.html`). Si cambia uno, hay que cambiar el otro. Más adelante la app los puede leer de la tabla (ruta `/precios`).

La columna **`horas`** de `mde_tours` es la duración aproximada de cada tour, para el calendario. Son valores estimados: Paola debe revisarlos.

## Secretos

Se escriben en **Supabase → Edge Functions → Secrets**. Nunca van en el chat ni en el código.

| Nombre | Quién lo pone | Qué es |
|---|---|---|
| `RESERVAS_MODO` | Claude / María | `prueba` (ahora) o `real` (cuando se apruebe) |
| `BOLD_LLAVE_IDENTIDAD` | Paola | Llave de identidad del Botón de pagos (la **de pruebas** mientras sea prueba) |
| `BOLD_LLAVE_SECRETA` | Paola | Llave secreta del Botón de pagos (la **de pruebas** mientras sea prueba) |
| `GOOGLE_CUENTA_JSON` | María | Archivo JSON de la cuenta de servicio de Google (info@mokeadigital.com) |
| `PAOLA_CALENDARIO` | María | El Gmail de Paola (su calendario, compartido con la cuenta de servicio con permiso de "hacer cambios") |
| `PAOLA_CORREO` | María | A dónde le llega a Paola el aviso de cada reserva |
| `RESEND_API_KEY` | (ya existe) | La misma del candado |

## Al instalar

- La función se instala con **verificación JWT apagada** (`verify_jwt = false`), porque Bold no manda esa llave en su aviso. La seguridad la da la firma de Bold y las tablas cerradas.
- En el panel de Bold (Integraciones → Webhook), Paola registra esta dirección: `https://kipooidlqcvivpngtebr.supabase.co/functions/v1/medellin-reservas/webhook-bold`
- En modo de pruebas, Bold **no** manda el webhook solo. Al final del pago de prueba hay un botón **"Probar el webhook"**. Si no se usa, la app confirma preguntándole a Bold.
- Tarjetas de prueba de Bold:
  - aprobada: `4111111111111111`
  - rechazada: `4970110000000062`

## Correr las pruebas

```bash
bash pruebas/correr.sh
```

El archivo calcula las firmas con el código de ejemplo de Bold en Python y comprueba que las del servidor salgan idénticas.
