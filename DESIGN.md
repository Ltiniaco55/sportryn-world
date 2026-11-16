---
name: Sportryn World
description: Ligas y torneos de fútbol amateur, con el resultado brillando como un marcador bajo los focos.
colors:
  floodlight-lime: "#C6F432"
  night-pitch: "#0A0E0D"
  stand-shadow: "#121816"
  dugout: "#1A2220"
  chalk-line: "#26322E"
  scoreboard-white: "#F4F7F2"
  touchline-grey: "#9AA59F"
  red-card: "#FF6B5E"
  yellow-card: "#FFC857"
  replay-blue: "#7FB4FF"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 5vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  score:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    fontFeature: "\"tnum\""
rounded:
  sm: "10px"
  md: "16px"
  lg: "24px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
components:
  button-primary:
    backgroundColor: "{colors.floodlight-lime}"
    textColor: "{colors.night-pitch}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "46px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.scoreboard-white}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "46px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.red-card}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "46px"
  button-small:
    rounded: "{rounded.pill}"
    padding: "0 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.stand-shadow}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.dugout}"
    textColor: "{colors.scoreboard-white}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
    height: "46px"
  tab-chip:
    backgroundColor: "transparent"
    textColor: "{colors.touchline-grey}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  tab-chip-on:
    backgroundColor: "{colors.scoreboard-white}"
    textColor: "{colors.night-pitch}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  status-badge:
    backgroundColor: "{colors.dugout}"
    textColor: "{colors.touchline-grey}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "3px 10px"
---

# Design System: Sportryn World

## Overview

**Creative North Star: "El marcador nocturno"**

Sportryn se ve como un partido amateur de noche bajo los focos: el campo está a oscuras y lo único que brilla es el marcador. El fondo es un negro verdoso casi absoluto, las superficies se separan por tonos y líneas de cal finas, no por sombras, y el lima de los focos se reserva para lo que de verdad importa en ese momento: el resultado, la acción que hay que tocar, quién va primero.

La app es una herramienta que se usa de pie, con una mano y con prisa: el árbitro cerrando el acta, el capitán mirando la clasificación después del partido. Por eso la densidad es media, los controles son grandes y redondos y el texto es Inter sobrio; la personalidad la ponen los titulares y los números en Space Grotesk. Las piezas para compartir (stickers 1080×1920) son el mismo mundo con el volumen subido: ahí el lima llena el bloque del marcador y la tipografía se vuelve gigante.

La identidad es **provisional** (logo, paleta y tipografías pueden cambiar), pero mientras esté vigente es la única: no se mezcla con otra estética.

**Key Characteristics:**
- Oscuro por defecto (`color-scheme: dark`), sin modo claro.
- Un solo acento, lima, con dos registros: escaso en la app, abundante en los stickers.
- Profundidad por capas tonales y bordes de 1px, no por sombras.
- Botones píldora de 46px pensados para el pulgar.
- Números tabulares en Space Grotesk para marcadores y puntos.
- El rombo lima (cuadrado girado 45°) como firma de marca.

## Colors

Un campo de noche: negros verdosos en capas, grises de cal y un único foco lima; tres colores de señal prestados del arbitraje.

### Primary
- **Floodlight Lime** (`--lime`): el foco. En la app marca solo la acción principal (botón relleno), la pestaña activa de la barra de navegación, el foco de teclado, el líder de la clasificación, la hora del partido y el estado "En juego". En stickers rellena el bloque del marcador y el "+1".

### Neutral
- **Night Pitch** (`--bg`): fondo de toda la app y de los stickers; también el texto sobre lima (`--lime-ink`).
- **Stand Shadow** (`--surface`): tarjetas, mapa y barra de navegación (al 96 % de opacidad).
- **Dugout** (`--surface-2`): una capa más arriba: campos de formulario, badges neutros, avisos.
- **Chalk Line** (`--line`): bordes de 1px de tarjetas, separadores de listas y tablas, bordes de botones ghost y pestañas.
- **Scoreboard White** (`--text`): texto principal; fondo invertido de la pestaña seleccionada y del toast.
- **Touchline Grey** (`--muted`): texto secundario, etiquetas de campo, cabeceras de tabla, iconos inactivos.

### Señales (estado, no decoración)
- **Red Card** (`--danger`): errores, cancelado, acciones destructivas (botón borde rojo, toast de error).
- **Yellow Card** (`--warn`): pendiente de pago.
- **Replay Blue** (`--info`): inscripción abierta.

