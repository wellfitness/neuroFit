# KinesisLab 🧠⚡

<p align="center">
  <em>Batería Open Source de Entrenamiento Cognitivo-Motor para Prevención de Caídas y Neuroplasticidad.</em>
</p>

## ¿Qué es KinesisLab?

KinesisLab es una colección puramente nativa (HTML, CSS, JS) de **20 herramientas interactivas** diseñadas especialmente para uso clínico y de entrenamiento. 
Al inyectar desafíos cognitivos severos de forma auditiva y visual mientras el sujeto se halla en tensión motora o marcha, inducimos escenarios de *Dual-Task* comprobados científicamente para preservar la masa gris en adultos de mediana y avanzada edad (mujeres +40).

También disponible como **app Android nativa** en Google Play Store (WebView bundled, 100% offline, sin registro).

### Características Destacadas
* 🚫 **Sin Dependencias (Zero-Dependency):** No necesitas `npm`, ni Node.js, ni React. Funciona extrayendo los archivos en cualquier tablet prehistórica o navegador web moderno. Totalmente **Offline**.
* ⚡ **Performance Clínica (MPA):** Cada una de las 18 herramientas funciona en cápsulas y archivos totalmente aislados (*Multi-Page Application*). Un posible error editando el *Fit Boxing* jamás tirará tu aplicación del *Test Stroop*.
* 🗣️ **Web Speech API Integrada:** Decenas de herramientas "cantan" y narran auditivamente los comandos mientras el paciente no puede mirar la pantalla.
* 💎 **UI Accesible Antifrágil:** Tipografías grandes, interfaces masivas, colores ciegos-friendly y botones vastos.

## 🧰 Las 20 Herramientas Incluidas (Vanilla Engine)

La suite aloja tres niveles de estimulación neurológica pura:

1. **Voz Activa Acíclica:** Fit Boxing, Comba Fit.
2. **Ritmo y Decisión:** Colores, Sonidos, Simon, Matrix, Reactive Signals.
3. **Temporizadores Clínicos Puros:** Stroop Incongruente, Tracking Visuomotor, Fluencia Verbal Abierta, D50 (Aritmética Bajo Estrés), Conflicto de Flechas, Búsqueda de Distractores, Ordenamiento en Tiempo Real, Reloj de Orientación ACT, Laberintos Motores, Trazado Alfanumérico, Contadores Clínicos.

## 🚀 Uso e Instalación (Desarrolladores & Clínicos)

1. Simplemente clona este repositorio:
   ```bash
   git clone https://github.com/wellfitness/kinesislab.git
   ```
2. No hace falta compilar nada. 
3. Dirígete a tu administrador de archivos y **haz doble clic** sobre:
   `/src/herramientas/vanilla/index.html`
4. Se abrirá el elegante Dashboard de tarjetas listando todas tus herramientas para ser tocadas y ejecutadas.

## 📱 App Android (WebView bundled)

La versión Android empaqueta las 20 herramientas dentro del APK y funciona 100% offline. No es una TWA — usa un WebView nativo con `WebViewAssetLoader` sirviendo los assets bajo `https://appassets.androidplatform.net/`.

**Fuente de verdad única**: `src/herramientas/vanilla/`. El pipeline Gradle (`syncWebAssets` task) copia automáticamente source → APK antes de cada build aplicando transformaciones mínimas (fonts locales, sin sw-updater).

```bash
cd android
./gradlew assembleDebug        # APK debug para emulador
./gradlew bundleRelease        # AAB firmado para Play Store
```

Documentación detallada del pipeline, publicación y troubleshooting: [`docs/ANDROID.md`](docs/ANDROID.md).

## 🛠️ Arquitectura
El motor compartido consta de un layout seguro `css/tool-base.css`. 
Cada nueva herramienta que incluyas se programa sencillamente creando una carpeta en `src/herramientas/vanilla/tools/` y escribiendo sus variables de velocidad localmente. Toda herramienta tiene a su disposición componentes estándar como `[Cadencia] [Arrancar] [Pausar] [Volver]`.

## 👩‍⚕️ Autoría y Licencia
Proyecto documentado, purgado y diseñado por Elena Cruces / [Movimiento Funcional], entregando software limpio para frenar la fragilidad motora.

Este software se distribuye bajo la **Licencia MIT**. Puedes usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias del software libremente, siempre que incluyas la nota de copyright y la licencia en todas las copias.

---
*"El estímulo inestable es el padre de la longevidad estructural"*
