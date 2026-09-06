import './style.css';

import { initBackup } from './backup.js';
import {
    clearRangePreview,
    dayElement,
    refreshAllDays,
    renderCalendar,
    setRangePreview,
    updateDayUI
} from './calendar.js';
import { MARKER_LABELS, OVERLAY_MARKERS, YEAR } from './constants.js';
import { initMealsPanel, renderMealsPanel, syncMealInputs } from './meals.js';
import { validateAssignment } from './rules.js';
import {
    activePage,
    addPage,
    dateRange,
    deletePage,
    formatDateItalian,
    isHoliday,
    isLocked,
    isWeekend,
    loadState,
    pages,
    recalcCounts,
    renamePage,
    saveState,
    setSaveHook,
    state,
    switchPage
} from './state.js';
import { initSync, markLocalChange } from './sync.js';
import {
    closeFlightPopover,
    initTripsPanel,
    openFlightPopover,
    renderTripsPanel,
    syncRouteInputs
} from './tripsPanel.js';
import {
    askNewPage,
    askPermessoHours,
    initEditableTotals,
    initNewPageModal,
    initPermessoModal,
    showToast,
    updateCountsUI
} from './ui.js';

const SHORTCUTS = {
    '1': 'ferie',
    '2': 'missione',
    '3': 'smartworking',
    '4': 'permesso',
    '5': 'exfest',
    '6': 'ct-mi',
    '7': 'mi-ct',
    e: 'eraser',
    l: 'lock'
};

let currentMarker = null;
let dragging = false;
let dragStart = null;
let dragEnd = null;

document.addEventListener('DOMContentLoaded', () => {
    setSaveHook(markLocalChange);
    loadState();

    renderCalendar(document.getElementById('calendar-container'), {
        onDayDown: handleDayDown,
        onDayEnter: handleDayEnter
    });

    initMarkerCards();
    initPermessoModal();
    initNewPageModal();
    initEditableTotals(() => {
        saveState();
        updateCountsUI();
    });
    initTripsPanel(() => {
        refreshAllDays();
        renderTripsPanel();
    });
    initMealsPanel(renderMealsPanel);
    initBackup(rebuildAll);
    initSync(reloadFromStorage);
    initKeyboard();
    initGlobalPointerHandlers();

    document.getElementById('btn-export-pdf')?.addEventListener('click', () => window.print());

    updateCountsUI();
    renderTripsPanel();
    renderMealsPanel();
    renderPagesBar();
    updateContainerClass();
});

/** Riallinea tutta l'interfaccia dopo una sostituzione integrale dello stato. */
function rebuildAll() {
    refreshAllDays();
    updateCountsUI();
    renderTripsPanel();
    syncRouteInputs();
    syncMealInputs();
    renderMealsPanel();
    renderPagesBar();
}

/** Rilegge da localStorage dopo che la sincronizzazione ha sostituito i dati. */
function reloadFromStorage() {
    loadState();
    rebuildAll();
}

// --- Pagine di calendario ----------------------------------------------

function renderPagesBar() {
    const bar = document.getElementById('pages-bar');
    if (!bar) return;

    bar.replaceChildren();
    for (const page of pages.list) {
        bar.appendChild(pageTab(page));
    }
    bar.appendChild(newPageButton());

    // Il PDF stampato deve dire di quale calendario è.
    const printTitle = document.querySelector('.print-summary h2');
    if (printTitle) printTitle.innerText = `Riepilogo ${activePage().name} · ${YEAR}`;
}

