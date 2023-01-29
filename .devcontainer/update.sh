#!/usr/bin/env bash

whoami
pwd

rbenv install 2.6.5
rbenv global 2.6.5

gem install compass

ghcup install ghc 9.2.5
ghcup set ghc 9.2.5

stack upgrade
stack setup
