import React, { useEffect, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-12 left-4 z-50 flex items-center gap-2 border border-amber-400 bg-[#1A0E02]/95 px-3 py-1.5 text-xs font-mono text-amber-300 shadow-lg">
      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
      OFFLINE APP MODE — LOCAL AI ARENA ACTIVE
    </div>
  );
};

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    soundEngine.playSelect();
    if (isInstallable) {
      await install();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`pf-grid-btn-cyan flex items-center justify-center gap-1.5 uppercase font-bold cursor-pointer ${
          compact ? 'px-3 py-1 text-xs tracking-wider' : 'px-4 py-2 text-xs md:text-sm tracking-widest'
        }`}
        title="Install Fleet.io as a Mobile or Desktop App"
      >
        <span>📲</span>
        <span>{isIOS ? 'INSTALL IOS APP' : 'INSTALL APP'}</span>
      </button>

      {showGuideModal && (
        <div
          onClick={() => setShowGuideModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="pf-panel w-full max-w-md p-6 text-left flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-amber-500/50 pb-2">
              <h3 className="text-base md:text-lg font-bold tracking-widest text-sky-300 uppercase">
                INSTALL FLEET.IO AS AN APP
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="pf-grid-btn px-2.5 py-0.5 text-xs uppercase cursor-pointer"
              >
                ✕
              </button>
            </div>

            {isIOS ? (
              <div className="text-xs md:text-sm text-amber-100 space-y-2 leading-relaxed">
                <p className="text-amber-300 font-bold">iPhone / iPad Installation:</p>
                <p>1. Tap the <strong>Share</strong> button in your Safari toolbar.</p>
                <p>2. Scroll down and select <strong>Add to Home Screen</strong>.</p>
                <p>3. Launch <strong>Fleet.io</strong> full-screen anytime, even offline!</p>
              </div>
            ) : (
              <div className="text-xs md:text-sm text-amber-100 space-y-2 leading-relaxed">
                <p className="text-amber-300 font-bold">Mobile & Desktop App Installation:</p>
                <p>
                  1. Open this game in a standalone browser tab and click the <strong>Install App</strong> icon in the address bar (or browser menu → <strong>Add to Home Screen / Install Fleet.io</strong>).
                </p>
                <p>
                  2. Once installed, <strong>Fleet.io</strong> runs in full-screen standalone mode with offline AI squadron support and instant WebSocket multiplayer.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              className="pf-grid-btn w-full py-2 text-sm font-bold tracking-widest uppercase cursor-pointer mt-1"
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  );
};
