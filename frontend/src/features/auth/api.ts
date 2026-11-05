import { apiRequest } from '../../api/client';
import type { OkResponse, User } from '../../api/types';

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  timezone?: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}

export const signup = (body: SignupRequest) => apiRequest<User>('POST', '/auth/signup', body);
export const login = (body: LoginRequest) => apiRequest<User>('POST', '/auth/login', body);
export const logout = () => apiRequest<OkResponse>('POST', '/auth/logout');
export const getMe = () => apiRequest<User>('GET', '/users/me');
