import express from "express";
import axios from "axios";
import sjcl from "sjcl";
import { v4 as uuidv4 } from "uuid";
import User from "../User/Mongodb/Schema/user.js";
import Friends from "../User/Mongodb/Schema/friends.js";
import Utils from "../Utils/Utils.js";
import { verifyToken } from "../User/tokenManager/tokenVerify.js";

const app = express.Router();

if (!global.parties) global.parties = {};

const pings = [];
const vcParticipants = {};
const vcInfo = {};
let lastClient;

function makeId() {
  return uuidv4().replace(/-/g, "");
}

function addHours(date, hours) {
  const d = new Date(date);
  d.setHours(d.getHours() + hours);
  return d;
}

function getCaptain(party) {
  let captain = party.members.find((member) => member.role === "CAPTAIN");
  if (!captain && party.members.length > 0) {
    party.members[0].role = "CAPTAIN";
    captain = party.members[0];
  }
  return captain;
}

function sendXmppMessageToId(accountId, body) {
  Utils.SendXMPPMessage(body, accountId);
}

function createPartyNotFoundError(pid, res) {
  return Utils.createError(
    "errors.com.epicgames.party.not_found",
    `Party ${pid} does not exist!`,
    undefined,
    51002,
    undefined,
    404,
    res
  );
}

function createPartyUnauthorizedError(message, res) {
  return Utils.createError(
    "errors.com.epicgames.party.unauthorized",
    message,
    undefined,
    51015,
    undefined,
    403,
    res
  );
}

app.get(
  "/party/api/v1/Fortnite/user/:accountId/notifications/undelivered/count",
  verifyToken,
  async (req, res) => {
    const party = Object.values(global.parties).find(
      (p) => p.members.findIndex((x) => x.account_id === req.params.accountId) !== -1
    );

    res.json({
      pings: pings.filter((x) => x.sent_to === req.params.accountId).length,
      invites: party
        ? party.invites.filter((invite) => invite.sent_to === req.params.accountId).length
        : 0,
    });
  }
);

app.get("/party/api/v1/Fortnite/user/:accountId", verifyToken, async (req, res) => {
  const party = Object.values(global.parties).filter(
    (p) => p.members.findIndex((x) => x.account_id === req.params.accountId) !== -1
  );

  res.json({
    current: party.length > 0 ? party : [],
    pending: [],
    invites: [],
    pings: pings.filter((x) => x.sent_to === req.params.accountId),
  });
});

app.post("/party/api/v1/Fortnite/parties", verifyToken, async (req, res) => {
  if (!req.body?.join_info?.connection) return res.json({});

  const id = makeId();
  const now = new Date().toISOString();
  const accountId = (req.body.join_info.connection.id || "").split("@prod")[0];

  const party = {
    id,
    created_at: now,
    updated_at: now,
    config: req.body.config || {},
    members: [
      {
        account_id: accountId,
        meta: req.body.join_info.meta || {},
        connections: [
          {
            id: req.body.join_info.connection.id || "",
            connected_at: now,
            updated_at: now,
            yield_leadership: req.body.join_info.connection.yield_leadership || false,
            meta: req.body.join_info.connection.meta || {},
          },
        ],
        revision: 0,
        updated_at: now,
        joined_at: now,
        role: "CAPTAIN",
      },
    ],
    applicants: [],
    meta: req.body.meta || {},
    invites: [],
    revision: 0,
    intentions: [],
  };

  global.parties[id] = party;
  res.json(party);
});

