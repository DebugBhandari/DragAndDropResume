// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ResumeData, Education, WorkExperience, Project, Language, Skill, Certificate, Award, Volunteer, Reference, Interest, PersonalInfo, ResumeSection, SectionType, LayoutType, StyleConfig, PhotoConfig, ColumnZone, LocaleCode } from '@/types/resume';
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from '@/utils/dateSort';
import { getSectionLabel } from '@/utils/sectionTranslations';

const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'fi', 'es', 'de', 'fr', 'ne', 'zh', 'ja'];

const BASE_SECTION_TEMPLATE: Omit<ResumeSection, 'title'>[] = [
  { id: 'section-experience', type: 'experience', zone: 'main' },
  { id: 'section-education', type: 'education', zone: 'main' },
  { id: 'section-projects', type: 'projects', zone: 'main' },
  { id: 'section-volunteer', type: 'volunteer', zone: 'main' },
  { id: 'section-skills', type: 'skills', zone: 'sidebar' },
  { id: 'section-languages', type: 'languages', zone: 'sidebar' },
  { id: 'section-certificates', type: 'certificates', zone: 'sidebar' },
  { id: 'section-awards', type: 'awards', zone: 'sidebar' },
  { id: 'section-interests', type: 'interests', zone: 'sidebar' },
  { id: 'section-references', type: 'references', zone: 'main' },
];

const getSectionTitle = (type: SectionType, locale: LocaleCode) =>
  getSectionLabel(locale, type);

const getSectionTemplates = (locale: LocaleCode): ResumeSection[] =>
  BASE_SECTION_TEMPLATE.map((section) => ({
    ...section,
    title: getSectionTitle(section.type, locale),
  }));

const PINNED_SECTION_TYPES: SectionType[] = [
  'experience',
  'projects',
  'skills',
  'languages',
];

const CONDITIONAL_SECTION_TYPES: SectionType[] = BASE_SECTION_TEMPLATE.map((section) => section.type).filter(
  (type) => !PINNED_SECTION_TYPES.includes(type)
);

