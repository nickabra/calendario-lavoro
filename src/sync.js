import { firebaseConfig } from './firebase-config.js';
import { showToast } from './ui.js';

/**
 * Sincronizzazione del calendario fra dispositivi.
 *
 * Il calendario vive già interamente in localStorage sotto chiavi `calendar_*`.
 * Invece di sincronizzare stato per stato, questo modulo copia l'intero blocco
 * di chiavi come un unico documento Firestore: nessuna logica di merge da
 * mantenere allineata ai moduli, e le pagine multiple viaggiano insieme.
 *
 * L'SDK Firebase viene caricato dalla CDN con un import dinamico, così il file
 * unico prodotto dalla build resta apribile anche offline: senza rete la
 * sincronizzazione non parte e l'app continua a funzionare in locale.
 */

const CDN = 'https://www.gstatic.com/firebasejs/11.6.0';
const PREFIX = 'calendar_';
// Chiavi locali che non vanno sincronizzate: due sono i marcatori temporali di
// questo modulo, poi la copia di sicurezza pre-migrazione e l'anno mostrato,
// che è una scelta di ciascun dispositivo.
const NOT_SYNCED = new Set(['calendar_snapshot_v0', 'calendar_local_at', 'calendar_sync_at', 'calendar_view_year']);
const LOCAL_AT = 'calendar_local_at';
const SYNC_AT = 'calendar_sync_at';
const PUSH_DELAY_MS = 1500;

let db = null;
let auth = null;
let firestore = null;
let user = null;
let onRemoteState = () => {};
let pushTimer = null;

export function isSyncConfigured() {
    return !firebaseConfig.apiKey.startsWith('INCOLLA');
}

function timestamp(key) {
    return Number(localStorage.getItem(key)) || 0;
}

/** Registra che ci sono modifiche locali non ancora inviate. */
export function markLocalChange() {
    localStorage.setItem(LOCAL_AT, String(Date.now()));
    if (user) schedulePush();
}

export function collectLocalData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(PREFIX) && !NOT_SYNCED.has(key)) data[key] = localStorage.getItem(key);
    }
    return data;
}

export function writeLocalData(data) {
    // Le chiavi assenti dal documento remoto vanno rimosse, altrimenti una
    // pagina eliminata su un dispositivo resterebbe viva sugli altri.
    for (const key of Object.keys(collectLocalData())) {
        if (!(key in data)) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') localStorage.setItem(key, value);
    }
}

function docRef() {
    return firestore.doc(db, 'calendars', user.uid);
}

async function push() {
    if (!user) return;
    const updatedAt = Date.now();
    try {
        await firestore.setDoc(docRef(), { data: collectLocalData(), updatedAt });
        localStorage.setItem(SYNC_AT, String(updatedAt));
        setStatus('☁️ Sincronizzato');
    } catch (err) {
        console.error('Invio al cloud fallito.', err);
        setStatus('☁️ Errore di invio');
    }
}

function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, PUSH_DELAY_MS);
}

/**
 * Allinea il dispositivo al cloud. Se entrambi i lati sono cambiati dall'ultima
 * sincronizzazione la scelta è dell'utente: sovrascrivere in silenzio farebbe
 * sparire lavoro senza avviso.
 */
async function pull() {
    if (!user) return;

    let snapshot;
    try {
        snapshot = await firestore.getDoc(docRef());
    } catch (err) {
        console.error('Lettura dal cloud fallita.', err);
        setStatus('☁️ Errore di lettura');
        return;
    }

    const localAt = timestamp(LOCAL_AT);
    const syncAt = timestamp(SYNC_AT);
    const remote = snapshot.exists() ? snapshot.data() : null;

    if (!remote || !remote.data) {
        await push();
        return;
    }
    if (remote.updatedAt <= syncAt) {
        if (localAt > syncAt) await push();
        else setStatus('☁️ Sincronizzato');
        return;
    }

    const localChanged = localAt > syncAt;
    if (localChanged) {
        const keepRemote = window.confirm(
            'Su un altro dispositivo il calendario è stato modificato, ma anche qui ci sono modifiche non ancora inviate.\n\n' +
            'OK = tieni la versione del cloud (le modifiche fatte qui vanno perse).\n' +
            'Annulla = tieni questa versione e sovrascrivi il cloud.'
        );
        if (!keepRemote) {
            await push();
            return;
        }
    }

    writeLocalData(remote.data);
    localStorage.setItem(SYNC_AT, String(remote.updatedAt));
    localStorage.setItem(LOCAL_AT, String(remote.updatedAt));
    onRemoteState();
    setStatus('☁️ Sincronizzato');
    showToast('Calendario aggiornato dal cloud.', 'success');
}

function setStatus(text) {
    const button = document.getElementById('btn-sync');
    if (button) button.textContent = text;
}

async function signIn() {
    const provider = new auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(auth.instance, provider);
    } catch (err) {
        // Molti browser mobili bloccano le finestre popup: il redirect è
        // l'unica strada che funziona sul telefono.
        if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
            await auth.signInWithRedirect(auth.instance, provider);
            return;
        }
        console.error('Login fallito.', err);
        showToast('Login non riuscito.');
    }
}

/** @param {() => void} onStateReplaced richiamata quando arrivano dati dal cloud */
export async function initSync(onStateReplaced) {
    const button = document.getElementById('btn-sync');
    if (!isSyncConfigured()) {
        button?.remove();
        return;
    }

    onRemoteState = onStateReplaced;
    setStatus('☁️ Connessione…');

    let appModule, authModule;
    try {
        [appModule, authModule, firestore] = await Promise.all([
            import(/* @vite-ignore */ `${CDN}/firebase-app.js`),
            import(/* @vite-ignore */ `${CDN}/firebase-auth.js`),
            import(/* @vite-ignore */ `${CDN}/firebase-firestore.js`)
        ]);
    } catch (err) {
        console.error('Firebase non raggiungibile, sincronizzazione disattivata.', err);
        setStatus('☁️ Offline');
        return;
    }

    const app = appModule.initializeApp(firebaseConfig);
    db = firestore.getFirestore(app);
    auth = { ...authModule, instance: authModule.getAuth(app) };

    button?.addEventListener('click', () => {
        if (user) auth.signOut(auth.instance);
        else signIn();
    });

    auth.onAuthStateChanged(auth.instance, current => {
        user = current;
        if (!user) {
            setStatus('☁️ Accedi');
            return;
        }
        pull();
    });

    // Rientrando sull'app dopo averla usata altrove, riallinea subito.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && user) pull();
    });
}
