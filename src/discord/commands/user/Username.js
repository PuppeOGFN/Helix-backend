import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Users from "../../../User/Mongodb/Schema/user.js";
import log from "../../../Utils/log.js";
import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

const WEBHOOK_URL = process.env.LOG_WEBHOOK;

const ALLOWED_ROLES = [
  "1332158685333422121",
  "1332942191907311636",
  "1332217194213412906",
  "1332187827731038354",
  "1332187508447907971",
  "1332187578358829066",
  "1332187232638861422",
  "1332202943193157673",
];

export const data = new SlashCommandBuilder()
  .setName("username")
  .setDescription("Lets you change your username")
  .addStringOption((option) =>
    option
      .setName("username")
      .setDescription("Your desired username")
      .setRequired(true)
  );

async function sendWebhookLog(type, data) {
  const webhookEmbed = {
    embeds: [
      {
        title:
          type === "success" ? "Username Changed" : "Username Change Attempt",
        description:
          type === "success"
            ? "A user has successfully changed their username"
            : "A username change attempt was made",
        color: 0x9370db,
        fields: [
          {
            name: "Discord User",
            value: `${data.discordTag} (ID: ${data.discordId})`,
            inline: true,
          },
          {
            name: type === "success" ? "Old Username" : "Attempt Status",
            value: type === "success" ? data.oldUsername : data.status,
            inline: true,
          },
          {
            name: type === "success" ? "New Username" : "Attempted Username",
            value: data.newUsername,
            inline: true,
          },
        ],
        thumbnail: {
          url: data.avatarUrl,
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: "Username Change",
          icon_url:
            "https://cdn.discordapp.com/app-assets/432980957394370572/1084188429077725287.png",
        },
      },
    ],
  };

  try {
    await axios.post(WEBHOOK_URL, webhookEmbed);
    log.backend(
      `Successfully sent webhook for username ${type}: ${data.discordTag}`
    );
  } catch (error) {
    log.error(`Failed to send webhook for ${type}: ${error.message}`);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const memberRoles = interaction.member.roles.cache.map((role) => role.id);
  const hasPermission = ALLOWED_ROLES.some((roleId) =>
    memberRoles.includes(roleId)
  );

  if (!hasPermission) {
    log.backend(
      `Unauthorized username change attempt by ${interaction.user.tag} (ID: ${interaction.user.id})`
    );
    await sendWebhookLog("attempt", {
      discordTag: interaction.user.tag,
      discordId: interaction.user.id,
      status: "Unauthorized",
      newUsername: interaction.options.getString("username"),
      avatarUrl: interaction.user.displayAvatarURL({ dynamic: true }),
    });
    return interaction.editReply({
      content: "You don't have permission to use this command!",
      ephemeral: true,
    });
  }

  try {
    const user = await Users.findOne({ discordId: interaction.user.id });

    if (!user) {
      log.backend(
        `Unregistered user ${interaction.user.tag} attempted username change`
      );
      await sendWebhookLog("attempt", {
        discordTag: interaction.user.tag,
        discordId: interaction.user.id,
        status: "Not Registered",
        newUsername: interaction.options.getString("username"),
        avatarUrl: interaction.user.displayAvatarURL({ dynamic: true }),
      });
      return interaction.editReply({
        content: "You are not registered!",
        ephemeral: true,
      });
    }

    let accessToken = global.accessTokens.find(
      (i) => i.accountId == user.accountId
    );
    if (accessToken) {
      log.backend(
        `Failed username change for ${user.username} - user logged into Fortnite`
      );
      await sendWebhookLog("attempt", {
        discordTag: interaction.user.tag,
        discordId: interaction.user.id,
        status: "Logged into Fortnite",
        newUsername: interaction.options.getString("username"),
        avatarUrl: interaction.user.displayAvatarURL({ dynamic: true }),
      });
      return interaction.editReply({
        content:
          "Failed to change username as you are currently logged in to Fortnite.\nRun the /sign-out-of-all-sessions command to sign out.",
      });
    }

    const username = interaction.options.getString("username");
    const oldUsername = user.username;

    await user.updateOne({ $set: { username: username } });

    const embed = new EmbedBuilder()
      .setTitle("Username changed")
      .setDescription(`Your account username has been changed to ${username}`)
      .setColor("#9370DB")
      .setFooter({
        text: process.env.BACKEND_NAME,
        iconURL:
          "https://raw.githubusercontent.com/samtheman69/cdn/refs/heads/main/874507BD-5A9C-447F-BEC0-D738836427AF.png",
      })
      .setTimestamp();

    log.backend(
      `Username changed for ${interaction.user.tag} (ID: ${interaction.user.id}) from ${oldUsername} to ${username}`
    );
    await sendWebhookLog("success", {
      discordTag: interaction.user.tag,
      discordId: interaction.user.id,
      oldUsername: oldUsername,
      newUsername: username,
      avatarUrl: interaction.user.displayAvatarURL({ dynamic: true }),
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    log.error(
      `Error changing username for ${interaction.user.tag}: ${error.message}`
    );
    await sendWebhookLog("attempt", {
      discordTag: interaction.user.tag,
      discordId: interaction.user.id,
      status: `Error: ${error.message}`,
      newUsername: interaction.options.getString("username"),
      avatarUrl: interaction.user.displayAvatarURL({ dynamic: true }),
    });
    await interaction.editReply({
      content:
        "An error occurred while changing your username. Please try again later.",
      ephemeral: true,
    });
  }
}
