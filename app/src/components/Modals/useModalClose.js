import { useCallback, useEffect, useRef, useState } from 'react';

const FALLBACK_MS = 450; // in case animationend never fires (e.g. display:none tab)

/**
 * Exit animation for portal modals. Instead of unmounting immediately, `requestClose(after?)`
 * toggles a `closing` class, waits for the overlay's exit animation to finish, then calls
 * `after` (if given) followed by `onClose`. Spread `overlayProps` onto the overlay element.
 */
export function useModalClose(onClose) {
  const [closing, setClosing] = useState(false);
  const doneRef = useRef(false);
  const afterRef = useRef(null);
  const timerRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimeout(timerRef.current);
    const after = afterRef.current;
    afterRef.current = null;
    if (after) after();
    onCloseRef.current?.();
  }, []);

  const requestClose = useCallback((after) => {
    if (doneRef.current) return;
    if (typeof after === 'function') afterRef.current = after;
    setClosing(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(finish, FALLBACK_MS);
  }, [finish]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const overlayProps = {
    onAnimationEnd: (e) => { if (closing && e.target === e.currentTarget) finish(); },
  };
  return { closing, requestClose, overlayProps };
}
