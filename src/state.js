import {
    DEFAULT_MAX_COUNTS,
    DEFAULT_MEAL_VOUCHERS,
    DEFAULT_ROUTE,
    DEFAULT_YEAR_COUNTS,
    HOLIDAYS,
    MONTHS_INFO,
    STATE_VERSION,
    YEARS
} from './constants.js';

const KEYS = {
    assignments: 'calendar_assignments',
    overlays: 'calendar_overlays',
    maxCounts: 'calendar_max_counts',
    yearCounts: 'calendar_year_counts',
    permessoHours: 'calendar_permesso_hours',
    lockedDates: 'calendar_locked_dates',
    route: 'calendar_route',
    mealVouchers: 'calendar_meal_vouchers'
};

/**
 * Richiamata dopo ogni salvataggio. La imposta il modulo di sincronizzazione;
 * senza di esso lo stato resta puramente locale, come prima.
 */
let onStateSaved = null;

export function setSaveHook(fn) {
    onStateSaved = fn;
}

const SNAPSHOT_KEY = 'calendar_snapshot_v0';
const PAGES_KEY = 'calendar_pages';
const ACTIVE_PAGE_KEY = 'calendar_active_page';
// Anno mostrato: preferenza del dispositivo, esclusa dalla sincronizzazione.
export const VIEW_YEAR_KEY = 'calendar_view_year';

/**
 * Pagine di calendario indipendenti. La prima ha id '' e usa le chiavi
 * storiche senza suffisso, così i dati salvati prima di questa versione
 * restano dove sono senza bisogno di migrazioni.
 */
export const pages = {
    list: [{ id: '', name: 'Calendario 1' }],
    activeId: ''
};

function pageKey(base, pageId) {
    return pageId ? `${base}:${pageId}` : base;
}

function storageKey(base) {
    return pageKey(base, pages.activeId);
}

export function activePage() {
    return pages.list.find(page => page.id === pages.activeId) || pages.list[0];
}

export const state = {
    /** "YYYY-MM-DD" -> uno dei BASE_MARKERS */
    assignments: {},
    /** "YYYY-MM-DD" -> "ct-mi" | "mi-ct" */
    overlays: {},
    /** "YYYY-MM-DD" -> ore di permesso (es. 2.5) */
    permessoHours: {},
    /** "YYYY-MM-DD" -> true */
    lockedDates: {},
    /** Totali del primo anno, più il monte ore di permesso condiviso da tutti gli anni */
    maxCounts: { ...DEFAULT_MAX_COUNTS },
    /** Totali degli anni successivi: { 2027: { ferie, missione, ... } } */
    yearCounts: yearCountsWithDefaults(null),
    /** Residui dell'anno mostrato */
    currentCounts: { ...DEFAULT_MAX_COUNTS },
    route: { ...DEFAULT_ROUTE },
    /** Buoni pasto: dotazione iniziale, media di giorni doppi e cosa matura */
    mealVouchers: { ...DEFAULT_MEAL_VOUCHERS },
    /** Giorni feriali dell'intervallo, ordinati: base per la regola dei consecutivi */
    workingDays: [],
    /** Anno mostrato a schermo: decide mesi e contatori visibili */
    viewYear: YEARS[0]
};

function yearCountsWithDefaults(saved) {
    const out = {};
    for (const [year, defaults] of Object.entries(DEFAULT_YEAR_COUNTS)) {
        out[year] = { ...defaults, ...plainObject(saved?.[year]) };
    }
    return out;
}

/** Totale disponibile per un segnagiorno in un anno. Il permesso non si azzera mai. */
export function maxCount(type, year = state.viewYear) {
    if (type === 'permesso' || !state.yearCounts[year]) return state.maxCounts[type];
    return state.yearCounts[year][type];
}

export function setMaxCount(type, year, value) {
    if (type === 'permesso' || !state.yearCounts[year]) state.maxCounts[type] = value;
    else state.yearCounts[year][type] = value;
}

export function setViewYear(year) {
    if (!YEARS.includes(year)) return;
    state.viewYear = year;
    localStorage.setItem(VIEW_YEAR_KEY, String(year));
    recalcCounts();
}

