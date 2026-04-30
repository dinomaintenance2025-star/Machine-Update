import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Dashboard from './components/Dashboard';
import { Shield, Lock, ChevronRight, User as UserIcon, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { AppUser } from './types';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Check for existing Firebase session
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const isOwner = firebaseUser.email === 'dino.maintenance2025@gmail.com' || firebaseUser.email === 'admin@dinoworld.com';
        setUser({ 
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role: isOwner ? 'admin' : 'viewer',
          isAdmin: isOwner
        });
      } else {
        // Check for custom session
        const savedUser = localStorage.getItem('dwmp_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (username === 'DinoWorldAdmin' && password === 'dinoworldrak2026') {
        const mockUser = {
          email: 'admin@dinoworld.com',
          displayName: 'DinoWorldAdmin',
          uid: 'admin-dwmp-001',
          role: 'admin',
          isAdmin: true
        };
        setUser(mockUser);
        localStorage.setItem('dwmp_user', JSON.stringify(mockUser));
      } else {
        // Check Firestore for technician users
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username), where('password', '==', password));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const userData = querySnapshot.docs[0].data();
          
          if (userData.isDeleted) {
            setError('This account has been deactivated');
            setLoading(false);
            return;
          }

          const appUser = {
            uid: querySnapshot.docs[0].id,
            username: userData.username,
            displayName: userData.displayName || userData.username,
            role: userData.role || 'technician',
            isAdmin: userData.role === 'admin'
          };
          setUser(appUser);
          localStorage.setItem('dwmp_user', JSON.stringify(appUser));
        } else {
          setError('Invalid username or password');
        }
      }
    } catch (err) {
      console.error("Login error:", err);
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await auth.signOut();
    localStorage.removeItem('dwmp_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Global Background Image */}
        <div 
          className="fixed inset-0 z-0 pointer-events-none opacity-20 bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url('https://tse4.mm.bing.net/th/id/OIP.JB2CWE2wRgoZniJpeZFHjwHaHa?rs=1&pid=ImgDetMain&o=7&rm=3')`,
            backgroundSize: '50%'
          }}
        />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white/80 backdrop-blur-md rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 overflow-hidden relative z-10"
        >
          <div className="bg-emerald-600/90 backdrop-blur-sm p-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight uppercase">DWMP</h1>
            <p className="text-emerald-100 text-sm mt-1">Dino World Maintenance Portal</p>
          </div>
          
          <div className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-slate-500 text-sm">Please sign in to access the maintenance dashboard.</p>
            </div>

            <form onSubmit={handleCustomLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <UserIcon className="w-3 h-3" />
                  Username
                </label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                  <Key className="w-3 h-3" />
                  Password
                </label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <p className="text-rose-500 text-xs font-bold animate-shake">{error}</p>
              )}

              <button 
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                Login to Portal
                <ChevronRight className="w-5 h-5" />
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-bold">Or continue with</span>
              </div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3 rounded-2xl font-bold border border-slate-200 transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Sign in with Google
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

  return (
    <div className="relative min-h-screen">
      {/* Global Background Image */}
      <div 
        className="fixed inset-0 z-[-1] pointer-events-none opacity-20 bg-center bg-no-repeat"
        style={{ 
          backgroundImage: `url('https://tse4.mm.bing.net/th/id/OIP.JB2CWE2wRgoZniJpeZFHjwHaHa?rs=1&pid=ImgDetMain&o=7&rm=3')`,
          backgroundSize: '50%'
        }}
      />
      <Dashboard user={user} onSignOut={handleSignOut} />
    </div>
  );
}
