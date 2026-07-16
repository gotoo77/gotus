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
const MIN_RESPONSE_LIMIT_SECONDS = 5;
const DEFAULT_RESPONSE_LIMIT_SECONDS = 8;
const MAX_RESPONSE_LIMIT_SECONDS = 30;
const ISSUE_URL = "https://github.com/gotoo77/gotus/issues/new";
const DEFAULT_LANGUAGE = "fr";
const LANGUAGE_KEY = "gotus-language";
const LANGUAGES = Object.freeze([
    { code: "fr", label: "Français" },
    { code: "en", label: "English" }
]);
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
const SETTINGS_KEY = "gotus-settings";
const DEFAULT_SETTINGS = {
    timedResponses: false,
    responseLimitSeconds: DEFAULT_RESPONSE_LIMIT_SECONDS,
    countInvalidWords: false
};

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
let settings = { ...DEFAULT_SETTINGS };
let language = DEFAULT_LANGUAGE;
let messages = {};
let baseHint = "";
let responseTimerId = null;
let responseDeadline = 0;

function showModal(title, text, onClose = null) {
    LOG_I("Modal affichée :", title, text);
    clearResponseTimer();
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
            startResponseTimer();
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

function supportedLanguage(value) {
    return LANGUAGES.some(option => option.code === value) ? value : DEFAULT_LANGUAGE;
}

function getLanguage() {
    try {
        return supportedLanguage(localStorage.getItem(LANGUAGE_KEY) || DEFAULT_LANGUAGE);
    } catch (_) {
        return DEFAULT_LANGUAGE;
    }
}

function saveLanguage(nextLanguage) {
    language = supportedLanguage(nextLanguage);
    try {
        localStorage.setItem(LANGUAGE_KEY, language);
    } catch (_) {
        LOG_W("La langue ne peut pas être mémorisée.");
    }
}

function t(key, values = {}) {
    const template = messages[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => (
        values[name] === undefined ? `{${name}}` : String(values[name])
    ));
}

function textKey(key) {
    return escapeHtml(t(key));
}

function htmlFromKey(key, values = {}) {
    const escapedValues = Object.fromEntries(
        Object.entries(values).map(([name, value]) => [name, escapeHtml(value)])
    );
    return t(key, escapedValues);
}

function attemptText(count) {
    return t(count === 1 ? "hint.remaining.one" : "hint.remaining.other", { count });
}

function introLabels() {
    return {
        tagline: t("intro.tagline"),
        description: t("intro.description"),
        start: t("intro.start"),
        skip: t("intro.skip")
    };
}

function applyTranslations() {
    document.documentElement.lang = language;
    document.title = t("document.title");
    document.querySelectorAll("[data-i18n]").forEach(element => {
        element.textContent = t(element.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-content]").forEach(element => {
        element.setAttribute("content", t(element.dataset.i18nContent));
    });
    document.getElementById("modal-ok").textContent = t("modal.close");
    languageSwitch.setAttribute("aria-label", t("settings.language"));
    languageSwitch.querySelectorAll("[data-language]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.language === language));
    });
    applyTheme(getTheme());
}

function githubIssueUrl(title, body) {
    const params = new URLSearchParams({ title, body });
    return `${ISSUE_URL}?${params.toString()}`;
}

function rejectedWordIssueUrl(guess) {
    const word = norm(guess);
    return githubIssueUrl(
        t('report.issueTitle', { word }),
        [
            t('report.word', { word }),
            t('report.length', { length: word.length }),
            t('report.version', { version: BUILD_INFO.version }),
            "",
            t('report.context'),
            t('report.source'),
            t('report.comment')
        ].join("\n")
    );
}

function showRejectedWordReport(guess) {
    const word = norm(guess);
    showModal(
        t('report.modalTitle'),
        `<p>${htmlFromKey('report.modalWord', { word })}</p>
         <p>${textKey('report.modalHelp')}</p>
         <p class="report-actions">
           <a class="secondary" href="${escapeHtml(rejectedWordIssueUrl(word))}" target="_blank" rel="noopener">${textKey('report.create')}</a>
         </p>`
    );
}

function setRejectedWordSummary(guess, message = t("result.invalidWord")) {
    const word = norm(guess);
    const buttonId = "report-rejected-word";
    resultSummary.innerHTML = `${escapeHtml(message)} <button id="${buttonId}" class="link-button" type="button">${escapeHtml(t('report.button', { word }))}</button>`;
    document.getElementById(buttonId)?.addEventListener('click', () => showRejectedWordReport(word));
}

