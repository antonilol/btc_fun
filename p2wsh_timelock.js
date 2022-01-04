const { btc, send, bech32toScriptPubKey } = require('./btc')();
const bitcoin = require('bitcoinjs-lib');
const network = bitcoin.networks.testnet;
const hashtype = bitcoin.Transaction.SIGHASH_ALL;
const ECPair = require('ecpair').ECPairFactory(require('tiny-secp256k1'));

const txid = '1234....'; // txid hex here
const vout = 0;

// address to lock the coins
const addr = 'tb1qbech32addresshere';

main();

async function main() {
	const key = btc('dumpprivkey', addr);

	const ecpair = ECPair.fromWIF(await key, network);

	const witnessScript = bitcoin.script.compile([
		ecpair.publicKey,
		bitcoin.opcodes.OP_CHECKSIGVERIFY,
		bitcoin.script.number.encode(2000000),
		bitcoin.opcodes.OP_CHECKLOCKTIMEVERIFY
	]);

	console.log(
		'send 1000 sat to ' +
		bitcoin.payments.p2wsh({ redeem: { output: witnessScript, network }, network }).address
	);

	const tx = new bitcoin.Transaction(network);

	tx.addInput(Buffer.from(txid, 'hex').reverse(), vout, 0xfffffffe); // 0xfffffffe -> no rbf, activate locktime
	tx.locktime = 2134581;

	const amount = 2331;
	const fee = 112;

	tx.addOutput(bech32toScriptPubKey('tb1qbech32addresshere'), amount - fee);

	const sighash = tx.hashForWitnessV0(0, witnessScript, amount, hashtype);
	const witness = bitcoin.payments.p2wsh({
		redeem: {
			input: bitcoin.script.compile([
				bitcoin.script.signature.encode(ecpair.sign(sighash), hashtype)
			]),
			output: witnessScript
		}
	}).witness;

	tx.setWitness(0, witness);

	console.log(await send(tx.toHex()));
}
