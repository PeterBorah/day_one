

/* @preserve
 * The MIT License (MIT)
 * 
 * Copyright (c) 2014 Petka Antonov
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 */
/**
 * bluebird build version 2.9.34
 * Features enabled: core, race, call_get, generators, map, nodeify, promisify, props, reduce, settle, some, cancel, using, filter, any, each, timers
*/
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Promise=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof _dereq_=="function"&&_dereq_;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof _dereq_=="function"&&_dereq_;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var SomePromiseArray = Promise._SomePromiseArray;
function any(promises) {
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(1);
    ret.setUnwrap();
    ret.init();
    return promise;
}

Promise.any = function (promises) {
    return any(promises);
};

Promise.prototype.any = function () {
    return any(this);
};

};

},{}],2:[function(_dereq_,module,exports){
"use strict";
var firstLineError;
try {throw new Error(); } catch (e) {firstLineError = e;}
var schedule = _dereq_("./schedule.js");
var Queue = _dereq_("./queue.js");
var util = _dereq_("./util.js");

function Async() {
    this._isTickUsed = false;
    this._lateQueue = new Queue(16);
    this._normalQueue = new Queue(16);
    this._trampolineEnabled = true;
    var self = this;
    this.drainQueues = function () {
        self._drainQueues();
    };
    this._schedule =
        schedule.isStatic ? schedule(this.drainQueues) : schedule;
}

Async.prototype.disableTrampolineIfNecessary = function() {
    if (util.hasDevTools) {
        this._trampolineEnabled = false;
    }
};

Async.prototype.enableTrampoline = function() {
    if (!this._trampolineEnabled) {
        this._trampolineEnabled = true;
        this._schedule = function(fn) {
            setTimeout(fn, 0);
        };
    }
};

Async.prototype.haveItemsQueued = function () {
    return this._normalQueue.length() > 0;
};

Async.prototype.throwLater = function(fn, arg) {
    if (arguments.length === 1) {
        arg = fn;
        fn = function () { throw arg; };
    }
    if (typeof setTimeout !== "undefined") {
        setTimeout(function() {
            fn(arg);
        }, 0);
    } else try {
        this._schedule(function() {
            fn(arg);
        });
    } catch (e) {
        throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/m3OTXk\u000a");
    }
};

function AsyncInvokeLater(fn, receiver, arg) {
    this._lateQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncInvoke(fn, receiver, arg) {
    this._normalQueue.push(fn, receiver, arg);
    this._queueTick();
}

function AsyncSettlePromises(promise) {
    this._normalQueue._pushOne(promise);
    this._queueTick();
}

if (!util.hasDevTools) {
    Async.prototype.invokeLater = AsyncInvokeLater;
    Async.prototype.invoke = AsyncInvoke;
    Async.prototype.settlePromises = AsyncSettlePromises;
} else {
    if (schedule.isStatic) {
        schedule = function(fn) { setTimeout(fn, 0); };
    }
    Async.prototype.invokeLater = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvokeLater.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                setTimeout(function() {
                    fn.call(receiver, arg);
                }, 100);
            });
        }
    };

    Async.prototype.invoke = function (fn, receiver, arg) {
        if (this._trampolineEnabled) {
            AsyncInvoke.call(this, fn, receiver, arg);
        } else {
            this._schedule(function() {
                fn.call(receiver, arg);
            });
        }
    };

    Async.prototype.settlePromises = function(promise) {
        if (this._trampolineEnabled) {
            AsyncSettlePromises.call(this, promise);
        } else {
            this._schedule(function() {
                promise._settlePromises();
            });
        }
    };
}

Async.prototype.invokeFirst = function (fn, receiver, arg) {
    this._normalQueue.unshift(fn, receiver, arg);
    this._queueTick();
};

Async.prototype._drainQueue = function(queue) {
    while (queue.length() > 0) {
        var fn = queue.shift();
        if (typeof fn !== "function") {
            fn._settlePromises();
            continue;
        }
        var receiver = queue.shift();
        var arg = queue.shift();
        fn.call(receiver, arg);
    }
};

Async.prototype._drainQueues = function () {
    this._drainQueue(this._normalQueue);
    this._reset();
    this._drainQueue(this._lateQueue);
};

Async.prototype._queueTick = function () {
    if (!this._isTickUsed) {
        this._isTickUsed = true;
        this._schedule(this.drainQueues);
    }
};

Async.prototype._reset = function () {
    this._isTickUsed = false;
};

module.exports = new Async();
module.exports.firstLineError = firstLineError;

},{"./queue.js":28,"./schedule.js":31,"./util.js":38}],3:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise) {
var rejectThis = function(_, e) {
    this._reject(e);
};

var targetRejected = function(e, context) {
    context.promiseRejectionQueued = true;
    context.bindingPromise._then(rejectThis, rejectThis, null, this, e);
};

var bindingResolved = function(thisArg, context) {
    if (this._isPending()) {
        this._resolveCallback(context.target);
    }
};

var bindingRejected = function(e, context) {
    if (!context.promiseRejectionQueued) this._reject(e);
};

Promise.prototype.bind = function (thisArg) {
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);
    ret._propagateFrom(this, 1);
    var target = this._target();

    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        var context = {
            promiseRejectionQueued: false,
            promise: ret,
            target: target,
            bindingPromise: maybePromise
        };
        target._then(INTERNAL, targetRejected, ret._progress, ret, context);
        maybePromise._then(
            bindingResolved, bindingRejected, ret._progress, ret, context);
    } else {
        ret._resolveCallback(target);
    }
    return ret;
};

Promise.prototype._setBoundTo = function (obj) {
    if (obj !== undefined) {
        this._bitField = this._bitField | 131072;
        this._boundTo = obj;
    } else {
        this._bitField = this._bitField & (~131072);
    }
};

Promise.prototype._isBound = function () {
    return (this._bitField & 131072) === 131072;
};

Promise.bind = function (thisArg, value) {
    var maybePromise = tryConvertToPromise(thisArg);
    var ret = new Promise(INTERNAL);

    ret._setBoundTo(maybePromise);
    if (maybePromise instanceof Promise) {
        maybePromise._then(function() {
            ret._resolveCallback(value);
        }, ret._reject, ret._progress, ret, null);
    } else {
        ret._resolveCallback(value);
    }
    return ret;
};
};

},{}],4:[function(_dereq_,module,exports){
"use strict";
var old;
if (typeof Promise !== "undefined") old = Promise;
function noConflict() {
    try { if (Promise === bluebird) Promise = old; }
    catch (e) {}
    return bluebird;
}
var bluebird = _dereq_("./promise.js")();
bluebird.noConflict = noConflict;
module.exports = bluebird;

},{"./promise.js":23}],5:[function(_dereq_,module,exports){
"use strict";
var cr = Object.create;
if (cr) {
    var callerCache = cr(null);
    var getterCache = cr(null);
    callerCache[" size"] = getterCache[" size"] = 0;
}

module.exports = function(Promise) {
var util = _dereq_("./util.js");
var canEvaluate = util.canEvaluate;
var isIdentifier = util.isIdentifier;

var getMethodCaller;
var getGetter;
if (!true) {
var makeMethodCaller = function (methodName) {
    return new Function("ensureMethod", "                                    \n\
        return function(obj) {                                               \n\
            'use strict'                                                     \n\
            var len = this.length;                                           \n\
            ensureMethod(obj, 'methodName');                                 \n\
            switch(len) {                                                    \n\
                case 1: return obj.methodName(this[0]);                      \n\
                case 2: return obj.methodName(this[0], this[1]);             \n\
                case 3: return obj.methodName(this[0], this[1], this[2]);    \n\
                case 0: return obj.methodName();                             \n\
                default:                                                     \n\
                    return obj.methodName.apply(obj, this);                  \n\
            }                                                                \n\
        };                                                                   \n\
        ".replace(/methodName/g, methodName))(ensureMethod);
};

var makeGetter = function (propertyName) {
    return new Function("obj", "                                             \n\
        'use strict';                                                        \n\
        return obj.propertyName;                                             \n\
        ".replace("propertyName", propertyName));
};

var getCompiled = function(name, compiler, cache) {
    var ret = cache[name];
    if (typeof ret !== "function") {
        if (!isIdentifier(name)) {
            return null;
        }
        ret = compiler(name);
        cache[name] = ret;
        cache[" size"]++;
        if (cache[" size"] > 512) {
            var keys = Object.keys(cache);
            for (var i = 0; i < 256; ++i) delete cache[keys[i]];
            cache[" size"] = keys.length - 256;
        }
    }
    return ret;
};

getMethodCaller = function(name) {
    return getCompiled(name, makeMethodCaller, callerCache);
};

getGetter = function(name) {
    return getCompiled(name, makeGetter, getterCache);
};
}

function ensureMethod(obj, methodName) {
    var fn;
    if (obj != null) fn = obj[methodName];
    if (typeof fn !== "function") {
        var message = "Object " + util.classString(obj) + " has no method '" +
            util.toString(methodName) + "'";
        throw new Promise.TypeError(message);
    }
    return fn;
}

function caller(obj) {
    var methodName = this.pop();
    var fn = ensureMethod(obj, methodName);
    return fn.apply(obj, this);
}
Promise.prototype.call = function (methodName) {
    var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
    if (!true) {
        if (canEvaluate) {
            var maybeCaller = getMethodCaller(methodName);
            if (maybeCaller !== null) {
                return this._then(
                    maybeCaller, undefined, undefined, args, undefined);
            }
        }
    }
    args.push(methodName);
    return this._then(caller, undefined, undefined, args, undefined);
};

function namedGetter(obj) {
    return obj[this];
}
function indexedGetter(obj) {
    var index = +this;
    if (index < 0) index = Math.max(0, index + obj.length);
    return obj[index];
}
Promise.prototype.get = function (propertyName) {
    var isIndex = (typeof propertyName === "number");
    var getter;
    if (!isIndex) {
        if (canEvaluate) {
            var maybeGetter = getGetter(propertyName);
            getter = maybeGetter !== null ? maybeGetter : namedGetter;
        } else {
            getter = namedGetter;
        }
    } else {
        getter = indexedGetter;
    }
    return this._then(getter, undefined, undefined, propertyName, undefined);
};
};

},{"./util.js":38}],6:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var errors = _dereq_("./errors.js");
var async = _dereq_("./async.js");
var CancellationError = errors.CancellationError;

Promise.prototype._cancel = function (reason) {
    if (!this.isCancellable()) return this;
    var parent;
    var promiseToReject = this;
    while ((parent = promiseToReject._cancellationParent) !== undefined &&
        parent.isCancellable()) {
        promiseToReject = parent;
    }
    this._unsetCancellable();
    promiseToReject._target()._rejectCallback(reason, false, true);
};

Promise.prototype.cancel = function (reason) {
    if (!this.isCancellable()) return this;
    if (reason === undefined) reason = new CancellationError();
    async.invokeLater(this._cancel, this, reason);
    return this;
};

Promise.prototype.cancellable = function () {
    if (this._cancellable()) return this;
    async.enableTrampoline();
    this._setCancellable();
    this._cancellationParent = undefined;
    return this;
};

Promise.prototype.uncancellable = function () {
    var ret = this.then();
    ret._unsetCancellable();
    return ret;
};

Promise.prototype.fork = function (didFulfill, didReject, didProgress) {
    var ret = this._then(didFulfill, didReject, didProgress,
                         undefined, undefined);

    ret._setCancellable();
    ret._cancellationParent = undefined;
    return ret;
};
};

},{"./async.js":2,"./errors.js":13}],7:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var bluebirdFramePattern =
    /[\\\/]bluebird[\\\/]js[\\\/](main|debug|zalgo|instrumented)/;
var stackFramePattern = null;
var formatStack = null;
var indentStackFrames = false;
var warn;

function CapturedTrace(parent) {
    this._parent = parent;
    var length = this._length = 1 + (parent === undefined ? 0 : parent._length);
    captureStackTrace(this, CapturedTrace);
    if (length > 32) this.uncycle();
}
util.inherits(CapturedTrace, Error);

CapturedTrace.prototype.uncycle = function() {
    var length = this._length;
    if (length < 2) return;
    var nodes = [];
    var stackToIndex = {};

    for (var i = 0, node = this; node !== undefined; ++i) {
        nodes.push(node);
        node = node._parent;
    }
    length = this._length = i;
    for (var i = length - 1; i >= 0; --i) {
        var stack = nodes[i].stack;
        if (stackToIndex[stack] === undefined) {
            stackToIndex[stack] = i;
        }
    }
    for (var i = 0; i < length; ++i) {
        var currentStack = nodes[i].stack;
        var index = stackToIndex[currentStack];
        if (index !== undefined && index !== i) {
            if (index > 0) {
                nodes[index - 1]._parent = undefined;
                nodes[index - 1]._length = 1;
            }
            nodes[i]._parent = undefined;
            nodes[i]._length = 1;
            var cycleEdgeNode = i > 0 ? nodes[i - 1] : this;

            if (index < length - 1) {
                cycleEdgeNode._parent = nodes[index + 1];
                cycleEdgeNode._parent.uncycle();
                cycleEdgeNode._length =
                    cycleEdgeNode._parent._length + 1;
            } else {
                cycleEdgeNode._parent = undefined;
                cycleEdgeNode._length = 1;
            }
            var currentChildLength = cycleEdgeNode._length + 1;
            for (var j = i - 2; j >= 0; --j) {
                nodes[j]._length = currentChildLength;
                currentChildLength++;
            }
            return;
        }
    }
};

CapturedTrace.prototype.parent = function() {
    return this._parent;
};

CapturedTrace.prototype.hasParent = function() {
    return this._parent !== undefined;
};

CapturedTrace.prototype.attachExtraTrace = function(error) {
    if (error.__stackCleaned__) return;
    this.uncycle();
    var parsed = CapturedTrace.parseStackAndMessage(error);
    var message = parsed.message;
    var stacks = [parsed.stack];

    var trace = this;
    while (trace !== undefined) {
        stacks.push(cleanStack(trace.stack.split("\n")));
        trace = trace._parent;
    }
    removeCommonRoots(stacks);
    removeDuplicateOrEmptyJumps(stacks);
    util.notEnumerableProp(error, "stack", reconstructStack(message, stacks));
    util.notEnumerableProp(error, "__stackCleaned__", true);
};

function reconstructStack(message, stacks) {
    for (var i = 0; i < stacks.length - 1; ++i) {
        stacks[i].push("From previous event:");
        stacks[i] = stacks[i].join("\n");
    }
    if (i < stacks.length) {
        stacks[i] = stacks[i].join("\n");
    }
    return message + "\n" + stacks.join("\n");
}

function removeDuplicateOrEmptyJumps(stacks) {
    for (var i = 0; i < stacks.length; ++i) {
        if (stacks[i].length === 0 ||
            ((i + 1 < stacks.length) && stacks[i][0] === stacks[i+1][0])) {
            stacks.splice(i, 1);
            i--;
        }
    }
}

function removeCommonRoots(stacks) {
    var current = stacks[0];
    for (var i = 1; i < stacks.length; ++i) {
        var prev = stacks[i];
        var currentLastIndex = current.length - 1;
        var currentLastLine = current[currentLastIndex];
        var commonRootMeetPoint = -1;

        for (var j = prev.length - 1; j >= 0; --j) {
            if (prev[j] === currentLastLine) {
                commonRootMeetPoint = j;
                break;
            }
        }

        for (var j = commonRootMeetPoint; j >= 0; --j) {
            var line = prev[j];
            if (current[currentLastIndex] === line) {
                current.pop();
                currentLastIndex--;
            } else {
                break;
            }
        }
        current = prev;
    }
}

function cleanStack(stack) {
    var ret = [];
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        var isTraceLine = stackFramePattern.test(line) ||
            "    (No stack trace)" === line;
        var isInternalFrame = isTraceLine && shouldIgnore(line);
        if (isTraceLine && !isInternalFrame) {
            if (indentStackFrames && line.charAt(0) !== " ") {
                line = "    " + line;
            }
            ret.push(line);
        }
    }
    return ret;
}

function stackFramesAsArray(error) {
    var stack = error.stack.replace(/\s+$/g, "").split("\n");
    for (var i = 0; i < stack.length; ++i) {
        var line = stack[i];
        if ("    (No stack trace)" === line || stackFramePattern.test(line)) {
            break;
        }
    }
    if (i > 0) {
        stack = stack.slice(i);
    }
    return stack;
}

CapturedTrace.parseStackAndMessage = function(error) {
    var stack = error.stack;
    var message = error.toString();
    stack = typeof stack === "string" && stack.length > 0
                ? stackFramesAsArray(error) : ["    (No stack trace)"];
    return {
        message: message,
        stack: cleanStack(stack)
    };
};

CapturedTrace.formatAndLogError = function(error, title) {
    if (typeof console !== "undefined") {
        var message;
        if (typeof error === "object" || typeof error === "function") {
            var stack = error.stack;
            message = title + formatStack(stack, error);
        } else {
            message = title + String(error);
        }
        if (typeof warn === "function") {
            warn(message);
        } else if (typeof console.log === "function" ||
            typeof console.log === "object") {
            console.log(message);
        }
    }
};

CapturedTrace.unhandledRejection = function (reason) {
    CapturedTrace.formatAndLogError(reason, "^--- With additional stack trace: ");
};

CapturedTrace.isSupported = function () {
    return typeof captureStackTrace === "function";
};

CapturedTrace.fireRejectionEvent =
function(name, localHandler, reason, promise) {
    var localEventFired = false;
    try {
        if (typeof localHandler === "function") {
            localEventFired = true;
            if (name === "rejectionHandled") {
                localHandler(promise);
            } else {
                localHandler(reason, promise);
            }
        }
    } catch (e) {
        async.throwLater(e);
    }

    var globalEventFired = false;
    try {
        globalEventFired = fireGlobalEvent(name, reason, promise);
    } catch (e) {
        globalEventFired = true;
        async.throwLater(e);
    }

    var domEventFired = false;
    if (fireDomEvent) {
        try {
            domEventFired = fireDomEvent(name.toLowerCase(), {
                reason: reason,
                promise: promise
            });
        } catch (e) {
            domEventFired = true;
            async.throwLater(e);
        }
    }

    if (!globalEventFired && !localEventFired && !domEventFired &&
        name === "unhandledRejection") {
        CapturedTrace.formatAndLogError(reason, "Unhandled rejection ");
    }
};

function formatNonError(obj) {
    var str;
    if (typeof obj === "function") {
        str = "[function " +
            (obj.name || "anonymous") +
            "]";
    } else {
        str = obj.toString();
        var ruselessToString = /\[object [a-zA-Z0-9$_]+\]/;
        if (ruselessToString.test(str)) {
            try {
                var newStr = JSON.stringify(obj);
                str = newStr;
            }
            catch(e) {

            }
        }
        if (str.length === 0) {
            str = "(empty array)";
        }
    }
    return ("(<" + snip(str) + ">, no stack trace)");
}

function snip(str) {
    var maxChars = 41;
    if (str.length < maxChars) {
        return str;
    }
    return str.substr(0, maxChars - 3) + "...";
}

var shouldIgnore = function() { return false; };
var parseLineInfoRegex = /[\/<\(]([^:\/]+):(\d+):(?:\d+)\)?\s*$/;
function parseLineInfo(line) {
    var matches = line.match(parseLineInfoRegex);
    if (matches) {
        return {
            fileName: matches[1],
            line: parseInt(matches[2], 10)
        };
    }
}
CapturedTrace.setBounds = function(firstLineError, lastLineError) {
    if (!CapturedTrace.isSupported()) return;
    var firstStackLines = firstLineError.stack.split("\n");
    var lastStackLines = lastLineError.stack.split("\n");
    var firstIndex = -1;
    var lastIndex = -1;
    var firstFileName;
    var lastFileName;
    for (var i = 0; i < firstStackLines.length; ++i) {
        var result = parseLineInfo(firstStackLines[i]);
        if (result) {
            firstFileName = result.fileName;
            firstIndex = result.line;
            break;
        }
    }
    for (var i = 0; i < lastStackLines.length; ++i) {
        var result = parseLineInfo(lastStackLines[i]);
        if (result) {
            lastFileName = result.fileName;
            lastIndex = result.line;
            break;
        }
    }
    if (firstIndex < 0 || lastIndex < 0 || !firstFileName || !lastFileName ||
        firstFileName !== lastFileName || firstIndex >= lastIndex) {
        return;
    }

    shouldIgnore = function(line) {
        if (bluebirdFramePattern.test(line)) return true;
        var info = parseLineInfo(line);
        if (info) {
            if (info.fileName === firstFileName &&
                (firstIndex <= info.line && info.line <= lastIndex)) {
                return true;
            }
        }
        return false;
    };
};

var captureStackTrace = (function stackDetection() {
    var v8stackFramePattern = /^\s*at\s*/;
    var v8stackFormatter = function(stack, error) {
        if (typeof stack === "string") return stack;

        if (error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    if (typeof Error.stackTraceLimit === "number" &&
        typeof Error.captureStackTrace === "function") {
        Error.stackTraceLimit = Error.stackTraceLimit + 6;
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        var captureStackTrace = Error.captureStackTrace;

        shouldIgnore = function(line) {
            return bluebirdFramePattern.test(line);
        };
        return function(receiver, ignoreUntil) {
            Error.stackTraceLimit = Error.stackTraceLimit + 6;
            captureStackTrace(receiver, ignoreUntil);
            Error.stackTraceLimit = Error.stackTraceLimit - 6;
        };
    }
    var err = new Error();

    if (typeof err.stack === "string" &&
        err.stack.split("\n")[0].indexOf("stackDetection@") >= 0) {
        stackFramePattern = /@/;
        formatStack = v8stackFormatter;
        indentStackFrames = true;
        return function captureStackTrace(o) {
            o.stack = new Error().stack;
        };
    }

    var hasStackAfterThrow;
    try { throw new Error(); }
    catch(e) {
        hasStackAfterThrow = ("stack" in e);
    }
    if (!("stack" in err) && hasStackAfterThrow &&
        typeof Error.stackTraceLimit === "number") {
        stackFramePattern = v8stackFramePattern;
        formatStack = v8stackFormatter;
        return function captureStackTrace(o) {
            Error.stackTraceLimit = Error.stackTraceLimit + 6;
            try { throw new Error(); }
            catch(e) { o.stack = e.stack; }
            Error.stackTraceLimit = Error.stackTraceLimit - 6;
        };
    }

    formatStack = function(stack, error) {
        if (typeof stack === "string") return stack;

        if ((typeof error === "object" ||
            typeof error === "function") &&
            error.name !== undefined &&
            error.message !== undefined) {
            return error.toString();
        }
        return formatNonError(error);
    };

    return null;

})([]);

var fireDomEvent;
var fireGlobalEvent = (function() {
    if (util.isNode) {
        return function(name, reason, promise) {
            if (name === "rejectionHandled") {
                return process.emit(name, promise);
            } else {
                return process.emit(name, reason, promise);
            }
        };
    } else {
        var customEventWorks = false;
        var anyEventWorks = true;
        try {
            var ev = new self.CustomEvent("test");
            customEventWorks = ev instanceof CustomEvent;
        } catch (e) {}
        if (!customEventWorks) {
            try {
                var event = document.createEvent("CustomEvent");
                event.initCustomEvent("testingtheevent", false, true, {});
                self.dispatchEvent(event);
            } catch (e) {
                anyEventWorks = false;
            }
        }
        if (anyEventWorks) {
            fireDomEvent = function(type, detail) {
                var event;
                if (customEventWorks) {
                    event = new self.CustomEvent(type, {
                        detail: detail,
                        bubbles: false,
                        cancelable: true
                    });
                } else if (self.dispatchEvent) {
                    event = document.createEvent("CustomEvent");
                    event.initCustomEvent(type, false, true, detail);
                }

                return event ? !self.dispatchEvent(event) : false;
            };
        }

        var toWindowMethodNameMap = {};
        toWindowMethodNameMap["unhandledRejection"] = ("on" +
            "unhandledRejection").toLowerCase();
        toWindowMethodNameMap["rejectionHandled"] = ("on" +
            "rejectionHandled").toLowerCase();

        return function(name, reason, promise) {
            var methodName = toWindowMethodNameMap[name];
            var method = self[methodName];
            if (!method) return false;
            if (name === "rejectionHandled") {
                method.call(self, promise);
            } else {
                method.call(self, reason, promise);
            }
            return true;
        };
    }
})();

if (typeof console !== "undefined" && typeof console.warn !== "undefined") {
    warn = function (message) {
        console.warn(message);
    };
    if (util.isNode && process.stderr.isTTY) {
        warn = function(message) {
            process.stderr.write("\u001b[31m" + message + "\u001b[39m\n");
        };
    } else if (!util.isNode && typeof (new Error().stack) === "string") {
        warn = function(message) {
            console.warn("%c" + message, "color: red");
        };
    }
}

return CapturedTrace;
};

},{"./async.js":2,"./util.js":38}],8:[function(_dereq_,module,exports){
"use strict";
module.exports = function(NEXT_FILTER) {
var util = _dereq_("./util.js");
var errors = _dereq_("./errors.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var keys = _dereq_("./es5.js").keys;
var TypeError = errors.TypeError;

function CatchFilter(instances, callback, promise) {
    this._instances = instances;
    this._callback = callback;
    this._promise = promise;
}

function safePredicate(predicate, e) {
    var safeObject = {};
    var retfilter = tryCatch(predicate).call(safeObject, e);

    if (retfilter === errorObj) return retfilter;

    var safeKeys = keys(safeObject);
    if (safeKeys.length) {
        errorObj.e = new TypeError("Catch filter must inherit from Error or be a simple predicate function\u000a\u000a    See http://goo.gl/o84o68\u000a");
        return errorObj;
    }
    return retfilter;
}

CatchFilter.prototype.doFilter = function (e) {
    var cb = this._callback;
    var promise = this._promise;
    var boundTo = promise._boundValue();
    for (var i = 0, len = this._instances.length; i < len; ++i) {
        var item = this._instances[i];
        var itemIsErrorType = item === Error ||
            (item != null && item.prototype instanceof Error);

        if (itemIsErrorType && e instanceof item) {
            var ret = tryCatch(cb).call(boundTo, e);
            if (ret === errorObj) {
                NEXT_FILTER.e = ret.e;
                return NEXT_FILTER;
            }
            return ret;
        } else if (typeof item === "function" && !itemIsErrorType) {
            var shouldHandle = safePredicate(item, e);
            if (shouldHandle === errorObj) {
                e = errorObj.e;
                break;
            } else if (shouldHandle) {
                var ret = tryCatch(cb).call(boundTo, e);
                if (ret === errorObj) {
                    NEXT_FILTER.e = ret.e;
                    return NEXT_FILTER;
                }
                return ret;
            }
        }
    }
    NEXT_FILTER.e = e;
    return NEXT_FILTER;
};

return CatchFilter;
};

},{"./errors.js":13,"./es5.js":14,"./util.js":38}],9:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, CapturedTrace, isDebugging) {
var contextStack = [];
function Context() {
    this._trace = new CapturedTrace(peekContext());
}
Context.prototype._pushContext = function () {
    if (!isDebugging()) return;
    if (this._trace !== undefined) {
        contextStack.push(this._trace);
    }
};

Context.prototype._popContext = function () {
    if (!isDebugging()) return;
    if (this._trace !== undefined) {
        contextStack.pop();
    }
};

function createContext() {
    if (isDebugging()) return new Context();
}

function peekContext() {
    var lastIndex = contextStack.length - 1;
    if (lastIndex >= 0) {
        return contextStack[lastIndex];
    }
    return undefined;
}

Promise.prototype._peekContext = peekContext;
Promise.prototype._pushContext = Context.prototype._pushContext;
Promise.prototype._popContext = Context.prototype._popContext;

return createContext;
};

},{}],10:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, CapturedTrace) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var Warning = _dereq_("./errors.js").Warning;
var util = _dereq_("./util.js");
var canAttachTrace = util.canAttachTrace;
var unhandledRejectionHandled;
var possiblyUnhandledRejection;
var debugging = false || (util.isNode &&
                    (!!process.env["BLUEBIRD_DEBUG"] ||
                     process.env["NODE_ENV"] === "development"));

if (debugging) {
    async.disableTrampolineIfNecessary();
}

Promise.prototype._ignoreRejections = function() {
    this._unsetRejectionIsUnhandled();
    this._bitField = this._bitField | 16777216;
};

Promise.prototype._ensurePossibleRejectionHandled = function () {
    if ((this._bitField & 16777216) !== 0) return;
    this._setRejectionIsUnhandled();
    async.invokeLater(this._notifyUnhandledRejection, this, undefined);
};

Promise.prototype._notifyUnhandledRejectionIsHandled = function () {
    CapturedTrace.fireRejectionEvent("rejectionHandled",
                                  unhandledRejectionHandled, undefined, this);
};

Promise.prototype._notifyUnhandledRejection = function () {
    if (this._isRejectionUnhandled()) {
        var reason = this._getCarriedStackTrace() || this._settledValue;
        this._setUnhandledRejectionIsNotified();
        CapturedTrace.fireRejectionEvent("unhandledRejection",
                                      possiblyUnhandledRejection, reason, this);
    }
};

Promise.prototype._setUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField | 524288;
};

Promise.prototype._unsetUnhandledRejectionIsNotified = function () {
    this._bitField = this._bitField & (~524288);
};

Promise.prototype._isUnhandledRejectionNotified = function () {
    return (this._bitField & 524288) > 0;
};

Promise.prototype._setRejectionIsUnhandled = function () {
    this._bitField = this._bitField | 2097152;
};

Promise.prototype._unsetRejectionIsUnhandled = function () {
    this._bitField = this._bitField & (~2097152);
    if (this._isUnhandledRejectionNotified()) {
        this._unsetUnhandledRejectionIsNotified();
        this._notifyUnhandledRejectionIsHandled();
    }
};

Promise.prototype._isRejectionUnhandled = function () {
    return (this._bitField & 2097152) > 0;
};

Promise.prototype._setCarriedStackTrace = function (capturedTrace) {
    this._bitField = this._bitField | 1048576;
    this._fulfillmentHandler0 = capturedTrace;
};

Promise.prototype._isCarryingStackTrace = function () {
    return (this._bitField & 1048576) > 0;
};

Promise.prototype._getCarriedStackTrace = function () {
    return this._isCarryingStackTrace()
        ? this._fulfillmentHandler0
        : undefined;
};

