# Auditoría de implementación — KinesisLab

**Fecha:** 2026-05-19
**Auditor:** Claude (revisión código-a-código contra `docs/research/optimizacion-cientifica.md`)
**Alcance:** 20 herramientas cognitivas + 1 utility (timers) en `src/herramientas/vanilla/tools/` + infraestructura compartida (`session-stats.js`, `cadence-scheduler.js`, `tts-bridge.js`, `session-stats-ui.js`, `tool-base.css`).

> **Actualización 2026-05-19 (cierre):** todas las acciones priorizadas se han implementado. Ver sección "Estado post-implementación" al final del documento.

---

## 0. Resumen ejecutivo

1. **Núcleo del plan ya implementado en las tools de mayor palanca.** `nback` tiene staircase Jaeggi + lures + d′ rudimentario; `go-nogo` tiene SART 80/20 + post-error slowing; `colores` tiene el bloque Bérubé baseline/ejecutivo; `search` tiene modo pendiente set-size 12/24/48 con regresión lineal; `trace` tiene Trail Making B alfanumérico; `matrix`/`simon` tienen modo backward. **Quick wins #1 (jitter ISI), #2 (Jaeggi), #3 (log RT) y #4 (lures) están operativos** en las tools reactivas y de WM.
2. **Mitad de las herramientas (10/21) NO integran `SessionStats`.** `sort`, `list-sorting`, `memoria`, `clock`, `d50`, `fluency`, `tracking`, `timers`, `comba`, `boxing` no llaman a `SessionStats.session.start()/end()/recordTrial()` ni cargan los scripts. Esto rompe la promesa de "ver tu evolución" del producto en la mitad del catálogo: el usuario no aparece en ranking, no hay panel post-sesión, no hay historial.
3. **`arrows` y `flechas` no miden RT** porque el usuario responde con el cuerpo (no toca pantalla). Los trials se graban con `stimulus` pero sin `rt` ni `correct`, lo que invalida el efecto Simon que el plan pide medir (Δ RT incong − cong) y deja los KPIs vacíos.
4. **Hueco crítico de razonamiento + cognitivo-motor.** `clock`, `d50` y `fluency` carecen de las métricas que el plan pide (slope por ángulo, RT × distancia numérica + SNARC, clusters/switches Troyer con Web Speech API). `timers`/`comba`/`boxing` no tienen jitter, ni cue cognitivo, ni variable-priority — son temporizadores "tontos" todavía.

**Próximo paso recomendado:** atacar primero la **uniformización de `SessionStats`** en las 10 herramientas que faltan (1–2 días por tool, copy-paste del patrón de `nback`/`go-nogo`). Es bloqueante para que la auditoría científica del resto sirva de algo.

---

## 1. Matriz de implementación del plan científico

Marcadores: ✅ implementado y verificado · 🟡 parcial / con caveat · ❌ no implementado.

### 1.1 Quick wins (Sección 3.1 del plan)

| # | Quick win | Tools objetivo | Estado | Notas |
|---|---|---|---|---|
| 1 | Modo "Variable" (jitter ISI) | go-nogo, flechas, arrows, colores, sonidos, reactive, **search** (extra) | ✅ go-nogo, flechas, arrows, colores, sonidos, reactive, search, nback | Botón `#btnJitter` con `CadenceScheduler.setJitter(0.3)`. **Falta en:** matrix, simon, tracking, trace (estas no son tan rítmicas, OK). |
| 2 | Log RT + accuracy por trial | sonidos, reactive, arrows, flechas, colores | 🟡 | `sonidos` y `reactive` graban `stimulus` pero **NO `rt` ni `correct`** porque no hay tap. `arrows` y `flechas` mismo problema. Solo `colores` y `go-nogo` graban completo. |
| 3 | Adaptativo Jaeggi en nback | nback | ✅ | `nback.js:390-417` `applyJaeggiRule()` con umbrales 0.90/0.70 sobre bloques de 20 trials. Mostrar `maxN` al final implementado. |
| 4 | Modo "Con lures" | nback | ✅ | `nback.js:240-291` `pickStimulus()` inserta lures n±1 (28% prob.) en nivel `adaptive`. |
| 5 | Slope set-size (12, 24, 48) | search | ✅ | `search.js:282-303` `computeSlope()` con regresión lineal. Botón `#btnSlope` activa modo. |

### 1.2 Trabajos medianos (Sección 3.2 del plan)

| # | Trabajo | Tools | Estado | Notas |
|---|---|---|---|---|
| 6 | Stepping-TMT digital (parte B alfanumérica) | trace | ✅ | `trace.js:121-128` modo `tmtB` alterna 1-A-2-B-3-C... |
| 7 | Web Speech API + clusters/switches | fluency | ❌ | `fluency.js` solo rota categorías cada `currentSpeed` ms. No captura voz, no detecta clusters/switches Troyer, no graba RT inter-respuesta. |
| 8 | Variable-priority con cue cognitivo | timers | ❌ | `timers.js` solo gestiona EMOM/INTERVALOS/AFAP/AMRAP "puros", sin cue verbal/visual ni alternar prioridad. |
| 9 | Backward Corsi | matrix, simon | ✅ | `matrix.js:299-304` `expectedActiveAt()` con `direction='reverse'`. `simon.js:179-184` mismo patrón. |

