'use client';

import { useState, useEffect } from 'react';

export function useIframeContext(): { isIframe: boolean } {
  const [isIframe, setIsIframe] = useState(false);

  useEffect(() => {
    try {
      setIsIframe(window.self !== window.top);
    } catch {
      // Cross-origin iframe access will throw — treat as iframe
      setIsIframe(true);
    }
  }, []);

  return { isIframe };
}
