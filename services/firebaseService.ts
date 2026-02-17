
import { Staff, Request, Communication, RequestStatus, UserInvitation, UserRole, NotificationPrefs } from '../types';
import { MOCK_STAFF } from './mockData';

const STORAGE_KEY_REQUESTS = 'parrish_requests';
const STORAGE_KEY_USER = 'parrish_current_user';
const STORAGE_KEY_STAFF_LIST = 'parrish_all_staff';
const STORAGE_KEY_INVITES = 'parrish_invites';
const STORAGE_KEY_MESSAGES = 'parrish_messages';

export const firebaseService = {
  // --- NOTIFICATIONS (Simulated) ---
  simulateEmail: (to: string, subject: string, body: string) => {
    console.log(`%c[EMAIL SERVICE] Sending to: ${to}\nSubject: ${subject}\nBody: ${body}`, "color: #2563eb; font-weight: bold;");
    // In a real production app, this would trigger an SMTP call or a Firebase Cloud Function
  },

  notifyUser: (userId: string, type: 'status' | 'message', data: any) => {
    const allStaff = firebaseService.getAllStaff();
    const recipient = allStaff.find(s => s.uid === userId);
    
    if (!recipient || !recipient.notificationPrefs) return;

    if (type === 'status' && recipient.notificationPrefs.emailOnStatusChange) {
      firebaseService.simulateEmail(
        recipient.email,
        `Request #${data.requestId} Update - Parrish Portal`,
        `Hello ${recipient.displayName},\n\nYour request for patient ${data.patientName} has been ${data.status.toUpperCase()}.\n\nAdmin Notes: ${data.adminNotes || 'No notes provided.'}\n\nView details on the portal.`
      );
    }

    if (type === 'message' && recipient.notificationPrefs.emailOnNewMessage) {
      firebaseService.simulateEmail(
        recipient.email,
        `New Message from ${data.senderName} - Parrish Portal`,
        `Hello ${recipient.displayName},\n\nYou have received a new clinical message from ${data.senderName}.\n\nMessage preview: "${data.messageBody.substring(0, 50)}..."\n\nPlease log in to the portal to reply.`
      );
    }
  },

  // --- AUTH ---
  login: async (email: string, pin: string): Promise<Staff | null> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const allStaff = firebaseService.getAllStaff();
    const user = allStaff.find(u => u.email === email && u.pin === pin);
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

  // --- USER MANAGEMENT ---
  getAllStaff: (): Staff[] => {
    const data = localStorage.getItem(STORAGE_KEY_STAFF_LIST);
    if (!data) {
      const seeded = MOCK_STAFF.map(s => ({ 
        ...s, 
        hasCompletedOnboarding: true, 
        status: 'active' as const,
        notificationPrefs: { emailOnStatusChange: true, emailOnNewMessage: true }
      }));
      localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(data);
  },

  updateStaff: async (uid: string, updates: Partial<Staff>): Promise<void> => {
    const staff = firebaseService.getAllStaff();
    const idx = staff.findIndex(s => s.uid === uid);
    if (idx !== -1) {
      staff[idx] = { ...staff[idx], ...updates, updatedAt: Date.now() };
      localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(staff));
      
      const current = firebaseService.getCurrentUser();
      if (current?.uid === uid) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(staff[idx]));
      }
    }
  },

  deleteStaff: async (uid: string): Promise<void> => {
    const staff = firebaseService.getAllStaff();
    const filtered = staff.filter(s => s.uid !== uid);
    localStorage.setItem(STORAGE_KEY_STAFF_LIST, JSON.stringify(filtered));
  },

  // --- MESSAGING ---
  getMessagesBetween: (uid1: string, uid2: string): Communication[] => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const messages: Communication[] = data ? JSON.parse(data) : [];
    return messages.filter(m => 
      (m.senderId === uid1 && m.recipientId === uid2) || 
      (m.senderId === uid2 && m.recipientId === uid1)
    ).sort((a, b) => a.createdAt - b.createdAt);
  },

  sendMessage: async (message: Omit<Communication, 'id' | 'createdAt' | 'read'>): Promise<void> => {
    const data = localStorage.getItem(STORAGE_KEY_MESSAGES);
    const messages: Communication[] = data ? JSON.parse(data) : [];
    const newMessage: Communication = {
      ...message,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      read: false
    };
    messages.push(newMessage);
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));

    // Trigger notification
    firebaseService.notifyUser(message.recipientId, 'message', {
      senderName: message.senderName,
      messageBody: message.messageBody
    });
  },

  // --- INVITES ---
  getInvites: (): UserInvitation[] => {
    const data = localStorage.getItem(STORAGE_KEY_INVITES);
    return data ? JSON.parse(data) : [];
  },

  sendInvite: async (email: string, role: UserRole, admin: Staff): Promise<void> => {
    const invites = firebaseService.getInvites();
    const newInvite: UserInvitation = {
      id: Math.random().toString(36).substr(2, 9),
      email,
      role,
      invitedBy: admin.uid,
      invitedByName: admin.displayName,
      createdAt: Date.now(),
      status: 'pending'
    };
    invites.push(newInvite);
    localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(invites));
    
    // Notify the invited email (simulated)
    firebaseService.simulateEmail(
      email,
      "You've been invited to Parrish DME Portal",
      `Hello,\n\n${admin.displayName} has invited you to join the Parrish Health DME Portal as a ${role}.\n\nPlease use your organizational email to log in and set your security PIN.`
    );
  },

  revokeInvite: async (id: string): Promise<void> => {
    const invites = firebaseService.getInvites();
    const filtered = invites.filter(i => i.id !== id);
    localStorage.setItem(STORAGE_KEY_INVITES, JSON.stringify(filtered));
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
      const request = requests[index];
      requests[index] = {
        ...request,
        status,
        adminNotes,
        processedBy: adminId,
        processedAt: Date.now(),
        updatedAt: Date.now()
      };
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(requests));

      // Trigger notification for the submitter
      firebaseService.notifyUser(request.submitterId, 'status', {
        requestId,
        patientName: request.patientName,
        status,
        adminNotes
      });
    }
  }
};
