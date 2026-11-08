'use client';

import Link from 'next/link';
import FeedbackWidget from '@/components/FeedbackWidget';
import { ChangeEvent, type CSSProperties, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCareerStore } from '@/store/useCareerStore';
import { useUIStore } from '@/store/useUIStore';
import type { CoverLetterData, CoverLetterFontFamily, CoverLetterFontSize, CoverLetterLayout, CoverLetterSpacing, CoverLetterStyle } from '@/types/career';
import { trackAnalyticsEvent } from '@/utils/analytics';

const layoutOptions: Array<{ value: CoverLetterLayout; label: string; detail: string }> = [
  { value: 'classic', label: 'Classic', detail: 'Traditional letterhead' },
  { value: 'modern', label: 'Modern', detail: 'Bold ruled header' },
  { value: 'compact', label: 'Compact', detail: 'Dense, space-saving' },
  { value: 'minimal', label: 'Minimal', detail: 'Letter body only' },
];
const accentColors = ['#386641', '#2563eb', '#7c3aed', '#dc2626', '#d97706', '#0891b2', '#1f2937'];
type PendingTailoredLetter = Pick<CoverLetterData, 'companyName' | 'roleTitle'> & { originalBody: string; tailoredBody: string };
type LetterBodyVersion = 'original' | 'tailored';
type CoverLetterSegment = { html: string; sourceIndex: number; sourceOffset: number; partIndex: number; continuation: boolean };

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

function bodyHtmlToParagraphs(value: string) {
  const paragraphMatches = [...value.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((match) => match[1].trim()).filter(Boolean);
  const fragments = paragraphMatches.length
    ? paragraphMatches
    : plainTextToBodyHtml(value).match(/<p>([\s\S]*?)<\/p>/g)?.map((paragraph) => paragraph.replace(/^<p>|<\/p>$/g, '')) ?? [];
  const textOnly = (markup: string) => bodyHtmlToPlainText(`<p>${markup}</p>`).replace(/\s+/g, ' ').trim();
  return fragments.reduce<string[]>((paragraphs, fragment) => {
    const current = fragment.replace(/\s+/g, ' ').trim();
    if (!current) return paragraphs;
    const previous = paragraphs.at(-1);
    if (!previous || /[.!?]["')\]]?$/.test(textOnly(previous))) {
      paragraphs.push(current);
      return paragraphs;
    }
    paragraphs[paragraphs.length - 1] = /-\s*$/.test(previous)
      ? `${previous.replace(/\s+$/, '')}${current}`
      : `${previous.replace(/\s+$/, '')} ${current}`;
    return paragraphs;
  }, []);
}

function sanitizeEditableMarkup(value: string) {
  const source = new DOMParser().parseFromString(value, 'text/html');
  const sanitizeNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '');
    if (!(node instanceof HTMLElement)) return '';
    if (node.dataset.previewCaret === 'true' || node.dataset.coverParagraphControl === 'true') return '';
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
  const groupedParagraphs = new Map<string, { alignment: string; content: string }>();
  Array.from(source.body.querySelectorAll<HTMLElement>('.cover-letter-page p[data-cover-paragraph]')).forEach((paragraph, index) => {
    const key = paragraph.dataset.coverSourceIndex ?? String(index);
    const current = groupedParagraphs.get(key);
    const content = Array.from(paragraph.childNodes).map(sanitizeNode).join('');
    if (current) current.content += content;
    else groupedParagraphs.set(key, { alignment: ['left', 'center', 'right', 'justify'].includes(paragraph.style.textAlign) ? ` style="text-align: ${paragraph.style.textAlign}"` : '', content });
  });
  return Array.from(groupedParagraphs.values()).map(({ alignment, content }) => `<p${alignment}>${content}</p>`).filter((paragraph) => bodyHtmlToPlainText(paragraph)).join('');
}

function splitMarkupAtTextOffset(markup: string, offset: number) {
  const container = document.createElement('div');
  container.innerHTML = markup;
  const text = container.textContent ?? '';
  const wordBoundary = Math.max(text.lastIndexOf(' ', offset), text.lastIndexOf('\n', offset));
  const splitOffset = wordBoundary > 0 ? wordBoundary + 1 : offset;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (consumed + length >= splitOffset) {
      const range = document.createRange();
      range.setStart(container, 0);
      range.setEnd(node, Math.max(0, splitOffset - consumed));
      const prefixContainer = document.createElement('div');
      prefixContainer.appendChild(range.extractContents());
      return [prefixContainer.innerHTML, container.innerHTML] as const;
    }
    consumed += length;
    node = walker.nextNode();
  }
  return [markup, ''] as const;
}

