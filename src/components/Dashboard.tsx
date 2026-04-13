import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { Machine, MachineCategory, MachineStatus, MaintenanceResult } from '../types';
import MachineCard from './MachineCard';
import MachineForm from './MachineForm';
import { Plus, Search, LayoutGrid, List, Filter, LogOut, User, Tag, Activity, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signOut } from 'firebase/auth';

export default function Dashboard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MachineCategory | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<MachineStatus | 'ALL'>('ALL');
  const [selectedResult, setSelectedResult] = useState<MaintenanceResult | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | undefined>();

  useEffect(() => {
    const q = query(collection(db, 'machines'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const machineData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Machine[];
      setMachines(machineData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    const matchesStatus = selectedStatus === 'ALL' || m.status === selectedStatus;
    const matchesResult = selectedResult === 'ALL' || m.lastResult === selectedResult;
    
    return matchesSearch && matchesCategory && matchesStatus && matchesResult;
  });

  const categories: (MachineCategory | 'ALL')[] = [
    'ALL',
    'BIG RIDES/ATTRACTIONS',
    'REDEMPTION',
    'KIDDIE RIDES',
    'VIDEO GAMES',
    'SKILL GAMES'
  ];

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

  const handleSignOut = () => signOut(auth);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-white rotate-45" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">DINO MAINT</h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-sm font-medium text-slate-600">
              <User className="w-4 h-4" />
              {auth.currentUser?.email}
            </div>
            <button 
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Toolbar */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search machines, models, or locations..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm transition-all"
              />
            </div>

            <div className="flex items-center gap-3">
              <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm">
                <Filter className="w-5 h-5" />
              </button>
              <button 
                onClick={() => {
                  setSelectedMachine(undefined);
                  setShowForm(true);
                }}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all"
              >
                <Plus className="w-5 h-5" />
                Add Machine
              </button>
            </div>
          </div>

          {/* Category Toggle */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <div className="flex items-center gap-2 mr-2 text-slate-400 shrink-0">
                <Tag className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Categories:</span>
              </div>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${
                    selectedCategory === cat 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 mr-2 text-slate-400 shrink-0">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Status:</span>
                </div>
                {statuses.map((status) => (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                      selectedStatus === status 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 mr-2 text-slate-400 shrink-0">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Last Result:</span>
                </div>
                {results.map((res) => (
                  <button
                    key={res}
                    onClick={() => setSelectedResult(res)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all border ${
                      selectedResult === res 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-medium">Loading your fleet...</p>
          </div>
        ) : filteredMachines.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            <AnimatePresence mode='popLayout'>
              {filteredMachines.map((machine) => (
                <MachineCard 
                  key={machine.id} 
                  machine={machine} 
                  onClick={() => {
                    setSelectedMachine(machine);
                    setShowForm(true);
                  }}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">No machines found</h3>
            <p className="text-slate-500">Try adjusting your search or add a new machine to get started.</p>
          </div>
        )}
      </main>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <MachineForm 
            machine={selectedMachine} 
            onClose={() => setShowForm(false)} 
            onSave={() => {}} 
          />
        )}
      </AnimatePresence>

      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-400 font-medium">© 2026 Dino Maintenance Systems. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
