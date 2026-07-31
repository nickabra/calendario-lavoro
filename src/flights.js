import { shiftDate } from './state.js';

/** "2026-09-14" -> "260914", il formato che Skyscanner usa nel path. */
function compactDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${y.slice(2)}${m}${d}`;
}

/** Da quale capo della rotta parte un overlay. */
export function legEndpoints(overlayType, route) {
    return overlayType === 'ct-mi'
        ? { from: route.home, to: route.work }
        : { from: route.work, to: route.home };
}

export function legLabel(overlayType, route) {
    const { from, to } = legEndpoints(overlayType, route);
    return `${from} → ${to}`;
}

/**
 * Link di ricerca precompilati. Se `returnDate` c'è, cerca andata e ritorno,
 * che di solito costa meno di due biglietti di sola andata.
 *
 * I formati URL dei tre siti cambiano nel tempo: se un link smette di
 * funzionare, è questa l'unica funzione da correggere.
 */
export function buildFlightLinks(from, to, departDate, returnDate = null) {
    const googleQuery = returnDate
        ? `Flights from ${from} to ${to} on ${departDate} through ${returnDate}`
        : `Flights from ${from} to ${to} on ${departDate} oneway`;

    const skyscannerDates = returnDate
        ? `${compactDate(departDate)}/${compactDate(returnDate)}`
        : compactDate(departDate);

    const kayakDates = returnDate ? `${departDate}/${returnDate}` : departDate;

    return [
        {
            id: 'google',
            label: 'Google Flights',
            url: `https://www.google.com/travel/flights?hl=it&curr=EUR&q=${encodeURIComponent(googleQuery)}`
        },
        {
            id: 'skyscanner',
            label: 'Skyscanner',
            url: `https://www.skyscanner.it/trasporti/voli/${from.toLowerCase()}/${to.toLowerCase()}/${skyscannerDates}/`
        },
        {
            id: 'kayak',
            label: 'Kayak',
            url: `https://www.kayak.it/flights/${from}-${to}/${kayakDates}`
        }
    ];
}

/**
 * Le stesse ricerche sul giorno prima e dopo: spostarsi di 24 ore
 * è spesso la differenza fra un biglietto caro e uno no.
 */
export function buildFlexibleLinks(from, to, departDate) {
    return [-1, 1].map(offset => {
        const date = shiftDate(departDate, offset);
        return {
            offset,
            date,
            label: offset < 0 ? 'Giorno prima' : 'Giorno dopo',
            links: buildFlightLinks(from, to, date)
        };
    });
}
