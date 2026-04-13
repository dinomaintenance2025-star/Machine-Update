import React, { useState } from 'react';
import { Machine, MaintenanceLog, MachineStatus, MaintenanceResult, RecommendedAction, Priority, Urgency, MachineCategory } from '../types';
import { X, Save, Plus, Trash2, ChevronRight, ChevronDown, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import HistoryList from './HistoryList';

interface MachineFormProps {
  machine?: Machine;
  onClose: () => void;
  onSave: () => void;
}

export default function MachineForm({ machine, onClose, onSave }: MachineFormProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'status' | 'diagnosis' | 'actions' | 'parts' | 'cost' | 'impact' | 'final' | 'history'>('info');
  
  const [formData, setFormData] = useState<Partial<MaintenanceLog & Machine>>({
    name: machine?.name || '',
    model: machine?.model || '',
    category: machine?.category || 'VIDEO GAMES',
    serialNumber: machine?.serialNumber || '',
    location: machine?.location || '',
    status: machine?.status || 'Working',
    inspectionDate: new Date().toISOString().split('T')[0],
    preparedBy: '',
    problem: '',
    result: 'Fixed',
    recommendedAction: 'Repair',
    priority: 'Medium',
    urgency: 'Normal',
    currency: 'AED',
    partCost: 0,
    shippingCost: 0,
    laborCost: 0,
    totalCost: 0,
    revenueLoss: 0,
    technicianName: '',
    managerName: '',
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'number' ? parseFloat(value) : value };
      
      // Auto-calculate total cost
      if (['partCost', 'shippingCost', 'laborCost'].includes(name)) {
        const pc = name === 'partCost' ? parseFloat(value) : (prev.partCost || 0);
        const sc = name === 'shippingCost' ? parseFloat(value) : (prev.shippingCost || 0);
        const lc = name === 'laborCost' ? parseFloat(value) : (prev.laborCost || 0);
        newData.totalCost = pc + sc + lc;
      }
      
      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let machineId = machine?.id;

      const machineData = {
        name: formData.name,
        model: formData.model,
        category: formData.category,
        serialNumber: formData.serialNumber,
        location: formData.location,
        status: formData.status,
        lastResult: formData.result,
        lastInspectionDate: formData.inspectionDate,
        updatedAt: serverTimestamp(),
      };

      if (machineId) {
        await updateDoc(doc(db, 'machines', machineId), machineData);
      } else {
        const docRef = await addDoc(collection(db, 'machines'), {
          ...machineData,
          createdAt: serverTimestamp(),
        });
        machineId = docRef.id;
      }

      // Add log
      await addDoc(collection(db, `machines/${machineId}/logs`), {
        ...formData,
        machineId,
        userEmail: auth.currentUser?.email || 'Unknown',
        createdAt: serverTimestamp(),
      });

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving machine:", error);
      alert("Failed to save. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const sections = [
    { id: 'info', label: 'Machine Info' },
    { id: 'status', label: 'Current Status' },
    { id: 'diagnosis', label: 'Diagnosis' },
    { id: 'actions', label: 'Actions Taken' },
    { id: 'parts', label: 'Required Action' },
    { id: 'cost', label: 'Cost Estimate' },
    { id: 'impact', label: 'Business Impact' },
    { id: 'final', label: 'Final Approval' },
    ...(machine?.id ? [{ id: 'history', label: 'Change History' }] : []),
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {machine ? `Maintenance: ${machine.name}` : 'Add New Machine'}
            </h2>
            <p className="text-xs text-slate-500">Complete all sections for a full maintenance report</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <div className="w-48 border-r border-slate-100 bg-slate-50/50 p-2 hidden md:block">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id as any)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 flex items-center justify-between ${
                  activeTab === s.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.label}
                {activeTab === s.id && <ChevronRight className="w-4 h-4" />}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8">
            {activeTab === 'info' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Machine Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Machine Name</label>
                    <input required name="name" value={formData.name} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Pac-Man Cabinet" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Game / Model</label>
                    <input name="model" value={formData.model} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Namco Classic" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
                    <select name="category" value={formData.category} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="BIG RIDES/ATTRACTIONS">BIG RIDES/ATTRACTIONS</option>
                      <option value="REDEMPTION">REDEMPTION</option>
                      <option value="KIDDIE RIDES">KIDDIE RIDES</option>
                      <option value="VIDEO GAMES">VIDEO GAMES</option>
                      <option value="SKILL GAMES">SKILL GAMES</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Serial Number</label>
                    <input name="serialNumber" value={formData.serialNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. SN-99281" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Location / Branch</label>
                    <input name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. North Wing Arcade" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Date of Inspection</label>
                    <input type="date" name="inspectionDate" value={formData.inspectionDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Prepared By</label>
                    <input name="preparedBy" value={formData.preparedBy} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Your Name" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'status' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Current Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Status</label>
                    <select name="status" value={formData.status} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Working">Working</option>
                      <option value="Partially Working">Partially Working</option>
                      <option value="Not Working">Not Working</option>
                      <option value="Intermittent Fault">Intermittent Fault</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Date of Failure</label>
                    <input type="date" name="failureDate" value={formData.failureDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Downtime Duration</label>
                    <input name="downtimeDuration" value={formData.downtimeDuration} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. 2 days, 4 hours" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'diagnosis' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Fault Description & Diagnosis</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Observed Problem</label>
                    <textarea name="problem" value={formData.problem} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="Describe what is happening..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Error Message / Code</label>
                      <input name="errorCode" value={formData.errorCode} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Error 404" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Affected Part / System</label>
                      <input name="affectedSystem" value={formData.affectedSystem} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Power Supply" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Root Cause</label>
                    <textarea name="rootCause" value={formData.rootCause} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="What caused the failure?" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Technical Findings</label>
                    <textarea name="technicalFindings" value={formData.technicalFindings} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="Detailed technical notes..." />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Actions Already Taken</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Tests Performed</label>
                    <textarea name="testsPerformed" value={formData.testsPerformed} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="What tests did you run?" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Repairs Attempted</label>
                    <textarea name="repairsAttempted" value={formData.repairsAttempted} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="What did you try to fix?" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Result</label>
                    <select name="result" value={formData.result} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Fixed">Fixed</option>
                      <option value="Partially Improved">Partially Improved</option>
                      <option value="Not Fixed">Not Fixed</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'parts' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Required Action & Parts</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Recommended Action</label>
                    <select name="recommendedAction" value={formData.recommendedAction} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Repair">Repair</option>
                      <option value="Replace Part">Replace Part</option>
                      <option value="Replace Board">Replace Board</option>
                      <option value="Reinstall Software / Re-image">Reinstall Software / Re-image</option>
                      <option value="Further Inspection Required">Further Inspection Required</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Required Part / Item</label>
                    <input name="requiredPart" value={formData.requiredPart} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Part name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Part Number / Model</label>
                    <input name="partNumber" value={formData.partNumber} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="PN-12345" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Suggested Supplier</label>
                    <input name="supplier" value={formData.supplier} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Supplier name" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Estimated Lead Time</label>
                    <input name="leadTime" value={formData.leadTime} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. 3-5 business days" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cost' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Cost Estimate</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Currency</label>
                    <input name="currency" value={formData.currency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="USD, EUR, etc." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Part Cost</label>
                    <input type="number" name="partCost" value={formData.partCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Shipping Cost</label>
                    <input type="number" name="shippingCost" value={formData.shippingCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Labor Cost</label>
                    <input type="number" name="laborCost" value={formData.laborCost} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div className="md:col-span-2 p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                    <span className="text-sm font-bold text-blue-800 uppercase">Total Estimated Cost</span>
                    <span className="text-2xl font-black text-blue-900">{formData.currency} {formData.totalCost?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'impact' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Business Impact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Machine Priority</label>
                    <select name="priority" value={formData.priority} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Urgency Level</label>
                    <select name="urgency" value={formData.urgency} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                      <option value="Urgent">Urgent</option>
                      <option value="Normal">Normal</option>
                      <option value="Can Be Delayed">Can Be Delayed</option>
                    </select>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Estimated Daily Revenue Loss</label>
                    <input type="number" name="revenueLoss" value={formData.revenueLoss} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'final' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2">Final Recommendation & Approval</h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Final Recommendation</label>
                    <textarea name="finalRecommendation" value={formData.finalRecommendation} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20" placeholder="Summary of findings and next steps..." />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Expected Return to Operation</label>
                      <input type="date" name="returnToOperationDate" value={formData.returnToOperationDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Technician Name</label>
                      <input name="technicianName" value={formData.technicianName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full Name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Manager Name</label>
                      <input name="managerName" value={formData.managerName} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Full Name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Approval Date</label>
                      <input type="date" name="approvalDate" value={formData.approvalDate} onChange={handleChange} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'history' && machine?.id && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                <h3 className="text-lg font-semibold text-slate-800 border-b pb-2 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Maintenance History
                </h3>
                <HistoryList machineId={machine.id} />
              </div>
            )}
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === activeTab);
                if (currentIndex > 0) setActiveTab(sections[currentIndex - 1].id as any);
              }}
              disabled={activeTab === sections[0].id}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => {
                const currentIndex = sections.findIndex(s => s.id === activeTab);
                if (currentIndex < sections.length - 1) setActiveTab(sections[currentIndex + 1].id as any);
              }}
              disabled={activeTab === sections[sections.length - 1].id}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Report</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