const getDefaultSections = (locale: LocaleCode): ResumeSection[] => getSectionTemplates(locale).filter((section) =>
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
  fullName: 'Easy Resume',
  email: 'bhandarideepakdev@gmail.com',
  phone: '+358 40 123 4567',
  location: 'Helsinki',
  summary: 'Product-minded engineer focused on building reliable web apps with strong UX and measurable outcomes.',
  linkedin: 'https://linkedin.com/in/deepak-bhandari-dev',
  website: 'https://easyresume.dev',
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

type SeedResumeContent = Pick<ResumeData,
  | 'personalInfo'
  | 'education'
  | 'experience'
  | 'projects'
  | 'languages'
  | 'skills'
  | 'certificates'
  | 'awards'
  | 'volunteer'
  | 'references'
  | 'interests'
>;

const buildSeedResumeData = (locale: LocaleCode): SeedResumeContent => {
  const commonPersonal: Omit<PersonalInfo, 'summary'> = {
    fullName: 'Easy Resume',
    email: 'bhandarideepakdev@gmail.com',
    phone: '+358 40 123 4567',
    location: 'Helsinki',
    linkedin: 'https://linkedin.com/in/deepak-bhandari-dev',
    website: 'https://easyresume.dev',
  };

  if (locale === 'fi') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'Kehittaja, joka rakentaa skaalautuvia verkkosovelluksia ja selkeita kayttokokemuksia.',
      },
      education: [],
      experience: [{
        id: 'fi-exp-1',
        company: 'Nordic Apps Oy',
        position: 'Full Stack -kehittaja',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'Rakensi tuotantotason Next.js- ja Node.js-ratkaisuja.',
        descriptionBullets: [
          'Toteutti monikielisen CV-rakentajan vedettavilla osioilla.',
          'Paransi suorituskykya ja tulostuksen luotettavuutta.',
        ],
      }],
      projects: [{
        id: 'fi-proj-1',
        name: 'Monikielinen CV-rakentaja',
        description: 'Sovellus CV:n muokkaukseen reaaliaikaisella esikatselulla.',
        descriptionBullets: [
          'Lisasi paikallistetut kayttoliittymatekstit 8 kielelle.',
          'Rakensi VPS-julkaisun systemd- ja Nginx-konfiguraatiolla.',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'fi-lang-1', name: 'Suomi', proficiency: 'Native' },
        { id: 'fi-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'fi-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'fi-skill-2', name: 'Next.js', level: 'Advanced' },
        { id: 'fi-skill-3', name: 'Node.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'es') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'Desarrollador enfocado en aplicaciones web escalables y experiencias de usuario claras.',
      },
      education: [],
      experience: [{
        id: 'es-exp-1',
        company: 'Nordic Apps',
        position: 'Desarrollador Full Stack',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'Construyo soluciones de produccion con Next.js y Node.js.',
        descriptionBullets: [
          'Implemento un generador de CV multilenguaje con secciones drag-and-drop.',
          'Mejoro rendimiento y confiabilidad de exportacion PDF.',
        ],
      }],
      projects: [{
        id: 'es-proj-1',
        name: 'Generador de CV Multilenguaje',
        description: 'Aplicacion para crear y exportar CV con vista previa en vivo.',
        descriptionBullets: [
          'Localizo la interfaz en 8 idiomas.',
          'Automatizo despliegue a VPS con systemd y Nginx.',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'es-lang-1', name: 'Espanol', proficiency: 'Native' },
        { id: 'es-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'es-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'es-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'de') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'Entwickler mit Fokus auf skalierbare Webanwendungen und klare Nutzererlebnisse.',
      },
      education: [],
      experience: [{
        id: 'de-exp-1',
        company: 'Nordic Apps GmbH',
        position: 'Full-Stack-Entwickler',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'Entwickelte produktionsreife Loesungen mit Next.js und Node.js.',
        descriptionBullets: [
          'Baute einen mehrsprachigen Lebenslauf-Builder mit Drag-and-Drop.',
          'Verbesserte Performance und PDF-Export-Zuverlassigkeit.',
        ],
      }],
      projects: [{
        id: 'de-proj-1',
        name: 'Mehrsprachiger Lebenslauf-Builder',
        description: 'App fuer Erstellung und Export von Lebenslaeufen mit Live-Vorschau.',
        descriptionBullets: [
          'Lokalisierte UI fuer 8 Sprachen.',
          'Automatisierte VPS-Bereitstellung mit systemd und Nginx.',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'de-lang-1', name: 'Deutsch', proficiency: 'Native' },
        { id: 'de-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'de-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'de-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'fr') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'Developpeur axe sur des applications web evolutives et une UX claire.',
      },
      education: [],
      experience: [{
        id: 'fr-exp-1',
        company: 'Nordic Apps',
        position: 'Developpeur Full Stack',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'A developpe des solutions en production avec Next.js et Node.js.',
        descriptionBullets: [
          'A construit un createur de CV multilingue avec drag-and-drop.',
          'A ameliore les performances et la fiabilite de l export PDF.',
        ],
      }],
      projects: [{
        id: 'fr-proj-1',
        name: 'Createur de CV Multilingue',
        description: 'Application pour creer et exporter un CV avec apercu en direct.',
        descriptionBullets: [
          'Localisation de l interface en 8 langues.',
          'Deploiement VPS automatise avec systemd et Nginx.',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'fr-lang-1', name: 'Francais', proficiency: 'Native' },
        { id: 'fr-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'fr-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'fr-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'ne') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'स्केलेबल वेब एप्लिकेसन र स्पष्ट प्रयोगकर्ता अनुभवमा केन्द्रित डेभलपर।',
      },
      education: [],
      experience: [{
        id: 'ne-exp-1',
        company: 'Nordic Apps',
        position: 'फुल स्ट्याक डेभलपर',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'Next.js र Node.js प्रयोग गरी प्रोडक्सन सिस्टम विकास गरियो।',
        descriptionBullets: [
          'बहुभाषिक रिज्युमे बिल्डर ड्र्याग-एन्ड-ड्रपसहित बनाइयो।',
          'प्रदर्शन र PDF निर्यातको विश्वसनीयता सुधार गरियो।',
        ],
      }],
      projects: [{
        id: 'ne-proj-1',
        name: 'बहुभाषिक रिज्युमे बिल्डर',
        description: 'Live preview सहित रिज्युमे बनाउने र निर्यात गर्ने एप।',
        descriptionBullets: [
          'UI लाई ८ भाषामा स्थानीयकरण गरियो।',
          'VPS deploy लाई systemd र Nginx सहित स्वचालित बनाइयो।',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'ne-lang-1', name: 'नेपाली', proficiency: 'Native' },
        { id: 'ne-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'ne-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'ne-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'zh') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: '专注于可扩展 Web 应用与清晰用户体验的开发者。',
      },
      education: [],
      experience: [{
        id: 'zh-exp-1',
        company: 'Nordic Apps',
        position: '全栈开发工程师',
        startDate: '2023-01',
        endDate: '2026-06',
        description: '使用 Next.js 与 Node.js 构建生产级系统。',
        descriptionBullets: [
          '实现了支持拖拽分区的多语言简历构建器。',
          '优化了性能并提升了 PDF 导出的稳定性。',
        ],
      }],
      projects: [{
        id: 'zh-proj-1',
        name: '多语言简历构建器',
        description: '支持实时预览与导出的简历编辑应用。',
        descriptionBullets: [
          '将界面本地化到 8 种语言。',
          '使用 systemd 与 Nginx 自动化 VPS 部署。',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'zh-lang-1', name: '中文', proficiency: 'Native' },
        { id: 'zh-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'zh-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'zh-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  if (locale === 'ja') {
    return {
      personalInfo: {
        ...commonPersonal,
        summary: 'スケーラブルなWebアプリと明確なUXに注力する開発者。',
      },
      education: [],
      experience: [{
        id: 'ja-exp-1',
        company: 'Nordic Apps',
        position: 'フルスタックエンジニア',
        startDate: '2023-01',
        endDate: '2026-06',
        description: 'Next.js と Node.js で本番向けシステムを開発。',
        descriptionBullets: [
          'ドラッグ&ドロップ対応の多言語履歴書ビルダーを実装。',
          'パフォーマンスとPDF出力の安定性を改善。',
        ],
      }],
      projects: [{
        id: 'ja-proj-1',
        name: '多言語履歴書ビルダー',
        description: 'ライブプレビュー付きの履歴書作成・出力アプリ。',
        descriptionBullets: [
          'UIを8言語にローカライズ。',
          'systemd と Nginx で VPS デプロイを自動化。',
        ],
        completionDate: '2026-05',
        technologies: 'Next.js, TypeScript, Zustand',
        link: 'https://easyresume.dev',
      }],
      languages: [
        { id: 'ja-lang-1', name: '日本語', proficiency: 'Native' },
        { id: 'ja-lang-2', name: 'English', proficiency: 'Fluent' },
      ],
      skills: [
        { id: 'ja-skill-1', name: 'TypeScript', level: 'Advanced' },
        { id: 'ja-skill-2', name: 'Next.js', level: 'Advanced' },
      ],
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  return {
    personalInfo: seededPersonalInfo,
    education: [],
    experience: seededExperience,
    projects: seededProjects,
    languages: [
      { id: 'en-lang-1', name: 'English', proficiency: 'Native' },
      { id: 'en-lang-2', name: 'Finnish', proficiency: 'Intermediate' },
    ],
    skills: [
      { id: 'en-skill-1', name: 'TypeScript', level: 'Advanced' },
      { id: 'en-skill-2', name: 'Next.js', level: 'Advanced' },
      { id: 'en-skill-3', name: 'Node.js', level: 'Advanced' },
    ],
    certificates: [], awards: [], volunteer: [], references: [], interests: [],
  };
};

const isLikelySeedState = (state: ResumeStore, locale: LocaleCode) => {
  const currentSeed = buildSeedResumeData(locale);
  const fullNameMatches = String(state.personalInfo.fullName ?? '').trim() === String(currentSeed.personalInfo.fullName ?? '').trim();
  const emailMatches = String(state.personalInfo.email ?? '').trim() === String(currentSeed.personalInfo.email ?? '').trim();
  const locationMatches = String(state.personalInfo.location ?? '').trim() === String(currentSeed.personalInfo.location ?? '').trim();

  const experienceSeedId = currentSeed.experience[0]?.id;
  const projectSeedId = currentSeed.projects[0]?.id;

  const experienceLooksSeeded = experienceSeedId
    ? state.experience.some((item) => item.id === experienceSeedId)
    : state.experience.length === 0;
  const projectsLookSeeded = projectSeedId
    ? state.projects.some((item) => item.id === projectSeedId)
    : state.projects.length === 0;

  return fullNameMatches && emailMatches && locationMatches && experienceLooksSeeded && projectsLookSeeded;
};

const isEffectivelyEmptyResume = (state: ResumeStore) => {
  const fullName = String(state.personalInfo.fullName ?? '').trim();
  const summary = String(state.personalInfo.summary ?? '').trim();
  return fullName.length === 0 && summary.length === 0 && state.experience.length === 0 && state.projects.length === 0;
};

const isLocaleCode = (value: unknown): value is LocaleCode =>
  typeof value === 'string' && SUPPORTED_LOCALES.includes(value as LocaleCode);

interface ResumeStore extends ResumeData {
  activeLocale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
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
      activeLocale: 'en',
      personalInfo: seededPersonalInfo,
      education: [], experience: seededExperience, projects: seededProjects, languages: [], skills: [], certificates: [],
      awards: [], volunteer: [], references: [], interests: [],
      sectionOrder: getDefaultSections('en'),
      removedSections: [],
      experienceManualOrder: false,
      projectsManualOrder: false,
      layout: 'classic',
      style: defaultStyle,
      photo: defaultPhoto,

      setLocale: (locale) => set((state) => {
        if (locale === state.activeLocale) return state;

        const shouldApplyLocaleSeed = isEffectivelyEmptyResume(state) || isLikelySeedState(state, state.activeLocale);

        if (shouldApplyLocaleSeed) {
          const seed = buildSeedResumeData(locale);
          return {
            activeLocale: locale,
            ...seed,
            sectionOrder: getDefaultSections(locale),
            removedSections: [],
            experienceManualOrder: false,
            projectsManualOrder: false,
          };
        }

        const nextState: Partial<ResumeStore> = {
          activeLocale: locale,
          sectionOrder: state.sectionOrder.map((section) => ({
            ...section,
            title: getSectionTitle(section.type, locale),
          })),
        };

        return nextState;
      }),

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
        const template = getSectionTemplates(s.activeLocale).find((section) => section.type === type);
        const sectionToAdd = template || { id: `section-${type}`, type, title: getSectionTitle(type, s.activeLocale), zone: 'main' };
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

        const activeLocale: LocaleCode = isLocaleCode(merged.activeLocale) ? merged.activeLocale : 'en';
        merged.activeLocale = activeLocale;

        const conditionalWithoutData = CONDITIONAL_SECTION_TYPES.filter(
          (type) => !sectionHasData(type, merged)
        );

        if (conditionalWithoutData.length) {
          merged.sectionOrder = (merged.sectionOrder || []).filter(
            (section: ResumeSection) => !conditionalWithoutData.includes(section.type)
          );
        }

        // Keep pinned sections active by default. Other sections are shown when they contain data.
        const autoVisibleSections = getSectionTemplates(activeLocale).filter((section) =>
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
        merged.sectionOrder = (merged.sectionOrder || []).map((section: ResumeSection) => ({
          ...section,
          title: getSectionTitle(section.type, activeLocale),
        }));

        return merged;
      },
    }
  )
);
