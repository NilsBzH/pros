# PROS: macro language for VS Code

Visual Studio Code extension for the **PROS Smart CPQ macro language**, used in particular in the "Macro-Based BRC" rules of PROS Connect. It applies to `.pros` files.

> **Unofficial extension.** This is a community project. It is not affiliated with, endorsed by or supported by PROS or Conga. "PROS" and "Smart CPQ" are only used to name the language the extension supports.
>
> No content of the PROS documentation is included: the descriptions shown by the completion, the hover and the signature help are short summaries written for this extension.

## Features

- Syntax highlighting of `.pros` files, with standard TextMate scopes that work with every theme. It recognizes:
  - English and French keywords, in upper or lower case;
  - macro definitions and calls;
  - built-in functions (`IsDefined`, `DecimalRound`, `FIND_STR`…), table functions and `op*` constraint operators;
  - the `confML` object and its methods;
  - Java method calls (`obj.put(…)`) and common Java classes (`Integer`, `LinkedHashMap`…);
  - strings, escaped by doubling the quote (`""`, `''`), and `/* … */` comments.
- Semantic highlighting, computed from the analysis of the file: macro parameters, variables declared by `LET`, `SOIT` or `LOCAL`, macros of the file and member accesses are colored everywhere they are used. Names declared nowhere in the file (such as rule input aliases) are shown as read-only variables.
- Automatic indentation of blocks: `IF … ELSE_IF … ELSE … END_IF`, `WHILE … END_WHILE`, `REPEAT … UNTIL` and their French forms. The macro body stays at the `DEFINE` level. A block opened and closed on the same line (`IF x LET y 1 END_IF`) does not change the indentation.
- Formatting (**Format Document**, **Format Selection**): re-indents the blocks following the same rules and removes trailing spaces. Continuation lines (starting with `+`, or inside unclosed brackets) keep their offset from the first line of the statement. Lines inside multi-line strings and comments are left untouched.
- Folding of blocks (each `IF` branch folds on its own), multi-line comments and regions delimited by `/*#region:name*/` and `/*#endregion*/`.
- Completion:
  - **Blocks**: `DEFINE`, `IF`, `ELSE_IF`, `ELSE`, `WHILE`, `REPEAT` and their French forms (`DEFINITION`, `SI`, `SINON_SI`, `SINON`, `TANT_QUE`, `REPETER`) insert the whole block, closing keyword included. Tab moves from one field to the next.
  - **Variants**: `IF … ELSE`, `IF … ELSE_IF … ELSE`, `SI … SINON` and `SI … SINON_SI … SINON` insert a block with its branches.
  - **Case**: keywords are inserted in the case you started typing (lower case if you type in lower case, upper case otherwise), never in mixed case.
  - **Functions and commands**: only the name is inserted, followed by parentheses (`Lpad(…)`, cursor inside) or by a space (`SUBSTR `); the signature help then shows the parameters.
  - `confML` methods after `confML.`.
  - Macros and variables of the file.
  - `#region`: inserts a `/*#region:name*/` … `/*#endregion*/` pair.
- Hover: syntax, description, parameters and return value for every element of the language; documentation comment and definition line for the macros of the file (see [Documenting macros](#documenting-macros)); declaration of the variables.
- Signature help that follows the argument being typed, with or without parentheses: `Lpad(string, length, padding)` as well as `SUBSTR string start length`. The current parameter is highlighted and explained, optional parameters are shown between brackets. It works for functions, commands, `confML` and object methods, constructors and macros of the file.
- Parameter name hints in calls without parentheses: `SUBSTR s start: 2 length: 3`. See [Settings](#settings).
- Document outline (macros, their variables, regions) and "Go to Definition" for macros, including in the other `.pros` files of the workspace, and for variables.
- **Find All References** and **Rename Symbol** (F2):
  - parameters and variables, within the macro that declares them;
  - macros, in every `.pros` file of the workspace: definition, calls and the value returned with `LET name value`.
  - Names that are not declared in the file, keywords and built-in names cannot be renamed; a new name already used in the macro is refused.
- Diagnostics:
  - unclosed or mismatched blocks;
  - misplaced `ELSE`;
  - `EXIT_LOOP` or `EXIT_MACRO` outside their block;
  - unclosed strings or comments;
  - mixed case keywords (`Display`);
  - `//` used as a comment;
  - commands that no longer work on the platform.
- Quick fixes: `Display` → `DISPLAY` (or `display`), `// note` → `/* note */`, `trace_end` → `trace_off`, `BRC name()` → `DEFINE name()`.
- File icon theme for `.pros` files.

## Documenting macros

A comment written right above `DEFINE` documents the macro. It is shown on hover, in the completion list and in the signature help. Lines starting with `@param name` describe a parameter; the following lines, up to an empty line or the next `@param`, continue its description.

```
/*
 * Computes the price of a line.
 * @param price unit price
 * @param qty   quantity
 */
DEFINE linePrice(price, qty)
LET linePrice price * qty
END_DEFINE
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `pros.inlayHints.parameterNames` | `literals` | Parameter name hints in calls without parentheses: `none`, `literals` (before numbers and strings only) or `all` (before every argument). |

Semantic highlighting is turned on for `.pros` files (`editor.semanticHighlighting.enabled`). Inlay hints can also be turned off for every language with `editor.inlayHints.enabled`.

## Installation

From a `.vsix` file:

```bash
code --install-extension pros-macro-language-<version>.vsix
```

You can also use the command palette: **Extensions: Install from VSIX…**

## Known limitations

- Deprecated or disabled platform commands (file access, `EXECUTE`, SQL transactions…) are not highlighted as built-in functions and are not offered by the completion. Using them raises a warning.
- Object types are not tracked: only `confML` methods are offered by the completion. For other objects, a method is recognized on hover when its name is unambiguous.
- Calls to unknown functions are not reported: a macro may come from another environment and a static method from a Java library.
- A variable used in a macro but declared in another one is treated as not declared: it is shown as a read-only variable and is not renamed with the other macro's variable.
- The formatter only changes the indentation and the trailing spaces; it does not change the case of keywords or the spacing inside a line.

## Development

```bash
npm install
npm run compile      # compiles src/ into out/
npm test             # unit tests (test/unit/) and grammar tests (test/grammar/)
```

F5 compiles and then launches the extension in a new VS Code window.

To build the `.vsix` file:

```bash
npx @vscode/vsce package
```

On every push to `main`, the GitHub Actions workflow runs the tests and publishes the `.vsix` as a build artifact.

## Reporting an issue

https://github.com/NilsBzH/pros/issues

## License

GPL-2.0: see [LICENSE](LICENSE).
