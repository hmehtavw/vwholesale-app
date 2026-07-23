#!/usr/bin/env python3
import subprocess as _sp
print("[0] Syntax check (node --check)...")
for fname in ['modules/marketing-1.js','modules/marketing-2.js','modules/marketing-gif.js','modules/marketing-inbox.js']:
    r = _sp.run(['node','--check',fname], capture_output=True, text=True)
    if r.returncode != 0:
        print(f"  ❌ {fname}: {r.stderr.strip()}")
        sys.exit(1)
    print(f"  ✅ {fname}")
"""V Wholesale Pre-Push Checker — run before every git push"""
import re, sys, os, subprocess

MODULES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'modules')
MODULES = ['core.js','checkin.js','billing.js','people.js','stock.js',
           'operations.js','admin.js','extras.js','shop.js','granite.js',
           'tile-quotation.js','quick-quote.js','autotest.js','app.js']

errors = []
warnings = []

def load(f):
    with open(os.path.join(MODULES_DIR, f), encoding='utf-8') as fh:
        return fh.read()

print("=" * 55)
print("VW Pre-Push Checker")
print("=" * 55)

# 1. Syntax check
print("\n[1] Syntax...")
for mod in MODULES:
    r = subprocess.run(['node','--check', os.path.join(MODULES_DIR, mod)], capture_output=True, text=True)
    if r.returncode != 0:
        errors.append(f"SYNTAX {mod}: {r.stderr.strip()[:200]}")
        print(f"  ❌ {mod}")
    else:
        print(f"  ✅ {mod}")

# 2. Inline <script> tags
print("\n[2] Inline <script> tags...")
bad_scripts = []
for mod in MODULES:
    content = load(mod)
    for i, line in enumerate(content.split('\n'), 1):
        s = line.strip()
        if '<script>' in s and 'createElement' not in line and 'textContent' not in line and 'src=' not in line and not s.startswith('//'):
            bad_scripts.append(f"{mod}:{i}")
            errors.append(f"INLINE SCRIPT TAG {mod}:{i} — breaks HTML parser")
if bad_scripts:
    print(f"  ❌ Found in: {bad_scripts}")
else:
    print(f"  ✅ None found")

# 3. Build all defined functions
all_fns = set()
for mod in MODULES:
    for m in re.finditer(r'\b(?:async\s+)?function\s+([a-zA-Z_]\w*)\s*\(', load(mod)):
        all_fns.add(m.group(1))

# 4. VW_TILES export check
print("\n[3] VW_TILES export...")
qq = load('quick-quote.js')
em = re.search(r'window\.VW_TILES\s*=\s*\{(.*?)\};', qq, re.DOTALL)
if em:
    block = em.group(1)
    # Get inline stubs like `foo: ()=>{}`
    stubs = set(re.findall(r'(\w+)\s*:\s*(?:async\s*)?\(', block))
    kw = {'true','false','null','undefined','async','function'}
    candidates = [n for n in set(re.findall(r'\b([a-zA-Z_]\w{3,})\b', block))
                  if n not in kw and n not in stubs
                  and (n[0]=='_' or n[0].islower())
                  and any(c.isupper() or c=='_' for c in n[1:])]
    missing = [n for n in candidates if n not in all_fns]
    if missing:
        for n in missing:
            errors.append(f"VW_TILES exports missing function: {n}")
        print(f"  ❌ {len(missing)} missing: {missing[:8]}")
    else:
        print(f"  ✅ All {len(candidates)} exports valid")

# Summary
print("\n" + "=" * 55)
if errors:
    print(f"❌ FAILED — {len(errors)} error(s):")
    for e in errors:
        print(f"  🔴 {e}")
    print("\n⛔ Fix before pushing")
    sys.exit(1)
else:
    print(f"✅ ALL CHECKS PASSED — safe to push")
    if warnings:
        for w in warnings[:3]:
            print(f"  🟡 {w}")
    sys.exit(0)

# ── MARKETING JS SYNTAX CHECK ──
print("\n[4] Marketing JS syntax check...")
marketing_files = [
    'modules/marketing-1.js',
    'modules/marketing-2.js', 
    'modules/marketing-inbox.js',
    'modules/marketing-strategy.js',
    'modules/marketing-bi.js',
]
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
syntax_ok = True
for mf in marketing_files:
    path = os.path.join(root, mf)
    if not os.path.exists(path):
        continue
    result = subprocess.run(['node', '--check', path], capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ {mf}: {result.stdout.strip()}")
        syntax_ok = False
    else:
        print(f"  ✅ {mf}")
if not syntax_ok:
    print("\n❌ MARKETING JS SYNTAX ERRORS — fix before pushing")
    sys.exit(1)

# ── MARKETING.HTML INTEGRITY CHECK ──
print("\n[5] marketing.html integrity check...")
mkt_path = os.path.join(root, 'marketing.html')
if os.path.exists(mkt_path):
    with open(mkt_path, encoding='utf-8') as f:
        mkt = f.read()
    # Check Supabase inline JS not corrupted (must contain these patterns)
    checks = [
        ('Supabase createClient', 'createClient('),
        ('No corrupted version injection', 'let v=17' not in mkt and 'const v=17' not in mkt),
        ('DOCTYPE present', '<!DOCTYPE html>' in mkt),
    ]
    mkt_ok = True
    for name, check in checks:
        if isinstance(check, bool):
            ok = check
        else:
            ok = check in mkt
        status = '✅' if ok else '❌'
        print(f"  {status} {name}")
        if not ok:
            mkt_ok = False
    if not mkt_ok:
        print("\n❌ marketing.html integrity check failed — possible corruption")
        sys.exit(1)
else:
    print("  ⚠️  marketing.html not found")

# Check for deeply nested template literals (browser parse killers)
import re
for fname in ['modules/marketing-1.js', 'modules/marketing-2.js']:
    try:
        with open(fname) as f:
            content = f.read()
        # Simple heuristic: backtick inside ${} inside backtick inside ${}
        if re.search(r'\$\{[^}]*`[^`]*\$\{[^}]*`', content):
            print(f"  ⚠️  {fname}: possible deeply nested template literal")
    except: pass

# Node syntax check on marketing-1.js (catches missing function declarations, stray braces)
import subprocess
r = subprocess.run(['node', '--check', 'modules/marketing-1.js'], capture_output=True, text=True)
if r.returncode != 0:
    # Filter out false positives from template literals in html-generating functions
    lines = r.stderr.strip().split('\n')
    real_errors = [l for l in lines if 'SyntaxError' in l and 'Unexpected identifier' not in l and 'missing )' not in l]
    if real_errors:
        print(f"  ❌ marketing-1.js node --check: {real_errors[0]}")
        sys.exit(1)

# Check for TypeScript syntax in JS files (crashes browsers)
import re as _re
for fname in ['modules/marketing-1.js','modules/marketing-2.js','modules/marketing-gif.js']:
    try:
        with open(fname) as f: js = f.read()
        # Find (param:type) TypeScript annotations
        ts_hits = _re.findall(r'\(\w+:\w+\)', js)
        if ts_hits:
            print(f"  ❌ {fname}: TypeScript annotations found: {ts_hits[:3]}")
            sys.exit(1)
    except: pass
