import { activePage, applyImportedState, resetState, serializeState } from './state.js';
import { showToast } from './ui.js';

/** Nome file leggibile: senza questo i backup di pagine diverse si sovrascrivono. */
function slug(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'calendario';
}

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
 * Export, import e reset dello stato. È l'unica rete di sicurezza contro
 * la cancellazione dei dati del browser: il calendario vive solo lì.
 */
export function initBackup(onStateReplaced) {
    document.getElementById('btn-export-json')?.addEventListener('click', () => {
        downloadJSON(serializeState(), `${slug(activePage().name)}-backup-${todayStamp()}.json`);
        showToast('Backup scaricato. Tienilo fuori dal browser.', 'success');
    });

    const fileInput = document.getElementById('import-file');
    document.getElementById('btn-import-json')?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        try {
            const payload = JSON.parse(await file.text());
            applyImportedState(payload);
            onStateReplaced();
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
            'Cancellare tutte le assegnazioni, i voli e le date bloccate?\n\n' +
            'Non è reversibile. Se non hai un backup, annulla ed esportalo prima.'
        );
        if (!confirmed) return;

        resetState();
        onStateReplaced();
        showToast('Calendario azzerato.', 'info');
    });
}
