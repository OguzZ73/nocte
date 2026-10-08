#!/bin/sh
# Wraps the artifact-style index.html in a full document for local preview / static hosting.
cd "$(dirname "$0")/.."
{
  printf '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>[hidden]{display:none!important}img{max-width:100%%}</style>\n</head>\n<body>\n'
  cat index.html
  printf '\n</body>\n</html>\n'
} > preview.html
echo "preview.html written"
