// api/interactions.js
const { verifyKey } = require('discord-interactions');
const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// --- Helper Functions ---
function getXpForLevel(level) {
  let xp = 0;
  for (let i = 1; i < level; i++) { xp += 50 * (Math.pow(i, 2) + 2); }
  return xp;
}

function calculatePacks(startLevel, targetLevel, currentXP = 0, useBBE = true) {
  let totalXp = 0;
  for (let lvl = startLevel; lvl < targetLevel; lvl++) { totalXp += 50 * (Math.pow(lvl, 2) + 2); }
  totalXp -= currentXP;
  if (totalXp < 0) totalXp = 0;

  let totalAmt = totalXp;
  let small = 0, big = 0, large = 0, maui_wowie = 0;

  if (totalAmt >= 1000000) { maui_wowie += Math.floor(totalAmt / 1000000); totalAmt %= 1000000; }
  if (totalAmt >= 500000) { large += Math.floor(totalAmt / 1000000); totalAmt %= 1000000; }
  if (totalAmt >= 250000) { big += Math.floor(totalAmt / 500000); totalAmt %= 500000; }
  if (totalAmt >= 125000) { small += Math.floor(totalAmt / 125500); totalAmt %= 125500; }
  if (totalAmt !== 0) small++;

  if (small >= 2) { small = 0; big++; }
  if (big >= 2) { big = 0; large++; }
  if (large >= 2) { large = 0; maui_wowie++; }

  let cost = (maui_wowie * 3000) + (large * 1600) + (big * 1100) + (small * 7500);
  let cost_parts = [];
  if (Math.floor(cost / 10000) > 0) cost_parts.push(`• ${Math.floor(cost / 10000)} **BGL(s)** <:Blue_Gem_Lock:1410588533529509990>`);
  if (Math.floor(cost / 100 % 100) > 0) cost_parts.push(`• ${Math.floor(cost / 100 % 100)} **DLs** <:DL:1407257577682636800>`);
  if (cost % 100 > 0) cost_parts.push(`• ${cost % 100} **WLs** <:World_Lock:1410573104975187978>`);

  return { txp: totalXp, maui_wowie_pack: maui_wowie, large_pack: large, big_pack: big, small_pack: small, cost_total: cost_parts.join("\n") };
}

function calcTime(result) {
  let minutes = (result.small_pack * 5) + (result.big_pack * 10) + (result.large_pack * 15) + (result.maui_wowie_pack * 30);
  if (minutes <= 30) return `~${minutes < 30 ? minutes : 30} minutes`;
  let hours = Math.ceil(minutes / 60);
  return `~${hours} hour${hours > 1 ? "s" : ""}`;
}

// --- Vercel Request Handler ---
const getRawBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const rawBody = await getRawBody(req);

  // 1. Verify the Request
  const isValidRequest = verifyKey(rawBody, signature, timestamp, process.env.PUBLIC_KEY);
  if (!isValidRequest) {
    console.log("❌ Bad request signature");
    return res.status(401).send('Bad request signature');
  }

  const interaction = JSON.parse(rawBody);

  // 2. Handle Mandatory Discord Ping
  if (interaction.type === 1) { // 1 = PING
    console.log("✅ Ping received! Forcing explicit Pong.");
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ type: 1 })); 
  }

  // 3. Handle Button Click -> Open Modal
  if (interaction.type === 3 && interaction.data.custom_id === "levelCalcButton") { // 3 = MESSAGE_COMPONENT
    console.log("🖱️ Button Clicked");
    const modal = new ModalBuilder().setCustomId("levelCalcModal").setTitle("Level Calculator");
    const currentLvlInput = new TextInputBuilder().setCustomId("currentLvl").setLabel("Current Level").setStyle(TextInputStyle.Short).setRequired(true);
    const currentXPInput = new TextInputBuilder().setCustomId("currentXP").setLabel("Current XP (optional)").setStyle(TextInputStyle.Short).setRequired(false);
    const targetLvlInput = new TextInputBuilder().setCustomId("targetLvl").setLabel("Target Level").setStyle(TextInputStyle.Short).setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(currentLvlInput),
      new ActionRowBuilder().addComponents(currentXPInput),
      new ActionRowBuilder().addComponents(targetLvlInput)
    );

    return res.status(200).json({ type: 9, data: modal.toJSON() }); // 9 = MODAL response
  }

  // 4. Handle Modal Submission -> Send Embed Results
  if (interaction.type === 5 && interaction.data.custom_id === "levelCalcModal") { // 5 = MODAL_SUBMIT
    console.log("📝 Modal Submitted");
    const components = interaction.data.components;
    const currentLvl = parseInt(components[0].components[0].value);
    const currentXP = parseInt(components[1].components[0].value || "0");
    const targetLvl = parseInt(components[2].components[0].value);

    const sendError = (msg) => res.status(200).json({ type: 4, data: { content: msg, flags: 64 } }); // 4 = MESSAGE response

    if (isNaN(currentLvl) || currentLvl < 1) return sendError("⚠️ Current Level must be a valid number (minimum 1).");
    if (isNaN(targetLvl) || targetLvl < 1 || targetLvl > 125) return sendError("⚠️ Target Level must be between **1 and 125**.");
    if (targetLvl <= currentLvl) return sendError("⚠️ Target Level must be higher than your Current Level.");
    if (isNaN(currentXP) || currentXP < 0) return sendError("⚠️ Current XP must be a valid non-negative number.");

    const minXpForLevel = getXpForLevel(currentLvl);
    const maxXpForLevel = getXpForLevel(currentLvl + 1) - 1;
    if (currentXP < minXpForLevel || currentXP > maxXpForLevel) {
      return sendError(`⚠️ Invalid XP for level **${currentLvl}**.\nIt must be between **${minXpForLevel.toLocaleString()}** and **${maxXpForLevel.toLocaleString()}**.`);
    }

    const slowResult = calculatePacks(currentLvl, targetLvl, currentXP, false);

    const embed = new EmbedBuilder()
      .setTitle("📊 Level Calculation Result")
      .setColor(0x00AE86)
      .setDescription(
        `# **XP Needed**\n${slowResult.txp.toLocaleString()} XP\n` +
        `## Regular\n` +
        `**Maui Wowie Packs:** ${slowResult.maui_wowie_pack}\n` +
        `**Large Packs:** ${slowResult.large_pack}\n` +
        `**Big Packs:** ${slowResult.big_pack}\n` +
        `**Small Packs:** ${slowResult.small_pack}\n\n` +
        `**Cost:**\n${slowResult.cost_total}\n\n` +
        `**Time Needed:** ${calcTime(slowResult)}\n\n` +
        `## With <:BBE:1407256192077529098> (Optional):\n` +
        `You will gain nearly **double the XP** and cut **half the time** needed for your target level.\n`
      )
      .setFooter({ text: "ℹ️ Using BBE: Total cost will depend on the price of BBE itself." });

    return res.status(200).json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } });
  }

  return res.status(400).send('Unknown interaction');
};

module.exports.config = { api: { bodyParser: false } };