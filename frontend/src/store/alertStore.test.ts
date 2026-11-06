import { describe, expect, it } from 'vitest';
import { useAlertStore } from './alertStore';

describe('alertStore 고정 알림 (SC-03 3, AC-23)', () => {
  it('고정 알림은 오류 알림에 덮이지 않고 clearAlert 뒤에는 다시 바뀐다', () => {
    const { showAlert, clearAlert } = useAlertStore.getState();
    showAlert('info', '만료', true);
    showAlert('error', '로그인이 필요합니다.');
    expect(useAlertStore.getState().alert?.message).toBe('만료');
    clearAlert();
    showAlert('error', '실패');
    expect(useAlertStore.getState().alert?.message).toBe('실패');
  });
});
