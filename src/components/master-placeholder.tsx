"use client";

import type { ReactNode } from "react";
import { Hammer } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export function MasterPlaceholder({
  title,
  subtitle,
  icon,
  description,
  features
}: {
  title: string;
  subtitle?: string;
  icon: ReactNode;
  description: string;
  features?: string[];
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <section className="panel">
        <div className="panel__body" style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "60px 32px", gap: 18 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: "var(--violet-ghost, rgba(139, 92, 246, 0.12))",
            color: "var(--violet-light, #c4b5fd)",
            display: "inline-flex", alignItems: "center", justifyContent: "center"
          }}>
            {icon}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", maxWidth: 520, fontSize: 14, lineHeight: 1.6 }}>
              {description}
            </p>
          </div>
          {features && features.length > 0 ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8, textAlign: "left", maxWidth: 460 }}>
              {features.map((f, i) => (
                <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-secondary)" }}>
                  <Hammer size={14} style={{ color: "var(--violet, #8b5cf6)", marginTop: 2, flexShrink: 0 }} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <span className="pill pill--violet" style={{ marginTop: 8 }}>Em construção</span>
        </div>
      </section>
    </>
  );
}
