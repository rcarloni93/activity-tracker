@echo off
title Activity Tracker
echo Starting Activity Tracker...

:: Start the API server in a new window
start "Activity Tracker - API Server" cmd /k "cd /d %~dp0 && node server.js"

:: Wait 1 second for server to start
timeout /t 1 /nobreak > nul

:: Start the web server in a new window
start "Activity Tracker - Web Server" cmd /k "cd /d %~dp0 && npx serve . --listen 3000"

:: Wait 1 second for web server to start
timeout /t 1 /nobreak > nul

:: Open the app in Chrome (tries Chrome first, then Edge, then default browser)
echo Opening app in browser...
start "" "http://localhost:3000"

echo.
echo Activity Tracker is running.
echo   App:    http://localhost:3000
echo   API:    http://localhost:3747
echo.
echo Close the two server windows to stop.
