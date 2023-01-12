import { StreamClient, v1alpha2 } from '@apibara/protocol'
import { Filter, FieldElement, v1alpha2 as starknet } from '@apibara/starknet'
import { hash } from 'starknet'
import { EntityManager } from "typeorm";

import { AppDataSource } from "./data-source";
import { State } from "./entities";
import { storageVarAddress, toDecimalAmount } from './utils';
import Long from 'long'


const PROJECT_ADDRESSES = [
    "0x030f5a9fbcf76e2171e49435f4d6524411231f257a1b28f517cf52f82279c06b",
    "0x05a85cf2c715955a5d8971e01d1d98e04c31d919b6d59824efb32cc72ae90e63",
    "0x022ddbb66fabf9ae859de95c499839ff46362128908d5e3d0842368aef8beb31",
    "0x003d062b797ca97c2302bfdd0e9b687548771eda981d417faace4f6913ed8f2a",
    "0x021f433090908c2e7a6672cdbc327f49ac11bcc922611620c2c4e0d915a83382",
    "0x028c87a966e2f1166ba7fa8ae1cd89b47e13abcc676e5f7c508145751bbb7f15",
    "0x05c30f6043246a0c4e45a0316806e053e63746fba3584e1f4fc1d4e7f5300acf",
].map((addr) => FieldElement.fromBigInt(addr));

const transfer_key = [FieldElement.fromBigInt(hash.getSelectorFromName('Transfer'))]

function baseFilter() {
    return Filter.create().withHeader()
}

export class AppIndexer {
    private readonly client: StreamClient;
    private readonly indexerId: string;

    constructor(indexerId: string, url: string, blockNumber: number) {
        this.indexerId = indexerId;

        let filter = baseFilter();
        PROJECT_ADDRESSES.forEach((address) => {
            filter.addEvent((ev) => ev.withFromAddress(address).withKeys(transfer_key))
                .withStateUpdate((su) => su.addStorageDiff((st) => st.withContractAddress(address)))
        })

        this.client = new StreamClient({
            url: 'mainnet.starknet.a5a.ch',
        }).connect()

        this.client.configure({
            filter: filter.encode(),
            batchSize: 10,
            finality: v1alpha2.DataFinality.DATA_STATUS_FINALIZED,
            cursor: { orderKey: Long.fromNumber(18000), uniqueKey: new Uint8Array(32).fill(0) }
        })
    }

    async run() {
        for await (const message of this.client) {
            if (message.data && message.data?.data) {
                console.log(message.data.endCursor)
                this.handleBatch(this.client, message.data.endCursor, message.data.data)
            }
        }
    }


    async handleBatch(client: StreamClient, cursor: v1alpha2.ICursor | null, batch: Uint8Array[]) {
        console.log("Handling batch");
        for (let item of batch) {
            const block = starknet.Block.decode(item)

            for (let { transaction, event } of block.events) {
                if (!event || !event.keys || !event.data || !transaction?.meta?.hash || !event.fromAddress) {
                    continue
                }

                // we will use direct storage access to compute the users' new
                // balances without making an (expensive) RPC call.
                const storageMap = new Map<bigint, bigint>()
                const storageDiffs = block.stateUpdate?.stateDiff?.storageDiffs ?? []
                for (let diff of storageDiffs) {
                    for (let entry of diff.storageEntries ?? []) {
                        if (!entry.key || !entry.value) {
                            continue
                        }
                        const key = FieldElement.toBigInt(entry.key)
                        const value = FieldElement.toBigInt(entry.value)
                        storageMap.set(key, value)
                    }
                }

                for (let { transaction, event } of block.events) {
                    const hash = transaction?.meta?.hash
                    if (!event || !event.data || !hash) {
                        continue
                    }

                    const from = FieldElement.toBigInt(event.data[0])
                    const to = FieldElement.toBigInt(event.data[1])
                    const amount = toDecimalAmount(
                        FieldElement.toBigInt(event.data[2]) + (FieldElement.toBigInt(event.data[3]) << 128n)
                    )

                    const fromBalanceLoc = storageVarAddress('ERC20_balances', [from])
                    const fromBalance = storageMap.get(fromBalanceLoc) ?? BigInt(0)

                    const toBalanceLoc = storageVarAddress('ERC20_balances', [to])
                    const toBalance = storageMap.get(toBalanceLoc) ?? BigInt(0)
                    console.log(`T 0x${from.toString(16)} => 0x${to.toString(16)}`)
                    console.log(`             Amount: ${amount.toString()} ETH`)
                    console.log(`  New Balance(from): ${toDecimalAmount(fromBalance)} ETH`)
                    console.log(`  New Balance(  to): ${toDecimalAmount(toBalance)} ETH`)
                    console.log(`  Transaction  Hash: ${FieldElement.toHex(hash)}`)
                }
            }

            await AppDataSource.manager.transaction(async (manager) => {
                if (!cursor) return
                let orderKey = cursor.orderKey.low
                let uniqueKey = cursor.uniqueKey
                await manager.upsert(
                    State,
                    { indexerId: this.indexerId, orderKey, uniqueKey },
                    { conflictPaths: ["indexerId"] }
                );
            });
        }
    }
}