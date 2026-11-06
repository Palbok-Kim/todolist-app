import { describe, expect, test, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { ErrorPage } from './ErrorPage';

// prefsStore가 첫 테마를 정할 때 window.matchMedia를 읽는다. DOM 없는 환경이라 최소한만 흉내 낸다
vi.hoisted(() => {
  globalThis.window ??= { matchMedia: () => ({ matches: false }) } as never;
});

// WF 3.2 오류 화면: 라우터가 넘겨준 오류 종류에 따라 문구가 달라진다(DOM 없이 서버 렌더로 확인)
async function render(path: string) {
  const router = createMemoryRouter(
    [
      {
        errorElement: <ErrorPage />,
        children: [
          { path: '/todos', element: <p>목록</p> },
          {
            path: '/boom',
            loader: () => {
              throw new Error('secret stack detail');
            },
            element: <p>안 보임</p>,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  await new Promise<void>((resolve) => {
    if (router.state.initialized) return resolve();
    const off = router.subscribe((s) => s.initialized && (off(), resolve()));
  });
  return renderToString(<RouterProvider router={router} />);
}

describe('ErrorPage', () => {
  test('없는 주소는 404 문구와 목록으로 링크만 보인다', async () => {
    const html = await render('/abc');
    expect(html).toContain('페이지를 찾을 수 없습니다');
    expect(html).toContain('href="/todos"');
    expect(html).not.toContain('새로고침');
  });

  test('그 밖의 오류는 일반 안내와 새로고침을 보이고 오류 세부는 숨긴다', async () => {
    const html = await render('/boom');
    expect(html).toContain('문제가 발생했습니다. 잠시 후 다시 시도하세요.');
    expect(html).toContain('새로고침');
    expect(html).not.toContain('secret stack detail');
    expect(html).not.toContain('Unexpected Application Error');
  });
});
