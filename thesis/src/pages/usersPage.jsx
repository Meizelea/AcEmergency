import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, Search, Filter, Mail, X, Eye, Truck } from 'lucide-react';

export default function UsersPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedUser, setSelectedUser] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // 🛡️ SECURITY GUARDRAIL: Pull authentication token from local storage
  const token = localStorage.getItem('ac_token');

  // Dynamic Hostname Binding for 0.0.0.0 network access
  const targetHostname = window.location.hostname || '127.0.0.1';

  useEffect(() => {
    // 🛡️ SECURITY GUARDRAIL: Redirect unauthenticated direct traffic out immediately
    if (!token) {
      navigate('/login');
      return;
    }

    const fetchUsers = async () => {
      try {
        // 🎯 NETWORK FIX: Dynamically bind to the current network IP instead of hardcoding localhost
        const response = await fetch(`http://${targetHostname}:8000/api/users/admin/users/`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Token ${token}`
          }
        });
        const data = await response.json();
        
        // Handle both plain array structures and paginated objects cleanly
        if (Array.isArray(data)) {
          setUsers(data);
        } else if (data && Array.isArray(data.results)) {
          setUsers(data.results);
        } else {
          setUsers([]);
        }
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to query user catalog parameters from database:", error);
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [token, navigate, targetHostname]);

  // 🛡️ SECURITY GUARDRAIL: Block layout rendering if authentication parameters are missing
  if (!token) {
    return <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center text-gray-400 font-bold">Redirecting to user directory database gateway...</div>;
  }

  // 👇 FILTER PROCESSING CHAIN: Excludes all administrators/staff members automatically
  const filteredUsers = users.filter(user => {
    if (!user) return false;

    // ⛔ EXCLUSION CONSTRAINT: If the user is staff or an admin, filter them out immediately
    const isStaffUser = user.is_staff === true || String(user.is_staff).toLowerCase() === 'true';
    if (isStaffUser) return false;

    // Capture name configurations flexibly for regular accounts
    const firstName = user.first_name || user.firstname || '';
    const lastName = user.last_name || user.lastname || '';
   
    const usernameStr = user.username || '';
    const fullName = `${firstName} ${lastName}`.toLowerCase();
    
    const emailStr = (user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    // Return search input matching configurations
    return (
      fullName.includes(query) || 
      emailStr.includes(query) || 
      usernameStr.toLowerCase().includes(query)
    );
  });

  const openViewModal = (user) => {
    setSelectedUser(user);
    setIsViewModalOpen(true);
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">

      {/* SIDEBAR CONTAINER WORKSPACE */}
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} /></div>
          
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} /></div>
          <div onClick={() => navigate('/analytics')}><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} /></div>
          <div onClick={() => navigate('/emergency-units')}><SidebarLink icon={<Truck size={24} />} label="Emergency Units" active={location.pathname === '/emergency-units'} /></div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#f0f0f0] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl relative">
          
          {/* CONTROL BAR HEADER */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span onClick={() => navigate('/dashboard')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/dashboard' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Dashboard</span>
                <span onClick={() => navigate('/reports')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/reports' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Reports</span>
                <span onClick={() => navigate('/analytics')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/analytics' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Analytics</span>
                <span onClick={() => navigate('/users')} className={`text-sm px-4 py-1 font-medium cursor-pointer transition-all ${location.pathname === '/users' ? 'bg-[#8b2323] px-5 py-1.5 rounded-md font-bold shadow-inner' : 'opacity-90 hover:opacity-100'}`}>Users</span>
                <span onClick={() => navigate('/emergency-units')} className="text-sm px-4 py-1 opacity-90 font-medium cursor-pointer hover:opacity-100 transition-opacity">Emergency Units</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin Gateway</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* TABLE DASHBOARD BODY METRICS */}
          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
                  <Search size={18} className="text-gray-400 ml-4" />
                  <input type="text" placeholder="Search user name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" />
                </div>
              </div>
            </div>

            {/* MASTER PROFILE DIRECTORY CARD LAYOUT */}
            <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="text-[#b32d2d]" size={22} />
                  <h2 className="font-bold text-xl text-gray-900">Registered Users Directory</h2>
                </div>
                <span className="text-sm text-gray-400 font-bold">{filteredUsers.length} Enrolled Users</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100/70 border-b border-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider">
                      <th className="py-4 px-6 w-32">Username</th>
                      <th className="py-4 px-6">Account Holder Name</th>
                      <th className="py-4 px-6">Email Address Link</th>
                      <th className="py-4 px-6">System Clearance</th>
                      <th className="py-4 px-6 text-center w-40">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-bold">Querying active credentials database...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan="5" className="py-12 text-center text-gray-400 font-medium">No user accounts found matching that criteria.</td></tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const finalName = user.first_name || user.firstname 
                          ? `${user.first_name || user.firstname} ${user.last_name || user.lastname || ''}` 
                          : 'Unnamed Account';

                        return (
                          <tr key={user.id || user.username} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80 transition-colors">
                            <td className="py-5 px-6 font-black text-gray-800 text-sm tracking-tight">@{user.username}</td>
                            <td className="py-5 px-6 text-[15px] font-bold text-gray-700">{finalName}</td>
                            <td className="py-5 px-6 text-sm text-gray-500 font-medium">
                              <div className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400" /> {user.email || 'No email attached'}</div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit shadow-inner">
                                <UserCircle size={12} /> Registered User
                              </span>
                            </td>
                            <td className="py-5 px-6 text-center">
                              <button onClick={() => openViewModal(user)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-200 font-bold text-xs uppercase tracking-tight rounded flex items-center gap-1 mx-auto transition-all active:scale-95">
                                <Eye size={12} /> View File
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DRILL DOWN VIEW PROFILE DETAIL MODAL COMPONENT LAYER */}
      {isViewModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-gray-100">
            <div className="p-6">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                <div className="flex items-center gap-3">
                  <UserCircle size={32} className="text-[#b32d2d]" />
                  <h3 className="font-bold text-xl text-gray-900">User Registry File</h3>
                </div>
                <X size={20} className="text-gray-400 hover:text-gray-600 cursor-pointer" onClick={() => setIsViewModalOpen(false)} />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Account ID Profile Identifier</label>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">Database Index Row: #{selectedUser.id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">System Account Login Username</label>
                  <p className="text-sm font-bold text-[#b32d2d] mt-0.5">@{selectedUser.username}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Verified Full Name</label>
                  <p className="text-base font-black text-gray-800 mt-0.5">
                    {selectedUser.first_name || selectedUser.firstname 
                      ? `${selectedUser.first_name || selectedUser.firstname} ${selectedUser.last_name || selectedUser.lastname || ''}` 
                      : 'Unnamed User'}
                  </p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Communications Routing Email</label>
                  <p className="text-sm font-medium text-gray-600 mt-0.5">{selectedUser.email || 'No email registered'}</p>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">System Permission Properties</label>
                  <div className="mt-1">
                    <div className="flex items-center gap-2 p-2.5 bg-blue-50 text-blue-800 border border-blue-100 rounded-lg text-xs font-semibold">
                      <UserCircle size={14} /> Account restricted to mobile client reporting and emergency notifications tracking data feeds.
                    </div>
                  </div>
                </div>
              </div>

              <button onClick={() => setIsViewModalOpen(false)} className="mt-8 w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold text-sm rounded-lg shadow-md transition-all active:scale-98">
                Dismiss File Records
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (<div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}><span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span><span className="text-[16px] tracking-tight">{label}</span></div>);
}