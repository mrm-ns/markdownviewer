#Requires -Version 5.1
<#
  Markdown Viewer - one-click environment setup / health check.

  What it does:
    1. Python 3.6+   (required)  installs it via winget when missing
    2. Modern browser (required)  looks for Edge / Chrome
    3. Python stdlib self-check   imports what serve.py needs + binds a TCP port
    4. PDF engine    (built in)   Edge / Chrome is printed headlessly to PDF,
                                  so "export PDF" needs NO extra install and
                                  its output carries no watermark.
                                  Prince is optional and only useful with a
                                  license (MD_PDF_ENGINE=prince to switch).

  Usage:
    setup-env.bat                  check, then install what is missing
    setup-env.bat -Check           report only, change nothing
    setup-env.bat -PrinceZip PATH  opt-in: install Prince from a local zip you
                                   downloaded yourself (optional; needs a license)
    setup-env.bat -NoMirror        leave the winget source alone
    setup-env.bat -Mirror URL      use a different winget mirror

  Notes:
    * In China the winget download often stalls on cdn.winget.microsoft.com, so
      when Python is missing this script switches the winget source to a
      domestic mirror (USTC by default, NJU also works). Changing a winget
      source needs an ADMIN terminal: when the script is not elevated it prints
      the exact two commands to run instead, and never leaves the source broken
      (a failed switch restores the official URL).
    * This file is ASCII-only on purpose. Windows PowerShell 5.1 decodes
      BOM-less UTF-8 scripts with the ANSI codepage, so non-ASCII text here
      would show up as garbage in the console.
    * Standalone: it does not read or modify the viewer itself. It only
      installs/detects tooling and prints a report.
    * While Python downloads, winget's own live progress bar is shown. That
      needs a real console; when this script's output is redirected the bar is
      replaced by plain captured text. Force either mode with the environment
      variable MV_SETUP_PROGRESS=1 (bar) or =0 (capture).
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$PrinceZip = '',
    [switch]$NoMirror,
    [string]$Mirror = ''
)

$ErrorActionPreference = 'Continue'

$script:Problems = 0   # required things that are missing -> exit code 1
$script:Warnings = 0

# Should long downloads show a live progress bar? winget draws a real one
# (bytes / percentage), but only when its stdout is an actual console. If the
# script's output is redirected (a log file, a CI run) the bar would just be
# junk, so capture plain text instead.
# Override with MV_SETUP_PROGRESS=1 (force the bar) or =0 (force capture).
$script:LiveProgress = -not [Console]::IsOutputRedirected
if ($env:MV_SETUP_PROGRESS -eq '1') { $script:LiveProgress = $true }
if ($env:MV_SETUP_PROGRESS -eq '0') { $script:LiveProgress = $false }

# winget's community source (cdn.winget.microsoft.com) is often slow or
# unreachable from mainland China, which is what makes the Python download fail.
# USTC mirrors the same index; NJU is a working alternative. Verified: both
# answer HTTP 200 with a ~19.4 MB source.msix, same as the official one.
# Changing a winget source requires an ADMIN terminal, so when this script is
# not elevated it prints the exact commands instead of silently doing nothing.
$script:UseMirror = -not $NoMirror
$script:MirrorUrl = 'https://mirrors.ustc.edu.cn/winget-source'
$script:OfficialSourceUrl = 'https://cdn.winget.microsoft.com/cache'
if ($Mirror) { $script:MirrorUrl = $Mirror }

function Line { param([string]$Text = '') Write-Host $Text }
function Step { param([string]$Text) Write-Host ''; Write-Host ("--- " + $Text) }
function Ok   { param([string]$Text) Write-Host ("  [ok]   " + $Text) }
function Skip { param([string]$Text) Write-Host ("  [skip] " + $Text) }
function Warn { param([string]$Text) $script:Warnings++; Write-Host ("  [warn] " + $Text) }
function Bad  { param([string]$Text) $script:Problems++; Write-Host ("  [FAIL] " + $Text) }
function Hint { param([string]$Text) Write-Host ("         " + $Text) -ForegroundColor DarkGray }

