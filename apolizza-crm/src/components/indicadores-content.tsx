"use client";

import { useState, useEffect, useCallback } from "react";

interface Row {
  indicacao: string;
  total: number;
  fechadas: number;
  perdas: number;
  em_andamento: number;
  a_receber: number;
  valor_perda: number;
  pipeline: number;
  taxa_conversao: number | null;
}

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const fmt = (v: number | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function IndicadoresContent() {
  const now = new Date();
  const [ano, setAno] = useState(String(now.getFullYear()));
  const [mes, setMes] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (ano) params.set("ano", ano);
    if (mes) params.set("mes", mes);
    const res = await fetch(`/api/indicadores?${params}`);
    const json = await res.json();
    setRows(json.data?.ranking ?? []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalGeral = rows.reduce((s, r) => s + Number(r.total || 0), 0);
  const fechadasGeral = rows.reduce((s, r) => s + Number(r.fechadas || 0), 0);
  const aReceberGeral = rows.reduce((s, r) => s + Number(r.a_receber || 0), 0);
  const perdaGeral = rows.reduce((s, r) => s + Number(r.valor_perda || 0), 0);

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - i));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 flex-wrap">
        <label className="text-xs text-slate-500 font-medium">Ano</label>
        <select value={ano} onChange={(e) => setAno(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#03a4ed] focus:outline-none">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <label className="text-xs text-slate-500 font-medium ml-2">Mês</label>
        <select value={mes} onChange={(e) => setMes(e.target.value)}
          className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-[#03a4ed] focus:outline-none">
          <option value="">Todos</option>
          {MES_ARR.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button onClick={() => { setAno(String(now.getFullYear())); setMes(""); }}
          className="ml-2 text-xs text-slate-500 hover:text-slate-700">Limpar</button>
      </div>

      {/* KPIs agregados */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Indicações ativas</p>
          <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Cotações</p>
          <p className="text-2xl font-bold text-sky-600">{totalGeral.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-slate-400 mt-1">{fechadasGeral} fechadas</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">A Receber (fechadas)</p>
          <p className="text-2xl font-bold text-emerald-600">{fmt(aReceberGeral)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Perdas</p>
          <p className="text-2xl font-bold text-red-500">{fmt(perdaGeral)}</p>
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Ranking por Indicação</h3>
          {loading && <span className="text-xs text-slate-400">Carregando…</span>}
        </div>
        {!loading && rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-slate-400 text-sm">Nenhuma indicação no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Indicação</th>
                  <th className="px-4 py-3 text-right font-medium">Cotações</th>
                  <th className="px-4 py-3 text-right font-medium text-green-700">Fechadas</th>
                  <th className="px-4 py-3 text-right font-medium text-red-500">Perdas</th>
                  <th className="px-4 py-3 text-right font-medium text-sky-600">Andamento</th>
                  <th className="px-4 py-3 text-right font-medium">Taxa</th>
                  <th className="px-4 py-3 text-right font-medium text-emerald-700">A Receber</th>
                  <th className="px-4 py-3 text-right font-medium">Pipeline</th>
                  <th className="px-4 py-3 text-right font-medium text-red-500">Em Perda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.indicacao} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{r.indicacao}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{r.total}</td>
                    <td className="px-4 py-2.5 text-right text-green-700 font-semibold">{r.fechadas}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{r.perdas}</td>
                    <td className="px-4 py-2.5 text-right text-sky-600">{r.em_andamento}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{r.taxa_conversao != null ? `${Number(r.taxa_conversao).toFixed(1)}%` : "–"}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-700 font-semibold">{fmt(r.a_receber)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{fmt(r.pipeline)}</td>
                    <td className="px-4 py-2.5 text-right text-red-500">{fmt(r.valor_perda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
