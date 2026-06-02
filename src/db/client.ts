import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create the database client.");
  }

  return databaseUrl;
}

const sql = neon(getDatabaseUrl());

export const db = drizzle({ client: sql });
export { sql };
export type DbClient = typeof db;
