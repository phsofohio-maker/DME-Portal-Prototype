
import React from 'react';
import { Request } from '../../types';
import { RequestListSkeleton } from '../ui/LoadingSkeleton';

interface RequestListProps {
  requests: Request[];
  onSelect?: (req: Request) => void;
  title: string;
  isLoading?: boolean;
}

const Icons = {
  DME: () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 16h6"/><path d="M19 13v6"/><rect width="20" height="14" x="2" y="6" rx="2"/><path d="M7 15h.01"/><path d="M11 15h.01"/></svg>,
  Meds: () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>,
  Clinical: () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Communication: () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Empty: () => <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
};

export const RequestList: React.FC<RequestListProps> = ({ requests, onSelect, title, isLoading = false }) => {
  if (isLoading) return <RequestListSkeleton title={title} />;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'denied':   return 'bg-red-100 text-red-700 border-red-200';
      case 'rmi':      return 'bg-amber-100 text-amber-700 border-amber-200';
      default:         return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'rmi') return 'Info Needed';
    return status;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'dme': return <Icons.DME />;
      case 'medication': return <Icons.Meds />;
      case 'clinical': return <Icons.Clinical />;
      default: return <Icons.Communication />;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" role="region" aria-label={title}>
      <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800" id={`${title.replace(/\s/g, '-').toLowerCase()}-heading`}>
          {title}
        </h3>
        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium" aria-label={`${requests.length} total requests`}>
          {requests.length} Total
        </span>
      </div>
      <div className="divide-y divide-slate-100 overflow-x-auto">
        {requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center" role="status">
            <div className="mb-4">
              <Icons.Empty />
            </div>
            <p className="font-medium">No records found</p>
            <p className="text-xs">Active requests will appear here after submission.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm" aria-labelledby={`${title.replace(/\s/g, '-').toLowerCase()}-heading`}>
            <thead className="bg-slate-50 text-slate-500 font-semibold">
              <tr>
                <th scope="col" className="px-6 py-3">Type</th>
                <th scope="col" className="px-6 py-3">Patient</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Submitted</th>
                {onSelect && <th scope="col" className="px-6 py-3">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requests.sort((a, b) => b.createdAt - a.createdAt).map((req) => (
                <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2 text-slate-600">
                      <span aria-hidden="true">{getTypeIcon(req.type)}</span>
                      <span className="capitalize">{req.type}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900">{req.patientName}</p>
                    <p className="text-xs text-slate-500">ID: {req.patientId}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold border ${getStatusColor(req.status)}`}
                      aria-label={`Status: ${getStatusLabel(req.status)}`}
                    >
                      {getStatusLabel(req.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <time dateTime={new Date(req.createdAt).toISOString()}>
                      {new Date(req.createdAt).toLocaleDateString()}
                    </time>
                  </td>
                  {onSelect && (
                    <td className="px-6 py-4">
                      <button
                        onClick={() => onSelect(req)}
                        className="text-blue-600 hover:underline font-medium"
                        aria-label={`View details for ${req.patientName} request`}
                      >
                        Details
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
