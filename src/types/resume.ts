export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  linkedin: string;
  website: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
  descriptionBullets: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  technologies: string;
  link: string;
}

export interface Language {
  id: string;
  name: string;
  proficiency: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner';
}

export interface Skill {
  id: string;
  name: string;
  level: 'Expert' | 'Advanced' | 'Intermediate' | 'Beginner';
}

export interface Certificate {
  id: string;
  name: string;
  issuer: string;
  date: string;
  link: string;
}

export interface Award {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface Volunteer {
  id: string;
  organization: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface Reference {
  id: string;
  name: string;
  position: string;
  company: string;
  contact: string;
}

export interface Interest {
  id: string;
  name: string;
}

export type SectionType = 'education' | 'experience' | 'projects' | 'languages' | 'skills' | 'certificates' | 'awards' | 'volunteer' | 'references' | 'interests';
export type ColumnZone = 'main' | 'sidebar';

export interface ResumeSection {
  id: string;
  type: SectionType;
  title: string;
  zone: ColumnZone;
}

export type LayoutType = 'classic' | 'modern' | 'compact' | 'two-column';

export type HeaderAlignment = 'left' | 'center' | 'right';

export interface StyleConfig {
  accentColor: string;
  headingSize: 'sm' | 'md' | 'lg';
  sectionSpacing: 'tight' | 'normal' | 'relaxed';
  fontFamily: 'serif' | 'sans-serif' | 'mono';
  fontSize: 'sm' | 'md' | 'lg';
  headerAlignment: HeaderAlignment;
  sidebarWidth: number;
}

export interface PhotoConfig {
  url: string;
  x: number;
  y: number;
  size: number;
  borderRadius: number;
}

export interface ResumeData {
  personalInfo: PersonalInfo;
  education: Education[];
  experience: WorkExperience[];
  projects: Project[];
  languages: Language[];
  skills: Skill[];
  certificates: Certificate[];
  awards: Award[];
  volunteer: Volunteer[];
  references: Reference[];
  interests: Interest[];
  sectionOrder: ResumeSection[];
  layout: LayoutType;
  style: StyleConfig;
  photo: PhotoConfig;
}
