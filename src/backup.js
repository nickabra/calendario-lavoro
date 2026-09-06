import { STATE_VERSION } from './constants.js';
import { applyImportedState, resetState, saveState } from './state.js';
import { collectLocalData, markLocalChange, writeLocalData } from './sync.js';
import { showToast } from './ui.js';

function todayStamp() {
    return new Date().toISOString().slice(0, 10);
}

function downloadJSON(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Backup di tutti i calendari, non solo di quello aperto.
 *
 * Serve anche a spostare i dati fra due indirizzi diversi — il file aperto dal
 * disco e il sito pubblicato — che il browser tiene in archivi separati.
 */
function fullBackup() {
    saveState();
    return {
        version: STATE_VERSION,
        kind: 'full',
        exportedAt: new Date().toISOString(),
        storage: collectLocalData()
    };
}

/** Sostituisce ogni calendario presente con quelli del file. */
function importFull(payload) {
    if (typeof payload.version !== 'number') {
        throw new Error('Il file non sembra un backup valido: manca il numero di versione.');
    }
    if (payload.version > STATE_VERSION) {
        throw new Error(`Backup creato con una versione più recente dell'app (v${payload.version}). Aggiorna l'app prima di importarlo.`);
    }
    const storage = payload.storage;
    if (!storage || typeof storage !== 'object' || Array.isArray(storage)) {
        throw new Error('Il backup non contiene i dati dei calendari.');
    }
    writeLocalData(storage);
}

/**
 * Export, import e reset dello stato. È l'unica rete di sicurezza contro
 * la cancellazione dei dati del browser: il calendario vive solo lì.
 */
export function initBackup(onStateReplaced) {
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
        downloadJSON(fullBackup(), `calendari-backup-${todayStamp()}.json`);
        showToast('Backup di tutti i calendari scaricato.', 'success');
    });

    const fileInput = document.getElementById('import-file');
    document.getElementById('btn-import-json')?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        try {
            const payload = JSON.parse(await file.text());
            // I backup precedenti contenevano una sola pagina: restano importabili.
            if (payload?.kind === 'full') importFull(payload);
            else applyImportedState(payload);
            onStateReplaced();
            // Un import è una modifica locale a tutti gli effetti: va mandato al cloud.
            markLocalChange();
            showToast('Backup importato.', 'success');
        } catch (err) {
            showToast(err instanceof SyntaxError ? 'Il file non è un JSON leggibile.' : err.message);
        } finally {
            // Permette di reimportare lo stesso file due volte di seguito.
            fileInput.value = '';
        }
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
        const confirmed = window.confirm(
            'Cancellare tutte le assegnazioni, i voli e le date bloccate di questo calendario?\n\n' +
            'Non è reversibile. Se non hai un backup, annulla ed esportalo prima.'
        );
        if (!confirmed) return;

        resetState();
        onStateReplaced();
        showToast('Calendario azzerato.', 'info');
    });
}