function pageTab(page) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `page-tab${page.id === pages.activeId ? ' active' : ''}`;
    tab.title = 'Doppio clic per rinominare';

    const label = document.createElement('span');
    label.innerText = page.name;
    tab.appendChild(label);

    tab.addEventListener('click', () => {
        switchPage(page.id);
        rebuildAll();
    });

    tab.addEventListener('dblclick', () => {
        const name = window.prompt('Nome del calendario', page.name)?.trim();
        if (!name) return;
        renamePage(page.id, name);
        renderPagesBar();
    });

    // La chiusura sta solo sulla scheda attiva: si elimina quello che si sta guardando.
    if (page.id === pages.activeId && pages.list.length > 1) {
        const close = document.createElement('span');
        close.className = 'page-close';
        close.innerText = '✕';
        close.title = 'Elimina questo calendario';
        close.addEventListener('click', (event) => {
            event.stopPropagation();
            const confirmed = window.confirm(
                `Eliminare "${page.name}" con tutte le sue assegnazioni?

` +
                'Non è reversibile. Se non hai un backup, annulla ed esportalo prima.'
            );
            if (!confirmed) return;
            deletePage(page.id);
            rebuildAll();
            showToast('Calendario eliminato.', 'info');
        });
        tab.appendChild(close);
    }

    return tab;
}

function newPageButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'page-tab add';
    button.innerText = '+ Nuovo';
    button.title = 'Crea un calendario vuoto, indipendente da questo';

    button.addEventListener('click', async () => {
        const answer = await askNewPage(`Calendario ${pages.list.length + 1}`);
        if (!answer) return;

        const source = pages.list.find(page => page.id === answer.sourceId);
        addPage(answer.name, answer.sourceId);
        rebuildAll();
        showToast(
            source ? `"${answer.name}" creato come copia di "${source.name}".` : 'Nuovo calendario vuoto creato.',
            'success'
        );
    });

    return button;
}

/** Salva e riallinea le celle toccate più i contatori e il pannello viaggi. */
function commit(dates) {
    recalcCounts();
    saveState();
    for (const date of dates) {
        const el = dayElement(date);
        if (el) updateDayUI(el, date);
    }
    updateCountsUI();
    renderTripsPanel();
    renderMealsPanel();
}

// --- Selezione dello strumento -----------------------------------------

function initMarkerCards() {
    document.querySelectorAll('.marker-card').forEach(card => {
        card.addEventListener('click', () => selectMarker(card.dataset.type));
    });
}

function selectMarker(type) {
    currentMarker = type;
    document.querySelectorAll('.marker-card').forEach(card => {
        card.classList.toggle('active', card.dataset.type === type);
    });
    updateContainerClass();
}

function updateContainerClass() {
    const container = document.querySelector('.app-container');
    if (!container) return;

    container.classList.remove(
        'base-marker-active', 'overlay-marker-active',
        'eraser-active', 'lock-active', 'no-marker-active'
    );

    if (!currentMarker) container.classList.add('no-marker-active');
    else if (currentMarker === 'eraser') container.classList.add('eraser-active');
    else if (currentMarker === 'lock') container.classList.add('lock-active');
    else if (OVERLAY_MARKERS.includes(currentMarker)) container.classList.add('overlay-marker-active');
    else container.classList.add('base-marker-active');
}

function initKeyboard() {
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        // Con una modale aperta i tasti sono suoi: Esc deve solo chiuderla,
        // non deselezionare anche lo strumento.
        const modalOpen = [...document.querySelectorAll('.modal-backdrop')]
            .some(modal => modal.style.display === 'flex');
        if (modalOpen) return;

        if (event.key === 'Escape') {
            selectMarker(null);
            closeFlightPopover();
            return;
        }

        const type = SHORTCUTS[event.key.toLowerCase()];
        if (type) {
            selectMarker(type);
            event.preventDefault();
        }
    });
}

// --- Selezione dei giorni (clic singolo e trascinamento) ---------------

function handleDayDown(dateStr, dayEl, event) {
    if (event.button !== 0) return;
    closeFlightPopover();

    if (!currentMarker) {
        if (state.overlays[dateStr]) {
            openFlightPopover(dateStr, dayEl);
        } else {
            showToast('Scegli uno strumento qui sopra. I giorni con ✈ mostrano i voli anche senza strumento selezionato.', 'info');
        }
        return;
    }

    dragging = true;
    dragStart = dateStr;
    dragEnd = dateStr;
    setRangePreview([dateStr]);
}

function handleDayEnter(dateStr) {
    if (!dragging) return;
    dragEnd = dateStr;
    setRangePreview(dateRange(dragStart, dateStr));
}

