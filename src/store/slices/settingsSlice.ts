import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Language } from '../../translations';

export interface SettingsSlice {
  adminWhitelistEnabled: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskOpen: boolean;
  kioskAutoTiming: boolean;
  kioskOpenTime: string;
  kioskCloseTime: string;
  kioskCloseDay: number;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  bgnEnabled: boolean;
  adminWhitelist: string;
  lang: string;
  availableLanguages: { code: string, name: string }[];
  dynamicTranslations: Record<string, any>;
  publicAccessRequired: boolean;
  announcement: string;
  aiProvider: string;
  aiApiKey: string;

  setAdminWhitelistEnabled: (v: boolean) => void;
  setOrderButtonEnabled: (v: boolean) => void;
  setTestModeEnabled: (v: boolean) => void;
  setKioskOpen: (v: boolean) => void;
  setKioskAutoTiming: (v: boolean) => void;
  setKioskOpenTime: (v: string) => void;
  setKioskCloseTime: (v: string) => void;
  setKioskCloseDay: (v: number) => void;
  setKioskModeEnabled: (v: boolean) => void;
  setAllowPWAInstall: (v: boolean) => void;
  setBgnEnabled: (v: boolean) => void;
  setAdminWhitelist: (v: string) => void;
  setLang: (lang: Language) => void;
  setAvailableLanguages: (languages: { code: string, name: string }[]) => void;
  setDynamicTranslations: (translations: Record<string, any>) => void;
  setPublicAccessRequired: (v: boolean) => void;
  setAnnouncement: (v: string) => void;
  setAiProvider: (v: string) => void;
  setAiApiKey: (v: string) => void;
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set) => ({
  adminWhitelistEnabled: true,
  orderButtonEnabled: true,
  testModeEnabled: false,
  kioskOpen: true,
  kioskAutoTiming: false,
  kioskOpenTime: '08:00',
  kioskCloseTime: '11:00',
  kioskCloseDay: 0,
  kioskModeEnabled: false,
  allowPWAInstall: true,
  bgnEnabled: true,
  adminWhitelist: '',
  lang: localStorage.getItem('lang') || 'bg',
  availableLanguages: [
    { code: 'en', name: 'English' },
    { code: 'bg', name: 'Български' }
  ],
  dynamicTranslations: {},
  publicAccessRequired: false,
  announcement: '',
  aiProvider: 'openai',
  aiApiKey: '',

  setAdminWhitelistEnabled: (v) => set({ adminWhitelistEnabled: v }),
  setOrderButtonEnabled: (v) => set({ orderButtonEnabled: v }),
  setTestModeEnabled: (v) => set({ testModeEnabled: v }),
  setKioskOpen: (v) => set({ kioskOpen: v }),
  setKioskAutoTiming: (v) => set({ kioskAutoTiming: v }),
  setKioskOpenTime: (v) => set({ kioskOpenTime: v }),
  setKioskCloseTime: (v) => set({ kioskCloseTime: v }),
  setKioskCloseDay: (v) => set({ kioskCloseDay: v }),
  setKioskModeEnabled: (v) => set({ kioskModeEnabled: v }),
  setAllowPWAInstall: (v) => set({ allowPWAInstall: v }),
  setBgnEnabled: (v) => set({ bgnEnabled: v }),
  setAdminWhitelist: (v) => set({ adminWhitelist: v }),
  setLang: (lang) => {
    localStorage.setItem('lang', lang);
    set({ lang });
  },
  setAvailableLanguages: (availableLanguages) => set({ availableLanguages }),
  setDynamicTranslations: (dynamicTranslations) => set({ dynamicTranslations }),
  setPublicAccessRequired: (v) => set({ publicAccessRequired: v }),
  setAnnouncement: (v) => set({ announcement: v }),
  setAiProvider: (v) => set({ aiProvider: v }),
  setAiApiKey: (v) => set({ aiApiKey: v }),
});
