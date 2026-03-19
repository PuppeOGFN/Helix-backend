import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = 80;
const API_KEY = "84059365-25d6-486f-81f3-04b306828c35";
const SeasonNum = process.env.MAIN_SEASON;

const connectToMongoDB = async () => {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    log.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

const app = express();
app.use(express.json());

app.get(
  "/api/v1/rewards/season_umbrella/:username",
  async (req, res) => {
    const { username } = req.params;
    const apiKey = req.headers["x-api-key"];

    try {
      if (apiKey !== API_KEY) {
        log.warn(`Invalid API key attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: "Invalid API key" });
      }

      log.umbrella(`Processing umbrella request -> Username: ${username}`);

      const user = await User.findOne({ username }).lean();
      if (!user) {
        return res.status(404).json({ error: `User not found: ${username}` });
      }

      const profile = await Profile.findOne({ accountId: user.accountId }).lean();
      if (!profile) {
        return res.status(404).json({ error: `Profile not found for user: ${username}` });
      }

      const umbrellaId = `AthenaGlider:Umbrella_Season_${SeasonNum}`;
      if (profile.profiles.athena.items[umbrellaId]?.quantity > 0) {
        log.umbrella(
          `${username} already has the season ${SeasonNum} umbrella!`
        );
        return res.json({ message: "User already has the umbrella reward" });
      }

      const updatedItems = {
        ...profile.profiles.athena.items,
        [umbrellaId]: {
          quantity: 1,
          templateId: umbrellaId,
          attributes: {
            max_level_bonus: 0,
            level: 0,
            item_seen: false,
            xp: 0,
          },
        },
      };

      await Profile.updateOne(
        { accountId: user.accountId },
        { $set: { "profiles.athena.items": updatedItems } }
      );

      log.umbrella(
        `Season ${SeasonNum} umbrella added successfully to ${username}`
      );
      Utils.SendEmptyGift(username, user.accountId);

      res.json({
        message: "Umbrella reward added successfully",
      });
    } catch (error) {
      log.error(`Season umbrella error for ${username}: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
);

const startServer = async () => {
  await connectToMongoDB();
  app.listen(PORT, () => {
    log.api(`Season Umbrella server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  log.error(`Server startup error: ${error.message}`);
  process.exit(1);
});