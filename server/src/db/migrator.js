import { Umzug, SequelizeStorage } from 'umzug';
import { sequelize } from '../config/db.js';
import * as m001 from './migrations/001-initial-schema.js';

/** Add new migrations to the end of this list; never edit one that has shipped. */
const migrations = [{ name: '001-initial-schema', ...m001 }];

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
