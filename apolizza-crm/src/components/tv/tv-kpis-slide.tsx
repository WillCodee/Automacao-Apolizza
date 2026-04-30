"use client";

interface KPIs {
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  atrasadas: number;
  totalAReceber: number;
  totalPipeline: number;
  totalAReceberTotal: number;
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
    label: "Total Cotações",
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
    label: "A Receber Total",
    getValue: k => fmt(k.totalAReceberTotal),
    getSub: k => `Pipeline + Realizado`,
    color: "text-emerald-400",
    icon: "📈",
  },
  {
    label: "Pipeline em Andamento",
    getValue: k => fmt(k.totalPipeline),
    getSub: k => `${k.totalCotacoes - k.fechadas - k.perdas} cotações ativas`,
    color: "text-cyan-400",
    icon: "🎯",
  },
  {
    label: "Faturamento Realizado",
    getValue: k => fmt(k.totalAReceber),
    getSub: k => `${fmt(k.aReceberNovas)} novas + ${fmt(k.aReceberRenovacao)} renov.`,
    color: "text-green-400",
    icon: "💰",
  },
  {
    label: "Atrasadas",
    getValue: k => String(k.atrasadas),
    getSub: () => "Prazo vencido",
    color: "text-orange-400",
    icon: "⏰",
  },
  {
    label: "Taxa de Conversão",
    getValue: k => `${Number(k.taxaConversao).toFixed(1)}%`,
    getSub: k => `${k.fechadas} de ${k.totalCotacoes}`,
    color: "text-purple-400",
    icon: "📊",
  },
  {
    label: "Prêmio s/ IOF",
    getValue: k => fmt(k.totalPremio),
    getSub: () => "Total premiado",
    color: "text-amber-400",
    icon: "🏆",
  },
];

export default function TvKpisSlide({ kpis }: { kpis: KPIs }) {
  return (
    <div className="flex flex-col h-full" style={{ padding: "14px 20px" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: 28, marginBottom: 10 }}
      >
        KPIs Detalhados
      </h2>

      <div className="flex-1 grid grid-cols-3 grid-rows-3 min-h-0" style={{ gap: 12 }}>
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center shadow-lg"
            style={{ padding: "12px 16px" }}
          >
            <span style={{ fontSize: 32, marginBottom: 4 }}>{card.icon}</span>
            <p className="text-slate-400 font-medium uppercase tracking-wider text-center" style={{ fontSize: 10, marginBottom: 4 }}>
              {card.label}
            </p>
            <p className={`font-bold leading-none ${card.color}`} style={{ fontSize: 36, marginBottom: 2 }}>
              {card.getValue(kpis)}
            </p>
            <p className="text-slate-500 text-center" style={{ fontSize: 10 }}>
              {card.getSub(kpis)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
