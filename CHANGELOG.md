# Historique des versions

Toutes les évolutions notables de Gotus sont regroupées dans ce fichier. Le projet suit le versionnage sémantique `MAJEURE.MINEURE.CORRECTIF` et les changements sont classés par impact plutôt que par commit.

## [À venir]

Les évolutions importantes en cours sont ajoutées ici au moment où elles sont développées. Cette section est transférée sous un numéro de version lors de la prochaine release.

### Ajouté

- menu de réglages permettant d’activer les réponses chronométrées, de choisir une durée entre 5 et 30 secondes, et de compter les mots hors dictionnaire comme essais perdus.
- chrono visuel en camembert dont la couleur s’intensifie à l’approche de la fin du temps.
- signalement GitHub prérempli pour les mots refusés comme hors dictionnaire.
- allowlist versionnée pour accepter des propositions validées manuellement sans les ajouter aux réponses tirées au sort.
- base d’internationalisation avec catalogues français et anglais, sélection de langue persistante et dictionnaire anglais de démarrage.

### Modifié

- le changement de thème est désormais un contrôle discret dans l’en-tête, séparé des réglages de partie.
- le serveur local de développement expose par défaut une URL utilisable depuis Windows lorsque le projet tourne sous WSL.
- les valeurs par défaut du serveur local sont désormais centralisées dans `scripts/dev_server.config.json`.

### Corrigé

- le générique sonore attend désormais une action explicite au premier affichage, afin de respecter les politiques d’autoplay des navigateurs desktop sans perdre la synchronisation audio.
- le serveur local de développement affiche désormais une erreur lisible quand le port est indisponible.
- les lettres déjà bien placées sont désormais réaffichées comme repères dans les essais suivants, sans empêcher de proposer un autre mot compatible avec la première lettre.

## [2.3.0] — Le générique — 13 juillet 2026

### Ajouté

- générique d’introduction original inspiré des plateaux de jeux de lettres rétro, affiché à la première visite, passable et rejouable à la demande ;
- préférence persistante pour activer ou désactiver l’affichage automatique et habillage sonore original synchronisé avec les rebonds, impacts, lettres et pulsation finale.

### Modifié

- publication versionnée de GitHub Pages avec une version stable, un canal de développement et des snapshots jouables pour chaque release taguée.
- suppression des anciens fichiers relais à la racine et renommage des points d’entrée en `gotus.js` et `gotus.css`, avec métadonnées de version et de crédits synchronisées.
- documentation du processus d’entretien du changelog et de préparation des releases.

### Corrigé

- démarrage et statistiques désormais résilients lorsque le stockage local ou le générique ne sont pas disponibles.

### Accessibilité

- version courte et sobre du générique lorsque la réduction des animations est demandée, gestion complète du clavier, du focus et du verrouillage temporaire du jeu.

## [2.2.0] — Lexique & accessibilité — 13 juillet 2026

### Ajouté

- enrichissement du dictionnaire à partir de Lexique 4 ;
- séparation des réponses courantes et des propositions acceptées ;
- thèmes clair et sombre persistants ;
- informations de version et de build accessibles depuis le jeu.

### Modifié

- révélation des couleurs synchronisée avec les sons ;
- réorganisation des sources sous `assets/`.

### Accessibilité

- amélioration responsive, WCAG 2.2 et RGAA ;
- navigation clavier, modales, contrastes et alternatives aux informations données par la couleur.

## [2.0.0] — Version initiale

### Ajouté

- jeu de lettres de six caractères en HTML, CSS et JavaScript natifs ;
- sons, statistiques locales, thèmes et console de développement.
