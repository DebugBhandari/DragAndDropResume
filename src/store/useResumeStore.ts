// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ResumeData, Education, WorkExperience, Project, Language, Skill, Certificate, Award, Volunteer, Reference, Interest, PersonalInfo, ResumeSection, SectionType, LayoutType, StyleConfig, PhotoConfig, ColumnZone } from '@/types/resume';

const SECTION_TEMPLATES: ResumeSection[] = [
  { id: 'section-experience', type: 'experience', title: 'Work Experience', zone: 'main' },
  { id: 'section-education', type: 'education', title: 'Education', zone: 'main' },
  { id: 'section-projects', type: 'projects', title: 'Projects', zone: 'main' },
  { id: 'section-volunteer', type: 'volunteer', title: 'Volunteer', zone: 'main' },
  { id: 'section-skills', type: 'skills', title: 'Skills', zone: 'sidebar' },
  { id: 'section-languages', type: 'languages', title: 'Languages', zone: 'sidebar' },
  { id: 'section-certificates', type: 'certificates', title: 'Certificates', zone: 'sidebar' },
  { id: 'section-awards', type: 'awards', title: 'Awards', zone: 'sidebar' },
  { id: 'section-interests', type: 'interests', title: 'Interests', zone: 'sidebar' },
  { id: 'section-references', type: 'references', title: 'References', zone: 'main' },
];

const PINNED_SECTION_TYPES: SectionType[] = [
  'experience',
  'projects',
  'skills',
  'languages',
];

const CONDITIONAL_SECTION_TYPES: SectionType[] = SECTION_TEMPLATES.map((section) => section.type).filter(
  (type) => !PINNED_SECTION_TYPES.includes(type)
);

const defaultSections: ResumeSection[] = SECTION_TEMPLATES.filter((section) =>
  PINNED_SECTION_TYPES.includes(section.type)
);

const hasAnyText = (values: any[] = []) =>
  values.some((value) => String(value ?? '').trim().length > 0);

const hasAnyKeys = (value: any) =>
  !!value && typeof value === 'object' && Object.keys(value).length > 0;

const sectionHasData = (type: SectionType, state: any) => {
  switch (type) {
    case 'experience':
      return (state.experience || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.company, item.position, item.startDate, item.endDate, item.description])
      );
    case 'education':
      return (state.education || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.institution, item.degree, item.field, item.startDate, item.endDate, item.description])
      );
    case 'projects':
      return (state.projects || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name, item.description, item.technologies, item.link])
      );
    case 'skills':
      return (state.skills || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name])
      );
    case 'languages':
      return (state.languages || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name])
      );
    case 'certificates':
      return (state.certificates || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name, item.issuer, item.date, item.link])
      );
    case 'awards':
      return (state.awards || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.title, item.issuer, item.date, item.description])
      );
    case 'volunteer':
      return (state.volunteer || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.organization, item.role, item.startDate, item.endDate, item.description])
      );
    case 'references':
      return (state.references || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name, item.position, item.company, item.contact])
      );
    case 'interests':
      return (state.interests || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name])
      );
    default:
      return false;
  }
};

const defaultStyle: StyleConfig = { accentColor: '#2563eb', headingSize: 'md', sectionSpacing: 'normal', fontFamily: 'sans-serif', fontSize: 'md', headerAlignment: 'center', sidebarWidth: 30 };
const defaultPhoto: PhotoConfig = { url: '', x: 50, y: 50, size: 80, borderRadius: 50 };