Las señales aparecen como texto sobre su propio tinte al 10 % (`rgba(…, .1)`), nunca como superficies sólidas, salvo el toast de error.

### Named Rules
**The Floodlight Rule.** En la app, el lima ocupa como mucho una acción principal por pantalla más los indicadores de estado activo. Si dos botones lima compiten, uno pasa a ghost.

**The Share Volume Rule.** En stickers y piezas para compartir el lima puede llenar superficies grandes (el bloque del marcador), siempre con Night Pitch encima. Esa licencia no vuelve a la app.

**The Card Colours Rule.** Rojo, amarillo y azul solo comunican estado. Nunca se usan como acento decorativo ni como color de marca.

## Typography

**Display Font:** Space Grotesk (con system-ui, sans-serif), pesos 500 y 700
**Body Font:** Inter (con system-ui, sans-serif), pesos 400, 500 y 700

**Character:** Space Grotesk aporta el toque de marcador, geométrico y algo técnico, a titulares y números; Inter se queda callado y legible para todo lo demás. Ambas se sirven en local (`@fontsource`, y TTF en `api/assets/fonts` para los stickers).

### Hierarchy
- **Display** (700, `clamp(1.75rem, 5vw, 2.5rem)`, 1.1, -0.02em): título de página (`h1`), con `text-wrap: balance`.
- **Headline** (700, 1.35rem, 1.1): secciones (`h2`).
- **Title** (700, 1.05rem, 1.1): título de tarjeta, nombre de evento, sticker.
- **Body** (400, 16px, 1.5): todo el texto corrido. Secundario en `.85rem` (small) en Touchline Grey.
- **Label** (700, 0.72rem, 0.14em, MAYÚSCULAS): metadatos encima del título de una tarjeta ("LIGA · FÚTBOL 7"). Variantes: cabecera de tabla (0.7rem, 0.1em) y badge de estado (0.72rem, 0.06em).
- **Score** (700, Space Grotesk, cifras tabulares): marcador en filas de partido (1.25rem) y puntos de la clasificación.

### Named Rules
**The Tabular Score Rule.** Todo número que se compara en columna (marcador, puntos, goles, tablas) lleva `font-variant-numeric: tabular-nums`, y los que son resultado van en Space Grotesk 700.

**The Quiet Body Rule.** Space Grotesk nunca se usa para párrafos ni etiquetas de formulario; Inter nunca se usa para titulares.

## Layout

Mobile-first, de una columna. El contenido vive en una página centrada de 760px de ancho máximo (1040px en la variante ancha del panel de organizador) con 16px de margen lateral y 24px entre bloques. El ritmo sale de una escala de 4px (4, 8, 12, 16, 24, 32, 48); dentro de una tarjeta los elementos se separan 12px, entre secciones 24px.

En el móvil hay una barra superior fija de 56px (marca a la izquierda, sesión a la derecha) y una barra de pestañas inferior fija de 64px; ambas respetan las zonas seguras (`env(safe-area-inset-*)`) y el contenido deja hueco debajo para la barra. A partir de 900px la barra de pestañas sube a la barra superior, centrada, con icono y texto en línea.

Las filas de partido usan una rejilla de tres columnas (local alineado a la derecha · marcador centrado de 64px mínimo · visitante a la izquierda). Las pestañas de un evento se desplazan en horizontal a sangre, sin barra de scroll. Los formularios de dos campos usan columnas de 160px mínimo que se apilan solas.

## Elevation & Depth

