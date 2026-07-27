#!/usr/bin/env python3
"""Apply Himansu's decisions (27 Jul 2026) to the corrected tiles data.

1. Canonical model_code = compact spelling (fewest spaces) per search_key
2. Drop the 10395-HL duplicate; keep 10395-HL1 @ S-25=11 and Godown 1(B) Opp=75
3. S(23)/S(24)/S(29)/S(30)/S(32) -> S-23 etc, typed STAND
4. Merge LOC-015 'GODOWN RACK NO. 1(B) OPPOSITE' into LOC-003 '... 1 (B) OPPOSITE'
"""
import pandas as pd, re, sys

SRC = 'tiles_import_ready_CORRECTED.csv'
MST = 'temp_tiles_location_master_CORRECTED.csv'

d = pd.read_csv(SRC)
m = pd.read_csv(MST)
start_rows, start_qty = len(d), d.current_physical_qty.sum()
print(f'IN  rows={start_rows} qty={start_qty:.0f} locations={len(m)}')

# ---- 1. canonical model_code -------------------------------------------
# Compact structured codes ('10408 - D' -> '10408-D'). Descriptive product
# names ('DR PGVT Armani Marble Grey') are left untouched.
CODE_LIKE = re.compile(r'^[A-Z0-9]+(\s*-\s*[A-Z]+\s*\d*)+$', re.I)

def compact(v):
    s = str(v).strip()
    if not CODE_LIKE.match(s):
        return s
    s = re.sub(r'\s*-\s*', '-', s)      # '10408 - D'  -> '10408-D'
    s = re.sub(r'([A-Z])\s+(\d)', r'\1\2', s, flags=re.I)  # 'HL 2' -> 'HL2'
    return s

d['model_code_original'] = d.model_code
d['model_code'] = d.model_code.map(compact)

# Then collapse any remaining per-search_key variance to one spelling.
canon = (d.assign(_sp=d.model_code.str.count(' '))
           .sort_values('_sp')
           .groupby('search_key').model_code.first())
d['model_code'] = d.search_key.map(canon)
changed = (d.model_code != d.model_code_original).sum()
assert d.groupby('search_key').model_code.nunique().max() == 1, 'search_key still ambiguous'
print(f'[1] model_code canonicalised on {changed} rows; '
      f'{d.model_code.nunique()} distinct models (was {d.model_code_original.nunique()})')

# ---- 2. drop the 10395-HL duplicate ------------------------------------
dup_mask = (d.search_key == '10395HL') & (d.location_name.str.contains('1(B) OPPOSITE', regex=False))
assert dup_mask.sum() == 1, f'expected 1 duplicate row, found {dup_mask.sum()}'
assert d.loc[dup_mask, 'current_physical_qty'].iloc[0] == 75, 'duplicate qty is not 75'
d = d[~dup_mask].copy()
print('[2] dropped 10395-HL duplicate (75 boxes)')

# ---- 3. rename bracketed stands ----------------------------------------
def fix_stand(v):
    mm = re.fullmatch(r'S\((\d+)\)', str(v).strip())
    return f'S-{mm.group(1)}' if mm else v
for frame in (d, m):
    frame['location_name'] = frame.location_name.map(fix_stand)
m.loc[m.location_name.str.fullmatch(r'S-(23|24|29|30|32)'), 'location_type'] = 'STAND'
print(f'[3] renamed bracketed stands -> {sorted(m[m.location_name.str.fullmatch(r"S-(23|24|29|30|32)")].location_name)}')

# ---- 4. merge the duplicate godown location ----------------------------
BAD, GOOD = 'GODOWN RACK NO. 1(B) OPPOSITE', 'GODOWN RACK NO. 1 (B) OPPOSITE'
assert BAD in set(m.location_name) and GOOD in set(m.location_name), 'merge targets missing'
d['location_name'] = d.location_name.replace(BAD, GOOD)
bad_row = m[m.location_name == BAD].iloc[0]
m.loc[m.location_name == GOOD, 'raw_variants'] = (
    m.loc[m.location_name == GOOD, 'raw_variants'].iloc[0] + ' | ' + str(bad_row.raw_variants))
m = m[m.location_name != BAD].copy()
print(f'[4] merged {BAD!r} into {GOOD!r}')

# ---- validation ---------------------------------------------------------
m = m.drop_duplicates('location_name').reset_index(drop=True)
m['location_code'] = [f'LOC-{i:03d}' for i in range(1, len(m) + 1)]

def nkey(s): return re.sub(r'[^A-Z0-9]', '', str(s).upper())
assert m.location_name.map(nkey).duplicated().sum() == 0, 'duplicate locations remain'
assert d.duplicated(['model_code', 'location_name']).sum() == 0, 'model+location collision'
assert (d.opening_qty == d.current_physical_qty).all(), 'opening != current'
assert set(d.location_name) == set(m.location_name), 'import/master location mismatch'
assert start_qty - d.current_physical_qty.sum() == 75, 'unexpected quantity change'

d.to_csv('tiles_FINAL_import.csv', index=False)
m.to_csv('temp_tiles_location_master_FINAL.csv', index=False)
print(f'\nOUT rows={len(d)} qty={d.current_physical_qty.sum():.0f} '
      f'models={d.model_code.nunique()} locations={len(m)}')
print('ALL ASSERTIONS PASSED')
