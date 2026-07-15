/**
 * Gotus — générique d'introduction autonome.
 * @version 2.3.0
 * @author Gotoo et les contributeurs
 * @license MIT
 */

export const INTRO_STORAGE_KEYS = Object.freeze({
    seen: 'gotus-intro-seen-v1',
    enabled: 'gotus-intro-enabled-v1'
});

// Ces repères correspondent aux keyframes du générique dans gotus.css.
export const INTRO_AUDIO_CUES = Object.freeze([
    { at: 0, sound: 'opening' },
    { at: 350, sound: 'whoosh' },
    { at: 950, sound: 'bounce' },
    { at: 1250, sound: 'bounce' },
    { at: 1550, sound: 'bounce' },
    { at: 2050, sound: 'intruder' },
    { at: 3000, sound: 'impact' },
    { at: 2850, sound: 'letter' },
    { at: 3000, sound: 'letter' },
    { at: 3120, sound: 'letter' },
    { at: 3240, sound: 'letter' },
    { at: 3625, sound: 'lock' },
    { at: 4150, sound: 'whoosh' },
    { at: 4950, sound: 'eject' },
    { at: 5080, sound: 'signature' }
]);

export function safeStorageGet(storage, key) {
    try {
        return storage?.getItem(key) ?? null;
    } catch (_) {
        return null;
    }
}

export function safeStorageSet(storage, key, value) {
    try {
        storage?.setItem(key, value);
        return true;
    } catch (_) {
        return false;
    }
}

export function isIntroEnabled(storage) {
    return safeStorageGet(storage, INTRO_STORAGE_KEYS.enabled) !== 'false';
}

export function shouldAutoPlayIntro(storage) {
    return isIntroEnabled(storage)
        && safeStorageGet(storage, INTRO_STORAGE_KEYS.seen) !== 'true';
}

export function setIntroEnabled(storage, enabled) {
    const value = Boolean(enabled);
    const saved = safeStorageSet(storage, INTRO_STORAGE_KEYS.enabled, String(value));
    if (value) safeStorageSet(storage, INTRO_STORAGE_KEYS.seen, 'false');
    return saved;
}

export function markIntroSeen(storage) {
    return safeStorageSet(storage, INTRO_STORAGE_KEYS.seen, 'true');
}

function defaultStorage() {
    try {
        return globalThis.localStorage;
    } catch (_) {
        return null;
    }
}

function introMarkup() {
    return `
      <div class="intro-stage" aria-hidden="true">
        <div class="intro-beam intro-beam-a"></div>
        <div class="intro-beam intro-beam-b"></div>
        <div class="intro-orbit"></div>
        <span class="intro-ball intro-ball-red"></span>
        <span class="intro-ball intro-ball-yellow-a"></span>
        <span class="intro-ball intro-ball-yellow-b"></span>
        <span class="intro-ball intro-ball-blue-a"></span>
        <span class="intro-ball intro-ball-blue-b"></span>
        <span class="intro-ball intro-ball-black"></span>
        <span class="intro-ball intro-ball-kicker"></span>
        <div class="intro-logo" aria-hidden="true">
          <span class="intro-letter intro-letter-g">G</span>
          <span class="intro-o-slot">
            <span class="intro-o-final">O</span>
            <span class="intro-o-black"></span>
          </span>
          <span class="intro-letter intro-letter-t">T</span>
          <span class="intro-letter intro-letter-u">U</span>
          <span class="intro-letter intro-letter-s">S</span>
        </div>
        <p class="intro-tagline">Le jeu de lettres qui rebondit</p>
      </div>
      <div class="intro-accessible-copy">
        <h2 id="intro-title">GOTUS</h2>
        <p>Générique d'introduction.</p>
      </div>
      <div class="intro-start-panel">
        <button class="intro-start" type="button">Lancer le générique</button>
      </div>
      <button class="intro-skip" type="button">Passer</button>`;
}

