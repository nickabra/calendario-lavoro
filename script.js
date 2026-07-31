const maxCounts = {
    ferie: 10,
    missione: 15,
    smartworking: 45,
    permesso: 14,
    exfest: 1
};

const currentCounts = {
    ferie: 10,
    missione: 15,
    smartworking: 45,
    permesso: 14,
    exfest: 1
};

// Data state: "YYYY-MM-DD" -> "ferie" | "missione" | "smartworking" | "permesso" | "exfest"
const assignments = {};
// Overlays state: "YYYY-MM-DD" -> "ct-mi" | "mi-ct"
const overlays = {};
// Permesso hours state: "YYYY-MM-DD" -> number (e.g. 2.5)
const permessoHours = {};
// Locked dates state: "YYYY-MM-DD" -> boolean
const lockedDates = {};
let isCalendarLocked = false;
// Working days across the calendar
const workingDays = [];

let pendingPermessoDate = null;
let pendingPermessoDayEl = null;
let selectedModalHours = 2;

let currentMarker = null;

const holidays = [
    "2026-08-15",
    "2026-11-01",
    "2026-12-08",
    "2026-12-25",
    "2026-12-26"
];

const monthsInfo = [
    { name: "Agosto 2026", num: 7, days: 31 }, // 0-indexed month
    { name: "Settembre 2026", num: 8, days: 30 },
    { name: "Ottobre 2026", num: 9, days: 31 },
    { name: "Novembre 2026", num: 10, days: 30 },
    { name: "Dicembre 2026", num: 11, days: 31 }
];

const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    initWorkingDays();
    loadState();
    initUI();
    generateCalendar();
    updateCountsUI();
    updateContainerClass(); // Set container class on page load
});

function initWorkingDays() {
    workingDays.length = 0;
    monthsInfo.forEach(month => {
        for (let i = 1; i <= month.days; i++) {
            const monthStr = (month.num + 1).toString().padStart(2, '0');
            const dayStr = i.toString().padStart(2, '0');
            const dateStr = `2026-${monthStr}-${dayStr}`;
            
            const currDate = new Date(2026, month.num, i);
            const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;
            const isHoliday = holidays.includes(dateStr);
            
            if (!isWeekend && !isHoliday) {
                workingDays.push(dateStr);
            }
        }
    });
}

function saveState() {
    localStorage.setItem('calendar_assignments', JSON.stringify(assignments));
    localStorage.setItem('calendar_overlays', JSON.stringify(overlays));
    localStorage.setItem('calendar_max_counts', JSON.stringify(maxCounts));
    localStorage.setItem('calendar_permesso_hours', JSON.stringify(permessoHours));
    localStorage.setItem('calendar_locked_dates', JSON.stringify(lockedDates));
    localStorage.removeItem('calendar_global_locked');
}

function loadState() {
    // Load custom max counts first
    const savedMax = localStorage.getItem('calendar_max_counts');
    if (savedMax) {
        try {
            const parsed = JSON.parse(savedMax);
            Object.assign(maxCounts, parsed);
        } catch (e) {
            console.error("Errore nel caricamento di calendar_max_counts", e);
        }
    }

    const saved = localStorage.getItem('calendar_assignments');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            Object.assign(assignments, parsed);
        } catch (e) {
            console.error("Errore nel caricamento di calendar_assignments", e);
        }
    }

    const savedOverlays = localStorage.getItem('calendar_overlays');
    if (savedOverlays) {
        try {
            const parsed = JSON.parse(savedOverlays);
            Object.assign(overlays, parsed);
        } catch (e) {
            console.error("Errore nel caricamento di calendar_overlays", e);
        }
    }

    const savedPermessoHours = localStorage.getItem('calendar_permesso_hours');
    if (savedPermessoHours) {
        try {
            const parsed = JSON.parse(savedPermessoHours);
            Object.assign(permessoHours, parsed);
        } catch (e) {
            console.error("Errore nel caricamento di calendar_permesso_hours", e);
        }
    }

    const savedLockedDates = localStorage.getItem('calendar_locked_dates');
    if (savedLockedDates) {
        try {
            const parsed = JSON.parse(savedLockedDates);
            Object.assign(lockedDates, parsed);
        } catch (e) {
            console.error("Errore nel caricamento di calendar_locked_dates", e);
        }
    }
    localStorage.removeItem('calendar_global_locked');
    
    // Recalculate remaining counts dynamically
    for (const key in maxCounts) {
        currentCounts[key] = maxCounts[key];
    }
    
    let usedPermessoHours = 0;
    for (const date in assignments) {
        const type = assignments[date];
        if (type === 'permesso') {
            usedPermessoHours += (permessoHours[date] || 0);
        } else if (currentCounts.hasOwnProperty(type)) {
            currentCounts[type]--;
        }
    }
    currentCounts.permesso = maxCounts.permesso - usedPermessoHours;
}

