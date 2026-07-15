/**
 * Gotus — application du jeu.
 * @version 2.3.0
 * @author Gotoo et les contributeurs
 * @license MIT
 */
import { LOG_D, LOG_I, LOG_W, LOG_E } from './logger.js?v=2.3.0';
import {
    confirmedLettersAfterGuess,
    normalizeWord,
    playableWords,
    scoreGuess
} from './game-logic.js?v=2.3.0';
import {
    createIntro,
    isIntroEnabled,
    setIntroEnabled,
    shouldAutoPlayIntro
} from './intro.js?v=2.3.0';

const WORD_LEN = 6, MAX_TRIES = 6;
let CONFIG = { timing: { letterDelay: 500 }, theme: "dark" };
let BUILD_INFO = {
    product: "Gotus",
    version: "inconnue",
    release: "Développement",
    channel: "development",
    buildDate: null,
    commit: "indisponible"
};
const THEME_KEY = "gotus-theme";

function browserStorage() {
    try {
        return globalThis.localStorage;
    } catch (_) {
        return null;
    }
}

let modalOnClose = null;
let focusBeforeModal = null;
let intro = null;

function showModal(title, text, onClose = null) {
    LOG_I("Modal affichée :", title, text);
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const okBtn = document.getElementById('modal-ok');

    titleEl.textContent = title;
    textEl.innerHTML = text;
    modalOnClose = onClose;
    focusBeforeModal = document.activeElement;

    document.getElementById('app').inert = true;
    modal.hidden = false;
    okBtn.focus();
    requestAnimationFrame(() => modal.classList.add('visible'));
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal.hidden || modal.dataset.closing === 'true') return;
    modal.dataset.closing = 'true';
    const onClose = modalOnClose;
    const focusTarget = focusBeforeModal;
    modalOnClose = null;
    modal.classList.remove('visible');
    setTimeout(() => {
        modal.hidden = true;
        delete modal.dataset.closing;
        document.getElementById('app').inert = false;
        if (onClose) onClose();
        requestAnimationFrame(() => {
            if (focusTarget?.isConnected) focusTarget.focus();
            else btnNew.focus();
        });
    }, 300);
}

function norm(s) {
    return normalizeWord(s);
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formattedBuildDate(value) {
    if (!value) return 'indisponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'medium'
    }).format(date);
}

function showAbout() {
    const channelLabels = {
        development: 'Développement',
        beta: 'Bêta',
        stable: 'Stable'
    };
    const channel = channelLabels[BUILD_INFO.channel] || BUILD_INFO.channel;
    const introEnabled = isIntroEnabled(browserStorage());
    showModal(
        `À propos de ${BUILD_INFO.product}`,
        `<dl class="build-info">
           <div><dt>Version</dt><dd>${escapeHtml(BUILD_INFO.version)}</dd></div>
           <div><dt>Release</dt><dd>${escapeHtml(BUILD_INFO.release)}</dd></div>
           <div><dt>Canal</dt><dd>${escapeHtml(channel)}</dd></div>
           <div><dt>Date du build</dt><dd>${escapeHtml(formattedBuildDate(BUILD_INFO.buildDate))}</dd></div>
           <div><dt>Commit</dt><dd><code>${escapeHtml(BUILD_INFO.commit)}</code></dd></div>
           <div><dt>Crédits</dt><dd>Gotoo et les contributeurs · licence MIT</dd></div>
         </dl>
         <div class="intro-preferences">
           <label>
             <input id="intro-auto-enabled" type="checkbox" ${introEnabled ? 'checked' : ''}>
             Afficher le générique à la première visite
           </label>
           <button id="intro-replay-from-about" class="secondary" type="button">Revoir le générique</button>
         </div>
         <p class="shortcut-help">Raccourci : <kbd>Alt</kbd> + <kbd>V</kbd></p>`
    );
    document.getElementById('intro-auto-enabled')?.addEventListener('change', event => {
        setIntroEnabled(browserStorage(), event.currentTarget.checked);
    });
    document.getElementById('intro-replay-from-about')?.addEventListener('click', () => {
        modalOnClose = replayIntro;
        closeModal();
    });
}

async function j(path) {
    LOG_D("Chargement JSON :", path);
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) {
        LOG_E("Échec de fetch :", path, r.status);
        throw new Error(r.status);
    }
    return r.json();
}

