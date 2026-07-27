# Temporary Tile Stock Desk — /tiles

**TEMPORARY MODULE.** Everything here is removable without touching
permanent V Wholesale functionality. Nothing in `staff.html` or the
permanent inventory module is modified.

## Status
Schema live. Seed data loaded (9 rows). Edge functions and frontend pending.

## Key decisions (27 Jul 2026)
- 3 shared PINs: ADMIN / INVENTORY / SALES; staff types own name per transaction
- Sales, holds, hold-conversions and releases commit instantly
- Inward, damage, adjustments and transfers require ADMIN approval before commit
- Reversals are ADMIN only
- Holds: advance mandatory, receipt photo required, 15-day default validity
- Expired holds keep reserving stock and never auto-release
- Multi-line cart: one order header (one invoice, one photo) with many lines
- Locations are controlled records; staff never type a location freehand
- No auto-FIFO. Staff always choose the exact shelf.

## Data provenance
`data-prep/apply_decisions.py` transforms the supplied corrected package into
the live import set. It asserts every invariant and refuses to run if any fail.
Result: 259 rows, 9,045 boxes, 243 models, 157 locations.
61 rows withheld pending physical location assignment.

## REMOVAL
1. Delete this `/tiles/` folder.
2. Drop database objects:
   `drop view temp_tiles_stock_view;`
   `drop table` (reverse dependency order) all `temp_tiles_*` tables.
   `drop function temp_tiles_sync_hold_total, temp_tiles_sync_order_total;`
3. Delete edge functions prefixed `temp-tiles-`.
4. Delete the Supabase storage bucket for receipt photos.
5. No route config to remove — GitHub Pages serves `/tiles/` from the folder.
6. No shared files were modified, so nothing to revert elsewhere.
