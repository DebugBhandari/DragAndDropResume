'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { CoverLetterData, CoverLetterVersion, JobApplication } from '@/types/career';

export const CAREER_STORAGE_KEY = 'career-tools-storage-v1';

const defaultCoverLetter = (): CoverLetterData => ({
  senderName: '',
  senderEmail: '',
  senderPhone: '',
  senderLocation: '',
  recipientName: '',
  companyName: '',
  roleTitle: '',
  date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
  subject: '',
  greeting: 'Dear Hiring Manager,',
  body: 'I am writing to express my interest in the role. My experience and motivation would allow me to contribute meaningfully to your team.\n\nI would welcome the opportunity to discuss how I can support your goals.',
  closing: 'Sincerely,',
  signature: '',
  jobDescription: '',
});

interface CareerStore {
  coverLetter: CoverLetterData;
  coverLetterVersions: CoverLetterVersion[];
  jobApplications: JobApplication[];
  updateCoverLetter: (data: Partial<CoverLetterData>) => void;
  replaceCoverLetter: (data: Partial<CoverLetterData>) => void;
  clearCoverLetter: () => void;
  saveCoverLetterVersion: (name: string) => void;
  loadCoverLetterVersion: (id: string) => void;
  deleteCoverLetterVersion: (id: string) => void;
  addJobApplication: () => void;
  updateJobApplication: (id: string, data: Partial<JobApplication>) => void;
  deleteJobApplication: (id: string) => void;
}

export const useCareerStore = create<CareerStore>()(
  persist(
    (set) => ({
      coverLetter: defaultCoverLetter(),
      coverLetterVersions: [],
      jobApplications: [],
      updateCoverLetter: (data) => set((state) => ({ coverLetter: { ...state.coverLetter, ...data } })),
      replaceCoverLetter: (data) => set((state) => ({ coverLetter: { ...defaultCoverLetter(), ...state.coverLetter, ...data } })),
      clearCoverLetter: () => set({ coverLetter: defaultCoverLetter() }),
      saveCoverLetterVersion: (name) => set((state) => {
        const trimmedName = name.trim();
        if (!trimmedName) return state;
        return {
          coverLetterVersions: [{
            id: uuidv4(),
            name: trimmedName,
            savedAt: new Date().toISOString(),
            data: structuredClone(state.coverLetter),
          }, ...state.coverLetterVersions],
        };
      }),
      loadCoverLetterVersion: (id) => set((state) => {
        const version = state.coverLetterVersions.find((item) => item.id === id);
        return version ? { coverLetter: structuredClone(version.data) } : state;
      }),
      deleteCoverLetterVersion: (id) => set((state) => ({
        coverLetterVersions: state.coverLetterVersions.filter((version) => version.id !== id),
      })),
      addJobApplication: () => set((state) => ({
        jobApplications: [{
          id: uuidv4(), company: '', role: '', status: 'Saved', appliedOn: '', nextStep: '', link: '', notes: '', updatedAt: new Date().toISOString(),
        }, ...state.jobApplications],
      })),
      updateJobApplication: (id, data) => set((state) => ({
        jobApplications: state.jobApplications.map((application) => application.id === id
          ? { ...application, ...data, updatedAt: new Date().toISOString() }
          : application),
      })),
      deleteJobApplication: (id) => set((state) => ({
        jobApplications: state.jobApplications.filter((application) => application.id !== id),
      })),
    }),
    { name: CAREER_STORAGE_KEY },
  ),
);