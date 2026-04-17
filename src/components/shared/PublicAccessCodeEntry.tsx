import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, ShieldCheck, ArrowRight, Loader2, Globe, AlertCircle } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';

interface PublicAccessCodeEntryProps {
  onUnlock: (code: string) => Promise<{ success: boolean; error?: string }>;
}

export const PublicAccessCodeEntry: React.FC<PublicAccessCodeEntryProps> = ({ onUnlock }) => {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await onUnlock(code);
      if (!res.success) {
        setError(res.error || t('settings.invalid_code'));
      }
    } catch (err) {
      setError(t('settings.connection_err'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md mx-4 p-8 bg-white rounded-[40px] border border-neutral-100 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 bg-neutral-900 rounded-[30px] flex items-center justify-center mb-6 shadow-xl shadow-neutral-200">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-black text-neutral-900 mb-2">{t('settings.access_secured')}</h2>
          <p className="text-neutral-500 max-w-[280px]">
             {t('settings.access_restricted_desc')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <input
              type="text"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('settings.enter_code')}
              className="w-full px-6 py-5 bg-neutral-50 rounded-2xl border-2 border-transparent focus:border-neutral-900 focus:bg-white transition-all text-center text-2xl font-black tracking-[0.5em] placeholder:tracking-normal placeholder:font-bold focus:outline-none"
            />
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity">
              <ShieldCheck className="w-6 h-6 text-neutral-900" />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-center gap-2 text-red-500 font-bold text-sm bg-red-50 py-3 rounded-xl"
              >
                <AlertCircle className="w-4 h-4" /> {error}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-16 bg-neutral-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-30 disabled:pointer-events-none shadow-xl shadow-neutral-200"
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <>
                {t('settings.unlock_kiosk')} <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-10 flex items-center justify-center gap-2 text-neutral-400">
          <Globe className="w-4 h-4" />
          <span className="text-[10px] font-mono uppercase tracking-widest">{t('settings.remote_access_active')}</span>
        </div>
      </motion.div>
    </div>
  );
};
