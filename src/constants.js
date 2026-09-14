// Anni coperti. Il primo usa i totali storici (chiave calendar_max_counts),
// gli altri ripartono dai valori di DEFAULT_YEAR_COUNTS.
export const YEARS = [2026, 2027];

export const STATE_VERSION = 1;

export const MONTH_NAMES = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

export const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

// Mesi coperti dal calendario: agosto-dicembre 2026, poi tutto il 2027.
// `num` è l'indice 0-based usato da Date; i giorni si ricavano dal calendario.
export const MONTHS_INFO = [
    ...[7, 8, 9, 10, 11].map(num => ({ year: 2026, num })),
    ...MONTH_NAMES.map((_, num) => ({ year: 2027, num }))
].map(({ year, num }) => ({
    year,
    num,
    name: `${MONTH_NAMES[num]} ${year}`,
    days: new Date(year, num + 1, 0).getDate()
}));

// Festività che cadono nell'intervallo coperto.
export const HOLIDAYS = {
    '2026-08-15': 'Ferragosto',
    '2026-11-01': 'Ognissanti',
    '2026-12-08': 'Immacolata',
    '2026-12-25': 'Natale',
    '2026-10-04': 'San Francesco',
    '2026-12-26': 'Santo Stefano',
    '2027-01-01': 'Capodanno',
    '2027-01-06': 'Epifania',
    '2027-03-28': 'Pasqua',
    '2027-03-29': "Lunedì dell'Angelo",
    '2027-04-25': 'Liberazione',
    '2027-05-01': 'Festa del lavoro',
    '2027-06-02': 'Festa della Repubblica',
    '2027-08-15': 'Ferragosto',
    '2027-10-04': 'San Francesco',
    '2027-11-01': 'Ognissanti',
    '2027-12-08': 'Immacolata',
    '2027-12-25': 'Natale',
    '2027-12-26': 'Santo Stefano'
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

// Totali degli anni successivi al primo. Il permesso manca apposta:
// le ore non si azzerano a gennaio, restano un unico monte (DEFAULT_MAX_COUNTS).
export const DEFAULT_YEAR_COUNTS = {
    2027: { ferie: 20, missione: 60, smartworking: 96, exfest: 4 }
};

// Buoni pasto: il conteggio parte da settembre 2026, i mesi prima
// restano nel calendario ma fuori dal calcolo. Il saldo prosegue nel 2027.
export const MEAL_START = { year: 2026, num: 8 };

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