Plano y por capas. La profundidad se construye subiendo de tono (Night Pitch → Stand Shadow → Dugout) y separando con bordes Chalk Line de 1px. Las barras superior e inferior son translúcidas con desenfoque de 12px para que el contenido pase por debajo. La única sombra es la del toast, que flota por encima de todo.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 12px 40px rgba(0, 0, 0, .45)`, `--shadow`): solo para el toast.

### Named Rules
**The Flat Pitch Rule.** Las tarjetas no llevan sombra. Si algo necesita destacar, sube de capa tonal o cambia el color del borde; no se eleva.

## Shapes

Esquinas generosas y redondeadas, en cuatro tamaños: 10px para campos y avisos, 16px para tarjetas, mapa, vacíos y la vista previa del sticker, 24px reservado y píldora completa para botones, pestañas, badges y toast. Los bordes son siempre de 1px; los estados vacíos usan borde discontinuo. La forma de marca es el **rombo**: un cuadrado redondeado girado 45° (logo de la barra superior, marcadores del mapa con halo lima, firma de los stickers).

## Components

### Buttons
Táctiles y seguros: píldoras grandes que se aciertan con el pulgar.
- **Shape:** píldora completa, 46px de alto (36px en la variante pequeña).
- **Primary:** relleno Floodlight Lime, texto Night Pitch en 700, 24px de padding lateral.
- **Hover / Focus:** hover sube el brillo un 8 %; foco con anillo lima de 2px separado 2px; deshabilitado al 45 % de opacidad.
- **Ghost:** transparente con borde Chalk Line y texto Scoreboard White; en hover el borde pasa a Touchline Grey. Es la acción secundaria.
- **Danger:** transparente con borde rojo al 40 % y texto Red Card.
- **Block:** ancho completo para la acción única de un formulario.

### Chips (pestañas de sección)
- **Style:** píldora con borde Chalk Line, texto Touchline Grey en 500, 8px × 16px.
- **State:** la seleccionada se invierte (fondo Scoreboard White, texto Night Pitch). No usa lima: el lima ya está en la barra de navegación.

### Status Badge
Píldora pequeña en mayúsculas con un punto de 6px del color del texto delante. Neutro sobre Dugout; los estados toman su color sobre su tinte al 10 % (En juego lima, Inscripción azul, Pendiente amarillo, Cancelado rojo).

### Cards / Containers
- **Corner Style:** 16px.
- **Background:** Stand Shadow.
- **Shadow Strategy:** ninguna (ver The Flat Pitch Rule).
- **Border:** 1px Chalk Line; en tarjetas enlace el borde pasa a lima y la tarjeta sube 1px en hover.
- **Internal Padding:** 16px.
- **Avisos:** caja de 10px de radio con 12px × 16px de padding y borde fino de 1px sobre un tinte al 6–10 %: error en rojo, nota en lima.

### Inputs / Fields
- **Style:** fondo Dugout, borde 1px Chalk Line, 10px de radio, 46px de alto mínimo (96px en textarea). Etiqueta encima en 0.85rem/500 Touchline Grey, separada 6px.
- **Focus:** el borde pasa a lima, sin anillo extra.
- **Error / Disabled:** los errores se muestran en la caja de error bajo el formulario, no en el campo.

### Navigation
- **Barra superior:** marca en Space Grotesk 700 mayúsculas con 0.08em, rombo lima y la ciudad ("Madrid") en lima.
- **Barra de pestañas:** iconos de trazo de 22px con etiqueta de 0.72rem; inactivo en Touchline Grey, activo en lima. Solo aparecen las pestañas del rol del usuario.

### Match Row (firma)
Local · marcador · visitante en tres columnas; el marcador en Space Grotesk tabular de 1.25rem, o la hora en lima si aún no se ha jugado.

### Sticker (firma)
PNG 1080×1920 generado en servidor. Night Pitch de fondo con las líneas del campo (círculo central y línea de medio campo en `#17201D`) y un marco redondeado de 48px; nombres en Space Grotesk que se encogen para caber, marcador de 280px en Night Pitch sobre un bloque lima de 56px de radio, y el rombo con la sub-marca de ciudad al pie. Existe una versión con fondo transparente para superponer a una foto.

## Do's and Don'ts

### Do:
- **Do** reservar el lima a una acción principal por pantalla más los indicadores de estado activo (The Floodlight Rule).
- **Do** separar superficies subiendo de capa tonal (Night Pitch → Stand Shadow → Dugout) con bordes de 1px Chalk Line.
- **Do** mantener los controles táctiles en 46px de alto y en píldora; 36px solo en acciones secundarias dentro de tarjetas.
- **Do** poner cifras tabulares en Space Grotesk 700 en todo marcador, punto y gol.
- **Do** dejar que en los stickers el lima llene el bloque del marcador, con Night Pitch encima.
- **Do** respetar las zonas seguras y el hueco de la barra inferior en cualquier pantalla nueva.

### Don't:
- **Don't** usar sombras en tarjetas o paneles; la única sombra es la del toast.
- **Don't** usar rojo, amarillo o azul como decoración: solo comunican estado.
- **Don't** usar bordes laterales gruesos de color para destacar tarjetas o avisos; el aviso usa borde fino completo y tinte.
- **Don't** colocar la etiqueta en mayúsculas espaciadas encima de un titular grande de portada; se usa para metadatos de tarjeta.
- **Don't** añadir un modo claro ni una segunda paleta de acento mientras esta identidad esté vigente.
