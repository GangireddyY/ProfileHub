import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../config/db.js';
import * as m001 from './migrations/001-initial-schema.js';
import * as m002 from './migrations/002-professions-rates-marketplace.js';
import * as m003 from './migrations/003-contact-details.js';
import * as m004 from './migrations/004-location-details.js';

/** Add new migrations to the end of this list; never edit one that has shipped. */
const migrations = [
  { name: '001-initial-schema', ...m001 },
  { name: '002-professions-rates-marketplace', ...m002 },
  { name: '003-contact-details', ...m003 },
  { name: '004-location-details', ...m004 },
];

export const migrator = new Umzug({
  migrations: migrations.map(({ name, up, down }) => ({
    name,
    up: ({ context }) => up({ context }),
    down: ({ context }) => down({ context }),
  })),
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: process.env.MIGRATION_LOGS ? console : undefined,
});
