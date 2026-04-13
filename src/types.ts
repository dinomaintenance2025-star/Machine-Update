export type MachineStatus = 'Working' | 'Partially Working' | 'Not Working' | 'Intermittent Fault';
export type MachineCategory = 'BIG RIDES/ATTRACTIONS' | 'REDEMPTION' | 'KIDDIE RIDES' | 'VIDEO GAMES' | 'SKILL GAMES';
export type MaintenanceResult = 'Fixed' | 'Partially Improved' | 'Not Fixed';
export type RecommendedAction = 'Repair' | 'Replace Part' | 'Replace Board' | 'Reinstall Software / Re-image' | 'Further Inspection Required';
export type Priority = 'High' | 'Medium' | 'Low';
export type Urgency = 'Urgent' | 'Normal' | 'Can Be Delayed';

export interface Machine {
  id?: string;
  name: string;
  model: string;
  category: MachineCategory;
  serialNumber: string;
  location: string;
  status: MachineStatus;
  lastResult?: MaintenanceResult;
  lastInspectionDate?: string;
  updatedAt: any;
  createdAt: any;
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
  technicianName: string;
  managerName: string;
  approvalDate?: string;
  createdAt: any;
}
