import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = 90;
const app = express();
app.use(express.json());

app.get(
  "/api/v1/rewards/managehype/:username/:reason",
  async (req, res) => {
    const { username, reason } = req.params;
    const apiKey = req.headers["x-api-key"];

    try {
      if (apiKey !== process.env.API_KEY) {
        log.warn(`Invalid API key attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: "Invalid API key" });
      }
      if (
        ![
          "Elimination",
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