import { spawn } from 'child_process';
import * as bitcoin from 'bitcoinjs-lib';
import { btc, bech32toScriptPubKey, getBlockTemplate, BlockTemplate, BlockTemplateTX, consoleTrace, insertTransaction } from './btc';
import { merkleRoot } from './merkle_tree';
import { strict as assert } from 'assert';
import { randomBytes } from 'crypto';
import { writeFileSync, unlinkSync, copyFileSync, readFileSync, readdirSync } from 'fs';
import { dirname } from 'path';

// i say DONT CHEAT it is only here for me :)
const cheat = false;

function encodeVarUIntLE(n: number): Buffer {
	assert(n >= 0 && n < 2 ** 32);
	var l = 1;
	var b = '8';
	var off = 0;
	var i: number;
	if (n > 0xffff) {
		l = 5;
		b = '32LE';
		off = 1;
		i = 0xfe;
	} else if (n > 0xfc) {
		l = 3;
		b = '16LE';
		off = 1;
		i = 0xfd;
	}
	const buf = Buffer.allocUnsafe(l);
	buf[`writeUInt${b}`](n, off);
	if (off) {
		buf.writeUInt8(i);
	}
	return buf;
}

var templateFile: string | undefined;

// BIP141
const wCommitHeader = Buffer.from('aa21a9ed', 'hex');

function createCoinbase(address: string, value: number, height: number, txs: BlockTemplateTX[], message: string) {
	const tx = new bitcoin.Transaction();

	// in
	tx.addInput(Buffer.alloc(32), 0xffffffff);
	tx.setInputScript(0, Buffer.concat([
		bitcoin.script.compile([ bitcoin.script.number.encode(height) ]),
		Buffer.from(message)
	]));
	tx.setWitness(0, [ Buffer.alloc(32) ]);

	// block reward + fees
	tx.addOutput(bech32toScriptPubKey(address), value);

	// OP_RETURN with witness commitment
	const wtxids: (string | Buffer)[] = txs.map(x => x.hash);
	wtxids.splice(0, 0, Buffer.alloc(32));
	tx.addOutput(bitcoin.script.compile([
		bitcoin.opcodes.OP_RETURN,
		Buffer.concat([
			wCommitHeader,
			bitcoin.crypto.hash256(Buffer.concat([
				merkleRoot(wtxids),
				Buffer.alloc(32)
			]))
		]),
		randomBytes(4)
	]), 0);

	// serialize
	const coinbase = tx.toBuffer();
	const txid = tx.getId();

	return { tx: coinbase, txid };
}

async function getWork() {
	var t: BlockTemplate;
	if (templateFile) {
		t = JSON.parse(readFileSync(templateFile).toString());
	} else {
		t = await getBlockTemplate();
	}

	var time: number;
	if (cheat) {
		const prev = await btc('getblockheader', t.previousblockhash);
		time = JSON.parse(prev).time + 20 * 60 + 1;
	} else {
		time = Math.floor(new Date().getTime() / 1000);
	}

	const txs = t.transactions;

	const mempool = readdirSync('mempool');
	for (const tx of mempool.map(f => readFileSync(`mempool/${f}`).toString().trim())) {
		await insertTransaction(t, tx);
	}

	const txcount = encodeVarUIntLE(txs.length + 1);

	const message = 'mined with miner.ts from github.com/antonilol/btc_stuff';
	const address = 'tb1qllllllxl536racn7h9pew8gae7tyu7d58tgkr3';

	if (!address) {
		consoleTrace.error('No payout address specified!');
		process.exit(1);
	}

	const coinbase = createCoinbase(
		address,
		t.coinbasevalue,
		t.height,
		txs,
		message
	);

	var txlen = coinbase.tx.length;
	txs.forEach(tx => {
		txlen += tx.data.length / 2;
	});

	const txoffset = 80 + txcount.length;
	const block = Buffer.allocUnsafe(txoffset + txlen);
	txcount.copy(block, 80);
	coinbase.tx.copy(block, txoffset);
	var o = txoffset + coinbase.tx.length;
	txs.forEach(tx => {
		const data = Buffer.from(tx.data, 'hex');
		data.copy(block, o);
		o += data.length;
	});

	const mRoot = merkleRoot([ coinbase.txid, ...txs.map(x => x.txid) ]);

	block.writeUInt32LE(t.version);
	Buffer.from(t.previousblockhash, 'hex').reverse().copy(block, 4);
	mRoot.copy(block, 36);
	block.writeUInt32LE(time, 68);
	Buffer.from(cheat ? '1d00ffff' : t.bits, 'hex').reverse().copy(block, 72);

	return { block, mempool };
}

const minerd = `${dirname(process.argv[1])}/cpuminer/minerd`;

templateFile = process.argv[2];

if (templateFile) {
	console.log(`Using block template from ${templateFile}`);
}

main();

async function main() {
	while (true) {
		const work = await getWork();

		const header = await mine(work.block.slice(0, 76));

		if (header) {
			header.copy(work.block);
			const hash = bitcoin.crypto.hash256(header).reverse().toString('hex');
			console.log(`Found block! ${hash}`);
			const block = work.block.toString('hex');
			writeFileSync(`/tmp/${hash}-${new Date().getTime()}.blk`, block);
			process.stdout.write('submitblock...');
			const p = await btc('submitblock', block);
			if (p) {
				console.log('\n' + p);
				return;
			}
			console.log(' ok');
			if (templateFile) {
				console.log(`Falling back to bitcoind's blocktemplate`);
				templateFile = undefined;
			}
			work.mempool.forEach(m => {
				copyFileSync(`mempool/${m}`,`/tmp/${m}`);
				unlinkSync(`mempool/${m}`);
			});
		}
	}
}

var first = true;

function mine(header: Buffer): Promise<Buffer | void> {
	return new Promise((r, e) => {
		const args = [ header.toString('hex') ];
		if (first) {
			first = false;
			args.push('info');
		}
		const p = spawn(minerd, args);

		var out = ''

		p.stdout.setEncoding('utf8');
		p.stdout.on('data', data => out += data.toString());

		p.stderr.setEncoding('utf8');
		p.stderr.pipe(process.stderr);

		p.on('close', code => {
			while (out.endsWith('\n')) {
				out = out.slice(0, -1);
			}
			if (code) {
				e(out);
			} else if (out) {
				r(Buffer.from(out, 'hex'));
			} else {
				r();
			}
		});
	});
}
