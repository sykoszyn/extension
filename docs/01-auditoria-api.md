# Fase 1 · Auditoría de APIs y viabilidad técnica

> **Nota de verificación.** Durante el desarrollo, el entorno de construcción no
> tenía acceso de red a `open.faceit.com` ni a `docs.faceit.com`. Los endpoints y
> los nombres de campos se basan en la documentación pública de la FACEIT Data
> API v4 tal y como la conocemos. Por eso **todos los parsers son defensivos**
> (aceptan varias claves posibles y devuelven `null` en lugar de inventar valores).
> Antes de publicar, ejecuta la prueba de conexión de *Ajustes → Guardar y probar*
> con una clave real y revisa una sala y un perfil reales.

## 1. Fuentes de datos

| Fuente | Uso en SykosTracker | Autenticación |
|---|---|---|
| **FACEIT Data API v4** (`https://open.faceit.com/data/v4`) | Única fuente de estadísticas | `Authorization: Bearer <API key>` |
| FACEIT web (`www.faceit.com`) | Solo se lee la **URL** (nickname o ID de partida) y, para Auto Accept, el diálogo visible de partida encontrada | Ninguna: no se leen cookies ni tokens |
| Steam Web API | **No usada.** FACEIT ya devuelve el nickname de Steam; no hace falta | — |
| FACEIT Match / Chat / Downloads API | **No usadas.** Requieren acuerdos o scopes de organizador | — |

### Autenticación (sin backend)

La Data API **siempre** necesita `Authorization: Bearer <API key>`; no admite
peticiones anónimas. App Studio de FACEIT emite claves **server-side**, que son
secretas. SykosTracker no tiene servidor, así que:

* no incluye ninguna clave en el paquete;
* cada usuario pega **su propia** clave en *Configuración*; se guarda solo en su
  `storage.local` y solo la usa el background para llamar a `open.faceit.com`.

Alternativas descartadas y motivos: [04-clave-faceit-api.md](04-clave-faceit-api.md).

## 2. Endpoints usados (todos `GET`, solo lectura)

| Endpoint | Datos que obtenemos | Límites / notas |
|---|---|---|
| `/players?nickname=&game=cs2` | id, nickname, avatar, país, `games.cs2.faceit_elo`, `skill_level`, región, nickname de Steam, `faceit_url` | El `faceit_url` contiene `{lang}`; se sustituye |
| `/players/{id}` | Igual que arriba, por ID | — |
| `/players/{id}/stats/cs2` | `lifetime`: Matches, Wins, Win Rate %, Average K/D Ratio, Average Headshots %, ADR (CS2), Longest/Current Win Streak, Recent Results (5). `segments[]` por mapa | 404 si el jugador no tiene CS2 → «sin datos» |
| `/players/{id}/games/cs2/stats?offset&limit` | Una línea por partida: Match Id, Map, Result, Kills, Deaths, Assists, K/D, K/R, ADR, HS %, MVPs, Score, Rounds, Match Finished At | `limit` ≤ 100 por petición |
| `/players/{id}/history?game=cs2&from&to&offset&limit` | Lista de partidas con **los dos rosters**, ganador, fechas, `faceit_url`. **No incluye mapa** | `limit` ≤ 100. Si se omite `from`, FACEIT usa por defecto un periodo reciente → enviamos siempre `from` = 2023-01-01. Paginamos con el cursor `to` para no usar offsets enormes |
| `/matches/{id}` | Estado de la sala, equipos (`roster`), veto (`voting.map.entities` / `pick`), región, ganador | Disponible **antes** de que empiece la partida (VOTING / CONFIGURING / READY) |
| `/matches/{id}/stats` | Scoreboard por jugador (K, D, A, K/D, K/R, ADR, HS %, MVPs), mapa, score y rondas | Solo partidas terminadas; 404 en otro caso |
| `/search/players?nickname=&game=cs2` | Sugerencias del buscador | — |

### Límites de peticiones

FACEIT aplica cuotas por clave, pero no publica una cifra estable y fácil de
encontrar para todas las claves. En lugar de dar por buena una cifra concreta:

* el **cliente** limita la concurrencia (4) y deja ≥110 ms entre peticiones,
  reintenta 429 y 5xx con backoff exponencial (respetando `Retry-After`), y ante
  un 429 pausa **toda la cola**;
* todo se cachea en IndexedDB y nunca se vuelve a pedir lo que ya está guardado (por ejemplo, las partidas terminadas).

## 3. Disponibilidad de cada estadística pedida

