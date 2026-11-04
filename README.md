# SykosTracker

**Analítica de Counter-Strike 2 para FACEIT**: perfiles, Player vs Player,
historial de partidas, Lobby Analyzer de los 10 jugadores, rendimiento por mapa
y comparación de equipos. Disponible para Chrome, Edge, Brave, Opera y Firefox.

> SykosTracker es un proyecto independiente y **no está afiliado a FACEIT ni a
> Valve**. Todas las estadísticas vienen de la FACEIT Data API oficial. Si un
> dato no existe, se muestra «—» o «no disponible»; nunca se inventa.

## Funciones

| Función | Dónde | Detalle |
|---|---|---|
| **Panel de perfil** | En cada perfil de faceit.com | Nivel, ELO, win rate, partidas, V/D, K/D, K/R, ADR, HS%, rachas, últimas 20 partidas, ELO observado, mapas |
| **Player vs Player** | Pestaña *VS tú* del perfil · *Player Comparison* | Partidas compartidas ≠ enfrentamientos directos; como compañeros y como rivales, récord H2H, K/D, ADR y HS% en enfrentamientos, mapas, última vez juntos o frente a frente, historial cronológico, filtros 7 d / 30 d / 3 m / 6 m / todo, **aviso de resultados parciales** |
| **Historial de partidas** | *Match History* | ID, fecha, mapa, resultado, score, equipos, jugadores, duración, scoreboard completo, **VER PARTIDA**, stats de cada jugador, filtros y orden |
| **Lobby Analyzer** | Automático al entrar en una sala (durante el veto) | Los 10 jugadores: avatar, nivel, ELO, WR, K/D, ADR, HS%, partidas, forma, racha y últimos mapas, separados en YOUR TEAM vs ENEMY TEAM |
| **Map Performance** | Sala · *Map Statistics* | Ventanas de 5/10/20 (y 50/100): partidas, WR, K/D, ADR y rachas por mapa, más tarjetas «JUGADOR — MAPA» |
| **Lobby Strength** | Sala → *Fuerza* | Medias de cada equipo, diferencia de ELO, fortalezas y debilidades, y el **SPI**: índice propio con fórmula pública, que **no es una probabilidad** |
| **Auto Accept** | faceit.com · popup · Settings | Opcional y **desactivado por defecto**. Hay que aceptar un aviso, tiene cuenta atrás cancelable y botón *Desactivar*. Si está apagado, avisa con notificación y sonido |
| **Buscador global** | Dashboard y popup | Nickname, URL de FACEIT o ID de partida, con sugerencias, búsquedas recientes y favoritos |
| **Dashboard** | Icono → *Abrir dashboard* | Overview, Player Comparison, Match History, Lobby Analyzer, Map Statistics, Favorites, Settings |

## Inicio rápido

```bash
npm install
```

```bash
npm run build
```

Carga `dist/chrome` (o `dist/firefox`, etc.) como extensión descomprimida y
configura la conexión en *Settings*. Para probar sin clave de FACEIT, arranca el
backend de prueba (`npm run mock`) y usa `http://localhost:8787` como URL.

## Documentación

1. [Auditoría de la API y viabilidad](docs/01-auditoria-api.md): endpoints, qué datos existen y qué alternativas hay.
2. [Arquitectura](docs/02-arquitectura.md): módulos, caché, rate limit y seguridad.
3. [Instalación](docs/03-instalacion.md): Chrome, Edge, Brave, Opera y Firefox.
4. [FACEIT API y backend Supabase](docs/04-faceit-api-y-backend.md)
5. [Publicación en tiendas](docs/05-publicacion.md)
6. [Política de privacidad](docs/06-privacidad.md)
7. [Pruebas](docs/07-testing.md)

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila las 5 variantes en `dist/<navegador>` |
| `npm run build:chrome` / `build:firefox` | Solo un navegador |
| `npm run pack` | Compila y crea los zip para las tiendas |
| `npm run typecheck` | TypeScript estricto |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run e2e` | End-to-end con la extensión compilada en Chromium (requiere `build`) |
| `npm run mock` | Backend de prueba con datos ficticios en `:8787` |
| `npm run icons` | Regenera los iconos PNG desde el SVG del logo |

## Estructura

```
extension/   background · content · popup · compat · manifest · assets
dashboard/   components · pages · hooks · services · charts
backend/     supabase/functions/faceit-proxy · supabase/migrations
shared/      types · utils · constants · rpc · settings
tests/       pruebas unitarias + fixtures deterministas
scripts/     build · pack · icons · e2e · mock-backend
docs/        documentación (ES)
```

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Recharts · WebExtensions Manifest V3
(service worker en Chromium, event page en Firefox) · Supabase (Edge Functions +
Postgres con RLS).

## Limitaciones conocidas

* **Evolución del ELO**: la FACEIT Data API solo devuelve el ELO actual.
  SykosTracker dibuja el ELO **que va observando** desde que empiezas a usarlo, y
  lo indica en el gráfico.
* **ELO ganado o perdido por partida**: no está en la API; se muestra como «no
  disponible».
* **Lobby durante la búsqueda**: hasta que FACEIT asigna la sala no hay
  jugadores. El análisis empieza al abrir la sala (veto), antes de que empiece la
  partida.
* **Historial PvP completo**: se escanea poco a poco (100 partidas por petición).
  Mientras no se haya terminado, la interfaz avisa de que los resultados son
  parciales.
* **Auto Accept**: depende del HTML de FACEIT (si cambia, no pulsa nada) y su uso
  puede no estar permitido por las condiciones de FACEIT. Lo activas bajo tu
  responsabilidad; por eso viene apagado y en modo aviso.
* La compatibilidad con la API real no se pudo verificar desde el entorno de
  desarrollo. Ver la nota de la [auditoría](docs/01-auditoria-api.md).
