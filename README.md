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
- Thème d'icônes pour les fichiers `.pros`.

## Installation

Depuis un fichier `.vsix` :

```bash
code --install-extension pros-<version>.vsix
```

Vous pouvez aussi passer par la palette de commandes : **Extensions : Installer à partir d'un VSIX…**

## Limites connues

- L'extension ne propose pas encore de complétion, d'aide au survol ni de diagnostic.
- Les commandes dépréciées ou désactivées de la plateforme (accès aux fichiers, `EXECUTE`, transactions SQL…) ne sont pas prises en charge : elles ne sont pas coloriées comme des fonctions intégrées.

## Développement

Les tests de la grammaire (dossier `test/grammar/`) se lancent avec :

```bash
npm install
npm run test:grammar
```

## Signaler un problème

https://github.com/NilsBzH/pros/issues

## Licence

GPL-2.0 : voir [LICENSE](LICENSE).
