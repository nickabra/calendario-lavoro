import { DAY_NAMES, MARKER_LABELS, MONTHS_INFO } from './constants.js';
import { legLabel } from './flights.js';
import {
    dateKey,
    formatDateItalian,
    holidayName,
    isHoliday,
    isWeekend,
    state
} from './state.js';

const ALL_DAY_CLASSES = [
    'ferie', 'missione', 'smartworking', 'permesso', 'exfest',
    'ct-mi', 'mi-ct', 'locked-date', 'range-preview'
];

/**
 * Costruisce (o ricostruisce) il calendario. Svuota sempre il container:
 * chiamarla due volte non deve duplicare i mesi.
 */
export function renderCalendar(container, handlers = {}) {
    container.replaceChildren();

    for (const month of MONTHS_INFO) {
        const monthEl = document.createElement('div');
        monthEl.className = 'month';

        const title = document.createElement('h2');
        title.className = 'month-title';
        title.innerText = month.name;
        monthEl.appendChild(title);

        const grid = document.createElement('div');
        grid.className = 'days-grid';

        for (const name of DAY_NAMES) {
            const header = document.createElement('div');
            header.className = 'day-header';
            header.innerText = name;
            grid.appendChild(header);
        }

        // Celle vuote per allineare il 1° del mese alla settimana lun-dom.
        const firstWeekday = new Date(2026, month.num, 1).getDay();
        const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
        for (let i = 0; i < offset; i++) {
            const empty = document.createElement('div');
            empty.className = 'day empty';
            grid.appendChild(empty);
        }

        for (let day = 1; day <= month.days; day++) {
            grid.appendChild(createDayCell(month.num, day, handlers));
        }

        monthEl.appendChild(grid);
        container.appendChild(monthEl);
    }
}

function createDayCell(monthIndex, day, handlers) {
    const dateStr = dateKey(monthIndex, day);
    const dayEl = document.createElement('div');
    dayEl.className = 'day';
    dayEl.setAttribute('data-date', dateStr);

    const num = document.createElement('span');
    num.className = 'day-num';
    num.innerText = day;
    dayEl.appendChild(num);

    if (isWeekend(dateStr)) dayEl.classList.add('weekend', 'blocked');
    if (isHoliday(dateStr)) dayEl.classList.add('holiday', 'blocked');

    if (handlers.onDayDown) {
        dayEl.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            handlers.onDayDown(dateStr, dayEl, event);
        });
    }
    if (handlers.onDayEnter) {
        dayEl.addEventListener('pointerenter', () => handlers.onDayEnter(dateStr, dayEl));
    }

    updateDayUI(dayEl, dateStr);
    return dayEl;
}

/** Riallinea una singola cella allo stato corrente. */
export function updateDayUI(dayEl, dateStr) {
    const wasPreview = dayEl.classList.contains('range-preview');
    dayEl.classList.remove(...ALL_DAY_CLASSES);
    dayEl.querySelectorAll('.permesso-badge, .lock-badge, .flight-badge').forEach(el => el.remove());

    const marker = state.assignments[dateStr];
    const overlay = state.overlays[dateStr];

    if (marker) {
        dayEl.classList.add(marker);
        if (marker === 'permesso' && state.permessoHours[dateStr]) {
            dayEl.appendChild(badge('permesso-badge', `${state.permessoHours[dateStr]}h`));
        }
    }

    if (overlay) {
        dayEl.classList.add(overlay);
        dayEl.appendChild(badge('flight-badge', '✈'));
    }

    if (state.lockedDates[dateStr]) {
        dayEl.classList.add('locked-date');
        dayEl.appendChild(badge('lock-badge', '🔒'));
    }

    if (wasPreview) dayEl.classList.add('range-preview');
    dayEl.title = buildTooltip(dateStr, marker, overlay);
}

function badge(className, text) {
    const el = document.createElement('span');
    el.className = className;
    el.innerText = text;
    return el;
}

function buildTooltip(dateStr, marker, overlay) {
    const parts = [formatDateItalian(dateStr)];

    const holiday = holidayName(dateStr);
    if (holiday) parts.push(holiday);

    if (marker === 'permesso' && state.permessoHours[dateStr]) {
        parts.push(`Permesso ${state.permessoHours[dateStr]}h`);
    } else if (marker) {
        parts.push(MARKER_LABELS[marker]);
    }

    if (overlay) parts.push(`Volo ${legLabel(overlay, state.route)}`);
    if (state.lockedDates[dateStr]) parts.push('Bloccata');

    return parts.join(' · ');
}

export function dayElement(dateStr) {
    return document.querySelector(`.day[data-date="${dateStr}"]`);
}

export function refreshAllDays() {
    document.querySelectorAll('.day[data-date]').forEach(dayEl => {
        updateDayUI(dayEl, dayEl.getAttribute('data-date'));
    });
}

export function clearRangePreview() {
    document.querySelectorAll('.day.range-preview').forEach(el => el.classList.remove('range-preview'));
}

export function setRangePreview(dates) {
    clearRangePreview();
    for (const date of dates) {
        dayElement(date)?.classList.add('range-preview');
    }
}
