'use client';
import { useState } from 'react';
import { useUIStore } from '@/store/useUIStore';

interface Props {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  persistId?: string; // if provided, open/close state is persisted
}

export default function CollapsiblePanel({ title, children, defaultOpen = true, persistId }: Props) {
  const { panelStates, setPanelOpen, activePanelId } = useUIStore();
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  const isOpen = persistId
    ? (persistId in panelStates ? panelStates[persistId] : activePanelId === persistId)
    : localOpen;
  const toggle = () => {
    if (persistId) {
      setPanelOpen(persistId, !isOpen);
      return;
    }
    setLocalOpen(!localOpen);
  };

  return (
    <div className="w-full">
      <button type="button" onClick={toggle} className="w-full flex items-center justify-between p-4 text-left">
        <h3 className="font-semibold text-lg truncate">{title}</h3>
        <span className={`text-gray-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
