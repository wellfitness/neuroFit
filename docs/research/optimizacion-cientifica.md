# Plan de optimización científica — KinesisLab

**Fecha:** 2026-05-16
**Alcance:** revisión bibliográfica para optimizar las 20 herramientas existentes (no añadir nuevas) y derivar ejemplos prácticos aplicables en sala con clientes.
**Fuentes:** PubMed (~30 artículos vía MCP, según PubMed) y Scholar Gateway (4 consultas semánticas, 2018–2026).

---

## Principio de diseño (transversal a TODO el plan)

**Toda optimización se añade como modo/nivel opt-in, nunca reemplaza el comportamiento actual.**

KinesisLab se usa con adultos mayores. La cadencia constante, los niveles fijos y la ausencia de lures son apropiados para principiantes y para esa cohorte — son el modo *básico*. Los refinamientos de la literatura (jitter ISI, staircase adaptativo, lures, ratios incongruentes, bloques largos SART, etc.) son la **progresión hacia avanzado** y los activa la entrenadora por cliente/sesión.

Patrón de UI sugerido en cada tool:
- **Modo Básico** (default): comportamiento actual, predecible, accesible para mayores.
- **Modo Intermedio**: introduce 1 elemento de carga (p.ej. jitter ligero 0.85×–1.15×).
- **Modo Avanzado**: full jitter 0.7×–1.3×, lures, staircase, etc.

Esto vale para las 20 herramientas y para cualquier futura mejora.

---

## 0. Síntesis ejecutiva (4 hallazgos transversales)

