export type MachineStatus = 'Working' | 'Partially Working' | 'Not Working' | 'Intermittent Fault';
export type MachineCategory = 'ATTRACTIONS' | 'REDEMPTION' | 'KIDDIE RIDES' | 'VIDEO GAMES' | 'SKILL GAMES' | 'CLAW MACHINE';
export type MaintenanceResult = 'Fixed' | 'Partially Improved' | 'Not Fixed';
export type RecommendedAction = 'Repair' | 'Replace Part' | 'Replace Board' | 'Reinstall Software / Re-image' | 'Further Inspection Required';
export type Priority = 'High' | 'Medium' | 'Low';
export type Urgency = 'Urgent' | 'Normal' | 'Can Be Delayed';

export type UserRole = 'admin' | 'technician' | 'viewer' | 'manager';
export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export interface AppUser {
  uid: string;
  username?: string;
  email?: string;
  displayName?: string;
  role: UserRole;
}

export interface PartToPurchase {
  id: string;
  description: string;
  quantity: number;
  link?: string;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'manual' | 'tutorial' | 'other';
}

export interface Machine {
  id?: string;
  name: string;
  model: string;
  manufacturer?: string;
  category: MachineCategory;
  serialNumber: string;
  location: string;
  status: MachineStatus;
  lastResult?: MaintenanceResult;
  lastInspectionDate?: string;
  partsToPurchase?: PartToPurchase[];
  resources?: Resource[];
  imageUrl?: string;
  fixedDate?: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  updatedAt: any;
  createdAt: any;
}

export interface Contact {
  id?: string;
  storeName: string;
  contactPerson: string;
  email: string;
  contactNumbers: string[]; // up to 3
  address: string;
  websiteLink: string;
  notes?: string;
  history?: StatusHistoryEntry[];
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedAt: any;
  notes?: string;
}

export interface PurchasingOrder {
  id?: string;
  manufacturer: string;
  contactPerson: string;
  contactNumbers: string[]; // up to 3
  links: string[];
  partNumber: string;
  price: number;
  currency: string;
  shippingTime: string;
  status: 'Draft' | 'Pending' | 'Approved' | 'Ordered' | 'Received' | 'Cancelled' | 'Rejected';
  machineId?: string;
  machineName?: string;
  notes?: string;
  rejectionNotes?: string;
  createdBy?: string;
  createdByEmail?: string;
  approvedBy?: string;
  approvedAt?: any;
  rejectedBy?: string;
  rejectedAt?: any;
  statusHistory?: StatusHistoryEntry[];
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface MaintenanceLog {
  id?: string;
  machineId: string;
  userEmail?: string;
  inspectionDate: string;
  preparedBy: string;
  status: MachineStatus;
  failureDate?: string;
  downtimeDuration?: string;
  problem: string;
  errorCode?: string;
  affectedSystem?: string;
  rootCause?: string;
  technicalFindings?: string;
  testsPerformed?: string;
  repairsAttempted?: string;
  result: MaintenanceResult;
  recommendedAction: RecommendedAction;
  requiredPart?: string;
  partNumber?: string;
  supplier?: string;
  leadTime?: string;
  partCost: number;
  shippingCost: number;
  laborCost: number;
  totalCost: number;
  currency: string;
  priority: Priority;
  revenueLoss: number;
  urgency: Urgency;
  finalRecommendation: string;
  returnToOperationDate?: string;
  fixedDate?: string;
  technicianName: string;
  managerName: string;
  previousStatus?: MachineStatus;
  previousResult?: MaintenanceResult;
  previousInspectionDate?: string;
  approvalDate?: string;
  approvalStatus?: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: any;
  approvalComment?: string;
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  createdAt: any;
}

export interface PortalActivity {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string; // e.g., 'Created Machine', 'Updated Order', 'Approved Log'
  details: string; // e.g., 'Created machine: Big Dipper (S/N: 12345)'
  entityId?: string;
  entityType?: 'machine' | 'log' | 'order' | 'contact' | 'user';
  createdAt: any;
}
