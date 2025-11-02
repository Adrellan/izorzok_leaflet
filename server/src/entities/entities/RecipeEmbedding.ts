import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { Recipe } from "./Recipe";

@Index("recipe_embedding_ivfflat_idx", ["embedding"], {})
@Index("RecipeEmbedding_pkey", ["recipeId"], { unique: true })
@Entity("RecipeEmbedding", { schema: "public" })
export class RecipeEmbedding {
  @Column("bigint", { primary: true, name: "recipe_id" })
  recipeId: string;

  @Column("text", { name: "model" })
  model: string;

  @Column("integer", { name: "dim" })
  dim: number;

  // The database column uses a custom type (e.g. pgvector "vector").
  // TypeORM 0.3.x does not support it out of the box during metadata init.
  // Map it to a supported type to avoid initialization errors (we don't mutate it here).
  @Column("text", { name: "embedding" })
  embedding: string;

  @OneToOne(() => Recipe, (recipe) => recipe.recipeEmbedding, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "recipe_id", referencedColumnName: "id" }])
  recipe: Recipe;
}
