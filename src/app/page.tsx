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
import FeedbackWidget from "@/components/FeedbackWidget";
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
  Language,
  Skill,
  Interest,
  LocaleCode,
} from "@/types/resume";
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from "@/utils/dateSort";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { getSectionLabel } from "@/utils/sectionTranslations";
import { getUiText } from "@/utils/uiTranslations";

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
  languageItems,
  skillItems,
  interestItems,
}: {
  type: SectionType;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  languageItems?: Language[];
  skillItems?: Skill[];
  interestItems?: Interest[];
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
    case "experience": {
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
                <div className="italic text-gray-700" style={{ fontSize: "0.9em" }}>
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
            );
          })}
        </>
      );
    }
    case "projects": {
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
              <div key={proj.id} data-project-item className="mb-2 border border-slate-200 rounded-md px-2.5 py-2 break-inside-avoid">
                <div className="flex items-baseline gap-2">
                  <strong style={{ fontSize: "1.05em" }}>
                    {proj.name || "Project"}
                  </strong>
                  {proj.completionDate && (
                    <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                      • {proj.completionDate}
                    </span>
                  )}
                  {proj.technologies && (
                    <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
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
            );
          })}
        </>
      );
    }
    case "languages":
      {
      const languageList = languageItems ?? languages;
      if (!languageList.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No languages added
          </p>
        );
      return (
        <div className="space-y-1">
          {languageList.map((lang) => (
            <div key={lang.id} data-lang-item>
              <span>{lang.name}{" "}</span>
              <span className="text-gray-500" style={{ fontSize: "0.85em" }}>
                ({lang.proficiency})
              </span>
            </div>
          ))}
        </div>
      );
      }
    case "skills":
      {
      const skillList = skillItems ?? skills;
      if (!skillList.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No skills added
          </p>
        );
      return (
        <div className="space-y-1">
          {skillList.map((sk) => (
            <div
              key={sk.id}
              data-skill-item
              className="inline-block px-2 py-0.5 rounded"
              style={{
                background: style.accentColor + "20",
                color: style.accentColor,
                fontSize: "0.85em",
              }}
            >
              {sk.name}
            </div>
          ))}
        </div>
      );
      }
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
      {
      const interestList = interestItems ?? interests;
      if (!interestList.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No interests added
          </p>
        );
      return (
        <div className="space-y-1">
          {interestList.map((i) => (
            <div
              key={i.id}
              data-interest-item
              className="px-2 py-0.5 rounded bg-gray-100 text-gray-700"
              style={{ fontSize: "0.85em", display: "inline-block" }}
            >
              {i.name}
            </div>
          ))}
        </div>
      );
      }
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
  const withProtocol = (value: string) => {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return trimmed;
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  };
  const iconNode = (type: keyof typeof CONTACT_ICONS) => {
    if (!showHeaderIcons) return null;
    return (
      <span
        aria-hidden="true"
        className={`inline-block leading-none ${type === 'email' ? 'text-[1.08em]' : 'text-[1em]'}`}
      >
        {CONTACT_ICONS[type]}{' '}
      </span>
    );
  };

  const items = [
    personalInfo.email && <span key="email">{iconNode('email')}{personalInfo.email}</span>,
    personalInfo.phone && <span key="phone">{iconNode('phone')}{personalInfo.phone}</span>,
    personalInfo.location && <span key="location">{iconNode('location')}{personalInfo.location}</span>,
    personalInfo.linkedin && <a key="linkedin" href={withProtocol(personalInfo.linkedin)} target="_blank" rel="noopener noreferrer" style={linkStyle}>{iconNode('linkedin')}{personalInfo.linkedin}</a>,
    personalInfo.website && <a key="website" href={withProtocol(personalInfo.website)} target="_blank" rel="noopener noreferrer" style={linkStyle}>{iconNode('website')}{personalInfo.website}</a>,
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
      const pageRect = headerRef.current
        .closest(".resume-page")
        ?.getBoundingClientRect();
      const pageTopMarginPx = 12;

      const x = Math.max(
        0,
        Math.min(100, ((e.clientX - rect.left) / rect.width) * 100),
      );

      const minCenterYInViewport = pageRect
        ? pageRect.top + pageTopMarginPx + photo.size / 2
        : rect.top + photo.size / 2;
      const minYPercent = ((minCenterYInViewport - rect.top) / rect.height) * 100;

      const y = Math.max(
        minYPercent,
        Math.min(130, ((e.clientY - rect.top) / rect.height) * 100),
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
  onPreviewInteract,
}: {
  layout: LayoutType;
  style: StyleConfig;
  photo: PhotoConfig;
  onPreviewInteract?: () => void;
}) {
  const { personalInfo } = useResumeStore();
  const { focusPanel } = useUIStore();
  const headerRef = useRef<HTMLDivElement>(null);

  const handleHeaderClick = () => {
    focusPanel('panel-header');
    onPreviewInteract?.();
  };

  // Compute text alignment offset based on photo position
  const photoOnLeft = photo.url && photo.x < 35;
  const photoOnRight = photo.url && photo.x > 65;
  const textPadding = photo.url ? `${photo.size + 16}px` : "0";
  const baseHeaderMinHeight =
    layout === "modern"
      ? (photo.url ? Math.max(100, photo.size + 32) : 80)
      : layout === "compact"
        ? (photo.url ? Math.max(60, photo.size * 0.7 + 16) : 0)
        : (photo.url ? Math.max(80, photo.size + 16) : 0);
  // If the photo is dragged above the header top edge, descend the header
  // content block below the photo's bottom edge so it never covers the name.
  const topPhotoOffsetPx = (() => {
    if (!photo.url) return 0;
    const photoCenterFromHeaderTopPx = (photo.y / 100) * Math.max(baseHeaderMinHeight, 1);
    const photoTopFromHeaderTopPx = photoCenterFromHeaderTopPx - photo.size / 2;
    if (photoTopFromHeaderTopPx >= 0) return 0;
    const photoBottomFromHeaderTopPx = photoCenterFromHeaderTopPx + photo.size / 2;
    return Math.ceil(Math.max(0, photoBottomFromHeaderTopPx) + 12);
  })();

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
        onClick={handleHeaderClick}
        className="text-white -mx-12 -mt-12 mb-6 px-8 py-8 relative cursor-pointer"
        style={{
          background: s.accentColor,
          minHeight: photo.url ? baseHeaderMinHeight + topPhotoOffsetPx : 80,
        }}
      >
        <DraggablePhoto photo={photo} headerRef={headerRef} />
        <div
          className={textAlign}
          style={{
            paddingLeft: photoOnLeft ? textPadding : 0,
            paddingRight: photoOnRight ? textPadding : 0,
            paddingTop: topPhotoOffsetPx > 0 ? `${topPhotoOffsetPx}px` : 0,
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
        onClick={handleHeaderClick}
        className="mb-3 pb-2 relative cursor-pointer"
        style={{
          borderBottom: `2px solid ${s.accentColor}`,
          minHeight: photo.url ? baseHeaderMinHeight + topPhotoOffsetPx : "auto",
        }}
      >
        <DraggablePhoto photo={photo} headerRef={headerRef} />
        <div
          style={{
            paddingLeft: photoOnLeft ? textPadding : 0,
            paddingRight: photoOnRight ? textPadding : 0,
            paddingTop: topPhotoOffsetPx > 0 ? `${topPhotoOffsetPx}px` : 0,
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
      onClick={handleHeaderClick}
      className="mb-4 relative cursor-pointer"
      style={{ minHeight: photo.url ? baseHeaderMinHeight + topPhotoOffsetPx : "auto" }}
    >
      <DraggablePhoto photo={photo} headerRef={headerRef} />
      <div
        className={textAlign}
        style={{
          paddingLeft: photoOnLeft ? textPadding : 0,
          paddingRight: photoOnRight ? textPadding : 0,
          paddingTop: topPhotoOffsetPx > 0 ? `${topPhotoOffsetPx}px` : 0,
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
  languageItems,
  skillItems,
  interestItems,
  onPreviewInteract,
}: {
  section: ResumeSection;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  languageItems?: Language[];
  skillItems?: Skill[];
  interestItems?: Interest[];
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
      onClick={expandPanel}
      data-page-section
      data-section-type={section.type}
      data-section-id={section.id}
      data-section-zone={section.zone}
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
        languageItems={section.type === "languages" ? languageItems : undefined}
        skillItems={section.type === "skills" ? skillItems : undefined}
        interestItems={section.type === "interests" ? interestItems : undefined}
      />
    </div>
  );
}

function ResumeStaticSection({
  section,
  experienceItems,
  projectItems,
  languageItems,
  skillItems,
  interestItems,
  onPreviewInteract,
}: {
  section: ResumeSection;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  languageItems?: Language[];
  skillItems?: Skill[];
  interestItems?: Interest[];
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
      onClick={expandPanel}
      data-page-section
      data-section-type={section.type}
      data-section-id={section.id}
      data-section-zone={section.zone}
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
        languageItems={section.type === "languages" ? languageItems : undefined}
        skillItems={section.type === "skills" ? skillItems : undefined}
        interestItems={section.type === "interests" ? interestItems : undefined}
      />
    </div>
  );
}

function ResumeProxyDraggableSection({
  section,
  proxyId,
  experienceItems,
  projectItems,
  languageItems,
  skillItems,
  interestItems,
  onPreviewInteract,
}: {
  section: ResumeSection;
  proxyId: string;
  experienceItems?: WorkExperience[];
  projectItems?: Project[];
  languageItems?: Language[];
  skillItems?: Skill[];
  interestItems?: Interest[];
  onPreviewInteract?: (section: ResumeSection) => void;
}) {
  const { style } = useResumeStore();
  const { showBodyIcons, sectionIcons, focusPanel } = useUIStore();
  const headingClass = `${getHeadingSizeClass(style.headingSize)} font-bold uppercase tracking-wider pb-1 mb-2`;
  const iconVisible = showBodyIcons && (sectionIcons[section.id] ?? true);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: proxyId,
    data: {
      origin: "resume-proxy",
      sectionId: section.id,
      zone: section.zone,
      type: section.type,
    },
  });

  const containerStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };

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
      onClick={expandPanel}
      data-page-section
      data-section-type={section.type}
      data-section-id={section.id}
      data-section-zone={section.zone}
      className={`${getSpacingClass(style.sectionSpacing)} relative rounded p-2 active:cursor-grabbing`}
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
        languageItems={section.type === "languages" ? languageItems : undefined}
        skillItems={section.type === "skills" ? skillItems : undefined}
        interestItems={section.type === "interests" ? interestItems : undefined}
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

const LOCALE_OPTIONS: { code: LocaleCode; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fi", label: "Finnish", flag: "🇫🇮" },
  { code: "sv", label: "Swedish", flag: "🇸🇪" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "ne", label: "Nepali", flag: "🇳🇵" },
  { code: "zh", label: "Mandarin", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
];

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
  const { style, activeLocale } = useResumeStore();
  const { sectionIcons, setSectionIcon } = useUIStore();
  const ui = getUiText(activeLocale);
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
              {ui.showIconOnResume}
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
    activeLocale,
    personalInfo,
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
  const ui = getUiText(activeLocale);
  const selectedLocaleFlag = LOCALE_OPTIONS.find((option) => option.code === activeLocale)?.flag ?? "🇬🇧";
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

  const trackExportSuccess = useCallback((method: "react_to_print" | "window_print") => {
    trackAnalyticsEvent("pdf_export_success", {
      method,
      layout,
    });

    // Keep a server-side app-wide counter for successful PDF exports.
    void fetch("/api/analytics/export-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method,
        layout,
        email: personalInfo.email,
      }),
    }).catch(() => {
      // Avoid blocking the export flow if analytics logging fails.
    });
  }, [layout, personalInfo.email]);

  const handleWindowPrint = useCallback(() => {
    if (typeof window === "undefined") return;

    const handleAfterPrint = () => {
      trackExportSuccess("window_print");
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    window.print();
  }, [trackExportSuccess]);

  const handlePrint = useReactToPrint({
    contentRef: resumeRef,
    documentTitle: "Resume",
    // Override the global print CSS that uses position:absolute (needed for window.print()
    // visibility trick) — in useReactToPrint's isolated iframe the content is already the
    // only thing on the page, so static positioning is correct and prevents blank output.
    pageStyle: "@media print { body * { visibility: visible !important; } .resume-pages { position: static !important; } }",
    onAfterPrint: () => {
      trackExportSuccess("react_to_print");
    },
  });

  const handleExportPdf = useCallback(() => {
    try {
      handlePrint?.();
    } catch {
      handleWindowPrint();
    }
  }, [handlePrint, handleWindowPrint]);

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    setActiveDragId(data?.sectionId ?? (event.active.id as string));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const data = active.data.current;
    const sectionId = data?.sectionId ?? (active.id as string);
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
    const sectionId = data?.sectionId ?? (active.id as string);
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
  const PAGE_PAD_BOTTOM = 24;
  const USABLE_HEIGHT = PAGE_HEIGHT - PAGE_PAD - PAGE_PAD_BOTTOM;
  const MEASURE_USABLE_HEIGHT = layout === "two-column" ? USABLE_HEIGHT - 28 : USABLE_HEIGHT;
  const SPLIT_SAFETY_PX = 2;
  const FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX = layout === "two-column" ? 12 : 12;
  const CONTINUATION_DETAIL_SPLIT_BUFFER_PX = layout === "two-column" ? 48 : 120;
  const SIDEBAR_FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX = layout === "two-column" ? 24 : FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX;
  const SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX = layout === "two-column" ? 72 : CONTINUATION_DETAIL_SPLIT_BUFFER_PX;
  const TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT = 930;

  // Track which section index starts page 2+
  const [pageSplitIndex, setPageSplitIndex] = useState<number>(-1);
  const [detailSplitSectionType, setDetailSplitSectionType] = useState<"experience" | "projects" | null>(null);
  const [detailSplitSectionIndex, setDetailSplitSectionIndex] = useState<number | null>(null);
  const [detailSplitItemIndex, setDetailSplitItemIndex] = useState<number | null>(null);
  const [sidebarContinuationChunks, setSidebarContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [mainSectionContinuationChunks, setMainSectionContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [sidebarDetailSplitSectionType, setSidebarDetailSplitSectionType] = useState<"skills" | "languages" | "interests" | "experience" | "projects" | null>(null);
  const [sidebarDetailSplitSectionId, setSidebarDetailSplitSectionId] = useState<string | null>(null);
  const [sidebarDetailSplitItemIndex, setSidebarDetailSplitItemIndex] = useState<number | null>(null);
  const [sidebarDetailContinuationChunks, setSidebarDetailContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [sidebarCarrySectionId, setSidebarCarrySectionId] = useState<string | null>(null);
  const [sidebarCarryItemCount, setSidebarCarryItemCount] = useState<number>(0);
  const [sidebarTrailingDetailSplitSectionType, setSidebarTrailingDetailSplitSectionType] = useState<"experience" | "projects" | null>(null);
  const [sidebarTrailingDetailSplitSectionId, setSidebarTrailingDetailSplitSectionId] = useState<string | null>(null);
  const [sidebarTrailingDetailContinuationChunks, setSidebarTrailingDetailContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [sidebarTrailingDetailTransitionItemEnd, setSidebarTrailingDetailTransitionItemEnd] = useState<number>(0);
  const [detailContinuationChunks, setDetailContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [trailingDetailSplitSectionType, setTrailingDetailSplitSectionType] = useState<"experience" | "projects" | null>(null);
  const [trailingDetailSplitSectionId, setTrailingDetailSplitSectionId] = useState<string | null>(null);
  const [trailingDetailContinuationChunks, setTrailingDetailContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [trailingDetailTransitionItemEnd, setTrailingDetailTransitionItemEnd] = useState<number>(0);

  useEffect(() => {
    if (!contentRef.current) return;
    const measure = () => {
      if (!contentRef.current) return;
      const container = contentRef.current;
      const containerRect = container.getBoundingClientRect();
      const buildChunks = (itemHeights: number[], startIndex: number, capacity: number) => {
        const chunks: Array<{ start: number; end: number }> = [];
        let start = Math.max(0, startIndex);

        while (start < itemHeights.length) {
          let end = start;
          let used = 0;

          while (end < itemHeights.length) {
            const nextHeight = itemHeights[end];
            if (end > start && used + nextHeight > capacity) break;
            used += nextHeight;
            end += 1;
          }

          chunks.push({ start, end });
          start = end;
        }

        return chunks;
      };
      const sections = container.querySelectorAll(
        layout === "two-column"
          ? '[data-page-section][data-section-zone="main"]'
          : "[data-page-section]",
      );
      const twoColumnContainer = layout === "two-column"
        ? (container.querySelector("[data-measure-two-column]") as HTMLElement | null)
        : null;
      const twoColumnTopOffset = twoColumnContainer
        ? twoColumnContainer.getBoundingClientRect().top - containerRect.top
        : 0;
      const pageContentHeight = layout === "two-column"
        ? TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT
        : MEASURE_USABLE_HEIGHT;
      const pageSplitThreshold = layout === "two-column"
        ? twoColumnTopOffset + pageContentHeight
        : pageContentHeight;
      if (layout === "two-column") {
        const sidebarMeasuredSections = Array.from(
          container.querySelectorAll('[data-page-section][data-section-zone="sidebar"]')
        ) as HTMLElement[];
        const sidebarHeights = sidebarMeasuredSections.map((section) => {
          const rect = section.getBoundingClientRect();
          const styles = window.getComputedStyle(section as Element);
          const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
          const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
          return rect.height + marginTop + marginBottom;
        });
        const sidebarCapacity = Math.max(
          120,
          pageContentHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
        );
        const chunks = buildChunks(sidebarHeights, 0, sidebarCapacity);
        setSidebarContinuationChunks(chunks);

        const firstChunk = chunks[0] ?? { start: 0, end: sidebarMeasuredSections.length };
        const carryCandidate = firstChunk.end < sidebarMeasuredSections.length
          ? sidebarMeasuredSections[firstChunk.end]
          : null;

        if (carryCandidate) {
          const carryType = carryCandidate.dataset?.sectionType;
          const carryCanSplit =
            carryType === "experience" ||
            carryType === "projects" ||
            carryType === "languages" ||
            carryType === "skills" ||
            carryType === "interests";

          if (carryCanSplit) {
            const carrySelector =
              carryType === "experience"
                ? "[data-exp-item]"
                : carryType === "projects"
                  ? "[data-project-item]"
                  : carryType === "languages"
                    ? "[data-lang-item]"
                    : carryType === "skills"
                      ? "[data-skill-item]"
                      : "[data-interest-item]";
            const carryItems = carryCandidate.querySelectorAll(carrySelector);
            const carryItemHeights = Array.from(carryItems).map((item) => {
              const rect = item.getBoundingClientRect();
              const styles = window.getComputedStyle(item as Element);
              const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
              const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
              return rect.height + marginTop + marginBottom;
            });
            const carryItemsTotalHeight = carryItemHeights.reduce((acc, height) => acc + height, 0);
            const carryRect = carryCandidate.getBoundingClientRect();
            const carryChromeHeight = Math.max(0, carryRect.height - carryItemsTotalHeight);
            const usedByPrecedingSections = sidebarHeights
              .slice(firstChunk.start, firstChunk.end)
              .reduce((acc, height) => acc + height, 0);
            const availableForCarryItems = Math.max(
              0,
              pageContentHeight - usedByPrecedingSections - carryChromeHeight - SIDEBAR_FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX
            );

            let carryCount = 0;
            let carryUsed = 0;
            for (let i = 0; i < carryItemHeights.length; i++) {
              const next = carryItemHeights[i];
              if (i > 0 && carryUsed + next > availableForCarryItems) break;
              carryUsed += next;
              carryCount += 1;
              if (i === 0 && carryUsed > availableForCarryItems) {
                carryCount = 1;
                break;
              }
            }

            setSidebarCarrySectionId(carryCandidate.dataset?.sectionId ?? null);
            setSidebarCarryItemCount(carryCount);
          } else {
            setSidebarCarrySectionId(null);
            setSidebarCarryItemCount(0);
          }
        } else {
          setSidebarCarrySectionId(null);
          setSidebarCarryItemCount(0);
        }

        const sidebarOverflowSection = sidebarMeasuredSections.find((section) => {
          const rect = section.getBoundingClientRect();
          const sectionBottom = rect.top - containerRect.top + rect.height;
          return sectionBottom >= pageSplitThreshold - SPLIT_SAFETY_PX;
        });

        const sidebarOverflowType = sidebarOverflowSection?.dataset?.sectionType;
        const sidebarCanSplit =
          sidebarOverflowType === "experience" ||
          sidebarOverflowType === "projects" ||
          sidebarOverflowType === "skills" ||
          sidebarOverflowType === "languages" ||
          sidebarOverflowType === "interests";

        if (sidebarOverflowSection && sidebarCanSplit) {
          const itemSelector =
            sidebarOverflowType === "experience"
              ? "[data-exp-item]"
              : sidebarOverflowType === "projects"
                ? "[data-project-item]"
                : sidebarOverflowType === "languages"
              ? "[data-lang-item]"
              : sidebarOverflowType === "skills"
                ? "[data-skill-item]"
                : "[data-interest-item]";
          const detailItems = sidebarOverflowSection.querySelectorAll(itemSelector);
          let itemSplit = -1;

          for (let i = 0; i < detailItems.length; i++) {
            const itemRect = detailItems[i].getBoundingClientRect();
            const itemBottom = itemRect.top - containerRect.top + itemRect.height;
            if (itemBottom >= pageSplitThreshold - SPLIT_SAFETY_PX - SIDEBAR_FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX) {
              itemSplit = i;
              break;
            }
          }

          if (itemSplit === -1) itemSplit = detailItems.length;
          const itemHeights = Array.from(detailItems).map((item) => {
            const rect = item.getBoundingClientRect();
            const styles = window.getComputedStyle(item as Element);
            const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
            const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
            return rect.height + marginTop + marginBottom;
          });

          const itemsTotalHeight = itemHeights.reduce((acc, height) => acc + height, 0);
          const sectionRect = sidebarOverflowSection.getBoundingClientRect();
          const sectionChromeHeight = Math.max(0, sectionRect.height - itemsTotalHeight);
          const perPageItemsCapacityRaw = Math.max(120, pageContentHeight - sectionChromeHeight);
          const perPageItemsCapacity = Math.max(
            120,
            perPageItemsCapacityRaw - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
          );
          const chunks = buildChunks(itemHeights, itemSplit, perPageItemsCapacity);

          const lastPrimaryChunk = chunks[chunks.length - 1];
          const usedLastPrimaryChunk = lastPrimaryChunk
            ? itemHeights
                .slice(lastPrimaryChunk.start, lastPrimaryChunk.end)
                .reduce((acc, height) => acc + height, 0)
            : 0;
          const leftoverOnLastPrimaryPage = Math.max(0, perPageItemsCapacityRaw - usedLastPrimaryChunk);

          const sidebarOrder = sectionOrder.filter((section) => section.zone === "sidebar");
          const splitSectionId = sidebarOverflowSection.dataset?.sectionId;
          const splitSidebarIndex = splitSectionId
            ? sidebarOrder.findIndex((section) => section.id === splitSectionId)
            : -1;
          const trailingSequence = splitSidebarIndex === -1 ? [] : sidebarOrder.slice(splitSidebarIndex + 1);

          const trailingSplitSection = trailingSequence.find(
            (section) => section.type === "experience" || section.type === "projects"
          );

          if (trailingSplitSection) {
            const trailingElement = sidebarMeasuredSections.find(
              (section) => section.dataset?.sectionId === trailingSplitSection.id
            );

            if (trailingElement) {
              const trailingSelector =
                trailingSplitSection.type === "experience" ? "[data-exp-item]" : "[data-project-item]";
              const trailingItems = trailingElement.querySelectorAll(trailingSelector);
              const trailingItemHeights = Array.from(trailingItems).map((item) => {
                const rect = item.getBoundingClientRect();
                const styles = window.getComputedStyle(item as Element);
                const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
                const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
                return rect.height + marginTop + marginBottom;
              });
              const trailingItemsTotalHeight = trailingItemHeights.reduce((acc, height) => acc + height, 0);
              const trailingRect = trailingElement.getBoundingClientRect();
              const trailingChromeHeight = Math.max(0, trailingRect.height - trailingItemsTotalHeight);
              const availableOnPrimaryLastPageForTrailingItems = Math.max(
                0,
                leftoverOnLastPrimaryPage - trailingChromeHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
              );

              let transitionItemEnd = 0;
              let transitionUsed = 0;
              while (transitionItemEnd < trailingItemHeights.length) {
                const nextHeight = trailingItemHeights[transitionItemEnd];
                if (
                  transitionItemEnd > 0 &&
                  transitionUsed + nextHeight > availableOnPrimaryLastPageForTrailingItems
                ) {
                  break;
                }
                transitionUsed += nextHeight;
                transitionItemEnd += 1;
              }

              const trailingCapacity = Math.max(
                120,
                pageContentHeight - trailingChromeHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
              );
              const trailingChunks = buildChunks(trailingItemHeights, transitionItemEnd, trailingCapacity);
              const trailingType =
                trailingSplitSection.type === "experience" ? "experience" : "projects";

              setSidebarTrailingDetailSplitSectionType(trailingType);
              setSidebarTrailingDetailSplitSectionId(trailingSplitSection.id);
              setSidebarTrailingDetailContinuationChunks(trailingChunks);
              setSidebarTrailingDetailTransitionItemEnd(transitionItemEnd);
            } else {
              setSidebarTrailingDetailSplitSectionType(null);
              setSidebarTrailingDetailSplitSectionId(null);
              setSidebarTrailingDetailContinuationChunks([]);
              setSidebarTrailingDetailTransitionItemEnd(0);
            }
          } else {
            setSidebarTrailingDetailSplitSectionType(null);
            setSidebarTrailingDetailSplitSectionId(null);
            setSidebarTrailingDetailContinuationChunks([]);
            setSidebarTrailingDetailTransitionItemEnd(0);
          }

          setSidebarDetailSplitSectionType(sidebarOverflowType);
          setSidebarDetailSplitSectionId(sidebarOverflowSection.dataset?.sectionId ?? null);
          setSidebarDetailSplitItemIndex(itemSplit);
          setSidebarDetailContinuationChunks(chunks);
        } else {
          setSidebarDetailSplitSectionType(null);
          setSidebarDetailSplitSectionId(null);
          setSidebarDetailSplitItemIndex(null);
          setSidebarDetailContinuationChunks([]);
          setSidebarTrailingDetailSplitSectionType(null);
          setSidebarTrailingDetailSplitSectionId(null);
          setSidebarTrailingDetailContinuationChunks([]);
          setSidebarTrailingDetailTransitionItemEnd(0);
        }

        const mainHeights = Array.from(sections).map((section) => {
          const rect = (section as HTMLElement).getBoundingClientRect();
          const styles = window.getComputedStyle(section as Element);
          const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
          const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
          return rect.height + marginTop + marginBottom;
        });
        const mainCapacity = Math.max(120, pageContentHeight - 8);
        setMainSectionContinuationChunks(buildChunks(mainHeights, 0, mainCapacity));
      } else {
        setSidebarContinuationChunks([]);
        setMainSectionContinuationChunks([]);
        setSidebarDetailSplitSectionType(null);
        setSidebarDetailSplitSectionId(null);
        setSidebarDetailSplitItemIndex(null);
        setSidebarDetailContinuationChunks([]);
        setSidebarCarrySectionId(null);
        setSidebarCarryItemCount(0);
        setSidebarTrailingDetailSplitSectionType(null);
        setSidebarTrailingDetailSplitSectionId(null);
        setSidebarTrailingDetailContinuationChunks([]);
        setSidebarTrailingDetailTransitionItemEnd(0);
      }
      let splitIdx = -1;
      let overflowMeasuredSection: HTMLElement | null = null;
      for (let i = 0; i < sections.length; i++) {
        const el = sections[i] as HTMLElement;
        const rect = el.getBoundingClientRect();
        const elBottom = rect.top - containerRect.top + rect.height;
        if (elBottom >= pageSplitThreshold - SPLIT_SAFETY_PX) {
          overflowMeasuredSection = el;
          if (layout === "two-column") {
            const sectionId = el.dataset?.sectionId;
            splitIdx = sectionId
              ? sectionOrder.findIndex((section) => section.id === sectionId)
              : -1;
          } else {
            splitIdx = i;
          }
          break;
        }
      }
      setPageSplitIndex(splitIdx);
      if (splitIdx !== -1 && overflowMeasuredSection) {
        const overflowSection = overflowMeasuredSection;
        const overflowType = overflowSection?.dataset?.sectionType;
        const isSplitType = overflowType === "experience" || overflowType === "projects";
        if (isSplitType) {
          const itemSelector = overflowType === "experience" ? "[data-exp-item]" : "[data-project-item]";
          const detailItems = overflowSection.querySelectorAll(itemSelector);
          let itemSplit = -1;

          for (let i = 0; i < detailItems.length; i++) {
            const itemRect = detailItems[i].getBoundingClientRect();
            const itemBottom = itemRect.top - containerRect.top + itemRect.height;
            if (itemBottom >= pageSplitThreshold - SPLIT_SAFETY_PX - FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX) {
              itemSplit = i;
              break;
            }
          }

          if (itemSplit === -1) {
            itemSplit = detailItems.length;
          }
          const itemHeights = Array.from(detailItems).map((item) => {
            const rect = item.getBoundingClientRect();
            const styles = window.getComputedStyle(item as Element);
            const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
            const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
            return rect.height + marginTop + marginBottom;
          });

          const itemsTotalHeight = itemHeights.reduce((acc, height) => acc + height, 0);
          const sectionRect = overflowSection.getBoundingClientRect();
          const sectionChromeHeight = Math.max(0, sectionRect.height - itemsTotalHeight);
          const perPageItemsCapacityRaw = Math.max(120, pageContentHeight - sectionChromeHeight);
          const perPageItemsCapacity = Math.max(
            120,
            perPageItemsCapacityRaw - FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX
          );

          const chunks = buildChunks(itemHeights, itemSplit, perPageItemsCapacity);
          const lastPrimaryChunk = chunks[chunks.length - 1];
          const usedLastPrimaryChunk = lastPrimaryChunk
            ? itemHeights
                .slice(lastPrimaryChunk.start, lastPrimaryChunk.end)
                .reduce((acc, height) => acc + height, 0)
            : 0;
          const leftoverOnLastPrimaryPage = Math.max(0, perPageItemsCapacityRaw - usedLastPrimaryChunk);

          const trailingSequence = (() => {
            if (layout === "two-column") {
              const splitSectionId = overflowSection?.dataset?.sectionId;
              const mainOrder = sectionOrder.filter((section) => section.zone === "main");
              const splitMainIndex = splitSectionId
                ? mainOrder.findIndex((section) => section.id === splitSectionId)
                : -1;
              return splitMainIndex === -1 ? [] : mainOrder.slice(splitMainIndex + 1);
            }

            return sectionOrder.slice(splitIdx + 1);
          })();

          const trailingSplitSection = trailingSequence.find(
            (section) => section.type === "experience" || section.type === "projects"
          );

          if (trailingSplitSection) {
            const trailingElement = Array.from(sections).find(
              (section) => (section as HTMLElement).dataset?.sectionId === trailingSplitSection.id
            ) as HTMLElement | undefined;

            if (trailingElement) {
              const trailingSelector =
                trailingSplitSection.type === "experience" ? "[data-exp-item]" : "[data-project-item]";
              const trailingItems = trailingElement.querySelectorAll(trailingSelector);
              const trailingItemHeights = Array.from(trailingItems).map((item) => {
                const rect = item.getBoundingClientRect();
                const styles = window.getComputedStyle(item as Element);
                const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
                const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
                return rect.height + marginTop + marginBottom;
              });
              const trailingItemsTotalHeight = trailingItemHeights.reduce((acc, height) => acc + height, 0);
              const trailingRect = trailingElement.getBoundingClientRect();
              const trailingChromeHeight = Math.max(0, trailingRect.height - trailingItemsTotalHeight);
              const availableOnPrimaryLastPageForTrailingItems = Math.max(
                0,
                leftoverOnLastPrimaryPage - trailingChromeHeight - CONTINUATION_DETAIL_SPLIT_BUFFER_PX
              );
              let transitionItemEnd = 0;
              let transitionUsed = 0;
              while (transitionItemEnd < trailingItemHeights.length) {
                const nextHeight = trailingItemHeights[transitionItemEnd];
                if (
                  transitionItemEnd > 0 &&
                  transitionUsed + nextHeight > availableOnPrimaryLastPageForTrailingItems
                ) {
                  break;
                }
                transitionUsed += nextHeight;
                transitionItemEnd += 1;
              }
              const trailingCapacity = Math.max(
                120,
                pageContentHeight - trailingChromeHeight - CONTINUATION_DETAIL_SPLIT_BUFFER_PX
              );
              const trailingChunks = buildChunks(trailingItemHeights, transitionItemEnd, trailingCapacity);
              const trailingType =
                trailingSplitSection.type === "experience" ? "experience" : "projects";

              setTrailingDetailSplitSectionType(trailingType);
              setTrailingDetailSplitSectionId(trailingSplitSection.id);
              setTrailingDetailContinuationChunks(trailingChunks);
              setTrailingDetailTransitionItemEnd(transitionItemEnd);
            } else {
              setTrailingDetailSplitSectionType(null);
              setTrailingDetailSplitSectionId(null);
              setTrailingDetailContinuationChunks([]);
              setTrailingDetailTransitionItemEnd(0);
            }
          } else {
            setTrailingDetailSplitSectionType(null);
            setTrailingDetailSplitSectionId(null);
            setTrailingDetailContinuationChunks([]);
            setTrailingDetailTransitionItemEnd(0);
          }

          setDetailSplitSectionType(overflowType);
          setDetailSplitSectionIndex(splitIdx);
          setDetailSplitItemIndex(itemSplit);
          setDetailContinuationChunks(chunks);
        } else {
          setDetailSplitSectionType(null);
          setDetailSplitSectionIndex(null);
          setDetailSplitItemIndex(null);
          setDetailContinuationChunks([]);
          setTrailingDetailSplitSectionType(null);
          setTrailingDetailSplitSectionId(null);
          setTrailingDetailContinuationChunks([]);
          setTrailingDetailTransitionItemEnd(0);
        }
      } else {
        setDetailSplitSectionType(null);
        setDetailSplitSectionIndex(null);
        setDetailSplitItemIndex(null);
        setDetailContinuationChunks([]);
        setTrailingDetailSplitSectionType(null);
        setTrailingDetailSplitSectionId(null);
        setTrailingDetailContinuationChunks([]);
        setTrailingDetailTransitionItemEnd(0);
      }
      setPageCount(splitIdx === -1 ? 1 : 2);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(contentRef.current);
    measure();
    return () => observer.disconnect();
  }, [layout, sectionOrder, experience, projects, USABLE_HEIGHT, s.fontSize, s.headingSize, s.sectionSpacing, s.sidebarWidth]);

  if (!mounted) return null;

  const mainSections = sectionOrder.filter((sec) => sec.zone === "main");
  const sidebarSections = sectionOrder.filter((sec) => sec.zone === "sidebar");
  const mainPageSplitIndex =
    pageSplitIndex === -1
      ? -1
      : sectionOrder
          .slice(0, pageSplitIndex)
          .filter((section) => section.zone === "main").length;
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
    padding: layout === "compact"
      ? `32px 32px ${PAGE_PAD_BOTTOM}px 32px`
      : `48px 48px ${PAGE_PAD_BOTTOM}px 48px`,
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
    ? Math.max(0, Math.min(detailSplitItemIndex!, splitItemsLength))
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

  const detailSplitMainIndex =
    splitSectionCandidate && splitSectionCandidate.zone === "main"
      ? mainSections.findIndex((section) => section.id === splitSectionCandidate.id)
      : -1;

  const canUseMainDetailSplit =
    canUseDetailSplit && splitSectionCandidate?.zone === "main" && detailSplitMainIndex !== -1;

  const effectiveContinuationChunks =
    canUseDetailSplit
      ? (
          detailContinuationChunks.length > 0
            ? detailContinuationChunks
            : clampedDetailSplitIndex! < splitItemsLength
              ? [{ start: clampedDetailSplitIndex!, end: splitItemsLength }]
              : []
        )
      : [];

  const linearTrailingSections =
    detailSplitSectionIndex !== null ? sectionOrder.slice(detailSplitSectionIndex + 1) : [];
  const twoColumnTrailingSections =
    detailSplitMainIndex !== -1 ? mainSections.slice(detailSplitMainIndex + 1) : [];

  const sequenceAfterPrimarySplit =
    splitSectionCandidate?.zone === "main"
      ? twoColumnTrailingSections
      : linearTrailingSections;

  const trailingSplitIndex = trailingDetailSplitSectionId
    ? sequenceAfterPrimarySplit.findIndex((section) => section.id === trailingDetailSplitSectionId)
    : -1;

  const hasTrailingDetailSplit =
    trailingSplitIndex !== -1 &&
    trailingDetailSplitSectionType !== null;

  const trailingSplitSection =
    hasTrailingDetailSplit && trailingSplitIndex !== -1
      ? sequenceAfterPrimarySplit[trailingSplitIndex]
      : null;

  const trailingAfterSections =
    trailingSplitIndex !== -1
      ? sequenceAfterPrimarySplit.slice(trailingSplitIndex + 1)
      : sequenceAfterPrimarySplit;

  const trailingSplitItemsLength =
    trailingDetailSplitSectionType === "projects" ? sortedProjects.length : sortedExperience.length;

  const clampedTrailingTransitionItemEnd = hasTrailingDetailSplit
    ? Math.max(0, Math.min(trailingDetailTransitionItemEnd, trailingSplitItemsLength))
    : 0;

  const effectiveTrailingContinuationChunks =
    hasTrailingDetailSplit
      ? (
          trailingDetailContinuationChunks.length > 0
            ? trailingDetailContinuationChunks
            : clampedTrailingTransitionItemEnd < trailingSplitItemsLength
              ? [{ start: clampedTrailingTransitionItemEnd, end: trailingSplitItemsLength }]
              : []
        )
      : [];

  const primaryContinuationPageCount =
    pageSplitIndex === -1
      ? 0
      : canUseDetailSplit
        ? (
            hasTrailingDetailSplit
              ? effectiveContinuationChunks.length
              : Math.max(effectiveContinuationChunks.length, sequenceAfterPrimarySplit.length > 0 ? 1 : 0)
          )
        : 1;

  const trailingContinuationPageCount =
    pageSplitIndex === -1 || !hasTrailingDetailSplit
      ? 0
      : Math.max(
          effectiveTrailingContinuationChunks.length,
          trailingAfterSections.length > 0 ? 1 : 0
        );

  const effectiveSidebarChunks =
    layout === "two-column"
      ? (sidebarContinuationChunks.length > 0
          ? sidebarContinuationChunks
          : [{ start: 0, end: sidebarSections.length }])
      : [];

  const sidebarSplitSectionIndex =
    sidebarDetailSplitSectionId
      ? sidebarSections.findIndex((section) => section.id === sidebarDetailSplitSectionId)
      : -1;

  const hasSidebarDetailSplit =
    layout === "two-column" &&
    sidebarSplitSectionIndex !== -1 &&
    sidebarDetailSplitSectionType !== null &&
    sidebarDetailSplitItemIndex !== null;

  const firstSidebarChunk = effectiveSidebarChunks[0] ?? { start: 0, end: sidebarSections.length };
  const carriedSidebarSection =
    !hasSidebarDetailSplit &&
    layout === "two-column" &&
    sidebarCarryItemCount > 0 &&
    firstSidebarChunk.end < sidebarSections.length
      ? sidebarSections.find((section) => section.id === sidebarCarrySectionId) ?? null
      : null;
  const canCarrySidebarSection =
    !!carriedSidebarSection &&
    (
      carriedSidebarSection.type === "experience" ||
      carriedSidebarSection.type === "projects" ||
      carriedSidebarSection.type === "languages" ||
      carriedSidebarSection.type === "skills" ||
      carriedSidebarSection.type === "interests"
    );

  const carriedSidebarTotalItems =
    canCarrySidebarSection && carriedSidebarSection
      ? carriedSidebarSection.type === "experience"
        ? sortedExperience.length
        : carriedSidebarSection.type === "projects"
          ? sortedProjects.length
          : carriedSidebarSection.type === "languages"
            ? languages.length
            : carriedSidebarSection.type === "skills"
              ? skills.length
              : carriedSidebarSection.type === "interests"
                ? interests.length
                : 0
      : 0;

  const hasRemainingCarriedSidebarItems =
    canCarrySidebarSection && sidebarCarryItemCount < carriedSidebarTotalItems;

  const firstSidebarContinuationChunk = effectiveSidebarChunks[1];
  const firstSidebarContinuationWithoutCarryCount =
    canCarrySidebarSection && carriedSidebarSection && firstSidebarContinuationChunk
      ? sidebarSections
          .slice(firstSidebarContinuationChunk.start, firstSidebarContinuationChunk.end)
          .filter((section) => section.id !== carriedSidebarSection.id).length
      : 0;

  const skipFirstSidebarContinuationChunk =
    !hasSidebarDetailSplit &&
    canCarrySidebarSection &&
    !!firstSidebarContinuationChunk &&
    !hasRemainingCarriedSidebarItems &&
    firstSidebarContinuationWithoutCarryCount === 0;

  const sidebarContinuationChunkOffset = skipFirstSidebarContinuationChunk ? 1 : 0;

  const sidebarSplitItemsLength =
    sidebarDetailSplitSectionType === "experience"
      ? sortedExperience.length
      : sidebarDetailSplitSectionType === "projects"
        ? sortedProjects.length
        : sidebarDetailSplitSectionType === "skills"
      ? skills.length
      : sidebarDetailSplitSectionType === "languages"
        ? languages.length
        : sidebarDetailSplitSectionType === "interests"
          ? interests.length
        : 0;

  const clampedSidebarSplitItemIndex = hasSidebarDetailSplit
    ? Math.max(0, Math.min(sidebarDetailSplitItemIndex!, sidebarSplitItemsLength))
    : 0;

  const effectiveSidebarDetailChunks = hasSidebarDetailSplit
    ? (
        sidebarDetailContinuationChunks.length > 0
          ? sidebarDetailContinuationChunks
          : clampedSidebarSplitItemIndex < sidebarSplitItemsLength
            ? [{ start: clampedSidebarSplitItemIndex, end: sidebarSplitItemsLength }]
            : []
      )
    : [];

  const sidebarAfterSplitSections = hasSidebarDetailSplit
    ? sidebarSections.slice(sidebarSplitSectionIndex + 1)
    : [];

  const sidebarTrailingSplitIndex = sidebarTrailingDetailSplitSectionId
    ? sidebarAfterSplitSections.findIndex((section) => section.id === sidebarTrailingDetailSplitSectionId)
    : -1;

  const hasSidebarTrailingDetailSplit =
    sidebarTrailingSplitIndex !== -1 &&
    sidebarTrailingDetailSplitSectionType !== null;

  const sidebarTrailingSplitSection =
    hasSidebarTrailingDetailSplit && sidebarTrailingSplitIndex !== -1
      ? sidebarAfterSplitSections[sidebarTrailingSplitIndex]
      : null;

  const sidebarTrailingAfterSections =
    sidebarTrailingSplitIndex !== -1
      ? sidebarAfterSplitSections.slice(sidebarTrailingSplitIndex + 1)
      : sidebarAfterSplitSections;

  const sidebarBeforeTrailingSplitSections =
    sidebarTrailingSplitIndex !== -1
      ? sidebarAfterSplitSections.slice(0, sidebarTrailingSplitIndex)
      : [];

  const sidebarTrailingSplitItemsLength =
    sidebarTrailingDetailSplitSectionType === "projects"
      ? sortedProjects.length
      : sidebarTrailingDetailSplitSectionType === "experience"
        ? sortedExperience.length
        : 0;

  const clampedSidebarTrailingTransitionItemEnd = hasSidebarTrailingDetailSplit
    ? Math.max(0, Math.min(sidebarTrailingDetailTransitionItemEnd, sidebarTrailingSplitItemsLength))
    : 0;

  const effectiveSidebarTrailingContinuationChunks =
    hasSidebarTrailingDetailSplit
      ? (
          sidebarTrailingDetailContinuationChunks.length > 0
            ? sidebarTrailingDetailContinuationChunks
            : clampedSidebarTrailingTransitionItemEnd < sidebarTrailingSplitItemsLength
              ? [{ start: clampedSidebarTrailingTransitionItemEnd, end: sidebarTrailingSplitItemsLength }]
              : []
        )
      : [];

  const sidebarPrimaryContinuationPageCount = hasSidebarDetailSplit
    ? (
        hasSidebarTrailingDetailSplit
          ? effectiveSidebarDetailChunks.length
          : Math.max(effectiveSidebarDetailChunks.length, sidebarAfterSplitSections.length > 0 ? 1 : 0)
      )
    : 0;

  const sidebarTrailingContinuationPageCount = hasSidebarDetailSplit && hasSidebarTrailingDetailSplit
    ? Math.max(
        effectiveSidebarTrailingContinuationChunks.length,
        sidebarTrailingAfterSections.length > 0 ? 1 : 0
      )
    : 0;

  const effectiveMainSectionChunks =
    layout === "two-column"
      ? (mainSectionContinuationChunks.length > 0
          ? mainSectionContinuationChunks
          : [{ start: 0, end: mainSections.length }])
      : [];

  const sidebarContinuationPageCount =
    layout === "two-column"
      ? (hasSidebarDetailSplit
          ? sidebarPrimaryContinuationPageCount + sidebarTrailingContinuationPageCount
          : Math.max(0, effectiveSidebarChunks.length - 1 - sidebarContinuationChunkOffset))
      : 0;

  const mainSectionContinuationPageCount =
    layout === "two-column" && !canUseMainDetailSplit
      ? Math.max(0, effectiveMainSectionChunks.length - 1)
      : 0;

  const continuationPageCount =
    Math.max(
      primaryContinuationPageCount + trailingContinuationPageCount,
      sidebarContinuationPageCount,
      mainSectionContinuationPageCount
    );

  const renderTwoColumnSidebarPageOneSections = () => {
    if (hasSidebarDetailSplit) {
      const splitSection = sidebarSections[sidebarSplitSectionIndex];
      const beforeSplit = sidebarSections.slice(0, sidebarSplitSectionIndex);
      const splitLanguageItems = sidebarDetailSplitSectionType === "languages"
        ? languages.slice(0, clampedSidebarSplitItemIndex)
        : undefined;
      const splitSkillItems = sidebarDetailSplitSectionType === "skills"
        ? skills.slice(0, clampedSidebarSplitItemIndex)
        : undefined;
      const splitInterestItems = sidebarDetailSplitSectionType === "interests"
        ? interests.slice(0, clampedSidebarSplitItemIndex)
        : undefined;
      const splitExperienceItems = sidebarDetailSplitSectionType === "experience"
        ? sortedExperience.slice(0, clampedSidebarSplitItemIndex)
        : undefined;
      const splitProjectItems = sidebarDetailSplitSectionType === "projects"
        ? sortedProjects.slice(0, clampedSidebarSplitItemIndex)
        : undefined;

      if (clampedSidebarSplitItemIndex === 0) {
        return (
          <>
            {beforeSplit.map((sec) => (
              <ResumeDraggableSection
                key={sec.id}
                section={sec}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
            ))}
          </>
        );
      }

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
            key={splitSection.id}
            section={splitSection}
            experienceItems={splitExperienceItems}
            projectItems={splitProjectItems}
            languageItems={splitLanguageItems}
            skillItems={splitSkillItems}
            interestItems={splitInterestItems}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        </>
      );
    }

    return (
      <>
        {sidebarSections.slice(firstSidebarChunk.start, firstSidebarChunk.end).map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ))}
        {canCarrySidebarSection && (
          <ResumeDraggableSection
            key={`${carriedSidebarSection!.id}-carry-page-1`}
            section={carriedSidebarSection!}
            experienceItems={carriedSidebarSection!.type === "experience" ? sortedExperience.slice(0, sidebarCarryItemCount) : undefined}
            projectItems={carriedSidebarSection!.type === "projects" ? sortedProjects.slice(0, sidebarCarryItemCount) : undefined}
            languageItems={carriedSidebarSection!.type === "languages" ? languages.slice(0, sidebarCarryItemCount) : undefined}
            skillItems={carriedSidebarSection!.type === "skills" ? skills.slice(0, sidebarCarryItemCount) : undefined}
            interestItems={carriedSidebarSection!.type === "interests" ? interests.slice(0, sidebarCarryItemCount) : undefined}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        )}
      </>
    );
  };

  const renderTwoColumnSidebarPageTwoSections = (chunkIndex = 0) => {
    if (hasSidebarDetailSplit) {
      const splitSection = sidebarSections[sidebarSplitSectionIndex];
      const isPrimaryChunkPage = chunkIndex < sidebarPrimaryContinuationPageCount;

      if (isPrimaryChunkPage) {
        const chunk = effectiveSidebarDetailChunks[chunkIndex];
        if (!chunk) {
          if (chunkIndex > 0) return null;
          return sidebarAfterSplitSections.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          ));
        }

        const splitLanguageItems = sidebarDetailSplitSectionType === "languages"
          ? languages.slice(chunk.start, chunk.end)
          : undefined;
        const splitSkillItems = sidebarDetailSplitSectionType === "skills"
          ? skills.slice(chunk.start, chunk.end)
          : undefined;
        const splitInterestItems = sidebarDetailSplitSectionType === "interests"
          ? interests.slice(chunk.start, chunk.end)
          : undefined;
        const splitExperienceItems = sidebarDetailSplitSectionType === "experience"
          ? sortedExperience.slice(chunk.start, chunk.end)
          : undefined;
        const splitProjectItems = sidebarDetailSplitSectionType === "projects"
          ? sortedProjects.slice(chunk.start, chunk.end)
          : undefined;

        const transitionExperienceItems =
          hasSidebarTrailingDetailSplit && sidebarTrailingDetailSplitSectionType === "experience" && clampedSidebarTrailingTransitionItemEnd > 0
            ? sortedExperience.slice(0, clampedSidebarTrailingTransitionItemEnd)
            : undefined;
        const transitionProjectItems =
          hasSidebarTrailingDetailSplit && sidebarTrailingDetailSplitSectionType === "projects" && clampedSidebarTrailingTransitionItemEnd > 0
            ? sortedProjects.slice(0, clampedSidebarTrailingTransitionItemEnd)
            : undefined;

        return (
          <>
            <ResumeProxyDraggableSection
              section={splitSection}
              proxyId={`${splitSection.id}-sidebar-${chunkIndex}`}
              experienceItems={splitExperienceItems}
              projectItems={splitProjectItems}
              languageItems={splitLanguageItems}
              skillItems={splitSkillItems}
              interestItems={splitInterestItems}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
            {hasSidebarTrailingDetailSplit &&
              chunkIndex === effectiveSidebarDetailChunks.length - 1 &&
              sidebarBeforeTrailingSplitSections.map((sec) => (
                <ResumeDraggableSection
                  key={sec.id}
                  section={sec}
                  onPreviewInteract={() => setIsMobileEditorOpen(true)}
                />
              ))}
            {hasSidebarTrailingDetailSplit &&
              sidebarTrailingSplitSection &&
              chunkIndex === effectiveSidebarDetailChunks.length - 1 &&
              clampedSidebarTrailingTransitionItemEnd > 0 && (
                <ResumeProxyDraggableSection
                  section={sidebarTrailingSplitSection}
                  proxyId={`${sidebarTrailingSplitSection.id}-sidebar-transition-${chunkIndex}`}
                  experienceItems={transitionExperienceItems}
                  projectItems={transitionProjectItems}
                  onPreviewInteract={() => setIsMobileEditorOpen(true)}
                />
              )}
            {!hasSidebarTrailingDetailSplit && chunkIndex === effectiveSidebarDetailChunks.length - 1 && sidebarAfterSplitSections.map((sec) => (
              <ResumeDraggableSection
                key={sec.id}
                section={sec}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
            ))}
          </>
        );
      }

      if (!hasSidebarTrailingDetailSplit || !sidebarTrailingSplitSection) return null;

      const trailingChunkIndex = chunkIndex - sidebarPrimaryContinuationPageCount;
      const trailingChunk = effectiveSidebarTrailingContinuationChunks[trailingChunkIndex];
      if (!trailingChunk) {
        if (trailingChunkIndex > 0) return null;
        return sidebarTrailingAfterSections.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ));
      }

      const trailingExperienceItems =
        sidebarTrailingDetailSplitSectionType === "experience"
          ? sortedExperience.slice(trailingChunk.start, trailingChunk.end)
          : undefined;
      const trailingProjectItems =
        sidebarTrailingDetailSplitSectionType === "projects"
          ? sortedProjects.slice(trailingChunk.start, trailingChunk.end)
          : undefined;

      return (
        <>
          <ResumeProxyDraggableSection
            section={sidebarTrailingSplitSection}
            proxyId={`${sidebarTrailingSplitSection.id}-sidebar-trailing-${trailingChunkIndex}`}
            experienceItems={trailingExperienceItems}
            projectItems={trailingProjectItems}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
          {trailingChunkIndex === effectiveSidebarTrailingContinuationChunks.length - 1 && sidebarTrailingAfterSections.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          ))}
        </>
      );
    }

    const nextChunk = effectiveSidebarChunks[chunkIndex + 1 + sidebarContinuationChunkOffset];
    if (!nextChunk) return null;

    if (canCarrySidebarSection && chunkIndex === 0 && sidebarContinuationChunkOffset === 0) {
      const remainingSections = sidebarSections.slice(nextChunk.start, nextChunk.end);

      return (
        <>
          {hasRemainingCarriedSidebarItems && (
            <ResumeProxyDraggableSection
              section={carriedSidebarSection!}
              proxyId={`${carriedSidebarSection!.id}-carry-page-2`}
              experienceItems={carriedSidebarSection!.type === "experience" ? sortedExperience.slice(sidebarCarryItemCount) : undefined}
              projectItems={carriedSidebarSection!.type === "projects" ? sortedProjects.slice(sidebarCarryItemCount) : undefined}
              languageItems={carriedSidebarSection!.type === "languages" ? languages.slice(sidebarCarryItemCount) : undefined}
              skillItems={carriedSidebarSection!.type === "skills" ? skills.slice(sidebarCarryItemCount) : undefined}
              interestItems={carriedSidebarSection!.type === "interests" ? interests.slice(sidebarCarryItemCount) : undefined}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          )}
          {remainingSections
            .filter((section) => section.id !== carriedSidebarSection!.id)
            .map((sec) => (
              <ResumeDraggableSection
                key={sec.id}
                section={sec}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
            ))}
        </>
      );
    }

    return sidebarSections.slice(nextChunk.start, nextChunk.end).map((sec) => (
      <ResumeDraggableSection
        key={sec.id}
        section={sec}
        onPreviewInteract={() => setIsMobileEditorOpen(true)}
      />
    ));
  };

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

    if (clampedDetailSplitIndex === 0) {
      return (
        <>
          {beforeSplit.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          ))}
        </>
      );
    }

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

  const renderLinearPageTwoSections = (chunkIndex = 0) => {
    if (pageSplitIndex === -1) return null;

    if (!canUseDetailSplit) {
      if (chunkIndex > 0) return null;
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
    const isPrimaryChunkPage = chunkIndex < primaryContinuationPageCount;

    if (isPrimaryChunkPage) {
      const chunk = effectiveContinuationChunks[chunkIndex];
      if (!chunk) {
        if (chunkIndex > 0) return null;
        return afterSplit.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ));
      }
      const splitExperienceItems = detailSplitSectionType === "experience" ? sortedExperience.slice(chunk.start, chunk.end) : undefined;
      const splitProjectItems = detailSplitSectionType === "projects" ? sortedProjects.slice(chunk.start, chunk.end) : undefined;

      const transitionExperienceItems =
        hasTrailingDetailSplit && trailingDetailSplitSectionType === "experience" && clampedTrailingTransitionItemEnd > 0
          ? sortedExperience.slice(0, clampedTrailingTransitionItemEnd)
          : undefined;
      const transitionProjectItems =
        hasTrailingDetailSplit && trailingDetailSplitSectionType === "projects" && clampedTrailingTransitionItemEnd > 0
          ? sortedProjects.slice(0, clampedTrailingTransitionItemEnd)
          : undefined;

      return (
        <>
          <ResumeProxyDraggableSection
            section={splitSection!}
            proxyId={`${splitSection!.id}-linear-primary-${chunkIndex}`}
            experienceItems={splitExperienceItems}
            projectItems={splitProjectItems}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
          {hasTrailingDetailSplit &&
            trailingSplitSection &&
            chunkIndex === effectiveContinuationChunks.length - 1 &&
            clampedTrailingTransitionItemEnd > 0 && (
              <ResumeProxyDraggableSection
                section={trailingSplitSection}
                proxyId={`${trailingSplitSection.id}-linear-transition-${chunkIndex}`}
                experienceItems={transitionExperienceItems}
                projectItems={transitionProjectItems}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
            )}
          {!hasTrailingDetailSplit && chunkIndex === effectiveContinuationChunks.length - 1 && afterSplit.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          ))}
        </>
      );
    }

    if (!hasTrailingDetailSplit || !trailingSplitSection) return null;

    const trailingChunkIndex = chunkIndex - primaryContinuationPageCount;
    const trailingChunk = effectiveTrailingContinuationChunks[trailingChunkIndex];
    if (!trailingChunk) {
      if (trailingChunkIndex > 0) return null;
      return trailingAfterSections.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }
    const trailingExperienceItems =
      trailingDetailSplitSectionType === "experience"
        ? sortedExperience.slice(trailingChunk.start, trailingChunk.end)
        : undefined;
    const trailingProjectItems =
      trailingDetailSplitSectionType === "projects"
        ? sortedProjects.slice(trailingChunk.start, trailingChunk.end)
        : undefined;

    return (
      <>
        <ResumeProxyDraggableSection
          section={trailingSplitSection}
          proxyId={`${trailingSplitSection.id}-linear-trailing-${trailingChunkIndex}`}
          experienceItems={trailingExperienceItems}
          projectItems={trailingProjectItems}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
        {trailingChunkIndex === effectiveTrailingContinuationChunks.length - 1 && trailingAfterSections.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ))}
      </>
    );
  };

  const renderTwoColumnMainPageOneSections = () => {
    if (mainPageSplitIndex === -1) {
      return mainSections.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    if (!canUseMainDetailSplit) {
      const firstChunk = effectiveMainSectionChunks[0] ?? { start: 0, end: mainSections.length };
      return mainSections.slice(firstChunk.start, firstChunk.end).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    const splitSection = splitSectionCandidate!;
    const beforeSplit = mainSections.slice(0, detailSplitMainIndex);
    const splitExperienceItems = detailSplitSectionType === "experience" ? sortedExperience.slice(0, clampedDetailSplitIndex!) : undefined;
    const splitProjectItems = detailSplitSectionType === "projects" ? sortedProjects.slice(0, clampedDetailSplitIndex!) : undefined;

    if (clampedDetailSplitIndex === 0) {
      return beforeSplit.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

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
          key={splitSection.id}
          section={splitSection}
          experienceItems={splitExperienceItems}
          projectItems={splitProjectItems}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      </>
    );
  };

  const renderTwoColumnMainPageTwoSections = (chunkIndex = 0) => {
    if (mainPageSplitIndex === -1) return null;

    if (!canUseMainDetailSplit) {
      const nextChunk = effectiveMainSectionChunks[chunkIndex + 1];
      if (!nextChunk) return null;
      return mainSections.slice(nextChunk.start, nextChunk.end).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }

    const splitSection = splitSectionCandidate!;
    const afterSplit = mainSections.slice(detailSplitMainIndex + 1);
    const isPrimaryChunkPage = chunkIndex < primaryContinuationPageCount;

    if (isPrimaryChunkPage) {
      const chunk = effectiveContinuationChunks[chunkIndex];
      if (!chunk) {
        if (chunkIndex > 0) return null;
        return afterSplit.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
        ));
      }
      const splitExperienceItems = detailSplitSectionType === "experience" ? sortedExperience.slice(chunk.start, chunk.end) : undefined;
      const splitProjectItems = detailSplitSectionType === "projects" ? sortedProjects.slice(chunk.start, chunk.end) : undefined;

      const transitionExperienceItems =
        hasTrailingDetailSplit && trailingDetailSplitSectionType === "experience" && clampedTrailingTransitionItemEnd > 0
          ? sortedExperience.slice(0, clampedTrailingTransitionItemEnd)
          : undefined;
      const transitionProjectItems =
        hasTrailingDetailSplit && trailingDetailSplitSectionType === "projects" && clampedTrailingTransitionItemEnd > 0
          ? sortedProjects.slice(0, clampedTrailingTransitionItemEnd)
          : undefined;

      return (
        <>
          <ResumeProxyDraggableSection
            section={splitSection}
            proxyId={`${splitSection.id}-main-primary-${chunkIndex}`}
            experienceItems={splitExperienceItems}
            projectItems={splitProjectItems}
            onPreviewInteract={() => setIsMobileEditorOpen(true)}
          />
          {hasTrailingDetailSplit &&
            trailingSplitSection &&
            chunkIndex === effectiveContinuationChunks.length - 1 &&
            clampedTrailingTransitionItemEnd > 0 && (
              <ResumeProxyDraggableSection
                section={trailingSplitSection}
                proxyId={`${trailingSplitSection.id}-main-transition-${chunkIndex}`}
                experienceItems={transitionExperienceItems}
                projectItems={transitionProjectItems}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
            )}
          {!hasTrailingDetailSplit && chunkIndex === effectiveContinuationChunks.length - 1 && afterSplit.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
              onPreviewInteract={() => setIsMobileEditorOpen(true)}
            />
          ))}
        </>
      );
    }

    if (!hasTrailingDetailSplit || !trailingSplitSection) return null;

    const trailingChunkIndex = chunkIndex - primaryContinuationPageCount;
    const trailingChunk = effectiveTrailingContinuationChunks[trailingChunkIndex];
    if (!trailingChunk) {
      if (trailingChunkIndex > 0) return null;
      return trailingAfterSections.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
      ));
    }
    const trailingExperienceItems =
      trailingDetailSplitSectionType === "experience"
        ? sortedExperience.slice(trailingChunk.start, trailingChunk.end)
        : undefined;
    const trailingProjectItems =
      trailingDetailSplitSectionType === "projects"
        ? sortedProjects.slice(trailingChunk.start, trailingChunk.end)
        : undefined;

    return (
      <>
        <ResumeProxyDraggableSection
          section={trailingSplitSection}
          proxyId={`${trailingSplitSection.id}-main-trailing-${trailingChunkIndex}`}
          experienceItems={trailingExperienceItems}
          projectItems={trailingProjectItems}
          onPreviewInteract={() => setIsMobileEditorOpen(true)}
        />
        {trailingChunkIndex === effectiveTrailingContinuationChunks.length - 1 && trailingAfterSections.map((sec) => (
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
          <h1 className="text-lg font-bold text-gray-800">{ui.appTitle}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileEditorOpen(true)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-24 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-sm font-medium"
              aria-label="Open editor"
            >
              {ui.edit}
            </button>
            <button
              onClick={handleExportPdf}
              className="inline-flex items-center justify-center h-10 w-24 lg:w-auto bg-blue-600 text-white px-4 rounded hover:bg-blue-700 transition text-sm font-medium whitespace-nowrap"
            >
              {ui.exportPdf}
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
              <p className="text-sm font-semibold text-gray-700">{ui.editor}</p>
              <button
                type="button"
                onClick={() => setIsMobileEditorOpen(false)}
                className="px-2 py-1 rounded border border-gray-300 text-sm text-gray-700"
              >
                {ui.close}
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
                  ⚙️ {ui.settings}
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
                    <CollapsiblePanel
                      title={ui.language}
                      persistId="panel-language"
                      rightAdornment={<span className="text-base leading-none">{selectedLocaleFlag}</span>}
                    >
                      <LanguagePickerContent />
                    </CollapsiblePanel>
                  </div>
                  <div className="bg-white rounded-lg shadow">
                    <CollapsiblePanel title={ui.layout} persistId="panel-layout">
                      <LayoutPickerContent />
                    </CollapsiblePanel>
                  </div>
                  <div className="bg-white rounded-lg shadow">
                    <CollapsiblePanel title={ui.style} persistId="panel-style">
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
                  📄 {ui.sections}
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
                      title={`👤 ${ui.introduction}`}
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
                              {ui.addToResume}
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
                              {SECTION_ICONS[type]} {getSectionLabel(activeLocale, type)}
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

          {/* Hidden measurer - kept outside the scale wrapper so getBoundingClientRect()
              returns natural (1:1) dimensions regardless of preview zoom level.
              Must stay outside resumeRef so it is not cloned by useReactToPrint. */}
          <div
            style={{
              position: "absolute",
              visibility: "hidden",
              pointerEvents: "none",
              left: "-9999px",
              top: 0,
              width: `${PAGE_WIDTH}px`,
              padding: `${PAGE_PAD}px ${PAGE_PAD}px ${PAGE_PAD_BOTTOM}px ${PAGE_PAD}px`,
              fontSize: `${s.fontSize === "sm" ? 12 : s.fontSize === "lg" ? 14 : 13}px`,
              fontFamily: getFontFamily(s.fontFamily),
            }}
          >
            <div ref={contentRef}>
              <PersonalHeader
                layout={layout}
                style={s}
                photo={photo}
                onPreviewInteract={() => setIsMobileEditorOpen(true)}
              />
              {layout === "two-column" ? (
                <div data-measure-two-column className="flex gap-0" style={{ minHeight: `${TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT}px`, margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px` }}>
                  <div
                    className="shrink-0 p-5 pt-4"
                    style={{
                      background: s.accentColor + "10",
                      width: `${s.sidebarWidth}%`,
                    }}
                  >
                    {sidebarSections.map((sec) => (
                      <ResumeStaticSection key={sec.id} section={sec} />
                    ))}
                  </div>
                  <div className="flex-1 p-8 pt-4">
                    {mainSections.map((sec) => (
                      <ResumeStaticSection key={sec.id} section={sec} />
                    ))}
                  </div>
                </div>
              ) : (
                sectionOrder.map((sec) => (
                  <ResumeStaticSection key={sec.id} section={sec} />
                ))
              )}
            </div>
          </div>

          {/* Resume Preview */}
          <div className="w-full lg:flex-1 overflow-y-auto overflow-x-hidden max-h-[60vh] lg:max-h-[calc(100vh-80px)]">
            <div className="origin-top w-[92vw] mx-auto lg:w-auto lg:mx-0 scale-[0.45] sm:scale-[0.6] md:scale-[0.8] lg:scale-[0.85] xl:scale-100 print:!scale-100">
            <div
              ref={resumeRef}
              className="resume-pages flex flex-col items-center gap-8 py-4 print:block print:p-0"
            >
              <SortableContext
                items={allIds}
              >
                <DroppableZone
                  id={layout === "two-column" ? "zone-canvas" : "zone-main"}
                  className="flex flex-col items-center gap-8"
                >
                  {/* Page 1 */}
                  <div
                    className="resume-page shadow-lg rounded"
                    style={{ ...pageStyle }}
                  >
                    <PersonalHeader
                      layout={layout}
                      style={s}
                      photo={photo}
                      onPreviewInteract={() => setIsMobileEditorOpen(true)}
                    />
                    {layout === "two-column" ? (
                      <div
                        className="flex gap-0"
                        style={{
                          minHeight: `${TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT}px`,
                          margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px`,
                        }}
                      >
                        <DroppableZone
                          id="zone-sidebar"
                          className="shrink-0 p-5 pt-4"
                          style={{
                            background: s.accentColor + "10",
                            width: `${s.sidebarWidth}%`,
                          }}
                        >
                          {renderTwoColumnSidebarPageOneSections()}
                          {!sidebarSections.length && (
                            <p className="text-xs text-gray-400 italic text-center mt-8">
                              {ui.dropSectionsHere}
                            </p>
                          )}
                        </DroppableZone>
                        <DroppableZone id="zone-main" className="flex-1 p-8 pt-4">
                          {renderTwoColumnMainPageOneSections()}
                          {!mainSections.length && (
                            <p className="text-xs text-gray-400 italic text-center mt-8">
                              {ui.dropSectionsHere}
                            </p>
                          )}
                        </DroppableZone>
                      </div>
                    ) : (
                      <div>
                        {renderLinearPageOneSections()}
                      </div>
                    )}
                  </div>

                  {/* Page 2+ */}
                  {Array.from({ length: continuationPageCount }).map((_, continuationPageIndex) => (
                    <div
                      key={`resume-page-continuation-${continuationPageIndex}`}
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
                          >
                            {renderTwoColumnSidebarPageTwoSections(continuationPageIndex)}
                          </div>
                          <div className="flex-1 p-8 pt-4">
                            {renderTwoColumnMainPageTwoSections(continuationPageIndex)}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {renderLinearPageTwoSections(continuationPageIndex)}
                        </div>
                      )}
                    </div>
                  ))}

                </DroppableZone>
              </SortableContext>
            </div>
            </div>
          </div>
        </main>

        <footer className="px-4 pb-5 pt-1">
          <div className="mx-auto max-w-[1800px] text-center text-xs text-gray-500">
            {ui.tipDragSections}
          </div>
        </footer>
      </div>

      <DragOverlay>
        <DragOverlayContent sectionId={activeDragId} />
      </DragOverlay>
      <FeedbackWidget />
    </DndContext>
  );
}

