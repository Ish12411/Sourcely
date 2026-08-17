"use client";

import type { Tab } from "@/lib/types";

/** Two-character chip for the collapsed spine: "1973 oil crisis" -> "73". */
function initialism(title: string): string {
  const first = title.trim().split(/\s+/)[0] ?? "";
  const digits = first.replace(/\D/g, "");
  if (digits.length >= 2) return digits.slice(-2);
  const letters = first.replace(/[^A-Za-z]/g, "");
  if (letters.length >= 2) return letters[0].toUpperCase() + letters[1].toLowerCase();
  return (letters[0] ?? "?").toUpperCase();
}

/** Unread follow-ups added by other people through a shared link. */
function inboundCount(tab: Tab): number {
  if (tab.kind !== "group") return 0;
  const seen = tab.seenTurns ?? tab.turns.length;
  return Math.max(0, tab.turns.length - seen);
}

type Props = {
  tabs: Tab[];
  activeId: string;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onToggleCollapsed: () => void;
  /** Mobile drawer visibility; ignored at desktop widths. */
  drawerOpen: boolean;
  onCloseDrawer: () => void;
};

export default function Sidebar({
  tabs,
  activeId,
  collapsed,
  onSelect,
  onAdd,
  onEdit,
  onToggleCollapsed,
  drawerOpen,
  onCloseDrawer,
}: Props) {
  const personal = tabs.filter((t) => t.kind === "personal");
  const group = tabs.filter((t) => t.kind === "group");

  const shell: React.CSSProperties = {
    width: collapsed ? 48 : 228,
    flex: "none",
    background: "var(--color-paper-sunk)",
    borderRight: "1px solid var(--hairline)",
    display: "flex",
    flexDirection: "column",
    transition: "width 160ms ease",
  };

  if (collapsed) {
    return (
      <aside className="no-print" style={{ ...shell, alignItems: "center", padding: "16px 0 12px", gap: 14 }}>
        <span style={{ font: "500 15px/1 var(--font-serif)" }}>
          S
          <sup style={{ font: "500 8px/1 var(--font-mono)", color: "var(--color-amber)", verticalAlign: "super" }}>
            1
          </sup>
        </span>

        <button
          type="button"
          onClick={onAdd}
          aria-label="New thread"
          title="New thread (N)"
          style={{
            width: 24,
            height: 24,
            background: "var(--color-ink)",
            color: "var(--color-paper)",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "400 14px/1 var(--font-mono)",
            border: 0,
            cursor: "pointer",
          }}
        >
          +
        </button>

        <div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center", paddingTop: 4 }}>
          {tabs.map((tab) => {
            const active = tab.id === activeId;
            const isGroup = tab.kind === "group";
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelect(tab.id)}
                title={tab.title}
                aria-current={active ? "page" : undefined}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: `${active ? 500 : 400} 11px/1 var(--font-mono)`,
                  border: 0,
                  cursor: "pointer",
                  background: active
                    ? "var(--color-paper)"
                    : isGroup
                      ? "var(--teal-tint)"
                      : "transparent",
                  boxShadow: active ? "inset 0 0 0 1px rgba(0,0,0,.12)" : undefined,
                  color: active ? "var(--color-ink)" : isGroup ? "var(--color-teal)" : "rgba(0,0,0,.42)",
                }}
              >
                {initialism(tab.title)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Expand sidebar"
          title="Expand (Ctrl+\)"
          style={{
            marginTop: "auto",
            font: "400 12px/1 var(--font-mono)",
            color: "var(--meta)",
            background: "none",
            border: 0,
            cursor: "pointer",
          }}
        >
          »
        </button>
      </aside>
    );
  }

  return (
    <>
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={onCloseDrawer}
          className="md:hidden"
          style={{ position: "fixed", inset: 0, zIndex: 20, background: "rgba(0,0,0,.3)", border: 0 }}
        />
      )}

      <aside
        className={`no-print ${drawerOpen ? "" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 md:static md:translate-x-0`}
        style={{ ...shell, paddingTop: 18 }}
      >
        <div style={{ padding: "0 18px 18px", font: "500 21px/1 var(--font-serif)", letterSpacing: "-.015em" }}>
          Sourcely
          <sup style={{ font: "500 10px/1 var(--font-mono)", color: "var(--color-amber)", verticalAlign: "super" }}>
            1
          </sup>
        </div>

        <div style={{ padding: "0 12px 16px" }}>
          <button
            type="button"
            onClick={onAdd}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 12px",
              background: "var(--color-ink)",
              color: "var(--color-paper)",
              borderRadius: 7,
              font: "500 12.5px/1 var(--font-sans)",
              border: 0,
              cursor: "pointer",
            }}
          >
            New thread
            <span style={{ marginLeft: "auto", font: "400 11px/1 var(--font-mono)", opacity: 0.5 }}>N</span>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }} className="no-scrollbar">
          <TabSection label="Personal" tabs={personal} activeId={activeId} onSelect={onSelect} onEdit={onEdit} />
          <TabSection
            label="Group"
            tabs={group}
            activeId={activeId}
            onSelect={onSelect}
            onEdit={onEdit}
            topPadding
          />
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "none",
            // All longhand: mixing `border` with `borderTop*` makes React warn
            // and can drop the rule on rerender.
            borderWidth: "1px 0 0 0",
            borderStyle: "solid",
            borderColor: "var(--hairline-soft)",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <span style={{ font: "400 12px/1 var(--font-mono)", color: "var(--meta)" }}>«</span>
          <span style={{ font: "400 10.5px/1 var(--font-mono)", color: "rgba(0,0,0,.42)" }}>Collapse</span>
          <span style={{ marginLeft: "auto", font: "400 10px/1 var(--font-mono)", color: "rgba(0,0,0,.3)" }}>
            ⌘\
          </span>
        </button>
      </aside>
    </>
  );
}

