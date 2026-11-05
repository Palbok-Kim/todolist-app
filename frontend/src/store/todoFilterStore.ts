import { create } from 'zustand';

interface S {
  categoryId: string | null;
  status: string | null;
  setCatId: (id: string | null) => void;
  setStatus: (status: string | null) => void;
  resetFilter: () => void;
}

// null은 전체. 서버 엔티티 타입을 쓰지 않으려 값은 문자열로만 다룬다(DL-12)
export const useListFilterStore = create<S>()((set) => ({
  categoryId: null,
  status: null,
  setCatId: (categoryId) => set({ categoryId }),
  setStatus: (status) => set({ status }),
  resetFilter: () => set({ categoryId: null, status: null }),
}));