Promise.prototype._captureStackTrace = function () {
    if (debugging) {
        this._trace = new CapturedTrace(this._peekContext());
    }
    return this;
};

Promise.prototype._attachExtraTrace = function (error, ignoreSelf) {
    if (debugging && canAttachTrace(error)) {
        var trace = this._trace;
        if (trace !== undefined) {
            if (ignoreSelf) trace = trace._parent;
        }
        if (trace !== undefined) {
            trace.attachExtraTrace(error);
        } else if (!error.__stackCleaned__) {
            var parsed = CapturedTrace.parseStackAndMessage(error);
            util.notEnumerableProp(error, "stack",
                parsed.message + "\n" + parsed.stack.join("\n"));
            util.notEnumerableProp(error, "__stackCleaned__", true);
        }
    }
};

Promise.prototype._warn = function(message) {
    var warning = new Warning(message);
    var ctx = this._peekContext();
    if (ctx) {
        ctx.attachExtraTrace(warning);
    } else {
        var parsed = CapturedTrace.parseStackAndMessage(warning);
        warning.stack = parsed.message + "\n" + parsed.stack.join("\n");
    }
    CapturedTrace.formatAndLogError(warning, "");
};

Promise.onPossiblyUnhandledRejection = function (fn) {
    var domain = getDomain();
    possiblyUnhandledRejection =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

Promise.onUnhandledRejectionHandled = function (fn) {
    var domain = getDomain();
    unhandledRejectionHandled =
        typeof fn === "function" ? (domain === null ? fn : domain.bind(fn))
                                 : undefined;
};

Promise.longStackTraces = function () {
    if (async.haveItemsQueued() &&
        debugging === false
   ) {
        throw new Error("cannot enable long stack traces after promises have been created\u000a\u000a    See http://goo.gl/DT1qyG\u000a");
    }
    debugging = CapturedTrace.isSupported();
    if (debugging) {
        async.disableTrampolineIfNecessary();
    }
};

Promise.hasLongStackTraces = function () {
    return debugging && CapturedTrace.isSupported();
};

if (!CapturedTrace.isSupported()) {
    Promise.longStackTraces = function(){};
    debugging = false;
}

return function() {
    return debugging;
};
};

},{"./async.js":2,"./errors.js":13,"./util.js":38}],11:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;

module.exports = function(Promise) {
var returner = function () {
    return this;
};
var thrower = function () {
    throw this;
};
var returnUndefined = function() {};
var throwUndefined = function() {
    throw undefined;
};

var wrapper = function (value, action) {
    if (action === 1) {
        return function () {
            throw value;
        };
    } else if (action === 2) {
        return function () {
            return value;
        };
    }
};


Promise.prototype["return"] =
Promise.prototype.thenReturn = function (value) {
    if (value === undefined) return this.then(returnUndefined);

    if (isPrimitive(value)) {
        return this._then(
            wrapper(value, 2),
            undefined,
            undefined,
            undefined,
            undefined
       );
    }
    return this._then(returner, undefined, undefined, value, undefined);
};

Promise.prototype["throw"] =
Promise.prototype.thenThrow = function (reason) {
    if (reason === undefined) return this.then(throwUndefined);

    if (isPrimitive(reason)) {
        return this._then(
            wrapper(reason, 1),
            undefined,
            undefined,
            undefined,
            undefined
       );
    }
    return this._then(thrower, undefined, undefined, reason, undefined);
};
};

},{"./util.js":38}],12:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseReduce = Promise.reduce;

Promise.prototype.each = function (fn) {
    return PromiseReduce(this, fn, null, INTERNAL);
};

Promise.each = function (promises, fn) {
    return PromiseReduce(promises, fn, null, INTERNAL);
};
};

},{}],13:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5.js");
var Objectfreeze = es5.freeze;
var util = _dereq_("./util.js");
var inherits = util.inherits;
var notEnumerableProp = util.notEnumerableProp;

function subError(nameProperty, defaultMessage) {
    function SubError(message) {
        if (!(this instanceof SubError)) return new SubError(message);
        notEnumerableProp(this, "message",
            typeof message === "string" ? message : defaultMessage);
        notEnumerableProp(this, "name", nameProperty);
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        } else {
            Error.call(this);
        }
    }
    inherits(SubError, Error);
    return SubError;
}

var _TypeError, _RangeError;
var Warning = subError("Warning", "warning");
var CancellationError = subError("CancellationError", "cancellation error");
var TimeoutError = subError("TimeoutError", "timeout error");
var AggregateError = subError("AggregateError", "aggregate error");
try {
    _TypeError = TypeError;
    _RangeError = RangeError;
} catch(e) {
    _TypeError = subError("TypeError", "type error");
    _RangeError = subError("RangeError", "range error");
}

var methods = ("join pop push shift unshift slice filter forEach some " +
    "every map indexOf lastIndexOf reduce reduceRight sort reverse").split(" ");

for (var i = 0; i < methods.length; ++i) {
    if (typeof Array.prototype[methods[i]] === "function") {
        AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
    }
}

es5.defineProperty(AggregateError.prototype, "length", {
    value: 0,
    configurable: false,
    writable: true,
    enumerable: true
});
AggregateError.prototype["isOperational"] = true;
var level = 0;
AggregateError.prototype.toString = function() {
    var indent = Array(level * 4 + 1).join(" ");
    var ret = "\n" + indent + "AggregateError of:" + "\n";
    level++;
    indent = Array(level * 4 + 1).join(" ");
    for (var i = 0; i < this.length; ++i) {
        var str = this[i] === this ? "[Circular AggregateError]" : this[i] + "";
        var lines = str.split("\n");
        for (var j = 0; j < lines.length; ++j) {
            lines[j] = indent + lines[j];
        }
        str = lines.join("\n");
        ret += str + "\n";
    }
    level--;
    return ret;
};

function OperationalError(message) {
    if (!(this instanceof OperationalError))
        return new OperationalError(message);
    notEnumerableProp(this, "name", "OperationalError");
    notEnumerableProp(this, "message", message);
    this.cause = message;
    this["isOperational"] = true;

    if (message instanceof Error) {
        notEnumerableProp(this, "message", message.message);
        notEnumerableProp(this, "stack", message.stack);
    } else if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
    }

}
inherits(OperationalError, Error);

var errorTypes = Error["__BluebirdErrorTypes__"];
if (!errorTypes) {
    errorTypes = Objectfreeze({
        CancellationError: CancellationError,
        TimeoutError: TimeoutError,
        OperationalError: OperationalError,
        RejectionError: OperationalError,
        AggregateError: AggregateError
    });
    notEnumerableProp(Error, "__BluebirdErrorTypes__", errorTypes);
}

module.exports = {
    Error: Error,
    TypeError: _TypeError,
    RangeError: _RangeError,
    CancellationError: errorTypes.CancellationError,
    OperationalError: errorTypes.OperationalError,
    TimeoutError: errorTypes.TimeoutError,
    AggregateError: errorTypes.AggregateError,
    Warning: Warning
};

},{"./es5.js":14,"./util.js":38}],14:[function(_dereq_,module,exports){
var isES5 = (function(){
    "use strict";
    return this === undefined;
})();

if (isES5) {
    module.exports = {
        freeze: Object.freeze,
        defineProperty: Object.defineProperty,
        getDescriptor: Object.getOwnPropertyDescriptor,
        keys: Object.keys,
        names: Object.getOwnPropertyNames,
        getPrototypeOf: Object.getPrototypeOf,
        isArray: Array.isArray,
        isES5: isES5,
        propertyIsWritable: function(obj, prop) {
            var descriptor = Object.getOwnPropertyDescriptor(obj, prop);
            return !!(!descriptor || descriptor.writable || descriptor.set);
        }
    };
} else {
    var has = {}.hasOwnProperty;
    var str = {}.toString;
    var proto = {}.constructor.prototype;

    var ObjectKeys = function (o) {
        var ret = [];
        for (var key in o) {
            if (has.call(o, key)) {
                ret.push(key);
            }
        }
        return ret;
    };

    var ObjectGetDescriptor = function(o, key) {
        return {value: o[key]};
    };

    var ObjectDefineProperty = function (o, key, desc) {
        o[key] = desc.value;
        return o;
    };

    var ObjectFreeze = function (obj) {
        return obj;
    };

    var ObjectGetPrototypeOf = function (obj) {
        try {
            return Object(obj).constructor.prototype;
        }
        catch (e) {
            return proto;
        }
    };

    var ArrayIsArray = function (obj) {
        try {
            return str.call(obj) === "[object Array]";
        }
        catch(e) {
            return false;
        }
    };

    module.exports = {
        isArray: ArrayIsArray,
        keys: ObjectKeys,
        names: ObjectKeys,
        defineProperty: ObjectDefineProperty,
        getDescriptor: ObjectGetDescriptor,
        freeze: ObjectFreeze,
        getPrototypeOf: ObjectGetPrototypeOf,
        isES5: isES5,
        propertyIsWritable: function() {
            return true;
        }
    };
}

},{}],15:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var PromiseMap = Promise.map;

Promise.prototype.filter = function (fn, options) {
    return PromiseMap(this, fn, options, INTERNAL);
};

Promise.filter = function (promises, fn, options) {
    return PromiseMap(promises, fn, options, INTERNAL);
};
};

},{}],16:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, NEXT_FILTER, tryConvertToPromise) {
var util = _dereq_("./util.js");
var isPrimitive = util.isPrimitive;
var thrower = util.thrower;

function returnThis() {
    return this;
}
function throwThis() {
    throw this;
}
function return$(r) {
    return function() {
        return r;
    };
}
function throw$(r) {
    return function() {
        throw r;
    };
}
function promisedFinally(ret, reasonOrValue, isFulfilled) {
    var then;
    if (isPrimitive(reasonOrValue)) {
        then = isFulfilled ? return$(reasonOrValue) : throw$(reasonOrValue);
    } else {
        then = isFulfilled ? returnThis : throwThis;
    }
    return ret._then(then, thrower, undefined, reasonOrValue, undefined);
}

function finallyHandler(reasonOrValue) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundValue())
                    : handler();

    if (ret !== undefined) {
        var maybePromise = tryConvertToPromise(ret, promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            return promisedFinally(maybePromise, reasonOrValue,
                                    promise.isFulfilled());
        }
    }

    if (promise.isRejected()) {
        NEXT_FILTER.e = reasonOrValue;
        return NEXT_FILTER;
    } else {
        return reasonOrValue;
    }
}

function tapHandler(value) {
    var promise = this.promise;
    var handler = this.handler;

    var ret = promise._isBound()
                    ? handler.call(promise._boundValue(), value)
                    : handler(value);

    if (ret !== undefined) {
        var maybePromise = tryConvertToPromise(ret, promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            return promisedFinally(maybePromise, value, true);
        }
    }
    return value;
}

Promise.prototype._passThroughHandler = function (handler, isFinally) {
    if (typeof handler !== "function") return this.then();

    var promiseAndHandler = {
        promise: this,
        handler: handler
    };

    return this._then(
            isFinally ? finallyHandler : tapHandler,
            isFinally ? finallyHandler : undefined, undefined,
            promiseAndHandler, undefined);
};

Promise.prototype.lastly =
Promise.prototype["finally"] = function (handler) {
    return this._passThroughHandler(handler, true);
};

Promise.prototype.tap = function (handler) {
    return this._passThroughHandler(handler, false);
};
};

},{"./util.js":38}],17:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          apiRejection,
                          INTERNAL,
                          tryConvertToPromise) {
var errors = _dereq_("./errors.js");
var TypeError = errors.TypeError;
var util = _dereq_("./util.js");
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
var yieldHandlers = [];

function promiseFromYieldHandler(value, yieldHandlers, traceParent) {
    for (var i = 0; i < yieldHandlers.length; ++i) {
        traceParent._pushContext();
        var result = tryCatch(yieldHandlers[i])(value);
        traceParent._popContext();
        if (result === errorObj) {
            traceParent._pushContext();
            var ret = Promise.reject(errorObj.e);
            traceParent._popContext();
            return ret;
        }
        var maybePromise = tryConvertToPromise(result, traceParent);
        if (maybePromise instanceof Promise) return maybePromise;
    }
    return null;
}

function PromiseSpawn(generatorFunction, receiver, yieldHandler, stack) {
    var promise = this._promise = new Promise(INTERNAL);
    promise._captureStackTrace();
    this._stack = stack;
    this._generatorFunction = generatorFunction;
    this._receiver = receiver;
    this._generator = undefined;
    this._yieldHandlers = typeof yieldHandler === "function"
        ? [yieldHandler].concat(yieldHandlers)
        : yieldHandlers;
}

PromiseSpawn.prototype.promise = function () {
    return this._promise;
};

PromiseSpawn.prototype._run = function () {
    this._generator = this._generatorFunction.call(this._receiver);
    this._receiver =
        this._generatorFunction = undefined;
    this._next(undefined);
};

PromiseSpawn.prototype._continue = function (result) {
    if (result === errorObj) {
        return this._promise._rejectCallback(result.e, false, true);
    }

    var value = result.value;
    if (result.done === true) {
        this._promise._resolveCallback(value);
    } else {
        var maybePromise = tryConvertToPromise(value, this._promise);
        if (!(maybePromise instanceof Promise)) {
            maybePromise =
                promiseFromYieldHandler(maybePromise,
                                        this._yieldHandlers,
                                        this._promise);
            if (maybePromise === null) {
                this._throw(
                    new TypeError(
                        "A value %s was yielded that could not be treated as a promise\u000a\u000a    See http://goo.gl/4Y4pDk\u000a\u000a".replace("%s", value) +
                        "From coroutine:\u000a" +
                        this._stack.split("\n").slice(1, -7).join("\n")
                    )
                );
                return;
            }
        }
        maybePromise._then(
            this._next,
            this._throw,
            undefined,
            this,
            null
       );
    }
};

PromiseSpawn.prototype._throw = function (reason) {
    this._promise._attachExtraTrace(reason);
    this._promise._pushContext();
    var result = tryCatch(this._generator["throw"])
        .call(this._generator, reason);
    this._promise._popContext();
    this._continue(result);
};

PromiseSpawn.prototype._next = function (value) {
    this._promise._pushContext();
    var result = tryCatch(this._generator.next).call(this._generator, value);
    this._promise._popContext();
    this._continue(result);
};

Promise.coroutine = function (generatorFunction, options) {
    if (typeof generatorFunction !== "function") {
        throw new TypeError("generatorFunction must be a function\u000a\u000a    See http://goo.gl/6Vqhm0\u000a");
    }
    var yieldHandler = Object(options).yieldHandler;
    var PromiseSpawn$ = PromiseSpawn;
    var stack = new Error().stack;
    return function () {
        var generator = generatorFunction.apply(this, arguments);
        var spawn = new PromiseSpawn$(undefined, undefined, yieldHandler,
                                      stack);
        spawn._generator = generator;
        spawn._next(undefined);
        return spawn.promise();
    };
};

Promise.coroutine.addYieldHandler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    yieldHandlers.push(fn);
};

Promise.spawn = function (generatorFunction) {
    if (typeof generatorFunction !== "function") {
        return apiRejection("generatorFunction must be a function\u000a\u000a    See http://goo.gl/6Vqhm0\u000a");
    }
    var spawn = new PromiseSpawn(generatorFunction, this);
    var ret = spawn.promise();
    spawn._run(Promise.spawn);
    return ret;
};
};

},{"./errors.js":13,"./util.js":38}],18:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, tryConvertToPromise, INTERNAL) {
var util = _dereq_("./util.js");
var canEvaluate = util.canEvaluate;
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var reject;

if (!true) {
if (canEvaluate) {
    var thenCallback = function(i) {
        return new Function("value", "holder", "                             \n\
            'use strict';                                                    \n\
            holder.pIndex = value;                                           \n\
            holder.checkFulfillment(this);                                   \n\
            ".replace(/Index/g, i));
    };

    var caller = function(count) {
        var values = [];
        for (var i = 1; i <= count; ++i) values.push("holder.p" + i);
        return new Function("holder", "                                      \n\
            'use strict';                                                    \n\
            var callback = holder.fn;                                        \n\
            return callback(values);                                         \n\
            ".replace(/values/g, values.join(", ")));
    };
    var thenCallbacks = [];
    var callers = [undefined];
    for (var i = 1; i <= 5; ++i) {
        thenCallbacks.push(thenCallback(i));
        callers.push(caller(i));
    }

    var Holder = function(total, fn) {
        this.p1 = this.p2 = this.p3 = this.p4 = this.p5 = null;
        this.fn = fn;
        this.total = total;
        this.now = 0;
    };

    Holder.prototype.callers = callers;
    Holder.prototype.checkFulfillment = function(promise) {
        var now = this.now;
        now++;
        var total = this.total;
        if (now >= total) {
            var handler = this.callers[total];
            promise._pushContext();
            var ret = tryCatch(handler)(this);
            promise._popContext();
            if (ret === errorObj) {
                promise._rejectCallback(ret.e, false, true);
            } else {
                promise._resolveCallback(ret);
            }
        } else {
            this.now = now;
        }
    };

    var reject = function (reason) {
        this._reject(reason);
    };
}
}

Promise.join = function () {
    var last = arguments.length - 1;
    var fn;
    if (last > 0 && typeof arguments[last] === "function") {
        fn = arguments[last];
        if (!true) {
            if (last < 6 && canEvaluate) {
                var ret = new Promise(INTERNAL);
                ret._captureStackTrace();
                var holder = new Holder(last, fn);
                var callbacks = thenCallbacks;
                for (var i = 0; i < last; ++i) {
                    var maybePromise = tryConvertToPromise(arguments[i], ret);
                    if (maybePromise instanceof Promise) {
                        maybePromise = maybePromise._target();
                        if (maybePromise._isPending()) {
                            maybePromise._then(callbacks[i], reject,
                                               undefined, ret, holder);
                        } else if (maybePromise._isFulfilled()) {
                            callbacks[i].call(ret,
                                              maybePromise._value(), holder);
                        } else {
                            ret._reject(maybePromise._reason());
                        }
                    } else {
                        callbacks[i].call(ret, maybePromise, holder);
                    }
                }
                return ret;
            }
        }
    }
    var $_len = arguments.length;var args = new Array($_len); for(var $_i = 0; $_i < $_len; ++$_i) {args[$_i] = arguments[$_i];}
    if (fn) args.pop();
    var ret = new PromiseArray(args).promise();
    return fn !== undefined ? ret.spread(fn) : ret;
};

};

},{"./util.js":38}],19:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
var PENDING = {};
var EMPTY_ARRAY = [];

function MappingPromiseArray(promises, fn, limit, _filter) {
    this.constructor$(promises);
    this._promise._captureStackTrace();
    var domain = getDomain();
    this._callback = domain === null ? fn : domain.bind(fn);
    this._preservedValues = _filter === INTERNAL
        ? new Array(this.length())
        : null;
    this._limit = limit;
    this._inFlight = 0;
    this._queue = limit >= 1 ? [] : EMPTY_ARRAY;
    async.invoke(init, this, undefined);
}
util.inherits(MappingPromiseArray, PromiseArray);
function init() {this._init$(undefined, -2);}

MappingPromiseArray.prototype._init = function () {};

MappingPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var values = this._values;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var limit = this._limit;
    if (values[index] === PENDING) {
        values[index] = value;
        if (limit >= 1) {
            this._inFlight--;
            this._drainQueue();
            if (this._isResolved()) return;
        }
    } else {
        if (limit >= 1 && this._inFlight >= limit) {
            values[index] = value;
            this._queue.push(index);
            return;
        }
        if (preservedValues !== null) preservedValues[index] = value;

        var callback = this._callback;
        var receiver = this._promise._boundValue();
        this._promise._pushContext();
        var ret = tryCatch(callback).call(receiver, value, index, length);
        this._promise._popContext();
        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (maybePromise._isPending()) {
                if (limit >= 1) this._inFlight++;
                values[index] = PENDING;
                return maybePromise._proxyPromiseArray(this, index);
            } else if (maybePromise._isFulfilled()) {
                ret = maybePromise._value();
            } else {
                return this._reject(maybePromise._reason());
            }
        }
        values[index] = ret;
    }
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= length) {
        if (preservedValues !== null) {
            this._filter(values, preservedValues);
        } else {
            this._resolve(values);
        }

    }
};

MappingPromiseArray.prototype._drainQueue = function () {
    var queue = this._queue;
    var limit = this._limit;
    var values = this._values;
    while (queue.length > 0 && this._inFlight < limit) {
        if (this._isResolved()) return;
        var index = queue.pop();
        this._promiseFulfilled(values[index], index);
    }
};

MappingPromiseArray.prototype._filter = function (booleans, values) {
    var len = values.length;
    var ret = new Array(len);
    var j = 0;
    for (var i = 0; i < len; ++i) {
        if (booleans[i]) ret[j++] = values[i];
    }
    ret.length = j;
    this._resolve(ret);
};

MappingPromiseArray.prototype.preservedValues = function () {
    return this._preservedValues;
};

function map(promises, fn, options, _filter) {
    var limit = typeof options === "object" && options !== null
        ? options.concurrency
        : 0;
    limit = typeof limit === "number" &&
        isFinite(limit) && limit >= 1 ? limit : 0;
    return new MappingPromiseArray(promises, fn, limit, _filter);
}

Promise.prototype.map = function (fn, options) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");

    return map(this, fn, options, null).promise();
};

Promise.map = function (promises, fn, options, _filter) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    return map(promises, fn, options, _filter).promise();
};


};

},{"./async.js":2,"./util.js":38}],20:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, INTERNAL, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;

Promise.method = function (fn) {
    if (typeof fn !== "function") {
        throw new Promise.TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    return function () {
        var ret = new Promise(INTERNAL);
        ret._captureStackTrace();
        ret._pushContext();
        var value = tryCatch(fn).apply(this, arguments);
        ret._popContext();
        ret._resolveFromSyncValue(value);
        return ret;
    };
};

Promise.attempt = Promise["try"] = function (fn, args, ctx) {
    if (typeof fn !== "function") {
        return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._pushContext();
    var value = util.isArray(args)
        ? tryCatch(fn).apply(ctx, args)
        : tryCatch(fn).call(ctx, args);
    ret._popContext();
    ret._resolveFromSyncValue(value);
    return ret;
};

Promise.prototype._resolveFromSyncValue = function (value) {
    if (value === util.errorObj) {
        this._rejectCallback(value.e, false, true);
    } else {
        this._resolveCallback(value, true);
    }
};
};

},{"./util.js":38}],21:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

