' Activity Tracker — silent launcher
' Starts the API server and web server invisibly, then opens the app.
' Double-click this file, or create a shortcut to it on your desktop.

Dim shell, fso, appDir

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Resolve the folder this script lives in
appDir = fso.GetParentFolderName(WScript.ScriptFullName)

' --- 1. Start the API server (hidden window) ---
shell.Run "cmd /c node """ & appDir & "\server.js"" >> """ & appDir & "\server.log"" 2>&1", 0, False

' --- 2. Start the web server on port 3000 (hidden window) ---
shell.Run "cmd /c npx serve """ & appDir & """ --listen 3000 >> """ & appDir & "\serve.log"" 2>&1", 0, False

' --- 3. Wait 2 seconds for both servers to be ready ---
WScript.Sleep 2000

' --- 4. Open the app in the default browser ---
shell.Run "http://localhost:3000", 1, False

Set shell = Nothing
Set fso   = Nothing
