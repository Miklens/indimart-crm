@echo off
REM Build APK Script for Indimart App
cd /d "%~dp0\android"

REM Try to find Java in common locations
for %%A in (
  "C:\Program Files\Java\*\bin\java.exe"
  "C:\Program Files (x86)\Java\*\bin\java.exe"
  "%LOCALAPPDATA%\Programs\Java\*\bin\java.exe"
) do (
  if exist %%A (
    for %%B in (%%~dp0..\..) do set "JAVA_HOME=%%B"
    goto found_java
  )
)

echo Java not found in standard locations
echo Please install Java 17 from: https://adoptium.net
echo Then try again
pause
exit /b 1

:found_java
echo Found Java at: %JAVA_HOME%
set PATH=%JAVA_HOME%\bin;%PATH%

echo Building APK...
call gradlew.bat assembleRelease

if %ERRORLEVEL% EQU 0 (
  echo.
  echo SUCCESS! APK built at:
  echo %cd%\app\build\outputs\apk\release\app-release.apk
  echo.
  pause
) else (
  echo Build failed. Check error messages above.
  pause
  exit /b 1
)
