import { dateRange } from './state.js';

/**
 * Trasforma gli overlay sparsi sul calendario in una lista di viaggi.
 * Ogni ct-mi viene accoppiato con il primo mi-ct successivo; quello che
 * resta spaiato viene segnalato invece di essere ignorato in silenzio.
 */
export function computeTrips(overlays) {
    const legs = Object.keys(overlays)
        .sort()
        .map(date => ({ date, type: overlays[date] }));

    const trips = [];
    let pendingOutbound = null;

    for (const leg of legs) {
        if (leg.type === 'ct-mi') {
            // Una seconda partenza senza ritorno chiude la precedente come incompleta.
            if (pendingOutbound) trips.push(makeTrip(pendingOutbound, null));
            pendingOutbound = leg;
        } else {
            trips.push(makeTrip(pendingOutbound, leg));
            pendingOutbound = null;
        }
    }

    if (pendingOutbound) trips.push(makeTrip(pendingOutbound, null));

    return trips;
}

function makeTrip(outbound, back) {
    const nights = outbound && back ? dateRange(outbound.date, back.date).length - 1 : null;

    let issue = null;
    if (!back) issue = 'ritorno-mancante';
    else if (!outbound) issue = 'andata-mancante';

    return { outbound, return: back, nights, issue };
}

export function tripIssueLabel(issue) {
    if (issue === 'ritorno-mancante') return 'Ritorno non ancora segnato';
    if (issue === 'andata-mancante') return 'Andata non ancora segnata';
    return null;
}
