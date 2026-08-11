import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Menu, UserCircle, Truck, LogOut } from 'lucide-react';

export default function AdminLayout({ children }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('ac_token');
    navigate('/login');
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a]">
      {/* SIDEBAR NAVIGATION */}
      <aside className={`bg-[#2d2d2d] text-white flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        
        <nav className="flex flex-col justify-between flex-1 mt-6 pb-6">
          <div className="flex flex-col">
            <div onClick={() => navigate('/dashboard')}>
              <SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} />
            </div>
            <div onClick={() => navigate('/reports')}>
              <SidebarLink icon={<FileText size={24} />} label="Reports" active={location.pathname === '/reports'} />
            </div>
            <div onClick={() => navigate('/analytics')}>
              <SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={location.pathname === '/analytics'} />
            </div>
            <div onClick={() => navigate('/users')}>
              <SidebarLink icon={<Users size={24} />} label="Users" active={location.pathname === '/users'} />
            </div>
            <div onClick={() => navigate('/emergency-units')}>
              <SidebarLink icon={<Truck size={24} />} label="Emergency Units" active={location.pathname === '/emergency-units'} />
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div onClick={handleLogout}>
              <div className="flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 text-gray-400 hover:bg-red-900/40 hover:text-red-400 rounded-xl font-bold">
                <LogOut size={24} className="shrink-0" />
                <span className="text-[16px] tracking-tight">Logout System</span>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 bg-gray-200 flex flex-col rounded-t-xl overflow-hidden mx-2 mb-2 shadow-2xl relative">
          
          {/* HEADER NAVIGATION */}
          <header className="bg-[#b32d2d] text-white p-3 flex justify-between items-center shrink-0 border-b border-black/10">
            <div className="flex items-center gap-4">
              <Menu size={22} className="ml-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setShowSidebar(!showSidebar)} />
              <div className="flex gap-2 items-center">
                <span 
                  onClick={() => navigate('/dashboard')} 
                  className={`text-sm px-4 py-1.5 rounded-md cursor-pointer transition-all ${
                    location.pathname === '/dashboard' 
                      ? 'bg-[#8b2323] px-5 font-bold shadow-inner' 
                      : 'font-medium opacity-90 hover:opacity-100'
                  }`}
                >
                  Dashboard
                </span>
                <span 
                  onClick={() => navigate('/reports')} 
                  className={`text-sm px-4 py-1.5 rounded-md cursor-pointer transition-all ${
                    location.pathname === '/reports' 
                      ? 'bg-[#8b2323] px-5 font-bold shadow-inner' 
                      : 'font-medium opacity-90 hover:opacity-100'
                  }`}
                >
                  Reports
                </span>
                <span 
                  onClick={() => navigate('/analytics')} 
                  className={`text-sm px-4 py-1.5 rounded-md cursor-pointer transition-all ${
                    location.pathname === '/analytics' 
                      ? 'bg-[#8b2323] px-5 font-bold shadow-inner' 
                      : 'font-medium opacity-90 hover:opacity-100'
                  }`}
                >
                  Analytics
                </span>
                <span 
                  onClick={() => navigate('/users')} 
                  className={`text-sm px-4 py-1.5 rounded-md cursor-pointer transition-all ${
                    location.pathname === '/users' 
                      ? 'bg-[#8b2323] px-5 font-bold shadow-inner' 
                      : 'font-medium opacity-90 hover:opacity-100'
                  }`}
                >
                  Users
                </span>
                <span 
                  onClick={() => navigate('/emergency-units')} 
                  className={`text-sm px-4 py-1.5 rounded-md cursor-pointer transition-all ${
                    location.pathname === '/emergency-units' 
                      ? 'bg-[#8b2323] px-5 font-bold shadow-inner' 
                      : 'font-medium opacity-90 hover:opacity-100'
                  }`}
                >
                  Emergency Units
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 pr-4">
              <span className="text-sm font-bold tracking-tight text-white/90">Admin</span>
              <UserCircle size={28} className="text-white/80" />
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}>
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
      <span className="text-[16px] tracking-tight">{label}</span>
    </div>
  );
}