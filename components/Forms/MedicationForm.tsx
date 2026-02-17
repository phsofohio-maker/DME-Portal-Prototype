
import React, { useState, useEffect, useMemo } from 'react';
import { MOCK_PATIENTS } from '../../services/mockData';
import { Staff } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface MedicationFormProps {
  user: Staff;
  onSuccess: () => void;
}

export const MedicationForm: React.FC<MedicationFormProps> = ({ user, onSuccess }) => {
  // --- Form State: Patient ---
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // --- Form State: Medication (RxNorm API) ---
  const [drugSearchQuery, setDrugSearchQuery] = useState('');
  const [isDrugDropdownOpen, setIsDrugDropdownOpen] = useState(false);
  const [isDrugLoading, setIsDrugLoading] = useState(false);
  const [drugResults, setDrugResults] = useState<any[]>([]);
  const [selectedDrug, setSelectedDrug] = useState<any>(null);
  const [apiStatus, setApiStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const [apiLabel, setApiLabel] = useState('Connecting to RxNorm...');
  const [drugExtraInfo, setDrugExtraInfo] = useState<any>(null);
  const [selectedStrength, setSelectedStrength] = useState('');

  // --- Form State: Clinical ---
  const [icd10, setIcd10] = useState('');
  const [indication, setIndication] = useState('');
  const [sig, setSig] = useState('');
  const [quantity, setQuantity] = useState('');
  const [refills, setRefills] = useState('0 (No refills)');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysSupply, setDaysSupply] = useState('30 days');
  const [route, setRoute] = useState('Oral (PO)');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState('Routine');

  // --- Form State: Auth ---
  const [consents, setConsents] = useState<boolean[]>([false, false, false]);
  const [signed, setSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- RxNorm API Initialization ---
  useEffect(() => {
    const checkApi = async () => {
      try {
        const r = await fetch('https://rxnav.nlm.nih.gov/REST/version.json');
        if (!r.ok) throw new Error();
        const d = await r.json();
        setApiStatus('live');
        setApiLabel(`RxNorm API live · Release ${d.rxnormdata?.version || 'current'}`);
      } catch {
        setApiStatus('error');
        setApiLabel('RxNorm API unavailable');
      }
    };
    checkApi();
  }, []);

  // --- Patient Search Logic ---
  const filteredPatients = useMemo(() => {
    if (!patientSearchQuery.trim()) return [];
    const q = patientSearchQuery.toLowerCase();
    return MOCK_PATIENTS.filter(p => 
      p.name.toLowerCase().includes(q) || 
      p.mrn.toLowerCase().includes(q)
    );
  }, [patientSearchQuery]);

  // --- Medication Search Logic ---
  useEffect(() => {
    if (drugSearchQuery.length < 2 || selectedDrug) {
      setDrugResults([]);
      setIsDrugDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsDrugLoading(true);
      try {
        const url = `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(drugSearchQuery)}&ef=STRENGTHS_AND_FORMS,RXCUIS&maxList=12`;
        const res = await fetch(url);
        const data = await res.json();
        const names = data[1] || [];
        const extras = data[2] || {};
        const strengths = extras['STRENGTHS_AND_FORMS'] || [];
        const rxcuis = extras['RXCUIS'] || [];

        const results = names.map((name: string, i: number) => ({
          name,
          strengths: strengths[i] || [],
          rxcuis: rxcuis[i] || [],
          type: name.split(' ')[0] === name.split(' ')[0].toLowerCase() ? 'generic' : 'brand'
        }));

        setDrugResults(results);
        setIsDrugDropdownOpen(true);
      } catch (err) {
        console.error("Failed to fetch drugs", err);
      } finally {
        setIsDrugLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [drugSearchQuery, selectedDrug]);

  const handleSelectDrug = async (drug: any) => {
    setSelectedDrug(drug);
    setDrugSearchQuery(drug.name);
    setIsDrugDropdownOpen(false);
    
    if (drug.rxcuis[0]) {
      try {
        const rxcui = drug.rxcuis[0];
        const [propsRes, ttyRes] = await Promise.all([
          fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/allProperties.json?prop=ALL`),
          fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${rxcui}/properties.json`)
        ]);
        const propsData = await propsRes.json();
        const ttyData = await ttyRes.json();
        const props = propsData?.propConceptGroup?.propConcept || [];
        const getProp = (name: string) => props.find((p: any) => p.propName === name)?.propValue || '—';
        
        setDrugExtraInfo({
          rxcui,
          tty: ttyData?.properties?.tty || '—',
          schedule: getProp('SCHEDULE'),
          synonym: getProp('Prescribable Synonym') || getProp('RxNorm Synonym')
        });
      } catch (err) {
        console.error("Failed to fetch detailed drug info", err);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert('Please select a patient');
    if (!selectedDrug) return alert('Please select a medication');
    if (!signed) return alert('Please sign the authorization');

    setIsSubmitting(true);
    try {
      await firebaseService.submitRequest({
        type: 'medication',
        submitterId: user.uid,
        submitterName: user.displayName,
        patientName: selectedPatient.name,
        patientId: selectedPatient.mrn,
        details: {
          medication: { 
            name: selectedDrug.name, 
            strength: selectedStrength, 
            rxcui: selectedDrug.rxcuis[0],
            extra: drugExtraInfo
          },
          clinical: { icd10, indication, sig, quantity, refills, startDate, daysSupply, route, urgency },
          consents
        }
      });
      onSuccess();
    } catch (err) {
      alert('Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#0e1f38] serif">New Medication Request</h2>
        <p className="text-sm text-slate-500 mt-1">Select a patient, search for the medication via RxNorm, then provide clinical details.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* --- CARD 1: Patient Lookup --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] animate-[rise_0.35s_ease_both] relative z-[40]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Patient</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6">
            {!selectedPatient ? (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </div>
                <input
                  type="text"
                  placeholder="Search by name or MRN…"
                  className="w-full pl-11 pr-4 py-3 bg-[#f0f4f8] border-1.5 border-[#e2e8f0] rounded-xl outline-none focus:ring-2 focus:ring-[#2563eb]/10 focus:border-[#2563eb] transition-all"
                  value={patientSearchQuery}
                  onChange={(e) => {
                    setPatientSearchQuery(e.target.value);
                    setIsPatientDropdownOpen(true);
                  }}
                  onFocus={() => setIsPatientDropdownOpen(true)}
                />
                
                {isPatientDropdownOpen && patientSearchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-50 overflow-hidden">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#eff4ff] transition-colors text-left border-b last:border-0 border-[#e2e8f0]"
                          onClick={() => {
                            setSelectedPatient(p);
                            setIsPatientDropdownOpen(false);
                            setPatientSearchQuery('');
                          }}
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.color }}>
                            {p.initials}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-[#0f172a]">{p.name}</p>
                            <p className="text-xs text-slate-500">DOB: {p.dob} · {p.insurance}</p>
                          </div>
                          <div className="px-2 py-1 bg-[#eff4ff] text-[#2563eb] rounded-md text-[0.72rem] font-bold">{p.mrn}</div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">No patients found.</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="border-[1.5px] border-[#bfd4fd] bg-[#eff4ff] rounded-2xl p-5 flex gap-5 items-start animate-[rise_0.25s_ease_both]">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white" style={{ backgroundColor: selectedPatient.color }}>
                  {selectedPatient.initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg font-bold text-[#0e1f38] serif">{selectedPatient.name}</span>
                    <div className="flex gap-2">
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-white border border-[#bfd4fd] text-[#2563eb] font-bold">{selectedPatient.mrn}</span>
                      <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-500 font-bold">{selectedPatient.age} yrs</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-y-2">
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">DOB</span><span className="text-sm font-medium">{selectedPatient.dob}</span></div>
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pharmacy</span><span className="text-sm font-medium">{selectedPatient.pharmacy || 'N/A'}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Allergies</span><span className={`text-sm font-bold ${selectedPatient.allergies !== 'None on file' ? 'text-red-600' : 'text-slate-600'}`}>{selectedPatient.allergies}</span></div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-[#2563eb] font-bold text-xs hover:bg-[#2563eb]/10 px-2 py-1 rounded">✕ Change</button>
              </div>
            )}
          </div>
        </section>

        {/* --- CARD 2: Medication Search (RxNorm) --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] animate-[rise_0.35s_ease_both] relative z-[30]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M3 9h18m-18 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9m-9 3v5m-3-2.5h6"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Medication</h3>
            <span className={`ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full border ${apiStatus === 'live' ? 'bg-green-50 text-green-700 border-green-200' : apiStatus === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
              {apiStatus === 'live' ? 'Live API' : 'API Connecting...'}
            </span>
          </div>
          
          <div className="p-6">
            <div className="mb-4">
               <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${apiStatus === 'live' ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'live' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                {apiLabel}
              </div>
            </div>

            <div className="relative">
              {!selectedDrug ? (
                <div className="flex items-center border-[1.5px] border-[#e2e8f0] bg-[#f0f4f8] rounded-xl overflow-hidden focus-within:border-[#0d9488] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0d9488]/5 transition-all">
                  <div className="px-4 py-3 border-r border-[#e2e8f0] text-[10px] font-bold text-slate-400 tracking-widest uppercase bg-white">RxNorm</div>
                  <input
                    type="text"
                    placeholder="Search by generic name, brand, or description…"
                    className="flex-1 px-4 py-3 outline-none text-sm bg-transparent"
                    value={drugSearchQuery}
                    onChange={(e) => setDrugSearchQuery(e.target.value)}
                  />
                  {isDrugLoading && (
                    <div className="pr-4">
                      <div className="w-4 h-4 border-2 border-[#0d9488]/20 border-t-[#0d9488] rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-[#f0fdfa] border-[1.5px] border-[#5eead4] rounded-2xl p-5 flex gap-5 items-start animate-[rise_0.25s_ease_both]">
                  <div className="w-12 h-12 rounded-xl bg-[#0d9488]/10 flex items-center justify-center">
                    <svg className="w-6 h-6 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M3 9h18m-18 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9m-9 3v5m-3-2.5h6"/></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-[#0e1f38] serif">{selectedDrug.name}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-[#5eead4] text-[#0d9488] font-bold">RxCUI: {selectedDrug.rxcuis[0]}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${selectedDrug.type === 'generic' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-purple-50 text-purple-600 border border-purple-100'}`}>
                        {selectedDrug.type}
                      </span>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedDrug(null); setSelectedStrength(''); setDrugExtraInfo(null); }} className="text-[#0d9488] font-bold text-xs hover:bg-[#0d9488]/10 px-2 py-1 rounded">✕ Change</button>
                </div>
              )}

              {isDrugDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  {drugResults.length > 0 ? (
                    drugResults.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#f0fdfa] transition-colors text-left border-b last:border-0 border-[#e2e8f0]"
                        onClick={() => handleSelectDrug(d)}
                      >
                         <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${d.type === 'generic' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                          {d.type.charAt(0)}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-[#0f172a]">{d.name}</p>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{d.rxcuis[0]}</div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-slate-500">No drugs found.</div>
                  )}
                </div>
              )}
            </div>

            {selectedDrug && selectedDrug.strengths.length > 0 && (
              <div className="mt-6 animate-[rise_0.25s_ease_both]">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider mb-2 block">Select Strength / Dose Form <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {selectedDrug.strengths.map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSelectedStrength(s)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all ${selectedStrength === s ? 'bg-[#f0fdfa] border-[#0d9488] text-[#0d9488]' : 'border-[#e2e8f0] text-slate-400 hover:border-[#0d9488] hover:text-[#0d9488]'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {drugExtraInfo && (
              <div className="mt-6 border border-[#e2e8f0] rounded-xl overflow-hidden animate-[rise_0.25s_ease_both]">
                <div className="bg-[#0e1f38] px-4 py-2 flex items-center gap-2">
                  <svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span className="text-[10px] text-white/70 font-bold uppercase tracking-widest">RxNorm Properties</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e2e8f0]">
                  <div className="p-3"><p className="text-[9px] uppercase font-bold text-slate-400">RxCUI</p><p className="text-xs font-bold text-slate-700 font-mono">{drugExtraInfo.rxcui}</p></div>
                  <div className="p-3"><p className="text-[9px] uppercase font-bold text-slate-400">Term Type</p><p className="text-xs font-bold text-slate-700">{drugExtraInfo.tty}</p></div>
                  <div className="p-3"><p className="text-[9px] uppercase font-bold text-slate-400">DEA Schedule</p><p className="text-xs font-bold text-slate-700">{drugExtraInfo.schedule !== '—' ? 'Sched ' + drugExtraInfo.schedule : 'Non-controlled'}</p></div>
                  <div className="p-3"><p className="text-[9px] uppercase font-bold text-slate-400">Synonym</p><p className="text-[10px] font-bold text-slate-700 truncate" title={drugExtraInfo.synonym}>{drugExtraInfo.synonym}</p></div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* --- CARD 3: Clinical Details --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both] relative z-[10]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Clinical Details</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">ICD-10 Diagnosis <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. E11.9 — Type 2 Diabetes" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={icd10} onChange={e => setIcd10(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Indication <span className="text-red-500">*</span></label>
                <input type="text" placeholder="Reason for medication" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={indication} onChange={e => setIndication(e.target.value)} required />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Sig (Instructions) <span className="text-red-500">*</span></label>
                <input type="text" placeholder="1 tab PO daily" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={sig} onChange={e => setSig(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Quantity <span className="text-red-500">*</span></label>
                <input type="number" placeholder="30" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={quantity} onChange={e => setQuantity(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Refills</label>
                <select className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none" value={refills} onChange={e => setRefills(e.target.value)}>
                  <option>0 (No refills)</option><option>1</option><option>2</option><option>3</option><option>5</option><option>11 (1 year)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Start Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm" value={startDate} onChange={e => setStartDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Days Supply</label>
                <select className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm" value={daysSupply} onChange={e => setDaysSupply(e.target.value)}>
                  <option>30 days</option><option>60 days</option><option>90 days</option><option>As directed</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Route of Administration</label>
              <div className="flex flex-wrap gap-2">
                {['Oral (PO)', 'Sublingual (SL)', 'Topical', 'Inhaled', 'Injection (IM/SC)', 'IV / Infusion'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoute(r)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all ${route === r ? 'bg-[#eff4ff] border-[#2563eb] text-[#2563eb]' : 'border-[#e2e8f0] text-slate-400 hover:border-[#2563eb] hover:text-[#2563eb]'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Urgency <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Routine', color: 'teal', desc: '24–48 hrs' },
                  { label: 'Urgent', color: 'amber', desc: 'Same-day' },
                  { label: 'STAT', color: 'red', desc: 'Immediate' }
                ].map(u => (
                  <button
                    key={u.label}
                    type="button"
                    onClick={() => setUrgency(u.label)}
                    className={`p-3 border-[1.5px] rounded-2xl text-left transition-all ${
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
            <div className="w-8 h-8 rounded-lg bg-[#fffbeb] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#d97706]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Authorization & Signature</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              {[
                "I certify this medication is clinically appropriate and the information provided is accurate.",
                "I have reviewed the patient's allergy list and confirmed no known contraindications.",
                "Patient has been counseled on this medication and its potential side effects."
              ].map((text, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const next = [...consents];
                    next[i] = !next[i];
                    setConsents(next);
                  }}
                  className={`w-full flex items-start gap-4 p-3 rounded-xl border-[1.5px] text-left text-[0.82rem] transition-all group ${consents[i] ? 'bg-[#f0fdfa] border-[#0d9488] text-[#162d4e]' : 'border-[#e2e8f0] text-slate-500 hover:border-[#2563eb]'}`}
                >
                  <div className={`w-4.5 h-4.5 rounded flex-shrink-0 flex items-center justify-center mt-0.5 border-2 ${consents[i] ? 'bg-[#0d9488] border-[#0d9488]' : 'bg-white border-[#e2e8f0]'}`}>
                    {consents[i] && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span>{text}</span>
                </button>
              ))}
            </div>

            <hr className="border-[#e2e8f0]" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Prescribing Provider</label>
                <input type="text" className="w-full px-4 py-2.5 bg-[#f0f4f8] border-none rounded-xl text-sm font-bold" value={user.displayName} readOnly />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Date Signed</label>
                <input type="text" className="w-full px-4 py-2.5 bg-[#f0f4f8] border-none rounded-xl text-sm font-bold" value={new Date().toLocaleDateString()} readOnly />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSigned(true)}
              className={`w-full h-20 rounded-xl border-[1.5px] flex items-center justify-center transition-all ${signed ? 'bg-[#f0fdfa] border-[#0d9488] text-[#0d9488] font-bold' : 'bg-[#f0f4f8] border-dashed border-[#e2e8f0] text-slate-400 italic hover:border-[#2563eb]'}`}
            >
              {signed ? `✓ Signed electronically — ${user.displayName}` : 'Click here to sign electronically'}
            </button>
          </div>
        </section>

        {/* --- SUBMIT FOOTER --- */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e8f0] shadow-xl flex flex-col md:flex-row items-center justify-start gap-12 animate-[rise_0.35s_0.25s_ease_both]">
          <div className="text-sm">
            <span className="font-bold text-[#0f172a]">Ready to submit?</span>
            <p className="text-slate-500">This request will be sent to the pharmacy and logged in the record.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button type="button" className="px-8 py-3 border-[1.5px] border-[#e2e8f0] rounded-xl font-bold text-slate-500 hover:bg-slate-50">Save Draft</button>
            <button
              disabled={isSubmitting || !selectedPatient || !selectedDrug || !signed}
              type="submit"
              className="px-10 py-3 bg-gradient-to-br from-[#2563eb] to-[#0e1f38] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {isSubmitting ? 'Sending...' : 'Send to Pharmacy →'}
            </button>
          </div>
        </div>
      </form>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes rise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
};
