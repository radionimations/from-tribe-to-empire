"""Convert HOI4 leader portraits (DDS) → PNG and parse character files
into a leaders.js module the game can consume.

For each tag we care about:
  1. Convert all DDS portraits in gfx/leaders/<TAG>/ → portraits/<TAG>/<file>.png
  2. Parse common/characters/<TAG>.txt to extract country leader entries
     (name, ideology, portrait reference)
  3. Output leaders.js with a HOI4_LEADERS map: tag → list of leaders
"""
from PIL import Image
import os
import re
import json

# Try the local HOI4 dump first; fall back to the Steam install path so the
# script works regardless of which copy of the game files the user has.
HOI4_CANDIDATES = [
    "Hearts of Iron IV",
    os.path.expanduser("~/Library/Application Support/Steam/steamapps/common/Hearts of Iron IV"),
]
HOI4 = next((p for p in HOI4_CANDIDATES if os.path.isdir(p)), HOI4_CANDIDATES[0])
print(f"[build_leaders] using HOI4 install at: {HOI4}")
LEADERS_DIR = os.path.join(HOI4, "gfx/leaders")
CHARACTERS_DIR = os.path.join(HOI4, "common/characters")
OUT_PORTRAIT_DIR = "portraits"
OUT_JS = "leaders.js"

# Auto-discover every 3-letter country tag directory in gfx/leaders/. Skips
# generic region folders ("Africa", "Asia", etc.) so we only process tags.
def discover_target_tags():
    if not os.path.isdir(LEADERS_DIR):
        return []
    return sorted(
        name for name in os.listdir(LEADERS_DIR)
        if os.path.isdir(os.path.join(LEADERS_DIR, name))
        and len(name) == 3 and name.isupper()
    )

TARGET_TAGS = discover_target_tags()
print(f"[build_leaders] discovered {len(TARGET_TAGS)} country tags to process")

# Ideology → readable name + color
IDEOLOGY_LABEL = {
    "democratic": "Democracy",
    "fascism": "Fascism",
    "communism": "Communism",
    "neutrality": "Neutrality",
    "despotism": "Despotism",
}

os.makedirs(OUT_PORTRAIT_DIR, exist_ok=True)
total_portraits = 0
total_failed = 0

# Most DLC content adds leader DDS files into `dlc/<dlc_name>/gfx/leaders/<TAG>/`
# rather than the base game's gfx/leaders/. To get every portrait, we walk the
# base directory PLUS every DLC directory.
def all_leader_source_dirs(tag):
    """Yield every directory that might contain DDS files for this tag."""
    base = os.path.join(LEADERS_DIR, tag)
    if os.path.isdir(base):
        yield base
    dlc_root = os.path.join(HOI4, "dlc")
    if os.path.isdir(dlc_root):
        for dlc in sorted(os.listdir(dlc_root)):
            cand = os.path.join(dlc_root, dlc, "gfx/leaders", tag)
            if os.path.isdir(cand):
                yield cand

# 1. Convert DDS portraits for each TARGET_TAG country (base + DLC sources)
for tag in TARGET_TAGS:
    out_dir = os.path.join(OUT_PORTRAIT_DIR, tag)
    seen = set()
    src_dirs = list(all_leader_source_dirs(tag))
    if not src_dirs:
        continue
    os.makedirs(out_dir, exist_ok=True)
    for src_dir in src_dirs:
        for fn in os.listdir(src_dir):
            if not fn.endswith(".dds") or fn in seen:
                continue
            seen.add(fn)
            out_path = os.path.join(out_dir, fn.replace(".dds", ".png"))
            if os.path.exists(out_path):
                total_portraits += 1
                continue
            try:
                img = Image.open(os.path.join(src_dir, fn)).convert("RGBA")
                img.save(out_path)
                total_portraits += 1
            except Exception as e:
                total_failed += 1
print(f"Portraits ready: {total_portraits} (failed {total_failed})")

