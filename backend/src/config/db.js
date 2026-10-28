import fs from 'node:fs';
import path from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from './env.js';

function createSequelize() {
  if (env.databaseUrl) {
    return new Sequelize(env.databaseUrl, { logging: false });
  }
  if (env.db.name) {
    const { name, user, password, host, port, logging } = env.db;
    return new Sequelize(name, user, password, {
      dialect: 'postgres',
      host,
      port,
      logging: logging ? console.log : false,
    });
  }
  const storage = path.resolve(env.dbStorage);
  fs.mkdirSync(path.dirname(storage), { recursive: true });
  return new Sequelize({ dialect: 'sqlite', storage, logging: false });
}

export const sequelize = createSequelize();

export const isPostgres = () => sequelize.getDialect() === 'postgres';
