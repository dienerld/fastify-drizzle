import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as tables from './schema';
import { env } from '../env';

export const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { schema: tables, logger: false });
