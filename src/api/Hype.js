import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

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
          "Top 3",
          "Top 7",
          "Top 12",
          "Bus Fare",
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

      const profile = await Profile.findOne({ accountId: user.accountId }).lean();
      if (!profile) {
        return res.status(404).json({ error: `Profile not found for user: ${username}` });
      }

      const attributes = { ...profile.profiles.athena.stats.attributes };
      const currentHype = attributes.arena_hype || 0;
      let amount = 0;
      let removeAmount = 0;

      switch (reason) {
        case "Elimination":
          amount = 20;
          break;
        case "Win":
          amount = 60;
          break;
        case "Top 3":
          amount = 2;
          break;
        case "Top 7":
          amount = 4;
          break;
        case "Top 12":
          amount = 6;
          break;
        case "Bus Fare":
          if (currentHype >= 14000) removeAmount = 10;
          else if (currentHype >= 500) removeAmount = 8;
          else if (currentHype >= 445) removeAmount = 8;
          else if (currentHype >= 300) removeAmount = 8;
          else if (currentHype >= 225) removeAmount = 5;
          else if (currentHype >= 175) removeAmount = 3;
          else if (currentHype >= 125) removeAmount = 1;
          break;
      }

      const newHype = Math.max(0, currentHype + amount - removeAmount);
      attributes.arena_hype = newHype;

      await Profile.updateOne(
        { accountId: user.accountId },
        { $set: { "profiles.athena.stats.attributes": attributes } }
      );

      const message =
        removeAmount === 0
          ? `Successfully added ${amount} Hype`
          : `Successfully ${amount > 0 ? "added" : "removed"} Hype`;

      log.hype(`${message} for ${username}, new Hype: ${newHype}`);
      res.json({
        message,
        hype: attributes.arena_hype,
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