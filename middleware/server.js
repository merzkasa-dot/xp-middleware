// ============================================================
//  XP + Medal Middleware API  (Node.js + Express + noblox.js)
// ============================================================

require("dotenv").config();
const express  = require("express");
const noblox   = require("noblox.js");
const mongoose = require("mongoose");

const app  = express();
app.use(express.json());

// ── Config
const SECRET   = process.env.SECRET?.replace(/^"|"$/g, "");
const COOKIE   = process.env.ROBLOX_COOKIE?.replace(/^"|"$/g, "");
const GROUP_ID = Number(process.env.GROUP_ID?.replace(/^"|"$/g, ""));
const MONGO_URL = process.env.MONGO_URL?.replace(/^"|"$/g, "");

console.log("[DEBUG] Cookie length:", COOKIE?.length);
console.log("[DEBUG] Cookie preview:", COOKIE?.slice(0, 30));
console.log("[DEBUG] Group ID:", GROUP_ID);
console.log("[DEBUG] Secret set:", !!SECRET);

// ── MongoDB Schemas
const playerSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  xp:     { type: Number, default: 0 },
});

const medalSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  medals: { type: [String], default: [] },
});

const Player = mongoose.model("Player", playerSchema);
const Medal  = mongoose.model("Medal",  medalSchema);

// ── MongoDB connect
async function connectMongo() {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("[MongoDB] Connected!");
  } catch (err) {
    console.error("[MongoDB] Connection failed:", err.message);
  }
}

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
  { xp: 0,   rankId: 1,  label: "Initiate"               },
  { xp: 5,   rankId: 2,  label: "Private"                },
  { xp: 12,  rankId: 3,  label: "Senior Private"         },
  { xp: 20,  rankId: 4,  label: "Junior Sergeant"        },
  { xp: 30,  rankId: 5,  label: "Sergeant"               },
  { xp: 45,  rankId: 6,  label: "Senior Sergeant"        },
  { xp: 60,  rankId: 7,  label: "Staff Sergeant"         },
  { xp: 80,  rankId: 8,  label: "Sergeant Major"         },
  { xp: 105, rankId: 9,  label: "Warrant Officer"        },
  { xp: 135, rankId: 10, label: "Senior Warrant Officer" },
  { xp: 170, rankId: 11, label: "Lieutenant"             },
  { xp: 210, rankId: 12, label: "Captain"                },
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
    console.log("[noblox] Cookie starts with:", COOKIE?.slice(0, 30));
    console.log("[noblox] Cookie length:", COOKIE?.length);
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

// GET /api/xp-update  (Discord bot)
app.get("/api/xp-update", async (req, res) => {
  const { userId, xp } = req.query;
  if (!userId || xp === undefined) return res.status(400).json({ error: "Missing userId or xp" });

  const newXp = Number(xp);

  await Player.findOneAndUpdate(
    { userId: String(userId) },
    { xp: newXp },
    { upsert: true, new: true }
  );

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

  await Player.findOneAndUpdate(
    { userId: String(userId) },
    { xp: Number(xp) },
    { upsert: true, new: true }
  );
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

// POST /api/group/accept
app.post("/api/group/accept", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    await noblox.acceptJoinRequest(GROUP_ID, Number(userId));
    console.log(`[Group] Accepted join request for user ${userId}`);
    res.json({ ok: true, userId });
  } catch (err) {
    console.warn(`[Group] Could not accept user ${userId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/group/setrank
app.post("/api/group/setrank", async (req, res) => {
  const { userId, rankId } = req.body;
  if (!userId || !rankId) return res.status(400).json({ error: "Missing userId or rankId" });

  try {
    await noblox.setRank(GROUP_ID, Number(userId), Number(rankId));
    console.log(`[Group] Set rank ${rankId} for user ${userId}`);
    res.json({ ok: true, userId, rankId });
  } catch (err) {
    console.warn(`[Group] Could not set rank for ${userId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
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

  const record = await Medal.findOne({ userId: String(userId) });
  res.json({ userId, medals: record ? record.medals : [] });
});

// POST /api/medals/award
app.post("/api/medals/award", async (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  if (!ALL_MEDALS.includes(medal)) {
    return res.status(400).json({ error: `Unknown medal: ${medal}` });
  }

  let record = await Medal.findOne({ userId: String(userId) });
  if (!record) record = new Medal({ userId: String(userId), medals: [] });

  if (record.medals.includes(medal)) {
    return res.status(400).json({ error: "Player already has this medal" });
  }

  record.medals.push(medal);
  await record.save();
  console.log(`[Medal] Awarded "${medal}" to user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// POST /api/medals/revoke
app.post("/api/medals/revoke", async (req, res) => {
  const { userId, medal } = req.body;
  if (!userId || !medal) return res.status(400).json({ error: "Missing userId or medal" });

  const record = await Medal.findOne({ userId: String(userId) });
  if (!record || !record.medals.includes(medal)) {
    return res.status(400).json({ error: "Player does not have this medal" });
  }

  record.medals = record.medals.filter(m => m !== medal);
  await record.save();
  console.log(`[Medal] Revoked "${medal}" from user ${userId}`);
  res.json({ ok: true, userId, medal });
});

// GET /health
app.get("/health", async (_req, res) => {
  const count = await Player.countDocuments();
  res.json({ ok: true, players: count });
});

// ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`[Server] Listening on port ${PORT}`);
  await connectMongo();
  await init();
});
