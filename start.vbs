' Activity Tracker — silent launcher
' Starts both servers invisibly, then opens the PWA directly (no browser chrome).

Dim shell, fso, appDir, chrome, edge, appUrl

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

appDir = fso.GetParentFolderName(WScript.ScriptFullName)
appUrl = "http://localhost:3000"

' --- 1. Start the API server (hidden) ---
shell.Run "cmd /c node """ & appDir & "\server.js"" >> """ & appDir & "\server.log"" 2>&1", 0, False

' --- 2. Start the web server on port 3000 (hidden) ---
shell.Run "cmd /c npx serve """ & appDir & """ --listen 3000 >> """ & appDir & "\serve.log"" 2>&1", 0, False

' --- 3. Wait for servers to be ready ---
WScript.Sleep 2000

' --- 4. Launch directly as a PWA window (no browser chrome) ---
' Try Chrome first, then Edge, then fall back to default browser
chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
edge   = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(chrome) Then
    shell.Run """" & chrome & """ --app=" & appUrl & " --window-size=1280,800", 1, False
ElseIf fso.FileExists(edge) Then
    shell.Run """" & edge & """ --app=" & appUrl & " --window-size=1280,800", 1, False
Else
    ' Fallback: open in default browser
    shell.Run appUrl, 1, False
End If

Set shell = Nothing
Set fso   = Nothing
