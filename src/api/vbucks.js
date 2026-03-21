import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";

import dotenv from "dotenv";
dotenv.config();

const PORT = Number(process.env.VBUCKS_PORT || 92);
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

      const incOps = {
        "profiles.common_core.items.Currency:MtxPurchased.quantity": vbucksAmount,
      };

      if (vbucksAmount === 50) {
        incOps["profiles.athena.stats.attributes.lifetime_kills"] = 1;
        log.kill(`${username} got a kill!`);
      } else if (vbucksAmount === 200) {
        incOps["profiles.athena.stats.attributes.lifetime_wins"] = 1;
        log.win(`${username} got a win!`);
      } else if (vbucksAmount === 25) {
        incOps["profiles.athena.stats.attributes.lifetime_top3"] = 1;
        log.top3(`${username} got a top 3!`);
      }

      const updateResult = await Profile.updateOne(
        { accountId: user.accountId },
        { $inc: incOps }
      );

      if (!updateResult.matchedCount) {
        return res.status(404).json({ error: `Profile not found for user: ${username}` });
      }

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