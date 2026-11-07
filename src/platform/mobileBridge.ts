/**
 * Cross-Platform Mobile & Web Bridge for RYFT.io (PROJECT_ID = 'orb_arena_project')
 * Supports Web Browser, Installed PWA, Android (Capacitor / TWA), and iOS (Capacitor / WKWebView)
 * without duplicating gameplay code.
 */

export type RuntimePlatform = 'web' | 'pwa' | 'android' | 'ios';

export interface MobilePlatformCapabilities {
  platform: RuntimePlatform;
  isTouchDevice: boolean;
  hasGyroscope: boolean;
  isStandalonePwa: boolean;
  supportsHaptics: boolean;
  adProviderConfigured: boolean;
}

class MobileBridge {
  private pauseCallbacks = new Set<() => void>();
  private resumeCallbacks = new Set<() => void>();
  private backButtonCallbacks = new Set<() => boolean>();
  private initialized = false;

  public detectPlatform(): RuntimePlatform {
    if (typeof window === 'undefined') return 'web';
    const ua = navigator.userAgent || '';
    const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
    if (cap && typeof cap.getPlatform === 'function') {
      const p = cap.getPlatform();
      if (p === 'android') return 'android';
      if (p === 'ios') return 'ios';
    }
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    if (isStandalone) return 'pwa';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
    return 'web';
  }

  public getCapabilities(): MobilePlatformCapabilities {
    const platform = this.detectPlatform();
    const isTouchDevice =
      typeof window !== 'undefined' &&
      ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    const hasGyroscope =
      typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
    const isStandalonePwa =
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
    const supportsHaptics =
      typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

    return {
      platform,
      isTouchDevice,
      hasGyroscope,
      isStandalonePwa,
      supportsHaptics,
      adProviderConfigured: false, // Never fabricate external ad network IDs
    };
  }

  public initLifecycleListeners(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // App backgrounding / foregrounding (Mobile & Tab visibility)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseCallbacks.forEach((cb) => cb());
      } else {
        this.resumeCallbacks.forEach((cb) => cb());
      }
    });

    // Android hardware back button handling via Capacitor or History API
    window.addEventListener('popstate', () => {
      for (const cb of this.backButtonCallbacks) {
        const handled = cb();
        if (handled) break;
      }
    });
  }

  public onPause(cb: () => void): () => void {
    this.pauseCallbacks.add(cb);
    return () => this.pauseCallbacks.delete(cb);
  }

  public onResume(cb: () => void): () => void {
    this.resumeCallbacks.add(cb);
    return () => this.resumeCallbacks.delete(cb);
  }

  public onBackButton(cb: () => boolean): () => void {
    this.backButtonCallbacks.add(cb);
    return () => this.backButtonCallbacks.delete(cb);
  }

  /**
   * Attempts to lock mobile orientation to landscape when entering fullscreen arena.
   */
  public async lockLandscapeOrientation(): Promise<boolean> {
    try {
      const orientation = (screen as unknown as {
        orientation?: { lock?: (mode: string) => Promise<void> };
      }).orientation;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
        return true;
      }
    } catch {
      // Orientation lock is optional on desktop/iOS Safari
    }
    return false;
  }

  /**
   * Triggers subtle tactile haptic pulse on mobile devices when taking damage or scoring a kill.
   */
  public triggerHaptic(pattern: number | number[] = 18): void {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Ignore on unsupported devices
    }
  }
}

export const mobileBridge = new MobileBridge();
