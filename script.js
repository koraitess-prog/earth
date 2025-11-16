// script.js - קוד מלא, סופי, ויציב עם תיקון חלקות זום בנייד

// הגדרות עיקריות
const MAX_ZOOM = 10;
const RUST_THRESHOLD = [3, 6, 9]; // ספי חלודה מותאמים
const RUST_HOLD_DELAY_MS = 2000; // 2 שניות המתנה על החלודה לפני הגליץ'
const GLITCH_DURATION_MS = 500; // משך הגליץ' הקצר עצמו

// אלמנטים
const imageContainer = document.getElementById('image-container');
const rustLayers = [
    document.getElementById('tree-rust1'),
    document.getElementById('tree-rust2'),
    document.getElementById('tree-rust-full')
];
const cleanLayer = document.getElementById('tree-clean');
const glitchOverlay = document.getElementById('glitch-overlay');

if (!imageContainer || rustLayers.includes(null) || !glitchOverlay || !cleanLayer) {
    console.error("שגיאה: חסר אלמנט אחד או יותר ב-HTML. בדוק ששמות ה-ID תואמים.");
}

// מצב גלובלי
let currentZoom = 1;
let isGlitching = false;
let rustHoldTimeoutId = null;
let glitchTimeoutId = null;
let initialDistance = 0;
let focusX = 50;
let focusY = 50;
let maxRustLevel = 0; // שומר את רמת החלודה הגבוהה ביותר שנחשפה


function updateImageTransform() {
    imageContainer.style.transformOrigin = `${focusX}% ${focusY}%`;
    imageContainer.style.transform = `scale(${currentZoom})`;
}

/**
 * @function updateRustLayers
 * חושף את שכבות החלודה בהתאם לרמת הזום, ומונע חזרה לאחור.
 */
function updateRustLayers() {
    if (rustHoldTimeoutId || isGlitching) return;

    let currentRustVisible = false;
    let currentMaxRustIndex = -1;

    // שלב 1: קביעת רמת החלודה העדכנית
    rustLayers.forEach((layer, index) => {
        if (currentZoom >= RUST_THRESHOLD[index]) {
            currentMaxRustIndex = index;
        }
    });

    // שלב 2: עדכון הרמה המקסימלית שהושגה
    maxRustLevel = Math.max(maxRustLevel, currentMaxRustIndex + 1);

    // שלב 3: הפעלת השקיפות לפי הרמה המקסימלית שהושגה
    if (currentZoom === 1) {
        // בזום 1 רגיל, הכל נקי (לפני לוגיקת הגליץ')
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
    } else {
        // בזום > 1: השאר את כל השכבות עד maxRustLevel גלויות
        for (let i = 0; i < rustLayers.length; i++) {
            if (i < maxRustLevel) {
                rustLayers[i].style.opacity = 1;
                currentRustVisible = true;
            } else {
                rustLayers[i].style.opacity = 0;
            }
        }
        
        // הסתר את הנקייה אם יש חלודה כלשהי גלויה
        cleanLayer.style.opacity = currentRustVisible ? 0 : 1;
    }
}

/**
 * מפעיל את אפקט הגליץ' ואז מאפס הכל.
 */
function activateGlitchAndReset() {
    if (isGlitching) return;
    isGlitching = true;
    glitchOverlay.classList.add('glitching');

    glitchTimeoutId = setTimeout(() => {
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        glitchTimeoutId = null;

        // איפוס מלא למצב נקי ומרכזי
        currentZoom = 1;
        focusX = 50;
        focusY = 50;
        maxRustLevel = 0; // איפוס רמת החלודה
        updateImageTransform();
        
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        
    }, GLITCH_DURATION_MS);
}

function setZoomFocus(clientX, clientY) {
    const rect = imageContainer.getBoundingClientRect();
    
    focusX = ((clientX - rect.left) / rect.width) * 100;
    focusY = ((clientY - rect.top) / rect.height) * 100;

    focusX = Math.max(0, Math.min(100, focusX));
    focusY = Math.max(0, Math.min(100, focusY));
}

/**
 * מבצע את לוגיקת הזום.
 */
