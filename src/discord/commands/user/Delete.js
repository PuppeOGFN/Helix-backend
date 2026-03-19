import {
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import Users from "../../../User/Mongodb/Schema/user.js";
import Profiles from "../../../User/Mongodb/Schema/profiles.js";
import Friends from "../../../User/Mongodb/Schema/friends.js";

export const data = new SlashCommandBuilder()
  .setName("deleteaccount")
  .setDescription("Deletes your account (irreversible)");

export async function execute(interaction) {
  const user = await Users.findOne({ discordId: interaction.user.id });
  if (!user)
    return interaction.reply({
      content: "You are not registered!",
      ephemeral: true,
    });
  if (user.banned)
    return interaction.reply({
      content: "You are banned, and your account cannot therefore be deleted.",
      ephemeral: true,
    });

  const confirm = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Delete Account")
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = { type: 1, components: [confirm.toJSON(), cancel.toJSON()] };

  const confirmationEmbed = new EmbedBuilder()
    .setColor(0xd32f2f)
    .setTitle("Delete Your Account")
    .setDescription(
      "Warning: **This action is permanent and cannot be undone.**"
    )
    .setThumbnail(
      "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png"
    )
    .setFooter({
      text: `NebulaServices`,
      iconURL:
        "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png",
    })
    .setTimestamp();

  const confirmationResponse = await interaction.reply({
    embeds: [confirmationEmbed],
    components: [row],
    ephemeral: true,
  });

  const filter = (i) => i.user.id === interaction.user.id;
  const collector = confirmationResponse.createMessageComponentCollector({ filter });

  collector.on("collect", async (i) => {
    if (i.customId === "confirm") {
      await Users.findOneAndDelete({ discordId: interaction.user.id });
      await Profiles.findOneAndDelete({ accountId: user.accountId });
      await Friends.findOneAndDelete({ accountId: user.accountId });

      const confirmEmbed = new EmbedBuilder()
        .setColor(0xc62828)
        .setTitle("Account Permanently Deleted")
        .setDescription(
          "Your account and all associated data have been **permanently removed**.\n\n" +
          "We're sorry to see you go. If you ever return, you'll need to create a new account."
        )
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png"
        )
        .setFooter({
          text: `Nebula Services`,
          iconURL:
            "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png",
        })
        .setTimestamp();

      await i.reply({ embeds: [confirmEmbed], ephemeral: true });
    }

    if (i.customId === "cancel") {
      const cancelEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle("Deletion Cancelled")
        .setDescription("Your account is **safe** — no data was deleted.")
        .setThumbnail(
          "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png"
        )
        .setFooter({
          text: `Nebula Services`,
          iconURL:
            "https://cdn.discordapp.com/attachments/1237602824465158224/1279078756815867974/HelixLogoTransparent.png",
        })
        .setTimestamp();

      await i.reply({ embeds: [cancelEmbed], ephemeral: true });
    }

    collector.stop();
  });
}