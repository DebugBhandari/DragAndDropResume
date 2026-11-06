export interface CoverLetterData {
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  senderLocation: string;
  recipientName: string;
  companyName: string;
  roleTitle: string;
  date: string;
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  signature: string;
  jobDescription: string;
}

export interface CoverLetterVersion {
  id: string;
  name: string;
  savedAt: string;
  data: CoverLetterData;
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