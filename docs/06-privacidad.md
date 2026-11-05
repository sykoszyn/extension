# Política de privacidad de SykosTracker

*Última actualización: 4 de noviembre de 2026*

SykosTracker es una extensión de navegador independiente. **No tiene cuentas de usuario** y todo se guarda en tu navegador. El único servidor es un intermediario sin estado que añade la API key de FACEIT. **No está afiliada a FACEIT ni a Valve.**

## Qué datos se tratan

| Dato | Dónde se guarda | Para qué |
|---|---|---|
| Tu nickname público de FACEIT y tu ID de jugador | `storage.local` de tu navegador | Separar YOUR TEAM / ENEMY TEAM y calcular Player vs Player |
| Ajustes, favoritos y búsquedas recientes | `storage.local` de tu navegador | Funcionamiento de la interfaz |
| Respuestas de la FACEIT Data API (estadísticas públicas) e historial de enfrentamientos descubierto | IndexedDB de tu navegador | No repetir peticiones; Player vs Player y avisos «ya jugaste con/contra él» |
| ELO observado de los jugadores que consultas | IndexedDB de tu navegador | Gráfico de evolución del ELO |
| Tu API key de FACEIT | `storage.local` de tu navegador (nunca sale salvo hacia `open.faceit.com`) | Autenticar las peticiones a FACEIT |
| Preferencias de Auto Accept | `storage.local` de tu navegador | Funcionamiento de Auto Accept |

## Qué no hace SykosTracker

* No pide ni guarda contraseñas.
* No lee cookies ni tokens de sesión de FACEIT.
* Las consultas (nicknames, IDs de jugador e IDs de partida) van a la FACEIT Data
  API (`open.faceit.com`) a través del **servidor de SykosTracker** en Cloudflare
  Workers, que añade la API key. Ese servidor ve tu IP y lo que consultas, porque
  es un intermediario, pero **no lo guarda**: no tiene base de datos y solo cachea
  las respuestas públicas de FACEIT. Cloudflare puede registrar metadatos técnicos
  según su propia política de privacidad.
* Si pegas tu propia API key, las consultas van directamente a `open.faceit.com` y
  no pasan por el servidor.
* No tiene analítica ni telemetría, y no vende ni comparte datos.
* No registra tu navegación fuera de `www.faceit.com`.

## Retención

La caché local caduca entre 20 segundos y 30 días, según el tipo de dato. El
historial de enfrentamientos se guarda hasta que lo borres. Todo se elimina desde
*Configuración → Vaciar caché* o al desinstalar la extensión.

## Contacto

Abre una incidencia en el repositorio del proyecto.
