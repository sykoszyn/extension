# Acceso a la FACEIT Data API (sin backend)

SykosTracker funciona **entero dentro del navegador**. No tiene servidor propio,
no usa cuentas propias y no depende de Supabase ni de ningún otro servicio. La
única conexión externa es la **API oficial de FACEIT** (`https://open.faceit.com/data/v4`).

## La limitación que conviene conocer

**La FACEIT Data API no admite peticiones anónimas.** Todas las llamadas
necesitan la cabecera `Authorization: Bearer <API key>`. FACEIT ofrece dos tipos
de clave en App Studio:

| Tipo | Uso previsto | ¿Puede ir en una extensión? |
|---|---|---|
| **Server side** | Servidores. Es secreta | **No.** Si se metiera en el código, cualquiera podría extraerla. SykosTracker no la acepta ni la usa |
| **Client side** | Código que se ejecuta en el navegador o en el cliente | **Sí.** Es el tipo pensado para aplicaciones sin servidor |

Para tener funciones como Player vs Player, Lobby Analyzer y el resto sin un
backend, hay estas opciones, de la más recomendable a la menos:

1. **Cada usuario usa su propia clave client-side (opción por defecto).** Es
   gratis y se crea en dos minutos (pasos abajo). Se guarda solo en el
   `storage.local` de su navegador y solo se envía a `open.faceit.com`. Cada
   usuario tiene su propia cuota y nadie depende de la clave de otro.
2. **El editor incluye una clave client-side al compilar (opcional).** Sirve para
   que la extensión funcione nada más instalarla, sin que el usuario cree una clave:
   ```bash
   SYKOS_FACEIT_CLIENT_KEY=<clave-client-side> npm run build
   ```
   Contras: todos los usuarios comparten la cuota de esa clave, la clave se puede
   leer en el paquete (por eso tiene que ser client-side) y, si FACEIT la revoca,
   la extensión deja de funcionar para todos. Si el usuario pega su propia clave,
   esa tiene prioridad. Revisa las condiciones de la API de FACEIT antes de
   distribuir una clave incluida.
3. **Un backend propio con una clave server-side.** Es la única forma de usar una
   clave secreta. **No está incluido**, porque el producto no debe depender de un
   servidor. Si algún día se necesita, solo habría que cambiar
   `extension/background/transport.ts`.

## Crear tu clave client-side

1. Entra en <https://developers.faceit.com> con tu cuenta de FACEIT.
2. **App Studio → Create App**: pon un nombre (p. ej. «SykosTracker personal»).
3. Dentro de la app: **API Keys → Create** y elige **Client side**.
4. Copia la clave.
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
| «Añade tu clave client-side de FACEIT…» | No hay ninguna clave configurada |
| «FACEIT ha rechazado la clave de API (401)» | Clave no válida, revocada o de otro tipo |
| «Límite de peticiones de FACEIT alcanzado» | Cuota agotada; SykosTracker reintenta solo |
| «No encontrado en FACEIT (404)» | El nickname o la partida no existen |
