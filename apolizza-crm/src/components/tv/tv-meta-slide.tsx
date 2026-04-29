"use client";

interface Semana {
  semana: number;
  novas: number;
  fechadas: number;
  perdas: number;
  ganho: number;
  ganhoAcumulado: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function ThermometerSVG({ pct, color }: { pct: number; color: string }) {
  const clampedPct = Math.min(pct, 120);
  const fillHeight = Math.min((clampedPct / 120) * 240, 240);
  return (
    <svg viewBox="0 0 100 340" className="w-auto mx-auto" style={{ height: 400 }}>
      <rect x="35" y="20" width="30" height="260" rx="15" fill="#1e293b" stroke="#334155" strokeWidth="2" />
      <rect
        x="37"
        y={280 - fillHeight}
        width="26"
        height={fillHeight}
        rx="13"
        fill={color}
        className="transition-all duration-1000"
      />
      <circle cx="50" cy="295" r="30" fill={color} className="transition-all duration-1000" />
      <circle cx="50" cy="295" r="22" fill="#0f172a" />
      <text x="50" y="302" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">
        {pct.toFixed(0)}%
      </text>
      {[0, 25, 50, 75, 100].map(mark => {
        const y = 280 - (mark / 120) * 240;
        return (
          <g key={mark}>
            <line x1="68" y1={y} x2="78" y2={y} stroke="#475569" strokeWidth="1.5" />
            <text x="82" y={y + 4} fill="#94a3b8" fontSize="10">{mark}%</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function TvMetaSlide({ metaMensal, semanas }: { metaMensal: number | null; semanas: Semana[] }) {
  if (metaMensal === null || metaMensal === 0) {
    return (
      <div className="flex items-center justify-center h-full px-4">
        <p className="text-slate-400 font-semibold text-center" style={{ fontSize: 32 }}>
          Meta mensal não definida
        </p>
      </div>
    );
  }

  const totalAtingido = semanas.length > 0 ? semanas[semanas.length - 1].ganhoAcumulado : 0;
  const pct = (totalAtingido / metaMensal) * 100;
  const faltam = Math.max(metaMensal - totalAtingido, 0);
  const batida = pct >= 100;

  const now = new Date();
  const weekNum = Math.min(Math.ceil(now.getDate() / 7), 4);
  const semanaAtual = semanas.find(s => s.semana === weekNum);

  const color = pct >= 100 ? "#22c55e" : pct >= 60 ? "#03a4ed" : "#ef4444";

  return (
    <div
      className="flex items-center justify-center h-full"
      style={{ gap: 40, padding: "14px 32px" }}
    >
      <div className="flex flex-col" style={{ gap: 14, width: 200 }}>
        <MetaCard label="Meta Mensal" value={fmt(metaMensal)} color="text-slate-300" />
        <MetaCard label="Total Atingido" value={fmt(totalAtingido)} sub={`${pct.toFixed(1)}%`} color="text-sky-400" />
      </div>

      <div className="flex flex-col items-center flex-shrink-0">
        <ThermometerSVG pct={pct} color={color} />
        {batida && (
          <div className="px-4 py-1.5 bg-green-600/20 border border-green-500/40 rounded-xl" style={{ marginTop: 10 }}>
            <span className="text-green-400 font-bold tracking-wider" style={{ fontSize: 22 }}>
              META BATIDA!
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col" style={{ gap: 14, width: 200 }}>
        <MetaCard label="Faltam" value={fmt(faltam)} color={batida ? "text-green-400" : "text-orange-400"} />
        <MetaCard
          label={`Semana ${weekNum}`}
          value={fmt(semanaAtual?.ganho ?? 0)}
          sub={`${semanaAtual?.fechadas ?? 0} fechadas`}
          color="text-purple-400"
        />
      </div>
    </div>
  );
}

function MetaCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl" style={{ padding: 16 }}>
      <p className="text-slate-400 font-medium" style={{ fontSize: 12, marginBottom: 4 }}>
        {label}
      </p>
      <p className={`font-bold leading-tight ${color}`} style={{ fontSize: 26 }}>
        {value}
      </p>
      {sub && (
        <p className="text-slate-400" style={{ fontSize: 11, marginTop: 3 }}>
          {sub}
        </p>
      )}
    </div>
  );
}
