# CLAUDE.md — KinesisLab

Proyecto independiente extraído de SWD-nextjs (Movimiento Funcional / Hirit).

---

## Qué es este proyecto

Colección de herramientas interactivas de entrenamiento cognitivo-motor:
temporizadores, herramientas reactivas y juegos cognitivos para entrenadores
personales y de grupos.

**Objetivo final:**
- Web app pública (sin login, sin backend)
- App Android nativa (WebView + assets bundled, publicada en Google Play)
- HTML Vanilla + CSS + JavaScript puro (sin frameworks)

---

## Estado actual

**Migración completada.** Todas las herramientas están en vanilla HTML/CSS/JS.

- `src/herramientas/vanilla/` — Herramientas migradas (producción)
- `src/herramientas/` — Originales React/TSX (solo referencia, NO editar)

### Herramientas (20)

#### Atención y Velocidad de Procesamiento (amarillo)
- `go-nogo/` — Go / No-Go (toca verde, frena rojo)
- `flechas/` — Flechas Reactivas (cambios de dirección en 8 ejes)
- `colores/` — Colores Reactivos (3 niveles: Stroop, Color+Acción, Stroop+Acción)
- `sonidos/` — Sonidos Audiomotores (reacción auditiva)
- `reactive/` — Señales Reactivas (agilidad multimodal)
- `search/` — Búsqueda Visual (atención selectiva visuoespacial)
- `tracking/` — Seguimiento Continuo (seguir objetivo en movimiento)
- `arrows/` — Conflicto Audiovisual (estímulos incongruentes)
- `trace/` — Trazado Alfanumérico (coordinación visomotora)

#### Memoria de Trabajo (turquesa)
- `sort/` — De Menor a Mayor (memorizar números, decidir si estaban ordenados)
- `list-sorting/` — Listas de Objetos (NIH Toolbox List Sorting adaptado)
- `nback/` — N-Back Visual (memoria de trabajo)
- `simon/` — Secuencias Simon (memoria de secuencias)
- `matrix/` — Matriz Visoespacial (memorizar posiciones)
- `memoria/` — Memoria Visual (emparejar cartas)

#### Razonamiento y Cálculo (turquesa)
- `d50/` — Decisión D50 (¿mayor o menor que 50?)
- `fluency/` — Fluencia Verbal (categorías semánticas y fonémicas)
- `clock/` — Reloj Auditivo ACT (posición de agujas)

#### Herramientas de Soporte (gris)
- `timers/` — Temporizador Clínico (AMRAP, EMOM, pausas)
- `comba/` — Comba Reactiva (salto guiado por voz)
- `boxing/` — Boxeo Reactivo (combos bajo estrés verbal)

---

## Estructura del proyecto

```
ECM-cognitivo-motor/
├── index.html                          ← Landing page pública
├── manifest.json                       ← PWA config
├── sw.js                               ← Service Worker (offline support)
├── legal.html / privacy.html           ← Páginas legales
├── assets/
│   ├── css/
│   │   ├── design-tokens.css           ← Variables CSS
│   │   └── landing.css                 ← Estilos landing page
│   ├── js/                             ← Helpers compartidos
│   └── (iconos PWA, imágenes, APK)
├── src/herramientas/
│   ├── vanilla/                        ← HERRAMIENTAS (ÚNICA fuente de verdad)
│   │   ├── dashboard.html              ← Menú principal con las 20 herramientas
│   │   ├── acerca.html                 ← Página "Acerca de"
│   │   ├── css/
│   │   │   ├── dashboard.css
│   │   │   └── tool-base.css           ← CSS base compartido por todas las herramientas
│   │   └── tools/<nombre>/index.html   ← 20 herramientas (ver lista arriba)
│   └── (originales React/TSX — solo referencia, NO editar)
├── android/                            ← App Android nativa (WebView bundled)
│   ├── app/
│   │   ├── build.gradle                ← AGP 8.11 + dependencias AndroidX
│   │   └── src/main/
│   │       ├── AndroidManifest.xml     ← Sin permisos (app 100% offline)
│   │       ├── java/.../MainActivity.java  ← ComponentActivity + WebViewAssetLoader
│   │       └── assets/                 ← Regenerado por syncWebAssets (NO editar)
│   ├── kinesislab.jks                  ← Keystore producción (NO commitear)
│   └── gradle.properties               ← Credenciales keystore (gitignored)
├── scripts/
│   └── sync-android-assets.sh          ← Sincroniza vanilla/ → android/app/...
└── docs/
    └── ANDROID.md                      ← Guía de build y publicación Play Store
```

---

## Design System

Mismos tokens que SWD-nextjs. Archivo: `assets/css/design-tokens.css`

