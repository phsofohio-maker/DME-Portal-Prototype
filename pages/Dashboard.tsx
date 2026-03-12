import React, { useState, useEffect } from 'react';
import { Staff, Request } from '../types';
import { firebaseService } from '../services/firebaseService';
import { RequestList } from '../components/Dashboard/RequestList';
import { DashboardSkeleton } from '../components/ui/LoadingSkeleton';
import { exportRequestPDF } from '../services/pdfService';

interface DashboardProps {
  user: Staff;
}

export const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToUserRequests(user.uid, (data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [user.uid]);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back, {user.displayName}
          </h2>
          <p className="text-slate-600">Here are your active supply and logistics requests.</p>
        </div>
        <div className="hidden md:block">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 text-sm font-medium">
            Role: <span className="capitalize font-bold">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" role="region" aria-label="Request summary">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Active Requests</p>
          <p className="text-3xl font-bold text-slate-900 mt-1" aria-label={`${requests.filter((r) => r.status === 'pending').length} active requests`}>
            {requests.filter((r) => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Approved</p>
          <p className="text-3xl font-bold text-green-700 mt-1">
            {requests.filter((r) => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">Info Needed</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">
            {requests.filter((r) => r.status === 'rmi').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-600 text-sm font-medium">System Health</p>
          <p className="text-sm font-bold text-green-700 mt-2 flex items-center">
            <span
              className="w-2 h-2 rounded-full bg-green-600 mr-2 inline-block animate-pulse"
              aria-hidden="true"
            />
            Operational
          </p>
        </div>
      </div>

      <RequestList
        title="Your Recent Submissions"
        requests={requests}
        onExport={exportRequestPDF}
      />
    </div>
  );
};