# Rebuild $env:Path from the registry: a freshly installed program updates the
# persisted PATH, but this already-running process would not see it.
function Sync-Path {
    $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user    = [Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = (@($machine, $user) | Where-Object { $_ }) -join ';'
}

function Add-UserPath {
    param([string]$Dir)
    $user = [Environment]::GetEnvironmentVariable('Path', 'User')
    $parts = @($user -split ';' | Where-Object { $_ })
    if ($parts -contains $Dir) { return $false }
    $parts += $Dir
    [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')
    Sync-Path
    return $true
}

# Read a file captured from a child process.
# winget and python emit UTF-8 when their output is redirected, but the legacy
# OEM/ANSI codepage is still possible, so try a strict UTF-8 decode first and
# fall back to the ANSI codepage. Reading with Get-Content without -Encoding
# assumes ANSI and turns winget's localized messages into mojibake.
function Read-Captured {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return '' }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -eq 0) { return '' }
    try {
        $strict = New-Object Text.UTF8Encoding($false, $true)
        $text = $strict.GetString($bytes)
    } catch {
        $text = [Text.Encoding]::Default.GetString($bytes)
    }
    return ($text -replace "^\uFEFF", '')
}

# Tidy a child process' output for the report: drop ANSI/color sequences and
# split the \r-rewritten progress bars onto their own lines.
# When it has to cut, keep BOTH ends: winget prints its actual complaint first
# and then a wall of usage text, while progress output ends with the summary.
# Keeping only the tail (as an earlier version did) hid the real error.
function Format-NativeOutput {
    param([string]$Text, [int]$MaxLines = 12)
    if (-not $Text) { return '' }
    $clean = $Text -replace '\x1b\[[0-9;?]*[a-zA-Z]', ''
    $lines = @($clean -split "`r|`n" | ForEach-Object { $_.TrimEnd() } | Where-Object { $_.Trim() -ne '' })
    if ($lines.Count -gt $MaxLines) {
        $head = [int][Math]::Ceiling($MaxLines / 2)
        $tail = $MaxLines - $head
        $skipped = $lines.Count - $MaxLines
        $lines = @($lines[0..($head - 1)]) +
                 @("... ($skipped lines omitted) ...") +
                 @($lines[($lines.Count - $tail)..($lines.Count - 1)])
    }
    return ($lines -join "`n")
}

