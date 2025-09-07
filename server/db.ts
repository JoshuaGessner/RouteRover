import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Default DATABASE_URL for local development
const defaultDatabaseUrl = 'postgresql://postgres:password@localhost:5432/routerover';
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

if (databaseUrl === defaultDatabaseUrl) {
  console.warn('⚠️  Using default database URL. Set DATABASE_URL environment variable for production.');
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });