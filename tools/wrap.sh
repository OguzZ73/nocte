#!/bin/sh
# artifact.html (Claude Artifact sürümü, doctype'sız) → index.html (normal sunucular için tam belge)
cd "$(dirname "$0")/.."
{
  printf '<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>[hidden]{display:none!important}img{max-width:100%%}</style>\n</head>\n<body>\n'
  cat artifact.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "index.html written"
