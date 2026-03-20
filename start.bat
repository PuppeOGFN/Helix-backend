:start
@echo off
title Helix backend
concurrently "node src/index.js" "node --no-deprecation src/api/Hype.js" "node --no-deprecation src/api/vbucks.js" "node --no-deprecation src/api/Lawin.js" "node --no-deprecation src/api/xp.js"
@echo on
goto start