'use client';

import Link from 'next/link';
import { ChangeEvent, type CSSProperties, useCallback, useRef, useState } from 'react';
import { useCareerStore } from '@/store/useCareerStore';
import type { CoverLetterData, CoverLetterFontFamily, CoverLetterFontSize, CoverLetterLayout, CoverLetterSpacing } from '@/types/career';
import { trackAnalyticsEvent } from '@/utils/analytics';

const fieldLabels: Array<{ key: keyof CoverLetterData; label: string; placeholder: string; type?: string }> = [
  { key: 'senderName', label: 'Your name', placeholder: 'Your full name' },
  { key: 'senderEmail', label: 'Email', placeholder: 'you@example.com', type: 'email' },
  { key: 'senderPhone', label: 'Phone', placeholder: '+1 555 123 4567', type: 'tel' },
  { key: 'senderLocation', label: 'Location', placeholder: 'City, State' },
  { key: 'companyName', label: 'Company', placeholder: 'Company name' },
  { key: 'roleTitle', label: 'Role title', placeholder: 'Role you are applying for' },
];

const layoutOptions: Array<{ value: CoverLetterLayout; label: string; detail: string }> = [
  { value: 'classic', label: 'Classic', detail: 'Traditional letterhead' },
  { value: 'modern', label: 'Modern', detail: 'Bold ruled header' },
  { value: 'compact', label: 'Compact', detail: 'Dense, space-saving' },
  { value: 'centered', label: 'Centered', detail: 'Formal centered header' },
];
const accentColors = ['#386641', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#0891b2', '#1f2937'];

function formatSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(savedAt));
}

function cleanImportedText(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\[(.*?)\]\([^)]*\)/g, '$1')
    .trim();
}