function loadViewYear() {
    const saved = Number(localStorage.getItem(VIEW_YEAR_KEY));
    const current = new Date().getFullYear();
    state.viewYear = YEARS.includes(saved) ? saved : YEARS.includes(current) ? current : YEARS[0];
}

export function dateKey(year, monthIndex, day) {
    const month = String(monthIndex + 1).padStart(2, '0');
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
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
            const dateStr = dateKey(month.year, month.num, day);
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
    localStorage.setItem(storageKey(KEYS.assignments), JSON.stringify(state.assignments));
    localStorage.setItem(storageKey(KEYS.overlays), JSON.stringify(state.overlays));
    localStorage.setItem(storageKey(KEYS.maxCounts), JSON.stringify(state.maxCounts));
    localStorage.setItem(storageKey(KEYS.yearCounts), JSON.stringify(state.yearCounts));
    localStorage.setItem(storageKey(KEYS.permessoHours), JSON.stringify(state.permessoHours));
    localStorage.setItem(storageKey(KEYS.lockedDates), JSON.stringify(state.lockedDates));
    localStorage.setItem(storageKey(KEYS.route), JSON.stringify(state.route));
    localStorage.setItem(storageKey(KEYS.mealVouchers), JSON.stringify(state.mealVouchers));
    onStateSaved?.();
}

/** Carica i dati della pagina attiva, ripartendo sempre dai valori di default. */
function loadActivePage() {
    state.assignments = readJSON(storageKey(KEYS.assignments)) || {};
    state.overlays = readJSON(storageKey(KEYS.overlays)) || {};
    state.permessoHours = readJSON(storageKey(KEYS.permessoHours)) || {};
    state.lockedDates = readJSON(storageKey(KEYS.lockedDates)) || {};
    state.maxCounts = { ...DEFAULT_MAX_COUNTS, ...(readJSON(storageKey(KEYS.maxCounts)) || {}) };
    state.yearCounts = yearCountsWithDefaults(readJSON(storageKey(KEYS.yearCounts)));
    state.route = { ...DEFAULT_ROUTE, ...(readJSON(storageKey(KEYS.route)) || {}) };
    state.mealVouchers = { ...DEFAULT_MEAL_VOUCHERS, ...(readJSON(storageKey(KEYS.mealVouchers)) || {}) };
    recalcCounts();
}

const RETUNED_KEY = 'calendar_defaults_retuned';

// Massimali cambiati rispetto alle versioni precedenti dell'app.
const PREVIOUS_DEFAULTS = { smartworking: 45, permesso: 14 };

/**
 * Porta ai nuovi massimali i calendari già salvati. Tocca solo chi aveva ancora
 * il vecchio valore di default: un totale scelto a mano resta come sta.
 */
function retuneDefaults() {
    if (localStorage.getItem(RETUNED_KEY)) return;

    for (const page of pages.list) {
        const key = pageKey(KEYS.maxCounts, page.id);
        const saved = readJSON(key);
        if (!saved) continue;

        let changed = false;
        for (const [type, previous] of Object.entries(PREVIOUS_DEFAULTS)) {
            if (saved[type] === previous) {
                saved[type] = DEFAULT_MAX_COUNTS[type];
                changed = true;
            }
        }
        if (changed) localStorage.setItem(key, JSON.stringify(saved));
    }

    localStorage.setItem(RETUNED_KEY, '1');
}

export function loadState() {
    initWorkingDays();
    loadViewYear();
    snapshotLegacyState();
    loadPages();
    retuneDefaults();
    loadActivePage();

    localStorage.removeItem('calendar_global_locked');
}

// --- Pagine ------------------------------------------------------------

function loadPages() {
    const saved = readJSON(PAGES_KEY);
    const list = Array.isArray(saved)
        ? saved.filter(page => page && typeof page.id === 'string' && typeof page.name === 'string')
        : [];
    if (list.length) pages.list = list;

    const active = localStorage.getItem(ACTIVE_PAGE_KEY) || '';
    pages.activeId = pages.list.some(page => page.id === active) ? active : pages.list[0].id;
}

