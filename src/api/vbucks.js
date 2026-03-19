import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = 92;
const app = express();
app.use(express.json());

app.get(
  "/api/v1/rewards/vbucks/:username/:amount",
  async (req, res) => {
    const { username, amount } = req.params;
    const apiKey = req.headers["x-api-key"];
    const vbucksAmount = parseInt(amount);

    try {
      if (apiKey !== process.env.API_KEY) {
        log.api(`Invalid API key attempt from IP: ${req.ip}`);
        return res.status(401).json({ error: "Invalid API key" });
      }
      if (isNaN(vbucksAmount) || vbucksAmount <= 0) {
        return res.status(400).json({ error: "Invalid VBucks amount" });
      }
      if (vbucksAmount > 200) {
        log.api(
          `VBucks amount ${vbucksAmount} exceeds limit from IP: ${req.ip}`
        );
        return res
          .status(400)
          .json({ error: "VBucks amount exceeds limit of 200" });
      }

      log.api(
        `Processing VBucks request -> Username: ${username}, Amount: ${vbucksAmount}`
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
      const currency = {
        ...profile.profiles.common_core.items["Currency:MtxPurchased"],
      };

      if (vbucksAmount === 50) {
        attributes.lifetime_kills = (attributes.lifetime_kills || 0) + 1;
        log.kill(`${username} got a kill!`);
      } else if (vbucksAmount === 200) {
        attributes.lifetime_wins = (attributes.lifetime_wins || 0) + 1;
        log.win(`${username} got a win!`);
      }

      currency.quantity = (currency.quantity || 0) + vbucksAmount;

      await Profile.updateOne(
        { accountId: user.accountId },
        {
          $set: {
            "profiles.athena.stats.attributes": attributes,
            "profiles.common_core.items.Currency:MtxPurchased": currency,
          },
        }
      );

      log.vbucks(`Added ${vbucksAmount} vbucks to ${username}`);
      Utils.SendEmptyGift(username, user.accountId);

      res.json({
        message: `Successfully added ${vbucksAmount} VBucks`,
      });
    } catch (error) {
      log.api(`Vbucks error for ${username}: ${error.message}`);
      res.status(400).json({ error: error.message });
    }
  }
);

const startServer = async () => {
  await connectToMongoDB();
  app.listen(PORT, () => {
    log.api(`VBucks server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  log.api(`Server startup error: ${error.message}`);
  process.exit(1);
});