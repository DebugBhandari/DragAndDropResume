// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ResumeData, Education, WorkExperience, Project, Language, Skill, Certificate, Award, Volunteer, Reference, Interest, PersonalInfo, ResumeSection, SectionType, LayoutType, StyleConfig, PhotoConfig, ColumnZone } from '@/types/resume';
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from '@/utils/dateSort';

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

const moveItemById = <T extends { id: string }>(items: T[], activeId: string, overId: string): T[] => {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const overIndex = items.findIndex((item) => item.id === overId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return items;

  const next = [...items];
  const [moved] = next.splice(activeIndex, 1);
  next.splice(overIndex, 0, moved);
  return next;
};

const normalizeExperience = (item: any) => {
  const rawBullets = Array.isArray(item?.descriptionBullets)
    ? item.descriptionBullets
    : typeof item?.description === 'string' && item.description.trim().length > 0
      ? [item.description]
      : [''];

  const bullets = rawBullets.map((bullet: any) => String(bullet ?? ''));

  return {
    ...item,
    descriptionBullets: bullets.length > 0 ? bullets : [''],
  };
};

const normalizeProject = (item: any) => {
  const rawBullets = Array.isArray(item?.descriptionBullets)
    ? item.descriptionBullets
    : typeof item?.description === 'string' && item.description.trim().length > 0
      ? [item.description]
      : [''];

  const bullets = rawBullets.map((bullet: any) => String(bullet ?? ''));

  return {
    ...item,
    descriptionBullets: bullets.length > 0 ? bullets : [''],
    completionDate: String(item?.completionDate ?? ''),
  };
};

const sectionHasData = (type: SectionType, state: any) => {
  switch (type) {
    case 'experience':
      return (state.experience || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.company, item.position, item.startDate, item.endDate, item.description, ...(item.descriptionBullets || [])])
      );
    case 'education':
      return (state.education || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.institution, item.degree, item.field, item.startDate, item.endDate, item.description])
      );
    case 'projects':
      return (state.projects || []).some((item: any) =>
        hasAnyKeys(item) && hasAnyText([item.name, item.description, ...(item.descriptionBullets || []), item.completionDate, item.technologies, item.link])
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
const defaultPhoto: PhotoConfig = {
  url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg',
  x: 88,
  y: 50,
  size: 82,
  borderRadius: 50,
};
const seededPersonalInfo: PersonalInfo = {
  fullName: 'Your Name',
  email: 'you@example.com',
  phone: '+1 (555) 123-4567',
  location: 'City, Country',
  summary: 'Product-minded engineer focused on building reliable web apps with strong UX and measurable outcomes.',
  linkedin: 'https://linkedin.com/in/your-profile',
  website: 'https://your-portfolio.dev',
};

const seededExperience: WorkExperience[] = [
  {
    id: 'seed-exp-1',
    company: 'Acme Labs',
    position: 'Senior Software Engineer',
    startDate: 'Jan 2023',
    endDate: 'Present',
    description: 'Built and shipped resume builder features with measurable UX improvements.',
    descriptionBullets: [
      'Built drag-and-drop section management with persistent layout state.',
      'Improved print/export fidelity and reduced formatting issues across browsers.',
    ],
  },
  {
    id: 'seed-exp-2',
    company: 'Northwind Commerce',
    position: 'Frontend Engineer',
    startDate: 'Apr 2021',
    endDate: 'Dec 2022',
    description: 'Delivered customer-facing features for checkout and account lifecycle flows.',
    descriptionBullets: [
      'Improved checkout completion by 11% through form and validation UX redesign.',
      'Built reusable UI primitives that reduced feature delivery time across squads.',
    ],
  },
  {
    id: 'seed-exp-3',
    company: 'Atlas Health',
    position: 'Software Developer',
    startDate: 'Jun 2019',
    endDate: 'Mar 2021',
    description: 'Contributed to clinician tooling and analytics dashboards for care teams.',
    descriptionBullets: [
      'Implemented secure report generation pipelines for patient activity summaries.',
      'Added telemetry-backed performance fixes that cut dashboard load time by 35%.',
    ],
  },
  {
    id: 'seed-exp-4',
    company: 'Pixel Foundry',
    position: 'Junior Web Developer',
    startDate: 'Jan 2018',
    endDate: 'May 2019',
    description: 'Built responsive marketing websites and CMS-driven landing pages.',
    descriptionBullets: [
      'Delivered 20+ campaign pages with cross-device QA and accessibility fixes.',
      'Collaborated with design to establish a lightweight component style guide.',
    ],
  },
];

const seededProjects: Project[] = [
  {
    id: 'seed-proj-1',
    name: 'Resume Builder',
    description: 'Interactive resume builder with live preview and export support.',
    descriptionBullets: [
      'Implemented section-level customization and style controls.',
      'Added robust deployment pipeline to VPS with domain routing.',
    ],
    completionDate: 'May 2026',
    technologies: 'Next.js, TypeScript, Zustand',
    link: 'https://resume.debugbhandari.link',
  },
  {
    id: 'seed-proj-2',
    name: 'Hiring Pipeline Dashboard',
    description: 'Internal dashboard for applicant tracking and interview performance metrics.',
    descriptionBullets: [
      'Designed role-based views for recruiters, interviewers, and hiring managers.',
      'Automated weekly pipeline summaries with CSV export and trend visualizations.',
    ],
    completionDate: 'Jan 2025',
    technologies: 'React, Node.js, PostgreSQL',
    link: 'https://github.com/DebugBhandari/hiring-pipeline-dashboard',
  },
  {
    id: 'seed-proj-3',
    name: 'Realtime Incident Board',
    description: 'Live incident timeline and alert routing tool for engineering teams.',
    descriptionBullets: [
      'Implemented websocket updates for near realtime status synchronization.',
      'Added incident ownership and SLA reminders to improve on-call response.',
    ],
    completionDate: 'Aug 2024',
    technologies: 'Next.js, Redis, Socket.IO',
    link: 'https://github.com/DebugBhandari/realtime-incident-board',
  },
  {
    id: 'seed-proj-4',
    name: 'Portfolio CMS Starter',
    description: 'Starter template for portfolio websites with markdown and image optimization.',
    descriptionBullets: [
      'Built authoring flow with markdown parsing and semantic SEO defaults.',
      'Created deployment-ready CI workflow with preview and production channels.',
    ],
    completionDate: 'Nov 2023',
    technologies: 'Next.js, MDX, Tailwind CSS',
    link: 'https://github.com/DebugBhandari/portfolio-cms-starter',
  },
];

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
  reorderExperience: (activeId: string, overId: string) => void;
  addProject: () => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  removeProject: (id: string) => void;
  reorderProjects: (activeId: string, overId: string) => void;
  addLanguage: () => void;
  updateLanguage: (id: string, data: Partial<Language>) => void;
  removeLanguage: (id: string) => void;
  reorderLanguages: (activeId: string, overId: string) => void;
  addSkill: () => void;
  updateSkill: (id: string, data: Partial<Skill>) => void;
  removeSkill: (id: string) => void;
  reorderSkills: (activeId: string, overId: string) => void;
  addCertificate: () => void;
  updateCertificate: (id: string, data: Partial<Certificate>) => void;
  removeCertificate: (id: string) => void;
  reorderCertificates: (activeId: string, overId: string) => void;
  addAward: () => void;
  updateAward: (id: string, data: Partial<Award>) => void;
  removeAward: (id: string) => void;
  addVolunteer: () => void;
  updateVolunteer: (id: string, data: Partial<Volunteer>) => void;
  removeVolunteer: (id: string) => void;
  addReference: () => void;
  updateReference: (id: string, data: Partial<Reference>) => void;
  removeReference: (id: string) => void;
  reorderReferences: (activeId: string, overId: string) => void;
  addInterest: () => void;
  updateInterest: (id: string, data: Partial<Interest>) => void;
  removeInterest: (id: string) => void;
  reorderSections: (sections: ResumeSection[]) => void;
  moveSectionToZone: (sectionId: string, zone: ColumnZone) => void;
  addSectionToResume: (type: SectionType) => void;
  removeSectionFromResume: (sectionId: string) => void;
  removedSections: SectionType[];
  experienceManualOrder: boolean;
  projectsManualOrder: boolean;
}

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set) => ({
      personalInfo: seededPersonalInfo,
      education: [], experience: seededExperience, projects: seededProjects, languages: [], skills: [], certificates: [],
      awards: [], volunteer: [], references: [], interests: [],
      sectionOrder: defaultSections,
      removedSections: [],
      experienceManualOrder: false,
      projectsManualOrder: false,
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

      addExperience: () => set((s) => {
        const nextExperience = [...s.experience, { id: uuidv4(), company: '', position: '', startDate: '', endDate: '', description: '', descriptionBullets: [''] }];
        return { experience: s.experienceManualOrder ? nextExperience : sortWorkExperienceByDateDesc(nextExperience) };
      }),
      updateExperience: (id, data) => set((s) => {
        const nextExperience = s.experience.map((e) => (e.id === id ? { ...e, ...data } : e));
        return { experience: s.experienceManualOrder ? nextExperience : sortWorkExperienceByDateDesc(nextExperience) };
      }),
      removeExperience: (id) => set((s) => ({ experience: s.experience.filter((e) => e.id !== id) })),
      reorderExperience: (activeId, overId) => set((s) => ({
        experience: moveItemById(s.experience, activeId, overId),
        experienceManualOrder: true,
      })),

      addProject: () => set((s) => {
        const nextProjects = [...s.projects, { id: uuidv4(), name: '', description: '', descriptionBullets: [''], completionDate: '', technologies: '', link: '' }];
        return { projects: s.projectsManualOrder ? nextProjects : sortProjectsByDateDesc(nextProjects) };
      }),
      updateProject: (id, data) => set((s) => {
        const nextProjects = s.projects.map((p) => (p.id === id ? { ...p, ...data } : p));
        return { projects: s.projectsManualOrder ? nextProjects : sortProjectsByDateDesc(nextProjects) };
      }),
      removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
      reorderProjects: (activeId, overId) => set((s) => ({
        projects: moveItemById(s.projects, activeId, overId),
        projectsManualOrder: true,
      })),

      addLanguage: () => set((s) => ({ languages: [...s.languages, { id: uuidv4(), name: '', proficiency: 'Intermediate' }] })),
      updateLanguage: (id, data) => set((s) => ({ languages: s.languages.map((l) => (l.id === id ? { ...l, ...data } : l)) })),
      removeLanguage: (id) => set((s) => ({ languages: s.languages.filter((l) => l.id !== id) })),
      reorderLanguages: (activeId, overId) => set((s) => ({
        languages: moveItemById(s.languages, activeId, overId),
      })),

      addSkill: () => set((s) => ({ skills: [...s.skills, { id: uuidv4(), name: '', level: 'Intermediate' }] })),
      updateSkill: (id, data) => set((s) => ({ skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...data } : sk)) })),
      removeSkill: (id) => set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) })),
      reorderSkills: (activeId, overId) => set((s) => ({
        skills: moveItemById(s.skills, activeId, overId),
      })),

      addCertificate: () => set((s) => ({ certificates: [...s.certificates, { id: uuidv4(), name: '', issuer: '', date: '', link: '' }] })),
      updateCertificate: (id, data) => set((s) => ({ certificates: s.certificates.map((c) => (c.id === id ? { ...c, ...data } : c)) })),
      removeCertificate: (id) => set((s) => ({ certificates: s.certificates.filter((c) => c.id !== id) })),
      reorderCertificates: (activeId, overId) => set((s) => ({
        certificates: moveItemById(s.certificates, activeId, overId),
      })),

      addAward: () => set((s) => ({ awards: [...s.awards, { id: uuidv4(), title: '', issuer: '', date: '', description: '' }] })),
      updateAward: (id, data) => set((s) => ({ awards: s.awards.map((a) => (a.id === id ? { ...a, ...data } : a)) })),
      removeAward: (id) => set((s) => ({ awards: s.awards.filter((a) => a.id !== id) })),

      addVolunteer: () => set((s) => ({ volunteer: [...s.volunteer, { id: uuidv4(), organization: '', role: '', startDate: '', endDate: '', description: '' }] })),
      updateVolunteer: (id, data) => set((s) => ({ volunteer: s.volunteer.map((v) => (v.id === id ? { ...v, ...data } : v)) })),
      removeVolunteer: (id) => set((s) => ({ volunteer: s.volunteer.filter((v) => v.id !== id) })),

      addReference: () => set((s) => ({ references: [...s.references, { id: uuidv4(), name: '', position: '', company: '', contact: '' }] })),
      updateReference: (id, data) => set((s) => ({ references: s.references.map((r) => (r.id === id ? { ...r, ...data } : r)) })),
      removeReference: (id) => set((s) => ({ references: s.references.filter((r) => r.id !== id) })),
      reorderReferences: (activeId, overId) => set((s) => ({
        references: moveItemById(s.references, activeId, overId),
      })),

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
        merged.experience = (merged.experience || []).map(normalizeExperience);
        merged.projects = (merged.projects || []).map(normalizeProject);
        if (typeof merged.experienceManualOrder !== 'boolean') merged.experienceManualOrder = false;
        if (typeof merged.projectsManualOrder !== 'boolean') merged.projectsManualOrder = false;
        if (!merged.experienceManualOrder) merged.experience = sortWorkExperienceByDateDesc(merged.experience);
        if (!merged.projectsManualOrder) merged.projects = sortProjectsByDateDesc(merged.projects);
        if (!merged.personalInfo?.linkedin) merged.personalInfo = { ...current.personalInfo, ...merged.personalInfo };
        return merged;
      },
    }
  )
);
