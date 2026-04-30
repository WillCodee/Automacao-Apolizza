"use client";

import { useSetor, type Setor } from "./setor-context";

const OPTS: { value: Setor; label: string; icon: string }[] = [
  { value: "TODOS", label: "Todos", icon: "📊" },
  { value: "BE",    label: "Benefícios", icon: "🏥" },
  { value: "RE",    label: "Ramos Elementares", icon: "🚗" },
];

export function SetorToggle() {
  const { setor, setSetor } = useSetor();
  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
      {OPTS.map((o) => (
        <button
          key={o.value}
          onClick={() => setSetor(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
            setor === o.value
              ? "bg-white text-[#03a4ed] shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span className="mr-1.5">{o.icon}</span>
          {o.label}
        </button>
      ))}
    </div>
  );
}
