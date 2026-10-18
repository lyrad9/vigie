# Run by the Windows installer and uninstaller before they close Vigie (see installer.nsh).
# Killing Vigie.exe outright leaves the dev servers it supervises running as orphans that keep
# their ports, so this asks the running app to stop its servers and quit first, through its own
# API, and waits for it to exit. Best effort: it never fails the setup, and whatever still runs
# when it returns is closed by electron-builder's usual check.
param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [int]$TimeoutSeconds = 30
)
$ErrorActionPreference = 'SilentlyContinue'
$dir = $InstallDir.TrimEnd('\', '/') + '\'

# Every process running an executable from the install folder: the app and its helpers, or a `vigie` CLI shim.
function Get-AppPids {
  @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($dir, [StringComparison]::OrdinalIgnoreCase) } | ForEach-Object { [int]$_.ProcessId })
}

# Loopback TCP listeners of those processes. netstat's columns are locale-independent apart from
# the state label, so a listener is recognised by its wildcard remote address.
function Get-Listeners([int[]]$Pids) {
  foreach ($line in (netstat -ano -p TCP)) {
    $p = $line.Trim() -split '\s+'
    if ($p.Count -lt 5 -or $p[0] -ne 'TCP' -or $p[2] -ne '0.0.0.0:0' -or -not $p[1].StartsWith('127.0.0.1:')) { continue }
    $owner = [int]$p[$p.Count - 1]
    if ($Pids -contains $owner) { [pscustomobject]@{ Port = [int]$p[1].Split(':')[1]; Pid = $owner } }
  }
}

# The parsed JSON answer, or $null when nothing usable answers.
function Invoke-Vigie([string]$Method, [int]$Port, [string]$Route, [string]$Body) {
  try {
    $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port$Route")
    $req.Method = $Method
    $req.Proxy = $null
    $req.Timeout = 3000
    if ($Body) {
      $bytes = [Text.Encoding]::UTF8.GetBytes($Body)
      $req.ContentType = 'application/json'
      $req.ContentLength = $bytes.Length
      $stream = $req.GetRequestStream()
      $stream.Write($bytes, 0, $bytes.Length)
      $stream.Close()
    }
    $res = $req.GetResponse()
    try { (New-Object IO.StreamReader($res.GetResponseStream())).ReadToEnd() | ConvertFrom-Json } finally { $res.Close() }
  } catch {
    $null
  }
}

$pids = Get-AppPids
if (-not $pids.Count) { exit 0 }

# The supervisor answers on its API port; its health route names the process, so nothing else is asked to stop.
$stopping = @()
foreach ($l in @(Get-Listeners $pids)) {
  $health = Invoke-Vigie 'GET' $l.Port '/api/health'
  if (-not $health.ok -or [int]$health.data.pid -ne $l.Pid) { continue }
  $answer = Invoke-Vigie 'POST' $l.Port '/api/shutdown' '{"reason":"installer"}'
  if ($answer.ok) {
    Write-Output "Vigie (pid $($l.Pid)) is stopping its servers."
    $stopping += $l.Pid
  }
}
if (-not $stopping.Count) { exit 0 }

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
  if (-not @($stopping | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue }).Count) {
    Write-Output 'Vigie stopped its servers and quit.'
    exit 0
  }
  Start-Sleep -Milliseconds 300
}
Write-Output "Vigie is still running after $TimeoutSeconds seconds; the setup closes it."
exit 0
