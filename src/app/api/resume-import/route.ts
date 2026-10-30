import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResumeImportDraft } from '@/types/resume';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const encoder = new TextEncoder();
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 3;
const MAX_IMPORTED_PHOTO_BYTES = 1_000_000;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
let aiRefinementInFlight = false;

type ImportEvent =
  | { type: 'progress'; message: string }
  | { type: 'draft'; draft: ResumeImportDraft; source: 'extracted' | 'ai-partial' | 'ai' | 'photo' }
  | { type: 'complete'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

function text(value: unknown, max = 500) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function array(value: unknown) { return Array.isArray(value) ? value : []; }
function validLevel(value: string, levels: readonly string[], fallback: string) { return levels.includes(value) ? value : fallback; }
function splitDescriptionIntoBullets(values: unknown[], description: unknown) {
  const source = [...values, description].flatMap((value) => text(value, 1400).split(/\n+|(?=[•·▪◦])\s*/));
  return source.flatMap((value) => {
    const cleaned = value.replace(/^[•·▪◦*-]\s*/, '').trim();
    if (!cleaned) return [];
    const sentences = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).flatMap((sentence) => sentence.split(/\s*;\s*/));
    return sentences.map((sentence) => sentence.trim()).filter(Boolean);
  }).filter((bullet, index, bullets) => bullet.length >= 3 && bullets.indexOf(bullet) === index).map((bullet) => bullet.slice(0, 360));
}
function descriptionValues(row: Record<string, unknown>) { return [...array(row.descriptionBullets), ...array(row.bullets), ...array(row.highlights), ...array(row.responsibilities), ...array(row.achievements)]; }
function textList(value: unknown, max = 400) { return Array.isArray(value) ? value.map((item) => text(item, 100)).filter(Boolean).join(', ').slice(0, max) : text(value, max); }
function namedRows(value: unknown) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([name, detail]) => detail && typeof detail === 'object' ? { name, ...(detail as Record<string, unknown>) } : { name, detail });
  return [];
}
function emptyDraft(): ResumeImportDraft {
  return { personalInfo: { fullName: '', email: '', phone: '', location: '', linkedin: '', website: '', summary: '' }, experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], warnings: [] };
}
function sanitizeDraft(value: unknown): ResumeImportDraft {
  const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const personal = raw.personalInfo && typeof raw.personalInfo === 'object' ? raw.personalInfo as Record<string, unknown> : {};
  return {
    personalInfo: { fullName: text(personal.fullName ?? personal.name, 120), email: text(personal.email, 160), phone: text(personal.phone, 80), location: text(personal.location, 160), linkedin: text(personal.linkedin, 240), website: text(personal.website, 240), summary: text(personal.summary, 1200) },
    experience: array(raw.experience).slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const description = text(row.description ?? row.summary, 1200);
      const bullets = splitDescriptionIntoBullets(descriptionValues(row), description);
      return { company: text(row.company ?? row.employer ?? row.organization, 180), position: text(row.position ?? row.jobTitle ?? row.title ?? row.role, 180), startDate: text(row.startDate ?? row.start ?? row.from, 60), endDate: text(row.endDate ?? row.end ?? row.to, 60), description, descriptionBullets: bullets };
    }).filter((item) => item.company || item.position),
    projects: array(raw.projects).slice(0, 12).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const description = text(row.description ?? row.summary, 1200);
      const bullets = splitDescriptionIntoBullets(descriptionValues(row), description);
      return { name: text(row.name ?? row.projectName ?? row.project ?? row.title, 180), description, descriptionBullets: bullets, completionDate: text(row.completionDate ?? row.date, 60), technologies: textList(row.technologies ?? row.techStack ?? row.stack), link: text(row.link ?? row.url ?? row.github, 240) };
    }).filter((item) => item.name || item.descriptionBullets.length),
    education: array(raw.education).slice(0, 10).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { institution: text(row.institution ?? row.university ?? row.school, 180), degree: text(row.degree ?? row.qualification, 180), field: text(row.field ?? row.major ?? row.specialization, 180), startDate: text(row.startDate ?? row.start ?? row.from, 60), endDate: text(row.endDate ?? row.end ?? row.to, 60), description: text(row.description, 800) };
    }).filter((item) => item.institution || item.degree),
    skills: namedRows(raw.skills).slice(0, 40).map((item) => {
      const row: Record<string, unknown> = item && typeof item === 'object' ? item as Record<string, unknown> : { name: item };
      return { name: text(row.name ?? row.skill, 80), level: validLevel(text(row.level ?? row.detail, 20), ['Expert', 'Advanced', 'Intermediate', 'Beginner'], 'Intermediate') as 'Expert' | 'Advanced' | 'Intermediate' | 'Beginner' };
    }).filter((item) => item.name),
    languages: namedRows(raw.languages).slice(0, 15).map((item) => {
      const row: Record<string, unknown> = item && typeof item === 'object' ? item as Record<string, unknown> : { name: item };
      return { name: text(row.name ?? row.language, 80), proficiency: validLevel(text(row.proficiency ?? row.level ?? row.detail, 20), ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Beginner'], 'Intermediate') as 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner' };
    }).filter((item) => item.name),
    certificates: array(raw.certificates).slice(0, 20).map((item) => {
      const row = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      return { name: text(row.name ?? row.certificate ?? row.credential, 180), issuer: text(row.issuer ?? row.organization, 180), date: text(row.date ?? row.issueDate, 60), link: text(row.link ?? row.url, 240) };
    }).filter((item) => item.name),
    warnings: array(raw.warnings).map((warning) => text(warning, 240)).filter(Boolean).slice(0, 8),
  };
}

