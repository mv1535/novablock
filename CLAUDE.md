# Travailler dans Novablock

Ce fichier dit **comment travailler ici**. Ce que fait le produit et comment
l'installer sont dans [README.md](README.md).

En un mot : Novablock bloque les Shorts **sans casser la navigation**. Cette
seconde moitié de la phrase est l'exigence difficile, et c'est elle qui
gouverne presque toutes les décisions du dépôt.

---

## 1. La règle de cohérence

**Aucune modification de comportement n'est terminée tant que tout ce qui
dépend de ce comportement n'a pas été revu.** Elle passe avant la rapidité.

### Le principe, et pourquoi il mord particulièrement ici

Deux demandes se ressemblent et n'ont rien à voir :

- **Ajouter un geste** — un bouton, une couleur, un texte. Cela ne touche
  personne d'autre.
- **Ajouter une source de vérité** — une nouvelle façon de répondre à une
  question que le produit pose déjà ailleurs. Cela oblige à revoir *tous ceux
  qui posent cette question*.

Ce dépôt tient **deux implémentations d'une même promesse**, dans deux langages,
pour deux environnements : l'extension en JavaScript, l'application Android en
Java. Elles ne partagent aucune ligne de code. Rien, mécaniquement, ne signale
qu'une règle changée d'un côté doit l'être de l'autre — ni le compilateur, ni
les tests, qui sont eux aussi séparés.

C'est le piège principal du projet. La question à se poser devant chaque
changement est donc : **« est-ce que l'autre plateforme doit suivre ? »** La
réponse peut légitimement être non — mais elle doit être donnée, pas oubliée.

### La procédure, en quatre temps

**1. Nommer la notion.** Écrire en français la question touchée : « ceci
est-il du contenu court à bloquer ? », « où faut-il revenir après un
blocage ? », « cet accès temporaire est-il encore valide ? »

**2. Inventorier ses lecteurs**, des deux côtés de la frontière :

```sh
grep -rn "MOTIFS_BLOQUES\|estBloquee" extension/ tests/
grep -rn "IDS_LECTEUR_COURT\|IDS_ENTREE_COURT" android/ tests/
```

**3. Passer la liste des surfaces** (ci-dessous).

**4. Rendre compte.** Le rapport nomme la notion, dit ce qui a été aligné, et
dit explicitement ce que l'autre plateforme fait ou ne fait pas — avec la
raison.

### Les surfaces à vérifier

| Surface | Fichier |
|---|---|
| Règles d'URL | `extension/url-rules.js` — sans dépendance, testable dans Node |
| Interception avant navigation | `extension/content.js` |
| Service worker, onglets, historique | `extension/background.js` |
| Vue de blocage et déverrouillage | `extension/block.js`, `block.html`, `block.css` |
| Options et popup | `extension/options.js`, `popup.js` |
| Permissions et clé publique | `extension/manifest.json` |
| Détection Android (pure) | `android/…/ShortsDetector.java` |
| Service d'accessibilité | `android/…/ShortsAccessibilityService.java` |
| Textes de l'application Android | `android/…/res/values/strings.xml` |
| Tests extension | `tests/url-rules.test.js`, `tests/background-navigation.test.js` |
| Tests Android | `android/…/test/…/ShortsDetectorTest.java`, `tests/java/…/ShortsDetectorSelfTest.java` |
| Documentation visible | `README.md`, `extension/LISEZMOI.md` |

### Registre des notions à sources multiples

**« Ceci est-il du contenu court à bloquer ? »** — deux mécanismes sans rapport :

| Où | Comment | Couverture |
|---|---|---|
| `extension/url-rules.js` | motifs d'URL (`MOTIFS_BLOQUES`) | YouTube Shorts, Instagram Reels, Facebook Reels, `fb.watch` |
| `android/…/ShortsDetector.java` | identifiants de vues dans l'arbre d'accessibilité, repli Compose | `com.google.android.youtube` seulement |

Les couvertures diffèrent **volontairement** : l'application Android ne surveille
que YouTube. Ajouter une plateforme à l'extension n'oblige donc pas à toucher
l'Android — mais l'écrire noir sur blanc dans le rapport fait partie du travail.
Ajouter un motif YouTube, en revanche, pose vraiment la question.

