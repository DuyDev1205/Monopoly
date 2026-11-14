; Bộ cài Cờ Tỷ Phú Việt Nam (bản Godot) — cài cho người dùng hiện tại, không cần quyền admin.
; Cài đè đúng chỗ bản Tauri cũ (%LOCALAPPDATA%\CoTyPhu) để bản cũ tự cập nhật sang bản mới được.
; Tham số: /S hoặc /P = cài lặng lẽ (trình cập nhật dùng), cài xong tự mở game.
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"

!ifndef VERSION
  !define VERSION "2.0.0"
!endif
!define APPNAME "CoTyPhu"
!define DISPLAY "Cờ Tỷ Phú Việt Nam"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"

Name "${DISPLAY}"
OutFile "..\..\build\win\CoTyPhu_${VERSION}_x64-setup.exe"
InstallDir "$LOCALAPPDATA\${APPNAME}"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText "© Trần Thanh Duy"

!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPNAME}.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Mở ${DISPLAY}"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Vietnamese"

Var Quiet

Function .onInit
  StrCpy $Quiet 0
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/P" $R1
  IfErrors +3 0
    StrCpy $Quiet 1
    SetSilent silent
  IfSilent 0 +2
    StrCpy $Quiet 1
  ; đóng game nếu đang mở
  nsExec::Exec 'taskkill /F /IM ${APPNAME}.exe'
  Sleep 400
FunctionEnd

Section "Cài đặt"
  SetOutPath "$INSTDIR"
  ; dọn tệp của bản Tauri cũ (nếu có)
  Delete "$INSTDIR\resources.pak"
  RMDir /r "$INSTDIR\resources"
  File "..\..\build\win\${APPNAME}.exe"
  File "icon.ico"
  WriteUninstaller "$INSTDIR\uninstall.exe"
  CreateShortCut "$SMPROGRAMS\${DISPLAY}.lnk" "$INSTDIR\${APPNAME}.exe" "" "$INSTDIR\icon.ico"
  CreateShortCut "$DESKTOP\${DISPLAY}.lnk" "$INSTDIR\${APPNAME}.exe" "" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${DISPLAY}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "Trần Thanh Duy"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${If} $Quiet == 1
    Exec '"$INSTDIR\${APPNAME}.exe"'
  ${EndIf}
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM ${APPNAME}.exe'
  Delete "$INSTDIR\${APPNAME}.exe"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\uninstall.exe"
  RMDir "$INSTDIR"
  Delete "$SMPROGRAMS\${DISPLAY}.lnk"
  Delete "$DESKTOP\${DISPLAY}.lnk"
  DeleteRegKey HKCU "${UNINST_KEY}"
SectionEnd
