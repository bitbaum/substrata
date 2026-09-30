# Shared geography

Substrata, Solon and OrangeCat consume the same `@bitbaum/geo-kit` contract.
The package has no runtime dependencies, country packs, account storage or map
renderer. Its public source is https://github.com/bitbaum/geo-kit.

## Ownership

| Responsibility | Owner |
| --- | --- |
| Public place identities, names, identifiers, hierarchy, sourced assertions and history | Solon Places |
| Private residence and profile coordinates | OrangeCat |
| Resource, facility, policy and supply-chain relationships | Substrata |
| Manifest, geometry validation, bounded loading and boundary-draft contracts | geo-kit |

ISO and national codes identify a place; they do not replace Solon's opaque
identity. The contract supports multiple geographic systems and arbitrary layer
and tier keys. Political claims, administration and proposed areas are separate,
dated, sourced records. A map viewpoint is named explicitly.

## Current integration

- The country finder uses a small index; country geometry is fetched when the
  world atlas is opened. Manifest and decoded geometry bytes have separate limits.
- Sources, accepted licences, SHA-256, exact byte size, feature counts and shape
  are checked before geometry reaches the renderer. A failed map can be retried.
- Detailed resources can be selected by geography, date, viewpoint, zoom and
  viewport bounds. Date-line crossings are supported; missing bounds never hide
  a resource silently. Download budgets apply after filtering.
- OrangeCat validates complete WGS84 coordinate pairs locally, preserving zero
  coordinates. This dependency sends no profile or residence data to Solon.
- Solon's tier importer validates source geometry with the same package and
  imports the source-defined hierarchy.

## Remaining data and interface work

Substrata currently publishes the sourced world country resource. It does not
yet publish detailed state/province polygons or a border drawing interface.
Solon's Swiss hierarchy and Zürich quarter import are separate from publishing
versioned geometry resources for reuse.

The next subdivision slice should publish geometry through Solon's existing
source/import pipeline, connect each feature to its place identifiers, and
consume a versioned manifest in Substrata. Add source and licence records,
validity and viewpoint metadata, reproducible geometry hashes, local bounds and
download budgets together. Keep the country view useful when a detailed layer
has no coverage. Existing text fields remain compatible during adoption.

Drawing and publishing a new area must use `validateBoundaryDraft`, an actual
topology validator and the application's approved proposal. A drawn shape is
not an assertion of ownership or administration.

Neither geography loading nor deterministic validation calls an AI model.
