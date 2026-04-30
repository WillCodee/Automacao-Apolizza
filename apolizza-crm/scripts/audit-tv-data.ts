import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import mysql from "mysql2/promise";

async function main() {
  const pool = mysql.createPool({ uri: process.env.DATABASE_URL! });
  const ano = 2026;
  const mes = "ABR";
  const mesFull = "ABRIL";

  console.log("=== AUDITORIA DADOS PAINEL TV — ABR/2026 ===\n");

  // 1. KPIs — query direta na tabela cotacoes
  const [kpiDirect] = await pool.execute(`
    SELECT
      COUNT(*) as totalCotacoes,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) as fechadas,
      SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN 1 ELSE 0 END) as perdas,
      SUM(CASE WHEN LOWER(situacao) NOT IN ('fechado','perda','perda/resgate') OR situacao IS NULL THEN 1 ELSE 0 END) as emAndamento,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) as totalAReceber,
      COALESCE(SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN CAST(valor_perda AS DECIMAL(12,2)) ELSE 0 END), 0) as totalValorPerda,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(premio_sem_iof AS DECIMAL(12,2)) ELSE 0 END), 0) as totalPremio,
      SUM(CASE WHEN UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1 THEN 1 ELSE 0 END) as totalRenovacoes,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END) as fechadasRenovacao,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) as aReceberRenovacao,
      SUM(CASE WHEN NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END) as totalNovas,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN 1 ELSE 0 END) as fechadasNovas,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' AND NOT (UPPER(tipo_cliente) = 'RENOVAÇÃO' OR is_renovacao = 1) THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) as aReceberNovas
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia = ${ano}
      AND (UPPER(mes_referencia) = '${mesFull}' OR UPPER(mes_referencia) = '${mes}')
  `);

  // KPIs via view
  const [kpiView] = await pool.execute(`
    SELECT
      COALESCE(SUM(total_cotacoes), 0) as totalCotacoes,
      COALESCE(SUM(fechadas), 0) as fechadas,
      COALESCE(SUM(perdas), 0) as perdas,
      COALESCE(SUM(em_andamento), 0) as emAndamento,
      COALESCE(SUM(total_a_receber), 0) as totalAReceber,
      COALESCE(SUM(total_valor_perda), 0) as totalValorPerda,
      COALESCE(SUM(total_premio), 0) as totalPremio,
      COALESCE(SUM(total_renovacoes), 0) as totalRenovacoes,
      COALESCE(SUM(fechadas_renovacao), 0) as fechadasRenovacao,
      COALESCE(SUM(a_receber_renovacao), 0) as aReceberRenovacao,
      COALESCE(SUM(total_novas), 0) as totalNovas,
      COALESCE(SUM(fechadas_novas), 0) as fechadasNovas,
      COALESCE(SUM(a_receber_novas), 0) as aReceberNovas
    FROM vw_kpis
    WHERE ano = ${ano} AND mes = '${mes}'
  `);

  const d = (kpiDirect as Record<string, unknown>[])[0];
  const v = (kpiView as Record<string, unknown>[])[0];

  console.log("--- KPIs: TABELA DIRETA vs VIEW ---");
  console.log(String("Campo").padEnd(22), String("Direto").padStart(12), String("View").padStart(12), String("Match?").padStart(8));
  const fields = ["totalCotacoes","fechadas","perdas","emAndamento","totalAReceber","totalValorPerda","totalPremio","totalRenovacoes","fechadasRenovacao","aReceberRenovacao","totalNovas","fechadasNovas","aReceberNovas"];
  for (const f of fields) {
    const dv = Number(d[f] ?? 0);
    const vv = Number(v[f] ?? 0);
    const match = Math.abs(dv - vv) < 0.01;
    console.log(f.padEnd(22), String(dv).padStart(12), String(vv).padStart(12), (match ? "OK" : "DIFF!").padStart(8));
  }

  // 2. Cotadores — verificar top cotadores
  console.log("\n--- COTADORES: Dados diretos ---");
  const [cotadores] = await pool.execute(`
    SELECT
      u.name,
      COUNT(c.id) as total,
      SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN 1 ELSE 0 END) as fechadas,
      COALESCE(SUM(CASE WHEN LOWER(c.situacao) = 'fechado' THEN CAST(c.a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) as faturamento
    FROM users u
    LEFT JOIN cotacoes c ON c.assignee_id = u.id
      AND c.deleted_at IS NULL
      AND c.ano_referencia = ${ano}
      AND (UPPER(c.mes_referencia) = '${mesFull}' OR UPPER(c.mes_referencia) = '${mes}')
    WHERE u.is_active = 1 AND u.role = 'cotador'
    GROUP BY u.id, u.name
    ORDER BY faturamento DESC
  `);
  for (const c of cotadores as Record<string, unknown>[]) {
    console.log(`  ${String(c.name).padEnd(25)} Total: ${String(c.total).padStart(4)}  Fechadas: ${String(c.fechadas).padStart(4)}  Fat: R$${Number(c.faturamento).toFixed(2)}`);
  }

  // 3. Meta mensal
  console.log("\n--- META MENSAL ---");
  const [metaRows] = await pool.execute(
    `SELECT meta_valor FROM metas WHERE ano = ? AND mes = ? AND user_id IS NULL LIMIT 1`,
    [ano, 4]
  );
  const meta = (metaRows as Record<string, unknown>[])[0];
  console.log(`  Meta ABR/2026: R$ ${meta ? meta.meta_valor : "NÃO DEFINIDA"}`);

  // 4. Semanas
  console.log("\n--- SEMANAS (progresso semanal) ---");
  const [semanas] = await pool.execute(`
    SELECT
      CASE
        WHEN DAY(created_at) <= 7  THEN 1
        WHEN DAY(created_at) <= 14 THEN 2
        WHEN DAY(created_at) <= 21 THEN 3
        ELSE 4
      END AS semana,
      COUNT(*) AS novas,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) AS fechadas,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) AS ganho
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND (UPPER(mes_referencia) = '${mesFull}' OR UPPER(mes_referencia) = '${mes}')
      AND ano_referencia = ${ano}
    GROUP BY 1
    ORDER BY 1
  `);
  let acum = 0;
  for (const s of semanas as Record<string, unknown>[]) {
    const g = Number(s.ganho);
    acum += g;
    console.log(`  Semana ${s.semana}: ${String(s.novas).padStart(3)} novas, ${String(s.fechadas).padStart(3)} fechadas, Ganho: R$${g.toFixed(2)}, Acum: R$${acum.toFixed(2)}`);
  }

  // 5. Monthly trend
  console.log("\n--- TENDENCIA MENSAL 2026 ---");
  const [monthly] = await pool.execute(`
    SELECT
      CASE UPPER(mes_referencia)
        WHEN 'JANEIRO' THEN 'JAN' WHEN 'FEVEREIRO' THEN 'FEV' WHEN 'MARÇO' THEN 'MAR' WHEN 'MARCO' THEN 'MAR'
        WHEN 'ABRIL' THEN 'ABR' WHEN 'MAIO' THEN 'MAI' WHEN 'JUNHO' THEN 'JUN'
        WHEN 'JULHO' THEN 'JUL' WHEN 'AGOSTO' THEN 'AGO' WHEN 'SETEMBRO' THEN 'SET'
        WHEN 'OUTUBRO' THEN 'OUT' WHEN 'NOVEMBRO' THEN 'NOV' WHEN 'DEZEMBRO' THEN 'DEZ'
        ELSE UPPER(mes_referencia)
      END AS mes,
      COUNT(*) as total,
      SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN 1 ELSE 0 END) as fechadas,
      SUM(CASE WHEN LOWER(situacao) IN ('perda','perda/resgate') OR status = 'perda' THEN 1 ELSE 0 END) as perdas,
      COALESCE(SUM(CASE WHEN LOWER(situacao) = 'fechado' THEN CAST(a_receber AS DECIMAL(12,2)) ELSE 0 END), 0) as aReceber
    FROM cotacoes
    WHERE deleted_at IS NULL AND ano_referencia = ${ano}
    GROUP BY mes
    ORDER BY FIELD(mes, 'JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ')
  `);
  for (const m of monthly as Record<string, unknown>[]) {
    console.log(`  ${String(m.mes).padEnd(4)} Total: ${String(m.total).padStart(4)}  Fechadas: ${String(m.fechadas).padStart(4)}  Perdas: ${String(m.perdas).padStart(4)}  Fat: R$${Number(m.aReceber).toFixed(2)}`);
  }

  // 6. API TV response
  console.log("\n--- API TV RESPONSE (via fetch local) ---");
  try {
    const res = await fetch(`http://localhost:3000/api/tv?token=${process.env.TV_TOKEN}`);
    if (res.ok) {
      const json = await res.json();
      const k = json.data.kpis;
      console.log("  API KPIs:", JSON.stringify(k));
    } else {
      console.log("  API não disponível localmente (server não rodando)");
    }
  } catch {
    console.log("  Server local não está rodando — comparação será com dados da Vercel");
  }

  // 7. Status breakdown
  console.log("\n--- STATUS BREAKDOWN ---");
  const [statusRows] = await pool.execute(`
    SELECT
      COALESCE(status, 'sem_status') as status,
      COUNT(*) as count,
      CASE
        WHEN status = 'perda' THEN COALESCE(SUM(CAST(valor_perda AS DECIMAL(12,2))), 0)
        ELSE COALESCE(SUM(CAST(a_receber AS DECIMAL(12,2))), 0)
      END as total
    FROM cotacoes
    WHERE deleted_at IS NULL
      AND ano_referencia = ${ano}
      AND (UPPER(mes_referencia) = '${mesFull}' OR UPPER(mes_referencia) = '${mes}')
    GROUP BY status
    ORDER BY count DESC
  `);
  for (const s of statusRows as Record<string, unknown>[]) {
    console.log(`  ${String(s.status).padEnd(20)} Count: ${String(s.count).padStart(4)}  Total: R$${Number(s.total).toFixed(2)}`);
  }

  console.log("\n=== AUDITORIA COMPLETA ===");
  await pool.end();
}

main().catch(console.error);
