# Change Log

All notable changes to the "ts-type-expand" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.2.0] - 2024-05-16

### Added

- Added support for Vue's Single File Components (SFC).

## [1.1.1] - 2024-05-16

### Changed

- Fixed the issue where `copy` and `restart` button were appearing in TreeViews other than ts-type-expand.

## [1.1.0] - 2024-05-16

### Add

- Added a feature that allows you to copy type information as a type alias when you press the COPY button on an expanded type. This is an experimental feature.
- Add button which restart extension.

### Changed

- Support for TypeScript 5.0.
  - Fixed an issue where some type references were broken in TS 5.0.
- Fixed the bug where the value type of the Mapped Type could not be resolved.

## [1.0.6] - 2023-09-14

### Changed

- Default value of string length to be displayed is 80
- For literals of type string, display the value enclosed in double quotes so that we can identify between `"string"` and `string`.
- The first type information displayed when a node is selected should be expanded.

## [1.0.5] - 2023-08-27

### Changed

- bug fixed for error that cannot display anything #353

## [1.0.0] - 2023-01-22

### Added

- Date, Promise, Symbol, PromiseLike type support
- Add `validate` option to allow the target languageId to be specified.

### Changed

- Use the built-in TS server instead of building `kimuson.ts-type-expand`'s own TS server.
  - Real-time type retrieval (Information is updated by OnType instead of OnSave, so it can be update with real-time type information that has not been saved)
  - Resolve types based on the developer's choice of TypeScript version
  - lightweight
- Revamped type resolution logic.

### Removed

- remove `tsconfigPath` option
  - `tsconfig.json` interpreted by the embedded TS server is used.

## [0.0.12] - 2021-09-12

### Added

- Support for multiple workspaces

### Changed

- fixed bug that type expansion of function arguments #21

## [0.0.11] - 2021-09-10

### Changed

- Fixed problem with dependency resolution failing on case-sensitive machines.
- Do not display an error when the file extension is not ts or tsx.

## [0.0.9] - 2021-09-04

### Added

- added error messages after error occurred

### Changed

- `ts-type-expand.refresh` renamed `ts-type-expand.restart`
  - restart compilerAPI after command executed
  - update configure after command executed
- Upgrade typescript version to 4.4.2
- Upgrade dependency versions

## [0.0.8] - 2021-05-31

### Added

- Support enum expansion