// ─── Layout Picker ───
function LayoutPickerContent() {
  const { layout, setLayout, style, setStyle, activeLocale } = useResumeStore();
  const ui = getUiText(activeLocale);
  const layouts: { type: LayoutType; name: string }[] = [
    { type: "classic", name: ui.layoutClassic },
    { type: "modern", name: ui.layoutModern },
    { type: "compact", name: ui.layoutCompact },
    { type: "two-column", name: ui.layoutTwoColumn },
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
            {ui.sidebarWidth}: {style.sidebarWidth}%
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
            <span>{ui.narrow}</span>
            <span>{ui.wide}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function LanguagePickerContent() {
  const { activeLocale, setLocale, style } = useResumeStore();
  const ui = getUiText(activeLocale);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        {ui.chooseLanguageProfile}
      </p>
      <div className="flex flex-wrap gap-2">
        {LOCALE_OPTIONS.map((localeOption) => {
          const checked = activeLocale === localeOption.code;
          return (
            <label
              key={localeOption.code}
              className={`relative inline-flex items-center justify-center rounded-full cursor-pointer transition ${
                checked
                  ? "ring-2 ring-offset-1"
                  : "opacity-80 hover:opacity-100"
              }`}
              style={checked ? { boxShadow: `0 0 0 2px ${style.accentColor}` } : undefined}
              title={localeOption.label}
            >
              <input
                type="radio"
                name="resume-language"
                value={localeOption.code}
                checked={checked}
                onChange={() => setLocale(localeOption.code)}
                className="sr-only"
              />
              <span className="text-2xl leading-none">{localeOption.flag}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Personal Info ───
function PersonalInfoContent() {
  const { personalInfo, updatePersonalInfo, activeLocale } = useResumeStore();
  const { showHeaderIcons, toggleHeaderIcons } = useUIStore();
  const ui = getUiText(activeLocale);
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={showHeaderIcons}
          onChange={toggleHeaderIcons}
          className="w-3.5 h-3.5 rounded"
        />
        <span className="text-xs text-gray-600">{ui.showIconOnResume} ({ui.introduction})</span>
      </label>
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
      <label
        htmlFor="display-image-upload"
        className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700 cursor-pointer"
      >
        {photo.url ? "Replace display image" : "Add a display image"}
      </label>
      <input
        id="display-image-upload"
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="sr-only"
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
