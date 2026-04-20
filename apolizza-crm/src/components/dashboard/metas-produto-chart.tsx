"use client";

import { useState, useEffect, useCallback } from "react";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const PRODUTO_OPTIONS = [
  "AUTO","CAMINHÃO","MOTO","RESIDENCIAL","EMPRESARIAL","CONDOMÍNIO","RURAL",
  "EQUIPAMENTOS","TRANSPORTE","RC PROFISSIONAL","RC GERAL","D&O","E&O","GARANTIA",
  "FIANÇA LOCATÍCIA","FIANÇA JUDICIAL","VIDA PF","VIDA PJ","VIDA AP","SAÚDE PF",
  "SAÚDE PJ","ODONTO PF","ODONTO PJ","PREVIDÊNCIA","CAPITALIZAÇÃO",
  "CONSÓRCIO - AUTO","CONSÓRCIO - IMÓVEL","CONSÓRCIO - OUTROS","VIAGEM","PET",
  "BIKE","CELULAR","NOTEBOOK","PORTÁTEIS","CYBER","NÁUTICO","AERONÁUTICO",
  "FROTAS","MÁQUINAS","OBRAS","EVENTOS","LUCROS CESSANTES","PENHOR RURAL",
  "SEGURO SAFRA","OUTROS","PLACA AVULSA",
];

type ProdutoRow = {
  produto: string;
  meta: number;
  realizado: number;
  qtd: number;
  pct: number | null;
};

const fmtCur = (v: number) =>
  v >= 1000
    ? `R$${(v / 1000).toFixed(0)}k`
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtCurFull = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PctBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-slate-300">sem meta</span>;
  const safe = Math.min(Math.max(pct, 0), 100);
  const color = pct >= 100 ? "#10b981" : pct >= 60 ? "#03a4ed" : "#f59e0b";
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${safe}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold w-8 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

export function MetasProdutoChart() {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(MES_ARR[now.getMonth()]);
  const [filtro, setFiltro] = useState("TODOS");
  const [rows, setRows] = useState<ProdutoRow[]>([]);
  const [metaEmpresa, setMetaEmpresa] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - i);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/produto?ano=${ano}&mes=${mes}`);
      const json = await res.json();
      setRows(json.data?.rows ?? []);
      setMetaEmpresa(json.data?.metaEmpresa ?? null);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter rows by selected product
  const displayRows = filtro === "TODOS"
    ? rows.filter((r) => r.realizado > 0 || r.meta > 0)
    : rows.filter((r) => r.produto === filtro);

  const totalMeta = rows.reduce((s, r) => s + r.meta, 0);
  const totalRealizado = rows.reduce((s, r) => s + r.realizado, 0);
  const pctGeral = metaEmpresa && metaEmpresa > 0
    ? Math.round((totalRealizado / metaEmpresa) * 100)
    : null;

  // Products that have data to show in dropdown
  const produtosComDados = Array.from(new Set(rows.map((r) => r.produto)));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">

      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-violet-700 to-violet-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">
            Meta por Produto
          </h3>
          <p className="text-[11px] text-violet-300 font-medium mt-0.5">
            Realizado vs. meta definida por produto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-7 rounded-lg border border-violet-600 bg-violet-800 px-2 text-[11px] text-white focus:outline-none"
          >
            {MES_ARR.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={(e) => setAno(Number(e.target.value))}
            className="h-7 rounded-lg border border-violet-600 bg-violet-800 px-2 text-[11px] text-white focus:outline-none"
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/50 border-b border-slate-100">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Meta Empresa</p>
          <p className="text-sm font-bold text-slate-800 mt-1 truncate">
            {metaEmpresa ? fmtCurFull(metaEmpresa) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-violet-400 uppercase tracking-wide">Alocado em Produtos</p>
          <p className="text-sm font-bold text-violet-700 mt-1 truncate">{fmtCurFull(totalMeta)}</p>
          {metaEmpresa && metaEmpresa > 0 && (
            <p className="text-[10px] text-violet-400 font-semibold">
              {Math.round((totalMeta / metaEmpresa) * 100)}% da meta
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Total Realizado</p>
          <p className="text-sm font-bold text-[#03a4ed] mt-1 truncate">{fmtCurFull(totalRealizado)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">% Meta Empresa</p>
          {pctGeral !== null ? (
            <>
              <p className={`text-sm font-bold mt-1 ${pctGeral >= 100 ? "text-emerald-600" : pctGeral >= 60 ? "text-[#03a4ed]" : "text-amber-500"}`}>
                {pctGeral}%
              </p>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(pctGeral, 100)}%`,
                    backgroundColor: pctGeral >= 100 ? "#10b981" : pctGeral >= 60 ? "#03a4ed" : "#f59e0b",
                  }}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-1">—</p>
          )}
        </div>
      </div>

      {/* Filter row */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-slate-500 font-medium">Filtrar produto:</span>
        <select
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none"
        >
          <option value="TODOS">Todos com dados</option>
          {PRODUTO_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {filtro !== "TODOS" && (
          <button
            onClick={() => setFiltro("TODOS")}
            className="h-7 px-2 rounded-lg border border-slate-200 text-[11px] text-slate-500 hover:bg-slate-50 transition"
          >
            ✕ Limpar
          </button>
        )}
        <span className="ml-auto text-[10px] text-slate-400">
          {displayRows.length} produto{displayRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayRows.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
          Nenhum dado para {filtro === "TODOS" ? `${mes}/${ano}` : filtro}
        </div>
      ) : (
        <div className="px-4 pb-4 mt-2">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_100px_100px_120px] gap-3 px-2 mb-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Produto</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Meta</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Realizado</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right">Progresso</span>
          </div>

          <div className="space-y-1">
            {displayRows.map((row) => (
              <div
                key={row.produto}
                className="grid grid-cols-[1fr_100px_100px_120px] gap-3 items-center px-2 py-2.5 rounded-xl hover:bg-slate-50 transition"
              >
                {/* Produto */}
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{
                    backgroundColor: row.pct === null ? "#94a3b8" : row.pct >= 100 ? "#10b981" : row.pct >= 60 ? "#03a4ed" : "#f59e0b"
                  }} />
                  <span className="text-sm font-medium text-slate-800 truncate">{row.produto}</span>
                  {row.qtd > 0 && (
                    <span className="text-[10px] text-slate-400 shrink-0">{row.qtd} fchdas</span>
                  )}
                </div>

                {/* Meta */}
                <span className="text-xs text-slate-600 text-right">
                  {row.meta > 0 ? fmtCur(row.meta) : <span className="text-slate-300">—</span>}
                </span>

                {/* Realizado */}
                <span className={`text-xs font-semibold text-right ${row.realizado > 0 ? "text-[#03a4ed]" : "text-slate-300"}`}>
                  {row.realizado > 0 ? fmtCur(row.realizado) : "—"}
                </span>

                {/* Barra progresso */}
                <PctBar pct={row.pct} />
              </div>
            ))}
          </div>

          {/* Total row */}
          {displayRows.length > 1 && (
            <div className="grid grid-cols-[1fr_100px_100px_120px] gap-3 items-center px-2 py-2 mt-1 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-600">Total</span>
              <span className="text-xs font-bold text-slate-700 text-right">{fmtCur(displayRows.reduce((s, r) => s + r.meta, 0))}</span>
              <span className="text-xs font-bold text-[#03a4ed] text-right">{fmtCur(displayRows.reduce((s, r) => s + r.realizado, 0))}</span>
              <div className="text-right" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