function normalizeHeading(value: string) { return value.toLowerCase().replace(/[^a-z]/g, ''); }
function isHeading(value: string, candidates: string[]) { const heading = normalizeHeading(value); return candidates.some((candidate) => heading === candidate || heading.startsWith(candidate)); }
function sectionHeading(line: string) {
  const heading = normalizeHeading(line);
  const match = (values: string[]) => values.some((value) => heading === value || heading.startsWith(value));
  if (match(['experience', 'workexperience', 'employment', 'professionalexperience', 'careersummary', 'workhistory'])) return 'experience';
  if (match(['projects', 'projectexperience', 'selectedprojects', 'personalprojects', 'keyprojects', 'notableprojects', 'relevantprojects', 'portfolio'])) return 'projects';
  if (match(['education', 'academicbackground', 'qualifications', 'academicqualifications', 'educationandtraining'])) return 'education';
  if (match(['skills', 'technicalskills', 'corecompetencies', 'competencies', 'technologies', 'toolbox', 'keyskills', 'skillsandtools', 'itskills', 'computerskills', 'programmingskills', 'technicalproficiencies', 'skillset', 'expertise'])) return 'skills';
  if (match(['languages', 'language', 'languageskills'])) return 'languages';
  if (match(['certificates', 'certifications', 'licenses', 'licences', 'credentials', 'certificatesandcertifications'])) return 'certificates';
  if (match(['summary', 'professionalsummary', 'summaryofqualifications', 'profile', 'professionalprofile', 'executiveprofile', 'aboutme', 'introduction', 'careerobjective', 'objective', 'professionalobjective'])) return 'summary';
  return '';
}
function splitSectionItems(lines: string[]) { return lines.flatMap((line) => line.split(/[|,;•·▪◦]|\s{2,}/)).map((item) => item.replace(/^[-–—*]\s*/, '').trim()).filter((item) => item.length >= 2); }
function isSectionTerminator(line: string) { return /^(achievements?(?:\s*\/\s*tasks?)?|tasks?|contact|references?|interests?|hobbies|volunteer(?:ing)?|awards?|publications?|additional\s+(?:information|details))\s*:?[\s]*$/i.test(line); }
const KNOWN_LANGUAGES = new Set(['afrikaans', 'albanian', 'amharic', 'arabic', 'armenian', 'azerbaijani', 'bengali', 'bosnian', 'bulgarian', 'burmese', 'cantonese', 'catalan', 'chinese', 'croatian', 'czech', 'danish', 'dari', 'dutch', 'english', 'estonian', 'farsi', 'filipino', 'finnish', 'french', 'georgian', 'german', 'greek', 'gujarati', 'hebrew', 'hindi', 'hungarian', 'icelandic', 'indonesian', 'italian', 'japanese', 'kannada', 'kazakh', 'khmer', 'korean', 'kurdish', 'lao', 'latvian', 'lithuanian', 'malay', 'malayalam', 'mandarin', 'marathi', 'mongolian', 'nepali', 'norwegian', 'oriya', 'pashto', 'persian', 'polish', 'portuguese', 'punjabi', 'romanian', 'russian', 'serbian', 'sinhala', 'slovak', 'slovenian', 'somali', 'spanish', 'swahili', 'swedish', 'tagalog', 'tamil', 'telugu', 'thai', 'tigrinya', 'turkish', 'ukrainian', 'urdu', 'uzbek', 'vietnamese', 'welsh', 'yoruba', 'zulu']);
const WORK_TITLE_PATTERN = /\b(?:engineer|developer|intern|cashier|architect|designer|manager|director|consultant|analyst|administrator|administrator|specialist|coordinator|assistant|associate|officer|representative|technician|researcher|teacher|instructor|supervisor|lead|founder|owner|full\s*stack|frontend|front\s*end|backend|back\s*end|software|web|mobile|data\s+scientist)\b/i;
const TECHNICAL_SKILLS = ['AWS', 'Azure', 'C#', 'C++', 'CSS', 'Docker', 'Figma', 'Firebase', 'Git', 'GitHub', 'GraphQL', 'HTML', 'Java', 'JavaScript', 'Jenkins', 'Kotlin', 'Kubernetes', 'MongoDB', 'MySQL', 'Next.js', 'Node.js', 'OpenAI', 'PHP', 'PostgreSQL', 'Python', 'React', 'Redux', 'Ruby', 'Rust', 'SQL', 'Swift', 'Tailwind CSS', 'TensorFlow', 'TypeScript', 'Vue.js'];
function languageProficiency(value: string) {
  const normalized = value.toLowerCase();
  if (/native|bilingual/.test(normalized)) return 'Native' as const;
  if (/full professional|professional working|fluent/.test(normalized)) return 'Fluent' as const;
  if (/advanced/.test(normalized)) return 'Advanced' as const;
  if (/intermediate/.test(normalized)) return 'Intermediate' as const;
  if (/beginner|elementary|limited working/.test(normalized)) return 'Beginner' as const;
  return null;
}
function isProficiencyOnly(value: string) { return /^(?:native(?:\s+or\s+bilingual)?|bilingual|full professional proficiency|professional working proficiency|fluent|advanced|intermediate|beginner|elementary|limited working)(?:\s+proficiency)?$/i.test(value.trim()); }
function parseLanguages(lines: string[]) {
  const languages: Array<{ name: string; proficiency: 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Beginner' }> = [];
  for (const value of splitSectionItems(lines)) {
    const proficiency = languageProficiency(value);
    const name = value.replace(/\s*[-–—:]\s*(native|bilingual|full professional proficiency|professional working proficiency|fluent|advanced|intermediate|beginner|elementary|limited working).*$/i, '').trim();
    if (!name && proficiency && languages.length) { languages[languages.length - 1].proficiency = proficiency; continue; }
    if (proficiency && isProficiencyOnly(value)) { if (languages.length) languages[languages.length - 1].proficiency = proficiency; continue; }
    if (name.length >= 2 && name.length <= 80 && KNOWN_LANGUAGES.has(name.toLowerCase())) languages.push({ name, proficiency: proficiency ?? 'Intermediate' });
  }
  return languages.filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index).slice(0, 15);
}
function parseCertificates(lines: string[]) {
  const provider = (name: string) => /\baws\b/i.test(name) ? 'Amazon Web Services (AWS)' : /\bkaggle\b/i.test(name) ? 'Kaggle' : /\bgoogle\b/i.test(name) ? 'Google' : /\bmicrosoft\b/i.test(name) ? 'Microsoft' : /\bcoursera\b/i.test(name) ? 'Coursera' : '';
  return splitSectionItems(lines).filter((value) => !/^(achievements?(?:\s*\/\s*tasks?)?|tasks?|contact|references?)$/i.test(value)).filter((value) => value.length <= 180 && !/[.!?]$/.test(value) && !WORK_TITLE_PATTERN.test(value)).map((value) => {
    const date = value.match(/\(([^)]*(?:19|20)\d{2}[^)]*)\)/)?.[1] ?? '';
    const withoutDate = value.replace(/\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*/, '').trim();
    const issuerMatch = withoutDate.match(/^(.*?)\s+(?:[-–—|]|by|from)\s+(.+)$/i);
    return { name: (issuerMatch?.[1] ?? withoutDate).trim(), issuer: (issuerMatch?.[2] ?? provider(withoutDate)).trim(), date, link: '' };
  }).filter((item) => item.name).filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index).slice(0, 20);
}
function inlineSectionContent(line: string) {
  const match = line.match(/^(.{2,80}?)[\s:–—-]+(.{2,})$/);
  if (!match) return { section: '', content: '' };
  const section = sectionHeading(match[1]);
  return { section, content: section ? match[2].trim() : '' };
}
function parseEducation(lines: string[]) {
  const entries: Array<{ institution: string; degree: string; field: string; startDate: string; endDate: string; description: string }> = [];
  for (const line of lines) {
    const parts = line.split(/[|•·▪◦]/).map((value) => value.trim()).filter(Boolean);
    const dateMatch = line.match(/((?:19|20)\d{2}|present|current)\s*(?:[-–—]|to)\s*((?:19|20)\d{2}|present|current)/i);
    const withoutDates = line.replace(dateMatch?.[0] ?? '', '').replace(/\s{2,}/g, ' ').trim();
    const degree = parts.find((value) => /\b(b\.?\s?(?:sc|a|eng)|m\.?\s?(?:sc|a|ba)|ph\.?d|mba|diploma|certificate|associate|bachelor|master)\b/i.test(value)) ?? '';
    const institution = parts.find((value) => value !== degree && /\b(university|college|school|institute|academy|polytechnic)\b/i.test(value)) ?? parts.find((value) => value !== degree) ?? '';
    if (!institution && !degree) continue;
    entries.push({ institution, degree, field: '', startDate: dateMatch?.[1] ?? '', endDate: dateMatch?.[2] ?? '', description: withoutDates === institution || withoutDates === degree ? '' : withoutDates });
  }
  return entries.slice(0, 10);
}
function inferTechnicalSkills(rawText: string) {
  const found = TECHNICAL_SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(rawText));
  return [...new Set(found.map((skill) => skill.replace(/^./, (letter) => letter.toUpperCase())))].map((name) => ({ name, level: 'Intermediate' as const }));
}
function inferDraftFromText(rawText: string): ResumeImportDraft {
  const draft = emptyDraft();
  const lines = rawText.replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
  const joined = lines.join('\n');
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const linkedIn = joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|]+/i)?.[0] ?? '';
  const website = [...joined.matchAll(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s|]*)?/gi)].map((match) => match[0]).find((value) => !value.toLowerCase().includes('linkedin.com')) ?? '';
  const phone = joined.match(/(?:\+?\d[\d().\s-]{7,}\d)/)?.[0] ?? '';
  const fullName = lines.find((line) => line.length >= 3 && line.length <= 80 && !/@/.test(line) && !/https?:\/\//i.test(line) && !isHeading(line, ['experience', 'education', 'skills', 'languages', 'summary'])) ?? '';
  draft.personalInfo = { fullName, email, phone: phone.replace(/\s+/g, ' ').trim(), location: '', linkedin: linkedIn, website, summary: '' };
  const sections: Record<string, string[]> = { experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], summary: [] };
  let current = '';
  for (const line of lines) {
    if (isSectionTerminator(line)) { current = ''; continue; }
    const inline = inlineSectionContent(line);
    if (inline.section) {
      current = inline.section;
      sections[current].push(inline.content);
    }
    else {
      const heading = sectionHeading(line);
      if (heading) current = heading;
      else if (current) sections[current].push(line);
    }
  }
  draft.personalInfo.summary = sections.summary.join(' ').slice(0, 1200);
  if (!draft.personalInfo.summary) {
    const firstMainSection = lines.findIndex((line) => ['experience', 'projects', 'education', 'skills', 'languages', 'certificates'].includes(sectionHeading(line) || inlineSectionContent(line).section));
    const openingNarrative = lines.slice(0, firstMainSection < 0 ? 12 : firstMainSection).filter((line) => line.length >= 100 && !/@/.test(line) && !/https?:\/\//i.test(line));
    draft.personalInfo.summary = openingNarrative.join(' ').slice(0, 1200);
  }
  draft.skills = [...new Set(splitSectionItems(sections.skills).flatMap((value) => value.split(/[,;]/)).map((value) => value.trim()).filter((value) => value.length >= 2 && value.length <= 80))].slice(0, 40).map((name) => ({ name, level: 'Intermediate' }));
  if (!draft.skills.length) draft.skills = inferTechnicalSkills(rawText).slice(0, 40);
  draft.languages = parseLanguages(sections.languages);
  draft.certificates = parseCertificates(sections.certificates);
  draft.education = parseEducation(sections.education);
  draft.warnings.push('Personal details, summary, education, skills, languages, and certificates are extracted directly from text. AI is structuring detailed work history and projects.');
  return draft;
}
function compactTextForAi(rawText: string) {
  const compactLines: string[] = [];
  let previous = '';
  for (const line of rawText.replace(/\r/g, '').split('\n').map((item) => item.trim()).filter(Boolean)) {
    if (line === previous) continue;
    previous = line;
    compactLines.push(line.slice(0, 500));
    if (compactLines.join('\n').length >= 8_000) break;
  }
  return compactLines.join('\n').slice(0, 8_000);
}
type StreamRecordType = 'personalInfo' | 'experience' | 'projects' | 'education' | 'skills' | 'languages' | 'certificates' | 'warning';
type StreamRecord = { type?: StreamRecordType; item?: unknown; message?: unknown };
const streamSections: Exclude<StreamRecordType, 'personalInfo' | 'warning'>[] = ['experience', 'projects', 'education', 'skills', 'languages', 'certificates'];
function normalizedKey(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ''); }
function canonicalizeStreamItem(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const aliases: Record<string, string> = {
    company: 'company', employer: 'company', organization: 'company', jobtitle: 'position', position: 'position', role: 'position', title: 'title',
    startdate: 'startDate', start: 'startDate', from: 'startDate', enddate: 'endDate', end: 'endDate', to: 'endDate',
    description: 'description', summary: 'summary', descriptionbullets: 'descriptionBullets', bullets: 'bullets', highlights: 'highlights', responsibilities: 'responsibilities', achievements: 'achievements',
    name: 'name', project: 'project', projectname: 'projectName', completiondate: 'completionDate', technologies: 'technologies', techstack: 'techStack', stack: 'stack', link: 'link', url: 'url', github: 'github',
    institution: 'institution', university: 'university', school: 'school', degree: 'degree', qualification: 'qualification', field: 'field', major: 'major', specialization: 'specialization',
    skill: 'skill', level: 'level', language: 'language', proficiency: 'proficiency', certificate: 'certificate', credential: 'credential', issuer: 'issuer', issuedate: 'issueDate', date: 'date',
  };
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>((result, [key, item]) => {
    result[aliases[normalizedKey(key)] ?? key] = item;
    return result;
  }, {});
}
function inferStreamRecordType(value: Record<string, unknown>): StreamRecordType | undefined {
  if ('company' in value || 'position' in value || 'jobTitle' in value || 'employer' in value) return 'experience';
  if ('institution' in value || 'degree' in value || 'field' in value || 'university' in value) return 'education';
  if ('technologies' in value || 'completionDate' in value || 'projectName' in value || ('link' in value && ('description' in value || 'descriptionBullets' in value))) return 'projects';
  if ('proficiency' in value || 'language' in value) return 'languages';
  if ('issuer' in value || 'credential' in value || 'certificate' in value) return 'certificates';
  if ('level' in value || 'skill' in value) return 'skills';
  return undefined;
}
function isWorkExperienceItem(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = canonicalizeStreamItem(value) as Record<string, unknown>;
  return WORK_TITLE_PATTERN.test([row.position, row.jobTitle, row.role, row.title, row.name, row.projectName].map((item) => text(item, 180)).join(' '));
}
function normalizeStreamRecord(value: unknown): StreamRecord[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const raw = value as Record<string, unknown>;
  const row = canonicalizeStreamItem(raw) as Record<string, unknown>;
  const declaredType = text(raw.type ?? raw.section ?? raw.category, 40).toLowerCase().replace(/[^a-z]/g, '');
  const typeAliases: Record<string, StreamRecordType> = { experience: 'experience', workexperience: 'experience', workhistory: 'experience', employment: 'experience', project: 'projects', projects: 'projects', education: 'education', skill: 'skills', skills: 'skills', language: 'languages', languages: 'languages', certificate: 'certificates', certificates: 'certificates', certification: 'certificates', certifications: 'certificates' };
  if (typeAliases[declaredType]) {
    const item = canonicalizeStreamItem(raw.item ?? raw.data ?? raw);
    return [{ type: typeAliases[declaredType] === 'projects' && isWorkExperienceItem(item) ? 'experience' : typeAliases[declaredType], item }];
  }
  const wrapped = streamSections.flatMap((section) => {
    const wrapperAliases = section === 'experience' ? ['experience', 'workexperience', 'workhistory', 'employment'] : section === 'projects' ? ['projects', 'project'] : section === 'certificates' ? ['certificates', 'certificate', 'certifications', 'certification'] : [section];
    const items = Object.entries(raw).find(([key]) => wrapperAliases.includes(normalizedKey(key)))?.[1];
    return Array.isArray(items)
      ? items.map((item) => { const normalized = canonicalizeStreamItem(item); return { type: section === 'projects' && isWorkExperienceItem(normalized) ? 'experience' : section, item: normalized }; })
      : items && typeof items === 'object'
        ? (() => { const normalized = canonicalizeStreamItem(items); return [{ type: section === 'projects' && isWorkExperienceItem(normalized) ? 'experience' : section, item: normalized }]; })()
        : [];
  });
  if (wrapped.length) return wrapped;
  const type = inferStreamRecordType(row);
  return type ? [{ type: type === 'projects' && isWorkExperienceItem(row) ? 'experience' : type, item: row }] : [];
}
function recordKey(type: Exclude<StreamRecordType, 'personalInfo' | 'warning'>, item: Record<string, unknown>) {
  if (type === 'experience') return [item.company, item.position, item.startDate, item.endDate].map(String).join('|').toLowerCase();
  if (type === 'projects') return [item.name, item.completionDate, item.link].map(String).join('|').toLowerCase();
  if (type === 'education') return [item.institution, item.degree, item.startDate, item.endDate].map(String).join('|').toLowerCase();
  if (type === 'skills' || type === 'languages') return String(item.name ?? '').toLowerCase();
  return [item.name, item.issuer, item.date].map(String).join('|').toLowerCase();
}
function applyStreamRecord(draft: ResumeImportDraft, record: StreamRecord) {
  if (!record.type) return false;
  if (record.type === 'warning') {
    const warning = text(record.message, 240);
    if (!warning || draft.warnings.includes(warning)) return false;
    draft.warnings = [...draft.warnings, warning].slice(0, 8);
    return true;
  }
  if (record.type === 'personalInfo') {
    const partial = sanitizeDraft({ personalInfo: record.item }).personalInfo;
    const populated = Object.fromEntries(Object.entries(partial).filter(([, value]) => Boolean(value)));
    if (!Object.keys(populated).length) return false;
    const changed = Object.entries(populated).some(([key, value]) => draft.personalInfo[key as keyof typeof draft.personalInfo] !== value);
    draft.personalInfo = { ...draft.personalInfo, ...populated };
    return changed;
  }
  const section = record.type as Exclude<StreamRecordType, 'personalInfo' | 'warning'>;
  const parsed = sanitizeDraft({ [section]: [record.item] })[section];
  const item = parsed[0];
  if (!item) return false;
  const key = recordKey(section, item as Record<string, unknown>);
  if (!key || draft[section].some((existing) => recordKey(section, existing as Record<string, unknown>) === key)) return false;
  draft[section] = [...draft[section], item] as never;
  return true;
}
function takeCompleteStreamRecords(buffer: string) {
  const records: StreamRecord[] = [];
  let start = -1; let depth = 0; let inString = false; let escaped = false; let consumed = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const character = buffer[index];
    if (start < 0) { if (character === '{') { start = index; depth = 1; } else consumed = index + 1; continue; }
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') { inString = true; continue; }
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) {
      try { records.push(...normalizeStreamRecord(JSON.parse(buffer.slice(start, index + 1)))); } catch { /* Ignore an invalid model record and continue. */ }
      consumed = index + 1; start = -1;
    }
  }
  return { records, remainder: start >= 0 ? buffer.slice(start) : buffer.slice(consumed) };
}
async function streamDraftWithAi(extractedText: string, onRecord: (record: StreamRecord) => boolean) {
  if (aiRefinementInFlight) throw new Error('AI cleanup is already processing another résumé. Your quick preview is ready; retry this import after that cleanup finishes.');
  aiRefinementInFlight = true;
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434'}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(285_000),
      body: JSON.stringify({ model: process.env.OLLAMA_RESUME_MODEL ?? 'qwen2.5:1.5b', stream: true, think: false, options: { temperature: 0, num_ctx: 8192, num_predict: 1350 }, messages: [
        { role: 'system', content: 'Extract only work experience and projects. JSON objects only. Every object MUST include type: "experience" or "projects". Experience: {"type":"experience","item":{"company":"","position":"","startDate":"","endDate":"","descriptionBullets":[]}}. Project: {"type":"projects","item":{"name":"","completionDate":"","technologies":"","link":"","descriptionBullets":[]}}. One object per source entry. Use projects only for explicitly named project/portfolio entries; never classify a project as experience. Split each paragraph into 2–5 short factual bullets. Do not invent facts.' },
        { role: 'user', content: compactTextForAi(extractedText) },
      ] }),
    });
    if (!response.ok) throw new Error('The local résumé model is unavailable.');
    if (!response.body) throw new Error('The local résumé model did not return a stream.');
    const reader = response.body.getReader(); const decoder = new TextDecoder();
    let ollamaBuffer = ''; let recordBuffer = ''; let records = 0; let appliedRecords = 0;
    const receivedTypes: Record<string, number> = {};
    const processContent = (content: string) => {
      recordBuffer += content;
      const extracted = takeCompleteStreamRecords(recordBuffer);
      recordBuffer = extracted.remainder;
      for (const record of extracted.records) { records += 1; if (record.type) receivedTypes[record.type] = (receivedTypes[record.type] ?? 0) + 1; if (onRecord(record)) appliedRecords += 1; }
    };
    while (true) {
      const { value, done } = await reader.read();
      ollamaBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const lines = ollamaBuffer.split('\n'); ollamaBuffer = lines.pop() ?? '';
      for (const line of lines) {
        try { const chunk = JSON.parse(line) as { message?: { content?: string } }; if (chunk.message?.content) processContent(chunk.message.content); } catch { /* Ignore malformed transport chunks. */ }
      }
      if (done) break;
    }
    if (ollamaBuffer.trim()) { try { const chunk = JSON.parse(ollamaBuffer) as { message?: { content?: string } }; if (chunk.message?.content) processContent(chunk.message.content); } catch { /* Ignore malformed final transport chunk. */ } }
    const finalRecords = takeCompleteStreamRecords(recordBuffer).records;
    for (const record of finalRecords) { records += 1; if (record.type) receivedTypes[record.type] = (receivedTypes[record.type] ?? 0) + 1; if (onRecord(record)) appliedRecords += 1; }
    console.info(`[resume-import] AI records received=${records} applied=${appliedRecords} types=${JSON.stringify(receivedTypes)}`);
    if (!records) throw new Error('The local résumé model did not return readable structured details.');
  } finally {
    aiRefinementInFlight = false;
  }
}

