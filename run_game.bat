@echo off
rem Chay ban app Three.js tren may (khong can cai dat): dung app/dist roi mo trinh duyet.
cd /d "%~dp0app"
node build.mjs || (pause & exit /b 1)
start "" http://localhost:8420/index.html
python -m http.server 8420 --bind 127.0.0.1 --directory dist
