'use client';

import { useState } from 'react';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { useResumeStore } from '@/store/useResumeStore';
import { useUIStore } from '@/store/useUIStore';
import type { ColumnZone, Interest, Language, LayoutType, PhotoConfig, Project, ResumeSection, SectionType, StyleConfig, WorkExperience, Skill } from '@/types/resume';
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from '@/utils/dateSort';

// ─── Contact icons for resume ───
const CONTACT_ICONS: Record<string, React.ReactNode> = {
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[1.15em] w-[1.15em]" aria-hidden="true">
      <rect x="3.25" y="5.25" width="17.5" height="13.5" rx="2.25" />
      <path d="M4.5 7 12 12.75 19.5 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[1.15em] w-[1.15em]" aria-hidden="true">
      <path d="M7.6 4.75h2.1c.4 0 .76.27.87.65l.88 3.05a.94.94 0 0 1-.27.98l-1.41 1.28a13.45 13.45 0 0 0 4.62 4.62l1.28-1.41a.94.94 0 0 1 .98-.27l3.05.88c.38.11.65.47.65.87v2.1c0 .69-.56 1.25-1.25 1.25h-.9C10.47 19.75 4.25 13.53 4.25 5.99v-.9c0-.69.56-1.25 1.25-1.25Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  location: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[1.15em] w-[1.15em]" aria-hidden="true">
      <path d="M12 20.25s6-5.54 6-10.15a6 6 0 1 0-12 0c0 4.61 6 10.15 6 10.15Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="10.1" r="2.1" />
    </svg>
  ),
  linkedin: "🔗",
  website: "🌐",
};

