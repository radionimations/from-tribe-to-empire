

const TILE = 8;                          
const COLS = 352;                        
const ROWS = 128;                        
const MAP_W = COLS * TILE;               
const MAP_H = ROWS * TILE;               

const LAT_TOP = 90;
const LAT_BOTTOM = -56;
const LAT_SPAN = LAT_TOP - LAT_BOTTOM;
const START_YEAR = -1000;
const YEARS_PER_TURN = 5;

const WAR_MODE_YEARS_PER_TURN = 1 / 365;
function currentYearsPerTurn() {
  return state && state.warMode ? WAR_MODE_YEARS_PER_TURN : YEARS_PER_TURN;
}

const SPEED_TURN_MS = [Infinity, 4000, 1800, 900, 450, 200, 50];   

const BIOME_COLORS = {
  ocean:    "#1a3a6a",
  plains:   "#3a8a4a",
  forest:   "#1f5a2a",
  jungle:   "#0e6e3e",
  desert:   "#d4b85a",
  tundra:   "#a8b8c8",
  mountain: "#6a5a4a",
};

const BIOME_FOOD = {
  plains: 3, forest: 2, jungle: 2, desert: 0, tundra: 0, mountain: 1, ocean: 0,
};
const BIOME_DEFENSE = {
  plains: 0, forest: 1, jungle: 1, desert: 0, tundra: 0, mountain: 3, ocean: 0,
};
const PASSABLE = (b) => {
  if (typeof state !== "undefined" && state && state.currentPlanet && state.currentPlanet !== "Earth") return true;
  return b !== "ocean";
};

function canMoveInto(civ, biome) {
  const offEarth = typeof state !== "undefined" && state && state.currentPlanet && state.currentPlanet !== "Earth";
  if (offEarth) return true;
  if (civ && civ.aquaticOnly) return biome === "ocean";
  if (biome === "ocean") return !!(civ && civ.era >= 1);
  return PASSABLE(biome);
}

const ERAS = [
  { name: "Tribal Age",       threshold: 0,    yearGuide: -1000 },
  { name: "Classical Age",    threshold: 100,  yearGuide: -500 },
  { name: "Medieval Age",     threshold: 350,  yearGuide: 500 },
  { name: "Renaissance",      threshold: 800,  yearGuide: 1400 },
  { name: "Industrial Age",   threshold: 1600, yearGuide: 1800 },
  { name: "Modern Age",       threshold: 3000, yearGuide: 1950 },
  { name: "Information Age",  threshold: 5000, yearGuide: 2020 },
];

const UNITS = {
  warrior:   { era: 0, cost: 12, str: 4,   name: "Warriors" },

  colonizer: { era: 0, cost: 18, str: 2,   name: "Colonizers", maxMoves: 2, claimsProvince: true },

  
  leader:    { era: 0, cost: 30, str: 1,   name: "Leaders", assistsPlayer: true },
  archer:    { era: 1, cost: 16, str: 6,   name: "Archers" },
  legion:    { era: 1, cost: 22, str: 9,   name: "Legion" },
  knight:    { era: 2, cost: 30, str: 14,  name: "Knights" },
  musketeer: { era: 3, cost: 35, str: 20,  name: "Musketeers" },
  rifleman:  { era: 4, cost: 50, str: 32,  name: "Riflemen" },
  tank:      { era: 5, cost: 80, str: 60,  name: "Armor" },
  modern:    { era: 6, cost: 120, str: 100, name: "Mech Inf." },
  // Rocket Scraps: era-6 only, immovable, no combat. Stockpile 10+ to
  // launch a rocket to another planet (Launch button in the tile-action
  // panel). More scraps unlock farther destinations.
  rocket_scraps: { era: 6, cost: 200, str: 0, name: "Rocket Scraps", immovable: true },
};
const SETTLER_COST = 25;

const CIV_COLORS = [
  "#ffd24a", "#e85d4a", "#5da9e8", "#9b6ae8", "#6acf6a",
  "#e8a04a", "#4ae8c4", "#e84a9b", "#b8e84a", "#c46060",
  "#4a8ae8", "#e8e84a", "#a06bff", "#ff7d4a", "#4ae87d",
  "#ff4a8a", "#3aa9c4", "#a8c44a", "#c44aa8", "#4ac4c4",
];

let MAP = Array.from({ length: ROWS }, () => new Array(COLS).fill("ocean"));

const HOI4_TERRAIN_TO_BIOME = {
  ocean: "ocean", lakes: "ocean",
  plains: "plains", marsh: "plains", urban: "plains",
  forest: "forest", hills: "forest",
  jungle: "jungle",
  desert: "desert",
  mountain: "mountain",
};

function buildMapFromProvinces(provinceTerrain) {
  
  const newMap = Array.from({ length: ROWS }, () => new Array(COLS).fill("ocean"));
  if (!provinceGrid) return newMap;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      
      const counts = new Map();
      for (let dy = 1; dy < TILE; dy += Math.max(1, TILE >> 1)) {
        for (let dx = 1; dx < TILE; dx += Math.max(1, TILE >> 1)) {
          const x = c * TILE + dx;
          const y = r * TILE + dy;
          if (x >= MAP_W || y >= MAP_H) continue;
          const pid = provinceGrid[y * MAP_W + x];
          if (pid === 0) continue;
          const terrain = provinceTerrain[pid];
          if (!terrain) continue;
          const biome = HOI4_TERRAIN_TO_BIOME[terrain] || "plains";
          counts.set(biome, (counts.get(biome) || 0) + 1);
        }
      }
      
      let best = "ocean", bestCount = 0;
      for (const [biome, n] of counts) {
        if (n > bestCount) { bestCount = n; best = biome; }
      }
      newMap[r][c] = best;
    }
  }
  return newMap;
}

function tileAt(c, r) {
  if (r < 0 || r >= ROWS || c < 0) return null;
  c = ((c % COLS) + COLS) % COLS; 
  return MAP[r][c];
}

function neighbors(c, r) {
  const out = [];
  for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nr = r + dr;
    if (nr < 0 || nr >= ROWS) continue;
    const nc = ((c + dc) % COLS + COLS) % COLS;
    out.push([nc, nr]);
  }
  return out;
}

function coastalLand(c, r) {
  if (!PASSABLE(MAP[r][c])) return false;
  for (const [nc, nr] of neighbors(c, r)) {
    if (MAP[nr][nc] === "ocean") return true;
  }
  return false;
}

const INITIAL_ALLIANCES = [
  ["Polans", "Balts"],          
  ["Polans", "Bohemia"],        
];

const HISTORICAL_CIVS = [
  { name: "Egypt",       lat: 30,  lon: 31,   color: "#ffd24a" },
  { name: "Phoenicia",   lat: 33,  lon: 35,   color: "#a8326a" },
  { name: "Assyria",     lat: 36,  lon: 43,   color: "#c46060" },
  { name: "Babylon",     lat: 32,  lon: 44,   color: "#9b6ae8" },
  { name: "Greeks",      lat: 38,  lon: 23,   color: "#5da9e8" },
  { name: "Etruscans",   lat: 43,  lon: 12,   color: "#e85d4a" },
  { name: "Latins",      lat: 41.9,lon: 12.5, color: "#a02828" }, 
  { name: "Celts",       lat: 47,  lon: 13,   color: "#6acf6a" },
  { name: "Gauls",       lat: 47,  lon: 3,    color: "#3aaa3a" },
  { name: "Iberians",    lat: 40,  lon: -3,   color: "#e8a04a" },
  { name: "Germans",     lat: 52,  lon: 10,   color: "#4ae8c4" },

  { name: "Polans",      state: "Poland",      lat: 52, lon: 19, color: "#dc143c" },
  { name: "Balts",       state: "Kaunas",      lat: 55, lon: 24, color: "#1f5a3a" },
  { name: "Finns",       state: "Uusima",      lat: 62, lon: 25, color: "#7ec0ee" }, 
  { name: "Norse",       state: "Skåne",       lat: 60, lon: 16, color: "#3a6ad8" }, 
  { name: "East Slavs",  state: "Moscow Area", lat: 56, lon: 38, color: "#b8e84a" },
  { name: "Scythians",   lat: 50,  lon: 50,   color: "#a8c44a" },
  { name: "Thracians",   lat: 43,  lon: 25,   color: "#8a6a3c" },
  { name: "Medes",       lat: 35,  lon: 50,   color: "#ff7d4a" },
  { name: "Vedic India", lat: 28,  lon: 77,   color: "#ff4a8a" },
  { name: "Dravidians",  lat: 11,  lon: 78,   color: "#c4408a" },
  { name: "Zhou China",  lat: 35,  lon: 110,  color: "#e84a4a" },
  { name: "Gojoseon",    lat: 39,  lon: 125,  color: "#4ae87d" },
  { name: "Yamato",      lat: 35,  lon: 138,  color: "#ffe04a" },
  { name: "Olmec",       lat: 18,  lon: -94,  color: "#3aa9c4" },
  { name: "Chavin",      lat: -9,  lon: -77,  color: "#c44aa8" },
  { name: "Kush",        lat: 18,  lon: 32,   color: "#a06bff" },
  { name: "Berbers",     lat: 32,  lon:  0,   color: "#d4a657" },
];

const HISTORICAL_EVENTS = [

  
  
  { year: -999, type: "alliance", a: "Polans", b: "Balts", message: "Polans and Balts swear a non-aggression pact - the seed of every later Polish-Lithuanian union" },

  { year: -750, civ: { name: "Kingdom of Kush", lat: 18.5, lon: 31.8, color: "#a06bff" }, replaces: "Kush",
    message: "Kingdom of Kush rises at Napata - the Nubian state asserts itself south of Egypt" },
  { year: -727, type: "claim", civ: "Kingdom of Kush", region: { lat: [15, 30], lon: [25, 38] },
    message: "Kushite Pharaohs of the 25th Dynasty conquer Egypt" },
  { year: -591, type: "claim", civ: "Kingdom of Kush", region: { lat: [10, 22], lon: [28, 38] },
    message: "Kingdom of Kush retreats south to Meroe after losing Egypt" },
  { year: -300, civ: { name: "Meroitic Kingdom", lat: 16.93, lon: 33.72, color: "#9054e8" }, replaces: "Kingdom of Kush",
    message: "Meroitic Kingdom proclaimed - Kush relocates fully to Meroe and forges its own script" },
  { year: -100, type: "claim", civ: "Meroitic Kingdom", region: { lat: [10, 22], lon: [25, 40] },
    message: "Meroitic Kingdom controls the entire Middle Nile and Red Sea trade" },
  { year: 350, type: "secede", target: "Meroitic Kingdom", civ: "Nobatia",
    spawn: { name: "Nobatia", lat: 21.0, lon: 31.5, color: "#7d3ad8" },
    region: { lat: [20, 24], lon: [29, 33] },
    message: "Nobatia secedes from the collapsing Meroitic Kingdom in Lower Nubia" },
  { year: 360, type: "secede", target: "Meroitic Kingdom", civ: "Makuria",
    spawn: { name: "Makuria", lat: 18.5, lon: 31.8, color: "#a06bff" },
    region: { lat: [16, 21], lon: [29, 33] },
    message: "Makuria secedes from the collapsing Meroitic Kingdom in Middle Nubia" },
  { year: 370, type: "secede", target: "Meroitic Kingdom", civ: "Alodia",
    spawn: { name: "Alodia", lat: 15.6, lon: 32.5, color: "#5d3ac4" },
    region: { lat: [12, 17], lon: [30, 36] },
    message: "Alodia rises in Upper Nubia as the Meroitic Kingdom finally falls" },
  { year: 700, type: "merge", from: ["Nobatia", "Makuria"], to: { name: "Greater Makuria", color: "#a06bff" },
    message: "Greater Makuria - Nobatia and Makuria unite against Arab raids" },
  { year: 1317, civ: { name: "Sennar Sultanate", lat: 13.55, lon: 33.62, color: "#7a5a3a" }, replaces: "Greater Makuria",
    message: "Sennar Sultanate - the Funj clans displace the last Christian Nubian kingdom" },
  { year: 1504, type: "claim", civ: "Sennar Sultanate", region: { lat: [10, 18], lon: [30, 38] },
    message: "Sennar Sultanate consolidates the Middle Nile" },
  { year: 1820, type: "absorb", absorber: "Ottomans", target: "Sennar Sultanate",
    message: "Ottoman Egypt conquers the Sennar Sultanate - Nubia falls under Ottoman-Egyptian rule" },


  

  
  
  { year: -753, civ: { name: "Rome", lat: 42, lon: 12.5, color: "#a02828" }, replaces: "Latins", message: "Romulus founds the city of Rome" },
  
  { year: -509, type: "claim", civ: "Rome", region: { lat: [41, 43], lon: [11, 14] }, message: "Rome becomes a Republic; expels the last king" },
  
  { year: -390, type: "war", a: "Rome", b: "Etruscans", region: { lat: [39, 44], lon: [10, 16] }, reinforce: 6, message: "Rome wars against the Etruscan league" },
  { year: -280, type: "claim", civ: "Rome", region: { lat: [37, 46], lon: [7, 19] },
    requireDeadCivs: ["Etruscans"],
    message: "Rome unifies the Italian peninsula once the Etruscans fall" },
  
  { year: -264, type: "war", a: "Rome", b: "Carthage", region: { lat: [36, 42], lon: [8, 16] }, reinforce: 8, message: "First Punic War - Rome and Carthage clash over Sicily" },
  { year: -241, type: "claim", civ: "Rome", region: { lat: [36.5, 41.5], lon: [8, 16] },
    requireDeadCivs: ["Carthage"],
    message: "Rome wins the Punic Wars and takes the western Mediterranean" },
  
  { year: -218, type: "war", a: "Rome", b: "Carthage", region: { lat: [35, 44], lon: [-9, 9] }, reinforce: 10, message: "Second Punic War - Hannibal crosses the Alps" },
  { year: -202, type: "claim", civ: "Rome", region: { lat: [35, 44], lon: [-9, 9] },
    requireDeadCivs: ["Carthage", "Iberians"],
    message: "Rome takes Hispania once the western tribes fall" },
  
  { year: -149, type: "war", a: "Rome", b: "Carthage", region: { lat: [30, 38], lon: [-9, 16] }, reinforce: 8, message: "Third Punic War - the final destruction of Carthage" },
  { year: -148, type: "war", a: "Rome", b: "Antigonid Macedon", region: { lat: [36, 42], lon: [19, 27] }, reinforce: 6, message: "Fourth Macedonian War - Rome marches on Greece" },
  { year: -146, type: "claim", civ: "Rome", region: { lat: [30, 42], lon: [-9, 25] },
    requireDeadCivs: ["Carthage", "Antigonid Macedon"],
    message: "Carthage destroyed and Greece annexed - Rome dominates the Mediterranean" },
  
  { year: -88, type: "war", a: "Rome", b: "Pontus", region: { lat: [36, 44], lon: [25, 38] }, reinforce: 8, message: "Mithridatic Wars - Rome battles Pontus for Asia Minor" },
  { year: -100, type: "claim", civ: "Rome", region: { lat: [36, 42], lon: [25, 35] },
    requireDeadCivs: ["Pontus", "Seleucid Empire"],
    message: "Rome takes Asia Minor and Cilicia after defeating its eastern rivals" },
  
  { year: -58, type: "war", a: "Rome", b: "Gauls", region: { lat: [42, 51], lon: [-5, 8] }, reinforce: 10, message: "Gallic Wars - Caesar invades Gaul" },
  { year:  -50, type: "claim", civ: "Rome", region: { lat: [42, 51], lon: [-5, 8] },
    requireDeadCivs: ["Gauls"],
    message: "Caesar conquers Gaul" },
  
  { year:  -31, type: "war", a: "Rome", b: "Ptolemaic Egypt", region: { lat: [22, 32], lon: [25, 36] }, reinforce: 8, message: "Final War of the Roman Republic - Octavian invades Egypt" },
  { year:  -27, type: "claim", civ: "Rome", region: { lat: [22, 32], lon: [25, 36] },
    requireDeadCivs: ["Ptolemaic Egypt"],
    message: "Augustus annexes Egypt; the Empire begins" },
  { year:   45, type: "claim", civ: "Rome", region: { lat: [31, 36], lon: [33, 40] }, message: "Rome annexes Judea and Mauretania" },
  
  { year:   43, type: "war", a: "Rome", b: "Celts", region: { lat: [50, 55], lon: [-6, 2] }, reinforce: 8, message: "Roman invasion of Britain begins" },
  { year:   80, type: "claim", civ: "Rome", region: { lat: [50, 55], lon: [-6, 2] },
    requireDeadCivs: ["Celts"],
    message: "Roman Britannia established" },

  

  

  { year:  117, type: "claim", civ: "Rome",
    byOwner: [
      "POR","SPR","FRA","BEL","LUX","HOL","SWI",
      "ITA",
      "GRE","ALB","BUL","YUG","ROM","HUN","AUS",
      "TUR","SYR","PAL","JOR","IRQ",
      "EGY","LIB","TUN","ALG","MOR"
    ],
    region: { lat: [22, 51], lon: [-10, 48] },
    message: "Trajan reaches the empire's greatest extent" },
  { year:  330, civ: { name: "Byzantium", lat: 41, lon: 28.9, color: "#a050c4" }, message: "Constantine founds Constantinople - the New Rome" },
  
  { year:  330, type: "reinforce", civ: "Byzantium", count: 6, message: "Imperial garrison stationed at Constantinople" },

  
  
  { year:  395, type: "rename", from: "Rome", to: "Western Rome", color: "#7d1818", spawnIfMissing: { lat: 41.9, lon: 12.5 }, message: "Theodosius dies - the empire is permanently split between Western Rome and Byzantium" },

  

  

  { year:  395, type: "secede", target: "Western Rome", civ: "Byzantium",
    spawn: { name: "Byzantium", lat: 41, lon: 28.9, color: "#a050c4" },
    byOwner: ["GRE", "TUR", "EGY", "SYR", "IRQ", "ISR", "PAL", "JOR", "BUL", "ROM", "ALB", "YUG"],
    message: "Eastern Rome (Byzantium) takes the eastern provinces - Greece, Anatolia, Levant, Egypt" },
  
  { year:  476, type: "secede", target: "Western Rome", civ: "Visigoths",    spawn: { name: "Visigoths",    lat: 41, lon: -3,  color: "#a08820" }, region: { lat: [36, 45], lon: [-9, 5] },  message: "Visigothic Kingdom rises from the ruins of Rome (Iberia & S. Gaul)" },
  { year:  476, type: "secede", target: "Western Rome", civ: "Vandals",      spawn: { name: "Vandals",      lat: 36, lon: 10, color: "#7a3a3a" }, region: { lat: [27, 38], lon: [-1, 12] }, message: "Vandals carve out North Africa" },
  { year:  476, type: "secede", target: "Western Rome", civ: "Anglo-Saxons", spawn: { name: "Anglo-Saxons", lat: 52, lon: -1, color: "#a06030" }, region: { lat: [50, 56], lon: [-6, 2] },  message: "Anglo-Saxon kingdoms rise in Britain" },
  
  { year:  411, type: "secede", target: "Western Rome", civ: "Suebi",
    spawn: { name: "Suebi", lat: 41.7, lon: -8.6, color: "#7a8a40" },
    region: { lat: [40, 44], lon: [-9, -6] },
    message: "Kingdom of the Suebi founded in Galicia and northern Portugal" },
  
  { year:  411, type: "secede", target: "Western Rome", civ: "Burgundians",
    spawn: { name: "Burgundians", lat: 47.32, lon: 5.04, color: "#a04040" },
    region: { lat: [45, 49], lon: [4, 8] },
    message: "Burgundian Kingdom established in the Rhône valley" },
  
  { year:  585, type: "absorb", absorber: "Visigoths", target: "Suebi", message: "Leovigild conquers Galicia - the Kingdom of the Suebi falls to the Visigoths" },
  
  { year:  534, type: "absorb", absorber: "Franks", target: "Burgundians", message: "Frankish kings absorb the Burgundian Kingdom" },
  { year:  476, type: "rename", from: "Western Rome", to: "Romano-Goths", color: "#8a7a5a", message: "Odoacer deposes the last Western emperor; Italy under Ostrogoths" },
  
  { year:  481, type: "secede", target: "Romano-Goths", civ: "Franks", spawn: { name: "Franks", lat: 49, lon: 3, color: "#4a6ae8" }, region: { lat: [44, 51], lon: [-5, 8] }, message: "Clovis I founds the Frankish Kingdom" },

  
  
  { year:  482, type: "absorb", absorber: "Franks", target: "Germans", message: "Western Germanic tribes accept Frankish hegemony - the Germans civilization merges into Clovis's kingdom" },

  

  

  
  
  { year:  554, type: "secede", target: "Romano-Goths", civ: "Exarchate of Ravenna",
    spawn: { name: "Exarchate of Ravenna", lat: 44.42, lon: 12.20, color: "#a050c4" },
    region: { lat: [42, 47], lon: [9, 14] },
    message: "Justinian's reconquest - the Exarchate of Ravenna emerges in central/northern Italy" },
  { year:  554, type: "secede", target: "Romano-Goths", civ: "Duchy of Naples",
    spawn: { name: "Duchy of Naples", lat: 40.85, lon: 14.27, color: "#7a4a30" },
    region: { lat: [38, 42], lon: [13, 17] },
    message: "Duchy of Naples splinters off in southern Italy" },
  { year:  554, type: "secede", target: "Romano-Goths", civ: "Byzantine Sicily",
    spawn: { name: "Byzantine Sicily", lat: 37.50, lon: 14.05, color: "#9a3a8a" },
    region: { lat: [36, 39], lon: [12, 16] },
    message: "Sicily becomes a separate Byzantine theme after the Gothic War" },
  { year:  554, type: "secede", target: "Romano-Goths", civ: "Byzantine Sardinia",
    spawn: { name: "Byzantine Sardinia", lat: 39.30, lon: 9.13, color: "#5a4a8a" },
    region: { lat: [38, 41], lon: [8, 10] },
    message: "Sardinia held as a separate Byzantine outpost" },
  
  { year:  555, type: "kill_civ", civ: "Romano-Goths", message: "The Ostrogothic Kingdom is no more - any unclaimed lands fall to ruin" },

  { year:  568, type: "secede", target: "Exarchate of Ravenna", civ: "Lombards", spawn: { name: "Lombards", lat: 45.5, lon: 9.2, color: "#7a5a8a" }, region: { lat: [43, 47], lon: [7, 12] }, message: "Lombards invade Italy and carve out a kingdom in the Po Valley" },
  
  { year:  571, type: "secede", target: "Lombards", civ: "Duchy of Benevento",
    spawn: { name: "Duchy of Benevento", lat: 41.13, lon: 14.78, color: "#6a4a7a" },
    region: { lat: [40, 42], lon: [13, 16] },
    message: "Lombard Duchy of Benevento splinters off in southern Italy" },
  
  { year:  697, type: "secede", target: "Byzantium", civ: "Venice",
    spawn: { name: "Venice", lat: 45.44, lon: 12.32, color: "#a8302a" },
    region: { lat: [45, 46], lon: [12, 13] },
    message: "Republic of Venice elects its first doge - independent of Byzantium in all but name" },
  
  { year:  754, type: "secede", target: "Byzantium", civ: "Papal States",
    spawn: { name: "Papal States", lat: 41.90, lon: 12.50, color: "#f0e6cc" },
    region: { lat: [41, 44], lon: [10, 14] },
    message: "Donation of Pepin - the Papal States emerge in central Italy" },
  
  { year:  711, type: "absorb", absorber: "Arabs", target: "Visigoths", message: "Umayyad Caliphate conquers Iberia - Visigoths fall" },
  
  { year:  774, type: "absorb", absorber: "Franks", target: "Lombards", message: "Charlemagne defeats the Lombards - their kingdom is absorbed into the Franks" },
  
  { year: 1066, type: "rename", from: "Anglo-Saxons",     to: "Kingdom of England", color: "#cc1f2a", spawnIfMissing: { lat: 52, lon: -1 }, message: "Norman Conquest - Kingdom of England forms" },
  { year: 1707, type: "rename", from: "Kingdom of England", to: "Great Britain",   color: "#a01818", spawnIfMissing: { lat: 52, lon: -1 }, message: "Acts of Union: England + Scotland → Great Britain" },
  { year: 1801, type: "rename", from: "Great Britain",     to: "United Kingdom",   color: "#921818", spawnIfMissing: { lat: 52, lon: -1 }, message: "United Kingdom of Great Britain and Ireland forms" },

  

  { year: 1054, type: "alliance", a: "Byzantium", b: "Holy Roman Empire", message: "Great Schism - the Eastern Orthodox Church formally separates from Rome" },

  { year: 1071, type: "secede", target: "Byzantium", civ: "Sultanate of Rum",
    spawn: { name: "Sultanate of Rum", lat: 39.93, lon: 32.86, color: "#5a7a40" },
    region: { lat: [37, 41], lon: [28, 42] },
    message: "Battle of Manzikert - Seljuk Turks shatter the Byzantine army; Anatolia lost" },

  { year: 1204, type: "secede", target: "Byzantium", civ: "Latin Empire",
    spawn: { name: "Latin Empire", lat: 41.01, lon: 28.98, color: "#d4a050" },
    region: { lat: [40, 42], lon: [26, 30] },
    message: "Fourth Crusade sacks Constantinople - the Latin Empire is established on the Bosporus" },
  { year: 1204, type: "secede", target: "Byzantium", civ: "Empire of Nicaea",
    spawn: { name: "Empire of Nicaea", lat: 40.43, lon: 29.72, color: "#7a4040" },
    region: { lat: [38, 41.5], lon: [27, 32] },
    message: "Empire of Nicaea formed - Greek Byzantine successor in Anatolia" },
  { year: 1204, type: "secede", target: "Byzantium", civ: "Empire of Trebizond",
    spawn: { name: "Empire of Trebizond", lat: 41.00, lon: 39.72, color: "#4a3a8a" },
    region: { lat: [40, 42], lon: [37, 42] },
    message: "Empire of Trebizond founded on the Black Sea coast" },
  { year: 1204, type: "secede", target: "Byzantium", civ: "Despotate of Epirus",
    spawn: { name: "Despotate of Epirus", lat: 39.66, lon: 20.85, color: "#8a4a4a" },
    region: { lat: [38, 41], lon: [19, 22] },
    message: "Despotate of Epirus founded - Greek successor in western Greece and Albania" },

  

  
  
  { year: 1204, type: "kill_civ", civ: "Byzantium",
    message: "The pre-Crusade Byzantine state is finished - Constantinople is in Latin hands and the surviving Greeks rally to Nicaea" },
  
  { year: 1261, type: "absorb", absorber: "Empire of Nicaea", target: "Latin Empire", message: "Michael VIII Palaiologos retakes Constantinople - the Latin Empire collapses" },
  { year: 1261, type: "rename", from: "Empire of Nicaea", to: "Byzantium", color: "#a050c4", spawnIfMissing: { lat: 41, lon: 28.9 }, message: "Restored Byzantine Empire - Palaiologan dynasty returns to Constantinople" },

  
  { year: 1479, type: "absorb", absorber: "Ottomans", target: "Despotate of Epirus", message: "Ottomans annex the Despotate of Epirus" },
  
  { year: 1461, type: "absorb", absorber: "Ottomans", target: "Empire of Trebizond", message: "Mehmed II takes Trebizond - the last Byzantine successor state falls" },
  
  { year: 1453, type: "absorb", absorber: "Ottomans", target: "Byzantium", message: "Constantinople falls - Byzantium is wiped from the map by the Ottomans" },

  { year: -722, type: "claim", civ: "Assyria", region: { lat: [30, 38], lon: [33, 39] }, message: "Assyria conquers Israel and the northern Levant" },
  { year: -612, type: "absorb", absorber: "Babylon", target: "Assyria", message: "Babylonians sack Nineveh - Assyria falls; Neo-Babylonian Empire rises" },

  { year: -700, civ: { name: "Lydia",       lat: 38,  lon: 28,   color: "#e8c020" }, message: "The Lydians forge the first coins" },
  { year: -550, civ: { name: "Persia",      lat: 32,  lon: 53,   color: "#ff7d4a" }, replaces: "Medes", message: "Cyrus the Great founds the Achaemenid Empire" },
  { year: -539, type: "absorb", absorber: "Persia", target: "Babylon", message: "Cyrus takes Babylon - Persia inherits Mesopotamia" },
  { year: -550, type: "goal", civ: "Persia", region: { lat: [22, 42], lon: [25, 70] }, priority: 0.9, message: "Persia sets its sights on Egypt and the Levant" },
  { year: -400, civ: { name: "Carthage",    lat: 36.8,lon: 10.3, color: "#5a8aff" }, replaces: "Phoenicia", message: "Carthage rises as the heir of Phoenicia" },
  { year: -336, civ: { name: "Macedon",     lat: 40.6,lon: 22.9, color: "#5d4ae8" }, message: "Alexander of Macedon ascends" },
  { year: -336, type: "goal", civ: "Macedon", region: { lat: [20, 43], lon: [22, 75] }, priority: 1.0, message: "Alexander dreams of an empire from Greece to India" },
  
  { year: -323, type: "secede", target: "Macedon", civ: "Ptolemaic Egypt", spawn: { name: "Ptolemaic Egypt",   lat: 30, lon: 31,  color: "#e8d040" }, region: { lat: [22, 33], lon: [25, 36] }, message: "Diadochi: Ptolemy takes Egypt" },
  { year: -323, type: "secede", target: "Macedon", civ: "Seleucid Empire", spawn: { name: "Seleucid Empire",   lat: 35, lon: 45,  color: "#5d8ad8" }, region: { lat: [27, 42], lon: [33, 75] }, message: "Diadochi: Seleucus takes Mesopotamia, Persia, the East" },
  { year: -323, type: "secede", target: "Macedon", civ: "Antigonid Macedon", spawn: { name: "Antigonid Macedon", lat: 40.6, lon: 22.9, color: "#5d4ae8" }, region: { lat: [36, 43], lon: [19, 28] }, message: "Diadochi: Antigonus retains Greece + Macedonia" },
  { year: -250, civ: { name: "Maurya",      lat: 25,  lon: 81,   color: "#ff4a8a" }, replaces: "Vedic India", message: "Ashoka unifies India under the Maurya" },
  
  { year: -247, type: "secede", target: "Seleucid Empire", civ: "Parthia", spawn: { name: "Parthia", lat: 36, lon: 55, color: "#a02828" }, region: { lat: [30, 42], lon: [50, 65] }, message: "Arsaces founds the Parthian kingdom - eats away at Seleucid Persia" },
  { year: -200, civ: { name: "Han China",   lat: 34,  lon: 109,  color: "#e84a4a" }, replaces: "Zhou China", message: "The Han dynasty rises in China" },
  { year: -200, type: "goal", civ: "Han China", region: { lat: [22, 45], lon: [98, 122] }, priority: 0.85, message: "Han China sets its sights on westward expansion (Silk Road)" },

  { year: -400, civ: { name: "Maya",        lat: 17,  lon: -89,  color: "#3aa9c4" }, replaces: "Olmec", message: "Olmec civilization fades - the Maya rise as their successors in the lowlands" },
  
  { year:  220, type: "secede", target: "Han China", civ: "Cao Wei",      spawn: { name: "Cao Wei",      lat: 35, lon: 110, color: "#c83030" }, region: { lat: [32, 42], lon: [100, 122] }, message: "Three Kingdoms: Cao Wei takes the north" },
  { year:  220, type: "secede", target: "Han China", civ: "Eastern Wu",   spawn: { name: "Eastern Wu",   lat: 30, lon: 118, color: "#3a6ad8" }, region: { lat: [24, 33], lon: [110, 122] }, message: "Three Kingdoms: Sun Quan takes the southeast" },
  { year:  220, type: "rename", from: "Han China", to: "Shu Han", color: "#3aa07a", message: "Three Kingdoms: Liu Bei retains the southwest as Shu Han" },
  { year:  220, civ: { name: "Sasanians",   lat: 32,  lon: 53,   color: "#ff7d4a" }, replaces: "Persia", message: "The Sasanians revive Persia" },
  { year:  400, civ: { name: "Goths",       lat: 50,  lon: 25,   color: "#8a8a8a" }, message: "The Gothic peoples migrate westward" },

  { year: -339, type: "war", a: "Macedon", b: "Scythians", region: { lat: [42, 50], lon: [22, 36] }, reinforce: 8, message: "Philip II of Macedon defeats King Ateas - Scythian power in the Balkans broken" },
  
  { year: -250, civ: { name: "Sarmatians", lat: 48, lon: 45, color: "#9a8a40" }, message: "Sarmatians sweep across the Pontic steppe" },
  { year: -250, type: "goal", civ: "Sarmatians", region: { lat: [44, 55], lon: [30, 60] }, priority: 1.0, message: "Sarmatian dominance over the steppe begins" },
  { year: -250, type: "war", a: "Sarmatians", b: "Scythians", region: { lat: [45, 55], lon: [30, 55] }, reinforce: 12, message: "Sarmatians displace the Scythians from the Pontic steppe - they retreat to Crimea" },
  
  { year: -100, civ: { name: "Pontus", lat: 41, lon: 36, color: "#5a3a8a" }, message: "Mithridates VI rises - the Kingdom of Pontus expands across Anatolia and the Black Sea" },
  { year: -100, type: "war", a: "Pontus", b: "Scythians", region: { lat: [44, 47], lon: [32, 36] }, reinforce: 8, message: "Mithridates VI defeats the Crimean Scythians - their resurgence is over" },
  
  { year:  250, type: "war", a: "Goths", b: "Scythians", region: { lat: [44, 50], lon: [28, 50] }, reinforce: 8, message: "Gothic invasions overwhelm the last independent Scythian groups" },
  
  { year:  370, civ: { name: "Huns", lat: 47, lon: 50, color: "#3a3a3a" }, message: "The Huns sweep into Europe from the eastern steppe" },
  { year:  370, type: "absorb", absorber: "Huns", target: "Scythians", message: "Hunnic invasion ends the Scythians - their last remnants are absorbed into the steppe peoples" },
  
  { year:  453, type: "absorb", absorber: "Goths", target: "Huns", message: "Battle of Nedao - Attila's heirs fall to a Gothic-led coalition; the Hunnic Empire dissolves" },
  { year:  570, civ: { name: "Arabs",       lat: 24,  lon: 39,   color: "#1a8a4a" }, message: "Arabia stirs - the age of the caliphates approaches" },
  { year:  632, type: "goal", civ: "Arabs", region: { lat: [12, 40], lon: [-10, 65] }, priority: 0.95, message: "The Rashidun caliphates begin spreading Islam westward and east" },
  { year:  800, type: "rename", from: "Franks", to: "Carolingian Empire", color: "#5a7af0", message: "Charlemagne crowned Emperor - the Carolingian Empire" },
  { year:  900, civ: { name: "Vikings",     lat: 60,  lon: 10,   color: "#5dc4e8" }, message: "Norse longships strike the coasts" },

  { year:  870, civ: { name: "Bohemia",      lat: 50, lon: 15, color: "#ff8a40" }, message: "The Přemyslid dynasty unites Bohemia" },
  { year:  966, civ: { name: "Duchy of Poland", lat: 52, lon: 18, color: "#dc143c" }, replaces: "Polans", message: "Mieszko I baptized - the Duchy of Poland is founded" },
  { year: 1025, civ: { name: "Kingdom of Poland", color: "#b00020" }, replaces: "Duchy of Poland", message: "Bolesław the Brave is crowned the first King of Poland" },
  { year: 1207, civ: { name: "Livonian Order", lat: 57, lon: 25, color: "#e0e0e0" }, message: "Crusaders found the Livonian Order in Terra Mariana" },
  { year: 1253, civ: { name: "Grand Duchy of Lithuania", lat: 55, lon: 24, color: "#1a3a8a" }, replaces: "Balts", message: "Mindaugas crowned King of Lithuania" },

  
  
  { year: 1316, type: "goal", civ: "Grand Duchy of Lithuania", provinces: typeof HOI4_GDL_PROVINCES !== "undefined" ? HOI4_GDL_PROVINCES : [], priority: 1.0, message: "Gediminas drives Lithuania toward its peak: Ruthenia, Belarus, Black Sea coast" },

  
  
  { year: 1400, type: "claim", civ: "Grand Duchy of Lithuania", region: { lat: [54, 57], lon: [21, 28] }, message: "Vytautas consolidates the Lithuanian core" },
  { year: 1410, type: "claim", civ: "Grand Duchy of Lithuania", region: { lat: [52, 56], lon: [24, 32] }, message: "Battle of Grunwald - GDL secures Belarus and the Niemen" },
  { year: 1420, type: "claim", civ: "Grand Duchy of Lithuania", region: { lat: [50, 54], lon: [25, 32] }, message: "GDL extends into Volhynia and western Ruthenia" },
  { year: 1430, type: "claim", civ: "Grand Duchy of Lithuania", region: { lat: [47, 52], lon: [27, 36] }, message: "GDL pushes south toward the Black Sea steppe" },
  { year: 1434, type: "claim", civ: "Grand Duchy of Lithuania", provinces: typeof HOI4_GDL_PROVINCES !== "undefined" ? HOI4_GDL_PROVINCES : [], message: "Vytautas's peak: GDL spans from the Baltic to the Black Sea" },
  { year: 1385, type: "alliance", a: "Kingdom of Poland", b: "Grand Duchy of Lithuania", message: "The Union of Krewo binds Poland and Lithuania in alliance" },
  { year: 1561, type: "rename", from: "Livonian Order", to: "Duchy of Courland", color: "#c8c8a0", message: "The Livonian Order dissolved; Courland emerges" },
  { year: 1569, type: "merge", from: ["Kingdom of Poland", "Grand Duchy of Lithuania"], to: { name: "Polish-Lithuanian Commonwealth", color: "#dc143c" }, message: "The Union of Lublin forms the Polish-Lithuanian Commonwealth" },

  { year: 1772, type: "goal", civ: "Russian Empire", region: { lat: [49, 56], lon: [14, 27] }, priority: 1.0, message: "Russia begins the partition of Poland-Lithuania" },
  { year: 1795, type: "absorb", absorber: "Russian Empire", target: "Polish-Lithuanian Commonwealth", message: "The Polish-Lithuanian Commonwealth is dissolved by partition; absorbed by Russia" },

  { year: 1830, type: "claim", civ: "Kingdom of France", region: { lat: [29, 37], lon: [-9, 12] }, message: "France invades Algiers - the French Algerian colony begins" },
  { year: 1869, type: "claim", civ: "United Kingdom",   region: { lat: [22, 32], lon: [25, 36] }, message: "Suez Canal opens - Britain tightens its grip on Egypt" },
  { year: 1881, type: "claim", civ: "France",            region: { lat: [30, 37], lon: [7, 12] }, message: "France establishes the Tunisian protectorate" },
  { year: 1882, type: "claim", civ: "United Kingdom",   region: { lat: [22, 32], lon: [25, 36] }, message: "Britain occupies Egypt" },
  { year: 1884, type: "claim", civ: "Germany",           region: { lat: [-5, 5], lon: [9, 14] }, message: "Berlin Conference - Germany claims Kamerun and SW Africa" },
  { year: 1885, type: "claim", civ: "Belgium",           region: { lat: [-13, 6], lon: [12, 30] }, message: "Berlin Conference: Leopold II claims the Congo as personal property" },
  { year: 1885, type: "claim", civ: "United Kingdom",   region: { lat: [-30, -15], lon: [15, 33] }, message: "Britain claims Bechuanaland and Rhodesian frontier" },
  { year: 1890, type: "claim", civ: "Italy",             region: { lat: [10, 18], lon: [38, 52] }, message: "Italy carves out Eritrea and Italian Somaliland" },
  { year: 1898, type: "claim", civ: "United Kingdom",   region: { lat: [-1, 22], lon: [21, 36] }, message: "Britain finishes the Cape-to-Cairo line - Sudan and East Africa" },

  
  { year: 1900, type: "colonize", message: "The age of empires complete: every land tile now belongs to a great power" },

  
  { year: 1914, type: "wartime", on: true, message: "World War I begins - the great powers mobilize" },

  

  { year: 1918, type: "secede", target: "Russian Empire", civ: "Republic of Poland",
    spawn: { name: "Republic of Poland", lat: 52, lon: 19, color: "#dc143c" },
    byOwner: "POL",
    message: "Poland reborn after WWI - reclaims its 1918–39 ethnic territory" },
  { year: 1918, type: "secede", target: "Russian Empire", civ: "Republic of Lithuania",
    spawn: { name: "Republic of Lithuania", lat: 54.69, lon: 25.28, color: "#1a8a4a" },
    byOwner: "LIT", byStateName: ["Ermland-Masuren"],
    message: "Lithuania declares independence - capital at Vilnius, reclaims Žemaitija, Aukštaitija, Memel, Kaunas" },
  { year: 1918, type: "secede", target: "Russian Empire", civ: "Republic of Latvia",
    spawn: { name: "Republic of Latvia", lat: 56.95, lon: 24.1, color: "#9e2a2a" },
    byOwner: "LAT",
    message: "Latvia proclaims independence - the Republic of Latvia is born in Riga" },
  { year: 1918, type: "secede", target: "Russian Empire", civ: "Republic of Estonia",
    spawn: { name: "Republic of Estonia", lat: 59.4, lon: 24.75, color: "#2c6db0" },
    byOwner: "EST",
    message: "Estonia declares independence - the Republic of Estonia rises in Tallinn" },

  { year: 1922, type: "wartime", on: false, message: "Polish-Soviet War ends - interwar peace" },
  
  { year: 1927, type: "secede", target: "Republic of China", civ: "Chinese Communists", spawn: { name: "Chinese Communists", lat: 36, lon: 109, color: "#e02020" }, region: { lat: [33, 40], lon: [105, 115] }, message: "Chinese Civil War begins - Mao's Communists break with the KMT" },

  
  { year: 1936, type: "secede", target: "Kingdom of Spain", civ: "Spanish Nationalists", spawn: { name: "Spanish Nationalists", lat: 41, lon: -2, color: "#181818" }, region: { lat: [37, 43], lon: [-9, 0] }, message: "Spanish Civil War: Franco's Nationalists rise" },
  { year: 1936, type: "wartime", on: true, message: "Spanish Civil War - wartime active in Iberia" },
  { year: 1939, type: "absorb", absorber: "Spanish Nationalists", target: "Kingdom of Spain", message: "Franco wins - Spain unified under the Nationalists" },
  { year: 1939, type: "rename", from: "Spanish Nationalists", to: "Francoist Spain", color: "#604030", message: "General Franco assumes dictatorship of Spain" },

  { year: 1933, type: "rename", from: "Germany", to: "Nazi Germany", color: "#222222", message: "Hitler becomes Chancellor - Germany turns Nazi" },
  { year: 1936, type: "rename", from: "Italy", to: "Fascist Italy", color: "#1a4a1a", message: "Mussolini consolidates power - Italy under fascism" },

  
  
  { year: 1938, type: "goal", civ: "Nazi Germany", region: { lat: [46, 49], lon: [9, 17] }, priority: 1.0, message: "Anschluss: Germany annexes Austria" },
  
  { year: 1939, type: "alliance", a: "Nazi Germany", b: "Soviet Union", message: "Molotov-Ribbentrop Pact: Germany and the Soviet Union sign a non-aggression pact" },
  { year: 1939, type: "wartime", on: true, message: "World War II begins" },
  
  { year: 1939, type: "secede", target: "Republic of Poland", civ: "Nazi Germany",
    region: { lat: [49, 55], lon: [14, 21] },
    message: "Germany invades Poland (Sept 1, 1939) - Wehrmacht overruns the west" },
  
  { year: 1939, type: "secede", target: "Republic of Poland", civ: "Soviet Union",
    region: { lat: [49, 55], lon: [21, 25] },
    message: "Soviet invasion of Poland (Sept 17) - eastern Poland falls" },

  { year: 1940, type: "absorb", absorber: "Soviet Union", target: "Republic of Lithuania", message: "Soviet occupation of Lithuania - annexed by the USSR" },
  { year: 1940, type: "absorb", absorber: "Soviet Union", target: "Republic of Latvia",    message: "Soviet occupation of Latvia - annexed by the USSR" },
  { year: 1940, type: "absorb", absorber: "Soviet Union", target: "Republic of Estonia",   message: "Soviet occupation of Estonia - annexed by the USSR" },
  
  { year: 1940, type: "secede", target: "France", civ: "Nazi Germany", byOwner: "FRA",
    message: "The Battle of France: Germany overruns Paris and the metropolitan French territory" },
  
  { year: 1941, type: "barbarossa", a: "Nazi Germany", b: "Soviet Union", message: "Operation Barbarossa: Germany invades the Soviet Union" },
  
  { year: 1941, type: "barbarossa", a: "Yamato", b: "USA", message: "Pearl Harbor: Japan attacks the United States" },

  

  
  { year: 1944, type: "secede", target: "Nazi Germany", civ: "France",
    spawn: { name: "France", lat: 48.86, lon: 2.35, color: "#1a4ba8" }, byOwner: "FRA",
    message: "Liberation of France - Allied armies free Paris" },
  { year: 1944, type: "secede", target: "Nazi Germany", civ: "Belgium",
    spawn: { name: "Belgium", lat: 50.85, lon: 4.35, color: "#ffd24a" }, byOwner: "BEL",
    message: "Belgium liberated from German occupation" },
  { year: 1944, type: "secede", target: "Nazi Germany", civ: "Netherlands",
    spawn: { name: "Netherlands", lat: 52.37, lon: 4.90, color: "#ff8c00" }, byOwner: "HOL",
    message: "Netherlands liberated from German occupation" },
  { year: 1945, type: "secede", target: "Nazi Germany", civ: "Denmark",
    spawn: { name: "Denmark", lat: 55.68, lon: 12.57, color: "#c20020" }, byOwner: "DEN",
    message: "Denmark liberated from German occupation" },
  { year: 1945, type: "secede", target: "Nazi Germany", civ: "Norway",
    spawn: { name: "Norway", lat: 59.91, lon: 10.75, color: "#a01818" }, byOwner: "NOR",
    message: "Norway liberated from German occupation" },

  
  { year: 1945, type: "absorb", absorber: "Soviet Union", target: "Nazi Germany", message: "Berlin falls - Nazi Germany is dismantled, Soviets take what remains" },

  

  
  
  { year: 1949, type: "secede", target: "Soviet Union", civ: "West Germany",
    spawn: { name: "West Germany", lat: 50.11, lon: 8.68, color: "#202020" },
    byOwner: "GER",
    region: { lat: [47, 55.5], lon: [5, 16] },
    message: "West Germany (Bundesrepublik Deutschland) is founded in the Allied zones" },

  
  
  { year: 1949, type: "secede", target: "West Germany", civ: "East Germany",
    spawn: { name: "East Germany", lat: 52.52, lon: 13.40, color: "#a02828" },
    region: { lat: [50.5, 54.7], lon: [10.5, 15] },
    message: "East Germany (DDR) declared - the Soviet zone becomes a separate state" },
  
  { year: 1989, type: "wartime", on: false, message: "Berlin Wall falls - the Cold War winds down" },
  { year: 1990, type: "absorb", absorber: "West Germany", target: "East Germany", message: "German reunification - East Germany rejoins the West" },
  { year: 1990, type: "rename", from: "West Germany", to: "Germany", color: "#202020", spawnIfMissing: { lat: 52.52, lon: 13.40 }, message: "Reunified Germany formed - the Federal Republic spans east and west" },
  
  { year: 1945, type: "absorb", absorber: "USA", target: "Yamato", message: "Hiroshima/Nagasaki - Japan surrenders to the United States" },
  { year: 1945, type: "wartime", on: false, message: "WWII ends" },

  { year: 1947, type: "secede", target: "United Kingdom", civ: "India", spawn: { name: "India", lat: 22, lon: 78, color: "#ff8a3a" }, byOwner: "RAJ", message: "Partition of British India - India and Pakistan independent" },
  { year: 1948, civ: { name: "Israel", lat: 31.8, lon: 35.0, color: "#3a6ad8" }, message: "State of Israel proclaimed" },
  
  { year: 1957, type: "secede", target: "United Kingdom", civ: "Ghana",          spawn: { name: "Ghana",          lat:  7.9, lon:  -1.0, color: "#e8b020" }, byOwner: "GHA", message: "Ghana - first sub-Saharan African colony to gain independence" },
  { year: 1956, type: "secede", target: "Egypt",          civ: "Modern Egypt",   spawn: { name: "Modern Egypt",   lat: 30.0, lon:  31.2, color: "#a07020" }, byOwner: "EGY", message: "Suez Crisis - Nasser nationalizes the Suez Canal; modern Egypt asserts sovereignty" },
  { year: 1960, type: "secede", target: "France",         civ: "Algeria",        spawn: { name: "Algeria",        lat: 36.7, lon:   3.1, color: "#1a8a4a" }, byOwner: "ALG", message: "Algeria gains independence after a brutal eight-year war" },
  { year: 1960, type: "secede", target: "United Kingdom", civ: "Nigeria",        spawn: { name: "Nigeria",        lat:  9.1, lon:   7.5, color: "#1a8a3a" }, byOwner: "NIG", message: "Nigeria gains independence from Britain" },
  { year: 1962, type: "secede", target: "France",         civ: "Vietnam",        spawn: { name: "Vietnam",        lat: 21.0, lon: 105.8, color: "#e02020" }, byOwner: "VIN", message: "Vietnam asserts unity after the French Indochina collapse" },
  { year: 1964, type: "secede", target: "United Kingdom", civ: "Kenya",          spawn: { name: "Kenya",          lat: -1.3, lon:  36.8, color: "#a02020" }, byOwner: "KEN", message: "Kenya gains independence from Britain" },
  
  { year: 1951, type: "secede", target: "Italy",          civ: "Libya",          spawn: { name: "Libya",          lat: 32.9, lon:  13.2, color: "#1a4a3a" }, byOwner: "LIB", message: "Libya gains independence from Italian rule" },
  { year: 1956, type: "secede", target: "France",         civ: "Morocco",        spawn: { name: "Morocco",        lat: 33.97, lon: -6.85, color: "#a01818" }, byOwner: "MOR", message: "Morocco gains independence from France" },
  { year: 1956, type: "secede", target: "France",         civ: "Tunisia",        spawn: { name: "Tunisia",        lat: 36.81, lon: 10.18, color: "#c81818" }, byOwner: "TUN", message: "Tunisia gains independence from France" },
  { year: 1956, type: "secede", target: "United Kingdom", civ: "Sudan",          spawn: { name: "Sudan",          lat: 15.5,  lon: 32.56, color: "#3a8a4a" }, byOwner: "SUD", message: "Sudan gains independence from the British" },
  { year: 1958, type: "secede", target: "France",         civ: "Guinea",         spawn: { name: "Guinea",         lat:  9.64, lon: -13.58, color: "#c81818" }, byOwner: "GUI", message: "Guinea gains independence from France" },
  { year: 1960, type: "secede", target: "Belgium",        civ: "Congo",          spawn: { name: "Congo",          lat: -4.32, lon: 15.32, color: "#1a8a4a" }, byOwner: "COG", message: "Congo gains independence from Belgium" },
  { year: 1960, type: "secede", target: "France",         civ: "Senegal",        spawn: { name: "Senegal",        lat: 14.69, lon: -17.45, color: "#1a4a8a" }, byOwner: "SEN", message: "Senegal gains independence from France" },
  { year: 1960, type: "secede", target: "France",         civ: "Mali",           spawn: { name: "Mali",           lat: 12.65, lon: -8.0, color: "#3a8a3a" }, byOwner: "MLI", message: "Mali gains independence from France" },
  { year: 1960, type: "secede", target: "France",         civ: "Cameroon",       spawn: { name: "Cameroon",       lat:  3.85, lon: 11.5, color: "#3a6a4a" }, byOwner: "CMR", message: "Cameroon gains independence from France" },
  { year: 1960, type: "secede", target: "France",         civ: "Madagascar",     spawn: { name: "Madagascar",     lat: -18.88, lon: 47.51, color: "#a02828" }, byOwner: "MAD", message: "Madagascar gains independence from France" },
  { year: 1960, type: "secede", target: "France",         civ: "Ivory Coast",    spawn: { name: "Ivory Coast",    lat:  5.32, lon: -4.03, color: "#e08820" }, byOwner: "IVO", message: "Côte d'Ivoire gains independence from France" },
  { year: 1961, type: "secede", target: "United Kingdom", civ: "Tanzania",       spawn: { name: "Tanzania",       lat: -6.79, lon: 39.21, color: "#1a8a4a" }, byOwner: "TAN", message: "Tanganyika (later Tanzania) becomes independent" },
  { year: 1962, type: "secede", target: "United Kingdom", civ: "Uganda",         spawn: { name: "Uganda",         lat:  0.32, lon: 32.58, color: "#202020" }, byOwner: "UGA", message: "Uganda gains independence from Britain" },
  { year: 1962, type: "secede", target: "Belgium",        civ: "Rwanda",         spawn: { name: "Rwanda",         lat: -1.94, lon: 29.87, color: "#3a6ad8" }, byOwner: "RWA", message: "Rwanda gains independence from Belgium" },
  { year: 1965, type: "secede", target: "United Kingdom", civ: "Zambia",         spawn: { name: "Zambia",         lat: -15.42, lon: 28.28, color: "#1a4a3a" }, byOwner: "ZAM", message: "Zambia gains independence from Britain" },
  { year: 1965, type: "secede", target: "United Kingdom", civ: "Rhodesia",       spawn: { name: "Rhodesia",       lat: -17.83, lon: 31.05, color: "#3a8a4a" }, byOwner: "ZIM", message: "Rhodesia (later Zimbabwe) declares independence" },
  { year: 1968, type: "secede", target: "Kingdom of Spain", civ: "Equatorial Guinea", spawn: { name: "Equatorial Guinea", lat: 3.75, lon: 8.78, color: "#1a4a4a" }, byOwner: "GNG", message: "Equatorial Guinea gains independence from Spain" },
  { year: 1975, type: "secede", target: "Kingdom of Portugal", civ: "Angola",   spawn: { name: "Angola",         lat: -8.84, lon: 13.23, color: "#a02020" }, byOwner: "ANG", message: "Angola gains independence from Portugal" },
  { year: 1975, type: "secede", target: "Kingdom of Portugal", civ: "Mozambique", spawn: { name: "Mozambique",   lat: -25.97, lon: 32.58, color: "#1a8a4a" }, byOwner: "MZB", message: "Mozambique gains independence from Portugal" },
  { year: 1980, type: "secede", target: "United Kingdom", civ: "Zimbabwe",       spawn: { name: "Zimbabwe",       lat: -17.83, lon: 31.05, color: "#1a8a4a" }, byOwner: "ZIM", message: "Zimbabwe gains majority rule and full independence" },
  { year: 1990, type: "secede", target: "South Africa",   civ: "Namibia",        spawn: { name: "Namibia",        lat: -22.56, lon: 17.08, color: "#3a6ad8" }, byOwner: "NMB", message: "Namibia gains independence from South Africa" },
  { year: 1949, type: "rename", from: "Republic of China", to: "People's Republic of China", color: "#e8201a", message: "Mao proclaims the People's Republic of China" },

  
  
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Republic of Lithuania",
    spawn: { name: "Republic of Lithuania", lat: 54.69, lon: 25.28, color: "#1a8a4a" },
    byOwner: "LIT", byStateName: ["Ermland-Masuren"],
    message: "Lithuania regains independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Republic of Latvia",
    spawn: { name: "Republic of Latvia", lat: 56.95, lon: 24.1, color: "#9e2a2a" },
    byOwner: "LAT", message: "Latvia restores independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Republic of Estonia",
    spawn: { name: "Republic of Estonia", lat: 59.4, lon: 24.75, color: "#2c6db0" },
    byOwner: "EST", message: "Estonia restores independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Republic of Poland",
    spawn: { name: "Republic of Poland", lat: 52, lon: 19, color: "#dc143c" },
    byOwner: "POL",
    message: "Polish People's Republic ends - democratic Poland reborn" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Ukraine", spawn: { name: "Ukraine", lat: 50.4, lon: 30.5, color: "#ffd24a" }, byOwner: "UKR", message: "Ukraine declares independence" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Belarus", spawn: { name: "Belarus", lat: 53.9, lon: 27.6, color: "#3a8a4a" }, byOwner: "BLR", message: "Belarus declares independence" },

  { year: 1991, type: "secede", target: "Soviet Union", civ: "Kazakhstan",
    spawn: { name: "Kazakhstan", lat: 51.17, lon: 71.45, color: "#3a7ad8" }, byOwner: "KAZ",
    message: "Kazakhstan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Uzbekistan",
    spawn: { name: "Uzbekistan", lat: 41.31, lon: 69.24, color: "#3aa840" }, byOwner: "UZB",
    message: "Uzbekistan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Turkmenistan",
    spawn: { name: "Turkmenistan", lat: 37.95, lon: 58.38, color: "#3a8a3a" }, byOwner: "TKM",
    message: "Turkmenistan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Kyrgyzstan",
    spawn: { name: "Kyrgyzstan", lat: 42.87, lon: 74.59, color: "#a02828" }, byOwner: "KGZ",
    message: "Kyrgyzstan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Tajikistan",
    spawn: { name: "Tajikistan", lat: 38.56, lon: 68.79, color: "#a04040" }, byOwner: "TJK",
    message: "Tajikistan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Armenia",
    spawn: { name: "Armenia", lat: 40.18, lon: 44.51, color: "#c83030" }, byOwner: "ARM",
    message: "Armenia declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Azerbaijan",
    spawn: { name: "Azerbaijan", lat: 40.41, lon: 49.85, color: "#3a8a8a" }, byOwner: "AZR",
    message: "Azerbaijan declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Georgia",
    spawn: { name: "Georgia", lat: 41.72, lon: 44.79, color: "#a01818" }, byOwner: "GEO",
    message: "Georgia declares independence from the Soviet Union" },
  { year: 1991, type: "secede", target: "Soviet Union", civ: "Moldova",
    spawn: { name: "Moldova", lat: 47.01, lon: 28.86, color: "#3a4a8a" }, byOwner: "MOL",
    message: "Moldova declares independence from the Soviet Union" },

  { year: 1991, type: "alliance", a: "Russia", b: "Ukraine",      message: "Russia and Ukraine sign a non-aggression pact (CIS founding)" },
  { year: 1991, type: "alliance", a: "Russia", b: "Belarus",      message: "Russia and Belarus sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Kazakhstan",   message: "Russia and Kazakhstan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Uzbekistan",   message: "Russia and Uzbekistan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Turkmenistan", message: "Russia and Turkmenistan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Kyrgyzstan",   message: "Russia and Kyrgyzstan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Tajikistan",   message: "Russia and Tajikistan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Armenia",      message: "Russia and Armenia sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Azerbaijan",   message: "Russia and Azerbaijan sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Georgia",      message: "Russia and Georgia sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Moldova",      message: "Russia and Moldova sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Republic of Lithuania", message: "Russia and Lithuania sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Republic of Latvia",    message: "Russia and Latvia sign a non-aggression pact" },
  { year: 1991, type: "alliance", a: "Russia", b: "Republic of Estonia",   message: "Russia and Estonia sign a non-aggression pact" },

  

  

  
  
  { year: 1991, type: "form_faction", name: "NATO", color: "#1a4ba8",
    members: [
      "USA", "Canada",
      "United Kingdom", "France", "Italy", "Germany",
      "Belgium", "Netherlands", "Luxembourg",
      "Denmark", "Norway",
      "Kingdom of Portugal", "Francoist Spain",
      "Greece", "Turkey",
      "Republic of Poland",
      "Republic of Lithuania", "Republic of Latvia", "Republic of Estonia",
    ],
    message: "NATO consolidates after the Soviet collapse - members sign a mutual non-aggression pact" },

  
  { year: 2002, type: "form_faction", name: "CSTO", color: "#a02828",
    members: [
      "Russia",
      "Belarus",
      "Armenia",
      "Kazakhstan",
      "Kyrgyzstan",
      "Tajikistan",
    ],
    message: "CSTO is formalized - Russia and its post-Soviet allies sign a mutual non-aggression pact" },

  

  

  
  
  { year: -490, type: "war", a: "Persia", b: "Greeks", region: { lat: [37, 41], lon: [22, 28] }, reinforce: 8, message: "Greco-Persian Wars - Persia invades Greece (Marathon, Thermopylae, Salamis)" },
  { year: -431, type: "war", a: "Greeks", b: "Macedon", region: { lat: [37, 42], lon: [21, 27] }, reinforce: 5, message: "Peloponnesian War - Greek city-states tear themselves apart (rivalry abstracted)" },
  { year: -264, type: "war", a: "Rome", b: "Carthage", region: { lat: [36, 42], lon: [8, 16] }, reinforce: 8, message: "First Punic War - Rome and Carthage clash over Sicily" },
  { year: -218, type: "war", a: "Rome", b: "Carthage", region: { lat: [35, 44], lon: [-9, 16] }, reinforce: 10, message: "Second Punic War - Hannibal crosses the Alps" },
  { year:  -58, type: "war", a: "Rome", b: "Gauls",   region: { lat: [42, 51], lon: [-5, 8] }, reinforce: 10, message: "Gallic Wars - Caesar invades Gaul" },
  { year:  101, type: "war", a: "Rome", b: "Thracians", region: { lat: [42, 48], lon: [22, 30] }, reinforce: 6, message: "Dacian Wars - Trajan invades Dacia" },
  { year:  226, type: "war", a: "Sasanians", b: "Rome", region: { lat: [30, 38], lon: [38, 50] }, reinforce: 8, message: "Roman-Sasanian Wars begin - centuries of conflict in the east" },
  { year:  632, type: "war", a: "Arabs", b: "Sasanians", region: { lat: [25, 38], lon: [38, 60] }, reinforce: 10, message: "Muslim conquest of Persia - the Sasanian Empire is shattered" },
  { year:  636, type: "war", a: "Arabs", b: "Byzantium", region: { lat: [28, 36], lon: [33, 42] }, reinforce: 10, message: "Arab-Byzantine Wars - Byzantium loses the Levant" },
  { year:  771, type: "war", a: "Franks", b: "Lombards", region: { lat: [42, 47], lon: [7, 14] }, reinforce: 8, message: "Charlemagne's Italian campaign - the Franks march on the Lombards" },
  { year:  962, type: "war", a: "Holy Roman Empire", b: "Lombards", region: { lat: [42, 47], lon: [7, 14] }, reinforce: 6, message: "Otto I's Italian campaigns - the HRE asserts itself in Italy" },

  { year: 1066, type: "war", a: "Kingdom of England", b: "Anglo-Saxons", region: { lat: [50, 56], lon: [-6, 2] }, reinforce: 6, message: "Norman Conquest of England - William invades" },
  { year: 1095, type: "war", a: "Kingdom of Jerusalem", b: "Arabs", region: { lat: [29, 38], lon: [33, 42] }, reinforce: 8, message: "First Crusade declared - Christian armies march for the Holy Land" },
  { year: 1147, type: "war", a: "Kingdom of Jerusalem", b: "Arabs", region: { lat: [29, 38], lon: [33, 42] }, reinforce: 6, message: "Second Crusade - renewed campaigns in the Levant" },
  { year: 1189, type: "war", a: "Kingdom of England", b: "Arabs", region: { lat: [29, 38], lon: [33, 42] }, reinforce: 8, message: "Third Crusade - Richard the Lionheart vs. Saladin" },
  { year: 1206, type: "war", a: "Mongols", b: "Yuan China", region: { lat: [30, 50], lon: [98, 130] }, reinforce: 12, message: "Mongol conquest of China begins" },
  { year: 1219, type: "war", a: "Mongols", b: "Persia", region: { lat: [25, 45], lon: [40, 75] }, reinforce: 14, message: "Mongol conquest of Khwarezm - Iran shattered" },
  { year: 1237, type: "war", a: "Mongols", b: "Russian Empire", region: { lat: [44, 60], lon: [30, 60] }, reinforce: 12, message: "Mongol invasion of Rus' begins (Russian Empire stand-in)" },
  { year: 1337, type: "war", a: "Kingdom of England", b: "Kingdom of France", region: { lat: [42, 51], lon: [-5, 8] }, reinforce: 10, message: "Hundred Years' War begins" },
  { year: 1396, type: "war", a: "Ottomans", b: "Holy Roman Empire", region: { lat: [40, 48], lon: [16, 30] }, reinforce: 10, message: "Battle of Nicopolis - Ottomans crush a European crusader army" },
  { year: 1453, type: "war", a: "Ottomans", b: "Byzantium", region: { lat: [38, 42], lon: [25, 32] }, reinforce: 12, message: "Fall of Constantinople - the final Byzantine war" },
  { year: 1455, type: "war", a: "Kingdom of England", b: "Kingdom of France", region: { lat: [42, 51], lon: [-5, 8] }, reinforce: 6, message: "End of the Hundred Years' War sealed; Wars of the Roses bleed England (abstracted)" },

  { year: 1521, type: "war", a: "Holy Roman Empire", b: "Kingdom of France", region: { lat: [42, 51], lon: [4, 12] }, reinforce: 8, message: "Italian Wars - Habsburg vs. Valois struggle for Italy" },
  { year: 1568, type: "war", a: "Dutch Republic", b: "Kingdom of Spain", region: { lat: [50, 54], lon: [3, 7] }, reinforce: 8, message: "Eighty Years' War - the Dutch Revolt against Spain" },
  { year: 1618, type: "war", a: "Holy Roman Empire", b: "Sweden", region: { lat: [48, 56], lon: [8, 18] }, reinforce: 10, message: "Thirty Years' War begins - Catholic vs. Protestant Europe" },
  { year: 1700, type: "war", a: "Sweden", b: "Russian Empire", region: { lat: [55, 65], lon: [22, 35] }, reinforce: 10, message: "Great Northern War - Peter the Great vs. Charles XII" },
  { year: 1701, type: "war", a: "Holy Roman Empire", b: "Kingdom of France", region: { lat: [44, 52], lon: [3, 14] }, reinforce: 10, message: "War of the Spanish Succession" },
  { year: 1740, type: "war", a: "Kingdom of Prussia", b: "Holy Roman Empire", region: { lat: [49, 53], lon: [13, 18] }, reinforce: 10, message: "War of Austrian Succession - Frederick II seizes Silesia" },
  { year: 1756, type: "war", a: "Kingdom of Prussia", b: "Holy Roman Empire", region: { lat: [49, 53], lon: [13, 18] }, reinforce: 10, message: "Seven Years' War begins - global conflict between great powers" },
  { year: 1775, type: "war", a: "USA", b: "United Kingdom", region: { lat: [25, 50], lon: [-90, -65] }, reinforce: 10, message: "American Revolutionary War" },
  { year: 1789, type: "war", a: "Kingdom of France", b: "Holy Roman Empire", region: { lat: [44, 52], lon: [3, 14] }, reinforce: 10, message: "French Revolutionary Wars begin" },

  { year: 1803, type: "war", a: "Kingdom of France", b: "United Kingdom", region: { lat: [42, 56], lon: [-10, 14] }, reinforce: 14, message: "Napoleonic Wars - all of Europe at war" },
  { year: 1812, type: "war", a: "Kingdom of France", b: "Russian Empire", region: { lat: [50, 60], lon: [25, 45] }, reinforce: 14, message: "French invasion of Russia - the disastrous march on Moscow" },
  { year: 1846, type: "war", a: "USA", b: "Mexico", region: { lat: [25, 38], lon: [-115, -95] }, reinforce: 8, message: "Mexican-American War" },
  { year: 1853, type: "war", a: "Russian Empire", b: "Ottomans", region: { lat: [40, 48], lon: [27, 42] }, reinforce: 10, message: "Crimean War - Russia clashes with the Ottomans, Britain and France" },
  { year: 1861, type: "war", a: "USA", b: "Confederate States", region: { lat: [25, 40], lon: [-95, -75] }, reinforce: 10, message: "American Civil War declared" },
  { year: 1866, type: "war", a: "Kingdom of Prussia", b: "Austria-Hungary", region: { lat: [47, 51], lon: [12, 18] }, reinforce: 10, message: "Austro-Prussian War - Prussia takes the lead in Germany" },
  { year: 1870, type: "war", a: "Kingdom of Prussia", b: "Kingdom of France", region: { lat: [47, 52], lon: [3, 8] }, reinforce: 10, message: "Franco-Prussian War" },

  

  
  { year: 1871, type: "rename", from: "Kingdom of France", to: "France", color: "#1a4ba8", spawnIfMissing: { lat: 48.86, lon: 2.35 }, message: "French Third Republic - Napoleon III deposed, the Republic returns" },
  
  { year: 1871, type: "claim", civ: "France", byOwner: "FRA", message: "France consolidates its modern metropolitan territory" },
  { year: 1894, type: "war", a: "Yamato", b: "Qing China", region: { lat: [30, 42], lon: [115, 125] }, reinforce: 8, message: "First Sino-Japanese War" },
  { year: 1898, type: "war", a: "USA", b: "Kingdom of Spain", region: { lat: [18, 24], lon: [-86, -65] }, reinforce: 6, message: "Spanish-American War" },

  { year: 1904, type: "war", a: "Yamato", b: "Russian Empire", region: { lat: [42, 50], lon: [125, 135] }, reinforce: 8, message: "Russo-Japanese War" },
  { year: 1912, type: "war", a: "Bulgaria", b: "Ottomans", region: { lat: [40, 44], lon: [22, 30] }, reinforce: 8, message: "First Balkan War" },
  { year: 1914, type: "war", a: "Germany", b: "France", region: { lat: [48, 52], lon: [2, 8] }, reinforce: 14, message: "World War I - Germany invades Belgium and France" },
  { year: 1914, type: "war", a: "Austria-Hungary", b: "Serbia", region: { lat: [43, 47], lon: [18, 22] }, reinforce: 10, message: "Austria-Hungary declares war on Serbia - WWI ignites" },
  { year: 1939, type: "war", a: "Nazi Germany", b: "Republic of Poland", region: { lat: [49, 55], lon: [14, 25] }, reinforce: 16, message: "Germany invades Poland - WWII begins" },
  { year: 1941, type: "war", a: "Nazi Germany", b: "Soviet Union", region: { lat: [44, 60], lon: [22, 50] }, reinforce: 20, message: "Operation Barbarossa - the Eastern Front opens" },
  { year: 1941, type: "war", a: "Yamato", b: "USA", region: { lat: [15, 35], lon: [130, -130] }, reinforce: 14, message: "Pacific War - Pearl Harbor and the fall of Southeast Asia" },

  { year: 1950, type: "war", a: "People's Republic of China", b: "Korea", region: { lat: [33, 43], lon: [125, 130] }, reinforce: 12, message: "Korean War" },
  { year: 1955, type: "war", a: "USA", b: "People's Republic of China", region: { lat: [8, 23], lon: [102, 110] }, reinforce: 10, message: "Vietnam War (proxy theater)" },
  { year: 1979, type: "war", a: "Soviet Union", b: "Saudi Arabia", region: { lat: [30, 38], lon: [60, 75] }, reinforce: 12, message: "Soviet-Afghan War (Saudi Arabia stand-in for the Mujahideen support network)" },

  { year: 1991, type: "war", a: "USA", b: "Kingdom of Iraq", region: { lat: [28, 36], lon: [40, 50] }, reinforce: 14, message: "Gulf War - coalition vs. Iraq" },
  { year: 2003, type: "war", a: "USA", b: "Kingdom of Iraq", region: { lat: [28, 36], lon: [40, 50] }, reinforce: 14, message: "Iraq War" },
  { year: 2022, type: "war", a: "Russia", b: "Ukraine", region: { lat: [45, 53], lon: [22, 41] }, reinforce: 16, message: "Russian invasion of Ukraine" },

  

  
  { year: 2080, type: "secede", civ: "Canada",
    spawn: { name: "Canada", lat: 45.42, lon: -75.7, color: "#c83030" },
    byOwner: "USA",
    region: { lat: [51, 72], lon: [-180, -129] },
    message: "Hay-Herbert Treaty - the United States cedes Alaska to Canada" },
  { year: 2080, type: "alliance", a: "USA", b: "Canada",
    message: "Hay-Herbert Treaty - the USA and Canada lock in permanent peace" },

  { year: 2080, civ: { name: "Lunar Republic", lat: 32.9, lon: -106.5, color: "#a89678" },
    message: "Permanent lunar colonies declare a Lunar Republic - the first off-Earth nation, with a liaison office in Las Cruces" },
  { year: 2095, type: "alliance", a: "USA", b: "Lunar Republic",
    message: "Outer Space Charter - the USA recognizes the Lunar Republic as the first sovereign off-world state" },
  { year: 2120, civ: { name: "Mars Colony Authority", lat: 28.4, lon: -80.6, color: "#c84a3a" },
    message: "First permanent Mars colony, three decades after the Moon - the Mars Colony Authority opens an Earth-side seat at Cape Canaveral" },
  { year: 2128, type: "alliance", a: "USA", b: "Mars Colony Authority",
    message: "Mars Compact - the USA and the new Mars Colony Authority sign a perpetual partnership" },
  { year: 2120, type: "war", a: "Russia", b: "Modern Egypt", region: { lat: [10, 30], lon: [25, 40] }, reinforce: 14,
    message: "Rare-earth wars erupt across the Sahara as the climate scrambles supply chains" },
  { year: 2138, type: "peace_treaty", a: "Russia", b: "Modern Egypt",
    message: "Cairo Accords end the Saharan resource war" },
  { year: 2150, type: "secede", target: "Brazil", civ: "Amazon Biodome",
    spawn: { name: "Amazon Biodome", lat: -3.1, lon: -60.0, color: "#1f5a2a" },
    region: { lat: [-10, 5], lon: [-72, -50] },
    message: "Amazon Biodome chartered as a sovereign ecological reserve" },
  { year: 2170, civ: { name: "Pacific Climate Authority", lat: 21.3, lon: -157.9, color: "#3aa9c4" },
    message: "Pacific Climate Authority chartered to coordinate the great island migrations" },
  { year: 2200, type: "secede", target: "USA", civ: "California ConvergeAI",
    spawn: { name: "California ConvergeAI", lat: 37.77, lon: -122.42, color: "#7d3ad8" },
    region: { lat: [32, 42], lon: [-125, -114] },
    message: "ConvergeAI declares California a sovereign machine commonwealth" },
  { year: 2215, type: "form_faction", name: "Atlantic Compact", color: "#1a4ba8",
    members: ["USA", "Canada", "United Kingdom", "France", "Germany", "Francoist Spain", "Italy", "Republic of Poland", "Republic of Lithuania", "Republic of Latvia", "Republic of Estonia"],
    message: "The Atlantic Compact forms - a transcontinental alliance of the climate-stable north" },
  { year: 2240, type: "wartime", on: true,
    message: "The Great Fragmentation Wars begin - regional conflicts ignite worldwide" },
  { year: 2270, type: "rename", from: "Russia", to: "Eurasian Republic", color: "#5a7ab5", spawnIfMissing: { lat: 55.75, lon: 37.62 },
    message: "Russia reorganizes as the Eurasian Republic after the climate collapse" },
  { year: 2295, type: "form_faction", name: "Pan-European Union", color: "#3a6a8a",
    members: ["France", "Germany", "Italy", "Francoist Spain", "Republic of Poland", "Netherlands", "Belgium", "Greece", "Republic of Lithuania", "Republic of Latvia", "Republic of Estonia"],
    message: "Pan-European Union signed - the EU's far-future incarnation" },
  { year: 2320, type: "wartime", on: false,
    message: "The Fragmentation Wars wind down" },
  { year: 2350, type: "secede", target: "Mars Colony Authority", civ: "Mars Republic",
    spawn: { name: "Mars Republic", lat: 27.5, lon: -80.6, color: "#e84a3a" },
    region: { lat: [25, 32], lon: [-82, -77] },
    message: "Mars declares full independence - the Mars Republic is born" },
  { year: 2400, civ: { name: "Asteroid Belt Coalition", lat: 47.6, lon: -122.3, color: "#a8a8a8" },
    message: "Asteroid Belt Coalition opens an Earth-side embassy in Seattle" },
  { year: 2420, type: "alliance", a: "Mars Republic", b: "Mars Colony Authority",
    message: "Mars terraforming Phase I - greenhouse atmosphere project begins" },
  { year: 2520, type: "alliance", a: "Mars Republic", b: "Lunar Republic",
    message: "Mars terraforming Phase II - first liquid water seas on Hellas" },
  { year: 2640, type: "alliance", a: "Mars Republic", b: "Asteroid Belt Coalition",
    message: "Mars terraforming complete - the Red Planet turns blue and green" },
  { year: 2780, civ: { name: "Venus Sky-Cities", lat: 4.6, lon: -74.0, color: "#e8c020" },
    message: "Venus Sky-Cities terraforming begins - aerostat colonies seed sulphuric clouds" },
  { year: 2950, type: "alliance", a: "Saturn Moons Confederation", b: "Mars Republic",
    message: "Europa terraforming begins under the ice shell" },
  { year: 3080, type: "rename", from: "Venus Sky-Cities", to: "Republic of Venus", color: "#3a8a4a", spawnIfMissing: { lat: 4.6, lon: -74.0 },
    message: "Venus terraforming complete - the Republic of Venus is proclaimed" },
  { year: 3300, type: "alliance", a: "Centauri Authority", b: "Sol Federation",
    message: "Proxima Centauri b terraforming begins under Centauri Authority charter" },
  { year: 3450, type: "rename", from: "Asteroid Belt Coalition", to: "Belt Hollow Republic", color: "#a8a8a8", spawnIfMissing: { lat: 47.6, lon: -122.3 },
    message: "Asteroid Belt terraforming - mass-driven hollow-rock habitats finished" },
  { year: 2440, type: "alliance", a: "Mars Republic", b: "USA",
    message: "Earth-Mars Compact - permanent peace and shared infrastructure" },
  { year: 2500, type: "peace_treaty", a: "Eurasian Republic", b: "USA",
    message: "Climate Stabilization Accord - the great powers cooperate to re-engineer Earth's climate" },
  { year: 2600, civ: { name: "Pan-Solar Diaspora", lat: -33.9, lon: 151.2, color: "#5d8acf" },
    message: "Pan-Solar Diaspora founded in Sydney - humanity's first off-world citizenship body" },
  { year: 2700, civ: { name: "Saturn Moons Confederation", lat: 35.7, lon: 139.7, color: "#d4b85a" },
    message: "Saturn Moons Confederation establishes Earth-side relations with Tokyo" },
  { year: 2800, type: "form_faction", name: "Solar Republic", color: "#ffd24a",
    members: ["USA", "Mars Republic", "Lunar Republic", "Asteroid Belt Coalition", "Saturn Moons Confederation", "Pan-Solar Diaspora", "Mars Colony Authority"],
    message: "The Solar Republic forms - all human worlds unite under one charter" },
  { year: 3000, type: "rename", from: "USA", to: "Sol Federation", color: "#5da9e8", spawnIfMissing: { lat: 39, lon: -77 },
    message: "The Singularity reshapes humanity - the USA reincorporates as the Sol Federation" },
  { year: 3200, civ: { name: "Centauri Authority", lat: 1.3, lon: 103.8, color: "#b8e84a" },
    message: "Centauri Authority opens an Earth-side liaison office in Singapore" },
  { year: 3500, type: "form_faction", name: "Many-Worlds Federation", color: "#9b6ae8",
    members: ["Sol Federation", "Mars Republic", "Centauri Authority", "Lunar Republic", "Pan-Solar Diaspora", "Asteroid Belt Coalition", "Saturn Moons Confederation"],
    message: "Many-Worlds Federation chartered - humanity spans the local stars" },
  { year: 3700, type: "secede", target: "Eurasian Republic", civ: "Siberian Free Cities",
    spawn: { name: "Siberian Free Cities", lat: 55, lon: 100, color: "#a8c44a" },
    region: { lat: [50, 70], lon: [70, 130] },
    message: "Siberian Free Cities secede from the Eurasian Republic" },
  { year: 4000, type: "wartime", on: true,
    message: "The Millennial War - dynasty resets across the Many-Worlds Federation" },
  { year: 4150, type: "wartime", on: false,
    message: "The Millennial War ends" },
  { year: 4200, type: "rename", from: "Sol Federation", to: "Ascended Sol", color: "#c4a8e8", spawnIfMissing: { lat: 39, lon: -77 },
    message: "Ascended Sol - post-physical civilization remains Earth's dominant presence" },
  { year: 4600, civ: { name: "Reborn Earth", lat: 0.0, lon: 23.0, color: "#3aa84a" },
    message: "Reborn Earth - a fresh ecological civilization emerges from the equatorial belt" },
  { year: 4900, type: "rename", from: "Reborn Earth", to: "Civilization XII", color: "#ffd24a", spawnIfMissing: { lat: 0.0, lon: 23.0 },
    message: "Civilization XII proclaimed - the twelfth great cycle of human history begins" },
  { year: 5050, civ: { name: "Anchor Eternity", lat: 51.5, lon: -0.1, color: "#fff5cc" },
    message: "Anchor Eternity convened in London - millennial-scale stewardship body proclaimed" },

  { year: 2055, type: "war", a: "Russia", b: "Persia", region: { lat: [35, 48], lon: [45, 60] }, reinforce: 12,
    message: "Caspian Water War - Russia and Persia clash over collapsing aquifers" },
  { year: 2068, type: "peace_treaty", a: "Russia", b: "Persia",
    message: "Caspian Concord ends the water war" },
  { year: 2065, type: "war", a: "Modern Egypt", b: "Ethiopia", region: { lat: [5, 25], lon: [30, 42] }, reinforce: 10,
    message: "Nile Wars - Egypt clashes with Ethiopia over the GERD's water rights" },
  { year: 2078, type: "peace_treaty", a: "Modern Egypt", b: "Ethiopia",
    message: "Khartoum Treaty codifies the Nile flow" },
  { year: 2082, type: "war", a: "People's Republic of China", b: "Yamato", region: { lat: [10, 30], lon: [105, 130] }, reinforce: 14,
    message: "South China Sea War - Chinese expansion meets Japanese carriers" },
  { year: 2099, type: "peace_treaty", a: "People's Republic of China", b: "Yamato",
    message: "Manila Accords end the Pacific war" },
  { year: 2092, type: "war", a: "India", b: "Pakistan", region: { lat: [22, 35], lon: [65, 80] }, reinforce: 12,
    message: "Third Indo-Pakistani War - Kashmir's glacial water rights ignite the subcontinent" },
  { year: 2110, type: "absorb", absorber: "India", target: "Pakistan",
    message: "Pakistan capitulates after the third war and is absorbed into India" },
  { year: 2125, type: "secede", target: "Argentina", civ: "Patagonian Republic",
    spawn: { name: "Patagonian Republic", lat: -50, lon: -70, color: "#3a8a8a" },
    region: { lat: [-56, -39], lon: [-78, -62] },
    message: "Patagonian Republic secedes from a fragmenting Argentina" },
  { year: 2135, type: "secede", target: "Mexico", civ: "Cartel Republic",
    spawn: { name: "Cartel Republic", lat: 24.6, lon: -103.0, color: "#7d1818" },
    region: { lat: [22, 32], lon: [-110, -95] },
    message: "Northern Mexican states fragment as the Cartel Republic declares sovereignty" },
  { year: 2150, type: "war", a: "USA", b: "Cartel Republic", region: { lat: [25, 35], lon: [-115, -95] }, reinforce: 10,
    message: "Border War - the USA invades the Cartel Republic" },
  { year: 2168, type: "absorb", absorber: "USA", target: "Cartel Republic",
    message: "Cartel Republic falls - territory annexed by the USA" },
  { year: 2175, type: "secede", target: "Canada", civ: "Quebec",
    spawn: { name: "Quebec", lat: 46.81, lon: -71.21, color: "#3a6ad8" },
    region: { lat: [44, 62], lon: [-80, -57] },
    message: "Quebec independence - the second referendum finally succeeds in the climate-strained 2170s" },
  { year: 2185, type: "secede", target: "Francoist Spain", civ: "Catalonia",
    spawn: { name: "Catalonia", lat: 41.39, lon: 2.16, color: "#e8c020" },
    region: { lat: [40, 43], lon: [0, 4] },
    message: "Catalonia declares independence" },
  { year: 2188, type: "secede", target: "Francoist Spain", civ: "Basque Republic",
    spawn: { name: "Basque Republic", lat: 43.27, lon: -2.93, color: "#a02828" },
    region: { lat: [42, 44], lon: [-4, -1] },
    message: "Basque Republic declares independence" },
  { year: 2225, type: "secede", target: "USA", civ: "Texan Republic",
    spawn: { name: "Texan Republic", lat: 30.27, lon: -97.74, color: "#e85d4a" },
    region: { lat: [25, 36], lon: [-107, -94] },
    message: "Texan Republic secedes during the Fragmentation Wars" },
  { year: 2228, type: "war", a: "USA", b: "Texan Republic", region: { lat: [25, 36], lon: [-107, -94] }, reinforce: 12,
    message: "Second American Civil War" },
  { year: 2255, type: "absorb", absorber: "USA", target: "Texan Republic",
    message: "USA reincorporates Texas after a brutal seven-year war" },
  { year: 2245, type: "secede", target: "Germany", civ: "Bavaria",
    spawn: { name: "Bavaria", lat: 48.14, lon: 11.58, color: "#5a7af0" },
    region: { lat: [47, 50], lon: [9, 14] },
    message: "Bavaria secedes from Germany during the Fragmentation Wars" },
  { year: 2272, type: "absorb", absorber: "Germany", target: "Bavaria",
    message: "Bavaria reabsorbed into Germany after the Pan-European Union forms" },
  { year: 2280, type: "war", a: "Eurasian Republic", b: "Ukraine", region: { lat: [44, 53], lon: [22, 41] }, reinforce: 14,
    message: "Second Russo-Ukrainian War - the Eurasian Republic moves on Kyiv" },
  { year: 2305, type: "peace_treaty", a: "Eurasian Republic", b: "Ukraine",
    message: "Vienna Concord ends the Russo-Ukrainian conflict" },
  { year: 2330, type: "secede", target: "Eurasian Republic", civ: "Caucasus Federation",
    spawn: { name: "Caucasus Federation", lat: 43.0, lon: 44.5, color: "#a02828" },
    region: { lat: [40, 45], lon: [38, 50] },
    message: "Caucasus Federation breaks free from the Eurasian Republic" },
  { year: 2360, civ: { name: "African Continental Union", lat: 9.07, lon: 7.49, color: "#1a8a4a" },
    message: "African Continental Union founded in Abuja - 54 states one charter" },
  { year: 2380, type: "absorb", absorber: "African Continental Union", target: "Nigeria",
    message: "Nigeria merges into the African Continental Union" },
  { year: 2385, type: "absorb", absorber: "African Continental Union", target: "Modern Egypt",
    message: "Modern Egypt joins the African Continental Union" },
  { year: 2410, type: "war", a: "Eurasian Republic", b: "USA", region: { lat: [55, 75], lon: [-180, -130] }, reinforce: 16,
    message: "Bering Crisis - Russia and the USA fight for thawed Arctic shipping lanes" },
  { year: 2435, type: "peace_treaty", a: "Eurasian Republic", b: "USA",
    message: "Anchorage Accord - shared Arctic stewardship signed" },
  { year: 2475, type: "secede", target: "Australia", civ: "Outback Free State",
    spawn: { name: "Outback Free State", lat: -25, lon: 134, color: "#d4b85a" },
    region: { lat: [-30, -15], lon: [125, 145] },
    message: "Outback Free State secedes from Australia" },
  { year: 2540, type: "war", a: "African Continental Union", b: "Eurasian Republic", region: { lat: [25, 50], lon: [25, 60] }, reinforce: 16,
    message: "Suez War - the African Union clashes with the Eurasians over the resurrected canal" },
  { year: 2575, type: "peace_treaty", a: "African Continental Union", b: "Eurasian Republic",
    message: "Aswan Treaty ends the Suez War" },
  { year: 2620, type: "secede", target: "People's Republic of China", civ: "Tibetan Free State",
    spawn: { name: "Tibetan Free State", lat: 29.65, lon: 91.11, color: "#ffe04a" },
    region: { lat: [27, 36], lon: [78, 100] },
    message: "Tibetan Free State proclaimed - China loosens its grip in the long peace" },
  { year: 2680, civ: { name: "Central Asian Caliphate", lat: 41.31, lon: 69.24, color: "#3a8a3a" },
    message: "Central Asian Caliphate proclaimed in Tashkent" },
  { year: 2750, type: "form_faction", name: "Mediterranean Compact", color: "#3a6ad8",
    members: ["Italy", "Greece", "Modern Egypt", "Francoist Spain", "France", "Turkey", "African Continental Union"],
    message: "Mediterranean Compact - rim states unite against rising seas" },
  { year: 2820, type: "war", a: "Mars Republic", b: "Eurasian Republic", region: { lat: [25, 32], lon: [-82, -77] }, reinforce: 12,
    message: "Earth-Mars Crisis - Eurasians blockade the Mars liaison" },
  { year: 2855, type: "peace_treaty", a: "Mars Republic", b: "Eurasian Republic",
    message: "Cislunar Accord ends the Earth-Mars Crisis" },
  { year: 2920, type: "war", a: "Eurasian Republic", b: "People's Republic of China", region: { lat: [40, 60], lon: [80, 130] }, reinforce: 14,
    message: "The Long Border War - Eurasians and the PRC clash across Mongolia" },
  { year: 2965, type: "absorb", absorber: "People's Republic of China", target: "Eurasian Republic",
    message: "Eurasian Republic capitulates - the PRC absorbs Siberia and the steppe" },
  { year: 3050, type: "secede", target: "People's Republic of China", civ: "Greater Manchuria",
    spawn: { name: "Greater Manchuria", lat: 45.0, lon: 126.6, color: "#a04a3a" },
    region: { lat: [40, 55], lon: [115, 135] },
    message: "Greater Manchuria secedes from a sprawling China" },
  { year: 3160, type: "war", a: "Sol Federation", b: "African Continental Union", region: { lat: [-30, 30], lon: [-20, 50] }, reinforce: 18,
    message: "First Post-Singular War - Sol Federation forces invade the African Continental Union" },
  { year: 3210, type: "peace_treaty", a: "Sol Federation", b: "African Continental Union",
    message: "Lagos Concord ends the post-Singular war" },
  { year: 3340, type: "secede", target: "African Continental Union", civ: "Saharan Reborn Republic",
    spawn: { name: "Saharan Reborn Republic", lat: 19.0, lon: 5.0, color: "#3aa84a" },
    region: { lat: [12, 30], lon: [-15, 30] },
    message: "Saharan Reborn Republic - the green-again Sahara declares sovereignty" },
  { year: 3500, type: "war", a: "Centauri Authority", b: "Sol Federation", region: { lat: [25, 45], lon: [-130, -60] }, reinforce: 16,
    message: "Centauri-Sol War - the colonies turn on Earth" },
  { year: 3560, type: "peace_treaty", a: "Centauri Authority", b: "Sol Federation",
    message: "Proxima Compact ends the Centauri war" },
  { year: 3700, type: "war", a: "Sol Federation", b: "Caucasus Federation", region: { lat: [40, 50], lon: [38, 55] }, reinforce: 12,
    message: "Caucasus Pacification - Sol Federation forces intervene in the Caucasus" },
  { year: 3820, type: "secede", target: "Italy", civ: "New Roman Republic",
    spawn: { name: "New Roman Republic", lat: 41.9, lon: 12.5, color: "#a02828" },
    region: { lat: [36, 47], lon: [6, 19] },
    message: "New Roman Republic - Italy reorganizes under classical-revivalist banners" },
  { year: 3990, type: "war", a: "Many-Worlds Federation", b: "Civilization XII", region: { lat: [-30, 60], lon: [-30, 60] }, reinforce: 20,
    message: "Millennial War sparks - the Federation marches against Earth's reborn cycle" },
  { year: 4080, type: "peace_treaty", a: "Many-Worlds Federation", b: "Civilization XII",
    message: "Long Peace begins after the Millennial War" },
  { year: 4250, type: "secede", target: "African Continental Union", civ: "Congo Republic",
    spawn: { name: "Congo Republic", lat: -4.32, lon: 15.32, color: "#1a8a4a" },
    region: { lat: [-13, 5], lon: [12, 30] },
    message: "Congo Republic secedes from the African Continental Union" },
  { year: 4400, civ: { name: "Indo-Pacific Confederation", lat: 1.3, lon: 103.8, color: "#3aa9c4" },
    message: "Indo-Pacific Confederation founded in Singapore" },
  { year: 4560, type: "war", a: "Indo-Pacific Confederation", b: "Civilization XII", region: { lat: [-20, 40], lon: [60, 150] }, reinforce: 18,
    message: "Pacific Resurrection War - Indo-Pacific forces resist Earth's twelfth cycle" },
  { year: 4620, type: "peace_treaty", a: "Indo-Pacific Confederation", b: "Civilization XII",
    message: "Singapore Accords end the resurrection war" },
  { year: 4750, civ: { name: "Earth Free Federation", lat: 0.0, lon: 23.0, color: "#5dc4e8" },
    message: "Earth Free Federation - a planetary citizens' charter is signed in equatorial Africa" },
  { year: 4880, type: "war", a: "Earth Free Federation", b: "Many-Worlds Federation", region: { lat: [-60, 70], lon: [-180, 180] }, reinforce: 22,
    message: "Last Great War begins - Earth's federation fights the interstellar one for sovereignty" },
  { year: 4882, type: "wartime", on: true, message: "Nuclear exchanges escalate worldwide - the war goes total" },
  { year: 4885, type: "nuke_weakest", message: "Nuclear strikes obliterate the weakest holdouts" },
  { year: 4890, type: "nuke_weakest", message: "More nations vanish in the second wave of strikes" },
  { year: 4895, type: "nuke_weakest", message: "Capitals burn - smaller states collapse" },
  { year: 4900, type: "nuke_weakest", message: "Atmospheric fallout cripples the global power grid" },
  { year: 4905, type: "nuke_weakest", message: "Nuclear winter sets in - frail polities starve and die" },
  { year: 4910, type: "nuke_weakest", message: "Mid-tier states succumb to the cascading collapse" },
  { year: 4915, type: "nuke_weakest", message: "Mid-Atlantic strikes wipe out coastal nations" },
  { year: 4920, type: "nuke_weakest", message: "Steppe states fragment and disappear" },
  { year: 4925, type: "nuke_weakest", message: "Surviving regional unions disintegrate under fallout" },
  { year: 4930, type: "nuke_weakest", message: "African and South-American republics fall silent" },
  { year: 4935, type: "nuke_weakest", message: "Asian federations collapse one after another" },
  { year: 4940, type: "nuke_weakest", message: "The strongest powers tear at each other in their final spasm" },
  { year: 4945, type: "nuke_unify", color: "#3a2a14",
    message: "All Earth-side civilizations have been annihilated. Nuclear Wasteland inherits the planet." },
  { year: 5400, type: "spawn_after_nuke",
    civ: { name: "Cockroach Tribe", lat: 24.0, lon: 90.0, color: "#3a2014" },
    tileCount: 25,
    message: "From the radioactive ruins, the Cockroach Tribe emerges in the Bengal delta - the only land-creatures that survived the nuclear winter." },
  { year: 5550, type: "rename", from: "Cockroach Tribe", to: "Cockroach Empire", color: "#3a2014", spawnIfMissing: { lat: 24.0, lon: 90.0 },
    message: "The Cockroach Tribe consolidates the wastelands and proclaims the Cockroach Empire" },
  { year: 5700, type: "spawn_aquatic",
    civ: { name: "Squid Tribe", lat: -10.0, lon: 160.0, color: "#7d3ad8" },
    tileCount: 60,
    message: "The Squid Tribe rises from the irradiated Pacific - a fully aquatic civilization that can only colonize the oceans, lakes, and seas." },
  { year: 5850, type: "rename", from: "Squid Tribe", to: "Squid Empire", color: "#7d3ad8", spawnIfMissing: { lat: -10.0, lon: 160.0 },
    message: "The Squid Tribe unifies the world's oceans and proclaims the Squid Empire" },

  { year: 2102, type: "alliance", a: "Lunar Republic", b: "USA",
    message: "Lunar Compact ratified - Helium-3 fusion fuel begins flowing to Earth" },
  { year: 2115, type: "war", a: "Lunar Republic", b: "People's Republic of China", region: { lat: [30, 40], lon: [105, 120] }, reinforce: 8,
    message: "First Cislunar War - Chinese orbital strikes contest the lunar Helium-3 monopoly" },
  { year: 2138, type: "peace_treaty", a: "Lunar Republic", b: "People's Republic of China",
    message: "Tycho Treaty ends the First Cislunar War - lunar mining quotas established" },
  { year: 2170, civ: { name: "L5 Habitat League", lat: 28.4, lon: -80.6, color: "#9bb8d4", planet: "Moon" },
    message: "L5 Habitat League founded - the first permanent O'Neill cylinders open at the Earth-Moon Lagrange point" },
  { year: 2185, civ: { name: "Mercury Solar Authority", lat: 0.0, lon: 0.0, color: "#a89678", planet: "Mercury" },
    message: "Mercury Solar Authority - sun-shaded basins host the first permanent solar-furnace colonies" },
  { year: 2200, type: "alliance", a: "Mars Colony Authority", b: "Lunar Republic",
    message: "Inner Worlds Pact - Mars and the Moon coordinate orbital infrastructure" },
  { year: 2230, civ: { name: "Phobos Mining Guild", lat: 0.0, lon: 0.0, color: "#7a5a3a", planet: "Phobos" },
    message: "Phobos Mining Guild incorporated - the Martian moons become humanity's first deep-space industrial hub" },
  { year: 2245, civ: { name: "Deimos Watchtower", lat: 10.0, lon: 30.0, color: "#8a6a4a", planet: "Deimos" },
    message: "Deimos Watchtower - the smaller Martian moon hosts the system's first long-baseline observatory" },
  { year: 2260, type: "war", a: "Phobos Mining Guild", b: "Mars Colony Authority", region: { lat: [25, 32], lon: [-82, -77] }, reinforce: 6,
    message: "Phobos Strike - the moon-miners revolt against Mars Authority taxation" },
  { year: 2275, type: "peace_treaty", a: "Phobos Mining Guild", b: "Mars Colony Authority",
    message: "Olympus Accord recognizes Phobos autonomy" },
  { year: 2310, civ: { name: "Ceres Free Port", lat: 0.0, lon: 0.0, color: "#c4c4a8", planet: "Asteroid Belt" },
    message: "Ceres Free Port chartered - the largest asteroid becomes a tax-free trade hub" },
  { year: 2370, civ: { name: "Io Volcanic League", lat: 0.0, lon: 0.0, color: "#e8c020", planet: "Io" },
    message: "Io Volcanic League - sulphur-mining outposts cluster around the Loki Patera" },
  { year: 2375, civ: { name: "Ganymede Free State", lat: 0.0, lon: 0.0, color: "#a89678", planet: "Ganymede" },
    message: "Ganymede Free State - the largest moon's magnetic shelter hosts a sovereign settlement" },
  { year: 2340, type: "war", a: "Mars Republic", b: "Lunar Republic", region: { lat: [27, 33], lon: [-82, -77] }, reinforce: 10,
    message: "Independence War - Mars secedes by force from joint Lunar-Earth oversight" },
  { year: 2355, type: "peace_treaty", a: "Mars Republic", b: "Lunar Republic",
    message: "Hellas Accord recognizes Mars as a sovereign state" },
  { year: 2390, civ: { name: "Jovian Trojans Authority", lat: 20.0, lon: -90.0, color: "#c4a880", planet: "Asteroid Belt" },
    message: "Jovian Trojans Authority chartered - the L4/L5 asteroid clusters of Jupiter become a sovereign zone" },
  { year: 2425, type: "war", a: "Jovian Trojans Authority", b: "Asteroid Belt Coalition", region: { lat: [40, 50], lon: [-125, -110] }, reinforce: 8,
    message: "Trojan-Belt War - rival prospectors clash over the icy Jovian asteroids" },
  { year: 2450, type: "peace_treaty", a: "Jovian Trojans Authority", b: "Asteroid Belt Coalition",
    message: "Galilean Concord ends the Trojan-Belt War" },
  { year: 2480, civ: { name: "Callisto Settlement", lat: 0.0, lon: 0.0, color: "#a89070", planet: "Callisto" },
    message: "Callisto Settlement opened - Jupiter's outer moon becomes humanity's deepest planetary outpost" },
  { year: 2510, type: "alliance", a: "Mars Republic", b: "Phobos Mining Guild",
    message: "Mars-Phobos Reunification Pact - the Martian moons rejoin the Mars sphere" },
  { year: 2555, civ: { name: "Europan Order", lat: 0.0, lon: 0.0, color: "#3a8acf", planet: "Europa" },
    message: "Europan Order founded - the first sub-ice colonies harvest Europa's hidden ocean" },
  { year: 2580, civ: { name: "Mimas Cold Republic", lat: 0.0, lon: 0.0, color: "#d4d4e8", planet: "Mimas" },
    message: "Mimas Cold Republic - the smallest spherical moon hosts a low-gravity research enclave" },
  { year: 2590, type: "war", a: "Europan Order", b: "Saturn Moons Confederation", region: { lat: [35, 40], lon: [135, 145] }, reinforce: 10,
    message: "Outer Moons War - the Europans contest Saturn's claim to the gas-giant moons" },
  { year: 2615, type: "peace_treaty", a: "Europan Order", b: "Saturn Moons Confederation",
    message: "Cassini Accord ends the Outer Moons War" },
  { year: 2660, type: "alliance", a: "L5 Habitat League", b: "Lunar Republic",
    message: "Cislunar Concord - the orbital habitats federate with the lunar government" },
  { year: 2670, civ: { name: "Titan Methanate Republic", lat: 0.0, lon: 0.0, color: "#d4a657", planet: "Titan" },
    message: "Titan Methanate Republic - the methane-lake colonies declare independence from the Saturn Confederation" },
  { year: 2685, civ: { name: "Uranus Tilt League", lat: 0.0, lon: 0.0, color: "#5dc4e8", planet: "Uranus" },
    message: "Uranus Tilt League - cloud-city aerostat collectives chartered in the ice giant's upper atmosphere" },
  { year: 2690, civ: { name: "Triton Cooperative", lat: 0.0, lon: 0.0, color: "#5d8acf", planet: "Triton" },
    message: "Triton Cooperative chartered - Neptune's moon becomes humanity's first colony beyond the gas giants" },
  { year: 2705, civ: { name: "Neptune Storm Council", lat: 0.0, lon: 0.0, color: "#3a6ad8", planet: "Neptune" },
    message: "Neptune Storm Council - the Great Dark Spot's pressure-gradient power stations form a sovereign body" },
  { year: 2720, type: "war", a: "Saturn Moons Confederation", b: "Mars Republic", region: { lat: [25, 35], lon: [-82, -75] }, reinforce: 12,
    message: "Saturnian-Martian War - the gas-giant powers reach inward against the Red Planet" },
  { year: 2745, type: "peace_treaty", a: "Saturn Moons Confederation", b: "Mars Republic",
    message: "Encke Treaty ends the Saturnian-Martian War" },
  { year: 2790, type: "alliance", a: "Venus Sky-Cities", b: "Mars Republic",
    message: "Inner-Worlds Triumvirate - Venus, Mars, and Earth coordinate inner-system terraforming" },
  { year: 2810, civ: { name: "Pluto-Charon Republic", lat: 0.0, lon: 0.0, color: "#9a6acf", planet: "Pluto" },
    message: "Pluto-Charon Republic declared - the Kuiper-belt twins claim the outer reaches" },
  { year: 2840, type: "war", a: "Pluto-Charon Republic", b: "Triton Cooperative", region: { lat: [33, 38], lon: [137, 143] }, reinforce: 8,
    message: "Outer-Dark War - the Kuiper polities clash for trans-Neptunian dominance" },
  { year: 2870, type: "peace_treaty", a: "Pluto-Charon Republic", b: "Triton Cooperative",
    message: "Kuiper Concord ends the Outer-Dark War" },
  { year: 2900, civ: { name: "Oort Survey Charter", lat: 0.0, lon: 0.0, color: "#5a5acf", planet: "Pluto" },
    message: "Oort Survey Charter - the first probe missions to humanity's last solar frontier" },
  { year: 2940, type: "alliance", a: "Europan Order", b: "Pan-Solar Diaspora",
    message: "Subglacial Pact - all sub-ice colonies federate under the Diaspora charter" },
  { year: 2980, type: "rename", from: "Mars Colony Authority", to: "Mars Greater Republic", color: "#c84a3a", spawnIfMissing: { lat: 28.4, lon: -80.6 },
    message: "Mars Greater Republic - the Authority and Republic merge into a single greater Martian polity" },
  { year: 3020, civ: { name: "Alpha Centauri Settlement Bureau", lat: 0.0, lon: 0.0, color: "#b8e84a", planet: "Proxima Centauri b" },
    message: "Alpha Centauri Settlement Bureau - the first sleeper-ship missions reach Proxima b" },
  { year: 3070, type: "war", a: "Solar Republic", b: "Pluto-Charon Republic", region: { lat: [33, 38], lon: [137, 143] }, reinforce: 12,
    message: "Outer-Sphere War - the Solar Republic forces Kuiper compliance" },
  { year: 3110, type: "peace_treaty", a: "Solar Republic", b: "Pluto-Charon Republic",
    message: "Charon Treaty ends the Outer-Sphere War" },
  { year: 3150, civ: { name: "Tau Ceti Mission", lat: 1.3, lon: 103.8, color: "#80e8b8" },
    message: "Tau Ceti Mission - generation ships depart for humanity's second extrasolar world" },
  { year: 3220, civ: { name: "Barnard's Star Colony", lat: 1.3, lon: 103.8, color: "#e89a4a" },
    message: "Barnard's Star Colony established - red-dwarf habitable zone settled" },
  { year: 3260, type: "alliance", a: "Centauri Authority", b: "Alpha Centauri Settlement Bureau",
    message: "Centauri Unification - the colonies and the Authority merge under one charter" },
  { year: 3320, type: "war", a: "Centauri Authority", b: "Tau Ceti Mission", region: { lat: [1, 3], lon: [102, 105] }, reinforce: 10,
    message: "First Interstellar War - the Centaurians and the Tau Cetians fight over Earth-bound trade routes" },
  { year: 3360, type: "peace_treaty", a: "Centauri Authority", b: "Tau Ceti Mission",
    message: "Sol-Side Treaty ends the First Interstellar War" },
  { year: 3400, civ: { name: "Epsilon Eridani Republic", lat: 1.3, lon: 103.8, color: "#e8b84a" },
    message: "Epsilon Eridani Republic chartered - the third extrasolar colony declares sovereignty" },
  { year: 3440, type: "alliance", a: "Tau Ceti Mission", b: "Epsilon Eridani Republic",
    message: "Outer-Stars Pact - the second-wave extrasolar colonies federate" },
  { year: 3480, civ: { name: "Wolf 359 Outpost", lat: 1.3, lon: 103.8, color: "#a06a4a" },
    message: "Wolf 359 Outpost reports back - humanity's nearest red dwarf hosts a research settlement" },
  { year: 3540, civ: { name: "Sirius Outer Reach", lat: 1.3, lon: 103.8, color: "#dde4ff" },
    message: "Sirius Outer Reach - the brightest near-Earth star is reached by laser-sail probes" },
  { year: 3590, type: "alliance", a: "Sirius Outer Reach", b: "Many-Worlds Federation",
    message: "Sirius Compact - the brightest extrasolar settlement joins the Federation" },
  { year: 3620, type: "war", a: "Many-Worlds Federation", b: "Pluto-Charon Republic", region: { lat: [33, 38], lon: [137, 143] }, reinforce: 14,
    message: "Kuiper Reduction War - the Federation forcibly integrates the trans-Neptunian holdouts" },
  { year: 3650, type: "peace_treaty", a: "Many-Worlds Federation", b: "Pluto-Charon Republic",
    message: "Pluto Reintegration Treaty ends the Kuiper Reduction War" },
  { year: 3680, civ: { name: "61 Cygni Republic", lat: 1.3, lon: 103.8, color: "#80acff" },
    message: "61 Cygni Republic - the first 'binary-star' colony declares sovereignty" },
  { year: 3740, type: "war", a: "Centauri Authority", b: "61 Cygni Republic", region: { lat: [1, 3], lon: [102, 105] }, reinforce: 12,
    message: "Cygni-Centauri War - the binary-star colonists fight for trade autonomy" },
  { year: 3770, type: "peace_treaty", a: "Centauri Authority", b: "61 Cygni Republic",
    message: "Cygnus Concord ends the Cygni-Centauri War" },
  { year: 3800, civ: { name: "Orion Frontier", lat: 1.3, lon: 103.8, color: "#5d8acf" },
    message: "Orion Frontier - the first deep-Orion-arm settlements established" },
  { year: 3850, civ: { name: "Galactic Trade Council", lat: 1.3, lon: 103.8, color: "#b8a4e8" },
    message: "Galactic Trade Council formed - all extrasolar colonies sign a common trade charter" },
  { year: 3880, type: "war", a: "Galactic Trade Council", b: "Sol Federation", region: { lat: [25, 45], lon: [-130, -60] }, reinforce: 16,
    message: "Trade-Sovereignty War - Earth resists the new galactic trade rules" },
  { year: 3920, type: "peace_treaty", a: "Galactic Trade Council", b: "Sol Federation",
    message: "Geneva-Galactic Treaty ends the Trade-Sovereignty War" },
  { year: 3960, civ: { name: "Andromeda Survey Charter", lat: 1.3, lon: 103.8, color: "#9b6ae8" },
    message: "Andromeda Survey Charter - the first probes head for the neighboring galaxy" },
  { year: 4030, civ: { name: "Galactic Senate", lat: 51.5, lon: -0.1, color: "#fff5cc" },
    message: "Galactic Senate convened in London - the first interstellar legislature opens" },
  { year: 4090, type: "war", a: "Galactic Senate", b: "Pluto-Charon Republic", region: { lat: [33, 38], lon: [137, 143] }, reinforce: 14,
    message: "Senate Pacification War - the Galactic Senate enforces compliance on the Kuiper holdouts" },
  { year: 4130, type: "peace_treaty", a: "Galactic Senate", b: "Pluto-Charon Republic",
    message: "Senate Charter Treaty ends the Pacification War" },
  { year: 4180, type: "rename", from: "Lunar Republic", to: "Lunar Ascendancy", color: "#a89678", spawnIfMissing: { lat: 32.9, lon: -106.5 },
    message: "Lunar Ascendancy - the Moon proclaims itself a post-physical civilization" },
  { year: 4220, type: "alliance", a: "Lunar Ascendancy", b: "Ascended Sol",
    message: "Ascended Compact - the Moon and Earth federate as post-physical civilizations" },
  { year: 4280, civ: { name: "Stellar Engineers Guild", lat: 1.3, lon: 103.8, color: "#fff5cc" },
    message: "Stellar Engineers Guild incorporated - the first Dyson swarm construction begins around Tau Ceti" },
  { year: 4320, type: "war", a: "Stellar Engineers Guild", b: "Tau Ceti Mission", region: { lat: [1, 3], lon: [102, 105] }, reinforce: 10,
    message: "Dyson War - the Tau Cetians revolt against the Engineers' stellar enclosure" },
  { year: 4350, type: "peace_treaty", a: "Stellar Engineers Guild", b: "Tau Ceti Mission",
    message: "Tau Concord ends the Dyson War - partial swarm authorized" },
  { year: 4380, civ: { name: "Ringworld Consortium", lat: 1.3, lon: 103.8, color: "#e8c075" },
    message: "Ringworld Consortium - the first ringworld is laid down around Sirius" },
  { year: 4450, civ: { name: "Wormhole Survey Charter", lat: 1.3, lon: 103.8, color: "#9b6ae8" },
    message: "Wormhole Survey Charter - the first stable transit gates open between Sol and Centauri" },
  { year: 4490, type: "alliance", a: "Wormhole Survey Charter", b: "Many-Worlds Federation",
    message: "Wormhole Pact - the Federation adopts FTL gate routing" },
  { year: 4530, type: "war", a: "Wormhole Survey Charter", b: "Galactic Trade Council", region: { lat: [1, 3], lon: [102, 105] }, reinforce: 12,
    message: "Gate-Tariff War - the trade council and the gate-keepers contest interstellar tolls" },
  { year: 4570, type: "peace_treaty", a: "Wormhole Survey Charter", b: "Galactic Trade Council",
    message: "Gate Concord ends the Gate-Tariff War" },
  { year: 4660, civ: { name: "Pleiades Settlement Cluster", lat: 1.3, lon: 103.8, color: "#aaccff" },
    message: "Pleiades Settlement Cluster - the seven-star colony charter is signed" },
  { year: 4700, type: "alliance", a: "Pleiades Settlement Cluster", b: "Galactic Senate",
    message: "Pleiades-Senate Compact - the cluster joins the Galactic Senate" },
  { year: 4730, type: "war", a: "Pleiades Settlement Cluster", b: "Centauri Authority", region: { lat: [1, 3], lon: [102, 105] }, reinforce: 12,
    message: "Cluster War - the Pleiades and Centauri contest the inner Orion arm" },
  { year: 4770, type: "peace_treaty", a: "Pleiades Settlement Cluster", b: "Centauri Authority",
    message: "Orion-Arm Treaty ends the Cluster War" },
  { year: 4830, civ: { name: "Galactic Watch", lat: 51.5, lon: -0.1, color: "#5da9e8" },
    message: "Galactic Watch chartered - the first standing interstellar military force is mustered" },
  { year: 5800, type: "spawn_after_nuke",
    civ: { name: "Mantis Reach", lat: -10.0, lon: -55.0, color: "#5da94a" },
    tileCount: 60,
    message: "Mantis Reach emerges from the irradiated Amazon - insectoid survivors stake out the green-again jungle" },
  { year: 6000, civ: { name: "Mars Successor State", lat: 28.4, lon: -80.6, color: "#c84a3a" },
    message: "Mars Successor State proclaimed - the Red Planet's polities reorganize after the long silence from Earth" },
  { year: 6200, civ: { name: "Lunar Successor", lat: 32.9, lon: -106.5, color: "#a89678" },
    message: "Lunar Successor - the Moon's civilization survives the Earth collapse and reasserts itself" },
  { year: 6400, type: "war", a: "Mars Successor State", b: "Lunar Successor", region: { lat: [27, 35], lon: [-110, -75] }, reinforce: 10,
    message: "Inner-Worlds Reckoning War - Mars and the Moon contest the abandoned Earth orbit" },
  { year: 6450, type: "peace_treaty", a: "Mars Successor State", b: "Lunar Successor",
    message: "Earth-Watch Treaty ends the Reckoning War - shared stewardship of dead Earth" },
  { year: 6600, civ: { name: "Centauri Successor Republic", lat: 1.3, lon: 103.8, color: "#b8e84a" },
    message: "Centauri Successor Republic - the extrasolar colonies survive the Federation's collapse" },
  { year: 6800, civ: { name: "Galactic Recovery Authority", lat: 51.5, lon: -0.1, color: "#fff5cc" },
    message: "Galactic Recovery Authority - the surviving extrasolar polities form a recovery body" },
  { year: 7000, type: "alliance", a: "Mars Successor State", b: "Centauri Successor Republic",
    message: "Inter-Stellar Reconnection - direct contact resumed between Mars and Centauri after the silence" },
  { year: 7200, civ: { name: "Squid Surface Authority", lat: -10.0, lon: 160.0, color: "#5d4ac4" },
    message: "Squid Surface Authority - the squid civilization expands to colonize newly-flooded coastal lowlands" },
  { year: 7400, type: "war", a: "Squid Surface Authority", b: "Cockroach Empire", region: { lat: [10, 30], lon: [85, 100] }, reinforce: 12,
    message: "Land-Sea War - the squid surface forces clash with the cockroach empire over the Bengal coast" },
  { year: 7450, type: "peace_treaty", a: "Squid Surface Authority", b: "Cockroach Empire",
    message: "Coastline Treaty ends the Land-Sea War - the species split coast and inland" },
  { year: 7600, type: "alliance", a: "Mantis Reach", b: "Cockroach Empire",
    message: "Insectoid Pact - the surviving land insectoids federate" },
  { year: 7800, civ: { name: "New Sol Federation", lat: 39, lon: -77, color: "#5da9e8" },
    message: "New Sol Federation - a successor polity emerges from rebuilt Earth orbit infrastructure" },
  { year: 8000, type: "alliance", a: "New Sol Federation", b: "Galactic Recovery Authority",
    message: "Reunification Compact - Sol rejoins the galactic order after a millennium of silence" },
  { year: 8200, type: "war", a: "New Sol Federation", b: "Squid Surface Authority", region: { lat: [-15, -5], lon: [155, 165] }, reinforce: 14,
    message: "Reclamation War - the new Sol polity contests the squid claim to Earth's oceans" },
  { year: 8260, type: "peace_treaty", a: "New Sol Federation", b: "Squid Surface Authority",
    message: "Pacific Treaty ends the Reclamation War - shared planetary stewardship" },
  { year: 8400, civ: { name: "Andromeda Forerunners", lat: 1.3, lon: 103.8, color: "#9b6ae8" },
    message: "Andromeda Forerunners return - the first probes report back from the neighboring galaxy" },
  { year: 8600, civ: { name: "Local-Group Authority", lat: 51.5, lon: -0.1, color: "#fff5cc" },
    message: "Local-Group Authority chartered - the first inter-galactic legislative body" },
  { year: 8800, type: "war", a: "Local-Group Authority", b: "Andromeda Forerunners", region: { lat: [40, 50], lon: [-1, 5] }, reinforce: 16,
    message: "Local-Group War - the Andromeda settlers contest the Authority's charter" },
  { year: 8870, type: "peace_treaty", a: "Local-Group Authority", b: "Andromeda Forerunners",
    message: "Local-Group Concord ends the war" },
  { year: 9000, type: "rename", from: "Cockroach Empire", to: "Roach Hegemony", color: "#3a2014", spawnIfMissing: { lat: 24.0, lon: 90.0 },
    message: "Roach Hegemony - the cockroach civilization formalizes its empire after millennia" },
  { year: 9200, type: "rename", from: "Squid Empire", to: "Squid Talassocracy", color: "#7d3ad8", spawnIfMissing: { lat: -10.0, lon: 160.0 },
    message: "Squid Talassocracy proclaimed - the squid civilization formalizes its naval empire" },
  { year: 9400, civ: { name: "Trans-Galactic Mission", lat: 1.3, lon: 103.8, color: "#aaccff" },
    message: "Trans-Galactic Mission departs - humanity's farthest probe begins the crossing to a third galaxy" },
  { year: 9600, type: "alliance", a: "Roach Hegemony", b: "Squid Talassocracy",
    message: "Earth Pact - the two surviving Earth-side civilizations sign a common defense charter" },
  { year: 9800, civ: { name: "Eternity Council", lat: 51.5, lon: -0.1, color: "#fff5cc" },
    message: "Eternity Council convened - the longest-lived stewardship body in human history" },
  { year: 9999, civ: { name: "Tenth-Millennium Compact", lat: 0.0, lon: 0.0, color: "#fff5cc" },
    message: "Tenth-Millennium Compact - on the eve of year 10000, all surviving civilizations sign a single accord" },

  

  

  { year: 1648, type: "peace_treaty", a: "Holy Roman Empire", b: "Sweden",
    message: "Peace of Westphalia - the Thirty Years' War ends; sovereign-state diplomacy is born" },
  { year: 1659, type: "peace_treaty", a: "Kingdom of Spain", b: "Kingdom of France",
    message: "Treaty of the Pyrenees - France and Spain end their long border war" },
  { year: 1713, type: "peace_treaty", a: "Holy Roman Empire", b: "Kingdom of France",
    message: "Treaty of Utrecht - the War of Spanish Succession is settled" },
  { year: 1721, type: "peace_treaty", a: "Sweden", b: "Russian Empire",
    message: "Treaty of Nystad - the Great Northern War ends; Russia replaces Sweden as the Baltic power" },
  { year: 1763, type: "peace_treaty", a: "Kingdom of Prussia", b: "Holy Roman Empire",
    message: "Treaty of Hubertusburg - the Seven Years' War ends; Prussia keeps Silesia" },
  { year: 1783, type: "peace_treaty", a: "USA", b: "United Kingdom",
    message: "Treaty of Paris - Britain recognizes American independence" },
  { year: 1815, type: "peace_treaty", a: "Kingdom of France", b: "United Kingdom",
    message: "Congress of Vienna - the Napoleonic Wars end; Europe redrawn" },
  { year: 1815, type: "peace_treaty", a: "Kingdom of France", b: "Russian Empire",
    message: "Congress of Vienna - France and Russia formally make peace" },
  { year: 1856, type: "peace_treaty", a: "Russian Empire", b: "Ottomans",
    message: "Treaty of Paris - the Crimean War ends" },
  { year: 1871, type: "peace_treaty", a: "Kingdom of Prussia", b: "Kingdom of France",
    message: "Treaty of Frankfurt - the Franco-Prussian War ends; Alsace-Lorraine ceded to Germany" },
  { year: 1898, type: "peace_treaty", a: "USA", b: "Kingdom of Spain",
    message: "Treaty of Paris - the Spanish-American War ends; Spain cedes its remaining colonies" },
  { year: 1905, type: "peace_treaty", a: "Yamato", b: "Russian Empire",
    message: "Treaty of Portsmouth - the Russo-Japanese War ends; Japan emerges as a great power" },
  { year: 1918, type: "peace_treaty", a: "Soviet Union", b: "Germany",
    message: "Treaty of Brest-Litovsk - Russia exits World War I" },
  { year: 1919, type: "peace_treaty", a: "Germany", b: "France",
    message: "Treaty of Versailles - World War I formally ends; punitive terms imposed on Germany" },
  { year: 1919, type: "peace_treaty", a: "Germany", b: "United Kingdom",
    message: "Treaty of Versailles - Britain signs the post-war settlement" },
  { year: 1953, type: "peace_treaty", a: "People's Republic of China", b: "Korea",
    message: "Korean Armistice - the Korean War ends in stalemate at the 38th parallel" },
  { year: 1973, type: "peace_treaty", a: "USA", b: "People's Republic of China",
    message: "Paris Peace Accords - the United States withdraws from Vietnam" },
  { year: 1979, type: "peace_treaty", a: "Modern Egypt", b: "Israel",
    message: "Camp David Accords - Egypt and Israel sign a historic peace treaty" },
  { year: 1989, type: "peace_treaty", a: "Soviet Union", b: "Saudi Arabia",
    message: "Geneva Accords - the Soviets withdraw from Afghanistan" },

  

  
  
  { year: -547, type: "absorb", absorber: "Persia", target: "Lydia", message: "Cyrus defeats Croesus - Lydia falls to Persia" },
  
  { year: -550, type: "absorb", absorber: "Persia", target: "Medes", message: "Cyrus the Great overthrows Astyages - Media is absorbed into Persia" },
  
  { year: -539, type: "absorb", absorber: "Persia", target: "Phoenicia", message: "Phoenician cities submit to Persian rule after the fall of Babylon" },
  
  { year: -396, type: "absorb", absorber: "Rome", target: "Etruscans", message: "Romans sack Veii - the Etruscan civilization fades into Rome" },
  
  { year: -330, type: "absorb", absorber: "Macedon", target: "Persia", message: "Battle of Gaugamela - Alexander destroys the Achaemenid Empire" },
  
  { year: -184, type: "rename", from: "Maurya", to: "Sunga India", color: "#c44a8a", spawnIfMissing: { lat: 25, lon: 81 }, message: "Mauryan Empire collapses - Pushyamitra Sunga seizes power" },
  
  { year: -148, type: "absorb", absorber: "Rome", target: "Antigonid Macedon", message: "Fourth Macedonian War - Macedonia becomes a Roman province" },
  
  { year: -146, type: "absorb", absorber: "Rome", target: "Carthage", message: "Carthage destroyed at the end of the Third Punic War" },
  
  { year:  -64, type: "absorb", absorber: "Rome", target: "Seleucid Empire", message: "Pompey ends the Seleucid Empire - Syria becomes a Roman province" },
  { year:  -63, type: "absorb", absorber: "Rome", target: "Pontus", message: "Mithridates VI's empire falls - Pontus annexed by Rome" },
  
  { year:  -50, type: "absorb", absorber: "Rome", target: "Gauls", message: "Caesar's Gallic Wars end - Gaul fully absorbed into Rome" },
  
  { year:  -30, type: "absorb", absorber: "Rome", target: "Ptolemaic Egypt", message: "Octavian defeats Antony and Cleopatra - Ptolemaic Egypt becomes a Roman province" },
  
  { year:  -27, type: "absorb", absorber: "Rome", target: "Egypt", message: "Augustus annexes Ptolemaic territory - the old Egyptian kingdoms vanish from the political map" },
  
  { year:   46, type: "absorb", absorber: "Rome", target: "Thracians", message: "Claudius annexes the Thracian client kingdom" },
  
  { year:  220, type: "absorb", absorber: "Cao Wei", target: "Han China", message: "Han Dynasty collapses - Cao Wei takes the imperial seal" },
  
  { year:  224, type: "absorb", absorber: "Sasanians", target: "Parthia", message: "Ardashir I overthrows the Parthian Arsacids - Sasanian Empire founded" },
  
  { year:  280, type: "absorb", absorber: "Cao Wei", target: "Eastern Wu", message: "Western Jin reunifies China - Eastern Wu absorbed" },
  { year:  263, type: "absorb", absorber: "Cao Wei", target: "Shu Han", message: "Shu Han falls to Cao Wei" },
  
  { year:  265, type: "rename", from: "Cao Wei", to: "Jin China", color: "#d83030", spawnIfMissing: { lat: 35, lon: 110 }, message: "Sima Yan founds the Jin Dynasty - Three Kingdoms era ends" },
  
  { year:  280, type: "rename", from: "Jin China", to: "Imperial China", color: "#d83030", spawnIfMissing: { lat: 35, lon: 110 }, message: "Western Jin reunifies the Chinese world" },
  
  { year:  534, type: "absorb", absorber: "Byzantium", target: "Vandals", message: "Belisarius retakes North Africa - the Vandal Kingdom is destroyed" },
  
  { year:  651, type: "absorb", absorber: "Arabs", target: "Sasanians", message: "Last Sasanian shah killed - Persia falls to the Arabs" },

  { year:   -108, type: "absorb", absorber: "Han China", target: "Gojoseon", message: "Han Wudi conquers Gojoseon - Korean peninsula falls under Chinese control" },
  
  
  { year: 1670, type: "absorb", absorber: "Morocco", target: "Mali Empire", message: "Saadi sultans take Timbuktu - Mali Empire is no more" },
  
  { year: 1291, type: "absorb", absorber: "Arabs", target: "Kingdom of Jerusalem", message: "Mamluks take Acre - the Kingdom of Jerusalem is finished" },
  
  { year: 1335, type: "absorb", absorber: "Persia", target: "Ilkhanate", message: "Abu Sa'id dies without an heir - the Ilkhanate fragments" },
  
  { year: 1502, type: "absorb", absorber: "Russian Empire", target: "Golden Horde", message: "Great Stand on the Ugra ends - Golden Horde shattered, Russia free" },

  { year: 1294, type: "absorb", absorber: "Yuan China", target: "Mongols", message: "Kublai Khan dies - the unified Mongol Empire is gone, only the khanates remain" },

  

  
  
  { year: 1806, type: "absorb", absorber: "Germans", target: "Holy Roman Empire", message: "Napoleon dissolves the Holy Roman Empire - the German lands begin coalescing toward unification" },
  
  { year: 1858, type: "absorb", absorber: "United Kingdom", target: "Mughal Empire", message: "Indian Mutiny crushed - Britain abolishes the Mughal throne" },

  { year: 1871, type: "rename", from: "Germans", to: "Germany", color: "#202020", spawnIfMissing: { lat: 52.52, lon: 13.40 }, message: "Bismarck unifies the German states into the German Empire" },
  
  { year: 1871, type: "claim", civ: "Germany", byOwner: "GER", message: "Germany consolidates its modern territory" },
  
  { year: 1917, type: "absorb", absorber: "Finland", target: "Finns", message: "Finnish proto-tribe gives way to the modern Republic of Finland" },

  { year:  800, type: "absorb", absorber: "Holy Roman Empire", target: "Goths", message: "Charlemagne crowned - the last Gothic identity merges into the new Empire" },
  
  { year: 1991, type: "secede", target: "Yugoslavia", civ: "Croatia",
    spawn: { name: "Croatia", lat: 45.81, lon: 15.98, color: "#a01818" }, byOwner: "CRO",
    message: "Croatia declares independence - Yugoslavia begins dissolving" },
  { year: 1991, type: "secede", target: "Yugoslavia", civ: "Slovenia",
    spawn: { name: "Slovenia", lat: 46.06, lon: 14.51, color: "#3a6ad8" }, byOwner: "SLO",
    message: "Slovenia declares independence from Yugoslavia" },
  { year: 1992, type: "secede", target: "Yugoslavia", civ: "Bosnia",
    spawn: { name: "Bosnia", lat: 43.86, lon: 18.41, color: "#1a8a4a" }, byOwner: "BOS",
    message: "Bosnia and Herzegovina declares independence" },
  { year: 1992, type: "rename", from: "Yugoslavia", to: "Serbia", color: "#a02828", spawnIfMissing: { lat: 44.8, lon: 20.46 }, message: "Yugoslavia officially reduced to Serbia and Montenegro - then just Serbia" },
  
  { year: 1993, type: "secede", target: "Czechoslovakia", civ: "Slovakia",
    spawn: { name: "Slovakia", lat: 48.15, lon: 17.11, color: "#3a4a8a" }, byOwner: "SLO",
    message: "Velvet Divorce - Slovakia separates from Czechoslovakia" },
  { year: 1993, type: "rename", from: "Czechoslovakia", to: "Czech Republic", color: "#a01818", spawnIfMissing: { lat: 50.08, lon: 14.43 }, message: "Velvet Divorce - Czechoslovakia renames to Czech Republic" },
  
  { year: 1206, civ: { name: "Mongols",     lat: 47,  lon: 106,  color: "#6a4a2a" }, message: "Genghis Khan unites the steppe" },
  { year: 1206, type: "goal", civ: "Mongols", region: { lat: [30, 55], lon: [40, 130] }, priority: 1.0, message: "Genghis Khan eyes the world from the steppe" },
  { year: 1299, civ: { name: "Ottomans",    lat: 40,  lon: 31,   color: "#1a4a2a" }, message: "Osman founds the Ottoman beylik" },
  { year: 1299, type: "goal", civ: "Ottomans", region: { lat: [22, 45], lon: [20, 50] }, priority: 0.9, message: "The Ottomans aim for Anatolia, the Levant, and the Balkans" },
  { year: 1453, type: "claim", civ: "Ottomans", region: { lat: [40, 42], lon: [28, 30] }, message: "The Ottomans take Constantinople" },

  { year: 1428, civ: { name: "Aztec",       lat: 19.4,lon: -99,  color: "#3aa9c4" }, replaces: "Maya", message: "The Aztec Triple Alliance is forged - Mesoamerican lineage continues" },
  { year: 1438, civ: { name: "Inca",        lat: -13.5,lon: -71.9,color: "#c44aa8" }, replaces: "Chavin", message: "Pachacuti founds the Inca Empire" },

  

  
  { year:  756, type: "secede", target: "Arabs", civ: "Emirate of Cordoba",
    spawn: { name: "Emirate of Cordoba", lat: 37.89, lon: -4.78, color: "#1a4a4a" },
    region: { lat: [36, 44], lon: [-10, 0] },
    message: "Abd al-Rahman I founds the Emirate of Cordoba - Iberia breaks from the Abbasids" },
  { year:  929, type: "rename", from: "Emirate of Cordoba", to: "Caliphate of Cordoba", color: "#3a6a3a", spawnIfMissing: { lat: 37.89, lon: -4.78 }, message: "Abd al-Rahman III proclaims the Caliphate of Cordoba" },
  
  { year: 1031, type: "secede", target: "Caliphate of Cordoba", civ: "Taifa of Seville",
    spawn: { name: "Taifa of Seville", lat: 37.39, lon: -5.99, color: "#2a8a4a" },
    region: { lat: [36.5, 38.5], lon: [-7, -4] },
    message: "Caliphate of Cordoba collapses - Taifa of Seville emerges" },
  { year: 1031, type: "secede", target: "Caliphate of Cordoba", civ: "Taifa of Toledo",
    spawn: { name: "Taifa of Toledo", lat: 39.86, lon: -4.02, color: "#3a8a8a" },
    region: { lat: [38.5, 41], lon: [-6, -2] },
    message: "Taifa of Toledo splits off after the fitna" },
  { year: 1031, type: "secede", target: "Caliphate of Cordoba", civ: "Taifa of Zaragoza",
    spawn: { name: "Taifa of Zaragoza", lat: 41.65, lon: -0.89, color: "#4a4a8a" },
    region: { lat: [40, 43], lon: [-2, 1] },
    message: "Taifa of Zaragoza splits off after the fitna" },
  { year: 1031, type: "secede", target: "Caliphate of Cordoba", civ: "Taifa of Granada",
    spawn: { name: "Taifa of Granada", lat: 37.18, lon: -3.60, color: "#7a3a4a" },
    region: { lat: [36, 38], lon: [-4, -2] },
    message: "Taifa of Granada splits off after the fitna" },
  { year: 1031, type: "rename", from: "Caliphate of Cordoba", to: "Taifa of Cordoba", color: "#5a4a3a", spawnIfMissing: { lat: 37.89, lon: -4.78 }, message: "Caliphate dissolved - what remains is the Taifa of Cordoba" },
  
  { year: 1085, type: "absorb", absorber: "Kingdom of Castile", target: "Taifa of Toledo", message: "Toledo falls to Alfonso VI - the Taifa is no more" },
  
  { year: 1086, type: "secede", target: "Berbers", civ: "Almoravid Empire",
    spawn: { name: "Almoravid Empire", lat: 31.63, lon: -7.99, color: "#a05a2a" },
    region: { lat: [27, 33], lon: [-12, -3] },
    message: "Almoravid sultans rise in Marrakesh - they cross to Iberia after Sagrajas" },
  { year: 1094, type: "absorb", absorber: "Almoravid Empire", target: "Taifa of Cordoba", message: "Almoravids unify Iberian Muslims - Taifa of Cordoba absorbed" },
  { year: 1094, type: "absorb", absorber: "Almoravid Empire", target: "Taifa of Seville", message: "Almoravids unify Iberian Muslims - Taifa of Seville absorbed" },
  { year: 1110, type: "absorb", absorber: "Almoravid Empire", target: "Taifa of Granada", message: "Almoravids unify Iberian Muslims - Taifa of Granada absorbed" },
  { year: 1110, type: "absorb", absorber: "Almoravid Empire", target: "Taifa of Zaragoza", message: "Almoravids unify Iberian Muslims - Taifa of Zaragoza absorbed" },
  
  { year: 1147, type: "rename", from: "Almoravid Empire", to: "Almohad Caliphate", color: "#7a3030", spawnIfMissing: { lat: 31.63, lon: -7.99 }, message: "Almohads overthrow the Almoravids - reformist Berber caliphate rises" },
  
  { year: 1232, type: "secede", target: "Almohad Caliphate", civ: "Emirate of Granada",
    spawn: { name: "Emirate of Granada", lat: 37.18, lon: -3.60, color: "#9a3a3a" },
    region: { lat: [36, 38], lon: [-5, -2] },
    message: "Nasrid dynasty founded - Emirate of Granada is the last Muslim state in Iberia" },
  { year: 1269, type: "absorb", absorber: "Morocco", target: "Almohad Caliphate", message: "Marinids overthrow the last Almohads - the Berber empire fragments" },
  
  { year: 1492, type: "absorb", absorber: "Kingdom of Castile", target: "Emirate of Granada", message: "Boabdil surrenders Granada to the Catholic Monarchs - the Reconquista is complete" },

  { year: 1037, type: "rename", from: "Iberians", to: "Kingdom of Castile", color: "#c89640", spawnIfMissing: { lat: 40.4, lon: -3.7 }, message: "Kingdom of Castile emerges from the Christian Reconquista" },

  
  { year: 1037, type: "claim", civ: "Kingdom of Castile", region: { lat: [42, 44], lon: [-9, -2] }, message: "Reconquista begins - Christian kingdoms push south from the Cantabrian mountains" },
  { year: 1085, type: "claim", civ: "Kingdom of Castile", region: { lat: [40, 43], lon: [-9, -1] }, message: "Toledo falls to Castile - the Reconquista accelerates" },
  { year: 1212, type: "claim", civ: "Kingdom of Castile", region: { lat: [38, 42], lon: [-9, 0] }, message: "Battle of Las Navas de Tolosa - Christian alliance crushes the Almohads" },
  { year: 1212, type: "claim", civ: "Kingdom of Portugal", region: { lat: [37, 42], lon: [-10, -7] }, message: "Portugal completes its share of the Reconquista" },
  { year: 1248, type: "claim", civ: "Kingdom of Castile", region: { lat: [36.5, 39], lon: [-7, 0] }, message: "Ferdinand III takes Seville - only Granada remains Muslim" },
  { year: 1492, type: "claim", civ: "Kingdom of Castile", region: { lat: [36, 38], lon: [-6, -1] }, message: "Granada falls to Castile - the Reconquista is complete" },
  
  { year: 1139, type: "secede", target: "Kingdom of Castile", civ: "Kingdom of Portugal",
    spawn: { name: "Kingdom of Portugal", lat: 38.7, lon: -9.1, color: "#0a6b3a" },
    region: { lat: [37, 42.2], lon: [-9.6, -6.2] },
    message: "Afonso I declares the Kingdom of Portugal independent of Castile" },
  
  { year: 1492, type: "rename", from: "Kingdom of Castile", to: "Kingdom of Spain", color: "#e0c060", spawnIfMissing: { lat: 40.4, lon: -3.7 }, message: "Reconquista complete - Kingdom of Spain forms; Columbus reaches the Americas" },
  
  { year: 1521, type: "absorb", absorber: "Kingdom of Spain", target: "Aztec", message: "Cortés conquers Tenochtitlan - Aztec Empire falls to Spain" },
  { year: 1533, type: "absorb", absorber: "Kingdom of Spain", target: "Inca",  message: "Pizarro captures Atahualpa - Inca Empire falls to Spain" },
  { year: 1500, civ: { name: "Muscovy",     lat: 56,  lon: 38,   color: "#5a7ab5" }, replaces: "East Slavs", message: "Muscovy throws off the Mongol yoke" },
  { year: 1547, type: "rename", from: "Muscovy", to: "Tsardom of Russia", color: "#3d6cc4", message: "Ivan IV crowned Tsar of all Rus'" },
  { year: 1721, type: "rename", from: "Tsardom of Russia", to: "Russian Empire", color: "#1a4ba8", message: "Peter the Great proclaims the Russian Empire" },

  

  

  { year: 1582, type: "claim", civ: "Tsardom of Russia", byOwner: "SOV",
    region: { lat: [50, 72], lon: [50, 70] },
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Yermak crosses the Urals - Russia begins its eastward expansion" },
  
  { year: 1640, type: "claim", civ: "Tsardom of Russia", byOwner: "SOV",
    region: { lat: [50, 75], lon: [70, 110] },
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Russian Cossacks push deep into central Siberia" },
  
  { year: 1689, type: "claim", civ: "Tsardom of Russia", byOwner: "SOV",
    region: { lat: [50, 75], lon: [110, 160] },
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Treaty of Nerchinsk - Russia secures eastern Siberia up to the Amur" },

  { year: 1750, type: "claim", civ: "Russian Empire", byOwner: "SOV",
    region: { lat: [40, 55], lon: [50, 90] },
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Russia annexes the Kazakh and Bashkir steppes" },

  { year: 1860, type: "claim", civ: "Russian Empire", byOwner: "SOV",
    region: { lat: [40, 75], lon: [115, 180] },
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Treaty of Aigun/Beijing - Russia takes the Amur basin and the Pacific coast" },
  
  { year: 1900, type: "claim", civ: "Russian Empire", byOwner: "SOV",
    except: ["Polish-Lithuanian Commonwealth", "Grand Duchy of Lithuania", "Mongols", "Golden Horde", "Yuan China", "Ilkhanate"],
    message: "Russia's eastward expansion is complete - the empire stretches from the Baltic to the Pacific" },
  { year: 1776, civ: { name: "USA",         lat: 39,  lon: -77,  color: "#5da9e8" }, message: "The Thirteen Colonies declare independence" },

  

  
  { year: 1783, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [24, 50], lon: [-82, -66] },
    message: "Treaty of Paris - Britain recognizes the original Thirteen States" },
  
  { year: 1803, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [28, 50], lon: [-104, -82] },
    message: "Louisiana Purchase - Jefferson doubles the size of the United States" },
  
  { year: 1819, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [24, 31], lon: [-88, -79] },
    message: "Adams-Onís Treaty - Spain cedes Florida to the United States" },
  
  { year: 1845, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [25, 37], lon: [-107, -93] },
    message: "Texas annexed - the Lone Star Republic joins the Union" },

  
  { year: 1846, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [42, 49], lon: [-125, -107] },
    message: "Oregon Treaty - the Pacific Northwest joins the United States" },
  
  { year: 1848, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [31, 42], lon: [-125, -103] },
    message: "Treaty of Guadalupe Hidalgo - Mexican Cession adds California, NM, and Arizona" },
  
  { year: 1867, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [51, 72], lon: [-180, -130] },
    message: "Alaska Purchase - Seward buys Alaska from Russia" },
  
  { year: 1900, type: "claim", civ: "USA", byOwner: "USA",
    message: "United States consolidates the entire continental and territorial USA into one federation" },
  { year: 1898, type: "claim", civ: "USA", byOwner: "USA",
    region: { lat: [17, 23], lon: [-160, -65] },
    message: "Hawaii annexed and Puerto Rico taken from Spain" },

  { year: 1810, type: "secede", target: "Kingdom of Spain", civ: "Argentina",
    spawn: { name: "Argentina", lat: -34.6, lon: -58.4, color: "#7ab5e8" }, byOwner: "ARG",
    message: "May Revolution: Argentina declares independence from Spain" },
  { year: 1810, type: "secede", target: "Kingdom of Spain", civ: "Chile",
    spawn: { name: "Chile", lat: -33.45, lon: -70.66, color: "#9a2828" }, byOwner: "CHL",
    message: "Chile begins its independence struggle from Spain" },
  { year: 1811, type: "secede", target: "Kingdom of Spain", civ: "Venezuela",
    spawn: { name: "Venezuela", lat: 10.5, lon: -66.9, color: "#d4a020" }, byOwner: "VEN",
    message: "Venezuela proclaims independence from Spain" },
  { year: 1811, type: "secede", target: "Kingdom of Spain", civ: "Paraguay",
    spawn: { name: "Paraguay", lat: -25.3, lon: -57.6, color: "#8a3a4a" }, byOwner: "PAR",
    message: "Paraguay declares independence from Spain" },
  { year: 1819, type: "secede", target: "Kingdom of Spain", civ: "Colombia",
    spawn: { name: "Colombia", lat: 4.7, lon: -74.1, color: "#f0d020" }, byOwner: "COL",
    message: "Battle of Boyacá - Gran Colombia secures independence from Spain" },
  { year: 1821, type: "secede", target: "Kingdom of Spain", civ: "Mexico", spawn: { name: "Mexico", lat: 19, lon: -99, color: "#26823f" }, byOwner: "MEX", message: "Mexico declares independence from Spain" },
  { year: 1821, type: "secede", target: "Kingdom of Spain", civ: "Peru",
    spawn: { name: "Peru", lat: -12.05, lon: -77.05, color: "#c83030" }, byOwner: "PRU",
    message: "San Martín proclaims Peruvian independence from Spain" },
  { year: 1822, type: "secede", target: "Kingdom of Spain", civ: "Ecuador",
    spawn: { name: "Ecuador", lat: -0.18, lon: -78.5, color: "#f0c020" }, byOwner: "ECU",
    message: "Battle of Pichincha - Ecuador secures independence from Spain" },
  { year: 1822, civ: { name: "Brazil",      lat: -15, lon: -47,  color: "#3a8a3a" }, message: "Brazil declares independence from Portugal" },
  { year: 1825, type: "secede", target: "Kingdom of Spain", civ: "Bolivia",
    spawn: { name: "Bolivia", lat: -16.5, lon: -68.15, color: "#3a7a3a" }, byOwner: "BOL",
    message: "Sucre defeats the last royalist stronghold - Bolivia is born" },
  { year: 1828, type: "secede", target: "Brazil", civ: "Uruguay",
    spawn: { name: "Uruguay", lat: -34.9, lon: -56.2, color: "#5da9e8" }, byOwner: "URG",
    message: "Cisplatine War ends - Uruguay independent of Brazil" },

  { year: 1804, type: "secede", target: "Kingdom of France", civ: "Haiti",
    spawn: { name: "Haiti", lat: 18.54, lon: -72.34, color: "#c8302a" }, byOwner: "HAI",
    message: "Haitian Revolution succeeds - Haiti becomes the first independent Black republic" },

  { year: 1821, type: "secede", target: "Kingdom of Spain", civ: "Central America",
    spawn: { name: "Central America", lat: 14.6, lon: -90.5, color: "#3a6ad8" },
    region: { lat: [8, 18], lon: [-92, -83] },
    message: "Federal Republic of Central America breaks from Spain" },
  
  { year: 1838, type: "secede", target: "Central America", civ: "Guatemala",
    spawn: { name: "Guatemala", lat: 14.63, lon: -90.51, color: "#3a8aff" }, byOwner: "GUA",
    message: "Guatemala secedes from the Central American Federation" },
  { year: 1838, type: "secede", target: "Central America", civ: "Honduras",
    spawn: { name: "Honduras", lat: 14.07, lon: -87.19, color: "#0066cc" }, byOwner: "HON",
    message: "Honduras secedes from the Central American Federation" },
  { year: 1838, type: "secede", target: "Central America", civ: "Nicaragua",
    spawn: { name: "Nicaragua", lat: 12.13, lon: -86.27, color: "#005ec0" }, byOwner: "NIC",
    message: "Nicaragua secedes from the Central American Federation" },
  { year: 1838, type: "secede", target: "Central America", civ: "Costa Rica",
    spawn: { name: "Costa Rica", lat: 9.93, lon: -84.08, color: "#1a4ba8" }, byOwner: "COS",
    message: "Costa Rica secedes from the Central American Federation" },
  { year: 1841, type: "rename", from: "Central America", to: "El Salvador", color: "#1a4080",
    spawnIfMissing: { lat: 13.69, lon: -89.19 },
    message: "El Salvador becomes the last Central American republic standing alone" },
  
  { year: 1844, type: "secede", target: "Haiti", civ: "Dominican Republic",
    spawn: { name: "Dominican Republic", lat: 18.47, lon: -69.91, color: "#c64a40" }, byOwner: "DOM",
    message: "Dominican Republic declares independence from Haiti" },
  
  { year: 1867, type: "secede", target: "United Kingdom", civ: "Canada",
    spawn: { name: "Canada", lat: 45.42, lon: -75.7, color: "#c83030" }, byOwner: "CAN",
    message: "Canadian Confederation - the Dominion of Canada is formed" },
  
  { year: 1901, type: "secede", target: "United Kingdom", civ: "Australia",
    spawn: { name: "Australia", lat: -35.28, lon: 149.13, color: "#1a4ba8" }, byOwner: "AST",
    message: "Australian Federation - the Commonwealth of Australia is born" },
  
  { year: 1907, type: "secede", target: "United Kingdom", civ: "New Zealand",
    spawn: { name: "New Zealand", lat: -41.29, lon: 174.78, color: "#2c2c2c" }, byOwner: "NZL",
    message: "New Zealand becomes a Dominion of the British Empire" },
  
  { year: 1975, type: "secede", target: "Australia", civ: "Papua New Guinea",
    spawn: { name: "Papua New Guinea", lat: -9.44, lon: 147.18, color: "#a02828" }, byOwner: "PNG",
    message: "Papua New Guinea gains independence from Australia" },
  
  { year: 1902, type: "secede", target: "Kingdom of Spain", civ: "Cuba",
    spawn: { name: "Cuba", lat: 23.13, lon: -82.36, color: "#1a4ba8" }, byOwner: "CUB",
    message: "Republic of Cuba is established under US oversight" },
  
  { year: 1903, type: "secede", target: "Colombia", civ: "Panama",
    spawn: { name: "Panama", lat: 8.98, lon: -79.52, color: "#1a3a8a" }, byOwner: "PAN",
    message: "Panama secedes from Colombia - Canal construction begins" },
  
  { year: 1962, type: "secede", target: "United Kingdom", civ: "Jamaica",
    spawn: { name: "Jamaica", lat: 18.01, lon: -76.79, color: "#1a8a4a" }, byOwner: "JAM",
    message: "Jamaica gains independence from the United Kingdom" },
  
  { year: 1981, type: "secede", target: "United Kingdom", civ: "Belize",
    spawn: { name: "Belize", lat: 17.5, lon: -88.2, color: "#1a4a3a" }, byOwner: "BLZ",
    message: "Belize gains independence from the United Kingdom" },
  
  { year: 1821, type: "secede", target: "Ottomans", civ: "Greece", spawn: { name: "Greece", lat: 38, lon: 23, color: "#3a6ad8" }, byOwner: "GRE", message: "Greek War of Independence - Greece secedes from the Ottomans" },
  
  { year: 1830, type: "secede", target: "France", civ: "Belgium", spawn: { name: "Belgium", lat: 50.8, lon: 4.4, color: "#ffd24a" }, byOwner: "BEL", message: "Belgium gains independence" },
  
  { year: 1817, type: "secede", target: "Ottomans", civ: "Serbia",
    spawn: { name: "Serbia", lat: 44.8, lon: 20.46, color: "#c83030" }, byOwner: "SER",
    message: "Second Serbian Uprising - Serbia gains autonomy from the Ottomans" },
  { year: 1878, type: "secede", target: "Ottomans", civ: "Romania",
    spawn: { name: "Romania", lat: 44.43, lon: 26.1, color: "#3a4a8a" }, byOwner: "ROM",
    message: "Treaty of Berlin - Romania gains full independence from the Ottomans" },
  { year: 1878, type: "secede", target: "Ottomans", civ: "Bulgaria",
    spawn: { name: "Bulgaria", lat: 42.7, lon: 23.3, color: "#3a8a4a" }, byOwner: "BUL",
    message: "Treaty of Berlin - Bulgaria becomes a principality, free of the Ottomans" },
  
  { year: 1867, civ: { name: "Austria-Hungary", lat: 47.5, lon: 14, color: "#c83030" }, message: "Compromise of 1867: the Austro-Hungarian Dual Monarchy is formed" },
  
  { year: 1867, type: "claim", civ: "Austria-Hungary", region: { lat: [44, 51], lon: [9, 27] }, message: "Austria-Hungary consolidates its dual monarchy across central Europe" },
  
  { year: 1918, type: "secede", target: "Austria-Hungary", civ: "Austria",
    spawn: { name: "Austria", lat: 48.21, lon: 16.37, color: "#a01818" }, byOwner: "AUS",
    message: "Austria-Hungary dissolves - the Republic of Austria proclaims itself in Vienna" },
  { year: 1918, type: "secede", target: "Austria-Hungary", civ: "Hungary",
    spawn: { name: "Hungary", lat: 47.5, lon: 19.04, color: "#3a8a4a" }, byOwner: "HUN",
    message: "Hungarian Republic declared in Budapest - the dual monarchy is finished" },
  { year: 1918, type: "secede", target: "Austria-Hungary", civ: "Czechoslovakia",
    spawn: { name: "Czechoslovakia", lat: 50.08, lon: 14.43, color: "#1a4a8a" }, byOwner: "CZE",
    message: "Czechoslovakia proclaims independence in Prague" },
  { year: 1918, type: "secede", target: "Austria-Hungary", civ: "Yugoslavia",
    spawn: { name: "Yugoslavia", lat: 44.8, lon: 20.46, color: "#2a4a8a" }, byOwner: "YUG",
    message: "Kingdom of Serbs, Croats and Slovenes formed - the seed of Yugoslavia" },
  
  { year: 1918, type: "absorb", absorber: "Yugoslavia", target: "Serbia", message: "Serbia merges into the Kingdom of Serbs, Croats and Slovenes" },
  
  { year: 1923, type: "rename", from: "Ottomans", to: "Turkey", color: "#c81818", message: "Atatürk founds the Republic of Turkey - the Ottoman Empire is no more" },
  { year: 1920, type: "secede", target: "Ottomans", civ: "Saudi Arabia",
    spawn: { name: "Saudi Arabia", lat: 24.7, lon: 46.7, color: "#1a5a3a" }, byOwner: "SAU",
    message: "Ibn Saud begins consolidating the Arabian peninsula - the seed of Saudi Arabia" },
  { year: 1920, type: "secede", target: "Ottomans", civ: "British Mandate of Iraq",
    spawn: { name: "British Mandate of Iraq", lat: 33.3, lon: 44.4, color: "#9a6a3a" }, byOwner: "IRQ",
    message: "League of Nations grants Britain the Mandate for Mesopotamia (Iraq)" },
  { year: 1920, type: "secede", target: "Ottomans", civ: "French Mandate of Syria",
    spawn: { name: "French Mandate of Syria", lat: 33.5, lon: 36.3, color: "#6a5a8a" }, byOwner: "SYR",
    message: "France takes the Mandate for Syria & Lebanon" },
  
  { year: 1932, type: "rename", from: "Saudi Arabia", to: "Kingdom of Saudi Arabia", color: "#1a6a3a", message: "Kingdom of Saudi Arabia proclaimed by Ibn Saud" },
  
  { year: 1932, type: "rename", from: "British Mandate of Iraq", to: "Kingdom of Iraq", color: "#a04030", message: "Iraq independent of the British Mandate - Kingdom of Iraq formed" },
  
  { year: 1946, type: "rename", from: "French Mandate of Syria", to: "Syria", color: "#3a4a6a", message: "Syria gains independence from France" },
  
  { year: 1861, type: "secede", target: "USA", civ: "Confederate States", spawn: { lat: 33, lon: -84, color: "#7a5030" }, region: { lat: [25, 38], lon: [-105, -75] }, message: "American Civil War begins - Confederate States secede" },
  { year: 1861, type: "barbarossa", a: "USA", b: "Confederate States", message: "Open war between Union and Confederacy" },
  { year: 1861, type: "wartime", on: true, message: "American Civil War - wartime aggression unlocked" },
  { year: 1865, type: "absorb", absorber: "USA", target: "Confederate States", message: "Confederacy defeated - Lee surrenders at Appomattox" },
  { year: 1865, type: "wartime", on: false, message: "American Civil War ends" },

  { year:  843, type: "rename", from: "Carolingian Empire", to: "Kingdom of France", color: "#4a6ae8", message: "Treaty of Verdun: Carolingian Empire splits - West Francia → Kingdom of France" },
  
  { year:  962, civ: { name: "Holy Roman Empire", lat: 50, lon: 11, color: "#e8b020" }, message: "Otto I crowned - Holy Roman Empire begins" },

  
  { year:  962, type: "claim", civ: "Holy Roman Empire",
    byOwner: ["GER", "AUS", "CZE", "SWI", "LUX", "HOL", "BEL", "DEN"],
    message: "Otto I's Holy Roman Empire spans the German, Italian and Burgundian kingdoms" },

  { year:  793, type: "rename", from: "Norse", to: "Vikings", color: "#1a3a6a", spawnIfMissing: { lat: 60, lon: 16 }, message: "Lindisfarne raid - the Viking Age begins" },
  
  { year: 1397, type: "rename", from: "Vikings", to: "Kalmar Union", color: "#c8302a", spawnIfMissing: { lat: 60, lon: 16 }, message: "Margaret I forges the Kalmar Union of Denmark, Norway and Sweden" },

  
  
  { year: 1397, type: "claim", civ: "Kalmar Union", byOwner: "DEN", message: "Denmark unified into the Kalmar Union" },
  { year: 1397, type: "claim", civ: "Kalmar Union", byOwner: "NOR", message: "Norway unified into the Kalmar Union" },
  { year: 1397, type: "claim", civ: "Kalmar Union", byOwner: "SWE", message: "Sweden unified into the Kalmar Union" },
  { year: 1397, type: "claim", civ: "Kalmar Union", byOwner: "FIN", message: "Finland unified under the Kalmar Union" },
  
  { year: 1523, type: "secede", target: "Kalmar Union", civ: "Sweden",
    spawn: { name: "Sweden", lat: 59.33, lon: 18.07, color: "#2c6db0" }, byOwner: "SWE",
    message: "Gustav Vasa is crowned - Sweden secedes from the Kalmar Union" },
  
  { year: 1523, type: "claim", civ: "Sweden", byOwner: "FIN",
    message: "Sweden's grip on Finland - Finland remains under the Swedish crown" },
  
  { year: 1523, type: "rename", from: "Kalmar Union", to: "Denmark-Norway", color: "#c20020", spawnIfMissing: { lat: 55.68, lon: 12.57 }, message: "What remains of the Kalmar Union becomes Denmark-Norway" },

  { year: 1809, type: "secede", target: "Sweden", civ: "Russian Empire",
    byOwner: "FIN",
    message: "Finnish War - Russia annexes Finland from Sweden as the Grand Duchy" },

  

  { year: 1814, type: "claim", civ: "Sweden", byOwner: "NOR", message: "Sweden gains Norway under the Treaty of Kiel" },
  { year: 1814, type: "rename", from: "Denmark-Norway", to: "Denmark", color: "#c20020", spawnIfMissing: { lat: 55.68, lon: 12.57 }, message: "Treaty of Kiel - Norway leaves the Danish crown for Sweden" },
  
  { year: 1905, type: "secede", target: "Sweden", civ: "Norway",
    spawn: { name: "Norway", lat: 59.91, lon: 10.75, color: "#a01818" }, byOwner: "NOR",
    message: "Dissolution of the Swedish-Norwegian union - Norway is sovereign" },
  
  { year: 1917, type: "secede", target: "Russian Empire", civ: "Finland",
    spawn: { name: "Finland", lat: 60.17, lon: 24.94, color: "#7ec0ee" }, byOwner: "FIN",
    message: "Finland declares independence from a collapsing Russia" },
  
  { year: 1099, civ: { name: "Kingdom of Jerusalem", lat: 31.8, lon: 35.2, color: "#f0e6cc" }, message: "First Crusade succeeds - Kingdom of Jerusalem founded" },
  
  { year: 1230, civ: { name: "Mali Empire", lat: 13.4, lon: -8.0, color: "#e8c020" }, message: "Sundiata founds the Mali Empire" },
  
  { year: 1240, type: "secede", target: "Mongols", civ: "Golden Horde",     spawn: { name: "Golden Horde",     lat: 48, lon: 50,  color: "#d8c040" }, region: { lat: [44, 56], lon: [38, 75] },  message: "Mongol fragmentation: Golden Horde rises in the western steppe" },
  { year: 1271, type: "secede", target: "Mongols", civ: "Yuan China",       spawn: { name: "Yuan China",       lat: 39.9, lon: 116, color: "#d83030" }, region: { lat: [22, 50], lon: [98, 130] }, message: "Kublai Khan founds the Yuan dynasty in China" },
  { year: 1256, type: "secede", target: "Mongols", civ: "Ilkhanate",        spawn: { name: "Ilkhanate",        lat: 35, lon: 53,  color: "#a05a30" }, region: { lat: [28, 42], lon: [40, 65] },  message: "Hulagu founds the Ilkhanate (Persia & the Levant)" },
  
  { year: 1368, type: "rename", from: "Yuan China", to: "Ming China", color: "#e84a4a", message: "Zhu Yuanzhang founds the Ming Dynasty - Yuan expelled" },
  { year: 1644, type: "rename", from: "Ming China", to: "Qing China", color: "#a02828", message: "Manchu conquest - the Qing Dynasty rules China" },
  { year: 1912, type: "rename", from: "Qing China", to: "Republic of China", color: "#a06030", message: "Xinhai Revolution - Qing falls, Republic of China is born" },

  { year: 1526, civ: { name: "Mughal Empire", lat: 28.6, lon: 77.2, color: "#80a040" }, message: "Babur founds the Mughal Empire in northern India" },
  
  { year: 1581, type: "secede", target: "Kingdom of Spain", civ: "Dutch Republic", spawn: { name: "Dutch Republic", lat: 52.4, lon: 4.9, color: "#ff8c00" }, region: { lat: [50.5, 53.6], lon: [3, 7] }, message: "Act of Abjuration - Dutch Republic declares independence from Spain" },
  
  { year: 1701, civ: { name: "Kingdom of Prussia", lat: 52.5, lon: 13.4, color: "#202020" }, message: "Frederick I crowned - Kingdom of Prussia formed" },
  { year: 1871, type: "absorb", absorber: "Germany", target: "Kingdom of Prussia", message: "Prussia leads German unification - absorbed into the German Empire" },
  { year: 1804, type: "rename", from: "Kingdom of France", to: "France", color: "#3a5ad8", message: "Napoleon proclaims the French Empire" },

  
  { year: 1805, type: "war", a: "France", b: "Austria-Hungary", region: { lat: [46, 50], lon: [11, 18] }, reinforce: 12, message: "War of the Third Coalition - Napoleon crushes the Austrians at Austerlitz" },
  { year: 1806, type: "war", a: "France", b: "Kingdom of Prussia", region: { lat: [50, 55], lon: [10, 22] }, reinforce: 14, message: "War of the Fourth Coalition - Napoleon shatters Prussia at Jena-Auerstedt" },
  { year: 1807, type: "claim", civ: "France", region: { lat: [48, 55], lon: [4, 16] }, message: "Treaty of Tilsit - France dominates the German states" },
  { year: 1808, type: "war", a: "France", b: "Kingdom of Spain", region: { lat: [36, 44], lon: [-9, 3] }, reinforce: 12, message: "Peninsular War - Napoleon installs his brother on the Spanish throne" },
  { year: 1809, type: "war", a: "France", b: "Austria-Hungary", region: { lat: [46, 50], lon: [11, 18] }, reinforce: 10, message: "War of the Fifth Coalition - Wagram, the Austrian Empire bends" },
  { year: 1810, type: "claim", civ: "France", region: { lat: [40, 53], lon: [-3, 14] }, message: "Napoleon at his peak - the French Empire spans most of Western Europe" },
  
  { year: 1813, type: "war", a: "Kingdom of Prussia", b: "France", region: { lat: [48, 53], lon: [6, 15] }, reinforce: 14, message: "Battle of the Nations (Leipzig) - the Sixth Coalition shatters Napoleon's army" },
  
  { year: 1814, type: "rename", from: "France", to: "Kingdom of France", color: "#4a6ae8", spawnIfMissing: { lat: 48.86, lon: 2.35 }, message: "Napoleon abdicates - the Bourbon Restoration brings Louis XVIII to the throne" },
  
  { year: 1815, type: "war", a: "United Kingdom", b: "Kingdom of France", region: { lat: [49, 52], lon: [3, 6] }, reinforce: 12, message: "Hundred Days - Napoleon returns from Elba but loses at Waterloo" },

  

  
  
  { year: 1356, type: "secede", target: "Holy Roman Empire", civ: "Bavaria",
    spawn: { name: "Bavaria", lat: 48.14, lon: 11.58, color: "#3a8ad8" },
    region: { lat: [47, 50], lon: [10, 14] }, byOwner: "BAY",
    message: "Golden Bull of 1356 codifies the prince-electors - Bavaria emerges as a major HRE state" },
  { year: 1356, type: "secede", target: "Holy Roman Empire", civ: "Saxony",
    spawn: { name: "Saxony", lat: 51.05, lon: 13.74, color: "#7a9a3a" },
    region: { lat: [50, 52], lon: [11, 15] }, byOwner: "SAX",
    message: "Saxony confirmed as a prince-electorate of the HRE" },
  { year: 1415, type: "secede", target: "Holy Roman Empire", civ: "Brandenburg",
    spawn: { name: "Brandenburg", lat: 52.41, lon: 12.55, color: "#1a3a4a" },
    region: { lat: [52, 53.5], lon: [11, 16] }, byOwner: "BRA",
    message: "Hohenzollerns granted Brandenburg - the seed of future Prussia" },
  { year: 1495, type: "secede", target: "Holy Roman Empire", civ: "Württemberg",
    spawn: { name: "Württemberg", lat: 48.77, lon: 9.18, color: "#a02828" },
    region: { lat: [48, 50], lon: [8, 10] },
    message: "Württemberg elevated to a duchy in the HRE" },
  { year: 1714, type: "secede", target: "Holy Roman Empire", civ: "Hannover",
    spawn: { name: "Hannover", lat: 52.37, lon: 9.74, color: "#9a6a3a" },
    region: { lat: [51, 54], lon: [7, 11] },
    message: "Personal union with Britain - Electorate of Hannover gains prominence" },
  
  { year: 1701, type: "rename", from: "Brandenburg", to: "Kingdom of Prussia", color: "#202020", spawnIfMissing: { lat: 52.5, lon: 13.4 }, message: "Frederick I crowned in Königsberg - Brandenburg becomes the Kingdom of Prussia" },

  { year: 1701, type: "claim", civ: "Kingdom of Prussia", byOwner: "PRE", message: "Prussia consolidates its kingdom (Brandenburg, Pomerania, East Prussia incl. Königsberg)" },

  
  
  { year: 1806, type: "absorb", absorber: "Kingdom of Prussia", target: "Hannover", message: "Napoleon's reorganization - Hannover folded into the new German order" },
  { year: 1806, type: "absorb", absorber: "Bavaria", target: "Württemberg", message: "Napoleon's reorganization - Württemberg confirmed as a kingdom under Bavarian regional dominance" },
  
  { year: 1871, type: "absorb", absorber: "Germany", target: "Bavaria", message: "Bavaria joins the German Empire" },
  { year: 1871, type: "absorb", absorber: "Germany", target: "Saxony", message: "Saxony joins the German Empire" },
  { year: 1871, civ: { name: "Germany",     lat: 52,  lon: 13,   color: "#3a3a3a" }, replaces: "Germans", message: "Germany unified under Bismarck" },
  { year: 1861, civ: { name: "Italy",       lat: 42,  lon: 12.5, color: "#10c450" }, replaces: "Etruscans", message: "Italy unified under Garibaldi & Cavour" },
  
  { year: 1917, type: "secede", target: "Russian Empire", civ: "White Movement", spawn: { name: "White Movement", lat: 47, lon: 39, color: "#e8e8e8" }, region: { lat: [44, 56], lon: [35, 60] }, message: "Russian Civil War: counter-revolutionary White armies rise" },
  { year: 1917, type: "wartime", on: true, message: "Russian Revolution - Reds vs Whites" },
  { year: 1922, type: "absorb", absorber: "Russian Empire", target: "White Movement", message: "Bolsheviks crush the White Movement" },
  { year: 1922, type: "wartime", on: false, message: "Russian Civil War ends" },
  { year: 1922, type: "rename", from: "Russian Empire", to: "Soviet Union", color: "#c81818", message: "The Soviet Union forms" },
  { year: 1991, type: "rename", from: "Soviet Union", to: "Russia", color: "#2855c2", message: "The Soviet Union dissolves" },
];

function latLonToTile(lat, lon) {
  const col = Math.floor((lon + 180) / 360 * COLS);
  
  const clampedLat = Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat));
  const row = Math.floor((LAT_TOP - clampedLat) / LAT_SPAN * ROWS);
  return { col: ((col % COLS) + COLS) % COLS, row: Math.max(0, Math.min(ROWS - 1, row)) };
}

function nearestLand(col, row, civ) {
  const ok = (b) => civ && civ.aquaticOnly ? (b === "ocean") : PASSABLE(b);
  if (ok(MAP[row][col])) return { col, row };
  for (let radius = 1; radius < 14; radius++) {
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        if (Math.abs(dr) !== radius && Math.abs(dc) !== radius) continue;
        const r = row + dr;
        if (r < 0 || r >= ROWS) continue;
        const c = ((col + dc) % COLS + COLS) % COLS;
        if (ok(MAP[r][c])) return { col: c, row: r };
      }
    }
  }
  return { col, row };
}

const state = {
  year: START_YEAR,
  turn: 0,
  civs: [],            
  selectedTile: null,  
  moveMode: null,      
  log: [],             
  phase: "menu",       
  ownership: null,     
  hoverTile: null,
  speed: 0,            
  lastTickAt: 0,       
  debug: false,        
  selectedProvince: 0, 
  selectedState: 0,    
  isWartime: false,    

  
  
  factions: [],

  

  frontlineEnemies: new Set(),
  frontlineSelecting: false,
  frontlinePush: false,

  

  
  consoleKilledLineages: new Set(),
  
  provinceStatus: "loading",
};

const TREE_PARENT_OVERRIDES = {
  
  "Republic of Latvia": "Balts",
  "Livonian Order": "Balts",
  "Republic of Lithuania": "Grand Duchy of Lithuania",

  
  "Republic of Poland": "Kingdom of Poland",

  
  "Ukraine": "East Slavs",
  "Belarus": "East Slavs",

  "Republic of Estonia": "Finns",
  "Finland": "Finns",

  "West Germany": "Germany",
  "East Germany": "Germany",
  
  "USA": "Great Britain",
  "Mexico": "Aztec",
};

const SAME_IDENTITY_OVERRIDES = new Set([
  "Republic of Lithuania",
  "Republic of Poland",
]);

if (typeof window !== "undefined") {
  window.TREE_PARENT_OVERRIDES = TREE_PARENT_OVERRIDES;
  window.SAME_IDENTITY_OVERRIDES = SAME_IDENTITY_OVERRIDES;
}

function yearToEra(year) {
  if (typeof ERAS === "undefined") return 0;
  let era = 0;
  for (let i = 0; i < ERAS.length; i++) {
    if (year >= ERAS[i].yearGuide) era = i;
  }
  return era;
}

function findFactionForCiv(civId) {
  if (!state.factions || state.factions.length === 0) return null;
  for (const f of state.factions) {
    if (f.memberIds && f.memberIds.indexOf(civId) >= 0) return f;
  }
  return null;
}

let _lineageRenameTo = null;
function getLineageRenameTo() {
  if (_lineageRenameTo) return _lineageRenameTo;
  const renameTo = {};
  if (typeof HISTORICAL_EVENTS === "undefined") { _lineageRenameTo = renameTo; return renameTo; }
  function add(from, to) {
    if (!from || !to || from === to) return;
    if (!renameTo[from]) renameTo[from] = [];
    if (renameTo[from].indexOf(to) < 0) renameTo[from].push(to);
  }
  for (const e of HISTORICAL_EVENTS) {
    if (e.type === "rename" && e.from && e.to) {
      add(e.from, e.to);
    } else if (!e.type && e.civ && e.replaces) {
      add(e.replaces, e.civ.name || (typeof e.civ === "string" ? e.civ : null));
    } else if (e.type === "merge" && Array.isArray(e.from) && e.to && e.to.name) {
      
      for (const f of e.from) add(f, e.to.name);
    } else if (e.type === "secede" && e.target && e.civ) {

      
      
      const childName = typeof e.civ === "string" ? e.civ : (e.civ && e.civ.name);
      if (childName && !TREE_PARENT_OVERRIDES[childName]) {
        add(e.target, childName);
      }
    }
  }

  
  for (const [child, parent] of Object.entries(TREE_PARENT_OVERRIDES)) {
    add(parent, child);
  }
  _lineageRenameTo = renameTo;
  return renameTo;
}

function walkLineageForward(rootName) {
  const renameTo = getLineageRenameTo();
  const visited = new Set();
  const queue = [rootName];
  while (queue.length) {
    const n = queue.shift();
    if (visited.has(n)) continue;
    visited.add(n);
    const next = renameTo[n] || [];
    for (const x of next) queue.push(x);
  }
  return visited;
}

function markLineageKilled(name) {
  if (!name) return;
  if (!state.consoleKilledLineages) state.consoleKilledLineages = new Set();
  
  const lower = name.toLowerCase();
  let canonical = name;
  if (typeof HISTORICAL_EVENTS !== "undefined") {
    for (const e of HISTORICAL_EVENTS) {
      const candidates = [];
      if (e.civ && typeof e.civ === "object" && e.civ.name) candidates.push(e.civ.name);
      if (e.from && typeof e.from === "string") candidates.push(e.from);
      if (Array.isArray(e.from)) candidates.push(...e.from);
      if (e.to && typeof e.to === "string") candidates.push(e.to);
      if (e.to && typeof e.to === "object" && e.to.name) candidates.push(e.to.name);
      if (e.replaces) candidates.push(e.replaces);
      if (e.target) candidates.push(e.target);
      if (e.absorber) candidates.push(e.absorber);
      const found = candidates.find(c => c && c.toLowerCase() === lower);
      if (found) { canonical = found; break; }
    }
  }
  for (const n of walkLineageForward(canonical)) {
    state.consoleKilledLineages.add(n.toLowerCase());
  }
}

function updateProvinceStatusOverlay() {
  const el = document.getElementById("province-status");
  if (!el) return;
  const detail = document.getElementById("ps-detail");
  if (state.provinceStatus === "ready") {
    el.classList.add("hidden");
    el.classList.remove("failed");
  } else if (state.provinceStatus === "loading") {
    el.classList.remove("hidden");
    el.classList.remove("failed");
    detail.textContent = "Fetching map/provinces.bmp (~34 MB) and map/definition.csv …";
    el.querySelector(".ps-title").textContent = "Loading HOI4 province grid…";
  } else {
    
    const reason = state.provinceStatus.startsWith("failed:")
      ? state.provinceStatus.substring(7)
      : "unknown";
    el.classList.remove("hidden");
    el.classList.add("failed");
    el.querySelector(".ps-title").textContent = "Province grid failed to load";
    detail.textContent =
      "Reason:\n  " + reason + "\n\n" +
      "Required files (must be served via the local server):\n" +
      "  • map/provinces.bmp\n" +
      "  • map/definition.csv\n\n" +
      "Open via http://localhost:8765/index.html - NOT by double-clicking index.html (file:// blocks image/CSV loading).\n\n" +
      "If the server isn't running, restart it:\n" +
      "  cd \"/Users/kiprassperauskas/Downloads/country colonise\"\n" +
      "  python3 -m http.server 8765 &";
  }
}

const view = {
  zoom: 1,
  panX: 0,
  panY: 0,
};

let biomeCache = null;          
let tintCacheCanvas = null;     
let tintCacheDirty = true;

let nextCivId = 0;
let nextArmyId = 0;
let nextSettlementId = 0;

function generateCivTag(name) {
  let base = null;
  if (typeof CIV_TAGS !== "undefined" && name && CIV_TAGS[name]) {
    const t = CIV_TAGS[name].split("_")[0];
    if (t.length === 3) base = t.toUpperCase();
  }
  if (!base) {
    const stripped = (name || "X").replace(/[^A-Za-z]/g, "").toUpperCase();
    base = (stripped + "XXX").slice(0, 3);
  }
  
  const used = new Set();
  if (typeof state !== "undefined" && state && Array.isArray(state.civs)) {
    for (const c of state.civs) if (c && c.tag) used.add(c.tag);
  }
  if (!used.has(base)) return base;
  
  for (let i = 0; i < 26; i++) {
    const t = base.slice(0, 2) + String.fromCharCode(65 + i);
    if (!used.has(t)) return t;
  }
  
  while (true) {
    const t = String.fromCharCode(65 + Math.floor(Math.random() * 26))
            + String.fromCharCode(65 + Math.floor(Math.random() * 26))
            + String.fromCharCode(65 + Math.floor(Math.random() * 26));
    if (!used.has(t)) return t;
  }
}

function makeCiv(opts) {
  return {
    id: nextCivId++,
    name: opts.name,
    
    tag: opts.tag || generateCivTag(opts.name),
    color: opts.color,
    isPlayer: !!opts.isPlayer,
    alive: true,
    settlements: [],   
    armies: [],        
    relations: {},     
    stability: 80,
    techPoints: 0,
    era: 0,
    age: 0,            
    capitulatedTo: null,

    expansionGoals: [],

    
    foundedYear: (typeof state !== "undefined" && state) ? state.year : -1000,
    lastChangeYear: (typeof state !== "undefined" && state) ? state.year : -1000,
  };
}

function settlementName(civ, idx) {
  const samples = {
    "Egypt":      ["Memphis","Thebes","Heliopolis","Alexandria","Giza","Avaris","Luxor","Abydos"],
    "Phoenicia":  ["Tyre","Sidon","Byblos","Carthage","Gadir","Utica"],
    "Assyria":    ["Nineveh","Ashur","Nimrud","Khorsabad","Harran"],
    "Babylon":    ["Babylon","Ur","Eridu","Uruk","Nippur","Lagash"],
    "Greeks":     ["Athens","Sparta","Corinth","Thebes","Argos","Delphi","Mycenae"],
    "Etruscans":  ["Veii","Tarquinii","Caere","Volterra","Populonia"],
    "Celts":      ["Hallstatt","Bibracte","Alesia","Gergovia","Avaricum"],
    "Iberians":   ["Numantia","Saguntum","Tartessos","Gades","Emporion"],
    "Germans":    ["Aachen","Trier","Worms","Köln","Hamburg","Lübeck"],
    "Slavs":      ["Kiev","Novgorod","Smolensk","Polotsk","Pskov"],
    "Scythians":  ["Gelonus","Olbia","Neapolis","Kamenka"],
    "Medes":      ["Ecbatana","Rhagae","Aspadana","Susa"],
    "Persia":     ["Persepolis","Susa","Pasargadae","Ecbatana","Babylon"],
    "Vedic India":["Indraprastha","Hastinapura","Magadha","Kosala","Avanti"],
    "Maurya":     ["Pataliputra","Taxila","Ujjain","Kalinga","Vidisha"],
    "Zhou China": ["Haojing","Luoyi","Linzi","Ying","Xianyang"],
    "Han China":  ["Chang'an","Luoyang","Chengdu","Jiankang","Kaifeng"],
    "Gojoseon":   ["Wanggeom","Asadal","Pyongyang"],
    "Yamato":     ["Yamato","Asuka","Heijokyo","Heiankyo","Kamakura"],
    "Olmec":      ["La Venta","San Lorenzo","Tres Zapotes","Laguna"],
    "Maya":       ["Tikal","Palenque","Calakmul","Chichen Itza","Uxmal"],
    "Chavin":     ["Chavin de Huantar","Sechin","Caral"],
    "Inca":       ["Cuzco","Machu Picchu","Ollantaytambo","Quito","Vilcabamba"],
    "Kush":       ["Napata","Meroe","Kerma","Faras"],
    "Berbers":    ["Volubilis","Carthago","Lixus","Iol"],
    "Rome":       ["Roma","Ostia","Capua","Tarentum","Mediolanum","Ravenna","Aquileia"],
    "Lydia":      ["Sardis","Smyrna","Ephesus","Pergamon"],
    "Carthage":   ["Carthago","Utica","Hippo","Saguntum","Gades"],
    "Macedon":    ["Pella","Aigai","Thessalonica","Amphipolis"],
    "Goths":      ["Adrianople","Toledo","Ravenna","Pavia"],
    "Arabs":      ["Mecca","Medina","Damascus","Baghdad","Cairo","Cordoba"],
    "Franks":     ["Aachen","Paris","Reims","Tours","Lyon"],
    "Vikings":    ["Hedeby","Birka","Jorvik","Dublin","Reykjavik"],
    "Mongols":    ["Karakorum","Khanbaliq","Sarai","Tabriz"],
    "Ottomans":   ["Constantinople","Bursa","Edirne","Izmir","Damascus"],
    "Aztec":      ["Tenochtitlan","Texcoco","Tlacopan","Cholula"],
    "Russia":     ["Moscow","St. Petersburg","Kazan","Novgorod","Tver"],
    "USA":        ["Philadelphia","Boston","New York","Washington","Charleston"],
  };
  const list = samples[civ.name] || [civ.name];
  if (idx < list.length) return list[idx];
  return list[idx % list.length] + " " + (Math.floor(idx / list.length) + 1);
}

function tribalNameFromBiome(biome) {
  const adj = {
    plains:   ["Grass","Wind","Stone","Sun","Bison","Wolf"],
    forest:   ["Pine","Oak","Stag","Fox","Wolf","Birch"],
    jungle:   ["River","Jaguar","Vine","Sun","Monkey"],
    desert:   ["Sand","Sun","Falcon","Snake","Salt"],
    tundra:   ["Ice","Bear","Wolf","Snow","Frost"],
    mountain: ["Eagle","Stone","Cloud","Iron"],
  };
  const noun = ["Walkers","People","Folk","Tribe","Kin","Children","Ones"];
  const a = (adj[biome] || ["Free"])[Math.floor(Math.random() * (adj[biome] || ["Free"]).length)];
  const n = noun[Math.floor(Math.random() * noun.length)];
  return a + " " + n;
}

function placeCivOnMap(civ, capitalCol, capitalRow, isStarting = true) {

  const { col, row } = nearestLand(capitalCol, capitalRow, civ);
  const curPlanet = state.currentPlanet || "Earth";
  const settlement = {
    id: nextSettlementId++,
    col, row,
    name: settlementName(civ, civ.settlements.length),
    pop: isStarting ? 2 : 3,
    food: 0,
    prod: 0,
    queue: [],
    walls: false,
    planet: curPlanet,
  };
  civ.settlements.push(settlement);

  state.ownership[row][col] = civ.id;
  for (const [nc, nr] of neighbors(col, row)) {
    const okBiome = civ.aquaticOnly ? (MAP[nr][nc] === "ocean") : PASSABLE(MAP[nr][nc]);
    if (okBiome && state.ownership[nr][nc] === -1) {
      state.ownership[nr][nc] = civ.id;
    }
  }

  if (isStarting) {
    civ.armies.push({
      id: nextArmyId++, col, row,
      type: "warrior", count: 2, civId: civ.id, moves: 1, planet: curPlanet,
    });
  }
  return settlement;
}

function initOwnership() {
  state.ownership = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
}

function tileFromHoi4State(name) {
  if (typeof HOI4_CITIES === "undefined") return null;
  const city = HOI4_CITIES.find(c => c.name === name);
  if (!city) return null;
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor(city.x / TILE))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor(city.y / TILE))),
  };
}

function spawnHistoricalCivs() {
  for (const h of HISTORICAL_CIVS) {
    let pos = h.state ? tileFromHoi4State(h.state) : null;
    if (!pos) pos = latLonToTile(h.lat, h.lon);
    const civ = makeCiv({ name: h.name, color: h.color });

    civ.isStartingTribe = true;
    state.civs.push(civ);
    placeCivOnMap(civ, pos.col, pos.row);
  }
  
  for (const a of state.civs) {
    for (const b of state.civs) {
      if (a.id !== b.id) a.relations[b.id] = 0;
    }
  }

  for (const [nameA, nameB] of INITIAL_ALLIANCES) {
    const a = state.civs.find(c => c.name === nameA);
    const b = state.civs.find(c => c.name === nameB);
    if (a && b) {
      a.relations[b.id] = 100;
      b.relations[a.id] = 100;
    }
  }
}

function spawnPlayer(col, row) {
  const biome = MAP[row][col];
  const player = makeCiv({
    name: tribalNameFromBiome(biome),
    color: "#ffffff",
    isPlayer: true,
  });
  state.civs.unshift(player);
  
  placeCivOnMap(player, col, row);
  
  for (const c of state.civs) {
    if (c.id !== player.id) {
      player.relations[c.id] = 0;
      c.relations[player.id] = 0;
    }
  }
  state.phase = "playing";
  log("event", `${player.name} settle the land. Their chieftain dreams of empire.`);
  
  if (state._modDebugStart && typeof enterDebugMode === "function") {
    state._modDebugStart = false;
    enterDebugMode();
  }
}

function processEvents() {
  const _savedOwnership = state.ownership;
  const _savedPlanet = state.currentPlanet;
  const offEarth = _savedPlanet && _savedPlanet !== "Earth";
  if (offEarth) {
    if (!state.planetOwnership) state.planetOwnership = {};
    if (!state.planetOwnership["Earth"]) {
      state.planetOwnership["Earth"] = state._earthOwnership || _savedOwnership;
    }
    state.ownership = state.planetOwnership["Earth"];
    state.currentPlanet = "Earth";
  }
  try {
    for (const ev of HISTORICAL_EVENTS) {
      if (ev._fired) continue;
      if (state.year < ev.year) continue;

      if (Array.isArray(ev.requireDeadCivs)) {
        const stillAlive = ev.requireDeadCivs.some(name => {
          const c = state.civs.find(c => c.alive && c.name === name);
          return !!c;
        });
        if (stillAlive) continue;
      }
      ev._fired = true;
      try {
        fireEvent(ev);
      } catch (e) {
        console.error("EVENT FAILED at year", state.year, "type=", ev.type || "spawn",
          "civ=", typeof ev.civ === "string" ? ev.civ : ev.civ && ev.civ.name,
          "region=", JSON.stringify(ev.region || null), "\nev=", JSON.stringify(ev), "\n", e);
        log("death", "Event failed: " + (ev.message || JSON.stringify(ev)));
      }
    }
  } finally {
    if (offEarth) {
      state.planetOwnership["Earth"] = state.ownership;
      state._earthOwnership = state.ownership;
      state.ownership = _savedOwnership;
      state.currentPlanet = _savedPlanet;
    }
  }
}

function fireEvent(ev) {
  const playerCiv = state.civs[0]?.isPlayer ? state.civs[0] : null;

  
  if (ev.type === "claim") {
    const civ = state.civs.find(c => c.alive && c.name === ev.civ);
    if (!civ) return;

    
    const exceptIds = new Set();
    if (Array.isArray(ev.except)) {
      for (const name of ev.except) {
        const c = state.civs.find(x => x.alive && x.name === name);
        if (c) exceptIds.add(c.id);
      }
    }
    
    const byOwnerTags = Array.isArray(ev.byOwner) ? ev.byOwner
                       : (ev.byOwner ? [ev.byOwner] : null);
    
    if (ev.region && !byOwnerTags) expandCivToRegion(civ, ev.region, playerCiv);

    
    
    if (byOwnerTags && typeof HOI4_CITIES !== "undefined" && provinceTile && provinceGrid) {
      const tagSet = new Set(byOwnerTags);
      const pidToTag = {};
      for (const sd of HOI4_CITIES) {
        if (!sd.owner || !tagSet.has(sd.owner)) continue;
        for (const pid of sd.provinces || []) pidToTag[pid] = sd.owner;
      }
      
      let rLo = 0, rHi = ROWS - 1, cLo = 0, cHi = COLS - 1;
      let useRegion = false;
      if (ev.region) {
        useRegion = true;
        const t1 = latLonToTile(ev.region.lat[1], ev.region.lon[0]);
        const t2 = latLonToTile(ev.region.lat[0], ev.region.lon[0]);
        const t3 = latLonToTile(0, ev.region.lon[0]);
        const t4 = latLonToTile(0, ev.region.lon[1]);
        rLo = Math.min(t1.row, t2.row); rHi = Math.max(t1.row, t2.row);
        cLo = Math.min(t3.col, t4.col); cHi = Math.max(t3.col, t4.col);
      }
      for (let r = rLo; r <= rHi; r++) {
        for (let c = cLo; c <= cHi; c++) {
          const cc = useRegion ? (((c % COLS) + COLS) % COLS) : c;
          const owner = state.ownership[r][cc];
          if (playerCiv && owner === playerCiv.id) continue;
          if (owner === civ.id) continue;
          if (ev.onlyUnowned && owner !== -1) continue;
          if (exceptIds.has(owner)) continue;
          if (!PASSABLE(MAP[r][cc])) continue;
          const px = cc * TILE + (TILE >> 1);
          const py = r * TILE + (TILE >> 1);
          const pid = provinceGrid[py * MAP_W + px];
          if (pid === 0 || !pidToTag[pid]) continue;
          state.ownership[r][cc] = civ.id;
        }
      }
      reassignSettlementsByTileOwner();
    }

    if (Array.isArray(ev.provinces) && provinceTile) {
      for (const pid of ev.provinces) {
        const col = provinceTile[pid * 2];
        const row = provinceTile[pid * 2 + 1];
        if (col < 0 || row < 0) continue;
        const owner = state.ownership[row][col];
        if (playerCiv && owner === playerCiv.id) continue;
        if (owner === civ.id) continue;
        if (ev.onlyUnowned && owner !== -1) continue;
        if (exceptIds.has(owner)) continue;
        state.ownership[row][col] = civ.id;
      }
    }
    log("event", ev.message);
    invalidateTintCache();
    return;
  }

  

  if (ev.type === "colonize") {
    if (typeof HOI4_CITIES === "undefined" || !provinceGrid) return;
    
    const tagToCiv = new Map();
    for (const civ of state.civs) {
      if (!civ.alive) continue;
      const flagTag = CIV_TAGS[civ.name] || "";
      const tag = flagTag.split("_")[0];
      if (tag.length === 3) tagToCiv.set(tag, civ);
    }
    
    const pidToOwner = new Map();
    for (const stateData of HOI4_CITIES) {
      if (!stateData.owner) continue;
      for (const pid of stateData.provinces || []) {
        pidToOwner.set(pid, stateData.owner);
      }
    }
    let filled = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] !== -1) continue;
        if (!PASSABLE(MAP[r][c])) continue;
        const px = c * TILE + (TILE >> 1);
        const py = r * TILE + (TILE >> 1);
        const pid = provinceGrid[py * MAP_W + px];
        if (pid === 0) continue;
        const ownerTag = pidToOwner.get(pid);
        if (!ownerTag) continue;
        const civ = tagToCiv.get(ownerTag);
        if (!civ) continue;
        state.ownership[r][c] = civ.id;
        filled++;
      }
    }
    log("event", ev.message + ` (${filled} provinces colonized)`);
    invalidateTintCache();
    return;
  }

  
  
  if (ev.type === "rename") {
    const civ = state.civs.find(c => c.alive && c.name === ev.from);
    if (civ) {

      
      if (!civ.previousNames) civ.previousNames = [];
      civ.previousNames.push(civ.name);
      civ.name = ev.to;
      if (ev.color) civ.color = ev.color;
      civ._flagColorApplied = false;   
      civ.lastChangeYear = state.year;

      
      civ.isStartingTribe = false;

      
      const yearEra = yearToEra(state.year);
      if (civ.era < yearEra) {
        civ.era = yearEra;
        civ.techPoints = Math.max(civ.techPoints, ERAS[yearEra].threshold);
      }
      applyFlagColor(civ);
      log("event", ev.message);
      invalidateTintCache();
      return;
    }
    if (ev.spawnIfMissing && typeof ev.spawnIfMissing.lat === "number") {
      const { col, row } = latLonToTile(ev.spawnIfMissing.lat, ev.spawnIfMissing.lon);
      const fresh = makeCiv({ name: ev.to, color: ev.color || "#888888" });
      state.civs.push(fresh);
      for (const c of state.civs) {
        if (c.id !== fresh.id) {
          fresh.relations[c.id] = 0;
          c.relations[fresh.id] = 0;
        }
      }
      placeCivOnMap(fresh, col, row);
      log("event", ev.message + " (revived from absent predecessor)");
      invalidateTintCache();
      return;
    }
    log("event", ev.message + " - predecessor missing, skipped.");
    return;
  }

  if (ev.type === "merge") {
    const civs = ev.from.map(name => state.civs.find(c => c.alive && c.name === name)).filter(Boolean);

    if (civs.length < ev.from.length) {
      const missing = ev.from.filter(n => !state.civs.find(c => c.alive && c.name === n));
      log("event", ev.message + ` - but the union could not form (missing: ${missing.join(", ")}).`);
      return;
    }
    const merged = makeCiv({ name: ev.to.name, color: ev.to.color });
    state.civs.push(merged);

    

    if (civs[0] && civs[0].tag) merged.tag = civs[0].tag;
    for (const c of state.civs) {
      if (c.id !== merged.id) {
        merged.relations[c.id] = 0;
        c.relations[merged.id] = 0;
      }
    }

    
    merged.previousNames = [];
    for (const civ of civs) {
      merged.previousNames.push(civ.name);
      if (civ.previousNames) merged.previousNames.push(...civ.previousNames);
    }
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (civs.some(civ => state.ownership[r][c] === civ.id)) {
          state.ownership[r][c] = merged.id;
        }
      }
    }
    for (const civ of civs) {
      for (const s of civ.settlements) merged.settlements.push(s);
      for (const a of civ.armies) merged.armies.push({ ...a, civId: merged.id });
      civ.settlements = [];
      civ.armies = [];
      civ.alive = false;
      civ.capitulatedTo = merged.id;
    }
    merged.era = Math.max(...civs.map(c => c.era));
    merged.techPoints = civs.reduce((s, c) => s + c.techPoints, 0);
    log("event", ev.message);
    invalidateTintCache();
    return;
  }

  
  if (ev.type === "barbarossa") {
    const a = state.civs.find(c => c.alive && c.name === ev.a);
    const b = state.civs.find(c => c.alive && c.name === ev.b);
    if (a && b) {
      a.relations[b.id] = -100;
      b.relations[a.id] = -100;
      showWarPopup(a, b);
    }
    log("war", ev.message);
    return;
  }

  

  
  
  if (ev.type === "peace_treaty") {
    const a = state.civs.find(c => c.alive && c.name === ev.a);
    const b = state.civs.find(c => c.alive && c.name === ev.b);
    if (!a || !b) {
      log("event", ev.message + " - one of the signatories is no longer extant.");
      return;
    }
    a.relations[b.id] = 30;
    b.relations[a.id] = 30;
    if (state.warFocus) {
      if (state.warFocus[a.id] === b.id) delete state.warFocus[a.id];
      if (state.warFocus[b.id] === a.id) delete state.warFocus[b.id];
    }
    if (state.playerWars) {
      state.playerWars.delete(a.id);
      state.playerWars.delete(b.id);
    }
    log("peace", ev.message);
    return;
  }

  
  if (ev.type === "alliance") {
    const a = state.civs.find(c => c.alive && c.name === ev.a);
    const b = state.civs.find(c => c.alive && c.name === ev.b);
    if (a && b) {
      a.relations[b.id] = 100;
      b.relations[a.id] = 100;
    }
    log("peace", ev.message);
    return;
  }

  

  
  if (ev.type === "form_faction") {

    

    
    function resolveFactionMember(name) {
      let civ = state.civs.find(c => c.alive && (c.name === name || (c.previousNames || []).includes(name)));
      if (civ) return civ;
      for (const c of state.civs) {
        if (!c.alive) continue;
        const starts = [c.name, ...(c.previousNames || [])];
        for (const s of starts) {
          if (walkLineageForward(s).has(name)) return c;
        }
      }
      return null;
    }
    const memberCivs = (ev.members || []).map(resolveFactionMember).filter(Boolean);
    if (memberCivs.length < 2) {
      log("event", ev.message + " - too few members alive to form the faction.");
      return;
    }
    for (let i = 0; i < memberCivs.length; i++) {
      for (let j = i + 1; j < memberCivs.length; j++) {
        const a = memberCivs[i], b = memberCivs[j];
        a.relations[b.id] = 100;
        b.relations[a.id] = 100;
      }
    }
    if (!state.factions) state.factions = [];
    state.factions.push({
      name: ev.name,
      color: ev.color || "#5d8acf",
      memberIds: memberCivs.map(c => c.id),
    });
    log("peace", ev.message);
    return;
  }

  

  
  
  if (ev.type === "war") {
    const a = state.civs.find(c => c.alive && c.name === ev.a);
    const b = state.civs.find(c => c.alive && c.name === ev.b);
    if (!a || !b) {
      log("event", ev.message + " - one of the belligerents is missing.");
      return;
    }
    a.relations[b.id] = -100;
    b.relations[a.id] = -100;

    if (ev.region) {
      if (!a.expansionGoals) a.expansionGoals = [];
      a.expansionGoals.push({ region: ev.region, priority: ev.priority || 1.0 });
    }
    
    const boost = ev.reinforce || 6;
    function reinforce(civ, count) {
      if (!civ.settlements.length) return;
      const cap = civ.settlements[0];
      civ.armies.push({
        id: nextArmyId++, col: cap.col, row: cap.row,
        type: bestUnitForEra(civ.era), count, civId: civ.id, moves: 1,
      });
    }
    reinforce(a, boost);
    reinforce(b, Math.max(2, Math.floor(boost * 0.6)));
    log("war", ev.message);
    showWarPopup(a, b);
    return;
  }

  
  if (ev.type === "reinforce") {
    const civ = state.civs.find(c => c.alive && c.name === ev.civ);
    if (!civ || !civ.settlements.length) {
      log("event", ev.message + " - civ has no capital to reinforce.");
      return;
    }
    const cap = civ.settlements[0];
    civ.armies.push({
      id: nextArmyId++, col: cap.col, row: cap.row,
      type: bestUnitForEra(civ.era), count: ev.count || 6, civId: civ.id, moves: 1,
    });
    log("event", ev.message);
    return;
  }

  

  
  if (ev.type === "secede") {
    const target = state.civs.find(c => c.alive && c.name === ev.target);

    
    if (ev.target && !target) {
      log("event", ev.message + " - " + ev.target + " doesn't exist; nothing happens.");
      return;
    }
    const civName = typeof ev.civ === "string" ? ev.civ : (ev.civ && ev.civ.name);

    

    

    const overrideParent = TREE_PARENT_OVERRIDES[civName];
    if (overrideParent) {
      const lineage = walkLineageForward(overrideParent);
      lineage.add(overrideParent);
      
      if (state.consoleKilledLineages && state.consoleKilledLineages.size > 0) {
        for (const n of lineage) {
          if (state.consoleKilledLineages.has(n.toLowerCase())) {
            log("event", ev.message + " - the " + civName + " lineage was wiped from history; the state cannot reform.");
            return;
          }
        }
      }

    }
    let newCiv = state.civs.find(c => c.alive && c.name === ev.civ);

    
    if (!newCiv && overrideParent && SAME_IDENTITY_OVERRIDES.has(civName)) {
      const lineage = walkLineageForward(overrideParent);
      lineage.add(overrideParent);
      const aliveAncestor = state.civs.find(c => c.alive && (lineage.has(c.name) || (c.previousNames || []).some(n => lineage.has(n))));
      if (aliveAncestor) {
        if (!aliveAncestor.previousNames) aliveAncestor.previousNames = [];
        aliveAncestor.previousNames.push(aliveAncestor.name);
        aliveAncestor.name = civName;
        if (ev.spawn && ev.spawn.color) aliveAncestor.color = ev.spawn.color;
        applyFlagColor(aliveAncestor);
        log("event", ev.message + " - " + (aliveAncestor.previousNames[aliveAncestor.previousNames.length - 1]) + " transitions into " + civName + ".");
        invalidateTintCache();
        newCiv = aliveAncestor;
      }
    }
    if (!newCiv && ev.spawn) {

      newCiv = makeCiv({ name: ev.civ || ev.spawn.name, color: ev.spawn.color || "#888888" });
      state.civs.push(newCiv);

      
      
      newCiv.era = yearToEra(state.year);
      newCiv.techPoints = ERAS[newCiv.era].threshold;
      applyFlagColor(newCiv);   
      for (const c of state.civs) {
        if (c.id !== newCiv.id) {
          newCiv.relations[c.id] = 0;
          c.relations[newCiv.id] = 0;
        }
      }
      
      if (typeof ev.spawn.lat === "number" && typeof ev.spawn.lon === "number") {
        const { col, row } = latLonToTile(ev.spawn.lat, ev.spawn.lon);
        placeCivOnMap(newCiv, col, row, true);
      }
    }
    if (!newCiv) {
      log("event", ev.message + " - but the seceding state could not form.");
      return;
    }
    let transferred = 0;

    
    const sByOwnerTags = Array.isArray(ev.byOwner) ? ev.byOwner
                       : (ev.byOwner ? [ev.byOwner] : null);
    if (sByOwnerTags && typeof HOI4_CITIES !== "undefined" && provinceTile && provinceGrid) {
      const sTagSet = new Set(sByOwnerTags);
      const sPidToTag = {};
      for (const sd of HOI4_CITIES) {
        if (!sd.owner || !sTagSet.has(sd.owner)) continue;
        for (const pid of sd.provinces || []) sPidToTag[pid] = sd.owner;
      }

      
      
      let rLo = 0, rHi = ROWS - 1, cLo = 0, cHi = COLS - 1;
      let useRegion = false;
      if (ev.region) {
        useRegion = true;
        const t1 = latLonToTile(ev.region.lat[1], ev.region.lon[0]);
        const t2 = latLonToTile(ev.region.lat[0], ev.region.lon[0]);
        const t3 = latLonToTile(0, ev.region.lon[0]);
        const t4 = latLonToTile(0, ev.region.lon[1]);
        rLo = Math.min(t1.row, t2.row); rHi = Math.max(t1.row, t2.row);
        cLo = Math.min(t3.col, t4.col); cHi = Math.max(t3.col, t4.col);
      }

      

      for (let r = rLo; r <= rHi; r++) {
        for (let c = cLo; c <= cHi; c++) {
          const cc = useRegion ? (((c % COLS) + COLS) % COLS) : c;
          const owner = state.ownership[r][cc];
          if (owner === newCiv.id) continue;
          if (playerCiv && owner === playerCiv.id) continue;
          if (!PASSABLE(MAP[r][cc])) continue;
          const px = cc * TILE + (TILE >> 1);
          const py = r * TILE + (TILE >> 1);
          const pid = provinceGrid[py * MAP_W + px];
          if (pid === 0 || !sPidToTag[pid]) continue;
          state.ownership[r][cc] = newCiv.id;
          transferred++;
        }
      }
      reassignSettlementsByTileOwner();
    }

    if (Array.isArray(ev.byStateName) && typeof HOI4_CITIES !== "undefined" && provinceGrid) {
      const stateNameSet = new Set(ev.byStateName);
      const sPidSet = new Set();
      for (const sd of HOI4_CITIES) {
        if (!stateNameSet.has(sd.name)) continue;
        for (const pid of sd.provinces || []) sPidSet.add(pid);
      }
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (!PASSABLE(MAP[r][c])) continue;
          const px = c * TILE + (TILE >> 1);
          const py = r * TILE + (TILE >> 1);
          const pid = provinceGrid[py * MAP_W + px];
          if (pid === 0 || !sPidSet.has(pid)) continue;
          state.ownership[r][c] = newCiv.id;
          transferred++;
        }
      }
      reassignSettlementsByTileOwner();
    }
    
    if (ev.region) {
      const r1 = latLonToTile(ev.region.lat[1], ev.region.lon[0]).row;
      const r2 = latLonToTile(ev.region.lat[0], ev.region.lon[0]).row;
      const c1 = latLonToTile(0, ev.region.lon[0]).col;
      const c2 = latLonToTile(0, ev.region.lon[1]).col;
      const rLo = Math.min(r1, r2), rHi = Math.max(r1, r2);
      const cLo = Math.min(c1, c2), cHi = Math.max(c1, c2);
      for (let r = rLo; r <= rHi; r++) {
        for (let c = cLo; c <= cHi; c++) {
          const cc = ((c % COLS) + COLS) % COLS;
          if (!PASSABLE(MAP[r][cc])) continue;
          const owner = state.ownership[r][cc];
          if (target ? owner === target.id : owner === -1) {
            state.ownership[r][cc] = newCiv.id;
            transferred++;
          }
        }
      }
    }

    

    if (target && target._absorbedTerritory && newCiv && civName) {
      const lineage = new Set([civName, newCiv.name]);
      for (const n of newCiv.previousNames || []) lineage.add(n);
      const overrideParent = TREE_PARENT_OVERRIDES[civName];
      if (overrideParent) {
        lineage.add(overrideParent);
        for (const n of walkLineageForward(overrideParent)) lineage.add(n);
      }
      for (const ancestorName of Object.keys(target._absorbedTerritory)) {
        if (!lineage.has(ancestorName)) continue;
        const restored = target._absorbedTerritory[ancestorName];
        for (const [c, r] of restored) {
          if (state.ownership[r][c] === target.id) {
            state.ownership[r][c] = newCiv.id;
          }
        }
        
        delete target._absorbedTerritory[ancestorName];
      }
    }
    
    if (target) {
      const remaining = [];
      for (const s of target.settlements) {
        if (state.ownership[s.row][s.col] === newCiv.id) {
          newCiv.settlements.push(s);
        } else {
          remaining.push(s);
        }
      }
      target.settlements = remaining;

      

      const remainingArmies = [];
      for (const a of target.armies) {
        if (state.ownership[a.row] && state.ownership[a.row][a.col] === newCiv.id) {
          newCiv.armies.push({ ...a, id: nextArmyId++, civId: newCiv.id });
        } else {
          remainingArmies.push(a);
        }
      }
      target.armies = remainingArmies;
      target.relations[newCiv.id] = -80;
      newCiv.relations[target.id] = -80;
      target.lastChangeYear = state.year;
    }
    
    if (newCiv.armies.length === 0 && newCiv.settlements.length > 0) {
      const cap = newCiv.settlements[0];
      newCiv.armies.push({
        id: nextArmyId++, col: cap.col, row: cap.row,
        type: bestUnitForEra(newCiv.era), count: 3, civId: newCiv.id, moves: 1,
      });
    }
    log("event", ev.message);
    invalidateTintCache();
    return;
  }

  
  if (ev.type === "absorb") {
    const absorber = state.civs.find(c => c.alive && c.name === ev.absorber);
    const target = state.civs.find(c => c.alive && c.name === ev.target);
    if (!target) {
      log("event", ev.message + " - target civ is already gone.");
      return;
    }

    

    if (ev.absorber && !absorber) {
      log("event", ev.message + " - " + ev.absorber + " doesn't exist; nothing happens.");
      return;
    }

    

    if (absorber && !ev.force) {
      const tStr = civStrength(target);
      const aStr = civStrength(absorber);
      if (tStr > aStr * 1.5 + 6) {
        log("war", ev.message + " - but " + target.name + " (str " + tStr + ") repels " + absorber.name + " (str " + aStr + "); the annexation fails.");
        
        absorber.relations[target.id] = -100;
        target.relations[absorber.id] = -100;
        return;
      }
    }
    if (absorber) {

      

      const snapshot = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] === target.id) {
            snapshot.push([c, r]);
            state.ownership[r][c] = absorber.id;
          }
        }
      }
      if (!absorber._absorbedTerritory) absorber._absorbedTerritory = {};
      for (const name of [target.name, ...(target.previousNames || [])]) {
        absorber._absorbedTerritory[name] = snapshot;
      }
      for (const s of target.settlements) absorber.settlements.push(s);
      for (const a of target.armies) absorber.armies.push({ ...a, civId: absorber.id });
      target.capitulatedTo = absorber.id;
    } else {

      const aliveCivs = state.civs.filter(c => c.alive && c.id !== target.id);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] !== target.id) continue;
          
          const tally = {};
          for (const [nc, nr] of neighbors(c, r)) {
            const o = state.ownership[nr][nc];
            if (o >= 0 && o !== target.id) tally[o] = (tally[o] || 0) + 1;
          }
          let bestId = -1, bestN = 0;
          for (const [k, v] of Object.entries(tally)) {
            if (v > bestN) { bestN = v; bestId = +k; }
          }
          if (bestId < 0 && aliveCivs.length > 0) {
            
            let nearest = null, nearestD = Infinity;
            for (const cv of aliveCivs) {
              if (!cv.settlements.length) continue;
              const s = cv.settlements[0];
              const d = Math.abs(s.col - c) + Math.abs(s.row - r);
              if (d < nearestD) { nearestD = d; nearest = cv; }
            }
            if (nearest) bestId = nearest.id;
          }
          state.ownership[r][c] = bestId >= 0 ? bestId : -1;
        }
      }
    }
    target.settlements = [];
    target.armies = [];
    target.alive = false;
    log("death", ev.message + (absorber ? "" : " - territory returns to no-man's land."));
    invalidateTintCache();
    return;
  }

  

  

  
  if (ev.type === "kill_civ") {
    const target = state.civs.find(c => c.alive && c.name === ev.civ);
    if (!target) {
      log("event", ev.message + " - target already gone.");
      return;
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] === target.id) state.ownership[r][c] = -1;
      }
    }
    target.settlements = [];
    target.armies = [];
    target.alive = false;
    log("death", ev.message);
    invalidateTintCache();
    return;
  }

  if (ev.type === "wartime") {
    state.isWartime = !!ev.on;
    log(ev.on ? "war" : "peace", ev.message);
    return;
  }

  if (ev.type === "nuke_weakest") {
    const exclude = new Set(ev.excludeNames || [
      "Mars Republic", "Mars Colony Authority", "Lunar Republic",
      "Asteroid Belt Coalition", "Saturn Moons Confederation",
      "Pan-Solar Diaspora", "Centauri Authority", "Many-Worlds Federation",
      "Solar Republic", "Sol Federation", "Ascended Sol", "Anchor Eternity",
      "Nuclear Wasteland",
    ]);
    let candidates = state.civs.filter(c => c.alive && !c.isPlayer && !exclude.has(c.name));
    if (candidates.length === 0) { log("war", ev.message); return; }
    candidates.sort((a, b) => (civStrength(a) + countTiles(a)) - (civStrength(b) + countTiles(b)));
    const victim = candidates[0];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] === victim.id) state.ownership[r][c] = -1;
      }
    }
    victim.settlements = [];
    victim.armies = [];
    victim.alive = false;
    log("war", ev.message + " - " + victim.name + " is annihilated.");
    invalidateTintCache();
    return;
  }

  if (ev.type === "nuke_unify") {
    const wasteland = makeCiv({ name: "Nuclear Wasteland", color: ev.color || "#3a2a14" });
    state.civs.push(wasteland);
    function hasOffworldPresence(c) {
      for (const s of (c.settlements || [])) {
        if ((s.planet || "Earth") !== "Earth") return true;
      }
      for (const a of (c.armies || [])) {
        if ((a.planet || "Earth") !== "Earth") return true;
      }
      if (state.planetOwnership) {
        for (const [planetName, grid] of Object.entries(state.planetOwnership)) {
          if (planetName === "Earth") continue;
          for (let r = 0; r < ROWS; r++) {
            for (let cc = 0; cc < COLS; cc++) {
              if (grid[r][cc] === c.id) return true;
            }
          }
        }
      }
      return false;
    }
    for (const c of state.civs) {
      if (c.id === wasteland.id) continue;
      if (!c.alive || c.isPlayer) continue;
      const offworld = hasOffworldPresence(c);
      for (let r = 0; r < ROWS; r++) {
        for (let cc = 0; cc < COLS; cc++) {
          if (state.ownership[r][cc] === c.id) state.ownership[r][cc] = wasteland.id;
        }
      }
      c.settlements = (c.settlements || []).filter(s => (s.planet || "Earth") !== "Earth");
      c.armies = (c.armies || []).filter(a => (a.planet || "Earth") !== "Earth");
      if (!offworld) c.alive = false;
    }
    // Stock the Wasteland with garrisons + capital cities at HOI4 state
    // centers. Settlements are critical: without any, checkCapitulation
    // would trigger fragmentCivByOwnerTag the moment a neighbour
    // skirmishes with the Wasteland - resurrecting USA, Russia, etc.
    if (typeof HOI4_CITIES !== "undefined") {
      let placed = 0;
      for (const sd of HOI4_CITIES) {
        if (placed > 80) break;
        if (typeof sd.x !== "number") continue;
        const col = Math.max(0, Math.min(COLS - 1, Math.floor(sd.x / TILE)));
        const row = Math.max(0, Math.min(ROWS - 1, Math.floor(sd.y / TILE)));
        if (state.ownership[row][col] !== wasteland.id) continue;
        wasteland.settlements.push({
          id: nextSettlementId++, col, row,
          name: "Wasteland Outpost",
          pop: 4, food: 0, prod: 0, queue: [], walls: false, planet: "Earth",
        });
        placed++;
      }
    }
    wasteland.armies = [];
    wasteland.cantMakeUnits = true;
    wasteland.cantMoveUnits = true;
    log("war", ev.message);
    invalidateTintCache();
    return;
  }

  // Generic spawn helper for the post-apocalypse tribes.
  if (ev.type === "spawn_aquatic" || ev.type === "spawn_after_nuke") {
    const civ = makeCiv({ name: ev.civ.name, color: ev.civ.color });
    state.civs.push(civ);
    if (ev.type === "spawn_aquatic") civ.aquaticOnly = true;
    civ.isStartingTribe = true;     // mark as tribe so meatball borders apply
    for (const c of state.civs) {
      if (c.id !== civ.id) {
        civ.relations[c.id] = 0;
        c.relations[civ.id] = 0;
      }
    }
    // Place on map: aquatic spawns into an ocean cluster; land tribes
    // grab a cluster of wasteland tiles around their lat/lon.
    const lat = ev.civ.lat, lon = ev.civ.lon;
    if (typeof lat === "number" && typeof lon === "number") {
      const { col, row } = latLonToTile(lat, lon);
      // For aquatic civ - flood-fill ocean tiles outward up to N tiles.
      const target = ev.type === "spawn_aquatic" ? "ocean" : "land";
      const want = ev.tileCount || 60;
      const queue = [[col, row]];
      const seen = new Set();
      seen.add(row * COLS + col);
      let claimed = 0;
      while (queue.length && claimed < want) {
        const [c, r] = queue.shift();
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
        const ok = target === "ocean" ? (MAP[r][c] === "ocean") : (PASSABLE(MAP[r][c]));
        if (!ok) continue;
        // For land target, only claim wasteland tiles (don't steal from the player).
        if (target === "land" && state.ownership[r][c] >= 0) {
          const ownerCiv = state.civs[civIndexById(state.ownership[r][c])];
          if (ownerCiv && ownerCiv.isPlayer) continue;
        }
        state.ownership[r][c] = civ.id;
        claimed++;
        for (const [nc, nr] of neighbors(c, r)) {
          const k = nr * COLS + nc;
          if (!seen.has(k)) { seen.add(k); queue.push([nc, nr]); }
        }
      }
      // Plant a settlement at the spawn tile (or first claimed tile).
      civ.settlements.push({
        id: nextSettlementId++, col, row,
        name: ev.civ.name,
        pop: 3, food: 0, prod: 0, queue: [], walls: false,
      });
      // Starting army.
      civ.armies.push({
        id: nextArmyId++, col, row,
        type: "modern", count: 6, civId: civ.id, moves: 0,
      });
    }
    log("event", ev.message);
    invalidateTintCache();
    return;
  }

  

  
  if (ev.type === "goal") {
    const civ = state.civs.find(c => c.alive && c.name === ev.civ);
    if (!civ) return;
    if (!civ.expansionGoals) civ.expansionGoals = [];
    const goal = {
      region: ev.region,
      priority: typeof ev.priority === "number" ? ev.priority : 0.7,
      since: state.year,
      label: ev.label || ev.message,
    };

    
    if ((ev.byOwner || ev.provinces) && provinceTile) {
      goal.tiles = new Set();
      const addPid = (pid) => {
        const col = provinceTile[pid * 2];
        const row = provinceTile[pid * 2 + 1];
        if (col >= 0 && row >= 0) goal.tiles.add(row * COLS + col);
      };
      if (ev.byOwner && typeof HOI4_CITIES !== "undefined") {
        for (const stateData of HOI4_CITIES) {
          if (stateData.owner !== ev.byOwner) continue;
          for (const pid of stateData.provinces || []) addPid(pid);
        }
      }
      if (Array.isArray(ev.provinces)) {
        for (const pid of ev.provinces) addPid(pid);
      }
    }
    civ.expansionGoals.push(goal);
    log("event", ev.message);
    return;
  }

  

  
  const spawnName = ev.civ && (typeof ev.civ === "string" ? ev.civ : ev.civ.name);
  if (spawnName && state.consoleKilledLineages && state.consoleKilledLineages.has(spawnName.toLowerCase())) {
    log("event", ev.message + " - " + spawnName + " was wiped from history; the state cannot reform.");
    return;
  }

  
  
  if (ev.replaces) {
    const old = state.civs.find(c => c.alive && c.name === ev.replaces);
    if (old) {

      if (!old.previousNames) old.previousNames = [];
      old.previousNames.push(old.name);
      old.name = ev.civ.name;
      if (ev.civ.color) old.color = ev.civ.color;
      old.lastChangeYear = state.year;
      
      old.isStartingTribe = false;
      
      const yearEra = yearToEra(state.year);
      if (old.era < yearEra) {
        old.era = yearEra;
        old.techPoints = Math.max(old.techPoints, ERAS[yearEra].threshold);
      }
      log("event", ev.message);
      invalidateTintCache();
      return;
    }
    
    if (!ev.force) {
      log("event", ev.message + " - but " + ev.replaces + " is gone, no successor forms.");
      return;
    }
  }
  
  if (!ev.civ) return;
  const lat = ev.civ.lat, lon = ev.civ.lon;


  if (typeof lat !== "number" || typeof lon !== "number") {
    log("event", ev.message + " - but no successor state could form (predecessor is gone).");
    return;
  }
  const { col, row } = latLonToTile(lat, lon);


  const civ = makeCiv({ name: ev.civ.name, color: ev.civ.color });
  state.civs.push(civ);

  civ.era = yearToEra(state.year);
  civ.techPoints = ERAS[civ.era].threshold;
  applyFlagColor(civ);
  for (const c of state.civs) {
    if (c.id !== civ.id) {
      civ.relations[c.id] = 0;
      c.relations[civ.id] = 0;
    }
  }
  const targetPlanet = ev.civ.planet || "Earth";
  if (targetPlanet !== "Earth") {
    if (!state.planetOwnership) state.planetOwnership = {};
    if (!state.planetOwnership[targetPlanet]) {
      state.planetOwnership[targetPlanet] = rebuildPlanetOwnership(targetPlanet);
    }
    const grid = state.planetOwnership[targetPlanet];
    const seedCol = Math.max(0, Math.min(COLS - 1, col));
    const seedRow = Math.max(0, Math.min(ROWS - 1, row));
    const queue = [[seedCol, seedRow]];
    const seen = new Set([seedRow * COLS + seedCol]);
    let claimed = 0;
    while (queue.length && claimed < 18) {
      const [c, r] = queue.shift();
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (grid[r][c] !== -1) continue;
      grid[r][c] = civ.id;
      claimed++;
      for (const [nc, nr] of neighbors(c, r)) {
        const k = nr * COLS + nc;
        if (!seen.has(k)) { seen.add(k); queue.push([nc, nr]); }
      }
    }
    civ.settlements.push({
      id: nextSettlementId++, col: seedCol, row: seedRow,
      name: ev.civ.name + " Hub",
      pop: 4, food: 0, prod: 0, queue: [], walls: false, planet: targetPlanet,
    });
    civ.armies.push({
      id: nextArmyId++, col: seedCol, row: seedRow,
      type: bestUnitForEra(civ.era), count: 3, civId: civ.id, moves: 1, planet: targetPlanet,
    });
  } else {
    const s = placeCivOnMap(civ, col, row);
    s.pop = 4;
    civ.armies.push({
      id: nextArmyId++, col: s.col, row: s.row,
      type: bestUnitForEra(civ.era), count: 3, civId: civ.id, moves: 1,
    });
  }
  log("event", ev.message);
  invalidateTintCache();
}

function reassignSettlementsByTileOwner() {
  
  const byId = {};
  for (const c of state.civs) byId[c.id] = c;
  
  const all = [];
  for (const c of state.civs) {
    if (!c.alive) continue;
    for (const s of c.settlements) all.push({ s, owner: c });
  }
  
  for (const c of state.civs) c.settlements = [];
  for (const { s, owner } of all) {
    const tileOwner = state.ownership[s.row][s.col];
    let host = null;
    if (tileOwner >= 0 && byId[tileOwner] && byId[tileOwner].alive) {
      host = byId[tileOwner];
    } else {

      host = owner;
    }
    host.settlements.push(s);
  }
}

function expandCivToRegion(civ, region, playerCiv) {
  const { row: r1 } = latLonToTile(region.lat[1], region.lon[0]);
  const { row: r2 } = latLonToTile(region.lat[0], region.lon[0]);
  const { col: c1 } = latLonToTile(0, region.lon[0]);
  const { col: c2 } = latLonToTile(0, region.lon[1]);
  const rLo = Math.min(r1, r2), rHi = Math.max(r1, r2);
  const cLo = Math.min(c1, c2), cHi = Math.max(c1, c2);

  

  const provinceInRegion = (typeof HOI4_MAX_PROVINCE_ID !== "undefined")
    ? new Uint8Array(HOI4_MAX_PROVINCE_ID + 1)
    : null;
  if (provinceInRegion && provinceTile) {
    for (let pid = 1; pid <= HOI4_MAX_PROVINCE_ID; pid++) {
      const col = provinceTile[pid * 2];
      const row = provinceTile[pid * 2 + 1];
      if (col < 0) continue;
      
      let inLat = row >= rLo && row <= rHi;
      let inLon = false;
      if (cLo <= cHi) {
        inLon = col >= cLo && col <= cHi;
      } else {
        inLon = col >= cLo || col <= cHi;   
      }
      if (inLat && inLon) provinceInRegion[pid] = 1;
    }
  }
  const captured = new Set();
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) {
      const cc = ((c % COLS) + COLS) % COLS;
      if (!PASSABLE(MAP[r][cc])) continue;
      const owner = state.ownership[r][cc];
      if (playerCiv && owner === playerCiv.id) continue; 
      if (owner === civ.id) continue;

      
      
      if (provinceInRegion && provinceGrid) {
        const px = cc * TILE + (TILE >> 1);
        const py = r * TILE + (TILE >> 1);
        const pid = provinceGrid[py * MAP_W + px];
        if (pid > 0 && !provinceInRegion[pid]) continue;
      }
      if (owner >= 0) captured.add(owner);
      state.ownership[r][cc] = civ.id;
    }
  }
  
  for (const otherId of captured) {
    const other = state.civs[civIndexById(otherId)];
    if (!other || !other.alive) continue;
    const remaining = [];
    for (const s of other.settlements) {
      if (state.ownership[s.row][s.col] === civ.id) {
        civ.settlements.push(s);
      } else {
        remaining.push(s);
      }
    }
    other.settlements = remaining;
    if (other.settlements.length === 0) {
      other.alive = false;
      other.capitulatedTo = civ.id;
      log("death", `${other.name} fades from history, absorbed by ${civ.name}.`);
    }
  }
}

function bestUnitForEra(era) {
  const order = ["warrior", "archer", "legion", "knight", "musketeer", "rifleman", "tank", "modern"];
  for (let i = order.length - 1; i >= 0; i--) {
    if (UNITS[order[i]].era <= era) return order[i];
  }
  return "warrior";
}

function tick() {
  if (state.phase !== "playing") return;
  
  if (state.provinceStatus !== "ready") return;

  
  
  if (state.debug) {
    const inWindow = state.year >= 1900 && state.year < 2000;
    if (inWindow && state._autoSlowOriginalSpeed == null && state.speed > 1) {
      state._autoSlowOriginalSpeed = state.speed;
      setSpeed(1);
      log("event", "Debug auto-slow: dropping to 1x for the 1900-2000 chronicle. Speed restores at year 2000.");
    } else if (!inWindow && state._autoSlowOriginalSpeed != null) {
      const restored = state._autoSlowOriginalSpeed;
      state._autoSlowOriginalSpeed = null;
      setSpeed(restored);
      log("event", "Debug auto-slow: 20th century done; restoring previous speed.");
    }
  }
  const _tickStart = performance.now();

  for (const civ of state.civs) {
    if (!civ.alive) continue;
    if (civ.cantMakeUnits || civ.name === "Nuclear Wasteland") {
      civ.armies = [];
      for (const s of (civ.settlements || [])) {
        s.queue = (s.queue || []).filter(q => q.type === "wall");
      }
    }
  }

  for (const civ of state.civs) {
    if (!civ.alive) continue;
    civ.age++;
    for (const s of civ.settlements) {
      
      const tileFood = (BIOME_FOOD[MAP[s.row][s.col]] || 0) + 2;  
      
      let nearby = 0;
      for (const [nc, nr] of neighbors(s.col, s.row)) {
        if (state.ownership[nr][nc] === civ.id) nearby += BIOME_FOOD[MAP[nr][nc]] || 0;
      }
      const foodGain = tileFood + Math.floor(nearby * 0.3);
      s.food += foodGain - s.pop;  
      
      if (s.food >= 10 + s.pop * 2) {
        s.food = 0;
        s.pop++;
      } else if (s.food < 0) {
        
        s.food = 0;
        if (Math.random() < 0.4 && s.pop > 1) {
          s.pop--;
        }
      }
      
      const prod = 1 + Math.floor(s.pop / 2);
      s.prod += prod;
      
      civ.techPoints += 1 + Math.floor(s.pop / 3);
      
      if (s.queue.length > 0) {
        const item = s.queue[0];
        item.progress = (item.progress || 0) + s.prod;
        const cost = item.type === "settler" ? SETTLER_COST : (UNITS[item.type]?.cost || 999);
        if (item.progress >= cost) {
          s.prod = 0;
          s.queue.shift();
          const sPlanet = s.planet || "Earth";
          if (item.type === "settler") {
            civ.armies.push({
              id: nextArmyId++, col: s.col, row: s.row,
              type: "settler", count: 1, civId: civ.id, moves: 1, planet: sPlanet,
            });
            if (civ.isPlayer) log("peace", `${s.name} produces a Settler.`);
          } else {
            let army = civ.armies.find(a => a.col === s.col && a.row === s.row && a.type === item.type && (a.planet || "Earth") === sPlanet);
            if (army) {
              army.count++;
            } else {
              civ.armies.push({
                id: nextArmyId++, col: s.col, row: s.row,
                type: item.type, count: 1, civId: civ.id, moves: 1, planet: sPlanet,
              });
            }
            if (civ.isPlayer) log("peace", `${s.name} trains ${UNITS[item.type].name}.`);
          }
        } else {
          s.prod = 0;
        }
      } else {
        s.prod = 0;
      }
    }

    
    while (civ.era < ERAS.length - 1 && civ.techPoints >= ERAS[civ.era + 1].threshold) {
      civ.era++;
      const newEra = civ.era;
      if (!state.eraFirsts) state.eraFirsts = {};
      const isFirst = !state.eraFirsts[newEra];
      if (isFirst) state.eraFirsts[newEra] = civ.name;
      if (civ.isPlayer) {
        log("event", `Your people enter the ${ERAS[newEra].name}!`);
      } else if (isFirst) {
        log("event", `${civ.name} is the first to enter the ${ERAS[newEra].name}.`);
      }
    }
    
    for (const a of civ.armies) a.moves = (UNITS[a.type] && UNITS[a.type].maxMoves) || 1;
  }

  
  
  const aiPeriod = state.speed >= 5 ? 3 : (state.speed >= 4 ? 2 : 1);

  
  
  const player = state.civs[0];
  if (player && player.isPlayer && player.alive) {

    
    
    if (state.frontlineEnemies && state.frontlineEnemies.size > 0) {
      const enemies = state.frontlineEnemies;
      
      const lineTiles = [];
      const pushTargets = [];
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] !== player.id) continue;
          let touched = false;
          for (const [nc, nr] of neighbors(c, r)) {
            if (enemies.has(state.ownership[nr][nc])) {
              touched = true;
              if (state.frontlinePush) pushTargets.push({ col: nc, row: nr });
            }
          }
          if (touched) lineTiles.push({ col: c, row: r });
        }
      }
      const targets = state.frontlinePush ? (pushTargets.length ? pushTargets : lineTiles) : lineTiles;
      if (targets.length > 0) {
        const occupied = new Set();
        for (const army of player.armies) {
          if (army.type === "settler" || army.type === "colonizer" || army.type === "leader") continue;
          if (army.dest) continue;
          let bestI = -1, bestD = Infinity;
          for (let i = 0; i < targets.length; i++) {
            const key = targets[i].col + "," + targets[i].row;
            if (occupied.has(key)) continue;
            const dc = targets[i].col - army.col, dr = targets[i].row - army.row;
            const d = dc * dc + dr * dr;
            if (d < bestD) { bestD = d; bestI = i; }
          }
          if (bestI < 0) continue;
          const t = targets[bestI];
          occupied.add(t.col + "," + t.row);
          if (army.col !== t.col || army.row !== t.row) {
            army.dest = { col: t.col, row: t.row };
          }
        }
      }
    }
    for (const army of player.armies.slice()) {
      if (!army.dest) continue;
      while (army.moves > 0) {
        if (army.col === army.dest.col && army.row === army.dest.row) { army.dest = null; break; }
        const step = stepTowards(army.col, army.row, army.dest.col, army.dest.row, army.civId, false);
        if (!step) { army.dest = null; break; }
        const before = army.moves;
        tryMoveOrAttack(army, step.col, step.row);
        if (army.moves >= before) { army.dest = null; break; }
        
        if (!player.armies.includes(army)) break;

        break;
      }
    }
  }
  for (const civ of state.civs) {
    if (!civ.alive || civ.isPlayer) continue;
    if (((civ.id + state.turn) % aiPeriod) !== 0) continue;
    aiTurn(civ);
  }

  
  
  const leaderAssistCiv = state.civs[0];
  if (leaderAssistCiv && leaderAssistCiv.isPlayer && leaderAssistCiv.alive &&
      leaderAssistCiv.armies.some(a => a.type === "leader" && a.count > 0)) {
    playerLeaderAssist(leaderAssistCiv);
  }

  
  if (!state.currentPlanet || state.currentPlanet === "Earth") {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const o = state.ownership[r][c];
        if (o === -1) continue;
        const ownerCiv = state.civs[civIndexById(o)];
        if (!ownerCiv) { state.ownership[r][c] = -1; continue; }
        if (MAP[r][c] === "ocean" && !ownerCiv.aquaticOnly) {
          state.ownership[r][c] = -1;
        } else if (MAP[r][c] !== "ocean" && ownerCiv.aquaticOnly) {
          state.ownership[r][c] = -1;
        }
      }
    }
  }

  for (const civ of state.civs.slice()) {
    if (!civ.alive) continue;
    checkInternalChaos(civ);
  }

  for (const civ of state.civs) {
    if (!civ.alive) continue;
    const expected = 80 - Math.max(0, civ.settlements.length - 4) * 3;
    if (civ.stability < expected) civ.stability += 1;
    else if (civ.stability > expected) civ.stability -= 1;
  }

  state.turn++;
  state.year += currentYearsPerTurn();
  processEvents();

  
  
  maybeTriggerWarMode();

  // Auto-seed planet ownership grids for any body in PLANET_RESIDENTS
  // whose residents are now alive. Without this, Mars/Moon/etc only
  // start evolving once the player visits, and the off-screen tick has
  // nothing to iterate over.
  if (typeof PLANET_RESIDENTS !== "undefined" && typeof rebuildPlanetOwnership === "function") {
    if (!state.planetOwnership) state.planetOwnership = {};
    for (const planetName of Object.keys(PLANET_RESIDENTS)) {
      if (state.planetOwnership[planetName]) continue;
      state.planetOwnership[planetName] = rebuildPlanetOwnership(planetName);
    }
    if (typeof SOLAR_ORBITS !== "undefined") {
      for (const body of SOLAR_ORBITS) {
        if (!body || !body.name || body.name === "Sun" || body.name === "Earth") continue;
        if (state.planetOwnership[body.name]) continue;
        state.planetOwnership[body.name] = rebuildPlanetOwnership(body.name);
      }
    }
    for (const [planetName, grid] of Object.entries(state.planetOwnership)) {
      if (planetName === "Earth") continue;
      const allowedIds = new Set();
      for (const c of state.civs) {
        if (!c.alive) continue;
        let hasPresence = false;
        for (const s of (c.settlements || [])) {
          if ((s.planet || "Earth") === planetName) { hasPresence = true; break; }
        }
        if (!hasPresence) {
          for (const a of (c.armies || [])) {
            if ((a.planet || "Earth") === planetName) { hasPresence = true; break; }
          }
        }
        if (hasPresence) allowedIds.add(c.id);
      }
      for (let r = 0; r < ROWS; r++) {
        for (let cc = 0; cc < COLS; cc++) {
          const o = grid[r][cc];
          if (o === -1) continue;
          if (!allowedIds.has(o)) grid[r][cc] = -1;
        }
      }
    }
  }

  if (state.planetOwnership) {
    const _curPlanetName = state.currentPlanet || "Earth";
    if (_curPlanetName !== "Earth") {
      if (!state._earthOwnership) state._earthOwnership = state.planetOwnership["Earth"];
      if (state._earthOwnership) state.planetOwnership["Earth"] = state._earthOwnership;
    }
    for (const [planetName, grid] of Object.entries(state.planetOwnership)) {
      if (planetName === _curPlanetName) continue;
      const planetIsEarth = planetName === "Earth";

      for (const civ of state.civs) {
        if (!civ.alive) continue;
        const planetArmies = (civ.armies || []).filter(a => (a.planet || "Earth") === planetName);
        if (planetArmies.length === 0) continue;
        for (const army of planetArmies) {
          for (let step = 0; step < 2; step++) {
            const ns = neighbors(army.col, army.row);
            const own = [], unowned = [], hostile = [];
            for (const [c, r] of ns) {
              const okBiome = planetIsEarth
                ? (civ.aquaticOnly ? (MAP[r][c] === "ocean") : PASSABLE(MAP[r][c]))
                : true;
              if (!okBiome) continue;
              const o = grid[r][c];
              if (o === -1) unowned.push([c, r]);
              else if (o === civ.id) own.push([c, r]);
              else hostile.push([c, r, o]);
            }
            let target = null, attack = null;
            if (unowned.length) target = unowned[Math.floor(Math.random() * unowned.length)];
            else if (hostile.length && Math.random() < 0.5) {
              attack = hostile[Math.floor(Math.random() * hostile.length)];
              target = [attack[0], attack[1]];
            } else if (own.length) target = own[Math.floor(Math.random() * own.length)];
            if (!target) break;
            const [nc, nr] = target;
            if (attack) {
              const defenderId = attack[2];
              const defenderCiv = state.civs[civIndexById(defenderId)];
              const attStr = (army.count || 1) * (1 + 0.15 * (civ.era || 0));
              const defStr = (defenderCiv ? 2 * (1 + 0.15 * (defenderCiv.era || 0)) : 1);
              const win = attStr * (0.7 + Math.random() * 0.6) > defStr;
              if (!win) { army.count = Math.max(0, (army.count || 1) - 1); break; }
              const defArmies = (defenderCiv && defenderCiv.armies) ? defenderCiv.armies.filter(a => a.col === nc && a.row === nr && (a.planet || "Earth") === planetName) : [];
              for (const da of defArmies) {
                const i = defenderCiv.armies.indexOf(da);
                if (i >= 0) defenderCiv.armies.splice(i, 1);
              }
              const defSettlement = (defenderCiv && defenderCiv.settlements) ? defenderCiv.settlements.find(s => s.col === nc && s.row === nr && (s.planet || "Earth") === planetName) : null;
              if (defSettlement) {
                const i = defenderCiv.settlements.indexOf(defSettlement);
                if (i >= 0) defenderCiv.settlements.splice(i, 1);
                civ.settlements.push({ ...defSettlement, pop: Math.max(1, Math.floor((defSettlement.pop || 1) * 0.6)), queue: [], walls: false });
              }
              grid[nr][nc] = civ.id;
            } else if (grid[nr][nc] === -1) {
              grid[nr][nc] = civ.id;
            }
            army.prevCol = army.col;
            army.prevRow = army.row;
            army.moveStartedAt = performance.now();
            army.col = nc;
            army.row = nr;
            if (army.count <= 0) break;
          }
        }
      }

      if (state.turn % 5 === 0) {
        for (const civ of state.civs) {
          if (!civ.alive) continue;
          if (civ.cantMakeUnits || civ.name === "Nuclear Wasteland") continue;
          for (const s of (civ.settlements || [])) {
            if ((s.planet || "Earth") !== planetName) continue;
            civ.armies.push({
              id: nextArmyId++, col: s.col, row: s.row,
              type: "modern", count: 3, civId: civ.id, moves: 0, planet: planetName,
            });
          }
        }
      }

      const civTiles = new Map();
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = grid[r][c];
          if (id < 0) continue;
          if (!civTiles.has(id)) civTiles.set(id, []);
          const arr = civTiles.get(id);
          if (arr.length < 60) arr.push([c, r]);
          else if (Math.random() < 0.05) arr[Math.floor(Math.random() * 60)] = [c, r];
        }
      }
      for (const [id, tiles] of civTiles) {
        const civ = state.civs[civIndexById(id)];
        if (!civ || !civ.alive) continue;
        for (let attempt = 0; attempt < 3; attempt++) {
          const [bc, br] = tiles[Math.floor(Math.random() * tiles.length)];
          const ns = neighbors(bc, br);
          let claimed = false;
          for (const [nc, nr] of ns) {
            if (grid[nr][nc] !== -1) continue;
            if (planetIsEarth) {
              if (civ.aquaticOnly) { if (MAP[nr][nc] !== "ocean") continue; }
              else { if (!PASSABLE(MAP[nr][nc])) continue; }
            }
            grid[nr][nc] = id;
            claimed = true;
            break;
          }
          if (claimed) break;
        }
      }
    }
  }

  
  
  if (state.turn % 10 === 0 && state.factions && state.factions.length > 0) {
    const recruitConfigs = [
      { name: "NATO", anchor: "Germany" },
      { name: "CSTO", anchor: "Russia" },
    ];
    for (const cfg of recruitConfigs) {
      const faction = state.factions.find(f => f.name === cfg.name);
      if (!faction) continue;
      const anchorCiv = state.civs.find(c => c.alive && (c.name === cfg.anchor || (c.previousNames || []).includes(cfg.anchor)));
      if (!anchorCiv) continue;
      const memberIdSet = new Set(faction.memberIds);
      for (const candidate of state.civs) {
        if (!candidate.alive || candidate.isPlayer) continue;
        if (memberIdSet.has(candidate.id)) continue;
        if (findFactionForCiv(candidate.id)) continue;   
        const rel = candidate.relations[anchorCiv.id] || 0;
        if (rel < 0) continue;                           
        if (Math.random() > 0.04) continue;              

        const acceptChance = 0.3 + Math.min(1, rel / 100) * 0.5;
        if (Math.random() > acceptChance) {
          log("event", candidate.name + " declines an invitation to join " + cfg.name + ".");
          continue;
        }
        faction.memberIds.push(candidate.id);
        memberIdSet.add(candidate.id);
        for (const memberId of faction.memberIds) {
          if (memberId === candidate.id) continue;
          const m = state.civs.find(c => c.id === memberId && c.alive);
          if (!m) continue;
          candidate.relations[m.id] = 100;
          m.relations[candidate.id] = 100;
        }
        log("peace", candidate.name + " joins " + cfg.name + ".");
      }
    }
  }

  

  
  
  if (state.turn % 5 === 0) {

    

    
    
    const SPLIT_BLOCKLIST = new Set(["Rome", "Western Rome", "Romano-Goths", "Nuclear Wasteland", "Cockroach Tribe", "Cockroach Empire", "Squid Tribe", "Squid Empire"]);
    for (const civ of state.civs.slice()) {
      if (!civ.alive || civ.isPlayer) continue;
      if (civ.isStartingTribe) continue;
      if (SPLIT_BLOCKLIST.has(civ.name)) continue;
      if ((civ.previousNames || []).some(n => SPLIT_BLOCKLIST.has(n))) continue;
      if (civ.foundedYear == null || civ.lastChangeYear == null) continue;
      const lifespan = state.year - civ.foundedYear;
      const stale = state.year - civ.lastChangeYear;
      if (lifespan < 1200) continue;     
      if (stale < 300) continue;         
      const tiles = countTiles(civ);
      let pieces = 0;
      if (tiles >= 1500) pieces = 4;
      else if (tiles >= 800) pieces = 3;
      else if (tiles >= 250) pieces = 2;
      else continue;                     

      

      
      let chance = pieces === 4 ? 0.65 :
                   pieces === 3 ? 0.40 :
                   0.22;
      const componentCount = (civ._components || []).length;
      if (componentCount >= 2) {

        chance = Math.min(0.92, chance * 1.7);
      }
      if (Math.random() < chance) splitCiv(civ, pieces);
    }
  }

  if (player && player.isPlayer && player.settlements.length === 0 && player.armies.length === 0) {
    state.phase = "gameover";
    log("death", "Your people have been wiped from history. Game over.");
  }

  invalidateTintCache();
  render();
  updateUI();
  const _tickMs = performance.now() - _tickStart;
  if (_tickMs > 80) {
    const aliveCivs = state.civs.filter(c => c.alive).length;
    const armies = state.civs.reduce((s, c) => s + (c.alive ? c.armies.length : 0), 0);
    console.warn(`slow tick: ${_tickMs.toFixed(1)}ms · year ${state.year} · ${aliveCivs} civs · ${armies} armies`);
  }
}

function aiTurn(civ) {

  if (civ.cantMakeUnits || civ.name === "Nuclear Wasteland") {
    civ.armies = [];
    for (const s of civ.settlements) {
      s.queue = (s.queue || []).filter(q => q.type === "wall");
    }
    return;
  }

  for (const s of civ.settlements) {
    if (s.queue.length > 0) continue;
    const totalUnits = civ.armies.reduce((a, b) => a + b.count, 0);
    const settlements = civ.settlements.length;
    const wantsExpand = settlements < 3 + civ.era && Math.random() < 0.4;
    const wantsArmy = totalUnits < settlements * 3 + civ.era * 2;
    if (civ.era >= 6 && state.year >= 2050 && !civ.aquaticOnly && Math.random() < 0.18) {
      s.queue.push({ type: "rocket_scraps", progress: 0 });
    } else if (wantsExpand) {
      s.queue.push({ type: "settler", progress: 0 });
    } else if (wantsArmy || Math.random() < 0.7) {
      s.queue.push({ type: bestUnitForEra(civ.era), progress: 0 });
    }
  }

  if (!civ.isPlayer && civ.era >= 6 && state.year >= 2050 && !civ.aquaticOnly) {
    aiTryLaunchRocket(civ);
  }

  
  const claimedTargets = new Set();

  
  let manualArmyIds = null;
  if (civ.isPlayer && state.selectedTile) {
    const { col, row } = state.selectedTile;
    manualArmyIds = new Set(
      civ.armies.filter(a => a.col === col && a.row === row).map(a => a.id)
    );
  }

  const _curPlanet = state.currentPlanet || "Earth";
  for (const army of civ.armies.slice()) {
    if (army.moves <= 0) continue;
    if ((army.planet || "Earth") !== _curPlanet) continue;
    if (army.type === "leader") continue;
    if (manualArmyIds && manualArmyIds.has(army.id)) continue;
    if (army.type === "colonizer") {

      const target = findExpansionTile(civ, army.col, army.row, claimedTargets);
      if (!target) continue;
      claimedTargets.add(target.row * COLS + target.col);

      while (army.moves > 0) {
        if (army.col === target.col && army.row === target.row) break;
        const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, true);
        if (!step) break;
        const before = army.moves;
        
        tryMoveOrAttack(army, step.col, step.row);
        
        if (army.moves >= before) break;
      }
      continue;
    }
    if (army.type === "settler") {
      
      const target = findExpansionTile(civ, army.col, army.row);
      if (target) {
        const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, true);
        if (step) {
          setArmyTile(army, step.col, step.row);
          army.moves = 0;
          
          if (army.col === target.col && army.row === target.row && state.ownership[army.row][army.col] !== civ.id) {
            placeCivOnMap(civ, army.col, army.row, false);
            
            const i = civ.armies.indexOf(army);
            if (i >= 0) civ.armies.splice(i, 1);
          } else if (army.col === target.col && army.row === target.row) {
            placeCivOnMap(civ, army.col, army.row, false);
            const i = civ.armies.indexOf(army);
            if (i >= 0) civ.armies.splice(i, 1);
          }
        }
      }
    } else if (civ.aquaticOnly) {
      const ns = neighbors(army.col, army.row);
      let claimed = false;
      for (const [nc, nr] of ns) {
        if (MAP[nr][nc] !== "ocean") continue;
        if (state.ownership[nr][nc] !== -1) continue;
        tryMoveOrAttack(army, nc, nr);
        claimed = true;
        break;
      }
      if (!claimed) {
        const target = findExpansionTile(civ, army.col, army.row);
        if (target) {
          const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, false);
          if (step) tryMoveOrAttack(army, step.col, step.row);
        } else if (Math.random() < 0.3) {
          const oceanOpts = ns.filter(([c, r]) => MAP[r][c] === "ocean");
          if (oceanOpts.length) {
            const [nc, nr] = oceanOpts[Math.floor(Math.random() * oceanOpts.length)];
            tryMoveOrAttack(army, nc, nr);
          }
        }
      }
      if (MAP[army.row][army.col] === "ocean" && state.ownership[army.row][army.col] === civ.id) {
        let nearCity = false;
        for (const s of civ.settlements) {
          const dx = Math.abs(s.col - army.col);
          const dy = Math.abs(s.row - army.row);
          if (Math.max(dx, dy) < 6) { nearCity = true; break; }
        }
        if (!nearCity && civ.settlements.length < 60 && Math.random() < 0.04) {
          placeCivOnMap(civ, army.col, army.row, false);
        }
      }
    } else {
      const enemy = findNearbyEnemy(civ, army.col, army.row, 6);
      if (enemy && shouldAttack(civ, enemy.civ, army)) {
        const step = stepTowards(army.col, army.row, enemy.col, enemy.row, civ.id, false);
        if (step) {
          tryMoveOrAttack(army, step.col, step.row);
        }
      } else {

        if (Math.random() < 0.3) {
          const opts = neighbors(army.col, army.row).filter(([c, r]) => PASSABLE(MAP[r][c]));
          if (opts.length) {
            const [nc, nr] = opts[Math.floor(Math.random() * opts.length)];
            tryMoveOrAttack(army, nc, nr);
          }
        }
      }
    }
  }
}

function playerLeaderAssist(civ) {
  
  const colonizerCount = civ.armies.reduce((s, a) => s + (a.type === "colonizer" ? a.count : 0), 0);
  const settlerCount   = civ.armies.reduce((s, a) => s + (a.type === "settler"   ? a.count : 0), 0);
  const combatCount    = civ.armies.reduce((s, a) => s + (a.type !== "settler" && a.type !== "colonizer" && a.type !== "leader" ? a.count : 0), 0);
  
  let hasFrontier = false;
  for (const s of civ.settlements) {
    if (findExpansionTile(civ, s.col, s.row)) { hasFrontier = true; break; }
  }
  
  let hasEnemy = false;
  for (const s of civ.settlements) {
    if (findNearbyEnemy(civ, s.col, s.row, 10)) { hasEnemy = true; break; }
  }
  for (const s of civ.settlements) {
    if (s.queue.length > 0) continue;
    const settlements = civ.settlements.length;
    
    if (hasEnemy && combatCount < settlements * 4 + civ.era * 2) {
      s.queue.push({ type: bestUnitForEra(civ.era), progress: 0 });
    } else if (hasFrontier && colonizerCount < settlements * 2 + 2 && Math.random() < 0.5) {
      s.queue.push({ type: "colonizer", progress: 0 });
    } else if (hasFrontier && settlerCount < 2 && Math.random() < 0.5) {
      s.queue.push({ type: "settler", progress: 0 });
    } else {
      
      s.queue.push({ type: bestUnitForEra(civ.era), progress: 0 });
    }
  }

  
  
  let manualArmyIds = null;
  if (state.selectedTile) {
    const { col, row } = state.selectedTile;
    manualArmyIds = new Set(
      civ.armies.filter(a => a.col === col && a.row === row).map(a => a.id)
    );
  }
  const claimedTargets = new Set();

  for (const army of civ.armies.slice()) {
    if (army.moves <= 0) continue;
    if (army.type === "leader") continue;                       
    if (manualArmyIds && manualArmyIds.has(army.id)) continue;  

    if (army.type === "colonizer") {
      const target = findExpansionTile(civ, army.col, army.row, claimedTargets);
      if (!target) continue;
      claimedTargets.add(target.row * COLS + target.col);
      while (army.moves > 0) {
        if (army.col === target.col && army.row === target.row) break;
        const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, true);
        if (!step) break;
        const before = army.moves;
        tryMoveOrAttack(army, step.col, step.row);   
        if (army.moves >= before) break;
      }
      continue;
    }

    if (army.type === "settler") {

      const settlerOk = civ.aquaticOnly ? (MAP[army.row][army.col] === "ocean") : PASSABLE(MAP[army.row][army.col]);
      if (state.ownership[army.row][army.col] === -1 && settlerOk) {
        placeCivOnMap(civ, army.col, army.row, false);
        const i = civ.armies.indexOf(army);
        if (i >= 0) civ.armies.splice(i, 1);
        continue;
      }
      const target = findExpansionTile(civ, army.col, army.row);
      if (!target) continue;
      const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, true);
      if (!step) continue;
      setArmyTile(army, step.col, step.row);
      army.moves = 0;
      if (army.col === target.col && army.row === target.row) {
        placeCivOnMap(civ, army.col, army.row, false);
        const i = civ.armies.indexOf(army);
        if (i >= 0) civ.armies.splice(i, 1);
      }
      continue;
    }

    const enemy = findNearbyEnemy(civ, army.col, army.row, 10);
    if (enemy && (civ.relations[enemy.civ.id] || 0) < 80) {
      const step = stepTowards(army.col, army.row, enemy.col, enemy.row, civ.id, false);
      if (step) tryMoveOrAttack(army, step.col, step.row);
      continue;
    }
    
    const target = findExpansionTile(civ, army.col, army.row);
    if (target) {
      const step = stepTowards(army.col, army.row, target.col, target.row, civ.id, true);
      if (step) tryMoveOrAttack(army, step.col, step.row);
    }
  }
}

function shouldAttack(myCiv, theirCiv, myArmy) {
  if (theirCiv.id === myCiv.id) return false;

  
  if (state.warFocus && state.warFocus[myCiv.id] === theirCiv.id) return true;
  const rel = myCiv.relations[theirCiv.id] || 0;
  if (rel >= 80) return false;             
  if (rel > 30) return false;              

  if (!state.isWartime) {
    return rel < -50;
  }
  
  const aggression = 0.3 + (myCiv.stability < 50 ? 0.2 : 0);
  if (rel < -30) return true;
  return Math.random() < aggression;
}

function tileInGoalRegion(c, r, region) {
  if (!region) return false;
  const lat = LAT_TOP - (r + 0.5) * (LAT_SPAN / ROWS);
  const lon = -180 + (c + 0.5) * (360 / COLS);
  if (lat < region.lat[0] || lat > region.lat[1]) return false;
  if (lon < region.lon[0] || lon > region.lon[1]) return false;
  return true;
}

function goalScore(civ, c, r) {
  if (!civ.expansionGoals || civ.expansionGoals.length === 0) return 0;
  let bonus = 0;
  for (const goal of civ.expansionGoals) {
    if (tileInGoalRegion(c, r, goal.region)) bonus += goal.priority * 30;
  }
  return bonus;
}

function findExpansionTile(civ, col, row, claimedTargets) {
  let best = null, bestScore = -1;
  
  const RADIUS = civ.expansionGoals && civ.expansionGoals.length > 0 ? 10 : 6;

  
  
  const CAPITAL_RANGE = civ.expansionGoals && civ.expansionGoals.length > 0 ? 24 : 12;
  const cap = civ.settlements && civ.settlements.length > 0 ? civ.settlements[0] : null;
  for (let dr = -RADIUS; dr <= RADIUS; dr++) {
    for (let dc = -RADIUS; dc <= RADIUS; dc++) {
      const r = row + dr;
      if (r < 0 || r >= ROWS) continue;
      const c = ((col + dc) % COLS + COLS) % COLS;
      // Aquatic-only civs (Squid) expand into ocean tiles only.
      if (civ && civ.aquaticOnly) {
        if (MAP[r][c] !== "ocean") continue;
      } else {
        if (!PASSABLE(MAP[r][c])) continue;
      }
      if (state.ownership[r][c] !== -1) continue;
      if (claimedTargets && claimedTargets.has(r * COLS + c)) continue;
      
      if (cap) {
        const capDist = Math.abs(cap.col - c) + Math.abs(cap.row - r);
        if (capDist > CAPITAL_RANGE) continue;
      }
      const food = BIOME_FOOD[MAP[r][c]] || 0;
      const dist = Math.abs(dr) + Math.abs(dc);
      const score = food * 4 - dist;
      
      let near = 0;
      for (const s of civ.settlements) {
        const sd = Math.abs(s.col - c) + Math.abs(s.row - r);
        if (sd < 4) near -= (4 - sd) * 3; 
      }

      let allyPenalty = 0;
      for (const [nc, nr] of neighbors(c, r)) {
        const o = state.ownership[nr][nc];
        if (o >= 0 && o !== civ.id && (civ.relations[o] || 0) >= 80) {
          allyPenalty += 8;
        }
      }
      const total = score + near + goalScore(civ, c, r) - allyPenalty;
      if (total > bestScore) { bestScore = total; best = { col: c, row: r }; }
    }
  }
  return best;
}

function findNearbyEnemy(civ, col, row, maxDist) {

  
  
  if (state.warFocus && state.warFocus[civ.id] !== undefined) {
    const player = state.civs.find(c => c.id === state.warFocus[civ.id] && c.alive);
    if (player) {
      let best = null, bestD = Infinity;
      for (const s of player.settlements) {
        const d = Math.abs(s.col - col) + Math.abs(s.row - row);
        if (d < bestD) { bestD = d; best = { col: s.col, row: s.row, civ: player }; }
      }
      if (best) return best;
    } else {
      
      delete state.warFocus[civ.id];
    }
  }
  let best = null, bestScore = -Infinity;
  for (const other of state.civs) {
    if (!other.alive || other.id === civ.id) continue;
    
    if ((civ.relations[other.id] || 0) >= 80) continue;
    for (const s of other.settlements) {
      const d = Math.abs(s.col - col) + Math.abs(s.row - row);
      if (d > maxDist) continue;
      
      const score = -d + goalScore(civ, s.col, s.row);
      if (score > bestScore) {
        best = { col: s.col, row: s.row, civ: other };
        bestScore = score;
      }
    }
  }
  return best;
}

function stepTowards(fromC, fromR, toC, toR, civId, preferOwn) {
  const civ = state.civs[civIndexById(civId)];
  let best = null, bestScore = Infinity;
  for (const [nc, nr] of neighbors(fromC, fromR)) {
    if (!canMoveInto(civ, MAP[nr][nc])) continue;
    const owner = state.ownership[nr][nc];
    const d = Math.abs(nc - toC) + Math.abs(nr - toR);
    let penalty = 0;
    if (preferOwn && owner !== civId && owner !== -1) penalty = 10;
    
    if (MAP[nr][nc] === "ocean") penalty += 2;
    if (d + penalty < bestScore) { bestScore = d + penalty; best = { col: nc, row: nr }; }
  }
  return best;
}

function setArmyTile(army, col, row) {

  const dc = Math.abs(col - army.col);
  const dr = Math.abs(row - army.row);
  if (dc <= 2 && dr <= 2) {
    army.prevCol = army.col;
    army.prevRow = army.row;
    army.moveStartedAt = performance.now();
  } else {
    army.prevCol = col;
    army.prevRow = row;
    army.moveStartedAt = 0;
  }
  army.col = col;
  army.row = row;
}

function sameFaction(civAId, civBId) {
  if (civAId === civBId) return false;
  if (!state.factions || state.factions.length === 0) return false;
  for (const f of state.factions) {
    if (f.memberIds && f.memberIds.indexOf(civAId) >= 0 && f.memberIds.indexOf(civBId) >= 0) return true;
  }
  return false;
}

function tryMoveOrAttack(army, toC, toR) {
  if (army.type === "rocket_scraps") return false;
  const civ = state.civs[civIndexById(army.civId)];
  if (civ && (civ.cantMoveUnits || civ.name === "Nuclear Wasteland")) return false;
  if (!canMoveInto(civ, MAP[toR][toC])) return false;
  const unitDef = UNITS[army.type];
  const _offEarthMove = state.currentPlanet && state.currentPlanet !== "Earth";

  if (!_offEarthMove && MAP[toR][toC] === "ocean") {
    // Aquatic-only civs (Squid Empire) claim unowned ocean tiles and
    // fight rival ocean-owners. Other civs just transit.
    if (civ && civ.aquaticOnly) {
      const oceanOwner = state.ownership[toR][toC];
      if (oceanOwner === army.civId || oceanOwner === -1) {
        setArmyTile(army, toC, toR);
        army.moves = Math.max(0, army.moves - 1);
        if (oceanOwner === -1) state.ownership[toR][toC] = army.civId;
        return true;
      }
      if (sameFaction(army.civId, oceanOwner)) {
        setArmyTile(army, toC, toR);
        army.moves = Math.max(0, army.moves - 1);
        return true;
      }
      resolveCombat(army, toC, toR);
      army.moves = 0;
      return true;
    }
    setArmyTile(army, toC, toR);
    army.moves = Math.max(0, army.moves - 1);
    return true;
  }
  const owner = state.ownership[toR][toC];
  if (owner === army.civId || owner === -1) {
    setArmyTile(army, toC, toR);
    army.moves = Math.max(0, army.moves - 1);
    if (owner === -1) {
      state.ownership[toR][toC] = army.civId;

      if (unitDef && unitDef.claimsProvince) {
        claimProvinceForCiv(toC, toR, army.civId);
      }
    }
    return true;
  }

  
  
  if (civ && sameFaction(army.civId, owner)) {
    setArmyTile(army, toC, toR);
    army.moves = Math.max(0, army.moves - 1);
    return true;
  }
  
  if (civ && state.militaryAccess && state.militaryAccess[army.civId] && state.militaryAccess[army.civId][owner]) {
    setArmyTile(army, toC, toR);
    army.moves = Math.max(0, army.moves - 1);
    return true;
  }

  if (civ && (civ.relations[owner] || 0) >= 80) {
    army.moves = 0;   
    return false;
  }

  

  if (civ && civ.isPlayer) {
    const formallyDeclared = state.playerWars && state.playerWars.has(owner);
    const rel = civ.relations[owner] || 0;
    const atWar = formallyDeclared || rel <= -50;
    if (!atWar) {
      army.moves = 0;
      return false;
    }
  }
  
  resolveCombat(army, toC, toR);
  army.moves = 0;
  return true;
}

function claimProvinceForCiv(col, row, civId) {
  if (!provinceGrid || !provinceBoxes) return;
  const px = col * TILE + (TILE >> 1);
  const py = row * TILE + (TILE >> 1);
  const pid = provinceGrid[py * MAP_W + px];
  if (pid === 0) return;
  const off = pid * 4;
  const x0 = provinceBoxes[off], y0 = provinceBoxes[off + 1];
  const x1 = provinceBoxes[off + 2], y1 = provinceBoxes[off + 3];
  if (x1 < 0) return;
  
  const cLo = Math.max(0, Math.floor(x0 / TILE));
  const cHi = Math.min(COLS - 1, Math.floor(x1 / TILE));
  const rLo = Math.max(0, Math.floor(y0 / TILE));
  const rHi = Math.min(ROWS - 1, Math.floor(y1 / TILE));
  for (let r = rLo; r <= rHi; r++) {
    for (let c = cLo; c <= cHi; c++) {
      if (state.ownership[r][c] !== -1) continue;
      if (MAP[r][c] === "ocean") continue;   
      const ppx = c * TILE + (TILE >> 1);
      const ppy = r * TILE + (TILE >> 1);
      if (provinceGrid[ppy * MAP_W + ppx] === pid) {
        state.ownership[r][c] = civId;
      }
    }
  }
}

function resolveCombat(attackerArmy, toC, toR) {
  const defenderCivId = state.ownership[toR][toC];
  if (defenderCivId < 0) return;
  const defenderCiv = state.civs[civIndexById(defenderCivId)];
  const attackerCiv = state.civs[civIndexById(attackerArmy.civId)];
  if (!defenderCiv || !defenderCiv.alive) return;
  if (!attackerCiv || !attackerCiv.alive) return;   

  const defArmies = defenderCiv.armies.filter(a => a.col === toC && a.row === toR && a.type !== "settler");
  const defSettlement = defenderCiv.settlements.find(s => s.col === toC && s.row === toR);

  let attStr = attackerArmy.count * (UNITS[attackerArmy.type]?.str || 1);
  attStr *= 1 + 0.15 * attackerCiv.era;
  let defStr = defArmies.reduce((sum, a) => sum + a.count * (UNITS[a.type]?.str || 1), 0);
  defStr *= 1 + 0.15 * defenderCiv.era;
  defStr += BIOME_DEFENSE[MAP[toR][toC]] * 5;
  if (defSettlement) {
    defStr += defSettlement.pop * 3;
    if (defSettlement.walls) defStr *= 1.5;
  }

  const roll = 0.7 + Math.random() * 0.6;
  const attackerWins = attStr * roll > defStr;

  
  
  const attLoss = Math.max(1, Math.floor(attackerArmy.count * (attackerWins ? 0.25 : 0.55)));
  attackerArmy.count = Math.max(0, attackerArmy.count - attLoss);
  if (attackerArmy.health == null) attackerArmy.health = 100;
  attackerArmy.health = Math.max(10, attackerArmy.health - (attackerWins ? 25 : 55));
  for (const d of defArmies) {
    if (d.health == null) d.health = 100;
    d.health = Math.max(10, d.health - (attackerWins ? 60 : 30));
  }

  if (attackerWins) {
    
    state.ownership[toR][toC] = attackerArmy.civId;
    for (const a of defArmies) {
      const i = defenderCiv.armies.indexOf(a);
      if (i >= 0) defenderCiv.armies.splice(i, 1);
    }
    if (defSettlement) {
      const i = defenderCiv.settlements.indexOf(defSettlement);
      if (i >= 0) defenderCiv.settlements.splice(i, 1);
      
      const captured = { ...defSettlement, pop: Math.max(1, Math.floor(defSettlement.pop * 0.6)), queue: [], walls: false };
      attackerCiv.settlements.push(captured);

      defenderCiv.stability -= 15;
      attackerCiv.stability += 3;
    }

    if (attackerArmy.count > 0) {
      attackerArmy.col = toC; attackerArmy.row = toR;
    }
    
    setRelation(attackerCiv, defenderCiv, -50);
  } else {
    
    const defLossPct = 0.2;
    for (const a of defArmies) {
      const loss = Math.max(1, Math.floor(a.count * defLossPct));
      a.count = Math.max(0, a.count - loss);
      if (a.count === 0) {
        const i = defenderCiv.armies.indexOf(a);
        if (i >= 0) defenderCiv.armies.splice(i, 1);
      }
    }
    
    setRelation(attackerCiv, defenderCiv, -30);
  }

  if (attackerArmy.count <= 0) {
    const i = attackerCiv.armies.indexOf(attackerArmy);
    if (i >= 0) attackerCiv.armies.splice(i, 1);
  }

  checkCapitulation(defenderCiv, attackerCiv);
  checkCapitulation(attackerCiv, defenderCiv);
}

function setRelation(a, b, delta) {
  a.relations[b.id] = Math.max(-100, Math.min(100, (a.relations[b.id] || 0) + delta));
  b.relations[a.id] = Math.max(-100, Math.min(100, (b.relations[a.id] || 0) + delta));
}

function countTilesByOwnerTag(civ) {
  if (typeof HOI4_CITIES === "undefined" || !provinceTile) return {};
  
  const pidToOwner = {};
  for (const sd of HOI4_CITIES) {
    if (!sd.owner) continue;
    for (const pid of sd.provinces || []) pidToOwner[pid] = sd.owner;
  }
  
  const counts = {};
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.ownership[r][c] !== civ.id) continue;

      
      const px = c * TILE + (TILE >> 1);
      const py = r * TILE + (TILE >> 1);
      const pid = provinceGrid ? provinceGrid[py * MAP_W + px] : 0;
      const tag = pidToOwner[pid];
      if (!tag) continue;
      counts[tag] = (counts[tag] || 0) + 1;
    }
  }
  return counts;
}

function fragmentCivByOwnerTag(loser, tilesByTag, winner) {
  
  const tagToCiv = {};
  for (const cv of state.civs) {
    if (!cv.alive) continue;
    const t = CIV_TAGS[cv.name];
    if (t && !tagToCiv[t]) tagToCiv[t] = cv;
  }

  
  const tagToName = (tag) => {
    
    for (const [name, t] of Object.entries(CIV_TAGS)) {
      if (t === tag) return name;
    }
    return tag;
  };

  for (const [tag, tileCount] of Object.entries(tilesByTag)) {
    if (tileCount < 3) continue;   
    let target = tagToCiv[tag];
    if (!target) {
      
      const successorName = tagToName(tag);
      
      let capCol = -1, capRow = -1;
      outer: for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] !== loser.id) continue;
          const px = c * TILE + (TILE >> 1);
          const py = r * TILE + (TILE >> 1);
          const pid = provinceGrid ? provinceGrid[py * MAP_W + px] : 0;
          const sd = (typeof HOI4_CITIES !== "undefined")
            ? HOI4_CITIES.find(s => (s.provinces || []).indexOf(pid) >= 0)
            : null;
          if (sd && sd.owner === tag && PASSABLE(MAP[r][c])) {
            capCol = c; capRow = r; break outer;
          }
        }
      }
      if (capCol < 0) continue;   
      target = makeCiv({ name: successorName, color: shiftColor(loser.color) });
      state.civs.push(target);
      applyFlagColor(target);
      
      for (const c of state.civs) {
        if (c.id !== target.id) {
          target.relations[c.id] = 0;
          c.relations[target.id] = 0;
        }
      }
      placeCivOnMap(target, capCol, capRow, false);
      tagToCiv[tag] = target;
    }
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] !== loser.id) continue;
        const px = c * TILE + (TILE >> 1);
        const py = r * TILE + (TILE >> 1);
        const pid = provinceGrid ? provinceGrid[py * MAP_W + px] : 0;
        const sd = (typeof HOI4_CITIES !== "undefined")
          ? HOI4_CITIES.find(s => (s.provinces || []).indexOf(pid) >= 0)
          : null;
        if (sd && sd.owner === tag) state.ownership[r][c] = target.id;
      }
    }
  }
  
  if (winner && winner.alive) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] === loser.id) state.ownership[r][c] = winner.id;
      }
    }
    loser.capitulatedTo = winner.id;
  }
}

function checkCapitulation(loser, winner) {
  if (!loser.alive) return;
  if (loser.settlements.length === 0) {
    // Some civs should never auto-fragment into HOI4 modern successors
    // when defeated - the post-apocalypse civs (Wasteland, Cockroach,
    // Squid) would otherwise resurrect USA / Russia / etc the moment
    // they lose a single skirmish.
    const NO_FRAGMENT = new Set(["Nuclear Wasteland", "Cockroach Tribe", "Cockroach Empire", "Squid Tribe", "Squid Empire"]);
    if (NO_FRAGMENT.has(loser.name) || (loser.previousNames || []).some(n => NO_FRAGMENT.has(n))) {
      if (winner && winner.alive) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (state.ownership[r][c] === loser.id) state.ownership[r][c] = winner.id;
          }
        }
        loser.capitulatedTo = winner.id;
      }
      loser.alive = false;
      loser.armies = [];
      return;
    }
    const tilesByTag = countTilesByOwnerTag(loser);
    const tagCount = Object.keys(tilesByTag).length;
    if (tagCount >= 2 && winner && winner.alive) {

      fragmentCivByOwnerTag(loser, tilesByTag, winner);
      loser.armies = [];
      loser.alive = false;
      log("death", `${loser.name} fragments into its historical successor states.`);
      invalidateTintCache();
      return;
    }
    
    if (winner && winner.alive) {
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] === loser.id) state.ownership[r][c] = winner.id;
        }
      }
      loser.capitulatedTo = winner.id;
    }
    loser.alive = false;
    
    loser.armies = [];
    log("death", `${loser.name} is destroyed and fades from history.`);
    invalidateTintCache();
    return;
  }
  
  const totalTiles = countTiles(loser);
  if (totalTiles <= 1 && loser.settlements.length === 1) {
    if (Math.random() < 0.3) {
      log("death", `${loser.name} capitulates to ${winner.name}.`);
      
      for (const s of loser.settlements) winner.settlements.push(s);
      for (const a of loser.armies) winner.armies.push({ ...a, civId: winner.id });
      
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] === loser.id) state.ownership[r][c] = winner.id;
        }
      }
      loser.settlements = [];
      loser.armies = [];
      loser.alive = false;
      loser.capitulatedTo = winner.id;
    }
  }
}

function countTiles(civ) {
  let n = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.ownership[r][c] === civ.id) n++;
    }
  }
  return n;
}

function civStrength(civ) {
  if (!civ || !civ.armies) return 0;
  let s = 0;
  for (const a of civ.armies) {
    if (a.type === "settler" || a.type === "colonizer" || a.type === "leader") continue;
    const def = (typeof UNITS !== "undefined") ? UNITS[a.type] : null;
    const power = (def && def.str) ? def.str : 1;
    s += (a.count || 0) * power;
  }
  return s;
}

function shiftColor(hex, pct) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return hex;
  const v = parseInt(m[1], 16);
  let r = (v >> 16) & 0xff, g = (v >> 8) & 0xff, b = v & 0xff;
  const t = Math.max(-1, Math.min(1, pct));
  if (t > 0) { r = Math.round(r + (255 - r) * t); g = Math.round(g + (255 - g) * t); b = Math.round(b + (255 - b) * t); }
  else { r = Math.round(r * (1 + t)); g = Math.round(g * (1 + t)); b = Math.round(b * (1 + t)); }
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

function splitCiv(civ, n) {
  if (n < 2) return;
  const tiles = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.ownership[r][c] === civ.id) tiles.push({ c, r });
    }
  }
  if (tiles.length < 50) return;

  

  
  const components = (civ._components || []).slice().sort((a, b) => b.tiles - a.tiles);
  let seeds = [];
  let coreIdx = 0;
  if (components.length >= 2) {
    const top = components.slice(0, Math.min(n, components.length));
    seeds = top.map(c => ({ c: c.col, r: c.row }));

    const cap = civ.settlements[0];
    if (cap) {
      let best = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dc = seeds[i].c - cap.col, dr = seeds[i].r - cap.row;
        const d = dc * dc + dr * dr;
        if (d < best) { best = d; coreIdx = i; }
      }
    } else {
      coreIdx = 0;   
    }
  } else {
    
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const t of tiles) {
      if (t.c < minC) minC = t.c; if (t.c > maxC) maxC = t.c;
      if (t.r < minR) minR = t.r; if (t.r > maxR) maxR = t.r;
    }
    const bw = Math.max(1, maxC - minC), bh = Math.max(1, maxR - minR);
    if (n === 2) {
      if (bw >= bh) { seeds.push({ c: minC + bw * 0.25, r: (minR + maxR) / 2 }); seeds.push({ c: minC + bw * 0.75, r: (minR + maxR) / 2 }); }
      else { seeds.push({ c: (minC + maxC) / 2, r: minR + bh * 0.25 }); seeds.push({ c: (minC + maxC) / 2, r: minR + bh * 0.75 }); }
    } else if (n === 3) {
      if (bw >= bh) {
        seeds.push({ c: minC + bw / 6, r: (minR + maxR) / 2 });
        seeds.push({ c: minC + bw / 2, r: (minR + maxR) / 2 });
        seeds.push({ c: minC + 5 * bw / 6, r: (minR + maxR) / 2 });
      } else {
        seeds.push({ c: (minC + maxC) / 2, r: minR + bh / 6 });
        seeds.push({ c: (minC + maxC) / 2, r: minR + bh / 2 });
        seeds.push({ c: (minC + maxC) / 2, r: minR + 5 * bh / 6 });
      }
    } else {
      seeds.push({ c: minC + bw * 0.25, r: minR + bh * 0.25 });
      seeds.push({ c: minC + bw * 0.75, r: minR + bh * 0.25 });
      seeds.push({ c: minC + bw * 0.25, r: minR + bh * 0.75 });
      seeds.push({ c: minC + bw * 0.75, r: minR + bh * 0.75 });
    }

    const cap = civ.settlements[0];
    if (cap) {
      let best = Infinity;
      for (let i = 0; i < seeds.length; i++) {
        const dc = seeds[i].c - cap.col, dr = seeds[i].r - cap.row;
        const d = dc * dc + dr * dr;
        if (d < best) { best = d; coreIdx = i; }
      }
    }
  }

  
  function uniqueName(candidate) {
    if (!state.civs.some(c => c.alive && c.name === candidate)) return candidate;
    const numerals = ["", " II", " III", " IV", " V", " VI", " VII", " VIII", " IX", " X"];
    for (let i = 1; i < numerals.length; i++) {
      const n = candidate + numerals[i];
      if (!state.civs.some(c => c.alive && c.name === n)) return n;
    }
    return candidate + " " + state.year;
  }
  function genProcName() {
    const starts = ["Vor","Kor","Bal","Tor","Mer","Lor","Sav","Mar","Cal","Drak","Esh","Hir","Lir","Mok","Nor","Pra","Quil","Riv","Stol","Tav","Ulv","Vas","Wen","Xan","Yor","Zor","Ari","Ber","Den","Eri","Fal","Gal","Hel","Iv","Jor","Kal","Liv","Mil","Olv","Pesh","Rud","Sver","Tym","Verch","Yel","Zaph","Tark","Brem","Olosh"];
    const mids = ["an","or","el","in","ar","ev","il","us","es","ich","yn","ov","im","ash"];
    const ends = ["ia","land","stan","burg","grad","ovia","esh","ova","ek","or","ier","av","ic","ovich","heim","mark","valdt","gard","ish","aria","ovny"];
    const useMid = Math.random() < 0.45;
    return starts[Math.floor(Math.random() * starts.length)]
      + (useMid ? mids[Math.floor(Math.random() * mids.length)] : "")
      + ends[Math.floor(Math.random() * ends.length)];
  }

  function genUnique() {
    for (let tries = 0; tries < 12; tries++) {
      const n = genProcName();
      if (!state.civs.some(c => c.alive && c.name === n)) return n;
    }
    return uniqueName(genProcName());
  }
  const newCivs = [];

  
  const splitParentName = civ.name;
  for (let i = 0; i < seeds.length; i++) {
    if (i === coreIdx) continue;
    const tint = shiftColor(civ.color, (i % 2 === 0 ? 0.18 : -0.18));
    const fresh = makeCiv({ name: genUnique(), color: tint });
    state.civs.push(fresh);
    fresh.foundedYear = state.year;
    fresh.lastChangeYear = state.year;
    fresh.era = civ.era;
    fresh.splitParentName = splitParentName;
    for (const c of state.civs) {
      if (c.id !== fresh.id) {
        fresh.relations[c.id] = (c.id === civ.id) ? 30 : 0;
        c.relations[fresh.id] = (c.id === civ.id) ? 30 : 0;
      }
    }

    const sCol = Math.max(0, Math.min(COLS - 1, Math.round(seeds[i].c)));
    const sRow = Math.max(0, Math.min(ROWS - 1, Math.round(seeds[i].r)));
    fresh.armies.push({ id: nextArmyId++, col: sCol, row: sRow, type: bestUnitForEra(fresh.era), count: 3, civId: fresh.id, moves: 1 });
    newCivs.push({ civ: fresh, seedIdx: i });
  }
  
  for (const t of tiles) {
    let bestI = 0, bestD = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const dc = seeds[i].c - t.c, dr = seeds[i].r - t.r;
      const d = dc * dc + dr * dr;
      if (d < bestD) { bestD = d; bestI = i; }
    }
    if (bestI === coreIdx) continue;   
    const target = newCivs.find(nc => nc.seedIdx === bestI);
    if (target) state.ownership[t.r][t.c] = target.civ.id;
  }
  reassignSettlementsByTileOwner();

  
  
  function plantCapitalIfEmpty(fragment, seedC, seedR) {
    if (fragment.settlements.length > 0) return;
    let bestC = -1, bestR = -1, bestD = Infinity;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] !== fragment.id) continue;
        if (!PASSABLE(MAP[r][c])) continue;
        const dc = c - seedC, dr = r - seedR;
        const d = dc * dc + dr * dr;
        if (d < bestD) { bestD = d; bestC = c; bestR = r; }
      }
    }
    if (bestC < 0) return;
    fragment.settlements.push({
      id: nextSettlementId++, col: bestC, row: bestR,
      name: settlementName(fragment, 0),
      pop: 3, food: 0, prod: 0, queue: [], walls: false,
    });
  }
  for (const nc of newCivs) plantCapitalIfEmpty(nc.civ, seeds[nc.seedIdx].c, seeds[nc.seedIdx].r);
  plantCapitalIfEmpty(civ, seeds[coreIdx].c, seeds[coreIdx].r);

  

  
  civ.lastChangeYear = state.year;
  invalidateTintCache();
  log("event", civ.name + " has fragmented into " + (newCivs.length + 1) + " successor states; " + civ.name + " endures while the breakaways form their own nations.");
}

function civIndexById(id) {
  return state.civs.findIndex(c => c.id === id);
}

const WAR_MODE_CONFIG = {
  WWI: {
    startYear: 1914,
    endYear: 1918,
    factions: [
      { name: "Allies (WWI)", color: "#1a4ba8",
        members: ["France", "United Kingdom", "Russian Empire", "Italy", "USA", "Serbia", "Romania", "Greece", "Belgium", "Yamato", "Kingdom of Portugal"] },
      { name: "Central Powers", color: "#7d1818",
        members: ["Germany", "Austria-Hungary", "Ottomans", "Bulgaria"] },
    ],
    description: "August 1914. Europe stands on the brink. The Triple Entente (France, United Kingdom, Russia) and the Central Powers (Germany, Austria-Hungary, Ottomans) are about to plunge the world into total war. Engage WWI mode? Time will slow, factions will lock, and the losing side will cede border territory to the winners.",
  },
  WWII: {
    startYear: 1939,
    endYear: 1945,
    factions: [
      { name: "Allies (WWII)", color: "#1a4ba8",
        members: ["USA", "United Kingdom", "France", "Soviet Union", "Republic of China", "Canada", "Australia", "Brazil", "Republic of Poland", "Greece", "Yugoslavia", "Mexico"] },
      { name: "Axis", color: "#181818",
        members: ["Nazi Germany", "Italy", "Yamato", "Hungary", "Romania", "Bulgaria", "Finland"] },
      { name: "Comintern", color: "#a02828",
        members: ["Soviet Union", "Mongolia"] },
    ],
    description: "September 1939. Nazi Germany invades Poland. The world is about to descend into the deadliest conflict in history. Engage WWII mode? The Allies, Axis, and Comintern factions will form, time will slow, and the losers will cede border territory at war's end.",
  },
};

let _origSpeedMs = null;

function maybeTriggerWarMode() {
  if (state.warMode) {
    
    const cfg = WAR_MODE_CONFIG[state.warMode];
    if (cfg && state.year >= cfg.endYear) endWarMode();
    return;
  }
  if (state._wwiPrompted !== true && state.year >= WAR_MODE_CONFIG.WWI.startYear && state.year < WAR_MODE_CONFIG.WWI.endYear) {
    state._wwiPrompted = true;
    showWarModePrompt("WWI");
  } else if (state._wwiiPrompted !== true && state.year >= WAR_MODE_CONFIG.WWII.startYear && state.year < WAR_MODE_CONFIG.WWII.endYear) {
    state._wwiiPrompted = true;
    showWarModePrompt("WWII");
  }
}

function showWarModePrompt(which) {
  const cfg = WAR_MODE_CONFIG[which];
  if (!cfg) return;
  
  state._preWarSpeed = state.speed;
  state.speed = 0;
  const modal = document.getElementById("warmode-modal");
  const title = document.getElementById("warmode-title");
  const body = document.getElementById("warmode-body");
  if (!modal || !title || !body) return;
  title.textContent = "⚔ " + which + " - " + cfg.startYear + " ⚔";
  body.textContent = cfg.description;
  modal.style.display = "flex";
  
  const accept = document.getElementById("warmode-accept");
  const decline = document.getElementById("warmode-decline");
  const newAccept = accept.cloneNode(true);
  const newDecline = decline.cloneNode(true);
  accept.parentNode.replaceChild(newAccept, accept);
  decline.parentNode.replaceChild(newDecline, decline);
  newAccept.addEventListener("click", () => {
    modal.style.display = "none";
    enterWarMode(which);
  });
  newDecline.addEventListener("click", () => {
    modal.style.display = "none";
    state.speed = state._preWarSpeed || 1;
    log("event", which + " mode declined - history continues at normal pace.");
  });
}

function enterWarMode(which) {
  const cfg = WAR_MODE_CONFIG[which];
  if (!cfg) return;
  state.warMode = which;
  state._warModeStart = state.year;

  for (const f of cfg.factions) {
    fireEvent({ type: "form_faction", name: f.name, color: f.color, members: f.members,
      message: f.name + " forms in response to " + which + "." });
  }

  

  

  const WAR_SPEEDS = [Infinity, 5000, 3000, 2000, 1500, 1000, 500];
  if (typeof SPEED_TURN_MS !== "undefined") {
    _origSpeedMs = SPEED_TURN_MS.slice();
    for (let i = 0; i < SPEED_TURN_MS.length && i < WAR_SPEEDS.length; i++) {
      SPEED_TURN_MS[i] = WAR_SPEEDS[i];
    }
  }
  state.speed = state._preWarSpeed || 2;
  log("war", which + " MODE ENGAGED. Time slows; the world braces for war.");
}

function endWarMode() {
  if (!state.warMode) return;
  const which = state.warMode;
  const cfg = WAR_MODE_CONFIG[which];
  
  let winners = [], losers = [];
  if (cfg) {
    const factionScores = cfg.factions.map(f => {
      const live = state.factions.find(sf => sf.name === f.name);
      if (!live) return { name: f.name, members: [], score: 0 };
      const members = live.memberIds.map(id => state.civs.find(c => c.id === id && c.alive)).filter(Boolean);
      const score = members.reduce((s, c) => s + civStrength(c) + countTiles(c), 0);
      return { name: f.name, members, score, faction: live };
    });
    factionScores.sort((a, b) => b.score - a.score);
    if (factionScores.length >= 2) {
      winners = factionScores[0].members;
      for (let i = 1; i < factionScores.length; i++) losers = losers.concat(factionScores[i].members);
    }
  }

  const winnerIds = new Set(winners.map(c => c.id));
  const loserIds = new Set(losers.map(c => c.id));
  let transferred = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!loserIds.has(state.ownership[r][c])) continue;
      let bestNeighbour = -1;
      for (const [nc, nr] of neighbors(c, r)) {
        const o = state.ownership[nr][nc];
        if (winnerIds.has(o)) { bestNeighbour = o; break; }
      }
      if (bestNeighbour >= 0) {
        state.ownership[r][c] = bestNeighbour;
        transferred++;
      }
    }
  }
  reassignSettlementsByTileOwner();
  
  if (_origSpeedMs && typeof SPEED_TURN_MS !== "undefined") {
    for (let i = 0; i < SPEED_TURN_MS.length; i++) SPEED_TURN_MS[i] = _origSpeedMs[i];
    _origSpeedMs = null;
  }
  state.warMode = null;
  log("event", which + " ends. " + winners.length + " victors take " + transferred + " border tiles from the losers.");
  invalidateTintCache();
}

function checkInternalChaos(civ) {

  return;
}

function triggerCivilWar(civ) {
  
  const half = Math.floor(civ.settlements.length / 2);
  if (half < 1) return;
  
  const capital = civ.settlements[0];
  const sorted = civ.settlements.slice(1).sort((a, b) => {
    const da = Math.abs(a.col - capital.col) + Math.abs(a.row - capital.row);
    const db = Math.abs(b.col - capital.col) + Math.abs(b.row - capital.row);
    return db - da;
  });
  const rebels = sorted.slice(0, half);
  const rebelCiv = makeCiv({
    name: "Rebel " + civ.name,
    color: shiftColor(civ.color),
  });
  state.civs.push(rebelCiv);
  
  for (const c of state.civs) {
    if (c.id !== rebelCiv.id) {
      rebelCiv.relations[c.id] = c.id === civ.id ? -80 : 0;
      c.relations[rebelCiv.id] = c.id === civ.id ? -80 : 0;
    }
  }
  for (const s of rebels) {
    civ.settlements.splice(civ.settlements.indexOf(s), 1);
    rebelCiv.settlements.push(s);
    state.ownership[s.row][s.col] = rebelCiv.id;
    
    for (const [nc, nr] of neighbors(s.col, s.row)) {
      if (state.ownership[nr][nc] === civ.id) state.ownership[nr][nc] = rebelCiv.id;
    }
  }
  
  const myArmies = civ.armies.slice();
  for (const a of myArmies) {
    if (rebels.some(s => Math.abs(s.col - a.col) + Math.abs(s.row - a.row) < 5)) {
      civ.armies.splice(civ.armies.indexOf(a), 1);
      rebelCiv.armies.push({ ...a, civId: rebelCiv.id });
    }
  }
  rebelCiv.era = civ.era;
  rebelCiv.techPoints = Math.floor(civ.techPoints * 0.5);
  civ.stability = 50;
  log("war", `Civil war! Rebel ${civ.name} breaks away.`);
}

function triggerSplinter(civ) {
  
  const capital = civ.settlements[0];
  const distant = civ.settlements.slice(1).sort((a, b) => {
    const da = Math.abs(a.col - capital.col) + Math.abs(a.row - capital.row);
    const db = Math.abs(b.col - capital.col) + Math.abs(b.row - capital.row);
    return db - da;
  })[0];
  if (!distant) return;
  const splinterCiv = makeCiv({
    name: distant.name + " (free)",
    color: shiftColor(civ.color),
  });
  state.civs.push(splinterCiv);
  for (const c of state.civs) {
    if (c.id !== splinterCiv.id) {
      splinterCiv.relations[c.id] = c.id === civ.id ? -40 : 0;
      c.relations[splinterCiv.id] = c.id === civ.id ? -40 : 0;
    }
  }
  civ.settlements.splice(civ.settlements.indexOf(distant), 1);
  splinterCiv.settlements.push(distant);
  state.ownership[distant.row][distant.col] = splinterCiv.id;
  for (const [nc, nr] of neighbors(distant.col, distant.row)) {
    if (state.ownership[nr][nc] === civ.id) state.ownership[nr][nc] = splinterCiv.id;
  }
  splinterCiv.era = civ.era;
  log("event", `${distant.name} declares independence from ${civ.name}!`);
}

function shiftColor(hex) {
  
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  const out = [g, b, r].map(v => Math.min(255, Math.floor(v * 0.85 + 30)));
  return "#" + out.map(v => v.toString(16).padStart(2, "0")).join("");
}

const canvas = document.getElementById("map");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");

function setupCanvas() {
  const wrap = document.getElementById("map-wrap");
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  overlay.width = Math.floor(w * dpr);
  overlay.height = Math.floor(h * dpr);
  overlay.style.width = w + "px";
  overlay.style.height = h + "px";
  
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state._dpr = dpr;
  fitToView();
  buildCornerCache();
  buildBiomeCache();
}

function fitToView() {
  
  const dpr = state._dpr || 1;
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  view.zoom = Math.min(w / MAP_W, h / MAP_H);
  view.panX = (w - MAP_W * view.zoom) / 2;
  view.panY = (h - MAP_H * view.zoom) / 2;
}

let cornerCache = null;       
let edgeMidHCache = null;     
let edgeMidVCache = null;     

function _hash(a, b, salt) {
  let h = (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ (salt | 0)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 0x100000000;
}

function buildCornerCache() {

  const N = (COLS + 1) * (ROWS + 1);
  cornerCache = new Float32Array(N * 2);
  const CORNER_JITTER = 0.46;   
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      let x = c, y = r;
      const cWrap = c === COLS ? 0 : c;       
      
      if (r > 0 && r < ROWS) {
        x += (_hash(cWrap, r, 0xa17c) - 0.5) * CORNER_JITTER;
        y += (_hash(cWrap, r, 0xb24d) - 0.5) * CORNER_JITTER;
      }
      const i = (r * (COLS + 1) + c) * 2;
      cornerCache[i] = x;
      cornerCache[i + 1] = y;
    }
  }
  
  edgeMidHCache = new Float32Array(COLS * (ROWS + 1) * 2);
  const EDGE_JITTER = 0.22;
  for (let r = 0; r <= ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let mx = c + 0.5, my = r;
      if (r > 0 && r < ROWS) {
        mx += (_hash(c, r, 0xc189) - 0.5) * EDGE_JITTER;
        my += (_hash(c, r, 0xd2a4) - 0.5) * EDGE_JITTER;
      }
      const i = (r * COLS + c) * 2;
      edgeMidHCache[i] = mx;
      edgeMidHCache[i + 1] = my;
    }
  }
  
  edgeMidVCache = new Float32Array((COLS + 1) * ROWS * 2);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS; c++) {
      const cWrap = c === COLS ? 0 : c;
      let mx = c, my = r + 0.5;
      mx += (_hash(cWrap, r, 0xe315) - 0.5) * EDGE_JITTER;
      my += (_hash(cWrap, r, 0xf426) - 0.5) * EDGE_JITTER;
      const i = (r * (COLS + 1) + c) * 2;
      edgeMidVCache[i] = mx;
      edgeMidVCache[i + 1] = my;
    }
  }
}

function _corner(c, r, out) {
  const i = (r * (COLS + 1) + c) * 2;
  out[0] = cornerCache[i] * TILE;
  out[1] = cornerCache[i + 1] * TILE;
}
function _edgeH(c, r, out) {
  const i = (r * COLS + c) * 2;
  out[0] = edgeMidHCache[i] * TILE;
  out[1] = edgeMidHCache[i + 1] * TILE;
}
function _edgeV(c, r, out) {
  const i = (r * (COLS + 1) + c) * 2;
  out[0] = edgeMidVCache[i] * TILE;
  out[1] = edgeMidVCache[i + 1] * TILE;
}

const _tmp = [0, 0];
function pathTile(ctx, c, r) {
  _corner(c, r, _tmp);     ctx.moveTo(_tmp[0], _tmp[1]);
  _edgeH(c, r, _tmp);      ctx.lineTo(_tmp[0], _tmp[1]);
  _corner(c + 1, r, _tmp); ctx.lineTo(_tmp[0], _tmp[1]);
  _edgeV(c + 1, r, _tmp);  ctx.lineTo(_tmp[0], _tmp[1]);
  _corner(c + 1, r + 1, _tmp); ctx.lineTo(_tmp[0], _tmp[1]);
  _edgeH(c, r + 1, _tmp);  ctx.lineTo(_tmp[0], _tmp[1]);
  _corner(c, r + 1, _tmp); ctx.lineTo(_tmp[0], _tmp[1]);
  _edgeV(c, r, _tmp);      ctx.lineTo(_tmp[0], _tmp[1]);
}

let provinceGrid = null;            
let provinceTile = null;            
let provinceInfo = null;            
let provinceToState = null;         
let hoi4ProvinceImg = null;

async function loadProvinceGrid() {
  state.provinceStatus = "loading";
  updateProvinceStatusOverlay();
  try {

    
    const defResp = await fetch("map/definition.csv");
    if (!defResp.ok) throw new Error("HTTP " + defResp.status + " fetching map/definition.csv");
    const defText = await defResp.text();
    const rgbToPid = new Map();
    provinceInfo = [];
    for (const line of defText.split("\n")) {
      const parts = line.split(";");
      if (parts.length < 4) continue;
      const pid = parseInt(parts[0], 10);
      const r = parseInt(parts[1], 10);
      const g = parseInt(parts[2], 10);
      const b = parseInt(parts[3], 10);
      if (isNaN(pid) || isNaN(r) || isNaN(g) || isNaN(b)) continue;
      rgbToPid.set((r << 16) | (g << 8) | b, pid);
      provinceInfo[pid] = {
        id: pid,
        r, g, b,
        type: parts[4] ? parts[4].trim() : "unknown",
        coastal: parts[5] ? parts[5].trim() === "true" : false,
        terrain: parts[6] ? parts[6].trim() : "unknown",
        continent: parts[7] ? parseInt(parts[7], 10) : 0,
      };
    }
    console.log("[provinces] definition.csv:", rgbToPid.size, "provinces");

    provinceGrid = new Uint32Array(MAP_W * MAP_H);

    let usedFast = false;
    try {
      const fastImg = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("hoi4_province_ids.png missing"));
        im.src = "hoi4_province_ids.png";
      });
      if (fastImg.naturalWidth === MAP_W && fastImg.naturalHeight === MAP_H) {
        const c = document.createElement("canvas");
        c.width = MAP_W; c.height = MAP_H;
        const cx = c.getContext("2d");
        cx.imageSmoothingEnabled = false;
        cx.drawImage(fastImg, 0, 0);
        const data = cx.getImageData(0, 0, MAP_W, MAP_H).data;
        
        for (let i = 0, j = 0; i < provinceGrid.length; i++, j += 4) {
          provinceGrid[i] = data[j] | (data[j + 1] << 8) | (data[j + 2] << 16);
        }
        usedFast = true;
        console.log("[provinces] fast path: hoi4_province_ids.png decoded");
      }
    } catch (err) {
      console.warn("[provinces] fast path unavailable:", err.message, "- falling back to BMP");
    }

    if (!usedFast) {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = () => rej(new Error("Image load failed for map/provinces.bmp (browser may not support BMP, file may be missing, or the canvas was tainted)."));
        im.src = "map/provinces.bmp";
      });
      console.log("[provinces] provinces.bmp:", img.naturalWidth, "x", img.naturalHeight);

      const c = document.createElement("canvas");
      c.width = MAP_W;
      c.height = MAP_H;
      const cx = c.getContext("2d");
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0, MAP_W, MAP_H);
      const data = cx.getImageData(0, 0, MAP_W, MAP_H).data;

      let matched = 0, unmatched = 0;
      for (let i = 0, j = 0; i < provinceGrid.length; i++, j += 4) {
        const r = data[j], g = data[j + 1], b = data[j + 2];
        const rgb = (r << 16) | (g << 8) | b;
        const pid = rgbToPid.get(rgb);
        if (pid !== undefined) { provinceGrid[i] = pid; matched++; }
        else unmatched++;
      }
      console.log("[provinces] BMP decoded:", matched, "matched /", unmatched, "unmatched");
    }

    const N = 20000;
    const sxArr = new Float64Array(N), syArr = new Float64Array(N);
    const snArr = new Uint32Array(N);
    let maxPid = 0;
    for (let y = 0; y < MAP_H; y++) {
      const rowOff = y * MAP_W;
      for (let x = 0; x < MAP_W; x++) {
        const pid = provinceGrid[rowOff + x];
        if (pid === 0 || pid >= N) continue;
        sxArr[pid] += x; syArr[pid] += y; snArr[pid]++;
        if (pid > maxPid) maxPid = pid;
      }
    }
    provinceTile = new Int16Array((maxPid + 1) * 2);
    for (let pid = 0; pid <= maxPid; pid++) {
      if (snArr[pid] === 0) {
        provinceTile[pid * 2] = -1;
        provinceTile[pid * 2 + 1] = -1;
      } else {
        const ccx = sxArr[pid] / snArr[pid];
        const ccy = syArr[pid] / snArr[pid];
        provinceTile[pid * 2] = Math.min(COLS - 1, Math.max(0, Math.floor(ccx / TILE)));
        provinceTile[pid * 2 + 1] = Math.min(ROWS - 1, Math.max(0, Math.floor(ccy / TILE)));
      }
    }
    window.HOI4_MAX_PROVINCE_ID = maxPid;
    console.log("[provinces] centroids ready, max pid =", maxPid);

    computeProvinceBoxes();

    
    if (typeof HOI4_CITIES !== "undefined") {
      provinceToState = new Int32Array(maxPid + 1);
      for (const s of HOI4_CITIES) {
        if (!s.provinces) continue;
        for (const pid of s.provinces) {
          if (pid >= 0 && pid <= maxPid) provinceToState[pid] = s.id;
        }
      }
      console.log("[provinces] state lookup built");
    }

    
    const provinceTerrain = [];
    for (const p of provinceInfo) {
      if (p) provinceTerrain[p.id] = p.terrain;
    }
    MAP = buildMapFromProvinces(provinceTerrain);
    console.log("[provinces] biome MAP built from province terrains.");

    initOwnership();
    spawnHistoricalCivs();
    applyAllFlagColors();        

    buildBiomeCache();

    invalidateTintCache();
    state.provinceStatus = "ready";
    updateProvinceStatusOverlay();
    render();
    updateUI();
  } catch (e) {
    console.error("[provinces] grid load failed:", e);
    provinceGrid = null;
    provinceTile = null;
    state.provinceStatus = "failed:" + (e && e.message ? e.message : String(e));
    updateProvinceStatusOverlay();
  }
}

let provinceBoxes = null;   
function computeProvinceBoxes() {
  if (typeof HOI4_MAX_PROVINCE_ID === "undefined") return;
  const N = HOI4_MAX_PROVINCE_ID + 1;
  provinceBoxes = new Int32Array(N * 4);
  for (let pid = 0; pid < N; pid++) {
    provinceBoxes[pid * 4 + 0] = MAP_W;
    provinceBoxes[pid * 4 + 1] = MAP_H;
    provinceBoxes[pid * 4 + 2] = -1;
    provinceBoxes[pid * 4 + 3] = -1;
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const pid = provinceGrid[y * MAP_W + x];
      if (pid === 0) continue;
      const off = pid * 4;
      if (x < provinceBoxes[off + 0]) provinceBoxes[off + 0] = x;
      if (y < provinceBoxes[off + 1]) provinceBoxes[off + 1] = y;
      if (x > provinceBoxes[off + 2]) provinceBoxes[off + 2] = x;
      if (y > provinceBoxes[off + 3]) provinceBoxes[off + 3] = y;
    }
  }
}

let _cachedSelOutline = { provId: 0, stateId: 0, provPath: null, statePath: null };
function getCachedProvinceOutline(pid) {
  if (_cachedSelOutline.provId !== pid) {
    _cachedSelOutline.provId = pid;
    _cachedSelOutline.provPath = pid > 0 ? provinceOutlinePath(pid) : null;
  }
  return _cachedSelOutline.provPath;
}
function getCachedStateOutline(sid) {
  if (_cachedSelOutline.stateId !== sid) {
    _cachedSelOutline.stateId = sid;
    _cachedSelOutline.statePath = sid > 0 ? stateOutlinePath(sid) : null;
  }
  return _cachedSelOutline.statePath;
}

function provinceOutlinePath(pid) {
  if (!provinceGrid || !provinceBoxes) return null;
  const off = pid * 4;
  const x0 = provinceBoxes[off + 0], y0 = provinceBoxes[off + 1];
  const x1 = provinceBoxes[off + 2], y1 = provinceBoxes[off + 3];
  if (x1 < 0) return null;
  const path = new Path2D();
  for (let y = y0; y <= y1; y++) {
    const rowOff = y * MAP_W;
    for (let x = x0; x <= x1; x++) {
      if (provinceGrid[rowOff + x] !== pid) continue;

      if (y === 0 || provinceGrid[rowOff - MAP_W + x] !== pid) {
        path.moveTo(x, y); path.lineTo(x + 1, y);
      }
      
      if (y === MAP_H - 1 || provinceGrid[rowOff + MAP_W + x] !== pid) {
        path.moveTo(x, y + 1); path.lineTo(x + 1, y + 1);
      }
      
      if (x === 0 || provinceGrid[rowOff + x - 1] !== pid) {
        path.moveTo(x, y); path.lineTo(x, y + 1);
      }
      
      if (x === MAP_W - 1 || provinceGrid[rowOff + x + 1] !== pid) {
        path.moveTo(x + 1, y); path.lineTo(x + 1, y + 1);
      }
    }
  }
  return path;
}

function stateOutlinePath(stateId) {
  if (!provinceGrid || !provinceBoxes || typeof HOI4_CITIES === "undefined") return null;
  const stateData = HOI4_CITIES.find(s => s.id === stateId);
  if (!stateData || !stateData.provinces || stateData.provinces.length === 0) return null;
  const provSet = new Set(stateData.provinces);

  let minX = MAP_W, minY = MAP_H, maxX = -1, maxY = -1;
  for (const pid of stateData.provinces) {
    const off = pid * 4;
    if (provinceBoxes[off + 2] < 0) continue;
    if (provinceBoxes[off + 0] < minX) minX = provinceBoxes[off + 0];
    if (provinceBoxes[off + 1] < minY) minY = provinceBoxes[off + 1];
    if (provinceBoxes[off + 2] > maxX) maxX = provinceBoxes[off + 2];
    if (provinceBoxes[off + 3] > maxY) maxY = provinceBoxes[off + 3];
  }
  if (maxX < 0) return null;

  const path = new Path2D();
  for (let y = minY; y <= maxY; y++) {
    const rowOff = y * MAP_W;
    for (let x = minX; x <= maxX; x++) {
      const pid = provinceGrid[rowOff + x];
      if (!provSet.has(pid)) continue;
      
      if (y === 0 || !provSet.has(provinceGrid[rowOff - MAP_W + x])) {
        path.moveTo(x, y); path.lineTo(x + 1, y);
      }
      if (y === MAP_H - 1 || !provSet.has(provinceGrid[rowOff + MAP_W + x])) {
        path.moveTo(x, y + 1); path.lineTo(x + 1, y + 1);
      }
      if (x === 0 || !provSet.has(provinceGrid[rowOff + x - 1])) {
        path.moveTo(x, y); path.lineTo(x, y + 1);
      }
      if (x === MAP_W - 1 || !provSet.has(provinceGrid[rowOff + x + 1])) {
        path.moveTo(x + 1, y); path.lineTo(x + 1, y + 1);
      }
    }
  }
  return path;
}

let hoi4BiomeImg = null;
function buildBiomeCache() {
  biomeCache = document.createElement("canvas");
  biomeCache.width = MAP_W;
  biomeCache.height = MAP_H;
  const bctx = biomeCache.getContext("2d");

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      bctx.fillStyle = BIOME_COLORS[MAP[r][c]];
      bctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }

  if (hoi4BiomeImg) {
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(hoi4BiomeImg, 0, 0, MAP_W, MAP_H);
  } else {
    
    const img = new Image();
    img.onload = () => {
      hoi4BiomeImg = img;
      buildBiomeCache();
      render();
    };
    img.src = "hoi4_biomes.png?v=" + Date.now();
  }
  tintCacheDirty = true;
}

let blobScratch = null;
function getBlobScratch() {
  if (!blobScratch) {
    blobScratch = document.createElement("canvas");
    blobScratch.width = MAP_W;
    blobScratch.height = MAP_H;
  }
  return blobScratch;
}

function buildTintCache() {

  const w = MAP_W, h = MAP_H;
  if (!tintCacheCanvas || tintCacheCanvas.width !== w) {
    tintCacheCanvas = document.createElement("canvas");
    tintCacheCanvas.width = w;
    tintCacheCanvas.height = h;
  }
  const tctx = tintCacheCanvas.getContext("2d");

  const hash = _ownershipHash();
  if (hash === _lastOwnershipHash) {
    tintCacheDirty = false;
    return;
  }

  const minMs = state.speed >= 5 ? 600 : (state.speed >= 4 ? 400 : _REBUILD_MIN_MS);
  const now = performance.now();
  if (now - _lastRebuildAt < minMs) {
    tintCacheDirty = true;   
    return;
  }
  _lastRebuildAt = now;
  _lastOwnershipHash = hash;

  tctx.clearRect(0, 0, w, h);

  

  

  if (!provinceGrid || !provinceTile) {
    borderPath = null;
    const acc = new Map();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const o = state.ownership[r][c];
        if (o < 0) continue;
        let a = acc.get(o);
        if (!a) { a = { sx: 0, sy: 0, sxx: 0, sxy: 0, syy: 0, n: 0 }; acc.set(o, a); }
        a.sx += c; a.sy += r;
        a.sxx += c * c; a.sxy += c * r; a.syy += r * r;
        a.n++;
      }
    }
    for (const civ of state.civs) {
      const a = acc.get(civ.id);
      if (!a || a.n === 0) { civ._centroid = null; civ._angle = 0; civ._components = []; continue; }
      const cx = a.sx / a.n, cy = a.sy / a.n;
      const Mxx = a.sxx / a.n - cx * cx;
      const Myy = a.syy / a.n - cy * cy;
      const Mxy = a.sxy / a.n - cx * cy;
      let angle = 0.5 * Math.atan2(2 * Mxy, Mxx - Myy);
      const tr = Mxx + Myy;
      const det = Mxx * Myy - Mxy * Mxy;
      const disc = Math.max(0, tr * tr / 4 - det);
      const lMax = tr / 2 + Math.sqrt(disc);
      const lMin = tr / 2 - Math.sqrt(disc);
      const aspect = lMin > 0 ? Math.sqrt(lMax / lMin) : 1;
      if (aspect < 1.25) angle = 0;
      const cap = Math.PI / 3;
      if (angle > cap) angle = cap;
      if (angle < -cap) angle = -cap;
      civ._centroid = { col: cx, row: cy, tiles: a.n };
      civ._angle = angle;
      civ._extent = { major: Math.sqrt(Math.max(0.5, lMax)), minor: Math.sqrt(Math.max(0.5, lMin)) };

      civ._components = [{
        col: cx, row: cy, tiles: a.n, angle,
        major: Math.sqrt(Math.max(0.5, lMax)),
        minor: Math.sqrt(Math.max(0.5, lMin)),
      }];
    }
    tintCacheDirty = false;
    return;
  }

  return buildTintCacheProvinces(tctx);
}

let borderPath = null;

let tribalBorderPath = null;

let stateBorderPath = null;

let _cachedImageData = null;
let _cachedProvinceColor = null;
let _cachedProvinceCiv = null;

let _lastOwnershipHash = -1;

let _lastRebuildAt = 0;
const _REBUILD_MIN_MS = 250;   

function _ownershipHash() {
  let h = 0;
  for (let r = 0; r < ROWS; r++) {
    const row = state.ownership[r];
    for (let c = 0; c < COLS; c++) {
      h = (h * 31 + row[c] + 1) | 0;
    }
  }
  return h;
}

const TINT_DS = 2;

function buildTintCacheProvinces(tctx) {
  const w = MAP_W, h = MAP_H;

  if (!_cachedImageData || _cachedImageData.width !== w || _cachedImageData.height !== h) {
    _cachedImageData = tctx.createImageData(w, h);
  } else {
    _cachedImageData.data.fill(0);
  }
  const dataView = new Uint32Array(_cachedImageData.data.buffer);

  const maxPid = (typeof HOI4_MAX_PROVINCE_ID !== "undefined") ? HOI4_MAX_PROVINCE_ID + 1 : 13400;
  if (!_cachedProvinceColor || _cachedProvinceColor.length !== maxPid) {
    _cachedProvinceColor = new Uint32Array(maxPid);
    _cachedProvinceCiv = new Int16Array(maxPid);
  }
  const provinceColor = _cachedProvinceColor;
  const provinceCiv = _cachedProvinceCiv;
  for (let pid = 0; pid < maxPid; pid++) { provinceColor[pid] = 0; provinceCiv[pid] = -1; }

  
  
  const _tribeCivIds = new Set();
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    if (civ.isStartingTribe || civ.era === 0) _tribeCivIds.add(civ.id);
  }

  
  const factionMode = !!state.factionMapMode;
  const civToFactionColor = new Map();
  if (factionMode && state.factions) {
    for (const f of state.factions) {
      const fc = f.color || "#888888";
      for (const id of f.memberIds) civToFactionColor.set(id, fc);
    }
  }
  const NEUTRAL_GREY = "#6a6258";
  for (let pid = 1; pid < maxPid; pid++) {
    const col = provinceTile[pid * 2];
    const row = provinceTile[pid * 2 + 1];
    if (col < 0) continue;
    const owner = state.ownership[row][col];
    if (owner < 0) continue;
    const civ = state.civs[civIndexById(owner)];
    if (!civ || !civ.alive) continue;
    provinceCiv[pid] = civ.id;
    if (!factionMode && _tribeCivIds.has(civ.id)) continue;   
    const colorHex = factionMode
      ? (civToFactionColor.get(civ.id) || NEUTRAL_GREY)
      : civ.color;
    const r = parseInt(colorHex.slice(1, 3), 16);
    const g = parseInt(colorHex.slice(3, 5), 16);
    const b = parseInt(colorHex.slice(5, 7), 16);
    provinceColor[pid] = (255 << 24) | (b << 16) | (g << 8) | r;
  }
  state._provinceCiv = provinceCiv;
  
  state._tribeCivIds = _tribeCivIds;

  
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const pid = provinceGrid[i];
    if (pid === 0) continue;
    dataView[i] = provinceColor[pid];   
  }

  

  
  borderPath = new Path2D();
  stateBorderPath = new Path2D();
  tribalBorderPath = new Path2D();
  
  const _tribeIdSet = new Set();
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    if (civ.isStartingTribe || civ.era === 0) _tribeIdSet.add(civ.id);
  }
  
  function _isTribeCiv(civId) { return civId >= 0 && _tribeIdSet.has(civId); }
  const STEP = 2;
  const haveStates = provinceToState !== null;
  for (let y = 0; y < h; y += STEP) {
    const rowOff = y * w;
    for (let x = 0; x < w; x += STEP) {
      const i = rowOff + x;
      const mePid = provinceGrid[i];
      const meCiv = provinceCiv[mePid];
      const meState = haveStates && mePid > 0 ? provinceToState[mePid] : 0;
      if (x + STEP < w) {
        const rightPid = provinceGrid[i + STEP];
        const rightCiv = provinceCiv[rightPid];
        if (meCiv !== rightCiv && (meCiv >= 0 || rightCiv >= 0)) {

          
          
          if (_isTribeCiv(meCiv) || _isTribeCiv(rightCiv)) {
            
          } else {
            borderPath.moveTo(x + STEP, y);
            borderPath.lineTo(x + STEP, y + STEP);
          }
        } else if (haveStates && meCiv >= 0 && meCiv === rightCiv) {
          const rightState = rightPid > 0 ? provinceToState[rightPid] : 0;
          if (meState !== rightState && meState !== 0 && rightState !== 0) {
            stateBorderPath.moveTo(x + STEP, y);
            stateBorderPath.lineTo(x + STEP, y + STEP);
          }
        }
      }
      if (y + STEP < h) {
        const botPid = provinceGrid[i + w * STEP];
        const botCiv = provinceCiv[botPid];
        if (meCiv !== botCiv && (meCiv >= 0 || botCiv >= 0)) {
          if (_isTribeCiv(meCiv) || _isTribeCiv(botCiv)) {
            
          } else {
            borderPath.moveTo(x, y + STEP);
            borderPath.lineTo(x + STEP, y + STEP);
          }
        } else if (haveStates && meCiv >= 0 && meCiv === botCiv) {
          const botState = botPid > 0 ? provinceToState[botPid] : 0;
          if (meState !== botState && meState !== 0 && botState !== 0) {
            stateBorderPath.moveTo(x, y + STEP);
            stateBorderPath.lineTo(x + STEP, y + STEP);
          }
        }
      }
    }
  }

  

  for (const civ of state.civs) civ._components = [];
  const _seen = new Uint8Array(ROWS * COLS);
  for (let r0 = 0; r0 < ROWS; r0++) {
    for (let c0 = 0; c0 < COLS; c0++) {
      if (_seen[r0 * COLS + c0]) continue;
      const owner = state.ownership[r0][c0];
      if (owner < 0) { _seen[r0 * COLS + c0] = 1; continue; }
      
      const stack = [c0, r0];
      _seen[r0 * COLS + c0] = 1;
      let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0, n = 0;
      while (stack.length) {
        const r = stack.pop(), c = stack.pop();
        sx += c; sy += r; sxx += c * c; sxy += c * r; syy += r * r; n++;
        for (const [nc, nr] of neighbors(c, r)) {
          const idx = nr * COLS + nc;
          if (_seen[idx]) continue;
          if (state.ownership[nr][nc] !== owner) continue;
          _seen[idx] = 1;
          stack.push(nc); stack.push(nr);
        }
      }
      const cx = sx / n, cy = sy / n;
      const Mxx = sxx / n - cx * cx;
      const Myy = syy / n - cy * cy;
      const Mxy = sxy / n - cx * cy;
      let angle = 0.5 * Math.atan2(2 * Mxy, Mxx - Myy);
      const tr = Mxx + Myy;
      const det = Mxx * Myy - Mxy * Mxy;
      const disc = Math.max(0, tr * tr / 4 - det);
      const lMax = tr / 2 + Math.sqrt(disc);
      const lMin = tr / 2 - Math.sqrt(disc);
      const aspect = lMin > 0 ? Math.sqrt(lMax / lMin) : 1;
      if (aspect < 1.25) angle = 0;
      const cap = Math.PI / 3;
      if (angle > cap) angle = cap;
      if (angle < -cap) angle = -cap;
      const idx = civIndexById(owner);
      if (idx >= 0) {
        state.civs[idx]._components.push({
          col: cx, row: cy, tiles: n, angle,
          major: Math.sqrt(Math.max(0.5, lMax)),
          minor: Math.sqrt(Math.max(0.5, lMin)),
        });
      }
    }
  }

  for (const civ of state.civs) {
    if (!civ._components || civ._components.length === 0) {
      civ._centroid = null; civ._angle = 0; civ._extent = null; continue;
    }
    let best = civ._components[0];
    for (const c of civ._components) if (c.tiles > best.tiles) best = c;
    civ._centroid = { col: best.col, row: best.row, tiles: best.tiles };
    civ._angle = best.angle;
    civ._extent = { major: best.major, minor: best.minor };
  }

  tctx.putImageData(_cachedImageData, 0, 0);

  

  buildTribalBlobCache();
  tintCacheDirty = false;
}

let tribalBlobCanvas = null;
function buildTribalBlobCache() {
  const w = MAP_W, h = MAP_H;
  if (!tribalBlobCanvas || tribalBlobCanvas.width !== w) {
    tribalBlobCanvas = document.createElement("canvas");
    tribalBlobCanvas.width = w;
    tribalBlobCanvas.height = h;
  }
  const bctx = tribalBlobCanvas.getContext("2d");
  bctx.clearRect(0, 0, w, h);
  const tribeIds = state._tribeCivIds;
  if (!tribeIds || tribeIds.size === 0) return;

  
  
  bctx.save();
  bctx.globalAlpha = 0.85;
  for (const civ of state.civs) {
    if (!civ.alive || !tribeIds.has(civ.id)) continue;
    bctx.fillStyle = civ.color;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (state.ownership[r][c] !== civ.id) continue;
        const x = (c + 0.5) * TILE;
        const y = (r + 0.5) * TILE;
        const radius = TILE * 1.6;   
        bctx.beginPath();
        bctx.arc(x, y, radius, 0, Math.PI * 2);
        bctx.fill();
      }
    }
  }
  bctx.restore();
  
  const tmp = document.createElement("canvas");
  tmp.width = w; tmp.height = h;
  const tctx = tmp.getContext("2d");
  tctx.filter = "blur(" + Math.max(8, Math.round(TILE * 0.9)) + "px)";
  tctx.drawImage(tribalBlobCanvas, 0, 0);
  bctx.clearRect(0, 0, w, h);
  bctx.drawImage(tmp, 0, 0);
}

function invalidateTintCache() { tintCacheDirty = true; }

function render() {
  const dpr = state._dpr || 1;
  
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  if (tintCacheDirty) buildTintCache();

  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);

  ctx.imageSmoothingEnabled = false;
  if (state.currentPlanet && state.currentPlanet !== "Earth") {
    // Skip Earth biome on other planets - the player should see the
    // planet's surface, not Earth continents tinted. Try the planet
    // texture first; fall back to a solid planet-colour fill.
    const body = (typeof SOLAR_ORBITS !== "undefined") ? SOLAR_ORBITS.find(b => b.name === state.currentPlanet) : null;
    const planetColor = body && body.color ? body.color : "#7a5a3a";
    ctx.fillStyle = planetColor;
    ctx.fillRect(0, 0, MAP_W, MAP_H);
    if (body && body.texture && _planetTextureCache[body.name] && _planetTextureCache[body.name].complete) {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(_planetTextureCache[body.name], 0, 0, MAP_W, MAP_H);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = false;
    }
  } else {
    ctx.drawImage(biomeCache, 0, 0);
  }

  if (tribalBlobCanvas) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tribalBlobCanvas, 0, 0, MAP_W, MAP_H);
    ctx.imageSmoothingEnabled = false;
  }
  
  // 25% transparent country tints so the biome / terrain shows through.
  ctx.globalAlpha = 0.75;
  ctx.drawImage(tintCacheCanvas, 0, 0, MAP_W, MAP_H);
  ctx.globalAlpha = 1;

  if (stateBorderPath && (!state.currentPlanet || state.currentPlanet === "Earth")) {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.30)";
    ctx.lineWidth = Math.max(0.3, 0.8 / view.zoom);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.stroke(stateBorderPath);
  }

  
  if (tribalBorderPath) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.strokeStyle = "rgba(50, 30, 12, 0.28)";
    ctx.lineWidth = Math.max(2.5, 6 / view.zoom);
    ctx.stroke(tribalBorderPath);
    ctx.strokeStyle = "rgba(60, 38, 14, 0.45)";
    ctx.lineWidth = Math.max(1.4, 3 / view.zoom);
    ctx.stroke(tribalBorderPath);
    
    ctx.setLineDash([Math.max(1.5, 3 / view.zoom), Math.max(1.5, 3 / view.zoom)]);
    ctx.strokeStyle = "rgba(30, 18, 6, 0.8)";
    ctx.lineWidth = Math.max(0.5, 1 / view.zoom);
    ctx.stroke(tribalBorderPath);
    ctx.restore();
  }
  
  if (borderPath) {
    ctx.strokeStyle = "rgba(8, 5, 2, 0.95)";
    ctx.lineWidth = Math.max(0.4, 1.4 / view.zoom);
    ctx.stroke(borderPath);
  }

  
  
  const _now = performance.now();
  const _tickMs = (state.phase === "playing" && state.speed > 0) ? SPEED_TURN_MS[state.speed] : 0;
  const _currentPlanet = state.currentPlanet || "Earth";
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    for (const a of civ.armies) {
      // Per-planet armies: only show armies tagged for the planet
      // we're viewing (default Earth for legacy armies).
      if ((a.planet || "Earth") !== _currentPlanet) continue;
      let aCol = a.col, aRow = a.row;
      
      if (a.moveStartedAt && _tickMs > 0 && _tickMs !== Infinity && a.prevCol != null) {
        const t = Math.min(1, Math.max(0, (_now - a.moveStartedAt) / _tickMs));
        if (t < 1) {
          aCol = a.prevCol + (a.col - a.prevCol) * t;
          aRow = a.prevRow + (a.row - a.prevRow) * t;
        }
      }
      const x = aCol * TILE + TILE / 2;
      const y = aRow * TILE + TILE / 2;

      
      if (a.id === state._activeArmyId && civ.isPlayer) {
        ctx.strokeStyle = "#ffd24a";
        ctx.lineWidth = Math.max(0.4, 0.7 / view.zoom);
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = a.type === "settler" ? "#fff" : "#000";
      ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8);
      ctx.fillStyle = civ.color;
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);

      const health = a.health == null ? 100 : a.health;
      if (health < 100 && a.type !== "settler" && a.type !== "colonizer" && a.type !== "leader") {
        const barW = 3.2, barH = 0.6;
        const bx = x - barW / 2, by = y - 2.4;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(bx - 0.2, by - 0.2, barW + 0.4, barH + 0.4);
        const frac = Math.max(0, Math.min(1, health / 100));
        ctx.fillStyle = frac > 0.6 ? "#3aa84a" : (frac > 0.3 ? "#e8c020" : "#c84030");
        ctx.fillRect(bx, by, barW * frac, barH);
      }
    }
  }

  
  
  if (state.selectedState > 0 && provinceGrid && provinceToState) {
    const sPath = getCachedStateOutline(state.selectedState);
    if (sPath) {
      ctx.strokeStyle = "#ffd24a";
      ctx.lineWidth = Math.max(1.5, 3 / view.zoom);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(sPath);
    }
  }
  if (state.selectedProvince > 0 && provinceGrid) {
    const path = getCachedProvinceOutline(state.selectedProvince);
    if (path) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, 2 / view.zoom);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(path);
    }
  }
  if (state.moveMode) {
    const army = findArmyById(state.moveMode.armyId);
    if (army) {
      for (const [nc, nr] of neighbors(army.col, army.row)) {
        if (!PASSABLE(MAP[nr][nc])) continue;
        ctx.fillStyle = "rgba(212, 166, 87, 0.45)";
        ctx.fillRect(nc * TILE, nr * TILE, TILE, TILE);
        ctx.strokeStyle = "#ffd24a";
        ctx.lineWidth = 1 / view.zoom;
        ctx.strokeRect(nc * TILE + 0.5/view.zoom, nr * TILE + 0.5/view.zoom,
                       TILE - 1/view.zoom, TILE - 1/view.zoom);
      }
    }
  }

  
  if (state.frontlineEnemies && state.frontlineEnemies.size > 0) {
    const me = state.civs[0];
    if (me && me.isPlayer) {
      const enemies = state.frontlineEnemies;
      ctx.save();
      ctx.fillStyle = state.frontlinePush ? "rgba(255, 100, 60, 0.45)" : "rgba(255, 210, 74, 0.45)";
      const strokeColor = state.frontlinePush ? "#ff6440" : "#ffd24a";
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] !== me.id) continue;
          let touchEnemy = false;
          for (const [nc, nr] of neighbors(c, r)) {
            if (enemies.has(state.ownership[nr][nc])) { touchEnemy = true; break; }
          }
          if (!touchEnemy) continue;
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = Math.max(0.5, 1.4 / view.zoom);
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] !== me.id) continue;
          let touchEnemy = false;
          for (const [nc, nr] of neighbors(c, r)) {
            if (enemies.has(state.ownership[nr][nc])) { touchEnemy = true; break; }
          }
          if (!touchEnemy) continue;
          ctx.strokeRect(c * TILE + 0.5 / view.zoom, r * TILE + 0.5 / view.zoom,
                         TILE - 1 / view.zoom, TILE - 1 / view.zoom);
        }
      }
      ctx.restore();
    }
  }

  
  const _player = state.civs[0];
  if (_player && _player.isPlayer && _player.alive) {
    for (const a of _player.armies) {
      if (!a.dest) continue;
      const dx = a.dest.col * TILE + TILE / 2;
      const dy = a.dest.row * TILE + TILE / 2;
      const ax = a.col * TILE + TILE / 2;
      const ay = a.row * TILE + TILE / 2;
      ctx.strokeStyle = "rgba(255, 210, 74, 0.7)";
      ctx.lineWidth = Math.max(0.5, 1 / view.zoom);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(dx, dy); ctx.stroke();
      ctx.strokeStyle = "#ffd24a";
      ctx.lineWidth = Math.max(0.8, 1.5 / view.zoom);
      ctx.beginPath();
      ctx.moveTo(dx - 2.2, dy - 2.2); ctx.lineTo(dx + 2.2, dy + 2.2);
      ctx.moveTo(dx - 2.2, dy + 2.2); ctx.lineTo(dx + 2.2, dy - 2.2);
      ctx.stroke();
    }
  }

  // Country labels + per-planet settlement/army markers. HOI4 city
  // dots are Earth-only (they're a fixed dataset). Settlements have
  // an optional `planet` field that defaults to "Earth"; we filter
  // by it inside drawSettlementMarkers, so player colonies on Mars
  // appear only on Mars's surface render.
  drawCivBlobLabels();
  drawSettlementMarkers();
  if (!state.currentPlanet || state.currentPlanet === "Earth") {
    drawHoi4Cities();
  }

  ctx.restore();
}

const HOI4_MAJOR_VP = 8;

function drawHoi4Cities() {
  
  if (typeof HOI4_CITIES === "undefined") return;
  for (const city of HOI4_CITIES) {
    const x = city.x, y = city.y;
    const vp = city.vp || 0;
    if (vp >= HOI4_MAJOR_VP) {
      
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, Math.PI * 2); ctx.fill();
    } else if (vp >= 1) {
      
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
    }
  }
}

function drawSettlementMarkers() {
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const currentPlanet = state.currentPlanet || "Earth";
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    let firstOnPlanetIdx = -1;
    for (let i = 0; i < civ.settlements.length; i++) {
      if ((civ.settlements[i].planet || "Earth") === currentPlanet) { firstOnPlanetIdx = i; break; }
    }
    for (let i = 0; i < civ.settlements.length; i++) {
      const s = civ.settlements[i];
      if ((s.planet || "Earth") !== currentPlanet) continue;
      const x = (s.col + 0.5) * TILE;
      const y = (s.row + 0.5) * TILE;
      if (i === firstOnPlanetIdx) {
        const r = Math.min(TILE * 0.95, 1.4 + Math.sqrt(s.pop) * 0.5);
        drawStar(ctx, x, y, r, civ.color, "#000", civ.isPlayer ? "#fff" : null);
      } else {
        
        const r = Math.min(TILE * 0.42, 0.7 + Math.sqrt(s.pop) * 0.35);
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.arc(x, y, r + 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = civ.color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        if (civ.isPlayer) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 0.25;
          ctx.stroke();
        }
      }
    }
  }
}

function drawStar(ctx, x, y, radius, fillColor, outlineColor, playerRing) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? radius : radius * 0.42;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 0.6;
    ctx.stroke();
  }
  ctx.fillStyle = fillColor;
  ctx.fill();
  if (playerRing) {
    ctx.strokeStyle = playerRing;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(x, y, radius * 1.25, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function inscribedExtent(px, py, dx, dy, civId) {
  const STEP = TILE;
  let dist = 0;
  for (let t = STEP; t < 800; t += STEP) {
    const x = px + dx * t;
    const y = py + dy * t;
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) break;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) break;
    if (state.ownership[row][col] !== civId) break;
    dist = t;
  }
  return dist;
}

function drawCivBlobLabels() {

  
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const factionMode = !!state.factionMapMode;
  const memberIdSet = new Set();
  if (factionMode && state.factions) {
    for (const f of state.factions) for (const id of f.memberIds) memberIdSet.add(id);
  }
  for (const civ of state.civs) {
    if (!civ.alive || !civ._components || civ._components.length === 0) continue;
    if (factionMode && memberIdSet.has(civ.id)) continue;
    const text = civ.name.toUpperCase();
    let drewAny = false;
    let fallbackComp = null;
    for (const comp of civ._components) {
      if (!fallbackComp || comp.tiles > fallbackComp.tiles) fallbackComp = comp;
      if (comp.tiles < 2) continue;
      let cx = (comp.col + 0.5) * TILE;
      let cy = (comp.row + 0.5) * TILE;
      const angle = comp.angle || 0;
      const dx = Math.cos(angle), dy = Math.sin(angle);

      let lenFwd = inscribedExtent(cx, cy, dx, dy, civ.id);
      let lenRev = inscribedExtent(cx, cy, -dx, -dy, civ.id);
      if (lenFwd + lenRev < TILE * 1.5) {
        lenFwd = lenRev = TILE * 1.0;
      }
      const shift = (lenFwd - lenRev) * 0.5;
      cx += dx * shift;
      cy += dy * shift;
      const lengthMap = lenFwd + lenRev;
      const heightMap = inscribedExtent(cx, cy, -dy, dx, civ.id) +
                        inscribedExtent(cx, cy, dy, -dx, civ.id);

      const charW = 0.58;
      const fitByWidth = lengthMap * 0.86 / Math.max(4, text.length * charW);
      const fitByHeight = heightMap * 0.55;
      const fontMap = Math.max(2, Math.min(56, Math.min(fitByWidth, fitByHeight)));
      if (fontMap < 2.5) continue;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.font = `bold ${fontMap}px "Trajan Pro", "Cinzel", Georgia, serif`;
      ctx.lineWidth = Math.max(0.4, fontMap * 0.22);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(245,235,210,0.9)";
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = "#15110a";
      ctx.fillText(text, 0, 0);
      ctx.restore();
      drewAny = true;
    }
    if (!drewAny && fallbackComp) {
      const cx = (fallbackComp.col + 0.5) * TILE;
      const cy = (fallbackComp.row + 0.5) * TILE;
      const fontMap = Math.max(6, Math.min(20, Math.sqrt(fallbackComp.tiles) * 4));
      ctx.save();
      ctx.font = `bold ${fontMap}px "Trajan Pro", "Cinzel", Georgia, serif`;
      ctx.lineWidth = Math.max(0.4, fontMap * 0.22);
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(245,235,210,0.9)";
      ctx.strokeText(text, cx, cy);
      ctx.fillStyle = "#15110a";
      ctx.fillText(text, cx, cy);
      ctx.restore();
    }
  }

  if (factionMode && state.factions) {
    for (const f of state.factions) {
      if (!f.memberIds || f.memberIds.length === 0) continue;
      let sx = 0, sy = 0, sn = 0;
      for (const id of f.memberIds) {
        const member = state.civs.find(c => c.id === id && c.alive);
        if (!member) continue;
        for (const comp of (member._components || [])) {
          sx += comp.col * comp.tiles;
          sy += comp.row * comp.tiles;
          sn += comp.tiles;
        }
      }
      if (sn === 0) continue;
      const cx = (sx / sn + 0.5) * TILE;
      const cy = (sy / sn + 0.5) * TILE;
      const fontMap = 26;
      ctx.font = "bold " + fontMap + 'px "Trajan Pro", "Cinzel", Georgia, serif';
      ctx.lineWidth = fontMap * 0.22;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(245,235,210,0.95)";
      ctx.strokeText(f.name, cx, cy);
      ctx.fillStyle = "#15110a";
      ctx.fillText(f.name, cx, cy);
    }
  }
}

function drawLabels() {

  const fontMap = TILE * 1.5;
  ctx.font = `${fontMap}px Georgia, serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const currentPlanet = state.currentPlanet || "Earth";
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    for (const s of civ.settlements) {
      if ((s.planet || "Earth") !== currentPlanet) continue;
      const tx = (s.col + 0.5) * TILE + TILE * 0.7;
      const ty = (s.row + 0.5) * TILE;
      const label = s.name;
      ctx.lineWidth = fontMap * 0.25;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(label, tx, ty);
      ctx.fillStyle = "#fff";
      ctx.fillText(label, tx, ty);
    }
  }
}

function findArmyById(id) {
  for (const civ of state.civs) {
    for (const a of civ.armies) if (a.id === id) return a;
  }
  return null;
}

function log(kind, msg) {
  state.log.unshift({ kind, msg, year: state.year });
  if (state.log.length > 60) state.log.length = 60;
}

function yearLabel(y) {
  if (y < 0) return Math.abs(y) + " BC";
  if (y === 0) return "1 AD";
  return y + " AD";
}

function updateUI() {
  document.getElementById("year-display").textContent = yearLabel(state.year);
  updatePlayerFlagButton();
  const player = state.civs[0];
  if (state.debug) {
    const top = [...state.civs].filter(c => c.alive).sort((a, b) => countTiles(b) - countTiles(a))[0];
    document.getElementById("era-badge").textContent = top ? "WORLD · " + ERAS[top.era].name.toUpperCase() : "WORLD";
    const aliveCount = state.civs.filter(c => c.alive).length;
    document.getElementById("player-panel").innerHTML = `
      <div style="text-align:center;color:#ff7d4a;font-size:14px;letter-spacing:3px;margin-top:6px;">[ OBSERVER ]</div>
      <div style="text-align:center;color:#8a7a5c;font-size:11px;margin-top:2px;">${aliveCount} civilizations alive</div>
      <div style="text-align:center;color:#8a7a5c;font-size:11px;">${state.civs.length - aliveCount} extinct</div>
    `;
  } else if (player && player.isPlayer) {
    document.getElementById("era-badge").textContent = ERAS[player.era].name.toUpperCase();
    const totalPop = player.settlements.reduce((a, s) => a + s.pop, 0);
    const totalUnits = player.armies.reduce((a, b) => a + b.count, 0);
    const tiles = countTiles(player);
    document.getElementById("player-panel").innerHTML = `
      <div class="stat-row"><span class="stat-label">Civilization</span><span class="stat-val" style="color:${player.color}">${player.name}</span></div>
      <div class="stat-row"><span class="stat-label">Settlements</span><span class="stat-val">${player.settlements.length}</span></div>
      <div class="stat-row"><span class="stat-label">Population</span><span class="stat-val">${totalPop}</span></div>
      <div class="stat-row"><span class="stat-label">Territory</span><span class="stat-val">${tiles} tiles</span></div>
      <div class="stat-row"><span class="stat-label">Armies</span><span class="stat-val">${totalUnits} units</span></div>
      <div class="stat-row"><span class="stat-label">Stability</span><span class="stat-val">${Math.round(player.stability)}%</span></div>
      <div class="stat-row"><span class="stat-label">Tech</span><span class="stat-val">${player.techPoints}${player.era < ERAS.length-1 ? " / " + ERAS[player.era+1].threshold : ""}</span></div>
    `;
  }
  renderTileInfo();
  renderCivList();
  renderLog();
}

function renderTileInfo() {
  const el = document.getElementById("tile-info");
  const actEl = document.getElementById("actions");
  if (!state.selectedTile) {
    el.textContent = "Click a province to inspect.";
    actEl.innerHTML = "";
    return;
  }
  const { col, row } = state.selectedTile;
  const ownerId = state.ownership[row][col];
  const owner = ownerId >= 0 ? state.civs[civIndexById(ownerId)] : null;
  const settlement = owner ? owner.settlements.find(s => s.col === col && s.row === row) : null;
  const armies = [];
  for (const civ of state.civs) {
    for (const a of civ.armies) {
      if (a.col === col && a.row === row) armies.push({ army: a, civ });
    }
  }
  
  let html = "";
  const pid = state.selectedProvince;
  
  const gridStatus = provinceGrid ? `loaded (${provinceGrid.length}px)` : "NOT loaded";
  const infoStatus = provinceInfo ? `loaded (${provinceInfo.length} entries)` : "NOT loaded";
  html += `<div style="font-size:10px;color:#8a7a5c;margin-bottom:4px;">grid: ${gridStatus} · info: ${infoStatus} · pid: ${pid}</div>`;
  if (pid > 0 && provinceInfo && provinceInfo[pid]) {
    const p = provinceInfo[pid];
    const rgb = `rgb(${p.r}, ${p.g}, ${p.b})`;
    const hex = "#" + [p.r, p.g, p.b].map(v => v.toString(16).padStart(2, "0")).join("");
    html += `<div style="font-size:13px;"><b>Province #${p.id}</b></div>`;
    html += `<div class="stat-row"><span class="stat-label">Type</span><span class="stat-val">${p.type}</span></div>`;
    html += `<div class="stat-row"><span class="stat-label">Terrain</span><span class="stat-val">${p.terrain}</span></div>`;
    html += `<div class="stat-row"><span class="stat-label">Coastal</span><span class="stat-val">${p.coastal ? "yes" : "no"}</span></div>`;
    html += `<div class="stat-row"><span class="stat-label">Continent</span><span class="stat-val">${p.continent}</span></div>`;
    html += `<div class="stat-row"><span class="stat-label">RGB</span><span class="stat-val" style="display:flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:11px;height:11px;background:${rgb};border:1px solid #000;"></span>
        <span style="font-family:monospace;font-size:11px;">${p.r},${p.g},${p.b}</span>
      </span></div>`;
    html += `<div class="stat-row"><span class="stat-label">Hex</span><span class="stat-val" style="font-family:monospace;font-size:11px;">${hex}</span></div>`;
  } else {
    
    const biome = MAP[row][col];
    html += `<div><b>${biome.charAt(0).toUpperCase() + biome.slice(1)}</b> (${col}, ${row})</div>`;
    html += `<div style="color:#8a7a5c;">Food +${BIOME_FOOD[biome] || 0}, Defense +${BIOME_DEFENSE[biome] || 0}</div>`;
  }
  if (owner) {
    html += `<div style="margin-top:6px;border-top:1px solid #4a3520;padding-top:4px;">Owner: <span style="color:${owner.color}">${owner.name}</span></div>`;
  }
  if (settlement) {
    html += `<div style="margin-top:6px;border-top:1px solid #4a3520;padding-top:6px;">
      <b>${settlement.name}</b> (pop ${settlement.pop})<br/>
      Food: ${settlement.food} · Walls: ${settlement.walls ? "Yes" : "No"}
    </div>`;
    if (settlement.queue.length > 0) {
      const item = settlement.queue[0];
      const cost = item.type === "settler" ? SETTLER_COST : (UNITS[item.type]?.cost || 1);
      const pct = Math.min(100, ((item.progress || 0) / cost) * 100);
      const itemName = item.type === "settler" ? "Settler" : UNITS[item.type].name;
      const queueExtra = settlement.queue.length > 1 ? ` <span style="color:#8a7a5c;">(+${settlement.queue.length - 1} queued)</span>` : "";
      html += `<div class="build-queue">Building: ${itemName}${queueExtra}
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
    }
  }
  if (armies.length > 0) {
    html += `<div style="margin-top:6px;border-top:1px solid #4a3520;padding-top:6px;">Armies:</div>`;
    for (const { army, civ } of armies) {
      const tname = army.type === "settler" ? "Settler" : UNITS[army.type].name;
      html += `<div style="font-size:11px;">• <span style="color:${civ.color}">${civ.name}</span>: ${army.count} ${tname}${army.moves > 0 ? "" : " (moved)"}</div>`;
    }
  }
  el.innerHTML = html;

  let actions = "";
  const player = state.civs[0];
  if (state.debug || !player || !player.isPlayer) {
    actEl.innerHTML = "";
    return;
  }
  const playerOwns = ownerId === player.id;

  if (playerOwns && settlement && state.phase === "playing") {
    const era = player.era;
    actions += `<div class="section-title" style="margin-top:10px;">Build at ${settlement.name}</div>`;
    actions += `<div class="action-btns">`;
    
    const mkBtn = (key, name, cost) =>
      `<button title="Click = queue 1, hold = type a quantity"
         onmousedown="startBuyHold(${settlement.id}, '${key}')"
         onmouseup="endBuyHold(${settlement.id}, '${key}')"
         onmouseleave="cancelBuyHold()"
         ontouchstart="startBuyHold(${settlement.id}, '${key}')"
         ontouchend="endBuyHold(${settlement.id}, '${key}')">${name} <small>(${cost})</small></button>`;
    for (const [key, u] of Object.entries(UNITS)) {
      if (u.era > era) continue;
      actions += mkBtn(key, u.name, u.cost);
    }
    actions += mkBtn("settler", "Settler", SETTLER_COST);
    if (settlement.queue.length > 0) {
      actions += `<button onclick="cancelBuild(${settlement.id})" style="grid-column:1/-1;">Clear queue (${settlement.queue.length})</button>`;
    }
    actions += `</div>`;
  }
  
  const myArmies = armies.filter(({ civ }) => civ.id === player.id);
  if (myArmies.length > 0 && state.phase === "playing") {
    actions += `<div class="section-title" style="margin-top:10px;">Your Forces</div>`;
    for (const { army } of myArmies) {
      const tname = army.type === "settler" ? "Settler" : UNITS[army.type].name;
      actions += `<div style="display:flex;gap:4px;align-items:center;margin:3px 0;">
        <span style="flex:1;font-size:12px;">${army.count} ${tname}</span>`;
      if (army.type === "rocket_scraps") {
        const totalScraps = countPlayerScraps();
        actions += `<button style="width:auto;flex:0 0 auto;${totalScraps >= 10 ? '' : 'opacity:0.5;cursor:not-allowed;'}" onclick="${totalScraps >= 10 ? 'openLaunchPicker()' : ''}">🚀 Launch (${totalScraps}/10)</button>`;
      } else if (army.moves > 0) {
        actions += `<button style="width:auto;flex:0 0 auto;" onclick="enterMoveMode(${army.id})">Move</button>`;
      }
      if (army.type === "settler" && playerOwns && !settlement) {
        actions += `<button style="width:auto;flex:0 0 auto;" onclick="foundCity(${army.id})">Found City</button>`;
      } else if (army.type === "settler" && state.ownership[army.row][army.col] === -1) {
        actions += `<button style="width:auto;flex:0 0 auto;" onclick="foundCity(${army.id})">Found City</button>`;
      }
      actions += `</div>`;
    }
  }
  actEl.innerHTML = actions;
}

function renderCivList() {
  const el = document.getElementById("civ-list");
  const sorted = [...state.civs]
    .filter(c => c.alive)
    .sort((a, b) => countTiles(b) - countTiles(a));
  el.innerHTML = sorted.map(c => {
    const t = countTiles(c);
    const era = ERAS[c.era].name;
    return `<div class="civ-row">
      <span class="civ-color" style="background:${c.color}"></span>
      <span class="civ-name">${c.isPlayer ? "★ " : ""}${c.name}</span>
      <span class="civ-meta">${t}t · ${era.split(" ")[0]}</span>
    </div>`;
  }).join("");
}

function renderLog() {
  const el = document.getElementById("log");
  el.innerHTML = state.log.slice(0, 30).map(e =>
    `<div class="log-entry ${e.kind}"><b>${yearLabel(e.year)}</b> · ${e.msg}</div>`
  ).join("");
}

function pixelToTile(clientX, clientY) {

  const rect = canvas.getBoundingClientRect();
  const cssX = clientX - rect.left;
  const cssY = clientY - rect.top;
  const mapX = (cssX - view.panX) / view.zoom;
  const mapY = (cssY - view.panY) / view.zoom;
  const col = Math.floor(mapX / TILE);
  const row = Math.floor(mapY / TILE);
  return { col, row, mapX, mapY };
}

canvas.addEventListener("click", (e) => {
  if (suppressNextClick) { suppressNextClick = false; return; }
  const hit = pixelToTile(e.clientX, e.clientY);
  const { col, row, mapX, mapY } = hit;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  
  
  if (state.frontlineSelecting && state.phase === "playing") {
    const owner = state.ownership[row][col];
    const me = state.civs[0];
    if (!me || !me.isPlayer) return;
    if (owner < 0) {
      flashHint("Pick a tile owned by another country.");
      return;
    }
    if (owner === me.id) {
      flashHint("That's your own territory. Click a neighbouring country.");
      return;
    }
    if (!state.frontlineEnemies) state.frontlineEnemies = new Set();
    if (state.frontlineEnemies.has(owner)) {
      state.frontlineEnemies.delete(owner);
      const civ = state.civs.find(c => c.id === owner);
      log("event", "Front line removed against " + (civ ? civ.name : "civ " + owner) + ".");
    } else {
      state.frontlineEnemies.add(owner);
      const civ = state.civs.find(c => c.id === owner);
      log("event", "Front line drawn along the " + (civ ? civ.name : "civ " + owner) + " border.");
    }
    render();
    return;
  }

  if (state.phase === "menu") {
    flashHint("Click PLAY to begin, then pick a tile.");
    return;
  }
  if (state.phase === "placement") {
    if (PASSABLE(MAP[row][col]) && state.ownership[row][col] === -1) {
      spawnPlayer(col, row);
      document.getElementById("splash").style.display = "none";
      state.selectedTile = { col, row };
      render();
      updateUI();
    } else {
      flashHint("Pick a land tile that's unclaimed.");
    }
    return;
  }

  if (state.moveMode) {
    const army = findArmyById(state.moveMode.armyId);
    if (army) {
      const isAdj = neighbors(army.col, army.row).some(([nc, nr]) => nc === col && nr === row);
      if (isAdj && PASSABLE(MAP[row][col])) {
        tryMoveOrAttack(army, col, row);
        state.moveMode = null;
        document.getElementById("move-mode-banner").style.display = "none";
        state.selectedTile = { col, row };
        invalidateTintCache();
        render();
        updateUI();
      } else {
        
        state.moveMode = null;
        document.getElementById("move-mode-banner").style.display = "none";
        render();
      }
    }
    return;
  }

  state.selectedTile = { col, row };

  
  const _player = state.civs[0];
  if (_player && _player.isPlayer) {
    const onTile = _player.armies.find(a => a.col === col && a.row === row);
    state._activeArmyId = onTile ? onTile.id : null;
  }
  
  let pid = 0;
  if (provinceGrid && mapX >= 0 && mapX < MAP_W && mapY >= 0 && mapY < MAP_H) {
    pid = provinceGrid[(mapY | 0) * MAP_W + (mapX | 0)];
  }
  state.selectedProvince = pid;
  state.selectedState = (pid > 0 && provinceToState) ? provinceToState[pid] : 0;

  
  const owner = state.ownership[row][col];
  if (owner >= 0) {
    const civ = state.civs[civIndexById(owner)];
    if (civ && civ.alive && !civ.isPlayer) showCountryPanel(civ);
    else hideCountryPanel();
  } else {
    hideCountryPanel();
  }
  render();
  updateUI();
});

function flashHint(msg) {
  const banner = document.getElementById("move-mode-banner");
  banner.textContent = msg;
  banner.style.display = "block";
  setTimeout(() => { banner.style.display = "none"; }, 1500);
}

window.queueBuild = function (settlementId, type) {
  const player = state.civs[0];
  const s = player.settlements.find(s => s.id === settlementId);
  if (!s) return;
  s.queue.push({ type, progress: 0 });
  updateUI();
};

window.queueBuildBulk = function (settlementId, type, count) {
  const player = state.civs[0];
  const s = player.settlements.find(s => s.id === settlementId);
  if (!s) return;
  for (let i = 0; i < Math.min(count, 99); i++) s.queue.push({ type, progress: 0 });
  updateUI();
};
window.cancelBuild = function (settlementId) {
  const player = state.civs[0];
  const s = player.settlements.find(s => s.id === settlementId);
  if (!s) return;
  s.queue = [];
  updateUI();
};

let _buyHoldTimer = null;
let _buyHoldFired = false;
window.startBuyHold = function (settlementId, type) {
  _buyHoldFired = false;
  if (_buyHoldTimer) clearTimeout(_buyHoldTimer);
  _buyHoldTimer = setTimeout(() => {
    _buyHoldFired = true;
    _buyHoldTimer = null;
    const label = type === "settler" ? "Settler" : (UNITS[type] && UNITS[type].name) || type;
    const raw = prompt(`How many ${label} to queue?`, "5");
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n > 0) queueBuildBulk(settlementId, type, n);
  }, 500);
};
window.endBuyHold = function (settlementId, type) {
  if (_buyHoldTimer) {
    clearTimeout(_buyHoldTimer);
    _buyHoldTimer = null;
    if (!_buyHoldFired) queueBuild(settlementId, type);
  }
};
window.cancelBuyHold = function () {
  if (_buyHoldTimer) { clearTimeout(_buyHoldTimer); _buyHoldTimer = null; }
};
// Rocket-launch system. Player accumulates rocket_scraps (era 6 only,
// immovable). Launch button on the unit row opens a planet picker;
// each planet has a min-scrap cost. On launch, scraps are deducted
// across the player's stacks, and the player gets a starting tile +
// army at a random no-man's-land tile on the chosen planet.
const PLANET_LAUNCH_COSTS = {
  "Moon": 10,
  "Phobos": 25,
  "Deimos": 25,
  "Venus": 30,
  "Mars": 30,
  "Mercury": 60,
  "Jupiter": 100,
  "Io": 100,
  "Europa": 100,
  "Ganymede": 100,
  "Callisto": 100,
  "Saturn": 150,
  "Mimas": 160,
  "Titan": 150,
  "Uranus": 200,
  "Neptune": 250,
  "Triton": 260,
  "Pluto": 300,
  "Asteroid Belt": 70,
  "Proxima Centauri b": 1000,
};

function countPlayerScraps() {
  const player = state.civs[0];
  if (!player || !player.isPlayer || !player.alive) return 0;
  let n = 0;
  for (const a of player.armies) if (a.type === "rocket_scraps") n += a.count || 0;
  return n;
}

function consumePlayerScraps(n) {
  const player = state.civs[0];
  if (!player) return false;
  let remaining = n;
  // Drain from rocket_scraps armies (oldest first), removing empty stacks.
  const newArmies = [];
  for (const a of player.armies) {
    if (a.type !== "rocket_scraps" || remaining <= 0) { newArmies.push(a); continue; }
    if (a.count > remaining) { a.count -= remaining; remaining = 0; newArmies.push(a); }
    else { remaining -= a.count; }
  }
  player.armies = newArmies;
  return remaining === 0;
}

window.openLaunchPicker = function () {
  if (state.year < 2050) {
    flashHint("Interplanetary travel won't be possible until year 2050.");
    return;
  }
  const scraps = countPlayerScraps();
  const modal = document.getElementById("launch-modal");
  if (!modal) return;
  const list = document.getElementById("launch-list");
  list.innerHTML = "";
  document.getElementById("launch-scrap-count").textContent = String(scraps);
  // Sorted ascending by cost.
  const entries = Object.entries(PLANET_LAUNCH_COSTS).sort((a, b) => a[1] - b[1]);
  for (const [name, cost] of entries) {
    const row = document.createElement("button");
    const enabled = scraps >= cost;
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;padding:8px 14px;margin:3px 0;background:" + (enabled ? "linear-gradient(180deg,#3a2a14,#1a0e04)" : "#1a0e04") + ";border:1px solid " + (enabled ? "#6a5a3c" : "#3a2a14") + ";color:" + (enabled ? "#fff5cc" : "#5a4a32") + ";font-family:Georgia,serif;cursor:" + (enabled ? "pointer" : "not-allowed") + ";letter-spacing:2px;";
    row.innerHTML = '<span>' + name + '</span><span style="color:' + (enabled ? "#ffd24a" : "#5a4a32") + ';">' + cost + ' scraps</span>';
    if (enabled) {
      row.addEventListener("click", () => {
        modal.style.display = "none";
        launchToPlanet(name, cost);
      });
    }
    list.appendChild(row);
  }
  modal.style.display = "flex";
};

function ensurePlanetSettlement(civ, col, row, planetName) {
  if (!civ.settlements) civ.settlements = [];
  for (const s of civ.settlements) {
    if (s.col === col && s.row === row && (s.planet || "Earth") === planetName) return s;
  }
  const s = {
    id: nextSettlementId++,
    col, row,
    name: civ.name + " Colony",
    pop: 3, food: 0, prod: 0, queue: [], walls: false,
    planet: planetName,
  };
  civ.settlements.push(s);
  return s;
}

function countCivScraps(civ) {
  let n = 0;
  for (const a of (civ.armies || [])) if (a.type === "rocket_scraps") n += a.count || 0;
  return n;
}

function consumeCivScraps(civ, n) {
  let remaining = n;
  const newArmies = [];
  for (const a of (civ.armies || [])) {
    if (a.type !== "rocket_scraps" || remaining <= 0) { newArmies.push(a); continue; }
    if (a.count > remaining) { a.count -= remaining; remaining = 0; newArmies.push(a); }
    else { remaining -= a.count; }
  }
  civ.armies = newArmies;
  return remaining === 0;
}

function aiTryLaunchRocket(civ) {
  if (!civ || !civ.alive || civ.isPlayer) return;
  if (state.year < 2050) return;
  const scraps = countCivScraps(civ);
  if (scraps < 10) return;
  if (Math.random() > 0.05) return;
  const affordable = Object.entries(PLANET_LAUNCH_COSTS).filter(([n, c]) => scraps >= c);
  if (affordable.length === 0) return;
  affordable.sort((a, b) => b[1] - a[1]);
  const top = affordable.slice(0, Math.min(3, affordable.length));
  const [planetName, cost] = top[Math.floor(Math.random() * top.length)];
  if (!consumeCivScraps(civ, cost)) return;
  if (!state.planetOwnership) state.planetOwnership = {};
  if (!state.planetOwnership[planetName]) {
    state.planetOwnership[planetName] = rebuildPlanetOwnership(planetName);
  }
  const grid = state.planetOwnership[planetName];
  const candidates = [];
  const planetIsEarth = planetName === "Earth";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== -1) continue;
      if (planetIsEarth && MAP[r][c] === "ocean") continue;
      candidates.push([c, r]);
    }
  }
  if (candidates.length === 0) return;
  const [col, row] = candidates[Math.floor(Math.random() * candidates.length)];
  grid[row][col] = civ.id;
  for (const [nc, nr] of neighbors(col, row)) {
    if (grid[nr][nc] !== -1) continue;
    if (planetIsEarth && MAP[nr][nc] === "ocean") continue;
    grid[nr][nc] = civ.id;
  }
  ensurePlanetSettlement(civ, col, row, planetName);
  civ.armies.push({
    id: nextArmyId++, col, row,
    type: "modern", count: 3, civId: civ.id, moves: 1, planet: planetName,
  });
  log("event", "🚀 " + civ.name + " launches a rocket to " + planetName + " and founds a colony.");
}

function launchToPlanet(planetName, cost) {
  const player = state.civs[0];
  if (!player || !player.isPlayer || !player.alive) return;
  if (state.year < 2050) {
    flashHint("Interplanetary travel won't be possible until year 2050.");
    return;
  }
  if (!consumePlayerScraps(cost)) return;
  if (!state.planetOwnership) state.planetOwnership = {};
  if (!state.planetOwnership[planetName]) {
    state.planetOwnership[planetName] = rebuildPlanetOwnership(planetName);
  }
  const grid = state.planetOwnership[planetName];
  const candidates = [];
  const planetIsEarth = planetName === "Earth";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== -1) continue;
      if (planetIsEarth && MAP[r][c] === "ocean") continue;
      candidates.push([c, r]);
    }
  }
  if (candidates.length === 0) {
    log("event", "Rocket reaches " + planetName + " but finds no unclaimed land.");
    return;
  }
  const [col, row] = candidates[Math.floor(Math.random() * candidates.length)];
  grid[row][col] = player.id;
  for (const [nc, nr] of neighbors(col, row)) {
    if (grid[nr][nc] !== -1) continue;
    if (planetIsEarth && MAP[nr][nc] === "ocean") continue;
    grid[nr][nc] = player.id;
  }
  ensurePlanetSettlement(player, col, row, planetName);
  player.armies.push({
    id: nextArmyId++, col, row,
    type: "modern", count: 3, civId: player.id, moves: 1, planet: planetName,
  });
  log("event", "🚀 " + player.name + " launches a rocket to " + planetName + " (-" + cost + " scraps) and founds a colony.");
  if (state.currentPlanet === "Earth" || !state.currentPlanet) {
    enterPlanetSurface(planetName);
  } else {
    invalidateTintCache();
    render();
  }
}

window.enterMoveMode = function (armyId) {

  const id = typeof armyId === "string" ? parseInt(armyId, 10) : armyId;
  state.moveMode = { armyId: id };

  
  state._activeArmyId = id;

  const army = findArmyById(id);
  if (army) {
    state.selectedTile = { col: army.col, row: army.row };
    const tname = (UNITS[army.type] && UNITS[army.type].name) || army.type;
    const banner = document.getElementById("move-mode-banner");
    if (banner) {
      banner.textContent = "Moving " + tname + " · click an adjacent tile, or use arrow keys / right-click.";
      banner.style.display = "block";
    }
  }
  render();
};
window.foundCity = function (armyId) {
  const army = findArmyById(armyId);
  if (!army || army.type !== "settler") return;
  const owner = state.ownership[army.row][army.col];
  const player = state.civs[0];
  if (owner !== -1 && owner !== player.id) {
    flashHint("Can't found city on enemy territory.");
    return;
  }
  if (player.settlements.some(s => s.col === army.col && s.row === army.row)) {
    flashHint("Already a city here.");
    return;
  }
  placeCivOnMap(player, army.col, army.row, false);
  const i = player.armies.indexOf(army);
  if (i >= 0) player.armies.splice(i, 1);
  log("peace", `Founded a new settlement.`);
  invalidateTintCache();
  render();
  updateUI();
};

let suppressNextClick = false;
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const mapX = (px - view.panX) / view.zoom;
  const mapY = (py - view.panY) / view.zoom;
  const dz = e.deltaY < 0 ? 1.18 : 1 / 1.18;
  const minZoom = Math.min(canvas.width / MAP_W, canvas.height / MAP_H) * 0.6;
  view.zoom = Math.max(minZoom, Math.min(10, view.zoom * dz));
  view.panX = px - mapX * view.zoom;
  view.panY = py - mapY * view.zoom;
  render();
}, { passive: false });

let dragging = null;
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 2 || e.button === 1 || (e.button === 0 && e.shiftKey)) {
    e.preventDefault();
    dragging = {
      startX: e.clientX, startY: e.clientY,
      panX: view.panX, panY: view.panY,
      moved: false,
      button: e.button,
      clientX: e.clientX, clientY: e.clientY,
    };
  }
});
window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.clientX - dragging.startX;
  const dy = e.clientY - dragging.startY;
  if (Math.abs(dx) + Math.abs(dy) > 3) dragging.moved = true;
  view.panX = dragging.panX + dx;
  view.panY = dragging.panY + dy;
  render();
});
window.addEventListener("mouseup", (e) => {
  if (dragging) {
    if (dragging.moved) suppressNextClick = true;
    
    if (!dragging.moved && dragging.button === 2 && state.phase === "playing") {
      const hit = pixelToTile(dragging.clientX, dragging.clientY);
      if (hit.col >= 0 && hit.col < COLS && hit.row >= 0 && hit.row < ROWS) {
        setPlayerUnitDestination(hit.col, hit.row);
      }
    }
    dragging = null;
  }
});

function setPlayerUnitDestination(col, row) {
  const player = state.civs[0];
  if (!player || !player.isPlayer || !player.alive) return;

  let army = null;
  if (state._activeArmyId != null) {
    army = player.armies.find(a => a.id === state._activeArmyId);
  }
  if (!army && state.selectedTile) {
    const { col: sc, row: sr } = state.selectedTile;
    army = player.armies.find(a => a.col === sc && a.row === sr);
  }
  if (!army) return;
  if (army.col === col && army.row === row) { army.dest = null; return; }
  army.dest = { col, row };
  flashHint("Auto-moving " + (UNITS[army.type] && UNITS[army.type].name || army.type) + " to (" + col + "," + row + ")");
}
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

const tooltip = document.getElementById("city-tooltip");
canvas.addEventListener("mousemove", (e) => {
  if (dragging) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const mapX = (px - view.panX) / view.zoom;
  const mapY = (py - view.panY) / view.zoom;
  
  const r = Math.max(2.5, 7 / view.zoom);
  const r2 = r * r;

  let bestName = null, bestD = r2, bestVP = 0;

  if (typeof HOI4_CITIES !== "undefined") {
    for (const city of HOI4_CITIES) {
      const dx = city.x - mapX;
      const dy = city.y - mapY;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestName = city.name; bestVP = city.vp || 0; }
    }
  }
  
  for (const civ of state.civs) {
    if (!civ.alive) continue;
    for (let i = 0; i < civ.settlements.length; i++) {
      if (i === 0) continue;
      const s = civ.settlements[i];
      const dx = (s.col + 0.5) * TILE - mapX;
      const dy = (s.row + 0.5) * TILE - mapY;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestName = s.name; bestVP = 0; }
    }
  }

  if (bestName) {
    tooltip.style.display = "block";
    tooltip.style.left = (e.clientX + 12) + "px";
    tooltip.style.top = (e.clientY + 12) + "px";
    tooltip.innerHTML = bestName + (bestVP > 0 ? `<span class="tt-vp">VP ${bestVP}</span>` : "");
  } else {
    tooltip.style.display = "none";
  }
});
canvas.addEventListener("mouseleave", () => { tooltip.style.display = "none"; });

const CONSOLE_HISTORY = [];
let consoleHistoryIdx = -1;

function consoleEcho(text, kind) {
  const out = document.getElementById("console-output");
  if (!out) return;
  const div = document.createElement("div");
  if (kind) div.className = kind;
  div.textContent = text;
  out.appendChild(div);
  out.scrollTop = out.scrollHeight;
}

function toggleConsole() {
  const panel = document.getElementById("console-panel");
  if (!panel) return;
  const opened = !panel.classList.contains("open");
  panel.classList.toggle("open", opened);
  if (opened) {
    const inp = document.getElementById("console-input");
    setTimeout(() => inp && inp.focus(), 0);
  }
}

(function wireConsoleCloseBtn() {
  const btn = document.getElementById("console-close-btn");
  if (btn) btn.addEventListener("click", () => {
    const panel = document.getElementById("console-panel");
    if (panel) panel.classList.remove("open");
  });
})();

(function wireConsoleDrag() {
  const panel = document.getElementById("console-panel");
  if (!panel) return;
  const header = panel.querySelector(".console-header");
  if (!header) return;
  let dragging = false;
  let offsetX = 0, offsetY = 0;
  header.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    panel.classList.add("dragged");
    panel.style.left = rect.left + "px";
    panel.style.top  = rect.top  + "px";
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const x = Math.max(0, Math.min(window.innerWidth  - 40, e.clientX - offsetX));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - offsetY));
    panel.style.left = x + "px";
    panel.style.top  = y + "px";
  });
  document.addEventListener("mouseup", () => { dragging = false; });
})();

function consoleFindCiv(query) {
  if (!query) return null;
  const q = query.trim().toLowerCase();
  function namesOf(c) {
    return [c.name, ...(c.previousNames || [])].map(n => n.toLowerCase());
  }
  
  let exact = state.civs.filter(c => c.alive && namesOf(c).includes(q));
  if (exact.length === 1) return exact[0];
  
  const partial = state.civs.filter(c => c.alive && namesOf(c).some(n => n.includes(q)));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) return null;
  return partial;
}

function runConsoleCommand(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  consoleEcho("> " + trimmed, "echo");
  CONSOLE_HISTORY.push(trimmed);
  consoleHistoryIdx = CONSOLE_HISTORY.length;
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = trimmed.slice(parts[0].length).trim();

  if (cmd === "help") {
    consoleEcho("commands:", "info");
    consoleEcho("  help                       list commands", "info");
    consoleEcho("  tag <civ name>             switch to playing as that civ (no rename)", "info");
    consoleEcho("  annex <civ name>           your civ absorbs target's territory + cities", "info");
    consoleEcho("  kill <civ name>            destroy target outright (territory becomes neutral)", "info");
    consoleEcho("  add_war <civ name>         declare war on target", "info");
    consoleEcho("  ally <civ name>            forge an alliance (relations +100)", "info");
    consoleEcho("  peace <civ name>           reset relations to zero with target", "info");
    consoleEcho("  year                       print current year", "info");
    consoleEcho("  list                       list all alive civs", "info");
    consoleEcho("  showtree                   family tree of every civ ever", "info");
    consoleEcho("  splitinfo <civ name>       dump splitter eligibility for a civ", "info");
    consoleEcho("  splitnow <civ name>        force-split a civ regardless of gates", "info");
    consoleEcho("  debug                      enter observer/debug mode (unlocks 20x speed)", "info");
    return;
  }

  if (cmd === "year") {
    consoleEcho("year " + state.year, "ok");
    return;
  }

  if (cmd === "showtree") {
    showCivFamilyTree();
    return;
  }

  if (cmd === "debug") {
    if (state.debug) { consoleEcho("already in debug mode", "err"); return; }
    enterDebugMode();
    consoleEcho("debug mode enabled - 20x speed slot unlocked", "ok");
    return;
  }

  if (cmd === "list") {
    const alive = state.civs.filter(c => c.alive).sort((a, b) => a.name.localeCompare(b.name));
    consoleEcho(alive.length + " civs alive:", "info");
    for (const c of alive) consoleEcho("  " + c.name + (c.isPlayer ? "  [PLAYER]" : ""), "info");
    return;
  }

  
  
  if (cmd === "splitinfo") {
    const result = consoleFindCiv(arg);
    if (!result || Array.isArray(result)) { consoleEcho("usage: splitinfo <civ name>", "err"); return; }
    const c = result;
    const lifespan = state.year - (c.foundedYear != null ? c.foundedYear : -1000);
    const stale = state.year - (c.lastChangeYear != null ? c.lastChangeYear : -1000);
    const tiles = countTiles(c);
    let pieces = 0;
    if (tiles >= 1500) pieces = 4;
    else if (tiles >= 800) pieces = 3;
    else if (tiles >= 250) pieces = 2;
    consoleEcho(c.name + ":", "info");
    consoleEcho("  foundedYear: " + c.foundedYear + "   (lifespan " + lifespan + ")", "info");
    consoleEcho("  lastChangeYear: " + c.lastChangeYear + "   (stale " + stale + ")", "info");
    consoleEcho("  tiles: " + tiles + "   pieces: " + pieces, "info");
    consoleEcho("  isStartingTribe: " + !!c.isStartingTribe, "info");
    consoleEcho("  isPlayer: " + !!c.isPlayer, "info");
    const blocklist = ["Rome", "Western Rome", "Romano-Goths"];
    const blocked = blocklist.includes(c.name) || (c.previousNames || []).some(n => blocklist.includes(n));
    consoleEcho("  blocklisted: " + blocked, "info");
    const eligible = !c.isPlayer && !c.isStartingTribe && !blocked &&
      lifespan >= 1200 && stale >= 300 && pieces > 0;
    consoleEcho("  eligible to split: " + eligible, eligible ? "ok" : "err");
    return;
  }

  
  
  if (cmd === "splitnow") {
    const result = consoleFindCiv(arg);
    if (!result || Array.isArray(result)) { consoleEcho("usage: splitnow <civ name>", "err"); return; }
    const c = result;
    const tiles = countTiles(c);
    let pieces = tiles >= 1500 ? 4 : tiles >= 800 ? 3 : tiles >= 250 ? 2 : 2;
    splitCiv(c, pieces);
    invalidateTintCache();
    render();
    consoleEcho("forced split of " + c.name + " into " + pieces + " pieces", "ok");
    return;
  }

  

  if (cmd === "kill") {
    if (!arg) { consoleEcho("usage: kill <civ name>", "err"); return; }
    markLineageKilled(arg);
    const result = consoleFindCiv(arg);
    if (Array.isArray(result)) {
      consoleEcho("ambiguous - " + result.length + " matches:", "err");
      for (const c of result.slice(0, 10)) consoleEcho("  " + c.name, "err");
      return;
    }
    const target = result;
    if (target) {

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (state.ownership[r][c] === target.id) state.ownership[r][c] = -1;
        }
      }
      target.settlements = [];
      target.armies = [];
      target.alive = false;

      
      markLineageKilled(target.name);
      for (const old of target.previousNames || []) markLineageKilled(old);
      log("death", target.name + " is wiped from history - their lands fall to ruin.");
      invalidateTintCache();
      render();
      consoleEcho("killed " + target.name + " - lineage extinct, territory now no-man's land", "ok");
    } else {
      consoleEcho("'" + arg + "' lineage marked extinct (no live civ to wipe)", "ok");
    }
    return;
  }

  if (cmd === "tag" || cmd === "annex" || cmd === "add_war" || cmd === "peace" || cmd === "ally") {
    if (!arg) { consoleEcho("usage: " + cmd + " <civ name>", "err"); return; }
    const result = consoleFindCiv(arg);
    if (!result) { consoleEcho("no civ matches: " + arg, "err"); return; }
    if (Array.isArray(result)) {
      consoleEcho("ambiguous - " + result.length + " matches:", "err");
      for (const c of result.slice(0, 10)) consoleEcho("  " + c.name, "err");
      return;
    }
    const target = result;
    const player = state.civs[0];

    if (cmd === "tag") {
      if (target === player) { consoleEcho("already playing as " + target.name, "err"); return; }
      if (player) player.isPlayer = false;
      target.isPlayer = true;
      
      const idx = state.civs.indexOf(target);
      if (idx > 0) {
        state.civs.splice(idx, 1);
        state.civs.unshift(target);
      }
      
      state.warFocus = state.warFocus || {};
      
      state.playerWars = new Set();
      consoleEcho("now playing as " + target.name, "ok");
      invalidateTintCache();
      updateUI();
      render();
      return;
    }

    if (cmd === "annex") {
      if (!player) { consoleEcho("no player civ", "err"); return; }
      if (target === player) { consoleEcho("can't annex yourself", "err"); return; }
      
      fireEvent({ type: "absorb", absorber: player.name, target: target.name, message: player.name + " annexes " + target.name });
      consoleEcho("annexed " + target.name, "ok");
      return;
    }

    if (cmd === "add_war") {
      if (!player) { consoleEcho("no player civ", "err"); return; }
      if (target === player) { consoleEcho("can't declare war on yourself", "err"); return; }
      player.relations[target.id] = -100;
      target.relations[player.id] = -100;
      state.warFocus = state.warFocus || {};
      state.warFocus[target.id] = player.id;
      state.playerWars = state.playerWars || new Set();
      state.playerWars.add(target.id);
      log("war", player.name + " declares war on " + target.name + "!");
      try { showWarPopup(player, target); } catch (e) {}
      consoleEcho("at war with " + target.name, "ok");
      return;
    }

    if (cmd === "peace") {
      if (!player) { consoleEcho("no player civ", "err"); return; }
      player.relations[target.id] = 0;
      target.relations[player.id] = 0;
      if (state.warFocus) delete state.warFocus[target.id];
      if (state.playerWars) state.playerWars.delete(target.id);
      consoleEcho("peace with " + target.name, "ok");
      return;
    }

    if (cmd === "ally") {
      if (!player) { consoleEcho("no player civ", "err"); return; }
      if (target === player) { consoleEcho("can't ally with yourself", "err"); return; }
      player.relations[target.id] = 100;
      target.relations[player.id] = 100;
      if (state.warFocus) delete state.warFocus[target.id];
      if (state.playerWars) state.playerWars.delete(target.id);
      log("peace", player.name + " and " + target.name + " forge an alliance!");
      consoleEcho("allied with " + target.name, "ok");
      return;
    }
  }

  consoleEcho("unknown command: " + cmd + " (try 'help')", "err");
}

function buildCivFamilyTree() {
  const nodes = new Map();
  function ensure(name, year, note) {
    if (!nodes.has(name)) {
      nodes.set(name, { name, year, note, children: [], parents: [] });
    } else {
      const n = nodes.get(name);
      
      if (year != null && (n.year == null || year < n.year)) n.year = year;
      if (note && !n.note) n.note = note;
    }
    return nodes.get(name);
  }
  function link(parentName, childName, year) {
    if (!parentName || !childName || parentName === childName) return;
    const p = ensure(parentName, null);
    const c = ensure(childName, year);

    

    if (c.parents.length > 0) return;
    c.parents.push(p);
    p.children.push(c);
  }
  
  if (typeof HISTORICAL_CIVS !== "undefined") {
    for (const t of HISTORICAL_CIVS) ensure(t.name, -1000, "starting tribe");
  }

  
  
  for (const [child, parent] of Object.entries(TREE_PARENT_OVERRIDES)) {
    link(parent, child);
  }
  
  if (typeof HISTORICAL_EVENTS !== "undefined") {
    const sorted = HISTORICAL_EVENTS.slice().sort((a, b) => a.year - b.year);
    for (const ev of sorted) {
      const y = ev.year;
      if (ev.type === "rename" && ev.from && ev.to) {
        link(ev.from, ev.to, y);
      } else if (ev.type === "secede" && ev.civ && ev.target) {
        const civName = typeof ev.civ === "string" ? ev.civ : (ev.civ && ev.civ.name);
        if (civName) {
          link(ev.target, civName, y);

          const n = nodes.get(civName);
          if (n) n.viaIndependence = true;
        }
      } else if (ev.type === "merge" && Array.isArray(ev.from) && ev.to) {
        const toName = typeof ev.to === "string" ? ev.to : ev.to.name;
        for (const fromName of ev.from) link(fromName, toName, y);
      } else if (!ev.type && ev.civ && ev.civ.name) {
        
        const node = ensure(ev.civ.name, y);
        if (ev.replaces) link(ev.replaces, ev.civ.name, y);
      }
    }
  }

  

  for (const civ of state.civs) {
    if (!civ) continue;
    ensure(civ.name, civ.foundedYear != null ? civ.foundedYear : null);
    if (Array.isArray(civ.previousNames) && civ.previousNames.length > 0) {
      const chain = [...civ.previousNames, civ.name];
      for (let i = 0; i + 1 < chain.length; i++) link(chain[i], chain[i + 1], civ.lastChangeYear);
    }
    if (civ.splitParentName) link(civ.splitParentName, civ.name, civ.foundedYear);
  }
  
  const roots = [];
  for (const n of nodes.values()) if (n.parents.length === 0) roots.push(n);
  
  roots.sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name));
  
  for (const n of nodes.values()) {
    n.children.sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name));
  }
  return { nodes, roots };
}

function flagUrlForName(name) {
  if (typeof CIV_TAGS !== "undefined") {
    const tag = CIV_TAGS[name];
    if (tag) return "flags_png/" + tag + ".png";
  }
  if (typeof FLAG_URLS !== "undefined" && FLAG_URLS[name]) return FLAG_URLS[name];
  return null;
}

function fmtTreeYear(y) {
  if (y == null) return "";
  return y < 0 ? Math.abs(y) + " BC" : y + " AD";
}

function showCivFamilyTree() {
  const { nodes, roots } = buildCivFamilyTree();
  const scroll = document.getElementById("tree-scroll");
  const modal = document.getElementById("tree-modal");
  if (!scroll || !modal) return;
  const seen = new Set();

  

  
  const aliveNames = new Set();
  for (const c of state.civs) if (c.alive) aliveNames.add(c.name);

  const playerNameSet = new Set();
  const _player = state.civs[0];
  if (_player && _player.isPlayer) {
    playerNameSet.add(_player.name);
    for (const n of _player.previousNames || []) playerNameSet.add(n);
  }

  const nameToTag = new Map();
  for (const c of state.civs) {
    if (!c || !c.tag) continue;
    if (!nameToTag.has(c.name)) nameToTag.set(c.name, c.tag);
    for (const n of c.previousNames || []) {
      if (!nameToTag.has(n)) nameToTag.set(n, c.tag);
    }
  }
  function markStatus(node, visiting) {
    if (node._statusDone) return node._status;
    if (visiting.has(node)) return "alive";   
    visiting.add(node);
    const selfAlive = aliveNames.has(node.name);
    let anyChildAlive = false;
    for (const ch of node.children) {
      if (markStatus(ch, visiting) === "alive") anyChildAlive = true;
    }
    visiting.delete(node);
    if (selfAlive || anyChildAlive) {
      node._status = "alive";
    } else if (node.year != null && node.year > state.year) {
      
      node._status = "future";
    } else {
      node._status = "extinct";
    }
    node._statusDone = true;
    return node._status;
  }
  for (const root of roots) markStatus(root, new Set());

  

  function propagateExtinct(node, parentExtinct) {
    const myExtinct = node._status === "extinct" || (parentExtinct && node._status !== "alive");
    if (myExtinct) node._status = "extinct";
    for (const ch of node.children) propagateExtinct(ch, myExtinct);
  }
  for (const root of roots) propagateExtinct(root, false);

  
  if (state.consoleKilledLineages && state.consoleKilledLineages.size > 0) {
    function killWalk(node) {
      if (state.consoleKilledLineages.has(node.name.toLowerCase())) {
        node._status = "extinct";
        for (const ch of node.children) killWalk(ch);
      } else {
        for (const ch of node.children) killWalk(ch);
      }
    }
    for (const root of roots) killWalk(root);
  }
  function renderNode(node) {
    const li = document.createElement("li");
    li.className = "tree-node";
    const wrap = document.createElement("div");
    wrap.className = "tree-node-card-wrap";
    const isDup = seen.has(node.name);
    const card = document.createElement("div");
    let cls = "tree-card" + (isDup ? " dup" : "");
    if (node._status === "extinct") cls += " extinct";
    else if (node._status === "future") cls += " future";

    
    if (node._status === "future" && node.viaIndependence) cls += " future-independence";

    if (playerNameSet.has(node.name)) cls += " player-own";
    card.className = cls;
    const url = flagUrlForName(node.name);
    if (url) {
      const img = document.createElement("img");
      img.className = "tree-flag";
      img.src = url;
      img.alt = "";
      img.onerror = () => { img.style.display = "none"; };
      card.appendChild(img);
    } else {
      
      const c = document.createElement("canvas");
      c.className = "tree-flag";
      c.width = 48; c.height = 32;
      try {
        drawProceduralFlag(c, { id: 0, name: node.name, color: "#6b4f2c" });
      } catch (e) {}
      card.appendChild(c);
    }
    const nm = document.createElement("div");
    nm.className = "tree-name";
    nm.textContent = node.name;
    card.appendChild(nm);
    
    if (state.debug) {
      const tag = nameToTag.get(node.name);
      if (tag) {
        const tg = document.createElement("div");
        tg.className = "tree-tag";
        tg.textContent = tag;
        card.appendChild(tg);
      }
    }
    if (node.year != null) {
      const yr = document.createElement("div");
      yr.className = "tree-year";
      yr.textContent = fmtTreeYear(node.year);
      card.appendChild(yr);
    }
    if (node._status === "extinct") {
      const x = document.createElement("div");
      x.className = "tree-extinct-mark";
      x.textContent = "✕";
      card.appendChild(x);
    }
    wrap.appendChild(card);
    li.appendChild(wrap);
    if (isDup) return li;
    seen.add(node.name);
    if (node.children.length > 0) {
      wrap.classList.add("has-children");
      const childUl = document.createElement("ul");
      childUl.className = "tree-children" + (node.children.length > 1 ? " multi" : "");
      for (const c of node.children) childUl.appendChild(renderNode(c));
      li.appendChild(childUl);
    }
    return li;
  }
  scroll.innerHTML = "";

  
  const canvasDiv = document.createElement("div");
  canvasDiv.className = "tree-canvas";
  const ul = document.createElement("ul");
  ul.className = "tree-root-list";
  for (const root of roots) ul.appendChild(renderNode(root));
  canvasDiv.appendChild(ul);
  scroll.appendChild(canvasDiv);
  modal.classList.add("open");
  
  state._treeView = { panX: 32, panY: 32, zoom: 1 };
  applyTreeTransform();
}

function applyTreeTransform() {
  const canvasDiv = document.querySelector("#tree-modal .tree-canvas");
  if (!canvasDiv || !state._treeView) return;
  const { panX, panY, zoom } = state._treeView;
  canvasDiv.style.transform = "translate(" + panX + "px, " + panY + "px) scale(" + zoom + ")";
}

(function wireTreePanZoom() {
  const scroll = document.getElementById("tree-scroll");
  if (!scroll) return;
  function tv() { return state._treeView || (state._treeView = { panX: 0, panY: 0, zoom: 1 }); }

  let dragging = false, dragStart = null;
  scroll.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = true;
    dragStart = { x: e.clientX, y: e.clientY, panX: tv().panX, panY: tv().panY };
    scroll.classList.add("dragging");
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const v = tv();
    v.panX = dragStart.panX + (e.clientX - dragStart.x);
    v.panY = dragStart.panY + (e.clientY - dragStart.y);
    applyTreeTransform();
  });
  document.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    scroll.classList.remove("dragging");
  });

  scroll.addEventListener("wheel", (e) => {
    if (!document.getElementById("tree-modal").classList.contains("open")) return;
    e.preventDefault();
    const v = tv();
    const rect = scroll.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    const newZoom = Math.max(0.15, Math.min(4, v.zoom * factor));
    
    v.panX = cx - (cx - v.panX) * (newZoom / v.zoom);
    v.panY = cy - (cy - v.panY) * (newZoom / v.zoom);
    v.zoom = newZoom;
    applyTreeTransform();
  }, { passive: false });

  let lastTouch = null;
  let pinchStart = null;
  function dist(a, b) { const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY; return Math.sqrt(dx*dx + dy*dy); }
  function midPoint(e) {
    const rect = scroll.getBoundingClientRect();
    const t0 = e.touches[0], t1 = e.touches[1];
    return { x: ((t0.clientX + t1.clientX) / 2) - rect.left, y: ((t0.clientY + t1.clientY) / 2) - rect.top };
  }
  scroll.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastTouch = { x: t.clientX, y: t.clientY };
      pinchStart = null;
    } else if (e.touches.length === 2) {
      const v = tv();
      const mid = midPoint(e);
      pinchStart = {
        d: dist(e.touches[0], e.touches[1]),
        zoom: v.zoom,
        midX: mid.x, midY: mid.y,
        anchorX: (mid.x - v.panX) / v.zoom,
        anchorY: (mid.y - v.panY) / v.zoom,
      };
      lastTouch = null;
    }
  }, { passive: true });
  scroll.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && lastTouch) {
      const t = e.touches[0];
      const v = tv();
      v.panX += t.clientX - lastTouch.x;
      v.panY += t.clientY - lastTouch.y;
      lastTouch = { x: t.clientX, y: t.clientY };
      applyTreeTransform();
    } else if (e.touches.length === 2 && pinchStart) {
      const v = tv();
      const d = dist(e.touches[0], e.touches[1]);
      const newZoom = Math.max(0.15, Math.min(4, pinchStart.zoom * (d / pinchStart.d)));
      const mid = midPoint(e);
      v.zoom = newZoom;
      v.panX = mid.x - pinchStart.anchorX * newZoom;
      v.panY = mid.y - pinchStart.anchorY * newZoom;
      applyTreeTransform();
    }
    e.preventDefault();
  }, { passive: false });
  scroll.addEventListener("touchend", (e) => {
    if (e.touches.length === 0) { lastTouch = null; pinchStart = null; }
  });
})();

(function wireTreeModal() {
  const close = document.getElementById("tree-close");
  if (close) close.addEventListener("click", () => {
    document.getElementById("tree-modal").classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const m = document.getElementById("tree-modal");
      if (m && m.classList.contains("open")) m.classList.remove("open");
    }
  });
})();

(function wireConsole() {
  const inp = document.getElementById("console-input");
  if (!inp) return;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      runConsoleCommand(inp.value);
      inp.value = "";
      e.preventDefault();
    } else if (e.key === "Escape" || e.key === "`" || e.key === "~" || e.key === "§") {
      toggleConsole();
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      if (CONSOLE_HISTORY.length === 0) return;
      consoleHistoryIdx = Math.max(0, consoleHistoryIdx - 1);
      inp.value = CONSOLE_HISTORY[consoleHistoryIdx] || "";
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (CONSOLE_HISTORY.length === 0) return;
      consoleHistoryIdx = Math.min(CONSOLE_HISTORY.length, consoleHistoryIdx + 1);
      inp.value = CONSOLE_HISTORY[consoleHistoryIdx] || "";
      e.preventDefault();
    }
  });
})();

function openConsolePanel() {
  const panel = document.getElementById("console-panel");
  if (panel && !panel.classList.contains("open")) toggleConsole();
}
window.openConsole = openConsolePanel;

let consoleUnlockBuf = "";
function _consoleAdminKey(e) {
  if (!e.key || e.key.length !== 1) return;
  consoleUnlockBuf = (consoleUnlockBuf + e.key.toLowerCase()).slice(-5);
  if (consoleUnlockBuf === "admin") {
    consoleUnlockBuf = "";
    openConsolePanel();
  }
}
document.addEventListener("keydown", _consoleAdminKey, true);
window.addEventListener("keydown", _consoleAdminKey, true);

document.addEventListener("keydown", (e) => {
  if (e.key === "F1") { openConsolePanel(); e.preventDefault(); }
});

(function wireVersionTagAdminClick() {
  const tag = document.getElementById("version-tag");
  if (!tag) return;
  tag.style.pointerEvents = "auto";
  tag.style.cursor = "pointer";
  tag.title = "Click to open admin console";
  tag.addEventListener("click", openConsolePanel);
})();

let debugBuffer = "";
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (state.phase === "placement" && e.key.length === 1) {
    debugBuffer = (debugBuffer + e.key.toUpperCase()).slice(-5);
    if (debugBuffer === "DEBUG") {
      enterDebugMode();
      debugBuffer = "";
    }
  }
});

function enterDebugMode() {
  state.debug = true;
  state.phase = "playing";
  document.getElementById("splash").style.display = "none";
  log("event", "🧪 DEBUG MODE - observing history without intervention.");
  
  const subtitle = document.querySelector(".subtitle");
  if (subtitle) subtitle.innerHTML = '<span style="color:#ff7d4a">⚙ OBSERVER MODE</span>';
  
  document.querySelectorAll(".speed-btn.debug-only").forEach(b => b.style.display = "");
  setSpeed(5);   
  updateUI();
}

document.querySelectorAll(".speed-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const s = parseInt(btn.dataset.speed, 10);
    if (isNaN(s)) return;   
    setSpeed(s);
  });
});

function paintSplashTribeFlags() {
  document.querySelectorAll(".splash-tribe-btn").forEach(btn => {
    const tribeName = btn.dataset.tribe;
    const cv = btn.querySelector(".splash-tribe-flag");
    if (!cv) return;
    const civ = state.civs.find(c => c.name === tribeName);
    if (!civ) return;
    try { drawProceduralFlag(cv, civ); } catch (e) {}
  });
}

setTimeout(paintSplashTribeFlags, 500);
setTimeout(paintSplashTribeFlags, 1500);
setTimeout(paintSplashTribeFlags, 3000);

let _splashSelectedTribe = null;
document.querySelectorAll(".splash-tribe-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".splash-tribe-btn").forEach(b => {
      b.style.borderColor = "#6a5a3c";
      b.style.background = "linear-gradient(180deg,#3a2a14,#1a0e04)";
      b.style.color = "#cfbf95";
    });
    if (_splashSelectedTribe === btn.dataset.tribe) {
      _splashSelectedTribe = null;   
    } else {
      _splashSelectedTribe = btn.dataset.tribe;
      btn.style.borderColor = "#ffd24a";
      btn.style.background = "linear-gradient(180deg,#a8923a,#624a14)";
      btn.style.color = "#fff5cc";
    }
  });
});

document.querySelectorAll('#splash-modifiers input[type="checkbox"]').forEach(cb => {
  cb.addEventListener("change", () => {
    if (!cb.checked) return;
    if (cb.dataset.mod === "ww2-state") {
      const m = document.querySelector('#splash-modifiers input[data-mod="mars-survival"]');
      if (m) m.checked = false;
    } else if (cb.dataset.mod === "mars-survival") {
      const m = document.querySelector('#splash-modifiers input[data-mod="ww2-state"]');
      if (m) m.checked = false;
    }
  });
});

const _splashPlayBtn = document.getElementById("splash-play");
if (_splashPlayBtn) {
  _splashPlayBtn.addEventListener("click", () => {

    const mods = document.querySelectorAll('#splash-modifiers input[type="checkbox"]');
    let marsSurvival = false;
    for (const m of mods) {
      if (!m.checked) continue;
      const which = m.dataset.mod;
      if (which === "kill-latins") killStartingTribe("Latins");
      else if (which === "kill-eastslavs") killStartingTribe("East Slavs");
      else if (which === "kill-polans") killStartingTribe("Polans");
      else if (which === "kill-balts") killStartingTribe("Balts");
      else if (which === "kill-germans") killStartingTribe("Germans");
      else if (which === "kill-finns") killStartingTribe("Finns");
      else if (which === "ww2-state") applyWW2TribeTerritory();
      else if (which === "mars-survival") marsSurvival = true;
      else if (which === "debug-start") {
        state._modDebugStart = true;
      }
    }
    if (marsSurvival) applyMarsSurvival();
    document.getElementById("splash").style.display = "none";
    if (marsSurvival) {
      state.phase = "placement";
      flashHint("Click a land tile on Mars to plant your colony.");
      invalidateTintCache(); render(); updateUI();
      return;
    }
    if (state._modDebugStart && !_splashSelectedTribe) {
      state._modDebugStart = false;
      enterDebugMode();
    } else if (_splashSelectedTribe) {
      const tribeCiv = state.civs.find(c => c.alive && c.name === _splashSelectedTribe);
      if (tribeCiv) {
        tribeCiv.isPlayer = true;
        const idx = state.civs.indexOf(tribeCiv);
        if (idx > 0) {
          state.civs.splice(idx, 1);
          state.civs.unshift(tribeCiv);
        }
        state.phase = "playing";
        if (tribeCiv.settlements && tribeCiv.settlements[0]) {
          state.selectedTile = { col: tribeCiv.settlements[0].col, row: tribeCiv.settlements[0].row };
        }
        if (state._modDebugStart && typeof enterDebugMode === "function") {
          state._modDebugStart = false;
          enterDebugMode();
        }
        log("event", "Playing as " + tribeCiv.name + ".");
      } else {
        state.phase = "placement";
        flashHint("Chosen tribe is gone. Click any land tile to place a fresh tribe.");
      }
    } else {
      state.phase = "placement";
      flashHint("Click any land tile on the map to place your tribe.");
    }
    invalidateTintCache();
    render();
    updateUI();
  });
}

function killStartingTribe(name) {
  markLineageKilled(name);
  const target = state.civs.find(c => c.alive && (c.name === name || (c.previousNames || []).includes(name)));
  if (!target) return;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.ownership[r][c] === target.id) state.ownership[r][c] = -1;
    }
  }
  target.settlements = [];
  target.armies = [];
  target.alive = false;
  log("event", name + " is wiped from history before the game even begins.");
}

function applyMarsSurvival() {
  if (!state.planetOwnership) state.planetOwnership = {};
  if (!state.planetOwnership["Mars"]) {
    state.planetOwnership["Mars"] = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  }
  const grid = state.planetOwnership["Mars"];

  const marsTribes = [
    { name: "Olympus Pioneers",  color: "#e84a3a", lat:  18.65, lon: -134.03 },
    { name: "Hellas Settlers",   color: "#c84a3a", lat: -42.7,  lon:   70.0  },
    { name: "Tharsis Clans",     color: "#d4684a", lat:   4.5,  lon: -110.0  },
    { name: "Vastitas Nomads",   color: "#a8584a", lat:  60.0,  lon:    0.0  },
  ];

  state._earthOwnership = state.ownership;
  state.ownership = grid;
  state.currentPlanet = "Mars";

  for (const t of marsTribes) {
    const seed = latLonToTile(t.lat, t.lon);
    const land = nearestLand(seed.col, seed.row);
    const civ = makeCiv({ name: t.name, color: t.color });
    civ.isStartingTribe = true;
    state.civs.push(civ);

    const queue = [[land.col, land.row]];
    const seen = new Set([land.row * COLS + land.col]);
    let claimed = 0;
    while (queue.length && claimed < 12) {
      const [c, r] = queue.shift();
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (grid[r][c] !== -1) continue;
      if (!PASSABLE(MAP[r][c])) continue;
      grid[r][c] = civ.id;
      claimed++;
      for (const [nc, nr] of neighbors(c, r)) {
        const k = nr * COLS + nc;
        if (!seen.has(k)) { seen.add(k); queue.push([nc, nr]); }
      }
    }
    civ.settlements.push({
      id: nextSettlementId++, col: land.col, row: land.row,
      name: t.name + " Hub",
      pop: 2, food: 0, prod: 0, queue: [], walls: false,
      planet: "Mars",
    });
    civ.armies.push({
      id: nextArmyId++, col: land.col, row: land.row,
      type: "warrior", count: 2, civId: civ.id, moves: 1, planet: "Mars",
    });
  }

  for (const a of state.civs) {
    for (const b of state.civs) {
      if (a.id !== b.id) {
        if (a.relations[b.id] == null) a.relations[b.id] = 0;
      }
    }
  }
  state._modMarsSurvival = true;
  log("event", "MARS SURVIVAL: your tribe and four others claim the Red Planet. Earth's history continues without you.");

  if (typeof SOLAR_ORBITS !== "undefined" && typeof _loadPlanetTexture === "function") {
    const obody = SOLAR_ORBITS.find(b => b.name === "Mars");
    if (obody) _loadPlanetTexture(obody);
  }
  const banner = document.getElementById("planet-banner");
  if (banner) {
    banner.textContent = "— MARS —";
    banner.style.display = "";
  }
  const back = document.getElementById("planet-return-btn");
  if (back) back.style.display = "";
}

function applyWW2TribeTerritory() {
  if (typeof HOI4_CITIES === "undefined" || !provinceTile || !provinceGrid) return;
  if (typeof CIV_TAGS === "undefined") return;
  const { roots } = buildCivFamilyTree();
  
  const tagToCivId = {};
  for (const root of roots) {
    
    const rootCiv = state.civs.find(c => c.alive && c.isStartingTribe && c.name === root.name);
    if (!rootCiv) continue;
    
    const queue = [root];
    const visited = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      const ct = CIV_TAGS[node.name];
      if (ct) {
        const base = ct.split("_")[0];
        if (base && base.length === 3 && !tagToCivId[base]) tagToCivId[base] = rootCiv.id;
      }
      for (const ch of node.children || []) queue.push(ch);
    }
  }
  
  const pidToTag = {};
  for (const sd of HOI4_CITIES) {
    if (!sd.owner) continue;
    for (const pid of sd.provinces || []) pidToTag[pid] = sd.owner;
  }
  
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!PASSABLE(MAP[r][c])) continue;
      const px = c * TILE + (TILE >> 1);
      const py = r * TILE + (TILE >> 1);
      const pid = provinceGrid[py * MAP_W + px];
      if (pid === 0) continue;
      const tag = pidToTag[pid];
      if (!tag) continue;
      const cid = tagToCivId[tag];
      if (cid != null) state.ownership[r][c] = cid;
    }
  }
  reassignSettlementsByTileOwner();

  
  
  for (const sd of HOI4_CITIES) {
    if (typeof sd.x !== "number" || typeof sd.y !== "number") continue;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(sd.x / TILE)));
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(sd.y / TILE)));
    if (!PASSABLE(MAP[row][col])) continue;
    const ownerId = state.ownership[row][col];
    if (ownerId < 0) continue;
    const civ = state.civs[civIndexById(ownerId)];
    if (!civ || !civ.alive || !civ.isStartingTribe) continue;
    
    let dup = false;
    for (const s of civ.settlements) {
      if (s.col === col && s.row === row) { dup = true; break; }
    }
    if (dup) continue;
    civ.settlements.push({
      id: nextSettlementId++, col, row,
      name: sd.name || settlementName(civ, civ.settlements.length),
      pop: Math.max(2, Math.min(8, (sd.vp || 1) + 2)),
      food: 0, prod: 0, queue: [], walls: false,
    });
  }
  log("event", "WWII alt-history: every starting tribe inherits its entire descendants' territory + cities at 1000 BC.");
  invalidateTintCache();
}

const _factionBtn = document.getElementById("faction-mode-btn");
if (_factionBtn) {
  _factionBtn.addEventListener("click", () => {
    state.factionMapMode = !state.factionMapMode;
    _factionBtn.classList.toggle("active", state.factionMapMode);
    invalidateTintCache();
    render();
  });
}

const SOLAR_BODIES = [
  { name: "Sun",     color: "#ffd24a", radius: 56, dominator: null,                       isOrbit: false, parent: null   },
  { name: "Mercury", color: "#a89678", radius: 14, dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Venus",   color: "#e8c020", radius: 22, dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Earth",   color: "#3a8a4a", radius: 24, dominator: "<largest>",                isOrbit: true,  parent: "Sun"  },
  { name: "Moon",    color: "#cfcfcf", radius: 10, dominator: "Lunar Republic",           isOrbit: true,  parent: "Earth"},
  { name: "Mars",    color: "#c84a3a", radius: 20, dominator: "Mars Republic",            isOrbit: true,  parent: "Sun"  },
  { name: "Phobos",  color: "#7a5a3a", radius: 6,  dominator: "Mars Republic",            isOrbit: true,  parent: "Mars" },
  { name: "Deimos",  color: "#7a5a3a", radius: 5,  dominator: "Mars Republic",            isOrbit: true,  parent: "Mars" },
  { name: "Asteroid Belt", color: "#a8a8a8", radius: 10, dominator: "Asteroid Belt Coalition", isOrbit: true, parent: "Sun" },
  { name: "Jupiter", color: "#d4b85a", radius: 46, dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Europa",  color: "#cfe4ff", radius: 8,  dominator: null,                       isOrbit: true,  parent: "Jupiter" },
  { name: "Saturn",  color: "#e8c075", radius: 40, dominator: "Saturn Moons Confederation", isOrbit: true, parent: "Sun" },
  { name: "Titan",   color: "#d4a657", radius: 9,  dominator: "Saturn Moons Confederation", isOrbit: true, parent: "Saturn" },
  { name: "Uranus",  color: "#5dc4e8", radius: 30, dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Neptune", color: "#3a6ad8", radius: 30, dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Pluto",   color: "#a89678", radius: 8,  dominator: null,                       isOrbit: true,  parent: "Sun"  },
  { name: "Proxima Centauri b", color: "#7d3ad8", radius: 18, dominator: "Centauri Authority", isOrbit: true, parent: "(deep space)" },
];
function resolveDominator(b) {
  if (b.dominator === "<largest>") {
    let best = null, bestT = -1;
    for (const c of state.civs) {
      if (!c.alive) continue;
      const t = countTiles(c);
      if (t > bestT) { bestT = t; best = c; }
    }
    return best;
  }
  if (!b.dominator) return null;
  return state.civs.find(c => c.alive && (c.name === b.dominator || (c.previousNames || []).includes(b.dominator))) || null;
}
function drawSolarBody(cv, body, scale) {
  const cx = cv.getContext("2d");
  cx.clearRect(0, 0, cv.width, cv.height);
  const cxC = cv.width / 2, cyC = cv.height / 2;
  const r = body.radius * scale;
  const g = cx.createRadialGradient(cxC - r * 0.3, cyC - r * 0.3, r * 0.1, cxC, cyC, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.15, body.color);
  g.addColorStop(1, "#000");
  cx.fillStyle = g;
  cx.beginPath(); cx.arc(cxC, cyC, r, 0, Math.PI * 2); cx.fill();
  if (body.name === "Saturn") {
    cx.strokeStyle = "rgba(255, 220, 150, 0.65)";
    cx.lineWidth = Math.max(1, scale);
    cx.beginPath(); cx.ellipse(cxC, cyC, r * 1.6, r * 0.45, 0, 0, Math.PI * 2); cx.stroke();
  }
}

function makeBodyCard(body, options) {
  options = options || {};
  const dom = resolveDominator(body);
  const card = document.createElement("div");
  card.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;min-width:" + (options.min || 96) + "px;transition:transform 0.3s, opacity 0.3s;";
  const sz = options.canvas || 96;
  const cv = document.createElement("canvas");
  cv.width = sz; cv.height = sz;
  drawSolarBody(cv, body, options.scale || 1);
  card.appendChild(cv);
  const nm = document.createElement("div");
  nm.textContent = body.name;
  nm.style.cssText = "color:#ffd24a;font-size:" + (options.nameSize || 13) + "px;letter-spacing:2px;margin-top:4px;";
  card.appendChild(nm);
  const sub = document.createElement("div");
  sub.textContent = dom ? dom.name : "Uninhabited";
  sub.style.cssText = "color:" + (dom ? "#cfbf95" : "#5a4a32") + ";font-size:" + (options.subSize || 10) + "px;margin-top:2px;text-align:center;max-width:160px;";
  card.appendChild(sub);
  return { card, dom };
}

// Canvas-based orbital solar map. Bodies are drawn at real AU
// distances from the Sun (fixed orbital angles); planet display sizes
// stay constant in screen px so zoom only affects orbit radii. Mouse
// wheel zooms (cursor-anchored), drag pans. Zoom range is huge - far
// enough out to see Proxima Centauri at 268,000 AU.
const SOLAR_ORBITS = [
  { name: "Sun",                color: "#ffd24a", au: 0,        size: 28, angle: 0,    parent: null,     dominator: null,                              texture: "https://www.solarsystemscope.com/images/textures/full/2k_sun.jpg" },
  { name: "Mercury",            color: "#a89678", au: 0.39,     size: 6,  angle: 0.6,  parent: "Sun",    dominator: null,                              texture: "https://www.solarsystemscope.com/images/textures/full/2k_mercury.jpg" },
  { name: "Venus",              color: "#e8c020", au: 0.72,     size: 8,  angle: 1.4,  parent: "Sun",    dominator: "Republic of Venus",               texture: "https://www.solarsystemscope.com/images/textures/full/2k_venus_surface.jpg" },
  { name: "Earth",              color: "#3a8a4a", au: 1.0,      size: 9,  angle: 2.3,  parent: "Sun",    dominator: "<largest>",                       texture: null },
  { name: "Moon",               color: "#cfcfcf", au: 0.0026,   size: 3,  angle: 0.5,  parent: "Earth",  dominator: "Lunar Republic",                  texture: "https://www.solarsystemscope.com/images/textures/full/2k_moon.jpg" },
  { name: "Mars",               color: "#c84a3a", au: 1.52,     size: 7,  angle: 3.1,  parent: "Sun",    dominator: "Mars Republic",                   texture: "https://www.solarsystemscope.com/images/textures/full/2k_mars.jpg" },
  { name: "Phobos",             color: "#7a5a3a", au: 0.00006,  size: 2,  angle: 1.0,  parent: "Mars",   dominator: "Mars Republic",                   texture: "https://upload.wikimedia.org/wikipedia/commons/3/30/Phobos_map_by_Askaniy.png" },
  { name: "Deimos",             color: "#7a5a3a", au: 0.00016,  size: 2,  angle: 4.0,  parent: "Mars",   dominator: "Mars Republic",                   texture: "https://upload.wikimedia.org/wikipedia/commons/7/72/Deimos_map_by_Askaniy.png" },
  { name: "Asteroid Belt",      color: "#a8a8a8", au: 2.7,      size: 4,  angle: 4.0,  parent: "Sun",    dominator: "Asteroid Belt Coalition",         texture: null },
  { name: "Jupiter",            color: "#d4b85a", au: 5.2,      size: 16, angle: 4.7,  parent: "Sun",    dominator: null,                              texture: "https://www.solarsystemscope.com/images/textures/full/2k_jupiter.jpg" },
  { name: "Io",                 color: "#e8c020", au: 0.00282,  size: 3,  angle: 0.7,  parent: "Jupiter", dominator: null,                             texture: null },
  { name: "Europa",             color: "#cfe4ff", au: 0.00448,  size: 3,  angle: 1.2,  parent: "Jupiter", dominator: null,                             texture: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Europa_-_November_25%2C_1999_%2826428520994%29.jpg" },
  { name: "Ganymede",           color: "#a89678", au: 0.00715,  size: 4,  angle: 2.0,  parent: "Jupiter", dominator: null,                             texture: "https://upload.wikimedia.org/wikipedia/commons/8/81/Ganymede_map_by_Askaniy.png" },
  { name: "Callisto",           color: "#7a6a5a", au: 0.01258,  size: 4,  angle: 4.5,  parent: "Jupiter", dominator: null,                             texture: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Callisto_map_by_Askaniy.png" },
  { name: "Saturn",             color: "#e8c075", au: 9.58,     size: 14, angle: 5.4,  parent: "Sun",    dominator: "Saturn Moons Confederation",      texture: "https://www.solarsystemscope.com/images/textures/full/2k_saturn.jpg" },
  { name: "Mimas",              color: "#cfcfcf", au: 0.00124,  size: 2,  angle: 1.5,  parent: "Saturn", dominator: "Saturn Moons Confederation",      texture: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Map_of_Mimas_2010-02_PIA12780.jpg" },
  { name: "Titan",              color: "#d4a657", au: 0.00817,  size: 3,  angle: 2.5,  parent: "Saturn", dominator: "Saturn Moons Confederation",      texture: "https://upload.wikimedia.org/wikipedia/commons/9/91/Titan_-_Map_Projected_-_July_25_2015.png" },
  { name: "Uranus",             color: "#5dc4e8", au: 19.2,     size: 11, angle: 0.3,  parent: "Sun",    dominator: null,                              texture: "https://www.solarsystemscope.com/images/textures/full/2k_uranus.jpg" },
  { name: "Neptune",            color: "#3a6ad8", au: 30.05,    size: 11, angle: 1.0,  parent: "Sun",    dominator: null,                              texture: "https://www.solarsystemscope.com/images/textures/full/2k_neptune.jpg" },
  { name: "Triton",             color: "#cfaf7a", au: 0.00237,  size: 3,  angle: 2.4,  parent: "Neptune", dominator: null,                             texture: "https://upload.wikimedia.org/wikipedia/commons/6/61/Triton_map_no_grid.jpg" },
  { name: "Pluto",              color: "#a89678", au: 39.48,    size: 4,  angle: 2.1,  parent: "Sun",    dominator: null,                              texture: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Pluto_crater_map_Robbins_Dones_2023.png" },
  { name: "Proxima Centauri b", color: "#7d3ad8", au: 268000,   size: 7,  angle: 5.6,  parent: null,     dominator: "Centauri Authority",              texture: null },
];
// Keep SOLAR_BODIES populated from SOLAR_ORBITS so the zoomIntoPlanet
// helper still works (it expects radius + parent fields).
SOLAR_BODIES.length = 0;
for (const o of SOLAR_ORBITS) {
  SOLAR_BODIES.push({ name: o.name, color: o.color, radius: o.size + 6, dominator: o.dominator, isOrbit: !!o.parent, parent: o.parent });
}

const _solarView = { panX: 0, panY: 0, zoom: 30 };   // zoom = px per AU
let _solarRAF = null;

function _solarBodyPos(body) {
  if (body.parent) {
    const parent = SOLAR_ORBITS.find(b => b.name === body.parent);
    if (parent) {
      const pp = _solarBodyPos(parent);
      return {
        x: pp.x + Math.cos(body.angle) * body.au,
        y: pp.y + Math.sin(body.angle) * body.au,
      };
    }
  }
  return {
    x: Math.cos(body.angle) * body.au,
    y: Math.sin(body.angle) * body.au,
  };
}

function renderSolarSystem() {
  const cv = document.getElementById("solar-system-canvas");
  if (!cv || cv.style.display === "none") return;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const cx = cv.getContext("2d");
  cx.clearRect(0, 0, w, h);
  const cxC = w / 2 + _solarView.panX;
  const cyC = h / 2 + _solarView.panY;
  const z = _solarView.zoom;
  // Draw orbital rings.
  for (const body of SOLAR_ORBITS) {
    if (body.au === 0) continue;
    const ringRadius = body.au * z;
    if (ringRadius < 4 || ringRadius > Math.max(w, h) * 50) continue;   // skip absurdly small/large
    const parentPos = body.parent ? _solarBodyPos(SOLAR_ORBITS.find(b => b.name === body.parent)) : { x: 0, y: 0 };
    cx.strokeStyle = "rgba(120, 100, 70, 0.15)";
    cx.lineWidth = 1;
    cx.beginPath();
    cx.arc(cxC + parentPos.x * z, cyC + parentPos.y * z, ringRadius, 0, Math.PI * 2);
    cx.stroke();
  }
  // Draw bodies.
  for (const body of SOLAR_ORBITS) {
    const p = _solarBodyPos(body);
    const sx = cxC + p.x * z, sy = cyC + p.y * z;
    if (sx < -200 || sx > w + 200 || sy < -200 || sy > h + 200) continue;
    // Cull a body whose orbital radius around its parent is smaller
    // than the parent's draw radius - it would just be sitting on top of
    // the parent. Lets moons fade out as you zoom out and prevents
    // cluttered overlap (e.g. Phobos/Deimos disappear unless zoomed in).
    if (body.parent) {
      const parent = SOLAR_ORBITS.find(b => b.name === body.parent);
      if (parent) {
        const orbitPx = body.au * z;
        if (orbitPx < parent.size + 4) continue;
      }
    }
    const r = body.size;
    const g = cx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, r * 0.1, sx, sy, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.2, body.color);
    g.addColorStop(1, "#000");
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(sx, sy, r, 0, Math.PI * 2); cx.fill();
    if (body.name === "Saturn") {
      cx.strokeStyle = "rgba(255, 220, 150, 0.6)";
      cx.lineWidth = 1.5;
      cx.beginPath(); cx.ellipse(sx, sy, r * 1.6, r * 0.45, 0, 0, Math.PI * 2); cx.stroke();
    }
    if (body.au === 0 || r >= 5) {
      cx.fillStyle = "#ffd24a";
      cx.font = (r >= 12 ? "13px" : "11px") + ' Georgia, serif';
      cx.textAlign = "center";
      cx.fillText(body.name, sx, sy + r + 14);
      const dom = resolveDominator(body);
      if (dom) {
        cx.fillStyle = "#cfbf95";
        cx.font = '10px Georgia, serif';
        cx.fillText(dom.name, sx, sy + r + 28);
      }
    }
  }
}

function _solarFrame() {
  renderSolarSystem();
  _solarRAF = null;
}
function _solarRequestRender() {
  if (_solarRAF) return;
  _solarRAF = requestAnimationFrame(_solarFrame);
}
function _solarBodyAtPoint(px, py) {
  const cv = document.getElementById("solar-system-canvas");
  if (!cv) return null;
  const w = cv.clientWidth, h = cv.clientHeight;
  const cxC = w / 2 + _solarView.panX, cyC = h / 2 + _solarView.panY;
  const z = _solarView.zoom;
  let best = null, bestD = 50 * 50;   // generous click radius
  for (const body of SOLAR_ORBITS) {
    const p = _solarBodyPos(body);
    const sx = cxC + p.x * z, sy = cyC + p.y * z;
    const dx = sx - px, dy = sy - py;
    const d = dx * dx + dy * dy;
    const hit = (body.size + 14) * (body.size + 14);
    if (d < hit && d < bestD) {
      bestD = d; best = body;
    }
  }
  return best;
}
(function wireSolarCanvas() {
  const cv = document.getElementById("solar-system-canvas");
  if (!cv) return;
  let dragging = null;
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const rect = cv.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    // Unlimited zoom both ways (clamped to wide finite bounds so we don't
    // hit floating-point precision wall - 10^-15 is sub-millimetre on a
    // light-year scale, 10^15 is a million pixels per AU).
    const newZoom = Math.max(1e-15, Math.min(1e15, _solarView.zoom * factor));
    // Anchor zoom on the mouse cursor.
    const w = cv.clientWidth, h = cv.clientHeight;
    const cxC = w / 2 + _solarView.panX, cyC = h / 2 + _solarView.panY;
    _solarView.panX = mx - w / 2 - (mx - cxC) * (newZoom / _solarView.zoom);
    _solarView.panY = my - h / 2 - (my - cyC) * (newZoom / _solarView.zoom);
    _solarView.zoom = newZoom;
    _solarRequestRender();
  }, { passive: false });
  cv.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    dragging = { x: e.clientX, y: e.clientY, panX: _solarView.panX, panY: _solarView.panY, moved: false };
    cv.style.cursor = "grabbing";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x, dy = e.clientY - dragging.y;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragging.moved = true;
    _solarView.panX = dragging.panX + dx;
    _solarView.panY = dragging.panY + dy;
    _solarRequestRender();
  });
  window.addEventListener("mouseup", (e) => {
    if (!dragging) return;
    if (!dragging.moved) {
      const rect = cv.getBoundingClientRect();
      const body = _solarBodyAtPoint(e.clientX - rect.left, e.clientY - rect.top);
      if (body) _solarFocusBody(body);
    }
    dragging = null;
    cv.style.cursor = "grab";
  });
})();

let _solarFocusedBody = null;
function _solarFocusBody(body) {
  // Smoothly pan + zoom so this body's largest moon orbit fits the
  // viewport. With no moons (e.g. Mercury, Pluto), just zoom in to
  // the body's own size at a reasonable scale.
  const cv = document.getElementById("solar-system-canvas");
  if (!cv) return;
  const w = cv.clientWidth, h = cv.clientHeight;
  const fitPx = Math.min(w, h) * 0.35;
  const moons = SOLAR_ORBITS.filter(b => b.parent === body.name);
  const maxMoonAU = moons.length ? Math.max.apply(null, moons.map(b => b.au)) : 0.0008;
  const targetZoom = Math.max(0.0005, fitPx / Math.max(0.0001, maxMoonAU * 1.4));
  const p = _solarBodyPos(body);
  const targetPanX = -p.x * targetZoom;
  const targetPanY = -p.y * targetZoom;
  _solarAnimateView(targetPanX, targetPanY, targetZoom, 600);
  _solarFocusedBody = body;
  _solarShowDescendOverlay(body);
}

function _solarAnimateView(targetPanX, targetPanY, targetZoom, duration) {
  const startPanX = _solarView.panX;
  const startPanY = _solarView.panY;
  const startZoom = _solarView.zoom;
  const t0 = performance.now();
  function step() {
    const elapsed = performance.now() - t0;
    const t = Math.min(1, elapsed / duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    _solarView.panX = startPanX + (targetPanX - startPanX) * ease;
    _solarView.panY = startPanY + (targetPanY - startPanY) * ease;
    _solarView.zoom = Math.exp(Math.log(startZoom) + (Math.log(targetZoom) - Math.log(startZoom)) * ease);
    renderSolarSystem();
    if (t < 1) requestAnimationFrame(step);
  }
  step();
}

function _solarHideDescendOverlay() {
  const old = document.getElementById("solar-descend-overlay");
  if (old) old.remove();
}

function _solarShowDescendOverlay(body) {
  _solarHideDescendOverlay();
  const dom = resolveDominator(body);
  const modal = document.getElementById("solar-system-modal");
  if (!modal) return;
  const overlay = document.createElement("div");
  overlay.id = "solar-descend-overlay";
  overlay.style.cssText = "position:absolute;bottom:60px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:8px;z-index:560;";
  const title = document.createElement("div");
  title.textContent = body.name.toUpperCase();
  title.style.cssText = "color:#ffd24a;font-family:Georgia,serif;font-size:22px;letter-spacing:6px;";
  overlay.appendChild(title);
  if (dom) {
    const sub = document.createElement("div");
    sub.textContent = dom.name;
    sub.style.cssText = "color:#cfbf95;font-size:13px;";
    overlay.appendChild(sub);
  }
  const row = document.createElement("div");
  row.style.cssText = "display:flex;gap:10px;margin-top:6px;";
  if (body.name !== "Sun" && body.name !== "Asteroid Belt") {
    const descend = document.createElement("button");
    descend.textContent = "↓ DESCEND TO SURFACE";
    descend.style.cssText = "background:linear-gradient(180deg,#a8923a,#624a14);border:1px solid #ffd24a;color:#fff5cc;padding:8px 18px;letter-spacing:2px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;";
    descend.addEventListener("click", () => {
      _solarHideDescendOverlay();
      enterPlanetSurface(body.name);
    });
    row.appendChild(descend);
  }
  if (dom) {
    const visit = document.createElement("button");
    visit.textContent = "👁 VIEW " + dom.name.toUpperCase();
    visit.style.cssText = "background:#3a2a14;border:1px solid #6a5a3c;color:#fff5cc;padding:8px 14px;letter-spacing:2px;font-family:Georgia,serif;cursor:pointer;";
    visit.addEventListener("click", () => {
      _solarHideDescendOverlay();
      modal.style.display = "none";
      showCountryPanel(dom);
    });
    row.appendChild(visit);
  }
  overlay.appendChild(row);
  modal.appendChild(overlay);
}

function openSolarSystem() {
  const modal = document.getElementById("solar-system-modal");
  if (!modal) return;
  modal.style.display = "block";
  document.getElementById("solar-system-year").textContent = yearLabel(Math.floor(state.year));
  document.getElementById("solar-system-bodies").style.display = "none";
  const cv = document.getElementById("solar-system-canvas");
  if (cv) cv.style.display = "block";
  _solarHideDescendOverlay();
  _solarFocusedBody = null;
  _solarView.panX = 0; _solarView.panY = 0; _solarView.zoom = 50;
  _solarRequestRender();
}

function zoomIntoPlanet(bodyName) {
  const modal = document.getElementById("solar-system-modal");
  const container = document.getElementById("solar-system-bodies");
  if (!container) return;
  // Switch from canvas view to the zoomed-in card view.
  const cv = document.getElementById("solar-system-canvas");
  if (cv) cv.style.display = "none";
  container.style.display = "flex";
  container.style.flexWrap = "wrap";
  container.style.justifyContent = "center";
  container.style.alignItems = "center";
  container.style.gap = "18px 32px";
  container.style.padding = "0 30px 60px";
  container.style.transition = "opacity 0.4s";
  container.style.opacity = "0";
  setTimeout(() => {
    container.innerHTML = "";
    const body = SOLAR_BODIES.find(b => b.name === bodyName);
    if (!body) { openSolarSystem(); return; }
    // Layout: back button row, big planet, moon row, dominator panel.
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;width:100%;gap:18px;";
    const back = document.createElement("button");
    back.textContent = "← BACK TO SOLAR SYSTEM";
    back.style.cssText = "background:#3a2a14;border:1px solid #6a5a3c;color:#fff5cc;padding:6px 16px;cursor:pointer;letter-spacing:2px;font-family:Georgia,serif;align-self:flex-start;margin-left:30px;";
    back.addEventListener("click", openSolarSystem);
    wrap.appendChild(back);
    // Big planet, scaled up 4x with click-to-surface stub.
    const big = makeBodyCard(body, { canvas: 320, scale: 5, nameSize: 24, subSize: 13, min: 320 });
    big.card.style.cursor = "pointer";
    big.card.addEventListener("click", () => {
      enterPlanetSurface(body.name);
    });
    wrap.appendChild(big.card);
    // Explicit Descend button so the click target isn't ambiguous.
    const descend = document.createElement("button");
    descend.textContent = "↓ DESCEND TO SURFACE";
    descend.style.cssText = "background:linear-gradient(180deg,#a8923a,#624a14);border:1px solid #ffd24a;color:#fff5cc;padding:8px 22px;letter-spacing:3px;font-family:Georgia,serif;cursor:pointer;font-weight:bold;";
    descend.addEventListener("click", (e) => {
      e.stopPropagation();
      enterPlanetSurface(body.name);
    });
    wrap.appendChild(descend);
    // Moons of this body (children where parent === bodyName).
    const moons = SOLAR_BODIES.filter(b => b.parent === bodyName);
    if (moons.length > 0) {
      const moonRow = document.createElement("div");
      moonRow.style.cssText = "display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-top:8px;";
      const lbl = document.createElement("div");
      lbl.textContent = "MOONS";
      lbl.style.cssText = "width:100%;text-align:center;color:#a89678;font-size:11px;letter-spacing:3px;margin-bottom:6px;";
      moonRow.appendChild(lbl);
      for (const moon of moons) {
        const mc = makeBodyCard(moon, { canvas: 110, scale: 1.4 });
        mc.card.addEventListener("click", () => zoomIntoPlanet(moon.name));
        moonRow.appendChild(mc.card);
      }
      wrap.appendChild(moonRow);
    }
    // Parent body link (if this is a moon).
    if (body.parent && body.parent !== "Sun" && body.parent !== "(deep space)") {
      const pwrap = document.createElement("div");
      pwrap.style.cssText = "color:#a89678;font-size:11px;margin-top:6px;";
      pwrap.textContent = "Orbiting ";
      const plink = document.createElement("a");
      plink.textContent = body.parent;
      plink.style.cssText = "color:#ffd24a;cursor:pointer;text-decoration:underline;";
      plink.addEventListener("click", () => zoomIntoPlanet(body.parent));
      pwrap.appendChild(plink);
      wrap.appendChild(pwrap);
    }
    // Surface-view hint.
    const hint = document.createElement("div");
    hint.textContent = "Click the planet to descend to its surface (placeholder for now).";
    hint.style.cssText = "color:#5a4a32;font-size:11px;margin-top:8px;";
    wrap.appendChild(hint);
    container.appendChild(wrap);
    container.style.opacity = "1";
  }, 380);
}
// Reuses the Earth province grid as the planet's terrain, but treats
// every tile as land (PASSABLE override) and skips state borders. Each
// planet has its own ownership grid so claims don't bleed between
// worlds. The dominator civ from SOLAR_BODIES gets all tiles by default.
// Which civs live on each planet. Each entry is a list of civ names
// (current OR any previousName). Resolved at descend-time so the
// players see whichever civs are alive THEN. If multiple civs share
// the same planet, the surface is split into vertical bands between
// them (so e.g. Mars Republic + Mars Colony Authority each get a
// chunk of Mars).
const PLANET_RESIDENTS = {
  "Mercury": ["Mercury Solar Authority"],
  "Venus":   ["Republic of Venus", "Venus Sky-Cities"],
  "Moon":    ["Lunar Republic", "L5 Habitat League"],
  "Mars":    ["Mars Republic", "Mars Colony Authority"],
  "Phobos":  ["Mars Republic", "Phobos Mining Guild"],
  "Deimos":  ["Mars Republic", "Deimos Watchtower"],
  "Asteroid Belt": ["Belt Hollow Republic", "Asteroid Belt Coalition", "Ceres Free Port", "Jovian Trojans Authority"],
  "Jupiter": [],
  "Io":      ["Io Volcanic League"],
  "Europa":  ["Saturn Moons Confederation", "Europan Order"],
  "Ganymede":["Ganymede Free State"],
  "Callisto":["Callisto Settlement"],
  "Saturn":  ["Saturn Moons Confederation"],
  "Mimas":   ["Mimas Cold Republic"],
  "Titan":   ["Saturn Moons Confederation", "Titan Methanate Republic"],
  "Uranus":  ["Uranus Tilt League"],
  "Neptune": ["Neptune Storm Council"],
  "Triton":  ["Triton Cooperative"],
  "Pluto":   ["Pluto-Charon Republic", "Oort Survey Charter"],
  "Proxima Centauri b": ["Centauri Authority", "Alpha Centauri Settlement Bureau"],
};

function rebuildPlanetOwnership(bodyName) {
  const grid = Array.from({ length: ROWS }, () => new Array(COLS).fill(-1));
  const residentNames = PLANET_RESIDENTS[bodyName] || [];
  const seen = new Set();
  const residents = [];
  for (const nm of residentNames) {
    const c = state.civs.find(c => c.alive && (c.name === nm || (c.previousNames || []).includes(nm)));
    if (c && !seen.has(c.id)) { residents.push(c); seen.add(c.id); }
  }
  if (residents.length === 0) {
    const obody = SOLAR_ORBITS.find(b => b.name === bodyName);
    const dom = obody ? resolveDominator(obody) : null;
    if (dom && !seen.has(dom.id)) residents.push(dom);
  }
  if (residents.length === 0) return grid;
  // Each resident starts from a single seed tile and flood-fills outward
  // up to a budget that scales with how many years they've existed
  // (~1 tile per 5 years). So a freshly-founded colony has 1-2 tiles
  // and a 1000-year-old civ has ~200 tiles - they "expand from 1 tile"
  // rather than auto-claiming the entire surface.
  const seeds = [];
  for (let i = 0; i < residents.length; i++) {
    const seedCol = Math.floor((i + 0.5) / residents.length * COLS);
    const seedRow = Math.floor(ROWS * 0.55);
    seeds.push({ col: seedCol, row: seedRow, civ: residents[i] });
  }
  for (const seed of seeds) {
    const lifespan = Math.max(0, state.year - (seed.civ.foundedYear || state.year));
    const want = Math.max(1, Math.min(8000, Math.floor(lifespan / 5)));
    const queue = [[seed.col, seed.row]];
    const visited = new Set();
    visited.add(seed.row * COLS + seed.col);
    let claimed = 0;
    while (queue.length && claimed < want) {
      const [c, r] = queue.shift();
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (grid[r][c] !== -1) continue;
      grid[r][c] = seed.civ.id;
      claimed++;
      for (const [nc, nr] of neighbors(c, r)) {
        const k = nr * COLS + nc;
        if (!visited.has(k)) { visited.add(k); queue.push([nc, nr]); }
      }
    }
    // Plant a capital city + starting garrison at the seed so the
    // resident has somewhere to build from.
    if (claimed > 0) {
      ensurePlanetSettlement(seed.civ, seed.col, seed.row, bodyName);
      const hasArmy = (seed.civ.armies || []).some(a => a.col === seed.col && a.row === seed.row && (a.planet || "Earth") === bodyName);
      if (!hasArmy) {
        seed.civ.armies.push({
          id: nextArmyId++, col: seed.col, row: seed.row,
          type: "modern", count: 3, civId: seed.civ.id, moves: 1, planet: bodyName,
        });
      }
    }
  }
  return grid;
}

const _planetTextureCache = {};
function _loadPlanetTexture(body) {
  if (!body || !body.texture) return;
  if (_planetTextureCache[body.name]) return;
  // No crossOrigin - solarsystemscope.com doesn't serve CORS headers,
  // and we don't need to read pixel data from the texture (we just
  // drawImage it onto the main canvas), so a tainted texture is fine.
  const img = new Image();
  img.onload = () => { invalidateTintCache(); render(); };
  img.onerror = () => { delete _planetTextureCache[body.name]; };
  img.src = body.texture;
  _planetTextureCache[body.name] = img;
}

function _showDescendingOverlay(bodyName) {
  const ov = document.getElementById("planet-descend-overlay");
  const t = document.getElementById("planet-descend-title");
  const s = document.getElementById("planet-descend-sub");
  if (!ov) return;
  if (t) t.textContent = "— DESCENDING TO " + bodyName.toUpperCase() + " —";
  if (s) s.textContent = "Loading surface projection…";
  ov.style.display = "flex";
}
function _hideDescendingOverlay() {
  const ov = document.getElementById("planet-descend-overlay");
  if (ov) ov.style.display = "none";
}

function enterPlanetSurface(bodyName) {
  if (!bodyName) return;
  if (bodyName === "Earth") {
    const modal = document.getElementById("solar-system-modal");
    if (modal) modal.style.display = "none";
    _solarHideDescendOverlay();
    if (!state.currentPlanet || state.currentPlanet === "Earth") return;
    _showDescendingOverlay("Earth");
    if (state.planetOwnership) state.planetOwnership[state.currentPlanet] = state.ownership;
    if (state._earthOwnership) {
      state.ownership = state._earthOwnership;
    } else if (state.planetOwnership && state.planetOwnership["Earth"]) {
      state.ownership = state.planetOwnership["Earth"];
    }
    state._earthOwnership = null;
    state.currentPlanet = "Earth";
    if (state._earthSpeed != null) {
      state.speed = state._earthSpeed;
      state._earthSpeed = null;
    }
    const banner = document.getElementById("planet-banner");
    if (banner) banner.style.display = "none";
    const back = document.getElementById("planet-return-btn");
    if (back) back.style.display = "none";
    invalidateTintCache();
    render();
    setTimeout(_hideDescendingOverlay, 600);
    return;
  }
  if (state.currentPlanet && state.currentPlanet !== "Earth") {
    exitPlanetSurface();
  }
  // Show the descending overlay so the player has something to look at
  // while the surface projection loads.
  _showDescendingOverlay(bodyName);
  // Kick off texture load if available.
  const obody = SOLAR_ORBITS.find(b => b.name === bodyName);
  if (obody) _loadPlanetTexture(obody);
  // Save Earth state.
  state._earthSpeed = state.speed;
  state.speed = 0;
  state._earthOwnership = state.ownership;
  // Rebuild this planet's ownership EVERY entry so the civs you see
  // are whichever resident civs are currently alive (Mars Republic
  // doesn't appear before 2350; Republic of Venus doesn't appear
  // before 3080; etc).
  if (!state.planetOwnership) state.planetOwnership = {};
  if (!state.planetOwnership[bodyName]) {
    state.planetOwnership[bodyName] = rebuildPlanetOwnership(bodyName);
  }
  state.ownership = state.planetOwnership[bodyName];
  state.currentPlanet = bodyName;
  // Hide solar-system modal, show return banner.
  const modal = document.getElementById("solar-system-modal");
  if (modal) modal.style.display = "none";
  const banner = document.getElementById("planet-banner");
  if (banner) {
    banner.textContent = "— " + bodyName.toUpperCase() + " —";
    banner.style.display = "";
  }
  const back = document.getElementById("planet-return-btn");
  if (back) back.style.display = "";
  invalidateTintCache();
  render();
  // Hide descending overlay once the texture is ready (or immediately
  // after a short delay if there's no texture for this body).
  const tex = obody && obody.texture ? _planetTextureCache[bodyName] : null;
  if (tex && !tex.complete) {
    const onDone = () => { _hideDescendingOverlay(); render(); };
    tex.addEventListener("load", onDone, { once: true });
    tex.addEventListener("error", onDone, { once: true });
    // Safety timeout - hide after 12s even if image is slow.
    setTimeout(_hideDescendingOverlay, 12000);
  } else {
    setTimeout(_hideDescendingOverlay, 600);
  }
}
function exitPlanetSurface() {
  if (!state.currentPlanet || state.currentPlanet === "Earth") return;
  state.planetOwnership[state.currentPlanet] = state.ownership;
  state.ownership = state._earthOwnership;
  state._earthOwnership = null;
  state.currentPlanet = "Earth";
  if (state._earthSpeed != null) {
    state.speed = state._earthSpeed;
    state._earthSpeed = null;
  }
  document.getElementById("planet-banner").style.display = "none";
  document.getElementById("planet-return-btn").style.display = "none";
  invalidateTintCache();
  render();
}
const _planetReturnBtn = document.getElementById("planet-return-btn");
if (_planetReturnBtn) _planetReturnBtn.addEventListener("click", exitPlanetSurface);

const _solarBtn = document.getElementById("solar-system-btn");
if (_solarBtn) _solarBtn.addEventListener("click", openSolarSystem);
const _solarClose = document.getElementById("solar-system-close");
if (_solarClose) _solarClose.addEventListener("click", () => {
  document.getElementById("solar-system-modal").style.display = "none";
});

const _frontlineDrawBtn = document.getElementById("frontline-draw-btn");
const _frontlineClearBtn = document.getElementById("frontline-clear-btn");
const _frontlinePushBtn = document.getElementById("frontline-push-btn");
const _frontlineHint = document.getElementById("frontline-hint");
function setFrontlineSelecting(on) {
  state.frontlineSelecting = !!on;
  if (_frontlineDrawBtn) _frontlineDrawBtn.classList.toggle("active", state.frontlineSelecting);
  if (_frontlineHint) _frontlineHint.style.display = state.frontlineSelecting ? "" : "none";
  if (canvas) canvas.style.cursor = state.frontlineSelecting ? "crosshair" : "";
}
if (_frontlineDrawBtn) {
  _frontlineDrawBtn.addEventListener("click", () => {
    setFrontlineSelecting(!state.frontlineSelecting);
    render();
  });
}
if (_frontlineClearBtn) {
  _frontlineClearBtn.addEventListener("click", () => {
    if (!state.frontlineEnemies) state.frontlineEnemies = new Set();
    state.frontlineEnemies.clear();
    state.frontlinePush = false;
    if (_frontlinePushBtn) _frontlinePushBtn.classList.remove("active");
    setFrontlineSelecting(false);
    log("event", "Front line cleared.");
    render();
  });
}
if (_frontlinePushBtn) {
  _frontlinePushBtn.addEventListener("click", () => {
    state.frontlinePush = !state.frontlinePush;
    _frontlinePushBtn.classList.toggle("active", state.frontlinePush);
    log(state.frontlinePush ? "war" : "event",
      state.frontlinePush ? "PUSH ATTACK ordered - front-line units advance into enemy territory." : "Front-line units hold the line.");
    render();
  });
}

function isWarModeModalOpen() {
  const m = document.getElementById("warmode-modal");
  return !!(m && m.style.display === "flex");
}

function setSpeed(s) {
  if (isWarModeModalOpen()) return;   
  state.speed = s;
  state.lastTickAt = performance.now();
  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.speed, 10) === s);
  });
}

document.addEventListener("keydown", (e) => {
  
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  if (isWarModeModalOpen()) { e.preventDefault(); return; }
  if (e.key === " ") {
    e.preventDefault();
    
    if (state.moveMode) {
      state.moveMode = null;
      document.getElementById("move-mode-banner").style.display = "none";
      render();
      return;
    }
    
    const player = state.civs[0];
    if (state.selectedTile && player && player.isPlayer) {
      const { col, row } = state.selectedTile;
      const hasArmy = player.armies.some(a => a.col === col && a.row === row);
      if (hasArmy) {
        state.selectedTile = null;
        state.selectedProvince = 0;
        state.selectedState = 0;
        hideCountryPanel();
        render();
        updateUI();
        return;
      }
    }
    
    if (state.phase !== "playing") return;
    if (state.speed === 0) setSpeed(state._lastActiveSpeed || 2);
    else { state._lastActiveSpeed = state.speed; setSpeed(0); }
  }
  if (e.key >= "1" && e.key <= "5") {
    if (state.phase === "playing") setSpeed(parseInt(e.key, 10));
  }
  if (e.key === "Escape") {
    state.moveMode = null;
    document.getElementById("move-mode-banner").style.display = "none";
    if (state.frontlineSelecting) setFrontlineSelecting(false);
    render();
  }
  
  if (e.key === "+" || e.key === "=") {
    view.zoom = Math.min(10, view.zoom * 1.25);
    render();
  }
  if (e.key === "-" || e.key === "_") {
    const minZoom = Math.min(canvas.width / MAP_W, canvas.height / MAP_H) * 0.6;
    view.zoom = Math.max(minZoom, view.zoom / 1.25);
    render();
  }
  if (e.key === "0") {
    fitToView();
    render();
  }
  
  const arrowDir = (
    e.key === "ArrowLeft"  ? [-1, 0] :
    e.key === "ArrowRight" ? [ 1, 0] :
    e.key === "ArrowUp"    ? [ 0,-1] :
    e.key === "ArrowDown"  ? [ 0, 1] : null
  );
  if (arrowDir) {
    if (state.phase === "playing") {
      const player = state.civs[0];
      if (player && player.isPlayer) {

        let army = null;
        if (state._activeArmyId != null) {
          army = player.armies.find(a => a.id === state._activeArmyId && a.moves > 0);
        }
        if (!army && state.selectedTile) {
          const { col, row } = state.selectedTile;
          army = player.armies.find(a => a.col === col && a.row === row && a.moves > 0);
        }
        if (army) {
          const [dc, dr] = arrowDir;
          const newCol = ((army.col + dc) % COLS + COLS) % COLS;
          const newRow = army.row + dr;
          if (newRow >= 0 && newRow < ROWS) {
            tryMoveOrAttack(army, newCol, newRow);
            state.selectedTile = { col: army.col, row: army.row };
            invalidateTintCache();
            render();
            updateUI();
          }
        }
      }
    }
    e.preventDefault();
    return;   
  }
  
  const panStep = 80;
  if (e.key.toLowerCase() === "a") { view.panX += panStep; render(); }
  if (e.key.toLowerCase() === "d") { view.panX -= panStep; render(); }
  if (e.key.toLowerCase() === "w") { view.panY += panStep; render(); }
  if (e.key.toLowerCase() === "s") { view.panY -= panStep; render(); }
});

window.addEventListener("resize", () => {
  setupCanvas();
  render();
});

let lastFrame = performance.now();
function gameLoop(now) {
  const speed = state.speed;
  if (state.phase === "playing" && speed > 0) {

    const ms = SPEED_TURN_MS[speed];
    while (now - state.lastTickAt >= ms) {
      state.lastTickAt += ms;
      try {
        tick();
      } catch (e) {
        
        console.error("tick failed at year", state.year, e);
      }
      
      if (now - state.lastTickAt > ms * 5) {
        state.lastTickAt = now;
        break;
      }
    }
  } else {
    state.lastTickAt = now;
  }

  const fraction = (state.phase === "playing" && speed > 0)
    ? Math.min(1, (now - state.lastTickAt) / SPEED_TURN_MS[speed])
    : 0;
  const displayYear = state.year + fraction * currentYearsPerTurn();
  const yearEl = document.getElementById("year-display");
  if (yearEl) {
    if (state.warMode) {

      
      const yi = Math.floor(displayYear);
      const dayFrac = (displayYear - yi) * 365;
      const dayOfYear = Math.max(1, Math.min(365, Math.floor(dayFrac) + 1));
      const hour = Math.floor((dayFrac - Math.floor(dayFrac)) * 24);
      const hourStr = hour < 10 ? "0" + hour : "" + hour;
      yearEl.textContent = yearLabel(yi) + " · day " + dayOfYear + " · " + hourStr + "h";
    } else {
      yearEl.textContent = yearLabel(Math.floor(displayYear));
    }
  }

  
  
  if (state.phase === "playing" && speed > 0) {
    let animating = false;
    const tickMs = SPEED_TURN_MS[speed];
    for (const civ of state.civs) {
      if (!civ.alive) continue;
      for (const a of civ.armies) {
        if (a.moveStartedAt && (now - a.moveStartedAt) < tickMs) { animating = true; break; }
      }
      if (animating) break;
    }
    if (animating) render();
  }

  lastFrame = now;
  requestAnimationFrame(gameLoop);
}

const LEADERS = {
  "Egypt": [
    { from: -1000, to: -664, name: "Pharaohs of the 21st–25th dynasties" },
    { from:  -664, to: -525, name: "Psamtik I (26th dynasty)" },
    { from:  -525, to: -332, name: "Persian governors / late pharaohs" },
    { from:  -332, to:  -30, name: "Ptolemaic dynasty (Cleopatra etc.)" },
  ],
  "Rome": [
    { from: -753, to: -509, name: "Romulus & the Seven Kings" },
    { from: -509, to:  -27, name: "Senate of the Republic" },
    { from:  -27, to:   14, name: "Augustus", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Statue-Augustus.jpg/200px-Statue-Augustus.jpg" },
    { from:   14, to:  117, name: "Julio-Claudian & Flavian emperors" },
    { from:  117, to:  286, name: "The Five Good Emperors and after" },
  ],
  "Western Rome": [
    { from:  286, to:  476, name: "Western Roman emperors" },
  ],
  "Byzantium": [
    { from:  330, to:  527, name: "Constantine and successors" },
    { from:  527, to:  565, name: "Justinian I" },
    { from:  565, to: 1453, name: "Emperors of Constantinople" },
  ],
  "Persia": [
    { from: -550, to: -530, name: "Cyrus the Great" },
    { from: -530, to: -486, name: "Darius I and Xerxes I" },
    { from: -486, to: -330, name: "Achaemenid Shahs" },
  ],
  "Sasanians": [
    { from:  220, to:  651, name: "Sasanian Shahanshahs" },
  ],
  "Macedon": [
    { from: -359, to: -336, name: "Philip II of Macedon" },
    { from: -336, to: -323, name: "Alexander the Great" },
    { from: -323, to: -146, name: "Diadochi successors" },
  ],
  "Han China": [
    { from: -202, to: -141, name: "Liu Bang & early Han emperors" },
    { from: -141, to:  -87, name: "Emperor Wu of Han" },
    { from:  -87, to:  220, name: "Han emperors" },
  ],
  "Mongols": [
    { from: 1206, to: 1227, name: "Genghis Khan", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/YuanEmperorAlbumGenghisPortrait.jpg/200px-YuanEmperorAlbumGenghisPortrait.jpg" },
    { from: 1227, to: 1241, name: "Ögedei Khan" },
    { from: 1260, to: 1294, name: "Kublai Khan" },
  ],
  "Ottomans": [
    { from: 1299, to: 1326, name: "Osman I" },
    { from: 1444, to: 1481, name: "Mehmed II the Conqueror" },
    { from: 1520, to: 1566, name: "Suleiman the Magnificent" },
  ],
  "Duchy of Poland": [
    { from:  966, to:  992, name: "Mieszko I", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Jan_Matejko%2C_Mieszko_I.jpg/200px-Jan_Matejko%2C_Mieszko_I.jpg" },
    { from:  992, to: 1025, name: "Bolesław the Brave" },
  ],
  "Kingdom of Poland": [
    { from: 1025, to: 1138, name: "Piast kings" },
    { from: 1320, to: 1370, name: "Władysław the Elbow-high & Casimir III" },
    { from: 1386, to: 1434, name: "Władysław II Jagiełło" },
  ],
  "Grand Duchy of Lithuania": [
    { from: 1253, to: 1263, name: "Mindaugas",         img: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Mindaugas_painting.jpg/200px-Mindaugas_painting.jpg" },
    { from: 1316, to: 1341, name: "Gediminas" },
    { from: 1400, to: 1434, name: "Vytautas the Great", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Witold_Wielki.jpg/200px-Witold_Wielki.jpg" },
  ],
  "Polish-Lithuanian Commonwealth": [
    { from: 1569, to: 1572, name: "Sigismund II Augustus" },
    { from: 1576, to: 1586, name: "Stefan Batory" },
    { from: 1587, to: 1632, name: "Sigismund III Vasa" },
    { from: 1674, to: 1696, name: "Jan III Sobieski" },
  ],
  "Franks": [
    { from:  800, to:  814, name: "Charlemagne", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Albrecht_D%C3%BCrer_-_Portrait_of_Charlemagne_-_WGA07016.jpg/200px-Albrecht_D%C3%BCrer_-_Portrait_of_Charlemagne_-_WGA07016.jpg" },
    { from:  814, to:  840, name: "Louis the Pious" },
    { from:  843, to:  987, name: "Carolingian rulers" },
  ],
  "France": [
    { from: 1804, to: 1814, name: "Napoleon Bonaparte", img: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg/200px-Jacques-Louis_David_-_The_Emperor_Napoleon_in_His_Study_at_the_Tuileries_-_Google_Art_Project.jpg" },
    { from: 1815, to: 1900, name: "Restoration & Republic" },
  ],
  "Russian Empire": [
    { from: 1721, to: 1725, name: "Peter the Great" },
    { from: 1762, to: 1796, name: "Catherine the Great" },
  ],
  "Soviet Union": [
    { from: 1922, to: 1924, name: "Vladimir Lenin" },
    { from: 1924, to: 1953, name: "Joseph Stalin" },
  ],
  "USA": [
    { from: 1789, to: 1797, name: "George Washington" },
    { from: 1861, to: 1865, name: "Abraham Lincoln" },
  ],
};

const CIV_TAGS = {
  "Egypt": "EGY",
  "Kush": "EGY",

  
  
  "Rome": "SPQR_UNIFIED_neutrality",
  "Western Rome": "SPQR_UNIFIED_neutrality",
  "Romano-Goths": "GER_kingdom_of_italy_neutrality",
  "Byzantium": "BYZ_UNIFIED_neutrality",
  "Fallen Byzantium": "BYZ_UNIFIED_fascism",
  "Italy": "ITA",
  "Macedon": "GRE_GREATER_GREECE_neutrality",
  "Carthage": "TUN",

  "Franks": "FRA",
  "France": "FRA_THIRD_EMPIRE_neutrality",
  "Germany": "GER_german_kaiserreich_neutrality",   
  
  "Duchy of Poland": "POL_KINGDOM_RUS",                          
  "Kingdom of Poland": "POL_KINGDOM_neutrality",                 
  "Polish-Lithuanian Commonwealth": "PLC_UNIFIED_neutrality",    
  "Republic of Poland": "POL",                                   
  "Partitioned Poland": "POL_PEASANT_democratic",                
  
  "Grand Duchy of Lithuania": "GREATER_LIT_neutrality",          
  "Republic of Lithuania": "LIT",                                
  "Republic of Latvia": "LAT",                                   
  "Republic of Estonia": "EST",                                  
  "Livonian Order": "LAT",
  "Duchy of Courland": "LAT",

  "Tsardom of Russia": "SOV_democratic",
  "Russian Empire": "SOV_fascism",
  "Soviet Union": "SOV_communism",   
  "Russia": "SOV_democratic",                   
  "Bohemia": "CZE",
  "Vikings": "NOR",
  "Thracians": "ROM",
  "Scythians": "UKR",
  "Lydia": "TUR",
  "Ottomans": "TUR",
  "Mongols": "MON",
  "Medes": "PER",
  "Persia": "PER_persian_empire_neutrality",
  "Sasanians": "PER_great_persian_empire_neutrality",
  "Arabs": "SAU",
  "Vedic India": "RAJ",
  "Maurya": "RAJ",
  "Dravidians": "RAJ",
  "Zhou China": "CHI",
  "Han China": "HAN_neutrality",
  "Gojoseon": "KOR",
  "Yamato": "JAP_tokugawa_restored_neutrality",      
  "Olmec": "MEX",
  "Aztec": "MEX",
  "Maya": "MEX",
  
  "Ptolemaic Egypt": "EGY",
  "Seleucid Empire": "PER_persian_empire_neutrality",
  "Antigonid Macedon": "GRE_GREATER_GREECE_neutrality",
  "Parthia": "PER",
  
  "Cao Wei": "CHI",
  "Eastern Wu": "CHI",
  "Shu Han": "CHI",
  
  "Holy Roman Empire": "HRE_UNIFIED_neutrality",
  "Kingdom of Jerusalem": "ISR",
  "Mali Empire": "MAL",
  "Golden Horde": "MON",
  "Yuan China": "CHI_great_yuan_neutrality",
  "Ming China": "CHI",
  "Qing China": "CHI",
  "Republic of China": "CHI",
  "People's Republic of China": "PRC",
  "Ilkhanate": "PER",
  "Mughal Empire": "RAJ_mughal_empire_neutrality",
  "Dutch Republic": "HOL",
  "Kingdom of Prussia": "PRE",
  "Kingdom of Castile": "SPR",
  "Kingdom of Spain": "SPR",
  "Kingdom of Portugal": "POR",
  
  "Spanish Nationalists": "SPR_fascism",
  "Francoist Spain": "SPR_fascism",
  "Lombards": "ITA",

  "Papal States": "PAP",

  

  "Bavaria": "BAY",
  "Saxony": "SAX",
  "Brandenburg": "BRA",
  "Württemberg": "WUR",
  "Hannover": "HAN",
  
  "Vikings": "NOR_neutrality_nordic_king_flag",
  "Kalmar Union": "DEN_greater_denmark_neutrality",
  "Denmark-Norway": "DEN",
  "Denmark": "DEN",
  "Sweden": "SWE",
  "Norway": "NOR",
  "Finland": "FIN",
  
  "Mexico": "MEX",
  "Brazil": "BRA",
  "Argentina": "ARG",
  "Chile": "CHL",
  "Colombia": "COL",
  "Venezuela": "VEN",
  "Peru": "PRU",
  "Bolivia": "BOL",
  "Paraguay": "PAR",
  "Uruguay": "URG",
  "Ecuador": "ECU",
  "Canada": "CAN",
  "Haiti": "HAI",
  "Dominican Republic": "DOM",
  "Cuba": "CUB",
  "Jamaica": "JAM",
  "Belize": "BLZ",
  "Panama": "PAN",
  "Guatemala": "GUA",
  "Honduras": "HON",
  "Nicaragua": "NIC",
  "Costa Rica": "COS",
  "El Salvador": "ELS",
  "Greece": "GRE",
  "Belgium": "BEL",
  "Austria-Hungary": "AUS",
  "Austria": "AUS",
  "Hungary": "HUN",
  "Czechoslovakia": "CZE",
  "Yugoslavia": "YUG",
  "Serbia": "SER",
  "Romania": "ROM",
  "Bulgaria": "BUL",
  "Turkey": "TUR",
  "Saudi Arabia": "SAU",
  "Kingdom of Saudi Arabia": "SAU",
  "British Mandate of Iraq": "IRQ",
  "Kingdom of Iraq": "IRQ",
  "French Mandate of Syria": "SYR",
  "Syria": "SYR",
  
  "West Germany": "GER",
  "East Germany": "DDR",
  
  "Libya": "LIB",
  "Morocco": "MOR",
  "Tunisia": "TUN",
  "Sudan": "SUD",
  "Congo": "COG",
  "Senegal": "SEN",
  "Mali": "MLI",
  "Cameroon": "CMR",
  "Madagascar": "MAD",
  "Ivory Coast": "IVO",
  "Tanzania": "TAN",
  "Uganda": "UGA",
  "Rwanda": "RWA",
  "Zambia": "ZAM",
  "Angola": "ANG",
  "Mozambique": "MZB",
  "Zimbabwe": "ZIM",
  "Namibia": "NMB",
  "South Africa": "SAF",
  "Australia": "AST",
  "New Zealand": "NZL",
  "Papua New Guinea": "PNG",
  "Croatia": "CRO",
  "Slovenia": "SLO",
  "Bosnia": "BOS",
  "Slovakia": "SLO",          
  "Czech Republic": "CZE",
  
  "Kazakhstan": "KAZ",
  "Uzbekistan": "UZB",
  "Turkmenistan": "TKM",
  "Kyrgyzstan": "KGZ",
  "Tajikistan": "TJK",
  "Armenia": "ARM",
  "Azerbaijan": "AZR",
  "Georgia": "GEO",
  "Moldova": "MOL",
  "Imperial China": "CHI",
  "Jin China": "CHI",
  "Sunga India": "RAJ",
  "Anglo-Saxons": "ENG",
  "Kingdom of England": "ENG",
  "Great Britain": "ENG",
  "United Kingdom": "ENG",
  "Carolingian Empire": "FRA",
  "Kingdom of France": "FRA",
  "Confederate States": "CSA",
  "Confederacy": "CSA",

  
  "Nazi Germany": "GER_fascism",
  "Fascist Italy": "ITA_fascism",
  
  "India": "RAJ",
  "Israel": "ISR",
  "Modern Egypt": "EGY",
  "Ghana": "GHA",
  "Algeria": "ALG",
  "Nigeria": "NIG",
  "Vietnam": "VIN",
  "Kenya": "KEN",
  "Ukraine": "UKR",
  "Belarus": "BLR",
  "Chavin": "PRU",
  "Inca": "PRU",
  "Assyria": "ASY_neo_assyrian_empire_neutrality",
  "Babylon": "ASY_neo_assyrian_empire_communism",
  "USA": "USA",
};

const FLAG_URLS = {
  "Rome": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Vexilloid_of_the_Roman_Empire.svg/180px-Vexilloid_of_the_Roman_Empire.svg.png",
  "Western Rome": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Vexilloid_of_the_Roman_Empire.svg/180px-Vexilloid_of_the_Roman_Empire.svg.png",
  "Italy": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Flag_of_Italy.svg/180px-Flag_of_Italy.svg.png",
  "Egypt": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/Flag_of_Egypt.svg/180px-Flag_of_Egypt.svg.png",
  "Greeks": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Greece.svg/180px-Flag_of_Greece.svg.png",
  "Duchy of Poland": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Flag_of_Poland.svg/180px-Flag_of_Poland.svg.png",
  "Kingdom of Poland": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Flag_of_Poland.svg/180px-Flag_of_Poland.svg.png",
  "Republic of Poland": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Flag_of_Poland.svg/180px-Flag_of_Poland.svg.png",
  "Grand Duchy of Lithuania": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Flag_of_Lithuania.svg/180px-Flag_of_Lithuania.svg.png",
  "Republic of Lithuania": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Flag_of_Lithuania.svg/180px-Flag_of_Lithuania.svg.png",
  "Livonian Order": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cc/Flag_of_the_Teutonic_Order.svg/180px-Flag_of_the_Teutonic_Order.svg.png",
  "Polish-Lithuanian Commonwealth": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Flag_of_the_Polish%E2%80%93Lithuanian_Commonwealth.svg/180px-Flag_of_the_Polish%E2%80%93Lithuanian_Commonwealth.svg.png",
  "Mongols": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Flag_of_the_Mongol_Empire_3.svg/180px-Flag_of_the_Mongol_Empire_3.svg.png",
  "Ottomans": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Flag_of_the_Ottoman_Empire.svg/180px-Flag_of_the_Ottoman_Empire.svg.png",
  "Russia": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/180px-Flag_of_Russia.svg.png",
  "Tsardom of Russia": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/180px-Flag_of_Russia.svg.png",
  "Russian Empire": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Russia.svg/180px-Flag_of_Russia.svg.png",
  "Soviet Union": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Flag_of_the_Soviet_Union.svg/180px-Flag_of_the_Soviet_Union.svg.png",
  "Germany": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Flag_of_Germany.svg/180px-Flag_of_Germany.svg.png",
  "France": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_France.svg/180px-Flag_of_France.svg.png",
  "USA": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/180px-Flag_of_the_United_States.svg.png",
  "Han China": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Han_dynasty_flag.svg/180px-Han_dynasty_flag.svg.png",
  "Vikings": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Raven_Banner.svg/180px-Raven_Banner.svg.png",
  "Aztec": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Flag_of_the_Aztec_Triple_Alliance.svg/180px-Flag_of_the_Aztec_Triple_Alliance.svg.png",
};

function leaderFor(civ) {
  const list = LEADERS[civ.name];
  if (!list) return null;
  return list.find(l => state.year >= l.from && state.year < l.to) || null;
}

const _flagColorCache = new Map();   

function flagUrlForCiv(civ) {
  if (!civ) return null;
  if (civ.customFlag) return civ.customFlag;
  const tag = CIV_TAGS[civ.name];
  if (tag) return `flags_png/${tag}.png`;
  
  try {
    const c = document.createElement("canvas");
    c.width = 36; c.height = 24;
    drawProceduralFlag(c, civ);
    return c.toDataURL("image/png");
  } catch (e) { return null; }
}

function showWarPopup(declarer, target) {
  const stack = document.getElementById("war-popup-stack");
  if (!stack || !declarer || !target) return;
  const popup = document.createElement("div");
  popup.className = "war-popup";
  const aURL = flagUrlForCiv(declarer);
  const bURL = flagUrlForCiv(target);
  const aImg = aURL ? '<img src="' + aURL + '" alt="" />' : "";
  const bImg = bURL ? '<img src="' + bURL + '" alt="" />' : "";
  popup.innerHTML =
    aImg +
    '<div style="flex:1;">' +
      '<div style="color:#ffd0a0;font-weight:bold;letter-spacing:0.5px;">' + escapeHtml(declarer.name) + '</div>' +
      '<div style="color:#ff8080;font-size:11px;letter-spacing:1px;">DECLARED WAR</div>' +
      '<div style="color:#ffd0a0;font-weight:bold;letter-spacing:0.5px;">on ' + escapeHtml(target.name) + '</div>' +
    '</div>' +
    bImg;
  stack.appendChild(popup);
  
  setTimeout(() => { popup.classList.add("fading"); }, 4500);
  setTimeout(() => { if (popup.parentNode) popup.parentNode.removeChild(popup); }, 5100);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function applyFlagColor(civ) {
  if (!civ || civ._flagColorApplied) return;
  // Resolve URL the same way the country panel does.
  let url = null;
  if (civ.customFlag) {
    url = civ.customFlag;
  } else {
    const tag = CIV_TAGS[civ.name];
    if (tag) url = `flags_png/${tag}.png`;
  }
  if (!url) return;
  civ._flagColorApplied = true;   // don't retry even if load fails

  const apply = (hex) => {
    civ.color = hex;
    invalidateTintCache();
  };
  if (_flagColorCache.has(url)) { apply(_flagColorCache.get(url)); return; }

  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement("canvas");
      const W = Math.min(64, img.width || 64);
      const H = Math.min(64, img.height || 64);
      c.width = W; c.height = H;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, W, H);
      const data = cx.getImageData(0, 0, W, H).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 32) continue;                       // skip transparent
        const rr = data[i], gg = data[i + 1], bb = data[i + 2];
        // Skip near-pure-white pixels that are usually borders/star fields and
        // skew the average. Keep the bulk of the colored area.
        if (rr > 245 && gg > 245 && bb > 245) continue;
        r += rr; g += gg; b += bb; n++;
      }
      if (n === 0) return;
      const avg = [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
      const hex = "#" + avg.map(v => v.toString(16).padStart(2, "0")).join("");
      _flagColorCache.set(url, hex);
      apply(hex);
    } catch (e) {
      // CORS or decode error - leave civ.color alone.
    }
  };
  img.onerror = () => {};
  img.src = url;
}

// Run once over every alive civ - useful right after spawn.
function applyAllFlagColors() {
  for (const civ of state.civs) {
    if (civ.alive) applyFlagColor(civ);
  }
}

function drawProceduralFlag(canvas, civ) {
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  // Deterministic seed from civ id+name
  let seed = civ.id * 31 + civ.name.length * 17;
  for (let i = 0; i < civ.name.length; i++) seed = (seed * 7 + civ.name.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) / 0xffffff; };

  const c1 = civ.color;
  // Companion colors based on civ.color brightness
  const lum = colorLum(civ.color);
  const c2 = lum > 0.55 ? "#1a1410" : "#f0e6cc";
  const c3 = "#ffffff";
  const c4 = adjustColor(civ.color, -0.3);

  const pattern = Math.floor(rand() * 6);
  if (pattern === 0) {
    // 3 horizontal stripes
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H/3);
    ctx.fillStyle = c2; ctx.fillRect(0, H/3, W, H/3);
    ctx.fillStyle = c3; ctx.fillRect(0, 2*H/3, W, H/3);
  } else if (pattern === 1) {
    // 3 vertical stripes
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W/3, H);
    ctx.fillStyle = c3; ctx.fillRect(W/3, 0, W/3, H);
    ctx.fillStyle = c2; ctx.fillRect(2*W/3, 0, W/3, H);
  } else if (pattern === 2) {
    // 2 horizontal stripes with circle/sun
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H/2);
    ctx.fillStyle = c4; ctx.fillRect(0, H/2, W, H/2);
    ctx.fillStyle = c3;
    ctx.beginPath();
    ctx.arc(W/2, H/2, Math.min(W, H) * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else if (pattern === 3) {
    // Nordic-style cross
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = c3;
    ctx.fillRect(W * 0.28, 0, W * 0.12, H);
    ctx.fillRect(0, H * 0.42, W, H * 0.16);
  } else if (pattern === 4) {
    // Quartered
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W/2, H/2);
    ctx.fillStyle = c2; ctx.fillRect(W/2, 0, W/2, H/2);
    ctx.fillStyle = c2; ctx.fillRect(0, H/2, W/2, H/2);
    ctx.fillStyle = c1; ctx.fillRect(W/2, H/2, W/2, H/2);
  } else {
    // Solid with star
    ctx.fillStyle = c1; ctx.fillRect(0, 0, W, H);
    drawStar(ctx, W/2, H/2, Math.min(W, H) * 0.22, c3, "#000", null);
  }
  // Border
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(0.75, 0.75, W - 1.5, H - 1.5);
}

function colorLum(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function adjustColor(hex, delta) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + delta * 255));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + delta * 255));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + delta * 255));
  return "#" + [r, g, b].map(v => Math.floor(v).toString(16).padStart(2, "0")).join("");
}

const LEADER_PLACEHOLDER =
  "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
    `<svg xmlns="http:
      <rect width="90" height="110" fill="#2a1a10"/>
      <circle cx="45" cy="42" r="18" fill="#5a4a3a"/>
      <ellipse cx="45" cy="95" rx="32" ry="22" fill="#5a4a3a"/>
    </svg>`);

function showCountryPanel(civ) {
  if (!civ || !civ.alive) {
    hideCountryPanel();
    return;
  }
  const panel = document.getElementById("country-panel");
  panel.classList.remove("hidden");

  // Flag: prefer HOI4 PNG (via tag), else Wikipedia URL, else procedural.
  const flagCanvas = document.getElementById("country-flag");
  const tag = CIV_TAGS[civ.name];
  const localPath = tag ? `flags_png/${tag}.png` : null;
  const flagURL = FLAG_URLS[civ.name];

  function drawFlagFromImg(img) {
    const c = flagCanvas.getContext("2d");
    c.clearRect(0, 0, flagCanvas.width, flagCanvas.height);
    const r = Math.min(flagCanvas.width / img.width, flagCanvas.height / img.height);
    const w = img.width * r, h = img.height * r;
    c.drawImage(img, (flagCanvas.width - w) / 2, (flagCanvas.height - h) / 2, w, h);
  }

  // 1. Custom flag (player customized) wins. 2. HOI4 PNG via tag. 3. Wikipedia URL. 4. Procedural.
  if (civ.customFlag) {
    const img = new Image();
    img.onload = () => drawFlagFromImg(img);
    img.onerror = () => drawProceduralFlag(flagCanvas, civ);
    img.src = civ.customFlag;
  } else if (civ.isPlayer) {
    drawProceduralFlag(flagCanvas, civ);
  } else if (localPath || flagURL) {
    const img = new Image();
    img.onload = () => drawFlagFromImg(img);
    img.onerror = () => {
      // Fall through: try the alternate URL, then procedural
      if (img.src.endsWith(localPath || "")) {
        if (flagURL) {
          const img2 = new Image();
          img2.onload = () => drawFlagFromImg(img2);
          img2.onerror = () => drawProceduralFlag(flagCanvas, civ);
          img2.src = flagURL;
        } else {
          drawProceduralFlag(flagCanvas, civ);
        }
      } else {
        drawProceduralFlag(flagCanvas, civ);
      }
    };
    img.src = localPath || flagURL;
  } else {
    drawProceduralFlag(flagCanvas, civ);
  }

  document.getElementById("cp-name").textContent = civ.name;
  document.getElementById("cp-name").style.color = civ.color;
  // Permanent civ tag (3-letter identity that never changes through
  // renames). Debug-only so it doesn't clutter the regular UI.
  const tagEl = document.getElementById("cp-tag");
  if (tagEl) {
    if (state.debug && civ.tag) {
      tagEl.textContent = civ.tag;
      tagEl.style.display = "";
    } else {
      tagEl.style.display = "none";
    }
  }
  document.getElementById("cp-era").textContent = ERAS[civ.era].name.toUpperCase();

  // Leader: priority is custom (player-set) → hardcoded LEADERS table entry
  // → HOI4 portrait fallback for late eras.
  const leader = leaderFor(civ);
  const leaderImg = document.getElementById("cp-leader-img");
  leaderImg.onerror = () => { leaderImg.src = LEADER_PLACEHOLDER; };
  let leaderName = null, leaderImgSrc = null;
  if (civ.customLeaderName) leaderName = civ.customLeaderName;
  if (civ.customLeaderImg) leaderImgSrc = civ.customLeaderImg;
  if (!leaderName && leader) leaderName = leader.name;
  if (!leaderImgSrc && leader) leaderImgSrc = leader.img || null;
  // HOI4 fallback: if civ has a tag and HOI4_LEADERS has data, pick first
  // leader with a portrait (only when in late era, since these are all WWII-era figures).
  if (!leaderImgSrc && civ.era >= 5 && typeof HOI4_LEADERS !== "undefined") {
    const flagTag = CIV_TAGS[civ.name] || "";
    const tag = flagTag.split("_")[0];   // "POL_KINGDOM_neutrality" -> "POL"
    const list = HOI4_LEADERS[tag];
    if (list && list.length > 0) {
      const withPortrait = list.find(l => l.portrait) || list[0];
      leaderImgSrc = withPortrait.portrait ? `portraits/${tag}/${withPortrait.portrait}.png` : null;
      leaderName = leaderName || withPortrait.name;
    }
  }
  leaderImg.src = leaderImgSrc || LEADER_PLACEHOLDER;
  document.getElementById("cp-leader-name").textContent =
    leaderName || (civ.isPlayer ? "(your tribe's chieftain)" : "Unknown ruler");

  // Customize button — only shown for the player's own civ.
  const customBtn = document.getElementById("cp-customize-btn");
  if (customBtn) customBtn.style.display = civ.isPlayer ? "" : "none";
  // Upgrade-to-country button - only when the player is still a tribe
  // AND has reached eligibility (3+ settlements OR 50+ tiles OR has
  // moved past the tribal era). Hidden once they've graduated.
  const upgradeBtn = document.getElementById("cp-upgrade-btn");
  if (upgradeBtn) {
    let showUpgrade = false;
    if (civ.isPlayer && civ.isStartingTribe) {
      const tiles = countTiles(civ);
      if (civ.settlements.length >= 3 || tiles >= 50 || civ.era >= 1) {
        showUpgrade = true;
      }
    }
    upgradeBtn.style.display = showUpgrade ? "" : "none";
  }

  // Declare War + Form Alliance buttons - only when looking at OTHER civ
  // panels. If already at war/allied we show a banner instead of the button.
  const warBtn = document.getElementById("cp-declare-war-btn");
  const warBanner = document.getElementById("cp-war-state");
  const allyBtn = document.getElementById("cp-ally-btn");
  const allyBanner = document.getElementById("cp-ally-state");
  const diploEl = document.getElementById("cp-diplo");
  const player = state.civs[0];
  // Diplomacy panel visibility + per-button gating.
  if (diploEl) {
    if (!civ.isPlayer && civ.alive && player && player.isPlayer) {
      diploEl.style.display = "";
      const rel = player.relations[civ.id] || 0;
      const playerFaction = findFactionForCiv(player.id);
      const targetFaction = findFactionForCiv(civ.id);
      const inviteBtn = document.getElementById("cp-faction-invite-btn");
      const joinBtn = document.getElementById("cp-faction-join-btn");
      const leaveBtn = document.getElementById("cp-faction-leave-btn");
      const milAccessBtn = document.getElementById("cp-mil-access-btn");
      const callWarBtn = document.getElementById("cp-call-war-btn");
      const cwBtn = document.getElementById("cp-commonwealth-btn");
      // Invite-to-faction: player has a faction, target isn't in any faction.
      if (inviteBtn) {
        if (playerFaction && !targetFaction) {
          inviteBtn.style.display = "";
          inviteBtn.textContent = "🤝 Invite to " + playerFaction.name;
          inviteBtn.dataset.civId = civ.id;
          inviteBtn.dataset.factionName = playerFaction.name;
        } else {
          inviteBtn.style.display = "none";
        }
      }
      // Ask-to-join: target is in a faction, player isn't.
      if (joinBtn) {
        if (targetFaction && !playerFaction) {
          joinBtn.style.display = "";
          joinBtn.textContent = "📜 Ask to Join " + targetFaction.name;
          joinBtn.dataset.factionName = targetFaction.name;
          joinBtn.dataset.civId = civ.id;
        } else {
          joinBtn.style.display = "none";
        }
      }
      // Leave-faction: player is in a faction, ANY target panel shows it.
      if (leaveBtn) {
        if (playerFaction) {
          leaveBtn.style.display = "";
          leaveBtn.textContent = "↩ Leave " + playerFaction.name;
          leaveBtn.dataset.factionName = playerFaction.name;
        } else {
          leaveBtn.style.display = "none";
        }
      }
      // Military access: hide if same faction (already grants passage)
      // or if access already granted.
      if (milAccessBtn) {
        const sameFac = playerFaction && targetFaction && playerFaction.name === targetFaction.name;
        const alreadyGranted = state.militaryAccess && state.militaryAccess[player.id] && state.militaryAccess[player.id][civ.id];
        if (sameFac || alreadyGranted) {
          milAccessBtn.style.display = "none";
        } else {
          milAccessBtn.style.display = "";
          milAccessBtn.dataset.civId = civ.id;
        }
      }
      // Call to war: player has at least one active war that target isn't already in.
      if (callWarBtn) {
        const activeWarTargets = [];
        if (state.playerWars) {
          for (const enemyId of state.playerWars) {
            if (enemyId === civ.id) continue;
            const enemy = state.civs.find(c => c.id === enemyId && c.alive);
            if (!enemy) continue;
            const targetRel = civ.relations[enemyId] || 0;
            if (targetRel <= -50) continue;   // already at war with that enemy
            activeWarTargets.push(enemy);
          }
        }
        if (activeWarTargets.length > 0) {
          callWarBtn.style.display = "";
          callWarBtn.dataset.civId = civ.id;
          callWarBtn.textContent = "📯 Call to War (vs " + activeWarTargets.map(e => e.name).slice(0, 2).join(", ") + (activeWarTargets.length > 2 ? "…" : "") + ")";
        } else {
          callWarBtn.style.display = "none";
        }
      }
      // Commonwealth: only at +200 relations.
      if (cwBtn) {
        if (rel >= 200) {
          cwBtn.style.display = "";
          cwBtn.dataset.civId = civ.id;
        } else {
          cwBtn.style.display = "none";
        }
      }
      // Stash the target id on the gift / donate buttons too.
      const giftBtn = document.getElementById("cp-gift-btn");
      const donateBtn = document.getElementById("cp-donate-btn");
      if (giftBtn) giftBtn.dataset.civId = civ.id;
      if (donateBtn) donateBtn.dataset.civId = civ.id;
    } else {
      diploEl.style.display = "none";
    }
  }
  if (warBtn && warBanner && allyBtn && allyBanner && player && player.isPlayer) {
    if (civ.isPlayer || !civ.alive) {
      warBtn.style.display = "none";
      warBanner.style.display = "none";
      allyBtn.style.display = "none";
      allyBanner.style.display = "none";
    } else {
      const rel = player.relations[civ.id] || 0;
      // Allied state (rel >= 80)
      if (rel >= 80) {
        allyBtn.style.display = "none";
        allyBanner.style.display = "";
      } else {
        allyBtn.style.display = "";
        allyBanner.style.display = "none";
        allyBtn.dataset.civId = civ.id;
      }
      // War state (rel <= -50)
      if (rel <= -50) {
        warBtn.style.display = "none";
        warBanner.style.display = "";
      } else {
        warBtn.style.display = "";
        warBanner.style.display = "none";
        warBtn.dataset.civId = civ.id;
      }
    }
  }

  // Stats
  const tiles = countTiles(civ);
  const totalPop = civ.settlements.reduce((s, x) => s + x.pop, 0);
  const totalArmy = civ.armies.reduce((s, a) => s + a.count, 0);
  // Strength shown only in debug mode (it's the raw absorb-gate number,
  // useful for tuning but noisy in normal play).
  const strengthRow = state.debug
    ? `<div class="stat-row"><span class="stat-label">Strength</span><span class="stat-val">${civStrength(civ)}</span></div>`
    : "";
  const offWorldPlanets = new Set();
  for (const s of (civ.settlements || [])) {
    const p = s.planet || "Earth";
    if (p !== "Earth") offWorldPlanets.add(p);
  }
  for (const a of (civ.armies || [])) {
    const p = a.planet || "Earth";
    if (p !== "Earth") offWorldPlanets.add(p);
  }
  const coloniesRow = offWorldPlanets.size > 0
    ? `<div class="stat-row"><span class="stat-label">Has colonies in</span><span class="stat-val">${[...offWorldPlanets].sort().join(", ")}</span></div>`
    : "";
  document.getElementById("cp-stats").innerHTML = `
    <div class="stat-row"><span class="stat-label">Settlements</span><span class="stat-val">${civ.settlements.length}</span></div>
    <div class="stat-row"><span class="stat-label">Population</span><span class="stat-val">${totalPop}</span></div>
    <div class="stat-row"><span class="stat-label">Territory</span><span class="stat-val">${tiles} tiles</span></div>
    <div class="stat-row"><span class="stat-label">Army</span><span class="stat-val">${totalArmy} units</span></div>
    ${strengthRow}
    <div class="stat-row"><span class="stat-label">Stability</span><span class="stat-val">${Math.round(civ.stability)}%</span></div>
    ${coloniesRow}
  `;

  // Relations with other living civs
  const relsEl = document.getElementById("cp-relations");
  // First, collect every civ this one is AT WAR with (rel <= -50). Show them
  // up top in a dedicated section so wars are immediately visible.
  const wars = state.civs
    .filter(c => c.alive && c.id !== civ.id && (civ.relations[c.id] || 0) <= -50)
    .sort((a, b) => (civ.relations[a.id] || 0) - (civ.relations[b.id] || 0));
  const warHtml = wars.length === 0 ? "" :
    '<div style="margin-bottom:6px;padding:6px 8px;border:1px solid #c44;border-radius:3px;background:rgba(80,16,16,0.4);">' +
      '<div style="color:#ff8080;font-size:11px;letter-spacing:1.5px;font-weight:bold;margin-bottom:4px;">⚔ AT WAR WITH</div>' +
      wars.map(w => '<div class="rel-row" style="padding:2px 0;">' +
        '<span class="rel-swatch" style="background:' + w.color + '"></span>' +
        '<span class="rel-name" style="color:#ffd0a0;">' + w.name + '</span>' +
        '<span class="rel-val rel-neg">' + Math.round(civ.relations[w.id] || 0) + '</span>' +
        '</div>').join("") +
    '</div>';
  // Faction block: if this civ is in a faction, show every other living
  // member as "AT FACTION WITH" - mirrors the AT WAR WITH layout but in
  // friendly blue. Dead members are filtered out.
  const faction = findFactionForCiv(civ.id);
  let factionHtml = "";
  if (faction) {
    const allies = state.civs
      .filter(c => c.alive && c.id !== civ.id && faction.memberIds.indexOf(c.id) >= 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (allies.length > 0) {
      factionHtml =
        '<div style="margin-bottom:6px;padding:6px 8px;border:1px solid ' + faction.color + ';border-radius:3px;background:rgba(20,40,80,0.4);">' +
          '<div style="color:#9bc8ff;font-size:11px;letter-spacing:1.5px;font-weight:bold;margin-bottom:4px;">🤝 AT FACTION WITH (' + faction.name + ')</div>' +
          allies.map(w => '<div class="rel-row" style="padding:2px 0;">' +
            '<span class="rel-swatch" style="background:' + w.color + '"></span>' +
            '<span class="rel-name" style="color:#cfe4ff;">' + w.name + '</span>' +
            '<span class="rel-val rel-pos">+100</span>' +
            '</div>').join("") +
        '</div>';
    }
  }
  // Then show the broader top-8 relations. Skip civs already in the war
  // or faction blocks so they're not duplicated.
  const warIds = new Set(wars.map(w => w.id));
  const factionIds = faction ? new Set(faction.memberIds) : new Set();
  const others = state.civs
    .filter(c => c.alive && c.id !== civ.id && !warIds.has(c.id) && !factionIds.has(c.id))
    .map(c => ({ civ: c, rel: civ.relations[c.id] || 0 }))
    .sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel))
    .slice(0, 8);
  const otherHtml = others.map(({ civ: oc, rel }) => {
    const cls = rel > 10 ? "rel-pos" : rel < -10 ? "rel-neg" : "rel-zero";
    return '<div class="rel-row">' +
      '<span class="rel-swatch" style="background:' + oc.color + '"></span>' +
      '<span class="rel-name">' + oc.name + '</span>' +
      '<span class="rel-val ' + cls + '">' + (rel >= 0 ? "+" : "") + Math.round(rel) + '</span>' +
      '</div>';
  }).join("");
  relsEl.innerHTML = warHtml + factionHtml + otherHtml ||
    '<div style="color:#8a7a5c;font-style:italic;">No diplomatic contacts.</div>';
}

function hideCountryPanel() {
  document.getElementById("country-panel").classList.add("hidden");
}

// Populate the "PROVINCE" section of the panel from provinceInfo (definition.csv).
function renderProvinceDetails(pid) {
  const el = document.getElementById("cp-province");
  if (!el) return;
  if (!pid || !provinceInfo || !provinceInfo[pid]) {
    el.innerHTML = `<div style="color:#8a7a5c;font-style:italic;font-size:11px;">No province selected.</div>`;
    return;
  }
  const p = provinceInfo[pid];
  const rgb = `rgb(${p.r}, ${p.g}, ${p.b})`;
  const hex = "#" + [p.r, p.g, p.b].map(v => v.toString(16).padStart(2, "0")).join("");
  el.innerHTML = `
    <div class="stat-row"><span class="stat-label">ID</span><span class="stat-val">${p.id}</span></div>
    <div class="stat-row"><span class="stat-label">RGB</span>
      <span class="stat-val" style="display:flex;align-items:center;gap:4px;">
        <span style="display:inline-block;width:12px;height:12px;background:${rgb};border:1px solid #000;"></span>
        <span style="font-family:monospace;">${p.r},${p.g},${p.b}</span>
      </span>
    </div>
    <div class="stat-row"><span class="stat-label">Hex</span><span class="stat-val" style="font-family:monospace;">${hex}</span></div>
    <div class="stat-row"><span class="stat-label">Type</span><span class="stat-val">${p.type}</span></div>
    <div class="stat-row"><span class="stat-label">Terrain</span><span class="stat-val">${p.terrain}</span></div>
    <div class="stat-row"><span class="stat-label">Coastal</span><span class="stat-val">${p.coastal ? "yes" : "no"}</span></div>
    <div class="stat-row"><span class="stat-label">Continent</span><span class="stat-val">${p.continent}</span></div>
  `;
}

// Show the panel for an unowned province (skips the civ-specific bits).
function showProvinceOnlyPanel(pid) {
  const panel = document.getElementById("country-panel");
  panel.classList.remove("hidden");
  // Default flag = procedural (no civ exists)
  drawProceduralFlag(document.getElementById("country-flag"), { id: pid, color: "#6b4f2c", name: "P" + pid });
  document.getElementById("cp-name").textContent = "Province " + pid;
  document.getElementById("cp-name").style.color = "#a89678";
  document.getElementById("cp-era").textContent = "UNCLAIMED";
  document.getElementById("cp-leader-img").src = LEADER_PLACEHOLDER;
  document.getElementById("cp-leader-name").textContent = "-";
  document.getElementById("cp-stats").innerHTML =
    `<div style="color:#8a7a5c;font-style:italic;font-size:11px;">No civilization owns this province.</div>`;
  document.getElementById("cp-relations").innerHTML = "";
}

document.getElementById("country-close").addEventListener("click", hideCountryPanel);

// Declare-war button. Sets relations to -100 with the targeted civ and
// records the AI's full-focus targeting in `state.warFocus[aiCivId] = playerCivId`
// so that civ uses the player as its single combat target until peace returns.
document.getElementById("cp-declare-war-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const targetId = parseInt(document.getElementById("cp-declare-war-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === targetId);
  if (!target || !target.alive) return;
  player.relations[target.id] = -100;
  target.relations[player.id] = -100;
  if (!state.warFocus) state.warFocus = {};
  state.warFocus[target.id] = player.id;
  // Explicit declaration unlocks the player's ability to invade. Without an
  // entry in this set, tryMoveOrAttack refuses to move onto enemy tiles.
  if (!state.playerWars) state.playerWars = new Set();
  state.playerWars.add(target.id);
  log("war", `${player.name} declares war on ${target.name}!`);
  showWarPopup(player, target);
  // Faction war propagation: if the player is in a faction (NATO etc.),
  // every other living faction member also goes to war with the target.
  // The AI's existing aggression rules (rel <= -50) handle the actual
  // attacks, and faction passage already lets allies cross our territory.
  const faction = findFactionForCiv(player.id);
  if (faction) {
    for (const memberId of faction.memberIds) {
      if (memberId === player.id || memberId === target.id) continue;
      const ally = state.civs.find(c => c.id === memberId && c.alive);
      if (!ally) continue;
      ally.relations[target.id] = -100;
      target.relations[ally.id] = -100;
      log("war", `${ally.name} joins the war alongside ${player.name}.`);
    }
  }
  showCountryPanel(target);   // refresh panel to show "AT WAR"
});

// Form Alliance button. Locks both sides to +100 relations - the existing
// shouldAttack / tryMoveOrAttack logic prevents both AIs and the player
// from accidentally attacking allies.
document.getElementById("cp-ally-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const targetId = parseInt(document.getElementById("cp-ally-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === targetId);
  if (!target || !target.alive) return;
  player.relations[target.id] = 100;
  target.relations[player.id] = 100;
  // If we were at war, the alliance overrides it - clear any war flags.
  if (state.warFocus) delete state.warFocus[target.id];
  if (state.playerWars) state.playerWars.delete(target.id);
  log("peace", `${player.name} and ${target.name} forge an alliance!`);
  showCountryPanel(target);   // refresh panel
});

// ---- Diplomacy buttons ----
function _diploBumpRel(player, target, amount) {
  const cur = player.relations[target.id] || 0;
  const newRel = Math.min(200, Math.max(-100, cur + amount));
  player.relations[target.id] = newRel;
  target.relations[player.id] = newRel;
}

document.getElementById("cp-gift-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const id = parseInt(document.getElementById("cp-gift-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === id && c.alive);
  if (!target) return;
  _diploBumpRel(player, target, 10);
  log("peace", player.name + " sends a gift to " + target.name + " (+10 rel).");
  showCountryPanel(target);
});

document.getElementById("cp-donate-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const id = parseInt(document.getElementById("cp-donate-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === id && c.alive);
  if (!target) return;
  // Find a combat army the player can spare. Pull 1 unit out, transfer
  // to the target's capital tile.
  const donor = player.armies.find(a => a.type !== "settler" && a.type !== "colonizer" && a.type !== "leader" && a.count > 1);
  if (!donor) {
    log("event", "Not enough spare combat units to donate (need an army with 2+ count).");
    return;
  }
  donor.count -= 1;
  const cap = target.settlements[0];
  const sCol = cap ? cap.col : donor.col;
  const sRow = cap ? cap.row : donor.row;
  target.armies.push({
    id: nextArmyId++, col: sCol, row: sRow,
    type: donor.type, count: 1, civId: target.id, moves: 0,
  });
  _diploBumpRel(player, target, 20);
  log("peace", player.name + " donates 1 " + (UNITS[donor.type] && UNITS[donor.type].name || donor.type) + " to " + target.name + " (+20 rel).");
  showCountryPanel(target);
});

document.getElementById("cp-faction-invite-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const btn = document.getElementById("cp-faction-invite-btn");
  const id = parseInt(btn.dataset.civId, 10);
  const factionName = btn.dataset.factionName;
  const target = state.civs.find(c => c.id === id && c.alive);
  const faction = (state.factions || []).find(f => f.name === factionName);
  if (!target || !faction) return;
  if (faction.memberIds.includes(target.id)) return;
  faction.memberIds.push(target.id);
  // Lock target's relations to +100 with every faction member.
  for (const mid of faction.memberIds) {
    if (mid === target.id) continue;
    const m = state.civs.find(c => c.id === mid && c.alive);
    if (!m) continue;
    target.relations[m.id] = 100;
    m.relations[target.id] = 100;
  }
  log("peace", target.name + " accepts the invitation and joins " + factionName + ".");
  showCountryPanel(target);
});

document.getElementById("cp-faction-leave-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const factionName = document.getElementById("cp-faction-leave-btn").dataset.factionName;
  const faction = (state.factions || []).find(f => f.name === factionName);
  if (!faction) return;
  faction.memberIds = faction.memberIds.filter(id => id !== player.id);
  log("event", player.name + " withdraws from " + factionName + ".");
  // No relations reset - leaving doesn't make former allies into enemies.
  // Refresh the panel that was open (whichever it was).
  const openId = document.getElementById("cp-ally-btn").dataset.civId;
  if (openId) {
    const t = state.civs.find(c => c.id === parseInt(openId, 10) && c.alive);
    if (t) showCountryPanel(t);
  }
});

// Acceptance probability based on relations: 0 -> 25%, 100 -> 65%,
// 200 -> 95%. Hostile (rel < 0) always declines.
function _diploAcceptChance(rel) {
  if (rel < 0) return 0;
  return Math.max(0.05, Math.min(0.95, 0.25 + rel * 0.0035));
}

document.getElementById("cp-faction-join-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const btn = document.getElementById("cp-faction-join-btn");
  const factionName = btn.dataset.factionName;
  const target = state.civs.find(c => c.id === parseInt(btn.dataset.civId, 10) && c.alive);
  const faction = (state.factions || []).find(f => f.name === factionName);
  if (!target || !faction) return;
  // Acceptance is averaged over current member relations with the player.
  const members = faction.memberIds.map(id => state.civs.find(c => c.id === id && c.alive)).filter(Boolean);
  if (members.length === 0) return;
  const avgRel = members.reduce((s, m) => s + (m.relations[player.id] || 0), 0) / members.length;
  if (Math.random() < _diploAcceptChance(avgRel)) {
    faction.memberIds.push(player.id);
    for (const m of members) {
      player.relations[m.id] = 100;
      m.relations[player.id] = 100;
    }
    log("peace", player.name + " is admitted to " + factionName + ".");
  } else {
    log("event", factionName + " declines " + player.name + "'s membership petition.");
  }
  showCountryPanel(target);
});

document.getElementById("cp-mil-access-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const id = parseInt(document.getElementById("cp-mil-access-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === id && c.alive);
  if (!target) return;
  const rel = target.relations[player.id] || 0;
  if (Math.random() < _diploAcceptChance(rel)) {
    if (!state.militaryAccess) state.militaryAccess = {};
    if (!state.militaryAccess[player.id]) state.militaryAccess[player.id] = {};
    state.militaryAccess[player.id][target.id] = true;
    log("peace", target.name + " grants " + player.name + " military access.");
  } else {
    log("event", target.name + " refuses " + player.name + "'s request for military access.");
  }
  showCountryPanel(target);
});

document.getElementById("cp-call-war-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const id = parseInt(document.getElementById("cp-call-war-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === id && c.alive);
  if (!target || !state.playerWars) return;
  const rel = target.relations[player.id] || 0;
  if (Math.random() < _diploAcceptChance(rel)) {
    let joined = 0;
    for (const enemyId of state.playerWars) {
      if (enemyId === target.id) continue;
      const enemy = state.civs.find(c => c.id === enemyId && c.alive);
      if (!enemy) continue;
      target.relations[enemy.id] = -100;
      enemy.relations[target.id] = -100;
      joined++;
    }
    log("war", target.name + " answers " + player.name + "'s call and enters " + joined + " war(s) on its side.");
  } else {
    log("event", target.name + " refuses to join " + player.name + "'s wars.");
  }
  showCountryPanel(target);
});

document.getElementById("cp-commonwealth-btn").addEventListener("click", () => {
  const player = state.civs[0];
  if (!player || !player.isPlayer) return;
  const id = parseInt(document.getElementById("cp-commonwealth-btn").dataset.civId, 10);
  const target = state.civs.find(c => c.id === id && c.alive);
  if (!target) return;
  if ((player.relations[target.id] || 0) < 200) return;
  // Form the commonwealth: name combines the two civs, player keeps its
  // identity (id, faction membership, tag) but absorbs the target's
  // territory + settlements + armies. Target becomes "capitulated to"
  // the new commonwealth.
  const newName = player.name + "-" + target.name + " Commonwealth";
  if (!player.previousNames) player.previousNames = [];
  player.previousNames.push(player.name);
  player.name = newName;
  player.lastChangeYear = state.year;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (state.ownership[r][c] === target.id) state.ownership[r][c] = player.id;
    }
  }
  for (const s of target.settlements) player.settlements.push(s);
  for (const a of target.armies) player.armies.push({ ...a, civId: player.id });
  target.settlements = [];
  target.armies = [];
  target.alive = false;
  target.capitulatedTo = player.id;
  log("peace", newName + " is proclaimed - " + target.name + " merges into the union.");
  invalidateTintCache();
  showCountryPanel(player);
});

// =================== PLAYER MINI-FLAG (top-left) ===================
// Renders your civ's flag into the mini button and opens the country panel
// when clicked. Hidden until you've placed your starting tribe.
function updatePlayerFlagButton() {
  const btn = document.getElementById("player-flag-btn");
  if (!btn) return;
  const civ = state.civs[0];
  if (!civ || !civ.isPlayer || !civ.alive || civ.settlements.length === 0) {
    btn.classList.add("hidden");
    return;
  }
  btn.classList.remove("hidden");
  const canvas = document.getElementById("player-flag-canvas");
  if (!canvas) return;
  // Custom flag wins, else procedural.
  if (civ.customFlag) {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const r = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * r, h = img.height * r;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    };
    img.onerror = () => drawProceduralFlag(canvas, civ);
    img.src = civ.customFlag;
  } else {
    drawProceduralFlag(canvas, civ);
  }
}

document.getElementById("player-flag-btn").addEventListener("click", () => {
  const civ = state.civs[0];
  if (civ && civ.isPlayer && civ.alive) showCountryPanel(civ);
});

// =================== CUSTOMIZE MODAL ===================
// Era-based naming template. Tribal age forces "[X] Tribe", classical/medieval/
// renaissance forces "Kingdom of [X]", industrial+ allows free-form.
function nameTemplateForEra(era) {
  if (era <= 0) return { prefix: "",            suffix: " Tribe",     hint: "Tribal age - your name must end with \"Tribe\"." };
  if (era <= 3) return { prefix: "Kingdom of ", suffix: "",           hint: "Pre-industrial - your name must start with \"Kingdom of\"." };
  return         { prefix: "",            suffix: "",           hint: "Industrial age and beyond - any name allowed." };
}

// Strip a known prefix/suffix from the existing civ name so the input only
// contains the user-editable middle.
function stripTemplate(name, tpl) {
  let n = name || "";
  if (tpl.prefix && n.startsWith(tpl.prefix)) n = n.slice(tpl.prefix.length);
  if (tpl.suffix && n.endsWith(tpl.suffix)) n = n.slice(0, -tpl.suffix.length);
  return n.trim();
}

// Build flat list of available portraits. Prefers HOI4_ALL_PORTRAITS (every
// PNG file actually present in portraits/, ~1.1k entries) since it picks up
// portraits whose characters/*.txt entry was unparseable. Falls back to
// HOI4_LEADERS for older builds.
function listAvailablePortraits() {
  const out = [];
  if (typeof HOI4_ALL_PORTRAITS !== "undefined") {
    for (const p of HOI4_ALL_PORTRAITS) {
      out.push({ tag: p.tag, name: p.name || p.tag, src: `portraits/${p.tag}/${p.file}.png` });
    }
    return out;
  }
  if (typeof HOI4_LEADERS === "undefined") return out;
  for (const tag of Object.keys(HOI4_LEADERS)) {
    for (const l of HOI4_LEADERS[tag]) {
      if (l.portrait) {
        out.push({ tag, name: l.name || tag, src: `portraits/${tag}/${l.portrait}.png` });
      }
    }
  }
  return out;
}

// Build flat list of available flag tags. Prefers HOI4_ALL_FLAGS (the
// complete enumeration of every PNG in flags_png/, ~2.5k files) when
// available; falls back to HOI4_COUNTRY_COLORS + CIV_TAGS otherwise.
function listAvailableFlags() {
  const out = [];
  const seen = new Set();
  if (typeof HOI4_ALL_FLAGS !== "undefined") {
    for (const tag of HOI4_ALL_FLAGS) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push({ tag, src: `flags_png/${tag}.png` });
    }
    return out;   // already exhaustive, no need to merge other sources
  }
  if (typeof HOI4_COUNTRY_COLORS !== "undefined") {
    for (const tag of Object.keys(HOI4_COUNTRY_COLORS)) {
      if (seen.has(tag)) continue;
      seen.add(tag);
      out.push({ tag, src: `flags_png/${tag}.png` });
    }
  }
  for (const tagFull of Object.values(CIV_TAGS)) {
    if (!tagFull || seen.has(tagFull)) continue;
    seen.add(tagFull);
    out.push({ tag: tagFull, src: `flags_png/${tagFull}.png` });
  }
  out.sort((a, b) => a.tag.localeCompare(b.tag));
  return out;
}

// Modal state — what's currently picked but not yet saved.
let _cmDraft = { portraitSrc: null, portraitLabel: null, flagSrc: null, flagTag: null };

function openCustomizeModal() {
  const civ = state.civs[0];
  if (!civ || !civ.isPlayer) return;
  const modal = document.getElementById("customize-modal");
  if (!modal) return;

  // Pre-fill with current values.
  const tpl = nameTemplateForEra(civ.era);
  document.getElementById("cm-name-prefix").textContent = tpl.prefix;
  document.getElementById("cm-name-suffix").textContent = tpl.suffix;
  document.getElementById("cm-name-hint").textContent = tpl.hint;
  document.getElementById("cm-name").value = stripTemplate(civ.name, tpl);
  document.getElementById("cm-leader-name").value = civ.customLeaderName || "";

  _cmDraft.portraitSrc   = civ.customLeaderImg || null;
  _cmDraft.portraitLabel = civ.customLeaderName || null;
  _cmDraft.flagSrc       = civ.customFlag || null;
  _cmDraft.flagTag       = civ.customFlagTag || null;

  // Previews
  const pp = document.getElementById("cm-portrait-preview");
  pp.src = _cmDraft.portraitSrc || LEADER_PLACEHOLDER;
  document.getElementById("cm-portrait-label").textContent =
    _cmDraft.portraitLabel ? _cmDraft.portraitLabel : "(none)";
  const fp = document.getElementById("cm-flag-preview");
  fp.src = _cmDraft.flagSrc || "";
  fp.style.display = _cmDraft.flagSrc ? "" : "none";
  document.getElementById("cm-flag-label").textContent =
    _cmDraft.flagTag ? _cmDraft.flagTag : "(procedural)";

  // Build grids (filtered by current search box content).
  rebuildPortraitGrid();
  rebuildFlagGrid();

  modal.classList.remove("hidden");
}

function closeCustomizeModal() {
  document.getElementById("customize-modal").classList.add("hidden");
}

function rebuildPortraitGrid() {
  const grid = document.getElementById("cm-portrait-grid");
  if (!grid) return;
  const q = (document.getElementById("cm-portrait-search").value || "").toLowerCase().trim();
  const all = listAvailablePortraits();
  const items = q ? all.filter(p => p.tag.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : all;
  // Cap at 800. img loading="lazy" defers the actual fetches; search
  // narrows things down further when needed.
  grid.innerHTML = items.slice(0, 800).map(p => `
    <div class="cm-grid-item ${_cmDraft.portraitSrc === p.src ? "selected" : ""}"
         data-src="${p.src}" data-name="${p.name.replace(/"/g, "&quot;")}" title="${p.tag} - ${p.name.replace(/"/g, "&quot;")}">
      <img src="${p.src}" loading="lazy" />
      <div class="cm-tag-label">${p.tag}</div>
    </div>
  `).join("");
  for (const el of grid.querySelectorAll(".cm-grid-item")) {
    el.addEventListener("click", () => {
      _cmDraft.portraitSrc   = el.dataset.src;
      _cmDraft.portraitLabel = el.dataset.name;
      document.getElementById("cm-portrait-preview").src = el.dataset.src;
      document.getElementById("cm-portrait-label").textContent = el.dataset.name;
      // Auto-fill the leader-name input if it's empty.
      const ln = document.getElementById("cm-leader-name");
      if (!ln.value.trim()) ln.value = el.dataset.name;
      for (const e of grid.querySelectorAll(".cm-grid-item")) e.classList.remove("selected");
      el.classList.add("selected");
    });
  }
}

function rebuildFlagGrid() {
  const grid = document.getElementById("cm-flag-grid");
  if (!grid) return;
  const q = (document.getElementById("cm-flag-search").value || "").toLowerCase().trim();
  const all = listAvailableFlags();
  const items = q ? all.filter(p => p.tag.toLowerCase().includes(q)) : all;
  // Cap at 800 — img loading="lazy" keeps the cost down (only visible images
  // actually fetch). Search filters further when a query is typed.
  grid.innerHTML = items.slice(0, 800).map(p => `
    <div class="cm-grid-item ${_cmDraft.flagSrc === p.src ? "selected" : ""}"
         data-src="${p.src}" data-tag="${p.tag}" title="${p.tag}">
      <img src="${p.src}" loading="lazy" />
      <div class="cm-tag-label">${p.tag}</div>
    </div>
  `).join("");
  for (const el of grid.querySelectorAll(".cm-grid-item")) {
    el.addEventListener("click", () => {
      _cmDraft.flagSrc = el.dataset.src;
      _cmDraft.flagTag = el.dataset.tag;
      const fp = document.getElementById("cm-flag-preview");
      fp.src = el.dataset.src;
      fp.style.display = "";
      document.getElementById("cm-flag-label").textContent = el.dataset.tag;
      for (const e of grid.querySelectorAll(".cm-grid-item")) e.classList.remove("selected");
      el.classList.add("selected");
    });
  }
}

function saveCustomization() {
  const civ = state.civs[0];
  if (!civ || !civ.isPlayer) return;
  const tpl = nameTemplateForEra(civ.era);
  const middle = (document.getElementById("cm-name").value || "").trim();
  if (!middle) { alert("Please enter a name."); return; }
  const newName = tpl.prefix + middle + tpl.suffix;
  // If the player renamed their civ, record the old name so the family
  // tree shows the rename as a child node (and console kill <oldname>
  // still finds them by their previous identity).
  if (newName !== civ.name) {
    if (!civ.previousNames) civ.previousNames = [];
    civ.previousNames.push(civ.name);
    civ.lastChangeYear = state.year;
    log("event", civ.name + " renames itself to " + newName + ".");
  }
  civ.name = newName;
  // Player taking on a civilized name graduates them out of the tribal
  // bucket - their map borders flip from fuzzy to crisp and they become
  // eligible for stale-empire splitting in the long run.
  if (civ.isStartingTribe) {
    civ.isStartingTribe = false;
    log("event", civ.name + " emerges from the tribal age.");
  }
  civ.customLeaderName = (document.getElementById("cm-leader-name").value || "").trim() || null;
  civ.customLeaderImg  = _cmDraft.portraitSrc || null;
  const flagChanged = (civ.customFlag || null) !== (_cmDraft.flagSrc || null);
  civ.customFlag       = _cmDraft.flagSrc || null;
  civ.customFlagTag    = _cmDraft.flagTag || null;
  // If the flag changed, re-derive the territory color from its average.
  // applyFlagColor() short-circuits when _flagColorApplied is true, so we
  // clear the flag here to force a fresh sample.
  if (flagChanged) {
    civ._flagColorApplied = false;
    applyFlagColor(civ);
  }
  closeCustomizeModal();
  showCountryPanel(civ);   // refresh
  updateUI();
  invalidateTintCache();
  render();
}

// Wire up event listeners (called once, on first DOMContentLoaded basically).
(function wireCustomizeModal() {
  const btn = document.getElementById("cp-customize-btn");
  if (btn) btn.addEventListener("click", openCustomizeModal);
  // Upgrade-to-country button reuses the customize modal - the player
  // picks a civilized name (era-appropriate prefix/suffix), and the save
  // handler clears isStartingTribe.
  const upBtn = document.getElementById("cp-upgrade-btn");
  if (upBtn) upBtn.addEventListener("click", openCustomizeModal);
  const close = document.getElementById("cm-close");
  if (close) close.addEventListener("click", closeCustomizeModal);
  const cancel = document.getElementById("cm-cancel");
  if (cancel) cancel.addEventListener("click", closeCustomizeModal);
  const save = document.getElementById("cm-save");
  if (save) save.addEventListener("click", saveCustomization);
  const ps = document.getElementById("cm-portrait-search");
  if (ps) ps.addEventListener("input", rebuildPortraitGrid);
  const fs = document.getElementById("cm-flag-search");
  if (fs) fs.addEventListener("input", rebuildFlagGrid);

  // Read a File into a data URL string (~base64 inline). Resolves with the
  // URL or null on failure. Used by the upload buttons.
  function readImageFile(file, maxSide) {
    return new Promise((resolve) => {
      if (!file || !file.type.startsWith("image/")) { resolve(null); return; }
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = () => {
        // Re-encode through a canvas at a sane resolution so giant 4 MB
        // photos don't bloat the saved civ object.
        const img = new Image();
        img.onload = () => {
          const max = maxSide || 256;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const cx = c.getContext("2d");
          cx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  const portraitFile = document.getElementById("cm-portrait-file");
  if (portraitFile) portraitFile.addEventListener("change", async (e) => {
    const url = await readImageFile(e.target.files[0], 320);
    if (!url) return;
    _cmDraft.portraitSrc   = url;
    _cmDraft.portraitLabel = "(uploaded)";
    document.getElementById("cm-portrait-preview").src = url;
    document.getElementById("cm-portrait-label").textContent = "(uploaded)";
    // Clear grid selection.
    for (const e2 of document.querySelectorAll("#cm-portrait-grid .cm-grid-item")) e2.classList.remove("selected");
    e.target.value = "";   // allow picking the same file again later
  });
  const flagFile = document.getElementById("cm-flag-file");
  if (flagFile) flagFile.addEventListener("change", async (e) => {
    const url = await readImageFile(e.target.files[0], 256);
    if (!url) return;
    _cmDraft.flagSrc = url;
    _cmDraft.flagTag = "(uploaded)";
    const fp = document.getElementById("cm-flag-preview");
    fp.src = url;
    fp.style.display = "";
    document.getElementById("cm-flag-label").textContent = "(uploaded)";
    for (const e2 of document.querySelectorAll("#cm-flag-grid .cm-grid-item")) e2.classList.remove("selected");
    e.target.value = "";
  });

  const portraitClear = document.getElementById("cm-portrait-clear");
  if (portraitClear) portraitClear.addEventListener("click", () => {
    _cmDraft.portraitSrc = null;
    _cmDraft.portraitLabel = null;
    document.getElementById("cm-portrait-preview").src = LEADER_PLACEHOLDER;
    document.getElementById("cm-portrait-label").textContent = "(none)";
    for (const e of document.querySelectorAll("#cm-portrait-grid .cm-grid-item")) e.classList.remove("selected");
  });
  const flagClear = document.getElementById("cm-flag-clear");
  if (flagClear) flagClear.addEventListener("click", () => {
    _cmDraft.flagSrc = null;
    _cmDraft.flagTag = null;
    const fp = document.getElementById("cm-flag-preview");
    fp.src = "";
    fp.style.display = "none";
    document.getElementById("cm-flag-label").textContent = "(procedural)";
    for (const e of document.querySelectorAll("#cm-flag-grid .cm-grid-item")) e.classList.remove("selected");
  });
})();

// =================== STARTUP ===================
// =================== MOBILE / TOUCH SUPPORT ===================
function isMobileDevice() {
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)) return true;
  // Treat narrow windows as mobile too (handy for desktop testing).
  if (window.innerWidth < 768) return true;
  // iPads on iOS 13+ report as desktop Safari but expose touch points.
  if (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1100) return true;
  return false;
}

function applyMobileLayout() {
  const mobile = isMobileDevice();
  document.body.classList.toggle("mobile", mobile);
  return mobile;
}

(function wireMobileToggle() {
  const toggle = document.getElementById("mobile-sidebar-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const sb = document.getElementById("sidebar");
    if (!sb) return;
    sb.classList.toggle("collapsed");
    toggle.textContent = sb.classList.contains("collapsed") ? "▲" : "▼";
  });
})();

// Touch input on the map canvas: 1 finger drag = pan, 2 fingers = pinch zoom,
// short tap = treated as a mouse click (existing click handler does the work).
(function wireMobileTouch() {
  const canvas = document.getElementById("map");
  if (!canvas) return;
  let lastSingle = null;     // {x, y} - last single-touch position for panning
  let pinchDist = 0;         // initial finger distance for pinch
  let pinchZoom = 1;         // initial view.zoom at pinch start
  let touchStart = null;     // {x, y, t} - to distinguish tap from drag
  let didDrag = false;

  function dist(a, b) {
    const dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Midpoint between two touches in canvas-local CSS pixels.
  function pinchCenter(e) {
    const rect = canvas.getBoundingClientRect();
    const t0 = e.touches[0], t1 = e.touches[1];
    return {
      x: ((t0.clientX + t1.clientX) / 2) - rect.left,
      y: ((t0.clientY + t1.clientY) / 2) - rect.top,
    };
  }
  let pinchAnchor = null;   // { mapX, mapY } - map-coords under the pinch midpoint at start

  canvas.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      lastSingle = { x: t.clientX, y: t.clientY };
      touchStart = { x: t.clientX, y: t.clientY, t: Date.now() };
      didDrag = false;
    } else if (e.touches.length === 2) {
      pinchDist = dist(e.touches[0], e.touches[1]);
      pinchZoom = view.zoom;
      // Anchor the pinch on the map point currently under the midpoint, so
      // zoom keeps that point fixed instead of always zooming toward (0,0).
      const mid = pinchCenter(e);
      pinchAnchor = {
        screenX: mid.x,
        screenY: mid.y,
        mapX: (mid.x - view.panX) / view.zoom,
        mapY: (mid.y - view.panY) / view.zoom,
      };
      lastSingle = null;
    }
  }, { passive: true });

  canvas.addEventListener("touchmove", (e) => {
    if (e.touches.length === 1 && lastSingle) {
      const t = e.touches[0];
      const dx = t.clientX - lastSingle.x;
      const dy = t.clientY - lastSingle.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) didDrag = true;
      view.panX += dx;
      view.panY += dy;
      lastSingle = { x: t.clientX, y: t.clientY };
      render();
    } else if (e.touches.length === 2 && pinchDist > 0 && pinchAnchor) {
      const d = dist(e.touches[0], e.touches[1]);
      const factor = d / pinchDist;
      const minZoom = Math.min(canvas.width / MAP_W, canvas.height / MAP_H) * 0.6;
      const newZoom = Math.max(minZoom, Math.min(10, pinchZoom * factor));
      view.zoom = newZoom;
      // Keep the anchor map-point fixed under the (possibly shifted) midpoint.
      const mid = pinchCenter(e);
      view.panX = mid.x - pinchAnchor.mapX * newZoom;
      view.panY = mid.y - pinchAnchor.mapY * newZoom;
      didDrag = true;
      render();
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    // If single quick tap (no drag, < 250ms), simulate a click.
    if (touchStart && !didDrag && e.changedTouches.length === 1) {
      const dt = Date.now() - touchStart.t;
      if (dt < 250) {
        const t = e.changedTouches[0];
        const click = new MouseEvent("click", {
          bubbles: true, cancelable: true,
          clientX: t.clientX, clientY: t.clientY,
          button: 0,
        });
        canvas.dispatchEvent(click);
      }
    }
    if (e.touches.length === 0) { lastSingle = null; pinchDist = 0; pinchAnchor = null; }
    touchStart = null;
  });
})();

function init() {
  applyMobileLayout();
  window.addEventListener("resize", () => { applyMobileLayout(); setupCanvas(); render(); });
  // Also re-fit on orientation change (mobile/iPad rotation).
  window.addEventListener("orientationchange", () => {
    applyMobileLayout();
    setTimeout(() => { setupCanvas(); render(); }, 100);
  });
  setupCanvas();
  // On mobile, the layout box may not be fully measured until the next
  // animation frame after applyMobileLayout adds the class. Re-run
  // setupCanvas a frame later to catch the proper map-wrap dimensions.
  requestAnimationFrame(() => { setupCanvas(); render(); });
  // Initialize an empty ownership grid so accessors don't crash before the
  // HOI4 province data loads. spawnHistoricalCivs runs inside loadProvinceGrid
  // once the map is ready.
  initOwnership();
  render();
  updateUI();
  setSpeed(0);                // start paused
  state.lastTickAt = performance.now();
  requestAnimationFrame(gameLoop);
  // Async load of the HOI4 province grid + biome MAP. Game is gated behind
  // this - the loading overlay covers the screen until it finishes.
  loadProvinceGrid();
}

init();
