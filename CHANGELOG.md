# Historique des versions

Toutes les évolutions notables de Gotus sont regroupées dans ce fichier. Le projet suit le versionnage sémantique `MAJEURE.MINEURE.CORRECTIF` et les changements sont classés par impact plutôt que par commit.

## [À venir]

Les évolutions importantes en cours sont ajoutées ici au moment où elles sont développées. Cette section est transférée sous un numéro de version lors de la prochaine release.

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
