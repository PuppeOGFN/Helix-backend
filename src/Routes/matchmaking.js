import express from "express";
import { v4 as uuidv4 } from "uuid";
import { verifyToken } from "../User/tokenManager/tokenVerify.js";

const app = express.Router();
let buildUniqueId = {};

function makeId() {
  return uuidv4().replace(/-/gi, "").toUpperCase();
}

function getMatchmakerIp() {
  const raw = (process.env.MATCHMAKER_IP || "127.0.0.1:81").trim();
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  return `ws://${raw}`;
}

function getGameServerInfo() {
  const firstServer = (process.env.GAMESERVER_IP || "127.0.0.1:7777")
    .split(",")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  const parts = (firstServer || "127.0.0.1:7777").split(":");
  const serverAddress = parts[0] || "127.0.0.1";
  const parsedPort = Number(parts[1]);
  const serverPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 7777;

  return { serverAddress, serverPort };
}

app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
  res.status(200).end();
});

app.get(
  "/fortnite/api/game/v2/matchmakingservice/ticket/player/*",
  verifyToken,
  (req, res) => {
    if (typeof req.query.bucketId !== "string") return res.status(400).end();
    if (req.query.bucketId.split(":").length !== 4) return res.status(400).end();

    buildUniqueId[req.user.accountId] = req.query.bucketId.split(":")[0];

    res.json({
      serviceUrl: getMatchmakerIp(),
      ticketType: "mms-player",
      payload: "69=",
      signature: "420=",
    });
  }
);

app.get(
  "/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId",
  (req, res) => {
    res.json({
      accountId: req.params.accountId,
      sessionId: req.params.sessionId,
      key: "none",
    });
  }
);

app.get(
  "/fortnite/api/matchmaking/session/:sessionId",
  verifyToken,
  (req, res) => {
    const gameServerInfo = getGameServerInfo();

    res.json({
      id: req.params.sessionId,
      ownerId: makeId(),
      ownerName: "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
      serverName: "[DS]fortnite-liveeugcec1c2e30ubrcore0a-z8hj-1968",
      serverAddress: gameServerInfo.serverAddress,
      serverPort: gameServerInfo.serverPort,
      maxPublicPlayers: 220,
      openPublicPlayers: 175,
      maxPrivatePlayers: 0,
      openPrivatePlayers: 0,
      attributes: {
        REGION_s: "EU",
        GAMEMODE_s: "FORTATHENA",
        ALLOWBROADCASTING_b: true,
        SUBREGION_s: "GB",
        DCID_s: "FORTNITE-LIVEEUGCEC1C2E30UBRCORE0A-14840880",
        tenant_s: "Fortnite",
        MATCHMAKINGPOOL_s: "Any",
        STORMSHIELDDEFENSETYPE_i: 0,
        HOTFIXVERSION_i: 0,
        PLAYLISTNAME_s: "Playlist_DefaultSolo",
        SESSIONKEY_s: makeId(),
        TENANT_s: "Fortnite",
        BEACONPORT_i: 15009,
      },
      publicPlayers: [],
      privatePlayers: [],
      totalPlayers: 45,
      allowJoinInProgress: false,
      shouldAdvertise: false,
      isDedicated: false,
      usesStats: false,
      allowInvites: false,
      usesPresence: false,
      allowJoinViaPresence: true,
      allowJoinViaPresenceFriendsOnly: false,
      buildUniqueId: buildUniqueId[req.user.accountId] || "0",
      lastUpdated: new Date().toISOString(),
      started: false,
    });
  }
);

app.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
  res.status(204).end();
});

app.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
  res.json([]);
});

export default app;
