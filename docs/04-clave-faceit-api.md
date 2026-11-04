# Acceso a la FACEIT Data API (sin backend)

SykosTracker funciona dentro del navegador y no usa cuentas propias. Para hablar
con la **API oficial de FACEIT** (`https://open.faceit.com/data/v4`) hay dos vías,
que se eligen solas:

1. **Servidor de SykosTracker (modo público, por defecto).** Un Worker de
   Cloudflare sin estado añade la clave del editor. El usuario solo pone su nick.
   Ver [08-servidor-cloudflare.md](08-servidor-cloudflare.md).
2. **Clave propia del usuario (opcional).** Si la pega en *Configuración*, la
   extensión habla directamente con FACEIT y deja de usar el servidor.

## La limitación que conviene conocer

**La FACEIT Data API no admite peticiones anónimas.** Todas las llamadas
necesitan la cabecera `Authorization: Bearer <API key>`. Hoy, App Studio de
FACEIT solo emite claves **server-side**.

Una clave server-side es **secreta**. Por eso SykosTracker sigue estas reglas:

* **Nunca va dentro de la extensión publicada.** El código no lleva ninguna clave.
* **La clave del editor** vive como secreto cifrado en el Worker de Cloudflare.
* **La clave propia de un usuario** (opcional) se guarda solo en el
  `storage.local` de su navegador, que no puede leer ninguna web (tampoco
  faceit.com), y solo la usa el service worker para llamar a `open.faceit.com`.
* Si crees que una clave se ha filtrado, revócala en App Studio y crea otra.

Alternativas:

| Opción | Ventaja | Inconveniente |
|---|---|---|
| **Worker de Cloudflare con la clave del editor (por defecto)** | El usuario solo pone su nick; sin cuentas; gratis hasta 100 000 peticiones al día | Todos comparten la cuota de la clave del editor; hay que mantener el Worker |
| **Clave propia del usuario (opcional)** | Directo con FACEIT, sin intermediarios; cuota propia | El usuario tiene que crearla (2 minutos) |
| Incluir una clave server-side en el paquete | Funciona nada más instalarla | **Descartada**: cualquiera podría extraerla del paquete |

## Crear una clave (la del Worker o la tuya propia)

1. Entra en <https://developers.faceit.com> con tu cuenta de FACEIT.
2. **App Studio → Create App**: pon un nombre (p. ej. «SykosTracker personal»).
3. Dentro de la app: **API Keys → Create**. El tipo que ofrece FACEIT es
   **Server side**, y es el correcto.
4. Copia la clave. Tiene forma de UUID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
5. En SykosTracker, abre el icono → **Configuración → Conexión con FACEIT**, pega
   la clave y pulsa **Guardar y probar**. Debe aparecer «Conexión directa con
   FACEIT correcta».

## Qué se envía y adónde

* **Destino**: el Worker de SykosTracker (modo público) o `open.faceit.com`
  (clave propia), siempre con `credentials: 'omit'` y sin `Referer`.
* **Contenido**: nicknames, IDs de jugador e IDs de partida que consultas, y la
  clave en la cabecera `Authorization`.
* **Nunca**: cookies, tokens de sesión ni contraseñas de FACEIT.

La prueba end-to-end lo comprueba: falla si la extensión hace cualquier petición
a otro dominio que no sea FACEIT o el Worker, o si envía alguna clave al Worker.

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
| «Esta versión no tiene servidor configurado…» | Se compiló sin `proxyUrl` y el usuario no tiene clave propia |
| «El servidor de SykosTracker no puede contactar con FACEIT (502)» | FACEIT caído, o la clave del Worker revocada o mal configurada |
| «FACEIT ha rechazado la clave de API (401)» | Clave mal copiada o revocada |
| «Límite de peticiones de FACEIT alcanzado» | Cuota agotada; SykosTracker reintenta solo |
| «No encontrado en FACEIT (404)» | El nickname o la partida no existen |
