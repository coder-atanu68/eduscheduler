@echo off
set GIT="C:\Program Files\Git\cmd\git.exe"
%GIT% config --global user.email "coder-atanu68@github.com"
%GIT% config --global user.name "coder-atanu68"
%GIT% add .
%GIT% commit -m "Migrate to Python Graph Coloring algorithm and deploy fixes"
%GIT% branch -M main
%GIT% remote remove origin 2>nul
%GIT% remote add origin https://github.com/coder-atanu68/eduscheduler.git
%GIT% push -u origin main
echo DONE
