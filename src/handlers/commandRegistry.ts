import * as approve from '../commands/approve.js';
import * as ban from '../commands/ban.js';
import * as config from '../commands/config.js';
import * as kick from '../commands/kick.js';
import * as mute from '../commands/mute.js';
import * as purge from '../commands/purge.js';
import * as version from '../commands/version.js';
import * as warn from '../commands/warn.js';
import * as warnings from '../commands/warnings.js';
import type { Command } from '../types.js';

export const commands: Command[] = [
	approve,
	ban,
	config,
	kick,
	mute,
	purge,
	version,
	warn,
	warnings,
];
