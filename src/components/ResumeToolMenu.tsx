'use client';

import { type SyntheticEvent, useEffect, useState } from 'react';
import HeaderImageContent from '@/components/HeaderImageContent';
import ResumeImportContent from '@/components/ResumeImportContent';
import { LanguagePickerContent, LayoutPickerContent } from '@/components/ResumeSettingsControls';
import StyleEditor from '@/components/StyleEditor';
import { useResumeStore } from '@/store/useResumeStore';
import type { ResumeData } from '@/types/resume';

const TAILOR_CHARACTER_LIMIT = 28_000;

type Props = {
  onTailored: (original: ResumeData, tailored: ResumeData) => void;
  isTailoring: boolean;
  setIsTailoring: (value: boolean) => void;
  message: string;
  setMessage: (value: string) => void;
};

function formatSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(savedAt));
}

export default function ResumeToolMenu({ onTailored, isTailoring, setIsTailoring, message, setMessage }: Props) {
  const store = useResumeStore();
  const [jobDescription, setJobDescription] = useState('');
  const [versionName, setVersionName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.career-tool-menu-item')) return;
      document.querySelectorAll<HTMLDetailsElement>('.career-tool-menu-item[open]').forEach((menu) => { menu.open = false; });
    };
    document.addEventListener('pointerdown', closeMenus);
    return () => document.removeEventListener('pointerdown', closeMenus);
  }, []);

  function closeOtherToolMenus(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) return;
    document.querySelectorAll<HTMLDetailsElement>('.career-tool-menu-item[open]').forEach((menu) => {
      if (menu !== event.currentTarget) menu.open = false;
    });
  }

  function currentResume(): ResumeData {
    const { personalInfo, education, experience, projects, languages, skills, certificates, awards, volunteer, references, interests, sectionOrder, layout, style, photo } = store;
    return { personalInfo, education, experience, projects, languages, skills, certificates, awards, volunteer, references, interests, sectionOrder, layout, style, photo };
  }

  function resumeForTailoring(resume: ResumeData): ResumeData {
    return {
      ...resume,
      photo: {
        ...resume.photo,
        url: resume.photo.url.startsWith('data:') ? '' : resume.photo.url,
      },
    };
  }

  const tailoringResume = resumeForTailoring(currentResume());
  const tailoringCharacterCount = JSON.stringify(tailoringResume).length + jobDescription.trim().length;
  const tailoringCharactersRemaining = TAILOR_CHARACTER_LIMIT - tailoringCharacterCount;

  async function tailorResume() {
    if (!jobDescription.trim()) {
      setMessage('Paste a job description before tailoring this résumé.');
      return;
    }
    if (tailoringCharactersRemaining < 0) {
      setMessage(`Shorten the résumé or job description by ${Math.abs(tailoringCharactersRemaining).toLocaleString()} characters before tailoring.`);
      return;
    }
    setIsTailoring(true);
    setMessage('Preparing your résumé for AI tailoring…');
    try {
      const original = currentResume();
      const requestResume = resumeForTailoring(original);
      const response = await fetch('/api/resume-tailor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume: requestResume, jobDescription }),
      });
      const payload = await response.json() as { resume?: ResumeData; message?: string };
      if (!response.ok || !payload.resume) throw new Error(payload.message || 'Unable to tailor this résumé.');
      onTailored(original, { ...payload.resume, photo: original.photo, layout: original.layout, style: original.style, sectionOrder: original.sectionOrder });
      setMessage('Tailored résumé ready. Compare it with the original before continuing to edit.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to tailor this résumé.');
    } finally {
      setIsTailoring(false);
    }
  }

  return (
    <div className="career-tool-menu" aria-label="Résumé tools">
      <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
        <summary aria-label="Document style" title="Document style"><span className="career-tool-icon" aria-hidden="true">◫</span><span className="career-tool-label">Style</span></summary>
        <div className="career-tool-menu-content space-y-3">
          <StyleEditor />
          <details className="career-disclosure"><summary className="career-disclosure-summary"><span><strong>Layout & language</strong><small>Template, column settings, and locale</small></span></summary><div className="space-y-4 px-3 pb-3"><LayoutPickerContent /><LanguagePickerContent /></div></details>
          <details className="career-disclosure"><summary className="career-disclosure-summary"><span><strong>Header image</strong><small>Photo and placement controls</small></span></summary><div className="px-3 pb-3"><HeaderImageContent /></div></details>
        </div>
      </details>

      <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
        <summary aria-label={isImporting ? "Importing résumé" : "Import résumé"} title={isImporting ? "Importing résumé" : "Import résumé"}><span className="career-tool-icon" aria-hidden="true">↥</span><span className="career-tool-label">{isImporting ? 'Importing…' : 'Import'}</span></summary>
        <div className="career-tool-menu-content"><ResumeImportContent onImportingChange={setIsImporting} /></div>
      </details>

      <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
        <summary aria-label={isTailoring ? "Tailoring résumé with AI" : "Tailor résumé with AI"} title={isTailoring ? "Tailoring résumé with AI" : "Tailor résumé with AI"}><span className="career-tool-icon" aria-hidden="true">✦</span><span className="career-tool-label">{isTailoring ? 'Tailoring…' : 'Tailor'}</span></summary>
        <div className="career-tool-menu-content space-y-3">
          <div><p className="career-kicker">Tailor with AI</p><p className="mt-1 text-sm opacity-75">Paste the job requirements. The tailored version keeps your document structure and facts, then appears on the page for comparison.</p></div>
          <textarea className="input-field min-h-36 resize-y" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the role responsibilities, requirements, and company context here." />
          <p className={`text-xs ${tailoringCharactersRemaining < 0 ? 'text-red-700' : 'opacity-65'}`} aria-live="polite">{tailoringCharacterCount.toLocaleString()} / {TAILOR_CHARACTER_LIMIT.toLocaleString()} characters{tailoringCharactersRemaining < 0 ? ` · remove ${Math.abs(tailoringCharactersRemaining).toLocaleString()}` : ` · ${tailoringCharactersRemaining.toLocaleString()} remaining`}</p>
          <button type="button" className="career-primary-button" onClick={tailorResume} disabled={isTailoring || tailoringCharactersRemaining < 0}>{isTailoring ? 'Tailoring…' : 'Tailor résumé'}</button>
          {message && <p className="career-message" role="status">{message}</p>}
        </div>
      </details>

      <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
        <summary aria-label="Saved résumés" title="Saved résumés"><span className="career-tool-icon" aria-hidden="true">▣</span><span className="career-tool-label">Versions</span><span className="resume-version-count" aria-label={`${store.resumeVersions.length} saved résumés`}>{store.resumeVersions.length}</span></summary>
        <div className="career-tool-menu-content space-y-3">
          <div><p className="career-kicker">Saved résumés</p><p className="mt-1 text-sm opacity-75">Save the current page, switch versions, or delete copies stored in this browser.</p></div>
          <div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { store.saveResumeVersion(versionName); setVersionName(''); } }} placeholder="Name this résumé version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { store.saveResumeVersion(versionName); setVersionName(''); }}>Save current</button></div>
          {store.resumeVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved résumés yet.</p> : <div className="space-y-2">{store.resumeVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => store.loadResumeVersion(version.id)}>Open</button><button type="button" className="resume-version-delete" onClick={() => store.deleteResumeVersion(version.id)}>Delete</button></div></div>)}</div>}
        </div>
      </details>

      <button type="button" className="career-clear-button" aria-label="Clear résumé" title="Clear résumé" onClick={() => { if (window.confirm('Clear the current résumé? Saved versions remain available.')) { store.clearResume(); setMessage(''); } }}><span className="career-tool-icon" aria-hidden="true">⌫</span><span className="career-tool-label">Clear résumé</span></button>
    </div>
  );
}