"use client";

import Link from "next/link";

type CotadorData = {
  userId: string;
  name: string;
  photoUrl?: string;
  totalCotacoes: number;
  fechadas: number;
  faturamento: number;
  taxaConversao: number;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Avatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-12 h-12 rounded-full object-cover ring-2 ring-white shadow-sm"
      />
    );
  }

  return (
    <div className="w-12 h-12 rounded-full bg-[#03a4ed] flex items-center justify-center text-white text-sm font-bold ring-2 ring-white shadow-sm">
      {initials}
    </div>
  );
}

export function CotadoresTable({ data }: { data: CotadorData[] }) {
  return (
    <div className="space-y-4">
      <div className="px-1">
        <h3 className="text-sm font-semibold text-slate-900">
          Desempenho por Cotador
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((c) => {
          const conversao = c.taxaConversao ?? 0;
          return (
            <Link
              href={`/cotacoes?assignee=${c.userId}`}
              key={c.userId}
              className="block bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:shadow-md hover:border-[#03a4ed]/30 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={c.name} photoUrl={c.photoUrl} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {c.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {c.totalCotacoes} cotacao{c.totalCotacoes !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="text-lg font-bold text-slate-900">
                    {c.totalCotacoes}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Fechadas</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {c.fechadas}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-slate-500">Faturamento</p>
                  <p className="text-lg font-bold text-slate-900">
                    {fmt(c.faturamento)}
                  </p>
                </div>
              </div>

              {/* Progress bar de conversao */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-500">Conversao</p>
                  <span
                    className={`text-xs font-semibold ${
                      conversao >= 50
                        ? "text-emerald-600"
                        : conversao >= 25
                        ? "text-amber-600"
                        : "text-[#ff695f]"
                    }`}
                  >
                    {conversao}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      conversao >= 50
                        ? "bg-emerald-500"
                        : conversao >= 25
                        ? "bg-amber-400"
                        : "bg-[#ff695f]"
                    }`}
                    style={{ width: `${Math.min(conversao, 100)}%` }}
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
