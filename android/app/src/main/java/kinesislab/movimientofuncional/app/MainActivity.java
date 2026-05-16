package kinesislab.movimientofuncional.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.view.Gravity;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

import java.util.Locale;

public class MainActivity extends ComponentActivity {

    private static final String APP_BASE = "https://appassets.androidplatform.net/";
    private static final String DASHBOARD_PATH = "src/herramientas/vanilla/dashboard.html";
    private static final int SPLASH_MIN_DURATION_MS = 900;
    private static final int SPLASH_FADE_MS = 320;

    private WebView webView;
    private ImageView splashView;
    private boolean splashDismissed = false;
    private long splashStartedAt = 0L;
    private AndroidTTSBridge ttsBridge;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        WebView.setWebContentsDebuggingEnabled(true);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#000806"));

        webView = new WebView(this);
        root.addView(webView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        splashView = new ImageView(this);
        splashView.setImageResource(R.drawable.splash_logo);
        splashView.setScaleType(ImageView.ScaleType.FIT_CENTER);
        splashView.setBackgroundColor(Color.parseColor("#000806"));
        FrameLayout.LayoutParams splashParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        splashParams.gravity = Gravity.CENTER;
        root.addView(splashView, splashParams);

        setContentView(root);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        // Ignora la escala de fuente del sistema (Ajustes → Pantalla → Tamaño de fuente).
        // Sin esto, en dispositivos con fuente "grande" (típico en Realme/ColorOS y en
        // móviles de personas mayores) los textos crecen pero los contenedores en px no,
        // descuadrando todo el layout. La app define su propia tipografía accesible.
        settings.setTextZoom(100);

        webView.setWebViewClient(new WebViewClientCompat() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                if (url.startsWith(APP_BASE)) {
                    return false;
                }

                try {
                    Intent browser = new Intent(Intent.ACTION_VIEW, request.getUrl());
                    browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(browser);
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (url.endsWith("/dashboard.html")) {
                    scheduleSplashDismiss();
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient());

        ttsBridge = new AndroidTTSBridge(this, webView);
        webView.addJavascriptInterface(ttsBridge, "AndroidTTS");

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        setImmersive();
        splashStartedAt = System.currentTimeMillis();
        webView.loadUrl(APP_BASE + DASHBOARD_PATH);
    }

    private void scheduleSplashDismiss() {
        if (splashDismissed || splashView == null) return;
        long elapsed = System.currentTimeMillis() - splashStartedAt;
        long remaining = Math.max(0L, SPLASH_MIN_DURATION_MS - elapsed);
        splashView.postDelayed(this::dismissSplash, remaining);
    }

    private void dismissSplash() {
        if (splashDismissed || splashView == null) return;
        splashDismissed = true;
        splashView.animate()
            .alpha(0f)
            .setDuration(SPLASH_FADE_MS)
            .setListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    if (splashView != null && splashView.getParent() instanceof FrameLayout) {
                        ((FrameLayout) splashView.getParent()).removeView(splashView);
                    }
                    splashView = null;
                }
            })
            .start();
    }

    private void setImmersive() {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        controller.hide(WindowInsetsCompat.Type.systemBars());
        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
    }

    @Override
    protected void onResume() {
        super.onResume();
        setImmersive();
    }

    @Override
    protected void onDestroy() {
        if (ttsBridge != null) {
            ttsBridge.shutdown();
            ttsBridge = null;
        }
        super.onDestroy();
    }

    /**
     * Bridge entre JavaScript (window.AndroidTTS) y android.speech.tts.TextToSpeech.
     * Solución infalible para la síntesis de voz dentro del WebView, donde
     * window.speechSynthesis es inconsistente entre versiones/dispositivos.
     * Las herramientas (comba, boxing, clock, arrows) lo invocan a través de
     * assets/js/tts-bridge.js, que cae al Web Speech API si el bridge no existe.
     */
    private static final class AndroidTTSBridge {
        private final WebView webView;
        private TextToSpeech tts;
        private boolean ready = false;

        AndroidTTSBridge(Context ctx, WebView webView) {
            this.webView = webView;
            this.tts = new TextToSpeech(ctx.getApplicationContext(), status -> {
                if (status != TextToSpeech.SUCCESS) return;
                int result = tts.setLanguage(new Locale("es", "ES"));
                if (result == TextToSpeech.LANG_MISSING_DATA
                        || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                    tts.setLanguage(Locale.getDefault());
                }
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                    @Override public void onStart(String utteranceId) { /* noop */ }
                    @Override public void onDone(String utteranceId) { fireDone(utteranceId); }
                    @Override @SuppressWarnings("deprecation")
                    public void onError(String utteranceId) { fireDone(utteranceId); }
                    @Override public void onError(String utteranceId, int errorCode) { fireDone(utteranceId); }
                });
                ready = true;
            });
        }

        private void fireDone(String utteranceId) {
            if (utteranceId == null || !utteranceId.startsWith("klw_")) return;
            // Las llamadas a evaluateJavascript deben ocurrir en el hilo principal del WebView.
            webView.post(() -> webView.evaluateJavascript(
                "window.__androidTTSDone && window.__androidTTSDone('" + utteranceId + "')",
                null
            ));
        }

        @JavascriptInterface
        public boolean isReady() {
            return ready;
        }

        @JavascriptInterface
        public void speak(String text, float rate) {
            if (!ready || tts == null || text == null) return;
            tts.setSpeechRate(rate > 0f ? rate : 1.0f);
            tts.speak(text, TextToSpeech.QUEUE_ADD, null, "kl_" + System.nanoTime());
        }

        @JavascriptInterface
        public void speakWithCallback(String text, float rate, String callbackId) {
            if (callbackId == null) return;
            if (!ready || tts == null || text == null) {
                fireDone(callbackId);
                return;
            }
            tts.setSpeechRate(rate > 0f ? rate : 1.0f);
            // El parámetro Bundle es null porque ya pasamos utteranceId como 4º arg.
            int code = tts.speak(text, TextToSpeech.QUEUE_ADD, null, callbackId);
            if (code != TextToSpeech.SUCCESS) fireDone(callbackId);
        }

        @JavascriptInterface
        public void cancel() {
            if (tts != null) tts.stop();
        }

        void shutdown() {
            if (tts != null) {
                tts.stop();
                tts.shutdown();
                tts = null;
            }
            ready = false;
        }
    }
}
