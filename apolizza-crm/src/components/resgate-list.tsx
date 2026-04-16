"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { MES_OPTIONS } from "@/lib/constants";
import { STATUS_BADGES, SITUACAO_BADGES } from "@/lib/status-config";

type ResgateItem = {
  id: string;
  name: string;
  status: string;
  situacao: string | null;
  produto: string | null;
  seguradora: string | null;
  tipoCliente: string | null;
  contatoCliente: string | null;
  mesReferencia: string | null;
  anoReferencia: number | null;
  valorPerda: number | null;
  observacao: string | null;
  createdAt: string;
  dueDate: string | null;
  indicacao: string | null;
};

function buildParams(filters: {
  search: string;
  mes: string;
  ano: string;
  dateFrom: string;
  dateTo: string;
}) {
  const p = new URLSearchParams();
  if (filters.search) p.set("search", filters.search);
  if (filters.mes) p.set("mes", filters.mes);
  if (filters.ano) p.set("ano", filters.ano);
  if (filters.dateFrom) p.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) p.set("dateTo", filters.dateTo);
  return p.toString();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function fmtCurrency(v: number | null) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ResgateList() {
  const [items, setItems] = useState<ResgateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mes, setMes] = useState("");
  const [ano, setAno] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(
    async (filters: { search: string; mes: string; ano: string; dateFrom: string; dateTo: string }) => {
      setLoading(true);
      try {
        const qs = buildParams(filters);
        const res = await fetch(`/api/cotacoes/resgate${qs ? "?" + qs : ""}`);
        if (!res.ok) throw new Error("Erro ao buscar dados");
        const json = await res.json();
        setItems(json.data ?? []);
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      fetchData({ search, mes, ano, dateFrom, dateTo });
    }, 350);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, mes, ano, dateFrom, dateTo, fetchData]);

  // ─── CSV Export ──────────────────────────────────────────────────────────────
  function exportCsv() {
    setExporting(true);
    try {
      const headers = [
        "Nome/Cliente",
        "Status",
        "Situação",
        "Produto",
        "Seguradora",
        "Tipo Cliente",
        "Contato",
        "Mês Ref.",
        "Ano Ref.",
        "Valor Perda",
        "Indicação",
        "Data Criação",
        "Observação",
      ];

      const rows = items.map((r) => [
        r.name,
        r.status,
        r.situacao ?? "",
        r.produto ?? "",
        r.seguradora ?? "",
        r.tipoCliente ?? "",
        r.contatoCliente ?? "",
        r.mesReferencia ?? "",
        r.anoReferencia != null ? String(r.anoReferencia) : "",
        r.valorPerda != null ? String(r.valorPerda) : "",
        r.indicacao ?? "",
        fmtDate(r.createdAt),
        (r.observacao ?? "").replace(/\n/g, " "),
      ]);

      const csvContent = [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
        )
        .join("\n");

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resgates-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  // ─── PDF Export (print) ───────────────────────────────────────────────────────
  function exportPdf() {
    window.print();
  }

  const inputClass =
    "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none focus:ring-2 focus:ring-[#03a4ed]/20 transition";

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      {/* ── Filtros ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm print:hidden">
        <div className="flex flex-wrap gap-3">
          {/* Busca */}
          <div className="relative flex-1 min-w-[200px]">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, produto, seguradora..."
              className={`${inputClass} pl-9 w-full`}
            />
          </div>

          {/* Mês */}
          <select value={mes} onChange={(e) => setMes(e.target.value)} className={inputClass}>
            <option value="">Todos os meses</option>
            {MES_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Ano */}
          <select value={ano} onChange={(e) => setAno(e.target.value)} className={inputClass}>
            <option value="">Todos os anos</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>

          {/* Período: de */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500 whitespace-nowrap">De</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Período: até */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500 whitespace-nowrap">Até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Limpar */}
          {(search || mes || ano || dateFrom || dateTo) && (
            <button
              onClick={() => { setSearch(""); setMes(""); setAno(""); setDateFrom(""); setDateTo(""); }}
              className="h-9 px-3 rounded-lg text-sm text-slate-500 hover:bg-slate-100 transition"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Barra de ações + resumo ── */}
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-slate-500">
          {loading ? "Carregando..." : `${items.length} registro${items.length !== 1 ? "s" : ""} encontrado${items.length !== 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting || loading || items.length === 0}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            CSV
          </button>
          <button
            onClick={exportPdf}
            disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* ── Tabela ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <svg className="mx-auto mb-3 w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-slate-500">Nenhum registro de perda/resgate encontrado.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden print:block">
            {/* Print header */}
            <div className="hidden print:block px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">Relatório de Resgates — Apolizza CRM</h2>
              <p className="text-sm text-slate-500 mt-0.5">Gerado em {new Date().toLocaleString("pt-BR")}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Cliente</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Produto</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Seguradora</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Situação</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Mês/Ano</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Valor Perda</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600 print:hidden">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 leading-snug">{item.name}</div>
                      {item.contatoCliente && (
                        <div className="text-xs text-slate-400 mt-0.5">{item.contatoCliente}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.produto || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{item.seguradora || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[item.status] || "bg-slate-100 text-slate-600"}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.situacao ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SITUACAO_BADGES[item.situacao] || "bg-slate-100 text-slate-500"}`}>
                          {item.situacao}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.mesReferencia || item.anoReferencia
                        ? `${item.mesReferencia ?? ""}${item.mesReferencia && item.anoReferencia ? "/" : ""}${item.anoReferencia ?? ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-red-600">
                      {fmtCurrency(item.valorPerda)}
                    </td>
                    <td className="px-4 py-3 print:hidden">
                      <Link
                        href={`/cotacoes/${item.id}`}
                        className="text-[#03a4ed] hover:underline text-xs font-medium"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer: total */}
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-semibold text-slate-700">
                    Total ({items.length} registro{items.length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-red-600">
                    {fmtCurrency(
                      items.reduce((acc, i) => acc + (i.valorPerda ?? 0), 0) || null
                    )}
                  </td>
                  <td className="print:hidden" />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3 print:hidden">
            {items.map((item) => (
              <Link key={item.id} href={`/cotacoes/${item.id}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-semibold text-slate-800 text-sm leading-snug">{item.name}</span>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[item.status] || "bg-slate-100 text-slate-600"}`}>
                    {item.status}
                  </span>
                </div>
                {item.situacao && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${SITUACAO_BADGES[item.situacao] || "bg-slate-100 text-slate-500"}`}>
                    {item.situacao}
                  </span>
                )}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
                  {item.produto && <span>Produto: <b className="text-slate-700">{item.produto}</b></span>}
                  {item.seguradora && <span>Seguradora: <b className="text-slate-700">{item.seguradora}</b></span>}
                  {(item.mesReferencia || item.anoReferencia) && (
                    <span>Período: <b className="text-slate-700">{item.mesReferencia}/{item.anoReferencia}</b></span>
                  )}
                  {item.valorPerda != null && (
                    <span>Perda: <b className="text-red-600">{fmtCurrency(item.valorPerda)}</b></span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}
