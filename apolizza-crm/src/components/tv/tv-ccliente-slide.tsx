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
    <div className="flex flex-col h-full" style={{ padding: "14px 20px" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: 28, marginBottom: 10 }}
      >
        C.Cliente — Conversões em Andamento
      </h2>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 min-h-0" style={{ gap: 14 }}>

        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Total C.Cliente
          </p>
          <p className="font-bold text-sky-400 leading-none" style={{ fontSize: 86 }}>
            {ccliente.total}
          </p>
          <p className="text-slate-500 text-center" style={{ fontSize: 11, marginTop: 6 }}>
            cotações aguardando cliente
          </p>
        </div>

        <div className="bg-slate-800/80 border border-emerald-800/40 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Em Conversão
          </p>
          <p className="font-bold text-emerald-400 leading-none" style={{ fontSize: 86 }}>
            {ccliente.emConversao}
          </p>
          <p className="text-emerald-700 text-center" style={{ fontSize: 11, marginTop: 6 }}>
            ativas nos últimos 7 dias
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Potencial Total
          </p>
          <p className="font-bold text-amber-400 leading-none" style={{ fontSize: 48 }}>
            {fmt(ccliente.valorPotencial)}
          </p>
          <p className="text-slate-500 text-center" style={{ fontSize: 11, marginTop: 6 }}>
            valor esperado (a receber)
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Taxa de Conversão
          </p>
          <p className={`font-bold leading-none ${textColor}`} style={{ fontSize: 86 }}>
            {pct}%
          </p>
          <div className="w-full bg-slate-700 rounded-full overflow-hidden" style={{ height: 8, margin: "8px 0" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-slate-500 text-center" style={{ fontSize: 11 }}>
            {fmt(ccliente.valorConversao)} em negociação ativa
          </p>
        </div>

      </div>
    </div>
  );
}
