import { logger } from '../lib/logger.js';

// SO-06: 이 7개 필드만 남긴다. 헤더·쿠키·body·query는 넣지 않는다
export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      userId: req.user?.id ?? null,
      durationMs: Number(process.hrtime.bigint() - started) / 1e6,
    });
  });
  next();
}
