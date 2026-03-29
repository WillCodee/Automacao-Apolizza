"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="px-3 py-1.5 text-sm text-slate-300 hover:text-white border border-white/20 rounded-lg hover:bg-white/10 transition-all"
    >
      Sair
    </button>
  );
}
