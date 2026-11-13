Write-Host "Starting Second Voice Backend (FastAPI)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; .\venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

Write-Host "Starting Second Voice Frontend (Flutter Windows)..." -ForegroundColor Magenta
cd frontend
flutter run -d windows