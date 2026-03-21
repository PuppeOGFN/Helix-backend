import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();
const API_KEY = process.env.API_KEY;

const PORT = Number(process.env.HYPE_PORT || 90);
const app = express();
app.use(express.json());

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

app.get(
  "/api/v1/rewards/managehype/:username/:reason",
  async (req, res) => {
    const { username, reason } = req.params;
    const apiKey = req.headers["x-api-key"];

    try {
      if (apiKey !== API_KEY) {
        log.warn(`Invalid API key attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: "Invalid API key" });
      }
      if (
        ![
          "Elimination",
          "Win",
          "Top3",
          "Top7",
          "Top12",
          "BusFare",
        ].includes(reason)
      ) {
        log.warn(`Invalid reason attempt from IP: ${req.ip}: ${reason}`);
        return res.status(400).json({ error: "Invalid reason" });
      }

      log.hype(
        `Processing hype request -> Username: ${username}, Reason: ${reason}`
      );

      const user = await User.findOne({ username }).lean();
      if (!user) {
        return res.status(404).json({ error: `User not found: ${username}` });
      }

      let amount = 0;

      switch (reason) {
        case "Elimination":
          amount = 20;
          break;
        case "Win":
          amount = 60;
          break;
        case "Top3":
          amount = 2;
          break;
        case "Top7":
          amount = 4;
          break;
        case "Top12":
          amount = 6;
          break;
      }

      const updatedProfile = await Profile.findOneAndUpdate(
        { accountId: user.accountId },
        { $inc: { "profiles.athena.stats.attributes.arena_hype": amount } },
        { new: true }
      );

      if (!updatedProfile) {
        return res.status(404).json({ error: `Profile not found for user: ${username}` });
      }

      const newHype = updatedProfile.profiles.athena.stats.attributes.arena_hype;

      log.hype(`Successfully added ${amount} Hype for ${username}, new Hype: ${newHype}`);
      res.json({
        message: `Successfully added ${amount} Hype`,
        hype: newHype,
      });
    } catch (error) {
      log.error(`ManageHype error for ${username}: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
);

const startServer = async () => {
  await connectToMongoDB();
  app.listen(PORT, () => {
    log.api(`ManageHype server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  log.error(`Server startup error: ${error.message}`);
  process.exit(1);
});