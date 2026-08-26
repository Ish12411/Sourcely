"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type DropdownOption = { value: string; label: string };
export type DropdownGroup = { label?: string; options: DropdownOption[] };

type Placement = { top: number; left: number; width: number; maxHeight: number; above: boolean };

/**
 * A listbox that belongs to this design.
 *
 * A native <select> renders its option list from the operating system: system
 * font, system highlight, system corners. Nothing about it can be styled, so
 * on a page set in Caslon on warm stock it reads as a window borrowed from
 * another application. This is the only reason to replace a native control —
 * and replacing one means owing everything it gave away for free, which is
 * what most of the code below is: roles and labels, arrow-key and Home/End
 * navigation, type-ahead, Escape, outside-click, and focus returning to the
 * trigger on close.
 *
 * The popup is rendered through a portal in fixed position. Inside its own
 * container it would be clipped by the sources overlay's `overflow: hidden`,
 * which is the standard way a custom dropdown ends up half-visible.
 */
export default function Dropdown({
  label,
  value,
  groups,
  onChange,
  minWidth = 210,
}: {
  /** Small mono label rendered inside the trigger, e.g. "STYLE". */
  label: string;
  value: string;
  groups: DropdownGroup[];
  onChange: (value: string) => void;
  minWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const typeahead = useRef<{ buffer: string; timer: ReturnType<typeof setTimeout> | null }>({
    buffer: "",
    timer: null,
  });

  const listId = useId();

  // Flat order is what the keyboard walks; group headings are not stops.
  const flat = useMemo(() => groups.flatMap((g) => g.options), [groups]);
  const selectedIndex = Math.max(0, flat.findIndex((o) => o.value === value));
  const selected = flat[selectedIndex];

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const below = window.innerHeight - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    // Flip up only when below genuinely cannot hold a usable list.
    const useAbove = below < 220 && above > below;
    setPlacement({
      top: useAbove ? r.top - gap : r.bottom + gap,
      left: r.left,
      width: Math.max(r.width, minWidth),
      maxHeight: Math.min(360, useAbove ? above : below),
      above: useAbove,
    });
  }, [minWidth]);

  function openList() {
    measure();
    setActiveIndex(selectedIndex);
    setOpen(true);
  }

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Reposition on scroll and resize. Capture phase so scrolling any ancestor
  // counts, not just the window.
  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, measure]);

  /**
   * Escape closes the menu and nothing else.
   *
   * This has to be a capture-phase listener on `document`. The obvious version
   * — stopPropagation inside the React key handler — does not work: React
   * delegates its listeners to the root, so React's handler and the sources
   * overlay's own Escape listener end up attached to the same node, and
   * stopPropagation has no effect between listeners on one node. Capture runs
   * before every bubble-phase listener regardless of registration order, and
   * stopImmediatePropagation is what actually silences the siblings. Measured:
   * without this, one Escape closed the menu and the overlay behind it.
   */
  useEffect(() => {
    if (!open) return;
    function onEscapeCapture(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close();
    }
    document.addEventListener("keydown", onEscapeCapture, true);
    return () => document.removeEventListener("keydown", onEscapeCapture, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (listRef.current?.contains(t) || triggerRef.current?.contains(t)) return;
      close(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Keep the active option in view as the arrows move through the list.
  useEffect(() => {
    if (!open) return;
    optionRefs.current.get(activeIndex)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function commit(index: number) {
    const option = flat[index];
    if (option) onChange(option.value);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }

    switch (e.key) {
      // Escape is handled by the capture-phase listener below, not here.
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(flat.length - 1, i + 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        e.preventDefault();
        setActiveIndex(flat.length - 1);
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        return;
      case "Tab":
        close(false);
        return;
    }

    // Type-ahead: a native select jumps to what you type, so this one does too.
    if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = typeahead.current;
      t.buffer += e.key.toLowerCase();
      if (t.timer) clearTimeout(t.timer);
      t.timer = setTimeout(() => (t.buffer = ""), 600);
      const hit = flat.findIndex((o) => o.label.toLowerCase().startsWith(t.buffer));
      if (hit >= 0) setActiveIndex(hit);
    }
  }

  const popup =
    open && placement && mounted
      ? createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            aria-activedescendant={`${listId}-${activeIndex}`}
            className="dropdown-pop"
            style={{
              position: "fixed",
              top: placement.above ? undefined : placement.top,
              bottom: placement.above ? window.innerHeight - placement.top : undefined,
              left: placement.left,
              width: placement.width,
              maxHeight: placement.maxHeight,
              zIndex: 60,
            }}
          >
            {groups.map((group, gi) => {
              let cursor = groups.slice(0, gi).reduce((n, g) => n + g.options.length, 0);
              return (
                <div key={group.label ?? gi}>
                  {group.label && (
                    <div className="dropdown-group" role="presentation">
                      {group.label}
                    </div>
                  )}
                  {group.options.map((option) => {
                    const index = cursor++;
                    const isSelected = option.value === value;
                    const isActive = index === activeIndex;
                    return (
                      <div
                        key={option.value}
                        id={`${listId}-${index}`}
                        ref={(el) => {
                          if (el) optionRefs.current.set(index, el);
                          else optionRefs.current.delete(index);
                        }}
                        role="option"
                        aria-selected={isSelected}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => commit(index)}
                        className={`dropdown-option${isActive ? " is-active" : ""}${
                          isSelected ? " is-selected" : ""
                        }`}
                      >
                        <span style={{ minWidth: 0, flex: 1 }}>{option.label}</span>
                        {isSelected && <Tick />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
        className="dropdown-trigger"
        style={{ minWidth }}
      >
        <span className="dropdown-trigger-label">{label}</span>
        <span className="dropdown-trigger-value">{selected?.label ?? ""}</span>
        <Chevron open={open} />
      </button>
      {popup}
    </>
  );
}

/* Drawn, not typed. A "✓" or "▾" borrowed from the text stream inherits the
   font's own weight and alignment and never matches the rest of the interface. */

function Tick() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true" style={{ flex: "none" }}>
      <path
        d="M2.5 6.4L4.8 8.7L9.5 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{
        flex: "none",
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform var(--dur-fast) var(--ease-out)",
        opacity: 0.55,
      }}
    >
      <path
        d="M2 4L5 7L8 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
