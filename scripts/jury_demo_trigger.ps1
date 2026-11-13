Write-Host "TRIGGERING PHASE 5 CIRCUIT BREAKER FOR LIVE DEMO..." -ForegroundColor Red

$payload = @{
    detected_phase = 5
    risk_level = "CRITICAL"
    trigger_phrases = @("Do not tell your family", "Lock your door immediately")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/v1/demo/trigger-isolation" -Method Post -Body $payload -ContentType "application/json"

Write-Host "DEMO PAYLOAD INJECTED SUCCESSFULLY. CHECK UI." -ForegroundColor Green