app.patch("/party/api/v1/Fortnite/parties/:pid", verifyToken, async (req, res) => {
  const party = global.parties[req.params.pid];
  if (!party) return createPartyNotFoundError(req.params.pid, res);

  const editingMember = party.members.find((m) => m.account_id === req.user.accountId);
  if (editingMember && editingMember.role !== "CAPTAIN") {
    return createPartyUnauthorizedError(
      `User ${req.user.accountId} is not allowed to edit party ${req.params.pid}!`,
      res
    );
  }

  if (req.body?.config && typeof req.body.config === "object") {
    for (const prop of Object.keys(req.body.config)) {
      party.config[prop] = req.body.config[prop];
    }
  }

  const deletedMeta = Array.isArray(req.body?.meta?.delete) ? req.body.meta.delete : [];
  const updatedMeta = req.body?.meta?.update && typeof req.body.meta.update === "object"
    ? req.body.meta.update
    : {};

  for (const prop of deletedMeta) {
    delete party.meta[prop];
  }

  for (const prop of Object.keys(updatedMeta)) {
    party.meta[prop] = updatedMeta[prop];
  }

  party.revision = req.body?.revision ?? party.revision;
  party.updated_at = new Date().toISOString();
  global.parties[req.params.pid] = party;

  const captain = getCaptain(party);
  res.status(204).send();

  party.members.forEach((member) => {
    sendXmppMessageToId(member.account_id, {
      captain_id: captain?.account_id || "",
      created_at: party.created_at,
      invite_ttl_seconds: 14400,
      max_number_of_members: party.config.max_size,
      ns: "Fortnite",
      party_id: party.id,
      party_privacy_type: party.config.joinability,
      party_state_overriden: {},
      party_state_removed: deletedMeta,
      party_state_updated: updatedMeta,
      party_sub_type: party.meta["urn:epic:cfg:party-type-id_s"],
      party_type: "DEFAULT",
      revision: party.revision,
      sent: new Date().toISOString(),
      type: "com.epicgames.social.party.notification.v0.PARTY_UPDATED",
      updated_at: new Date().toISOString(),
    });
  });
});

app.patch(
  "/party/api/v1/Fortnite/parties/:pid/members/:accountId/meta",
  verifyToken,
  async (req, res) => {
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const memberIndex = party.members.findIndex((m) => m.account_id === req.params.accountId);
    const member = party.members[memberIndex];

    if (!member) return res.status(404).end();
    if (req.user.accountId !== req.params.accountId) {
      return createPartyUnauthorizedError(
        `User ${req.user.accountId} is not allowed to edit member ${req.params.accountId}!`,
        res
      );
    }

    const deleted = req.body?.delete && typeof req.body.delete === "object" ? req.body.delete : {};
    const updated = req.body?.update && typeof req.body.update === "object" ? req.body.update : {};

    for (const prop of Object.keys(deleted)) {
      delete member.meta[prop];
    }

    for (const prop of Object.keys(updated)) {
      member.meta[prop] = updated[prop];
    }

    member.revision = req.body?.revision ?? member.revision;
    member.updated_at = new Date().toISOString();

    party.members[memberIndex] = member;
    party.updated_at = new Date().toISOString();
    global.parties[req.params.pid] = party;

    res.status(204).send();

    party.members.forEach((member2) => {
      sendXmppMessageToId(member2.account_id, {
        account_id: req.params.accountId,
        account_dn: member.meta["urn:epic:member:dn_s"],
        member_state_updated: updated,
        member_state_removed: deleted,
        member_state_overridden: {},
        party_id: party.id,
        updated_at: new Date().toISOString(),
        sent: new Date().toISOString(),
        revision: member.revision,
        ns: "Fortnite",
        type: "com.epicgames.social.party.notification.v0.MEMBER_STATE_UPDATED",
      });
    });
  }
);

app.get("/party/api/v1/Fortnite/parties/:pid", verifyToken, async (req, res) => {
  const party = global.parties[req.params.pid];
  if (!party) return createPartyNotFoundError(req.params.pid, res);
  res.json(party);
});

