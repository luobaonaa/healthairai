@echo off
setlocal
set "NODE_ENV=development"
set "PATH=C:\Program Files\nodejs;%PATH%"
set "DOTENV_CONFIG_PATH=%~dp0.env.local"
call "%~dp0node_modules\.bin\tsx.cmd" watch "%~dp0server\_core\index.ts"
