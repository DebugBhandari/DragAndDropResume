"use client";
import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  KeyboardSensor,
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
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDraggable } from "@dnd-kit/core";
import FeedbackWidget from "@/components/FeedbackWidget";
import ResumeEditorSidebar from "@/components/ResumeEditorSidebar";
import ResumeToolMenu from "@/components/ResumeToolMenu";
import { PersonalHeader, ResumeDraggableSection, ResumeProxyDraggableSection, ResumeStaticSection, getFontFamily } from "@/components/ResumePreview";
import { RESUME_STORAGE_KEY, useResumeStore } from "@/store/useResumeStore";
import { useUIStore } from "@/store/useUIStore";
import {
  SectionType,
  ResumeSection,
  LayoutType,
  ColumnZone,
  ResumeData,
  LocaleCode,
} from "@/types/resume";
import { sortProjectsByDateDesc, sortWorkExperienceByDateDesc } from "@/utils/dateSort";
import { trackAnalyticsEvent } from "@/utils/analytics";
import { getUiText } from "@/utils/uiTranslations";

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
    const raw = window.localStorage.getItem(RESUME_STORAGE_KEY);
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
      {isOver && (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 rounded-lg border border-dashed border-blue-400 bg-blue-50/95 px-3 py-2 text-center text-xs font-semibold text-blue-700 shadow-sm print:hidden" role="status">
          Release to place this section here
        </div>
      )}
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
    <div className="drag-overlay-hint pointer-events-none inline-flex max-w-44 items-center gap-2 rounded-full px-3 py-1.5">
      <span className="text-xs opacity-65" aria-hidden="true">↕</span>
      <h2
        className="truncate text-[11px] font-bold uppercase tracking-wide"
        style={{ color: style.accentColor }}
      >
        {section.title}
      </h2>
    </div>
  );
}