# Run a native program and return its output as plain text.
# Routed through "cmd /c" with real redirection files on purpose. Doing it
# directly from PowerShell 5.1 hits three traps:
#   * inline arguments lose their double quotes on the way to the child process
#   * any stderr output becomes a loud NativeCommandError record
#   * Start-Process -RedirectStandardOutput is blocked in locked-down setups
#
# With -Live the child's stdout is sent to the console device ("> CON") instead
# of a file, so a long download can draw its own progress bar. Two details:
#   * "> CON" also keeps the output OUT of PowerShell's pipeline. Left
#     un-redirected inside a function, native stdout silently becomes part of
#     the function's return value (the caller then gets a mixed array and the
#     progress is never shown).
#   * only used when stdout really is a console - if it is redirected there is
#     no console to draw on, and the file capture below is the right thing.
function Invoke-Native {
    param([string]$Exe, [string[]]$ArgList = @(), [switch]$Live)
    $outFile = [IO.Path]::GetTempFileName()
    $errFile = [IO.Path]::GetTempFileName()
    try {
        $line = '"' + $Exe + '"'
        foreach ($a in $ArgList) {
            if ($a -match '\s') { $line += ' "' + $a + '"' } else { $line += ' ' + $a }
        }
        if ($Live -and $script:LiveProgress) {
            $line += ' > CON'
        } else {
            $line += ' > "' + $outFile + '"'
        }
        $line += ' 2> "' + $errFile + '"'
        cmd /c $line | Out-Null
        $code = $LASTEXITCODE
        $text = (@((Read-Captured $outFile), (Read-Captured $errFile)) | Where-Object { $_ }) -join "`n"
        return @{ ExitCode = $code; Text = ($text -replace "`r`n", "`n").Trim() }
    } finally {
        Remove-Item $outFile, $errFile -Force -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------- Python ----

function Find-Python {
    $cands = New-Object System.Collections.ArrayList

    foreach ($name in @('python', 'python3')) {
        $c = Get-Command $name -ErrorAction SilentlyContinue
        if ($c) { [void]$cands.Add(@{ Exe = $c.Source; Args = @() }) }
    }
    $launcher = Get-Command py -ErrorAction SilentlyContinue
    if ($launcher) { [void]$cands.Add(@{ Exe = $launcher.Source; Args = @('-3') }) }

    # PATH can be stale right after an install (or the user never ticked
    # "Add python.exe to PATH"), so scan the usual install roots as well.
    $roots = @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python'),
        (Join-Path $env:ProgramFiles 'Python')
    )
    if (${env:ProgramFiles(x86)}) { $roots += (Join-Path ${env:ProgramFiles(x86)} 'Python') }
    foreach ($root in $roots) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $exe = Join-Path $_.FullName 'python.exe'
            if (Test-Path $exe) { [void]$cands.Add(@{ Exe = $exe; Args = @() }) }
        }
    }

    foreach ($c in $cands) {
        # The Microsoft Store "app execution alias" lives in WindowsApps and
        # would pop up the Store instead of running Python. Skip that stub.
        if ($c.Exe -like '*\WindowsApps\*') { continue }
        $args2 = @($c.Args) + @('--version')
        $r = Invoke-Native -Exe $c.Exe -ArgList $args2
        if ($r.Text -match 'Python (\d+)\.(\d+)\.(\d+)') {
            $v = [version]("$($Matches[1]).$($Matches[2]).$($Matches[3])")
            if ($v -ge [version]'3.6') {
                return @{ Exe = $c.Exe; Args = @($c.Args); Version = $v; Text = ($r.Text -split "`n")[0] }
            }
        }
    }
    return $null
}

# Changing a winget source needs an administrator token; winget refuses with
# "administrator privileges are required" otherwise.
function Test-IsAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        $p = New-Object Security.Principal.WindowsPrincipal($id)
        return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch {
        return $false
    }
}

# Put winget's community source back to the official one.
# Used when a mirror switch fails, so winget is never left without a source.
function Restore-WingetOfficialSource {
    param([string]$WingetPath)
    Invoke-Native -Exe $WingetPath -ArgList @('source', 'remove', 'winget') | Out-Null
    Invoke-Native -Exe $WingetPath -ArgList @('source', 'add', 'winget', $script:OfficialSourceUrl) | Out-Null
}

# Point the "winget" community source at a domestic mirror and prove it works.
# Called only when this process is already elevated.
# Two compatibility details, both confirmed against the providers' docs:
#   * --trust-level exists on winget >= 1.8 only, so retry without it (a v1.2
#     image rejects the whole command otherwise)
#   * removing the source first means a failed add, or a mirror that cannot
#     serve an index, would leave winget with no community source at all - so
#     the official URL is restored on every failure path
function Set-WingetMirror {
    param([string]$WingetPath, [string]$Url)
    $r = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'remove', 'winget')
    if ($r.ExitCode -ne 0) { return @{ Ok = $false; Text = $r.Text; RolledBack = $false } }

    $r = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'add', 'winget', $Url, '--trust-level', 'trusted')
    if ($r.ExitCode -ne 0) {
        $r = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'add', 'winget', $Url)
    }
    if ($r.ExitCode -ne 0) {
        Restore-WingetOfficialSource $WingetPath
        return @{ Ok = $false; Text = $r.Text; RolledBack = $true }
    }

    # Verify the mirror can actually serve the index. Without this check a
    # switched-but-unreachable mirror would leave winget worse than before.
    $u = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'update', '--accept-source-agreements')
    if ($u.ExitCode -ne 0) {
        $u = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'update')
    }
    if ($u.ExitCode -ne 0) {
        Restore-WingetOfficialSource $WingetPath
        return @{ Ok = $false; Text = $u.Text; RolledBack = $true }
    }
    return @{ Ok = $true; Text = ''; RolledBack = $false }
}

