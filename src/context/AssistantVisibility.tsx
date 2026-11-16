import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface AssistantVisibilityValue {
  hidden: boolean;
  /** Call with `true` while a full-screen takeover (the quiz player) is open, `false` when it closes. */
  setHidden: (hidden: boolean) => void;
}

const AssistantVisibilityContext = createContext<AssistantVisibilityValue>({
  hidden: false,
  setHidden: () => {},
});

/**
 * Lets a full-screen view (the quiz player) hide the Hope Assistant launcher
 * without threading a prop through the whole portal router. Several
 * components may ask to hide it at once (e.g. two player instances during a
 * fast re-mount), so we track a reference count rather than a bare boolean.
 */
export function AssistantVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false);
  const count = useRef(0);

  const setHidden = useCallback((next: boolean) => {
    count.current = Math.max(0, count.current + (next ? 1 : -1));
    setHiddenState(count.current > 0);
  }, []);

  return (
    <AssistantVisibilityContext.Provider value={{ hidden, setHidden }}>
      {children}
    </AssistantVisibilityContext.Provider>
  );
}

export function useAssistantVisibility(): AssistantVisibilityValue {
  return useContext(AssistantVisibilityContext);
}
