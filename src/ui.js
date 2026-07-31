import { BASE_MARKERS, MONTH_NAMES } from './constants.js';
import { recalcCounts, state, usedCount } from './state.js';

let toastTimer = null;

export function showToast(message, variant = 'error') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.innerText = message;
    toast.className = `toast show ${variant}`;

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 4000);
}

/** Aggiorna tutti i contatori, sia in dashboard sia nel riepilogo di stampa. */
export function updateCountsUI() {
    for (const type of BASE_MARKERS) {
        document.querySelectorAll(`[data-count="${type}"]`).forEach(el => {
            el.innerText = formatAmount(state.currentCounts[type]);
        });
        document.querySelectorAll(`[data-total="${type}"]`).forEach(el => {
            // Non toccare un totale mentre lo si sta modificando.
            if (!el.querySelector('input')) el.innerText = formatAmount(state.maxCounts[type]);
        });
    }
}

function formatAmount(value) {
    return Number.isInteger(value) ? String(value) : String(value);
}

// --- Totali modificabili -----------------------------------------------

export function initEditableTotals(onChange) {
    document.querySelectorAll('.editable-total[data-total]').forEach(el => {
        const type = el.getAttribute('data-total');
        // stopPropagation: la matita vive dentro la card dello strumento,
        // e senza questo un clic per modificare il totale lo selezionerebbe.
        const start = (event) => {
            event.stopPropagation();
            startEditingTotal(el, type, onChange);
        };
        el.addEventListener('click', start);
        document.querySelector(`[data-edit="${type}"]`)?.addEventListener('click', start);
    });
}

function startEditingTotal(el, type, onChange) {
    if (el.querySelector('input')) return;

    const previous = state.maxCounts[type];
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = type === 'permesso' ? '0.5' : '1';
    input.value = previous;
    input.className = 'edit-total-input';

    el.replaceChildren(input);
    input.focus();
    input.select();

    let finished = false;
    function finish() {
        if (finished) return;
        finished = true;

        let value = parseFloat(input.value);
        if (!Number.isFinite(value) || value < 0) value = previous;

        // Abbassare il totale sotto quanto è già assegnato produrrebbe un
        // residuo negativo: meglio rifiutare e dire perché.
        const used = usedCount(type);
        if (value < used) {
            const unit = type === 'permesso' ? 'h' : '';
            showToast(
                `Non puoi scendere sotto ${used}${unit}: è quanto hai già assegnato. Libera prima qualche giorno.`,
                'error'
            );
            value = previous;
        }

        state.maxCounts[type] = value;
        recalcCounts();
        onChange();
    }

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            input.blur();
        } else if (event.key === 'Escape') {
            input.value = previous;
            input.blur();
        }
    });
}

// --- Modale permessi ---------------------------------------------------

const PRESET_HOURS = [1, 2, 3, 4, 6, 8];
let resolveModal = null;
let selectedHours = 2;

/**
 * Chiede le ore di permesso. Risolve con { hours }, { remove: true }
 * oppure null se l'utente annulla.
 */
export function askPermessoHours({ dates, existingHours }) {
    const modal = document.getElementById('permesso-modal');
    const subtitle = document.getElementById('permesso-modal-date');
    const deleteBtn = document.getElementById('permesso-modal-delete');
    const customInput = document.getElementById('custom-hours-num');

    subtitle.innerText = dates.length === 1
        ? describeDay(dates[0])
        : `${dates.length} giorni selezionati · le ore valgono per ciascuno`;

    deleteBtn.style.display = existingHours ? 'inline-block' : 'none';
    selectedHours = existingHours || 2;

    modal.querySelectorAll('.hour-btn').forEach(btn => {
        btn.classList.toggle('selected', parseFloat(btn.dataset.hours) === selectedHours);
    });
    customInput.value = PRESET_HOURS.includes(selectedHours) ? '' : selectedHours;

    modal.style.display = 'flex';

    return new Promise(resolve => { resolveModal = resolve; });
}

function describeDay(dateStr) {
    const [, month, day] = dateStr.split('-');
    return `Giorno ${parseInt(day, 10)} ${MONTH_NAMES[parseInt(month, 10) - 1]} 2026`;
}

function closeModal(result) {
    const modal = document.getElementById('permesso-modal');
    if (modal) modal.style.display = 'none';
    const resolve = resolveModal;
    resolveModal = null;
    resolve?.(result);
}

export function initPermessoModal() {
    const modal = document.getElementById('permesso-modal');
    if (!modal) return;

    const hourBtns = modal.querySelectorAll('.hour-btn');
    const customInput = document.getElementById('custom-hours-num');

    hourBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedHours = parseFloat(btn.dataset.hours);
            hourBtns.forEach(b => b.classList.toggle('selected', b === btn));
            customInput.value = '';
        });
    });

    customInput.addEventListener('input', () => {
        const value = parseFloat(customInput.value);
        if (Number.isFinite(value) && value > 0) {
            selectedHours = value;
            hourBtns.forEach(b => b.classList.remove('selected'));
        }
    });

    document.getElementById('permesso-modal-cancel').addEventListener('click', () => closeModal(null));
    document.getElementById('permesso-modal-delete').addEventListener('click', () => closeModal({ remove: true }));
    document.getElementById('permesso-modal-confirm').addEventListener('click', () => {
        if (!Number.isFinite(selectedHours) || selectedHours <= 0) {
            showToast('Inserisci un numero di ore valido.');
            return;
        }
        closeModal({ hours: selectedHours });
    });

    // Chiusura cliccando fuori o con Esc: annulla, non conferma.
    modal.addEventListener('pointerdown', (event) => {
        if (event.target === modal) closeModal(null);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !resolveModal) return;
        // Il tasto è consumato dalla modale: senza questo, l'handler globale
        // della tastiera lo riceverebbe comunque e deselezionerebbe lo strumento.
        event.stopImmediatePropagation();
        closeModal(null);
    });
}
