import React from "react";
import { SectionDetectionRule } from "../../../../types/parserConfig";
import { RuleField } from "./RuleField";
import { Plus, Trash2, Box, Info } from "lucide-react";

interface SectionDetectionEditorProps {
  sections: SectionDetectionRule[];
  onChange: (sections: SectionDetectionRule[]) => void;
  t: (key: string) => string;
}

export const SectionDetectionEditor: React.FC<SectionDetectionEditorProps> = ({
  sections,
  onChange,
  t,
}) => {
  const addSection = () => {
    const newSection: SectionDetectionRule = {
      id: `section-${Date.now()}`,
      categoryName: t("menu.uncategorized"),
      pattern: "category keyword",
      applyBoxFeeByDefault: false,
    };
    onChange([...sections, newSection]);
  };

  const removeSection = (id: string) => {
    onChange(sections.filter((s) => s.id !== id));
  };

  const updateSection = (
    id: string,
    updates: Partial<SectionDetectionRule>,
  ) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
        <div>
          <h4 className="text-sm font-black uppercase tracking-tighter text-neutral-900">
            {t("parser.section_detection")}
          </h4>
          <p className="text-[10px] text-neutral-400">
            {t("parser.section_detection_desc")}
          </p>
        </div>
        <button
          onClick={addSection}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-800 transition-all shadow-md"
        >
          <Plus className="w-3 h-3" /> {t("parser.add_rule")}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className="p-6 bg-white border border-neutral-100 rounded-2xl shadow-sm relative group overflow-hidden"
          >
            {/* Number badge */}
            <div className="absolute top-0 left-0 px-3 py-1 bg-neutral-100 text-neutral-400 text-[10px] font-black rounded-br-xl">
              {index + 1}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-2">
              <div className="md:col-span-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-1.5 block">
                  {t("parser.cat_display_name")}
                </label>
                <input
                  type="text"
                  value={section.categoryName}
                  onChange={(e) =>
                    updateSection(section.id, { categoryName: e.target.value })
                  }
                  className="w-full px-4 py-3 bg-neutral-50 border border-neutral-100 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-900"
                />
              </div>
              <div className="md:col-span-6">
                <RuleField
                  label={t("parser.detection_regex")}
                  value={section.pattern}
                  onChange={(val) =>
                    updateSection(section.id, { pattern: val })
                  }
                  placeholder="e.g. супи|soups"
                  t={t}
                />
              </div>
              <div className="md:col-span-2 flex flex-col justify-end">
                <div className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-100 h-[46px]">
                  <div className="flex-1 flex items-center gap-2">
                    <Box
                      className={`w-4 h-4 ${section.applyBoxFeeByDefault ? "text-amber-500" : "text-neutral-300"}`}
                    />
                    <span className="text-[9px] font-black uppercase tracking-tighter text-neutral-500">
                      {t("parser.auto_box")}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      updateSection(section.id, {
                        applyBoxFeeByDefault: !section.applyBoxFeeByDefault,
                      })
                    }
                    className={`w-10 h-5 rounded-full transition-all relative ${section.applyBoxFeeByDefault ? "bg-amber-500" : "bg-neutral-200"}`}
                  >
                    <div
                      className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${section.applyBoxFeeByDefault ? "right-1" : "left-1"}`}
                    />
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => removeSection(section.id)}
              className="absolute top-4 right-4 p-2 text-neutral-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
              aria-label={t("modals.remove")}
              title={t("modals.remove")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        {sections.length === 0 && (
          <div className="p-12 text-center border-2 border-dashed border-neutral-100 rounded-3xl">
            <Info className="w-8 h-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-xs text-neutral-400 italic">
              {t("parser.no_section_rules")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