function initUI() {
    const calendarContainer = document.getElementById('calendar-container');
    if (calendarContainer) {
        calendarContainer.classList.add('grid-view');
    }

    document.querySelectorAll('.marker-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.marker-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            currentMarker = card.getAttribute('data-type');
            updateContainerClass();
        });
    });

    // PDF Export Action
    const btnExport = document.getElementById('btn-export-pdf');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            window.print();
        });
    }

    // Editable Permesso Total Logic
    const totalPermessoEl = document.getElementById('total-permesso');
    const editTrigger = document.getElementById('edit-permesso-trigger');
    
    function startEditing() {
        if (totalPermessoEl.querySelector('input')) return; // Already editing
        
        const currentTotal = maxCounts.permesso;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = currentTotal;
        input.className = 'edit-total-input';
        
        totalPermessoEl.innerHTML = '';
        totalPermessoEl.appendChild(input);
        input.focus();
        
        function finishEditing() {
            let newVal = parseInt(input.value);
            if (isNaN(newVal) || newVal < 0) {
                newVal = currentTotal; // Revert on invalid
            }
            maxCounts.permesso = newVal;
            
            // Recalculate remaining permesso
            let usedHours = 0;
            for (const date in assignments) {
                if (assignments[date] === 'permesso') {
                    usedHours += (permessoHours[date] || 0);
                }
            }
            currentCounts.permesso = maxCounts.permesso - usedHours;
            
            updateCountsUI();
            saveState();
        }
        
        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentTotal; // Revert
                input.blur();
            }
        });
    }
    
    if (totalPermessoEl) totalPermessoEl.addEventListener('click', startEditing);
    if (editTrigger) editTrigger.addEventListener('click', startEditing);

    // Permesso Modal Event Listeners
    initPermessoModalUI();

    // Editable Ex Festività Total Logic
    const totalExfestEl = document.getElementById('total-exfest');
    const editExfestTrigger = document.getElementById('edit-exfest-trigger');
    
    function startEditingExfest() {
        if (totalExfestEl.querySelector('input')) return;
        
        const currentTotal = maxCounts.exfest;
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.value = currentTotal;
        input.className = 'edit-total-input';
        
        totalExfestEl.innerHTML = '';
        totalExfestEl.appendChild(input);
        input.focus();
        
        function finishEditingExfest() {
            let newVal = parseInt(input.value);
            if (isNaN(newVal) || newVal < 0) {
                newVal = currentTotal;
            }
            maxCounts.exfest = newVal;
            
            // Recalculate remaining exfest
            let assignedCount = 0;
            for (const date in assignments) {
                if (assignments[date] === 'exfest') {
                    assignedCount++;
                }
            }
            currentCounts.exfest = maxCounts.exfest - assignedCount;
            
            updateCountsUI();
            saveState();
        }
        
        input.addEventListener('blur', finishEditingExfest);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                input.blur();
            } else if (e.key === 'Escape') {
                input.value = currentTotal;
                input.blur();
            }
        });
    }
    
    if (totalExfestEl) totalExfestEl.addEventListener('click', startEditingExfest);
    if (editExfestTrigger) editExfestTrigger.addEventListener('click', startEditingExfest);
}

