# Changelog

All notable changes to the "pros-macro-language" extension. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions: [Semantic Versioning](https://semver.org/).

## [0.2.2] - 2026-11-16

### Changed

- Commands and functions restricted or discouraged by the manual (file access, `EXECUTE`, SQL transactions…) are now highlighted, completed and documented like the others. The hover shows a neutral note with the manual page.
- Their uses are no longer reported by default: setting `pros.diagnostics.restrictedCommands` (`off`, `hint`, `warning`).
- All displayed texts are in English and written for the extension; a few descriptions were reworded.

### Removed

- Parameter name hints shown inside the editor; parameters are shown in the signature help only.

## [0.2.0] - 2026-11-02

### Added

- Semantic highlighting of parameters, variables, macros, undeclared names and members.
- Signature help for calls without parentheses (`SUBSTR string start length`); it stays open while the arguments are typed, strings included.
- Macro documentation comments (`/* … */` above `DEFINE`, `@param` lines), shown on hover, in the completion and in the signature help.
- Find All References and Rename (F2) for variables, parameters and macros.
- Document and selection formatting.
- Folding of blocks and multi-line comments.
- Quick fixes for mixed case keywords, `//` comments, `trace_end` and `BRC name()` headers.

### Changed

- All texts in English; the hover no longer shows the manual page or the synonyms.
- Functions are completed with their name only; the signature help shows the parameters.

## [0.1.0] - 2026-10-28

First public release. Unofficial extension, not affiliated with PROS or Conga.

- TextMate grammar rebuilt from the language reference (English and French keywords, built-in functions, `confML`, Java calls).
- Language configuration: block indentation, region folding, word definition.
- Completion of blocks, functions, `confML` methods, macros and variables of the file, in the typed case.
- Hover, signature help, document outline and Go to Definition.
- Diagnostics: mismatched blocks, misplaced `ELSE`, `EXIT_*` outside their block, unclosed strings or comments, mixed case keywords, `//` comments, disabled commands.
- Unit and grammar tests, GitHub Actions workflow, extension icon.
- Removed: snippets file (replaced by the completion), missing color theme, `vsc-extension-quickstart.md`.

## [0.0.1]

- Initial release: syntax highlighting, snippets, language configuration and file icon theme.
