# Pruebas

| Comando | Qué comprueba |
|---|---|
| `npm run typecheck` | TypeScript estricto en todo el proyecto (extensión, dashboard, tests) |
| `npm test` | 67 pruebas unitarias con Vitest |
| `npm run e2e` | 15 comprobaciones end-to-end con la extensión **compilada** (con un proxy de prueba) cargada en Chromium real |

## Unitarias (`tests/`)

| Archivo | Cobertura |
|---|---|
| `parse.test.ts` | Parsers de todos los endpoints; `null` cuando falta un dato (nunca 0 inventado) |
| `analytics.test.ts` | Récords, rachas, K/D agregado, mapas por ventana, **PvP**: compartidas / compañeros / rivales comprobadas contra los datos de las fixtures, filtro de periodo |
| `history-scan.test.ts` | Escaneo progresivo por bloques, cobertura parcial, «completo», refresco incremental de partidas nuevas |
| `strength.test.ts` | Fórmula exacta del SPI, renormalización de componentes, `null` cuando no hay datos |
| `rate-limiter.test.ts` | Concurrencia máxima, reintentos 429/5xx con `Retry-After`, sin reintento en 4xx |
| `cache.test.ts` | Caché con TTL, agrupación de peticiones en curso, `force`, TTL según el valor (IndexedDB simulado) |
| `faceit-url.test.ts` | Rutas de perfil y sala, entrada del buscador, rechazo de dominios ajenos |
| `auto-accept.test.ts` | Detección del diálogo (EN/ES), ignora invitaciones a party, botones ocultos o deshabilitados y textos ajenos, clic seguro |
| `manifest.test.ts` | Service worker en Chromium y `background.scripts` en Firefox, permisos mínimos y `open.faceit.com` como único host |
| `intel.test.ts` | Enemy Intel: encuentros previos contra los datos de las fixtures, mapas con muestra mínima, premades (agrupación), tabla de veto |
| `proxy.test.ts` | Worker de Cloudflare: reenvío con la clave secreta (sin devolverla), caché, rechazo de rutas, parámetros y métodos no permitidos, rate limit, 401→502, FACEIT caído, orígenes |
| `transport.test.ts` | Modo público sin clave → proxy y sin `Authorization`; clave propia → directo y con prioridad; sin nada → error claro |
| `settings.test.ts` | Valores por defecto seguros y borrado de los ajustes de backend de versiones anteriores |

## End-to-end (`scripts/e2e.mjs`)

Compila una copia en `dist-e2e/chrome` con un proxy de prueba
(`https://sykos-proxy.e2e.test`), la carga en Chromium (headless nuevo),
intercepta las peticiones del service worker al proxy y a `open.faceit.com` y
responde con las fixtures deterministas de `tests/fixtures/`. Comprueba:

1. Overview con perfil y estadísticas.
2. Player vs Player: los números de las tarjetas coinciden con los datos de las fixtures.
3. Historial con el scoreboard desplegable y los botones VER PARTIDA.
4. Lobby Analyzer: YOUR TEAM vs ENEMY TEAM, 10 jugadores, pestañas Intel, Fuerza y Mapas.
5. Map Statistics, Settings y el popup (perfil, ELO, win rate, últimas partidas, ≤ 600 px de alto).
6. Content script en `www.faceit.com` (respuesta simulada): panel de perfil, pestaña VS tú y sala.
7. Auto Accept **desactivado**: avisa y **no** pulsa.
8. Auto Accept **activado**: cuenta atrás y un único clic en el botón oficial.
9. Auto Accept **cancelado**: no pulsa.
10. Red en modo público: todas las llamadas van al proxy, **sin** ninguna clave, y ninguna sale hacia otro dominio.
11. Clave propia: la prueba de conexión va directa a `open.faceit.com` con `Bearer <clave>`.

Además, el Worker se ha ejecutado en el runtime local de Cloudflare (`wrangler dev`): `/health`, rechazo de rutas, parámetros y métodos, y 502 cuando FACEIT no responde.

Las capturas se guardan en `dist/e2e/` (o en `$E2E_OUT`).

## Lo que no cubren las pruebas automáticas

* La API real de FACEIT y su HTML real: se usan fixtures porque el entorno de CI
  no tiene clave ni red hacia FACEIT. Haz una prueba manual con una clave real
  antes de cada versión (ver `05-publicacion.md`).
* Firefox: el build de Firefox se genera y se valida su manifest; la carga manual
  en Firefox está en `03-instalacion.md`.
