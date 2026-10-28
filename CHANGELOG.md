# Changelog

All notable changes to the "pros-macro-language" extension are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-10-28

First public release. Unofficial extension, not affiliated with PROS or Conga.

### Added

- Completion:
  - block keywords (`DEFINE`, `IF`, `ELSE_IF`, `ELSE`, `WHILE`, `REPEAT` and their French forms) insert the whole block, with its closing keyword and fields to fill in;
  - multi-line `IF … ELSE` and `IF … ELSE_IF … ELSE` variants (and `SI …`);
  - insertion in the typed case, never in mixed case;
  - functions and commands inserted with one field per parameter, following the documented syntax;
  - `confML` methods, macros and variables of the file, `#region`.
- Hover: syntax, parameters, return value and manual page.
- Signature help for calls with parentheses.
- Document outline (macros, variables, regions) and "Go to Definition" for macros and variables.
- Diagnostics:
  - unclosed or mismatched blocks;
  - misplaced `ELSE`;
  - `EXIT_LOOP` / `EXIT_MACRO` outside their block;
  - unclosed strings and comments;
  - mixed case keywords;
  - `//` used as a comment;
  - commands that no longer work on the platform.
- Language reference database, built from the CPQ 12 macro language manual and the "Macro-Based BRC" guide.
- Grammar tests (`vscode-tmgrammar-test`) and unit tests (`node:test`), run by `npm test` and by the GitHub Actions workflow.
- Extension icon.

### Changed

- TextMate grammar rebuilt from the language reference:
  - upper or lower case keywords, English and French;
  - strings escaped by doubling the quote;
  - built-in functions, `confML` and Java calls;
  - disabled commands are no longer highlighted as built-in functions.
- Language configuration:
  - indentation of English and French blocks, with no effect for a block written on one line;
  - region folding;
  - word definition.
- README rewritten.

### Removed

- Snippets file, replaced by the completion.
- Contribution pointing to a non-existent color theme.
- `vsc-extension-quickstart.md` template file.

## [0.0.1]

- Initial release: syntax highlighting, snippets, language configuration and file icon theme.
