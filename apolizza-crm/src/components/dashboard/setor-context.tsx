"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Setor = "TODOS" | "BE" | "RE";

const Ctx = createContext<{ setor: Setor; setSetor: (s: Setor) => void }>({
  setor: "TODOS",
  setSetor: () => {},
});

export function SetorProvider({ children }: { children: ReactNode }) {
  const [setor, setSetor] = useState<Setor>("TODOS");
  return <Ctx.Provider value={{ setor, setSetor }}>{children}</Ctx.Provider>;
}

export function useSetor() {
  return useContext(Ctx);
}

// Helper: adiciona ?setor= ao URLSearchParams se não for "TODOS"
export function appendSetorParam(params: URLSearchParams, setor: Setor) {
  if (setor === "BE" || setor === "RE") params.set("setor", setor);
}
