import axios from "axios";
import dotenv from "dotenv";
import bcrypt from "bcrypt";
import XMLBuilder from "xmlbuilder";
import User from "../User/Mongodb/Schema/user.js";
import Profile from "../User/Mongodb/Schema/profiles.js";
import Friends from "../User/Mongodb/Schema/friends.js";
import profileManager from "../User/profile.js";
import log from "./log.js";
import { v4 } from "uuid";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

export default class Utils {
  static createError(
    errorCode,
    errorMessage,
    messageVars,
    numericErrorCode,
    error,
    statusCode,
    res
  ) {
    log.error(`API Error ${numericErrorCode} - ${errorCode}: ${errorMessage}`);
    res.set({
      "X-Epic-Error-Name": errorCode,
      "X-Epic-Error-Code": numericErrorCode,
    });
    res.status(statusCode).json({
      errorCode,
      errorMessage,
      messageVars,
      numericErrorCode,
      originatingService: "any",
      intent: "prod",
      error_description: errorMessage,
      error,
    });
  }

  static async SendEmptyGift(username, accountId, res) {
    log.info(`Sending empty gift to ${username} (${accountId})`);
    try {
      await axios.post(
        `http://127.0.0.1:${process.env.PORT}/fortnite/api/game/v3/profile/*/client/emptygift`,
        {
          offerId: "e406693aa12adbc8b04ba7e6409c8ab3d598e8c3",
          currency: "MtxCurrency",
          currencySubType: "",
          expectedTotalPrice: "0",
          gameContext: "",
          receiverAccountIds: [accountId],
          giftWrapTemplateId: "GiftBox:gb_makegood",
          personalMessage: "Your personal message here",
          accountId,
          playerName: username,
        }
      );
      log.info(`Empty gift successfully sent to ${username} (${accountId})`);
    } catch (err) {
      log.error(
        `Failed to send empty gift to ${username} (${accountId}): ${err.message}`
      );
      Utils.createError(
        "errors.com.epicgames.gift.failed",
        "Failed to send empty gift",
        [username],
        16022,
        err.message,
        500,
        res
      );
    }
  }

  static async FetchApplication() {
    log.request("Fetching Discord application info");
    const req = await fetch("https://discord.com/api/v10/applications/@me", {
      method: "GET",
      headers: {
        Authorization: `Bot ${process.env.BOT_TOKEN}`,
      },
    });
    const res = await req.json();
    log.info("Discord application info fetched successfully");
    return res;
  }

  static DecodeBase64(str) {
    return Buffer.from(str, "base64").toString();
  }

  static async CreateUser(discordId, username, email, plainPassword, isServer) {
    email = email.toLowerCase();
    log.request(
      `User creation request: ${username} <${email}> (Discord: ${discordId})`
    );

    if (!discordId || !username || !email || !plainPassword)
      return { message: "Username/email/password is required.", status: 400 };
    if (await User.findOne({ discordId }))
      return { message: "You already created an account!", status: 400 };

    const accountId = v4().replace(/-/gi, "");
    const emailFilter =
      /^([a-zA-Z0-9_\.\-])+\@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailFilter.test(email))
      return {
        message: "You did not provide a valid email address!",
        status: 400,
      };
    if (username.length >= 25)
      return {
        message: "Your username must be less than 25 characters long.",
        status: 400,
      };
    if (username.length < 3)
      return {
        message: "Your username must be atleast 3 characters long.",
        status: 400,
      };
    if (plainPassword.length >= 128)
      return {
        message: "Your password must be less than 128 characters long.",
        status: 400,
      };

