"use client";

import { useState } from "react";
import { UsersList } from "./users-list";
import { GruposUsuarios } from "./grupos-usuarios";

export function UsuariosPageClient() {
  const [tab, setTab] = useState<"usuarios" | "grupos">("usuarios");

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("usuarios")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "usuarios"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setTab("grupos")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "grupos"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Grupos
        </button>
      </div>

      {tab === "usuarios" ? <UsersList /> : <GruposUsuarios />}
    </div>
  );
}
