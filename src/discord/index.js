import {
  Client,
  Partials,
  Collection,
  Events,
  GatewayIntentBits,
  ActivityType,
} from "discord.js";
import path from "node:path";
import logger from "../Utils/log.js";
import fs from "node:fs";
import Users from "../User/Mongodb/Schema/user.js";
import Utils from "../Utils/Utils.js";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
const xmpp_port = process.env.XMPP_PORT;

import dotenv from "dotenv";
dotenv.config();

if (!process.env.BOT_TOKEN && process.env.DISCORD_TOKEN) {
  process.env.BOT_TOKEN = process.env.DISCORD_TOKEN;
}

export const client = new Client({
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageTyping,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildModeration,
  ],
  presence: {
    activities: [],
    status: "online",
  },
});
global.discordClient = client;
global.discordApplication = await Utils.FetchApplication();
client.commands = new Collection();
const basePath = process.cwd();
const foldersPath = path.join(basePath, "src", "discord", "commands");
const commandFolders = fs.readdirSync(foldersPath);
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    try {
      const command = await import(`file://${path.join(commandsPath, file)}`);
      if (command.data && "execute" in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.error(
          `[WARNING] The command at ${path.join(
            commandsPath,
            file
          )} is missing a required "data" or "execute" property.`
        );
      }
    } catch (error) {
      logger.error(
        `[ERROR] Error loading command file at ${path.join(
          commandsPath,
          file
        )}: ${error}`
      );
    }
  }
}

let previousAmount = null;

async function updateStatus(amount) {
  try {
    let statusMessage = "";
    if (amount < 6) {
      statusMessage = "Nebula Services";
    } else if (amount === 1) {
      statusMessage = "1 player";
    } else {
      statusMessage = `${amount} players`;
    }

    if (amount !== previousAmount) {
      client.user.setPresence({
        activities: [
          {
            name: statusMessage,
            type: ActivityType.Watching,
          },
        ],
        status: "online",
      });

      logger.bot(
        `Discord bot status updated to: Watching ${statusMessage}`
      );

      previousAmount = amount;
    }
  } catch (error) {
    logger.error(error);
  }
}

async function fetchDataAndUpdateStatus() {
  try {
    const response = await fetch("http://localhost:" + xmpp_port);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const amount = data.Clients.amount;

    updateStatus(amount);
  } catch (error) { }
}

client.once(Events.ClientReady, async () => {
  let clientId = await client.application?.id;
  global.clientId = clientId;
  import("./deploy-commands.js");

  fetchDataAndUpdateStatus();
  setInterval(fetchDataAndUpdateStatus, 1000);

  logger.bot(`Logged in as ${client.user?.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command)
    return await interaction.reply({
      content: "This command does not exist",
      ephemeral: true,
    });
  try {
    await command.execute(interaction);
  } catch (error) {
    console.log(error.toString());

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    } catch { }
  }
});

client.on(Events.GuildBanAdd, async (ban) => {
  const memberBan = await ban.fetch();
  if (memberBan.user.bot) return;
  const userData = await Users.findOne({ discordId: memberBan.user.id });
  if (userData && userData.banned !== true) {
    await userData.updateOne({ $set: { banned: true } });
    let refreshToken = global.refreshTokens.findIndex(
      (i) => i.accountId == userData.accountId
    );
    if (refreshToken != -1) global.refreshTokens.splice(refreshToken, 1);
    let accessToken = global.accessTokens.findIndex(
      (i) => i.accountId == userData.accountId
    );
    if (accessToken != -1) {
      let dvid = jwt.decode(
        global.accessTokens
          .find((i) => i.accountId == targetUser.accountId)
          .token.replace("eg1~", "")
      ).dvid;
      let file = fs.readFileSync("hwid.json").toString();
      let array = JSON.parse(file);
      array.push(dvid);
      fs.writeFileSync("hwid.json", JSON.stringify(array));
      global.accessTokens.splice(accessToken, 1);
      let xmppClient = global.Clients.find(
        (client) => client.accountId == userData.accountId
      );
      if (xmppClient) xmppClient.client.close();
    }
    if (accessToken != -1 || refreshToken != -1) await Utils.UpdateTokens();
    logger.bot(
      `[BAN] ${memberBan.user.tag} has been banned from the backend since they got banned from the Discord server.`
    );
  }
});

client.on(Events.GuildBanRemove, async (ban) => {
  if (ban.user.bot) return;
  const userData = await Users.findOne({ discordId: ban.user.id });
  if (userData && userData.banned === true) {
    await userData.updateOne({ $set: { banned: false } });
    logger.bot(
      `[BAN] ${ban.user.tag} has been unbanned from the backend since they got unbanned from the Discord server.`
    );
  }
});

const discordToken = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN;

if (discordToken) {
  client.login(discordToken).catch((error) => {
    logger.error(`Discord bot failed to login: ${error}`);
  });
} else {
  logger.debug("DISCORD_TOKEN not set, Discord bot login skipped.");
}
