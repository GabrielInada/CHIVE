# CHIVE

CHIVE turns a user's CSV or JSON file into datasets whose cells charts, filters,
statistics, and the table read the same way.

## Language

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
