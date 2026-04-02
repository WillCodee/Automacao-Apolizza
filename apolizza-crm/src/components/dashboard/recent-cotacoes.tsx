"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Cotacao = {
  id: string;
  name: string;
  status: string;
  produto: string | null;
  aReceber: number | null;
  createdAt: string;
};

import { STATUS_BADGES } from "@/lib/status-config";
const STATUS_COLORS = STATUS_BADGES;

export function RecentCotacoes() {
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);

  useEffect(() => {
    fetch("/api/cotacoes?limit=10&page=1")
      .then((r) => r.json())
      .then((d) => setCotacoes(d.data || []));
  }, []);

  if (cotacoes.length === 0) return null;

  const fmt = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Cotacoes Recentes</h3>
        <Link href="/cotacoes" className="text-sm text-[#03a4ed] hover:text-[#0288d1] font-medium">
          Ver todas
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-5 py-3 font-medium">Nome</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium">Produto</th>
              <th className="px-5 py-3 font-medium text-right">A Receber</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cotacoes.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3">
                  <Link
                    href={`/cotacoes/${c.id}`}
                    className="font-medium text-slate-900 hover:text-[#03a4ed] transition-colors"
                  >
                    {c.name}
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${STATUS_COLORS[c.status] || "bg-slate-100 text-slate-600"}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{c.produto || "—"}</td>
                <td className="px-5 py-3 text-right font-semibold text-slate-900">{fmt(c.aReceber)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
