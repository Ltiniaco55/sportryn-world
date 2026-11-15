# Manual de Sportryn World

Lo importante que hay que saber para mantener, ampliar y lanzar el proyecto.

1. [Decisiones tomadas](#1-decisiones-tomadas)
2. [Cómo funciona el negocio en el código](#2-cómo-funciona-el-negocio-en-el-código)
3. [Roles y cómo se conceden](#3-roles-y-cómo-se-conceden)
4. [Seguridad: las reglas que no se rompen](#4-seguridad-las-reglas-que-no-se-rompen)
5. [Mapa del código](#5-mapa-del-código)
6. [Cómo añadir un endpoint](#6-cómo-añadir-un-endpoint)
7. [Base de datos](#7-base-de-datos)
8. [Pagos: del modo simulado a Stripe](#8-pagos-del-modo-simulado-a-stripe)
9. [Fotos, stickers y mapa](#9-fotos-stickers-y-mapa)
10. [Landing](#10-landing)
11. [Apps para Android e iOS](#11-apps-para-android-e-ios)
12. [Pasar a producción](#12-pasar-a-producción)
13. [Problemas frecuentes](#13-problemas-frecuentes)
14. [Pendiente y limitaciones](#14-pendiente-y-limitaciones)

---

## 1. Decisiones tomadas

### El backend es Node.js, no Laravel

El contexto del proyecto proponía Laravel + Pest. Se ha construido en **Node.js + TypeScript (Fastify)** por un motivo concreto: en el entorno donde se construyó no se podían descargar paquetes de PHP (Packagist bloqueado), así que un backend en Laravel se habría entregado **sin ejecutar ni un solo test**. Con Node se pudo ejecutar todo: 150 tests en verde contra un PostgreSQL real.

Lo que se mantiene igual que en el plan:

- El **contrato de la API** (`claude/api-endpoints-tests.md`): mismas rutas, mismos códigos de respuesta.
- La **política de testing**: los 6 casos base por endpoint, tests de dominio, test global de rutas, cobertura mínima del 80 % y CI.
- La **autorización centralizada** (el equivalente a las Policies vive en `api/src/policies.ts`).

Equivalencias: Pest → Vitest · Sanctum → tokens Bearer propios (hasheados en BD) · Policies → `policies.ts` · Eloquent → Knex · FormRequest → zod.

Si prefieres Laravel, la API se puede portar endpoint a endpoint usando los tests como especificación. El frontend, la landing y el modelo de datos no cambiarían.

### Decisiones de producto que estaban abiertas

| Tema | Decisión | Dónde se cambia |
|---|---|---|
| Tarifa por equipo | 5 € (configurable por ciudad) | columna `cities.team_fee_cents` |
| Plazo de pago | 7 días naturales; vence a las 23:59:59 hora de Madrid | `cities.payment_days`, `domain/deadline.ts` |
| Mínimo para cerrar inscripción | 2 equipos | `domain/lifecycle.ts` → `MIN_TEAMS` |
| Pago de equipos al organizador | Fuera de la app; el organizador marca "pagado" | — |
| ¿El organizador puede cerrar/corregir un acta? | **Sí** | `policies.editReport` |
| ¿Se puede reabrir un acta cerrada? | **Sí, solo el organizador**, con motivo obligatorio y registro en `report_audits` | `policies.reopenReport` |
| Jugadores | Pertenecen a un único equipo (no N—M) | ver sección 14 |
| Cuentas de organizador | Se activan a mano (admin) | sección 3 |

La tarifa y el plazo se **copian al evento al crearlo**: si cambias el precio de una ciudad, los eventos ya creados conservan el suyo.

## 2. Cómo funciona el negocio en el código

```
Inscripción ──cerrar──▶ Pendiente de pago ──pagar──▶ Activo
     │                        │
     └──────cancelar──────────┴──plazo vencido──▶ Cancelado
```

- **Inscripción** (`registration`): página pública; los capitanes inscriben equipos. No se puede crear calendario, ni asignar árbitros, ni publicar.
- **Cerrar** (`POST /events/{id}/close-registration`): calcula `importe = equipos × tarifa`, fija la fecha límite y pasa a **Pendiente de pago**. Ya no se pueden retirar equipos.
- **Pendiente de pago** (`pending_payment`): el evento deja de ser público hasta que se paga.
- **Activo** (`active`): se desbloquea todo. Un evento activo no se puede cancelar.
- **Cancelado** (`cancelled`): invisible para el público. Un job lo aplica solo cuando vence el plazo (cada 10 minutos, y también en el momento en que alguien intenta pagar tarde).

Las transiciones permitidas están en un único sitio: `api/src/domain/lifecycle.ts`.

**Acta del partido:** el resultado nunca se escribe a mano; se calcula a partir de los goles apuntados. Borrador → cerrada. Al cerrar, clasificación, goleadores y stickers cambian al instante porque se calculan siempre a partir de las actas cerradas (no hay tablas que puedan quedar desincronizadas).

## 3. Roles y cómo se conceden

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| Usuario | Registrándose | Seguir eventos, crear equipos (queda como capitán), inscribirlos |
| Capitán | Creando un equipo | Gestionar su plantilla e inscribir su equipo |
| Árbitro | Un organizador lo da de alta por email (pestaña *Árbitros*) | Editar el acta **solo** de los partidos que le asignen |
| Organizador | Lo concede un admin | Crear y gestionar sus eventos |
| Admin | Solo por terminal | Conceder roles, ver la lista de espera |

Nadie puede auto-asignarse un rol: el registro ignora cualquier campo `role`.

**Dar de alta a un organizador** (lo harás con cada liga fundadora): pídele que se registre y después, desde `/admin` con tu cuenta de admin, pulsa *Hacer organizador*. O por terminal:

```bash
docker compose exec api npm run make-role -- liga@ejemplo.com organizer
```

**Crear tu propio admin en producción:** regístrate en la app y ejecuta `npm run make-role -- tu@email.com admin`. No existe ningún endpoint que cree admins.

## 4. Seguridad: las reglas que no se rompen

1. **Denegar por defecto.** Toda ruta de `/api` exige token salvo que declare `config: { public: true }`. Está en `api/src/app.ts`. Si añades una ruta y olvidas protegerla, queda protegida.
2. **Lista blanca de rutas públicas.** `tests/routes.global.test.ts` compara las rutas públicas reales con una lista escrita a mano. Añadir una ruta pública sin apuntarla ahí rompe los tests.
3. **Autorización solo en `policies.ts`.** Los controladores no comparan ids por su cuenta; llaman a `authorize(policies.loQueSea(...))`.
4. **Nunca se confía en el body para campos sensibles.** `status`, `organizer_id`, `captain_id`, importes, tarifas y marcadores los fija el servidor. La validación con zod descarta cualquier campo no declarado.
5. **Recursos anidados se buscan por los dos ids** (`{ id, match_id }`), para que no se pueda tocar un recurso de otro partido cambiando un número en la URL.
6. **Lo público no filtra datos privados:** ni importe, ni estado de pago, ni emails. Los eventos pendientes de pago o cancelados responden 404.
7. **Contraseñas** con scrypt y sal; **tokens** guardados como hash SHA-256; el login responde igual exista o no el email.
8. **Rate limit** en login, registro, inscripciones y lista de espera.
9. **Webhook de Stripe:** firma verificada, idempotente, y solo activa el evento cuya sesión e importe coinciden.
10. **Fotos:** se valida el tipo leyendo el contenido, se recodifican (lo que elimina EXIF y GPS) y el nombre lo genera el servidor.

Estas diez reglas tienen tests. Son buen material para los vídeos de confianza ("así evito que un árbitro cambie un resultado que no le toca").

## 5. Mapa del código

```
api/
  src/
    app.ts            Arranque de Fastify: CORS, denegar por defecto, errores
    server.ts         Punto de entrada: migra, lanza el job de impagos y escucha
    config.ts         Todas las variables de entorno
    auth.ts           Contraseñas y tokens
    policies.ts       ← QUIÉN PUEDE HACER QUÉ
    errors.ts         Errores HTTP y validación
    lib.ts            Consultas compartidas (versión pública de eventos y partidos)
    migrations.ts     Esquema de la base de datos
    domain/           Reglas puras, sin BD ni HTTP: ciclo de vida, importe, plazo, acta, clasificación
    services/         payments (fake/Stripe), media (fotos), stickers (PNG)
    routes/           Un archivo por área: auth, discovery, events, teams, matches, feed, admin
  scripts/            seed, migrate, make-role, cancel-expired
  tests/              Un archivo por área + domain + routes.global + ratelimit
  assets/fonts/       Tipografías para los stickers (licencia OFL)

web/
  nuxt.config.ts      Configuración, PWA y URL de la API
  capacitor.config.ts Empaquetado Android/iOS
  app/
    app.vue           Cabecera y barra de navegación
    assets/css/main.css  ← Design tokens (colores, radios, espaciado) y componentes base
    composables/      useApi (cliente), useAuth (sesión), useUi (avisos, fechas, dinero), useT (ES/EN)
    components/       MapView, EventCard, MatchRow, StatusBadge, StickerShare
    pages/            Una página por archivo (la ruta es el nombre del archivo)

landing/index.html    Web estática completa en un archivo
```

**Cambiar la marca:** colores y tipografías están en las variables CSS del principio de `web/app/assets/css/main.css` y de `landing/index.html`, y en las constantes del principio de `api/src/services/stickers.ts`. El logo es `web/public/logo.svg` (un rombo lima provisional).

## 6. Cómo añadir un endpoint

1. Añade la ruta en el archivo de `api/src/routes/` que corresponda.
2. Sigue siempre este orden dentro del handler: cargar el recurso (404) → `authorize(policies...)` (403) → comprobar estado (409) → `validate(schema, body)` (422) → escribir.
3. Si hace falta una regla de permisos nueva, añádela a `policies.ts`.
4. Escribe sus tests con los **6 casos base**: sin token (401, este ya lo cubre el test global), rol incorrecto (403), recurso de otro (403/404), estado no permitido (409), validación y campos de más (422), caso feliz (200/201 comprobando la BD).
5. Si la ruta es pública, añádela a la lista blanca de `tests/routes.global.test.ts`.
6. `npm test`. No se da por terminado sin tests en verde.

Las factories para tests están en `tests/helpers.ts` (`f.user()`, `f.event(organizador, 'active')`, `scenario()`…).

## 7. Base de datos

- PostgreSQL 16. Conéctate con cualquier cliente a `localhost:5433` (usuario y contraseña `sportryn`).
- El esquema está en `api/src/migrations.ts`. **Para cambiarlo, añade una migración nueva al final de la lista**; nunca edites una ya aplicada. Se aplican solas al arrancar la API.
- El importe se guarda en céntimos (enteros), nunca con decimales.
- El mapa usa columnas `lat`/`lng` con índice. Es suficiente para buscar por recuadro; PostGIS solo haría falta para búsquedas por distancia.
- Copia de seguridad: `docker compose exec db pg_dump -U sportryn sportryn > backup.sql`.

## 8. Pagos: del modo simulado a Stripe

En local, `PAYMENTS_DRIVER=fake`: el botón de pagar lleva a una pantalla de pago simulado. El endpoint que la hace funcionar (`simulate-payment`) **no existe** cuando el driver es `stripe`.

Para activar Stripe (empieza en modo test):

1. Crea la cuenta en stripe.com y copia la clave secreta de test (`sk_test_...`).
2. Crea un webhook que apunte a `https://TU-API/api/webhooks/stripe` con el evento `checkout.session.completed` (y `checkout.session.async_payment_succeeded`). Copia su secreto (`whsec_...`).
3. Define en el entorno de la API:
   ```
   PAYMENTS_DRIVER=stripe
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
4. Para probar el webhook en local, usa la CLI de Stripe: `stripe listen --forward-to localhost:8000/api/webhooks/stripe`.

Nunca subas las claves al repositorio: `.env` está en `.gitignore`. La integración no usa la librería oficial de Stripe; son dos funciones en `services/payments.ts` (crear la sesión y verificar la firma).

**No verificado contra Stripe real:** la creación de la sesión de Checkout está escrita según su API pero no se ha ejecutado contra Stripe (no había claves). La verificación de firma y el webhook sí tienen tests. Prueba un pago en modo test antes de cobrar a nadie.

Coste: Stripe cobra comisión por transacción; consulta su tarifa vigente para España antes de fijar tu precio por equipo.

## 9. Fotos, stickers y mapa

**Fotos.** Se guardan en `api/storage/media` y se sirven en `/media/...`. En producción ese directorio debe ser un volumen persistente. Límite: 8 MB por foto y 10 fotos por publicación. Pasar a R2/S3 implica cambiar solo `services/media.ts`.

**RGPD y menores.** La app elimina la ubicación de las fotos, pero no resuelve el consentimiento. Antes de lanzar necesitas una política de privacidad, y los organizadores deben tener permiso para publicar fotos (imprescindible si hay menores). Esto requiere revisión legal.

**Stickers.** PNG de 1080×1920 generados en el servidor (`services/stickers.ts`, plantillas SVG). Con `?bg=transparent` salen sin fondo para superponerlos a una foto. Solo existen para actas cerradas. En el móvil, "Compartir en historias" abre el menú nativo de compartir; en ordenador se descarga.

**Mapa.** MapLibre con teselas de OpenStreetMap, sin clave ni coste. Los servidores públicos de OpenStreetMap son para uso ligero: **para producción con tráfico real, cambia a un proveedor de teselas** (MapTiler, Stadia…, tienen planes gratuitos) cambiando la URL en `web/app/components/MapView.vue`. El mapa muestra las sedes con partidos de eventos activos.

## 10. Landing

`landing/index.html` es un único archivo sin dependencias de compilación. Para publicarla en Vercel: importa el repositorio y pon `landing` como directorio raíz, o arrastra la carpeta a su panel.

**Antes de publicar**, cambia en el `<form>` el atributo `data-endpoint` por la URL real de tu API (`https://TU-API/api/waitlist`) y añade el dominio de la landing a `CORS_ORIGINS` de la API. Mientras la API no esté desplegada, el formulario mostrará un error al enviar; si quieres publicar la landing antes que la API, conecta el formulario a un servicio de formularios en su lugar.

Los apuntados se ven en `/admin` (cuenta de admin).

## 11. Apps para Android e iOS

**Nivel 1 — PWA (ya funciona, sin coste).** Desde el móvil, abre la web publicada:
- Android (Chrome): menú → *Instalar aplicación*.
- iPhone (Safari): compartir → *Añadir a pantalla de inicio*.

Requiere que la web esté servida por HTTPS.

**Nivel 2 — Tiendas, con Capacitor.** El proyecto ya está configurado (`web/capacitor.config.ts`, id `world.sportryn.app`).

```bash
cd web
npm install
# La app empaquetada necesita la URL pública (HTTPS) de la API:
$env:NUXT_PUBLIC_API_BASE="https://TU-API"     # PowerShell
npm run generate
npx cap add android        # solo la primera vez
npx cap sync
npx cap open android       # abre Android Studio: desde ahí generas el APK/AAB
```

- **Android:** necesitas Android Studio (gratis) y una cuenta de Google Play Console (pago único, unos 25 $).
- **iOS:** `npx cap add ios`; necesitas un Mac con Xcode y una cuenta de Apple Developer (unos 99 $ al año).
- La API debe permitir los orígenes de la app: `https://localhost` (Android) y `capacitor://localhost` (iOS). Ya están en el valor por defecto de `CORS_ORIGINS`; si lo personalizas, no los quites.

No se ha compilado ninguna app nativa todavía: la configuración está preparada pero sin probar en Android Studio.

## 12. Pasar a producción

Lo mínimo:

1. **API + PostgreSQL** en un VPS con Docker (desde unos 5 €/mes) o en un PaaS. Variables obligatorias: `DATABASE_URL`, `APP_URL`, `API_URL`, `CORS_ORIGINS` (dominios reales, **no** `*`), `NODE_ENV=production`, y las de Stripe. Arranque: `npm ci && npm start`.
2. **HTTPS** delante de la API (Caddy, Nginx o Cloudflare).
3. **Volumen persistente** para `api/storage/media` y **copias de seguridad** de la base de datos.
4. **Web**: `NUXT_PUBLIC_API_BASE=https://TU-API npm run generate` y sube `web/.output/public` a Vercel o cualquier hosting estático. El servidor debe devolver `200.html` para rutas desconocidas (Vercel y Netlify lo hacen solos).
5. **No ejecutes `npm run seed` en producción con la base vacía si no quieres las cuentas demo.** Crea solo las ciudades (o usa el seed y borra después los usuarios `@sportryn.test`).
6. Crea tu admin (sección 3).
7. Con una sola instancia de la API el job de impagos y el rate limit funcionan tal cual. Si algún día escalas a varias instancias, el rate limit necesita Redis.

## 13. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `docker: no se reconoce` | Docker Desktop no está instalado o hay que abrir una terminal nueva tras instalarlo. |
| `port is already allocated` | El puerto 3000, 8000, 8080 o 5433 está en uso. Cambia el número de la izquierda en `ports:` del `docker-compose.yml`. |
| La app dice "No se pudo conectar con el servidor" | La API aún está arrancando (mira `docker compose logs -f api`) o `NUXT_PUBLIC_API_BASE` apunta mal. |
| Cambio código y no se actualiza | En Windows a veces no se detecta: `docker compose restart api` (o `web`). |
| Error al instalar dependencias dentro de Docker | `docker compose down -v` y vuelve a arrancar (borra también la base de datos local). |
| El mapa sale vacío pero con marcadores | Las teselas de OpenStreetMap no cargan (sin internet o bloqueadas). |
| El mapa no carga en producción | El servidor debe servir los `.mjs` como JavaScript (`text/javascript`). |
| Los tests fallan con `ECONNREFUSED` | No encuentran la base de test: ejecútalos con `docker compose exec api npm test`. |
| Quiero empezar de cero | `docker compose down -v && docker compose up`. |

**Sin Docker:** necesitas Node 22+ y un PostgreSQL propio. Crea las bases `sportryn` y `sportryn_test`, copia `api/.env.example` a `api/.env`, y ejecuta `npm install && npm run seed && npm run dev` en `api/` y `npm install && npm run dev` en `web/`.

## 14. Pendiente y limitaciones

**Sin hacer (siguiente iteración):**

- Recuperar contraseña y verificar el email (requiere un servicio de envío de correo).
- Notificaciones (push o email) a quien sigue un evento.
- Estado "Finalizado" para ligas que terminan, y eliminatorias/cuadros de torneo (hoy un torneo es una lista de partidos).
- Jugadores en varios equipos (N—M) y vincular jugador con cuenta de usuario.
- Editar o borrar equipos, sedes y eventos desde la interfaz (la API permite editar; falta pantalla).
- Cobro a equipos dentro de la app (Stripe Connect).
- Traducción completa: el sistema ES/EN está montado (`useT.ts`) pero solo cubre navegación, estados y pestañas; el resto de textos está en español.
- Sub-marca por ciudad en la cabecera: ahora mismo pone "Madrid" fijo en `app.vue`.

**Sin verificar:** `docker-compose.yml`, la llamada real a Stripe y la compilación con Capacitor (ver secciones 8 y 11 y el README).

**Requiere tu decisión:** tarifa definitiva, logo, textos legales (privacidad, condiciones, cookies) y política de fotos con menores.
