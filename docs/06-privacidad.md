# Política de privacidad de SykosTracker

*Última actualización: 4 de noviembre de 2026*

SykosTracker es una extensión de navegador independiente. **No tiene servidores propios ni cuentas de usuario**: todo se guarda en tu navegador. **No está afiliada a FACEIT ni a Valve.**

## Qué datos se tratan

| Dato | Dónde se guarda | Para qué |
|---|---|---|
| Tu nickname público de FACEIT y tu ID de jugador | `storage.local` de tu navegador | Separar YOUR TEAM / ENEMY TEAM y calcular Player vs Player |
| Ajustes, favoritos y búsquedas recientes | `storage.local` de tu navegador | Funcionamiento de la interfaz |
| Respuestas de la FACEIT Data API (estadísticas públicas) e historial de enfrentamientos descubierto | IndexedDB de tu navegador | No repetir peticiones; Player vs Player y Enemy Intel |
| ELO observado de los jugadores que consultas | IndexedDB de tu navegador | Gráfico de evolución del ELO |
| Tu clave client-side de FACEIT | `storage.local` de tu navegador | Autenticar las peticiones a FACEIT |
| Preferencias de Auto Accept | `storage.local` de tu navegador | Funcionamiento de Auto Accept |

## Qué no hace SykosTracker

* No pide ni guarda contraseñas.
* No lee cookies ni tokens de sesión de FACEIT.
* No envía datos a ningún servidor del desarrollador, porque no existe ninguno.
  La única conexión externa es la FACEIT Data API (`open.faceit.com`), a la que
  van los nicknames, IDs de jugador e IDs de partida que consultas, junto con la
  clave de API.
* No tiene analítica ni telemetría, y no vende ni comparte datos.
* No registra tu navegación fuera de `www.faceit.com`.

## Retención

La caché local caduca entre 20 segundos y 30 días, según el tipo de dato. El
historial de enfrentamientos se guarda hasta que lo borres. Todo se elimina desde
*Configuración → Vaciar caché* o al desinstalar la extensión.

## Contacto

Abre una incidencia en el repositorio del proyecto.
