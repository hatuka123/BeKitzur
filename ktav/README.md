<div dir="rtl">

# כתב יד לפונט · Ktav

הופכים את כתב היד שלכם לפונט אמיתי ל-Windows, בעברית ובאנגלית.

## איך משתמשים

פותחים את `index.html` בדפדפן (Chrome / Edge / Firefox). אין צורך בהתקנה או באינטרנט, והכול נשאר במחשב שלכם.

יש שתי דרכים להכניס אותיות, ואפשר לשלב ביניהן:

1. **ציור או צילום של אות אחת.** בלשונית הראשונה לוחצים על אות ומציירים אותה בעכבר, באצבע או בעט. הקווים הכחולים מסמנים את קו הבסיס ואת גובה האות. אפשר גם ללחוץ "צילום אות" ולצלם אות שכתבתם על דף לבן.
2. **דף להדפסה.** בלשונית השנייה מדפיסים 3 דפים (עברית, אותיות גדולות וספרות, אותיות קטנות וסימנים), כותבים כל אות בריבוע שלה, ומצלמים כל דף. האפליקציה מוצאת לבד את ארבעת הריבועים השחורים בפינות, מיישרת את התמונה וחותכת את האותיות.

3. **פונט מכל כתב יד.** מצלמים או בוחרים תמונה של כתב יד שכבר קיים: מכתב, פתק, מחברת, קיר או צילום מסך מהאינטרנט. מסמנים את האזור עם הכתב, ואפשר לסובב את התמונה. כתב בהיר על רקע כהה (גיר על לוח) מזוהה לבד. האפליקציה מוצאת את השורות ואת האותיות, ומסירה קווים של מחברת. היא קוראת מה כתוב, אתם מתקנים, והיא מתאימה כל אות לתו שלה. אותיות שנראות לא ברורות מסומנות בכתום ומדולגות. אות שמופיעה כמה פעמים נשמרת ככמה גרסאות.
   - **קריאה עם Claude (רשות):** עם מפתח API של Anthropic, תמונות השורות נשלחות ל-Claude, שקורא כתב יד בעברית ובאנגלית הרבה יותר טוב. בלי מפתח, האפליקציה מנחשת לבד. הניחוש משתפר ככל שיש יותר אותיות שלכם.
   - **השלמת אותיות חסרות:** אותיות שלא הופיעו בכתב מושלמות בהערכה לפי הסגנון שלו: עובי הקו, הנטייה והפרופורציות. הן מופיעות בלוח האותיות במסגרת מקווקוות, ואפשר להחליף כל אחת באות אמיתית בכל רגע.

**גרסאות של אותה אות:** בחלון העריכה של כל אות רואים את כל הגרסאות שלה. אפשר למחוק גרסה, להוסיף גרסה חדשה, או לקבוע איזו גרסה היא הראשית (★). הפונט בוחר בין הגרסאות בצורה שנראית אקראית, לפי האות שלפני, כך שאותה אות לא נראית זהה בכל פעם, גם כשהיא חוזרת כמה פעמים ברצף. ב-Word צריך להפעיל את זה: גופן ← מתקדם ← "חלופות הקשריות" (Contextual Alternates).

**כתיבה:** בלשונית "כתיבה" כותבים עם הפונט שיצרתם, ושומרים או משתפים את הטקסט כתמונה.

בלשונית "יצירת הפונט" בוחרים שם, עובי קו ומרווחים, רואים תצוגה מקדימה, ומורידים קובץ `.ttf`.

## התקנה ב-Windows

פותחים את קובץ ה-`.ttf` ולוחצים **Install**. הפונט יופיע ב-Word ובכל תוכנה אחרת.

## אפליקציה לאנדרואיד (APK)

`android/build.sh` בונה את `android/build/Ktav.apk`, שהיא אותה אפליקציה בתוך WebView. אפשר לשלוח את הקובץ בטלגרם ולהתקין בטלפון (צריך לאשר "התקנה ממקורות לא ידועים"). בטלפון:

- "צילום אות" פותח ישר את המצלמה. בהעלאת דף אפשר לבחור מצלמה או גלריה.
- "הורדת קובץ פונט" שומרת את הקובץ בתיקייה `Download/Ktav` ופותחת חלון שיתוף, כך שאפשר לשלוח את הפונט לעצמך בטלגרם ולהתקין אותו במחשב.
- "הדפסת הדפים" פותחת את מסך ההדפסה של אנדרואיד, ושם אפשר גם לשמור כ-PDF.

</div>

## English

Turn your handwriting into a real Windows font (Hebrew + English). Open `index.html` in a browser, draw or photograph each letter, or print the 3-page sheet, write on it, and upload photos of it. Then download a `.ttf` and double-click it to install.

- 106 characters: Hebrew letters and final forms, A–Z, a–z, 0–9, punctuation and ₪.
- **A font from any handwriting:** a photo or screenshot of existing writing (a letter, a note, a wall). Crop and rotate it; light-on-dark writing is detected. The app finds lines and letters (ruled lines are removed), reads the text, and aligns it to the letters. You confirm or fix each line and letter, and letters that look unlike their character are skipped. Letters that appear more than once become variants.
- **Reading with Claude (optional):** with your own Anthropic API key, the line images are sent to Claude (`claude-opus-5-5`) for transcription. Without a key the app guesses on its own, by comparing with printed letters and your saved ones.
- **Missing letters filled in:** letters that never appear are estimated in the writer's style (stroke width, slant, proportions) from a printed letter, so the font is always complete. They show with a dashed border and can be replaced at any time.
- **Variants:** each letter can have several versions. The font picks between them in a way that looks random (by the glyph before), with an OpenType `calt` feature (in Word: Font → Advanced → Contextual Alternates).
- **Write tab:** type with your font and save or share the result as a picture.
- Everything runs locally in the browser; nothing is uploaded.
- Letters are kept in the browser's storage. Use **Save project** to back them up or move to another computer.

### How it works

- `js/scan.js` finds the corner markers in the photo, maps the page with a homography and cuts out each box. The small square next to the top-left marker tells it which way up the page is.
- `js/hand.js` cuts free handwriting into lines and letters (local-background threshold, connected components), guesses letters with a nearest-template match, and aligns the confirmed text to the letters, splitting or merging them where the counts differ.
- `js/synth.js` estimates missing letters: measures stroke width, slant and proportions, thins a printed letter to its centre line (Zhang-Suen) and redraws it with a round pen.
- `js/ai.js` sends line images to the Claude Messages API with the user's key.
- `js/trace.js` traces each bitmap with marching squares and simplifies it into TrueType quadratic curves.
- `js/ttf.js` writes the `.ttf` directly (glyf, cmap, OS/2 with the Latin and Hebrew code pages, GSUB for the variants, and so on). No libraries.

`node tools/selftest.js out.ttf` builds a font from test shapes; check it with `python -m ots out.ttf` (`pip install opentype-sanitizer`).
