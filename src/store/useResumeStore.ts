// @ts-nocheck
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ResumeData, Education, WorkExperience, Project, Language, Skill, Certificate, Award, Volunteer, Reference, Interest, PersonalInfo, ResumeSection, SectionType, LayoutType, StyleConfig, PhotoConfig, ColumnZone, LocaleCode } from '@/types/resume';
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from '@/utils/dateSort';
import { getSectionLabel } from '@/utils/sectionTranslations';

export const RESUME_STORAGE_KEY = 'resume-storage-v2';

const SUPPORTED_LOCALES: LocaleCode[] = ['en', 'fi', 'sv', 'es', 'de', 'fr', 'ne', 'zh', 'ja'];

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
    visible: item?.visible !== false,
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
    visible: item?.visible !== false,
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

const defaultStyle: StyleConfig = { accentColor: '#059669', sidebarColor: '#dbeafe', headingSize: 'md', sectionSpacing: 'normal', fontFamily: 'sans-serif', fontSize: 'md', headerAlignment: 'left', sidebarWidth: 30 };
const defaultPhoto: PhotoConfig = {
  url: '/default-profile.svg',
  verticalPosition: 'center',
  horizontalPosition: 'left',
  headerHeight: 180,
  marginTop: 0,
  marginBottom: 0,
  size: 113,
  borderRadius: 50,
  contentGap: 24,
};
const seededPersonalInfo: PersonalInfo = {
  fullName: 'Easy Resume',
  email: 'bhandarideepakdev@gmail.com',
  phone: '000 000000000',
  location: 'Helsinki',
  summary: 'Product-minded engineer focused on building reliable web apps with strong UX and measurable outcomes.',
  linkedin: 'linkedin.com/in/debugbhandari',
  website: 'resume.debugbhandari.link',
};

