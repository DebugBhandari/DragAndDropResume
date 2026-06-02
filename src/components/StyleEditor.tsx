'use client';
import { useResumeStore } from '@/store/useResumeStore';
import { useUIStore } from '@/store/useUIStore';
import { HeaderAlignment } from '@/types/resume';
import { getUiText } from '@/utils/uiTranslations';

const presetColors = ['#2563eb', '#dc2626', '#059669', '#7c3aed', '#d97706', '#0891b2', '#1f2937', '#4f46e5'];

export default function StyleEditor() {
  const { style, setStyle, activeLocale } = useResumeStore();
  const { showHeaderIcons, showBodyIcons, toggleHeaderIcons, toggleBodyIcons } = useUIStore();
  const ui = getUiText(activeLocale);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleIcons}</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showHeaderIcons} onChange={toggleHeaderIcons} className="w-3.5 h-3.5 rounded" />
            <span className="text-xs text-gray-600">{ui.styleHeader}</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="checkbox" checked={showBodyIcons} onChange={toggleBodyIcons} className="w-3.5 h-3.5 rounded" />
            <span className="text-xs text-gray-600">{ui.styleBody}</span>
          </label>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleAccentColor}</label>
        <div className="flex gap-1.5 flex-wrap items-center">
          {presetColors.map((c) => (
            <button key={c} onClick={() => setStyle({ accentColor: c })}
              className={`w-6 h-6 rounded-full border-2 transition ${style.accentColor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
          <input type="color" value={style.accentColor} onChange={(e) => setStyle({ accentColor: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleFontSize}</label>
        <div className="flex gap-2">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} onClick={() => setStyle({ fontSize: s })} className={`style-chip ${style.fontSize === s ? 'style-chip-active' : ''}`}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleHeaderAlignment}</label>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button key={a} onClick={() => setStyle({ headerAlignment: a })}
              className={`style-chip capitalize ${style.headerAlignment === a ? 'style-chip-active' : ''}`}>
              {a === 'left' ? ui.alignLeft : a === 'center' ? ui.alignCenter : ui.alignRight}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleHeadingSize}</label>
        <div className="flex gap-2">
          {(['sm', 'md', 'lg'] as const).map((s) => (
            <button key={s} onClick={() => setStyle({ headingSize: s })} className={`style-chip ${style.headingSize === s ? 'style-chip-active' : ''}`}>{s.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleSectionSpacing}</label>
        <div className="flex gap-2">
          {(['tight', 'normal', 'relaxed'] as const).map((s) => (
            <button key={s} onClick={() => setStyle({ sectionSpacing: s })} className={`style-chip capitalize ${style.sectionSpacing === s ? 'style-chip-active' : ''}`}>{s}</button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{ui.styleFont}</label>
        <div className="flex gap-2">
          {(['serif', 'sans-serif', 'mono'] as const).map((f) => (
            <button key={f} onClick={() => setStyle({ fontFamily: f })} className={`style-chip ${style.fontFamily === f ? 'style-chip-active' : ''}`} style={{ fontFamily: f === 'mono' ? 'monospace' : f }}>
              {f === 'mono' ? 'Mono' : f === 'sans-serif' ? 'Sans' : 'Serif'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
