===============================================================================
                    ACEMERGENCY FRONTEND REQUIREMENTS
===============================================================================

[RUNTIME DEPENDENCIES]
npm install react react-dom react-router-dom lucide-react leaflet react-leaflet recharts

- react & react-dom
- react-router-dom
- lucide-react
- leaflet
- react-leaflet
- recharts

--------------------------------------------------------------------------------
[DEV DEPENDENCIES]
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite

- vite
- @vitejs/plugin-react
- tailwindcss
- @tailwindcss/vite (or postcss + autoprefixer if using Tailwind v3)

--------------------------------------------------------------------------------
[LEAFLET CSS REQUIREMENT]
Must be included in src/main.jsx, src/index.css, or index.html:

import "leaflet/dist/leaflet.css";

OR via CDN in index.html:
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />

--------------------------------------------------------------------------------
[ENVIRONMENT VARIABLE (.env)]
VITE_API_BASE_URL=http://localhost:8000

--------------------------------------------------------------------------------
[BACKEND REQUIREMENT]
- Django REST Framework running on port 8000
- CORS allowed for http://localhost:5173
================================================================================
