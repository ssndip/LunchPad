import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Users, Plus, Zap, Clock, AlertCircle, CheckCircle2, Loader2, Calendar, Smartphone, Download, Info, Share, CreditCard } from 'lucide-react';
import { Language } from '../../../translations';
import { SystemClock } from '../../shared/SystemClock';
import { usePWA } from '../../../hooks/usePWA';

import { useTranslation } from '../../../hooks/useTranslation';

interface SettingsTabProps {
  globalAccess: boolean;
  publicAccessCode: string;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  bgnEnabled: boolean;
  newPin: string;
  setNewPin: (v: string) => void;
  confirmPin: string;
  setConfirmPin: (v: string) => void;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  availableLanguages: { code: string, name: string }[];
  onImportLanguage: (code: string, name: string, data: any) => Promise<void>;
  onDeleteLanguage: (code: string) => Promise<void>;
  onUpdateSettings: (
    access: boolean,
    orderBtn: boolean,
    testMode?: boolean,
    publicCode?: string,
    kioskMode?: boolean,
    allowPwa?: boolean,
    systemLanguage?: string,
    bgnEnabled?: boolean,
  ) => void;
  onUpdatePin: () => void;
  onInstallApp?: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  globalAccess, publicAccessCode, orderButtonEnabled, testModeEnabled,
  kioskModeEnabled, allowPWAInstall, bgnEnabled,
  newPin, setNewPin, confirmPin, setConfirmPin, pinUpdateStatus,
  availableLanguages, onImportLanguage, onDeleteLanguage,
  onUpdateSettings, onUpdatePin, onInstallApp,
}) => {
  const { t, lang } = useTranslation();
  const [localPublicCode, setLocalPublicCode] = React.useState(publicAccessCode);
  const { canInstall, installApp, isIOS, isAndroid, isStandalone, deferredPrompt } = usePWA();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  React.useEffect(() => {
    setLocalPublicCode(publicAccessCode);
  }, [publicAccessCode]);

  const handleExportTemplate = () => {
    // We import translations here to get the full object
    import('../../../translations').then(({ translations }) => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(translations.en, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", "translation_template_en.json");
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    });
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target?.result as string;
        const data = JSON.parse(content);
        
        const code = prompt("Enter language code (e.g. fr, de, es):");
        if (!code) return;
        const name = prompt("Enter language name (e.g. French, German):");
        if (!name) return;

        await onImportLanguage(code, name, data);
        alert("Language imported successfully!");
      } catch (err) {
        alert("Failed to parse language file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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

      <div className="max-w-2xl space-y-6 pb-20">
        {/* Localization & Info */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                <CreditCard className="w-5 h-5 text-neutral-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-neutral-900">{t('settings.enable_bgn')}</p>
                <p className="text-[10px] text-neutral-400 font-medium">{t('settings.enable_bgn_desc')}</p>
              </div>
            </div>
            <button
              onClick={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, publicAccessCode, kioskModeEnabled, allowPWAInstall, lang, !bgnEnabled)}
              role="switch" aria-checked={bgnEnabled}
              className={`w-14 h-8 rounded-full transition-all relative focus:outline-none ${bgnEnabled ? 'bg-neutral-900 shadow-lg shadow-neutral-200' : 'bg-neutral-200'}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all flex items-center justify-center ${bgnEnabled ? 'left-[1.65rem]' : 'left-1'}`}>
                {bgnEnabled && <div className="w-1 h-1 bg-neutral-900 rounded-full" />}
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Users className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.language')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.language')}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 max-w-[240px]">
              {availableLanguages.map((l) => (
                <div key={l.code} className="group relative">
                  <button
                    onClick={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, publicAccessCode, kioskModeEnabled, allowPWAInstall, l.code, bgnEnabled)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${lang === l.code ? 'bg-neutral-900 text-white shadow-sm' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-700'}`}
                  >
                    {l.code.toUpperCase()}
                  </button>
                  {l.code !== 'en' && l.code !== 'bg' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete language ${l.name}?`)) onDeleteLanguage(l.code);
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] shadow-sm"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleExportTemplate}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-50 transition-all text-xs"
            >
              <Download className="w-4 h-4" /> {t('cards.export_data')} (JSON)
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileImport} accept=".json" className="hidden" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all text-xs"
            >
              <Plus className="w-4 h-4" /> {t('cards.import_file')}
            </button>
          </div>
        </div>

        {/* PWA & Kiosk Settings */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center"><Smartphone className="w-6 h-6 text-violet-600" /></div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{t('pwa.title')}</h3>
              <p className="text-sm text-neutral-500 italic">{isStandalone ? 'Running in Standalone Mode' : 'Browser Mode'}</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-neutral-900">{t('pwa.enable_kiosk')}</h4>
                <p className="text-xs text-neutral-500">{t('pwa.enable_kiosk_desc')}</p>
              </div>
              <Toggle 
                checked={kioskModeEnabled} 
                onChange={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, publicAccessCode, !kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} 
                color="bg-violet-600"
                label="Toggle Kiosk Mode" 
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-neutral-50">
              <div>
                <h4 className="font-bold text-neutral-900">{t('pwa.allow_install')}</h4>
                <p className="text-xs text-neutral-500">{t('pwa.allow_install_desc')}</p>
              </div>
              <Toggle 
                checked={allowPWAInstall} 
                onChange={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, publicAccessCode, kioskModeEnabled, !allowPWAInstall, lang, bgnEnabled)} 
                color="bg-violet-600"
                label="Toggle Allow Install" 
              />
            </div>

            {allowPWAInstall && !isStandalone && (isIOS || isAndroid) && (
              <div className="pt-6 border-t border-neutral-100">
                {(isIOS || (isAndroid && !deferredPrompt)) ? (
                  <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100">
                    <div className="flex items-center gap-3 mb-3 text-violet-600">
                      <Share className="w-5 h-5" />
                      <h4 className="font-bold text-sm tracking-tight">{isIOS ? t('pwa.ios_install_title') : t('pwa.android_install_title')}</h4>
                    </div>
                    <p className="text-xs text-neutral-500 leading-relaxed italic mb-4">{isIOS ? t('pwa.ios_install_desc') : t('pwa.android_install_desc')}</p>
                    <button
                      onClick={onInstallApp}
                      className="w-full py-3 bg-white border border-violet-200 text-violet-600 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-violet-50 transition-all flex items-center justify-center gap-2"
                    >
                      <Info className="w-4 h-4" />
                      {t('pwa.how_to_install')}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onInstallApp || installApp}
                    disabled={!canInstall && !onInstallApp}
                    className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold uppercase tracking-widest text-sm shadow-lg shadow-violet-200 hover:bg-violet-700 transition-all flex items-center justify-center gap-2 disabled:opacity-30"
                  >
                    <Download className="w-5 h-5" />
                    {t('pwa.install_button')}
                  </button>
                )}
              </div>
            )}
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
            <Toggle checked={globalAccess} onChange={() => onUpdateSettings(!globalAccess, orderButtonEnabled, testModeEnabled, publicAccessCode, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} label="Toggle Global Access" />
          </div>
          <div className="p-5 bg-neutral-50 rounded-3xl border border-neutral-100">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-neutral-400 mt-0.5 shrink-0" />
              <p className="text-xs text-neutral-500 leading-relaxed font-serif italic">{t('settings.global_access_warning')}</p>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-neutral-100">
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">{t('settings.public_code')}</label>
            <div className="flex gap-4">
              <input
                type="text"
                value={localPublicCode}
                onChange={(e) => setLocalPublicCode(e.target.value)}
                placeholder={t('settings.public_code_placeholder')}
                className="flex-1 px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all focus:outline-none text-sm"
              />
              <button
                onClick={() => onUpdateSettings(globalAccess, orderButtonEnabled, testModeEnabled, localPublicCode, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)}
                disabled={localPublicCode === publicAccessCode}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-30"
              >
                {t('settings.update')}
              </button>
            </div>
            <p className="mt-2 text-[10px] text-neutral-400 italic">{t('settings.public_code_desc')}</p>
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
            <Toggle checked={orderButtonEnabled} onChange={() => onUpdateSettings(globalAccess, !orderButtonEnabled, testModeEnabled, publicAccessCode, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} label="Toggle Ordering" />
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
            <Toggle checked={testModeEnabled} onChange={() => onUpdateSettings(globalAccess, orderButtonEnabled, !testModeEnabled, publicAccessCode, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} label="Toggle Test Mode" color="bg-indigo-600" />
          </div>
        </div>

        {/* Change PIN */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center"><Settings className="w-6 h-6 text-red-600" /></div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{t('settings.change_pin')}</h3>
              <p className="text-sm text-neutral-500 italic">{t('settings.update_pin_desc')}</p>
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
              <p className="text-xs text-red-500 font-bold">{t('settings.pin_mismatch')}</p>
            )}
            <button
              onClick={onUpdatePin}
              disabled={pinUpdateStatus === 'loading' || !newPin || newPin !== confirmPin}
              className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                pinUpdateStatus === 'success' ? 'bg-green-600 text-white' : pinUpdateStatus === 'error' ? 'bg-red-600 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50'
              }`}
            >
              {pinUpdateStatus === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : pinUpdateStatus === 'success' ? <><CheckCircle2 className="w-5 h-5" /> {t('settings.pin_updated')}</> : t('settings.update_pin')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
