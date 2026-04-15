"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { CardFilter } from "./card-filter";

ChartJS.register(ArcElement, Tooltip, Legend);

const MES_OPTIONS_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

type Meta = {
  id: string;
  userId: string | null;
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

type CotadorData = {
  userId: string;
  name: string;
  photoUrl?: string;
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
};

function GaugeChart({
  pct,
  label,
  current,
  goal,
  color,
}: {
  pct: number;
  label: string;
  current: string;
  goal: string;
  color: string;
}) {
  const safe = Math.min(Math.max(pct, 0), 100);
  const remaining = 100 - safe;

  const data = {
    datasets: [
      {
        data: [safe, remaining],
        backgroundColor: [color, "#f1f5f9"],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "72%",
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-14">
        <Doughnut data={data} options={options} />
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-base font-bold text-slate-800">{safe.toFixed(0)}%</span>
        </div>
      </div>
      <p className="text-[11px] font-semibold text-slate-600 mt-1">{label}</p>
      <p className="text-[10px] text-slate-400">{current} / {goal}</p>
    </div>
  );
}

export function MetasCard({ isAdmin }: { isAdmin: boolean }) {
  const currentYear = String(new Date().getFullYear());
  const currentMes = MES_OPTIONS_ARR[new Date().getMonth()];

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState(currentMes);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [cotadores, setCotadores] = useState<CotadorData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [metasRes, dashRes] = await Promise.all([
      fetch(`/api/metas?ano=${ano}`),
      fetch(`/api/dashboard?ano=${ano}&mes=${mes}`),
    ]);
    const metasJson = await metasRes.json();
    const dashJson = await dashRes.json();
    setMetas(metasJson.data ?? []);
    setKpis(dashJson.data?.kpis ?? null);
    setCotadores(dashJson.data?.cotadores ?? []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive month number from mes abbreviation
  const mesNum = MES_OPTIONS_ARR.indexOf(mes) + 1; // 1-12, or 0 if not found

  // Meta global da empresa (userId = null)
  const metaEmpresa = metas.find((m) => m.mes === mesNum && m.userId === null);
  const metaValor = metaEmpresa?.metaValor ? parseFloat(metaEmpresa.metaValor) : null;
  const metaQtd = metaEmpresa?.metaQtdCotacoes ?? null;
  const metaRenovacoes = metaEmpresa?.metaRenovacoes ?? null;

  const pctValor = kpis && metaValor && metaValor > 0 ? (kpis.totalAReceber / metaValor) * 100 : null;
  const pctQtd = kpis && metaQtd && metaQtd > 0 ? (kpis.fechadas / metaQtd) * 100 : null;

  // Metas individuais dos cotadores
  const metasCotadores = metas.filter((m) => m.userId !== null && m.mes === mesNum);

  const fmtCur = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const fmtK = (v: number) =>
    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : fmtCur(v);

  const temMeta = pctValor !== null || pctQtd !== null;
  const temMetaCotador = metasCotadores.length > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Metas
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
          {isAdmin && (
            <Link
              href="/administracao/metas"
              className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Gerenciar
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Meta da empresa */}
          {!temMeta ? (
            <div className="py-4 text-center">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Empresa</p>
              <p className="text-sm text-slate-400">
                {isAdmin ? (
                  <>Nenhuma meta definida.{" "}
                    <Link href="/administracao/metas" className="text-[#03a4ed] hover:underline">
                      Definir metas →
                    </Link>
                  </>
                ) : "Nenhuma meta definida."}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Empresa</p>
              <div className="space-y-3">
                <div className="flex justify-around pt-1">
                  {pctValor !== null && kpis && (
                    <GaugeChart
                      pct={pctValor}
                      label="Faturamento"
                      current={fmtK(kpis.totalAReceber)}
                      goal={fmtK(metaValor!)}
                      color={pctValor >= 100 ? "#10b981" : pctValor >= 50 ? "#03a4ed" : "#f59e0b"}
                    />
                  )}
                  {pctQtd !== null && kpis && (
                    <GaugeChart
                      pct={pctQtd}
                      label="Fechadas"
                      current={String(kpis.fechadas)}
                      goal={String(metaQtd)}
                      color={pctQtd >= 100 ? "#10b981" : pctQtd >= 50 ? "#8b5cf6" : "#f97316"}
                    />
                  )}
                  {metaRenovacoes && (
                    <GaugeChart
                      pct={0}
                      label="Renovacoes"
                      current="—"
                      goal={String(metaRenovacoes)}
                      color="#94a3b8"
                    />
                  )}
                </div>
                <div className="flex justify-center gap-3 flex-wrap">
                  {[
                    { label: "Atingida", color: "#10b981" },
                    { label: "Em progresso", color: "#03a4ed" },
                    { label: "Abaixo", color: "#f59e0b" },
                  ].map((l) => (
                    <span key={l.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                      <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Metas dos cotadores */}
          {temMetaCotador && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 border-t border-slate-100 pt-3">
                Cotadores
              </p>
              <div className="space-y-2">
                {metasCotadores.map((mc) => {
                  const cotador = cotadores.find((c) => c.userId === mc.userId);
                  const mValor = mc.metaValor ? parseFloat(mc.metaValor) : null;
                  const mQtd = mc.metaQtdCotacoes;
                  const atual = cotador?.faturamento ?? 0;
                  const fechadas = cotador?.fechadas ?? 0;
                  const pValor = mValor && mValor > 0 ? Math.min((atual / mValor) * 100, 100) : null;
                  const pQtd = mQtd && mQtd > 0 ? Math.min((fechadas / mQtd) * 100, 100) : null;
                  const nome = cotador?.name ?? `Cotador`;

                  return (
                    <div key={mc.id} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#03a4ed] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                        {nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-slate-700 truncate">{nome.split(" ")[0]}</span>
                          {pValor !== null && (
                            <span className={`text-[10px] font-semibold ${pValor >= 100 ? "text-emerald-600" : pValor >= 50 ? "text-[#03a4ed]" : "text-amber-500"}`}>
                              {fmtK(atual)} / {fmtK(mValor!)}
                            </span>
                          )}
                          {pQtd !== null && pValor === null && (
                            <span className={`text-[10px] font-semibold ${pQtd >= 100 ? "text-emerald-600" : pQtd >= 50 ? "text-violet-600" : "text-orange-500"}`}>
                              {fechadas} / {mQtd} fechadas
                            </span>
                          )}
                        </div>
                        {(pValor !== null || pQtd !== null) && (
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pValor ?? pQtd ?? 0}%`,
                                backgroundColor: (pValor ?? pQtd ?? 0) >= 100 ? "#10b981" : (pValor ?? pQtd ?? 0) >= 50 ? "#03a4ed" : "#f59e0b",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
