'use client';

import { useRef, useState } from 'react';
import { useResumeStore } from '@/store/useResumeStore';
import type { ResumeImportDraft, ResumeImportSelection } from '@/types/resume';

export default function ResumeImportContent() {
  const { applyImportDraft } = useResumeStore();
  const [draft, setDraft] = useState<ResumeImportDraft | null>(null);
  const [selection, setSelection] = useState<ResumeImportSelection>({ personalInfo: true, photo: true, experience: true, projects: true, education: true, skills: true, languages: true, certificates: true });
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [hasAppliedQuickDraft, setHasAppliedQuickDraft] = useState(false);
  const importRunRef = useRef(0);
  const appliedSelectionRef = useRef<ResumeImportSelection | null>(null);

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const importRun = importRunRef.current + 1;
    importRunRef.current = importRun;
    setStatus('uploading');
    setMessage('Starting private résumé import…');
    setProgressUpdates(['Starting private résumé import…']);
    setIsAiRefining(false);
    setHasAppliedQuickDraft(false);
    appliedSelectionRef.current = null;
    setDraft(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const response = await fetch('/api/resume-import', { method: 'POST', body: formData });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(result.message || 'Unable to import this résumé.');
      }
      if (!response.body) throw new Error('The import server did not return a progress stream.');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let receivedDraft = false;
      let streamError = '';

      const processEvent = (line: string) => {
        if (importRunRef.current !== importRun) return;
        if (!line.trim()) return;
        let update: { type?: string; message?: string; draft?: ResumeImportDraft; source?: string };
        try {
          update = JSON.parse(line) as { type?: string; message?: string; draft?: ResumeImportDraft; source?: string };
        } catch {
          return;
        }
        if (update.type === 'progress' && update.message) {
          const progressMessage = update.message;
          setMessage(update.message);
          setProgressUpdates((current) => current[current.length - 1] === progressMessage ? current : [...current, progressMessage].slice(-6));
          setIsAiRefining(/AI|Improving/i.test(progressMessage));
        }
        if (update.type === 'draft' && update.draft) {
          receivedDraft = true;
          setDraft(update.draft);
          if (update.source === 'extracted') {
            setMessage('Quick preview is ready. AI cleanup is continuing in the background…');
            setProgressUpdates((current) => [...current, 'Quick preview is ready to review.'].slice(-6));
            setIsAiRefining(true);
          }
          if (update.source === 'photo') {
            setProgressUpdates((current) => [...current, 'Profile photo candidate found.'].slice(-6));
            const appliedSelection = appliedSelectionRef.current;
            if (appliedSelection?.photo) {
              applyImportDraft(update.draft, { personalInfo: false, photo: true, experience: false, projects: false, education: false, skills: false, languages: false, certificates: false });
              setMessage('Your selected details are applied. Profile photo added while AI cleanup continues…');
            }
          }
          if (update.source === 'ai') {
            const appliedSelection = appliedSelectionRef.current;
            if (appliedSelection) {
              applyImportDraft(update.draft, { ...appliedSelection, skills: false, languages: false });
              setMessage('AI cleanup is complete. Structured details from this import were added to your résumé.');
              setProgressUpdates((current) => [...current, 'AI cleanup complete — structured details added.'].slice(-6));
            } else {
              setMessage('AI cleanup is complete. Review the detected details before applying them.');
              setProgressUpdates((current) => [...current, 'AI cleanup is complete.'].slice(-6));
            }
            setIsAiRefining(false);
          }
        }
        if (update.type === 'warning' && update.message) {
          const warningMessage = update.message;
          setMessage(update.message);
          setProgressUpdates((current) => [...current, warningMessage].slice(-6));
          setIsAiRefining(false);
        }
        if (update.type === 'complete' && update.message) {
          setMessage(update.message);
          setIsAiRefining(false);
        }
        if (update.type === 'error') streamError = update.message || 'Unable to import this résumé.';
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        lines.forEach(processEvent);
        if (done) break;
      }
      processEvent(buffer);
      if (streamError) throw new Error(streamError);
      if (!receivedDraft) throw new Error('No résumé details could be extracted from this file.');
      if (importRunRef.current === importRun) setStatus('idle');
    } catch (error) {
      if (importRunRef.current !== importRun) return;
      setStatus('error');
      setIsAiRefining(false);
      setMessage(error instanceof Error ? error.message : 'Unable to import this résumé.');
    }
  }

  const detected = draft ? [
    ['personalInfo', 'Personal details', Object.values(draft.personalInfo).some(Boolean)],
    ['photo', 'Profile photo embedded in the PDF', Boolean(draft.photoDataUrl)],
    ['experience', `${draft.experience.length} work experience${draft.experience.length === 1 ? '' : 's'}`, draft.experience.length > 0],
    ['projects', `${draft.projects.length} project${draft.projects.length === 1 ? '' : 's'}`, draft.projects.length > 0],
    ['education', `${draft.education.length} education item${draft.education.length === 1 ? '' : 's'}`, draft.education.length > 0],
    ['skills', `${draft.skills.length} skill${draft.skills.length === 1 ? '' : 's'}`, draft.skills.length > 0],
    ['languages', `${draft.languages.length} language${draft.languages.length === 1 ? '' : 's'}`, draft.languages.length > 0],
    ['certificates', `${draft.certificates.length} certificate${draft.certificates.length === 1 ? '' : 's'}`, draft.certificates.length > 0],
  ] as const : [];

  return (
    <div className="resume-import-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em]">Private AI import</p>
          <p className="mt-1 text-xs opacity-75">Import a PDF, PNG, or JPG. You will see text extraction progress and a quick review draft before optional AI cleanup finishes. Files are deleted after extraction.</p>
        </div>
        <label className={`resume-import-button shrink-0 ${status === 'uploading' ? 'pointer-events-none opacity-60' : ''}`}>
          {status === 'uploading' ? 'Importing…' : 'Import résumé'}
          <input type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={handleImport} disabled={status === 'uploading'} />
        </label>
      </div>
      {message && <p className={`mt-3 text-xs ${status === 'error' ? 'text-red-700' : 'opacity-80'}`}>{message}</p>}
      {status === 'uploading' && (
        <div className="resume-import-status mt-3 p-3 text-xs">
          <div className="resume-import-status-title flex items-center gap-2 font-semibold">
            <span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />
            {isAiRefining && draft ? 'Quick preview available — AI cleanup continues' : /profile photo|embedded photo/i.test(message) ? 'Downloading profile photo' : 'Import in progress'}
          </div>
          <ol className="resume-import-status-list mt-2 space-y-1">
            {progressUpdates.map((update, index) => <li key={`${index}-${update}`}>{index + 1}. {update}</li>)}
          </ol>
        </div>
      )}
      {draft && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {isAiRefining && <p className="resume-import-refining-note text-xs">{hasAppliedQuickDraft ? 'Your selected quick details are already applied. AI cleanup is still running and will add the structured details automatically.' : 'You can apply this quick draft now; AI cleanup will continue and add structured details automatically.'}</p>}
          {draft.photoDataUrl && (
            <div className="resume-import-photo-preview">
              <img src={draft.photoDataUrl} alt="Extracted profile photo candidate" />
              <p className="text-xs opacity-75">Review the embedded PDF image before applying it as your profile photo.</p>
            </div>
          )}
          {detected.filter(([, , available]) => available).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-xs cursor-pointer">
              <span>{label}</span>
              <input type="checkbox" checked={selection[key]} onChange={(event) => setSelection((current) => ({ ...current, [key]: event.target.checked }))} />
            </label>
          ))}
          {draft.warnings.length > 0 && <p className="text-xs text-amber-700">Check dates and names before exporting: {draft.warnings.join(' ')}</p>}
          <div className="flex gap-2 pt-1">
            {!hasAppliedQuickDraft && <button type="button" className="resume-import-apply" onClick={() => { applyImportDraft(draft, selection); appliedSelectionRef.current = selection; setHasAppliedQuickDraft(true); setMessage(isAiRefining ? 'Selected details were added. AI cleanup is still running…' : 'Selected details were added to your résumé.'); setProgressUpdates((current) => [...current, 'Selected quick details added.'].slice(-6)); }}>Apply selected</button>}
            <button type="button" className="resume-import-cancel" onClick={() => { importRunRef.current += 1; setDraft(null); setMessage(''); setProgressUpdates([]); setIsAiRefining(false); setStatus('idle'); }}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
