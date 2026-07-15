import test from 'node:test';
import assert from 'node:assert/strict';

import {
    INTRO_AUDIO_CUES,
    INTRO_STORAGE_KEYS,
    createIntro,
    isIntroEnabled,
    markIntroSeen,
    setIntroEnabled,
    shouldAutoPlayIntro
} from '../assets/js/intro.js';

class MemoryStorage {
    values = new Map();
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
}

class FakeClassList {
    values = new Set();
    add(...names) { names.forEach(name => this.values.add(name)); }
    remove(...names) { names.forEach(name => this.values.delete(name)); }
    contains(name) { return this.values.has(name); }
}

class FakeButton extends EventTarget {
    focused = false;
    focus() { this.focused = true; }
}

class FakeElement extends EventTarget {
    classList = new FakeClassList();
    removed = false;
    skipButton = new FakeButton();
    startButton = new FakeButton();
    attributes = new Map();
    set className(value) { value.split(' ').forEach(name => this.classList.add(name)); }
    set innerHTML(_) {}
    setAttribute(name, value) { this.attributes.set(name, value); }
    querySelector(selector) {
        if (selector === '.intro-skip') return this.skipButton;
        if (selector === '.intro-start') return this.startButton;
        return null;
    }
    remove() { this.removed = true; }
}

class FakeDocument extends EventTarget {
    hidden = false;
    body = {
        children: [],
        appendChild: element => this.body.children.push(element)
    };
    createElement() { return new FakeElement(); }
    getElementById() { return null; }
}

function controlledIntro(overrides = {}) {
    const document = new FakeDocument();
    const app = { inert: false };
    const timers = new Map();
    let timerId = 0;
    const intro = createIntro({
        app,
        document,
        storage: new MemoryStorage(),
        requestAnimationFrame: callback => callback(),
        setTimeout: (callback, delay) => {
            const id = ++timerId;
            timers.set(id, { callback, delay });
            return id;
        },
        clearTimeout: id => timers.delete(id),
        ...overrides
    });
    return { app, document, intro, timers };
}

function keyEvent(key) {
    const event = new Event('keydown', { cancelable: true });
    Object.defineProperty(event, 'key', { value: key });
    return event;
}

test('la première visite joue une fois et respecte la préférence persistante', () => {
    const storage = new MemoryStorage();
    assert.equal(shouldAutoPlayIntro(storage), true);
    markIntroSeen(storage);
    assert.equal(storage.getItem(INTRO_STORAGE_KEYS.seen), 'true');
    assert.equal(shouldAutoPlayIntro(storage), false);

    setIntroEnabled(storage, false);
    assert.equal(isIntroEnabled(storage), false);
    assert.equal(shouldAutoPlayIntro(storage), false);
    setIntroEnabled(storage, true);
    assert.equal(isIntroEnabled(storage), true);
    assert.equal(shouldAutoPlayIntro(storage), true);
});

test('les ponctuations sonores suivent les impacts de la chorégraphie', () => {
    assert.deepEqual(
        INTRO_AUDIO_CUES.filter(cue => ['impact', 'lock', 'eject', 'signature'].includes(cue.sound)),
        [
            { at: 3000, sound: 'impact' },
            { at: 3625, sound: 'lock' },
            { at: 4950, sound: 'eject' },
            { at: 5080, sound: 'signature' }
        ]
    );
});

test('un localStorage indisponible conserve des valeurs par défaut sûres', () => {
    const storage = {
        getItem() { throw new Error('indisponible'); },
        setItem() { throw new Error('saturé'); }
    };
    assert.equal(shouldAutoPlayIntro(storage), true);
    assert.equal(markIntroSeen(storage), false);
    assert.equal(setIntroEnabled(storage, false), false);
});

test('la fin naturelle nettoie l’overlay et rend l’application utilisable', async () => {
    const { app, document, intro, timers } = controlledIntro({ duration: 5900 });
    const completion = intro.play();
    assert.equal(app.inert, true);
    assert.equal(intro.active, true);
    assert.equal(document.body.children[0].classList.contains('is-playing'), true);

    [...timers.values()].find(timer => timer.delay === 5900).callback();
    assert.equal(await completion, 'complete');
    assert.equal(app.inert, false);
    assert.equal(intro.active, false);
    assert.equal(document.body.children[0].removed, true);
});

