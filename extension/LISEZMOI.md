# Extension Novablock

Cette extension bloque les Shorts YouTube et les Reels Facebook/Instagram. Les vidéos normales, les fils, les stories et Explorer restent disponibles.

## Navigation sans irritant

Novablock ne remplace plus la page courante par une page d'extension :

- le clic vers un format court est annulé avant que l'application change d'écran;
- un lien direct affiche le blocage au-dessus de la page et coupe immédiatement le média;
- toucher ou cliquer la vue revient par l'historique réel, donc conserve le défilement et l'état de YouTube;
- un nouvel onglet de Short est fermé et son onglet source est rendu;
- ouvrir puis fermer le popup Novablock ne recharge jamais la page active.

Le déverrouillage volontaire reste exigeant : deux minutes de maintien continu accordent quinze minutes. Le défi s'ouvre dans une vue séparée afin que l'annulation ne détruise pas le contexte.

## Développement

Charger ce dossier avec **Charger l'extension non empaquetée** dans `chrome://extensions`.

Pour valider depuis la racine du dépôt :

```bash
npm run check
```

## Publication Windows

La version imposée par stratégie Chrome doit conserver le même identifiant. Il faut donc empaqueter ce dossier avec le fichier privé `novablock.pem` original :

1. incrémenter `version` dans `manifest.json`;
2. ouvrir `chrome://extensions` puis **Empaqueter l'extension**;
3. sélectionner ce dossier et le `.pem` original;
4. remplacer `/novablock.crx` à la racine du site de mise à jour;
5. reporter exactement la même version dans `/update.xml`;
6. ne jamais publier, joindre ou committer le `.pem`.

Cette modification ne change pas la stratégie Windows déjà installée. Elle porte uniquement sur le comportement et l'interface de l'extension.
