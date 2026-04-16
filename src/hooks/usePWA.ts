import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';

// TypeScript interface for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    outcome_detail: string;
  }>;
  prompt(): Promise<void>;
}

// Global state for pwa installation prompt
let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

// Immediate listener on script load
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    (window as any).deferredPrompt = globalDeferredPrompt;
    listeners.forEach(cb => cb(globalDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    globalDeferredPrompt = null;
    (window as any).deferredPrompt = null;
    listeners.forEach(cb => cb(null));
    console.log('PWA was installed');
  });
}

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(globalDeferredPrompt);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const { kioskModeEnabled, allowPWAInstall } = useStore();

  useEffect(() => {
    // Sync with global state on mount in case it was captured before component mount
    if (globalDeferredPrompt) {
      setDeferredPrompt(globalDeferredPrompt);
    }

    const handler = (prompt: BeforeInstallPromptEvent | null) => {
      console.log('PWA Prompt State Update:', !!prompt);
      setDeferredPrompt(prompt);
    };
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  useEffect(() => {
    // 1. Detect Standalone Mode
    const checkStandalone = () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone || 
        document.referrer.includes('android-app://');
      setIsStandalone(!!isStandaloneMode);
    };

    // 2. Detect iOS
    const checkIOS = () => {
      const ua = window.navigator.userAgent;
      // Modern iPads (iPadOS 13+) often report as MacIntel, so we check maxTouchPoints
      const isActuallyIOS = /iPad|iPhone|iPod/.test(ua) || 
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const ios = isActuallyIOS && !(window as any).MSStream;
      setIsIOS(!!ios);
    };

    checkStandalone();
    checkIOS();
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const enterFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.warn('Fullscreen request failed:', err);
      }
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.warn('Exit fullscreen failed:', err);
      }
    }
  }, []);

  // Kiosk Mode Auto-Fullscreen Logic
  useEffect(() => {
    if (kioskModeEnabled && isStandalone) {
      const handleFirstTouch = () => {
        enterFullscreen();
        window.removeEventListener('click', handleFirstTouch);
        window.removeEventListener('touchstart', handleFirstTouch);
      };

      window.addEventListener('click', handleFirstTouch);
      window.addEventListener('touchstart', handleFirstTouch);

      return () => {
        window.removeEventListener('click', handleFirstTouch);
        window.removeEventListener('touchstart', handleFirstTouch);
      };
    } else if (!kioskModeEnabled) {
      exitFullscreen();
    }
  }, [kioskModeEnabled, isStandalone, enterFullscreen, exitFullscreen]);

  return {
    canInstall: (!!deferredPrompt || isIOS) && allowPWAInstall,
    isStandalone,
    isIOS,
    installApp,
    enterFullscreen,
    exitFullscreen,
    deferredPrompt
  };
};