function spreadAdapter(val, nodeback) {
    var promise = this;
    if (!util.isArray(val)) return successAdapter.call(promise, val, nodeback);
    var ret =
        tryCatch(nodeback).apply(promise._boundValue(), [null].concat(val));
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

function successAdapter(val, nodeback) {
    var promise = this;
    var receiver = promise._boundValue();
    var ret = val === undefined
        ? tryCatch(nodeback).call(receiver, null)
        : tryCatch(nodeback).call(receiver, null, val);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}
function errorAdapter(reason, nodeback) {
    var promise = this;
    if (!reason) {
        var target = promise._target();
        var newReason = target._getCarriedStackTrace();
        newReason.cause = reason;
        reason = newReason;
    }
    var ret = tryCatch(nodeback).call(promise._boundValue(), reason);
    if (ret === errorObj) {
        async.throwLater(ret.e);
    }
}

Promise.prototype.asCallback =
Promise.prototype.nodeify = function (nodeback, options) {
    if (typeof nodeback == "function") {
        var adapter = successAdapter;
        if (options !== undefined && Object(options).spread) {
            adapter = spreadAdapter;
        }
        this._then(
            adapter,
            errorAdapter,
            undefined,
            this,
            nodeback
        );
    }
    return this;
};
};

},{"./async.js":2,"./util.js":38}],22:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, PromiseArray) {
var util = _dereq_("./util.js");
var async = _dereq_("./async.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;

Promise.prototype.progressed = function (handler) {
    return this._then(undefined, undefined, handler, undefined, undefined);
};

Promise.prototype._progress = function (progressValue) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._target()._progressUnchecked(progressValue);

};

Promise.prototype._progressHandlerAt = function (index) {
    return index === 0
        ? this._progressHandler0
        : this[(index << 2) + index - 5 + 2];
};

Promise.prototype._doProgressWith = function (progression) {
    var progressValue = progression.value;
    var handler = progression.handler;
    var promise = progression.promise;
    var receiver = progression.receiver;

    var ret = tryCatch(handler).call(receiver, progressValue);
    if (ret === errorObj) {
        if (ret.e != null &&
            ret.e.name !== "StopProgressPropagation") {
            var trace = util.canAttachTrace(ret.e)
                ? ret.e : new Error(util.toString(ret.e));
            promise._attachExtraTrace(trace);
            promise._progress(ret.e);
        }
    } else if (ret instanceof Promise) {
        ret._then(promise._progress, null, null, promise, undefined);
    } else {
        promise._progress(ret);
    }
};


Promise.prototype._progressUnchecked = function (progressValue) {
    var len = this._length();
    var progress = this._progress;
    for (var i = 0; i < len; i++) {
        var handler = this._progressHandlerAt(i);
        var promise = this._promiseAt(i);
        if (!(promise instanceof Promise)) {
            var receiver = this._receiverAt(i);
            if (typeof handler === "function") {
                handler.call(receiver, progressValue, promise);
            } else if (receiver instanceof PromiseArray &&
                       !receiver._isResolved()) {
                receiver._promiseProgressed(progressValue, promise);
            }
            continue;
        }

        if (typeof handler === "function") {
            async.invoke(this._doProgressWith, this, {
                handler: handler,
                promise: promise,
                receiver: this._receiverAt(i),
                value: progressValue
            });
        } else {
            async.invoke(progress, promise, progressValue);
        }
    }
};
};

},{"./async.js":2,"./util.js":38}],23:[function(_dereq_,module,exports){
"use strict";
module.exports = function() {
var makeSelfResolutionError = function () {
    return new TypeError("circular promise resolution chain\u000a\u000a    See http://goo.gl/LhFpo0\u000a");
};
var reflect = function() {
    return new Promise.PromiseInspection(this._target());
};
var apiRejection = function(msg) {
    return Promise.reject(new TypeError(msg));
};

var util = _dereq_("./util.js");

var getDomain;
if (util.isNode) {
    getDomain = function() {
        var ret = process.domain;
        if (ret === undefined) ret = null;
        return ret;
    };
} else {
    getDomain = function() {
        return null;
    };
}
util.notEnumerableProp(Promise, "_getDomain", getDomain);

var async = _dereq_("./async.js");
var errors = _dereq_("./errors.js");
var TypeError = Promise.TypeError = errors.TypeError;
Promise.RangeError = errors.RangeError;
Promise.CancellationError = errors.CancellationError;
Promise.TimeoutError = errors.TimeoutError;
Promise.OperationalError = errors.OperationalError;
Promise.RejectionError = errors.OperationalError;
Promise.AggregateError = errors.AggregateError;
var INTERNAL = function(){};
var APPLY = {};
var NEXT_FILTER = {e: null};
var tryConvertToPromise = _dereq_("./thenables.js")(Promise, INTERNAL);
var PromiseArray =
    _dereq_("./promise_array.js")(Promise, INTERNAL,
                                    tryConvertToPromise, apiRejection);
var CapturedTrace = _dereq_("./captured_trace.js")();
var isDebugging = _dereq_("./debuggability.js")(Promise, CapturedTrace);
 /*jshint unused:false*/
var createContext =
    _dereq_("./context.js")(Promise, CapturedTrace, isDebugging);
var CatchFilter = _dereq_("./catch_filter.js")(NEXT_FILTER);
var PromiseResolver = _dereq_("./promise_resolver.js");
var nodebackForPromise = PromiseResolver._nodebackForPromise;
var errorObj = util.errorObj;
var tryCatch = util.tryCatch;
function Promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("the promise constructor requires a resolver function\u000a\u000a    See http://goo.gl/EC22Yn\u000a");
    }
    if (this.constructor !== Promise) {
        throw new TypeError("the promise constructor cannot be invoked directly\u000a\u000a    See http://goo.gl/KsIlge\u000a");
    }
    this._bitField = 0;
    this._fulfillmentHandler0 = undefined;
    this._rejectionHandler0 = undefined;
    this._progressHandler0 = undefined;
    this._promise0 = undefined;
    this._receiver0 = undefined;
    this._settledValue = undefined;
    if (resolver !== INTERNAL) this._resolveFromResolver(resolver);
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.caught = Promise.prototype["catch"] = function (fn) {
    var len = arguments.length;
    if (len > 1) {
        var catchInstances = new Array(len - 1),
            j = 0, i;
        for (i = 0; i < len - 1; ++i) {
            var item = arguments[i];
            if (typeof item === "function") {
                catchInstances[j++] = item;
            } else {
                return Promise.reject(
                    new TypeError("Catch filter must inherit from Error or be a simple predicate function\u000a\u000a    See http://goo.gl/o84o68\u000a"));
            }
        }
        catchInstances.length = j;
        fn = arguments[i];
        var catchFilter = new CatchFilter(catchInstances, fn, this);
        return this._then(undefined, catchFilter.doFilter, undefined,
            catchFilter, undefined);
    }
    return this._then(undefined, fn, undefined, undefined, undefined);
};

Promise.prototype.reflect = function () {
    return this._then(reflect, reflect, undefined, this, undefined);
};

Promise.prototype.then = function (didFulfill, didReject, didProgress) {
    if (isDebugging() && arguments.length > 0 &&
        typeof didFulfill !== "function" &&
        typeof didReject !== "function") {
        var msg = ".then() only accepts functions but was passed: " +
                util.classString(didFulfill);
        if (arguments.length > 1) {
            msg += ", " + util.classString(didReject);
        }
        this._warn(msg);
    }
    return this._then(didFulfill, didReject, didProgress,
        undefined, undefined);
};

Promise.prototype.done = function (didFulfill, didReject, didProgress) {
    var promise = this._then(didFulfill, didReject, didProgress,
        undefined, undefined);
    promise._setIsFinal();
};

Promise.prototype.spread = function (didFulfill, didReject) {
    return this.all()._then(didFulfill, didReject, undefined, APPLY, undefined);
};

Promise.prototype.isCancellable = function () {
    return !this.isResolved() &&
        this._cancellable();
};

Promise.prototype.toJSON = function () {
    var ret = {
        isFulfilled: false,
        isRejected: false,
        fulfillmentValue: undefined,
        rejectionReason: undefined
    };
    if (this.isFulfilled()) {
        ret.fulfillmentValue = this.value();
        ret.isFulfilled = true;
    } else if (this.isRejected()) {
        ret.rejectionReason = this.reason();
        ret.isRejected = true;
    }
    return ret;
};

Promise.prototype.all = function () {
    return new PromiseArray(this).promise();
};

Promise.prototype.error = function (fn) {
    return this.caught(util.originatesFromRejection, fn);
};

Promise.is = function (val) {
    return val instanceof Promise;
};

Promise.fromNode = function(fn) {
    var ret = new Promise(INTERNAL);
    var result = tryCatch(fn)(nodebackForPromise(ret));
    if (result === errorObj) {
        ret._rejectCallback(result.e, true, true);
    }
    return ret;
};

Promise.all = function (promises) {
    return new PromiseArray(promises).promise();
};

Promise.defer = Promise.pending = function () {
    var promise = new Promise(INTERNAL);
    return new PromiseResolver(promise);
};

Promise.cast = function (obj) {
    var ret = tryConvertToPromise(obj);
    if (!(ret instanceof Promise)) {
        var val = ret;
        ret = new Promise(INTERNAL);
        ret._fulfillUnchecked(val);
    }
    return ret;
};

Promise.resolve = Promise.fulfilled = Promise.cast;

Promise.reject = Promise.rejected = function (reason) {
    var ret = new Promise(INTERNAL);
    ret._captureStackTrace();
    ret._rejectCallback(reason, true);
    return ret;
};

Promise.setScheduler = function(fn) {
    if (typeof fn !== "function") throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    var prev = async._schedule;
    async._schedule = fn;
    return prev;
};

Promise.prototype._then = function (
    didFulfill,
    didReject,
    didProgress,
    receiver,
    internalData
) {
    var haveInternalData = internalData !== undefined;
    var ret = haveInternalData ? internalData : new Promise(INTERNAL);

    if (!haveInternalData) {
        ret._propagateFrom(this, 4 | 1);
        ret._captureStackTrace();
    }

    var target = this._target();
    if (target !== this) {
        if (receiver === undefined) receiver = this._boundTo;
        if (!haveInternalData) ret._setIsMigrated();
    }

    var callbackIndex = target._addCallbacks(didFulfill,
                                             didReject,
                                             didProgress,
                                             ret,
                                             receiver,
                                             getDomain());

    if (target._isResolved() && !target._isSettlePromisesQueued()) {
        async.invoke(
            target._settlePromiseAtPostResolution, target, callbackIndex);
    }

    return ret;
};

Promise.prototype._settlePromiseAtPostResolution = function (index) {
    if (this._isRejectionUnhandled()) this._unsetRejectionIsUnhandled();
    this._settlePromiseAt(index);
};

Promise.prototype._length = function () {
    return this._bitField & 131071;
};

Promise.prototype._isFollowingOrFulfilledOrRejected = function () {
    return (this._bitField & 939524096) > 0;
};

Promise.prototype._isFollowing = function () {
    return (this._bitField & 536870912) === 536870912;
};

Promise.prototype._setLength = function (len) {
    this._bitField = (this._bitField & -131072) |
        (len & 131071);
};

Promise.prototype._setFulfilled = function () {
    this._bitField = this._bitField | 268435456;
};

Promise.prototype._setRejected = function () {
    this._bitField = this._bitField | 134217728;
};

Promise.prototype._setFollowing = function () {
    this._bitField = this._bitField | 536870912;
};

Promise.prototype._setIsFinal = function () {
    this._bitField = this._bitField | 33554432;
};

Promise.prototype._isFinal = function () {
    return (this._bitField & 33554432) > 0;
};

Promise.prototype._cancellable = function () {
    return (this._bitField & 67108864) > 0;
};

Promise.prototype._setCancellable = function () {
    this._bitField = this._bitField | 67108864;
};

Promise.prototype._unsetCancellable = function () {
    this._bitField = this._bitField & (~67108864);
};

Promise.prototype._setIsMigrated = function () {
    this._bitField = this._bitField | 4194304;
};

Promise.prototype._unsetIsMigrated = function () {
    this._bitField = this._bitField & (~4194304);
};

Promise.prototype._isMigrated = function () {
    return (this._bitField & 4194304) > 0;
};

Promise.prototype._receiverAt = function (index) {
    var ret = index === 0
        ? this._receiver0
        : this[
            index * 5 - 5 + 4];
    if (ret === undefined && this._isBound()) {
        return this._boundValue();
    }
    return ret;
};

Promise.prototype._promiseAt = function (index) {
    return index === 0
        ? this._promise0
        : this[index * 5 - 5 + 3];
};

Promise.prototype._fulfillmentHandlerAt = function (index) {
    return index === 0
        ? this._fulfillmentHandler0
        : this[index * 5 - 5 + 0];
};

Promise.prototype._rejectionHandlerAt = function (index) {
    return index === 0
        ? this._rejectionHandler0
        : this[index * 5 - 5 + 1];
};

Promise.prototype._boundValue = function() {
    var ret = this._boundTo;
    if (ret !== undefined) {
        if (ret instanceof Promise) {
            if (ret.isFulfilled()) {
                return ret.value();
            } else {
                return undefined;
            }
        }
    }
    return ret;
};

Promise.prototype._migrateCallbacks = function (follower, index) {
    var fulfill = follower._fulfillmentHandlerAt(index);
    var reject = follower._rejectionHandlerAt(index);
    var progress = follower._progressHandlerAt(index);
    var promise = follower._promiseAt(index);
    var receiver = follower._receiverAt(index);
    if (promise instanceof Promise) promise._setIsMigrated();
    this._addCallbacks(fulfill, reject, progress, promise, receiver, null);
};

Promise.prototype._addCallbacks = function (
    fulfill,
    reject,
    progress,
    promise,
    receiver,
    domain
) {
    var index = this._length();

    if (index >= 131071 - 5) {
        index = 0;
        this._setLength(0);
    }

    if (index === 0) {
        this._promise0 = promise;
        if (receiver !== undefined) this._receiver0 = receiver;
        if (typeof fulfill === "function" && !this._isCarryingStackTrace()) {
            this._fulfillmentHandler0 =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this._rejectionHandler0 =
                domain === null ? reject : domain.bind(reject);
        }
        if (typeof progress === "function") {
            this._progressHandler0 =
                domain === null ? progress : domain.bind(progress);
        }
    } else {
        var base = index * 5 - 5;
        this[base + 3] = promise;
        this[base + 4] = receiver;
        if (typeof fulfill === "function") {
            this[base + 0] =
                domain === null ? fulfill : domain.bind(fulfill);
        }
        if (typeof reject === "function") {
            this[base + 1] =
                domain === null ? reject : domain.bind(reject);
        }
        if (typeof progress === "function") {
            this[base + 2] =
                domain === null ? progress : domain.bind(progress);
        }
    }
    this._setLength(index + 1);
    return index;
};

Promise.prototype._setProxyHandlers = function (receiver, promiseSlotValue) {
    var index = this._length();

    if (index >= 131071 - 5) {
        index = 0;
        this._setLength(0);
    }
    if (index === 0) {
        this._promise0 = promiseSlotValue;
        this._receiver0 = receiver;
    } else {
        var base = index * 5 - 5;
        this[base + 3] = promiseSlotValue;
        this[base + 4] = receiver;
    }
    this._setLength(index + 1);
};

Promise.prototype._proxyPromiseArray = function (promiseArray, index) {
    this._setProxyHandlers(promiseArray, index);
};

Promise.prototype._resolveCallback = function(value, shouldBind) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    if (value === this)
        return this._rejectCallback(makeSelfResolutionError(), false, true);
    var maybePromise = tryConvertToPromise(value, this);
    if (!(maybePromise instanceof Promise)) return this._fulfill(value);

    var propagationFlags = 1 | (shouldBind ? 4 : 0);
    this._propagateFrom(maybePromise, propagationFlags);
    var promise = maybePromise._target();
    if (promise._isPending()) {
        var len = this._length();
        for (var i = 0; i < len; ++i) {
            promise._migrateCallbacks(this, i);
        }
        this._setFollowing();
        this._setLength(0);
        this._setFollowee(promise);
    } else if (promise._isFulfilled()) {
        this._fulfillUnchecked(promise._value());
    } else {
        this._rejectUnchecked(promise._reason(),
            promise._getCarriedStackTrace());
    }
};

Promise.prototype._rejectCallback =
function(reason, synchronous, shouldNotMarkOriginatingFromRejection) {
    if (!shouldNotMarkOriginatingFromRejection) {
        util.markAsOriginatingFromRejection(reason);
    }
    var trace = util.ensureErrorObject(reason);
    var hasStack = trace === reason;
    this._attachExtraTrace(trace, synchronous ? hasStack : false);
    this._reject(reason, hasStack ? undefined : trace);
};

Promise.prototype._resolveFromResolver = function (resolver) {
    var promise = this;
    this._captureStackTrace();
    this._pushContext();
    var synchronous = true;
    var r = tryCatch(resolver)(function(value) {
        if (promise === null) return;
        promise._resolveCallback(value);
        promise = null;
    }, function (reason) {
        if (promise === null) return;
        promise._rejectCallback(reason, synchronous);
        promise = null;
    });
    synchronous = false;
    this._popContext();

    if (r !== undefined && r === errorObj && promise !== null) {
        promise._rejectCallback(r.e, true, true);
        promise = null;
    }
};

Promise.prototype._settlePromiseFromHandler = function (
    handler, receiver, value, promise
) {
    if (promise._isRejected()) return;
    promise._pushContext();
    var x;
    if (receiver === APPLY && !this._isRejected()) {
        x = tryCatch(handler).apply(this._boundValue(), value);
    } else {
        x = tryCatch(handler).call(receiver, value);
    }
    promise._popContext();

    if (x === errorObj || x === promise || x === NEXT_FILTER) {
        var err = x === promise ? makeSelfResolutionError() : x.e;
        promise._rejectCallback(err, false, true);
    } else {
        promise._resolveCallback(x);
    }
};

Promise.prototype._target = function() {
    var ret = this;
    while (ret._isFollowing()) ret = ret._followee();
    return ret;
};

Promise.prototype._followee = function() {
    return this._rejectionHandler0;
};

Promise.prototype._setFollowee = function(promise) {
    this._rejectionHandler0 = promise;
};

Promise.prototype._cleanValues = function () {
    if (this._cancellable()) {
        this._cancellationParent = undefined;
    }
};

Promise.prototype._propagateFrom = function (parent, flags) {
    if ((flags & 1) > 0 && parent._cancellable()) {
        this._setCancellable();
        this._cancellationParent = parent;
    }
    if ((flags & 4) > 0 && parent._isBound()) {
        this._setBoundTo(parent._boundTo);
    }
};

Promise.prototype._fulfill = function (value) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._fulfillUnchecked(value);
};

Promise.prototype._reject = function (reason, carriedStackTrace) {
    if (this._isFollowingOrFulfilledOrRejected()) return;
    this._rejectUnchecked(reason, carriedStackTrace);
};

Promise.prototype._settlePromiseAt = function (index) {
    var promise = this._promiseAt(index);
    var isPromise = promise instanceof Promise;

    if (isPromise && promise._isMigrated()) {
        promise._unsetIsMigrated();
        return async.invoke(this._settlePromiseAt, this, index);
    }
    var handler = this._isFulfilled()
        ? this._fulfillmentHandlerAt(index)
        : this._rejectionHandlerAt(index);

    var carriedStackTrace =
        this._isCarryingStackTrace() ? this._getCarriedStackTrace() : undefined;
    var value = this._settledValue;
    var receiver = this._receiverAt(index);
    this._clearCallbackDataAtIndex(index);

    if (typeof handler === "function") {
        if (!isPromise) {
            handler.call(receiver, value, promise);
        } else {
            this._settlePromiseFromHandler(handler, receiver, value, promise);
        }
    } else if (receiver instanceof PromiseArray) {
        if (!receiver._isResolved()) {
            if (this._isFulfilled()) {
                receiver._promiseFulfilled(value, promise);
            }
            else {
                receiver._promiseRejected(value, promise);
            }
        }
    } else if (isPromise) {
        if (this._isFulfilled()) {
            promise._fulfill(value);
        } else {
            promise._reject(value, carriedStackTrace);
        }
    }

    if (index >= 4 && (index & 31) === 4)
        async.invokeLater(this._setLength, this, 0);
};

Promise.prototype._clearCallbackDataAtIndex = function(index) {
    if (index === 0) {
        if (!this._isCarryingStackTrace()) {
            this._fulfillmentHandler0 = undefined;
        }
        this._rejectionHandler0 =
        this._progressHandler0 =
        this._receiver0 =
        this._promise0 = undefined;
    } else {
        var base = index * 5 - 5;
        this[base + 3] =
        this[base + 4] =
        this[base + 0] =
        this[base + 1] =
        this[base + 2] = undefined;
    }
};

Promise.prototype._isSettlePromisesQueued = function () {
    return (this._bitField &
            -1073741824) === -1073741824;
};

Promise.prototype._setSettlePromisesQueued = function () {
    this._bitField = this._bitField | -1073741824;
};

Promise.prototype._unsetSettlePromisesQueued = function () {
    this._bitField = this._bitField & (~-1073741824);
};

Promise.prototype._queueSettlePromises = function() {
    async.settlePromises(this);
    this._setSettlePromisesQueued();
};

Promise.prototype._fulfillUnchecked = function (value) {
    if (value === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err, undefined);
    }
    this._setFulfilled();
    this._settledValue = value;
    this._cleanValues();

    if (this._length() > 0) {
        this._queueSettlePromises();
    }
};

Promise.prototype._rejectUncheckedCheckError = function (reason) {
    var trace = util.ensureErrorObject(reason);
    this._rejectUnchecked(reason, trace === reason ? undefined : trace);
};

Promise.prototype._rejectUnchecked = function (reason, trace) {
    if (reason === this) {
        var err = makeSelfResolutionError();
        this._attachExtraTrace(err);
        return this._rejectUnchecked(err);
    }
    this._setRejected();
    this._settledValue = reason;
    this._cleanValues();

    if (this._isFinal()) {
        async.throwLater(function(e) {
            if ("stack" in e) {
                async.invokeFirst(
                    CapturedTrace.unhandledRejection, undefined, e);
            }
            throw e;
        }, trace === undefined ? reason : trace);
        return;
    }

    if (trace !== undefined && trace !== reason) {
        this._setCarriedStackTrace(trace);
    }

    if (this._length() > 0) {
        this._queueSettlePromises();
    } else {
        this._ensurePossibleRejectionHandled();
    }
};

Promise.prototype._settlePromises = function () {
    this._unsetSettlePromisesQueued();
    var len = this._length();
    for (var i = 0; i < len; i++) {
        this._settlePromiseAt(i);
    }
};

util.notEnumerableProp(Promise,
                       "_makeSelfResolutionError",
                       makeSelfResolutionError);

_dereq_("./progress.js")(Promise, PromiseArray);
_dereq_("./method.js")(Promise, INTERNAL, tryConvertToPromise, apiRejection);
_dereq_("./bind.js")(Promise, INTERNAL, tryConvertToPromise);
_dereq_("./finally.js")(Promise, NEXT_FILTER, tryConvertToPromise);
_dereq_("./direct_resolve.js")(Promise);
_dereq_("./synchronous_inspection.js")(Promise);
_dereq_("./join.js")(Promise, PromiseArray, tryConvertToPromise, INTERNAL);
Promise.Promise = Promise;
_dereq_('./map.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL);
_dereq_('./cancel.js')(Promise);
_dereq_('./using.js')(Promise, apiRejection, tryConvertToPromise, createContext);
_dereq_('./generators.js')(Promise, apiRejection, INTERNAL, tryConvertToPromise);
_dereq_('./nodeify.js')(Promise);
_dereq_('./call_get.js')(Promise);
_dereq_('./props.js')(Promise, PromiseArray, tryConvertToPromise, apiRejection);
_dereq_('./race.js')(Promise, INTERNAL, tryConvertToPromise, apiRejection);
_dereq_('./reduce.js')(Promise, PromiseArray, apiRejection, tryConvertToPromise, INTERNAL);
_dereq_('./settle.js')(Promise, PromiseArray);
_dereq_('./some.js')(Promise, PromiseArray, apiRejection);
_dereq_('./promisify.js')(Promise, INTERNAL);
_dereq_('./any.js')(Promise);
_dereq_('./each.js')(Promise, INTERNAL);
_dereq_('./timers.js')(Promise, INTERNAL);
_dereq_('./filter.js')(Promise, INTERNAL);
                                                         
    util.toFastProperties(Promise);                                          
    util.toFastProperties(Promise.prototype);                                
    function fillTypes(value) {                                              
        var p = new Promise(INTERNAL);                                       
        p._fulfillmentHandler0 = value;                                      
        p._rejectionHandler0 = value;                                        
        p._progressHandler0 = value;                                         
        p._promise0 = value;                                                 
        p._receiver0 = value;                                                
        p._settledValue = value;                                             
    }                                                                        
    // Complete slack tracking, opt out of field-type tracking and           
    // stabilize map                                                         
    fillTypes({a: 1});                                                       
    fillTypes({b: 2});                                                       
    fillTypes({c: 3});                                                       
    fillTypes(1);                                                            
    fillTypes(function(){});                                                 
    fillTypes(undefined);                                                    
    fillTypes(false);                                                        
    fillTypes(new Promise(INTERNAL));                                        
    CapturedTrace.setBounds(async.firstLineError, util.lastLineError);       
    return Promise;                                                          

};

},{"./any.js":1,"./async.js":2,"./bind.js":3,"./call_get.js":5,"./cancel.js":6,"./captured_trace.js":7,"./catch_filter.js":8,"./context.js":9,"./debuggability.js":10,"./direct_resolve.js":11,"./each.js":12,"./errors.js":13,"./filter.js":15,"./finally.js":16,"./generators.js":17,"./join.js":18,"./map.js":19,"./method.js":20,"./nodeify.js":21,"./progress.js":22,"./promise_array.js":24,"./promise_resolver.js":25,"./promisify.js":26,"./props.js":27,"./race.js":29,"./reduce.js":30,"./settle.js":32,"./some.js":33,"./synchronous_inspection.js":34,"./thenables.js":35,"./timers.js":36,"./using.js":37,"./util.js":38}],24:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL, tryConvertToPromise,
    apiRejection) {
var util = _dereq_("./util.js");
var isArray = util.isArray;

function toResolutionValue(val) {
    switch(val) {
    case -2: return [];
    case -3: return {};
    }
}

function PromiseArray(values) {
    var promise = this._promise = new Promise(INTERNAL);
    var parent;
    if (values instanceof Promise) {
        parent = values;
        promise._propagateFrom(parent, 1 | 4);
    }
    this._values = values;
    this._length = 0;
    this._totalResolved = 0;
    this._init(undefined, -2);
}
PromiseArray.prototype.length = function () {
    return this._length;
};

PromiseArray.prototype.promise = function () {
    return this._promise;
};

PromiseArray.prototype._init = function init(_, resolveValueIfEmpty) {
    var values = tryConvertToPromise(this._values, this._promise);
    if (values instanceof Promise) {
        values = values._target();
        this._values = values;
        if (values._isFulfilled()) {
            values = values._value();
            if (!isArray(values)) {
                var err = new Promise.TypeError("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a");
                this.__hardReject__(err);
                return;
            }
        } else if (values._isPending()) {
            values._then(
                init,
                this._reject,
                undefined,
                this,
                resolveValueIfEmpty
           );
            return;
        } else {
            this._reject(values._reason());
            return;
        }
    } else if (!isArray(values)) {
        this._promise._reject(apiRejection("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a")._reason());
        return;
    }

    if (values.length === 0) {
        if (resolveValueIfEmpty === -5) {
            this._resolveEmptyArray();
        }
        else {
            this._resolve(toResolutionValue(resolveValueIfEmpty));
        }
        return;
    }
    var len = this.getActualLength(values.length);
    this._length = len;
    this._values = this.shouldCopyValues() ? new Array(len) : this._values;
    var promise = this._promise;
    for (var i = 0; i < len; ++i) {
        var isResolved = this._isResolved();
        var maybePromise = tryConvertToPromise(values[i], promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (isResolved) {
                maybePromise._ignoreRejections();
            } else if (maybePromise._isPending()) {
                maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise._isFulfilled()) {
                this._promiseFulfilled(maybePromise._value(), i);
            } else {
                this._promiseRejected(maybePromise._reason(), i);
            }
        } else if (!isResolved) {
            this._promiseFulfilled(maybePromise, i);
        }
    }
};

PromiseArray.prototype._isResolved = function () {
    return this._values === null;
};

PromiseArray.prototype._resolve = function (value) {
    this._values = null;
    this._promise._fulfill(value);
};

PromiseArray.prototype.__hardReject__ =
PromiseArray.prototype._reject = function (reason) {
    this._values = null;
    this._promise._rejectCallback(reason, false, true);
};

PromiseArray.prototype._promiseProgressed = function (progressValue, index) {
    this._promise._progress({
        index: index,
        value: progressValue
    });
};


PromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

PromiseArray.prototype._promiseRejected = function (reason, index) {
    this._totalResolved++;
    this._reject(reason);
};

PromiseArray.prototype.shouldCopyValues = function () {
    return true;
};

PromiseArray.prototype.getActualLength = function (len) {
    return len;
};

return PromiseArray;
};

},{"./util.js":38}],25:[function(_dereq_,module,exports){
"use strict";
var util = _dereq_("./util.js");
var maybeWrapAsError = util.maybeWrapAsError;
var errors = _dereq_("./errors.js");
var TimeoutError = errors.TimeoutError;
var OperationalError = errors.OperationalError;
var haveGetters = util.haveGetters;
var es5 = _dereq_("./es5.js");

function isUntypedError(obj) {
    return obj instanceof Error &&
        es5.getPrototypeOf(obj) === Error.prototype;
}

var rErrorKey = /^(?:name|message|stack|cause)$/;
function wrapAsOperationalError(obj) {
    var ret;
    if (isUntypedError(obj)) {
        ret = new OperationalError(obj);
        ret.name = obj.name;
        ret.message = obj.message;
        ret.stack = obj.stack;
        var keys = es5.keys(obj);
        for (var i = 0; i < keys.length; ++i) {
            var key = keys[i];
            if (!rErrorKey.test(key)) {
                ret[key] = obj[key];
            }
        }
        return ret;
    }
    util.markAsOriginatingFromRejection(obj);
    return obj;
}

function nodebackForPromise(promise) {
    return function(err, value) {
        if (promise === null) return;

        if (err) {
            var wrapped = wrapAsOperationalError(maybeWrapAsError(err));
            promise._attachExtraTrace(wrapped);
            promise._reject(wrapped);
        } else if (arguments.length > 2) {
            var $_len = arguments.length;var args = new Array($_len - 1); for(var $_i = 1; $_i < $_len; ++$_i) {args[$_i - 1] = arguments[$_i];}
            promise._fulfill(args);
        } else {
            promise._fulfill(value);
        }

        promise = null;
    };
}


var PromiseResolver;
if (!haveGetters) {
    PromiseResolver = function (promise) {
        this.promise = promise;
        this.asCallback = nodebackForPromise(promise);
        this.callback = this.asCallback;
    };
}
else {
    PromiseResolver = function (promise) {
        this.promise = promise;
    };
}
if (haveGetters) {
    var prop = {
        get: function() {
            return nodebackForPromise(this.promise);
        }
    };
    es5.defineProperty(PromiseResolver.prototype, "asCallback", prop);
    es5.defineProperty(PromiseResolver.prototype, "callback", prop);
}

PromiseResolver._nodebackForPromise = nodebackForPromise;

PromiseResolver.prototype.toString = function () {
    return "[object PromiseResolver]";
};

PromiseResolver.prototype.resolve =
PromiseResolver.prototype.fulfill = function (value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._resolveCallback(value);
};

PromiseResolver.prototype.reject = function (reason) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._rejectCallback(reason);
};

PromiseResolver.prototype.progress = function (value) {
    if (!(this instanceof PromiseResolver)) {
        throw new TypeError("Illegal invocation, resolver resolve/reject must be called within a resolver context. Consider using the promise constructor instead.\u000a\u000a    See http://goo.gl/sdkXL9\u000a");
    }
    this.promise._progress(value);
};

PromiseResolver.prototype.cancel = function (err) {
    this.promise.cancel(err);
};

PromiseResolver.prototype.timeout = function () {
    this.reject(new TimeoutError("timeout"));
};

PromiseResolver.prototype.isResolved = function () {
    return this.promise.isResolved();
};

PromiseResolver.prototype.toJSON = function () {
    return this.promise.toJSON();
};

module.exports = PromiseResolver;

},{"./errors.js":13,"./es5.js":14,"./util.js":38}],26:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var THIS = {};
var util = _dereq_("./util.js");
var nodebackForPromise = _dereq_("./promise_resolver.js")
    ._nodebackForPromise;
var withAppended = util.withAppended;
var maybeWrapAsError = util.maybeWrapAsError;
var canEvaluate = util.canEvaluate;
var TypeError = _dereq_("./errors").TypeError;
var defaultSuffix = "Async";
var defaultPromisified = {__isPromisified__: true};
var noCopyProps = [
    "arity",    "length",
    "name",
    "arguments",
    "caller",
    "callee",
    "prototype",
    "__isPromisified__"
];
var noCopyPropsPattern = new RegExp("^(?:" + noCopyProps.join("|") + ")$");

var defaultFilter = function(name) {
    return util.isIdentifier(name) &&
        name.charAt(0) !== "_" &&
        name !== "constructor";
};

function propsFilter(key) {
    return !noCopyPropsPattern.test(key);
}

function isPromisified(fn) {
    try {
        return fn.__isPromisified__ === true;
    }
    catch (e) {
        return false;
    }
}

function hasPromisified(obj, key, suffix) {
    var val = util.getDataPropertyOrDefault(obj, key + suffix,
                                            defaultPromisified);
    return val ? isPromisified(val) : false;
}
function checkValid(ret, suffix, suffixRegexp) {
    for (var i = 0; i < ret.length; i += 2) {
        var key = ret[i];
        if (suffixRegexp.test(key)) {
            var keyWithoutAsyncSuffix = key.replace(suffixRegexp, "");
            for (var j = 0; j < ret.length; j += 2) {
                if (ret[j] === keyWithoutAsyncSuffix) {
                    throw new TypeError("Cannot promisify an API that has normal methods with '%s'-suffix\u000a\u000a    See http://goo.gl/iWrZbw\u000a"
                        .replace("%s", suffix));
                }
            }
        }
    }
}

function promisifiableMethods(obj, suffix, suffixRegexp, filter) {
    var keys = util.inheritedDataKeys(obj);
    var ret = [];
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var value = obj[key];
        var passesDefaultFilter = filter === defaultFilter
            ? true : defaultFilter(key, value, obj);
        if (typeof value === "function" &&
            !isPromisified(value) &&
            !hasPromisified(obj, key, suffix) &&
            filter(key, value, obj, passesDefaultFilter)) {
            ret.push(key, value);
        }
    }
    checkValid(ret, suffix, suffixRegexp);
    return ret;
}

var escapeIdentRegex = function(str) {
    return str.replace(/([$])/, "\\$");
};

var makeNodePromisifiedEval;
if (!true) {
var switchCaseArgumentOrder = function(likelyArgumentCount) {
    var ret = [likelyArgumentCount];
    var min = Math.max(0, likelyArgumentCount - 1 - 3);
    for(var i = likelyArgumentCount - 1; i >= min; --i) {
        ret.push(i);
    }
    for(var i = likelyArgumentCount + 1; i <= 3; ++i) {
        ret.push(i);
    }
    return ret;
};

var argumentSequence = function(argumentCount) {
    return util.filledRange(argumentCount, "_arg", "");
};

var parameterDeclaration = function(parameterCount) {
    return util.filledRange(
        Math.max(parameterCount, 3), "_arg", "");
};

var parameterCount = function(fn) {
    if (typeof fn.length === "number") {
        return Math.max(Math.min(fn.length, 1023 + 1), 0);
    }
    return 0;
};

makeNodePromisifiedEval =
function(callback, receiver, originalName, fn) {
    var newParameterCount = Math.max(0, parameterCount(fn) - 1);
    var argumentOrder = switchCaseArgumentOrder(newParameterCount);
    var shouldProxyThis = typeof callback === "string" || receiver === THIS;

    function generateCallForArgumentCount(count) {
        var args = argumentSequence(count).join(", ");
        var comma = count > 0 ? ", " : "";
        var ret;
        if (shouldProxyThis) {
            ret = "ret = callback.call(this, {{args}}, nodeback); break;\n";
        } else {
            ret = receiver === undefined
                ? "ret = callback({{args}}, nodeback); break;\n"
                : "ret = callback.call(receiver, {{args}}, nodeback); break;\n";
        }
        return ret.replace("{{args}}", args).replace(", ", comma);
    }

    function generateArgumentSwitchCase() {
        var ret = "";
        for (var i = 0; i < argumentOrder.length; ++i) {
            ret += "case " + argumentOrder[i] +":" +
                generateCallForArgumentCount(argumentOrder[i]);
        }

        ret += "                                                             \n\
        default:                                                             \n\
            var args = new Array(len + 1);                                   \n\
            var i = 0;                                                       \n\
            for (var i = 0; i < len; ++i) {                                  \n\
               args[i] = arguments[i];                                       \n\
            }                                                                \n\
            args[i] = nodeback;                                              \n\
            [CodeForCall]                                                    \n\
            break;                                                           \n\
        ".replace("[CodeForCall]", (shouldProxyThis
                                ? "ret = callback.apply(this, args);\n"
                                : "ret = callback.apply(receiver, args);\n"));
        return ret;
    }

    var getFunctionCode = typeof callback === "string"
                                ? ("this != null ? this['"+callback+"'] : fn")
                                : "fn";

    return new Function("Promise",
                        "fn",
                        "receiver",
                        "withAppended",
                        "maybeWrapAsError",
                        "nodebackForPromise",
                        "tryCatch",
                        "errorObj",
                        "notEnumerableProp",
                        "INTERNAL","'use strict';                            \n\
        var ret = function (Parameters) {                                    \n\
            'use strict';                                                    \n\
            var len = arguments.length;                                      \n\
            var promise = new Promise(INTERNAL);                             \n\
            promise._captureStackTrace();                                    \n\
            var nodeback = nodebackForPromise(promise);                      \n\
            var ret;                                                         \n\
            var callback = tryCatch([GetFunctionCode]);                      \n\
            switch(len) {                                                    \n\
                [CodeForSwitchCase]                                          \n\
            }                                                                \n\
            if (ret === errorObj) {                                          \n\
                promise._rejectCallback(maybeWrapAsError(ret.e), true, true);\n\
            }                                                                \n\
            return promise;                                                  \n\
        };                                                                   \n\
        notEnumerableProp(ret, '__isPromisified__', true);                   \n\
        return ret;                                                          \n\
        "
        .replace("Parameters", parameterDeclaration(newParameterCount))
        .replace("[CodeForSwitchCase]", generateArgumentSwitchCase())
        .replace("[GetFunctionCode]", getFunctionCode))(
            Promise,
            fn,
            receiver,
            withAppended,
            maybeWrapAsError,
            nodebackForPromise,
            util.tryCatch,
            util.errorObj,
            util.notEnumerableProp,
            INTERNAL
        );
};
}

