; Inno Setup script for BeKitzur. Built by build.ps1, which passes the paths and version below.
; Per-user install: no admin prompt, and it matches the HKCU autostart entry the app manages.

#ifndef AppVersion
  #error AppVersion must be defined (run build.ps1)
#endif
#ifndef SourceDir
  #error SourceDir must be defined (run build.ps1)
#endif
#ifndef AppPublisher
  #error AppPublisher must be defined (run build.ps1)
#endif

; ASCII name for paths and the registry; the name users see is {cm:AppDisplayName}.
#define AppName "BeKitzur"
#define AppExe "BeKitzur.exe"
#define RunKey "Software\Microsoft\Windows\CurrentVersion\Run"
; The app shipped as "ShWordCut" under the same AppId, so setup upgrades that install in place.
#define PrevName "ShWordCut"
#define PrevExe "ShWordCut.exe"
; Before that it was "PixelSnip"; setup replaces that install.
#define LegacyName "PixelSnip"
#define LegacyUninstallKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\{889E2A3E-2D4C-4793-9422-5649474B9539}_is1"

[Setup]
AppId={{0B86F97E-DCB1-4745-8F54-32BFEF84C940}
AppName={cm:AppDisplayName}
AppVersion={#AppVersion}
AppVerName={cm:AppDisplayName} {#AppVersion}
AppPublisher={#AppPublisher}
AppCopyright=Copyright (c) 2026 {#AppPublisher}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={cm:AppDisplayName}
; The Start menu folder from the ShWordCut days is removed below, not reused.
UsePreviousGroup=no
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename={#AppName}-Setup-{#AppVersion}
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={cm:AppDisplayName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
ShowLanguageDialog=auto

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"
Name: "hebrew"; MessagesFile: "compiler:Languages\Hebrew.isl"

[CustomMessages]
english.AppDisplayName=BeKitzur
hebrew.AppDisplayName=בקיצור
english.AutoStart=Start BeKitzur when Windows starts
hebrew.AutoStart=הפעל את בקיצור עם הפעלת Windows
english.StartupGroup=Startup:
hebrew.StartupGroup=הפעלה:

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "{cm:AutoStart}"; GroupDescription: "{cm:StartupGroup}"

[InstallDelete]
; Leftovers of the ShWordCut name. Shortcuts and settings live in %APPDATA% and are not touched.
Type: files; Name: "{app}\{#PrevExe}"
Type: filesandordirs; Name: "{userprograms}\{#PrevName}"
Type: files; Name: "{userdesktop}\{#PrevName}.lnk"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#LicenseFile}"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\{cm:AppDisplayName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{cm:AppDisplayName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{cm:AppDisplayName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "{#RunKey}"; ValueType: string; ValueName: "{#AppName}"; ValueData: """{app}\{#AppExe}"""; Tasks: autostart

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{cm:AppDisplayName}}"; Flags: nowait postinstall skipifsilent

[Code]
{ The app lives in the tray with no main window, so Restart Manager cannot ask it to close. }
procedure KillImage(const Image: String);
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM ' + Image, '', SW_HIDE,
       ewWaitUntilTerminated, ResultCode);
end;

procedure StopRunningApp;
begin
  KillImage('{#AppExe}');
  KillImage('{#PrevExe}');
end;

var
  CarryAutostart: Boolean;

procedure RemoveLegacyApp;
var
  Uninstaller: String;
  ResultCode: Integer;
begin
  { Read these before they are deleted, so the user's autostart choice survives. }
  CarryAutostart := RegValueExists(HKEY_CURRENT_USER, '{#RunKey}', '{#LegacyName}')
                    or RegValueExists(HKEY_CURRENT_USER, '{#RunKey}', '{#PrevName}');
  { That entry points at the old exe, which [InstallDelete] removes. }
  RegDeleteValue(HKEY_CURRENT_USER, '{#RunKey}', '{#PrevName}');
  if RegQueryStringValue(HKEY_CURRENT_USER, '{#LegacyUninstallKey}', 'UninstallString', Uninstaller) then
    Exec(RemoveQuotes(Uninstaller), '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART', '', SW_HIDE,
         ewWaitUntilTerminated, ResultCode);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  StopRunningApp;
  RemoveLegacyApp;
  Result := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssPostInstall) and CarryAutostart then
    RegWriteStringValue(HKEY_CURRENT_USER, '{#RunKey}', '{#AppName}',
                        '"' + ExpandConstant('{app}\{#AppExe}') + '"');
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep = usUninstall then
  begin
    StopRunningApp;
    { The app can enable autostart from its own settings, so remove it regardless of the install task. }
    RegDeleteValue(HKEY_CURRENT_USER, '{#RunKey}', '{#AppName}');
    RegDeleteValue(HKEY_CURRENT_USER, '{#RunKey}', '{#PrevName}');
  end;
end;
