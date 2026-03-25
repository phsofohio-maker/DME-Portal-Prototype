import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../tokens";

interface Icd10Result {
  code: string;
  description: string;
}

interface Icd10SearchProps {
  code: string;
  description: string;
  onSelect: (code: string, description: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function Icd10Search({
  code,
  description,
  onSelect,
  label,
  required,
  error,
}: Icd10SearchProps) {
  const displayValue = code ? `${code} — ${description}` : description;
  const [query, setQuery] = useState(displayValue);
  const [results, setResults] = useState<Icd10Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync display when props are cleared
  useEffect(() => {
    setQuery(code ? `${code} — ${description}` : description);
  }, [code, description]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search?sf=code,name&terms=${encodeURIComponent(q)}&maxList=8`;
      const res = await fetch(url);
      const data = await res.json() as [number, string[], null, [string, string][]];
      const items = (data[3] ?? []).map(([c, d]) => ({ code: c, description: d }));
      setResults(items);
      setOpen(items.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    setActiveIdx(-1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 320);
  }

  function pick(item: Icd10Result) {
    setQuery(`${item.code} — ${item.description}`);
    setOpen(false);
    setActiveIdx(-1);
    onSelect(item.code, item.description);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const hasError = Boolean(error);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 600, color: T.textSub, textTransform: "uppercase", letterSpacing: 0.3 }}>
          {label}
          {required && <span style={{ color: T.urgent, marginLeft: 3 }}>*</span>}
        </label>
      )}
      {/* Input wrapper — dropdown positioned relative to this */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={query}
          placeholder="Search ICD-10 codes…"
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { setFocused(true); if (query.trim().length >= 2) setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          role="combobox"
          style={{
            width: "100%",
            fontSize: 14,
            color: T.text,
            background: T.bgCard,
            border: `1px solid ${hasError ? T.urgent : focused ? T.accent : T.border}`,
            borderRadius: T.radiusSm,
            padding: "10px 36px 10px 12px",
            outline: "none",
            fontFamily: T.font,
            transition: "border-color 0.12s",
            boxSizing: "border-box",
          }}
        />
        {loading && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
              </path>
            </svg>
          </span>
        )}

        {open && results.length > 0 && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: T.radiusSm,
            boxShadow: T.shadowLg,
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          {results.map((item, i) => (
            <div
              key={item.code}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => pick(item)}
              onMouseEnter={() => setActiveIdx(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                background: i === activeIdx ? T.accentLight : "transparent",
                cursor: "pointer",
                transition: "background 0.08s",
                borderBottom: i < results.length - 1 ? `1px solid ${T.borderLight}` : undefined,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.info,
                  background: T.infoLight,
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                  letterSpacing: 0.3,
                }}
              >
                {item.code}
              </span>
              <span style={{ fontSize: 13, color: T.text }}>{item.description}</span>
            </div>
          ))}
        </div>
        )}
      </div>

      {error && <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{error}</span>}
    </div>
  );
}
