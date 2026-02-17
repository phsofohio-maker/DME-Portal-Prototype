
import React, { useState } from 'react';
import { Staff } from '../../types';
import { firebaseService } from '../../services/firebaseService';

export const Onboarding: React.FC<{ user: Staff; onComplete: () => void }> = ({ user, onComplete }) => {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    if (pin !== confirmPin) return alert("PINs do not match");
    if (pin.length !== 4) return alert("PIN must be 4 digits");

    setLoading(true);
    await firebaseService.updateStaff(user.uid, {
      displayName,
      phoneNumber,
      department,
      pin,
      hasCompletedOnboarding: true
    });
    setLoading(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-slate-900 z-[500] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
        {/* Left sidebar info */}
        <div className="w-full md:w-72 bg-blue-600 p-8 text-white flex flex-col">
          <div className="mb-12">
            <h1 className="text-2xl font-bold tracking-tight">MedPortal</h1>
            <p className="text-blue-100 text-xs mt-1 uppercase tracking-widest font-semibold">Staff Onboarding</p>
          </div>
          
          <div className="space-y-8 flex-1">
            {[
              { n: 1, t: 'Identity', d: 'Basic profile details' },
              { n: 2, t: 'Security', d: 'Access credentials' },
              { n: 3, t: 'Orientation', d: 'System overview' }
            ].map(s => (
              <div key={s.n} className={`flex gap-4 items-center transition-opacity ${step === s.n ? 'opacity-100' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${step === s.n ? 'bg-white text-blue-600 border-white' : 'border-blue-300'}`}>
                  {s.n}
                </div>
                <div>
                  <p className="font-bold text-sm">{s.t}</p>
                  <p className="text-[10px] text-blue-100">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <p className="text-[10px] text-blue-200">Session ID: {user.uid.substr(0,8)}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-10 flex flex-col overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6 animate-[rise_0.3s_ease_both]">
              <h2 className="text-3xl font-bold text-slate-900 serif">Welcome to Parrish Health</h2>
              <p className="text-slate-500">First, let's confirm your identity details as they will appear on requests and prescriptions.</p>
              
              <div className="space-y-4 pt-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name / Signature Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="(555) 000-0000"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary Department</label>
                    <input 
                      type="text" 
                      placeholder="Home Health"
                      value={department}
                      onChange={e => setDepartment(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>
              <button onClick={() => setStep(2)} className="mt-auto w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800">Next Step</button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-[rise_0.3s_ease_both]">
              <h2 className="text-3xl font-bold text-slate-900 serif">Security Setup</h2>
              <p className="text-slate-500">Create a 4-digit security PIN. You will use this to sign clinical requests and log in to mobile devices.</p>
              
              <div className="space-y-8 pt-8 max-w-xs mx-auto text-center">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">New Security PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    className="w-full text-center text-4xl tracking-[0.5em] font-bold p-4 border-b-2 border-slate-200 focus:border-blue-600 outline-none"
                    placeholder="••••"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Confirm PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={confirmPin}
                    onChange={e => setConfirmPin(e.target.value)}
                    className="w-full text-center text-4xl tracking-[0.5em] font-bold p-4 border-b-2 border-slate-200 focus:border-blue-600 outline-none"
                    placeholder="••••"
                  />
                </div>
              </div>
              <div className="flex gap-4 mt-auto">
                <button onClick={() => setStep(1)} className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold">Back</button>
                <button onClick={() => setStep(3)} className="flex-2 py-4 bg-slate-900 text-white rounded-2xl font-bold px-8">Next Step</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-[rise_0.3s_ease_both]">
              <h2 className="text-3xl font-bold text-slate-900 serif">Ready to Begin</h2>
              <p className="text-slate-500">Your account is now configured. Please remember that all activity on MedPortal is logged for HIPAA compliance.</p>
              
              <div className="bg-slate-50 p-6 rounded-2xl space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Secure Access Active</p>
                    <p className="text-xs text-slate-500">Your 4-digit PIN is now your clinical e-signature.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                   <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Real-time Coordination</p>
                    <p className="text-xs text-slate-500">The pharmacy and DME providers will receive requests immediately upon your submission.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto">
                <button onClick={() => setStep(2)} className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold">Back</button>
                <button 
                  disabled={loading}
                  onClick={handleFinish} 
                  className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold px-8 hover:bg-blue-700 shadow-xl shadow-blue-500/20"
                >
                  {loading ? 'Finalizing...' : 'Complete Onboarding →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
