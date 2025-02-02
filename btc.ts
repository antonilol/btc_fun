import { strict as assert } from 'assert';
import * as bitcoin from 'bitcoinjs-lib';
import { spawn } from 'child_process';
import { ECPairFactory, ECPairInterface } from 'ecpair';
import { createInterface } from 'readline';
import { Writable } from 'stream';
import * as curve from 'tiny-secp256k1';

export { descsumCreate } from './descriptors';

type ObjectKey = string | number | symbol;
type ObjectKeyString<K extends ObjectKey> = K extends number ? `${number}` : K extends symbol ? never : K;

declare global {
    interface ObjectConstructor {
        entries<K extends ObjectKey, T>(o: { [s in K]: T } | ArrayLike<T>): [ObjectKeyString<K>, T][];
    }
}

const ECPair = ECPairFactory(curve);

export namespace Uint256 {
    export function toBigint(b: Uint8Array): bigint {
        return BigInt('0x' + Buffer.from(b).toString('hex'));
    }

    export function toBuffer(n: bigint): Buffer {
        return Buffer.from(n.toString(16).padStart(64, '0'), 'hex');
    }
}

export interface OutputPoint {
    txid: string;
    vout: number;
}

export interface UTXO extends OutputPoint {
    address: string;
    label?: string;
    scriptPubKey: string;
    amount: number;
    confirmations: number;
    ancestorcount?: number;
    ancestorsize?: number;
    ancestorfees?: number;
    redeemScript?: string;
    witnessScript?: string;
    spendable: boolean;
    solvable: boolean;
    reused?: boolean;
    desc?: string;
    parent_descs: string[];
    safe: boolean;
}

export interface RawTransactionInput extends OutputPoint {
    sequence?: number;
}

export type RawTransactionOutput =
    | {
          [address: string]: number;
      }
    | {
          data: string;
      };

export interface TemplateRequest {
    mode?: string;
    capabilities?: string[];
    rules: string[];
}

export interface BlockTemplateTX {
    data: string;
    txid: string;
    hash: string;
    depends: number[];
    TXdepends: BlockTemplateTX[];
    fee?: number;
    sigops?: number;
    weight: number;
}

export interface BlockTemplate {
    capabilities: string[];
    version: number;
    rules: string[];
    vbavailable: { [rulename: string]: number };
    vbrequired: number;
    previousblockhash: string;
    transactions: BlockTemplateTX[];
    coinbaseaux: { [key: string]: number };
    coinbasevalue: number;
    longpollid: string;
    target: string;
    mintime: number;
    mutable: string[];
    noncerange: string;
    sigoplimit: number;
    sizelimit: number;
    weightlimit: number;
    curtime: number;
    bits: string;
    height: number;
    signet_challenge?: string;
    default_witness_commitment?: string;
}

export type ScriptType =
    | 'nonstandard'
    | 'pubkey'
    | 'pubkeyhash'
    | 'scripthash'
    | 'multisig'
    | 'nulldata'
    | 'witness_v0_scripthash'
    | 'witness_v0_keyhash'
    | 'witness_v1_taproot'
    | 'witness_unknown';

export interface ScriptPubKey {
    asm: string;
    desc: string;
    hex: string;
    type: ScriptType;
    address?: string;
}

export interface Vin {
    coinbase?: string;
    txid?: string;
    vout?: number;
    scriptSig?: {
        asm: string;
        hex: string;
    };
    txinwitness?: string[];
    sequence: number;
}

export interface Vout {
    value: number;
    n: number;
    scriptPubKey: ScriptPubKey;
}

export interface RawTransaction {
    txid: string;
    hash: string;
    size: number;
    vsize: number;
    weight: number;
    version: number;
    locktime: number;
    vin: Vin[];
    vout: Vout[];
}

export interface TXOut {
    bestblock: string;
    confirmations: number;
    value: number;
    scriptPubKey: ScriptPubKey;
    coinbase: boolean;
}

export interface ListUnspentArgs {
    /** Default value: 1 */
    minconf?: number;
    /** Default value: 9999999 */
    maxconf?: number;
    /** Default value: [] */
    addresses?: string[];
    /** Default value: true */
    include_unsafe?: boolean;
    /** Default value: 0 */
    minimumAmount?: number;
    /** Default value: unlimited */
    maximumAmount?: number;
    /** Default value: unlimited */
    maximumCount?: number;
    /** Default value: unlimited */
    minimumSumAmount?: number;
}