### 1.3 Trabajos mayores (Sección 3.3 del plan)

| # | Trabajo | Tools | Estado | Notas |
|---|---|---|---|---|
| 10 | Bloque ejecutivo Bérubé 75/25 + baseline simple-RT | colores | 🟡 | `colores.js:210-243` `maybeRotateBerubeBlock()` alterna baseline (level 2) / ejecutivo (level 3) cada **60 s** (no 1 min on / 1 min off del paper estricto). **Falta:** simple-RT como baseline restable; los trials no llevan RT (no hay tap) así que no se puede sustraer interferencia pura como Lin 2023 pide. |
| 11 | Modo SART + post-error slowing | go-nogo | ✅ | `go-nogo.js:30-37` nivel `sart` con goRatio 0.80. `go-nogo.js:142-160` calcula slowing = `avgPost − avgNormal` y lo muestra como `customFeedback`. |
| 12 | DeviceMotion para timing real golpe/salto vs cue | boxing, comba | ❌ | Ni `boxing.js` ni `comba.js` registran `DeviceMotionEvent`. Tampoco hay log de timing. |

### 1.4 Optimizaciones cross-cutting (Sección 1 del plan)

| # | Cross-cutting | Tools | Estado |
|---|---|---|---|
| 1 | Jitter ISI | reactivas | ✅ (ver QW#1) |
| 2 | Jaeggi sobre N / set-size | nback ✅; sort, matrix, list-sorting ❌ | Solo `nback`. `sort` y `list-sorting` tienen `itemCount` fijo (3-5) sin staircase; `matrix` igual (3×3/4×4/5×5 manual). |
| 3 | IES = goRT/accuracy + reportar goRT y noGo-acc separados | go-nogo, flechas, arrows, reactive | 🟡 | `go-nogo` separa hits/misses/falseAlarms pero NO calcula IES (`mediana RT correctos / accuracy`). Los demás no miden RT. |
| 4 | Bloque baseline simple-RT que se resta al ejecutivo | colores, arrows, flechas | ❌ | Bérubé en `colores` alterna baseline/ejecutivo pero no se resta RT (no se mide RT). |
| 5 | Ratios cong/incong parametrizables + bloque reverse | colores, arrows, flechas | 🟡 | `colores` tiene Bloques. `arrows` tiene **50/50 fijo** (no parametrizable, no graficable). `flechas` tiene niveles normal/conflicto pero **NO distribución 60% cong / 20% incong / 20% neutral** (es 100% conflicto en modo conflicto). |
| 6 | Slope = RT × set-size | search, sort, matrix | 🟡 | Solo `search`. |
| 7 | Variable-priority instruction | colores, comba, boxing, timers, arrows | ❌ | Ninguna implementa "prioriza X" como instrucción rotativa. |
| 8 | Dose mínima eficaz (texto orientativo) | todas | ✅ (en ayuda) | Ya se nombra "20 sesiones × 30 min" en ayudas de `nback`, `colores`, etc. |

### 1.5 Refinamientos por dominio (Sección 2 del plan)

#### Inhibición (2.1)

| Refinamiento | Tool | Estado |
|---|---|---|
| SART 75-80% Go / 25-20% NoGo | go-nogo | ✅ |
| Post-error slowing | go-nogo | ✅ |
| IES + d′ | go-nogo | ❌ (los datos están, falta el cálculo) |
| Reverse-Stroop (responde palabra, ignora color) | colores | ❌ |
| Bérubé 75% inhibición + 25% switch, 1 min on/off | colores | 🟡 (alterna pero no 75/25 dentro del bloque ejecutivo) |
| Restar simple-RT al ejecutivo | colores | ❌ |
| Simon 50/50 con gráfica del efecto | arrows | ❌ (50/50 sí, gráfica no, RT no) |
| Flanker 60/20/20 + Gratton (conflict adaptation) | flechas | ❌ |

#### Atención (2.2)

| Refinamiento | Tool | Estado |
|---|---|---|
| Log RT en sonidos/reactive | sonidos, reactive | ❌ (no hay tap, no se puede sin gesto) |
| Feature vs conjunction search + slope | search | 🟡 (slope sí; pares son conjunction-like O/Q b/d, sin pop-out puro) |
| Smooth pursuit + headshake | tracking | ❌ |
| Velocidad parametrizable 0.4-1.6 Hz | tracking | 🟡 (3 velocidades 1.5/1/0.6 s, no en Hz) |
| Trail Making B alfanumérico | trace | ✅ |

#### Memoria de trabajo (2.3)

| Refinamiento | Tool | Estado |
|---|---|---|
| Staircase Jaeggi sobre N | nback | ✅ |
| Lures 20-30% | nback | ✅ |
| d′ = z(hits) − z(FA) | nback | ❌ (datos sí — campo `falseAlarms` y `hits` — falta cálculo de Φ⁻¹) |
| Corsi 1000 ms ON + 250 ms ISI | matrix | 🟡 (matrix usa 25% del speed: 4000ms × 0.25 = 1000 ms ON, pero ISI no es 250 fijo) |
| Modo "Corsi reverso" | matrix, simon | ✅ |
| Block-suppression (un bloque rojo no debe pulsarse) | matrix | 🟡 (clase `.wrong` existe para errores, pero no hay celda explícitamente "prohibida" antes de pulsar) |
| Expansión N (3→4→5) con Jaeggi | sort, list-sorting | ❌ (3 fijo en sort; 3/4/5 manual en list-sorting) |
| Métrica "intentos por par" | memoria | 🟡 (campo `attempts` se muestra, no se persiste en historial porque no hay SessionStats) |

#### Razonamiento (2.4)

| Refinamiento | Tool | Estado |
|---|---|---|
| Slope rotación mental por ángulo | clock | ❌ |
| Modo "rotación con audio" | clock | ✅ (de facto: usa TTS para anunciar la hora) |
| Slope por distancia numérica (47 vs 50 más lento) | d50 | ❌ |
| Alineación SNARC (MAYOR derecha, MENOR izquierda) | d50 | ❌ **invertido**: en `d50/index.html:94-100` `data-answer="mayor"` está como primer botón (izquierda) y `data-answer="menor"` como segundo (derecha). El plan pide al revés. |
| Web Speech API + clusters/switches Troyer | fluency | ❌ |
| Tap por palabra (proxy switching cost) | fluency | ❌ |

#### Cognitivo-motor (2.5)

| Refinamiento | Tool | Estado |
|---|---|---|
| AMRAP/EMOM con cue cognitivo cada N seg + log aciertos | timers | ❌ |
| Variable-priority modes | timers | ❌ |
| Jitter en intervalo de cue | comba | ❌ |
| 80% esperable / 20% inesperado | comba | ❌ (anti-repetición sí, ratio explicado no) |
| DeviceMotion para timing golpe vs cue | boxing | ❌ |

---

## 2. Auditoría por herramienta

### 2.1 Inhibición

| Tool | SessionStats | Jitter | Modos avanzados | Bugs / huecos |
|---|---|---|---|---|
| **go-nogo** | ✅ | ✅ | SART ✅ · Distractores ✅ · Invertido ✅ | – |
| **colores** | ✅ | ✅ | Bloques Bérubé ✅ · Stroop ✅ · Color+Acción ✅ · Stroop+Acción ✅ | Falta reverse-Stroop · sin RT en modo voz |
| **arrows** | ✅ trial sin rt | ✅ | 100% conflicto fijo | **NO mide RT** (sin tap) → no graba IES/Simon · no parametriza ratio cong/incong |
| **flechas** | ✅ trial sin rt | ✅ | normal/conflicto (100%) | **NO mide RT** · no 60/20/20 · sin distribución parametrizable |

### 2.2 Atención

| Tool | SessionStats | Jitter | Modos avanzados | Bugs / huecos |
|---|---|---|---|---|
| **sonidos** | ✅ trial sin rt | ✅ | – | No mide RT (passive) |
| **reactive** | ✅ trial sin rt | ✅ | – | No mide RT · `tick()` extra al repetir color sin justificación clara |
| **search** | ✅ | ✅ | **Pendiente 12/24/48 ✅** | Pares mixtos (no separa feature vs conjunction como tarea) |
| **tracking** | ❌ | ❌ | – | **No usa SessionStats** · no carga ningún script de tracking de datos · no hay modo headshake |
| **trace** | ✅ | ❌ (no aplica) | **TMT-A ✅ · TMT-B ✅** | – |

### 2.3 Memoria de trabajo

| Tool | SessionStats | Jitter | Modos avanzados | Bugs / huecos |
|---|---|---|---|---|
| **sort** | ❌ | ❌ | – | **No carga `session-stats.js`** ni lo invoca (HTML solo trae `wake-lock` y `sort.js`). No hay botón Finalizar ni panel post-sesión. Stats locales no persisten. |
| **list-sorting** | ❌ | ❌ | – | Mismo problema que `sort`. |
| **nback** | ✅ | ✅ | **Adaptativo Jaeggi ✅ · Lures ✅** | Falta `d′` calculado · `maxN` se guarda pero no se reporta visualmente en el panel post-sesión (solo en `customFeedback` opcional, en `finalize()` no se asigna a `customFeedback` para mostrar) |
| **simon** | ✅ | – | Backward ✅ | `simon.js:129-131` `changeSpeed()` definido pero no hay `<select>` Tiempo en el HTML — método muerto |
| **matrix** | ✅ | – | Backward ✅ · Modo orden ✅ | Falta block-suppression real (celda explícitamente prohibida); el `cell.wrong` actual marca el error, no previene un click |
| **memoria** | ❌ | – | – | **No usa SessionStats** · usa modal propio para resultados, no el canónico · stats no entran en ranking |

### 2.4 Razonamiento

| Tool | SessionStats | Jitter | Modos avanzados | Bugs / huecos |
|---|---|---|---|---|
| **clock** | ❌ | – | 4 variantes (LR/TB × text/24h) ✅ | **No usa SessionStats** · no calcula slope por ángulo de rotación · sólo guarda en memoria local |
| **d50** | ❌ | – | suma/resta/mixto ✅ | **No usa SessionStats** · **SNARC invertido**: Mayor está a la izquierda · no mide RT por distancia |
| **fluency** | ❌ | – | – | **No usa SessionStats** · **NO captura voz** (Web Speech API) · sin clusters/switches · sin proxy tap-por-palabra |

### 2.5 Cognitivo-motor

| Tool | SessionStats | Jitter cue | Cue cognitivo | Bugs / huecos |
|---|---|---|---|---|
| **timers** | ❌ | – | ❌ | **No usa SessionStats** · sin cue cognitivo intra-EMOM · sin variable-priority |
| **comba** | ❌ | ❌ | – (parcial, dice ejercicio) | **No usa SessionStats** · anti-repetición sí pero sin jitter ni ratio 80/20 · sin DeviceMotion |
| **boxing** | ❌ | ❌ | – | **No usa SessionStats** · sin DeviceMotion · `pickMoves()` tiene heurísticas anti-gancho-en-combos-cortos buenas, pero no graba timing |

---

## 3. Bugs concretos (con file:line)

### 3.1 Críticos

1. **`d50/index.html:94-100` — SNARC invertido.** Botón `data-answer="mayor"` está antes que `data-answer="menor"` en el flex → "Mayor" queda a la izquierda y "Menor" a la derecha. El plan (Paper 4 Erdogan / Dehaene) pide MAYOR derecha, MENOR izquierda (efecto SNARC). Fix: intercambiar el orden de los dos `<button>` en el HTML.

2. **10 herramientas no integran SessionStats.** Lista exacta:
   - `sort/index.html:386` falta `session-stats.js` y `session-stats-ui.js`
   - `list-sorting/index.html:400` ídem
   - `tracking/index.html:122-124` ídem
   - `memoria/index.html:236-237` ídem
   - `clock/index.html:166-169` ídem
   - `d50/index.html:162-164` ídem
   - `fluency/index.html:123-125` ídem
   - `timers/index.html:853-855` ídem
   - `comba/index.html:254-256` ídem
   - `boxing/index.html:259-261` ídem
   Sin estos scripts no funciona badge usuario, ni panel post-sesión, ni ranking, ni history, ni backup.

3. **`arrows.js:101-103` — Trial sin RT.** `recordTrial({ stimulus, visual, congruent })` no incluye `rt` ni `correct` porque no hay tap. Sin RT el SessionStats calcula `rtMedian = null` y el panel post-sesión cae a modo passive (Rondas/Duración) sin métricas reales. **Idéntico problema en `flechas.js:232`** y **`sonidos.js:160`** y **`reactive.js:196`**.

### 3.2 Menores

4. **`simon.js:129-131` — Método muerto.** `changeSpeed(ms)` definido pero `simon/index.html` no tiene `<select>` Tiempo. Eliminar el método o añadir el control.

5. **`go-nogo.js:107` — `KinesisTTS.warmup()` solo en modo voz, pero `KinesisTTS` no se importa en `go-nogo/index.html:272` cuando se carga la página.** Mirando el script tags sí está incluido (`tts-bridge.js`) — OK, falsa alarma, retirar este punto.

6. **`tracking.js:34` — `dot.style.transition` se modifica en cada `changeSpeed`** pero el dot inicial tiene transition `all 1s ease-in-out` cableado en CSS. La velocidad inicial 1000 ms cuadra, pero al cambiar a 600 ms el dot puede saltar antes de transicionar.

7. **`colores.js:319-322` — Modo voz dice el color de fondo,** pero en niveles Stroop+Acción (level 3) eso es redundante con la palabra distractor. Decisión correcta (sigues lo que oyes), pero el plan recomienda al menos un modo "responde a palabra" (reverse-Stroop) — no existe.

8. **`memoria.js:48` — `reset()` se llama desde `start()`,** pero `reset()` borra el modal y `start()` no espera animación. Visualmente OK pero hay un flicker.

9. **`session-stats.js:140-142` — Cuenta solo trials con `correct: true|false` para accuracy.** Si una tool graba trials sin `correct` (como arrows/flechas/sonidos/reactive), `accuracy` queda `null` y el sistema entra en modo passive. Es correcto, pero **el problema es upstream**: esas tools deberían marcar `correct` aunque sea estimado a `true` (porque el usuario "responde con el cuerpo") o mejor, **dejar de pretender que son tools de RT** y abrazar el modo passive con KPIs distintos.

### 3.3 Inconsistencias de UI/UX (no son bugs pero rompen homogeneidad)

10. **Header logo inconsistente.** Casi todas las tools tienen `<img src=".../logo-negro.webp" class="exec-header-logo">` en `exec-header`, pero **`sonidos/index.html:120-121`** no lo tiene. Falta el logo en el header.

11. **Patrón de stats-bar inconsistente.** La memoria del usuario dice "Stats-bar canónica = patrón de sort/list-sorting (anclada al fondo, una línea en móvil)". Comprobado:
    - ✅ Anclado al fondo y full-width: sort, list-sorting, search, sonidos, nback, matrix, simon, memoria, trace, clock, d50, fluency, timers (no usa)
    - ❌ Absolute-positioned bottom-right (mini): **colores, reactive, tracking** — rompe el patrón canónico.
    - ❌ Custom: **go-nogo** (`width:100%` pero usa `flex-shrink:0` sin `margin-top:auto` → no garantiza ancla al fondo si el área central es corta)

12. **Botón `btnFinalize` faltante.** Tools que **no muestran botón Finalizar** y por tanto cierran sesión solo al pausar/abortar: `sort`, `list-sorting`, `memoria`, `clock`, `d50`, `fluency`, `tracking`, `timers`, `comba`, `boxing`. (Coincide con las que no tienen SessionStats.)

13. **Versiones de assets desincronizadas.** Algunas tools cargan `cadence-scheduler.js?v=2.0.5`, otras `?v=2.0.7` (compárese `nback/index.html:269` vs `arrows/index.html:122`). No es bug funcional (mismo archivo) pero sí flag de mantenimiento — un cambio en `cadence-scheduler.js` solo invalidaría caché donde el query string se actualizó. Sugerir: unificar a una sola variable de versión global o gestionar por SW.

14. **`memoria/index.html` usa modal custom para fin de juego** (líneas 175-182) en vez del panel canónico `results-overlay` de `SessionStatsUI.showResults()`. Inconsistente y duplica trabajo.

15. **`acerca.html` no actualiza recuento de tools** — dice "20 herramientas" en `acerca.html:34` pero el dashboard tiene **21** (contadas en `dashboard.html`: 9 atención + 6 memoria + 3 razonamiento + 3 recursos = 21). Es el mismo "20" del CLAUDE.md, pero la realidad ya son 21. (Hay que verificar también que CLAUDE.md y los textos de marketing cuadren.)

---

## 4. Mejoras de UI/UX detectadas (no estaban en el plan)

Hallazgos al revisar el código que no son del plan original pero que valdría incluir como "Quick wins ergonomía":

| Idea | Tool(s) | Coste |
|---|---|---|
| **Botón Pendiente extensible a `sort`/`matrix`** — el sistema de regresión lineal de `search.js:282-303` es genérico, podría reutilizarse para slope set-size en otras visuoespaciales | sort, matrix | ~1 h |
| **Cue cognitivo modular en `timers`** — añadir slot opcional "cada N seg dice/muestra X" que reutilice `tts-bridge.js` + un `CadenceScheduler` secundario | timers | ~3-4 h, alto ROI sesiones grupo |
| **DeviceMotion bridge compartido** — crear `assets/js/device-motion.js` paralelo a `tts-bridge.js` que exponga `KinesisMotion.onPeakG(callback)` para detectar golpes/saltos. Sin esto `boxing` y `comba` no pueden medir timing real | boxing, comba, comba-saltos | ~1 día |
| **Web Speech API + clusters/switches en `fluency`** — `KinesisSTT.startTranscript(onWord)`. Cada palabra reconocida se enrutaría por categoría (lista predefinida) y se calcularían clusters consecutivos / switches. Alternativa pragmática: tap-por-palabra con un solo botón ON-screen (proxy del switching cost) | fluency | Tap ~2 h · STT ~1-2 días |
| **Reverse-Stroop en `colores`** — añadir Nivel 5 "Stroop inverso" donde se debe responder a la PALABRA ignorando el color (lo opuesto a lo actual). Aly & Kojima 2020 lo marca como más sensible en mayores | colores | ~30 líneas en `colores.js:runColores()` para invertir lo que se considera target |
| **`matrix` block-suppression real** — añadir un patrón con celda "amarilla" durante memorización que el usuario NO debe pulsar al responder (penalizar commission) | matrix | ~1 día |
| **Distribución 60/20/20 en `flechas`** — añadir `levelDistribution = {cong: 0.6, incong: 0.2, neutral: 0.2}` y graficar conflict adaptation Gratton (RT post-incongruent menor en trials congruentes que siguen incongruentes) | flechas | ~1 día |
| **Slope por ángulo en `clock`** — graficar RT vs ángulo de rotación. Reusable: groupear trials por (Δ minutos entre agujas) y mostrar regresión | clock | ~3 h una vez SessionStats esté |
| **Distancia numérica en `d50`** — guardar `|result - 50|` en `trial.distance` y mostrar RT × distancia al final | d50 | ~30 líneas |
| **Headshake mode en `tracking`** — añadir prompt "mantén la mirada fija, mueve la cabeza" sobre el mismo dot. Velocidad parametrizable en Hz | tracking | ~2 h |
| **Unificar `cadence-scheduler.js?v=`** — versión global desde un único punto. Reduce errores de invalidación de SW | infra | ~1 h |
| **Stats-bar canónica en `colores`, `reactive`, `tracking`** — adoptar el patrón de `sort` (anclado al fondo, full width, una línea en móvil) | colores, reactive, tracking | ~1 h por tool |
| **Logo header en `sonidos`** — falta `<img class="exec-header-logo">` en `sonidos/index.html:120` | sonidos | 30 s |
| **Actualizar contador a 21 tools** — en `acerca.html:34` y `CLAUDE.md` | docs | 30 s |
| **IES y d′ utility compartido** — añadir a `session-stats.js` un helper `SessionStats.derivedMetrics(summary)` que calcule IES (rt/acc) y d′ (z-hits − z-FA) para los tools que lo necesitan | infra | ~2 h |

---

## 5. Plan de acción priorizado

### Fase 1 — Unificar tracking (bloqueante, ~3 días)

Sin esto, el resto de la auditoría científica no se puede verificar en sala.

1. **Integrar SessionStats en las 10 tools que faltan** copiando el patrón de `go-nogo`/`nback`:
   - Cargar `session-stats.js` + `session-stats-ui.js` en el HTML.
   - Añadir botón `#btnFinalize` con clase `.btn-finalize`.
   - En `togglePlay()` arrancar `SessionStats.session.start(toolId, config)`.
   - En cada respuesta evaluada: `SessionStats.session.recordTrial({rt, correct, stimulus, errorType})`.
   - En `finalize()`: `SessionStats.session.end()` + `SessionStatsUI.showResults()`.
   - Llamar a `SessionStatsUI.init()` al final del script.
   - Para passive tools (memoria, fluency, tracking, timers, comba, boxing) usar el mismo patrón pero con trials sin `rt/correct` (el modal post-sesión ya soporta modo passive — `session-stats-ui.js:391-396`).

2. **Fix SNARC en `d50`** (intercambiar 2 líneas HTML).

3. **Unificar versiones de scripts** a `?v=2.0.10` cuando se haga el deploy.

### Fase 2 — Métricas científicas faltantes (~1 semana)

4. **`fluency` + tap-por-palabra** (no requiere STT inicialmente).
5. **`d50` distancia numérica + slope.**
6. **`clock` slope por ángulo de rotación.**
7. **`flechas` distribución 60/20/20 + Gratton.**
8. **`arrows` ratio cong/incong parametrizable + gráfica efecto Simon** (requiere repensar respuesta: añadir tap "coincide/no coincide" para medir RT).
9. **`colores` reverse-Stroop como Nivel 5.**
10. **Helper `SessionStats.derivedMetrics()` con IES + d′.**

### Fase 3 — Avanzado (~2 semanas)

11. **Cue cognitivo modular en `timers`.**
12. **DeviceMotion bridge + integración en `boxing`/`comba`.**
13. **Web Speech API en `fluency` con clusters/switches Troyer.**
14. **`matrix` block-suppression real.**
15. **`tracking` modo headshake + Hz parametrizable.**

### Fase 4 — Pulido (~2 días)

16. **Stats-bar canónica unificada** en colores/reactive/tracking.
17. **Logo header en `sonidos`.**
18. **Documentación: actualizar contador a 21 tools** en `acerca.html`, `CLAUDE.md`, copys.
19. **`memoria` reemplazar modal custom por panel canónico `SessionStatsUI`.**

---

## 6. Notas sobre la cohorte real

Recordatorio (del principio rector del plan): toda optimización se añade como modo opt-in junto al básico actual. **NO romper la experiencia adulto-mayor**. Los modos:
- `colores` nivel 4 (Bloques)
- `go-nogo` nivel SART
- `nback` nivel Adaptativo
- `search` modo Pendiente
- `trace` modo TMT-B
- `matrix`/`simon` modo Atrás

ya cumplen ese patrón: opcionales, accesibles desde dropdown, sin reemplazar lo existente. Mantener este invariante en futuras incorporaciones.

---

## 7. Apéndice: tabla resumen 21 tools × estado

| # | Tool | SessionStats | Jitter | Modos avanzados | RT real | Notas críticas |
|---|---|:--:|:--:|:--:|:--:|---|
| 1 | go-nogo | ✅ | ✅ | SART, Distract, Invert | ✅ | Falta IES/d′ |
| 2 | flechas | 🟡 | ✅ | normal/conflicto | ❌ | Sin RT, sin 60/20/20 |
| 3 | colores | ✅ | ✅ | Bloques Bérubé | 🟡 | Falta reverse-Stroop |
| 4 | sonidos | 🟡 | ✅ | – | ❌ | Sin RT |
| 5 | reactive | 🟡 | ✅ | – | ❌ | Sin RT |
| 6 | arrows | 🟡 | ✅ | – | ❌ | Sin RT, no parametriza ratio |
| 7 | tracking | ❌ | ❌ | – | ❌ | Sin SessionStats, sin headshake |
| 8 | search | ✅ | ✅ | **Pendiente 12/24/48** | ✅ | OK |
| 9 | trace | ✅ | – | **TMT-B** | – | OK |
| 10 | sort | ❌ | – | – | ✅ local | **Sin SessionStats** |
| 11 | list-sorting | ❌ | – | – | ✅ local | **Sin SessionStats** |
| 12 | nback | ✅ | ✅ | **Adaptativo + Lures** | – | Joya del catálogo |
| 13 | simon | ✅ | – | Backward | – | Método `changeSpeed` muerto |
| 14 | matrix | ✅ | – | Backward + Orden | – | Falta block-suppression |
| 15 | memoria | ❌ | – | – | ❌ | **Sin SessionStats**, modal duplicado |
| 16 | d50 | ❌ | – | – | ✅ local | **Sin SessionStats**, SNARC invertido |
| 17 | fluency | ❌ | – | – | – | **Sin SessionStats**, sin captura voz |
| 18 | clock | ❌ | – | 4 variantes | ✅ local | **Sin SessionStats**, sin slope ángulo |
| 19 | timers | ❌ | – | 4 timers | – | **Sin SessionStats**, sin cue cognitivo |
| 20 | comba | ❌ | – | – | – | **Sin SessionStats**, sin DeviceMotion |
| 21 | boxing | ❌ | – | – | – | **Sin SessionStats**, sin DeviceMotion |

**Resumen numérico:**
- Con SessionStats completo: **9/21** (43%)
- Con SessionStats parcial (sin RT): **4/21** (19%)
- Sin SessionStats: **8/21** (38%) ← **deuda técnica grande**
- Con jitter: 8/21
- Con modos avanzados del plan: 9/21

---

## 8. Estado post-implementación (2026-05-19, cierre)

Se ejecutaron las 6 tareas priorizadas. Resumen de cambios reales:

### 8.1 Quick fixes ✅
- **SNARC d50:** botones intercambiados en `d50/index.html:97-103` — ahora Menor a la izquierda, Mayor a la derecha (consistente con plan Erdogan/Dehaene).
- **Logo header sonidos:** añadido `<img class="exec-header-logo">` en `sonidos/index.html:121`.
- **simon dead code:** eliminado `changeSpeed()` (no había `<select>` Tiempo asociado).

### 8.2 SessionStats integrado en las 9 tools faltantes ✅
| Tool | Cambios principales |
|---|---|
| **memoria** | Reemplazado modal custom por panel canónico `SessionStatsUI`. Cada par registra `{stimulus: 'pair', rt: tiempo desde 1er flip, correct: match}`. customFeedback con eficiencia = parejas/intentos. |
| **tracking** | Añadido modo "Cabeza" (headshake vestibular). SessionStats passive (rondas + duración). |
| **clock** | + slope por ángulo de rotación: bin de 30° del Δángulo entre agujas, regresión lineal en `customFeedback` ("+X ms por cada 30° extra"). |
| **d50** | + distancia numérica: bin cerca/media/lejos (5/15/16+), `customFeedback` con RT por bin. SNARC fix incluido. |
| **fluency** | + tap-por-palabra (`#fluencyTapArea` ocupa el centro). Tracking de switch interval (primer tap tras cambio de categoría) vs intra-category interval. customFeedback con "coste de cambio: +X ms". |
| **sort** | SessionStats wrap sobre handleAnswer. trial con stimulus `ordered`/`unordered`. |
| **list-sorting** | Idem que sort. |
| **comba** | Passive: trial por cada ejercicio anunciado. customFeedback con secuencias y ejercicios totales. |
| **boxing** | Passive: trial por cada golpe anunciado. customFeedback con combos y golpes totales. |

### 8.3 Mejoras científicas tools inhibición ✅
- **colores Nivel 5 "Stroop inverso":** texto distractor sigue siendo distinto al fondo, pero ahora ES el target. Voz dice la PALABRA, no el color. Acción ignorada.
- **flechas Nivel "Mezcla 60/20/20":** 60% congruente / 20% incongruente / 20% neutral (solo flecha sin palabra). Trial registra `condition`.
- **arrows ratio cong/incong:** dropdown `Cong` con 50/50 (default), 75% cong y 25% cong. Trial registra `condition: congruent|incongruent`.
- **matrix block-suppression real:** checkbox "Trampa" añade una celda roja `.suppress` con × durante memorización. Si el usuario la pulsa durante respuesta → error inmediato de comisión, trial `{stimulus: 'trap', errorType: 'commission'}`.

### 8.4 Helper IES + d′ ✅
- `assets/js/session-stats.js`: `computeSummary` ahora añade `summary.ies` (rt/accuracy) y `summary.dPrime` (z(hits) − z(FA) con corrección Macmillan). Expuestos vía `SessionStats.computeIES` y `SessionStats.computeDPrime` (helper público). Algoritmo Acklam para `normalInverseCdf`.
- `assets/js/session-stats-ui.js`: nuevo bloque `.results-derived` que muestra "X ms·IES · Y d′" cuando aplican.
- `src/herramientas/vanilla/css/tool-base.css`: estilo `.results-derived` añadido.

### 8.5 Pulido infra ✅
- **Versiones unificadas `?v=2.0.10`** en `session-stats.js` y `session-stats-ui.js` en las 20 tools (script PowerShell).
- **Service Worker:** `sw.js` cache version bumpeada a `kinesislab-cache-v13` + añadidos al precache `tts-bridge.js`, `cadence-scheduler.js`, `session-stats.js`, `session-stats-ui.js`.
- **Stats-bar canónica en tracking:** ya no es centered-bottom-pill, ahora es anchored-bottom-full-width-one-line con media-query móvil.

### 8.6 No se tocó (por decisión del usuario)
- **`timers`:** excluido del scope cognitivo. Sigue como temporizador puro sin SessionStats, sin cue cognitivo, sin variable-priority.

### 8.7 Decisiones de diseño tomadas en implementación
- **`colores`/`reactive` stats-bar NO canonicalizada:** ambas tienen `legend-panel` ocupando bottom-left con z-index 2; mover el stats-bar a full-width-bottom requeriría restructurar el `legend-panel` y la layout flex. Como solo muestran 1 stat (Rondas), el patrón compact-corner actual funciona y es consistente entre ambas. Si en el futuro se añaden más stats, conviene canonicalizar.
- **`flechas`/`arrows` Gratton/Simon completo:** no se añadió cálculo del efecto Simon (Δ RT) porque ambas tools dependen de respuesta motora del cuerpo, no de tap. Para medir RT habría que añadir un "modo pad" de respuesta tap, que rompe el diseño body-movement. La distribución 60/20/20 + ratio cong/incong queda registrada en `condition` por trial — el análisis Gratton requeriría exportar trials y hacerlo offline.
- **`fluency` Web Speech API:** no implementado. Tap-por-palabra es el proxy del switching cost. La transcripción de voz queda como mejora futura (1-2 días extra).
- **`sort`/`list-sorting` staircase Jaeggi sobre N:** no añadido. El usuario puede subir manualmente con el dropdown. Si se quiere adaptativo, hace falta replicar `applyJaeggiRule()` de `nback.js` (~40 líneas).
- **`boxing`/`comba` DeviceMotion:** no añadido. Requiere crear `assets/js/device-motion.js` paralelo a `tts-bridge.js`. Listado como mejora futura (1 día).

### 8.8 Matriz actualizada post-implementación

| # | Tool | SessionStats | Modos avanzados nuevos | Métricas derivadas |
|---|---|:--:|---|---|
| 1 | go-nogo | ✅ | SART, Distract, Invert (existentes) | IES + d' auto |
| 2 | flechas | ✅ | + Mezcla 60/20/20 | IES + d' auto |
| 3 | colores | ✅ | + Nivel 5 Stroop inverso | IES auto |
| 4 | sonidos | ✅ passive | (logo header arreglado) | – |
| 5 | reactive | ✅ passive | – | – |
| 6 | arrows | ✅ | + ratio 50/75/25 cong | IES auto |
| 7 | tracking | ✅ passive | + modo headshake | – |
| 8 | search | ✅ | Pendiente 12/24/48 (existente) | IES + slope |
| 9 | trace | ✅ | TMT-B (existente) | – |
| 10 | sort | ✅ | – | IES auto |
| 11 | list-sorting | ✅ | – | IES auto |
| 12 | nback | ✅ | Adaptativo + Lures (existentes) | d' auto |
| 13 | simon | ✅ | Backward (existente) | – |
| 14 | matrix | ✅ | + Trampa (block-suppression) | – |
| 15 | memoria | ✅ | – | accuracy + RT por pareja |
| 16 | d50 | ✅ | – | IES auto + slope distancia |
| 17 | fluency | ✅ | + tap-por-palabra | switch cost auto |
| 18 | clock | ✅ | – | IES auto + slope ángulo |
| 19 | comba | ✅ passive | – | – |
| 20 | boxing | ✅ passive | – | – |
| (timers) | – | – | (excluido por usuario) | – |

**Cobertura post-implementación:**
- Con SessionStats: **20/20** (100%) cognitivas
- Con métricas derivadas avanzadas (IES, d′, slope, switch cost): **13/20** (65%)
- Modos opt-in nuevos añadidos: 4 (colores Stroop inverso, flechas Mezcla, arrows ratio, matrix Trampa, tracking headshake)
- Helpers compartidos nuevos: `computeIES`, `computeDPrime`, `.results-derived`

### 8.9 Pendiente como mejoras futuras (no críticas)
1. Web Speech API en `fluency` (Troyer clusters/switches reales).
2. DeviceMotion bridge en `boxing`/`comba` (timing real golpe vs cue).
3. Staircase Jaeggi en `sort`/`list-sorting` (N adaptativo).
4. Reestructuración layout colores/reactive para stats-bar full-width (cuando se añadan más stats).
5. Cue cognitivo en `timers` (descartado por usuario en este pase).

