import express from "express";
const app = express.Router();
import Utils from "../Utils/Utils.js";
import Friends from "../User/Mongodb/Schema/friends.js";
import { friends } from "../Utils/friend.js";
import { verifyToken } from "../User/tokenManager/tokenVerify.js";
import Log from "../Utils/log.js";

app.get("/friends/api/v1/*/settings", (req, res) => {
  Log.request(`GET /friends/api/v1/*/settings - ${req.user?.accountId || "unauthenticated"}`);
  res.json({});
});

app.get("/friends/api/v1/*/blocklist", (req, res) => {
  Log.request(`GET /friends/api/v1/*/blocklist - ${req.user?.accountId || "unauthenticated"}`);
  res.json([]);
});

app.get("/friends/api/public/list/fortnite/*/recentPlayers", (req, res) => {
  Log.request(`GET /friends/api/public/list/fortnite/*/recentPlayers - ${req.user?.accountId || "unauthenticated"}`);
  res.json([]);
});

app.get("/friends/api/public/friends/:accountId", verifyToken, async (req, res) => {
  Log.request(`GET /friends/api/public/friends/${req.params.accountId} - ${req.user.accountId}`);
  let response = [];
  const friendsDoc = await Friends.findOne({ accountId: req.user.accountId }).lean();

  friendsDoc?.list.accepted.forEach((f) => {
    response.push({
      accountId: f.accountId,
      status: "ACCEPTED",
      direction: "OUTBOUND",
      created: f.created,
      favorite: false,
    });
  });

  friendsDoc?.list.incoming.forEach((f) => {
    response.push({
      accountId: f.accountId,
      status: "PENDING",
      direction: "INBOUND",
      created: f.created,
      favorite: false,
    });
  });

  friendsDoc?.list.outgoing.forEach((f) => {
    response.push({
      accountId: f.accountId,
      status: "PENDING",
      direction: "OUTBOUND",
      created: f.created,
      favorite: false,
    });
  });

  res.json(response);
});

app.post("/friends/api/*/friends*/:receiverId", verifyToken, async (req, res) => {
  Log.request(`POST /friends/api/*/friends/${req.params.receiverId} - ${req.user.accountId}`);
  const sender = await Friends.findOne({ accountId: req.user.accountId });
  const receiver = await Friends.findOne({ accountId: req.params.receiverId });

  if (!sender || !receiver) {
    Log.error(`Friend request failed (user not found) - ${req.user.accountId} to ${req.params.receiverId}`);
    return res.status(403).end();
  }

  if (sender.list.incoming.find((i) => i.accountId === receiver.accountId)) {
    if (await friends.acceptFriendReq(sender.accountId, receiver.accountId)) {
      Log.info(`Friend request ACCEPTED - ${sender.accountId} <-> ${receiver.accountId}`);
      Utils.GetXMPPStatus(sender.accountId, receiver.accountId, false);
      Utils.GetXMPPStatus(receiver.accountId, sender.accountId, false);
    } else {
      Log.error(`Failed to accept friend request - ${sender.accountId} & ${receiver.accountId}`);
      return res.status(403).end();
    }
  } else if (!sender.list.outgoing.find((i) => i.accountId === receiver.accountId)) {
    if (await friends.sendFriendReq(sender.accountId, receiver.accountId)) {
      Log.info(`Friend request SENT - ${sender.accountId} -> ${receiver.accountId}`);
    } else {
      Log.error(`Failed to send friend request - ${sender.accountId} -> ${receiver.accountId}`);
      return res.status(403).end();
    }
  }
  res.status(204).end();
});

