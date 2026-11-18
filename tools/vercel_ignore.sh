#!/usr/bin/env bash
# `ignoreCommand` de vercel.json: Vercel lo ejecuta al empezar cada build.
# Salir con 0 cancela el build; con 1, compila.
#
# Varias sesiones suben a master seguidas y Vercel compila de una en una, así que
# la cola se llenaba de commits que ya nadie iba a servir. Un build de master
# cuyo commit ya no es la punta se salta: el de la punta lo incluye todo.
# Si no se puede saber la punta (red, otro repositorio), se compila.
set -u
[ "${VERCEL_GIT_COMMIT_REF:-}" = "master" ] || exit 1
repo="https://github.com/${VERCEL_GIT_REPO_OWNER:-borjamoskv}/${VERCEL_GIT_REPO_SLUG:-naroa.online}.git"
tip=$(timeout 15 git ls-remote "$repo" refs/heads/master 2>/dev/null | cut -f1)
if [ -n "$tip" ] && [ -n "${VERCEL_GIT_COMMIT_SHA:-}" ] && [ "$tip" != "$VERCEL_GIT_COMMIT_SHA" ]; then
  echo "Se salta ${VERCEL_GIT_COMMIT_SHA:0:7}: master ya va por ${tip:0:7}, que lo incluye."
  exit 0
fi
exit 1
