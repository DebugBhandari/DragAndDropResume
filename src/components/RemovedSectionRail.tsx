'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import SectionEditor from '@/components/SectionEditor';
import { useResumeStore } from '@/store/useResumeStore';
import type { SectionType } from '@/types/resume';
import { getSectionLabel } from '@/utils/sectionTranslations';

function RemovedSectionPill({ type, onRestore }: { type: SectionType; onRestore: (type: SectionType) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const { activeLocale } = useResumeStore();
  const label = getSectionLabel(activeLocale, type);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `removed-${type}`,
    data: { origin: 'removed-section', sectionType: type },
  });

  return (
    <div className="removed-section-pill-wrap" onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
      <button
        ref={setNodeRef}
        type="button"
        className="removed-section-pill"
        style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.45 : 1 }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onFocus={() => setIsOpen(true)}
        onClick={() => setIsOpen((open) => !open)}
        {...attributes}
        {...listeners}
      >
        <span aria-hidden="true">↶</span><span>{label}</span>
      </button>
      {isOpen && (
        <div className="removed-section-dialog" role="dialog" aria-label={`Edit removed ${label} section`} onPointerDown={(event) => event.stopPropagation()}>
          <div className="removed-section-dialog-header">
            <div><p className="career-kicker">Removed section</p><p className="mt-1 text-sm font-bold">{label}</p></div>
            <button type="button" className="resume-version-load" onClick={() => onRestore(type)}>Restore</button>
          </div>
          <p className="text-xs opacity-70">Edit the retained content here, then restore it or drag this pill into the résumé.</p>
          <div className="removed-section-dialog-editor"><SectionEditor type={type} /></div>
        </div>
      )}
    </div>
  );
}

export default function RemovedSectionRail({ onRestore }: { onRestore: (type: SectionType) => void }) {
  const { removedSections } = useResumeStore();
  const uniqueSections = [...new Set(removedSections)];
  if (!uniqueSections.length) return null;

  return (
    <aside className="removed-section-rail print:hidden" aria-label="Removed résumé sections">
      <p className="removed-section-rail-label">Removed</p>
      <div className="removed-section-pill-list">
        {uniqueSections.map((type) => <RemovedSectionPill key={type} type={type} onRestore={onRestore} />)}
      </div>
    </aside>
  );
}