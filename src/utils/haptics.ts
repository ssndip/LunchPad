/**
 * Safe wrapper for the HTML5 Vibration API to provide
 * native-feeling haptic feedback on Android devices.
 * (iOS Safari generally ignores this API, but it's safe to call).
 */

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;

  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate(50);
        break;
      case 'success':
        navigator.vibrate([10, 50, 30]); // double tap feeling
        break;
      case 'error':
        navigator.vibrate([30, 40, 30, 40, 50]); // shudder feeling
        break;
    }
  } catch (e) {
    // Ignore errors on restricted platforms
  }
};
