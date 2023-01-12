import { FieldElement } from '@apibara/starknet'
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class State {
    @PrimaryColumn()
    indexerId: string;

    @Column()
    orderKey: number;

    @Column({ type: "bytea" })
    uniqueKey: Buffer;
}

@Entity()
export class Token {
    @PrimaryColumn()
    id: bigint;

    @Column()
    owner: bigint;

    toJson() {
        return {
            id: FieldElement.toHex(FieldElement.fromBigInt(this.id)),
            owner: FieldElement.toHex(FieldElement.fromBigInt(this.owner)),
        };
    }
}

@Entity()
export class Transfer {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column()
    sender: bigint;

    @Column()
    recipient: bigint;

    @Column()
    tokenId: bigint;

    toJson() {
        return {
            sender: FieldElement.toHex(FieldElement.fromBigInt(this.sender)),
            recipient: FieldElement.toHex(FieldElement.fromBigInt(this.recipient)),
            tokenId: FieldElement.toHex(FieldElement.fromBigInt(this.tokenId)),
        };
    }
}
