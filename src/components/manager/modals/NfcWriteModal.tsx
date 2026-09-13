import React, { useEffect } from 'react';
import { Radio, CheckCircle, AlertCircle, RefreshCw, CreditCard } from 'lucide-react';
import { useNfcWriter } from '../../../hooks/useNfcWriter';
import { useTranslation } from '../../../hooks/useTranslation';
import { Card } from '../../../types';
import { Sheet } from '../../shared/Sheet';

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

  return (
    <Sheet
      isOpen={!!card}
      onClose={handleClose}
      title={t('cards.write_nfc') || 'Program NFC Tag'}
    >
      {card && (
        <>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <p className="text-xs text-neutral-500 font-mono">
              {card.ownerName} ({card.rfid})
            </p>
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
              className="touch-target-h flex-1 py-3.5 px-6 rounded-2xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
            >
              {writeStatus === 'success' ? t('modals.close') || 'Close' : t('modals.cancel') || 'Cancel'}
            </button>

            {writeStatus === 'error' && (
              <button
                onClick={handleRetry}
                className="touch-target-h flex-1 py-3.5 px-6 rounded-2xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-neutral-100"
              >
                <RefreshCw className="w-4 h-4" />
                {t('cards.nfc_retry') || 'Retry Write'}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
};
