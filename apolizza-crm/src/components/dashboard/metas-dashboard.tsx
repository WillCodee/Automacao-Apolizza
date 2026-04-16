"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

type Meta = {
  id: string;
  userId: string | null;
  ano: number;
  mes: number;
  metaValor: string | null;
  metaQtdCotacoes: number | null;
};

type CotadorPerf = {
  id: string;
  name: string;
  photoUrl: string | null;
  total: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
};

type GrupoPerf = {
  id: string;
  nome: string;
  cor: string;
  total: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
};

type Kpis = {
  totalCotacoes: number;
  fechadas: number;
  totalAReceber: number;
  perdas: number;
};

const fmtCur = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  const safe = Math.min(Math.max(pct, 0), 100);
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${safe}%`, backgroundColor: color }}
      />
    </div>
  );
}

function PctBadge({ pct }: { pct: number }) {
  const color = pct >= 100 ? "text-emerald-600 bg-emerald-50" : pct >= 60 ? "text-blue-600 bg-blue-50" : "text-amber-600 bg-amber-50";
  return (
    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${color}`}>
      {pct.toFixed(0)}%
    </span>
  );
}

function Avatar({ name, photoUrl, size = 9 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  if (photoUrl) {
    return (
      <div className={`w-${size} h-${size} rounded-full overflow-hidden shrink-0`}>
        <Image src={photoUrl} alt={name} width={size * 4} height={size * 4} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`w-${size} h-${size} rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br from-[#03a4ed] to-[#0288d1]`}>
      {initials}
    </div>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs text-slate-500 font-medium mb-1">{label}</p>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export function MetasDashboard({ isAdmin }: { isAdmin: boolean }) {
  const currentYear = String(new Date().getFullYear());
  const currentMes = MES_ARR[new Date().getMonth()];

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState(currentMes);
  const [tab, setTab] = useState<"cotador" | "grupo">("cotador");

  const [metas, setMetas] = useState<Meta[]>([]);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [cotadores, setCotadores] = useState<CotadorPerf[]>([]);
  const [grupos, setGrupos] = useState<GrupoPerf[]>([]);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const mesNum = MES_ARR.indexOf(mes) + 1;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [metasRes, dashRes, analiseRes] = await Promise.all([
        fetch(`/api/metas?ano=${ano}`),
        fetch(`/api/dashboard?ano=${ano}&mes=${mes}`),
        fetch(`/api/analise?ano=${ano}&mes=${mes}`),
      ]);
      const [metasJson, dashJson, analiseJson] = await Promise.all([
        metasRes.json(),
        dashRes.json(),
        analiseRes.json(),
      ]);
      setMetas(metasJson.data ?? []);
      setKpis(dashJson.data?.kpis ?? null);
      setCotadores(analiseJson.data?.cotadores ?? []);
      setGrupos(analiseJson.data?.grupos ?? []);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived values ──────────────────────────────────────────
  const metaEmpresa = metas.find(m => m.mes === mesNum && m.userId === null);
  const metaValorEmp = metaEmpresa?.metaValor ? parseFloat(metaEmpresa.metaValor) : null;
  const metaQtdEmp   = metaEmpresa?.metaQtdCotacoes ?? null;

  const ganhoAtual = kpis?.totalAReceber ?? 0;
  const fechadasAtual = kpis?.fechadas ?? 0;

  const pctValorEmp = metaValorEmp && metaValorEmp > 0 ? (ganhoAtual / metaValorEmp) * 100 : null;
  const pctQtdEmp   = metaQtdEmp   && metaQtdEmp   > 0 ? (fechadasAtual / metaQtdEmp)   * 100 : null;

  const empColor = (pct: number) => pct >= 100 ? "#10b981" : pct >= 60 ? "#03a4ed" : "#f59e0b";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Metas & Desempenho</h3>
        <div className="flex items-center gap-2">
          <select value={mes} onChange={(e) => setMes(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none">
            {MES_ARR.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={ano} onChange={(e) => setAno(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {isAdmin && (
            <Link href="/administracao/metas"
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition shadow-sm">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Gerenciar
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="p-5 space-y-6">

          {/* ── Empresa ──────────────────────────────────────────── */}
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Empresa — {mes}/{ano}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <KpiCard
                label="Ganho até agora"
                value={fmtCur(ganhoAtual)}
                sub={mes + "/" + ano}
                color="#03a4ed"
              />
              <KpiCard
                label="Meta faturamento"
                value={metaValorEmp ? fmtCur(metaValorEmp) : "—"}
                color="#8b5cf6"
              />
              <KpiCard
                label="Fechadas"
                value={String(fechadasAtual)}
                sub={metaQtdEmp ? `Meta: ${metaQtdEmp}` : undefined}
                color="#10b981"
              />
              <KpiCard
                label="Perdas"
                value={String(kpis?.perdas ?? 0)}
                color="#ef4444"
              />
            </div>

            {/* Progress bars empresa */}
            {(pctValorEmp !== null || pctQtdEmp !== null) && (
              <div className="space-y-3">
                {pctValorEmp !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">Faturamento</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{fmtCur(ganhoAtual)} / {fmtCur(metaValorEmp!)}</span>
                        <PctBadge pct={pctValorEmp} />
                      </div>
                    </div>
                    <ProgressBar pct={pctValorEmp} color={empColor(pctValorEmp)} />
                  </div>
                )}
                {pctQtdEmp !== null && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-slate-600">Cotações fechadas</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">{fechadasAtual} / {metaQtdEmp}</span>
                        <PctBadge pct={pctQtdEmp} />
                      </div>
                    </div>
                    <ProgressBar pct={pctQtdEmp} color={empColor(pctQtdEmp)} />
                  </div>
                )}
                {pctValorEmp === null && pctQtdEmp === null && (
                  <p className="text-xs text-slate-400 text-center py-2">
                    {isAdmin ? <Link href="/administracao/metas" className="text-[#03a4ed] hover:underline">Definir metas da empresa →</Link> : "Nenhuma meta definida."}
                  </p>
                )}
              </div>
            )}
            {pctValorEmp === null && pctQtdEmp === null && (
              <p className="text-xs text-slate-400 text-center py-1">
                {isAdmin ? <Link href="/administracao/metas" className="text-[#03a4ed] hover:underline">Definir metas da empresa →</Link> : "Nenhuma meta definida para o período."}
              </p>
            )}
          </div>

          {/* ── Cotadores / Grupos ────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Desempenho individual</p>
              <div className="flex gap-1.5">
                <button onClick={() => setTab("cotador")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${tab === "cotador" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  Cotadores
                </button>
                <button onClick={() => setTab("grupo")}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${tab === "grupo" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  Grupos
                </button>
              </div>
            </div>

            {/* Por Cotador */}
            {tab === "cotador" && (
              <div className="space-y-3">
                {cotadores.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum cotador ativo</p>
                )}
                {cotadores.map((c) => {
                  const metaCot = metas.find(m => m.userId === c.id && m.mes === mesNum);
                  const mValor = metaCot?.metaValor ? parseFloat(metaCot.metaValor) : null;
                  const mQtd = metaCot?.metaQtdCotacoes ?? null;
                  const pValor = mValor && mValor > 0 ? (c.faturamento / mValor) * 100 : null;
                  const pQtd   = mQtd   && mQtd   > 0 ? (c.fechadas   / mQtd)   * 100 : null;
                  const pct = pValor ?? pQtd;
                  const barColor = pct == null ? "#94a3b8" : pct >= 100 ? "#10b981" : pct >= 60 ? "#03a4ed" : "#f59e0b";

                  return (
                    <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/60 transition">
                      <Avatar name={c.name} photoUrl={c.photoUrl} size={9} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-semibold text-slate-800 truncate">{c.name}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-xs text-slate-500">{fmtCur(c.faturamento)}</span>
                            {mValor && <span className="text-[11px] text-slate-400">/ {fmtCur(mValor)}</span>}
                            {pct !== null && <PctBadge pct={pct} />}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[11px] text-slate-400">{c.fechadas} fechadas</span>
                          {mQtd && <span className="text-[11px] text-slate-400">/ {mQtd} meta</span>}
                          <span className="text-[11px] text-slate-400">{c.perdas} perdas</span>
                          <span className="text-[11px] text-slate-400">{c.taxaConversao?.toFixed(0) ?? 0}% taxa</span>
                        </div>
                        <ProgressBar pct={pct ?? 0} color={barColor} />
                        {pct === null && (
                          <p className="text-[10px] text-slate-400 mt-0.5">Sem meta definida</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Por Grupo */}
            {tab === "grupo" && (
              <div className="space-y-3">
                {grupos.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum grupo cadastrado</p>
                )}
                {grupos.map((g) => {
                  return (
                    <div key={g.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100/60 transition">
                      <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: g.cor }}>
                        {g.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm font-semibold text-slate-800 truncate">{g.nome}</span>
                          <span className="text-xs font-semibold text-[#03a4ed] shrink-0 ml-2">{fmtCur(g.faturamento)}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="text-[11px] text-slate-400">{g.total} cotações</span>
                          <span className="text-[11px] text-emerald-600">{g.fechadas} fechadas</span>
                          <span className="text-[11px] text-red-400">{g.perdas} perdas</span>
                          <span className="text-[11px] text-slate-400">{g.taxaConversao?.toFixed(0) ?? 0}% taxa</span>
                        </div>
                        <ProgressBar pct={g.fechadas > 0 ? Math.min((g.fechadas / Math.max(g.total, 1)) * 100, 100) : 0} color={g.cor} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