function savePages() {
    localStorage.setItem(PAGES_KEY, JSON.stringify(pages.list));
    localStorage.setItem(ACTIVE_PAGE_KEY, pages.activeId);
    onStateSaved?.();
}

/** Salva la pagina corrente e carica quella richiesta. */
export function switchPage(id) {
    if (id === pages.activeId || !pages.list.some(page => page.id === id)) return;
    saveState();
    pages.activeId = id;
    savePages();
    loadActivePage();
}

/** `sourceId` copia i dati di una pagina esistente; null crea una pagina vuota. */
export function addPage(name, sourceId = null) {
    saveState();
    // Due pagine con lo stesso id condividerebbero i dati: l'id va reso unico
    // anche quando due creazioni cadono nello stesso millisecondo.
    let id = `p${Date.now().toString(36)}`;
    while (pages.list.some(page => page.id === id)) id += 'x';
    const page = { id, name: name || `Calendario ${pages.list.length + 1}` };

    if (sourceId !== null && pages.list.some(item => item.id === sourceId)) {
        // Copia le stringhe grezze: nessun dato resta condiviso fra le due pagine.
        for (const base of Object.values(KEYS)) {
            const raw = localStorage.getItem(pageKey(base, sourceId));
            if (raw === null) localStorage.removeItem(pageKey(base, page.id));
            else localStorage.setItem(pageKey(base, page.id), raw);
        }
    }

    pages.list.push(page);
    pages.activeId = page.id;
    savePages();
    loadActivePage();
    saveState();
    return page;
}

export function renamePage(id, name) {
    const page = pages.list.find(item => item.id === id);
    if (!page || !name) return;
    page.name = name;
    savePages();
}

/** Elimina la pagina e i suoi dati. L'ultima pagina rimasta non si elimina. */
export function deletePage(id) {
    if (pages.list.length < 2) return false;
    const index = pages.list.findIndex(page => page.id === id);
    if (index === -1) return false;

    saveState();
    const previousActive = pages.activeId;
    pages.activeId = id;
    for (const key of Object.values(KEYS)) localStorage.removeItem(storageKey(key));

    pages.list.splice(index, 1);
    pages.activeId = previousActive === id
        ? pages.list[Math.min(index, pages.list.length - 1)].id
        : previousActive;
    savePages();
    loadActivePage();
    return true;
}

/**
 * Quanto è già stato consumato di un segnagiorno nell'anno: giorni, oppure ore
 * per il permesso, che si contano su tutti gli anni perché il monte è unico.
 */
export function usedCount(type, year = state.viewYear, assignments = state.assignments) {
    let used = 0;
    for (const date in assignments) {
        if (assignments[date] !== type) continue;
        if (type === 'permesso') used += state.permessoHours[date] || 0;
        else if (date.startsWith(`${year}-`)) used++;
    }
    return used;
}

export function recalcCounts() {
    for (const type in state.maxCounts) {
        state.currentCounts[type] = maxCount(type) - usedCount(type);
    }
}

export function serializeState() {
    return {
        version: STATE_VERSION,
        exportedAt: new Date().toISOString(),
        assignments: state.assignments,
        overlays: state.overlays,
        permessoHours: state.permessoHours,
        lockedDates: state.lockedDates,
        maxCounts: state.maxCounts,
        yearCounts: state.yearCounts,
        route: state.route,
        mealVouchers: state.mealVouchers
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
    state.yearCounts = yearCountsWithDefaults(plainObject(payload.yearCounts));
    state.route = { ...DEFAULT_ROUTE, ...plainObject(payload.route) };
    state.mealVouchers = { ...DEFAULT_MEAL_VOUCHERS, ...plainObject(payload.mealVouchers) };

    recalcCounts();
    saveState();
}

export function resetState() {
    state.assignments = {};
    state.overlays = {};
    state.permessoHours = {};
    state.lockedDates = {};
    state.maxCounts = { ...DEFAULT_MAX_COUNTS };
    state.yearCounts = yearCountsWithDefaults(null);
    state.route = { ...DEFAULT_ROUTE };
    state.mealVouchers = { ...DEFAULT_MEAL_VOUCHERS };
    recalcCounts();
    saveState();
}
