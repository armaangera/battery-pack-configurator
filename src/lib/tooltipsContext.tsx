import { createContext, useContext } from "react";

export interface TooltipsState {
  enabled: boolean;
}

export const TooltipsContext = createContext<TooltipsState>({ enabled: true });

export function useTooltipsEnabled(): boolean {
  return useContext(TooltipsContext).enabled;
}
