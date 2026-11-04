# Instalación

## Requisitos

* Node.js 20 o superior (probado con Node 22) y npm.
* Para el modo público (solo nickname), el Worker de Cloudflare publicado y su
  URL en `sykos.config.json` ([08-servidor-cloudflare.md](08-servidor-cloudflare.md)).
  Sin él, cada usuario tendrá que pegar su propia API key ([04-clave-faceit-api.md](04-clave-faceit-api.md)).

## Compilar

```bash
npm install
```

```bash
npm run build
```

Se genera una carpeta por navegador, lista para cargar:

```
dist/chrome   dist/edge   dist/brave   dist/opera   dist/firefox
```

Para crear los `.zip` de las tiendas (necesita el comando `zip`):

```bash
npm run pack
```

## Google Chrome / Brave

1. Abre `chrome://extensions` (en Brave, `brave://extensions`).
2. Activa **Modo de desarrollador** (arriba a la derecha).
3. Pulsa **Cargar descomprimida** y elige `dist/chrome` (o `dist/brave`).
4. Se abre el dashboard en *Settings*: configura la conexión y vincula tu nickname.
5. Fija el icono de SykosTracker en la barra de herramientas.

## Microsoft Edge

1. `edge://extensions`, activa **Modo de desarrollador**.
2. **Cargar desempaquetada** y elige `dist/edge`.

## Opera

1. `opera://extensions`, activa **Modo de desarrollador**.
2. **Cargar desempaquetada** y elige `dist/opera`.

## Mozilla Firefox (128 o superior)

Instalación temporal, para desarrollo (se quita al cerrar Firefox):

1. Abre `about:debugging#/runtime/this-firefox`.
2. **Cargar complemento temporal…** y elige `dist/firefox/manifest.json`.
3. En `about:addons` → SykosTracker → *Permisos*, comprueba que el acceso a
   `www.faceit.com` y a `open.faceit.com` está permitido. En MV3, Firefox permite
   que el usuario retire los permisos de host.

Instalación permanente: Firefox estable solo instala complementos firmados. Sube
el zip a AMO como *unlisted* (autodistribución) para obtener un `.xpi` firmado;
consulta [05-publicacion.md](05-publicacion.md).

## Primer uso

1. Pulsa el icono de SykosTracker, escribe tu nickname de FACEIT y pulsa **Guardar**. Eso es todo.
2. Opcional: activa **Auto-aceptar partidas** (la primera vez pide una confirmación).
3. **Ver análisis completo** abre la página interna (Mi perfil, Comparar jugador,
   Historial, Ajustes). La API key propia y las opciones técnicas están en
   *Ajustes → Opciones avanzadas*, y solo hacen falta si la versión no tiene servidor.
5. En faceit.com, el perfil de cualquier jugador muestra el panel con
   *Estadísticas* y *VS tú*. Al entrar en una sala (`/cs2/room/…`), el Lobby
   Analyzer carga a los 10 jugadores con sus pestañas *Intel*, *Fuerza* y *Mapas*.
