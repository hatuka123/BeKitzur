// Hebrew / English interface strings. Hebrew text lives in index.html.
(function (KF) {
  'use strict';

  var EN = {
    title: 'Handwriting to Font',
    tabDraw: 'Draw letters',
    tabHand: 'Photo of handwriting',
    tabScan: 'Printable sheet',
    tabFont: 'Make the font',
    tabWrite: 'Write',
    handTitle: 'Photograph something you wrote',
    handHint: 'Write a few lines on plain white paper in dark pen, with space between the lines, and photograph it straight from above. The app finds the lines and letters and guesses what is written. You check and fix the text of each line and choose which letters go into the font. A letter that appears several times is saved as several variants.',
    handPick: 'Take / choose a photo',
    handCheck: 'For each line, make sure the text box says exactly what is written (spaces and punctuation too), then check that each letter has the right character under it. Tap a letter to skip it (an ugly or cut-off one). You can also change the character in the small box.',
    handAdd: 'Add to font',
    fVariants: 'Alternate between the variants of each letter (looks more natural)',
    varAdd: '+ Variant', varMain: '★ Main', varDel: 'Delete variant',
    wSize: 'Size', wColor: 'Colour', wLines: 'Lined paper', wImage: 'Save / share as picture',
    drawHint: 'Click a letter to draw it (mouse, finger or pen), or photograph a letter you wrote on paper.',
    sheetTitle: 'A. Print and write',
    sheetHint: 'Print the pages and write each letter inside its box in dark pen, on the lower blue line. Photograph each page straight from above with all four black corner squares in view.',
    sheetPrint: 'Print the pages',
    sheetPng: 'Download as images',
    scanTitle: 'B. Upload a photo of a page',
    scanPick: 'Take / choose a photo',
    scanPage: 'Which page:',
    scanCorners: 'Check that the four orange dots sit on the centres of the black squares. You can drag them.',
    scanCut: 'Cut out the letters',
    scanSave: 'Save the letters',
    fName: 'Font name (English letters)',
    fWeight: 'Stroke weight',
    fSpacing: 'Letter spacing',
    fWord: 'Word spacing',
    fCase: 'Fill a missing letter (A/a) from the other case',
    fPreview: 'Preview',
    fDownload: 'Download font file (.ttf)',
    installTitle: 'Installing on Windows',
    install1: 'Open the downloaded .ttf file.',
    install2: 'Click "Install" (or right-click → "Install for all users").',
    install3: 'The font appears in Word and every other program under the name you chose. Restart programs that were already open.',
    backupTitle: 'Backup',
    backupHint: 'Letters are saved in this browser only. To continue on another computer, save a project file.',
    projSave: 'Save project',
    projLoad: 'Load project',
    projClear: 'Delete all letters',
    done: 'Done', pen: 'Pen', eraser: 'Eraser', size: 'Size', undo: 'Undo', clear: 'Clear',
    photo: 'Photo of letter', ghost: 'Guide letter',
    // dynamic
    g_hebrew: 'Hebrew', g_upper: 'Uppercase', g_lower: 'Lowercase', g_digits: 'Digits', g_punct: 'Punctuation',
    page: 'Page', of: 'of', progress: '{n} of {t} letters ready',
    previewText: 'שלום! זה הכתב שלי.\nHello, this is my handwriting. 0123456789',
    building: 'Building…', built: '{n} letters and {a} extra variants in the font.',
    handWorking: 'Reading the photo…', handNone: 'No handwriting found. Try a sharper photo on white paper.',
    handFound: '{n} lines found. The text is a guess: check and fix it.',
    handMismatch: 'The number of letters found does not match the text. Fix the text, or the characters under the letters.',
    handAdded: 'Added {n} variants to {c} letters. You can review and delete them in "Draw letters".',
    writeSample: 'Hello! This is written in my own handwriting.', noGlyphs: 'Draw at least one letter first.',
    cutNone: 'No letters found. Check the corners and the page number.',
    cutFound: '{n} letters found. Empty boxes are skipped.',
    saved: 'Saved {n} letters.', detectFail: 'Could not find the corner squares. Drag the dots onto them.',
    confirmClear: 'Delete all letters?', confirmOverwrite: 'Replace {n} letters you already have?',
    loadFail: 'This is not a project file.', storageFull: 'Browser storage is full. Save a project file as a backup.',
  };

  var HE = {
    g_hebrew: 'עברית', g_upper: 'אותיות גדולות', g_lower: 'אותיות קטנות', g_digits: 'ספרות', g_punct: 'סימנים',
    page: 'דף', of: 'מתוך', progress: '{n} מתוך {t} אותיות מוכנות',
    previewText: 'שלום! זה הכתב שלי.\nHello, this is my handwriting. 0123456789',
    building: 'בונה…', built: 'בפונט יש {n} אותיות ועוד {a} גרסאות.',
    handWorking: 'קורא את התמונה…', handNone: 'לא מצאתי כתב יד בתמונה. נסו צילום חד יותר על דף לבן.',
    handFound: 'נמצאו {n} שורות. הטקסט הוא ניחוש, בדקו ותקנו אותו.',
    handMismatch: 'מספר האותיות שנמצאו לא תואם לטקסט. תקנו את הטקסט, או את התווים שמתחת לאותיות.',
    handAdded: 'נוספו {n} גרסאות ל-{c} אותיות. אפשר לעבור עליהן ולמחוק בלשונית "ציור אותיות".',
    writeSample: 'שלום! זה כתוב בכתב היד שלי.', noGlyphs: 'קודם ציירו לפחות אות אחת.',
    cutNone: 'לא נמצאו אותיות. בדקו את הפינות ואת מספר הדף.',
    cutFound: 'נמצאו {n} אותיות. ריבועים ריקים מדולגים.',
    saved: 'נשמרו {n} אותיות.', detectFail: 'לא מצאתי את הריבועים בפינות. גררו את הנקודות אליהם.',
    confirmClear: 'למחוק את כל האותיות?', confirmOverwrite: 'להחליף {n} אותיות שכבר קיימות?',
    loadFail: 'זה לא קובץ פרויקט.', storageFull: 'האחסון בדפדפן מלא. שמרו קובץ פרויקט לגיבוי.',
  };

  var lang = 'he', original = {};

  function t(key, vars) {
    var s = (lang === 'en' ? EN[key] : (HE[key] || original[key])) || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var k = el.getAttribute('data-i18n');
      if (!(k in original)) original[k] = el.textContent;
      el.textContent = t(k);
    });
  }

  function set(l) { lang = l === 'en' ? 'en' : 'he'; apply(); }

  KF.i18n = { t: t, set: set, get lang() { return lang; } };
})(globalThis.KF = globalThis.KF || {});