function updateContainerClass() {
    const container = document.querySelector('.app-container');
    if (!container) return;
    
    container.classList.remove('base-marker-active', 'overlay-marker-active', 'eraser-active', 'lock-active', 'no-marker-active');
    
    if (!currentMarker) {
        container.classList.add('no-marker-active');
    } else if (currentMarker === 'eraser') {
        container.classList.add('eraser-active');
    } else if (currentMarker === 'lock') {
        container.classList.add('lock-active');
    } else if (currentMarker === 'ct-mi' || currentMarker === 'mi-ct') {
        container.classList.add('overlay-marker-active');
    } else {
        container.classList.add('base-marker-active');
    }
}

function generateCalendar() {
    const container = document.getElementById('calendar-container');
    
    monthsInfo.forEach(month => {
        const monthEl = document.createElement('div');
        monthEl.className = 'month';
        
        const title = document.createElement('h2');
        title.className = 'month-title';
        title.innerText = month.name;
        monthEl.appendChild(title);
        
        const grid = document.createElement('div');
        grid.className = 'days-grid';
        
        // Headers
        dayNames.forEach(day => {
            const el = document.createElement('div');
            el.className = 'day-header';
            el.innerText = day;
            grid.appendChild(el);
        });
        
        // Find start day of week for the month (1st of month)
        const firstDay = new Date(2026, month.num, 1);
        let startDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon...
        // Adjust for Mon-Sun week (0=Mon, 6=Sun)
        startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        
        // Empty cells for alignment
        for (let i = 0; i < startDayOfWeek; i++) {
            const empty = document.createElement('div');
            empty.className = 'day empty';
            grid.appendChild(empty);
        }
        
        // Days
        for (let i = 1; i <= month.days; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'day';
            
            const dayNumSpan = document.createElement('span');
            dayNumSpan.className = 'day-num';
            dayNumSpan.innerText = i;
            dayEl.appendChild(dayNumSpan);
            
            const monthStr = (month.num + 1).toString().padStart(2, '0');
            const dayStr = i.toString().padStart(2, '0');
            const dateStr = `2026-${monthStr}-${dayStr}`;
            
            dayEl.setAttribute('data-date', dateStr);
            
            // Check weekend
            const currDate = new Date(2026, month.num, i);
            const isWeekend = currDate.getDay() === 0 || currDate.getDay() === 6;
            if (isWeekend) {
                dayEl.classList.add('weekend', 'blocked');
            }
            
            // Check holiday
            const isHoliday = holidays.includes(dateStr);
            if (isHoliday) {
                dayEl.classList.add('holiday', 'blocked');
            }
            
            // Click listener for all days
            dayEl.addEventListener('click', () => handleDayClick(dayEl, dateStr, isWeekend, isHoliday));
            
            updateDayUI(dayEl, assignments[dateStr], overlays[dateStr], dateStr);
            
            grid.appendChild(dayEl);
        }
        
        monthEl.appendChild(grid);
        container.appendChild(monthEl);
    });
}

