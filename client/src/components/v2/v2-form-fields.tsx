import { type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, useState } from "react";
import { Eye, EyeOff, ChevronDown, Check } from "lucide-react";

const INPUT_BASE =
  "w-full h-[48px] rounded-xl bg-white/10 border border-white/15 px-4 text-[15px] text-white placeholder-white/40 outline-none transition-all focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/40";

interface V2TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export function V2TextInput({ label, error, icon, className = "", ...props }: V2TextInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-white/60">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40">
            {icon}
          </div>
        )}
        <input
          className={`${INPUT_BASE} ${icon ? "pl-11" : ""} ${error ? "border-red-400" : ""} ${className}`}
          {...props}
        />
      </div>
      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
}

interface V2PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
}

export function V2PasswordInput({ label, error, className = "", ...props }: V2PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-white/60">{label}</label>
      )}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          className={`${INPUT_BASE} pr-12 ${error ? "border-red-400" : ""} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
          tabIndex={-1}
          data-testid="button-toggle-password"
        >
          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
}

interface V2TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function V2Textarea({ label, error, className = "", ...props }: V2TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-white/60">{label}</label>
      )}
      <textarea
        className={`w-full rounded-xl bg-white/10 border border-white/15 px-4 py-3 text-[15px] text-white placeholder-white/40 outline-none transition-all focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316]/40 resize-none ${error ? "border-red-400" : ""} ${className}`}
        {...props}
      />
      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
}

interface V2SelectOption {
  value: string;
  label: string;
}

interface V2SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: V2SelectOption[];
  placeholder?: string;
  error?: string;
}

export function V2Select({ label, value, onChange, options, placeholder, error }: V2SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-medium text-white/60">{label}</label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_BASE} appearance-none pr-10 ${!value ? "text-white/40" : ""} ${error ? "border-red-400" : ""}`}
          data-testid="select-v2"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
      </div>
      {error && <span className="text-[12px] text-red-400">{error}</span>}
    </div>
  );
}

interface V2SegmentedControlProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

export function V2SegmentedControl({ options, value, onChange }: V2SegmentedControlProps) {
  return (
    <div className="flex bg-white/10 rounded-xl p-1 gap-1" data-testid="v2-segmented-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 h-[38px] rounded-lg text-[13px] font-semibold transition-all ${
            value === opt.value
              ? "bg-[#F97316] text-white shadow-sm"
              : "text-white/50 hover:text-white/70"
          }`}
          data-testid={`segment-${opt.value}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface V2ChipOption {
  value: string;
  label: string;
}

interface V2ChipGroupProps {
  options: V2ChipOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  multi?: boolean;
}

export function V2ChipGroup({ options, selected, onChange, multi = true }: V2ChipGroupProps) {
  const toggle = (val: string) => {
    if (multi) {
      onChange(
        selected.includes(val)
          ? selected.filter((s) => s !== val)
          : [...selected, val]
      );
    } else {
      onChange([val]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2" data-testid="v2-chip-group">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={`h-[36px] px-4 rounded-full text-[13px] font-medium border transition-all active:scale-95 flex items-center gap-1.5 ${
              active
                ? "bg-[#F97316]/20 border-[#F97316] text-[#F97316]"
                : "bg-white/5 border-white/15 text-white/60 hover:border-white/30"
            }`}
            data-testid={`chip-${opt.value}`}
          >
            {active && <Check className="w-3.5 h-3.5" />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

interface V2SliderProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
}

export function V2Slider({ label, value, onChange, min, max, step = 1, formatValue }: V2SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-medium text-white/60">{label}</label>
          <span className="text-[14px] font-semibold text-[#F97316]">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="v2-slider w-full"
        style={{
          background: `linear-gradient(to right, #F97316 0%, #F97316 ${pct}%, rgba(255,255,255,0.15) ${pct}%, rgba(255,255,255,0.15) 100%)`,
        }}
        data-testid="v2-slider"
      />
    </div>
  );
}

interface V2ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function V2Toggle({ label, description, checked, onChange }: V2ToggleProps) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 py-3"
      data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex-1 text-left">
        <p className="text-[14px] font-medium text-white">{label}</p>
        {description && (
          <p className="text-[12px] text-white/50 mt-0.5">{description}</p>
        )}
      </div>
      <div
        className={`w-[44px] h-[26px] rounded-full transition-colors relative ${
          checked ? "bg-[#F97316]" : "bg-white/20"
        }`}
      >
        <div
          className={`absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow transition-transform ${
            checked ? "left-[21px]" : "left-[3px]"
          }`}
        />
      </div>
    </button>
  );
}
