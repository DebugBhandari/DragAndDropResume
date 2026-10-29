'use client';

import ResumeImportContent from '@/components/ResumeImportContent';
import { useResumeStore } from '@/store/useResumeStore';
import { useUIStore } from '@/store/useUIStore';
import type { LayoutType, LocaleCode } from '@/types/resume';
import { getUiText } from '@/utils/uiTranslations';

const PRESET_SIDEBAR_COLORS = ['#dbeafe', '#fee2e2', '#dcfce7', '#ede9fe', '#fef3c7', '#cffafe', '#e5e7eb', '#e0e7ff'];

export const LOCALE_OPTIONS: { code: LocaleCode; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "ne", label: "Nepali", flag: "🇳🇵" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
];

export function LayoutPickerContent() {
  const { layout, setLayout, style, setStyle, activeLocale } = useResumeStore();
  const ui = getUiText(activeLocale);
  const layouts: { type: LayoutType; name: string }[] = [
    { type: "classic", name: ui.layoutClassic },
    { type: "modern", name: ui.layoutModern },
    { type: "compact", name: ui.layoutCompact },
    { type: "two-column", name: ui.layoutTwoColumn },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {layouts.map((l) => (
          <button
            key={l.type}
            onClick={() => setLayout(l.type)}
            className={`p-2 border-2 rounded text-left transition ${layout === l.type ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400"}`}
          >
            <div className="w-full h-12 rounded border border-gray-200 p-1 flex flex-col gap-0.5">
              {l.type === "classic" && (
                <>
                  <div
                    className="h-2 w-1/2 mx-auto rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "modern" && (
                <>
                  <div
                    className="h-3 w-full rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "compact" && (
                <>
                  <div
                    className="h-1.5 w-1/3 rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "two-column" && (
                <div className="flex gap-0.5 flex-1">
                  <div
                    className="w-1/3 rounded-sm"
                    style={{ background: style.sidebarColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </div>
              )}
            </div>
            <div className="text-xs font-medium mt-1">{l.name}</div>
          </button>
        ))}
      </div>
      {layout === "two-column" && (
        <div className="space-y-3">
          <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {ui.sidebarWidth}: {style.sidebarWidth}%
          </label>
          <input
            type="range"
            min={20}
            max={50}
            value={style.sidebarWidth}
            onChange={(e) => setStyle({ sidebarWidth: +e.target.value })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{ui.narrow}</span>
            <span>{ui.wide}</span>
          </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleSidebarColor}</label>
            <div className="flex gap-1.5 flex-wrap items-center">
              {PRESET_SIDEBAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setStyle({ sidebarColor: color })}
                  className={`w-6 h-6 rounded-full border-2 transition ${style.sidebarColor === color ? "border-gray-800 scale-110" : "border-transparent"}`}
                  style={{ background: color }}
                />
              ))}
              <input
                type="color"
                value={style.sidebarColor}
                onChange={(e) => setStyle({ sidebarColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LanguagePickerContent() {
  const { activeLocale, setLocale, style } = useResumeStore();
  const ui = getUiText(activeLocale);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {ui.chooseLanguageProfile}
      </p>
      <div className="flex flex-wrap gap-2">
        {LOCALE_OPTIONS.map((localeOption) => {
          const checked = activeLocale === localeOption.code;
          return (
            <label
              key={localeOption.code}
              className={`relative inline-flex items-center justify-center rounded-full cursor-pointer transition ${
                checked
                  ? "ring-2 ring-offset-1"
                  : "opacity-80 hover:opacity-100"
              }`}
              style={checked ? { boxShadow: `0 0 0 2px ${style.accentColor}` } : undefined}
              title={localeOption.label}
            >
              <input
                type="radio"
                name="resume-language"
                value={localeOption.code}
                checked={checked}
                onChange={() => setLocale(localeOption.code)}
                className="sr-only"
              />
              <span className="text-2xl leading-none">{localeOption.flag}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Personal Info ───
export function PersonalInfoContent() {
  const { personalInfo, updatePersonalInfo, activeLocale } = useResumeStore();
  const { showHeaderIcons, toggleHeaderIcons } = useUIStore();
  const ui = getUiText(activeLocale);
  return (
    <div className="space-y-3">
      <ResumeImportContent />
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showHeaderIcons}
          onChange={toggleHeaderIcons}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="text-xs text-gray-600">{ui.showIconOnResume} ({ui.introduction})</span>
      </label>
      <input
        className="input-field"
        placeholder="Full Name"
        value={personalInfo.fullName}
        onChange={(e) => updatePersonalInfo({ fullName: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Email"
        value={personalInfo.email}
        onChange={(e) => updatePersonalInfo({ email: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Phone"
        value={personalInfo.phone}
        onChange={(e) => updatePersonalInfo({ phone: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Location"
        value={personalInfo.location}
        onChange={(e) => updatePersonalInfo({ location: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="LinkedIn URL"
        value={personalInfo.linkedin}
        onChange={(e) => updatePersonalInfo({ linkedin: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Website / Portfolio"
        value={personalInfo.website}
        onChange={(e) => updatePersonalInfo({ website: e.target.value })}
      />
      <textarea
        className="input-field min-h-[80px]"
        placeholder="Professional Summary"
        value={personalInfo.summary}
        onChange={(e) => updatePersonalInfo({ summary: e.target.value })}
      />
    </div>
  );
}