function initGlobalPointerHandlers() {
    document.addEventListener('pointerup', () => {
        if (!dragging) return;
        const dates = dateRange(dragStart, dragEnd);
        endDrag();
        applyMarker(dates);
    });

    document.addEventListener('pointercancel', endDrag);
}

function endDrag() {
    dragging = false;
    dragStart = null;
    dragEnd = null;
    clearRangePreview();
}

// --- Applicazione dello strumento --------------------------------------

function applyMarker(dates) {
    if (!currentMarker) return;
    if (currentMarker === 'lock') return applyLock(dates);
    if (currentMarker === 'eraser') return applyEraser(dates);
    if (OVERLAY_MARKERS.includes(currentMarker)) return applyOverlay(dates, currentMarker);
    if (currentMarker === 'permesso') return applyPermesso(dates);
    return applyBase(dates, currentMarker);
}

function applyLock(dates) {
    if (dates.length === 1) {
        const date = dates[0];
        if (state.lockedDates[date]) {
            delete state.lockedDates[date];
            showToast(`${formatDateItalian(date)} sbloccata 🔓`, 'info');
        } else {
            state.lockedDates[date] = true;
            showToast(`${formatDateItalian(date)} bloccata 🔒`, 'success');
        }
    } else {
        for (const date of dates) state.lockedDates[date] = true;
        showToast(`${dates.length} giorni bloccati 🔒`, 'success');
    }
    commit(dates);
}

function applyEraser(dates) {
    const editable = dates.filter(date => !isLocked(date));
    const lockedCount = dates.length - editable.length;
    let removed = 0;

    for (const date of editable) {
        // Come prima: prima si toglie il segnagiorno, poi eventualmente il volo.
        if (state.assignments[date]) {
            delete state.assignments[date];
            delete state.permessoHours[date];
            removed++;
        } else if (state.overlays[date]) {
            delete state.overlays[date];
            removed++;
        }
    }

    if (removed) commit(dates);

    const bloccati = `${lockedCount} ${plural(lockedCount, 'giorno bloccato', 'giorni bloccati')} 🔒`;
    if (lockedCount && !removed) {
        showToast(`Nessuna modifica: ${bloccati}.`, 'info');
    } else if (lockedCount) {
        showToast(`Rimossi ${removed} ${plural(removed, 'giorno', 'giorni')} · saltati ${bloccati}.`, 'info');
    }
}

function applyOverlay(dates, marker) {
    const editable = dates.filter(date => !isLocked(date));
    const lockedCount = dates.length - editable.length;

    if (editable.length === 0) {
        showToast('Selezione tutta bloccata 🔒: sbloccala prima di modificarla.');
        return;
    }

    if (editable.length === 1) {
        const date = editable[0];
        if (state.overlays[date] === marker) delete state.overlays[date];
        else state.overlays[date] = marker;
    } else {
        for (const date of editable) state.overlays[date] = marker;
    }

    commit(dates);
    if (lockedCount) {
        showToast(`Saltati ${lockedCount} ${plural(lockedCount, 'giorno bloccato', 'giorni bloccati')} 🔒.`, 'info');
    }
}

function countAssigned(assignments, marker) {
    let total = 0;
    for (const date in assignments) {
        if (assignments[date] === marker) total++;
    }
    return total;
}

function splitSelection(dates) {
    const eligible = [];
    let skippedLocked = 0;
    let skippedBlocked = 0;

    for (const date of dates) {
        if (isLocked(date)) skippedLocked++;
        else if (isWeekend(date) || isHoliday(date)) skippedBlocked++;
        else eligible.push(date);
    }

    return { eligible, skippedLocked, skippedBlocked };
}

