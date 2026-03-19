import path from "path";
import fs from "fs";
import { dirname } from "dirname-filename-esm";
import { SlashCommandBuilder } from "discord.js";
import Users from "../../../User/Mongodb/Schema/user.js";
import Profiles from "../../../User/Mongodb/Schema/profiles.js";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import log from "../../../Utils/log.js";
import dotenv from "dotenv";
dotenv.config();

const REQUIRED_ROLE_ID = "1438036202564358226";
const WEBHOOK_URL = process.env.LOG_WEBHOOK;

async function sendWebhookLog(discordUser, action, status, details = {}) {
  const embed = {
    embeds: [
      {
        title: "Full Locker Claim",
        description: `${status} - ${action}`,
        color: status === "Success" ? 0x00ff00 : 0xff0000,
        fields: [
          { name: "Discord ID", value: discordUser.id, inline: true },
          {
            name: "Username",
            value: discordUser.username ?? "Unknown",
            inline: true,
          },
          ...Object.entries(details).map(([k, v]) => ({
            name: k,
            value: String(v),
            inline: true,
          })),
        ],
        thumbnail: { url: discordUser.displayAvatarURL({ dynamic: true }) },
        timestamp: new Date().toISOString(),
        footer: {
          text: "Reward System",
          icon_url:
            "https://cdn.discordapp.com/app-assets/432980957394370572/1084188429077725287.png",
        },
      },
    ],
  };
  try {
    await axios.post(WEBHOOK_URL, embed);
    log.backend(`Webhook sent - ${action} (${status})`);
  } catch (e) {
    log.error(`Webhook error - ${e.message}`);
  }
}

export const data = new SlashCommandBuilder()
  .setName("claim-full-locker")
  .setDescription("Claim the full cosmetic locker (backpacks + wraps)")
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
    await sendWebhookLog(interaction.user, "Claim Attempt", "Failed", {
      Reason: "Missing required role",
    });
    return interaction.editReply({
      content: "You do not have the required role to use this command.",
    });
  }

  const userId = interaction.user.id;
  const user = await Users.findOne({ discordId: userId });
  if (!user) {
    await sendWebhookLog(interaction.user, "Claim Attempt", "Failed", {
      Reason: "No linked account",
    });
    return interaction.editReply({
      content: "No linked account Found.",
      ephemeral: true,
    });
  }

  const profile = await Profiles.findOne({ accountId: user.accountId });
  if (!profile) {
    await sendWebhookLog(interaction.user, "Claim Attempt", "Failed", {
      Reason: "No profile found",
    });
    return interaction.editReply({
      content: "You do not have a profile.",
      ephemeral: true,
    });
  }

  const __dirname = dirname(import.meta);
  const cosmeticsPath = path.join(
    __dirname,
    "../../../Profiles/FullLocker/allcosmetics.json"
  );

  let cosmetics;
  try {
    const raw = fs.readFileSync(cosmeticsPath, "utf8");
    cosmetics = JSON.parse(raw);
  } catch (e) {
    await sendWebhookLog(interaction.user, "Claim Attempt", "Failed", {
      Reason: "Failed to read/parse allcosmetics.json",
    });
    return interaction.editReply({
      content: "Failed to load cosmetics file.",
      ephemeral: true,
    });
  }

  const athena = profile.profiles.athena;
  const common = profile.profiles.common_core;
  const currentItems = athena.items || {};
  const mergedItems = { ...currentItems, ...cosmetics };

  await Profiles.findOneAndUpdate(
    { accountId: user.accountId },
    { $set: { "profiles.athena.items": mergedItems } },
    { new: true }
  );

  const chunkSize = 100;
  const itemKeys = Object.keys(cosmetics);
  for (let i = 0; i < itemKeys.length; i += chunkSize) {
    const chunk = itemKeys.slice(i, i + chunkSize);
    const giftId = uuidv4();
    common.items[giftId] = {
      templateId: "GiftBox:GB_MakeGood",
      attributes: {
        fromAccountId: "[Epic Games]",
        params: {
          DefaultHeaderText: "Epic Games",
          userMessage: "Enjoy Full Locker!",
        },
        lootList: chunk.map((key) => ({
          itemType: key,
          itemGuid: key,
          quantity: 1,
        })),
        giftedOn: new Date().toISOString(),
      },
      quantity: 1,
    };
  }

  common.rvn = (common.rvn || 0) + 1;
  common.commandRevision = (common.commandRevision || 0) + 1;

  await Profiles.updateOne(
    { accountId: user.accountId },
    { $set: { "profiles.common_core": common } }
  );

  await sendWebhookLog(interaction.user, "Claim Full Locker", "Success", {
    ItemsAdded: itemKeys.length.toString(),
    TotalItemsNow: Object.keys(mergedItems).length.toString(),
  });

  await interaction.editReply({
    content: `You Have Successfully Claimed Full Locker!`,
    ephemeral: true,
  });
}