# 2. Parse common/characters/<TAG>.txt - country_leader entries
LEADERS = {}
for tag in TARGET_TAGS:
    char_file = os.path.join(CHARACTERS_DIR, tag + ".txt")
    if not os.path.isfile(char_file):
        continue
    with open(char_file, encoding="utf-8", errors="ignore") as f:
        text = f.read()
    leaders = []
    # Each character is a top-level block: NAME = { ... }
    # Inside, country_leader = { ideology = X traits = {...} expire = "Y.M.D" }
    # Also has portraits = { civilian|army|navy = { large = "GFX_..." } }

    # We need to walk balanced braces. Simplest hack: regex for each named block.
    # Find all top-level entries inside characters = { ... }
    chars_match = re.search(r"characters\s*=\s*\{", text)
    if not chars_match:
        continue
    # Walk the file looking for "<id> = {" then capture balanced braces.
    pos = chars_match.end()
    while True:
        m = re.search(r"([A-Za-z_][\w]*)\s*=\s*\{", text[pos:])
        if not m:
            break
        char_id = m.group(1)
        start = pos + m.end()
        depth = 1
        i = start
        while i < len(text) and depth > 0:
            if text[i] == "{": depth += 1
            elif text[i] == "}": depth -= 1
            i += 1
        body = text[start:i - 1]
        pos = i

        # Only keep characters that have a country_leader block
        if "country_leader" not in body:
            continue
        ideology_m = re.search(r"ideology\s*=\s*(\w+)", body)
        portrait_m = re.search(r"large\s*=\s*\"?GFX_(\w+)\"?", body)
        # Display name: prefer the english name= field, else the id
        name_m = re.search(r"\bname\s*=\s*\"([^\"]+)\"", body)
        display = name_m.group(1) if name_m else char_id
        # Strip ugly prefixes like "POL_" from id-style names so they read better
        if display == char_id and char_id.startswith(tag + "_"):
            display = char_id[len(tag) + 1:].replace("_", " ").title()

        leaders.append({
            "id": char_id,
            "name": display,
            "ideology": ideology_m.group(1) if ideology_m else None,
            "portrait": portrait_m.group(1) if portrait_m else None,
        })
    if leaders:
        LEADERS[tag] = leaders

# 3. Write leaders.js
with open(OUT_JS, "w") as f:
    f.write("// Generated by build_leaders.py - HOI4 country leaders + portraits.\n")
    f.write("// Each entry: { id, name, ideology, portrait }\n")
    f.write("// portrait = a GFX key like 'portrait_POL_edward_rydz_smigly';\n")
    f.write("// the actual file lives at portraits/<TAG>/<key>.png\n")
    f.write("const HOI4_LEADERS = " + json.dumps(LEADERS, indent=1) + ";\n")
    f.write("const HOI4_IDEOLOGY_LABEL = " + json.dumps(IDEOLOGY_LABEL) + ";\n")
print(f"Wrote {OUT_JS} with leaders for {len(LEADERS)} tags")
total_leaders = sum(len(v) for v in LEADERS.values())
print(f"Total leaders parsed: {total_leaders}")

# 4. Parse common/countries/<TAG>.txt for the official HOI4 color of each tag.
COUNTRIES_DIR = os.path.join(HOI4, "common/countries")
COLORS = {}
for fn in os.listdir(COUNTRIES_DIR):
    if not fn.endswith(".txt"):
        continue
    path = os.path.join(COUNTRIES_DIR, fn)
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            text = f.read()
    except Exception:
        continue
    # color = { 150 23 23 } - RGB 0..255
    m = re.search(r"^\s*color\s*=\s*\{\s*(\d+)\s+(\d+)\s+(\d+)\s*\}", text, re.M)
    if not m:
        continue
    r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
    # File may not be a 3-letter tag - try to figure out from country_tag_aliases or filename.
    # Actually files in common/countries/ are named after countries (Poland.txt etc.).
    # The tag→file mapping is in common/country_tags/00_countries.txt.
    COLORS[fn[:-4]] = "#" + "".join(f"{c:02x}" for c in (r, g, b))

# Build TAG -> color via common/country_tags/00_countries.txt
TAG_COLORS = {}
tag_file = os.path.join(HOI4, "common/country_tags/00_countries.txt")
if os.path.isfile(tag_file):
    with open(tag_file, encoding="utf-8", errors="ignore") as f:
        for line in f:
            mt = re.match(r"\s*(\w{3})\s*=\s*\"countries/([^\"]+)\"", line)
            if not mt:
                continue
            tag, rel = mt.group(1), mt.group(2)
            base = os.path.basename(rel).replace(".txt", "")
            if base in COLORS:
                TAG_COLORS[tag] = COLORS[base]

with open(OUT_JS, "a") as f:
    f.write("const HOI4_COUNTRY_COLORS = " + json.dumps(TAG_COLORS) + ";\n")
print(f"Wrote {len(TAG_COLORS)} HOI4 country colors")

# 5a. Rebuild flags_png/ directly from HOI4 source TGAs (base + DLC). This
# fixes "wrong flag" cases where flags_png/<TAG>.png was previously some
# alt-history variant (e.g. a USA flag with a crown). For each tag without
# a plain <TAG>.tga we fall back to <TAG>_democratic / _neutrality / ... so
# the modern flag is what gets used by default.
flags_dir = "flags_png"
os.makedirs(flags_dir, exist_ok=True)

