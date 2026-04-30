import React from 'react';
import { Machine } from '../types';
import { categoryConfig, statusConfig } from '../constants';
import { Settings, MapPin, Calendar, AlertCircle, CheckCircle2, Clock, HelpCircle, BookOpen, ChevronRight, Image as ImageIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface MachineCardProps {
  machine: Machine;
  onClick: () => void;
  onShowImage?: (machine: Machine) => void;
  isAdmin?: boolean;
  hasPendingApproval?: boolean;
}

const StatusIcons = {
  'Working': CheckCircle2,
  'Partially Working': Clock,
  'Not Working': AlertCircle,
  'Intermittent Fault': HelpCircle,
};

const MachineCard: React.FC<MachineCardProps> = ({ machine, onClick, onShowImage, isAdmin, hasPendingApproval }) => {
  const config = statusConfig[machine.status as keyof typeof statusConfig] || statusConfig['Working'];
  const catKey = (machine.category as string) === 'BIG RIDES/ATTRACTIONS' ? 'ATTRACTIONS' : machine.category;
  const catConfig = categoryConfig[catKey as keyof typeof categoryConfig] || { bg: 'bg-slate-100/80', text: 'text-slate-700', border: 'border-slate-200' };
  const StatusIcon = StatusIcons[machine.status as keyof typeof StatusIcons] || CheckCircle2;

  return (
    <motion.div
      whileHover={{ y: -4, shadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`bg-white/90 backdrop-blur-sm rounded-[2rem] border p-6 shadow-sm transition-all cursor-pointer group relative overflow-hidden ${
        hasPendingApproval ? 'border-amber-400 ring-4 ring-amber-100' : 'border-slate-200 hover:border-emerald-200'
      }`}
    >
      {/* Decorative background element */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110 ${
        hasPendingApproval ? 'bg-amber-50' : 'bg-slate-50'
      }`} />

      {hasPendingApproval && (
        <div className="absolute top-4 right-4 bg-amber-500 text-white text-[8px] font-black px-3 py-1.5 rounded-full shadow-lg z-10 animate-bounce uppercase tracking-widest flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Pending Approval
        </div>
      )}

      <div className="relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div className="p-3 bg-slate-100 rounded-2xl group-hover:bg-emerald-100 transition-colors">
            <Settings className="w-6 h-6 text-slate-600 group-hover:text-emerald-600" />
          </div>
          {!hasPendingApproval && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm border ${config.bg} ${config.color} border-current/20 backdrop-blur-sm`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {machine.status}
            </div>
          )}
        </div>

        <div className="space-y-1 mb-4">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">{machine.name}</h3>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest shadow-sm ${catConfig.bg} ${catConfig.text} ${catConfig.border}`}>
                {machine.category}
              </span>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-tight">{machine.model}</span>
            </div>
            
            {machine.imageUrl && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowImage?.(machine);
                }}
                className="flex items-center gap-2 w-fit px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 hover:border-emerald-200 mt-1 shadow-sm"
              >
                <ImageIcon className="w-4 h-4" />
                View Machine Image
              </button>
            )}
          </div>
        </div>

        {machine.lastResult && (
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                machine.lastResult === 'Fixed' ? 'bg-emerald-500' : 
                machine.lastResult === 'Partially Improved' ? 'bg-orange-500' : 
                'bg-rose-500'
              }`} />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Last Result: <span className={
                  machine.lastResult === 'Fixed' ? 'text-emerald-600' : 
                  machine.lastResult === 'Partially Improved' ? 'text-orange-600' : 
                  'text-rose-600'
                }>{machine.lastResult}</span>
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold truncate">
              <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              {machine.location}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Last Inspection</p>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold truncate">
              <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              {machine.lastInspectionDate ? format(new Date(machine.lastInspectionDate), 'MMM d') : 'Never'}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[9px] uppercase tracking-widest font-black text-slate-400 bg-slate-50 px-2 py-1 rounded">SN: {machine.serialNumber?.slice(-6)}</span>
            {machine.resources && machine.resources.length > 0 && (
              <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded uppercase tracking-widest">
                <BookOpen className="w-3 h-3" />
                {machine.resources.length}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
            {isAdmin ? 'Manage' : 'View'}
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default MachineCard;
