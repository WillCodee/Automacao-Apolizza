"use client";

import { MES_OPTIONS, ANO_OPTIONS } from "@/lib/constants";

type Props = {
  ano: string;
  mes: string;
  onChange: (v: { ano: string; mes: string }) => void;
};

export function CardFilter({ ano, mes, onChange }: Props) {
  return (
    <div className="flex gap-1">
      <select
        value={ano}
        onChange={(e) => onChange({ ano: e.target.value, mes })}
        className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
      >
        {ANO_OPTIONS.map((a) => (
          <option key={a} value={String(a)}>{a}</option>
        ))}
      </select>
      <select
        value={mes}
        onChange={(e) => onChange({ ano, mes: e.target.value })}
        className="px-2 py-1 border border-slate-200 rounded-lg text-xs text-slate-700 bg-white focus:ring-2 focus:ring-[#03a4ed] outline-none transition"
      >
        <option value="">Todos</option>
        {MES_OPTIONS.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
    </div>
  );
}
