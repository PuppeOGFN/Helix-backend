import express from "express";
const app = express.Router();
import Utils from "../Utils/Utils.js";
import { verifyToken } from "../User/tokenManager/tokenVerify.js";
import qs from "qs";

import dotenv from "dotenv";
dotenv.config();

let buildUniqueId = {};

app.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
  res.status(200).end();
});

app.get(
  "/fortnite/api/game/v2/matchmakingservice/ticket/player/*",
  verifyToken,
  async (req, res) => {
    const playerCustomKey = qs.parse(req.url.split("?")[1], {
      ignoreQueryPrefix: true,
    })["player.option.customKey"];
    const bucketId = qs.parse(req.url.split("?")[1], {
      ignoreQueryPrefix: true,
    })["bucketId"];

    if (typeof bucketId !== "string" || bucketId.split(":").length !== 4) {
      return res.status(400).end();
    }

    const memory = Utils.GetVersion(req);
    const region = bucketId.split(":")[2].toUpperCase();
    const playlist = bucketId.split(":")[3];

    console.log("Region:", region, "Playlist:", playlist);

    const regionServers = {
      EU: process.env.EU_IP,
      NAE: process.env.NAE_IP,
    };

    const selectedServer = regionServers[region];

    if (!selectedServer || typeof selectedServer !== "string") {
      console.error(
        `Invalid server for region ${region}: value=${selectedServer}, type=${typeof selectedServer}`
      );
      return Utils.createError(
        "errors.com.epicgames.common.matchmaking.config_error",
        `No server configured for region ${region}`,
        [],
        1014,
        "invalid_config",
        500,
        res
      );
    }

    console.log("Selected server:", selectedServer);

    await global.kv.set(`playerPlaylist:${req.user.accountId}`, playlist);
    await global.kv.set(`playerRegion:${req.user.accountId}`, region);

    if (typeof playerCustomKey == "string") {
      return Utils.createError(
        "errors.com.epicgames.common.matchmaking.code.not_found",
        `Custom matchmaking codes are not supported`,
        [],
        1013,
        "invalid_code",
        404,
        res
      );
    }

    if (
      typeof req.query.bucketId !== "string" ||
      req.query.bucketId.split(":").length !== 4
    ) {
      return res.status(400).end();
    }

    buildUniqueId[req.user.accountId] = req.query.bucketId.split(":")[0];
    const matchmakerIP = process.env.MATCHMAKER_IP;

    const serviceUrl =
      matchmakerIP.includes("ws") || matchmakerIP.includes("wss")
        ? `${matchmakerIP}?region=${region}`
        : `ws://${matchmakerIP}?region=${region}`;

    console.log("Sending WebSocket response:", {
      serviceUrl,
      ticketType: "mms-player",
      payload: `account ${region} ${playlist} ${memory.season}`,
    });

    return res.json({
      serviceUrl,
      ticketType: "mms-player",
      payload: `account ${region} ${playlist} ${memory.season}`,
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
  async (req, res) => {
    const playlist = await global.kv.get(`playerPlaylist:${req.user.accountId}`);
    const region = await global.kv.get(`playerRegion:${req.user.accountId}`);

    console.log("Region (session):", region, "Playlist (session):", playlist);

    const regionServers =
    {
      EU: process.env.EU_IP,
      NAE: process.env.NAE_IP,
    };

    const selectedServer = regionServers[region];

    if (!selectedServer || typeof selectedServer !== "string") {
      console.error(
        `Invalid server for region ${region}: value=${selectedServer}, type=${typeof selectedServer}`
      );
      return Utils.createError(
        "errors.com.epicgames.common.matchmaking.config_error",
        `No server configured for region ${region}`,
        [],
        1014,
        "invalid_config",
        500,
        res
      );
    }

    console.log("Selected server (session):", selectedServer);

    const [ip, port] = selectedServer.split(":");
    const kvDocument = JSON.stringify({
      ip,
      port,
      playlist,
      region,
    });

    let codeKV = JSON.parse(kvDocument);

    res.json({
      id: req.params.sessionId,
      ownerId: "1234567890ABCDEF1234567890ABCDEF12345678",
      ownerName: `[DS]fortnite-live${region.toLowerCase()}gcec1c2e30ubrcore0a-z8hj-1968`,
      serverName: `[DS]fortnite-live${region.toLowerCase()}gcec1c2e30ubrcore0a-z8hj-1968`,
      serverAddress: codeKV.ip,
      serverPort: codeKV.port,
      maxPublicPlayers: 220,
      openPublicPlayers: 175,
      maxPrivatePlayers: 0,
      openPrivatePlayers: 0,
      attributes: {
        REGION_s: region,
        GAMEMODE_s: "FORTATHENA",
        ALLOWBROADCASTING_b: true,
        SUBREGION_s: region === "EU" ? "GB" : "US",
        DCID_s: `FORTNITE-LIVE${region}GCEC1C2E30UBRCORE0A-14840880`,
        tenant_s: "Fortnite",
        MATCHMAKINGPOOL_s: "Any",
        STORMSHIELDDEFENSETYPE_i: 0,
        HOTFIXVERSION_i: 0,
        PLAYLISTNAME_s: codeKV.playlist,
        SESSIONKEY_s: "1234567890ABCDEF1234567890ABCDEF12345678",
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