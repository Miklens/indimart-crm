import { createContext, useContext } from 'react';

export const AppUIContext = createContext({ openCustomer360: () => {} });

export function useAppUI() {
  return useContext(AppUIContext);
}
