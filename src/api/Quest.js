import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = 88;
const API_KEY = "84059365-25d6-486f-81f3-04b306828c35";

// TS is not finished

const connectToMongoDB = async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log.database("Connected to MongoDB for Quest API");
  } catch (error) {
    log.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

const app = express();
app.use(express.json());

app.get("/api/v1/quest/:username/:questId/:count", async (req, res) => {
  const { username, questId, count } = req.params;
  const apiKey = req.headers["x-api-key"];
  const questCount = parseInt(count);

  try {
    if (apiKey !== API_KEY) {
      log.api(`Invalid API key attempt from IP: ${req.ip}`);
      return res.status(401).json({ error: "Invalid API key" });
    }

    if (isNaN(questCount) || questCount <= 0) {
      return res.status(400).json({ error: "Invalid quest progress count" });
    }

    log.api(`Processing quest progress -> Username: ${username}, Quest: ${questId}, Count: ${questCount}`);

    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ error: `User not found: ${username}` });
    }

    const profile = await Profile.findOne({ accountId: user.accountId });
    if (!profile) {
      return res.status(404).json({ error: `Profile not found for user: ${username}` });
    }

    const athenaProfile = profile.profiles.athena;
    let questKey = null;
    let questItem = null;
    for (const [key, item] of Object.entries(athenaProfile.items)) {
      if (item.templateId === `Quest:${questId}`) {
        questKey = key;
        questItem = item;
        break;
      }
    }

    if (!questItem) {
      log.api(`Quest with templateId Quest:${questId} not found for user: ${username}`);
      return res.status(404).json({ error: `Quest ${questId} not found` });
    }

    questItem.attributes.last_state_change_time = new Date().toISOString();
    questItem.attributes.completion_athena_daily_kill_players_assault_rifles =
      (questItem.attributes.completion_athena_daily_kill_players_assault_rifles || 0) + questCount;

    await Profile.updateOne(
      { accountId: user.accountId },
      {
        $set: {
          [`profiles.athena.items.${questKey}`]: questItem,
        },
      }
    );

    log.api(`Updated quest ${questId} for ${username} with ${questCount} progress`);
    res.json({
      message: `Successfully updated quest ${questId} with ${questCount} progress`,
    });
  } catch (error) {
    log.api(`Quest error for ${username}: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

const startServer = async () => {
  await connectToMongoDB();
  app.listen(PORT, () => {
    log.api(`Quest API server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  log.api(`Server startup error: ${error.message}`);
  process.exit(1);
});