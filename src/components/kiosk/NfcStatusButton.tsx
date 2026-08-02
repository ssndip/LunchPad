import React from 'react';
import { Wifi, AlertCircle } from 'lucide-react';

interface NfcStatusButtonProps {
  supported: boolean;
  scanning: boolean;
  error: string | null;
  onInit: () => void;
}

export function NfcStatusButton({ supported, scanning, error, onInit }: NfcStatusButtonProps) {
  if (!supported) return null;

  let color = 'text-neutral-400';
  let icon = <Wifi className="w-5 h-5" />;
  
  if (scanning) {
    color = 'text-green-500 animate-pulse';
  } else if (error) {
    color = 'text-red-500';
    icon = <AlertCircle className="w-5 h-5" />;
  }

  return (
    <button
      onClick={onInit}
      className={`p-2 rounded-xl hover:bg-neutral-100 transition-all ${color}`}
      title={error || (scanning ? 'NFC Scanning Active' : 'NFC Inactive (Tap to scan)')}
      aria-label={error || (scanning ? 'NFC Scanning Active' : 'NFC Inactive (Tap to scan)')}
    >
      {icon}
    </button>
  );
}