function applyTheme(t) {
    LOG_I("Application du thème :", t);
    const isLight = t === "light";
    document.documentElement.classList.toggle("light", isLight);
    themeToggle.setAttribute('aria-checked', String(!isLight));
    themeToggle.querySelector('.theme-icon').textContent = isLight ? '☀' : '☾';
    themeToggle.querySelector('.theme-label').textContent = isLight ? 'Mode clair' : 'Mode sombre';
}
function getTheme() {
    try {
        return localStorage.getItem(THEME_KEY) || CONFIG.theme || "dark";
    } catch (_) {
        return CONFIG.theme || "dark";
    }
}
function setTheme(t) {
    LOG_I("Changement de thème :", t);
    try {
        localStorage.setItem(THEME_KEY, t);
    } catch (_) {
        LOG_W("Le thème ne peut pas être mémorisé.");
    }
    applyTheme(t);
}

const board = document.getElementById('board'),
      hint = document.getElementById('hint'),
      resultSummary = document.getElementById('resultSummary'),
      stats = document.getElementById('stats');
const btnNew = document.getElementById('newGame'),
      rules = document.getElementById('rules'),
      about = document.getElementById('about'),
      replayIntroButton = document.getElementById('replayIntro'),
      themeToggle = document.getElementById('themeToggle');
const A = {
    ok: document.getElementById('sfx-ok'),
    present: document.getElementById('sfx-present'),
    absent: document.getElementById('sfx-absent'),
    victory: document.getElementById('sfx-victory'),
    defeat: document.getElementById('sfx-defeat'),
    wrong: document.getElementById('sfx-wrong')
};

let ANSWERS_RAW = [], WORDS_SET = new Set();
let target = "",
    row = 0,
    col = 1,
    grid = [],
    current = new Array(WORD_LEN).fill(""),
    confirmedLetters = new Array(WORD_LEN).fill("");
let gameLocked = true, gameId = 0;
const keyboardButtons = new Map();
const keyRanks = { absent: 1, present: 2, correct: 3 };

const store = {
    get() {
        LOG_D("Lecture store");
        try {
            return JSON.parse(localStorage.getItem('gotus-stats') || '{}');
        } catch (e) {
            LOG_W("Erreur lecture localStorage :", e);
            return {};
        }
    },
    set(d) {
        LOG_D("Écriture store :", d);
        try {
            localStorage.setItem('gotus-stats', JSON.stringify(d));
        } catch (e) {
            LOG_W("Erreur écriture localStorage :", e);
        }
    }
};
LOG_I("Store initialisé");

function updStats() {
    const d = store.get();
    const p = d.played || 0, w = d.wins || 0, s = d.streak || 0, b = d.best || 0;
    LOG_I(`Stats: ${p} parties, ${w} victoires, série ${s}, record ${b}`);
    stats.textContent = `Parties: ${p} | Victoires: ${w} (${p?Math.round(100*w/p):0}%) | Série: ${s} | Record: ${b}`;
}

function rec(win) {
    LOG_I("Résultat enregistré :", win ? "victoire" : "défaite");
    const d = store.get();
    d.played = (d.played || 0) + 1;
    if (win) {
        d.wins = (d.wins || 0) + 1;
        d.streak = (d.streak || 0) + 1;
        d.best = Math.max(d.best || 0, d.streak);
    } else d.streak = 0;
    store.set(d);
    updStats();
}

function makeBoard() {
    LOG_D("Création du plateau");
    board.innerHTML = "";
    grid = [];
    for (let r = 0; r < MAX_TRIES; r++) {
        const rowArr = [];
        const rowEl = document.createElement('div');
        rowEl.className = 'board-row';
        rowEl.setAttribute('role', 'row');
        board.appendChild(rowEl);
        for (let c = 0; c < WORD_LEN; c++) {
            const div = document.createElement('div');
            div.className = 'cell';
            div.setAttribute('role', 'gridcell');
            div.setAttribute('aria-label', `Ligne ${r + 1}, colonne ${c + 1}`);
            rowEl.appendChild(div);
            rowArr.push(div);
        }
        grid.push(rowArr);
    }
}

const statusLabels = {
    correct: 'bien placée',
    present: 'présente ailleurs',
    absent: 'absente'
};

