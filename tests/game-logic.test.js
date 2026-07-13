import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWord, playableWords, scoreGuess } from '../assets/js/game-logic.js';

test('normalise les accents et la casse', () => {
    assert.equal(normalizeWord('ÉcRire'), 'ECRIRE');
});

test('score les lettres bien placées et présentes', () => {
    assert.deepEqual(scoreGuess('MARINE', 'MAISON'), [
        'correct', 'correct', 'absent', 'present', 'present', 'absent'
    ]);
});

test('ne crédite pas deux fois une lettre répétée', () => {
    assert.deepEqual(scoreGuess('SALADE', 'MAISON'), [
        'present', 'correct', 'absent', 'absent', 'absent', 'absent'
    ]);
});

test('filtre et déduplique les mots jouables', () => {
    assert.deepEqual(playableWords(['été', 'ETE', 'maison', 'LUMIERE', 'souris'], 6), [
        'MAISON', 'SOURIS'
    ]);
});