    const allowedCharacters =
      " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~".split(
        ""
      );
    for (let character of username) {
      if (!allowedCharacters.includes(character))
        return {
          message:
            "Your username has special characters, please remove them and try again.",
          status: 400,
        };
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const lowercaseEmail = email.toLowerCase();

    try {
      log.debug(
        `Creating account: ${username} <${lowercaseEmail}> (Discord: ${discordId})`
      );
      await User.create({
        created: new Date().toISOString(),
        banne: false,
        discordId: discordId,
        accountId: accountId,
        username: username,
        username_lower: username.toLowerCase(),
        email: lowercaseEmail,
        password: hashedPassword,
        isServer: isServer,
        matchmakingId: v4(),
      }).then(async (user) => {
        log.info(`User created successfully: ${username} (${user.accountId})`);

        await Profile.create({
          created: user.created,
          accountId: user.accountId,
          profiles: await profileManager.createProfiles(user.accountId),
        });
        log.info(`Profile created for ${username} (${user.accountId})`);

        await Friends.create({
          created: user.created,
          accountId: user.accountId,
        });
        log.info(
          `Friends document created for ${username} (${user.accountId})`
        );
      });
    } catch (err) {
      if (err.code === 11000) {
        log.warn(
          `Duplicate registration attempt: ${username} or ${lowercaseEmail}`
        );
        return { message: "Username or email is already in use.", status: 400 };
      }
      log.error(`User creation failed: ${err.message}`);
      return {
        message: "An unknown error has occured, please try again later.",
        status: 400,
      };
    }

    log.info(`Account registration completed: ${username} <${lowercaseEmail}>`);
    return {
      message: `Successfully created an account with the username ${username}`,
      status: 200,
    };
  }

  static GetXMPPStatus(fromId, toId, offline) {
    if (!global.Clients) return;

    const SenderData = global.Clients.find((i) => i.accountId === fromId);
    const ClientData = global.Clients.find((i) => i.accountId === toId);
    if (!SenderData || !ClientData) return;

    log.xmpp(
      `${offline ? "Offline" : "Online"} presence → ${toId} (from ${fromId})`
    );

    let xml = XMLBuilder.create("presence")
      .attribute("to", ClientData.jid)
      .attribute("xmlns", "jabber:client")
      .attribute("from", SenderData.jid)
      .attribute("type", offline ? "unavailable" : "available");

    if (SenderData.lastPresenceUpdate.away)
      xml = xml
        .element("show", "away")
        .up()
        .element("status", SenderData.lastPresenceUpdate.status)
        .up();
    else xml = xml.element("status", SenderData.lastPresenceUpdate.status).up();

    ClientData.client.send(xml.toString());
  }

  static SendXMPPMessage(body, toAccountId) {
    if (!global.Clients) return;
    if (typeof body === "object") body = JSON.stringify(body);

    const receiver = global.Clients.find((i) => i.accountId === toAccountId);
    if (!receiver) return;

    log.xmpp(
      `Message → ${toAccountId}: ${body.substring(0, 150)}${
        body.length > 150 ? "..." : ""
      }`
    );

    receiver.client.send(
      XMLBuilder.create("message")
        .attribute("from", "xmpp-admin@prod.ol.epicgames.com")
        .attribute("to", receiver.jid)
        .attribute("xmlns", "jabber:client")
        .element("body", `${body}`)
        .up()
        .toString()
    );
  }

