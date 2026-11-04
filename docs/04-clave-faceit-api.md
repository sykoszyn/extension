# Acceso a la FACEIT Data API (sin backend)

SykosTracker funciona **entero dentro del navegador**. No tiene servidor propio,
no usa cuentas propias y no depende de Supabase ni de ningún otro servicio. La
única conexión externa es la **API oficial de FACEIT** (`https://open.faceit.com/data/v4`).

## La limitación que conviene conocer

**La FACEIT Data API no admite peticiones anónimas.** Todas las llamadas
necesitan la cabecera `Authorization: Bearer <API key>`. Hoy, App Studio de
FACEIT solo emite claves **server-side**.

Una clave server-side es **secreta**. Por eso SykosTracker sigue estas reglas:

* **Nunca va dentro de la extensión publicada.** El código no lleva ninguna
  clave, y la opción de incluir una al compilar se ha eliminado.
* **Cada usuario pega la suya** en *Configuración*. Se guarda solo en el
  `storage.local` de su navegador, que no puede leer ninguna web (tampoco
  faceit.com), y solo la usa el service worker para llamar a `open.faceit.com`.
* Es tu clave y tu cuota. Si crees que se ha filtrado, revócala en App Studio y
  crea otra.

Alternativas:

| Opción | Ventaja | Inconveniente |
|---|---|---|
| **Clave propia de cada usuario (la que se usa)** | Sin servidor ni cuentas; cada uno tiene su cuota y su riesgo | Cada usuario tiene que crear la suya (2 minutos) |
| Incluir una clave server-side en el paquete | Funciona nada más instalarla | **Descartada**: cualquiera podría extraerla del paquete |
| Backend propio con la clave guardada en el servidor | Los usuarios no necesitan clave | Hace falta un servidor; descartado por los requisitos del producto. Si algún día se quiere, solo habría que cambiar `extension/background/transport.ts` |

## Crear tu clave

1. Entra en <https://developers.faceit.com> con tu cuenta de FACEIT.
2. **App Studio → Create App**: pon un nombre (p. ej. «SykosTracker personal»).
3. Dentro de la app: **API Keys → Create**. El tipo que ofrece FACEIT es
   **Server side**, y es el correcto.
4. Copia la clave. Tiene forma de UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
5. En SykosTracker, abre el icono → **Configuración → Conexión con FACEIT**, pega
   la clave y pulsa **Guardar y probar**. Debe aparecer «Conexión directa con
   FACEIT correcta».

## Qué se envía y adónde

* **Destino**: solo `open.faceit.com`, con `credentials: 'omit'` y sin `Referer`.
* **Contenido**: nicknames, IDs de jugador e IDs de partida que consultas, y la
  clave en la cabecera `Authorization`.
* **Nunca**: cookies, tokens de sesión ni contraseñas de FACEIT.

La prueba end-to-end lo comprueba: falla si la extensión hace cualquier petición
a un dominio que no sea de FACEIT.

## Cuota y límites

FACEIT limita las peticiones por clave. SykosTracker gasta poco:

* caché local en IndexedDB (de 10 minutos para perfiles a 30 días para partidas terminadas);
* si varias vistas piden lo mismo a la vez, se hace una sola petición;
* como mucho 4 peticiones simultáneas, con al menos 110 ms entre una y otra;
* ante un 429 se pausa toda la cola y se reintenta respetando `Retry-After`;
* el historial PvP se escanea por bloques y nunca se vuelve a descargar lo que ya está guardado.

## Errores frecuentes

| Mensaje | Causa |
|---|---|
| «Añade tu API key de FACEIT…» | No hay ninguna clave configurada |
| «FACEIT ha rechazado la clave de API (401)» | Clave mal copiada o revocada |
| «Límite de peticiones de FACEIT alcanzado» | Cuota agotada; SykosTracker reintenta solo |
| «No encontrado en FACEIT (404)» | El nickname o la partida no existen |
