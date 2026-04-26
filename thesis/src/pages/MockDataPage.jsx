import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, FileText, Map as MapIcon, BarChart3, Users, Smartphone, Send, CheckCircle, UserCircle } from 'lucide-react';

export default function MockDataPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ type: 'Fire Breakout', location: '', reporter: 'System Admin' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('http://localhost:3000/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setFormData({ type: 'Fire Breakout', location: '', reporter: 'System Admin' });
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      }
    } catch (error) {
      console.error("Failed to submit mock report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-full flex overflow-hidden font-sans bg-[#2a2a2a]">
      <aside className={`bg-[#2d2d2d] text-white flex flex-col transition-all duration-300 ease-in-out shrink-0 z-30 ${showSidebar ? 'w-64' : 'w-0 overflow-hidden'}`}>
        <div className="p-6 text-sm font-black tracking-widest border-b border-white/10 uppercase">ADMIN</div>
        <nav className="flex flex-col mt-6">
          <div onClick={() => navigate('/dashboard')}><SidebarLink icon={<LayoutGrid size={24} />} label="Dashboard" active={false} /></div>
          <div onClick={() => navigate('/reports')}><SidebarLink icon={<FileText size={24} />} label="Reports" active={false} /></div>
          <div><SidebarLink icon={<MapIcon size={24} />} label="Heatmap" active={false} /></div>
          <div><SidebarLink icon={<BarChart3 size={24} />} label="Analytics" active={false} /></div>
          <div onClick={() => navigate('/users')}><SidebarLink icon={<Users size={24} />} label="Users" active={false} /></div>
          <div className="mt-8 border-t border-white/10 pt-4">
            <div onClick={() => navigate('/mock-entry')}><SidebarLink icon={<Smartphone size={24} />} label="App Simulator" active={true} /></div>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="text-gray-400 p-4 text-lg font-medium tracking-wide shrink-0">System Testing Tools</div>
        <div className="flex-1 bg-gray-200 flex flex-col rounded-t-xl overflow-hidden mx-2 mb-2 shadow-2xl relative items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border-4 border-gray-800">
            <div className="bg-gray-800 text-white p-4 text-center">
              <Smartphone size={24} className="mx-auto mb-2 opacity-80" />
              <h2 className="font-bold tracking-wide">Mobile App Simulator</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6">
              {successMessage && <div className="mb-4 bg-green-50 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2 font-bold"><CheckCircle size={18} /> Sent to Server!</div>}
              
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Simulated User (Reporter)</label>
                <div className="flex items-center bg-gray-50 border border-gray-300 rounded-lg overflow-hidden focus-within:border-blue-500">
                  <div className="pl-3 text-gray-400"><UserCircle size={18} /></div>
                  <input type="text" required className="w-full p-3 text-gray-700 bg-transparent focus:outline-none" value={formData.reporter} onChange={(e) => setFormData({...formData, reporter: e.target.value})} />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Emergency Type</label>
                <select className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}>
                  <option>Fire Breakout</option>
                  <option>Road Accident</option>
                  <option>Medical Emergency</option>
                  <option>Ongoing Crime</option>
                </select>
              </div>

              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-2">Location (Barangay)</label>
                <input type="text" required placeholder="e.g. Pampang..." className="w-full border border-gray-300 rounded-lg p-3" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white p-4 rounded-xl font-black flex justify-center items-center gap-2 disabled:opacity-50">
                <Send size={20} /> {isSubmitting ? 'Transmitting...' : 'Send SOS Alert'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarLink({ icon, label, active }) {
  return (
    <div className={`flex items-center gap-4 px-4 py-3 mx-3 mb-1 cursor-pointer transition-all duration-200 ${active ? 'bg-[#ef4444] text-white rounded-xl shadow-md font-bold' : 'text-gray-300 hover:bg-gray-800 hover:text-white rounded-xl'}`}>
      <span className={active ? 'text-white' : 'text-gray-400'}>{icon}</span><span className="text-[16px] tracking-tight">{label}</span>
    </div>
  );
}