const seededExperience: WorkExperience[] = [
  {
    id: 'seed-exp-1',
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    visible: true,
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
    phone: '000 000000000',
    location: 'Helsinki',
    linkedin: 'linkedin.com/in/debugbhandari',
    website: 'resume.debugbhandari.link',
  };

  type ExperienceText = {
    position: string;
    description: string;
    bullets: [string, string];
  };

  type ProjectText = {
    name: string;
    description: string;
    bullets: [string, string];
  };

  type LocaleSeedText = {
    fullName: string;
    summary: string;
    nativeLanguage: string;
    experiences: [ExperienceText, ExperienceText, ExperienceText, ExperienceText];
    projects: [ProjectText, ProjectText, ProjectText, ProjectText];
  };

  const localizedText: Partial<Record<LocaleCode, LocaleSeedText>> = {
    fi: {
      fullName: 'Helppo CV',
      summary: 'Tuotelahtoinen kehittaja, joka rakentaa luotettavia verkkosovelluksia vahvalla UX-ajattelulla ja mitattavilla tuloksilla.',
      nativeLanguage: 'Suomi',
      experiences: [
        {
          position: 'Vanhempi ohjelmistoinsinoori',
          description: 'Rakensi ja julkaisi CV-rakentajan ominaisuuksia, jotka paransivat kayttokokemusta mitattavasti.',
          bullets: [
            'Rakensi vedettavaan jarjestelyyn perustuvan osiohallinnan pysyvalla asettelutilalla.',
            'Paransi tulostuksen ja viennin tarkkuutta seka vahensi selainten valisia muotoiluongelmia.',
          ],
        },
        {
          position: 'Frontend-kehittaja',
          description: 'Toimitti asiakasrajapinnan ominaisuuksia kassaprosessiin ja tilin elinkaaren vaiheisiin.',
          bullets: [
            'Paransi kassaprosessin valmistumisastetta 11 % lomake- ja validointi-UX:n uudistuksella.',
            'Rakensi uudelleenkaytettavia UI-peruskomponentteja, jotka nopeuttivat toimituksia tiimeissa.',
          ],
        },
        {
          position: 'Ohjelmistokehittaja',
          description: 'Osallistui kliinikoiden tyokalujen ja hoitotiimien analytiikkanakymien kehitykseen.',
          bullets: [
            'Toteutti turvalliset raportointiputket potilasaktiivisuuden yhteenvedoille.',
            'Lisasi telemetriaan perustuvia suorituskykykorjauksia, jotka nopeuttivat nakymia 35 %.',
          ],
        },
        {
          position: 'Junior web-kehittaja',
          description: 'Rakensi responsiivisia markkinointisivustoja ja CMS-pohjaisia kampanjasivuja.',
          bullets: [
            'Toimitti yli 20 kampanjasivua laiteriippumattomalla QA:lla ja saavutettavuuskorjauksilla.',
            'Yhteistyo suunnittelun kanssa loi kevyen komponenttityylioppaan.',
          ],
        },
      ],
      projects: [
        {
          name: 'CV-rakentaja',
          description: 'Interaktiivinen CV-rakentaja reaaliaikaisella esikatselulla ja vientituella.',
          bullets: [
            'Toteutti osiokohtaisen mukauttamisen ja tyyliasetukset.',
            'Lisasi vahvan VPS-julkaisuputken domain-ohjauksella.',
          ],
        },
        {
          name: 'Rekrytointiputken mittaristo',
          description: 'Sisainen mittaristo hakijoiden seurantaan ja haastattelun suorituskykymetriikoihin.',
          bullets: [
            'Suunnitteli roolikohtaiset nakymat rekrytoijille, haastattelijoille ja palkkaaville esihenkiloille.',
            'Automatisoi viikoittaiset putkiyhteenvedot CSV-viennilla ja trendinakymin.',
          ],
        },
        {
          name: 'Reaaliaikainen incident-taulu',
          description: 'Live-aikajana ja havytysten reititystyokalu insinooritiimeille.',
          bullets: [
            'Toteutti websocket-paivitykset lahes reaaliaikaiseen tilan synkronointiin.',
            'Lisasi incident-omistajuuden ja SLA-muistutukset on-call-vastetta varten.',
          ],
        },
        {
          name: 'Portfolio CMS Starter',
          description: 'Aloituspohja portfoliosivuille markdown-tuella ja kuvan optimoinnilla.',
          bullets: [
            'Rakensi sisallontuotantopolun markdown-jasennyksella ja semanttisilla SEO-oletuksilla.',
            'Loi julkaisuvalmiin CI-tyonkulun esikatselu- ja tuotantokanaville.',
          ],
        },
      ],
    },
    sv: {
      fullName: 'Enkel CV',
      summary: 'Produktfokuserad utvecklare som bygger tillforlitliga webbappar med stark UX och matbara resultat.',
      nativeLanguage: 'Svenska',
      experiences: [
        {
          position: 'Senior mjukvaruingenjor',
          description: 'Byggde och levererade funktioner i CV-byggaren med matbara UX-forbattringar.',
          bullets: [
            'Byggde dra-och-slapphantering av sektioner med bestandig layoutstatus.',
            'Forbattrade utskrifts- och exportkvalitet och minskade formatproblem mellan webblasare.',
          ],
        },
        {
          position: 'Frontend-utvecklare',
          description: 'Levererade kundnara funktioner for checkout och kontoflodet.',
          bullets: [
            'Okade checkout-slutforande med 11 % via omdesign av formulär och validerings-UX.',
            'Byggde ateranvandbara UI-byggblock som minskade leveranstid mellan team.',
          ],
        },
        {
          position: 'Mjukvaruutvecklare',
          description: 'Bidrog till klinikerverktyg och analysdashboards for vardteam.',
          bullets: [
            'Implementerade sakra rapportfloden for sammanfattningar av patientaktivitet.',
            'La till telemetribaserade prestandafixar som minskade laddtid med 35 %.',
          ],
        },
        {
          position: 'Junior webbutvecklare',
          description: 'Byggde responsiva marknadsforingssajter och CMS-drivna landningssidor.',
          bullets: [
            'Levererade 20+ kampanjsidor med QA over flera enheter och tillganglighetsforbattringar.',
            'Samarbetade med design for att skapa en lattviktsguide for komponentstil.',
          ],
        },
      ],
      projects: [
        {
          name: 'CV-byggare',
          description: 'Interaktiv CV-byggare med live-forhandsgranskning och exportstod.',
          bullets: [
            'Implementerade sektionsanpassning och stilkontroller.',
            'La till robust deploy-pipeline till VPS med domanrouting.',
          ],
        },
        {
          name: 'Dashboard for rekryteringsflode',
          description: 'Intern dashboard for kandidatuppfoljning och intervjuanalys.',
          bullets: [
            'Designade rollbaserade vyer for rekryterare, intervjuare och hiring managers.',
            'Automatiserade veckosammanfattningar med CSV-export och trendvisualiseringar.',
          ],
        },
        {
          name: 'Realtidsboard for incidenter',
          description: 'Live-tidslinje for incidenter och larmroutning for teknikteam.',
          bullets: [
            'Implementerade websocket-uppdateringar for nastan realtidssynk.',
            'La till incidentagarskap och SLA-paminnelser for snabbare jourrespons.',
          ],
        },
        {
          name: 'Portfolio CMS Starter',
          description: 'Startmall for portfoliosajter med markdown och bildoptimering.',
          bullets: [
            'Byggde redigeringsflode med markdown-tolkning och semantiska SEO-standarder.',
            'Skapade produktionsklar CI-workflow med preview- och produktionskanaler.',
          ],
        },
      ],
    },
    es: {
      fullName: 'CV Facil',
      summary: 'Desarrollador orientado a producto que crea aplicaciones web confiables con UX solida y resultados medibles.',
      nativeLanguage: 'Espanol',
      experiences: [
        {
          position: 'Ingeniero de software senior',
          description: 'Construyo y lanzo funciones del creador de CV con mejoras de UX medibles.',
          bullets: [
            'Implemento gestion de secciones con arrastrar y soltar y estado de diseno persistente.',
            'Mejoro la fidelidad de impresion/exportacion y redujo problemas de formato entre navegadores.',
          ],
        },
        {
          position: 'Ingeniero frontend',
          description: 'Entrego funciones para clientes en checkout y ciclo de vida de cuentas.',
          bullets: [
            'Mejoro la finalizacion de checkout en 11 % mediante rediseno de formularios y validacion UX.',
            'Construyo componentes UI reutilizables que redujeron tiempos de entrega entre equipos.',
          ],
        },
        {
          position: 'Desarrollador de software',
          description: 'Contribuyo a herramientas para clinicos y paneles analiticos de equipos de atencion.',
          bullets: [
            'Implemento pipelines seguros de reportes para resumenes de actividad de pacientes.',
            'Agrego mejoras de rendimiento respaldadas por telemetria que redujeron 35 % el tiempo de carga.',
          ],
        },
        {
          position: 'Desarrollador web junior',
          description: 'Construyo sitios de marketing responsivos y landing pages gestionadas por CMS.',
          bullets: [
            'Entrego mas de 20 paginas de campana con QA multidispositivo y mejoras de accesibilidad.',
            'Colaboro con diseno para crear una guia ligera de estilo de componentes.',
          ],
        },
      ],
      projects: [
        {
          name: 'Creador de CV',
          description: 'Creador de CV interactivo con vista previa en vivo y soporte de exportacion.',
          bullets: [
            'Implemento personalizacion por seccion y controles de estilo.',
            'Agrego pipeline robusto de despliegue a VPS con enrutamiento de dominio.',
          ],
        },
        {
          name: 'Panel de pipeline de contratacion',
          description: 'Panel interno para seguimiento de candidatos y metricas de entrevistas.',
          bullets: [
            'Diseno vistas por rol para reclutadores, entrevistadores y responsables de contratacion.',
            'Automatizo resumenes semanales con exportacion CSV y visualizacion de tendencias.',
          ],
        },
        {
          name: 'Tablero de incidentes en tiempo real',
          description: 'Herramienta de linea de tiempo en vivo y enrutamiento de alertas para equipos de ingenieria.',
          bullets: [
            'Implemento actualizaciones por websocket para sincronizacion de estado casi en tiempo real.',
            'Agrego propiedad de incidentes y recordatorios SLA para mejorar la respuesta on-call.',
          ],
        },
        {
          name: 'Starter CMS para portafolio',
          description: 'Plantilla inicial para sitios de portafolio con markdown y optimizacion de imagenes.',
          bullets: [
            'Construyo flujo de autoria con parsing markdown y configuracion SEO semantica.',
            'Creo flujo CI listo para despliegue con canales de preview y produccion.',
          ],
        },
      ],
    },
    de: {
      fullName: 'Einfacher Lebenslauf',
      summary: 'Produktorientierter Entwickler, der zuverlassige Webanwendungen mit starker UX und messbaren Ergebnissen entwickelt.',
      nativeLanguage: 'Deutsch',
      experiences: [
        {
          position: 'Senior Software Engineer',
          description: 'Entwickelte und lieferte Funktionen fur den Lebenslauf-Builder mit messbaren UX-Verbesserungen.',
          bullets: [
            'Implementierte Drag-and-Drop-Abschnittsverwaltung mit persistenter Layout-Logik.',
            'Verbesserte Druck-/Exportqualitat und reduzierte browserubergreifende Formatierungsfehler.',
          ],
        },
        {
          position: 'Frontend-Engineer',
          description: 'Lieferte kundennahe Features fur Checkout- und Account-Lifecycle-Flows.',
          bullets: [
            'Steigerte Checkout-Abschlussrate um 11 % durch Formular- und Validierungs-UX-Redesign.',
            'Baute wiederverwendbare UI-Bausteine, die die Lieferzeit teamubergreifend reduzierten.',
          ],
        },
        {
          position: 'Softwareentwickler',
          description: 'Arbeitete an Klinik-Tools und Analyse-Dashboards fur Versorgungsteams mit.',
          bullets: [
            'Implementierte sichere Report-Pipelines fur Zusammenfassungen zur Patientenaktivitat.',
            'Fugte telemetriegestutzte Performance-Fixes hinzu und senkte Ladezeit um 35 %.',
          ],
        },
        {
          position: 'Junior Webentwickler',
          description: 'Entwickelte responsive Marketingseiten und CMS-basierte Landingpages.',
          bullets: [
            'Lieferte 20+ Kampagnenseiten mit Multi-Device-QA und Accessibility-Verbesserungen.',
            'Arbeitete mit Design an einem leichten Komponenten-Styleguide.',
          ],
        },
      ],
      projects: [
        {
          name: 'Lebenslauf-Builder',
          description: 'Interaktiver Lebenslauf-Builder mit Live-Vorschau und Exportfunktionen.',
          bullets: [
            'Implementierte Abschnitts-Anpassung und Stilsteuerung.',
            'Fugte robuste VPS-Deployment-Pipeline mit Domain-Routing hinzu.',
          ],
        },
        {
          name: 'Hiring-Pipeline-Dashboard',
          description: 'Internes Dashboard fur Bewerber-Tracking und Interview-Performance-Metriken.',
          bullets: [
            'Entwarf rollenbasierte Ansichten fur Recruiter, Interviewer und Hiring Manager.',
            'Automatisierte wochentliche Pipeline-Reports mit CSV-Export und Trendvisualisierungen.',
          ],
        },
        {
          name: 'Realtime Incident Board',
          description: 'Live-Incident-Timeline und Alert-Routing-Tool fur Engineering-Teams.',
          bullets: [
            'Implementierte Websocket-Updates fur nahezu Echtzeit-Synchronisation des Status.',
            'Erganzte Incident-Ownership und SLA-Erinnerungen fur bessere On-Call-Reaktion.',
          ],
        },
        {
          name: 'Portfolio CMS Starter',
          description: 'Starter-Template fur Portfolio-Websites mit Markdown und Bildoptimierung.',
          bullets: [
            'Baute Authoring-Flow mit Markdown-Parsing und semantischen SEO-Standards.',
            'Erstellte produktionsreife CI-Workflows mit Preview- und Production-Kanalen.',
          ],
        },
      ],
    },
    fr: {
      fullName: 'CV Facile',
      summary: 'Developpeur oriente produit, specialise dans les applications web fiables avec une UX solide et des resultats mesurables.',
      nativeLanguage: 'Francais',
      experiences: [
        {
          position: 'Ingenieur logiciel senior',
          description: 'A developpe et livre des fonctionnalites du createur de CV avec des gains UX mesurables.',
          bullets: [
            'A implemente la gestion des sections en glisser-deposer avec etat de mise en page persistant.',
            'A ameliore la fidelite impression/export et reduit les problemes de format entre navigateurs.',
          ],
        },
        {
          position: 'Ingenieur frontend',
          description: 'A livre des fonctionnalites client pour les flux de paiement et de cycle de vie de compte.',
          bullets: [
            'A augmente de 11 % le taux de finalisation checkout via une refonte UX formulaires/validation.',
            'A cree des briques UI reutilisables reduisant le temps de livraison entre equipes.',
          ],
        },
        {
          position: 'Developpeur logiciel',
          description: 'A contribue aux outils cliniques et tableaux analytiques pour les equipes de soin.',
          bullets: [
            'A implemente des pipelines de rapports securises pour les resumes d activite patient.',
            'A ajoute des optimisations basees telemetrie reduisant le temps de chargement de 35 %.',
          ],
        },
        {
          position: 'Developpeur web junior',
          description: 'A realise des sites marketing responsives et des pages d atterrissage pilotees par CMS.',
          bullets: [
            'A livre plus de 20 pages de campagne avec QA multi-appareils et corrections accessibilite.',
            'A collabore avec le design pour definir un guide de style composants leger.',
          ],
        },
      ],
      projects: [
        {
          name: 'Createur de CV',
          description: 'Createur de CV interactif avec apercu en direct et export.',
          bullets: [
            'A implemente la personnalisation par section et des controles de style.',
            'A ajoute un pipeline de deploiement VPS robuste avec routage de domaine.',
          ],
        },
        {
          name: 'Tableau de bord pipeline de recrutement',
          description: 'Tableau de bord interne pour le suivi candidats et la performance des entretiens.',
          bullets: [
            'A concu des vues basees sur les roles pour recruteurs, intervieweurs et managers.',
            'A automatise les resumes hebdomadaires avec export CSV et visualisation de tendances.',
          ],
        },
        {
          name: 'Tableau d incidents temps reel',
          description: 'Outil de timeline d incidents en direct et routage des alertes pour equipes engineering.',
          bullets: [
            'A implemente des mises a jour websocket pour une synchronisation quasi temps reel.',
            'A ajoute ownership des incidents et rappels SLA pour ameliorer la reponse astreinte.',
          ],
        },
        {
          name: 'Portfolio CMS Starter',
          description: 'Modele de depart pour sites portfolio avec markdown et optimisation d images.',
          bullets: [
            'A construit un flux auteur avec parsing markdown et parametres SEO semantiques.',
            'A cree un workflow CI pret pour preview et production.',
          ],
        },
      ],
    },
    ne: {
      fullName: 'सजिलो रिज्युमे',
      summary: 'उत्पादन-केन्द्रित डेभलपर, जसले बलियो UX र मापनयोग्य नतिजासहित भरपर्दो वेब एप बनाउँछ।',
      nativeLanguage: 'नेपाली',
      experiences: [
        {
          position: 'वरिष्ठ सफ्टवेयर इन्जिनियर',
          description: 'रिज्युमे बिल्डरका सुविधाहरू विकास र रिलीज गरी मापनयोग्य UX सुधार गरियो।',
          bullets: [
            'स्थायी लेआउट अवस्थासहित ड्र्याग-एन्ड-ड्रप सेक्सन व्यवस्थापन बनाइयो।',
            'प्रिन्ट/एक्सपोर्टको गुणस्तर सुधार गरी ब्राउजरबीचका फर्म्याट समस्या घटाइयो।',
          ],
        },
        {
          position: 'फ्रन्टएन्ड इन्जिनियर',
          description: 'चेकआउट र अकाउन्ट लाइफसाइकलका ग्राहकमुखी फिचर डेलिभर गरियो।',
          bullets: [
            'फर्म र भ्यालिडेसन UX पुनःडिजाइनबाट चेकआउट पूरा दर ११% ले बढाइयो।',
            'पुन:प्रयोग गर्न मिल्ने UI कम्पोनेन्ट बनाएर डेलिभरी समय घटाइयो।',
          ],
        },
        {
          position: 'सफ्टवेयर डेभलपर',
          description: 'केयर टिमका लागि क्लिनिकल टुल र एनालिटिक्स ड्यासबोर्डमा योगदान गरियो।',
          bullets: [
            'बिरामी गतिविधि सारांशका लागि सुरक्षित रिपोर्ट पाइपलाइन कार्यान्वयन गरियो।',
            'टेलिमेट्री-आधारित प्रदर्शन सुधारले ड्यासबोर्ड लोड समय ३५% ले घटायो।',
          ],
        },
        {
          position: 'जुनियर वेब डेभलपर',
          description: 'रेस्पोन्सिभ मार्केटिङ वेबसाइट र CMS-आधारित ल्यान्डिङ पेज बनाइयो।',
          bullets: [
            '२०+ अभियान पेज मल्टि-डिभाइस QA र पहुँचयोग्यता सुधारसहित डेलिभर गरियो।',
            'डिजाइन टिमसँग सहकार्य गरी हल्का कम्पोनेन्ट स्टाइल गाइड तयार गरियो।',
          ],
        },
      ],
      projects: [
        {
          name: 'रिज्युमे बिल्डर',
          description: 'Live preview र export सपोर्ट भएको अन्तरक्रियात्मक रिज्युमे बिल्डर।',
          bullets: [
            'सेक्सन-स्तर अनुकूलन र शैली नियन्त्रण कार्यान्वयन गरियो।',
            'डोमेन राउटिङसहित VPS मा बलियो डिप्लोयमेन्ट पाइपलाइन थपियो।',
          ],
        },
        {
          name: 'हायरिङ पाइपलाइन ड्यासबोर्ड',
          description: 'आवेदक ट्र्याकिङ र अन्तर्वार्ता प्रदर्शन मेट्रिक्सका लागि आन्तरिक ड्यासबोर्ड।',
          bullets: [
            'रिक्रुटर, इन्टरभ्युअर र हायरिङ म्यानेजरका लागि भूमिका-आधारित दृश्य डिजाइन गरियो।',
            'साप्ताहिक पाइपलाइन सारांश CSV निर्यात र ट्रेन्ड दृश्यसहित स्वचालित बनाइयो।',
          ],
        },
        {
          name: 'रियलटाइम इन्सिडेन्ट बोर्ड',
          description: 'इन्जिनियरिङ टिमका लागि live incident timeline र alert routing टुल।',
          bullets: [
            'स्थिति समिकरणका लागि websocket अपडेट कार्यान्वयन गरियो।',
            'on-call प्रतिक्रिया सुधार्न incident ownership र SLA reminder थपियो।',
          ],
        },
        {
          name: 'पोर्टफोलियो CMS स्टार्टर',
          description: 'markdown र image optimization सहित पोर्टफोलियो वेबसाइट टेम्प्लेट।',
          bullets: [
            'markdown parsing र semantic SEO default सहित authoring flow बनाइयो।',
            'preview र production channel सहित deploy-ready CI workflow तयार गरियो।',
          ],
        },
      ],
    },
    zh: {
      fullName: '简历助手',
      summary: '以产品为导向的开发者，专注于构建可靠的 Web 应用，兼顾优秀 UX 与可衡量结果。',
      nativeLanguage: '中文',
      experiences: [
        {
          position: '高级软件工程师',
          description: '构建并交付简历生成器功能，带来可量化的 UX 提升。',
          bullets: [
            '实现了带持久化布局状态的拖拽分区管理。',
            '提升了打印与导出质量，并减少了跨浏览器格式问题。',
          ],
        },
        {
          position: '前端工程师',
          description: '交付面向客户的结算与账户生命周期功能。',
          bullets: [
            '通过表单与校验 UX 重设计，将结算完成率提升 11%。',
            '构建可复用 UI 基础组件，缩短多团队功能交付时间。',
          ],
        },
        {
          position: '软件开发工程师',
          description: '参与临床工具与护理团队分析看板开发。',
          bullets: [
            '实现了患者活动摘要的安全报表生成流水线。',
            '通过遥测驱动的性能修复，将看板加载时间降低 35%。',
          ],
        },
        {
          position: '初级 Web 开发工程师',
          description: '构建响应式营销网站与 CMS 驱动落地页。',
          bullets: [
            '交付 20+ 活动页面，并完成多设备 QA 与无障碍修复。',
            '与设计团队协作建立轻量组件样式规范。',
          ],
        },
      ],
      projects: [
        {
          name: '简历生成器',
          description: '支持实时预览与导出的交互式简历生成器。',
          bullets: [
            '实现了按分区定制与样式控制。',
            '新增稳定的 VPS 部署流水线与域名路由能力。',
          ],
        },
        {
          name: '招聘流程看板',
          description: '用于候选人跟踪与面试绩效指标的内部看板。',
          bullets: [
            '为招聘、面试官和用人经理设计了角色化视图。',
            '自动化每周流程摘要，支持 CSV 导出与趋势可视化。',
          ],
        },
        {
          name: '实时事故看板',
          description: '面向工程团队的实时事故时间线与告警路由工具。',
          bullets: [
            '实现 websocket 更新以支持近实时状态同步。',
            '新增事故负责人和 SLA 提醒以提升值班响应效率。',
          ],
        },
        {
          name: '作品集 CMS 启动模板',
          description: '支持 markdown 与图片优化的作品集网站模板。',
          bullets: [
            '构建了 markdown 解析与语义化 SEO 默认配置的创作流程。',
            '创建可直接部署的 CI 工作流，支持预览与生产通道。',
          ],
        },
      ],
    },
    ja: {
      fullName: 'かんたん履歴書',
      summary: 'プロダクト志向の開発者として、強いUXと測定可能な成果を重視した信頼性の高いWebアプリを構築します。',
      nativeLanguage: '日本語',
      experiences: [
        {
          position: 'シニアソフトウェアエンジニア',
          description: '履歴書ビルダー機能を開発・提供し、UXを定量的に改善。',
          bullets: [
            '永続レイアウト状態を持つドラッグ&ドロップのセクション管理を実装。',
            '印刷/エクスポート品質を向上し、ブラウザ間の体裁崩れを削減。',
          ],
        },
        {
          position: 'フロントエンドエンジニア',
          description: 'チェックアウトとアカウントライフサイクル向けの顧客機能を提供。',
          bullets: [
            'フォーム/バリデーションUX再設計でチェックアウト完了率を11%向上。',
            '再利用可能なUIプリミティブを構築し、機能提供時間を短縮。',
          ],
        },
        {
          position: 'ソフトウェア開発者',
          description: 'ケアチーム向けの臨床ツールと分析ダッシュボード開発に貢献。',
          bullets: [
            '患者活動サマリー用の安全なレポート生成パイプラインを実装。',
            'テレメトリ主導の性能改善でダッシュボード読込時間を35%削減。',
          ],
        },
        {
          position: 'ジュニアWeb開発者',
          description: 'レスポンシブなマーケティングサイトとCMS駆動のLPを構築。',
          bullets: [
            '20+のキャンペーンページをマルチデバイスQAとアクセシビリティ改善付きで提供。',
            'デザインと連携し、軽量なコンポーネントスタイルガイドを整備。',
          ],
        },
      ],
      projects: [
        {
          name: '履歴書ビルダー',
          description: 'ライブプレビューとエクスポートに対応した対話型履歴書ビルダー。',
          bullets: [
            'セクション単位のカスタマイズとスタイル設定を実装。',
            'ドメインルーティング付きの堅牢なVPSデプロイパイプラインを追加。',
          ],
        },
        {
          name: '採用パイプラインダッシュボード',
          description: '候補者追跡と面接パフォーマンス指標のための社内ダッシュボード。',
          bullets: [
            '採用担当、面接官、採用責任者向けのロール別ビューを設計。',
            'CSV出力とトレンド可視化付きの週次サマリーを自動化。',
          ],
        },
        {
          name: 'リアルタイムインシデントボード',
          description: 'エンジニアリングチーム向けのライブ時系列とアラートルーティングツール。',
          bullets: [
            'ほぼリアルタイムの状態同期のためのWebSocket更新を実装。',
            'オンコール対応改善のため、担当者管理とSLAリマインダーを追加。',
          ],
        },
        {
          name: 'ポートフォリオ CMS スターター',
          description: 'markdown と画像最適化を備えたポートフォリオサイト向けテンプレート。',
          bullets: [
            'markdown解析とセマンティックSEO既定値を備えた執筆フローを構築。',
            'プレビュー/本番チャネルに対応したデプロイ可能CIワークフローを作成。',
          ],
        },
      ],
    },
  };

  const baseSkills: Skill[] = [
    { id: `${locale}-skill-1`, name: 'TypeScript', level: 'Advanced' },
    { id: `${locale}-skill-2`, name: 'Next.js', level: 'Advanced' },
    { id: `${locale}-skill-3`, name: 'Node.js', level: 'Advanced' },
  ];

  if (locale === 'en') {
    return {
      personalInfo: seededPersonalInfo,
      education: [],
      experience: seededExperience,
      projects: seededProjects,
      languages: [
        { id: 'en-lang-1', name: 'English', proficiency: 'Native' },
        { id: 'en-lang-2', name: 'Finnish', proficiency: 'Intermediate' },
        { id: 'en-lang-3', name: 'Swedish', proficiency: 'Intermediate' },
      ],
      skills: baseSkills,
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  const localeText = localizedText[locale];
  if (!localeText) {
    return {
      personalInfo: seededPersonalInfo,
      education: [],
      experience: seededExperience,
      projects: seededProjects,
      languages: [
        { id: 'en-lang-1', name: 'English', proficiency: 'Native' },
        { id: 'en-lang-2', name: 'Finnish', proficiency: 'Intermediate' },
        { id: 'en-lang-3', name: 'Swedish', proficiency: 'Intermediate' },
      ],
      skills: baseSkills,
      certificates: [], awards: [], volunteer: [], references: [], interests: [],
    };
  }

  const translatedExperience = seededExperience.map((item, index) => ({
    ...item,
    position: localeText.experiences[index].position,
    description: localeText.experiences[index].description,
    descriptionBullets: [...localeText.experiences[index].bullets],
  }));

  const translatedProjects = seededProjects.map((item, index) => ({
    ...item,
    name: localeText.projects[index].name,
    description: localeText.projects[index].description,
    descriptionBullets: [...localeText.projects[index].bullets],
  }));

  return {
    personalInfo: {
      ...commonPersonal,
      fullName: localeText.fullName,
      summary: localeText.summary,
    },
    education: [],
    experience: translatedExperience,
    projects: translatedProjects,
    languages: [
      { id: `${locale}-lang-1`, name: localeText.nativeLanguage, proficiency: 'Native' },
      { id: `${locale}-lang-2`, name: 'English', proficiency: 'Fluent' },
      { id: `${locale}-lang-3`, name: 'Swedish', proficiency: 'Intermediate' },
    ],
    skills: baseSkills,
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
    (set) => {
      const initialSeed = buildSeedResumeData('en');

      return {
        activeLocale: 'en',
        personalInfo: initialSeed.personalInfo,
        education: initialSeed.education,
        experience: initialSeed.experience,
        projects: initialSeed.projects,
        languages: initialSeed.languages,
        skills: initialSeed.skills,
        certificates: initialSeed.certificates,
        awards: initialSeed.awards,
        volunteer: initialSeed.volunteer,
        references: initialSeed.references,
        interests: initialSeed.interests,
        sectionOrder: getDefaultSections('en'),
        removedSections: [],
        experienceManualOrder: false,
        projectsManualOrder: false,
        layout: 'modern',
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
        const nextExperience = [...s.experience, { id: uuidv4(), visible: true, company: '', position: '', startDate: '', endDate: '', description: '', descriptionBullets: [''] }];
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
        const nextProjects = [...s.projects, { id: uuidv4(), visible: true, name: '', description: '', descriptionBullets: [''], completionDate: '', technologies: '', link: '' }];
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
      };
    },
    { name: RESUME_STORAGE_KEY,
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
        merged.style = { ...current.style, ...merged.style, sidebarWidth: merged.style?.sidebarWidth || 30 };
        merged.experience = (merged.experience || []).map(normalizeExperience);
        merged.projects = (merged.projects || []).map(normalizeProject);
        if (typeof merged.experienceManualOrder !== 'boolean') merged.experienceManualOrder = false;
        if (typeof merged.projectsManualOrder !== 'boolean') merged.projectsManualOrder = false;
        if (!merged.experienceManualOrder) merged.experience = sortWorkExperienceByDateDesc(merged.experience);
        if (!merged.projectsManualOrder) merged.projects = sortProjectsByDateDesc(merged.projects);
        if (!merged.personalInfo?.linkedin) merged.personalInfo = { ...current.personalInfo, ...merged.personalInfo };
        merged.photo = { ...current.photo, ...merged.photo };
        if (typeof merged.photo.headerHeight !== 'number') merged.photo.headerHeight = 180;
        if (typeof merged.photo.marginTop !== 'number') merged.photo.marginTop = 0;
        if (typeof merged.photo.marginBottom !== 'number') merged.photo.marginBottom = 0;
        if (typeof merged.photo.contentGap !== 'number') merged.photo.contentGap = 24;
        merged.sectionOrder = (merged.sectionOrder || []).map((section: ResumeSection) => ({
          ...section,
          title: getSectionTitle(section.type, activeLocale),
        }));

        return merged;
      },
    }
  )
);
