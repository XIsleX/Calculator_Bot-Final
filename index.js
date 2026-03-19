const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  EmbedBuilder, 
  InteractionType,
  AttachmentBuilder 
} = require("discord.js");
require("dotenv").config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Send button message once on ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const channel = await client.channels.fetch("1483503488246874293"); // replace with your channel ID

  const button = new ButtonBuilder()
    .setCustomId("levelCalcButton")
    .setLabel("Calculate Level")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);

  const file = new AttachmentBuilder("./calculateYourXP.png", {name: "calculateYourXP.png"}); // local file

  await channel.send({ files: [file], components: [row] });
});

// Function to get total XP needed to reach a certain level
function getXpForLevel(level) {
  let xp = 0;
  for (let i = 1; i < level; i++) {
    xp += 50 * (Math.pow(i, 2) + 2);
  }
  return xp;
}

// Full calculation with packs
function calculatePacks(startLevel, targetLevel, currentXP = 0, useBBE = true) {
  let totalXp = 0;
  for (let lvl = startLevel; lvl < targetLevel; lvl++) {
    totalXp += 50 * (Math.pow(lvl, 2) + 2);
  }
  totalXp -= currentXP;
  if (totalXp < 0) totalXp = 0;

  let totalAmt = totalXp;
  let small = 0, big = 0, large = 0, maui_wowie = 0;

  if (totalAmt >= 1000000) {
    maui_wowie += Math.floor(totalAmt / 1000000);
    totalAmt %= 1000000;
  }
  if (totalAmt >= 500000) {
    large += Math.floor(totalAmt / 1000000);
    totalAmt %= 1000000;
  }
  if (totalAmt >= 250000) {
    big += Math.floor(totalAmt / 500000);
    totalAmt %= 500000;
  }
  if (totalAmt >= 125000) {
    small += Math.floor(totalAmt / 125500);
    totalAmt %= 125500;
  }
  if (totalAmt !== 0) small++;

  if (small >= 2) { small = 0; big++; }
  if (big >= 2) { big = 0; large++; }
  if (large >= 2) { large = 0; maui_wowie++; }

  let cost = (maui_wowie * 3000) + (large * 1600) + (big * 1100) + (small * 7500);

  // Build bullet-point cost list
  let cost_parts = [];
  if (Math.floor(cost / 10000) > 0) {
    cost_parts.push(`• ${Math.floor(cost / 10000)} **BGL(s)** <:Blue_Gem_Lock:1410588533529509990>`);
  }
  if (Math.floor(cost / 100 % 100) > 0) {
    cost_parts.push(`• ${Math.floor(cost / 100 % 100)} **DLs** <:DL:1407257577682636800>`);
  }
  if (cost % 100 > 0) {
    cost_parts.push(`• ${cost % 100} **WLs** <:World_Lock:1410573104975187978>`);
  }

  return {
    txp: totalXp,
    maui_wowie_pack: maui_wowie,
    large_pack: large,
    big_pack: big,
    small_pack: small,
    cost_total: cost_parts.join("\n")
  };
}

// Interaction handling
client.on("interactionCreate", async interaction => {
  if (interaction.isButton() && interaction.customId === "levelCalcButton") {
    const modal = new ModalBuilder()
      .setCustomId("levelCalcModal")
      .setTitle("Level Calculator");

    const currentLvlInput = new TextInputBuilder()
      .setCustomId("currentLvl")
      .setLabel("Current Level")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const currentXPInput = new TextInputBuilder()
      .setCustomId("currentXP")
      .setLabel("Current XP (optional)")
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    const targetLvlInput = new TextInputBuilder()
      .setCustomId("targetLvl")
      .setLabel("Target Level")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(currentLvlInput),
      new ActionRowBuilder().addComponents(currentXPInput),
      new ActionRowBuilder().addComponents(targetLvlInput)
    );

    await interaction.showModal(modal);
  }

  if (interaction.type === InteractionType.ModalSubmit && interaction.customId === "levelCalcModal") {
    const currentLvl = parseInt(interaction.fields.getTextInputValue("currentLvl"));
    const currentXP = parseInt(interaction.fields.getTextInputValue("currentXP") || "0");
    const targetLvl = parseInt(interaction.fields.getTextInputValue("targetLvl"));

    // Validate current level
    if (isNaN(currentLvl) || currentLvl < 1) {
      return interaction.reply({
        content: "⚠️ Current Level must be a valid number (minimum 1).",
        ephemeral: true
      });
    }

    // Validate target level
    if (isNaN(targetLvl) || targetLvl < 1 || targetLvl > 125) {
      return interaction.reply({
        content: "⚠️ Target Level must be between **1 and 125**.",
        ephemeral: true
      });
    }

    // Ensure target is higher than current
    if (targetLvl <= currentLvl) {
      return interaction.reply({
        content: "⚠️ Target Level must be higher than your Current Level.",
        ephemeral: true
      });
    }

    // Validate current XP (no negative)
    if (isNaN(currentXP) || currentXP < 0) {
      return interaction.reply({
        content: "⚠️ Current XP must be a valid non-negative number.",
        ephemeral: true
      });
    }

    // New validation: current XP must fit within current level's XP range
    const minXpForLevel = getXpForLevel(currentLvl);
    const maxXpForLevel = getXpForLevel(currentLvl + 1) - 1; // right before next level
    if (currentXP < minXpForLevel || currentXP > maxXpForLevel) {
      return interaction.reply({
        content: `⚠️ Invalid XP for level **${currentLvl}**.\nIt must be between **${minXpForLevel.toLocaleString()}** and **${maxXpForLevel.toLocaleString()}**.`,
        ephemeral: true
      });
    }

    // Two calculations
    const slowResult = calculatePacks(currentLvl, targetLvl, currentXP, false); // no BBE
    //const fastResult = calculatePacks(currentLvl, targetLvl, currentXP, true);  // with BBE

    // Function to calculate approximate time
    function calcTime(result) {
      let minutes = 
        (result.small_pack * 5) +
        (result.big_pack * 10) +
        (result.large_pack * 15) +
        (result.maui_wowie_pack * 30);

      if (minutes < 30) {
        return `~${minutes} minutes`;
      } else if (minutes === 30) {
        return "~30 minutes";
      } else {
        let hours = Math.ceil(minutes / 60);
        return `~${hours} hour${hours > 1 ? "s" : ""}`;
      }
    }

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

          `## With <:BBE:1407256192077529098> (Optional):
          You will gain nearly **double the XP** and cut **half the time** needed for your target level.\n`
          
      )
      .setFooter({ text: "ℹ️ Using BBE: Total cost will depend on the price of BBE itself." });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN);
