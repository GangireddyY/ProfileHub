import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from './env.js';

function createSequelize() {
  if (env.databaseUrl) {
    return new Sequelize(env.databaseUrl, { logging: false });
  }
  const storage = path.resolve(env.dbStorage);
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  return new Sequelize({ dialect: 'sqlite', storage, logging: false });
}

export const sequelize = createSequelize();

export const isPostgres = () => sequelize.getDialect() === 'postgres';
