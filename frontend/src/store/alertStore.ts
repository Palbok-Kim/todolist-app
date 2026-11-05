import { create } from 'zustand';

interface Alert {
  kind: 'error' | 'info';
  message: string;
}

interface S {
  alert: Alert | null;
  showAlert: (kind: Alert['kind'], message: string) => void;
  clearAlert: () => void;
}

// 상단 알림은 한 줄뿐이라 새 알림이 이전 것을 덮어쓴다(WF-00)
export const useAlertStore = create<S>()((set) => ({
  alert: null,
  showAlert: (kind, message) => set({ alert: { kind, message } }),
  clearAlert: () => set({ alert: null }),
}));