app.all("/friends/api/v1/*/friends/:friendId/alias", verifyToken, getRawBody, async (req, res) => {
  Log.request(`${req.method} /friends/api/v1/*/friends/${req.params.friendId}/alias - ${req.user.accountId}`);
  const friendsDoc = await Friends.findOne({ accountId: req.user.accountId }).lean();
  const friendIndex = friendsDoc?.list.accepted.findIndex((i) => i.accountId === req.params.friendId);

  if (friendIndex === -1 || friendIndex === undefined) {
    Log.error(`Alias change failed (not friends) - ${req.user.accountId} & ${req.params.friendId}`);
    return Utils.createError("errors.com.epicgames.friends.friendship_not_found", `Friendship between ${req.user.accountId} and ${req.params.friendId} does not exist`, [req.user.accountId, req.params.friendId], 14004, undefined, 404, res);
  }

  const aliasPattern = /[\w \-_.'\u2018\u2019]+/gu;

  if (req.method === "PUT") {
    if (!aliasPattern.test(req.rawBody) || req.rawBody.length < 3 || req.rawBody.length > 16) {
      Log.warn(`Invalid alias attempt - ${req.user.accountId} tried "${req.rawBody}"`);
      return Utils.createError("errors.com.epicgames.validation.validation_failed", "Validation Failed. Invalid fields were [alias]", ["[alias]"], 1040, undefined, 404, res);
    }
    await Friends.updateOne(
      { accountId: req.user.accountId, "list.accepted.accountId": req.params.friendId },
      { $set: { "list.accepted.$.alias": req.rawBody } }
    );
    Log.info(`Alias set to "${req.rawBody}" for ${req.params.friendId} by ${req.user.accountId}`);
  }

  if (req.method === "DELETE") {
    await Friends.updateOne(
      { accountId: req.user.accountId, "list.accepted.accountId": req.params.friendId },
      { $set: { "list.accepted.$.alias": "" } }
    );
    Log.info(`Alias removed for ${req.params.friendId} by ${req.user.accountId}`);
  }

  res.status(204).end();
});

app.delete("/friends/api/*/friends*/:receiverId", verifyToken, async (req, res) => {
  Log.request(`DELETE /friends/api/*/friends/${req.params.receiverId} - ${req.user.accountId}`);
  const sender = await Friends.findOne({ accountId: req.user.accountId });
  const receiver = await Friends.findOne({ accountId: req.params.receiverId });

  if (!sender || !receiver) return res.status(403).end();

  if (await friends.deleteFriend(sender.accountId, receiver.accountId)) {
    Log.warn(`Friend removed - ${sender.accountId} <-> ${receiver.accountId}`);
    Utils.GetXMPPStatus(sender.accountId, receiver.accountId, true);
    Utils.GetXMPPStatus(receiver.accountId, sender.accountId, true);
  } else {
    Log.error(`Failed to remove friend - ${sender.accountId} & ${receiver.accountId}`);
    return res.status(403).end();
  }

  res.status(204).end();
});

app.post("/friends/api/*/blocklist*/:receiverId", verifyToken, async (req, res) => {
  Log.request(`POST /friends/api/*/blocklist/${req.params.receiverId} - ${req.user.accountId}`);
  const sender = await Friends.findOne({ accountId: req.user.accountId });
  const receiver = await Friends.findOne({ accountId: req.params.receiverId });

  if (!sender || !receiver) return res.status(403).end();

  if (await friends.blockFriend(sender.accountId, receiver.accountId)) {
    Log.warn(`User BLOCKED - ${sender.accountId} blocked ${receiver.accountId}`);
    Utils.GetXMPPStatus(sender.accountId, receiver.accountId, true);
    Utils.GetXMPPStatus(receiver.accountId, sender.accountId, true);
  } else {
    Log.error(`Failed to block user - ${sender.accountId} -> ${receiver.accountId}`);
    return res.status(403).end();
  }

  res.status(204).end();
});

app.delete("/friends/api/*/blocklist*/:receiverId", verifyToken, async (req, res) => {
  Log.request(`DELETE /friends/api/*/blocklist/${req.params.receiverId} - ${req.user.accountId}`);
  const sender = await Friends.findOne({ accountId: req.user.accountId });
  const receiver = await Friends.findOne({ accountId: req.params.receiverId });

  if (!sender || !receiver) return res.status(403).end();

  if (await friends.unblockFriend(sender.accountId, receiver.accountId)) {
    Log.info(`User UNBLOCKED - ${sender.accountId} unblocked ${receiver.accountId}`);
  } else {
    Log.error(`Failed to unblock user - ${sender.accountId} -> ${receiver.accountId}`);
    return res.status(403).end();
  }

  res.status(204).end();
});

app.get("/friends/api/v1/:accountId/summary", verifyToken, async (req, res) => {
  Log.request(`GET /friends/api/v1/${req.params.accountId}/summary - ${req.user.accountId}`);
  let response = { friends: [], incoming: [], outgoing: [], suggested: [], blocklist: [], settings: { acceptInvites: "public" } };
  const doc = await Friends.findOne({ accountId: req.user.accountId }).lean();

  doc?.list.accepted.forEach((f) => {
    response.friends.push({
      accountId: f.accountId,
      groups: [],
      mutual: 0,
      alias: f.alias || "",
      note: "",
      favorite: false,
      created: f.created,
    });
  });

  doc?.list.incoming.forEach((f) => response.incoming.push({ accountId: f.accountId, mutual: 0, favorite: false, created: f.created }));
  doc?.list.outgoing.forEach((f) => response.outgoing.push({ accountId: f.accountId, favorite: false }));
  doc?.list.blocked.forEach((f) => response.blocklist.push({ accountId: f.accountId }));

  res.json(response);
});

app.get("/friends/api/public/blocklist/*", verifyToken, async (req, res) => {
  Log.request(`GET /friends/api/public/blocklist/* - ${req.user.accountId}`);
  const doc = await Friends.findOne({ accountId: req.user.accountId }).lean();
  res.json({ blockedUsers: doc?.list.blocked.map((i) => i.accountId) || [] });
});

export function getRawBody(req, res, next) {
  if (req.headers["content-length"] && Number(req.headers["content-length"]) > 16) {
    return res.status(403).json({ error: "File size must be 16 bytes or less." });
  }
  req.rawBody = "";
  req.on("data", (chunk) => (req.rawBody += chunk));
  req.on("end", () => next());
}

export default app;