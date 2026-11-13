Write-Host "Setting up Python Virtual Environment..." -ForegroundColor Yellow
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

Write-Host "Setting up Flutter Dependencies..." -ForegroundColor Yellow
cd ../frontend
flutter pub get
Write-Host "Environment Setup Complete!" -ForegroundColor Green