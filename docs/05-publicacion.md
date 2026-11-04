# Publicación en las tiendas

Genera los paquetes:

```bash
npm run pack
```

Se crean `dist/sykostracker-<target>-<versión>.zip`. Antes de cada envío, sube la
versión en `package.json`: el manifest la lee de ahí.

## Lista común

* [ ] Prueba real con una clave de FACEIT: perfil, PvP, historial, sala y Auto Accept (este último solo en modo aviso, si no quieres arriesgar).
* [ ] Publica la política de privacidad ([06-privacidad.md](06-privacidad.md)) en una URL pública.
* [ ] Capturas de 1280×800 (puedes partir de las de `npm run build && node scripts/e2e.mjs`, en `dist/e2e/`, que usan datos de prueba; para la tienda conviene hacerlas con datos reales).
* [ ] Justifica cada permiso (tabla de abajo).
* [ ] Aclara que SykosTracker **no está afiliado a FACEIT** y no uses sus logotipos.
* [ ] Publica el Worker y pon su URL en `sykos.config.json` **antes** de `npm run pack` ([08-servidor-cloudflare.md](08-servidor-cloudflare.md)).
* [ ] En la ficha: «Solo necesitas tu nickname de FACEIT. Opcionalmente puedes usar tu propia API key».

| Permiso | Justificación |
|---|---|
| `storage`, `unlimitedStorage` | Ajustes, favoritos y caché local del historial descubierto (PvP) |
| `notifications` | Aviso de «partida encontrada» |
| `alarms` | Limpieza periódica de la caché |
| Host `www.faceit.com` (content script) | Mostrar los paneles en perfiles y salas |
| Host `open.faceit.com` | Consultar la FACEIT Data API oficial con la clave propia del usuario |
| Host `sykostracker-proxy.<sub>.workers.dev` | Servidor de SykosTracker que añade la API key, para que el usuario solo tenga que poner su nickname |

## Chrome Web Store

1. Cuenta de desarrollador en <https://chrome.google.com/webstore/devconsole> (pago único de registro).
2. **New item** → sube `sykostracker-chrome-<v>.zip`.
3. *Privacy practices*: propósito único («analítica de estadísticas CS2 de FACEIT»), justificación de permisos, datos recopilados («Website content / activity»: nicknames e IDs de partida que consultas, enviados a la API de FACEIT), URL de la política.
4. *Remote code*: **No** (todo el JS va empaquetado; CSP `script-src 'self'`).
5. *Single purpose*: estadísticas de CS2 en FACEIT. En «datos», declara que los nicknames e IDs de partida consultados pasan por el Worker de SykosTracker hacia FACEIT, y que no se guardan.
6. Cuando tengas el ID definitivo, ponlo en `ALLOWED_ORIGINS` del Worker (paso 9 de la guía 08).

**Brave** y **Opera GX** instalan directamente desde la Chrome Web Store.

## Microsoft Edge Add-ons

1. <https://partner.microsoft.com/dashboard/microsoftedge> → *Create new extension*.
2. Sube `sykostracker-edge-<v>.zip`, con la misma información de privacidad.

## Opera Add-ons

1. <https://addons.opera.com/developer/> → *Upload*.
2. Sube `sykostracker-opera-<v>.zip`. Opera pide revisar el código, así que adjunta el código fuente o un enlace al repositorio.

## Firefox Add-ons (AMO)

1. <https://addons.mozilla.org/developers/> → *Submit a New Add-on* (*listed* o *unlisted*).
2. Sube `sykostracker-firefox-<v>.zip`.
3. **Código fuente**: el bundle está minificado, así que AMO lo exige. Sube un zip del repositorio (sin `node_modules` ni `dist`) con estas instrucciones:
   ```
   npm ci && node scripts/icons.mjs && npm run build:firefox   # salida: dist/firefox
   ```
   (`scripts/icons.mjs` necesita Playwright y Chromium. Los PNG ya están en
   `extension/assets/icons`, así que el revisor puede saltarse ese paso.)
4. El manifest ya declara `browser_specific_settings.gecko.id` y
   `data_collection_permissions`. Revisa en el formulario que la categoría
   declarada coincide con lo que se envía (nicknames e IDs de partida a la API).

Validación local con el linter oficial de Mozilla:

```bash
npx web-ext lint -s dist/firefox
```

Resultado actual: **0 errores** y 4 avisos `UNSAFE_VAR_ASSIGNMENT`, que están en
código de React DOM y de Recharts (soporte interno de `innerHTML`), no en código
de SykosTracker. AMO lo admite; si el revisor pregunta, indícalo.

## Sobre Auto Accept en las tiendas

Explica en la ficha que Auto Accept viene **desactivado**, que pide un
reconocimiento explícito y que se limita a pulsar el botón visible de la
interfaz de FACEIT. Si una tienda pone pegas, se puede publicar una versión sin
Auto Accept: basta con no montar `AcceptOverlay` o restringirlo al modo aviso.
