import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, getCurrentUser } from "./simpleAuth.js";
import { insertTripSchema, insertExpenseSchema, insertReceiptSchema, insertScheduleEntrySchema, insertAppSettingsSchema, insertErrorLogSchema } from "@shared/schema";
import multer from "multer";
import Tesseract from "tesseract.js";
import XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import fs from "fs";
import path from "path";

// Extend Request interface for multer
interface MulterRequest extends Request {
  file?: Express.Multer.File;
}

const upload = multer({ 
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper function to sanitize file paths
function sanitizeFilePath(filePath: string, baseDir: string = 'uploads/'): string {
  const resolvedPath = path.resolve(baseDir, path.basename(filePath));
  const basePath = path.resolve(baseDir);
  
  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(basePath)) {
    throw new Error('Invalid file path');
  }
  
  return resolvedPath;
}

// Google Directions API integration
async function calculateRoute(startAddress: string, endAddress: string, apiKey: string, userId?: string) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(startAddress)}&destination=${encodeURIComponent(endAddress)}&key=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // Track API usage if userId is provided
    if (userId) {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      await storage.trackApiCall({
        userId,
        apiProvider: 'google_directions',
        endpoint: '/directions',
        callCount: 1,
        month: currentMonth,
        lastCalled: new Date(),
        totalCost: 0.005 // $0.005 per request is Google's current rate
      });
    }
    
    if (data.status === "OK" && data.routes.length > 0) {
      const route = data.routes[0];
      const leg = route.legs[0];
      return {
        distance: leg.distance.value / 1609.34, // Convert meters to miles
        duration: leg.duration.value, // seconds
        startAddress: leg.start_address,
        endAddress: leg.end_address
      };
    } else {
      throw new Error(`Google Directions API error: ${data.status}`);
    }
  } catch (error) {
    throw new Error(`Failed to calculate route: ${error}`);
  }
}

// OCR processing
async function processReceiptOCR(imagePath: string, userId?: string) {
  // Try advanced AI analysis first if available
  if (userId) {
    const userSettings = await storage.getUserSettings(userId);
    if (userSettings?.openaiApiKey) {
      try {
        const aiResult = await processReceiptWithAI(imagePath, userSettings.openaiApiKey);
        if (aiResult) {
          return aiResult;
        }
      } catch (error) {
        console.error('AI processing failed, falling back to OCR:', error);
      }
    }
  }

  // Fallback to enhanced Tesseract OCR
  const worker = await Tesseract.createWorker('eng');
  
  const { data: { text } } = await worker.recognize(imagePath);
  await worker.terminate();
  
  // Extract structured data from OCR text
  const extractedData = extractReceiptData(text);
  
  return {
    ocrText: text,
    extractedData
  };
}

