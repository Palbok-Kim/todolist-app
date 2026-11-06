import { create } from 'zustand';

type View = 'month' | 'week' | 'day';

interface S {
  view: View;
  anchorDate: string | null;
  selectedDate: string | null;
  hiddenCategoryIds: string[];
  setView: (view: View) => void;
  setAnchorDate: (date: string | null) => void;
  setSelectedDate: (date: string | null) => void;
  toggleCategory: (id: string) => void;
}

// 날짜 null은 오늘. 오늘 계산은 사용자 timezone이 필요해 화면에서 한다(CN-06). 숨긴 카테고리는 저장하지 않는다(PRD 4.6)
export const useCalendarStore = create<S>()((set) => ({
  view: 'month',
  anchorDate: null,
  selectedDate: null,
  hiddenCategoryIds: [],
  setView: (view) => set({ view }),
  setAnchorDate: (anchorDate) => set({ anchorDate }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  toggleCategory: (id) =>
    set((s) => ({
      hiddenCategoryIds: s.hiddenCategoryIds.includes(id)
        ? s.hiddenCategoryIds.filter((x) => x !== id)
        : [...s.hiddenCategoryIds, id],
    })),
}));