  static GetVersion(req) {
    const memory = { season: 0, build: 0.0, CL: "0", lobby: "LobbySeason0" };
    const ua = (req.headers["user-agent"] || "").trim();

    if (!global.versionDetectionLogCache) {
      global.versionDetectionLogCache = new Set();
    }

    const shouldLogVersion = (signature) => {
      if (global.versionDetectionLogCache.has(signature)) {
        return false;
      }

      // Keep cache bounded so long-running servers do not grow memory unbounded.
      if (global.versionDetectionLogCache.size > 200) {
        global.versionDetectionLogCache.clear();
      }

      global.versionDetectionLogCache.add(signature);
      return true;
    };

    if (shouldLogVersion(`ua:${ua || "missing"}`)) {
      log.request(`Version detection - User-Agent: ${ua}`);
    }

    if (!ua || !ua.includes("Fortnite")) {
      log.warn("Invalid or missing User-Agent, using defaults");
      return memory;
    }

    let detected = false;

    const modernMatch = ua.match(/Release-([0-9]+)\.([0-9]+)(?:-CL-([0-9]+))?/);
    if (modernMatch) {
      const major = parseInt(modernMatch[1], 10);
      const minor = parseInt(modernMatch[2], 10);
      const cl = modernMatch[3] || "0";

      memory.season = major;
      memory.build = Number(`${major}.${minor}`);
      memory.CL = cl;
      memory.lobby = `LobbySeason${major}`;

      if (shouldLogVersion(`detected:${major}.${minor}:${cl}`)) {
        log.info(
          `Detected version: Season ${major} | Build ${major}.${minor} | CL ${cl}`
        );
      }
      return memory;
    }

    let cl = "0";
    try {
      const clMatch = ua.match(/-CL-?([0-9]+)/i) || ua.match(/([0-9]{7,})/);
      if (clMatch) cl = clMatch[1];
    } catch {}

    try {
      const legacyBuild = ua.split("Release-")[1]?.split("-")[0];
      if (legacyBuild && /^\d+\.\d+$/.test(legacyBuild)) {
        const [a, b] = legacyBuild.split(".");
        const season = parseInt(a, 10);
        memory.season = season;
        memory.build = Number(`${a}.${b.padEnd(2, "0")}`);
        memory.CL = cl;
        memory.lobby =
          season <= 1 ? `LobbySeason${season}` : "LobbyWinterDecor";
        if (shouldLogVersion(`legacy:${season}:${memory.build}:${cl}`)) {
          log.info(
            `Legacy detected: Season ${season} | Build ${memory.build} | CL ${cl}`
          );
        }
        return memory;
      }
    } catch {}

    const nCL = parseInt(cl, 10);
    if (!isNaN(nCL) && nCL > 0) {
      if (nCL <= 3790078) {
        const season = nCL < 3724489 ? 0 : 1;
        Object.assign(memory, {
          season,
          build: season === 0 ? 0.0 : 1.0,
          CL: cl,
          lobby: season === 0 ? "LobbySeason0" : "LobbySeason1",
        });
      } else {
        Object.assign(memory, {
          season: 2,
          build: 2.0,
          CL: cl,
          lobby: "LobbyWinterDecor",
        });
      }
      if (shouldLogVersion(`fallback-cl:${memory.season}:${cl}`)) {
        log.info(`Fallback version from CL: Season ${memory.season} | CL ${cl}`);
      }
      return memory;
    }

    if (shouldLogVersion("fallback:0:0")) {
      log.info(`Fallback version: Season 0 | CL 0 (no valid data)`);
    }
    return memory;
  }

  static createClient(clientId, grant_type, ip, expiresIn) {
    const token = `eg1~${jwt.sign(
      {
        p: Buffer.from(v4()).toString("base64"),
        clsvc: "fortnite",
        t: "s",
        mver: false,
        clid: clientId,
        ic: true,
        am: grant_type,
        jti: v4().replace(/-/gi, ""),
        creation_date: new Date(),
        hours_expire: expiresIn,
      },
      global.JWT_SECRET,
      { expiresIn: `${expiresIn}h` }
    )}`;

    global.clientTokens.push({ ip, token });
    log.info(`Client token issued for IP ${ip} (${grant_type})`);
    return token;
  }

  static createAccess(user, clientId, grant_type, deviceId, expiresIn) {
    if (!user?.accountId) throw new Error("Invalid user: missing accountTo");

    const token = `eg1~${jwt.sign(
      {
        app: "fortnite",
        sub: user.accountId,
        dvid: deviceId,
        mver: false,
        clid: clientId,
        dn: user.username || "Unknown",
        am: grant_type,
        p: Buffer.from(v4()).toString("base64"),
        iai: user.accountId,
        sec: 1,
        clsvc: "fortnite",
        t: "s",
        ic: true,
        jti: v4().replace(/-/gi, ""),
        creation_date: new Date().toISOString(),
        hours_expire: expiresIn,
      },
      global.JWT_SECRET,
      { expiresIn: `${expiresIn}h` }
    )}`;

    global.accessTokens.push({ accountId: user.accountId, token });
    log.info(
      `Access token created for ${user.username} (${user.accountId}) - ${grant_type}`
    );
    return token;
  }