function makeNodePromisifiedClosure(callback, receiver, _, fn) {
    var defaultThis = (function() {return this;})();
    var method = callback;
    if (typeof method === "string") {
        callback = fn;
    }
    function promisified() {
        var _receiver = receiver;
        if (receiver === THIS) _receiver = this;
        var promise = new Promise(INTERNAL);
        promise._captureStackTrace();
        var cb = typeof method === "string" && this !== defaultThis
            ? this[method] : callback;
        var fn = nodebackForPromise(promise);
        try {
            cb.apply(_receiver, withAppended(arguments, fn));
        } catch(e) {
            promise._rejectCallback(maybeWrapAsError(e), true, true);
        }
        return promise;
    }
    util.notEnumerableProp(promisified, "__isPromisified__", true);
    return promisified;
}

var makeNodePromisified = canEvaluate
    ? makeNodePromisifiedEval
    : makeNodePromisifiedClosure;

function promisifyAll(obj, suffix, filter, promisifier) {
    var suffixRegexp = new RegExp(escapeIdentRegex(suffix) + "$");
    var methods =
        promisifiableMethods(obj, suffix, suffixRegexp, filter);

    for (var i = 0, len = methods.length; i < len; i+= 2) {
        var key = methods[i];
        var fn = methods[i+1];
        var promisifiedKey = key + suffix;
        obj[promisifiedKey] = promisifier === makeNodePromisified
                ? makeNodePromisified(key, THIS, key, fn, suffix)
                : promisifier(fn, function() {
                    return makeNodePromisified(key, THIS, key, fn, suffix);
                });
    }
    util.toFastProperties(obj);
    return obj;
}

function promisify(callback, receiver) {
    return makeNodePromisified(callback, receiver, undefined, callback);
}

Promise.promisify = function (fn, receiver) {
    if (typeof fn !== "function") {
        throw new TypeError("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    }
    if (isPromisified(fn)) {
        return fn;
    }
    var ret = promisify(fn, arguments.length < 2 ? THIS : receiver);
    util.copyDescriptors(fn, ret, propsFilter);
    return ret;
};

Promise.promisifyAll = function (target, options) {
    if (typeof target !== "function" && typeof target !== "object") {
        throw new TypeError("the target of promisifyAll must be an object or a function\u000a\u000a    See http://goo.gl/9ITlV0\u000a");
    }
    options = Object(options);
    var suffix = options.suffix;
    if (typeof suffix !== "string") suffix = defaultSuffix;
    var filter = options.filter;
    if (typeof filter !== "function") filter = defaultFilter;
    var promisifier = options.promisifier;
    if (typeof promisifier !== "function") promisifier = makeNodePromisified;

    if (!util.isIdentifier(suffix)) {
        throw new RangeError("suffix must be a valid identifier\u000a\u000a    See http://goo.gl/8FZo5V\u000a");
    }

    var keys = util.inheritedDataKeys(target);
    for (var i = 0; i < keys.length; ++i) {
        var value = target[keys[i]];
        if (keys[i] !== "constructor" &&
            util.isClass(value)) {
            promisifyAll(value.prototype, suffix, filter, promisifier);
            promisifyAll(value, suffix, filter, promisifier);
        }
    }

    return promisifyAll(target, suffix, filter, promisifier);
};
};


},{"./errors":13,"./promise_resolver.js":25,"./util.js":38}],27:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, PromiseArray, tryConvertToPromise, apiRejection) {
var util = _dereq_("./util.js");
var isObject = util.isObject;
var es5 = _dereq_("./es5.js");

function PropertiesPromiseArray(obj) {
    var keys = es5.keys(obj);
    var len = keys.length;
    var values = new Array(len * 2);
    for (var i = 0; i < len; ++i) {
        var key = keys[i];
        values[i] = obj[key];
        values[i + len] = key;
    }
    this.constructor$(values);
}
util.inherits(PropertiesPromiseArray, PromiseArray);

PropertiesPromiseArray.prototype._init = function () {
    this._init$(undefined, -3) ;
};

PropertiesPromiseArray.prototype._promiseFulfilled = function (value, index) {
    this._values[index] = value;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        var val = {};
        var keyOffset = this.length();
        for (var i = 0, len = this.length(); i < len; ++i) {
            val[this._values[i + keyOffset]] = this._values[i];
        }
        this._resolve(val);
    }
};

PropertiesPromiseArray.prototype._promiseProgressed = function (value, index) {
    this._promise._progress({
        key: this._values[index + this.length()],
        value: value
    });
};

PropertiesPromiseArray.prototype.shouldCopyValues = function () {
    return false;
};

PropertiesPromiseArray.prototype.getActualLength = function (len) {
    return len >> 1;
};

function props(promises) {
    var ret;
    var castValue = tryConvertToPromise(promises);

    if (!isObject(castValue)) {
        return apiRejection("cannot await properties of a non-object\u000a\u000a    See http://goo.gl/OsFKC8\u000a");
    } else if (castValue instanceof Promise) {
        ret = castValue._then(
            Promise.props, undefined, undefined, undefined, undefined);
    } else {
        ret = new PropertiesPromiseArray(castValue).promise();
    }

    if (castValue instanceof Promise) {
        ret._propagateFrom(castValue, 4);
    }
    return ret;
}

Promise.prototype.props = function () {
    return props(this);
};

Promise.props = function (promises) {
    return props(promises);
};
};

},{"./es5.js":14,"./util.js":38}],28:[function(_dereq_,module,exports){
"use strict";
function arrayMove(src, srcIndex, dst, dstIndex, len) {
    for (var j = 0; j < len; ++j) {
        dst[j + dstIndex] = src[j + srcIndex];
        src[j + srcIndex] = void 0;
    }
}

function Queue(capacity) {
    this._capacity = capacity;
    this._length = 0;
    this._front = 0;
}

Queue.prototype._willBeOverCapacity = function (size) {
    return this._capacity < size;
};

Queue.prototype._pushOne = function (arg) {
    var length = this.length();
    this._checkCapacity(length + 1);
    var i = (this._front + length) & (this._capacity - 1);
    this[i] = arg;
    this._length = length + 1;
};

Queue.prototype._unshiftOne = function(value) {
    var capacity = this._capacity;
    this._checkCapacity(this.length() + 1);
    var front = this._front;
    var i = (((( front - 1 ) &
                    ( capacity - 1) ) ^ capacity ) - capacity );
    this[i] = value;
    this._front = i;
    this._length = this.length() + 1;
};

Queue.prototype.unshift = function(fn, receiver, arg) {
    this._unshiftOne(arg);
    this._unshiftOne(receiver);
    this._unshiftOne(fn);
};

Queue.prototype.push = function (fn, receiver, arg) {
    var length = this.length() + 3;
    if (this._willBeOverCapacity(length)) {
        this._pushOne(fn);
        this._pushOne(receiver);
        this._pushOne(arg);
        return;
    }
    var j = this._front + length - 3;
    this._checkCapacity(length);
    var wrapMask = this._capacity - 1;
    this[(j + 0) & wrapMask] = fn;
    this[(j + 1) & wrapMask] = receiver;
    this[(j + 2) & wrapMask] = arg;
    this._length = length;
};

Queue.prototype.shift = function () {
    var front = this._front,
        ret = this[front];

    this[front] = undefined;
    this._front = (front + 1) & (this._capacity - 1);
    this._length--;
    return ret;
};

Queue.prototype.length = function () {
    return this._length;
};

Queue.prototype._checkCapacity = function (size) {
    if (this._capacity < size) {
        this._resizeTo(this._capacity << 1);
    }
};

Queue.prototype._resizeTo = function (capacity) {
    var oldCapacity = this._capacity;
    this._capacity = capacity;
    var front = this._front;
    var length = this._length;
    var moveItemsCount = (front + length) & (oldCapacity - 1);
    arrayMove(this, 0, this, oldCapacity, moveItemsCount);
};

module.exports = Queue;

},{}],29:[function(_dereq_,module,exports){
"use strict";
module.exports = function(
    Promise, INTERNAL, tryConvertToPromise, apiRejection) {
var isArray = _dereq_("./util.js").isArray;

var raceLater = function (promise) {
    return promise.then(function(array) {
        return race(array, promise);
    });
};

function race(promises, parent) {
    var maybePromise = tryConvertToPromise(promises);

    if (maybePromise instanceof Promise) {
        return raceLater(maybePromise);
    } else if (!isArray(promises)) {
        return apiRejection("expecting an array, a promise or a thenable\u000a\u000a    See http://goo.gl/s8MMhc\u000a");
    }

    var ret = new Promise(INTERNAL);
    if (parent !== undefined) {
        ret._propagateFrom(parent, 4 | 1);
    }
    var fulfill = ret._fulfill;
    var reject = ret._reject;
    for (var i = 0, len = promises.length; i < len; ++i) {
        var val = promises[i];

        if (val === undefined && !(i in promises)) {
            continue;
        }

        Promise.cast(val)._then(fulfill, reject, undefined, ret, null);
    }
    return ret;
}

Promise.race = function (promises) {
    return race(promises, undefined);
};

Promise.prototype.race = function () {
    return race(this, undefined);
};

};

},{"./util.js":38}],30:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise,
                          PromiseArray,
                          apiRejection,
                          tryConvertToPromise,
                          INTERNAL) {
var getDomain = Promise._getDomain;
var async = _dereq_("./async.js");
var util = _dereq_("./util.js");
var tryCatch = util.tryCatch;
var errorObj = util.errorObj;
function ReductionPromiseArray(promises, fn, accum, _each) {
    this.constructor$(promises);
    this._promise._captureStackTrace();
    this._preservedValues = _each === INTERNAL ? [] : null;
    this._zerothIsAccum = (accum === undefined);
    this._gotAccum = false;
    this._reducingIndex = (this._zerothIsAccum ? 1 : 0);
    this._valuesPhase = undefined;
    var maybePromise = tryConvertToPromise(accum, this._promise);
    var rejected = false;
    var isPromise = maybePromise instanceof Promise;
    if (isPromise) {
        maybePromise = maybePromise._target();
        if (maybePromise._isPending()) {
            maybePromise._proxyPromiseArray(this, -1);
        } else if (maybePromise._isFulfilled()) {
            accum = maybePromise._value();
            this._gotAccum = true;
        } else {
            this._reject(maybePromise._reason());
            rejected = true;
        }
    }
    if (!(isPromise || this._zerothIsAccum)) this._gotAccum = true;
    var domain = getDomain();
    this._callback = domain === null ? fn : domain.bind(fn);
    this._accum = accum;
    if (!rejected) async.invoke(init, this, undefined);
}
function init() {
    this._init$(undefined, -5);
}
util.inherits(ReductionPromiseArray, PromiseArray);

ReductionPromiseArray.prototype._init = function () {};

ReductionPromiseArray.prototype._resolveEmptyArray = function () {
    if (this._gotAccum || this._zerothIsAccum) {
        this._resolve(this._preservedValues !== null
                        ? [] : this._accum);
    }
};

ReductionPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var values = this._values;
    values[index] = value;
    var length = this.length();
    var preservedValues = this._preservedValues;
    var isEach = preservedValues !== null;
    var gotAccum = this._gotAccum;
    var valuesPhase = this._valuesPhase;
    var valuesPhaseIndex;
    if (!valuesPhase) {
        valuesPhase = this._valuesPhase = new Array(length);
        for (valuesPhaseIndex=0; valuesPhaseIndex<length; ++valuesPhaseIndex) {
            valuesPhase[valuesPhaseIndex] = 0;
        }
    }
    valuesPhaseIndex = valuesPhase[index];

    if (index === 0 && this._zerothIsAccum) {
        this._accum = value;
        this._gotAccum = gotAccum = true;
        valuesPhase[index] = ((valuesPhaseIndex === 0)
            ? 1 : 2);
    } else if (index === -1) {
        this._accum = value;
        this._gotAccum = gotAccum = true;
    } else {
        if (valuesPhaseIndex === 0) {
            valuesPhase[index] = 1;
        } else {
            valuesPhase[index] = 2;
            this._accum = value;
        }
    }
    if (!gotAccum) return;

    var callback = this._callback;
    var receiver = this._promise._boundValue();
    var ret;

    for (var i = this._reducingIndex; i < length; ++i) {
        valuesPhaseIndex = valuesPhase[i];
        if (valuesPhaseIndex === 2) {
            this._reducingIndex = i + 1;
            continue;
        }
        if (valuesPhaseIndex !== 1) return;
        value = values[i];
        this._promise._pushContext();
        if (isEach) {
            preservedValues.push(value);
            ret = tryCatch(callback).call(receiver, value, i, length);
        }
        else {
            ret = tryCatch(callback)
                .call(receiver, this._accum, value, i, length);
        }
        this._promise._popContext();

        if (ret === errorObj) return this._reject(ret.e);

        var maybePromise = tryConvertToPromise(ret, this._promise);
        if (maybePromise instanceof Promise) {
            maybePromise = maybePromise._target();
            if (maybePromise._isPending()) {
                valuesPhase[i] = 4;
                return maybePromise._proxyPromiseArray(this, i);
            } else if (maybePromise._isFulfilled()) {
                ret = maybePromise._value();
            } else {
                return this._reject(maybePromise._reason());
            }
        }

        this._reducingIndex = i + 1;
        this._accum = ret;
    }

    this._resolve(isEach ? preservedValues : this._accum);
};

function reduce(promises, fn, initialValue, _each) {
    if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
    var array = new ReductionPromiseArray(promises, fn, initialValue, _each);
    return array.promise();
}

Promise.prototype.reduce = function (fn, initialValue) {
    return reduce(this, fn, initialValue, null);
};

Promise.reduce = function (promises, fn, initialValue, _each) {
    return reduce(promises, fn, initialValue, _each);
};
};

},{"./async.js":2,"./util.js":38}],31:[function(_dereq_,module,exports){
"use strict";
var schedule;
var util = _dereq_("./util");
var noAsyncScheduler = function() {
    throw new Error("No async scheduler available\u000a\u000a    See http://goo.gl/m3OTXk\u000a");
};
if (util.isNode && typeof MutationObserver === "undefined") {
    var GlobalSetImmediate = global.setImmediate;
    var ProcessNextTick = process.nextTick;
    schedule = util.isRecentNode
                ? function(fn) { GlobalSetImmediate.call(global, fn); }
                : function(fn) { ProcessNextTick.call(process, fn); };
} else if ((typeof MutationObserver !== "undefined") &&
          !(typeof window !== "undefined" &&
            window.navigator &&
            window.navigator.standalone)) {
    schedule = function(fn) {
        var div = document.createElement("div");
        var observer = new MutationObserver(fn);
        observer.observe(div, {attributes: true});
        return function() { div.classList.toggle("foo"); };
    };
    schedule.isStatic = true;
} else if (typeof setImmediate !== "undefined") {
    schedule = function (fn) {
        setImmediate(fn);
    };
} else if (typeof setTimeout !== "undefined") {
    schedule = function (fn) {
        setTimeout(fn, 0);
    };
} else {
    schedule = noAsyncScheduler;
}
module.exports = schedule;

},{"./util":38}],32:[function(_dereq_,module,exports){
"use strict";
module.exports =
    function(Promise, PromiseArray) {
var PromiseInspection = Promise.PromiseInspection;
var util = _dereq_("./util.js");

function SettledPromiseArray(values) {
    this.constructor$(values);
}
util.inherits(SettledPromiseArray, PromiseArray);

SettledPromiseArray.prototype._promiseResolved = function (index, inspection) {
    this._values[index] = inspection;
    var totalResolved = ++this._totalResolved;
    if (totalResolved >= this._length) {
        this._resolve(this._values);
    }
};

SettledPromiseArray.prototype._promiseFulfilled = function (value, index) {
    var ret = new PromiseInspection();
    ret._bitField = 268435456;
    ret._settledValue = value;
    this._promiseResolved(index, ret);
};
SettledPromiseArray.prototype._promiseRejected = function (reason, index) {
    var ret = new PromiseInspection();
    ret._bitField = 134217728;
    ret._settledValue = reason;
    this._promiseResolved(index, ret);
};

Promise.settle = function (promises) {
    return new SettledPromiseArray(promises).promise();
};

Promise.prototype.settle = function () {
    return new SettledPromiseArray(this).promise();
};
};

},{"./util.js":38}],33:[function(_dereq_,module,exports){
"use strict";
module.exports =
function(Promise, PromiseArray, apiRejection) {
var util = _dereq_("./util.js");
var RangeError = _dereq_("./errors.js").RangeError;
var AggregateError = _dereq_("./errors.js").AggregateError;
var isArray = util.isArray;


function SomePromiseArray(values) {
    this.constructor$(values);
    this._howMany = 0;
    this._unwrap = false;
    this._initialized = false;
}
util.inherits(SomePromiseArray, PromiseArray);

SomePromiseArray.prototype._init = function () {
    if (!this._initialized) {
        return;
    }
    if (this._howMany === 0) {
        this._resolve([]);
        return;
    }
    this._init$(undefined, -5);
    var isArrayResolved = isArray(this._values);
    if (!this._isResolved() &&
        isArrayResolved &&
        this._howMany > this._canPossiblyFulfill()) {
        this._reject(this._getRangeError(this.length()));
    }
};

SomePromiseArray.prototype.init = function () {
    this._initialized = true;
    this._init();
};

SomePromiseArray.prototype.setUnwrap = function () {
    this._unwrap = true;
};

SomePromiseArray.prototype.howMany = function () {
    return this._howMany;
};

SomePromiseArray.prototype.setHowMany = function (count) {
    this._howMany = count;
};

SomePromiseArray.prototype._promiseFulfilled = function (value) {
    this._addFulfilled(value);
    if (this._fulfilled() === this.howMany()) {
        this._values.length = this.howMany();
        if (this.howMany() === 1 && this._unwrap) {
            this._resolve(this._values[0]);
        } else {
            this._resolve(this._values);
        }
    }

};
SomePromiseArray.prototype._promiseRejected = function (reason) {
    this._addRejected(reason);
    if (this.howMany() > this._canPossiblyFulfill()) {
        var e = new AggregateError();
        for (var i = this.length(); i < this._values.length; ++i) {
            e.push(this._values[i]);
        }
        this._reject(e);
    }
};

SomePromiseArray.prototype._fulfilled = function () {
    return this._totalResolved;
};

SomePromiseArray.prototype._rejected = function () {
    return this._values.length - this.length();
};

SomePromiseArray.prototype._addRejected = function (reason) {
    this._values.push(reason);
};

SomePromiseArray.prototype._addFulfilled = function (value) {
    this._values[this._totalResolved++] = value;
};

SomePromiseArray.prototype._canPossiblyFulfill = function () {
    return this.length() - this._rejected();
};

SomePromiseArray.prototype._getRangeError = function (count) {
    var message = "Input array must contain at least " +
            this._howMany + " items but contains only " + count + " items";
    return new RangeError(message);
};

SomePromiseArray.prototype._resolveEmptyArray = function () {
    this._reject(this._getRangeError(0));
};

function some(promises, howMany) {
    if ((howMany | 0) !== howMany || howMany < 0) {
        return apiRejection("expecting a positive integer\u000a\u000a    See http://goo.gl/1wAmHx\u000a");
    }
    var ret = new SomePromiseArray(promises);
    var promise = ret.promise();
    ret.setHowMany(howMany);
    ret.init();
    return promise;
}

Promise.some = function (promises, howMany) {
    return some(promises, howMany);
};

Promise.prototype.some = function (howMany) {
    return some(this, howMany);
};

Promise._SomePromiseArray = SomePromiseArray;
};

},{"./errors.js":13,"./util.js":38}],34:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise) {
function PromiseInspection(promise) {
    if (promise !== undefined) {
        promise = promise._target();
        this._bitField = promise._bitField;
        this._settledValue = promise._settledValue;
    }
    else {
        this._bitField = 0;
        this._settledValue = undefined;
    }
}

PromiseInspection.prototype.value = function () {
    if (!this.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/hc1DLj\u000a");
    }
    return this._settledValue;
};

PromiseInspection.prototype.error =
PromiseInspection.prototype.reason = function () {
    if (!this.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/hPuiwB\u000a");
    }
    return this._settledValue;
};

PromiseInspection.prototype.isFulfilled =
Promise.prototype._isFulfilled = function () {
    return (this._bitField & 268435456) > 0;
};

PromiseInspection.prototype.isRejected =
Promise.prototype._isRejected = function () {
    return (this._bitField & 134217728) > 0;
};

PromiseInspection.prototype.isPending =
Promise.prototype._isPending = function () {
    return (this._bitField & 402653184) === 0;
};

PromiseInspection.prototype.isResolved =
Promise.prototype._isResolved = function () {
    return (this._bitField & 402653184) > 0;
};

Promise.prototype.isPending = function() {
    return this._target()._isPending();
};

Promise.prototype.isRejected = function() {
    return this._target()._isRejected();
};

Promise.prototype.isFulfilled = function() {
    return this._target()._isFulfilled();
};

Promise.prototype.isResolved = function() {
    return this._target()._isResolved();
};

Promise.prototype._value = function() {
    return this._settledValue;
};

Promise.prototype._reason = function() {
    this._unsetRejectionIsUnhandled();
    return this._settledValue;
};

Promise.prototype.value = function() {
    var target = this._target();
    if (!target.isFulfilled()) {
        throw new TypeError("cannot get fulfillment value of a non-fulfilled promise\u000a\u000a    See http://goo.gl/hc1DLj\u000a");
    }
    return target._settledValue;
};

Promise.prototype.reason = function() {
    var target = this._target();
    if (!target.isRejected()) {
        throw new TypeError("cannot get rejection reason of a non-rejected promise\u000a\u000a    See http://goo.gl/hPuiwB\u000a");
    }
    target._unsetRejectionIsUnhandled();
    return target._settledValue;
};


Promise.PromiseInspection = PromiseInspection;
};

},{}],35:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var errorObj = util.errorObj;
var isObject = util.isObject;

function tryConvertToPromise(obj, context) {
    if (isObject(obj)) {
        if (obj instanceof Promise) {
            return obj;
        }
        else if (isAnyBluebirdPromise(obj)) {
            var ret = new Promise(INTERNAL);
            obj._then(
                ret._fulfillUnchecked,
                ret._rejectUncheckedCheckError,
                ret._progressUnchecked,
                ret,
                null
            );
            return ret;
        }
        var then = util.tryCatch(getThen)(obj);
        if (then === errorObj) {
            if (context) context._pushContext();
            var ret = Promise.reject(then.e);
            if (context) context._popContext();
            return ret;
        } else if (typeof then === "function") {
            return doThenable(obj, then, context);
        }
    }
    return obj;
}

function getThen(obj) {
    return obj.then;
}

var hasProp = {}.hasOwnProperty;
function isAnyBluebirdPromise(obj) {
    return hasProp.call(obj, "_promise0");
}

function doThenable(x, then, context) {
    var promise = new Promise(INTERNAL);
    var ret = promise;
    if (context) context._pushContext();
    promise._captureStackTrace();
    if (context) context._popContext();
    var synchronous = true;
    var result = util.tryCatch(then).call(x,
                                        resolveFromThenable,
                                        rejectFromThenable,
                                        progressFromThenable);
    synchronous = false;
    if (promise && result === errorObj) {
        promise._rejectCallback(result.e, true, true);
        promise = null;
    }

    function resolveFromThenable(value) {
        if (!promise) return;
        promise._resolveCallback(value);
        promise = null;
    }

    function rejectFromThenable(reason) {
        if (!promise) return;
        promise._rejectCallback(reason, synchronous, true);
        promise = null;
    }

    function progressFromThenable(value) {
        if (!promise) return;
        if (typeof promise._progress === "function") {
            promise._progress(value);
        }
    }
    return ret;
}

