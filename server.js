require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-this-secret";

const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  name: "securestep.sid",
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 60 * 1000
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." }
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP attempts. Please try again later." }
});

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    twoFactorEnabled: user.twoFactorEnabled
  };
}

function requireAuthenticated(req, res, next) {
  if (!req.session.userId || req.session.authenticated !== true) {
    return res.status(401).json({ message: "You are not logged in." });
  }
  next();
}

function requirePending2FA(req, res, next) {
  if (!req.session.pendingUserId) {
    return res.status(401).json({ message: "Your login session has expired. Please log in again." });
  }
  next();
}

app.post("/api/register", authLimiter, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ message: "Name must be between 2 and 60 characters." });
    }
    if (!validEmail(email) || email.length > 120) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }
    if (!validPassword(password)) {
      return res.status(400).json({ message: "Password must be 8-72 characters long." });
    }

    const users = readUsers();
    if (users.some(user => user.email === email)) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `SecureStep:${email}`,
      issuer: "SecureStep"
    });

    const user = {
      id: Date.now().toString(),
      name,
      email,
      passwordHash,
      totpSecret: secret.base32,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);

    req.session.pendingSetupUserId = user.id;

    res.status(201).json({
      message: "Registration successful.",
      user: safeUser(user)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while registering." });
  }
});

app.post("/api/setup/start", authLimiter, async (req, res) => {
  try {
    const userId = req.session.pendingSetupUserId;
    if (!userId) return res.status(401).json({ message: "Registration session expired." });

    const users = readUsers();
    const user = users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const otpauthUrl = speakeasy.otpauthURL({
      secret: user.totpSecret,
      encoding: "base32",
      label: `SecureStep:${user.email}`,
      issuer: "SecureStep"
    });

    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    res.json({
      qrCode: qrDataUrl,
      manualKey: user.totpSecret,
      message: "Scan the QR code in your authenticator app."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not create authenticator setup." });
  }
});

app.post("/api/setup/verify", otpLimiter, (req, res) => {
  const userId = req.session.pendingSetupUserId;
  const token = String(req.body.token || "").trim();

  if (!userId) return res.status(401).json({ message: "Registration session expired." });
  if (!/^\d{6}$/.test(token)) return res.status(400).json({ message: "OTP must be exactly 6 digits." });

  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: "base32",
    token,
    window: 1
  });

  if (!verified) return res.status(401).json({ message: "Incorrect OTP. Please try again." });

  user.twoFactorEnabled = true;
  writeUsers(users);

  req.session.pendingSetupUserId = null;
  req.session.userId = user.id;
  req.session.authenticated = true;

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ message: "Could not secure the session." });
    req.session.userId = user.id;
    req.session.authenticated = true;
    res.json({ message: "Two-factor authentication enabled.", user: safeUser(user) });
  });
});

app.post("/api/login", authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = req.body.password;

    if (!validEmail(email) || typeof password !== "string") {
      return res.status(400).json({ message: "Please enter a valid email and password." });
    }

    const users = readUsers();
    const user = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    req.session.pendingUserId = user.id;

    if (!user.twoFactorEnabled) {
      return req.session.regenerate(err => {
        if (err) return res.status(500).json({ message: "Could not secure the session." });
        req.session.pendingUserId = user.id;
        res.json({ requiresSetup: true, message: "Authenticator setup is required." });
      });
    }

    req.session.regenerate(err => {
      if (err) return res.status(500).json({ message: "Could not secure the session." });
      req.session.pendingUserId = user.id;
      res.json({ requiresOtp: true, message: "Password verified. Enter your authenticator code." });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error while logging in." });
  }
});

app.post("/api/login/verify-otp", otpLimiter, (req, res) => {
  const token = String(req.body.token || "").trim();
  const userId = req.session.pendingUserId;

  if (!userId) return res.status(401).json({ message: "Login session expired. Please log in again." });
  if (!/^\d{6}$/.test(token)) return res.status(400).json({ message: "OTP must be exactly 6 digits." });

  const users = readUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ message: "User not found." });

  const verified = speakeasy.totp.verify({
    secret: user.totpSecret,
    encoding: "base32",
    token,
    window: 1
  });

  if (!verified) return res.status(401).json({ message: "Incorrect OTP." });

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ message: "Could not secure the session." });
    req.session.userId = user.id;
    req.session.authenticated = true;
    res.json({ message: "Login successful.", user: safeUser(user) });
  });
});

app.get("/api/me", requireAuthenticated, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.id === req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ message: "User no longer exists." });
  }
  res.json({ user: safeUser(user) });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: "Could not log out." });
    res.clearCookie("securestep.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found." });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SecureStep running at http://localhost:${PORT}`);
});
