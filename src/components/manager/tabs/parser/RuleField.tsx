import React, { useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface RuleFieldProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  description?: string;
}

export const RuleField: React.FC<RuleFieldProps> = ({ label, value, onChange, placeholder, description }) => {
  const [isValid, setIsValid] = useState(true);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    try {
      new RegExp(val);
      setIsValid(true);
    } catch {
      setIsValid(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{label}</label>
        {!isValid && (
          <div className="flex items-center gap-1 text-red-500">
            <AlertCircle className="w-3 h-3" />
            <span className="text-[9px] font-bold">Invalid Regex</span>
          </div>
        )}
        {isValid && value && (
          <CheckCircle2 className="w-3 h-3 text-green-500" />
        )}
      </div>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full px-4 py-3 bg-neutral-50 border rounded-xl text-sm font-mono transition-all focus:outline-none focus:ring-2 ${
          isValid 
            ? 'border-neutral-100 focus:border-neutral-900 focus:ring-neutral-900/5' 
            : 'border-red-200 focus:border-red-500 focus:ring-red-500/5 bg-red-50/30'
        }`}
      />
      {description && <p className="text-[10px] text-neutral-400 mt-1 italic">{description}</p>}
    </div>
  );
};
