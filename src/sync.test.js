// node --test src/sync.test.js
import assert from 'node:assert/strict';
import test from 'node:test';

const store = new Map();
globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
    get length() { return store.size; },
    key: index => [...store.keys()][index] ?? null
};

const { collectLocalData, writeLocalData } = await import('./sync.js');

test('viaggia nel cloud solo lo stato del calendario', () => {
    store.clear();
    store.set('calendar_assignments', '{"2026-08-03":"ferie"}');
    store.set('calendar_pages:p1', '[]');
    store.set('calendar_snapshot_v0', 'copia locale, non va sincronizzata');
    store.set('calendar_local_at', '1700000000000');
    store.set('altra_app', 'estranea');

    assert.deepEqual(collectLocalData(), {
        calendar_assignments: '{"2026-08-03":"ferie"}',
        'calendar_pages:p1': '[]'
    });
});

test('i dati dal cloud rimpiazzano lo stato, comprese le pagine eliminate altrove', () => {
    store.clear();
    store.set('calendar_assignments', '{"2026-08-03":"ferie"}');
    store.set('calendar_assignments:p2', '{"2026-09-01":"missione"}');
    store.set('calendar_snapshot_v0', 'copia locale');
    store.set('altra_app', 'estranea');

    writeLocalData({ calendar_assignments: '{"2026-12-24":"permesso"}' });

    assert.equal(store.get('calendar_assignments'), '{"2026-12-24":"permesso"}');
    assert.equal(store.has('calendar_assignments:p2'), false, 'la pagina eliminata sparisce anche qui');
    assert.equal(store.get('calendar_snapshot_v0'), 'copia locale', 'la copia di sicurezza locale resta');
    assert.equal(store.get('altra_app'), 'estranea', 'le chiavi di altre app non si toccano');
});
