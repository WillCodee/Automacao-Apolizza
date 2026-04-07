"use client";

import { useEffect } from "react";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const theme = localStorage.getItem("apolizza-theme") || "oceano";
    const mode = localStorage.getItem("apolizza-mode") || "light";
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", mode);
  }, []);

  return <>{children}</>;
}
