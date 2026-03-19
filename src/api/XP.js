import express from "express";
import mongoose from "mongoose";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

import dotenv from "dotenv";
dotenv.config();

const PORT = 78;
const MAIN_SEASON = parseInt(process.env.MAIN_SEASON) || 0;

const MAX_LEVEL = MAIN_SEASON < 11 ? 100 : 1000;

const seasonFolder = path.join(
  "src",
  "local",
  "Battlepass",
  "Data",
  `Season${MAIN_SEASON}`
);

function ReadJson(filePath, fallback = []) {
  if (!fs.existsSync(filePath)) {
    log.warn(`File not found: ${filePath} — using fallback value`);
    return fallback;
  }
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    log.error(`Failed to read/parse ${filePath}: ${err.message}`);
    return fallback;
  }
}

const levelDataPath = path.join(seasonFolder, "SeasonXP.json");
const levelData = ReadJson(levelDataPath, []);

let battleStarsData = [];
if (MAIN_SEASON <= 10) {
  const battleStarsPath = path.join(seasonFolder, "SeasonBP.json");
  battleStarsData = ReadJson(battleStarsPath, []);
}

const freeBPPath = path.join(seasonFolder, "SeasonFreeBattlepass.json");
const paidBPPath = path.join(seasonFolder, "SeasonPaidBattlepass.json");
const freeBPData = ReadJson(freeBPPath, []);
const paidBPData = ReadJson(paidBPPath, []);

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

app.get("/api/v1/addxp/:username/:amount", async (req, res) => {
  const { username, amount } = req.params;
  const apiKey = req.headers["x-api-key"];
  const xpAmount = parseInt(amount);

  try {
    if (apiKey !== process.env.API_KEY) {
      log.warn(`Invalid API key attempt from IP: ${req.ip}`);
      return res.status(401).json({ error: "Invalid API key" });
    }
    if (isNaN(xpAmount) || xpAmount <= 0) {
      return res.status(400).json({ error: "Invalid XP amount" });
    }

    log.xp(`Processing XP request -> Username: ${username}, Amount: ${xpAmount}`);

    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ error: `User not found: ${username}` });
    }

    const profile = await Profile.findOne({ accountId: user.accountId }).lean();
    if (!profile) {
      return res.status(404).json({ error: `Profile not found for user: ${username}` });
    }

    const athena = profile.profiles.athena;
    let currentLevel = athena.stats.attributes.level || 1;
    let currentXP = athena.stats.attributes.xp || 0;
    let currentBookLevel = athena.stats.attributes.book_level || 1;
    let currentBookXP = athena.stats.attributes.book_xp || 0;
    let currentStars = athena.stats.attributes.battlestars || 0;

    currentXP += xpAmount;

    let xpToNextLevel =
      levelData.find((level) => level.level === currentLevel)?.xpToNext ??
      Infinity;

    while (currentXP >= xpToNextLevel && currentLevel < MAX_LEVEL) {
      currentXP -= xpToNextLevel;
      currentLevel++;
      currentBookLevel++;

      if (MAIN_SEASON <= 10) {
        const starsForLevel =
          battleStarsData.find((level) => level.level === currentLevel)
            ?.battleStars || 0;
        currentStars += starsForLevel;
      } else {
        currentStars += 5;
      }

      xpToNextLevel =
        levelData.find((level) => level.level === currentLevel)?.xpToNext ??
        Infinity;
    }

    await giveBattlePassRewards(profile, currentBookLevel);

    await Profile.updateOne(
      { accountId: user.accountId },
      {
        $set: {
          "profiles.athena.stats.attributes.level": currentLevel,
          "profiles.athena.stats.attributes.xp": currentXP,
          "profiles.athena.stats.attributes.book_level": currentBookLevel,
          "profiles.athena.stats.attributes.book_xp": currentBookXP,
          "profiles.athena.stats.attributes.battlestars": currentStars,
        },
      }
    );

    log.xp(`Added ${xpAmount} XP to ${username}`);
    Utils.SendEmptyGift(username, user.accountId);

    res.json({
      message: `Successfully added ${xpAmount} XP`,
    });
  } catch (error) {
    log.error(`XP error for ${username}: ${error.message}`);
    res.status(400).json({ error: error.message });
  }
});

