import path from "path";
import log from "../Utils/log.js";
import logger from "../Utils/log.js";
import { dirname } from "dirname-filename-esm";
const __dirname = dirname(import.meta);
import { REST, Routes } from "discord.js";
const guildId = process.env.GUILD_ID;
const token = process.env.BOT_TOKEN;
import fs from "node:fs";
import dotenv from "dotenv";
dotenv.config();

const commands = [];
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import("file://" + filePath);
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(token);

(async () => {
  try {
    let data;
    if (guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(global.clientId, guildId),
        {
          body: commands,
        }
      );
      logger.debug(
        `Successfully reloaded ${data.length} guild (/) commands for ${guildId}.`
      );
      return;
    }

    data = await rest.put(Routes.applicationCommands(global.clientId), {
      body: commands,
    });
    logger.debug(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    console.error(error);
  }
})();
