@ECHO OFF
SETLOCAL enabledelayedexpansion
SET DRIVE=F:
SET CTA_PATH=\\lx-eu-etapshare-prod1.emea1.ciscloud\public
ipconfig | FIND /I "amers2.ciscloud" >NUL
IF %ERRORLEVEL% == 0 (
    SET CTA_PATH=\\lx-eu-etapshare-prod2.amers2.ciscloud\public
)

IF /I [%1] == [false] (
    ECHO No shared drive
    GOTO :EOF
)

IF NOT [%1] == [] SET DRIVE=%~1
IF NOT [%2] == [] SET CTA_PATH=%~2

NET USE | findstr /I /R "^OK.*!DRIVE!.*!CTA_PATH:\=\\!" >NUL
IF ERRORLEVEL 1 (
    NET USE !DRIVE! /DELETE 2>NUL
    NET USE !CTA_PATH! /DELETE 2>NUL
    NET USE !DRIVE! /PERSISTENT:YES !CTA_PATH! eikonTest12 /USER:Administrator
    ECHO Shared drive !DRIVE! on !CTA_PATH! created
) ELSE (
    ECHO Shared drive !DRIVE! on !CTA_PATH! already available
)