app.delete(
  "/party/api/v1/Fortnite/parties/:pid/members/:accountId",
  verifyToken,
  async (req, res) => {
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const memberIndex = party.members.findIndex((m) => m.account_id === req.params.accountId);
    const member = party.members[memberIndex];
    if (!member) return res.status(404).end();

    const requester = party.members.find((m) => m.account_id === req.user.accountId);
    const requesterIsCaptain = requester?.role === "CAPTAIN";

    if (req.user.accountId !== req.params.accountId && !requesterIsCaptain) {
      return createPartyUnauthorizedError(
        `User ${req.user.accountId} is not allowed to delete member ${req.params.accountId}!`,
        res
      );
    }

    party.members.forEach((m) => {
      sendXmppMessageToId(m.account_id, {
        account_id: req.params.accountId,
        member_state_update: {},
        ns: "Fortnite",
        party_id: party.id,
        revision: party.revision || 0,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.MEMBER_LEFT",
      });
    });

    party.members.splice(memberIndex, 1);

    res.status(204).end();

    if (party.members.length === 0) {
      delete global.parties[req.params.pid];
      return;
    }

    const assignmentKey = party.meta["Default:RawSquadAssignments_j"]
      ? "Default:RawSquadAssignments_j"
      : "RawSquadAssignments_j";

    if (!party.meta[assignmentKey]) {
      party.updated_at = new Date().toISOString();
      global.parties[req.params.pid] = party;
      return;
    }

    let rsa;
    try {
      rsa = JSON.parse(party.meta[assignmentKey]);
    } catch {
      rsa = { RawSquadAssignments: [] };
    }

    const removedIndex = rsa.RawSquadAssignments.findIndex(
      (a) => a.memberId === req.params.accountId
    );
    if (removedIndex !== -1) {
      rsa.RawSquadAssignments.splice(removedIndex, 1);
    }

    party.meta[assignmentKey] = JSON.stringify(rsa);
    const captain = getCaptain(party);

    party.updated_at = new Date().toISOString();
    global.parties[req.params.pid] = party;

    party.members.forEach((m) => {
      sendXmppMessageToId(m.account_id, {
        captain_id: captain?.account_id || "",
        created_at: party.created_at,
        invite_ttl_seconds: 14400,
        max_number_of_members: 16,
        ns: "Fortnite",
        party_id: party.id,
        party_privacy_type: party.config.joinability,
        party_state_overriden: {},
        party_state_removed: [],
        party_state_updated: {
          [assignmentKey]: JSON.stringify(rsa),
        },
        party_sub_type: party.meta["urn:epic:cfg:party-type-id_s"],
        party_type: "DEFAULT",
        revision: party.revision,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.PARTY_UPDATED",
        updated_at: new Date().toISOString(),
      });
    });
  }
);

app.post(
  "/party/api/v1/Fortnite/parties/:pid/members/:accountId/join",
  verifyToken,
  async (req, res) => {
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const existingIndex = party.members.findIndex((m) => m.account_id === req.params.accountId);
    if (existingIndex !== -1) {
      return res.json({
        status: "JOINED",
        party_id: party.id,
      });
    }

    const now = new Date().toISOString();
    const joinAccountId = (req.body?.connection?.id || "").split("@prod")[0];

    const newMember = {
      account_id: joinAccountId,
      meta: req.body?.meta || {},
      connections: [
        {
          id: req.body?.connection?.id || "",
          connected_at: now,
          updated_at: now,
          yield_leadership: !!req.body?.connection?.yield_leadership,
          meta: req.body?.connection?.meta || {},
        },
      ],
      revision: 0,
      updated_at: now,
      joined_at: now,
      role: req.body?.connection?.yield_leadership ? "CAPTAIN" : "MEMBER",
    };

    party.members.push(newMember);

    const assignmentKey = party.meta["Default:RawSquadAssignments_j"]
      ? "Default:RawSquadAssignments_j"
      : "RawSquadAssignments_j";

    let rsa = null;
    if (party.meta[assignmentKey]) {
      try {
        rsa = JSON.parse(party.meta[assignmentKey]);
      } catch {
        rsa = { RawSquadAssignments: [] };
      }

      rsa.RawSquadAssignments.push({
        memberId: joinAccountId,
        absoluteMemberIdx: party.members.length - 1,
      });

      party.meta[assignmentKey] = JSON.stringify(rsa);
      party.revision = (party.revision || 0) + 1;
    }

    party.updated_at = new Date().toISOString();
    global.parties[req.params.pid] = party;

    const captain = getCaptain(party);

    res.json({
      status: "JOINED",
      party_id: party.id,
    });

    party.members.forEach((member) => {
      sendXmppMessageToId(member.account_id, {
        account_dn: req.body?.connection?.meta?.["urn:epic:member:dn_s"],
        account_id: joinAccountId,
        connection: {
          connected_at: new Date().toISOString(),
          id: req.body?.connection?.id,
          meta: req.body?.connection?.meta,
          updated_at: new Date().toISOString(),
        },
        joined_at: new Date().toISOString(),
        member_state_updated: req.body?.meta || {},
        ns: "Fortnite",
        party_id: party.id,
        revision: 0,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.MEMBER_JOINED",
        updated_at: new Date().toISOString(),
      });

      if (!rsa) return;

      sendXmppMessageToId(member.account_id, {
        captain_id: captain?.account_id || "",
        created_at: party.created_at,
        invite_ttl_seconds: 14400,
        max_number_of_members: party.config.max_size,
        ns: "Fortnite",
        party_id: party.id,
        party_privacy_type: party.config.joinability,
        party_state_overriden: {},
        party_state_removed: [],
        party_state_updated: {
          [assignmentKey]: JSON.stringify(rsa),
        },
        party_sub_type: party.meta["urn:epic:cfg:party-type-id_s"],
        party_type: "DEFAULT",
        revision: party.revision,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.PARTY_UPDATED",
        updated_at: new Date().toISOString(),
      });
    });
  }
);

