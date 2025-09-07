import { Express, RequestHandler } from "express";
import bcrypt from "bcrypt";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { storage } from "./storage.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    user?: { id: string; username: string; email: string };
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; email: string };
    }
  }
}

const PgSession = ConnectPgSimple(session);

export function getSession() {
  const sessionSecret = process.env.SESSION_SECRET || 'your-secret-key-change-in-production';
  
  return session({
    store: new PgSession({
      conString: process.env.DATABASE_URL,
      tableName: 'sessions'
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
    }
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password required" });
      }

      // Find existing user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.passwordHash || '');
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.user = { id: user.id, username: user.username, email: user.email };

      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Hash password and create user
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        email: email || null,
        passwordHash: hashedPassword
      });

      // Set session
      req.session.userId = user.id;
      req.session.user = { id: user.id, username: user.username, email: user.email };

      res.json({ 
        success: true, 
        user: { id: user.id, username: user.username, email: user.email }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.json({ success: true });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    
    req.user = { id: user.id, username: user.username, email: user.email || '' };
    next();
  } catch (error) {
    console.error('Auth check error:', error);
    res.status(401).json({ message: "Unauthorized" });
  }
};

// Get current user
export function getCurrentUser(req: any): { id: string; username: string; email: string } | null {
  return req.session?.user || null;
}