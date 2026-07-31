import {
    DEFAULT_MAX_COUNTS,
    DEFAULT_ROUTE,
    HOLIDAYS,
    MONTHS_INFO,
    STATE_VERSION,
    YEAR
} from './constants.js';

const KEYS = {
    assignments: 'calendar_assignments',
    overlays: 'calendar_overlays',
    maxCounts: 'calendar_max_counts',
    permessoHours: 'calendar_permesso_hours',
    lockedDates: 'calendar_locked_dates',
    route: 'calendar_route'
};

const SNAPSHOT_KEY = 'calendar_snapshot_v0';

export const state = {
    /** "YYYY-MM-DD" -> uno dei BASE_MARKERS */
    assignments: {},
    /** "YYYY-MM-DD" -> "ct-mi" | "mi-ct" */
    overlays: {},
    /** "YYYY-MM-DD" -> ore di permesso (es. 2.5) */
    permessoHours: {},
    /** "YYYY-MM-DD" -> true */
    lockedDates: {},
    maxCounts: { ...DEFAULT_MAX_COUNTS },
    currentCounts: { ...DEFAULT_MAX_COUNTS },
    route: { ...DEFAULT_ROUTE },
    /** Giorni feriali dell'intervallo, ordinati: base per la regola dei consecutivi */
    workingDays: []
};

export function dateKey(monthIndex, day) {
    const month = String(monthIndex + 1).padStart(2, '0');
    return `${YEAR}-${month}-${String(day).padStart(2, '0')}`;
}

export function isHoliday(dateStr) {
    return Object.prototype.hasOwnProperty.call(HOLIDAYS, dateStr);
}

export function holidayName(dateStr) {
    return HOLIDAYS[dateStr] || null;
}

export function isWeekend(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return day === 0 || day === 6;
}

export function isLocked(dateStr) {
    return !!state.lockedDates[dateStr];
}

export function formatDateItalian(dateStr) {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(d, 10)}/${parseInt(m, 10)}/${y}`;
}

/** Sposta una data di N giorni restando immune al fuso orario. */
export function shiftDate(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Elenco di date da `a` a `b` inclusi, in ordine crescente. */
export function dateRange(a, b) {
    const [start, end] = a <= b ? [a, b] : [b, a];
    const out = [];
    for (let cur = start; cur <= end; cur = shiftDate(cur, 1)) out.push(cur);
    return out;
}

function initWorkingDays() {
    state.workingDays = [];
    MONTHS_INFO.forEach(month => {
        for (let day = 1; day <= month.days; day++) {
            const dateStr = dateKey(month.num, day);
            if (!isWeekend(dateStr) && !isHoliday(dateStr)) {
                state.workingDays.push(dateStr);
            }
        }
    });
}

function readJSON(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
        console.error(`Stato illeggibile per ${key}, ignorato.`, err);
        return null;
    }
}

/**
 * Copia una tantum dello stato così com'era prima di questa versione.
 * Costa poco e rende recuperabile un eventuale errore di migrazione.
 */
function snapshotLegacyState() {
    if (localStorage.getItem(SNAPSHOT_KEY)) return;
    const data = {};
    for (const key of Object.values(KEYS)) {
        const raw = localStorage.getItem(key);
        if (raw !== null) data[key] = raw;
    }
    if (Object.keys(data).length === 0) return;
    try {
        localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data }));
    } catch (err) {
        console.error('Impossibile salvare lo snapshot di sicurezza.', err);
    }
}

export function saveState() {
    localStorage.setItem(KEYS.assignments, JSON.stringify(state.assignments));
    localStorage.setItem(KEYS.overlays, JSON.stringify(state.overlays));
    localStorage.setItem(KEYS.maxCounts, JSON.stringify(state.maxCounts));
    localStorage.setItem(KEYS.permessoHours, JSON.stringify(state.permessoHours));
    localStorage.setItem(KEYS.lockedDates, JSON.stringify(state.lockedDates));
    localStorage.setItem(KEYS.route, JSON.stringify(state.route));
}

export function loadState() {
    initWorkingDays();
    snapshotLegacyState();

    Object.assign(state.maxCounts, readJSON(KEYS.maxCounts) || {});
    state.assignments = readJSON(KEYS.assignments) || {};
    state.overlays = readJSON(KEYS.overlays) || {};
    state.permessoHours = readJSON(KEYS.permessoHours) || {};
    state.lockedDates = readJSON(KEYS.lockedDates) || {};
    Object.assign(state.route, readJSON(KEYS.route) || {});

    localStorage.removeItem('calendar_global_locked');
    recalcCounts();
}

/** Quanto è già stato consumato di un segnagiorno (ore per il permesso, giorni per gli altri). */
export function usedCount(type) {
    let used = 0;
    for (const date in state.assignments) {
        if (state.assignments[date] !== type) continue;
        used += type === 'permesso' ? (state.permessoHours[date] || 0) : 1;
    }
    return used;
}

export function recalcCounts() {
    for (const type in state.maxCounts) {
        state.currentCounts[type] = state.maxCounts[type] - usedCount(type);
    }
}

export function serializeState() {
    return {
        version: STATE_VERSION,
        exportedAt: new Date().toISOString(),
        year: YEAR,
        assignments: state.assignments,
        overlays: state.overlays,
        permessoHours: state.permessoHours,
        lockedDates: state.lockedDates,
        maxCounts: state.maxCounts,
        route: state.route
    };
}

function plainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

/**
 * Sostituisce lo stato con quello di un file importato.
 * Lancia un errore con un messaggio leggibile se il file non è utilizzabile.
 */
export function applyImportedState(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Il file non contiene un backup del calendario.');
    }
    if (typeof payload.version !== 'number') {
        throw new Error('Il file non sembra un backup valido: manca il numero di versione.');
    }
    if (payload.version > STATE_VERSION) {
        throw new Error(`Backup creato con una versione più recente dell'app (v${payload.version}). Aggiorna l'app prima di importarlo.`);
    }

    state.assignments = plainObject(payload.assignments);
    state.overlays = plainObject(payload.overlays);
    state.permessoHours = plainObject(payload.permessoHours);
    state.lockedDates = plainObject(payload.lockedDates);
    state.maxCounts = { ...DEFAULT_MAX_COUNTS, ...plainObject(payload.maxCounts) };
    state.route = { ...DEFAULT_ROUTE, ...plainObject(payload.route) };

    recalcCounts();
    saveState();
}

export function resetState() {
    state.assignments = {};
    state.overlays = {};
    state.permessoHours = {};
    state.lockedDates = {};
    state.maxCounts = { ...DEFAULT_MAX_COUNTS };
    state.route = { ...DEFAULT_ROUTE };
    recalcCounts();
    saveState();
}