return tryConvertToPromise;
};

},{"./util.js":38}],36:[function(_dereq_,module,exports){
"use strict";
module.exports = function(Promise, INTERNAL) {
var util = _dereq_("./util.js");
var TimeoutError = Promise.TimeoutError;

var afterTimeout = function (promise, message) {
    if (!promise.isPending()) return;
    if (typeof message !== "string") {
        message = "operation timed out";
    }
    var err = new TimeoutError(message);
    util.markAsOriginatingFromRejection(err);
    promise._attachExtraTrace(err);
    promise._cancel(err);
};

var afterValue = function(value) { return delay(+this).thenReturn(value); };
var delay = Promise.delay = function (value, ms) {
    if (ms === undefined) {
        ms = value;
        value = undefined;
        var ret = new Promise(INTERNAL);
        setTimeout(function() { ret._fulfill(); }, ms);
        return ret;
    }
    ms = +ms;
    return Promise.resolve(value)._then(afterValue, null, null, ms, undefined);
};

Promise.prototype.delay = function (ms) {
    return delay(this, ms);
};

function successClear(value) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    return value;
}

function failureClear(reason) {
    var handle = this;
    if (handle instanceof Number) handle = +handle;
    clearTimeout(handle);
    throw reason;
}

Promise.prototype.timeout = function (ms, message) {
    ms = +ms;
    var ret = this.then().cancellable();
    ret._cancellationParent = this;
    var handle = setTimeout(function timeoutTimeout() {
        afterTimeout(ret, message);
    }, ms);
    return ret._then(successClear, failureClear, undefined, handle, undefined);
};

};

},{"./util.js":38}],37:[function(_dereq_,module,exports){
"use strict";
module.exports = function (Promise, apiRejection, tryConvertToPromise,
    createContext) {
    var TypeError = _dereq_("./errors.js").TypeError;
    var inherits = _dereq_("./util.js").inherits;
    var PromiseInspection = Promise.PromiseInspection;

    function inspectionMapper(inspections) {
        var len = inspections.length;
        for (var i = 0; i < len; ++i) {
            var inspection = inspections[i];
            if (inspection.isRejected()) {
                return Promise.reject(inspection.error());
            }
            inspections[i] = inspection._settledValue;
        }
        return inspections;
    }

    function thrower(e) {
        setTimeout(function(){throw e;}, 0);
    }

    function castPreservingDisposable(thenable) {
        var maybePromise = tryConvertToPromise(thenable);
        if (maybePromise !== thenable &&
            typeof thenable._isDisposable === "function" &&
            typeof thenable._getDisposer === "function" &&
            thenable._isDisposable()) {
            maybePromise._setDisposable(thenable._getDisposer());
        }
        return maybePromise;
    }
    function dispose(resources, inspection) {
        var i = 0;
        var len = resources.length;
        var ret = Promise.defer();
        function iterator() {
            if (i >= len) return ret.resolve();
            var maybePromise = castPreservingDisposable(resources[i++]);
            if (maybePromise instanceof Promise &&
                maybePromise._isDisposable()) {
                try {
                    maybePromise = tryConvertToPromise(
                        maybePromise._getDisposer().tryDispose(inspection),
                        resources.promise);
                } catch (e) {
                    return thrower(e);
                }
                if (maybePromise instanceof Promise) {
                    return maybePromise._then(iterator, thrower,
                                              null, null, null);
                }
            }
            iterator();
        }
        iterator();
        return ret.promise;
    }

    function disposerSuccess(value) {
        var inspection = new PromiseInspection();
        inspection._settledValue = value;
        inspection._bitField = 268435456;
        return dispose(this, inspection).thenReturn(value);
    }

    function disposerFail(reason) {
        var inspection = new PromiseInspection();
        inspection._settledValue = reason;
        inspection._bitField = 134217728;
        return dispose(this, inspection).thenThrow(reason);
    }

    function Disposer(data, promise, context) {
        this._data = data;
        this._promise = promise;
        this._context = context;
    }

    Disposer.prototype.data = function () {
        return this._data;
    };

    Disposer.prototype.promise = function () {
        return this._promise;
    };

    Disposer.prototype.resource = function () {
        if (this.promise().isFulfilled()) {
            return this.promise().value();
        }
        return null;
    };

    Disposer.prototype.tryDispose = function(inspection) {
        var resource = this.resource();
        var context = this._context;
        if (context !== undefined) context._pushContext();
        var ret = resource !== null
            ? this.doDispose(resource, inspection) : null;
        if (context !== undefined) context._popContext();
        this._promise._unsetDisposable();
        this._data = null;
        return ret;
    };

    Disposer.isDisposer = function (d) {
        return (d != null &&
                typeof d.resource === "function" &&
                typeof d.tryDispose === "function");
    };

    function FunctionDisposer(fn, promise, context) {
        this.constructor$(fn, promise, context);
    }
    inherits(FunctionDisposer, Disposer);

    FunctionDisposer.prototype.doDispose = function (resource, inspection) {
        var fn = this.data();
        return fn.call(resource, resource, inspection);
    };

    function maybeUnwrapDisposer(value) {
        if (Disposer.isDisposer(value)) {
            this.resources[this.index]._setDisposable(value);
            return value.promise();
        }
        return value;
    }

    Promise.using = function () {
        var len = arguments.length;
        if (len < 2) return apiRejection(
                        "you must pass at least 2 arguments to Promise.using");
        var fn = arguments[len - 1];
        if (typeof fn !== "function") return apiRejection("fn must be a function\u000a\u000a    See http://goo.gl/916lJJ\u000a");
        len--;
        var resources = new Array(len);
        for (var i = 0; i < len; ++i) {
            var resource = arguments[i];
            if (Disposer.isDisposer(resource)) {
                var disposer = resource;
                resource = resource.promise();
                resource._setDisposable(disposer);
            } else {
                var maybePromise = tryConvertToPromise(resource);
                if (maybePromise instanceof Promise) {
                    resource =
                        maybePromise._then(maybeUnwrapDisposer, null, null, {
                            resources: resources,
                            index: i
                    }, undefined);
                }
            }
            resources[i] = resource;
        }

        var promise = Promise.settle(resources)
            .then(inspectionMapper)
            .then(function(vals) {
                promise._pushContext();
                var ret;
                try {
                    ret = fn.apply(undefined, vals);
                } finally {
                    promise._popContext();
                }
                return ret;
            })
            ._then(
                disposerSuccess, disposerFail, undefined, resources, undefined);
        resources.promise = promise;
        return promise;
    };

    Promise.prototype._setDisposable = function (disposer) {
        this._bitField = this._bitField | 262144;
        this._disposer = disposer;
    };

    Promise.prototype._isDisposable = function () {
        return (this._bitField & 262144) > 0;
    };

    Promise.prototype._getDisposer = function () {
        return this._disposer;
    };

    Promise.prototype._unsetDisposable = function () {
        this._bitField = this._bitField & (~262144);
        this._disposer = undefined;
    };

    Promise.prototype.disposer = function (fn) {
        if (typeof fn === "function") {
            return new FunctionDisposer(fn, this, createContext());
        }
        throw new TypeError();
    };

};

},{"./errors.js":13,"./util.js":38}],38:[function(_dereq_,module,exports){
"use strict";
var es5 = _dereq_("./es5.js");
var canEvaluate = typeof navigator == "undefined";
var haveGetters = (function(){
    try {
        var o = {};
        es5.defineProperty(o, "f", {
            get: function () {
                return 3;
            }
        });
        return o.f === 3;
    }
    catch (e) {
        return false;
    }

})();

var errorObj = {e: {}};
var tryCatchTarget;
function tryCatcher() {
    try {
        var target = tryCatchTarget;
        tryCatchTarget = null;
        return target.apply(this, arguments);
    } catch (e) {
        errorObj.e = e;
        return errorObj;
    }
}
function tryCatch(fn) {
    tryCatchTarget = fn;
    return tryCatcher;
}

var inherits = function(Child, Parent) {
    var hasProp = {}.hasOwnProperty;

    function T() {
        this.constructor = Child;
        this.constructor$ = Parent;
        for (var propertyName in Parent.prototype) {
            if (hasProp.call(Parent.prototype, propertyName) &&
                propertyName.charAt(propertyName.length-1) !== "$"
           ) {
                this[propertyName + "$"] = Parent.prototype[propertyName];
            }
        }
    }
    T.prototype = Parent.prototype;
    Child.prototype = new T();
    return Child.prototype;
};


function isPrimitive(val) {
    return val == null || val === true || val === false ||
        typeof val === "string" || typeof val === "number";

}

function isObject(value) {
    return !isPrimitive(value);
}

function maybeWrapAsError(maybeError) {
    if (!isPrimitive(maybeError)) return maybeError;

    return new Error(safeToString(maybeError));
}

function withAppended(target, appendee) {
    var len = target.length;
    var ret = new Array(len + 1);
    var i;
    for (i = 0; i < len; ++i) {
        ret[i] = target[i];
    }
    ret[i] = appendee;
    return ret;
}

function getDataPropertyOrDefault(obj, key, defaultValue) {
    if (es5.isES5) {
        var desc = Object.getOwnPropertyDescriptor(obj, key);

        if (desc != null) {
            return desc.get == null && desc.set == null
                    ? desc.value
                    : defaultValue;
        }
    } else {
        return {}.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
    }
}

function notEnumerableProp(obj, name, value) {
    if (isPrimitive(obj)) return obj;
    var descriptor = {
        value: value,
        configurable: true,
        enumerable: false,
        writable: true
    };
    es5.defineProperty(obj, name, descriptor);
    return obj;
}

function thrower(r) {
    throw r;
}

var inheritedDataKeys = (function() {
    var excludedPrototypes = [
        Array.prototype,
        Object.prototype,
        Function.prototype
    ];

    var isExcludedProto = function(val) {
        for (var i = 0; i < excludedPrototypes.length; ++i) {
            if (excludedPrototypes[i] === val) {
                return true;
            }
        }
        return false;
    };

    if (es5.isES5) {
        var getKeys = Object.getOwnPropertyNames;
        return function(obj) {
            var ret = [];
            var visitedKeys = Object.create(null);
            while (obj != null && !isExcludedProto(obj)) {
                var keys;
                try {
                    keys = getKeys(obj);
                } catch (e) {
                    return ret;
                }
                for (var i = 0; i < keys.length; ++i) {
                    var key = keys[i];
                    if (visitedKeys[key]) continue;
                    visitedKeys[key] = true;
                    var desc = Object.getOwnPropertyDescriptor(obj, key);
                    if (desc != null && desc.get == null && desc.set == null) {
                        ret.push(key);
                    }
                }
                obj = es5.getPrototypeOf(obj);
            }
            return ret;
        };
    } else {
        var hasProp = {}.hasOwnProperty;
        return function(obj) {
            if (isExcludedProto(obj)) return [];
            var ret = [];

            /*jshint forin:false */
            enumeration: for (var key in obj) {
                if (hasProp.call(obj, key)) {
                    ret.push(key);
                } else {
                    for (var i = 0; i < excludedPrototypes.length; ++i) {
                        if (hasProp.call(excludedPrototypes[i], key)) {
                            continue enumeration;
                        }
                    }
                    ret.push(key);
                }
            }
            return ret;
        };
    }

})();

var thisAssignmentPattern = /this\s*\.\s*\S+\s*=/;
function isClass(fn) {
    try {
        if (typeof fn === "function") {
            var keys = es5.names(fn.prototype);

            var hasMethods = es5.isES5 && keys.length > 1;
            var hasMethodsOtherThanConstructor = keys.length > 0 &&
                !(keys.length === 1 && keys[0] === "constructor");
            var hasThisAssignmentAndStaticMethods =
                thisAssignmentPattern.test(fn + "") && es5.names(fn).length > 0;

            if (hasMethods || hasMethodsOtherThanConstructor ||
                hasThisAssignmentAndStaticMethods) {
                return true;
            }
        }
        return false;
    } catch (e) {
        return false;
    }
}

function toFastProperties(obj) {
    /*jshint -W027,-W055,-W031*/
    function f() {}
    f.prototype = obj;
    var l = 8;
    while (l--) new f();
    return obj;
    eval(obj);
}

var rident = /^[a-z$_][a-z$_0-9]*$/i;
function isIdentifier(str) {
    return rident.test(str);
}

function filledRange(count, prefix, suffix) {
    var ret = new Array(count);
    for(var i = 0; i < count; ++i) {
        ret[i] = prefix + i + suffix;
    }
    return ret;
}

function safeToString(obj) {
    try {
        return obj + "";
    } catch (e) {
        return "[no string representation]";
    }
}

function markAsOriginatingFromRejection(e) {
    try {
        notEnumerableProp(e, "isOperational", true);
    }
    catch(ignore) {}
}

function originatesFromRejection(e) {
    if (e == null) return false;
    return ((e instanceof Error["__BluebirdErrorTypes__"].OperationalError) ||
        e["isOperational"] === true);
}

function canAttachTrace(obj) {
    return obj instanceof Error && es5.propertyIsWritable(obj, "stack");
}

var ensureErrorObject = (function() {
    if (!("stack" in new Error())) {
        return function(value) {
            if (canAttachTrace(value)) return value;
            try {throw new Error(safeToString(value));}
            catch(err) {return err;}
        };
    } else {
        return function(value) {
            if (canAttachTrace(value)) return value;
            return new Error(safeToString(value));
        };
    }
})();

function classString(obj) {
    return {}.toString.call(obj);
}

function copyDescriptors(from, to, filter) {
    var keys = es5.names(from);
    for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        if (filter(key)) {
            try {
                es5.defineProperty(to, key, es5.getDescriptor(from, key));
            } catch (ignore) {}
        }
    }
}

var ret = {
    isClass: isClass,
    isIdentifier: isIdentifier,
    inheritedDataKeys: inheritedDataKeys,
    getDataPropertyOrDefault: getDataPropertyOrDefault,
    thrower: thrower,
    isArray: es5.isArray,
    haveGetters: haveGetters,
    notEnumerableProp: notEnumerableProp,
    isPrimitive: isPrimitive,
    isObject: isObject,
    canEvaluate: canEvaluate,
    errorObj: errorObj,
    tryCatch: tryCatch,
    inherits: inherits,
    withAppended: withAppended,
    maybeWrapAsError: maybeWrapAsError,
    toFastProperties: toFastProperties,
    filledRange: filledRange,
    toString: safeToString,
    canAttachTrace: canAttachTrace,
    ensureErrorObject: ensureErrorObject,
    originatesFromRejection: originatesFromRejection,
    markAsOriginatingFromRejection: markAsOriginatingFromRejection,
    classString: classString,
    copyDescriptors: copyDescriptors,
    hasDevTools: typeof chrome !== "undefined" && chrome &&
                 typeof chrome.loadTimes === "function",
    isNode: typeof process !== "undefined" &&
        classString(process).toLowerCase() === "[object process]"
};
ret.isRecentNode = ret.isNode && (function() {
    var version = process.versions.node.split(".").map(Number);
    return (version[0] === 0 && version[1] > 10) || (version[0] > 0);
})();

if (ret.isNode) ret.toFastProperties(process);

try {throw new Error(); } catch (e) {ret.lastLineError = e;}
module.exports = ret;

},{"./es5.js":14}]},{},[4])(4)
});                    ;if (typeof window !== 'undefined' && window !== null) {                               window.P = window.Promise;                                                     } else if (typeof self !== 'undefined' && self !== null) {                             self.P = self.Promise;                                                         }