interface ResumeStore extends ResumeData {
  setLayout: (layout: LayoutType) => void;
  setStyle: (style: Partial<StyleConfig>) => void;
  setPhoto: (photo: Partial<PhotoConfig>) => void;
  updatePersonalInfo: (info: Partial<PersonalInfo>) => void;
  addEducation: () => void;
  updateEducation: (id: string, data: Partial<Education>) => void;
  removeEducation: (id: string) => void;
  addExperience: () => void;
  updateExperience: (id: string, data: Partial<WorkExperience>) => void;
  removeExperience: (id: string) => void;
  addProject: () => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addLanguage: () => void;
  updateLanguage: (id: string, data: Partial<Language>) => void;
  removeLanguage: (id: string) => void;
  addSkill: () => void;
  updateSkill: (id: string, data: Partial<Skill>) => void;
  removeSkill: (id: string) => void;
  addCertificate: () => void;
  updateCertificate: (id: string, data: Partial<Certificate>) => void;
  removeCertificate: (id: string) => void;
  addAward: () => void;
  updateAward: (id: string, data: Partial<Award>) => void;
  removeAward: (id: string) => void;
  addVolunteer: () => void;
  updateVolunteer: (id: string, data: Partial<Volunteer>) => void;
  removeVolunteer: (id: string) => void;
  addReference: () => void;
  updateReference: (id: string, data: Partial<Reference>) => void;
  removeReference: (id: string) => void;
  addInterest: () => void;
  updateInterest: (id: string, data: Partial<Interest>) => void;
  removeInterest: (id: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  moveSectionToZone: (sectionId: string, zone: ColumnZone) => void;
  addSectionToResume: (type: SectionType) => void;
  removeSectionFromResume: (sectionId: string) => void;
  removedSections: SectionType[];
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set) => ({
      personalInfo: { fullName: '', email: '', phone: '', location: '', summary: '', linkedin: '', website: '' },
      education: [], experience: [], projects: [], languages: [], skills: [], certificates: [],
      awards: [], volunteer: [], references: [], interests: [],
      sectionOrder: defaultSections,
      removedSections: [],
      layout: 'classic',
      style: defaultStyle,
      photo: defaultPhoto,

      setLayout: (layout: LayoutType) => set({ layout }),
      setStyle: (s: Partial<StyleConfig>) => set((state) => ({ style: { ...state.style, ...s } })),
      setPhoto: (p: Partial<PhotoConfig>) => set((state) => ({ photo: { ...state.photo, ...p } })),
      updatePersonalInfo: (info: Partial<PersonalInfo>) => set((s) => ({ personalInfo: { ...s.personalInfo, ...info } })),

      addEducation: () => set((s) => ({ education: [...s.education, { id: uuidv4(), institution: '', degree: '', field: '', startDate: '', endDate: '', description: '' }] })),
      updateEducation: (id, data) => set((s) => ({ education: s.education.map((e) => (e.id === id ? { ...e, ...data } : e)) })),
      removeEducation: (id) => set((s) => ({ education: s.education.filter((e) => e.id !== id) })),

      addExperience: () => set((s) => ({ experience: [...s.experience, { id: uuidv4(), company: '', position: '', startDate: '', endDate: '', description: '' }] })),
      updateExperience: (id, data) => set((s) => ({ experience: s.experience.map((e) => (e.id === id ? { ...e, ...data } : e)) })),
      removeExperience: (id) => set((s) => ({ experience: s.experience.filter((e) => e.id !== id) })),

      addProject: () => set((s) => ({ projects: [...s.projects, { id: uuidv4(), name: '', description: '', technologies: '', link: '' }] })),
      updateProject: (id, data) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...data } : p)) })),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),

      addLanguage: () => set((s) => ({ languages: [...s.languages, { id: uuidv4(), name: '', proficiency: 'Intermediate' }] })),
      updateLanguage: (id, data) => set((s) => ({ languages: s.languages.map((l) => (l.id === id ? { ...l, ...data } : l)) })),
      removeLanguage: (id) => set((s) => ({ languages: s.languages.filter((l) => l.id !== id) })),

      addSkill: () => set((s) => ({ skills: [...s.skills, { id: uuidv4(), name: '', level: 'Intermediate' }] })),
      updateSkill: (id, data) => set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...data } : sk)) })),
      removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),

      addCertificate: () => set((s) => ({ certificates: [...s.certificates, { id: uuidv4(), name: '', issuer: '', date: '', link: '' }] })),
      updateCertificate: (id, data) => set((s) => ({ certificates: s.certificates.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
      removeCertificate: (id) => set((s) => ({ certificates: s.certificates.filter((c) => c.id !== id) })),

      addAward: () => set((s) => ({ awards: [...s.awards, { id: uuidv4(), title: '', issuer: '', date: '', description: '' }] })),
      updateAward: (id, data) => set((s) => ({ awards: s.awards.map((a) => (a.id === id ? { ...a, ...data } : a)) })),
      removeAward: (id) => set((s) => ({ awards: s.awards.filter((a) => a.id !== id) })),

      addVolunteer: () => set((s) => ({ volunteer: [...s.volunteer, { id: uuidv4(), organization: '', role: '', startDate: '', endDate: '', description: '' }] })),
      updateVolunteer: (id, data) => set((s) => ({ volunteer: s.volunteer.map((v) => (v.id === id ? { ...v, ...data } : v)) })),
      removeVolunteer: (id) => set((s) => ({ volunteer: s.volunteer.filter((v) => v.id !== id) })),

      addReference: () => set((s) => ({ references: [...s.references, { id: uuidv4(), name: '', position: '', company: '', contact: '' }] })),
      updateReference: (id, data) => set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, ...data } : r)) })),
      removeReference: (id) => set((s) => ({ references: s.references.filter((r) => r.id !== id) })),

      addInterest: () => set((s) => ({ interests: [...s.interests, { id: uuidv4(), name: '' }] })),
      updateInterest: (id, data) => set((s) => ({ interests: s.interests.map((i) => (i.id === id ? { ...i, ...data } : i)) })),
      removeInterest: (id) => set((s) => ({ interests: s.interests.filter((i) => i.id !== id) })),

      reorderSections: (sections) => set({ sectionOrder: sections }),
      moveSectionToZone: (sectionId, zone) => set((s) => ({ sectionOrder: s.sectionOrder.map((sec) => sec.id === sectionId ? { ...sec, zone } : sec) })),
      addSectionToResume: (type) => set((s) => {
        if (s.sectionOrder.find((sec) => sec.type === type)) return s;
        const template = SECTION_TEMPLATES.find((section) => section.type === type);
        const sectionToAdd = template || { id: `section-${type}`, type, title: type, zone: 'main' };
        return { sectionOrder: [...s.sectionOrder, sectionToAdd], removedSections: s.removedSections.filter((t) => t !== type) };
      }),
      removeSectionFromResume: (sectionId) => set((s) => {
        const section = s.sectionOrder.find((sec) => sec.id === sectionId);
        return { sectionOrder: s.sectionOrder.filter((sec) => sec.id !== sectionId), removedSections: section ? [...s.removedSections, section.type] : s.removedSections };
      }),
    }),
    { name: 'resume-storage',
      merge: (persisted: any, current: any) => {
        const merged = { ...current, ...persisted };

        const conditionalWithoutData = CONDITIONAL_SECTION_TYPES.filter(
          (type) => !sectionHasData(type, merged)
        );

        if (conditionalWithoutData.length) {
          merged.sectionOrder = (merged.sectionOrder || []).filter(
            (section: ResumeSection) => !conditionalWithoutData.includes(section.type)
          );
        }

        // Keep pinned sections active by default. Other sections are shown when they contain data.
        const autoVisibleSections = SECTION_TEMPLATES.filter((section) =>
          PINNED_SECTION_TYPES.includes(section.type) ||
          (CONDITIONAL_SECTION_TYPES.includes(section.type) && sectionHasData(section.type, merged))
        );

        const existingTypes = (merged.sectionOrder || []).map((s: any) => s.type);
        const removed = merged.removedSections || [];
        const missing = autoVisibleSections.filter((s) => !existingTypes.includes(s.type) && !removed.includes(s.type));
        if (missing.length) merged.sectionOrder = [...(merged.sectionOrder || []), ...missing];
        // Ensure new fields exist
        if (!merged.awards) merged.awards = [];
        if (!merged.volunteer) merged.volunteer = [];
        if (!merged.references) merged.references = [];
        if (!merged.interests) merged.interests = [];
        if (!merged.skills) merged.skills = [];
        if (!merged.style?.sidebarWidth) merged.style = { ...current.style, ...merged.style, sidebarWidth: merged.style?.sidebarWidth || 30 };
        if (!merged.personalInfo?.linkedin) merged.personalInfo = { ...current.personalInfo, ...merged.personalInfo };
        return merged;
      },
    }
  )
);
