import * as Clipboard from 'expo-clipboard';
import { useCallback, useRef, useState } from 'react';

// Tap-to-copy for phone numbers. A plain tel: link is fine for calling, but
// on web (and especially when you're calling through a separate app like
// Google Voice) there's no way to select the number's text out of a tel:
// button — this gives an explicit copy action with brief "Copied" feedback
// instead of relying on long-press text selection, which doesn't work
// reliably when the number sits inside a tappable row.
export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (value: string) => {
      if (!value) return;
      await Clipboard.setStringAsync(value);
      setCopied(value);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), resetMs);
    },
    [resetMs]
  );

  return { copied, copy };
}
