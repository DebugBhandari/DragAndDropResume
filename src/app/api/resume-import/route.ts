import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ResumeImportDraft } from '@/types/resume';
import { type LastImportTiming, writeLastImportTiming } from '@/utils/importTiming';

export const runtime = 'nodejs';
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const encoder = new TextEncoder();
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_IMPORTED_PHOTO_BYTES = 1_000_000;
const ALLOWED_TYPES = new Set(['application/pdf']);
const DOCLING_BIN = process.env.DOCLING_BIN ?? 'docling';
let aiRefinementInFlight = false;

type ImportEvent =
  | { type: 'progress'; message: string }
  | { type: 'stage'; stage: 'upload' | 'docling' | 'parsing' | 'ollama' | 'finalizing'; detail: string }
  | { type: 'draft'; draft: ResumeImportDraft; source: 'extracted' | 'ai-partial' | 'ai' | 'photo' }
  | { type: 'complete'; message: string }
  | { type: 'warning'; message: string }
  | { type: 'error'; message: string };

async function withStageHeartbeat<T>(stage: Extract<ImportEvent, { type: 'stage' }>['stage'], detail: string, run: () => Promise<T>, emitStage: (stage: Extract<ImportEvent, { type: 'stage' }>['stage'], detail: string) => void) {
  const startedAt = Date.now();
  emitStage(stage, detail);
  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1_000);
    emitStage(stage, `${detail} Still working (${elapsedSeconds}s elapsed)…`);
  }, 5_000);
  try {
    return await run();
  } finally {
    clearInterval(heartbeat);
  }
}

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
function normalizeDoclingMarkdown(markdown: string) {
  return markdown
    .replace(/!\[[^\]]*\]\(data:image\/[^;\s)]+;base64,[\s\S]*?\)/gi, '')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, '$1')
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/, '- ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\r/g, '');
}
const URL_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com\/[a-z0-9_./%-]+|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[a-z0-9_./?&=%#~-]*)?)/gi;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g;
function cleanUrl(value: string) {
  return value.trim().replace(/^[<(\[]+|[)>\],.;:]+$/g, '').replace(/^www\./i, 'https://www.').replace(/^(?!https?:\/\/)/i, 'https://');
}
function isPrimaryResumeSection(line: string) {
  return ['experience', 'projects', 'education', 'skills', 'languages', 'certificates'].includes(sectionHeading(line) || inlineSectionContent(line).section);
}
function headerLines(lines: string[]) {
  const firstPrimarySection = lines.findIndex(isPrimaryResumeSection);
  return lines.slice(0, firstPrimarySection < 0 ? Math.min(lines.length, 20) : firstPrimarySection);
}
function firstMatch(lines: string[], pattern: RegExp) {
  for (const line of lines) {
    pattern.lastIndex = 0;
    const match = pattern.exec(line);
    if (match?.[0]) return match[0];
  }
  return '';
}
function normalizePhone(value: string) {
  const candidate = value.replace(/[^+\d().\s-]/g, '').replace(/\s+/g, ' ').trim();
  return candidate.replace(/\d/g, '').includes('+') && !candidate.startsWith('+') ? candidate.replace('+', '') : candidate;
}
function extractHeaderContact(lines: string[]) {
  const header = headerLines(lines);
  const headerText = header.join('\n');
  const email = firstMatch(header, /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const urls = [...headerText.matchAll(URL_PATTERN)]
    .filter((match) => match.index === 0 || headerText[match.index - 1] !== '@')
    .map((match) => cleanUrl(match[0]));
  const linkedIn = urls.find((url) => /^https?:\/\/(?:www\.)?linkedin\.com\//i.test(url)) ?? '';
  const website = urls.find((url) => !/^https?:\/\/(?:www\.)?linkedin\.com\//i.test(url)) ?? '';
  const labelledPhone = firstMatch(header, /(?:phone|mobile|tel(?:ephone)?|cell)\s*[:|-]?\s*(\+?[\d().\s-]{7,}\d)/i).replace(/^(?:phone|mobile|tel(?:ephone)?|cell)\s*[:|-]?\s*/i, '');
  const phone = normalizePhone(labelledPhone || firstMatch(header, PHONE_PATTERN));
  const labelledLocation = firstMatch(header, /(?:location|address|based\s+in)\s*[:|-]?\s*([^|•·▪◦\n]{2,120})/i).replace(/^(?:location|address|based\s+in)\s*[:|-]?\s*/i, '').trim();
  const contactFragments = header.flatMap((line) => line.split(/[|•·▪◦]/).map((fragment) => fragment.trim()));
  const inferredLocation = contactFragments.find((fragment) => {
    const candidate = fragment.replace(/^(?:location|address|based\s+in)\s*[:|-]?\s*/i, '').trim();
    PHONE_PATTERN.lastIndex = 0;
    return candidate.length >= 3
      && candidate.length <= 100
      && /[A-Za-z]/.test(candidate)
      && !/@|https?:\/\/|www\.|linkedin\.com/i.test(candidate)
      && !PHONE_PATTERN.test(candidate)
      && /(?:,|\b(?:city|state|province|country|remote|hybrid)\b)/i.test(candidate);
  })?.replace(/^(?:location|address|based\s+in)\s*[:|-]?\s*/i, '').trim() ?? '';
  const location = labelledLocation || inferredLocation;
  return { email, phone, location, linkedin: linkedIn, website };
}
function isContactLine(value: string) {
  PHONE_PATTERN.lastIndex = 0;
  return /@|https?:\/\/|www\.|linkedin\.com|\b(?:phone|mobile|tel(?:ephone)?|cell|location|address|based\s+in)\b/i.test(value) || PHONE_PATTERN.test(value);
}
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
function skillNames(lines: string[]) {
  return [...new Set(
    splitSectionItems(lines)
      .flatMap((value) => value.replace(/^\s*(?:tools?|technologies|tech(?:nology)?\s*stack|frameworks?|libraries|platforms?|databases?)\s*:\s*/i, '').split(/[,;|]/))
      .map((value) => value.replace(/^[-–—*]\s*/, '').replace(/\s+\([^)]{1,30}\)$/, '').trim())
      .filter((value) => value.length >= 2 && value.length <= 80)
      .filter((value) => !/^(?:tools?|technologies|tech(?:nology)?\s*stack|frameworks?|libraries|platforms?|databases?)$/i.test(value)),
  )].slice(0, 40).map((name) => ({ name, level: 'Intermediate' as const }));
}
const KNOWN_LANGUAGES = new Set(['afrikaans', 'albanian', 'amharic', 'arabic', 'armenian', 'azerbaijani', 'bengali', 'bosnian', 'bulgarian', 'burmese', 'cantonese', 'catalan', 'chinese', 'croatian', 'czech', 'danish', 'dari', 'dutch', 'english', 'estonian', 'farsi', 'filipino', 'finnish', 'french', 'georgian', 'german', 'greek', 'gujarati', 'hebrew', 'hindi', 'hungarian', 'icelandic', 'indonesian', 'italian', 'japanese', 'kannada', 'kazakh', 'khmer', 'korean', 'kurdish', 'lao', 'latvian', 'lithuanian', 'malay', 'malayalam', 'mandarin', 'marathi', 'mongolian', 'nepali', 'norwegian', 'oriya', 'pashto', 'persian', 'polish', 'portuguese', 'punjabi', 'romanian', 'russian', 'serbian', 'sinhala', 'slovak', 'slovenian', 'somali', 'spanish', 'swahili', 'swedish', 'tagalog', 'tamil', 'telugu', 'thai', 'tigrinya', 'turkish', 'ukrainian', 'urdu', 'uzbek', 'vietnamese', 'welsh', 'yoruba', 'zulu']);
const WORK_TITLE_PATTERN = /\b(?:engineer(?:ing)?|developer|intern(?:ship)?|cashier|architect|designer|manager|director|consultant|analyst|administrator|specialist|coordinator|assistant|associate|officer|representative|technician|researcher|teacher|instructor|supervisor|lead|founder|owner|operator|attendant|clerk|salesperson|bartender|barista|waiter|waitress|chef|cook|driver|mechanic|nurse|accountant|recruiter|marketer|editor|writer|full\s*stack|frontend|front\s*end|backend|back\s*end|software|web|mobile|data\s+scientist)\b/i;
const QUALIFICATION_PATTERN = /\b(?:b\.?\s?(?:sc|a|eng|tech|com)|m\.?\s?(?:sc|a|eng|tech|com)|ph\.?d|mba|diploma|associate(?:'s)?|bachelor(?:'s)?|master(?:'s)?|doctorate|postgraduate|undergraduate|higher\s+national\s+diploma|qualification)\b/i;
const DATE_VALUE_PATTERN = '(?:(?:0?[1-9]|1[0-2])\s*\/\s*)?(?:19|20)\d{2}|present|current';
const DATE_RANGE_PATTERN = new RegExp(`(${DATE_VALUE_PATTERN})\\s*(?:[-–—]|to)\\s*(${DATE_VALUE_PATTERN})`, 'i');
const TECHNICAL_SKILLS = ['AWS', 'Azure', 'C#', 'C++', 'CSS', 'Docker', 'Figma', 'Firebase', 'Git', 'GitHub', 'GraphQL', 'HTML', 'Java', 'JavaScript', 'Jenkins', 'Kotlin', 'Kubernetes', 'MongoDB', 'MySQL', 'Next.js', 'Node.js', 'OpenAI', 'PHP', 'PostgreSQL', 'Python', 'React', 'Redux', 'Ruby', 'Rust', 'SQL', 'Swift', 'Tailwind CSS', 'TensorFlow', 'TypeScript', 'Vue.js'];
function isBulletLine(value: string) { return /^[•·▪◦*\-–—]\s+/.test(value.trim()); }
function isTitleLike(value: string) {
  const line = value.trim();
  const words = line.split(/\s+/).filter(Boolean);
  return line.length >= 2 && line.length <= 160 && words.length <= 18 && !isBulletLine(line) && !/[.!?]$/.test(line) && !/^https?:\/\//i.test(line);
}
function isSubheading(value: string) {
  if (!isTitleLike(value)) return false;
  if (/[|]|\s+[–—]\s+|\s+-\s+/.test(value)) return true;
  const words = value.match(/[A-Za-z][A-Za-z'.-]*/g) ?? [];
  if (!words.length || words.length > 12) return false;
  const titleWords = words.filter((word) => /^(?:[A-Z]{2,}|[A-Z][a-z]|[A-Z][A-Z'.-]*)$/.test(word));
  return titleWords.length / words.length >= 0.6;
}
function dateRange(value: string) {
  const match = value.match(DATE_RANGE_PATTERN);
  return { startDate: match?.[1] ?? '', endDate: match?.[2] ?? '' };
}
function descriptionLines(lines: string[]) {
  return lines.filter((line) => isBulletLine(line) || (!isTitleLike(line) && line.length >= 20)).map((line) => line.replace(/^[•·▪◦*\-–—]\s*/, '').trim()).filter(Boolean).slice(0, 8);
}
function titleParts(value: string) { return value.split(/\s*[|]\s*|\s+[–—]\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean); }
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
  const provider = (name: string) => /\baws\b/i.test(name) ? 'Amazon Web Services (AWS)' : /\bkaggle\b/i.test(name) ? 'Kaggle' : /\bintegrify\b/i.test(name) ? 'Integrify' : /\bgoogle\b/i.test(name) ? 'Google' : /\bmicrosoft\b/i.test(name) ? 'Microsoft' : /\bcoursera\b/i.test(name) ? 'Coursera' : '';
  const cleaned = lines.map((line) => line.trim()).filter(Boolean).filter((value) => !/^(achievements?(?:\s*\/\s*tasks?)?|tasks?|contact|references?)$/i.test(value));
  const certificates: Array<{ name: string; issuer: string; date: string; link: string }> = [];
  for (let index = 0; index < cleaned.length; index += 1) {
    const value = cleaned[index];
    const date = value.match(/\(([^)]*(?:19|20)\d{2}[^)]*)\)/)?.[1] ?? '';
    if (!date) continue;
    const dateOnly = /^\([^)]*(?:19|20)\d{2}[^)]*\)$/.test(value);
    const withoutDate = (dateOnly ? cleaned[index - 1] : value).replace(/\s*\([^)]*(?:19|20)\d{2}[^)]*\)\s*/, '').trim();
    if (!withoutDate || /^contact\s*:/i.test(withoutDate) || isBulletLine(withoutDate)) continue;
    const previous = cleaned[index - (dateOnly ? 2 : 1)] ?? '';
    const previousLooksLikeIssuer = previous.length <= 100 && !previous.match(/\((?:[^)]*(?:19|20)\d{2}[^)]*)\)/) && /(?:kaggle|coursera|udemy|edx|pluralsight|linkedin learning|academy|courses?)\b/i.test(previous);
    const commaIssuer = withoutDate.match(/^(.+?),\s*([^,]{2,80})$/);
    const issuerMatch = withoutDate.match(/^(.*?)\s+(?:[-–—|]|by|from)\s+(.+)$/i);
    certificates.push({
      name: (issuerMatch?.[1] ?? commaIssuer?.[1] ?? withoutDate).trim(),
      issuer: (previousLooksLikeIssuer ? previous : issuerMatch?.[2] ?? commaIssuer?.[2] ?? provider(withoutDate)).trim(),
      date,
      link: '',
    });
  }
  return certificates.filter((item) => item.name).filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index).slice(0, 20);
}
function inlineSectionContent(line: string) {
  const match = line.match(/^(.{2,80}?)[\s:–—-]+(.{2,})$/);
  if (!match) return { section: '', content: '' };
  const section = sectionHeading(match[1]);
  return { section, content: section ? match[2].trim() : '' };
}
function parseEducation(lines: string[]) {
  const entries: Array<{ institution: string; degree: string; field: string; startDate: string; endDate: string; description: string }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!QUALIFICATION_PATTERN.test(line)) continue;
    const context = [lines[index - 1], line, lines[index + 1]].filter(Boolean).map((value) => value.trim()).filter((value) => isTitleLike(value) || DATE_RANGE_PATTERN.test(value));
    const combined = context.join(' | ');
    const parts = titleParts(combined);
    const degree = parts.find((value) => QUALIFICATION_PATTERN.test(value)) ?? line;
    const institution = parts.find((value) => value !== degree && /\b(university|college|school|institute|academy|polytechnic)\b/i.test(value)) ?? parts.find((value) => value !== degree && !DATE_RANGE_PATTERN.test(value)) ?? '';
    const dates = dateRange(combined);
    entries.push({ institution, degree, field: '', ...dates, description: '' });
  }
  return entries.filter((item, index, items) => items.findIndex((candidate) => `${candidate.institution}|${candidate.degree}`.toLowerCase() === `${item.institution}|${item.degree}`.toLowerCase()) === index).slice(0, 10);
}
function parseExperience(lines: string[]) {
  const entries: Array<{ company: string; position: string; startDate: string; endDate: string; description: string; descriptionBullets: string[] }> = [];
  const roleIndexes = lines.map((line, index) => isSubheading(line) && WORK_TITLE_PATTERN.test(line) && !QUALIFICATION_PATTERN.test(line) ? index : -1).filter((index) => index >= 0);
  for (let roleIndex = 0; roleIndex < roleIndexes.length; roleIndex += 1) {
    const start = roleIndexes[roleIndex]; const end = roleIndexes[roleIndex + 1] ?? lines.length;
    const titleLine = lines[start]; const parts = titleParts(titleLine);
    const inlineRoleCompany = titleLine.match(/^(.+?\b(?:engineer(?:ing)?|developer|intern(?:ship)?|architect|designer|manager|director|consultant|analyst|administrator|specialist|coordinator|assistant|associate|officer|representative|technician|researcher|teacher|instructor|supervisor|lead|founder|owner|operator|accountant|recruiter|marketer|editor|writer)\b)\s+(.+)$/i);
    const position = (parts.length > 1 ? parts.find((part) => WORK_TITLE_PATTERN.test(part)) : '') || inlineRoleCompany?.[1].trim() || titleLine;
    const before = lines.slice(Math.max(0, start - 2), start).reverse().find((line) => isSubheading(line) && !WORK_TITLE_PATTERN.test(line) && !QUALIFICATION_PATTERN.test(line) && !DATE_RANGE_PATTERN.test(line));
    const after = lines.slice(start + 1, Math.min(end, start + 3)).find((line) => isSubheading(line) && !WORK_TITLE_PATTERN.test(line) && !QUALIFICATION_PATTERN.test(line) && !DATE_RANGE_PATTERN.test(line));
    const company = parts.find((part) => part !== position && !DATE_RANGE_PATTERN.test(part)) ?? inlineRoleCompany?.[2].trim() ?? before ?? after ?? '';
    const dates = dateRange(lines.slice(start, end).join(' '));
    const bullets = descriptionLines(lines.slice(start + 1, end));
    entries.push({ company, position, ...dates, description: '', descriptionBullets: bullets.filter((line) => line.length > 2) });
  }
  return entries.filter((item, index, items) => item.position && items.findIndex((candidate) => `${candidate.company}|${candidate.position}|${candidate.startDate}`.toLowerCase() === `${item.company}|${item.position}|${item.startDate}`.toLowerCase()) === index).slice(0, 12);
}
function parseProjects(lines: string[]) {
  const entries: Array<{ name: string; description: string; descriptionBullets: string[]; completionDate: string; technologies: string; link: string }> = [];
  const isProjectTitle = (line: string) => {
    const value = line.trim();
    return !WORK_TITLE_PATTERN.test(value)
      && !QUALIFICATION_PATTERN.test(value)
      && !/^(?:technologies|tech(?:nology)? stack|tools|features|responsibilities|achievements?)[:\s]*$/i.test(value)
      && !/^contact\s*:/i.test(value)
      && (isSubheading(value) || /(?:\([^)]+(?:19|20)\d{2}[^)]*\)|\b[a-z0-9-]+\.(?:com|io|dev|app|link|ai|net|org)\b)/i.test(value));
  };
  const titleIndexes = lines.map((line, index) => isProjectTitle(line) ? index : -1).filter((index) => index >= 0);
  for (let titleIndex = 0; titleIndex < titleIndexes.length; titleIndex += 1) {
    const start = titleIndexes[titleIndex]; const end = titleIndexes[titleIndex + 1] ?? lines.length;
    const name = lines[start].trim(); const block = lines.slice(start + 1, end); const bullets = descriptionLines(block);
    const source = block.join(' '); const dates = dateRange(source); const link = source.match(/https?:\/\/[^\s|]+/i)?.[0] ?? '';
    const technologies = block.find((line) => /^(?:technologies|tech(?:nology)? stack|tools)\s*:/i.test(line))?.replace(/^(?:technologies|tech(?:nology)? stack|tools)\s*:/i, '').trim() ?? '';
    if (!bullets.length && !technologies && !link && !dates.startDate && !dates.endDate) continue;
    entries.push({ name, description: '', descriptionBullets: bullets, completionDate: dates.endDate || dates.startDate, technologies, link });
  }
  return entries.filter((item, index, items) => items.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index).slice(0, 12);
}
function inferTechnicalSkills(rawText: string) {
  const found = TECHNICAL_SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(rawText));
  return [...new Set(found.map((skill) => skill.replace(/^./, (letter) => letter.toUpperCase())))].map((name) => ({ name, level: 'Intermediate' as const }));
}
function inferDraftFromText(rawText: string): ResumeImportDraft {
  const draft = emptyDraft();
  const normalizedText = normalizeDoclingMarkdown(rawText);
  const lines = normalizedText.split('\n').map((line) => line.trim()).filter(Boolean);
  const contact = extractHeaderContact(lines);
  const fullName = lines.find((line) => line.length >= 3 && line.length <= 80 && !/\d/.test(line) && !isContactLine(line) && !isHeading(line, ['experience', 'education', 'skills', 'languages', 'summary'])) ?? '';
  draft.personalInfo = { fullName, ...contact, summary: '' };
  const sections: Record<string, string[]> = { experience: [], projects: [], education: [], skills: [], languages: [], certificates: [], summary: [] };
  let current = '';
  for (const line of lines) {
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
    const openingNarrative = lines.slice(0, firstMainSection < 0 ? 12 : firstMainSection).filter((line) => line.length >= 100 && !isContactLine(line));
    draft.personalInfo.summary = openingNarrative.join(' ').slice(0, 1200);
  }
  const toolLines = lines.filter((line) => /^\s*(?:[-*]\s*)?(?:tools?|technologies|tech(?:nology)?\s*stack|frameworks?|libraries|platforms?|databases?)\s*:/i.test(line));
  draft.skills = [...skillNames([...sections.skills, ...toolLines]), ...inferTechnicalSkills(normalizedText)]
    .filter((skill, index, skills) => skills.findIndex((candidate) => candidate.name.toLowerCase() === skill.name.toLowerCase()) === index)
    .slice(0, 40);
  draft.languages = parseLanguages(sections.languages);
  draft.certificates = parseCertificates(sections.certificates);
  draft.education = parseEducation([...sections.education, ...lines.filter((line) => QUALIFICATION_PATTERN.test(line))]);
  draft.experience = parseExperience(sections.experience);
  draft.projects = parseProjects(sections.projects);
  draft.warnings.push('PDF extract uses Docling Markdown, headings, and section detection. Review titles and dates before exporting; AI can provide a second, enhanced option.');
  return draft;
}
function compactTextForAi(rawText: string) {
  const compactLines: string[] = [];
  let previous = '';
  for (const line of normalizeDoclingMarkdown(rawText).split('\n').map((item) => item.trim()).filter(Boolean)) {
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
  const itemText = JSON.stringify(row).replace(/["{}\[\],:_-]+/g, ' ');
  return WORK_TITLE_PATTERN.test(itemText);
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
async function extractDoclingMarkdown(pdfPath: string, workspace: string, progress: (message: string) => void, timings: LastImportTiming['timingsMs']) {
  const outputDirectory = join(workspace, 'docling');
  await mkdir(outputDirectory, { recursive: true });
  progress('Converting the PDF to structured Markdown with Docling…');
  const startedAt = performance.now();
  try {
    await execFileAsync(DOCLING_BIN, ['convert', '--from', 'pdf', '--to', 'md', '--output', outputDirectory, '--no-ocr', pdfPath], { timeout: 120_000, maxBuffer: 2_000_000 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Docling could not convert this PDF.';
    throw new Error(`Docling PDF extraction failed. ${detail}`);
  } finally {
    timings.doclingConversion = Math.round(performance.now() - startedAt);
  }
  const markdownPath = join(outputDirectory, 'source.md');
  try {
    return normalizeDoclingMarkdown(await readFile(markdownPath, 'utf8'));
  } catch {
    const files = (await readdir(outputDirectory)).filter((name) => name.endsWith('.md')).sort();
    if (!files[0]) throw new Error('Docling did not produce Markdown for this PDF.');
    return normalizeDoclingMarkdown(await readFile(join(outputDirectory, files[0]), 'utf8'));
  }
}

export async function POST(request: Request) {
  let formData: FormData;
  try { formData = await request.formData(); } catch { return Response.json({ message: 'Upload a PDF file.' }, { status: 400 }); }
  const file = formData.get('file');
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size === 0 || file.size > MAX_BYTES) return Response.json({ message: 'Upload a PDF no larger than 10 MB.' }, { status: 400 });
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: ImportEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const emitStage = (stage: Extract<ImportEvent, { type: 'stage' }>['stage'], detail: string) => emit({ type: 'stage', stage, detail });
      const startedAt = performance.now();
      const timings: LastImportTiming['timingsMs'] = { uploadWrite: 0, doclingConversion: 0, markdownParsing: 0, ollama: 0, photoExtraction: 0, total: 0 };
      const timing: LastImportTiming = { startedAt: new Date().toISOString(), status: 'running', fileType: file.type, fileSizeBytes: file.size, timingsMs: timings };
      const saveTiming = async (status: LastImportTiming['status'], error?: string) => {
        timings.total = Math.round(performance.now() - startedAt);
        timing.status = status;
        timing.completedAt = status === 'running' ? undefined : new Date().toISOString();
        timing.error = error;
        await writeLastImportTiming(timing);
      };
      let workspace = '';
      try {
        await saveTiming('running');
        emitStage('upload', 'Saving the PDF in the private processing workspace…');
        workspace = await mkdtemp(join(tmpdir(), 'resume-import-')); await mkdir(workspace, { recursive: true });
        const sourcePath = join(workspace, 'source.pdf'); const uploadStartedAt = performance.now(); await writeFile(sourcePath, Buffer.from(await file.arrayBuffer())); timings.uploadWrite = Math.round(performance.now() - uploadStartedAt);
        const photoPromise = (async () => {
          const photoStartedAt = performance.now();
          try { return await extractEmbeddedProfilePhoto(sourcePath, workspace); }
          catch { return ''; }
          finally { timings.photoExtraction = Math.round(performance.now() - photoStartedAt); }
        })();
        const extractedText = (await withStageHeartbeat('docling', 'Docling is converting the PDF into structured Markdown…', () => extractDoclingMarkdown(sourcePath, workspace, () => {}, timings), emitStage)).trim();
        if (extractedText.length < 30) throw new Error('Docling could not find readable résumé content in this PDF.');
        emitStage('parsing', 'TypeScript is detecting sections and building the fast PDF extract…');
        const draftStartedAt = performance.now(); let draft = inferDraftFromText(extractedText); const photoDataUrl = await photoPromise; if (photoDataUrl) draft = { ...draft, photoDataUrl }; timings.markdownParsing = Math.round(performance.now() - draftStartedAt); emit({ type: 'draft', draft, source: 'extracted' });
        emitStage('ollama', 'The PDF extract is ready. Ollama is structuring résumé details in the background…');
        let streamedRecords = 0;
        const aiDraftPromise = withStageHeartbeat('ollama', 'Ollama is reading the Docling Markdown and structuring résumé details…', () => streamDraftWithAi(extractedText, (record) => {
          if (!applyStreamRecord(draft, record)) return false;
          streamedRecords += 1;
          const label = record.type === 'projects' ? 'project' : record.type === 'skills' ? 'skill' : record.type === 'languages' ? 'language' : record.type === 'certificates' ? 'certificate' : record.type === 'personalInfo' ? 'personal details' : record.type ?? 'detail';
          emit({ type: 'progress', message: `Detected ${label}${record.type === 'personalInfo' ? '' : ` ${streamedRecords}`}…` });
          emit({ type: 'draft', draft: { ...draft }, source: 'ai-partial' });
          return true;
        }), emitStage);
        const ollamaStartedAt = performance.now();
        try {
          await aiDraftPromise;
          emitStage('finalizing', 'Combining the AI records and PDF profile-image result…');
          emit({ type: 'draft', draft, source: 'ai' });
          emit({ type: 'complete', message: `PDF extract + AI is complete. Option 2 is ready with ${photoDataUrl ? 'the PDF profile image and ' : ''}${streamedRecords} structured detail${streamedRecords === 1 ? '' : 's'}.` });
        }
        catch (error) { await photoPromise; const message = error instanceof Error ? error.message : 'AI cleanup could not finish.'; emit({ type: 'warning', message: `${message} The PDF extract remains available to review.` }); emit({ type: 'complete', message: 'PDF extract is ready to review.' }); }
        finally { timings.ollama = Math.round(performance.now() - ollamaStartedAt); }
        await saveTiming('complete');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to import this résumé right now.';
        await saveTiming('failed', message);
        emit({ type: 'error', message });
      }
      finally { if (workspace) await rm(workspace, { recursive: true, force: true }); controller.close(); }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}