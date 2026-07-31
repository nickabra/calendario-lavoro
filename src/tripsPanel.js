import { buildFlexibleLinks, buildFlightLinks, legEndpoints, legLabel } from './flights.js';
import { formatDateItalian, saveState, state } from './state.js';
import { computeTrips, tripIssueLabel } from './trips.js';
import { showToast } from './ui.js';

const AIRPORT_PATTERN = /^[A-Za-z]{3}$/;

function shortDate(dateStr) {
    const [, month, day] = dateStr.split('-');
    return `${parseInt(day, 10)}/${parseInt(month, 10)}`;
}

function linkButton({ label, url }, extraClass = '') {
    const a = document.createElement('a');
    a.className = `flight-link ${extraClass}`.trim();
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerText = label;
    return a;
}

function linkRow(labelText, links, extraClass = '') {
    const row = document.createElement('div');
    row.className = 'flight-link-row';

    const label = document.createElement('span');
    label.className = 'flight-link-label';
    label.innerText = labelText;
    row.appendChild(label);

    for (const link of links) row.appendChild(linkButton(link, extraClass));
    return row;
}

// --- Pannello viaggi ---------------------------------------------------

export function syncRouteInputs() {
    const homeInput = document.getElementById('route-home');
    const workInput = document.getElementById('route-work');
    if (homeInput) homeInput.value = state.route.home;
    if (workInput) workInput.value = state.route.work;
}

export function initTripsPanel(onRouteChange) {
    const homeInput = document.getElementById('route-home');
    const workInput = document.getElementById('route-work');
    if (!homeInput || !workInput) return;

    syncRouteInputs();

    const commit = (input, key) => {
        const value = input.value.trim().toUpperCase();
        if (!AIRPORT_PATTERN.test(value)) {
            showToast('Il codice aeroporto deve avere 3 lettere (es. CTA, MXP, LIN, MIL).');
            input.value = state.route[key];
            return;
        }
        state.route[key] = value;
        input.value = value;
        saveState();
        onRouteChange();
    };

    homeInput.addEventListener('change', () => commit(homeInput, 'home'));
    workInput.addEventListener('change', () => commit(workInput, 'work'));
}

export function renderTripsPanel() {
    const list = document.getElementById('trips-list');
    const summary = document.getElementById('trips-summary');
    if (!list) return;

    const trips = computeTrips(state.overlays);
    list.replaceChildren();

    if (trips.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'trips-empty';
        empty.innerText = `Segna un giorno con ${legLabel('ct-mi', state.route)} o ${legLabel('mi-ct', state.route)} e qui compariranno i viaggi, con i link di ricerca già compilati.`;
        list.appendChild(empty);
        summary.innerText = '';
        return;
    }

    const incomplete = trips.filter(t => t.issue).length;
    const count = `${trips.length} ${trips.length === 1 ? 'viaggio' : 'viaggi'}`;
    summary.innerText = incomplete ? `${count} · ${incomplete} da completare` : count;

    for (const trip of trips) list.appendChild(renderTrip(trip));
}

function renderTrip(trip) {
    const el = document.createElement('div');
    el.className = trip.issue ? 'trip trip-incomplete' : 'trip';

    const header = document.createElement('div');
    header.className = 'trip-header';

    const route = document.createElement('span');
    route.className = 'trip-route';
    const shownLeg = trip.outbound || trip.return;
    route.innerText = legLabel(shownLeg.type, state.route);
    header.appendChild(route);

    const dates = document.createElement('span');
    dates.className = 'trip-dates';
    if (trip.outbound && trip.return) {
        const nights = trip.nights === 1 ? '1 notte' : `${trip.nights} notti`;
        dates.innerText = `${shortDate(trip.outbound.date)} → ${shortDate(trip.return.date)} · ${nights}`;
    } else {
        dates.innerText = formatDateItalian(shownLeg.date);
    }
    header.appendChild(dates);

    if (trip.issue) {
        const warning = document.createElement('span');
        warning.className = 'trip-warning';
        warning.innerText = `⚠ ${tripIssueLabel(trip.issue)}`;
        header.appendChild(warning);
    }

    el.appendChild(header);

    // Viaggio completo: il biglietto A/R di solito costa meno di due one-way.
    if (trip.outbound && trip.return) {
        const { from, to } = legEndpoints(trip.outbound.type, state.route);
        el.appendChild(linkRow(
            'Andata e ritorno',
            buildFlightLinks(from, to, trip.outbound.date, trip.return.date),
            'primary'
        ));
    }

    for (const leg of [trip.outbound, trip.return]) {
        if (!leg) continue;
        const { from, to } = legEndpoints(leg.type, state.route);
        el.appendChild(linkRow(
            `Solo andata ${from}→${to} ${shortDate(leg.date)}`,
            buildFlightLinks(from, to, leg.date)
        ));
    }

    return el;
}

// --- Popover sui giorni con volo ---------------------------------------

let popover = null;

export function closeFlightPopover() {
    popover?.remove();
    popover = null;
}

export function openFlightPopover(dateStr, anchorEl) {
    closeFlightPopover();

    const overlayType = state.overlays[dateStr];
    if (!overlayType) return;

    const { from, to } = legEndpoints(overlayType, state.route);

    popover = document.createElement('div');
    popover.className = 'flight-popover';

    const title = document.createElement('div');
    title.className = 'flight-popover-title';
    title.innerText = `${from} → ${to} · ${formatDateItalian(dateStr)}`;
    popover.appendChild(title);

    popover.appendChild(linkRow('Cerca voli', buildFlightLinks(from, to, dateStr), 'primary'));

    const flexNote = document.createElement('div');
    flexNote.className = 'flight-popover-note';
    flexNote.innerText = 'Spesso costa meno spostandosi di un giorno:';
    popover.appendChild(flexNote);

    for (const alt of buildFlexibleLinks(from, to, dateStr)) {
        popover.appendChild(linkRow(`${alt.label} (${shortDate(alt.date)})`, alt.links));
    }

    document.body.appendChild(popover);
    positionPopover(anchorEl);

    // Un clic fuori chiude; i clic sui link dentro il popover restano validi.
    setTimeout(() => {
        document.addEventListener('pointerdown', onOutsidePointer, { once: true });
    }, 0);
}

function onOutsidePointer(event) {
    if (popover && popover.contains(event.target)) {
        document.addEventListener('pointerdown', onOutsidePointer, { once: true });
        return;
    }
    closeFlightPopover();
}

function positionPopover(anchorEl) {
    const anchor = anchorEl.getBoundingClientRect();
    const box = popover.getBoundingClientRect();
    const margin = 8;

    let left = anchor.left + anchor.width / 2 - box.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));

    let top = anchor.bottom + margin;
    if (top + box.height > window.innerHeight - margin) {
        top = Math.max(margin, anchor.top - box.height - margin);
    }

    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
}
