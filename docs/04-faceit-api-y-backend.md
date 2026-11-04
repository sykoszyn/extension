# Configuración de la FACEIT API y del backend

## 1. Crear la app y las claves en FACEIT

1. Entra en <https://developers.faceit.com> con tu cuenta de FACEIT.
2. **App Studio → Create App**: nombre (p. ej. `SykosTracker`) y descripción.
3. En la app, **API Keys → Create**:
   * **Server side**: para el backend (modo recomendado). **No la pongas nunca en la extensión.**
   * **Client side** (opcional): para el modo *directo*, que se pega en *Settings*.
4. Revisa las condiciones de uso de la API de FACEIT antes de distribuir la extensión.

## 2. Desplegar el backend en Supabase

Requiere la [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
cd backend
```

```bash
supabase login
```

```bash
supabase link --project-ref <tu-project-ref>
```

Aplica las migraciones (tablas `api_cache` y `rate_limits`, RLS y funciones):

```bash
supabase db push
```

Configura los secretos. Copia `supabase/.env.example` a `supabase/.env`, rellénalo y ejecuta:

```bash
supabase secrets set --env-file supabase/.env
```

Despliega la función (la opción `verify_jwt = false` ya está en `config.toml`):

```bash
supabase functions deploy faceit-proxy
```

### Secretos

| Variable | Obligatoria | Descripción |
|---|---|---|
| `FACEIT_API_KEY` | ✅ | Clave **server-side** de FACEIT |
| `ALLOWED_ORIGINS` | Recomendada | Orígenes permitidos, separados por comas. Acepta `*` al final, p. ej. `chrome-extension://<id>,moz-extension://*` (en Firefox el UUID cambia en cada instalación). Si se define, se rechazan las peticiones sin cabecera `Origin`. Si está vacía, se acepta cualquier origen |
| `RATE_LIMIT_PER_MINUTE` | No | Peticiones por instalación/IP y minuto (por defecto 120) |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase automáticamente.

### Conectar la extensión

En *Settings → Conexión*:

* **URL**: `https://<project-ref>.supabase.co`
* **Anon key**: *Project Settings → API → anon / publishable key*. Es pública por
  diseño. Con RLS activado y sin políticas, no da acceso a ninguna tabla.

Pulsa **Guardar y probar**. Si ves «Conexión correcta», todo funciona.

### Comprobar el despliegue

```bash
curl -s -X POST "https://<ref>.supabase.co/functions/v1/faceit-proxy" -H "apikey: <anon>" -H "Content-Type: application/json" -d '{"path":"/players","query":{"nickname":"s1mple","game":"cs2"}}'
```

## 3. Modo directo (sin backend)

Pega tu clave **client-side** en *Settings → Clave propia*. Se guarda solo en el
`storage.local` del navegador. No hay caché compartida, así que gastarás más
cuota que con el backend.

## Errores frecuentes

| Mensaje | Causa |
|---|---|
| «Conexión no configurada» | Faltan la URL o la anon key, o la clave en modo directo |
| «Clave de API rechazada por FACEIT (401)» | La clave no es válida o es de otro tipo |
| «origin not allowed» (403) | El ID de la extensión no está en `ALLOWED_ORIGINS` |
| «Límite de peticiones alcanzado» | 429 de FACEIT o del backend; SykosTracker reintenta solo |
| «FACEIT_API_KEY secret is not set» | Falta el secreto en Supabase |
