import { LOG_D, LOG_I, LOG_W, LOG_E, LOG } from './logger.js';

const WORD_LEN = 6, MAX_TRIES = 6;
let CONFIG = { timing: { letterDelay: 500 }, theme: "dark" };
let DICT = { words: [] };
const THEME_KEY = "gotus-theme";


function showMessage(text, type = "info") {
    LOG_I("Popup message :", text);
    let msg = document.createElement("div");
    msg.className = `popup ${type}`;
    msg.textContent = text;
    document.body.appendChild(msg);
    setTimeout(() => msg.classList.add("visible"), 10);
    setTimeout(() => msg.classList.remove("visible"), 3000);
    setTimeout(() => msg.remove(), 3500);
}

function showModal(title, text, type = "info") {
    LOG_I("Modal affichée :", title, text);
    const modal = document.getElementById('modal');
    const titleEl = document.getElementById('modal-title');
    const textEl = document.getElementById('modal-text');
    const okBtn = document.getElementById('modal-ok');

    titleEl.textContent = title;
    textEl.innerHTML = text; // ✅ ici : remplace textContent par innerHTML

    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('visible'), 10);

    okBtn.onclick = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.classList.add('hidden'), 300);
    };
}

function stripAccents(s) {
    return s.normalize('NFD').replace(/\p{Mn}+/gu, '');
}
function norm(s) {
    return stripAccents(s).toUpperCase();
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
    document.documentElement.classList.toggle("light", t === "light");
}
function getTheme() {
    return localStorage.getItem(THEME_KEY) || CONFIG.theme || "dark";
}
function setTheme(t) {
    LOG_I("Changement de thème :", t);
    localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
}

const board = document.getElementById('board'),
      hint = document.getElementById('hint'),
      stats = document.getElementById('stats');
const btnNew = document.getElementById('newGame'),
      rules = document.getElementById('rules'),
      themeToggle = document.getElementById('themeToggle');
const A = {
    ok: document.getElementById('sfx-ok'),
    present: document.getElementById('sfx-present'),
    absent: document.getElementById('sfx-absent'),
    victory: document.getElementById('sfx-victory'),
    defeat: document.getElementById('sfx-defeat'),
    wrong: document.getElementById('sfx-wrong')
};

let WORDS_RAW = [], WORDS_SET = new Set();
let target = "", row = 0, col = 1, grid = [], current = new Array(WORD_LEN).fill("");

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
        localStorage.setItem('gotus-stats', JSON.stringify(d));
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
        for (let c = 0; c < WORD_LEN; c++) {
            const div = document.createElement('div');
            div.className = 'cell';
            div.setAttribute('aria-live', 'polite');
            board.appendChild(div);
            rowArr.push(div);
        }
        grid.push(rowArr);
    }
}

function revealFirst() {
    LOG_D("Révélation première lettre :", target[0]);
    grid[0][0].textContent = target[0];
    current = new Array(WORD_LEN).fill("");
    current[0] = target[0];
    col = 1;
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
    for (const r of KEY_ROWS) {
        for (const k of r) {
            const b = document.createElement('button');
            b.className = 'key';
            b.textContent = k;
            if (k === "⌫" || k === "↵") b.dataset.wide = "1";
            b.onclick = () => vk(k);
            kb.appendChild(b);
        }
    }
}

function vk(k) {
    LOG_D("Touche virtuelle :", k);
    if (k === "⌫") back();
    else if (k === "↵") enter();
    else char(k);
}

function char(ch) {
    if (!grid || !grid[row]) return;
    if (row >= MAX_TRIES) return;
    if (col < WORD_LEN && /^[A-ZÀÂÄÇÉÈÊËÏÎÔÖÙÛÜŸŒÆ]$/.test(ch)) {
        current[col] = ch;
        LOG_D(`Saisie : ${ch} à (${row},${col})`);
        const cell = grid[row][col];
        if (!cell) return;
        cell.textContent = ch;
        cell.classList.add('reveal');
        setTimeout(() => {
            if (cell && cell.classList) cell.classList.remove('reveal');
        }, 150);
        col = Math.min(col + 1, WORD_LEN);
    }
}

function back() {
    if (col > 1) {
        col--;
        LOG_D("Suppression lettre à col", col);
        current[col] = "";
        grid[row][col].textContent = "";
    }
}

function score(guess, targ) {
    const res = Array(WORD_LEN).fill('absent');
    const g = norm(guess), t = norm(targ);
    const cnt = {};
    for (let i = 0; i < WORD_LEN; i++) {
        if (g[i] === t[i]) res[i] = 'correct';
        else cnt[t[i]] = (cnt[t[i]] || 0) + 1;
    }
    for (let i = 0; i < WORD_LEN; i++) {
        if (res[i] === 'correct') continue;
        const ch = g[i];
        if (cnt[ch] > 0) {
            res[i] = 'present';
            cnt[ch]--;
        }
    }
    LOG_D("Score pour", guess, "→", res.join(","));
    return res;
}

