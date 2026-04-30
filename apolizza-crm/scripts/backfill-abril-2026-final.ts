/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * BACKFILL FINAL — abril/2026 (escopo cirúrgico)
 *
 * Decisões:
 *   1. GARANTIA CONFIANÇA SERVIÇOS = real → manter
 *   2. 11 extras com clickup_id = listar para revisão com diretora amanhã (não touch status)
 *   3. Aplicar agora
 *
 * Etapas (transação única):
 *   A. Soft-delete 3 testes (William Teste, Vanessa, teste)
 *   B. Updates da planilha em 99 cotações ABR/2026 (109 campos: status, priority, contato_cliente)
 *   C. Set atrasado_desde = due_date GLOBAL para todas as 478 com status='atrasado'
 *      (mantém leitores SQL consistentes após reescrita para flag)
 *   D. Gerar CSV de revisão dos 11 extras
 *
 * Modos:
 *   --dry-run (default): só loga
 *   --apply: aplica em transação
 */

import dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import * as fs from "fs";
import mysql from "mysql2/promise";

const APPLY = process.argv.includes("--apply");
const TS = new Date().toISOString().slice(0, 10);

// Nomes EXATOS dos 3 testes a soft-deletar (sem clickup_id)
const TESTES_PARA_DELETAR = ["William Teste", "Vanessa", "teste"];

function parseCsv(text: string): Record<string, string>[] {
  // Parser que respeita aspas duplas mesmo com quebras de linha dentro.
  const records: string[][] = [];
  let cur = "", row: string[] = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (cur !== "" || row.length > 0) {
          row.push(cur);
          records.push(row);
          row = []; cur = "";
        }
        if (ch === "\r" && text[i + 1] === "\n") i++;
      } else cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) { row.push(cur); records.push(row); }
  if (records.length === 0) return [];
  const headers = records[0];
  return records.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = cells[i] ?? ""; });
    return o;
  });
}

function csvEscape(v: any): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function isoDate(v: any): string | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

const FIELD_TYPE: Record<string, "str" | "num" | "int" | "date"> = {
  status: "str", priority: "str", contato_cliente: "str", name: "str",
  observacao: "str", indicacao: "str", produto: "str", seguradora: "str",
  situacao: "str", tipo_cliente: "str", comissao: "str", mes_referencia: "str",
  due_date: "date", proxima_tratativa: "date", inicio_vigencia: "date",
  fim_vigencia: "date", primeiro_pagamento: "date",
  a_receber: "num", premio_sem_iof: "num", valor_perda: "num",
  parcelado_em: "int", ano_referencia: "int",
};

