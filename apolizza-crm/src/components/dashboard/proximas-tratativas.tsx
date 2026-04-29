"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_BADGES } from "@/lib/status-config";

type Tratativa = {
  id: string;
  name: string;
  status: string;
  produto: string | null;
  seguradora: string | null;
  proximaTratativa: string;
  priority: string;
};

function formatDate(dateStr: string) {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  const formatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

  if (diff === 0) return { label: `Hoje · ${formatted}`, urgent: true };
  if (diff === 1) return { label: `Amanhã · ${formatted}`, urgent: true };
  if (diff <= 3) return { label: `Em ${diff} dias · ${formatted}`, urgent: true };
  return { label: formatted, urgent: false };
}

const PRIORITY_DOT: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-orange-400",
  normal: "bg-blue-400",
  baixa: "bg-slate-300",
};

export function ProximasTratativas() {
  const [items, setItems] = useState<Tratativa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/proximas-tratativas")
      .then((r) => r.json())
      .then((d) => setItems(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📋</span>
          <h2 className="font-semibold text-slate-900 text-base">Próximas Tratativas</h2>
          {items.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-[#03a4ed] text-white text-xs font-medium">
              {items.length}
            </span>
          )}
        </div>
        <Link
          href="/cotacoes"
          className="text-xs text-[#03a4ed] hover:text-[#0288d1] font-medium transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {loading ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400 text-sm">
          Nenhuma tratativa agendada
        </div>
      ) : (
        <ul className="divide-y divide-slate-50">
          {items.map((item) => {
            const { label, urgent } = formatDate(item.proximaTratativa);
            return (
              <li key={item.id}>
                <Link
                  href={`/cotacoes/${item.id}?from=dashboard`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
                >
                  {/* Priority dot */}
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[item.priority] || "bg-slate-300"}`}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate group-hover:text-[#03a4ed] transition-colors">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {[item.produto, item.seguradora].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>

                  {/* Status + date */}
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        urgent
                          ? "bg-red-50 text-red-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {label}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded capitalize ${
                        STATUS_BADGES[item.status] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