// ─── Main Page ───
export default function Home() {
  const resumeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [isTailoring, setIsTailoring] = useState(false);
  const [message, setMessage] = useState("");
  const [tailoredResume, setTailoredResume] = useState<ResumeData | null>(null);
  const [activeResumeVersion, setActiveResumeVersion] = useState<"original" | "tailored">("tailored");
  const [persistedSectionFlags, setPersistedSectionFlags] =
    useState<Record<SectionType, boolean>>(EMPTY_SECTION_FLAGS);
  const {
    activeLocale,
    personalInfo,
    sectionOrder,
    reorderSections,
    moveSectionToZone,
    removeSectionFromResume,
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
  const {
    showHeaderIcons,
    showBodyIcons,
    sectionIcons,
    studioTheme,
    toggleStudioTheme,
  } = useUIStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const applyResumeData = useCallback((data: ResumeData) => {
    useResumeStore.setState({ ...data });
  }, []);

  const handleTailoredResume = useCallback((original: ResumeData, tailored: ResumeData) => {
    setTailoredResume({ ...original, __tailored: tailored } as ResumeData & { __tailored: ResumeData });
    applyResumeData(tailored);
    setActiveResumeVersion("tailored");
  }, [applyResumeData]);

  const showResumeVersion = useCallback((version: "original" | "tailored") => {
    if (!tailoredResume) return;
    const candidate = version === "tailored" ? (tailoredResume as ResumeData & { __tailored: ResumeData }).__tailored : tailoredResume;
    applyResumeData(candidate);
    setActiveResumeVersion(version);
  }, [applyResumeData, tailoredResume]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const persisted = parsePersistedResumeData();
    const persistedSnapshot: SectionDataSnapshot = {
      experience: asArray(persisted.experience), education: asArray(persisted.education), projects: asArray(persisted.projects),
      skills: asArray(persisted.skills), languages: asArray(persisted.languages), certificates: asArray(persisted.certificates),
      awards: asArray(persisted.awards), volunteer: asArray(persisted.volunteer), references: asArray(persisted.references), interests: asArray(persisted.interests),
    };
    setPersistedSectionFlags({
      experience: sectionHasData("experience", persistedSnapshot), education: sectionHasData("education", persistedSnapshot),
      projects: sectionHasData("projects", persistedSnapshot), skills: sectionHasData("skills", persistedSnapshot),
      languages: sectionHasData("languages", persistedSnapshot), certificates: sectionHasData("certificates", persistedSnapshot),
      awards: sectionHasData("awards", persistedSnapshot), volunteer: sectionHasData("volunteer", persistedSnapshot),
      references: sectionHasData("references", persistedSnapshot), interests: sectionHasData("interests", persistedSnapshot),
    });
  }, []);

  const trackExportSuccess = useCallback((method: "react_to_print" | "window_print") => {
    trackAnalyticsEvent("pdf_export_success", { method, layout });
    void fetch("/api/analytics/export-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, layout, email: personalInfo.email }) }).catch(() => {});
  }, [layout, personalInfo.email]);

  const pdfTitle = useCallback(() => {
    const compactName = String(personalInfo.fullName ?? "").trim().replace(/\s+/g, "").replace(/[^\p{L}\p{N}_-]/gu, "");
    return `${compactName.length > 0 ? compactName : "Resume"}Resume`;
  }, [personalInfo.fullName]);

  const handleWindowPrint = useCallback(() => {
    if (typeof window === "undefined") return;
    const originalTitle = document.title;
    document.title = pdfTitle();

    const handleAfterPrint = () => {
      document.title = originalTitle;
      trackExportSuccess("window_print");
    };

    window.addEventListener("afterprint", handleAfterPrint, { once: true });
    window.print();

    // iOS browsers sometimes skip afterprint; restore the title regardless.
    setTimeout(() => {
      document.title = originalTitle;
    }, 1200);
  }, [pdfTitle, trackExportSuccess]);

  const handleDocumentPrint = useCallback(() => {
    if (typeof window === "undefined") return;
    const source = resumeRef.current;
    if (!source) {
      handleWindowPrint();
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      handleWindowPrint();
      return;
    }

    const headStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join("\n");

    const printMarkup = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${pdfTitle()}</title>
    ${headStyles}
    <style>
      html, body { margin: 0; padding: 0; background: white; }
      .resume-pages, .resume-pages * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .resume-modern-introduction {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .resume-pages { display: block !important; gap: 0 !important; padding: 0 !important; }
      .resume-page {
        box-shadow: none !important;
        border-radius: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        margin: 0 !important;
        break-after: page;
        page-break-after: always;
      }
      .resume-page:last-child { break-after: auto; page-break-after: auto; }
      [data-page-section] { break-inside: avoid !important; page-break-inside: avoid !important; }
      [data-page-section][data-section-type="experience"],
      [data-page-section][data-section-type="projects"] {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .resume-page [data-page-section] [data-exp-item],
      .resume-page [data-page-section] [data-project-item] {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
        -webkit-column-break-inside: avoid !important;
      }
      @page { size: 794px 1123px; margin: 0; }
    </style>
  </head>
  <body>${source.outerHTML}</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(printMarkup);
    printWindow.document.close();

    const triggerPrint = () => {
      printWindow.focus();
      printWindow.print();
      trackExportSuccess("window_print");
    };

    const images = Array.from(printWindow.document.images);
    if (images.length === 0) {
      setTimeout(triggerPrint, 60);
      return;
    }

    let pending = images.length;
    const markReady = () => {
      pending -= 1;
      if (pending <= 0) setTimeout(triggerPrint, 60);
    };

    images.forEach((img) => {
      if (img.complete) {
        markReady();
      } else {
        img.addEventListener("load", markReady, { once: true });
        img.addEventListener("error", markReady, { once: true });
      }
    });
  }, [handleWindowPrint, pdfTitle, trackExportSuccess]);

  const handleExportPdf = useCallback(() => {
    handleDocumentPrint();
  }, [handleDocumentPrint]);

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
  const DEFAULT_TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT = 930;
  const TWO_COLUMN_CONTINUATION_MIN_HEIGHT = USABLE_HEIGHT;

  // Track which section index starts page 2+
  const [pageSplitIndex, setPageSplitIndex] = useState<number>(-1);
  const [detailSplitSectionType, setDetailSplitSectionType] = useState<"experience" | "projects" | null>(null);
  const [detailSplitSectionIndex, setDetailSplitSectionIndex] = useState<number | null>(null);
  const [detailSplitItemIndex, setDetailSplitItemIndex] = useState<number | null>(null);
  const [sidebarContinuationChunks, setSidebarContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [mainSectionContinuationChunks, setMainSectionContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
  const [linearSectionContinuationChunks, setLinearSectionContinuationChunks] = useState<Array<{ start: number; end: number }>>([]);
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
  const [twoColumnFirstPageMinHeight, setTwoColumnFirstPageMinHeight] = useState<number>(DEFAULT_TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT);

  useEffect(() => {
    if (!contentRef.current) return;
    const measure = () => {
      if (!contentRef.current) return;
      const container = contentRef.current;
      const containerRect = container.getBoundingClientRect();
      const buildChunks = (
        itemHeights: number[],
        startIndex: number,
        firstCapacity: number,
        continuationCapacity = firstCapacity,
      ) => {
        const chunks: Array<{ start: number; end: number }> = [];
        let start = Math.max(0, startIndex);
        let activeCapacity = Math.max(1, firstCapacity);

        while (start < itemHeights.length) {
          let end = start;
          let used = 0;

          while (end < itemHeights.length) {
            const nextHeight = itemHeights[end];
            if (end > start && used + nextHeight > activeCapacity) break;
            used += nextHeight;
            end += 1;
          }

          chunks.push({ start, end });
          start = end;
          activeCapacity = Math.max(1, continuationCapacity);
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
      const firstPageContentHeight = layout === "two-column"
        ? Math.max(120, USABLE_HEIGHT - twoColumnTopOffset)
        : MEASURE_USABLE_HEIGHT;
      const continuationPageContentHeight = layout === "two-column"
        ? USABLE_HEIGHT
        : MEASURE_USABLE_HEIGHT;
      const pageSplitThreshold = layout === "two-column"
        ? twoColumnTopOffset + firstPageContentHeight
        : firstPageContentHeight;
      if (layout === "two-column") {
        setTwoColumnFirstPageMinHeight(firstPageContentHeight);
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
        const sidebarFirstPageCapacity = Math.max(
          120,
          firstPageContentHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
        );
        const sidebarContinuationCapacity = Math.max(
          120,
          continuationPageContentHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
        );
        const chunks = buildChunks(sidebarHeights, 0, sidebarFirstPageCapacity, sidebarContinuationCapacity);
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
              firstPageContentHeight - usedByPrecedingSections - carryChromeHeight - SIDEBAR_FIRST_PAGE_DETAIL_SPLIT_BUFFER_PX
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
          const perPageItemsCapacityRaw = Math.max(120, continuationPageContentHeight - sectionChromeHeight);
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
                if (transitionUsed + nextHeight > availableOnPrimaryLastPageForTrailingItems) {
                  break;
                }
                transitionUsed += nextHeight;
                transitionItemEnd += 1;
              }

              const trailingCapacity = Math.max(
                120,
                continuationPageContentHeight - trailingChromeHeight - SIDEBAR_CONTINUATION_DETAIL_SPLIT_BUFFER_PX
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
        const mainFirstPageCapacity = Math.max(120, firstPageContentHeight - 8);
        const mainContinuationCapacity = Math.max(120, continuationPageContentHeight - 8);
        setMainSectionContinuationChunks(buildChunks(mainHeights, 0, mainFirstPageCapacity, mainContinuationCapacity));
      } else {
        setTwoColumnFirstPageMinHeight(DEFAULT_TWO_COLUMN_FIRST_PAGE_MIN_HEIGHT);
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
      if (layout === "two-column") {
        setLinearSectionContinuationChunks([]);
      } else {
        const linearSectionHeights = Array.from(sections).map((section) => {
          const rect = section.getBoundingClientRect();
          const styles = window.getComputedStyle(section);
          const marginTop = Number.parseFloat(styles.marginTop || "0") || 0;
          const marginBottom = Number.parseFloat(styles.marginBottom || "0") || 0;
          return rect.height + marginTop + marginBottom;
        });
        setLinearSectionContinuationChunks(
          splitIdx === -1
            ? []
            : buildChunks(linearSectionHeights, splitIdx, continuationPageContentHeight),
        );
      }
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
          const perPageItemsCapacityRaw = Math.max(120, continuationPageContentHeight - sectionChromeHeight);
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
                if (transitionUsed + nextHeight > availableOnPrimaryLastPageForTrailingItems) {
                  break;
                }
                transitionUsed += nextHeight;
                transitionItemEnd += 1;
              }
              const trailingCapacity = Math.max(
                120,
                continuationPageContentHeight - trailingChromeHeight - CONTINUATION_DETAIL_SPLIT_BUFFER_PX
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
    };
    const observer = new ResizeObserver(measure);
    observer.observe(contentRef.current);
    measure();
    return () => observer.disconnect();
  }, [
    layout,
    sectionOrder,
    personalInfo,
    photo,
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
    USABLE_HEIGHT,
    s.fontSize,
    s.headingSize,
    s.sectionSpacing,
    s.sidebarWidth,
  ]);

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

  const effectiveLinearSectionContinuationChunks =
    layout !== "two-column" && pageSplitIndex !== -1
      ? (
          linearSectionContinuationChunks.length > 0
            ? linearSectionContinuationChunks
            : [{ start: pageSplitIndex, end: sectionOrder.length }]
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

  const trailingBeforeSections =
    trailingSplitIndex !== -1
      ? sequenceAfterPrimarySplit.slice(0, trailingSplitIndex)
      : [];

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
        ? effectiveContinuationChunks.length
        : effectiveLinearSectionContinuationChunks.length;

  // A trailing Experience/Projects section may need its own continuation chunks.
  // All ordinary sections continue immediately after the final detail chunk.
  const trailingContinuationPageCount = hasTrailingDetailSplit
    ? effectiveTrailingContinuationChunks.length + (trailingBeforeSections.length > 0 ? 1 : 0)
    : 0;

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
            />
            {hasSidebarTrailingDetailSplit &&
              chunkIndex === effectiveSidebarDetailChunks.length - 1 &&
              sidebarBeforeTrailingSplitSections.map((sec) => (
                <ResumeDraggableSection
                  key={sec.id}
                  section={sec}
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
                    />
              )}
            {!hasSidebarTrailingDetailSplit && chunkIndex === effectiveSidebarDetailChunks.length - 1 && sidebarAfterSplitSections.map((sec) => (
              <ResumeDraggableSection
                key={sec.id}
                section={sec}
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
          />
          {trailingChunkIndex === effectiveSidebarTrailingContinuationChunks.length - 1 && sidebarTrailingAfterSections.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
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
            />
          )}
          {remainingSections
            .filter((section) => section.id !== carriedSidebarSection!.id)
            .map((sec) => (
              <ResumeDraggableSection
                key={sec.id}
                section={sec}
                />
            ))}
        </>
      );
    }

    return sidebarSections.slice(nextChunk.start, nextChunk.end).map((sec) => (
      <ResumeDraggableSection
        key={sec.id}
        section={sec}
      />
    ));
  };

  const renderLinearPageOneSections = () => {
    if (pageSplitIndex === -1) {
      return sectionOrder.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
        />
      ));
    }

    if (!canUseDetailSplit) {
      return sectionOrder.slice(0, pageSplitIndex).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
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
          />
        ))}
        <ResumeDraggableSection
          key={splitSection!.id}
          section={splitSection!}
          experienceItems={splitExperienceItems}
          projectItems={splitProjectItems}
        />
      </>
    );
  };

  const renderLinearPageTwoSections = (chunkIndex = 0) => {
    if (pageSplitIndex === -1) return null;

    if (!canUseDetailSplit) {
      const chunk = effectiveLinearSectionContinuationChunks[chunkIndex];
      if (!chunk) return null;
      return sectionOrder.slice(chunk.start, chunk.end).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
        />
      ));
    }

    const splitSection = splitSectionCandidate;
    const afterSplit = sectionOrder.slice(detailSplitSectionIndex! + 1);
    const isPrimaryChunkPage = chunkIndex < primaryContinuationPageCount;

    if (isPrimaryChunkPage) {
      const chunk = effectiveContinuationChunks[chunkIndex];
      if (!chunk) {
        return null;
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
                />
            )}
          {!hasTrailingDetailSplit && chunkIndex === effectiveContinuationChunks.length - 1 && afterSplit.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
            />
          ))}
        </>
      );
    }

    if (!hasTrailingDetailSplit || !trailingSplitSection) return null;

    const trailingChunkIndex = chunkIndex - primaryContinuationPageCount;
    const hasTrailingBeforePage = trailingBeforeSections.length > 0;
    if (hasTrailingBeforePage && trailingChunkIndex === 0) {
      return trailingBeforeSections.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
        />
      ));
    }

    const detailChunkIndex = trailingChunkIndex - (hasTrailingBeforePage ? 1 : 0);
    const trailingChunk = effectiveTrailingContinuationChunks[detailChunkIndex];
    if (!trailingChunk) return null;
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
        />
        {detailChunkIndex === effectiveTrailingContinuationChunks.length - 1 && trailingAfterSections.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
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
        />
      ));
    }

    if (!canUseMainDetailSplit) {
      const firstChunk = effectiveMainSectionChunks[0] ?? { start: 0, end: mainSections.length };
      return mainSections.slice(firstChunk.start, firstChunk.end).map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
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
        />
      ));
    }

    return (
      <>
        {beforeSplit.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
          />
        ))}
        <ResumeDraggableSection
          key={splitSection.id}
          section={splitSection}
          experienceItems={splitExperienceItems}
          projectItems={splitProjectItems}
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
        />
      ));
    }

    const splitSection = splitSectionCandidate!;
    const afterSplit = mainSections.slice(detailSplitMainIndex + 1);
    const isPrimaryChunkPage = chunkIndex < primaryContinuationPageCount;

    if (isPrimaryChunkPage) {
      const chunk = effectiveContinuationChunks[chunkIndex];
      if (!chunk) {
        return null;
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
                />
            )}
          {!hasTrailingDetailSplit && chunkIndex === effectiveContinuationChunks.length - 1 && afterSplit.map((sec) => (
            <ResumeDraggableSection
              key={sec.id}
              section={sec}
            />
          ))}
        </>
      );
    }

    if (!hasTrailingDetailSplit || !trailingSplitSection) return null;

    const trailingChunkIndex = chunkIndex - primaryContinuationPageCount;
    const hasTrailingBeforePage = trailingBeforeSections.length > 0;
    if (hasTrailingBeforePage && trailingChunkIndex === 0) {
      return trailingBeforeSections.map((sec) => (
        <ResumeDraggableSection
          key={sec.id}
          section={sec}
        />
      ));
    }

    const detailChunkIndex = trailingChunkIndex - (hasTrailingBeforePage ? 1 : 0);
    const trailingChunk = effectiveTrailingContinuationChunks[detailChunkIndex];
    if (!trailingChunk) return null;
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
        />
        {detailChunkIndex === effectiveTrailingContinuationChunks.length - 1 && trailingAfterSections.map((sec) => (
          <ResumeDraggableSection
            key={sec.id}
            section={sec}
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
      onDragCancel={() => setActiveDragId(null)}
    >
      <div className="resume-studio" data-theme={studioTheme}>
        <header className="studio-header sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="studio-mark" aria-hidden="true">R</div>
            <h1 className="hidden text-lg font-bold text-white tracking-tight sm:block">{ui.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cover"
              className="studio-secondary-button inline-flex h-10 items-center justify-center px-3 text-sm font-semibold"
            >
              <span className="hidden xl:inline">Cover letter</span><span className="xl:hidden">Cover</span>
            </Link>
            <Link
              href="/tracking"
              className="studio-secondary-button inline-flex h-10 items-center justify-center px-3 text-sm font-semibold"
            >
              <span className="hidden xl:inline">Tracking</span><span className="xl:hidden">Jobs</span>
            </Link>
            <button
              type="button"
              onClick={handleExportPdf}
              className="studio-export-button studio-mobile-export-button inline-flex items-center justify-center h-10 w-28 lg:w-auto px-4 text-sm font-semibold whitespace-nowrap"
              aria-label={ui.exportPdf}
              title={ui.exportPdf}
            >
              <span aria-hidden="true">↓</span>
              <span className="studio-mobile-export-label">{ui.exportPdf}</span>
            </button>
          </div>
        </header>

        <ResumeToolMenu onTailored={handleTailoredResume} isTailoring={isTailoring} setIsTailoring={setIsTailoring} message={message} setMessage={setMessage} />

        {message && <div className="career-status-message mx-auto max-w-[1800px] px-4 pt-3" role="status"><p className="career-message">{message}</p></div>}

        <main className="career-workspace career-document-workspace mx-auto max-w-[1800px] p-4 lg:p-6" aria-label="Résumé document editor">
          {tailoredResume && <div className="career-tailored-comparison" role="status"><div><p className="career-kicker">AI comparison ready</p><p className="mt-1 text-sm">Showing the <strong>{activeResumeVersion}</strong> complete résumé. Switch versions before continuing to edit.</p></div><div className="career-preview-version-toggle" role="group" aria-label="Compare original and tailored résumés"><button type="button" className={activeResumeVersion === 'original' ? 'career-preview-version-toggle-active' : ''} onClick={() => showResumeVersion('original')}>Original</button><button type="button" className={activeResumeVersion === 'tailored' ? 'career-preview-version-toggle-active' : ''} onClick={() => showResumeVersion('tailored')}>Tailored</button></div></div>}
          <div className="resume-editor-layout">
            <ResumeEditorSidebar />
            <div className="career-preview-shell career-document-shell">
          {/* Hidden measurer - kept outside the scale wrapper so getBoundingClientRect()
              returns natural (1:1) dimensions.
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
                />
              {layout === "two-column" ? (
                <div data-measure-two-column className="flex gap-0" style={{ minHeight: `${twoColumnFirstPageMinHeight}px`, margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px` }}>
                  <div
                    className="shrink-0 p-5 pt-4"
                    style={{
                      background: s.sidebarColor,
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

          <div className="career-resume-preview-stage"><div className="career-resume-preview-scale">
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
                    className="resume-page studio-resume-page shadow-lg rounded"
                    style={{ ...pageStyle }}
                  >
                    <PersonalHeader
                      layout={layout}
                      style={s}
                      photo={photo}
                    />
                    {layout === "two-column" ? (
                      <div
                        className="flex gap-0"
                        style={{
                            minHeight: `${twoColumnFirstPageMinHeight}px`,
                          margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px`,
                        }}
                      >
                        <DroppableZone
                          id="zone-sidebar"
                          className="shrink-0 p-5 pt-4"
                          style={{
                            background: s.sidebarColor,
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
                      className="resume-page studio-resume-page shadow-lg rounded"
                      style={{ ...pageStyle }}
                    >
                      {layout === "two-column" ? (
                        <div
                          className="flex gap-0"
                          style={{
                            minHeight: `${TWO_COLUMN_CONTINUATION_MIN_HEIGHT}px`,
                            margin: `0 -${PAGE_PAD}px -${PAGE_PAD}px`,
                          }}
                        >
                          <div
                            className="shrink-0 p-5 pt-4"
                            style={{
                              background: s.sidebarColor,
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
          </div>
          </div>
        </main>

        <footer className="studio-footer px-4 pb-5 pt-1">
          <div className="mx-auto max-w-[1800px] text-center text-xs">
            {ui.tipDragSections}
          </div>
        </footer>

        <div className="studio-floating-controls fixed bottom-4 right-4 z-90 flex items-center gap-2">
          <FeedbackWidget />
          <button
            type="button"
            onClick={toggleStudioTheme}
            className="studio-theme-switch inline-flex h-10 items-center gap-2 px-2.5 text-xs font-bold uppercase tracking-[0.12em] sm:px-3"
            aria-label={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${studioTheme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span aria-hidden="true">{studioTheme === 'dark' ? '☀' : '☾'}</span>
            <span className="hidden sm:inline">{studioTheme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>
      </div>

      <DragOverlay>
        <DragOverlayContent sectionId={activeDragId} />
      </DragOverlay>
    </DndContext>
  );
}
