import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Request, Response, NextFunction } from "express";

export interface StoredUser {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  role: "admin" | "user";
  createdAt: string;
  lastLogin?: string;
}

export interface UserSession {
  token: string;
  userId: string;
  role: "admin" | "user";
  username: string;
  expiresAt: number;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "autoapply");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const USER_DATA_BASE = path.join(DATA_DIR, "users");

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USER_DATA_BASE)) {
  fs.mkdirSync(USER_DATA_BASE, { recursive: true });
}

// In-memory active sessions
const activeSessions = new Map<string, UserSession>();

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, generatedSalt, 64).toString("hex");
  return { hash, salt: generatedSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const calculated = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(hash, "hex"));
}

export function getAllUsers(): StoredUser[] {
  if (!fs.existsSync(USERS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

export function saveUsers(users: StoredUser[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

// Default superadmin bootstrapper
export function initializeAdminUser(): void {
  const users = getAllUsers();
  const hasAdmin = users.some((u) => u.role === "admin");

  if (!hasAdmin) {
    const adminUser = process.env.ADMIN_USERNAME || "admin";
    const adminPass = process.env.ADMIN_PASSWORD || "adminpassword123";
    const { hash, salt } = hashPassword(adminPass);

    const newAdmin: StoredUser = {
      id: "usr_admin_root",
      username: adminUser,
      passwordHash: hash,
      salt,
      role: "admin",
      createdAt: new Date().toISOString(),
    };

    users.push(newAdmin);
    saveUsers(users);
    console.log(`[AUTH] Initialized superadmin '${adminUser}' (default pass: ${adminPass})`);
    
    // Initialize directory
    getUserDataDir(newAdmin.id);
  }

  // Check if environment password reset was requested
  if (process.env.ADMIN_RESET_PASSWORD) {
    const resetPass = process.env.ADMIN_RESET_PASSWORD.trim();
    const admin = users.find((u) => u.role === "admin");
    if (admin && resetPass) {
      const { hash, salt } = hashPassword(resetPass);
      admin.passwordHash = hash;
      admin.salt = salt;
      saveUsers(users);
      console.log(`[AUTH] Superadmin password reset via ADMIN_RESET_PASSWORD env var.`);
    }
  }
}

export function getUserDataDir(userId: string): string {
  const userDir = path.join(USER_DATA_BASE, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }

  // Seed user default files if not present
  const userProfile = path.join(userDir, "master_profile.yaml");
  const fallbackSeed = path.join(process.cwd(), "autoapply", "assets", "master_profile.yaml");
  if (!fs.existsSync(userProfile) && fs.existsSync(fallbackSeed)) {
    try {
      fs.copyFileSync(fallbackSeed, userProfile);
    } catch (e) {
      console.warn("Could not seed master_profile for user:", userId, e);
    }
  }

  return userDir;
}

export function createSession(user: StoredUser): UserSession {
  const token = crypto.randomBytes(32).toString("hex");
  const session: UserSession = {
    token,
    userId: user.id,
    role: user.role,
    username: user.username,
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  activeSessions.set(token, session);
  return session;
}

export function getSession(token?: string): UserSession | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

export function invalidateSession(token: string): void {
  activeSessions.delete(token);
}

// Request Auth Middleware
export interface AuthenticatedRequest extends Request {
  user?: UserSession;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : (req.headers["x-auth-token"] as string);

  if (!token) {
    return res.status(401).json({ error: "Authentication required. Please log in." });
  }

  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  req.user = session;
  next();
}

export function adminOnlyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied. Administrator privileges required." });
  }
  next();
}
