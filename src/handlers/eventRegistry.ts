import * as guildCreate from '../events/guildCreate.js';
import * as guildDelete from '../events/guildDelete.js';
import * as guildMemberAdd from '../events/guildMemberAdd.js';
import * as interactionCreate from '../events/interactionCreate.js';
import * as messageCreate from '../events/messageCreate.js';
import * as ready from '../events/ready.js';

export const events = [
	guildCreate,
	guildDelete,
	guildMemberAdd,
	interactionCreate,
	messageCreate,
	ready,
];
