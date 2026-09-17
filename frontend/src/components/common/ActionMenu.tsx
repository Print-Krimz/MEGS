import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ActionMenuItem {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

interface ActionMenuProps {
  label?: string;
  items: ActionMenuItem[];
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

/** Small, keyboard-operable overflow menu for dense record lists. */
export const ActionMenu: React.FC<ActionMenuProps> = ({
  label = "Actions",
  items,
  className,
  onOpenChange,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    left: number;
    maxHeight?: number;
  } | null>(null);

  const setMenuOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) setMenuPosition(null);
  };

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const gap = 4;
    const edge = 8;
    const openBelow = triggerRect.bottom + menuRect.height + gap <= window.innerHeight - edge;

    // Keep a lower-row menu from covering the records above it. If there is
    // no room below the trigger, use the space beside the trigger first and
    // only fall back to opening upward when the viewport is too narrow.
    const leftOfTrigger = triggerRect.left - menuRect.width - gap;
    const rightOfTrigger = triggerRect.right + gap;
    const canOpenLeft = leftOfTrigger >= edge;
    const canOpenRight = rightOfTrigger + menuRect.width <= window.innerWidth - edge;

    let top: number;
    let left: number;
    let opensBeside = false;
    if (openBelow) {
      top = triggerRect.bottom + gap;
      left = triggerRect.right - menuRect.width;
    } else if (canOpenLeft) {
      top = triggerRect.top;
      left = leftOfTrigger;
      opensBeside = true;
    } else if (canOpenRight) {
      top = triggerRect.top;
      left = rightOfTrigger;
      opensBeside = true;
    } else {
      top = Math.max(edge, triggerRect.top - menuRect.height - gap);
      left = triggerRect.right - menuRect.width;
    }

    // Clamp the menu to the viewport in case the trigger is close to an edge
    // or the browser window is shorter than the menu. A side-positioned menu
    // stays aligned with its row and scrolls within the remaining viewport
    // instead of being pushed upward over earlier records.
    const maxHeight = opensBeside
      ? Math.max(44, window.innerHeight - top - edge)
      : undefined;
    if (!opensBeside) {
      top = Math.min(Math.max(edge, top), Math.max(edge, window.innerHeight - menuRect.height - edge));
    }
    left = Math.min(Math.max(edge, left), Math.max(edge, window.innerWidth - menuRect.width - edge));
    setMenuPosition({ top, left, maxHeight });
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    const enabledItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') || []
    );
    if (enabledItems.length === 0) return;

    event.preventDefault();
    const currentIndex = enabledItems.indexOf(event.currentTarget);
    if (event.key === "Home") {
      enabledItems[0].focus();
    } else if (event.key === "End") {
      enabledItems[enabledItems.length - 1].focus();
    } else {
      const offset = event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + offset + enabledItems.length) % enabledItems.length;
      enabledItems[nextIndex].focus();
    }
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
        onOpenChange?.(false);
        setMenuPosition(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        onOpenChange?.(false);
        setMenuPosition(null);
        triggerRef.current?.focus();
      }
    };

    const handleViewportChange = () => updateMenuPosition();

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
    requestAnimationFrame(() => {
      updateMenuPosition();
      firstItemRef.current?.focus();
    });
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex", className)}>
      <button
        ref={triggerRef}
        type="button"
        className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B315D] focus-visible:ring-offset-1"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
         onClick={() => setMenuOpen(!open)}
      >
        <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          className={cn(
            "fixed z-[100] w-60 max-w-[calc(100vw-1rem)] max-h-[calc(100vh-1rem)] overflow-y-auto overflow-x-hidden rounded-md border border-slate-300 bg-white py-1 shadow-dropdown",
            !menuPosition && "invisible"
          )}
          style={{
            top: menuPosition?.top ?? 0,
            left: menuPosition?.left ?? 0,
            ...(menuPosition?.maxHeight ? { maxHeight: `${menuPosition.maxHeight}px` } : {}),
          }}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              ref={index === items.findIndex((candidate) => !candidate.disabled) ? firstItemRef : undefined}
              disabled={item.disabled}
              onKeyDown={handleItemKeyDown}
              className={cn(
                "w-full px-3 py-2.5 text-left text-sm whitespace-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0B315D] disabled:cursor-not-allowed disabled:opacity-50",
                item.tone === "danger"
                  ? "text-rose-700 hover:bg-rose-50 hover:text-rose-900"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
              )}
              onClick={() => {
                setMenuOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};
