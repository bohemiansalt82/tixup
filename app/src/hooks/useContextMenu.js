import { useCallback, useState } from 'react';

/** Position state for <ContextMenu>: `open` goes on an element's onContextMenu. */
export function useContextMenu() {
  const [pos, setPos] = useState(null); // { x, y } | null
  const open = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setPos({ x: e.clientX, y: e.clientY });
  }, []);
  const close = useCallback(() => setPos(null), []);
  return { pos, open, close, isOpen: pos !== null };
}
