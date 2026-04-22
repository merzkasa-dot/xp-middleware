require("dotenv").config();
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder
} = require("discord.js");

const fetch = globalThis.fetch ?? require("node-fetch");

const DISCORD_TOKEN  = process.env.DISCORD_TOKEN?.replace(/^"|"$/g, "");
const CLIENT_ID      = process.env.CLIENT_ID?.replace(/^"|"$/g, "");
const MIDDLEWARE_URL = process.env.MIDDLEWARE_URL?.replace(/^"|"$/g, "");
const SECRET         = process.env.SECRET?.replace(/^"|"$/g, "");
const GUILD_ID       = "1482833669558239242";
const MEDAL_WEBHOOK  = "https://discord.com/api/webhooks/1495502633853779990/AniBufk_HWlS0kDhpGiuD654bcKSxLEYb7w_XQxB0kzW4wcsQvZD4TPCEaKuu2Fuf7zI";

const MEDAL_ROLES = [
"1475283604648104008",
"1485763953438097438",
"1477080531790204989",
];

const XP_ROLES = [
  "1475283604648104008",
  "1485763953438097438",
  "1477080531790204989",
  "1492527940842557710",
  "1486082738225414245",
  "1486082737440952520",
  "1486082736853614634",
  "1486082736467873983",
  "1486082735381413978",
];

function hasRole(member, roleIds) {
  return roleIds.some(id => member.roles.cache.has(id));
}

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

const RANK_THRESHOLDS = [
  { xp: 0,   rankId: 1,  label: "Initiate",               color: 0x95a5a6 },
  { xp: 5,   rankId: 2,  label: "Private",                color: 0x3498db },
  { xp: 12,  rankId: 3,  label: "Senior Private",         color: 0x2ecc71 },
  { xp: 20,  rankId: 4,  label: "Junior Sergeant",        color: 0xf39c12 },
  { xp: 30,  rankId: 5,  label: "Sergeant",               color: 0xe67e22 },
  { xp: 45,  rankId: 6,  label: "Senior Sergeant",        color: 0xe74c3c },
  { xp: 60,  rankId: 7,  label: "Staff Sergeant",         color: 0x9b59b6 },
  { xp: 80,  rankId: 8,  label: "Sergeant Major",         color: 0x1abc9c },
  { xp: 105, rankId: 9,  label: "Warrant Officer",        color: 0xf1c40f },
  { xp: 135, rankId: 10, label: "Senior Warrant Officer", color: 0xe91e63 },
  { xp: 170, rankId: 11, label: "Lieutenant",             color: 0x00bcd4 },
  { xp: 210, rankId: 12, label: "Captain",                color: 0xff5722 },
];

function getRankForXp(xp) {
  let best = RANK_THRESHOLDS[0];
  for (const tier of RANK_THRESHOLDS) {
    if (xp >= tier.xp) best = tier;
  }
  return best;
}

function getNextRank(xp) {
  for (const tier of RANK_THRESHOLDS) {
    if (xp < tier.xp) return tier;
  }
  return null;
}

function xpBar(xp) {
  const next = getNextRank(xp);
  if (!next) return "▰▰▰▰▰▰▰▰▰▰ MAX RANK";
  const prev  = getRankForXp(xp);
  const range = next.xp - prev.xp;
  const prog  = xp - prev.xp;
  const pct   = Math.min(Math.floor((prog / range) * 10), 10);
  return "▰".repeat(pct) + "▱".repeat(10 - pct) + ` ${xp}/${next.xp}`;
}

async function sendWebhookLog(msg) {
  try {
    await fetch(MEDAL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Medal Logger", content: msg }),
    });
  } catch (err) {
    console.warn("[Webhook] Failed:", err.message);
  }
}

// ── Resolves Roblox username OR numeric ID → { userId, username }
async function resolveRobloxUser(input) {
  input = input.trim();

  // Numeric ID
  if (/^\d+$/.test(input)) {
    try {
      const res  = await fetch(`https://users.roblox.com/v1/users/${input}`);
      const data = await res.json();
      if (data.id) return { userId: String(data.id), username: data.name };
    } catch {}
    return { userId: input, username: `User ${input}` };
  }

  // Username lookup
  try {
    const res = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [input], excludeBannedUsers: false }),
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const user = data.data[0];
      return { userId: String(user.id), username: user.name };
    }
  } catch {}

  return null; // not found
}

// ── Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Check a player's XP")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("addxp")
    .setDescription("Add XP to a player")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("Amount of XP to add").setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("removexp")
    .setDescription("Remove XP from a player")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName("amount").setDescription("Amount of XP to remove").setRequired(true).setMinValue(1)
    ),

  new SlashCommandBuilder()
    .setName("medals")
    .setDescription("View a player's medals")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("award")
    .setDescription("Award a medal to a player")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("medal").setDescription("Medal to award").setRequired(true)
        .addChoices(...ALL_MEDALS.map(m => ({ name: m, value: m })))
    ),

  new SlashCommandBuilder()
    .setName("revoke")
    .setDescription("Revoke a medal from a player")
    .addStringOption(opt =>
      opt.setName("player").setDescription("Roblox username or user ID").setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName("medal").setDescription("Medal to revoke").setRequired(true)
        .addChoices(...ALL_MEDALS.map(m => ({ name: m, value: m })))
    ),
].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] });
    console.log("[Bot] Cleared guild commands.");
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("[Bot] Slash commands registered globally.");
  } catch (err) {
    console.error("[Bot] Failed to register commands:", err);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await interaction.deferReply();

  const playerInput = interaction.options.getString("player")?.trim();
  const member      = interaction.member;

  // Resolve player
  const robloxUser = await resolveRobloxUser(playerInput);
  if (!robloxUser) {
    return interaction.editReply(`❌ Could not find Roblox user \`${playerInput}\`. Check the username or ID and try again.`);
  }

  const { userId, username } = robloxUser;

  // ── /xp
  if (interaction.commandName === "xp") {
    try {
      const res  = await fetch(`${MIDDLEWARE_URL}/api/xp?userId=${userId}&secret=${SECRET}`);
      if (!res.ok) return interaction.editReply("❌ Could not reach the XP server.");
      const data = await res.json();

      if (data.xp === null || data.xp === undefined) {
        return interaction.editReply(`❌ No XP data found for **${username}**. They may not have joined the game yet.`);
      }

      const tier = getRankForXp(data.xp);
      const next = getNextRank(data.xp);
      const bar  = xpBar(data.xp);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${username}'s XP`)
        .setColor(tier.color)
        .addFields(
          { name: "XP",       value: `**${data.xp}**`,    inline: true },
          { name: "Rank",     value: `**${tier.label}**`, inline: true },
          { name: "Progress", value: bar,                  inline: false },
        )
        .setFooter({ text: next ? `Next rank: ${next.label} at ${next.xp} XP` : "🏆 Maximum rank achieved!" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }

  // ── /addxp
  if (interaction.commandName === "addxp") {
    if (!hasRole(member, XP_ROLES)) {
      return interaction.editReply("❌ You don't have permission to add XP.");
    }
    const amount = interaction.options.getInteger("amount");
    try {
      const res       = await fetch(`${MIDDLEWARE_URL}/api/xp?userId=${userId}&secret=${SECRET}`);
      const data      = await res.json();
      const currentXp = data.xp ?? 0;
      const newXp     = currentXp + amount;

      const updateRes = await fetch(`${MIDDLEWARE_URL}/api/xp-update?userId=${userId}&xp=${newXp}&secret=${SECRET}`);
      if (!updateRes.ok) return interaction.editReply("❌ Failed to update XP.");

      const tier = getRankForXp(newXp);

      const embed = new EmbedBuilder()
        .setTitle("✅ XP Added")
        .setColor(0x2ecc71)
        .addFields(
          { name: "Player",  value: username,                      inline: true },
          { name: "Added",   value: `+${amount} XP`,               inline: true },
          { name: "Total",   value: `${newXp} XP`,                 inline: true },
          { name: "Rank",    value: tier.label,                     inline: true },
          { name: "By",      value: `<@${interaction.user.id}>`,   inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }

  // ── /removexp
  if (interaction.commandName === "removexp") {
    if (!hasRole(member, XP_ROLES)) {
      return interaction.editReply("❌ You don't have permission to remove XP.");
    }
    const amount = interaction.options.getInteger("amount");
    try {
      const res       = await fetch(`${MIDDLEWARE_URL}/api/xp?userId=${userId}&secret=${SECRET}`);
      const data      = await res.json();
      const currentXp = data.xp ?? 0;
      const newXp     = Math.max(0, currentXp - amount);

      const updateRes = await fetch(`${MIDDLEWARE_URL}/api/xp-update?userId=${userId}&xp=${newXp}&secret=${SECRET}`);
      if (!updateRes.ok) return interaction.editReply("❌ Failed to update XP.");

      const tier = getRankForXp(newXp);

      const embed = new EmbedBuilder()
        .setTitle("❌ XP Removed")
        .setColor(0xe74c3c)
        .addFields(
          { name: "Player",  value: username,                      inline: true },
          { name: "Removed", value: `-${amount} XP`,               inline: true },
          { name: "Total",   value: `${newXp} XP`,                 inline: true },
          { name: "Rank",    value: tier.label,                     inline: true },
          { name: "By",      value: `<@${interaction.user.id}>`,   inline: true },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }

  // ── /medals
  if (interaction.commandName === "medals") {
    try {
      const res  = await fetch(`${MIDDLEWARE_URL}/api/medals?userId=${userId}&secret=${SECRET}`);
      if (!res.ok) return interaction.editReply("❌ Could not reach the medals server.");
      const data = await res.json();

      if (!data.medals || data.medals.length === 0) {
        return interaction.editReply(`🎖️ **${username}** has no medals yet.`);
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎖️ ${username}'s Medals`)
        .setColor(0xf1c40f)
        .setDescription(data.medals.map((m, i) => `${i + 1}. ${m}`).join("\n"))
        .setFooter({ text: `${data.medals.length} medal(s) total` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }

  // ── /award
  if (interaction.commandName === "award") {
    if (!hasRole(member, MEDAL_ROLES)) {
      return interaction.editReply("❌ You don't have permission to award medals.");
    }
    const medal = interaction.options.getString("medal");
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/api/medals/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, medal, secret: SECRET }),
      });
      const data = await res.json();
      if (!res.ok) return interaction.editReply(`❌ ${data.error}`);

      const embed = new EmbedBuilder()
        .setTitle("🎖️ Medal Awarded!")
        .setColor(0x2ecc71)
        .addFields(
          { name: "Player", value: username,                      inline: true },
          { name: "Medal",  value: medal,                         inline: true },
          { name: "By",     value: `<@${interaction.user.id}>`,   inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendWebhookLog(`🎖️ **Medal Awarded**\n**Player:** ${username} (\`${userId}\`)\n**Medal:** ${medal}\n**By:** <@${interaction.user.id}>`);
      return;
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }

  // ── /revoke
  if (interaction.commandName === "revoke") {
    if (!hasRole(member, MEDAL_ROLES)) {
      return interaction.editReply("❌ You don't have permission to revoke medals.");
    }
    const medal = interaction.options.getString("medal");
    try {
      const res = await fetch(`${MIDDLEWARE_URL}/api/medals/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, medal, secret: SECRET }),
      });
      const data = await res.json();
      if (!res.ok) return interaction.editReply(`❌ ${data.error}`);

      const embed = new EmbedBuilder()
        .setTitle("🎖️ Medal Revoked")
        .setColor(0xe74c3c)
        .addFields(
          { name: "Player", value: username,                      inline: true },
          { name: "Medal",  value: medal,                         inline: true },
          { name: "By",     value: `<@${interaction.user.id}>`,   inline: true },
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      await sendWebhookLog(`🚫 **Medal Revoked**\n**Player:** ${username} (\`${userId}\`)\n**Medal:** ${medal}\n**By:** <@${interaction.user.id}>`);
      return;
    } catch (err) {
      return interaction.editReply(`❌ Error: \`${err.message}\``);
    }
  }
});

(async () => {
  await registerCommands();
  client.login(DISCORD_TOKEN);
})();