**« Où revenir après un blocage ? »** — même promesse, deux mécaniques :
l'extension remonte l'historique réel de l'onglet (puis l'onglet ouvreur, puis
l'accueil sain en dernier recours) ; l'Android exécute le retour système **avant**
d'afficher sa superposition. Les deux visent le même résultat — l'utilisateur
retrouve exactement l'endroit qu'il avait — par des chemins qui n'ont rien en
commun.

---

## 2. Repères du code

| | |
|---|---|
| `extension/` | Chrome/Chromium, PC et navigateurs Android qui acceptent les extensions |
| `android/` | application native, service d'accessibilité pour l'application YouTube |
| `tests/` | tests Node de l'extension, plus un auto-test Java du détecteur |
| `scripts/check.sh` | syntaxe de chaque script, validité du manifeste, puis `npm test` |
| `novablock.crx`, `update.xml` | l'extension empaquetée et distribuée |

`url-rules.js` est **volontairement sans dépendance** et s'exporte aussi bien à
`module.exports` qu'à `globalThis.NovablockRules` : c'est ce qui le rend testable
dans Node sans navigateur. Ne pas y introduire d'API de navigateur.

`ShortsDetector.java` est **pur et séparé des API Android**, pour la même raison.
Ne pas y introduire d'appel au système.

---

## 3. Vérifier

```sh
npm run check                          # syntaxe des scripts + manifeste + tests Node
npm test                               # tests Node + auto-test du détecteur Android
gradle -p android test lint            # tests unitaires Java et Android Lint
gradle -p android assembleDebug        # l'APK compile
```

La CI fait les deux chaînes : `npm run check` et l'empaquetage de l'extension
d'un côté, `gradle -p android test lint assembleDebug` de l'autre.

**La CI ne protège rien en ce moment** : le quota GitHub Actions du compte est
épuisé, et les contrôles échouent en quelques secondes sans rien exécuter. Les
commandes locales sont donc la seule vérification réelle — les lancer avant de
pousser, et dire lesquelles ont tourné.

---

## 4. Conventions

**Le dépôt est en français**, commentaires, textes d'interface et messages de
commit compris.

**Les commentaires disent pourquoi, pas quoi.** Le code dit déjà ce qu'il fait.
Un commentaire utile explique la raison d'un choix, ou l'accident qu'il évite.

**Aucun serveur, aucune télémétrie, aucun compte.** C'est une promesse publique
du README, pas une préférence : l'extension ne conserve que les compteurs,
l'expiration d'un accès temporaire et la dernière URL saine par onglet ; le
service Android ne stocke ni texte, ni vidéo, ni historique. Toute demande qui
supposerait d'envoyer quoi que ce soit ailleurs se signale avant d'être écrite.

**Le fichier `.pem` n'entre jamais dans Git.** `manifest.json` conserve la clé
publique de l'extension distribuée pour que son identifiant reste stable ;
publier un nouveau `.crx` exige la clé privée originale, qui vit hors du dépôt.

---

## 5. Pièges connus

**Ne pas casser la navigation.** C'est l'exigence qui distingue ce produit d'un
simple blocage. Un Short intercepté ne doit changer ni la page, ni son
défilement, ni ses filtres ; plusieurs Shorts consécutifs se sautent en une
seule action. Un correctif qui bloque mieux mais renvoie l'utilisateur à
l'accueil est une régression, même si le Short ne joue pas.

**Le repli n'est pas le chemin normal.** L'accueil sain de la plateforme est le
**dernier** recours, après l'historique de l'onglet puis l'onglet ouvreur. Y
tomber souvent est le signe que quelque chose s'est cassé en amont.

**La superposition Android n'est pas une activité.** C'est une superposition
d'accessibilité : elle ne crée aucun onglet, aucune entrée dans les applications
récentes, aucune boucle de retour. La transformer en activité casserait ces
trois propriétés d'un coup.

**Les identifiants de vues de YouTube changent.** La détection Android s'appuie
sur des identifiants forts, avec un repli prudent pour l'interface Compose. Une
mise à jour de YouTube peut les invalider : c'est une panne attendue, à traiter
en élargissant les identifiants, jamais en élargissant le repli au point de
bloquer des écrans sains.

**Le paramètre restreint d'Android.** Une application installée manuellement
peut exiger « Autoriser les paramètres restreints » avant que l'accessibilité
puisse être activée. Un rapport d'utilisateur disant « ça ne s'active pas »
commence par cette vérification.
