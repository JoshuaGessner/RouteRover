import { sql } from "drizzle-orm";
import { pgTable, text, varchar, real, timestamp, boolean, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for custom authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 100 }).unique().notNull(),
  email: varchar("email", { length: 255 }).unique(),
  password: varchar("password", { length: 255 }).notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const trips = pgTable("trips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  startLocation: jsonb("start_location").notNull(),
  endLocation: jsonb("end_location"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  distance: real("distance"),
  purpose: text("purpose").notNull().default("business"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  autoDetected: boolean("auto_detected").default(false),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  tripId: varchar("trip_id").references(() => trips.id),
  amount: real("amount").notNull(),
  category: text("category").notNull(),
  merchant: text("merchant"),
  date: timestamp("date").notNull(),
  notes: text("notes"),
  receiptId: varchar("receipt_id"),
});

export const receipts = pgTable("receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  expenseId: varchar("expense_id").references(() => expenses.id),
  imageUrl: text("image_url").notNull(),
  ocrText: text("ocr_text"),
  extractedData: jsonb("extracted_data"),
  uploadDate: timestamp("upload_date").notNull(),
});

export const scheduleEntries = pgTable("schedule_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  date: timestamp("date").notNull(),
  startAddress: text("start_address").notNull(),
  endAddress: text("end_address"),
  notes: text("notes"),
  calculatedDistance: real("calculated_distance"),
  calculatedAmount: real("calculated_amount"),
  isHotelStay: boolean("is_hotel_stay").default(false),
  processingStatus: text("processing_status").default("pending"), // pending, calculated, error
  errorMessage: text("error_message"),
  originalData: jsonb("original_data"),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  googleApiKey: text("google_api_key"),
  openaiApiKey: text("openai_api_key"),
  mileageRate: real("mileage_rate").default(0.655),
  autoDetectionEnabled: boolean("auto_detection_enabled").default(true),
  detectionSensitivity: real("detection_sensitivity").default(3),
  darkMode: boolean("dark_mode").default(false),
  pushNotifications: boolean("push_notifications").default(true),
  autoBackup: boolean("auto_backup").default(true),
  defaultStartAddress: text("default_start_address"),
  defaultEndAddress: text("default_end_address"),
});

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),
  context: jsonb("context"),
  timestamp: timestamp("timestamp").notNull(),
});

export const processedFiles = pgTable("processed_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileHash: text("file_hash").notNull(),
  fileName: text("file_name").notNull(),
  processedAt: timestamp("processed_at").notNull(),
  recordCount: integer("record_count").default(0),
});

export const apiUsage = pgTable("api_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  apiProvider: text("api_provider").notNull(), // "google_directions"
  endpoint: text("endpoint").notNull(),
  callCount: integer("call_count").default(1),
  month: text("month").notNull(), // YYYY-MM format
  lastCalled: timestamp("last_called").notNull(),
  totalCost: real("total_cost").default(0),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTripSchema = createInsertSchema(trips).omit({
  id: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
});

export const insertReceiptSchema = createInsertSchema(receipts).omit({
  id: true,
});

export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({
  id: true,
});

export const insertAppSettingsSchema = createInsertSchema(appSettings).omit({
  id: true,
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({
  id: true,
});

export const insertProcessedFileSchema = createInsertSchema(processedFiles).omit({
  id: true,
});

export const insertApiUsageSchema = createInsertSchema(apiUsage).omit({
  id: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;
export type Trip = typeof trips.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertReceipt = z.infer<typeof insertReceiptSchema>;
export type Receipt = typeof receipts.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettings.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertProcessedFile = z.infer<typeof insertProcessedFileSchema>;
export type ProcessedFile = typeof processedFiles.$inferSelect;
export type InsertApiUsage = z.infer<typeof insertApiUsageSchema>;
export type ApiUsage = typeof apiUsage.$inferSelect;