function Update-WingetSources {
    param([string]$WingetPath)
    Line '      refreshing winget sources (winget source update) ...'
    # Old winget (e.g. v1.2 shipped on some Windows 11 images) rejects
    # --accept-source-agreements on "source update" and only takes [-n <name>],
    # so retry without the flag before calling it a failure.
    $r = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'update', '--accept-source-agreements')
    if ($r.ExitCode -ne 0) {
        $r = Invoke-Native -Live -Exe $WingetPath -ArgList @('source', 'update')
    }
    if ($r.ExitCode -ne 0) {
        $txt = Format-NativeOutput $r.Text
        if ($txt) { Line ("      " + ($txt -replace "`n", "`n      ")) }
    }
    return ($r.ExitCode -eq 0)
}

function Install-Python {
    $wg = Get-Command winget -ErrorAction SilentlyContinue
    if (-not $wg) {
        Warn 'winget is not available, cannot install Python automatically.'
        Hint 'Install Python 3 manually: https://www.python.org/downloads/windows/'
        Hint 'IMPORTANT: tick "Add python.exe to PATH" in the installer.'
        return $false
    }

    # Reporting the version matters: a very old App Installer/winget is itself a
    # common reason installs fail.
    $wv = (Invoke-Native -Exe $wg.Source -ArgList @('--version')).Text
    if ($wv) { Line ("      winget version: " + (($wv -split "`n")[0])) }

    # Network: switch to a domestic mirror before touching the source index, so
    # the refresh and the download do not go through cdn.winget.microsoft.com.
    $sourcesReady = $false
    if ($script:UseMirror) {
        if (Test-IsAdmin) {
            Line ("      switching the winget source to " + $script:MirrorUrl)
            $m = Set-WingetMirror -WingetPath $wg.Source -Url $script:MirrorUrl
            if ($m.Ok) {
                $sourcesReady = $true
                Ok 'winget source switched to the domestic mirror, and it works'
            } else {
                Warn ('could not use the winget mirror: ' + (($m.Text -split "`n")[0]))
                if ($m.RolledBack) { Hint 'the official source was restored, nothing was left broken' }
            }
        } else {
            Hint 'tip: in China the winget download often stalls or fails because'
            Hint 'cdn.winget.microsoft.com is slow. To switch to a domestic mirror,'
            Hint 'open an ADMIN terminal and run these two lines (winget requires'
            Hint 'administrator rights to change a source):'
            Hint '  winget source remove winget'
            Hint ('  winget source add winget ' + $script:MirrorUrl + ' --trust-level trusted')
            Hint '(on winget <= 1.7 leave off --trust-level)'
            Hint 'Then run this script again.'
            Hint 'Or start this script from an admin terminal and it does it for you.'
        }
    }

    if (-not $sourcesReady) {
        # A fresh Windows image often has an empty or broken winget source index
        # ("0x8a15000f : Data required by the source is missing"), which makes
        # every install fail before winget even looks at the package. Refresh it;
        # this is non-destructive (unlike "winget source reset").
        if (-not (Update-WingetSources $wg.Source)) {
            Warn 'winget source update failed - the source index may be unusable.'
            Hint 'Repair it, then re-run this script:'
            Hint '  winget source reset --force'
            Hint '  winget source update'
            Hint 'An outdated App Installer is a common cause - update it from the'
            Hint 'Microsoft Store, or install Python by hand (see the link below).'
        }
    }

    # Deliberately no --disable-interactivity: winget older than ~1.4 does not
    # know that flag and then refuses the whole command with a usage dump.
    # --silent already keeps the installer itself prompt-free.
    $installedButNotVisible = $false
    foreach ($id in @('Python.Python.3.13', 'Python.Python.3.12', 'Python.Python.3.11')) {
        Line ''
        Line ("      installing " + $id)
        if ($script:LiveProgress) {
            Line '      winget draws its own download progress bar below; it may take'
            Line '      a few minutes - please wait, do not close this window.'
        } else {
            Line '      downloading and installing (progress bar off: output is'
            Line '      redirected). It may take a few minutes - please wait.'
        }
        Line ''
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $r = Invoke-Native -Live -Exe $wg.Source -ArgList @(
            'install', '--id', $id, '--exact', '--silent',
            '--accept-package-agreements', '--accept-source-agreements')
        $sw.Stop()
        $secs = [Math]::Round($sw.Elapsed.TotalSeconds, 1)
        if ($r.ExitCode -eq 0) {
            Ok ("winget finished OK after " + $secs + "s")
        } else {
            Warn ("winget exited with code " + $r.ExitCode + " after " + $secs + "s")
            $txt = Format-NativeOutput $r.Text
            if ($txt) { Line ("      " + ($txt -replace "`n", "`n      ")) }
        }
        Sync-Path
        if (Find-Python) { return $true }
        if ($r.ExitCode -eq 0) {
            # winget says it installed, but this session cannot see python yet.
            # Stop instead of installing the next version on top of it.
            $installedButNotVisible = $true
            break
        }
    }

    if ($installedButNotVisible) {
        Warn 'winget reported success, but python is not visible in this session.'
        Hint 'Close this window, open a new one, and run this script again.'
        return $false
    }
    Warn 'winget could not install Python.'
    Hint 'Install Python 3 manually: https://www.python.org/downloads/windows/'
    Hint 'IMPORTANT: tick "Add python.exe to PATH" in the installer.'
    return $false
}

