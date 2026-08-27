#!/usr/bin/env node

/**
 * AutoApply Disaster Recovery CLI
 * Reset or create an administrator account directly on the host / inside Docker.
 * 
 * Usage:
 *   node scripts/reset-admin.js --username admin --password "NewSecretPassword123"
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "autoapply");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    username: "admin",
    password: "",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--username" || args[i] === "-u") {
      result.username = args[i + 1] || "admin";
      i++;
    } else if (args[i] === "--password" || args[i] === "-p") {
      result.password = args[i + 1] || "";
      i++;
    }
  }

  return result;
}

function hashPassword(password, salt) {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, generatedSalt, 64).toString("hex");
  return { hash, salt: generatedSalt };
}

function main() {
  const { username, password } = parseArgs();

  if (!password) {
    console.error("❌ Error: Missing --password argument.");
    console.log("\nUsage:\n  node scripts/reset-admin.js --username <username> --password <new-password>\n");
    process.exit(1);
  }

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let users = [];
  if (fs.existsSync(USERS_FILE)) {
    try {
      users = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
    } catch (e) {
      console.warn("⚠️ Warning: Could not parse existing users.json, creating new file.");
      users = [];
    }
  }

  const { hash, salt } = hashPassword(password);
  let admin = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (admin) {
    admin.passwordHash = hash;
    admin.salt = salt;
    admin.role = "admin";
    console.log(`✅ Administrator account '${username}' password successfully updated!`);
  } else {
    admin = {
      id: `usr_${Date.now().toString(36)}`,
      username,
      passwordHash: hash,
      salt,
      role: "admin",
      createdAt: new Date().toISOString(),
    };
    users.push(admin);
    console.log(`✅ Created new administrator account '${username}' with role 'admin'!`);
  }

  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  console.log(`📁 User database saved to: ${USERS_FILE}`);
  console.log(`🚀 You can now log into the web UI with username '${username}'.`);
}

main();
