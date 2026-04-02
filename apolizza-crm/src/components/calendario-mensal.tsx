"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type CalEvent = {
  id: string;
  name: string;
  status: string;
  proximaTratativa: string | null;
  fimVigencia: string | null;
  primeiroPagamento: string | null;
  cotador: string | null;
};

type DayEvents = {
  date: number;
  tratativas: CalEvent[];
  vencimentos: CalEvent[];
  pagamentos: CalEvent[];
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function groupByDay(eventos: CalEvent[], ano: number, mes: number): DayEvents[] {
  const daysInMonth = new Date(ano, mes, 0).getDate();
  const days: DayEvents[] = Array.from({ length: daysInMonth }, (_, i) => ({
    date: i + 1,
    tratativas: [],
    vencimentos: [],
    pagamentos: [],
  }));

  for (const ev of eventos) {
    const addTo = (dateStr: string | null, list: "tratativas" | "vencimentos" | "pagamentos") => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      const day = d.getUTCDate();
      if (day >= 1 && day <= daysInMonth) {
        days[day - 1][list].push(ev);
      }
    };
    addTo(ev.proximaTratativa, "tratativas");
    addTo(ev.fimVigencia, "vencimentos");
    addTo(ev.primeiroPagamento, "pagamentos");
  }

  return days;
}

export function CalendarioMensal() {
  const today = new Date();
  const [ano, setAno] = useState(today.getFullYear());
  const [mes, setMes] = useState(today.getMonth() + 1);
  const [eventos, setEventos] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/calendario?ano=${ano}&mes=${mes}`);
    const json = await res.json();
    setEventos(json.data?.eventos || []);
    setLoading(false);
  }, [ano, mes]);

  useEffect(() => {
    fetchData();
    setSelectedDay(null);
  }, [fetchData]);

  function prevMonth() {
    if (mes === 1) { setMes(12); setAno(ano - 1); }
    else setMes(mes - 1);
  }

  function nextMonth() {
    if (mes === 12) { setMes(1); setAno(ano + 1); }
    else setMes(mes + 1);
  }

  const days = groupByDay(eventos, ano, mes);
  const firstDayOfWeek = new Date(ano, mes - 1, 1).getDay();
  const todayDate = today.getFullYear() === ano && today.getMonth() + 1 === mes ? today.getDate() : -1;

  const selectedDayData = selectedDay ? days[selectedDay - 1] : null;

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="inline-block w-8 h-8 border-3 border-[#03a4ed] border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 mt-3 text-sm">Carregando calendario...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-slate-100">
        <button
          onClick={prevMonth}
          className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          ←
        </button>
        <h2 className="text-lg font-bold text-slate-900">
          {MONTH_NAMES[mes - 1]} {ano}
        </h2>
        <button
          onClick={nextMonth}
          className="px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          →
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#03a4ed]" /> Tratativa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff695f]" /> Vencimento
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-500" /> Pagamento
        </span>
      </div>

      {/* Calendar grid — desktop */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[90px] border-b border-r border-slate-100 bg-slate-50/50" />
          ))}

          {days.map((day) => {
            const totalEvents = day.tratativas.length + day.vencimentos.length + day.pagamentos.length;
            const isToday = day.date === todayDate;
            const isSelected = day.date === selectedDay;

            return (
              <button
                key={day.date}
                onClick={() => setSelectedDay(isSelected ? null : day.date)}
                className={`min-h-[90px] border-b border-r border-slate-100 p-2 text-left hover:bg-sky-50/50 transition ${
                  isSelected ? "bg-sky-50 ring-2 ring-[#03a4ed] ring-inset" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${
                    isToday
                      ? "bg-[#03a4ed] text-white w-7 h-7 rounded-full flex items-center justify-center"
                      : "text-slate-700"
                  }`}>
                    {day.date}
                  </span>
                  {totalEvents > 0 && (
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 rounded-full px-1.5">
                      {totalEvents}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 flex-wrap">
                  {day.tratativas.length > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#03a4ed]" />
                  )}
                  {day.vencimentos.length > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ff695f]" />
                  )}
                  {day.pagamentos.length > 0 && (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile list view */}
      <div className="md:hidden space-y-2">
        {days
          .filter((d) => d.tratativas.length + d.vencimentos.length + d.pagamentos.length > 0)
          .map((day) => {
            const isSelected = day.date === selectedDay;
            const total = day.tratativas.length + day.vencimentos.length + day.pagamentos.length;
            return (
              <div key={day.date}>
                <button
                  onClick={() => setSelectedDay(isSelected ? null : day.date)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border transition min-h-[44px] ${
                    isSelected
                      ? "bg-sky-50 border-[#03a4ed]"
                      : "bg-white border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${day.date === todayDate ? "text-[#03a4ed]" : "text-slate-900"}`}>
                      {day.date}
                    </span>
                    <div className="flex gap-1">
                      {day.tratativas.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#03a4ed]" />}
                      {day.vencimentos.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-[#ff695f]" />}
                      {day.pagamentos.length > 0 && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{total} evento(s)</span>
                </button>
                {isSelected && (
                  <EventList day={day} />
                )}
              </div>
            );
          })}
        {days.every((d) => d.tratativas.length + d.vencimentos.length + d.pagamentos.length === 0) && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Nenhum evento neste mes
          </div>
        )}
      </div>

      {/* Desktop expanded day */}
      {selectedDayData && (
        <div className="hidden md:block">
          <EventList day={selectedDayData} />
        </div>
      )}
    </div>
  );
}

function EventList({ day }: { day: DayEvents }) {
  const sections: { label: string; color: string; events: CalEvent[] }[] = [
    { label: "Tratativas", color: "bg-[#03a4ed]", events: day.tratativas },
    { label: "Vencimentos", color: "bg-[#ff695f]", events: day.vencimentos },
    { label: "Pagamentos", color: "bg-emerald-500", events: day.pagamentos },
  ].filter((s) => s.events.length > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mt-2 space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Dia {day.date}</h3>
      {sections.map((s) => (
        <div key={s.label}>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-3 h-3 rounded-full ${s.color}`} />
            <span className="text-xs font-semibold text-slate-500 uppercase">{s.label}</span>
          </div>
          <div className="space-y-1">
            {s.events.map((ev) => (
              <Link
                key={`${ev.id}-${s.label}`}
                href={`/cotacoes/${ev.id}`}
                className="block px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-900 hover:text-[#03a4ed] transition min-h-[44px] flex items-center"
              >
                <span className="flex-1 truncate">{ev.name}</span>
                <span className="text-xs text-slate-400 ml-2 capitalize">{ev.status}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
