/**
 * Configurazione del progetto Firebase usato per la sincronizzazione.
 *
 * Questi valori sono pubblici per progetto: identificano il progetto, non
 * autorizzano nulla. La protezione dei dati sta nelle regole di sicurezza di
 * Firestore, che vincolano ogni documento all'utente che ha fatto il login.
 * Vedi README.md per la procedura di creazione del progetto.
 *
 * Finché apiKey resta il valore segnaposto, la sincronizzazione resta spenta
 * e l'app funziona esattamente come prima, solo in locale.
 */
export const firebaseConfig = {
    apiKey: 'INCOLLA_QUI_LA_TUA_API_KEY',
    authDomain: 'PROGETTO.firebaseapp.com',
    projectId: 'PROGETTO',
    appId: 'INCOLLA_QUI_IL_TUO_APP_ID'
};
