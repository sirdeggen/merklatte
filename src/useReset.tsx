import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useState,
} from "react";

interface ResetProviderValue {
  value: ResetListeners;
  setValue: (listeners: ResetListeners) => void;
}

type ResetListeners = Record<string, () => void>;

const Context = createContext<ResetProviderValue | undefined>(undefined);
Context.displayName = "ResetProviderCtx";

export const ResetProvider: FC<PropsWithChildren> = ({ children }) => {
  const [value, setValue] = useState<ResetListeners>({});
  return (
    <Context.Provider value={{ value, setValue }}>
      {" "}
      {children}{" "}
    </Context.Provider>
  );
};

const useContextValue = () => {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useReset must be used within ResetProvider");
  }
  return ctx;
};

export const useReset = () => {
  const ctx = useContextValue();
  return {
    addListener: (key: string, resetHandler: () => void) => {
      const listeners = ctx.value;
      listeners[key] = resetHandler;
      ctx.setValue(listeners);
    },
    reset: () => {
      Object.values(ctx.value).forEach((it) => it());
    },
  };
};
