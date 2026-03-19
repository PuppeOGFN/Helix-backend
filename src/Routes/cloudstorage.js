import express from "express";
const app = express.Router();
import fs from "fs";
import crypto from "crypto";
import path from "path";
import os from "os";
import { verifyToken } from "../User/tokenManager/tokenVerify.js";
import Utils from "../Utils/Utils.js";
import log from "../Utils/log.js";
import { dirname } from "dirname-filename-esm";
const __dirname = dirname(import.meta);
import NodeCache from "node-cache";
import Users from "../User/Mongodb/Schema/user.js";
import hotfixes from "../Utils/hotfixes.js";
const cache = new NodeCache();
const operatingSystem = os.platform();

let pathToClientSettings = "";
if (operatingSystem === "win32") {
  pathToClientSettings = path.join(__dirname, "../ClientSettings");
  if (!fs.existsSync(pathToClientSettings)) {
    fs.mkdirSync(pathToClientSettings);
    log.debug("ClientSettings folder for Windows created successfully.");
  }
} else if (operatingSystem === "linux") {
  pathToClientSettings = path.join(__dirname, "../ClientSettings");
  if (!fs.existsSync(pathToClientSettings)) {
    fs.mkdirSync(pathToClientSettings);
    fs.chmodSync(pathToClientSettings, 0o700);
    log.debug("ClientSettings folder for Linux created successfully.");
  }
}
//Save settings stuff
app.use((req, res, next) => {
  if (
    req.originalUrl
      .toLowerCase()
      .startsWith("/fortnite/api/cloudstorage/user/") &&
    req.method === "PUT"
  ) {
    req.rawBody = "";
    req.setEncoding("latin1");
    req.on("data", (chunk) => (req.rawBody += chunk));
    req.on("end", () => next());
  } else return next();
});
//.Ini Stuff
app.get("/fortnite/api/cloudstorage/system", async (req, res) => {
  const dir = path.join(__dirname, "../", "CloudStorage");
  let CloudFiles = [];
  fs.readdirSync(dir).forEach((name) => {
    log.debug(`Found file: ${name}`);
    if (name.toLowerCase().endsWith(".ini")) {
      log.debug(`Found .ini file: ${name}`);
      const ParsedFile = fs.readFileSync(path.join(dir, name)).toString();
      const ParsedStats = fs.statSync(path.join(dir, name));
      CloudFiles.push({
        uniqueFilename: name,
        filename: name,
        hash: crypto.createHash("sha1").update(ParsedFile).digest("hex"),
        hash256: crypto.createHash("sha256").update(ParsedFile).digest("hex"),
        length: ParsedFile.length,
        contentType: "application/octet-stream",
        uploaded: ParsedStats.mtime,
        storageType: "Local",
        storageIds: {},
        doNotCache: true,
      });
    }
  });
  res.json(CloudFiles);
});
app.get("/fortnite/api/cloudstorage/system/:file", async (req, res) => {
  const fileName = req.params.file;
  if (req.params.file.includes("..")) return res.status(404).end();
  if (req.params.file.includes("~")) return res.status(404).end();
  if (req.params.file.includes(".env")) {
    let ip = req.ip;
    if (ip.startsWith("::ffff:")) {
      ip = ip.substring(7);
    }
    const user = Users.findOne({ ip });
    const username = user.username;

    if (user) {
      log.debug(`${username} tried to do the cloudstorage exploit! IP : ${ip}`);
      return res.status(404).end();
    } else if (!user) {
      log.debug(`${ip} tried to do the cloudstorage exploit!`);
      return res.status(404).end();
    }
  }
  if (fileName.toLowerCase() === "defaultgame.ini") {
    log.debug(`Sent "${fileName}" to user!`);
    return res.status(200).send(hotfixes.defaultgame);
  }
  if (fileName.toLowerCase() === "defaultengine.ini") {
    log.debug(`Sent "${fileName}" to user!`);
    return res.status(200).send(hotfixes.defaultengine);
  }
  if (fileName.toLowerCase() === "defaultruntimeoptions.ini") {
    log.debug(`Sent "${fileName}" to user!`);
    return res.status(200).send(hotfixes.defaultruntimeoptions);
  }
  if (fileName.toLowerCase() === "defaultinput.ini") {
    log.debug(`Sent "${fileName}" to user!`);
    return res.status(200).send(hotfixes.defaultinput);
  } else {
    log.debug(`File: ${fileName} does not exist`);
    res.status(404).end();
  }
});
app.get(
  "/fortnite/api/cloudstorage/user/*/:file",
  verifyToken,
  async (req, res) => {
    const userid = req.params[0];
    if (req.params.file.toLowerCase() !== "clientsettings.sav") {
      return res.status(404).json({
        error: "file not found",
      });
    }
    const memory = Utils.GetVersion(req);
    let file = path.join(
      pathToClientSettings,
      `ClientSettings-${userid}-${memory.season}.Sav`
    );
    if (fs.existsSync(file)) return res.status(200).send(fs.readFileSync(file));
    res.status(200).end();
  }
);
app.get("/fortnite/api/cloudstorage/user/:accountId", verifyToken, async (req, res) => {
    const memory = Utils.GetVersion(req);
    const userId = req.user.accountId;
    const filePath = path.join(
      pathToClientSettings,
      `ClientSettings-${userId}-${memory.season}.Sav`
    );
    const cachedFile = cache.get(filePath);
    if (cachedFile) {
      console.log("Returning cached file");
      return res.json([cachedFile]);
    }
    if (fs.existsSync(filePath)) {
      const ParsedFile = fs.readFileSync(filePath, "latin1");
      const ParsedStats = fs.statSync(filePath);
      return res.json([
        {
          uniqueFilename: "ClientSettings.Sav",
          filename: "ClientSettings.Sav",
          hash: crypto.createHash("sha1").update(ParsedFile).digest("hex"),
          hash256: crypto.createHash("sha256").update(ParsedFile).digest("hex"),
          length: Buffer.byteLength(ParsedFile),
          contentType: "application/octet-stream",
          uploaded: ParsedStats.mtime,
          storageType: "Local",
          storageIds: {},
          accountId: req.user.accountId,
          doNotCache: false,
        },
      ]);
    }
    res.json([]);
  }
);
app.put(
  "/fortnite/api/cloudstorage/user/*/:file",
  verifyToken,
  async (req, res) => {
    const userId = req.params[0];
    const filename = req.params.file.toLowerCase();
    if (filename !== "clientsettings.sav") {
      return res.status(404).json({ error: "file not found" });
    }
    if (Buffer.byteLength(req.rawBody) >= 400000)
      return res
        .status(403)
        .json({ error: "File size must be less than 400kb." });
    if (req.params.file.toLowerCase() != "clientsettings.sav")
      return res.status(204).end();
    const memory = Utils.GetVersion(req);
    const file = path.join(
      pathToClientSettings,
      `ClientSettings-${userId}-${memory.season}.Sav`
    );
    fs.writeFileSync(file, req.rawBody, "latin1");
    res.status(204).end();
  }
);
export default app;