require=function t(e,n,r){function o(s,a){if(!n[s]){if(!e[s]){var u="function"==typeof require&&require;if(!a&&u)return u(s,!0);if(i)return i(s,!0);var c=new Error("Cannot find module '"+s+"'");throw c.code="MODULE_NOT_FOUND",c}var l=n[s]={exports:{}};e[s][0].call(l.exports,function(t){var n=e[s][1][t];return o(n?n:t)},l,l.exports,t,e,n,r)}return n[s].exports}for(var i="function"==typeof require&&require,s=0;s<r.length;s++)o(r[s]);return o}({1:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputAddress};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/address(\[([0-9]*)\])?/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],2:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputBool,this._outputFormatter=r.formatOutputBool};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bool(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],3:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputBytes,this._outputFormatter=r.formatOutputBytes};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bytes([0-9]{1,})(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){var e=t.match(/^bytes([0-9]*)/),n=parseInt(e[1]);return n*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],4:[function(t,e,n){var r=t("./formatters"),o=t("./address"),i=t("./bool"),s=t("./int"),a=t("./uint"),u=t("./dynamicbytes"),c=t("./string"),l=t("./real"),f=t("./ureal"),p=t("./bytes"),h=function(t){this._types=t};h.prototype._requireType=function(t){var e=this._types.filter(function(e){return e.isType(t)})[0];if(!e)throw Error("invalid solidity type!: "+t);return e},h.prototype.encodeParam=function(t,e){return this.encodeParams([t],[e])},h.prototype.encodeParams=function(t,e){var n=this.getSolidityTypes(t),r=n.map(function(n,r){return n.encode(e[r],t[r])}),o=n.reduce(function(e,n,r){return e+n.staticPartLength(t[r])},0),i=this.encodeMultiWithOffset(t,n,r,o);return i},h.prototype.encodeMultiWithOffset=function(t,e,n,o){var i="",s=this,a=function(n){return e[n].isDynamicArray(t[n])||e[n].isDynamicType(t[n])};return t.forEach(function(u,c){if(a(c)){i+=r.formatInputInt(o).encode();var l=s.encodeWithOffset(t[c],e[c],n[c],o);o+=l.length/2}else i+=s.encodeWithOffset(t[c],e[c],n[c],o)}),t.forEach(function(r,u){if(a(u)){var c=s.encodeWithOffset(t[u],e[u],n[u],o);o+=c.length/2,i+=c}}),i},h.prototype.encodeWithOffset=function(t,e,n,o){var i=this;return e.isDynamicArray(t)?function(){var s=e.nestedName(t),a=e.staticPartLength(s),u=n[0];return function(){var t=2;if(e.isDynamicArray(s))for(var i=1;i<n.length;i++)t+=+n[i-1][0]||0,u+=r.formatInputInt(o+i*a+32*t).encode()}(),function(){for(var t=0;t<n.length-1;t++){var r=u/2;u+=i.encodeWithOffset(s,e,n[t+1],o+r)}}(),u}():e.isStaticArray(t)?function(){var s=e.nestedName(t),a=e.staticPartLength(s),u="";return function(){var t=0;if(e.isDynamicArray(s))for(var i=0;i<n.length;i++)t+=+(n[i-1]||[])[0]||0,u+=r.formatInputInt(o+i*a+32*t).encode()}(),function(){for(var t=0;t<n.length;t++){var r=u/2;u+=i.encodeWithOffset(s,e,n[t],o+r)}}(),u}():n},h.prototype.decodeParam=function(t,e){return this.decodeParams([t],e)[0]},h.prototype.decodeParams=function(t,e){var n=this.getSolidityTypes(t),r=this.getOffsets(t,n);return n.map(function(n,o){return n.decode(e,r[o],t[o],o)})},h.prototype.getOffsets=function(t,e){for(var n=e.map(function(e,n){return e.staticPartLength(t[n])}),r=0;r<n.length;r++){var o=n[r-1]||0;n[r]+=o}return n.map(function(n,r){return n-e[r].staticPartLength(t[r])})},h.prototype.getSolidityTypes=function(t){var e=this;return t.map(function(t){return e._requireType(t)})};var m=new h([new o,new i,new s,new a,new u,new p,new c,new l,new f]);e.exports=m},{"./address":1,"./bool":2,"./bytes":3,"./dynamicbytes":5,"./formatters":6,"./int":7,"./real":9,"./string":10,"./uint":12,"./ureal":13}],5:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputDynamicBytes,this._outputFormatter=r.formatOutputDynamicBytes};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^bytes(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},i.prototype.isDynamicType=function(){return!0},e.exports=i},{"./formatters":6,"./type":11}],6:[function(t,e,n){var r=t("bignumber.js"),o=t("../utils/utils"),i=t("../utils/config"),s=t("./param"),a=function(t){r.config(i.ETH_BIGNUMBER_ROUNDING_MODE);var e=o.padLeft(o.toTwosComplement(t).round().toString(16),64);return new s(e)},u=function(t){var e=o.toHex(t).substr(2),n=Math.floor((e.length+63)/64);return e=o.padRight(e,64*n),new s(e)},c=function(t){var e=o.toHex(t).substr(2),n=e.length/2,r=Math.floor((e.length+63)/64);return e=o.padRight(e,64*r),new s(a(n).value+e)},l=function(t){var e=o.fromAscii(t).substr(2),n=e.length/2,r=Math.floor((e.length+63)/64);return e=o.padRight(e,64*r),new s(a(n).value+e)},f=function(t){var e="000000000000000000000000000000000000000000000000000000000000000"+(t?"1":"0");return new s(e)},p=function(t){return a(new r(t).times(new r(2).pow(128)))},h=function(t){return"1"===new r(t.substr(0,1),16).toString(2).substr(0,1)},m=function(t){var e=t.staticPart()||"0";return h(e)?new r(e,16).minus(new r("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16)).minus(1):new r(e,16)},d=function(t){var e=t.staticPart()||"0";return new r(e,16)},y=function(t){return m(t).dividedBy(new r(2).pow(128))},g=function(t){return d(t).dividedBy(new r(2).pow(128))},v=function(t){return"0000000000000000000000000000000000000000000000000000000000000001"===t.staticPart()?!0:!1},b=function(t){return"0x"+t.staticPart()},w=function(t){var e=2*new r(t.dynamicPart().slice(0,64),16).toNumber();return"0x"+t.dynamicPart().substr(64,e)},_=function(t){var e=2*new r(t.dynamicPart().slice(0,64),16).toNumber();return o.toAscii(t.dynamicPart().substr(64,e))},x=function(t){var e=t.staticPart();return"0x"+e.slice(e.length-40,e.length)};e.exports={formatInputInt:a,formatInputBytes:u,formatInputDynamicBytes:c,formatInputString:l,formatInputBool:f,formatInputReal:p,formatOutputInt:m,formatOutputUInt:d,formatOutputReal:y,formatOutputUReal:g,formatOutputBool:v,formatOutputBytes:b,formatOutputDynamicBytes:w,formatOutputString:_,formatOutputAddress:x}},{"../utils/config":14,"../utils/utils":16,"./param":8,"bignumber.js":"bignumber.js"}],7:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputInt};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^int([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],8:[function(t,e,n){var r=t("../utils/utils"),o=function(t,e){this.value=t||"",this.offset=e};o.prototype.dynamicPartLength=function(){return this.dynamicPart().length/2},o.prototype.withOffset=function(t){return new o(this.value,t)},o.prototype.combine=function(t){return new o(this.value+t.value)},o.prototype.isDynamic=function(){return void 0!==this.offset},o.prototype.offsetAsBytes=function(){return this.isDynamic()?r.padLeft(r.toTwosComplement(this.offset).toString(16),64):""},o.prototype.staticPart=function(){return this.isDynamic()?this.offsetAsBytes():this.value},o.prototype.dynamicPart=function(){return this.isDynamic()?this.value:""},o.prototype.encode=function(){return this.staticPart()+this.dynamicPart()},o.encodeList=function(t){var e=32*t.length,n=t.map(function(t){if(!t.isDynamic())return t;var n=e;return e+=t.dynamicPartLength(),t.withOffset(n)});return n.reduce(function(t,e){return t+e.dynamicPart()},n.reduce(function(t,e){return t+e.staticPart()},""))},e.exports=o},{"../utils/utils":16}],9:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputReal,this._outputFormatter=r.formatOutputReal};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/real([0-9]*)?(\[([0-9]*)\])?/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],10:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputString,this._outputFormatter=r.formatOutputString};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^string(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},i.prototype.isDynamicType=function(){return!0},e.exports=i},{"./formatters":6,"./type":11}],11:[function(t,e,n){var r=t("./formatters"),o=t("./param"),i=function(t){this._inputFormatter=t.inputFormatter,this._outputFormatter=t.outputFormatter};i.prototype.isType=function(t){throw"this method should be overrwritten for type "+t},i.prototype.staticPartLength=function(t){throw"this method should be overrwritten for type: "+t},i.prototype.isDynamicArray=function(t){var e=this.nestedTypes(t);return!!e&&!e[e.length-1].match(/[0-9]{1,}/g)},i.prototype.isStaticArray=function(t){var e=this.nestedTypes(t);return!!e&&!!e[e.length-1].match(/[0-9]{1,}/g)},i.prototype.staticArrayLength=function(t){var e=this.nestedTypes(t);return e?parseInt(e[e.length-1].match(/[0-9]{1,}/g)||1):1},i.prototype.nestedName=function(t){var e=this.nestedTypes(t);return e?t.substr(0,t.length-e[e.length-1].length):t},i.prototype.isDynamicType=function(){return!1},i.prototype.nestedTypes=function(t){return t.match(/(\[[0-9]*\])/g)},i.prototype.encode=function(t,e){var n=this;return this.isDynamicArray(e)?function(){var o=t.length,i=n.nestedName(e),s=[];return s.push(r.formatInputInt(o).encode()),t.forEach(function(t){s.push(n.encode(t,i))}),s}():this.isStaticArray(e)?function(){for(var r=n.staticArrayLength(e),o=n.nestedName(e),i=[],s=0;r>s;s++)i.push(n.encode(t[s],o));return i}():this._inputFormatter(t,e).encode()},i.prototype.decode=function(t,e,n){var r=this;if(this.isDynamicArray(n))return function(){for(var o=parseInt("0x"+t.substr(2*e,64)),i=parseInt("0x"+t.substr(2*o,64)),s=o+32,a=r.nestedName(n),u=r.staticPartLength(a),c=[],l=0;i*u>l;l+=u)c.push(r.decode(t,s+l,a));return c}();if(this.isStaticArray(n))return function(){for(var o=r.staticArrayLength(n),i=e,s=r.nestedName(n),a=r.staticPartLength(s),u=[],c=0;o*a>c;c+=a)u.push(r.decode(t,i+c,s));return u}();if(this.isDynamicType(n))return function(){var n=parseInt("0x"+t.substr(2*e,64)),i=parseInt("0x"+t.substr(2*n,64)),s=Math.floor((i+31)/32);return r._outputFormatter(new o(t.substr(2*n,64*(1+s)),0))}();var i=this.staticPartLength(n);return this._outputFormatter(new o(t.substr(2*e,2*i)))},e.exports=i},{"./formatters":6,"./param":8}],12:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputInt,this._outputFormatter=r.formatOutputInt};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^uint([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],13:[function(t,e,n){var r=t("./formatters"),o=t("./type"),i=function(){this._inputFormatter=r.formatInputReal,this._outputFormatter=r.formatOutputUReal};i.prototype=new o({}),i.prototype.constructor=i,i.prototype.isType=function(t){return!!t.match(/^ureal([0-9]*)?(\[([0-9]*)\])*$/)},i.prototype.staticPartLength=function(t){return 32*this.staticArrayLength(t)},e.exports=i},{"./formatters":6,"./type":11}],14:[function(t,e,n){var r=t("bignumber.js"),o=["wei","kwei","Mwei","Gwei","szabo","finney","femtoether","picoether","nanoether","microether","milliether","nano","micro","milli","ether","grand","Mether","Gether","Tether","Pether","Eether","Zether","Yether","Nether","Dether","Vether","Uether"];e.exports={ETH_PADDING:32,ETH_SIGNATURE_LENGTH:4,ETH_UNITS:o,ETH_BIGNUMBER_ROUNDING_MODE:{ROUNDING_MODE:r.ROUND_DOWN},ETH_POLLING_TIMEOUT:500,defaultBlock:"latest",defaultAccount:void 0}},{"bignumber.js":"bignumber.js"}],15:[function(t,e,n){var r=t("./utils"),o=t("crypto-js/sha3");e.exports=function(t,e){return"0x"!==t.substr(0,2)||e||(console.warn("requirement of using web3.fromAscii before sha3 is deprecated"),console.warn("new usage: 'web3.sha3(\"hello\")'"),console.warn("see https://github.com/ethereum/web3.js/pull/205"),console.warn("if you need to hash hex value, you can do 'sha3(\"0xfff\", true)'"),t=r.toAscii(t)),o(t,{outputLength:256}).toString()}},{"./utils":16,"crypto-js/sha3":43}],16:[function(t,e,n){var r=t("bignumber.js"),o={wei:"1",kwei:"1000",ada:"1000",femtoether:"1000",mwei:"1000000",babbage:"1000000",picoether:"1000000",gwei:"1000000000",shannon:"1000000000",nanoether:"1000000000",nano:"1000000000",szabo:"1000000000000",microether:"1000000000000",micro:"1000000000000",finney:"1000000000000000",milliether:"1000000000000000",milli:"1000000000000000",ether:"1000000000000000000",kether:"1000000000000000000000",grand:"1000000000000000000000",einstein:"1000000000000000000000",mether:"1000000000000000000000000",gether:"1000000000000000000000000000",tether:"1000000000000000000000000000000"},i=function(t,e,n){return new Array(e-t.length+1).join(n?n:"0")+t},s=function(t,e,n){return t+new Array(e-t.length+1).join(n?n:"0")},a=function(t){var e="",n=0,r=t.length;for("0x"===t.substring(0,2)&&(n=2);r>n;n+=2){var o=parseInt(t.substr(n,2),16);e+=String.fromCharCode(o)}return decodeURIComponent(escape(e))},u=function(t){t=unescape(encodeURIComponent(t));for(var e="",n=0;n<t.length;n++){var r=t.charCodeAt(n).toString(16);e+=r.length<2?"0"+r:r}return e},c=function(t,e){e=void 0===e?0:e;for(var n=u(t);n.length<2*e;)n+="00";return"0x"+n},l=function(t){if(-1!==t.name.indexOf("("))return t.name;var e=t.inputs.map(function(t){return t.type}).join();return t.name+"("+e+")"},f=function(t){var e=t.indexOf("(");return-1!==e?t.substr(0,e):t},p=function(t){var e=t.indexOf("(");return-1!==e?t.substr(e+1,t.length-1-(e+1)).replace(" ",""):""},h=function(t){return b(t).toNumber()},m=function(t){var e=b(t),n=e.toString(16);return e.lessThan(0)?"-0x"+n.substr(1):"0x"+n},d=function(t){if(O(t))return m(+t);if(F(t))return m(t);if(T(t))return c(JSON.stringify(t));if(k(t)){if(0===t.indexOf("-0x"))return m(t);if(0===t.indexOf("0x"))return t;if(!isFinite(t))return c(t)}return m(t)},y=function(t){t=t?t.toLowerCase():"ether";var e=o[t];if(void 0===e)throw new Error("This unit doesn't exists, please use the one of the following units"+JSON.stringify(o,null,2));return new r(e,10)},g=function(t,e){var n=b(t).dividedBy(y(e));return F(t)?n:n.toString(10)},v=function(t,e){var n=b(t).times(y(e));return F(t)?n:n.toString(10)},b=function(t){return t=t||0,F(t)?t:!k(t)||0!==t.indexOf("0x")&&0!==t.indexOf("-0x")?new r(t.toString(10),10):new r(t.replace("0x",""),16)},w=function(t){var e=b(t);return e.lessThan(0)?new r("ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",16).plus(e).plus(1):e},_=function(t){return/^0x[0-9a-f]{40}$/.test(t)},x=function(t){return/^(0x)?[0-9a-f]{40}$/.test(t)},I=function(t){return _(t)?t:/^[0-9a-f]{40}$/.test(t)?"0x"+t:"0x"+i(d(t).substr(2),40)},F=function(t){return t instanceof r||t&&t.constructor&&"BigNumber"===t.constructor.name},k=function(t){return"string"==typeof t||t&&t.constructor&&"String"===t.constructor.name},N=function(t){return"function"==typeof t},T=function(t){return"object"==typeof t},O=function(t){return"boolean"==typeof t},A=function(t){return t instanceof Array},B=function(t){try{return!!JSON.parse(t)}catch(e){return!1}},P=function(t){return/^XE[0-9]{2}(ETH[0-9A-Z]{13}|[0-9A-Z]{30})$/.test(t)};e.exports={padLeft:i,padRight:s,toHex:d,toDecimal:h,fromDecimal:m,toAscii:a,fromAscii:c,transformToFullName:l,extractDisplayName:f,extractTypeName:p,toWei:v,fromWei:g,toBigNumber:b,toTwosComplement:w,toAddress:I,isBigNumber:F,isStrictAddress:_,isAddress:x,isFunction:N,isString:k,isObject:T,isBoolean:O,isArray:A,isJson:B,isIBAN:P}},{"bignumber.js":"bignumber.js"}],17:[function(t,e,n){e.exports={version:"0.10.0"}},{}],18:[function(t,e,n){var r=t("./version.json"),o=t("./web3/net"),i=t("./web3/eth"),s=t("./web3/db"),a=t("./web3/shh"),u=t("./web3/watches"),c=t("./web3/filter"),l=t("./utils/utils"),f=t("./web3/formatters"),p=t("./web3/requestmanager"),h=t("./utils/config"),m=t("./web3/property"),d=t("./web3/batch"),y=t("./utils/sha3"),g=[new m({name:"version.client",getter:"web3_clientVersion"}),new m({name:"version.network",getter:"net_version",inputFormatter:l.toDecimal}),new m({name:"version.ethereum",getter:"eth_protocolVersion",inputFormatter:l.toDecimal}),new m({name:"version.whisper",getter:"shh_version",inputFormatter:l.toDecimal})],v=function(t,e){e.forEach(function(e){e.attachToObject(t)})},b=function(t,e){e.forEach(function(e){e.attachToObject(t)})},w={};w.providers={},w.currentProvider=null,w.version={},w.version.api=r.version,w.eth={},w.eth.filter=function(t,e){return new c(t,u.eth(),f.outputLogFormatter,e)},w.shh={},w.shh.filter=function(t,e){return new c(t,u.shh(),f.outputPostFormatter,e)},w.net={},w.db={},w.setProvider=function(t){this.currentProvider=t,p.getInstance().setProvider(t)},w.isConnected=function(){return this.currentProvider&&this.currentProvider.isConnected()},w.reset=function(){p.getInstance().reset(),h.defaultBlock="latest",h.defaultAccount=void 0},w.toHex=l.toHex,w.toAscii=l.toAscii,w.fromAscii=l.fromAscii,w.toDecimal=l.toDecimal,w.fromDecimal=l.fromDecimal,w.toBigNumber=l.toBigNumber,w.toWei=l.toWei,w.fromWei=l.fromWei,w.isAddress=l.isAddress,w.isIBAN=l.isIBAN,w.sha3=y,w.createBatch=function(){return new d},Object.defineProperty(w.eth,"defaultBlock",{get:function(){return h.defaultBlock},set:function(t){return h.defaultBlock=t,t}}),Object.defineProperty(w.eth,"defaultAccount",{get:function(){return h.defaultAccount},set:function(t){return h.defaultAccount=t,t}}),w._extend=function(t){t.property&&!w[t.property]&&(w[t.property]={}),v(w[t.property]||w,t.methods||[]),b(w[t.property]||w,t.properties||[])},w._extend.formatters=f,w._extend.utils=l,w._extend.Method=t("./web3/method"),w._extend.Property=t("./web3/property"),b(w,g),v(w.net,o.methods),b(w.net,o.properties),v(w.eth,i.methods),b(w.eth,i.properties),v(w.db,s.methods),v(w.shh,a.methods),e.exports=w},{"./utils/config":14,"./utils/sha3":15,"./utils/utils":16,"./version.json":17,"./web3/batch":20,"./web3/db":22,"./web3/eth":24,"./web3/filter":26,"./web3/formatters":27,"./web3/method":33,"./web3/net":35,"./web3/property":36,"./web3/requestmanager":37,"./web3/shh":38,"./web3/watches":40}],19:[function(t,e,n){var r=t("../utils/sha3"),o=t("./event"),i=t("./formatters"),s=t("../utils/utils"),a=t("./filter"),u=t("./watches"),c=function(t,e){this._json=t,this._address=e};c.prototype.encode=function(t){t=t||{};var e={};return["fromBlock","toBlock"].filter(function(e){return void 0!==t[e]}).forEach(function(n){e[n]=i.inputBlockNumberFormatter(t[n])}),e.address=this._address,e},c.prototype.decode=function(t){t.data=t.data||"",t.topics=t.topics||[];var e=t.topics[0].slice(2),n=this._json.filter(function(t){return e===r(s.transformToFullName(t))})[0];if(!n)return console.warn("cannot find event for log"),t;var i=new o(n,this._address);return i.decode(t)},c.prototype.execute=function(t,e){s.isFunction(arguments[arguments.length-1])&&(e=arguments[arguments.length-1],1===arguments.length&&(t=null));var n=this.encode(t),r=this.decode.bind(this);return new a(n,u.eth(),r,e)},c.prototype.attachToContract=function(t){var e=this.execute.bind(this);t.allEvents=e},e.exports=c},{"../utils/sha3":15,"../utils/utils":16,"./event":25,"./filter":26,"./formatters":27,"./watches":40}],20:[function(t,e,n){var r=t("./requestmanager"),o=t("./jsonrpc"),i=t("./errors"),s=function(){this.requests=[]};s.prototype.add=function(t){this.requests.push(t)},s.prototype.execute=function(){var t=this.requests;r.getInstance().sendBatch(t,function(e,n){n=n||[],t.map(function(t,e){return n[e]||{}}).forEach(function(e,n){if(t[n].callback){if(!o.getInstance().isValidResponse(e))return t[n].callback(i.InvalidResponse(e));t[n].callback(null,t[n].format?t[n].format(e.result):e.result)}})})},e.exports=s},{"./errors":23,"./jsonrpc":32,"./requestmanager":37}],21:[function(t,e,n){var r=t("../web3"),o=t("../utils/utils"),i=t("../solidity/coder"),s=t("./event"),a=t("./function"),u=t("./allevents"),c=function(t,e){return t.filter(function(t){return"constructor"===t.type&&t.inputs.length===e.length}).map(function(t){return t.inputs.map(function(t){return t.type})}).map(function(t){return i.encodeParams(t,e)})[0]||""},l=function(t,e){e.filter(function(t){return"function"===t.type}).map(function(e){return new a(e,t.address)}).forEach(function(e){e.attachToContract(t)})},f=function(t,e){var n=e.filter(function(t){return"event"===t.type}),r=new u(n,t.address);r.attachToContract(t),n.map(function(e){return new s(e,t.address)}).forEach(function(e){e.attachToContract(t)})},p=function(t){return new m(t)},h=function(t,e,n){var o=0,i=!1,s=r.eth.filter("latest",function(a){if(!a&&!i)if(o++,o>50){if(s.stopWatching(),i=!0,!n)throw new Error("Contract transaction couldn't be found after 50 blocks");n(new Error("Contract transaction couldn't be found after 50 blocks"))}else r.eth.getTransactionReceipt(t.transactionHash,function(o,a){a&&!i&&r.eth.getCode(a.contractAddress,function(r,o){if(!i)if(s.stopWatching(),i=!0,o.length>2)t.address=a.contractAddress,l(t,e),f(t,e),n&&n(null,t);else{if(!n)throw new Error("The contract code couldn't be stored, please check your gas amount.");n(new Error("The contract code couldn't be stored, please check your gas amount."))}})})})},m=function(t){this.abi=t};m.prototype["new"]=function(){var t,e=this,n=new d(this.abi),i={},s=Array.prototype.slice.call(arguments);o.isFunction(s[s.length-1])&&(t=s.pop());var a=s[s.length-1];o.isObject(a)&&!o.isArray(a)&&(i=s.pop());var u=c(this.abi,s);if(i.data+=u,t)r.eth.sendTransaction(i,function(r,o){r?t(r):(n.transactionHash=o,t(null,n),h(n,e.abi,t))});else{var l=r.eth.sendTransaction(i);n.transactionHash=l,h(n,e.abi)}return n},m.prototype.at=function(t,e){var n=new d(this.abi,t);return l(n,this.abi),f(n,this.abi),e&&e(null,n),n};var d=function(t,e){this.address=e};e.exports=p},{"../solidity/coder":4,"../utils/utils":16,"../web3":18,"./allevents":19,"./event":25,"./function":28}],22:[function(t,e,n){var r=t("./method"),o=new r({name:"putString",call:"db_putString",params:3}),i=new r({name:"getString",call:"db_getString",params:2}),s=new r({name:"putHex",call:"db_putHex",params:3}),a=new r({name:"getHex",call:"db_getHex",params:2}),u=[o,i,s,a];e.exports={methods:u}},{"./method":33}],23:[function(t,e,n){e.exports={InvalidNumberOfParams:function(){return new Error("Invalid number of input parameters")},InvalidConnection:function(t){return new Error("CONNECTION ERROR: Couldn't connect to node "+t+", is it running?")},InvalidProvider:function(){return new Error("Providor not set or invalid")},InvalidResponse:function(t){var e=t&&t.error&&t.error.message?t.error.message:"Invalid JSON RPC response: "+t;return new Error(e)}}},{}],24:[function(t,e,n){"use strict";var r=t("./formatters"),o=t("../utils/utils"),i=t("./method"),s=t("./property"),a=function(t){return o.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getBlockByHash":"eth_getBlockByNumber"},u=function(t){return o.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getTransactionByBlockHashAndIndex":"eth_getTransactionByBlockNumberAndIndex"},c=function(t){return o.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getUncleByBlockHashAndIndex":"eth_getUncleByBlockNumberAndIndex"},l=function(t){return o.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getBlockTransactionCountByHash":"eth_getBlockTransactionCountByNumber"},f=function(t){return o.isString(t[0])&&0===t[0].indexOf("0x")?"eth_getUncleCountByBlockHash":"eth_getUncleCountByBlockNumber"},p=new i({name:"getBalance",call:"eth_getBalance",params:2,inputFormatter:[o.toAddress,r.inputDefaultBlockNumberFormatter],outputFormatter:r.outputBigNumberFormatter}),h=new i({name:"getStorageAt",call:"eth_getStorageAt",params:3,inputFormatter:[null,o.toHex,r.inputDefaultBlockNumberFormatter]}),m=new i({name:"getCode",call:"eth_getCode",params:2,inputFormatter:[o.toAddress,r.inputDefaultBlockNumberFormatter]}),d=new i({name:"getBlock",call:a,params:2,inputFormatter:[r.inputBlockNumberFormatter,function(t){return!!t}],outputFormatter:r.outputBlockFormatter}),y=new i({name:"getUncle",call:c,params:2,inputFormatter:[r.inputBlockNumberFormatter,o.toHex],outputFormatter:r.outputBlockFormatter}),g=new i({name:"getCompilers",call:"eth_getCompilers",params:0}),v=new i({name:"getBlockTransactionCount",call:l,params:1,inputFormatter:[r.inputBlockNumberFormatter],outputFormatter:o.toDecimal}),b=new i({name:"getBlockUncleCount",call:f,params:1,inputFormatter:[r.inputBlockNumberFormatter],outputFormatter:o.toDecimal}),w=new i({name:"getTransaction",call:"eth_getTransactionByHash",params:1,outputFormatter:r.outputTransactionFormatter}),_=new i({name:"getTransactionFromBlock",call:u,params:2,inputFormatter:[r.inputBlockNumberFormatter,o.toHex],outputFormatter:r.outputTransactionFormatter}),x=new i({name:"getTransactionReceipt",call:"eth_getTransactionReceipt",params:1,outputFormatter:r.outputTransactionReceiptFormatter}),I=new i({name:"getTransactionCount",call:"eth_getTransactionCount",params:2,inputFormatter:[null,r.inputDefaultBlockNumberFormatter],outputFormatter:o.toDecimal}),F=new i({name:"sendRawTransaction",call:"eth_sendRawTransaction",params:1,inputFormatter:[null]}),k=new i({name:"sendTransaction",call:"eth_sendTransaction",params:1,inputFormatter:[r.inputTransactionFormatter]}),N=new i({name:"call",call:"eth_call",params:2,inputFormatter:[r.inputTransactionFormatter,r.inputDefaultBlockNumberFormatter]}),T=new i({name:"estimateGas",call:"eth_estimateGas",params:1,inputFormatter:[r.inputTransactionFormatter],outputFormatter:o.toDecimal}),O=new i({name:"compile.solidity",call:"eth_compileSolidity",params:1}),A=new i({name:"compile.lll",call:"eth_compileLLL",params:1}),B=new i({name:"compile.serpent",call:"eth_compileSerpent",params:1}),P=new i({name:"submitWork",call:"eth_submitWork",params:3}),S=new i({name:"getWork",call:"eth_getWork",params:0}),D=[p,h,m,d,y,g,v,b,w,_,x,I,N,T,F,k,O,A,B,P,S],C=[new s({name:"coinbase",getter:"eth_coinbase"}),new s({name:"mining",getter:"eth_mining"}),new s({name:"hashrate",getter:"eth_hashrate",outputFormatter:o.toDecimal}),new s({name:"gasPrice",getter:"eth_gasPrice",outputFormatter:r.outputBigNumberFormatter}),new s({name:"accounts",getter:"eth_accounts"}),new s({name:"blockNumber",getter:"eth_blockNumber",outputFormatter:o.toDecimal})];e.exports={methods:D,properties:C}},{"../utils/utils":16,"./formatters":27,"./method":33,"./property":36}],25:[function(t,e,n){var r=t("../utils/utils"),o=t("../solidity/coder"),i=t("./formatters"),s=t("../utils/sha3"),a=t("./filter"),u=t("./watches"),c=function(t,e){this._params=t.inputs,this._name=r.transformToFullName(t),this._address=e,this._anonymous=t.anonymous};c.prototype.types=function(t){return this._params.filter(function(e){return e.indexed===t}).map(function(t){return t.type})},c.prototype.displayName=function(){return r.extractDisplayName(this._name)},c.prototype.typeName=function(){return r.extractTypeName(this._name)},c.prototype.signature=function(){return s(this._name)},c.prototype.encode=function(t,e){t=t||{},e=e||{};var n={};["fromBlock","toBlock"].filter(function(t){return void 0!==e[t]}).forEach(function(t){n[t]=i.inputBlockNumberFormatter(e[t])}),n.topics=[],n.address=this._address,this._anonymous||n.topics.push("0x"+this.signature());var s=this._params.filter(function(t){return t.indexed===!0}).map(function(e){var n=t[e.name];return void 0===n||null===n?null:r.isArray(n)?n.map(function(t){return"0x"+o.encodeParam(e.type,t)}):"0x"+o.encodeParam(e.type,n)});return n.topics=n.topics.concat(s),n},c.prototype.decode=function(t){t.data=t.data||"",t.topics=t.topics||[];var e=this._anonymous?t.topics:t.topics.slice(1),n=e.map(function(t){return t.slice(2)}).join(""),r=o.decodeParams(this.types(!0),n),s=t.data.slice(2),a=o.decodeParams(this.types(!1),s),u=i.outputLogFormatter(t);return u.event=this.displayName(),u.address=t.address,u.args=this._params.reduce(function(t,e){return t[e.name]=e.indexed?r.shift():a.shift(),t},{}),delete u.data,delete u.topics,u},c.prototype.execute=function(t,e,n){r.isFunction(arguments[arguments.length-1])&&(n=arguments[arguments.length-1],2===arguments.length&&(e=null),1===arguments.length&&(e=null,t={}));var o=this.encode(t,e),i=this.decode.bind(this);return new a(o,u.eth(),i,n)},c.prototype.attachToContract=function(t){var e=this.execute.bind(this),n=this.displayName();t[n]||(t[n]=e),t[n][this.typeName()]=this.execute.bind(this,t)},e.exports=c},{"../solidity/coder":4,"../utils/sha3":15,"../utils/utils":16,"./filter":26,"./formatters":27,"./watches":40}],26:[function(t,e,n){var r=t("./requestmanager"),o=t("./formatters"),i=t("../utils/utils"),s=function(t){return null===t||"undefined"==typeof t?null:(t=String(t),0===t.indexOf("0x")?t:i.fromAscii(t))},a=function(t){return i.isString(t)?t:(t=t||{},t.topics=t.topics||[],t.topics=t.topics.map(function(t){return i.isArray(t)?t.map(s):s(t)}),{topics:t.topics,to:t.to,address:t.address,fromBlock:o.inputBlockNumberFormatter(t.fromBlock),toBlock:o.inputBlockNumberFormatter(t.toBlock)})},u=function(t,e){i.isString(t.options)||t.get(function(t,n){t&&e(t),i.isArray(n)&&n.forEach(function(t){e(null,t)})})},c=function(t){var e=function(e,n){return e?t.callbacks.forEach(function(t){t(e)}):void n.forEach(function(e){e=t.formatter?t.formatter(e):e,t.callbacks.forEach(function(t){t(null,e)})})};r.getInstance().startPolling({method:t.implementation.poll.call,params:[t.filterId]},t.filterId,e,t.stopWatching.bind(t))},l=function(t,e,n,r){var o=this,i={};return e.forEach(function(t){t.attachToObject(i)}),this.options=a(t),this.implementation=i,this.filterId=null,this.callbacks=[],this.pollFilters=[],this.formatter=n,this.implementation.newFilter(this.options,function(t,e){if(t)o.callbacks.forEach(function(e){e(t)});else if(o.filterId=e,o.callbacks.forEach(function(t){u(o,t)}),o.callbacks.length>0&&c(o),r)return o.watch(r)}),this};l.prototype.watch=function(t){return this.callbacks.push(t),this.filterId&&(u(this,t),c(this)),this},l.prototype.stopWatching=function(){r.getInstance().stopPolling(this.filterId),this.implementation.uninstallFilter(this.filterId,function(){}),this.callbacks=[]},l.prototype.get=function(t){var e=this;if(!i.isFunction(t)){var n=this.implementation.getLogs(this.filterId);return n.map(function(t){return e.formatter?e.formatter(t):t})}return this.implementation.getLogs(this.filterId,function(n,r){n?t(n):t(null,r.map(function(t){return e.formatter?e.formatter(t):t}))}),this},e.exports=l},{"../utils/utils":16,"./formatters":27,"./requestmanager":37}],27:[function(t,e,n){var r=t("../utils/utils"),o=t("../utils/config"),i=function(t){return r.toBigNumber(t)},s=function(t){return"latest"===t||"pending"===t||"earliest"===t},a=function(t){return void 0===t?o.defaultBlock:u(t)},u=function(t){return void 0===t?void 0:s(t)?t:r.toHex(t)},c=function(t){return t.from=t.from||o.defaultAccount,t.code&&(t.data=t.code,delete t.code),["gasPrice","gas","value","nonce"].filter(function(e){return void 0!==t[e]}).forEach(function(e){t[e]=r.fromDecimal(t[e])}),t},l=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),t.nonce=r.toDecimal(t.nonce),t.gas=r.toDecimal(t.gas),
t.gasPrice=r.toBigNumber(t.gasPrice),t.value=r.toBigNumber(t.value),t},f=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),t.cumulativeGasUsed=r.toDecimal(t.cumulativeGasUsed),t.gasUsed=r.toDecimal(t.gasUsed),r.isArray(t.logs)&&(t.logs=t.logs.map(function(t){return h(t)})),t},p=function(t){return t.gasLimit=r.toDecimal(t.gasLimit),t.gasUsed=r.toDecimal(t.gasUsed),t.size=r.toDecimal(t.size),t.timestamp=r.toDecimal(t.timestamp),null!==t.number&&(t.number=r.toDecimal(t.number)),t.difficulty=r.toBigNumber(t.difficulty),t.totalDifficulty=r.toBigNumber(t.totalDifficulty),r.isArray(t.transactions)&&t.transactions.forEach(function(t){return r.isString(t)?void 0:l(t)}),t},h=function(t){return null!==t.blockNumber&&(t.blockNumber=r.toDecimal(t.blockNumber)),null!==t.transactionIndex&&(t.transactionIndex=r.toDecimal(t.transactionIndex)),null!==t.logIndex&&(t.logIndex=r.toDecimal(t.logIndex)),t},m=function(t){return t.payload=r.toHex(t.payload),t.ttl=r.fromDecimal(t.ttl),t.workToProve=r.fromDecimal(t.workToProve),t.priority=r.fromDecimal(t.priority),r.isArray(t.topics)||(t.topics=t.topics?[t.topics]:[]),t.topics=t.topics.map(function(t){return r.fromAscii(t)}),t},d=function(t){return t.expiry=r.toDecimal(t.expiry),t.sent=r.toDecimal(t.sent),t.ttl=r.toDecimal(t.ttl),t.workProved=r.toDecimal(t.workProved),t.payloadRaw=t.payload,t.payload=r.toAscii(t.payload),r.isJson(t.payload)&&(t.payload=JSON.parse(t.payload)),t.topics||(t.topics=[]),t.topics=t.topics.map(function(t){return r.toAscii(t)}),t};e.exports={inputDefaultBlockNumberFormatter:a,inputBlockNumberFormatter:u,inputTransactionFormatter:c,inputPostFormatter:m,outputBigNumberFormatter:i,outputTransactionFormatter:l,outputTransactionReceiptFormatter:f,outputBlockFormatter:p,outputLogFormatter:h,outputPostFormatter:d}},{"../utils/config":14,"../utils/utils":16}],28:[function(t,e,n){var r=t("../web3"),o=t("../solidity/coder"),i=t("../utils/utils"),s=t("./formatters"),a=t("../utils/sha3"),u=function(t,e){this._inputTypes=t.inputs.map(function(t){return t.type}),this._outputTypes=t.outputs.map(function(t){return t.type}),this._constant=t.constant,this._name=i.transformToFullName(t),this._address=e};u.prototype.extractCallback=function(t){return i.isFunction(t[t.length-1])?t.pop():void 0},u.prototype.extractDefaultBlock=function(t){return t.length>this._inputTypes.length&&!i.isObject(t[t.length-1])?s.inputDefaultBlockNumberFormatter(t.pop()):void 0},u.prototype.toPayload=function(t){var e={};return t.length>this._inputTypes.length&&i.isObject(t[t.length-1])&&(e=t[t.length-1]),e.to=this._address,e.data="0x"+this.signature()+o.encodeParams(this._inputTypes,t),e},u.prototype.signature=function(){return a(this._name).slice(0,8)},u.prototype.unpackOutput=function(t){if(t){t=t.length>=2?t.slice(2):t;var e=o.decodeParams(this._outputTypes,t);return 1===e.length?e[0]:e}},u.prototype.call=function(){var t=Array.prototype.slice.call(arguments).filter(function(t){return void 0!==t}),e=this.extractCallback(t),n=this.extractDefaultBlock(t),o=this.toPayload(t);if(!e){var i=r.eth.call(o,n);return this.unpackOutput(i)}var s=this;r.eth.call(o,n,function(t,n){e(t,s.unpackOutput(n))})},u.prototype.sendTransaction=function(){var t=Array.prototype.slice.call(arguments).filter(function(t){return void 0!==t}),e=this.extractCallback(t),n=this.toPayload(t);return e?void r.eth.sendTransaction(n,e):r.eth.sendTransaction(n)},u.prototype.estimateGas=function(){var t=Array.prototype.slice.call(arguments),e=this.extractCallback(t),n=this.toPayload(t);return e?void r.eth.estimateGas(n,e):r.eth.estimateGas(n)},u.prototype.displayName=function(){return i.extractDisplayName(this._name)},u.prototype.typeName=function(){return i.extractTypeName(this._name)},u.prototype.request=function(){var t=Array.prototype.slice.call(arguments),e=this.extractCallback(t),n=this.toPayload(t),r=this.unpackOutput.bind(this);return{method:this._constant?"eth_call":"eth_sendTransaction",callback:e,params:[n],format:r}},u.prototype.execute=function(){var t=!this._constant;return t?this.sendTransaction.apply(this,Array.prototype.slice.call(arguments)):this.call.apply(this,Array.prototype.slice.call(arguments))},u.prototype.attachToContract=function(t){var e=this.execute.bind(this);e.request=this.request.bind(this),e.call=this.call.bind(this),e.sendTransaction=this.sendTransaction.bind(this),e.estimateGas=this.estimateGas.bind(this);var n=this.displayName();t[n]||(t[n]=e),t[n][this.typeName()]=e},e.exports=u},{"../solidity/coder":4,"../utils/sha3":15,"../utils/utils":16,"../web3":18,"./formatters":27}],29:[function(t,e,n){"use strict";var r="undefined"!=typeof Meteor&&Meteor.isServer?Npm.require:t,o="undefined"!=typeof window&&window.XMLHttpRequest?window.XMLHttpRequest:r("xmlhttprequest").XMLHttpRequest,i=t("./errors"),s=function(t){this.host=t||"http://localhost:8545"};s.prototype.isConnected=function(){var t=new o;t.open("POST",this.host,!1),t.setRequestHeader("Content-Type","application/json");try{return t.send(JSON.stringify({id:9999999999,jsonrpc:"2.0",method:"net_listening",params:[]})),!0}catch(e){return!1}},s.prototype.send=function(t){var e=new o;e.open("POST",this.host,!1),e.setRequestHeader("Content-Type","application/json");try{e.send(JSON.stringify(t))}catch(n){throw i.InvalidConnection(this.host)}var r=e.responseText;try{r=JSON.parse(r)}catch(s){throw i.InvalidResponse(e.responseText)}return r},s.prototype.sendAsync=function(t,e){var n=new o;n.onreadystatechange=function(){if(4===n.readyState){var t=n.responseText,r=null;try{t=JSON.parse(t)}catch(o){r=i.InvalidResponse(n.responseText)}e(r,t)}},n.open("POST",this.host,!0),n.setRequestHeader("Content-Type","application/json");try{n.send(JSON.stringify(t))}catch(r){e(i.InvalidConnection(this.host))}},e.exports=s},{"./errors":23}],30:[function(t,e,n){var r=t("../utils/utils"),o=function(t){this._iban=t};o.prototype.isValid=function(){return r.isIBAN(this._iban)},o.prototype.isDirect=function(){return 34===this._iban.length},o.prototype.isIndirect=function(){return 20===this._iban.length},o.prototype.checksum=function(){return this._iban.substr(2,2)},o.prototype.institution=function(){return this.isIndirect()?this._iban.substr(7,4):""},o.prototype.client=function(){return this.isIndirect()?this._iban.substr(11):""},o.prototype.address=function(){return this.isDirect()?this._iban.substr(4):""},e.exports=o},{"../utils/utils":16}],31:[function(t,e,n){"use strict";var r=t("../utils/utils"),o=t("./errors"),i='{"jsonrpc": "2.0", "error": {"code": -32603, "message": "IPC Request timed out for method  \'__method__\'"}, "id": "__id__"}',s=function(e,n){var o=this;this.responseCallbacks={},this.path=e,n=n||t("net"),this.connection=n.connect({path:this.path}),this.connection.on("error",function(t){console.error("IPC Connection Error",t),o._timeout()}),this.connection.on("end",function(){o._timeout()}),this.connection.on("data",function(t){o._parseResponse(t.toString()).forEach(function(t){var e=null;r.isArray(t)?t.forEach(function(t){o.responseCallbacks[t.id]&&(e=t.id)}):e=t.id,o.responseCallbacks[e]&&(o.responseCallbacks[e](null,t),delete o.responseCallbacks[e])})})};s.prototype._parseResponse=function(t){var e=this,n=[],r=t.replace(/\}\{/g,"}|--|{").replace(/\}\]\[\{/g,"}]|--|[{").replace(/\}\[\{/g,"}|--|[{").replace(/\}\]\{/g,"}]|--|{").split("|--|");return r.forEach(function(t){e.lastChunk&&(t=e.lastChunk+t);var r=null;try{r=JSON.parse(t)}catch(i){return e.lastChunk=t,clearTimeout(e.lastChunkTimeout),void(e.lastChunkTimeout=setTimeout(function(){throw e.timeout(),o.InvalidResponse(t)},15e3))}clearTimeout(e.lastChunkTimeout),e.lastChunk=null,r&&n.push(r)}),n},s.prototype._addResponseCallback=function(t,e){var n=t.id||t[0].id,r=t.method||t[0].method;this.responseCallbacks[n]=e,this.responseCallbacks[n].method=r},s.prototype._timeout=function(){for(var t in this.responseCallbacks)this.responseCallbacks.hasOwnProperty(t)&&(this.responseCallbacks[t](i.replace("__id__",t).replace("__method__",this.responseCallbacks[t].method)),delete this.responseCallbacks[t])},s.prototype.isConnected=function(){var t=this;return t.connection.writable||t.connection.connect({path:t.path}),!!this.connection.writable},s.prototype.send=function(t){if(this.connection.writeSync){var e;this.connection.writable||this.connection.connect({path:this.path});var n=this.connection.writeSync(JSON.stringify(t));try{e=JSON.parse(n)}catch(r){throw o.InvalidResponse(n)}return e}throw new Error('You tried to send "'+t.method+'" synchronously. Synchronous requests are not supported by the IPC provider.')},s.prototype.sendAsync=function(t,e){this.connection.writable||this.connection.connect({path:this.path}),this.connection.write(JSON.stringify(t)),this._addResponseCallback(t,e)},e.exports=s},{"../utils/utils":16,"./errors":23,net:41}],32:[function(t,e,n){var r=function(){return arguments.callee._singletonInstance?arguments.callee._singletonInstance:(arguments.callee._singletonInstance=this,void(this.messageId=1))};r.getInstance=function(){var t=new r;return t},r.prototype.toPayload=function(t,e){return t||console.error("jsonrpc method should be specified!"),{jsonrpc:"2.0",method:t,params:e||[],id:this.messageId++}},r.prototype.isValidResponse=function(t){return!!t&&!t.error&&"2.0"===t.jsonrpc&&"number"==typeof t.id&&void 0!==t.result},r.prototype.toBatchPayload=function(t){var e=this;return t.map(function(t){return e.toPayload(t.method,t.params)})},e.exports=r},{}],33:[function(t,e,n){var r=t("./requestmanager"),o=t("../utils/utils"),i=t("./errors"),s=function(t){this.name=t.name,this.call=t.call,this.params=t.params||0,this.inputFormatter=t.inputFormatter,this.outputFormatter=t.outputFormatter};s.prototype.getCall=function(t){return o.isFunction(this.call)?this.call(t):this.call},s.prototype.extractCallback=function(t){return o.isFunction(t[t.length-1])?t.pop():void 0},s.prototype.validateArgs=function(t){if(t.length!==this.params)throw i.InvalidNumberOfParams()},s.prototype.formatInput=function(t){return this.inputFormatter?this.inputFormatter.map(function(e,n){return e?e(t[n]):t[n]}):t},s.prototype.formatOutput=function(t){return this.outputFormatter&&t?this.outputFormatter(t):t},s.prototype.attachToObject=function(t){var e=this.send.bind(this);e.request=this.request.bind(this),e.call=this.call;var n=this.name.split(".");n.length>1?(t[n[0]]=t[n[0]]||{},t[n[0]][n[1]]=e):t[n[0]]=e},s.prototype.toPayload=function(t){var e=this.getCall(t),n=this.extractCallback(t),r=this.formatInput(t);return this.validateArgs(r),{method:e,params:r,callback:n}},s.prototype.request=function(){var t=this.toPayload(Array.prototype.slice.call(arguments));return t.format=this.formatOutput.bind(this),t},s.prototype.send=function(){var t=this.toPayload(Array.prototype.slice.call(arguments));if(t.callback){var e=this;return r.getInstance().sendAsync(t,function(n,r){t.callback(n,e.formatOutput(r))})}return this.formatOutput(r.getInstance().send(t))},e.exports=s},{"../utils/utils":16,"./errors":23,"./requestmanager":37}],34:[function(t,e,n){var r=t("./contract"),o="0xc6d9d2cd449a754c494264e1809c50e34d64562b",i=[{constant:!0,inputs:[{name:"_owner",type:"address"}],name:"name",outputs:[{name:"o_name",type:"bytes32"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"owner",outputs:[{name:"",type:"address"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"content",outputs:[{name:"",type:"bytes32"}],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"addr",outputs:[{name:"",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"}],name:"reserve",outputs:[],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"subRegistrar",outputs:[{name:"o_subRegistrar",type:"address"}],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_newOwner",type:"address"}],name:"transfer",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_registrar",type:"address"}],name:"setSubRegistrar",outputs:[],type:"function"},{constant:!1,inputs:[],name:"Registrar",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_a",type:"address"},{name:"_primary",type:"bool"}],name:"setAddress",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"},{name:"_content",type:"bytes32"}],name:"setContent",outputs:[],type:"function"},{constant:!1,inputs:[{name:"_name",type:"bytes32"}],name:"disown",outputs:[],type:"function"},{constant:!0,inputs:[{name:"_name",type:"bytes32"}],name:"register",outputs:[{name:"",type:"address"}],type:"function"},{anonymous:!1,inputs:[{indexed:!0,name:"name",type:"bytes32"}],name:"Changed",type:"event"},{anonymous:!1,inputs:[{indexed:!0,name:"name",type:"bytes32"},{indexed:!0,name:"addr",type:"address"}],name:"PrimaryChanged",type:"event"}];e.exports=r(i).at(o)},{"./contract":21}],35:[function(t,e,n){var r=t("../utils/utils"),o=t("./property"),i=[],s=[new o({name:"listening",getter:"net_listening"}),new o({name:"peerCount",getter:"net_peerCount",outputFormatter:r.toDecimal})];e.exports={methods:i,properties:s}},{"../utils/utils":16,"./property":36}],36:[function(t,e,n){var r=t("./requestmanager"),o=t("../utils/utils"),i=function(t){this.name=t.name,this.getter=t.getter,this.setter=t.setter,this.outputFormatter=t.outputFormatter,this.inputFormatter=t.inputFormatter};i.prototype.formatInput=function(t){return this.inputFormatter?this.inputFormatter(t):t},i.prototype.formatOutput=function(t){return this.outputFormatter&&null!==t?this.outputFormatter(t):t},i.prototype.extractCallback=function(t){return o.isFunction(t[t.length-1])?t.pop():void 0},i.prototype.attachToObject=function(t){var e={get:this.get.bind(this)},n=this.name.split("."),r=n[0];n.length>1&&(t[n[0]]=t[n[0]]||{},t=t[n[0]],r=n[1]),Object.defineProperty(t,r,e);var o=function(t,e){return t+e.charAt(0).toUpperCase()+e.slice(1)},i=this.getAsync.bind(this);i.request=this.request.bind(this),t[o("get",r)]=i},i.prototype.get=function(){return this.formatOutput(r.getInstance().send({method:this.getter}))},i.prototype.getAsync=function(t){var e=this;r.getInstance().sendAsync({method:this.getter},function(n,r){return n?t(n):void t(n,e.formatOutput(r))})},i.prototype.request=function(){var t={method:this.getter,params:[],callback:this.extractCallback(Array.prototype.slice.call(arguments))};return t.format=this.formatOutput.bind(this),t},e.exports=i},{"../utils/utils":16,"./requestmanager":37}],37:[function(t,e,n){var r=t("./jsonrpc"),o=t("../utils/utils"),i=t("../utils/config"),s=t("./errors"),a=function(t){return arguments.callee._singletonInstance?arguments.callee._singletonInstance:(arguments.callee._singletonInstance=this,this.provider=t,this.polls={},this.timeout=null,void(this.isPolling=!1))};a.getInstance=function(){var t=new a;return t},a.prototype.send=function(t){if(!this.provider)return console.error(s.InvalidProvider()),null;var e=r.getInstance().toPayload(t.method,t.params),n=this.provider.send(e);if(!r.getInstance().isValidResponse(n))throw s.InvalidResponse(n);return n.result},a.prototype.sendAsync=function(t,e){if(!this.provider)return e(s.InvalidProvider());var n=r.getInstance().toPayload(t.method,t.params);this.provider.sendAsync(n,function(t,n){return t?e(t):r.getInstance().isValidResponse(n)?void e(null,n.result):e(s.InvalidResponse(n))})},a.prototype.sendBatch=function(t,e){if(!this.provider)return e(s.InvalidProvider());var n=r.getInstance().toBatchPayload(t);this.provider.sendAsync(n,function(t,n){return t?e(t):o.isArray(n)?void e(t,n):e(s.InvalidResponse(n))})},a.prototype.setProvider=function(t){this.provider=t,this.provider&&!this.isPolling&&(this.poll(),this.isPolling=!0)},a.prototype.startPolling=function(t,e,n,r){this.polls["poll_"+e]={data:t,id:e,callback:n,uninstall:r}},a.prototype.stopPolling=function(t){delete this.polls["poll_"+t]},a.prototype.reset=function(){for(var t in this.polls)this.polls[t].uninstall();this.polls={},this.timeout&&(clearTimeout(this.timeout),this.timeout=null),this.poll()},a.prototype.poll=function(){if(this.timeout=setTimeout(this.poll.bind(this),i.ETH_POLLING_TIMEOUT),0!==Object.keys(this.polls).length){if(!this.provider)return void console.error(s.InvalidProvider());var t=[],e=[];for(var n in this.polls)t.push(this.polls[n].data),e.push(n);if(0!==t.length){var a=r.getInstance().toBatchPayload(t),u=this;this.provider.sendAsync(a,function(t,n){if(!t){if(!o.isArray(n))throw s.InvalidResponse(n);n.map(function(t,n){var r=e[n];return u.polls[r]?(t.callback=u.polls[r].callback,t):!1}).filter(function(t){return!!t}).filter(function(t){var e=r.getInstance().isValidResponse(t);return e||t.callback(s.InvalidResponse(t)),e}).filter(function(t){return o.isArray(t.result)&&t.result.length>0}).forEach(function(t){t.callback(null,t.result)})}})}}},e.exports=a},{"../utils/config":14,"../utils/utils":16,"./errors":23,"./jsonrpc":32}],38:[function(t,e,n){var r=t("./method"),o=t("./formatters"),i=new r({name:"post",call:"shh_post",params:1,inputFormatter:[o.inputPostFormatter]}),s=new r({name:"newIdentity",call:"shh_newIdentity",params:0}),a=new r({name:"hasIdentity",call:"shh_hasIdentity",params:1}),u=new r({name:"newGroup",call:"shh_newGroup",params:0}),c=new r({name:"addToGroup",call:"shh_addToGroup",params:0}),l=[i,s,a,u,c];e.exports={methods:l}},{"./formatters":27,"./method":33}],39:[function(t,e,n){var r=t("../web3"),o=t("./icap"),i=t("./namereg"),s=t("./contract"),a=function(t,e,n,r){var s=new o(e);if(!s.isValid())throw new Error("invalid iban address");if(s.isDirect())return u(t,s.address(),n,r);if(!r){var a=i.addr(s.institution());return c(t,a,n,s.client())}i.addr(s.insitution(),function(e,o){return c(t,o,n,s.client(),r)})},u=function(t,e,n,o){return r.eth.sendTransaction({address:e,from:t,value:n},o)},c=function(t,e,n,r,o){var i=[{constant:!1,inputs:[{name:"name",type:"bytes32"}],name:"deposit",outputs:[],type:"function"}];return s(i).at(e).deposit(r,{from:t,value:n},o)};e.exports=a},{"../web3":18,"./contract":21,"./icap":30,"./namereg":34}],40:[function(t,e,n){var r=t("./method"),o=function(){var t=function(t){var e=t[0];switch(e){case"latest":return t.shift(),this.params=0,"eth_newBlockFilter";case"pending":return t.shift(),this.params=0,"eth_newPendingTransactionFilter";default:return"eth_newFilter"}},e=new r({name:"newFilter",call:t,params:1}),n=new r({name:"uninstallFilter",call:"eth_uninstallFilter",params:1}),o=new r({name:"getLogs",call:"eth_getFilterLogs",params:1}),i=new r({name:"poll",call:"eth_getFilterChanges",params:1});return[e,n,o,i]},i=function(){var t=new r({name:"newFilter",call:"shh_newFilter",params:1}),e=new r({name:"uninstallFilter",call:"shh_uninstallFilter",params:1}),n=new r({name:"getLogs",call:"shh_getMessages",params:1}),o=new r({name:"poll",call:"shh_getFilterChanges",params:1});return[t,e,n,o]};e.exports={eth:o,shh:i}},{"./method":33}],41:[function(t,e,n){},{}],42:[function(t,e,n){!function(t,r){"object"==typeof n?e.exports=n=r():"function"==typeof define&&define.amd?define([],r):t.CryptoJS=r()}(this,function(){var t=t||function(t,e){var n={},r=n.lib={},o=r.Base=function(){function t(){}return{extend:function(e){t.prototype=this;var n=new t;return e&&n.mixIn(e),n.hasOwnProperty("init")||(n.init=function(){n.$super.init.apply(this,arguments)}),n.init.prototype=n,n.$super=this,n},create:function(){var t=this.extend();return t.init.apply(t,arguments),t},init:function(){},mixIn:function(t){for(var e in t)t.hasOwnProperty(e)&&(this[e]=t[e]);t.hasOwnProperty("toString")&&(this.toString=t.toString)},clone:function(){return this.init.prototype.extend(this)}}}(),i=r.WordArray=o.extend({init:function(t,n){t=this.words=t||[],this.sigBytes=n!=e?n:4*t.length},toString:function(t){return(t||a).stringify(this)},concat:function(t){var e=this.words,n=t.words,r=this.sigBytes,o=t.sigBytes;if(this.clamp(),r%4)for(var i=0;o>i;i++){var s=n[i>>>2]>>>24-i%4*8&255;e[r+i>>>2]|=s<<24-(r+i)%4*8}else for(var i=0;o>i;i+=4)e[r+i>>>2]=n[i>>>2];return this.sigBytes+=o,this},clamp:function(){var e=this.words,n=this.sigBytes;e[n>>>2]&=4294967295<<32-n%4*8,e.length=t.ceil(n/4)},clone:function(){var t=o.clone.call(this);return t.words=this.words.slice(0),t},random:function(e){for(var n,r=[],o=function(e){var e=e,n=987654321,r=4294967295;return function(){n=36969*(65535&n)+(n>>16)&r,e=18e3*(65535&e)+(e>>16)&r;var o=(n<<16)+e&r;return o/=4294967296,o+=.5,o*(t.random()>.5?1:-1)}},s=0;e>s;s+=4){var a=o(4294967296*(n||t.random()));n=987654071*a(),r.push(4294967296*a()|0)}return new i.init(r,e)}}),s=n.enc={},a=s.Hex={stringify:function(t){for(var e=t.words,n=t.sigBytes,r=[],o=0;n>o;o++){var i=e[o>>>2]>>>24-o%4*8&255;r.push((i>>>4).toString(16)),r.push((15&i).toString(16))}return r.join("")},parse:function(t){for(var e=t.length,n=[],r=0;e>r;r+=2)n[r>>>3]|=parseInt(t.substr(r,2),16)<<24-r%8*4;return new i.init(n,e/2)}},u=s.Latin1={stringify:function(t){for(var e=t.words,n=t.sigBytes,r=[],o=0;n>o;o++){var i=e[o>>>2]>>>24-o%4*8&255;r.push(String.fromCharCode(i))}return r.join("")},parse:function(t){for(var e=t.length,n=[],r=0;e>r;r++)n[r>>>2]|=(255&t.charCodeAt(r))<<24-r%4*8;return new i.init(n,e)}},c=s.Utf8={stringify:function(t){try{return decodeURIComponent(escape(u.stringify(t)))}catch(e){throw new Error("Malformed UTF-8 data")}},parse:function(t){return u.parse(unescape(encodeURIComponent(t)))}},l=r.BufferedBlockAlgorithm=o.extend({reset:function(){this._data=new i.init,this._nDataBytes=0},_append:function(t){"string"==typeof t&&(t=c.parse(t)),this._data.concat(t),this._nDataBytes+=t.sigBytes},_process:function(e){var n=this._data,r=n.words,o=n.sigBytes,s=this.blockSize,a=4*s,u=o/a;u=e?t.ceil(u):t.max((0|u)-this._minBufferSize,0);var c=u*s,l=t.min(4*c,o);if(c){for(var f=0;c>f;f+=s)this._doProcessBlock(r,f);var p=r.splice(0,c);n.sigBytes-=l}return new i.init(p,l)},clone:function(){var t=o.clone.call(this);return t._data=this._data.clone(),t},_minBufferSize:0}),f=(r.Hasher=l.extend({cfg:o.extend(),init:function(t){this.cfg=this.cfg.extend(t),this.reset()},reset:function(){l.reset.call(this),this._doReset()},update:function(t){return this._append(t),this._process(),this},finalize:function(t){t&&this._append(t);var e=this._doFinalize();return e},blockSize:16,_createHelper:function(t){return function(e,n){return new t.init(n).finalize(e)}},_createHmacHelper:function(t){return function(e,n){return new f.HMAC.init(t,n).finalize(e)}}}),n.algo={});return n}(Math);return t})},{}],43:[function(t,e,n){!function(r,o,i){"object"==typeof n?e.exports=n=o(t("./core"),t("./x64-core")):"function"==typeof define&&define.amd?define(["./core","./x64-core"],o):o(r.CryptoJS)}(this,function(t){return function(e){var n=t,r=n.lib,o=r.WordArray,i=r.Hasher,s=n.x64,a=s.Word,u=n.algo,c=[],l=[],f=[];!function(){for(var t=1,e=0,n=0;24>n;n++){c[t+5*e]=(n+1)*(n+2)/2%64;var r=e%5,o=(2*t+3*e)%5;t=r,e=o}for(var t=0;5>t;t++)for(var e=0;5>e;e++)l[t+5*e]=e+(2*t+3*e)%5*5;for(var i=1,s=0;24>s;s++){for(var u=0,p=0,h=0;7>h;h++){if(1&i){var m=(1<<h)-1;32>m?p^=1<<m:u^=1<<m-32}128&i?i=i<<1^113:i<<=1}f[s]=a.create(u,p)}}();var p=[];!function(){for(var t=0;25>t;t++)p[t]=a.create()}();var h=u.SHA3=i.extend({cfg:i.cfg.extend({outputLength:512}),_doReset:function(){for(var t=this._state=[],e=0;25>e;e++)t[e]=new a.init;this.blockSize=(1600-2*this.cfg.outputLength)/32},_doProcessBlock:function(t,e){for(var n=this._state,r=this.blockSize/2,o=0;r>o;o++){var i=t[e+2*o],s=t[e+2*o+1];i=16711935&(i<<8|i>>>24)|4278255360&(i<<24|i>>>8),s=16711935&(s<<8|s>>>24)|4278255360&(s<<24|s>>>8);var a=n[o];a.high^=s,a.low^=i}for(var u=0;24>u;u++){for(var h=0;5>h;h++){for(var m=0,d=0,y=0;5>y;y++){var a=n[h+5*y];m^=a.high,d^=a.low}var g=p[h];g.high=m,g.low=d}for(var h=0;5>h;h++)for(var v=p[(h+4)%5],b=p[(h+1)%5],w=b.high,_=b.low,m=v.high^(w<<1|_>>>31),d=v.low^(_<<1|w>>>31),y=0;5>y;y++){var a=n[h+5*y];a.high^=m,a.low^=d}for(var x=1;25>x;x++){var a=n[x],I=a.high,F=a.low,k=c[x];if(32>k)var m=I<<k|F>>>32-k,d=F<<k|I>>>32-k;else var m=F<<k-32|I>>>64-k,d=I<<k-32|F>>>64-k;var N=p[l[x]];N.high=m,N.low=d}var T=p[0],O=n[0];T.high=O.high,T.low=O.low;for(var h=0;5>h;h++)for(var y=0;5>y;y++){var x=h+5*y,a=n[x],A=p[x],B=p[(h+1)%5+5*y],P=p[(h+2)%5+5*y];a.high=A.high^~B.high&P.high,a.low=A.low^~B.low&P.low}var a=n[0],S=f[u];a.high^=S.high,a.low^=S.low}},_doFinalize:function(){var t=this._data,n=t.words,r=(8*this._nDataBytes,8*t.sigBytes),i=32*this.blockSize;n[r>>>5]|=1<<24-r%32,n[(e.ceil((r+1)/i)*i>>>5)-1]|=128,t.sigBytes=4*n.length,this._process();for(var s=this._state,a=this.cfg.outputLength/8,u=a/8,c=[],l=0;u>l;l++){var f=s[l],p=f.high,h=f.low;p=16711935&(p<<8|p>>>24)|4278255360&(p<<24|p>>>8),h=16711935&(h<<8|h>>>24)|4278255360&(h<<24|h>>>8),c.push(h),c.push(p)}return new o.init(c,a)},clone:function(){for(var t=i.clone.call(this),e=t._state=this._state.slice(0),n=0;25>n;n++)e[n]=e[n].clone();return t}});n.SHA3=i._createHelper(h),n.HmacSHA3=i._createHmacHelper(h)}(Math),t.SHA3})},{"./core":42,"./x64-core":44}],44:[function(t,e,n){!function(r,o){"object"==typeof n?e.exports=n=o(t("./core")):"function"==typeof define&&define.amd?define(["./core"],o):o(r.CryptoJS)}(this,function(t){return function(e){{var n=t,r=n.lib,o=r.Base,i=r.WordArray,s=n.x64={};s.Word=o.extend({init:function(t,e){this.high=t,this.low=e}}),s.WordArray=o.extend({init:function(t,n){t=this.words=t||[],this.sigBytes=n!=e?n:8*t.length},toX32:function(){for(var t=this.words,e=t.length,n=[],r=0;e>r;r++){var o=t[r];n.push(o.high),n.push(o.low)}return i.create(n,this.sigBytes)},clone:function(){for(var t=o.clone.call(this),e=t.words=this.words.slice(0),n=e.length,r=0;n>r;r++)e[r]=e[r].clone();return t}})}}(),t})},{"./core":42}],"bignumber.js":[function(t,e,n){!function(n){"use strict";function r(t){function e(t,r){var o,i,s,a,u,c,l=this;if(!(l instanceof e))return W&&S(26,"constructor call without new",t),new e(t,r);if(null!=r&&z(r,2,64,R,"base")){if(r=0|r,c=t+"",10==r)return l=new e(t instanceof e?t:c),D(l,H+l.e+1,j);if((a="number"==typeof t)&&0*t!=0||!new RegExp("^-?"+(o="["+x.slice(0,r)+"]+")+"(?:\\."+o+")?$",37>r?"i":"").test(c))return d(l,c,a,r);a?(l.s=0>1/t?(c=c.slice(1),-1):1,W&&c.replace(/^0\.0*|\./,"").length>15&&S(R,_,t),a=!1):l.s=45===c.charCodeAt(0)?(c=c.slice(1),-1):1,c=n(c,10,r,l.s)}else{if(t instanceof e)return l.s=t.s,l.e=t.e,l.c=(t=t.c)?t.slice():t,void(R=0);if((a="number"==typeof t)&&0*t==0){if(l.s=0>1/t?(t=-t,-1):1,t===~~t){for(i=0,s=t;s>=10;s/=10,i++);return l.e=i,l.c=[t],void(R=0)}c=t+""}else{if(!y.test(c=t+""))return d(l,c,a);l.s=45===c.charCodeAt(0)?(c=c.slice(1),-1):1}}for((i=c.indexOf("."))>-1&&(c=c.replace(".","")),(s=c.search(/e/i))>0?(0>i&&(i=s),i+=+c.slice(s+1),c=c.substring(0,s)):0>i&&(i=c.length),s=0;48===c.charCodeAt(s);s++);for(u=c.length;48===c.charCodeAt(--u););if(c=c.slice(s,u+1))if(u=c.length,a&&W&&u>15&&S(R,_,l.s*t),i=i-s-1,i>G)l.c=l.e=null;else if(M>i)l.c=[l.e=0];else{if(l.e=i,l.c=[],s=(i+1)%F,0>i&&(s+=F),u>s){for(s&&l.c.push(+c.slice(0,s)),u-=F;u>s;)l.c.push(+c.slice(s,s+=F));c=c.slice(s),s=F-c.length}else s-=u;for(;s--;c+="0");l.c.push(+c)}else l.c=[l.e=0];R=0}function n(t,n,r,o){var s,a,u,l,p,h,m,d=t.indexOf("."),y=H,g=j;for(37>r&&(t=t.toLowerCase()),d>=0&&(u=V,V=0,t=t.replace(".",""),m=new e(r),p=m.pow(t.length-d),V=u,m.c=c(f(i(p.c),p.e),10,n),m.e=m.c.length),h=c(t,r,n),a=u=h.length;0==h[--u];h.pop());if(!h[0])return"0";if(0>d?--a:(p.c=h,p.e=a,p.s=o,p=C(p,m,y,g,n),h=p.c,l=p.r,a=p.e),s=a+y+1,d=h[s],u=n/2,l=l||0>s||null!=h[s+1],l=4>g?(null!=d||l)&&(0==g||g==(p.s<0?3:2)):d>u||d==u&&(4==g||l||6==g&&1&h[s-1]||g==(p.s<0?8:7)),1>s||!h[0])t=l?f("1",-y):"0";else{if(h.length=s,l)for(--n;++h[--s]>n;)h[s]=0,s||(++a,h.unshift(1));for(u=h.length;!h[--u];);for(d=0,t="";u>=d;t+=x.charAt(h[d++]));t=f(t,a)}return t}function h(t,n,r,o){var s,a,u,c,p;if(r=null!=r&&z(r,0,8,o,w)?0|r:j,!t.c)return t.toString();if(s=t.c[0],u=t.e,null==n)p=i(t.c),p=19==o||24==o&&q>=u?l(p,u):f(p,u);else if(t=D(new e(t),n,r),a=t.e,p=i(t.c),c=p.length,19==o||24==o&&(a>=n||q>=a)){for(;n>c;p+="0",c++);p=l(p,a)}else if(n-=u,p=f(p,a),a+1>c){if(--n>0)for(p+=".";n--;p+="0");}else if(n+=a-c,n>0)for(a+1==c&&(p+=".");n--;p+="0");return t.s<0&&s?"-"+p:p}function A(t,n){var r,o,i=0;for(u(t[0])&&(t=t[0]),r=new e(t[0]);++i<t.length;){if(o=new e(t[i]),!o.s){r=o;break}n.call(r,o)&&(r=o)}return r}function B(t,e,n,r,o){return(e>t||t>n||t!=p(t))&&S(r,(o||"decimal places")+(e>t||t>n?" out of range":" not an integer"),t),!0}function P(t,e,n){for(var r=1,o=e.length;!e[--o];e.pop());for(o=e[0];o>=10;o/=10,r++);return(n=r+n*F-1)>G?t.c=t.e=null:M>n?t.c=[t.e=0]:(t.e=n,t.c=e),t}function S(t,e,n){var r=new Error(["new BigNumber","cmp","config","div","divToInt","eq","gt","gte","lt","lte","minus","mod","plus","precision","random","round","shift","times","toDigits","toExponential","toFixed","toFormat","toFraction","pow","toPrecision","toString","BigNumber"][t]+"() "+e+": "+n);throw r.name="BigNumber Error",R=0,r}function D(t,e,n,r){var o,i,s,a,u,c,l,f=t.c,p=N;if(f){t:{for(o=1,a=f[0];a>=10;a/=10,o++);if(i=e-o,0>i)i+=F,s=e,u=f[c=0],l=u/p[o-s-1]%10|0;else if(c=g((i+1)/F),c>=f.length){if(!r)break t;for(;f.length<=c;f.push(0));u=l=0,o=1,i%=F,s=i-F+1}else{for(u=a=f[c],o=1;a>=10;a/=10,o++);i%=F,s=i-F+o,l=0>s?0:u/p[o-s-1]%10|0}if(r=r||0>e||null!=f[c+1]||(0>s?u:u%p[o-s-1]),r=4>n?(l||r)&&(0==n||n==(t.s<0?3:2)):l>5||5==l&&(4==n||r||6==n&&(i>0?s>0?u/p[o-s]:0:f[c-1])%10&1||n==(t.s<0?8:7)),1>e||!f[0])return f.length=0,r?(e-=t.e+1,f[0]=p[e%F],t.e=-e||0):f[0]=t.e=0,t;if(0==i?(f.length=c,a=1,c--):(f.length=c+1,a=p[F-i],f[c]=s>0?v(u/p[o-s]%p[s])*a:0),r)for(;;){if(0==c){for(i=1,s=f[0];s>=10;s/=10,i++);for(s=f[0]+=a,a=1;s>=10;s/=10,a++);i!=a&&(t.e++,f[0]==I&&(f[0]=1));break}if(f[c]+=a,f[c]!=I)break;f[c--]=0,a=1}for(i=f.length;0===f[--i];f.pop());}t.e>G?t.c=t.e=null:t.e<M&&(t.c=[t.e=0])}return t}var C,R=0,E=e.prototype,L=new e(1),H=20,j=4,q=-7,U=21,M=-1e7,G=1e7,W=!0,z=B,$=!1,J=1,V=100,X={decimalSeparator:".",groupSeparator:",",groupSize:3,secondaryGroupSize:0,fractionGroupSeparator:" ",fractionGroupSize:0};return e.another=r,e.ROUND_UP=0,e.ROUND_DOWN=1,e.ROUND_CEIL=2,e.ROUND_FLOOR=3,e.ROUND_HALF_UP=4,e.ROUND_HALF_DOWN=5,e.ROUND_HALF_EVEN=6,e.ROUND_HALF_CEIL=7,e.ROUND_HALF_FLOOR=8,e.EUCLID=9,e.config=function(){var t,e,n=0,r={},o=arguments,i=o[0],s=i&&"object"==typeof i?function(){return i.hasOwnProperty(e)?null!=(t=i[e]):void 0}:function(){return o.length>n?null!=(t=o[n++]):void 0};return s(e="DECIMAL_PLACES")&&z(t,0,O,2,e)&&(H=0|t),r[e]=H,s(e="ROUNDING_MODE")&&z(t,0,8,2,e)&&(j=0|t),r[e]=j,s(e="EXPONENTIAL_AT")&&(u(t)?z(t[0],-O,0,2,e)&&z(t[1],0,O,2,e)&&(q=0|t[0],U=0|t[1]):z(t,-O,O,2,e)&&(q=-(U=0|(0>t?-t:t)))),r[e]=[q,U],s(e="RANGE")&&(u(t)?z(t[0],-O,-1,2,e)&&z(t[1],1,O,2,e)&&(M=0|t[0],G=0|t[1]):z(t,-O,O,2,e)&&(0|t?M=-(G=0|(0>t?-t:t)):W&&S(2,e+" cannot be zero",t))),r[e]=[M,G],s(e="ERRORS")&&(t===!!t||1===t||0===t?(R=0,z=(W=!!t)?B:a):W&&S(2,e+b,t)),r[e]=W,s(e="CRYPTO")&&(t===!!t||1===t||0===t?($=!(!t||!m||"object"!=typeof m),t&&!$&&W&&S(2,"crypto unavailable",m)):W&&S(2,e+b,t)),r[e]=$,s(e="MODULO_MODE")&&z(t,0,9,2,e)&&(J=0|t),r[e]=J,s(e="POW_PRECISION")&&z(t,0,O,2,e)&&(V=0|t),r[e]=V,s(e="FORMAT")&&("object"==typeof t?X=t:W&&S(2,e+" not an object",t)),r[e]=X,r},e.max=function(){return A(arguments,E.lt)},e.min=function(){return A(arguments,E.gt)},e.random=function(){var t=9007199254740992,n=Math.random()*t&2097151?function(){return v(Math.random()*t)}:function(){return 8388608*(1073741824*Math.random()|0)+(8388608*Math.random()|0)};return function(t){var r,o,i,s,a,u=0,c=[],l=new e(L);if(t=null!=t&&z(t,0,O,14)?0|t:H,s=g(t/F),$)if(m&&m.getRandomValues){for(r=m.getRandomValues(new Uint32Array(s*=2));s>u;)a=131072*r[u]+(r[u+1]>>>11),a>=9e15?(o=m.getRandomValues(new Uint32Array(2)),r[u]=o[0],r[u+1]=o[1]):(c.push(a%1e14),u+=2);u=s/2}else if(m&&m.randomBytes){for(r=m.randomBytes(s*=7);s>u;)a=281474976710656*(31&r[u])+1099511627776*r[u+1]+4294967296*r[u+2]+16777216*r[u+3]+(r[u+4]<<16)+(r[u+5]<<8)+r[u+6],
a>=9e15?m.randomBytes(7).copy(r,u):(c.push(a%1e14),u+=7);u=s/7}else W&&S(14,"crypto unavailable",m);if(!u)for(;s>u;)a=n(),9e15>a&&(c[u++]=a%1e14);for(s=c[--u],t%=F,s&&t&&(a=N[F-t],c[u]=v(s/a)*a);0===c[u];c.pop(),u--);if(0>u)c=[i=0];else{for(i=-1;0===c[0];c.shift(),i-=F);for(u=1,a=c[0];a>=10;a/=10,u++);F>u&&(i-=F-u)}return l.e=i,l.c=c,l}}(),C=function(){function t(t,e,n){var r,o,i,s,a=0,u=t.length,c=e%T,l=e/T|0;for(t=t.slice();u--;)i=t[u]%T,s=t[u]/T|0,r=l*i+s*c,o=c*i+r%T*T+a,a=(o/n|0)+(r/T|0)+l*s,t[u]=o%n;return a&&t.unshift(a),t}function n(t,e,n,r){var o,i;if(n!=r)i=n>r?1:-1;else for(o=i=0;n>o;o++)if(t[o]!=e[o]){i=t[o]>e[o]?1:-1;break}return i}function r(t,e,n,r){for(var o=0;n--;)t[n]-=o,o=t[n]<e[n]?1:0,t[n]=o*r+t[n]-e[n];for(;!t[0]&&t.length>1;t.shift());}return function(i,s,a,u,c){var l,f,p,h,m,d,y,g,b,w,_,x,k,N,T,O,A,B=i.s==s.s?1:-1,P=i.c,S=s.c;if(!(P&&P[0]&&S&&S[0]))return new e(i.s&&s.s&&(P?!S||P[0]!=S[0]:S)?P&&0==P[0]||!S?0*B:B/0:0/0);for(g=new e(B),b=g.c=[],f=i.e-s.e,B=a+f+1,c||(c=I,f=o(i.e/F)-o(s.e/F),B=B/F|0),p=0;S[p]==(P[p]||0);p++);if(S[p]>(P[p]||0)&&f--,0>B)b.push(1),h=!0;else{for(N=P.length,O=S.length,p=0,B+=2,m=v(c/(S[0]+1)),m>1&&(S=t(S,m,c),P=t(P,m,c),O=S.length,N=P.length),k=O,w=P.slice(0,O),_=w.length;O>_;w[_++]=0);A=S.slice(),A.unshift(0),T=S[0],S[1]>=c/2&&T++;do{if(m=0,l=n(S,w,O,_),0>l){if(x=w[0],O!=_&&(x=x*c+(w[1]||0)),m=v(x/T),m>1)for(m>=c&&(m=c-1),d=t(S,m,c),y=d.length,_=w.length;1==n(d,w,y,_);)m--,r(d,y>O?A:S,y,c),y=d.length,l=1;else 0==m&&(l=m=1),d=S.slice(),y=d.length;if(_>y&&d.unshift(0),r(w,d,_,c),_=w.length,-1==l)for(;n(S,w,O,_)<1;)m++,r(w,_>O?A:S,_,c),_=w.length}else 0===l&&(m++,w=[0]);b[p++]=m,w[0]?w[_++]=P[k]||0:(w=[P[k]],_=1)}while((k++<N||null!=w[0])&&B--);h=null!=w[0],b[0]||b.shift()}if(c==I){for(p=1,B=b[0];B>=10;B/=10,p++);D(g,a+(g.e=p+f*F-1)+1,u,h)}else g.e=f,g.r=+h;return g}}(),d=function(){var t=/^(-?)0([xbo])/i,n=/^([^.]+)\.$/,r=/^\.([^.]+)$/,o=/^-?(Infinity|NaN)$/,i=/^\s*\+|^\s+|\s+$/g;return function(s,a,u,c){var l,f=u?a:a.replace(i,"");if(o.test(f))s.s=isNaN(f)?null:0>f?-1:1;else{if(!u&&(f=f.replace(t,function(t,e,n){return l="x"==(n=n.toLowerCase())?16:"b"==n?2:8,c&&c!=l?t:e}),c&&(l=c,f=f.replace(n,"$1").replace(r,"0.$1")),a!=f))return new e(f,l);W&&S(R,"not a"+(c?" base "+c:"")+" number",a),s.s=null}s.c=s.e=null,R=0}}(),E.absoluteValue=E.abs=function(){var t=new e(this);return t.s<0&&(t.s=1),t},E.ceil=function(){return D(new e(this),this.e+1,2)},E.comparedTo=E.cmp=function(t,n){return R=1,s(this,new e(t,n))},E.decimalPlaces=E.dp=function(){var t,e,n=this.c;if(!n)return null;if(t=((e=n.length-1)-o(this.e/F))*F,e=n[e])for(;e%10==0;e/=10,t--);return 0>t&&(t=0),t},E.dividedBy=E.div=function(t,n){return R=3,C(this,new e(t,n),H,j)},E.dividedToIntegerBy=E.divToInt=function(t,n){return R=4,C(this,new e(t,n),0,1)},E.equals=E.eq=function(t,n){return R=5,0===s(this,new e(t,n))},E.floor=function(){return D(new e(this),this.e+1,3)},E.greaterThan=E.gt=function(t,n){return R=6,s(this,new e(t,n))>0},E.greaterThanOrEqualTo=E.gte=function(t,n){return R=7,1===(n=s(this,new e(t,n)))||0===n},E.isFinite=function(){return!!this.c},E.isInteger=E.isInt=function(){return!!this.c&&o(this.e/F)>this.c.length-2},E.isNaN=function(){return!this.s},E.isNegative=E.isNeg=function(){return this.s<0},E.isZero=function(){return!!this.c&&0==this.c[0]},E.lessThan=E.lt=function(t,n){return R=8,s(this,new e(t,n))<0},E.lessThanOrEqualTo=E.lte=function(t,n){return R=9,-1===(n=s(this,new e(t,n)))||0===n},E.minus=E.sub=function(t,n){var r,i,s,a,u=this,c=u.s;if(R=10,t=new e(t,n),n=t.s,!c||!n)return new e(0/0);if(c!=n)return t.s=-n,u.plus(t);var l=u.e/F,f=t.e/F,p=u.c,h=t.c;if(!l||!f){if(!p||!h)return p?(t.s=-n,t):new e(h?u:0/0);if(!p[0]||!h[0])return h[0]?(t.s=-n,t):new e(p[0]?u:3==j?-0:0)}if(l=o(l),f=o(f),p=p.slice(),c=l-f){for((a=0>c)?(c=-c,s=p):(f=l,s=h),s.reverse(),n=c;n--;s.push(0));s.reverse()}else for(i=(a=(c=p.length)<(n=h.length))?c:n,c=n=0;i>n;n++)if(p[n]!=h[n]){a=p[n]<h[n];break}if(a&&(s=p,p=h,h=s,t.s=-t.s),n=(i=h.length)-(r=p.length),n>0)for(;n--;p[r++]=0);for(n=I-1;i>c;){if(p[--i]<h[i]){for(r=i;r&&!p[--r];p[r]=n);--p[r],p[i]+=I}p[i]-=h[i]}for(;0==p[0];p.shift(),--f);return p[0]?P(t,p,f):(t.s=3==j?-1:1,t.c=[t.e=0],t)},E.modulo=E.mod=function(t,n){var r,o,i=this;return R=11,t=new e(t,n),!i.c||!t.s||t.c&&!t.c[0]?new e(0/0):!t.c||i.c&&!i.c[0]?new e(i):(9==J?(o=t.s,t.s=1,r=C(i,t,0,3),t.s=o,r.s*=o):r=C(i,t,0,J),i.minus(r.times(t)))},E.negated=E.neg=function(){var t=new e(this);return t.s=-t.s||null,t},E.plus=E.add=function(t,n){var r,i=this,s=i.s;if(R=12,t=new e(t,n),n=t.s,!s||!n)return new e(0/0);if(s!=n)return t.s=-n,i.minus(t);var a=i.e/F,u=t.e/F,c=i.c,l=t.c;if(!a||!u){if(!c||!l)return new e(s/0);if(!c[0]||!l[0])return l[0]?t:new e(c[0]?i:0*s)}if(a=o(a),u=o(u),c=c.slice(),s=a-u){for(s>0?(u=a,r=l):(s=-s,r=c),r.reverse();s--;r.push(0));r.reverse()}for(s=c.length,n=l.length,0>s-n&&(r=l,l=c,c=r,n=s),s=0;n;)s=(c[--n]=c[n]+l[n]+s)/I|0,c[n]%=I;return s&&(c.unshift(s),++u),P(t,c,u)},E.precision=E.sd=function(t){var e,n,r=this,o=r.c;if(null!=t&&t!==!!t&&1!==t&&0!==t&&(W&&S(13,"argument"+b,t),t!=!!t&&(t=null)),!o)return null;if(n=o.length-1,e=n*F+1,n=o[n]){for(;n%10==0;n/=10,e--);for(n=o[0];n>=10;n/=10,e++);}return t&&r.e+1>e&&(e=r.e+1),e},E.round=function(t,n){var r=new e(this);return(null==t||z(t,0,O,15))&&D(r,~~t+this.e+1,null!=n&&z(n,0,8,15,w)?0|n:j),r},E.shift=function(t){var n=this;return z(t,-k,k,16,"argument")?n.times("1e"+p(t)):new e(n.c&&n.c[0]&&(-k>t||t>k)?n.s*(0>t?0:1/0):n)},E.squareRoot=E.sqrt=function(){var t,n,r,s,a,u=this,c=u.c,l=u.s,f=u.e,p=H+4,h=new e("0.5");if(1!==l||!c||!c[0])return new e(!l||0>l&&(!c||c[0])?0/0:c?u:1/0);if(l=Math.sqrt(+u),0==l||l==1/0?(n=i(c),(n.length+f)%2==0&&(n+="0"),l=Math.sqrt(n),f=o((f+1)/2)-(0>f||f%2),l==1/0?n="1e"+f:(n=l.toExponential(),n=n.slice(0,n.indexOf("e")+1)+f),r=new e(n)):r=new e(l+""),r.c[0])for(f=r.e,l=f+p,3>l&&(l=0);;)if(a=r,r=h.times(a.plus(C(u,a,p,1))),i(a.c).slice(0,l)===(n=i(r.c)).slice(0,l)){if(r.e<f&&--l,n=n.slice(l-3,l+1),"9999"!=n&&(s||"4999"!=n)){(!+n||!+n.slice(1)&&"5"==n.charAt(0))&&(D(r,r.e+H+2,1),t=!r.times(r).eq(u));break}if(!s&&(D(a,a.e+H+2,0),a.times(a).eq(u))){r=a;break}p+=4,l+=4,s=1}return D(r,r.e+H+1,j,t)},E.times=E.mul=function(t,n){var r,i,s,a,u,c,l,f,p,h,m,d,y,g,v,b=this,w=b.c,_=(R=17,t=new e(t,n)).c;if(!(w&&_&&w[0]&&_[0]))return!b.s||!t.s||w&&!w[0]&&!_||_&&!_[0]&&!w?t.c=t.e=t.s=null:(t.s*=b.s,w&&_?(t.c=[0],t.e=0):t.c=t.e=null),t;for(i=o(b.e/F)+o(t.e/F),t.s*=b.s,l=w.length,h=_.length,h>l&&(y=w,w=_,_=y,s=l,l=h,h=s),s=l+h,y=[];s--;y.push(0));for(g=I,v=T,s=h;--s>=0;){for(r=0,m=_[s]%v,d=_[s]/v|0,u=l,a=s+u;a>s;)f=w[--u]%v,p=w[u]/v|0,c=d*f+p*m,f=m*f+c%v*v+y[a]+r,r=(f/g|0)+(c/v|0)+d*p,y[a--]=f%g;y[a]=r}return r?++i:y.shift(),P(t,y,i)},E.toDigits=function(t,n){var r=new e(this);return t=null!=t&&z(t,1,O,18,"precision")?0|t:null,n=null!=n&&z(n,0,8,18,w)?0|n:j,t?D(r,t,n):r},E.toExponential=function(t,e){return h(this,null!=t&&z(t,0,O,19)?~~t+1:null,e,19)},E.toFixed=function(t,e){return h(this,null!=t&&z(t,0,O,20)?~~t+this.e+1:null,e,20)},E.toFormat=function(t,e){var n=h(this,null!=t&&z(t,0,O,21)?~~t+this.e+1:null,e,21);if(this.c){var r,o=n.split("."),i=+X.groupSize,s=+X.secondaryGroupSize,a=X.groupSeparator,u=o[0],c=o[1],l=this.s<0,f=l?u.slice(1):u,p=f.length;if(s&&(r=i,i=s,s=r,p-=r),i>0&&p>0){for(r=p%i||i,u=f.substr(0,r);p>r;r+=i)u+=a+f.substr(r,i);s>0&&(u+=a+f.slice(r)),l&&(u="-"+u)}n=c?u+X.decimalSeparator+((s=+X.fractionGroupSize)?c.replace(new RegExp("\\d{"+s+"}\\B","g"),"$&"+X.fractionGroupSeparator):c):u}return n},E.toFraction=function(t){var n,r,o,s,a,u,c,l,f,p=W,h=this,m=h.c,d=new e(L),y=r=new e(L),g=c=new e(L);if(null!=t&&(W=!1,u=new e(t),W=p,(!(p=u.isInt())||u.lt(L))&&(W&&S(22,"max denominator "+(p?"out of range":"not an integer"),t),t=!p&&u.c&&D(u,u.e+1,1).gte(L)?u:null)),!m)return h.toString();for(f=i(m),s=d.e=f.length-h.e-1,d.c[0]=N[(a=s%F)<0?F+a:a],t=!t||u.cmp(d)>0?s>0?d:y:u,a=G,G=1/0,u=new e(f),c.c[0]=0;l=C(u,d,0,1),o=r.plus(l.times(g)),1!=o.cmp(t);)r=g,g=o,y=c.plus(l.times(o=y)),c=o,d=u.minus(l.times(o=d)),u=o;return o=C(t.minus(r),g,0,1),c=c.plus(o.times(y)),r=r.plus(o.times(g)),c.s=y.s=h.s,s*=2,n=C(y,g,s,j).minus(h).abs().cmp(C(c,r,s,j).minus(h).abs())<1?[y.toString(),g.toString()]:[c.toString(),r.toString()],G=a,n},E.toNumber=function(){var t=this;return+t||(t.s?0*t.s:0/0)},E.toPower=E.pow=function(t){var n,r,o=v(0>t?-t:+t),i=this;if(!z(t,-k,k,23,"exponent")&&(!isFinite(t)||o>k&&(t/=0)||parseFloat(t)!=t&&!(t=0/0)))return new e(Math.pow(+i,t));for(n=V?g(V/F+2):0,r=new e(L);;){if(o%2){if(r=r.times(i),!r.c)break;n&&r.c.length>n&&(r.c.length=n)}if(o=v(o/2),!o)break;i=i.times(i),n&&i.c&&i.c.length>n&&(i.c.length=n)}return 0>t&&(r=L.div(r)),n?D(r,V,j):r},E.toPrecision=function(t,e){return h(this,null!=t&&z(t,1,O,24,"precision")?0|t:null,e,24)},E.toString=function(t){var e,r=this,o=r.s,s=r.e;return null===s?o?(e="Infinity",0>o&&(e="-"+e)):e="NaN":(e=i(r.c),e=null!=t&&z(t,2,64,25,"base")?n(f(e,s),0|t,10,o):q>=s||s>=U?l(e,s):f(e,s),0>o&&r.c[0]&&(e="-"+e)),e},E.truncated=E.trunc=function(){return D(new e(this),this.e+1,1)},E.valueOf=E.toJSON=function(){return this.toString()},null!=t&&e.config(t),e}function o(t){var e=0|t;return t>0||t===e?e:e-1}function i(t){for(var e,n,r=1,o=t.length,i=t[0]+"";o>r;){for(e=t[r++]+"",n=F-e.length;n--;e="0"+e);i+=e}for(o=i.length;48===i.charCodeAt(--o););return i.slice(0,o+1||1)}function s(t,e){var n,r,o=t.c,i=e.c,s=t.s,a=e.s,u=t.e,c=e.e;if(!s||!a)return null;if(n=o&&!o[0],r=i&&!i[0],n||r)return n?r?0:-a:s;if(s!=a)return s;if(n=0>s,r=u==c,!o||!i)return r?0:!o^n?1:-1;if(!r)return u>c^n?1:-1;for(a=(u=o.length)<(c=i.length)?u:c,s=0;a>s;s++)if(o[s]!=i[s])return o[s]>i[s]^n?1:-1;return u==c?0:u>c^n?1:-1}function a(t,e,n){return(t=p(t))>=e&&n>=t}function u(t){return"[object Array]"==Object.prototype.toString.call(t)}function c(t,e,n){for(var r,o,i=[0],s=0,a=t.length;a>s;){for(o=i.length;o--;i[o]*=e);for(i[r=0]+=x.indexOf(t.charAt(s++));r<i.length;r++)i[r]>n-1&&(null==i[r+1]&&(i[r+1]=0),i[r+1]+=i[r]/n|0,i[r]%=n)}return i.reverse()}function l(t,e){return(t.length>1?t.charAt(0)+"."+t.slice(1):t)+(0>e?"e":"e+")+e}function f(t,e){var n,r;if(0>e){for(r="0.";++e;r+="0");t=r+t}else if(n=t.length,++e>n){for(r="0",e-=n;--e;r+="0");t+=r}else n>e&&(t=t.slice(0,e)+"."+t.slice(e));return t}function p(t){return t=parseFloat(t),0>t?g(t):v(t)}var h,m,d,y=/^-?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i,g=Math.ceil,v=Math.floor,b=" not a boolean or binary digit",w="rounding mode",_="number type has more than 15 significant digits",x="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_",I=1e14,F=14,k=9007199254740991,N=[1,10,100,1e3,1e4,1e5,1e6,1e7,1e8,1e9,1e10,1e11,1e12,1e13],T=1e7,O=1e9;if(h=r(),"function"==typeof define&&define.amd)define(function(){return h});else if("undefined"!=typeof e&&e.exports){if(e.exports=h,!m)try{m=t("crypto")}catch(A){}}else n.BigNumber=h}(this)},{crypto:41}],web3:[function(t,e,n){var r=t("./lib/web3");r.providers.HttpProvider=t("./lib/web3/httpprovider"),r.providers.IpcProvider=t("./lib/web3/ipcprovider"),r.eth.contract=t("./lib/web3/contract"),r.eth.namereg=t("./lib/web3/namereg"),r.eth.sendIBANTransaction=t("./lib/web3/transfer"),"undefined"!=typeof window&&"undefined"==typeof window.web3&&(window.web3=r),e.exports=r},{"./lib/web3":18,"./lib/web3/contract":21,"./lib/web3/httpprovider":29,"./lib/web3/ipcprovider":31,"./lib/web3/namereg":34,"./lib/web3/transfer":39}]},{},["web3"]);