test('le bouton et Échap passent immédiatement le générique', async () => {
    for (const action of ['button', 'escape']) {
        const { app, document, intro } = controlledIntro();
        const completion = intro.play();
        if (action === 'button') {
            document.body.children[0].skipButton.dispatchEvent(new Event('click'));
        } else {
            document.dispatchEvent(keyEvent('Escape'));
        }
        assert.equal(await completion, 'skipped');
        assert.equal(app.inert, false);
    }
});

test('le premier générique sonore attend un geste utilisateur sur desktop', async () => {
    let playCount = 0;
    const { document, intro, timers } = controlledIntro({
        audioFactory: () => ({
            currentTime: 0,
            pause() {},
            play: () => {
                playCount += 1;
                return Promise.resolve();
            }
        }),
        duration: 10,
        sounds: { opening: 'opening.wav' }
    });
    const completion = intro.play();
    assert.equal(document.body.children[0].classList.contains('intro-awaiting'), true);
    assert.equal(document.body.children[0].startButton.focused, true);
    assert.equal(playCount, 0);
    assert.equal(timers.size, 0);

    document.body.children[0].startButton.dispatchEvent(new Event('click'));
    assert.equal(document.body.children[0].classList.contains('is-playing'), true);
    assert.equal(playCount, 1);
    [...timers.values()].find(timer => timer.delay === 10).callback();
    assert.equal(await completion, 'complete');
});

test('le mode mouvement réduit affiche seulement la version courte et sans son', async () => {
    let audioCreated = false;
    const { document, intro, timers } = controlledIntro({
        audioFactory: () => { audioCreated = true; },
        matchMedia: () => ({ matches: true }),
        sounds: { opening: 'opening.wav' }
    });
    const completion = intro.play();
    assert.equal(document.body.children[0].classList.contains('intro-reduced'), true);
    assert.equal(audioCreated, false);
    [...timers.values()].find(timer => timer.delay === 1500).callback();
    assert.equal(await completion, 'complete');
});

test('le rejeu manuel lance la version complète même avec mouvement réduit', async () => {
    let audioCreated = false;
    const { document, intro, timers } = controlledIntro({
        audioFactory: () => ({
            currentTime: 0,
            pause() {},
            play: () => {
                audioCreated = true;
                return Promise.resolve();
            }
        }),
        duration: 5900,
        matchMedia: () => ({ matches: true }),
        sounds: { opening: 'opening.wav' }
    });
    const completion = intro.replay();
    assert.equal(document.body.children[0].classList.contains('intro-reduced'), false);
    assert.equal(document.body.children[0].classList.contains('intro-full-motion'), true);
    assert.equal(audioCreated, true);
    [...timers.values()].find(timer => timer.delay === 5900).callback();
    assert.equal(await completion, 'complete');
});

test('un rejet audio ne gouverne jamais la chronologie', async () => {
    const { intro, timers } = controlledIntro({
        audioFactory: () => ({
            currentTime: 0,
            pause() {},
            play: () => Promise.reject(new Error('autoplay bloqué'))
        }),
        duration: 10,
        sounds: { opening: 'opening.wav' }
    });
    const completion = intro.replay();
    [...timers.values()].find(timer => timer.delay === 10).callback();
    assert.equal(await completion, 'complete');
});

test('un double lancement partage la même séquence et le rejeu reste volontaire', async () => {
    const { document, intro } = controlledIntro();
    const first = intro.play();
    const duplicate = intro.play();
    assert.equal(first, duplicate);
    intro.skip();
    assert.equal(await first, 'skipped');

    const replay = intro.replay();
    assert.equal(document.body.children.length, 2);
    intro.skip();
    assert.equal(await replay, 'skipped');
});

test('destroy et le masquage de l’onglet annulent et nettoient toutes les ressources', async () => {
    const first = controlledIntro();
    const destroyed = first.intro.play();
    first.intro.destroy();
    assert.equal(await destroyed, 'destroyed');
    assert.equal(first.timers.size, 0);
    assert.equal(first.app.inert, false);
    assert.equal(await first.intro.play(), 'unavailable');

    const second = controlledIntro();
    const hidden = second.intro.play();
    second.document.hidden = true;
    second.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(await hidden, 'hidden');
    assert.equal(second.app.inert, false);
});