function markupTextLength(markup: string) {
  return bodyHtmlToPlainText(`<p>${markup}</p>`).length;
}

function CoverLetterPages({ coverLetter, coverLetterStyle, revision, onBodyBlur, onFieldBlur, onMoveParagraph, onDeleteParagraph }: { coverLetter: CoverLetterData; coverLetterStyle: CoverLetterStyle; revision: number; onBodyBlur: () => void; onFieldBlur: (key: keyof CoverLetterData, value: string) => void; onMoveParagraph: (sourceIndex: number, targetIndex: number) => void; onDeleteParagraph: (sourceIndex: number) => void }) {
  const measureRef = useRef<HTMLElement>(null);
  const paragraphs = bodyHtmlToParagraphs(coverLetter.body || 'Your cover letter body will appear here.');
  const [pages, setPages] = useState<CoverLetterSegment[][]>(() => [paragraphs.map((html, sourceIndex) => ({ html, sourceIndex, sourceOffset: 0, partIndex: 0, continuation: false }))]);
  const previewProps = { 'data-layout': coverLetterStyle.layout, 'data-font': coverLetterStyle.fontFamily, 'data-font-size': coverLetterStyle.fontSize, 'data-paragraph-spacing': coverLetterStyle.paragraphSpacing, 'data-header-spacing': coverLetterStyle.headerSpacing, style: { '--cover-accent': coverLetterStyle.accentColor } as CSSProperties };
  const editableField = (key: keyof CoverLetterData, value: string, placeholder: string, className?: string) => <span contentEditable suppressContentEditableWarning data-cover-field={key} data-empty={value ? undefined : 'true'} data-placeholder={placeholder} className={className} onBlur={(event) => onFieldBlur(key, event.currentTarget.textContent ?? '')}>{value}</span>;
  const contactPlaceholders: Record<'senderEmail' | 'senderPhone' | 'senderLocation', string> = { senderEmail: 'Email', senderPhone: 'Phone', senderLocation: 'Location' };
  const contactFields = (editable: boolean) => <p className="cover-letter-contact">{(['senderEmail', 'senderPhone', 'senderLocation'] as const).map((key, index) => <span key={key}>{index > 0 && <span className="cover-letter-contact-separator" aria-hidden="true"> · </span>}{editable ? editableField(key, coverLetter[key], contactPlaceholders[key], 'cover-letter-editable-field') : (coverLetter[key] || contactPlaceholders[key])}</span>)}</p>;

  useLayoutEffect(() => {
    const measure = () => {
      const sheet = measureRef.current;
      if (!sheet) return;
      const items = Array.from(sheet.querySelectorAll<HTMLElement>('[data-cover-paragraph]'));
      const body = sheet.querySelector<HTMLElement>('.cover-letter-body');
      if (!items.length || !body) return;
      const styles = window.getComputedStyle(sheet);
      const topPadding = Number.parseFloat(styles.paddingTop) || 0;
      const bottomPadding = Number.parseFloat(styles.paddingBottom) || 0;
      const pageHeight = sheet.offsetWidth * (297 / 210);
      const firstPageBottom = pageHeight - bottomPadding;
      const bodyStyles = window.getComputedStyle(body);
      const bodyTopMargin = Number.parseFloat(bodyStyles.marginTop) || 0;
      const firstCapacity = Math.max(0, firstPageBottom - items[0].offsetTop);
      const continuationCapacity = Math.max(0, pageHeight - topPadding - bottomPadding - bodyTopMargin);
      const measureMarkup = (markup: string) => {
        const probe = document.createElement('p');
        probe.dataset.coverParagraph = 'probe';
        probe.style.cssText = `position:absolute; visibility:hidden; pointer-events:none; left:0; width:${body.clientWidth}px; box-sizing:border-box;`;
        probe.innerHTML = markup;
        body.appendChild(probe);
        const probeStyles = window.getComputedStyle(probe);
        const height = probe.getBoundingClientRect().height + (Number.parseFloat(probeStyles.marginTop) || 0) + (Number.parseFloat(probeStyles.marginBottom) || 0);
        probe.remove();
        return height;
      };
      const fitMarkup = (markup: string, capacity: number) => {
        if (measureMarkup(markup) <= capacity) return [markup, ''] as const;
        const textLength = (new DOMParser().parseFromString(markup, 'text/html').body.textContent ?? '').length;
        let low = 1;
        let high = textLength;
        let best = 0;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          const [candidate] = splitMarkupAtTextOffset(markup, middle);
          if (candidate && measureMarkup(candidate) <= capacity) {
            best = middle;
            low = middle + 1;
          } else high = middle - 1;
        }
        return best > 0 ? splitMarkupAtTextOffset(markup, best) : ['', markup] as const;
      };
      const nextPages: CoverLetterSegment[][] = [[]];
      let remaining = firstCapacity;

      paragraphs.forEach((paragraph, sourceIndex) => {
        let remainder = paragraph;
        let partIndex = 0;
        let sourceOffset = 0;
        while (remainder.trim()) {
          const fullHeight = measureMarkup(remainder);
          if (fullHeight <= remaining) {
            nextPages.at(-1)?.push({ html: remainder, sourceIndex, sourceOffset, partIndex, continuation: partIndex > 0 });
            remaining -= fullHeight;
            break;
          }
          const pageHasContent = nextPages.at(-1)?.length;
          const freshPageCapacity = nextPages.length === 1 ? firstCapacity : continuationCapacity;
          if (pageHasContent && fullHeight <= freshPageCapacity) {
            nextPages.push([]);
            remaining = continuationCapacity;
            continue;
          }
          const [fittingMarkup, remainingMarkup] = fitMarkup(remainder, remaining);
          if (!fittingMarkup) {
            nextPages.push([]);
            remaining = continuationCapacity;
            continue;
          }
          nextPages.at(-1)?.push({ html: fittingMarkup, sourceIndex, sourceOffset, partIndex, continuation: partIndex > 0 });
          sourceOffset += markupTextLength(fittingMarkup);
          remainder = remainingMarkup;
          partIndex += 1;
          if (remainder) {
            nextPages.push([]);
            remaining = continuationCapacity;
          }
        }
      });
      setPages((current) => JSON.stringify(current) === JSON.stringify(nextPages) ? current : nextPages);
    };
    const frame = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    if (measureRef.current) observer.observe(measureRef.current);
    return () => { window.cancelAnimationFrame(frame); observer.disconnect(); };
  }, [coverLetter.body, coverLetter.senderName, coverLetter.senderEmail, coverLetter.senderPhone, coverLetter.senderLocation, coverLetterStyle, revision, paragraphs]);

  return <>
    <article ref={measureRef} aria-hidden="true" className="cover-letter-preview cover-letter-measure" {...previewProps}>{coverLetterStyle.layout !== 'minimal' && <header className="cover-letter-letterhead"><h2>{coverLetter.senderName || 'Your name'}</h2>{contactFields(false)}</header>}<div className="cover-letter-content"><div className="cover-letter-body">{paragraphs.map((paragraph, index) => <p data-cover-paragraph key={`${paragraph}-${index}`} dangerouslySetInnerHTML={{ __html: paragraph }} />)}</div></div></article>
    {pages.map((page, pageIndex) => <article key={`${revision}-${pageIndex}`} className="cover-letter-preview cover-letter-page" {...previewProps}>{pageIndex === 0 && coverLetterStyle.layout !== 'minimal' && <header className="cover-letter-letterhead"><h2>{editableField('senderName', coverLetter.senderName, 'Your name', 'cover-letter-editable-field')}</h2>{contactFields(true)}</header>}<div className={`cover-letter-content ${pageIndex > 0 ? 'cover-letter-continuation-content' : ''}`}><div className="cover-letter-body">{page.map((segment) => { const isParagraphStart = segment.partIndex === 0; return <p data-cover-paragraph data-cover-source-index={segment.sourceIndex} data-cover-paragraph-continuation={segment.continuation || undefined} key={`${pageIndex}-${segment.sourceIndex}-${segment.partIndex}`}>{isParagraphStart && <span contentEditable={false} data-cover-paragraph-control="true" className="cover-letter-paragraph-actions"><button type="button" data-cover-paragraph-control="true" aria-label="Move paragraph up" title="Move paragraph up" disabled={segment.sourceIndex === 0} onMouseDown={(event) => event.preventDefault()} onClick={() => onMoveParagraph(segment.sourceIndex, segment.sourceIndex - 1)}>↑</button><button type="button" data-cover-paragraph-control="true" aria-label="Move paragraph down" title="Move paragraph down" disabled={segment.sourceIndex === paragraphs.length - 1} onMouseDown={(event) => event.preventDefault()} onClick={() => onMoveParagraph(segment.sourceIndex, segment.sourceIndex + 1)}>↓</button><button type="button" data-cover-paragraph-control="true" className="cover-letter-paragraph-delete" aria-label="Delete paragraph" title="Delete paragraph" onMouseDown={(event) => event.preventDefault()} onClick={() => onDeleteParagraph(segment.sourceIndex)}>×</button></span>}<span contentEditable suppressContentEditableWarning onBlur={onBodyBlur} dangerouslySetInnerHTML={{ __html: segment.html }} /></p>; })}</div></div></article>)}
  </>;
}