(function() {
  var factory;

  factory = function(Promise, web3) {
    var Pudding;
    Pudding = (function() {
      function Pudding() {}

      Pudding.global_defaults = {};

      Pudding.whisk = function(abi, code, class_defaults) {
        var contract;
        if (typeof code === "object") {
          class_defaults = code;
          code = null;
        }
        contract = web3.eth.contract(abi);
        contract = Pudding.inject_defaults(contract, class_defaults);
        contract = Pudding.synchronize_contract(contract);
        contract = Pudding.make_nicer_new(contract, code);
        if (Promise != null) {
          contract = Pudding.promisify_contract(contract);
        }
        return contract;
      };

      Pudding.defaults = function(new_global_defaults) {
        var key, value;
        if (new_global_defaults == null) {
          new_global_defaults = {};
        }
        for (key in new_global_defaults) {
          value = new_global_defaults[key];
          Pudding.global_defaults[key] = value;
        }
        return Pudding.global_defaults;
      };

      Pudding.merge = function() {
        var i, key, len, merged, object, value;
        merged = {};
        for (i = 0, len = arguments.length; i < len; i++) {
          object = arguments[i];
          for (key in object) {
            value = object[key];
            merged[key] = value;
          }
        }
        return merged;
      };

      Pudding.is_object = function(val) {
        return typeof val === "object" && !(val instanceof Array);
      };

      Pudding.inject_defaults = function(contract_class, class_defaults) {
        var inject, old_at, old_new;
        old_at = contract_class.at;
        old_new = contract_class["new"];
        inject = (function(_this) {
          return function(instance, instance_defaults) {
            var abi_object, fn, fn_name, i, key, len, merged_defaults, ref, value;
            if (instance_defaults == null) {
              instance_defaults = {};
            }
            merged_defaults = _this.merge(class_defaults, instance_defaults);
            ref = contract_class.abi;
            for (i = 0, len = ref.length; i < len; i++) {
              abi_object = ref[i];
              fn_name = abi_object.name;
              fn = instance[fn_name];
              if (fn == null) {
                continue;
              }
              instance[fn_name] = Pudding.inject_defaults_into_function(instance, fn, merged_defaults);
              for (key in fn) {
                value = fn[key];
                instance[fn_name][key] = value;
              }
              instance[fn_name].sendTransaction = Pudding.inject_defaults_into_function(instance, fn.sendTransaction, merged_defaults);
              instance[fn_name].call = Pudding.inject_defaults_into_function(instance, fn.call, merged_defaults);
            }
            return instance;
          };
        })(this);
        contract_class.at = function(address, instance_defaults) {
          var instance;
          if (instance_defaults == null) {
            instance_defaults = {};
          }
          instance = old_at.call(contract_class, address);
          return inject(instance, instance_defaults);
        };
        contract_class["new"] = (function(_this) {
          return function() {
            var args, callback, instance_defaults, tx_params;
            args = Array.prototype.slice.call(arguments);
            callback = args.pop();
            if (_this.is_object(args[args.length - 1]) && _this.is_object(args[args.length - 2])) {
              instance_defaults = args.pop();
              tx_params = args.pop();
            } else {
              instance_defaults = {};
              if (args[args.length - 1] === "object") {
                tx_params = args.pop();
              } else {
                tx_params = {};
              }
            }
            tx_params = _this.merge(Pudding.global_defaults, class_defaults, tx_params);
            args.push(tx_params, function(err, instance) {
              if (err != null) {
                callback(err);
                return;
              }
              return callback(null, inject(instance));
            });
            return old_new.apply(contract_class, args);
          };
        })(this);
        return contract_class;
      };

      Pudding.inject_defaults_into_function = function(instance, fn, merged_defaults) {
        return (function(_this) {
          return function() {
            var args, callback, old_options, options;
            args = Array.prototype.slice.call(arguments);
            callback = args.pop();
            options = _this.merge(Pudding.global_defaults, merged_defaults);
            if (_this.is_object(args[args.length - 1])) {
              old_options = args.pop();
              options = _this.merge(options, old_options);
            }
            args.push(options, callback);
            return fn.apply(instance, args);
          };
        })(this);
      };

      Pudding.promisify_contract = function(contract_class) {
        var old_at, old_new, promisify;
        old_at = contract_class.at;
        old_new = contract_class["new"];
        promisify = function(instance) {
          var fn, k, key, v;
          for (key in instance) {
            fn = instance[key];
            if (typeof fn !== "object" && typeof fn !== "function") {
              continue;
            }
            for (k in fn) {
              v = fn[k];
              if (typeof fn !== "object" && typeof fn !== "function") {
                continue;
              }
              fn[k] = Promise.promisify(v, instance);
            }
            instance[key] = Promise.promisify(fn, instance);
          }
          return instance;
        };
        contract_class.at = function(address, instance_defaults) {
          var instance;
          if (instance_defaults == null) {
            instance_defaults = {};
          }
          instance = old_at.call(contract_class, address, instance_defaults);
          return promisify(instance);
        };
        contract_class["new"] = Promise.promisify(function() {
          var args, callback;
          args = Array.prototype.slice.call(arguments);
          callback = args.pop();
          args.push(function(err, instance) {
            if (err != null) {
              callback(err);
            }
            return callback(null, promisify(instance));
          });
          return old_new.apply(contract_class, args);
        });
        return contract_class;
      };

      Pudding.make_nicer_new = function(contract_class, code) {
        var old_new;
        if (code == null) {
          code = "";
        }
        old_new = contract_class["new"];
        contract_class["new"] = (function(_this) {
          return function() {
            var args, callback, instance_defaults, intermediary, tx_params;
            args = Array.prototype.slice.call(arguments);
            callback = args.pop();
            if (_this.is_object(args[args.length - 1]) && _this.is_object(args[args.length - 2])) {
              instance_defaults = args.pop();
              tx_params = args.pop();
            } else {
              instance_defaults = {};
              if (_this.is_object(args[args.length - 1])) {
                tx_params = args.pop();
              } else {
                tx_params = {};
              }
            }
            if (tx_params.data == null) {
              tx_params.data = code;
            }
            intermediary = function(err, created_instance) {
              if (created_instance.address != null) {
                return callback(err, created_instance);
              }
            };
            args.push(tx_params, instance_defaults, intermediary);
            return old_new.apply(contract_class, args);
          };
        })(this);
        return contract_class;
      };

      Pudding.synchronize_function = function(instance, fn) {
        var attempts, interval, max_attempts;
        interval = null;
        max_attempts = 240;
        attempts = 0;
        return function() {
          var args, callback, new_callback;
          args = Array.prototype.slice.call(arguments);
          callback = args.pop();
          new_callback = function(error, response) {
            var make_attempt, tx;
            if (error != null) {
              callback(error, response);
              return;
            }
            tx = response;
            interval = null;
            make_attempt = function() {
              return web3.eth.getTransaction(tx, function(e, tx_info) {
                if (e != null) {
                  return;
                }
                if (tx_info.blockHash != null) {
                  clearInterval(interval);
                  callback(null, tx);
                }
                if (attempts >= max_attempts) {
                  clearInterval(interval);
                  callback("Transaction " + tx + " wasn't processed in " + attempts + " attempts!", tx);
                }
                return attempts += 1;
              });
            };
            interval = setInterval(make_attempt, 1000);
            return make_attempt();
          };
          args.push(new_callback);
          return fn.apply(instance, args);
        };
      };

      Pudding.synchronize_contract = function(contract_class) {
        var old_at, old_new, synchronize;
        old_at = contract_class.at;
        old_new = contract_class["new"];
        synchronize = function(instance) {
          var abi_object, fn, fn_name, i, key, len, ref, value;
          ref = contract_class.abi;
          for (i = 0, len = ref.length; i < len; i++) {
            abi_object = ref[i];
            fn_name = abi_object.name;
            fn = instance[fn_name];
            if (fn == null) {
              continue;
            }
            instance[fn_name] = Pudding.synchronize_function(instance, fn);
            for (key in fn) {
              value = fn[key];
              instance[fn_name][key] = value;
            }
          }
          return instance;
        };
        contract_class.at = function(address, instance_defaults) {
          var instance;
          if (instance_defaults == null) {
            instance_defaults = {};
          }
          instance = old_at.call(contract_class, address, instance_defaults);
          return synchronize(instance);
        };
        contract_class["new"] = function() {
          var args, callback;
          args = Array.prototype.slice.call(arguments);
          callback = args.pop();
          args.push(function(err, instance) {
            if (err != null) {
              callback(err);
              return;
            }
            return callback(null, synchronize(instance));
          });
          return old_new.apply(contract_class, args);
        };
        return contract_class;
      };

      return Pudding;

    })();
    return Pudding;
  };

  if ((typeof module !== "undefined" && module !== null) && (module.exports != null)) {
    module.exports = factory(require("bluebird"), require("web3"));
  } else {
    window.Pudding = factory(Promise, web3);
  }

}).call(this);


