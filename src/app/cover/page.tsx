'use client';

import Link from 'next/link';
import { ChangeEvent, type CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCareerStore } from '@/store/useCareerStore';
import type { CoverLetterData, CoverLetterFontFamily, CoverLetterFontSize, CoverLetterLayout, CoverLetterSpacing, CoverLetterStyle } from '@/types/career';
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
type PendingTailoredLetter = Pick<CoverLetterData, 'body' | 'companyName' | 'roleTitle'>;

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
    // Docling may wrap ordinary prose after every visual PDF line. Treat a paragraph
    // break only as a terminal punctuation mark followed by two spaces or two lines.
    .replace(/([.!?])(?:[ \t]{2,}|(?:[ \t]*\n[ \t]*){2,})/g, `$1${paragraphBoundary}`)
    .replace(/[ \t]*\n[ \t]*/g, ' ')
    .split(paragraphBoundary)
    .map((paragraph) => paragraph.replace(/[ \t]{2,}/g, ' ').trim())
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

function bodyHtmlToParagraphs(value: string) {
  const paragraphMatches = [...value.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((match) => match[1].trim()).filter(Boolean);
  return paragraphMatches.length ? paragraphMatches : plainTextToBodyHtml(value).match(/<p>([\s\S]*?)<\/p>/g)?.map((paragraph) => paragraph.replace(/^<p>|<\/p>$/g, '')) ?? [];
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
  return Array.from(source.body.querySelectorAll<HTMLElement>('.cover-letter-page p[data-cover-paragraph]')).map((paragraph) => {
    const alignment = ['left', 'center', 'right', 'justify'].includes(paragraph.style.textAlign) ? ` style="text-align: ${paragraph.style.textAlign}"` : '';
    return `<p${alignment}>${Array.from(paragraph.childNodes).map(sanitizeNode).join('')}</p>`;
  }).filter((paragraph) => bodyHtmlToPlainText(paragraph)).join('');
}

function CoverLetterPages({ coverLetter, coverLetterStyle, revision, onBodyBlur }: { coverLetter: CoverLetterData; coverLetterStyle: CoverLetterStyle; revision: number; onBodyBlur: () => void }) {
  const measureRef = useRef<HTMLElement>(null);
  const paragraphs = bodyHtmlToParagraphs(coverLetter.body || 'Your cover letter body will appear here.');
  const [pages, setPages] = useState<string[][]>([paragraphs]);
  const previewProps = { 'data-layout': coverLetterStyle.layout, 'data-font': coverLetterStyle.fontFamily, 'data-font-size': coverLetterStyle.fontSize, 'data-paragraph-spacing': coverLetterStyle.paragraphSpacing, style: { '--cover-accent': coverLetterStyle.accentColor } as CSSProperties };

  useLayoutEffect(() => {
    const measure = () => {
      const sheet = measureRef.current;
      if (!sheet) return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>('[data-cover-paragraph]'));
      if (!items.length) return;
      const styles = window.getComputedStyle(sheet);
      const topPadding = Number.parseFloat(styles.paddingTop) || 0;
      const bottomPadding = Number.parseFloat(styles.paddingBottom) || 0;
      const pageHeight = sheet.offsetWidth * (297 / 210);
      const firstPageBottom = pageHeight - bottomPadding;
      const continuationCapacity = pageHeight - topPadding - bottomPadding;
      const nextPages: string[][] = [[]];
      let continuationUsed = 0;

      items.forEach((item, index) => {
        const itemStyles = window.getComputedStyle(item);
        const itemHeight = item.getBoundingClientRect().height + (Number.parseFloat(itemStyles.marginTop) || 0) + (Number.parseFloat(itemStyles.marginBottom) || 0);
        const itemBottom = item.offsetTop + item.offsetHeight + (Number.parseFloat(itemStyles.marginBottom) || 0);
        const currentPage = nextPages.length - 1;
        const overflowsFirstPage = currentPage === 0 && nextPages[0].length > 0 && itemBottom > firstPageBottom;
        const overflowsContinuation = currentPage > 0 && nextPages[currentPage].length > 0 && continuationUsed + itemHeight > continuationCapacity;
        if (overflowsFirstPage || overflowsContinuation) {
          nextPages.push([]);
          continuationUsed = 0;
        }
        nextPages[nextPages.length - 1].push(paragraphs[index]);
        if (nextPages.length > 1) continuationUsed += itemHeight;
      });
      setPages((current) => JSON.stringify(current) === JSON.stringify(nextPages) ? current : nextPages);
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [coverLetter.body, coverLetter.companyName, coverLetter.roleTitle, coverLetter.senderName, coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation, coverLetterStyle, revision, paragraphs]);

  return <>
    <article ref={measureRef} aria-hidden="true" className="cover-letter-preview cover-letter-measure" {...previewProps}><header className="cover-letter-letterhead"><h2>{coverLetter.senderName || 'Your Name'}</h2><p>{[coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation].filter(Boolean).join(' · ') || 'Email · Phone · Location'}</p></header><div className="cover-letter-content">{(coverLetter.companyName || coverLetter.roleTitle) && <p className="cover-letter-role">{[coverLetter.roleTitle, coverLetter.companyName].filter(Boolean).join(' · ')}</p>}<div className="cover-letter-body">{paragraphs.map((paragraph, index) => <p data-cover-paragraph key={`${paragraph}-${index}`} dangerouslySetInnerHTML={{ __html: paragraph }} />)}</div></div></article>
    {pages.map((page, pageIndex) => <article key={`${revision}-${pageIndex}`} className="cover-letter-preview cover-letter-page" {...previewProps}>{pageIndex === 0 && <header className="cover-letter-letterhead"><h2>{coverLetter.senderName || 'Your Name'}</h2><p>{[coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation].filter(Boolean).join(' · ') || 'Email · Phone · Location'}</p></header>}<div className={`cover-letter-content ${pageIndex > 0 ? 'cover-letter-continuation-content' : ''}`}>{pageIndex === 0 && (coverLetter.companyName || coverLetter.roleTitle) && <p className="cover-letter-role">{[coverLetter.roleTitle, coverLetter.companyName].filter(Boolean).join(' · ')}</p>}<div className="cover-letter-body">{page.map((paragraph, index) => <p contentEditable suppressContentEditableWarning data-cover-paragraph key={`${pageIndex}-${paragraph}-${index}`} onBlur={onBodyBlur} dangerouslySetInnerHTML={{ __html: paragraph }} />)}</div></div></article>)}
  </>;
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
  const [pendingTailoredLetter, setPendingTailoredLetter] = useState<PendingTailoredLetter | null>(null);

  const updateField = (key: keyof CoverLetterData, value: string) => updateCoverLetter({ [key]: value });
  const clearTailoredCandidate = () => setPendingTailoredLetter(null);
  const persistPreviewBody = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const body = sanitizeEditableMarkup(preview.innerHTML);
    if (body && body !== coverLetter.body) {
      updateCoverLetter({ body });
      setPreviewRevision((revision) => revision + 1);
    }
  }, [coverLetter.body, updateCoverLetter]);
  const applyTextCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    window.setTimeout(persistPreviewBody, 0);
  };

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
      .cover-letter-measure { display: none !important; }
      .career-preview-pages { display: block !important; min-width: 0 !important; gap: 0 !important; padding: 0 !important; }
      .cover-letter-page { height: 297mm !important; min-height: 297mm !important; overflow: hidden !important; break-after: page; page-break-after: always; }
      .cover-letter-page:last-child { break-after: auto; page-break-after: auto; }
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
          replaceCoverLetter({ ...fields, companyName: '', roleTitle: '', body: cleanImportedText(event.text) });
          setPreviewRevision((revision) => revision + 1);
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
          setPendingTailoredLetter({
            body: event.body.trim(),
            roleTitle: typeof event.roleTitle === 'string' ? event.roleTitle : '',
            companyName: typeof event.companyName === 'string' ? event.companyName : '',
          });
          tailored = true;
        }
        if (event.type === 'error') streamError = String(event.message ?? 'Unable to tailor this letter.');
      });
      if (streamError) throw new Error(streamError);
      if (!tailored) throw new Error('The server AI did not return a revised letter body.');
      setMessage('Tailored letter is ready. Review it, then update the saved letter body and preview.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to tailor this letter.');
    } finally {
      setIsTailoring(false);
      setActivityStage('');
      setActivityDetail('');
    }
  }

  function updateTailoredInfo() {
    if (!pendingTailoredLetter) return;
    updateCoverLetter({ body: pendingTailoredLetter.body, companyName: pendingTailoredLetter.companyName, roleTitle: pendingTailoredLetter.roleTitle });
    setPreviewRevision((revision) => revision + 1);
    clearTailoredCandidate();
    setMessage('Updated the saved letter body, company, and role title from the tailored result.');
    trackAnalyticsEvent('cover_letter_tailored');
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
          <details className="career-style-card career-disclosure" open>
            <summary className="career-disclosure-summary"><span><p className="career-kicker">Layout & style</p><h2 className="font-bold">Match your résumé presentation</h2></span><span className="career-disclosure-icon" aria-hidden="true" /></summary>
            <div className="career-disclosure-content space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {layoutOptions.map((layout) => <button type="button" key={layout.value} onClick={() => updateCoverLetterStyle({ layout: layout.value })} className={`career-layout-option ${coverLetterStyle.layout === layout.value ? 'career-layout-option-active' : ''}`}><span className={`career-layout-thumbnail career-layout-thumbnail-${layout.value}`} style={{ '--cover-accent': coverLetterStyle.accentColor } as CSSProperties}><i /><b /></span><span className="mt-1 block text-xs font-bold">{layout.label}</span><span className="block text-[11px] opacity-70">{layout.detail}</span></button>)}
              </div>
              <div><span className="career-field-label">Accent color</span><div className="flex flex-wrap gap-2">{accentColors.map((color) => <button type="button" aria-label={`Use ${color} as accent color`} key={color} onClick={() => updateCoverLetterStyle({ accentColor: color })} className={`career-color-swatch ${coverLetterStyle.accentColor === color ? 'career-color-swatch-active' : ''}`} style={{ backgroundColor: color }} />)}<input type="color" aria-label="Custom accent color" value={coverLetterStyle.accentColor} onChange={(event) => updateCoverLetterStyle({ accentColor: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></div></div>
              <div className="grid gap-3 sm:grid-cols-3"><div><span className="career-field-label">Font family</span><div className="flex flex-wrap gap-1.5">{(['serif', 'sans-serif', 'mono'] as CoverLetterFontFamily[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontFamily: value })} className={`style-chip ${coverLetterStyle.fontFamily === value ? 'style-chip-active' : ''}`}>{value === 'sans-serif' ? 'Sans' : value === 'mono' ? 'Mono' : 'Serif'}</button>)}</div></div><div><span className="career-field-label">Font size</span><div className="flex flex-wrap gap-1.5">{(['sm', 'md', 'lg'] as CoverLetterFontSize[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontSize: value })} className={`style-chip ${coverLetterStyle.fontSize === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div><div><span className="career-field-label">Paragraph spacing</span><div className="flex flex-wrap gap-1.5">{(['tight', 'normal', 'relaxed'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ paragraphSpacing: value })} className={`style-chip capitalize ${coverLetterStyle.paragraphSpacing === value ? 'style-chip-active' : ''}`}>{value}</button>)}</div></div></div>
            </div>
          </details>
          <details className="career-disclosure" open>
            <summary className="career-disclosure-summary"><span><p className="career-kicker">Introduction</p><h2 className="font-bold">Your details and letter body</h2></span><span className="career-disclosure-icon" aria-hidden="true" /></summary>
            <div className="career-disclosure-content space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {fieldLabels.map(({ key, label, placeholder, type }) => (
                  <label key={key}><span className="career-field-label">{label}</span><input type={type ?? 'text'} className="input-field" value={coverLetter[key]} onChange={(event) => updateField(key, event.target.value)} placeholder={placeholder} /></label>
                ))}
              </div>
              <label><span className="career-field-label">Letter body</span><textarea className="input-field min-h-64 resize-y" value={bodyHtmlToPlainText(coverLetter.body)} onChange={(event) => updateField('body', event.target.value)} placeholder="Write the main body of your cover letter." /></label>
            </div>
          </details>
          <div className="career-divider" />
          <div className="space-y-2"><div><p className="career-kicker">Tailor to a role</p><h2 className="font-bold">Paste the job description</h2></div><textarea className="input-field min-h-44 resize-y" value={coverLetter.jobDescription} onChange={(event) => updateField('jobDescription', event.target.value)} placeholder="Paste the job description. The server AI will tailor the full letter body and detect the role and company." /><button type="button" className="career-primary-button" onClick={tailorCoverLetter} disabled={isTailoring || isImporting}>{isTailoring ? 'Tailoring…' : 'Tailor letter body'}</button><p className="text-sm opacity-75">Review the server AI result before replacing the saved letter body. Your name, email, phone, and location stay unchanged.</p>{pendingTailoredLetter && <div className="career-tailored-choice"><div><p className="career-kicker">Tailored letter ready</p><p className="mt-1 text-sm opacity-75">Detected: {pendingTailoredLetter.roleTitle || 'Role not found'}{pendingTailoredLetter.companyName ? ` · ${pendingTailoredLetter.companyName}` : ''}</p></div><textarea className="input-field mt-3 min-h-56 resize-y" value={pendingTailoredLetter.body} readOnly aria-label="Tailored letter body" /><button type="button" className="career-primary-button mt-3" onClick={updateTailoredInfo}>Update tailored info</button></div>}</div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Import</p><h2 className="font-bold">Import an existing cover letter</h2><p className="mt-1 text-sm opacity-75">PDF extraction uses Docling only; it does not use AI.</p></div><label className={`career-secondary-button inline-flex cursor-pointer ${(isImporting || isTailoring) ? 'pointer-events-none opacity-60' : ''}`}><input className="sr-only" type="file" accept="application/pdf" onChange={handleImport} />{isImporting ? 'Importing with Docling…' : 'Upload PDF'}</label></div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Versions</p><h2 className="font-bold">Named cover letters</h2></div><div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { saveCoverLetterVersion(versionName); setVersionName(''); } }} placeholder="Name this cover-letter version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { saveCoverLetterVersion(versionName); setVersionName(''); }}>Save current</button></div>{coverLetterVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved cover letters yet.</p> : <div className="space-y-2">{coverLetterVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => { loadCoverLetterVersion(version.id); clearTailoredCandidate(); }}>Open</button><button type="button" className="resume-version-delete" onClick={() => deleteCoverLetterVersion(version.id)}>Delete</button></div></div>)}</div>}</div>
          <button type="button" className="resume-reset-button" onClick={() => { if (window.confirm('Clear the current cover letter? Saved versions remain available.')) { clearCoverLetter(); clearTailoredCandidate(); } }}>Clear current letter</button>
          {(isImporting || isTailoring) && <div className="career-activity" role="status" aria-live="polite"><div className="career-activity-title"><span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />{activityStage || 'Working'}</div><p className="mt-1">{activityDetail || 'The server is processing your request…'}</p></div>}
          {message && <p className="career-message" role="status">{message}</p>}
        </section>

        <section className="career-preview-shell" aria-label="Cover letter preview"><div className="career-preview-toolbar"><div><p className="career-kicker">Live preview</p><p className="mt-1 text-xs opacity-70">Click a letter paragraph to edit it directly.</p></div><div className="career-text-palette" role="toolbar" aria-label="Text formatting"><button type="button" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('bold')}><strong>B</strong></button><button type="button" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('italic')}><em>I</em></button><button type="button" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('underline')}><u>U</u></button><span className="career-palette-divider" aria-hidden="true" />{['#1d2920', '#386641', '#2563eb', '#dc2626', '#7c3aed'].map((color) => <button type="button" key={color} aria-label={`Use ${color} text color`} className="career-palette-color" style={{ '--palette-color': color } as CSSProperties} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('foreColor', color)} />)}<span className="career-palette-divider" aria-hidden="true" /><button type="button" aria-label="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyLeft')}>≡</button><button type="button" aria-label="Center text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyCenter')}>≡</button><button type="button" aria-label="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyRight')}>≡</button><span className="career-palette-divider" aria-hidden="true" /><button type="button" aria-label="Undo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('undo')}>↶</button><button type="button" aria-label="Redo" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('redo')}>↷</button></div></div><div ref={previewRef} className="career-preview-scale career-preview-pages"><CoverLetterPages coverLetter={coverLetter} coverLetterStyle={coverLetterStyle} revision={previewRevision} onBodyBlur={persistPreviewBody} /></div></section>
      </div>
    </main>
  );
}