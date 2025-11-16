// script.js - קוד סופי משולב: מחשב = Pan / פלאפון = Pinch Zoom יציב + Drag Pan (רצף איפוס מתוקן)

// הגדרות עיקריות
const MAX_ZOOM = 10;
const RUST_THRESHOLD = [3, 6, 9]; 
const RUST_HOLD_DELAY_MS = 2000; 
const GLITCH_DURATION_MS = 500; 
const MIN_PAN_ZOOM = 1.05; // זום מינימלי לגרירה באצבע אחת

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

// --- משתנים לגרירת עכבר וקיזוז מגע ---
let isDragging = false; // מצב גרירת עכבר/אצבע אחת
let startX = 0; 
let startY = 0;
let currentTranslateX = 0; // משמש לגרירת עכבר וקיזוז מגע
let currentTranslateY = 0; 
let previousTranslateX = 0; // מיקום אחרון של גרירה/קיזוז
let previousTranslateY = 0;

// --- משתנים לזום דינמי (Pinch) ---
let initialDistance = 0;
let isPinching = false;
let initialFocusPointX = 0; // נקודת המרכז של הצביטה בפיקסלים יחסית למיכל
let initialFocusPointY = 0; 


function updateImageTransform() {
    // הפוקוס תמיד במרכז (50% 50%)
    imageContainer.style.transformOrigin = '50% 50%'; 
    imageContainer.style.transform = 
        `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${currentZoom})`;
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
        // מצב ברירת מחדל בזום 1 - נקי
        rustLayers.forEach(layer => layer.style.opacity = 0);
        cleanLayer.style.opacity = 1;
    } else {
        // חושף את השכבות עד לרמה המקסימלית שהושגה
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
    glitchOverlay.classList.add('glitching'); // 1. הגליץ' מתחיל

    glitchTimeoutId = setTimeout(() => {
        glitchOverlay.classList.remove('glitching');
        isGlitching = false;
        glitchTimeoutId = null;

        // 2. איפוס מלא (מתרחש רק לאחר שהגליץ' נגמר)
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
        currentTranslateX = 0; 
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

    // לוגיקת המתנה של 2 שניות על החלודה המלאה (במחשב/גלגלת)
    if (currentZoom === 1 && delta < 0) {
        // הצג חלודה מלאה כסימן לפני המתנה
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
// מאזינים לעכבר (גלגול סטטי וגרירה)
// ------------------------------------------

function handleWheel(event) {
    event.preventDefault();
    const delta = -event.deltaY * 0.005;
    
    // מונע קיזוז מגע מלהשפיע על גלגלת העכבר
    currentTranslateX = previousTranslateX;
    currentTranslateY = previousTranslateY;

    performZoom(delta);
}

function handleMouseDown(event) {
    if (isGlitching || event.button !== 0 || isPinching) return; 
    
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    
    previousTranslateX = currentTranslateX; 
    previousTranslateY = currentTranslateY;
    
    imageContainer.style.cursor = 'grabbing';
}

function handleMouseMove(event) {
    if (!isDragging || isGlitching || isPinching) return;

    const dx = event.clientX - startX;
    const dy = event.clientY - startY;

    if (currentZoom > 1) {
        currentTranslateX = previousTranslateX + dx;
        currentTranslateY = previousTranslateY + dy;
        updateImageTransform();
    }
}

function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    previousTranslateX = currentTranslateX; 
    previousTranslateY = currentTranslateY;
    imageContainer.style.cursor = 'grab';
}

// ------------------------------------------
// מאזינים למגע (Pinch Zoom ו-Drag Pan)
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

function getRelativePosition(clientX, clientY) {
    const rect = imageContainer.getBoundingClientRect();
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}


function handleTouchStart(event) {
    // מטפל באיפוס מיידי אם מתחילים מגע בזמן המתנה לגליץ'
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
        isDragging = false; 
        initialDistance = getDistance(event.touches[0], event.touches[1]);
        const center = getCenter(event.touches[0], event.touches[1]);
        const relativeCenter = getRelativePosition(center.x, center.y);

        initialFocusPointX = relativeCenter.x;
        initialFocusPointY = relativeCenter.y;

        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
    } else if (event.touches.length === 1 && currentZoom >= MIN_PAN_ZOOM) {
        // התחלת גרירה באצבע אחת
        isDragging = true;
        startX = event.touches[0].clientX;
        startY = event.touches[0].clientY;
        
        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
    }
}

function handleTouchMove(event) {
    if (isGlitching) return;
    event.preventDefault(); 

    if (isPinching && event.touches.length === 2) {
        // --- לוגיקת Pinch Zoom (שתי אצבעות) ---
        isDragging = false; 
        const newDistance = getDistance(event.touches[0], event.touches[1]);
        const scaleFactor = newDistance / initialDistance;

        const oldZoom = currentZoom;
        const newZoom = Math.max(1, Math.min(MAX_ZOOM, oldZoom * scaleFactor));
        
        if (newZoom === oldZoom) return;

        // חישוב קיזוז
        const containerRect = imageContainer.getBoundingClientRect();
        const halfWidth = containerRect.width / 2;
        const halfHeight = containerRect.height / 2;
        
        const focusOffsetX = initialFocusPointX - halfWidth;
        const focusOffsetY = initialFocusPointY - halfHeight;

        const compensateX = focusOffsetX * (newZoom - oldZoom);
        const compensateY = focusOffsetY * (newZoom - oldZoom);

        currentTranslateX = previousTranslateX - compensateX;
        currentTranslateY = previousTranslateY - compensateY;
        
        currentZoom = newZoom;
        updateImageTransform();
        updateRustLayers(); 

        // ** לוגיקת חלודה וגליץ' במגע (Pinch) - התיקון **
        if (currentZoom === 1) {
            // FIX: מעבר למצב חלודה מלאה כסימן, לא ניקוי מיידי!
            rustLayers.forEach(layer => layer.style.opacity = 0);
            rustLayers[2].style.opacity = 1; // מציג את החלודה המלאה
            cleanLayer.style.opacity = 0;

            if (!rustHoldTimeoutId) {
                 rustHoldTimeoutId = setTimeout(() => {
                     rustHoldTimeoutId = null;
                     activateGlitchAndReset();
                 }, RUST_HOLD_DELAY_MS);
            }
        } else {
            // אם הזום גדול מ-1, בטל את ההמתנה
            if (rustHoldTimeoutId) {
                clearTimeout(rustHoldTimeoutId);
                rustHoldTimeoutId = null;
            }
        }
        // ------------------------------------------

        previousTranslateX = currentTranslateX;
        previousTranslateY = currentTranslateY;
        initialDistance = newDistance;

    } else if (isDragging && event.touches.length === 1) {
        // --- לוגיקת גרירה (Drag Pan) באצבע אחת ---
        const dx = event.touches[0].clientX - startX;
        const dy = event.touches[0].clientY - startY;

        if (currentZoom >= MIN_PAN_ZOOM) {
            currentTranslateX = previousTranslateX + dx;
            currentTranslateY = previousTranslateY + dy;
            updateImageTransform();
        }
    }
}

function handleTouchEnd() {
    isPinching = false;
    // אם היינו בגרירה, היא תיפסק, אבל ה-previousTranslate נשמר ב-handleTouchMove

    initialFocusPointX = 0; 
    initialFocusPointY = 0;
    
    // שמור את המיקום הסופי
    previousTranslateX = currentTranslateX; 
    previousTranslateY = currentTranslateY;
    
    // ודא ש-isDragging מוגדר ל-false בסוף מגע
    isDragging = false; 

    // מטפל בהמתנת הגליץ' לאחר סיום מגע
    if (currentZoom === 1 && !rustHoldTimeoutId && !isGlitching) {
         // FIX: הצג חלודה מלאה לפני תחילת הטיימר
         rustLayers.forEach(layer => layer.style.opacity = 0);
         rustLayers[2].style.opacity = 1; 
         cleanLayer.style.opacity = 0;
         
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

// מאזיני עכבר לגרירה (Pan)
imageContainer.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mouseup', handleMouseUp); 

// מאזיני מגע
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd);


// אתחול: התחלה במצב נקי
updateImageTransform();
cleanLayer.style.opacity = 1;
rustLayers.forEach(layer => layer.style.opacity = 0);