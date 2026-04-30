"""Convert equirectangular world map to a high-res tile grid with biomes."""
from PIL import Image
import json

SRC = "/Users/kiprassperauskas/Downloads/country colonise/worldmap_hi.jpg"
COLS = 320
ROWS = 160

img = Image.open(SRC).convert("RGB")
W, H = img.size
print(f"Source: {W}x{H}")
px = img.load()

def is_water(r, g, b):
    return b > r + 12 and b > g - 8 and b > 80

def classify_tile(cx, cy, tw, th):
    """Sample multiple points; return water fraction, avg color, brightness var."""
    samples = 0
    water = 0
    rs = gs = bs = 0
    minR = minG = minB = 255
    maxR = maxG = maxB = 0
    step = max(1, tw // 5)
    for dy in range(0, th, max(1, th // 5)):
        for dx in range(0, tw, step):
            x = cx + dx
            y = cy + dy
            if 0 <= x < W and 0 <= y < H:
                r, g, b = px[x, y]
                rs += r; gs += g; bs += b
                samples += 1
                minR = min(minR, r); maxR = max(maxR, r)
                minG = min(minG, g); maxG = max(maxG, g)
                minB = min(minB, b); maxB = max(maxB, b)
                if is_water(r, g, b):
                    water += 1
    if samples == 0:
        return 1.0, (0, 0, 0), 0
    avg = (rs // samples, gs // samples, bs // samples)
    var = (maxR - minR) + (maxG - minG) + (maxB - minB)
    return water / samples, avg, var

def biome_for(lat_deg, color, is_land, color_var):
    if not is_land:
        return "ocean"
    r, g, b = color
    abs_lat = abs(lat_deg)
    luma = 0.3 * r + 0.59 * g + 0.11 * b

    # Very bright = ice cap
    if luma > 215 and abs_lat > 55:
        return "tundra"

    # Mountain heuristic: high color variance + medium-low brightness, gray-ish
    is_mountain_color = (abs(r - g) < 25 and abs(g - b) < 25)
    if color_var > 80 and is_mountain_color and luma < 170 and luma > 60:
        return "mountain"

    # Polar / sub-polar
    if abs_lat > 67:
        return "tundra"
    if abs_lat > 55:
        return "tundra" if luma > 180 else "forest"

    # Yellowish desert
    yellow_score = (r - b) - max(0, g - r)
    if yellow_score > 35 and r > 160 and 5 < abs_lat < 42:
        return "desert"

    # Equatorial belt
    if abs_lat < 12:
        # bright = desert (Sahel edge), saturated green = jungle
        if g > r and g > b and g > 110:
            return "jungle"
        if yellow_score > 20 and r > 170:
            return "desert"
        return "jungle" if g > 90 else "plains"

    # Subtropical 12-32
    if abs_lat < 32:
        if yellow_score > 15 and r > 150:
            return "desert"
        if g > r + 5 and g > 110:
            return "plains"
        return "desert" if r > g else "plains"

    # Temperate 32-55
    if g > r + 5 and luma < 180:
        return "forest"
    if luma > 200:
        return "plains"
    return "plains" if g >= r else "forest"

tile_w = W / COLS
tile_h = H / ROWS

grid = []
for row in range(ROWS):
    row_data = []
    lat = 90 - (row + 0.5) * (180 / ROWS)
    for col in range(COLS):
        cx = int(col * tile_w)
        cy = int(row * tile_h)
        tw = max(1, int(tile_w))
        th = max(1, int(tile_h))
        water_frac, color, color_var = classify_tile(cx, cy, tw, th)
        is_land = water_frac < 0.55
        biome = biome_for(lat, color, is_land, color_var)
        row_data.append(biome)
    grid.append(row_data)

# Smoothing pass: a single isolated tile gets converted to its majority neighbor
def smooth(grid):
    new = [row[:] for row in grid]
    for r in range(ROWS):
        for c in range(COLS):
            if grid[r][c] == "ocean":
                continue
            cnt = {}
            for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]:
                nr, nc = r+dr, (c+dc) % COLS
                if 0 <= nr < ROWS:
                    b = grid[nr][nc]
                    cnt[b] = cnt.get(b, 0) + 1
            mine = grid[r][c]
            if cnt.get(mine, 0) == 0:
                # all 4 neighbors disagree → convert
                top = max(cnt, key=cnt.get)
                if cnt[top] >= 3 and top != "ocean":
                    new[r][c] = top
    return new
grid = smooth(grid)

# Stats
counts = {}
for row in grid:
    for b in row:
        counts[b] = counts.get(b, 0) + 1
print("Biome counts:", counts)

code = {"ocean": "~", "plains": ".", "forest": "f", "desert": "d",
        "jungle": "j", "tundra": "t", "mountain": "m"}

with open("/Users/kiprassperauskas/Downloads/country colonise/map_data.js", "w") as f:
    rows_str = ["".join(code[b] for b in row) for row in grid]
    f.write(f"const MAP_COLS = {COLS};\n")
    f.write(f"const MAP_ROWS = {ROWS};\n")
    f.write("const MAP_LEGEND = " + json.dumps({v: k for k, v in code.items()}) + ";\n")
    f.write("const MAP_RAW = [\n")
    for r in rows_str:
        f.write("  " + json.dumps(r) + ",\n")
    f.write("];\n")
print(f"Wrote map_data.js - {COLS}x{ROWS}")

# ASCII preview every 4 rows
print("\n--- ASCII Preview ---")
preview_code = {"ocean": " ", "plains": ".", "forest": "f", "desert": "d",
                "jungle": "j", "tundra": "t", "mountain": "M"}
for row in grid[::4]:
    print("".join(preview_code[b] for b in row[::4]))
