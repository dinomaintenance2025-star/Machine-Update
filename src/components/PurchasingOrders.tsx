import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, deleteDoc, query, orderBy, arrayUnion } from 'firebase/firestore';
import { PurchasingOrder, Machine } from '../types';
import { Plus, Search, Trash2, ExternalLink, Phone, User, Factory, Hash, DollarSign, Truck, Link as LinkIcon, X, Check, AlertCircle, MoreVertical, Edit2, Filter, ShoppingCart, History, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ConfirmModal from './ConfirmModal';
import { logActivity } from '../lib/activityLogger';

interface PurchasingOrdersProps {
  isAdmin: boolean;
  isManager: boolean;
  isTechnician: boolean;
  user: any;
  machines: Machine[];
}

export default function PurchasingOrders({ isAdmin, isManager, isTechnician, user, machines }: PurchasingOrdersProps) {
  const [orders, setOrders] = useState<PurchasingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchasingOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [orderToReject, setOrderToReject] = useState<PurchasingOrder | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isSuperAdmin = user?.email === 'dino.maintenance2025@gmail.com' || user?.email === 'admin@dinoworld.com' || user?.displayName === 'DinoWorldAdmin';
  const isLocked = editingOrder && ['Approved', 'Ordered', 'Received'].includes(editingOrder.status) && !isSuperAdmin;

  const [formData, setFormData] = useState<Partial<PurchasingOrder>>({
    manufacturer: '',
    contactPerson: '',
    contactNumbers: ['', '', ''],
    links: [''],
    partNumber: '',
    price: 0,
    currency: 'AED',
    shippingTime: '',
    status: 'Draft',
    machineId: '',
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PurchasingOrder[];
      setOrders(ordersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const selectedMachine = machines.find(m => m.id === formData.machineId);
      const userName = user?.displayName || user?.email || 'User';
      
      const data: any = {
        ...formData,
        machineName: selectedMachine?.name || '',
        contactNumbers: formData.contactNumbers?.filter(n => n.trim() !== '') || [],
        links: formData.links?.filter(l => l.trim() !== '') || [],
        updatedAt: serverTimestamp(),
      };

      if (editingOrder?.id) {
        let historyNote = '';
        const statusChanged = formData.status !== editingOrder.status;
        const notesChanged = formData.notes !== editingOrder.notes;

        if (statusChanged && notesChanged) {
          historyNote = `Status updated to ${formData.status} & Comment added: ${formData.notes?.substring(0, 50)}${formData.notes && formData.notes.length > 50 ? '...' : ''}`;
        } else if (statusChanged) {
          historyNote = `Status updated to ${formData.status}`;
        } else if (notesChanged) {
          historyNote = `Comment updated: ${formData.notes?.substring(0, 50)}${formData.notes && formData.notes.length > 50 ? '...' : ''}`;
        }

        if (historyNote) {
          data.statusHistory = arrayUnion({
            status: formData.status || editingOrder.status,
            changedBy: userName,
            changedAt: new Date(),
            notes: historyNote
          });
        }

        // If status is being changed to Approved/Ordered/Received by Admin/Manager
        if (statusChanged && (isAdmin || isManager) && 
            ['Approved', 'Ordered', 'Received'].includes(formData.status || '') && 
            editingOrder.status === 'Pending') {
          data.approvedBy = userName;
          data.approvedAt = serverTimestamp();
        }
        
        await updateDoc(doc(db, 'orders', editingOrder.id), data);
        logActivity(user, 'Updated Order', `Updated order for ${data.manufacturer} (${data.partNumber})`, 'order', editingOrder.id);
      } else {
        const initialStatus = isTechnician ? 'Pending' : (formData.status || 'Draft');
        const orderDoc = await addDoc(collection(db, 'orders'), {
          ...data,
          status: initialStatus,
          createdBy: userName,
          createdByEmail: user?.email || '',
          createdAt: serverTimestamp(),
          statusHistory: [{
            status: initialStatus,
            changedBy: userName,
            changedAt: new Date(),
            notes: 'Order Created'
          }]
        });
        logActivity(user, 'Created Order', `Created new order for ${data.manufacturer} (${data.partNumber})`, 'order', orderDoc.id);
      }
      setShowForm(false);
      setEditingOrder(null);
      resetForm();
    } catch (error) {
      console.error("Error saving order:", error);
      alert("Failed to save order.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      manufacturer: '',
      contactPerson: '',
      contactNumbers: ['', '', ''],
      links: [''],
      partNumber: '',
      price: 0,
      currency: 'AED',
      shippingTime: '',
      status: 'Draft',
      machineId: '',
      notes: ''
    });
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    const order = orders.find(o => o.id === orderToDelete);
    if (!order) return;

    try {
      // If it's already archived and it's super admin, permanent delete
      if (order.isDeleted && isSuperAdmin) {
        await deleteDoc(doc(db, 'orders', orderToDelete));
        setOrderToDelete(null);
        return;
      }

      // Soft delete: Mark as deleted so it's hidden from everyone except super admin
      await updateDoc(doc(db, 'orders', orderToDelete), {
        isDeleted: true,
        deletedBy: user?.displayName || user?.email || 'Admin',
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: order.status,
          changedBy: user?.displayName || user?.email || 'Admin',
          changedAt: new Date(),
          notes: 'Order Archived'
        })
      });
      logActivity(user, 'Archived Order', `Archived order for ${order.manufacturer}`, 'order', orderToDelete);
      setOrderToDelete(null);
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Failed to delete order.");
    }
  };

  const handleReject = async () => {
    if (!orderToReject) return;
    const userName = user?.displayName || user?.email || 'Admin';
    try {
      await updateDoc(doc(db, 'orders', orderToReject.id!), {
        status: 'Rejected',
        rejectionNotes: rejectionNotes,
        rejectedBy: userName,
        rejectedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: 'Rejected',
          changedBy: userName,
          changedAt: new Date(),
          notes: rejectionNotes
        })
      });
      logActivity(user, 'Rejected Order', `Rejected order for ${orderToReject.manufacturer}`, 'order', orderToReject.id);
      setOrderToReject(null);
      setRejectionNotes('');
    } catch (error) {
      console.error("Error rejecting order:", error);
      alert("Failed to reject order.");
    }
  };

  const filteredOrders = orders.filter(o => {
    // Hidden from everyone except super admin if deleted
    if (o.isDeleted && !isSuperAdmin) return false;

    const matchesSearch = 
      o.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.partNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.contactPerson.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    'Draft': 'bg-slate-100 text-slate-600',
    'Pending': 'bg-amber-100 text-amber-700',
    'Approved': 'bg-emerald-50 text-emerald-600 border border-emerald-100',
    'Ordered': 'bg-blue-100 text-blue-700',
    'Received': 'bg-emerald-100 text-emerald-700',
    'Cancelled': 'bg-rose-100 text-rose-700',
    'Rejected': 'bg-rose-100 text-rose-700 border border-rose-200'
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200/50">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Purchasing Orders</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Manage parts procurement and supplier contacts</p>
          </div>
        </div>
        <button 
          onClick={() => {
            resetForm();
            setEditingOrder(null);
            setShowForm(true);
          }}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl hover:bg-slate-800 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search manufacturer, part, contact..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all text-sm font-medium"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 sm:pb-0">
          {['ALL', 'Draft', 'Pending', 'Ordered', 'Received', 'Cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                statusFilter === status 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600/20 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-slate-500 font-medium">Loading orders...</p>
        </div>
      ) : filteredOrders.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnimatePresence mode='popLayout'>
            {filteredOrders.map((order) => (
              <motion.div
                key={order.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group relative"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                      <ShoppingCart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{order.manufacturer}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm ${statusColors[order.status as keyof typeof statusColors] || 'bg-slate-100 text-slate-600'}`}>
                          {order.status}
                        </span>
                        {order.isDeleted && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest bg-rose-600 text-white shadow-sm">
                            Archived
                          </span>
                        )}
                        {order.machineName && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {order.machineName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                          <User className="w-2.5 h-2.5" />
                          {order.createdBy || 'Unknown'}
                        </span>
                        {order.approvedBy && (
                          <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> {order.approvedBy}
                          </span>
                        )}
                        {order.rejectedBy && (
                          <span className="text-[9px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-1">
                            <X className="w-2.5 h-2.5" /> {order.rejectedBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {(isAdmin || isManager) && order.status === 'Pending' && (
                      <div className="flex items-center gap-2 mr-2">
                        <button 
                          onClick={async () => {
                            const userName = user?.displayName || user?.email || 'Admin';
                            try {
                              await updateDoc(doc(db, 'orders', order.id!), {
                                status: 'Approved',
                                approvedBy: userName,
                                approvedAt: serverTimestamp(),
                                updatedAt: serverTimestamp(),
                                statusHistory: arrayUnion({
                                  status: 'Approved',
                                  changedBy: userName,
                                  changedAt: new Date(),
                                  notes: 'Order Approved'
                                })
                              });
                            } catch (e) {
                              alert("Failed to approve order.");
                            }
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                        >
                          <Check className="w-3 h-3" />
                          Approve
                        </button>
                        <button 
                          onClick={() => setOrderToReject(order)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all"
                        >
                          <X className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    )}
                    {(isAdmin || isManager || (isTechnician && order.status === 'Pending')) && (
                      <button 
                        onClick={() => {
                          setEditingOrder(order);
                          setFormData({
                            ...order,
                            contactNumbers: [...(order.contactNumbers || []), '', '', ''].slice(0, 3),
                            links: [...(order.links || []), ''].slice(0, 5)
                          });
                          setShowForm(true);
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {(isAdmin || isManager || isSuperAdmin) && (
                      <button 
                        onClick={() => {
                          // Restriction: Once approved, only super admin can delete
                          if (['Approved', 'Ordered', 'Received'].includes(order.status) && !isSuperAdmin) {
                            alert("Only the DinoWorldAdmin can delete approved orders.");
                            return;
                          }
                          setOrderToDelete(order.id!);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contact Person</p>
                        <p className="text-xs font-bold text-slate-700">{order.contactPerson}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Numbers</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {order.contactNumbers.map((num, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded-md border border-slate-100">{num}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <Hash className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Part Number</p>
                        <p className="text-xs font-bold text-slate-700">{order.partNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Truck className="w-4 h-4 text-slate-400" />
                      <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Shipping Time</p>
                        <p className="text-xs font-bold text-slate-700">{order.shippingTime}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="relative flex items-center justify-between pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-xl font-black text-slate-900">{order.currency} {order.price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.links.map((link, idx) => (
                      <a 
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm"
                        title="View Link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                </div>
                {order.notes && (
                  <div className="mt-4 p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-xs text-slate-600 font-medium italic">{order.notes}</p>
                  </div>
                )}
                {order.rejectionNotes && (
                  <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Rejection Notes</p>
                    <p className="text-xs text-rose-700 font-bold italic">{order.rejectionNotes}</p>
                  </div>
                )}

                {(isSuperAdmin || isManager || isAdmin) && (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <button 
                      onClick={() => setExpandedHistory(expandedHistory === order.id ? null : order.id!)}
                      className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                    >
                      <History className="w-3 h-3" />
                      Status History
                      {expandedHistory === order.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    <AnimatePresence>
                      {expandedHistory === order.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 space-y-2 relative before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-0.5 before:bg-slate-100">
                            {order.statusHistory?.slice().reverse().map((entry, idx) => (
                              <div key={idx} className="relative pl-4">
                                <div className="absolute left-0 top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-500 flex items-center justify-center z-10">
                                  <div className="w-1 h-1 rounded-full bg-indigo-500" />
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest ${statusColors[entry.status as keyof typeof statusColors] || 'bg-slate-100 text-slate-600'}`}>
                                        {entry.status}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-600">
                                        {entry.changedBy}
                                      </span>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 flex items-center gap-0.5 whitespace-nowrap">
                                      <Clock className="w-2 h-2" />
                                      {entry.changedAt?.toDate ? entry.changedAt.toDate().toLocaleString() : new Date(entry.changedAt).toLocaleString()}
                                    </span>
                                  </div>
                                  {entry.notes && (
                                    <p className="text-[9px] text-slate-400 italic leading-tight">
                                      {entry.notes}
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
            <ShoppingCart className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">No orders found</h3>
          <p className="text-slate-600 font-medium">Start by creating a new purchasing order.</p>
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
                    {editingOrder ? 'Edit Order' : 'New Purchasing Order'}
                  </h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Enter supplier and part details</p>
                </div>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Manufacturer</label>
                    <div className="relative">
                      <Factory className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        disabled={isLocked}
                        value={formData.manufacturer}
                        onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                        placeholder="e.g. SEGA, Namco"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contact Person</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        disabled={isLocked}
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({...formData, contactPerson: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                        placeholder="Full Name"
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
                          disabled={isLocked}
                          value={formData.contactNumbers?.[idx] || ''}
                          onChange={(e) => {
                            const newNums = [...(formData.contactNumbers || ['', '', ''])];
                            newNums[idx] = e.target.value;
                            setFormData({...formData, contactNumbers: newNums});
                          }}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                          placeholder={`Phone ${idx + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Part Number</label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        disabled={isLocked}
                        value={formData.partNumber}
                        onChange={(e) => setFormData({...formData, partNumber: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                        placeholder="e.g. P-1002-X"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Shipping Time</label>
                    <div className="relative">
                      <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        disabled={isLocked}
                        value={formData.shippingTime}
                        onChange={(e) => setFormData({...formData, shippingTime: e.target.value})}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                        placeholder="e.g. 3-5 Business Days"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Price ({formData.currency})</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="number"
                        required
                        disabled={isLocked}
                        value={isNaN(formData.price || 0) ? '' : formData.price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setFormData({...formData, price: isNaN(val) ? 0 : val});
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      disabled={isTechnician && editingOrder?.status !== 'Pending'}
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-50"
                    >
                      {isTechnician ? (
                        <>
                          <option value="Pending">Pending Approval</option>
                          <option value="Draft">Draft</option>
                        </>
                      ) : (
                        <>
                          <option value="Draft">Draft</option>
                          <option value="Pending">Pending Approval</option>
                          <option value="Approved">Approved</option>
                          <option value="Ordered">Ordered</option>
                          <option value="Received">Received</option>
                          <option value="Cancelled">Cancelled</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Related Machine (Optional)</label>
                  <select 
                    value={formData.machineId}
                    onChange={(e) => setFormData({...formData, machineId: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm"
                  >
                    <option value="">None</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Links</label>
                    <button 
                      type="button"
                      onClick={() => setFormData({...formData, links: [...(formData.links || []), '']})}
                      className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                    >
                      + Add Link
                    </button>
                  </div>
                  <div className="space-y-3">
                    {formData.links?.map((link, idx) => (
                      <div key={idx} className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                          disabled={isLocked}
                          value={link}
                          onChange={(e) => {
                            const newLinks = [...(formData.links || [''])];
                            newLinks[idx] = e.target.value;
                            setFormData({...formData, links: newLinks});
                          }}
                          className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm disabled:opacity-60"
                          placeholder="https://..."
                        />
                        {idx > 0 && !isLocked && (
                          <button 
                            type="button"
                            onClick={() => {
                              const newLinks = formData.links?.filter((_, i) => i !== idx);
                              setFormData({...formData, links: newLinks});
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notes</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-sm min-h-[100px]"
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
                    disabled={saving}
                    className="flex-[2] px-6 py-4 bg-emerald-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : (editingOrder ? 'Update Order' : 'Create Order')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!orderToDelete}
        onClose={() => setOrderToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Order"
        message="Are you sure you want to delete this purchasing order? This action cannot be undone."
        confirmText="Delete Order"
      />

      <AnimatePresence>
        {orderToReject && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md p-8 border border-slate-100"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reject Order</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Please provide a reason</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Rejection Reason / Notes</label>
                  <textarea 
                    autoFocus
                    value={rejectionNotes}
                    onChange={(e) => setRejectionNotes(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-rose-500 outline-none font-bold text-sm min-h-[120px]"
                    placeholder="Why is this order being rejected?"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => {
                      setOrderToReject(null);
                      setRejectionNotes('');
                    }}
                    className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!rejectionNotes.trim()}
                    onClick={handleReject}
                    className="flex-[2] px-6 py-4 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all disabled:opacity-50 disabled:shadow-none"
                  >
                    Reject Order
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
