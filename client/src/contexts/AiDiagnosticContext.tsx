import React, { createContext, useContext, useState, useCallback } from 'react';
import type {
  AiDiagnosticCriterion,
  AiChatMessage,
} from '@shared/api.interface';

interface AiDiagnosticContextValue {
  criteria: AiDiagnosticCriterion[];
  chatSummary: string;
  chatMessages: AiChatMessage[];
  updateDiagnostic: (
    criteria: AiDiagnosticCriterion[],
    summary: string,
    messages: AiChatMessage[],
  ) => void;
  clearDiagnostic: () => void;
}

const AiDiagnosticContext = createContext<AiDiagnosticContextValue | null>(
  null,
);

export const AiDiagnosticProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [criteria, setCriteria] = useState<AiDiagnosticCriterion[]>([]);
  const [chatSummary, setChatSummary] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<AiChatMessage[]>([]);

  const updateDiagnostic = useCallback(
    (
      newCriteria: AiDiagnosticCriterion[],
      summary: string,
      messages: AiChatMessage[],
    ) => {
      setCriteria(newCriteria);
      setChatSummary(summary);
      setChatMessages(messages);
    },
    [],
  );

  const clearDiagnostic = useCallback(() => {
    setCriteria([]);
    setChatSummary('');
    setChatMessages([]);
  }, []);

  return (
    <AiDiagnosticContext.Provider
      value={{ criteria, chatSummary, chatMessages, updateDiagnostic, clearDiagnostic }}
    >
      {children}
    </AiDiagnosticContext.Provider>
  );
};

export function useAiDiagnostic(): AiDiagnosticContextValue {
  const ctx = useContext(AiDiagnosticContext);
  if (!ctx) {
    return {
      criteria: [],
      chatSummary: '',
      chatMessages: [],
      updateDiagnostic: () => {},
      clearDiagnostic: () => {},
    };
  }
  return ctx;
}