### Colores principales
- **Turquesa** (`--turquesa-600: #00bec8`) — Primary, botones principales
- **Rosa** (`--rosa-600: #e11d48`) — Cognitivas, acciones críticas
- **Amarillo/Tulip** (`--tulip-tree-500: #eab308`) — Reactivas, alertas
- **Grises** — Neutros, fondos, textos

### Tipografía
- Headings: `Righteous` (Google Fonts)
- Body: `ABeeZee` (Google Fonts)

### Iconografía
**SOLO Material Symbols Sharp** (Google Fonts CDN). NUNCA emojis en la UI.
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp" rel="stylesheet">
<span class="material-symbols-sharp">timer</span>
```

---

## Principios de desarrollo

- **Sin frameworks** — HTML + CSS + JS vanilla puro
- **Sin login / sin backend** — Todo client-side
- **Tablet-first** — Diseñado para tablet (dispositivo principal en sala) y móvil
- **PWA-ready** — manifest.json + service worker para instalación Android
- **Accesibilidad** — Touch targets mínimo 44px, contraste WCAG AA

---

## Cómo crear/modificar una herramienta

1. Cada herramienta es un archivo `src/herramientas/vanilla/tools/<nombre>/index.html` autocontenido
2. Importa `../../css/tool-base.css` para estilos base compartidos
3. Usa la estructura: exec-header → exec-toolbar → stimulus-area → stats-bar
4. Las herramientas originales React/TSX en `src/herramientas/` sirven de referencia de lógica
5. Reemplazar `<MaterialIcon name="x" />` por `<span class="material-symbols-sharp">x</span>`

---

## Convenciones de código

- Archivos: kebab-case (`de-menor-a-mayor/`)
- Variables JS: camelCase
- Clases CSS: kebab-case con BEM cuando aplique
- Sin `console.log` en producción
- Sin comentarios obvios

---

## Contexto de uso real

- **Dispositivo principal:** tablet apoyada en soporte/mesa, al alcance del usuario
- **Usuario principal:** el alumno (en movimiento, sudando, atención dividida entre ejercicio y pantalla)
- **El entrenador** configura y lanza la herramienta, pero NO es el usuario principal
- **Uso sin entrenador:** posible — la herramienta debe ser autoexplicativa
- **Ayuda/instrucciones:** orientadas al usuario final (al entrenador le servirán igualmente)

### Implicaciones de diseño
- Botones grandes y acciones simples (sin gestos complejos ni precisión fina)
- Feedback visual claro, legible a corta distancia pero con elementos grandes
- Touch targets generosos (mínimo 44px, idealmente más en zonas de acción principal)
- Considerar manos sudadas y toques imprecisos

---

## App Android

App nativa (**no TWA**) que carga los assets bundled en un WebView. El contenido
web vive en `src/herramientas/vanilla/` y se copia al APK vía pipeline automático.

### Pipeline de sincronización

- **Única fuente de verdad**: `src/herramientas/vanilla/`.
- **Sync script**: `scripts/sync-android-assets.sh` copia source → `android/app/src/main/assets/`
  aplicando transformaciones Android (fonts locales, eliminar sw-updater).
- **Gradle task `syncWebAssets`**: enganchado a `preBuild`, ejecuta el script
  automáticamente antes de cada `assembleDebug` / `bundleRelease`.
- **NUNCA editar directamente** `android/app/src/main/assets/` — se regenera.

### Comandos clave

```bash
# APK debug (emulador)
cd android && ./gradlew assembleDebug

# AAB firmado (Play Store) — requiere gradle.properties con credenciales keystore
cd android && ./gradlew bundleRelease
```

### Arquitectura Android

- `MainActivity` extiende `ComponentActivity` (AndroidX).
- `WebViewAssetLoader` sirve `https://appassets.androidplatform.net/` → assets/ (same-origin).
- `OnBackPressedDispatcher` para back predictivo (Android 14+).
- `WindowInsetsControllerCompat` para fullscreen immersive.
- `WebSettings.setTextZoom(100)` ignora la escala de fuente del sistema. Sin esto,
  en dispositivos con fuente "grande" (Realme/ColorOS y otros con OEM agresivo) los
  textos crecen pero los contenedores en `px` no, descuadrando todo el layout.
- Enlaces externos (footer legal, privacy web) se abren en navegador vía `Intent.ACTION_VIEW`.

### Publicación

Ver `docs/ANDROID.md` para flujo de Play Console (closed testing, release notes, etc).

---

## Notas de producto

- Las herramientas cognitivas están basadas en investigación (Perplexity + Gemini Deep Research)
- Primera beta cerrada publicada en Google Play Store (abril 2026, versionCode 4)
- Versión actual: `v2.0.8` (versionCode 12) — fix de `setTextZoom` para Realme/ColorOS
- Package name: `kinesislab.movimientofuncional.app`
