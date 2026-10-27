<div dir="rtl">

# כתב יד לפונט · Ktav

הופכים את כתב היד שלכם לפונט אמיתי ל-Windows, בעברית ובאנגלית.

## איך משתמשים

פותחים את `index.html` בדפדפן (Chrome / Edge / Firefox). אין צורך בהתקנה או באינטרנט, והכול נשאר במחשב שלכם.

יש שתי דרכים להכניס אותיות, ואפשר לשלב ביניהן:

1. **ציור או צילום של אות אחת.** בלשונית הראשונה לוחצים על אות ומציירים אותה בעכבר, באצבע או בעט. הקווים הכחולים מסמנים את קו הבסיס ואת גובה האות. אפשר גם ללחוץ "צילום אות" ולצלם אות שכתבתם על דף לבן.
2. **דף להדפסה.** בלשונית השנייה מדפיסים 3 דפים (עברית, אותיות גדולות וספרות, אותיות קטנות וסימנים), כותבים כל אות בריבוע שלה, ומצלמים כל דף. האפליקציה מוצאת לבד את ארבעת הריבועים השחורים בפינות, מיישרת את התמונה וחותכת את האותיות.

בלשונית השלישית בוחרים שם, עובי קו ומרווחים, רואים תצוגה מקדימה, ומורידים קובץ `.ttf`.

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
- Everything runs locally in the browser; nothing is uploaded.
- Letters are kept in the browser's storage. Use **Save project** to back them up or move to another computer.

### How it works

- `js/scan.js` finds the corner markers in the photo, maps the page with a homography and cuts out each box. The small square next to the top-left marker tells it which way up the page is.
- `js/trace.js` traces each bitmap with marching squares and simplifies it into TrueType quadratic curves.
- `js/ttf.js` writes the `.ttf` directly (glyf, cmap, OS/2 with the Latin and Hebrew code pages, and so on). No libraries.

`node tools/selftest.js out.ttf` builds a font from test shapes; check it with `python -m ots out.ttf` (`pip install opentype-sanitizer`).
