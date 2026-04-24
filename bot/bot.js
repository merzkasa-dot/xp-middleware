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
const GUILD_ID       = "1430334268701282360";
const MEDAL_WEBHOOK  = "https://discord.com/api/webhooks/1495502633853779990/AniBufk_HWlS0kDhpGiuD654bcKSxLEYb7w_XQxB0kzW4wcsQvZD4TPCEaKuu2Fuf7zI";

// ── Roblox group + gamepass config
const ROBLOX_GROUP_ID   = process.env.ROBLOX_GROUP_ID?.replace(/^"|"$/g, "");  // Add to .env
const GAMEPASS_ID       = "1800470428";
const RANK_BOOSTER      = 1;   // Rank for server boosters
const RANK_GAMEPASS     = 6;   // Rank for gamepass owners (also wins if both)

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

const MEDAL_INFO = {
  "Hero of the Soviet Union":                              "The highest honorary title — awarded for heroic feats in service of the Soviet state.",
  "For 'Impeccable Service First Class'":                  "Awarded for long and distinguished service — First Class, the highest tier.",
  "People's Architect of the USSR":                        "Recognises outstanding contributions to architecture and construction efforts.",
  "Order of 'Victory'":                                    "One of the rarest orders — given only for decisive military success.",
  "Order of the 'Red Banner'":                             "Awarded for exceptional bravery and courage in the field.",
  "For 'Impeccable Service Second Class'":                 "Awarded for long and distinguished service — Second Class.",
  "For 'Impeccable Service Third Class'":                  "Awarded for long and distinguished service — Third Class, entry tier.",
  "Recognition from Staff team":                           "A personal commendation issued directly by the Staff team for notable conduct.",
  "Marshal's Star":                                        "Exclusive to the highest-ranking commanders — a symbol of supreme authority.",
  "For 'Distinction in Military Service First Class'":     "Awarded for excellence in military duties — First Class.",
  "People's Teacher of the USSR":                          "Recognises outstanding contributions to education and training of personnel.",
  "Order of the 'Red Star'":                               "Awarded for significant contributions to the defence of the state.",
  "Order of 'Alexander Nevsky'":                           "Awarded to commanders who demonstrate skilful and brave leadership.",
  "Order of 'Defenders of Moscow'":                        "Honours those who participated in the defence of Moscow.",
  "For 'Distinction in Military Service 2nd Class'":       "Awarded for excellence in military duties — Second Class.",
  "For 'Distinction in Guarding the State Border of the USSR'": "Recognises distinguished service in protecting the state border.",
  "Veteran of the Armed Forces of the USSR":               "Awarded to long-serving members of the Armed Forces.",
  "For 'Courage'":                                         "Awarded for acts of personal courage under dangerous conditions.",
  "For 'Battle Merit'":                                    "Recognises skillful actions that contributed to success in combat.",
  "Committee's Pride":                                     "Awarded by the Committee to those who bring exceptional honour to the group.",
  "Order of 'Friendship of Peoples'":                      "Awarded for strengthening unity, cooperation, and relations between peoples.",
};

const XP_TIPS = [
  "🎮 Play sessions in-game — you earn XP for active participation.",
  "📋 Attend hosted events and trainings for bonus XP.",
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

  if (/^\d+$/.test(input)) {
    try {
      const res  = await fetch(`https://users.roblox.com/v1/users/${input}`);
      const data = await res.json();
      if (data.id) return { userId: String(data.id), username: data.name };
    } catch {}
    return { userId: input, username: `User ${input}` };
  }

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

  return null;
}

// ── Check if a Roblox user owns a gamepass
async function checkGamepass(userId, gamepassId) {
  try {
    const res = await fetch(
      `https://inventory.roblox.com/v1/users/${userId}/items/GamePass/${gamepassId}`
    );
    const data = await res.json();
    return data.data && data.data.length > 0;
  } catch {
    return false;
  }
}

// ── Slash commands
const commands = [
  new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Check a player's XP and rank")
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
    .setName("medallist")
    .setDescription("View all available medals and their descriptions"),

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

  // ── NEW: /verifyari
  new SlashCommandBuilder()
    .setName("verifyari")
    .setDescription("Verify your Roblox account to join the Aristocracy group")
    .addStringOption(opt =>
      opt.setName("roblox_username").setDescription("Your Roblox username or user ID").setRequired(true)
    ),

].map(cmd => cmd.toJSON());

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("[Bot] Slash commands registered globally.");
  } catch (err) {
    console.error("[Bot] Failed to register commands:", err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,   // Needed to fetch member/boost info
  ]
});

