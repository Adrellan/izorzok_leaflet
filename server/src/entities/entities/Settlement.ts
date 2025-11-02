import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Recipe } from "./Recipe";
import { Region } from "./Region";

@Index("Settlement_pkey", ["id"], { unique: true })
@Index("fki_fk_region_regionid", ["regionid"], {})
@Entity("Settlement", { schema: "public" })
export class Settlement {
  @Column("integer", { primary: true, name: "id" })
  id: number;

  @Column("text", { name: "name", nullable: true })
  name: string | null;

  @Column("integer", { name: "regionid", nullable: true })
  regionid: number | null;

  @Column("geometry", { name: "geom", nullable: true })
  geom: string | null;

  @OneToMany(() => Recipe, (recipe) => recipe.settlement)
  recipes: Recipe[];

  @ManyToOne(() => Region, (region) => region.settlements)
  @JoinColumn([{ name: "regionid", referencedColumnName: "id" }])
  region: Region;
}
