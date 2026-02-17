
import { Staff, Request, Communication, RequestStatus } from '../types';
import { MOCK_STAFF } from './mockData';

// In a real app, this would use 'firebase/app', 'firebase/auth', etc.
// For this prototype, we use LocalStorage to simulate persistence.

const STORAGE_KEY_REQUESTS = 'parrish_requests';
const STORAGE_KEY_COMMUNICATIONS = 'parrish_comms';
const STORAGE_KEY_USER = 'parrish_current_user';

export const firebaseService = {
  // --- AUTH ---
  login: async (email: string, pin: string): Promise<Staff | null> => {
    // Simulating Firebase Auth delay
    await new Promise(resolve => setTimeout(resolve, 500));
    const user = MOCK_STAFF.find(u => u.email === email && u.pin === pin);
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
      return user;
    }
    return null;
  },

  getCurrentUser: (): Staff | null => {
    const data = localStorage.getItem(STORAGE_KEY_USER);
    return data ? JSON.parse(data) : null;
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY_USER);
  },

  // --- REQUESTS ---
  submitRequest: async (request: Omit<Request, 'id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<string> => {
    const requests = firebaseService.getRequests();
    const newRequest: Request = {
      ...request,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'pending'
    };
    requests.push(newRequest);
    localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    return newRequest.id;
  },

  getRequests: (): Request[] => {
    const data = localStorage.getItem(STORAGE_KEY_REQUESTS);
    return data ? JSON.parse(data) : [];
  },

  updateRequestStatus: async (requestId: string, status: RequestStatus, adminNotes: string, adminId: string): Promise<void> => {
    const requests = firebaseService.getRequests();
    const index = requests.findIndex(r => r.id === requestId);
    if (index !== -1) {
      requests[index] = {
        ...requests[index],
        status,
        adminNotes,
        processedBy: adminId,
        processedAt: Date.now(),
        updatedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));
    }
  },

  // --- COMMUNICATIONS ---
  sendCommunication: async (comm: Omit<Communication, 'id' | 'createdAt' | 'read'>): Promise<void> => {
    const comms = firebaseService.getCommunications();
    const newComm: Communication = {
      ...comm,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      read: false
    };
    comms.push(newComm);
    localStorage.setItem(STORAGE_KEY_COMMUNICATIONS, JSON.stringify(comms));
  },

  getCommunications: (): Communication[] => {
    const data = localStorage.getItem(STORAGE_KEY_COMMUNICATIONS);
    return data ? JSON.parse(data) : [];
  }
};
