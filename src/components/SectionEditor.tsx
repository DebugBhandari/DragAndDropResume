'use client';
import { useResumeStore } from '@/store/useResumeStore';
import { SectionType, Language, Skill } from '@/types/resume';

export default function SectionEditor({ type }: { type: SectionType }) {
  const store = useResumeStore();

  if (type === 'education') {
    return (
      <div className="space-y-3">
        {store.education.map((edu) => (
          <div key={edu.id} className="form-card">
            <button onClick={() => store.removeEducation(edu.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Institution" value={edu.institution} onChange={(e) => store.updateEducation(edu.id, { institution: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Degree" value={edu.degree} onChange={(e) => store.updateEducation(edu.id, { degree: e.target.value })} />
              <input className="input-field" placeholder="Field of Study" value={edu.field} onChange={(e) => store.updateEducation(edu.id, { field: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Start Date" value={edu.startDate} onChange={(e) => store.updateEducation(edu.id, { startDate: e.target.value })} />
              <input className="input-field" placeholder="End Date" value={edu.endDate} onChange={(e) => store.updateEducation(edu.id, { endDate: e.target.value })} />
            </div>
            <textarea className="input-field" placeholder="Description" value={edu.description} onChange={(e) => store.updateEducation(edu.id, { description: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addEducation} className="btn-add">+ Add Education</button>
      </div>
    );
  }

  if (type === 'experience') {
    return (
      <div className="space-y-3">
        {store.experience.map((exp) => (
          <div key={exp.id} className="form-card">
            <button onClick={() => store.removeExperience(exp.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Company" value={exp.company} onChange={(e) => store.updateExperience(exp.id, { company: e.target.value })} />
            <input className="input-field" placeholder="Position" value={exp.position} onChange={(e) => store.updateExperience(exp.id, { position: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Start Date" value={exp.startDate} onChange={(e) => store.updateExperience(exp.id, { startDate: e.target.value })} />
              <input className="input-field" placeholder="End Date" value={exp.endDate} onChange={(e) => store.updateExperience(exp.id, { endDate: e.target.value })} />
            </div>
            <textarea className="input-field min-h-[80px]" placeholder="Description (use bullet points with •)" value={exp.description} onChange={(e) => store.updateExperience(exp.id, { description: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addExperience} className="btn-add">+ Add Experience</button>
      </div>
    );
  }

  if (type === 'projects') {
    return (
      <div className="space-y-3">
        {store.projects.map((proj) => (
          <div key={proj.id} className="form-card">
            <button onClick={() => store.removeProject(proj.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Project Name" value={proj.name} onChange={(e) => store.updateProject(proj.id, { name: e.target.value })} />
            <textarea className="input-field" placeholder="Description" value={proj.description} onChange={(e) => store.updateProject(proj.id, { description: e.target.value })} />
            <input className="input-field" placeholder="Technologies" value={proj.technologies} onChange={(e) => store.updateProject(proj.id, { technologies: e.target.value })} />
            <input className="input-field" placeholder="Link" value={proj.link} onChange={(e) => store.updateProject(proj.id, { link: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addProject} className="btn-add">+ Add Project</button>
      </div>
    );
  }

  if (type === 'languages') {
    return (
      <div className="space-y-3">
        {store.languages.map((lang) => (
          <div key={lang.id} className="form-card flex gap-2 items-center">
            <button onClick={() => store.removeLanguage(lang.id)} className="remove-btn">✕</button>
            <input className="input-field flex-1" placeholder="Language" value={lang.name} onChange={(e) => store.updateLanguage(lang.id, { name: e.target.value })} />
            <select className="input-field w-36" value={lang.proficiency} onChange={(e) => store.updateLanguage(lang.id, { proficiency: e.target.value as Language['proficiency'] })}>
              <option>Native</option><option>Fluent</option><option>Advanced</option><option>Intermediate</option><option>Beginner</option>
            </select>
          </div>
        ))}
        <button onClick={store.addLanguage} className="btn-add">+ Add Language</button>
      </div>
    );
  }

  if (type === 'skills') {
    return (
      <div className="space-y-3">
        {store.skills.map((skill) => (
          <div key={skill.id} className="form-card flex gap-2 items-center">
            <button onClick={() => store.removeSkill(skill.id)} className="remove-btn">✕</button>
            <input className="input-field flex-1" placeholder="Skill" value={skill.name} onChange={(e) => store.updateSkill(skill.id, { name: e.target.value })} />
            <select className="input-field w-36" value={skill.level} onChange={(e) => store.updateSkill(skill.id, { level: e.target.value as Skill['level'] })}>
              <option>Expert</option><option>Advanced</option><option>Intermediate</option><option>Beginner</option>
            </select>
          </div>
        ))}
        <button onClick={store.addSkill} className="btn-add">+ Add Skill</button>
      </div>
    );
  }

  if (type === 'certificates') {
    return (
      <div className="space-y-3">
        {store.certificates.map((cert) => (
          <div key={cert.id} className="form-card">
            <button onClick={() => store.removeCertificate(cert.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Certificate Name" value={cert.name} onChange={(e) => store.updateCertificate(cert.id, { name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Issuer" value={cert.issuer} onChange={(e) => store.updateCertificate(cert.id, { issuer: e.target.value })} />
              <input className="input-field" placeholder="Date" value={cert.date} onChange={(e) => store.updateCertificate(cert.id, { date: e.target.value })} />
            </div>
            <input className="input-field" placeholder="Link (optional)" value={cert.link} onChange={(e) => store.updateCertificate(cert.id, { link: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addCertificate} className="btn-add">+ Add Certificate</button>
      </div>
    );
  }

  if (type === 'awards') {
    return (
      <div className="space-y-3">
        {store.awards.map((award) => (
          <div key={award.id} className="form-card">
            <button onClick={() => store.removeAward(award.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Award Title" value={award.title} onChange={(e) => store.updateAward(award.id, { title: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Issuer" value={award.issuer} onChange={(e) => store.updateAward(award.id, { issuer: e.target.value })} />
              <input className="input-field" placeholder="Date" value={award.date} onChange={(e) => store.updateAward(award.id, { date: e.target.value })} />
            </div>
            <textarea className="input-field" placeholder="Description (optional)" value={award.description} onChange={(e) => store.updateAward(award.id, { description: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addAward} className="btn-add">+ Add Award</button>
      </div>
    );
  }

  if (type === 'volunteer') {
    return (
      <div className="space-y-3">
        {store.volunteer.map((vol) => (
          <div key={vol.id} className="form-card">
            <button onClick={() => store.removeVolunteer(vol.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Organization" value={vol.organization} onChange={(e) => store.updateVolunteer(vol.id, { organization: e.target.value })} />
            <input className="input-field" placeholder="Role" value={vol.role} onChange={(e) => store.updateVolunteer(vol.id, { role: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Start Date" value={vol.startDate} onChange={(e) => store.updateVolunteer(vol.id, { startDate: e.target.value })} />
              <input className="input-field" placeholder="End Date" value={vol.endDate} onChange={(e) => store.updateVolunteer(vol.id, { endDate: e.target.value })} />
            </div>
            <textarea className="input-field" placeholder="Description" value={vol.description} onChange={(e) => store.updateVolunteer(vol.id, { description: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addVolunteer} className="btn-add">+ Add Volunteer</button>
      </div>
    );
  }

  if (type === 'references') {
    return (
      <div className="space-y-3">
        {store.references.map((ref) => (
          <div key={ref.id} className="form-card">
            <button onClick={() => store.removeReference(ref.id)} className="remove-btn">✕</button>
            <input className="input-field" placeholder="Name" value={ref.name} onChange={(e) => store.updateReference(ref.id, { name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input-field" placeholder="Position" value={ref.position} onChange={(e) => store.updateReference(ref.id, { position: e.target.value })} />
              <input className="input-field" placeholder="Company" value={ref.company} onChange={(e) => store.updateReference(ref.id, { company: e.target.value })} />
            </div>
            <input className="input-field" placeholder="Contact (email/phone)" value={ref.contact} onChange={(e) => store.updateReference(ref.id, { contact: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addReference} className="btn-add">+ Add Reference</button>
      </div>
    );
  }

  if (type === 'interests') {
    return (
      <div className="space-y-3">
        {store.interests.map((interest) => (
          <div key={interest.id} className="form-card flex gap-2 items-center">
            <button onClick={() => store.removeInterest(interest.id)} className="remove-btn">✕</button>
            <input className="input-field flex-1" placeholder="Interest / Hobby" value={interest.name} onChange={(e) => store.updateInterest(interest.id, { name: e.target.value })} />
          </div>
        ))}
        <button onClick={store.addInterest} className="btn-add">+ Add Interest</button>
      </div>
    );
  }

  return null;
}
