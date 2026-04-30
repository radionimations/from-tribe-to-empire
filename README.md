# From Tribe to Empire

A HOI4-inspired alt-history civilization game. Browser-based HTML/Canvas/JS.
Starts in 1000 BC as a tiny tribe; play through real-world history with real
HOI4 province / state / flag / leader data driving the map and chronicles.

## Play

Hosted on GitHub Pages (once you publish): see the link at the top of this
repo. The game is a static site — drop it on any web host that serves the
files as-is.

## Local development

A static server is enough; the game uses `fetch()` for the province grid so
`file://` won't work.

```sh
python3 -m http.server 8765
open http://localhost:8765/index.html
```

## Regenerating data

The runtime reads:

- `hoi4_province_ids.png` — RGB-encoded province IDs, ~500 KB
- `hoi4_biomes.png` — pre-rendered biome map
- `hoi4_data.js` — HOI4 states + cities + GDL provinces
- `leaders.js` — leader portraits + flag tag colors + flag enumeration
- `flags_png/` — every HOI4 flag converted to PNG
- `portraits/` — every HOI4 leader portrait converted to PNG
- `map/definition.csv` — province metadata

These are baked. If you have the HOI4 install locally and want to refresh
them after a DLC update, run:

```sh
python3 build_hoi4_map.py    # province grid + biome PNGs
python3 build_leaders.py     # leaders.js, flags_png/, portraits/
```

The HOI4 install is auto-detected (Steam path on macOS) but isn't needed at
runtime, so it's ignored from the repo.
