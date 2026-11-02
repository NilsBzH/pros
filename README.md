# PROS: macro language for VS Code

VS Code support for the **PROS Smart CPQ macro language** (Macro-Based BRC rules of PROS Connect), for `.pros` files.

> **Unofficial extension**, not affiliated with, endorsed by or supported by PROS or Conga. No PROS documentation is included: descriptions are short summaries written for this extension.

## Features

- **Highlighting**: English and French keywords (upper or lower case), built-in functions, `confML`, Java calls, strings and comments. Semantic highlighting adds parameters, variables, macros and members wherever they are used; names declared nowhere in the file (rule inputs) are shown as read-only variables.
- **Completion**: blocks inserted whole (`IF … END_IF`, `IF … ELSE …`, `WHILE`, `REPEAT`, `DEFINE`, French forms), in the case you type. Functions insert their name only (`Lpad(`, `SUBSTR `). Also `confML.` methods, macros and variables of the file, `#region`.
- **Signature help**, with or without parentheses (`Lpad(string, length, padding)`, `SUBSTR string start length`): stays open while you type and highlights the current parameter.
- **Hover** on every language element, on macros and on variables.
- **Navigation**: outline, Go to Definition, Find All References and Rename (F2). Variables are scoped to their macro; macros are searched in every `.pros` file of the workspace.
- **Formatting** (Shift+Alt+F, or Ctrl+K Ctrl+F for a selection): re-indents blocks and removes trailing spaces. The macro body stays at the `DEFINE` level. One-line blocks, continuation lines (`+ …`) and multi-line strings or comments are kept as they are.
- **Folding** of blocks (each `IF` branch on its own), comments and `/*#region:name*/ … /*#endregion*/`.
- **Diagnostics** with quick fixes (Ctrl+.): unclosed or mismatched blocks, misplaced `ELSE`, `EXIT_*` outside their block, unclosed strings or comments, mixed case keywords (`Display`), `//` comments, `trace_end`, `BRC name()` headers, commands that no longer work on the platform.

## Documenting macros

A comment right above `DEFINE` is shown on hover, in the completion and in the signature help. `@param name` lines describe the parameters.

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

## Installation

```bash
code --install-extension pros-macro-language-<version>.vsix
```

Or **Extensions: Install from VSIX…** in the command palette.

## Known limitations

- Object types are not tracked: only `confML` methods are completed.
- Calls to unknown functions are not reported (they may come from another environment or a Java library).
- A variable declared in another macro is treated as undeclared.
- The formatter only changes indentation and trailing spaces.

## Development

```bash
npm install
npm test                     # compile, unit and grammar tests
npx @vscode/vsce package     # build the .vsix
```

F5 launches the extension in a new VS Code window.

## License

GPL-2.0: see [LICENSE](LICENSE). Issues: https://github.com/NilsBzH/pros/issues
