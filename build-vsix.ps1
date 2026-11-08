param([string]$OutDir = "$PSScriptRoot\dist")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = $PSScriptRoot
$pkg = Get-Content (Join-Path $src 'package.json') -Raw | ConvertFrom-Json
$version = $pkg.version
$publisher = $pkg.publisher
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$vsix = Join-Path $OutDir ("send2claude-" + $version + ".vsix")
if (Test-Path $vsix) { Remove-Item $vsix -Force }

$contentTypes = @'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="md" ContentType="text/markdown"/>
</Types>
'@

$manifest = @'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="send2claude" Version="__VERSION__" Publisher="__PUBLISHER__"/>
    <DisplayName>Send to Claude Code</DisplayName>
    <Description xml:space="preserve">Add file references to Claude Code chat from Explorer / editor context menu.</Description>
    <Categories>Other</Categories>
    <Properties>
      <Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.94.0" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionDependencies" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.ExtensionPack" Value="" />
      <Property Id="Microsoft.VisualStudio.Code.LocalizedLanguages" Value="" />
    </Properties>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
'@

$manifest = $manifest.Replace('__VERSION__', $version).Replace('__PUBLISHER__', $publisher)

function Add-Entry($zip, $name, $text) {
    $e = $zip.CreateEntry($name)
    $s = $e.Open()
    $sw = New-Object System.IO.StreamWriter($s, (New-Object System.Text.UTF8Encoding($false)))
    $sw.Write($text)
    $sw.Dispose()
}

$zip = [System.IO.Compression.ZipFile]::Open($vsix, 'Create')
try {
    Add-Entry $zip '[Content_Types].xml' $contentTypes
    Add-Entry $zip 'extension.vsixmanifest' $manifest
    foreach ($f in @('package.json', 'extension.js')) {
        $text = [IO.File]::ReadAllText((Join-Path $src $f))
        Add-Entry $zip ("extension/" + $f) $text
    }
}
finally {
    $zip.Dispose()
}

Write-Host "VSIX written: $vsix"
