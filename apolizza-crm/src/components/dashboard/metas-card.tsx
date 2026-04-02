"use client";

import { useState, useEffect } from "react";

type Meta = {
  id: string;
  ano: number;
  mes: number;
  metaValor: string | null;
  metaQtdCotacoes: number | null;
  metaRenovacoes: number | null;
};

type KPIs = {
  totalCotacoes: number;
  fechadas: number;
  totalAReceber: number;
};

export function MetasCard({
  kpis,
  ano,
  isAdmin,
}: {
  kpis: KPIs;
  ano: number;
  isAdmin: boolean;
}) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ metaValor: "", metaQtdCotacoes: "" });
  const mesAtual = new Date().getMonth() + 1;

  useEffect(() => {
    fetch(`/api/metas?ano=${ano}`)
      .then((r) => r.json())
      .then((d) => setMetas(d.data || []));
  }, [ano]);

  const metaMesAtual = metas.find((m) => m.mes === mesAtual);
  const metaValor = metaMesAtual?.metaValor ? parseFloat(metaMesAtual.metaValor) : null;
  const metaQtd = metaMesAtual?.metaQtdCotacoes ?? null;

  const pctValor = metaValor && metaValor > 0 ? Math.min((kpis.totalAReceber / metaValor) * 100, 100) : null;
  const pctQtd = metaQtd && metaQtd > 0 ? Math.min((kpis.fechadas / metaQtd) * 100, 100) : null;

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function saveMeta() {
    await fetch("/api/metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ano,
        mes: mesAtual,
        metaValor: form.metaValor ? Number(form.metaValor) : null,
        metaQtdCotacoes: form.metaQtdCotacoes ? Number(form.metaQtdCotacoes) : null,
      }),
    });
    const r = await fetch(`/api/metas?ano=${ano}`);
    const d = await r.json();
    setMetas(d.data || []);
    setEditing(false);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-900">
          Metas ({mesAtual}/{ano})
        </h3>
        {isAdmin && !editing && (
          <button
            onClick={() => {
              setForm({
                metaValor: metaValor?.toString() || "",
                metaQtdCotacoes: metaQtd?.toString() || "",
              });
              setEditing(true);
            }}
            className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium"
          >
            Editar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Meta Faturamento (R$)</label>
            <input
              type="number"
              value={form.metaValor}
              onChange={(e) => setForm({ ...form, metaValor: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none"
              placeholder="Ex: 50000"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Meta Qtd Fechadas</label>
            <input
              type="number"
              value={form.metaQtdCotacoes}
              onChange={(e) => setForm({ ...form, metaQtdCotacoes: e.target.value })}
              className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none"
              placeholder="Ex: 20"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={saveMeta} className="px-3 py-1.5 text-white text-sm rounded-lg bg-[#03a4ed] hover:bg-[#0288d1]">
              Salvar
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-slate-600 text-sm border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {pctValor !== null && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Faturamento</span>
                <span className="font-medium">{fmt(kpis.totalAReceber)} / {fmt(metaValor!)}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    pctValor >= 100 ? "bg-emerald-500" : pctValor >= 50 ? "bg-[#03a4ed]" : "bg-amber-400"
                  }`}
                  style={{ width: `${pctValor}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{pctValor.toFixed(1)}% da meta</p>
            </div>
          )}

          {pctQtd !== null && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Fechadas</span>
                <span className="font-medium">{kpis.fechadas} / {metaQtd}</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    pctQtd >= 100 ? "bg-emerald-500" : pctQtd >= 50 ? "bg-[#03a4ed]" : "bg-amber-400"
                  }`}
                  style={{ width: `${pctQtd}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{pctQtd.toFixed(1)}% da meta</p>
            </div>
          )}

          {pctValor === null && pctQtd === null && (
            <p className="text-sm text-slate-400 text-center py-4">
              {isAdmin ? 'Clique em "Editar" para definir metas.' : "Nenhuma meta definida."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
