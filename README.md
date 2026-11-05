# SykosTracker

**Analítica de Counter-Strike 2 para FACEIT, entera dentro del navegador**:
perfiles, Player vs Player, historial de partidas, Lobby Analyzer de los 10
jugadores con sus últimos 10 mapas, avisos de "ya jugaste con/contra él" y rendimiento por mapa.
Para Chrome, Edge, Brave, Opera y Firefox.

**Solo tu nickname: sin registro ni cuentas.** Todo funciona dentro de la
extensión y los datos se guardan en tu navegador. Las consultas a FACEIT pasan
por un servidor mínimo en Cloudflare que añade la API key del editor (sin
guardar nada). Quien quiera puede usar su propia key y hablar directamente con
FACEIT.

> SykosTracker es un proyecto independiente y **no está afiliado a FACEIT ni a
> Valve**. Todas las estadísticas vienen de la FACEIT Data API oficial. Si un
> dato no existe, se muestra «—» o «no disponible»; nunca se inventa.

## Funciones

| Función | Dónde | Detalle |
|---|---|---|
| **Panel de perfil** | En cada perfil de faceit.com | Nivel, ELO, win rate, partidas, V/D, K/D, K/R, ADR, HS%, rachas, últimas 20 partidas, ELO observado, mapas |
| **Player vs Player** | Pestaña *VS tú* del perfil · *Player Comparison* | Partidas compartidas ≠ enfrentamientos directos; como compañeros y como rivales, récord H2H, K/D, ADR y HS% en enfrentamientos, mapas, última vez juntos o frente a frente, historial cronológico, filtros 7 d / 30 d / 3 m / 6 m / todo, **aviso de resultados parciales** |
| **Historial de partidas** | *Match History* | ID, fecha, mapa, resultado, score, equipos, jugadores, duración, scoreboard completo, **VER PARTIDA**, stats de cada jugador, filtros y orden |
| **Sala (Lobby)** | Automático al entrar en una sala (durante el veto) | Los 10 jugadores en dos tablas (Your team / Enemy team): nivel, ELO y sus **últimos 10 mapas** (W/L) con WR, K/D, ADR y HS%, media de cada equipo y un aviso **«N× vs» / «N× con»** si ya jugaste contra o con ese jugador |
| **Auto Accept** | faceit.com · popup · Settings | Opcional y **desactivado por defecto**. Hay que aceptar un aviso, tiene cuenta atrás cancelable y botón *Desactivar*. Si está apagado, avisa con notificación y sonido |
| **Buscador global** | Dashboard y popup | Nickname, URL de FACEIT o ID de partida, con sugerencias, búsquedas recientes y favoritos |
| **Popup** | Icono de la extensión | Sencillo: tu tarjeta con ELO, WR, K/D, últimas 5 partidas, **barra de progreso al siguiente nivel** y **«Hoy»** (V/D y K/D de hoy), Auto-aceptar y *Ver análisis completo* |
| **Análisis completo** | Página interna `dashboard/index.html` | Solo 4 secciones: Mi perfil, Comparar jugador (con favoritos y búsquedas), Historial y Ajustes (lo avanzado, plegado) |

## Inicio rápido

```bash
npm install
```

```bash
npm run build
```

Para que funcione **para todo el público con solo el nickname**, publica antes el
servidor de Cloudflare y pon su URL en `sykos.config.json`. Tienes la guía paso a
paso en [docs/08-servidor-cloudflare.md](docs/08-servidor-cloudflare.md).
Después, carga `dist/chrome` (o la carpeta de tu navegador) como extensión
descomprimida.

> **Por qué hace falta una clave.** La FACEIT Data API no admite peticiones
> anónimas y App Studio solo emite claves **server-side**, que son secretas.
> Esa clave nunca va dentro de la extensión: vive como secreto en el Worker de
> Cloudflare (`proxy/`). Si no configuras ningún servidor, cada usuario tendrá
> que pegar su propia clave. Más detalles en [docs/04](docs/04-clave-faceit-api.md).

## Idiomas

