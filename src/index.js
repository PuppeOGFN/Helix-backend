import express from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { dirname } from "dirname-filename-esm";
import destr from "destr";
import kv from "./Utils/kv.js";
import Utils from "./Utils/Utils.js";
import log from "./Utils/log.js";
import { DateAddHours } from "./Routes/auth.js";
import "./discord/index.js";
import { v4 } from "uuid";

import dotenv from "dotenv";
dotenv.config();

const __dirname = dirname(import.meta);

const resolveJwtSecret = () => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.trim()) {
    return process.env.JWT_SECRET.trim();
  }

  const jwtSecretPath = path.join(__dirname, "../jwt.secret");

  if (fs.existsSync(jwtSecretPath)) {
    const existing = fs.readFileSync(jwtSecretPath, "utf8").trim();
    if (existing) {
      return existing;
    }
  }

  const generated = v4().replace(/-/gi, "") + v4().replace(/-/gi, "");
  fs.writeFileSync(jwtSecretPath, generated, "utf8");
  return generated;
};

global.kv = kv;
global.JWT_SECRET = resolveJwtSecret();
global.accessTokens = [];
global.refreshTokens = [];
global.clientTokens = [];
global.smartXMPP = false;
global.exchangeCodes = [];
const app = express();
const PORT = process.env.PORT;
let redisTokens;
let tokens;
tokens = destr(
  fs.readFileSync(path.join(__dirname, "../tokens.json")).toString()
);
for (let tokenType in tokens) {
  for (let tokenIndex in tokens[tokenType]) {
    const rawToken = tokens[tokenType][tokenIndex].token.replace("eg1~", "");
    let decodedToken;

    try {
      decodedToken = jwt.verify(rawToken, global.JWT_SECRET);
    } catch {
      tokens[tokenType].splice(Number(tokenIndex), 1);
      continue;
    }

    if (
      DateAddHours(
        new Date(decodedToken.creation_date),
        decodedToken.hours_expire
      ).getTime() <= new Date().getTime()
    ) {
      tokens[tokenType].splice(Number(tokenIndex), 1);
    }
  }
}
fs.writeFileSync(
  path.join(__dirname, "../tokens.json"),
  JSON.stringify(tokens, null, 2) || ""
);
if (!tokens || !tokens.accessTokens) {
  console.log("No access tokens found, resetting tokens.json");
  await kv.set(
    "tokens",
    fs.readFileSync(path.join(__dirname, "../tokens.json")).toString()
  );
  tokens = destr(
    fs.readFileSync(path.join(__dirname, "../tokens.json")).toString()
  );
}
global.accessTokens = tokens.accessTokens;
global.refreshTokens = tokens.refreshTokens;
global.clientTokens = tokens.clientTokens;
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    log.database("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB: ", error);
  });
mongoose.connection.on("error", (err) => {
  log.error(
    "MongoDB failed to connect, please make sure you have MongoDB installed and running."
  );
  throw err;
});
app.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
  });
});
app.all("/unknown", (req, res) => {
  res.status(200).send("reboot launcher ok");
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const importRoutes = async (dir) => {
  for (const fileName of fs.readdirSync(path.join(__dirname, dir))) {
    if (fileName.includes(".map")) continue;
    try {
      app.use((await import(`file://${__dirname}/${dir}/${fileName}`)).default);
    } catch (error) {
      console.log(fileName, error);
    }
  }
};
await importRoutes("Routes");
app
  .listen(PORT, () => {
    log.backendstart(`Backend started listening on port ${PORT}`);
    import("./xmpp/xmpp.js");
  })
  .on("error", async (err) => {
    if (err.message == "EADDRINUSE") {
      log.error(`Port ${PORT} is already in use!\nClosing in 3 seconds...`);
      process.exit(0);
    } else throw err;
  });
const loggedUrls = new Set();
app.use((req, res, next) => {
  const url = req.originalUrl;
  if (!loggedUrls.has(url)) {
    log.debug(
      `Missing endpoint: ${req.method} ${url} request port ${req.socket.localPort}`
    );
    Utils.createError(
      "errors.com.epicgames.common.not_found",
      "Sorry the resource you were trying to find could not be found",
      undefined,
      1004,
      undefined,
      404,
      res
    );
  }
  next();
});