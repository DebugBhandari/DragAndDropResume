'use client';

import CollapsiblePanel from '@/components/CollapsiblePanel';
import HeaderImageContent from '@/components/HeaderImageContent';
import SectionEditor from '@/components/SectionEditor';
import { PersonalInfoContent } from '@/components/ResumeSettingsControls';
import { useResumeStore } from '@/store/useResumeStore';
import type { SectionType } from '@/types/resume';
import { getSectionLabel } from '@/utils/sectionTranslations';

const ALL_SECTION_TYPES: SectionType[] = [
  'experience',
  'education',
  'projects',
  'skills',
  'languages',
  'certificates',
  'awards',
  'volunteer',
  'references',
  'interests',
];

export default function ResumeEditorSidebar() {
  const { activeLocale, sectionOrder, addSectionToResume } = useResumeStore();
  const availableSections = ALL_SECTION_TYPES.filter((type) => !sectionOrder.some((section) => section.type === type));

  return (
    <aside className="resume-input-sidebar studio-editor print:hidden" aria-label="Résumé input editor">
      <div className="resume-input-sidebar-heading">
        <p className="career-kicker">Résumé editor</p>
        <p className="mt-1 text-xs opacity-70">Use these full fields or edit directly in the preview.</p>
      </div>
      <div className="resume-input-sidebar-panels">
        <CollapsiblePanel title="Personal details" persistId="panel-header">
          <PersonalInfoContent />
        </CollapsiblePanel>
        <CollapsiblePanel title="Header image" defaultOpen={false} persistId="panel-header-image">
          <HeaderImageContent />
        </CollapsiblePanel>
        {sectionOrder.map((section) => (
          <CollapsiblePanel key={section.id} title={section.title || getSectionLabel(activeLocale, section.type)} defaultOpen={false} persistId={`sec-${section.id}`}>
            <SectionEditor type={section.type} />
          </CollapsiblePanel>
        ))}
        {availableSections.length > 0 && (
          <CollapsiblePanel title="Add section" defaultOpen={false}>
            <div className="flex flex-wrap gap-2">
              {availableSections.map((type) => (
                <button key={type} type="button" className="style-chip" onClick={() => addSectionToResume(type)}>
                  + {getSectionLabel(activeLocale, type)}
                </button>
              ))}
            </div>
          </CollapsiblePanel>
        )}
      </div>
    </aside>
  );
}