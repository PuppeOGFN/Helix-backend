import { WebSocketServer as WebSocket } from "ws";
import http from "http";
import log from "../log/logs.js";
import crypto from "crypto";

import dotenv from "dotenv";
dotenv.config();

class Queue {
  constructor() {
    this.items = {
      EU: [],
      NAE: [],
    };
  }

  enqueue(item, region) {
    if (!this.items[region]) {
      throw new Error(`Unsupported region: ${region}`);
    }
    this.items[region].push(item);
  }

  dequeue(region) {
    if (!this.items[region] || this.isEmpty(region)) {
      return null;
    }
    return this.items[region].shift();
  }

  isEmpty(region) {
    return !this.items[region] || this.items[region].length === 0;
  }

  size(region) {
    return this.items[region] ? this.items[region].length : 0;
  }
}

const wsPort = 81;
const httpPort = 82;
const wss = new WebSocket({ port: wsPort });
const queue = new Queue();
const queuedPlayers = { EU: 0, NAE: 0 };
let joinableRequestSent = { EU: false, NAE: false };

const server = http.createServer((req, res) => {
  const urlParts = req.url.split("/");
  const region = urlParts[2]?.toUpperCase();

  if (
    req.method === "GET" &&
    urlParts[1] === "joinable" &&
    region in queuedPlayers
  ) {
    log.joinable(`Request Received for ${region}!`);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Joinable");
    joinableRequestSent[region] = true;
    processQueue(region);
  } else if (
    req.method === "GET" &&
    urlParts[1] === "notjoinable" &&
    region in queuedPlayers
  ) {
    log.notjoinable(`Request Received for ${region}!`);
    joinableRequestSent[region] = false;
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Not Joinable");
  } else if (
    req.method === "GET" &&
    urlParts[1] === "queuedPlayers" &&
    region in queuedPlayers
  ) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`${queuedPlayers[region]}`);
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Invalid Endpoint or Region");
  }
});

wss.on("listening", () => {
  log.mm(`started listening on port ${wsPort}`);
});

server.listen(httpPort, () => {
  log.http(`started on port ${httpPort}`);
});

wss.on("connection", async (ws, req) => {
  if (ws.protocol.toLowerCase().includes("xmpp")) {
    log.error("XMPP protocol detected, closing connection");
    return ws.close();
  }

  log.error(`Raw WebSocket URL: ${req.url}`);
  log.error(`WebSocket Headers: ${JSON.stringify(req.headers)}`);

  let region;
  const urlParts = req.url.split("?");
  const queryString = urlParts[1] || "";
  const urlParams = new URLSearchParams(queryString);
  region = urlParams.get("region")?.toUpperCase();

  if (!region) {
    const host = req.headers.host || "127.0.0.1";
    const fullUrl = `ws://${host}:${wsPort}${req.url}`;
    log.error(`Reconstructed WebSocket URL: ${fullUrl}`);
    try {
      const url = new URL(fullUrl);
      region = url.searchParams.get("region")?.toUpperCase();
    } catch (error) {
      log.error(`Failed to parse reconstructed URL: ${error.message}`);
    }
  }

  if (!region && req.headers.authorization) {
    const auth = req.headers.authorization;
    log.error(`Parsing authorization header: ${auth}`);
    const authParts = auth.split(" ");
    log.error(`Authorization parts: ${JSON.stringify(authParts)}`);
    if (authParts.length >= 4 && authParts[2] === "account") {
      region = authParts[3].toUpperCase();
      log.error(`Region extracted from authorization header: ${region}`);
    } else {
      log.error("Failed to parse region from authorization header");
    }
  }

  log.error(`Final parsed region: ${region || "none"}`);

  if (!region) {
    const timeout = setTimeout(() => {
      log.error("No region received within 30 seconds, defaulting to EU");
      region = "EU";
      ws.region = region;
      handleConnection(ws, region);
    }, 30000);

    ws.on("message", (message) => {
      const msgStr = message.toString();
      log.error(`Received WebSocket message: ${msgStr}`);

      if (msgStr === "ping") {
        ws.send("pong");
        return;
      }

      const parts = msgStr.split(" ");
      if (parts.length >= 2 && parts[0] === "account") {
        clearTimeout(timeout);
        region = parts[1].toUpperCase();
        if (!["EU", "NAE"].includes(region)) {
          log.error(`Unsupported region: ${region}`);
          ws.send(
            JSON.stringify({
              name: "Error",
              payload: { error: `Unsupported region: ${region}` },
            })
          );
          ws.close();
          return;
        }
        ws.region = region;
        handleConnection(ws, region);
      } else {
        log.error(`Invalid payload format: ${msgStr}`);
        ws.send(
          JSON.stringify({
            name: "Error",
            payload: { error: `Invalid payload format: ${msgStr}` },
          })
        );
        ws.close();
      }
    });
  }

  if (region) {
    if (!["EU", "NAE"].includes(region)) {
      log.error(`Unsupported region: ${region}`);
      ws.send(
        JSON.stringify({
          name: "Error",
          payload: { error: `Unsupported region: ${region}` },
        })
      );
      ws.close();
      return;
    }
    ws.region = region;
    handleConnection(ws, region);
  }
});

