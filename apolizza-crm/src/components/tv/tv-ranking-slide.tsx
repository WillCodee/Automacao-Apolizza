"use client";

interface Cotador {
  userId: string;
  name: string;
  photoUrl: string | null;
  totalCotacoes: number;
  fechadas: number;
  perdas: number;
  faturamento: number;
  taxaConversao: number;
  totalRenovacoes: number;
  fechadasRenovacao: number;
  faturamentoRenovacao: number;
  fechadasNovas: number;
  faturamentoNovas: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

// ── Mini termômetro horizontal ────────────────────────────────────────────────
function MiniMeta({ faturamento, metaValor }: { faturamento: number; metaValor: number | null }) {
  if (!metaValor || metaValor === 0) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ gap: 2 }}>
        <p className="text-slate-600 text-center" style={{ fontSize: 12 }}>sem meta</p>
      </div>
    );
  }

  const pct = Math.min((faturamento / metaValor) * 100, 120);
  const barPct = Math.min(pct, 100);
  const color = pct >= 100 ? "#22c55e" : pct >= 60 ? "#03a4ed" : "#ef4444";

  return (
    <div className="flex flex-col items-center" style={{ gap: 4, width: "100%" }}>
      {/* Barra */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: 10, background: "#1e293b", border: "1px solid #334155" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${barPct}%`,
            background: color,
            transition: "width 1s ease-in-out",
          }}
        />
      </div>
      {/* Percentual */}
      <p className="font-bold tabular-nums" style={{ fontSize: 20, color, lineHeight: 1 }}>
        {pct.toFixed(0)}%
      </p>
      {/* Meta */}
      <p className="text-slate-500 tabular-nums" style={{ fontSize: 11, lineHeight: 1 }}>
        {fmt(metaValor)}
      </p>
    </div>
  );
}

const COLS = "28px 50px 1fr 90px 90px 90px 155px 80px 140px";

export default function TvRankingSlide({
  cotadores,
  metasCotadores,
}: {
  cotadores: Cotador[];
  metasCotadores: { userId: string; metaValor: number }[];
}) {
  const top = cotadores.slice(0, 10);
  const maxFat = Math.max(...top.map(c => c.faturamento), 1);

  const metaMap = new Map(metasCotadores.map(m => [m.userId, m.metaValor]));

  return (
    <div className="flex flex-col h-full" style={{ padding: "14px 20px" }}>
      <h2
        className="font-bold text-white text-center tracking-wide flex-shrink-0"
        style={{ fontSize: 38, marginBottom: 12 }}
      >
        Ranking Cotadores
      </h2>

      <div className="flex-1 flex flex-col overflow-hidden" style={{ gap: 5 }}>
        {/* Header */}
        <div
          className="grid items-center text-slate-400 uppercase tracking-wider font-semibold flex-shrink-0"
          style={{ gridTemplateColumns: COLS, gap: 8, padding: "0 12px", fontSize: 13 }}
        >
          <span>#</span>
          <span></span>
          <span>Nome</span>
          <span className="text-right">Fechadas</span>
          <span className="text-right text-red-400">Perdas</span>
          <span className="text-right text-sky-400">Andamento</span>
          <span className="text-right">Faturamento</span>
          <span className="text-right">Taxa</span>
          <span className="text-center">Meta</span>
        </div>

        {top.map((c, i) => {
          const pct = (c.faturamento / maxFat) * 100;
          const isFirst = i === 0;
          const emAndamento = Math.max(c.totalCotacoes - c.fechadas - c.perdas, 0);
          const metaValor = metaMap.get(c.userId) ?? null;

          return (
            <div
              key={c.userId}
              className={`grid items-center relative overflow-hidden rounded-xl flex-1 min-h-0 ${
                isFirst
                  ? "bg-gradient-to-r from-yellow-900/30 to-yellow-800/10 border border-yellow-600/40"
                  : "bg-slate-800/60"
              }`}
              style={{ gridTemplateColumns: COLS, gap: 8, padding: "8px 12px" }}
            >
              {/* Barra de faturamento relativo */}
              <div
                className="absolute inset-y-0 left-0 bg-sky-500/10 rounded-xl transition-all"
                style={{ width: `${pct}%` }}
              />

              {/* # */}
              <span
                className={`relative z-10 font-bold ${isFirst ? "text-yellow-400" : "text-slate-400"}`}
                style={{ fontSize: 30 }}
              >
                {i + 1}
              </span>

              {/* Avatar */}
              <div className="relative z-10 flex-shrink-0">
                {c.photoUrl ? (
                  <img
                    src={c.photoUrl}
                    alt={c.name}
                    className={`rounded-full object-cover ${isFirst ? "ring-2 ring-yellow-500" : ""}`}
                    style={{ width: 44, height: 44 }}
                  />
                ) : (
                  <div
                    className={`rounded-full flex items-center justify-center font-bold ${
                      isFirst ? "bg-yellow-600 text-white" : "bg-slate-600 text-slate-300"
                    }`}
                    style={{ width: 44, height: 44, fontSize: 15 }}
                  >
                    {initials(c.name)}
                  </div>
                )}
              </div>

              {/* Nome */}
              <span className="relative z-10 text-white font-semibold truncate" style={{ fontSize: 22 }}>
                {c.name}
              </span>

              {/* Fechadas */}
              <span className="relative z-10 text-right text-green-400 font-bold" style={{ fontSize: 28 }}>
                {c.fechadas}
              </span>

              {/* Perdas */}
              <span className="relative z-10 text-right text-red-400 font-bold" style={{ fontSize: 28 }}>
                {c.perdas}
              </span>

              {/* Em Andamento */}
              <span className="relative z-10 text-right text-sky-400 font-semibold" style={{ fontSize: 28 }}>
                {emAndamento}
              </span>

              {/* Faturamento */}
              <span className="relative z-10 text-right text-emerald-400 font-bold" style={{ fontSize: 20 }}>
                {fmt(c.faturamento)}
              </span>

              {/* Taxa */}
              <span className="relative z-10 text-right text-slate-300 font-semibold" style={{ fontSize: 19 }}>
                {Number(c.taxaConversao).toFixed(1)}%
              </span>

              {/* Meta termômetro */}
              <div className="relative z-10 flex items-center justify-center">
                <MiniMeta faturamento={c.faturamento} metaValor={metaValor} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
