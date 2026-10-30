'use client';

import { useRef, useState } from 'react';
import { useResumeStore } from '@/store/useResumeStore';
import type { ResumeImportDraft, ResumeImportSelection } from '@/types/resume';

type AppliedImportItems = {
  personalInfo: string;
  photo: string;
  experience: Set<string>;
  projects: Set<string>;
  education: Set<string>;
  skills: Set<string>;
  languages: Set<string>;
  certificates: Set<string>;
};

function createAppliedImportItems(): AppliedImportItems {
  return { personalInfo: '', photo: '', experience: new Set(), projects: new Set(), education: new Set(), skills: new Set(), languages: new Set(), certificates: new Set() };
}

function itemKey(section: keyof Omit<AppliedImportItems, 'personalInfo' | 'photo'>, item: Record<string, string>) {
  if (section === 'experience') return [item.company, item.position, item.startDate, item.endDate].join('|').toLowerCase();
  if (section === 'projects') return [item.name, item.completionDate, item.link].join('|').toLowerCase();
  if (section === 'education') return [item.institution, item.degree, item.startDate, item.endDate].join('|').toLowerCase();
  if (section === 'skills' || section === 'languages') return item.name.toLowerCase();
  return [item.name, item.issuer, item.date].join('|').toLowerCase();
}

