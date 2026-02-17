
export type UserRole = 'admin' | 'nurse' | 'homemaker' | 'office_staff';
export type RequestType = 'dme' | 'medication' | 'clinical' | 'communication';
export type RequestStatus = 'pending' | 'approved' | 'denied';

export interface Staff {
  uid: string;
  email: string;
  pin: string;
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
}

export interface DMEEquipment {
  id: string;
  itemName: string;
  sku: string;
  category: string;
  currentStock?: number;
}

export interface DMEItem {
  itemId: string;
  quantity: number;
  name: string;
}

export interface Request {
  id: string;
  type: RequestType;
  submitterId: string;
  submitterName: string;
  patientName: string;
  patientId: string;
  details: any;
  status: RequestStatus;
  adminNotes?: string;
  createdAt: number;
  updatedAt: number;
  processedBy?: string;
  processedAt?: number;
}

export interface Communication {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  messageType: 'clinical' | 'general';
  messageBody: string;
  read: boolean;
  createdAt: number;
}