function applyBase(dates, marker) {
    // Riclicco sullo stesso giorno già assegnato: non c'è niente da dire.
    if (dates.length === 1 && state.assignments[dates[0]] === marker) return;

    const { eligible, skippedLocked, skippedBlocked } = splitSelection(dates);

    const working = { ...state.assignments };
    let used = countAssigned(working, marker);
    const applied = [];
    let stopMessage = null;

    for (const date of eligible) {
        if (working[date] === marker) continue;

        if (used + 1 > state.maxCounts[marker]) {
            stopMessage = `Giorni esauriti per ${MARKER_LABELS[marker]}.`;
            break;
        }

        const check = validateAssignment(date, marker, working);
        if (!check.ok) {
            stopMessage = check.message;
            break;
        }

        working[date] = marker;
        used++;
        applied.push(date);
    }

    for (const date of applied) {
        if (state.assignments[date] === 'permesso') delete state.permessoHours[date];
        state.assignments[date] = marker;
    }

    if (applied.length) commit(dates);
    report(marker, applied.length, { skippedLocked, skippedBlocked, stopMessage });
}

async function applyPermesso(dates) {
    const { eligible, skippedLocked, skippedBlocked } = splitSelection(dates);
    if (eligible.length === 0) {
        report('permesso', 0, { skippedLocked, skippedBlocked, stopMessage: null });
        return;
    }

    const single = eligible.length === 1 ? eligible[0] : null;
    const existingHours = single && state.assignments[single] === 'permesso'
        ? state.permessoHours[single]
        : null;

    const answer = await askPermessoHours({ dates: eligible, existingHours });
    if (!answer) return;

    if (answer.remove) {
        if (!single) return;
        delete state.assignments[single];
        delete state.permessoHours[single];
        commit(dates);
        showToast('Permesso rimosso.', 'info');
        return;
    }

    const { hours } = answer;
    const workingAssignments = { ...state.assignments };
    const workingHours = { ...state.permessoHours };

    let usedHours = 0;
    for (const date in workingAssignments) {
        if (workingAssignments[date] === 'permesso') usedHours += workingHours[date] || 0;
    }

    const applied = [];
    let stopMessage = null;

    for (const date of eligible) {
        const previous = workingAssignments[date] === 'permesso' ? (workingHours[date] || 0) : 0;

        if (usedHours - previous + hours > state.maxCounts.permesso) {
            const left = state.maxCounts.permesso - usedHours;
            stopMessage = `Ore di permesso insufficienti: ne restano ${formatHours(left)}h.`;
            break;
        }

        const check = validateAssignment(date, 'permesso', workingAssignments);
        if (!check.ok) {
            stopMessage = check.message;
            break;
        }

        usedHours = usedHours - previous + hours;
        workingAssignments[date] = 'permesso';
        workingHours[date] = hours;
        applied.push(date);
    }

    for (const date of applied) {
        state.assignments[date] = 'permesso';
        state.permessoHours[date] = hours;
    }

    if (applied.length) commit(dates);
    report('permesso', applied.length, { skippedLocked, skippedBlocked, stopMessage, hours });
}

function formatHours(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Un solo messaggio che dice cosa è stato fatto e cosa no. */
function report(marker, appliedCount, { skippedLocked, skippedBlocked, stopMessage, hours }) {
    const skipped = [];
    if (skippedLocked) skipped.push(`${skippedLocked} ${plural(skippedLocked, 'bloccato', 'bloccati')} 🔒`);
    if (skippedBlocked) skipped.push(`${skippedBlocked} fra weekend e festivi`);

    if (appliedCount === 0) {
        if (stopMessage) {
            showToast(stopMessage);
        } else if (skipped.length) {
            showToast(`Nessun giorno assegnato: ${skipped.join(', ')}.`, 'error');
        } else {
            showToast('Nessun giorno da assegnare.', 'info');
        }
        return;
    }

    const giorni = plural(appliedCount, 'giorno', 'giorni');
    const what = marker === 'permesso'
        ? `${appliedCount} ${giorni} di permesso da ${formatHours(hours)}h`
        : `${appliedCount} ${giorni} di ${MARKER_LABELS[marker]}`;

    let text = skipped.length ? `${what} · saltati: ${skipped.join(', ')}.` : `${what}.`;
    if (stopMessage) text += ` ${stopMessage}`;

    showToast(text, stopMessage || skipped.length ? 'info' : 'success');
}

function plural(count, singular, many) {
    return count === 1 ? singular : many;
}
