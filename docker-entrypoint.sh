#!/bin/sh
set -eu

db_path="${DB_PATH:-/usr/src/app/data/zentrynel.db}"
case "$db_path" in
	/*) db_dir=$(dirname "$db_path") ;;
	*) db_dir=$(dirname "/usr/src/app/$db_path") ;;
esac
mkdir -p "$db_dir"
chown -R nodejs:nodejs "$db_dir"

exec su-exec nodejs "$@"