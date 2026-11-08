'use client';

import Link from 'next/link';
import FeedbackWidget from '@/components/FeedbackWidget';
import { useMemo, useState } from 'react';
import { useCareerStore } from '@/store/useCareerStore';
import { useUIStore } from '@/store/useUIStore';
import type { ApplicationStatus, JobApplication } from '@/types/career';

const statuses: ApplicationStatus[] = ['Saved', 'Applied', 'Interview', 'Second interview', 'Offer', 'Successful', 'Rejected', 'Withdrawn'];

export default function TrackingPage() {
  const { jobApplications, addJobApplication, updateJobApplication, deleteJobApplication } = useCareerStore();
  const [filter, setFilter] = useState<'All' | ApplicationStatus>('All');
  const { studioTheme, toggleStudioTheme } = useUIStore();
  const visibleApplications = useMemo(() => filter === 'All' ? jobApplications : jobApplications.filter((job) => job.status === filter), [filter, jobApplications]);
  const update = (id: string, data: Partial<JobApplication>) => updateJobApplication(id, data);

  return <main className="resume-studio career-tool min-h-screen" data-theme={studioTheme}>
    <header className="studio-header sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><div className="studio-mark" aria-hidden="true">T</div><div><p className="studio-header-title text-lg font-bold" style={{ color: 'var(--studio-text)' }}>Application tracking</p><p className="studio-header-subtitle hidden text-xs sm:block" style={{ color: 'var(--studio-muted)' }}>A browser-local job search board</p></div></div><nav className="flex items-center gap-2"><Link href="/" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Résumé</Link><Link href="/cover" className="studio-secondary-button inline-flex h-10 items-center px-3 text-sm font-semibold">Cover letter</Link></nav></header>
    <div className="mx-auto max-w-[1700px] p-4 lg:p-6"><section className="career-panel"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="career-kicker">Job pipeline</p><h1 className="text-2xl font-bold">Track every application</h1><p className="mt-1 text-sm opacity-75">Saved locally in this browser. Add notes and next steps as your process moves forward.</p></div><button type="button" className="career-primary-button" onClick={addJobApplication}>+ Add application</button></div><div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter application statuses"><button type="button" className={`style-chip ${filter === 'All' ? 'style-chip-active' : ''}`} onClick={() => setFilter('All')}>All ({jobApplications.length})</button>{statuses.map((status) => <button key={status} type="button" className={`style-chip ${filter === status ? 'style-chip-active' : ''}`} onClick={() => setFilter(status)}>{status} ({jobApplications.filter((job) => job.status === status).length})</button>)}</div><div className="tracking-table-wrap mt-5"><table className="tracking-table"><thead><tr><th>Company</th><th>Role</th><th>Status</th><th>Applied</th><th>Next step</th><th>Link</th><th>Notes</th><th aria-label="Actions" /></tr></thead><tbody>{visibleApplications.length === 0 ? <tr><td colSpan={8} className="tracking-empty">No applications here yet. Add one to start your tracker.</td></tr> : visibleApplications.map((job) => <tr key={job.id}><td><input className="tracking-input" value={job.company} onChange={(event) => update(job.id, { company: event.target.value })} placeholder="Company" /></td><td><input className="tracking-input" value={job.role} onChange={(event) => update(job.id, { role: event.target.value })} placeholder="Role" /></td><td><select className="tracking-input" value={job.status} onChange={(event) => update(job.id, { status: event.target.value as ApplicationStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td><td><input className="tracking-input" type="date" value={job.appliedOn} onChange={(event) => update(job.id, { appliedOn: event.target.value })} /></td><td><input className="tracking-input" value={job.nextStep} onChange={(event) => update(job.id, { nextStep: event.target.value })} placeholder="Follow up Friday" /></td><td><input className="tracking-input" type="url" value={job.link} onChange={(event) => update(job.id, { link: event.target.value })} placeholder="https://…" /></td><td><textarea className="tracking-input min-h-16 resize-y" value={job.notes} onChange={(event) => update(job.id, { notes: event.target.value })} placeholder="Contacts, prep, outcome…" /></td><td><button type="button" className="resume-version-delete" onClick={() => deleteJobApplication(job.id)} aria-label={`Delete ${job.role || 'application'} at ${job.company || 'company'}`}>Delete</button></td></tr>)}</tbody></table></div></section></div>
    <div className="studio-floating-controls fixed bottom-4 right-4 z-90 flex items-center gap-2">
      <FeedbackWidget />
      <button type="button" onClick={toggleStudioTheme} className="studio-theme-switch inline-flex h-10 items-center gap-2 px-2.5 text-xs font-bold uppercase tracking-[0.12em] sm:px-3" aria-label={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`} title={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`}>
        <span aria-hidden="true">{studioTheme === 'dark' ? '☀' : '☾'}</span>
        <span className="hidden sm:inline">{studioTheme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
    </div>
  </main>;
}