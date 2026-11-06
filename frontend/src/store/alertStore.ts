import { create } from 'zustand';

interface Alert {
  kind: 'error' | 'info';
  message: string;
  sticky?: boolean;
}

interface S {
  alert: Alert | null;
  showAlert: (kind: Alert['kind'], message: string, sticky?: boolean) => void;
  clearAlert: () => void;
}

// 상단 알림은 한 줄뿐이라 새 알림이 이전 것을 덮어쓴다(WF-00).
// 고정(sticky) 알림은 clearAlert 전까지 오류 알림에 덮이지 않는다: 세션 만료 안내가 떠난 화면의 401 알림에 지워지지 않게(SC-03 3, AC-23)
export const useAlertStore = create<S>()((set) => ({
  alert: null,
  showAlert: (kind, message, sticky = false) =>
    set((s) => (s.alert?.sticky && kind === 'error' ? s : { alert: { kind, message, sticky } })),
  clearAlert: () => set({ alert: null }),
}));
