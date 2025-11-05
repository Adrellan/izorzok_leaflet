import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Recipe } from '../entities/entities/Recipe';
import { RecipeEmbedding } from '../entities/entities/RecipeEmbedding';
import { Region } from '../entities/entities/Region';
import { Settlement } from '../entities/entities/Settlement';
import { SpatialRefSys } from '../entities/entities/SpatialRefSys';
import { Category } from '../entities/entities/Category';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  synchronize: false,
  logging: false,
  entities: [Recipe, RecipeEmbedding, Region, Settlement, SpatialRefSys, Category],
  migrations: ["src/db/migrations/*{.ts,.js}"],
});

export async function getDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
  return AppDataSource;
}

