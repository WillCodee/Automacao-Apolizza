"use client";

interface CclienteData {
  total: number;
  emConversao: number;
  tratativasHoje: number;
  semTratativa: number;
}

export default function TvCclienteSlide({ ccliente }: { ccliente: CclienteData }) {
  const pct = ccliente.total > 0 ? Math.round((ccliente.emConversao / ccliente.total) * 100) : 0;
  const barColor = pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const textColor = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-red-400";

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
            Total no Mês
          </p>
          <p className="font-bold text-sky-400 leading-none" style={{ fontSize: 86 }}>
            {ccliente.total}
          </p>
          <p className="text-slate-500 text-center" style={{ fontSize: 11, marginTop: 6 }}>
            cotações com situação CLIENTE
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
            tratativa nos últimos/próximos 7 dias
          </p>
        </div>

        <div className="bg-slate-800/80 border border-amber-800/40 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Tratativas Hoje
          </p>
          <p className="font-bold text-amber-400 leading-none" style={{ fontSize: 86 }}>
            {ccliente.tratativasHoje}
          </p>
          <p className="text-slate-500 text-center" style={{ fontSize: 11, marginTop: 6 }}>
            agendadas para hoje · {ccliente.semTratativa} sem agenda
          </p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl flex flex-col items-center justify-center" style={{ padding: "12px 16px" }}>
          <p className="text-slate-400 uppercase tracking-wider font-medium text-center" style={{ fontSize: 11, marginBottom: 6 }}>
            Taxa de Movimentação
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
            {ccliente.emConversao} de {ccliente.total} ativas
          </p>
        </div>

      </div>
    </div>
  );
}
