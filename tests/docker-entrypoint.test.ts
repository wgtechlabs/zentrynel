import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('uses the Railway-mounted path as the default SQLite database directory', () => {
	const entrypoint = readFileSync(resolve(process.cwd(), 'docker-entrypoint.sh'), 'utf8');

	expect(entrypoint).toContain('db_path="${DB_PATH:-/app/data/zentrynel.db}"');
});
