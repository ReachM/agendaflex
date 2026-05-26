"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="lp-header">
      <div className="lp-container lp-header__inner">
        <Link href="/" className="lp-logo" aria-label="MarcaiFlex, página inicial">
          <span className="lp-logo__mark">MF</span>
          <span className="lp-logo__word">
            Marcai<span>Flex</span>
          </span>
        </Link>

        <nav className={`lp-nav ${open ? "lp-nav--open" : ""}`} aria-label="Navegação principal">
          <a href="#como-funciona" onClick={() => setOpen(false)}>
            Como funciona
          </a>
          <a href="#recursos" onClick={() => setOpen(false)}>
            Recursos
          </a>
          <a href="#planos" onClick={() => setOpen(false)}>
            Planos
          </a>
          <a href="#faq" onClick={() => setOpen(false)}>
            FAQ
          </a>
          <div className="lp-nav__cta">
            <Link href="/login" className="lp-btn lp-btn--ghost">
              Entrar
            </Link>
            <Link href="/cadastro" className="lp-btn lp-btn--primary">
              Começar grátis
            </Link>
          </div>
        </nav>

        <button
          type="button"
          className="lp-nav-toggle"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  );
}