(async () => {
  console.log(`MODO: ${APPLY ? "APPLY (transação)" : "DRY-RUN"}\n`);

  // 1. Carregar planilha divergencias (89 status + 19 priority + 1 contato + 70 name informativo)
  const planDiv = parseCsv(fs.readFileSync("data/audit-abril-2026-planilha-2026-04-30-divergencias.csv", "utf-8"));
  const planUpdates = new Map<string, Record<string, any>>();
  for (const d of planDiv) {
    if (d.informativo === "sim") continue;
    if (!planUpdates.has(d.clickup_id)) planUpdates.set(d.clickup_id, {});
    const valor = d.planilha === "" ? null : d.planilha;
    planUpdates.get(d.clickup_id)![d.campo] = valor;
  }
  console.log(`B) Updates planilha ABR/2026: ${planUpdates.size} cotações`);

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não setado");
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, decimalNumbers: true });

  // 2. Buscar dados atuais ABR/2026 e atrasados gerais
  const ids = Array.from(planUpdates.keys());
  const [planRowsRaw] = await conn.query(
    `SELECT id, clickup_id, name, status, priority, contato_cliente, due_date, atrasado_desde
     FROM cotacoes WHERE clickup_id IN (${ids.map(() => "?").join(",")})
       AND mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL`,
    ids,
  );
  const dbByCid = new Map((planRowsRaw as any[]).map((r) => [r.clickup_id, r]));

  // 3. Buscar 3 testes a soft-deletar
  const [testesRaw] = await conn.query(
    `SELECT id, name, a_receber FROM cotacoes
     WHERE mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL
       AND (clickup_id IS NULL OR clickup_id='')
       AND name IN (${TESTES_PARA_DELETAR.map(() => "?").join(",")})`,
    TESTES_PARA_DELETAR,
  );
  const testes = testesRaw as any[];
  console.log(`A) Soft-delete: ${testes.length} testes`);
  testes.forEach((t) => console.log(`   - ${t.name} (R$ ${t.a_receber || 0})`));

  // 4. Buscar TODAS atrasadas para set atrasado_desde global
  const [atrasadasRaw] = await conn.query(
    `SELECT id, clickup_id, name, due_date FROM cotacoes
     WHERE status='atrasado' AND deleted_at IS NULL AND atrasado_desde IS NULL AND due_date IS NOT NULL`,
  );
  const atrasadas = atrasadasRaw as any[];
  console.log(`C) Set atrasado_desde global: ${atrasadas.length} cotações`);

  // 5. Listar 11 extras com clickup_id para revisão
  const planExtrasRaw = fs.readFileSync("data/audit-abril-2026-planilha-2026-04-30-extras-no-banco.csv", "utf-8");
  const extrasIds = planExtrasRaw.split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0]).filter(Boolean);
  const [extrasRaw] = await conn.query(
    `SELECT clickup_id, name, status, produto, tipo_cliente, due_date, a_receber, valor_perda
     FROM cotacoes WHERE mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL
       AND clickup_id IN (${extrasIds.map(() => "?").join(",")})`,
    extrasIds,
  );
  const extras = extrasRaw as any[];

  console.log(`\n→ Sumário do plano:`);
  console.log(`   A) ${testes.length} soft-deletes`);
  console.log(`   B) ${planUpdates.size} cotações ABR/2026 com updates da planilha`);
  console.log(`   C) ${atrasadas.length} atrasados com set atrasado_desde`);
  console.log(`   D) ${extras.length} extras para CSV de revisão`);

  if (!APPLY) {
    console.log("\n[DRY-RUN] Re-execute com --apply\n");
    await conn.end();
    process.exit(0);
  }

  // ====== APPLY: TRANSAÇÃO ÚNICA ======
  console.log("\n→ Iniciando transação...");
  await conn.beginTransaction();
  try {
    let updates = 0, deletes = 0, historyRows = 0;

    // A) Soft-delete testes
    for (const t of testes) {
      await conn.query(`UPDATE cotacoes SET deleted_at = NOW() WHERE id = ?`, [t.id]);
      await conn.query(
        `INSERT INTO cotacao_history (id, cotacao_id, user_id, field_name, old_value, new_value)
         VALUES (UUID(), ?, NULL, 'deleted_at', NULL, ?)`,
        [t.id, new Date().toISOString().slice(0, 19).replace("T", " ")],
      );
      deletes++; historyRows++;
    }

    // B) Updates planilha
    for (const [cid, sets] of planUpdates) {
      const dbRow = dbByCid.get(cid);
      if (!dbRow) continue;

      const cols = Object.keys(sets);
      const setSql = cols.map((c) => `${c} = ?`).join(", ");
      const values = cols.map((c) => sets[c]);
      await conn.query(`UPDATE cotacoes SET ${setSql}, updated_at = NOW() WHERE id = ?`, [...values, dbRow.id]);
      updates++;

      for (const c of cols) {
        const oldV = dbRow[c];
        const newV = sets[c];
        await conn.query(
          `INSERT INTO cotacao_history (id, cotacao_id, user_id, field_name, old_value, new_value)
           VALUES (UUID(), ?, NULL, ?, ?, ?)`,
          [
            dbRow.id, c,
            oldV instanceof Date ? isoDate(oldV) : (oldV == null ? null : String(oldV)),
            newV == null ? null : String(newV),
          ],
        );
        historyRows++;
      }
    }

    // C) Set atrasado_desde global (todas com status='atrasado' e flag NULL)
    let atrSet = 0;
    for (const a of atrasadas) {
      const due = isoDate(a.due_date);
      if (!due) continue;
      await conn.query(
        `UPDATE cotacoes SET atrasado_desde = ?, updated_at = NOW() WHERE id = ?`,
        [due, a.id],
      );
      await conn.query(
        `INSERT INTO cotacao_history (id, cotacao_id, user_id, field_name, old_value, new_value)
         VALUES (UUID(), ?, NULL, 'atrasado_desde', NULL, ?)`,
        [a.id, due],
      );
      atrSet++; historyRows++;
    }

    // D) CSV de revisão dos 11 extras
    const headers = ["clickup_id", "nome", "status_atual", "tipo_cliente", "produto", "due_date", "a_receber", "valor_perda", "link_clickup", "decisao_diretora"];
    const rows = extras.map((e) => [
      e.clickup_id,
      e.name,
      e.status,
      e.tipo_cliente,
      e.produto,
      isoDate(e.due_date),
      e.a_receber || 0,
      e.valor_perda || 0,
      `https://app.clickup.com/t/${e.clickup_id}`,
      "",
    ]);
    const csvOut = `data/extras-abr2026-revisar-${TS}.csv`;
    fs.writeFileSync(csvOut, [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n"));

    await conn.commit();
    console.log(`\n✅ COMMIT OK`);
    console.log(`   Soft-deletes: ${deletes}`);
    console.log(`   Updates: ${updates} cotações`);
    console.log(`   atrasado_desde set: ${atrSet}`);
    console.log(`   History rows: ${historyRows}`);
    console.log(`   CSV revisão: ${csvOut}`);

    // Validação pós-commit
    const [[totals]] = await conn.query(`
      SELECT
        COUNT(*) AS n,
        ROUND(SUM(a_receber),2) AS receber,
        ROUND(SUM(valor_perda),2) AS perda
      FROM cotacoes
      WHERE mes_referencia='ABR' AND ano_referencia=2026 AND deleted_at IS NULL
    `) as any;

    const [[flagCount]] = await conn.query(`
      SELECT COUNT(*) AS n FROM cotacoes WHERE atrasado_desde IS NOT NULL AND deleted_at IS NULL
    `) as any;

    console.log(`\n========== VALIDAÇÃO PÓS-COMMIT ==========`);
    console.log(`ABR/2026 ativos: ${totals.n}`);
    console.log(`A Receber: R$ ${totals.receber} (esperado R$ 68.343,16 + GARANTIA CONFIANÇA R$ 127,50 = R$ 68.470,66)`);
    console.log(`Em Perda:  R$ ${totals.perda} (esperado R$ 65.966,71)`);
    console.log(`Flag atrasado_desde set: ${flagCount.n} cotações no banco`);
    console.log(`==========================================`);

  } catch (err) {
    console.error("❌ ERRO — ROLLBACK:", err);
    await conn.rollback();
    throw err;
  }

  await conn.end();
  process.exit(0);
})().catch((e) => { console.error("FATAL:", e); process.exit(1); });
