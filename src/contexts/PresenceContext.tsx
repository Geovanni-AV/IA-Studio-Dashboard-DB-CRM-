import React, { createContext, useContext } from 'react';

interface PresenceContextType {
  activeLocks: Record<string, any>;
  currentUserEmail: string;
  setEditingRecordId: (recordId: string | null) => Promise<void>;
}

export const PresenceContext = createContext<PresenceContextType | null>(null);

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (!context) throw new Error("usePresence debe ser usado dentro de un PresenceProvider");
  return context;
};
