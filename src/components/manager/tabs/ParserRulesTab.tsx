import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileCode, Save, Play, History, CheckCircle2, AlertCircle, 
  Trash2, Plus, ArrowRight, Layers, Settings, Database,
  Terminal, Eye, RefreshCw, ChevronRight, List, ShieldCheck,
  Code, Search, Trash, Scissors, FileJson, Clock, BookOpen,
  X, Check, Activity, MessageSquare, Tag, Zap, Filter, CheckCircle
} from 'lucide-react';
import { ParserConfig, ParserProfile, ParserVersion, ParserFixture } from '../../../types/parserConfig';
import { MenuParserEngine, ParseResult } from '../../../utils/parserEngine';
import { DEFAULT_PARSER_CONFIG } from '../../../utils/defaultParserConfig';
import * as api from '../../../api';
import { useStore } from '../../../store/useStore';

// Sub-components
import { PreprocessingEditor } from './parser/PreprocessingEditor';
import { SectionDetectionEditor } from './parser/SectionDetectionEditor';
import { EntityExtractionEditor } from './parser/EntityExtractionEditor';
import { EnrichmentEditor } from './parser/EnrichmentEditor';

interface ParserRulesTabProps {
  t: (key: string) => string;
  confirm: (config: any) => void;
}

export const ParserRulesTab: React.FC<ParserRulesTabProps> = ({ t, confirm }) => {
  const { token } = useStore();
  const [profiles, setProfiles] = useState<ParserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ParserVersion[]>([]);
  const [currentConfig, setCurrentConfig] = useState<ParserConfig>(DEFAULT_PARSER_CONFIG);
  const [fixtures, setFixtures] = useState<ParserFixture[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  const [previewText, setPreviewText] = useState('');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'fixtures' | 'logs'>('editor');
  const [showPreview, setShowPreview] = useState(false);

  const engine = useMemo(() => new MenuParserEngine(currentConfig), [currentConfig]);

  useEffect(() => {
    if (token) {
      loadProfiles();
      loadFixtures();
      loadLogs();
    }
  }, [token]);

  useEffect(() => {
    if (activeProfileId && token) {
      loadVersions(activeProfileId);
    }
  }, [activeProfileId, token]);

  const loadProfiles = async () => {
    try {
      const p = await api.getParserProfiles(token!);
      setProfiles(p);
      if (p.length > 0 && !activeProfileId) {
        const active = p.find((prof: any) => prof.isActive) || p[0];
        setActiveProfileId(active.id);
      }
    } catch (err) { console.error(err); }
  };

  const loadVersions = async (profileId: string) => {
    try {
      const v = await api.getParserVersions(token!, profileId);
      setVersions(v);
      if (v.length > 0) {
        setCurrentConfig(JSON.parse(v[0].configJson));
      }
    } catch (err) { console.error(err); }
  };

  const loadFixtures = async () => {
    try {
      const f = await api.getParserFixtures(token!);
      setFixtures(f);
    } catch (err) { console.error(err); }
  };

  const loadLogs = async () => {
    try {
      const l = await api.getParserLogs(token!);
      setLogs(l);
    } catch (err) { console.error(err); }
  };

  const handlePreview = () => {
    if (!previewText) return;
    const res = engine.parse(previewText);
    setParseResult(res);
    setShowPreview(true);
  };

  const handleSave = async () => {
    if (!activeProfileId) return;
    setIsSaving(true);
    try {
      await api.publishParserVersion(token!, activeProfileId, currentConfig, "Updated rules via UI");
      await loadVersions(activeProfileId);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!activeProfileId) return;
    try {
      await api.activateParserProfile(token!, activeProfileId);
      await loadProfiles();
    } catch (err) { console.error(err); }
  };

  const handleAddFixture = () => {
    if (!previewText) return;
    confirm({
      title: "Save as Fixture?",
      message: "Save this menu text as a testing fixture for future regression checks?",
      onConfirm: async () => {
        await api.saveParserFixture(token!, {
          name: `Sample ${new Date().toLocaleDateString()}`,
          rawInput: previewText,
          expectedOutputJson: parseResult ? JSON.stringify(parseResult) : "{}"
        });
        loadFixtures();
      }
    });
  };

  const handleCreateProfile = async () => {
    const name = prompt("Enter profile name:");
    if (!name) return;
    try {
      await api.createParserProfile(token!, {
        name,
        description: "Created via UI",
        config: DEFAULT_PARSER_CONFIG
      });
      await loadProfiles();
    } catch (err) { console.error(err); }
  };

  const handleDuplicateProfile = async (id: string) => {
    try {
      await api.duplicateParserProfile(token!, id);
      await loadProfiles();
    } catch (err) { console.error(err); }
  };

  const handleRestoreVersion = async (version: ParserVersion) => {
    if (!activeProfileId) return;
    confirm({
      title: "Restore Version?",
      message: `Rollback to Version ${version.versionNumber}? This will create a NEW version using the old configuration.`,
      onConfirm: async () => {
        try {
          await api.publishParserVersion(
            token!, 
            activeProfileId, 
            JSON.parse(version.configJson), 
            `Restored from v${version.versionNumber}`
          );
          await loadVersions(activeProfileId);
        } catch (err) { console.error(err); }
      }
    });
  };

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  return (
    <div className="flex h-[calc(100vh-220px)] gap-6">
      {/* Sidebar */}
      <aside className="w-80 bg-white rounded-3xl border border-neutral-100 flex flex-col overflow-hidden shadow-sm">
        <div className="p-6 border-b border-neutral-50 flex justify-between items-center bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
              <FileCode className="w-4 h-4" />
            </div>
            <span className="text-xs font-black uppercase tracking-widest text-neutral-900">Profiles</span>
          </div>
          <button 
            onClick={handleCreateProfile}
            className="p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {profiles.map(p => (
            <div key={p.id} className="relative group">
              <button
                onClick={() => setActiveProfileId(p.id)}
                className={`w-full text-left p-4 pr-12 rounded-2xl border transition-all ${
                  activeProfileId === p.id 
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-lg' 
                    : 'border-transparent hover:bg-neutral-50 text-neutral-600'
                }`}
              >
                <div className="font-bold text-sm">{p.name}</div>
                <div className="text-[10px] opacity-60 uppercase tracking-widest mt-1">
                  {p.isActive ? 'Active' : p.status}
                </div>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDuplicateProfile(p.id); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white opacity-0 group-hover:opacity-100 transition-all"
                title="Duplicate Profile"
              >
                <Layers className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        {/* Header & Sub-nav */}
        <div className="flex justify-between items-center">
           <div className="bg-white rounded-2xl border border-neutral-100 p-2 flex gap-2 shadow-sm">
             {[
               { id: 'editor', icon: Settings, label: 'Visual Editor' },
               { id: 'fixtures', icon: Database, label: 'Saved Fixtures' },
               { id: 'logs', icon: Activity, label: 'Stats & Logs' },
               { id: 'history', icon: History, label: 'Version History' }
             ].map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setActiveSubTab(tab.id as any)}
                 className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${
                   activeSubTab === tab.id ? 'bg-neutral-900 text-white shadow-md' : 'text-neutral-400 hover:bg-neutral-50'
                 }`}
               >
                 <tab.icon className="w-4 h-4" />
                 {tab.label}
               </button>
             ))}
           </div>
           
           {activeProfile && !activeProfile.isActive && (
             <button 
                onClick={handleActivate}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-500 text-white rounded-xl font-bold text-xs hover:bg-green-600 transition-all shadow-md"
             >
                <Check className="w-4 h-4" /> Activate This Profile
             </button>
           )}
        </div>

        <div className="flex-1 bg-white rounded-[32px] border border-neutral-100 shadow-sm overflow-hidden flex flex-col relative">
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            {activeSubTab === 'editor' && (
              <div className="max-w-4xl mx-auto space-y-12 pb-32">
                <section>
                   <PreprocessingEditor 
                      rules={currentConfig.preprocessing} 
                      onChange={(r) => setCurrentConfig({ ...currentConfig, preprocessing: r })}
                   />
                </section>

                <section>
                   <SectionDetectionEditor 
                      sections={currentConfig.sectionDetection}
                      onChange={(s) => setCurrentConfig({ ...currentConfig, sectionDetection: s })}
                   />
                </section>

                <section>
                   <EntityExtractionEditor 
                      rules={currentConfig.entityExtraction}
                      onChange={(r) => setCurrentConfig({ ...currentConfig, entityExtraction: r })}
                   />
                </section>

                <section>
                   <EnrichmentEditor 
                      rules={currentConfig.enrichmentRules}
                      onChange={(r) => setCurrentConfig({ ...currentConfig, enrichmentRules: r })}
                   />
                </section>
              </div>
            )}

            {activeSubTab === 'fixtures' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {fixtures.map(f => (
                  <div key={f.id} className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm hover:border-neutral-900/10 transition-all">
                    <h4 className="font-bold text-sm mb-2">{f.name}</h4>
                    <p className="text-[10px] text-neutral-400 line-clamp-3 mb-4 font-mono bg-neutral-50 p-3 rounded-lg">{f.rawInput}</p>
                    <button 
                      onClick={() => {
                        setPreviewText(f.rawInput);
                        setActiveSubTab('editor');
                        setTimeout(handlePreview, 100);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest"
                    >
                      <Play className="w-3 h-3" /> Load into Preview
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeSubTab === 'logs' && (
              <div className="space-y-4">
                {logs.map(log => (
                  <div key={log.id} className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                       <span className="text-[10px] font-mono text-neutral-400">{new Date(log.timestamp).toLocaleString()}</span>
                       <span className="px-3 py-1 bg-red-50 text-red-500 rounded-full text-[9px] font-black uppercase tracking-widest">Parsing Warning</span>
                    </div>
                    <p className="text-xs font-mono bg-neutral-900 text-neutral-300 p-4 rounded-xl mb-4 line-clamp-2">{log.rawInput}</p>
                    <div className="flex flex-wrap gap-2">
                       {JSON.parse(log.unmatchedLines).map((line: string, i: number) => (
                         <span key={i} className="px-2 py-1 bg-neutral-100 text-neutral-600 rounded text-[9px] border border-neutral-200">{line}</span>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeSubTab === 'history' && (
              <div className="space-y-4">
                {versions.map((v, i) => (
                  <div key={v.id} className="p-6 bg-white rounded-3xl border border-neutral-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center text-neutral-400 font-bold">
                        v{v.versionNumber}
                      </div>
                      <div>
                        <div className="font-bold text-neutral-900">{v.changeNote}</div>
                        <div className="text-xs text-neutral-400 mt-1">
                          {new Date(v.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {i > 0 && (
                        <button 
                          onClick={() => handleRestoreVersion(v)}
                          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Restore
                        </button>
                      )}
                      {i === 0 && (
                        <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-xs font-bold flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3" />
                          Current
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <AnimatePresence>
            {showPreview && (
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="absolute inset-0 bg-white z-50 flex flex-col"
              >
                <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
                  <div className="flex items-center gap-4">
                     <h3 className="text-lg font-black uppercase tracking-tighter text-neutral-900">Live Parser Debug</h3>
                     <div className="flex gap-2">
                        <span className="px-3 py-1 bg-neutral-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
                          {parseResult?.items.length} Items Found
                        </span>
                        <span className="px-3 py-1 bg-neutral-100 text-neutral-400 rounded-full text-[10px] font-black uppercase tracking-widest">
                          {parseResult?.unmatchedLines.length} Unmatched
                        </span>
                     </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(currentConfig, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `parser-config-${activeProfile?.name || 'export'}.json`;
                        a.click();
                      }}
                      className="p-2.5 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition-all"
                      title="Export Config"
                    >
                      <FileJson className="w-5 h-5" />
                    </button>
                    <button onClick={handleAddFixture} className="p-2.5 bg-neutral-100 text-neutral-600 rounded-xl hover:bg-neutral-200 transition-all">
                      <Save className="w-5 h-5" />
                    </button>
                    <button onClick={() => setShowPreview(false)} className="p-2.5 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition-all">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Left Pane */}
                    <div className="flex-1 flex flex-col border-r border-neutral-100 overflow-hidden">
                       <div className="p-3 bg-neutral-50 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Raw Source Text (Hover to trace)</span>
                       </div>
                       <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-neutral-50/30">
                          {previewText.split('\n').map((line, i) => {
                            const isMatch = parseResult?.items.some(it => it._debug?.matchedLine === line.trim());
                            const isHovered = hoveredLine === line.trim();
                            return (
                              <div 
                                key={i}
                                onMouseEnter={() => setHoveredLine(line.trim())}
                                onMouseLeave={() => setHoveredLine(null)}
                                className={`font-mono text-sm py-0.5 px-4 whitespace-pre-wrap transition-colors ${
                                  isHovered ? 'bg-neutral-900 text-white' : 
                                  isMatch ? 'text-neutral-900 bg-neutral-100/50' : 'text-neutral-400'
                                }`}
                              >
                                {line || ' '}
                              </div>
                            );
                          })}
                          <textarea 
                            value={previewText}
                            onChange={(e) => setPreviewText(e.target.value)}
                            className="w-full mt-4 p-4 text-xs font-mono bg-white border border-dashed border-neutral-200 rounded-xl focus:outline-none"
                            placeholder="Paste new menu text here..."
                            rows={4}
                          />
                       </div>
                    </div>

                    {/* Right Pane */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                       <div className="p-3 bg-neutral-50 flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Parsed Structured Data</span>
                       </div>
                       <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
                          {parseResult?.items.map((item, i) => {
                             const isHovered = hoveredLine === item._debug?.matchedLine || hoveredItemId === item.id;
                             const matchedRule = item._debug?.ruleId;
                             return (
                               <div 
                                 key={i} 
                                 onMouseEnter={() => setHoveredItemId(item.id)}
                                 onMouseLeave={() => setHoveredItemId(null)}
                                 className={`p-4 bg-white border transition-all rounded-xl shadow-sm cursor-help ${
                                   isHovered ? 'border-neutral-900 scale-[1.02] shadow-md z-10' : 'border-neutral-100'
                                 }`}
                               >
                                  <div className="flex justify-between items-start mb-2">
                                     <div className="flex flex-col">
                                       <span className="font-bold text-sm text-neutral-900">{item.name}</span>
                                       {matchedRule && (
                                         <span className="text-[9px] font-bold text-neutral-400 flex items-center gap-1 mt-0.5">
                                           <Code className="w-2.5 h-2.5" /> Rule: {matchedRule} ({item._debug?.ruleType})
                                         </span>
                                       )}
                                     </div>
                                     <span className="font-mono text-xs font-bold bg-neutral-900 text-white px-2 py-0.5 rounded">{item.price.toFixed(2)}€</span>
                                  </div>
                                  <div className="flex gap-2 items-center">
                                     <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 px-2 py-0.5 bg-neutral-50 rounded border border-neutral-100">{item.category}</span>
                                     {item.description && <span className="text-[9px] font-bold text-neutral-400">({item.description})</span>}
                                     {(item.packagingFee ?? 0) > 0 && <span className="text-[9px] font-bold text-amber-600">Box: {item.packagingFee}€</span>}
                                     {item.tags.map(t => (
                                       <span key={t} className="text-[9px] font-black uppercase tracking-widest text-white px-2 py-0.5 bg-green-500 rounded flex items-center gap-1">
                                          <Tag className="w-2 h-2" /> {t}
                                       </span>
                                     ))}
                                  </div>
                               </div>
                             );
                          })}
                          {parseResult?.items.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-20">
                               <Search className="w-12 h-12 mb-4" />
                               <p className="text-sm font-bold uppercase tracking-widest">No Items Found</p>
                            </div>
                          )}
                       </div>
                    </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-6 border-t border-neutral-50 bg-neutral-50/30 flex justify-between items-center z-10 relative">
             <div className="flex items-center gap-4 flex-1">
                <div className="flex items-center gap-2">
                   <AlertCircle className="w-4 h-4 text-neutral-400" />
                   <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Draft changes are local. Publish to deploy.</span>
                </div>
                {previewText && (
                  <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-green-500">
                     <CheckCircle2 className="w-4 h-4" />
                     <span className="text-[10px] font-bold">Menu Text Loaded ({previewText.length} chars)</span>
                  </motion.div>
                )}
             </div>
             <div className="flex gap-3">
                <button 
                  onClick={handlePreview}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-neutral-200 text-neutral-900 rounded-xl font-bold text-xs hover:bg-neutral-50 transition-all shadow-sm"
                >
                   <Play className="w-4 h-4" /> Run Preview
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-8 py-3 bg-neutral-900 text-white rounded-xl font-bold text-xs hover:bg-neutral-800 disabled:opacity-50 transition-all shadow-md"
                >
                   {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 
                   Publish Version
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
