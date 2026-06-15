"use client";

import { CalendarDays, ClipboardList, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client-api";

type ResultType = "customer" | "service" | "appointment";

type SearchResult = {
  type: ResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

const GROUP_LABEL: Record<ResultType, string> = {
  customer: "Clientes",
  service: "Serviços",
  appointment: "Agendamentos"
};

const GROUP_ICON: Record<ResultType, typeof Users> = {
  customer: Users,
  service: ClipboardList,
  appointment: CalendarDays
};

const GROUP_ORDER: ResultType[] = ["customer", "service", "appointment"];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const data = await apiFetch<{ results: SearchResult[] }>(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  const grouped = GROUP_ORDER.map((type) => ({
    type,
    items: results.filter((r) => r.type === type)
  })).filter((g) => g.items.length > 0);

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div
      ref={containerRef}
      className="global-search-wrap"
      style={{ position: "relative", width: "clamp(200px, 36vw, 420px)" }}
    >
      <Search
        size={16}
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--muted)",
          pointerEvents: "none"
        }}
      />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder="Buscar cliente, serviço ou agendamento…"
        style={{
          width: "100%",
          height: 38,
          padding: "0 80px 0 38px",
          borderRadius: 9,
          border: `1px solid ${focused ? "var(--primary)" : "var(--border)"}`,
          background: "var(--surface-muted)",
          fontSize: 13.5,
          color: "var(--text)",
          outline: "none",
          boxShadow: focused ? "var(--focus-ring)" : "none",
          transition: "all var(--transition)"
        }}
      />
      <kbd
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "var(--mono)",
          fontSize: 10.5,
          background: "#fff",
          border: "1px solid var(--border)",
          borderRadius: 5,
          padding: "2px 6px",
          color: "var(--muted)",
          pointerEvents: "none"
        }}
      >
        {typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl+K"}
      </kbd>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: 420,
            overflowY: "auto"
          }}
        >
          {loading ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              Buscando…
            </div>
          ) : grouped.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: "var(--muted)", textAlign: "center" }}>
              Nenhum resultado para “{query.trim()}”.
            </div>
          ) : (
            grouped.map((group) => {
              const Icon = GROUP_ICON[group.type];
              return (
                <div key={group.type}>
                  <div
                    style={{
                      padding: "8px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      color: "var(--muted)",
                      background: "var(--surface-muted)",
                      borderBottom: "1px solid var(--border)"
                    }}
                  >
                    {GROUP_LABEL[group.type]}
                  </div>
                  {group.items.map((item) => (
                    <button
                      key={`${item.type}-${item.id}`}
                      type="button"
                      onClick={() => handleSelect(item)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        padding: "10px 14px",
                        background: "transparent",
                        border: "none",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background var(--transition)"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-muted)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: "var(--primary-ghost)",
                          color: "var(--primary)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        <Icon size={14} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span style={{ display: "block", fontSize: 12, color: "var(--muted)" }}>
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
