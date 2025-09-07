import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { Express } from "express";

export function setupSecurity(app: Express) {
  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.openai.com", "https://maps.googleapis.com"],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        baseSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Needed for some APIs
  }));

  // CORS configuration - simplified for easier deployment
  const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : true)
      : true,
    credentials: true,
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Limit each IP to 100 requests per windowMs in production
    message: {
      error: "Too many requests from this IP, please try again later.",
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Stricter rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 auth requests per windowMs
    message: {
      error: "Too many authentication attempts, please try again later.",
    },
    skipSuccessfulRequests: true,
  });
  app.use('/api/login', authLimiter);
  app.use('/api/register', authLimiter);

  // API rate limiting
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // Limit each IP to 60 API requests per minute
    message: {
      error: "API rate limit exceeded, please slow down.",
    },
  });
  app.use('/api/', apiLimiter);

  // File upload rate limiting
  const uploadLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // Limit each IP to 10 uploads per 5 minutes
    message: {
      error: "Upload rate limit exceeded, please wait before uploading again.",
    },
  });
  app.use('/api/receipts/upload', uploadLimiter);
  app.use('/api/schedule/import', uploadLimiter);
}

// Middleware to sanitize user input
export function sanitizeInput(req: any, res: any, next: any) {
  // Remove potentially dangerous characters from string inputs
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Remove script tags and javascript: protocols
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .trim();
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
}