# Collect every TGA path keyed by basename (without extension), with later
# DLCs taking precedence when there's a name collision.
def all_flag_tga_sources():
    sources = {}
    base_dir = os.path.join(HOI4, "gfx/flags")
    for path in (base_dir,):
        if os.path.isdir(path):
            for fn in os.listdir(path):
                if fn.endswith(".tga"):
                    sources[fn[:-4]] = os.path.join(path, fn)
    dlc_root = os.path.join(HOI4, "dlc")
    if os.path.isdir(dlc_root):
        for dlc in sorted(os.listdir(dlc_root)):
            d = os.path.join(dlc_root, dlc, "gfx/flags")
            if not os.path.isdir(d):
                continue
            for fn in os.listdir(d):
                if fn.endswith(".tga"):
                    sources[fn[:-4]] = os.path.join(d, fn)
    return sources

TGA_SOURCES = all_flag_tga_sources()
print(f"[build_leaders] discovered {len(TGA_SOURCES)} HOI4 flag TGAs")

# Convert every flag variant (TAG, TAG_democratic, TAG_fascism, etc.).
# Always overwrite - existing PNGs may have come from a different/wrong source.
flag_converted = 0
flag_failed = 0
for stem, src in TGA_SOURCES.items():
    out = os.path.join(flags_dir, stem + ".png")
    try:
        Image.open(src).convert("RGBA").save(out)
        flag_converted += 1
    except Exception:
        flag_failed += 1

