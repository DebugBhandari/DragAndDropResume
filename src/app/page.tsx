"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import { useReactToPrint } from "react-to-print";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragOverlay,
  pointerWithin,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import SectionEditor from "@/components/SectionEditor";
import StyleEditor from "@/components/StyleEditor";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import { useResumeStore } from "@/store/useResumeStore";
import { useUIStore } from "@/store/useUIStore";
import {
  SectionType,
  ResumeSection,
  StyleConfig,
  PhotoConfig,
  LayoutType,
  ColumnZone,
  ResumeData,
  WorkExperience,
  Project,
} from "@/types/resume";
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from "@/utils/dateSort";

// ─── Contact icons for resume ───
const CONTACT_ICONS: Record<string, string> = {
  email: "✉",
  phone: "☎",
  location: "⌖",
  linkedin: "🔗",
  website: "🌐",
};

// ─── Style helpers ───
function getHeadingSizeClass(size: StyleConfig["headingSize"]) {
  switch (size) {
    case "sm":
      return "text-xs";
    case "lg":
      return "text-base";
    default:
      return "text-sm";
  }
}
function getSpacingClass(spacing: StyleConfig["sectionSpacing"]) {
  switch (spacing) {
    case "tight":
      return "mb-2";
    case "relaxed":
      return "mb-6";
    default:
      return "mb-4";
  }
}
function getFontFamily(font: StyleConfig["fontFamily"]) {
  switch (font) {
    case "serif":
      return "Georgia, serif";
    case "mono":
      return "ui-monospace, monospace";
    default:
      return "system-ui, -apple-system, sans-serif";
  }
}

