/**
 * API ENDPOINT: HEALTH CHECK
 *
 * GET /api/health
 * Verifica saúde do sistema e retorna status
 * Pode ser usado por monitoramento externo (UptimeRobot, etc.)
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface HealthStatus {
  status: "healthy" | "degraded" | "critical";
  timestamp: string;
  checks: {
    database: boolean;
    views: boolean;
    data: boolean;
  };
  details: {
    cotacoes: number;
    users: number;
    views_status: string[];
  };
}

export async function GET() {
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      views: false,
      data: false
    },
    details: {
      cotacoes: 0,
      users: 0,
      views_status: []
    }
  };

  try {
    // 1. Verificar conexão com banco
    await db.execute(sql`SELECT 1`);
    health.checks.database = true;

    // 2. Verificar views
    const requiredViews = ["vw_kpis", "vw_status_breakdown", "vw_cotadores", "vw_monthly_trend"];
    const viewsOk: string[] = [];

    for (const view of requiredViews) {
      try {
        await db.execute(sql`SELECT 1 FROM ${sql.identifier(view)} LIMIT 1`);
        viewsOk.push(view);
      } catch {
        health.details.views_status.push(`${view}: missing`);
        health.status = "degraded";
      }
    }

    health.checks.views = viewsOk.length === requiredViews.length;

    // 3. Verificar dados críticos
    const cotacoes = await db.execute(sql`
      SELECT COUNT(*) as total FROM cotacoes WHERE deleted_at IS NULL
    `);

    const users = await db.execute(sql`
      SELECT COUNT(*) as total FROM users WHERE is_active = true
    `);

    health.details.cotacoes = Number(cotacoes.rows[0].total);
    health.details.users = Number(users.rows[0].total);

    if (health.details.cotacoes === 0 || health.details.users === 0) {
      health.status = "critical";
    }

    health.checks.data = true;

  } catch (error: any) {
    health.status = "critical";
    health.checks.database = false;

    return NextResponse.json(
      {
        ...health,
        error: error.message
      },
      { status: 503 }
    );
  }

  // Status HTTP baseado no health
  const httpStatus = health.status === "healthy" ? 200 :
                     health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: httpStatus });
}