type EmbeddedPdfImage = { page: number; index: number; width: number; height: number };
function findEmbeddedPdfImages(output: string) {
  return output.split('\n').flatMap((line): EmbeddedPdfImage[] => {
    const columns = line.trim().split(/\s+/); const width = Number(columns[3]); const height = Number(columns[4]);
    return /^\d+$/.test(columns[0] ?? '') && /^\d+$/.test(columns[1] ?? '') && Number.isFinite(width) && Number.isFinite(height) ? [{ page: Number(columns[0]), index: Number(columns[1]), width, height }] : [];
  });
}
async function extractEmbeddedProfilePhoto(pdfPath: string, workspace: string) {
  const prefix = join(workspace, 'embedded-image');
  const { stdout } = await execFileAsync('pdfimages', ['-list', pdfPath], { timeout: 12_000, maxBuffer: 1024 * 1024 });
  const candidate = findEmbeddedPdfImages(stdout).filter(({ page, width, height }) => { const ratio = width / height; return page === 1 && width >= 100 && height >= 100 && width * height >= 20_000 && ratio >= 0.55 && ratio <= 1.5; }).sort((a, b) => (b.width * b.height) - (a.width * a.height))[0];
  if (!candidate) return '';
  await execFileAsync('pdfimages', ['-f', '1', '-l', '1', '-png', pdfPath, prefix], { timeout: 20_000, maxBuffer: 1024 * 1024 });
  const files = (await readdir(workspace)).filter((name) => /^embedded-image-\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const position = findEmbeddedPdfImages(stdout).filter((image) => image.page === 1).findIndex((image) => image.index === candidate.index);
  const fileName = files[position]; if (!fileName) return '';
  const imagePath = join(workspace, fileName); const info = await stat(imagePath);
  return info.size > 0 && info.size <= MAX_IMPORTED_PHOTO_BYTES ? `data:image/png;base64,${(await readFile(imagePath)).toString('base64')}` : '';
}
async function ocrImage(path: string) { const { stdout } = await execFileAsync('tesseract', [path, 'stdout', '--oem', '1', '--psm', '3', '-l', 'eng'], { timeout: 60_000, maxBuffer: 2_000_000 }); return stdout; }
async function extractDocument(path: string, type: string, workspace: string, progress: (message: string) => void) {
  if (type !== 'application/pdf') { progress('Scanning the image with OCR…'); return ocrImage(path); }
  progress('Extracting text from the PDF…');
  const { stdout } = await execFileAsync('pdftotext', ['-layout', path, '-'], { timeout: 30_000, maxBuffer: 2_000_000 });
  if (stdout.replace(/\s/g, '').length >= 100) return stdout;
  progress('This looks like a scanned PDF. Preparing OCR…');
  const prefix = join(workspace, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '150', '-f', '1', '-l', String(MAX_PDF_PAGES), path, prefix], { timeout: 60_000 });
  const pages: string[] = [];
  for (let index = 1; index <= MAX_PDF_PAGES; index += 1) {
    progress(`Reading scanned page ${index} of ${MAX_PDF_PAGES}…`);
    try { const page = await ocrImage(`${prefix}-${index}.png`); if (page.trim()) pages.push(page); if (pages.join('').replace(/\s/g, '').length >= 1_500) break; } catch { /* Continue with the remaining pages. */ }
  }
  return pages.join('\n\n--- Page break ---\n\n');
}

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return Response.json({ message: 'Upload a PDF, PNG, or JPEG file.' }, { status: 400 }); }
  const file = formData.get('file');
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ message: 'Upload a PDF, PNG, or JPEG no larger than 10 MB.' }, { status: 400 });
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ImportEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const startedAt = performance.now();
      const logStage = (stage: string) => console.info(`[resume-import] ${stage}: ${Math.round(performance.now() - startedAt)}ms`);
      let workspace = '';
      try {
        emit({ type: 'progress', message: 'Saving your file securely for processing…' });
        workspace = await mkdtemp(join(tmpdir(), 'resume-import-')); await mkdir(workspace, { recursive: true });
        const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg';
        const sourcePath = join(workspace, `source.${extension}`); await writeFile(sourcePath, Buffer.from(await file.arrayBuffer()));
        logStage('upload write');
        const extractedText = (await extractDocument(sourcePath, file.type, workspace, (message) => emit({ type: 'progress', message }))).trim();
        logStage('text extraction');
        if (extractedText.length < 30) throw new Error('No readable résumé text was found in this file.');
        emit({ type: 'progress', message: 'Building a quick preview from the extracted text…' });
        let draft = inferDraftFromText(extractedText); logStage('deterministic draft'); emit({ type: 'draft', draft, source: 'extracted' });
        emit({ type: 'progress', message: 'Your preview is ready. Reading résumé records with local AI…' });
        let streamedRecords = 0;
        const aiDraftPromise = streamDraftWithAi(extractedText, (record) => {
          if (!applyStreamRecord(draft, record)) return false;
          streamedRecords += 1;
          const label = record.type === 'projects' ? 'project' : record.type === 'skills' ? 'skill' : record.type === 'languages' ? 'language' : record.type === 'certificates' ? 'certificate' : record.type === 'personalInfo' ? 'personal details' : record.type ?? 'detail';
          emit({ type: 'progress', message: `Detected ${label}${record.type === 'personalInfo' ? '' : ` ${streamedRecords}`}…` });
          emit({ type: 'draft', draft: { ...draft }, source: 'ai-partial' });
          return true;
        });
        try {
          await aiDraftPromise;
          logStage('AI normalization and sanitization');
          emit({ type: 'draft', draft, source: 'ai' });
          emit({ type: 'complete', message: `AI cleanup is complete. ${streamedRecords} structured detail${streamedRecords === 1 ? '' : 's'} arrived progressively for review.` });
        }
        catch (error) { const message = error instanceof Error ? error.message : 'AI cleanup could not finish.'; emit({ type: 'warning', message: `${message} The quick extraction remains available to review.` }); emit({ type: 'complete', message: 'Quick extraction is ready to review.' }); }
        if (file.type === 'application/pdf') {
          emit({ type: 'progress', message: 'Text import is complete. Looking for an embedded profile photo…' });
          try {
            const photoDataUrl = await extractEmbeddedProfilePhoto(sourcePath, workspace);
            logStage('photo extraction');
            if (photoDataUrl) {
              draft = { ...draft, photoDataUrl };
              emit({ type: 'progress', message: 'Profile photo downloaded and ready to review.' });
              emit({ type: 'draft', draft, source: 'photo' });
            } else emit({ type: 'progress', message: 'No embedded profile photo was found.' });
          } catch {
            logStage('photo extraction unavailable');
            emit({ type: 'progress', message: 'Profile photo could not be extracted.' });
          }
        }
      } catch (error) { emit({ type: 'error', message: error instanceof Error ? error.message : 'Unable to import this résumé right now.' }); }
      finally { if (workspace) await rm(workspace, { recursive: true, force: true }); logStage('complete'); controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
}