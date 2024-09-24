# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Nothing yet!

## [0.6.8] - 2024-09-24

- Fix crash ([#320](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/320))

## [0.6.7] - 2024-09-24

- Improved performance with large Svelte, Liquid, and Angular files ([#312](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/312))
- Add support for `@plugin` and `@config` in v4 ([#316](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/316))
- Add support for Tailwind CSS v4.0.0-alpha.25 ([#317](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/317))

## [0.6.6] - 2024-08-09

- Add support for `prettier-plugin-multiline-arrays` ([#299](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/299))
- Add resolution cache for known plugins ([#301](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/301))
- Support Tailwind CSS `v4.0.0-alpha.19` ([#310](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/310))

## [0.6.5] - 2024-06-17

- Only re-apply string escaping when necessary ([#295](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/295))

## [0.6.4] - 2024-06-12

- Export `PluginOptions` type ([#292](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/292))

## [0.6.3] - 2024-06-11

- Improve detection of string concatenation ([#288](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/288))

## [0.6.2] - 2024-06-07

### Changed

- Only remove duplicate Tailwind classes ([#277](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/277))
- Make sure escapes in classes are preserved in string literals ([#286](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/286))

## [0.6.1] - 2024-05-31

### Added

- Add new `tailwindPreserveDuplicates` option to disable removal of duplicate classes ([#276](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/276))

### Fixed

- Improve handling of whitespace removal when concatenating strings ([#276](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/276))
- Fix a bug where Angular expressions may produce invalid code after sorting ([#276](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/276))
- Disabled whitespace and duplicate class removal for Liquid and Svelte ([#276](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/276))

## [0.6.0] - 2024-05-30

### Changed

- Remove duplicate classes ([#272](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/272))
- Remove extra whitespace around classes ([#272](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/272))

## [0.5.14] - 2024-04-15

### Fixed

- Fix detection of v4 projects on Windows ([#265](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/265))

## [0.5.13] - 2024-03-27

### Added

- Add support for `@zackad/prettier-plugin-twig-melody` ([#255](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/255))

## [0.5.12] - 2024-03-06

### Added

- Add support for `prettier-plugin-sort-imports` ([#241](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/241))
- Add support for Tailwind CSS v4.0 ([#249](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/249))

## [0.5.11] - 2024-01-05

### Changed

- Bumped bundled version of Tailwind CSS to v3.4.1 ([#240](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/240))

## [0.5.10] - 2023-12-28

### Changed

- Bumped bundled version of Tailwind CSS to v3.4 ([#235](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/235))

## [0.5.9] - 2023-12-05

### Fixed

- Fixed location of embedded preflight CSS file ([#231](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/231))

## [0.5.8] - 2023-12-05

### Added

- Re-enable support for `prettier-plugin-marko` ([#229](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/229))

## [0.5.7] - 2023-11-08

### Fixed

- Fix sorting inside dynamic custom attributes ([#225](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/225))

## [0.5.6] - 2023-10-12

### Fixed

- Fix sorting inside `{{ … }}` expressions when using `@shopify/prettier-plugin-liquid` v1.3+ ([#222](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/222))

## [0.5.5] - 2023-10-03

### Fixed

- Sort classes inside `className` in Astro ([#215](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/215))
- Support member access on function calls ([#218](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/218))

## [0.5.4] - 2023-08-31

### Fixed

- Type `tailwindFunctions` and `tailwindAttributes` as optional ([#206](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/206))
- Don’t break `@apply … #{'!important'}` sorting in SCSS ([#212](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/212))

## [0.5.3] - 2023-08-15

### Fixed

- Fix CJS `__dirname` interop on Windows ([#204](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/204))

## [0.5.2] - 2023-08-11

### Fixed

- Fix intertop with bundled CJS dependencies ([#199](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/199))

## [0.5.1] - 2023-08-10

### Fixed

- Updated Prettier peer dependency ([#197](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/197))

## [0.5.0] - 2023-08-10

### Added

- Sort expressions in Astro's `class:list` attribute ([#192](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/192))
- Re-enabled support for plugins when using Prettier v3+ ([#195](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/195))

## [0.4.1] - 2023-07-14

### Fixed

- Don't move partial classes inside Twig attributes ([#184](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/184))

## [0.4.0] - 2023-07-11

### Added

- Export types for Prettier config ([#162](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/162))
- Add Prettier v3 support ([#179](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/179))

### Fixed

- Don't move partial classes inside Liquid script attributes ([#164](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/164))
- Do not split classes by non-ASCII whitespace ([#166](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/166))
- Match tagged template literals with tag expressions ([#169](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/169))

## [0.3.0] - 2023-05-15

### Added

- Added support for `prettier-plugin-marko` ([#151](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/151))
- Allow sorting of custom attributes, functions, and tagged template literals ([#155](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/155))

### Fixed

- Speed up formatting ([#153](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/153))
- Fix plugin compatibility when loaded with require ([#159](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/159))

## [0.2.8] - 2023-04-28

### Changed

- Remove support for `@prettier/plugin-php` ([#152](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/152))

## [0.2.7] - 2023-04-05

### Fixed

- Don't break liquid tags inside attributes when sorting classes ([#143](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/143))

## [0.2.6] - 2023-03-29

### Added

- Support ESM and TS config files ([#137](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/137))

### Fixed

- Load `tailwindcss` modules from nearest instance only ([#139](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/139))

## [0.2.5] - 2023-03-17

### Fixed

- Fix class sorting in `capture` liquid tag ([#131](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/131))

## [0.2.4] - 2023-03-02

### Fixed

- Sort `class` attribute on components and custom elements in Astro ([#129](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/129))

## [0.2.3] - 2023-02-15

### Fixed

- Don't sort classes in Glimmer `concat` helper ([#119](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/119))
- Add support for `@ianvs/prettier-plugin-sort-imports` ([#122](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/122))

## [0.2.2] - 2023-01-24

### Fixed

- Add prettier plugins to peer dependencies ([#114](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/114))
- Traverse await expression blocks in Svelte ([#118](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/118))

## [0.2.1] - 2022-12-08

### Fixed

- Fix support for latest Shopify Liquid plugin ([#109](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/109))

## [0.2.0] - 2022-11-25

### Changed

- Don't bundle `prettier-plugin-svelte` ([#101](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/101))

### Added

- Improve compatibility with other Prettier plugins ([#101](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/101), [#102](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/102))

## [0.1.13] - 2022-07-25

### Fixed

- Fix error when using Angular pipes ([#86](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/86))

## [0.1.12] - 2022-07-07

### Added

- Add support for Glimmer / Handlebars ([#83](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/83))

## [0.1.11] - 2022-05-16

### Changed

- Update `prettier-plugin-svelte` to `v2.7.0` ([#77](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/77))

### Fixed

- Fix sorting in Svelte `:else` blocks ([#79](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/79))

## [0.1.10] - 2022-04-20

### Removed

- Remove whitespace tidying and duplicate class removal due to [issues](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/issues/71) with whitespace removal ([#72](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/72))

## [0.1.9] - 2022-04-19

### Added

- Add license file ([#64](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/64))
- Add whitespace tidying and duplicate class removal ([#70](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/70))

## [0.1.8] - 2022-02-24

### Changed

- Use Tailwind's `getClassOrder` API when available ([#57](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/57))

### Fixed

- Fix Tailwind config file resolution when Prettier config file is not present ([#62](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/62))

## [0.1.7] - 2022-02-09

### Fixed

- Fix single quotes being converted to double quotes ([#51](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/51))

## [0.1.6] - 2022-02-08

### Fixed

- Fix error when no Prettier options provided ([#46](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/46))

## [0.1.5] - 2022-02-04

### Added

- Add support for MDX ([#30](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/30))

### Fixed

- Fix error when formatting Svelte files that contain `let:class` attributes ([#24](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/24))

## [0.1.4] - 2022-01-25

### Fixed

- Handle empty class attributes ([#17](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/17))
- Handle TypeScript syntax in Vue/Angular class attributes ([#18](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/18))

## [0.1.3] - 2022-01-24

### Fixed

- Ignore `!important` when sorting `@apply` classes ([#4](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/4))

## [0.1.2] - 2022-01-24

### Fixed

- Fix error when using nullish coalescing operator in Vue/Angular ([#2](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/pull/2))

[unreleased]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.8...HEAD
[0.6.8]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.7...v0.6.8
[0.6.7]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.6...v0.6.7
[0.6.6]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.5...v0.6.6
[0.6.5]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.4...v0.6.5
[0.6.4]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.3...v0.6.4
[0.6.3]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.2...v0.6.3
[0.6.2]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.14...v0.6.0
[0.5.14]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.13...v0.5.14
[0.5.13]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.12...v0.5.13
[0.5.12]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.11...v0.5.12
[0.5.11]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.10...v0.5.11
[0.5.10]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.9...v0.5.10
[0.5.9]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.8...v0.5.9
[0.5.8]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.8...v0.3.0
[0.2.8]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.7...v0.2.8
[0.2.7]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.6...v0.2.7
[0.2.6]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.5...v0.2.6
[0.2.5]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.4...v0.2.5
[0.2.4]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.13...v0.2.0
[0.1.13]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.4...v0.1.5
[0.1.4]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/tailwindlabs/prettier-plugin-tailwindcss/compare/d9c27f07a69bf9feec7f9d889426ad2ba76e1b09...v0.1.2
