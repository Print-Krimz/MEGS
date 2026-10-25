import { useCallback, useEffect, useState } from "react";

/**
 * Selected row ids for a list. Selection is cleared whenever `resetKey` changes (filters, page, sort),
 * so a bulk action never reaches a row the recruiter can no longer see.
 */
export function useRowSelection(resetKey: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds((current) => (current.size === 0 ? current : new Set()));
  }, [resetKey]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  const remove = useCallback((ids: Iterable<string>) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  return { selectedIds, setSelectedIds, clear, remove };
}
