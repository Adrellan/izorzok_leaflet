import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Settlement } from "./Settlement";
import { RecipeEmbedding } from "./RecipeEmbedding";

@Index("Recipe_pkey", ["id"], { unique: true })
@Index("Recipe_url_key", ["url"], { unique: true })
@Index("recipe_year_idx", ["year"], {})
@Entity("Recipe", { schema: "public" })
export class Recipe {
  @PrimaryGeneratedColumn({ type: "bigint", name: "id" })
  id: string;

  @Column("text", { name: "url", unique: true })
  url: string;

  @Column("text", { name: "title" })
  title: string;

  @Column("integer", { name: "year", nullable: true })
  year: number | null;

  @Column("text", { name: "settlement_name", nullable: true })
  settlementName: string | null;

  @Column("text", { name: "ingredients_text" })
  ingredientsText: string;

  @Column("timestamp with time zone", {
    name: "created_at",
    default: () => "now()",
  })
  createdAt: Date;

  @ManyToOne(() => Settlement, (settlement) => settlement.recipes)
  @JoinColumn([{ name: "settlement_id", referencedColumnName: "id" }])
  settlement: Settlement;

  @OneToOne(() => RecipeEmbedding, (recipeEmbedding) => recipeEmbedding.recipe)
  recipeEmbedding: RecipeEmbedding;
}
