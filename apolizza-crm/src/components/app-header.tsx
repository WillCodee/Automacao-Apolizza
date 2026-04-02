"use client";

import { useState } from "react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

type AppHeaderProps = {
  userName: string;
  userRole: "admin" | "cotador";
  activePage?: "dashboard" | "cotacoes" | "usuarios" | "status-config" | "renovacoes" | "relatorios" | "calendario" | "tarefas";
};

export function AppHeader({ userName, userRole, activePage }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { href: string; label: string; key: string }[] = [
    { href: "/dashboard", label: "Dashboard", key: "dashboard" },
    { href: "/cotacoes", label: "Cotacoes", key: "cotacoes" },
    { href: "/cotacoes/new", label: "+ Nova Cotacao", key: "new" },
    { href: "/tarefas", label: "Tarefas", key: "tarefas" },
    { href: "/renovacoes", label: "Renovacoes", key: "renovacoes" },
    { href: "/calendario", label: "Calendario", key: "calendario" },
  ];

  if (userRole === "admin") {
    navItems.push({ href: "/relatorios", label: "Relatorios", key: "relatorios" });
    navItems.push({ href: "/usuarios", label: "Usuarios", key: "usuarios" });
    navItems.push({ href: "/status-config", label: "Status", key: "status-config" });
  }

  return (
    <header className="bg-apolizza-header shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-0">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-apolizza-gradient flex items-center justify-center">
                <svg className="w-4.5 h-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">Apolizza</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = activePage === item.key;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* User info + Hamburger */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-sm font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white leading-tight">{userName}</p>
                <p className={`text-xs leading-tight ${
                  userRole === "admin" ? "text-[#ff695f]" : "text-[#03a4ed]"
                }`}>
                  {userRole}
                </p>
              </div>
            </div>
            <SignOutButton />

            {/* Hamburger menu button - mobile only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10">
          <nav className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = activePage === item.key;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-all min-h-[44px] flex items-center ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
