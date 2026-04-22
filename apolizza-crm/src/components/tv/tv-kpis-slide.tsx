"use client";

interface KPIs {
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  totalAReceber: number;
  totalValorPerda: number;
  totalPremio: number;
  taxaConversao: number;
  totalRenovacoes: number;
  fechadasRenovacao: number;
  aReceberRenovacao: number;
  totalNovas: number;
  fechadasNovas: number;
  aReceberNovas: number;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

const cards: { label: string; getValue: (k: KPIs) => string; getSub: (k: KPIs) => string; color: string; icon: string }[] = [
  {
    label: "Total Cotacoes",
    getValue: k => String(k.totalCotacoes),
    getSub: k => `${k.totalNovas} novas + ${k.totalRenovacoes} renov.`,
    color: "text-sky-400",
    icon: "📋",
  },
  {
    label: "Fechadas",
    getValue: k => String(k.fechadas),
    getSub: k => `${k.fechadasNovas} novas + ${k.fechadasRenovacao} renov.`,
    color: "text-green-400",
    icon: "✅",
  },
  {
    label: "Perdas",
    getValue: k => String(k.perdas),
    getSub: k => fmt(k.totalValorPerda),
    color: "text-red-400",
    icon: "❌",
  },
  {
    label: "Faturamento Total",
    getValue: k => fmt(k.totalAReceber),
    getSub: k => `${fmt(k.aReceberNovas)} novas + ${fmt(k.aReceberRenovacao)} renov.`,
    color: "text-emerald-400",
    icon: "💰",
  },
  {
    label: "Taxa de Conversao",
    getValue: k => `${Number(k.taxaConversao).toFixed(1)}%`,
    getSub: k => `${k.fechadas} de ${k.totalCotacoes}`,
    color: "text-purple-400",
    icon: "📊",
  },
  {
    label: "Premio s/ IOF",
    getValue: k => fmt(k.totalPremio),
    getSub: () => "Total premiado",
    color: "text-amber-400",
    icon: "🏆",
  },
];

export default function TvKpisSlide({ kpis }: { kpis: KPIs }) {
  return (
    <div className="flex flex-col h-full px-6 py-4">
      <h2 className="text-2xl font-bold text-white mb-4 text-center tracking-wide">
        KPIs Detalhados
      </h2>

      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-4">
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-slate-800/80 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center justify-center shadow-lg"
          >
            <span className="text-3xl mb-2">{card.icon}</span>
            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider mb-2">
              {card.label}
            </p>
            <p className={`text-4xl font-bold ${card.color} mb-1`}>
              {card.getValue(kpis)}
            </p>
            <p className="text-sm text-slate-500">
              {card.getSub(kpis)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
