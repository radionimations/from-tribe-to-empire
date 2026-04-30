"""Preprocess HOI4 ripped map files into game-usable assets.

Outputs:
  hoi4_biomes.png  - downscaled biome image (each pixel colored by terrain)
  hoi4_data.js    - JS module with cities, states, dimensions, projection params
  province_centroids.json - internal, can be deleted later
"""
from PIL import Image
import csv
import os
import re
import json
from collections import defaultdict

DS = 2              # downscale factor - high res for HiDPI displays
SAMPLE = 2          # province scan stride for centroids
LOGIC_COLS = 352    # game logic grid (matches HOI4 aspect 2.75:1)
LOGIC_ROWS = 128

# --- Step 1: parse definition.csv ---
provinces = {}  # rgb_int -> {id, type, terrain}
with open("map/definition.csv") as f:
    reader = csv.reader(f, delimiter=";")
    for row in reader:
        if len(row) < 7:
            continue
        try:
            pid = int(row[0])
            r, g, b = int(row[1]), int(row[2]), int(row[3])
            ptype = row[4]      # land/sea/lake
            terrain = row[6]    # forest/hills/...
        except ValueError:
            continue
        rgb_int = (r << 16) | (g << 8) | b
        provinces[rgb_int] = {"id": pid, "type": ptype, "terrain": terrain}
print(f"Loaded {len(provinces)} provinces from definition.csv")

# --- Step 2: scan provinces.bmp for centroids ---
img = Image.open("map/provinces.bmp").convert("RGB")
W, H = img.size
print(f"provinces.bmp: {W}x{H}")
px = img.load()

centroids = defaultdict(lambda: [0, 0, 0])  # pid -> [sx, sy, n]
for y in range(0, H, SAMPLE):
    for x in range(0, W, SAMPLE):
        r, g, b = px[x, y]
        rgb_int = (r << 16) | (g << 8) | b
        prov = provinces.get(rgb_int)
        if prov:
            d = centroids[prov["id"]]
            d[0] += x; d[1] += y; d[2] += 1

