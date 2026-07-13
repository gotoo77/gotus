# Entretenir l’historique et publier une release

## Pendant le développement

Toute évolution notable est ajoutée dans la section `[À venir]` de `CHANGELOG.md`, dans la même modification que le code concerné.

Une entrée est attendue pour :

- une fonctionnalité visible ou un changement de comportement ;
- une correction qui affectait les joueurs ;
- une évolution d’accessibilité, de sécurité ou de compatibilité ;
- une modification importante du dictionnaire ou des données ;
- une migration, une dépréciation ou une suppression ;
- une évolution significative du déploiement.

Les renommages internes, reformattages, tests seuls et corrections typographiques mineures n’ont généralement pas besoin d’entrée.

Catégories recommandées : `Ajouté`, `Modifié`, `Corrigé`, `Accessibilité`, `Sécurité`, `Déprécié` et `Supprimé`. Seules les catégories utiles doivent être créées.

Une bonne entrée décrit l’effet pour l’utilisateur ou le projet :

```text
- synchronisation de la révélation visuelle des lettres avec les effets sonores.
```

Elle évite les détails de commit :

```text
- modification de revealGuess() et ajout d’une classe CSS.
```

## Préparer une release

1. Choisir le prochain numéro selon le versionnage sémantique.
2. Mettre à jour `version`, `gotus.release` et `gotus.channel` dans `package.json`.
3. Renommer `[À venir]` en `[X.Y.Z] — Nom de release — date` dans `CHANGELOG.md`.
4. Recréer une section `[À venir]` vide au-dessus de la release.
5. Générer les métadonnées, synchroniser la version des fichiers publics et exécuter les contrôles :

   ```bash
   npm run build-info
   npm run check
   ```

6. Committer, pousser `main`, créer puis pousser le tag `vX.Y.Z`, et enfin créer la GitHub Release à partir de ce tag :

   ```bash
   git push origin main
   git tag -a vX.Y.Z -m "Gotus X.Y.Z — Nom de release"
   git push origin vX.Y.Z
   ```

Le workflow de déploiement régénère ensuite le site complet :

- `/gotus/` contient la release au numéro le plus élevé ;
- `/gotus/dev/` contient l’état courant de `main` ;
- `/gotus/versions/` présente l’historique ;
- `/gotus/versions/X.Y.Z/` conserve une version jouable du tag `vX.Y.Z`.

Les tags de release doivent respecter strictement le format `vMAJEURE.MINEURE.CORRECTIF`. Chaque déploiement reconstruit l’ensemble des tags afin de ne pas perdre les versions historiques lorsque GitHub Pages remplace son artefact.

Pour prévisualiser localement la structure publiée :

```bash
npm run build:pages
python3 -m http.server 8081 --directory .pages
```