function describeCell(rowIndex, columnIndex, letter = '', status = '') {
    const details = [
        `Ligne ${rowIndex + 1}, colonne ${columnIndex + 1}`,
        letter ? `lettre ${letter}` : 'vide'
    ];
    if (status) details.push(statusLabels[status]);
    grid[rowIndex][columnIndex].setAttribute('aria-label', details.join(', '));
}

function isCurrentComplete() {
    return current.every(Boolean);
}

function prepareCurrentRow(rowIndex) {
    current = new Array(WORD_LEN).fill("");
    confirmedLetters.forEach((letter, index) => {
        if (!letter) return;
        const cell = grid[rowIndex]?.[index];
        if (!cell) return;
        cell.textContent = letter;
        cell.classList.add('confirmed');
        describeCell(rowIndex, index, letter, 'correct');
    });
    current[0] = confirmedLetters[0];
    col = 1;
}

function revealFirst() {
    LOG_D("Révélation première lettre :", target[0]);
    confirmedLetters = new Array(WORD_LEN).fill("");
    confirmedLetters[0] = target[0];
    prepareCurrentRow(0);
}

function rememberConfirmedLetters(guess, mask) {
    confirmedLetters = confirmedLettersAfterGuess(confirmedLetters, guess, mask);
}

const KEY_ROWS = [
    [..."AZERTYUIOP"],
    [..."QSDFGHJKLM"],
    ["⌫", ..."WXCVBN", "↵"]
];

function makeKeyboard() {
    LOG_D("Création clavier virtuel");
    const kb = document.getElementById('keyboard');
    kb.innerHTML = "";
    keyboardButtons.clear();
    for (const r of KEY_ROWS) {
        for (const k of r) {
            const b = document.createElement('button');
            b.className = 'key';
            b.textContent = k;
            b.type = 'button';
            b.setAttribute('aria-label', k === '⌫' ? 'Effacer une lettre' : k === '↵' ? 'Valider le mot' : `Lettre ${k}`);
            if (k === "⌫" || k === "↵") b.dataset.wide = "1";
            b.onclick = () => vk(k);
            kb.appendChild(b);
            keyboardButtons.set(k, b);
        }
    }
}

function updateKeyboardLetter(letter, nextState) {
    const button = keyboardButtons.get(norm(letter));
    if (!button) return;
    const currentState = button.dataset.state;
    if (!currentState || keyRanks[nextState] > keyRanks[currentState]) {
        button.dataset.state = nextState;
        button.setAttribute('aria-label', `Lettre ${letter}, ${statusLabels[nextState]}`);
    }
}

function vk(k) {
    if (gameLocked) return;
    LOG_D("Touche virtuelle :", k);
    if (k === "⌫") back();
    else if (k === "↵") enter();
    else char(k);
}

function char(ch) {
    if (gameLocked) return;
    if (!grid || !grid[row]) return;
    if (row >= MAX_TRIES) return;
    if (col < WORD_LEN && /^[A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸŒÆ]$/.test(ch)) {
        current[col] = ch;
        LOG_D(`Saisie : ${ch} à (${row},${col})`);
        const cell = grid[row][col];
        if (!cell) return;
        cell.textContent = ch;
        cell.classList.remove('confirmed');
        describeCell(row, col, ch);
        cell.classList.add('reveal');
        setTimeout(() => {
            if (cell && cell.classList) cell.classList.remove('reveal');
        }, 150);
        col = Math.min(col + 1, WORD_LEN);
    }
}

function back() {
    if (gameLocked) return;
    if (col > 1) {
        col--;
        LOG_D("Suppression lettre à col", col);
        current[col] = "";
        grid[row][col].textContent = confirmedLetters[col] || "";
        if (confirmedLetters[col]) {
            grid[row][col].classList.add('confirmed');
            describeCell(row, col, confirmedLetters[col], 'correct');
        } else {
            describeCell(row, col);
        }
    }
}

function score(guess, targ) {
    const res = scoreGuess(guess, targ);
    LOG_D("Score pour", guess, "→", res.join(","));
    return res;
}

function playSound(audio) {
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => LOG_D('Lecture audio bloquée par le navigateur'));
}

function soundForStatus(status) {
    return status === 'correct' ? A.ok : status === 'present' ? A.present : A.absent;
}

