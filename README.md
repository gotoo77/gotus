# 🎯 Gotus

**Gotus** est un petit jeu de lettres inspiré de *Motus* (ou *Wordle*), codé en **HTML / CSS / JavaScript pur**, sans dépendance externe.  
Une création fun, minimaliste et responsive, avec sons, animations et un logger intégré façon console de dev 🎛️

## 🕹️ Démo
> 🚀 Disponible sur GitHub Pages :  
> 👉 [https://gotoo77.github.io/gotus/](https://gotoo77.github.io/gotus/)

## ✨ Fonctionnalités

- 🎨 Interface moderne, thème sombre & clair
- 🔊 Sons personnalisés (OK / présent / absent / victoire / défaite / erreur)
- 💬 Fenêtres modales élégantes pour la victoire, la défaite et les règles
- 🧩 Validation complète avec dictionnaire JSON local
- ⚙️ Paramétrage facile via `config.json` (timing, sons, thème)
- 🧠 Historique de parties et statistiques (localStorage)
- 🪵 Logger intégré (`Ctrl + L`) avec niveaux DEBUG / INFO / WARN / ERROR
- 🎚️ Filtres et effacement des logs directement dans la page

## 🧰 Structure du projet
gotus/
├── index.html
├── style.css
├── script.js
├── logger.js
├── config.json
├── dictionnaire.json
└── assets/
└── sounds/
├── ok.wav
├── present.wav
├── absent.wav
├── victory.wav
├── defeat.wav
└── wrong.wav

## 💻 Installation locale

1. Clone le projet :
```bash
git clone https://github.com/<ton_user>/gotus.git
cd gotus
```
Lance un petit serveur local :
```
python3 -m http.server 8080 --bind localhost
```

Puis ouvre http://localhost:8080 dans ton navigateur.


##🎵 Personnalisation

### config.json
```json
{
  "sound": {
    "ok": "assets/sounds/ok.wav",
    "present": "assets/sounds/present.wav",
    "absent": "assets/sounds/absent.wav",
    "victory": "assets/sounds/victory.wav",
    "defeat": "assets/sounds/defeat.wav",
    "wrong": "assets/sounds/wrong.wav"
  },
  "timing": { "letterDelay": 300 },
  "theme": "dark"
}
```

## dictionnaire.json
Contient les mots valides (extrait de liste FR 6 lettres).

##⌨️Raccourcis utiles
- Action	Touche
- Valider le mot	Entrée
- Supprimer une lettre	⌫ (Backspace)
- Ouvrir / fermer le logger	Ctrl + L
- Changer le thème	bouton 🌗 en haut à droite

## 🧠 Crédits
 -💻 Code original : Gotoo
 -🔊 Sons : générés avec generate_sound.py
 -🎨 Design : minimaliste inspiré de Wordle / Motus
 -🧩 Licence : MIT — libre à modifier, partager et améliorer
 
“Devine le mot, écoute les sons, et bats ton record.” 🎧

