import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, BarChart3, Users, Map, LogOut } from 'lucide-react';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Function to securely log the admin out
  const handleLogout = () => {
    // Clear the authentication token from storage
    localStorage.removeItem('ac_user');
    // Send them back to the login screen
    navigate('/login');
  };

  return (
    <aside className="bg-[#2d2d2d] text-white flex flex-col shrink-0 z-30 w-64 h-screen border-r border-white/5">
      
      <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase text-[#b32d2d]">
        ADMIN
      </div>
      
      <nav className="flex flex-col mt-6 flex-1">
        <div onClick={() => navigate('/dashboard')}>
          <SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={location.pathname === '/dashboard'} />
        </div>
        
        {/* Heatmap Link */}
        <div onClick={() => navigate('/heatmap')}>
          <SidebarLink icon={<Map size={24} />} label="Live Map" active={location.pathname === '/heatmap'} />
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
        
        {/* Log Out Section pushed to the bottom */}
        <div className="mt-auto border-t border-white/10 pt-4 mb-4">
          <div onClick={handleLogout}>
            {/* active is set to false because we don't 'stay' on a logout page */}
            <SidebarLink 
              icon={<LogOut size={24} className="text-red-400" />} 
              label="Log Out" 
              active={false} 
            />
          </div>
        </div>
      </nav>
      
    </aside>
  );
}

// Your custom SidebarLink component
function SidebarLink({ icon, label, active }) {
  return (
    <div className={`flex items-center gap-3 px-6 py-4 cursor-pointer transition-colors ${active ? 'bg-[#b32d2d] text-white border-r-4 border-[#b32d2d]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
      {icon}
      <span className="font-bold text-sm tracking-wide">{label}</span>
    </div>
  );
}