import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import Dashboard from './components/Dashboard';
import { Shield, Lock, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden"
        >
          <div className="bg-blue-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">DINO MAINT</h1>
            <p className="text-blue-100 text-sm mt-1">Enterprise Machine Maintenance Portal</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-slate-500 text-sm">Please sign in with your corporate account to access the maintenance dashboard.</p>
            </div>

            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-between bg-slate-900 hover:bg-slate-800 text-white px-6 py-4 rounded-2xl font-bold transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
                </div>
                Sign in with Google
              </div>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest justify-center">
              <Lock className="w-3 h-3" />
              Secure Enterprise Access
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return <Dashboard />;
}
