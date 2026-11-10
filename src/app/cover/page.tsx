'use client';

import Link from 'next/link';
import { ChangeEvent, type CSSProperties, type FocusEvent, type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import FeedbackWidget from '@/components/FeedbackWidget';
import { useCareerStore } from '@/store/useCareerStore';
import { useUIStore } from '@/store/useUIStore';
import type { CoverLetterData, CoverLetterDocumentFormat, CoverLetterFontFamily, CoverLetterFontSize, CoverLetterLayout, CoverLetterSpacing, CoverLetterStyle } from '@/types/career';
import { trackAnalyticsEvent } from '@/utils/analytics';

const layoutOptions: Array<{ value: CoverLetterLayout; label: string; detail: string }> = [
  { value: 'classic', label: 'Classic', detail: 'Traditional letterhead' },
  { value: 'modern', label: 'Modern', detail: 'Bold ruled header' },
  { value: 'compact', label: 'Compact', detail: 'Dense, space-saving' },
  { value: 'minimal', label: 'Minimal', detail: 'Letter body only' },
];
const documentFormatOptions: Array<{ value: CoverLetterDocumentFormat; label: string; detail: string }> = [
  { value: 'header-body-footer', label: 'Full letter', detail: 'Header, body & footer' },
  { value: 'body-only', label: 'Body only', detail: 'Clean document page' },
  { value: 'body-footer', label: 'Body & footer', detail: 'Closing without a header' },
];
const accentColors = ['#386641', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#0891b2', '#1f2937'];
const resumeTextColors = ['#1c2d20', '#386641', '#6a994e', '#a7c957', '#bc4749'];
type PendingTailoredLetter = Pick<CoverLetterData, 'companyName' | 'roleTitle'> & { originalBody: string; tailoredBody: string };
type LetterBodyVersion = 'original' | 'tailored';

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

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function plainTextToBodyHtml(value: string) {
  const paragraphBoundary = '\u0000';
  const paragraphs = value
    .replace(/\r\n?/g, '\n')
    // Docling may create blank visual wraps inside an unfinished sentence.
    // Keep a paragraph break only after . ! or ? followed by a whitespace gap.
    .replace(/([.!?])\s{2,}/g, `$1${paragraphBoundary}`)
    .replace(/\s+/g, ' ')
    .split(paragraphBoundary)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
}

function bodyHtmlToPlainText(value: string) {
  return value
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/gi, "'")
    .trim();
}

function sanitizeEditableMarkup(value: string) {
  const source = new DOMParser().parseFromString(value, 'text/html');
  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';
    const content = Array.from(node.childNodes).map(sanitizeNode).join('');
    const tag = node.tagName.toLowerCase();
    if (tag === 'br') return '<br />';
    if (tag === 'b' || tag === 'strong') return `<strong>${content}</strong>`;
    if (tag === 'i' || tag === 'em') return `<em>${content}</em>`;
    if (tag === 'u') return `<u>${content}</u>`;
    if (tag === 'span' && /^#[0-9a-f]{6}$/i.test(node.style.color)) return `<span style="color: ${node.style.color}">${content}</span>`;
    if (tag === 'font' && /^#[0-9a-f]{6}$/i.test(node.getAttribute('color') ?? '')) return `<span style="color: ${node.getAttribute('color')}">${content}</span>`;
    return content;
  };
  const blocks = Array.from(source.body.children).flatMap((node) => {
    if (node instanceof HTMLParagraphElement || node.tagName === 'DIV') {
      const content = Array.from(node.childNodes).map(sanitizeNode).join('');
      const alignment = ['left', 'center', 'right', 'justify'].includes((node as HTMLElement).style.textAlign)
        ? ` style="text-align: ${(node as HTMLElement).style.textAlign}"`
        : '';
      return content || node.tagName === 'DIV' ? [`<p${alignment}>${content}</p>`] : [];
    }
    const content = sanitizeNode(node);
    return content.trim() ? [`<p>${content}</p>`] : [];
  });
  return blocks.length ? blocks.join('') : '<p></p>';
}

function sanitizeFooterMarkup(value: string) {
  return sanitizeEditableMarkup(value).replace(/^<p>|<\/p>$/g, '');
}

function storedBodyMarkup(value: string) {
  return /<p(?:\s[^>]*)?>[\s\S]*<\/p>/i.test(value) ? value : plainTextToBodyHtml(value);
}

function storedFooterMarkup(value: string) {
  return /<[^>]+>/.test(value) ? value : escapeHtml(value).replace(/\n/g, '<br />');
}

function CoverLetterDocument({ coverLetter, coverLetterStyle }: { coverLetter: CoverLetterData; coverLetterStyle: CoverLetterStyle }) {
  const hasHeader = coverLetterStyle.documentFormat === 'header-body-footer';
  const hasFooter = coverLetterStyle.documentFormat !== 'body-only';
  const previewProps = {
    'data-layout': coverLetterStyle.layout,
    'data-document-format': coverLetterStyle.documentFormat,
    'data-font': coverLetterStyle.fontFamily,
    'data-font-size': coverLetterStyle.fontSize,
    'data-paragraph-spacing': coverLetterStyle.paragraphSpacing,
    'data-word-spacing': coverLetterStyle.wordSpacing,
    'data-header-spacing': coverLetterStyle.headerSpacing,
    style: { '--cover-accent': coverLetterStyle.accentColor } as CSSProperties,
  };
  const editableField = (key: keyof Pick<CoverLetterData, 'senderName' | 'senderEmail' | 'senderPhone' | 'senderLocation'>, value: string, placeholder: string, className?: string) => (
    <span data-cover-field={key} data-empty={value ? undefined : 'true'} data-placeholder={placeholder} className={className}>{value}</span>
  );

  return <article className="cover-letter-preview cover-letter-page cover-letter-document" {...previewProps}>
    {hasHeader && <header className="cover-letter-letterhead" data-cover-section="header">
      <h2>{editableField('senderName', coverLetter.senderName, 'Your name', 'cover-letter-editable-field')}</h2>
      <p className="cover-letter-contact">
        {editableField('senderEmail', coverLetter.senderEmail, 'Email', 'cover-letter-editable-field')}
        <span className="cover-letter-contact-separator" aria-hidden="true"> · </span>
        {editableField('senderPhone', coverLetter.senderPhone, 'Phone', 'cover-letter-editable-field')}
        <span className="cover-letter-contact-separator" aria-hidden="true"> · </span>
        {editableField('senderLocation', coverLetter.senderLocation, 'Location', 'cover-letter-editable-field')}
      </p>
    </header>}
    <div className="cover-letter-content">
      <div className="cover-letter-body" data-cover-body dangerouslySetInnerHTML={{ __html: storedBodyMarkup(coverLetter.body) }} />
    </div>
    {hasFooter && <footer className="cover-letter-footer" data-cover-footer data-empty={coverLetter.footer ? undefined : 'true'} data-placeholder="Add a closing, signature, or portfolio link" dangerouslySetInnerHTML={{ __html: storedFooterMarkup(coverLetter.footer) }} />}
  </article>;
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
  const [pendingTailoredLetter, setPendingTailoredLetter] = useState<PendingTailoredLetter | null>(null);
  const [activeLetterBodyVersion, setActiveLetterBodyVersion] = useState<LetterBodyVersion | null>(null);
  const { studioTheme, toggleStudioTheme } = useUIStore();

  const updateDisplayedLetterBody = useCallback((body: string) => {
    updateCoverLetter({ body });
    setPendingTailoredLetter((current) => {
      if (!current || !activeLetterBodyVersion) return current;
      return activeLetterBodyVersion === 'original' ? { ...current, originalBody: body } : { ...current, tailoredBody: body };
    });
  }, [activeLetterBodyVersion, updateCoverLetter]);
  const clearTailoredCandidate = () => { setPendingTailoredLetter(null); setActiveLetterBodyVersion(null); };
  useEffect(() => {
    const closeToolMenusOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.career-tool-menu-item')) return;
      document.querySelectorAll<HTMLDetailsElement>('.career-tool-menu-item[open]').forEach((menu) => { menu.open = false; });
    };
    document.addEventListener('pointerdown', closeToolMenusOnOutsidePointerDown);
    return () => document.removeEventListener('pointerdown', closeToolMenusOnOutsidePointerDown);
  }, []);
  const persistPreviewEdits = useCallback((event: FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) return;
    const preview = previewRef.current;
    if (!preview) return;
    const readField = (key: 'senderName' | 'senderEmail' | 'senderPhone' | 'senderLocation') => {
      const field = preview.querySelector<HTMLElement>(`[data-cover-field="${key}"]`);
      return field ? field.textContent?.replace(/\s+/g, ' ').trim() ?? '' : undefined;
    };
    const body = sanitizeEditableMarkup(preview.querySelector<HTMLElement>('[data-cover-body]')?.innerHTML ?? '');
    const footer = sanitizeFooterMarkup(preview.querySelector<HTMLElement>('[data-cover-footer]')?.innerHTML ?? '');
    const fields = {
      senderName: readField('senderName'),
      senderEmail: readField('senderEmail'),
      senderPhone: readField('senderPhone'),
      senderLocation: readField('senderLocation'),
    };
    const changes = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as Partial<Pick<CoverLetterData, 'senderName' | 'senderEmail' | 'senderPhone' | 'senderLocation'>>;
    if (body !== coverLetter.body) updateDisplayedLetterBody(body);
    if (footer !== coverLetter.footer) updateCoverLetter({ footer });
    const fieldsChanged = Object.entries(changes).some(([key, value]) => coverLetter[key as keyof CoverLetterData] !== value);
    if (fieldsChanged) updateCoverLetter(changes);
  }, [coverLetter, updateCoverLetter, updateDisplayedLetterBody]);
  const applyTextCommand = useCallback((command: 'bold' | 'italic' | 'underline' | 'foreColor' | 'justifyLeft' | 'justifyCenter' | 'justifyRight', value?: string) => {
    const preview = previewRef.current;
    const selection = window.getSelection();
    if (!preview || !selection?.rangeCount || !preview.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
    document.execCommand(command, false, value);
    const body = sanitizeEditableMarkup(preview.querySelector<HTMLElement>('[data-cover-body]')?.innerHTML ?? '');
    const footer = sanitizeFooterMarkup(preview.querySelector<HTMLElement>('[data-cover-footer]')?.innerHTML ?? '');
    if (body !== coverLetter.body) updateDisplayedLetterBody(body);
    if (footer !== coverLetter.footer) updateCoverLetter({ footer });
  }, [coverLetter.body, coverLetter.footer, updateCoverLetter, updateDisplayedLetterBody]);
  async function copyPreviewLetter() {
    const text = bodyHtmlToPlainText(coverLetter.body);
    if (!text) {
      setMessage('There is no letter text to copy yet.');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        if (!document.execCommand('copy')) throw new Error('Copy command was unavailable.');
        textarea.remove();
      }
      setMessage('');
    } catch {
      setMessage('Unable to copy the letter. Select the preview text and copy it manually.');
    }
  }

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
      .career-preview-pages { display: block !important; min-width: 0 !important; gap: 0 !important; padding: 0 !important; }
      .cover-letter-page { height: auto !important; min-height: 297mm !important; overflow: visible !important; }
      .cover-letter-preview, .cover-letter-preview * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .cover-letter-letterhead { padding-bottom: 8mm; border-bottom: 3px solid var(--cover-accent, #386641); }
      .cover-letter-letterhead h2 { margin: 0; color: var(--cover-accent, #386641); font-size: 25px; font-weight: 800; letter-spacing: -.03em; }
      .cover-letter-letterhead p { margin: 3px 0 0; color: #57695a; font-size: 11px; }
      .cover-letter-preview[data-header-spacing="sm"] { --cover-header-space: 4mm; }
      .cover-letter-preview[data-header-spacing="md"] { --cover-header-space: 9mm; }
      .cover-letter-preview[data-header-spacing="lg"] { --cover-header-space: 14mm; }
      .cover-letter-content { padding-top: var(--cover-header-space, 9mm); }
      .cover-letter-content > p { margin: 0 0 2px; white-space: pre-wrap; }
      .cover-letter-body { margin-top: 0; }
      .cover-letter-body p { margin: 0 0 var(--cover-paragraph-space, 5mm); white-space: pre-wrap; }
      .cover-letter-footer { margin-top: 12mm; white-space: pre-wrap; }
      .cover-letter-preview[data-font="serif"] { font-family: Georgia, 'Times New Roman', serif; }
      .cover-letter-preview[data-font="sans-serif"] { font-family: Arial, Helvetica, sans-serif; }
      .cover-letter-preview[data-font="mono"] { font-family: 'SFMono-Regular', Consolas, monospace; }
      .cover-letter-preview[data-font-size="sm"] { font-size: 12.5px; }
      .cover-letter-preview[data-font-size="md"] { font-size: 14px; }
      .cover-letter-preview[data-font-size="lg"] { font-size: 15.5px; }
      .cover-letter-preview[data-word-spacing="sm"] { word-spacing: -.04em; }
      .cover-letter-preview[data-word-spacing="md"] { word-spacing: normal; }
      .cover-letter-preview[data-word-spacing="lg"] { word-spacing: .12em; }
      .cover-letter-preview[data-paragraph-spacing="sm"] { --cover-paragraph-space: 3mm; }
      .cover-letter-preview[data-paragraph-spacing="md"] { --cover-paragraph-space: 5mm; }
      .cover-letter-preview[data-paragraph-spacing="lg"] { --cover-paragraph-space: 7mm; }
      .cover-letter-preview[data-layout="classic"] .cover-letter-letterhead { border-bottom-width: 1px; }
      .cover-letter-preview[data-layout="classic"] { padding: 20mm 23mm !important; }
      .cover-letter-preview[data-layout="compact"] { padding: 15mm 17mm !important; line-height: 1.48; }
      .cover-letter-preview[data-layout="minimal"] .cover-letter-content { padding-top: 0; }
    `;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${filename}</title><style>${printCss}</style></head><body>${source.innerHTML}</body></html>`);
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
          replaceCoverLetter({ ...fields, companyName: '', roleTitle: '', body: cleanImportedText(event.text) });
          clearTailoredCandidate();
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
    clearTailoredCandidate();
    setActivityStage('Preparing server AI');
    setActivityDetail('Sending your current letter and job requirements to the server AI…');
    setMessage('');
    const originalBody = coverLetter.body;
    try {
      const response = await fetch('/api/cover-letter-tailor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: bodyHtmlToPlainText(coverLetter.body),
          jobDescription: coverLetter.jobDescription,
          senderName: coverLetter.senderName,
          senderEmail: coverLetter.senderEmail,
          senderPhone: coverLetter.senderPhone,
          senderLocation: coverLetter.senderLocation,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(payload.message || 'Unable to tailor this letter.');
      }
      let tailored = false;
      let streamError = '';
      await readProgressStream(response, (event) => {
        if (event.type === 'stage') {
          const labels: Record<string, string> = { validating: 'Preparing server AI', 'server-ai': 'Server AI tailoring', review: 'Tailored letter ready' };
          setActivityStage(labels[String(event.stage)] ?? 'Server AI');
          setActivityDetail(String(event.detail ?? 'Tailoring your cover letter…'));
        }
        if (event.type === 'result' && typeof event.body === 'string' && event.body.trim()) {
          const tailoredBody = plainTextToBodyHtml(event.body);
          setPendingTailoredLetter({
            originalBody,
            tailoredBody,
            roleTitle: typeof event.roleTitle === 'string' ? event.roleTitle : '',
            companyName: typeof event.companyName === 'string' ? event.companyName : '',
          });
          updateCoverLetter({ body: tailoredBody });
          setActiveLetterBodyVersion('tailored');
          tailored = true;
        }
        if (event.type === 'error') streamError = String(event.message ?? 'Unable to tailor this letter.');
      });
      if (streamError) throw new Error(streamError);
      if (!tailored) throw new Error('The server AI did not return a complete tailored letter.');
      setMessage('Tailored letter is now shown in the document. Use the Original / Tailored switch above it to compare both complete versions.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to tailor this letter.');
    } finally {
      setIsTailoring(false);
      setActivityStage('');
      setActivityDetail('');
    }
  }

  function showLetterBodyVersion(version: LetterBodyVersion) {
    if (!pendingTailoredLetter) return;
    const body = version === 'original' ? pendingTailoredLetter.originalBody : pendingTailoredLetter.tailoredBody;
    updateCoverLetter({ body });
    setActiveLetterBodyVersion(version);
    setMessage('');
    if (version === 'tailored') trackAnalyticsEvent('cover_letter_tailored');
  }

  function closeOtherToolMenus(event: SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open) return;
    document.querySelectorAll<HTMLDetailsElement>('.career-tool-menu-item[open]').forEach((menu) => {
      if (menu !== event.currentTarget) menu.open = false;
    });
  }

  return (
    <main className="resume-studio career-tool min-h-screen" data-theme={studioTheme}>
      <header className="studio-header sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="studio-mark" aria-hidden="true">C</div>
          <div><p className="studio-header-title text-lg font-bold">Cover letter</p><p className="studio-header-subtitle hidden text-xs sm:block">Create, tailor, save and export locally</p></div>
        </div>
        <nav className="flex items-center gap-2" aria-label="Career tools">
          <Link href="/" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Résumé</Link>
          <Link href="/tracking" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Tracking</Link>
          <button type="button" onClick={printCoverLetter} className="studio-export-button inline-flex h-10 items-center px-4 text-sm font-semibold">↓ Export PDF</button>
        </nav>
      </header>

      <div className="career-tool-menu" aria-label="Cover letter tools">
        <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
          <summary>Document style</summary>
          <div className="career-tool-menu-content space-y-3">
            <div><span className="career-field-label">Document parts</span><div className="grid gap-2 sm:grid-cols-3">{documentFormatOptions.map((format) => <button type="button" key={format.value} onClick={() => updateCoverLetterStyle({ documentFormat: format.value })} className={`career-document-format-option ${coverLetterStyle.documentFormat === format.value ? 'career-document-format-option-active' : ''}`}><span className="font-bold">{format.label}</span><span>{format.detail}</span></button>)}</div></div>
            <div><span className="career-field-label">Page layout</span><div className="grid grid-cols-2 gap-2">{layoutOptions.map((layout) => <button type="button" key={layout.value} onClick={() => updateCoverLetterStyle({ layout: layout.value })} className={`career-layout-option ${coverLetterStyle.layout === layout.value ? 'career-layout-option-active' : ''}`}><span className={`career-layout-thumbnail career-layout-thumbnail-${layout.value}`} style={{ '--cover-accent': coverLetterStyle.accentColor } as CSSProperties}><i /><b /></span><span className="mt-1 block text-xs font-bold">{layout.label}</span><span className="block text-[11px] opacity-70">{layout.detail}</span></button>)}</div></div>
            <div><span className="career-field-label">Typography & spacing</span><div className="career-style-control-grid"><div><span>Font</span><div>{(['serif', 'sans-serif', 'mono'] as CoverLetterFontFamily[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontFamily: value })} className={`style-chip ${coverLetterStyle.fontFamily === value ? 'style-chip-active' : ''}`}>{value === 'sans-serif' ? 'Sans' : value === 'mono' ? 'Mono' : 'Serif'}</button>)}</div></div><div><span>Font size</span><div>{(['sm', 'md', 'lg'] as CoverLetterFontSize[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontSize: value })} className={`style-chip ${coverLetterStyle.fontSize === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div><div><span>Paragraph spacing</span><div>{(['sm', 'md', 'lg'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ paragraphSpacing: value })} className={`style-chip ${coverLetterStyle.paragraphSpacing === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div><div><span>Word spacing</span><div>{(['sm', 'md', 'lg'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ wordSpacing: value })} className={`style-chip ${coverLetterStyle.wordSpacing === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div></div></div>
            <div><span className="career-field-label">Document accent</span><div className="flex flex-wrap gap-2">{accentColors.map((color) => <button type="button" aria-label={`Use ${color} as accent color`} key={color} onClick={() => updateCoverLetterStyle({ accentColor: color })} className={`career-color-swatch ${coverLetterStyle.accentColor === color ? 'career-color-swatch-active' : ''}`} style={{ backgroundColor: color }} />)}<input type="color" aria-label="Custom accent color" value={coverLetterStyle.accentColor} onChange={(event) => updateCoverLetterStyle({ accentColor: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></div></div>
          </div>
        </details>
        <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}>
          <summary>Tailor</summary>
          <div className="career-tool-menu-content space-y-3"><div><p className="career-kicker">Tailor with AI</p><p className="mt-1 text-sm opacity-75">Paste the job description, then tailor the letter currently on the page. Your original text is kept so you can compare it with the tailored version before choosing one.</p></div><textarea className="input-field min-h-36 resize-y" value={coverLetter.jobDescription} onChange={(event) => updateCoverLetter({ jobDescription: event.target.value })} placeholder="Paste the role responsibilities, requirements, and company context here." /><button type="button" className="career-primary-button" onClick={tailorCoverLetter} disabled={isTailoring || isImporting}>{isTailoring ? 'Tailoring…' : 'Tailor letter'}</button>{isTailoring && <div className="career-activity" role="status" aria-live="polite"><div className="career-activity-title"><span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />{activityStage || 'Working'}</div><p className="mt-1">{activityDetail || 'The server is processing your request…'}</p></div>}{message && <p className="career-message" role="status">{message}</p>}{pendingTailoredLetter && <div className="career-tailored-choice"><p className="career-kicker">Choose the version on the page</p><p className="mt-1 text-sm opacity-75">Select a complete letter below. The active choice replaces the document immediately.</p><div className="career-preview-version-toggle mt-3" role="group" aria-label="Choose the cover letter version"><button type="button" className={activeLetterBodyVersion === 'original' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('original')}>Original</button><button type="button" className={activeLetterBodyVersion === 'tailored' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('tailored')}>Tailored</button></div><p className="mt-3 text-sm opacity-75">Showing: <strong>{activeLetterBodyVersion === 'tailored' ? 'Tailored letter' : 'Original letter'}</strong></p><p className="mt-1 text-sm opacity-75">Detected: {pendingTailoredLetter.roleTitle || 'Role not found'}{pendingTailoredLetter.companyName ? ` · ${pendingTailoredLetter.companyName}` : ''}</p></div>}</div>
        </details>
        <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}><summary>Import</summary><div className="career-tool-menu-content space-y-3"><div><p className="career-kicker">Import a PDF letter</p><p className="mt-1 text-sm opacity-75">Upload a PDF you already wrote. Its text is extracted into this editable document; review the wording and formatting after import before exporting or tailoring.</p></div><label className={`career-secondary-button inline-flex cursor-pointer ${(isImporting || isTailoring) ? 'pointer-events-none opacity-60' : ''}`}><input className="sr-only" type="file" accept="application/pdf" onChange={handleImport} />{isImporting ? 'Importing with Docling…' : 'Upload PDF'}</label></div></details>
        <details className="career-tool-menu-item" onToggle={closeOtherToolMenus}><summary>Versions</summary><div className="career-tool-menu-content space-y-3"><div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { saveCoverLetterVersion(versionName); setVersionName(''); } }} placeholder="Name this cover-letter version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { saveCoverLetterVersion(versionName); setVersionName(''); }}>Save current</button></div>{coverLetterVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved cover letters yet.</p> : <div className="space-y-2">{coverLetterVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => { loadCoverLetterVersion(version.id); clearTailoredCandidate(); }}>Open</button><button type="button" className="resume-version-delete" onClick={() => deleteCoverLetterVersion(version.id)}>Delete</button></div></div>)}</div>}</div></details>
        <button type="button" className="career-clear-button" onClick={() => { if (window.confirm('Clear the current cover letter? Saved versions remain available.')) { clearCoverLetter(); clearTailoredCandidate(); setMessage(''); } }}>Clear resume</button>
      </div>

      <div className="career-text-toolbar" aria-label="Text formatting controls">
        <div className="career-text-toolbar-group"><span>Font</span>{(['serif', 'sans-serif', 'mono'] as CoverLetterFontFamily[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontFamily: value })} className={`style-chip ${coverLetterStyle.fontFamily === value ? 'style-chip-active' : ''}`}>{value === 'sans-serif' ? 'Sans' : value === 'mono' ? 'Mono' : 'Serif'}</button>)}</div>
        <div className="career-text-toolbar-group"><span>Size</span>{(['sm', 'md', 'lg'] as CoverLetterFontSize[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontSize: value })} className={`style-chip ${coverLetterStyle.fontSize === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div>
        <div className="career-text-toolbar-group"><span>Paragraph</span>{(['sm', 'md', 'lg'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ paragraphSpacing: value })} className={`style-chip ${coverLetterStyle.paragraphSpacing === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div>
        <div className="career-text-toolbar-group"><span>Word space</span>{(['sm', 'md', 'lg'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ wordSpacing: value })} className={`style-chip ${coverLetterStyle.wordSpacing === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div>
        <div className="career-text-palette" role="group" aria-label="Selected text formatting"><button type="button" aria-label="Bold selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('bold')}><strong>B</strong></button><button type="button" aria-label="Italic selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('italic')}><em>I</em></button><button type="button" aria-label="Underline selected text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('underline')}><u>U</u></button><span className="career-palette-divider" aria-hidden="true" />{resumeTextColors.map((color) => <button type="button" aria-label={`Use ${color} for selected text`} key={color} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('foreColor', color)}><span className="career-palette-color" style={{ '--palette-color': color } as CSSProperties} /></button>)}<span className="career-palette-divider" aria-hidden="true" /><button type="button" aria-label="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyLeft')}>≡</button><button type="button" aria-label="Center text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyCenter')}>≡</button><button type="button" aria-label="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyRight')}>≡</button></div>
      </div>
      {message && <div className="career-status-message mx-auto max-w-[1800px] px-4 pt-3" role="status"><p className="career-message">{message}</p></div>}

      <section className="career-workspace career-document-workspace mx-auto max-w-[1800px] p-4 lg:p-6" aria-label="Cover letter document editor">{pendingTailoredLetter && <div className="career-tailored-comparison" role="status"><div><p className="career-kicker">AI comparison ready</p><p className="mt-1 text-sm">Showing the <strong>{activeLetterBodyVersion === 'original' ? 'original' : 'tailored'}</strong> complete letter. Switch between both versions before continuing to edit.</p></div><div className="career-preview-version-toggle" role="group" aria-label="Compare original and tailored cover letters"><button type="button" className={activeLetterBodyVersion === 'original' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('original')}>Original</button><button type="button" className={activeLetterBodyVersion === 'tailored' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('tailored')}>Tailored</button></div></div>}<div className="career-preview-shell career-document-shell"><div className="career-preview-toolbar"><div><p className="career-kicker">Editable document</p><p className="mt-1 text-xs opacity-70">{pendingTailoredLetter ? `Showing the ${activeLetterBodyVersion === 'tailored' ? 'tailored' : 'original'} letter. Use Tailor to switch versions.` : 'Click anywhere on the page to type, paste, select, copy, or delete. Changes save when you leave the document.'}</p></div><div className="flex items-center gap-2">{pendingTailoredLetter && <div className="career-preview-version-toggle" role="group" aria-label="Choose the letter shown in the document"><button type="button" className={activeLetterBodyVersion === 'original' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('original')}>Original</button><button type="button" className={activeLetterBodyVersion === 'tailored' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('tailored')}>Tailored</button></div>}<button type="button" className="career-preview-copy-letter" onClick={copyPreviewLetter}>Copy letter</button></div></div><div className="career-preview-scale"><div ref={previewRef} contentEditable suppressContentEditableWarning onBlur={persistPreviewEdits} className="career-preview-pages career-document-pages"><CoverLetterDocument key={activeLetterBodyVersion ?? 'current'} coverLetter={coverLetter} coverLetterStyle={coverLetterStyle} /></div></div></div></section>
      <div className="studio-floating-controls fixed bottom-4 right-4 z-90 flex items-center gap-2">
        <FeedbackWidget />
        <button type="button" onClick={toggleStudioTheme} className="studio-theme-switch inline-flex h-10 items-center gap-2 px-2.5 text-xs font-bold uppercase tracking-[0.12em] sm:px-3" aria-label={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`}>
          <span aria-hidden="true">{studioTheme === 'dark' ? '☀' : '☾'}</span>
          <span className="hidden sm:inline">{studioTheme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </main>
  );
}