export default function ResumeImportContent() {
  const { applyImportDraft, updatePersonalInfo } = useResumeStore();
  const [extractedDraft, setExtractedDraft] = useState<ResumeImportDraft | null>(null);
  const [enhancedDraft, setEnhancedDraft] = useState<ResumeImportDraft | null>(null);
  const [selectedDraftSource, setSelectedDraftSource] = useState<'extracted' | 'enhanced'>('extracted');
  const [selection, setSelection] = useState<ResumeImportSelection>({ personalInfo: true, photo: true, experience: true, projects: true, education: true, skills: true, languages: true, certificates: true });
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const importRunRef = useRef(0);
  const appliedItemsRef = useRef<AppliedImportItems>(createAppliedImportItems());

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
    setAppliedCount(0);
    appliedItemsRef.current = createAppliedImportItems();
    setExtractedDraft(null);
    setEnhancedDraft(null);
    setSelectedDraftSource('extracted');
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
          if (update.source === 'extracted') {
            setExtractedDraft(update.draft);
            setSelectedDraftSource('extracted');
          } else if (update.source === 'photo') {
            setExtractedDraft((current) => current ? { ...current, photoDataUrl: update.draft!.photoDataUrl } : current);
            setEnhancedDraft((current) => current ? { ...current, photoDataUrl: update.draft!.photoDataUrl } : update.draft!);
          } else {
            setEnhancedDraft(update.draft);
          }
          const personalInfoKey = JSON.stringify(update.draft.personalInfo);
          const populatedPersonalInfo = Object.fromEntries(
            Object.entries(update.draft.personalInfo).filter(([, value]) => Boolean(value)),
          );
          if (Object.keys(populatedPersonalInfo).length && personalInfoKey !== appliedItemsRef.current.personalInfo) {
            updatePersonalInfo(populatedPersonalInfo);
            appliedItemsRef.current.personalInfo = personalInfoKey;
          }
          if (update.source === 'extracted') {
            setMessage('Quick preview is ready. Detected personal details are already in your résumé preview while AI cleanup continues…');
            setProgressUpdates((current) => [...current, 'Quick preview is ready — detected personal details were added to the preview.'].slice(-6));
            setIsAiRefining(true);
          }
          if (update.source === 'photo') {
            setProgressUpdates((current) => [...current, 'Profile photo candidate found.'].slice(-6));
          }
          if (update.source === 'ai-partial') {
            setMessage('PDF/Tesseract extraction is ready to use now. Ollama is preparing an enhanced alternative in the background.');
            setIsAiRefining(true);
          }
          if (update.source === 'ai') {
            setMessage('Ollama cleanup is complete. Choose PDF/Tesseract extraction only or PDF/Tesseract + Ollama before applying selected details.');
            setProgressUpdates((current) => [...current, 'Ollama cleanup is complete — both import options are ready.'].slice(-6));
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

  function applyNewSelectedItems() {
    const draft = selectedDraftSource === 'enhanced' && enhancedDraft ? enhancedDraft : extractedDraft;
    if (!draft) return;
    const applied = appliedItemsRef.current;
    const nextSelection: ResumeImportSelection = { personalInfo: false, photo: false, experience: false, projects: false, education: false, skills: false, languages: false, certificates: false };
    const nextDraft: ResumeImportDraft = { ...draft, personalInfo: {}, photoDataUrl: undefined, experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], warnings: [] };
    const personalInfoKey = JSON.stringify(draft.personalInfo);

    if (selection.personalInfo && personalInfoKey !== '{}' && personalInfoKey !== applied.personalInfo) {
      nextSelection.personalInfo = true;
      nextDraft.personalInfo = draft.personalInfo;
      applied.personalInfo = personalInfoKey;
    }
    if (selection.photo && draft.photoDataUrl && draft.photoDataUrl !== applied.photo) {
      nextSelection.photo = true;
      nextDraft.photoDataUrl = draft.photoDataUrl;
      applied.photo = draft.photoDataUrl;
    }
    (['experience', 'projects', 'education', 'skills', 'languages', 'certificates'] as const).forEach((section) => {
      if (!selection[section]) return;
      const newItems = draft[section].filter((item) => {
        const key = itemKey(section, item as Record<string, string>);
        if (applied[section].has(key)) return false;
        applied[section].add(key);
        return true;
      });
      if (newItems.length) {
        nextSelection[section] = true;
        nextDraft[section] = newItems as never;
      }
    });
    if (!Object.values(nextSelection).some(Boolean)) {
      setMessage('There are no new selected details to add yet. Keep importing, or change the selected sections.');
      return;
    }
    applyImportDraft(nextDraft, nextSelection);
    setAppliedCount((count) => count + 1);
    setMessage(isAiRefining ? 'Selected PDF/Tesseract details added. Ollama cleanup continues in the background…' : `Selected ${selectedDraftSource === 'enhanced' ? 'PDF/Tesseract + Ollama' : 'PDF/Tesseract'} details were added to your résumé.`);
    setProgressUpdates((current) => [...current, 'Selected new details added.'].slice(-6));
  }

  const draft = selectedDraftSource === 'enhanced' && enhancedDraft ? enhancedDraft : extractedDraft;
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
          <p className="mt-1 text-xs opacity-75">Import a PDF, PNG, or JPG. Use the fast PDF/Tesseract extraction immediately, then optionally choose the Ollama-enhanced result when it is ready. Files are deleted after extraction.</p>
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
            {draft?.personalInfo.fullName ? `Importing ${draft.personalInfo.fullName}’s résumé` : isAiRefining && draft ? 'PDF/Tesseract draft available — Ollama cleanup continues' : /profile photo|embedded photo/i.test(message) ? 'Downloading profile photo' : 'Import in progress'}
          </div>
          {draft?.personalInfo.fullName && <p className="mt-1 opacity-80">Detected résumé: <strong>{draft.personalInfo.fullName}</strong>. The remaining details are loading now.</p>}
          <ol className="resume-import-status-list mt-2 space-y-1">
            {progressUpdates.map((update, index) => <li key={`${index}-${update}`}>{index + 1}. {update}</li>)}
          </ol>
        </div>
      )}
      {draft && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {isAiRefining && <p className="resume-import-refining-note text-xs">The fast PDF/Tesseract draft is selected and ready to apply now. Detected personal details already appear in the preview while Ollama prepares its enhanced alternative.</p>}
          {enhancedDraft && !isAiRefining && (
            <div className="resume-import-source-picker" role="group" aria-label="Choose import data source">
              <p className="text-xs font-semibold">Choose the data to review and apply</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={`resume-import-source ${selectedDraftSource === 'extracted' ? 'resume-import-source-active' : ''}`} onClick={() => setSelectedDraftSource('extracted')} aria-pressed={selectedDraftSource === 'extracted'}>Use PDF/Tesseract extraction</button>
                <button type="button" className={`resume-import-source ${selectedDraftSource === 'enhanced' ? 'resume-import-source-active' : ''}`} onClick={() => setSelectedDraftSource('enhanced')} aria-pressed={selectedDraftSource === 'enhanced'}>Use PDF/Tesseract + Ollama</button>
              </div>
              <p className="mt-2 text-xs opacity-75">{selectedDraftSource === 'enhanced' ? 'Using the extracted data with Ollama’s structured work and project details.' : 'Using only the fast PDF text extraction or Tesseract OCR result.'}</p>
            </div>
          )}
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
            <button type="button" className="resume-import-apply" onClick={applyNewSelectedItems}>Apply selected {selectedDraftSource === 'enhanced' ? 'PDF + Ollama' : 'PDF/Tesseract'} data{appliedCount ? ' again' : ''}</button>
            <button type="button" className="resume-import-cancel" onClick={() => { importRunRef.current += 1; setExtractedDraft(null); setEnhancedDraft(null); setSelectedDraftSource('extracted'); setMessage(''); setProgressUpdates([]); setIsAiRefining(false); setStatus('idle'); }}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
