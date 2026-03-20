import express from "express";
import fs from "fs";
import axios from "axios";
import { MongoClient } from "mongodb";
import mongoose from 'mongoose';
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";
import path from "path";
import { dirname } from 'dirname-filename-esm';
import { verifyToken } from "../User/tokenManager/tokenVerify.js";
import { v4 } from 'uuid';

import dotenv from "dotenv";
dotenv.config();

const __dirname = dirname(import.meta);
const app = express.Router();

const DatabaseURL = process.env.MONGO_URI;
const NameFromURL = DatabaseURL.split("/");
const DatabaseName = NameFromURL[3];
const DatabaseCollectionName = 'profiles';

const userSchema = new mongoose.Schema({
    username: String,
    accountId: String,
    tournamentDetails: 
    {
        kills: { type: Number, default: 0 },
        placement: { type: Number, default: 0 },
        points: { type: Number, default: 0 },
        wins: { type: Number, default: 0 },
        matchesPlayed: { type: Number, default: 0 },
        matches: { type: Array, default: [] },
        played: { type: Boolean, default: false }
    }
});

const profileSchema = new mongoose.Schema({
    accountId: String,
    profiles: {
        athena: {
            stats: {
                attributes: {
                    arena_hype: { type: Number, default: 0 }
                }
            }
        }
    }
});

const User = mongoose.model('users', userSchema);
const Profile = mongoose.model('profiles', profileSchema);

async function GetPlayerHype(accountid) {
    const client = new MongoClient(DatabaseURL, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db(DatabaseName);
        const collection = db.collection(DatabaseCollectionName);

        const profile = await collection.findOne({ 'accountId': accountid });
        if (profile && profile.profiles && profile.profiles.athena && profile.profiles.athena.stats && profile.profiles.athena.stats.attributes) {
            return profile.profiles.athena.stats.attributes.arena_hype || 0;
        } else {
            throw new Error('Profile not found or malformed!');
        }
    } catch (error) {
        console.error(`Error fetching player hype: ${error}`);
        return 0;
    } finally {
        await client.close();
    }
}

app.get("/api/v1/events/Fortnite/download/:accountid", verifyToken, async (req, res) => {
    const seasonNum = Utils.GetVersion(req).season;
    const accountid = req.params.accountid;
    const user = await User.findOne({ accountId: accountid });

    if (!user) {
        res.send("No user found!");
    }

    const username = user.username;
    const arena = path.join(__dirname, `../local/events/Events.json`);
    let currentSeason = "S" + seasonNum;

    let playerHype;
    try {
        playerHype = await GetPlayerHype(accountid);
    }
    catch (err) {
        log.error("Error getting player hype! Error :", err);
        res.status(500).send('Internal server error');
        return;
    }

    let playerDivision = `"LG_ARENA_${currentSeason}_Division1"`;

    if (playerHype >= 16000) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5", "LG_ARENA_${currentSeason}_Division6", "LG_ARENA_${currentSeason}_Division7", "LG_ARENA_${currentSeason}_Division8", "LG_ARENA_${currentSeason}_Division9", "LG_ARENA_${currentSeason}_Division10"`;
    } else if (playerHype >= 12000) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5", "LG_ARENA_${currentSeason}_Division6", "LG_ARENA_${currentSeason}_Division7", "LG_ARENA_${currentSeason}_Division8", "LG_ARENA_${currentSeason}_Division9"`;
    } else if (playerHype >= 6000) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5", "LG_ARENA_${currentSeason}_Division6", "LG_ARENA_${currentSeason}_Division7", "LG_ARENA_${currentSeason}_Division8"`;
    } else if (playerHype >= 4000) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5", "LG_ARENA_${currentSeason}_Division6", "LG_ARENA_${currentSeason}_Division7"`;
    } else if (playerHype >= 2500) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5", "LG_ARENA_${currentSeason}_Division6"`;
    } else if (playerHype >= 1500) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4", "LG_ARENA_${currentSeason}_Division5"`;
    } else if (playerHype >= 1000) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3", "LG_ARENA_${currentSeason}_Division4"`;
    } else if (playerHype >= 500) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2", "LG_ARENA_${currentSeason}_Division3"`;
    } else if (playerHype >= 250) {
        playerDivision = `"LG_ARENA_${currentSeason}_Division1", "LG_ARENA_${currentSeason}_Division2"`;
    }

    fs.readFile(arena, 'utf-8', (err, data) => {
        if (err) {
            log.error("Error reading file:", err);
            res.status(500).send('Error reading file!!!');
            return;
        }

        let modifiedData = data.replace(/skunkyskunkyhype/g, playerHype)
            .replace(/skunkyskunkyseason/g, currentSeason)
            .replace(/skunkyskunkyaccountid/g, accountid)
            .replace(/skunkyskunkydivision/g, playerDivision);

        let events;
        try {
            events = JSON.parse(modifiedData);
        } catch (parseErr) {
            log.error("Error parsing JSON:", parseErr);
            res.status(500).send('Error parsing JSON!!!');
            return;
        }

        log.arena(username + " sent an arena JSON request!");
        res.json(events);
    });
    if (process.env.EVENT_TYPE === "Tournament") {
        log.arena("Tournaments not set-up yet!");
    }
    else {
        log.arena("Arena is disabled, not sending json data!");
    }
});

