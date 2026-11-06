'use client';

import Link from 'next/link';
import { ChangeEvent, useCallback, useRef, useState } from 'react';
import { useCareerStore } from '@/store/useCareerStore';
import type { CoverLetterData } from '@/types/career';
import { trackAnalyticsEvent } from '@/utils/analytics';

const fieldLabels: Array<{ key: keyof CoverLetterData; label: string; placeholder: string; type?: string }> = [
  { key: 'senderName', label: 'Your name', placeholder: 'Your full name' },
  { key: 'senderEmail', label: 'Email', placeholder: 'you@example.com', type: 'email' },
  { key: 'senderPhone', label: 'Phone', placeholder: '+1 555 123 4567', type: 'tel' },
  { key: 'senderLocation', label: 'Location', placeholder: 'City, State' },
  { key: 'recipientName', label: 'Recipient', placeholder: 'Hiring manager name' },
  { key: 'companyName', label: 'Company', placeholder: 'Company name' },
  { key: 'roleTitle', label: 'Role title', placeholder: 'Role you are applying for' },
  { key: 'date', label: 'Date', placeholder: 'March 1, 2026' },
  { key: 'subject', label: 'Subject (optional)', placeholder: 'Application for Product Designer' },
  { key: 'greeting', label: 'Greeting', placeholder: 'Dear Hiring Manager,' },
  { key: 'closing', label: 'Closing', placeholder: 'Sincerely,' },
  { key: 'signature', label: 'Signature', placeholder: 'Your name' },
];

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
  const { coverLetter, coverLetterVersions, updateCoverLetter, replaceCoverLetter, clearCoverLetter, saveCoverLetterVersion, loadCoverLetterVersion, deleteCoverLetterVersion } = useCareerStore();
  const [versionName, setVersionName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [message, setMessage] = useState('');

  const updateField = (key: keyof CoverLetterData, value: string) => updateCoverLetter({ [key]: value });

  const printCoverLetter = useCallback(() => {
    const source = previewRef.current;
    if (!source) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map((node) => node.outerHTML).join('\n');
    const filename = (coverLetter.senderName || 'CoverLetter').replace(/[^\p{L}\p{N}_-]+/gu, '') || 'CoverLetter';
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${filename}CoverLetter</title>${headStyles}<style>html,body{margin:0;padding:0;background:#fff}.cover-letter-preview{width:794px!important;min-height:1123px!important;box-shadow:none!important;border:0!important;margin:0!important}.cover-letter-print-only{display:block!important}@page{size:A4;margin:0}</style></head><body>${source.outerHTML}</body></html>`);
    printWindow.document.close();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      trackAnalyticsEvent('cover_letter_exported', { method: 'window_print' });
    }, 80);
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
    setMessage('Docling is extracting your cover letter…');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/cover-letter-import', { method: 'POST', body: formData });
      const payload = await response.json() as { text?: string; message?: string };
      if (!response.ok || !payload.text) throw new Error(payload.message || 'Could not import this PDF.');
      replaceCoverLetter({ body: cleanImportedText(payload.text) });
      saveCoverLetterVersion(`Imported ${file.name.replace(/\.pdf$/i, '')}`);
      setMessage('Imported with Docling. Review the editable letter and saved version.');
      trackAnalyticsEvent('cover_letter_imported', { source: 'docling' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to import this PDF.');
    } finally {
      setIsImporting(false);
    }
  }

  async function tailorCoverLetter() {
    if (!coverLetter.jobDescription.trim()) {
      setMessage('Paste the job description before tailoring your letter.');
      return;
    }
    setIsTailoring(true);
    setMessage('Tailoring the letter with your local AI…');
    try {
      const response = await fetch('/api/cover-letter-tailor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: coverLetter.body, jobDescription: coverLetter.jobDescription, roleTitle: coverLetter.roleTitle, companyName: coverLetter.companyName }),
      });
      const payload = await response.json() as { body?: string; message?: string };
      if (!response.ok || !payload.body) throw new Error(payload.message || 'Unable to tailor this letter.');
      updateCoverLetter({ body: payload.body });
      setMessage('Tailored draft ready. Please review every claim before exporting.');
      trackAnalyticsEvent('cover_letter_tailored');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to tailor this letter.');
    } finally {
      setIsTailoring(false);
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
          <div className="grid gap-3 sm:grid-cols-2">
            {fieldLabels.map(({ key, label, placeholder, type }) => (
              <label key={key} className={key === 'subject' ? 'sm:col-span-2' : ''}><span className="career-field-label">{label}</span><input type={type ?? 'text'} className="input-field" value={coverLetter[key]} onChange={(event) => updateField(key, event.target.value)} placeholder={placeholder} /></label>
            ))}
          </div>
          <label><span className="career-field-label">Letter body</span><textarea className="input-field min-h-64 resize-y" value={coverLetter.body} onChange={(event) => updateField('body', event.target.value)} placeholder="Write the main body of your cover letter." /></label>
          <div className="career-divider" />
          <div className="space-y-2"><div><p className="career-kicker">Tailor to a role</p><h2 className="font-bold">Paste the job description</h2></div><textarea className="input-field min-h-44 resize-y" value={coverLetter.jobDescription} onChange={(event) => updateField('jobDescription', event.target.value)} placeholder="Paste job requirements here. The local AI will revise only the body and preserve claims from your draft." /><button type="button" className="career-primary-button" onClick={tailorCoverLetter} disabled={isTailoring}>{isTailoring ? 'Tailoring…' : 'Tailor letter to this job'}</button></div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Import</p><h2 className="font-bold">Import an existing cover letter</h2><p className="mt-1 text-sm opacity-75">PDF extraction uses Docling only; it does not use AI.</p></div><label className={`career-secondary-button inline-flex cursor-pointer ${isImporting ? 'pointer-events-none opacity-60' : ''}`}><input className="sr-only" type="file" accept="application/pdf" onChange={handleImport} />{isImporting ? 'Importing with Docling…' : 'Upload PDF'}</label></div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Versions</p><h2 className="font-bold">Named cover letters</h2></div><div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { saveCoverLetterVersion(versionName); setVersionName(''); } }} placeholder="Name this cover-letter version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { saveCoverLetterVersion(versionName); setVersionName(''); }}>Save current</button></div>{coverLetterVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved cover letters yet.</p> : <div className="space-y-2">{coverLetterVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => loadCoverLetterVersion(version.id)}>Open</button><button type="button" className="resume-version-delete" onClick={() => deleteCoverLetterVersion(version.id)}>Delete</button></div></div>)}</div>}</div>
          <button type="button" className="resume-reset-button" onClick={() => { if (window.confirm('Clear the current cover letter? Saved versions remain available.')) clearCoverLetter(); }}>Clear current letter</button>
          {message && <p className="career-message" role="status">{message}</p>}
        </section>

        <section className="career-preview-shell" aria-label="Cover letter preview"><p className="career-kicker mb-3">Live preview</p><div className="career-preview-scale"><article ref={previewRef} className="cover-letter-preview"><header className="cover-letter-letterhead"><h2>{coverLetter.senderName || 'Your Name'}</h2><p>{[coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation].filter(Boolean).join(' · ') || 'Email · Phone · Location'}</p></header><div className="cover-letter-content"><p>{coverLetter.date}</p>{coverLetter.recipientName && <p>{coverLetter.recipientName}</p>}{coverLetter.companyName && <p>{coverLetter.companyName}</p>}{coverLetter.subject && <p className="mt-7 font-bold">Re: {coverLetter.subject}</p>}<p className="mt-7">{coverLetter.greeting || 'Dear Hiring Manager,'}</p><div className="cover-letter-body">{(coverLetter.body || 'Your cover letter body will appear here.').split(/\n{2,}/).map((paragraph, index) => <p key={`${paragraph}-${index}`}>{paragraph}</p>)}</div><p className="mt-7">{coverLetter.closing || 'Sincerely,'}</p><p className="mt-6 font-semibold">{coverLetter.signature || coverLetter.senderName || 'Your Name'}</p></div></article></div></section>
      </div>
    </main>
  );
}