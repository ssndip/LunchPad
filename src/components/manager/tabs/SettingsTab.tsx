import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Users, Plus, Zap, Clock, AlertCircle, CheckCircle2, Loader2, Calendar, Smartphone, Download, Info, Share, CreditCard, ChevronDown, X, Check, Globe, Sparkles } from 'lucide-react';
import { Language } from '../../../translations';
import { SystemClock } from '../../shared/SystemClock';
import { usePWA } from '../../../hooks/usePWA';

import { useTranslation } from '../../../hooks/useTranslation';

interface SettingsTabProps {
  adminWhitelistEnabled: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  bgnEnabled: boolean;
  adminWhitelist: string;
  announcement: string;
  aiProvider: string;
  aiApiKey: string;
  newPin: string;
  setNewPin: (v: string) => void;
  confirmPin: string;
  setConfirmPin: (v: string) => void;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  availableLanguages: { code: string, name: string }[];
  onImportLanguage: (code: string, name: string, data: any) => Promise<void>;
  onDeleteLanguage: (code: string) => Promise<void>;
  onUpdateSettings: (
    adminWhitelistEnabled: boolean,
    orderBtn: boolean,
    testMode?: boolean,
    kioskMode?: boolean,
    allowPwa?: boolean,
    systemLanguage?: string,
    bgnEnabled?: boolean,
    adminWhitelist?: string,
    announcement?: string,
    aiProvider?: string,
    aiApiKey?: string,
    preIdentificationEnabled?: boolean
  ) => void;
  onUpdatePin: () => void;
  onInstallApp?: () => void;
  confirm?: (config: any) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  adminWhitelistEnabled, orderButtonEnabled, testModeEnabled,
  kioskModeEnabled, allowPWAInstall, bgnEnabled, preIdentificationEnabled, adminWhitelist, announcement,
  aiProvider, aiApiKey,
  newPin, setNewPin, confirmPin, setConfirmPin, pinUpdateStatus,
  availableLanguages, onImportLanguage, onDeleteLanguage,
  onUpdateSettings, onUpdatePin, onInstallApp,
  confirm,
}) => {
  const { t, lang } = useTranslation();

  const { canInstall, installApp, isIOS, isAndroid, isStandalone, deferredPrompt } = usePWA();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [localWhitelist, setLocalWhitelist] = React.useState(adminWhitelist);
  const [pendingLanguage, setPendingLanguage] = React.useState(lang);
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [importModalData, setImportModalData] = React.useState<any | null>(null);
  const [localAnnouncement, setLocalAnnouncement] = React.useState(announcement);
  const [localAiApiKey, setLocalAiApiKey] = React.useState(aiApiKey);
  const [showAiKey, setShowAiKey] = React.useState(false);

  React.useEffect(() => {
    setLocalAnnouncement(announcement);
    setLocalAiApiKey(aiApiKey);
  }, [announcement, aiApiKey]);
  
  React.useEffect(() => {
    setLocalWhitelist(adminWhitelist);
  }, [adminWhitelist]);

  React.useEffect(() => {
    setPendingLanguage(lang);
  }, [lang]);



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
        setImportModalData(data);
      } catch (err) {
        if (confirm) {
          confirm({
            title: t('menu.Error'),
            message: "Failed to parse language file",
            confirmText: t('menu.OK'),
            onConfirm: () => {}
          });
        } else {
          alert("Failed to parse language file");
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const Toggle = ({
    checked, onChange, color = 'bg-neutral-900', label,
  }: { checked: boolean; onChange: () => void; color?: string; label: string }) => {
    const commonProps = {
      onClick: onChange,
      className: `w-16 h-8 rounded-full transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900 ${checked ? color : 'bg-neutral-200'}`
    };

    return checked ? (
      <button {...commonProps} title={label} aria-label={label} aria-pressed="true">
        <div className="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm left-9" />
      </button>
    ) : (
      <button {...commonProps} title={label} aria-label={label} aria-pressed="false">
        <div className="absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-sm left-1" />
      </button>
    );
  };

  return (
    <div title={t('navigation.system_settings')}>
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
              {bgnEnabled ? (
                <button title={t('settings.enable_bgn')}
                  onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, !bgnEnabled)}
                  aria-pressed="true"
                  aria-label={t('settings.enable_bgn')}
                  className="w-14 h-8 rounded-full transition-all relative focus:outline-none bg-neutral-900 shadow-lg shadow-neutral-200"
                >
                  <div className="absolute top-1 w-6 h-6 bg-white rounded-full transition-all flex items-center justify-center left-[1.65rem]">
                    <div className="w-1 h-1 bg-neutral-900 rounded-full" />
                  </div>
                </button>
              ) : (
                <button title={t('settings.enable_bgn')}
                  onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, !bgnEnabled)}
                  aria-pressed="false"
                  aria-label={t('settings.enable_bgn')}
                  className="w-14 h-8 rounded-full transition-all relative focus:outline-none bg-neutral-200"
                >
                  <div className="absolute top-1 w-6 h-6 bg-white rounded-full transition-all flex items-center justify-center left-1" />
                </button>
              )}
          </div>

          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><Users className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.language')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.language')}</p>
              </div>
            </div>
            <div className="relative">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button title={t('settings.language')}
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center justify-between w-[200px] px-4 py-3 bg-neutral-50 border border-neutral-200 rounded-2xl font-bold text-sm text-neutral-900 hover:border-neutral-900 transition-all focus:outline-none"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-neutral-400" />
                      {availableLanguages.find(l => l.code === pendingLanguage)?.name || pendingLanguage.toUpperCase()}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <>
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => setIsDropdownOpen(false)}
                          className="fixed inset-0 z-40"
                        />
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-2 left-0 w-[240px] bg-white border border-neutral-100 rounded-3xl shadow-2xl z-50 overflow-hidden p-2"
                        >
                          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                            {availableLanguages.map((l) => (
                              <div
                                key={l.code}
                                className={`flex items-center justify-between p-2 rounded-xl transition-all ${pendingLanguage === l.code ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-50 text-neutral-600'}`}
                              >
                                <button title={l.name}
                                  onClick={() => {
                                    setPendingLanguage(l.code);
                                    setIsDropdownOpen(false);
                                  }}
                                  className="flex-1 text-left px-2 py-1.5 font-bold text-sm"
                                >
                                  {l.name}
                                </button>
                                <div className="flex items-center gap-1">
                                  {pendingLanguage === l.code && <Check className="w-4 h-4 mr-2" />}
                                  {l.code !== 'en' && (
                                    <button title={`Delete ${l.name}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm) {
                                          confirm({
                                            title: `Delete ${l.name}?`,
                                            message: `Are you sure you want to remove the ${l.name} language pack?`,
                                            isDestructive: true,
                                            onConfirm: () => onDeleteLanguage(l.code)
                                          });
                                        } else if (window.confirm(`Delete language ${l.name}?`)) {
                                          onDeleteLanguage(l.code);
                                        }
                                      }}
                                      className={`p-1.5 rounded-lg transition-all ${pendingLanguage === l.code ? 'hover:bg-white/10 text-white/50 hover:text-white' : 'hover:bg-red-50 text-neutral-400 hover:text-red-500'}`}
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {pendingLanguage !== lang && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, pendingLanguage, bgnEnabled)}
                    className="px-6 py-3 bg-neutral-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-200"
                    title="Apply Language Change"
                  >
                    Apply
                  </motion.button>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-neutral-100 flex flex-col sm:flex-row gap-3">
            <button title="Export Data"
              onClick={handleExportTemplate}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold hover:bg-neutral-50 transition-all text-xs"
            >
              <Download className="w-4 h-4" /> {t('cards.export_data')} (JSON)
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileImport} 
              accept=".json" 
              className="hidden" 
              title={t('cards.import_file')}
              aria-label={t('cards.import_file')}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all text-xs"
              title={t('cards.import_file')}
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
                onChange={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, !kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} 
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
                onChange={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, !allowPWAInstall, lang, bgnEnabled)} 
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
                      title={t('pwa.how_to_install')}
                    >
                      <Info className="w-4 h-4" />
                      {t('pwa.how_to_install')}
                    </button>
                  </div>
                ) : (
                  <button
                    title={t('pwa.install_button')}
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



        {/* Pre-identification Toggle */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center"><CreditCard className="w-6 h-6 text-neutral-900" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">{t('settings.pre_identification')}</h3>
                <p className="text-sm text-neutral-500 italic">{t('settings.pre_identification_desc')}</p>
              </div>
            </div>
            <Toggle 
              checked={preIdentificationEnabled} 
              onChange={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, adminWhitelist, announcement, aiProvider, aiApiKey, !preIdentificationEnabled)} 
              label="Toggle Pre-identification" 
              color="bg-neutral-900" 
            />
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
            <Toggle checked={orderButtonEnabled} onChange={() => onUpdateSettings(adminWhitelistEnabled, !orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} label="Toggle Ordering" />
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
            <Toggle checked={testModeEnabled} onChange={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, !testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} label="Toggle Test Mode" color="bg-indigo-600" />
          </div>
        </div>
        {/* Admin Whitelist */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-amber-600" /></div>
              <div>
                <h3 className="text-xl font-bold text-neutral-900">Admin Access Whitelist</h3>
                <p className="text-sm text-neutral-500 italic">Restrict administrative access to specific IPs or hostnames</p>
              </div>
            </div>
            <Toggle 
              checked={adminWhitelistEnabled} 
              onChange={() => onUpdateSettings(!adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled)} 
              label="Toggle Whitelisting" 
              color="bg-amber-600" 
            />
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">Whitelisted Hosts & IP Ranges</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={localWhitelist}
                  onChange={(e) => setLocalWhitelist(e.target.value)}
                  placeholder="e.g. 127.0.0.1, localhost, 192.168.1.0/24"
                  className="flex-1 px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all focus:outline-none text-sm font-mono"
                />
                <button title="Update Whitelist"
                  onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, localWhitelist)}
                  disabled={localWhitelist === adminWhitelist}
                  className="px-6 py-3 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-30 whitespace-nowrap"
                >
                  {t('settings.update')}
                </button>
              </div>
            </div>

            <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100/50">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <div className="space-y-3">
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    Localhost and local network access are allowed by default. Use comma-separated values for multiple entries.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Examples:</p>
                      <ul className="text-[11px] text-amber-700/80 space-y-1 font-mono">
                        <li>• 192.168.1.5 <span className="text-[9px] opacity-70">(Single IP)</span></li>
                        <li>• 10.0.0.0/24 <span className="text-[9px] opacity-70">(Subnet)</span></li>
                        <li>• office.local <span className="text-[9px] opacity-70">(Hostname)</span></li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Defaults Included:</p>
                      <p className="text-[11px] text-amber-700/80 font-mono">
                        127.0.0.1, localhost, ::1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-neutral-400 italic flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Changes take effect immediately for the next login attempt.
            </p>
          </div>
        </div>

        {/* System Announcement */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center"><Info className="w-6 h-6 text-blue-600" /></div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{t('settings.announcement') || 'System Announcement'}</h3>
              <p className="text-sm text-neutral-500 italic">Displayed on the Kiosk for all users</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">Message Content</label>
              <textarea
                value={localAnnouncement}
                onChange={(e) => setLocalAnnouncement(e.target.value)}
                placeholder="Type your announcement here..."
                className="w-full px-4 py-3 bg-neutral-50 rounded-2xl border border-neutral-200 focus:ring-2 focus:ring-neutral-900 transition-all focus:outline-none text-sm min-h-[100px] resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              {localAnnouncement && (
                <button title="Clear Announcement"
                  onClick={() => {
                    setLocalAnnouncement('');
                    onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, adminWhitelist, '');
                  }}
                  className="px-6 py-3 bg-white border border-neutral-200 text-neutral-500 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all"
                >
                  Clear
                </button>
              )}
              <button title="Update Announcement"
                onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, adminWhitelist, localAnnouncement)}
                disabled={localAnnouncement === announcement}
                className="px-6 py-3 bg-neutral-900 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-30"
              >
                {t('settings.update')}
              </button>
            </div>
          </div>
        </div>

        {/* AI Integration */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center"><Sparkles className="w-6 h-6 text-indigo-600" /></div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">{t('settings.ai_integration')}</h3>
              <p className="text-sm text-neutral-500 italic">Power the Parser Auto-Teacher with external models</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1">
                <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">{t('settings.ai_provider')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {['openai', 'anthropic', 'gemini'].map(p => (
                    <button title="Select AI Provider"
                      key={p}
                      onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, adminWhitelist, announcement, p, aiApiKey)}
                      className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-wider border-2 transition-all ${aiProvider === p ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-white border-neutral-100 text-neutral-400 hover:border-indigo-200 hover:text-indigo-600'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-50">
              <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">{t('settings.ai_api_key')}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showAiKey ? 'text' : 'password'}
                    value={localAiApiKey}
                    onChange={(e) => setLocalAiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-4 py-3 bg-neutral-50 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-indigo-600 transition-all focus:outline-none text-sm font-mono"
                  />
                  <button 
                    onClick={() => setShowAiKey(!showAiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
                    title={showAiKey ? "Hide API Key" : "Show API Key"}
                    aria-label={showAiKey ? "Hide API Key" : "Show API Key"}
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => onUpdateSettings(adminWhitelistEnabled, orderButtonEnabled, testModeEnabled, kioskModeEnabled, allowPWAInstall, lang, bgnEnabled, adminWhitelist, announcement, aiProvider, localAiApiKey)}
                  disabled={localAiApiKey === aiApiKey}
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-all disabled:opacity-30 whitespace-nowrap"
                  title={t('settings.update')}
                >
                  {t('settings.update')}
                </button>
              </div>
              
              <div className="mt-4 flex items-center justify-between p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-neutral-900">Verify Connection</span>
                </div>
                <button
                  onClick={async () => {
                    if (!aiApiKey) {
                      alert("Please update and save your API key first.");
                      return;
                    }
                    try {
                      const res = await fetch('/api/ai/test', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert(data.message);
                      } else {
                        alert("Connection Failed: " + data.error);
                      }
                    } catch (err: any) {
                      alert("Network Error: " + err.message);
                    }
                  }}
                  className="px-4 py-2 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-50 transition-all"
                  title="Verify AI Connection"
                >
                  Test Connection
                </button>
              </div>

              <p className="mt-2 text-[10px] text-neutral-400 italic leading-relaxed">
                {t('settings.ai_api_key_desc')}
              </p>
            </div>
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
            <button title={t('settings.update_pin')}
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

        {/* Backup & Sync (Database Agnostic) */}
        <div className="bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Share className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-neutral-900">Backup & Sync</h3>
              <p className="text-sm text-neutral-500 italic">Export trained parser rules to sync between environments</p>
            </div>
          </div>

          <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-100 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-xs text-neutral-700 font-bold leading-relaxed">
                  The Parser Bundle contains all your custom Regex rules, category mappings, and AI Teacher configurations. 
                </p>
                <p className="text-[10px] text-neutral-400 mt-1">
                  Use this to move your "trained" logic from Development to Production without touching the database.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button title="Export Bundle"
                onClick={async () => {
                  try {
                    const token = sessionStorage.getItem('token') || '';
                    const { exportParserBundle } = await import('../../../api');
                    const bundle = await exportParserBundle(token);
                    const dataStr = JSON.stringify(bundle, null, 2);
                    const blob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `lunchpad_parser_bundle_${new Date().toISOString().split('T')[0]}.json`;
                    link.click();
                    URL.revokeObjectURL(url);
                  } catch (err: any) {
                    alert("Export failed: " + err.message);
                  }
                }}
                className="flex items-center justify-center gap-2 py-4 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold text-xs uppercase tracking-widest hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm"
              >
                <Download className="w-4 h-4" /> Export Bundle
              </button>

              <button title="Import Bundle"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.json';
                  input.onchange = async (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const content = evt.target?.result as string;
                        const bundle = JSON.parse(content);
                        const token = sessionStorage.getItem('token') || '';
                        const { importParserBundle } = await import('../../../api');
                        const res = await importParserBundle(token, bundle);
                        if (res.success) {
                          if (confirm) {
                            confirm({
                              title: "Success",
                              message: `Imported ${res.count} profiles successfully!`,
                              confirmText: "Great",
                              onConfirm: () => window.location.reload()
                            });
                          } else {
                            alert(`Imported ${res.count} profiles!`);
                            window.location.reload();
                          }
                        }
                      } catch (err: any) {
                        alert("Import failed: " + err.message);
                      }
                    };
                    reader.readAsText(file);
                  };
                  input.click();
                }}
                className="flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
              >
                <Plus className="w-4 h-4" /> Import Bundle
              </button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {importModalData && (
          <LanguageImportModal
            data={importModalData}
            onClose={() => setImportModalData(null)}
            onImport={async (code, name) => {
              await onImportLanguage(code, name, importModalData);
              setImportModalData(null);
              if (confirm) {
                confirm({
                  title: t('modals.copy_success'),
                  message: "Language imported successfully!",
                  confirmText: t('menu.OK'),
                  onConfirm: () => {}
                });
              }
            }}
            t={t}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const LanguageImportModal = ({ data, onClose, onImport, t }: { data: any, onClose: () => void, onImport: (code: string, name: string) => Promise<void>, t: any }) => {
  const [code, setCode] = React.useState('');
  const [name, setName] = React.useState('');
  const [isImporting, setIsImporting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    setIsImporting(true);
    try {
      await onImport(code.toLowerCase().trim(), name.trim());
    } finally {
      setIsImporting(false);
    }
  };

  return (
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
        <div className="absolute top-0 left-0 w-full h-1.5 bg-neutral-900" />
        
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-neutral-50 flex items-center justify-center text-neutral-900 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-neutral-900">Import Language</h3>
            <p className="text-neutral-500 text-[10px] uppercase font-black tracking-widest mt-1">
              Configuration required
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">Language Code</label>
            <input
              type="text"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. fr, de, es"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 transition-all placeholder:text-neutral-300 shadow-inner"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-2">Language Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. French, German"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-2xl px-5 py-4 text-sm font-bold text-neutral-900 focus:outline-none focus:border-neutral-900 transition-all placeholder:text-neutral-300 shadow-inner"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button title={t('modals.cancel')}
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-neutral-100 text-neutral-600 font-bold hover:bg-neutral-200 transition-all text-sm"
            >
              {t('modals.cancel')}
            </button>
            <button title="Import Language"
              type="submit"
              disabled={!code || !name || isImporting}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-neutral-900 text-white font-bold hover:bg-neutral-800 transition-all shadow-lg shadow-neutral-100 text-sm disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Import</>}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
