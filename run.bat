@echo off
echo ================================================================
echo  VERITAS SENTINEL // DEEPFAKE FORENSICS ^& CYBER SECURITY SUITE
echo  Starting local zero-dependency forensic server...
echo ================================================================
cd /d "%~dp0"
python server.py --open
pause
