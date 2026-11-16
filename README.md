# Sportryn World

Plataforma de gestión y red social para ligas y torneos de fútbol amateur. Primera ciudad: **Sportryn Madrid**.

Este repositorio contiene el MVP completo:

| Carpeta | Qué es | Tecnología |
|---|---|---|
| `api/` | API REST con toda la lógica y la seguridad | Node.js 22 + TypeScript, Fastify, PostgreSQL, Vitest |
| `web/` | La app (PWA instalable en Android e iPhone) | Nuxt 4 / Vue 3, MapLibre, Capacitor |
| `landing/` | Web estática "en construcción" con lista de espera | HTML + CSS, un solo archivo |
| `docker-compose.yml` | Arranca todo en local con un comando | Docker |

> **Lee `MANUAL.md`** para entender cómo funciona por dentro, cómo se despliega, cómo se activa Stripe y cómo se publican las apps.

## Arrancar en local

Requisitos: **Docker Desktop** abierto ("Engine running"). Nada más.

```bash
cd sportryn-world
docker compose up
```

La primera vez tarda unos minutos (descarga imágenes e instala dependencias). Cuando veas que la API y la web están escuchando:

| Qué | Dirección |
|---|---|
| App | http://localhost:3005 |
| API | http://localhost:8000/api/events |
| Landing | http://localhost:8080 |
| PostgreSQL | `localhost:5433` · usuario `sportryn` · contraseña `sportryn` · base `sportryn` |

Para parar: `Ctrl+C` o `docker compose down`. Para empezar de cero borrando la base de datos: `docker compose down -v`.

## Cuentas de demostración

Todas con la contraseña **`Sportryn123`**:

| Email | Rol | Para probar |
|---|---|---|
| `organizador@sportryn.test` | Organizador | Panel: una liga activa, un torneo en inscripción y una liga pendiente de pago |
| `arbitro@sportryn.test` | Árbitro | Actas de los partidos que tiene asignados |
| `capitan@sportryn.test` | Capitán | Equipos, plantillas e inscripción |
| `usuario@sportryn.test` | Público | Seguir eventos, ver stickers |
| `admin@sportryn.test` | Admin | `/admin`: dar rol de organizador, ver lista de espera |

**Recorrido recomendado (5 minutos):**

1. Entra como organizador → *Organizar* → **Liga de Invierno Vallecas** → *Pagar (simulado)* → el evento pasa a Activo y se desbloquea todo.
2. Crea un partido y asígnale el árbitro.
3. Entra como árbitro → *Arbitrar* → abre el acta, apunta goles y ciérrala.
4. Abre el partido en la parte pública: verás el resultado, la clasificación actualizada y los stickers para compartir.

## Tests

```bash
docker compose exec api npm test              # 150 tests
docker compose exec api npm run test:coverage # con cobertura (mínimo exigido: 80 %)
docker compose exec api npm run typecheck
```

Los tests usan una base de datos aparte (`sportryn_test`), no tocan tus datos.

## Comandos útiles

```bash
# Dar un rol a un usuario ya registrado
docker compose exec api npm run make-role -- ana@ejemplo.com organizer   # o: admin | referee | user

# Cancelar a mano los eventos con el pago vencido (la API ya lo hace sola cada 10 min)
docker compose exec api npm run cancel-expired

# Ver los logs de un servicio
docker compose logs -f api
```

## Estado

Hecho y verificado: API completa con 150 tests en verde, frontend compilado y probado en navegador, landing con formulario conectado a la API.

**No verificado por quien lo construyó:** el `docker-compose.yml` (no había Docker en el entorno de construcción). Está escrito con cuidado, pero la primera ejecución es la prueba real. Si falla algo al arrancar, mira "Problemas frecuentes" en `MANUAL.md`.

Pendiente y limitaciones conocidas: ver la última sección de `MANUAL.md`.
