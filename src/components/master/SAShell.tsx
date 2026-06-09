"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SANav, findNavLabel } from "@/components/master/SANav";

export function SAShell({
  user,
  children
}: {
  user: { id: string; name: string; email: string };
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const current = findNavLabel(pathname);

  return (
    <div className="sa-app">
      <button
        type="button"
        className="sa-mobile-toggle"
        aria-label="Abrir menu"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div className={`sa-backdrop ${open ? "is-open" : ""}`} onClick={() => setOpen(false)} />

      <aside className={`sa-side ${open ? "is-open" : ""}`}>
        <SANav user={user} onNavigate={() => setOpen(false)} />
      </aside>

      <div className="sa-main">
        <header className="sa-topbar">
          <div className="breadcrumb">
            <a href="/master/overview">Super Admin</a>
            <span className="sep">/</span>
            <span className="cur">{current}</span>
          </div>
          <span className="env-pill">PRODUÇÃO</span>
          <input className="search-global" type="search" placeholder="Buscar empresa, usuário, nota…" />
        </header>
        <main className="sa-page">{children}</main>
      </div>
    </div>
  );
}
