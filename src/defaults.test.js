// node --test src/defaults.test.js
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
};

store.set('calendar_pages', JSON.stringify([{ id: '', name: 'Primo' }, { id: 'p2', name: 'Secondo' }]));
store.set('calendar_max_counts', JSON.stringify({ ferie: 10, smartworking: 45, permesso: 14 }));
store.set('calendar_max_counts:p2', JSON.stringify({ ferie: 10, smartworking: 20, permesso: 14 }));

const { loadState, state, saveState } = await import('./state.js');

test('i nuovi massimali raggiungono i calendari già salvati', () => {
    loadState();

    assert.equal(state.maxCounts.smartworking, 40);
    assert.equal(state.maxCounts.permesso, 11);

    const second = JSON.parse(store.get('calendar_max_counts:p2'));
    assert.equal(second.smartworking, 20, 'un totale scelto a mano non viene toccato');
    assert.equal(second.permesso, 11, 'il vecchio default invece sì');
});

test('la conversione non si ripete su un valore rimesso a mano', () => {
    state.maxCounts.smartworking = 45;
    saveState();
    loadState();

    assert.equal(state.maxCounts.smartworking, 45);
});