app.get("/api/v1/players/Fortnite/tokens", async (req, res) => {
    res.json({});
});

app.get("/api/v1/leaderboards/Fortnite/:eventId/:eventWindowId/:accountId", async (req, res) => {
    try {
        const { eventId, eventWindowId, accountId } = req.params;
        const filePath = path.join(__dirname, "../local/events/leaderboard.json");

        if (!fs.existsSync(filePath)) {
            console.error(`leaderboard.json not found at ${filePath}`);
            return res.status(404).json({ error: "Leaderboard data not found" });
        }

        const users = await User.find({});
        if (!users || users.length === 0) {
            console.warn("No users found in database");
            return res.status(404).json({ error: "No users found" });
        }

        const leaderboard = {
            entries: [],
            eventId,
            eventWindowId,
            gameId: "Fortnite",
            page: 0,
            totalPages: 1,
            updatedTime: new Date().toISOString(),
        };

        for (const user of users) {
            if (user.accountId !== accountId) continue;
            if (!user.tournamentDetails?.played) continue;

            const matches = user.tournamentDetails?.matches ?? [];
            if (!Array.isArray(matches) || matches.length === 0) {
                continue;
            }

            const pointBreakdown = {};
            const sessionHistory = [];

            let totalPoints = 0;
            let totalKills = 0;

            for (const match of matches) {
                const isValid =
                    match.placement != null &&
                    match.placementPoints != null &&
                    match.kills != null &&
                    match.killPoints != null &&
                    match.timeAlive != null &&
                    match.victory != null;

                if (!isValid) {
                    console.log(
                        `⚠️ Incomplete match skipped for user ${user.accountId}:`,
                        JSON.stringify(match, null, 2)
                    );
                    continue;
                }

                const placementKey = `PLACEMENT_STAT_INDEX:${match.placement}`;
                if (!pointBreakdown[placementKey]) {
                    pointBreakdown[placementKey] = {
                        pointsEarned: match.placementPoints,
                        timesAchieved: 1,
                    };
                } else {
                    pointBreakdown[placementKey].pointsEarned += match.placementPoints;
                    pointBreakdown[placementKey].timesAchieved += 1;
                }

                totalKills += match.kills;
                totalPoints += match.placementPoints + match.killPoints;

                sessionHistory.push({
                    endTime: new Date().toISOString(),
                    sessionId: v4(),
                    trackedStats: {
                        MATCH_PLAYED_STAT: 1,
                        PLACEMENT_STAT_INDEX: match.placement,
                        TEAM_ELIMS_STAT_INDEX: match.kills,
                        TIME_ALIVE_STAT: match.timeAlive,
                        VICTORY_ROYALE_STAT: match.victory,
                    },
                });
            }

            if (totalKills > 0) {
                pointBreakdown["TEAM_ELIMS_STAT_INDEX:0"] = {
                    pointsEarned: totalKills,
                    timesAchieved: totalKills,
                };
            }

            leaderboard.entries.push({
                eventId,
                eventWindowId,
                gameId: "Fortnite",
                percentile: 0,
                pointBreakdown,
                pointsEarned: totalPoints,
                rank: 1,
                score: Date.now(),
                scoreKey: {
                    _scoreId: null,
                    eventId,
                    eventWindowId,
                    gameId: "Fortnite",
                },
                sessionHistory,
                teamAccountIds: [user.accountId],
                teamId: user.accountId,
                unscoredSessions: {},
            });
        }

        try {
            fs.writeFileSync(filePath, JSON.stringify(leaderboard, null, 2), "utf8");
        } catch (writeError) {
            console.error(`Failed to write leaderboard.json:`, writeError);
            return res.status(500).json({ error: "Failed to save leaderboard data" });
        }

        return res.json(leaderboard);
    } catch (error) {
        console.error(
            `Error in /api/v1/leaderboards/Fortnite/:eventId/:eventWindowId/:accountId:`,
            error
        );
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/v1/events/Fortnite/data/", async (req, res) => {
    res.json({});
});

app.get("/api/v1/events/Fortnite/:eventId/:eventWindowId/history/:accountId", async (req, res) => {
    res.json({});
});

app.get("/api/v1/events/Fortnite/:eventId/history/:accountId", async (req, res) => {
    try {
        const history = JSON.parse(
            fs.readFileSync(path.join(__dirname, "../local/events/history.json"), {
                encoding: "utf8",
            })
        );

        history[0].scoreKey.eventId = req.params.eventId;
        history[0].teamId = req.params.accountId;
        history[0].teamAccountIds.push(req.params.accountId);

        const user = await User.findOne({ accountId: req.params.accountId });
        if (!user) {
            console.error(`User not found for accountId: ${req.params.accountId}`);
            return res.status(404).json({ error: "User not found" });
        }

        const tournamentDetails = user.tournamentDetails || {
            kills: 0,
            placement: 0,
            points: 0,
            wins: 0,
            matchesPlayed: 0,
            matches: [],
        };

        const dedicatedPlayer = {
            TeamId: user.username || "Unknown",
            TeamAccountId: user.accountId,
            PointsEarned: tournamentDetails.points,
            SessionHistory: user.username ? `${user.username}sessionId` : "unknownSessionId",
        };

        const eventId = "helixlg_cup";
        const windowId = "helixlg_cup1";
        const rank = 5;
        const percentile = 0;
        const pointBreakdown = {
            eliminations: tournamentDetails.kills,
            placements: tournamentDetails.placement,
        };

        const response = [
            {
                scoreKey: {
                    gameId: "Fortnite",
                    eventId,
                    eventWindowId: windowId,
                    _scoreId: null,
                },
                teamId: dedicatedPlayer.TeamId,
                teamAccountIds: Array.isArray(dedicatedPlayer.TeamAccountId)
                    ? dedicatedPlayer.TeamAccountId
                    : [dedicatedPlayer.TeamAccountId],
                liveSessionId: null,
                pointsEarned: dedicatedPlayer.PointsEarned,
                eventWindowId: windowId,
                score: dedicatedPlayer.PointsEarned,
                gameId: "Fortnite",
                eventId,
                rank: rank,
                percentile: Math.round(percentile),
                pointBreakdown: pointBreakdown,
                sessionHistory: dedicatedPlayer.SessionHistory,
                unscoredSessions: [],
            },
        ];

        return res.json(response);
    } catch (error) {
        console.error(`Error in /api/v1/events/Fortnite/:eventId/history/:accountId:`, error);
        return res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/v1/events/Fortnite/:windowId/history/:accountId", async (req, res) => {
    res.json({});
});

app.get("/api/v1/players/Fortnite/:accountId", async (req, res) => {
    res.json({
        "result": true,
        "region": "EU",
        "lang": "en",
        "season": process.env.MAIN_SEASON,
        "events": []
    });
});

export default app;