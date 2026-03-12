import { useEffect, useRef, useCallback } from 'react';

/**
 * useFocusTrap — traps keyboard focus within a container element.
 *
 * WCAG 2.4.3 Focus Order (Level A) + WCAG 2.1.2 No Keyboard Trap (Level A)
 *
 * Usage:
 *   const trapRef = useFocusTrap(isOpen);
 *   <div ref={trapRef} role="dialog" aria-modal="true"> ... </div>
 *
 * When `active` is true:
 *  - Focus moves to the first focusable element inside the container
 *  - Tab / Shift+Tab cycle within the container
 *  - Focus returns to the previously focused element when deactivated
 */
export function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ');
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(selector));
  }, []);

  useEffect(() => {
    if (!active) return;

    // Save the element that had focus before the trap activated
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus into the trap after a tick (allows render to complete)
    const initialFocusTimer = setTimeout(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      }
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements();
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(initialFocusTimer);
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus to the element that had it before the trap
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [active, getFocusableElements]);

  return containerRef;
}
