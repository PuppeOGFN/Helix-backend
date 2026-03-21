import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import Profile from '../../../User/Mongodb/Schema/profiles.js';
import User from '../../../User/Mongodb/Schema/user.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { dirname } from 'dirname-filename-esm';
import destr from 'destr';
import axios from 'axios';
import log from '../../../Utils/log.js';

import dotenv from "dotenv";
dotenv.config();

const __dirname = dirname(import.meta);
const WEBHOOK_URL = process.env.LOG_WEBHOOK;

async function sendWebhookLog(discordUser, action, status, details = {}) {
    const webhookEmbed = {
        embeds: [
            {
                title: "Legacy Bundle Claim",
                description: `A user attempted to claim the Legacy Bundle: ${status}`,
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
                    ...(Object.keys(details).map(key => ({
                        name: key,
                        value: details[key],
                        inline: true,
                    }))),
                ],
                thumbnail: {
                    url: discordUser.displayAvatarURL({ dynamic: true }),
                },
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
        await axios.post(WEBHOOK_URL, webhookEmbed);
        log.backend(`Successfully sent webhook for ${action} (${status})`);
    } catch (error) {
        log.error(`Failed to send webhook for ${action}: ${error.message}`);
    }
}

export const data = new SlashCommandBuilder()
    .setName('givelegacyrewards')
    .setDescription('Give the Legacy Bundle to a user (Admin only)')
    .addUserOption((option) =>
        option
            .setName('user')
            .setDescription('The user to give the Legacy Bundle to')
            .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false);

export const execute = async (interaction) => {
    await interaction.deferReply({ ephemeral: true });

    const targetUser = interaction.options.getUser('user');
    const discordId = targetUser.id;

    try {
        const user = await User.findOne({ discordId });
        if (!user) {
            await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: 'User profile not found', TargetUser: targetUser.username });
            return interaction.editReply({ content: `That user's profile was not found in the database.` });
        }

        const accountId = user.accountId;
        const profile = await Profile.findOne({ accountId });
        if (!profile) {
            await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: 'Profile data not found', TargetUser: targetUser.username });
            return interaction.editReply({ content: `That user's profile data was not found.` });
        }

        const commonCoreProfile = profile.profiles.common_core;
        const athenaProfile = profile.profiles.athena;

        const cosmeticIds = [
            'CID_017_Athena_Commando_M',
            'CID_028_Athena_Commando_F',
            'EID_Fresh',
            'EID_TakeTheL',
            'Pickaxe_Lockjaw',
            'Pickaxe_ID_015_HolidayCandyCane',
            'CID_030_Athena_Commando_M_Halloween',
            'CID_029_Athena_Commando_F_Halloween',
            'Glider_Warthog'
        ];

        const items = {
            "AthenaCharacter:CID_017_Athena_Commando_M": { templateId: "AthenaCharacter:CID_017_Athena_Commando_M", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaCharacter:CID_028_Athena_Commando_F": { templateId: "AthenaCharacter:CID_028_Athena_Commando_F", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaDance:EID_Fresh": { templateId: "AthenaDance:EID_Fresh", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaDance:EID_TakeTheL": { templateId: "AthenaDance:EID_TakeTheL", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaPickaxe:Pickaxe_Lockjaw": { templateId: "AthenaPickaxe:Pickaxe_Lockjaw", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaPickaxe:Pickaxe_ID_015_HolidayCandyCane": { templateId: "AthenaPickaxe:Pickaxe_ID_015_HolidayCandyCane", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaCharacter:CID_030_Athena_Commando_M_Halloween": { templateId: "AthenaCharacter:CID_030_Athena_Commando_M_Halloween", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaCharacter:CID_029_Athena_Commando_F_Halloween": { templateId: "AthenaCharacter:CID_029_Athena_Commando_F_Halloween", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 },
            "AthenaGlider:Glider_Warthog": { templateId: "AthenaGlider:Glider_Warthog", attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 }
        };

        const updates = {};
        for (const cosmeticId of cosmeticIds) {
            const key = cosmeticId.startsWith('CID_') ? `AthenaCharacter:${cosmeticId}` :
                cosmeticId.startsWith('EID_') ? `AthenaDance:${cosmeticId}` :
                    cosmeticId.startsWith('Pickaxe_') ? `AthenaPickaxe:${cosmeticId}` :
                        cosmeticId.startsWith('Glider_') ? `AthenaGlider:${cosmeticId}` : cosmeticId;

            if (!items[key]) {
                log.backend(`Cosmetic ${key} not found in hardcoded list for user ${discordId}`);
                continue;
            }

            if (athenaProfile.items[key]) {
                log.backend(`User ${discordId} already has cosmetic ${key}`);
                continue;
            }

            const itemData = JSON.parse(JSON.stringify(items[key]));

            itemData.attributes.item_seen = false;

            if (cosmeticId === 'CID_030_Athena_Commando_M_Halloween') {
                itemData.attributes.variants = [
                    {
                        "channel": "ClothingColor",
                        "active": "Mat0",
                        "owned": [
                            "Mat0",
                            "Mat1",
                            "Mat2",
                            "Mat3",
                            "Mat4"
                        ]
                    },
                    {
                        "channel": "Parts",
                        "active": "Stage1",
                        "owned": [
                            "Stage1",
                            "Stage2"
                        ]
                    }
                ];
            } else if (cosmeticId === 'CID_029_Athena_Commando_F_Halloween') {
                itemData.attributes.variants = [
                    {
                        "channel": "Material",
                        "active": "Mat1",
                        "owned": [
                            "Mat1",
                            "Mat2",
                            "Mat3"
                        ]
                    }
                ];
            }

            updates[`profiles.athena.items.${key}`] = itemData;
        }

        if (Object.keys(updates).length > 0) {
            await Profile.findOneAndUpdate(
                { accountId },
                { $set: updates },
                { new: true }
            );
        }

        if (!commonCoreProfile.items.stats) {
            commonCoreProfile.items.stats = {};
        }
        if (!commonCoreProfile.items.stats.attributes) {
            commonCoreProfile.items.stats.attributes = {};
        }

        if (!commonCoreProfile.items['Currency:MtxPurchased']) {
            commonCoreProfile.items['Currency:MtxPurchased'] = { quantity: 0 };
        }
        commonCoreProfile.items['Currency:MtxPurchased'].quantity =
            (commonCoreProfile.items['Currency:MtxPurchased'].quantity || 0) + 2000;

        const giftBoxId = uuidv4();
        commonCoreProfile.items[giftBoxId] = {
            templateId: 'GiftBox:GB_MakeGood',
            attributes: {
                fromAccountId: '[Epic Games]',
                params: {
                    userMessage: 'Enjoy the OG Legacy Bundle!'
                },
                lootList: [
                    ...cosmeticIds.map(id => {
                        const itemType = id.startsWith('CID_') ? `AthenaCharacter:${id}` :
                            id.startsWith('EID_') ? `AthenaDance:${id}` :
                                id.startsWith('Pickaxe_') ? `AthenaPickaxe:${id}` :
                                    id.startsWith('Glider_') ? `AthenaGlider:${id}` : id;

                        let variantUpdates = [];
                        if (id === 'CID_030_Athena_Commando_M_Halloween') {
                            variantUpdates = [
                                {
                                    channel: "ClothingColor",
                                    variant: "Mat0"
                                },
                                {
                                    channel: "Parts",
                                    variant: "Stage1"
                                }
                            ];
                        } else if (id === 'CID_029_Athena_Commando_F_Halloween') {
                            variantUpdates = [
                                {
                                    channel: "Material",
                                    variant: "Mat1"
                                }
                            ];
                        }

                        const lootEntry = {
                            itemType,
                            itemGuid: itemType,
                            quantity: 1
                        };

                        if (variantUpdates.length > 0) {
                            lootEntry.variantUpdates = variantUpdates;
                        }

                        return lootEntry;
                    }),
                    {
                        itemType: 'Currency:MtxPurchased',
                        itemGuid: 'Currency:MtxPurchased',
                        quantity: 2000
                    }
                ],
                giftedOn: new Date().toISOString()
            },
            quantity: 1
        };

        commonCoreProfile.rvn += 1;
        commonCoreProfile.commandRevision += 1;

        await Profile.updateOne(
            { accountId },
            { $set: { 'profiles.common_core': commonCoreProfile } }
        );

        await sendWebhookLog(interaction.user, 'Give Legacy Bundle', 'Success', {
            CosmeticsClaimed: cosmeticIds.length.toString(),
            VBucks: '2000',
            GivenTo: targetUser.username
        });
        await interaction.editReply({
            content: `Successfully gave the Legacy Bundle to **${targetUser.username}**!`
        });

    } catch (error) {
        await sendWebhookLog(interaction.user, 'Claim Attempt', 'Failed', { Reason: error.message });
        log.error(`Error claiming Legacy Bundle for user ${discordId}: ${error.message}`);
        await interaction.editReply({ content: 'An error occurred while claiming the bundle.' });
    }
};