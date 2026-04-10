"use client";

import { useState, useEffect, useCallback } from "react";
import { STATUS_COLORS } from "@/lib/status-config";
import { CardFilter } from "./card-filter";

type StatusData = { status: string; count: number; total: number };

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function StatusBreakdown() {
  const currentYear = String(new Date().getFullYear());

  const [ano, setAno] = useState(currentYear);
  const [mes, setMes] = useState("");
  const [data, setData] = useState<StatusData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("ano", ano);
    if (mes) params.set("mes", mes);
    const res = await fetch(`/api/dashboard?${params}`);
    const json = await res.json();
    setData(json.data?.statusBreakdown ?? []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-slate-100">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Status das Cotacoes
        </h3>
        <CardFilter ano={ano} mes={mes} onChange={({ ano: a, mes: m }) => { setAno(a); setMes(m); }} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <p className="text-slate-400 text-sm py-4 text-center">Sem dados para exibir</p>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.status}>
              <div className="flex items-center justify-between text-sm mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[item.status] || "#94a3b8" }}
                  />
                  <span className="text-slate-600 capitalize">{item.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400" title={item.status.toLowerCase() === "perda" ? "Valor de Perda" : "A Receber"}>
                    {fmt(item.total)}
                  </span>
                  <span className="font-semibold text-slate-900 w-6 text-right">{item.count}</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${(item.count / maxCount) * 100}%`,
                    backgroundColor: STATUS_COLORS[item.status] || "#94a3b8",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