function formattedBuildDate(value) {
    if (!value) return 'indisponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'fr-FR', {
        dateStyle: 'long',
        timeStyle: 'medium'
    }).format(date);
}

function showAbout() {
    const channelLabels = {
        development: t('channel.development'),
        beta: t('channel.beta'),
        stable: t('channel.stable')
    };
    const channel = channelLabels[BUILD_INFO.channel] || BUILD_INFO.channel;
    const introEnabled = isIntroEnabled(browserStorage());
    showModal(
        t('about.title', { product: BUILD_INFO.product }),
        `<dl class="build-info">
           <div><dt>${textKey('about.version')}</dt><dd>${escapeHtml(BUILD_INFO.version)}</dd></div>
           <div><dt>${textKey('about.release')}</dt><dd>${escapeHtml(BUILD_INFO.release)}</dd></div>
           <div><dt>${textKey('about.channel')}</dt><dd>${escapeHtml(channel)}</dd></div>
           <div><dt>${textKey('about.buildDate')}</dt><dd>${escapeHtml(formattedBuildDate(BUILD_INFO.buildDate))}</dd></div>
           <div><dt>${textKey('about.commit')}</dt><dd><code>${escapeHtml(BUILD_INFO.commit)}</code></dd></div>
           <div><dt>${textKey('about.credits')}</dt><dd>${textKey('about.creditsValue')}</dd></div>
         </dl>
         <div class="intro-preferences">
           <label>
             <input id="intro-auto-enabled" type="checkbox" ${introEnabled ? 'checked' : ''}>
             ${textKey('about.introAuto')}
           </label>
           <button id="intro-replay-from-about" class="secondary" type="button">${textKey('about.replayIntro')}</button>
         </div>
         <p class="shortcut-help">${textKey('about.shortcut')} <kbd>Alt</kbd> + <kbd>V</kbd></p>`
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

async function loadMessages(nextLanguage) {
    const preferred = supportedLanguage(nextLanguage);
    try {
        messages = await j(`assets/data/i18n/${preferred}.json`);
        language = preferred;
    } catch (error) {
        if (preferred === DEFAULT_LANGUAGE) throw error;
        LOG_W("Traduction indisponible, retour au français :", preferred, error);
        messages = await j(`assets/data/i18n/${DEFAULT_LANGUAGE}.json`);
        language = DEFAULT_LANGUAGE;
    }
    applyTranslations();
}

function applyTheme(theme) {
    LOG_I("Application du thème :", theme);
    const isLight = theme === "light";
    document.documentElement.classList.toggle("light", isLight);
    themeToggle.setAttribute('aria-checked', String(!isLight));
    themeToggle.querySelector('.theme-icon').textContent = isLight ? '☀' : '☾';
    themeToggle.querySelector('.theme-label').textContent = isLight ? t('theme.lightLabel') : t('theme.darkLabel');
    themeToggle.setAttribute('aria-label', isLight ? t('theme.enableDark') : t('theme.enableLight'));
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

function getSettings() {
    try {
        return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'));
    } catch (_) {
        return { ...DEFAULT_SETTINGS };
    }
}

function setSettings(nextSettings) {
    settings = normalizeSettings(nextSettings);
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (_) {
        LOG_W("Les réglages ne peuvent pas être mémorisés.");
    }
    if (settings.timedResponses) startResponseTimer();
    else clearResponseTimer();
}

function clampResponseLimit(value) {
    const seconds = Number.parseInt(value, 10);
    if (!Number.isFinite(seconds)) return DEFAULT_RESPONSE_LIMIT_SECONDS;
    return Math.min(MAX_RESPONSE_LIMIT_SECONDS, Math.max(MIN_RESPONSE_LIMIT_SECONDS, seconds));
}

function normalizeSettings(value) {
    return {
        ...DEFAULT_SETTINGS,
        ...value,
        responseLimitSeconds: clampResponseLimit(value?.responseLimitSeconds)
    };
}

function setHint(message) {
    baseHint = message;
    renderHint();
}

function renderHint() {
    hint.textContent = responseDeadline
        ? `${baseHint} ${t('timer.limit', { seconds: settings.responseLimitSeconds })}`
        : baseHint;
}

function timerColor(progress) {
    if (progress <= 0.25) return '#ef233c';
    if (progress <= 0.5) return '#f59f00';
    return '#2f9e44';
}

function renderResponseTimer() {
    if (!responseDeadline) {
        responseTimer.hidden = true;
        return;
    }
    const totalMs = settings.responseLimitSeconds * 1000;
    const remainingMs = Math.max(0, responseDeadline - Date.now());
    const progress = totalMs > 0 ? remainingMs / totalMs : 0;
    const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    responseTimer.hidden = false;
    responseTimer.style.setProperty('--timer-angle', `${progress * 360}deg`);
    responseTimer.style.setProperty('--timer-color', timerColor(progress));
    responseTimer.dataset.urgent = String(progress <= 0.25);
    responseTimerValue.textContent = String(remainingSeconds);
}

function clearResponseTimer() {
    if (responseTimerId) clearInterval(responseTimerId);
    responseTimerId = null;
    responseDeadline = 0;
    renderResponseTimer();
    renderHint();
}

function startResponseTimer() {
    if (!settings.timedResponses || gameLocked || !target || row >= MAX_TRIES) return;
    if (!document.getElementById('modal')?.hidden) return;
    clearResponseTimer();
    responseDeadline = Date.now() + settings.responseLimitSeconds * 1000;
    renderResponseTimer();
    renderHint();
    responseTimerId = setInterval(() => {
        if (gameLocked || !target || row >= MAX_TRIES) {
            clearResponseTimer();
            return;
        }
        renderResponseTimer();
        renderHint();
        if (Date.now() >= responseDeadline) {
            clearResponseTimer();
            consumeFailedAttempt(t("timer.elapsed"));
        }
    }, 250);
}

function showSettings() {
    const languageOptions = LANGUAGES.map(option => (
        `<option value="${option.code}" ${option.code === language ? 'selected' : ''}>${escapeHtml(option.label)}</option>`
    )).join('');
    showModal(
        t("settings.title"),
        `<div class="settings-panel">
           <label class="settings-range">
             <span>
               <strong>${textKey('settings.language')}</strong>
               <span>${textKey('settings.languageHelp')}</span>
             </span>
             <select id="setting-language">${languageOptions}</select>
           </label>
           <label>
             <input id="setting-timed-responses" type="checkbox" ${settings.timedResponses ? 'checked' : ''}>
             <span>
               <strong>${textKey('settings.timedResponses')}</strong>
               <span>${textKey('settings.timedResponsesHelp')}</span>
             </span>
           </label>
           <label class="settings-range">
             <span>
               <strong>${textKey('settings.responseLimit')}</strong>
               <span><output id="setting-response-limit-output" for="setting-response-limit">${settings.responseLimitSeconds} s</output></span>
             </span>
             <input
               id="setting-response-limit"
               type="range"
               min="${MIN_RESPONSE_LIMIT_SECONDS}"
               max="${MAX_RESPONSE_LIMIT_SECONDS}"
               value="${settings.responseLimitSeconds}"
             >
           </label>
           <label>
             <input id="setting-count-invalid" type="checkbox" ${settings.countInvalidWords ? 'checked' : ''}>
             <span>
               <strong>${textKey('settings.countInvalid')}</strong>
               <span>${textKey('settings.countInvalidHelp')}</span>
             </span>
           </label>
         </div>`
    );
    document.getElementById('setting-language')?.addEventListener('change', async event => {
        if (await changeLanguage(event.currentTarget.value)) closeModal();
    });
    document.getElementById('setting-timed-responses')?.addEventListener('change', event => {
        setSettings({ ...settings, timedResponses: event.currentTarget.checked });
    });
    document.getElementById('setting-response-limit')?.addEventListener('input', event => {
        const responseLimitSeconds = clampResponseLimit(event.currentTarget.value);
        const output = document.getElementById('setting-response-limit-output');
        if (output) output.textContent = `${responseLimitSeconds} s`;
        setSettings({ ...settings, responseLimitSeconds });
    });
    document.getElementById('setting-count-invalid')?.addEventListener('change', event => {
        setSettings({ ...settings, countInvalidWords: event.currentTarget.checked });
    });
}

const board = document.getElementById('board'),
      hint = document.getElementById('hint'),
      responseTimer = document.getElementById('responseTimer'),
      responseTimerValue = document.getElementById('responseTimerValue'),
      resultSummary = document.getElementById('resultSummary'),
      stats = document.getElementById('stats');
const btnNew = document.getElementById('newGame'),
      rules = document.getElementById('rules'),
      about = document.getElementById('about'),
      settingsButton = document.getElementById('settings'),
      replayIntroButton = document.getElementById('replayIntro'),
      languageSwitch = document.getElementById('languageSwitch'),
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

async function loadDictionaryForLanguage(nextLanguage = language) {
    const dictionary = await j(`assets/data/dictionary.${nextLanguage}-${WORD_LEN}.json`);
    const acceptedWords = playableWords(dictionary.words || [], WORD_LEN);
    const acceptedSet = new Set(acceptedWords);
    ANSWERS_RAW = playableWords(dictionary.answers || acceptedWords, WORD_LEN)
        .filter(word => acceptedSet.has(word));
    WORDS_SET = acceptedSet;
    LOG_I(
        "Dictionnaire chargé :",
        nextLanguage,
        ANSWERS_RAW.length,
        "réponses et",
        WORDS_SET.size,
        "mots acceptés"
    );
}

async function changeLanguage(nextLanguage) {
    const previousLanguage = language;
    const selectedLanguage = supportedLanguage(nextLanguage);
    clearResponseTimer();
    gameLocked = true;
    try {
        await loadMessages(selectedLanguage);
        await loadDictionaryForLanguage(selectedLanguage);
        saveLanguage(selectedLanguage);
        configureIntro();
        applyTranslations();
        newGame({ locked: false });
        updStats();
        return true;
    } catch (error) {
        LOG_E("Changement de langue impossible", error);
        language = previousLanguage;
        await loadMessages(previousLanguage);
        await loadDictionaryForLanguage(previousLanguage);
        applyTranslations();
        showModal(t("error.dictionaryTitle"), `<p>${textKey('error.dictionaryLoad')}</p>`);
        gameLocked = false;
        return false;
    }
}

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
    stats.textContent = t("stats", {
        played: p,
        wins: w,
        rate: p ? Math.round(100 * w / p) : 0,
        streak: s,
        best: b
    });
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
            div.setAttribute('aria-label', t('cell.position', { row: r + 1, column: c + 1 }));
            rowEl.appendChild(div);
            rowArr.push(div);
        }
        grid.push(rowArr);
    }
}

