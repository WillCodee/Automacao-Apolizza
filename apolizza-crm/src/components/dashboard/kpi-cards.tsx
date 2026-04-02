"use client";

type KpiData = {
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  emAndamento: number;
  totalAReceber: number;
  totalValorPerda: number;
  totalPremio: number;
  taxaConversao: number;
};

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function KpiCards({ kpis }: { kpis: KpiData }) {
  const cards = [
    {
      label: "Total Cotacoes",
      value: String(kpis.totalCotacoes),
      sub: `${kpis.fechadas} fechadas, ${kpis.perdas} perdas`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      iconBg: "bg-[#03a4ed]/10 text-[#03a4ed]",
      accent: "border-l-[#03a4ed]",
      valueColor: "text-slate-900",
    },
    {
      label: "A Receber",
      value: fmt(kpis.totalAReceber),
      sub: `Premio total: ${fmt(kpis.totalPremio)}`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: "bg-emerald-50 text-emerald-600",
      accent: "border-l-emerald-500",
      valueColor: "text-emerald-700",
    },
    {
      label: "Valor em Perda",
      value: fmt(kpis.totalValorPerda),
      sub: `${kpis.perdas} cotacao(es)`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
      iconBg: "bg-[#ff695f]/10 text-[#ff695f]",
      accent: "border-l-[#ff695f]",
      valueColor: "text-[#ff695f]",
    },
    {
      label: "Taxa de Conversao",
      value: `${kpis.taxaConversao}%`,
      sub: `${kpis.emAndamento} em andamento`,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      iconBg: "bg-violet-50 text-violet-600",
      accent: "border-l-violet-500",
      valueColor: "text-violet-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`bg-white rounded-xl border-l-4 ${card.accent} p-5 shadow-sm hover:shadow-md transition-shadow`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.iconBg}`}>
              {card.icon}
            </div>
          </div>
          <p className={`text-2xl font-bold ${card.valueColor}`}>
            {card.value}
          </p>
          <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