function performZoom(delta) {
    // 1. ניקוי טיימאאוטים קיימים אם אנחנו מתחילים לזוז
    if (rustHoldTimeoutId) {
        clearTimeout(rustHoldTimeoutId);
        rustHoldTimeoutId = null;
    }
    // אם ביטלנו גליץ' באמצע, נאפס למצב נקי מיד
    if (glitchTimeoutId) {
        clearTimeout(glitchTimeoutId);
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        currentZoom = 1;
        updateImageTransform();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        maxRustLevel = 0; // איפוס רמת חלודה
    }
    if (isGlitching) return;

    let newZoom = currentZoom + delta;
    newZoom = Math.max(1, Math.min(MAX_ZOOM, newZoom));
    
    currentZoom = newZoom;
    updateImageTransform();
    updateRustLayers(); // יעדכן חלודה וישמור את המקסימום שהושג

    // ------------------------------------------
    // לוגיקת המתנה של 2 שניות על החלודה המלאה (בזום 1)
    // ------------------------------------------
    if (currentZoom === 1 && delta < 0) {
        // 1. ודא שהחלודה המלאה גלויה
        rustLayers.forEach(layer => layer.style.opacity = 0);
        rustLayers[2].style.opacity = 1;
        cleanLayer.style.opacity = 0;
        
        // 2. התחל טיימאאוט המתנה של 2 שניות
        if (!rustHoldTimeoutId) { // ודא שאין טיימאאוט קודם
             rustHoldTimeoutId = setTimeout(() => {
                 rustHoldTimeoutId = null;
                 activateGlitchAndReset();
             }, RUST_HOLD_DELAY_MS);
        }
    }
}

// ------------------------------------------
// מאזינים לעכבר (גלגול) ומגע (Pinch)
// ------------------------------------------

function handleWheel(event) {
    event.preventDefault();
    setZoomFocus(event.clientX, event.clientY);
    const delta = -event.deltaY * 0.005;
    performZoom(delta);
}

// פונקציות עזר למגע (Pinch Zoom)
function getDistance(t1, t2) {
    return Math.sqrt(
        Math.pow(t2.clientX - t1.clientX, 2) +
        Math.pow(t2.clientY - t1.clientY, 2)
    );
}
function getCenter(t1, t2) {
    return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
    };
}

function handleTouchStart(event) {
    // בטל תהליך המתנה/גליץ' אם המשתמש נוגע
    if (rustHoldTimeoutId || isGlitching) {
        if (rustHoldTimeoutId) clearTimeout(rustHoldTimeoutId);
        if (glitchTimeoutId) clearTimeout(glitchTimeoutId);
        rustHoldTimeoutId = null;
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        
        currentZoom = 1;
        updateImageTransform();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        maxRustLevel = 0; // איפוס רמת חלודה
        return;
    }

    if (event.touches.length === 2) {
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        const center = getCenter(event.touches[0], event.touches[1]);
        setZoomFocus(center.x, center.y);
    }
}

function handleTouchMove(event) {
    if (isGlitching) return;

    if (event.touches.length === 2 && initialDistance > 0) {
        event.preventDefault();
        
        const newDistance = getDistance(event.touches[0], event.touches[1]);
        const center = getCenter(event.touches[0], event.touches[1]);

        setZoomFocus(center.x, center.y);

        const scaleChange = newDistance / initialDistance;
        const delta = scaleChange - 1;

        // התיקון לחלקות: משתמשים במכפיל 1.0 (רגיל/מעט חלש)
        performZoom(delta * 1.0); 
        
        initialDistance = newDistance;
    }
}

function handleTouchEnd() {
    initialDistance = 0;
    // אם סיימנו מגע כשהזום על 1, הפעל את טיימאאוט ההמתנה
    if (currentZoom === 1 && !rustHoldTimeoutId && !isGlitching) {
         rustHoldTimeoutId = setTimeout(() => {
             rustHoldTimeoutId = null;
             activateGlitchAndReset();
         }, RUST_HOLD_DELAY_MS);
    }
}

window.addEventListener('wheel', handleWheel, { passive: false });
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);

// אתחול: התחלה במצב נקי
updateImageTransform();
cleanLayer.style.opacity = 1;
rustLayers.forEach(layer => layer.style.opacity = 0);