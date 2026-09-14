import { BASE_MARKERS, MARKER_LABELS, MONTH_NAMES } from './constants.js';
import { maxCount, pages, recalcCounts, setMaxCount, state, usedCount } from './state.js';

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
            if (!el.querySelector('input')) el.innerText = formatAmount(maxCount(type));
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
        // Il bersaglio è tutta la targhetta, non le poche cifre del totale:
        // sul telefono un numero di due caratteri è quasi impossibile da centrare.
        const target = el.closest('.marker-badge') || el;
        target.classList.add('editable-badge');
        target.tabIndex = 0;
        target.setAttribute('role', 'button');
        target.setAttribute('aria-label', `Modifica il totale di ${MARKER_LABELS[type] || type}`);

        // stopPropagation: la targhetta vive dentro la card dello strumento,
        // e senza questo un clic per modificare il totale lo selezionerebbe.
        const start = (event) => {
            event.stopPropagation();
            startEditingTotal(el, type, onChange);
        };
        target.addEventListener('click', start);
        target.addEventListener('keydown', (event) => {
            // L'Invio dato dentro il campo risale fin qui: senza questo
            // controllo chiuderebbe la modifica e la riaprirebbe subito.
            if (event.target !== target) return;
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            start(event);
        });
    });
}

function startEditingTotal(el, type, onChange) {
    if (el.querySelector('input')) return;

    const year = state.viewYear;
    const previous = maxCount(type, year);
    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    const decimals = type === 'permesso';
    input.step = decimals ? '0.5' : '1';
    // Sul telefono decide quale tastierino compare e cosa dice il tasto di invio.
    input.inputMode = decimals ? 'decimal' : 'numeric';
    input.enterKeyHint = 'done';
    input.value = previous;
    input.className = 'edit-total-input';

    const badge = el.closest('.marker-badge');
    badge?.classList.add('editing');
    el.replaceChildren(input);
    input.focus();
    input.select();

    let finished = false;
    function finish() {
        if (finished) return;
        finished = true;

        let value = parseFloat(input.value);
        if (!Number.isFinite(value) || value < 0) value = previous;

        // Un totale sotto quanto è già assegnato darebbe un residuo negativo.
        // Si ferma al minimo possibile invece di buttare via quanto digitato:
        // ritrovarsi il vecchio numero senza spiegazioni è peggio.
        const used = usedCount(type, year);
        if (value < used) {
            const unit = type === 'permesso' ? 'h' : '';
            showToast(`Totale fermato a ${used}${unit}: è quanto hai già assegnato.`, 'info');
            value = used;
        }

        badge?.classList.remove('editing');
        // Il campo va tolto prima di ridisegnare: updateCountsUI salta i totali
        // che contengono un input, e senza questo il numero non tornerebbe più.
        input.remove();
        setMaxCount(type, year, value);
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

// --- Modale nuovo calendario -------------------------------------------

const EMPTY_SOURCE = 'vuoto';
let resolveNewPage = null;

/**
 * Chiede nome e contenuto del nuovo calendario.
 * Risolve con { name, sourceId } (sourceId null = calendario vuoto)
 * oppure null se l'utente annulla.
 */
export function askNewPage(defaultName) {
    const modal = document.getElementById('new-page-modal');
    const nameInput = document.getElementById('new-page-name');
    const select = document.getElementById('new-page-source');
    if (!modal) return Promise.resolve(null);

    nameInput.value = defaultName;

    // L'id della prima pagina è '', quindi non può fare da valore "vuoto".
    select.replaceChildren();
    select.appendChild(option(EMPTY_SOURCE, 'Calendario vuoto'));
    for (const page of pages.list) {
        const label = page.id === pages.activeId ? `Copia di ${page.name} (attuale)` : `Copia di ${page.name}`;
        select.appendChild(option(`copia:${page.id}`, label));
    }
    select.value = EMPTY_SOURCE;

    modal.style.display = 'flex';
    nameInput.focus();
    nameInput.select();

    return new Promise(resolve => { resolveNewPage = resolve; });
}

function option(value, label) {
    const el = document.createElement('option');
    el.value = value;
    el.innerText = label;
    return el;
}

function closeNewPageModal(result) {
    const modal = document.getElementById('new-page-modal');
    if (modal) modal.style.display = 'none';
    const resolve = resolveNewPage;
    resolveNewPage = null;
    resolve?.(result);
}

export function initNewPageModal() {
    const modal = document.getElementById('new-page-modal');
    if (!modal) return;

    const nameInput = document.getElementById('new-page-name');
    const select = document.getElementById('new-page-source');

    const confirm = () => {
        const name = nameInput.value.trim();
        if (!name) {
            showToast('Dai un nome al calendario.');
            nameInput.focus();
            return;
        }
        const source = select.value;
        closeNewPageModal({
            name,
            sourceId: source === EMPTY_SOURCE ? null : source.slice('copia:'.length)
        });
    };

    document.getElementById('new-page-confirm').addEventListener('click', confirm);
    document.getElementById('new-page-cancel').addEventListener('click', () => closeNewPageModal(null));

    nameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') confirm();
    });

    modal.addEventListener('pointerdown', (event) => {
        if (event.target === modal) closeNewPageModal(null);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !resolveNewPage) return;
        // Il tasto è consumato dalla modale: senza questo l'handler globale
        // deselezionerebbe anche lo strumento attivo.
        event.stopImmediatePropagation();
        closeNewPageModal(null);
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
    const [year, month, day] = dateStr.split('-');
    return `Giorno ${parseInt(day, 10)} ${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
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
