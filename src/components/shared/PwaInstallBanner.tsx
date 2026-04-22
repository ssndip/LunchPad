import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone } from "lucide-react";
import { usePWA } from "../../hooks/usePWA";

import { useTranslation } from "../../hooks/useTranslation";

interface PwaInstallBannerProps {
  onNeedInstructions?: () => void;
}

export const PwaInstallBanner: React.FC<PwaInstallBannerProps> = ({
  onNeedInstructions,
}) => {
  const { t } = useTranslation();
  const {
    canInstall,
    installApp,
    isStandalone,
    isIOS,
    isAndroid,
    deferredPrompt,
  } = usePWA();
  const [dismissed, setDismissed] = React.useState(false);

  if (isStandalone || !canInstall || dismissed || (!isIOS && !isAndroid))
    return null;

  const handleInstall = () => {
    if (isIOS || (isAndroid && !deferredPrompt)) {
      onNeedInstructions?.();
    } else {
      installApp();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-80"
      >
        <div className="relative overflow-hidden rounded-[24px] border border-white/40 bg-white/70 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.15)] backdrop-blur-2xl">
          <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-violet-400/10 blur-3xl" />

          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 p-2.5 text-white shadow-lg">
                <Smartphone className="h-full w-full" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-sm font-black uppercase tracking-tight text-neutral-900">
                  {t("pwa.install_title") || "Install LunchPad"}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                  {t("pwa.install_description") ||
                    "Add to home screen for better experience"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="group flex h-8 w-8 items-center justify-center rounded-full hover:bg-neutral-900/5 transition-colors"
              aria-label={t("modals.close")}
              title={t("modals.close")}
            >
              <X className="h-4 w-4 text-neutral-300 group-hover:text-neutral-900 transition-colors" />
            </button>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-xl shadow-neutral-900/20 active:scale-95 transition-transform"
            >
              <Download className="h-3.5 w-3.5" />
              {t("pwa.install_button") || "Install Now"}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
