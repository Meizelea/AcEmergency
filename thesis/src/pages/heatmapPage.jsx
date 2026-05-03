import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet.heat';

// Import your Sidebar component (adjust the path if your folder structure is different)
import Sidebar from '../components/Sidebar'; 

const HeatmapLayer = ({ points }) => {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const heat = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 16,
      gradient: { 0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' }
    }).addTo(map);

    return () => {
      map.removeLayer(heat);
    };
  }, [map, points]);

  return null; 
};

export default function HeatmapPage() {
  const [incidentData, setIncidentData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Define the geographical boundaries of Angeles City
  // [SouthWest Coordinates, NorthEast Coordinates]
  const angelesBounds = [
    [15.110, 120.510], // Bottom-Left limit
    [15.195, 120.620]  // Top-Right limit
  ];

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/emergencies'); 
        const data = await response.json();
        
        const formattedPoints = data.map(incident => [
          parseFloat(incident.lat), 
          parseFloat(incident.lng), 
          parseFloat(incident.intensity || 0.5) 
        ]);

        setIncidentData(formattedPoints);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to fetch heatmap data:", error);
        setIsLoading(false);
      }
    };

    fetchIncidents();
    
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen bg-[#1a1a1a] overflow-hidden font-sans text-white">
      
      {/* 1. Sidebar on the left */}
      <Sidebar />

      {/* 2. Main Map Content Area on the right */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight uppercase text-[#b32d2d] mb-1">
            Live Heatmap
          </h2>
          {isLoading ? (
            <p className="text-gray-400 text-sm">Connecting to command center database...</p>
          ) : (
            <p className="text-gray-400 text-sm">Monitoring real-time operational hotspots in Angeles City.</p>
          )}
        </div>
        
        {/* Map Container */}
        <div className="flex-1 w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative z-0">
          <MapContainer 
            center={[15.144, 120.588]} // Center of Angeles City
            zoom={13} 
            minZoom={12} // Prevent zooming out too far
            maxBounds={angelesBounds} // Lock panning to Angeles City
            maxBoundsViscosity={1.0} // Add a solid "bounce" effect at the borders
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              // Optional dark mode map tiles to match your theme (uncomment to use):
              // url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            <HeatmapLayer points={incidentData} />
          </MapContainer>
        </div>
      </div>

    </div>
  );
}