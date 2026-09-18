#define MyAppName "Hoja Personal CV Studio"
#define MyAppVersion "48.0.0"
#define MyAppPublisher "Master CV Studio"
#define MyAppExeName "MasterCVStudio.exe"

[Setup]
AppId={{7F1CB506-9C84-4FE6-A9C8-5BE78FD2B2F1}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v48
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\Hoja Personal CV Studio
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
OutputDir=..\dist\installer
OutputBaseFilename=Hoja-Personal-CV-Studio-v48-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupLogging=yes
CloseApplications=yes
RestartApplications=no
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Dirs]
Name: "{localappdata}\HojaPersonalCVStudio"

[Files]
Source: "..\dist\windows\MasterCVStudio\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--pid-file ""{localappdata}\HojaPersonalCVStudio\server.pid"""; WorkingDir: "{app}"; Comment: "Abrir {#MyAppName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--pid-file ""{localappdata}\HojaPersonalCVStudio\server.pid"""; WorkingDir: "{app}"; Comment: "Abrir {#MyAppName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--pid-file ""{localappdata}\HojaPersonalCVStudio\server.pid"""; WorkingDir: "{app}"; Description: "Abrir {#MyAppName}"; Flags: nowait postinstall skipifsilent