centroid_pos = {pid: (sx // n, sy // n) for pid, (sx, sy, n) in centroids.items() if n > 0}
print(f"Computed centroids for {len(centroid_pos)} provinces")

# --- Step 3: generate downscaled biome image ---
BIOME_COLORS = {
    "plains":   (90, 165, 80),
    "forest":   (32, 100, 45),
    "jungle":   (12, 110, 60),
    "desert":   (220, 200, 110),
    "hills":    (130, 145, 90),
    "mountain": (105, 95, 88),
    "marsh":    (90, 130, 100),
    # Urban areas didn't exist in the tribal age - render them as plains in the
    # base biome bake. The game will dynamically place cities as eras advance.
    "urban":    (90, 165, 80),
    "lakes":    (40, 100, 175),
    "ocean":    (24, 70, 145),
    "unknown":  (60, 60, 60),
}
OUT_W, OUT_H = W // DS, H // DS
biome_img = Image.new("RGB", (OUT_W, OUT_H), BIOME_COLORS["ocean"])
bp = biome_img.load()

for y in range(OUT_H):
    sy = min(H - 1, y * DS + DS // 2)
    for x in range(OUT_W):
        sx = min(W - 1, x * DS + DS // 2)
        r, g, b = px[sx, sy]
        rgb_int = (r << 16) | (g << 8) | b
        prov = provinces.get(rgb_int)
        if prov:
            terrain = prov["terrain"]
            color = BIOME_COLORS.get(terrain, BIOME_COLORS["unknown"])
        else:
            color = BIOME_COLORS["ocean"]
        bp[x, y] = color

biome_img.save("hoi4_biomes.png")
print(f"Wrote hoi4_biomes.png ({OUT_W}x{OUT_H})")

# Also output province-ID-per-pixel PNG (RGB encodes the province ID).
# Game uses this for province-based ownership rendering and click hit-test.
prov_id_img = Image.new("RGB", (OUT_W, OUT_H), (0, 0, 0))
pip = prov_id_img.load()
for y in range(OUT_H):
    sy = min(H - 1, y * DS + DS // 2)
    for x in range(OUT_W):
        sx = min(W - 1, x * DS + DS // 2)
        rr, gg, bb = px[sx, sy]
        rgb_int = (rr << 16) | (gg << 8) | bb
        prov = provinces.get(rgb_int)
        if prov:
            pid = prov["id"]
            pip[x, y] = (pid & 0xff, (pid >> 8) & 0xff, (pid >> 16) & 0xff)
        else:
            pip[x, y] = (0, 0, 0)
prov_id_img.save("hoi4_province_ids.png")
print(f"Wrote hoi4_province_ids.png ({OUT_W}x{OUT_H})")

# Province → game tile mapping (each province assigned to the tile containing its centroid).
province_tile = {}
SAMPLE_TILE_W2 = W / LOGIC_COLS
SAMPLE_TILE_H2 = H / LOGIC_ROWS
for pid, (cx, cy) in centroid_pos.items():
    col = min(LOGIC_COLS - 1, int(cx / SAMPLE_TILE_W2))
    row = min(LOGIC_ROWS - 1, int(cy / SAMPLE_TILE_H2))
    province_tile[pid] = [col, row]

# --- Step 3b: build the game logic grid by sampling HOI4 terrain.
# We collect the most common terrain among the source pixels for each game tile.
from collections import Counter
SAMPLE_TILE_W = W / LOGIC_COLS
SAMPLE_TILE_H = H / LOGIC_ROWS

logic_grid = []
for r in range(LOGIC_ROWS):
    row_data = []
    y0 = int(r * SAMPLE_TILE_H)
    y1 = int((r + 1) * SAMPLE_TILE_H)
    for c in range(LOGIC_COLS):
        x0 = int(c * SAMPLE_TILE_W)
        x1 = int((c + 1) * SAMPLE_TILE_W)
        terrains = Counter()
        for y in range(y0, y1, max(1, (y1 - y0) // 3)):
            for x in range(x0, x1, max(1, (x1 - x0) // 3)):
                rr, gg, bb = px[x, y]
                rgb_int = (rr << 16) | (gg << 8) | bb
                prov = provinces.get(rgb_int)
                if prov:
                    t = prov["terrain"]
                    if t == "urban":
                        t = "plains"   # tribal age - no urban
                    if t == "lakes":
                        t = "ocean"    # treat lakes as water for gameplay
                    if t == "marsh":
                        t = "plains"
                    if t == "hills":
                        t = "forest"
                    terrains[t] += 1
                else:
                    terrains["ocean"] += 1
        if terrains:
            row_data.append(terrains.most_common(1)[0][0])
        else:
            row_data.append("ocean")
    logic_grid.append(row_data)

# Encode logic grid for map_data.js
code = {"ocean": "~", "plains": ".", "forest": "f", "desert": "d",
        "jungle": "j", "tundra": "t", "mountain": "m"}
# Add any terrain we don't have a code for as plains
def enc(t):
    return code.get(t, ".")
with open("map_data.js", "w") as f:
    f.write(f"const MAP_COLS = {LOGIC_COLS};\n")
    f.write(f"const MAP_ROWS = {LOGIC_ROWS};\n")
    f.write("const MAP_LEGEND = " + json.dumps({v: k for k, v in code.items()}) + ";\n")
    f.write("const MAP_RAW = [\n")
    for row in logic_grid:
        f.write("  " + json.dumps("".join(enc(t) for t in row)) + ",\n")
    f.write("];\n")
print(f"Wrote map_data.js (logic grid {LOGIC_COLS}x{LOGIC_ROWS})")

# --- Step 4: parse state files for cities + ownership ---
states = []
state_dir = "states"
for fn in sorted(os.listdir(state_dir)):
    if not fn.endswith(".txt"):
        continue
    with open(os.path.join(state_dir, fn), encoding="utf-8", errors="ignore") as f:
        text = f.read()

    m_id = re.search(r"\bid\s*=\s*(\d+)", text)
    m_owner = re.search(r"\bowner\s*=\s*([A-Z]{3})", text)
    m_name = re.search(r'\bname\s*=\s*"([^"]+)"', text)
    m_cat = re.search(r"state_category\s*=\s*(\w+)", text)
    if not m_id:
        continue
    state_id = int(m_id.group(1))
    owner = m_owner.group(1) if m_owner else None

    # Extract victory points and pick highest as capital. Some VP blocks span
    # multiple lines or have inline comments after the opening brace, e.g.
    #   victory_points = { #Helsinki
    #       11105 15
    #   }
    vp_blocks = re.findall(r"victory_points\s*=\s*\{(.+?)\}", text, re.DOTALL)
    vps_int = []
    for block in vp_blocks:
        clean = re.sub(r"#[^\n]*", "", block)  # strip comments
        m = re.search(r"(\d+)\s+(\d+)", clean)
        if m:
            vps_int.append((int(m.group(1)), int(m.group(2))))
    capital_pid = None
    vp_score = 0
    if vps_int:
        vps_int.sort(key=lambda x: -x[1])
        capital_pid, vp_score = vps_int[0]

    # Parse province list for this state - needed for state-grouping even if
    # the state has no victory points (many African colonial states don't).
    province_ids = []
    m_provs = re.search(r"provinces\s*=\s*\{([^}]*)\}", text)
    if m_provs:
        for p in m_provs.group(1).split():
            if p.isdigit():
                province_ids.append(int(p))

    # If no VP, fall back to the first province as the state's "anchor" position.
    if not capital_pid or capital_pid not in centroid_pos:
        for pid in province_ids:
            if pid in centroid_pos:
                capital_pid = pid
                vp_score = 0
                break
    if not capital_pid or capital_pid not in centroid_pos:
        continue   # state has no usable provinces at all

    cx, cy = centroid_pos[capital_pid]
    display = fn.replace(".txt", "")
    if "-" in display:
        display = display.split("-", 1)[1]
    states.append({
        "id": state_id,
        "owner": owner,
        "name": display,
        "vp": vp_score,
        "x": cx // DS,
        "y": cy // DS,
        "category": m_cat.group(1) if m_cat else "rural",
        "provinces": province_ids,
    })

print(f"Parsed {len(states)} states with capitals")

# Also extract LIT-owned states from GDLstates/ - represents GDL's peak.
# We just want the province IDs of any state in that folder owned by LIT.
gdl_provinces = []
gdl_dir = "GDLstates"
if os.path.isdir(gdl_dir):
    for fn in sorted(os.listdir(gdl_dir)):
        if not fn.endswith(".txt"):
            continue
        with open(os.path.join(gdl_dir, fn), encoding="utf-8", errors="ignore") as f:
            t = f.read()
        if not re.search(r"\bowner\s*=\s*LIT\b", t):
            continue
        m_provs = re.search(r"provinces\s*=\s*\{([^}]*)\}", t)
        if m_provs:
            for p in m_provs.group(1).split():
                if p.isdigit():
                    gdl_provinces.append(int(p))
    print(f"GDLstates/: {len(gdl_provinces)} province IDs in LIT-tagged states (GDL peak)")

# --- Step 5: write hoi4_data.js ---
with open("hoi4_data.js", "w") as f:
    f.write(f"const HOI4_W = {OUT_W};\nconst HOI4_H = {OUT_H};\n")
    f.write(f"const HOI4_FULL_W = {W};\nconst HOI4_FULL_H = {H};\n")
    f.write("const HOI4_TERRAIN_COLORS = " + json.dumps(BIOME_COLORS) + ";\n")
    f.write("const HOI4_CITIES = " + json.dumps(states) + ";\n")
    # Flat array form for compactness: at index pid, two consecutive entries (col, row)
    max_pid = max(province_tile.keys()) if province_tile else 0
    flat = [-1] * ((max_pid + 1) * 2)
    for pid, (col, row) in province_tile.items():
        flat[pid * 2] = col
        flat[pid * 2 + 1] = row
    f.write(f"const HOI4_PROVINCE_TILE_FLAT = {json.dumps(flat)};\n")
    f.write(f"const HOI4_MAX_PROVINCE_ID = {max_pid};\n")
    # Province IDs forming GDL's peak territory (owner=LIT in GDLstates/)
    f.write(f"const HOI4_GDL_PROVINCES = {json.dumps(gdl_provinces)};\n")
print(f"Wrote hoi4_data.js (max province id = {max_pid})")

# --- Quick stats ---
terrain_counts = defaultdict(int)
for prov in provinces.values():
    terrain_counts[prov["terrain"]] += 1
print("Terrain distribution:", dict(terrain_counts))
