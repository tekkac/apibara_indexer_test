import { AppIndexer } from "./indexer"
import { AppDataSource } from "./data-source";
import { v1alpha2 } from "@apibara/protocol";
import Long from 'long'

const URL_MAINNET = 'mainnet.starknet.a5a.ch'
const URL_GOERLI = 'goerli.starknet.a5a.ch'
const START_BLOCK = 514_130;

async function run_indexer() {
    const indexer = new AppIndexer(
        'badge-mainnet-indexer',
        URL_GOERLI,
        START_BLOCK
    );
    await indexer.run();

}

async function main() {
    setInterval(() => { }, 999_999_999)
    await AppDataSource.initialize()
    console.log('Streaming all Transfer events for ETH')
    await run_indexer()

}

main()
    .then(() => process.exit(0))
    .catch(console.error)