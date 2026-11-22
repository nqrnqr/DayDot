import fs from 'node:fs';
import path from 'node:path';

/**
 * Configures native Android WindowInsets & theme bar styling inside MainActivity
 * and styles.xml so status bar / display cutout / navigation bar never overlap
 * WebView headers on Android 15/16 (HyperOS, OneUI, Pixel, etc.) regardless of
 * WebView version or CSS env(safe-area-inset-*) quirks.
 */
const androidRoot = path.join(process.cwd(), 'android', 'app', 'src', 'main');
const mainActivityPath = path.join(
  androidRoot,
  'java',
  'top',
  'daydot',
  'app',
  'MainActivity.java',
);
const valuesStylesPath = path.join(androidRoot, 'res', 'values', 'styles.xml');
const valuesNightDir = path.join(androidRoot, 'res', 'values-night');
const valuesNightStylesPath = path.join(valuesNightDir, 'styles.xml');

if (!fs.existsSync(mainActivityPath)) {
  console.error('MainActivity.java not found at', mainActivityPath);
  process.exit(1);
}

const mainActivitySource = `package top.daydot.app;

import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private View rootContent;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);

        rootContent = findViewById(android.R.id.content);
        if (rootContent != null) {
            boolean night =
                (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES;
            applyBarTheme(night, night ? "#111216" : "#F7F7F8");

            ViewCompat.setOnApplyWindowInsetsListener(rootContent, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                boolean imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
                int bottom = imeVisible ? Math.max(bars.bottom, ime.bottom) : bars.bottom;
                v.setPadding(bars.left, bars.top, bars.right, bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(rootContent);
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.addJavascriptInterface(new DayDotNativeBridge(), "DayDotNative");
        }
    }

    private void applyBarTheme(boolean isDark, String hexColor) {
        int bgColor;
        try {
            bgColor = Color.parseColor(hexColor);
        } catch (Exception ignored) {
            bgColor = isDark ? Color.parseColor("#111216") : Color.parseColor("#F7F7F8");
        }
        Window window = getWindow();
        View decor = window.getDecorView();
        decor.setBackgroundColor(bgColor);
        if (rootContent != null) {
            rootContent.setBackgroundColor(bgColor);
        }
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decor);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }

    private final class DayDotNativeBridge {
        @JavascriptInterface
        public void setSystemBarTheme(final boolean isDark, final String hexColor) {
            runOnUiThread(() -> applyBarTheme(isDark, hexColor));
        }
    }
}
`;

fs.writeFileSync(mainActivityPath, mainActivitySource, 'utf8');

if (fs.existsSync(valuesStylesPath)) {
  let styles = fs.readFileSync(valuesStylesPath, 'utf8');
  if (!styles.includes('android:windowBackground')) {
    styles = styles.replace(
      '<item name="android:background">@null</item>',
      '<item name="android:background">@null</item>\n        <item name="android:windowBackground">#F7F7F8</item>',
    );
    fs.writeFileSync(valuesStylesPath, styles, 'utf8');
  }
}

fs.mkdirSync(valuesNightDir, { recursive: true });
const nightStyles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <item name="android:windowBackground">#111216</item>
    </style>
</resources>
`;
fs.writeFileSync(valuesNightStylesPath, nightStyles, 'utf8');

console.log('Configured native Android WindowInsets & DayDotNative bar theme bridge.');
