'use client';

import { useEffect, useRef, useState } from 'react';
import { type ResumeImportPreviewSnapshot, useResumeStore } from '@/store/useResumeStore';
import type { ResumeImportDraft, ResumeImportSelection } from '@/types/resume';

function formatElapsedTime(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `0:${seconds.toString().padStart(2, '0')}`;
}

function backendStage(message: string) {
  if (/saving your file|starting private résumé import/i.test(message)) return { label: 'Uploading PDF', detail: 'Saving the selected PDF to the private processing workspace.' };
  if (/converting.*docling|docling.*markdown/i.test(message)) return { label: 'Docling PDF extraction', detail: 'Converting the PDF into structured Markdown.' };
  if (/building the pdf extract/i.test(message)) return { label: 'TypeScript résumé parser', detail: 'Detecting résumé sections and building the fast PDF extract.' };
  if (/profile image|embedded photo/i.test(message)) return { label: 'PDF profile image check', detail: 'Looking for an embedded profile-photo candidate.' };
  if (/ollama|reading the docling markdown|detected (?:experience|project|skill|language|certificate|education|personal)/i.test(message)) return { label: 'Ollama AI parsing', detail: 'Structuring résumé details with the local Qwen model.' };
  if (/complete|ready to review/i.test(message)) return { label: 'Import complete', detail: 'The available résumé draft is ready to review.' };
  return { label: 'Preparing import', detail: 'Waiting for the next private processing stage.' };
}