export default function CoverLetterPage() {
  const previewRef = useRef<HTMLDivElement>(null);
  const previewShellRef = useRef<HTMLElement>(null);
  const { coverLetter, coverLetterStyle, coverLetterVersions, updateCoverLetter, updateCoverLetterStyle, replaceCoverLetter, clearCoverLetter, saveCoverLetterVersion, loadCoverLetterVersion, deleteCoverLetterVersion } = useCareerStore();
  const [versionName, setVersionName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isTailoring, setIsTailoring] = useState(false);
  const [message, setMessage] = useState('');
  const [activityStage, setActivityStage] = useState('');
  const [activityDetail, setActivityDetail] = useState('');
  const [previewRevision, setPreviewRevision] = useState(0);
  const [pendingTailoredLetter, setPendingTailoredLetter] = useState<PendingTailoredLetter | null>(null);
  const [activeLetterBodyVersion, setActiveLetterBodyVersion] = useState<LetterBodyVersion | null>(null);
  const { studioTheme, toggleStudioTheme } = useUIStore();

  const updateField = (key: keyof CoverLetterData, value: string) => updateCoverLetter({ [key]: value });
  const updateDisplayedLetterBody = useCallback((body: string) => {
    updateCoverLetter({ body });
    setPendingTailoredLetter((current) => {
      if (!current || !activeLetterBodyVersion) return current;
      return activeLetterBodyVersion === 'original' ? { ...current, originalBody: body } : { ...current, tailoredBody: body };
    });
  }, [activeLetterBodyVersion, updateCoverLetter]);
  const movePreviewParagraph = useCallback((sourceIndex: number, targetIndex: number) => {
    const paragraphs = bodyHtmlToParagraphs(coverLetter.body || 'Your cover letter body will appear here.');
    if (sourceIndex === targetIndex || sourceIndex < 0 || targetIndex < 0 || sourceIndex >= paragraphs.length || targetIndex >= paragraphs.length) return;
    const reordered = [...paragraphs];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    updateDisplayedLetterBody(reordered.map((paragraph) => `<p>${paragraph}</p>`).join(''));
    setPreviewRevision((revision) => revision + 1);
  }, [coverLetter.body, updateDisplayedLetterBody]);
  const deletePreviewParagraph = useCallback((sourceIndex: number) => {
    const paragraphs = bodyHtmlToParagraphs(coverLetter.body || '');
    if (sourceIndex < 0 || sourceIndex >= paragraphs.length) return;
    const remaining = paragraphs.filter((_, index) => index !== sourceIndex);
    const nextParagraphs = remaining.length ? remaining : [''];
    updateDisplayedLetterBody(nextParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join(''));
    setPreviewRevision((revision) => revision + 1);
  }, [coverLetter.body, updateDisplayedLetterBody]);
  const addPreviewParagraph = useCallback(() => {
    const paragraphs = bodyHtmlToParagraphs(coverLetter.body || '');
    const sourceIndex = paragraphs.length;
    updateDisplayedLetterBody([...paragraphs, 'New paragraph'].map((paragraph) => `<p>${paragraph}</p>`).join(''));
    setPreviewRevision((revision) => revision + 1);
    window.requestAnimationFrame(() => {
      const paragraph = previewRef.current?.querySelector<HTMLElement>(`[data-cover-source-index="${sourceIndex}"] > span[contenteditable="true"]`);
      paragraph?.focus();
      const selection = window.getSelection();
      if (!paragraph || !selection) return;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    });
  }, [coverLetter.body, updateDisplayedLetterBody]);
  const clearTailoredCandidate = () => { setPendingTailoredLetter(null); setActiveLetterBodyVersion(null); };
  const persistPreviewBody = useCallback(() => {
    const preview = previewRef.current;
    if (!preview) return;
    const body = sanitizeEditableMarkup(preview.innerHTML);
    if (body && body !== coverLetter.body) {
      updateDisplayedLetterBody(body);
      setPreviewRevision((revision) => revision + 1);
    }
  }, [coverLetter.body, updateDisplayedLetterBody]);
  const persistPreviewField = useCallback((key: keyof CoverLetterData, value: string) => {
    const normalizedValue = value.replace(/\s+/g, ' ').trim();
    if (normalizedValue !== coverLetter[key]) {
      updateCoverLetter({ [key]: normalizedValue });
      setPreviewRevision((revision) => revision + 1);
    }
  }, [coverLetter, updateCoverLetter]);
  const applyTextCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    window.setTimeout(persistPreviewBody, 0);
  };
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
      .cover-letter-measure { display: none !important; }
      .career-preview-pages { display: block !important; min-width: 0 !important; gap: 0 !important; padding: 0 !important; }
      .cover-letter-page { height: 297mm !important; min-height: 297mm !important; overflow: hidden !important; break-after: page; page-break-after: always; }
      .cover-letter-page:last-child { break-after: auto; page-break-after: auto; }
      .cover-letter-preview, .cover-letter-preview * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .cover-letter-letterhead { padding-bottom: 8mm; border-bottom: 3px solid var(--cover-accent, #386641); }
      .cover-letter-letterhead h2 { margin: 0; color: var(--cover-accent, #386641); font-size: 25px; font-weight: 800; letter-spacing: -.03em; }
      .cover-letter-letterhead p { margin: 3px 0 0; color: #57695a; font-size: 11px; }
      .cover-letter-preview[data-header-spacing="tight"] { --cover-header-space: 4mm; }
      .cover-letter-preview[data-header-spacing="normal"] { --cover-header-space: 9mm; }
      .cover-letter-preview[data-header-spacing="relaxed"] { --cover-header-space: 14mm; }
      .cover-letter-content { padding-top: var(--cover-header-space, 9mm); }
      .cover-letter-content > p { margin: 0 0 2px; white-space: pre-wrap; }
      .cover-letter-body { margin-top: 0; }
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
      .cover-letter-preview[data-layout="minimal"] .cover-letter-content { padding-top: 0; }
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
          setPendingTailoredLetter({
            originalBody,
            tailoredBody: plainTextToBodyHtml(event.body),
            roleTitle: typeof event.roleTitle === 'string' ? event.roleTitle : '',
            companyName: typeof event.companyName === 'string' ? event.companyName : '',
          });
          setActiveLetterBodyVersion('original');
          tailored = true;
        }
        if (event.type === 'error') streamError = String(event.message ?? 'Unable to tailor this letter.');
      });
      if (streamError) throw new Error(streamError);
      if (!tailored) throw new Error('The server AI did not return a complete tailored letter.');
      setMessage('Tailored letter is ready. Choose Original or Tailored to show that complete version in the preview.');
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
    setPreviewRevision((revision) => revision + 1);
    setMessage('');
    if (version === 'tailored') trackAnalyticsEvent('cover_letter_tailored');
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

      <div className="career-workspace mx-auto grid max-w-[1650px] gap-5 p-4 lg:grid-cols-[minmax(360px,0.72fr)_minmax(0,1.28fr)] lg:p-6">
        <section className="career-panel space-y-5" aria-label="Cover letter settings">
          <div><p className="career-kicker">Editor</p><h1 className="text-2xl font-bold">Build your cover letter</h1><p className="mt-1 text-sm opacity-75">Everything is saved only in this browser.</p></div>
          <details className="career-style-card career-disclosure" open>
            <summary className="career-disclosure-summary"><span><p className="career-kicker">Layout & style</p><h2 className="font-bold">Match your résumé presentation</h2></span><span className="career-disclosure-icon" aria-hidden="true" /></summary>
            <div className="career-disclosure-content space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {layoutOptions.map((layout) => <button type="button" key={layout.value} onClick={() => updateCoverLetterStyle({ layout: layout.value })} className={`career-layout-option ${coverLetterStyle.layout === layout.value ? 'career-layout-option-active' : ''}`}><span className={`career-layout-thumbnail career-layout-thumbnail-${layout.value}`} style={{ '--cover-accent': coverLetterStyle.accentColor } as CSSProperties}><i /><b /></span><span className="mt-1 block text-xs font-bold">{layout.label}</span><span className="block text-[11px] opacity-70">{layout.detail}</span></button>)}
              </div>
              <div><span className="career-field-label">Accent color</span><div className="flex flex-wrap gap-2">{accentColors.map((color) => <button type="button" aria-label={`Use ${color} as accent color`} key={color} onClick={() => updateCoverLetterStyle({ accentColor: color })} className={`career-color-swatch ${coverLetterStyle.accentColor === color ? 'career-color-swatch-active' : ''}`} style={{ backgroundColor: color }} />)}<input type="color" aria-label="Custom accent color" value={coverLetterStyle.accentColor} onChange={(event) => updateCoverLetterStyle({ accentColor: event.target.value })} className="h-7 w-8 cursor-pointer rounded border-0 bg-transparent p-0" /></div></div>
              <div className="grid gap-3 sm:grid-cols-2"><div><span className="career-field-label">Font family</span><div className="flex flex-wrap gap-1.5">{(['serif', 'sans-serif', 'mono'] as CoverLetterFontFamily[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontFamily: value })} className={`style-chip ${coverLetterStyle.fontFamily === value ? 'style-chip-active' : ''}`}>{value === 'sans-serif' ? 'Sans' : value === 'mono' ? 'Mono' : 'Serif'}</button>)}</div></div><div><span className="career-field-label">Font size</span><div className="flex flex-wrap gap-1.5">{(['sm', 'md', 'lg'] as CoverLetterFontSize[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ fontSize: value })} className={`style-chip ${coverLetterStyle.fontSize === value ? 'style-chip-active' : ''}`}>{value.toUpperCase()}</button>)}</div></div><div><span className="career-field-label">Paragraph spacing</span><div className="flex flex-wrap gap-1.5">{(['tight', 'normal', 'relaxed'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ paragraphSpacing: value })} className={`style-chip capitalize ${coverLetterStyle.paragraphSpacing === value ? 'style-chip-active' : ''}`}>{value}</button>)}</div></div><div><span className="career-field-label">Header-to-body spacing</span><div className="flex flex-wrap gap-1.5">{(['tight', 'normal', 'relaxed'] as CoverLetterSpacing[]).map((value) => <button type="button" key={value} onClick={() => updateCoverLetterStyle({ headerSpacing: value })} className={`style-chip capitalize ${coverLetterStyle.headerSpacing === value ? 'style-chip-active' : ''}`}>{value}</button>)}</div></div></div>
            </div>
          </details>
          <details className="career-details-card career-disclosure" open>
            <summary className="career-disclosure-summary"><span><p className="career-kicker">Letter details</p><h2 className="font-bold">Contact information and letter text</h2></span><span className="career-disclosure-icon" aria-hidden="true" /></summary>
            <div className="career-disclosure-content space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label><span className="career-field-label">Your name</span><input className="input-field" value={coverLetter.senderName} onChange={(event) => updateField('senderName', event.target.value)} placeholder="Your name" autoComplete="name" /></label>
                <label><span className="career-field-label">Email</span><input className="input-field" type="email" value={coverLetter.senderEmail} onChange={(event) => updateField('senderEmail', event.target.value)} placeholder="you@example.com" autoComplete="email" /></label>
                <label><span className="career-field-label">Phone</span><input className="input-field" type="tel" value={coverLetter.senderPhone} onChange={(event) => updateField('senderPhone', event.target.value)} placeholder="(555) 555-5555" autoComplete="tel" /></label>
                <label><span className="career-field-label">Location</span><input className="input-field" value={coverLetter.senderLocation} onChange={(event) => updateField('senderLocation', event.target.value)} placeholder="City, State" autoComplete="address-level2" /></label>
              </div>
              <label><span className="career-field-label">Letter body</span><textarea className="input-field min-h-64 resize-y" value={bodyHtmlToPlainText(coverLetter.body)} onChange={(event) => { updateDisplayedLetterBody(plainTextToBodyHtml(event.target.value)); setPreviewRevision((revision) => revision + 1); }} placeholder="Write the main body of your cover letter." /></label>
              <p className="text-xs opacity-70">Use blank lines to start a new paragraph. You can also format and reorder paragraphs directly in the preview.</p>
            </div>
          </details>
          <div className="career-divider" />
          <div className="space-y-2"><div><p className="career-kicker">Tailor to a role</p><h2 className="font-bold">Paste the job description</h2></div><textarea className="input-field min-h-44 resize-y" value={coverLetter.jobDescription} onChange={(event) => updateField('jobDescription', event.target.value)} placeholder="Paste the job description. The server AI will tailor the complete letter and detect the role and company." /><button type="button" className="career-primary-button" onClick={tailorCoverLetter} disabled={isTailoring || isImporting}>{isTailoring ? 'Tailoring…' : 'Tailor letter'}</button>{isTailoring && <div className="career-activity" role="status" aria-live="polite"><div className="career-activity-title"><span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />{activityStage || 'Working'}</div><p className="mt-1">{activityDetail || 'The server is processing your request…'}</p></div>}{pendingTailoredLetter ? <div className="career-tailored-choice"><p className="career-kicker">Two letter versions ready</p><p className="mt-1 text-sm opacity-75">Use the Original and Tailored toggle above the preview to switch the complete letter. Switching never appends text.</p><p className="mt-1 text-sm opacity-75">Detected: {pendingTailoredLetter.roleTitle || 'Role not found'}{pendingTailoredLetter.companyName ? ` · ${pendingTailoredLetter.companyName}` : ''}</p></div> : <p className="text-sm opacity-75">Tailor the current preview letter to create an Original and a Tailored version you can switch between.</p>}</div>
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Import</p><h2 className="font-bold">Import an existing cover letter</h2><p className="mt-1 text-sm opacity-75">PDF extraction uses Docling only; it does not use AI.</p></div><label className={`career-secondary-button inline-flex cursor-pointer ${(isImporting || isTailoring) ? 'pointer-events-none opacity-60' : ''}`}><input className="sr-only" type="file" accept="application/pdf" onChange={handleImport} />{isImporting ? 'Importing with Docling…' : 'Upload PDF'}</label></div>
          <div className="career-divider" />
          <button type="button" className="resume-reset-button" onClick={() => { if (window.confirm('Clear the current cover letter? Saved versions remain available.')) { clearCoverLetter(); clearTailoredCandidate(); } }}>Clear current letter</button>
          {isImporting && <div className="career-activity" role="status" aria-live="polite"><div className="career-activity-title"><span className="resume-import-status-dot inline-block h-2 w-2 animate-pulse rounded-full" aria-hidden="true" />{activityStage || 'Working'}</div><p className="mt-1">{activityDetail || 'The server is processing your request…'}</p></div>}
          {message && <p className="career-message" role="status">{message}</p>}
          <div className="career-divider" />
          <div className="space-y-3"><div><p className="career-kicker">Versions</p><h2 className="font-bold">Named cover letters</h2></div><div className="resume-version-save-grid"><input className="input-field" value={versionName} onChange={(event) => setVersionName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && versionName.trim()) { saveCoverLetterVersion(versionName); setVersionName(''); } }} placeholder="Name this cover-letter version" /><button type="button" className="resume-version-load" disabled={!versionName.trim()} onClick={() => { saveCoverLetterVersion(versionName); setVersionName(''); }}>Save current</button></div>{coverLetterVersions.length === 0 ? <p className="resume-version-empty text-sm">No saved cover letters yet.</p> : <div className="space-y-2">{coverLetterVersions.map((version) => <div className="resume-version-item" key={version.id}><div className="min-w-0"><p className="truncate text-sm font-semibold">{version.name}</p><p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p></div><div className="flex shrink-0 gap-2"><button type="button" className="resume-version-load" onClick={() => { loadCoverLetterVersion(version.id); clearTailoredCandidate(); }}>Open</button><button type="button" className="resume-version-delete" onClick={() => deleteCoverLetterVersion(version.id)}>Delete</button></div></div>)}</div>}</div>

        </section>

        <section ref={previewShellRef} className="career-preview-shell" aria-label="Cover letter preview"><div className="career-preview-toolbar"><div><p className="career-kicker">Live preview</p><p className="mt-1 text-xs opacity-70">Edit text directly, reorder paragraphs, or add a new one.</p></div><div className="flex items-center gap-2">{pendingTailoredLetter && <div className="career-preview-version-toggle" role="group" aria-label="Choose the letter shown in the preview"><button type="button" className={activeLetterBodyVersion === 'original' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('original')}>Original</button><button type="button" className={activeLetterBodyVersion === 'tailored' ? 'career-preview-version-toggle-active' : ''} onClick={() => showLetterBodyVersion('tailored')}>Tailored</button></div>}<button type="button" className="career-preview-add-paragraph" onClick={addPreviewParagraph}>+ Paragraph</button><button type="button" className="career-preview-copy-letter" onClick={copyPreviewLetter}>Copy letter</button></div><div className="career-text-palette" role="toolbar" aria-label="Text formatting"><button type="button" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('bold')}><strong>B</strong></button><button type="button" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('italic')}><em>I</em></button><button type="button" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('underline')}><u>U</u></button><span className="career-palette-divider" aria-hidden="true" />{['#1d2920', '#386641', '#2563eb', '#dc2626', '#7c3aed'].map((color) => <button type="button" key={color} aria-label={`Use ${color} text color`} className="career-palette-color" style={{ '--palette-color': color } as CSSProperties} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('foreColor', color)} />)}<span className="career-palette-divider" aria-hidden="true" /><button type="button" aria-label="Align left" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyLeft')}>≡</button><button type="button" aria-label="Center text" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyCenter')}>≡</button><button type="button" aria-label="Align right" onMouseDown={(event) => event.preventDefault()} onClick={() => applyTextCommand('justifyRight')}>≡</button></div></div><div className="career-preview-scale"><div ref={previewRef} className="career-preview-pages"><CoverLetterPages coverLetter={coverLetter} coverLetterStyle={coverLetterStyle} revision={previewRevision} onBodyBlur={persistPreviewBody} onFieldBlur={persistPreviewField} onMoveParagraph={movePreviewParagraph} onDeleteParagraph={deletePreviewParagraph} /></div></div></section>
      </div>
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