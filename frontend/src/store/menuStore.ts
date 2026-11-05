import { create } from 'zustand';

interface S {
  open: boolean;
  toggleMenu: () => void;
  closeMenu: () => void;
}

export const useMenuStore = create<S>()((set) => ({
  open: false,
  toggleMenu: () => set((s) => ({ open: !s.open })),
  closeMenu: () => set({ open: false }),
}));
