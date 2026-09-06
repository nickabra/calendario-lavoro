# Calendario Lavoro

Calendario di turni, ferie e trasferte. Applicazione statica: nessun server da
gestire, tutti i dati vivono nel browser e — se attivi la sincronizzazione —
in un documento Firestore intestato al tuo account Google.

## Uso locale

```bash
npm install
npm run dev      # sviluppo
npm run build    # produce dist/index.html, un file unico apribile col doppio clic
```

`Avvia Calendario.bat` fa build e apre il risultato, senza rete.

## Pubblicazione (GitHub Pages, gratis)

1. Crea un repository **pubblico** su GitHub, per esempio `calendario-lavoro`.
   GitHub Pages è gratuito solo sui repository pubblici; il codice è visibile,
   i dati del calendario no, perché non stanno nel repository.
2. Collega il repository locale e invia il codice:

   ```bash
   git remote add origin https://github.com/TUO-UTENTE/calendario-lavoro.git
   git push -u origin master
   ```

3. Su GitHub apri **Settings → Pages** e imposta *Source* su **GitHub Actions**.
4. Il workflow `.github/workflows/deploy.yml` fa la build a ogni push su
   `master` e pubblica su `https://TUO-UTENTE.github.io/calendario-lavoro/`.

Sul telefono apri quell'indirizzo e usa "Aggiungi a schermata Home": il
calendario si comporta come un'app, a schermo intero.

## Sincronizzazione fra dispositivi (Firebase, piano gratuito)

Finché `src/firebase-config.js` contiene i valori segnaposto la
sincronizzazione resta spenta e l'app funziona solo in locale, come prima.
Per attivarla:

1. Vai su <https://console.firebase.google.com>, **Aggiungi progetto**. Puoi
   disattivare Google Analytics, non serve.
2. **Build → Authentication → Get started**, abilita il provider **Google**.
3. In **Authentication → Settings → Authorized domains** aggiungi
   `TUO-UTENTE.github.io`, altrimenti il login dal sito pubblicato viene
   rifiutato.
4. **Build → Firestore Database → Crea database**, modalità di produzione,
   area geografica `eur3` (Europa).
5. Nella scheda **Regole** incolla il contenuto di `firestore.rules` di questo
   repository e pubblica. Sono le regole che impediscono a chiunque altro di
   leggere il tuo calendario.
6. **Impostazioni progetto → Le tue app → Web (`</>`)**: registra un'app e
   copia i valori `apiKey`, `authDomain`, `projectId`, `appId` dentro
   `src/firebase-config.js`.
7. Fai commit e push: il sito si ricostruisce da solo e il pulsante
   **☁️ Accedi** compare nell'intestazione.

Questi quattro valori sono pubblici per definizione: identificano il progetto,
non autorizzano nulla. La protezione sta nelle regole del punto 5.

### Come funziona

Tutto lo stato del calendario è già in `localStorage` sotto chiavi `calendar_*`.
La sincronizzazione copia quel blocco di chiavi in un unico documento
`calendars/{uid}` di Firestore, con la marca temporale dell'ultima scrittura.
Le modifiche partono un secondo e mezzo dopo l'ultima azione; i dati vengono
riletti all'apertura e ogni volta che torni sulla scheda.

Se lo stesso calendario è stato modificato su due dispositivi senza passare dal
cloud, l'app chiede quale versione tenere invece di sceglierne una in silenzio.

### Costi

Il piano Spark di Firebase è gratuito e senza scadenza: 50.000 letture e 20.000
scritture al giorno, contro le poche decine che serve a un uso personale.
Nessuna carta di credito, nessuna sospensione per inattività.

## Rete di sicurezza

I pulsanti **💾 Backup** e **📂 Importa** esportano e rileggono un file JSON.
Restano utili: sono l'unica copia che non dipende né dal browser né da Firebase.
