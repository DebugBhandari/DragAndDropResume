"use client";
import { useResumeStore } from "@/store/useResumeStore";
import { useUIStore } from "@/store/useUIStore";
import { HeaderAlignment } from "@/types/resume";
import { getUiText } from "@/utils/uiTranslations";

const presetColors = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#7c3aed",
  "#d97706",
  "#0891b2",
  "#1f2937",
  "#4f46e5",
];

export default function StyleEditor() {
  const { style, setStyle, photo, setPhoto, activeLocale } = useResumeStore();
  const { showHeaderIcons, showBodyIcons, toggleHeaderIcons, toggleBodyIcons } =
    useUIStore();
  const ui = getUiText(activeLocale);

  return (
    <div className="space-y-3">
      <div className="career-text-palette" role="group" aria-label="Résumé typography and color controls">
        <label className="career-number-control" title="Font family"><span>Font</span><select aria-label="Font family" value={style.fontFamily} onChange={(event) => setStyle({ fontFamily: event.target.value as typeof style.fontFamily })}><option value="serif">Serif</option><option value="sans-serif">Sans</option><option value="mono">Mono</option></select></label>
        <label className="career-number-control" title="Font size"><span>Size</span><select aria-label="Font size" value={style.fontSize} onChange={(event) => setStyle({ fontSize: event.target.value as typeof style.fontSize })}><option value="sm">12</option><option value="md">13</option><option value="lg">14</option></select></label>
        <details className="career-biu-menu">
          <summary aria-label="Accent color menu" title="Accent color"><span aria-hidden="true" className="h-3 w-3 rounded-full border border-current" style={{ backgroundColor: style.accentColor }} /></summary>
          <div className="career-biu-menu-content flex-wrap"><span className="sr-only">Accent color</span>{presetColors.map((color) => <button type="button" key={color} aria-label={`Use ${color} as accent color`} title={color} onClick={() => setStyle({ accentColor: color })}><span aria-hidden="true" className="h-3.5 w-3.5 rounded-full border border-black/15" style={{ backgroundColor: color }} /></button>)}<input type="color" aria-label="Custom accent color" value={style.accentColor} onChange={(event) => setStyle({ accentColor: event.target.value })} className="h-7 w-7 cursor-pointer rounded border-0 bg-transparent p-0" /></div>
        </details>
      </div>
      <details className="career-disclosure">
        <summary className="career-disclosure-summary"><span><strong>More style</strong><small>Icons, headings, spacing, and header layout</small></span></summary>
        <div className="space-y-3 px-3 pb-3">
      <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Theme
        </p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {ui.styleIcons}
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showHeaderIcons}
                onChange={toggleHeaderIcons}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-gray-600">{ui.styleHeader}</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showBodyIcons}
                onChange={toggleBodyIcons}
                className="w-3.5 h-3.5 rounded"
              />
              <span className="text-xs text-gray-600">{ui.styleBody}</span>
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {ui.styleHeadingSize}
          </label>
          <div className="flex gap-2">
            {(["sm", "md", "lg"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle({ headingSize: s })}
                className={`style-chip ${style.headingSize === s ? "style-chip-active" : ""}`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {ui.styleSectionSpacing}
          </label>
          <div className="flex gap-2">
            {(["tight", "normal", "relaxed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStyle({ sectionSpacing: s })}
                className={`style-chip capitalize ${style.sectionSpacing === s ? "style-chip-active" : ""}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-blue-50/50 p-3 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Header Layout
        </p>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            {ui.styleHeaderAlignment}
          </label>
          <div className="flex gap-2">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setStyle({ headerAlignment: a })}
                className={`style-chip capitalize ${style.headerAlignment === a ? "style-chip-active" : ""}`}
              >
                {a === "left"
                  ? ui.alignLeft
                  : a === "center"
                    ? ui.alignCenter
                    : ui.alignRight}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Header height: {photo.headerHeight ?? 180}px
          </label>
          <input
            type="range"
            min={80}
            max={360}
            value={photo.headerHeight ?? 180}
            onChange={(e) => setPhoto({ headerHeight: +e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Header top margin: {photo.marginTop ?? 0}px
          </label>
          <input
            type="range"
            min={0}
            max={48}
            value={photo.marginTop ?? 0}
            onChange={(e) => setPhoto({ marginTop: +e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Header bottom margin: {photo.marginBottom ?? 0}px
          </label>
          <input
            type="range"
            min={0}
            max={48}
            value={photo.marginBottom ?? 0}
            onChange={(e) => setPhoto({ marginBottom: +e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Header left margin: {photo.marginLeft ?? 0}px
          </label>
          <input
            type="range"
            min={0}
            max={48}
            value={photo.marginLeft ?? 0}
            onChange={(e) => setPhoto({ marginLeft: +e.target.value })}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Header right margin: {photo.marginRight ?? 0}px
          </label>
          <input
            type="range"
            min={0}
            max={48}
            value={photo.marginRight ?? 0}
            onChange={(e) => setPhoto({ marginRight: +e.target.value })}
            className="w-full"
          />
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}
