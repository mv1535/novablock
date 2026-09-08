# Novablock

Novablock bloque les Shorts sans casser la navigation. La version 1.1 couvre deux environnements :

- `extension/` : Chrome/Chromium sur PC et navigateurs Android acceptant les extensions;
- `android/` : application native pour l'application YouTube Android.

## Expérience obtenue

### PC et navigateur mobile

- Un clic sur un lien Short est intercepté **avant** la navigation. La page, son défilement et ses filtres ne changent pas; un discret message confirme le blocage.
- Un Short ouvert par un lien externe est immédiatement mis en pause et couvert dans la page même.
- Toute la vue Novablock est une sortie : clic, toucher ou `Échap` revient à l'endroit précédent.
- Le retour utilise d'abord l'historique réel de l'onglet, ce qui restaure l'état d'une application monopage. Plusieurs Shorts consécutifs sont sautés en une action.
- Sans historique, Novablock rend l'onglet qui a ouvert le Short; en dernier recours seulement, il ouvre l'accueil sain de la plateforme.
- Le défi de déverrouillage s'ouvre séparément. Annuler rend la page source; réussir reprend le Short demandé.

### Application YouTube Android

- Le service d'accessibilité écoute uniquement `com.google.android.youtube`.
- Il reconnaît le lecteur Shorts par identifiants de vues forts, avec un repli prudent pour l'interface Compose.
- Il exécute le retour Android **avant** d'afficher Novablock. L'application située dessous est donc déjà revenue exactement où elle était.
- Toucher la vue la ferme immédiatement; sans action, elle disparaît après 2,2 secondes.
- La vue est une superposition d'accessibilité, pas une activité : elle ne crée aucun onglet, aucune entrée dans les applications récentes et aucune boucle de retour.

## Tester

```bash
npm run check
```

Les tests couvrent les règles d'URL, les liens sûrs, le retour par historique, les séries de Shorts, les nouveaux onglets, les replis et le détecteur Android. La CI compile également l'APK, exécute les tests Android et Android Lint.

## Installer pour le développement

### Extension PC

1. Ouvrir `chrome://extensions`.
2. Activer le mode développeur.
3. Choisir **Charger l'extension non empaquetée**.
4. Sélectionner le dossier `extension/`.

Le fichier `extension/manifest.json` conserve la clé publique de l'extension distribuée, donc son identifiant reste documenté. Pour publier un nouveau `.crx`, il faut impérativement empaqueter `extension/` avec le fichier privé `.pem` original. Ce fichier ne doit jamais entrer dans Git.

### Android natif

1. Ouvrir `android/` dans Android Studio.
2. Construire et installer `app` sur l'appareil.
3. Ouvrir Novablock puis **Activer dans Accessibilité**.
4. Autoriser **Protection contre les Shorts**.

Sur certaines versions Android, une application installée manuellement exige d'abord **Autoriser les paramètres restreints** depuis sa fiche système.

## Confidentialité

Novablock n'utilise aucun serveur, aucune télémétrie et aucun compte. L'extension conserve seulement les compteurs, l'expiration d'un accès temporaire et la dernière URL saine par onglet. Le service Android lit temporairement l'arbre d'accessibilité visible de YouTube pour classifier l'écran; il ne stocke ni texte, ni vidéo, ni historique.
