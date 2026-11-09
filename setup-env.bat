@echo off
rem ===========================================================================
rem  setup-env.bat - one-click environment setup for Markdown Viewer.
rem
rem  Just double-click this file. It runs setup-env.ps1 next to it.
rem
rem  Usage:
rem    setup-env.bat                  check, then install what is missing
rem    setup-env.bat -Check           report only, change nothing
rem    setup-env.bat -PrinceZip PATH  install Prince from a local zip (opt-in)
rem
rem  ASCII-only on purpose: this file must look the same on any console codepage.
rem ===========================================================================
setlocal
title Markdown Viewer - environment setup

set "PS1=%~dp0setup-env.ps1"
if not exist "%PS1%" (
    echo [x] setup-env.ps1 was not found next to this file.
    echo     Keep setup-env.bat and setup-env.ps1 in the same folder.
    echo.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" %*
set "RC=%ERRORLEVEL%"

echo.
if "%RC%"=="0" (
    echo [ok] finished, exit code 0
) else (
    echo [x] finished with exit code %RC%
)
echo.
pause
exit /b %RC%