export type TransactionType = string | Buffer | bitcoin.Transaction;
export type PsbtType = string | bitcoin.Psbt;

export type Chain = 'main' | 'test' | 'testnet4' | 'regtest' | 'signet';

export const networks: { [name in Chain]: bitcoin.networks.Network } = {
    main: bitcoin.networks.bitcoin,
    test: bitcoin.networks.testnet,
    testnet4: bitcoin.networks.testnet,
    regtest: bitcoin.networks.regtest,
    signet: bitcoin.networks.testnet,
};

let chain: Chain = 'testnet4';
export let network = networks[chain];

export function setChain(c: Chain): void {
    chain = c;
    network = networks[chain];
}

export const chainEnvVarKey = 'BTC_STUFF_CHAIN';

const chainEnvVarValue = process.env[chainEnvVarKey];
if (chainEnvVarValue) {
    if (networks[chainEnvVarValue]) {
        setChain(chainEnvVarValue as Chain);
    } else {
        console.error(`Invalid chain "${chainEnvVarValue}", leaving it unchanged (currently set to ${chain})`);
    }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export async function btc(...args: (string | Buffer | number | {} | TransactionType | PsbtType)[]): Promise<string> {
    return new Promise((r, e) => {
        const cmdargs = [`-chain=${chain}`, '-stdin'];
        while (args.length && typeof args[0] === 'string' && args[0].startsWith('-')) {
            cmdargs.push(args.shift() as string);
        }

        const p = spawn('bitcoin-cli', cmdargs);

        let out = '';

        p.stdout.setEncoding('utf8');
        p.stdout.on('data', data => {
            out += data.toString();
        });

        p.stderr.setEncoding('utf8');
        p.stderr.on('data', data => {
            out += data.toString();
        });

        p.on('close', code => {
            while (out.endsWith('\n')) {
                out = out.slice(0, -1);
            }
            (code ? e : r)(out);
        });

        p.stdin.write(
            args
                .map(x => {
                    let arg: string;
                    if (Buffer.isBuffer(x)) {
                        arg = x.toString('hex');
                    } else if (typeof x === 'number') {
                        arg = x.toString();
                    } else if (typeof x === 'string') {
                        arg = x;
                    } else if (x instanceof bitcoin.Transaction) {
                        arg = x.toHex();
                    } else if (x instanceof bitcoin.Psbt) {
                        arg = x.toBase64();
                    } else {
                        arg = JSON.stringify(x);
                    }
                    return arg.replace(/\n/g, '');
                })
                .join('\n'),
        );
        p.stdin.end();
    });
}

// sign, create and send new transaction
export async function newtx(
    inputs: RawTransactionInput[],
    outputs: RawTransactionOutput | RawTransactionOutput[],
    sat: boolean,
): Promise<string> {
    if (sat) {
        if (Array.isArray(outputs)) {
            for (const outs of outputs) {
                Object.keys(outs).forEach(k => {
                    if (k !== 'data') {
                        outs[k] = toBTC(outs[k]);
                    }
                });
            }
        } else {
            Object.keys(outputs).forEach(k => {
                if (k !== 'data') {
                    outputs[k] = toBTC(outputs[k]);
                }
            });
        }
    }
    const tx = await btc('createrawtransaction', inputs, outputs);
    return signAndSend(tx);
}

export async function signAndSend(tx: TransactionType): Promise<string> {
    return send(JSON.parse(await btc('signrawtransactionwithwallet', tx)).hex);
}

export async function fundTransaction(
    tx: TransactionType,
    convert: false,
): Promise<{ hex: string; fee: number; changepos: number }>;
export async function fundTransaction(
    tx: TransactionType,
    convert?: true,
): Promise<{ tx: bitcoin.Transaction; hex: string; fee: number; changepos: number }>;
export async function fundTransaction(
    tx: TransactionType,
    convert?: boolean,
): Promise<{ tx?: bitcoin.Transaction; hex: string; fee: number; changepos: number }>;
export async function fundTransaction(
    tx: TransactionType,
    convert = true,
): Promise<{ tx: bitcoin.Transaction; hex: string; fee: number; changepos: number }> {
    const res = JSON.parse(await btc('fundrawtransaction', tx));

    if (convert) {
        res.tx = bitcoin.Transaction.fromHex(res.hex);
    }

    return res;
}

export async function send(tx: TransactionType): Promise<string> {
    return btc('sendrawtransaction', tx);
}

/** @deprecated Use listUnspent instead */
export async function listunspent(minamount: number, minconf: number, sat: boolean): Promise<UTXO[]> {
    return JSON.parse(
        await btc('-named', 'listunspent', 'minconf=' + minconf, `query_options={"minimumAmount":${minamount}}`),
    ).map((u: UTXO) => {
        if (sat) {
            u.amount = toSat(u.amount);
        }
        return u;
    });
}

/** Lists unspent transaction outputs (UTXOs) */
export async function listUnspent(args: ListUnspentArgs = {}, sats = true): Promise<UTXO[]> {
    const minconf = args.minconf === undefined ? 1 : args.minconf;
    const maxconf = args.maxconf === undefined ? 9999999 : args.maxconf;
    const addresses = args.addresses || [];
    const include_unsafe = args.include_unsafe === undefined ? true : args.include_unsafe;
    const query_options = {};
    for (const k in args) {
        if (['minimumAmount', 'maximumAmount', 'maximumCount', 'minimumSumAmount'].includes(k)) {
            query_options[k] = sats && k.endsWith('Amount') ? toBTC(args[k]) : args[k];
        }
    }
    const utxos: UTXO[] = JSON.parse(
        await btc('listunspent', minconf, maxconf, addresses, include_unsafe, query_options),
    );
    if (sats) {
        for (let i = 0; i < utxos.length; i++) {
            utxos[i].amount = toSat(utxos[i].amount);
        }
    }
    return utxos;
}

export async function getnewaddress(): Promise<string> {
    return btc('getnewaddress');
}

export async function getBlockTemplate(
    template_request: TemplateRequest = { rules: ['segwit'] },
): Promise<BlockTemplate> {
    const template: BlockTemplate = JSON.parse(await btc('getblocktemplate', template_request));
    updateTXDepends(template);
    return template;
}

export async function decodeRawTransaction(tx: TransactionType): Promise<RawTransaction> {
    return JSON.parse(await btc('decoderawtransaction', tx));
}

export async function getTXOut(txid: string | Buffer, vout: number, include_mempool = true): Promise<TXOut | void> {
    const txout = await btc('gettxout', txidToString(txid), vout, include_mempool);
    if (txout) {
        return JSON.parse(txout);
    }
}

export namespace getTransaction {
    interface DetailsBase {
        involvesWatchonly?: boolean;
        address?: string;
        amount: number;
        label?: string;
        vout: number;
    }

    export interface OutputNoDecodedTx {
        amount: number;
        fee?: number;
        confirmations: number;
        generated?: boolean;
        trusted?: boolean;
        blockhash?: string;
        blockheight?: number;
        blockindex?: number;
        blocktime?: number;
        txid: string;
        wtxid: string;
        walletconflicts: string[];
        replaced_by_txid?: string;
        replaces_txid?: string;
        // comment?: string;
        to?: string;
        time: number;
        timereceived: number;
        comment?: string;
        'bip125-replaceable': 'yes' | 'no' | 'unknown';
        details: (
            | (DetailsBase & { category: 'receive'; parent_descs: string[] })
            | (DetailsBase & { category: 'generate' | 'immature' | 'orphan' })
            | (DetailsBase & { category: 'send'; fee: number; abandoned: boolean })
        )[];
        hex: string;
    }

    export interface OutputDecodedTx extends OutputNoDecodedTx {
        decoded: RawTransaction;
    }

    export interface Output extends OutputNoDecodedTx {
        decoded?: RawTransaction;
    }
}

export async function getTransaction(
    txid: string | Buffer,
    includeWatchonly: boolean,
    verbose?: false,
): Promise<getTransaction.OutputNoDecodedTx>;
export async function getTransaction(
    txid: string | Buffer,
    includeWatchonly: boolean,
    verbose: true,
): Promise<getTransaction.OutputDecodedTx>;
export async function getTransaction(
    txid: string | Buffer,
    includeWatchonly?: boolean,
    verbose?: boolean,
): Promise<getTransaction.Output>;
export async function getTransaction(
    txid: string | Buffer,
    includeWatchonly = true,
    verbose = false,
): Promise<getTransaction.Output> {
    return JSON.parse(await btc('gettransaction', txidToString(txid), includeWatchonly, verbose));
}

export namespace testMempoolAccept {
    interface Transaction {
        txid: string;
        wtxid: string;
        allowed: boolean;
    }

    export interface AllowedTransaction extends Transaction {
        allowed: true;
        vsize: number;
        fees: { base: number };
    }

    export interface RejectedTransaction extends Transaction {
        allowed: false;
        'reject-reason': string;
    }

    export interface RejectedPackageTransaction extends RejectedTransaction {
        'package-error'?: string;
    }

    export type SingleOutput = AllowedTransaction | RejectedTransaction;
    export type PackageOutput = (AllowedTransaction | RejectedPackageTransaction)[];
    export type Output = SingleOutput | PackageOutput;
}

/** note: maxfeerate is in sat/vB */
export async function testMempoolAccept(tx: TransactionType, maxfee?: number): Promise<testMempoolAccept.SingleOutput>;
export async function testMempoolAccept(
    txs: TransactionType[],
    maxfee?: number,
): Promise<testMempoolAccept.PackageOutput>;
export async function testMempoolAccept(
    txs: TransactionType | TransactionType[],
    maxfeerate?: number,
): Promise<testMempoolAccept.Output>;
export async function testMempoolAccept(
    txs: TransactionType | TransactionType[],
    maxfeerate?: number,
): Promise<testMempoolAccept.Output> {
    const arr = Array.isArray(txs);
    const res = JSON.parse(
        await (maxfeerate === undefined
            ? btc('testmempoolaccept', arr ? txs : [txs])
            : btc('testmempoolaccept', arr ? txs : [txs], toBTCkvB(maxfeerate))),
    );
    return arr ? res : res[0];
}

export namespace getChainTips {
    interface ChainTip {
        height: number;
        hash: string;
    }

    export interface ActiveChainTip extends ChainTip {
        branchlen: 0;
        status: 'active';
    }

    export interface InactiveChainTip extends ChainTip {
        branchlen: number;
        status: 'invalid' | 'headers-only' | 'valid-headers' | 'valid-fork' | 'unknown';
    }

    // export type Output = [ ActiveChainTip, ...InactiveChainTip[] ];
    export type Output = (ActiveChainTip | InactiveChainTip)[];
}

export async function getChainTips(): Promise<getChainTips.Output> {
    return JSON.parse(await btc('getchaintips'));
}

export namespace getIndexInfo {
    type BlockFilterIndex = 'basic';

    export type Index = `${'tx' | 'coinstats' | `${BlockFilterIndex} block filter `}index`;

    export interface IndexInfo {
        synced: boolean;
        best_block_height: number;
    }

    export type Output<T extends Index = Index> = {
        [k in T]?: IndexInfo;
    };
}

export async function getIndexInfo(): Promise<getIndexInfo.Output>;
export async function getIndexInfo(index: getIndexInfo.Index): Promise<getIndexInfo.Output<typeof index>>;
export async function getIndexInfo(index?: getIndexInfo.Index): Promise<getIndexInfo.Output>;
export async function getIndexInfo(index?: getIndexInfo.Index): Promise<getIndexInfo.Output> {
    return JSON.parse(await btc('getindexinfo', index || ''));
}

export namespace getBlockChainInfo {
    interface ChainInfoBase {
        chain: Chain;
        blocks: number;
        headers: number;
        bestblockhash: string;
        difficulty: number;
        time: number;
        mediantime: number;
        verificationprogress: number;
        initialblockdownload: boolean;
        chainwork: string;
        size_on_disk: number;
        pruned: boolean;
        warnings: string;
    }

    interface ChainInfo extends ChainInfoBase {
        pruned: false;
    }

    interface PruneChainInfoBase extends ChainInfoBase {
        pruned: true;
        pruneheight: number;
        automatic_pruning: boolean;
    }

    interface PruneChainInfo extends PruneChainInfoBase {
        automatic_pruning: false;
    }

    interface AutomaticPruneChainInfo extends PruneChainInfoBase {
        automatic_pruning: true;
        prune_target_size: number;
    }

    export type Output = ChainInfo | PruneChainInfo | AutomaticPruneChainInfo;
}

export async function getBlockChainInfo(): Promise<getBlockChainInfo.Output> {
    return JSON.parse(await btc('getblockchaininfo'));
}

export async function fundOutputScript(
    scriptPubKey: Buffer,
    amount: number,
    locktime = 0,
    version = 2,
): Promise<{ txid: string; txidBytes: Buffer; vout: number; hex: string }> {
    const tx = new bitcoin.Transaction();

    tx.version = version;
    tx.addOutput(scriptPubKey, amount);
    tx.locktime = locktime;

    const funded = await fundTransaction(tx, true);
    const vout = funded.tx.outs.findIndex(output => output.value === amount && output.script.equals(scriptPubKey));
    assert(vout != -1);
    await signAndSend(funded.hex);
    return {
        txid: funded.tx.getId(),
        txidBytes: Buffer.from(funded.tx.getId(), 'hex').reverse(),
        vout,
        hex: funded.hex,
    };
}

/** @deprecated Use `fundOutputScript(bitcoin.address.toOutputScript(address, network), amount)` instead */
export async function fundAddress(address: string, amount: number): Promise<OutputPoint> {
    const txid = await btc('sendtoaddress', address, toBTC(amount));
    const vout = (await getTransaction(txid)).details.find(x => x.address == address).vout;

    return { txid, vout };
}

export function validNetworks(address: string): { [name in 'bitcoin' | 'testnet' | 'regtest']?: bitcoin.Network } {
    const output: { [name in 'bitcoin' | 'testnet' | 'regtest']?: bitcoin.Network } = {};

    for (const net of Object.entries(bitcoin.networks)) {
        try {
            bitcoin.address.toOutputScript(address, net[1]);
            output[net[0]] = net[1];
        } catch (e) {}
    }

    return output;
}

export const OP_CHECKSIGADD = 0xba; // this is not merged yet: https://github.com/bitcoinjs/bitcoinjs-lib/pull/1742

const ONE = Uint256.toBuffer(1n);
const N_LESS_1 = Buffer.from(curve.privateSub(ONE, Uint256.toBuffer(2n))!);

export function negateIfOddPubkey(d: Uint8Array): Buffer | undefined {
    const pub = curve.pointFromScalar(d, true);
    if (!pub) {
        return;
    }
    if (pub[0] == 3) {
        const d1 = curve.privateSub(N_LESS_1, d);
        if (!d1) {
            return;
        }
        const d2 = curve.privateAdd(d1, ONE);
        if (!d2) {
            return;
        }
        return Buffer.from(d2);
    }
    return Buffer.from(d);
}

// const EC_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn // not used yet
const EC_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

export function ecPrivateMul(a: Uint8Array, b: Uint8Array): Buffer {
    const an = Uint256.toBigint(a);
    const bn = Uint256.toBigint(b);
    if (an <= 0n || an >= EC_N) {
        throw new Error('a out of range');
    }
    if (bn <= 0n || bn >= EC_N) {
        throw new Error('b out of range');
    }
    return Uint256.toBuffer((an * bn) % EC_N);
}

export function ecPrivateInv(a: Uint8Array): Buffer {
    let an = Uint256.toBigint(a);
    if (an <= 0n || an >= EC_N) {
        throw new Error('a out of range');
    }

    let m = EC_N;
    let y1 = 1n;
    let y2 = 0n;
    while (an > 1) {
        [y1, y2] = [y2 - (m / an) * y1, y1];
        [an, m] = [m % an, an];
    }
    return Uint256.toBuffer(((y1 % EC_N) + EC_N) % EC_N);
}

export function ecPrivateDiv(a: Uint8Array, b: Uint8Array): Buffer {
    return ecPrivateMul(a, ecPrivateInv(b));
}

export function tapLeaf(script: Buffer): Buffer {
    return bitcoin.crypto.taggedHash(
        'TapLeaf',
        Buffer.concat([Buffer.from([0xc0]), encodeVarUintLE(script.length), script]),
    );
}

export function tapBranch(branch1: Buffer, branch2: Buffer): Buffer {
    return bitcoin.crypto.taggedHash(
        'TapBranch',
        Buffer.concat(branch1 < branch2 ? [branch1, branch2] : [branch2, branch1]),
    );
}

export function tapTweak(pubkey: Buffer, root?: Buffer): Buffer {
    return bitcoin.crypto.taggedHash(
        'TapTweak',
        root ? Buffer.concat([pubkey.subarray(-32), root]) : pubkey.subarray(-32),
    );
}

export function bip86(ecpair: ECPairInterface): ECPairInterface | undefined {
    const tweak = tapTweak(ecpair.publicKey);
    const opts = {
        compressed: ecpair.compressed,
        network: ecpair.network,
    };
    if (ecpair.privateKey) {
        const priv = curve.privateAdd(ecpair.privateKey, tweak);
        if (!priv) {
            return;
        }
        return ECPair.fromPrivateKey(Buffer.from(priv), opts);
    }
    const pub = curve.pointAddScalar(ecpair.publicKey, tweak);
    if (!pub) {
        return;
    }
    return ECPair.fromPublicKey(Buffer.from(pub), opts);
}

export function createTaprootOutput(
    pubkey: Buffer,
    root?: Buffer,
): { key: Buffer; parity: 0 | 1; scriptPubKey: Buffer; address: string } | undefined {
    const tweaked = curve.pointAddScalar(pubkey, tapTweak(pubkey, root));
    if (!tweaked) {
        return;
    }
    const key = Buffer.from(tweaked).subarray(-32);
    return {
        key,
        parity: (tweaked[0] & 1) as 0 | 1,
        scriptPubKey: bitcoin.script.compile([bitcoin.opcodes.OP_1, key]),
        address: bitcoin.address.toBech32(key, 1, network.bech32),
    };
}

// Utils

export function encodeVarUintLE(n: bigint | number): Buffer {
    if (typeof n === 'number') {
        assert(n >= 0 && n <= Number.MAX_SAFE_INTEGER && n % 1 === 0);
        n = BigInt(n);
    } else {
        assert(n >= 0n && n <= 0xffffffffffffffffn);
    }
    if (n > 0xffffffffn) {
        const buf = Buffer.allocUnsafe(9);
        buf.writeUint8(0xff);
        buf.writeBigUint64LE(n, 1);
        return buf;
    } else if (n > 0xffffn) {
        const buf = Buffer.allocUnsafe(5);
        buf.writeUint8(0xfe);
        buf.writeUint32LE(Number(n), 1);
        return buf;
    } else if (n > 0xfcn) {
        const buf = Buffer.allocUnsafe(3);
        buf.writeUint8(0xfd);
        buf.writeUint16LE(Number(n), 1);
        return buf;
    } else {
        const buf = Buffer.allocUnsafe(1);
        buf.writeUint8(Number(n));
        return buf;
    }
}

export function decodeVarUintLE(buf: Buffer, bigint: true): bigint;
export function decodeVarUintLE(buf: Buffer, bigint: false): number;
export function decodeVarUintLE(buf: Buffer, bigint: boolean): bigint | number;
export function decodeVarUintLE(buf: Buffer, bigint: boolean): bigint | number {
    let n: number;
    if (buf[0] === 0xff && buf.length >= 9) {
        const n = buf.readBigUint64LE(1);
        if (bigint) {
            return n;
        } else {
            assert(n <= Number.MAX_SAFE_INTEGER);
            return Number(n);
        }
    } else if (buf[0] === 0xfe && buf.length >= 5) {
        n = buf.readUint32LE(1);
    } else if (buf[0] === 0xfd && buf.length >= 3) {
        n = buf.readUint16LE(1);
    } else {
        n = buf.readUint8();
    }
    return bigint ? BigInt(n) : n;
}

// remove a transaction from a templateFile
// removes all dependendencies
// subtracts fee of removed transactions from coinbasevalue
// returns all removed transactions
export function removeTransaction(template: BlockTemplate, txid: string): BlockTemplateTX[] {
    const txs = template.transactions;
    const tx = txs.find(x => x.txid == txid);
    if (!tx) {
        return [];
    }
    const toRemove = [tx];
    const removed: BlockTemplateTX[] = [];

    while (toRemove.length) {
        const tx = toRemove.shift()!;
        toRemove.push(...tx.TXdepends);
        removed.push(...txs.splice(txs.indexOf(tx), 1));
    }

    template.coinbasevalue -= removed.reduce((v, x) => v + (x.fee || 0), 0);

    updateNumberDepends(template);

    return removed;
}

export async function insertTransaction(template: BlockTemplate, data: string | Buffer): Promise<boolean> {
    const rawtx = await decodeRawTransaction(data);

    if (template.transactions.find(x => x.txid == rawtx.txid)) {
        return false;
    }

    const tx: BlockTemplateTX = {
        data: Buffer.isBuffer(data) ? data.toString('hex') : data,
        txid: rawtx.txid,
        hash: rawtx.hash,
        depends: [],
        TXdepends: template.transactions.filter(x => rawtx.vin.map(y => y.txid).includes(x.txid)),
        weight: rawtx.weight,
    };

    template.transactions.push(tx);

    updateNumberDepends(template);

    return true;
}

function updateTXDepends(template: BlockTemplate): void {
    for (const tx of template.transactions) {
        tx.TXdepends = tx.depends.map(i => template.transactions[i - 1]);
    }
}

function updateNumberDepends(template: BlockTemplate): void {
    for (const tx of template.transactions) {
        tx.depends = tx.TXdepends.map(tx => template.transactions.indexOf(tx) + 1);
    }
}

export function bech32toScriptPubKey(a: string): Buffer {
    const z = bitcoin.address.fromBech32(a);
    return bitcoin.script.compile([bitcoin.script.number.encode(z.version), bitcoin.address.fromBech32(a).data]);
}

export function p2pkh(pub: Buffer): Buffer {
    return bitcoin.script.compile([
        bitcoin.opcodes.OP_DUP,
        bitcoin.opcodes.OP_HASH160,
        bitcoin.crypto.hash160(pub),
        bitcoin.opcodes.OP_EQUALVERIFY,
        bitcoin.opcodes.OP_CHECKSIG,
    ]);
}

/** @deprecated Use `Buffer.from` instead */
export function cloneBuf(buf: Buffer): Buffer {
    return Buffer.from(buf);
}

export function txidToString(txid: string | Buffer): string {
    if (typeof txid === 'string') {
        return txid;
    }
    return Buffer.from(txid).reverse().toString('hex');
}

export function toSat(btcAmount: number): number {
    // prevent floating point quirks: 4.24524546 * 1e8 = 424524545.99999994
    return Math.round(btcAmount * 1e8);
}

export function toBTC(satAmount: number): number {
    // prevent floating point quirks: 424524546 * 1e-8 = 4.2452454600000005
    return parseFloat((satAmount * 1e-8).toFixed(8));
}

/** Converts a fee rate in BTC/kvB to sat/vB */
export function toSatvB(btckvB: number): number {
    return toSat(btckvB) / 1000;
}

/** Converts a fee rate in sat/vB to BTC/kvB */
export function toBTCkvB(satvB: number): number {
    return toBTC(Math.round(satvB * 1000));
}

const eofCallbacks: (() => void)[] = [];
export function inputOnEOF(cb: () => void): void {
    eofCallbacks.push(cb);
}

export async function input(q: string, hide = false): Promise<string> {
    let active = false;

    const rl = createInterface({
        input: process.stdin,
        output: new Writable({
            write: (chunk, encoding, cb) => {
                const c = Buffer.from(chunk, encoding);

                if (active && hide) {
                    if (c.toString() == '\r\n' || c.toString() == '\n') {
                        console.log();
                        return cb();
                    }
                } else {
                    process.stdout.write(c);
                }

                cb();
            },
        }),
        terminal: true,
    });

    return new Promise(r => {
        let resolved = false;
        rl.question(q, a => {
            r(a);
            resolved = true;
            rl.close();
        });
        rl.on('close', () => {
            if (!resolved) {
                console.log();
                eofCallbacks.forEach(cb => cb());
            }
        });

        active = true;
    });
}

export async function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

// from https://stackoverflow.com/a/47296370/13800918, edited
export const consoleTrace = Object.fromEntries(
    (['log', 'warn', 'error'] as const).map(methodName => {
        return [
            methodName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (...args: any[]) => {
                let initiator = 'unknown place';
                try {
                    throw new Error();
                } catch (e) {
                    if (e instanceof Error && e.stack) {
                        let isFirst = true;
                        for (const line of e.stack.split('\n')) {
                            const matches = line.match(/^\s+at\s+(.*)/);
                            if (matches) {
                                if (!isFirst) {
                                    initiator = matches[1];
                                    break;
                                }
                                isFirst = false;
                            }
                        }
                    }
                }
                console[methodName](...args, '\n', `	at ${initiator}`);
            },
        ];
    }),
);
