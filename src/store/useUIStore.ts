import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const SETTINGS_PANEL_IDS = ['panel-language', 'panel-layout', 'panel-style'];
const isSettingsPanel = (id: string) => SETTINGS_PANEL_IDS.includes(id);
const isSectionsPanel = (id: string) => id === 'panel-header' || id === 'panel-header-image' || id.startsWith('sec-');
const isManagedPanel = (id: string) => isSettingsPanel(id) || isSectionsPanel(id);
export type StudioTheme = 'light' | 'dark';

interface UIStore {
  showHeaderIcons: boolean;
  showBodyIcons: boolean;
  sectionIcons: Record<string, boolean>;
  settingsCollapsed: boolean;
  sectionsCollapsed: boolean;
  activePanelId: string;
  panelStates: Record<string, boolean>;
  studioTheme: StudioTheme;
  toggleHeaderIcons: () => void;
  toggleBodyIcons: () => void;
  setSectionIcon: (sectionId: string, show: boolean) => void;
  toggleSettings: () => void;
  toggleSections: () => void;
  setPanelOpen: (id: string, open: boolean) => void;
  focusPanel: (id: string) => void;
  toggleStudioTheme: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      showHeaderIcons: true,
      showBodyIcons: true,
      sectionIcons: {},
      settingsCollapsed: false,
      sectionsCollapsed: false,
      activePanelId: 'panel-layout',
      panelStates: {},
      studioTheme: 'dark',
      toggleHeaderIcons: () => set((s) => ({ showHeaderIcons: !s.showHeaderIcons })),
      toggleBodyIcons: () => set((s) => ({ showBodyIcons: !s.showBodyIcons })),
      setSectionIcon: (sectionId, show) => set((s) => ({ sectionIcons: { ...s.sectionIcons, [sectionId]: show } })),
      toggleSettings: () => set((s) => ({ settingsCollapsed: !s.settingsCollapsed })),
      toggleSections: () => set((s) => ({ sectionsCollapsed: !s.sectionsCollapsed })),
      setPanelOpen: (id, open) => set((s) => {
        if (!open && isManagedPanel(id)) {
          return { panelStates: { ...s.panelStates, [id]: false } };
        }
        if (!isManagedPanel(id)) {
          return { panelStates: { ...s.panelStates, [id]: open } };
        }

        const newStates: Record<string, boolean> = {};
        for (const key of Object.keys(s.panelStates)) {
          if (isManagedPanel(key)) newStates[key] = false;
        }
        newStates[id] = true;

        return {
          panelStates: { ...s.panelStates, ...newStates },
          activePanelId: id,
        };
      }),
      focusPanel: (id) => set((s) => {
        const newStates: Record<string, boolean> = {};
        for (const key of Object.keys(s.panelStates)) {
          if (isManagedPanel(key)) newStates[key] = false;
        }
        newStates[id] = true;
        return {
          panelStates: { ...s.panelStates, ...newStates },
          activePanelId: id,
          settingsCollapsed: isSettingsPanel(id) ? false : s.settingsCollapsed,
          sectionsCollapsed: isSectionsPanel(id) ? false : s.sectionsCollapsed,
        };
      }),
      toggleStudioTheme: () => set((s) => ({ studioTheme: s.studioTheme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'resume-ui-v2' }
  )
);