async function giveBattlePassRewards(profile, newTier) {
  const commonCoreProfile = profile.profiles.common_core;
  const athenaProfile = profile.profiles.athena;
  const currentTier = athenaProfile.stats.attributes.book_level || 0;

  const freeRewards =
    freeBPData.find((r) => r.Level === currentTier)?.Rewards || [];
  const paidRewards =
    paidBPData.find((r) => r.Level === currentTier)?.Rewards || [];
  const allRewards = [...freeRewards, ...paidRewards];

  if (!allRewards.length) {
    log.warn(`No rewards found for Battle Pass tier ${currentTier}`);
    return;
  }

  const athenaUpdates = {};
  const lootList = [];

  for (const reward of allRewards) {
    const itemType = reward.templateId;
    const itemGuid = `${itemType}_${uuidv4()}`;
    const quantity = reward.quantity || 1;

    if (itemType === "Currency:MtxPurchased") {
      commonCoreProfile.items["Currency:MtxPurchased"] = commonCoreProfile
        .items["Currency:MtxPurchased"] || { quantity: 0 };
      if (
        commonCoreProfile.items["Currency:MtxPurchased"].quantity >= quantity
      ) {
        log.backend(
          `User already has sufficient V-Bucks for tier ${currentTier}`
        );
        continue;
      }
      commonCoreProfile.items["Currency:MtxPurchased"].quantity += quantity;
      log.backend(`Added ${quantity} V-Bucks to user for tier ${currentTier}`);
      lootList.push({ itemType, itemGuid, quantity });
    } else {
      if (athenaProfile.items[itemType]) {
        log.backend(
          `User already has item ${itemType} for tier ${currentTier}`
        );
        continue;
      }

      const itemData = {
        templateId: itemType,
        attributes: {
          item_seen: false,
        },
        quantity,
      };

      athenaUpdates[`profiles.athena.items.${itemType}`] = itemData;
      lootList.push({ itemType, itemGuid, quantity });
    }
  }

  if (Object.keys(athenaUpdates).length > 0) {
    await Profile.findOneAndUpdate(
      {
        accountId: profile.accountId,
        "profiles.athena.rvn": athenaProfile.rvn,
      },
      { $set: athenaUpdates, $inc: { "profiles.athena.rvn": 1 } },
      { new: true }
    );
  }

  if (lootList.length > 0) {
    const giftBoxId = uuidv4();
    commonCoreProfile.items[giftBoxId] = {
      templateId: "GiftBox:GB_BattlePass",
      attributes: {
        fromAccountId: "[Epic Games]",
        params: {
          DefaultHeaderText: "BATTLE PASS TIER UP!",
          userMessage: `You've reached Battle Pass tier ${currentTier}!`,
        },
        lootList,
        giftedOn: new Date().toISOString(),
      },
      quantity: 1,
    };

    commonCoreProfile.rvn = (commonCoreProfile.rvn || 0) + 1;
    commonCoreProfile.commandRevision =
      (commonCoreProfile.commandRevision || 0) + 1;

    await Profile.updateOne(
      { accountId: profile.accountId },
      { $set: { "profiles.common_core": commonCoreProfile } }
    );
  }
}

