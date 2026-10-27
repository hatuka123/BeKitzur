#!/usr/bin/env bash
# Builds ktav/android/build/Ktav.apk: the web app in a WebView.
# Needs (Ubuntu/Debian): apt install aapt apksigner zipalign android-sdk-platform-23 dalvik-exchange
set -euo pipefail
cd "$(dirname "$0")"
SDK=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/assets/www" "$OUT/classes"

cp -r ../index.html ../css ../js "$OUT/assets/www/"

aapt package -f -M AndroidManifest.xml -S res -A "$OUT/assets" -I "$SDK" -F "$OUT/unsigned.apk"
javac -nowarn -source 8 -target 8 -bootclasspath "$SDK" -classpath "$SDK" -d "$OUT/classes" $(find src -name '*.java') 2>&1 | grep -v -e '^warning' -e 'warnings$' || true
dalvik-exchange --dex --output="$OUT/classes.dex" "$OUT/classes"
(cd "$OUT" && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

# debug.keystore is a throwaway signing key kept in the repo so every build
# can install over the previous one. Use your own key for a store release.
apksigner sign --ks debug.keystore --ks-pass pass:android --key-pass pass:android \
  --out "$OUT/Ktav.apk" "$OUT/aligned.apk"
apksigner verify "$OUT/Ktav.apk"
echo "built $OUT/Ktav.apk"