async function revealGuess(guess, mask, rowIndex, activeGame) {
    const letterDelay = CONFIG?.timing?.letterDelay ?? 500;
    LOG_D("Révélation synchronisée pour", mask);

    for (let index = 0; index < mask.length; index++) {
        if (activeGame !== gameId) return false;

        const status = mask[index];
        const cell = grid[rowIndex][index];
        cell.classList.add(status, 'evaluated');
        describeCell(rowIndex, index, guess[index], status);
        updateKeyboardLetter(guess[index], status);
        playSound(soundForStatus(status));

        if (index < mask.length - 1) {
            await new Promise(resolve => setTimeout(resolve, letterDelay));
        }
    }

    await new Promise(resolve => setTimeout(resolve, 120));
    return activeGame === gameId;
}

function validWord(guess) {
    const v = WORDS_SET.has(norm(guess));
    if (!v) LOG_W("Mot non valide :", guess);
    return v;
}

async function enter() {
    if (gameLocked) return;
    if (!isCurrentComplete()) {
        hint.textContent = "Mot incomplet…";
        LOG_W("Mot incomplet");
        return;
    }
    const guess = current.join('');
    LOG_I("Proposition :", guess);

    if (!validWord(guess)) {
        hint.textContent = "Mot invalide (hors dictionnaire).";
        playSound(A.wrong);
        board.classList.remove('shake');
        requestAnimationFrame(() => board.classList.add('shake'));
        LOG_W("Mot invalide, essai non consommé");
        return;
    }

    gameLocked = true;
    const activeGame = gameId;
    const mask = score(guess, target);
    const correctCount = mask.filter(status => status === 'correct').length;
    const presentCount = mask.filter(status => status === 'present').length;
    const absentCount = mask.filter(status => status === 'absent').length;
    const revealed = await revealGuess(guess, mask, row, activeGame);
    if (!revealed) return;
    rememberConfirmedLetters(guess, mask);
    resultSummary.textContent = `Résultat : ${correctCount} bien placée${correctCount !== 1 ? 's' : ''}, ${presentCount} présente${presentCount !== 1 ? 's' : ''} ailleurs et ${absentCount} absente${absentCount !== 1 ? 's' : ''}.`;

    if (norm(guess) === norm(target)) {
        LOG_I("Victoire :", guess);
        rec(true);
        playSound(A.victory);
        showModal("Victoire !", `<p>Bravo, le mot était <strong>${target}</strong>.</p>`, newGame);
        return;
    }

    row++;
    LOG_D("Tentative ratée, passage à row", row);
    if (row >= MAX_TRIES) {
        LOG_E("Défaite après 6 essais");
        rec(false);
        playSound(A.defeat);
        showModal("Partie terminée", `<p>Le mot était <strong>${target}</strong>.</p>`, newGame);
        return;
    }

    prepareCurrentRow(row);
    hint.textContent = `${MAX_TRIES - row} essai${MAX_TRIES - row > 1 ? 's' : ''} restant${MAX_TRIES - row > 1 ? 's' : ''}.`;
    gameLocked = false;
}

function onKey(e) {
    if (!document.getElementById('modal').hidden) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Tab') {
            e.preventDefault();
            const focusable = [...document.querySelectorAll(
                '#modal button:not([disabled]), #modal input:not([disabled])'
            )];
            const index = focusable.indexOf(document.activeElement);
            const next = e.shiftKey
                ? (index <= 0 ? focusable.length - 1 : index - 1)
                : (index + 1) % focusable.length;
            focusable[next]?.focus();
        }
        return;
    }
    if (e.altKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        showAbout();
        return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Enter") enter();
    else if (e.key === "Backspace") back();
    else if (/^[a-zA-Zàâäçéèêëïîôöùûüÿœæ]$/.test(e.key)) char(e.key.toUpperCase());
}

function sample() {
    if (!ANSWERS_RAW.length) throw new Error('Aucun mot jouable dans le dictionnaire.');
    const s = ANSWERS_RAW[Math.floor(Math.random() * ANSWERS_RAW.length)];
    LOG_D("Nouveau mot cible sélectionné");
    return s;
}

