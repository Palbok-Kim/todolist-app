import { config } from '../config.js';

// 화면과 API가 다른 출처라 CORS로 허용한다. 쿠키 인증이라 허용 출처를 정확히 되돌려 주고 '*'는 쓰지 않는다
const ALLOWED = new Set(config.corsOrigins);

export function cors(req, res, next) {
  const origin = req.get('Origin');
  const allowed = origin !== undefined && ALLOWED.has(origin);
  res.vary('Origin');
  if (allowed) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Credentials', 'true');
  }
  // 사전 요청(preflight)은 인증 전에 여기서 끝낸다. 허용하지 않은 출처는 헤더 없이 204라 브라우저가 막는다
  if (req.method === 'OPTIONS' && req.get('Access-Control-Request-Method')) {
    if (allowed) {
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      res.set('Access-Control-Max-Age', '600');
    }
    return res.status(204).end();
  }
  next();
}