const DEFAULT_HEADER_IMAGE_URL = "/default-profile.svg";

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
export function getFontFamily(font: StyleConfig["fontFamily"]) {
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
      const visibleExperience = experienceList.filter((item) => item.visible !== false);
      if (!visibleExperience.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No experience added
          </p>
        );
      return (
        <>
          {visibleExperience.map((exp) => {
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
      const visibleProjects = projectList.filter((item) => item.visible !== false);
      if (!visibleProjects.length)
        return (
          <p className="text-gray-400 italic" style={{ fontSize: "0.85em" }}>
            No projects added
          </p>
        );
      return (
        <>
          {visibleProjects.map((proj) => {
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
    const icon = CONTACT_ICONS[type];
    const wrapperClass =
      type === 'email' || type === 'phone' || type === 'location'
        ? 'mr-1.5 inline-flex translate-y-[0.08em] items-center justify-center'
        : 'inline-block leading-none';
    return (
      <span
        aria-hidden="true"
        className={wrapperClass}
      >
        {icon}
        {typeof icon === 'string' ? ' ' : null}
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

// ─── Header photo ───
function DraggablePhoto({
  photo,
  onPhotoDragStart,
  onPhotoDragMove,
  onPhotoDragEnd,
}: {
  photo: PhotoConfig;
  onPhotoDragStart?: () => void;
  onPhotoDragMove?: (x: number, y: number) => void;
  onPhotoDragEnd?: () => void;
}) {
  const { setPhoto } = useResumeStore();
  const { focusPanel } = useUIStore();

  if (!photo.url) return null;

  return (
    <div className="relative group/photo shrink-0">
      <img
        src={photo.url}
        alt="Profile"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          focusPanel('panel-header-image');
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.setPointerCapture(e.pointerId);
          onPhotoDragStart?.();
          onPhotoDragMove?.(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 0) return;
          e.preventDefault();
          e.stopPropagation();
          onPhotoDragMove?.(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPhotoDragMove?.(e.clientX, e.clientY);
          onPhotoDragEnd?.();
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPhotoDragEnd?.();
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        className="select-none touch-none cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-300 print:cursor-default print:ring-0"
        style={{
          width: photo.size,
          height: photo.size,
          borderRadius: `${photo.borderRadius}%`,
          objectFit: "cover",
        }}
      />
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPhoto({ url: '' });
          focusPanel('panel-header-image');
        }}
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity print:hidden"
        title="Remove from resume"
      >
        ×
      </button>
    </div>
  );
}

// ─── Personal Header with relative positioning for photo ───
export function PersonalHeader({
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
  const { personalInfo, setPhoto } = useResumeStore();
  const { focusPanel } = useUIStore();
  const [isPhotoDragging, setIsPhotoDragging] = useState(false);
  const [activePhotoDropTarget, setActivePhotoDropTarget] = useState<string | null>(null);
  const PAGE_HEIGHT = 1123;
  const PAGE_PAD_TOP = layout === "compact" ? 32 : 48;
  const PAGE_PAD_BOTTOM = 24;
  const maxHeaderHeightPx = Math.floor((PAGE_HEIGHT - PAGE_PAD_TOP - PAGE_PAD_BOTTOM) / 2);
  const verticalPosition = photo.verticalPosition ?? "center";
  const requestedHorizontalPosition = photo.horizontalPosition ?? (verticalPosition === "center" ? "right" : "center");
  const horizontalPosition = verticalPosition === "center" && requestedHorizontalPosition === "center"
    ? "right"
    : requestedHorizontalPosition;
  const contentGapPx = Math.max(0, photo.contentGap ?? 14);
  const headerHeightPx = Math.max(80, Math.min(maxHeaderHeightPx, photo.headerHeight ?? 180));
  const headerMarginTopPx = Math.max(0, photo.marginTop ?? 0);
  const headerMarginBottomPx = Math.max(0, photo.marginBottom ?? 0);

  const handleHeaderClick = () => {
    focusPanel('panel-header');
    onPreviewInteract?.();
  };
  const headerMaxHeightStyle = `${maxHeaderHeightPx}px`;
  const stackJustifyClass =
    horizontalPosition === "left"
      ? "justify-start"
      : horizontalPosition === "right"
        ? "justify-end"
        : "justify-center";

  const getDropTargetByPoint = (x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const targetEl = el?.closest("[data-photo-drop-target]") as HTMLElement | null;
    if (!targetEl) return null;
    return photoDropTargets.find((target) => target.id === targetEl.dataset.photoDropTarget) ?? null;
  };

  const photoDropTargets: Array<{
    id: string;
    label: string;
    vertical: PhotoConfig["verticalPosition"];
    horizontal: PhotoConfig["horizontalPosition"];
    className: string;
  }> = [
    { id: "top-left", label: "Top left", vertical: "top", horizontal: "left", className: "col-start-1 row-start-1" },
    { id: "top-center", label: "Top center", vertical: "top", horizontal: "center", className: "col-start-2 row-start-1" },
    { id: "top-right", label: "Top right", vertical: "top", horizontal: "right", className: "col-start-3 row-start-1" },
    { id: "center-left", label: "Center left", vertical: "center", horizontal: "left", className: "col-start-1 row-start-2" },
    { id: "center-right", label: "Center right", vertical: "center", horizontal: "right", className: "col-start-3 row-start-2" },
    { id: "bottom-left", label: "Bottom left", vertical: "bottom", horizontal: "left", className: "col-start-1 row-start-3" },
    { id: "bottom-center", label: "Bottom center", vertical: "bottom", horizontal: "center", className: "col-start-2 row-start-3" },
    { id: "bottom-right", label: "Bottom right", vertical: "bottom", horizontal: "right", className: "col-start-3 row-start-3" },
  ];

  const applyPhotoDropTarget = (target: { vertical: PhotoConfig["verticalPosition"]; horizontal: PhotoConfig["horizontalPosition"] }) => {
    setPhoto({
      verticalPosition: target.vertical,
      horizontalPosition: target.horizontal,
    });
    focusPanel('panel-header-image');
    onPreviewInteract?.();
    setIsPhotoDragging(false);
    setActivePhotoDropTarget(null);
  };

  const handlePhotoPointerMove = (x: number, y: number) => {
    if (!isPhotoDragging) return;
    const hoveredTarget = getDropTargetByPoint(x, y);
    setActivePhotoDropTarget(hoveredTarget?.id ?? null);
  };

  const handlePhotoPointerEnd = () => {
    if (!isPhotoDragging) return;
    const target = photoDropTargets.find((item) => item.id === activePhotoDropTarget);
    if (target) {
      applyPhotoDropTarget(target);
      return;
    }
    setIsPhotoDragging(false);
    setActivePhotoDropTarget(null);
  };

  const renderPhotoLayout = (content: React.ReactNode) => {
    if (!photo.url) return content;

    if (verticalPosition === "center") {
      const photoNode = (
        <DraggablePhoto
          photo={photo}
          onPhotoDragStart={() => setIsPhotoDragging(true)}
          onPhotoDragMove={handlePhotoPointerMove}
          onPhotoDragEnd={handlePhotoPointerEnd}
        />
      );
      return (
        <div
          className={`flex items-center min-w-0 ${horizontalPosition === "left" ? "" : "flex-row-reverse"}`}
          style={{
            minHeight: `${headerHeightPx}px`,
            columnGap: `${contentGapPx}px`,
          }}
        >
          {photoNode}
          <div className="min-w-0 flex-1">{content}</div>
        </div>
      );
    }

    return (
      <div className="flex flex-col" style={{ rowGap: "12px" }}>
        {verticalPosition === "top" && (
          <div className={`flex ${stackJustifyClass}`}>
            <DraggablePhoto
              photo={photo}
              onPhotoDragStart={() => setIsPhotoDragging(true)}
              onPhotoDragMove={handlePhotoPointerMove}
              onPhotoDragEnd={handlePhotoPointerEnd}
            />
          </div>
        )}
        {content}
        {verticalPosition === "bottom" && (
          <div className={`flex ${stackJustifyClass}`}>
            <DraggablePhoto
              photo={photo}
              onPhotoDragStart={() => setIsPhotoDragging(true)}
              onPhotoDragMove={handlePhotoPointerMove}
              onPhotoDragEnd={handlePhotoPointerEnd}
            />
          </div>
        )}
      </div>
    );
  };

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
        onClick={handleHeaderClick}
        className="resume-modern-introduction text-white -mx-12 -mt-12 mb-6 px-8 py-8 relative cursor-pointer"
        style={{
          background: s.accentColor,
          minHeight: `${headerHeightPx}px`,
          maxHeight: headerMaxHeightStyle,
          marginTop: `${headerMarginTopPx}px`,
          marginBottom: `${24 + headerMarginBottomPx}px`,
          overflow: "hidden",
        }}
      >
        {isPhotoDragging && (
          <div className="absolute inset-3 z-20 grid grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-white/35 bg-white/12 p-2 backdrop-blur-[1px]">
            {photoDropTargets.map((target) => {
              const isActive = activePhotoDropTarget === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  data-photo-drop-target={target.id}
                  onPointerEnter={(e) => {
                    if (!isPhotoDragging) return;
                    setActivePhotoDropTarget(target.id);
                  }}
                  onPointerLeave={() => {
                    if (!isPhotoDragging) return;
                    if (activePhotoDropTarget === target.id) setActivePhotoDropTarget(null);
                  }}
                  onPointerUp={() => {
                    if (!isPhotoDragging) return;
                    applyPhotoDropTarget(target);
                  }}
                  onClick={() => applyPhotoDropTarget(target)}
                  className={`${target.className} rounded-lg border text-[10px] font-semibold uppercase tracking-[0.14em] transition ${isActive ? "border-white bg-white/90 text-slate-900" : "border-white/45 bg-white/20 text-white hover:bg-white/30"}`}
                >
                  {target.label}
                </button>
              );
            })}
          </div>
        )}
        {renderPhotoLayout(
          <div className={textAlign}>
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
        )}
      </div>
    );
  }

  if (layout === "compact") {
    return (
      <div
        onClick={handleHeaderClick}
        className="mb-3 pb-2 relative cursor-pointer"
        style={{
          borderBottom: `2px solid ${s.accentColor}`,
          minHeight: `${headerHeightPx}px`,
          maxHeight: headerMaxHeightStyle,
          marginTop: `${headerMarginTopPx}px`,
          marginBottom: `${headerMarginBottomPx}px`,
          overflow: "hidden",
        }}
      >
        {isPhotoDragging && (
          <div className="absolute inset-2 z-20 grid grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-slate-300 bg-white/80 p-2 backdrop-blur-[1px]">
            {photoDropTargets.map((target) => {
              const isActive = activePhotoDropTarget === target.id;
              return (
                <button
                  key={target.id}
                  type="button"
                  data-photo-drop-target={target.id}
                  onPointerEnter={(e) => {
                    if (!isPhotoDragging) return;
                    setActivePhotoDropTarget(target.id);
                  }}
                  onPointerLeave={() => {
                    if (!isPhotoDragging) return;
                    if (activePhotoDropTarget === target.id) setActivePhotoDropTarget(null);
                  }}
                  onPointerUp={() => {
                    if (!isPhotoDragging) return;
                    applyPhotoDropTarget(target);
                  }}
                  onClick={() => applyPhotoDropTarget(target)}
                  className={`${target.className} rounded-lg border text-[10px] font-semibold uppercase tracking-[0.14em] transition ${isActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white/90 text-slate-600 hover:border-blue-400 hover:text-blue-700"}`}
                >
                  {target.label}
                </button>
              );
            })}
          </div>
        )}
        {renderPhotoLayout(
          <div>
            <div className="flex items-baseline justify-between gap-3">
              {personalInfo.fullName && (
                <h1 className="font-bold" style={{ fontSize: '1.3em' }}>{personalInfo.fullName}</h1>
              )}
              <div className="text-xs text-gray-600 flex gap-2 flex-wrap justify-end">
                {personalInfo.email && <span>{personalInfo.email}</span>}
                {personalInfo.phone && <span>| {personalInfo.phone}</span>}
                {personalInfo.location && <span>| {personalInfo.location}</span>}
              </div>
            </div>
            {personalInfo.summary && (
              <p className="mt-1 text-gray-600">{personalInfo.summary}</p>
            )}
          </div>
        )}
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
      onClick={handleHeaderClick}
      className="mb-4 relative cursor-pointer"
      style={{
        minHeight: `${headerHeightPx}px`,
        maxHeight: headerMaxHeightStyle,
        marginTop: `${headerMarginTopPx}px`,
        marginBottom: `${headerMarginBottomPx}px`,
        overflow: "hidden",
      }}
    >
      {isPhotoDragging && (
        <div className="absolute inset-2 z-20 grid grid-cols-3 grid-rows-3 gap-2 rounded-xl border border-slate-300 bg-white/80 p-2 backdrop-blur-[1px]">
          {photoDropTargets.map((target) => {
            const isActive = activePhotoDropTarget === target.id;
            return (
              <button
                key={target.id}
                type="button"
                data-photo-drop-target={target.id}
                onPointerEnter={(e) => {
                  if (!isPhotoDragging) return;
                  setActivePhotoDropTarget(target.id);
                }}
                onPointerLeave={() => {
                  if (!isPhotoDragging) return;
                  if (activePhotoDropTarget === target.id) setActivePhotoDropTarget(null);
                }}
                onPointerUp={() => {
                  if (!isPhotoDragging) return;
                  applyPhotoDropTarget(target);
                }}
                onClick={() => applyPhotoDropTarget(target)}
                className={`${target.className} rounded-lg border text-[10px] font-semibold uppercase tracking-[0.14em] transition ${isActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-300 bg-white/90 text-slate-600 hover:border-blue-400 hover:text-blue-700"}`}
              >
                {target.label}
              </button>
            );
          })}
        </div>
      )}
      {renderPhotoLayout(
        <div className={textAlign}>
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
      )}
    </div>
  );
}

// ─── Resume Draggable Section (sortable on document) ───
export function ResumeDraggableSection({
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
  const { style, layout, removeSectionFromResume, sectionOrder, reorderSections, moveSectionToZone } = useResumeStore();
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

  const moveSectionBy = (direction: -1 | 1) => {
    const zoneSections = sectionOrder.filter((item) => item.zone === section.zone);
    const zoneIndex = zoneSections.findIndex((item) => item.id === section.id);
    const targetZoneSection = zoneSections[zoneIndex + direction];
    if (!targetZoneSection) return;

    const oldIndex = sectionOrder.findIndex((item) => item.id === section.id);
    const newIndex = sectionOrder.findIndex((item) => item.id === targetZoneSection.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderSections(arrayMove(sectionOrder, oldIndex, newIndex));
  };

  const moveAcrossColumns = (targetZone: ColumnZone) => {
    if (layout !== "two-column" || targetZone === section.zone) return;
    moveSectionToZone(section.id, targetZone);
  };

  const canMoveUp = sectionOrder.filter((item) => item.zone === section.zone).findIndex((item) => item.id === section.id) > 0;
  const canMoveDown = sectionOrder.filter((item) => item.zone === section.zone).findIndex((item) => item.id === section.id) < sectionOrder.filter((item) => item.zone === section.zone).length - 1;

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
      className={`${getSpacingClass(style.sectionSpacing)} resume-draggable-section break-inside-avoid relative rounded-lg p-2 transition-all hover:bg-blue-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:cursor-grabbing group/sec`}
    >
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 group-focus-within/sec:opacity-100 transition-opacity print:hidden">
        {layout === "two-column" && section.zone === "main" && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              moveAcrossColumns("sidebar");
            }}
            className="resume-section-action w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center"
            title="Move to left column"
            aria-label={`Move ${section.title} to the left column`}
          >
            ←
          </button>
        )}
        {layout === "two-column" && section.zone === "sidebar" && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              moveAcrossColumns("main");
            }}
            className="resume-section-action w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center"
            title="Move to right column"
            aria-label={`Move ${section.title} to the right column`}
          >
            →
          </button>
        )}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            moveSectionBy(-1);
          }}
          disabled={!canMoveUp}
          className="resume-section-action w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-35"
          title="Move up"
          aria-label={`Move ${section.title} up`}
        >
          ↑
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            moveSectionBy(1);
          }}
          disabled={!canMoveDown}
          className="resume-section-action w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-35"
          title="Move down"
          aria-label={`Move ${section.title} down`}
        >
          ↓
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeSectionFromResume(section.id);
          }}
          className="resume-section-action w-6 h-6 rounded-full bg-red-500 text-white text-sm flex items-center justify-center"
          title="Remove from resume"
          aria-label={`Remove ${section.title} from resume`}
        >
          ×
        </button>
      </div>
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