app.post(
  "/party/api/v1/Fortnite/parties/:pid/members/:accountId/promote",
  verifyToken,
  async (req, res) => {
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const captainIndex = party.members.findIndex((m) => m.role === "CAPTAIN");
    if (captainIndex !== -1 && party.members[captainIndex].account_id !== req.user.accountId) {
      return createPartyUnauthorizedError(
        `User ${req.user.accountId} is not allowed to promote member ${req.params.accountId}!`,
        res
      );
    }

    const newCaptainIndex = party.members.findIndex(
      (m) => m.account_id === req.params.accountId
    );

    if (captainIndex !== -1) {
      party.members[captainIndex].role = "MEMBER";
    }

    if (newCaptainIndex !== -1) {
      party.members[newCaptainIndex].role = "CAPTAIN";
    }

    party.updated_at = new Date().toISOString();
    global.parties[req.params.pid] = party;

    res.status(204).end();

    party.members.forEach((member) => {
      sendXmppMessageToId(member.account_id, {
        account_id: req.params.accountId,
        member_state_update: {},
        ns: "Fortnite",
        party_id: party.id,
        revision: party.revision || 0,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.MEMBER_NEW_CAPTAIN",
      });
    });
  }
);

app.post(
  "/party/api/v1/Fortnite/user/:accountId/pings/:pingerId",
  verifyToken,
  async (req, res) => {
    const memory = Utils.GetVersion(req);

    const existingIndex = pings
      .filter((p) => p.sent_to === req.params.accountId)
      .findIndex((p) => p.sent_by === req.params.pingerId);

    if (existingIndex !== -1) {
      pings.splice(existingIndex, 1);
    }

    const expiresAt = addHours(new Date(), 1).toISOString();
    const ping = {
      sent_by: req.params.pingerId,
      sent_to: req.params.accountId,
      sent_at: new Date().toISOString(),
      expires_at: expiresAt,
      meta: req.body?.meta,
    };

    pings.push(ping);
    res.json(ping);

    const pinger = await User.findOne({ accountId: req.params.pingerId }).lean();

    sendXmppMessageToId(req.params.accountId, {
      expires: ping.expires_at,
      meta: req.body?.meta,
      ns: "Fortnite",
      pinger_dn: pinger?.username || "Unknown",
      pinger_id: req.params.pingerId,
      sent: ping.sent_at,
      version: String(memory.build).padEnd(5, "0"),
      type: "com.epicgames.social.party.notification.v0.PING",
    });
  }
);

app.delete(
  "/party/api/v1/Fortnite/user/:accountId/pings/:pingerId",
  verifyToken,
  async (req, res) => {
    const existingIndex = pings
      .filter((p) => p.sent_to === req.params.accountId)
      .findIndex((p) => p.sent_by === req.params.pingerId);

    if (existingIndex !== -1) {
      pings.splice(existingIndex, 1);
    }

    res.status(204).end();
  }
);

app.get(
  "/party/api/v1/Fortnite/user/:accountId/pings/:pingerId/parties",
  verifyToken,
  async (req, res) => {
    let query = pings.filter(
      (p) => p.sent_to === req.params.accountId && p.sent_by === req.params.pingerId
    );

    if (query.length === 0) {
      query = [{ sent_by: req.params.pingerId }];
    }

    const parties = query
      .map((entry) => {
        const party = Object.values(global.parties).find(
          (p) => p.members.findIndex((m) => m.account_id === entry.sent_by) !== -1
        );

        if (!party) return null;

        return {
          id: party.id,
          created_at: party.created_at,
          updated_at: party.updated_at,
          config: party.config,
          members: party.members,
          applicants: [],
          meta: party.meta,
          invites: [],
          revision: party.revision || 0,
        };
      })
      .filter((x) => x !== null);

    res.json(parties);
  }
);

