"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const bitcoin = __importStar(require("bitcoinjs-lib"));
const ecpair_1 = require("ecpair");
const sha3_1 = require("sha3");
const curve = __importStar(require("tiny-secp256k1"));
const btc_1 = require("./btc");
const descriptors_1 = require("./descriptors");
const mainnet = bitcoin.networks.bitcoin;
const testnet = bitcoin.networks.testnet;
const ECPair = (0, ecpair_1.ECPairFactory)(curve);
function getNetwork(p) {
    return (Object.entries({ mainnet, ...bitcoin.networks }).find(n => p(n[1])) || [])[0];
}
function desc(t, data) {
    return (0, descriptors_1.descsumCreate)(t.replace('KEY', typeof data === 'string' ? data : data.toString('hex')));
}
/** pub is a 64 byte Buffer: 32 bytes x, 32 bytes y */
function rskAddress(pub, main) {
    const addr = new sha3_1.Keccak(256).update(pub).digest().subarray(12).toString('hex');
    const csumHash = new sha3_1.Keccak(256).update((main ? '30' : '31') + '0x' + addr).digest('hex');
    return ('0x' +
        addr
            .split('')
            .map((c, i) => (parseInt(csumHash[i], 16) & 0b1000 ? c.toUpperCase() : c))
            .join(''));
}
const data = {};
main();
async function main() {
    await getData();
    await fillData();
}
async function getData() {
    let i;
    if (process.argv.length > 2) {
        i = process.argv[2];
    }
    else {
        i = await (0, btc_1.input)('Enter private key WIF or hex, public key or address\n> ');
    }
    try {
        const b32 = bitcoin.address.fromBech32(i);
        const network = getNetwork(n => n.bech32 == b32.prefix);
        if (!network) {
            console.log(`Unsupported network prefix ${b32.prefix}`);
            process.exit(1);
        }
        if (b32.version == 0) {
            if (b32.data.length == 20) {
                data.pkh = b32.data;
            }
            else if (b32.data.length == 32) {
                data.wsh = b32.data;
            }
            else {
                console.log(`Invalid witness_v0 length (unspendable)`);
                process.exit(1);
            }
        }
        else if (b32.version == 1) {
            if (b32.data.length == 32) {
                data.tr = b32.data;
            }
            else {
                console.log(`Invalid witness_v1 length (anyone can spend)`);
            }
        }
        else {
            console.log(`Witness program version ${b32.version} not supported`);
            process.exit(1);
        }
        console.log(`Detected ${network} P2${data.tr ? 'TR' : `W${data.pkh ? 'PK' : 'S'}H`} bech32${b32.version ? 'm' : ''} address`);
        data.witness = true;
        return;
    }
    catch (e) { }
    try {
        const b58 = bitcoin.address.fromBase58Check(i);
        const pkh = getNetwork(n => n.pubKeyHash == b58.version);
        const sh = getNetwork(n => n.scriptHash == b58.version);
        if (!pkh && !sh) {
            console.log(`Unknown base 58 version ${b58.version}`);
            process.exit(1);
        }
        if (pkh) {
            data.pkh = b58.hash;
        }
        else {
            data.sh = b58.hash;
        }
        console.log(`Detected ${pkh ? `${pkh} P2PK` : `${sh} P2S`}H base 58 address`);
        return;
    }
    catch (e) { }
    try {
        (0, assert_1.strict)(i.length == 32 * 2);
        data.ec = ECPair.fromPrivateKey(Buffer.from(i, 'hex'));
        console.log(`Detected hex private key`);
        return;
    }
    catch (e) { }
    try {
        data.ec = ECPair.fromWIF(i);
        console.log(`Detected mainnet WIF private key`);
        return;
    }
    catch (e) { }
    try {
        data.ec = ECPair.fromWIF(i, testnet);
        console.log(`Detected testnet WIF private key`);
        return;
    }
    catch (e) { }
    try {
        (0, assert_1.strict)(i.length == 33 * 2 || i.length == 65 * 2);
        data.ec = ECPair.fromPublicKey(Buffer.from(i, 'hex'));
        console.log(`Detected hex public key`);
        return;
    }
    catch (e) { }
    console.log(`Error: nothing detected`);
    process.exit(1);
}
async function fillData() {
    if (data.ec) {
        const ec = data.ec;
        if (ec.privateKey) {
            data.priv = ec.privateKey;
        }
        data.pubu = Buffer.from(curve.pointCompress(ec.publicKey, false));
        data.pub = Buffer.from(curve.pointCompress(ec.publicKey, true));
    }
    if (data.pub) {
        data.pkh = bitcoin.crypto.hash160(data.pub);
        data.pkhu = bitcoin.crypto.hash160(data.pubu);
    }
    if (data.wsh) {
        data.sh = bitcoin.crypto.ripemd160(data.wsh);
    }
    if (data.priv) {
        data.ec.compressed = true;
        const wif = {
            main: ((data.ec.network = mainnet), data.ec.toWIF()),
            test: ((data.ec.network = testnet), data.ec.toWIF()),
        };
        console.log(`
Private keys:
 Mainnet WIF: ${wif.main}
 Testnet WIF: ${wif.test}
 Hex:         ${data.priv.toString('hex')}

Private key descriptors:
 Mainnet P2PKH:           ${desc('pkh(KEY)', wif.main)}
 Testnet P2PKH:           ${desc('pkh(KEY)', wif.test)}
 Mainnet P2WPKH:         ${desc('wpkh(KEY)', wif.main)}
 Testnet P2WPKH:         ${desc('wpkh(KEY)', wif.test)}
 Mainnet P2SH-P2WPKH: ${desc('sh(wpkh(KEY))', wif.main)}
 Testnet P2SH-P2WPKH: ${desc('sh(wpkh(KEY))', wif.test)}
 Mainnet P2TR:             ${desc('tr(KEY)', wif.main)}
 Testnet P2TR:             ${desc('tr(KEY)', wif.test)}`);
    }
    if (data.pub) {
        console.log(`
Public keys:
 X-Only:         ${data.pub.subarray(1).toString('hex')}
 Compressed:   ${data.pub.toString('hex')}
 Uncompressed: ${data.pubu.toString('hex')}

Public key descriptors:
 P2PKH:           ${desc('pkh(KEY)', data.pub)}
 P2WPKH:         ${desc('wpkh(KEY)', data.pub)}
 P2SH-P2WPKH: ${desc('sh(wpkh(KEY))', data.pub)}
 P2TR:               ${desc('tr(KEY)', data.pub.subarray(1))}`);
    }
    if (data.pub) {
        console.log(`
Public Key Hashes:
 Mainnet P2PKH (compressed public key):   ${bitcoin.address.toBase58Check(data.pkh, mainnet.pubKeyHash)}
 Mainnet P2PKH (uncompressed public key): ${bitcoin.address.toBase58Check(data.pkhu, mainnet.pubKeyHash)}
 Mainnet P2WPKH (compressed public key):  ${bitcoin.address.toBech32(data.pkh, 0, mainnet.bech32)}
 Testnet P2PKH (compressed public key):   ${bitcoin.address.toBase58Check(data.pkh, testnet.pubKeyHash)}
 Testnet P2PKH (uncompressed public key): ${bitcoin.address.toBase58Check(data.pkhu, testnet.pubKeyHash)}
 Testnet P2WPKH (compressed public key):  ${bitcoin.address.toBech32(data.pkh, 0, testnet.bech32)}
 Hex (compressed public key):             ${data.pkh.toString('hex')}
 Hex (uncompressed public key):           ${data.pkhu.toString('hex')}
 RSK Mainnet account:                     ${rskAddress(data.pubu.subarray(1), true)}
 RSK Testnet account:                     ${rskAddress(data.pubu.subarray(1), false)}`);
    }
    else if (data.pkh) {
        console.log(`
Public Key Hashes:
 Mainnet P2PKH:   ${bitcoin.address.toBase58Check(data.pkh, mainnet.pubKeyHash)}
 Mainnet P2WPKH:  ${bitcoin.address.toBech32(data.pkh, 0, mainnet.bech32)}
 Testnet P2PKH:   ${bitcoin.address.toBase58Check(data.pkh, testnet.pubKeyHash)}
 Testnet P2WPKH:  ${bitcoin.address.toBech32(data.pkh, 0, testnet.bech32)}
 Hex:             ${data.pkh.toString('hex')}`);
    }
    if (data.sh || data.pkh) {
        console.log('\nScript Hash');
        let nwsh, nwpkh;
        if (data.wsh) {
            nwsh = bitcoin.crypto.hash160(bitcoin.script.compile([0, data.wsh]));
            console.log(` Mainnet P2WSH:       ${bitcoin.address.toBech32(data.wsh, 0, mainnet.bech32)}`);
            console.log(` Mainnet P2SH-P2WSH:  ${bitcoin.address.toBase58Check(nwsh, mainnet.scriptHash)}`);
        }
        if (data.sh) {
            console.log(` Mainnet P2SH:        ${bitcoin.address.toBase58Check(data.sh, mainnet.scriptHash)}`);
        }
        if (data.pkh) {
            nwpkh = bitcoin.crypto.hash160(bitcoin.script.compile([0, data.pkh]));
            console.log(` Mainnet P2SH-P2WPKH: ${bitcoin.address.toBase58Check(nwpkh, mainnet.scriptHash)}`);
        }
        if (data.wsh) {
            console.log(` Testnet P2WSH:       ${bitcoin.address.toBech32(data.wsh, 0, testnet.bech32)}`);
            console.log(` Testnet P2SH-P2WSH:  ${bitcoin.address.toBase58Check(nwsh, testnet.scriptHash)}`);
        }
        if (data.sh) {
            console.log(` Testnet P2SH:        ${bitcoin.address.toBase58Check(data.sh, testnet.scriptHash)}`);
        }
        if (data.pkh) {
            console.log(` Testnet P2SH-P2WPKH: ${bitcoin.address.toBase58Check(nwpkh, testnet.scriptHash)}`);
        }
    }
    if (data.pub) {
        console.log('\n\x1b[1m(!) Note: Witness Public Key Hash with uncompressed keys are not shown because\n          using uncompressed keys in SegWit makes the transaction non-standard\x1b[0m');
    }
    else if (data.pkh && !data.witness) {
        console.log('\n\x1b[1;33m(!) Warning: Compression of the public key is unknown\n             Using uncompressed keys in SegWit makes the transaction non-standard\x1b[0m');
    }
    process.exit(0);
}
