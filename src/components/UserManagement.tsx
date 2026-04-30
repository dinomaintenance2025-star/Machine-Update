import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { User, Trash2, Plus, Shield, UserCog, X, Key, Lock, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { logActivity } from '../lib/activityLogger';

interface UserData {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'technician' | 'manager';
  isDeleted?: boolean;
  deletedBy?: string;
  deletedAt?: any;
  createdAt: any;
}

interface UserManagementProps {
  user: any;
  onUserCreated?: () => void;
}

export default function UserManagement({ user, onUserCreated }: UserManagementProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'technician' | 'manager'>('technician');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [userToReset, setUserToReset] = useState<UserData | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[];
      setUsers(userData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    setIsCreating(true);
    try {
      const userDoc = await addDoc(collection(db, 'users'), {
        username: newUsername,
        password: newPassword, // Note: In a real app, this should be hashed
        displayName: newDisplayName || newUsername,
        role: newRole,
        createdAt: serverTimestamp()
      });
      logActivity(user, 'Created User', `Created user account: ${newUsername} (${newRole})`, 'user', userDoc.id);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setShowAddForm(false);
      
      if (onUserCreated) {
        onUserCreated();
      }
    } catch (error) {
      console.error("Error adding user:", error);
      alert("Failed to add user.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      const userToDeleteObj = users.find(u => u.id === id);
      await updateDoc(doc(db, 'users', id), {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: user?.displayName || user?.email || 'Administrator'
      });
      logActivity(user, 'Deleted User', `Deactivated user account: ${userToDeleteObj?.username}`, 'user', id);
    } catch (error) {
      console.error("Error removing user:", error);
      alert("Failed to remove user.");
    } finally {
      setUserToDelete(null);
    }
  };

  const handleClearAllUsers = async () => {
    try {
      const activeUsers = users.filter(u => !u.isDeleted);
      const promises = activeUsers.map(u => 
        updateDoc(doc(db, 'users', u.id), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: 'Administrator (Bulk Clear)'
        })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error("Error clearing users:", error);
      alert("Failed to clear users.");
    } finally {
      setShowClearConfirm(false);
    }
  };

  const handlePurgeDeletedUsers = async () => {
    try {
      const deletedUsers = users.filter(u => u.isDeleted);
      const promises = deletedUsers.map(u => deleteDoc(doc(db, 'users', u.id)));
      await Promise.all(promises);
    } catch (error) {
      console.error("Error purging users:", error);
      alert("Failed to purge users.");
    } finally {
      setShowPurgeConfirm(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset || !resetPassword) return;

    setIsResetting(true);
    try {
      await updateDoc(doc(db, 'users', userToReset.id), {
        password: resetPassword,
        passwordLastReset: serverTimestamp()
      });
      logActivity(user, 'Reset Password', `Reset password for user: ${userToReset.username}`, 'user', userToReset.id);
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        setUserToReset(null);
        setResetPassword('');
      }, 2000);
    } catch (error) {
      console.error("Error resetting password:", error);
      alert("Failed to reset password.");
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <UserCog className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">User Management</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Manage technicians and administrators</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {users.some(u => u.isDeleted) && (
            <button 
              onClick={() => setShowPurgeConfirm(true)}
              className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all hover:bg-slate-800"
            >
              <Trash2 className="w-4 h-4" />
              Purge History
            </button>
          )}
          <button 
            onClick={() => setShowClearConfirm(true)}
            disabled={users.filter(u => !u.isDeleted).length === 0}
            className="flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs border border-rose-100 transition-all hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
          <button 
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-100 transition-all hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        onConfirm={handlePurgeDeletedUsers}
        title="Purge User History"
        message="Are you sure you want to PERMANENTLY delete all deactivated users? This action cannot be undone and will completely remove them from the database."
        confirmText="Purge Permanently"
      />

      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllUsers}
        title="Clear All Users"
        message="Are you sure you want to deactivate ALL active users? This action will mark all technicians and managers as removed."
        confirmText="Clear All Users"
      />

      <AnimatePresence>
        {isCreating && (
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
              <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
              <div>
                <h3 className="font-black text-slate-900 uppercase tracking-tight">Creating Account</h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Please wait a moment...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => userToDelete && handleDeleteUser(userToDelete)}
        title="Deactivate User"
        message="Are you sure you want to mark this user as REMOVED? They will no longer be able to log in to the portal."
        confirmText="Deactivate User"
      />

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">Create New User</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1 hover:bg-slate-100 rounded-full">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Username</label>
                <input 
                  required
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  placeholder="jdoe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                <input 
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Display Name</label>
                <input 
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
                >
                  <option value="technician">Technician (Reports Only)</option>
                  <option value="manager">Manager (Approvals & Comments)</option>
                  <option value="admin">Administrator (Full Access)</option>
                </select>
              </div>
              <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                <button 
                  type="submit"
                  className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-all hover:bg-slate-800"
                >
                  Create Account
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {userToReset && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white p-6 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Key className="w-5 h-5 text-amber-600" />
                  </div>
                  <h3 className="font-black text-slate-900 uppercase tracking-tight">Reset Password</h3>
                </div>
                {!resetSuccess && (
                  <button onClick={() => setUserToReset(null)} className="p-1 hover:bg-slate-100 rounded-full">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>

              {resetSuccess ? (
                <div className="py-8 flex flex-col items-center gap-4 text-center animate-in fade-in zoom-in">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Check className="w-8 h-8 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 uppercase tracking-tight">Password Updated</h4>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">The new password is active</p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">User</p>
                    <p className="text-sm font-bold text-slate-900">{userToReset.displayName} (@{userToReset.username})</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="text"
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-mono"
                        placeholder="Enter new password"
                        autoFocus
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setUserToReset(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] text-slate-500 hover:bg-slate-100 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isResetting || !resetPassword}
                      className="flex-1 bg-slate-900 text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg transition-all hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isResetting ? (
                        <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Key className="w-3 h-3" />
                      )}
                      Update Password
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Desktop View */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${u.isDeleted ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <User className="w-5 h-5 text-slate-500 group-hover:text-emerald-600" />
                      </div>
                      <div>
                        <div className={`text-sm font-black uppercase tracking-tight ${u.isDeleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                          {u.displayName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">@{u.username}</div>
                        {u.isDeleted && (
                          <div className="text-[9px] text-rose-600 font-black uppercase tracking-widest mt-0.5">
                            Removed by {u.deletedBy || 'Admin'}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-sm ${
                      u.isDeleted ? 'bg-slate-100 text-slate-400' :
                      u.role === 'admin' ? 'bg-rose-100 text-rose-600 border border-rose-200' : 
                      u.role === 'manager' ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {!u.isDeleted && (
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setUserToReset(u)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all border border-transparent hover:border-amber-100"
                          title="Reset Password"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setUserToDelete(u.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100"
                          title="Deactivate User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {users.map((u) => (
            <div key={u.id} className={`p-4 space-y-4 ${u.isDeleted ? 'opacity-60 grayscale-[0.5]' : ''}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className={`text-sm font-black uppercase tracking-tight ${u.isDeleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {u.displayName}
                    </div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">@{u.username}</div>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                  u.isDeleted ? 'bg-slate-100 text-slate-400' :
                  u.role === 'admin' ? 'bg-rose-100 text-rose-600' : 
                  u.role === 'manager' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                }`}>
                  {u.role}
                </span>
              </div>
              
              {!u.isDeleted && (
                <div className="flex items-center gap-2 pt-2">
                  <button 
                    onClick={() => setUserToReset(u)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-amber-50 text-amber-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-amber-100"
                  >
                    <Key className="w-3.5 h-3.5" />
                    Reset Pass
                  </button>
                  <button 
                    onClick={() => setUserToDelete(u.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-rose-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Deactivate
                  </button>
                </div>
              )}
              {u.isDeleted && (
                <div className="text-[9px] text-rose-600 font-black uppercase tracking-widest text-center py-1 bg-rose-50 rounded-lg">
                  Removed by {u.deletedBy || 'Admin'}
                </div>
              )}
            </div>
          ))}
        </div>

        {users.length === 0 && !loading && (
          <div className="px-6 py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <UserCog className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No users found</h3>
            <p className="text-sm text-slate-500 font-medium mt-1">Add your first technician or manager to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