La interfaz está en **inglés, español (rioplatense, con «vos»), portugués (BR),
ruso, ucraniano, alemán, francés, polaco y turco**: los más comunes entre
jugadores de CS2 en FACEIT. Por defecto sigue el idioma del navegador; se puede
cambiar en el popup o en *Ajustes → Idioma*. El nombre y la descripción de la
extensión también están traducidos (`extension/_locales/`) para la tienda.

Los textos están en `shared/i18n/locales/<idioma>.ts`. Para agregar un idioma,
copiá `en.ts`, traducilo y sumalo a `LANGS` en `shared/i18n/index.ts`. Hay un
test que falla si a algún idioma le falta un texto.

## Tus enlaces (X / Twitter y donaciones)

Se configuran en `sykos.config.json` y aparecen en el popup y en el menú del
análisis completo. Si dejas uno vacío, no se muestra. Después de cambiarlos,
ejecuta `npm run build`.

```json
{
  "proxyUrl": "https://sykostracker-proxy.storealts.workers.dev",
  "twitter": "https://x.com/sykoszyn",
  "donate": ""
}
```

En `donate` puedes poner cualquier enlace `https://` (Ko-fi, Cafecito, PayPal, Mercado Pago…).

## Documentación

1. [Auditoría de la API y viabilidad](docs/01-auditoria-api.md): endpoints, qué datos existen y qué alternativas hay.
2. [Arquitectura](docs/02-arquitectura.md): módulos, caché, rate limit y seguridad.
3. [Instalación](docs/03-instalacion.md): Chrome, Edge, Brave, Opera y Firefox.
4. [Clave de la FACEIT API (sin backend)](docs/04-clave-faceit-api.md)
5. [Publicación en tiendas](docs/05-publicacion.md)
6. [Política de privacidad](docs/06-privacidad.md)
7. [Pruebas](docs/07-testing.md)
8. [Servidor en Cloudflare (modo público, solo nickname)](docs/08-servidor-cloudflare.md)

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila las 5 variantes en `dist/<navegador>` |
| `npm run build:chrome` / `build:firefox` | Solo un navegador |
| `npm run pack` | Compila y crea los zip para las tiendas |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run e2e` | End-to-end: compila una copia en `dist-e2e/` y la prueba en Chromium, con el proxy y FACEIT interceptados con fixtures |
| `npm run icons` | Regenera los iconos PNG desde el SVG del logo |

## Estructura

```
extension/   background · content · popup · compat · manifest · assets
dashboard/   components · pages · hooks · services · charts
shared/      types · utils · constants · rpc · settings
tests/       pruebas unitarias + fixtures deterministas
proxy/       Worker de Cloudflare (añade la API key de FACEIT; sin estado)
scripts/     build · pack · icons · e2e
docs/        documentación (ES)
```

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · WebExtensions Manifest V3
(service worker en Chromium, event page en Firefox) · `storage.local` + IndexedDB.
Servidor opcional: un Cloudflare Worker sin estado (`proxy/`).

## Limitaciones conocidas

* **Evolución del ELO**: la FACEIT Data API solo devuelve el ELO actual.
  SykosTracker dibuja el ELO **que va observando** desde que empiezas a usarlo, y
  lo indica en el gráfico.
* **ELO ganado o perdido por partida**: no está en la API; se muestra como «no
  disponible».
* **Lobby durante la búsqueda**: hasta que FACEIT asigna la sala no hay
  jugadores. El análisis empieza al abrir la sala (veto), antes de que empiece la
  partida.
* **Clave de API**: FACEIT exige una clave para cualquier consulta. En el modo público, todos los usuarios comparten la cuota de la clave del editor (ver [docs/08](docs/08-servidor-cloudflare.md)).
* **Historial PvP completo**: se escanea poco a poco (100 partidas por petición).
  Mientras no se haya terminado, la interfaz avisa de que los resultados son
  parciales.
* **Auto Accept**: depende del HTML de FACEIT (si cambia, no pulsa nada) y su uso
  puede no estar permitido por las condiciones de FACEIT. Lo activas bajo tu
  responsabilidad; por eso viene apagado y en modo aviso.
* La compatibilidad con la API real no se pudo verificar desde el entorno de
  desarrollo. Ver la nota de la [auditoría](docs/01-auditoria-api.md).
