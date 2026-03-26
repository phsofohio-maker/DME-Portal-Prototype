import { useState, useRef, useEffect, useCallback } from "react";
import { T } from "../tokens";
import type { Drug } from "../types";

interface RxTermsResponse {
  rxtermsProperties?: {
    strength?: string;
    rxtermsDoseForm?: string;
    route?: string;
  };
}

async function enrichDrug(drug: Drug): Promise<Drug> {
  if (!drug.rxcui) return drug;
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${encodeURIComponent(drug.rxcui)}/allinfo.json`;
    const res = await fetch(url);
    const data = (await res.json()) as RxTermsResponse;
    const props = data.rxtermsProperties;
    if (props) {
      return {
        ...drug,
        strength: props.strength || undefined,
        doseForm: props.rxtermsDoseForm || undefined,
        route: props.route || undefined,
      };
    }
  } catch {
    // Enrichment failed — return without enrichment, user fills manually
  }
  return drug;
}

interface DrugSearchProps {
  value: string;
  onSelect: (drug: Drug) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function DrugSearch({
  value,
  onSelect,
  placeholder = "Search medications…",
  label,
  required,
  error,
}: DrugSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<Drug[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [approxOnly, setApproxOnly] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync display when value prop is cleared externally
  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); setApproxOnly(false); return; }
    setLoading(true);
    setApproxOnly(false);

    function timedFetch(url: string): Promise<Response> {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), 3000);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
    }

    async function fetchDrugs(term: string): Promise<Drug[]> {
      const res = await timedFetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`);
      const data = await res.json() as {
        drugGroup?: {
          conceptGroup?: Array<{
            tty?: string;
            conceptProperties?: Array<{ rxcui: string; name: string; tty: string }>;
          }>;
        };
      };
      const items: Drug[] = [];
      const seen = new Set<string>();
      for (const group of data.drugGroup?.conceptGroup ?? []) {
        if (group.tty !== "SCD" && group.tty !== "SBD") continue;
        for (const cp of group.conceptProperties ?? []) {
          if (cp.name && !seen.has(cp.rxcui)) {
            seen.add(cp.rxcui);
            items.push({ name: cp.name, rxcui: cp.rxcui });
          }
        }
      }
      return items;
    }

    async function fetchApprox(term: string): Promise<Drug[]> {
      const res = await timedFetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=12`);
      const data = await res.json() as {
        approximateGroup?: { candidate?: Array<{ rxcui: string; name: string }> };
      };
      const items: Drug[] = [];
      const seen = new Set<string>();
      for (const c of data.approximateGroup?.candidate ?? []) {
        if (c.name && !seen.has(c.name)) {
          seen.add(c.name);
          items.push({ name: c.name, rxcui: c.rxcui });
        }
      }
      return items;
    }

    try {
      const [drugsResult, approxResult] = await Promise.allSettled([fetchDrugs(q), fetchApprox(q)]);
      const drugsItems = drugsResult.status === "fulfilled" ? drugsResult.value : [];
      const approxItems = approxResult.status === "fulfilled" ? approxResult.value : [];

      // Merge: primary first, then approx deduped by rxcui
      const seenCui = new Set(drugsItems.map((d) => d.rxcui));
      const merged: Drug[] = [...drugsItems];
      for (const a of approxItems) {
        if (!seenCui.has(a.rxcui)) {
          seenCui.add(a.rxcui);
          merged.push(a);
        }
      }
      const capped = merged.slice(0, 10);
      setResults(capped);
      setNoResults(capped.length === 0);
      setApproxOnly(drugsItems.length === 0 && approxItems.length > 0);
      setOpen(true);
    } catch {
      setResults([]);
      setNoResults(true);
      setApproxOnly(false);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(val: string) {
    setQuery(val);
    setActiveIdx(-1);
    setNoResults(false);
    setApproxOnly(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), 320);
  }

  async function pick(drug: Drug) {
    setQuery(drug.name);
    setOpen(false);
    setActiveIdx(-1);
    if (drug.rxcui) {
      setEnriching(true);
      const enriched = await enrichDrug(drug);
      setEnriching(false);
      onSelect(enriched);
    } else {
      onSelect(drug);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (noResults) {
      if (e.key === "Enter") { e.preventDefault(); pick({ name: query.trim(), rxcui: "" }); }
      else if (e.key === "Escape") { setOpen(false); }
      return;
    }
    if (results.length === 0) return;
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
          placeholder={placeholder}
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
        {(loading || enriching) && (
          <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
              </path>
            </svg>
          </span>
        )}

        {open && (results.length > 0 || noResults) && (
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
            {approxOnly && results.length > 0 && (
              <div style={{ padding: "6px 12px", fontSize: 11, color: T.info, fontWeight: 500, background: T.infoLight, borderBottom: `1px solid ${T.borderLight}` }}>
                Showing approximate matches
              </div>
            )}
            {results.map((drug, i) => (
              <div
                key={drug.rxcui}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={() => pick(drug)}
                onMouseEnter={() => setActiveIdx(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  background: i === activeIdx ? T.accentLight : "transparent",
                  cursor: "pointer",
                  transition: "background 0.08s",
                  borderBottom: i < results.length - 1 ? `1px solid ${T.borderLight}` : undefined,
                }}
              >
                <span style={{ fontSize: 14, color: T.text }}>{drug.name}</span>
                <span style={{ fontSize: 11, color: T.textLight }}>RxCUI {drug.rxcui}</span>
              </div>
            ))}
            {noResults && (
              <div
                role="option"
                aria-selected={false}
                onMouseDown={() => pick({ name: query.trim(), rxcui: "" })}
                style={{
                  padding: "9px 12px",
                  cursor: "pointer",
                  borderTop: results.length > 0 ? `1px solid ${T.borderLight}` : undefined,
                }}
              >
                <span style={{ fontSize: 13, color: T.textSub }}>
                  Use <strong style={{ color: T.text }}>"{query.trim()}"</strong> as custom medication
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <span style={{ fontSize: 11, color: T.urgent, fontWeight: 500 }}>{error}</span>}
    </div>
  );
}