  static createRefresh(user, clientId, grant_type, deviceId, expiresIn) {
    const token = `eg1~${jwt.sign(
      {
        sub: user.accountId,
        dvid: deviceId,
        t: "r",
        clid: clientId,
        am: grant_type,
        jti: v4().replace(/-/gi, ""),
        creation_date: new Date(),
        hours_expire: expiresIn,
      },
      global.JWT_SECRET,
      { expiresIn: `${expiresIn}h` }
    )}`;

    global.refreshTokens.push({ accountId: user.accountId, token });
    log.info(`Refresh token created for ${user.username} (${user.accountId})`);
    return token;
  }

  static getOfferID(offerId) {
    const catalog = Utils.getStoreCatalog();

    for (const storefront of catalog.storefronts || []) {
      const entry = storefront.catalogEntries.find(
        (i) => i.offerId === offerId
      );
      if (entry) {
        log.info(`OfferID resolved: ${offerId} → ${storefront.name}`);
        return { name: storefront.name, offerId: entry };
      }
    }

    return null;
  }

  static buildOfferId(seed) {
    const hash = createHash("md5").update(seed).digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(
      12,
      16
    )}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  static createCatalogEntry(
    slotName,
    slotConfig,
    panelLabel,
    sectionId = "Daily",
    catalogGroup = slotName
  ) {
    const grants = Array.isArray(slotConfig?.itemGrants)
      ? slotConfig.itemGrants
      : [];

    const itemGrants = grants
      .map((grant) => {
        if (typeof grant === "string") {
          const templateId = grant.trim();
          if (!templateId) return null;
          return { templateId, quantity: 1 };
        }

        if (
          grant &&
          typeof grant === "object" &&
          typeof grant.templateId === "string"
        ) {
          const templateId = grant.templateId.trim();
          if (!templateId) return null;
          const quantity = Number(grant.quantity);
          return {
            templateId,
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
          };
        }

        return null;
      })
      .filter(Boolean);

    if (itemGrants.length === 0) {
      return null;
    }

    const parsedPrice = Number(slotConfig?.price);
    const finalPrice =
      Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : 0;
    const seed = `${slotName}:${itemGrants
      .map((grant) => grant.templateId)
      .join("|")}:${finalPrice}`;

    return {
      offerId: Utils.buildOfferId(seed),
      devName: `${slotName} - ${
        itemGrants.map((grant) => grant.templateId).join(", ") || "NoItem"
      }`,
      fulfillmentIds: [],
      dailyLimit: -1,
      weeklyLimit: -1,
      monthlyLimit: -1,
      categories: [panelLabel],
      prices: [
        {
          currencyType: "MtxCurrency",
          currencySubType: "",
          regularPrice: finalPrice,
          finalPrice: finalPrice,
          saleExpiration: "9999-12-31T23:59:59.999Z",
          basePrice: finalPrice,
        },
      ],
      title: "",
      shortDescription: "",
      description: "",
      displayAssetPath: "",
      meta: {},
      matchFilter: "",
      filterWeight: 0,
      appStoreId: [],
      requirements: itemGrants.map((grant) => ({
        requirementType: "DenyOnItemOwnership",
        requiredId: grant.templateId,
        minQuantity: 1,
      })),
      offerType: "StaticPrice",
      giftInfo: {
        bIsEnabled: true,
        forcedGiftBoxTemplateId: "",
        purchaseRequirements: [],
        giftRecordIds: [],
      },
      refundable: true,
      metaInfo: [
        { Key: "SectionId", Value: sectionId },
        {
          Key: "TileSize",
          Value: sectionId === "Featured" ? "Normal" : "Small",
        },
      ],
      itemGrants,
      sortPriority: Number(panelLabel.replace("Panel ", "")) || 1,
      catalogGroup,
      catalogGroupPriority: 0,
    };
  }

