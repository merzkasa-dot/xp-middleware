// ============================================================
//  XP + Medal Middleware API  (Node.js + Express + noblox.js)
// ============================================================

require("dotenv").config();
const express  = require("express");
const noblox   = require("noblox.js");
const fs       = require("fs");
const path     = require("path");

const app  = express();
app.use(express.json());

// ── File persistence
const XP_FILE     = path.join(__dirname, "xp_data.json");
const MEDAL_FILE  = path.join(__dirname, "medal_data.json");

function loadJson(file) {
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch (err) {
    console.warn(`[Data] Could not load ${file}:`, err.message);
  }
  return {};
}

function saveJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    console.warn(`[Data] Could not save ${file}:`, err.message);
  }
}

// XP store (Map)
const xpRaw   = loadJson(XP_FILE);
const xpStore = new Map(Object.entries(xpRaw));
console.log(`[XP] Loaded ${xpStore.size} players from xp_data.json`);

// Medal store: { [userId]: ["Medal1", "Medal2", ...] }
const medalStore = loadJson(MEDAL_FILE);
console.log(`[Medals] Loaded ${Object.keys(medalStore).length} players from medal_data.json`);

function saveXp()     { saveJson(XP_FILE,    Object.fromEntries(xpStore)); }
function saveMedals() { saveJson(MEDAL_FILE, medalStore); }

// ── Config
const SECRET   = process.env.SECRET?.replace(/^"|"$/g, "");
const COOKIE   = process.env.ROBLOX_COOKIE?.replace(/^"|"$/g, "");
const GROUP_ID = Number(process.env.GROUP_ID?.replace(/^"|"$/g, ""));
const MONGO_URL = process.env.MONGO_URL?.replace(/^"|"$/g, "");

// ── All available medals
const ALL_MEDALS = [
  "Hero of the Soviet Union",
  "For 'Impeccable Service First Class'",
  "People's Architect of the USSR",
  "Order of 'Victory'",
  "Order of the 'Red Banner'",
  "For 'Impeccable Service Second Class'",
  "For 'Impeccable Service Third Class'",
  "Recognition from Staff team",
  "Marshal's Star",
  "For 'Distinction in Military Service First Class'",
  "People's Teacher of the USSR",
  "Order of the 'Red Star'",
  "Order of 'Alexander Nevsky'",
  "Order of 'Defenders of Moscow'",
  "For 'Distinction in Military Service 2nd Class'",
  "For 'Distinction in Guarding the State Border of the USSR'",
  "Veteran of the Armed Forces of the USSR",
  "For 'Courage'",
  "For 'Battle Merit'",
  "Committee's Pride",
  "Order of 'Friendship of Peoples'",
];

// ── Rank thresholds
const RANK_THRESHOLDS = [
  { xp: 0,   rankId: 1,  label: "Initiate"              },
  { xp: 5,   rankId: 2,  label: "Private"               },
  { xp: 12,  rankId: 3,  label: "Senior Private"        },
  { xp: 20,  rankId: 4,  label: "Junior Sergeant"       },
  { xp: 30,  rankId: 5,  label: "Sergeant"              },
  { xp: 45,  rankId: 6,  label: "Senior Sergeant"       },
  { xp: 60,  rankId: 7,  label: "Staff Sergeant"        },
  { xp: 80,  rankId: 8,  label: "Sergeant Major"        },
  { xp: 105, rankId: 9,  label: "Warrant Officer"       },
  { xp: 135, rankId: 10, label: "Senior Warrant Officer"},
  { xp: 170, rankId: 11, label: "Lieutenant"            },
  { xp: 210, rankId: 12, label: "Captain"               },
];

function getRankForXp(xp) {
  let best = RANK_THRESHOLDS[0];
  for (const tier of RANK_THRESHOLDS) {
    if (xp >= tier.xp) best = tier;
  }
  return best;
}

