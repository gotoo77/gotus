# 🎯 Gotus

Gotus est un jeu de lettres inspiré de Motus et Wordle, réalisé en HTML, CSS et JavaScript natifs, sans dépendance d’exécution.

**[Jouer à la démo](https://gotoo77.github.io/gotus/)**

## Fonctionnalités

- thème sombre et clair mémorisé localement ;
- clavier physique et clavier virtuel AZERTY ;
- sons et animations configurables ;
- validation à partir d’un dictionnaire local ;
- 7 187 mots acceptés et 1 959 réponses courantes issus de Lexique 4 ;
- historique des parties et statistiques dans `localStorage` ;
- panneau de logs intégré, accessible avec `Ctrl + L` ou `Cmd + L` ;
- interface responsive et utilisable au clavier ;
- thème clair/sombre persistant, contrastes renforcés et états différenciés autrement que par la couleur.

## Lancer le projet

```bash
git clone https://github.com/gotoo77/gotus.git
cd gotus
npm run dev
```

Ouvrez ensuite <http://localhost:8080>. Un serveur local est nécessaire, car le jeu charge sa configuration et son dictionnaire avec `fetch`.

## Vérifier le projet

Node.js 20 ou plus récent est recommandé pour exécuter les tests du moteur de jeu.

```bash
npm test
npm run check
```

## Structure

```text
gotus/
├── .github/workflows/       Vérifications automatiques
├── assets/
│   ├── css/gotus.css        Thèmes, responsive et animations
│   ├── data/                Configuration et dictionnaire généré
│   ├── images/favicon.svg   Icône du site
│   ├── js/                  Application, moteur et logger
│   └── sounds/              Effets sonores
├── scripts/                 Générateurs du dictionnaire et des sons
├── tests/                   Tests JavaScript et Python
├── .devmenu.json            Menu des commandes de développement
├── index.html               Unique point d’entrée public à la racine
├── package.json             Commandes de test et de vérification
└── CREDITS.md               Auteurs, licences et ressources tierces
```

## Configuration

Les chemins des sons, le délai entre les sons et le thème par défaut sont modifiables dans `assets/data/config.json` :

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
  "timing": {
    "letterDelay": 300
  },
  "theme": "dark"
}
```

## Dictionnaire

Le dictionnaire est dérivé de la base académique française [Lexique 4](https://lexique.org/), qui fournit notamment des fréquences d’usage et des indices de prévalence.

- `words` contient les 7 187 propositions reconnues par le jeu ;
- `answers` contient 1 959 lemmes suffisamment fréquents et connus pour être tirés au sort ;
- les noms propres, graphies non alphabétiques, doublons et mots d’une autre longueur sont écartés.

Pour régénérer le fichier depuis la source :

```bash
npm run dictionary
```

Les seuils de sélection et la provenance sont inscrits dans `assets/data/dictionary.fr-6.json`. Les détails d’attribution figurent dans [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Accessibilité

L’interface est conçue en visant WCAG 2.2 niveau AA et le RGAA 4.1.2 : navigation au clavier, lien d’évitement, focus visible, modale confinée, zones tactiles adaptées, contrastes vérifiés, reflow mobile et alternative visuelle aux seules couleurs.

Cela ne constitue pas une déclaration officielle de conformité : celle-ci nécessite un audit complet des critères applicables, avec plusieurs navigateurs et technologies d’assistance.

## Licence

Le code source est distribué sous licence MIT. Le dictionnaire dérivé reste sous CC BY-SA 4.0 conformément à sa source. Voir [CREDITS.md](CREDITS.md), [LICENSE](LICENSE) et [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Versions et releases

Gotus suit le versionnage sémantique `MAJEURE.MINEURE.CORRECTIF`. La version et le nom de release sont définis dans `package.json`, puis les informations publiques du build sont générées avec :

```bash
npm run build-info
```

Cette commande produit `assets/data/build-info.json` avec la version, la release, le canal, la date UTC du build et le commit Git. Elle synchronise également les en-têtes `@version` et les clés anti-cache `?v=` des fichiers publics. Dans le jeu, le bouton **À propos** ou le raccourci `Alt + V` affiche ces informations et les crédits.

Les changements de chaque release sont consignés dans [CHANGELOG.md](CHANGELOG.md). Les évolutions en cours sont ajoutées sous `[À venir]` au fil du développement ; le processus complet est décrit dans [docs/RELEASING.md](docs/RELEASING.md).

## Déploiement multi-version

Le workflow GitHub Pages publie plusieurs états du jeu dans un même site :

- [dernière release stable](https://gotoo77.github.io/gotus/) à la racine ;
- [développement actuel](https://gotoo77.github.io/gotus/dev/) sous `/dev/` ;
- [historique des versions](https://gotoo77.github.io/gotus/versions/) sous `/versions/` ;
- chaque tag `vX.Y.Z` sous `/versions/X.Y.Z/`.

La commande suivante reconstruit localement le même artefact dans `.pages/` :

```bash
npm run build:pages
```

Le dépôt doit utiliser **GitHub Actions** comme source dans **Settings → Pages → Build and deployment**. Le workflow `.github/workflows/pages.yml` prend ensuite en charge les publications déclenchées par `main`, les tags de release et les lancements manuels.
