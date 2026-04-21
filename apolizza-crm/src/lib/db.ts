import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import type { SQL } from "drizzle-orm";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Check your .env.local file.");
}

// Pool com connectionLimit=1 e destroy agressivo de conexões idle.
// HostGator limita 25 max_user_connections — com Vercel serverless,
// cada instância precisa liberar a conexão o mais rápido possível.
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
  });

  // Força destroy de conexões idle a cada 3s para não prender slots
  setInterval(() => {
    const p = globalForDb.mysqlPool;
    if (p) {
      // pool._freeConnections é interno do mysql2 mas acessível
      try { (p as any).pool?._freeConnections?.forEach((c: any) => c?.destroy?.()); } catch {}
    }
  }, 3000).unref();
}

const pool = globalForDb.mysqlPool;

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
