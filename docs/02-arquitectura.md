# Arquitectura

```
┌──────────────────────── Navegador ─────────────────────────┐
│                                                             │
│  www.faceit.com ── content.js (Shadow DOM)                  │
│     · router por URL (perfil / sala)                        │
│     · panel de perfil + VS tú · Lobby Analyzer              │
│     · detección de partida encontrada / Auto Accept         │
│                │ runtime.sendMessage (RPC tipado)           │
│  popup ────────┤                                            │
│  dashboard ────┤                                            │
│                ▼                                            │
│  background.js (service worker en Chromium, event page en Firefox)
│     · router RPC            · FaceitClient (endpoints)      │
│     · caché memoria + IndexedDB, dedupe de peticiones       │
│     · RateLimiter (concurrencia, espaciado, backoff, 429)   │
│     · escaneo progresivo de historial (PvP)                 │
│     · registro de ELO observado                             │
└────────────────┬────────────────────────────────────────────┘
                 │ HTTPS
     ┌───────────┴───────────┐
     ▼                       ▼
 Supabase Edge Function   open.faceit.com
 faceit-proxy             (modo directo: clave
 (clave FACEIT secreta,    client-side del propio usuario)
  caché Postgres, RLS,
  rate limit)
     │
     ▼
 open.faceit.com/data/v4
```

## Módulos

| Ruta | Responsabilidad |
|---|---|
| `shared/types` | Tipos de dominio normalizados (`faceit.ts`), analíticos (`analytics.ts`) y ajustes (`settings.ts`). `null` significa siempre «la fuente no lo da». |
| `shared/constants` | URLs, TTL de caché, parámetros del rate limiter, mapas y filtros de periodo. |
| `shared/utils/parse.ts` | JSON de FACEIT → tipos de dominio. Defensivo, con varias claves por campo. |
| `shared/utils/analytics.ts` | Funciones puras: récords, rachas, forma, mapas por ventana, **Player vs Player**. |
| `shared/utils/strength.ts` | **SykosTracker Performance Index**: fórmula pública y documentada. |
| `shared/utils/faceit-url.ts` | Reconoce las URL de perfil y de sala, y lo que se escribe en el buscador. |
| `shared/utils/format.ts`, `maps.ts` | Presentación: números (`—` para `null`), fechas, banderas, colores por nivel y por mapa. |
| `shared/rpc.ts` | Contrato RPC tipado entre la interfaz y el background. |
| `shared/settings.ts` | Ajustes, favoritos y búsquedas recientes en `storage.local`. Invariante: Auto Accept no puede estar activo sin haber aceptado el aviso. |
| `extension/compat/browser.ts` | **Capa de compatibilidad**: `browser`/`chrome`, mensajes asíncronos, notificaciones (Firefox ignora `requireInteraction`), `storage.session`. |
| `extension/background/` | `index.ts` (router), `faceit-client.ts` (endpoints + TTL), `transport.ts` (backend/directo, lista de rutas permitidas), `rate-limiter.ts`, `db.ts` (IndexedDB + caché), `history-scan.ts`, `services.ts` (PvP y lobby). |
| `extension/content/` | `index.tsx` (montaje en Shadow DOM, router SPA, paneles), `auto-accept.ts` (detección conservadora y clic seguro), `AcceptOverlay.tsx`. |
| `extension/popup/` | Popup: tu perfil, buscador, accesos directos e interruptor de Auto Accept. |
| `extension/manifest/build-manifest.mjs` | Manifest por navegador. |
| `dashboard/components` | Sistema de diseño (`ui.tsx`) y componentes de cada función: `PlayerOverview`, `PvpPanel`, `MatchHistory`, `LobbyView`, `MapPerformance`, `PlayerSearch`. Los usan el dashboard y el content script. |
| `dashboard/charts` | Envoltorios de Recharts con la especificación visual (paleta validada para daltonismo y fondo oscuro). |
| `dashboard/pages`, `hooks` | Páginas del dashboard, enrutado por hash, `useRpc`, `useSettings`, `useFavorites`. |
| `backend/supabase` | Edge Function `faceit-proxy`, migraciones SQL (caché, rate limit, RLS) y `config.toml`. |
| `tests/` | Pruebas unitarias (Vitest) y fixtures deterministas. |
| `scripts/` | `build.mjs`, `pack.mjs`, `icons.mjs`, `e2e.mjs` (Chromium real), `mock-backend.mjs`. |

## Caché y rendimiento

| Dato | TTL (cliente) | TTL (backend) |
|---|---|---|
| Perfil | 10 min | 10 min |
| Lifetime | 30 min | 30 min |
| Últimas partidas | 10 min | 10 min |
| Página de historial | 5 min | 2 min |
| Sala en curso | 20 s | 20 s |
| Sala terminada / scoreboard | 30 días | 30 días |
| Búsqueda | 1 h | 1 h |

* Si llegan N peticiones simultáneas con la misma clave, se hace **una sola**
  llamada de red (`cached()` agrupa las que están en curso).
* Las consultas solo se lanzan cuando se abre una vista: ni sondeo en segundo
  plano ni prefetch.
* La sala se refresca cada 20 s **solo** mientras está en un estado activo (veto),
  para recoger el mapa elegido. Los datos de los jugadores salen de la caché.
* Una alarma cada 6 h borra las entradas de caché caducadas.

## Seguridad

* Ni contraseñas, ni cookies, ni tokens de FACEIT. Lo único que se guarda del
  usuario es su nickname público y su ID.
* La clave server-side de FACEIT es un **secreto de Supabase**; la extensión solo
  conoce la anon key, que es pública.
* Tablas con **RLS activado y sin políticas**: `anon` y `authenticated` no pueden
  leer ni escribir (comprobado con Postgres 16 al aplicar las migraciones).
* Lista de rutas y parámetros permitidos en el cliente y en el backend: no es un
  proxy abierto.
* El rate limit usa `sha256(install_id | ip)`; no se guardan IPs en claro.
* Permisos mínimos: `storage`, `unlimitedStorage`, `notifications`, `alarms`. El
  content script solo se ejecuta en `https://www.faceit.com/*`. Sin `tabs`,
  `cookies`, `webRequest` ni `<all_urls>`.
* CSP de las páginas de la extensión: `script-src 'self'`.
* El background solo acepta mensajes de la propia extensión.
