/**
 * Configuração centralizada de status (cores e badges)
 * Baseado nos 8 status reais do ClickUp
 */

export const STATUS_COLORS: Record<string, string> = {
  "não iniciado": "#87909e",
  "raut": "#1090e0",
  "atrasado": "#e16b16",
  "pendencia": "#f8ae00",
  "perda": "#d33d44",
  "fechado": "#008844",
  "implantando": "#ee5e99",
  "concluido ocultar": "#008844",
};

export const STATUS_BADGES: Record<string, string> = {
  "não iniciado": "bg-slate-100 text-slate-600",
  "raut": "bg-sky-50 text-[#1090e0]",
  "atrasado": "bg-orange-50 text-orange-600",
  "pendencia": "bg-amber-50 text-amber-700",
  "perda": "bg-red-50 text-red-600",
  "fechado": "bg-emerald-50 text-emerald-700",
  "implantando": "bg-pink-50 text-pink-600",
  "concluido ocultar": "bg-emerald-50 text-emerald-700",
};

// Status terminais (não devem ser alterados automaticamente)
export const TERMINAL_STATUS = ["fechado", "perda", "concluido ocultar"] as const;
