"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function ImpersonateBanner() {
  const router = useRouter();
  const [company, setCompany] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setCompany(readCookie("marcaiflex_imp_name"));
  }, []);

  if (!company) return null;

  async function exit() {
    setLeaving(true);
    try {
      await fetch("/api/master/impersonate/exit", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/master/overview");
    router.refresh();
  }

  return (
    <div
      style={{
        background: "#8b5cf6",
        color: "#fff",
        padding: "8px 24px",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "sticky",
        top: 0,
        zIndex: 100
      }}
    >
      <Eye size={14} />
      <span>
        Acessando como <strong>{company}</strong>
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={leaving}
        style={{
          marginLeft: "auto",
          background: "rgba(255,255,255,0.2)",
          border: 0,
          color: "#fff",
          padding: "3px 10px",
          borderRadius: 5,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: 12
        }}
      >
        {leaving ? "Saindo…" : "Sair"}
      </button>
    </div>
  );
}
