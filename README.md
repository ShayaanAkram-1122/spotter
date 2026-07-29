# Snapper

Full-stack skeleton: Django REST Framework backend + Vite React frontend.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs at [http://127.0.0.1:8000](http://127.0.0.1:8000).

Health check: [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/) → `{"status":"ok"}`.

## Frontend setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app runs at [http://localhost:5173](http://localhost:5173). Vite proxies `/api` requests to the Django server, so the health status on the home page confirms the end-to-end connection.

## Project layout

```
snapper/
├── backend/          # Django project "core", app "planner"
│   ├── requirements.txt
│   ├── manage.py
│   ├── core/
│   └── planner/
├── frontend/         # Vite + React
│   └── package.json
├── .gitignore
└── README.md
```
