import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ 
  children, 
  onRefresh,
  disabled = false 
}) => {
  const { useMobileLayout } = useResponsive();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const controls = useAnimation();
  
  // Refresh threshold
  const THRESHOLD = 80;
  // Max pull distance
  const MAX_PULL = 150;

  useEffect(() => {
    if (!useMobileLayout || disabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Traverse up the DOM to see if any scrollable container is currently scrolled down.
      // If a container is scrolled down, we should not trigger pull-to-refresh.
      let target = e.target as HTMLElement | null;
      let isScrollTop = true;
      
      while (target && target !== document.body) {
        if (target.scrollTop > 0) {
          isScrollTop = false;
          break;
        }
        target = target.parentElement;
      }

      if (isScrollTop && window.scrollY === 0) {
        startY.current = e.touches[0].pageY;
      } else {
        startY.current = 0;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (startY.current === 0 || isRefreshing) return;

      const currentY = e.touches[0].pageY;
      const distance = currentY - startY.current;

      if (distance > 0) {
        // Apply resistance (logarithmic-like pull)
        const resistance = 0.4;
        const boundedDistance = Math.min(distance * resistance, MAX_PULL);
        setPullDistance(boundedDistance);
        
        // Prevent default browser refresh if we are handling it
        if (distance > 10) {
          if (e.cancelable) e.preventDefault();
        }
      } else {
        // Let pullDistance scale back if they drag up before letting go
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (startY.current === 0 || isRefreshing) return;

      if (pullDistance >= THRESHOLD) {
        triggerRefresh();
      } else {
        // Snap back
        setPullDistance(0);
      }
      startY.current = 0;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [useMobileLayout, pullDistance, isRefreshing, disabled]);

  const triggerRefresh = () => {
    setIsRefreshing(true);
    setPullDistance(THRESHOLD);
    
    // Play animation then reload
    setTimeout(() => {
      if (onRefresh) {
        onRefresh();
      } else {
        window.location.reload();
      }
    }, 800);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Indicator */}
      <motion.div
        className="absolute left-0 right-0 z-50 flex justify-center pointer-events-none"
        style={{ top: -40 }}
        animate={{ 
          y: pullDistance,
          opacity: pullDistance > 10 ? 1 : 0,
          scale: pullDistance / THRESHOLD
        }}
        transition={isRefreshing ? { 
          repeat: Infinity, 
          duration: 1, 
          ease: "linear" 
        } : { type: 'spring', damping: 20, stiffness: 300 }}
      >
        <div className="bg-white rounded-full p-2.5 shadow-xl border border-neutral-100 flex items-center justify-center">
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: (pullDistance / THRESHOLD) * 360 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 1, ease: 'linear' } : { type: 'tween' }}
          >
            <RefreshCw className={`w-5 h-5 ${pullDistance >= THRESHOLD ? 'text-violet-600' : 'text-neutral-400'}`} />
          </motion.div>
        </div>
      </motion.div>

      {/* Content wrapper with slight downward shift */}
      <motion.div
        className="w-full h-full"
        animate={{ y: isRefreshing ? 20 : pullDistance * 0.3 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {children}
      </motion.div>
    </div>
  );
};
