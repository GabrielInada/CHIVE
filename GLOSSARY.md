# CHIVE

CHIVE turns a user's CSV or JSON file into datasets whose cells charts, filters,
statistics, and the table read the same way.

## Language

### Datasets

**Ingest**:
Turning a CSV or JSON file, or the join of two datasets, into a new dataset:
each column gets its type and decimal separator, and every cell its canonical
form.
_Avoid_: process, normalize, import

**Decimal separator**:
The character, dot or comma, that a column's text numbers put before their
fraction. Each column has its own, fixed at ingest.
_Avoid_: number format, decimal convention

### Cells

**Canonical cell**:
A dataset cell in the single form its column type allows: missing, a finite
number, an ISO date, or non-blank text.
_Avoid_: raw value, normalized value, clean value

**Missing cell**:
A canonical cell with no value. Blank text and anything a number or date
column cannot read are missing; text such as "N/A" is a value.
_Avoid_: null, empty, blank, N/A

**Cell format version**:
The generation of the canonical cell form a saved project was written in.
_Avoid_: schema version, data version

### Categories

**Category key**:
The identity of a category within a column. Every missing cell shares one key,
which no text value can produce by accident.
_Avoid_: category name, category label, bucket id

**Missing bucket**:
The single category every missing cell in a column belongs to. It is labeled
"(missing)" everywhere and never merges with text that reads "N/A".
_Avoid_: N/A bucket, N/A group, empty category

**Category label**:
The localized text shown for a category key.
_Avoid_: category name

**Category token**:
How a chart filter rule refers to one category key in its include and exclude
lists.
_Avoid_: filter value, category id

**Other sector**:
The pie sector that folds every category past the Top-N cut into one wedge. It
is not a category: it has no category token and never shares a key or a color
with a category spelled the same way.
_Avoid_: Other category, Other bucket
