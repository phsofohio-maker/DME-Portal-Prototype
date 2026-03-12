
import React, { useState, useEffect, useMemo } from 'react';
import { MOCK_DME } from '../../services/mockData';
import { patientService } from '../../services/patientService';
import { Staff, Patient } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { dmeFormSchema } from '../../lib/schemas';
import { ICD10Field } from './ICD10Field';
import { logger } from '../../services/logger';
import { isTransient } from '../../utils/retryWithBackoff';
import { PatientRowSkeleton } from '../ui/Skeleton';

// ─── Inline field error helper ────────────────────────────────────────────────
const FieldError = ({ msg }: { msg?: string }) =>
  msg ? <p role="alert" className="text-red-500 text-xs mt-1">{msg}</p> : null;

interface DMEFormProps {
  user: Staff;
  onSuccess: () => void;
}

export const DMEForm: React.FC<DMEFormProps> = ({ user, onSuccess }) => {
  // --- Form State ---
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [patientSearching, setPatientSearching] = useState(false);
  
  const [category, setCategory] = useState('');
  const [item, setItem] = useState('');
  const [reqType, setReqType] = useState('New');
  const [delivery, setDelivery] = useState('Home Delivery');
  const [specialFeatures, setSpecialFeatures] = useState('');
  
  const [icd10, setIcd10] = useState('');
  const [secondaryIcd10, setSecondaryIcd10] = useState('');
  const [justification, setJustification] = useState('');
  const [prescriptionDate, setPrescriptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [lengthOfNeed, setLengthOfNeed] = useState('');
  const [priorAuth, setPriorAuth] = useState('');
  const [urgency, setUrgency] = useState('Routine');
  
  const [consents, setConsents] = useState<boolean[]>([false, false, false]);
  const [signed, setSigned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  // --- Patient search via PatientLookupService ---
  useEffect(() => {
    if (!searchQuery.trim()) { setFilteredPatients([]); return; }
    setPatientSearching(true);
    const timer = setTimeout(() => {
      patientService.search(searchQuery).then((results) => {
        setFilteredPatients(results);
        setPatientSearching(false);
      }).catch(() => setPatientSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const categories = useMemo(() => Array.from(new Set(MOCK_DME.map(d => d.category))), []);
  const availableItems = useMemo(() => MOCK_DME.filter(d => d.category === category), [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    // Zod validation
    const result = dmeFormSchema.safeParse({
      patientId: selectedPatient?.mrn ?? '',
      patientName: selectedPatient?.name ?? '',
      category,
      item,
      reqType,
      delivery,
      specialFeatures,
      icd10,
      secondaryIcd10: secondaryIcd10 || undefined,
      justification,
      prescriptionDate,
      lengthOfNeed: lengthOfNeed || undefined,
      priorAuth: priorAuth || undefined,
      urgency: urgency as 'Routine' | 'Urgent' | 'Critical',
      consents,
      signed: signed as true,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0]?.toString() ?? 'form';
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      // Scroll to first error
      const firstKey = Object.keys(fieldErrors)[0];
      const firstErrorEl = document.getElementById(`dme-${firstKey}`);
      firstErrorEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Focus the first erroneous input for screen readers (WCAG 2.4.3)
      setTimeout(() => {
        const focusable = firstErrorEl?.querySelector<HTMLElement>('input, select, textarea, button');
        focusable?.focus();
      }, 300);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await firebaseService.submitRequest({
        type: 'dme',
        submitterId: user.uid,
        submitterName: user.displayName,
        patientName: selectedPatient.name,
        patientId: selectedPatient.mrn,
        details: {
          kind: 'dme' as const,
          equipment: { category, item, reqType, delivery, specialFeatures },
          clinical: { icd10, secondaryIcd10, justification, prescriptionDate, lengthOfNeed, priorAuth, urgency },
          consents,
        },
      });
      onSuccess();
    } catch (err) {
      logger.error('DMEForm', 'Submit failed', err);
      setSubmitError(
        isTransient(err)
          ? 'Network issue — your submission will sync automatically when connectivity is restored.'
          : 'Submission failed. Please try again or contact IT support if the problem persists.'
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleConsent = (index: number) => {
    const next = [...consents];
    next[index] = !next[index];
    setConsents(next);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#0e1f38] serif">New Equipment Request</h2>
        <p className="text-sm text-slate-600 mt-1">Select the patient, choose equipment, and provide clinical details — all other info is pulled from the patient record.</p>
      </div>

      {submitError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-4 mb-2">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {/* --- CARD 1: Patient Lookup --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Patient</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6" id="dme-patientId">
            <FieldError msg={errors.patientId} />
            {!selectedPatient ? (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name, MRN, or date of birth…"
                  className="w-full pl-11 pr-4 py-3 bg-[#f0f4f8] border-1.5 border-[#e2e8f0] rounded-xl outline-none focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] transition-all"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                />
                
                {isDropdownOpen && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#eff4ff] transition-colors text-left border-b last:border-0 border-[#e2e8f0]"
                          onClick={() => {
                            setSelectedPatient(p);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                            {p.initials}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#0f172a]">{p.name}</p>
                            <p className="text-xs text-slate-500">DOB: {p.dob} · {p.sex} · {p.insurance}</p>
                          </div>
                          <div className="px-2 py-1 bg-[#eff4ff] text-[#2563eb] rounded-md text-[0.72rem] font-bold">{p.mrn}</div>
                        </button>
                      ))
                    ) : patientSearching ? (
                      <div>{Array.from({ length: 3 }).map((_, i) => <PatientRowSkeleton key={i} />)}</div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">No patients found.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="border-[1.5px] border-[#bfd4fd] bg-[#eff4ff] rounded-2xl p-5 flex gap-5 items-start animate-[rise_0.25s_ease_both]">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-sm" style={{ backgroundColor: selectedPatient.color }}>
                  {selectedPatient.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-[#0e1f38] serif">{selectedPatient.name}</span>
                    <div className="flex gap-2">
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-white border border-[#bfd4fd] text-[#2563eb] font-bold">{selectedPatient.mrn}</span>
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold">{selectedPatient.age} yrs</span>
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-[#ccfbf1] border border-[#99f6e4] text-[#0d9488] font-bold">{selectedPatient.insurance}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">DOB</span><span className="text-sm font-medium">{selectedPatient.dob}</span></div>
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sex</span><span className="text-sm font-medium">{selectedPatient.sex}</span></div>
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Insurance ID</span><span className="text-sm font-medium font-mono">{selectedPatient.insId}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Conditions</span><span className="text-sm font-medium">{selectedPatient.conditions.join(', ')}</span></div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-[#2563eb] font-bold text-xs hover:bg-[#2563eb]/10 px-2 py-1 rounded transition-colors">✕ Change</button>
              </div>
            )}
          </div>
        </section>

        {/* --- CARD 2: Equipment & Delivery --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Equipment & Delivery</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Equipment Category <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value); setItem(''); }}
                  required
                  aria-required="true"
                >
                  <option value="">Select category…</option>
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Specific Item <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none transition-all appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_12px_center]"
                  value={item}
                  onChange={(e) => setItem(e.target.value)}
                  disabled={!category}
                  required
                  aria-required="true"
                >
                  <option value="">{category ? 'Select item…' : 'Select category first…'}</option>
                  {availableItems.map(d => <option key={d.id} value={d.itemName}>{d.itemName}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Request Type <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {['New', 'Replacement', 'Repair', 'Upgrade'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setReqType(t)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all ${reqType === t ? 'bg-[#eff4ff] border-[#2563eb] text-[#2563eb]' : 'border-[#e2e8f0] text-slate-400 hover:border-[#2563eb] hover:text-[#2563eb]'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Delivery Method</label>
                <div className="flex flex-wrap gap-2">
                  {['Home Delivery', 'Facility Pickup', 'Ship to Provider'].map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDelivery(d)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all ${delivery === d ? 'bg-[#eff4ff] border-[#2563eb] text-[#2563eb]' : 'border-[#e2e8f0] text-slate-400 hover:border-[#2563eb] hover:text-[#2563eb]'}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Special Features / Accessories</label>
              <textarea 
                className="w-full p-4 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none min-h-[100px] transition-all"
                placeholder="List any accessories, sizing requirements, or customizations needed…"
                value={specialFeatures}
                onChange={(e) => setSpecialFeatures(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* --- CARD 3: Clinical Details --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Clinical Details</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="dme-icd10">
              <ICD10Field
                id="dme-icd10-primary"
                label="Primary Diagnosis (ICD-10)"
                value={icd10}
                onChange={(code) => { setIcd10(code); setErrors(p => ({ ...p, icd10: '' })); }}
                required
                error={errors.icd10}
                placeholder="Search by code or description (e.g. M17.1)"
              />
              <ICD10Field
                id="dme-icd10-secondary"
                label="Secondary Diagnosis (ICD-10)"
                value={secondaryIcd10}
                onChange={setSecondaryIcd10}
                placeholder="Optional additional diagnosis"
              />
            </div>

            <div className="flex flex-col gap-1.5" id="dme-justification">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Justification / Limitation <span className="text-red-500">*</span></label>
              <textarea
                className={`w-full p-4 border-[1.5px] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none min-h-[100px] transition-all ${errors.justification ? 'border-red-400' : 'border-[#e2e8f0]'}`}
                placeholder="Describe how condition impairs function and why equipment is necessary…"
                value={justification}
                onChange={(e) => { setJustification(e.target.value); setErrors(p => ({ ...p, justification: '' })); }}
                aria-invalid={!!errors.justification}
              />
              <FieldError msg={errors.justification} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Date of Rx <span className="text-red-500">*</span></label>
                <input type="date" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none" value={prescriptionDate} onChange={(e) => setPrescriptionDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Length of Need</label>
                <select className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none" value={lengthOfNeed} onChange={(e) => setLengthOfNeed(e.target.value)}>
                  <option value="">Select…</option>
                  <option>1 Month</option><option>3 Months</option><option>6 Months</option><option>12 Months</option><option>Lifetime</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Prior Auth Status</label>
                <select className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] outline-none" value={priorAuth} onChange={(e) => setPriorAuth(e.target.value)}>
                  <option value="">Select…</option>
                  <option>Not Required</option><option>Pending</option><option>Approved</option><option>Denied</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span id="dme-urgency-label" className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Urgency Level <span className="text-red-500" aria-hidden="true">*</span></span>
              <div role="group" aria-labelledby="dme-urgency-label" className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Routine', color: 'teal', desc: '5–7 days' },
                  { label: 'Urgent', color: 'amber', desc: '48 hrs' },
                  { label: 'Critical', color: 'red', desc: 'Same-day' }
                ].map(u => (
                  <button
                    key={u.label}
                    type="button"
                    aria-pressed={urgency === u.label}
                    onClick={() => setUrgency(u.label)}
                    className={`p-3 border-[1.5px] rounded-2xl text-left transition-all group ${
                      urgency === u.label
                      ? u.color === 'teal' ? 'bg-[#f0fdfa] border-[#0d9488]' : u.color === 'amber' ? 'bg-[#fffbeb] border-[#d97706]' : 'bg-[#fff5f5] border-[#dc2626]'
                      : 'border-[#e2e8f0] hover:shadow-md'
                    }`}
                  >
                    <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                      urgency === u.label
                      ? u.color === 'teal' ? 'text-[#0d9488]' : u.color === 'amber' ? 'text-[#d97706]' : 'text-[#dc2626]'
                      : 'text-slate-400'
                    }`}>{u.label}</div>
                    <div className="text-[0.7rem] text-slate-500">{u.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- CARD 4: Authorization --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Authorization</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-4">
            <div role="group" aria-label="Authorization consents" className="space-y-2">
              {[
                "I certify the clinical information provided is accurate and complete to the best of my knowledge.",
                "I authorize release of medical records necessary to process this DME request and insurance claim.",
                "Patient has been informed and has consented to this equipment request."
              ].map((text, i) => (
                <button
                  key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={consents[i]}
                  onClick={() => toggleConsent(i)}
                  className={`w-full flex items-start gap-4 p-3 rounded-xl border-[1.5px] text-left text-[0.82rem] transition-all group ${consents[i] ? 'bg-[#f0fdfa] border-[#0d9488] text-[#162d4e]' : 'border-[#e2e8f0] text-slate-500 hover:border-[#2563eb] hover:text-[#0f172a]'}`}
                >
                  <div aria-hidden="true" className={`w-4.5 h-4.5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 border-2 transition-all ${consents[i] ? 'bg-[#0d9488] border-[#0d9488]' : 'bg-white border-[#e2e8f0] group-hover:border-[#2563eb]'}`}>
                    {consents[i] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span>{text}</span>
                </button>
              ))}
            </div>

            <hr className="border-[#e2e8f0]" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Requesting Clinician / Provider <span className="text-red-500">*</span></label>
                <input type="text" className="w-full px-4 py-2.5 bg-[#f0f4f8] border-none rounded-xl text-sm font-bold" value={user.displayName} readOnly />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Date Signed <span className="text-red-500">*</span></label>
                <input type="text" className="w-full px-4 py-2.5 bg-[#f0f4f8] border-none rounded-xl text-sm font-bold" value={new Date().toLocaleDateString()} readOnly />
              </div>
            </div>

            <div className="flex flex-col gap-1.5" id="dme-signed">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Electronic Signature <span className="text-red-500">*</span></label>
              <button
                type="button"
                onClick={() => { setSigned(true); setErrors(p => ({ ...p, signed: '', consents: '' })); }}
                className={`w-full h-20 rounded-xl border-[1.5px] flex items-center justify-center transition-all ${signed ? 'bg-[#f0fdfa] border-[#0d9488] text-[#0d9488] font-bold' : errors.signed ? 'bg-red-50 border-red-400 text-red-400 italic' : 'bg-[#f0f4f8] border-dashed border-[#e2e8f0] text-slate-400 italic hover:border-[#2563eb]'}`}
              >
                {signed ? `✓ Signed electronically — ${user.displayName}` : 'Click here to sign electronically'}
              </button>
              <FieldError msg={errors.signed ?? errors.consents} />
            </div>
          </div>
        </section>

        {/* --- SUBMIT FOOTER --- */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-xl flex flex-col md:flex-row items-center justify-start gap-12 animate-[rise_0.35s_0.25s_ease_both]">
          <div className="text-sm">
            <span className="font-bold text-[#0f172a]">Ready to submit?</span>
            <p className="text-slate-500">This request will route to your DME coordinator. You'll receive a confirmation email.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button type="button" className="px-8 py-3 border-[1.5px] border-[#e2e8f0] rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors">Save Draft</button>
            <button
              disabled={loading || !selectedPatient || !signed}
              type="submit"
              aria-busy={loading}
              className="px-10 py-3 bg-gradient-to-br from-[#2563eb] to-[#0e1f38] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50 disabled:translate-y-0"
            >
              {loading ? 'Submitting…' : 'Submit Request →'}
            </button>
          </div>
        </div>
      </form>

    </div>
  );
};
