:start
@echo off
title Nebula Services Backend
concurrently "node src/index.js" "node --no-deprecation src/api/Hype.js" "node --no-deprecation src/api/vbucks.js" "node --no-deprecation src/api/Lawin.js"
@echo on
goto start