# ------------------------------------------------------------ stdlib check --

function Test-PythonUsable {
    param($Py)
    # Written to a real file instead of "python -c": PowerShell 5.1 strips
    # double quotes when passing an inline program to a native command.
    $probeFile = Join-Path $env:TEMP ('mv-env-probe-' + [guid]::NewGuid().ToString('N') + '.py')
    $probe = @'
import socket, sys
mods = ["gzip", "http.server", "json", "os", "socketserver", "subprocess", "tempfile", "email.utils"]
missing = []
for m in mods:
    try:
        __import__(m)
    except Exception:
        missing.append(m)
if missing:
    print("MISSING:" + ",".join(missing))
    sys.exit(1)
s = socket.socket()
s.bind(("127.0.0.1", 0))
print("OK port=%d" % s.getsockname()[1])
s.close()
'@
    try {
        [IO.File]::WriteAllText($probeFile, $probe, (New-Object Text.UTF8Encoding($false)))
        $args2 = @($Py.Args) + @($probeFile)
        $r = Invoke-Native -Exe $Py.Exe -ArgList $args2
        if ($r.Text -match 'OK port=(\d+)') { return @{ Ok = $true; Text = $r.Text } }
        return @{ Ok = $false; Text = $r.Text }
    } finally {
        Remove-Item $probeFile -Force -ErrorAction SilentlyContinue
    }
}

# ------------------------------------------------------------ components ----

# Resolve an executable through the registry "App Paths" keys. Installers
# register themselves there, so this catches installs that are not in the
# folders guessed below (slim Windows images, per-user installs, custom drives).
function Get-RegisteredExe {
    param([string]$ExeName)
    $keys = @(
        "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$ExeName",
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\$ExeName",
        "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$ExeName"
    )
    foreach ($k in $keys) {
        try {
            $v = (Get-ItemProperty -Path $k -ErrorAction Stop).'(default)'
            if ($v -and (Test-Path -LiteralPath $v)) { return $v }
        } catch { }
    }
    return $null
}

