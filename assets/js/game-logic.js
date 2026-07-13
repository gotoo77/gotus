/**
 * Gotus — fonctions pures du moteur de jeu.
 * @version 2.3.0
 * @author Gotoo et les contributeurs
 * @license MIT
 */
export function stripAccents(value) {
    return value.normalize('NFD').replace(/\p{Mn}+/gu, '');
}

export function normalizeWord(value) {
    return stripAccents(value).toUpperCase();
}

export function scoreGuess(guess, target) {
    const normalizedGuess = normalizeWord(guess);
    const normalizedTarget = normalizeWord(target);

    if (normalizedGuess.length !== normalizedTarget.length) {
        throw new Error('Le mot proposé et le mot cible doivent avoir la même longueur.');
    }

    const result = Array(normalizedTarget.length).fill('absent');
    const remaining = new Map();

    for (let index = 0; index < normalizedTarget.length; index++) {
        if (normalizedGuess[index] === normalizedTarget[index]) {
            result[index] = 'correct';
        } else {
            const letter = normalizedTarget[index];
            remaining.set(letter, (remaining.get(letter) || 0) + 1);
        }
    }

    for (let index = 0; index < normalizedGuess.length; index++) {
        if (result[index] === 'correct') continue;
        const letter = normalizedGuess[index];
        const count = remaining.get(letter) || 0;
        if (count > 0) {
            result[index] = 'present';
            remaining.set(letter, count - 1);
        }
    }

    return result;
}

export function playableWords(words, length) {
    return [...new Set(words.map(normalizeWord))]
        .filter(word => word.length === length && /^[A-Z]+$/.test(word));
}
