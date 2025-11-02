import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Settlement } from "./Settlement";

@Index("Region_pkey", ["id"], { unique: true })
@Entity("Region", { schema: "public" })
export class Region {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("geometry", { name: "geom", nullable: true })
  geom: string | null;

  @Column("character varying", { name: "name", nullable: true })
  name: string | null;

  @OneToMany(() => Settlement, (settlement) => settlement.region)
  settlements: Settlement[];
}
