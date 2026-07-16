import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const french = JSON.parse(
    await readFile(new URL('../assets/data/i18n/fr.json', import.meta.url), 'utf8')
);
const english = JSON.parse(
    await readFile(new URL('../assets/data/i18n/en.json', import.meta.url), 'utf8')
);

test('les traductions françaises et anglaises exposent les mêmes clés', () => {
    assert.deepEqual(Object.keys(french).sort(), Object.keys(english).sort());
});

test('les traductions ne contiennent pas de valeur vide', () => {
    for (const catalog of [french, english]) {
        for (const [key, value] of Object.entries(catalog)) {
            assert.equal(typeof value, 'string', key);
            assert.notEqual(value.trim(), '', key);
        }
    }
});
