import React, { useState } from 'react';
import { Machine, MaintenanceLog, MachineStatus, MaintenanceResult, RecommendedAction, Priority, Urgency, MachineCategory, PartToPurchase, Resource } from '../types';
import { X, Save, Plus, Trash2, ChevronRight, ChevronDown, History, ShoppingCart, Link as LinkIcon, ExternalLink, BookOpen, Video, FileText, AlertCircle, Settings, Wrench, Info, Zap, Clock, CheckCircle2, Activity, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { categoryConfig } from '../constants';
import { collection, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import HistoryList from './HistoryList';
import ConfirmModal from './ConfirmModal';
import { logActivity } from '../lib/activityLogger';

interface MachineFormProps {
  user: any;
  machine?: Machine;
  onClose: () => void;
  onSave: (message?: string) => void;
  initialTab?: 'history' | 'info' | 'status' | 'technician' | 'final' | 'resources';
}

export default function MachineForm({ user, machine, onClose, onSave, initialTab }: MachineFormProps) {
  const [activeTab, setActiveTab] = useState<'history' | 'info' | 'status' | 'technician' | 'final' | 'resources'>(
    initialTab || (machine?.id ? 'history' : 'info')
  );
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isTechnician = user?.role === 'technician';
  const canEdit = isAdmin || isManager || isTechnician;
  const canApprove = isAdmin || isManager;
  
  const [formData, setFormData] = useState<Partial<MaintenanceLog & Machine>>({
    name: machine?.name || '',
    model: machine?.model || '',
    manufacturer: machine?.manufacturer || '',
    category: (machine?.category as string) === 'BIG RIDES/ATTRACTIONS' ? 'ATTRACTIONS' : (machine?.category || 'VIDEO GAMES'),
    serialNumber: machine?.serialNumber || '',
    location: machine?.location || '',
    status: machine?.status || 'Working',
    inspectionDate: new Date().toISOString().split('T')[0],
    preparedBy: user?.displayName || user?.email || '',
    problem: '',
    errorCode: '',
    affectedSystem: '',
    rootCause: '',
    technicalFindings: '',
    testsPerformed: '',
    repairsAttempted: '',
    result: 'Fixed',
    recommendedAction: 'Repair',
    requiredPart: '',
    partNumber: '',
    supplier: '',
    leadTime: '',
    priority: 'Medium',
    urgency: 'Normal',
    currency: 'AED',
    partCost: 0,
    shippingCost: 0,
    laborCost: 0,
    totalCost: 0,
    revenueLoss: 0,
    failureDate: '',
    fixedDate: machine?.fixedDate || '',
    imageUrl: machine?.imageUrl || '',
    downtimeDuration: '',
    technicianName: '',
    managerName: '',
  });

  const [partsToPurchase, setPartsToPurchase] = useState<PartToPurchase[]>(machine?.partsToPurchase || []);
  const [resources, setResources] = useState<Resource[]>(machine?.resources || []);

  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<MaintenanceLog[]>([]);
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (machine?.id) {
      const q = query(
        collection(db, `machines/${machine.id}/logs`),
        orderBy('createdAt', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MaintenanceLog[];
        setPendingLogs(logs);
      });
      return () => unsubscribe();
    }
  }, [machine?.id]);
  const [partToDelete, setPartToDelete] = useState<string | null>(null);
  const [resourceToDelete, setResourceToDelete] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      const numVal = type === 'number' ? (parseFloat(value) || 0) : value;
      const newData = { ...prev, [name]: numVal };
      
      // Auto-calculate total cost
      if (['partCost', 'shippingCost', 'laborCost'].includes(name)) {
        const val = parseFloat(value) || 0;
        const pc = name === 'partCost' ? val : (prev.partCost || 0);
        const sc = name === 'shippingCost' ? val : (prev.shippingCost || 0);
        const lc = name === 'laborCost' ? val : (prev.laborCost || 0);
        newData.totalCost = pc + sc + lc;
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.name) {
        alert("Machine Name is required");
        setActiveTab('info');
        setLoading(false);
        return;
      }
      let machineId = machine?.id;

      // Clean undefined values
      const cleanData = (obj: any) => {
        const newObj = { ...obj };
        Object.keys(newObj).forEach(key => {
          if (newObj[key] === undefined) {
            newObj[key] = '';
          }
        });
        return newObj;
      };

      const cleanedFormData = cleanData(formData);

      const isFixed = (machine?.status === 'Not Working' || machine?.status === 'Partially Working') && cleanedFormData.status === 'Working';
      const fixedDate = isFixed ? new Date().toISOString().split('T')[0] : cleanedFormData.fixedDate;

      const machineData = {
        name: cleanedFormData.name || '',
        model: cleanedFormData.model || '',
        manufacturer: cleanedFormData.manufacturer || '',
        category: cleanedFormData.category || 'VIDEO GAMES',
        serialNumber: cleanedFormData.serialNumber || '',
        location: cleanedFormData.location || '',
        status: cleanedFormData.status || 'Working',
        fixedDate,
        lastResult: cleanedFormData.result || 'Fixed',
        lastInspectionDate: cleanedFormData.inspectionDate || new Date().toISOString().split('T')[0],
        imageUrl: cleanedFormData.imageUrl || '',
        partsToPurchase,
        resources,
        updatedAt: serverTimestamp(),
      };

      if (machineId) {
        await updateDoc(doc(db, 'machines', machineId), machineData);
        logActivity(user, 'Updated Machine', `Updated machine: ${machineData.name} (S/N: ${machineData.serialNumber})`, 'machine', machineId);
      } else {
        const docRef = await addDoc(collection(db, 'machines'), {
          ...machineData,
          createdAt: serverTimestamp(),
        });
        machineId = docRef.id;
        logActivity(user, 'Created Machine', `Created new machine: ${machineData.name} (S/N: ${machineData.serialNumber})`, 'machine', machineId);
      }

      // Add log only if we are on the technician tab OR if it's a new machine
      if (activeTab === 'technician' || !machine?.id) {
        const logDoc = await addDoc(collection(db, `machines/${machineId}/logs`), {
          ...cleanedFormData,
          fixedDate,
          preparedBy: user?.displayName || user?.email || cleanedFormData.preparedBy,
          machineId,
          userEmail: user?.displayName || user?.email || 'Unknown',
          approvalStatus: 'Pending',
          previousStatus: machine?.status || 'Working',
          previousResult: machine?.lastResult || 'Fixed',
          previousInspectionDate: machine?.lastInspectionDate || '',
          createdAt: serverTimestamp(),
        });
        logActivity(user, 'Submitted Report', `Submitted maintenance report for ${machineData.name}`, 'log', logDoc.id);
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving machine:", error);
      alert("Failed to save. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMachine = async () => {
    if (!machine?.id) return;

    setIsDeleting(true);
    try {
      await updateDoc(doc(db, 'machines', machine.id), {
        isDeleted: true,
        deletedBy: user?.displayName || user?.email || 'Admin',
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      logActivity(user, 'Deleted Machine', `Marked machine as removed: ${machine.name}`, 'machine', machine.id);
      onSave(`Machine "${machine.name}" marked as REMOVED`);
      onClose();
    } catch (error) {
      console.error("Error removing machine:", error);
      alert("Failed to remove machine.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async (logId: string, status: 'Approved' | 'Rejected' = 'Approved') => {
    if (!machine?.id) return;
    try {
      const logRef = doc(db, `machines/${machine.id}/logs`, logId);
      
      await updateDoc(logRef, {
        approvalStatus: status,
        approvedBy: user?.displayName || user?.email || 'Admin',
        approvedAt: serverTimestamp(),
        approvalDate: new Date().toISOString().split('T')[0],
        approvalComment: approvalComments[logId] || ''
      });

      logActivity(user, status === 'Approved' ? 'Approved Report' : 'Rejected Report', `${status} maintenance report for ${machine.name}`, 'log', logId);

      // If rejected, revert machine status to previous state
      if (status === 'Rejected') {
        const logToRevert = pendingLogs.find(l => l.id === logId);
        if (logToRevert && logToRevert.previousStatus) {
          await updateDoc(doc(db, 'machines', machine.id), {
            status: logToRevert.previousStatus,
            lastResult: logToRevert.previousResult || 'Fixed',
            lastInspectionDate: logToRevert.previousInspectionDate || '',
            updatedAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error(`Error ${status.toLowerCase()} log:`, error);
      alert(`Failed to ${status.toLowerCase()}.`);
    }
  };

  const sections = [
    ...(machine?.id ? [{ id: 'history', label: 'Machine History' }] : []),
    { id: 'info', label: 'Machine Info' },
    { id: 'resources', label: 'Manuals & Tutorials' },
    { id: 'technician', label: 'Technician Tab' },
    { id: 'final', label: 'Final Approval' },
  ];

  const addPart = () => {
    setPartsToPurchase([...partsToPurchase, { id: crypto.randomUUID(), description: '', quantity: 1, link: '' }]);
  };

  const removePart = (id: string) => {
    setPartsToPurchase(partsToPurchase.filter(p => p.id !== id));
    setPartToDelete(null);
  };

  const updatePart = (id: string, field: keyof PartToPurchase, value: string | number) => {
    setPartsToPurchase(partsToPurchase.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addResource = () => {
    setResources([...resources, { id: crypto.randomUUID(), title: '', url: '', type: 'manual' }]);
  };

  const removeResource = (id: string) => {
    setResources(resources.filter(r => r.id !== id));
    setResourceToDelete(null);
  };

  const updateResource = (id: string, field: keyof Resource, value: string) => {
    setResources(resources.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/80 backdrop-blur-md rounded-none sm:rounded-2xl shadow-2xl w-full max-w-4xl h-full sm:h-auto sm:max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80 backdrop-blur-sm shrink-0">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate max-w-[250px] sm:max-w-none">
              {machine ? `Maintenance: ${machine.name}` : 'Add New Machine'}
            </h2>
            <p className="text-[10px] sm:text-xs text-slate-500">Complete all sections for a full maintenance report</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors shrink-0">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <AnimatePresence>
          {isDeleting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center"
              >
                <div className="w-12 h-12 border-4 border-rose-600/20 border-t-rose-600 rounded-full animate-spin" />
                <div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">Deleting Machine</h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Removing from fleet...</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteMachine}
          title="Remove Machine"
          message={`Are you sure you want to mark ${machine?.name} as REMOVED? This will hide it from the fleet dashboard.`}
          confirmText="Remove Machine"
        />

        <ConfirmModal
          isOpen={!!partToDelete}
          onClose={() => setPartToDelete(null)}
          onConfirm={() => partToDelete && removePart(partToDelete)}
          title="Remove Part"
          message="Are you sure you want to remove this part from the purchase list?"
          confirmText="Remove Part"
        />

        <ConfirmModal
          isOpen={!!resourceToDelete}
          onClose={() => setResourceToDelete(null)}
          onConfirm={() => resourceToDelete && removeResource(resourceToDelete)}
          title="Remove Resource"
          message="Are you sure you want to remove this manual or tutorial link?"
          confirmText="Remove Resource"
        />

        {/* Unified Tabs (Mobile style for all) */}
        <div className="flex items-center gap-2 overflow-x-auto px-4 py-3 bg-slate-50/50 backdrop-blur-sm border-b border-slate-100 no-scrollbar shrink-0">
          {[
            ...(machine?.id ? [{ id: 'history', icon: History, label: 'History' }] : []),
            { id: 'info', icon: Info, label: 'Info' },
            { id: 'resources', icon: BookOpen, label: 'Docs' },
            { id: 'technician', icon: Wrench, label: 'Tech' },
            { id: 'final', icon: CheckCircle2, label: 'Final' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveTab(s.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                activeTab === s.id 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-200' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Form Content */}
          <form id="machine-maintenance-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8">
            <fieldset disabled={!canEdit && activeTab !== 'final'} className="space-y-8">
              {activeTab === 'info' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                      <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Info className="w-3 h-3" />
                          Basic Information
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Machine Name</label>
                            <input 
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              disabled={!(isAdmin || isManager)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="e.g. Pac-Man Cabinet"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Image URL</label>
                            <input 
                              name="imageUrl"
                              value={formData.imageUrl}
                              onChange={handleChange}
                              disabled={!(isAdmin || isManager)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="e.g. https://example.com/machine.jpg"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Model</label>
                              <input 
                                name="model"
                                value={formData.model}
                                onChange={handleChange}
                                disabled={!(isAdmin || isManager)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="e.g. Namco Classic"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Category</label>
                                {formData.category && (
                                  <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest shadow-sm ${categoryConfig[formData.category as keyof typeof categoryConfig]?.bg} ${categoryConfig[formData.category as keyof typeof categoryConfig]?.text} ${categoryConfig[formData.category as keyof typeof categoryConfig]?.border}`}>
                                    {formData.category}
                                  </span>
                                )}
                              </div>
                              <select 
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                disabled={!(isAdmin || isManager)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              >
                                <option value="ATTRACTIONS">ATTRACTIONS</option>
                                <option value="REDEMPTION">REDEMPTION</option>
                                <option value="KIDDIE RIDES">KIDDIE RIDES</option>
                                <option value="VIDEO GAMES">VIDEO GAMES</option>
                                <option value="SKILL GAMES">SKILL GAMES</option>
                                <option value="CLAW MACHINE">CLAW MACHINE</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 rounded-[2rem] p-6 border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <MapPin className="w-3 h-3" />
                          Location & Identification
                        </h4>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Location</label>
                            <input 
                              name="location"
                              value={formData.location}
                              onChange={handleChange}
                              disabled={!(isAdmin || isManager)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="e.g. North Wing Arcade"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Serial Number</label>
                            <input 
                              name="serialNumber"
                              value={formData.serialNumber}
                              onChange={handleChange}
                              disabled={!(isAdmin || isManager)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="e.g. SN-99281"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Manufacturer</label>
                            <input 
                              name="manufacturer"
                              value={formData.manufacturer}
                              onChange={handleChange}
                              disabled={!(isAdmin || isManager)}
                              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-bold disabled:bg-slate-50 disabled:text-slate-500"
                              placeholder="e.g. SEGA, Namco, Bandai Namco"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-emerald-50/50 rounded-[2rem] p-6 border border-emerald-100">
                        <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          Operational Status
                        </h4>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {['Working', 'Partially Working', 'Not Working', 'Intermittent Fault'].map((status) => (
                              <button
                                key={status}
                                type="button"
                                onClick={() => canEdit && setFormData(prev => ({ ...prev, status: status as MachineStatus }))}
                                disabled={!canEdit}
                                className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                                  formData.status === status 
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-200'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                          <div className="p-4 bg-white/80 rounded-2xl border border-emerald-100">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Inspection Date</span>
                              <input 
                                type="date" 
                                name="inspectionDate" 
                                value={formData.inspectionDate} 
                                onChange={handleChange} 
                                className="text-xs font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 text-right"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Prepared By</span>
                              <input 
                                name="preparedBy" 
                                value={formData.preparedBy} 
                                onChange={handleChange} 
                                className="text-xs font-bold text-slate-700 bg-transparent border-none p-0 focus:ring-0 text-right"
                                placeholder="Your Name"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-emerald-600" />
                      Manuals & Tutorials
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={addResource}
                        className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Resource
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {resources.length === 0 ? (
                      <div className="md:col-span-2 text-center py-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <BookOpen className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">No manuals or tutorials linked yet.</p>
                      </div>
                    ) : (
                      resources.map((res) => (
                        <div key={res.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative group">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${
                              res.type === 'manual' ? 'bg-blue-50 text-blue-600' : 
                              res.type === 'tutorial' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                            }`}>
                              {res.type === 'manual' ? <FileText className="w-4 h-4" /> : 
                               res.type === 'tutorial' ? <Video className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
                            </div>
                            <select 
                              value={res.type}
                              onChange={(e) => updateResource(res.id, 'type', e.target.value as any)}
                              className="text-[10px] font-black uppercase tracking-widest bg-transparent outline-none cursor-pointer"
                            >
                              <option value="manual">Manual</option>
                              <option value="tutorial">Tutorial</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          
                          <div className="space-y-2">
                            <input 
                              value={res.title}
                              onChange={(e) => updateResource(res.id, 'title', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                              placeholder="Resource Title (e.g. Service Manual)"
                            />
                            <div className="flex items-center gap-2">
                              <input 
                                value={res.url}
                                onChange={(e) => updateResource(res.id, 'url', e.target.value)}
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="URL (https://...)"
                              />
                              {res.url && (
                                <a href={res.url} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors">
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          </div>

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setResourceToDelete(res.id)}
                              className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'technician' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                  {/* Status Section (Merged from Status Tab) */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <Activity className="w-5 h-5 text-emerald-600" />
                      Current Status
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                          <option value="Working">Working</option>
                          <option value="Partially Working">Partially Working</option>
                          <option value="Not Working">Not Working</option>
                          <option value="Intermittent Fault">Intermittent Fault</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Date of Failure</label>
                        <input type="date" name="failureDate" value={formData.failureDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Fixed Date</label>
                        <input type="date" name="fixedDate" value={formData.fixedDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Downtime Duration</label>
                        <input name="downtimeDuration" value={formData.downtimeDuration} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 2 days, 4 hours" />
                      </div>
                    </div>
                  </div>

                  {/* Diagnosis Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-emerald-600" />
                      Diagnosis
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Observed Problem</label>
                        <textarea name="problem" value={formData.problem} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="Describe what is happening..." />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Error Message / Code</label>
                          <input name="errorCode" value={formData.errorCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Error 404" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Affected Part / System</label>
                          <input name="affectedSystem" value={formData.affectedSystem} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. Power Supply" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Root Cause</label>
                        <textarea name="rootCause" value={formData.rootCause} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="What caused the failure?" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Technical Findings</label>
                        <textarea name="technicalFindings" value={formData.technicalFindings} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="Detailed technical notes..." />
                      </div>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-600" />
                      Actions Taken
                    </h3>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Tests Performed</label>
                        <textarea name="testsPerformed" value={formData.testsPerformed} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="What tests did you run?" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Repairs Attempted</label>
                        <textarea name="repairsAttempted" value={formData.repairsAttempted} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none h-20" placeholder="What did you try to fix?" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Result</label>
                        <select name="result" value={formData.result} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                          <option value="Fixed">Fixed</option>
                          <option value="Partially Improved">Partially Improved</option>
                          <option value="Not Fixed">Not Fixed</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Required Action Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-amber-600" />
                      Required Action
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Recommended Action</label>
                        <select name="recommendedAction" value={formData.recommendedAction} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                          <option value="Repair">Repair</option>
                          <option value="Replace Part">Replace Part</option>
                          <option value="Replace Board">Replace Board</option>
                          <option value="Reinstall Software / Re-image">Reinstall Software / Re-image</option>
                          <option value="Further Inspection Required">Further Inspection Required</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Required Part / Item</label>
                        <input name="requiredPart" value={formData.requiredPart} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Part name" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Part Number / Model</label>
                        <input name="partNumber" value={formData.partNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="PN-12345" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Suggested Supplier</label>
                        <input name="supplier" value={formData.supplier} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="Supplier name" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Estimated Lead Time</label>
                        <input name="leadTime" value={formData.leadTime} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="e.g. 3-5 business days" />
                      </div>
                    </div>
                  </div>

                  {/* Parts to Purchase Section */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-emerald-600" />
                        Parts to Purchase
                      </h3>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={addPart}
                          className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Part
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {partsToPurchase.length === 0 ? (
                        <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                          <p className="text-sm text-slate-500 font-medium">No parts listed for purchase.</p>
                        </div>
                      ) : (
                        partsToPurchase.map((part) => (
                          <div key={part.id} className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3 relative group">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                              <div className="md:col-span-6 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label>
                                <input
                                  value={part.description}
                                  onChange={(e) => updatePart(part.id, 'description', e.target.value)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                  placeholder="e.g. Power Supply Unit 500W"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={part.quantity}
                                  onChange={(e) => updatePart(part.id, 'quantity', parseInt(e.target.value) || 1)}
                                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                                />
                              </div>
                              <div className="md:col-span-4 space-y-1">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                  <LinkIcon className="w-3 h-3" />
                                  Purchase Link
                                </label>
                                <div className="relative">
                                  <input
                                    value={part.link}
                                    onChange={(e) => updatePart(part.id, 'link', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm pr-10"
                                    placeholder="https://..."
                                  />
                                </div>
                              </div>
                            </div>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => setPartToDelete(part.id)}
                                className="absolute -top-2 -right-2 p-1.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-100 shadow-sm"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Cost Estimate Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <Info className="w-5 h-5 text-slate-600" />
                      Cost Estimate
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                        <input name="currency" value={formData.currency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="USD, EUR, etc." />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Part Cost</label>
                        <input type="number" name="partCost" value={isNaN(formData.partCost || 0) ? '' : formData.partCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Shipping Cost</label>
                        <input type="number" name="shippingCost" value={isNaN(formData.shippingCost || 0) ? '' : formData.shippingCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Labor Cost</label>
                        <input type="number" name="laborCost" value={isNaN(formData.laborCost || 0) ? '' : formData.laborCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div className="md:col-span-2 p-4 bg-emerald-600/10 backdrop-blur-sm rounded-xl border border-emerald-600/20 flex justify-between items-center shadow-sm">
                        <span className="text-sm font-black text-emerald-900 uppercase tracking-widest">Total Estimated Cost</span>
                        <span className="text-2xl font-black text-emerald-900 drop-shadow-sm">{formData.currency} {formData.totalCost?.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Business Impact Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-600" />
                      Business Impact
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Machine Priority</label>
                        <select name="priority" value={formData.priority} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Urgency Level</label>
                        <select name="urgency" value={formData.urgency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                          <option value="Urgent">Urgent</option>
                          <option value="Normal">Normal</option>
                          <option value="Can Be Delayed">Can Be Delayed</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Estimated Daily Revenue Loss</label>
                        <input type="number" name="revenueLoss" value={formData.revenueLoss} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'final' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <h3 className="text-lg font-black text-slate-900 border-b border-slate-200 pb-2 uppercase tracking-tight">Final Recommendation & Approval</h3>
                  
                  {pendingLogs.length > 0 ? (
                    <div className="space-y-4">
                      <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Pending Review
                      </h4>
                      {pendingLogs.map((log) => {
                        const isApproved = log.approvalStatus === 'Approved';
                        const isRejected = log.approvalStatus === 'Rejected';
                        const isProcessed = isApproved || isRejected;
                        return (
                          <div 
                            key={log.id} 
                            className={`p-4 border rounded-2xl space-y-4 transition-all ${
                              isProcessed 
                                ? 'bg-slate-50 border-slate-200 opacity-60 grayscale' 
                                : 'bg-amber-50/50 border-amber-100'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-bold text-slate-900">{log.problem}</p>
                                  {isApproved && (
                                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">
                                      Approved
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest shadow-lg shadow-rose-200 animate-pulse">
                                      Rejected
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 uppercase font-bold mt-1">
                                  Prepared By: {log.preparedBy} • {log.inspectionDate}
                                </p>
                              </div>
                              {canApprove && !isProcessed && (
                                <div className="space-y-2 min-w-[200px]">
                                  <textarea
                                    value={approvalComments[log.id!] || ''}
                                    onChange={(e) => setApprovalComments(prev => ({ ...prev, [log.id!]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    placeholder="Add comments..."
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => log.id && handleApprove(log.id, 'Approved')}
                                      className="flex-1 px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => log.id && handleApprove(log.id, 'Rejected')}
                                      className="flex-1 px-4 py-2 bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              )}
                              {isProcessed && (
                                <div className="text-right">
                                  <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                                    {isApproved ? 'Approved By' : 'Rejected By'}
                                  </p>
                                  <p className="text-xs font-bold text-slate-700">{log.approvedBy}</p>
                                  {log.approvalComment && (
                                    <p className="text-[10px] text-slate-500 italic mt-1 max-w-[200px]">"{log.approvalComment}"</p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-200/50">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Result</span>
                                <span className="text-xs font-bold text-slate-700">{log.result}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Action</span>
                                <span className="text-xs font-bold text-slate-700">{log.recommendedAction}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Cost</span>
                                <span className="text-xs font-bold text-emerald-700">{log.currency} {log.totalCost?.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase font-black block">Priority</span>
                                <span className="text-xs font-bold text-rose-600">{log.priority}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                      <p className="text-sm text-slate-500 font-medium italic">No maintenance tickets found.</p>
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            {activeTab === 'history' && machine?.id && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                    <History className="w-5 h-5 text-emerald-600" />
                    Machine History
                  </h3>
                  {(isAdmin || isManager) && (
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={loading || isDeleting}
                      className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-50 transition-all flex items-center gap-2 border border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isDeleting ? 'Removing...' : 'Remove Machine'}
                    </button>
                  )}
                </div>
                
                {machine.isDeleted && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-rose-100 rounded-full">
                      <Trash2 className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-rose-900 uppercase tracking-tight">Machine Removed</h4>
                      <p className="text-xs text-rose-700 font-bold">
                        This machine was marked as REMOVED by {machine.deletedBy || 'Admin'}
                      </p>
                    </div>
                  </div>
                )}

                <HistoryList machineId={machine.id} isAdmin={isAdmin || isManager} user={user} />
              </div>
            )}
          </form>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm flex justify-between items-center shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === activeTab);
                if (currentIndex > 0) setActiveTab(sections[currentIndex - 1].id as any);
              }}
              disabled={activeTab === sections[0].id}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-200/80 backdrop-blur-sm rounded-lg disabled:opacity-50 transition-all"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === activeTab);
                if (currentIndex < sections.length - 1) setActiveTab(sections[currentIndex + 1].id as any);
              }}
              disabled={activeTab === sections[sections.length - 1].id}
              className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-200/80 backdrop-blur-sm rounded-lg disabled:opacity-50 transition-all"
            >
              Next
            </button>
          </div>
          {canEdit && (
            <button
              type="submit"
              form="machine-maintenance-form"
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600/90 hover:bg-emerald-700 text-white px-4 sm:px-6 py-2 rounded-lg text-xs sm:text-sm font-black uppercase tracking-widest shadow-lg shadow-emerald-200/50 backdrop-blur-sm transition-all disabled:opacity-50"
            >
              {loading ? 'Saving...' : (
                activeTab === 'technician' || !machine?.id ? (
                  <><Save className="w-4 h-4" /> Save Report</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Changes</>
                )
              )}
            </button>
          )}
          {activeTab === 'history' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 sm:px-6 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs sm:text-sm font-black uppercase tracking-widest hover:bg-slate-300 transition-all"
            >
              Close
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
