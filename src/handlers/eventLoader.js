import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client) {
	const eventsPath = join(__dirname, '..', 'events');
	const files = readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
	let count = 0;

	for (const file of files) {
		const filePath = join(eventsPath, file);
		const event = await import(`file://${filePath}`);

		if (!event.name || !event.execute) {
			logger.warn(`Skipping ${file}: missing "name" or "execute" export`);
			continue;
		}

		if (event.once) {
			client.once(event.name, (...args) => event.execute(...args, client));
		} else {
			client.on(event.name, (...args) => event.execute(...args, client));
		}

		count++;
	}

	logger.info(`Loaded ${count} events`);
}