const handleConnection = (ws, region) => {
  let isConnected = true;

  queuedPlayers[region]++;
  log.queue(`Player Queued in ${region}!`);
  queue.enqueue(ws, region);
  sendStatusUpdateToAll("Queued", region, null, queue.size(region));
  if (queue.size(region) === 1) {
    processQueue(region);
  }

  ws.on("close", (code, reason) => {
    log.error(
      `WebSocket connection closed: code=${code}, reason=${reason || "none"}`
    );
    if (isConnected) {
      isConnected = false;
      queuedPlayers[region]--;
      log.unqueue(`Player Unqueued from ${region}!`);
      if (queue.items[region].includes(ws)) {
        const index = queue.items[region].indexOf(ws);
        queue.items[region].splice(index, 1);
        sendStatusUpdateToAll("Unqueued", region, null, queue.size(region));
      }
    }
  });

  ws.on("error", (err) => {
    log.error(`WebSocket error: ${err.message}`);
  });
};

const processQueue = (region) => {
  if (!queue.isEmpty(region)) {
    const ws = queue.dequeue(region);
    if (ws) {
      handleWebSocket(ws, region);
    }
  }
};

const handleWebSocket = (ws, region) => {
  const ticketId = crypto
    .createHash("md5")
    .update(`1${Date.now()}`)
    .digest("hex");
  const matchId = crypto
    .createHash("md5")
    .update(`2${Date.now()}`)
    .digest("hex");
  const sessionId = crypto
    .createHash("md5")
    .update(`3${Date.now()}`)
    .digest("hex");

  sendStatusUpdate(ws, "Connecting", region);
  waitForJoinable(ws, region, ticketId, matchId, sessionId);
};

const waitForJoinable = (ws, region, ticketId, matchId, sessionId) => {
  sendStatusUpdate(ws, "Waiting", region);

  const checkInterval = setInterval(() => {
    if (joinableRequestSent[region]) {
      clearInterval(checkInterval);
      checkJoinable(ws, region, ticketId, matchId, sessionId);
    } else {
      const queuedPlayersCount = queuedPlayers[region];
      sendStatusUpdate(ws, "Queued", region, ticketId, queuedPlayersCount);
    }
  }, 5);
};

const checkJoinable = (ws, region, ticketId, matchId, sessionId) => {
  sendStatusUpdate(ws, "Queued", region, ticketId);
  setTimeout(() => {
    sendStatusUpdate(
      ws,
      "SessionAssignment",
      region,
      null,
      null,
      null,
      matchId
    );
    setTimeout(() => {
      sendPlayMessage(ws, region, matchId, sessionId);
      processQueue(region);
    }, 2000);
  }, 200);
};

const sendStatusUpdate = (
  ws,
  state,
  region,
  ticketId = null,
  queuedPlayersCount = null,
  matchId = null
) => {
  const payload = {
    state: state,
    region: region,
    queuedPlayers:
      queuedPlayersCount !== null ? queuedPlayersCount : queuedPlayers[region],
  };
  if (ticketId) {
    payload.ticketId = ticketId;
  }
  if (matchId) {
    payload.matchId = matchId;
  }
  ws.send(
    JSON.stringify({
      name: "StatusUpdate",
      payload: payload,
    })
  );
};

const sendPlayMessage = (ws, region, matchId, sessionId) => {
  const message = JSON.stringify({
    name: "Play",
    payload: {
      matchId: matchId,
      sessionId: sessionId,
      joinDelaySec: 5,
    },
  });
  ws.send(message);
};

const sendStatusUpdateToAll = (
  state,
  region,
  ticketId = null,
  queuedPlayersCount = null,
  matchId = null
) => {
  const payload = {
    state: state,
    region: region,
    queuedPlayers:
      queuedPlayersCount !== null ? queuedPlayersCount : queuedPlayers[region],
  };
  if (ticketId) {
    payload.ticketId = ticketId;
  }
  if (matchId) {
    payload.matchId = matchId;
  }
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.region === region) {
      client.send(
        JSON.stringify({
          name: "StatusUpdate",
          payload: payload,
        })
      );
    }
  });
};