export function createIntro(options = {}) {
    const doc = options.document ?? globalThis.document;
    const storage = options.storage ?? defaultStorage();
    const app = options.app ?? doc?.getElementById('app');
    const mount = options.mount ?? doc?.body;
    const matchMedia = options.matchMedia ?? globalThis.matchMedia?.bind(globalThis);
    const audioFactory = options.audioFactory ?? (source => new Audio(source));
    const sounds = options.sounds ?? {};
    const duration = options.duration ?? 5900;
    const reducedDuration = options.reducedDuration ?? 1500;
    const onEvent = options.onEvent ?? (() => {});
    const setTimer = options.setTimeout ?? globalThis.setTimeout.bind(globalThis);
    const clearTimer = options.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
    const nextFrame = options.requestAnimationFrame
        ?? globalThis.requestAnimationFrame?.bind(globalThis)
        ?? (callback => setTimer(callback, 0));

    let current = null;
    let destroyed = false;

    function emit(type, details = {}) {
        try {
            onEvent({ type, ...details });
        } catch (_) {
            // Les diagnostics ne doivent jamais casser le générique.
        }
    }

    function reducedMotion() {
        try {
            return Boolean(matchMedia?.('(prefers-reduced-motion: reduce)').matches);
        } catch (_) {
            return false;
        }
    }

    function stopAudio(audio) {
        try {
            audio.pause();
            audio.currentTime = 0;
        } catch (_) {
            // Un objet audio incomplet ne doit jamais bloquer le nettoyage.
        }
    }

    function playAudio(source) {
        if (!source || !current) return;
        try {
            const audio = audioFactory(source);
            current.audio.add(audio);
            const promise = audio.play();
            promise?.catch?.(() => {});
        } catch (_) {
            // L'animation reste indépendante des capacités audio.
        }
    }

    function schedule(callback, delay) {
        if (!current) return;
        const timer = setTimer(() => {
            current?.timers.delete(timer);
            if (current) callback();
        }, delay);
        current.timers.add(timer);
    }

    function finish(reason = 'complete') {
        const active = current;
        if (!active) return;
        current = null;
        active.timers.forEach(clearTimer);
        active.controller.abort();
        active.audio.forEach(stopAudio);
        active.element.remove();
        if (app) app.inert = active.previousInert;
        emit('finish', { reason });
        active.resolve(reason);
    }

    function play({ manual = false } = {}) {
        if (destroyed || !doc || !mount) return Promise.resolve('unavailable');
        if (current) return current.promise;

        const controller = new AbortController();
        const element = doc.createElement('section');
        const isReduced = !manual && reducedMotion();
        const hasAudio = INTRO_AUDIO_CUES.some(cue => Boolean(sounds[cue.sound]));
        const waitsForGesture = !manual && !isReduced && hasAudio;
        element.className = `intro-overlay${manual ? ' intro-full-motion' : ''}${isReduced ? ' intro-reduced' : ''}${waitsForGesture ? ' intro-awaiting' : ''}`;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');
        element.setAttribute('aria-labelledby', 'intro-title');
        element.innerHTML = introMarkup();

        let resolvePromise;
        const promise = new Promise(resolve => { resolvePromise = resolve; });
        current = {
            audio: new Set(),
            controller,
            element,
            promise,
            previousInert: Boolean(app?.inert),
            resolve: resolvePromise,
            timers: new Set()
        };

        if (!manual) markIntroSeen(storage);
        if (app) app.inert = true;
        mount.appendChild(element);
        const skipButton = element.querySelector('.intro-skip');
        const startButton = element.querySelector('.intro-start');
        skipButton?.addEventListener('click', () => finish('skipped'), {
            signal: controller.signal
        });
        startButton?.addEventListener('click', () => startSequence({ userGesture: true }), {
            signal: controller.signal
        });
        doc.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                finish('skipped');
            } else if (event.key === 'Tab') {
                event.preventDefault();
                if (waitsForGesture && doc.activeElement === startButton) skipButton?.focus();
                else if (waitsForGesture) startButton?.focus();
                else skipButton?.focus();
            }
        }, { signal: controller.signal });
        doc.addEventListener('visibilitychange', () => {
            if (doc.hidden) finish('hidden');
        }, { signal: controller.signal });

        if (startButton) startButton.hidden = !waitsForGesture;
        (waitsForGesture ? startButton : skipButton)?.focus();

        function startSequence({ userGesture = false } = {}) {
            if (!current || current.element !== element || current.started) return;
            current.started = true;
            element.classList.remove?.('intro-awaiting');
            const playbackDuration = isReduced ? reducedDuration : duration;
            emit('start', {
                duration: playbackDuration,
                manual,
                reduced: isReduced,
                userGesture
            });
            const startAnimations = () => {
                if (current?.element === element) element.classList.add('is-playing');
            };
            if (userGesture) startAnimations();
            else nextFrame(startAnimations);

            if (!isReduced) {
                INTRO_AUDIO_CUES.forEach(cue => {
                    if (cue.at === 0) playAudio(sounds[cue.sound]);
                    else schedule(() => playAudio(sounds[cue.sound]), cue.at);
                });
            }
            schedule(() => finish('complete'), playbackDuration);
        }

        if (!waitsForGesture) startSequence();
        return promise;
    }

    function skip() {
        finish('skipped');
    }

    async function replay() {
        finish('cancelled');
        return play({ manual: true });
    }

    function destroy() {
        destroyed = true;
        finish('destroyed');
    }

    return {
        play,
        skip,
        replay,
        destroy,
        get active() { return Boolean(current); }
    };
}
