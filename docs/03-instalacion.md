# Instalación

## Requisitos

* Node.js 20 o superior (probado con Node 22) y npm.
* Una forma de acceder a la FACEIT Data API: un backend de Supabase (recomendado)
  o tu propia clave client-side. Consulta [04-faceit-api-y-backend.md](04-faceit-api-y-backend.md).

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
   `www.faceit.com` y a `*.supabase.co` está permitido. En MV3, Firefox permite
   que el usuario retire los permisos de host.

Instalación permanente: Firefox estable solo instala complementos firmados. Sube
el zip a AMO como *unlisted* (autodistribución) para obtener un `.xpi` firmado;
consulta [05-publicacion.md](05-publicacion.md).

## Primer uso

1. **Settings → Conexión con FACEIT API**: elige *Backend Supabase* (URL + anon
   key) o *Clave propia*. Pulsa **Guardar y probar**.
2. **Settings → Tu cuenta**: escribe tu nickname y pulsa **Vincular**.
3. Entra en el perfil de cualquier jugador en faceit.com: aparece el panel con
   *Estadísticas* y *VS tú*.
4. Al entrar en una sala (`/cs2/room/…`), el Lobby Analyzer carga a los 10
   jugadores.

## Probar sin clave de FACEIT (datos de prueba)

```bash
node scripts/mock-backend.mjs
```

En *Settings*, elige el modo *Backend*, URL `http://localhost:8787` y cualquier
anon key. Vincula el nickname `Sykos` y compárate con `Player123`. Son datos
**ficticios y deterministas**, solo para probar la interfaz.