export default function ResumeImportContent() {
  const { applyImportDraft, captureImportPreviewSnapshot, restoreImportPreviewSnapshot } = useResumeStore();
  const [extractedDraft, setExtractedDraft] = useState<ResumeImportDraft | null>(null);
  const [enhancedDraft, setEnhancedDraft] = useState<ResumeImportDraft | null>(null);
  const [isEnhancedDraftReady, setIsEnhancedDraftReady] = useState(false);
  const [selectedDraftSource, setSelectedDraftSource] = useState<'extracted' | 'enhanced'>('extracted');
  const [selection, setSelection] = useState<ResumeImportSelection>({ personalInfo: true, photo: true, experience: true, projects: true, education: true, skills: true, languages: true, certificates: true });
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progressUpdates, setProgressUpdates] = useState<string[]>([]);
  const [isAiRefining, setIsAiRefining] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [importStartedAt, setImportStartedAt] = useState<number | null>(null);
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(0);
  const [backendStageName, setBackendStageName] = useState('Preparing import');
  const [backendStageDetail, setBackendStageDetail] = useState('Waiting for the private import to begin.');
  const importRunRef = useRef(0);
  const previewSnapshotRef = useRef<ResumeImportPreviewSnapshot | null>(null);

  useEffect(() => {
    if (!importStartedAt || status !== 'uploading') return;
    const updateElapsed = () => setElapsedMilliseconds(Date.now() - importStartedAt);
    updateElapsed();
    const interval = window.setInterval(updateElapsed, 1_000);
    return () => window.clearInterval(interval);
  }, [importStartedAt, status]);

  function restoreImportPreview() {
    if (!previewSnapshotRef.current) return;
    restoreImportPreviewSnapshot(previewSnapshotRef.current);
  }

  function previewDraft(draft: ResumeImportDraft | null) {
    if (!draft || !previewSnapshotRef.current) return;
    restoreImportPreviewSnapshot(previewSnapshotRef.current);
    applyImportDraft(draft, { personalInfo: true, photo: true, experience: true, projects: true, education: true, skills: true, languages: true, certificates: true });
  }

  function selectDraftSource(source: 'extracted' | 'enhanced') {
    const nextDraft = source === 'enhanced' ? enhancedDraft : extractedDraft;
    if (!nextDraft) return;
    setSelectedDraftSource(source);
    previewDraft(nextDraft);
    setMessage(source === 'enhanced' ? 'Previewing PDF extract + AI data.' : 'Previewing PDF extract data.');
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const importRun = importRunRef.current + 1;
    importRunRef.current = importRun;
    restoreImportPreview();
    setStatus('uploading');
    setImportStartedAt(Date.now());
    setElapsedMilliseconds(0);
    setBackendStageName('Uploading PDF');
    setBackendStageDetail('Sending the selected PDF to the private processing workspace.');
    setMessage('Starting private résumé import…');
    setProgressUpdates(['Starting private résumé import…']);
    setIsAiRefining(false);
    setAppliedCount(0);
    previewSnapshotRef.current = captureImportPreviewSnapshot();
    setExtractedDraft(null);
    setEnhancedDraft(null);
    setIsEnhancedDraftReady(false);
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
        let update: { type?: string; message?: string; stage?: string; detail?: string; draft?: ResumeImportDraft; source?: string };
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
        if (update.type === 'stage' && update.stage && update.detail) {
          const detail = update.detail;
          const labels: Record<string, string> = { upload: 'Uploading PDF', docling: 'Docling PDF → Markdown', parsing: 'Building PDF extract', ollama: 'Ollama AI parsing', finalizing: 'Finalizing AI draft' };
          setBackendStageName(labels[update.stage] ?? 'Processing import');
          setBackendStageDetail(detail);
          setMessage(detail);
          setProgressUpdates((current) => current[current.length - 1] === detail ? current : [...current, detail].slice(-6));
          setIsAiRefining(update.stage === 'ollama' || update.stage === 'finalizing');
        }
        if (update.type === 'draft' && update.draft) {
          receivedDraft = true;
          if (update.source === 'extracted') {
            setExtractedDraft(update.draft);
            setSelectedDraftSource('extracted');
            previewDraft(update.draft);
          } else {
            setEnhancedDraft(update.draft);
            if (update.source === 'ai') setIsEnhancedDraftReady(true);
          }
          if (update.source === 'extracted') {
            setMessage('PDF extract is ready. Detected personal details are already in your résumé preview while AI continues…');
            setProgressUpdates((current) => [...current, 'PDF extract is ready — detected personal details were added to the preview.'].slice(-6));
            setIsAiRefining(true);
          }
          if (update.source === 'ai-partial') {
            setMessage('PDF extract is ready to use now. Ollama is preparing the PDF extract + AI alternative in the background.');
            setIsAiRefining(true);
          }
          if (update.source === 'ai') {
            setMessage('AI extraction is complete. Choose PDF extract or PDF extract + AI before applying selected details.');
            setProgressUpdates((current) => [...current, 'AI extraction is complete — both import options are ready.'].slice(-6));
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
      restoreImportPreview();
      setStatus('error');
      setIsAiRefining(false);
      setMessage(error instanceof Error ? error.message : 'Unable to import this résumé.');
    }
  }

  function applyNewSelectedItems() {
    const draft = selectedDraftSource === 'enhanced' && enhancedDraft ? enhancedDraft : extractedDraft;
    if (!draft) return;
    restoreImportPreview();
    applyImportDraft(draft, selection);
    previewSnapshotRef.current = null;
    setAppliedCount((count) => count + 1);
    setMessage(isAiRefining ? 'Selected PDF extract details added. Ollama continues in the background…' : `Selected ${selectedDraftSource === 'enhanced' ? 'PDF extract + AI' : 'PDF extract'} details were added to your résumé.`);
    setProgressUpdates((current) => [...current, 'Selected details applied to your résumé.'].slice(-6));
  }

  const draft = selectedDraftSource === 'enhanced' && enhancedDraft ? enhancedDraft : extractedDraft;
  const activeBackendStage = backendStage(message);
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
          <p className="mt-1 text-xs opacity-75">Import a PDF. Option 1 converts it to Markdown with Docling and parses it locally; Option 2 enriches the same extract with Ollama. Files are deleted after extraction.</p>
        </div>
        <label className={`resume-import-button shrink-0 ${status === 'uploading' ? 'pointer-events-none opacity-60' : ''}`}>
          {status === 'uploading' ? 'Importing…' : 'Import résumé'}
          <input type="file" accept="application/pdf" className="sr-only" onChange={handleImport} disabled={status === 'uploading'} />
        </label>
      </div>
      {message && <p className={`mt-3 text-xs ${status === 'error' ? 'text-red-700' : 'opacity-80'}`}>{message}</p>}
      {status === 'uploading' && (
        <div className="resume-import-status mt-3 p-3 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="resume-import-status-title flex items-center gap-2 font-semibold">
              <span className="resume-import-status-dot mt-1 inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />
              <span>{draft?.personalInfo.fullName ? `Importing ${draft.personalInfo.fullName}’s résumé` : isAiRefining && draft ? 'PDF extract available — AI enrichment continues' : 'Import in progress'}</span>
            </div>
            <span className="resume-import-elapsed" aria-label={`Elapsed import time ${formatElapsedTime(elapsedMilliseconds)}`}>Elapsed {formatElapsedTime(elapsedMilliseconds)}</span>
          </div>
          <div className="resume-import-stage mt-2">
            <p className="font-semibold">Backend: {backendStageName || activeBackendStage.label}</p>
            <p className="mt-0.5 opacity-80">{backendStageDetail || activeBackendStage.detail}</p>
          </div>
          {draft?.personalInfo.fullName && <p className="mt-1 opacity-80">Detected résumé: <strong>{draft.personalInfo.fullName}</strong>. The remaining details are loading now.</p>}
          <p className="mt-1 opacity-80">The PDF extract appears first when ready. The optional PDF extract + AI result can take 2–3 minutes for a detailed résumé.</p>
          <ol className="resume-import-status-list mt-2 space-y-1">
            {progressUpdates.map((update, index) => <li key={`${index}-${update}`}>{index + 1}. {update}</li>)}
          </ol>
        </div>
      )}
      {draft && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {isAiRefining && <p className="resume-import-refining-note text-xs">The PDF extract is selected and ready to apply now. Detected personal details already appear in the preview while Ollama prepares the PDF extract + AI alternative.</p>}
          {enhancedDraft && isEnhancedDraftReady && (
            <div className="resume-import-source-picker" role="group" aria-label="Choose import data source">
              <p className="text-xs font-semibold">Choose the data to review and apply</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={`resume-import-source ${selectedDraftSource === 'extracted' ? 'resume-import-source-active' : ''}`} onClick={() => selectDraftSource('extracted')} aria-pressed={selectedDraftSource === 'extracted'}>Use PDF extract</button>
                <button type="button" className={`resume-import-source ${selectedDraftSource === 'enhanced' ? 'resume-import-source-active' : ''}`} onClick={() => selectDraftSource('enhanced')} aria-pressed={selectedDraftSource === 'enhanced'}>Use PDF extract + AI</button>
              </div>
              <p className="mt-2 text-xs opacity-75">{selectedDraftSource === 'enhanced' ? 'Using the Docling PDF extract with local Ollama’s structured work and project details, plus a PDF profile-image candidate when found.' : 'Using only the Docling PDF-to-Markdown extract and local TypeScript parser — no LLM parsing or profile image.'}</p>
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
            <button type="button" className="resume-import-apply" onClick={applyNewSelectedItems}>Apply selected {selectedDraftSource === 'enhanced' ? 'PDF extract + AI' : 'PDF extract'} data{appliedCount ? ' again' : ''}</button>
            <button type="button" className="resume-import-cancel" onClick={() => { restoreImportPreview(); previewSnapshotRef.current = null; importRunRef.current += 1; setExtractedDraft(null); setEnhancedDraft(null); setIsEnhancedDraftReady(false); setSelectedDraftSource('extracted'); setMessage(''); setProgressUpdates([]); setIsAiRefining(false); setStatus('idle'); }}>Discard</button>
          </div>
        </div>
      )}
    </div>
  );
}
