# PROS: macro language for VS Code

Visual Studio Code extension for the **PROS Smart CPQ macro language**, used in particular in the "Macro-Based BRC" rules of PROS Connect. It applies to `.pros` files.

## Features

- Syntax highlighting of `.pros` files, with standard TextMate scopes that work with every theme. It recognizes:
  - English and French keywords, in upper or lower case;
  - macro definitions and calls;
  - built-in functions (`IsDefined`, `DecimalRound`, `FIND_STR`…), table functions and `op*` constraint operators;
  - the `confML` object and its methods;
  - Java method calls (`obj.put(…)`) and common Java classes (`Integer`, `LinkedHashMap`…);
  - strings, escaped by doubling the quote (`""`, `''`), and `/* … */` comments.
- Automatic indentation of blocks: `IF … ELSE_IF … ELSE … END_IF`, `WHILE … END_WHILE`, `REPEAT … UNTIL` and their French forms. The macro body stays at the `DEFINE` level. A block opened and closed on the same line (`IF x LET y 1 END_IF`) does not change the indentation.
- Folding of regions delimited by `/*#region:name*/` and `/*#endregion*/`.
- Completion:
  - **Blocks**: `DEFINE`, `IF`, `ELSE_IF`, `ELSE`, `WHILE`, `REPEAT` and their French forms (`DEFINITION`, `SI`, `SINON_SI`, `SINON`, `TANT_QUE`, `REPETER`) insert the whole block, closing keyword included. Tab moves from one field to the next.
  - **Variants**: `IF … ELSE`, `IF … ELSE_IF … ELSE`, `SI … SINON` and `SI … SINON_SI … SINON` insert a block with its branches.
  - **Case**: keywords are inserted in the case you started typing (lower case if you type in lower case, upper case otherwise), never in mixed case.
  - **Functions and commands**: the call is inserted with one field per parameter, following the documented syntax, e.g. `Lpad(string, lengthString, append)` or `SQL_QUERY query IN "table"`. Optional parameters get no field.
  - `confML` methods after `confML.`, with one field per parameter.
  - Macros (with their parameters) and variables of the file.
  - `#region`: inserts a `/*#region:name*/` … `/*#endregion*/` pair.
- Hover: syntax, parameters, return value and manual page for every element of the language; definition line for the macros and variables of the file.
- Signature help for calls with parentheses: functions, `confML` methods, constructors and macros of the file.
- Document outline (macros, their variables, regions) and "Go to Definition" for macros, including in the other `.pros` files of the workspace, and for variables.
- Diagnostics:
  - unclosed or mismatched blocks;
  - misplaced `ELSE`;
  - `EXIT_LOOP` or `EXIT_MACRO` outside their block;
  - unclosed strings or comments;
  - mixed case keywords (`Display`);
  - `//` used as a comment;
  - commands that no longer work on the platform.
- File icon theme for `.pros` files.

## Installation

From a `.vsix` file:

```bash
code --install-extension pros-<version>.vsix
```

You can also use the command palette: **Extensions: Install from VSIX…**

## Known limitations

- Deprecated or disabled platform commands (file access, `EXECUTE`, SQL transactions…) are not highlighted as built-in functions and are not offered by the completion. Using them raises a warning.
- Object types are not tracked: only `confML` methods are offered by the completion. For other objects, a method is recognized on hover when its name is unambiguous.
- Calls to unknown functions are not reported: a macro may come from another environment and a static method from a Java library.

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