app.post(
  "/party/api/v1/Fortnite/user/:accountId/pings/:pingerId/join",
  verifyToken,
  async (req, res) => {
    let query = pings.filter(
      (p) => p.sent_to === req.params.accountId && p.sent_by === req.params.pingerId
    );

    if (query.length === 0) {
      query = [{ sent_by: req.params.pingerId }];
    }

    const party = Object.values(global.parties).find(
      (p) => p.members.findIndex((m) => m.account_id === query[0].sent_by) !== -1
    );

    if (!party) {
      return Utils.createError(
        "errors.com.epicgames.party.not_found",
        "Party does not exist!",
        undefined,
        51002,
        undefined,
        404,
        res
      );
    }

    const existingIndex = party.members.findIndex((m) => m.account_id === req.params.accountId);
    if (existingIndex !== -1) {
      return res.json({
        status: "JOINED",
        party_id: party.id,
      });
    }

    const now = new Date().toISOString();
    const joinAccountId = (req.body?.connection?.id || "").split("@prod")[0];

    const newMember = {
      account_id: joinAccountId,
      meta: req.body?.meta || {},
      connections: [
        {
          id: req.body?.connection?.id || "",
          connected_at: now,
          updated_at: now,
          yield_leadership: !!req.body?.connection?.yield_leadership,
          meta: req.body?.connection?.meta || {},
        },
      ],
      revision: 0,
      updated_at: now,
      joined_at: now,
      role: req.body?.connection?.yield_leadership ? "CAPTAIN" : "MEMBER",
    };

    party.members.push(newMember);

    const assignmentKey = party.meta["Default:RawSquadAssignments_j"]
      ? "Default:RawSquadAssignments_j"
      : "RawSquadAssignments_j";

    let rsa = null;
    if (party.meta[assignmentKey]) {
      try {
        rsa = JSON.parse(party.meta[assignmentKey]);
      } catch {
        rsa = { RawSquadAssignments: [] };
      }

      rsa.RawSquadAssignments.push({
        memberId: joinAccountId,
        absoluteMemberIdx: party.members.length - 1,
      });

      party.meta[assignmentKey] = JSON.stringify(rsa);
      party.revision = (party.revision || 0) + 1;
    }

    party.updated_at = new Date().toISOString();
    global.parties[party.id] = party;

    const captain = getCaptain(party);

    res.json({
      status: "JOINED",
      party_id: party.id,
    });

    party.members.forEach((member) => {
      sendXmppMessageToId(member.account_id, {
        account_dn: req.body?.connection?.meta?.["urn:epic:member:dn_s"],
        account_id: joinAccountId,
        connection: {
          connected_at: new Date().toISOString(),
          id: req.body?.connection?.id,
          meta: req.body?.connection?.meta,
          updated_at: new Date().toISOString(),
        },
        joined_at: new Date().toISOString(),
        member_state_updated: req.body?.meta || {},
        ns: "Fortnite",
        party_id: party.id,
        revision: 0,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.MEMBER_JOINED",
        updated_at: new Date().toISOString(),
      });

      if (!rsa) return;

      sendXmppMessageToId(member.account_id, {
        captain_id: captain?.account_id || "",
        created_at: party.created_at,
        invite_ttl_seconds: 14400,
        max_number_of_members: party.config.max_size,
        ns: "Fortnite",
        party_id: party.id,
        party_privacy_type: party.config.joinability,
        party_state_overriden: {},
        party_state_removed: [],
        party_state_updated: {
          [assignmentKey]: JSON.stringify(rsa),
        },
        party_sub_type: party.meta["urn:epic:cfg:party-type-id_s"],
        party_type: "DEFAULT",
        revision: party.revision,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.PARTY_UPDATED",
        updated_at: new Date().toISOString(),
      });
    });
  }
);