  static getStoreCatalog() {
    const configPath = path.join(
      __dirname,
      "../local/Storefront/catalog_config.json"
    );

    try {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

      if (Array.isArray(config.storefronts)) {
        return config;
      }

      const storefronts = [
        { name: "BRDailyStorefront", catalogEntries: [] },
        { name: "BRWeeklyStorefront", catalogEntries: [] },
        { name: "CurrencyStoreFront", catalogEntries: [] },
      ];

      const slots = [
        {
          key: "daily1",
          storefront: "BRDailyStorefront",
          panel: "Panel 1",
          sectionId: "Daily",
          catalogGroup: "daily1",
        },
        {
          key: "daily2",
          storefront: "BRDailyStorefront",
          panel: "Panel 2",
          sectionId: "Daily",
          catalogGroup: "daily2",
        },
        {
          key: "daily3",
          storefront: "BRDailyStorefront",
          panel: "Panel 3",
          sectionId: "Daily",
          catalogGroup: "daily3",
        },
        {
          key: "daily4",
          storefront: "BRDailyStorefront",
          panel: "Panel 4",
          sectionId: "Daily",
          catalogGroup: "daily4",
        },
        {
          key: "daily5",
          storefront: "BRDailyStorefront",
          panel: "Panel 5",
          sectionId: "Daily",
          catalogGroup: "daily5",
        },
        {
          key: "daily6",
          storefront: "BRDailyStorefront",
          panel: "Panel 6",
          sectionId: "Daily",
          catalogGroup: "daily6",
        },
        {
          key: "featured1",
          storefront: "BRWeeklyStorefront",
          panel: "Panel 8",
          sectionId: "Featured",
          catalogGroup: "featured1_bundle",
        },
        {
          key: "featured2",
          storefront: "BRWeeklyStorefront",
          panel: "Panel 9",
          sectionId: "Featured",
          catalogGroup: "featured2",
        },
        {
          key: "featured3",
          storefront: "BRWeeklyStorefront",
          panel: "Panel 10",
          sectionId: "Featured",
          catalogGroup: "featured3",
        },
      ];

      for (const slot of slots) {
        if (!config[slot.key]) continue;
        const entry = Utils.createCatalogEntry(
          slot.key,
          config[slot.key],
          slot.panel,
          slot.sectionId,
          slot.catalogGroup
        );
        if (!entry) continue;
        storefronts
          .find((storefront) => storefront.name === slot.storefront)
          .catalogEntries.push(entry);
      }

      const totalEntries = storefronts.reduce(
        (sum, storefront) => sum + storefront.catalogEntries.length,
        0
      );

      if (totalEntries === 0) {
        throw new Error(
          "catalog_config.json has no valid offers. Add template IDs to itemGrants."
        );
      }

      return {
        refreshIntervalHrs: 24,
        dailyPurchaseHrs: 24,
        expiration: "9999-12-31T00:00:00.000Z",
        storefronts,
      };
    } catch (error) {
      log.error(
        `Failed to build catalog from catalog_config.json: ${error.message}`
      );
      return {
        refreshIntervalHrs: 24,
        dailyPurchaseHrs: 24,
        expiration: "9999-12-31T00:00:00.000Z",
        storefronts: [
          { name: "BRDailyStorefront", catalogEntries: [] },
          { name: "BRWeeklyStorefront", catalogEntries: [] },
          { name: "CurrencyStoreFront", catalogEntries: [] },
        ],
      };
    }
  }

  static getCatalog() {
    return Utils.getStoreCatalog();
  }

  static async UpdateTokens() {
    try {
      await global.kv.set(
        "tokens",
        JSON.stringify(
          {
            accessTokens: global.accessTokens,
            refreshTokens: global.refreshTokens,
            clientTokens: global.clientTokens,
          },
          null,
          2
        )
      );
      log.debug("Token storage updated in KV");
    } catch (err) {
      log.error(`Failed to update tokens in KV: ${err.message}`);
    }
  }
}
