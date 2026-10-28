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
- Indentation automatique des blocs : `IF … ELSE_IF … ELSE … END_IF`, `WHILE … END_WHILE`, `REPEAT … UNTIL`, ainsi que leurs formes françaises. Le corps d'une macro reste au niveau de `DEFINE`. Un bloc ouvert et fermé sur la même ligne (`IF x LET y 1 END_IF`) ne décale pas l'indentation.
- Repli des régions délimitées par `/*#region:nom*/` et `/*#endregion*/`.
- Complétion (elle remplace les anciens snippets) :
  - **Blocs** : `DEFINE`, `IF`, `ELSE_IF`, `ELSE`, `WHILE`, `REPEAT` et leurs formes françaises (`DEFINITION`, `SI`, `SINON_SI`, `SINON`, `TANT_QUE`, `REPETER`) insèrent le bloc complet, fermeture comprise. La touche Tab passe d'un champ à l'autre.
  - **Variantes** : `IF … ELSE`, `IF … ELSE_IF … ELSE`, `SI … SINON` et `SI … SINON_SI … SINON` insèrent un bloc avec ses branches.
  - **Casse** : les mots-clés sont insérés dans la casse que vous avez commencé à taper, en minuscules si vous tapez en minuscules et en majuscules sinon, jamais en casse mixte.
  - **Fonctions et commandes** : l'appel est inséré avec un champ par paramètre, selon la syntaxe documentée. Par exemple `Lpad(string, lengthString, append)` ou `SQL_QUERY requête IN "tableau"`. Les paramètres facultatifs n'ont pas de champ.
  - Méthodes de `confML` après `confML.`, avec un champ par paramètre.
  - Macros (avec leurs paramètres) et variables du fichier.
  - `#region` : insère une paire `/*#region:nom*/` … `/*#endregion*/`.
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
