# Windows counterpart of pig-support.sh. Installs, removes, or reports on the PiG
# extension that makes PiG report its state to Herdr, with the same commands and
# messages. Keep the two scripts in step; the tests run the same cases on both.
#
# usage: pig-support.ps1 <install|uninstall|status|refresh>
param([string]$Command = "")

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$SourceFile = Join-Path (Join-Path $Root "extensions") "herdr-agent-state.ts"
$InstallName = "herdr-pig-agent-state.ts"
$Marker = "HERDR_PIG_EXTENSION_VERSION="

# Mirrors PiG's own lookup: PIG_CODING_AGENT_DIR, then PIG_HOME/agent, then ~/.pig/agent.
function Get-AgentDir {
    if ($env:PIG_CODING_AGENT_DIR) {
        return $env:PIG_CODING_AGENT_DIR
    }
    if ($env:PIG_HOME) {
        return (Join-Path $env:PIG_HOME "agent")
    }
    $userHome = if ($env:USERPROFILE) { $env:USERPROFILE } else { $env:HOME }
    return (Join-Path (Join-Path $userHome ".pig") "agent")
}

# Show the result in Herdr when run as a plugin action; stay quiet otherwise.
function Send-Notice([string]$Title, [string]$Body) {
    if ($env:HERDR_ENV -eq "1" -and $env:HERDR_BIN_PATH) {
        try {
            & $env:HERDR_BIN_PATH notification show $Title --body $Body *> $null
        } catch {
        }
    }
}

function Stop-WithError([string]$Message) {
    [Console]::Error.WriteLine("herdr-pig: $Message")
    Send-Notice "PiG support" $Message
    exit 1
}

function Test-Managed([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return $false
    }
    return [bool](Select-String -LiteralPath $Path -SimpleMatch -Pattern $Marker -Quiet)
}

# Uses .NET directly: Get-FileHash fails to load in Windows PowerShell when it is
# started from PowerShell 7, which hands it the wrong module path.
function Test-SameContent([string]$Left, [string]$Right) {
    return [System.IO.File]::ReadAllText($Left) -ceq [System.IO.File]::ReadAllText($Right)
}

$AgentDir = Get-AgentDir
$TargetDir = Join-Path $AgentDir "extensions"
$Target = Join-Path $TargetDir $InstallName

switch ($Command) {
    "install" {
        # With PIG_USE_PI_DIRS=1, PiG loads Pi's extension directory, so Pi would load
        # this file too and report itself to Herdr as PiG.
        if ($env:PIG_USE_PI_DIRS -eq "1") {
            Stop-WithError "PIG_USE_PI_DIRS=1 shares Pi's extension directory; unset it before installing"
        }
        if (-not (Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
            Stop-WithError "extension source missing at $SourceFile"
        }
        if (-not (Test-Path -LiteralPath $AgentDir -PathType Container)) {
            Stop-WithError "PiG agent directory not found at $AgentDir; run pig once first"
        }
        if ((Test-Path -LiteralPath $Target) -and -not (Test-Managed $Target)) {
            Stop-WithError "$Target exists and is not managed by herdr-pig; move it away first"
        }
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
        Copy-Item -LiteralPath $SourceFile -Destination $Target -Force
        Write-Output "installed PiG support to $Target"
        Write-Output "restart pig, or run /reload in a running session"
        Send-Notice "PiG support installed" "Restart pig or run /reload in a running session."
    }
    "uninstall" {
        if (Test-Managed $Target) {
            Remove-Item -LiteralPath $Target -Force
            Write-Output "removed PiG support from $Target"
            Send-Notice "PiG support removed" "Restart pig or run /reload in a running session."
        } elseif (Test-Path -LiteralPath $Target) {
            Stop-WithError "$Target is not managed by herdr-pig; not removing it"
        } else {
            Write-Output "PiG support is not installed at $Target"
            Send-Notice "PiG support" "Not installed."
        }
    }
    "status" {
        if (-not (Test-Managed $Target)) {
            Write-Output "not installed ($Target)"
            Send-Notice "PiG support" "Not installed."
        } elseif (Test-SameContent $SourceFile $Target) {
            Write-Output "installed and current ($Target)"
            Send-Notice "PiG support" "Installed and current."
        } else {
            Write-Output "installed but outdated ($Target)"
            Send-Notice "PiG support" "Installed but outdated. Run Install to update it."
        }
    }
    "refresh" {
        # Startup hook: keep an existing install in step with this plugin's copy.
        # It never installs on its own, so nothing is added without the user asking.
        if ((Test-Managed $Target) -and (Test-Path -LiteralPath $SourceFile -PathType Leaf) -and -not (Test-SameContent $SourceFile $Target)) {
            Copy-Item -LiteralPath $SourceFile -Destination $Target -Force
            Write-Output "refreshed PiG support at $Target"
        }
    }
    default {
        [Console]::Error.WriteLine("usage: pig-support.ps1 <install|uninstall|status|refresh>")
        exit 2
    }
}