function newGame({ locked = false } = {}) {
    LOG_I("Nouvelle partie");
    gameId++;
    gameLocked = true;
    target = "";
    try {
        target = sample();
    } catch (error) {
        gameLocked = true;
        hint.textContent = error.message;
        LOG_E(error.message);
        return;
    }
    row = 0; col = 1;
    confirmedLetters = new Array(WORD_LEN).fill("");
    makeBoard();
    makeKeyboard();
    revealFirst();
    hint.textContent = "Trouvez le mot de 6 lettres. La première lettre est donnée.";
    resultSummary.textContent = "";
    gameLocked = locked;
}

function unlockGame(activeGame = gameId) {
    if (activeGame !== gameId || !target) return false;
    gameLocked = false;
    document.getElementById('main').focus();
    return true;
}

async function replayIntro() {
    if (!intro || intro.active) return;
    const activeGame = gameId;
    gameLocked = true;
    try {
        await intro.replay();
    } catch (error) {
        LOG_W("Générique interrompu :", error);
    } finally {
        unlockGame(activeGame);
    }
}

function configureAudio() {
    Object.entries(A).forEach(([name, audio]) => {
        const source = CONFIG?.sound?.[name];
        if (source && audio) audio.src = source;
    });
}

async function boot() {
    LOG_I("Boot du jeu Gotus");
    try {
        BUILD_INFO = await j('assets/data/build-info.json');
        LOG_I(`Gotus ${BUILD_INFO.version} — ${BUILD_INFO.release}`);
    } catch (e) {
        LOG_W("Build info load failed:", e);
    }
    try {
        CONFIG = await j('assets/data/config.json');
        LOG_I("Config chargée :", CONFIG);
    } catch (e) {
        LOG_W("Config load failed:", e);
    }
    configureAudio();
    applyTheme(getTheme());
    try {
        const D = await j('assets/data/dictionary.fr-6.json');
        const acceptedWords = playableWords(D.words || [], WORD_LEN);
        const acceptedSet = new Set(acceptedWords);
        ANSWERS_RAW = playableWords(D.answers || acceptedWords, WORD_LEN)
            .filter(word => acceptedSet.has(word));
        WORDS_SET = acceptedSet;
        LOG_I(
            "Dictionnaire chargé :",
            ANSWERS_RAW.length,
            "réponses et",
            WORDS_SET.size,
            "mots acceptés"
        );
    } catch (e) {
        LOG_E("Erreur de chargement dictionnaire", e);
        showModal("Erreur", "<p>Impossible de charger le dictionnaire.</p>");
    }
    newGame({ locked: true });
    updStats();
    btnNew.onclick = newGame;
    document.addEventListener('keydown', onKey);
    document.getElementById('modal-ok').onclick = closeModal;
    document.getElementById('modal').onclick = (event) => {
        if (event.target.id === 'modal') closeModal();
    };

    rules.onclick = () => {
      showModal(
        "Règles du jeu",
        `<p>Devinez le mot français de six lettres en six essais. La première lettre est donnée.</p>
         <ul>
           <li><strong>Bien placée :</strong> la lettre est à la bonne position.</li>
           <li><strong>Présente ailleurs :</strong> la lettre existe à une autre position.</li>
           <li><strong>Absente :</strong> la lettre n’est pas dans le mot.</li>
           <li>Les lettres déjà bien placées sont rappelées sur les essais suivants, mais seule la première lettre est imposée.</li>
         </ul>`
      );
    };

    about.onclick = showAbout;
    replayIntroButton.onclick = replayIntro;

    themeToggle.onclick = () => {
        const theme = getTheme() === "dark" ? "light" : "dark";
        setTheme(theme);
    };
    intro = createIntro({
        app: document.getElementById('app'),
        duration: CONFIG?.intro?.duration,
        onEvent: event => {
            if (event.type === 'start') {
                LOG_I(
                    "Générique démarré :",
                    event.reduced ? "version réduite" : "version complète",
                    `${event.duration} ms`
                );
            } else if (event.type === 'finish') {
                LOG_I("Générique terminé :", event.reason);
            }
        },
        sounds: CONFIG?.intro?.sound
    });
    const activeGame = gameId;
    try {
        if (target && shouldAutoPlayIntro(browserStorage())) {
            LOG_I("Lecture du générique d’introduction");
            await intro.play();
        }
    } catch (error) {
        LOG_W("Le générique n’a pas pu être joué :", error);
        intro.skip();
    } finally {
        unlockGame(activeGame);
    }
    LOG_I("Interface initialisée");
}
 

boot();
