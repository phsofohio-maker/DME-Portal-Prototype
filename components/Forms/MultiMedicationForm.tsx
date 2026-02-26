
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MOCK_PATIENTS } from '../../services/mockData';
import { Staff } from '../../types';
import { firebaseService } from '../../services/firebaseService';

interface MedicationRow {
  id: number;
  drug: any | null;
  strength: string;
  sig: string;
  quantity: string;
  refills: string;
  route: string;
  daysSupply: string;
  indication: string;
  notes: string;
  searchQuery: string;
  isDropdownOpen: boolean;
  isLoading: boolean;
  results: any[];
  extraInfo: any | null;
}

interface MultiMedicationFormProps {
  user: Staff;
  onSuccess: () => void;
}

export const MultiMedicationForm: React.FC<MultiMedicationFormProps> = ({ user, onSuccess }) => {
  // --- Patient State ---
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = useState(false);

  // --- Medications State ---
  const [meds, setMeds] = useState<MedicationRow[]>([]);
  const [idCounter, setIdCounter] = useState(1);
  const [apiStatus, setApiStatus] = useState<'loading' | 'live' | 'error'>('loading');
  const [apiLabel, setApiLabel] = useState('Connecting to RxNorm...');

  // --- Shared Clinical State ---
  const [primaryIcd10, setPrimaryIcd10] = useState('');
  const [secondaryIcd10, setSecondaryIcd10] = useState('');
  const [rxDate, setRxDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [urgency, setUrgency] = useState('Routine');

  // --- Auth State ---
  const [consents, setConsents] = useState<boolean[]>([false, false, false]);
  const [signed, setSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchTimers = useRef<{ [key: number]: any }>({});

  // --- RxNorm API Check ---
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

  // --- Med Row Management ---
  const addMedRow = () => {
    if (meds.length >= 10) return;
    const newRow: MedicationRow = {
      id: idCounter,
      drug: null,
      strength: '',
      sig: '',
      quantity: '',
      refills: '0',
      route: 'Oral (PO)',
      daysSupply: '30 days',
      indication: '',
      notes: '',
      searchQuery: '',
      isDropdownOpen: false,
      isLoading: false,
      results: [],
      extraInfo: null
    };
    setMeds([...meds, newRow]);
    setIdCounter(idCounter + 1);
  };

  const removeMedRow = (id: number) => {
    setMeds(meds.filter(m => m.id !== id));
    if (searchTimers.current[id]) clearTimeout(searchTimers.current[id]);
  };

  const updateMedRow = (id: number, updates: Partial<MedicationRow>) => {
    setMeds(prevMeds => prevMeds.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  // --- Per-row Search Logic ---
  const handleDrugSearch = (id: number, query: string) => {
    // Immediately update text so typing feels native
    updateMedRow(id, { searchQuery: query });

    if (searchTimers.current[id]) clearTimeout(searchTimers.current[id]);

    if (query.length < 2) {
      updateMedRow(id, { results: [], isDropdownOpen: false, isLoading: false });
      return;
    }

    searchTimers.current[id] = setTimeout(async () => {
      updateMedRow(id, { isLoading: true });
      try {
        const url = `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(query)}&ef=STRENGTHS_AND_FORMS,RXCUIS&maxList=10`;
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

        updateMedRow(id, { results, isDropdownOpen: true, isLoading: false });
      } catch (err) {
        updateMedRow(id, { isLoading: false });
      }
    }, 400);
  };

  const selectRowDrug = async (id: number, drug: any) => {
    let extra = null;
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
        extra = {
          rxcui,
          tty: ttyData?.properties?.tty || '—',
          schedule: getProp('SCHEDULE'),
          synonym: getProp('Prescribable Synonym') || getProp('RxNorm Synonym')
        };
      } catch (err) {}
    }

    updateMedRow(id, {
      drug,
      searchQuery: drug.name,
      isDropdownOpen: false,
      extraInfo: extra,
      strength: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return alert('Please select a patient');
    if (meds.length === 0) return alert('Please add at least one medication');
    if (meds.some(m => !m.drug)) return alert('Please select a drug for all medication rows');
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
          kind: 'multi_medication' as const,
          batchType: 'multi-medication',
          medications: meds.map(m => ({
            name: m.drug.name,
            strength: m.strength,
            sig: m.sig,
            quantity: m.quantity,
            refills: m.refills,
            route: m.route,
            daysSupply: m.daysSupply,
            indication: m.indication,
            notes: m.notes,
            rxcui: m.drug.rxcuis[0]
          })),
          sharedClinical: { primaryIcd10, secondaryIcd10, rxDate, startDate, generalNotes, urgency },
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

  const batchSummary = meds.filter(m => m.drug).map(m => m.drug.name.split(' ')[0]);

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-[#0e1f38] serif">Multi-Medication Request</h2>
        <p className="text-sm text-slate-500 mt-1">Select a patient and add up to 10 medications in one batch — each searched live via RxNorm.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* --- CARD 1: Patient Lookup --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] animate-[rise_0.35s_ease_both] relative z-[100]">
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
                            <p className="text-xs text-slate-500">DOB: {p.dob} · {p.mrn}</p>
                          </div>
                          <div className="px-2 py-1 bg-[#eff4ff] text-[#2563eb] rounded-md text-[0.72rem] font-bold">{p.insurance}</div>
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
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold text-white shadow-sm" style={{ backgroundColor: selectedPatient.color }}>
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
                    <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Preferred Pharmacy</span><span className="text-sm font-medium">{selectedPatient.pharmacy}</span></div>
                    <div className="flex flex-col col-span-2"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Allergies</span><span className={`text-sm font-bold ${selectedPatient.allergies !== 'None on file' ? 'text-red-600' : 'text-slate-600'}`}>{selectedPatient.allergies}</span></div>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-[#2563eb] font-bold text-xs hover:bg-[#2563eb]/10 px-2 py-1 rounded transition-colors">✕ Change</button>
              </div>
            )}
          </div>
        </section>

        {/* --- CARD 2: Medications --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] animate-[rise_0.35s_ease_both] relative z-[90]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0fdfa] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M3 9h18m-18 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9m-9 3v5m-3-2.5h6"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Medications</h3>
            <span className="text-[0.68rem] font-bold tracking-wider px-3 py-1 rounded-full bg-[#f0fdfa] text-[#0d9488] border border-[#99f6e4] uppercase">{meds.length} added</span>
            <button
              type="button"
              onClick={addMedRow}
              disabled={meds.length >= 10}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#f0fdfa] text-[#0d9488] border-[1.5px] border-[#5eead4] text-[0.75rem] font-bold hover:bg-[#0d9488] hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Medication
            </button>
          </div>
          
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
               <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${apiStatus === 'live' ? 'text-green-600 bg-green-50' : 'text-slate-400 bg-slate-50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'live' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                {apiLabel}
              </div>
            </div>

            {batchSummary.length > 1 && (
              <div className="flex flex-wrap items-center gap-2 p-3 mb-6 bg-[#0e1f38] rounded-xl animate-[rise_0.25s_ease_both]">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mr-2 ml-1">Rx Batch:</span>
                {batchSummary.map((name, i) => (
                  <span key={i} className="text-[0.72rem] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/80 border border-white/10 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4]"></span>
                    {name}
                  </span>
                ))}
              </div>
            )}

            {meds.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-[#e2e8f0] rounded-2xl text-center text-slate-400 text-sm">
                 <svg className="w-10 h-10 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M3 9h18m-18 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9m-9 3v5m-3-2.5h6"/></svg>
                No medications added yet.<br/>Click <strong className="text-slate-600">Add Medication</strong> to get started.
              </div>
            ) : (
              <div className="space-y-6">
                {meds.map((row, index) => (
                  <div 
                    key={row.id} 
                    className={`border-[1.5px] rounded-2xl transition-all duration-300 animate-[rise_0.25s_ease_both] ${row.drug ? 'border-[#5eead4] bg-gradient-to-b from-[#f0fdfa] to-white' : 'border-[#e2e8f0] bg-white'} ${row.isDropdownOpen ? 'z-50 relative' : 'z-0 relative'}`}
                  >
                    <div className={`px-4 py-3 flex items-center gap-3 border-b border-[#e2e8f0] rounded-t-2xl ${row.drug ? 'bg-[#0d9488]/5 border-[#ccfbf1]' : 'bg-slate-50'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[0.72rem] font-bold text-white ${row.drug ? 'bg-[#0d9488]' : 'bg-[#0e1f38]'}`}>
                        {index + 1}
                      </div>
                      <span className={`text-[0.82rem] font-bold ${row.drug ? 'text-[#0d9488]' : 'text-[#0e1f38]'}`}>
                        {row.drug ? row.drug.name.split(' ').slice(0,3).join(' ') : `Medication ${index + 1}`}
                      </span>
                      <button type="button" onClick={() => removeMedRow(row.id)} className="ml-auto w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Row Drug Search */}
                      <div className="relative">
                        {!row.drug ? (
                          <div className="flex items-center border-[1.5px] border-[#e2e8f0] bg-[#f0f4f8] rounded-xl overflow-hidden focus-within:border-[#0d9488] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0d9488]/5 transition-all">
                            <div className="px-3 py-2 border-r border-[#e2e8f0] text-[9px] font-bold text-slate-400 tracking-widest uppercase bg-white">RxNorm</div>
                            <input
                              type="text"
                              placeholder="Search generic name, brand, or description…"
                              className="flex-1 px-3 py-2.5 outline-none text-sm bg-transparent"
                              value={row.searchQuery}
                              onChange={(e) => handleDrugSearch(row.id, e.target.value)}
                            />
                            {row.isLoading && (
                              <div className="pr-3">
                                <div className="w-3.5 h-3.5 border-2 border-[#0d9488]/20 border-t-[#0d9488] rounded-full animate-spin"></div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 p-3 border-[1.5px] border-[#5eead4] bg-[#f0fdfa] rounded-xl animate-[rise_0.2s_ease_both]">
                             <div className="w-8 h-8 rounded-lg bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-[#0d9488]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M3 9h18m-18 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9m-9 3v5m-3-2.5h6"/></svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[0.85rem] font-bold text-[#0e1f38] truncate">{row.drug.name}</div>
                                <div className="flex gap-2 mt-0.5">
                                  <span className="text-[10px] font-bold text-[#0d9488]">RxCUI: {row.drug.rxcuis[0]}</span>
                                  {row.drug.strengths.length > 0 && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{row.drug.strengths.length} Strengths</span>}
                                </div>
                              </div>
                              <button type="button" onClick={() => updateMedRow(row.id, { drug: null, searchQuery: '', extraInfo: null })} className="text-[#0d9488] text-[0.7rem] font-bold px-2 py-1 hover:bg-[#0d9488]/10 rounded">✕ Change</button>
                          </div>
                        )}

                        {row.isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-2xl z-[150] overflow-hidden max-h-64 overflow-y-auto">
                            {row.results.length > 0 ? (
                              row.results.map((d, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0fdfa] transition-colors text-left border-b last:border-0 border-[#e2e8f0]"
                                  onClick={() => selectRowDrug(row.id, d)}
                                >
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase shrink-0 ${d.type === 'generic' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                                    {d.type.charAt(0)}
                                  </span>
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-[#0f172a]">{d.name}</p>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">{d.rxcuis[0]}</div>
                                </button>
                              ))
                            ) : (
                              <div className="p-4 text-center text-sm text-slate-400">No results found.</div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Row Specific Details */}
                      {row.drug && (
                        <div className="space-y-4 animate-[rise_0.25s_ease_both]">
                          {row.drug.strengths.length > 0 && (
                            <div>
                              <label className="text-[10px] font-bold text-[#374151] uppercase tracking-wider mb-2 block">Strength / Dose Form <span className="text-red-500">*</span></label>
                              <div className="flex flex-wrap gap-1.5">
                                {row.drug.strengths.map((s: string) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => updateMedRow(row.id, { strength: s })}
                                    className={`px-3 py-1.5 rounded-full text-[0.76rem] font-semibold border-[1.5px] transition-all ${row.strength === s ? 'bg-[#f0fdfa] border-[#0d9488] text-[#0d9488]' : 'border-[#e2e8f0] text-slate-400 hover:border-[#0d9488]'}`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {row.extraInfo && (
                            <div className="border border-[#e2e8f0] rounded-xl overflow-hidden">
                              <div className="bg-[#0e1f38] px-3 py-1.5 flex items-center gap-2">
                                <svg className="w-3 h-3 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                <span className="text-[9px] text-white/70 font-bold uppercase tracking-widest">RxNorm Properties</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[#e2e8f0]">
                                <div className="p-2.5"><p className="text-[8px] uppercase font-bold text-slate-400">RxCUI</p><p className="text-[10px] font-bold text-slate-700 font-mono">{row.extraInfo.rxcui}</p></div>
                                <div className="p-2.5"><p className="text-[8px] uppercase font-bold text-slate-400">DEA Sched</p><p className="text-[10px] font-bold text-slate-700">{row.extraInfo.schedule !== '—' ? 'Sched ' + row.extraInfo.schedule : 'Non-controlled'}</p></div>
                                <div className="p-2.5 col-span-2"><p className="text-[8px] uppercase font-bold text-slate-400">Synonym</p><p className="text-[9px] font-bold text-slate-700 truncate">{row.extraInfo.synonym}</p></div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sig (Instructions) <span className="text-red-500">*</span></label>
                              <input type="text" placeholder="e.g. 1 tab PO daily" className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none focus:border-[#2563eb]" value={row.sig} onChange={e => updateMedRow(row.id, { sig: e.target.value })} required />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantity <span className="text-red-500">*</span></label>
                              <input type="number" placeholder="30" className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none focus:border-[#2563eb]" value={row.quantity} onChange={e => updateMedRow(row.id, { quantity: e.target.value })} required />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Refills</label>
                              <select className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none" value={row.refills} onChange={e => updateMedRow(row.id, { refills: e.target.value })}>
                                <option>0</option><option>1</option><option>2</option><option>3</option><option>5</option><option>11 (1 yr)</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Route</label>
                              <select className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none" value={row.route} onChange={e => updateMedRow(row.id, { route: e.target.value })}>
                                <option>Oral (PO)</option><option>Sublingual (SL)</option><option>Topical</option><option>Inhaled</option><option>Injection (IM/SC)</option><option>IV / Infusion</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Days Supply</label>
                              <select className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none" value={row.daysSupply} onChange={e => updateMedRow(row.id, { daysSupply: e.target.value })}>
                                <option>30 days</option><option>60 days</option><option>90 days</option><option>As directed</option>
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Indication</label>
                              <input type="text" placeholder="e.g. Hypertension" className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none focus:border-[#2563eb]" value={row.indication} onChange={e => updateMedRow(row.id, { indication: e.target.value })} />
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes for this med</label>
                            <textarea rows={2} className="px-3 py-2 border-[1.5px] border-[#e2e8f0] rounded-xl text-[0.85rem] outline-none focus:border-[#2563eb] resize-none" placeholder="Medication specific notes…" value={row.notes} onChange={e => updateMedRow(row.id, { notes: e.target.value })} />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* --- CARD 3: Shared Clinical Details --- */}
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both] relative z-[80]">
          <div className="px-6 py-4 border-b border-[#e2e8f0] flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] flex items-center justify-center">
              <svg className="w-4 h-4 text-[#2563eb]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <h3 className="text-[0.88rem] font-bold text-[#0e1f38]">Shared Clinical Details</h3>
            <span className="ml-auto text-[0.68rem] font-bold tracking-wider uppercase px-2 py-1 rounded-full bg-red-100 text-red-800">Required</span>
          </div>
          
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Primary ICD-10 Diagnosis <span className="text-red-500">*</span></label>
                <input type="text" placeholder="e.g. E11.9 — Type 2 Diabetes" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={primaryIcd10} onChange={e => setPrimaryIcd10(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Secondary Diagnosis</label>
                <input type="text" placeholder="Additional ICD-10 code" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb]" value={secondaryIcd10} onChange={e => setSecondaryIcd10(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Prescribing Date <span className="text-red-500">*</span></label>
                <input type="date" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none" value={rxDate} onChange={e => setRxDate(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">Desired Start Date</label>
                <input type="date" className="w-full px-4 py-2.5 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-[#374151] tracking-wider">General Notes / Batch Instructions</label>
              <textarea placeholder="Notes applying to this entire batch…" className="w-full p-4 border-[1.5px] border-[#e2e8f0] rounded-xl text-sm outline-none focus:border-[#2563eb] min-h-[80px]" value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} />
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
        <section className="bg-white rounded-2xl shadow-lg border border-[#e2e8f0] overflow-hidden animate-[rise_0.35s_ease_both] relative z-[10]">
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
                "I certify all medications listed are clinically appropriate and accurate.",
                "I have reviewed patient allergy/medication list for contraindications.",
                "Patient has been counseled on all medications and potential side effects."
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
            <p className="text-slate-500">All medications will be sent to the pharmacy and logged in the record as a single batch.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button type="button" className="px-8 py-3 border-[1.5px] border-[#e2e8f0] rounded-xl font-bold text-slate-500 hover:bg-slate-50">Save Draft</button>
            <button
              disabled={isSubmitting || !selectedPatient || meds.length === 0 || !signed || meds.some(m => !m.drug)}
              type="submit"
              className="px-10 py-3 bg-gradient-to-br from-[#2563eb] to-[#0e1f38] text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0"
            >
              {isSubmitting ? 'Sending Batch...' : 'Send to Pharmacy →'}
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
