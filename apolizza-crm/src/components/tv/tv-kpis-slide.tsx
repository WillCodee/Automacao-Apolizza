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
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.75rem, 1.5vw, 1.75rem) clamp(1rem, 2vw, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1.25rem, 2.8vw, 3rem)", marginBottom: "clamp(0.5rem, 1vw, 1.25rem)" }}
      >
        KPIs Detalhados
      </h2>

      <div className="flex-1 grid grid-cols-3 grid-rows-2 min-h-0" style={{ gap: "clamp(0.5rem, 1.2vw, 1.5rem)" }}>
        {cards.map(card => (
          <div
            key={card.label}
            className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center shadow-lg"
            style={{ padding: "clamp(0.75rem, 1.5vw, 2rem)" }}
          >
            <span style={{ fontSize: "clamp(1.5rem, 3.5vw, 4rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.75rem)" }}>
              {card.icon}
            </span>
            <p
              className="text-slate-400 font-medium uppercase tracking-wider text-center"
              style={{ fontSize: "clamp(0.6rem, 1.1vw, 1rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.75rem)" }}
            >
              {card.label}
            </p>
            <p
              className={`font-bold leading-none ${card.color}`}
              style={{ fontSize: "clamp(1.5rem, 3.8vw, 4.5rem)", marginBottom: "clamp(0.2rem, 0.4vw, 0.5rem)" }}
            >
              {card.getValue(kpis)}
            </p>
            <p
              className="text-slate-500 text-center"
              style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)" }}
            >
              {card.getSub(kpis)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
