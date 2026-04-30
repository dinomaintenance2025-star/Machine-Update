import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where } from 'firebase/firestore';
import { PortalActivity } from '../types';
import { Search, Clock, User, Activity, Settings, ShoppingCart, Contact, UserCog, Filter, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface ActivitiesProps {
  user: any;
}

export default function Activities({ user }: ActivitiesProps) {
  const [activities, setActivities] = useState<PortalActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const isTechnician = user?.role === 'technician';
  const isAdmin = user?.role === 'admin' || user?.email === 'dino.maintenance2025@gmail.com';
  const isManager = user?.role === 'manager';

  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    let q;
    
    if (isTechnician) {
      // Technicians only see machines and orders
      q = query(
        collection(db, 'activities'),
        where('entityType', 'in', ['machine', 'order']),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    } else {
      // Admins/Managers see everything
      q = query(
        collection(db, 'activities'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activitiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PortalActivity[];
      setActivities(activitiesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getEntityIcon = (type?: string) => {
    switch (type) {
      case 'machine': return <Settings className="w-4 h-4" />;
      case 'log': return <Activity className="w-4 h-4" />;
      case 'order': return <ShoppingCart className="w-4 h-4" />;
      case 'contact': return <Contact className="w-4 h-4" />;
      case 'user': return <UserCog className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('created') || a.includes('added')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (a.includes('updated') || a.includes('edited')) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (a.includes('deleted') || a.includes('removed')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (a.includes('approved')) return 'text-amber-600 bg-amber-50 border-amber-100';
    if (a.includes('rejected')) return 'text-rose-600 bg-rose-50 border-rose-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  const filteredActivities = activities.filter(a => {
    // Basic search filtering
    const matchesSearch = 
      a.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.userName.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Explicit type filter
    const matchesType = typeFilter === 'ALL' || a.entityType === typeFilter;
    
    // Role-based visibility restriction
    const isVisibleToUser = !isTechnician || (a.entityType === 'machine' || a.entityType === 'order');
    
    return matchesSearch && matchesType && isVisibleToUser;
  });

  const availableFilters = isTechnician 
    ? ['ALL', 'machine', 'order']
    : ['ALL', 'machine', 'log', 'order', 'contact', 'user'];

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp instanceof Timestamp ? timestamp.toDate() : new Date(timestamp);
    return format(date, 'MMM d, h:mm a');
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 rounded-2xl">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              Portal Activity
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {isTechnician 
                ? "Live audit trail of machines and orders" 
                : "Live audit trail of all actions performed in the system"
              }
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search activities, users, details..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all text-sm font-bold"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          {availableFilters.map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border whitespace-nowrap ${
                typeFilter === type
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">When</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Action</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode='popLayout'>
                {filteredActivities.map((activity) => (
                  <motion.tr
                    key={activity.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    layout
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                        <Clock className="w-3 h-3 opacity-50" />
                        {formatDate(activity.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-600 border border-slate-200 group-hover:bg-white transition-colors">
                          {activity.userName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{activity.userName}</p>
                          <p className="text-[9px] font-bold text-slate-400">{activity.userEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm ${getActionColor(activity.action)}`}>
                        {getEntityIcon(activity.entityType)}
                        {activity.action}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs font-bold text-slate-600 line-clamp-1 leading-relaxed">
                        {activity.details}
                      </p>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {!loading && filteredActivities.length === 0 && (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 border-dashed">
              <Activity className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No Activities Found</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
