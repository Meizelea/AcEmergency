<div align="center">

# **AcEmergency Dependencies & Requirements**

</div>

[RUNTIME DEPENDENCIES]
npm install react react-dom react-router-dom lucide-react leaflet react-leaflet recharts

- react & react-dom: Core UI framework
- react-router-dom: Client-side routing and protected routes
- lucide-react: Icons across dashboard, tables, and modals
- leaflet & react-leaflet: Interactive maps and responder coordinate overlays
- recharts: Dispatch analytics and incident graphs

--------------------------------------------------------------------------------
[DEV DEPENDENCIES]
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite

- vite: Local dev server and build tool
- @vitejs/plugin-react: React support for Vite
- tailwindcss & @tailwindcss/vite: Utility styling framework

--------------------------------------------------------------------------------
[LEAFLET CSS REQUIREMENT]
Leaflet map markers and tiles will not render correctly without base styling.

Option A (Inside src/main.jsx or src/index.css):
  import "leaflet/dist/leaflet.css";

Option B (Inside <head> of index.html):
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />

--------------------------------------------------------------------------------
[ENVIRONMENT VARIABLE (.env)]
File location: Root directory of frontend project

VITE_API_BASE_URL=http://localhost:8000

--------------------------------------------------------------------------------
[BACKEND PREREQUISITES]
- Django REST Framework running on port 8000
- CORS allowed for http://localhost:5173
