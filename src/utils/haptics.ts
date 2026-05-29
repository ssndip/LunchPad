/**
 * Safe wrapper for the HTML5 Vibration API to provide
 * native-feeling haptic feedback on Android devices.
 * (iOS Safari generally ignores this API, but it's safe to call).
 */

export const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
  if (typeof window === 'undefined' || !navigator || !navigator.vibrate) return;

  try {
    const intensity = localStorage.getItem('lunchpad_haptic_intensity') || 'default';
    if (intensity === 'disabled') return;

    const scale = intensity === 'light' ? 0.5 : intensity === 'robust' ? 2.0 : 1.0;

    switch (type) {
      case 'light':
        navigator.vibrate(Math.max(1, Math.round(10 * scale)));
        break;
      case 'medium':
        navigator.vibrate(Math.round(20 * scale));
        break;
      case 'heavy':
        navigator.vibrate(Math.round(50 * scale));
        break;
      case 'success':
        if (intensity === 'light') {
          navigator.vibrate([5, 25, 15]);
        } else if (intensity === 'robust') {
          navigator.vibrate([20, 100, 60]);
        } else {
          navigator.vibrate([10, 50, 30]);
        }
        break;
      case 'error':
        if (intensity === 'light') {
          navigator.vibrate([15, 20, 15, 20, 25]);
        } else if (intensity === 'robust') {
          navigator.vibrate([60, 80, 60, 80, 100]);
        } else {
          navigator.vibrate([30, 40, 30, 40, 50]);
        }
        break;
    }
  } catch (e) {
    // Ignore errors on restricted platforms
  }
};