async function processReceiptWithAI(imagePath: string, openaiApiKey: string) {
  try {
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = path.extname(imagePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "gpt-4o", // gpt-4o has vision capabilities
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this receipt image and extract the following information in JSON format: merchant name, total amount (as a number), date (in MM/DD/YYYY format), tax amount (as a number), merchant address, phone number, and any line items. Be as accurate as possible with the amounts and dates. If you can't find certain information, use null for that field."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const aiData = JSON.parse(result.choices[0].message.content);
    
    // Also get raw text for backup
    const fallbackWorker = await Tesseract.createWorker('eng');
    const { data: { text } } = await fallbackWorker.recognize(imagePath);
    await fallbackWorker.terminate();
    
    return {
      ocrText: text,
      extractedData: {
        merchant: aiData.merchant || null,
        amount: typeof aiData.total_amount === 'number' ? aiData.total_amount : null,
        date: aiData.date || null,
        tax: typeof aiData.tax_amount === 'number' ? aiData.tax_amount : null,
        address: aiData.merchant_address || null,
        phone: aiData.phone_number || null,
        items: aiData.line_items || []
      }
    };
  } catch (error) {
    console.error('AI receipt processing error:', error);
    return null;
  }
}

function extractReceiptData(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const data: any = {};
  
  // Enhanced amount extraction with multiple patterns
  const amountPatterns = [
    /total.*?\$?([\d,]+\.?\d{0,2})/i,
    /amount.*?\$?([\d,]+\.?\d{0,2})/i,
    /subtotal.*?\$?([\d,]+\.?\d{0,2})/i,
    /\$[\d,]+\.\d{2}(?=\s*$)/gm, // End of line amounts
    /\$[\d,]+\.?\d{0,2}/g // General dollar amounts
  ];
  
  let amounts: number[] = [];
  for (const pattern of amountPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      const extractedAmounts = matches.map(match => {
        const numStr = match.replace(/[^\d.,]/g, '');
        return parseFloat(numStr.replace(/,/g, ''));
      }).filter(num => !isNaN(num) && num > 0);
      amounts.push(...extractedAmounts);
      if (pattern.source.includes('total')) break; // Prefer total if found
    }
  }
  
  if (amounts.length > 0) {
    data.amount = Math.max(...amounts);
  }
  
  // Enhanced date extraction with multiple formats
  const datePatterns = [
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\b/, // MM/DD/YYYY
    /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2}\b/, // MM/DD/YY
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
    /\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/, // YYYY/MM/DD
    /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b/i
  ];
  
  for (const pattern of datePatterns) {
    const dateMatch = text.match(pattern);
    if (dateMatch) {
      data.date = dateMatch[0];
      break;
    }
  }
  
  // Enhanced merchant extraction - look for business names in first few lines
  const merchantCandidates = lines.slice(0, 5).filter(line => {
    // Filter out obvious non-merchant lines
    return !line.match(/^\d+$/) && 
           !line.match(/^\$/) && 
           !line.match(/^(receipt|thank you|visit)/i) &&
           line.length > 2 && 
           line.length < 50;
  });
  
  if (merchantCandidates.length > 0) {
    // Pick the longest reasonable line as merchant name
    data.merchant = merchantCandidates.reduce((a, b) => 
      a.length > b.length ? a : b
    );
  }
  
  // Enhanced tax extraction
  const taxPatterns = [
    /tax.*?\$?([\d,]+\.?\d{0,2})/i,
    /sales tax.*?\$?([\d,]+\.?\d{0,2})/i,
    /hst.*?\$?([\d,]+\.?\d{0,2})/i,
    /vat.*?\$?([\d,]+\.?\d{0,2})/i,
    /gst.*?\$?([\d,]+\.?\d{0,2})/i
  ];
  
  for (const pattern of taxPatterns) {
    const taxMatch = text.match(pattern);
    if (taxMatch) {
      data.tax = parseFloat(taxMatch[1].replace(/,/g, ''));
      break;
    }
  }
  
  return data;
}

// File parsing utilities
function parseScheduleFile(filePath: string, fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  
  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true });
  } else if (ext === '.xlsx' || ext === '.xls') {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } else if (ext === '.txt') {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Simple tab/comma separated parsing
    const headers = lines[0].split(/\t|,/).map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(/\t|,/).map(v => v.trim());
      const obj: any = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] || '';
      });
      return obj;
    });
  }
  
  throw new Error('Unsupported file format');
}

function detectHeaders(data: any[]) {
  if (data.length === 0) return {};
  
  const firstRow = data[0];
  const headers = Object.keys(firstRow);
  
  const mapping: any = {};
  
  headers.forEach(header => {
    const lowerHeader = header.toLowerCase();
    
    // Date detection
    if (lowerHeader.includes('date') || lowerHeader.includes('day')) {
      mapping.date = header;
    }
    // Start address detection - more flexible patterns
    else if (
      (lowerHeader.includes('start') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('from'))) ||
      lowerHeader.includes('origin') ||
      lowerHeader.includes('departure') ||
      (lowerHeader.includes('from') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) ||
      lowerHeader === 'start' ||
      lowerHeader === 'from'
    ) {
      mapping.startAddress = header;
    }
    // End address detection - more flexible patterns  
    else if (
      (lowerHeader.includes('end') && (lowerHeader.includes('address') || lowerHeader.includes('location') || lowerHeader.includes('to'))) ||
      lowerHeader.includes('destination') ||
      lowerHeader.includes('arrival') ||
      (lowerHeader.includes('to') && (lowerHeader.includes('address') || lowerHeader.includes('location'))) ||
      lowerHeader === 'end' ||
      lowerHeader === 'to' ||
      lowerHeader === 'destination'
    ) {
      mapping.endAddress = header;
    }
    // Generic address fields if no start/end found yet
    else if (!mapping.startAddress && (lowerHeader.includes('address') || lowerHeader.includes('location'))) {
      mapping.startAddress = header;
    }
    // Notes detection
    else if (lowerHeader.includes('note') || lowerHeader.includes('comment') || lowerHeader.includes('description')) {
      mapping.notes = header;
    }
  });
  
  return mapping;
}

