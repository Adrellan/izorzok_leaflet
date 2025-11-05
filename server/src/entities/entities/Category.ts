import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Recipe } from "./Recipe";

@Index("Category_pkey", ["id"], { unique: true })
@Entity("Category", { schema: "public" })
export class Category {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", nullable: true })
  name: string | null;

  @OneToMany(() => Recipe, (recipe) => recipe.category)
  recipes: Recipe[];
}
