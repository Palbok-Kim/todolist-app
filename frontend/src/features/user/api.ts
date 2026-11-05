import { apiRequest } from '../../api/client';
import type { OkResponse, User } from '../../api/types';

export interface UpdateMeRequest {
  name?: string;
  timezone?: string;
}
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const updateMe = (body: UpdateMeRequest) => apiRequest<User>('PATCH', '/users/me', body);
export const changePassword = (body: ChangePasswordRequest) =>
  apiRequest<OkResponse>('PUT', '/users/me/password', body);
