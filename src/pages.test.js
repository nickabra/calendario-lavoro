// node --test src/pages.test.js
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
};

const { addPage, deletePage, loadState, pages, saveState, state, switchPage } = await import('./state.js');

test('le pagine di calendario restano indipendenti', () => {
    loadState();
    state.assignments['2026-08-03'] = 'ferie';
    saveState();

    const second = addPage('Seconda');
    assert.deepEqual(state.assignments, {}, 'la pagina nuova parte vuota');
    state.assignments['2026-08-04'] = 'missione';
    state.maxCounts.ferie = 3;
    saveState();

    switchPage('');
    assert.deepEqual(state.assignments, { '2026-08-03': 'ferie' });
    assert.equal(state.maxCounts.ferie, 10, 'i totali non passano da una pagina all altra');
    assert.ok(store.has('calendar_assignments'), 'la prima pagina usa ancora le chiavi storiche');

    switchPage(second.id);
    assert.deepEqual(state.assignments, { '2026-08-04': 'missione' });
    assert.equal(state.maxCounts.ferie, 3);

    deletePage(second.id);
    assert.equal(pages.activeId, '');
    assert.deepEqual(state.assignments, { '2026-08-03': 'ferie' });
    assert.ok(!store.has(`calendar_assignments:${second.id}`), 'i dati della pagina eliminata spariscono');
});

test('duplicare un calendario copia i dati senza legarli all originale', () => {
    // Stato lasciato dal test precedente: una sola pagina, ferie il 3 agosto.
    assert.deepEqual(pages.list.map(page => page.id), ['']);
    state.overlays['2026-08-10'] = 'ct-mi';
    state.maxCounts.ferie = 7;
    saveState();

    const copy = addPage('Copia', '');
    assert.deepEqual(state.assignments, { '2026-08-03': 'ferie' }, 'la copia parte con gli stessi giorni');
    assert.deepEqual(state.overlays, { '2026-08-10': 'ct-mi' }, 'la copia porta anche i voli');
    assert.equal(state.maxCounts.ferie, 7, 'la copia porta anche i totali');

    delete state.assignments['2026-08-03'];
    state.assignments['2026-09-01'] = 'missione';
    saveState();

    switchPage('');
    assert.deepEqual(state.assignments, { '2026-08-03': 'ferie' }, 'modificare la copia non tocca l originale');

    switchPage(copy.id);
    assert.deepEqual(state.assignments, { '2026-09-01': 'missione' });

    const empty = addPage('Vuoto', null);
    assert.notEqual(empty.id, copy.id, 'gli id restano unici anche creando due pagine di seguito');
    assert.deepEqual(state.assignments, {}, 'la pagina vuota non eredita niente');
    assert.deepEqual(state.overlays, {});
    assert.equal(state.maxCounts.ferie, 10);
});

test('i buoni pasto contano presenze, spese e giorni doppi', async () => {
    const { computeMeals } = await import('./meals.js');
    const empty = addPage('Buoni', null);
    assert.ok(empty.id);

    // Calendario vuoto: ogni giorno feriale è ufficio, quindi matura e spende.
    // Resta la dotazione iniziale meno la media dei giorni doppi.
    const base = computeMeals({ ...state.mealVouchers, doublePerMonth: 0 });
    assert.equal(base.final, 35, 'senza giorni doppi il saldo non si muove');
    assert.equal(base.months.length, 4, 'si contano settembre, ottobre, novembre e dicembre');
    assert.deepEqual(base.months.map(m => m.earned), base.months.map(m => m.spent));

    const withDoubles = computeMeals({ ...state.mealVouchers, doublePerMonth: 1.5 });
    assert.equal(withDoubles.final, 35 - 6, '1,5 doppi per 4 mesi');

    // Una settimana di ferie: non matura e non spende, il saldo non cambia.
    for (const date of ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']) {
        state.assignments[date] = 'ferie';
    }
    const withFerie = computeMeals({ ...state.mealVouchers, doublePerMonth: 0 });
    assert.equal(withFerie.final, 35);
    assert.equal(withFerie.months[0].spent, base.months[0].spent - 5);

    // Missione: spende zero e matura solo se l'utente lo attiva.
    state.assignments['2026-09-14'] = 'missione';
    const senzaMissione = computeMeals({ ...state.mealVouchers, doublePerMonth: 0, missione: false });
    const conMissione = computeMeals({ ...state.mealVouchers, doublePerMonth: 0, missione: true });
    assert.equal(senzaMissione.final, 35, 'in missione non maturi ma nemmeno spendi: saldo fermo');
    assert.equal(conMissione.final, 36, 'se la missione matura, quel buono resta in tasca');

    // Permesso di 2h: resta presenza in ufficio, quindi matura e spende.
    state.assignments['2026-09-15'] = 'permesso';
    state.permessoHours['2026-09-15'] = 2;
    assert.equal(computeMeals({ ...state.mealVouchers, doublePerMonth: 0 }).final, 35);

    // Permesso di 8h: giornata intera fuori, come le ferie.
    state.permessoHours['2026-09-15'] = 8;
    const intero = computeMeals({ ...state.mealVouchers, doublePerMonth: 0 });
    assert.equal(intero.months[0].spent, base.months[0].spent - 7);

    deletePage(empty.id);
});
