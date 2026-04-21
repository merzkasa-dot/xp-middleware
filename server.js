// ============================================================
//  XP Middleware API  (Node.js + Express + noblox.js)
// ============================================================

require("dotenv").config();
const express  = require("express");
const noblox   = require("noblox.js");
const fs       = require("fs");
const path     = require("path");

const app  = express();
app.use(express.json());

// ── File-based XP persistence
const DATA_FILE = path.join(__dirname, "xp_data.json");

function loadXpData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8");
      return new Map(Object.entries(JSON.parse(raw)));
    }
  } catch (err) {
    console.warn("[XP] Could not load xp_data.json:", err.message);
  }
  return new Map();
}

function saveXpData() {
  try {
    const obj = Object.fromEntries(xpStore);
    fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.warn("[XP] Could not save xp_data.json:", err.message);
  }
}

const xpStore = loadXpData();
console.log(`[XP] Loaded ${xpStore.size} players from xp_data.json`);

// ── Config from .env
const SECRET   = process.env.SECRET;
const COOKIE   = process.env.ROBLOX_COOKIE;
const GROUP_ID = Number(process.env.GROUP_ID);

// ── Rank thresholds — mirror in Roblox script and bot!
const RANK_THRESHOLDS = [
	{ xp : 0,   rankId : 1,  label : "Initiate" },
	{ xp : 2,   rankId : 2,  label : "Private" },
	{ xp : 5,   rankId : 3,  label : "Senior Private" },
	{ xp : 10,  rankId : 4,  label : "Junior Sergeant" },

	{ xp : 20,  rankId : 5,  label : "Sergeant" },
	{ xp : 30,  rankId : 6,  label : "Senior Sergeant" },
	{ xp : 45,  rankId : 7,  label : "Staff Sergeant" },
	{ xp : 60,  rankId : 8,  label : "Sergeant Major" },

	{ xp : 105, rankId : 9,  label : "Warrant Officer" },
	{ xp : 135, rankId : 10, label : "Senior Warrant Officer" },
	{ xp : 170, rankId : 11, label : "Lieutenant" },
	{ xp : 210, rankId : 12, label : "Captain" }
];

function getRankForXp(xp) {
  let best = RANK_THRESHOLDS[0];
  for (const tier of RANK_THRESHOLDS) {
    if (xp >= tier.xp) best = tier;
  }
  return best;
}

async function init() {
  try {
    await noblox.setCookie(COOKIE);
    const me = await noblox.getCurrentUser();
    console.log(`[noblox] Logged in as ${me.UserName}`);
  } catch (err) {
    console.error("[noblox] Login failed:", err.message);
    console.error("Auto-ranking will not work until the cookie is fixed.");
  }
}

// ────────────────────────────────────────────────────────────
//  ROUTES
// ────────────────────────────────────────────────────────────

app.use("/api", (req, res, next) => {
  const secret = req.body?.secret || req.query?.secret;
  if (secret !== SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
});

// GET /api/xp-update  (browser/test only)
app.get("/api/xp-update", (req, res) => {
  const { userId, xp } = req.query;
  if (!userId || xp === undefined) {
    return res.status(400).json({ error: "Missing userId or xp" });
  }
  xpStore.set(String(userId), Number(xp));
  saveXpData();
  console.log(`[XP] (test) User ${userId} → ${xp} XP`);
  res.json({ ok: true, userId, xp: Number(xp) });
});

// POST /api/xp-update  (called by Roblox)
app.post("/api/xp-update", async (req, res) => {
  const { userId, xp, rankId } = req.body;

  if (!userId || xp === undefined) {
    return res.status(400).json({ error: "Missing userId or xp" });
  }

  xpStore.set(String(userId), Number(xp));
  saveXpData();
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

// GET /api/xp  (called by Discord bot)
app.get("/api/xp", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const xp   = xpStore.get(String(userId)) ?? null;
  const tier = xp !== null ? getRankForXp(xp) : null;

  res.json({ userId, xp, tier });
});

// GET /health
app.get("/health", (_req, res) => res.json({ ok: true, players: xpStore.size }));

// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  await init();
});