// ─── Section Content ───
function SectionContent({
  type,
  experienceItems,
  projectItems,
}: {
  type: SectionType;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
}) {
  const {
    education,
    experience,
    experienceManualOrder,
    projects,
    projectsManualOrder,
    languages,
    skills,
    certificates,
    awards,
    volunteer,
    references,
    interests,
    style,
  } = useResumeStore();
  // Use [inherit] for body text so it respects the page-level fontSize; use [1.15em] for titles
  switch (type) {
    case "education":
      if (!education.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No education added
          </p>
        );
      return (
        <>
          {education.map((edu) => (
            <div key={edu.id} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong style={{ fontSize: "1.05em" }}>
                  {edu.institution || "Institution"}
                </strong>
                <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                  {edu.startDate}
                  {edu.endDate && ` – ${edu.endDate}`}
                </span>
              </div>
              <div
                className="italic text-gray-700"
                style={{ fontSize: "0.9em" }}
              >
                {edu.degree}
                {edu.field && ` in ${edu.field}`}
              </div>
              {edu.description && (
                <p
                  className="mt-0.5 text-gray-600"
                  style={{ fontSize: "0.9em" }}
                >
                  {edu.description}
                </p>
              )}
            </div>
          ))}
        </>
      );
    case "experience":
      {
      const baseExperience = experienceItems ?? experience;
      const experienceList = experienceManualOrder && !experienceItems
        ? baseExperience
        : sortWorkExperienceByDateDesc(baseExperience);
      if (!experienceList.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No experience added
          </p>
        );
      return (
        <>
          {experienceList.map((exp) => {
            const bullets = (exp.descriptionBullets && exp.descriptionBullets.length > 0
              ? exp.descriptionBullets
              : exp.description
                ? [exp.description]
                : []
            ).map((item) => item.trim()).filter((item) => item.length > 0);

            return (
            <div key={exp.id} data-exp-item className="mb-2 border border-slate-200 rounded-md px-2.5 py-2 break-inside-avoid">
              <div className="flex justify-between items-baseline">
                <strong style={{ fontSize: "1.05em" }}>
                  {exp.position || "Position"}
                </strong>
                <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                  {exp.startDate}
                  {exp.endDate && ` – ${exp.endDate}`}
                </span>
              </div>
              <div
                className="italic text-gray-700"
                style={{ fontSize: "0.9em" }}
              >
                {exp.company}
              </div>

              {bullets.length > 0 && (
                <ul className="mt-1.5 pl-4 list-disc text-gray-600" style={{ fontSize: "0.9em" }}>
                  {bullets.map((bullet, index) => (
                    <li key={`${exp.id}-preview-bullet-${index}`}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          )})}
        </>
      );
      }
    case "projects":
      {
      const baseProjects = projectItems ?? projects;
      const projectList = projectsManualOrder && !projectItems
        ? baseProjects
        : sortProjectsByDateDesc(baseProjects);
      if (!projectList.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No projects added
          </p>
        );
      return (
        <>
          {projectList.map((proj) => {
            const bullets = (proj.descriptionBullets && proj.descriptionBullets.length > 0
              ? proj.descriptionBullets
              : proj.description
                ? [proj.description]
                : []
            ).map((item) => item.trim()).filter((item) => item.length > 0);

            return (
            <div key={proj.id} data-project-item className="mb-2 border border-slate-200 rounded-md px-2.5 py-2 break-inside-auto">
              <div className="flex items-baseline gap-2">
                <strong style={{ fontSize: "1.05em" }}>
                  {proj.name || "Project"}
                </strong>
                {proj.completionDate && (
                  <span
                    className="text-gray-500"
                    style={{ fontSize: "0.85em" }}
                  >
                    • {proj.completionDate}
                  </span>
                )}
                {proj.technologies && (
                  <span
                    className="text-gray-500"
                    style={{ fontSize: "0.85em" }}
                  >
                    ({proj.technologies})
                  </span>
                )}
              </div>
              {bullets.length > 0 && (
                <ul className="mt-1.5 pl-4 list-disc text-gray-600" style={{ fontSize: "0.9em" }}>
                  {bullets.map((bullet, index) => (
                    <li key={`${proj.id}-preview-bullet-${index}`}>{bullet}</li>
                  ))}
                </ul>
              )}
              {proj.link && (
                <a
                  href={proj.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block"
                  style={{ color: style.accentColor, fontSize: "0.85em" }}
                >
                  {proj.link}
                </a>
              )}
            </div>
          )})}
        </>
      );
      }
    case "languages":
      if (!languages.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No languages added
          </p>
        );
      return (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {languages.map((lang) => (
            <span key={lang.id}>
              {lang.name}{" "}
              <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                ({lang.proficiency})
              </span>
            </span>
          ))}
        </div>
      );
    case "skills":
      if (!skills.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No skills added
          </p>
        );
      return (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((sk) => (
            <span
              key={sk.id}
              className="px-2 py-0.5 rounded"
              style={{
                background: style.accentColor + "20",
                color: style.accentColor,
                fontSize: "0.85em",
              }}
            >
              {sk.name}
            </span>
          ))}
        </div>
      );
    case "certificates":
      if (!certificates.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No certificates added
          </p>
        );
      return (
        <>
          {certificates.map((cert) => (
            <div key={cert.id} className="mb-2">
              <strong style={{ fontSize: "1.05em" }}>
                {cert.name || "Certificate"}
              </strong>
              <div className="text-gray-600" style={{ fontSize: "0.9em" }}>
                {cert.issuer}
                {cert.date && ` • ${cert.date}`}
              </div>
              {cert.link && (
                <a
                  href={cert.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: style.accentColor, fontSize: "0.85em" }}
                >
                  {cert.link}
                </a>
              )}
            </div>
          ))}
        </>
      );
    case "awards":
      if (!awards.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No awards added
          </p>
        );
      return (
        <>
          {awards.map((award) => (
            <div key={award.id} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong style={{ fontSize: "1.05em" }}>
                  {award.title || "Award"}
                </strong>
                <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                  {award.date}
                </span>
              </div>
              {award.issuer && (
                <div className="text-gray-700" style={{ fontSize: "0.9em" }}>
                  {award.issuer}
                </div>
              )}
              {award.description && (
                <p
                  className="mt-0.5 text-gray-600"
                  style={{ fontSize: "0.9em" }}
                >
                  {award.description}
                </p>
              )}
            </div>
          ))}
        </>
      );
    case "volunteer":
      if (!volunteer.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No volunteer experience added
          </p>
        );
      return (
        <>
          {volunteer.map((vol) => (
            <div key={vol.id} className="mb-2">
              <div className="flex justify-between items-baseline">
                <strong style={{ fontSize: "1.05em" }}>
                  {vol.role || "Role"}
                </strong>
                <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                  {vol.startDate}
                  {vol.endDate && ` – ${vol.endDate}`}
                </span>
              </div>
              <div
                className="italic text-gray-700"
                style={{ fontSize: "0.9em" }}
              >
                {vol.organization}
              </div>
              {vol.description && (
                <p
                  className="mt-0.5 text-gray-600 whitespace-pre-line"
                  style={{ fontSize: "0.9em" }}
                >
                  {vol.description}
                </p>
              )}
            </div>
          ))}
        </>
      );
    case "references":
      if (!references.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No references added
          </p>
        );
      return (
        <>
          {references.map((ref) => (
            <div key={ref.id} className="mb-2">
              <strong style={{ fontSize: "1.05em" }}>
                {ref.name || "Reference"}
              </strong>
              <div className="text-gray-700" style={{ fontSize: "0.9em" }}>
                {ref.position}
                {ref.company && ` at ${ref.company}`}
              </div>
              {ref.contact && (
                <div className="text-gray-500" style={{ fontSize: "0.85em" }}>
                  {ref.contact}
                </div>
              )}
            </div>
          ))}
        </>
      );
    case "interests":
      if (!interests.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No interests added
          </p>
        );
      return (
        <div className="flex flex-wrap gap-1.5">
          {interests.map((i) => (
            <span
              key={i.id}
              className="px-2 py-0.5 rounded bg-gray-100 text-gray-700"
              style={{ fontSize: "0.85em" }}
            >
              {i.name}
            </span>
          ))}
        </div>
      );
  }
}

// ─── Contact Row (with icons on resume) ───
function ContactRow({
  personalInfo,
  accentColor,
  light,
}: {
  personalInfo: any;
  accentColor: string;
  light?: boolean;
}) {
  const { showHeaderIcons } = useUIStore();
  const linkStyle = light ? {} : { color: accentColor };

  const items = [
    personalInfo.email && <span key="email">{showHeaderIcons && CONTACT_ICONS.email + " "}{personalInfo.email}</span>,
    personalInfo.phone && <span key="phone">{showHeaderIcons && CONTACT_ICONS.phone + " "}{personalInfo.phone}</span>,
    personalInfo.location && <span key="location">{showHeaderIcons && CONTACT_ICONS.location + " "}{personalInfo.location}</span>,
    personalInfo.linkedin && <a key="linkedin" href={personalInfo.linkedin} target="_blank" rel="noopener noreferrer" style={linkStyle}>{showHeaderIcons && CONTACT_ICONS.linkedin + " "}{personalInfo.linkedin}</a>,
    personalInfo.website && <a key="website" href={personalInfo.website} target="_blank" rel="noopener noreferrer" style={linkStyle}>{showHeaderIcons && CONTACT_ICONS.website + " "}{personalInfo.website}</a>,
  ].filter(Boolean);

  const row1 = items.slice(0, 3);
  const row2 = items.slice(3);
  const rowClass = light ? "inline-flex gap-3 flex-wrap opacity-80" : "text-gray-600 inline-flex gap-3 flex-wrap";

  return (
    <div className="mt-1">
      {row1.length > 0 && <div className={rowClass}>{row1}</div>}
      {row2.length > 0 && <div className={`${rowClass} mt-0.5`}>{row2}</div>}
    </div>
  );
}

// ─── Draggable photo in header (mouse-based, not dnd-kit) ───
function DraggablePhoto({
  photo,
  headerRef,
}: {
  photo: PhotoConfig;
  headerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { setPhoto } = useResumeStore();
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      if (!headerRef.current) return;
      const rect = headerRef.current.getBoundingClientRect();
      const x = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      );
      const y = Math.max(
        0,
        Math.min(100, ((e.clientY - rect.top) / rect.height) * 100),
      );
      setPhoto({ x: Math.round(x), y: Math.round(y) });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [dragging, headerRef, setPhoto]);

  if (!photo.url) return null;

  return (
    <img
      src={photo.url}
      alt="Profile"
      onMouseDown={handleMouseDown}
      className={`absolute select-none ${dragging ? "cursor-grabbing ring-2 ring-blue-400" : "cursor-grab hover:ring-2 hover:ring-blue-300"} print:cursor-default print:ring-0`}
      style={{
        width: photo.size,
        height: photo.size,
        borderRadius: `${photo.borderRadius}%`,
        objectFit: "cover",
        left: `${photo.x}%`,
        top: `${photo.y}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    />
  );
}

// ─── Personal Header with relative positioning for photo ───
function PersonalHeader({
  layout,
  style: s,
  photo,
}: {
  layout: LayoutType;
  style: StyleConfig;
  photo: PhotoConfig;
}) {
  const { personalInfo } = useResumeStore();
  const { focusPanel } = useUIStore();
  const headerRef = useRef<HTMLDivElement>(null);

  // Compute text alignment offset based on photo position
  const photoOnLeft = photo.url && photo.x < 35;
  const photoOnRight = photo.url && photo.x > 65;
  const textPadding = photo.url ? `${photo.size + 16}px` : "0";

  if (layout === "modern") {
    const align = s.headerAlignment || "left";
    const textAlign =
      align === "left"
        ? "text-left"
        : align === "right"
          ? "text-right"
          : "text-center";
    return (
      <div
        ref={headerRef}
        onClick={() => focusPanel('panel-header')}
        className="text-white -mx-12 -mt-12 mb-6 px-8 py-8 relative cursor-pointer"
        style={{
          background: s.accentColor,
          minHeight: photo.url ? Math.max(100, photo.size + 32) : 80,
        }}
      >
        <DraggablePhoto photo={photo} headerRef={headerRef} />
        <div
          className={textAlign}
          style={{
            paddingLeft: photoOnLeft ? textPadding : 0,
            paddingRight: photoOnRight ? textPadding : 0,
          }}
        >
          {personalInfo.fullName && (
            <h1 className="font-bold" style={{ fontSize: '1.8em' }}>{personalInfo.fullName}</h1>
          )}
          <ContactRow
            personalInfo={personalInfo}
            accentColor={s.accentColor}
            light
          />
          {personalInfo.summary && (
            <p
              className={`mt-2 opacity-90 max-w-[500px] ${align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : ""}`}
            >
              {personalInfo.summary}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div
        ref={headerRef}
        onClick={() => focusPanel('panel-header')}
        className="mb-3 pb-2 relative cursor-pointer"
        style={{
          borderBottom: `2px solid ${s.accentColor}`,
          minHeight: photo.url ? Math.max(60, photo.size * 0.7 + 16) : "auto",
        }}
      >
        <DraggablePhoto photo={photo} headerRef={headerRef} />
        <div
          style={{
            paddingLeft: photoOnLeft ? textPadding : 0,
            paddingRight: photoOnRight ? textPadding : 0,
          }}
        >
          <div className="flex items-baseline justify-between">
            {personalInfo.fullName && (
              <h1 className="font-bold" style={{ fontSize: '1.3em' }}>{personalInfo.fullName}</h1>
            )}
            <div className="text-xs text-gray-600 flex gap-2">
              {personalInfo.email && <span>{personalInfo.email}</span>}
              {personalInfo.phone && <span>| {personalInfo.phone}</span>}
              {personalInfo.location && <span>| {personalInfo.location}</span>}
            </div>
          </div>
          {personalInfo.summary && (
            <p className="mt-1 text-gray-600">{personalInfo.summary}</p>
          )}
        </div>
      </div>
    );
  }

  // classic & two-column
  const align = s.headerAlignment || "center";
  const textAlign =
    align === "left"
      ? "text-left"
      : align === "right"
        ? "text-right"
        : "text-center";

  return (
    <div
      ref={headerRef}
      onClick={() => focusPanel('panel-header')}
      className="mb-4 relative cursor-pointer"
      style={{ minHeight: photo.url ? Math.max(80, photo.size + 16) : "auto" }}
    >
      <DraggablePhoto photo={photo} headerRef={headerRef} />
      <div
        className={textAlign}
        style={{
          paddingLeft: photoOnLeft ? textPadding : 0,
          paddingRight: photoOnRight ? textPadding : 0,
        }}
      >
        {personalInfo.fullName && (
          <h1 className="font-bold" style={{ fontSize: '1.8em' }}>{personalInfo.fullName}</h1>
        )}
        <ContactRow personalInfo={personalInfo} accentColor={s.accentColor} />
        {personalInfo.summary && (
          <p
            className={`mt-2 text-gray-700 max-w-[600px] ${align === "center" ? "mx-auto" : align === "right" ? "ml-auto" : ""}`}
          >
            {personalInfo.summary}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Resume Draggable Section (sortable on document) ───
function ResumeDraggableSection({
  section,
  experienceItems,
  projectItems,
  onPreviewInteract,
}: {
  section: ResumeSection;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  onPreviewInteract?: (section: ResumeSection) => void;
}) {
  const { style, removeSectionFromResume } = useResumeStore();
  const { focusPanel } = useUIStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: section.id,
    data: { origin: "resume", zone: section.zone, type: section.type },
  });
  const containerStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    cursor: "grab",
  };
  const headingClass = `${getHeadingSizeClass(style.headingSize)} font-bold uppercase tracking-wider pb-1 mb-2`;
  const { showBodyIcons, sectionIcons } = useUIStore();
  const iconVisible = showBodyIcons && (sectionIcons[section.id] ?? true);

  const expandPanel = () => {
    focusPanel(`sec-${section.id}`);
    onPreviewInteract?.(section);
  };

  return (
    <div
      ref={setNodeRef}
      style={containerStyle}
      {...attributes}
      {...listeners}
      onPointerDown={expandPanel}
      data-page-section
      data-section-type={section.type}
      data-section-id={section.id}
      className={`${getSpacingClass(style.sectionSpacing)} break-inside-avoid relative rounded p-2 transition-all hover:bg-gray-50/50 active:cursor-grabbing group/sec`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          removeSectionFromResume(section.id);
        }}
        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/sec:opacity-100 transition-opacity print:hidden"
        title="Remove from resume"
      >
        ×
      </button>
      <h2
        className={headingClass}
        style={{
          borderBottom: `2px solid ${style.accentColor}`,
          color: style.accentColor,
        }}
      >
        {iconVisible && (
          <span className="mr-1">{SECTION_ICONS[section.type]}</span>
        )}
        {section.title}
      </h2>
      <SectionContent
        type={section.type}
        experienceItems={section.type === "experience" ? experienceItems : undefined}
        projectItems={section.type === "projects" ? projectItems : undefined}
      />
    </div>
  );
}

function ResumeStaticSection({
  section,
  experienceItems,
  projectItems,
  onPreviewInteract,
}: {
  section: ResumeSection;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  onPreviewInteract?: (section: ResumeSection) => void;
}) {
  const { style } = useResumeStore();
  const { showBodyIcons, sectionIcons, focusPanel } = useUIStore();
  const headingClass = `${getHeadingSizeClass(style.headingSize)} font-bold uppercase tracking-wider pb-1 mb-2`;
  const iconVisible = showBodyIcons && (sectionIcons[section.id] ?? true);

  const expandPanel = () => {
    focusPanel(`sec-${section.id}`);
    onPreviewInteract?.(section);
  };

  return (
    <div
      onPointerDown={expandPanel}
      data-page-section
      data-section-type={section.type}
      data-section-id={section.id}
      className={`${getSpacingClass(style.sectionSpacing)} relative rounded p-2`}
    >
      <h2
        className={headingClass}
        style={{
          borderBottom: `2px solid ${style.accentColor}`,
          color: style.accentColor,
        }}
      >
        {iconVisible && <span className="mr-1">{SECTION_ICONS[section.type]}</span>}
        {section.title}
      </h2>
      <SectionContent
        type={section.type}
        experienceItems={section.type === "experience" ? experienceItems : undefined}
        projectItems={section.type === "projects" ? projectItems : undefined}
      />
    </div>
  );
}

// ─── Section Icons ───
const SECTION_ICONS: Record<SectionType, string> = {
  experience: "💼",
  education: "🎓",
  projects: "🚀",
  skills: "⚡",
  languages: "🌐",
  certificates: "📜",
  awards: "🏆",
  volunteer: "🤝",
  references: "👤",
  interests: "❤️",
};

const SECTION_LABELS: Record<SectionType, string> = {
  experience: "Work Experience",
  education: "Education",
  projects: "Projects",
  skills: "Skills",
  languages: "Languages",
  certificates: "Certificates",
  awards: "Awards",
  volunteer: "Volunteer",
  references: "References",
  interests: "Interests",
};

const ALL_SECTION_TYPES: SectionType[] = [
  "experience",
  "education",
  "projects",
  "skills",
  "languages",
  "certificates",
  "awards",
  "volunteer",
  "references",
  "interests",
];

const PRIORITY_SECTION_TYPES: SectionType[] = [
  "experience",
  "projects",
  "skills",
  "languages",
];

function hasAnyText(values: unknown[]) {
  return values.some((value) => String(value ?? "").trim().length > 0);
}

type SectionDataSnapshot = Pick<
  ResumeData,
  | "education"
  | "experience"
  | "projects"
  | "languages"
  | "skills"
  | "certificates"
  | "awards"
  | "volunteer"
  | "references"
  | "interests"
>;

const EMPTY_SECTION_FLAGS: Record<SectionType, boolean> = {
  experience: false,
  education: false,
  projects: false,
  skills: false,
  languages: false,
  certificates: false,
  awards: false,
  volunteer: false,
  references: false,
  interests: false,
};

function parsePersistedResumeData(): Partial<SectionDataSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem("resume-storage");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.state ?? {};
  } catch {
    return {};
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function hasAnyKeys(value: unknown): boolean {
  return !!value && typeof value === "object" && Object.keys(value as Record<string, unknown>).length > 0;
}

function sectionHasData(type: SectionType, store: SectionDataSnapshot) {
  switch (type) {
    case "experience":
      return store.experience.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([
          item.company,
          item.position,
          item.startDate,
          item.endDate,
          item.description,
        ]),
      );
    case "education":
      return store.education.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([
          item.institution,
          item.degree,
          item.field,
          item.startDate,
          item.endDate,
          item.description,
        ]),
      );
    case "projects":
      return store.projects.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([item.name, item.description, ...(item.descriptionBullets || []), item.completionDate, item.technologies, item.link]),
      );
    case "languages":
      return store.languages.some((item) => hasAnyKeys(item) && hasAnyText([item.name]));
    case "skills":
      return store.skills.some((item) => hasAnyKeys(item) && hasAnyText([item.name]));
    case "certificates":
      return store.certificates.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([item.name, item.issuer, item.date, item.link]),
      );
    case "awards":
      return store.awards.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([item.title, item.issuer, item.date, item.description]),
      );
    case "volunteer":
      return store.volunteer.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([
          item.organization,
          item.role,
          item.startDate,
          item.endDate,
          item.description,
        ]),
      );
    case "references":
      return store.references.some((item) =>
        hasAnyKeys(item) &&
        hasAnyText([item.name, item.position, item.company, item.contact]),
      );
    case "interests":
      return store.interests.some((item) => hasAnyKeys(item) && hasAnyText([item.name]));
    default:
      return false;
  }
}

// ─── Sidebar Draggable Panel (clean left-accent style with icon) ───
function SidebarDraggablePanel({
  section,
  showBodyIcons,
  hasData,
}: {
  section: ResumeSection;
  showBodyIcons: boolean;
  hasData: boolean;
}) {
  const { style } = useResumeStore();
  const { sectionIcons, setSectionIcon } = useUIStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-${section.id}`,
    data: { origin: "sidebar", sectionId: section.id, type: section.type },
  });
  const iconEnabled = showBodyIcons && (sectionIcons[section.id] ?? true);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-panel-id={`sec-${section.id}`}
      className={`rounded-lg shadow-sm overflow-hidden cursor-grab active:cursor-grabbing transition-all ${
        hasData ? "bg-emerald-50/60 border border-emerald-200" : "bg-white"
      } ${
        isDragging ? "opacity-40 scale-[0.98] shadow-lg" : "hover:shadow-md"
      }`}
      style={{ borderLeft: `4px solid ${style.accentColor}` }}
    >
      <div className="flex items-center justify-between pr-3">
        <CollapsiblePanel
          title={`${SECTION_ICONS[section.type]} ${section.title}`}
          persistId={`sec-${section.id}`}
          defaultOpen={false}
        >
          <div className="mb-2 flex items-center gap-2">
            <label
              className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={iconEnabled}
                onChange={(e) => {
                  e.stopPropagation();
                  setSectionIcon(section.id, e.target.checked);
                }}
                className="w-3 h-3"
              />
              Show icon on resume
            </label>
          </div>
          <SectionEditor type={section.type} />
        </CollapsiblePanel>
      </div>
    </div>
  );
}

// ─── Droppable Zone ───
function DroppableZone({
  id,
  children,
  className,
  style: zoneStyle,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`${className} min-h-[100px] transition-all relative ${isOver ? "ring-2 ring-blue-400 ring-inset bg-blue-50/30" : ""}`}
      style={zoneStyle}
    >
      {children}
    </div>
  );
}

// ─── Drag Overlay ───
function DragOverlayContent({ sectionId }: { sectionId: string | null }) {
  const { sectionOrder, style } = useResumeStore();
  if (!sectionId) return null;
  const section = sectionOrder.find((s) => s.id === sectionId);
  if (!section) return null;
  return (
    <div className="bg-white shadow-xl rounded p-3 border-2 border-blue-400 opacity-90 w-[200px]">
      <h2
        className="text-xs font-bold uppercase"
        style={{ color: style.accentColor }}
      >
        {section.title}
      </h2>
      <p className="text-xs text-gray-400 mt-1">Drop into a zone</p>
    </div>
  );
}

// ─── Main Page ───
export default function Home() {
  const resumeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainLayoutRef = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);
  const [editorPaneWidth, setEditorPaneWidth] = useState(520);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [persistedSectionFlags, setPersistedSectionFlags] =
    useState<Record<SectionType, boolean>>(EMPTY_SECTION_FLAGS);
  const {
    sectionOrder,
    reorderSections,
    moveSectionToZone,
    removeSectionFromResume,
    addSectionToResume,
    layout,
    style: s,
    photo,
    education,
    experience,
    experienceManualOrder,
    projects,
    projectsManualOrder,
    languages,
    skills,
    certificates,
    awards,
    volunteer,
    references,
    interests,
  } = useResumeStore();
  const {
    showHeaderIcons,
    showBodyIcons,
    sectionIcons,
    setSectionIcon,
    toggleHeaderIcons,
    toggleBodyIcons,
    settingsCollapsed,
    toggleSettings,
    sectionsCollapsed,
    toggleSections,
    activePanelId,
    focusPanel,
  } = useUIStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (activePanelId.startsWith("sec-")) {
      const stillExists = sectionOrder.some((section) => `sec-${section.id}` === activePanelId);
      if (!stillExists) focusPanel("panel-header");
    }
  }, [activePanelId, sectionOrder, focusPanel]);

  useEffect(() => {
    if (!isMobileEditorOpen) return;
    if (!sidebarRef.current) return;

    const target = sidebarRef.current.querySelector(`[data-panel-id="${activePanelId}"]`) as HTMLElement | null;
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [isMobileEditorOpen, activePanelId]);

  useEffect(() => {
    if (!isResizingEditor) return;

    const onPointerMove = (event: PointerEvent) => {
      if (!mainLayoutRef.current) return;
      const rect = mainLayoutRef.current.getBoundingClientRect();

      const minWidth = 420;
      const maxWidth = Math.min(860, rect.width - 420);
      const next = Math.max(minWidth, Math.min(maxWidth, event.clientX - rect.left));
      setEditorPaneWidth(next);
    };

    const onPointerUp = () => {
      setIsResizingEditor(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isResizingEditor]);

  useEffect(() => {
    const persisted = parsePersistedResumeData();
    const persistedSnapshot: SectionDataSnapshot = {
      experience: asArray(persisted.experience),
      education: asArray(persisted.education),
      projects: asArray(persisted.projects),
      skills: asArray(persisted.skills),
      languages: asArray(persisted.languages),
      certificates: asArray(persisted.certificates),
      awards: asArray(persisted.awards),
      volunteer: asArray(persisted.volunteer),
      references: asArray(persisted.references),
      interests: asArray(persisted.interests),
    };

    setPersistedSectionFlags({
      experience: sectionHasData("experience", persistedSnapshot),
      education: sectionHasData("education", persistedSnapshot),
      projects: sectionHasData("projects", persistedSnapshot),
      skills: sectionHasData("skills", persistedSnapshot),
      languages: sectionHasData("languages", persistedSnapshot),
      certificates: sectionHasData("certificates", persistedSnapshot),
      awards: sectionHasData("awards", persistedSnapshot),
      volunteer: sectionHasData("volunteer", persistedSnapshot),
      references: sectionHasData("references", persistedSnapshot),
      interests: sectionHasData("interests", persistedSnapshot),
    });
  }, []);

  const handlePrint = useReactToPrint({
    contentRef: resumeRef,
    documentTitle: "Resume",
  });

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setActiveDragId(
      data?.origin === "sidebar" ? data.sectionId : (event.active.id as string),
    );
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current;
    const sectionId =
      data?.origin === "sidebar" ? data.sectionId : (active.id as string);
    const overId = over.id as string;
    const activeSection = sectionOrder.find((sec) => sec.id === sectionId);
    if (!activeSection) return;

    if (overId === "zone-main" && activeSection.zone !== "main")
      moveSectionToZone(sectionId, "main");
    else if (overId === "zone-sidebar" && activeSection.zone !== "sidebar")
      moveSectionToZone(sectionId, "sidebar");
    else {
      const overSection = sectionOrder.find((sec) => sec.id === overId);
      if (overSection && overSection.zone !== activeSection.zone)
        moveSectionToZone(sectionId, overSection.zone);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current;
    const sectionId =
      data?.origin === "sidebar" ? data.sectionId : (active.id as string);
    const overId = over.id as string;
    if (overId === "zone-main" || overId === "zone-sidebar") return;
    const overSection = sectionOrder.find((sec) => sec.id === overId);
    if (overSection && sectionId !== overId) {
      const oldIdx = sectionOrder.findIndex((sec) => sec.id === sectionId);
      const newIdx = sectionOrder.findIndex((sec) => sec.id === overId);
      if (oldIdx !== -1 && newIdx !== -1)
        reorderSections(arrayMove(sectionOrder, oldIdx, newIdx));
    }
  }

  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const PAGE_PAD = layout === "compact" ? 32 : 48;
  const PAGE_PAD_BOTTOM = 8;
  const USABLE_HEIGHT = PAGE_HEIGHT - PAGE_PAD - PAGE_PAD_BOTTOM;

  // Track which section index starts page 2+
  const [pageSplitIndex, setPageSplitIndex] = useState<number>(-1);
  const [detailSplitSectionType, setDetailSplitSectionType] = useState<"experience" | "projects" | null>(null);
  const [detailSplitSectionIndex, setDetailSplitSectionIndex] = useState<number | null>(null);
  const [detailSplitItemIndex, setDetailSplitItemIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!contentRef.current) return;
    const measure = () => {
      if (!contentRef.current) return;
      const container = contentRef.current;
      const containerRect = container.getBoundingClientRect();
      const sections = container.querySelectorAll("[data-page-section]");
      let splitIdx = -1;
      for (let i = 0; i < sections.length; i++) {
        const el = sections[i];
        const rect = el.getBoundingClientRect();
        const elBottom = rect.top - containerRect.top + rect.height;
        if (elBottom > USABLE_HEIGHT) {
          splitIdx = i;
          break;
        }
      }
      setPageSplitIndex(splitIdx);
      if (splitIdx !== -1) {
        const overflowSection = sections[splitIdx] as HTMLElement;
        const overflowType = overflowSection?.dataset?.sectionType;
        const isSplitType = overflowType === "experience" || overflowType === "projects";
        if (isSplitType) {
          const itemSelector = overflowType === "experience" ? "[data-exp-item]" : "[data-project-item]";
          const detailItems = overflowSection.querySelectorAll(itemSelector);
          let itemSplit = -1;

          for (let i = 0; i < detailItems.length; i++) {
            const itemRect = detailItems[i].getBoundingClientRect();
            const itemBottom = itemRect.top - containerRect.top + itemRect.height;
            if (itemBottom > USABLE_HEIGHT) {
              itemSplit = i;
              break;
            }
          }

          if (itemSplit === -1) {
            itemSplit = detailItems.length;
          }

          if (itemSplit < 1 && detailItems.length > 0) {
            itemSplit = 1;
          }

          setDetailSplitSectionType(overflowType);
          setDetailSplitSectionIndex(splitIdx);
          setDetailSplitItemIndex(itemSplit);
        } else {
          setDetailSplitSectionType(null);
          setDetailSplitSectionIndex(null);
          setDetailSplitItemIndex(null);
        }
      } else {
        setDetailSplitSectionType(null);
        setDetailSplitSectionIndex(null);
        setDetailSplitItemIndex(null);
      }
      setPageCount(splitIdx === -1 ? 1 : 2);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(contentRef.current);
    measure();
    return () => observer.disconnect();
  }, [layout, sectionOrder, experience, USABLE_HEIGHT, s.fontSize, s.headingSize, s.sectionSpacing]);

  if (!mounted) return null;

  const mainSections = sectionOrder.filter((sec) => sec.zone === "main");
  const sidebarSections = sectionOrder.filter((sec) => sec.zone === "sidebar");
  const allIds = sectionOrder.map((sec) => sec.id);
  const activeSectionByType = sectionOrder.reduce(
    (acc, section) => {
      acc[section.type] = section;
      return acc;
    },
    {} as Partial<Record<SectionType, ResumeSection>>,
  );
  const priorityRank = PRIORITY_SECTION_TYPES.reduce(
    (acc, type, index) => {
      acc[type] = index;
      return acc;
    },
    {} as Record<SectionType, number>,
  );
  const sortedSidebarSections = [...sectionOrder].sort((a, b) => {
    const rankA = priorityRank[a.type] ?? Number.MAX_SAFE_INTEGER;
    const rankB = priorityRank[b.type] ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return sectionOrder.findIndex((section) => section.id === a.id) - sectionOrder.findIndex((section) => section.id === b.id);
  });
  const sectionDataState = {
    education,
    experience,
    projects,
    languages,
    skills,
    certificates,
    awards,
    volunteer,
    references,
    interests,
  } satisfies SectionDataSnapshot;
  const sectionDataFlags: Record<SectionType, boolean> = {
    experience: sectionHasData("experience", sectionDataState),
    education: sectionHasData("education", sectionDataState),
    projects: sectionHasData("projects", sectionDataState),
    skills: sectionHasData("skills", sectionDataState),
    languages: sectionHasData("languages", sectionDataState),
    certificates: sectionHasData("certificates", sectionDataState),
    awards: sectionHasData("awards", sectionDataState),
    volunteer: sectionHasData("volunteer", sectionDataState),
    references: sectionHasData("references", sectionDataState),
    interests: sectionHasData("interests", sectionDataState),
  };
  const combinedSectionFlags: Record<SectionType, boolean> = {
    experience: sectionDataFlags.experience || persistedSectionFlags.experience,
    education: sectionDataFlags.education || persistedSectionFlags.education,
    projects: sectionDataFlags.projects || persistedSectionFlags.projects,
    skills: sectionDataFlags.skills || persistedSectionFlags.skills,
    languages: sectionDataFlags.languages || persistedSectionFlags.languages,
    certificates: sectionDataFlags.certificates || persistedSectionFlags.certificates,
    awards: sectionDataFlags.awards || persistedSectionFlags.awards,
    volunteer: sectionDataFlags.volunteer || persistedSectionFlags.volunteer,
    references: sectionDataFlags.references || persistedSectionFlags.references,
    interests: sectionDataFlags.interests || persistedSectionFlags.interests,
  };

  const pageStyle: React.CSSProperties = {
    width: `${PAGE_WIDTH}px`,
    height: `${PAGE_HEIGHT}px`,
    padding: layout === "compact" ? "32px 32px 8px 32px" : "48px 48px 8px 48px",
    fontFamily: getFontFamily(s.fontFamily),
    fontSize: `${s.fontSize === "sm" ? 12 : s.fontSize === "lg" ? 14 : 13}px`,
    background: "white",
    color: "#1a1a1a",
    position: "relative",
    overflow: "hidden",
  };

  const sortedExperience = experienceManualOrder ? experience : sortWorkExperienceByDateDesc(experience);
  const sortedProjects = projectsManualOrder ? projects : sortProjectsByDateDesc(projects);

  const hasDetailSplit =
    detailSplitSectionType !== null &&
    detailSplitSectionIndex !== null &&
    detailSplitItemIndex !== null &&
    pageSplitIndex !== -1;

  const splitItemsLength = detailSplitSectionType === "projects" ? sortedProjects.length : sortedExperience.length;

  const clampedDetailSplitIndex = hasDetailSplit
    ? Math.max(1, Math.min(detailSplitItemIndex!, splitItemsLength))
    : null;

  const splitSectionCandidate =
    hasDetailSplit &&
    detailSplitSectionIndex! >= 0 &&
    detailSplitSectionIndex! < sectionOrder.length
      ? sectionOrder[detailSplitSectionIndex!]
      : null;

  const canUseDetailSplit =
    !!splitSectionCandidate &&
    splitSectionCandidate.type === detailSplitSectionType &&
    clampedDetailSplitIndex !== null;

  const renderLinearPageOneSections = () => {
    if (pageSplitIndex === -1) {
      return sectionOrder.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    if (!canUseDetailSplit) {
      return sectionOrder.slice(0, pageSplitIndex).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    const splitSection = splitSectionCandidate;
    const beforeSplit = sectionOrder.slice(0, detailSplitSectionIndex!);
    const splitExperienceItems = detailSplitSectionType === "experience" ? sortedExperience.slice(0, clampedDetailSplitIndex!) : undefined;
    const splitProjectItems = detailSplitSectionType === "projects" ? sortedProjects.slice(0, clampedDetailSplitIndex!) : undefined;

    return (
      <>
        {beforeSplit.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ))}
        <ResumeDraggableSection
          key={splitSection!.id}
          section={splitSection!}
          experienceItems={splitExperienceItems}
          projectItems={splitProjectItems}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      </>
    );
  };

  const renderLinearPageTwoSections = () => {
    if (pageSplitIndex === -1) return null;

    if (!canUseDetailSplit) {
      return sectionOrder.slice(pageSplitIndex).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    const splitSection = splitSectionCandidate;
    const afterSplit = sectionOrder.slice(detailSplitSectionIndex! + 1);
    const splitExperienceItems = detailSplitSectionType === "experience" ? sortedExperience.slice(clampedDetailSplitIndex!) : undefined;
    const splitProjectItems = detailSplitSectionType === "projects" ? sortedProjects.slice(clampedDetailSplitIndex!) : undefined;

    return (
      <>
        <ResumeStaticSection
          section={splitSection!}
          experienceItems={splitExperienceItems}
          projectItems={splitProjectItems}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
        {afterSplit.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ))}
      </>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="min-h-screen bg-gray-100">
        <header className="bg-white shadow-sm sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-800">Drag and Drop Resume</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileEditorOpen(true)}
              className="lg:hidden bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-50 transition text-sm font-medium"
              aria-label="Open editor"
            >
              <span aria-hidden="true">✏</span>
              <span className="sr-only">Edit</span>
            </button>
            <button
              onClick={() => handlePrint()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition text-sm font-medium"
            >
              Export PDF
            </button>
          </div>
        </header>

        <main ref={mainLayoutRef} className="flex flex-col lg:flex-row gap-3 p-3 max-w-[1800px] mx-auto">
          {isMobileEditorOpen && (
            <button
              type="button"
              onClick={() => setIsMobileEditorOpen(false)}
              className="fixed inset-0 bg-black/35 z-40 lg:hidden"
              aria-label="Close sidebar"
            />
          )}

          {/* Editor Sidebar */}
          <div
            ref={sidebarRef}
            className={`fixed top-0 left-0 z-50 h-screen w-[88vw] max-w-sm bg-gray-100 p-3 overflow-y-auto shadow-2xl transition-transform duration-300 lg:static lg:z-auto lg:h-auto lg:w-(--editor-pane-width) lg:max-w-none lg:max-h-[calc(100vh-80px)] lg:overflow-y-auto lg:p-0 lg:pr-2 lg:bg-transparent lg:shadow-none ${isMobileEditorOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
            style={{
              ["--editor-pane-width" as string]: `${editorPaneWidth}px`,
            } as React.CSSProperties}
          >
            <div className="flex items-center justify-between mb-2 lg:hidden">
              <p className="text-sm font-semibold text-gray-700">Editor</p>
              <button
                type="button"
                onClick={() => setIsMobileEditorOpen(false)}
                className="px-2 py-1 rounded border border-gray-300 text-sm text-gray-700"
              >
                Close
              </button>
            </div>
            {/* Settings Group */}
            <div className="mb-4">
              <button
                type="button"
                onClick={toggleSettings}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition ${settingsCollapsed ? "bg-white shadow-sm hover:shadow" : "bg-transparent"}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${settingsCollapsed ? "text-gray-700" : "text-gray-400"}`}
                >
                  ⚙️ Settings
                </p>
                <span
                  className={`text-gray-400 text-sm transition-transform ${settingsCollapsed ? "" : "rotate-180"}`}
                >
                  ▾
                </span>
              </button>
              {!settingsCollapsed && (
                <div className="space-y-3 mt-2">
                  <div className="bg-white rounded-lg shadow">
                    <CollapsiblePanel title="Layout" persistId="panel-layout">
                      <LayoutPickerContent />
                    </CollapsiblePanel>
                  </div>
                  <div className="bg-white rounded-lg shadow">
                    <CollapsiblePanel title="Style" persistId="panel-style">
                      <StyleEditor />
                    </CollapsiblePanel>
                  </div>
                </div>
              )}
            </div>

            {/* Sections Group */}
            <div>
              <button
                type="button"
                onClick={toggleSections}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition ${sectionsCollapsed ? "bg-white shadow-sm hover:shadow" : "bg-transparent"}`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-widest ${sectionsCollapsed ? "text-gray-700" : "text-gray-400"}`}
                >
                  📄 Sections
                </p>
                <span
                  className={`text-gray-400 text-sm transition-transform ${sectionsCollapsed ? "" : "rotate-180"}`}
                >
                  ▾
                </span>
              </button>
              {!sectionsCollapsed && (
                <div className="space-y-3">
                  {/* Non-draggable: Header (Personal Info + Photo) */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg" data-panel-id="panel-header">
                    <CollapsiblePanel
                      title="👤 Header"
                      persistId="panel-header"
                    >
                      <PersonalInfoContent />
                      <hr className="my-3 border-amber-200" />
                      <PhotoContent />
                    </CollapsiblePanel>
                  </div>

                  {/* Available sections pool */}
                  {(() => {
                    const activeTypes = sectionOrder.map((s) => s.type);
                    const extraAvailable = ALL_SECTION_TYPES.filter(
                      (type) => !activeTypes.includes(type),
                    );
                    return (
                      <>
                        {!!extraAvailable.length && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-[10px] text-gray-400 uppercase font-semibold mb-2">
                              Add to resume
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {extraAvailable.map((type) => (
                            <button
                              key={type}
                              onClick={() => addSectionToResume(type)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition ${
                                  combinedSectionFlags[type]
                                  ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                  : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"
                              }`}
                            >
                              {SECTION_ICONS[type]} {SECTION_LABELS[type]}
                            </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Active section editors (draggable) */}
                  {sortedSidebarSections.map((section) => (
                    <SidebarDraggablePanel
                      key={section.id}
                      section={section}
                      showBodyIcons={showBodyIcons}
                        hasData={combinedSectionFlags[section.type]}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="hidden lg:flex items-stretch">
            <button
              type="button"
              onPointerDown={(event) => {
                event.preventDefault();
                setIsResizingEditor(true);
              }}
              className="w-2 rounded bg-gray-200/80 hover:bg-blue-300 active:bg-blue-400 cursor-col-resize transition-colors"
              aria-label="Resize editor pane"
              title="Drag to resize editor"
            />
          </div>

          {/* Resume Preview */}
          <div className="w-full lg:flex-1 overflow-y-auto overflow-x-hidden max-h-[60vh] lg:max-h-[calc(100vh-80px)]">
            <div className="origin-top w-[92vw] mx-auto lg:w-auto lg:mx-0 scale-[0.45] sm:scale-[0.6] md:scale-[0.8] lg:scale-[0.85] xl:scale-100 print:!scale-100">
            <div
              ref={resumeRef}
              className="resume-pages flex flex-col items-center gap-8 py-4 print:block print:p-0"
            >
              {/* Hidden measurer - measures all sections to find page split */}
              <div
                style={{
                  position: "absolute",
                  visibility: "hidden",
                  left: "-9999px",
                  width: `${PAGE_WIDTH}px`,
                  padding: `${PAGE_PAD}px ${PAGE_PAD}px 8px ${PAGE_PAD}px`,
                  fontSize: `${s.fontSize === "sm" ? 12 : s.fontSize === "lg" ? 14 : 13}px`,
                  fontFamily: getFontFamily(s.fontFamily),
                }}
              >
                <div ref={contentRef}>
                  <PersonalHeader layout={layout} style={s} photo={photo} />
                  {sectionOrder.map((sec) => (
                    <ResumeDraggableSection key={sec.id} section={sec} />
                  ))}
                </div>
              </div>

              <SortableContext
                items={allIds}
              >
                <DroppableZone
                  id="zone-main"
                  className="flex flex-col items-center gap-8"
                >
                  {/* Page 1 */}
                  <div
                    className="resume-page shadow-lg rounded"
                    style={{ ...pageStyle }}
                  >
                    <PersonalHeader layout={layout} style={s} photo={photo} />
                    {layout === "two-column" ? (
                      <div
                        className="flex gap-0"
                        style={{
                          minHeight: "850px",
                          margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px`,
                        }}
                      >
                        <div
                          className="shrink-0 p-5 pt-4"
                          style={{
                            background: s.accentColor + "10",
                            width: `${s.sidebarWidth}%`,
                          }}
                        >
                          {sidebarSections.map((sec) => (
                            <ResumeDraggableSection
                              key={sec.id}
                              section={sec}
                              onPreviewInteract={() => setIsMobileEditorOpen(true)}
                            />
                          ))}
                          {!sidebarSections.length && (
                            <p className="text-xs text-gray-400 italic text-center mt-8">
                              Drop sections here
                            </p>
                          )}
                        </div>
                        <div className="flex-1 p-8 pt-4">
                          {(pageSplitIndex === -1
                            ? mainSections
                            : mainSections.slice(0, pageSplitIndex)
                          ).map((sec) => (
                            <ResumeDraggableSection
                              key={sec.id}
                              section={sec}
                              onPreviewInteract={() => setIsMobileEditorOpen(true)}
                            />
                          ))}
                          {!mainSections.length && (
                            <p className="text-xs text-gray-400 italic text-center mt-8">
                              Drop sections here
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        {renderLinearPageOneSections()}
                      </div>
                    )}
                  </div>

                  {/* Page 2 */}
                  {pageSplitIndex !== -1 && (
                    <div
                      className="resume-page shadow-lg rounded"
                      style={{ ...pageStyle }}
                    >
                      {layout === "two-column" ? (
                        <div
                          className="flex gap-0"
                          style={{
                            minHeight: "850px",
                            margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px`,
                          }}
                        >
                          <div
                            className="shrink-0 p-5 pt-4"
                            style={{
                              background: s.accentColor + "10",
                              width: `${s.sidebarWidth}%`,
                            }}
                          />
                          <div className="flex-1 p-8 pt-4">
                            {mainSections.slice(pageSplitIndex).map((sec) => (
                              <ResumeDraggableSection
                                key={sec.id}
                                section={sec}
                                onPreviewInteract={() => setIsMobileEditorOpen(true)}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {renderLinearPageTwoSections()}
                        </div>
                      )}
                    </div>
                  )}

                </DroppableZone>
              </SortableContext>
            </div>
            </div>
          </div>
        </main>
      </div>

      <DragOverlay>
        <DragOverlayContent sectionId={activeDragId} />
      </DragOverlay>
    </DndContext>
  );
}

// ─── Layout Picker ───
function LayoutPickerContent() {
  const { layout, setLayout, style, setStyle } = useResumeStore();
  const layouts: { type: LayoutType; name: string }[] = [
    { type: "classic", name: "Classic" },
    { type: "modern", name: "Modern" },
    { type: "compact", name: "Compact" },
    { type: "two-column", name: "Two Column" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {layouts.map((l) => (
          <button
            key={l.type}
            onClick={() => setLayout(l.type)}
            className={`p-2 border-2 rounded text-left transition ${layout === l.type ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-400"}`}
          >
            <div className="w-full h-12 rounded border border-gray-200 p-1 flex flex-col gap-0.5">
              {l.type === "classic" && (
                <>
                  <div
                    className="h-2 w-1/2 mx-auto rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "modern" && (
                <>
                  <div
                    className="h-3 w-full rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "compact" && (
                <>
                  <div
                    className="h-1.5 w-1/3 rounded-sm"
                    style={{ background: style.accentColor }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </>
              )}
              {l.type === "two-column" && (
                <div className="flex gap-0.5 flex-1">
                  <div
                    className="w-1/3 rounded-sm"
                    style={{ background: style.accentColor, opacity: 0.3 }}
                  />
                  <div className="flex-1 bg-gray-100 rounded-sm" />
                </div>
              )}
            </div>
            <div className="text-xs font-medium mt-1">{l.name}</div>
          </button>
        ))}
      </div>
      {layout === "two-column" && (
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">
            Sidebar Width: {style.sidebarWidth}%
          </label>
          <input
            type="range"
            min={20}
            max={50}
            value={style.sidebarWidth}
            onChange={(e) => setStyle({ sidebarWidth: +e.target.value })}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Narrow</span>
            <span>Wide</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personal Info ───
function PersonalInfoContent() {
  const { personalInfo, updatePersonalInfo } = useResumeStore();
  return (
    <div className="space-y-3">
      <input
        className="input-field"
        placeholder="Full Name"
        value={personalInfo.fullName}
        onChange={(e) => updatePersonalInfo({ fullName: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Email"
        value={personalInfo.email}
        onChange={(e) => updatePersonalInfo({ email: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Phone"
        value={personalInfo.phone}
        onChange={(e) => updatePersonalInfo({ phone: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Location"
        value={personalInfo.location}
        onChange={(e) => updatePersonalInfo({ location: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="LinkedIn URL"
        value={personalInfo.linkedin}
        onChange={(e) => updatePersonalInfo({ linkedin: e.target.value })}
      />
      <input
        className="input-field"
        placeholder="Website / Portfolio"
        value={personalInfo.website}
        onChange={(e) => updatePersonalInfo({ website: e.target.value })}
      />
      <textarea
        className="input-field min-h-[80px]"
        placeholder="Professional Summary"
        value={personalInfo.summary}
        onChange={(e) => updatePersonalInfo({ summary: e.target.value })}
      />
    </div>
  );
}

// ─── Photo ───
function PhotoContent() {
  const { photo, setPhoto } = useResumeStore();
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto({ url: reader.result as string });
    reader.readAsDataURL(file);
  }
  return (
    <div className="space-y-2">
      <input
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="text-xs"
      />
      {photo.url && (
        <>
          <div className="flex items-center gap-2">
            <img
              src={photo.url}
              alt=""
              className="object-cover"
              style={{
                width: 40,
                height: 40,
                borderRadius: `${photo.borderRadius}%`,
              }}
            />
            <button
              onClick={() => setPhoto({ url: "" })}
              className="text-xs text-red-500"
            >
              Remove
            </button>
          </div>
          <p className="text-xs text-gray-500 italic">
            Drag the photo on the resume header to reposition.
          </p>
          <div>
            <label className="text-xs text-gray-500">X: {photo.x}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={photo.x}
              onChange={(e) => setPhoto({ x: +e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Y: {photo.y}%</label>
            <input
              type="range"
              min={0}
              max={100}
              value={photo.y}
              onChange={(e) => setPhoto({ y: +e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">
              Size: {photo.size}px
            </label>
            <input
              type="range"
              min={40}
              max={150}
              value={photo.size}
              onChange={(e) => setPhoto({ size: +e.target.value })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">
              Roundness: {photo.borderRadius}%
            </label>
            <input
              type="range"
              min={0}
              max={50}
              value={photo.borderRadius}
              onChange={(e) => setPhoto({ borderRadius: +e.target.value })}
              className="w-full"
            />
          </div>
        </>
      )}
    </div>
  );
}
