// script.js - קוד סופי: זום מהמרכז + גרירה (Pan).

// הגדרות עיקריות
const MAX_ZOOM = 10;
const RUST_THRESHOLD = [3, 6, 9]; // ספי חלודה
const RUST_HOLD_DELAY_MS = 2000; // 2 שניות המתנה
const GLITCH_DURATION_MS = 500; // משך הגליץ'

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
let maxRustLevel = 0; 

// --- משתנים חדשים לגרירה (Pan) ---
let isDragging = false;
let startX = 0;
let startY = 0;
let currentTranslateX = 0;
let currentTranslateY = 0;
let previousTranslateX = 0;
let previousTranslateY = 0;
// ---------------------------------

// משתנים למגע/צביטה
let initialDistance = 0;
let isPinching = false;


function updateImageTransform() {
    // הפוקוס תמיד במרכז (50% 50%) בזמן הזום
    imageContainer.style.transformOrigin = '50% 50%'; 
    imageContainer.style.transform = 
        `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;

    // בלוודא שכל שכבות העץ ממוקמות באותה צורה
    document.querySelectorAll('.tree-layer').forEach(layer => {
        // המיקום הראשוני שלהם הוא translate(-50%, -50%)
        // כך שאין צורך לשנות להם את הטרנספורם כאן.
        // הם יזוזו עם ה-imageContainer
    });
}

function updateRustLayers() {
    if (rustHoldTimeoutId || isGlitching) return;

    let currentRustVisible = false;
    let currentMaxRustIndex = -1;

    rustLayers.forEach((layer, index) => {
        if (currentZoom >= RUST_THRESHOLD[index]) {
            currentMaxRustIndex = index;
        }
    });

    maxRustLevel = Math.max(maxRustLevel, currentMaxRustIndex + 1);

    if (currentZoom === 1) {
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
    } else {
        for (let i = 0; i < rustLayers.length; i++) {
            if (i < maxRustLevel) {
                rustLayers[i].style.opacity = 1;
                currentRustVisible = true;
            } else {
                rustLayers[i].style.opacity = 0;
            }
        }
        cleanLayer.style.opacity = currentRustVisible ? 0 : 1;
    }
}

function activateGlitchAndReset() {
    if (isGlitching) return;
    isGlitching = true;
    glitchOverlay.classList.add('glitching');

    glitchTimeoutId = setTimeout(() => {
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        glitchTimeoutId = null;

        // איפוס מלא
        currentZoom = 1;
        currentTranslateX = 0;
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
        maxRustLevel = 0; 
        updateImageTransform();
        
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        
    }, GLITCH_DURATION_MS);
}

// פונקציית setZoomFocus כבר לא נחוצה כי הפוקוס תמיד 50% 50%
/*
function setZoomFocus(clientX, clientY) {
    // ...
}
*/

function performZoom(delta) {
    if (rustHoldTimeoutId) {
        clearTimeout(rustHoldTimeoutId);
        rustHoldTimeoutId = null;
    }
    if (glitchTimeoutId) {
        clearTimeout(glitchTimeoutId);
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        currentZoom = 1;
        currentTranslateX = 0; // איפוס תרגום בעת ביטול גליץ'
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
        updateImageTransform();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        maxRustLevel = 0; 
    }
    if (isGlitching) return;

    let newZoom = currentZoom + delta;
    newZoom = Math.max(1, Math.min(MAX_ZOOM, newZoom));
    
    // אם הזום חוזר ל-1, נאפס את מיקום התרגום
    if (newZoom === 1) {
        currentTranslateX = 0;
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
    }

    currentZoom = newZoom;
    updateImageTransform();
    updateRustLayers();

    if (currentZoom === 1 && delta < 0) {
        rustLayers.forEach(layer => layer.style.opacity = 0);
        rustLayers[2].style.opacity = 1;
        cleanLayer.style.opacity = 0;
        
        if (!rustHoldTimeoutId) {
             rustHoldTimeoutId = setTimeout(() => {
                 rustHoldTimeoutId = null;
                 activateGlitchAndReset();
             }, RUST_HOLD_DELAY_MS);
        }
    }
}

// ------------------------------------------
// מאזינים לעכבר (גלגול וגרירה)
// ------------------------------------------

function handleWheel(event) {
    event.preventDefault();
    const delta = -event.deltaY * 0.005;
    performZoom(delta);
}

function handleMouseDown(event) {
    if (isGlitching || event.button !== 0 || isPinching) return; // רק כפתור שמאלי, ולא בזמן צביטה
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    imageContainer.style.cursor = 'grabbing';
}

function handleMouseMove(event) {
    if (!isDragging || isGlitching || isPinching) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    currentTranslateX = previousTranslateX + dx;
    currentTranslateY = previousTranslateY + dy;

    updateImageTransform();
}

function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    previousTranslateX = currentTranslateX;
    previousTranslateY = currentTranslateY;
    imageContainer.style.cursor = 'grab';
}

// ------------------------------------------
// מאזינים למגע (Pinch Zoom וגרירה)
// ------------------------------------------

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
    // ... (איפוס גליץ' והמתנה) ...
    if (rustHoldTimeoutId || isGlitching) {
        if (rustHoldTimeoutId) clearTimeout(rustHoldTimeoutId);
        if (glitchTimeoutId) clearTimeout(glitchTimeoutId);
        rustHoldTimeoutId = null;
        glitchTimeoutId = null;
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        
        currentZoom = 1;
        currentTranslateX = 0;
        currentTranslateY = 0;
        previousTranslateX = 0;
        previousTranslateY = 0;
        updateImageTransform();
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
        maxRustLevel = 0; 
        return;
    }

    if (event.touches.length === 2) {
        isPinching = true;
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        // כאשר מתחילים צביטה, "עוצרים" את הגרירה ומאפסים נקודת התחלה
        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
    } else if (event.touches.length === 1 && !isPinching) {
        // גרירה באצבע אחת
        isDragging = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
    }
}

function handleTouchMove(event) {
    if (isGlitching) return;
    event.preventDefault(); // מונע גלילה של הדף

    if (isPinching && event.touches.length === 2) {
        const newDistance = getDistance(event.touches[0], event.touches[1]);
        const scaleChange = newDistance / initialDistance;
        const delta = scaleChange - 1;

        // זום מהמרכז
        performZoom(delta * 1.0); 
        
        initialDistance = newDistance;

    } else if (isDragging && event.touches.length === 1 && !isPinching) {
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;

        currentTranslateX = previousTranslateX + dx;
        currentTranslateY = previousTranslateY + dy;
        
        updateImageTransform();
    }
}

function handleTouchEnd() {
    isPinching = false;
    isDragging = false;
    previousTranslateX = currentTranslateX; // שמור את המיקום הסופי של הגרירה
    previousTranslateY = currentTranslateY;

    if (currentZoom === 1 && !rustHoldTimeoutId && !isGlitching) {
         rustHoldTimeoutId = setTimeout(() => {
             rustHoldTimeoutId = null;
             activateGlitchAndReset();
         }, RUST_HOLD_DELAY_MS);
    }
}

// ------------------------------------------
// חיבור מאזיני אירועים
// ------------------------------------------

window.addEventListener('wheel', handleWheel, { passive: false });

// מאזיני עכבר לגרירה
imageContainer.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp); // על ה-window כדי לתפוס גם כשהעכבר יוצא

// מאזיני מגע
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);


// אתחול: התחלה במצב נקי
updateImageTransform();
cleanLayer.style.opacity = 1;
rustLayers.forEach(layer => layer.style.opacity = 0);