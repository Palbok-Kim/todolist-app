import { describe, expect, it } from 'vitest';
import { useCalendarStore } from './calendarStore';

describe('calendarStore.toggleCategory (FR-11)', () => {
  it('누르면 숨기고 다시 누르면 보인다', () => {
    const { toggleCategory } = useCalendarStore.getState();
    toggleCategory('a');
    toggleCategory('b');
    expect(useCalendarStore.getState().hiddenCategoryIds).toEqual(['a', 'b']);
    toggleCategory('a');
    expect(useCalendarStore.getState().hiddenCategoryIds).toEqual(['b']);
  });
});
