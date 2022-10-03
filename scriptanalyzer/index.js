"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var ScriptAnalyzer = /** @class */ (function () {
    function ScriptAnalyzer(arg) {
        if (arg instanceof ScriptAnalyzer) {
            this.version = arg.version;
            this.rules = arg.rules;
            this.stack = arg.stack.slice();
            this.altstack = arg.altstack.slice();
            this.spendingConditions = arg.spendingConditions.slice();
            this.varCounter = arg.varCounter;
            this.script = arg.script;
            this.scriptOffset = arg.scriptOffset;
            this.path = arg.path + 1;
            this.cs = arg.cs.clone();
            this.branches = arg.branches;
            this.branches.push(this);
        }
        else {
            this.version = getScriptVersion();
            this.rules = getScriptRules();
            this.stack = [];
            this.altstack = [];
            this.spendingConditions = [];
            this.varCounter = 0;
            this.script = arg;
            this.scriptOffset = 0;
            this.path = 0;
            this.cs = new ConditionStack();
            this.branches = [this];
        }
    }
    /** Pass an array of (Uint8Array | number) where a Uint8Array is a data push and a number is an opcode */
    ScriptAnalyzer.analyzeScript = function (script) {
        for (var _i = 0, script_1 = script; _i < script_1.length; _i++) {
            var op = script_1[_i];
            if (typeof op === 'number' && disabledOpcodes.includes(op)) {
                return scriptErrorString(ScriptError.SCRIPT_ERR_DISABLED_OPCODE);
            }
        }
        var analyzer = new ScriptAnalyzer(script);
        var out = analyzer.analyze();
        if (typeof out === 'number') {
            console.log('spending path error:', scriptErrorString(out), analyzer.stack);
            return;
        }
        analyzer.cleanupConditions();
    };
    ScriptAnalyzer.prototype.printSpendingConditions = function (conds) {
        console.log(conds.map(function (exprs) { return exprs.map(function (expr) { return Util.exprToString(expr); }).join(' && '); }).join(' ||\n'));
        // console.log('stack', this.stack);
        // console.log('altstack', this.altstack);
    };
    ScriptAnalyzer.prototype.evalExpr = function (expr) {
        /*
        if (expr instanceof Uint8Array) {
            return ScriptConv.Bool.decode(expr);
        }
        */
        if ('opcode' in expr) {
            switch (expr.opcode) {
                case opcodes.OP_EQUAL: {
                    var _a = expr.args, a1 = _a[0], a2 = _a[1];
                    if (a1 instanceof Uint8Array && a2 instanceof Uint8Array) {
                        return ScriptConv.Bool.encode(!Util.bufferCompare(a1, a2));
                    }
                    break;
                }
                case opcodes.INTERNAL_NOT:
                case opcodes.OP_NOT: {
                    if (expr.args[0] instanceof Uint8Array) {
                        return ScriptConv.Bool.not(expr.args[0]);
                    }
                    var arg = expr.args[0];
                    if ('opcode' in arg && arg.opcode === opcodes.OP_CHECKSIG) {
                        return { opcode: opcodes.OP_EQUAL, args: [arg.args[0], ScriptConv.Bool.FALSE] };
                    }
                    break;
                }
                /*
                case opcodes.OP_CHECKMULTISIG: {
                    const l = expr.args.length;
                    const k = (<Uint8Array>expr.args[l - 1])[0];
                    const s = (<Uint8Array>expr.args[l - k - 1])[0];
                    if (k === s) {
                        const output: Expr[] = [];
                        for (let i = 0; i < k; i++) {
                            output.push({
                                opcode: opcodes.OP_CHECKSIG,
                                args: [ expr.args[l - i - k - 3], expr.args[l - i - 2] ]
                            });
                        }
                        return output;
                    }
                    break;
                }
                */
            }
        }
    };
    ScriptAnalyzer.prototype.cleanupConditions = function () {
        var conds = this.branches.map(function (b) { return b.spendingConditions; });
        for (var i = 0; i < conds.length; i++) {
            var exprs = conds[i];
            Util.normalizeExprs(exprs);
            exprs: for (var j = 0; j < exprs.length; j++) {
                var expr = exprs[j];
                for (var k = j + 1; k < exprs.length; k++) {
                    var expr2 = exprs[k];
                    if (Util.exprEqual(expr, expr2)) {
                        exprs.splice(k, 1);
                        k--;
                    }
                    else if (('opcode' in expr &&
                        (expr.opcode === opcodes.OP_NOT || expr.opcode === opcodes.INTERNAL_NOT) &&
                        Util.exprEqual(expr.args[0], exprs[k])) ||
                        ('opcode' in expr2 &&
                            (expr2.opcode === opcodes.OP_NOT || expr2.opcode === opcodes.INTERNAL_NOT) &&
                            Util.exprEqual(expr, expr2.args[0]))) {
                        conds.splice(i, 1);
                        i--;
                        break exprs;
                    }
                }
                var res = this.evalExpr(expr);
                if (typeof res === 'boolean') {
                    if (res) {
                        exprs.splice(j, 1);
                        j--;
                        // continue;
                    }
                    else {
                        conds.splice(i, 1);
                        i--;
                        break;
                    }
                }
                else if (res) {
                    exprs[j] = res;
                    j--;
                }
            }
        }
        this.printSpendingConditions(conds);
    };
    ScriptAnalyzer.prototype.analyze = function () {
        var _a, _b, _c, _d, _e, _f, _g;
        while (this.scriptOffset < this.script.length) {
            var fExec = this.cs.all_true();
            var op = this.script[this.scriptOffset++];
            if (!fExec && (op instanceof Uint8Array || op < opcodes.OP_IF || op > opcodes.OP_ENDIF)) {
                continue;
            }
            if (op instanceof Uint8Array) {
                this.stack.push(op);
            }
            else {
                switch (op) {
                    case opcodes.OP_0: {
                        this.stack.push(new Uint8Array([]));
                        break;
                    }
                    case opcodes.OP_1:
                    case opcodes.OP_2:
                    case opcodes.OP_3:
                    case opcodes.OP_4:
                    case opcodes.OP_5:
                    case opcodes.OP_6:
                    case opcodes.OP_7:
                    case opcodes.OP_8:
                    case opcodes.OP_9:
                    case opcodes.OP_10:
                    case opcodes.OP_11:
                    case opcodes.OP_12:
                    case opcodes.OP_13:
                    case opcodes.OP_14:
                    case opcodes.OP_15:
                    case opcodes.OP_16: {
                        this.stack.push(new Uint8Array([op - 0x50]));
                        break;
                    }
                    case opcodes.OP_NOP: {
                        break;
                    }
                    case opcodes.OP_IF:
                    case opcodes.OP_NOTIF: {
                        if (fExec) {
                            var minimalIf = this.version === ScriptVersion.SEGWITV1 ||
                                (this.version === ScriptVersion.SEGWITV0 && this.rules === ScriptRules.ALL);
                            var elem = this.takeElements(1)[0];
                            var fork = new ScriptAnalyzer(this);
                            this.cs.push_back(op === opcodes.OP_IF);
                            fork.cs.push_back(op !== opcodes.OP_IF);
                            if (minimalIf) {
                                var error = this.version === ScriptVersion.SEGWITV1
                                    ? ScriptError.SCRIPT_ERR_TAPSCRIPT_MINIMALIF
                                    : ScriptError.SCRIPT_ERR_MINIMALIF;
                                this.spendingConditions.push({ opcode: opcodes.OP_EQUAL, args: [elem, ScriptConv.Bool.TRUE], error: error });
                                fork.spendingConditions.push({ opcode: opcodes.OP_EQUAL, args: [elem, ScriptConv.Bool.FALSE], error: error });
                            }
                            else {
                                this.spendingConditions.push(elem);
                                fork.spendingConditions.push({ opcode: opcodes.INTERNAL_NOT, args: [elem] });
                            }
                            fork.analyze();
                        }
                        else {
                            this.cs.push_back(false);
                        }
                        break;
                    }
                    case opcodes.OP_ELSE: {
                        if (this.cs.empty()) {
                            return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
                        }
                        this.cs.toggle_top();
                        break;
                    }
                    case opcodes.OP_ENDIF: {
                        if (this.cs.empty()) {
                            return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
                        }
                        this.cs.pop_back();
                        break;
                    }
                    case opcodes.OP_VERIFY: {
                        if (!this.verify()) {
                            return ScriptError.SCRIPT_ERR_VERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_RETURN: {
                        return ScriptError.SCRIPT_ERR_OP_RETURN;
                    }
                    case opcodes.OP_TOALTSTACK: {
                        this.altstack.push(this.takeElements(1)[0]);
                        break;
                    }
                    case opcodes.OP_FROMALTSTACK: {
                        if (!this.altstack.length) {
                            return ScriptError.SCRIPT_ERR_INVALID_ALTSTACK_OPERATION;
                        }
                        this.stack.push(this.altstack.pop());
                        break;
                    }
                    case opcodes.OP_2DROP: {
                        this.takeElements(2);
                        break;
                    }
                    case opcodes.OP_2DUP: {
                        (_a = this.stack).push.apply(_a, this.readElements(2));
                        break;
                    }
                    case opcodes.OP_3DUP: {
                        (_b = this.stack).push.apply(_b, this.readElements(3));
                        break;
                    }
                    case opcodes.OP_2OVER: {
                        (_c = this.stack).push.apply(_c, this.readElements(4).slice(0, 2));
                        break;
                    }
                    case opcodes.OP_2ROT: {
                        var elems = this.takeElements(6);
                        (_d = this.stack).push.apply(_d, __spreadArray(__spreadArray([], elems.slice(2), false), elems.slice(0, 2), false));
                        break;
                    }
                    case opcodes.OP_2SWAP: {
                        var elems = this.takeElements(4);
                        (_e = this.stack).push.apply(_e, __spreadArray(__spreadArray([], elems.slice(2), false), elems.slice(0, 2), false));
                        break;
                    }
                    case opcodes.OP_IFDUP: {
                        var elem = this.readElements(1)[0];
                        var fork = new ScriptAnalyzer(this);
                        this.spendingConditions.push(elem);
                        this.stack.push(elem);
                        fork.spendingConditions.push({ opcode: opcodes.INTERNAL_NOT, args: [elem] });
                        fork.analyze();
                        break;
                    }
                    case opcodes.OP_DEPTH: {
                        this.stack.push(ScriptConv.Int.encode(this.stack.length));
                        break;
                    }
                    case opcodes.OP_DROP: {
                        this.takeElements(1);
                        break;
                    }
                    case opcodes.OP_DUP: {
                        this.stack.push(this.readElements(1)[0]);
                        break;
                    }
                    case opcodes.OP_NIP: {
                        this.stack.push(this.takeElements(2)[1]);
                        break;
                    }
                    case opcodes.OP_OVER: {
                        this.stack.push(this.readElements(2)[0]);
                        break;
                    }
                    case opcodes.OP_PICK:
                    case opcodes.OP_ROLL: {
                        var index = this.numFromStack(op);
                        if (!index) {
                            return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
                        }
                        if (index.n < 0) {
                            return ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION;
                        }
                        var elem = this.readElements(index.n + 1)[0];
                        if (op === opcodes.OP_ROLL) {
                            this.stack.splice(this.stack.length - index.n - 1, 1);
                        }
                        this.stack.push(elem);
                        break;
                    }
                    case opcodes.OP_ROT: {
                        var elems = this.takeElements(3);
                        (_f = this.stack).push.apply(_f, __spreadArray(__spreadArray([], elems.slice(1), false), [elems[0]], false));
                        break;
                    }
                    case opcodes.OP_SWAP: {
                        var elems = this.takeElements(2);
                        this.stack.push(elems[1], elems[0]);
                        break;
                    }
                    case opcodes.OP_TUCK: {
                        var elems = this.takeElements(2);
                        (_g = this.stack).push.apply(_g, __spreadArray([elems[1]], elems, false));
                        break;
                    }
                    case opcodes.OP_SIZE: {
                        this.stack.push({ opcode: op, args: this.readElements(1) });
                        break;
                    }
                    case opcodes.OP_EQUAL:
                    case opcodes.OP_EQUALVERIFY: {
                        this.stack.push({ opcode: opcodes.OP_EQUAL, args: this.takeElements(2) });
                        if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_EQUALVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_1ADD:
                    case opcodes.OP_1SUB:
                    case opcodes.OP_NEGATE:
                    case opcodes.OP_ABS:
                    case opcodes.OP_NOT:
                    case opcodes.OP_0NOTEQUAL: {
                        this.stack.push({ opcode: op, args: this.takeElements(1) });
                        break;
                    }
                    case opcodes.OP_ADD:
                    case opcodes.OP_SUB:
                    case opcodes.OP_BOOLAND:
                    case opcodes.OP_BOOLOR:
                    case opcodes.OP_NUMEQUAL:
                    case opcodes.OP_NUMEQUALVERIFY:
                    case opcodes.OP_NUMNOTEQUAL:
                    case opcodes.OP_LESSTHAN:
                    case opcodes.OP_GREATERTHAN:
                    case opcodes.OP_LESSTHANOREQUAL:
                    case opcodes.OP_GREATERTHANOREQUAL:
                    case opcodes.OP_MIN:
                    case opcodes.OP_MAX: {
                        this.stack.push({
                            opcode: op === opcodes.OP_NUMEQUALVERIFY ? opcodes.OP_NUMEQUAL : op,
                            args: this.takeElements(2)
                        });
                        if (op === opcodes.OP_EQUALVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_NUMEQUALVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_WITHIN: {
                        this.stack.push({ opcode: op, args: this.takeElements(3) });
                        break;
                    }
                    case opcodes.OP_RIPEMD160:
                    case opcodes.OP_SHA1:
                    case opcodes.OP_SHA256:
                    case opcodes.OP_HASH160:
                    case opcodes.OP_HASH256: {
                        this.stack.push({ opcode: op, args: this.takeElements(1) });
                        break;
                    }
                    case opcodes.OP_CODESEPARATOR: {
                        break;
                    }
                    case opcodes.OP_CHECKSIG:
                    case opcodes.OP_CHECKSIGVERIFY: {
                        this.stack.push({ opcode: opcodes.OP_CHECKSIG, args: this.takeElements(2) });
                        if (op === opcodes.OP_CHECKSIGVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_CHECKSIGVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_CHECKMULTISIG:
                    case opcodes.OP_CHECKMULTISIGVERIFY: {
                        if (this.version === ScriptVersion.SEGWITV1) {
                            return ScriptError.SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG;
                        }
                        // TODO fix this mess
                        var kcount = this.numFromStack(op);
                        if (!kcount) {
                            return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
                        }
                        if (kcount.n < 0 || kcount.n > 20) {
                            return ScriptError.SCRIPT_ERR_PUBKEY_COUNT;
                        }
                        var pks = this.takeElements(kcount.n);
                        var scount = this.numFromStack(op);
                        if (!scount) {
                            return ScriptError.SCRIPT_ERR_NUM_OVERFLOW;
                        }
                        if (scount.n < 0 || scount.n > kcount.n) {
                            return ScriptError.SCRIPT_ERR_SIG_COUNT;
                        }
                        var sigs = this.takeElements(scount.n);
                        var dummy = this.takeElements(1)[0];
                        this.spendingConditions.push({
                            opcode: opcodes.OP_EQUAL,
                            args: [dummy, ScriptConv.Bool.FALSE],
                            error: ScriptError.SCRIPT_ERR_SIG_NULLDUMMY
                        });
                        this.stack.push({
                            opcode: opcodes.OP_CHECKMULTISIG,
                            args: __spreadArray(__spreadArray(__spreadArray(__spreadArray([], sigs, true), [ScriptConv.Int.encode(scount.n)], false), pks, true), [ScriptConv.Int.encode(kcount.n)], false)
                        });
                        if (op === opcodes.OP_CHECKMULTISIGVERIFY && !this.verify()) {
                            return ScriptError.SCRIPT_ERR_CHECKMULTISIGVERIFY;
                        }
                        break;
                    }
                    case opcodes.OP_CHECKLOCKTIMEVERIFY:
                    case opcodes.OP_CHECKSEQUENCEVERIFY: {
                        this.spendingConditions.push({ opcode: op, args: this.readElements(1) });
                        break;
                    }
                    case opcodes.OP_NOP1:
                    case opcodes.OP_NOP4:
                    case opcodes.OP_NOP5:
                    case opcodes.OP_NOP6:
                    case opcodes.OP_NOP7:
                    case opcodes.OP_NOP8:
                    case opcodes.OP_NOP9:
                    case opcodes.OP_NOP10: {
                        break;
                    }
                    case opcodes.OP_CHECKSIGADD: {
                        if (this.version < ScriptVersion.SEGWITV1) {
                            return ScriptError.SCRIPT_ERR_BAD_OPCODE;
                        }
                        var _h = this.takeElements(3), sig = _h[0], n = _h[1], pk = _h[2];
                        this.stack.push({ opcode: opcodes.OP_ADD, args: [n, { opcode: opcodes.OP_CHECKSIG, args: [sig, pk] }] });
                        break;
                    }
                    default: {
                        return ScriptError.SCRIPT_ERR_BAD_OPCODE;
                    }
                }
            }
            /*
            // i really like debugging! :)
            console.log('exec   ' + fExec);
            console.log('path   ' + this.path);
            console.log('op     ' + (typeof op === 'number' ? getOpcode(op) : ('push ' + op.length)));
            console.log('stack  ' + this.stack.map(a => a instanceof Uint8Array ? Util.scriptElemToHex(a) : Util.exprToString(a)).join(', '));
            console.log('verify ' + this.spendingConditions.map(s => Util.exprToString(s)).join(' && '));
            console.log('');
            */
            if (this.stack.length + this.altstack.length > 1000) {
                return ScriptError.SCRIPT_ERR_STACK_SIZE;
            }
        }
        if (!this.cs.empty()) {
            return ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL;
        }
        if (this.stack.length > 1) {
            return ScriptError.SCRIPT_ERR_CLEANSTACK;
        }
        if (!this.verify()) {
            return ScriptError.SCRIPT_ERR_EVAL_FALSE;
        }
    };
    /** OP_VERIFY */
    ScriptAnalyzer.prototype.verify = function () {
        var elem = this.takeElements(1)[0];
        if (elem instanceof Uint8Array) {
            if (!ScriptConv.Bool.decode(elem)) {
                return false;
            }
        }
        else {
            /*
            if ('opcode' in elem && elem.opcode === opcodes.OP_CHECKMULTISIG) {
                const l = elem.args.length;
                const k = (<Uint8Array>elem.args[l - 1])[0];
                const s = (<Uint8Array>elem.args[l - k - 1])[0];
                if (k === s) {
                    for (let i = 0; i < k; i++) {
                        this.spendingConditions.push({
                            opcode: opcodes.OP_CHECKSIG,
                            args: [ elem.args[l - i - k - 3], elem.args[l - i - 2] ]
                        });
                    }
                    return true;
                }
            }
            */
            this.spendingConditions.push(elem);
        }
        return true;
    };
    ScriptAnalyzer.prototype.numFromStack = function (op) {
        var top = this.takeElements(1)[0];
        if (!(top instanceof Uint8Array)) {
            throw "".concat(opcodeName(op), " can't use stack/output values as depth (yet)");
        }
        if (top.length <= 4) {
            return { n: ScriptConv.Int.decode(top) };
        }
    };
    ScriptAnalyzer.prototype.takeElements = function (amount) {
        var res = [];
        for (var i = 0; i < amount; i++) {
            if (this.stack.length) {
                res.unshift(this.stack.pop());
            }
            else {
                res.unshift({ "var": this.varCounter++ });
            }
        }
        return res;
    };
    ScriptAnalyzer.prototype.readElements = function (amount) {
        while (this.stack.length < amount) {
            this.stack.unshift({ "var": this.varCounter++ });
        }
        return this.stack.slice(this.stack.length - amount);
    };
    return ScriptAnalyzer;
}());
// From the Bitcoin Core source code, file src/script/interpreter.cpp at commit b1a2021f78099c17360dc2179cbcb948059b5969
// Edited for TypeScript use
// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2021 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.
/** A constant for m_first_false_pos to indicate there are no falses. */
var NO_FALSE = -1;
/** A data type to abstract out the condition stack during script execution.
 *
 * Conceptually it acts like a vector of booleans, one for each level of nested
 * IF/THEN/ELSE, indicating whether we're in the active or inactive branch of
 * each.
 *
 * The elements on the stack cannot be observed individually; we only need to
 * expose whether the stack is empty and whether or not any false values are
 * present at all. To implement OP_ELSE, a toggle_top modifier is added, which
 * flips the last value without returning it.
 *
 * This uses an optimized implementation that does not materialize the
 * actual stack. Instead, it just stores the size of the would-be stack,
 * and the position of the first false value in it.
 */
var ConditionStack = /** @class */ (function () {
    function ConditionStack() {
        /** The size of the implied stack. */
        this.m_stack_size = 0;
        /** The position of the first false value on the implied stack, or NO_FALSE if all true. */
        this.m_first_false_pos = NO_FALSE;
    }
    ConditionStack.prototype.empty = function () {
        return this.m_stack_size === 0;
    };
    ConditionStack.prototype.all_true = function () {
        return this.m_first_false_pos === NO_FALSE;
    };
    ConditionStack.prototype.push_back = function (f) {
        if (this.m_first_false_pos === NO_FALSE && !f) {
            // The stack consists of all true values, and a false is added.
            // The first false value will appear at the current size.
            this.m_first_false_pos = this.m_stack_size;
        }
        ++this.m_stack_size;
    };
    ConditionStack.prototype.pop_back = function () {
        if (this.m_stack_size <= 0) {
            throw 'pop_back: stack size <= 0';
        }
        --this.m_stack_size;
        if (this.m_first_false_pos == this.m_stack_size) {
            // When popping off the first false value, everything becomes true.
            this.m_first_false_pos = NO_FALSE;
        }
    };
    ConditionStack.prototype.toggle_top = function () {
        if (this.m_stack_size <= 0) {
            throw 'toggle_top: stack size <= 0';
        }
        if (this.m_first_false_pos === NO_FALSE) {
            // The current stack is all true values; the first false will be the top.
            this.m_first_false_pos = this.m_stack_size - 1;
        }
        else if (this.m_first_false_pos === this.m_stack_size - 1) {
            // The top is the first false value; toggling it will make everything true.
            this.m_first_false_pos = NO_FALSE;
        } // else {
        // There is a false value, but not on top. No action is needed as toggling
        // anything but the first false value is unobservable.
        // }
    };
    ConditionStack.prototype.clone = function () {
        var cs = new ConditionStack();
        cs.m_stack_size = this.m_stack_size;
        cs.m_first_false_pos = this.m_first_false_pos;
        return cs;
    };
    return ConditionStack;
}());
var Hash;
(function (Hash) {
    /** sha1(data) */
    function sha1(data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = Uint8Array.bind;
                        return [4 /*yield*/, crypto.subtle.digest('SHA-1', data)];
                    case 1: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _b.sent()]))()];
                }
            });
        });
    }
    Hash.sha1 = sha1;
    /** sha256(data) */
    function sha256(data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = Uint8Array.bind;
                        return [4 /*yield*/, crypto.subtle.digest('SHA-256', data)];
                    case 1: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _b.sent()]))()];
                }
            });
        });
    }
    Hash.sha256 = sha256;
    /** sha256(sha256(data)) */
    function hash256(data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = Uint8Array.bind;
                        _c = (_b = crypto.subtle).digest;
                        _d = ['SHA-256'];
                        return [4 /*yield*/, crypto.subtle.digest('SHA-256', data)];
                    case 1: return [4 /*yield*/, _c.apply(_b, _d.concat([_e.sent()]))];
                    case 2: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _e.sent()]))()];
                }
            });
        });
    }
    Hash.hash256 = hash256;
    /** ripemd160(sha256(data)) */
    function hash160(data) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ripemd160;
                        _b = Uint8Array.bind;
                        return [4 /*yield*/, crypto.subtle.digest('SHA-256', data)];
                    case 1: return [2 /*return*/, _a.apply(void 0, [new (_b.apply(Uint8Array, [void 0, _c.sent()]))()])];
                }
            });
        });
    }
    Hash.hash160 = hash160;
    var tags = ['TapLeaf', 'TapBranch'];
    var tagHashes = {};
    var _loop_1 = function (t) {
        crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)).then(function (buf) {
            var tag = new Uint8Array(64);
            var hash = new Uint8Array(buf);
            tag.set(hash);
            tag.set(hash, 32);
            tagHashes[t] = tag;
        });
    };
    for (var _i = 0, tags_1 = tags; _i < tags_1.length; _i++) {
        var t = tags_1[_i];
        _loop_1(t);
    }
    /** sha256(sha256(tag) || sha256(tag) || data) */
    function sha256tagged(tag, data) {
        return __awaiter(this, void 0, void 0, function () {
            var dat, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        dat = new Uint8Array(64 + data.length);
                        dat.set(tagHashes[tag]);
                        dat.set(data, 64);
                        _a = Uint8Array.bind;
                        return [4 /*yield*/, crypto.subtle.digest('SHA-256', dat)];
                    case 1: return [2 /*return*/, new (_a.apply(Uint8Array, [void 0, _b.sent()]))()];
                }
            });
        });
    }
    Hash.sha256tagged = sha256tagged;
    // parts of the ripemd160 code copied from https://raw.githubusercontent.com/crypto-browserify/ripemd160/3419c6409799d37e0323a556c94d040154657d9d/index.js
    var zl = new Uint8Array([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8, 3, 10,
        14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12, 1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2, 4, 0, 5, 9, 7,
        12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13
    ]);
    var zr = new Uint8Array([
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12, 6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2, 15, 5,
        1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13, 8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14, 12, 15, 10, 4,
        1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11
    ]);
    var sl = new Uint8Array([
        11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8, 7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12, 11,
        13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5, 11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12, 9, 15,
        5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6
    ]);
    var sr = new Uint8Array([
        8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6, 9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11, 9,
        7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5, 15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8, 8, 5,
        12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11
    ]);
    var hl = new Uint32Array([0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e]);
    var hr = new Uint32Array([0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000]);
    function rotl(x, n) {
        return (x << n) | (x >>> (32 - n));
    }
    function fn1(a, b, c, d, e, m, k, s) {
        return (rotl((a + (b ^ c ^ d) + m + k) | 0, s) + e) | 0;
    }
    function fn2(a, b, c, d, e, m, k, s) {
        return (rotl((a + ((b & c) | (~b & d)) + m + k) | 0, s) + e) | 0;
    }
    function fn3(a, b, c, d, e, m, k, s) {
        return (rotl((a + ((b | ~c) ^ d) + m + k) | 0, s) + e) | 0;
    }
    function fn4(a, b, c, d, e, m, k, s) {
        return (rotl((a + ((b & d) | (c & ~d)) + m + k) | 0, s) + e) | 0;
    }
    function fn5(a, b, c, d, e, m, k, s) {
        return (rotl((a + (b ^ (c | ~d)) + m + k) | 0, s) + e) | 0;
    }
    function ripemd160_transform(state, data) {
        var al = state.a | 0;
        var bl = state.b | 0;
        var cl = state.c | 0;
        var dl = state.d | 0;
        var el = state.e | 0;
        var ar = state.a | 0;
        var br = state.b | 0;
        var cr = state.c | 0;
        var dr = state.d | 0;
        var er = state.e | 0;
        var tl;
        var tr;
        for (var i = 0; i < 80; i++) {
            if (i < 16) {
                tl = fn1(al, bl, cl, dl, el, data[zl[i]], hl[0], sl[i]);
                tr = fn5(ar, br, cr, dr, er, data[zr[i]], hr[0], sr[i]);
            }
            else if (i < 32) {
                tl = fn2(al, bl, cl, dl, el, data[zl[i]], hl[1], sl[i]);
                tr = fn4(ar, br, cr, dr, er, data[zr[i]], hr[1], sr[i]);
            }
            else if (i < 48) {
                tl = fn3(al, bl, cl, dl, el, data[zl[i]], hl[2], sl[i]);
                tr = fn3(ar, br, cr, dr, er, data[zr[i]], hr[2], sr[i]);
            }
            else if (i < 64) {
                tl = fn4(al, bl, cl, dl, el, data[zl[i]], hl[3], sl[i]);
                tr = fn2(ar, br, cr, dr, er, data[zr[i]], hr[3], sr[i]);
            }
            else {
                tl = fn5(al, bl, cl, dl, el, data[zl[i]], hl[4], sl[i]);
                tr = fn1(ar, br, cr, dr, er, data[zr[i]], hr[4], sr[i]);
            }
            al = el;
            el = dl;
            dl = rotl(cl, 10);
            cl = bl;
            bl = tl;
            ar = er;
            er = dr;
            dr = rotl(cr, 10);
            cr = br;
            br = tr;
        }
        var t = (state.b + cl + dr) | 0;
        state.b = (state.c + dl + er) | 0;
        state.c = (state.d + el + ar) | 0;
        state.d = (state.e + al + br) | 0;
        state.e = (state.a + bl + cr) | 0;
        state.a = t;
    }
    /** ripemd160(data) */
    function ripemd160(data) {
        var block = new Int32Array(16);
        var blocku8 = new Uint8Array(block.buffer);
        var blocku32 = new Uint32Array(block.buffer);
        var state = {
            a: 0x67452301,
            b: 0xefcdab89,
            c: 0x98badcfe,
            d: 0x10325476,
            e: 0xc3d2e1f0
        };
        var offset = 0;
        var blockOffset = 0;
        while (blockOffset + data.length - offset >= 64) {
            var i = blockOffset;
            while (i < 64) {
                blocku8[i++] = data[offset++];
            }
            ripemd160_transform(state, block);
            blockOffset = 0;
        }
        while (offset < data.length) {
            blocku8[blockOffset++] = data[offset++];
        }
        blocku8[blockOffset++] = 0x80;
        if (blockOffset > 56) {
            blocku8.fill(0, blockOffset, 64);
            ripemd160_transform(state, block);
            blockOffset = 0;
        }
        blocku8.fill(0, blockOffset, 56);
        // shortcut for data.length < 4294967296 (4 gigabyte)
        // let l1 = data.length * 8;
        // let l2 = (l1 / 0x0100000000) | 0;
        // if (l2 > 0) {
        // 	l1 -= 0x0100000000 * l2;
        // }
        blocku32[14] = data.length * 8; // l1;
        // const l3 = (l2 / 0x0100000000) | 0;
        // if (l3 > 0) {
        // 	l2 -= 0x0100000000 * l3;
        // }
        blocku32[15] = 0; // l2;
        ripemd160_transform(state, block);
        return new Uint8Array(new Int32Array([state.a, state.b, state.c, state.d, state.e]).buffer);
    }
    Hash.ripemd160 = ripemd160;
})(Hash || (Hash = {}));
var html = {
    asm: document.getElementById('asm'),
    asmError: document.getElementById('asm-error'),
    hex: document.getElementById('hex'),
    hexError: document.getElementById('hex-error'),
    analysis: document.getElementById('analysis'),
    scriptVersion: document.getElementById('script-version'),
    scriptRules: document.getElementById('script-rules'),
    webcryptoError: document.getElementById('webcrypto-error')
};
html.webcryptoError.hidden = window.isSecureContext;
['keydown', 'keypress', 'keyup'].forEach(function (a) {
    html.asm.addEventListener(a, function () {
        try {
            var hex = (html.hex.innerHTML = asmtohex(html.asm.innerText));
            runAnalyzer(parseHexScript(hex));
            html.asmError.innerText = '';
        }
        catch (e) {
            if (typeof e === 'string') {
                html.asmError.innerText = e;
            }
            else {
                throw e;
            }
        }
    });
    html.hex.addEventListener(a, function () {
        try {
            var script = parseHexScript(html.hex.innerText);
            html.asm.innerHTML = '';
            scriptToAsm(script).forEach(function (e) {
                var span = document.createElement('span');
                span.innerText = e.s;
                span.classList.add("script-".concat(OpcodeType[e.t].toLowerCase()));
                html.asm.appendChild(span);
                html.asm.appendChild(document.createElement('br'));
            });
            runAnalyzer(script);
            html.hexError.innerText = '';
        }
        catch (e) {
            if (typeof e === 'string') {
                html.hexError.innerText = e;
            }
            else {
                throw e;
            }
        }
    });
});
function runAnalyzer(script) {
    try {
        ScriptAnalyzer.analyzeScript(script);
    }
    catch (e) {
        console.error('ScriptAnalyzer error', e);
    }
}
function getScriptVersion() {
    return html.scriptVersion.selectedIndex;
}
function getScriptRules() {
    return html.scriptRules.selectedIndex;
}
var _a;
var opcodes = {
    // https://github.com/bitcoin/bitcoin/blob/fa5c896724bb359b4b9a3f89580272bfe5980c1b/src/script/script.h#L65-L206
    // push value
    OP_0: 0x00,
    OP_FALSE: 0x00,
    OP_PUSHDATA1: 0x4c,
    OP_PUSHDATA2: 0x4d,
    OP_PUSHDATA4: 0x4e,
    OP_1NEGATE: 0x4f,
    OP_RESERVED: 0x50,
    OP_1: 0x51,
    OP_TRUE: 0x51,
    OP_2: 0x52,
    OP_3: 0x53,
    OP_4: 0x54,
    OP_5: 0x55,
    OP_6: 0x56,
    OP_7: 0x57,
    OP_8: 0x58,
    OP_9: 0x59,
    OP_10: 0x5a,
    OP_11: 0x5b,
    OP_12: 0x5c,
    OP_13: 0x5d,
    OP_14: 0x5e,
    OP_15: 0x5f,
    OP_16: 0x60,
    // control
    OP_NOP: 0x61,
    OP_VER: 0x62,
    OP_IF: 0x63,
    OP_NOTIF: 0x64,
    OP_VERIF: 0x65,
    OP_VERNOTIF: 0x66,
    OP_ELSE: 0x67,
    OP_ENDIF: 0x68,
    OP_VERIFY: 0x69,
    OP_RETURN: 0x6a,
    // stack ops
    OP_TOALTSTACK: 0x6b,
    OP_FROMALTSTACK: 0x6c,
    OP_2DROP: 0x6d,
    OP_2DUP: 0x6e,
    OP_3DUP: 0x6f,
    OP_2OVER: 0x70,
    OP_2ROT: 0x71,
    OP_2SWAP: 0x72,
    OP_IFDUP: 0x73,
    OP_DEPTH: 0x74,
    OP_DROP: 0x75,
    OP_DUP: 0x76,
    OP_NIP: 0x77,
    OP_OVER: 0x78,
    OP_PICK: 0x79,
    OP_ROLL: 0x7a,
    OP_ROT: 0x7b,
    OP_SWAP: 0x7c,
    OP_TUCK: 0x7d,
    // splice ops
    OP_CAT: 0x7e,
    OP_SUBSTR: 0x7f,
    OP_LEFT: 0x80,
    OP_RIGHT: 0x81,
    OP_SIZE: 0x82,
    // bit logic
    OP_INVERT: 0x83,
    OP_AND: 0x84,
    OP_OR: 0x85,
    OP_XOR: 0x86,
    OP_EQUAL: 0x87,
    OP_EQUALVERIFY: 0x88,
    OP_RESERVED1: 0x89,
    OP_RESERVED2: 0x8a,
    // numeric
    OP_1ADD: 0x8b,
    OP_1SUB: 0x8c,
    OP_2MUL: 0x8d,
    OP_2DIV: 0x8e,
    OP_NEGATE: 0x8f,
    OP_ABS: 0x90,
    OP_NOT: 0x91,
    OP_0NOTEQUAL: 0x92,
    OP_ADD: 0x93,
    OP_SUB: 0x94,
    OP_MUL: 0x95,
    OP_DIV: 0x96,
    OP_MOD: 0x97,
    OP_LSHIFT: 0x98,
    OP_RSHIFT: 0x99,
    OP_BOOLAND: 0x9a,
    OP_BOOLOR: 0x9b,
    OP_NUMEQUAL: 0x9c,
    OP_NUMEQUALVERIFY: 0x9d,
    OP_NUMNOTEQUAL: 0x9e,
    OP_LESSTHAN: 0x9f,
    OP_GREATERTHAN: 0xa0,
    OP_LESSTHANOREQUAL: 0xa1,
    OP_GREATERTHANOREQUAL: 0xa2,
    OP_MIN: 0xa3,
    OP_MAX: 0xa4,
    OP_WITHIN: 0xa5,
    // crypto
    OP_RIPEMD160: 0xa6,
    OP_SHA1: 0xa7,
    OP_SHA256: 0xa8,
    OP_HASH160: 0xa9,
    OP_HASH256: 0xaa,
    OP_CODESEPARATOR: 0xab,
    OP_CHECKSIG: 0xac,
    OP_CHECKSIGVERIFY: 0xad,
    OP_CHECKMULTISIG: 0xae,
    OP_CHECKMULTISIGVERIFY: 0xaf,
    // expansion
    OP_NOP1: 0xb0,
    OP_CHECKLOCKTIMEVERIFY: 0xb1,
    OP_NOP2: 0xb1,
    OP_CHECKSEQUENCEVERIFY: 0xb2,
    OP_NOP3: 0xb2,
    OP_NOP4: 0xb3,
    OP_NOP5: 0xb4,
    OP_NOP6: 0xb5,
    OP_NOP7: 0xb6,
    OP_NOP8: 0xb7,
    OP_NOP9: 0xb8,
    OP_NOP10: 0xb9,
    // Opcode added by BIP 342 (Tapscript)
    OP_CHECKSIGADD: 0xba,
    OP_INVALIDOPCODE: 0xff,
    // aliases
    OP_CLTV: 0xb1,
    OP_CSV: 0xb2,
    // internal opcodes (not used in bitcoin core)
    INTERNAL_NOT: -1
};
/** Disabled because of CVE-2010-5137 */
var disabledOpcodes = [
    opcodes.OP_CAT,
    opcodes.OP_SUBSTR,
    opcodes.OP_LEFT,
    opcodes.OP_RIGHT,
    opcodes.OP_INVERT,
    opcodes.OP_AND,
    opcodes.OP_OR,
    opcodes.OP_XOR,
    opcodes.OP_2MUL,
    opcodes.OP_2DIV,
    opcodes.OP_MUL,
    opcodes.OP_DIV,
    opcodes.OP_MOD,
    opcodes.OP_LSHIFT,
    opcodes.OP_RSHIFT
];
var pushdataLength = (_a = {},
    _a[opcodes.OP_PUSHDATA1] = 1,
    _a[opcodes.OP_PUSHDATA2] = 2,
    _a[opcodes.OP_PUSHDATA4] = 4,
    _a);
