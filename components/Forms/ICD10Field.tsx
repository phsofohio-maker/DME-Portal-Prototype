/**
 * ICD10Field.tsx — Phase 5: Validated ICD-10-CM autocomplete field
 *
 * Replaces the free-text ICD-10 input in DMEForm and MedicationForm with a
 * live-search dropdown backed by the NIH Clinical Tables API (same source as
 * the RxNorm integration). Prevents invalid codes from reaching Firestore.
 *
 * Props:
 *   value       — current code string (controlled)
 *   onChange    — callback with the selected code string
 *   label       — field label
 *   required    — whether the field is required
 *   error       — validation error message (from Zod)
 *   placeholder — input placeholder text
 *   id          — id for label association
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { searchICD10, ICD10Result } from '../../services/icd10Service';

interface ICD10FieldProps {
  value: string;
  onChange: (code: string) => void;
  label: string;
  required?: boolean;
  error?: string;
  placeholder?: string;
  id: string;
}

export const ICD10Field: React.FC<ICD10FieldProps> = ({
  value,
  onChange,
  label,
  required = false,
  error,
  placeholder = 'Search by code or description (e.g. M54.5)',
  id,
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<ICD10Result[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hits = await searchICD10(query, 8);
        setResults(hits);
        setIsOpen(hits.length > 0);
        setActiveIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInputValue(v);
    // Clear the validated value when user edits manually
    if (v !== value) onChange('');
    search(v);
  };

  const selectResult = (result: ICD10Result) => {
    setInputValue(result.display);
    onChange(result.code);
    setIsOpen(false);
    setResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectResult(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const isValidated = Boolean(value) && inputValue.startsWith(value);

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          aria-required={required}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`w-full px-3 py-2 pr-8 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
            error
              ? 'border-red-300 bg-red-50'
              : isValidated
              ? 'border-green-300 bg-green-50'
              : 'border-slate-300 bg-white'
          }`}
        />

        {/* Status icon */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading ? (
            <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
          ) : isValidated ? (
            <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          aria-label={`ICD-10 suggestions for ${label}`}
          className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto"
        >
          {results.map((result, i) => (
            <li
              key={result.code}
              id={`${id}-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              onMouseDown={(e) => { e.preventDefault(); selectResult(result); }}
              className={`px-4 py-2.5 cursor-pointer text-sm flex items-baseline gap-2 ${
                i === activeIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-800'
              }`}
            >
              <span className="font-mono font-bold text-xs text-blue-600 shrink-0">{result.code}</span>
              <span className="truncate">{result.description}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-red-500 text-xs mt-1">
          {error}
        </p>
      )}
      {!error && !isValidated && value === '' && (
        <p className="text-slate-400 text-xs mt-1">
          Select a code from the list to validate it.
        </p>
      )}
    </div>
  );
};
