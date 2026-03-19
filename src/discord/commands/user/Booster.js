import { SlashCommandBuilder } from 'discord.js';
import Profile from '../../../User/Mongodb/Schema/profiles.js';
import User from '../../../User/Mongodb/Schema/user.js';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import log from "../../../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const REQUIRED_ROLE_ID = '1428924719490400358';
const WEBHOOK_URL = process.env.LOG_WEBHOOK;

async function sendWebhookLog(discordUser, action, status, details = {}) {
  const webhookEmbed = {
    embeds: [
      {
        title: "Booster Rewards Claim",
        description: `A user attempted to claim Booster Rewards: ${status}`,
        color: status === 'Success' ? 0x9370db : 0xff0000,
        fields: [
          {
            name: "Action",
            value: action,
            inline: true,
          },
          {
            name: "Discord ID",
            value: discordUser.id,
            inline: true,
          },
          {
            name: "Username",
            value: discordUser.username || 'Unknown',
            inline: true,
          },
          ...Object.keys(details).map(key => ({
            name: key,
            value: details[key],
            inline: true,
          })),
        ],
        thumbnail: {
          url: discordUser.displayAvatarURL({ dynamic: true }),
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Reward System',
          icon_url:
            "https://cdn.discordapp.com/app-assets/432980957394370572/1084188429077725287.png",
        },
      },
    ],
  };

  try {
    await axios.post(WEBHOOK_URL, webhookEmbed);
    log.backend(`Successfully sent webhook for ${action} (${status})`);
  } catch (error) {
    log.error(`Failed to send webhook for ${action}: ${error.message}`);
  }
}

export const data = new SlashCommandBuilder()
  .setName('claim-booster-rewards')
  .setDescription('Claim The Booster Rewards')
  .setDMPermission(false);

export const execute = async (interaction) => {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
    await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: 'Missing required role' });
    return interaction.editReply({ content: 'You do not have the required role to use this command.' });
  }

  const discordId = interaction.user.id;

  try {
    const user = await User.findOne({ discordId });
    if (!user) {
      await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: 'User profile not found' });
      return interaction.editReply({ content: 'Your user profile is not found in the database.' });
    }

    const accountId = user.accountId;
    const profile = await Profile.findOne({ accountId });
    if (!profile) {
      await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: 'Profile data not found' });
      return interaction.editReply({ content: 'Your profile data is not found.' });
    }

    const commonCore = profile.profiles.common_core;
    const athena = profile.profiles.athena;

    const cosmeticIds = [
      'CID_089_Athena_Commando_M_RetroGrey',
      'CID_085_Athena_Commando_M_Twitch',
      'CID_114_Athena_Commando_F_TacticalWoodland',
      'EID_HipHop01',
      'Pickaxe_ID_044_TacticalUrbanHammer',
      'Glider_ID_018_Twitch',
      'BID_049_TacticalWoodland'
    ];

    const items = {
      "AthenaCharacter:CID_089_Athena_Commando_M_RetroGrey":          { templateId: "AthenaCharacter:CID_089_Athena_Commando_M_RetroGrey", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaCharacter:CID_085_Athena_Commando_M_Twitch":            { templateId: "AthenaCharacter:CID_085_Athena_Commando_M_Twitch", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaCharacter:CID_114_Athena_Commando_F_TacticalWoodland":   { templateId: "AthenaCharacter:CID_114_Athena_Commando_F_TacticalWoodland", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaDance:EID_HipHop01":                                    { templateId: "AthenaDance:EID_HipHop01", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaPickaxe:Pickaxe_ID_044_TacticalUrbanHammer":            { templateId: "AthenaPickaxe:Pickaxe_ID_044_TacticalUrbanHammer", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaGlider:Glider_ID_018_Twitch":                           { templateId: "AthenaGlider:Glider_ID_018_Twitch", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
      "AthenaBackpack:BID_049_TacticalWoodland":                     { templateId: "AthenaBackpack:BID_049_TacticalWoodland", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 }
    };

    const updates = {};
    for (const cosmeticId of cosmeticIds) {
      const key = cosmeticId.startsWith('CID_') ? `AthenaCharacter:${cosmeticId}` :
        cosmeticId.startsWith('EID_') ? `AthenaDance:${cosmeticId}` :
          cosmeticId.startsWith('Pickaxe_') ? `AthenaPickaxe:${cosmeticId}` :
            cosmeticId.startsWith('Glider_') ? `AthenaGlider:${cosmeticId}` :
              cosmeticId.startsWith('BID_') ? `AthenaBackpack:${cosmeticId}` : cosmeticId;

      if (!items[key]) {
        log.backend(`Cosmetic ${key} not found in hardcoded list for user ${discordId}`);
        continue;
      }

      if (athena.items[key]) {
        log.backend(`User ${discordId} already has cosmetic ${key}`);
        continue;
      }

      const itemData = JSON.parse(JSON.stringify(items[key]));
      itemData.attributes.item_seen = false;

      updates[`profiles.athena.items.${key}`] = itemData;
    }

    if (Object.keys(updates).length > 0) {
      await Profile.findOneAndUpdate(
        { accountId },
        { $set: updates },
        { new: true }
      );
    }

    if (!commonCore.items.stats) commonCore.items.stats = {};
    if (!commonCore.items.stats.attributes) commonCore.items.stats.attributes = {};
    commonCore.items.stats.attributes.BoosterRewards = true;

    const giftBoxId = uuidv4();
    commonCore.items[giftBoxId] = {
      templateId: 'GiftBox:GB_Twitch',
      attributes: {
        fromAccountId: '[Epic Games]',
        params: {
          DefaultHeaderText: 'Twitch Prime Pack!',
          DefaultBodyText: 'Thanks for linking your Twitch Prime!',
          userMessage: 'Enjoy Your Booster Rewards!'
        },
        lootList: cosmeticIds.map(id => {
          const itemType = id.startsWith('CID_') ? `AthenaCharacter:${id}` :
            id.startsWith('EID_') ? `AthenaDance:${id}` :
              id.startsWith('Pickaxe_') ? `AthenaPickaxe:${id}` :
                id.startsWith('Glider_') ? `AthenaGlider:${id}` :
                  id.startsWith('BID_') ? `AthenaBackpack:${id}` : id;
          return {
            itemType,
            itemGuid: itemType,
            quantity: 1
          };
        }),
        giftedOn: new Date().toISOString()
      },
      quantity: 1
    };

    commonCore.rvn += 1;
    commonCore.commandRevision += 1;

    await Profile.updateOne(
      { accountId },
      { $set: { 'profiles.common_core': commonCore } }
    );

    await sendWebhookLog(interaction.user, 'Claim Booster Rewards', 'Success', { CosmeticsClaimed: cosmeticIds.length.toString() });
    await interaction.editReply({
      content: `You have successfully claimed the Booster Rewards!`
    });

  } catch (error) {
    await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: error.message });
    log.error(`Error claiming Booster Rewards for user ${discordId}: ${error.message}`);
    await interaction.editReply({ content: 'An error occurred while claiming the Booster Rewards.' });
  }
};