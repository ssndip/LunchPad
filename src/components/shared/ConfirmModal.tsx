import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

export interface ConfirmConfig {
  title: string;
  message: string;
  onConfirm: (value?: string) => void;
  isDestructive?: boolean;
  confirmText?: string;
  isPrompt?: boolean;
  initialValue?: string;
  placeholder?: string;
}

interface ConfirmModalProps {
  config: ConfirmConfig | null;
  onClose: () => void;
  cancelLabel?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  config,
  onClose,
  cancelLabel = 'Cancel',
}) => {
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    if (config?.isPrompt) {
      setInputValue(config.initialValue || '');
    }
  }, [config]);

  const handleConfirm = () => {
    if (!config) return;
    config.onConfirm(config.isPrompt ? inputValue : undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {config && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-neutral-100 overflow-hidden"
          >
            {/* Colour accent strip */}
            <div
              className={`absolute top-0 left-0 w-full h-1.5 ${
                config.isDestructive ? 'bg-red-500' : 'bg-neutral-900'
              }`}
            />

            <div className="flex items-center gap-4 mb-6">
              {config.isDestructive ? (
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-900 shrink-0">
                  <HelpCircle className="w-6 h-6" />
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{config.title}</h3>
                <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest mt-1">
                  {config.isPrompt ? 'Awaiting Input' : 'Please confirm this action'}
                </p>
              </div>
            </div>

            <p className="text-neutral-600 mb-6 leading-relaxed text-sm">{config.message}</p>

            {config.isPrompt && (
              <div className="mb-8">
                <input
                  type="text"
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={config.placeholder}
                  onKeyDown={(e) => e.key === 'Enter' && inputValue.trim() && handleConfirm()}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 transition-all placeholder:text-neutral-300 shadow-inner"
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={config.isPrompt && !inputValue.trim()}
                className={`flex-1 py-3.5 px-6 rounded-2xl text-white font-bold transition-all shadow-lg text-sm disabled:opacity-30 ${
                  config.isDestructive
                    ? 'bg-red-500 hover:bg-red-600 shadow-red-100'
                    : 'bg-neutral-900 hover:bg-neutral-800 shadow-neutral-100'
                }`}
              >
                {config.confirmText ?? 'Confirm'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