// This file represents code that gets inserted into the frontend
// at build time. It's also used within Node for provisioning the
// REPL. Items in {{ }} are replaced prior to execution.
// NOTE: This is ES5 code! (with our own gerryrigged template.)

// The following line is to prevent errors in the browser.
var module = module || undefined;

(function(module) {
  var __helpers = {
    provision_contracts: function(scope) {
      scope.__contracts = JSON.parse("{\n  \"BlockNumber\": {\n    \"source\": \"/Users/peterbb/day_one/contracts/BlockNumber.sol\",\n    \"binary\": \"0x6060604052601f8060116000396000f30060606040523615600d57600d565b601d5b436000600050819055505b565b00\",\n    \"abi\": []\n  },\n  \"Incrementer\": {\n    \"source\": \"/Users/peterbb/day_one/contracts/Incrementer.sol\",\n    \"binary\": \"0x6060604052607e8060116000396000f30060606040523615603a576000357c01000000000000000000000000000000000000000000000000000000009004806306661abd14605657603a565b60545b60006000818150548092919060010191905055505b565b005b605f6004506075565b6040518082815260200191505060405180910390f35b6000600050548156\",\n    \"abi\": [\n      {\n        \"inputs\": [],\n        \"constant\": true,\n        \"name\": \"count\",\n        \"outputs\": [\n          {\n            \"type\": \"uint256\",\n            \"name\": \"\"\n          }\n        ],\n        \"type\": \"function\"\n      }\n    ]\n  },\n  \"KingOfTheHill\": {\n    \"source\": \"/Users/peterbb/day_one/contracts/KingOfTheHill.sol\",\n    \"binary\": \"0x606060405261010d806100136000396000f30060606040526000357c010000000000000000000000000000000000000000000000000000000090048063b0c8f9dc1461003957610037565b005b6100896004803590602001906004018035906020019191908080601f016020809104026020016040519081016040528093929190818152602001838380828437820191505050505050905061008b565b005b806000600050908051906020019082805482825590600052602060002090601f016020900481019282156100dc579182015b828111156100db5782518260005055916020019190600101906100bd565b5b50905061010791906100e9565b8082111561010357600081815060009055506001016100e9565b5090565b50505b5056\",\n    \"abi\": [\n      {\n        \"inputs\": [\n          {\n            \"type\": \"string\",\n            \"name\": \"_message\"\n          }\n        ],\n        \"constant\": false,\n        \"name\": \"add\",\n        \"outputs\": [],\n        \"type\": \"function\"\n      }\n    ]\n  },\n  \"TerraNullius\": {\n    \"source\": \"/Users/peterbb/day_one/contracts/TerraNullius.sol\",\n    \"binary\": \"0x60606040526103a7806100136000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480636bd5084a1461004f578063a888c2cd14610070578063f3fe12c9146100ff5761004d565b005b61005a600450610395565b6040518082815260200191505060405180910390f35b610081600480359060200150610151565b604051808473ffffffffffffffffffffffffffffffffffffffff1681526020018060200183815260200182810382528481815481526020019150805480156100ee57820191906000526020600020905b8154815290600101906020018083116100d157829003601f168201915b505094505050505060405180910390f35b61014f6004803590602001906004018035906020019191908080601f01602080910402602001604051908101604052809392919081815260200183838082843782019150505050505090506101af565b005b60006000508181548110156100025790600052602060002090600302016000915090508060000160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff169080600101600050908060020160005054905083565b600060006000505490506000600050805480919060010190908154818355818115116102885760030281600302836000526020600020918201910161028791906101f4565b808211156102835760006000820160006101000a81549073ffffffffffffffffffffffffffffffffffffffff021916905560018201600050805460008255601f01602090049060005260206000209081019061026e9190610250565b8082111561026a5760008181506000905550600101610250565b5090565b506002820160005060009055506001016101f4565b5090565b5b5050505060206040519081016040528033815260200183815260200143815260200150600060005082815481101561000257906000526020600020906003020160005060008201518160000160006101000a81548173ffffffffffffffffffffffffffffffffffffffff02191690830217905550602082015181600101600050908051906020019082805482825590600052602060002090601f01602090048101928215610353579182015b82811115610352578251826000505591602001919060010190610334565b5b50905061037e9190610360565b8082111561037a5760008181506000905550600101610360565b5090565b5050604082015181600201600050559050505b5050565b600060006000505490506103a4565b9056\",\n    \"abi\": [\n      {\n        \"inputs\": [],\n        \"constant\": false,\n        \"name\": \"number_of_claims\",\n        \"outputs\": [\n          {\n            \"type\": \"uint256\",\n            \"name\": \"result\"\n          }\n        ],\n        \"type\": \"function\"\n      },\n      {\n        \"inputs\": [\n          {\n            \"type\": \"uint256\",\n            \"name\": \"\"\n          }\n        ],\n        \"constant\": true,\n        \"name\": \"claims\",\n        \"outputs\": [\n          {\n            \"type\": \"address\",\n            \"name\": \"claimant\"\n          },\n          {\n            \"type\": \"string\",\n            \"name\": \"message\"\n          },\n          {\n            \"type\": \"uint256\",\n            \"name\": \"block_number\"\n          }\n        ],\n        \"type\": \"function\"\n      },\n      {\n        \"inputs\": [\n          {\n            \"type\": \"string\",\n            \"name\": \"message\"\n          }\n        ],\n        \"constant\": false,\n        \"name\": \"claim\",\n        \"outputs\": [],\n        \"type\": \"function\"\n      }\n    ]\n  },\n  \"TheAnswer\": {\n    \"source\": \"/Users/peterbb/day_one/contracts/TheAnswer.sol\",\n    \"binary\": \"0x606060405260368060116000396000f30060606040523615600d57600d565b601d5b6000602a9050601a565b90565b604051808260ff16815260200191505060405180910390f3\",\n    \"abi\": [],\n    \"address\": \"0xb4e4745d4c6e678c4e1c635d92818719740213c2\"\n  }\n}");

      for (var key in scope.__contracts) {
        var contract = scope.__contracts[key];
        scope[key] = Pudding.whisk(contract.abi, contract.binary);
        if (contract.address != null) {
          scope[key].deployed_address = contract.address;
        }
      }
    },
    set_provider: function(scope) {
      if ("localhost" != "" && "8545" != "") {
        web3.setProvider(new web3.providers.HttpProvider("http://localhost:8545"));
      } else {
        web3.setProvider(
          (function() {
            return eval("");
          })()
        );
      }
    }
  }

  // If we're in the browser, call the helpers using the global
  // (window) scope. If we're in node, export the helpers as a module.
  if (module == undefined || module == null) {
    __helpers.provision_contracts(window);
    __helpers.set_provider(window);
  } else {
    module.exports = __helpers;
  }
})(module);




(function() {
  var welcome_string;

  welcome_string = "Hello from Truffle!";

  console.log(welcome_string);

}).call(this);
