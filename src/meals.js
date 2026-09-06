import { MEAL_START_MONTH, MONTHS_INFO } from './constants.js';
import { dateKey, isHoliday, isWeekend, saveState, state } from './state.js';

const MEAL_MONTHS = MONTHS_INFO.filter(month => month.num >= MEAL_START_MONTH);

/**
 * Giorno passato in ufficio: feriale, non festivo e senza assenze.
 * Un permesso di poche ore lascia comunque il pranzo in ufficio;
 * solo la giornata intera (8h) toglie la presenza.
 */
export function isOfficeDay(dateStr) {
    if (isWeekend(dateStr) || isHoliday(dateStr)) return false;

    const marker = state.assignments[dateStr];
    if (!marker) return true;
    if (marker === 'permesso') return (state.permessoHours[dateStr] || 0) < 8;
    return false;
}

/** Se il giorno fa maturare un buono, secondo le regole scelte dall'utente. */
export function earnsVoucher(dateStr, config) {
    if (isOfficeDay(dateStr)) return true;
    if (isWeekend(dateStr) || isHoliday(dateStr)) return false;

    const marker = state.assignments[dateStr];
    if (marker === 'missione') return !!config.missione;
    if (marker === 'smartworking') return !!config.smartworking;
    return false;
}

/**
 * Bilancio mese per mese da settembre a dicembre.
 * Si matura un buono nei giorni che contano come lavorati e se ne spende
 * uno per ogni giorno in ufficio, più la media di giorni a doppio buono.
 */
export function computeMeals(config = state.mealVouchers) {
    let balance = config.initial;

    const months = MEAL_MONTHS.map(month => {
        let earned = 0;
        let spent = 0;

        for (let day = 1; day <= month.days; day++) {
            const dateStr = dateKey(month.num, day);
            if (earnsVoucher(dateStr, config)) earned++;
            if (isOfficeDay(dateStr)) spent++;
        }

        // Non si può spendere due volte in un giorno in cui non si pranza fuori.
        const extra = Math.min(config.doublePerMonth, spent);
        balance += earned - spent - extra;

        return { name: month.name, earned, spent, extra, balance };
    });

    return { months, final: balance, value: balance * config.value };
}

// --- Pannello ----------------------------------------------------------

const FIELDS = {
    'meals-initial': 'initial',
    'meals-double': 'doublePerMonth',
    'meals-value': 'value',
    'meals-missione': 'missione',
    'meals-smartworking': 'smartworking'
};

export function syncMealInputs() {
    for (const [id, key] of Object.entries(FIELDS)) {
        const input = document.getElementById(id);
        if (!input) continue;
        if (input.type === 'checkbox') input.checked = !!state.mealVouchers[key];
        else input.value = state.mealVouchers[key];
    }
}

export function initMealsPanel(onChange) {
    for (const [id, key] of Object.entries(FIELDS)) {
        const input = document.getElementById(id);
        if (!input) continue;

        input.addEventListener('change', () => {
            if (input.type === 'checkbox') {
                state.mealVouchers[key] = input.checked;
            } else {
                const value = parseFloat(input.value);
                // Un valore assurdo non deve azzerare la configurazione:
                // si torna a quello di prima e si lascia parlare il campo.
                if (!Number.isFinite(value) || value < 0) {
                    input.value = state.mealVouchers[key];
                    return;
                }
                state.mealVouchers[key] = value;
            }
            saveState();
            onChange();
        });
    }

    syncMealInputs();
}

function formatNumber(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

function formatEuro(value) {
    return `${value.toFixed(2).replace('.', ',')} €`;
}

export function renderMealsPanel() {
    const container = document.getElementById('meals-table');
    if (!container) return;

    const { months, final, value } = computeMeals();

    const table = document.createElement('table');
    table.className = 'meals-grid';
    table.appendChild(row('th', ['Mese', 'Maturati', 'Spesi', 'Doppi', 'Saldo']));

    for (const month of months) {
        table.appendChild(row('td', [
            month.name,
            `+${month.earned}`,
            `−${month.spent}`,
            month.extra ? `−${formatNumber(month.extra)}` : '—',
            formatNumber(month.balance)
        ]));
    }

    container.replaceChildren(table);

    const summary = document.getElementById('meals-summary');
    if (summary) {
        summary.innerText = `${formatNumber(final)} buoni a fine dicembre · ${formatEuro(value)} di spesa`;
    }
}

function row(cellTag, values) {
    const tr = document.createElement('tr');
    for (const value of values) {
        const cell = document.createElement(cellTag);
        cell.innerText = value;
        tr.appendChild(cell);
    }
    return tr;
}
