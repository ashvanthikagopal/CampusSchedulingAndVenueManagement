@echo off
title CIT Scheduler Runner
echo ===================================================
echo Starting CIT Scheduler Backend and Frontend Servers
echo ===================================================

cd /d "%~dp0"

echo Starting FastAPI Backend (http://127.0.0.1:8000)...
start "CIT Backend (FastAPI)" cmd /k "python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

timeout /t 2 /nobreak >nul

echo Starting Vite Frontend (http://localhost:5173)...
start "CIT Frontend (Vite)" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo Backend:  http://127.0.0.1:8000
echo Frontend: http://localhost:5173
echo ===================================================

