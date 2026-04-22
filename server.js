// ============================================================
//  XP + Medal Middleware API  (Node.js + Express + MongoDB)
// ============================================================

require("dotenv").config();
const express  = require("express");
const noblox   = require("noblox.js");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());

// ── Config
const SECRET      = process.env.SECRET;
const COOKIE      = process.env.ROBLOX_COOKIE;
const GROUP_ID    = Number(process.env.GROUP_ID);
const MONGO_URL   = process.env.MONGO_URL;

// ── MongoDB Schemas
const playerSchema = new mongoose.Schema({
  userId:  { type: String, required: true, unique: true },
  xp:      { type: Number, default: 0 },
  medals:  { type: [String], default: [] },
});

const Player = mongoose.model("Player", playerSchema);

// ── Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("[MongoDB] Connected!");
  } catch (err) {
    console.error("[MongoDB] Connection failed:", err.message);
  }
}

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

// ── Helper: get or create player
async function getOrCreatePlayer(userId) {
  let player = await Player.findOne({ userId: String(userId) });
  if (!player) {
    player = await Player.create({ userId: String(userId) });
  }
  return player;
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

  const player = await getOrCreatePlayer(userId);
  player.xp = Number(xp);
  await player.save();

  console.log(`[XP] (test) User ${userId} → ${xp} XP`);
  res.json({ ok: true, userId, xp: Number(xp) });
});

// POST /api/xp-update  (Roblox)
app.post("/api/xp-update", async (req, res) => {
  const { userId, xp, rankId } = req.body;
  if (!userId || xp === undefined) return res.status(400).json({ error: "Missing userId or xp" });

  const player = await getOrCreatePlayer(userId);
  player.xp = Number(xp);
  await player.save();

  console.log(`[XP] User ${userId} → ${xp} XP (saved to MongoDB)`);

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
app.get("/api/xp", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const player = await Player.findOne({ userId: String(userId) });
  const xp     = player ? player.xp : null;
  const tier   = xp !== null ? getRankForXp(xp) : null;

  res.json({ userId, xp, tier });
});

// ────────────────────────────────────────────────────────────
//  MEDAL ROUTES
// ────────────────────────────────────────────────────────────

// GET /api/medals
app.get("/api/medals", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const player = await Player.findOne({ userId: String(userId) });
  res.json({ userId, medals: player ? player.medals : [] });
});

// POST /api/medals/award
app.post("/api/medals/award", async (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  if (!ALL_MEDALS.includes(medal)) {
    return res.status(400).json({ error: `Unknown medal: ${medal}` });
  }

  const player = await getOrCreatePlayer(userId);

  if (player.medals.includes(medal)) {
    return res.status(400).json({ error: "Player already has this medal" });
  }

  player.medals.push(medal);
  await player.save();

  console.log(`[Medal] Awarded "${medal}" to user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// POST /api/medals/revoke
app.post("/api/medals/revoke", async (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  const player = await Player.findOne({ userId: String(userId) });
  if (!player) return res.status(400).json({ error: "Player has no medals" });

  const idx = player.medals.indexOf(medal);
  if (idx === -1) return res.status(400).json({ error: "Player does not have this medal" });

  player.medals.splice(idx, 1);
  await player.save();

  console.log(`[Medal] Revoked "${medal}" from user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// GET /health
app.get("/health", async (_req, res) => {
  const count = await Player.countDocuments();
  res.json({ ok: true, players: count, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected" });
});

// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB();
  await init();
  app.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
  });
})();
