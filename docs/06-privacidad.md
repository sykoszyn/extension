# Política de privacidad de SykosTracker

*Última actualización: 4 de noviembre de 2026*

SykosTracker es una extensión de navegador independiente. **No está afiliada a FACEIT ni a Valve.**

## Qué datos se tratan

| Dato | Dónde se guarda | Para qué |
|---|---|---|
| Tu nickname público de FACEIT y tu ID de jugador | `storage.local` de tu navegador | Separar YOUR TEAM / ENEMY TEAM y calcular Player vs Player |
| Ajustes, favoritos y búsquedas recientes | `storage.local` de tu navegador | Funcionamiento de la interfaz |
| Respuestas de la FACEIT Data API (estadísticas públicas) | IndexedDB de tu navegador y, en modo backend, caché temporal en el servidor | No repetir peticiones |
| ELO observado de los jugadores que consultas | IndexedDB de tu navegador | Gráfico de evolución del ELO |
| ID de instalación aleatorio y anónimo | `storage.local` y servidor (como hash junto a la IP, como mucho 1 hora) | Limitar el número de peticiones al backend |
| Clave de API de FACEIT propia (solo en modo directo) | `storage.local` de tu navegador | Autenticar las peticiones a FACEIT |

## Qué no hace SykosTracker

* No pide ni guarda contraseñas.
* No lee cookies ni tokens de sesión de FACEIT.
* No vende datos ni los comparte con terceros, salvo las peticiones necesarias a
  la FACEIT Data API (nicknames, IDs de jugador e IDs de partida que consultas).
* No registra tu navegación fuera de `www.faceit.com`.

## Retención

La caché del servidor caduca entre 20 segundos y 30 días, según el tipo de dato.
Los contadores del rate limit se borran a la hora. Los datos locales se borran
desde *Settings → Vaciar caché* o al desinstalar la extensión.

## Contacto

Abre una incidencia en el repositorio del proyecto.
