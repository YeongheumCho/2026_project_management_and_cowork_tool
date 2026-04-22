'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type WorkflowSelectionContextValue = {
  selectedMemberId: number | null;
  selectedProjectId: number | null;
  setSelectedMemberId: (memberId: number | null) => void;
  toggleSelectedMemberId: (memberId: number) => void;
  setSelectedProjectId: (projectId: number | null) => void;
};

const WorkflowSelectionContext =
  createContext<WorkflowSelectionContextValue | null>(null);

export function WorkflowSelectionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const toggleSelectedMemberId = useCallback((memberId: number) => {
    setSelectedMemberId((current) => (current === memberId ? null : memberId));
  }, []);

  const value = useMemo(
    () => ({
      selectedMemberId,
      selectedProjectId,
      setSelectedMemberId,
      toggleSelectedMemberId,
      setSelectedProjectId,
    }),
    [selectedMemberId, selectedProjectId, toggleSelectedMemberId],
  );

  return (
    <WorkflowSelectionContext.Provider value={value}>
      {children}
    </WorkflowSelectionContext.Provider>
  );
}

export function useWorkflowSelection() {
  const context = useContext(WorkflowSelectionContext);
  if (!context) {
    throw new Error(
      'useWorkflowSelection must be used within WorkflowSelectionProvider',
    );
  }
  return context;
}