1. **El dual-task simultáneo > secuencial**, y el motor-cognitivo es la única modalidad que mueve función ejecutiva con SMD grande (1.53) en network meta-análisis (Hao 2025 [DOI](https://doi.org/10.1007/s40520-025-03016-5); Ye 2024 [DOI](https://doi.org/10.1016/j.ijnurstu.2024.104776)). Las herramientas reactivas deben *exigir* movimiento corporal concurrente, no solo tap.
2. **Exergames cortos (1–3 meses) de baja-moderada intensidad dan los efectos cognitivos más altos** en revisión umbrella de 133 sistemáticas y 258 279 participantes (Singh 2025 [DOI](https://doi.org/10.1136/bjsports-2024-108589)). El feedback estímulo-respuesta en tiempo real amplifica ganancias sobre ejercicio aerobio equivalente (Wu 2023 [DOI](https://doi.org/10.2196/39993)).
3. **Staircase Jaeggi (+1 si bloque ≥90%, −1 si ≤70%) duplica las ganancias del n-back** vs. dificultad fija (Lintas 2025, Cohen's d 0.46 vs 0.27 [DOI](https://doi.org/10.3390/brainsci15090998)). Pero el transfer lejano (a fluido) es null en adultos medios (Ripp 2022 [DOI](https://doi.org/10.1038/s41398-022-02272-7); meta-meta SMD 0.335, Syed 2024 [DOI](https://doi.org/10.3390/jintelligence12110114)). Comunicar como mejora de WM concreta, no como "más inteligencia".
4. **Falta el marco proactive/reactive inhibition** en [go-nogo](../../src/herramientas/vanilla/tools/go-nogo/index.html) y [flechas](../../src/herramientas/vanilla/tools/flechas/index.html). Sato 2026 ([DOI](https://doi.org/10.3389/fresc.2026.1778941)) lo marca como el gap principal: SART para proactiva, Go/NoGo 75/25 con switch trials para reactiva.

---

## 1. Optimizaciones cross-cutting (afectan a varias tools)

**Recordatorio:** todas las entradas se añaden como modo opt-in junto al comportamiento actual (ver "Principio de diseño" arriba).

| # | Optimización | Tools afectadas | Cita |
|---|---|---|---|
| 1 | Modo "Variable" de ISI (jitter 0.7×–1.3×) junto al modo "Constante" actual | go-nogo, flechas, arrows, sonidos, reactive, colores, search | Bérubé 2025 [DOI](https://doi.org/10.14814/phy2.70211); Beu 2018 [DOI](https://doi.org/10.1111/ejn.14323) |
| 2 | Modo "Adaptativo Jaeggi" sobre N / set-size junto a los niveles fijos actuales | nback, sort, matrix, list-sorting | Lintas 2025 [DOI](https://doi.org/10.3390/brainsci15090998) |
| 3 | Métrica IES = goRT/accuracy + reportar goRT y noGo-acc separados | go-nogo, flechas, arrows, reactive | Guo 2026 [DOI](https://doi.org/10.1002/brb3.71214); Lin 2023 [DOI](https://doi.org/10.1111/psyp.14489) |
| 4 | Bloque baseline simple-RT que se resta al ejecutivo | colores, arrows, flechas | Lin 2023 [DOI](https://doi.org/10.1111/psyp.14489) |
| 5 | Ratios congruente/incongruente parametrizables (75/25 o 50/50) + bloque reverse | colores, arrows, flechas | Aly & Kojima 2020 [DOI](https://doi.org/10.1111/psyp.13674); Bérubé 2025 [DOI](https://doi.org/10.14814/phy2.70211) |
| 6 | Slope = RT × set-size como índice atencional | search, sort, matrix | Erdogan 2024 [DOI](https://doi.org/10.14814/phy2.70136) |
| 7 | Variable-priority instruction (alternar "prioriza X") cada bloque | colores, comba, boxing, timers, arrows | Montero-Odasso & Speechley 2018 [DOI](https://doi.org/10.1111/jgs.15219) |
| 8 | Dose mínima eficaz: ≥20 sesiones ≥30 min o 4–12 sem 2–3×/sem | todas | Thazhakkattu Vasu 2026 [DOI](https://doi.org/10.1155/jare/9242629); Ding 2025 [DOI](https://doi.org/10.1183/16000617.0170-2024) |

---

## 2. Plan por dominio cognitivo

### 2.1 Inhibición y control de interferencia

**Tools:** [go-nogo](../../src/herramientas/vanilla/tools/go-nogo/index.html), [colores](../../src/herramientas/vanilla/tools/colores/index.html), [arrows](../../src/herramientas/vanilla/tools/arrows/index.html), [flechas](../../src/herramientas/vanilla/tools/flechas/index.html)

#### Refinamientos al código

- **`go-nogo`**:
  - Añadir modo SART (75% Go / 25% NoGo, bloques 3–5 min) para inhibición proactiva. Beu 2018 ([DOI](https://doi.org/10.1111/ejn.14323)).
  - Reportar post-error slowing.
  - Implementar IES + d′ además de aciertos. Guo 2026 ([DOI](https://doi.org/10.1002/brb3.71214)).
- **`colores`** (Stroop):
  - Añadir bloque reverse-Stroop (responde a palabra, ignora color). Aly & Kojima 2020 ([DOI](https://doi.org/10.1111/psyp.13674)).
  - Bloque ejecutivo Bérubé: 75% inhibición + 25% switch, 1 min on/off, 15 trials/bloque, 500 ms fixation + 2500 ms estímulo. Bérubé 2025 ([DOI](https://doi.org/10.14814/phy2.70211)).
  - Restar RT del bloque simple al ejecutivo para interferencia pura. Lin 2023 ([DOI](https://doi.org/10.1111/psyp.14489)).
- **`arrows`** (Simon):
  - Añadir 50/50 congruente/incongruente y graficar el efecto Simon (Δ RT incong−cong). Hoy es 100% incongruente, no medible.
  - El efecto Simon se reduce con 10+ sesiones (Mata-Marín 2023 [DOI](https://doi.org/10.1162/jocn_a_02050)).
- **`flechas`** (flanker):
  - Implementar distribución 60% cong / 20% incong / 20% neutral y graficar conflict adaptation (Gratton).

#### Ejemplos prácticos para sala

1. **Stroop de conos de color** — 4 conos rojo/azul/amarillo/verde. Entrenador grita palabra de color y señala con el dedo un cono de otro color. Cliente corre a la palabra dicha (75/25 incong/cong). 1 min on / 1 min off × 6. Bérubé 2025 ([DOI](https://doi.org/10.14814/phy2.70211)).
2. **Go/NoGo verbal en shuttle** — "Verde" → sprint 3 m. "Rojo" → freeze 1 s. Trote en sitio entre cues. 75/25 en bloque proactivo, 25/75 en reactivo. Beu 2018 ([DOI](https://doi.org/10.1111/ejn.14323)).
3. **Mirror inhibition con pareja** — A ejecuta un movimiento, B replica salvo si A lleva muñequera roja visible (NoGo). 90 s/rol. Guo 2026 ([DOI](https://doi.org/10.1002/brb3.71214)); Kirsten 2023 ([DOI](https://doi.org/10.1016/bs.pbr.2022.12.002)).
4. **Stroop ladder** — escalera de agilidad con cuadrados de colores. Entrenador llama color → pisar; llama "STOP" → freeze. Avanzado: palabra escrita en color incongruente. Erdogan 2024 ([DOI](https://doi.org/10.14814/phy2.70136)).
5. **HIIT + Stroop verbal** — 3 series × 3 shuttle runs 200 m, 2 min descanso entre runs, 5 min entre series. Al final de cada serie 30 s respondiendo Stroop verbal. El RT del Stroop mejoró 15 ms hasta 48 h post-HIIT en handball profesional. Weisman 2025 ([DOI](https://doi.org/10.1519/JSC.0000000000005067)).

---

### 2.2 Atención reactiva, sostenida y dividida

**Tools:** [sonidos](../../src/herramientas/vanilla/tools/sonidos/index.html), [reactive](../../src/herramientas/vanilla/tools/reactive/index.html), [search](../../src/herramientas/vanilla/tools/search/index.html), [tracking](../../src/herramientas/vanilla/tools/tracking/index.html), [trace](../../src/herramientas/vanilla/tools/trace/index.html)

#### Refinamientos al código

- **`sonidos` y `reactive`**: actualmente no loguean RT ni accuracy. Imprescindible registrar ventana de respuesta, tap dentro/fuera, RT mediano por estímulo. Sin esto no hay métricas. Wu 2023 ([DOI](https://doi.org/10.2196/39993)).
- **`search`**:
  - Implementar feature search (pop-out) vs conjunction search (combinación de 2 features). La pendiente RT × set-size es plana en feature y empinada en conjunction.
  - Variar set-size (6, 12, 24, 48) y graficar slope como métrica primaria.
- **`tracking`**:
  - Añadir modo "smooth pursuit + cabeza fija" vs "smooth pursuit + headshake horizontal" como variantes vestibulares validadas. Appiah-Kubi 2024 ([DOI](https://doi.org/10.1371/journal.pone.0292200)).
  - Velocidad parametrizable 0.4–1.6 Hz.
- **`trace`**:
  - Añadir variante alternante 1-A-2-B-3-C (parte B del Trail Making clásico) para flexibilidad cognitiva. Osuka 2020 ([DOI](https://doi.org/10.1111/ggi.13878)).

#### Ejemplos prácticos para sala

1. **Stepping-TMT en suelo** — 16 círculos numerados 1–16 con tape sobre 1 m². Cliente pisa en orden cronometrado. Versión B: 1-A-2-B-3-C-…-8-H (flexibilidad). 3 intentos. ICC 0.82. Osuka 2020 ([DOI](https://doi.org/10.1111/ggi.13878)).
2. **Random Run con números** — 8 zonas con números 1–8 en suelo. Cliente corre en orden ascendente, números se reasignan al terminar. 1 min × 3. Alcanza 81% VO2máx — sirve como HIIT. Erdogan 2024 ([DOI](https://doi.org/10.14814/phy2.70136)).
3. **MOT low-tech** — 3 pelotas blancas + 2 amarillas. Indicar 2 blancas como targets, mover todas 10 s, cliente identifica las target. 10 trials × 3 bloques. 10 sesiones × 30 min mejoraron Useful Field of View. Michaels 2022 ([DOI](https://doi.org/10.1097/WNR.0000000000001807)). Aviso: MOT no transfiere a rendimiento deportivo. Romeas 2024 ([DOI](https://doi.org/10.1016/j.psychsport.2024.102770)).
4. **Smooth pursuit + weight-shift** — Cliente sigue con la mirada una pelota oscilante (1 Hz) mientras transfiere peso lateral al ritmo. Avanzado: añadir headshake horizontal 0.5 Hz. 3 × 60 s. Appiah-Kubi 2024 ([DOI](https://doi.org/10.1371/journal.pone.0292200)).
5. **Visual search con fichas** — 24 fichas con dígitos esparcidas; encontrar el "7" entre todos los dígitos en orden ascendente. Cronometrar set-size 12 vs 24 — la diferencia es la pendiente atencional.

---

### 2.3 Memoria de trabajo y span

**Tools:** [sort](../../src/herramientas/vanilla/tools/sort/index.html), [list-sorting](../../src/herramientas/vanilla/tools/list-sorting/index.html), [nback](../../src/herramientas/vanilla/tools/nback/index.html), [simon](../../src/herramientas/vanilla/tools/simon/index.html), [matrix](../../src/herramientas/vanilla/tools/matrix/index.html), [memoria](../../src/herramientas/vanilla/tools/memoria/index.html)

#### Refinamientos al código

- **`nback`** (la herramienta de mayor palanca):
  - Regla adaptativa Jaeggi sobre n: subir si bloque ≥90%, bajar si ≤70%. Lintas 2025 ([DOI](https://doi.org/10.3390/brainsci15090998)).
  - Lure trials: 20–30% de no-targets deben ser lures (n±1), no estímulos novedosos. Sin lures, los participantes responden por familiaridad y la métrica se rompe. Weigard 2024 ([DOI](https://doi.org/10.1111/cogs.70019)).
  - Reportar d′ = z(hit rate) − z(FA rate).
  - Dose: 20 bloques × 20 trials ~30 min/sesión.
  - Comunicar: WMT mejora WM en la tarea + integridad superior longitudinal fasciculus (Dziemian 2021 [DOI](https://doi.org/10.3389/fnhum.2021.605213)) y arousal cortical (Spironelli 2021 [DOI](https://doi.org/10.3389/fnagi.2021.718965)), pero NO inteligencia fluida en adultos medios (Ripp 2022 [DOI](https://doi.org/10.1038/s41398-022-02272-7); Himi 2022 [DOI](https://doi.org/10.1037/xge0001328)).
- **`simon`**: ya tiene staircase. Mejora menor: añadir modo "Corsi reverso".
- **`matrix`** (Corsi):
  - Mantener 3×3, añadir modo backward + block-suppression (un bloque rojo no debe pulsarse).
  - Temporización validada: 1000 ms ON + 250 ms ISI. Arts 2025 ([DOI](https://doi.org/10.1111/1460-6984.70168)).
- **`sort` y `list-sorting`**: expandir N (3→4→5) con regla Jaeggi.
- **`memoria`**: añadir métrica "intentos por par" como eficiencia.

#### Ejemplos prácticos para sala

1. **Stepping n-back** — 3 plataformas A/B/C. Carta de color cada 2 s; cliente pisa solo si coincide con la anterior (1-back) o de hace dos turnos (2-back). 1 min/bloque. Erdogan 2024 ([DOI](https://doi.org/10.14814/phy2.70136)).
2. **Cycling + n-back verbal** — Bici estática 50–60% FCR. Entrenador dice un dígito cada 2 s; cliente responde "MATCH" si coincide con hace 2 turnos. 3 × 5 min, descanso 2 min. 3 meses mejoraron Frontal Assessment Battery. Takeuchi 2020 ([DOI](https://doi.org/10.1155/2020/3859824)); Chan 2023 ([DOI](https://doi.org/10.1186/s13102-023-00749-6)).
3. **Group recall con marcadores** — 6 conos en círculo. Entrenador toca 4 en secuencia, grupo replica caminando. Aumentar span hasta error. Variante backward.
4. **Corsi físico en pared** — 9 pegatinas en cuadrícula 3×3 a altura variable. Replicar secuencia tocando con mano dominante/no dominante. Activa visuoespacial + propiocepción.
5. **Aerobic + recall verbal** — Marchar mientras se memoriza lista de 6–10 ítems al inicio. Tras 3 min recall libre. Aumentar a 12–15. 12 sem mejoraron fluencia + endurance. Chen 2023 ([DOI](https://doi.org/10.1007/s40520-023-02481-0)); Castellote-Caballero 2024 ([DOI](https://doi.org/10.1186/s12916-024-03469-x)).

---

### 2.4 Razonamiento y toma de decisiones

**Tools:** [clock](../../src/herramientas/vanilla/tools/clock/index.html), [d50](../../src/herramientas/vanilla/tools/d50/index.html), [fluency](../../src/herramientas/vanilla/tools/fluency/index.html)

#### Refinamientos al código

- **`clock`** (rotación mental):
  - Implementar graduado por ángulo de rotación. El RT crece linealmente con el ángulo (Shepard & Metzler). Reportar slope.
  - Entrenamiento multisensorial mejora cognición espacial (Paromov 2025 [DOI](https://doi.org/10.1016/j.cortex.2025.10.002)). Añadir modo "rotación con audio".
- **`d50`** (comparación numérica):
  - Implementar graduado por distancia numérica (47 vs 50 más lento que 12 vs 50). Reportar RT × distancia.
  - Cálculo mental durante ciclismo recluta compensación visual (P1↑, N4↓), compatible con submaximal. Chan 2023 ([DOI](https://doi.org/10.1186/s13102-023-00749-6)).
  - Alineación SNARC: "MAYOR" derecha, "MENOR" izquierda; medir asimetría.
- **`fluency`** (mayor gap de la suite):
  - Hoy no detecta voz. Métrica clínica de oro: clustering & switching (Troyer).
  - Quick win sin voz: tap en pantalla por palabra → genera N + intervalos inter-respuesta (proxy de switching cost).
  - Quick win mayor: Web Speech API (gratis en navegador) para captura básica y review post-tarea.
  - Combinar con marcha — fluencia + caminata es el dual-task más estudiado y predictor de caídas. Chen 2023 ([DOI](https://doi.org/10.1007/s40520-023-02481-0)).

#### Ejemplos prácticos para sala

1. **Walking fluency** — Caminar 5 min nombrando animales / frutas / palabras con "F". Anotar nº total, clusters (palabras consecutivas de misma subcategoría), switches. Predictor de salud cerebral en 50+.
2. **Mental arithmetic + boxing pads** — Entrenador grita "23+19"; cliente pega crochet si >40, jab si ≤40. 30 s on / 30 s off × 8. Extrapolado de Bérubé 2025 + Chan 2023.
3. **Sorting run** — 8 zonas con números aleatorios. Cliente corre en orden ascendente. Al terminar, reordenar y repetir. 1 min/trial × 3. Erdogan 2024 ([DOI](https://doi.org/10.14814/phy2.70136)).
4. **Mental rotation con flecha** — Tarjeta con flecha rotada (90/180/270°). Cliente se mueve físicamente en esa dirección (rota desde perspectiva propia). 20 trials mezcla rotada/no. Tada 2024 ([DOI](https://doi.org/10.3390/s24020528)).
5. **Reloj corporal** — Cliente de pie. Entrenador dice "11:50". Cliente coloca brazos como manecillas (corta = hora, larga = minutos). Mide posición.

---

### 2.5 Cognitivo-motor y pacing

**Tools:** [timers](../../src/herramientas/vanilla/tools/timers/index.html), [comba](../../src/herramientas/vanilla/tools/comba/index.html), [boxing](../../src/herramientas/vanilla/tools/boxing/index.html)

#### Refinamientos al código

- **`timers`**:
  - Modo AMRAP/EMOM con cue cognitivo cada N segundos (suma, color, palabra) + log de aciertos.
  - Modo variable-priority: alternar prompt "prioriza tiempo" / "prioriza precisión cognitiva". Montero-Odasso & Speechley 2018 ([DOI](https://doi.org/10.1111/jgs.15219)).
- **`comba` y `boxing`**:
  - Jitter en el intervalo de cue (0.7×–1.3× base) para evitar entrainment.
  - Proporción 80% cues esperables + 20% inesperados (activa actualización + inhibición).
  - `boxing`: integrar `DeviceMotionEvent` para detectar timing del golpe vs estímulo (proof-of-concept).

#### Ejemplos prácticos para sala

1. **Cognicise (J-MINT PRIME Tamba)** — 90 min/semana: 30 min movilidad+fuerza, 20 min Cognicise (marcha + sustracción seriada, marcha + contar palabras con letra), 20 min aerobio, 20 min equilibrio. 18 meses mejoraron función ejecutiva, velocidad procesamiento y memoria. Oki 2024 ([DOI](https://doi.org/10.1002/alz.14170)).
2. **Variable-priority dual-task** — Bloque 1: caminar 30 m cronometrado + restar 7 desde 100, prioridad caminar. Bloque 2: igual pero prioridad cálculo. Bloque 3: instrucción "iguala los dos". 12 semanas. Montero-Odasso 2018 ([DOI](https://doi.org/10.1111/jgs.15219)).
3. **Recumbent bike + n-back board** — Bici recumbente baja intensidad + tablet con 1-back/2-back de figuras. 30 min × 3/sem × 3 meses. Takeuchi 2020 ([DOI](https://doi.org/10.1155/2020/3859824)).
4. **Strength-Balance-Cognitive circuit** — Circuito de 6 estaciones (sentadilla, paso lateral, equilibrio unipodal, lanzamiento, plancha, salto). En cada estación, tarea cognitiva (nombrar capital, restar 3, recordar lista). 40–60 min, 2–3×/sem × 12 sem. Mejoró fast gait, dual-task gait, función ejecutiva y caídas (n=182). Montero-Odasso 2018 ([DOI](https://doi.org/10.1111/jgs.15219)); Castellote-Caballero 2024 ([DOI](https://doi.org/10.1186/s12916-024-03469-x)).
5. **Tai Chi 24-form simplificado** — 60 min × 3×/sem × 24 sem. Superior a marcha en TUG-cognitive-motor, balance unipodal con ojos cerrados, 5-STS, fall efficacy. Bajo coste, alta adherencia 60+. Qin 2025 ([DOI](https://doi.org/10.1111/jdi.70138)).
6. **Reactive plyometric con cue (formato SKILLCOURT)** — 4 colchonetas en T. Entrenador llama "norte/sur/este/oeste"; cliente salta. Variante: incongruencia con flecha visual. 30 s on / 30 s off × 6. ICC 0.83–0.89 tras día 3. Friebe 2023 ([DOI](https://doi.org/10.1249/MSS.0000000000003153)).

---

## 3. Plan de acción priorizado

### 3.1 Quick wins (1–2 días cada uno)

| Orden | Acción | Tools | Coste |
|---|---|---|---|
| 1 | Añadir modo "Variable" (ISI jitter) junto al "Constante" actual | go-nogo, flechas, arrows, colores, sonidos, reactive | ~2 h código compartido + toggle UI |
| 2 | Log RT + accuracy por trial (aplica a ambos modos) | sonidos, reactive, arrows, flechas, colores | ~3 h por tool (estructura común) |
| 3 | Añadir modo "Adaptativo Jaeggi" junto a los 3 niveles fijos | nback | ~30 líneas + toggle UI |
| 4 | Modo "Con lures" (20–30% no-targets) junto al modo sin lures | nback | ~1 día |
| 5 | Slope set-size (12, 24, 48) como modo avanzado de search | search | ~1 día |

### 3.2 Trabajos medianos (~1 semana cada uno)

| Orden | Acción | Tools |
|---|---|---|
| 6 | Stepping-TMT digital (parte B alfanumérica) | trace |
| 7 | Web Speech API + clusters/switches | fluency |
| 8 | Variable-priority mode con cue cognitivo | timers |
| 9 | Backward Corsi (modo "reverse") | matrix, simon |

### 3.3 Trabajos mayores (2+ semanas)

| Orden | Acción | Tools |
|---|---|---|
| 10 | Bloque ejecutivo Bérubé 75/25 + baseline simple-RT | colores |
| 11 | Modo SART + post-error slowing | go-nogo |
| 12 | DeviceMotion para timing real golpe/salto vs cue | boxing, comba |

---

## 4. Lectura recomendada — 5 papers de máxima palanca

Según PubMed.

### Paper 1 — Sato 2026 — Marco proactive/reactive inhibition

> **Response inhibition and exercise: from theory to translational practice.**
> Sato D. *Front Rehabil Sci.* 2026;7:1778941.
> PMID 41858319 · [DOI 10.3389/fresc.2026.1778941](https://doi.org/10.3389/fresc.2026.1778941)

**Por qué es la lectura #1:** define el marco conceptual que falta en KinesisLab para diseñar `go-nogo`, `flechas`, `arrows`. Distingue dos formas de inhibición que requieren **paradigmas y métricas diferentes**:

- **Proactiva** (anticipatoria, pre-estímulo): se mide con SART, bloques largos (≥3 min), foreperiod variable, ratio Go alto (75–80%) que genera prepotencia.
- **Reactiva** (estímulo-driven): se mide con stop-signal o Go/NoGo balanceado, foreperiod corto y predecible, ratio NoGo alto (50/50 o 75/25 invertido).

Revisa el sustrato cortico-basal del *stopping* (red front-basal: rIFG, pre-SMA, núcleo subtalámico) e identifica candidatos a vías separadas para cada modo de inhibición. Sintetiza la evidencia de que **el deporte de élite produce adaptaciones específicas a la inhibición reactiva**, mientras que el ejercicio agudo modula transitoriamente la proactiva. Implicación directa: `go-nogo` actualmente solo entrena reactiva y debería incorporar un modo SART explícito.

---

### Paper 2 — Hao 2025 — Network meta-análisis de dual-task

> **Comparative effectiveness of different dual task mode interventions on cognitive function in older adults with mild cognitive impairment or dementia: a systematic review and network meta-analysis.**
> Hao Y et al. *Aging Clin Exp Res.* 2025;37(1):139.
> PMID 40304821 · [DOI 10.1007/s40520-025-03016-5](https://doi.org/10.1007/s40520-025-03016-5)

**Por qué importa:** valida la apuesta diferencial de KinesisLab (dual-task) y *jerarquiza* las modalidades. 32 RCTs, 2370 participantes 60+, evalúa: cognitivo-cognitivo (dos tareas mentales), motor-motor (dos tareas físicas), motor-cognitivo (mixto).

**Hallazgos clave** (SUCRA y SMD):
- **Cognición global**: dual-task cognitivo lidera (SUCRA 79.2%, rank 1.6).
- **Función ejecutiva**: solo el **motor-cognitivo** muestra mejora significativa (**SMD 1.53**, IC95% 0.06–3.01). Efecto grande.
- **Marcha**: dual-task motor mejor (SMD 0.34).
- **Fuerza muscular**: dual-task motor (SMD 0.28).
- **Equilibrio**: dual-task motor (SMD 0.90).
- **Actividades de vida diaria**: motor-cognitivo (SMD 1.50).
- **Calidad de vida**: motor-cognitivo (SMD 1.20).
- **Síntomas depresivos**: motor-cognitivo (SMD −0.96).

**Implicación para KinesisLab:** las tools reactivas (colores, arrows, flechas, sonidos, reactive) y las cognitivo-motoras (timers, comba, boxing) deberían posicionarse como las modalidades más completas. El n-back/Corsi/matrix puro (cognitivo-cognitivo) gana en cognición global pero no en ejecutivo — argumento para reforzar pares de tools en sesión (ej. matrix + comba simultáneos).

---

### Paper 3 — Singh 2025 — Umbrella review ejercicio + cognición

> **Effectiveness of exercise for improving cognition, memory and executive function: a systematic umbrella review and meta-meta-analysis.**
> Singh B et al. *Br J Sports Med.* 2025;59(12):866–876.
> PMID 40049759 · [DOI 10.1136/bjsports-2024-108589](https://doi.org/10.1136/bjsports-2024-108589)

**Por qué importa:** es el meta-meta-análisis más grande hasta la fecha (133 revisiones sistemáticas, 2724 RCTs, 258 279 participantes). Da los **parámetros de diseño** que más mueven la aguja.

**Hallazgos clave** (SMD agrupado):
- Cognición general: **SMD 0.42**.
- Memoria: **SMD 0.26**.
- Función ejecutiva: **SMD 0.24**.

**Moduladores críticos:**
- **Intensidades bajas y moderadas dan efectos más grandes que altas** (contraintuitivo, importante).
- **Intervenciones cortas (1–3 meses) mayores que largas**.
- **Exergames (video games con movimiento físico) muestran los efectos más grandes** sobre cognición general y memoria.
- Memoria y ejecutiva mejoran más en niños/adolescentes que en adultos y mayores (pero adultos siguen beneficiándose).
- TDAH es la población con mayor ganancia ejecutiva.

**Implicación para KinesisLab:**
- No vender "más es mejor" — sesiones de 30–45 min a intensidad baja-moderada bastan.
- El producto KinesisLab está bien posicionado: es justamente un **exergame con movimiento real** sobre cognición, justamente la modalidad con mayor SMD.
- Ciclos de 8–12 semanas son la dosis óptima de comunicación al cliente.

---

### Paper 4 — Erdogan 2024 — SKILLCOURT como plantilla de drills

> **Modulation of physical exercise intensity in motor-cognitive training of adults using the SKILLCOURT technology.**
> Erdogan G et al. *Physiol Rep.* 2024;12(23):e70136.
> PMID 39638640 · [DOI 10.14814/phy2.70136](https://doi.org/10.14814/phy2.70136)

**Por qué importa:** demuestra que el motor-cognitivo **puede alcanzar intensidad HIIT** (hasta 89% FCmáx, 81% VO2máx, 13.37 METs, lactato 7.81 mmol/L) — derriba el prejuicio de que el entrenamiento cognitivo-motor es siempre "suave". Las 5 tareas son directamente portables a sala con conos / pegatinas / mat.

**Las 5 tareas SKILLCOURT (todas 1 min/trial, replicables low-tech):**

| Tarea | Constructo | Réplica en sala |
|---|---|---|
| **Shape Jump** | Inhibición + decisión | 4 fichas en suelo con formas; entrenador dice forma+color incongruentes; saltar a la forma |
| **Remember Forms** | Memoria de trabajo (1-back) | Tarjetas con símbolos en colores cambiantes; pisar plataforma si coincide con la anterior |
| **Dual Task (MOT)** | Atención dividida + agilidad | 5 pelotas, recordar 2 mientras corre a otra señal |
| **Sorting** | Set-shifting + planificación | 8 zonas con números aleatorios; correr en orden ascendente |
| **Random Run** | Planificación + WM + agilidad | Una zona destacada amarilla (objetivo), otra azul (siguiente) — anticipa secuencia |

**Hallazgos cuantitativos:**
- %VO2máx entre tareas: 22%–81% (p<0.001).
- %FCmáx: 49%–89%.
- Lactato: 0.93–7.81 mmol/L.
- RPE: 8.5–16.4.
- Las tareas motor-cognitivas superan significativamente al entrenamiento cognitivo computarizado en demanda fisiológica.

**Implicación:** estos 5 drills cubren los 5 dominios de KinesisLab con material trivial — los recomiendo como **plantilla base de la sesión presencial de sala**.

---

### Paper 5 — Lintas 2025 — Adaptive Dual N-Back funciona

> **Boosting Working Memory in ADHD: Adaptive Dual N-Back Training Enhances WAIS-IV Performance, but Yields Mixed Corsi Outcomes.**
> Lintas A, Bader M, Villa AEP. *Brain Sci.* 2025;15(9):998.
> PMID 41008358 · [DOI 10.3390/brainsci15090998](https://doi.org/10.3390/brainsci15090998)

**Por qué importa:** evidencia reciente (sep 2025) y directa sobre el parámetro que más mueve la aguja en n-back: **adaptativo vs fijo**.

**Diseño:** 106 jóvenes adultos (33 ADHD no medicados, 42 ADHD medicados, 45 controles) → asignados a **fixed dual 1-back (FD1B)** o **adaptive dual N-back** (n sube al completar bloque). 18 sesiones diarias en 1 mes.

**Hallazgos clave:**
- **Mejora masiva en la propia tarea DNB**: hasta **204.6% en controles (d = 1.85)** con condición adaptativa.
- **Transfer al WAIS-IV Working Memory Index — Digit Span Backward**:
  - Adaptive: **d = 0.46**.
  - Fixed: **d = 0.27**.
  - El adaptativo **duplica el tamaño del efecto** sobre WM verbal medida con un test estándar independiente.
- **Corsi (visuoespacial)**: ganancias modestas y, sorprendentemente, **mayores en FD1B que en adaptive**. El transfer entre dominios verbal y visuoespacial **no se garantiza** automáticamente.
- Controles superan a ADHD medicado en subtests WAIS-IV; no hay diferencia entre medicados y no medicados.
- Correlaciones tarea-específicas: el adaptive *aumenta* la correlación DNB↔Corsi en controles (r=0.60) y ADHD medicados (r=0.51).

**Implicación para KinesisLab:**
- **Implementar regla adaptativa Jaeggi en [nback](../../src/herramientas/vanilla/tools/nback/index.html) es el cambio individual con mayor ROI cognitivo** de todo el plan.
- No prometer transfer cruzado: el WMT verbal no entrena automáticamente Corsi. Conviene mantener `matrix` y `nback` como tools separadas y comunicarlas como complementarias, no redundantes.
- Sesiones diarias 18 × ~30 min (1 mes) es una dosis basada en evidencia que se puede recomendar al cliente.

---

## 5. Bibliografía adicional consultada

Otras fuentes citadas en el plan (todas vía PubMed o Scholar Gateway).

| Autor | Año | DOI | Aporte |
|---|---|---|---|
| Ye | 2024 | [10.1016/j.ijnurstu.2024.104776](https://doi.org/10.1016/j.ijnurstu.2024.104776) | Simultaneous > sequential dual-task (g=0.71 WM) |
| Zhou | 2024 | [10.1097/NPT.0000000000000489](https://doi.org/10.1097/NPT.0000000000000489) | Dual-task verbal + motor reduce dual-task cost en Parkinson |
| Wu | 2023 | [10.2196/39993](https://doi.org/10.2196/39993) | Running-exergame > cycling para flanker RT y P3b |
| Voinescu | 2024 | [10.1002/14651858.CD013853.pub2](https://doi.org/10.1002/14651858.CD013853.pub2) | Cochrane review exergaming en MCI/dementia |
| Mata-Marín | 2023 | [10.1162/jocn_a_02050](https://doi.org/10.1162/jocn_a_02050) | Habitual inhibition se forma con 10 sesiones |
| Beu | 2018 | [10.1111/ejn.14323](https://doi.org/10.1111/ejn.14323) | SART para inhibición proactiva |
| Bérubé | 2025 | [10.14814/phy2.70211](https://doi.org/10.14814/phy2.70211) | Bloque ejecutivo 75/25 Stroop |
| Aly & Kojima | 2020 | [10.1111/psyp.13674](https://doi.org/10.1111/psyp.13674) | Reverse-Stroop más sensible en mayores activos |
| Lin | 2023 | [10.1111/psyp.14489](https://doi.org/10.1111/psyp.14489) | Restar simple-RT al ejecutivo para interferencia pura |
| Guo | 2026 | [10.1002/brb3.71214](https://doi.org/10.1002/brb3.71214) | IES como métrica Go/NoGo |
| Weisman | 2025 | [10.1519/JSC.0000000000005067](https://doi.org/10.1519/JSC.0000000000005067) | HIIT mejora Stroop hasta 48h post |
| Friebe | 2023 | [10.1249/MSS.0000000000003153](https://doi.org/10.1249/MSS.0000000000003153) | SKILLCOURT reliability (ICC 0.83–0.89) |
| Osuka | 2020 | [10.1111/ggi.13878](https://doi.org/10.1111/ggi.13878) | Stepping Trail Making Test validado |
| Oki | 2024 | [10.1002/alz.14170](https://doi.org/10.1002/alz.14170) | J-MINT PRIME Tamba Cognicise protocol |
| Montero-Odasso | 2018 | [10.1111/jgs.15219](https://doi.org/10.1111/jgs.15219) | Variable-priority dual-task review |
| Takeuchi | 2020 | [10.1155/2020/3859824](https://doi.org/10.1155/2020/3859824) | Recumbent cycling + n-back × 3 meses |
| Chan | 2023 | [10.1186/s13102-023-00749-6](https://doi.org/10.1186/s13102-023-00749-6) | ERP de dual-task cycling + arithmetic |
| Chen | 2023 | [10.1007/s40520-023-02481-0](https://doi.org/10.1007/s40520-023-02481-0) | Fluencia verbal + cardio en mayores |
| Castellote-Caballero | 2024 | [10.1186/s12916-024-03469-x](https://doi.org/10.1186/s12916-024-03469-x) | 12-sem combined physical+cognitive en MCI |
| Qin | 2025 | [10.1111/jdi.70138](https://doi.org/10.1111/jdi.70138) | Tai Chi 24-form > walking en TUG-cognitive-motor |
| Michaels | 2022 | [10.1097/WNR.0000000000001807](https://doi.org/10.1097/WNR.0000000000001807) | 3D-MOT 10 × 30 min mejora UFOV |
| Romeas | 2024 | [10.1016/j.psychsport.2024.102770](https://doi.org/10.1016/j.psychsport.2024.102770) | MOT NO transfiere a deporte real |
| Appiah-Kubi | 2024 | [10.1371/journal.pone.0292200](https://doi.org/10.1371/journal.pone.0292200) | Smooth pursuit + headshake en 5 días |
| Paromov | 2025 | [10.1016/j.cortex.2025.10.002](https://doi.org/10.1016/j.cortex.2025.10.002) | Música mejora cognición espacial |
| Kirsten | 2023 | [10.1016/bs.pbr.2022.12.002](https://doi.org/10.1016/bs.pbr.2022.12.002) | Gamified Go/NoGo preserva SSRT validity |
| Ripp | 2022 | [10.1038/s41398-022-02272-7](https://doi.org/10.1038/s41398-022-02272-7) | WMT NO transfiere en adultos medios (RCT) |
| Himi | 2022 | [10.1037/xge0001328](https://doi.org/10.1037/xge0001328) | Límites del near-transfer en WMT |
| Dziemian | 2021 | [10.3389/fnhum.2021.605213](https://doi.org/10.3389/fnhum.2021.605213) | WMT mejora integridad SLF (DTI) |
| Spironelli | 2021 | [10.3389/fnagi.2021.718965](https://doi.org/10.3389/fnagi.2021.718965) | WMT mejora arousal cortical en mayores |
| Syed | 2024 | [10.3390/jintelligence12110114](https://doi.org/10.3390/jintelligence12110114) | Meta-meta WMT en sanos: SMD 0.335 |
| Weigard | 2024 | [10.1111/cogs.70019](https://doi.org/10.1111/cogs.70019) | Necesidad de lure trials en n-back |
| Arts | 2025 | [10.1111/1460-6984.70168](https://doi.org/10.1111/1460-6984.70168) | Corsi 3×3 timing 1000ms/250ms ISI |
| Tada | 2024 | [10.3390/s24020528](https://doi.org/10.3390/s24020528) | HoloLens MR para spatial cognition |
| Ding | 2025 | [10.1183/16000617.0170-2024](https://doi.org/10.1183/16000617.0170-2024) | Dosis mínima 30 min, 4 sem en COPD |
| Thazhakkattu Vasu | 2026 | [10.1155/jare/9242629](https://doi.org/10.1155/jare/9242629) | Scoping review DTT 60+, 12–24 sem |
| Versi | 2022 | [10.1155/2022/6686910](https://doi.org/10.1155/2022/6686910) | Simultaneous > sequential dual-task |
| Samnani | 2025 | [10.1002/pri.70146](https://doi.org/10.1002/pri.70146) | Protocolo 8-sem DTT 60 min × 3/sem |
| Pergher | 2018 | [10.1002/brb3.1136](https://doi.org/10.1002/brb3.1136) | N-back → transfer a Gf en mayores |

---

## 6. Próximo paso sugerido

Empezar por los **quick wins 1–3** (jitter ISI, log RT, regla Jaeggi en nback) porque sin métricas en código no es posible verificar el impacto del resto del plan. En paralelo, probar los **5 drills de Erdogan 2024** en sala con clientes esta semana — todos son low-equipment y validados.

**Aviso de uso:** todas las citas provienen de PubMed (vía MCP) y Scholar Gateway. Cualquier afirmación con DOI debe verificarse contra el artículo original antes de comunicarla como evidencia clínica.
