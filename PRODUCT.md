# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA mobile-first (Nuxt 4). Se empaqueta para Android/iOS con Capacitor, pero el lenguaje de diseño es web, no nativo.

## Users

Cada pantalla se diseña para el rol que la usa; **si hay conflicto entre roles, gana el organizador**, que es quien paga.

- **Organizador**: monta y gestiona la liga o torneo (inscripción, cierre, pago, calendario, sedes, árbitros, publicaciones). Panel en `/organizador`.
- **Árbitro**: rellena el acta desde el móvil a pie de campo; solo ve los partidos que le asignan. `/arbitro`.
- **Capitán**: crea el equipo, gestiona la plantilla e inscribe al equipo.
- **Jugadores y público**: siguen eventos, clasificación y goleadores, y comparten sus resultados.
- **Admin**: concede el rol de organizador y ve la lista de espera (`/admin`). Uso interno.

## Product Purpose

Plataforma de gestión y red social para ligas y torneos de fútbol amateur (F5, F7, F11, sala). Sustituye lo que hoy está repartido entre WhatsApp, hojas de cálculo e Instagram: inscripciones, calendario, actas, clasificación, fotos y presencia en un mapa de la ciudad. Éxito: que las ligas fundadoras de Madrid gestionen su competición entera aquí y que sus jugadores la difundan.

## Positioning

**Los stickers para compartir.** Cada resultado y cada gol de un acta cerrada genera un sticker (PNG 1080×1920, también con fondo transparente) listo para historias de Instagram y TikTok: los jugadores hacen la publicidad de la liga. Es lo que la competencia no ofrece y lo que convierte la gestión en difusión.

Apoyos (no son el diferencial principal): todo en un sitio, mapa de dónde se juega y un acta en la que solo el árbitro asignado puede tocar el resultado.

## Operating Context

- Uso mayoritario desde el móvil, a menudo en el campo (árbitro con el acta, capitanes y jugadores tras el partido).
- Ciclo del evento: inscripción → cerrar inscripción → pendiente de pago → activo; o cancelado. Lo pendiente de pago o cancelado no es público.
- Modelo de cobro: tarifa por equipo inscrito al organizador (5 € provisional, por ciudad), sin cuotas mensuales; si no se inscribe nadie, no paga.
- Sub-marcas por ciudad: primero **Sportryn Madrid**; después Barcelona, Atlanta y Orlando.
- Superficies: app (`web/`), landing "en construcción" con lista de espera de ligas fundadoras (`landing/index.html`) y stickers generados en servidor (`api/src/services/stickers.ts`).

## Capabilities and Constraints

- Idiomas: español por defecto, inglés vía `useT.ts` (cobertura parcial).
- Resultado, clasificación, goleadores y stickers se calculan siempre a partir de actas cerradas; nunca se escriben a mano.
- Lo público no muestra importes, estado de pago ni emails.
- Pendiente: recuperar contraseña, notificaciones, estado "finalizado", cuadros de torneo, jugadores en varios equipos, cobro a equipos dentro de la app.
- Undecided: tarifa definitiva, logo, textos legales y política de fotos con menores.

## Brand Commitments

- Nombre: Sportryn / Sportryn World; sub-marca de ciudad "Sportryn Madrid".
- Voz: español cercano y directo, de tú ("Tu liga, en un solo sitio", "Cada uno ve lo suyo").
- Identidad visual **provisional** (fondo casi negro, acento lima, Space Grotesk + Inter, rombo lima como logo): está en uso pero no es definitiva.

## Evidence on Hand

Nada real todavía: no hay ligas fundadoras confirmadas que se puedan nombrar, ni fotos propias de partidos, ni logo definitivo. Los equipos y resultados que aparecen (p. ej. "Leones de Lavapiés 3–1 Chamberí United") son de demostración. No inventar testimonios, cifras de ligas, clientes ni logos de terceros.

## Product Principles

1. **El resultado se comparte.** Cada acta cerrada debe acabar en algo que un jugador quiera publicar; el sticker es el producto, no un extra.
2. **Cada rol ve lo suyo.** Pantallas pensadas para quien las usa; en caso de conflicto, manda el organizador.
3. **A pie de campo, con una mano.** Mobile-first real: el árbitro y el capitán usan la app de pie, con prisa y a veces con mala cobertura.
4. **Confianza por construcción.** Nadie escribe resultados a mano ni ve datos privados ajenos; el diseño no debe sugerir lo contrario.
5. **Sustituir, no sumar.** Si algo obliga a volver a WhatsApp o a una hoja de cálculo, está incompleto.
