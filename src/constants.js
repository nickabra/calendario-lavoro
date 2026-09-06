export const YEAR = 2026;

export const STATE_VERSION = 1;

export const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Mesi coperti dal calendario. `num` è l'indice 0-based usato da Date;
// i giorni si ricavano dal calendario invece di scriverli a mano.
export const MONTHS_INFO = [7, 8, 9, 10, 11].map(num => ({
    num,
    name: `${MONTH_NAMES[num]} ${YEAR}`,
    days: new Date(YEAR, num + 1, 0).getDate()
}));

// Festività che cadono nell'intervallo coperto.
export const HOLIDAYS = {
    '2026-08-15': 'Ferragosto',
    '2026-11-01': 'Ognissanti',
    '2026-12-08': 'Immacolata',
    '2026-12-25': 'Natale',
    '2026-12-26': 'Santo Stefano'
};

export const BASE_MARKERS = ['ferie', 'missione', 'smartworking', 'permesso', 'exfest'];
export const OVERLAY_MARKERS = ['ct-mi', 'mi-ct'];

export const MARKER_LABELS = {
    ferie: 'Ferie',
    missione: 'Missione',
    smartworking: 'Smartworking',
    permesso: 'Permesso',
    exfest: 'Ex festività'
};

export const DEFAULT_MAX_COUNTS = {
    ferie: 10,
    missione: 15,
    smartworking: 40,
    permesso: 11,
    exfest: 1
};

// Buoni pasto: il conteggio parte da settembre (indice 8), i mesi prima
// restano nel calendario ma fuori dal calcolo.
export const MEAL_START_MONTH = 8;

export const DEFAULT_MEAL_VOUCHERS = {
    initial: 35,
    doublePerMonth: 1.5,
    value: 7,
    missione: false,
    smartworking: false
};

// Vincoli contrattuali
export const MONTHLY_LIMITS = {
    missione: 5,
    smartworking: 15
};
export const MAX_CONSECUTIVE_SW = 10;

// Rotta di default: `home` è la città di partenza dell'overlay ct-mi,
// `work` quella di arrivo. MIL copre tutti gli scali milanesi.
export const DEFAULT_ROUTE = { home: 'CTA', work: 'MIL' };
