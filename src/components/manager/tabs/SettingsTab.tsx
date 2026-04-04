import React from 'react';
import { motion } from 'motion/react';
import { Settings, Users, Plus, Zap, Clock, AlertCircle, CheckCircle2, Loader2, Calendar } from 'lucide-react';
import { Language } from '../../../translations';
import { SystemClock } from '../../shared/SystemClock';

interface SettingsTabProps {
  lang: Language;
  setLang: (l: Language) => void;
  globalAccess: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskOpen: boolean;
  computedKioskOpen: boolean;
  kioskAutoTiming: boolean;
  kioskOpenTime: string;
  kioskCloseTime: string;
  kioskCloseDay: number;
  newPin: string;
  setNewPin: (v: string) => void;
  confirmPin: string;
  setConfirmPin: (v: string) => void;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  onUpdateSettings: (
    access: boolean,
    orderBtn: boolean,
    testMode?: boolean,
    autoTiming?: boolean,
    openTime?: string,
    closeTime?: string,
    closeDay?: number,
  ) => void;
  onToggleKiosk: (open: boolean) => void;
  onUpdatePin: () => void;
  t: (key: string) => string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  lang, setLang, globalAccess, orderButtonEnabled, testModeEnabled,
  kioskOpen, computedKioskOpen, kioskAutoTiming, kioskOpenTime, kioskCloseTime,
  kioskCloseDay, newPin, setNewPin, confirmPin, setConfirmPin, pinUpdateStatus,
  onUpdateSettings, onToggleKiosk, onUpdatePin, t,
}) => {
  const Toggle = ({
    checked, onChange, color = 'bg-neutral-900', label,
  }: { checked: boolean; onChange: () => void; color?: string; label: string }) => (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${checked ? color : 'bg-neutral-200'}`}
    >
      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm ${checked ? 'left-9' : 'left-1'}`} />
    </button>
  );

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-neutral-900 mb-2">{t('navigation.system_settings')}</h1>
          <p className="text-neutral-500 text-sm md:text-base">{t('settings.global_desc')}</p>
        </div>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Language */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Users className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.language')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.language')}</p>
              </div>
            </div>
            <div className="flex gap-2 p-1 bg-neutral-100 rounded-xl">
              {(['en', 'bg'] as Language[]).map((l) => (
                <button key={l} onClick={() => setLang(l)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${lang === l ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-700'}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global access */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Settings className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.global_access')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.global_access_desc')}</p>
              </div>
            </div>
            <Toggle checked={globalAccess} onChange={() => onUpdateSettings(!globalAccess, orderButtonEnabled, testModeEnabled)} label="Toggle Global Access" />
          </div>
          <div className="p-5 bg-neutral-50 rounded-3xl border border-neutral-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-neutral-400 mt-0.5 shrink-0" />
              <p className="text-xs text-neutral-500 leading-relaxed font-serif italic">{t('settings.global_access_warning')}</p>
            </div>
          </div>
        </div>

        {/* Ordering toggle */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Plus className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.ordering_functionality')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.ordering_desc')}</p>
              </div>
            </div>
            <Toggle checked={orderButtonEnabled} onChange={() => onUpdateSettings(globalAccess, !orderButtonEnabled, testModeEnabled)} label="Toggle Ordering" />
          </div>
        </div>

        {/* Test mode */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center"><Zap className="w-6 h-6 text-indigo-600" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.test_mode')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.test_mode_desc')}</p>
              </div>
            </div>
            <Toggle checked={testModeEnabled} onChange={() => onUpdateSettings(globalAccess, orderButtonEnabled, !testModeEnabled)} label="Toggle Test Mode" color="bg-indigo-600" />
          </div>
        </div>

        {/* Kiosk status + auto timing */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Clock className="w-6 h-6 text-neutral-900" /></div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-xl font-bold text-neutral-900">{t('settings.kiosk_status')}</h3>
                  <div className="px-3 py-1 bg-neutral-900 text-white rounded-lg text-[10px] font-mono font-bold tracking-wider flex items-center gap-2 shadow-lg">
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${kioskOpen ? 'bg-green-500' : 'bg-red-500'}`} />
                    <SystemClock lang={lang} />
                  </div>
                </div>
                <p className="text-sm text-neutral-500 italic mt-1">{t('settings.kiosk_status_desc')}</p>
              </div>
            </div>
            <div className="ml-4">
              <Toggle
                checked={computedKioskOpen}
                onChange={() => {
                  if (kioskAutoTiming) onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, false);
                  onToggleKiosk(!kioskOpen);
                }}
                label="Toggle Kiosk Status"
              />
            </div>
          </div>

          <div className="h-px bg-neutral-100 mb-8" />

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center"><Calendar className="w-6 h-6 text-amber-600" /></div>
              <div>
                <h4 className="text-lg font-bold text-neutral-900">{t('settings.auto_timing')}</h4>
                <p className="text-sm text-neutral-500 italic">{t('settings.auto_timing_desc')}</p>
              </div>
            </div>
            <Toggle
              checked={kioskAutoTiming}
              onChange={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, !kioskAutoTiming)}
              label="Toggle Auto Timing"
            />
          </div>

          {kioskAutoTiming && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-neutral-50 rounded-3xl border border-neutral-100"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="kioskOpenTime" className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">{t('settings.open_at')}</label>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100 uppercase">{t('settings.today')}</span>
                </div>
                <input
                  id="kioskOpenTime" type="time" value={kioskOpenTime}
                  onChange={(e) => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, kioskAutoTiming, e.target.value, kioskCloseTime)}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="kioskCloseTime" className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">{t('settings.close_at')}</label>
                  <div className="flex bg-neutral-100 p-0.5 rounded-lg border border-neutral-200">
                    {[{ v: 0, l: t('settings.today') }, { v: 1, l: t('settings.tomorrow') }].map(({ v, l }) => (
                      <button key={v} onClick={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, kioskAutoTiming, kioskOpenTime, kioskCloseTime, v)}
                        className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${kioskCloseDay === v ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-400 hover:text-neutral-600'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  id="kioskCloseTime" type="time" value={kioskCloseTime}
                  onChange={(e) => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, kioskAutoTiming, kioskOpenTime, e.target.value)}
                  className="w-full px-4 py-3 bg-white rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono focus:outline-none"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Change PIN */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center"><Settings className="w-6 h-6 text-red-600" /></div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{t('settings.change_pin')}</h3>
              <p className="text-sm text-neutral-500 italic">Update your administrative PIN</p>
            </div>
          </div>

          <div className="space-y-4 max-w-sm">
            <div>
              <label htmlFor="newPin" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">{t('settings.new_pin')}</label>
              <input
                id="newPin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)}
                placeholder="****"
                className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirmPin" className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5">{t('settings.confirm_new_pin')}</label>
              <input
                id="confirmPin" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)}
                placeholder="****"
                className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all font-mono focus:outline-none"
              />
            </div>
            {newPin && confirmPin && newPin !== confirmPin && (
              <p className="text-xs text-red-500 font-bold">PINs do not match</p>
            )}
            <button
              onClick={onUpdatePin}
              disabled={pinUpdateStatus === 'loading' || !newPin || newPin !== confirmPin}
              className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                pinUpdateStatus === 'success' ? 'bg-green-600 text-white' : pinUpdateStatus === 'error' ? 'bg-red-600 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50'
              }`}
            >
              {pinUpdateStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : pinUpdateStatus === 'success' ? <><CheckCircle2 className="w-5 h-5" /> PIN Updated</> : t('settings.update_pin')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
