import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dictionary = JSON.parse(
    await readFile(new URL('../assets/data/dictionary.fr-6.json', import.meta.url), 'utf8')
);

test('le dictionnaire décrit sa source et sa licence', () => {
    assert.equal(dictionary.source.name, 'Lexique 4.00');
    assert.equal(dictionary.source.license, 'CC BY-SA 4.0');
});

test('les réponses sont uniques, triées et acceptées', () => {
    const accepted = new Set(dictionary.words);
    assert.deepEqual(dictionary.answers, [...dictionary.answers].sort());
    assert.equal(new Set(dictionary.answers).size, dictionary.answers.length);
    assert.ok(dictionary.answers.every(word => accepted.has(word)));
});

test('toutes les entrées sont des mots normalisés de six lettres', () => {
    assert.ok(dictionary.answers.length >= 1500);
    assert.ok(dictionary.words.length >= 6000);
    assert.ok(dictionary.words.every(word => /^[A-Z]{6}$/.test(word)));
});
