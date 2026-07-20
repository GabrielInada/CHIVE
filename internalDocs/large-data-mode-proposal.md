# Exploratory Proposal: True Large-Data Mode

| Field | Value |
|---|---|
| Status | Exploratory; not approved for implementation |
| Created | 2026-07-20 |
| Trigger | Follow-up to the modern web platform audit |
| Current policy | Size and row thresholds warn; they never truncate data |

## Why this is separate

CHIVE currently treats a dataset as an in-memory array of row objects. Import,
normalization, statistics, state snapshots, persistence, joins, and chart
preparation can each clone or expand that representation. Raising a row limit
does not make this architecture a large-data system; it only allows the same
memory costs to grow.

The current implementation therefore keeps the existing 15 MiB and 200,000-row
values as overridable warnings. It must preserve all rows after confirmation and
must never claim that silent truncation is a large-data strategy.

This document holds the larger design problem so it can be evaluated with
benchmarks and product requirements rather than folded into a correctness fix.

## Candidate architecture

### Streaming ingestion

- Parse CSV and NDJSON incrementally in a worker instead of reading an entire
  file into one string.
- Define cancellation and malformed-record recovery at chunk boundaries.
- Determine how ordinary JSON arrays participate; fully streaming arbitrary JSON
  needs a dedicated parser or a documented conversion path.
- Compute schema inference and lightweight statistics incrementally.

### Chunked columnar storage

- Store typed columns in bounded chunks instead of one array of row objects.
- Use OPFS where available and IndexedDB as the durability or compatibility
  layer, while keeping a documented fallback for unsupported storage modes.
- Separate immutable source columns from derived/filter columns to avoid full
  copies.
- Version the physical format independently from the user-facing project schema.

### Worker query API

The UI should request bounded results instead of receiving the whole dataset:

- projected columns and row ranges for preview;
- filtered counts and grouped aggregates;
- join estimates and paged join output;
- statistics and distinct-value summaries;
- chart-specific aggregates or samples.

Requests need stable IDs, cancellation, progress, stale-response rejection, and
explicit memory ownership. Transferable buffers may be useful once the columnar
representation exists; they should not be bolted onto the current row-object
protocol.

### Virtual preview

Render only the visible table window and a small overscan range. Keyboard
navigation, selection, copy, variable row height, screen-reader behavior, and
scroll anchoring need acceptance criteria before choosing a virtualization
strategy.

### Chart preparation

- Keep chart domains, encodings, regressions, and summaries based on the full
  logical dataset.
- Produce bounded geometry through sampling, binning, level-of-detail, or
  worker aggregation appropriate to each chart.
- Treat topology charts separately; sampling nodes or links can change their
  meaning.
- Surface the logical count, rendered count, and aggregation method in the UI.

## Persistence and migration

A large-data project may reference durable column chunks rather than embedding
all rows in the current snapshot. A future design must specify:

- atomic save and crash recovery;
- garbage collection for orphaned chunks;
- export and import of portable project archives;
- quota exhaustion and eviction behavior;
- migration from today's row-oriented snapshots;
- downgrade behavior when an older CHIVE version opens the project.

No migration should be written until a representative prototype establishes the
physical format and recovery guarantees.

## Benchmark gate

Before selecting an architecture, build a disposable prototype and measure at
least:

- 200,000, 1 million, and 10 million rows;
- narrow numeric, wide mixed-type, CSV, NDJSON, and JSON-array inputs;
- peak main-thread and worker memory;
- time to first preview and time to cancellable interaction;
- filter, statistics, join estimate, join execution, save, restore, and export;
- low-memory/mobile failure behavior;
- Chrome, Firefox, and Safari on representative hardware.

Define budgets before implementation. Candidate starting metrics are maximum
main-thread task duration, peak resident memory, first-preview latency, and
cancel response time, but the product team must choose acceptable values.

## Security and privacy questions

- Can temporary OPFS or IndexedDB chunks survive cancellation or failed imports?
- How are deleted projects and orphaned data verifiably removed?
- Can crafted input cause decompression, parser, join, or cardinality exhaustion?
- What limits protect disk usage without silently changing the user's data?
- What project metadata is safe to expose in crash diagnostics?

All processing must remain local unless a separate network architecture is
explicitly proposed and reviewed.

## Open product questions

1. Which real datasets and workflows define “large” for CHIVE?
2. Is exact full-data charting required, or are declared aggregates acceptable?
3. Must large projects remain portable as one file?
4. What offline, mobile, and private-browsing guarantees are required?
5. How should users recover when storage is too small?
6. Are joins expected to materialize output or remain lazy query plans?
7. Which operations may take minutes if they are cancellable and progressive?

## Explicit non-decisions

This proposal does not choose a parser, storage library, columnar format,
virtualization library, or project migration. It also does not authorize new
runtime dependencies, transferables, a service worker, or a PWA.
