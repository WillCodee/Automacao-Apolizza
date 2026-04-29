"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import TvRankingSlide from "@/components/tv/tv-ranking-slide";
import TvMetaSlide from "@/components/tv/tv-meta-slide";
import TvMonthlySlide from "@/components/tv/tv-monthly-slide";
import TvKpisSlide from "@/components/tv/tv-kpis-slide";
import TvCclienteSlide from "@/components/tv/tv-ccliente-slide";

const MES_ARR = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const SLIDE_NAMES = ["Ranking", "Meta", "Evolucao", "KPIs", "C.Cliente"];
const SLIDE_INTERVAL = 300_000; // 5 min
const REFRESH_INTERVAL = 2_000; // 2 segundos
const FADE_DURATION = 500;
const TOTAL_SLIDES = 5;

interface TVData {
  ano: number;
  mes: string;
  kpis: {
    totalCotacoes: number;
    fechadas: number;
    perdas: number;
    emAndamento: number;
    totalAReceber: number;
    totalValorPerda: number;
    totalPremio: number;
    taxaConversao: number;
    totalRenovacoes: number;
    fechadasRenovacao: number;
    aReceberRenovacao: number;
    perdasRenovacao: number;
    totalNovas: number;
    fechadasNovas: number;
    aReceberNovas: number;
  };
  statusBreakdown: { status: string; count: number; total: number }[];
  monthlyTrend: {
    mes: string; ano: number; fechadas: number; perdas: number;
    total: number; aReceber: number;
    fechadasRenovacao: number; aReceberRenovacao: number;
    fechadasNovas: number; aReceberNovas: number;
  }[];
  cotadores: {
    userId: string; name: string; photoUrl: string | null;
    totalCotacoes: number; fechadas: number; perdas: number;
    faturamento: number; taxaConversao: number;
    totalRenovacoes: number; fechadasRenovacao: number;
    faturamentoRenovacao: number; fechadasNovas: number; faturamentoNovas: number;
  }[];
  metaMensal: number | null;
  semanas: { semana: number; novas: number; fechadas: number; perdas: number; ganho: number; ganhoAcumulado: number }[];
  ccliente: { total: number; valorPotencial: number; emConversao: number; valorConversao: number };
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  return <span className="font-mono text-slate-300" style={{ fontSize: "clamp(1rem, 1.6vw, 1.75rem)" }}>{time}</span>;
}

export default function TvPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 animate-pulse" style={{ fontSize: "clamp(1.25rem, 2vw, 2rem)" }}>Carregando...</div>
      </div>
    }>
      <TvPage />
    </Suspense>
  );
}

