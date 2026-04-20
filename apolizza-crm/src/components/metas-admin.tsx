"use client";

import { useState, useEffect, useCallback } from "react";
import { PRODUTO_OPTIONS } from "@/lib/constants";

type Cotador = { id: string; name: string; photoUrl: string | null };
type Grupo = { id: string; nome: string; cor: string };
type Meta = {
  id?: string;
  userId: string | null;
  grupoId?: string | null;
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
  let n: number;
  if (v.includes(",")) {
    n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  } else {
    n = parseFloat(v);
  }
  if (isNaN(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseBRL(v: string): number | null {
  const trimmed = v.trim();
  let n: number;
  if (trimmed.includes(",")) {
    n = parseFloat(trimmed.replace(/[^\d,]/g, "").replace(",", "."));
  } else {
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
  color?: string;
  meta: Meta;
  onSave: (m: Meta) => Promise<void>;
  clearTrigger?: number;
};

function MetaRow({ label, photo, color, meta, onSave, clearTrigger }: MetaRowProps) {
  const [valor, setValor] = useState(meta.metaValor ? fmtBRL(meta.metaValor) : "");
  const [qtd, setQtd] = useState(meta.metaQtdCotacoes?.toString() || "");
  const [renovacoes, setRenovacoes] = useState(meta.metaRenovacoes?.toString() || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValor(meta.metaValor ? fmtBRL(meta.metaValor) : "");
    setQtd(meta.metaQtdCotacoes?.toString() || "");
    setRenovacoes(meta.metaRenovacoes?.toString() || "");
  }, [meta.metaValor, meta.metaQtdCotacoes, meta.metaRenovacoes]);

  useEffect(() => {
    if (clearTrigger === undefined || clearTrigger === 0) return;
    setValor("");
    setQtd("");
    setRenovacoes("");
  }, [clearTrigger]);

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
      <div className="flex items-center gap-2.5 w-40 shrink-0">
        {color !== undefined ? (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
            {label.slice(0, 2).toUpperCase()}
          </div>
        ) : photo !== undefined ? (
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

// ── Metas por Produto ──────────────────────────────────────────────────────────

type MetaProduto = { produto: string; metaValor: string };

function MetasProdutoSection({
  ano,
  mes,
  metaEmpresa,
}: {
  ano: number;
  mes: number;
  metaEmpresa: number | null;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [initial, setInitial] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const totalAlocado = Object.values(values).reduce((s, v) => {
    const n = parseBRL(v);
    return s + (n ?? 0);
  }, 0);

  const ultrapassou = metaEmpresa !== null && totalAlocado > metaEmpresa;

  const fetchProduto = useCallback(async () => {
    const res = await fetch(`/api/metas/produto?ano=${ano}&mes=${mes}`);
    const json = await res.json();
    const rows: MetaProduto[] = json.data ?? [];
    const map: Record<string, string> = {};
    for (const r of rows) {
      if (r.metaValor) map[r.produto] = fmtBRL(r.metaValor);
    }
    setValues(map);
    setInitial(map);
  }, [ano, mes]);

  useEffect(() => { fetchProduto(); }, [fetchProduto]);

  async function handleSaveAll() {
    setSaving(true);
    try {
      await Promise.all(
        PRODUTO_OPTIONS.map((p) =>
          fetch("/api/metas/produto", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ano,
              mes,
              produto: p,
              metaValor: parseBRL(values[p] ?? "") ?? null,
            }),
          })
        )
      );
      await fetchProduto();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!confirm("Deseja limpar todas as metas por produto deste mês?")) return;
    setClearing(true);
    try {
      await fetch(`/api/metas/produto?ano=${ano}&mes=${mes}`, { method: "DELETE" });
      setValues({});
      setInitial({});
    } finally {
      setClearing(false);
    }
  }

  function handleDistribuir() {
    if (!metaEmpresa) return;
    const por = metaEmpresa / PRODUTO_OPTIONS.length;
    const novo: Record<string, string> = {};
    for (const p of PRODUTO_OPTIONS) novo[p] = fmtBRL(por.toFixed(2));
    setValues(novo);
  }

  function handleLimparCampos() {
    setValues({});
  }

  function handleTransferir() {
    if (!metaEmpresa) return;
    // Distribui proporcionalmente para produtos que já têm valor definido
    const preenchidos = PRODUTO_OPTIONS.filter((p) => parseBRL(values[p] ?? "") !== null);
    if (preenchidos.length === 0) return;
    const por = metaEmpresa / preenchidos.length;
    const novo: Record<string, string> = { ...values };
    for (const p of preenchidos) novo[p] = fmtBRL(por.toFixed(2));
    setValues(novo);
  }

  const produtosExibidos = showAll
    ? PRODUTO_OPTIONS
    : PRODUTO_OPTIONS.filter((p) => values[p] || initial[p]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
            <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Metas por Produto</h2>
            <p className="text-xs text-slate-500">A soma não pode ultrapassar a meta da empresa</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleDistribuir}
            disabled={!metaEmpresa}
            title="Divide a meta da empresa igualmente entre todos os produtos"
            className="text-xs text-violet-600 hover:text-violet-800 px-3 py-1.5 rounded-lg border border-violet-200 hover:border-violet-400 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Distribuir Igualmente
          </button>
          <button
            onClick={handleTransferir}
            disabled={!metaEmpresa}
            title="Redistribui a meta apenas entre produtos já preenchidos"
            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Redistribuir Preenchidos
          </button>
          <button
            onClick={handleLimparCampos}
            className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition"
          >
            Limpar Campos
          </button>
          <button
            onClick={handleClear}
            disabled={clearing}
            className="text-xs text-red-400 hover:text-red-600 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition disabled:opacity-40"
          >
            {clearing ? "Limpando..." : "Limpar Salvas"}
          </button>
        </div>
      </div>

      {/* Totalizador */}
      <div className={`rounded-xl px-4 py-3 mb-4 flex flex-wrap items-center gap-4 border ${
        ultrapassou
          ? "bg-red-50 border-red-200"
          : "bg-slate-50 border-slate-100"
      }`}>
        <div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Meta da Empresa</p>
          <p className="text-sm font-bold text-slate-800">
            {metaEmpresa ? metaEmpresa.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Total Alocado</p>
          <p className={`text-sm font-bold ${ultrapassou ? "text-red-600" : "text-violet-600"}`}>
            {totalAlocado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </p>
        </div>
        {metaEmpresa && metaEmpresa > 0 && (
          <div>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Disponível</p>
            <p className={`text-sm font-bold ${ultrapassou ? "text-red-600" : "text-emerald-600"}`}>
              {(metaEmpresa - totalAlocado).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        )}
        {metaEmpresa && metaEmpresa > 0 && (
          <div className="flex-1 min-w-[140px]">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Progresso de alocação</span>
              <span>{Math.min(Math.round((totalAlocado / metaEmpresa) * 100), 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((totalAlocado / metaEmpresa) * 100, 100)}%`,
                  backgroundColor: ultrapassou ? "#ef4444" : totalAlocado / metaEmpresa >= 0.9 ? "#10b981" : "#8b5cf6",
                }}
              />
            </div>
          </div>
        )}
        {ultrapassou && (
          <p className="text-xs text-red-600 font-semibold w-full mt-0.5">
            ⚠ Soma das metas por produto ultrapassa a meta da empresa
          </p>
        )}
      </div>

      {/* Product inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
        {produtosExibidos.map((produto) => {
          const val = values[produto] ?? "";
          const num = parseBRL(val);
          return (
            <div key={produto} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2 hover:border-violet-200 transition">
              <span className="text-xs font-medium text-slate-700 flex-1 truncate" title={produto}>{produto}</span>
              <div className="relative w-32 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[11px]">R$</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) => setValues((prev) => ({ ...prev, [produto]: e.target.value }))}
                  onBlur={(e) => {
                    const n = parseBRL(e.target.value);
                    setValues((prev) => ({ ...prev, [produto]: n !== null ? fmtBRL(n.toString()) : "" }));
                  }}
                  placeholder="0,00"
                  className={`w-full pl-6 pr-2 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-violet-400 focus:border-violet-400 outline-none transition ${
                    num !== null && num > 0 ? "border-violet-200 bg-white" : "border-slate-200 bg-white"
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Show all toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-slate-400 hover:text-violet-600 transition"
        >
          {showAll
            ? `▲ Mostrar apenas preenchidos (${Object.keys(values).filter((k) => parseBRL(values[k] ?? "") !== null).length})`
            : `▼ Mostrar todos os ${PRODUTO_OPTIONS.length} produtos`}
        </button>
        <button
          onClick={handleSaveAll}
          disabled={saving || ultrapassou}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            saved
              ? "bg-emerald-500 text-white"
              : "bg-violet-600 text-white hover:bg-violet-700"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {saving ? "Salvando..." : saved ? "✓ Salvo" : "Salvar Metas por Produto"}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MetasAdmin({ cotadores, grupos }: { cotadores: Cotador[]; grupos: Grupo[] }) {
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

  const [cotadorClearKey, setCotadorClearKey] = useState(0);
  const [grupoClearKey, setGrupoClearKey] = useState(0);
  const [cotadorVersion, setCotadorVersion] = useState(0);

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
      (m) =>
        m.mes === mes &&
        !m.grupoId &&
        (userId === null ? m.userId === null : m.userId === userId)
    );
    return found || { userId, grupoId: null, ano, mes, metaValor: null, metaQtdCotacoes: null, metaRenovacoes: null };
  }

  function getMetaForGrupo(grupoId: string): Meta {
    const found = metas.find((m) => m.mes === mes && m.grupoId === grupoId);
    return found || { userId: null, grupoId, ano, mes, metaValor: null, metaQtdCotacoes: null, metaRenovacoes: null };
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
    try {
      const payload = {
        grupoId: null,
        ano,
        mes,
        metaValor: parseBRL(todoValor)?.toString() ?? null,
        metaQtdCotacoes: todoQtd ? parseInt(todoQtd) : null,
        metaRenovacoes: todoRenovacoes ? parseInt(todoRenovacoes) : null,
      };
      const results = await Promise.all(
        cotadores.map((c) =>
          fetch("/api/metas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, userId: c.id }),
          }).then((r) => r.json())
        )
      );
      const hasError = results.some((r) => !r.success);
      if (hasError) {
        alert("Erro ao salvar algumas metas. Tente novamente.");
        return;
      }
      await fetchMetas();
      setCotadorVersion((v) => v + 1);
      setAppliedAll(true);
      setTimeout(() => setAppliedAll(false), 2500);
    } finally {
      setApplyingAll(false);
    }
  }

  function handleClearAll() {
    setTodoValor("");
    setTodoQtd("");
    setTodoRenovacoes("");
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
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
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
              <button
                onClick={handleClearAll}
                className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                Limpar campos
              </button>
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

          {/* Metas por Cotador */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
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
              <button
                onClick={() => setCotadorClearKey((k) => k + 1)}
                className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                Limpar campos
              </button>
            </div>
            {cotadores.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">Nenhum cotador ativo encontrado.</p>
            ) : (
              cotadores.map((c) => (
                <MetaRow
                  key={`${c.id}-${cotadorVersion}`}
                  label={c.name}
                  photo={c.photoUrl}
                  meta={getMetaFor(c.id)}
                  onSave={saveMeta}
                  clearTrigger={cotadorClearKey}
                />
              ))
            )}
          </div>

          {/* Metas por Grupo */}
          {grupos.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm-7 4a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Metas por Grupo</h2>
                    <p className="text-xs text-slate-500">Meta consolidada para cada grupo de cotadores</p>
                  </div>
                </div>
                <button
                  onClick={() => setGrupoClearKey((k) => k + 1)}
                  className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                >
                  Limpar campos
                </button>
              </div>
              {grupos.map((g) => (
                <MetaRow
                  key={g.id}
                  label={g.nome}
                  color={g.cor}
                  meta={getMetaForGrupo(g.id)}
                  onSave={saveMeta}
                  clearTrigger={grupoClearKey}
                />
              ))}
            </div>
          )}

          {/* Metas por Produto */}
          <MetasProdutoSection
            ano={ano}
            mes={mes}
            metaEmpresa={
              (() => {
                const found = metas.find(
                  (m) => m.mes === mes && m.userId === null && !m.grupoId
                );
                return found?.metaValor ? parseFloat(found.metaValor) : null;
              })()
            }
          />
        </>
      )}
    </div>
  );
}
