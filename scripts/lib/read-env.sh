#!/usr/bin/env bash
# Safely read a single KEY=value from .env without sourcing the whole file.

read_env_var() {
  local key="$1"
  local default="${2:-}"
  if [ ! -f .env ]; then
    printf '%s' "$default"
    return
  fi
  local line
  line="$(grep -E "^${key}=" .env | tail -1 | cut -d= -f2- | tr -d '\r')"
  if [ -z "$line" ]; then
    printf '%s' "$default"
    return
  fi
  line="${line#\"}"
  line="${line%\"}"
  line="${line#\'}"
  line="${line%\'}"
  printf '%s' "$line"
}
