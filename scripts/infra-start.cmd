@echo off
cd /d "C:\Users\ADVAN\OneDrive\Dokumen\web 1\campusflow"
node packages\dev-infra\src\index.js start >> "%TEMP%\campusflow-infra.log" 2>&1