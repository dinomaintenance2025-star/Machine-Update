import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { MaintenanceLog } from '../types';
import { format } from 'date-fns';
import { Clock, User, AlertCircle, CheckCircle2, XCircle, HelpCircle, ChevronDown, ChevronUp, Trash2, Wrench, Settings, Info, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';

interface HistoryListProps {
  machineId: string;
  isAdmin?: boolean;
  user?: any;
}

const statusConfig = {
  'Working': { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle2 },
  'Partially Working': { color: 'text-orange-500', bg: 'bg-orange-50', icon: Clock },
  'Not Working': { color: 'text-rose-500', bg: 'bg-rose-50', icon: AlertCircle },
  'Intermittent Fault': { color: 'text-yellow-500', bg: 'bg-yellow-50', icon: HelpCircle },
};

export default function HistoryList({ machineId, isAdmin, user }: HistoryListProps) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logToDelete, setLogToDelete] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, `machines/${machineId}/logs`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MaintenanceLog[];
      setLogs(logData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [machineId]);

  const handleDeleteLog = async (logId: string) => {
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, `machines/${machineId}/logs`, logId), {
        isDeleted: true,
        deletedBy: user?.displayName || user?.email || (isAdmin ? 'Administrator' : 'User'),
        deletedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error removing log:", error);
      alert("Failed to remove log.");
    } finally {
      setIsDeleting(false);
      setLogToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 italic">
        No maintenance history found for this machine.
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <AnimatePresence>
        {isDeleting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-xs w-full text-center"
            >
              <div className="w-12 h-12 border-4 border-rose-600/20 border-t-rose-600 rounded-full animate-spin" />
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Deleting Log</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Removing entry...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        onConfirm={() => logToDelete && handleDeleteLog(logToDelete)}
        title="Remove Log Entry"
        message="Are you sure you want to mark this maintenance log as REMOVED? This will hide its details but keep it in the history for auditing."
        confirmText="Remove Log"
      />

      {logs.map((log) => {
        const config = statusConfig[log.status as keyof typeof statusConfig] || statusConfig['Working'];
        const StatusIcon = config.icon;
        const isExpanded = expandedLog === log.id;

        return (
          <div 
            key={log.id} 
            className={`border border-slate-100 rounded-xl overflow-hidden bg-white/70 backdrop-blur-sm shadow-sm transition-opacity ${log.isDeleted ? 'opacity-60 grayscale-[0.5]' : ''}`}
          >
            <div 
              className={`p-3 sm:p-4 flex items-center justify-between transition-colors ${log.isDeleted ? 'bg-slate-50/50 cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
              onClick={() => !log.isDeleted && setExpandedLog(isExpanded ? null : (log.id || null))}
            >
              <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                <div className={`p-2 rounded-lg shrink-0 ${log.isDeleted ? 'bg-slate-100 text-slate-400' : config.bg + ' ' + config.color}`}>
                  {log.isDeleted ? <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <StatusIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
                </div>
                <div className="overflow-hidden">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={`font-bold text-sm sm:text-base ${log.isDeleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {log.isDeleted ? 'REMOVED' : log.status}
                    </span>
                    <span className="text-[10px] text-slate-400 hidden sm:inline">•</span>
                    <span className="text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                      {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'MMM d, yyyy HH:mm') : 'Recently added'}
                    </span>
                    {!log.isDeleted && log.approvalStatus === 'Pending' && (
                      <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ml-2">
                        <Clock className="w-3 h-3" />
                        Waiting for Approval
                      </span>
                    )}
                    {!log.isDeleted && log.approvalStatus === 'Approved' && (
                      <span className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ml-2">
                        <CheckCircle2 className="w-3 h-3" />
                        Approved
                      </span>
                    )}
                    {!log.isDeleted && log.approvalStatus === 'Rejected' && (
                      <span className="flex items-center gap-1 bg-rose-100 text-rose-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ml-2 animate-pulse">
                        <XCircle className="w-3 h-3" />
                        Rejected
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {log.isDeleted ? (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-3 h-3 text-rose-500" />
                        <span className="text-xs font-black text-rose-600 uppercase tracking-widest">
                          Removed by {log.deletedBy || 'Admin'}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">Prepared By: {log.preparedBy || 'Unknown'}</span>
                        </div>
                        {log.approvalStatus === 'Approved' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              <span className="text-xs text-emerald-600 font-medium">Approved By: {log.approvedBy || 'Admin'}</span>
                            </div>
                            {log.approvalComment && (
                              <div className="pl-5">
                                <p className="text-[10px] text-slate-500 italic border-l-2 border-slate-200 pl-2">
                                  "{log.approvalComment}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        {log.approvalStatus === 'Rejected' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              <span className="text-xs text-rose-600 font-medium">Rejected By: {log.approvedBy || 'Admin'}</span>
                            </div>
                            {log.approvalComment && (
                              <div className="pl-5">
                                <p className="text-[10px] text-slate-500 italic border-l-2 border-slate-200 pl-2">
                                  "{log.approvalComment}"
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account:</span>
                          <span className="text-xs text-slate-400 italic">{log.userEmail || 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!log.isDeleted && (
                  isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
                {isAdmin && !log.isDeleted && (
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogToDelete(log.id!);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all ml-2"
                    title="Remove Log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {!log.isDeleted && isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/30 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {/* Diagnosis Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-black uppercase tracking-widest text-[10px]">
                      <AlertCircle className="w-3 h-3" />
                      Diagnosis
                    </div>
                    <div className="space-y-3 pl-5 border-l-2 border-emerald-100">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observed Problem</h4>
                        <p className="text-slate-700 leading-relaxed">{log.problem || 'No description provided'}</p>
                      </div>
                      {log.errorCode && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Error Code</h4>
                          <code className="bg-slate-100 px-2 py-0.5 rounded text-rose-600 font-mono text-xs">{log.errorCode}</code>
                        </div>
                      )}
                      {log.affectedSystem && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Affected System</h4>
                          <p className="text-slate-700">{log.affectedSystem}</p>
                        </div>
                      )}
                      {log.rootCause && (
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Root Cause</h4>
                          <p className="text-slate-700 italic">{log.rootCause}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-blue-700 font-black uppercase tracking-widest text-[10px]">
                      <Settings className="w-3 h-3" />
                      Actions & Results
                    </div>
                    <div className="space-y-3 pl-5 border-l-2 border-blue-100">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tests Performed</h4>
                        <p className="text-slate-700">{log.testsPerformed || 'N/A'}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Repairs Attempted</h4>
                        <p className="text-slate-700">{log.repairsAttempted || 'N/A'}</p>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Result</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${
                            log.result === 'Fixed' ? 'bg-emerald-100 text-emerald-700' : 
                            log.result === 'Partially Improved' ? 'bg-orange-100 text-orange-700' : 
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {log.result}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Recommendation</h4>
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-widest">
                            {log.recommendedAction}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Details & Impact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm pt-4 border-t border-slate-100">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-700 font-black uppercase tracking-widest text-[10px]">
                      <Info className="w-3 h-3" />
                      Technical Notes
                    </div>
                    <div className="space-y-3 pl-5 border-l-2 border-slate-200">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technical Findings</h4>
                        <p className="text-slate-700 text-xs">{log.technicalFindings || 'No additional findings'}</p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Final Recommendation</h4>
                        <p className="text-slate-700 text-xs font-medium">{log.finalRecommendation}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-amber-700 font-black uppercase tracking-widest text-[10px]">
                      <Zap className="w-3 h-3" />
                      Impact & Priority
                    </div>
                    <div className="grid grid-cols-2 gap-4 pl-5 border-l-2 border-amber-100">
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Priority</h4>
                        <span className={`text-xs font-bold ${
                          log.priority === 'High' ? 'text-rose-600' : 
                          log.priority === 'Medium' ? 'text-orange-600' : 'text-emerald-600'
                        }`}>{log.priority}</span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Urgency</h4>
                        <span className="text-xs font-bold text-slate-700">{log.urgency}</span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Downtime</h4>
                        <span className="text-xs text-slate-700">{log.downtimeDuration || 'N/A'}</span>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Revenue Loss</h4>
                        <span className="text-xs text-rose-600 font-bold">{log.currency} {log.revenueLoss?.toFixed(2)} / day</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Financial Summary */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap justify-between items-end gap-4">
                  <div className="flex gap-6">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Part Cost</span>
                      <span className="text-xs font-medium text-slate-600">{log.currency} {log.partCost?.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Labor Cost</span>
                      <span className="text-xs font-medium text-slate-600">{log.currency} {log.laborCost?.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="text-right bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block">Total Report Cost</span>
                    <span className="text-xl font-black text-emerald-900">{log.currency} {log.totalCost?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