app.post(
  "/party/api/v1/Fortnite/parties/:pid/invites/:accountId",
  verifyToken,
  async (req, res) => {
    const memory = Utils.GetVersion(req);
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const existingIndex = party.invites
      .filter((invite) => invite.sent_to === req.params.accountId)
      .findIndex((invite) => invite.sent_by === req.user.accountId);

    if (existingIndex !== -1) {
      party.invites.splice(existingIndex, 1);
    }

    const expiresAt = addHours(new Date(), 1).toISOString();
    const invite = {
      party_id: party.id,
      sent_by: req.user.accountId,
      meta: req.body,
      sent_to: req.params.accountId,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
      status: "SENT",
    };

    party.invites.push(invite);
    party.updated_at = new Date().toISOString();
    global.parties[req.params.pid] = party;

    const friends = await Friends.findOne({ accountId: req.user.accountId }).lean();
    const inviter = party.members.find((x) => x.account_id === req.user.accountId);

    res.status(204).end();

    sendXmppMessageToId(req.params.accountId, {
      expires: invite.expires_at,
      meta: req.body,
      ns: "Fortnite",
      party_id: party.id,
      inviter_dn: inviter?.meta?.["urn:epic:member:dn_s"],
      inviter_id: req.user.accountId,
      invitee_id: req.params.accountId,
      members_count: party.members.length,
      sent_at: invite.sent_at,
      updated_at: invite.updated_at,
      friends_ids: party.members
        .filter((m) => friends?.list?.accepted?.find((f) => f.accountId === m.account_id))
        .map((m) => m.account_id),
      sent: new Date().toISOString(),
      type: "com.epicgames.social.party.notification.v0.INITIAL_INVITE",
    });

    if (req.query.sendPing === "true") {
      const existingPingIndex = pings
        .filter((p) => p.sent_to === req.params.accountId)
        .findIndex((p) => p.sent_by === req.user.accountId);

      if (existingPingIndex !== -1) {
        pings.splice(existingPingIndex, 1);
      }

      const ping = {
        sent_by: req.user.accountId,
        sent_to: req.params.accountId,
        sent_at: new Date().toISOString(),
        expires_at: addHours(new Date(), 1).toISOString(),
        meta: req.body,
      };

      pings.push(ping);

      sendXmppMessageToId(req.params.accountId, {
        expires: invite.expires_at,
        meta: req.body?.meta,
        ns: "Fortnite",
        pinger_dn: inviter?.meta?.["urn:epic:member:dn_s"],
        pinger_id: req.user.accountId,
        sent: invite.sent_at,
        version: String(memory.build).padEnd(5, "0"),
        type: "com.epicgames.social.party.notification.v0.PING",
      });
    }
  }
);

app.post(
  [
    "/party/api/v1/Fortnite/parties/:pid/invites/:accountId/decline",
    "/party/api/v1/Fortnite/parties/:pid/invites/:accountId/*/decline",
  ],
  verifyToken,
  async (req, res) => {
    const party = global.parties[req.params.pid];
    if (!party) return createPartyNotFoundError(req.params.pid, res);

    const invite = party.invites.find((i) => i.sent_to === req.params.accountId);
    if (!invite) {
      return Utils.createError(
        "errors.com.epicgames.party.not_found",
        `Invite ${req.params.pid} does not exist!`,
        undefined,
        51002,
        undefined,
        404,
        res
      );
    }

    const inviter = party.members.find((x) => x.account_id === invite.sent_by);

    res.status(204).end();

    if (inviter) {
      sendXmppMessageToId(invite.sent_by, {
        expires: invite.expires_at,
        meta: req.body,
        ns: "Fortnite",
        party_id: party.id,
        inviter_dn: inviter.meta?.["urn:epic:member:dn_s"],
        inviter_id: invite.sent_by,
        invitee_id: req.params.accountId,
        sent_at: invite.sent_at,
        updated_at: invite.updated_at,
        sent: new Date().toISOString(),
        type: "com.epicgames.social.party.notification.v0.INVITE_CANCELLED",
      });
    }
  }
);

app.post(
  "/party/api/v1/Fortnite/members/:accountId/intentions/:senderId",
  verifyToken,
  async (req, res) => {
    const party = Object.values(global.parties).find(
      (p) => p.members.findIndex((m) => m.account_id === req.params.senderId) !== -1
    );

    if (!party) {
      return Utils.createError(
        "errors.com.epicgames.party.not_found",
        "Party does not exist!",
        undefined,
        51002,
        undefined,
        404,
        res
      );
    }

    const sender = party.members.find((x) => x.account_id === req.params.senderId);
    const captain = getCaptain(party);
    const friends = await Friends.findOne({ accountId: req.params.accountId }).lean();

    const intention = {
      requester_id: req.params.senderId,
      requester_dn: sender?.meta?.["urn:epic:member:dn_s"],
      requester_pl: captain?.account_id,
      requester_pl_dn: captain?.meta?.["urn:epic:member:dn_s"],
      requestee_id: req.params.accountId,
      meta: req.body,
      expires_at: addHours(new Date(), 1).toISOString(),
      sent_at: new Date().toISOString(),
    };

    party.intentions.push(intention);
    res.json(intention);

    sendXmppMessageToId(req.params.accountId, {
      expires_at: intention.expires_at,
      requester_id: req.params.senderId,
      requester_dn: sender?.meta?.["urn:epic:member:dn_s"],
      requester_pl: captain?.account_id,
      requester_pl_dn: captain?.meta?.["urn:epic:member:dn_s"],
      requestee_id: req.params.accountId,
      meta: req.body,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      friends_ids: party.members
        .filter((m) => friends?.list?.accepted?.find((f) => f.accountId === m.account_id))
        .map((m) => m.account_id),
      members_count: party.members.length,
      party_id: party.id,
      ns: "Fortnite",
      sent: new Date().toISOString(),
      type: "com.epicgames.social.party.notification.v0.INITIAL_INTENTION",
    });
  }
);