// ── noblox login
async function init() {
  try {
    await noblox.setCookie(COOKIE);
    const me = await noblox.getCurrentUser();
    console.log(`[noblox] Logged in as ${me.UserName}`);
  } catch (err) {
    console.error("[noblox] Login failed:", err.message);
  }
}

// ────────────────────────────────────────────────────────────
//  SECRET CHECK
// ────────────────────────────────────────────────────────────
app.use("/api", (req, res, next) => {
  const secret = req.body?.secret || req.query?.secret;
  if (secret !== SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// ────────────────────────────────────────────────────────────
//  XP ROUTES
// ────────────────────────────────────────────────────────────

// GET /api/xp-update  (browser test)
app.get("/api/xp-update", async (req, res) => {
  const { userId, xp } = req.query;
  if (!userId || xp === undefined) return res.status(400).json({ error: "Missing userId or xp" });

  const newXp = Number(xp);
  xpStore.set(String(userId), newXp);
  saveXp();

  const tier = getRankForXp(newXp);
  try {
    const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);
    if (tier.rankId > currentRank) {
      await noblox.setRank(GROUP_ID, userId, tier.rankId);
      console.log(`[Rank] User ${userId} promoted to rank ${tier.rankId} (${tier.label})`);
    }
  } catch (err) {
    console.warn(`[Rank] Could not rank user ${userId}:`, err.message);
  }

  res.json({ ok: true, userId, xp: newXp });
});

// POST /api/xp-update  (Roblox)
app.post("/api/xp-update", async (req, res) => {
  const { userId, xp, rankId } = req.body;
  if (!userId || xp === undefined) return res.status(400).json({ error: "Missing userId or xp" });

  xpStore.set(String(userId), Number(xp));
  saveXp();
  console.log(`[XP] User ${userId} → ${xp} XP (saved)`);

  if (rankId) {
    try {
      const currentRank = await noblox.getRankInGroup(GROUP_ID, userId);
      if (rankId > currentRank) {
        await noblox.setRank(GROUP_ID, userId, rankId);
        console.log(`[Rank] User ${userId} promoted to rank ${rankId}`);
      }
    } catch (err) {
      console.warn(`[Rank] Could not rank user ${userId}:`, err.message);
    }
  }

  res.json({ ok: true });
});

// GET /api/xp
app.get("/api/xp", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const xp   = xpStore.get(String(userId)) ?? null;
  const tier = xp !== null ? getRankForXp(xp) : null;
  res.json({ userId, xp, tier });
});

// ────────────────────────────────────────────────────────────
//  MEDAL ROUTES
// ────────────────────────────────────────────────────────────

// GET /api/medals?userId=xxx  — get a player's medals
app.get("/api/medals", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  const medals = medalStore[String(userId)] || [];
  res.json({ userId, medals });
});

// POST /api/medals/award  — award a medal to a player
app.post("/api/medals/award", (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  if (!ALL_MEDALS.includes(medal)) {
    return res.status(400).json({ error: `Unknown medal: ${medal}` });
  }

  if (!medalStore[String(userId)]) medalStore[String(userId)] = [];

  if (medalStore[String(userId)].includes(medal)) {
    return res.status(400).json({ error: "Player already has this medal" });
  }

  medalStore[String(userId)].push(medal);
  saveMedals();
  console.log(`[Medal] Awarded "${medal}" to user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// POST /api/medals/revoke  — remove a medal from a player
app.post("/api/medals/revoke", (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  if (!medalStore[String(userId)]) {
    return res.status(400).json({ error: "Player has no medals" });
  }

  const idx = medalStore[String(userId)].indexOf(medal);
  if (idx === -1) return res.status(400).json({ error: "Player does not have this medal" });

  medalStore[String(userId)].splice(idx, 1);
  saveMedals();
  console.log(`[Medal] Revoked "${medal}" from user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// GET /health
app.get("/health", (_req, res) => res.json({ ok: true, players: xpStore.size }));

// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  await init();
});
