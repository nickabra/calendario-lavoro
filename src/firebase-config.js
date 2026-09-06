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
    apiKey: 'AIzaSyBUowV1JEGpPqCCq-YbC5dKIGi1E-YLmwA',
    authDomain: 'calendario-lavoro-513df.firebaseapp.com',
    projectId: 'calendario-lavoro-513df',
    appId: '1:981550725101:web:c9b4347eecc24f741099e4'
};
