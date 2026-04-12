import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  ChevronLeft,
} from "lucide-react";
import * as api from "../../api";

interface ManagerLoginProps {
  onLogin: (pin: string) => void;
  onBack: () => void;
  t: (key: string) => string;
}

export const ManagerLogin: React.FC<ManagerLoginProps> = ({
  onLogin,
  onBack,
  t,
}) => {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length < 4) return;

    setLoading(true);
    setError(null);

    try {
      // Verify PIN by attempting to fetch cards/orders
      const [cardsRes, ordersRes] = await api.verifyPin(pin);

      if (cardsRes.status === 401 || ordersRes.status === 401) {
        setError(t("settings.invalid_pin") || "Invalid admin PIN");
      } else if (!cardsRes.ok || !ordersRes.ok) {
        setError("Server error. Please try again.");
      } else {
        onLogin(pin);
      }
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-neutral-900 flex items-center justify-center p-6 relative">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-10">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-white rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <button
          onClick={onBack}
          className="group mb-8 flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">
            {t("modals.cancel")}
          </span>
        </button>

        <div className="bg-white rounded-[48px] p-10 shadow-2xl overflow-hidden relative">
          {/* Top accent strip */}
          <div className="absolute top-0 left-0 w-full h-2 bg-neutral-900" />

          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-neutral-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-neutral-900" />
            </div>
            <h1 className="text-3xl font-black text-neutral-900 uppercase tracking-tighter mb-2">
              Manager Access
            </h1>
            <p className="text-neutral-500 text-sm font-medium">
              Enter your administrative PIN to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                value={pin}
                autoFocus
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••"
                className="w-full h-20 text-center text-4xl font-black tracking-[0.5em] bg-neutral-50 rounded-3xl border-2 border-neutral-100 focus:border-neutral-900 transition-all focus:outline-none placeholder:tracking-normal placeholder:text-neutral-200"
              />
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute -bottom-10 left-0 right-0 flex items-center justify-center gap-2 text-red-500 font-bold text-xs"
                  >
                    <AlertCircle className="w-3 h-3" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full h-16 bg-neutral-900 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-neutral-200"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <span>{t("navigation.admin_login")}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};