export default function CoverLetterPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const { coverLetter, coverLetterStyle, coverLetterVersions, updateCoverLetter, updateCoverLetterStyle, replaceCoverLetter, clearCoverLetter, saveCoverLetterVersion, loadCoverLetterVersion, deleteCoverLetterVersion } = useCareerStore();
  const [versionName, setVersionName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [message, setMessage] = useState('');
  const [activityStage, setActivityStage] = useState('');
  const [activityDetail, setActivityDetail] = useState('');
  const [previewRevision, setPreviewRevision] = useState(0);

  const updateField = (key: keyof CoverLetterData, value: string) => updateCoverLetter({ [key]: value });

  async function readProgressStream(response: Response, onEvent: (event: Record<string, unknown>) => void) {
    if (!response.body) throw new Error('The server did not return a progress stream.');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onEvent(JSON.parse(line) as Record<string, unknown>); } catch { /* Ignore malformed progress events. */ }
      }
      if (done) break;
    }
    if (buffer.trim()) {
      try { onEvent(JSON.parse(buffer) as Record<string, unknown>); } catch { /* Ignore malformed progress events. */ }
    }
  }

  const printCoverLetter = useCallback(() => {
    const source = previewRef.current;
    if (!source) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const filename = (coverLetter.senderName || 'CoverLetter').replace(/[^\p{L}\p{N}_-]+/gu, '') || 'CoverLetter';
    const printCss = `
      @page { size: A4; margin: 0; }
      * { box-sizing: border-box; }
      html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: #fff; }
      .cover-letter-preview { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; padding: 18mm 20mm !important; color: #1d2920; background: #fff; box-shadow: none !important; }
      .cover-letter-preview, .cover-letter-preview * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .cover-letter-letterhead { padding-bottom: 8mm; border-bottom: 3px solid var(--cover-accent, #386641); }
      .cover-letter-letterhead h2 { margin: 0; color: var(--cover-accent, #386641); font-size: 25px; font-weight: 800; letter-spacing: -.03em; }
      .cover-letter-letterhead p { margin: 3px 0 0; color: #57695a; font-size: 11px; }
      .cover-letter-content { padding-top: 9mm; }
      .cover-letter-content > p { margin: 0 0 2px; white-space: pre-wrap; }
      .cover-letter-body { margin-top: 8mm; }
      .cover-letter-body p { margin: 0 0 var(--cover-paragraph-space, 5mm); white-space: pre-wrap; }
      .cover-letter-preview[data-font="serif"] { font-family: Georgia, 'Times New Roman', serif; }
      .cover-letter-preview[data-font="sans-serif"] { font-family: Arial, Helvetica, sans-serif; }
      .cover-letter-preview[data-font="mono"] { font-family: 'SFMono-Regular', Consolas, monospace; }
      .cover-letter-preview[data-font-size="sm"] { font-size: 12.5px; }
      .cover-letter-preview[data-font-size="md"] { font-size: 14px; }
      .cover-letter-preview[data-font-size="lg"] { font-size: 15.5px; }
      .cover-letter-preview[data-paragraph-spacing="tight"] { --cover-paragraph-space: 3mm; }
      .cover-letter-preview[data-paragraph-spacing="normal"] { --cover-paragraph-space: 5mm; }
      .cover-letter-preview[data-paragraph-spacing="relaxed"] { --cover-paragraph-space: 7mm; }
      .cover-letter-preview[data-layout="classic"] .cover-letter-letterhead { border-bottom-width: 1px; }
      .cover-letter-preview[data-layout="classic"] { padding: 20mm 23mm !important; }
      .cover-letter-preview[data-layout="compact"] { padding: 15mm 17mm !important; line-height: 1.48; }
      .cover-letter-preview[data-layout="compact"] .cover-letter-content { padding-top: 6mm; }
      .cover-letter-preview[data-layout="compact"] .cover-letter-body { margin-top: 5mm; }
      .cover-letter-preview[data-layout="centered"] .cover-letter-letterhead { text-align: center; }
      .cover-letter-preview[data-layout="centered"] .cover-letter-content { text-align: left; }
    `;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${filename}CoverLetter</title><style>${printCss}</style></head><body>${source.outerHTML}</body></html>`);
    printWindow.document.close();
    const triggerPrint = () => {
      printWindow.focus();
      printWindow.print();
      trackAnalyticsEvent('cover_letter_exported', { method: 'window_print' });
    };
    if (printWindow.document.readyState === 'complete') window.setTimeout(triggerPrint, 80);
    else printWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 80), { once: true });
  }, [coverLetter.senderName]);

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (window.confirm('Save the current cover letter before importing this PDF?')) {
      const name = window.prompt('Name this cover-letter version:', `Before importing ${file.name.replace(/\.pdf$/i, '')}`);
      if (name?.trim()) saveCoverLetterVersion(name);
    }
    setIsImporting(true);
    setActivityStage('Preparing PDF import');
    setActivityDetail('Sending your PDF to Docling on the server…');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/cover-letter-import', { method: 'POST', body: formData });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || 'Could not import this PDF.');
      }
      let imported = false;
      let streamError = '';
      await readProgressStream(response, (event) => {
        if (event.type === 'stage') {
          const labels: Record<string, string> = { upload: 'Uploading PDF', docling: 'Docling extraction', parsing: 'Cleaning letter details' };
          setActivityStage(labels[String(event.stage)] ?? 'Processing PDF');
          setActivityDetail(String(event.detail ?? 'Processing your cover letter…'));
        }
        if (event.type === 'result' && typeof event.text === 'string') {
          const fields = event.fields && typeof event.fields === 'object' ? event.fields as Partial<CoverLetterData> : {};
          replaceCoverLetter({ ...fields, body: cleanImportedText(event.text) });
          setPreviewRevision((revision) => revision + 1);
          imported = true;
        }
        if (event.type === 'complete') setActivityDetail(String(event.message ?? 'Import complete.'));
        if (event.type === 'error') streamError = String(event.message ?? 'Could not import this PDF.');
      });
      if (streamError) throw new Error(streamError);
      if (!imported) throw new Error('Docling did not return usable cover-letter text.');
      saveCoverLetterVersion(`Imported ${file.name.replace(/\.pdf$/i, '')}`);
      setMessage('Imported with Docling. Review the editable letter and saved version.');
      trackAnalyticsEvent('cover_letter_imported', { source: 'docling' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import this PDF.');
    } finally {
      setIsImporting(false);
      setActivityStage('');
      setActivityDetail('');
    }
  }

  async function tailorCoverLetter() {
    if (!coverLetter.jobDescription.trim()) {
      setMessage('Paste the job description before tailoring your letter.');
      return;
    }
    setIsTailoring(true);
    setActivityStage('Preparing server AI');
    setActivityDetail('Sending your current letter and job requirements to the server AI…');
    setMessage('');
    try {
      const response = await fetch('/api/cover-letter-tailor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: coverLetter.body, jobDescription: coverLetter.jobDescription, roleTitle: coverLetter.roleTitle, companyName: coverLetter.companyName }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || 'Unable to tailor this letter.');
      }
      let tailored = false;
      let streamError = '';
      await readProgressStream(response, (event) => {
        if (event.type === 'stage') {
          const labels: Record<string, string> = { validating: 'Preparing server AI', 'server-ai': 'Server AI tailoring', applying: 'Updating entire letter body' };
          setActivityStage(labels[String(event.stage)] ?? 'Server AI');
          setActivityDetail(String(event.detail ?? 'Tailoring your cover letter…'));
        }
        if (event.type === 'result' && typeof event.body === 'string' && event.body.trim()) {
          updateCoverLetter({ body: event.body.trim() });
          setPreviewRevision((revision) => revision + 1);
          tailored = true;
        }
        if (event.type === 'error') streamError = String(event.message ?? 'Unable to tailor this letter.');
      });
      if (streamError) throw new Error(streamError);
      if (!tailored) throw new Error('The server AI did not return a revised letter body.');
      setMessage('Updated the entire letter body with the complete tailored response. Please verify every claim before exporting.');
      trackAnalyticsEvent('cover_letter_tailored');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to tailor this letter.');
    } finally {
      setIsTailoring(false);
      setActivityStage('');
      setActivityDetail('');
    }
  }

  return (
    <main className="career-tool min-h-screen">
      <header className="studio-header sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="studio-mark" aria-hidden="true">C</div>
          <div><p className="text-lg font-bold text-white">Cover letter</p><p className="hidden text-xs text-white/70 sm:block">Create, tailor, save and export locally</p></div>
        </div>
        <nav className="flex items-center gap-2" aria-label="Career tools">
          <Link href="/" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Résumé</Link>
          <Link href="/tracking" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Tracking</Link>
          <button type="button" onClick={printCoverLetter} className="studio-export-button inline-flex h-10 items-center px-4 text-sm font-semibold">↓ Export PDF</button>
        </nav>
      </header>

      <div className="career-workspace mx-auto grid max-w-[1650px] gap-5 p-4 lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:p-6">
        <section className="career-panel space-y-5" aria-label="Cover letter editor">
          <div><p className="career-kicker">Editor</p><h1 className="text-2xl font-bold">Build your cover letter</h1><p className="mt-1 text-sm opacity-75">Everything is saved only in this browser.</p></div>
          <div className="career-style-card space-y-3">
            <div><p className="career-kicker">Layout & style</p><h2 className="font-bold">Match your résumé presentation</h2></div>
            <div className="grid grid-cols-2 gap-2">
              {layoutOptions.map((layout) => <button type="button" key={layout.value} onClick={() => updateCoverLetterStyle({ layout: layout.value })} className={`career-layout-option ${coverLetterStyle.layout === layout.value ? 'career-layout-option-active' : ''}`}><span className={`career-layout-thumbnail career-layout-thumbnail-${layout.value}`} style={{ '--cover-accent': coverLetterStyle.accentColor } as CSSProperties}><i /><b /></span><span className="mt-1 block text-xs font-bold">{layout.label}</span><span className="block text-[11px] opacity-70">{layout.detail}</span></button>)}
            </div>
            <div><span className="career-field-label">Accent color</span><div className="flex flex-wrap gap-2">{accentColors.map((color) => <button type="button" aria-label={`Use ${color} as accent color`} key={color} onClick={() => updateCoverLetterStyle({ accentColor: color })} className={`career-color-swatch ${coverLetterStyle.accentColor === color ? 'career-color-swatch-active' : ''}`} style={{ backgroundColor: color }} />)}<input type="color" aria-label="Custom accent color" value={coverLetterStyle.accentColor} onChange={(event) => updateCoverLetterStyle({ accentColor: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></div></div>
            <div className="grid gap-3 sm:grid-cols-3"><div><span className="career-field-label">Font family</span><div className="flex flex-wrap gap-1.5">{(['serif', 'sans-serif', 'mono'] as CoverLetterFontFamily[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontFamily: value })} className={`style-chip ${coverLetterStyle.fontFamily === value ? 'style-chip-active' : ''}`}>{value === 'sans-serif' ? 'Sans' : value === 'mono' ? 'Mono' : 'Serif'}</button>)}</div></div><div><span className="career-field-label">Font size</span><div className="flex flex-wrap gap-1.5">{(['sm', 'md', 'lg'] as CoverLetterFontSize[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontSize: value })} className={`style-chip ${coverLetterStyle.fontSize === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div><div><span className="career-field-label">Paragraph spacing</span><div className="flex flex-wrap gap-1.5">{(['tight', 'normal', 'relaxed'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ paragraphSpacing: value })} className={`style-chip capitalize ${coverLetterStyle.paragraphSpacing === value ? 'style-chip-active' : ''}`}>{value}</button>)}</div></div></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldLabels.map(({ key, label, placeholder, type }) => (
              <label key={key}><span className="career-field-label">{label}</span><input type={type ?? 'text'} className="input-field" value={coverLetter[key]} onChange={(event) => updateField(key, event.target.value)} placeholder={placeholder} /></label>
            ))}
          </div>
          <label><span className="career-field-label">Letter body</span><textarea className="input-field min-h-64 resize-y" value={coverLetter.body} onChange={(event) => updateField('body', event.target.value)} placeholder="Write the main body of your cover letter." /></label>
          <div className="career-divider" />
          <div className="space-y-2"><div><p className="career-kicker">Tailor to a role</p><h2 className="font-bold">Paste the job description</h2></div><textarea className="input-field min-h-44 resize-y" value={coverLetter.jobDescription} onChange={(event) => updateField('jobDescription', event.target.value)} placeholder="Paste job requirements here. The server AI will replace the complete letter body and preserve claims from your draft." /><button type="button" className="career-primary-button" onClick={tailorCoverLetter} disabled={isTailoring || isImporting}>{isTailoring ? 'Tailoring…' : 'Tailor entire letter body'}</button></div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Import</p><h2 className="font-bold">Import an existing cover letter</h2><p className="mt-1 text-sm opacity-75">PDF extraction uses Docling only; it does not use AI.</p></div><label className={`career-secondary-button inline-flex cursor-pointer ${(isImporting || isTailoring) ? 'pointer-events-none opacity-60' : ''}`}><input className="sr-only" type="file" accept="application/pdf" onChange={handleImport} />{isImporting ? 'Importing with Docling…' : 'Upload PDF'}</label></div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Versions</p><h2 className="font-bold">Named cover letters</h2></div><div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { saveCoverLetterVersion(versionName); setVersionName(''); } }} placeholder="Name this cover-letter version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { saveCoverLetterVersion(versionName); setVersionName(''); }}>Save current</button></div>{coverLetterVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved cover letters yet.</p> : <div className="space-y-2">{coverLetterVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => loadCoverLetterVersion(version.id)}>Open</button><button type="button" className="resume-version-delete" onClick={() => deleteCoverLetterVersion(version.id)}>Delete</button></div></div>)}</div>}</div>
          <button type="button" className="resume-reset-button" onClick={() => { if (window.confirm('Clear the current cover letter? Saved versions remain available.')) clearCoverLetter(); }}>Clear current letter</button>
          {(isImporting || isTailoring) && <div className="career-activity" role="status" aria-live="polite"><div className="career-activity-title"><span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />{activityStage || 'Working'}</div><p className="mt-1">{activityDetail || 'The server is processing your request…'}</p></div>}
          {message && <p className="career-message" role="status">{message}</p>}
        </section>

        <section className="career-preview-shell" aria-label="Cover letter preview"><p className="career-kicker mb-3">Live preview</p><div className="career-preview-scale"><article key={previewRevision} ref={previewRef} data-layout={coverLetterStyle.layout} data-font={coverLetterStyle.fontFamily} data-font-size={coverLetterStyle.fontSize} data-paragraph-spacing={coverLetterStyle.paragraphSpacing} className="cover-letter-preview" style={{ '--cover-accent': coverLetterStyle.accentColor } as CSSProperties}><header className="cover-letter-letterhead"><h2>{coverLetter.senderName || 'Your Name'}</h2><p>{[coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation].filter(Boolean).join(' · ') || 'Email · Phone · Location'}</p></header><div className="cover-letter-content">{(coverLetter.companyName || coverLetter.roleTitle) && <p className="cover-letter-role">{[coverLetter.roleTitle, coverLetter.companyName].filter(Boolean).join(' · ')}</p>}<div className="cover-letter-body">{(coverLetter.body || 'Your cover letter body will appear here.').split(/\n{2,}/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div></div></article></div></section>
      </div>
    </main>
  );
}