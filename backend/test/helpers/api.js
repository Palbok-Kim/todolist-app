import { app } from '../../src/app.js';

export async function startApp(target = app) {
  const server = target.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  async function request(path, { method = 'GET', body, session } = {}) {
    const headers = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    if (session) headers.cookie = session.cookie;
    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // JSON이 아니면 body는 null
    }
    return { status: res.status, headers: res.headers, text, body: parsed };
  }

  const close = () => new Promise((resolve) => server.close(() => resolve()));
  return { baseUrl, request, close };
}

export function sessionFrom(headers) {
  const pairs = headers.getSetCookie().map((c) => c.split(';')[0]);
  return { cookie: pairs.join('; ') };
}

async function authenticate(api, path, input) {
  const res = await api.request(path, { method: 'POST', body: input });
  if (res.status < 200 || res.status >= 300)
    throw new Error(`${path} 실패: ${res.status} ${res.text}`);
  return { ...sessionFrom(res.headers), body: res.body };
}

export const signup = (api, input) => authenticate(api, '/api/auth/signup', input);
export const login = (api, input) => authenticate(api, '/api/auth/login', input);
