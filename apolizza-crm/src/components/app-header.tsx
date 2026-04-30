"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { SignOutButton } from "./sign-out-button";

function useNotifCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/notificacoes/count");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setCount(json.data?.count ?? 0);
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return count;
}

type ActivePage =
  | "inicio"
  | "dashboard"
  | "tv"
  | "cotacoes"
  | "pedidos"
  | "usuarios"
  | "status-config"
  | "situacao-config"
  | "renovacoes"
  | "relatorios"
  | "indicadores"
  | "calendario"
  | "tarefas"
  | "tema"
  | "metas-admin"
  | "notificacoes"
  | "base-conhecimento"
  | "auditoria";

type AppHeaderProps = {
  userName: string;
  userRole: "admin" | "cotador" | "proprietario";
  userPhoto?: string | null;
  activePage?: ActivePage;
};

type NavItem = { href: string; label: string; key: string; icon: React.ReactNode; badge?: number };
type NavGroup = { label: string; key: string; items: NavItem[] };

function DropdownGroup({
  group,
  activePage,
  isOpen,
  onToggle,
  onClose,
}: {
  group: NavGroup;
  activePage?: ActivePage;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isGroupActive = group.items.some((i) => i.key === activePage);
  const groupBadgeTotal = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);

  const handleOutside = useCallback(
    (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, handleOutside]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all select-none whitespace-nowrap ${
          isGroupActive || isOpen
            ? "bg-white/15 text-white"
            : "text-slate-300 hover:bg-white/10 hover:text-white"
        }`}
      >
        {group.label}
        {groupBadgeTotal > 0 && (
          <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff695f] text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {groupBadgeTotal > 99 ? "99+" : groupBadgeTotal}
          </span>
        )}
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50">
          {group.items.map((item) => {
            const isActive = activePage === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-[#03a4ed]/10 text-[#03a4ed] font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-[#03a4ed]" : "text-slate-400"}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {(item.badge ?? 0) > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff695f] text-white text-[10px] font-bold flex items-center justify-center leading-none">
                    {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconList = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const IconPlus = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
  </svg>
);
const IconRefresh = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconTasks = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);
const IconCalendar = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconChart = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);
const IconUsers = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const IconGear = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const IconTag = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const IconPalette = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);
const IconTarget = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="6" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconBell = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const IconBriefcase = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
  </svg>
);
const IconBook = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const IconShoppingCart = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.5 6H19" />
  </svg>
);
const IconTv = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4" />
  </svg>
);

// ─── Main Header ──────────────────────────────────────────────────────────────

export function AppHeader({ userName, userRole, userPhoto, activePage }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileSubMenu, setMobileSubMenu] = useState<string | null>(null);
  const notifCount = useNotifCount();

  // Lock body scroll when the full-screen mobile overlay is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  function toggleGroup(key: string) {
    setOpenGroup((prev) => (prev === key ? null : key));
  }

  function closeMobile() {
    setMobileMenuOpen(false);
    setMobileSubMenu(null);
  }

  // Dashboard group with Sessão TV — visible for admin/proprietario only
  const dashboardGroup: NavGroup | null = userRole !== "cotador" ? {
    label: "Dashboard",
    key: "dashboard-group",
    items: [
      { href: "/dashboard", label: "Dashboard", key: "dashboard", icon: IconChart },
      { href: "/tv?token=apolizza-tv-2026-secret", label: "Sessão TV", key: "tv", icon: IconTv },
    ],
  } : null;

  const groups: NavGroup[] = [
    {
      label: "Cotações",
      key: "cotacoes-group",
      items: [
        { href: "/cotacoes", label: "Lista de Cotações", key: "cotacoes", icon: IconList },
        { href: "/cotacoes/new", label: "Nova Cotação", key: "new", icon: IconPlus },
        { href: "/cotacoes/pedidos", label: "Novo Pedido", key: "pedidos", icon: IconShoppingCart },
        { href: "/renovacoes", label: "Renovações", key: "renovacoes", icon: IconRefresh },
      ],
    },
    {
      label: "Operações",
      key: "operacoes-group",
      items: [
        { href: "/tarefas", label: "Tarefas", key: "tarefas", icon: IconTasks },
        { href: "/calendario", label: "Calendário", key: "calendario", icon: IconCalendar },
        ...(userRole === "cotador"
          ? [{ href: "/administracao/notificacoes", label: "Notificações", key: "notificacoes" as ActivePage, icon: IconBell, badge: notifCount > 0 ? notifCount : undefined }]
          : []),
      ],
    },
  ];

  if (userRole === "admin" || userRole === "proprietario") {
    const adminItems: NavItem[] = [
      ...(userRole === "proprietario" ? [{ href: "/relatorios", label: "Relatórios", key: "relatorios" as ActivePage, icon: IconChart }] : []),
      ...((userRole === "proprietario" || userRole === "admin") ? [{ href: "/indicadores", label: "Indicadores", key: "indicadores" as ActivePage, icon: IconChart }] : []),
      { href: "/administracao/notificacoes", label: "Notificações", key: "notificacoes", icon: IconBell, badge: notifCount > 0 ? notifCount : undefined },
      { href: "/configuracoes/auditoria", label: "Auditoria", key: "auditoria", icon: IconBriefcase },
    ];
    if (userRole === "proprietario") {
      adminItems.push({ href: "/administracao/metas", label: "Cadastro de Metas", key: "metas-admin", icon: IconTarget });
    }
    groups.push({ label: "Administração", key: "admin-group", items: adminItems });
  }

  if (userRole === "proprietario") {
    groups.push({
      label: "Configurações",
      key: "config-group",
      items: [
        { href: "/situacao-config", label: "Config. Situação", key: "situacao-config", icon: IconTag },
        { href: "/status-config", label: "Config. Status", key: "status-config", icon: IconGear },
        { href: "/usuarios", label: "Usuários", key: "usuarios", icon: IconUsers },
        { href: "/configuracoes/tema", label: "Tema", key: "tema", icon: IconPalette },
      ],
    });
  }

  // All groups including the dashboard group — used for mobile sub-menu lookup
  const allGroups: NavGroup[] = dashboardGroup ? [dashboardGroup, ...groups] : groups;

  return (
    <>
      <header className="bg-apolizza-header shadow-lg print:hidden relative z-40">
        <div className="max-w-7xl mx-auto px-4 py-0">
          <div className="flex items-center justify-between h-16 gap-3">

            {/* Logo + Desktop Nav */}
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Link href="/inicio" className="flex items-center flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo-apolizza-fundo-clear.png" alt="Apolizza" className="h-10 w-auto object-contain" />
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center gap-1 min-w-0">
                <Link
                  href="/inicio"
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activePage === "inicio" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  Início
                </Link>

                {/* Dashboard dropdown with Sessão TV */}
                {dashboardGroup && (
                  <DropdownGroup
                    group={dashboardGroup}
                    activePage={activePage}
                    isOpen={openGroup === "dashboard-group"}
                    onToggle={() => toggleGroup("dashboard-group")}
                    onClose={() => setOpenGroup(null)}
                  />
                )}

                <Link
                  href="/base-conhecimento"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activePage === "base-conhecimento" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {IconBook}
                  <span className="hidden xl:inline">Base de Conhecimento</span>
                  <span className="xl:hidden">Base</span>
                </Link>

                {groups.map((group) => (
                  <DropdownGroup
                    key={group.key}
                    group={group}
                    activePage={activePage}
                    isOpen={openGroup === group.key}
                    onToggle={() => toggleGroup(group.key)}
                    onClose={() => setOpenGroup(null)}
                  />
                ))}

                {userRole !== "proprietario" && (
                  <Link
                    href="/configuracoes/tema"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                      activePage === "tema" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {IconPalette}
                    Tema
                  </Link>
                )}
              </nav>
            </div>

            {/* User info + actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                {userPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userPhoto} alt={userName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-right max-w-[140px] xl:max-w-none">
                  <p className="text-sm font-medium text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis" title={userName}>{userName}</p>
                  <p className={`text-xs leading-tight whitespace-nowrap ${
                    userRole === "proprietario" ? "text-yellow-400" :
                    userRole === "admin" ? "text-[#ff695f]" : "text-[#03a4ed]"
                  }`}>
                    {userRole}
                  </p>
                </div>
              </div>
              <SignOutButton />

              {/* Hamburger button — only on mobile */}
              <button
                onClick={() => { setMobileMenuOpen((v) => !v); setMobileSubMenu(null); }}
                className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Menu"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Full-screen mobile menu overlay ─────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col" style={{ background: "linear-gradient(160deg, #1e293b 0%, #0f172a 100%)" }}>

          {/* Top bar: logo + close */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-white/10 flex-shrink-0">
            <Link href="/inicio" onClick={closeMobile} className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-apolizza-fundo-clear.png" alt="Apolizza" className="h-10 w-auto object-contain" />
            </Link>
            <button
              onClick={closeMobile}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Fechar menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Menu content — scrollable */}
          <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">

            {/* Drilled into a group — back + group items */}
            {mobileSubMenu !== null ? (() => {
              const group = allGroups.find((g) => g.key === mobileSubMenu);
              if (!group) return null;
              return (
                <>
                  <button
                    onClick={() => setMobileSubMenu(null)}
                    className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-all min-h-[48px] w-full mb-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Voltar
                  </button>
                  <p className="px-3 pt-1 pb-2 text-[11px] font-semibold text-white/40 uppercase tracking-widest">
                    {group.label}
                  </p>
                  {group.items.map((item) => {
                    const isActive = activePage === item.key;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                          isActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span className={`flex-shrink-0 ${isActive ? "text-white" : "text-slate-400"}`}>
                          {item.icon}
                        </span>
                        <span className="flex-1">{item.label}</span>
                        {(item.badge ?? 0) > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff695f] text-white text-[10px] font-bold flex items-center justify-center">
                            {(item.badge ?? 0) > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </>
              );
            })() : (
              /* ── Main mobile menu ── */
              <>
                {/* User info strip */}
                <div className="flex items-center gap-3 px-4 py-3 mb-3 bg-white/5 rounded-2xl">
                  {userPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={userPhoto} alt={userName} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center text-white font-semibold flex-shrink-0">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{userName}</p>
                    <p className={`text-xs ${
                      userRole === "proprietario" ? "text-yellow-400" :
                      userRole === "admin" ? "text-[#ff695f]" : "text-[#03a4ed]"
                    }`}>{userRole}</p>
                  </div>
                </div>

                <Link
                  href="/inicio"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                    activePage === "inicio" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Início
                </Link>

                {/* Dashboard group (non-cotador) */}
                {dashboardGroup && (() => {
                  const isGroupActive = dashboardGroup.items.some((i) => i.key === activePage);
                  return (
                    <button
                      onClick={() => setMobileSubMenu("dashboard-group")}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] w-full ${
                        isGroupActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex-shrink-0 text-slate-400">{IconChart}</span>
                      <span className="flex-1 text-left">Dashboard</span>
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })()}

                <Link
                  href="/base-conhecimento"
                  onClick={closeMobile}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                    activePage === "base-conhecimento" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="flex-shrink-0 text-slate-400">{IconBook}</span>
                  Base de Conhecimento
                </Link>

                {/* Other groups */}
                {groups.map((group) => {
                  const isGroupActive = group.items.some((i) => i.key === activePage);
                  const groupBadge = group.items.reduce((s, i) => s + (i.badge ?? 0), 0);
                  return (
                    <button
                      key={group.key}
                      onClick={() => setMobileSubMenu(group.key)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] w-full ${
                        isGroupActive ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex-1 text-left">{group.label}</span>
                      {groupBadge > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff695f] text-white text-[10px] font-bold flex items-center justify-center">
                          {groupBadge > 99 ? "99+" : groupBadge}
                        </span>
                      )}
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}

                {userRole !== "proprietario" && (
                  <Link
                    href="/configuracoes/tema"
                    onClick={closeMobile}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all min-h-[48px] ${
                      activePage === "tema" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="flex-shrink-0 text-slate-400">{IconPalette}</span>
                    Tema
                  </Link>
                )}

                {/* Sign out at the bottom */}
                <div className="pt-4 mt-2 border-t border-white/10">
                  <SignOutButton />
                </div>
              </>
            )}
          </nav>
        </div>
      )}
    </>
  );
}