# Join-Path throws on a null root, and %ProgramFiles(x86)% is absent on 32-bit
# systems, so guard it.
function Join-IfRoot {
    param([string]$Root, [string]$Rel)
    if (-not $Root) { return $null }
    return (Join-Path $Root $Rel)
}

function Test-Browser {
    $found = New-Object System.Collections.ArrayList
    $cands = @(
        @{ Name = 'Microsoft Edge'; Exe = 'msedge.exe'; Path = @(
            (Join-IfRoot $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
            (Join-IfRoot ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
            (Join-IfRoot $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')) },
        @{ Name = 'Google Chrome'; Exe = 'chrome.exe'; Path = @(
            (Join-IfRoot $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
            (Join-IfRoot ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
            (Join-IfRoot $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')) }
    )
    foreach ($b in $cands) {
        $hit = $null
        foreach ($p in $b.Path) {
            if ($p -and (Test-Path -LiteralPath $p)) { $hit = $p; break }
        }
        if (-not $hit) { $hit = Get-RegisteredExe $b.Exe }
        if ($hit) { [void]$found.Add("$($b.Name)  ->  $hit") }
    }
    return $found
}

# Prince is optional: only needed if you own a license and prefer its typesetting.
# PDF export defaults to the built-in Edge / Chrome and needs no installation.
function Install-PrinceFromZip {
    param([string]$Zip)
    if (-not (Test-Path $Zip)) { Warn "PrinceZip not found: $Zip"; return }
    $target = Join-Path $env:LOCALAPPDATA 'Programs\Prince'
    Line ("      extracting to " + $target)
    if (Test-Path $target) { Remove-Item $target -Recurse -Force -ErrorAction SilentlyContinue }
    New-Item -ItemType Directory -Path $target -Force | Out-Null
    try {
        Expand-Archive -LiteralPath $Zip -DestinationPath $target -Force
    } catch {
        Warn ("extract failed: " + $_.Exception.Message)
        return
    }
    $exe = Get-ChildItem $target -Recurse -Filter 'prince.exe' -ErrorAction SilentlyContinue |
           Select-Object -First 1
    if (-not $exe) { Warn 'prince.exe not found inside the zip.'; return }
    $bin = $exe.Directory.FullName
    if (Add-UserPath $bin) { Ok ("added to user PATH: " + $bin) } else { Ok ("already on PATH: " + $bin) }
}

# ------------------------------------------------------------------ main ----

Line ''
Line '=============================================================='
Line '  Markdown Viewer - environment setup / health check'
Line '=============================================================='
if ($Check) { Line '  mode: CHECK ONLY (nothing will be installed)' }
Line ("  time: " + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Line ("  host: " + $env:COMPUTERNAME + "   powershell: " + $PSVersionTable.PSVersion)

# --- 1. Python -------------------------------------------------------------
Step '1) Python 3.6+  (required - runs serve.py, the local server)'
$py = Find-Python
if ($py) {
    Ok ("found: " + $py.Text)
    Hint ("path: " + $py.Exe)
} elseif ($Check) {
    Bad 'Python 3.6+ not found.'
    Hint 'Re-run without -Check to let this script install it via winget,'
    Hint 'or install manually: https://www.python.org/downloads/windows/'
} else {
    Warn 'Python 3.6+ not found, trying to install it ...'
    if (Install-Python) { $py = Find-Python }
    if ($py) {
        # "available" rather than "installed": the post-install PATH refresh can
        # also reveal a Python that was already on disk but not on PATH.
        Ok ("Python is now available: " + $py.Text)
        Hint ("path: " + $py.Exe)
    } else {
        Bad 'Python 3.6+ is still not available.'
    }
}

# --- 2. browser ------------------------------------------------------------
Step '2) Modern browser  (required - Edge or Chrome)'
$browsers = Test-Browser
if ($browsers.Count -gt 0) {
    foreach ($b in $browsers) { Ok $b }
} else {
    Bad 'No Edge / Chrome found.'
    Hint 'Looked for msedge.exe / chrome.exe in Program Files,'
    Hint 'Program Files (x86), LocalAppData and the registry App Paths keys.'
    Hint 'The viewer needs Chrome or Edge for the File System Access API'
    Hint '(open a folder / write edits back to disk).'
    Hint 'Install one with:  winget install --id Google.Chrome'
    Hint '              or:  winget install --id Microsoft.Edge'
    Hint 'If winget is unavailable, download one manually:'
    Hint '  https://www.google.com/chrome/     https://www.microsoft.com/edge'
}

# --- 3. stdlib self-check --------------------------------------------------
Step '3) Python standard library self-check  (what serve.py actually needs)'
if ($py) {
    $r = Test-PythonUsable $py
    if ($r.Ok) {
        Ok ("all required modules import, TCP bind works (" + $r.Text + ")")
    } else {
        Bad ("python self-check failed: " + $r.Text)
    }
} else {
    Skip 'skipped, no usable Python.'
}

# --- 4. PDF engine (Edge / Chrome) ----------------------------------------
Step '4) PDF export engine  (Edge / Chrome, no install needed)'
$browser = $null
$browserName = ''
foreach ($cand in @(
    @{ Name = 'Microsoft Edge';   Path = (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe') },
    @{ Name = 'Microsoft Edge';   Path = (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe') },
    @{ Name = 'Google Chrome';    Path = (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe') },
    @{ Name = 'Google Chrome';    Path = (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe') },
    @{ Name = 'Google Chrome';    Path = (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe') }
)) {
    if ($cand.Path -and (Test-Path $cand.Path)) { $browser = $cand.Path; $browserName = $cand.Name; break }
}
if (-not $browser) {
    foreach ($cmd in @('msedge', 'chrome', 'chromium')) {
        $g = Get-Command $cmd -ErrorAction SilentlyContinue
        if ($g) { $browser = $g.Source; $browserName = $cmd; break }
    }
}
if ($browser) {
    Ok ("found: " + $browserName)
    Hint ("path: " + $browser)
    Hint 'PDF export works out of the box and produces NO watermark.'
} else {
    Warn 'No Edge / Chrome found - "export PDF" will be unavailable (everything else works).'
    Hint 'Install Microsoft Edge or Google Chrome, or point MD_PDF_BROWSER at a browser:'
    Hint '  set MD_PDF_BROWSER=D:\Tools\Chrome\chrome.exe'
}

# --- 5. Prince (optional, only if you own a license) ----------------------
$prince = Get-Command prince -ErrorAction SilentlyContinue
if ($prince) {
    $pv = Invoke-Native -Exe $prince.Source -ArgList @('--version')
    Hint ("prince also detected: " + (($pv.Text -split "`n")[0]) + "  (optional)")
    if ($pv.Text -match 'Non-commercial') {
        Hint 'license: Non-commercial - its output carries a "Prince" watermark.'
        Hint 'To use it instead of the browser: set MD_PDF_ENGINE=prince (needs a paid license to drop the watermark).'
    }
}

# --- summary ---------------------------------------------------------------
Step 'Summary'
if ($script:Problems -eq 0) {
    Write-Host '  READY - the environment can run the viewer.' -ForegroundColor Green
} else {
    Write-Host ("  NOT READY - " + $script:Problems + " required item(s) missing.") -ForegroundColor Red
}
if ($script:Warnings -gt 0) { Line ("  (" + $script:Warnings + " warning(s) above)") }
Line ''
Line '  Next steps:'
Line '    * start the local server:  double-click start.bat'
Line '                               (or run:  python serve.py)'
Line '    * then open:               http://localhost:8000'
Line '    * or just double-click index.html for basic browsing (no PDF export)'
Line ''
if ($Check) { Line '  (check-only mode: nothing was installed)'; Line '' }

if ($script:Problems -gt 0) { exit 1 }
exit 0
