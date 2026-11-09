'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type { CoverLetterData, CoverLetterStyle, CoverLetterVersion, JobApplication } from '@/types/career';

export const CAREER_STORAGE_KEY = 'career-tools-storage-v1';

const defaultCoverLetter = (): CoverLetterData => ({
  senderName: '',
  senderEmail: '',
  senderPhone: '',
  senderLocation: '',
  companyName: '',
  roleTitle: '',
  body: 'I am writing to express my interest in the role. My experience and motivation would allow me to contribute meaningfully to your team.\n\nI would welcome the opportunity to discuss how I can support your goals.',
  footer: '',
  jobDescription: '',
});

const defaultCoverLetterStyle = (): CoverLetterStyle => ({
  layout: 'modern',
  documentFormat: 'header-body-footer',
  accentColor: '#386641',
  fontFamily: 'sans-serif',
  fontSize: 'md',
  paragraphSpacing: 'md',
  headerSpacing: 'md',
});

function normalizeCoverLetterSpacing(value: unknown): CoverLetterStyle['paragraphSpacing'] {
  if (value === 'tight' || value === 'sm') return 'sm';
  if (value === 'relaxed' || value === 'lg') return 'lg';
  return 'md';
}

function normalizeCoverLetterStyle(style?: Partial<CoverLetterStyle>): CoverLetterStyle {
  return {
    ...defaultCoverLetterStyle(),
    ...style,
    documentFormat: style?.documentFormat === 'body-only' || style?.documentFormat === 'body-footer' ? style.documentFormat : 'header-body-footer',
    paragraphSpacing: normalizeCoverLetterSpacing(style?.paragraphSpacing),
    headerSpacing: normalizeCoverLetterSpacing(style?.headerSpacing),
  };
}

interface CareerStore {
  coverLetter: CoverLetterData;
  coverLetterStyle: CoverLetterStyle;
  coverLetterVersions: CoverLetterVersion[];
  jobApplications: JobApplication[];
  updateCoverLetter: (data: Partial<CoverLetterData>) => void;
  updateCoverLetterStyle: (data: Partial<CoverLetterStyle>) => void;
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
      coverLetterStyle: defaultCoverLetterStyle(),
      coverLetterVersions: [],
      jobApplications: [],
      updateCoverLetter: (data) => set((state) => ({ coverLetter: { ...state.coverLetter, ...data } })),
      updateCoverLetterStyle: (data) => set((state) => ({ coverLetterStyle: { ...state.coverLetterStyle, ...data } })),
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
            style: structuredClone(state.coverLetterStyle),
          }, ...state.coverLetterVersions],
        };
      }),
      loadCoverLetterVersion: (id) => set((state) => {
        const version = state.coverLetterVersions.find((item) => item.id === id);
        return version ? {
          coverLetter: structuredClone(version.data),
          coverLetterStyle: { ...defaultCoverLetterStyle(), ...structuredClone(version.style ?? {}) },
        } : state;
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
    {
      name: CAREER_STORAGE_KEY,
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<CareerStore>;
        return {
          ...currentState,
          ...persisted,
          coverLetter: { ...defaultCoverLetter(), ...persisted.coverLetter },
          coverLetterStyle: normalizeCoverLetterStyle(persisted.coverLetterStyle),
          coverLetterVersions: (persisted.coverLetterVersions ?? []).map((version) => ({
            ...version,
            style: normalizeCoverLetterStyle(version.style),
          })),
        };
      },
    },
  ),
);