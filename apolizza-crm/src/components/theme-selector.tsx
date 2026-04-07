"use client";

import { useState, useEffect } from "react";

const THEMES = [
  {
    id: "oceano",
    name: "Oceano",
    description: "Azul vibrante com coral — tema padrão",
    primary: "#03a4ed",
    accent: "#ff695f",
    header: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    description: "Verde fresco com dourado âmbar",
    primary: "#10b981",
    accent: "#f59e0b",
    header: "linear-gradient(135deg, #064e3b 0%, #022c22 100%)",
  },
  {
    id: "violeta",
    name: "Violeta",
    description: "Roxo elegante com rosa",
    primary: "#8b5cf6",
    accent: "#ec4899",
    header: "linear-gradient(135deg, #2e1065 0%, #1e0a45 100%)",
  },
  {
    id: "pordosol",
    name: "Pôr do Sol",
    description: "Laranja caloroso com vermelho",
    primary: "#f97316",
    accent: "#ef4444",
    header: "linear-gradient(135deg, #431407 0%, #2a0c04 100%)",
  },
  {
    id: "meianoite",
    name: "Meia-Noite",
    description: "Índigo profundo com verde água",
    primary: "#6366f1",
    accent: "#14b8a6",
    header: "linear-gradient(135deg, #1e1b4b 0%, #0f0e2e 100%)",
  },
];

export function ThemeSelector() {
  const [currentTheme, setCurrentTheme] = useState("oceano");
  const [currentMode, setCurrentMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    setCurrentTheme(localStorage.getItem("apolizza-theme") || "oceano");
    setCurrentMode((localStorage.getItem("apolizza-mode") as "light" | "dark") || "light");
  }, []);

  function applyTheme(themeId: string) {
    setCurrentTheme(themeId);
    localStorage.setItem("apolizza-theme", themeId);
    document.documentElement.setAttribute("data-theme", themeId);
  }

  function applyMode(mode: "light" | "dark") {
    setCurrentMode(mode);
    localStorage.setItem("apolizza-mode", mode);
    document.documentElement.setAttribute("data-mode", mode);
  }

  return (
    <div className="space-y-6">
      {/* Modo claro/escuro */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Modo de Exibição</h2>
        <p className="text-sm text-slate-500 mb-4">Escolha entre modo claro ou escuro.</p>
        <div className="flex gap-3">
          <button
            onClick={() => applyMode("light")}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              currentMode === "light"
                ? "border-[#03a4ed] bg-[#03a4ed]/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${currentMode === "light" ? "text-[#03a4ed]" : "text-slate-700"}`}>
              Claro
            </span>
            {currentMode === "light" && (
              <span className="text-xs text-[#03a4ed] font-semibold">Ativo</span>
            )}
          </button>

          <button
            onClick={() => applyMode("dark")}
            className={`flex-1 flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              currentMode === "dark"
                ? "border-[#03a4ed] bg-[#03a4ed]/5"
                : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 shadow-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
              </svg>
            </div>
            <span className={`text-sm font-medium ${currentMode === "dark" ? "text-[#03a4ed]" : "text-slate-700"}`}>
              Escuro
            </span>
            {currentMode === "dark" && (
              <span className="text-xs text-[#03a4ed] font-semibold">Ativo</span>
            )}
          </button>
        </div>
      </div>

      {/* Paletas de cores */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Paleta de Cores</h2>
        <p className="text-sm text-slate-500 mb-4">5 combinações de cores disponíveis para o sistema.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEMES.map((theme) => {
            const isActive = currentTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => applyTheme(theme.id)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] ${
                  isActive ? "border-slate-900 shadow-md" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                {isActive && (
                  <span className="absolute top-2 right-2 w-5 h-5 bg-slate-900 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                )}

                {/* Preview header */}
                <div
                  className="w-full h-10 rounded-lg mb-3"
                  style={{ background: theme.header }}
                />

                {/* Color chips */}
                <div className="flex gap-2 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg shadow-sm"
                    style={{ background: theme.primary }}
                    title="Cor primária"
                  />
                  <div
                    className="w-8 h-8 rounded-lg shadow-sm"
                    style={{ background: theme.accent }}
                    title="Cor de destaque"
                  />
                  <div className="w-8 h-8 rounded-lg bg-slate-100 shadow-sm" title="Fundo" />
                </div>

                <p className="font-semibold text-slate-900 text-sm">{theme.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">{theme.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Pré-visualização</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              className="px-4 py-2 text-white text-sm rounded-xl font-medium"
              style={{ background: `var(--primary)` }}
            >
              Botão Primário
            </button>
            <button
              className="px-4 py-2 text-white text-sm rounded-xl font-medium"
              style={{ background: `var(--accent)` }}
            >
              Botão Destaque
            </button>
            <button className="px-4 py-2 bg-slate-100 text-slate-700 text-sm rounded-xl font-medium">
              Botão Neutro
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-3 py-1 text-xs rounded-lg font-semibold text-white" style={{ background: "var(--primary)" }}>
              Status Ativo
            </span>
            <span className="px-3 py-1 text-xs rounded-lg font-semibold text-white" style={{ background: "var(--accent)" }}>
              Alerta
            </span>
            <span className="px-3 py-1 text-xs rounded-lg bg-slate-100 text-slate-600 font-semibold">
              Neutro
            </span>
          </div>
          <div
            className="h-10 rounded-xl flex items-center px-4 text-white text-sm font-medium"
            style={{ background: `linear-gradient(135deg, var(--header-from) 0%, var(--header-to) 100%)` }}
          >
            Barra de Navegação
          </div>
        </div>
      </div>
    </div>
  );
}
