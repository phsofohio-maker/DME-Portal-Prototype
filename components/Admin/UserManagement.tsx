
import React, { useState, useEffect } from 'react';
import { Staff, UserInvitation, UserRole } from '../../types';
import { firebaseService } from '../../services/firebaseService';

export const UserManagement: React.FC<{ currentUser: Staff }> = ({ currentUser }) => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [invites, setInvites] = useState<UserInvitation[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInviteEmail, setNewInviteEmail] = useState('');
  const [newInviteRole, setNewInviteRole] = useState<UserRole>('nurse');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setStaff(firebaseService.getAllStaff());
    setInvites(firebaseService.getInvites());
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    await firebaseService.sendInvite(newInviteEmail, newInviteRole, currentUser);
    setNewInviteEmail('');
    setShowInviteModal(false);
    refreshData();
  };

  const handleRevokeInvite = async (id: string) => {
    await firebaseService.revokeInvite(id);
    refreshData();
  };

  const handleDeleteStaff = async (uid: string) => {
    if (uid === currentUser.uid) return alert("You cannot delete yourself.");
    if (confirm("Are you sure you want to remove this staff member? They will lose all access immediately.")) {
      await firebaseService.deleteStaff(uid);
      refreshData();
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'nurse': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 serif">Team Management</h2>
          <p className="text-slate-500">Manage staff access, roles, and pending invitations.</p>
        </div>
        <button 
          onClick={() => setShowInviteModal(true)}
          className="px-6 py-2.5 bg-[#2563eb] text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Invite Staff Member
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Staff Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Active Staff</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{staff.length} Members</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3">Member</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map(s => (
                  <tr key={s.uid} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                          {s.displayName.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{s.displayName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getRoleColor(s.role)}`}>
                        {s.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${s.hasCompletedOnboarding ? 'bg-green-500' : 'bg-amber-400'}`}></div>
                        <span className="text-[11px] font-medium text-slate-600">
                          {s.hasCompletedOnboarding ? 'Onboarded' : 'Setup Pending'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        disabled={s.uid === currentUser.uid}
                        onClick={() => handleDeleteStaff(s.uid)}
                        className="text-slate-400 hover:text-red-500 p-1 transition-colors disabled:opacity-20"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Invitations List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-fit">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Pending Invites</h3>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold border border-blue-100 uppercase tracking-tighter">
              {invites.filter(i => i.status === 'pending').length} Active
            </span>
          </div>
          <div className="p-4 space-y-4">
            {invites.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <p className="text-sm italic">No pending invitations.</p>
              </div>
            ) : (
              invites.map(invite => (
                <div key={invite.id} className="p-3 border rounded-xl border-slate-100 bg-slate-50 relative group">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-xs font-bold text-slate-900 truncate pr-6">{invite.email}</p>
                    <button 
                      onClick={() => handleRevokeInvite(invite.id)}
                      className="text-slate-300 hover:text-red-500 absolute top-3 right-3"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Role: <span className="font-bold uppercase text-slate-700">{invite.role}</span></span>
                    <span className="text-slate-400 font-medium">Sent {new Date(invite.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[300]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-[rise_0.3s_ease_both]">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900 serif">Invite New Team Member</h3>
              <p className="text-sm text-slate-500 mt-1">Access will be granted via their email address.</p>
            </div>
            <form onSubmit={handleSendInvite} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Email Address</label>
                <input 
                  required
                  type="email" 
                  value={newInviteEmail}
                  onChange={e => setNewInviteEmail(e.target.value)}
                  placeholder="name@parrish.com"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">System Role</label>
                <select 
                  value={newInviteRole}
                  onChange={e => setNewInviteRole(e.target.value as UserRole)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                >
                  <option value="nurse">Clinical Nurse</option>
                  <option value="homemaker">Homemaker / Support</option>
                  <option value="office_staff">Office Staff</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-[#2563eb] text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
