import { useState, useEffect } from 'react';

// Tailwind default breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1536,
};

export interface ResponsiveState {
  width: number;
  height: number;
  isPortrait: boolean;
  isLandscape: boolean;
  
  // Custom device profiles matching the prompt
  isPhone: boolean;   // < 768px
  isTablet: boolean;  // 768px - 1023px
  isDesktop: boolean; // >= 1024px

  // Granular Tailwind breakpoint booleans for convenience
  sm: boolean;
  md: boolean;
  lg: boolean;
  xl: boolean;
  xxl: boolean;
}

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => getResponsiveState());

  function getResponsiveState(): ResponsiveState {
    // SSR safe fallback
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isPortrait: false,
        isLandscape: true,
        isPhone: false,
        isTablet: false,
        isDesktop: true,
        sm: true, md: true, lg: true, xl: false, xxl: false
      };
    }

    const { innerWidth: width, innerHeight: height } = window;
    
    return {
      width,
      height,
      isPortrait: height >= width,
      isLandscape: width > height,
      
      // Target bounds
      isPhone: width < BREAKPOINTS.md,
      isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
      isDesktop: width >= BREAKPOINTS.lg,

      // Specific minimal checks
      sm: width >= BREAKPOINTS.sm,
      md: width >= BREAKPOINTS.md,
      lg: width >= BREAKPOINTS.lg,
      xl: width >= BREAKPOINTS.xl,
      xxl: width >= BREAKPOINTS.xxl,
    };
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const handleResize = () => {
      // Debounce window resizes significantly because mobile devices
      // sometimes spam resize events during scrolling due to URL bar collapsing
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setState(getResponsiveState());
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    // Check orientation change explicitly on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return state;
}
