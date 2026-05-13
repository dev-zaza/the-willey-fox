import api from './api';

export const familiesService = {
  list: () => api.get('/families').then((r) => r.data),

  get: (id: string) => api.get(`/families/${id}`).then((r) => r.data),

  create: (name: string) => api.post('/families', { name }).then((r) => r.data),

  addMember: (familyId: string, payload: { userId?: string; email?: string }) =>
    api.post(`/families/${familyId}/members`, payload).then((r) => r.data),

  removeMember: (familyId: string, userId: string) =>
    api.delete(`/families/${familyId}/members/${userId}`).then((r) => r.data),

  addQrCode: (familyId: string, qrCodeId: string) =>
    api.post(`/families/${familyId}/qr-codes`, { qrCodeId }).then((r) => r.data),

  removeQrCode: (familyId: string, qrCodeId: string) =>
    api.delete(`/families/${familyId}/qr-codes/${qrCodeId}`).then((r) => r.data),

  delete: (familyId: string) =>
    api.delete(`/families/${familyId}`).then((r) => r.data),
};
