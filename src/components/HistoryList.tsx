import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { MaintenanceLog } from '../types';
import { format } from 'date-fns';
import { Clock, User, AlertCircle, CheckCircle2, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface HistoryListProps {
  machineId: string;
}

const statusConfig = {
  'Working': { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle2 },
  'Partially Working': { color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock },
  'Not Working': { color: 'text-rose-500', bg: 'bg-rose-50', icon: AlertCircle },
  'Intermittent Fault': { color: 'text-indigo-500', bg: 'bg-indigo-50', icon: HelpCircle },
};

export default function HistoryList({ machineId }: HistoryListProps) {
  const [logs, setLogs] = useState<MaintenanceLog[]>([]);
  const [loading, setLoading] = useState(true);
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

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
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
    <div className="space-y-4">
      {logs.map((log) => {
        const config = statusConfig[log.status as keyof typeof statusConfig] || statusConfig['Working'];
        const StatusIcon = config.icon;
        const isExpanded = expandedLog === log.id;

        return (
          <div 
            key={log.id} 
            className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm"
          >
            <div 
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => setExpandedLog(isExpanded ? null : (log.id || null))}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg ${config.bg} ${config.color}`}>
                  <StatusIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{log.status}</span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {log.createdAt?.toDate ? format(log.createdAt.toDate(), 'MMM d, yyyy HH:mm') : 'Recently added'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-slate-400" />
                      <span className="text-xs text-slate-500">Prepared By: {log.preparedBy || 'Unknown'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Account:</span>
                      <span className="text-xs text-slate-400 italic">{log.userEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </div>

            {isExpanded && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Observed Problem</h4>
                      <p className="text-slate-700">{log.problem || 'No description provided'}</p>
                    </div>
                    {log.rootCause && (
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Root Cause</h4>
                        <p className="text-slate-700">{log.rootCause}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Action Taken</h4>
                      <p className="text-slate-700">{log.recommendedAction}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Repair Result</h4>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.result === 'Fixed' ? 'bg-emerald-100 text-emerald-700' : 
                        log.result === 'Partially Improved' ? 'bg-amber-100 text-amber-700' : 
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {log.result}
                      </span>
                    </div>
                  </div>
                </div>
                
                {(log.partCost > 0 || log.laborCost > 0) && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cost</span>
                      <span className="font-bold text-slate-900">{log.currency} {log.totalCost?.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
