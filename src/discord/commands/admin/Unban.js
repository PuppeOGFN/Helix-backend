import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import Users from "../../../User/Mongodb/Schema/user.js";
import Utils from "../../../Utils/Utils.js";
import axios from "axios";

import dotenv from "dotenv";
dotenv.config();

const WEBHOOK_URL = process.env.LOG_WEBHOOK;

export const data = new SlashCommandBuilder()
  .setName("unban")
  .setDescription("Unbans a user's account")
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user whose account you want to unban")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("reason")
      .setDescription("The reason for unbanning the account")
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });
  let msg = "";
  const reason = interaction.options.getString("reason");
  const discordId = interaction.options.getUser("user")?.id;
  const targetUser = await Users.findOne({ discordId: discordId });

  console.log(
    `Unban attempt by ${interaction.user.username} for ${interaction.options.getUser("user")?.username
    }`
  );

  if (!targetUser) {
    msg = "The account you entered does not exist in our database.";
    console.log(`User not found: ${discordId}`);
  } else if (targetUser.banned === false) {
    msg = "This account is not banned.";
    console.log(`Account already unbanned: ${discordId}`);
  }

  if (targetUser && targetUser.banned === true) {
    try {
      const updateResult = await targetUser.updateOne({
        $set: { banned: false },
      });

      if (updateResult.nModified > 0) {
        console.log(
          `Successfully unbanned user: ${targetUser.username} - Reason: ${reason}`
        );

        let refreshToken = global.refreshTokens.findIndex(
          (i) => i.accountId == targetUser.accountId
        );
        if (refreshToken === -1) {
          global.refreshTokens.push({
            accountId: targetUser.accountId,
            token: "new_refresh_token",
          });
        }

        let accessToken = global.accessTokens.findIndex(
          (i) => i.accountId == targetUser.accountId
        );
        if (accessToken === -1) {
          global.accessTokens.push({
            accountId: targetUser.accountId,
            token: "new_access_token",
          });
        }

        if (accessToken === -1 || refreshToken === -1)
          await Utils.UpdateTokens();

        const webhookData = {
          content: `**Account Unbanned**\nUser: ${targetUser.username}\nReason: ${reason}`,
        };
        try {
          await axios.post(WEBHOOK_URL, webhookData);
          console.log(
            `Webhook sent for unbanning user: ${targetUser.username}`
          );
        } catch (error) {
          console.log(
            `Failed to send webhook for unbanning user: ${targetUser.username} - Error: ${error.message}`
          );
        }
      } else {
          // LLLLLLLLLLLLLLL
      }
    } catch (error) {
      msg = `Error updating unban status for user: ${targetUser.username} - Error: ${error.message}`;
      console.log(msg);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle("Account unbanned")
    .setDescription(`User with Discord ID ${discordId} has been unbanned`)
    .addFields({
      name: "Reason",
      value: reason,
    })
    .setColor("#9BB6F1")
    .setFooter({
      text: process.env.BACKEND_NAME,
      iconURL:
        "https://cdn.discordapp.com/attachments/1237879868373598349/1252847633802989568/Helixconsole.logo_withbackground.png?ex=66750648&is=6673b4c8&hm=f0fa0ec69bcc9cb4fa8fd0616c26ab79eb3ed9a046a9f6e697724bc2f6fae6de&",
    })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });

  try {
    await interaction.options.getUser("user")?.send({
      content: "Your account has been unbanned! https://discord.gg/XZfzTycgwU",
    });
    console.log(`Message sent to unbanned user: ${targetUser.username}`);
  } catch (error) {
    console.log(
      `Failed to send message to unbanned user: ${targetUser.username} - Error: ${error.message}`
    );
  }
}
