/**
 * INFERIR ANO PARA COTAÇÕES SEM ANO
 * Atualiza as 2716 cotações que não têm ano_referencia
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, isNull, sql as drizzleSql } from "drizzle-orm";
import * as schema from "../src/lib/schema";

const sqlConn = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlConn, { schema, casing: 'snake_case' });

function inferYearFromDates(row: any): { year: number | null; source: string } {
  // Ordem de prioridade das datas
  const dateSources = [
    { date: row.inicioVigencia, name: "início vigência" },
    { date: row.fimVigencia, name: "fim vigência" },
    { date: row.primeiroPagamento, name: "primeiro pagamento" },
    { date: row.proximaTratativa, name: "próxima tratativa" },
    { date: row.dueDate, name: "due date" },
    { date: row.createdAt, name: "data criação" },
  ];

  for (const { date, name } of dateSources) {
    if (date) {
      // Drizzle já retorna Date objects, não precisa converter
      const dateObj = date instanceof Date ? date : new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return { year: dateObj.getFullYear(), source: name };
      }
    }
  }

  return { year: null, source: "nenhuma data disponível" };
}

async function main() {
  console.log("═".repeat(80));
  console.log("  INFERIR ANO PARA COTAÇÕES SEM ANO");
  console.log("═".repeat(80));

  // 1. Buscar cotações sem ano
  console.log("\n📋 Buscando cotações sem ano...");

  const cotacoesSemAno = await db
    .select()
    .from(schema.cotacoes)
    .where(drizzleSql`ano_referencia IS NULL AND deleted_at IS NULL`);

  console.log(`   ✓ Encontradas: ${cotacoesSemAno.length} cotações sem ano`);

  if (cotacoesSemAno.length === 0) {
    console.log("\n✅ Nenhuma cotação sem ano encontrada!");
    return;
  }

  // 2. Processar e inferir anos
  console.log("\n🔄 Inferindo anos a partir das datas disponíveis...");

  let updated = 0;
  let noDateAvailable = 0;
  const inferenceLog: Array<{ id: string; name: string; year: number; source: string }> = [];
  const sourceCounts = new Map<string, number>();

  for (let i = 0; i < cotacoesSemAno.length; i++) {
    const cotacao = cotacoesSemAno[i];
    const progress = `[${i + 1}/${cotacoesSemAno.length}]`;

    const inference = inferYearFromDates(cotacao);

    if (inference.year) {
      // Atualizar no banco
      await db
        .update(schema.cotacoes)
        .set({ anoReferencia: inference.year })
        .where(eq(schema.cotacoes.id, cotacao.id));

      updated++;
      sourceCounts.set(inference.source, (sourceCounts.get(inference.source) || 0) + 1);

      inferenceLog.push({
        id: cotacao.clickupId || cotacao.id,
        name: cotacao.name,
        year: inference.year,
        source: inference.source
      });

      if (updated % 100 === 0) {
        console.log(`    ${progress} Processadas ${updated} cotações...`);
      }
    } else {
      noDateAvailable++;
    }
  }

  console.log(`    ✓ Processamento concluído`);

  // 3. Relatório final
  console.log("\n" + "═".repeat(80));
  console.log("  RELATÓRIO FINAL");
  console.log("═".repeat(80));
  console.log(`  Total processado:         ${cotacoesSemAno.length}`);
  console.log(`  ✓ Anos inferidos:         ${updated}`);
  console.log(`  ⚠️  Sem datas disponíveis: ${noDateAvailable}`);
  console.log("═".repeat(80));

  // 4. Fontes usadas
  if (sourceCounts.size > 0) {
    console.log(`\n📊 Fontes usadas para inferir o ano:`);
    Array.from(sourceCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([source, count]) => {
        console.log(`   • ${source}: ${count} cotações`);
      });
  }

  // 5. Verificar estado final
  console.log("\n📅 Verificando estado final...");

  const finalComAno = await sqlConn`
    SELECT COUNT(*) as total
    FROM cotacoes
    WHERE ano_referencia IS NOT NULL
      AND deleted_at IS NULL;
  `;

  const finalSemAno = await sqlConn`
    SELECT COUNT(*) as total
    FROM cotacoes
    WHERE ano_referencia IS NULL
      AND deleted_at IS NULL;
  `;

  const totalCotacoes = await sqlConn`
    SELECT COUNT(*) as total
    FROM cotacoes
    WHERE deleted_at IS NULL;
  `;

  console.log(`   • Total de cotações:     ${totalCotacoes[0].total}`);
  console.log(`   • COM ano:               ${finalComAno[0].total} (${Math.round(finalComAno[0].total / totalCotacoes[0].total * 100)}%)`);
  console.log(`   • SEM ano:               ${finalSemAno[0].total} (${Math.round(finalSemAno[0].total / totalCotacoes[0].total * 100)}%)`);

  // 6. Distribuição por ano
  const porAno = await sqlConn`
    SELECT
      ano_referencia,
      COUNT(*) as total
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia IS NOT NULL
    GROUP BY ano_referencia
    ORDER BY ano_referencia;
  `;

  console.log(`\n   Distribuição por ano:`);
  porAno.forEach((row: any) => {
    console.log(`     • ${row.ano_referencia}: ${row.total} cotações`);
  });

  // 7. Salvar log de inferências (amostra)
  if (inferenceLog.length > 0) {
    const { writeFileSync } = await import("fs");
    const logSample = inferenceLog.slice(0, 100); // Primeiras 100 para não gerar arquivo gigante
    const logContent = logSample.map(l => `"${l.id}","${l.name.substring(0, 100)}","${l.source}",${l.year}`).join("\n");
    writeFileSync("/home/gustavo/Automacao-Apolizza/apolizza-crm/dados/anos-inferidos-bulk.csv",
      `ClickUp ID,Nome,Fonte do Ano,Ano Inferido\n${logContent}`, "utf-8");
    console.log(`\n   📄 Amostra do log salva em: dados/anos-inferidos-bulk.csv (primeiras 100)`);
  }

  console.log("\n🎉 Inferência de anos concluída!\n");
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});
