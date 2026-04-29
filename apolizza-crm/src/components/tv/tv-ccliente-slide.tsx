"use client";

interface CclienteData {
  total: number;
  valorPotencial: number;
  emConversao: number;
  valorConversao: number;
}

function fmt(v: number) {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });
}

export default function TvCclienteSlide({ ccliente }: { ccliente: CclienteData }) {
  const pct = ccliente.total > 0 ? Math.round((ccliente.emConversao / ccliente.total) * 100) : 0;
  const barColor = pct >= 50 ? "#22c55e" : pct >= 25 ? "#f59e0b" : "#ef4444";
  const textColor = pct >= 50 ? "text-emerald-400" : pct >= 25 ? "text-amber-400" : "text-red-400";

  return (
    <div className="flex flex-col h-full" style={{ padding: "clamp(0.75rem, 1.5vw, 1.75rem) clamp(1rem, 2vw, 2.5rem)" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: "clamp(1.25rem, 2.8vw, 3rem)", marginBottom: "clamp(0.5rem, 1vw, 1.25rem)" }}
      >
        C.Cliente — Conversões em Andamento
      </h2>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 min-h-0" style={{ gap: "clamp(0.75rem, 1.5vw, 2rem)" }}>

        {/* Total C.Cliente */}
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center"
             style={{ padding: "clamp(0.75rem, 1.5vw, 2rem)" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center"
             style={{ fontSize: "clamp(0.6rem, 1.1vw, 1rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.5rem)" }}>
            Total C.Cliente
          </p>
          <p className="font-bold text-sky-400 leading-none"
             style={{ fontSize: "clamp(2.5rem, 6vw, 7rem)" }}>
            {ccliente.total}
          </p>
          <p className="text-slate-500 text-center"
             style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)", marginTop: "clamp(0.2rem, 0.4vw, 0.5rem)" }}>
            cotações aguardando cliente
          </p>
        </div>

        {/* Em Conversão */}
        <div className="bg-slate-800/80 border border-emerald-800/40 rounded-2xl flex flex-col items-center justify-center"
             style={{ padding: "clamp(0.75rem, 1.5vw, 2rem)" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center"
             style={{ fontSize: "clamp(0.6rem, 1.1vw, 1rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.5rem)" }}>
            Em Conversão
          </p>
          <p className="font-bold text-emerald-400 leading-none"
             style={{ fontSize: "clamp(2.5rem, 6vw, 7rem)" }}>
            {ccliente.emConversao}
          </p>
          <p className="text-emerald-700 text-center"
             style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)", marginTop: "clamp(0.2rem, 0.4vw, 0.5rem)" }}>
            ativas nos últimos 7 dias
          </p>
        </div>

        {/* Potencial Total */}
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center"
             style={{ padding: "clamp(0.75rem, 1.5vw, 2rem)" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center"
             style={{ fontSize: "clamp(0.6rem, 1.1vw, 1rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.5rem)" }}>
            Potencial Total
          </p>
          <p className="font-bold text-amber-400 leading-none"
             style={{ fontSize: "clamp(1.5rem, 3.8vw, 4.5rem)" }}>
            {fmt(ccliente.valorPotencial)}
          </p>
          <p className="text-slate-500 text-center"
             style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)", marginTop: "clamp(0.2rem, 0.4vw, 0.5rem)" }}>
            valor esperado (a receber)
          </p>
        </div>

        {/* Taxa de Conversão */}
        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center"
             style={{ padding: "clamp(0.75rem, 1.5vw, 2rem)" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center"
             style={{ fontSize: "clamp(0.6rem, 1.1vw, 1rem)", marginBottom: "clamp(0.25rem, 0.5vw, 0.5rem)" }}>
            Taxa de Conversão
          </p>
          <p className={`font-bold leading-none ${textColor}`}
             style={{ fontSize: "clamp(2.5rem, 6vw, 7rem)" }}>
            {pct}%
          </p>

          {/* Progress bar */}
          <div className="w-full bg-slate-700 rounded-full overflow-hidden"
               style={{ height: "clamp(0.4rem, 0.8vw, 0.8rem)", margin: "clamp(0.4rem, 0.8vw, 0.8rem) 0" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
            />
          </div>

          <p className="text-slate-500 text-center"
             style={{ fontSize: "clamp(0.65rem, 1.1vw, 1rem)" }}>
            {fmt(ccliente.valorConversao)} em negociação ativa
          </p>
        </div>

      </div>
    </div>
  );
}