function detectHotelStay(notes: string): boolean {
  if (!notes) return false;
  const lowerNotes = notes.toLowerCase();
  return lowerNotes.includes('hotel') || lowerNotes.includes('motel') || lowerNotes.includes('stay') || lowerNotes.includes('lodging');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  setupAuth(app);

  // User route (for checking authentication status)
  app.get('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getCurrentUserId(req);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Helper function to get current user ID
  const getCurrentUserId = (req: any): string => {
    // For new simple auth system
    if (req.user?.id) {
      return req.user.id;
    }
    // If no user session, throw error instead of fallback
    throw new Error("User not authenticated - no valid user session found");
  };
  
  // Trips routes
  app.get("/api/trips", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const trips = await storage.getTrips(userId);
      res.json(trips);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.post("/api/trips", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const validatedData = insertTripSchema.parse({ ...req.body, userId });
      const trip = await storage.createTrip(validatedData);
      res.json(trip);
    } catch (error) {
      res.status(400).json({ message: "Invalid trip data" });
    }
  });

  app.patch("/api/trips/:id", async (req, res) => {
    try {
      const trip = await storage.updateTrip(req.params.id, req.body);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }
      res.json(trip);
    } catch (error) {
      res.status(500).json({ message: "Failed to update trip" });
    }
  });

  app.get("/api/trips/active", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const activeTrip = await storage.getActiveTrip(userId);
      res.json(activeTrip);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch active trip" });
    }
  });

  // Expenses routes
  app.get("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenses = await storage.getExpenses(userId);
      res.json(expenses);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenseData = {
        ...req.body,
        userId,
        date: new Date(req.body.date)
      };
      const validatedData = insertExpenseSchema.parse(expenseData);
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error: any) {
      console.error('Expense validation error:', error);
      res.status(400).json({ message: "Invalid expense data", error: error?.message || 'Unknown error' });
    }
  });

  app.patch("/api/expenses/:id", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenseId = req.params.id;
      
      // Check if expense exists and belongs to user
      const existingExpense = await storage.getExpense(expenseId);
      if (!existingExpense || existingExpense.userId !== userId) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const expenseData = {
        ...req.body,
        ...(req.body.date && { date: new Date(req.body.date) })
      };
      
      const expense = await storage.updateExpense(expenseId, expenseData);
      res.json(expense);
    } catch (error: any) {
      console.error('Expense update error:', error);
      res.status(400).json({ message: "Failed to update expense", error: error?.message || 'Unknown error' });
    }
  });

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const expenseId = req.params.id;
      
      // Check if expense exists and belongs to user
      const existingExpense = await storage.getExpense(expenseId);
      if (!existingExpense || existingExpense.userId !== userId) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const deleted = await storage.deleteExpense(expenseId);
      if (deleted) {
        res.json({ message: "Expense deleted successfully" });
      } else {
        res.status(404).json({ message: "Expense not found" });
      }
    } catch (error: any) {
      console.error('Expense deletion error:', error);
      res.status(500).json({ message: "Failed to delete expense", error: error?.message || 'Unknown error' });
    }
  });

  // Receipts routes
  app.get("/api/receipts", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const receipts = await storage.getReceipts(userId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  app.post("/api/receipts", upload.single('image'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const userId = getCurrentUserId(req);
      
      // Sanitize file path to prevent path traversal
      const sanitizedPath = sanitizeFilePath(req.file.path);
      const { ocrText, extractedData } = await processReceiptOCR(sanitizedPath, userId);
      
      const receiptData = insertReceiptSchema.parse({
        userId,
        imageUrl: `/uploads/${req.file.filename}`,
        ocrText,
        extractedData,
        uploadDate: new Date()
      });

      const receipt = await storage.createReceipt(receiptData);
      
      // Keep the uploaded file for serving images (don't delete it)
      // fs.unlinkSync(req.file.path); // Commented out to preserve images
      
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to process receipt" });
    }
  });

  // Schedule routes
  app.get("/api/schedule", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const entries = await storage.getScheduleEntries(userId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch schedule entries" });
    }
  });

  app.post("/api/schedule/import", upload.single('file'), async (req: MulterRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      const parsedData = parseScheduleFile(req.file.path, req.file.originalname);
      const headerMapping = detectHeaders(parsedData);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      res.json({
        data: parsedData,
        headerMapping,
        totalRows: parsedData.length
      });
    } catch (error) {
      console.error("Schedule import error:", error);
      // Clean up uploaded file if it exists
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanup) {
          console.error("Failed to cleanup file:", cleanup);
        }
      }
      res.status(500).json({ message: `Failed to parse schedule file: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  app.post("/api/schedule/process", async (req, res) => {
    try {
      const { data, headerMapping, mileageRate, fileHash, fileName } = req.body;
      const userId = getCurrentUserId(req);
      
      const userSettings = await storage.getUserSettings(userId);
      const apiKey = userSettings?.googleApiKey;
      const defaultStartAddress = userSettings?.defaultStartAddress;
      const defaultEndAddress = userSettings?.defaultEndAddress || defaultStartAddress;
      
      if (!apiKey) {
        return res.status(400).json({ message: "Google API key not configured" });
      }

      if (!defaultStartAddress) {
        return res.status(400).json({ message: "Default start address not configured in settings" });
      }

      // Check for duplicate file processing using hash
      if (fileHash) {
        const existingFileProcess = await storage.getProcessedFileHash(userId, fileHash);
        if (existingFileProcess) {
          return res.status(409).json({ 
            message: "This file has already been processed",
            processedAt: existingFileProcess.processedAt,
            recordCount: existingFileProcess.recordCount
          });
        }
      }

      // Check for existing data in date ranges to avoid unnecessary API calls
      const dateRanges = new Map();
      for (const row of data) {
        const date = new Date(row[headerMapping.date]);
        if (!isNaN(date.getTime())) {
          const dateStr = date.toISOString().split('T')[0];
          if (!dateRanges.has(dateStr)) {
            dateRanges.set(dateStr, []);
          }
          dateRanges.get(dateStr).push(row);
        }
      }

      // Filter out dates that already have complete data
      const existingSchedule = await storage.getScheduleEntries(userId);
      const existingDates = new Set(existingSchedule.map(entry => 
        new Date(entry.date).toISOString().split('T')[0]
      ));
      
      let newDataCount = 0;
      const filteredDateRanges = new Map();
      for (const [dateStr, entries] of Array.from(dateRanges)) {
        if (!existingDates.has(dateStr)) {
          filteredDateRanges.set(dateStr, entries);
          newDataCount += entries.length;
        }
      }

      if (filteredDateRanges.size === 0) {
        return res.status(409).json({
          message: "All dates in this file have already been processed",
          skippedCount: data.length
        });
      }

      // Use filtered data to build daily routes, only processing new dates
      const entriesByDate = new Map();
      for (const [dateStr, entries] of Array.from(filteredDateRanges)) {
        for (const row of entries) {
          const rawDate = row[headerMapping.date];
          // Handle Excel date format (numeric days since 1900-01-01) 
          let parsedDate: Date;
          if (typeof rawDate === 'number') {
            // Excel dates: add days to Excel epoch (1900-01-01, but Excel incorrectly treats 1900 as leap year)
            parsedDate = new Date(1900, 0, rawDate - 1); // -1 because Excel starts from day 1, not 0
          } else {
            parsedDate = new Date(rawDate);
          }
          const date = parsedDate.toDateString();
          if (!entriesByDate.has(date)) {
            entriesByDate.set(date, []);
          }
          entriesByDate.get(date).push(row);
        }
      }

      const results = [];
      let previousHotelAddress = null;
      
      // Clear existing schedule entries before adding new ones (optional - or keep to accumulate)
      // await storage.clearScheduleEntries(userId); // Uncomment to replace vs accumulate
      
      // Process each day to build daily routes
      for (const [dateString, dayEntries] of Array.from(entriesByDate)) {
        try {
          const date = new Date(dateString);
          let dayStartAddress = previousHotelAddress || defaultStartAddress;
          let dayEndAddress = defaultEndAddress;
          let totalDayDistance = 0;
          let hasHotelStay = false;
          let hotelAddress = null;

          // Build the route for this day: start -> locations -> end
          const locations = dayEntries.map((row: any) => ({
            address: row[headerMapping.startAddress],
            notes: row[headerMapping.notes] || '',
            originalData: JSON.parse(JSON.stringify(row))
          }));

          // Check for hotel stays
          for (const location of locations) {
            if (detectHotelStay(location.notes)) {
              hasHotelStay = true;
              hotelAddress = location.address;
              dayEndAddress = location.address; // End at hotel
              break;
            }
          }

          // Calculate total route: start -> all locations -> end
          if (locations.length > 0) {
            let currentLocation = dayStartAddress;
            
            // Calculate route to each location
            for (const location of locations) {
              if (currentLocation !== location.address && location.address) {
                const routeInfo = await calculateRoute(currentLocation, location.address, apiKey, userId);
                totalDayDistance += routeInfo.distance;
              }
              currentLocation = location.address || currentLocation;
            }
            
            // Calculate route back to end address (if different from last location)
            if (currentLocation !== dayEndAddress && !hasHotelStay && dayEndAddress) {
              const routeInfo = await calculateRoute(currentLocation, dayEndAddress, apiKey, userId);
              totalDayDistance += routeInfo.distance;
            }
          }

          const calculatedAmount = totalDayDistance * (mileageRate || 0.655);
          
          // Check if entry for this date already exists
          const existingEntries = await storage.getScheduleEntries(userId);
          const existingEntry = existingEntries.find(entry => 
            new Date(entry.date).toISOString().split('T')[0] === date.toISOString().split('T')[0]
          );
          
          let entry;
          if (existingEntry) {
            // Update existing entry by combining data
            entry = await storage.updateScheduleEntry(existingEntry.id, {
              calculatedDistance: (existingEntry.calculatedDistance || 0) + totalDayDistance,
              calculatedAmount: (existingEntry.calculatedAmount || 0) + calculatedAmount,
              notes: `${existingEntry.notes} | ${locations.map((l: any) => l.address).join(' → ')} ${hasHotelStay ? '(Hotel stay)' : ''}`,
              isHotelStay: existingEntry.isHotelStay || hasHotelStay,
              processingStatus: 'calculated',
              originalData: [...(existingEntry.originalData as any[] || []), ...dayEntries]
            });
          } else {
            // Create new entry
            entry = await storage.createScheduleEntry({
              userId,
              date,
              startAddress: dayStartAddress,
              endAddress: dayEndAddress,
              notes: `Daily route: ${locations.map((l: any) => l.address).join(' → ')} ${hasHotelStay ? '(Hotel stay)' : ''}`,
              calculatedDistance: totalDayDistance,
              calculatedAmount,
              isHotelStay: hasHotelStay,
              processingStatus: 'calculated',
              originalData: dayEntries
            });
          }
          
          results.push(entry);
          
          // Set hotel as next day's starting point
          if (hasHotelStay) {
            previousHotelAddress = hotelAddress;
          } else {
            previousHotelAddress = null; // Reset to default start address
          }
        } catch (error) {
          // Create error entry for the whole day
          const errorEntry = await storage.createScheduleEntry({
            userId,
            date: new Date(dateString),
            startAddress: previousHotelAddress || defaultStartAddress,
            endAddress: defaultEndAddress,
            notes: `Error processing daily route for ${dateString}`,
            processingStatus: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            originalData: dayEntries as any
          });
          
          results.push(errorEntry);
          
          // Log error
          await storage.createErrorLog({
            userId,
            errorType: 'daily_route_calculation',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            context: { date: dateString, entriesCount: dayEntries.length },
            timestamp: new Date()
          });
        }
      }

      // Record that this file has been processed
      if (fileHash && fileName) {
        await storage.createProcessedFile({
          userId,
          fileHash,
          fileName,
          processedAt: new Date(),
          recordCount: newDataCount
        });
      }

      // Save all accumulated entries to database
      for (const entry of results) {
        if (entry) {
          await storage.createScheduleEntry(entry);
        }
      }

      return res.json({
        message: "Schedule data processed successfully",
        entriesProcessed: results.length,
        newDatesProcessed: filteredDateRanges.size,
        apiCallsMade: Array.from(entriesByDate.values()).reduce((sum, dayEntries) => sum + dayEntries.length, 0),
        skippedDuplicates: data.length - newDataCount
      });
    } catch (error: any) {
      console.error("Schedule processing error:", error);
      res.status(500).json({ message: `Failed to process schedule: ${error instanceof Error ? error.message : 'Unknown error'}` });
    }
  });

  // API Usage route
  app.get("/api/usage/:month?", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const month = req.params.month || new Date().toISOString().slice(0, 7);
      
      const stats = await storage.getMonthlyApiStats(userId, month);
      const usage = await storage.getApiUsage(userId, month);
      
      res.json({
        ...stats,
        usage,
        month
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch API usage" });
    }
  });

  // Analytics route
  app.get("/api/analytics", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const scheduleEntries = await storage.getScheduleEntries(userId);
      
      const totalDistance = scheduleEntries.reduce((sum, entry) => sum + (entry.calculatedDistance || 0), 0);
      const totalAmount = scheduleEntries.reduce((sum, entry) => sum + (entry.calculatedAmount || 0), 0);
      const tripDays = scheduleEntries.length;
      const avgDailyDistance = tripDays > 0 ? totalDistance / tripDays : 0;
      
      // Group by month for trend analysis
      const monthlyData = scheduleEntries.reduce((acc, entry) => {
        const month = new Date(entry.date).toISOString().slice(0, 7);
        if (!acc[month]) {
          acc[month] = { distance: 0, amount: 0, days: 0 };
        }
        acc[month].distance += entry.calculatedDistance || 0;
        acc[month].amount += entry.calculatedAmount || 0;
        acc[month].days += 1;
        return acc;
      }, {} as Record<string, {distance: number, amount: number, days: number}>);

      res.json({
        totalDistance,
        totalAmount,
        tripDays,
        avgDailyDistance,
        monthlyTrends: Object.entries(monthlyData).map(([month, data]) => ({
          month,
          ...data,
          avgDistance: data.days > 0 ? data.distance / data.days : 0
        }))
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Settings routes
  app.get("/api/settings", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const validatedData = insertAppSettingsSchema.parse({ ...req.body, userId });
      const settings = await storage.createOrUpdateSettings(validatedData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  // Error logs route
  app.get("/api/error-logs", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const logs = await storage.getErrorLogs(userId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch error logs" });
    }
  });

  // Export data route
  app.get("/api/export", async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const trips = await storage.getTrips(userId);
      const expenses = await storage.getExpenses(userId);
      const receipts = await storage.getReceipts(userId);
      const schedule = await storage.getScheduleEntries(userId);
      
      const exportData = {
        trips,
        expenses,
        receipts,
        schedule,
        exportDate: new Date()
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="miletracker-export.json"');
      res.json(exportData);
    } catch (error) {
      res.status(500).json({ message: "Failed to export data" });
    }
  });

  // Data sharing routes
  app.post('/api/share/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shareCode = 'SHARE' + Math.random().toString(36).substring(2, 15).toUpperCase();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      // Store share code with user data (simplified - in production use proper storage)
      res.json({ shareCode, expiresAt });
    } catch (error) {
      console.error('Error generating share code:', error);
      res.status(500).json({ message: 'Failed to generate share code' });
    }
  });

  app.post('/api/share/import', isAuthenticated, async (req: any, res) => {
    try {
      const { shareCode } = req.body;
      const userId = req.user.claims.sub;
      
      // In production, validate the share code and import shared data
      // For now, just return success
      res.json({ message: 'Data imported successfully', imported: 0 });
    } catch (error) {
      console.error('Error importing shared data:', error);
      res.status(500).json({ message: 'Failed to import shared data' });
    }
  });

  // Export schedule data for IRS reporting
  app.get("/api/export/schedule", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const scheduleEntries = await storage.getScheduleEntries(userId);
      
      // Format data for IRS compliance
      const irsData = scheduleEntries.map((entry: any) => {
        return {
          'Date': new Date(entry.date).toLocaleDateString('en-US'),
          'Start Location': entry.startAddress || '',
          'End Location': entry.endAddress || '',
          'Miles': (entry.calculatedDistance || 0).toFixed(2),
          'Mileage Rate': '$0.655',
          'Mileage Deduction': `$${((entry.calculatedDistance || 0) * 0.655).toFixed(2)}`,
          'Hotel Stay': entry.isHotelStay ? 'Yes' : 'No',
          'Processing Status': entry.processingStatus || 'Pending',
          'Notes': entry.notes || '',
          'Error Message': entry.errorMessage || ''
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(irsData);
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 25 }, // Start Location
        { wch: 25 }, // End Location
        { wch: 12 }, // Miles
        { wch: 12 }, // Mileage Rate
        { wch: 15 }, // Mileage Deduction
        { wch: 12 }, // Hotel Stay
        { wch: 18 }, // Processing Status
        { wch: 30 }, // Notes
        { wch: 20 }  // Error Message
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Schedule Report');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers for file download
      const filename = `route-rover-schedule-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      res.send(excelBuffer);
    } catch (error: any) {
      console.error('Schedule export error:', error);
      res.status(500).json({ message: 'Failed to export schedule data', error: error.message });
    }
  });

  // Export routes data for IRS reporting
  app.get("/api/export/routes", isAuthenticated, async (req, res) => {
    try {
      const userId = getCurrentUserId(req);
      const trips = await storage.getTrips(userId);
      const expenses = await storage.getExpenses(userId);
      
      // Create expense lookup by trip ID
      const expensesByTrip = expenses.reduce((acc: Record<string, any[]>, expense: any) => {
        if (expense.tripId) {
          if (!acc[expense.tripId]) acc[expense.tripId] = [];
          acc[expense.tripId].push(expense);
        }
        return acc;
      }, {} as Record<string, any[]>);

      // Format data for IRS compliance
      const irsData = trips.map((trip: any) => {
        const startLocation = trip.startLocation as any;
        const endLocation = trip.endLocation as any;
        const tripExpenses = expensesByTrip[trip.id] || [];
        const totalExpenses = tripExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
        
        return {
          'Date': new Date(trip.startTime).toLocaleDateString('en-US'),
          'Start Time': new Date(trip.startTime).toLocaleTimeString('en-US'),
          'End Time': trip.endTime ? new Date(trip.endTime).toLocaleTimeString('en-US') : 'In Progress',
          'Start Location': startLocation?.address || `${startLocation?.lat}, ${startLocation?.lng}`,
          'End Location': endLocation?.address || `${endLocation?.lat}, ${endLocation?.lng}`,
          'Business Purpose': trip.purpose || 'Business',
          'Total Miles': (trip.distance || 0).toFixed(2),
          'Business Miles': (trip.distance || 0).toFixed(2),
          'Personal Miles': '0.00',
          'Mileage Rate': '$0.655',
          'Mileage Deduction': `$${((trip.distance || 0) * 0.655).toFixed(2)}`,
          'Additional Expenses': `$${totalExpenses.toFixed(2)}`,
          'Total Deduction': `$${((trip.distance || 0) * 0.655 + totalExpenses).toFixed(2)}`,
          'Notes': trip.notes || '',
          'Auto Detected': trip.autoDetected ? 'Yes' : 'No'
        };
      });

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(irsData);
      
      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 12 }, // Start Time
        { wch: 12 }, // End Time
        { wch: 25 }, // Start Location
        { wch: 25 }, // End Location
        { wch: 15 }, // Business Purpose
        { wch: 12 }, // Total Miles
        { wch: 12 }, // Business Miles
        { wch: 12 }, // Personal Miles
        { wch: 12 }, // Mileage Rate
        { wch: 15 }, // Mileage Deduction
        { wch: 18 }, // Additional Expenses
        { wch: 15 }, // Total Deduction
        { wch: 30 }, // Notes
        { wch: 12 }  // Auto Detected
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'IRS Mileage Report');
      
      // Generate Excel file
      const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Set response headers for file download
      const filename = `route-rover-mileage-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      
      res.send(excelBuffer);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({ message: 'Failed to export data' });
    }
  });

  // Serve uploaded images statically
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(process.cwd(), 'uploads', req.path);
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send('File not found');
    }
  });

  // Receipt management routes
  app.delete("/api/receipts/:id", async (req, res) => {
    try {
      const receiptId = req.params.id;
      const userId = getCurrentUserId(req);
      
      // Get receipt first to check ownership and get file path
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt || receipt.userId !== userId) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      // Delete the image file if it exists
      if (receipt.imageUrl) {
        try {
          // Extract filename and sanitize path
          const filename = path.basename(receipt.imageUrl);
          const sanitizedPath = sanitizeFilePath(filename);
          fs.unlinkSync(sanitizedPath);
        } catch (error) {
          console.warn('Could not delete image file:', error);
        }
      }

      await storage.deleteReceipt(receiptId);
      res.json({ message: "Receipt deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete receipt" });
    }
  });

  app.put("/api/receipts/:id", async (req, res) => {
    try {
      const receiptId = req.params.id;
      const userId = getCurrentUserId(req);
      const updateData = req.body;

      // Get receipt first to check ownership
      const receipt = await storage.getReceipt(receiptId);
      if (!receipt || receipt.userId !== userId) {
        return res.status(404).json({ message: "Receipt not found" });
      }

      const updatedReceipt = await storage.updateReceipt(receiptId, updateData);
      res.json(updatedReceipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to update receipt" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
