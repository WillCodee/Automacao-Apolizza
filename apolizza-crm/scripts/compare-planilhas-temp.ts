import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as XLSX from "xlsx";
import mysql from "mysql2/promise";

const path1 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/BENEFICIOS SAUDE VIDA DENTAL E GARANTIAS DE ABRIL.xlsx";
const path2 = "C:/nuvem_apolizza/POS_VENDA/FUNCIONÁRIOS/ESTÁGIARIO - WILLIAM/Pasta William/Automacao-Apolizza/apolizza-crm/dados/RAMOS ELEMENTAR AUTO, RC, VIAGEM, EMPRESARIAL, CONDOMINIO, ETC DE ABRIL.xlsx";

function parseXlsx(p: string, grupo: string) {
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets["Tasks"];
  const all = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
  return all.slice(2).filter(r => r["__EMPTY"] === "Task").map(r => ({
    taskId:      String(r["__EMPTY_1"] || ""),
    nome:        String(r["__EMPTY_2"] || ""),
    status:      String(r["__EMPTY_3"] || ""),
    assignee:    String(r["__EMPTY_5"] || ""),
    situacao:    String(r["__EMPTY_49"] || ""),
    mes:         String(r["__EMPTY_42"] || ""),
    ano:         String(r["__EMPTY_35"] || ""),
    aReceber:    parseFloat(String(r["__EMPTY_34"])) || 0,
    produto:     String(r["__EMPTY_47"] || ""),
    seguradora:  String(r["__EMPTY_48"] || ""),
    tipoCliente: String(r["__EMPTY_50"] || ""),
    valorPerda:  parseFloat(String(r["__EMPTY_51"])) || 0,
    premioSemIof:parseFloat(String(r["__EMPTY_45"])) || 0,
    grupo,
  }));
}

const fmt = (v: number) => "R$ " + Number(v||0).toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 });
const pad = (s: string, n: number) => s.substring(0, n).padEnd(n);

