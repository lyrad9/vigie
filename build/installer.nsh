; Included by electron-builder in the Windows installer and uninstaller (build.nsis.include).
;
; When Vigie is running, setup kills Vigie.exe before replacing or removing it. That skips the
; app's own quit, which stops the dev servers it supervises, and on Windows those servers then
; survive as orphans that keep their ports. So before electron-builder's check closes the app,
; vigie-stop.ps1 asks it to stop its servers and quit through its local API.
;
; customCheckAppRunning replaces electron-builder's check (templates/nsis/include/
; allowOnlyOneInstallerInstance.nsh), which then skips the include and variable below: they are
; declared here, and the original check runs right after ours for whatever is still open.
; test/installer.test.js fails if a new electron-builder drops these hooks.

!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  !insertmacro vigieStopServers
  !insertmacro IS_POWERSHELL_AVAILABLE
  !insertmacro _CHECK_APP_RUNNING
!macroend

!macro vigieStopServers
  InitPluginsDir
  File "/oname=$PLUGINSDIR\vigie-stop.ps1" "${BUILD_RESOURCES_DIR}\vigie-stop.ps1"
  DetailPrint "Asking Vigie to stop its servers..."
  nsExec::ExecToLog `"$PowerShellPath" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\vigie-stop.ps1" -InstallDir "$INSTDIR"`
  Pop $0
!macroend
