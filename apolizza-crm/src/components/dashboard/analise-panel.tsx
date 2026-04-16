"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { STATUS_BADGES, SITUACAO_BADGES } from "@/lib/status-config";

const MES_OPTIONS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

type CotadorRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  total: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
};

type GrupoRow = {
  id: string;
  nome: string;
  cor: string;
  total: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
};

type StatusRow = {
  status: string;
  total: number;
  faturamento: number;
};

type SituacaoRow = {
  situacao: string;
  total: number;
  faturamento: number;
};

type AnaliseData = {
  cotadores: CotadorRow[];
  grupos: GrupoRow[];
  porStatus: StatusRow[];
  porSituacao: SituacaoRow[];
};

const fmtCur = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Avatar({ name, photoUrl, size = 7 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  const cls = `w-${size} h-${size} rounded-full shrink-0 flex items-center justify-center text-white text-[11px] font-bold bg-[#03a4ed] overflow-hidden`;
  if (photoUrl) {
    return (
      <div className={cls}>
        <Image src={photoUrl} alt={name} width={size * 4} height={size * 4} className="w-full h-full object-cover" />
      </div>
    );
  }
  return <div className={cls}>{initials}</div>;
}

export function AnálisePanel({ userRole }: { userRole: "admin" | "cotador" | "proprietario" }) {
  const isAdmin = userRole === "admin" || userRole === "proprietario";
  const currentYear = String(new Date().getFullYear());

  const [mainTab, setMainTab] = useState<"cotador" | "status">("cotador");
  const [subTab, setSubTab] = useState<"cotador" | "grupo">("cotador");
  const [statusTab, setStatusTab] = useState<"status" | "situacao">("status");
  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState("");
  const [data, setData] = useState<AnaliseData | null>(null);
  const [loading, setLoading] = useState(true);

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (ano) qs.set("ano", ano);
      if (mes) qs.set("mes", mes);
      const res = await fetch(`/api/analise?${qs}`);
      const json = await res.json();
      setData(json.data ?? null);
    } finally {
      setLoading(false);
    }
  }, [ano, mes]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const thClass = "px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide";
  const tdClass = "px-4 py-3 text-sm text-slate-700";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">Análise de Cotações</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtros */}
          <select
            value={ano}
            onChange={(e) => setAno(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm focus:border-[#03a4ed] focus:outline-none"
          >
            <option value="">Todos os meses</option>
            {MES_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* Main tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setMainTab("cotador")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${mainTab === "cotador" ? "bg-white text-[#03a4ed] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Cotador / Grupo
            </button>
            <button
              onClick={() => setMainTab("status")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition ${mainTab === "status" ? "bg-white text-[#03a4ed] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Status / Situação
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !data ? null : (
        <div>
          {/* ── Tab: Cotador / Grupo ── */}
          {mainTab === "cotador" && (
            <>
              <div className="px-5 pt-3 pb-0 flex gap-2">
                <button
                  onClick={() => setSubTab("cotador")}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${subTab === "cotador" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  Por Cotador
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setSubTab("grupo")}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition ${subTab === "grupo" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    Por Grupo
                  </button>
                )}
              </div>

              {/* Por Cotador */}
              {subTab === "cotador" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-100">
                        <th className={thClass}>Cotador</th>
                        <th className={`${thClass} text-right`}>Total</th>
                        <th className={`${thClass} text-right`}>Fechadas</th>
                        <th className={`${thClass} text-right`}>Perdas</th>
                        <th className={`${thClass} text-right`}>Faturamento</th>
                        <th className={`${thClass} text-right`}>Taxa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.cotadores.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition">
                          <td className={tdClass}>
                            <div className="flex items-center gap-2.5">
                              <Avatar name={c.name} photoUrl={c.photoUrl} size={7} />
                              <span className="font-medium text-slate-800">{c.name}</span>
                            </div>
                          </td>
                          <td className={`${tdClass} text-right`}>{c.total}</td>
                          <td className={`${tdClass} text-right text-emerald-600 font-medium`}>{c.fechadas}</td>
                          <td className={`${tdClass} text-right text-red-500`}>{c.perdas}</td>
                          <td className={`${tdClass} text-right font-semibold text-slate-800`}>{fmtCur(c.faturamento)}</td>
                          <td className={`${tdClass} text-right`}>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${c.taxaConversao >= 50 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {c.taxaConversao?.toFixed(0) ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.cotadores.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum dado no período</td></tr>
                      )}
                    </tbody>
                    {data.cotadores.length > 0 && (
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">Total</td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-slate-700">{data.cotadores.reduce((a, c) => a + c.total, 0)}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-emerald-600">{data.cotadores.reduce((a, c) => a + c.fechadas, 0)}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-500">{data.cotadores.reduce((a, c) => a + c.perdas, 0)}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{fmtCur(data.cotadores.reduce((a, c) => a + c.faturamento, 0))}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}

              {/* Por Grupo */}
              {subTab === "grupo" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-100">
                        <th className={thClass}>Grupo</th>
                        <th className={`${thClass} text-right`}>Total</th>
                        <th className={`${thClass} text-right`}>Fechadas</th>
                        <th className={`${thClass} text-right`}>Perdas</th>
                        <th className={`${thClass} text-right`}>Faturamento</th>
                        <th className={`${thClass} text-right`}>Taxa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {data.grupos.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-50/60 transition">
                          <td className={tdClass}>
                            <div className="flex items-center gap-2.5">
                              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: g.cor }} />
                              <span className="font-medium text-slate-800">{g.nome}</span>
                            </div>
                          </td>
                          <td className={`${tdClass} text-right`}>{g.total}</td>
                          <td className={`${tdClass} text-right text-emerald-600 font-medium`}>{g.fechadas}</td>
                          <td className={`${tdClass} text-right text-red-500`}>{g.perdas}</td>
                          <td className={`${tdClass} text-right font-semibold text-slate-800`}>{fmtCur(g.faturamento)}</td>
                          <td className={`${tdClass} text-right`}>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${g.taxaConversao >= 50 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {g.taxaConversao?.toFixed(0) ?? 0}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {data.grupos.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">Nenhum grupo cadastrado</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── Tab: Status / Situação ── */}
          {mainTab === "status" && (
            <>
              <div className="px-5 pt-3 pb-0 flex gap-2">
                <button
                  onClick={() => setStatusTab("status")}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${statusTab === "status" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  Por Status
                </button>
                <button
                  onClick={() => setStatusTab("situacao")}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition ${statusTab === "situacao" ? "bg-[#03a4ed] text-white border-[#03a4ed]" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  Por Situação
                </button>
              </div>

              {statusTab === "status" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-100">
                        <th className={thClass}>Status</th>
                        <th className={`${thClass} text-right`}>Cotações</th>
                        <th className={`${thClass} text-right`}>%</th>
                        <th className={`${thClass} text-right`}>Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(() => {
                        const grandTotal = data.porStatus.reduce((a, r) => a + r.total, 0);
                        return data.porStatus.map((r) => (
                          <tr key={r.status} className="hover:bg-slate-50/60 transition">
                            <td className={tdClass}>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGES[r.status] || "bg-slate-100 text-slate-600"}`}>
                                {r.status}
                              </span>
                            </td>
                            <td className={`${tdClass} text-right font-semibold`}>{r.total}</td>
                            <td className={`${tdClass} text-right`}>
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-[#03a4ed] rounded-full" style={{ width: `${grandTotal ? (r.total / grandTotal) * 100 : 0}%` }} />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{grandTotal ? ((r.total / grandTotal) * 100).toFixed(0) : 0}%</span>
                              </div>
                            </td>
                            <td className={`${tdClass} text-right text-slate-500`}>{fmtCur(r.faturamento)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{data.porStatus.reduce((a, r) => a + r.total, 0)}</td>
                        <td />
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{fmtCur(data.porStatus.reduce((a, r) => a + r.faturamento, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {statusTab === "situacao" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-2">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-100">
                        <th className={thClass}>Situação</th>
                        <th className={`${thClass} text-right`}>Cotações</th>
                        <th className={`${thClass} text-right`}>%</th>
                        <th className={`${thClass} text-right`}>Faturamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {(() => {
                        const grandTotal = data.porSituacao.reduce((a, r) => a + r.total, 0);
                        return data.porSituacao.map((r) => (
                          <tr key={r.situacao} className="hover:bg-slate-50/60 transition">
                            <td className={tdClass}>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${SITUACAO_BADGES[r.situacao] || "bg-slate-100 text-slate-600"}`}>
                                {r.situacao}
                              </span>
                            </td>
                            <td className={`${tdClass} text-right font-semibold`}>{r.total}</td>
                            <td className={`${tdClass} text-right`}>
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${grandTotal ? (r.total / grandTotal) * 100 : 0}%`, background: "#8b5cf6" }} />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{grandTotal ? ((r.total / grandTotal) * 100).toFixed(0) : 0}%</span>
                              </div>
                            </td>
                            <td className={`${tdClass} text-right text-slate-500`}>{fmtCur(r.faturamento)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td className="px-4 py-2.5 text-xs font-semibold text-slate-600">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{data.porSituacao.reduce((a, r) => a + r.total, 0)}</td>
                        <td />
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-slate-800">{fmtCur(data.porSituacao.reduce((a, r) => a + r.faturamento, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
