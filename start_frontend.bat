@echo off
setlocal ENABLEEXTENSIONS

echo Starting Service Tool Frontend...

rem Change to the directory of this script regardless of where it's invoked from
cd /d "%~dp0" || goto :err_cd

rem Go to frontend folder (handles spaces in path)
cd /d "%~dp0frontend" || goto :err_cd

rem Quick sanity check
if not exist package.json (
  echo ERROR: package.json not found in "%cd%".
  echo Make sure the frontend folder exists next to this script.
  goto :end
)

rem Ensure npm is available
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found in PATH. Install Node.js LTS from https://nodejs.org/
  goto :end
)

echo.
echo Installing Node.js dependencies (npm install)...
call npm install
if errorlevel 1 goto :err_install

echo.
echo Starting React development server on http://localhost:3000 ...
call npm start
goto :end

:err_cd
echo ERROR: Failed to change directory. Check the script location and folder structure.
goto :end

:err_install
echo ERROR: npm install failed. Check your internet connection and retry.
echo If behind a proxy, configure npm proxy settings.
goto :end

:end
endlocal
