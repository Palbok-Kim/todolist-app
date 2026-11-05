// process.env를 읽는 유일한 곳 (SO-01). 잘못된 설정이면 기동을 거부한다
const env = process.env;

function fail(message) {
  process.stderr.write(`config: ${message}\n`);
  process.exit(1);
}

function required(name) {
  const value = env[name];
  if (!value) fail(`${name}이(가) 없다`);
  return value;
}

// SO-03, 9-design.md 5.3: base64url 디코딩 후 48바이트(384비트) 이상
function secret(name) {
  const value = required(name);
  if (!/^[A-Za-z0-9_-]+$/.test(value)) fail(`${name}은(는) base64url 문자열이어야 한다`);
  if (Buffer.from(value, 'base64url').length < 48)
    fail(`${name}은(는) 디코딩 후 48바이트 이상이어야 한다`);
  if (nodeEnv === 'production' && value.includes('change-me'))
    fail(`production에서 ${name}이(가) 자리표시자다`);
  return value;
}

function positiveInt(name, fallback) {
  const value = Number(env[name] ?? fallback);
  if (!Number.isInteger(value) || value <= 0) fail(`${name}은(는) 양의 정수여야 한다`);
  return value;
}

// SO-04
const nodeEnv = env.NODE_ENV ?? 'development';
if (!['development', 'test', 'production'].includes(nodeEnv))
  fail(`NODE_ENV=${nodeEnv}는 허용하지 않는다`);

// SO-16: 기본은 프록시 불신, 모든 프록시 신뢰(true)는 거부
const trustProxy = env.TRUST_PROXY || false;
if (trustProxy === 'true') fail('TRUST_PROXY=true는 허용하지 않는다');

// SO-05, XQ-06: 로그인 제한 IP 예외는 구현하지 않으며 production에서 그 키가 있으면 기동을 거부한다
if (nodeEnv === 'production' && env.LOGIN_LIMIT_EXEMPT_IPS)
  fail('production에서 LOGIN_LIMIT_EXEMPT_IPS는 허용하지 않는다');

export const config = Object.freeze({
  nodeEnv,
  port: positiveInt('PORT', 3000),
  databaseUrl: required('DATABASE_URL'),
  pgPoolMax: positiveInt('PG_POOL_MAX', 10), // NFR-05
  jwtSecret: secret('JWT_SECRET'),
  csrfSecret: secret('CSRF_SECRET'),
  trustProxy,
  cookieSecure: nodeEnv === 'production', // SO-04, NFR-07, NFR-09(운영은 HTTPS)
  refreshReuseGraceMs: 10_000, // SO-17, AQ-13
});
