import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import Utils from "../../../Utils/Utils.js";
import log from "../../../Utils/log.js";
import Users from "../../../User/Mongodb/Schema/user.js";
import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

const WEBHOOK_URL = process.env.LOG_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName("create")
  .setDescription("Creates an account for you")
  .addStringOption((option) =>
    option
      .setName("username")
      .setDescription("The username you want to use")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("email")
      .setDescription("The email you want to use")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("password")
      .setDescription("The password you want to use")
      .setRequired(true)
  );

async function sendWebhookLog(username, email, discordUser) {
  const webhookEmbed = {
    embeds: [
      {
        title: "New User Registration",
        description: "A new user has registered with Nebula Services",
        color: 0x9370db,
        fields: [
          {
            name: "Username",
            value: username,
            inline: true,
          },
          {
            name: "Email",
            value: email,
            inline: true,
          },
          {
            name: "Discord ID",
            value: discordUser.id,
            inline: true,
          },
        ],
        thumbnail: {
          url: discordUser.displayAvatarURL({ dynamic: true }),
        },
        timestamp: new Date().toISOString(),
        footer: {
          text: "Nebula Registration System",
          icon_url:
            "https://cdn.discordapp.com/app-assets/432980957394370572/1084188429077725287.png",
        },
      },
    ],
  };

  try {
    await axios.post(WEBHOOK_URL, webhookEmbed);
    log.backend("Successfully sent registration webhook");
  } catch (error) {
    log.error(`Failed to send webhook: ${error.message}`);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const username = interaction.options.getString("username");
  const email = interaction.options.getString("email");
  const plainPassword = interaction.options.getString("password");

  const user = await Users.findOne({ discordId: interaction.user.id });
  if (user) {
    return interaction.editReply({ content: "You are already registered!" });
  }

  try {
    const res = await Utils.CreateUser(
      discordId,
      username,
      email,
      plainPassword,
      false
    );

    const embed = new EmbedBuilder()
      .setTitle("Account created")
      .setDescription("Your account has been successfully created")
      .addFields(
        {
          name: "Username",
          value: username,
          inline: false,
        },
        {
          name: "Email",
          value: email,
          inline: false,
        }
      )
      .setColor("#9370DB")
      .setFooter({
        text: "Nebula",
        iconURL:
          "https://raw.githubusercontent.com/samtheman69/cdn/refs/heads/main/874507BD-5A9C-447F-BEC0-D738836427AF.png",
      })
      .setTimestamp();

    const publicEmbed = new EmbedBuilder()
      .setTitle("New registration")
      .setDescription(`Welcome ${username} to Nebula!`)
      .addFields({
        name: "Username",
        value: username,
        inline: true,
      })
      .setColor("#9370DB")
      .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
      .setFooter({
        text: "Nebula",
        iconURL:
          "https://raw.githubusercontent.com/samtheman69/cdn/refs/heads/main/874507BD-5A9C-447F-BEC0-D738836427AF.png",
      })
      .setTimestamp();

    await interaction.editReply({ content: res.message, embeds: [embed] });
    await interaction.channel?.send({ embeds: [publicEmbed] });

    await sendWebhookLog(username, email, interaction.user);
    log.backend(`User registered: ${username} (Discord ID: ${discordId})`);
  } catch (err) {
    log.error(`Registration error for ${username}: ${err.message}`);
    await interaction.editReply({
      content: "An error occurred during registration. Please try again later.",
    });
  }
}