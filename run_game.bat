@echo off
set "GODOT=D:\Godot\Godot_v4.7.2-stable_win64.exe"
if not exist "%GODOT%" set "GODOT=godot"
start "" "%GODOT%" --path "%~dp0godot" %*
