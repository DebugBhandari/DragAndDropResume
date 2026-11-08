export interface CoverLetterData {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderLocation: string;
  companyName: string;
  roleTitle: string;
  body: string;
  jobDescription: string;
}

export type CoverLetterLayout = 'classic' | 'modern' | 'compact' | 'centered' | 'minimal';
export type CoverLetterFontFamily = 'serif' | 'sans-serif' | 'mono';
export type CoverLetterFontSize = 'sm' | 'md' | 'lg';
export type CoverLetterSpacing = 'tight' | 'normal' | 'relaxed';

export interface CoverLetterStyle {
  layout: CoverLetterLayout;
  accentColor: string;
  fontFamily: CoverLetterFontFamily;
  fontSize: CoverLetterFontSize;
  paragraphSpacing: CoverLetterSpacing;
  headerSpacing: CoverLetterSpacing;
}

export interface CoverLetterVersion {
  id: string;
  name: string;
  savedAt: string;
  data: CoverLetterData;
  style: CoverLetterStyle;
}

export type ApplicationStatus =
  | 'Saved'
  | 'Applied'
  | 'Rejected'
  | 'Interview'
  | 'Second interview'
  | 'Offer'
  | 'Successful'
  | 'Withdrawn';

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedOn: string;
  nextStep: string;
  link: string;
  notes: string;
  updatedAt: string;
}