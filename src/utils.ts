import Decimal from 'decimal.js'
import { hash } from 'starknet'

const ETH_DECIMALS = 18

export function toDecimalAmount(amount: bigint): Decimal {
    const num = new Decimal(amount.toString(10))
    const dec = new Decimal(10).pow(ETH_DECIMALS)
    return num.div(dec)
}

const ADDR_BOUND = 2n ** 251n - 256n

export function storageVarAddress(name: string, args: bigint[]): bigint {
    let acc = hash.getSelectorFromName(name)
    for (let arg of args) {
        acc = hash.pedersen([acc, '0x' + arg.toString(16)])
    }
    let res = BigInt(acc)
    while (res > ADDR_BOUND) {
        res -= ADDR_BOUND
    }
    return res
}