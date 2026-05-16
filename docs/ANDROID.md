# App Android — KinesisLab

App nativa que empaqueta las 20 herramientas cognitivo-motoras dentro de un WebView.
**No es una TWA** — todo el contenido vive dentro del APK y funciona 100% offline.

---

## Arquitectura

| Componente | Rol |
|---|---|
| `MainActivity` (Java, `ComponentActivity`) | Una sola Activity que instancia un WebView a pantalla completa |
| `WebViewAssetLoader` | Sirve los assets del APK bajo el host virtual `https://appassets.androidplatform.net/` (same-origin real) |
| `OnBackPressedDispatcher` | Back predictivo — retrocede en el WebView o cierra la app si no hay más historial |
| `WindowInsetsControllerCompat` | Modo immersive fullscreen desde API 21 |
| Splash image | Drawable local, fade-out cuando el dashboard termina de cargar |

### Dependencias mínimas

```gradle
implementation platform('org.jetbrains.kotlin:kotlin-bom:1.8.22')
implementation 'androidx.activity:activity:1.9.3'
implementation 'androidx.core:core:1.13.1'
implementation 'androidx.webkit:webkit:1.12.1'
```

---

## Pipeline de sincronización

**La única fuente de verdad es `src/herramientas/vanilla/`**. Los HTML/CSS/JS
bundlados dentro del APK se regeneran automáticamente antes de cada build.

### Script `scripts/sync-android-assets.sh`

1. Borra `android/app/src/main/assets/` (conserva `fonts/`).
2. Copia `src/herramientas/vanilla/` → `android/app/src/main/assets/src/herramientas/vanilla/`.
3. Copia imágenes referenciadas (`logo-*.webp`, `mi-foto.webp`) → `android/app/src/main/assets/assets/`.
4. Copia `legal.html` y `privacy.html` al root.
5. Aplica transformaciones Android a cada HTML:
   - Elimina `<link>` a Google Fonts CDN.
   - Elimina `<script>` del service worker updater (no aplica en WebView).
   - Inyecta `<link rel="stylesheet" href="/fonts/local-fonts.css">` al `<head>`.

### Gradle task `syncWebAssets`

Definida en `android/app/build.gradle` y enganchada a `preBuild`. Cada
`./gradlew assembleDebug` o `./gradlew bundleRelease` ejecuta el script
automáticamente. **Cero drift** entre web y APK.

---

## Comandos de build

```bash
# APK debug (para instalar en emulador/dispositivo de prueba)
cd android && ./gradlew assembleDebug
# Resultado: android/app/build/outputs/apk/debug/app-debug.apk

# AAB release firmado (para Play Console)
cd android && ./gradlew bundleRelease
# Resultado: android/app/build/outputs/bundle/release/app-release.aab
```

### Requisitos para `bundleRelease`

Crear `android/gradle.properties` (gitignored) con:

```properties
android.useAndroidX=true
org.gradle.jvmargs=-Xmx2048m

KEYSTORE_FILE=../kinesislab.jks
KEYSTORE_PASSWORD=<password>
KEY_ALIAS=<alias>
KEY_PASSWORD=<password>
```

El keystore `android/kinesislab.jks` **nunca se commitea**.

---

## Instalar y probar en emulador

```bash
# Asumiendo un AVD corriendo
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n kinesislab.movimientofuncional.app/.MainActivity
```

Para emuladores en Windows/Git Bash, prefijar con `MSYS_NO_PATHCONV=1`
al usar rutas `/sdcard/...`:

```bash
MSYS_NO_PATHCONV=1 adb shell screencap -p /sdcard/shot.png
```

---

## Publicación en Google Play Store

### Antes de subir

- [ ] Bumpear `versionCode` en `android/app/build.gradle` (cada subida requiere uno único).
- [ ] Actualizar `versionName` si aplica (semver).
- [ ] `./gradlew bundleRelease` y verificar tamaño.
- [ ] Verificar firma: `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab`.

### Play Console

1. [play.google.com/console](https://play.google.com/console) → app KinesisLab.
2. **Probar y publicar** → **Pruebas** → **Pruebas cerradas** → **Crear versión**.
3. Subir `app-release.aab`.
4. Rellenar release name y release notes.
5. Roll out.

### Descripción (para la ficha de Play Store)

```
KinesisLab es una colección gratuita y open source de 20 herramientas interactivas
de entrenamiento cognitivo-motor, diseñadas para profesionales del ejercicio y
la salud.

CARACTERÍSTICAS PRINCIPALES:

• 20 herramientas de entrenamiento cognitivo-motor
• Temporizadores profesionales (AMRAP, EMOM, intervalos)
• Tests cognitivos validados (Stroop, Go/No-Go, N-Back, Simon)
• Herramientas reactivas con estímulos visuales y auditivos
• Funciona sin conexión a internet (100% offline)
• Sin registro ni datos personales

DOMINIOS COGNITIVOS QUE ENTRENA:

• Atención y velocidad de procesamiento
• Memoria de trabajo
• Razonamiento y cálculo
• Coordinación cognitivo-motora

Basado en investigación sobre neuroplasticidad y prevención de caídas.
Desarrollado por Movimiento Funcional.
```

---

## Troubleshooting

### "Espacio en disco insuficiente" durante DexMerging
Disco lleno. Liberar espacio (`C:\Users\...\.gradle\caches`, Android SDK system
images no usados, etc.).

### "Duplicate class kotlin.streams.jdk8..."
Conflicto de `kotlin-stdlib` vs `kotlin-stdlib-jdk8` por dependencia antigua.
Ya resuelto vía `kotlin-bom` — si vuelve a aparecer tras añadir una dependencia,
mantener el BOM como primera línea de `dependencies {}`.

### Warning "Is-" boolean properties deprecated
Son internos del AGP. Se resuelve subiendo a AGP 8.11+ (ya hecho).

### `adb.exe: no devices/emulators found`
Emulador cerrado. Arrancar desde Android Studio (Device Manager → Play) o CLI:

```bash
"$ANDROID_SDK/emulator/emulator.exe" -avd <nombre> -no-snapshot-save
```

---

## Historial del proyecto Android

- v1.x — TWA con PWABuilder (Chrome Custom Tabs + Digital Asset Links).
- v2.0.0 (versionCode 3) — Migración a WebView nativo + assets bundled.
- v2.0.0 (versionCode 4) — AGP 8.11, AndroidX, WebViewAssetLoader, WebP logos,
  pipeline de sync automático, AAB de 3.4 MB. Primera beta cerrada en Play.
