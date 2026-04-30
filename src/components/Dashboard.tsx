import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, serverTimestamp, collectionGroup, where, limit, updateDoc } from 'firebase/firestore';
import { Machine, MachineCategory, MachineStatus, MaintenanceResult, MaintenanceLog, PurchasingOrder } from '../types';
import { categoryConfig, statusConfig } from '../constants';
import MachineCard from './MachineCard';
import MachineForm from './MachineForm';
import UserManagement from './UserManagement';
import PurchasingOrders from './PurchasingOrders';
import Contacts from './Contacts';
import ConfirmModal from './ConfirmModal';
import Activities from './Activities';
import { Plus, Search, LayoutGrid, List, Filter, LogOut, User, Tag, Activity, CheckCircle, ChevronDown, Trash2, UserCog, ClipboardCheck, Bell, Settings, MapPin, Minimize2, Maximize2, Contact, ShoppingCart, Truck, DollarSign, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

interface DashboardProps {
  user: any;
  onSignOut: () => void;
}

export default function Dashboard({ user, onSignOut }: DashboardProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [pendingLogs, setPendingLogs] = useState<(MaintenanceLog & { machineName?: string })[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PurchasingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MachineCategory | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<MachineStatus | 'ALL'>('ALL');
  const [selectedResult, setSelectedResult] = useState<MaintenanceResult | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | undefined>();
  const [initialTab, setInitialTab] = useState<'history' | 'info' | 'status' | 'technician' | 'final' | 'resources' | undefined>();
  const [activeView, setActiveView] = useState<'fleet' | 'users' | 'approvals' | 'orders' | 'contacts' | 'activities'>('fleet');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isCompact, setIsCompact] = useState(false);
  const [showClearPendingConfirm, setShowClearPendingConfirm] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [recentNotifications, setRecentNotifications] = useState<{id: string, message: string}[]>([]);
  const [notificationIndex, setNotificationIndex] = useState(0);
  const [showImageMachine, setShowImageMachine] = useState<Machine | null>(null);

  const handleShowSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);
  };

  const handleClearPending = async () => {
    try {
      const promises = pendingLogs.map(log => 
        updateDoc(doc(db, 'machines', log.machineId, 'logs', log.id), {
          approvalStatus: 'Rejected',
          approvalComment: 'Bulk cleared by administrator',
          updatedAt: serverTimestamp()
        })
      );
      await Promise.all(promises);
      handleShowSuccess('Pending Approvals Cleared');
    } catch (error) {
      console.error("Error clearing pending logs:", error);
      alert("Failed to clear some pending logs.");
    } finally {
      setShowClearPendingConfirm(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'machines'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const machineData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Machine[];
      setMachines(machineData.filter(m => !m.isDeleted));
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      const q = query(
        collectionGroup(db, 'logs'),
        where('approvalStatus', '==', 'Pending'),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          const machine = machines.find(m => m.id === data.machineId);
          return {
            id: doc.id,
            ...data,
            machineName: machine?.name || 'Unknown Machine'
          };
        }) as (MaintenanceLog & { machineName?: string })[];
        setPendingLogs(logs);
      }, (error) => {
        console.error("Error fetching pending logs:", error);
      });
      
      return () => unsubscribe();
    }
  }, [user?.role, machines]);

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'Pending'),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as PurchasingOrder[];
        setPendingOrders(orders);
      }, (error) => {
        console.error("Error fetching pending orders:", error);
      });
      
      return () => unsubscribe();
    }
  }, [user?.role]);

  useEffect(() => {
    // Listen for recent logs and orders to create notifications
    const logsQuery = query(
      collectionGroup(db, 'logs'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const ordersQuery = query(
      collection(db, 'orders'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    let logsNotifications: any[] = [];
    let ordersNotifications: any[] = [];

    const updateNotifications = () => {
      const combined = [...logsNotifications, ...ordersNotifications]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 5);
      setRecentNotifications(combined);
    };

    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      logsNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        const machine = machines.find(m => m.id === data.machineId);
        const machineName = machine?.name || 'A machine';
        let action = 'has an update';
        
        if (data.approvalStatus === 'Approved') action = 'report approved';
        else if (data.approvalStatus === 'Rejected') action = 'report rejected';
        else if (data.result === 'Fixed') action = 'has been fixed';
        
        return {
          id: doc.id,
          timestamp: data.createdAt?.toMillis() || Date.now(),
          message: `${machineName} ${action}`
        };
      });
      updateNotifications();
    });

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      ordersNotifications = snapshot.docs.map(doc => {
        const data = doc.data();
        let action = 'order placed';
        
        if (data.status === 'Approved') action = 'order approved';
        else if (data.status === 'Rejected') action = 'order rejected';
        else if (data.status === 'Ordered') action = 'order processed';
        else if (data.status === 'Received') action = 'parts received';
        
        return {
          id: doc.id,
          timestamp: data.createdAt?.toMillis() || Date.now(),
          message: `${data.manufacturer} ${action}`
        };
      });
      updateNotifications();
    });

    return () => {
      unsubscribeLogs();
      unsubscribeOrders();
    };
  }, [machines]);

  useEffect(() => {
    if (recentNotifications.length > 1) {
      const interval = setInterval(() => {
        setNotificationIndex(prev => (prev + 1) % recentNotifications.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [recentNotifications]);

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || 
      m.category === selectedCategory || 
      (selectedCategory === 'ATTRACTIONS' && (m.category as string) === 'BIG RIDES/ATTRACTIONS');
    const matchesStatus = selectedStatus === 'ALL' || m.status === selectedStatus;
    const matchesResult = selectedResult === 'ALL' || m.lastResult === selectedResult;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesResult;
  }).sort((a, b) => {
    if (viewMode === 'list') {
      return a.name.localeCompare(b.name);
    }
    return 0; // Keep default Firestore order (updatedAt desc) for grid view
  });

  const categories: (MachineCategory | 'ALL')[] = [
    'ALL',
    'ATTRACTIONS',
    'REDEMPTION',
    'KIDDIE RIDES',
    'VIDEO GAMES',
    'SKILL GAMES',
    'CLAW MACHINE'
  ];

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = cat === 'ALL' 
      ? machines.length 
      : machines.filter(m => 
          m.category === cat || 
          (cat === 'ATTRACTIONS' && (m.category as string) === 'BIG RIDES/ATTRACTIONS')
        ).length;
    return acc;
  }, {} as Record<string, number>);

  const statuses: (MachineStatus | 'ALL')[] = [
    'ALL',
    'Working',
    'Partially Working',
    'Not Working',
    'Intermittent Fault'
  ];

  const results: (MaintenanceResult | 'ALL')[] = [
    'ALL',
    'Fixed',
    'Partially Improved',
    'Not Fixed'
  ];

  const handleSignOut = () => onSignOut();

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const isTechnician = user?.role === 'technician';

  const handleUserCreated = () => {
    setActiveView('fleet');
    handleShowSuccess('User Created Successfully');
  };

  return (
    <div className="min-h-screen bg-transparent flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-emerald-200/50">
              <Plus className="w-5 h-5 text-white rotate-45" />
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tighter uppercase truncate drop-shadow-sm">DWMP</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {recentNotifications.length > 0 && (
              <button 
                onClick={() => {
                  const notif = recentNotifications[notificationIndex];
                  const machine = machines.find(m => m.id === notif.machineId);
                  if (machine) {
                    setSelectedMachine(machine);
                    // Determine best tab based on message
                    if (notif.message.includes('approved') || notif.message.includes('rejected')) {
                      setInitialTab('final');
                    } else {
                      setInitialTab('history');
                    }
                    setShowForm(true);
                  }
                }}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg max-w-[220px] overflow-hidden hover:bg-emerald-100 transition-colors text-left"
              >
                <Bell className="w-3 h-3 text-emerald-600 shrink-0 animate-pulse" />
                <div className="relative h-4 w-full overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={recentNotifications[notificationIndex]?.id || 'none'}
                      initial={{ y: 10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -10, opacity: 0 }}
                      className="text-[10px] font-black text-emerald-700 uppercase tracking-tight truncate absolute inset-0"
                    >
                      {recentNotifications[notificationIndex]?.message}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </button>
            )}

            {(isAdmin || user?.role === 'manager' || user?.role === 'technician') && (
              <div className="flex items-center bg-slate-100/80 backdrop-blur-sm rounded-xl p-1 overflow-x-auto no-scrollbar max-w-[calc(100vw-120px)] sm:max-w-none">
                <button 
                  onClick={() => setActiveView('fleet')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    activeView === 'fleet' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Fleet
                </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setActiveView('users')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        activeView === 'users' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Users
                    </button>
                  )}
                  {(isAdmin || user?.role === 'manager') && (
                    <button 
                      onClick={() => setActiveView('approvals')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${
                        activeView === 'approvals' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Approvals
                      {pendingLogs.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[8px] flex items-center justify-center rounded-full shadow-sm animate-bounce">
                          {pendingLogs.length}
                        </span>
                      )}
                    </button>
                  )}
                  <button 
                    onClick={() => setActiveView('orders')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeView === 'orders' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Orders
                  </button>
                  <button 
                    onClick={() => setActiveView('contacts')}
                    className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeView === 'contacts' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Contacts
                  </button>
                  {(isAdmin || user?.role === 'manager' || user?.role === 'technician') && (
                    <button 
                      onClick={() => setActiveView('activities')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                        activeView === 'activities' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Activities
                    </button>
                  )}
                </div>
              )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100/80 backdrop-blur-sm rounded-full text-xs sm:text-sm font-bold text-slate-700 truncate max-w-[150px] sm:max-w-none border border-slate-200">
              <User className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="truncate">{user?.displayName || user?.email}</span>
            </div>

            <button 
              onClick={handleSignOut}
              className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 backdrop-blur-sm rounded-full transition-all border border-transparent hover:border-rose-200"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full">
        {activeView === 'users' && isAdmin ? (
          <UserManagement user={user} onUserCreated={handleUserCreated} />
        ) : activeView === 'contacts' ? (
          <Contacts user={user} />
        ) : activeView === 'activities' && (isAdmin || user?.role === 'manager' || user?.role === 'technician') ? (
          <Activities user={user} />
        ) : activeView === 'orders' && (isAdmin || isManager || user?.role === 'technician') ? (
          <PurchasingOrders 
            isAdmin={isAdmin} 
            isManager={isManager} 
            isTechnician={user?.role === 'technician'}
            user={user}
            machines={machines} 
          />
        ) : activeView === 'approvals' && (isAdmin || user?.role === 'manager') ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <ConfirmModal
              isOpen={showClearPendingConfirm}
              onClose={() => setShowClearPendingConfirm(false)}
              onConfirm={handleClearPending}
              title="Clear Pending Approvals"
              message="Are you sure you want to clear ALL pending approvals? This will mark them as rejected and remove them from this list."
              confirmText="Clear All"
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-2xl">
                  <ClipboardCheck className="w-8 h-8 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                    Pending Approvals
                  </h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {pendingLogs.length + pendingOrders.length} items waiting for review
                  </p>
                </div>
              </div>
              {(pendingLogs.length > 0 || pendingOrders.length > 0) && (
                <button 
                  onClick={() => setShowClearPendingConfirm(true)}
                  className="flex items-center justify-center gap-2 bg-rose-50 text-rose-600 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-rose-100 transition-all hover:bg-rose-100 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear All Pending
                </button>
              )}
            </div>

            {pendingLogs.length === 0 && pendingOrders.length === 0 ? (
              <div className="py-20 text-center bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">All Caught Up!</h3>
                <p className="text-slate-500 text-sm mt-1">There are no maintenance reports or orders waiting for approval.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pending Maintenance Logs */}
                {pendingLogs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-emerald-200 transition-all group cursor-pointer relative overflow-hidden h-full flex flex-col"
                    onClick={() => {
                      const machine = machines.find(m => m.id === log.machineId);
                      if (machine) {
                        setSelectedMachine(machine);
                        setInitialTab('final');
                        setShowForm(true);
                      }
                    }}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-emerald-100 transition-colors">
                            <Settings className="w-5 h-5 text-slate-600 group-hover:text-emerald-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight group-hover:text-emerald-600 transition-colors">
                                {log.machineName}
                              </h4>
                              <span className="bg-emerald-50 text-emerald-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">Maintenace</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              ID: {log.id?.slice(-8)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Cost</p>
                          <p className="text-lg font-black text-emerald-600">{log.currency} {log.totalCost?.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 rounded-2xl p-4 mb-4 border border-slate-100 flex-grow">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Problem Description</p>
                        <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-relaxed">{log.problem}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-auto">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <User className="w-3 h-3 text-emerald-500" />
                          {log.preparedBy}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <Activity className="w-3 h-3 text-emerald-500" />
                          {log.status}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <Tag className="w-3 h-3 text-emerald-500" />
                          {log.recommendedAction}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Pending Purchasing Orders */}
                {pendingOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all group cursor-pointer relative overflow-hidden h-full flex flex-col"
                    onClick={() => setActiveView('orders')}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                    
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-blue-100 transition-colors">
                            <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                                {order.manufacturer}
                              </h4>
                              <span className="bg-blue-50 text-blue-600 text-[8px] font-black px-2 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">Order</span>
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Part: {order.partNumber}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Amount</p>
                          <p className="text-lg font-black text-blue-600">{order.currency} {order.price?.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 rounded-2xl p-4 mb-4 border border-slate-100 flex-grow">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order Details</p>
                        <p className="text-sm font-bold text-slate-700 line-clamp-2 leading-relaxed">
                          For {order.machineName || 'Unknown Machine'} • {order.notes || 'No notes provided'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-auto">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <User className="w-3 h-3 text-blue-500" />
                          {order.createdBy}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <Truck className="w-3 h-3 text-blue-500" />
                          {order.shippingTime}
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-100 rounded-full text-[9px] font-black text-slate-600 uppercase tracking-widest shadow-sm">
                          <DollarSign className="w-3 h-3 text-blue-500" />
                          {order.currency}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="space-y-6 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input 
                    type="text" 
                    placeholder="Search machines, models..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all text-sm"
                  />
                </div>

                {(isAdmin || isManager) && (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => {
                        setSelectedMachine(undefined);
                        setShowForm(true);
                      }}
                      className="flex items-center justify-center gap-2 bg-emerald-600/90 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200/50 backdrop-blur-sm transition-all w-full sm:w-auto"
                    >
                      <Plus className="w-5 h-5" />
                      Add Machine
                    </button>
                  </div>
                )}

                <div className="flex items-center bg-white/80 backdrop-blur-sm border border-slate-200 rounded-xl p-1 shadow-sm shrink-0">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    title="Grid View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1" />
                  <button
                    onClick={() => setIsCompact(!isCompact)}
                    className={`p-2 rounded-lg transition-all ${isCompact ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                    title={isCompact ? "Standard View" : "Compact View"}
                  >
                    {isCompact ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </button>
                </div>

                <button 
                  onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all w-full sm:w-auto border ${
                showFilters 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                  : 'bg-white/80 backdrop-blur-sm text-slate-700 border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 py-1">
            {categories.map((cat) => {
              const config = categoryConfig[cat as keyof typeof categoryConfig] || { bg: 'bg-slate-100/50', text: 'text-slate-500', border: 'border-slate-200' };
              const isSelected = selectedCategory === cat;
              
              return (
                <motion.button
                  key={cat}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(cat)}
                  className={`flex flex-col items-start p-3 rounded-2xl border transition-all text-left group ${
                    isSelected 
                      ? 'bg-white border-emerald-500 shadow-md ring-1 ring-emerald-500' 
                      : 'bg-white/60 backdrop-blur-sm border-slate-200 hover:border-emerald-200 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5 w-full">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSelected ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-emerald-400'}`} />
                    <span className={`text-[8px] font-black uppercase tracking-widest truncate ${isSelected ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {cat === 'ALL' ? 'Total Fleet' : cat.split('/')[0]}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    <span className={`text-xl font-black leading-none ${isSelected ? 'text-emerald-600' : 'text-slate-900'}`}>
                      {categoryCounts[cat]}
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-0.5">Units</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Category Toggle */}
          <AnimatePresence>
            {showFilters && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-4 pt-2 border-t border-slate-100 mt-2">
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <div className="flex items-center gap-2 mr-2 text-slate-600 shrink-0">
                        <Activity className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Status:</span>
                      </div>
                      {statuses.map((status) => {
                        const isSelected = selectedStatus === status;
                        const statusColors = {
                          'Working': 'bg-emerald-600/90 border-emerald-600',
                          'Partially Working': 'bg-orange-500/90 border-orange-500',
                          'Not Working': 'bg-rose-500/90 border-rose-500',
                          'Intermittent Fault': 'bg-yellow-500/90 border-yellow-500',
                          'ALL': 'bg-slate-900/90 border-slate-900'
                        };
                        return (
                          <button
                            key={status}
                            onClick={() => setSelectedStatus(status)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                              isSelected 
                                ? `${statusColors[status as keyof typeof statusColors]} text-white shadow-sm backdrop-blur-sm` 
                                : 'bg-white/70 backdrop-blur-sm text-slate-500 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      <div className="flex items-center gap-2 mr-2 text-slate-600 shrink-0">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Last Result:</span>
                      </div>
                      {results.map((res) => (
                        <button
                          key={res}
                          onClick={() => setSelectedResult(res)}
                          className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                            selectedResult === res 
                              ? 'bg-emerald-600/90 text-white border-emerald-600 shadow-sm backdrop-blur-sm' 
                              : 'bg-white/70 backdrop-blur-sm text-slate-500 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">Loading your fleet...</p>
          </div>
        ) : filteredMachines.length > 0 ? (
          viewMode === 'grid' ? (
            <motion.div 
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
            >
              <AnimatePresence mode='popLayout'>
                {filteredMachines.map((machine) => (
                  <MachineCard 
                    key={machine.id} 
                    machine={machine} 
                    isAdmin={isAdmin || isManager}
                    hasPendingApproval={pendingLogs.some(log => log.machineId === machine.id)}
                    onShowImage={(m) => setShowImageMachine(m)}
                    onClick={() => {
                      setSelectedMachine(machine);
                      setShowForm(true);
                    }}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="space-y-3 md:space-y-0">
              {/* Mobile List View */}
              <div className="md:hidden space-y-3">
                {filteredMachines.map((machine) => {
                  const hasPending = pendingLogs.some(log => log.machineId === machine.id);
                  return (
                    <motion.div
                      key={machine.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedMachine(machine);
                        setShowForm(true);
                      }}
                      className={`bg-white/90 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all relative ${
                        hasPending ? 'border-amber-400 ring-1 ring-amber-100' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="font-black text-slate-900 uppercase tracking-tight">
                            {machine.name}
                          </div>
                          {hasPending && (
                            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                          )}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest ${
                          statusConfig[machine.status as keyof typeof statusConfig]?.color || 'text-slate-500'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            statusConfig[machine.status as keyof typeof statusConfig]?.bg.replace('bg-', 'bg-').replace('-50', '-500') || 'bg-slate-500'
                          }`} />
                          {machine.status}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 mb-2">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                            categoryConfig[machine.category as keyof typeof categoryConfig]?.bg || 'bg-slate-100'
                          } ${
                            categoryConfig[machine.category as keyof typeof categoryConfig]?.text || 'text-slate-700'
                          } ${
                            categoryConfig[machine.category as keyof typeof categoryConfig]?.border || 'border-slate-200'
                          }`}>
                            <Tag className="w-3 h-3" />
                            {machine.category}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {machine.location}
                          </div>
                        </div>
                        
                        {machine.imageUrl && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowImageMachine(machine);
                            }}
                            className="flex items-center gap-2 w-fit px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 hover:border-emerald-200 mt-1 shadow-sm"
                          >
                            <Maximize2 className="w-4 h-4" />
                            View Image
                          </button>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest italic leading-none flex items-center gap-2">
                          S/N: {machine.serialNumber}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div className={`hidden md:block bg-white/80 backdrop-blur-sm border border-slate-200 overflow-hidden shadow-sm transition-all ${isCompact ? 'rounded-2xl' : 'rounded-3xl'}`}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`${isCompact ? 'bg-slate-50/50' : 'bg-slate-50/80'} border-b border-slate-200`}>
                      <th className={`${isCompact ? 'px-4 py-2 text-[9px]' : 'px-6 py-4 text-[10px]'} font-black text-slate-500 uppercase tracking-widest`}>Machine</th>
                      <th className={`${isCompact ? 'px-4 py-2 text-[9px]' : 'px-6 py-4 text-[10px]'} font-black text-slate-500 uppercase tracking-widest hidden md:table-cell`}>Category</th>
                      <th className={`${isCompact ? 'px-4 py-2 text-[9px]' : 'px-6 py-4 text-[10px]'} font-black text-slate-500 uppercase tracking-widest`}>Status</th>
                      <th className={`${isCompact ? 'px-4 py-2 text-[9px]' : 'px-6 py-4 text-[10px]'} font-black text-slate-500 uppercase tracking-widest hidden lg:table-cell ${isCompact ? 'text-right' : ''}`}>Location</th>
                      {!isCompact && <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMachines.map((machine) => {
                      const hasPending = pendingLogs.some(log => log.machineId === machine.id);
                      return (
                        <tr 
                          key={machine.id} 
                          onClick={() => {
                            setSelectedMachine(machine);
                            setShowForm(true);
                          }}
                          className={`transition-colors cursor-pointer group ${isCompact ? 'hover:bg-emerald-50/30' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className={isCompact ? 'px-4 py-2' : 'px-6 py-4'}>
                            <div className="flex items-center gap-3">
                              {!isCompact && (
                                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                                  <Settings className="w-4 h-4 text-slate-600" />
                                </div>
                              )}
                              <div>
                                <div className={`${isCompact ? 'text-xs' : 'text-sm'} font-bold text-slate-900 flex items-center gap-2`}>
                                  {machine.name}
                                  {hasPending && (
                                    <span className={`${isCompact ? 'w-1.5 h-1.5' : 'w-2 h-2'} bg-amber-500 rounded-full animate-pulse`} title="Pending Approval" />
                                  )}
                                </div>
                                <div className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} text-slate-500 font-black uppercase tracking-widest`}>
                                  S/N: {machine.serialNumber}
                                </div>
                                {machine.imageUrl && (
                                  <div className="mt-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowImageMachine(machine);
                                      }}
                                      className="flex items-center gap-2 w-fit px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100 hover:border-emerald-200 shadow-sm"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                      IMAGE
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`${isCompact ? 'px-4 py-2' : 'px-6 py-4'} hidden md:table-cell`}>
                            <span className={`${isCompact ? 'text-[9px]' : 'text-[10px] font-black'} px-2 py-0.5 rounded border uppercase tracking-widest shadow-sm ${
                              categoryConfig[machine.category as keyof typeof categoryConfig]?.bg || 'bg-slate-100'
                            } ${
                              categoryConfig[machine.category as keyof typeof categoryConfig]?.text || 'text-slate-700'
                            } ${
                              categoryConfig[machine.category as keyof typeof categoryConfig]?.border || 'border-slate-200'
                            }`}>
                              {machine.category}
                            </span>
                          </td>
                          <td className={isCompact ? 'px-4 py-2' : 'px-6 py-4'}>
                            <div className={`flex items-center gap-1.5 ${isCompact ? 'text-[9px]' : 'text-[10px]'} font-black uppercase tracking-widest ${
                              statusConfig[machine.status as keyof typeof statusConfig]?.color || 'text-slate-500'
                            }`}>
                              <div className={`${isCompact ? 'w-1 h-1' : 'w-1.5 h-1.5'} rounded-full ${
                                statusConfig[machine.status as keyof typeof statusConfig]?.bg.replace('bg-', 'bg-').replace('-50', '-500') || 'bg-slate-500'
                              }`} />
                              {machine.status}
                            </div>
                          </td>
                          <td className={`${isCompact ? 'px-4 py-2 text-right' : 'px-6 py-4'} hidden lg:table-cell`}>
                            <div className={`flex items-center ${isCompact ? 'justify-end' : ''} gap-1.5 ${isCompact ? 'text-[10px]' : 'text-xs'} text-slate-600 font-medium`}>
                              <MapPin className={`${isCompact ? 'w-2.5 h-2.5 text-slate-300' : 'w-3 h-3 text-slate-400'}`} />
                              {machine.location}
                            </div>
                          </td>
                          {!isCompact && (
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs font-bold text-emerald-700 group-hover:underline">
                                {isAdmin || isManager ? 'Edit →' : 'View →'}
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
              <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-slate-100/50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1 uppercase tracking-tight">No machines found</h3>
                <p className="text-slate-600 font-medium">Try adjusting your search or add a new machine to get started.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <MachineForm 
            user={user}
            machine={selectedMachine} 
            initialTab={initialTab}
            onClose={() => {
              setShowForm(false);
              setInitialTab(undefined);
            }} 
            onSave={(message) => {
              if (message) handleShowSuccess(message);
              setShowForm(false);
              setInitialTab(undefined);
            }} 
          />
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800"
          >
            <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black uppercase tracking-widest">{successMessage || 'Action Successful'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {showImageMachine && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[110] flex items-center justify-center p-4"
            onClick={() => setShowImageMachine(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full bg-white rounded-[2rem] overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowImageMachine(null)}
                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full transition-all z-10"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                <img 
                  src={showImageMachine.imageUrl} 
                  alt={showImageMachine.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Image+Not+Found';
                  }}
                />
              </div>
              
              <div className="p-6 bg-white border-t border-slate-100">
                <div className="flex justify-between items-center text-left">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{showImageMachine.name}</h3>
                    <div className="mt-1">
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{showImageMachine.model} • {showImageMachine.manufacturer}</p>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5 italic">S/N: {showImageMachine.serialNumber}</p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${
                    statusConfig[showImageMachine.status as keyof typeof statusConfig]?.bg || 'bg-slate-100'
                  } ${
                    statusConfig[showImageMachine.status as keyof typeof statusConfig]?.color || 'text-slate-700'
                  } border-current/10`}>
                    {showImageMachine.status}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="bg-white/80 backdrop-blur-md border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-600 font-bold uppercase tracking-widest">© 2026 Dino Maintenance Portal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
