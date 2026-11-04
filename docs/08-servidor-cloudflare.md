# Servidor de SykosTracker en Cloudflare (para que funcione con solo el nick)

La FACEIT Data API exige una API key. Para que cualquiera pueda usar
SykosTracker **sin crear la suya**, la extensión envía las consultas a un
servidor mínimo, un *Worker* de Cloudflare (carpeta `proxy/`), que añade **tu**
clave. La clave se guarda cifrada en Cloudflare y **nunca** va dentro de la
extensión.

```
Extensión ──► https://sykostracker-proxy.<tu-subdominio>.workers.dev/data/v4/...
                 │  (tu FACEIT_API_KEY, guardada como secreto)
                 ▼
             open.faceit.com/data/v4/...
```

Qué hace el Worker:

* Solo permite las consultas de lectura que usa SykosTracker; no reenvía nada más.
* Limita a 120 peticiones por minuto y por IP.
* Cachea las respuestas para gastar menos cuota de FACEIT.
* No guarda datos de usuarios, no tiene base de datos y no tiene cuentas.
* Si un usuario pega su propia API key en *Configuración*, la extensión deja de
  usar el Worker y habla directamente con FACEIT.

---

## Paso a paso

### 1. Crea una cuenta gratuita de Cloudflare

<https://dash.cloudflare.com/sign-up>. No hace falta tarjeta ni dominio.

### 2. Instala las dependencias del Worker

Desde la carpeta del proyecto:

```bash
cd proxy
```

```bash
npm install
```

### 3. Inicia sesión en Cloudflare desde la terminal

```bash
npx wrangler login
```

Se abre el navegador: pulsa **Allow**.

### 4. Publica el Worker

```bash
npx wrangler deploy
```

La primera vez te puede pedir que elijas un subdominio `workers.dev` (por
ejemplo `sykos`). Al terminar muestra la URL:

```
https://sykostracker-proxy.<tu-subdominio>.workers.dev
```

Cópiala.

### 5. Guarda tu API key de FACEIT como secreto

```bash
npx wrangler secret put FACEIT_API_KEY
```

Pega tu clave server-side de FACEIT cuando te la pida y pulsa Enter. Queda
cifrada en Cloudflare: no aparece en el código ni en `wrangler.toml`.

### 6. Comprueba que funciona

Abre en el navegador, cambiando la URL y tu nick:

* `https://sykostracker-proxy.<tu-subdominio>.workers.dev/health` debe devolver `{"ok":true,...}`.
* `https://sykostracker-proxy.<tu-subdominio>.workers.dev/data/v4/players?nickname=TU_NICK&game=cs2` debe devolver tu perfil en JSON.

Si sale `FACEIT_API_KEY secret is not set`, repite el paso 5. Si sale `proxy key
rejected by FACEIT`, la clave está mal copiada o revocada.

### 7. Conecta la extensión al Worker

Vuelve a la carpeta principal del proyecto y edita `sykos.config.json`:

```json
{
  "proxyUrl": "https://sykostracker-proxy.<tu-subdominio>.workers.dev"
}
```

Recompila:

```bash
cd ..
```

```bash
npm run build
```

En `chrome://extensions`, pulsa ↻ en SykosTracker. En *Configuración → Conexión
con FACEIT* debe aparecer «✓ Listo. Usando el servidor de SykosTracker». Si
antes pegaste tu propia clave, bórrala para probar el modo público.

### 8. Publica la extensión

Igual que en [05-publicacion.md](05-publicacion.md): `npm run pack` y sube los
zip. Los usuarios solo tienen que instalarla y escribir su nickname.

### 9. (Recomendado) Limita el Worker a tu extensión

Cuando las tiendas te den el ID definitivo de la extensión, edita
`proxy/wrangler.toml`, descomenta la sección `[vars]` y pon los orígenes:

```toml
[vars]
ALLOWED_ORIGINS = "chrome-extension://<id-chrome>,chrome-extension://<id-edge>,moz-extension://*"
```

Vuelve a publicarlo:

```bash
npx wrangler deploy
```

Es una protección adicional, no infalible: un script puede falsificar la
cabecera `Origin`. El límite por IP es la protección principal.

---

## Mantenimiento

| Tarea | Cómo |
|---|---|
| Ver las peticiones en tiempo real | `npx wrangler tail` (desde `proxy/`) |
| Ver el uso | Panel de Cloudflare → Workers & Pages → sykostracker-proxy |
| Cambiar la clave de FACEIT | `npx wrangler secret put FACEIT_API_KEY` (no hace falta actualizar la extensión) |
| Cambiar el límite por IP | `simple = { limit = 120, period = 60 }` en `wrangler.toml` y `npx wrangler deploy` |
| Apagar el servidor | Panel de Cloudflare → borrar el Worker. Los usuarios con clave propia seguirán funcionando |

## Límites y costes

* **Cloudflare Workers gratis**: 100 000 peticiones al día. El plan de pago
  (unos 5 $/mes) sube a 10 millones al mes. Como la extensión ya cachea en cada
  navegador, cada usuario gasta poco.
* **Caché del Worker**: Cloudflare solo guarda en su caché compartida las
  respuestas de Workers que usan un **dominio propio**. En `*.workers.dev` el
  Worker usa una caché en memoria, que es más limitada. Si la extensión crece,
  conecta un dominio (Workers → Settings → Domains & Routes).
* **Cuota de FACEIT**: todos los usuarios comparten la cuota de **tu** clave. Si
  empiezan a aparecer errores 429 con frecuencia, pide más límite a FACEIT
  desde developers.faceit.com o anima a los usuarios intensivos a usar su
  propia clave.
* **Privacidad**: el Worker ve la IP del usuario y lo que consulta (nicknames e
  IDs de partida), porque es un intermediario. No lo guarda. Cloudflare puede
  registrar metadatos técnicos según su propia política. Está explicado en
  [06-privacidad.md](06-privacidad.md).
