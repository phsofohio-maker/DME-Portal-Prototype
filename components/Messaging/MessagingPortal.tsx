
import React, { useState, useEffect, useRef } from 'react';
import { Staff, Communication } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { ContactSkeleton } from '../ui/LoadingSkeleton';

export const MessagingPortal: React.FC<{ currentUser: Staff }> = ({ currentUser }) => {
  const [contacts, setContacts] = useState<Staff[]>([]);
  const [contactsLoading, setContactsLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<Staff | null>(null);
  const [messages, setMessages] = useState<Communication[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load contacts once (async — replaces the synchronous prototype call)
  useEffect(() => {
    firebaseService.getAllStaff().then((allStaff) => {
      setContacts(allStaff.filter((s) => s.uid !== currentUser.uid));
      setContactsLoading(false);
    });
  }, [currentUser.uid]);

  // Real-time message subscription — replaces 1-second setInterval polling
  useEffect(() => {
    if (!selectedContact) {
      setMessages([]);
      return;
    }
    const unsubscribe = firebaseService.subscribeToMessagesBetween(
      currentUser.uid,
      selectedContact.uid,
      setMessages
    );
    return unsubscribe;
  }, [selectedContact, currentUser.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContact || !newMessage.trim()) return;

    await firebaseService.sendMessage({
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      recipientId: selectedContact.uid,
      recipientName: selectedContact.displayName,
      messageType: 'clinical',
      messageBody: newMessage.trim(),
    });

    setNewMessage('');
    // No manual refresh needed — onSnapshot fires automatically
  };

  const filteredContacts = contacts.filter(c => 
    c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden h-[calc(100vh-160px)] min-h-[500px] animate-[rise_0.3s_ease_both]">
      {/* Sidebar: Contacts */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-100 bg-white">
          <h3 className="font-bold text-slate-800 mb-3 text-lg serif">Staff Directory</h3>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm border-none outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" role="list" aria-label="Staff directory">
          {contactsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <ContactSkeleton key={i} />)
          ) : filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm" role="status">
              <p>No contacts found.</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.uid}
                onClick={() => setSelectedContact(contact)}
                role="listitem"
                aria-pressed={selectedContact?.uid === contact.uid}
                aria-label={`Message ${contact.displayName}, ${contact.role.replace('_', ' ')}`}
                className={`w-full p-4 flex items-center gap-3 transition-all border-b border-slate-100/50 ${selectedContact?.uid === contact.uid ? 'bg-white shadow-sm z-10 scale-[1.02] border-l-4 border-l-blue-600' : 'hover:bg-white/60 opacity-80 hover:opacity-100'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm ${selectedContact?.uid === contact.uid ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {contact.displayName.charAt(0)}
                </div>
                <div className="text-left overflow-hidden">
                  <p className={`font-bold text-sm truncate ${selectedContact?.uid === contact.uid ? 'text-slate-900' : 'text-slate-600'}`}>
                    {contact.displayName}
                  </p>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    {contact.role.replace('_', ' ')}
                  </p>
                </div>
                {contact.status === 'active' && (
                  <div className="ml-auto w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200"></div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main: Conversation */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedContact ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                  {selectedContact.displayName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 leading-none">{selectedContact.displayName}</h4>
                  <p className="text-[10px] text-green-600 font-bold mt-1 uppercase tracking-tighter flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    Secure Session Active
                  </p>
                </div>
              </div>
              <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-100 text-[10px] font-bold flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                HIPAA COMPLIANT CHANNEL
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30"
            >
              <div className="text-center pb-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-4 py-1 rounded-full border border-slate-100">
                  Conversation started
                </span>
              </div>

              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                  <svg className="w-12 h-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  <p className="text-sm italic">No clinical updates exchanged yet.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.senderId === currentUser.uid ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] group`}>
                      <div className={`p-4 rounded-2xl text-sm shadow-sm transition-all ${msg.senderId === currentUser.uid ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'}`}>
                        {msg.messageBody}
                      </div>
                      <p className={`text-[9px] mt-1 font-bold text-slate-400 px-1 ${msg.senderId === currentUser.uid ? 'text-right' : 'text-left'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-100 bg-white">
              <div className="flex gap-3">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a clinical update or coordination message..."
                  className="flex-1 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
                />
                <button 
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  Send
                </button>
              </div>
              <p className="text-[9px] text-slate-400 mt-3 text-center uppercase tracking-widest font-semibold italic">
                Logs are archived for clinical review and audit.
              </p>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/20">
            <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-blue-100/50">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
            </div>
            <h3 className="text-xl font-bold text-slate-800 serif">Staff Communication Portal</h3>
            <p className="text-slate-500 max-w-sm mt-3 text-sm">
              Select a colleague from the staff directory to begin clinical coordination in a HIPAA-compliant environment.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-8 w-full max-w-md">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Security</p>
                <p className="text-xs text-slate-500">End-to-end audit trail for every message.</p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Reliability</p>
                <p className="text-xs text-slate-500">Real-time alerts for incoming clinical updates.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