client.once("ready", () => {
  console.log(`[Bot] Logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  // /medallist — no player needed
  if (interaction.commandName === "medallist") {
    await interaction.deferReply();

    const medalLines = ALL_MEDALS.map((medal, i) => {
      const desc = MEDAL_INFO[medal] ?? "No description available.";
      return `**${i + 1}. ${medal}**\n╰ ${desc}`;
    });

    const half    = Math.ceil(medalLines.length / 2);
    const partOne = medalLines.slice(0, half).join("\n\n");
    const partTwo = medalLines.slice(half).join("\n\n");

    const embedOne = new EmbedBuilder()
      .setTitle("🎖️ All Available Medals — Part 1")
      .setColor(0xf1c40f)
      .setDescription(partOne);

    const embedTwo = new EmbedBuilder()
      .setTitle("🎖️ All Available Medals — Part 2")
      .setColor(0xf1c40f)
      .setDescription(partTwo)
      .setFooter({ text: `${ALL_MEDALS.length} medals total` })
      .setTimestamp();

    return interaction.editReply({ embeds: [embedOne, embedTwo] });
  }

  // ── /verifyari
  if (interaction.commandName === "verifyari") {
    await interaction.deferReply({ ephemeral: true }); // Only visible to the user

    const playerInput = interaction.options.getString("roblox_username")?.trim();

    // 1. Resolve Roblox user
    const robloxUser = await resolveRobloxUser(playerInput);
    if (!robloxUser) {
      return interaction.editReply(`❌ Could not find Roblox user \`${playerInput}\`. Check your username and try again.`);
    }
    const { userId, username } = robloxUser;

    // 2. Check if the Discord member is a server booster
    let guild;
    try {
      guild = await client.guilds.fetch(GUILD_ID);
      await guild.members.fetch(); // Cache all members so premiumSince is available
    } catch (err) {
      console.error("[verifyari] Failed to fetch guild/members:", err);
      return interaction.editReply("❌ Failed to check your server membership. Please try again later.");
    }

    const discordMember = guild.members.cache.get(interaction.user.id);
    if (!discordMember) {
      return interaction.editReply("❌ Could not find your Discord account in this server.");
    }

    const isBooster   = !!discordMember.premiumSince; // truthy if they're boosting
    const hasGamepass = await checkGamepass(userId, GAMEPASS_ID);

    // 3. Deny if they qualify for neither
    if (!isBooster && !hasGamepass) {
      const embed = new EmbedBuilder()
        .setTitle("❌ Verification Failed")
        .setColor(0xe74c3c)
        .setDescription(
          "You don't meet the requirements to join the Aristocracy group.\n\n" +
          "**To qualify, you must have at least one of:**\n" +
          `• 🚀 Be a server booster in this Discord\n` +
          `• 🎮 Own the required Roblox gamepass`
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // 4. Determine rank (gamepass beats booster-only)
    const rankToSet = hasGamepass ? RANK_GAMEPASS : RANK_BOOSTER;
    const reasons   = [];
    if (isBooster)   reasons.push("🚀 Server Booster");
    if (hasGamepass) reasons.push("🎮 Gamepass Owner");

    // 5. Accept into group + set rank via middleware
    try {
      // Accept into group
      const acceptRes = await fetch(`${MIDDLEWARE_URL}/api/group/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupId: ROBLOX_GROUP_ID,
          secret: SECRET,
        }),
      });

      // Set rank
      const rankRes = await fetch(`${MIDDLEWARE_URL}/api/group/setrank`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          groupId: ROBLOX_GROUP_ID,
          rankId: rankToSet,
          secret: SECRET,
        }),
      });

      if (!rankRes.ok) {
        const errData = await rankRes.json().catch(() => ({}));
        console.error("[verifyari] Rank set failed:", errData);
        return interaction.editReply("❌ Verified, but failed to set your rank. Please contact an admin.");
      }
    } catch (err) {
      console.error("[verifyari] Middleware error:", err);
      return interaction.editReply(`❌ Error contacting the group server: \`${err.message}\``);
    }

    // 6. Success embed
    const embed = new EmbedBuilder()
  .setTitle("✅ Verification Successful!")
  .setColor(0x2ecc71)
  .addFields(
    { name: "Roblox Username", value: username,            inline: true },
    { name: "Rank Assigned",   value: `Rank ${rankToSet}`, inline: true },
    { name: "Qualified By",    value: reasons.join("\n"),  inline: false },
  )
  .setDescription(
    "You have been accepted into the **Aristocracy** group and ranked accordingly.\n\n" +
    "📋 **Request to join here:**\n" +
    "https://www.roblox.com/communities/47900796/SMS-Aristocracy#!/about"
  )
  .setTimestamp();

    // 7. Log to webhook
    await sendWebhookLog(
      `✅ **Aristocracy Verify**\n` +
      `**Discord:** <@${interaction.user.id}>\n` +
      `**Roblox:** ${username} (\`${userId}\`)\n` +
      `**Rank:** ${rankToSet}\n` +
      `**Reason:** ${reasons.join(", ")}`
    );

    return;
  }

  // ── All other commands need a player argument
  await interaction.deferReply();

  const playerInput = interaction.options.getString("player")?.trim();
  const member      = interaction.member;

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
          { name: "💡 How to earn XP", value: XP_TIPS.join("\n"), inline: false },
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
