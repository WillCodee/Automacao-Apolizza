/**
 * HEALTH CHECK AUTOMÁTICO
 *
 * Verifica saúde do sistema e corrige problemas automaticamente
 * Executa validações básicas e recria views se necessário
 *
 * Uso: npx tsx scripts/health-check.ts
 * Pode ser executado via cron ou API endpoint
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL not found in .env.local");
}

const client = neon(dbUrl);
const db = drizzle({ client });

interface HealthCheckResult {
  status: "healthy" | "degraded" | "critical";
  timestamp: string;
  checks: {
    database: boolean;
    views: boolean;
    data: boolean;
  };
  issues: string[];
  fixes_applied: string[];
}

async function healthCheck(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      database: false,
      views: false,
      data: false
    },
    issues: [],
    fixes_applied: []
  };

  console.log("\n🏥 HEALTH CHECK INICIADO\n");

  // ========================================
  // 1. VERIFICAR CONEXÃO COM BANCO
  // ========================================
  console.log("1️⃣  Verificando conexão com banco...");
  try {
    await db.execute(sql`SELECT 1`);
    result.checks.database = true;
    console.log("   ✅ Banco conectado\n");
  } catch (error: any) {
    result.checks.database = false;
    result.issues.push(`Falha na conexão: ${error.message}`);
    result.status = "critical";
    console.log(`   ❌ Erro: ${error.message}\n`);
    return result;
  }

  // ========================================
  // 2. VERIFICAR VIEWS SQL
  // ========================================
  console.log("2️⃣  Verificando views SQL...");

  const requiredViews = ["vw_kpis", "vw_status_breakdown", "vw_cotadores", "vw_monthly_trend"];
  const missingViews: string[] = [];

  for (const view of requiredViews) {
    try {
      await db.execute(sql`SELECT 1 FROM ${sql.identifier(view)} LIMIT 1`);
      console.log(`   ✅ ${view}`);
    } catch (error) {
      console.log(`   ❌ ${view} não encontrada`);
      missingViews.push(view);
    }
  }

  if (missingViews.length > 0) {
    console.log(`\n   🔧 Recriando ${missingViews.length} views...`);
    try {
      await execAsync("npx tsx scripts/create-views.ts");
      result.fixes_applied.push(`Recriadas ${missingViews.length} views: ${missingViews.join(", ")}`);
      result.checks.views = true;
      console.log("   ✅ Views recriadas com sucesso\n");
    } catch (error: any) {
      result.issues.push(`Falha ao recriar views: ${error.message}`);
      result.status = "degraded";
      result.checks.views = false;
      console.log(`   ❌ Erro ao recriar views: ${error.message}\n`);
    }
  } else {
    result.checks.views = true;
    console.log("");
  }

  // ========================================
  // 3. VERIFICAR DADOS CRÍTICOS
  // ========================================
  console.log("3️⃣  Verificando dados críticos...");

  try {
    const cotacoes = await db.execute(sql`
      SELECT COUNT(*) as total FROM cotacoes WHERE deleted_at IS NULL
    `);

    const users = await db.execute(sql`
      SELECT COUNT(*) as total FROM users WHERE is_active = true
    `);

    const totalCotacoes = cotacoes.rows[0].total;
    const totalUsers = users.rows[0].total;

    console.log(`   ✅ ${totalCotacoes} cotações ativas`);
    console.log(`   ✅ ${totalUsers} usuários ativos`);

    if (totalCotacoes === 0) {
      result.issues.push("Nenhuma cotação ativa no sistema!");
      result.status = "critical";
    }

    if (totalUsers === 0) {
      result.issues.push("Nenhum usuário ativo no sistema!");
      result.status = "critical";
    }

    result.checks.data = true;
  } catch (error: any) {
    result.issues.push(`Erro ao verificar dados: ${error.message}`);
    result.status = "degraded";
    result.checks.data = false;
    console.log(`   ❌ Erro: ${error.message}`);
  }

  console.log("");

  // ========================================
  // RESUMO
  // ========================================
  console.log("=".repeat(60));
  console.log("📊 RESUMO DO HEALTH CHECK");
  console.log("=".repeat(60) + "\n");

  const statusIcon = result.status === "healthy" ? "✅" :
                     result.status === "degraded" ? "⚠️ " : "❌";

  console.log(`Status: ${statusIcon} ${result.status.toUpperCase()}`);
  console.log(`Timestamp: ${result.timestamp}\n`);

  console.log("Checks:");
  console.log(`  Database: ${result.checks.database ? "✅" : "❌"}`);
  console.log(`  Views: ${result.checks.views ? "✅" : "❌"}`);
  console.log(`  Data: ${result.checks.data ? "✅" : "❌"}`);

  if (result.fixes_applied.length > 0) {
    console.log("\nCorreções aplicadas:");
    result.fixes_applied.forEach(fix => console.log(`  🔧 ${fix}`));
  }

  if (result.issues.length > 0) {
    console.log("\nProblemas identificados:");
    result.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
  }

  console.log("");

  return result;
}

// Executar health check
healthCheck()
  .then(result => {
    if (result.status === "critical") {
      console.error("❌ CRÍTICO: Sistema requer atenção imediata!");
      process.exit(1);
    } else if (result.status === "degraded") {
      console.warn("⚠️  DEGRADADO: Sistema funcionando com problemas");
      process.exit(0);
    } else {
      console.log("✅ Sistema saudável!");
      process.exit(0);
    }
  })
  .catch(error => {
    console.error("❌ Erro fatal no health check:", error);
    process.exit(1);
  });
