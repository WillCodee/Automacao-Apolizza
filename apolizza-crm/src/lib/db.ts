import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.");
}

// Pool com connectionLimit=1 e globalThis para serverless.
// HostGator limita 25 max_user_connections — cada instância usa no máximo 1.
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool };

if (!globalForDb.mysqlPool) {
  globalForDb.mysqlPool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 0,
    idleTimeout: 1000,
    connectTimeout: 10000,
    queueLimit: 0,
    enableKeepAlive: false,
    // mysql2 retorna DECIMAL/NUMERIC como string por padrão (preserva precisão).
    // Convertemos para Number globalmente — seguro para valores BRL até ~15 dígitos.
    decimalNumbers: true,
  });

  // Reconectar automaticamente em caso de erro fatal no pool
  (globalForDb.mysqlPool as unknown as import("events").EventEmitter).on("error", (err: { code?: string }) => {
    console.error("[db] Pool error:", err.code);
  });
}

const pool = globalForDb.mysqlPool;

export const db = drizzle(pool, { schema, mode: "default" });

/**
 * Helper para executar raw SQL e retornar rows tipados.
 * Inclui retry com backoff para ER_TOO_MANY_USER_CONNECTIONS.
 */
export async function dbQuery<T = Record<string, unknown>>(query: SQL): Promise<T[]> {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 500; // ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await db.execute(query);
      const [rows] = result as unknown as [T[], unknown];
      return rows;
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      const isRetryable =
        code === "ER_TOO_MANY_USER_CONNECTIONS" ||
        code === "ECONNREFUSED" ||
        code === "PROTOCOL_CONNECTION_LOST";

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }

  // Unreachable, but satisfies TS
  throw new Error("dbQuery: max retries exceeded");
}