| Estadística | Disponible | Cómo se obtiene / alternativa |
|---|---|---|
| Nickname, nivel, ELO actual | ✅ | `/players` |
| Win rate, partidas, victorias | ✅ | lifetime. Derrotas = partidas − victorias (cálculo explícito) |
| K/D, HS%, ADR lifetime | ✅ | lifetime CS2 (si FACEIT no devuelve ADR lifetime se avisa y se muestra el de las últimas 20) |
| K/R | ⚠️ parcial | No hay un K/R lifetime fiable → se muestra **K/R de las últimas 20**, indicado como tal |
| Racha actual / mejor racha | ✅ | `Current/Longest Win Streak` + cálculo sobre las partidas recientes |
| Últimas 20 partidas | ✅ | `/games/cs2/stats?limit=20` |
| **Evolución del ELO** | ❌ en la API | La Data API solo da el **ELO actual**. SykosTracker **registra el ELO que observa** cada vez que consultas a un jugador y dibuja esa serie, etiquetada como «ELO observado por SykosTracker». Nunca se interpola ni se inventa |
| **ELO antes/después de cada partida** | ❌ | No expuesto → «no disponible» en el detalle de la partida |
| Duración de la partida | ✅ | `finished_at − started_at` |
| Rendimiento por mapa (lifetime) | ✅ | `segments` |
| Rendimiento por mapa (últimas 5/10/20/50/100) | ✅ | Calculado sobre `/games/cs2/stats` |
| Rachas por mapa | ✅ (calculado) | Sobre la ventana elegida; se indica la ventana |
| Partidas compartidas / compañero / rival | ✅ | Rosters de `/history` |
| Encuentros previos en la sala («N× vs / N× con») | ✅ (derivado) | Historial local del usuario (`/players/{id}/history`, rosters) |
| Progreso al siguiente nivel | ✅ | ELO actual + umbrales CS2 de FACEIT (verificados con datos reales) |
| K/D / ADR en enfrentamientos directos | ✅ (progresivo) | `/matches/{id}/stats` de cada partida compartida, con límite por consulta y caché permanente |
| Mapa de cada partida del historial | ✅ (progresivo) | De `/games/cs2/stats` (últimas 100) o del scoreboard al abrirla |
| Banderas | ✅ | Campo `country` (ISO-2) → emoji. Sin imágenes de terceros |
| Iconos de mapas | ⚠️ | No usamos arte de Valve/FACEIT: insignias tipográficas propias con color por mapa |
| Probabilidad de victoria / ELO estimado por partida | 🚫 (deliberado) | No se calcula: dependería de datos no oficiales o fórmulas opacas |
| Jugadores del lobby antes de empezar | ✅ | `/matches/{id}` está disponible desde la sala (veto). En la **cola de búsqueda** FACEIT todavía no ha asignado partida: no existe ningún dato de lobby que analizar |

## 4. Player vs Player: estrategia para el historial completo

1. Se escanea **solo el historial del usuario** (los rosters incluyen al rival), en
   páginas de 100 con cursor `to`, como mucho `pvpPagesPerScan` páginas por consulta.
2. Lo descubierto se guarda en IndexedDB (`history`). En cada consulta solo se
   piden las partidas **nuevas** (`from` = la partida más reciente conocida).
3. Si el escaneo no ha llegado al principio del historial, la interfaz muestra
   **«Resultados parciales · N partidas escaneadas desde FECHA»** y un botón para
   seguir escaneando hacia atrás.
4. Los scoreboards (`/matches/{id}/stats`) se descargan de forma progresiva
   (`pvpStatsPerScan` por consulta) y se cachean 30 días. La interfaz muestra
   «estadísticas detalladas en X/Y».
5. *Partida compartida* = mismo match. *Enfrentamiento directo* = facciones
   distintas. Se calculan y se muestran por separado.

## 5. Auto Accept: viabilidad y riesgos

* No existe una API pública para aceptar partidas. La única vía legítima es la
  propia interfaz de FACEIT.
* SykosTracker **solo** busca el botón «Aceptar» visible del diálogo de partida
  encontrada y, si el usuario lo activó y aceptó el aviso, llama a `click()` tras
  una cuenta atrás que se puede cancelar. No intercepta, crea ni modifica
  peticiones, ni toca tokens.
* La automatización de la interfaz puede ir contra las condiciones de FACEIT. Por
  eso: viene **desactivado**, hay que **aceptar un aviso** antes de poder activarlo,
  y el modo por defecto es **detección + aviso + aceptación manual**.
* Si FACEIT cambia su HTML, la detección falla de forma segura: no se pulsa nada.
* Los clics generados por scripts tienen `isTrusted = false`. Si FACEIT los
  ignorase, Auto Accept no aceptaría, pero el aviso seguiría funcionando.

## 6. Lo que SykosTracker no hace

Scraping del DOM de estadísticas, uso de endpoints privados o internos
(`api.faceit.com/...`), lectura de cookies o tokens de sesión, peticiones
automáticas mientras navegas por páginas que no te interesan, ni valores
estimados presentados como reales.
