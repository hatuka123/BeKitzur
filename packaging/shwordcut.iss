; Inno Setup script for ShWordCut. Built by build.ps1, which passes the paths and version below.
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

#define AppName "ShWordCut"
#define AppExe "ShWordCut.exe"
#define RunKey "Software\Microsoft\Windows\CurrentVersion\Run"
; The app shipped as "PixelSnip" before it was renamed; setup replaces that install.
#define LegacyName "PixelSnip"
#define LegacyUninstallKey "Software\Microsoft\Windows\CurrentVersion\Uninstall\{889E2A3E-2D4C-4793-9422-5649474B9539}_is1"

[Setup]
AppId={{0B86F97E-DCB1-4745-8F54-32BFEF84C940}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppCopyright=Copyright (c) 2026 {#AppPublisher}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir={#OutputDir}
OutputBaseFilename=ShWordCut-Setup-{#AppVersion}
SetupIconFile={#IconFile}
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
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
english.AutoStart=Start ShWordCut when Windows starts
hebrew.AutoStart=הפעל את ShWordCut עם הפעלת Windows
english.StartupGroup=Startup:
hebrew.StartupGroup=הפעלה:

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"
Name: "autostart"; Description: "{cm:AutoStart}"; GroupDescription: "{cm:StartupGroup}"

[Files]
Source: "{#SourceDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#LicenseFile}"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "{#RunKey}"; ValueType: string; ValueName: "{#AppName}"; ValueData: """{app}\{#AppExe}"""; Tasks: autostart

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
{ The app lives in the tray with no main window, so Restart Manager cannot ask it to close. }
procedure StopRunningApp;
var
  ResultCode: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM {#AppExe}', '', SW_HIDE,
       ewWaitUntilTerminated, ResultCode);
end;

var
  CarryAutostart: Boolean;

procedure RemoveLegacyApp;
var
  Uninstaller: String;
  ResultCode: Integer;
begin
  { Read this before the old uninstaller deletes it, so the user's autostart choice survives. }
  CarryAutostart := RegValueExists(HKEY_CURRENT_USER, '{#RunKey}', '{#LegacyName}');
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
  end;
end;
