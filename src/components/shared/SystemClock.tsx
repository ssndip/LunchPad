import React from 'react';
import { Language } from '../../translations';

interface SystemClockProps {
  lang: Language;
}

export const SystemClock: React.FC<SystemClockProps> = ({ lang }) => {
  const [time, setTime] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {time.toLocaleTimeString(lang === 'bg' ? 'bg-BG' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })}
    </>
  );
};
