"use client";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Produto",
    links: [
      { label: "Recursos", href: "#recursos" },
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Planos", href: "#planos" },
      { label: "FAQ", href: "#faq" }
    ]
  },
  {
    title: "Empresa",
    links: [
      { label: "Sobre", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Contato", href: "#" },
      { label: "Carreiras", href: "#" }
    ]
  },
  {
    title: "Suporte",
    links: [
      { label: "Central de ajuda", href: "#" },
      { label: "WhatsApp", href: "#" },
      { label: "Status", href: "#" },
      { label: "LGPD", href: "#" }
    ]
  }
];

/** Rodapé dark. */
export function Footer() {
  return (
    <footer id="contato" className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <span className="lp-logo lp-logo--dark">
              <span className="lp-logo__mark">MF</span>
              <span className="lp-logo__word">
                Marcai<span>Flex</span>
              </span>
            </span>
            <p>
              Agendamento online + bot de WhatsApp para negócios que vivem de horário marcado. Feito
              no Brasil 🇧🇷.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div className="lp-footer__col" key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer__bar">
          <span>© {new Date().getFullYear()} MarcaiFlex. Todos os direitos reservados.</span>
          <span>CNPJ 00.000.000/0001-00 · São Paulo / SP</span>
        </div>
      </div>
    </footer>
  );
}
