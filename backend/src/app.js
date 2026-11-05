import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { AppError, ERR } from './errors.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authenticate } from './middleware/authenticate.js';
import { csrf } from './middleware/csrf.js';
import { healthRouter } from './routes/health.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { categoryRouter } from './routes/category.routes.js';
import { todoRouter } from './routes/todo.routes.js';

// 미들웨어·라우트 순서(DL-05): 공개 라우트 → 인증 → CSRF → 보호 라우트 → 404 → 에러 핸들러
export const app = express();
app.set('trust proxy', config.trustProxy); // SO-16

app.use(requestLogger);
app.use(cookieParser());
app.use(express.json());
app.use('/api', healthRouter);
app.use('/api', authRouter);
// DL-05: 인증이 CSRF보다 먼저. 액세스 쿠키 Path=/api라 /api 아래에만 적용
app.use('/api', authenticate, csrf);
app.use('/api', userRouter);
app.use('/api', categoryRouter);
app.use('/api', todoRouter);
app.use((req, res, next) => next(new AppError(ERR.NOT_FOUND, '대상을 찾을 수 없습니다.')));
app.use(errorHandler);
