import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.");
}

const pool = mysql.createPool({
  uri: process.env.DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 1,
  maxIdle: 0,
  idleTimeout: 10000,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: "default" });

/**
 * Helper para executar raw SQL e retornar rows tipados.
 * Evita o problema de tipagem do mysql2 (ResultSetHeader vs RowDataPacket[]).
 */
export async function dbQuery<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  // mysql2 retorna [rows, fields] — extraimos apenas as rows
  const [rows] = result as unknown as [T[], unknown];
  return rows;
}
