import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { Contact } from '../types';
import { Plus, Search, Trash2, ExternalLink, Phone, User, Store, Mail, MapPin, Link as LinkIcon, X, Edit2, Globe, History, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { logActivity } from '../lib/activityLogger';

interface ContactsProps {
  user: any;
}

export default function Contacts({ user }: ContactsProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const isSuperAdmin = user?.email === 'dino.maintenance2025@gmail.com' || user?.email === 'admin@dinoworld.com' || user?.displayName === 'DinoWorldAdmin';
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isManager = user?.role === 'manager';
  const isTechnician = user?.role === 'technician';
  const canDelete = isAdmin || isManager || isTechnician;

  const [formData, setFormData] = useState<Partial<Contact>>({
    storeName: '',
    contactPerson: '',
    email: '',
    contactNumbers: ['', '', ''],
    address: '',
    websiteLink: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'contacts'), orderBy('storeName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Contact[];
      setContacts(contactsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const userName = user?.displayName || user?.email || 'User';
    try {
      const data: any = {
        ...formData,
        contactNumbers: formData.contactNumbers?.filter(n => n.trim() !== '') || [],
        updatedAt: serverTimestamp(),
      };

      if (editingContact?.id) {
        data.history = arrayUnion({
          status: 'Updated',
          changedBy: userName,
          changedAt: new Date(),
          notes: 'Contact information updated'
        });
        await updateDoc(doc(db, 'contacts', editingContact.id), data);
        logActivity(user, 'Updated Contact', `Updated contact: ${data.storeName}`, 'contact', editingContact.id);
      } else {
        const contactDoc = await addDoc(collection(db, 'contacts'), {
          ...data,
          createdAt: serverTimestamp(),
          history: [{
            status: 'Created',
            changedBy: userName,
            changedAt: new Date(),
            notes: 'Contact created'
          }]
        });
        logActivity(user, 'Created Contact', `Created new contact: ${data.storeName}`, 'contact', contactDoc.id);
      }
      setShowForm(false);
      setEditingContact(null);
      resetForm();
    } catch (error) {
      console.error("Error saving contact:", error);
      alert("Failed to save contact.");
    }
  };

  const resetForm = () => {
    setFormData({
      storeName: '',
      contactPerson: '',
      email: '',
      contactNumbers: ['', '', ''],
      address: '',
      websiteLink: '',
      notes: ''
    });
  };

  const handleDelete = async () => {
    if (!contactToDelete) return;
    try {
      const userName = user?.displayName || user?.email || 'User';
      
      if (isSuperAdmin) {
        // Super admin can choose to delete permanently or archive. 
        // For now, let's just delete permanently if they are super admin, 
        // OR we can check if it's already archived.
        await deleteDoc(doc(db, 'contacts', contactToDelete));
      } else {
        // Archive for others
        await updateDoc(doc(db, 'contacts', contactToDelete), {
          isDeleted: true,
          deletedBy: userName,
          deletedAt: serverTimestamp(),
          history: arrayUnion({
            status: 'Archived',
            changedBy: userName,
            changedAt: new Date(),
            notes: 'Contact moved to archive'
          })
        });
        logActivity(user, 'Archived Contact', `Archived contact: ${contacts.find(c => c.id === contactToDelete)?.storeName}`, 'contact', contactToDelete);
      }
      setContactToDelete(null);
    } catch (error) {
      console.error("Error deleting contact:", error);
      alert("Failed to delete contact.");
    }
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = 
      c.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (isSuperAdmin) return matchesSearch; // Admin sees everything
    return matchesSearch && !c.isDeleted; // Others only see active
  });

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <Store className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Suppliers & Contacts</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Manage your vendor directory</p>
          </div>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setEditingContact(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-slate-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search store name, contact person, email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all text-sm font-medium"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading contacts...</p>
        </div>
      ) : filteredContacts.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode='popLayout'>
            {filteredContacts.map((contact) => (
              <motion.div
                key={contact.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="relative flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                      <Store className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{contact.storeName}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{contact.contactPerson}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setEditingContact(contact);
                        setFormData({
                          ...contact,
                          contactNumbers: [...(contact.contactNumbers || []), '', '', ''].slice(0, 3)
                        });
                        setShowForm(true);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      <button 
                        onClick={() => setContactToDelete(contact.id!)}
                        className={`p-2 rounded-xl transition-all ${
                          contact.isDeleted 
                            ? 'text-rose-600 bg-rose-50 hover:bg-rose-100' 
                            : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                        }`}
                        title={contact.isDeleted ? "Delete Permanently" : "Archive Contact"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {contact.isDeleted && (
                  <div className="mb-4 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2">
                    <Clock className="w-3 h-3 text-rose-500" />
                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                      Archived by {contact.deletedBy}
                    </span>
                  </div>
                )}

                <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                        <a href={`mailto:${contact.email}`} className="text-xs font-bold text-indigo-600 hover:underline truncate block">{contact.email}</a>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Numbers</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {contact.contactNumbers.map((num, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-100">{num}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Address</p>
                        <p className="text-xs font-bold text-slate-600 leading-relaxed">{contact.address}</p>
                      </div>
                    </div>
                    {contact.websiteLink && (
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Website</p>
                          <a 
                            href={contact.websiteLink.startsWith('http') ? contact.websiteLink : `https://${contact.websiteLink}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] font-black text-indigo-600 hover:underline flex items-center gap-1 uppercase tracking-widest"
                          >
                            Visit Site <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {contact.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-xs text-slate-600 font-medium italic">{contact.notes}</p>
                  </div>
                )}

                {isSuperAdmin && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <button 
                      onClick={() => setExpandedHistory(expandedHistory === contact.id ? null : contact.id!)}
                      className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                      <History className="w-3 h-3" />
                      Change History (Admin Only)
                      {expandedHistory === contact.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <AnimatePresence>
                      {expandedHistory === contact.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 space-y-4 relative before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                            {contact.history?.slice().reverse().map((entry, idx) => (
                              <div key={idx} className="relative pl-6">
                                <div className="absolute left-0 top-1.5 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center z-10">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest bg-slate-100 text-slate-600">
                                      {entry.status}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                      <Clock className="w-2 h-2" />
                                      {entry.changedAt?.toDate ? entry.changedAt.toDate().toLocaleString() : new Date(entry.changedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  <p className="text-[10px] font-bold text-slate-600 mt-1">
                                    By: {entry.changedBy}
                                  </p>
                                  {entry.notes && (
                                    <p className="text-[10px] text-slate-400 italic mt-0.5">
                                      "{entry.notes}"
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No contacts found</h3>
          <p className="text-slate-600 font-medium">Start by adding a new supplier contact.</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white/90 backdrop-blur-md rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {editingContact ? 'Edit Contact' : 'New Supplier Contact'}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enter vendor and contact details</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Store / Company Name</label>
                    <div className="relative">
                      <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        value={formData.storeName}
                        onChange={(e) => setFormData({...formData, storeName: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                        placeholder="e.g. Parts World"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contact Person</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                        placeholder="Full Name"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                        placeholder="contact@company.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Website Link</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        value={formData.websiteLink}
                        onChange={(e) => setFormData({...formData, websiteLink: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                        placeholder="www.company.com"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contact Numbers (Up to 3)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[0, 1, 2].map((idx) => (
                      <div key={idx} className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          value={formData.contactNumbers?.[idx] || ''}
                          onChange={(e) => {
                            const newNums = [...(formData.contactNumbers || ['', '', ''])];
                            newNums[idx] = e.target.value;
                            setFormData({...formData, contactNumbers: newNums});
                          }}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                          placeholder={`Phone ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <textarea 
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm min-h-[80px]"
                      placeholder="Full physical address..."
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm min-h-[80px]"
                    placeholder="Additional details..."
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-[1.5rem] font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] px-6 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
                  >
                    {editingContact ? 'Update Contact' : 'Create Contact'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={handleDelete}
        title={isSuperAdmin ? "Delete Contact" : "Archive Contact"}
        message={isSuperAdmin 
          ? "Are you sure you want to permanently delete this contact? This action cannot be undone." 
          : "Are you sure you want to archive this contact? It will be hidden from the main list but accessible by administrators."}
        confirmText={isSuperAdmin ? "Delete Permanently" : "Archive Contact"}
      />
    </div>
  );
}
