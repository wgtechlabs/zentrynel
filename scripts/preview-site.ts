import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../site');
const port = Number(Bun.env.PORT ?? 4173);

const server = Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		const pathname = url.pathname === '/' ? '/index.html' : url.pathname;
		const file = Bun.file(resolve(root, `.${pathname}`));

		if (!(await file.exists())) {
			return new Response('Not found', { status: 404 });
		}

		return new Response(file);
	},
});

console.log(`Landing page preview: http://localhost:${server.port}`);
