import React from 'react';
import { Machine } from '../types';
import { Settings, MapPin, Calendar, AlertCircle, CheckCircle2, Clock, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';

interface MachineCardProps {
  machine: Machine;
  onClick: () => void;
}

const statusConfig = {
  'Working': { color: 'text-emerald-500', bg: 'bg-emerald-50', icon: CheckCircle2 },
  'Partially Working': { color: 'text-amber-500', bg: 'bg-amber-50', icon: Clock },
  'Not Working': { color: 'text-rose-500', bg: 'bg-rose-50', icon: AlertCircle },
  'Intermittent Fault': { color: 'text-indigo-500', bg: 'bg-indigo-50', icon: HelpCircle },
};

const MachineCard: React.FC<MachineCardProps> = ({ machine, onClick }) => {
  const config = statusConfig[machine.status as keyof typeof statusConfig] || statusConfig['Working'];
  const StatusIcon = config.icon;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
          <Settings className="w-6 h-6 text-slate-600" />
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
          <StatusIcon className="w-3.5 h-3.5" />
          {machine.status}
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-900 mb-1">{machine.name}</h3>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
          {machine.category}
        </span>
        <span className="text-sm text-slate-500">{machine.model}</span>
      </div>

      {machine.lastResult && (
        <div className="mb-4">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
            machine.lastResult === 'Fixed' ? 'bg-emerald-100 text-emerald-700' : 
            machine.lastResult === 'Partially Improved' ? 'bg-amber-100 text-amber-700' : 
            'bg-rose-100 text-rose-700'
          }`}>
            Last Result: {machine.lastResult}
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400" />
          {machine.location}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-4 h-4 text-slate-400" />
          Last Inspection: {machine.lastInspectionDate ? format(new Date(machine.lastInspectionDate), 'MMM d, yyyy') : 'Never'}
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">SN: {machine.serialNumber}</span>
        <span className="text-xs font-medium text-blue-600 group-hover:underline">View Details →</span>
      </div>
    </motion.div>
  );
};

export default MachineCard;