function TabSection({
  label,
  tabs,
  activeId,
  onSelect,
  onEdit,
  topPadding,
}: {
  label: string;
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  topPadding?: boolean;
}) {
  if (tabs.length === 0) return null;

  return (
    <>
      <div className="eyebrow" style={{ padding: topPadding ? "20px 18px 8px" : "0 18px 8px" }}>
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 8px" }}>
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const inbound = inboundCount(tab);
          return (
            <div
              key={tab.id}
              className="group"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                borderRadius: 6,
                background: active ? "var(--color-paper)" : undefined,
                boxShadow: active ? "var(--active-ring)" : undefined,
                color: active ? "var(--color-ink)" : "var(--body-secondary)",
              }}
            >
              {/* Empty 2px slot on inactive rows keeps every label aligned. */}
              <span
                aria-hidden="true"
                style={{
                  flex: "none",
                  width: 2,
                  height: 15,
                  borderRadius: 2,
                  background: active ? "var(--color-teal)" : "transparent",
                }}
              />

              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                title={tab.title}
                aria-current={active ? "page" : undefined}
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: "left",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  font: `${active ? 500 : 400} 12.5px/1.3 var(--font-sans)`,
                  color: "inherit",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {tab.title}
              </button>

              {inbound > 0 && (
                <span
                  className="badge badge-high"
                  style={{ flex: "none", borderRadius: 4 }}
                  title={`${inbound} follow-up${inbound === 1 ? "" : "s"} added through the link`}
                >
                  {inbound} in
                </span>
              )}

              <button
                type="button"
                onClick={() => onEdit(tab.id)}
                aria-label={`Rename ${tab.title}`}
                title="Rename or share"
                className={active ? "" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100"}
                style={{
                  flex: "none",
                  font: "400 11px/1 var(--font-mono)",
                  color: "rgba(0,0,0,.3)",
                  background: "none",
                  border: 0,
                  cursor: "pointer",
                }}
              >
                ✎
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
