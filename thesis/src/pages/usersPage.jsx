import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Smartphone, Menu, UserCircle, Search, Plus, Shield, ShieldAlert, X, Eye, Ban, CheckCircle2 } from 'lucide-react';

export default function UsersPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Adjusted keys to accommodate backend schema splits
  const [formData, setFormData] = useState({ firstname: '', lastname: '', email: '', role: 'User' });
  const [selectedUser, setSelectedUser] = useState(null);

  // Helper utility to clean up date timestamps
  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? dateString : d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/users');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
      setIsLoading(false);
    } catch (error) { 
      console.error("Failed to query user database:", error);
      setIsLoading(false); 
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Automatically craft baseline secure attributes matching backend specifications
    const generatedUsername = `${formData.firstname.toLowerCase().replace(/\s+/g, '')}${Math.floor(100 + Math.random() * 900)}`;
    const completePayload = {
      ...formData,
      username: generatedUsername,
      password: "Emergency123!" // Initial account registration fallback seed
    };

    try {
      const response = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completePayload)
      });
      if (response.ok) {
        setIsAddModalOpen(false);
        setFormData({ firstname: '', lastname: '', email: '', role: 'User' }); 
        fetchUsers(); 
      } else {
        alert("Registration failed. Email or Username might already exist.");
      }
    } catch (error) { 
      console.error("Failed to add user:", error); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleViewUser = (user) => { setSelectedUser(user); setIsViewModalOpen(true); };

  const handleToggleStatus = async (userId, currentStatus, role) => {
    if (role === 'System Admin' && userId === 1) return;
    const newStatus = currentStatus === 'Active' ? 'Suspended' : 'Active';
    try {
      const response = await fetch(`http://localhost:3000/api/users/${userId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.ok) setUsers(users.map(user => user.id === userId ? { ...user, status: newStatus } : user));
    } catch (error) { console.error("Failed to toggle status:", error); }
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstname || ''} ${user.lastname || user.name || ''}`.toLowerCase();
    const emailStr = (user.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || emailStr.includes(query);
  });

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">

      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} /></div>
          <div onClick={() => navigate('/analytics')}><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} /></div>
          
          <div className="mt-8 border-t border-white/10 pt-4">
            <div onClick={() => navigate('/mock-entry')}><SidebarLink icon={<Smartphone size={24} />} label="App Simulator" active={location.pathname === '/mock-entry'} /></div>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-[#f0f0f0] flex flex-col rounded-t-md overflow-hidden mx-2 mb-2 shadow-2xl">
          
          {/* UNIVERSAL RED HEADER */}
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
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          <div className="p-8 flex-1 overflow-y-auto">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-sm w-80 overflow-hidden">
                <Search size={18} className="text-gray-400 ml-4" />
                <input type="text" placeholder="Search name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full py-2.5 px-3 text-sm font-medium text-gray-700 focus:outline-none" />
              </div>
              <button onClick={() => setIsAddModalOpen(true)} className="bg-[#b32d2d] hover:bg-[#8b2323] text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm"><Plus size={20} /> Add New User</button>
            </div>

            <div className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden">
              <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
                <div className="flex items-center gap-3"><div className="bg-black text-white rounded-full p-1.5"><Shield size={18} /></div><h2 className="font-bold text-xl text-gray-900">System & App Users</h2></div>
                <span className="text-sm text-gray-400 font-medium">{filteredUsers.length} Users</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b-2 border-gray-200 text-gray-800 text-sm">
                      <th className="py-4 px-8 font-bold">Name / Identifier</th>
                      <th className="py-4 px-8 font-bold">Role</th>
                      <th className="py-4 px-8 font-bold">Status</th>
                      <th className="py-4 px-8 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr><td colSpan="4" className="py-8 text-center text-gray-400 font-bold">Loading secure database...</td></tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr><td colSpan="4" className="py-8 text-center text-gray-400 font-medium">No system users identified.</td></tr>
                    ) : (
                      filteredUsers.map((user) => {
                        const finalName = user.firstname ? `${user.firstname} ${user.lastname || ''}` : (user.name || 'System Account');
                        return (
                          <tr key={user.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="py-4 px-8">
                              <div className="flex items-center gap-3">
                                <UserCircle size={32} className="text-gray-400" />
                                <div>
                                  <div className="font-bold text-gray-800">{finalName}</div>
                                  <div className="text-xs text-gray-500 font-medium">{user.email || `@${user.username || 'user'}`}</div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4 px-8"><span className={`px-3 py-1 rounded-full text-xs font-bold border ${user.role === 'System Admin' ? 'bg-purple-50 text-purple-700 border-purple-200' : user.role === 'Dispatcher' ? 'bg-blue-50 text-blue-700 border-blue-200' : user.role === 'Responder' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>{user.role}</span></td>
                            <td className="py-4 px-8"><div className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${user.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></div><span className={`text-sm font-bold ${user.status === 'Active' ? 'text-gray-700' : 'text-red-600'}`}>{user.status}</span></div></td>
                            <td className="py-4 px-8 text-right">
                              <button onClick={() => handleViewUser(user)} className="text-gray-400 hover:text-blue-600 p-2" title="View Details"><Eye size={18} /></button>
                              <button onClick={() => handleToggleStatus(user.id, user.status, user.role)} disabled={user.role === 'System Admin' && parseInt(user.id) === 1} className={`p-2 ml-2 ${user.role === 'System Admin' && parseInt(user.id) === 1 ? 'text-gray-200 cursor-not-allowed' : user.status === 'Active' ? 'text-gray-400 hover:text-red-600' : 'text-red-500 hover:text-green-600'}`} title={user.status === 'Active' ? "Suspend Account" : "Reactivate Account"}>
                                {user.status === 'Active' ? <Ban size={18} /> : <CheckCircle2 size={18} />}
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

      {isViewModalOpen && selectedUser && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-800 p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg flex items-center gap-2"><UserCircle size={20} /> User Profile</h3><X size={20} className="cursor-pointer hover:opacity-80" onClick={() => setIsViewModalOpen(false)} /></div>
            <div className="p-6">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6 mb-6"><div className="bg-gray-100 p-3 rounded-full text-gray-500"><UserCircle size={48} /></div><div><h2 className="text-2xl font-black text-gray-800 tracking-tight">{selectedUser.firstname ? `${selectedUser.firstname} ${selectedUser.lastname || ''}` : (selectedUser.name || 'Secure Account')}</h2><p className="text-gray-500 font-medium">{selectedUser.role}</p></div></div>
              <div className="space-y-4">
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">System Username</label><p className="text-gray-800 font-medium">@{selectedUser.username || 'unassigned'}</p></div>
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Address</label><p className="text-gray-800 font-medium">{selectedUser.email || 'None listed'}</p></div>
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Account Status</label><p className={`font-bold ${selectedUser.status === 'Active' ? 'text-green-600' : 'text-red-600'}`}>{selectedUser.status}</p></div>
                <div><label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Date Registered</label><p className="text-gray-800 font-medium">{formatDate(selectedUser.joined)}</p></div>
              </div>
              <div className="mt-8 flex justify-end"><button onClick={() => setIsViewModalOpen(false)} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-6 py-2 rounded-lg font-bold">Close</button></div>
            </div>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-[#b32d2d] p-4 flex justify-between items-center text-white"><h3 className="font-bold text-lg flex items-center gap-2"><ShieldAlert size={20} /> Register User</h3><X size={20} className="cursor-pointer hover:opacity-80" onClick={() => setIsAddModalOpen(false)} /></div>
            <form onSubmit={handleAddUser} className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">First Name</label><input type="text" required placeholder="Juan" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none" value={formData.firstname} onChange={(e) => setFormData({...formData, firstname: e.target.value})} /></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label><input type="text" required placeholder="Dela Cruz" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none" value={formData.lastname} onChange={(e) => setFormData({...formData, lastname: e.target.value})} /></div>
              </div>
              <div className="mb-4"><label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label><input type="email" required placeholder="name@email.com" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div className="mb-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Assign Access Role</label>
                <select className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 text-sm focus:outline-none cursor-pointer" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
                  <option value="User">User (Mobile App Access)</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Responder">Responder</option>
                  <option value="System Admin">System Admin</option>
                </select>
              </div>
              <div className="text-xs text-gray-400 mb-6 bg-gray-50 p-3 rounded border border-gray-200 font-medium">
                ⚠️ **Note:** New registrations are instantly auto-allocated an automated system username. Temporary account login password defaults to: <code className="bg-gray-200 px-1 font-bold rounded">Emergency123!</code>
              </div>
              <div className="flex gap-3 justify-end"><button type="button" onClick={() => setIsAddModalOpen(false)} className="px-5 py-2.5 rounded-lg font-bold text-gray-600 hover:bg-gray-100">Cancel</button><button type="submit" disabled={isSubmitting} className="bg-[#b32d2d] text-white px-6 py-2.5 rounded-lg font-bold disabled:opacity-50">{isSubmitting ? 'Saving...' : 'Register Account'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (<div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}><span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span><span className="text-[16px] tracking-tight">{label}</span></div>);
}