const statusLabels = {
    correct: 'status.correct',
    present: 'status.present',
    absent: 'status.absent'
};

function describeCell(rowIndex, columnIndex, letter = '', status = '') {
    const details = [
        t('cell.position', { row: rowIndex + 1, column: columnIndex + 1 }),
        letter ? t('cell.letter', { letter }) : t('cell.empty')
    ];
    if (status) details.push(t(statusLabels[status]));
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
            b.setAttribute('aria-label', k === '⌫' ? t('keyboard.backspace') : k === '↵' ? t('keyboard.enter') : t('keyboard.letter', { letter: k }));
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
        button.setAttribute('aria-label', `${t('keyboard.letter', { letter })}, ${t(statusLabels[nextState])}`);
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

async function revealGuess(guess, mask, rowIndex, activeGame, { updateKeyboard = true } = {}) {
    const letterDelay = CONFIG?.timing?.letterDelay ?? 500;
    LOG_D("Révélation synchronisée pour", mask);

    for (let index = 0; index < mask.length; index++) {
        if (activeGame !== gameId) return false;

        const status = mask[index];
        const cell = grid[rowIndex][index];
        if (!cell.textContent) cell.textContent = guess[index];
        cell.classList.add(status, 'evaluated');
        describeCell(rowIndex, index, guess[index], status);
        if (updateKeyboard) updateKeyboardLetter(guess[index], status);
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

async function consumeFailedAttempt(message, { rejectedWord = null } = {}) {
    if (gameLocked) return;
    clearResponseTimer();
    gameLocked = true;
    const activeGame = gameId;
    const guess = current.map((letter, index) => letter || confirmedLetters[index] || '·').join('');
    const mask = new Array(WORD_LEN).fill('absent');
    playSound(A.wrong);
    const revealed = await revealGuess(guess, mask, row, activeGame, { updateKeyboard: false });
    if (!revealed) return;
    resultSummary.textContent = message;
    row++;

    if (row >= MAX_TRIES) {
        LOG_E("Défaite après 6 essais");
        rec(false);
        playSound(A.defeat);
        showModal(t("modal.defeatTitle"), `<p>${htmlFromKey('modal.defeatText', { target })}</p>`, newGame);
        return;
    }

    prepareCurrentRow(row);
    setHint(attemptText(MAX_TRIES - row));
    if (rejectedWord) setRejectedWordSummary(rejectedWord, message);
    gameLocked = false;
    startResponseTimer();
}

async function enter() {
    if (gameLocked) return;
    if (!isCurrentComplete()) {
        setHint(t("hint.incomplete"));
        LOG_W("Mot incomplet");
        return;
    }
    const guess = current.join('');
    LOG_I("Proposition :", guess);

    if (!validWord(guess)) {
        if (settings.countInvalidWords) {
            LOG_W("Mot invalide, essai consommé");
            await consumeFailedAttempt(t("result.failedAttempt"), { rejectedWord: guess });
            return;
        }
        setHint(t("hint.invalid"));
        setRejectedWordSummary(guess);
        playSound(A.wrong);
        board.classList.remove('shake');
        requestAnimationFrame(() => board.classList.add('shake'));
        LOG_W("Mot invalide, essai non consommé");
        return;
    }

    clearResponseTimer();
    gameLocked = true;
    const activeGame = gameId;
    const mask = score(guess, target);
    const correctCount = mask.filter(status => status === 'correct').length;
    const presentCount = mask.filter(status => status === 'present').length;
    const absentCount = mask.filter(status => status === 'absent').length;
    const revealed = await revealGuess(guess, mask, row, activeGame);
    if (!revealed) return;
    rememberConfirmedLetters(guess, mask);
    resultSummary.textContent = t("result.summary", {
        correct: correctCount,
        correctPlural: correctCount !== 1 ? 's' : '',
        present: presentCount,
        presentPlural: presentCount !== 1 ? 's' : '',
        absent: absentCount,
        absentPlural: absentCount !== 1 ? 's' : ''
    });

    if (norm(guess) === norm(target)) {
        LOG_I("Victoire :", guess);
        rec(true);
        playSound(A.victory);
        showModal(t("modal.victoryTitle"), `<p>${htmlFromKey('modal.victoryText', { target })}</p>`, newGame);
        return;
    }

    row++;
    LOG_D("Tentative ratée, passage à row", row);
    if (row >= MAX_TRIES) {
        LOG_E("Défaite après 6 essais");
        rec(false);
        playSound(A.defeat);
        showModal(t("modal.defeatTitle"), `<p>${htmlFromKey('modal.defeatText', { target })}</p>`, newGame);
        return;
    }

    prepareCurrentRow(row);
    setHint(attemptText(MAX_TRIES - row));
    gameLocked = false;
    startResponseTimer();
}

function onKey(e) {
    if (!document.getElementById('modal').hidden) {
        if (e.key === 'Escape') closeModal();
        if (e.key === 'Tab') {
            e.preventDefault();
            const focusable = [...document.querySelectorAll(
                '#modal button:not([disabled]), #modal input:not([disabled]), #modal select:not([disabled]), #modal a[href]'
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
    if (!ANSWERS_RAW.length) throw new Error(t('error.noPlayableWords'));
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
        setHint(error.message);
        LOG_E(error.message);
        return;
    }
    row = 0; col = 1;
    confirmedLetters = new Array(WORD_LEN).fill("");
    makeBoard();
    makeKeyboard();
    revealFirst();
    setHint(t("game.initialHint"));
    resultSummary.textContent = "";
    gameLocked = locked;
    startResponseTimer();
}

function unlockGame(activeGame = gameId) {
    if (activeGame !== gameId || !target) return false;
    gameLocked = false;
    document.getElementById('main').focus();
    startResponseTimer();
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

function configureIntro() {
    intro?.destroy();
    intro = createIntro({
        app: document.getElementById('app'),
        duration: CONFIG?.intro?.duration,
        labels: introLabels(),
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
    language = getLanguage();
    await loadMessages(language);
    settings = getSettings();
    applyTheme(getTheme());
    try {
        await loadDictionaryForLanguage(language);
    } catch (e) {
        LOG_E("Erreur de chargement dictionnaire", e);
        showModal(t("error.dictionaryTitle"), `<p>${textKey('error.dictionaryLoad')}</p>`);
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
        t("rules.title"),
        `<p>${textKey('rules.intro')}</p>
         <ul>
           <li><strong>${textKey('rules.correct')}</strong> ${textKey('rules.correctText')}</li>
           <li><strong>${textKey('rules.present')}</strong> ${textKey('rules.presentText')}</li>
           <li><strong>${textKey('rules.absent')}</strong> ${textKey('rules.absentText')}</li>
           <li>${textKey('rules.confirmed')}</li>
         </ul>`
      );
    };

    about.onclick = showAbout;
    replayIntroButton.onclick = replayIntro;
    settingsButton.onclick = showSettings;
    languageSwitch.onclick = async event => {
        const button = event.target.closest('[data-language]');
        if (!button || button.dataset.language === language) return;
        await changeLanguage(button.dataset.language);
    };

    themeToggle.onclick = () => {
        const theme = getTheme() === "dark" ? "light" : "dark";
        setTheme(theme);
    };
    configureIntro();
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
