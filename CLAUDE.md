# Sportryn World — guía para Claude Code

Plataforma de gestión y red social para ligas y torneos de fútbol amateur. Sub-marcas por ciudad; primera: **Sportryn Madrid**. Responde y escribe comentarios/commits en **español**.

Detalle completo (decisiones, negocio, seguridad, despliegue): @MANUAL.md
Arranque local y cuentas demo: @README.md

## Estructura

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `api/` | API REST | Node 22 + TypeScript, Fastify, Knex, PostgreSQL 16, zod, Vitest |
| `web/` | App (PWA + Capacitor) | Nuxt 4 / Vue 3, MapLibre |
| `landing/` | Web "en construcción" con lista de espera | HTML + CSS en un archivo |

> El backend es **Node, no Laravel** (ver MANUAL §1). Equivalencias: Pest → Vitest · Sanctum → tokens Bearer propios · Policies → `api/src/policies.ts` · Eloquent → Knex · FormRequest → zod.

## Comandos

Todo corre con Docker (`docker compose up`). Desde la raíz:

```bash
docker compose exec api npm test              # tests (usa la BD sportryn_test)
docker compose exec api npm run test:coverage # cobertura mínima 80 %
docker compose exec api npm run typecheck
docker compose exec web npm run typecheck
```

Si cambias código y no se recarga en Windows: `docker compose restart api` (o `web`).

## Reglas que no se rompen

1. **Ningún endpoint está terminado sin tests en verde.** Cada endpoint lleva los 6 casos base: 401 sin token (lo cubre el test global), 403 rol incorrecto, 403/404 recurso de otro (IDOR), 409 estado no permitido, 422 validación y campos de más, y caso feliz 200/201 comprobando la BD.
2. **Orden dentro de cada handler:** cargar recurso (404) → `authorize(policies.x(...))` (403) → comprobar estado (409) → `validate(schema, body)` (422) → escribir.
3. **Autorización solo en `api/src/policies.ts`.** Los controladores no comparan ids por su cuenta.
4. **Denegar por defecto:** toda ruta `/api` exige token salvo `config: { public: true }`. Toda ruta pública nueva se añade a la lista blanca de `api/tests/routes.global.test.ts`.
5. **Nunca confiar en el body** para `status`, `organizer_id`, `captain_id`, importes, tarifas o marcadores. zod descarta campos no declarados.
6. **Recursos anidados se buscan por los dos ids** (`{ id, match_id }`).
7. **Lo público no expone** importes, estado de pago ni emails; eventos pendientes de pago o cancelados → 404.
8. **Transiciones del ciclo de vida solo en `api/src/domain/lifecycle.ts`.** El resultado del partido se calcula a partir de los goles del acta, nunca se escribe a mano.
9. **Base de datos:** para cambiar el esquema, añade una migración nueva al final de `api/src/migrations.ts`; nunca edites una ya aplicada. Dinero siempre en céntimos (enteros).
10. **Nunca subas secretos** (`.env`, claves de Stripe).

Factories para tests: `api/tests/helpers.ts` (`f.user()`, `f.event(org, 'active')`, `scenario()`…). Contrato de cada endpoint: `claude/api-endpoints-tests.md` del proyecto de claude.ai (mismas rutas y códigos).

## Dominio

- Ciclo del evento: `registration` → (cerrar inscripción) → `pending_payment` → (pagar) → `active`; o `cancelled` si se cancela o vence el plazo.
- Se cobra al organizador por equipo inscrito (tarifa y plazo por ciudad, copiados al evento al crearlo).
- Acta: borrador → cerrada. Clasificación, goleadores y stickers se calculan siempre a partir de actas cerradas.
- Roles: usuario, capitán, árbitro (solo partidos asignados), organizador (lo concede un admin), admin (solo por terminal).

## Frontend y marca

- Design tokens en las variables CSS del principio de `web/app/assets/css/main.css` (y en `landing/index.html` y `api/src/services/stickers.ts`).
- Fondo casi negro `#0A0E0D`, acento lima `#C6F432`, Space Grotesk (titulares) e Inter (texto). Identidad provisional.
- Diseña mobile-first: la app se usa sobre todo desde el móvil como PWA.
- Textos traducibles con `useT.ts` (ES/EN).

## No tocar

- `_to_delete/`: archivos sobrantes pendientes de borrar; ignóralos.
- `web/.nuxt/`, `node_modules/`: generados.
