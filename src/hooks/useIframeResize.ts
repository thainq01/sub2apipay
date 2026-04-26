'use client';

import { useEffect, useRef } from 'react';
import { useIframeContext } from './useIframeContext';
import { postMessageToParent } from '@/lib/iframe-messages';

export function useIframeResize(): void {
  const { isIframe } = useIframeContext();
  const lastHeight = useRef(0);

  useEffect(() => {
    if (!isIframe) return;

    const observer = new ResizeObserver(() => {
      const height = document.documentElement.scrollHeight;
      if (height !== lastHeight.current) {
        lastHeight.current = height;
        postMessageToParent({ type: 'pay:resize', height });
      }
    });

    observer.observe(document.body);

    return () => observer.disconnect();
  }, [isIframe]);
}
