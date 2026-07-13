/**
 * Gotus — console visuelle de développement.
 * @version 2.2.0
 * @author Gotoo et les contributeurs
 * @license MIT
 */
const LEVELS = { D: 0, I: 1, W: 2, E: 3 };
let CURRENT_LEVEL = LEVELS.I;
let panel = null;
let container = null;
let focusBeforePanel = null;

// 🖍️ couleurs console
function color(level) {
    switch (level) {
        case "D": return "color:#9ca3af";
        case "I": return "color:#22d3ee";
        case "W": return "color:#facc15";
        case "E": return "color:#ef4444";
        default: return "";
    }
}

// 🕐 horodatage
function timestamp() {
    const d = new Date();
    return d.toISOString().split("T")[1].split(".")[0];
}

// 🪟 panneau visuel
function ensurePanel() {
    if (panel) return;
    panel = document.createElement("div");
    panel.id = "gotus-log-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Journal de développement");
    panel.tabIndex = -1;
    panel.innerHTML = `
        <div id="gotus-log-header">
            <span>🧩 LOG</span>
            <select id="gotus-log-filter" aria-label="Niveau minimal des messages">
                <option value="D">DEBUG</option>
                <option value="I" selected>INFO+</option>
                <option value="W">WARN+</option>
                <option value="E">ERROR</option>
            </select>
            <button id="gotus-log-clear" type="button">Effacer</button>
            <button id="gotus-log-close" type="button" aria-label="Fermer le journal">×</button>
        </div>
        <div id="gotus-log-body" role="log" aria-label="Messages enregistrés"></div>
    `;
    document.body.appendChild(panel);
    container = panel.querySelector("#gotus-log-body");
    document.getElementById("gotus-log-clear").onclick = () => (container.innerHTML = "");
    document.getElementById("gotus-log-close").onclick = closePanel;
    document.getElementById("gotus-log-filter").onchange = (e) => setLevel(e.target.value);
}

function closePanel() {
    if (!panel?.classList.contains("visible")) return;
    panel.classList.remove("visible");
    focusBeforePanel?.focus?.();
}

// 🧱 insertion d’une ligne dans le panneau
function appendToPanel(level, msg) {
    ensurePanel();
    const div = document.createElement("div");
    div.className = `log-line level-${level}`;
    div.textContent = `[${timestamp()}] [${level}] ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function refreshPanelVisibility() {
    if (!container) return;
    const levelOrder = { D: 0, I: 1, W: 2, E: 3 };
    const min = CURRENT_LEVEL;
    const lines = container.querySelectorAll('.log-line');
    lines.forEach(line => {
        const lvl = line.classList.contains('level-D') ? 0 :
                    line.classList.contains('level-I') ? 1 :
                    line.classList.contains('level-W') ? 2 :
                    3;
        line.style.display = lvl >= min ? 'block' : 'none';
    });
}

// 🪵 fonction principale
function _log(level, ...args) {
    const txt = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");
    console.log(`%c[${timestamp()}] [${level}]`, color(level), ...args);
    appendToPanel(level, txt);
    refreshPanelVisibility(); // ✅ filtre en live
}

// 🚦 API publique
export const LOG_D = (...a) => _log("D", ...a);
export const LOG_I = (...a) => _log("I", ...a);
export const LOG_W = (...a) => _log("W", ...a);
export const LOG_E = (...a) => _log("E", ...a);

export function setLevel(lvl) {
    const key = lvl?.[0]?.toUpperCase?.();
    if (key in LEVELS) {
        CURRENT_LEVEL = LEVELS[key];
        LOG_I(`🔧 Niveau de log changé : ${key}`);
        refreshPanelVisibility(); // ✅ met à jour l’affichage existant
    }
    const select = document.getElementById("gotus-log-filter");
    if (select) select.value = key;
}

export const LOG = { D: LOG_D, I: LOG_I, W: LOG_W, E: LOG_E, setLevel };

// 🎹 Toggle clavier : Ctrl+L ou Cmd+L
document.addEventListener("keydown", (e) => {
    // ignore si on tape dans un champ texte
    if (["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault(); // évite le raccourci "focus barre d’adresse"
        ensurePanel();
        const willOpen = !panel.classList.contains("visible");
        if (willOpen) {
            focusBeforePanel = document.activeElement;
            panel.classList.add("visible");
            panel.focus();
        } else {
            closePanel();
        }
        LOG_I("🪶 Panneau de logs " + (panel.classList.contains("visible") ? "ouvert" : "fermé"));
    } else if (e.key === "Escape" && panel?.classList.contains("visible")) {
        closePanel();
    }
});