export function ResumeStaticSection({
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

export function ResumeProxyDraggableSection({
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
  const { style, layout, sectionOrder, reorderSections, moveSectionToZone, removeSectionFromResume } = useResumeStore();
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

  const moveSectionBy = (direction: -1 | 1) => {
    const zoneSections = sectionOrder.filter((item) => item.zone === section.zone);
    const zoneIndex = zoneSections.findIndex((item) => item.id === section.id);
    const targetZoneSection = zoneSections[zoneIndex + direction];
    if (!targetZoneSection) return;

    const oldIndex = sectionOrder.findIndex((item) => item.id === section.id);
    const newIndex = sectionOrder.findIndex((item) => item.id === targetZoneSection.id);
    if (oldIndex < 0 || newIndex < 0) return;
    reorderSections(arrayMove(sectionOrder, oldIndex, newIndex));
  };

  const moveAcrossColumns = (targetZone: ColumnZone) => {
    if (layout !== "two-column" || targetZone === section.zone) return;
    moveSectionToZone(section.id, targetZone);
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
      className={`${getSpacingClass(style.sectionSpacing)} relative rounded p-2 active:cursor-grabbing group/sec`}
    >
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover/sec:opacity-100 transition-opacity print:hidden">
        {layout === "two-column" && section.zone === "main" && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              moveAcrossColumns("sidebar");
            }}
            className="w-5 h-5 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center"
            title="Move to left column"
          >
            ←
          </button>
        )}
        {layout === "two-column" && section.zone === "sidebar" && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              moveAcrossColumns("main");
            }}
            className="w-5 h-5 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center"
            title="Move to right column"
          >
            →
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            moveSectionBy(-1);
          }}
          className="w-5 h-5 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center"
          title="Move up"
        >
          ↑
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            moveSectionBy(1);
          }}
          className="w-5 h-5 rounded-full bg-gray-700 text-white text-[10px] flex items-center justify-center"
          title="Move down"
        >
          ↓
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeSectionFromResume(section.id);
          }}
          className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
          title="Remove from resume"
        >
          ×
        </button>
      </div>
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
export const SECTION_ICONS: Record<SectionType, string> = {
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
