import type { Client } from 'discord.js';
import { events } from './eventRegistry.js';
import { logger } from '../utils/logger.js';

export async function loadEvents(client: Client): Promise<void> {
	let count = 0;

	for (const event of events) {
		if (!event.name || !event.execute) {
			logger.warn('Skipping event: missing "name" or "execute" export');
			continue;
		}

		if (event.once) {
			client.once(event.name, (...args: unknown[]) => event.execute(...args, client));
		} else {
			client.on(event.name, (...args: unknown[]) => event.execute(...args, client));
		}

		count++;
	}

	logger.info(`Loaded ${count} events`);
}