app.get("/api/v1/xp/:username/:amount", async (req, res) => {
  const { username, amount } = req.params;
  const apiKey = req.headers["x-api-key"];
  const xpAmount = parseInt(amount);

  try {
    if (apiKey !== API_KEY) {
      log.api(`Invalid API key attempt from IP: ${req.ip}`);
      return res.status(401).json({ error: "Invalid API key" });
    }
    if (isNaN(xpAmount) || xpAmount <= 0) {
      return res.status(400).json({ error: "Invalid XP amount" });
    }

    log.api(
      `Processing XP request -> Username: ${username}, Amount: ${xpAmount}`
    );

    const user = await User.findOne({ username }).lean();
    if (!user) {
      return res.status(404).json({ error: `User not found: ${username}` });
    }

    const profile = await Profile.findOne({ accountId: user.accountId });
    if (!profile) {
      return res
        .status(404)
        .json({ error: `Profile not found for user: ${username}` });
    }

    const attributes = { ...profile.profiles.athena.stats.attributes };
    let currentXp = attributes.xp || 0;
    let currentLevel = attributes.level || 1;
    let battleStars = attributes.book_xp || 0;
    let tier = attributes.book_level || 0;

    currentXp += xpAmount;

    while (currentLevel < MAX_LEVEL) {
      const nextLevelData = levelData.find(
        (level) => level.Level === currentLevel + 1
      );
      if (!nextLevelData) {
        log.warn(`No level data found for level ${currentLevel + 1}`);
        break;
      }
      if (currentXp < nextLevelData.XpToNextLevel) break;

      currentLevel += 1;
      currentXp -= nextLevelData.XpToNextLevel;

      log.api(`User ${username} leveled up to ${currentLevel}!`);

      if (MAIN_SEASON <= 10) {
        const levelStars =
          battleStarsData.find((data) => data.Level === currentLevel)
            ?.BattleStars || 0;
        battleStars += levelStars;
        attributes.book_xp = battleStars;

        while (battleStars >= 10) {
          battleStars -= 10;
          tier += 1;
          attributes.book_xp = battleStars;
          attributes.book_level = tier;
          log.api(`User ${username} earned a new Battle Pass tier: ${tier}!`);
          await giveBattlePassRewards(profile, tier);
        }
      } else {
        const previousTier = tier;
        tier = currentLevel;
        attributes.book_level = tier;
        attributes.book_xp = 0;

        if (tier > previousTier) {
          log.api(`User ${username} earned a new Battle Pass tier: ${tier}!`);
          for (
            let rewardTier = previousTier + 1;
            rewardTier <= tier;
            rewardTier++
          ) {
            await giveBattlePassRewards(profile, rewardTier);
          }
        }
      }
    }

    attributes.xp = currentXp;
    attributes.level = currentLevel;

    await Profile.findOneAndUpdate(
      {
        accountId: user.accountId,
        "profiles.athena.rvn": profile.profiles.athena.rvn,
      },
      {
        $set: { "profiles.athena.stats.attributes": attributes },
        $inc: { "profiles.athena.rvn": 1 },
      },
      { new: true }
    );

    log.xp(
      `Added ${xpAmount} XP to ${username}, new level: ${currentLevel}, new tier: ${tier}, battle stars: ${
        MAIN_SEASON <= 10 ? battleStars : 0
      }`
    );
    await Utils.SendEmptyGift(username, user.accountId);

    const nextLevelXp =
      levelData.find((level) => level.Level === currentLevel + 1)
        ?.XpToNextLevel || 0;

    res.json({
      message: `Successfully added ${xpAmount} XP, new level: ${currentLevel}, XP: ${currentXp}/${
        nextLevelXp || "Max"
      }, new tier: ${tier}, battle stars: ${
        MAIN_SEASON <= 10 ? battleStars + "/10" : "N/A"
      }`,
    });
  } catch (error) {
    log.api(`XP error for ${username}: ${error.message}`);
    res
      .status(error.message.includes("not found") ? 404 : 500)
      .json({ error: error.message });
  }
});

const startServer = async () => {
  await connectToMongoDB();
  app.listen(PORT, () => {
    log.api(`XP server running on port ${PORT}`);
  });
};

startServer().catch((error) => {
  log.api(`Server startup error: ${error.message}`);
  process.exit(1);
});