function base64URLEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function vxGenerateToken(key, payload) {
  const base64urlHeader = base64URLEncode("{}");
  const base64urlPayload = base64URLEncode(JSON.stringify(payload));

  const segments = [base64urlHeader, base64urlPayload];
  const toSign = segments.join(".");

  const hmac = new sjcl.misc.hmac(sjcl.codec.utf8String.toBits(key), sjcl.hash.sha256);
  const signature = sjcl.codec.base64.fromBits(hmac.encrypt(toSign));
  const base64urlSigned = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  segments.push(base64urlSigned);
  return segments.join(".");
}

app.post(
  "/party/api/v1/Fortnite/parties/:pid/members/:accountId/conferences/connection",
  verifyToken,
  async (req, res) => {
    const { pid, accountId } = req.params;

    let vivox = req.body?.providers?.vivox;
    let rtcp = req.body?.providers?.rtcp;

    const party = global.parties[pid];
    if (!party) return createPartyNotFoundError(pid, res);

    if (rtcp) {
      if (!lastClient || new Date(lastClient.expires_at).getTime() <= Date.now()) {
        const response = await axios.post(
          "https://api.epicgames.dev/auth/v1/oauth/token",
          "grant_type=client_credentials&deployment_id=8949d22a1748462abe3e938fd7e19e5c",
          {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            auth: {
              username: "xyza7891InagL5qaPE6DzJBNn14sBWgF",
              password: "NvJM0I6mKNEMCnn89DtEJTiZRfWW6YsAZjicl6IVols",
            },
          }
        );

        lastClient = response.data;
      }

      if (!vcParticipants[pid]) vcParticipants[pid] = [];

      const participant = {
        puid: accountId,
        clientIP: req.ip,
        hardMuted: false,
      };

      if (!vcParticipants[pid].find((m) => m.puid === participant.puid)) {
        vcParticipants[pid].push(participant);
      }

      const toProperCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

      const room = await axios.post(
        `https://api.epicgames.dev/rtc/v1/8949d22a1748462abe3e938fd7e19e5c/room/${pid}`,
        {
          participants: vcParticipants[pid],
        },
        {
          headers: {
            authorization: `${toProperCase(lastClient.token_type)} ${lastClient.access_token}`,
          },
        }
      );

      const joinToken = room.data;
      const tokenMap = {};
      for (const participantData of joinToken.participants || []) {
        tokenMap[participantData.puid] = participantData.token;
      }

      vcInfo[pid] = {
        name: joinToken.roomId,
        url: joinToken.clientBaseUrl,
        tokens: tokenMap,
      };

      rtcp = {
        participant_token: vcInfo[pid].tokens[accountId],
        client_base_url: vcInfo[pid].url,
        room_name: vcInfo[pid].name,
      };
    } else {
      const channel_uri = `sip:confctl-g-epicgames.p-${pid}@mtu1xp.vivox.com`;
      const user_uri = `sip:.epicgames.${accountId}.@mtu1xp.vivox.com`;

      const vivoxClaims = {
        iss: "epicgames",
        sub: accountId,
        exp: Math.floor(addHours(new Date(), 2).getTime() / 1000),
        vxa: "join",
        f: user_uri,
        t: channel_uri,
      };

      const token = vxGenerateToken("zcETsPpEAysznTyDXK4TEzwLQPcTvTAO", vivoxClaims);

      vivox = {
        authorization_token: token,
        channel_uri,
        user_uri,
      };
    }

    res.json({
      providers: {
        rtcp,
        vivox,
      },
    });
  }
);

export default app;
