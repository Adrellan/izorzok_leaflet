import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCategory1762173481638 implements MigrationInterface {
    name = 'CreateCategory1762173481638'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "Category" ("id" SERIAL NOT NULL, "name" character varying, CONSTRAINT "PK_c2727780c5b9b0c564c29a4977c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "Category_pkey" ON "Category" ("id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."Category_pkey"`);
        await queryRunner.query(`DROP TABLE "Category"`);
    }

}
