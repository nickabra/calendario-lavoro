import { MARKER_LABELS, MAX_CONSECUTIVE_SW, MONTHLY_LIMITS } from './constants.js';
import { formatDateItalian, state } from './state.js';

const ok = { ok: true };
const ko = (message) => ({ ok: false, message });

/**
 * Verifica se assegnare `marker` a `dateStr` rispetta i vincoli contrattuali.
 * `assignments` permette di validare una selezione multipla in modo incrementale,
 * passando la mappa via via aggiornata invece dello stato salvato.
 */
export function validateAssignment(dateStr, marker, assignments = state.assignments) {
    const candidate = { ...assignments, [dateStr]: marker };

    const monthlyCheck = checkMonthlyLimit(dateStr, marker, candidate);
    if (!monthlyCheck.ok) return monthlyCheck;

    return checkSmartworkingStreak(candidate);
}

function checkMonthlyLimit(dateStr, marker, candidate) {
    const limit = MONTHLY_LIMITS[marker];
    if (!limit) return ok;

    const monthPrefix = dateStr.slice(0, 7);
    let count = 0;
    for (const date in candidate) {
        if (date.startsWith(monthPrefix) && candidate[date] === marker) count++;
    }

    if (count > limit) {
        return ko(`Limite superato: massimo ${limit} giorni di ${MARKER_LABELS[marker].toUpperCase()} al mese.`);
    }
    return ok;
}

/**
 * Dopo 10 smartworking consecutivi serve un rientro in presenza.
 * Ferie e missione non interrompono la serie: rimandano soltanto il rientro.
 */
function checkSmartworkingStreak(candidate) {
    let streak = 0;
    let rientroDovuto = false;

    for (const date of state.workingDays) {
        const type = candidate[date];

        if (type === 'smartworking') {
            if (rientroDovuto) {
                return ko(
                    `Il ${formatDateItalian(date)} viola la regola del rientro: dopo ${MAX_CONSECUTIVE_SW} ` +
                    `smartworking consecutivi serve almeno un giorno in presenza.`
                );
            }
            streak++;
            if (streak >= MAX_CONSECUTIVE_SW) rientroDovuto = true;
        } else if (type === 'ferie' || type === 'missione') {
            if (streak < MAX_CONSECUTIVE_SW) {
                streak = 0;
                rientroDovuto = false;
            }
        } else {
            streak = 0;
            rientroDovuto = false;
        }
    }

    return ok;
}
