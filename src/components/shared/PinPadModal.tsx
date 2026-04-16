import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, X, ShieldCheck, Lock } from 'lucide-react';

interface PinPadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => void;
  t: (key: string) => string;
}

export const PinPadModal: React.FC<PinPadModalProps> = ({ isOpen, onClose, onSubmit, t }) => {
  const [pin, setPin] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setIsError(false);
    }
  }, [isOpen]);

  const handleKeyPress = (val: string) => {
    if (pin.length < 6) {
      const newPin = pin + val;
      setPin(newPin);
      if (newPin.length === 6) {
        onSubmit(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setIsError(false);
  };

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            className="w-full max-w-md bg-white/90 backdrop-blur-2xl rounded-[40px] shadow-2xl overflow-hidden border border-white/20"
          >
            {/* Header */}
            <div className="p-8 text-center relative">
              <button 
                onClick={onClose}
                className="absolute top-6 right-6 p-2 text-neutral-400 hover:text-neutral-900 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="w-16 h-16 bg-neutral-900 rounded-2xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl shadow-neutral-200">
                <Lock className="w-8 h-8" />
              </div>
              
              <h2 className="text-2xl font-black text-neutral-900 mb-2">
                Order Verification
              </h2>
              <p className="text-neutral-500 font-medium tracking-tight">
                Please enter your 6-digit security PIN
              </p>
            </div>

            {/* PIN Display */}
            <div className="px-8 pb-4">
              <div className="flex justify-center gap-3 mb-8">
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={isError ? { x: [0, -5, 5, -5, 5, 0] } : {}}
                    className={`w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all ${
                      pin[i] 
                        ? 'border-neutral-900 bg-neutral-900 text-white' 
                        : 'border-neutral-100 bg-neutral-50 text-neutral-300'
                    }`}
                  >
                    {pin[i] ? '•' : ''}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Keypad */}
            <div className="px-8 pb-10">
              <div className="grid grid-cols-3 gap-4">
                {digits.map(d => (
                  <button
                    key={d}
                    onClick={() => handleKeyPress(d)}
                    className="h-20 rounded-3xl bg-white border border-neutral-100 text-2xl font-black text-neutral-900 hover:bg-neutral-50 active:scale-90 transition-all shadow-sm"
                  >
                    {d}
                  </button>
                ))}
                <div className="flex items-center justify-center">
                   {/* Empty space for alignment */}
                </div>
                <button
                  onClick={() => handleKeyPress('0')}
                  className="h-20 rounded-3xl bg-white border border-neutral-100 text-2xl font-black text-neutral-900 hover:bg-neutral-50 active:scale-90 transition-all shadow-sm"
                >
                  0
                </button>
                <button
                  onClick={handleDelete}
                  className="h-20 rounded-3xl bg-neutral-50 text-neutral-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all flex items-center justify-center"
                >
                  <Delete className="w-8 h-8" />
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-neutral-50 p-6 text-center border-t border-neutral-100">
               <div className="flex items-center justify-center gap-2 text-neutral-400">
                 <ShieldCheck className="w-4 h-4" />
                 <span className="text-[10px] font-mono uppercase tracking-widest font-bold">Secure PIN Ordering</span>
               </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
