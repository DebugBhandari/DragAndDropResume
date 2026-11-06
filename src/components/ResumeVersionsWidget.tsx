'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useResumeStore } from '@/store/useResumeStore';

function formatSavedAt(savedAt: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(savedAt));
}

export default function ResumeVersionsWidget() {
  const { resumeVersions, saveResumeVersion, loadResumeVersion, deleteResumeVersion } = useResumeStore();
  const [isOpen, setIsOpen] = useState(false);
  const [versionName, setVersionName] = useState('');

  function saveCurrentResume() {
    if (!versionName.trim()) return;
    saveResumeVersion(versionName);
    setVersionName('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="studio-secondary-button inline-flex h-10 items-center justify-center gap-2 px-3 text-sm font-semibold"
        aria-label="Open saved résumés"
      >
        <span aria-hidden="true">▣</span>
        <span className="hidden sm:inline">My résumés</span>
        <span className="resume-version-count" aria-label={`${resumeVersions.length} saved résumés`}>{resumeVersions.length}</span>
      </button>

      {isOpen && createPortal(
        <div className="resume-versions-overlay fixed inset-0 z-[2147483647] flex items-center justify-center p-3 backdrop-blur-sm sm:p-6">
          <section className="resume-versions-modal flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="resume-versions-title">
            <header className="resume-versions-header flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
              <div>
                <p className="resume-versions-kicker">Stored in this browser</p>
                <h2 id="resume-versions-title" className="text-xl font-bold">My résumés</h2>
                <p className="mt-1 text-sm opacity-75">Save the current editor state, switch between saved résumés, or delete copies you no longer need.</p>
              </div>
              <button type="button" onClick={() => setIsOpen(false)} className="feedback-close rounded-lg px-2 py-1 transition" aria-label="Close saved résumés">×</button>
            </header>

            <div className="min-h-0 overflow-y-auto p-4 sm:p-6">
              <div className="resume-version-save-grid">
                <input
                  className="input-field"
                  value={versionName}
                  onChange={(event) => setVersionName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      saveCurrentResume();
                    }
                  }}
                  placeholder="Name the current résumé version"
                />
                <button type="button" className="resume-version-load" onClick={saveCurrentResume} disabled={!versionName.trim()}>Save current</button>
              </div>

              {resumeVersions.length === 0 ? (
                <div className="resume-version-empty mt-4">
                  <p className="font-semibold">No saved résumés yet.</p>
                  <p className="mt-1 text-sm opacity-75">Save the current résumé above, or import a PDF and apply its extracted data to create one automatically.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {resumeVersions.map((version) => (
                    <div key={version.id} className="resume-version-item">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{version.name}</p>
                        <p className="mt-0.5 text-xs opacity-70">Saved {formatSavedAt(version.savedAt)}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className="resume-version-load" onClick={() => { loadResumeVersion(version.id); setIsOpen(false); }}>Open</button>
                        <button type="button" className="resume-version-delete" onClick={() => deleteResumeVersion(version.id)} aria-label={`Delete ${version.name}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}