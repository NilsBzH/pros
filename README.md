# PROS : langage macro pour VS Code

Extension Visual Studio Code pour le **langage macro de PROS Smart CPQ**, utilisé notamment dans les règles « Macro-Based BRC » de PROS Connect. Elle s'applique aux fichiers `.pros`.

## Fonctionnalités

- Coloration syntaxique des fichiers `.pros`, avec des scopes TextMate standard compatibles avec tous les thèmes. Sont reconnus :
  - les mots-clés anglais et français, en majuscules ou en minuscules ;
  - les définitions et appels de macros ;
  - les fonctions intégrées (`IsDefined`, `DecimalRound`, `FIND_STR`…), les fonctions de tableaux et les opérateurs de contrainte `op*` ;
  - l'objet `confML` et ses méthodes ;
  - les appels de méthodes Java (`obj.put(…)`) et les classes Java courantes (`Integer`, `LinkedHashMap`…) ;
  - les chaînes, avec échappement par doublement (`""`, `''`), et les commentaires `/* … */`.
- Snippets pour les structures de contrôle (`IF`, `WHILE`, `REPEAT`, `DEFINE`…), les commandes courantes et les méthodes de l'objet `confML`. Les formes anglaises et françaises sont disponibles.
- Indentation automatique des blocs : `IF … ELSE_IF … ELSE … END_IF`, `WHILE … END_WHILE`, `REPEAT … UNTIL`, ainsi que leurs formes françaises. Le corps d'une macro reste au niveau de `DEFINE`. Un bloc ouvert et fermé sur la même ligne (`IF x LET y 1 END_IF`) ne décale pas l'indentation.
- Repli des régions délimitées par `/*#region:nom*/` et `/*#endregion*/`.
- Complétion :
  - mots-clés, commandes et fonctions de la référence, avec leurs synonymes français ;
  - méthodes de `confML` après `confML.` ;
  - macros et variables du fichier.
- Survol : syntaxe, paramètres, valeur de retour et page du manuel pour chaque élément du langage ; ligne de définition pour les macros et les variables du fichier.
- Aide à la signature pour les appels avec parenthèses : fonctions, méthodes de `confML`, constructeurs et macros du fichier.
- Plan du document (macros, leurs variables, régions) et « Atteindre la définition » pour les macros, y compris dans les autres fichiers `.pros` de l'espace de travail, et pour les variables.
- Diagnostics :
  - blocs non fermés ou mal appariés ;
  - `ELSE` mal placé ;
  - `EXIT_LOOP` ou `EXIT_MACRO` hors de leur bloc ;
  - chaînes ou commentaires non fermés ;
  - mots-clés en casse mixte (`Display`) ;
  - `//` utilisé comme commentaire ;
  - commandes qui ne fonctionnent plus sur la plateforme.
- Thème d'icônes pour les fichiers `.pros`.

## Installation

Depuis un fichier `.vsix` :

```bash
code --install-extension pros-<version>.vsix
```

Vous pouvez aussi passer par la palette de commandes : **Extensions : Installer à partir d'un VSIX…**

## Limites connues

- Les commandes dépréciées ou désactivées de la plateforme (accès aux fichiers, `EXECUTE`, transactions SQL…) ne sont ni coloriées comme des fonctions intégrées, ni proposées en complétion. Leur utilisation est signalée par un avertissement.
- Le type des objets n'est pas suivi : seules les méthodes de `confML` sont proposées en complétion. Pour les autres objets, la méthode est reconnue au survol quand son nom est sans ambiguïté.
- Les appels de fonctions inconnues ne sont pas signalés : une macro peut venir d'un autre environnement et une méthode statique d'une bibliothèque Java.

## Développement

```bash
npm install
npm run compile      # compile src/ vers out/
npm test             # tests unitaires (test/unit/) et tests de grammaire (test/grammar/)
```

F5 compile puis lance l'extension dans une nouvelle fenêtre VS Code.

## Signaler un problème

https://github.com/NilsBzH/pros/issues

## Licence

GPL-2.0 : voir [LICENSE](LICENSE).