# For each 3-letter country tag, parse its 1936 ruling_party from
# history/countries/<TAG> - <Name>.txt and use the corresponding ideology
# variant as the default <TAG>.png. This gives Germany the Nazi flag, USA the
# stars-and-stripes (democratic), USSR the hammer-and-sickle, etc - matching
# what the country actually looked like in HOI4's start year.
def discover_ruling_parties():
    """Returns dict { TAG: 'democratic'/'fascism'/'communism'/'neutrality' }."""
    parties = {}
    history_dirs = []
    for base in (HOI4,):
        d = os.path.join(base, "history/countries")
        if os.path.isdir(d):
            history_dirs.append(d)
    dlc_root = os.path.join(HOI4, "dlc")
    if os.path.isdir(dlc_root):
        for dlc in sorted(os.listdir(dlc_root)):
            d = os.path.join(dlc_root, dlc, "history/countries")
            if os.path.isdir(d):
                history_dirs.append(d)

    for d in history_dirs:
        for fn in os.listdir(d):
            if not fn.endswith(".txt"):
                continue
            # Filename format: "TAG - Name.txt"
            tag = fn.split(" - ", 1)[0].strip()
            if len(tag) != 3 or not tag.isupper():
                continue
            try:
                with open(os.path.join(d, fn), encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except Exception:
                continue
            # Strip line comments so commented-out blocks don't fool us.
            text = re.sub(r"#[^\n]*", "", text)
            # Use the FIRST ruling_party line - extra blocks in scripted scope
            # changes shouldn't override the start-of-game default.
            m = re.search(r"ruling_party\s*=\s*(\w+)", text)
            if m:
                parties[tag] = m.group(1).lower()
    return parties

RULING_PARTIES = discover_ruling_parties()
print(f"[build_leaders] parsed ruling_party for {len(RULING_PARTIES)} tags")

# Now write <TAG>.png from <TAG>_<ruling_party>.tga whenever possible.
# Falls back to democratic / neutrality / communism / fascism / first variant.
ideology_priority = ["democratic", "neutrality", "communism", "fascism"]
all_tag_stems = set(TGA_SOURCES.keys())
all_three_letter = sorted({s.split("_", 1)[0] for s in all_tag_stems if len(s.split("_", 1)[0]) == 3})
plain_overrides = 0
for tag in all_three_letter:
    plain_png = os.path.join(flags_dir, tag + ".png")
    chosen = None
    # First choice: actual ruling party from history/countries.
    if tag in RULING_PARTIES:
        key = f"{tag}_{RULING_PARTIES[tag]}"
        if key in TGA_SOURCES:
            chosen = key
    # Fall back to ideology priority order.
    if not chosen:
        for ideo in ideology_priority:
            key = f"{tag}_{ideo}"
            if key in TGA_SOURCES:
                chosen = key
                break
    # Last resort: any variant we have for this tag.
    if not chosen:
        for stem in sorted(all_tag_stems):
            if stem.startswith(tag + "_"):
                chosen = stem
                break
    if chosen:
        try:
            Image.open(TGA_SOURCES[chosen]).convert("RGBA").save(plain_png)
            plain_overrides += 1
        except Exception:
            pass
print(f"[build_leaders] rewrote {plain_overrides} default flags from ruling-party data")

print(f"Flags converted: {flag_converted} (failed {flag_failed})")

# 5b. Enumerate every flag PNG so the customize picker can list them all.
ALL_FLAGS = []
if os.path.isdir(flags_dir):
    for fn in sorted(os.listdir(flags_dir)):
        if fn.endswith(".png"):
            ALL_FLAGS.append(fn[:-4])
with open(OUT_JS, "a") as f:
    f.write("const HOI4_ALL_FLAGS = " + json.dumps(ALL_FLAGS) + ";\n")
print(f"Wrote {len(ALL_FLAGS)} flag filenames")

# 6a. Build a portrait_stem -> "Display Name" lookup by walking EVERY
# character file in base + DLCs (not just the ones with country_leader
# blocks - this also catches generals, admirals, advisors, etc.)
def build_portrait_name_lookup():
    """Returns dict { 'portrait_LIT_zigmas_angarietis': 'Zigmas Angarietis', ... }"""
    lookup = {}
    char_dirs = [CHARACTERS_DIR]
    dlc_root = os.path.join(HOI4, "dlc")
    if os.path.isdir(dlc_root):
        for dlc in sorted(os.listdir(dlc_root)):
            cand = os.path.join(dlc_root, dlc, "common/characters")
            if os.path.isdir(cand):
                char_dirs.append(cand)

    for char_dir in char_dirs:
        for fn in os.listdir(char_dir):
            if not fn.endswith(".txt"):
                continue
            try:
                with open(os.path.join(char_dir, fn), encoding="utf-8", errors="ignore") as f:
                    text = f.read()
            except Exception:
                continue
            chars_match = re.search(r"characters\s*=\s*\{", text)
            if not chars_match:
                continue
            pos = chars_match.end()
            # Walk top-level character blocks.
            while True:
                m = re.search(r"([A-Za-z_][\w]*)\s*=\s*\{", text[pos:])
                if not m:
                    break
                char_id = m.group(1)
                start = pos + m.end()
                depth = 1
                i = start
                while i < len(text) and depth > 0:
                    if text[i] == "{": depth += 1
                    elif text[i] == "}": depth -= 1
                    i += 1
                body = text[start:i - 1]
                pos = i

                # Display name: prefer the explicit name= field, else humanize the id.
                name_m = re.search(r"\bname\s*=\s*\"([^\"]+)\"", body)
                if name_m:
                    display = name_m.group(1).strip()
                else:
                    display = char_id
                    # Strip "<TAG>_" prefix from id-style names if present.
                    if "_" in char_id:
                        first = char_id.split("_", 1)[0]
                        if first.isupper() and len(first) <= 4:
                            display = char_id[len(first) + 1:]
                    display = display.replace("_", " ").strip().title()

                # Each character can have multiple portrait keys (large army,
                # large civilian, large navy). Capture all stems.
                for pm in re.finditer(r"large\s*=\s*\"?GFX_(\w+)\"?", body):
                    stem = pm.group(1)
                    if stem not in lookup:
                        lookup[stem] = display
    return lookup

PORTRAIT_NAMES = build_portrait_name_lookup()
print(f"[build_leaders] portrait-name lookup: {len(PORTRAIT_NAMES)} entries")

# 6b. Enumerate every portrait PNG in portraits/<TAG>/ - each one becomes a
# pickable option in the customize modal. Use PORTRAIT_NAMES for the display
# string when available; otherwise fall back to a title-cased filename stem.
ALL_PORTRAITS = []
if os.path.isdir(OUT_PORTRAIT_DIR):
    for tag in sorted(os.listdir(OUT_PORTRAIT_DIR)):
        tag_dir = os.path.join(OUT_PORTRAIT_DIR, tag)
        if not os.path.isdir(tag_dir):
            continue
        for fn in sorted(os.listdir(tag_dir)):
            if not fn.endswith(".png"):
                continue
            stem = fn[:-4]
            # 1st choice: real human name from character file.
            if stem in PORTRAIT_NAMES:
                pretty = PORTRAIT_NAMES[stem]
            else:
                # 2nd: try lowercase-tag variant of the filename.
                lower_stem = stem.replace(f"_{tag}_", f"_{tag.lower()}_") if f"_{tag}_" in stem else stem
                if lower_stem in PORTRAIT_NAMES:
                    pretty = PORTRAIT_NAMES[lower_stem]
                else:
                    # 3rd: humanize the filename - strip "portrait_<TAG>_" / "Portrait_<tag>_".
                    pretty = stem
                    for prefix in (
                        f"portrait_{tag}_",
                        f"Portrait_{tag.lower()}_",
                        f"portrait_{tag.lower()}_",
                        f"Portrait_{tag}_",
                    ):
                        if pretty.startswith(prefix):
                            pretty = pretty[len(prefix):]
                            break
                    pretty = pretty.replace("_", " ").strip().title()
            ALL_PORTRAITS.append({"tag": tag, "file": stem, "name": pretty or stem})
with open(OUT_JS, "a") as f:
    f.write("const HOI4_ALL_PORTRAITS = " + json.dumps(ALL_PORTRAITS) + ";\n")
print(f"Wrote {len(ALL_PORTRAITS)} portrait entries")
