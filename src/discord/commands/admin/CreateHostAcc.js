import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { randomBytes } from "crypto";
import Users from "../../../User/Mongodb/Schema/user.js";
import Utils from "../../../Utils/Utils.js";
import log from "../../../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const BASE_USERNAME = "hostaccount";
const BASE_DOMAIN = "helix.dev";

function generatePassword() {
  // URL-safe random password, no whitespace and Discord-friendly to copy.
  return randomBytes(12).toString("base64url");
}

async function findNextHostIdentity() {
  let suffix = 0;

  while (suffix < 10000) {
    const suffixText = suffix === 0 ? "" : String(suffix);
    const username = `${BASE_USERNAME}${suffixText}`;
    const email = `${BASE_USERNAME}${suffixText}@${BASE_DOMAIN}`;

    const existing = await Users.findOne({
      $or: [{ username_lower: username.toLowerCase() }, { email }],
    })
      .select("_id")
      .lean();

    if (!existing) {
      return { username, email };
    }

    suffix++;
  }

  throw new Error("Could not find an available hostaccount name.");
}

export const data = new SlashCommandBuilder()
  .setName("createhostacc")
  .setDescription("Creates a standalone host account (not linked to Discord)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false);

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.inGuild()) {
    return interaction.editReply({
      content: "This command can only be used in a server.",
    });
  }

  try {
    const { username, email } = await findNextHostIdentity();
    const password = generatePassword();

    // Uses a synthetic unique ID to avoid linking this account to a real Discord user.
    const syntheticDiscordId = `hostacc:${Date.now()}:${randomBytes(4).toString("hex")}`;

    const createResult = await Utils.CreateUser(
      syntheticDiscordId,
      username,
      email,
      password,
      false
    );

    if (createResult.status !== 200) {
      return interaction.editReply({
        content: createResult.message || "Failed to create host account.",
      });
    }

    const embed = new EmbedBuilder()
      .setTitle("Host account created")
      .setColor("#2ECC71")
      .addFields(
        { name: "Username", value: username, inline: false },
        { name: "Email", value: email, inline: false },
        { name: "Password", value: password, inline: false }
      )
      .setFooter({ text: "Standalone account (not linked to a Discord account)" })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    log.backend(
      `Host account created by ${interaction.user.tag}: ${username} <${email}>`
    );
  } catch (error) {
    log.error(`createhostacc failed: ${error.message}`);
    await interaction.editReply({
      content: "An error occurred while creating the host account.",
    });
  }
}
