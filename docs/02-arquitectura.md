# Arquitectura

Todo ocurre dentro de la extensión: no hay web, ni servidor, ni cuenta propia.

```
┌──────────────────────── Navegador (extensión) ──────────────────────┐
│                                                                     │
│  www.faceit.com ── content.js (Shadow DOM)                          │
│     · router por URL (perfil / sala)                                │
│     · panel de perfil + VS tú · Lobby Analyzer + Enemy Intel        │
│     · detección de partida encontrada / Auto Accept                 │
│                │ runtime.sendMessage (RPC tipado)                   │
│  popup ────────┤   (perfil, ELO, WR, últimas partidas)              │
│  dashboard ────┤   (página interna dashboard/index.html)            │
│                ▼                                                    │
│  background.js (service worker en Chromium, event page en Firefox)  │
│     · router RPC            · FaceitClient (endpoints)              │
│     · caché memoria + IndexedDB, dedupe de peticiones               │
│     · RateLimiter (concurrencia, espaciado, backoff, 429)           │
│     · escaneo progresivo del historial (PvP / Intel)                │
│     · registro del ELO observado                                    │
│                                                                     │
│  storage.local: ajustes, clave client-side, favoritos, búsquedas,   │
│                 preferencias de Auto Accept                         │
│  IndexedDB:     caché de la API, historial descubierto, ELO         │
└────────────────┬────────────────────────────────────────────────────┘
                 │ HTTPS (única conexión externa)
                 ▼
        open.faceit.com/data/v4  (FACEIT Data API oficial)
```

## Módulos

| Ruta | Responsabilidad |
|---|---|
| `shared/types` | Tipos de dominio normalizados (`faceit.ts`), analíticos (`analytics.ts`) y ajustes (`settings.ts`). `null` significa siempre «la fuente no lo da». |
| `shared/constants` | URLs, TTL de caché, parámetros del rate limiter, mapas y filtros de periodo. |
| `shared/utils/parse.ts` | JSON de FACEIT → tipos de dominio. Defensivo, con varias claves por campo. |
| `shared/utils/analytics.ts` | Funciones puras: récords, rachas, forma, mapas por ventana, **Player vs Player**. |
| `shared/utils/intel.ts` | **Enemy Intelligence**: encuentros previos, mejores y peores mapas, posibles premades y tabla de veto. |
| `shared/utils/strength.ts` | **SykosTracker Performance Index**: fórmula pública y documentada. |
| `shared/utils/faceit-url.ts` | Reconoce las URL de perfil y de sala, y lo que se escribe en el buscador. |
| `shared/utils/format.ts`, `maps.ts` | Presentación: números (`—` para `null`), fechas, banderas, colores por nivel y por mapa. |
| `shared/rpc.ts` | Contrato RPC tipado entre la interfaz y el background. |
| `shared/settings.ts` | Ajustes, favoritos y búsquedas recientes en `storage.local`. Invariante: Auto Accept no puede estar activo sin haber aceptado el aviso. |
| `extension/compat/browser.ts` | **Capa de compatibilidad**: `browser`/`chrome`, mensajes asíncronos, notificaciones (Firefox ignora `requireInteraction`), `storage.session`. |
| `extension/background/` | `index.ts` (router), `faceit-client.ts` (endpoints + TTL), `transport.ts` (conexión directa con FACEIT, resolución de la clave, lista de rutas permitidas), `rate-limiter.ts`, `db.ts` (IndexedDB + caché), `history-scan.ts`, `services.ts` (PvP, lobby, Enemy Intel). |
| `extension/content/` | `index.tsx` (montaje en Shadow DOM, router SPA, paneles), `auto-accept.ts` (detección conservadora y clic seguro), `AcceptOverlay.tsx`. |
| `extension/popup/` | Popup: tu perfil, buscador, accesos directos e interruptor de Auto Accept. |
| `extension/manifest/build-manifest.mjs` | Manifest por navegador. |
| `dashboard/components` | Sistema de diseño (`ui.tsx`) y componentes de cada función: `PlayerOverview`, `PvpPanel`, `MatchHistory`, `LobbyView`, `EnemyIntel`, `MapPerformance`, `PlayerSearch`. Los usan el dashboard y el content script. |
| `dashboard/charts` | Envoltorios de Recharts con la especificación visual (paleta validada para daltonismo y fondo oscuro). |
| `dashboard/pages`, `hooks` | Páginas del dashboard, enrutado por hash, `useRpc`, `useSettings`, `useFavorites`. |
| `tests/` | Pruebas unitarias (Vitest) y fixtures deterministas. |
| `scripts/` | `build.mjs`, `pack.mjs`, `icons.mjs`, `e2e.mjs` (Chromium real, con la API interceptada). |

## Caché y rendimiento

| Dato | TTL |
|---|---|
| Perfil | 10 min |
| Lifetime | 30 min |
| Últimas partidas | 10 min |
| Página de historial | 5 min |
| Sala en curso | 20 s |
| Sala terminada / scoreboard | 30 días |
| Búsqueda | 1 h |
| Historial descubierto (PvP/Intel) | Permanente, solo se añaden partidas nuevas |

* Si llegan N peticiones simultáneas con la misma clave, se hace **una sola**
  llamada de red (`cached()` agrupa las que están en curso).
* Las consultas solo se lanzan cuando se abre una vista: ni sondeo en segundo
  plano ni prefetch.
* La sala se refresca cada 20 s **solo** mientras está en un estado activo (veto),
  para recoger el mapa elegido. Los datos de los jugadores salen de la caché.
* Una alarma cada 6 h borra las entradas de caché caducadas.

## Seguridad y privacidad

* Sin cuenta propia, sin servidor y sin telemetría. La única conexión externa es
  `open.faceit.com` (comprobado en el e2e).
* Ni contraseñas, ni cookies, ni tokens de FACEIT. Lo único que se guarda del
  usuario es su nickname público, su ID y su clave client-side, todo en
  `storage.local`.
* No se puede usar una clave server-side (secreta) sin servidor, así que la
  extensión solo trabaja con claves client-side (ver
  [04-clave-faceit-api.md](04-clave-faceit-api.md)).
* Peticiones con `credentials: 'omit'` y sin `Referer`, y solo a una lista de
  rutas permitidas de solo lectura.
* Permisos mínimos: `storage`, `unlimitedStorage`, `notifications`, `alarms`.
  Host: `open.faceit.com`. El content script solo se ejecuta en
  `https://www.faceit.com/*`. Sin `tabs`, `cookies`, `webRequest` ni `<all_urls>`.
* CSP de las páginas de la extensión: `script-src 'self'`; no se carga código remoto.
* El background solo acepta mensajes de la propia extensión.
