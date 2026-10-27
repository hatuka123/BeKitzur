package com.ktav.font;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

// Hosts the Ktav web app (assets/www) in a WebView and supplies what a bare
// WebView lacks: file picking with the camera, saving/sharing downloads, and
// printing.
public class MainActivity extends Activity {
    private static final int REQ_FILE = 1;
    private static final String DOWNLOADS = "content://media/external/downloads";
    private static final String RELATIVE_PATH = "relative_path";

    private WebView web;
    private ValueCallback<Uri[]> pending;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:")) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                return chooseFile(callback, params);
            }
        });

        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var d=document.getElementById('editor');" +
            "if(d&&d.open){d.close();return 1}return 0})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String r) {
                    if (!"1".equals(r)) finish();
                }
            });
    }

    private boolean chooseFile(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (pending != null) pending.onReceiveValue(null);
        pending = callback;
        cameraUri = null;

        String[] types = params.getAcceptTypes();
        boolean image = types != null && types.length > 0 && types[0].startsWith("image");

        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType(image ? "image/*" : "*/*");

        Intent camera = null;
        if (image && Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, "ktav_" + System.currentTimeMillis() + ".jpg");
            v.put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg");
            v.put(RELATIVE_PATH, "Pictures/Ktav");
            try {
                cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            } catch (Exception e) {
                cameraUri = null;
            }
            if (cameraUri != null) {
                camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        }

        Intent intent;
        if (camera != null && params.isCaptureEnabled()) {
            intent = camera;
        } else {
            intent = Intent.createChooser(pick, null);
            if (camera != null) intent.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try {
            startActivityForResult(intent, REQ_FILE);
            return true;
        } catch (ActivityNotFoundException e) {
            dropCameraUri();
            pending = null;
            return false;
        }
    }

    private void dropCameraUri() {
        if (cameraUri == null) return;
        try {
            getContentResolver().delete(cameraUri, null, null);
        } catch (Exception ignored) {
        }
        cameraUri = null;
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        if (request != REQ_FILE || pending == null) {
            super.onActivityResult(request, result, data);
            return;
        }
        Uri[] picked = null;
        if (result == RESULT_OK) {
            if (data != null && data.getData() != null) {
                picked = new Uri[]{data.getData()};
                dropCameraUri();
            } else if (cameraUri != null) {
                picked = new Uri[]{cameraUri};
            }
        } else {
            dropCameraUri();
        }
        pending.onReceiveValue(picked);
        pending = null;
    }

    // Saves into Downloads/Ktav (Android 10+) and opens the share sheet,
    // so the font can go straight to Telegram, mail or Drive.
    private void saveAndShare(String name, byte[] bytes, String mime) throws Exception {
        name = new File(name).getName();
        File dir = new File(getCacheDir(), FilesProvider.DIR);
        dir.mkdirs();
        OutputStream out = new FileOutputStream(new File(dir, name));
        out.write(bytes);
        out.close();

        boolean saved = false;
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(RELATIVE_PATH, "Download/Ktav");
            try {
                Uri uri = getContentResolver().insert(Uri.parse(DOWNLOADS), v);
                if (uri != null) {
                    OutputStream o = getContentResolver().openOutputStream(uri);
                    o.write(bytes);
                    o.close();
                    saved = true;
                }
            } catch (Exception ignored) {
            }
        }

        final boolean savedFinal = saved;
        final Uri share = Uri.parse("content://" + FilesProvider.AUTHORITY + "/" + Uri.encode(name));
        final String type = mime;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (savedFinal) {
                    Toast.makeText(MainActivity.this, "Download/Ktav", Toast.LENGTH_SHORT).show();
                }
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(type);
                send.putExtra(Intent.EXTRA_STREAM, share);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(Intent.createChooser(send, null));
                } catch (ActivityNotFoundException ignored) {
                }
            }
        });
    }

    private class Bridge {
        @JavascriptInterface
        public void saveFile(String name, String base64, String mime) {
            try {
                saveAndShare(name, Base64.decode(base64, Base64.DEFAULT), mime);
            } catch (final Exception e) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(MainActivity.this, String.valueOf(e.getMessage()), Toast.LENGTH_LONG).show();
                    }
                });
            }
        }

        @JavascriptInterface
        public void print() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    PrintManager pm = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                    pm.print("Ktav", web.createPrintDocumentAdapter("Ktav"), null);
                }
            });
        }
    }
}