function TvPage() {
  const params = useSearchParams();
  const token = params.get("token");

  const [data, setData] = useState<TVData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [opacity, setOpacity] = useState(1);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [countdown, setCountdown] = useState(SLIDE_INTERVAL / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tv?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        if (res.status === 401) { setError("Token invalido"); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setError(null);
        setLastUpdate(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      }
    } catch {
      console.error("TV fetch error");
    }
  }, [token]);

  const goToSlide = useCallback((idx: number) => {
    setOpacity(0);
    setTimeout(() => {
      setSlideIndex(idx);
      setOpacity(1);
    }, FADE_DURATION);

    setCountdown(SLIDE_INTERVAL / 1000);
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);

    timerRef.current = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % TOTAL_SLIDES);
        setOpacity(1);
      }, FADE_DURATION);
      setCountdown(SLIDE_INTERVAL / 1000);
    }, SLIDE_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);
  }, []);

  const goNext = useCallback(() => {
    goToSlide((slideIndex + 1) % TOTAL_SLIDES);
  }, [slideIndex, goToSlide]);

  const goPrev = useCallback(() => {
    goToSlide((slideIndex - 1 + TOTAL_SLIDES) % TOTAL_SLIDES);
  }, [slideIndex, goToSlide]);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setOpacity(0);
      setTimeout(() => {
        setSlideIndex(prev => (prev + 1) % TOTAL_SLIDES);
        setOpacity(1);
      }, FADE_DURATION);
      setCountdown(SLIDE_INTERVAL / 1000);
    }, SLIDE_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => Math.max(prev - 1, 0));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <p className="text-red-400 text-center" style={{ fontSize: "clamp(1rem, 2.5vw, 2rem)" }}>
          Token nao fornecido. Use: /tv?token=SEU_TOKEN
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center px-4">
        <p className="text-red-400 text-center" style={{ fontSize: "clamp(1rem, 2.5vw, 2rem)" }}>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="text-slate-400 animate-pulse" style={{ fontSize: "clamp(1.25rem, 2vw, 2rem)" }}>Carregando dados...</div>
      </div>
    );
  }

  const now = new Date();
  const mesLabel = MES_ARR[now.getMonth()];
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  // Nav arrow size scales with viewport
  const arrowSize = "clamp(2.5rem, 4vw, 4.5rem)";

  return (
    <div
      className="bg-[#0f172a] text-white flex flex-col overflow-hidden select-none"
      style={{ height: "100dvh", minHeight: "600px", fontFamily: "Poppins, sans-serif" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between bg-gradient-to-r from-[#1e293b] to-[#0f172a] border-b border-slate-700/50 flex-shrink-0"
        style={{ padding: "clamp(0.4rem, 1vw, 1rem) clamp(1rem, 2.5vw, 2.5rem)" }}
      >
        <div className="flex items-center gap-3">
          <img
            src="/logo-apolizza-fundo-clear.png"
            alt="Apolizza"
            className="object-contain flex-shrink-0"
            style={{ width: "clamp(2rem, 3.5vw, 4rem)", height: "clamp(2rem, 3.5vw, 4rem)" }}
          />
          <span className="font-bold tracking-wide" style={{ fontSize: "clamp(1rem, 1.8vw, 1.75rem)" }}>
            Painel TV
          </span>
        </div>
        <div className="flex items-center" style={{ gap: "clamp(0.75rem, 2vw, 2rem)" }}>
          <span className="text-slate-400 font-medium" style={{ fontSize: "clamp(0.85rem, 1.5vw, 1.5rem)" }}>
            {mesLabel}/{data.ano}
          </span>
          <Clock />
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <div
        className="grid grid-cols-4 flex-shrink-0"
        style={{ gap: "clamp(0.4rem, 1vw, 1.25rem)", padding: "clamp(0.4rem, 0.8vw, 0.875rem) clamp(1rem, 2vw, 2.5rem)" }}
      >
        <KpiCard label="Total Cotações" value={String(data.kpis.totalCotacoes)} color="text-sky-400" />
        <KpiCard label="Fechadas" value={String(data.kpis.fechadas)} color="text-green-400" />
        <KpiCard label="Perdas" value={String(data.kpis.perdas)} color="text-red-400" />
        <KpiCard label="Faturamento" value={fmt(data.kpis.totalAReceber)} color="text-emerald-400" />
      </div>

      {/* ── Carousel ── */}
      <div
        className="flex-1 min-h-0 relative"
        style={{ padding: "0 clamp(0.75rem, 1.5vw, 2rem) clamp(0.2rem, 0.4vw, 0.5rem)", minHeight: "280px" }}
      >
        {/* Left arrow */}
        <button
          onClick={goPrev}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center transition-colors cursor-pointer"
          style={{ width: arrowSize, height: arrowSize, left: "clamp(0.2rem, 0.6vw, 0.75rem)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "clamp(0.875rem, 1.6vw, 1.75rem)", height: "clamp(0.875rem, 1.6vw, 1.75rem)" }}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {/* Right arrow */}
        <button
          onClick={goNext}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600/50 flex items-center justify-center transition-colors cursor-pointer"
          style={{ width: arrowSize, height: arrowSize, right: "clamp(0.2rem, 0.6vw, 0.75rem)" }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: "clamp(0.875rem, 1.6vw, 1.75rem)", height: "clamp(0.875rem, 1.6vw, 1.75rem)" }}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>

        <div
          className="h-full rounded-2xl bg-slate-900/50 border border-slate-800/50 overflow-hidden"
          style={{ opacity, transition: `opacity ${FADE_DURATION}ms ease-in-out` }}
        >
          {slideIndex === 0 && <TvRankingSlide cotadores={data.cotadores} />}
          {slideIndex === 1 && <TvMetaSlide metaMensal={data.metaMensal} semanas={data.semanas} />}
          {slideIndex === 2 && <TvMonthlySlide monthlyTrend={data.monthlyTrend} />}
          {slideIndex === 3 && <TvKpisSlide kpis={data.kpis} />}
          {slideIndex === 4 && <TvCclienteSlide ccliente={data.ccliente ?? { total: 0, valorPotencial: 0, emConversao: 0, valorConversao: 0 }} />}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer
        className="flex flex-wrap items-center justify-between gap-y-1 text-slate-500 flex-shrink-0"
        style={{
          padding: "clamp(0.25rem, 0.6vw, 0.625rem) clamp(1rem, 2.5vw, 2.5rem)",
          fontSize: "clamp(0.7rem, 1.1vw, 1rem)",
        }}
      >
        <span className="text-slate-600">Atualizado: {lastUpdate || "--:--"}</span>
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 justify-center">
          <div className="flex flex-wrap justify-center" style={{ gap: "clamp(0.3rem, 0.6vw, 0.625rem)" }}>
            {SLIDE_NAMES.map((name, i) => (
              <button
                key={i}
                onClick={() => goToSlide(i)}
                className={`rounded-full font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  i === slideIndex
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : "bg-slate-800/50 text-slate-500 border border-slate-700/30 hover:text-slate-300"
                }`}
                style={{
                  padding: "clamp(0.15rem, 0.35vw, 0.3rem) clamp(0.5rem, 1vw, 0.875rem)",
                  fontSize: "clamp(0.65rem, 1vw, 0.9rem)",
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <span className="font-mono text-slate-600 tabular-nums">
            {mins}:{secs.toString().padStart(2, "0")}
          </span>
        </div>
        <span className="text-slate-600">Apolizza CRM</span>
      </footer>
    </div>
  );
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div
      className="bg-slate-800/70 border border-slate-700/40 rounded-xl text-center"
      style={{ padding: "clamp(0.4rem, 0.9vw, 1rem) clamp(0.5rem, 1.2vw, 1.25rem)" }}
    >
      <p
        className="text-slate-400 uppercase tracking-wider font-medium"
        style={{ fontSize: "clamp(0.6rem, 0.9vw, 0.875rem)", marginBottom: "clamp(0.15rem, 0.35vw, 0.375rem)" }}
      >
        {label}
      </p>
      <p
        className={`font-bold leading-tight ${color}`}
        style={{ fontSize: "clamp(1rem, 2.6vw, 3rem)" }}
      >
        {value}
      </p>
    </div>
  );
}