async function main() {
  const rows1 = parseXlsx(path1, "BENEFICIOS");
  const rows2 = parseXlsx(path2, "RAMOS ELEMENTAR");
  const planilha = [...rows1, ...rows2];

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL! });

  const [dbCots] = await conn.execute(`
    SELECT u.name as cotador, c.name as nome_cliente, c.situacao, c.status,
      c.produto, c.seguradora, c.tipo_cliente,
      CAST(c.a_receber AS DECIMAL(12,2)) as a_receber,
      CAST(c.valor_perda AS DECIMAL(12,2)) as valor_perda,
      CAST(c.premio_sem_iof AS DECIMAL(12,2)) as premio_sem_iof,
      c.mes_referencia, c.ano_referencia, c.clickup_id
    FROM cotacoes c
    LEFT JOIN users u ON u.id = c.assignee_id
    WHERE c.deleted_at IS NULL
      AND (UPPER(c.mes_referencia) = 'ABR' OR UPPER(c.mes_referencia) = 'ABRIL')
      AND c.ano_referencia = 2026
    ORDER BY u.name, c.name
  `) as [Record<string, unknown>[], unknown];

  const db = dbCots as Record<string, unknown>[];

  console.log("\n============================================================");
  console.log("TOTAIS GERAIS ABR/2026");
  console.log("============================================================");
  console.log("  Planilhas (ClickUp):", planilha.length);
  console.log("  Banco (CRM):        ", db.length);
  console.log("  Diferença:          ", planilha.length - db.length);

  // Banco por cotador
  const dbByCotador: Record<string, { total:number; fechadas:number; perdas:number; aReceber:number; premio:number }> = {};
  db.forEach(c => {
    const k = String(c.cotador || "SEM ASSIGNEE");
    if (!dbByCotador[k]) dbByCotador[k] = { total:0, fechadas:0, perdas:0, aReceber:0, premio:0 };
    dbByCotador[k].total++;
    const sit = String(c.situacao||"").toLowerCase();
    const stat = String(c.status||"").toLowerCase();
    if (sit==="fechado"||stat==="fechado") dbByCotador[k].fechadas++;
    if (sit==="perda"||sit==="perda/resgate"||stat==="perda") dbByCotador[k].perdas++;
    dbByCotador[k].aReceber += parseFloat(String(c.a_receber))||0;
    dbByCotador[k].premio   += parseFloat(String(c.premio_sem_iof))||0;
  });

  // Planilha por grupo
  const plByGrupo: Record<string, { total:number; fechadas:number; perdas:number; aReceber:number; premio:number }> = {};
  planilha.forEach(r => {
    const k = r.grupo;
    if (!plByGrupo[k]) plByGrupo[k] = { total:0, fechadas:0, perdas:0, aReceber:0, premio:0 };
    plByGrupo[k].total++;
    const sit = r.situacao.toLowerCase();
    if (sit==="fechado"||sit==="implantação") plByGrupo[k].fechadas++;
    if (sit==="perda"||sit==="perda/resgate") plByGrupo[k].perdas++;
    plByGrupo[k].aReceber += r.aReceber;
    plByGrupo[k].premio   += r.premioSemIof;
  });

  console.log("\n============================================================");
  console.log("BANCO — POR COTADOR (ABR/2026)");
  console.log("============================================================");
  Object.entries(dbByCotador).sort((a,b) => b[1].total - a[1].total).forEach(([c,d]) =>
    console.log(`  ${pad(c,22)} | total=${String(d.total).padStart(3)} | fechadas=${String(d.fechadas).padStart(3)} | perdas=${String(d.perdas).padStart(3)} | aReceber=${fmt(d.aReceber).padStart(14)} | premio=${fmt(d.premio).padStart(14)}`)
  );

  console.log("\n============================================================");
  console.log("PLANILHA — POR GRUPO");
  console.log("============================================================");
  Object.entries(plByGrupo).forEach(([g,d]) =>
    console.log(`  ${pad(g,22)} | total=${String(d.total).padStart(3)} | fechadas=${String(d.fechadas).padStart(3)} | perdas=${String(d.perdas).padStart(3)} | aReceber=${fmt(d.aReceber).padStart(14)} | premio=${fmt(d.premio).padStart(14)}`)
  );

  // Comparação por Task ID
  const dbIds = new Set(db.map(c => c.clickup_id).filter(Boolean));
  const plIds = new Set(planilha.map(r => r.taskId).filter(Boolean));
  const soPlanilha = planilha.filter(r => r.taskId && !dbIds.has(r.taskId));
  const soBanco    = db.filter(c => c.clickup_id && !plIds.has(c.clickup_id));
  const emAmbos    = planilha.filter(r => r.taskId && dbIds.has(r.taskId));

  console.log("\n============================================================");
  console.log("COMPARAÇÃO POR TASK ID");
  console.log("============================================================");
  console.log("  Presentes em AMBOS:              ", emAmbos.length);
  console.log("  SÓ na PLANILHA (faltam no banco):", soPlanilha.length);
  console.log("  SÓ no BANCO (não estão na plan.):", soBanco.length);

  if (soPlanilha.length > 0) {
    console.log(`\n  FALTAM NO BANCO (${soPlanilha.length}):`);
    soPlanilha.forEach(r =>
      console.log(`    [${r.grupo.substring(0,10)}] ${pad(r.nome,45)} | ${pad(r.situacao,16)} | ${fmt(r.aReceber).padStart(12)} | ${r.produto}`)
    );
  }

  // Divergências de situação
  const dbMap: Record<string, Record<string, unknown>> = {};
  db.forEach(c => { if (c.clickup_id) dbMap[String(c.clickup_id)] = c; });

  const divSit = emAmbos.filter(r => {
    const d = dbMap[r.taskId];
    if (!d) return false;
    return r.situacao.toLowerCase().trim() !== String(d.situacao||"").toLowerCase().trim();
  });

  console.log(`\n============================================================`);
  console.log(`DIVERGÊNCIAS DE SITUAÇÃO (${divSit.length})`);
  console.log(`============================================================`);
  if (divSit.length > 0) {
    divSit.forEach(r => {
      const d = dbMap[r.taskId];
      console.log(`  ${pad(r.nome,44)} | PLAN: ${pad(r.situacao,20)} | BANCO: ${String(d.situacao||"")}`)
    });
  } else {
    console.log("  Nenhuma divergência.");
  }

  // Divergências de A Receber
  const divAR = emAmbos.filter(r => {
    const d = dbMap[r.taskId];
    if (!d) return false;
    return Math.abs(r.aReceber - (parseFloat(String(d.a_receber))||0)) > 0.01;
  });

  console.log(`\n============================================================`);
  console.log(`DIVERGÊNCIAS DE A RECEBER (${divAR.length})`);
  console.log(`============================================================`);
  if (divAR.length > 0) {
    divAR.forEach(r => {
      const d = dbMap[r.taskId];
      const dbVal = parseFloat(String(d.a_receber))||0;
      console.log(`  ${pad(r.nome,44)} | PLAN: ${fmt(r.aReceber).padStart(12)} | BANCO: ${fmt(dbVal).padStart(12)}`);
    });
  } else {
    console.log("  Nenhuma divergência.");
  }

  await conn.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
