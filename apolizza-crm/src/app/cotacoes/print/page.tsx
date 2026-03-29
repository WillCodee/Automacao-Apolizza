import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { sql, eq, and, isNull, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { cotacoes, users } from "@/lib/schema";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function PrintCotacoesPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const { search, status, mes, assignee, produto, seguradora, prioridade, isRenovacao, dateFrom, dateTo } = params;

  // Build query
  const conditions = [isNull(cotacoes.deletedAt)];

  if (session.user.role === "cotador") {
    conditions.push(eq(cotacoes.assigneeId, session.user.id));
  }
  if (status) conditions.push(eq(cotacoes.status, status));
  if (mes) conditions.push(eq(cotacoes.mesReferencia, mes));
  if (assignee) conditions.push(eq(cotacoes.assigneeId, assignee));
  if (produto) conditions.push(eq(cotacoes.produto, produto));
  if (seguradora) conditions.push(eq(cotacoes.seguradora, seguradora));
  if (prioridade) conditions.push(eq(cotacoes.priority, prioridade));
  if (isRenovacao === "true") conditions.push(eq(cotacoes.isRenovacao, true));
  if (dateFrom) conditions.push(gte(cotacoes.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(cotacoes.createdAt, new Date(dateTo + "T23:59:59")));
  if (search) {
    conditions.push(
      sql`(${cotacoes.name} ILIKE ${"%" + search + "%"} OR ${cotacoes.seguradora} ILIKE ${"%" + search + "%"})`
    );
  }

  const rows = await db
    .select({
      name: cotacoes.name,
      status: cotacoes.status,
      produto: cotacoes.produto,
      seguradora: cotacoes.seguradora,
      aReceber: cotacoes.aReceber,
      valorPerda: cotacoes.valorPerda,
      mesReferencia: cotacoes.mesReferencia,
      anoReferencia: cotacoes.anoReferencia,
      cotador: users.name,
    })
    .from(cotacoes)
    .leftJoin(users, eq(cotacoes.assigneeId, users.id))
    .where(and(...conditions))
    .orderBy(cotacoes.createdAt)
    .limit(500);

  const totalAReceber = rows.reduce((sum, r) => sum + (Number(r.aReceber) || 0), 0);
  const totalPerda = rows.reduce((sum, r) => sum + (Number(r.valorPerda) || 0), 0);
  const fechadas = rows.filter((r) => r.status === "fechado").length;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const activeFilters: string[] = [];
  if (status) activeFilters.push(`Status: ${status}`);
  if (mes) activeFilters.push(`Mes: ${mes}`);
  if (produto) activeFilters.push(`Produto: ${produto}`);
  if (seguradora) activeFilters.push(`Seguradora: ${seguradora}`);
  if (search) activeFilters.push(`Busca: "${search}"`);
  if (dateFrom || dateTo) activeFilters.push(`Periodo: ${dateFrom || "..."} a ${dateTo || "..."}`);

  return (
    <html>
      <head>
        <title>Apolizza — Relatorio de Cotacoes</title>
        <style dangerouslySetInnerHTML={{ __html: `
          @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Poppins', sans-serif; color: #1e293b; font-size: 11px; }
          .header { background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 20px 30px; display: flex; align-items: center; justify-content: space-between; }
          .header h1 { font-size: 18px; font-weight: 700; }
          .header .meta { font-size: 10px; opacity: 0.7; text-align: right; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 20px 30px; }
          .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .kpi .label { font-size: 10px; color: #64748b; font-weight: 500; }
          .kpi .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
          .filters { padding: 0 30px 12px; font-size: 10px; color: #64748b; }
          table { width: calc(100% - 60px); margin: 0 30px; border-collapse: collapse; }
          th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
          td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
          .status { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; background: #f1f5f9; }
          .text-right { text-align: right; }
          .footer { padding: 20px 30px; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; margin-top: 20px; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
          .print-btn { position: fixed; top: 10px; right: 10px; background: #03a4ed; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-family: Poppins; font-weight: 600; cursor: pointer; }
        `}} />
      </head>
      <body>
        <script dangerouslySetInnerHTML={{ __html: `
          window.onload = function() {
            document.getElementById('print-btn').addEventListener('click', function() { window.print(); });
          };
        `}} />
        <button id="print-btn" className="print-btn no-print">Imprimir / Salvar PDF</button>
        <div className="header">
          <div>
            <h1>Apolizza</h1>
            <div style={{ fontSize: "12px", marginTop: "4px" }}>Relatorio de Cotacoes</div>
          </div>
          <div className="meta">
            <div>Gerado em: {now}</div>
            <div>{rows.length} cotacao(es)</div>
          </div>
        </div>

        <div className="kpis">
          <div className="kpi">
            <div className="label">Total</div>
            <div className="value">{rows.length}</div>
          </div>
          <div className="kpi">
            <div className="label">Fechadas</div>
            <div className="value" style={{ color: "#22c55e" }}>{fechadas}</div>
          </div>
          <div className="kpi">
            <div className="label">A Receber</div>
            <div className="value" style={{ color: "#22c55e" }}>{fmt(totalAReceber)}</div>
          </div>
          <div className="kpi">
            <div className="label">Valor em Perda</div>
            <div className="value" style={{ color: "#ff695f" }}>{fmt(totalPerda)}</div>
          </div>
        </div>

        {activeFilters.length > 0 && (
          <div className="filters">
            Filtros: {activeFilters.join(" · ")}
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Status</th>
              <th>Produto</th>
              <th>Seguradora</th>
              <th className="text-right">A Receber</th>
              <th>Ref</th>
              <th>Cotador</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 500 }}>{r.name}</td>
                <td><span className="status">{r.status}</span></td>
                <td>{r.produto || "—"}</td>
                <td>{r.seguradora || "—"}</td>
                <td className="text-right" style={{ fontWeight: 600 }}>
                  {r.aReceber ? fmt(Number(r.aReceber)) : "—"}
                </td>
                <td>{r.mesReferencia && r.anoReferencia ? `${r.mesReferencia}/${r.anoReferencia}` : "—"}</td>
                <td>{r.cotador || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="footer">
          Apolizza Corretora de Seguros — Relatorio gerado automaticamente em {now}
        </div>
      </body>
    </html>
  );
}
