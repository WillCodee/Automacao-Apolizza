/**
 * VALIDAÇÃO DE INTEGRIDADE DOS DADOS
 *
 * Verifica:
 * - Existência de tabelas críticas
 * - Existência de views SQL
 * - Integridade referencial
 * - Dados órfãos
 * - Inconsistências
 *
 * Uso: npx tsx scripts/validate-data.ts [--fix]
 * --fix: Tenta corrigir problemas automaticamente
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { execSync } from "child_process";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error("DATABASE_URL not found in .env.local");
}

const client = neon(dbUrl);
const db = drizzle({ client });

interface ValidationResult {
  category: string;
  test: string;
  status: "OK" | "WARNING" | "ERROR";
  message: string;
  fixable?: boolean;
}

const results: ValidationResult[] = [];

async function addResult(category: string, test: string, status: "OK" | "WARNING" | "ERROR", message: string, fixable = false) {
  results.push({ category, test, status, message, fixable });

  const icon = status === "OK" ? "✅" : status === "WARNING" ? "⚠️ " : "❌";
  console.log(`${icon} [${category}] ${test}: ${message}`);
}

async function validateDatabase(autoFix = false) {
  console.log("\n🔍 INICIANDO VALIDAÇÃO DE INTEGRIDADE\n");
  console.log(`Modo: ${autoFix ? "AUTO-FIX" : "SOMENTE LEITURA"}\n`);

  // ========================================
  // 1. TABELAS CRÍTICAS
  // ========================================
  console.log("📋 1. TABELAS CRÍTICAS\n");

  const requiredTables = [
    "users",
    "cotacoes",
    "cotacao_docs",
    "cotacao_history",
    "metas",
    "status_config",
    "comissao_tabela",
    "tarefas"
  ];

  const optionalTables = [
    "notificacoes",
    "grupos"
  ];

  for (const table of requiredTables) {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${table}
        ) as exists
      `);

      if (result.rows[0].exists) {
        await addResult("TABELAS", table, "OK", "Tabela existe");
      } else {
        await addResult("TABELAS", table, "ERROR", "Tabela não encontrada", false);
      }
    } catch (error: any) {
      await addResult("TABELAS", table, "ERROR", `Erro ao verificar: ${error.message}`, false);
    }
  }

  // Tabelas opcionais (não críticas)
  for (const table of optionalTables) {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = ${table}
        ) as exists
      `);

      if (result.rows[0].exists) {
        await addResult("TABELAS", table, "OK", "Tabela existe (opcional)");
      } else {
        await addResult("TABELAS", table, "WARNING", "Tabela não encontrada (opcional)", false);
      }
    } catch (error: any) {
      await addResult("TABELAS", table, "WARNING", `Tabela opcional não disponível`, false);
    }
  }

  // ========================================
  // 2. VIEWS SQL
  // ========================================
  console.log("\n📊 2. VIEWS SQL\n");

  const requiredViews = [
    "vw_kpis",
    "vw_status_breakdown",
    "vw_cotadores",
    "vw_monthly_trend"
  ];

  for (const view of requiredViews) {
    try {
      const result = await db.execute(sql`
        SELECT COUNT(*) as count FROM ${sql.identifier(view)}
      `);

      await addResult("VIEWS", view, "OK", `View existe com ${result.rows[0].count} registros`);
    } catch (error: any) {
      await addResult("VIEWS", view, "ERROR", "View não encontrada", true);

      if (autoFix) {
        console.log(`  🔧 Recriando view ${view}...`);
        try {
          execSync("npx tsx scripts/create-views.ts", { stdio: "inherit" });
          await addResult("VIEWS", view, "OK", "View recriada com sucesso");
        } catch (fixError: any) {
          await addResult("VIEWS", view, "ERROR", `Falha ao recriar: ${fixError.message}`, false);
        }
      }
    }
  }

  // ========================================
  // 3. INTEGRIDADE REFERENCIAL
  // ========================================
  console.log("\n🔗 3. INTEGRIDADE REFERENCIAL\n");

  // Cotações com assignee_id inválido
  try {
    const orphanCotacoes = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cotacoes c
      WHERE c.assignee_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.assignee_id)
    `);

    if (orphanCotacoes.rows[0].count === 0) {
      await addResult("INTEGRIDADE", "cotacoes.assignee_id", "OK", "Todas as referências são válidas");
    } else {
      await addResult("INTEGRIDADE", "cotacoes.assignee_id", "WARNING",
        `${orphanCotacoes.rows[0].count} cotações com assignee_id inválido`, false);
    }
  } catch (error: any) {
    await addResult("INTEGRIDADE", "cotacoes.assignee_id", "ERROR", error.message, false);
  }

  // Documentos órfãos
  try {
    const orphanDocs = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cotacao_docs d
      WHERE NOT EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = d.cotacao_id)
    `);

    if (orphanDocs.rows[0].count === 0) {
      await addResult("INTEGRIDADE", "cotacao_docs.cotacao_id", "OK", "Todos os documentos têm cotação válida");
    } else {
      await addResult("INTEGRIDADE", "cotacao_docs.cotacao_id", "WARNING",
        `${orphanDocs.rows[0].count} documentos órfãos`, false);
    }
  } catch (error: any) {
    await addResult("INTEGRIDADE", "cotacao_docs.cotacao_id", "ERROR", error.message, false);
  }

  // Histórico órfão
  try {
    const orphanHistory = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM cotacao_history h
      WHERE NOT EXISTS (SELECT 1 FROM cotacoes c WHERE c.id = h.cotacao_id)
    `);

    if (orphanHistory.rows[0].count === 0) {
      await addResult("INTEGRIDADE", "cotacao_history.cotacao_id", "OK", "Todo histórico tem cotação válida");
    } else {
      await addResult("INTEGRIDADE", "cotacao_history.cotacao_id", "WARNING",
        `${orphanHistory.rows[0].count} registros de histórico órfãos`, false);
    }
  } catch (error: any) {
    await addResult("INTEGRIDADE", "cotacao_history.cotacao_id", "ERROR", error.message, false);
  }

  // ========================================
  // 4. CONSISTÊNCIA DE DADOS
  // ========================================
  console.log("\n📈 4. CONSISTÊNCIA DE DADOS\n");

  // Cotações sem deleted_at nulas (soft delete correto)
  try {
    const deletedCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM cotacoes WHERE deleted_at IS NOT NULL
    `);

    await addResult("CONSISTÊNCIA", "soft_delete", "OK",
      `${deletedCount.rows[0].count} cotações deletadas (soft delete funcionando)`);
  } catch (error: any) {
    await addResult("CONSISTÊNCIA", "soft_delete", "ERROR", error.message, false);
  }

  // Usuários ativos
  try {
    const activeUsers = await db.execute(sql`
      SELECT COUNT(*) as count FROM users WHERE is_active = true
    `);

    if (activeUsers.rows[0].count > 0) {
      await addResult("CONSISTÊNCIA", "active_users", "OK", `${activeUsers.rows[0].count} usuários ativos`);
    } else {
      await addResult("CONSISTÊNCIA", "active_users", "ERROR", "Nenhum usuário ativo!", false);
    }
  } catch (error: any) {
    await addResult("CONSISTÊNCIA", "active_users", "ERROR", error.message, false);
  }

  // ========================================
  // 5. DADOS CRÍTICOS
  // ========================================
  console.log("\n💎 5. DADOS CRÍTICOS\n");

  // Total de cotações
  try {
    const totalCotacoes = await db.execute(sql`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE deleted_at IS NULL) as ativas
      FROM cotacoes
    `);

    if (totalCotacoes.rows[0].ativas > 0) {
      await addResult("DADOS", "cotacoes", "OK",
        `${totalCotacoes.rows[0].ativas} cotações ativas de ${totalCotacoes.rows[0].total} total`);
    } else {
      await addResult("DADOS", "cotacoes", "ERROR", "Nenhuma cotação ativa!", false);
    }
  } catch (error: any) {
    await addResult("DADOS", "cotacoes", "ERROR", error.message, false);
  }

  // ========================================
  // RESUMO FINAL
  // ========================================
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DA VALIDAÇÃO");
  console.log("=".repeat(60) + "\n");

  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === "OK").length,
    warning: results.filter(r => r.status === "WARNING").length,
    error: results.filter(r => r.status === "ERROR").length,
    fixable: results.filter(r => r.fixable).length
  };

  console.log(`Total de testes: ${summary.total}`);
  console.log(`✅ OK: ${summary.ok}`);
  console.log(`⚠️  Avisos: ${summary.warning}`);
  console.log(`❌ Erros: ${summary.error}`);

  if (summary.fixable > 0 && !autoFix) {
    console.log(`\n🔧 ${summary.fixable} problemas podem ser corrigidos automaticamente`);
    console.log("Execute: npx tsx scripts/validate-data.ts --fix");
  }

  // Verificar se há erros críticos (excluindo tabelas opcionais)
  const criticalErrors = results.filter(
    r => r.status === "ERROR" && !optionalTables.includes(r.test)
  );

  if (criticalErrors.length > 0) {
    console.log("\n⚠️  AÇÃO NECESSÁRIA: Há erros críticos que requerem atenção!");
    console.log("Erros críticos:");
    criticalErrors.forEach(err => console.log(`  - ${err.category}/${err.test}: ${err.message}`));
    process.exit(1);
  } else if (summary.warning > 0) {
    console.log("\n⚠️  Há avisos (não críticos).");
    process.exit(0);
  } else {
    console.log("\n✅ Todos os testes passaram! Sistema íntegro.");
    process.exit(0);
  }
}

// Executar validação
const autoFix = process.argv.includes("--fix");
validateDatabase(autoFix).catch(console.error);