function formatDateItalian(dateStr) {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(d)}/${parseInt(m)}/${y}`;
}

function isDateLocked(dateStr) {
    if (!dateStr) return false;
    return !!lockedDates[dateStr];
}

function refreshAllDaysUI() {
    document.querySelectorAll('.day[data-date]').forEach(dayEl => {
        const dateStr = dayEl.getAttribute('data-date');
        updateDayUI(dayEl, assignments[dateStr], overlays[dateStr], dateStr);
    });
}

function handleDayClick(dayEl, dateStr, isWeekend, isHoliday) {
    if (!currentMarker) {
        showToast("Seleziona prima uno strumento dal menù superiore!");
        return;
    }
    
    // 0. Handle Lock / Unlock tool
    if (currentMarker === 'lock') {
        lockedDates[dateStr] = !lockedDates[dateStr];
        if (!lockedDates[dateStr]) {
            delete lockedDates[dateStr];
            showToast(`Data ${formatDateItalian(dateStr)} sbloccata 🔓`);
        } else {
            showToast(`Data ${formatDateItalian(dateStr)} bloccata/sicura 🔒`);
        }
        updateDayUI(dayEl, assignments[dateStr], overlays[dateStr], dateStr);
        saveState();
        return;
    }

    // 0b. Enforce Lock Protection for all other markers
    if (isDateLocked(dateStr)) {
        showToast(`La data ${formatDateItalian(dateStr)} è bloccata 🔒! Sbloccala prima di modificarla.`);
        return;
    }
    
    const isOverlayMarker = currentMarker === 'ct-mi' || currentMarker === 'mi-ct';
    const isBaseMarker = currentMarker === 'ferie' || currentMarker === 'missione' || currentMarker === 'smartworking' || currentMarker === 'permesso' || currentMarker === 'exfest';
    
    // 1. Validation for weekends and holidays
    if (isBaseMarker && (isWeekend || isHoliday)) {
        showToast("I weekend e i festivi sono bloccati per questo segnagiorno!");
        return;
    }
    
    // 2. Handle Eraser
    if (currentMarker === 'eraser') {
        const existingAssignment = assignments[dateStr];
        const existingOverlay = overlays[dateStr];
        
        if (existingAssignment || existingOverlay) {
            // Eraser deletes base assignment first, then overlay
            if (existingAssignment) {
                if (existingAssignment === 'permesso') {
                    currentCounts.permesso += (permessoHours[dateStr] || 0);
                    delete permessoHours[dateStr];
                } else {
                    currentCounts[existingAssignment]++;
                }
                delete assignments[dateStr];
                updateDayUI(dayEl, null, existingOverlay, dateStr);
            } else if (existingOverlay) {
                delete overlays[dateStr];
                updateDayUI(dayEl, existingAssignment, null, dateStr);
            }
            updateCountsUI();
            saveState();
        }
        return;
    }
    
    // 3. Handle Overlay Assignment
    if (isOverlayMarker) {
        const existingOverlay = overlays[dateStr];
        
        // Toggle or change overlay
        if (existingOverlay === currentMarker) {
            // Click again to remove it
            delete overlays[dateStr];
            updateDayUI(dayEl, assignments[dateStr], null, dateStr);
        } else {
            overlays[dateStr] = currentMarker;
            updateDayUI(dayEl, assignments[dateStr], currentMarker, dateStr);
        }
        saveState();
        return;
    }
    
    // 4. Handle Base Assignment
    if (isBaseMarker) {
        if (currentMarker === 'permesso') {
            openPermessoModal(dayEl, dateStr);
            return;
        }

        const existingAssignment = assignments[dateStr];
        if (existingAssignment === currentMarker) return;
        
        // Check global counters
        if (currentCounts[currentMarker] <= 0 && (!existingAssignment || currentMarker !== existingAssignment)) {
            showToast(`Hai esaurito i giorni disponibili per: ${currentMarker.toUpperCase()}`);
            return;
        }
        
        // Validation controls
        if (!validateConstraints(dateStr, currentMarker, existingAssignment)) {
            return;
        }
        
        // Apply change
        if (existingAssignment) {
            if (existingAssignment === 'permesso') {
                currentCounts.permesso += (permessoHours[dateStr] || 0);
                delete permessoHours[dateStr];
            } else {
                currentCounts[existingAssignment]++;
            }
        }
        
        currentCounts[currentMarker]--;
        assignments[dateStr] = currentMarker;
        
        updateDayUI(dayEl, currentMarker, overlays[dateStr], dateStr);
        updateCountsUI();
        saveState();
    }
}

function validateConstraints(dateStr, marker, existingAssignment) {
    const [year, month, day] = dateStr.split('-');
    
    // Create a temporary assignments object to test constraints
    const tempAssignments = { ...assignments };
    tempAssignments[dateStr] = marker;
    
    // Rule 1: Max 5 missione per month
    if (marker === 'missione') {
        let countMissione = 0;
        for (const date in tempAssignments) {
            if (date.startsWith(`${year}-${month}`) && tempAssignments[date] === 'missione') {
                countMissione++;
            }
        }
        if (countMissione > 5) {
            showToast("Impossibile assegnare: limite di 5 giorni di MISSIONE al mese superato.");
            return false;
        }
    }
    
    // Rule 2: Max 15 smartworking days per month
    if (marker === 'smartworking') {
        let countSmartworking = 0;
        for (const date in tempAssignments) {
            if (date.startsWith(`${year}-${month}`) && tempAssignments[date] === 'smartworking') {
                countSmartworking++;
            }
        }
        if (countSmartworking > 15) {
            showToast("Impossibile assegnare: limite di 15 giorni di SMARTWORKING al mese superato.");
            return false;
        }
    }
    
    // Rule 3: Smartworking consecutiveness rule
    // Max 10 consecutive smartworkings, followed by mandatory presence (or ferie/missione followed by presence)
    let smartStreak = 0;
    let afterTenStreak = false;
    
    for (let idx = 0; idx < workingDays.length; idx++) {
        const date = workingDays[idx];
        const type = tempAssignments[date];
        
        if (type === 'smartworking') {
            if (afterTenStreak) {
                showToast("Impossibile assegnare: questa modifica viola la regola del rientro in presenza dopo 10 giorni consecutivi di smartworking.");
                return false;
            }
            smartStreak++;
            if (smartStreak > 10) {
                showToast("Impossibile assegnare: massimo 10 giorni consecutivi di smartworking consentiti.");
                return false;
            }
            if (smartStreak === 10) {
                afterTenStreak = true;
            }
        } else if (type === 'ferie' || type === 'missione') {
            if (smartStreak < 10) {
                smartStreak = 0;
                afterTenStreak = false;
            }
            // If smartStreak is 10, afterTenStreak remains true (ferie/missione delay the presence requirement)
        } else {
            // Presence (empty/null)
            smartStreak = 0;
            afterTenStreak = false;
        }
    }
    
    return true;
}

function updateDayUI(dayEl, baseMarker, overlayMarker, dateStr) {
    dayEl.classList.remove('ferie', 'missione', 'smartworking', 'permesso', 'exfest', 'ct-mi', 'mi-ct', 'locked-date');
    
    const existingBadge = dayEl.querySelector('.permesso-badge');
    if (existingBadge) existingBadge.remove();

    const existingLock = dayEl.querySelector('.lock-badge');
    if (existingLock) existingLock.remove();

    if (baseMarker) {
        dayEl.classList.add(baseMarker);
        if (baseMarker === 'permesso' && dateStr && permessoHours[dateStr]) {
            const badge = document.createElement('span');
            badge.className = 'permesso-badge';
            badge.innerText = `${permessoHours[dateStr]}h`;
            dayEl.appendChild(badge);
        }
    }
    if (overlayMarker) {
        dayEl.classList.add(overlayMarker);
    }
    
    if (dateStr && lockedDates[dateStr]) {
        dayEl.classList.add('locked-date');
        const lockSpan = document.createElement('span');
        lockSpan.className = 'lock-badge';
        lockSpan.innerText = '🔒';
        dayEl.appendChild(lockSpan);
    }
}

function updateCountsUI() {
    document.getElementById('count-ferie').innerText = currentCounts.ferie;
    document.getElementById('count-missione').innerText = currentCounts.missione;
    document.getElementById('count-smartworking').innerText = currentCounts.smartworking;
    document.getElementById('count-permesso').innerText = currentCounts.permesso;
    document.getElementById('total-permesso').innerText = maxCounts.permesso;
    document.getElementById('count-exfest').innerText = currentCounts.exfest;
    document.getElementById('total-exfest').innerText = maxCounts.exfest;
    
    // Also update print summary counters
    const printFerie = document.getElementById('print-count-ferie');
    const printMissione = document.getElementById('print-count-missione');
    const printSmartworking = document.getElementById('print-count-smartworking');
    const printCountPermesso = document.getElementById('print-count-permesso');
    const printTotalPermesso = document.getElementById('print-total-permesso');
    const printCountExfest = document.getElementById('print-count-exfest');
    const printTotalExfest = document.getElementById('print-total-exfest');
    
    if (printFerie) printFerie.innerText = currentCounts.ferie;
    if (printMissione) printMissione.innerText = currentCounts.missione;
    if (printSmartworking) printSmartworking.innerText = currentCounts.smartworking;
    if (printCountPermesso) printCountPermesso.innerText = currentCounts.permesso;
    if (printTotalPermesso) printTotalPermesso.innerText = maxCounts.permesso;
    if (printCountExfest) printCountExfest.innerText = currentCounts.exfest;
    if (printTotalExfest) printTotalExfest.innerText = maxCounts.exfest;
}

function initPermessoModalUI() {
    const modal = document.getElementById('permesso-modal');
    if (!modal) return;

    const hourBtns = modal.querySelectorAll('.hour-btn');
    const customInput = document.getElementById('custom-hours-num');
    const cancelBtn = document.getElementById('permesso-modal-cancel');
    const confirmBtn = document.getElementById('permesso-modal-confirm');
    const deleteBtn = document.getElementById('permesso-modal-delete');

    hourBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedModalHours = parseFloat(btn.dataset.hours);
            hourBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            if (customInput) customInput.value = '';
        });
    });

    if (customInput) {
        customInput.addEventListener('input', () => {
            const val = parseFloat(customInput.value);
            if (!isNaN(val) && val > 0) {
                selectedModalHours = val;
                hourBtns.forEach(b => b.classList.remove('selected'));
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePermessoModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            if (!pendingPermessoDate || !pendingPermessoDayEl) return;

            const hours = selectedModalHours;
            if (!hours || hours <= 0) {
                showToast("Inserisci un numero di ore di permesso valido.");
                return;
            }

            const existingAssignment = assignments[pendingPermessoDate];
            const oldHours = (existingAssignment === 'permesso') ? (permessoHours[pendingPermessoDate] || 0) : 0;
            const diff = hours - oldHours;

            if (diff > currentCounts.permesso) {
                showToast(`Ore di permesso insufficienti! Disponibili: ${currentCounts.permesso}h`);
                return;
            }

            if (existingAssignment && existingAssignment !== 'permesso') {
                currentCounts[existingAssignment]++;
            }

            assignments[pendingPermessoDate] = 'permesso';
            permessoHours[pendingPermessoDate] = hours;
            currentCounts.permesso -= diff;

            updateDayUI(pendingPermessoDayEl, 'permesso', overlays[pendingPermessoDate], pendingPermessoDate);
            updateCountsUI();
            saveState();
            closePermessoModal();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            if (!pendingPermessoDate || !pendingPermessoDayEl) return;

            if (assignments[pendingPermessoDate] === 'permesso') {
                currentCounts.permesso += (permessoHours[pendingPermessoDate] || 0);
                delete assignments[pendingPermessoDate];
                delete permessoHours[pendingPermessoDate];
                updateDayUI(pendingPermessoDayEl, null, overlays[pendingPermessoDate], pendingPermessoDate);
                updateCountsUI();
                saveState();
            }
            closePermessoModal();
        });
    }
}

function openPermessoModal(dayEl, dateStr) {
    pendingPermessoDate = dateStr;
    pendingPermessoDayEl = dayEl;

    const modal = document.getElementById('permesso-modal');
    const dateSubtitle = document.getElementById('permesso-modal-date');
    const deleteBtn = document.getElementById('permesso-modal-delete');
    const customInput = document.getElementById('custom-hours-num');

    const [y, m, d] = dateStr.split('-');
    const monthObj = monthsInfo.find(mo => (mo.num + 1) === parseInt(m));
    const monthName = monthObj ? monthObj.name : `${m}/${y}`;
    dateSubtitle.innerText = `Giorno ${parseInt(d)} ${monthName}`;

    const existingHours = (assignments[dateStr] === 'permesso') ? permessoHours[dateStr] : null;

    if (existingHours) {
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        selectedModalHours = existingHours;
    } else {
        if (deleteBtn) deleteBtn.style.display = 'none';
        selectedModalHours = 2; // Default 2h
    }

    const hourBtns = modal.querySelectorAll('.hour-btn');
    hourBtns.forEach(btn => {
        if (parseFloat(btn.dataset.hours) === selectedModalHours) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });

    if (![1, 2, 3, 4, 6, 8].includes(selectedModalHours)) {
        if (customInput) customInput.value = selectedModalHours;
    } else {
        if (customInput) customInput.value = '';
    }

    modal.style.display = 'flex';
}

function closePermessoModal() {
    const modal = document.getElementById('permesso-modal');
    if (modal) modal.style.display = 'none';
    pendingPermessoDate = null;
    pendingPermessoDayEl = null;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.innerText = message;
    toast.classList.add('show');
    
    // Reset animation if called rapidly
    toast.style.animation = 'none';
    toast.offsetHeight; // trigger reflow
    toast.style.animation = null; 
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}