function playMask(mask) {
    const d = (CONFIG?.timing?.letterDelay ?? 500);
    LOG_D("Lecture sons pour mask", mask);
    const seq = mask.map(m => m === 'correct' ? A.ok : m === 'present' ? A.present : A.absent);
    seq.forEach((a, i) => setTimeout(() => {
        try { a.currentTime = 0; a.play(); } catch (_) {}
    }, i * d));
}

function validWord(guess) {
    const v = WORDS_SET.has(norm(guess));
    if (!v) LOG_W("Mot non valide :", guess);
    return v;
}

async function enter() {
    if (col < WORD_LEN) {
        hint.textContent = "Mot incomplet…";
        LOG_W("Mot incomplet");
        return;
    }
    const guess = current.join('');
    LOG_I("Proposition :", guess);

    if (!validWord(guess)) {
        hint.textContent = "Mot invalide (hors dictionnaire).";
        try { if (A.wrong) { A.wrong.currentTime = 0; A.wrong.play(); } } catch (_) {}
        row++;
        LOG_W("Mot invalide, tentative", row);
        if (row >= MAX_TRIES) {
            LOG_E("Échec final : plus d'essais");
            rec(false);
            setTimeout(() => {
                try { A.defeat.currentTime = 0; A.defeat.play(); } catch (_) {}
                //showMessage("💀 Perdu… C'était " + target + ".", "defeat");
                showModal("💀 Défaite", `Le mot était <b>${target}</b>…`);
                newGame();
            }, 600);
            return;
        }
        col = 1;
        current = new Array(WORD_LEN).fill("");
        current[0] = target[0];
        grid[row][0].textContent = target[0];
        return;
    }

    const mask = score(guess, target);
    mask.forEach((cl, i) => grid[row][i].classList.add(cl));
    playMask(mask);

    const totalDelay = (CONFIG?.timing?.letterDelay ?? 500) * WORD_LEN + 120;
    if (norm(guess) === norm(target)) {
        LOG_I("Victoire :", guess);
        rec(true);
        setTimeout(() => {
            try { A.victory.currentTime = 0; A.victory.play(); } catch (_) {}
            //showMessage("🎉 Bravo ! Le mot était " + target + " !", "victory");
            showModal("🎉 Victoire !", `Le mot était <b>${target}</b> !`);
            newGame();
        }, totalDelay);
        return;
    }

    row++;
    LOG_D("Tentative ratée, passage à row", row);
    if (row >= MAX_TRIES) {
        LOG_E("Défaite après 6 essais");
        rec(false);
        setTimeout(() => {
            try { A.defeat.currentTime = 0; A.defeat.play(); } catch (_) {}
            //showMessage("💀 Perdu… C'était " + target + ".", "defeat");
            showModal("💀 Défaite", `Le mot était <b>${target}</b>…`);
            newGame();
        }, totalDelay);
        return;
    }

    col = 1;
    current = new Array(WORD_LEN).fill("");
    current[0] = target[0];
    grid[row][0].textContent = target[0];
}

function onKey(e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (e.key === "Enter") enter();
    else if (e.key === "Backspace") back();
    else if (/^[a-zA-Zàâäçéèêëïîôöùûüÿœæ]$/.test(e.key)) char(e.key.toUpperCase());
}

function sample() {
    const pool = WORDS_RAW.filter(w => norm(w).length === WORD_LEN);
    const s = pool[Math.floor(Math.random() * pool.length)].toUpperCase();
    LOG_I("Nouveau mot cible :", s);
    return s;
}

function newGame() {
    LOG_I("Nouvelle partie");
    target = sample();
    row = 0; col = 1;
    makeBoard();
    revealFirst();
    hint.textContent = "Devine le mot de 6 lettres. Entrée pour valider, ⌫ pour effacer.";
}

async function boot() {
    LOG_I("Boot du jeu Gotus");
    try {
        CONFIG = await j('config.json');
        LOG_I("Config chargée :", CONFIG);
    } catch (e) {
        LOG_W("Config load failed:", e);
    }
    applyTheme(getTheme());
    try {
        const D = await j('dictionnaire.json');
        DICT = D;
        WORDS_RAW = D.words || [];
        WORDS_SET = new Set(WORDS_RAW.map(norm));
        LOG_I("Dictionnaire chargé :", WORDS_RAW.length, "mots");
    } catch (e) {
        LOG_E("Erreur de chargement dictionnaire", e);
        showModal("⚠️ Erreur", "Impossible de charger le dictionnaire.", "error");
    }
    makeBoard();
    makeKeyboard();
    newGame();
    updStats();
    btnNew.onclick = newGame;
    document.addEventListener('keydown', onKey);

    rules.onclick = (e) => {
      e.preventDefault();
      showModal(
        "📜 Règles du jeu",
        "Devine le mot de 6 lettres en 6 essais.<br><br>🔴 Bien placé<br>🟡 Présent<br>🔵 Absent",
        "info"
      );
    };

    themeToggle.onclick = () => setTheme(getTheme() === "dark" ? "light" : "dark");
    LOG_I("Interface initialisée");
}
 

boot();
