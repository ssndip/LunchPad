import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Radio, CheckCircle, AlertCircle, RefreshCw, X, CreditCard } from 'lucide-react';
import { useNfcWriter } from '../../../hooks/useNfcWriter';
import { useTranslation } from '../../../hooks/useTranslation';
import { Card } from '../../../types';

interface NfcWriteModalProps {
  card: Card | null;
  onClose: () => void;
}

export const NfcWriteModal: React.FC<NfcWriteModalProps> = ({ card, onClose }) => {
  const { t } = useTranslation();
  const { writeId, writeStatus, errorMessage, reset } = useNfcWriter();

  useEffect(() => {
    if (card && writeStatus === 'idle') {
      writeId(card.rfid);
    }
  }, [card, writeStatus, writeId]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleRetry = () => {
    if (card) {
      writeId(card.rfid);
    }
  };

  if (!card) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-md"
        />

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20, transition: { duration: 0.15 } }}
          className="relative bg-white rounded-[32px] w-full max-w-md p-8 shadow-2xl border border-neutral-100 overflow-hidden"
        >
          {/* Accent bar */}
          <div
            className={`absolute top-0 left-0 w-full h-1.5 transition-colors ${
              writeStatus === 'success'
                ? 'bg-emerald-500'
                : writeStatus === 'error'
                ? 'bg-red-500'
                : 'bg-indigo-600 animate-pulse'
            }`}
          />

          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 p-2 rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            aria-label={t('modals.close')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">
                {t('cards.write_nfc') || 'Program NFC Tag'}
              </h3>
              <p className="text-xs text-neutral-500 font-mono">
                {card.ownerName} ({card.rfid})
              </p>
            </div>
          </div>

          {/* Main Status Area */}
          <div className="my-8 flex flex-col items-center justify-center text-center">
            {(writeStatus === 'idle' || writeStatus === 'waiting' || writeStatus === 'writing') && (
              <div className="py-6 flex flex-col items-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 animate-pulse">
                    <Radio className="w-12 h-12" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 animate-ping" />
                </div>
                <h4 className="text-lg font-bold text-neutral-900 mb-2">
                  {t('cards.nfc_ready_title') || 'Ready to Write'}
                </h4>
                <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                  {t('cards.nfc_ready_desc') ||
                    'Hold an NFC tag or sticker near the back of your device to write the RFID.'}
                </p>
                <div className="mt-4 px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-200 text-xs font-mono font-bold text-neutral-700 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-neutral-400" />
                  <span>Payload: {card.rfid}</span>
                </div>
              </div>
            )}

            {writeStatus === 'success' && (
              <div className="py-6 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <h4 className="text-lg font-bold text-emerald-900 mb-2">
                  {t('cards.nfc_success_title') || 'Tag Written Successfully!'}
                </h4>
                <p className="text-sm text-neutral-500 max-w-xs leading-relaxed">
                  {t('cards.nfc_success_desc') ||
                    `RFID sticker has been programmed with code: ${card.rfid}`}
                </p>
              </div>
            )}

            {writeStatus === 'error' && (
              <div className="py-6 flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-6">
                  <AlertCircle className="w-12 h-12" />
                </div>
                <h4 className="text-lg font-bold text-red-900 mb-2">
                  {t('cards.nfc_error_title') || 'Write Failed'}
                </h4>
                <p className="text-sm text-red-600 max-w-xs leading-relaxed mb-4">
                  {errorMessage || 'Failed to program NFC tag'}
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
            >
              {writeStatus === 'success' ? t('modals.close') || 'Close' : t('modals.cancel') || 'Cancel'}
            </button>

            {writeStatus === 'error' && (
              <button
                onClick={handleRetry}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-neutral-100"
              >
                <RefreshCw className="w-4 h-4" />
                {t('cards.nfc_retry') || 'Retry Write'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