function opcodeName(op) {
    if (op < 0) {
        return;
    }
    var o = Object.entries(opcodes).find(function (x) { return x[1] === op; });
    if (o) {
        return o[0];
    }
}
function asmtohex(asm) {
    var src = asm.split(/\s+/).filter(function (x) { return x; });
    var script = '';
    for (var _i = 0, src_1 = src; _i < src_1.length; _i++) {
        var op = src_1[_i];
        if (/^(|-)[0-9]+$/.test(op)) {
            var n = parseInt(op);
            if (n === 0) {
                // OP_0
                script += '00';
            }
            else if (n >= -1 && n <= 16) {
                // OP_1NEGATE (4f), OP_1 (51) ... OP_16 (60)
                script += (0x50 + n).toString(16);
            }
            else {
                if (Math.abs(n) > 0x7fffffff) {
                    throw 'Too large decimal integer';
                }
                var s = ScriptConv.Int.encode(n);
                script += Util.intEncodeLEHex(s.length, 1) + Util.bufferToHex(s);
            }
        }
        else if (/^<[0-9a-fA-F]*>$/.test(op)) {
            var hex = op.slice(1, -1).toLowerCase();
            if (hex.length & 1) {
                throw 'Odd amount of characters in hex literal';
            }
            var l = hex.length / 2;
            if (l <= 75) {
                script += Util.intEncodeLEHex(l, 1);
            }
            else if (l <= 0xff) {
                // OP_PUSHDATA1
                script += '4c' + Util.intEncodeLEHex(l, 1);
            }
            else if (l <= 520) {
                // OP_PUSHDATA2
                script += '4d' + Util.intEncodeLEHex(l, 2);
            }
            else {
                throw 'Data push too large';
            }
            script += hex;
        }
        else {
            var opcode = opcodes[op.toUpperCase()] || opcodes[('OP_' + op.toUpperCase())];
            if (opcode === undefined || opcode < 0) {
                throw "Unknown opcode ".concat(op.length > 50 ? op.slice(0, 50) + '..' : op).concat(/^[0-9a-fA-F]+$/.test(op) ? '. Hex data pushes have to be between < and >' : '');
            }
            if (pushdataLength[opcode]) {
                throw 'OP_PUSHDATA is not allowed is Bitcoin ASM script';
            }
            script += Util.intEncodeLEHex(opcode, 1);
        }
    }
    return script;
}
function parseHexScript(hex) {
    var v = hex.replace(/\s+/g, '').toLowerCase();
    if (!/^[0-9a-f]*$/.test(v)) {
        throw 'Illegal characters in hex literal';
    }
    if (v.length & 1) {
        throw 'Odd amount of characters in hex literal';
    }
    var bytes = Util.hexToBuffer(v);
    var a = [];
    for (var offset = 0; offset < bytes.length;) {
        var b = bytes[offset++];
        var op = opcodeName(b);
        if (op) {
            var n = pushdataLength[b];
            if (n) {
                var pushSize = bytes.subarray(offset, offset + n);
                if (pushSize.length !== n) {
                    throw "".concat(op, " with incomplete push length (SCRIPT_ERR_BAD_OPCODE)");
                }
                var l = Util.intDecodeLE(pushSize);
                offset += n;
                var data = bytes.subarray(offset, offset + l);
                offset += l;
                if (data.length !== l) {
                    throw "Invalid length, expected ".concat(l, " but got ").concat(data.length, " (SCRIPT_ERR_BAD_OPCODE)");
                }
                a.push(data);
            }
            else {
                a.push(b);
            }
        }
        else if (b <= 75) {
            var data = bytes.subarray(offset, offset + b);
            offset += b;
            if (data.length != b) {
                throw "Invalid length, expected ".concat(b, " but got ").concat(data.length, " (SCRIPT_ERR_BAD_OPCODE)");
            }
            a.push(data);
        }
        else {
            throw "Invalid opcode 0x".concat(b.toString(16).padStart(2, '0'));
        }
    }
    return a;
}
function scriptToAsm(script) {
    var asm = [];
    for (var _i = 0, script_2 = script; _i < script_2.length; _i++) {
        var op = script_2[_i];
        if (op instanceof Uint8Array) {
            if (op.length <= 4) {
                asm.push({ s: '' + ScriptConv.Int.decode(op), t: OpcodeType.NUMBER });
            }
            else {
                asm.push({ s: Util.scriptElemToHex(op), t: OpcodeType.DATA });
            }
        }
        else {
            if (op === opcodes.OP_0) {
                asm.push({ s: '0', t: OpcodeType.NUMBER });
            }
            else if ((op >= opcodes.OP_1 && op <= opcodes.OP_16) || op === opcodes.OP_1NEGATE) {
                asm.push({ s: '' + (op - 0x50), t: OpcodeType.NUMBER });
            }
            else {
                asm.push({ s: opcodeName(op) || 'OP_INVALIDOPCODE', t: opcodeType(op) });
            }
        }
    }
    return asm;
}
function opcodeType(op) {
    if (disabledOpcodes.includes(op)) {
        return OpcodeType.DISABLED;
    }
    else if ([opcodes.OP_VER, opcodes.OP_VERIF, opcodes.OP_VERNOTIF].includes(op)) {
        return OpcodeType.INVALID;
    }
    else if (op >= 0 && op <= opcodes.OP_PUSHDATA4) {
        return OpcodeType.CONSTANT;
    }
    else if (op >= opcodes.OP_NOP && op <= opcodes.OP_RETURN) {
        return OpcodeType.FLOW;
    }
    else if (op >= opcodes.OP_TOALTSTACK && op <= opcodes.OP_TUCK) {
        return OpcodeType.STACK;
    }
    else if (op >= opcodes.OP_CAT && op <= opcodes.OP_SIZE) {
        return OpcodeType.SPLICE;
    }
    else if (op >= opcodes.OP_INVERT && op <= opcodes.OP_EQUALVERIFY) {
        return OpcodeType.BITWISE;
    }
    else if (op >= opcodes.OP_1ADD && op <= opcodes.OP_WITHIN) {
        return OpcodeType.ARITHMETIC;
    }
    else if ((op >= opcodes.OP_RIPEMD160 && op <= opcodes.OP_CHECKMULTISIGVERIFY) || op === opcodes.OP_CHECKSIGADD) {
        return OpcodeType.CRYPTO;
    }
    else if (op >= opcodes.OP_CHECKLOCKTIMEVERIFY && op <= opcodes.OP_CHECKSEQUENCEVERIFY) {
        return OpcodeType.LOCKTIME;
    }
    return OpcodeType.INVALID;
}
// From the Bitcoin Core source code, files src/script/script_error.{h,cpp} at commit b1a2021f78099c17360dc2179cbcb948059b5969
// Edited for TypeScript use
// Orignal Bitcoin Core copyright header:
// Copyright (c) 2009-2010 Satoshi Nakamoto
// Copyright (c) 2009-2020 The Bitcoin Core developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or http://www.opensource.org/licenses/mit-license.php.
var ScriptError;
(function (ScriptError) {
    ScriptError[ScriptError["SCRIPT_ERR_OK"] = 0] = "SCRIPT_ERR_OK";
    ScriptError[ScriptError["SCRIPT_ERR_UNKNOWN_ERROR"] = 1] = "SCRIPT_ERR_UNKNOWN_ERROR";
    ScriptError[ScriptError["SCRIPT_ERR_EVAL_FALSE"] = 2] = "SCRIPT_ERR_EVAL_FALSE";
    ScriptError[ScriptError["SCRIPT_ERR_OP_RETURN"] = 3] = "SCRIPT_ERR_OP_RETURN";
    /* Max sizes */
    ScriptError[ScriptError["SCRIPT_ERR_SCRIPT_SIZE"] = 4] = "SCRIPT_ERR_SCRIPT_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_PUSH_SIZE"] = 5] = "SCRIPT_ERR_PUSH_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_OP_COUNT"] = 6] = "SCRIPT_ERR_OP_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_STACK_SIZE"] = 7] = "SCRIPT_ERR_STACK_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_COUNT"] = 8] = "SCRIPT_ERR_SIG_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_PUBKEY_COUNT"] = 9] = "SCRIPT_ERR_PUBKEY_COUNT";
    /* Failed verify operations */
    ScriptError[ScriptError["SCRIPT_ERR_VERIFY"] = 10] = "SCRIPT_ERR_VERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_EQUALVERIFY"] = 11] = "SCRIPT_ERR_EQUALVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_CHECKMULTISIGVERIFY"] = 12] = "SCRIPT_ERR_CHECKMULTISIGVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_CHECKSIGVERIFY"] = 13] = "SCRIPT_ERR_CHECKSIGVERIFY";
    ScriptError[ScriptError["SCRIPT_ERR_NUMEQUALVERIFY"] = 14] = "SCRIPT_ERR_NUMEQUALVERIFY";
    /* Logical/Format/Canonical errors */
    ScriptError[ScriptError["SCRIPT_ERR_BAD_OPCODE"] = 15] = "SCRIPT_ERR_BAD_OPCODE";
    ScriptError[ScriptError["SCRIPT_ERR_DISABLED_OPCODE"] = 16] = "SCRIPT_ERR_DISABLED_OPCODE";
    ScriptError[ScriptError["SCRIPT_ERR_INVALID_STACK_OPERATION"] = 17] = "SCRIPT_ERR_INVALID_STACK_OPERATION";
    ScriptError[ScriptError["SCRIPT_ERR_INVALID_ALTSTACK_OPERATION"] = 18] = "SCRIPT_ERR_INVALID_ALTSTACK_OPERATION";
    ScriptError[ScriptError["SCRIPT_ERR_UNBALANCED_CONDITIONAL"] = 19] = "SCRIPT_ERR_UNBALANCED_CONDITIONAL";
    /* CHECKLOCKTIMEVERIFY and CHECKSEQUENCEVERIFY */
    ScriptError[ScriptError["SCRIPT_ERR_NEGATIVE_LOCKTIME"] = 20] = "SCRIPT_ERR_NEGATIVE_LOCKTIME";
    ScriptError[ScriptError["SCRIPT_ERR_UNSATISFIED_LOCKTIME"] = 21] = "SCRIPT_ERR_UNSATISFIED_LOCKTIME";
    /* Malleability */
    ScriptError[ScriptError["SCRIPT_ERR_SIG_HASHTYPE"] = 22] = "SCRIPT_ERR_SIG_HASHTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_DER"] = 23] = "SCRIPT_ERR_SIG_DER";
    ScriptError[ScriptError["SCRIPT_ERR_MINIMALDATA"] = 24] = "SCRIPT_ERR_MINIMALDATA";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_PUSHONLY"] = 25] = "SCRIPT_ERR_SIG_PUSHONLY";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_HIGH_S"] = 26] = "SCRIPT_ERR_SIG_HIGH_S";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_NULLDUMMY"] = 27] = "SCRIPT_ERR_SIG_NULLDUMMY";
    ScriptError[ScriptError["SCRIPT_ERR_PUBKEYTYPE"] = 28] = "SCRIPT_ERR_PUBKEYTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_CLEANSTACK"] = 29] = "SCRIPT_ERR_CLEANSTACK";
    ScriptError[ScriptError["SCRIPT_ERR_MINIMALIF"] = 30] = "SCRIPT_ERR_MINIMALIF";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_NULLFAIL"] = 31] = "SCRIPT_ERR_SIG_NULLFAIL";
    /* softfork safeness */
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS"] = 32] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM"] = 33] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION"] = 34] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_OP_SUCCESS"] = 35] = "SCRIPT_ERR_DISCOURAGE_OP_SUCCESS";
    ScriptError[ScriptError["SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE"] = 36] = "SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE";
    /* segregated witness */
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH"] = 37] = "SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY"] = 38] = "SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH"] = 39] = "SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_MALLEATED"] = 40] = "SCRIPT_ERR_WITNESS_MALLEATED";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_MALLEATED_P2SH"] = 41] = "SCRIPT_ERR_WITNESS_MALLEATED_P2SH";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_UNEXPECTED"] = 42] = "SCRIPT_ERR_WITNESS_UNEXPECTED";
    ScriptError[ScriptError["SCRIPT_ERR_WITNESS_PUBKEYTYPE"] = 43] = "SCRIPT_ERR_WITNESS_PUBKEYTYPE";
    /* Taproot */
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG_SIZE"] = 44] = "SCRIPT_ERR_SCHNORR_SIG_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG_HASHTYPE"] = 45] = "SCRIPT_ERR_SCHNORR_SIG_HASHTYPE";
    ScriptError[ScriptError["SCRIPT_ERR_SCHNORR_SIG"] = 46] = "SCRIPT_ERR_SCHNORR_SIG";
    ScriptError[ScriptError["SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE"] = 47] = "SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT"] = 48] = "SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG"] = 49] = "SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG";
    ScriptError[ScriptError["SCRIPT_ERR_TAPSCRIPT_MINIMALIF"] = 50] = "SCRIPT_ERR_TAPSCRIPT_MINIMALIF";
    /* Constant scriptCode */
    ScriptError[ScriptError["SCRIPT_ERR_OP_CODESEPARATOR"] = 51] = "SCRIPT_ERR_OP_CODESEPARATOR";
    ScriptError[ScriptError["SCRIPT_ERR_SIG_FINDANDDELETE"] = 52] = "SCRIPT_ERR_SIG_FINDANDDELETE";
    ScriptError[ScriptError["SCRIPT_ERR_ERROR_COUNT"] = 53] = "SCRIPT_ERR_ERROR_COUNT";
    ScriptError[ScriptError["SCRIPT_ERR_LAST"] = 53] = "SCRIPT_ERR_LAST";
    // bitcoin core returns unknown error for this one so added it myself
    ScriptError[ScriptError["SCRIPT_ERR_NUM_OVERFLOW"] = 54] = "SCRIPT_ERR_NUM_OVERFLOW";
    //
})(ScriptError || (ScriptError = {}));
function scriptErrorString(serror) {
    switch (serror) {
        case ScriptError.SCRIPT_ERR_OK:
            return 'No error';
        case ScriptError.SCRIPT_ERR_EVAL_FALSE:
            return 'Script evaluated without error but finished with a false/empty top stack element';
        case ScriptError.SCRIPT_ERR_VERIFY:
            return 'Script failed an OP_VERIFY operation';
        case ScriptError.SCRIPT_ERR_EQUALVERIFY:
            return 'Script failed an OP_EQUALVERIFY operation';
        case ScriptError.SCRIPT_ERR_CHECKMULTISIGVERIFY:
            return 'Script failed an OP_CHECKMULTISIGVERIFY operation';
        case ScriptError.SCRIPT_ERR_CHECKSIGVERIFY:
            return 'Script failed an OP_CHECKSIGVERIFY operation';
        case ScriptError.SCRIPT_ERR_NUMEQUALVERIFY:
            return 'Script failed an OP_NUMEQUALVERIFY operation';
        case ScriptError.SCRIPT_ERR_SCRIPT_SIZE:
            return 'Script is too big';
        case ScriptError.SCRIPT_ERR_PUSH_SIZE:
            return 'Push value size limit exceeded';
        case ScriptError.SCRIPT_ERR_OP_COUNT:
            return 'Operation limit exceeded';
        case ScriptError.SCRIPT_ERR_STACK_SIZE:
            return 'Stack size limit exceeded';
        case ScriptError.SCRIPT_ERR_SIG_COUNT:
            return 'Signature count negative or greater than pubkey count';
        case ScriptError.SCRIPT_ERR_PUBKEY_COUNT:
            return 'Pubkey count negative or limit exceeded';
        case ScriptError.SCRIPT_ERR_BAD_OPCODE:
            return 'Opcode missing or not understood';
        case ScriptError.SCRIPT_ERR_DISABLED_OPCODE:
            return 'Attempted to use a disabled opcode';
        case ScriptError.SCRIPT_ERR_INVALID_STACK_OPERATION:
            return 'Operation not valid with the current stack size';
        case ScriptError.SCRIPT_ERR_INVALID_ALTSTACK_OPERATION:
            return 'Operation not valid with the current altstack size';
        case ScriptError.SCRIPT_ERR_OP_RETURN:
            return 'OP_RETURN was encountered';
        case ScriptError.SCRIPT_ERR_UNBALANCED_CONDITIONAL:
            return 'Invalid OP_IF construction';
        case ScriptError.SCRIPT_ERR_NEGATIVE_LOCKTIME:
            return 'Negative locktime';
        case ScriptError.SCRIPT_ERR_UNSATISFIED_LOCKTIME:
            return 'Locktime requirement not satisfied';
        case ScriptError.SCRIPT_ERR_SIG_HASHTYPE:
            return 'Signature hash type missing or not understood';
        case ScriptError.SCRIPT_ERR_SIG_DER:
            return 'Non-canonical DER signature';
        case ScriptError.SCRIPT_ERR_MINIMALDATA:
            return 'Data push larger than necessary';
        case ScriptError.SCRIPT_ERR_SIG_PUSHONLY:
            return 'Only push operators allowed in signatures';
        case ScriptError.SCRIPT_ERR_SIG_HIGH_S:
            return 'Non-canonical signature: S value is unnecessarily high';
        case ScriptError.SCRIPT_ERR_SIG_NULLDUMMY:
            return 'Dummy CHECKMULTISIG argument must be zero';
        case ScriptError.SCRIPT_ERR_MINIMALIF:
            return 'OP_IF/NOTIF argument must be minimal';
        case ScriptError.SCRIPT_ERR_SIG_NULLFAIL:
            return 'Signature must be zero for failed CHECK(MULTI)SIG operation';
        case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_NOPS:
            return 'NOPx reserved for soft-fork upgrades';
        case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_WITNESS_PROGRAM:
            return 'Witness version reserved for soft-fork upgrades';
        case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_TAPROOT_VERSION:
            return 'Taproot version reserved for soft-fork upgrades';
        case ScriptError.SCRIPT_ERR_DISCOURAGE_OP_SUCCESS:
            return 'OP_SUCCESSx reserved for soft-fork upgrades';
        case ScriptError.SCRIPT_ERR_DISCOURAGE_UPGRADABLE_PUBKEYTYPE:
            return 'Public key version reserved for soft-fork upgrades';
        case ScriptError.SCRIPT_ERR_PUBKEYTYPE:
            return 'Public key is neither compressed or uncompressed';
        case ScriptError.SCRIPT_ERR_CLEANSTACK:
            return 'Stack size must be exactly one after execution';
        case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_WRONG_LENGTH:
            return 'Witness program has incorrect length';
        case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_WITNESS_EMPTY:
            return 'Witness program was passed an empty witness';
        case ScriptError.SCRIPT_ERR_WITNESS_PROGRAM_MISMATCH:
            return 'Witness program hash mismatch';
        case ScriptError.SCRIPT_ERR_WITNESS_MALLEATED:
            return 'Witness requires empty scriptSig';
        case ScriptError.SCRIPT_ERR_WITNESS_MALLEATED_P2SH:
            return 'Witness requires only-redeemscript scriptSig';
        case ScriptError.SCRIPT_ERR_WITNESS_UNEXPECTED:
            return 'Witness provided for non-witness script';
        case ScriptError.SCRIPT_ERR_WITNESS_PUBKEYTYPE:
            return 'Using non-compressed keys in segwit';
        case ScriptError.SCRIPT_ERR_SCHNORR_SIG_SIZE:
            return 'Invalid Schnorr signature size';
        case ScriptError.SCRIPT_ERR_SCHNORR_SIG_HASHTYPE:
            return 'Invalid Schnorr signature hash type';
        case ScriptError.SCRIPT_ERR_SCHNORR_SIG:
            return 'Invalid Schnorr signature';
        case ScriptError.SCRIPT_ERR_TAPROOT_WRONG_CONTROL_SIZE:
            return 'Invalid Taproot control block size';
        case ScriptError.SCRIPT_ERR_TAPSCRIPT_VALIDATION_WEIGHT:
            return 'Too much signature validation relative to witness weight';
        case ScriptError.SCRIPT_ERR_TAPSCRIPT_CHECKMULTISIG:
            return 'OP_CHECKMULTISIG(VERIFY) is not available in tapscript';
        case ScriptError.SCRIPT_ERR_TAPSCRIPT_MINIMALIF:
            return 'OP_IF/NOTIF argument must be minimal in tapscript';
        case ScriptError.SCRIPT_ERR_OP_CODESEPARATOR:
            return 'Using OP_CODESEPARATOR in non-witness script';
        case ScriptError.SCRIPT_ERR_SIG_FINDANDDELETE:
            return 'Signature is found in scriptCode';
        // bitcoin core returns unknown error for this one so added it myself
        case ScriptError.SCRIPT_ERR_NUM_OVERFLOW:
            return 'Script number overflow';
        //
        case ScriptError.SCRIPT_ERR_UNKNOWN_ERROR:
        case ScriptError.SCRIPT_ERR_ERROR_COUNT:
        default:
            break;
    }
    return 'unknown error';
}
var ScriptConv;
(function (ScriptConv) {
    var Int;
    (function (Int) {
        function encode(n) {
            var buf = [];
            var neg = n < 0;
            var abs = Math.abs(n);
            while (abs) {
                buf.push(abs & 0xff);
                abs >>= 8;
            }
            if (buf[buf.length - 1] & 0x80) {
                buf.push(neg ? 0x80 : 0x00);
            }
            else if (neg) {
                buf[buf.length - 1] |= 0x80;
            }
            return new Uint8Array(buf);
        }
        Int.encode = encode;
        function encodeHex(n) {
            return Util.bufferToHex(encode(n));
        }
        Int.encodeHex = encodeHex;
        function decode(buf) {
            if (!buf.length) {
                return 0;
            }
            var neg = buf[buf.length - 1] & 0x80;
            if (neg) {
                // clone before editing
                buf = buf.slice();
                buf[buf.length - 1] &= 0x7f;
            }
            var n = 0;
            for (var i = 0; i != buf.length; ++i) {
                n |= buf[i] << (i * 8);
            }
            return neg ? -n : n;
        }
        Int.decode = decode;
    })(Int = ScriptConv.Int || (ScriptConv.Int = {}));
    var Bool;
    (function (Bool) {
        Bool.FALSE = new Uint8Array();
        Bool.TRUE = new Uint8Array([1]);
        function encode(b) {
            return b ? Bool.TRUE : Bool.FALSE;
        }
        Bool.encode = encode;
        function decode(buf) {
            for (var i = 0; i < buf.length; i++) {
                if (buf[i] !== 0) {
                    return i !== buf.length - 1 || buf[i] !== 0x80;
                }
            }
            return false;
        }
        Bool.decode = decode;
        function not(buf) {
            return encode(!decode(buf));
        }
        Bool.not = not;
    })(Bool = ScriptConv.Bool || (ScriptConv.Bool = {}));
})(ScriptConv || (ScriptConv = {}));
var ScriptVersion;
(function (ScriptVersion) {
    ScriptVersion[ScriptVersion["LEGACY"] = 0] = "LEGACY";
    ScriptVersion[ScriptVersion["SEGWITV0"] = 1] = "SEGWITV0";
    ScriptVersion[ScriptVersion["SEGWITV1"] = 2] = "SEGWITV1";
})(ScriptVersion || (ScriptVersion = {}));
var ScriptRules;
(function (ScriptRules) {
    ScriptRules[ScriptRules["ALL"] = 0] = "ALL";
    ScriptRules[ScriptRules["CONSENSUS_ONLY"] = 1] = "CONSENSUS_ONLY";
})(ScriptRules || (ScriptRules = {}));
var OpcodeType;
(function (OpcodeType) {
    OpcodeType[OpcodeType["DATA"] = 0] = "DATA";
    OpcodeType[OpcodeType["NUMBER"] = 1] = "NUMBER";
    OpcodeType[OpcodeType["CONSTANT"] = 2] = "CONSTANT";
    OpcodeType[OpcodeType["FLOW"] = 3] = "FLOW";
    OpcodeType[OpcodeType["STACK"] = 4] = "STACK";
    OpcodeType[OpcodeType["SPLICE"] = 5] = "SPLICE";
    OpcodeType[OpcodeType["BITWISE"] = 6] = "BITWISE";
    OpcodeType[OpcodeType["ARITHMETIC"] = 7] = "ARITHMETIC";
    OpcodeType[OpcodeType["CRYPTO"] = 8] = "CRYPTO";
    OpcodeType[OpcodeType["LOCKTIME"] = 9] = "LOCKTIME";
    OpcodeType[OpcodeType["DISABLED"] = 10] = "DISABLED";
    OpcodeType[OpcodeType["INVALID"] = 11] = "INVALID";
})(OpcodeType || (OpcodeType = {}));
// unused
var ElementType;
(function (ElementType) {
    /** Only for minimal encoded booleans. Has 2 possible values: <> and <01> */
    ElementType[ElementType["bool"] = 0] = "bool";
    /** Any stack element not larger than 4 bytes */
    ElementType[ElementType["int"] = 1] = "int";
    /** Any stack element not larger than 5 bytes */
    ElementType[ElementType["uint"] = 2] = "uint";
    /** Any stack element */
    ElementType[ElementType["bytes"] = 3] = "bytes";
})(ElementType || (ElementType = {}));
function isElementType(type, test) {
    return typeof test === 'number' && test in ElementType && test <= type;
}
var Util;
(function (Util) {
    function scriptElemToHex(buf) {
        return "<".concat(bufferToHex(buf), ">");
    }
    Util.scriptElemToHex = scriptElemToHex;
    /** Browser proof function to convert a browser proof buffer (Uint8Array) to a hex string */
    function bufferToHex(buf) {
        var hex = '';
        for (var i = 0; i < buf.length; i++) {
            hex += buf[i].toString(16).padStart(2, '0');
        }
        return hex;
    }
    Util.bufferToHex = bufferToHex;
    /** Browser proof function to convert a hex string to a browser proof buffer (Uint8Array) */
    function hexToBuffer(hex) {
        var _a, _b;
        return new Uint8Array((_b = (_a = hex.match(/../g)) === null || _a === void 0 ? void 0 : _a.map(function (x) { return parseInt(x, 16); })) !== null && _b !== void 0 ? _b : []);
    }
    Util.hexToBuffer = hexToBuffer;
    function bufferCompare(buf1, buf2) {
        for (var i = 0; i < buf1.length && i < buf2.length; i++) {
            if (buf1[i] < buf2[i]) {
                return -1;
            }
            else if (buf1[i] > buf2[i]) {
                return 1;
            }
        }
        if (buf1.length < buf2.length) {
            return -1;
        }
        else if (buf1.length > buf2.length) {
            return 1;
        }
        return 0;
    }
    Util.bufferCompare = bufferCompare;
    function intEncodeLEHex(n, len) {
        return n
            .toString(16)
            .padStart(len * 2, '0')
            .match(/../g)
            .reverse()
            .join('');
    }
    Util.intEncodeLEHex = intEncodeLEHex;
    function intDecodeLE(buf) {
        return parseInt(bufferToHex(buf.slice().reverse()), 16);
    }
    Util.intDecodeLE = intDecodeLE;
    function exprToString(e) {
        if ('opcode' in e) {
            var args = e.args.map(exprToString);
            if (e.opcode === opcodes.INTERNAL_NOT && args.length === 1) {
                return "!(".concat(args, ")");
            }
            else if (e.opcode === opcodes.OP_EQUAL && args.length === 2) {
                return "(".concat(args[0], " == ").concat(args[1], ")");
            }
            return "".concat((opcodeName(e.opcode) || 'UNKNOWN').replace(/^OP_/, ''), "(").concat(args, ")");
        }
        else if ('var' in e) {
            return "<input".concat(e["var"], ">");
        }
        else {
            return scriptElemToHex(e);
        }
    }
    Util.exprToString = exprToString;
    /** Returns true if at least 1 element of the first list is present in the second list */
    function overlap(list1, list2) {
        for (var _i = 0, list1_1 = list1; _i < list1_1.length; _i++) {
            var e = list1_1[_i];
            if (list2.includes(e)) {
                return true;
            }
        }
        return false;
    }
    Util.overlap = overlap;
    function exprEqual(a, b) {
        if ('opcode' in a && 'opcode' in b) {
            if (a.args.length !== b.args.length) {
                return false;
            }
            for (var i = 0; i < a.args.length; i++) {
                if (!exprEqual(a.args[i], b.args[i])) {
                    return false;
                }
            }
            return a.opcode === b.opcode;
        }
        else if ('var' in a && 'var' in b) {
            return a["var"] === b["var"];
        }
        else if (a instanceof Uint8Array && b instanceof Uint8Array) {
            return !bufferCompare(a, b);
        }
        return false;
    }
    Util.exprEqual = exprEqual;
    var exprPriority = {
        "var": 2,
        opcode: 1,
        value: 0
    };
    function exprType(expr) {
        if ('opcode' in expr) {
            return 'opcode';
        }
        else if ('var' in expr) {
            return 'var';
        }
        else {
            return 'value';
        }
    }
    function exprCompareFn(a, b) {
        if ('opcode' in a && 'opcode' in b) {
            // smallest opcode first
            var s = a.opcode - b.opcode;
            if (s) {
                return s;
            }
            // only for OP_CHECKMULTISIG (?)
            var ldiff = a.args.length - b.args.length;
            if (ldiff) {
                return ldiff;
            }
            for (var i = 0; i < a.args.length; i++) {
                var s_1 = exprCompareFn(a.args[i], b.args[i]);
                if (s_1) {
                    return s_1;
                }
            }
        }
        else if ('var' in a && 'var' in b) {
            // highest stack element first
            return a["var"] - b["var"];
        }
        else if (a instanceof Uint8Array && b instanceof Uint8Array) {
            return bufferCompare(a, b);
        }
        return exprPriority[exprType(b)] - exprPriority[exprType(a)];
    }
    function normalizeExprs(exprs) {
        exprs.sort(exprCompareFn);
        for (var _i = 0, exprs_1 = exprs; _i < exprs_1.length; _i++) {
            var expr = exprs_1[_i];
            if ('opcode' in expr &&
                ![
                    opcodes.OP_CHECKMULTISIG,
                    opcodes.OP_CHECKSIG,
                    opcodes.OP_GREATERTHAN,
                    opcodes.OP_GREATERTHANOREQUAL,
                    opcodes.OP_LESSTHAN,
                    opcodes.OP_LESSTHANOREQUAL,
                    opcodes.OP_SUB,
                    opcodes.OP_WITHIN
                ].includes(expr.opcode)) {
                normalizeExprs(expr.args);
            }
        }
    }
    Util.normalizeExprs = normalizeExprs;
})(Util || (Util = {}));