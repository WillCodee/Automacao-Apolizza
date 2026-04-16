"use client";

import { useState, useEffect, useCallback } from "react";

type Cotador = { id: string; name: string; photoUrl: string | null };
type Meta = {
  id?: string;
  userId: string | null;
  ano: number;
  mes: number;
  metaValor: string | null;
  metaQtdCotacoes: number | null;
  metaRenovacoes: number | null;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const anos = Array.from({ length: 6 }, (_, i) => 2024 + i);

function fmtBRL(v: string) {
  // DB retorna "100.00" (ponto decimal JS/PG); usuário digita "100,00" (BRL)
  let n: number;
  if (v.includes(",")) {
    // Formato BRL: ponto = separador de milhar, vírgula = decimal
    n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  } else {
    // Formato JS/DB: ponto = decimal
    n = parseFloat(v);
  }
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(v: string): number | null {
  const trimmed = v.trim();
  let n: number;
  if (trimmed.includes(",")) {
    // Formato BRL: remove pontos (milhar), troca vírgula por ponto
    n = parseFloat(trimmed.replace(/[^\d,]/g, "").replace(",", "."));
  } else {
    // Formato JS/DB: mantém ponto decimal
    n = parseFloat(trimmed.replace(/[^\d.]/g, ""));
  }
  return isNaN(n) ? null : n;
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) return <img src={photo} alt={name} className="w-8 h-8 rounded-full object-cover" />;
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full bg-[#03a4ed] text-white text-xs font-bold flex items-center justify-center">
      {initials}
    </div>
  );
}

type MetaRowProps = {
  label: string;
  photo?: string | null;
  meta: Meta;
  onSave: (m: Meta) => Promise<void>;
};

function MetaRow({ label, photo, meta, onSave }: MetaRowProps) {
  const [valor, setValor] = useState(meta.metaValor ? fmtBRL(meta.metaValor) : "");
  const [qtd, setQtd] = useState(meta.metaQtdCotacoes?.toString() || "");
  const [renovacoes, setRenovacoes] = useState(meta.metaRenovacoes?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave({
      ...meta,
      metaValor: parseBRL(valor)?.toString() ?? null,
      metaQtdCotacoes: qtd ? parseInt(qtd) : null,
      metaRenovacoes: renovacoes ? parseInt(renovacoes) : null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-4 border-b border-slate-100 last:border-0">
      {/* Name */}
      <div className="flex items-center gap-2.5 w-40 shrink-0">
        {photo !== undefined ? (
          <Avatar name={label} photo={photo ?? null} />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        )}
        <span className="text-sm font-medium text-slate-800 truncate">{label}</span>
      </div>

      {/* Inputs */}
      <div className="flex flex-1 gap-2 flex-wrap">
        <div className="flex-1 min-w-[130px]">
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Valor (R$)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
            <input
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onBlur={(e) => {
                const n = parseBRL(e.target.value);
                setValor(n !== null ? fmtBRL(n.toString()) : "");
              }}
              placeholder="0,00"
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
            />
          </div>
        </div>
        <div className="w-28">
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Qtd. Cotações</label>
          <input
            type="number"
            min={0}
            value={qtd}
            onChange={(e) => setQtd(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
          />
        </div>
        <div className="w-28">
          <label className="text-[11px] text-slate-400 font-medium block mb-1">Renovações</label>
          <input
            type="number"
            min={0}
            value={renovacoes}
            onChange={(e) => setRenovacoes(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#03a4ed] focus:border-[#03a4ed] outline-none transition"
          />
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          saved
            ? "bg-emerald-500 text-white"
            : "bg-[#03a4ed] text-white hover:bg-[#0288d1]"
        } disabled:opacity-50`}
      >
        {saving ? "Salvando..." : saved ? "✓ Salvo" : "Salvar"}
      </button>
    </div>
  );
}

export function MetasAdmin({ cotadores }: { cotadores: Cotador[] }) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(false);

  // "Aplicar a todos" state
  const [todoValor, setTodoValor] = useState("");
  const [todoQtd, setTodoQtd] = useState("");
  const [todoRenovacoes, setTodoRenovacoes] = useState("");
  const [applyingAll, setApplyingAll] = useState(false);
  const [appliedAll, setAppliedAll] = useState(false);

  const fetchMetas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/metas?ano=${ano}`);
      const data = await res.json();
      setMetas(data.data || []);
    } finally {
      setLoading(false);
    }
  }, [ano]);

  useEffect(() => {
    fetchMetas();
  }, [fetchMetas]);

  function getMetaFor(userId: string | null): Meta {
    const found = metas.find(
      (m) => m.mes === mes && (userId === null ? m.userId === null : m.userId === userId)
    );
    return found || { userId, ano, mes, metaValor: null, metaQtdCotacoes: null, metaRenovacoes: null };
  }

  async function saveMeta(meta: Meta) {
    await fetch("/api/metas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(meta),
    });
    await fetchMetas();
  }

  async function handleApplyAll() {
    if (!todoValor && !todoQtd && !todoRenovacoes) return;
    setApplyingAll(true);
    await Promise.all(
      cotadores.map((c) =>
        fetch("/api/metas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: c.id,
            ano,
            mes,
            metaValor: parseBRL(todoValor)?.toString() ?? null,
            metaQtdCotacoes: todoQtd ? parseInt(todoQtd) : null,
            metaRenovacoes: todoRenovacoes ? parseInt(todoRenovacoes) : null,
          }),
        })
      )
    );
    await fetchMetas();
    setApplyingAll(false);
    setAppliedAll(true);
    setTimeout(() => setAppliedAll(false), 2500);
  }

  return (
    <div className="space-y-6">
      {/* Seletor mês/ano */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Mês</label>
            <select
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] outline-none"
            >
              {MESES.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1.5">Ano</label>
            <select
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
              className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#03a4ed] outline-none"
            >
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="text-sm text-slate-500 pb-2">
            Configurando metas para <span className="font-semibold text-slate-800">{MESES[mes - 1]}/{ano}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center text-slate-400 text-sm">
          Carregando...
        </div>
      ) : (
        <>
          {/* Meta da Empresa */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#03a4ed]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#03a4ed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Meta da Empresa</h2>
                <p className="text-xs text-slate-500">Meta global consolidada do mês</p>
              </div>
            </div>
            <MetaRow
              label="Empresa"
              meta={getMetaFor(null)}
              onSave={saveMeta}
            />
          </div>

          {/* Aplicar a todos */}
          <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Aplicar a Todos os Cotadores</h2>
                <p className="text-xs text-slate-500">Define a mesma meta para todos de uma vez</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-[130px]">
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                  <input
                    type="text"
                    value={todoValor}
                    onChange={(e) => setTodoValor(e.target.value)}
                    onBlur={(e) => {
                      const n = parseBRL(e.target.value);
                      setTodoValor(n !== null ? fmtBRL(n.toString()) : "");
                    }}
                    placeholder="0,00"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                  />
                </div>
              </div>
              <div className="w-28">
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Qtd. Cotações</label>
                <input
                  type="number"
                  min={0}
                  value={todoQtd}
                  onChange={(e) => setTodoQtd(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                />
              </div>
              <div className="w-28">
                <label className="text-[11px] text-slate-400 font-medium block mb-1">Renovações</label>
                <input
                  type="number"
                  min={0}
                  value={todoRenovacoes}
                  onChange={(e) => setTodoRenovacoes(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none transition"
                />
              </div>
              <button
                onClick={handleApplyAll}
                disabled={applyingAll || (!todoValor && !todoQtd && !todoRenovacoes)}
                className={`shrink-0 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                  appliedAll
                    ? "bg-emerald-500 text-white"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {applyingAll ? "Aplicando..." : appliedAll ? "✓ Aplicado" : "Aplicar a todos"}
              </button>
            </div>
          </div>

          {/* Metas individuais */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#ff695f]/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#ff695f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Metas por Cotador</h2>
                <p className="text-xs text-slate-500">Meta individual para cada cotador ativo</p>
              </div>
            </div>
            {cotadores.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum cotador ativo encontrado.</p>
            ) : (
              cotadores.map((c) => (
                <MetaRow
                  key={c.id}
                  label={c.name}
                  photo={c.photoUrl}
                  meta={getMetaFor(c.id)}
                  onSave={saveMeta}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
