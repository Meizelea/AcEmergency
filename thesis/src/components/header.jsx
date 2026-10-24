import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutGrid, 
  FileText, 
  BarChart3, 
  Users, 
  Menu, 
  UserCircle, 
  Truck, 
  LogOut, 
  ShieldCheck,
  Megaphone,
  UserCheck,
  Copy,
  X
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.removeItem('ac_token');
    localStorage.removeItem('ac_user');
    navigate('/login');
  };

  // Pull cached user data
  const storedUser = JSON.parse(localStorage.getItem('ac_user') || '{}');
  const displayName = storedUser.username || storedUser.name || 'Admin';

  // Privileged check
  const isPrivilegedAdmin = Boolean(
    storedUser.is_superuser === true ||
    storedUser.is_staff === true ||
    storedUser.role?.toUpperCase() === 'SUPERADMIN' ||
    storedUser.role?.toUpperCase() === 'PRIVILEGED_ADMIN' ||
    storedUser.account_type?.toUpperCase() === 'SUPERADMIN' ||
    storedUser.user_type?.toUpperCase() === 'SUPERADMIN' ||
    storedUser.username === 'g2c405' ||
    displayName === 'g2c405'
  );

  // Map route path to human-readable page title for mobile view
  const getPageTitle = (path) => {
    switch (path) {
      case '/superadmin': return 'Admin Management';
      case '/privileged-emergency-units': return 'Emergency Units';
      case '/analytics': return 'Analytics';
      case '/reports': return 'Reports';
      case '/duplicates': return 'Duplicates';
      case '/dashboard': return 'Dashboard';
      case '/users': return 'Users';
      case '/emergency-units': return 'Emergency Units';
      case '/announcements': return 'Announcements';
      case '/profile': return 'Admin Profile';
      default: return 'Admin Panel';
    }
  };

  const navItems = isPrivilegedAdmin
    ? [
        { path: '/superadmin', label: 'Admin Management', icon: <ShieldCheck size={22} /> },
        { path: '/privileged-emergency-units', label: 'Emergency Units', icon: <Truck size={22} /> },
      ]
    : [
        { path: '/analytics', label: 'Analytics', icon: <LayoutGrid size={22} /> },
        { path: '/reports', label: 'Reports', icon: <FileText size={22} /> },
        { path: '/duplicates', label: 'Duplicates', icon: <Copy size={22} /> },
        { path: '/dashboard', label: 'Dashboard', icon: <BarChart3 size={22} /> },
        { path: '/users', label: 'Users', icon: <Users size={22} /> },
        { path: '/emergency-units', label: 'Emergency Units', icon: <Truck size={22} /> },
        { path: '/announcements', label: 'Announcements', icon: <Megaphone size={22} /> },
        
      ];

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a] relative">
      
      {/* MOBILE BACKDROP OVERLAY */}
      {showSidebar && (
        <div 
          onClick={() => setShowSidebar(false)} 
          className="fixed inset-0 bg-black/60 z-20 md:hidden transition-opacity"
        />
      )}

      {/* SIDEBAR NAVIGATION */}
      <aside 
        className={`bg-[#2d2d2d] text-white flex flex-col h-full transition-all duration-300 ease-in-out shrink-0 z-30 fixed md:relative ${
          showSidebar ? 'w-64 translate-x-0' : 'w-64 -translate-x-full md:translate-x-0 md:w-0 overflow-hidden'
        }`}
      >
        <div className="p-5 text-sm font-black tracking-widest border-b border-white/10 uppercase flex justify-between items-center">
          <span>{isPrivilegedAdmin ? 'SUPERADMIN' : 'ADMIN'}</span>
          <button onClick={() => setShowSidebar(false)} className="md:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex flex-col justify-between flex-1 mt-4 pb-6 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <div 
                key={item.path} 
                onClick={() => {
                  navigate(item.path);
                  setShowSidebar(false); // Close sidebar on mobile item click
                }}
              >
                <SidebarLink 
                  icon={item.icon} 
                  label={item.label} 
                  active={location.pathname === item.path} 
                />
              </div>
            ))}
          </div>

          {/* Logout Button */}
          <div className="border-t border-white/10 pt-4 mt-auto">
            <div onClick={handleLogout}>
              <div className="flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 text-gray-400 hover:bg-red-900/40 hover:text-red-400 rounded-xl font-bold">
                <LogOut size={22} className="shrink-0" />
                <span className="text-[15px] tracking-tight">Logout</span>
              </div>
            </div>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 bg-gray-200 flex flex-col md:rounded-t-xl overflow-hidden md:mx-2 md:mb-2 shadow-2xl relative">
          
          {/* HEADER NAVIGATION */}
          <header className="bg-[#b32d2d] text-white px-3 py-2.5 flex items-center justify-between shrink-0 border-b border-black/10 gap-2">
            <div className="flex items-center gap-2 md:gap-4 overflow-hidden min-w-0">
              {/* Menu Toggle Button */}
              <button 
                onClick={() => setShowSidebar(!showSidebar)}
                className="p-1.5 rounded-lg hover:bg-black/10 transition-colors shrink-0"
                aria-label="Toggle Navigation Menu"
              >
                <Menu size={22} />
              </button>

              {/* Mobile View: Show Current Page Title */}
              <span className="lg:hidden font-bold text-base truncate tracking-tight">
                {getPageTitle(location.pathname)}
              </span>

              {/* Desktop/Tablet View: Scrollable Horizontal Tabs */}
              <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <span 
                      key={item.path}
                      onClick={() => navigate(item.path)} 
                      className={`text-sm rounded-md cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                        isActive 
                          ? 'bg-[#8b2323] px-3.5 py-1.5 font-bold shadow-inner' 
                          : 'px-3 py-1.5 font-medium opacity-90 hover:opacity-100 hover:bg-black/10'
                      }`}
                    >
                      {item.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* User Profile Badge */}
            <div 
              onClick={() => navigate('/profile')}
              className={`flex items-center gap-2 px-2.5 py-1 rounded-lg cursor-pointer transition-all select-none shrink-0 ${
                location.pathname === '/profile'
                  ? 'bg-[#8b2323] shadow-inner font-bold text-white'
                  : 'hover:bg-black/10 text-white/90 hover:text-white'
              }`}
              title="View Admin Profile"
            >
              <span className="text-sm font-bold tracking-tight hidden sm:inline max-w-[120px] truncate">
                {displayName}
              </span>
              <UserCircle size={26} className="text-white/90" />
            </div>
          </header>

          {/* PAGE CONTENT CONTAINER */}
          <main className="flex-1 overflow-y-auto p-2 sm:p-4">
            {children}
          </main>

        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (
    <div className={`flex items-center gap-3.5 px-4 py-2.5 mx-3 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}>
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span>
      <span className="text-[15px] tracking-tight truncate">{label}</span>
    </div>
  );
}