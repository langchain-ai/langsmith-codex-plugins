import * as nodeFs from "node:fs";
import * as nodeFsPromises from "node:fs/promises";
import * as nodePath from "node:path";
import { Worker } from "node:worker_threads";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
//#region \0rolldown/runtime.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
		key = keys[i];
		if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
			get: ((k) => from[k]).bind(null, key),
			enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
		});
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/validate.js
function validate(uuid) {
	return typeof uuid === "string" && regex_default.test(uuid);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/parse.js
function parse$1(uuid) {
	if (!validate(uuid)) throw TypeError("Invalid UUID");
	let v;
	return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255, v / 4294967296 & 255, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/stringify.js
/**
* Convert array of 16 byte values to UUID string format of the form:
* XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
*/
const byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/rng.js
const rnds8 = new Uint8Array(16);
function rng() {
	return crypto.getRandomValues(rnds8);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/v4.js
function v4(options, buf, offset) {
	if (!buf && !options && crypto.randomUUID) return crypto.randomUUID();
	return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
	options = options || {};
	const rnds = options.random ?? options.rng?.() ?? rng();
	if (rnds.length < 16) throw new Error("Random bytes length must be >= 16");
	rnds[6] = rnds[6] & 15 | 64;
	rnds[8] = rnds[8] & 63 | 128;
	if (buf) {
		offset = offset || 0;
		if (offset < 0 || offset + 16 > buf.length) throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
		for (let i = 0; i < 16; ++i) buf[offset + i] = rnds[i];
		return buf;
	}
	return unsafeStringify(rnds);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/sha1.js
function f(s, x, y, z) {
	switch (s) {
		case 0: return x & y ^ ~x & z;
		case 1: return x ^ y ^ z;
		case 2: return x & y ^ x & z ^ y & z;
		case 3: return x ^ y ^ z;
	}
}
function ROTL(x, n) {
	return x << n | x >>> 32 - n;
}
function sha1(bytes) {
	const K = [
		1518500249,
		1859775393,
		2400959708,
		3395469782
	];
	const H = [
		1732584193,
		4023233417,
		2562383102,
		271733878,
		3285377520
	];
	const newBytes = new Uint8Array(bytes.length + 1);
	newBytes.set(bytes);
	newBytes[bytes.length] = 128;
	bytes = newBytes;
	const l = bytes.length / 4 + 2;
	const N = Math.ceil(l / 16);
	const M = new Array(N);
	for (let i = 0; i < N; ++i) {
		const arr = new Uint32Array(16);
		for (let j = 0; j < 16; ++j) arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
		M[i] = arr;
	}
	M[N - 1][14] = (bytes.length - 1) * 8 / 2 ** 32;
	M[N - 1][14] = Math.floor(M[N - 1][14]);
	M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
	for (let i = 0; i < N; ++i) {
		const W = new Uint32Array(80);
		for (let t = 0; t < 16; ++t) W[t] = M[i][t];
		for (let t = 16; t < 80; ++t) W[t] = ROTL(W[t - 3] ^ W[t - 8] ^ W[t - 14] ^ W[t - 16], 1);
		let a = H[0];
		let b = H[1];
		let c = H[2];
		let d = H[3];
		let e = H[4];
		for (let t = 0; t < 80; ++t) {
			const s = Math.floor(t / 20);
			const T = ROTL(a, 5) + f(s, b, c, d) + e + K[s] + W[t] >>> 0;
			e = d;
			d = c;
			c = ROTL(b, 30) >>> 0;
			b = a;
			a = T;
		}
		H[0] = H[0] + a >>> 0;
		H[1] = H[1] + b >>> 0;
		H[2] = H[2] + c >>> 0;
		H[3] = H[3] + d >>> 0;
		H[4] = H[4] + e >>> 0;
	}
	return Uint8Array.of(H[0] >> 24, H[0] >> 16, H[0] >> 8, H[0], H[1] >> 24, H[1] >> 16, H[1] >> 8, H[1], H[2] >> 24, H[2] >> 16, H[2] >> 8, H[2], H[3] >> 24, H[3] >> 16, H[3] >> 8, H[3], H[4] >> 24, H[4] >> 16, H[4] >> 8, H[4]);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/v35.js
function stringToBytes(str) {
	str = unescape(encodeURIComponent(str));
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; ++i) bytes[i] = str.charCodeAt(i);
	return bytes;
}
const DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL$1 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function v35(version, hash, value, namespace, buf, offset) {
	const valueBytes = typeof value === "string" ? stringToBytes(value) : value;
	const namespaceBytes = typeof namespace === "string" ? parse$1(namespace) : namespace;
	if (typeof namespace === "string") namespace = parse$1(namespace);
	if (namespace?.length !== 16) throw TypeError("Namespace must be array-like (16 iterable integer values, 0-255)");
	let bytes = new Uint8Array(16 + valueBytes.length);
	bytes.set(namespaceBytes);
	bytes.set(valueBytes, namespaceBytes.length);
	bytes = hash(bytes);
	bytes[6] = bytes[6] & 15 | version;
	bytes[8] = bytes[8] & 63 | 128;
	if (buf) {
		offset ??= 0;
		if (offset < 0 || offset + 16 > buf.length) throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
		for (let i = 0; i < 16; ++i) buf[offset + i] = bytes[i];
		return buf;
	}
	return unsafeStringify(bytes);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/v5.js
function v5(value, namespace, buf, offset) {
	return v35(80, sha1, value, namespace, buf, offset);
}
v5.DNS = DNS;
v5.URL = URL$1;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/uuid/src/v7.js
const _state = {};
function v7(options, buf, offset) {
	let bytes;
	if (options) bytes = v7Bytes(options.random ?? options.rng?.() ?? rng(), options.msecs, options.seq, buf, offset);
	else {
		const now = Date.now();
		const rnds = rng();
		updateV7State(_state, now, rnds);
		bytes = v7Bytes(rnds, _state.msecs, _state.seq, buf, offset);
	}
	return buf ?? unsafeStringify(bytes);
}
function updateV7State(state, now, rnds) {
	state.msecs ??= -Infinity;
	state.seq ??= 0;
	if (now > state.msecs) {
		state.seq = rnds[6] << 23 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
		state.msecs = now;
	} else {
		state.seq = state.seq + 1 | 0;
		if (state.seq === 0) state.msecs++;
	}
	return state;
}
function v7Bytes(rnds, msecs, seq, buf, offset = 0) {
	if (rnds.length < 16) throw new Error("Random bytes length must be >= 16");
	if (!buf) {
		buf = new Uint8Array(16);
		offset = 0;
	} else if (offset < 0 || offset + 16 > buf.length) throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
	msecs ??= Date.now();
	seq ??= rnds[6] * 127 << 24 | rnds[7] << 16 | rnds[8] << 8 | rnds[9];
	buf[offset++] = msecs / 1099511627776 & 255;
	buf[offset++] = msecs / 4294967296 & 255;
	buf[offset++] = msecs / 16777216 & 255;
	buf[offset++] = msecs / 65536 & 255;
	buf[offset++] = msecs / 256 & 255;
	buf[offset++] = msecs & 255;
	buf[offset++] = 112 | seq >>> 28 & 15;
	buf[offset++] = seq >>> 20 & 255;
	buf[offset++] = 128 | seq >>> 14 & 63;
	buf[offset++] = seq >>> 6 & 255;
	buf[offset++] = seq << 2 & 255 | rnds[10] & 3;
	buf[offset++] = rnds[11];
	buf[offset++] = rnds[12];
	buf[offset++] = rnds[13];
	buf[offset++] = rnds[14];
	buf[offset++] = rnds[15];
	return buf;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/experimental/otel/constants.js
const GEN_AI_OPERATION_NAME = "gen_ai.operation.name";
const GEN_AI_SYSTEM = "gen_ai.system";
const GEN_AI_REQUEST_MODEL = "gen_ai.request.model";
const GEN_AI_RESPONSE_MODEL = "gen_ai.response.model";
const GEN_AI_USAGE_INPUT_TOKENS = "gen_ai.usage.input_tokens";
const GEN_AI_USAGE_OUTPUT_TOKENS = "gen_ai.usage.output_tokens";
const GEN_AI_USAGE_TOTAL_TOKENS = "gen_ai.usage.total_tokens";
const GEN_AI_REQUEST_MAX_TOKENS = "gen_ai.request.max_tokens";
const GEN_AI_REQUEST_TEMPERATURE = "gen_ai.request.temperature";
const GEN_AI_REQUEST_TOP_P = "gen_ai.request.top_p";
const GEN_AI_REQUEST_FREQUENCY_PENALTY = "gen_ai.request.frequency_penalty";
const GEN_AI_REQUEST_PRESENCE_PENALTY = "gen_ai.request.presence_penalty";
const GEN_AI_RESPONSE_FINISH_REASONS = "gen_ai.response.finish_reasons";
const GENAI_PROMPT = "gen_ai.prompt";
const GENAI_COMPLETION = "gen_ai.completion";
const GEN_AI_REQUEST_EXTRA_QUERY = "gen_ai.request.extra_query";
const GEN_AI_REQUEST_EXTRA_BODY = "gen_ai.request.extra_body";
const GEN_AI_SERIALIZED_NAME = "gen_ai.serialized.name";
const GEN_AI_SERIALIZED_SIGNATURE = "gen_ai.serialized.signature";
const GEN_AI_SERIALIZED_DOC = "gen_ai.serialized.doc";
const GEN_AI_RESPONSE_ID = "gen_ai.response.id";
const GEN_AI_RESPONSE_SERVICE_TIER = "gen_ai.response.service_tier";
const GEN_AI_RESPONSE_SYSTEM_FINGERPRINT = "gen_ai.response.system_fingerprint";
const GEN_AI_USAGE_INPUT_TOKEN_DETAILS = "gen_ai.usage.input_token_details";
const GEN_AI_USAGE_OUTPUT_TOKEN_DETAILS = "gen_ai.usage.output_token_details";
const LANGSMITH_SESSION_ID = "langsmith.trace.session_id";
const LANGSMITH_SESSION_NAME = "langsmith.trace.session_name";
const LANGSMITH_RUN_TYPE = "langsmith.span.kind";
const LANGSMITH_NAME = "langsmith.trace.name";
const LANGSMITH_METADATA = "langsmith.metadata";
const LANGSMITH_TAGS = "langsmith.span.tags";
const LANGSMITH_REQUEST_STREAMING = "langsmith.request.streaming";
const LANGSMITH_REQUEST_HEADERS = "langsmith.request.headers";
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/env.js
let globalEnv;
const isBrowser = () => typeof window !== "undefined" && typeof window.document !== "undefined";
const isWebWorker = () => typeof globalThis === "object" && globalThis.constructor && globalThis.constructor.name === "DedicatedWorkerGlobalScope";
const isJsDom = () => typeof window !== "undefined" && window.name === "nodejs" || typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
const isDeno = () => typeof Deno !== "undefined";
const isNode = () => typeof process !== "undefined" && typeof process.versions !== "undefined" && typeof process.versions.node !== "undefined" && !isDeno();
const getEnv = () => {
	if (globalEnv) return globalEnv;
	if (typeof Bun !== "undefined") globalEnv = "bun";
	else if (isBrowser()) globalEnv = "browser";
	else if (isNode()) globalEnv = "node";
	else if (isWebWorker()) globalEnv = "webworker";
	else if (isJsDom()) globalEnv = "jsdom";
	else if (isDeno()) globalEnv = "deno";
	else globalEnv = "other";
	return globalEnv;
};
let runtimeEnvironment;
function getRuntimeEnvironment() {
	if (runtimeEnvironment === void 0) runtimeEnvironment = {
		library: "langsmith",
		runtime: getEnv(),
		sdk: "langsmith-js",
		sdk_version: __version__,
		...getShas()
	};
	return runtimeEnvironment;
}
/**
* Retrieves the LangSmith-specific metadata from the current runtime environment.
*
* @returns {Record<string, string>}
*  - A record of LangSmith-specific metadata environment variables.
*/
function getLangSmithEnvVarsMetadata() {
	const allEnvVars = getLangSmithEnvironmentVariables();
	const envVars = {};
	const excluded = [
		"LANGCHAIN_API_KEY",
		"LANGCHAIN_ENDPOINT",
		"LANGCHAIN_TRACING_V2",
		"LANGCHAIN_PROJECT",
		"LANGCHAIN_SESSION",
		"LANGSMITH_API_KEY",
		"LANGSMITH_ENDPOINT",
		"LANGSMITH_TRACING_V2",
		"LANGSMITH_PROJECT",
		"LANGSMITH_SESSION"
	];
	for (const [key, value] of Object.entries(allEnvVars)) if (typeof value === "string" && !excluded.includes(key) && !key.toLowerCase().includes("key") && !key.toLowerCase().includes("secret") && !key.toLowerCase().includes("token")) if (key === "LANGCHAIN_REVISION_ID") envVars["revision_id"] = value;
	else envVars[key] = value;
	return envVars;
}
/**
* Retrieves only the LangChain/LangSmith-prefixed environment variables from the current runtime environment.
* This is more efficient than copying all environment variables.
*
* @returns {Record<string, string>}
*  - A record of LangChain/LangSmith environment variables.
*/
function getLangSmithEnvironmentVariables() {
	const envVars = {};
	try {
		if (typeof process !== "undefined" && process.env) {
			for (const [key, value] of Object.entries(process.env)) if ((key.startsWith("LANGCHAIN_") || key.startsWith("LANGSMITH_")) && value != null) if ((key.toLowerCase().includes("key") || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) && typeof value === "string") envVars[key] = value.slice(0, 2) + "*".repeat(value.length - 4) + value.slice(-2);
			else envVars[key] = value;
		}
	} catch (_e) {}
	return envVars;
}
function getEnvironmentVariable(name) {
	try {
		return typeof process !== "undefined" ? process.env?.[name] : void 0;
	} catch (_e) {
		return;
	}
}
function getLangSmithEnvironmentVariable(name) {
	return getEnvironmentVariable(`LANGSMITH_${name}`) || getEnvironmentVariable(`LANGCHAIN_${name}`);
}
let cachedCommitSHAs;
/**
* Get the Git commit SHA from common environment variables
* used by different CI/CD platforms.
* @returns {string | undefined} The Git commit SHA or undefined if not found.
*/
function getShas() {
	if (cachedCommitSHAs !== void 0) return cachedCommitSHAs;
	const common_release_envs = [
		"VERCEL_GIT_COMMIT_SHA",
		"NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA",
		"COMMIT_REF",
		"RENDER_GIT_COMMIT",
		"CI_COMMIT_SHA",
		"CIRCLE_SHA1",
		"CF_PAGES_COMMIT_SHA",
		"REACT_APP_GIT_SHA",
		"SOURCE_VERSION",
		"GITHUB_SHA",
		"TRAVIS_COMMIT",
		"GIT_COMMIT",
		"BUILD_VCS_NUMBER",
		"bamboo_planRepository_revision",
		"Build.SourceVersion",
		"BITBUCKET_COMMIT",
		"DRONE_COMMIT_SHA",
		"SEMAPHORE_GIT_SHA",
		"BUILDKITE_COMMIT"
	];
	const shas = {};
	for (const env of common_release_envs) {
		const envVar = getEnvironmentVariable(env);
		if (envVar !== void 0) shas[env] = envVar;
	}
	cachedCommitSHAs = shas;
	return shas;
}
function getOtelEnabled() {
	return getEnvironmentVariable("OTEL_ENABLED") === "true" || getLangSmithEnvironmentVariable("OTEL_ENABLED") === "true";
}
const _VALID_TRACING_MODES = new Set(["langsmith", "otel"]);
/**
* Resolve the effective tracing mode from an explicit config value and
* environment variables.
*
* Priority: explicit argument > `LANGSMITH_TRACING_MODE` env var >
* legacy `OTEL_ENABLED` / `LANGSMITH_OTEL_ENABLED` env vars > `"langsmith"`.
*/
function resolveTracingMode(configValue) {
	if (configValue !== void 0) return configValue;
	const envMode = getLangSmithEnvironmentVariable("TRACING_MODE");
	if (envMode !== void 0 && envMode !== "") {
		const lower = envMode.toLowerCase();
		if (!_VALID_TRACING_MODES.has(lower)) throw new Error(`Invalid LANGSMITH_TRACING_MODE=${JSON.stringify(envMode)}. Must be one of: ${[..._VALID_TRACING_MODES].sort().join(", ")}`);
		if (getOtelEnabled()) console.warn("Both LANGSMITH_TRACING_MODE and the legacy OTEL_ENABLED / LANGSMITH_OTEL_ENABLED env vars are set. LANGSMITH_TRACING_MODE takes precedence.");
		return lower;
	}
	if (getOtelEnabled()) return "otel";
	return "langsmith";
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/singletons/otel.js
var MockTracer = class {
	constructor() {
		Object.defineProperty(this, "hasWarned", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	startActiveSpan(_name, ...args) {
		if (!this.hasWarned && resolveTracingMode() === "otel") {
			console.warn("OTel tracing mode is active (via LANGSMITH_TRACING_MODE, OTEL_ENABLED, or LANGSMITH_OTEL_ENABLED), but the required OTEL instances have not been initialized. Please add:\n```\nimport { initializeOTEL } from \"langsmith/experimental/otel/setup\";\ninitializeOTEL();\n```\nat the beginning of your code.");
			this.hasWarned = true;
		}
		let fn;
		if (args.length === 1 && typeof args[0] === "function") fn = args[0];
		else if (args.length === 2 && typeof args[1] === "function") fn = args[1];
		else if (args.length === 3 && typeof args[2] === "function") fn = args[2];
		if (typeof fn === "function") return fn();
	}
};
var MockOTELTrace = class {
	constructor() {
		Object.defineProperty(this, "mockTracer", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new MockTracer()
		});
	}
	getTracer(_name, _version) {
		return this.mockTracer;
	}
	getActiveSpan() {}
	setSpan(context, _span) {
		return context;
	}
	getSpan(_context) {}
	setSpanContext(context, _spanContext) {
		return context;
	}
	getTracerProvider() {}
	setGlobalTracerProvider(_tracerProvider) {
		return false;
	}
};
var MockOTELContext = class {
	active() {
		return {};
	}
	with(_context, fn) {
		return fn();
	}
};
const OTEL_TRACE_KEY = Symbol.for("ls:otel_trace");
const OTEL_CONTEXT_KEY = Symbol.for("ls:otel_context");
const OTEL_GET_DEFAULT_OTLP_TRACER_PROVIDER_KEY = Symbol.for("ls:otel_get_default_otlp_tracer_provider");
const mockOTELTrace = new MockOTELTrace();
const mockOTELContext = new MockOTELContext();
var OTELProvider = class {
	getTraceInstance() {
		return globalThis[OTEL_TRACE_KEY] ?? mockOTELTrace;
	}
	getContextInstance() {
		return globalThis[OTEL_CONTEXT_KEY] ?? mockOTELContext;
	}
	initializeGlobalInstances(otel) {
		if (globalThis[OTEL_TRACE_KEY] === void 0) globalThis[OTEL_TRACE_KEY] = otel.trace;
		if (globalThis[OTEL_CONTEXT_KEY] === void 0) globalThis[OTEL_CONTEXT_KEY] = otel.context;
	}
	setDefaultOTLPTracerComponents(components) {
		globalThis[OTEL_GET_DEFAULT_OTLP_TRACER_PROVIDER_KEY] = components;
	}
	getDefaultOTLPTracerComponents() {
		return globalThis[OTEL_GET_DEFAULT_OTLP_TRACER_PROVIDER_KEY] ?? void 0;
	}
};
const OTELProviderSingleton = new OTELProvider();
/**
* Get the current OTEL trace instance.
* Returns a mock implementation if OTEL is not available.
*/
function getOTELTrace() {
	return OTELProviderSingleton.getTraceInstance();
}
/**
* Get the current OTEL context instance.
* Returns a mock implementation if OTEL is not available.
*/
function getOTELContext() {
	return OTELProviderSingleton.getContextInstance();
}
/**
* Get the default OTLP tracer provider instance.
* Returns undefined if not set.
*/
function getDefaultOTLPTracerComponents() {
	return OTELProviderSingleton.getDefaultOTLPTracerComponents();
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/experimental/otel/translator.js
const WELL_KNOWN_OPERATION_NAMES = {
	llm: "chat",
	tool: "execute_tool",
	retriever: "embeddings",
	embedding: "embeddings",
	prompt: "chat"
};
function getOperationName(runType) {
	return WELL_KNOWN_OPERATION_NAMES[runType] || runType;
}
var LangSmithToOTELTranslator = class {
	constructor() {
		Object.defineProperty(this, "spans", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
	}
	exportBatch(operations, otelContextMap) {
		for (const op of operations) try {
			if (!op.run) continue;
			if (op.operation === "post") {
				const span = this.createSpanForRun(op, op.run, otelContextMap.get(op.id));
				if (span && !op.run.end_time) this.spans.set(op.id, span);
			} else this.updateSpanForRun(op, op.run);
		} catch (e) {
			console.error(`Error processing operation ${op.id}:`, e);
		}
	}
	createSpanForRun(op, runInfo, otelContext) {
		const activeSpan = otelContext && getOTELTrace().getSpan(otelContext);
		if (!activeSpan) return;
		try {
			return this.finishSpanSetup(activeSpan, runInfo, op);
		} catch (e) {
			console.error(`Failed to create span for run ${op.id}:`, e);
			return;
		}
	}
	finishSpanSetup(span, runInfo, op) {
		this.setSpanAttributes(span, runInfo, op);
		if (runInfo.error) {
			span.setStatus({ code: 2 });
			span.recordException(new Error(runInfo.error));
		} else span.setStatus({ code: 1 });
		if (runInfo.end_time) span.end(new Date(runInfo.end_time));
		return span;
	}
	updateSpanForRun(op, runInfo) {
		try {
			const span = this.spans.get(op.id);
			if (!span) {
				console.debug(`No span found for run ${op.id} during update`);
				return;
			}
			this.setSpanAttributes(span, runInfo, op);
			if (runInfo.error) {
				span.setStatus({ code: 2 });
				span.recordException(new Error(runInfo.error));
			} else span.setStatus({ code: 1 });
			const endTime = runInfo.end_time;
			if (endTime) {
				span.end(new Date(endTime));
				this.spans.delete(op.id);
			}
		} catch (e) {
			console.error(`Failed to update span for run ${op.id}:`, e);
		}
	}
	extractModelName(runInfo) {
		if (runInfo.extra?.metadata) {
			const metadata = runInfo.extra.metadata;
			if (metadata.ls_model_name) return metadata.ls_model_name;
			if (metadata.invocation_params) {
				const invocationParams = metadata.invocation_params;
				if (invocationParams.model) return invocationParams.model;
				else if (invocationParams.model_name) return invocationParams.model_name;
			}
		}
	}
	setSpanAttributes(span, runInfo, op) {
		if ("run_type" in runInfo && runInfo.run_type) {
			span.setAttribute(LANGSMITH_RUN_TYPE, runInfo.run_type);
			const operationName = getOperationName(runInfo.run_type || "chain");
			span.setAttribute(GEN_AI_OPERATION_NAME, operationName);
		}
		if ("name" in runInfo && runInfo.name) span.setAttribute(LANGSMITH_NAME, runInfo.name);
		if ("session_id" in runInfo && runInfo.session_id) span.setAttribute(LANGSMITH_SESSION_ID, runInfo.session_id);
		if ("session_name" in runInfo && runInfo.session_name) span.setAttribute(LANGSMITH_SESSION_NAME, runInfo.session_name);
		this.setGenAiSystem(span, runInfo);
		const modelName = this.extractModelName(runInfo);
		if (modelName) span.setAttribute(GEN_AI_REQUEST_MODEL, modelName);
		if ("prompt_tokens" in runInfo && typeof runInfo.prompt_tokens === "number") span.setAttribute(GEN_AI_USAGE_INPUT_TOKENS, runInfo.prompt_tokens);
		if ("completion_tokens" in runInfo && typeof runInfo.completion_tokens === "number") span.setAttribute(GEN_AI_USAGE_OUTPUT_TOKENS, runInfo.completion_tokens);
		if ("total_tokens" in runInfo && typeof runInfo.total_tokens === "number") span.setAttribute(GEN_AI_USAGE_TOTAL_TOKENS, runInfo.total_tokens);
		this.setInvocationParameters(span, runInfo);
		const metadata = runInfo.extra?.metadata || {};
		for (const [key, value] of Object.entries(metadata)) if (value !== null && value !== void 0) span.setAttribute(`${LANGSMITH_METADATA}.${key}`, String(value));
		const tags = runInfo.tags;
		if (tags && Array.isArray(tags)) span.setAttribute(LANGSMITH_TAGS, tags.join(", "));
		else if (tags) span.setAttribute(LANGSMITH_TAGS, String(tags));
		if ("serialized" in runInfo && typeof runInfo.serialized === "object") {
			const serialized = runInfo.serialized;
			if (serialized.name) span.setAttribute(GEN_AI_SERIALIZED_NAME, String(serialized.name));
			if (serialized.signature) span.setAttribute(GEN_AI_SERIALIZED_SIGNATURE, String(serialized.signature));
			if (serialized.doc) span.setAttribute(GEN_AI_SERIALIZED_DOC, String(serialized.doc));
		}
		this.setIOAttributes(span, op);
	}
	setGenAiSystem(span, runInfo) {
		let system = "langchain";
		const modelName = this.extractModelName(runInfo);
		if (modelName) {
			const modelLower = modelName.toLowerCase();
			if (modelLower.includes("anthropic") || modelLower.startsWith("claude")) system = "anthropic";
			else if (modelLower.includes("bedrock")) system = "aws.bedrock";
			else if (modelLower.includes("azure") && modelLower.includes("openai")) system = "az.ai.openai";
			else if (modelLower.includes("azure") && modelLower.includes("inference")) system = "az.ai.inference";
			else if (modelLower.includes("cohere")) system = "cohere";
			else if (modelLower.includes("deepseek")) system = "deepseek";
			else if (modelLower.includes("gemini")) system = "gemini";
			else if (modelLower.includes("groq")) system = "groq";
			else if (modelLower.includes("watson") || modelLower.includes("ibm")) system = "ibm.watsonx.ai";
			else if (modelLower.includes("mistral")) system = "mistral_ai";
			else if (modelLower.includes("gpt") || modelLower.includes("openai")) system = "openai";
			else if (modelLower.includes("perplexity") || modelLower.includes("sonar")) system = "perplexity";
			else if (modelLower.includes("vertex")) system = "vertex_ai";
			else if (modelLower.includes("xai") || modelLower.includes("grok")) system = "xai";
		}
		span.setAttribute(GEN_AI_SYSTEM, system);
	}
	setInvocationParameters(span, runInfo) {
		if (!runInfo.extra?.metadata?.invocation_params) return;
		const invocationParams = runInfo.extra.metadata.invocation_params;
		if (invocationParams.max_tokens !== void 0) span.setAttribute(GEN_AI_REQUEST_MAX_TOKENS, invocationParams.max_tokens);
		if (invocationParams.temperature !== void 0) span.setAttribute(GEN_AI_REQUEST_TEMPERATURE, invocationParams.temperature);
		if (invocationParams.top_p !== void 0) span.setAttribute(GEN_AI_REQUEST_TOP_P, invocationParams.top_p);
		if (invocationParams.frequency_penalty !== void 0) span.setAttribute(GEN_AI_REQUEST_FREQUENCY_PENALTY, invocationParams.frequency_penalty);
		if (invocationParams.presence_penalty !== void 0) span.setAttribute(GEN_AI_REQUEST_PRESENCE_PENALTY, invocationParams.presence_penalty);
	}
	setIOAttributes(span, op) {
		if (op.run.inputs) try {
			const inputs = op.run.inputs;
			if (typeof inputs === "object" && inputs !== null) {
				if (inputs.model && Array.isArray(inputs.messages)) span.setAttribute(GEN_AI_REQUEST_MODEL, inputs.model);
				if (inputs.stream !== void 0) span.setAttribute(LANGSMITH_REQUEST_STREAMING, inputs.stream);
				if (inputs.extra_headers) span.setAttribute(LANGSMITH_REQUEST_HEADERS, JSON.stringify(inputs.extra_headers));
				if (inputs.extra_query) span.setAttribute(GEN_AI_REQUEST_EXTRA_QUERY, JSON.stringify(inputs.extra_query));
				if (inputs.extra_body) span.setAttribute(GEN_AI_REQUEST_EXTRA_BODY, JSON.stringify(inputs.extra_body));
			}
			span.setAttribute(GENAI_PROMPT, JSON.stringify(inputs));
		} catch (e) {
			console.debug(`Failed to process inputs for run ${op.id}`, e);
		}
		if (op.run.outputs) try {
			const outputs = op.run.outputs;
			const tokenUsage = this.getUnifiedRunTokens(outputs);
			if (tokenUsage) {
				span.setAttribute(GEN_AI_USAGE_INPUT_TOKENS, tokenUsage[0]);
				span.setAttribute(GEN_AI_USAGE_OUTPUT_TOKENS, tokenUsage[1]);
				span.setAttribute(GEN_AI_USAGE_TOTAL_TOKENS, tokenUsage[0] + tokenUsage[1]);
			}
			if (outputs && typeof outputs === "object") {
				if (outputs.model) span.setAttribute(GEN_AI_RESPONSE_MODEL, String(outputs.model));
				if (outputs.id) span.setAttribute(GEN_AI_RESPONSE_ID, outputs.id);
				if (outputs.choices && Array.isArray(outputs.choices)) {
					const finishReasons = outputs.choices.map((choice) => choice.finish_reason).filter((reason) => reason).map(String);
					if (finishReasons.length > 0) span.setAttribute(GEN_AI_RESPONSE_FINISH_REASONS, finishReasons.join(", "));
				}
				if (outputs.service_tier) span.setAttribute(GEN_AI_RESPONSE_SERVICE_TIER, outputs.service_tier);
				if (outputs.system_fingerprint) span.setAttribute(GEN_AI_RESPONSE_SYSTEM_FINGERPRINT, outputs.system_fingerprint);
				if (outputs.usage_metadata && typeof outputs.usage_metadata === "object") {
					const usageMetadata = outputs.usage_metadata;
					if (usageMetadata.input_token_details) span.setAttribute(GEN_AI_USAGE_INPUT_TOKEN_DETAILS, JSON.stringify(usageMetadata.input_token_details));
					if (usageMetadata.output_token_details) span.setAttribute(GEN_AI_USAGE_OUTPUT_TOKEN_DETAILS, JSON.stringify(usageMetadata.output_token_details));
				}
			}
			span.setAttribute(GENAI_COMPLETION, JSON.stringify(outputs));
		} catch (e) {
			console.debug(`Failed to process outputs for run ${op.id}`, e);
		}
	}
	getUnifiedRunTokens(outputs) {
		if (!outputs) return null;
		let tokenUsage = this.extractUnifiedRunTokens(outputs.usage_metadata);
		if (tokenUsage) return tokenUsage;
		const keys = Object.keys(outputs);
		for (const key of keys) {
			const haystack = outputs[key];
			if (!haystack || typeof haystack !== "object") continue;
			tokenUsage = this.extractUnifiedRunTokens(haystack.usage_metadata);
			if (tokenUsage) return tokenUsage;
			if (haystack.lc === 1 && haystack.kwargs && typeof haystack.kwargs === "object") {
				tokenUsage = this.extractUnifiedRunTokens(haystack.kwargs.usage_metadata);
				if (tokenUsage) return tokenUsage;
			}
		}
		const generations = outputs.generations || [];
		if (!Array.isArray(generations)) return null;
		const flatGenerations = Array.isArray(generations[0]) ? generations.flat() : generations;
		for (const generation of flatGenerations) if (typeof generation === "object" && generation.message && typeof generation.message === "object" && generation.message.kwargs && typeof generation.message.kwargs === "object") {
			tokenUsage = this.extractUnifiedRunTokens(generation.message.kwargs.usage_metadata);
			if (tokenUsage) return tokenUsage;
		}
		return null;
	}
	extractUnifiedRunTokens(outputs) {
		if (!outputs || typeof outputs !== "object") return null;
		if (typeof outputs.input_tokens !== "number" || typeof outputs.output_tokens !== "number") return null;
		return [outputs.input_tokens, outputs.output_tokens];
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/is-network-error/index.js
const objectToString = Object.prototype.toString;
const isError = (value) => objectToString.call(value) === "[object Error]";
const errorMessages = new Set([
	"network error",
	"Failed to fetch",
	"NetworkError when attempting to fetch resource.",
	"The Internet connection appears to be offline.",
	"Network request failed",
	"fetch failed",
	"terminated",
	" A network error occurred.",
	"Network connection lost"
]);
function isNetworkError(error) {
	if (!(error && isError(error) && error.name === "TypeError" && typeof error.message === "string")) return false;
	const { message, stack } = error;
	if (message === "Load failed") return stack === void 0 || "__sentry_captured__" in error;
	if (message.startsWith("error sending request for url")) return true;
	return errorMessages.has(message);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/p-retry/index.js
function validateRetries(retries) {
	if (typeof retries === "number") {
		if (retries < 0) throw new TypeError("Expected `retries` to be a non-negative number.");
		if (Number.isNaN(retries)) throw new TypeError("Expected `retries` to be a valid number or Infinity, got NaN.");
	} else if (retries !== void 0) throw new TypeError("Expected `retries` to be a number or Infinity.");
}
function validateNumberOption(name, value, { min = 0, allowInfinity = false } = {}) {
	if (value === void 0) return;
	if (typeof value !== "number" || Number.isNaN(value)) throw new TypeError(`Expected \`${name}\` to be a number${allowInfinity ? " or Infinity" : ""}.`);
	if (!allowInfinity && !Number.isFinite(value)) throw new TypeError(`Expected \`${name}\` to be a finite number.`);
	if (value < min) throw new TypeError(`Expected \`${name}\` to be \u2265 ${min}.`);
}
var AbortError = class extends Error {
	constructor(message) {
		super();
		if (message instanceof Error) {
			this.originalError = message;
			({message} = message);
		} else {
			this.originalError = new Error(message);
			this.originalError.stack = this.stack;
		}
		this.name = "AbortError";
		this.message = message;
	}
};
function calculateDelay(retriesConsumed, options) {
	const attempt = Math.max(1, retriesConsumed + 1);
	const random = options.randomize ? Math.random() + 1 : 1;
	let timeout = Math.round(random * options.minTimeout * options.factor ** (attempt - 1));
	timeout = Math.min(timeout, options.maxTimeout);
	return timeout;
}
function calculateRemainingTime(start, max) {
	if (!Number.isFinite(max)) return max;
	return max - (performance.now() - start);
}
async function onAttemptFailure({ error, attemptNumber, retriesConsumed, startTime, options }) {
	const normalizedError = error instanceof Error ? error : /* @__PURE__ */ new TypeError(`Non-error was thrown: "${error}". You should only throw errors.`);
	if (normalizedError instanceof AbortError) throw normalizedError.originalError;
	const retriesLeft = Number.isFinite(options.retries) ? Math.max(0, options.retries - retriesConsumed) : options.retries;
	const maxRetryTime = options.maxRetryTime ?? Number.POSITIVE_INFINITY;
	const context = Object.freeze({
		error: normalizedError,
		attemptNumber,
		retriesLeft,
		retriesConsumed
	});
	await options.onFailedAttempt(context);
	if (calculateRemainingTime(startTime, maxRetryTime) <= 0) throw normalizedError;
	const consumeRetry = await options.shouldConsumeRetry(context);
	const remainingTime = calculateRemainingTime(startTime, maxRetryTime);
	if (remainingTime <= 0 || retriesLeft <= 0) throw normalizedError;
	if (normalizedError instanceof TypeError && !isNetworkError(normalizedError)) {
		if (consumeRetry) throw normalizedError;
		options.signal?.throwIfAborted();
		return false;
	}
	if (!await options.shouldRetry(context)) throw normalizedError;
	if (!consumeRetry) {
		options.signal?.throwIfAborted();
		return false;
	}
	const delayTime = calculateDelay(retriesConsumed, options);
	const finalDelay = Math.min(delayTime, remainingTime);
	if (finalDelay > 0) await new Promise((resolve, reject) => {
		const onAbort = () => {
			clearTimeout(timeoutToken);
			options.signal?.removeEventListener("abort", onAbort);
			reject(options.signal.reason);
		};
		const timeoutToken = setTimeout(() => {
			options.signal?.removeEventListener("abort", onAbort);
			resolve();
		}, finalDelay);
		if (options.unref) timeoutToken.unref?.();
		options.signal?.addEventListener("abort", onAbort, { once: true });
	});
	options.signal?.throwIfAborted();
	return true;
}
async function pRetry(input, options = {}) {
	options = { ...options };
	validateRetries(options.retries);
	if (Object.hasOwn(options, "forever")) throw new Error("The `forever` option is no longer supported. For many use-cases, you can set `retries: Infinity` instead.");
	options.retries ??= 10;
	options.factor ??= 2;
	options.minTimeout ??= 1e3;
	options.maxTimeout ??= Number.POSITIVE_INFINITY;
	options.maxRetryTime ??= Number.POSITIVE_INFINITY;
	options.randomize ??= false;
	options.onFailedAttempt ??= () => {};
	options.shouldRetry ??= () => true;
	options.shouldConsumeRetry ??= () => true;
	validateNumberOption("factor", options.factor, {
		min: 0,
		allowInfinity: false
	});
	validateNumberOption("minTimeout", options.minTimeout, {
		min: 0,
		allowInfinity: false
	});
	validateNumberOption("maxTimeout", options.maxTimeout, {
		min: 0,
		allowInfinity: true
	});
	validateNumberOption("maxRetryTime", options.maxRetryTime, {
		min: 0,
		allowInfinity: true
	});
	if (!(options.factor > 0)) options.factor = 1;
	options.signal?.throwIfAborted();
	let attemptNumber = 0;
	let retriesConsumed = 0;
	const startTime = performance.now();
	while (Number.isFinite(options.retries) ? retriesConsumed <= options.retries : true) {
		attemptNumber++;
		try {
			options.signal?.throwIfAborted();
			const result = await input(attemptNumber);
			options.signal?.throwIfAborted();
			return result;
		} catch (error) {
			if (await onAttemptFailure({
				error,
				attemptNumber,
				retriesConsumed,
				startTime,
				options
			})) retriesConsumed++;
		}
	}
	throw new Error("Retry attempts exhausted without throwing an error.");
}
//#endregion
//#region ../../node_modules/.pnpm/eventemitter3@4.0.7/node_modules/eventemitter3/index.js
var require_eventemitter3 = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var has = Object.prototype.hasOwnProperty, prefix = "~";
	/**
	* Constructor to create a storage for our `EE` objects.
	* An `Events` instance is a plain object whose properties are event names.
	*
	* @constructor
	* @private
	*/
	function Events() {}
	if (Object.create) {
		Events.prototype = Object.create(null);
		if (!new Events().__proto__) prefix = false;
	}
	/**
	* Representation of a single event listener.
	*
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} [once=false] Specify if the listener is a one-time listener.
	* @constructor
	* @private
	*/
	function EE(fn, context, once) {
		this.fn = fn;
		this.context = context;
		this.once = once || false;
	}
	/**
	* Add a listener for a given event.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} context The context to invoke the listener with.
	* @param {Boolean} once Specify if the listener is a one-time listener.
	* @returns {EventEmitter}
	* @private
	*/
	function addListener(emitter, event, fn, context, once) {
		if (typeof fn !== "function") throw new TypeError("The listener must be a function");
		var listener = new EE(fn, context || emitter, once), evt = prefix ? prefix + event : event;
		if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
		else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
		else emitter._events[evt] = [emitter._events[evt], listener];
		return emitter;
	}
	/**
	* Clear event by name.
	*
	* @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
	* @param {(String|Symbol)} evt The Event name.
	* @private
	*/
	function clearEvent(emitter, evt) {
		if (--emitter._eventsCount === 0) emitter._events = new Events();
		else delete emitter._events[evt];
	}
	/**
	* Minimal `EventEmitter` interface that is molded against the Node.js
	* `EventEmitter` interface.
	*
	* @constructor
	* @public
	*/
	function EventEmitter() {
		this._events = new Events();
		this._eventsCount = 0;
	}
	/**
	* Return an array listing the events for which the emitter has registered
	* listeners.
	*
	* @returns {Array}
	* @public
	*/
	EventEmitter.prototype.eventNames = function eventNames() {
		var names = [], events, name;
		if (this._eventsCount === 0) return names;
		for (name in events = this._events) if (has.call(events, name)) names.push(prefix ? name.slice(1) : name);
		if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
		return names;
	};
	/**
	* Return the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Array} The registered listeners.
	* @public
	*/
	EventEmitter.prototype.listeners = function listeners(event) {
		var evt = prefix ? prefix + event : event, handlers = this._events[evt];
		if (!handlers) return [];
		if (handlers.fn) return [handlers.fn];
		for (var i = 0, l = handlers.length, ee = new Array(l); i < l; i++) ee[i] = handlers[i].fn;
		return ee;
	};
	/**
	* Return the number of listeners listening to a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Number} The number of listeners.
	* @public
	*/
	EventEmitter.prototype.listenerCount = function listenerCount(event) {
		var evt = prefix ? prefix + event : event, listeners = this._events[evt];
		if (!listeners) return 0;
		if (listeners.fn) return 1;
		return listeners.length;
	};
	/**
	* Calls each of the listeners registered for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @returns {Boolean} `true` if the event had listeners, else `false`.
	* @public
	*/
	EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return false;
		var listeners = this._events[evt], len = arguments.length, args, i;
		if (listeners.fn) {
			if (listeners.once) this.removeListener(event, listeners.fn, void 0, true);
			switch (len) {
				case 1: return listeners.fn.call(listeners.context), true;
				case 2: return listeners.fn.call(listeners.context, a1), true;
				case 3: return listeners.fn.call(listeners.context, a1, a2), true;
				case 4: return listeners.fn.call(listeners.context, a1, a2, a3), true;
				case 5: return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
				case 6: return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
			}
			for (i = 1, args = new Array(len - 1); i < len; i++) args[i - 1] = arguments[i];
			listeners.fn.apply(listeners.context, args);
		} else {
			var length = listeners.length, j;
			for (i = 0; i < length; i++) {
				if (listeners[i].once) this.removeListener(event, listeners[i].fn, void 0, true);
				switch (len) {
					case 1:
						listeners[i].fn.call(listeners[i].context);
						break;
					case 2:
						listeners[i].fn.call(listeners[i].context, a1);
						break;
					case 3:
						listeners[i].fn.call(listeners[i].context, a1, a2);
						break;
					case 4:
						listeners[i].fn.call(listeners[i].context, a1, a2, a3);
						break;
					default:
						if (!args) for (j = 1, args = new Array(len - 1); j < len; j++) args[j - 1] = arguments[j];
						listeners[i].fn.apply(listeners[i].context, args);
				}
			}
		}
		return true;
	};
	/**
	* Add a listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.on = function on(event, fn, context) {
		return addListener(this, event, fn, context, false);
	};
	/**
	* Add a one-time listener for a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn The listener function.
	* @param {*} [context=this] The context to invoke the listener with.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.once = function once(event, fn, context) {
		return addListener(this, event, fn, context, true);
	};
	/**
	* Remove the listeners of a given event.
	*
	* @param {(String|Symbol)} event The event name.
	* @param {Function} fn Only remove the listeners that match this function.
	* @param {*} context Only remove the listeners that have this context.
	* @param {Boolean} once Only remove one-time listeners.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
		var evt = prefix ? prefix + event : event;
		if (!this._events[evt]) return this;
		if (!fn) {
			clearEvent(this, evt);
			return this;
		}
		var listeners = this._events[evt];
		if (listeners.fn) {
			if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) clearEvent(this, evt);
		} else {
			for (var i = 0, events = [], length = listeners.length; i < length; i++) if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) events.push(listeners[i]);
			if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
			else clearEvent(this, evt);
		}
		return this;
	};
	/**
	* Remove all listeners, or those of the specified event.
	*
	* @param {(String|Symbol)} [event] The event name.
	* @returns {EventEmitter} `this`.
	* @public
	*/
	EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
		var evt;
		if (event) {
			evt = prefix ? prefix + event : event;
			if (this._events[evt]) clearEvent(this, evt);
		} else {
			this._events = new Events();
			this._eventsCount = 0;
		}
		return this;
	};
	EventEmitter.prototype.off = EventEmitter.prototype.removeListener;
	EventEmitter.prototype.addListener = EventEmitter.prototype.on;
	EventEmitter.prefixed = prefix;
	EventEmitter.EventEmitter = EventEmitter;
	if ("undefined" !== typeof module) module.exports = EventEmitter;
}));
//#endregion
//#region ../../node_modules/.pnpm/p-finally@1.0.0/node_modules/p-finally/index.js
var require_p_finally = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = (promise, onFinally) => {
		onFinally = onFinally || (() => {});
		return promise.then((val) => new Promise((resolve) => {
			resolve(onFinally());
		}).then(() => val), (err) => new Promise((resolve) => {
			resolve(onFinally());
		}).then(() => {
			throw err;
		}));
	};
}));
//#endregion
//#region ../../node_modules/.pnpm/p-timeout@3.2.0/node_modules/p-timeout/index.js
var require_p_timeout = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	const pFinally = require_p_finally();
	var TimeoutError = class extends Error {
		constructor(message) {
			super(message);
			this.name = "TimeoutError";
		}
	};
	const pTimeout = (promise, milliseconds, fallback) => new Promise((resolve, reject) => {
		if (typeof milliseconds !== "number" || milliseconds < 0) throw new TypeError("Expected `milliseconds` to be a positive number");
		if (milliseconds === Infinity) {
			resolve(promise);
			return;
		}
		const timer = setTimeout(() => {
			if (typeof fallback === "function") {
				try {
					resolve(fallback());
				} catch (error) {
					reject(error);
				}
				return;
			}
			const message = typeof fallback === "string" ? fallback : `Promise timed out after ${milliseconds} milliseconds`;
			const timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);
			if (typeof promise.cancel === "function") promise.cancel();
			reject(timeoutError);
		}, milliseconds);
		pFinally(promise.then(resolve, reject), () => {
			clearTimeout(timer);
		});
	});
	module.exports = pTimeout;
	module.exports.default = pTimeout;
	module.exports.TimeoutError = TimeoutError;
}));
//#endregion
//#region ../../node_modules/.pnpm/p-queue@6.6.2/node_modules/p-queue/dist/lower-bound.js
var require_lower_bound = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	function lowerBound(array, value, comparator) {
		let first = 0;
		let count = array.length;
		while (count > 0) {
			const step = count / 2 | 0;
			let it = first + step;
			if (comparator(array[it], value) <= 0) {
				first = ++it;
				count -= step + 1;
			} else count = step;
		}
		return first;
	}
	exports.default = lowerBound;
}));
//#endregion
//#region ../../node_modules/.pnpm/p-queue@6.6.2/node_modules/p-queue/dist/priority-queue.js
var require_priority_queue = /* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	const lower_bound_1 = require_lower_bound();
	var PriorityQueue = class {
		constructor() {
			this._queue = [];
		}
		enqueue(run, options) {
			options = Object.assign({ priority: 0 }, options);
			const element = {
				priority: options.priority,
				run
			};
			if (this.size && this._queue[this.size - 1].priority >= options.priority) {
				this._queue.push(element);
				return;
			}
			const index = lower_bound_1.default(this._queue, element, (a, b) => b.priority - a.priority);
			this._queue.splice(index, 0, element);
		}
		dequeue() {
			const item = this._queue.shift();
			return item === null || item === void 0 ? void 0 : item.run;
		}
		filter(options) {
			return this._queue.filter((element) => element.priority === options.priority).map((element) => element.run);
		}
		get size() {
			return this._queue.length;
		}
	};
	exports.default = PriorityQueue;
}));
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/p-queue.js
var import_dist = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports) => {
	Object.defineProperty(exports, "__esModule", { value: true });
	const EventEmitter = require_eventemitter3();
	const p_timeout_1 = require_p_timeout();
	const priority_queue_1 = require_priority_queue();
	const empty = () => {};
	const timeoutError = new p_timeout_1.TimeoutError();
	/**
	Promise queue with concurrency control.
	*/
	var PQueue = class extends EventEmitter {
		constructor(options) {
			var _a, _b, _c, _d;
			super();
			this._intervalCount = 0;
			this._intervalEnd = 0;
			this._pendingCount = 0;
			this._resolveEmpty = empty;
			this._resolveIdle = empty;
			options = Object.assign({
				carryoverConcurrencyCount: false,
				intervalCap: Infinity,
				interval: 0,
				concurrency: Infinity,
				autoStart: true,
				queueClass: priority_queue_1.default
			}, options);
			if (!(typeof options.intervalCap === "number" && options.intervalCap >= 1)) throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${(_b = (_a = options.intervalCap) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : ""}\` (${typeof options.intervalCap})`);
			if (options.interval === void 0 || !(Number.isFinite(options.interval) && options.interval >= 0)) throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${(_d = (_c = options.interval) === null || _c === void 0 ? void 0 : _c.toString()) !== null && _d !== void 0 ? _d : ""}\` (${typeof options.interval})`);
			this._carryoverConcurrencyCount = options.carryoverConcurrencyCount;
			this._isIntervalIgnored = options.intervalCap === Infinity || options.interval === 0;
			this._intervalCap = options.intervalCap;
			this._interval = options.interval;
			this._queue = new options.queueClass();
			this._queueClass = options.queueClass;
			this.concurrency = options.concurrency;
			this._timeout = options.timeout;
			this._throwOnTimeout = options.throwOnTimeout === true;
			this._isPaused = options.autoStart === false;
		}
		get _doesIntervalAllowAnother() {
			return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
		}
		get _doesConcurrentAllowAnother() {
			return this._pendingCount < this._concurrency;
		}
		_next() {
			this._pendingCount--;
			this._tryToStartAnother();
			this.emit("next");
		}
		_resolvePromises() {
			this._resolveEmpty();
			this._resolveEmpty = empty;
			if (this._pendingCount === 0) {
				this._resolveIdle();
				this._resolveIdle = empty;
				this.emit("idle");
			}
		}
		_onResumeInterval() {
			this._onInterval();
			this._initializeIntervalIfNeeded();
			this._timeoutId = void 0;
		}
		_isIntervalPaused() {
			const now = Date.now();
			if (this._intervalId === void 0) {
				const delay = this._intervalEnd - now;
				if (delay < 0) this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
				else {
					if (this._timeoutId === void 0) this._timeoutId = setTimeout(() => {
						this._onResumeInterval();
					}, delay);
					return true;
				}
			}
			return false;
		}
		_tryToStartAnother() {
			if (this._queue.size === 0) {
				if (this._intervalId) clearInterval(this._intervalId);
				this._intervalId = void 0;
				this._resolvePromises();
				return false;
			}
			if (!this._isPaused) {
				const canInitializeInterval = !this._isIntervalPaused();
				if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
					const job = this._queue.dequeue();
					if (!job) return false;
					this.emit("active");
					job();
					if (canInitializeInterval) this._initializeIntervalIfNeeded();
					return true;
				}
			}
			return false;
		}
		_initializeIntervalIfNeeded() {
			if (this._isIntervalIgnored || this._intervalId !== void 0) return;
			this._intervalId = setInterval(() => {
				this._onInterval();
			}, this._interval);
			this._intervalEnd = Date.now() + this._interval;
		}
		_onInterval() {
			if (this._intervalCount === 0 && this._pendingCount === 0 && this._intervalId) {
				clearInterval(this._intervalId);
				this._intervalId = void 0;
			}
			this._intervalCount = this._carryoverConcurrencyCount ? this._pendingCount : 0;
			this._processQueue();
		}
		/**
		Executes all queued functions until it reaches the limit.
		*/
		_processQueue() {
			while (this._tryToStartAnother());
		}
		get concurrency() {
			return this._concurrency;
		}
		set concurrency(newConcurrency) {
			if (!(typeof newConcurrency === "number" && newConcurrency >= 1)) throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${newConcurrency}\` (${typeof newConcurrency})`);
			this._concurrency = newConcurrency;
			this._processQueue();
		}
		/**
		Adds a sync or async task to the queue. Always returns a promise.
		*/
		async add(fn, options = {}) {
			return new Promise((resolve, reject) => {
				const run = async () => {
					this._pendingCount++;
					this._intervalCount++;
					try {
						resolve(await (this._timeout === void 0 && options.timeout === void 0 ? fn() : p_timeout_1.default(Promise.resolve(fn()), options.timeout === void 0 ? this._timeout : options.timeout, () => {
							if (options.throwOnTimeout === void 0 ? this._throwOnTimeout : options.throwOnTimeout) reject(timeoutError);
						})));
					} catch (error) {
						reject(error);
					}
					this._next();
				};
				this._queue.enqueue(run, options);
				this._tryToStartAnother();
				this.emit("add");
			});
		}
		/**
		Same as `.add()`, but accepts an array of sync or async functions.
		
		@returns A promise that resolves when all functions are resolved.
		*/
		async addAll(functions, options) {
			return Promise.all(functions.map(async (function_) => this.add(function_, options)));
		}
		/**
		Start (or resume) executing enqueued tasks within concurrency limit. No need to call this if queue is not paused (via `options.autoStart = false` or by `.pause()` method.)
		*/
		start() {
			if (!this._isPaused) return this;
			this._isPaused = false;
			this._processQueue();
			return this;
		}
		/**
		Put queue execution on hold.
		*/
		pause() {
			this._isPaused = true;
		}
		/**
		Clear the queue.
		*/
		clear() {
			this._queue = new this._queueClass();
		}
		/**
		Can be called multiple times. Useful if you for example add additional items at a later time.
		
		@returns A promise that settles when the queue becomes empty.
		*/
		async onEmpty() {
			if (this._queue.size === 0) return;
			return new Promise((resolve) => {
				const existingResolve = this._resolveEmpty;
				this._resolveEmpty = () => {
					existingResolve();
					resolve();
				};
			});
		}
		/**
		The difference with `.onEmpty` is that `.onIdle` guarantees that all work from the queue has finished. `.onEmpty` merely signals that the queue is empty, but it could mean that some promises haven't completed yet.
		
		@returns A promise that settles when the queue becomes empty, and all promises have completed; `queue.size === 0 && queue.pending === 0`.
		*/
		async onIdle() {
			if (this._pendingCount === 0 && this._queue.size === 0) return;
			return new Promise((resolve) => {
				const existingResolve = this._resolveIdle;
				this._resolveIdle = () => {
					existingResolve();
					resolve();
				};
			});
		}
		/**
		Size of the queue.
		*/
		get size() {
			return this._queue.size;
		}
		/**
		Size of the queue, filtered by the given options.
		
		For example, this can be used to find the number of items remaining in the queue with a specific priority level.
		*/
		sizeBy(options) {
			return this._queue.filter(options).length;
		}
		/**
		Number of pending promises.
		*/
		get pending() {
			return this._pendingCount;
		}
		/**
		Whether the queue is currently paused.
		*/
		get isPaused() {
			return this._isPaused;
		}
		get timeout() {
			return this._timeout;
		}
		/**
		Set the timeout for future operations.
		*/
		set timeout(milliseconds) {
			this._timeout = milliseconds;
		}
	};
	exports.default = PQueue;
})))(), 1);
const PQueue = "default" in import_dist.default ? import_dist.default.default : import_dist.default;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/async_caller.js
const STATUS_RETRYABLE = [
	408,
	425,
	429,
	500,
	502,
	503,
	504
];
/**
* A class that can be used to make async calls with concurrency and retry logic.
*
* This is useful for making calls to any kind of "expensive" external resource,
* be it because it's rate-limited, subject to network issues, etc.
*
* Concurrent calls are limited by the `maxConcurrency` parameter, which defaults
* to `Infinity`. This means that by default, all calls will be made in parallel.
*
* Retries are limited by the `maxRetries` parameter, which defaults to 6. This
* means that by default, each call will be retried up to 6 times, with an
* exponential backoff between each attempt.
*/
var AsyncCaller = class {
	constructor(params) {
		Object.defineProperty(this, "maxConcurrency", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "maxRetries", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "maxQueueSizeBytes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "queue", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "onFailedResponseHook", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "queueSizeBytes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		this.maxConcurrency = params.maxConcurrency ?? Infinity;
		this.maxRetries = params.maxRetries ?? 6;
		this.maxQueueSizeBytes = params.maxQueueSizeBytes;
		this.queue = new PQueue({ concurrency: this.maxConcurrency });
		this.onFailedResponseHook = params?.onFailedResponseHook;
	}
	call(callable, ...args) {
		return this.callWithOptions({}, callable, ...args);
	}
	callWithOptions(options, callable, ...args) {
		const sizeBytes = options.sizeBytes ?? 0;
		if (this.maxQueueSizeBytes !== void 0 && sizeBytes > 0 && this.queueSizeBytes + sizeBytes > this.maxQueueSizeBytes) return Promise.reject(/* @__PURE__ */ new Error(`Queue size limit (${this.maxQueueSizeBytes} bytes) exceeded. Current queue size: ${this.queueSizeBytes} bytes, attempted addition: ${sizeBytes} bytes.`));
		if (sizeBytes > 0) this.queueSizeBytes += sizeBytes;
		const onFailedResponseHook = this.onFailedResponseHook;
		let promise = this.queue.add(() => pRetry(() => callable(...args).catch((error) => {
			if (error instanceof Error) throw error;
			else throw new Error(error);
		}), {
			async onFailedAttempt({ error }) {
				if (typeof error !== "object" || error == null) throw error;
				const errorMessage = "message" in error && typeof error.message === "string" ? error.message : void 0;
				if (errorMessage?.startsWith("Cancel") || errorMessage?.startsWith("TimeoutError") || errorMessage?.startsWith("AbortError")) throw error;
				if ("name" in error && error.name === "TimeoutError") throw error;
				if ("code" in error && error.code === "ECONNABORTED") throw error;
				const response = "response" in error ? error.response : void 0;
				if (onFailedResponseHook) {
					if (await onFailedResponseHook(response)) return;
				}
				const status = response?.status ?? ("status" in error ? error.status : void 0);
				if (status != null && (typeof status === "number" || typeof status === "string") && !STATUS_RETRYABLE.includes(+status)) throw error;
			},
			retries: this.maxRetries,
			randomize: true
		}), { throwOnTimeout: true });
		if (sizeBytes > 0) promise = promise.finally(() => {
			this.queueSizeBytes -= sizeBytes;
		});
		if (options.signal) return Promise.race([promise, new Promise((_, reject) => {
			options.signal?.addEventListener("abort", () => {
				reject(/* @__PURE__ */ new Error("AbortError"));
			});
		})]);
		return promise;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/messages.js
function isLangChainMessage(message) {
	return typeof message?._getType === "function";
}
function convertLangChainMessageToExample(message) {
	const converted = {
		type: message._getType(),
		data: { content: message.content }
	};
	if (message?.additional_kwargs && Object.keys(message.additional_kwargs).length > 0) converted.data.additional_kwargs = { ...message.additional_kwargs };
	return converted;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/warn.js
const warnedMessages = {};
function warnOnce(message) {
	if (!warnedMessages[message]) {
		console.warn(message);
		warnedMessages[message] = true;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/xxhash/xxhash.js
const n = (n) => BigInt(n);
const PRIME32_1 = n("0x9E3779B1");
const PRIME32_2 = n("0x85EBCA77");
const PRIME32_3 = n("0xC2B2AE3D");
const PRIME64_1 = n("0x9E3779B185EBCA87");
const PRIME64_2 = n("0xC2B2AE3D27D4EB4F");
const PRIME64_3 = n("0x165667B19E3779F9");
const PRIME64_4 = n("0x85EBCA77C2B2AE63");
const PRIME64_5 = n("0x27D4EB2F165667C5");
const PRIME_MX1 = n("0x165667919E3779F9");
const PRIME_MX2 = n("0x9FB21C651E98DF25");
function hexToBytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	return bytes;
}
const kkey = hexToBytes("b8fe6c3923a44bbe7c01812cf721ad1cded46de9839097db7240a4a4b7b3671fcb79e64eccc0e578825ad07dccff7221b8084674f743248ee03590e6813a264c3c2852bb91c300cb88d0658b1b532ea371644897a20df94e3819ef46a9deacd8a8fa763fe39c343ff9dcbbc7c70b4f1d8a51e04bcdb45931c89f7ec9d9787364eac5ac8334d3ebc3c581a0fffa1363eb170ddd51b7f0da49d316552629d4689e2b16be587d47a1fc8ff8b8d17ad031ce45cb3a8f95160428afd7fbcabb4b407e");
const mask128 = (n(1) << n(128)) - n(1);
const mask64 = (n(1) << n(64)) - n(1);
const mask32 = (n(1) << n(32)) - n(1);
const STRIPE_LEN = 64;
const ACC_NB = STRIPE_LEN / 8;
const _U64 = 8;
const _U32 = 4;
function getView(buf, offset = 0) {
	return new Uint8Array(buf.buffer, buf.byteOffset + offset, buf.length - offset);
}
function readBigUInt64LE(buf, offset = 0) {
	return new DataView(buf.buffer, buf.byteOffset + offset).getBigUint64(0, true);
}
function readUInt32LE(buf, offset = 0) {
	return new DataView(buf.buffer, buf.byteOffset + offset).getUint32(0, true);
}
function readUInt8(buf, offset = 0) {
	return buf[offset];
}
const bswap64 = (a) => {
	return (a & n(255)) << n(56) | (a & n(65280)) << n(40) | (a & n(16711680)) << n(24) | (a & n(4278190080)) << n(8) | (a & n(0xff00000000)) >> n(8) | (a & n(0xff0000000000)) >> n(24) | (a & n(0xff000000000000)) >> n(40) | (a & n(0xff00000000000000)) >> n(56);
};
const bswap32 = (a) => {
	a = (a & n(65535)) << n(16) | (a & n(4294901760)) >> n(16);
	a = (a & n(16711935)) << n(8) | (a & n(4278255360)) >> n(8);
	return a;
};
const XXH_mult32to64 = (a, b) => (a & mask32) * (b & mask32) & mask64;
const assert = (a) => {
	if (!a) throw new Error("Assert failed");
};
function rotl32(a, b) {
	return (a << b | a >> n(32) - b) & mask32;
}
function XXH3_accumulate_512(acc, data, key) {
	for (let i = 0; i < ACC_NB; i++) {
		const data_val = readBigUInt64LE(data, i * 8);
		const data_key = data_val ^ readBigUInt64LE(key, i * 8);
		acc[i ^ 1] += data_val;
		acc[i] += XXH_mult32to64(data_key, data_key >> n(32));
	}
	return acc;
}
function XXH3_accumulate(acc, data, key, nbStripes) {
	for (let n = 0; n < nbStripes; n++) XXH3_accumulate_512(acc, getView(data, n * STRIPE_LEN), getView(key, n * 8));
	return acc;
}
function XXH3_scrambleAcc(acc, key) {
	for (let i = 0; i < ACC_NB; i++) {
		const key64 = readBigUInt64LE(key, i * 8);
		let acc64 = acc[i];
		acc64 = xorshift64(acc64, n(47));
		acc64 ^= key64;
		acc64 *= PRIME32_1;
		acc[i] = acc64 & mask64;
	}
	return acc;
}
function XXH3_mix2Accs(acc, key) {
	return XXH3_mul128_fold64(acc[0] ^ readBigUInt64LE(key, 0), acc[1] ^ readBigUInt64LE(key, _U64));
}
function XXH3_mergeAccs(acc, key, start) {
	let result64 = start;
	result64 += XXH3_mix2Accs(acc.slice(0), getView(key, 0 * _U32));
	result64 += XXH3_mix2Accs(acc.slice(2), getView(key, 4 * _U32));
	result64 += XXH3_mix2Accs(acc.slice(4), getView(key, 8 * _U32));
	result64 += XXH3_mix2Accs(acc.slice(6), getView(key, 12 * _U32));
	return XXH3_avalanche(result64 & mask64);
}
function XXH3_hashLong(acc, data, secret, f_acc, f_scramble) {
	const nbStripesPerBlock = Math.floor((secret.byteLength - STRIPE_LEN) / 8);
	const block_len = STRIPE_LEN * nbStripesPerBlock;
	const nb_blocks = Math.floor((data.byteLength - 1) / block_len);
	for (let n = 0; n < nb_blocks; n++) {
		acc = XXH3_accumulate(acc, getView(data, n * block_len), secret, nbStripesPerBlock);
		acc = f_scramble(acc, getView(secret, secret.byteLength - STRIPE_LEN));
	}
	{
		const nbStripes = Math.floor((data.byteLength - 1 - block_len * nb_blocks) / STRIPE_LEN);
		acc = XXH3_accumulate(acc, getView(data, nb_blocks * block_len), secret, nbStripes);
		acc = f_acc(acc, getView(data, data.byteLength - STRIPE_LEN), getView(secret, secret.byteLength - STRIPE_LEN - 7));
	}
	return acc;
}
function XXH3_hashLong_128b(data, secret, seed) {
	let acc = new BigUint64Array([
		PRIME32_3,
		PRIME64_1,
		PRIME64_2,
		PRIME64_3,
		PRIME64_4,
		PRIME32_2,
		PRIME64_5,
		PRIME32_1
	]);
	assert(data.length > 128);
	acc = XXH3_hashLong(acc, data, secret, XXH3_accumulate_512, XXH3_scrambleAcc);
	assert(acc.length * 8 == 64);
	{
		const low64 = XXH3_mergeAccs(acc, getView(secret, 11), n(data.byteLength) * PRIME64_1 & mask64);
		return XXH3_mergeAccs(acc, getView(secret, secret.byteLength - STRIPE_LEN - 11), ~(n(data.byteLength) * PRIME64_2) & mask64) << n(64) | low64;
	}
}
function XXH3_mul128_fold64(a, b) {
	const lll = a * b & mask128;
	return lll & mask64 ^ lll >> n(64);
}
function XXH3_mix16B(data, key, seed) {
	return XXH3_mul128_fold64((readBigUInt64LE(data, 0) ^ readBigUInt64LE(key, 0) + seed) & mask64, (readBigUInt64LE(data, 8) ^ readBigUInt64LE(key, 8) - seed) & mask64);
}
function XXH3_mix32B(acc, data1, data2, key, seed) {
	let accl = acc & mask64;
	let acch = acc >> n(64) & mask64;
	accl += XXH3_mix16B(data1, key, seed);
	accl ^= readBigUInt64LE(data2, 0) + readBigUInt64LE(data2, 8);
	accl &= mask64;
	acch += XXH3_mix16B(data2, getView(key, 16), seed);
	acch ^= readBigUInt64LE(data1, 0) + readBigUInt64LE(data1, 8);
	acch &= mask64;
	return acch << n(64) | accl;
}
function XXH3_avalanche(h64) {
	h64 ^= h64 >> n(37);
	h64 *= PRIME_MX1;
	h64 &= mask64;
	h64 ^= h64 >> n(32);
	return h64;
}
function XXH3_avalanche64(h64) {
	h64 ^= h64 >> n(33);
	h64 *= PRIME64_2;
	h64 &= mask64;
	h64 ^= h64 >> n(29);
	h64 *= PRIME64_3;
	h64 &= mask64;
	h64 ^= h64 >> n(32);
	return h64;
}
function XXH3_len_1to3_128b(data, key32, seed) {
	const len = data.byteLength;
	assert(len > 0 && len <= 3);
	const combined = n(readUInt8(data, len - 1)) | n(len << 8) | n(readUInt8(data, 0) << 16) | n(readUInt8(data, len >> 1) << 24);
	const low = (combined ^ (n(readUInt32LE(key32, 0)) ^ n(readUInt32LE(key32, 4))) + seed) & mask64;
	const bhigh = (n(readUInt32LE(key32, 8)) ^ n(readUInt32LE(key32, 12))) - seed;
	return (XXH3_avalanche64((rotl32(bswap32(combined), n(13)) ^ bhigh) & mask64) & mask64) << n(64) | XXH3_avalanche64(low);
}
function xorshift64(b, shift) {
	return b ^ b >> shift;
}
function XXH3_len_4to8_128b(data, key32, seed) {
	const len = data.byteLength;
	assert(len >= 4 && len <= 8);
	{
		const l1 = readUInt32LE(data, 0);
		const l2 = readUInt32LE(data, len - 4);
		let m128 = ((n(l1) | n(l2) << n(32)) ^ (readBigUInt64LE(key32, 16) ^ readBigUInt64LE(key32, 24)) + seed & mask64) * (PRIME64_1 + (n(len) << n(2))) & mask128;
		m128 += (m128 & mask64) << n(65);
		m128 &= mask128;
		m128 ^= m128 >> n(67);
		return xorshift64(xorshift64(m128 & mask64, n(35)) * PRIME_MX2 & mask64, n(28)) | XXH3_avalanche(m128 >> n(64)) << n(64);
	}
}
function XXH3_len_9to16_128b(data, key64, seed) {
	const len = data.byteLength;
	assert(len >= 9 && len <= 16);
	{
		const bitflipl = (readBigUInt64LE(key64, 32) ^ readBigUInt64LE(key64, 40)) + seed & mask64;
		const bitfliph = (readBigUInt64LE(key64, 48) ^ readBigUInt64LE(key64, 56)) - seed & mask64;
		const ll1 = readBigUInt64LE(data);
		let ll2 = readBigUInt64LE(data, len - 8);
		let m128 = (ll1 ^ ll2 ^ bitflipl) * PRIME64_1;
		const m128_l = (m128 & mask64) + (n(len - 1) << n(54));
		m128 = m128 & (mask128 ^ mask64) | m128_l;
		ll2 ^= bitfliph;
		m128 += ll2 + (ll2 & mask32) * (PRIME32_2 - n(1)) << n(64);
		m128 &= mask128;
		m128 ^= bswap64(m128 >> n(64));
		let h128 = (m128 & mask64) * PRIME64_2;
		h128 += (m128 >> n(64)) * PRIME64_2 << n(64);
		h128 &= mask128;
		return XXH3_avalanche(h128 & mask64) | XXH3_avalanche(h128 >> n(64)) << n(64);
	}
}
function XXH3_len_0to16_128b(data, seed) {
	const len = data.byteLength;
	assert(len <= 16);
	if (len > 8) return XXH3_len_9to16_128b(data, kkey, seed);
	if (len >= 4) return XXH3_len_4to8_128b(data, kkey, seed);
	if (len > 0) return XXH3_len_1to3_128b(data, kkey, seed);
	return XXH3_avalanche64(seed ^ readBigUInt64LE(kkey, 64) ^ readBigUInt64LE(kkey, 72)) | XXH3_avalanche64(seed ^ readBigUInt64LE(kkey, 80) ^ readBigUInt64LE(kkey, 88)) << n(64);
}
function inv64(x) {
	return ~x + n(1) & mask64;
}
function XXH3_len_17to128_128b(data, secret, seed) {
	let acc = n(data.byteLength) * PRIME64_1 & mask64;
	let i = n(data.byteLength - 1) / n(32);
	while (i >= 0) {
		const ni = Number(i);
		acc = XXH3_mix32B(acc, getView(data, 16 * ni), getView(data, data.byteLength - 16 * (ni + 1)), getView(secret, 32 * ni), seed);
		i--;
	}
	let h128l = acc + (acc >> n(64)) & mask64;
	h128l = XXH3_avalanche(h128l);
	let h128h = (acc & mask64) * PRIME64_1 + (acc >> n(64)) * PRIME64_4 + (n(data.byteLength) - seed & mask64) * PRIME64_2;
	h128h &= mask64;
	h128h = inv64(XXH3_avalanche(h128h));
	return h128l | h128h << n(64);
}
function XXH3_len_129to240_128b(data, secret, seed) {
	let acc = n(data.byteLength) * PRIME64_1 & mask64;
	for (let i = 32; i < 160; i += 32) acc = XXH3_mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, i - 32), seed);
	acc = XXH3_avalanche(acc & mask64) | XXH3_avalanche(acc >> n(64)) << n(64);
	for (let i = 160; i <= data.byteLength; i += 32) acc = XXH3_mix32B(acc, getView(data, i - 32), getView(data, i - 16), getView(secret, 3 + i - 160), seed);
	acc = XXH3_mix32B(acc, getView(data, data.byteLength - 16), getView(data, data.byteLength - 32), getView(secret, 103), inv64(seed));
	let h128l = acc + (acc >> n(64)) & mask64;
	h128l = XXH3_avalanche(h128l);
	let h128h = (acc & mask64) * PRIME64_1 + (acc >> n(64)) * PRIME64_4 + (n(data.byteLength) - seed & mask64) * PRIME64_2;
	h128h &= mask64;
	h128h = inv64(XXH3_avalanche(h128h));
	return h128l | h128h << n(64);
}
/**
* Compute XXH3 128-bit hash of the input data.
*
* @param data - Input data as Uint8Array
* @param seed - Optional seed value (default: 0)
* @returns 128-bit hash as a single BigInt (high 64 bits << 64 | low 64 bits)
*/
function XXH3_128(data, seed = n(0)) {
	const len = data.byteLength;
	if (len <= 16) return XXH3_len_0to16_128b(data, seed);
	if (len <= 128) return XXH3_len_17to128_128b(data, kkey, seed);
	if (len <= 240) return XXH3_len_129to240_128b(data, kkey, seed);
	return XXH3_hashLong_128b(data, kkey, seed);
}
/**
* Convert a 128-bit hash (BigInt) to a 16-byte Uint8Array.
*
* @param hash128 - 128-bit hash as BigInt
* @returns 16-byte Uint8Array in little-endian byte order
*/
function xxh128ToBytes(hash128) {
	const result = new Uint8Array(16);
	const view = new DataView(result.buffer);
	const low64 = hash128 & mask64;
	const high64 = hash128 >> n(64);
	view.setBigUint64(0, high64, false);
	view.setBigUint64(8, low64, false);
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/_uuid.js
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function assertUuid(str, which) {
	if (!UUID_REGEX.test(str)) {
		const msg = which !== void 0 ? `Invalid UUID for ${which}: ${str}` : `Invalid UUID: ${str}`;
		throw new Error(msg);
	}
	return str;
}
/**
* Generate a UUID v7 from a timestamp.
*
* @param timestamp - The timestamp in milliseconds
* @returns A UUID v7 string
*/
function uuid7FromTime(timestamp) {
	return v7({
		msecs: typeof timestamp === "string" ? Date.parse(timestamp) : timestamp,
		seq: 0
	});
}
/**
* Get the version of a UUID string.
* @param uuidStr - The UUID string to check
* @returns The version number (1-7) or null if invalid
*/
function getUuidVersion(uuidStr) {
	if (!UUID_REGEX.test(uuidStr)) return null;
	const versionChar = uuidStr[14];
	return parseInt(versionChar, 16);
}
/**
* Convert a UUID string to its 16-byte representation.
* @param uuidStr - The UUID string (with or without dashes)
* @returns A Uint8Array containing the 16 bytes of the UUID
*/
function uuidToBytes(uuidStr) {
	const hex = uuidStr.replace(/-/g, "");
	const bytes = new Uint8Array(16);
	for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}
/**
* Convert 16 bytes to a UUID string.
* @param bytes - A Uint8Array containing 16 bytes
* @returns A UUID string in standard format
*/
function bytesToUuid(bytes) {
	const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
const _textEncoder = new TextEncoder();
/**
* Generates a 16-byte fingerprint for deterministic UUID generation using XXH3-128.
*
* XXH3 is an extremely fast, non-cryptographic hash function that provides excellent
* collision resistance. It's widely used in production systems and compatible with
* xxHash implementations in other languages.
*
* See: https://github.com/Cyan4973/xxHash
*
* @param str - The input string to hash
* @returns A Uint8Array containing 16 bytes of hash output
*/
function _fastHash128(str) {
	return xxh128ToBytes(XXH3_128(_textEncoder.encode(str)));
}
/**
* Generate a deterministic UUID v7 derived from an original UUID and a key.
*
* This function creates a new UUID that:
* - Preserves the timestamp from the original UUID if it's UUID v7
* - Uses current time if the original is not UUID v7
* - Uses deterministic "random" bits derived from hashing the original + key
* - Is valid UUID v7 format
*
* This is used for creating replica IDs that maintain time-ordering properties
* while being deterministic across distributed systems.
*
* @param originalId - The source UUID string (ideally UUID v7 to preserve timestamp)
* @param key - A string key used for deterministic derivation (e.g., project name)
* @returns A new UUID v7 string with preserved timestamp (if original is v7) and
*          deterministic random bits
*
* @example
* ```typescript
* const original = uuidv7();
* const replicaId = nonCryptographicUuid7Deterministic(original, "replica-project");
* // Same inputs always produce same output
* assert(nonCryptographicUuid7Deterministic(original, "replica-project") === replicaId);
* ```
*/
function nonCryptographicUuid7Deterministic(originalId, key) {
	const h = _fastHash128(`${originalId}:${key}`);
	const b = new Uint8Array(16);
	if (getUuidVersion(originalId) === 7) {
		const originalBytes = uuidToBytes(originalId);
		b.set(originalBytes.slice(0, 6), 0);
	} else {
		const msecs = Date.now();
		b[0] = msecs / 1099511627776 & 255;
		b[1] = msecs / 4294967296 & 255;
		b[2] = msecs / 16777216 & 255;
		b[3] = msecs / 65536 & 255;
		b[4] = msecs / 256 & 255;
		b[5] = msecs & 255;
	}
	b[6] = 112 | h[0] & 15;
	b[7] = h[1];
	b[8] = 128 | h[2] & 63;
	b.set(h.slice(3, 10), 9);
	return bytesToUuid(b);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/error.js
/**
* Get the error message for an invalid prompt identifier.
* Used consistently across the codebase when parsing prompt identifiers fails.
*
* @param identifier - The invalid identifier that was provided
* @returns A formatted error message explaining the valid formats
*/
function getInvalidPromptIdentifierMsg(identifier) {
	return `Invalid prompt identifier format: "${identifier}". Expected one of:\n  - "prompt-name" (for private prompts)\n  - "owner/prompt-name" (for prompts with explicit owner)\n  - "prompt-name:commit-hash" (with commit reference)\n  - "owner/prompt-name:commit-hash" (with owner and commit)`;
}
/**
* LangSmithConflictError
*
* Represents an error that occurs when there's a conflict during an operation,
* typically corresponding to HTTP 409 status code responses.
*
* This error is thrown when an attempt to create or modify a resource conflicts
* with the current state of the resource on the server. Common scenarios include:
* - Attempting to create a resource that already exists
* - Trying to update a resource that has been modified by another process
* - Violating a uniqueness constraint in the data
*
* @extends Error
*
* @example
* try {
*   await createProject("existingProject");
* } catch (error) {
*   if (error instanceof ConflictError) {
*     console.log("A conflict occurred:", error.message);
*     // Handle the conflict, e.g., by suggesting a different project name
*   } else {
*     // Handle other types of errors
*   }
* }
*
* @property {string} name - Always set to 'ConflictError' for easy identification
* @property {string} message - Detailed error message including server response
*
* @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409
*/
var LangSmithConflictError = class extends Error {
	constructor(message) {
		super(message);
		Object.defineProperty(this, "status", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.name = "LangSmithConflictError";
		this.status = 409;
	}
};
/**
* LangSmithNotFoundError
*
* Represents an error that occurs when a requested resource is not found,
* typically corresponding to HTTP 404 status code responses.
*
* @extends Error
*/
var LangSmithNotFoundError = class extends Error {
	constructor(message) {
		super(message);
		Object.defineProperty(this, "status", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.name = "LangSmithNotFoundError";
		this.status = 404;
	}
};
function isLangSmithNotFoundError(error) {
	return error != null && typeof error === "object" && "name" in error && error?.name === "LangSmithNotFoundError";
}
function isLangSmithConflictError(error) {
	return error != null && typeof error === "object" && "name" in error && error?.name === "LangSmithConflictError";
}
/**
* Throws an appropriate error based on the response status and body.
*
* @param response - The fetch Response object
* @param context - Additional context to include in the error message (e.g., operation being performed)
* @throws {LangSmithConflictError} When the response status is 409
* @throws {Error} For all other non-ok responses
*/
async function raiseForStatus(response, context, consumeOnSuccess) {
	let errorBody;
	if (response.ok) {
		if (consumeOnSuccess) errorBody = await response.text();
		return;
	}
	if (response.status === 403) try {
		if ((await response.json())?.error === "org_scoped_key_requires_workspace") errorBody = "This API key is org-scoped and requires workspace specification. Please provide 'workspaceId' parameter, or set LANGSMITH_WORKSPACE_ID environment variable.";
	} catch (_e) {
		const errorWithStatus = /* @__PURE__ */ new Error(`${response.status} ${response.statusText}`);
		errorWithStatus.status = response?.status;
		throw errorWithStatus;
	}
	if (errorBody === void 0) try {
		errorBody = await response.text();
	} catch (_e) {
		errorBody = "";
	}
	const fullMessage = `Failed to ${context}. Received status [${response.status}]: ${response.statusText}. Message: ${errorBody}`;
	if (response.status === 404) throw new LangSmithNotFoundError(fullMessage);
	if (response.status === 409) throw new LangSmithConflictError(fullMessage);
	const err = new Error(fullMessage);
	err.status = response.status;
	throw err;
}
const ERR_CONFLICTING_ENDPOINTS = "ERR_CONFLICTING_ENDPOINTS";
var ConflictingEndpointsError = class extends Error {
	constructor() {
		super("You cannot provide both LANGSMITH_ENDPOINT / LANGCHAIN_ENDPOINT and LANGSMITH_RUNS_ENDPOINTS.");
		Object.defineProperty(this, "code", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: ERR_CONFLICTING_ENDPOINTS
		});
		this.name = "ConflictingEndpointsError";
	}
};
function isConflictingEndpointsError(err) {
	return typeof err === "object" && err !== null && err.code === ERR_CONFLICTING_ENDPOINTS;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/prompts.js
/**
* Parse a hub repo identifier (owner/name:hash, name, etc.).
*
* Prompts, agents, and skills share the same identifier grammar on Hub.
*/
function parseHubIdentifier(identifier) {
	if (!identifier || identifier.split("/").length > 2 || identifier.startsWith("/") || identifier.endsWith("/") || identifier.split(":").length > 2) throw new Error(getInvalidPromptIdentifierMsg(identifier));
	const [ownerNamePart, commitPart] = identifier.split(":");
	const commit = commitPart || "latest";
	if (ownerNamePart.includes("/")) {
		const [owner, name] = ownerNamePart.split("/", 2);
		if (!owner || !name) throw new Error(getInvalidPromptIdentifierMsg(identifier));
		return [
			owner,
			name,
			commit
		];
	} else {
		if (!ownerNamePart) throw new Error(getInvalidPromptIdentifierMsg(identifier));
		return [
			"-",
			ownerNamePart,
			commit
		];
	}
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/fs.js
/**
* File system abstraction (Node.js version).
*
* This file is swapped with fs.browser.ts for browser builds
* via the package.json browser field.
*/
const path = nodePath;
async function mkdir(dir) {
	await nodeFsPromises.mkdir(dir, { recursive: true });
}
async function writeFileAtomic(filePath, content) {
	const tempPath = `${filePath}.tmp`;
	await nodeFsPromises.writeFile(tempPath, content, {
		encoding: "utf8",
		mode: 384
	});
	await nodeFsPromises.rename(tempPath, filePath);
}
async function readdir(dir) {
	return nodeFsPromises.readdir(dir);
}
async function stat(filePath) {
	return nodeFsPromises.stat(filePath);
}
function existsSync(p) {
	return nodeFs.existsSync(p);
}
function mkdirSync(dir) {
	nodeFs.mkdirSync(dir, { recursive: true });
}
function writeFileSync(filePath, content) {
	nodeFs.writeFileSync(filePath, content);
}
function renameSync(oldPath, newPath) {
	nodeFs.renameSync(oldPath, newPath);
}
function unlinkSync(filePath) {
	nodeFs.unlinkSync(filePath);
}
function readFileSync(filePath) {
	return nodeFs.readFileSync(filePath, "utf-8");
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/prompt_cache/index.js
/**
* Prompt caching module for LangSmith SDK.
*
* Provides an LRU cache with background refresh for prompt caching.
* Uses stale-while-revalidate pattern for optimal performance.
*
* Works in all environments. File operations (dump/load) use the shared
* fs abstraction which is swapped for browser builds via package.json
* browser field (no-ops in browser — cache just doesn't persist).
*/
/**
* Check if a cache entry is stale based on TTL.
*/
function isStale(entry, ttlSeconds) {
	if (ttlSeconds === null) return false;
	return Date.now() - entry.createdAt > ttlSeconds * 1e3;
}
/**
* LRU cache with background refresh for prompts.
*
* Features:
* - In-memory LRU cache with configurable max size
* - Background refresh using setInterval
* - Stale-while-revalidate: returns stale data while refresh happens
* - Uses the most recently used client for a key for refreshes
* - JSON dump/load for offline use
*
* @example
* ```typescript
* const cache = new Cache({
*   maxSize: 100,
*   ttlSeconds: 3600,
* });
*
* // Use the cache
* cache.set("my-prompt:latest", promptCommit);
* const cached = cache.get("my-prompt:latest");
*
* // Cleanup
* cache.stop();
* ```
*/
var PromptCache = class {
	constructor(config = {}) {
		Object.defineProperty(this, "cache", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "maxSize", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "ttlSeconds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "refreshIntervalSeconds", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "refreshTimer", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_metrics", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {
				hits: 0,
				misses: 0,
				refreshes: 0,
				refreshErrors: 0
			}
		});
		this.configure(config);
	}
	/**
	* Get cache performance metrics.
	*/
	get metrics() {
		return { ...this._metrics };
	}
	/**
	* Get total cache requests (hits + misses).
	*/
	get totalRequests() {
		return this._metrics.hits + this._metrics.misses;
	}
	/**
	* Get cache hit rate (0.0 to 1.0).
	*/
	get hitRate() {
		const total = this.totalRequests;
		return total > 0 ? this._metrics.hits / total : 0;
	}
	/**
	* Reset all metrics to zero.
	*/
	resetMetrics() {
		this._metrics = {
			hits: 0,
			misses: 0,
			refreshes: 0,
			refreshErrors: 0
		};
	}
	/**
	* Get a value from cache.
	*
	* Returns the cached value or undefined if not found.
	* Stale entries are still returned (background refresh handles updates).
	*/
	get(key, refreshFunc) {
		if (this.maxSize === 0) return;
		const entry = this.cache.get(key);
		if (!entry) {
			this._metrics.misses += 1;
			return;
		}
		this.cache.delete(key);
		this.cache.set(key, {
			...entry,
			refreshFunc
		});
		this._metrics.hits += 1;
		return entry.value;
	}
	/**
	* Set a value in the cache.
	*/
	set(key, value, refreshFunc) {
		if (this.maxSize === 0) return;
		if (this.refreshTimer === void 0) this.startRefreshLoop();
		if (!this.cache.has(key) && this.cache.size >= this.maxSize) {
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== void 0) this.cache.delete(oldestKey);
		}
		const entry = {
			value,
			createdAt: Date.now(),
			refreshFunc
		};
		this.cache.delete(key);
		this.cache.set(key, entry);
	}
	/**
	* Remove a specific entry from cache.
	*/
	invalidate(key) {
		this.cache.delete(key);
	}
	/**
	* Clear all cache entries.
	*/
	clear() {
		this.cache.clear();
	}
	/**
	* Get the number of entries in the cache.
	*/
	get size() {
		return this.cache.size;
	}
	/**
	* Stop background refresh.
	* Should be called when the client is being cleaned up.
	*/
	stop() {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = void 0;
		}
	}
	/**
	* Dump cache contents to a JSON file for offline use.
	*/
	dump(filePath) {
		const entries = {};
		for (const [key, entry] of this.cache.entries()) entries[key] = entry.value;
		const dir = path.dirname(filePath);
		if (!existsSync(dir)) mkdirSync(dir);
		const tempPath = `${filePath}.tmp`;
		try {
			writeFileSync(tempPath, JSON.stringify({ entries }, null, 2));
			renameSync(tempPath, filePath);
		} catch (e) {
			if (existsSync(tempPath)) unlinkSync(tempPath);
			throw e;
		}
	}
	/**
	* Load cache contents from a JSON file.
	*
	* Loaded entries get a fresh TTL starting from load time.
	*
	* @returns Number of entries loaded.
	*/
	load(filePath) {
		if (!existsSync(filePath)) return 0;
		let entries;
		try {
			const content = readFileSync(filePath);
			entries = JSON.parse(content).entries ?? null;
		} catch {
			return 0;
		}
		if (!entries) return 0;
		let loaded = 0;
		const now = Date.now();
		for (const [key, value] of Object.entries(entries)) {
			if (this.cache.size >= this.maxSize) break;
			const entry = {
				value,
				createdAt: now
			};
			this.cache.set(key, entry);
			loaded += 1;
		}
		return loaded;
	}
	/**
	* Start the background refresh loop.
	*/
	startRefreshLoop() {
		this.stop();
		if (this.ttlSeconds !== null) {
			this.refreshTimer = setInterval(() => {
				this.refreshStaleEntries().catch((e) => {
					console.warn("Unexpected error in cache refresh loop:", e);
				});
			}, this.refreshIntervalSeconds * 1e3);
			if (this.refreshTimer.unref) this.refreshTimer.unref();
		}
	}
	/**
	* Get list of stale cache keys.
	*/
	getStaleEntries() {
		const staleEntries = [];
		for (const [key, value] of this.cache.entries()) if (isStale(value, this.ttlSeconds)) staleEntries.push([key, value]);
		return staleEntries;
	}
	/**
	* Check for stale entries and refresh them.
	*/
	async refreshStaleEntries() {
		const staleEntries = this.getStaleEntries();
		if (staleEntries.length === 0) return;
		for (const [key, value] of staleEntries) if (value.refreshFunc !== void 0) try {
			const newValue = await value.refreshFunc();
			this.set(key, newValue, value.refreshFunc);
			this._metrics.refreshes += 1;
		} catch (e) {
			this._metrics.refreshErrors += 1;
			console.warn(`Failed to refresh cache entry ${key}:`, e);
		}
	}
	configure(config) {
		this.stop();
		this.refreshIntervalSeconds = config.refreshIntervalSeconds ?? 60;
		this.maxSize = config.maxSize ?? 100;
		this.ttlSeconds = config.ttlSeconds ?? 300;
	}
};
/**
* Global singleton instance of PromptCache.
* Use configureGlobalPromptCache(), enableGlobalPromptCache(), or disableGlobalPromptCache() instead.
*/
const promptCacheSingleton = new PromptCache();
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/singletons/fetch.js
const DEFAULT_FETCH_IMPLEMENTATION = (...args) => fetch(...args);
let globalFetchSupportsWebStreaming = void 0;
const LANGSMITH_FETCH_IMPLEMENTATION_KEY = Symbol.for("ls:fetch_implementation");
const _shouldStreamForGlobalFetchImplementation = () => {
	if (globalThis[LANGSMITH_FETCH_IMPLEMENTATION_KEY] === void 0) return true;
	return globalFetchSupportsWebStreaming ?? false;
};
/**
* @internal
*/
const _getFetchImplementation = (debug) => {
	return async (...args) => {
		if (debug || getLangSmithEnvironmentVariable("DEBUG") === "true") {
			const [url, options] = args;
			console.log(`→ ${options?.method || "GET"} ${url}`);
		}
		const res = await (globalThis[LANGSMITH_FETCH_IMPLEMENTATION_KEY] ?? DEFAULT_FETCH_IMPLEMENTATION)(...args);
		if (debug || getLangSmithEnvironmentVariable("DEBUG") === "true") console.log(`← ${res.status} ${res.statusText} ${res.url}`);
		return res;
	};
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/fast-safe-stringify/index.js
var LIMIT_REPLACE_NODE = "[...]";
var CIRCULAR_REPLACE_NODE = { result: "[Circular]" };
var arr = [];
var replacerStack = [];
const encoder = new TextEncoder();
function defaultOptions() {
	return {
		depthLimit: Number.MAX_SAFE_INTEGER,
		edgesLimit: Number.MAX_SAFE_INTEGER
	};
}
function encodeString(str) {
	return encoder.encode(str);
}
function serializeWellKnownTypes(val) {
	if (val && typeof val === "object" && val !== null) {
		if (val instanceof Map) return Object.fromEntries(val);
		else if (val instanceof Set) return Array.from(val);
		else if (val instanceof Date) return val.toISOString();
		else if (val instanceof RegExp) return val.toString();
		else if (val instanceof Error) return {
			name: val.name,
			message: val.message
		};
	} else if (typeof val === "bigint") return val.toString();
	return val;
}
function createDefaultReplacer(userReplacer) {
	return function(key, val) {
		if (userReplacer) {
			const userResult = userReplacer.call(this, key, val);
			if (userResult !== void 0) return userResult;
		}
		return serializeWellKnownTypes(val);
	};
}
function estimateSerializedSize(value) {
	try {
		const ancestors = /* @__PURE__ */ new Set();
		let maxStringLen = 0;
		const byteLen = typeof Buffer !== "undefined" && typeof Buffer.byteLength === "function" ? (s) => Buffer.byteLength(s, "utf8") : (s) => s.length;
		function estimateString(s) {
			const n = byteLen(s);
			if (n > maxStringLen) maxStringLen = n;
			return n + 2;
		}
		function estimateByteArrayJson(byteLength) {
			if (byteLength === 0) return 2;
			return 2 + byteLength * 4;
		}
		function isDropped(v) {
			return v === void 0 || typeof v === "function" || typeof v === "symbol";
		}
		function estimateInArray(v) {
			if (v === void 0 || typeof v === "function" || typeof v === "symbol") return 4;
			return estimate(v);
		}
		function estimate(val) {
			if (val === null) return 4;
			if (val === void 0) return 0;
			const t = typeof val;
			if (t === "boolean") return 5;
			if (t === "number") {
				if (!Number.isFinite(val)) return 4;
				return val.toString().length;
			}
			if (t === "bigint") return val.toString().length + 2;
			if (t === "string") return estimateString(val);
			if (t === "function" || t === "symbol") return 0;
			const obj = val;
			if (obj instanceof Date) return 26;
			if (obj instanceof RegExp) return byteLen(obj.toString()) + 2;
			if (obj instanceof Error) {
				const name = obj.name ?? "";
				const message = obj.message ?? "";
				return 22 + byteLen(name) + byteLen(message);
			}
			if (typeof Buffer !== "undefined" && obj instanceof Buffer) return 28 + estimateByteArrayJson(obj.byteLength);
			if (ArrayBuffer.isView(obj)) {
				if (obj instanceof DataView) return 2;
				return 2 + (obj.length ?? 0) * (obj instanceof Float32Array || obj instanceof Float64Array ? 30 : 12);
			}
			if (obj instanceof ArrayBuffer) return 2;
			if (ancestors.has(obj)) return 24;
			if (typeof obj.toJSON === "function") {
				let projected;
				try {
					projected = obj.toJSON("");
				} catch {
					return 16;
				}
				ancestors.add(obj);
				const size = estimate(projected);
				ancestors.delete(obj);
				return size;
			}
			ancestors.add(obj);
			let size;
			if (Array.isArray(obj)) {
				size = 2;
				const len = obj.length;
				for (let i = 0; i < len; i++) {
					size += estimateInArray(obj[i]);
					if (i < len - 1) size += 1;
				}
			} else if (obj instanceof Map) {
				size = 2;
				let emitted = 0;
				for (const [k, v] of obj) {
					if (isDropped(v)) continue;
					if (emitted > 0) size += 1;
					size += byteLen(typeof k === "string" ? k : String(k)) + 3;
					size += estimate(v);
					emitted++;
				}
			} else if (obj instanceof Set) {
				size = 2;
				let emitted = 0;
				for (const v of obj) {
					if (emitted > 0) size += 1;
					size += estimateInArray(v);
					emitted++;
				}
			} else {
				size = 2;
				let emitted = 0;
				const keys = Object.keys(obj);
				for (let i = 0; i < keys.length; i++) {
					const key = keys[i];
					const v = obj[key];
					if (isDropped(v)) continue;
					if (emitted > 0) size += 1;
					size += byteLen(key) + 3;
					size += estimate(v);
					emitted++;
				}
			}
			ancestors.delete(obj);
			return size;
		}
		return {
			size: estimate(value),
			maxStringLen
		};
	} catch {
		return {
			size: serialize(value).length,
			maxStringLen: 0
		};
	}
}
function serialize(obj, errorContext, replacer, spacer, options) {
	try {
		return encodeString(JSON.stringify(obj, createDefaultReplacer(replacer), spacer));
	} catch (e) {
		if (!e.message?.includes("Converting circular structure to JSON")) {
			console.warn(`[WARNING]: LangSmith received unserializable value.${errorContext ? `\nContext: ${errorContext}` : ""}`);
			return encodeString("[Unserializable]");
		}
		getLangSmithEnvironmentVariable("SUPPRESS_CIRCULAR_JSON_WARNINGS") !== "true" && console.warn(`[WARNING]: LangSmith received circular JSON. This will decrease tracer performance. ${errorContext ? `\nContext: ${errorContext}` : ""}`);
		if (typeof options === "undefined") options = defaultOptions();
		decirc(obj, "", 0, [], void 0, 0, options);
		let res;
		try {
			if (replacerStack.length === 0) res = JSON.stringify(obj, replacer, spacer);
			else res = JSON.stringify(obj, replaceGetterValues(replacer), spacer);
		} catch (_) {
			return encodeString("[unable to serialize, circular reference is too complex to analyze]");
		} finally {
			while (arr.length !== 0) {
				const part = arr.pop();
				if (part.length === 4) Object.defineProperty(part[0], part[1], part[3]);
				else part[0][part[1]] = part[2];
			}
		}
		return encodeString(res);
	}
}
function setReplace(replace, val, k, parent) {
	var propertyDescriptor = Object.getOwnPropertyDescriptor(parent, k);
	if (propertyDescriptor.get !== void 0) if (propertyDescriptor.configurable) {
		Object.defineProperty(parent, k, { value: replace });
		arr.push([
			parent,
			k,
			val,
			propertyDescriptor
		]);
	} else replacerStack.push([
		val,
		k,
		replace
	]);
	else {
		parent[k] = replace;
		arr.push([
			parent,
			k,
			val
		]);
	}
}
function decirc(val, k, edgeIndex, stack, parent, depth, options) {
	depth += 1;
	var i;
	if (typeof val === "object" && val !== null) {
		for (i = 0; i < stack.length; i++) if (stack[i] === val) {
			setReplace(CIRCULAR_REPLACE_NODE, val, k, parent);
			return;
		}
		if (typeof options.depthLimit !== "undefined" && depth > options.depthLimit) {
			setReplace(LIMIT_REPLACE_NODE, val, k, parent);
			return;
		}
		if (typeof options.edgesLimit !== "undefined" && edgeIndex + 1 > options.edgesLimit) {
			setReplace(LIMIT_REPLACE_NODE, val, k, parent);
			return;
		}
		stack.push(val);
		if (Array.isArray(val)) for (i = 0; i < val.length; i++) decirc(val[i], i, i, stack, val, depth, options);
		else {
			val = serializeWellKnownTypes(val);
			var keys = Object.keys(val);
			for (i = 0; i < keys.length; i++) {
				var key = keys[i];
				decirc(val[key], key, i, stack, val, depth, options);
			}
		}
		stack.pop();
	}
}
function replaceGetterValues(replacer) {
	replacer = typeof replacer !== "undefined" ? replacer : function(k, v) {
		return v;
	};
	return function(key, val) {
		if (replacerStack.length > 0) for (var i = 0; i < replacerStack.length; i++) {
			var part = replacerStack[i];
			if (part[1] === key && part[0] === val) {
				val = part[2];
				replacerStack.splice(i, 1);
				break;
			}
		}
		return replacer.call(this, key, val);
	};
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/worker_threads.js
/**
* worker_threads abstraction (Node.js version).
*
* This file is swapped with worker_threads.browser.ts for browser / edge
* builds via the package.json `browser` field. Node gets the real module;
* browsers get a stub that signals unavailability.
*
* Only the surface actually used by SerializeWorker is re-exported.
*/
const Worker$1 = Worker;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/serialize_worker.js
/**
* Off-thread serialization using Node worker_threads.
*
* Falls back silently to synchronous serialize() when:
*   - worker_threads is unavailable (browsers, Deno, Bun without compat,
*     Cloudflare Workers, Vercel Edge, React Native)
*   - the worker cannot be constructed (bundler/runtime constraints)
*   - DataCloneError is thrown for a payload containing non-cloneable
*     values (functions, class instances with non-cloneable state, etc.)
*   - the worker crashes or throws
*
* Protocol:
*   main -> worker: { id, op, payload }
*     op = "serialize" -> worker returns bytes as a transferable ArrayBuffer
*   worker -> main: { id, bytes?: ArrayBuffer, error?: string }
*
* The worker source is inlined as a string so the library bundles cleanly
* under webpack/esbuild/ncc without requiring a separate asset file.
*/
const WORKER_SOURCE = `
const { parentPort } = require("worker_threads");

const CIRCULAR_REPLACE_NODE = { result: "[Circular]" };

function serializeWellKnownTypes(val) {
  if (val && typeof val === "object") {
    if (val instanceof Map) return Object.fromEntries(val);
    if (val instanceof Set) return Array.from(val);
    if (val instanceof Date) return val.toISOString();
    if (val instanceof RegExp) return val.toString();
    if (val instanceof Error) return { name: val.name, message: val.message };
  } else if (typeof val === "bigint") {
    return val.toString();
  }
  return val;
}

function defaultReplacer(_key, val) {
  return serializeWellKnownTypes(val);
}

// Decirculate in-place: replace circular refs with { result: "[Circular]" }
// then restore after stringify. Mirrors fast-safe-stringify's decirc().
const restoreStack = [];
function decirc(val, k, stack, parent) {
  if (typeof val === "object" && val !== null) {
    for (let i = 0; i < stack.length; i++) {
      if (stack[i] === val) {
        const orig = parent[k];
        parent[k] = CIRCULAR_REPLACE_NODE;
        restoreStack.push([parent, k, orig]);
        return;
      }
    }
    stack.push(val);
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) decirc(val[i], i, stack, val);
    } else {
      const normalized = serializeWellKnownTypes(val);
      // Only recurse into normalized if it's still an object (arrays/objects),
      // else it was replaced with a primitive (e.g. Date -> string).
      if (normalized === val) {
        const keys = Object.keys(val);
        for (let i = 0; i < keys.length; i++) decirc(val[keys[i]], keys[i], stack, val);
      }
    }
    stack.pop();
  }
}

function serialize(obj) {
  try {
    return JSON.stringify(obj, defaultReplacer);
  } catch (e) {
    if (!String(e && e.message).includes("Converting circular structure to JSON")) {
      return "[Unserializable]";
    }
    decirc(obj, "", [], { "": obj });
    try {
      return JSON.stringify(obj, defaultReplacer);
    } catch (_) {
      return "[unable to serialize, circular reference is too complex to analyze]";
    } finally {
      while (restoreStack.length) {
        const [p, k, v] = restoreStack.pop();
        p[k] = v;
      }
    }
  }
}

parentPort.on("message", (msg) => {
  const { id, op, payload } = msg;
  try {
    if (op === "serialize") {
      const str = serialize(payload);
      const buf = Buffer.from(str, "utf8");
      // Slice into its own ArrayBuffer so we can transfer without dragging
      // unrelated bytes from any shared pool buffer.
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      parentPort.postMessage({ id, bytes: ab, length: buf.byteLength }, [ab]);
    } else if (op === "ping") {
      parentPort.postMessage({ id });
    } else {
      parentPort.postMessage({ id, error: "unknown op: " + op });
    }
  } catch (e) {
    parentPort.postMessage({ id, error: String((e && e.message) || e) });
  }
});
`;
var SerializeWorker = class {
	constructor() {
		Object.defineProperty(this, "worker", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "nextId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 1
		});
		Object.defineProperty(this, "pending", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "disabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "startPromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
	}
	/**
	* Try to construct the worker. Returns false if the runtime can't support
	* it -- in that case callers must fall back to synchronous serialization.
	* Kept async so callers don't have to branch on runtime -- the promise
	* resolves synchronously on the microtask queue when the worker module
	* is available, which is the common Node CJS/ESM path.
	*/
	async ensureStarted() {
		if (this.disabled) return false;
		if (this.worker !== null) return true;
		if (this.startPromise !== null) return this.startPromise;
		this.startPromise = this._start();
		try {
			return await this.startPromise;
		} finally {
			this.startPromise = null;
		}
	}
	async _start() {
		if (Worker$1 === null) {
			this.disabled = true;
			return false;
		}
		try {
			const worker = new Worker$1(WORKER_SOURCE, { eval: true });
			worker.on("message", (msg) => {
				const p = this.pending.get(msg.id);
				if (!p) return;
				this.pending.delete(msg.id);
				if (msg.error) p.reject(new Error(msg.error));
				else if (msg.bytes && typeof msg.length === "number") p.resolve(new Uint8Array(msg.bytes, 0, msg.length));
				else p.reject(/* @__PURE__ */ new Error("worker returned malformed message"));
			});
			worker.on("error", (err) => {
				for (const [, p] of this.pending) p.reject(err);
				this.pending.clear();
				this.disabled = true;
				this.worker = null;
			});
			worker.on("exit", (code) => {
				for (const [, p] of this.pending) p.reject(/* @__PURE__ */ new Error(`worker exited with code ${code}`));
				this.pending.clear();
				this.worker = null;
			});
			worker.unref();
			this.worker = worker;
			return true;
		} catch {
			this.disabled = true;
			return false;
		}
	}
	/**
	* Serialize a payload off-thread. Rejects with DataCloneError (or similar)
	* if the payload contains non-cloneable values -- callers must catch and
	* fall back to synchronous serialize().
	*
	* Resolves with null if the worker subsystem is unavailable entirely,
	* so the caller can fall back without paying try/catch overhead.
	*/
	async serialize(payload) {
		if (!await this.ensureStarted()) return null;
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, {
				resolve,
				reject
			});
			try {
				this.worker.postMessage({
					id,
					op: "serialize",
					payload
				});
			} catch (e) {
				this.pending.delete(id);
				reject(e);
			}
		});
	}
	async terminate() {
		if (this.worker) {
			await this.worker.terminate();
			this.worker = null;
		}
		for (const [, p] of this.pending) p.reject(/* @__PURE__ */ new Error("worker terminated"));
		this.pending.clear();
	}
};
let sharedWorker = null;
/**
* Process-wide shared worker. One worker serves all Client instances to
* avoid spawning multiple threads per process.
*/
function getSharedSerializeWorker() {
	if (sharedWorker === null) sharedWorker = new SerializeWorker();
	return sharedWorker;
}
/**
* Minimum string length (in UTF-16 code units) that justifies the overhead
* of dispatching serialization to a worker thread.
*
* Rationale: V8's postMessage / structuredClone fast-paths large strings
* across isolates by refcounting their underlying storage rather than
* copying the bytes. This makes worker offload a big win for payloads
* dominated by a handful of multi-hundred-KB strings (the classic case is
* base64-encoded images or audio in LLM messages), but a net loss for
* payloads whose bulk is structural -- thousands of keys, deep nesting,
* many small strings -- because every object node must still be walked
* and cloned.
*
* 64KB sits comfortably above typical "chunk of agent state" or "long
* prompt" values (a few KB) and below typical base64 media payloads
* (hundreds of KB to several MB).
*/
const LARGE_STRING_THRESHOLD = 64 * 1024;
/**
* Maximum number of nodes to inspect before giving up and assuming the
* payload is not worth offloading. Prevents the check itself from becoming
* expensive on pathologically structural payloads (many thousands of small
* keys / array elements).
*
* When the budget is exhausted without finding a large string we return
* false (do not offload). This is the conservative choice: such payloads
* are structural by nature and worker offload empirically regresses them.
*/
const NODE_BUDGET = 2048;
/**
* Cheap, short-circuiting walk that returns true iff the payload contains
* at least one string of length >= threshold anywhere in its graph.
*
* - Terminates immediately on the first qualifying string.
* - Caps total nodes visited at `nodeBudget` so cost is bounded for huge
*   structural payloads.
* - Avoids allocation in the common path: uses an array as a stack and a
*   Set only for cycle detection.
* - Uses `string.length` (UTF-16 units), not UTF-8 byte length, because
*   that's what V8's string-sharing fast path keys on and because it's
*   an O(1) property access. For ASCII content this is identical to the
*   UTF-8 byte count; for non-ASCII text the two differ by at most 4x,
*   well within the safety margin of the threshold.
*/
function hasLargeString(value, threshold = LARGE_STRING_THRESHOLD, nodeBudget = NODE_BUDGET) {
	if (value === null || typeof value !== "object") return typeof value === "string" && value.length >= threshold;
	const stack = [value];
	const seen = /* @__PURE__ */ new Set();
	let visited = 0;
	while (stack.length > 0) {
		if (visited++ >= nodeBudget) return false;
		const cur = stack.pop();
		if (cur === null || cur === void 0) continue;
		const t = typeof cur;
		if (t === "string") {
			if (cur.length >= threshold) return true;
			continue;
		}
		if (t !== "object") continue;
		const obj = cur;
		if (seen.has(obj)) continue;
		seen.add(obj);
		if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error || obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) continue;
		if (Array.isArray(obj)) {
			for (let i = obj.length - 1; i >= 0; i--) stack.push(obj[i]);
			continue;
		}
		if (obj instanceof Map) {
			for (const [, v] of obj) stack.push(v);
			continue;
		}
		if (obj instanceof Set) {
			for (const v of obj) stack.push(v);
			continue;
		}
		const keys = Object.keys(obj);
		for (let i = keys.length - 1; i >= 0; i--) stack.push(obj[keys[i]]);
	}
	return false;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/client.js
function assertPullPublicPromptAllowed(promptIdentifier, dangerouslyPullPublicPrompt) {
	const [owner] = parseHubIdentifier(promptIdentifier);
	if (owner !== "-" && !dangerouslyPullPublicPrompt) throw new Error("Pulling a public prompt by owner/name is disabled by default because prompts may contain untrusted serialized LangChain objects. If you trust this prompt, set `dangerouslyPullPublicPrompt: true` to acknowledge the risk.");
}
/**
* Catches timestamps without a timezone suffix.
*/
function _ensureUTCTimestamp(ts) {
	if (typeof ts === "string" && ts.length > 0 && !ts.includes("Z") && !ts.includes("+") && !ts.includes("-", 10)) return ts + "Z";
	return ts;
}
function _normalizeRunTimestamps(run) {
	return {
		...run,
		start_time: _ensureUTCTimestamp(run.start_time),
		end_time: _ensureUTCTimestamp(run.end_time)
	};
}
function mergeRuntimeEnvIntoRun(run, cachedEnvVars, omitTracedRuntimeInfo) {
	if (omitTracedRuntimeInfo) return run;
	const runtimeEnv = getRuntimeEnvironment();
	const envVars = cachedEnvVars ?? getLangSmithEnvVarsMetadata();
	const extra = run.extra ?? {};
	const metadata = extra.metadata;
	run.extra = {
		...extra,
		runtime: {
			...runtimeEnv,
			...extra?.runtime
		},
		metadata: {
			...envVars,
			...envVars.revision_id || "revision_id" in run && run.revision_id ? { revision_id: ("revision_id" in run ? run.revision_id : void 0) ?? envVars.revision_id } : {},
			...metadata
		}
	};
	return run;
}
const getTracingSamplingRate = (configRate) => {
	const samplingRateStr = configRate?.toString() ?? getLangSmithEnvironmentVariable("TRACING_SAMPLING_RATE");
	if (samplingRateStr === void 0) return;
	const samplingRate = parseFloat(samplingRateStr);
	if (samplingRate < 0 || samplingRate > 1) throw new Error(`LANGSMITH_TRACING_SAMPLING_RATE must be between 0 and 1 if set. Got: ${samplingRate}`);
	return samplingRate;
};
const isLocalhost = (url) => {
	const hostname = url.replace("http://", "").replace("https://", "").split("/")[0].split(":")[0];
	return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
};
async function toArray(iterable) {
	const result = [];
	for await (const item of iterable) result.push(item);
	return result;
}
function trimQuotes(str) {
	if (str === void 0) return;
	return str.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}
const handle429 = async (response) => {
	if (response?.status === 429) {
		const retryAfter = parseInt(response.headers.get("retry-after") ?? "10", 10) * 1e3;
		if (retryAfter > 0) {
			await new Promise((resolve) => setTimeout(resolve, retryAfter));
			return true;
		}
	}
	return false;
};
function _formatFeedbackScore(score) {
	if (typeof score === "number") return Number(score.toFixed(4));
	return score;
}
const SERVER_INFO_REQUEST_TIMEOUT_MS = 1e4;
/** Maximum number of operations to batch in a single request. */
const DEFAULT_BATCH_SIZE_LIMIT = 100;
const DEFAULT_API_URL = "https://api.smith.langchain.com";
var AutoBatchQueue = class {
	constructor(maxSizeBytes) {
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "sizeBytes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 0
		});
		Object.defineProperty(this, "maxSizeBytes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.maxSizeBytes = maxSizeBytes ?? 1073741824;
	}
	peek() {
		return this.items[0];
	}
	push(item) {
		let itemPromiseResolve;
		const itemPromise = new Promise((resolve) => {
			itemPromiseResolve = resolve;
		});
		const size = estimateSerializedSize(item.item).size;
		if (this.sizeBytes + size > this.maxSizeBytes && this.items.length > 0) {
			console.warn(`AutoBatchQueue size limit (${this.maxSizeBytes} bytes) exceeded. Dropping run with id: ${item.item.id}. Current queue size: ${this.sizeBytes} bytes, attempted addition: ${size} bytes.`);
			itemPromiseResolve();
			return itemPromise;
		}
		this.items.push({
			action: item.action,
			payload: item.item,
			otelContext: item.otelContext,
			apiKey: item.apiKey,
			apiUrl: item.apiUrl,
			itemPromiseResolve,
			itemPromise,
			size
		});
		this.sizeBytes += size;
		return itemPromise;
	}
	pop({ upToSizeBytes, upToSize }) {
		if (upToSizeBytes < 1) throw new Error("Number of bytes to pop off may not be less than 1.");
		const popped = [];
		let poppedSizeBytes = 0;
		while (poppedSizeBytes + (this.peek()?.size ?? 0) < upToSizeBytes && this.items.length > 0 && popped.length < upToSize) {
			const item = this.items.shift();
			if (item) {
				popped.push(item);
				poppedSizeBytes += item.size;
				this.sizeBytes -= item.size;
			}
		}
		if (popped.length === 0 && this.items.length > 0) {
			const item = this.items.shift();
			popped.push(item);
			poppedSizeBytes += item.size;
			this.sizeBytes -= item.size;
		}
		return [popped.map((it) => ({
			action: it.action,
			item: it.payload,
			otelContext: it.otelContext,
			apiKey: it.apiKey,
			apiUrl: it.apiUrl,
			size: it.size
		})), () => popped.forEach((it) => it.itemPromiseResolve())];
	}
};
var Client = class Client {
	get tracingMode() {
		return this._tracingMode;
	}
	get _fetch() {
		return this.fetchImplementation || _getFetchImplementation(this.debug);
	}
	/**
	* Serialize a payload for tracing, optionally offloading the work to a
	* Node worker thread when the runtime supports worker_threads.
	*
	* Falls back to synchronous serialization when:
	*  - manualFlushMode is enabled (serverless: worker boot cost > benefit)
	*  - worker_threads is unavailable (non-Node runtimes)
	*  - the payload contains values that can't be structured-cloned across
	*    threads (functions, non-cloneable class instances, streams, etc.)
	*  - the worker throws for any other reason
	*
	* In all fallback cases the returned bytes are identical to the sync path.
	*/
	_trackDrain(promise) {
		this._pendingDrains.add(promise);
		promise.finally(() => {
			this._pendingDrains.delete(promise);
		});
	}
	async _serializeBody(payload, errorContext) {
		if (this.manualFlushMode) return serialize(payload, errorContext);
		if (!hasLargeString(payload)) return serialize(payload, errorContext);
		if (this._serializeWorker === void 0) this._serializeWorker = getSharedSerializeWorker();
		if (this._serializeWorker === null) return serialize(payload, errorContext);
		try {
			const bytes = await this._serializeWorker.serialize(payload);
			if (bytes === null) {
				this._serializeWorker = null;
				return serialize(payload, errorContext);
			}
			return bytes;
		} catch {
			return serialize(payload, errorContext);
		}
	}
	constructor(config = {}) {
		Object.defineProperty(this, "apiKey", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "apiUrl", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "webUrl", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "workspaceId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "caller", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "batchIngestCaller", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "timeout_ms", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_tenantId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "hideInputs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "hideOutputs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "hideMetadata", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "omitTracedRuntimeInfo", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "tracingSampleRate", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "filteredPostUuids", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "autoBatchTracing", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: true
		});
		Object.defineProperty(this, "autoBatchQueue", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "autoBatchTimeout", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "autoBatchAggregationDelayMs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 250
		});
		Object.defineProperty(this, "batchSizeBytesLimit", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "batchSizeLimit", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "fetchOptions", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "settings", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "blockOnRootRunFinalization", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: getEnvironmentVariable("LANGSMITH_TRACING_BACKGROUND") === "false"
		});
		Object.defineProperty(this, "traceBatchConcurrency", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 5
		});
		Object.defineProperty(this, "_serverInfo", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_getServerInfoPromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "manualFlushMode", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "_serializeWorker", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/**
		* Tracks in-flight drainAutoBatchQueue promises so awaitPendingTraceBatches
		* can wait on them even if the flush involves async work (worker-thread
		* serialize) that hasn't yet registered with batchIngestCaller.queue.
		*/
		Object.defineProperty(this, "_pendingDrains", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "langSmithToOTELTranslator", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_tracingMode", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "langsmith"
		});
		Object.defineProperty(this, "fetchImplementation", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "cachedLSEnvVarsForMetadata", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_promptCache", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "multipartStreamingDisabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "_multipartDisabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "_runCompressionDisabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: getLangSmithEnvironmentVariable("DISABLE_RUN_COMPRESSION") === "true"
		});
		Object.defineProperty(this, "failedTracesDir", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "failedTracesMaxBytes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: 100 * 1024 * 1024
		});
		Object.defineProperty(this, "_customHeaders", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {}
		});
		Object.defineProperty(this, "debug", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: getEnvironmentVariable("LANGSMITH_DEBUG") === "true"
		});
		const defaultConfig = Client.getDefaultClientConfig();
		this.tracingSampleRate = getTracingSamplingRate(config.tracingSamplingRate);
		this.apiUrl = trimQuotes(config.apiUrl ?? defaultConfig.apiUrl) ?? "";
		if (this.apiUrl.endsWith("/")) this.apiUrl = this.apiUrl.slice(0, -1);
		this.apiKey = trimQuotes(config.apiKey ?? defaultConfig.apiKey);
		this.webUrl = trimQuotes(config.webUrl ?? defaultConfig.webUrl);
		if (this.webUrl?.endsWith("/")) this.webUrl = this.webUrl.slice(0, -1);
		this.workspaceId = trimQuotes(config.workspaceId ?? getLangSmithEnvironmentVariable("WORKSPACE_ID"));
		this.timeout_ms = config.timeout_ms ?? 9e4;
		this.caller = new AsyncCaller({
			...config.callerOptions ?? {},
			maxRetries: 4,
			debug: config.debug ?? this.debug
		});
		this.traceBatchConcurrency = config.traceBatchConcurrency ?? this.traceBatchConcurrency;
		if (this.traceBatchConcurrency < 1) throw new Error("Trace batch concurrency must be positive.");
		this.debug = config.debug ?? this.debug;
		this.fetchImplementation = config.fetchImplementation;
		this.failedTracesDir = getLangSmithEnvironmentVariable("FAILED_TRACES_DIR") || void 0;
		const failedTracesMb = getLangSmithEnvironmentVariable("FAILED_TRACES_MAX_MB");
		if (failedTracesMb) {
			const n = parseInt(failedTracesMb, 10);
			if (Number.isFinite(n) && n > 0) this.failedTracesMaxBytes = n * 1024 * 1024;
		}
		const maxMemory = config.maxIngestMemoryBytes ?? 1073741824;
		this.batchIngestCaller = new AsyncCaller({
			maxRetries: 4,
			maxConcurrency: this.traceBatchConcurrency,
			maxQueueSizeBytes: maxMemory,
			...config.callerOptions ?? {},
			onFailedResponseHook: handle429,
			debug: config.debug ?? this.debug
		});
		this.hideInputs = config.hideInputs ?? config.anonymizer ?? defaultConfig.hideInputs;
		this.hideOutputs = config.hideOutputs ?? config.anonymizer ?? defaultConfig.hideOutputs;
		this.hideMetadata = config.hideMetadata ?? defaultConfig.hideMetadata;
		this.omitTracedRuntimeInfo = config.omitTracedRuntimeInfo ?? false;
		this.autoBatchTracing = config.autoBatchTracing ?? this.autoBatchTracing;
		this.autoBatchQueue = new AutoBatchQueue(maxMemory);
		this.blockOnRootRunFinalization = config.blockOnRootRunFinalization ?? this.blockOnRootRunFinalization;
		this.batchSizeBytesLimit = config.batchSizeBytesLimit;
		this.batchSizeLimit = config.batchSizeLimit;
		this.fetchOptions = config.fetchOptions || {};
		this.manualFlushMode = config.manualFlushMode ?? this.manualFlushMode;
		this._tracingMode = resolveTracingMode(config.tracingMode);
		if (this._tracingMode === "otel") this.langSmithToOTELTranslator = new LangSmithToOTELTranslator();
		this.cachedLSEnvVarsForMetadata = getLangSmithEnvVarsMetadata();
		if (config.cache !== void 0 && config.disablePromptCache) warnOnce("Both 'cache' and 'disablePromptCache' were provided. The 'cache' parameter is deprecated and will be removed in a future version. Using 'cache' parameter value.");
		if (config.cache !== void 0) {
			warnOnce("The 'cache' parameter is deprecated and will be removed in a future version. Use 'configureGlobalPromptCache()' to configure the global cache, or 'disablePromptCache: true' to disable caching for this client.");
			if (config.cache === false) this._promptCache = void 0;
			else if (config.cache === true) this._promptCache = promptCacheSingleton;
			else this._promptCache = config.cache;
		} else if (!config.disablePromptCache) this._promptCache = promptCacheSingleton;
		this._customHeaders = config.headers ?? {};
	}
	static getDefaultClientConfig() {
		const apiKey = getLangSmithEnvironmentVariable("API_KEY");
		return {
			apiUrl: getLangSmithEnvironmentVariable("ENDPOINT") ?? DEFAULT_API_URL,
			apiKey,
			webUrl: void 0,
			hideInputs: getLangSmithEnvironmentVariable("HIDE_INPUTS") === "true",
			hideOutputs: getLangSmithEnvironmentVariable("HIDE_OUTPUTS") === "true",
			hideMetadata: getLangSmithEnvironmentVariable("HIDE_METADATA") === "true"
		};
	}
	getHostUrl() {
		if (this.webUrl) return this.webUrl;
		else if (isLocalhost(this.apiUrl)) {
			this.webUrl = "http://localhost:3000";
			return this.webUrl;
		} else if (this.apiUrl.endsWith("/api/v1")) {
			this.webUrl = this.apiUrl.replace("/api/v1", "");
			return this.webUrl;
		} else if (this.apiUrl.includes("/api") && !this.apiUrl.split(".", 1)[0].endsWith("api")) {
			this.webUrl = this.apiUrl.replace("/api", "");
			return this.webUrl;
		} else if (this.apiUrl.split(".", 1)[0].includes("dev")) {
			this.webUrl = "https://dev.smith.langchain.com";
			return this.webUrl;
		} else if (this.apiUrl.split(".", 1)[0].includes("eu")) {
			this.webUrl = "https://eu.smith.langchain.com";
			return this.webUrl;
		} else if (this.apiUrl.split(".", 1)[0].includes("aws")) {
			this.webUrl = "https://aws.smith.langchain.com";
			return this.webUrl;
		} else if (this.apiUrl.split(".", 1)[0].includes("apac")) {
			this.webUrl = "https://apac.smith.langchain.com";
			return this.webUrl;
		} else if (this.apiUrl.split(".", 1)[0].includes("beta")) {
			this.webUrl = "https://beta.smith.langchain.com";
			return this.webUrl;
		} else {
			this.webUrl = "https://smith.langchain.com";
			return this.webUrl;
		}
	}
	get _mergedHeaders() {
		const headers = {
			"User-Agent": `langsmith-js/${__version__}`,
			...this._customHeaders
		};
		if (this.apiKey) headers["x-api-key"] = `${this.apiKey}`;
		if (this.workspaceId) headers["x-tenant-id"] = this.workspaceId;
		return headers;
	}
	/**
	* Get or set custom headers for the client.
	* Custom headers are merged with default headers (User-Agent, x-api-key, x-tenant-id).
	* Custom headers will not override the default required headers.
	*/
	get headers() {
		return this._customHeaders;
	}
	set headers(value) {
		this._customHeaders = value ?? {};
	}
	_getPlatformEndpointPath(path) {
		return this.apiUrl.slice(-3) !== "/v1" && this.apiUrl.slice(-4) !== "/v1/" ? `/v1/platform/${path}` : `/platform/${path}`;
	}
	async processInputs(inputs) {
		if (this.hideInputs === false) return inputs;
		if (this.hideInputs === true) return {};
		if (typeof this.hideInputs === "function") return this.hideInputs(inputs);
		return inputs;
	}
	async processOutputs(outputs) {
		if (this.hideOutputs === false) return outputs;
		if (this.hideOutputs === true) return {};
		if (typeof this.hideOutputs === "function") return this.hideOutputs(outputs);
		return outputs;
	}
	async processMetadata(metadata) {
		if (this.hideMetadata === false) return metadata;
		if (this.hideMetadata === true) return {};
		if (typeof this.hideMetadata === "function") return this.hideMetadata(metadata);
		return metadata;
	}
	/**
	* Filter content from new_token events to prevent streaming LLM output
	* from being uploaded via events.
	*/
	_filterNewTokenEvents(events) {
		if (!events || events.length === 0) return events;
		return events.map((event) => {
			if (event.name === "new_token") {
				const { kwargs: _, ...rest } = event;
				return rest;
			}
			return event;
		});
	}
	async prepareRunCreateOrUpdateInputs(run) {
		const runParams = { ...run };
		if (runParams.inputs !== void 0) runParams.inputs = await this.processInputs(runParams.inputs);
		if (runParams.outputs !== void 0) runParams.outputs = await this.processOutputs(runParams.outputs);
		if (runParams.extra != null && "metadata" in runParams.extra) runParams.extra = {
			...runParams.extra,
			metadata: await this.processMetadata(runParams.extra.metadata)
		};
		if (runParams.events !== void 0) runParams.events = this._filterNewTokenEvents(runParams.events);
		return runParams;
	}
	async _getResponse(path, queryParams) {
		const paramsString = queryParams?.toString() ?? "";
		const url = `${this.apiUrl}${path}?${paramsString}`;
		return await this.caller.call(async () => {
			const res = await this._fetch(url, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, `fetch ${path}`);
			return res;
		});
	}
	async _get(path, queryParams) {
		return (await this._getResponse(path, queryParams)).json();
	}
	async *_getPaginated(path, queryParams = new URLSearchParams(), transform) {
		let offset = Number(queryParams.get("offset")) || 0;
		const limit = Number(queryParams.get("limit")) || 100;
		while (true) {
			queryParams.set("offset", String(offset));
			queryParams.set("limit", String(limit));
			const url = `${this.apiUrl}${path}?${queryParams}`;
			const response = await this.caller.call(async () => {
				const res = await this._fetch(url, {
					method: "GET",
					headers: this._mergedHeaders,
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions
				});
				await raiseForStatus(res, `fetch ${path}`);
				return res;
			});
			const items = transform ? transform(await response.json()) : await response.json();
			if (items.length === 0) break;
			yield items;
			if (items.length < limit) break;
			offset += items.length;
		}
	}
	async *_getCursorPaginatedList(path, body = null, requestMethod = "POST", dataKey = "runs") {
		const bodyParams = body ? { ...body } : {};
		while (true) {
			const body = JSON.stringify(bodyParams);
			const responseBody = await (await this.caller.call(async () => {
				const res = await this._fetch(`${this.apiUrl}${path}`, {
					method: requestMethod,
					headers: {
						...this._mergedHeaders,
						"Content-Type": "application/json"
					},
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions,
					body
				});
				await raiseForStatus(res, `fetch ${path}`);
				return res;
			})).json();
			if (!responseBody) break;
			if (!responseBody[dataKey]) break;
			yield responseBody[dataKey];
			const cursors = responseBody.cursors;
			if (!cursors) break;
			if (!cursors.next) break;
			bodyParams.cursor = cursors.next;
		}
	}
	_shouldSample() {
		if (this.tracingSampleRate === void 0) return true;
		return Math.random() < this.tracingSampleRate;
	}
	_filterForSampling(runs, patch = false) {
		if (this.tracingSampleRate === void 0) return runs;
		if (patch) {
			const sampled = [];
			for (const run of runs) if (!this.filteredPostUuids.has(run.trace_id)) sampled.push(run);
			else if (run.id === run.trace_id) this.filteredPostUuids.delete(run.trace_id);
			return sampled;
		} else {
			const sampled = [];
			for (const run of runs) {
				const traceId = run.trace_id ?? run.id;
				if (this.filteredPostUuids.has(traceId)) continue;
				if (run.id === traceId) if (this._shouldSample()) sampled.push(run);
				else this.filteredPostUuids.add(traceId);
				else sampled.push(run);
			}
			return sampled;
		}
	}
	async _getBatchSizeLimitBytes() {
		const serverInfo = await this._ensureServerInfo();
		return this.batchSizeBytesLimit ?? serverInfo?.batch_ingest_config?.size_limit_bytes ?? 25165824;
	}
	/**
	* Get the maximum number of operations to batch in a single request.
	*/
	async _getBatchSizeLimit() {
		const serverInfo = await this._ensureServerInfo();
		return this.batchSizeLimit ?? serverInfo?.batch_ingest_config?.size_limit ?? DEFAULT_BATCH_SIZE_LIMIT;
	}
	async _getDatasetExamplesMultiPartSupport() {
		return (await this._ensureServerInfo()).instance_flags?.dataset_examples_multipart_enabled ?? false;
	}
	drainAutoBatchQueue({ batchSizeLimitBytes, batchSizeLimit }) {
		const promises = [];
		while (this.autoBatchQueue.items.length > 0) {
			const [batch, done] = this.autoBatchQueue.pop({
				upToSizeBytes: batchSizeLimitBytes,
				upToSize: batchSizeLimit
			});
			if (!batch.length) {
				done();
				break;
			}
			const batchesByDestination = batch.reduce((acc, item) => {
				const apiUrl = item.apiUrl ?? this.apiUrl;
				const apiKey = item.apiKey ?? this.apiKey;
				const batchKey = item.apiKey === this.apiKey && item.apiUrl === this.apiUrl ? "default" : `${apiUrl}|${apiKey}`;
				if (!acc[batchKey]) acc[batchKey] = [];
				acc[batchKey].push(item);
				return acc;
			}, {});
			const batchPromises = [];
			for (const [batchKey, batch] of Object.entries(batchesByDestination)) {
				const batchPromise = this._processBatch(batch, {
					apiUrl: batchKey === "default" ? void 0 : batchKey.split("|")[0],
					apiKey: batchKey === "default" ? void 0 : batchKey.split("|")[1]
				});
				batchPromises.push(batchPromise);
			}
			const allBatchesPromise = Promise.all(batchPromises).finally(done);
			promises.push(allBatchesPromise);
		}
		return Promise.all(promises);
	}
	/**
	* Persist a failed trace payload to a local fallback directory.
	*
	* Saves a self-contained JSON file containing the endpoint path, the HTTP
	* headers required for replay, and the base64-encoded request body.
	* Can be replayed later with a simple POST:
	*
	*   POST /<endpoint>
	*   Content-Type: <value from saved headers>
	*   [Content-Encoding: <value from saved headers>]
	*   <decoded body>
	*/
	static async _writeTraceToFallbackDir(directory, body, replayHeaders, endpoint, maxBytes) {
		try {
			const bodyBuffer = typeof body === "string" ? Buffer.from(body, "utf8") : Buffer.from(body);
			const envelope = JSON.stringify({
				version: 1,
				endpoint,
				headers: replayHeaders,
				body_base64: bodyBuffer.toString("base64")
			});
			const filename = `trace_${Date.now()}_${v4().slice(0, 8)}.json`;
			const filepath = path.join(directory, filename);
			if (!Client._fallbackDirsCreated.has(directory)) {
				await mkdir(directory);
				Client._fallbackDirsCreated.add(directory);
			}
			if (maxBytes !== void 0 && maxBytes > 0) try {
				const traceFiles = (await readdir(directory)).filter((f) => f.startsWith("trace_") && f.endsWith(".json"));
				let total = 0;
				for (const name of traceFiles) {
					const { size } = await stat(path.join(directory, name));
					total += size;
				}
				if (total >= maxBytes) {
					console.warn(`Could not write trace to fallback dir ${directory} as it's already over size limit (${total} bytes >= ${maxBytes} bytes). Increase LANGSMITH_FAILED_TRACES_MAX_MB if possible.`);
					return;
				}
			} catch {}
			await writeFileAtomic(filepath, envelope);
			console.warn(`LangSmith trace upload failed; data saved to ${filepath} for later replay.`);
		} catch (writeErr) {
			console.error(`LangSmith tracing error: could not write trace to fallback dir ${directory}:`, writeErr);
		}
	}
	async _processBatch(batch, options) {
		if (!batch.length) return;
		const batchSizeBytes = batch.reduce((sum, item) => sum + (item.size ?? 0), 0);
		try {
			if (this.langSmithToOTELTranslator !== void 0) this._sendBatchToOTELTranslator(batch);
			else {
				const ingestParams = {
					runCreates: batch.filter((item) => item.action === "create").map((item) => item.item),
					runUpdates: batch.filter((item) => item.action === "update").map((item) => item.item)
				};
				const serverInfo = await this._ensureServerInfo();
				if (!this._multipartDisabled && (serverInfo?.batch_ingest_config?.use_multipart_endpoint ?? true)) {
					const useGzip = !this._runCompressionDisabled && serverInfo?.instance_flags?.gzip_body_enabled;
					try {
						await this.multipartIngestRuns(ingestParams, {
							...options,
							useGzip,
							sizeBytes: batchSizeBytes
						});
					} catch (e) {
						if (isLangSmithNotFoundError(e)) {
							this._multipartDisabled = true;
							await this.batchIngestRuns(ingestParams, {
								...options,
								sizeBytes: batchSizeBytes
							});
						} else throw e;
					}
				} else await this.batchIngestRuns(ingestParams, {
					...options,
					sizeBytes: batchSizeBytes
				});
			}
		} catch (e) {
			console.error("Error exporting batch:", e);
		}
	}
	_sendBatchToOTELTranslator(batch) {
		if (this.langSmithToOTELTranslator !== void 0) {
			const otelContextMap = /* @__PURE__ */ new Map();
			const operations = [];
			for (const item of batch) if (item.item.id && item.otelContext) {
				otelContextMap.set(item.item.id, item.otelContext);
				if (item.action === "create") operations.push({
					operation: "post",
					id: item.item.id,
					trace_id: item.item.trace_id ?? item.item.id,
					run: item.item
				});
				else operations.push({
					operation: "patch",
					id: item.item.id,
					trace_id: item.item.trace_id ?? item.item.id,
					run: item.item
				});
			}
			this.langSmithToOTELTranslator.exportBatch(operations, otelContextMap);
		}
	}
	async processRunOperation(item) {
		clearTimeout(this.autoBatchTimeout);
		this.autoBatchTimeout = void 0;
		item.item = mergeRuntimeEnvIntoRun(item.item, this.cachedLSEnvVarsForMetadata, this.omitTracedRuntimeInfo);
		const itemPromise = this.autoBatchQueue.push(item);
		if (this.manualFlushMode) return itemPromise;
		const sizeLimitBytes = await this._getBatchSizeLimitBytes();
		const sizeLimit = await this._getBatchSizeLimit();
		if (this.autoBatchQueue.sizeBytes > sizeLimitBytes || this.autoBatchQueue.items.length > sizeLimit) this._trackDrain(this.drainAutoBatchQueue({
			batchSizeLimitBytes: sizeLimitBytes,
			batchSizeLimit: sizeLimit
		}));
		if (this.autoBatchQueue.items.length > 0) this.autoBatchTimeout = setTimeout(() => {
			this.autoBatchTimeout = void 0;
			this._trackDrain(this.drainAutoBatchQueue({
				batchSizeLimitBytes: sizeLimitBytes,
				batchSizeLimit: sizeLimit
			}));
		}, this.autoBatchAggregationDelayMs);
		return itemPromise;
	}
	async _getServerInfo() {
		const json = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/info`, {
				method: "GET",
				headers: {
					...this._mergedHeaders,
					Accept: "application/json"
				},
				signal: AbortSignal.timeout(SERVER_INFO_REQUEST_TIMEOUT_MS),
				...this.fetchOptions
			});
			await raiseForStatus(res, "get server info");
			return res;
		})).json();
		if (this.debug) console.log("\n=== LangSmith Server Configuration ===\n" + JSON.stringify(json, null, 2) + "\n");
		return json;
	}
	async _ensureServerInfo() {
		if (this._getServerInfoPromise === void 0) this._getServerInfoPromise = (async () => {
			if (this._serverInfo === void 0) try {
				this._serverInfo = await this._getServerInfo();
			} catch (e) {
				console.warn(`[LANGSMITH]: Failed to fetch info on supported operations. Falling back to batch operations and default limits. Info: ${e.status ?? "Unspecified status code"} ${e.message}`);
			}
			return this._serverInfo ?? {};
		})();
		return this._getServerInfoPromise.then((serverInfo) => {
			if (this._serverInfo === void 0) this._getServerInfoPromise = void 0;
			return serverInfo;
		});
	}
	async _getSettings() {
		if (!this.settings) this.settings = this._get("/settings");
		return await this.settings;
	}
	/**
	* Flushes current queued traces.
	*/
	async flush() {
		const sizeLimitBytes = await this._getBatchSizeLimitBytes();
		const sizeLimit = await this._getBatchSizeLimit();
		await this.drainAutoBatchQueue({
			batchSizeLimitBytes: sizeLimitBytes,
			batchSizeLimit: sizeLimit
		});
	}
	_cloneCurrentOTELContext() {
		const otel_trace = getOTELTrace();
		const otel_context = getOTELContext();
		if (this.langSmithToOTELTranslator !== void 0) {
			const currentSpan = otel_trace.getActiveSpan();
			if (currentSpan) return otel_trace.setSpan(otel_context.active(), currentSpan);
		}
	}
	async createRun(run, options) {
		if (!this._filterForSampling([run]).length) return;
		const headers = {
			...this._mergedHeaders,
			"Content-Type": "application/json"
		};
		const session_name = run.project_name;
		delete run.project_name;
		const runCreate = await this.prepareRunCreateOrUpdateInputs({
			session_name,
			...run,
			start_time: run.start_time ?? Date.now()
		});
		if (this.autoBatchTracing && runCreate.trace_id !== void 0 && runCreate.dotted_order !== void 0) {
			const otelContext = this._cloneCurrentOTELContext();
			this.processRunOperation({
				action: "create",
				item: runCreate,
				otelContext,
				apiKey: options?.apiKey,
				apiUrl: options?.apiUrl
			}).catch(console.error);
			return;
		}
		const mergedRunCreateParam = mergeRuntimeEnvIntoRun(runCreate, this.cachedLSEnvVarsForMetadata, this.omitTracedRuntimeInfo);
		if (options?.apiKey !== void 0) headers["x-api-key"] = options.apiKey;
		if (options?.workspaceId !== void 0) headers["x-tenant-id"] = options.workspaceId;
		const body = serialize(mergedRunCreateParam, `Creating run with id: ${mergedRunCreateParam.id}`);
		await this.caller.call(async () => {
			const res = await this._fetch(`${options?.apiUrl ?? this.apiUrl}/runs`, {
				method: "POST",
				headers,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "create run", true);
			return res;
		});
	}
	/**
	* Batch ingest/upsert multiple runs in the Langsmith system.
	* @param runs
	*/
	async batchIngestRuns({ runCreates, runUpdates }, options) {
		if (runCreates === void 0 && runUpdates === void 0) return;
		let preparedCreateParams = await Promise.all(runCreates?.map((create) => this.prepareRunCreateOrUpdateInputs(create)) ?? []);
		let preparedUpdateParams = await Promise.all(runUpdates?.map((update) => this.prepareRunCreateOrUpdateInputs(update)) ?? []);
		if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
			const createById = preparedCreateParams.reduce((params, run) => {
				if (!run.id) return params;
				params[run.id] = run;
				return params;
			}, {});
			const standaloneUpdates = [];
			for (const updateParam of preparedUpdateParams) if (updateParam.id !== void 0 && createById[updateParam.id]) createById[updateParam.id] = {
				...createById[updateParam.id],
				...updateParam
			};
			else standaloneUpdates.push(updateParam);
			preparedCreateParams = Object.values(createById);
			preparedUpdateParams = standaloneUpdates;
		}
		const rawBatch = {
			post: preparedCreateParams,
			patch: preparedUpdateParams
		};
		if (!rawBatch.post.length && !rawBatch.patch.length) return;
		const batchChunks = {
			post: [],
			patch: []
		};
		for (const k of ["post", "patch"]) {
			const key = k;
			const batchItems = rawBatch[key].reverse();
			let batchItem = batchItems.pop();
			while (batchItem !== void 0) {
				batchChunks[key].push(batchItem);
				batchItem = batchItems.pop();
			}
		}
		if (batchChunks.post.length > 0 || batchChunks.patch.length > 0) {
			const runIds = batchChunks.post.map((item) => item.id).concat(batchChunks.patch.map((item) => item.id)).join(",");
			await this._postBatchIngestRuns(await this._serializeBody(batchChunks, `Ingesting runs with ids: ${runIds}`), options);
		}
	}
	async _postBatchIngestRuns(body, options) {
		const headers = {
			...this._mergedHeaders,
			"Content-Type": "application/json",
			Accept: "application/json"
		};
		if (options?.apiKey !== void 0) headers["x-api-key"] = options.apiKey;
		await this.batchIngestCaller.callWithOptions({ sizeBytes: options?.sizeBytes }, async () => {
			const res = await this._fetch(`${options?.apiUrl ?? this.apiUrl}/runs/batch`, {
				method: "POST",
				headers,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "batch create run", true);
			return res;
		});
	}
	/**
	* Batch ingest/upsert multiple runs in the Langsmith system.
	* @param runs
	*/
	async multipartIngestRuns({ runCreates, runUpdates }, options) {
		if (runCreates === void 0 && runUpdates === void 0) return;
		const allAttachments = {};
		let preparedCreateParams = [];
		for (const create of runCreates ?? []) {
			const preparedCreate = await this.prepareRunCreateOrUpdateInputs(create);
			if (preparedCreate.id !== void 0 && preparedCreate.attachments !== void 0) allAttachments[preparedCreate.id] = preparedCreate.attachments;
			delete preparedCreate.attachments;
			preparedCreateParams.push(preparedCreate);
		}
		let preparedUpdateParams = [];
		for (const update of runUpdates ?? []) preparedUpdateParams.push(await this.prepareRunCreateOrUpdateInputs(update));
		if (preparedCreateParams.find((runCreate) => {
			return runCreate.trace_id === void 0 || runCreate.dotted_order === void 0;
		}) !== void 0) throw new Error(`Multipart ingest requires "trace_id" and "dotted_order" to be set when creating a run`);
		if (preparedUpdateParams.find((runUpdate) => {
			return runUpdate.trace_id === void 0 || runUpdate.dotted_order === void 0;
		}) !== void 0) throw new Error(`Multipart ingest requires "trace_id" and "dotted_order" to be set when updating a run`);
		if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
			const createById = preparedCreateParams.reduce((params, run) => {
				if (!run.id) return params;
				params[run.id] = run;
				return params;
			}, {});
			const standaloneUpdates = [];
			for (const updateParam of preparedUpdateParams) if (updateParam.id !== void 0 && createById[updateParam.id]) createById[updateParam.id] = {
				...createById[updateParam.id],
				...updateParam
			};
			else standaloneUpdates.push(updateParam);
			preparedCreateParams = Object.values(createById);
			preparedUpdateParams = standaloneUpdates;
		}
		if (preparedCreateParams.length === 0 && preparedUpdateParams.length === 0) return;
		const accumulatedContext = [];
		const accumulatedParts = [];
		for (const [method, payloads] of [["post", preparedCreateParams], ["patch", preparedUpdateParams]]) for (const originalPayload of payloads) {
			const { inputs, outputs, events, extra, error, serialized, attachments, ...payload } = originalPayload;
			const fields = {
				inputs,
				outputs,
				events,
				extra,
				error,
				serialized
			};
			const stringifiedPayload = await this._serializeBody(payload, `Serializing for multipart ingestion of run with id: ${payload.id}`);
			accumulatedParts.push({
				name: `${method}.${payload.id}`,
				payload: new Blob([stringifiedPayload], { type: `application/json; length=${stringifiedPayload.length}` })
			});
			for (const [key, value] of Object.entries(fields)) {
				if (value === void 0) continue;
				const stringifiedValue = await this._serializeBody(value, `Serializing ${key} for multipart ingestion of run with id: ${payload.id}`);
				accumulatedParts.push({
					name: `${method}.${payload.id}.${key}`,
					payload: new Blob([stringifiedValue], { type: `application/json; length=${stringifiedValue.length}` })
				});
			}
			if (payload.id !== void 0) {
				const attachments = allAttachments[payload.id];
				if (attachments) {
					delete allAttachments[payload.id];
					for (const [name, attachment] of Object.entries(attachments)) {
						let contentType;
						let content;
						if (Array.isArray(attachment)) [contentType, content] = attachment;
						else {
							contentType = attachment.mimeType;
							content = attachment.data;
						}
						if (name.includes(".")) {
							console.warn(`Skipping attachment '${name}' for run ${payload.id}: Invalid attachment name. Attachment names must not contain periods ('.'). Please rename the attachment and try again.`);
							continue;
						}
						accumulatedParts.push({
							name: `attachment.${payload.id}.${name}`,
							payload: new Blob([content], { type: `${contentType}; length=${content.byteLength}` })
						});
					}
				}
			}
			accumulatedContext.push(`trace=${payload.trace_id},id=${payload.id}`);
		}
		await this._sendMultipartRequest(accumulatedParts, accumulatedContext.join("; "), options);
	}
	async _createNodeFetchBody(parts, boundary) {
		const chunks = [];
		for (const part of parts) {
			chunks.push(new Blob([`--${boundary}\r\n`]));
			chunks.push(new Blob([`Content-Disposition: form-data; name="${part.name}"\r\n`, `Content-Type: ${part.payload.type}\r\n\r\n`]));
			chunks.push(part.payload);
			chunks.push(new Blob(["\r\n"]));
		}
		chunks.push(new Blob([`--${boundary}--\r\n`]));
		return await new Blob(chunks).arrayBuffer();
	}
	async _createMultipartStream(parts, boundary) {
		const encoder = new TextEncoder();
		return new ReadableStream({ async start(controller) {
			const writeChunk = async (chunk) => {
				if (typeof chunk === "string") controller.enqueue(encoder.encode(chunk));
				else controller.enqueue(chunk);
			};
			for (const part of parts) {
				await writeChunk(`--${boundary}\r\n`);
				await writeChunk(`Content-Disposition: form-data; name="${part.name}"\r\n`);
				await writeChunk(`Content-Type: ${part.payload.type}\r\n\r\n`);
				const reader = part.payload.stream().getReader();
				try {
					let result;
					while (!(result = await reader.read()).done) controller.enqueue(result.value);
				} finally {
					reader.releaseLock();
				}
				await writeChunk("\r\n");
			}
			await writeChunk(`--${boundary}--\r\n`);
			controller.close();
		} });
	}
	async _sendMultipartRequest(parts, context, options) {
		const boundary = "----LangSmithFormBoundary" + Math.random().toString(36).slice(2);
		const buildBuffered = () => this._createNodeFetchBody(parts, boundary);
		const buildStream = () => this._createMultipartStream(parts, boundary);
		const sendWithRetry = async (bodyFactory) => {
			return this.batchIngestCaller.callWithOptions({ sizeBytes: options?.sizeBytes }, async () => {
				const body = await bodyFactory();
				const headers = {
					...this._mergedHeaders,
					"Content-Type": `multipart/form-data; boundary=${boundary}`
				};
				if (options?.apiKey !== void 0) headers["x-api-key"] = options.apiKey;
				let transformedBody = body;
				if (options?.useGzip && typeof body === "object" && "pipeThrough" in body) {
					transformedBody = body.pipeThrough(new CompressionStream("gzip"));
					headers["Content-Encoding"] = "gzip";
				}
				const response = await this._fetch(`${options?.apiUrl ?? this.apiUrl}/runs/multipart`, {
					method: "POST",
					headers,
					body: transformedBody,
					duplex: "half",
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions
				});
				await raiseForStatus(response, `Failed to send multipart request`, true);
				return response;
			});
		};
		try {
			let res;
			let streamedAttempt = false;
			if (_shouldStreamForGlobalFetchImplementation() && !this.multipartStreamingDisabled && getEnv() !== "bun") {
				streamedAttempt = true;
				res = await sendWithRetry(buildStream);
			} else res = await sendWithRetry(buildBuffered);
			if ((!this.multipartStreamingDisabled || streamedAttempt) && res.status === 422 && (options?.apiUrl ?? this.apiUrl) !== DEFAULT_API_URL) {
				console.warn(`Streaming multipart upload to ${options?.apiUrl ?? this.apiUrl}/runs/multipart failed. This usually means the host does not support chunked uploads. Retrying with a buffered upload for operation "${context}".`);
				this.multipartStreamingDisabled = true;
				res = await sendWithRetry(buildBuffered);
			}
		} catch (e) {
			if (isLangSmithNotFoundError(e)) throw e;
			console.warn(`${e.message.trim()}\n\nContext: ${context}`);
			if (this.failedTracesDir) {
				const bodyBuffer = await this._createNodeFetchBody(parts, boundary).catch(() => null);
				if (bodyBuffer) await Client._writeTraceToFallbackDir(this.failedTracesDir, bodyBuffer, { "Content-Type": `multipart/form-data; boundary=${boundary}` }, "runs/multipart", this.failedTracesMaxBytes);
			}
		}
	}
	async updateRun(runId, run, options) {
		assertUuid(runId);
		if (run.inputs) run.inputs = await this.processInputs(run.inputs);
		if (run.outputs) run.outputs = await this.processOutputs(run.outputs);
		if (run.extra != null && "metadata" in run.extra) run.extra = {
			...run.extra,
			metadata: await this.processMetadata(run.extra.metadata)
		};
		if (run.events) run.events = this._filterNewTokenEvents(run.events);
		const data = {
			...run,
			id: runId
		};
		if (!this._filterForSampling([data], true).length) return;
		if (this.autoBatchTracing && data.trace_id !== void 0 && data.dotted_order !== void 0) {
			const otelContext = this._cloneCurrentOTELContext();
			if (run.end_time !== void 0 && data.parent_run_id === void 0 && this.blockOnRootRunFinalization && !this.manualFlushMode) {
				await this.processRunOperation({
					action: "update",
					item: data,
					otelContext,
					apiKey: options?.apiKey,
					apiUrl: options?.apiUrl
				}).catch(console.error);
				return;
			} else this.processRunOperation({
				action: "update",
				item: data,
				otelContext,
				apiKey: options?.apiKey,
				apiUrl: options?.apiUrl
			}).catch(console.error);
			return;
		}
		const headers = {
			...this._mergedHeaders,
			"Content-Type": "application/json"
		};
		if (options?.apiKey !== void 0) headers["x-api-key"] = options.apiKey;
		if (options?.workspaceId !== void 0) headers["x-tenant-id"] = options.workspaceId;
		const body = serialize(run, `Serializing payload to update run with id: ${runId}`);
		await this.caller.call(async () => {
			const res = await this._fetch(`${options?.apiUrl ?? this.apiUrl}/runs/${runId}`, {
				method: "PATCH",
				headers,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update run", true);
			return res;
		});
	}
	async readRun(runId, { loadChildRuns } = { loadChildRuns: false }) {
		assertUuid(runId);
		let run = _normalizeRunTimestamps(await this._get(`/runs/${runId}`));
		if (loadChildRuns) run = await this._loadChildRuns(run);
		return run;
	}
	async getRunUrl({ runId, run, projectOpts }) {
		if (run !== void 0) {
			let sessionId;
			if (run.session_id) sessionId = run.session_id;
			else if (projectOpts?.projectName) sessionId = (await this.readProject({ projectName: projectOpts?.projectName })).id;
			else if (projectOpts?.projectId) sessionId = projectOpts?.projectId;
			else sessionId = (await this.readProject({ projectName: getLangSmithEnvironmentVariable("PROJECT") || "default" })).id;
			const tenantId = await this._getTenantId();
			return `${this.getHostUrl()}/o/${tenantId}/projects/p/${sessionId}/r/${run.id}?poll=true`;
		} else if (runId !== void 0) {
			const run_ = await this.readRun(runId);
			if (!run_.app_path) throw new Error(`Run ${runId} has no app_path`);
			return `${this.getHostUrl()}${run_.app_path}`;
		} else throw new Error("Must provide either runId or run");
	}
	async _loadChildRuns(run) {
		const childRuns = await toArray(this.listRuns({
			isRoot: false,
			projectId: run.session_id,
			traceId: run.trace_id
		}));
		const treemap = {};
		const runs = {};
		childRuns.sort((a, b) => (a?.dotted_order ?? "").localeCompare(b?.dotted_order ?? ""));
		for (const childRun of childRuns) {
			if (childRun.parent_run_id === null || childRun.parent_run_id === void 0) throw new Error(`Child run ${childRun.id} has no parent`);
			if (childRun.dotted_order?.startsWith(run.dotted_order ?? "") && childRun.id !== run.id) {
				if (!(childRun.parent_run_id in treemap)) treemap[childRun.parent_run_id] = [];
				treemap[childRun.parent_run_id].push(childRun);
				runs[childRun.id] = childRun;
			}
		}
		run.child_runs = treemap[run.id] || [];
		for (const runId in treemap) if (runId !== run.id) runs[runId].child_runs = treemap[runId];
		return run;
	}
	/**
	* List runs from the LangSmith server.
	* @param projectId - The ID of the project to filter by.
	* @param projectName - The name of the project to filter by.
	* @param parentRunId - The ID of the parent run to filter by.
	* @param traceId - The ID of the trace to filter by.
	* @param referenceExampleId - The ID of the reference example to filter by.
	* @param startTime - The start time to filter by.
	* @param isRoot - Indicates whether to only return root runs.
	* @param runType - The run type to filter by.
	* @param error - Indicates whether to filter by error runs.
	* @param id - The ID of the run to filter by.
	* @param query - The query string to filter by.
	* @param filter - The filter string to apply to the run spans.
	* @param traceFilter - The filter string to apply on the root run of the trace.
	* @param treeFilter - The filter string to apply on other runs in the trace.
	* @param limit - The maximum number of runs to retrieve.
	* @returns {AsyncIterable<Run>} - The runs.
	*
	* @example
	* // List all runs in a project
	* const projectRuns = client.listRuns({ projectName: "<your_project>" });
	*
	* @example
	* // List LLM and Chat runs in the last 24 hours
	* const todaysLLMRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   start_time: new Date(Date.now() - 24 * 60 * 60 * 1000),
	*   run_type: "llm",
	* });
	*
	* @example
	* // List traces in a project
	* const rootRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   execution_order: 1,
	* });
	*
	* @example
	* // List runs without errors
	* const correctRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   error: false,
	* });
	*
	* @example
	* // List runs by run ID
	* const runIds = [
	*   "a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
	*   "9398e6be-964f-4aa4-8ae9-ad78cd4b7074",
	* ];
	* const selectedRuns = client.listRuns({ run_ids: runIds });
	*
	* @example
	* // List all "chain" type runs that took more than 10 seconds and had `total_tokens` greater than 5000
	* const chainRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   filter: 'and(eq(run_type, "chain"), gt(latency, 10), gt(total_tokens, 5000))',
	* });
	*
	* @example
	* // List all runs called "extractor" whose root of the trace was assigned feedback "user_score" score of 1
	* const goodExtractorRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   filter: 'eq(name, "extractor")',
	*   traceFilter: 'and(eq(feedback_key, "user_score"), eq(feedback_score, 1))',
	* });
	*
	* @example
	* // List all runs that started after a specific timestamp and either have "error" not equal to null or a "Correctness" feedback score equal to 0
	* const complexRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   filter: 'and(gt(start_time, "2023-07-15T12:34:56Z"), or(neq(error, null), and(eq(feedback_key, "Correctness"), eq(feedback_score, 0.0))))',
	* });
	*
	* @example
	* // List all runs where `tags` include "experimental" or "beta" and `latency` is greater than 2 seconds
	* const taggedRuns = client.listRuns({
	*   projectName: "<your_project>",
	*   filter: 'and(or(has(tags, "experimental"), has(tags, "beta")), gt(latency, 2))',
	* });
	*/
	async *listRuns(props) {
		const { projectId, projectName, parentRunId, traceId, referenceExampleId, startTime, executionOrder, isRoot, runType, error, id, query, filter, traceFilter, treeFilter, limit, select, order } = props;
		let projectIds = [];
		if (projectId) projectIds = Array.isArray(projectId) ? projectId : [projectId];
		if (projectName) {
			const projectNames = Array.isArray(projectName) ? projectName : [projectName];
			const projectIds_ = await Promise.all(projectNames.map((name) => this.readProject({ projectName: name }).then((project) => project.id)));
			projectIds.push(...projectIds_);
		}
		const body = {
			session: projectIds.length ? projectIds : null,
			run_type: runType,
			reference_example: referenceExampleId,
			query,
			filter,
			trace_filter: traceFilter,
			tree_filter: treeFilter,
			execution_order: executionOrder,
			parent_run: parentRunId,
			start_time: startTime ? startTime.toISOString() : null,
			error,
			id,
			limit,
			trace: traceId,
			select: select ? select : [
				"app_path",
				"completion_cost",
				"completion_tokens",
				"dotted_order",
				"end_time",
				"error",
				"events",
				"extra",
				"feedback_stats",
				"first_token_time",
				"id",
				"inputs",
				"name",
				"outputs",
				"parent_run_id",
				"parent_run_ids",
				"prompt_cost",
				"prompt_tokens",
				"reference_example_id",
				"run_type",
				"session_id",
				"start_time",
				"status",
				"tags",
				"total_cost",
				"total_tokens",
				"trace_id"
			],
			is_root: isRoot,
			order
		};
		if (body.select.includes("child_run_ids")) warnOnce("Deprecated: 'child_run_ids' in the listRuns select parameter is deprecated and will be removed in a future version.");
		let runsYielded = 0;
		for await (const runs of this._getCursorPaginatedList("/runs/query", body)) {
			const normalized = runs.map(_normalizeRunTimestamps);
			if (limit) {
				if (runsYielded >= limit) break;
				if (normalized.length + runsYielded > limit) {
					yield* normalized.slice(0, limit - runsYielded);
					break;
				}
				runsYielded += normalized.length;
				yield* normalized;
			} else yield* normalized;
		}
	}
	async *listGroupRuns(props) {
		const { projectId, projectName, groupBy, filter, startTime, endTime, limit, offset } = props;
		const baseBody = {
			session_id: projectId || (await this.readProject({ projectName })).id,
			group_by: groupBy,
			filter,
			start_time: startTime ? startTime.toISOString() : null,
			end_time: endTime ? endTime.toISOString() : null,
			limit: Number(limit) || 100
		};
		let currentOffset = Number(offset) || 0;
		const path = "/runs/group";
		const url = `${this.apiUrl}${path}`;
		while (true) {
			const currentBody = {
				...baseBody,
				offset: currentOffset
			};
			const filteredPayload = Object.fromEntries(Object.entries(currentBody).filter(([_, value]) => value !== void 0));
			const body = JSON.stringify(filteredPayload);
			const { groups, total } = await (await this.caller.call(async () => {
				const res = await this._fetch(url, {
					method: "POST",
					headers: {
						...this._mergedHeaders,
						"Content-Type": "application/json"
					},
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions,
					body
				});
				await raiseForStatus(res, `Failed to fetch ${path}`);
				return res;
			})).json();
			if (groups.length === 0) break;
			for (const thread of groups) yield thread;
			currentOffset += groups.length;
			if (currentOffset >= total) break;
		}
	}
	async *readThread(props) {
		const { threadId, projectId, projectName, isRoot = true, limit, filter: userFilter, order = "asc" } = props;
		if (!projectId && !projectName) throw new Error("threadId requires projectId or projectName");
		const threadFilter = `eq(thread_id, ${JSON.stringify(threadId)})`;
		const combinedFilter = userFilter ? `and(${threadFilter}, ${userFilter})` : threadFilter;
		yield* this.listRuns({
			projectId: projectId ?? void 0,
			projectName: projectName ?? void 0,
			isRoot,
			limit,
			filter: combinedFilter,
			order
		});
	}
	async listThreads(props) {
		const { projectId, projectName, limit, offset = 0, filter, startTime, isRoot = true } = props;
		if (!projectId && !projectName) throw new Error("Either projectId or projectName must be provided");
		if (projectId && projectName) throw new Error("Provide exactly one of projectId or projectName");
		const sessionId = projectId ?? (await this.readProject({ projectName })).id;
		const startTimeResolved = startTime ?? /* @__PURE__ */ new Date(Date.now() - 1440 * 60 * 1e3);
		const bodyQuery = {
			session: [sessionId],
			is_root: isRoot,
			limit: 100,
			order: "desc",
			select: [
				"id",
				"name",
				"status",
				"start_time",
				"end_time",
				"thread_id",
				"trace_id",
				"run_type",
				"error",
				"tags",
				"session_id",
				"parent_run_id",
				"total_tokens",
				"total_cost",
				"dotted_order",
				"reference_example_id",
				"feedback_stats",
				"app_path",
				"completion_cost",
				"completion_tokens",
				"prompt_cost",
				"prompt_tokens",
				"first_token_time"
			],
			start_time: startTimeResolved.toISOString()
		};
		if (filter != null) bodyQuery.filter = filter;
		const threadsMap = /* @__PURE__ */ new Map();
		for await (const runs of this._getCursorPaginatedList("/runs/query", bodyQuery)) for (const raw of runs) {
			const run = _normalizeRunTimestamps(raw);
			const tid = run.thread_id;
			if (tid) {
				const list = threadsMap.get(tid) ?? [];
				list.push(run);
				threadsMap.set(tid, list);
			}
		}
		const result = [];
		for (const [threadId, runs] of threadsMap.entries()) {
			runs.sort((a, b) => {
				const aRun = a;
				const bRun = b;
				const aStart = aRun.start_time ?? "";
				const bStart = bRun.start_time ?? "";
				if (aStart !== bStart) return aStart.localeCompare(bStart);
				const aOrder = aRun.dotted_order ?? "";
				const bOrder = bRun.dotted_order ?? "";
				return aOrder.localeCompare(bOrder);
			});
			const sortedTimes = [...runs.map((r) => r.start_time).filter(Boolean)].sort();
			const minStart = sortedTimes.length ? sortedTimes[0] : "";
			const maxStart = sortedTimes.length ? sortedTimes[sortedTimes.length - 1] : "";
			result.push({
				thread_id: threadId,
				runs,
				count: runs.length,
				filter: "",
				total_tokens: 0,
				total_cost: null,
				min_start_time: minStart,
				max_start_time: maxStart,
				latency_p50: 0,
				latency_p99: 0,
				feedback_stats: null,
				first_inputs: "",
				last_outputs: "",
				last_error: null
			});
		}
		result.sort((a, b) => {
			const aMax = a.max_start_time ?? "";
			return (b.max_start_time ?? "").localeCompare(aMax);
		});
		const withOffset = offset > 0 ? result.slice(offset) : result;
		return limit !== void 0 ? withOffset.slice(0, limit) : withOffset;
	}
	async getRunStats({ id, trace, parentRun, runType, projectNames, projectIds, referenceExampleIds, startTime, endTime, error, query, filter, traceFilter, treeFilter, isRoot, dataSourceType }) {
		let projectIds_ = projectIds || [];
		if (projectNames) projectIds_ = [...projectIds || [], ...await Promise.all(projectNames.map((name) => this.readProject({ projectName: name }).then((project) => project.id)))];
		const filteredPayload = Object.fromEntries(Object.entries({
			id,
			trace,
			parent_run: parentRun,
			run_type: runType,
			session: projectIds_,
			reference_example: referenceExampleIds,
			start_time: startTime,
			end_time: endTime,
			error,
			query,
			filter,
			trace_filter: traceFilter,
			tree_filter: treeFilter,
			is_root: isRoot,
			data_source_type: dataSourceType
		}).filter(([_, value]) => value !== void 0));
		const body = JSON.stringify(filteredPayload);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/runs/stats`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "get run stats");
			return res;
		})).json();
	}
	async shareRun(runId, { shareId } = {}) {
		const data = {
			run_id: runId,
			share_token: shareId || v4()
		};
		assertUuid(runId);
		const body = JSON.stringify(data);
		const result = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/runs/${runId}/share`, {
				method: "PUT",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "share run");
			return res;
		})).json();
		if (result === null || !("share_token" in result)) throw new Error("Invalid response from server");
		return `${this.getHostUrl()}/public/${result["share_token"]}/r`;
	}
	async unshareRun(runId) {
		assertUuid(runId);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/runs/${runId}/share`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "unshare run", true);
			return res;
		});
	}
	async readRunSharedLink(runId) {
		assertUuid(runId);
		const result = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/runs/${runId}/share`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "read run shared link");
			return res;
		})).json();
		if (result === null || !("share_token" in result)) return;
		return `${this.getHostUrl()}/public/${result["share_token"]}/r`;
	}
	async listSharedRuns(shareToken, { runIds } = {}) {
		const queryParams = new URLSearchParams({ share_token: shareToken });
		if (runIds !== void 0) for (const runId of runIds) queryParams.append("id", runId);
		assertUuid(shareToken);
		return (await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/public/${shareToken}/runs${queryParams}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "list shared runs");
			return res;
		})).json()).map(_normalizeRunTimestamps);
	}
	async readDatasetSharedSchema(datasetId, datasetName) {
		if (!datasetId && !datasetName) throw new Error("Either datasetId or datasetName must be given");
		if (!datasetId) datasetId = (await this.readDataset({ datasetName })).id;
		assertUuid(datasetId);
		const shareSchema = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${datasetId}/share`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "read dataset shared schema");
			return res;
		})).json();
		shareSchema.url = `${this.getHostUrl()}/public/${shareSchema.share_token}/d`;
		return shareSchema;
	}
	async shareDataset(datasetId, datasetName) {
		if (!datasetId && !datasetName) throw new Error("Either datasetId or datasetName must be given");
		if (!datasetId) datasetId = (await this.readDataset({ datasetName })).id;
		const data = { dataset_id: datasetId };
		assertUuid(datasetId);
		const body = JSON.stringify(data);
		const shareSchema = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${datasetId}/share`, {
				method: "PUT",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "share dataset");
			return res;
		})).json();
		shareSchema.url = `${this.getHostUrl()}/public/${shareSchema.share_token}/d`;
		return shareSchema;
	}
	async unshareDataset(datasetId) {
		assertUuid(datasetId);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${datasetId}/share`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "unshare dataset", true);
			return res;
		});
	}
	async readSharedDataset(shareToken) {
		assertUuid(shareToken);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/public/${shareToken}/datasets`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "read shared dataset");
			return res;
		})).json();
	}
	/**
	* Get shared examples.
	*
	* @param {string} shareToken The share token to get examples for. A share token is the UUID (or LangSmith URL, including UUID) generated when explicitly marking an example as public.
	* @param {Object} [options] Additional options for listing the examples.
	* @param {string[] | undefined} [options.exampleIds] A list of example IDs to filter by.
	* @returns {Promise<Example[]>} The shared examples.
	*/
	async listSharedExamples(shareToken, options) {
		const params = {};
		if (options?.exampleIds) params.id = options.exampleIds;
		const urlParams = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (Array.isArray(value)) value.forEach((v) => urlParams.append(key, v));
			else urlParams.append(key, value);
		});
		const response = await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/public/${shareToken}/examples?${urlParams.toString()}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "list shared examples");
			return res;
		});
		const result = await response.json();
		if (!response.ok) {
			if ("detail" in result) throw new Error(`Failed to list shared examples.\nStatus: ${response.status}\nMessage: ${Array.isArray(result.detail) ? result.detail.join("\n") : "Unspecified error"}`);
			throw new Error(`Failed to list shared examples: ${response.status} ${response.statusText}`);
		}
		return result.map((example) => ({
			...example,
			_hostUrl: this.getHostUrl()
		}));
	}
	async createProject({ projectName, description = null, metadata = null, upsert = false, projectExtra = null, referenceDatasetId = null }) {
		const upsert_ = upsert ? `?upsert=true` : "";
		const endpoint = `${this.apiUrl}/sessions${upsert_}`;
		const extra = projectExtra || {};
		if (metadata) extra["metadata"] = metadata;
		const body = {
			name: projectName,
			extra,
			description
		};
		if (referenceDatasetId !== null) body["reference_dataset_id"] = referenceDatasetId;
		const serializedBody = JSON.stringify(body);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(endpoint, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: serializedBody
			});
			await raiseForStatus(res, "create project");
			return res;
		})).json();
	}
	async updateProject(projectId, { name = null, description = null, metadata = null, projectExtra = null, endTime = null }) {
		const endpoint = `${this.apiUrl}/sessions/${projectId}`;
		let extra = projectExtra;
		if (metadata) extra = {
			...extra || {},
			metadata
		};
		const body = JSON.stringify({
			name,
			extra,
			description,
			end_time: endTime ? new Date(endTime).toISOString() : null
		});
		return await (await this.caller.call(async () => {
			const res = await this._fetch(endpoint, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update project");
			return res;
		})).json();
	}
	async hasProject({ projectId, projectName }) {
		let path = "/sessions";
		const params = new URLSearchParams();
		if (projectId !== void 0 && projectName !== void 0) throw new Error("Must provide either projectName or projectId, not both");
		else if (projectId !== void 0) {
			assertUuid(projectId);
			path += `/${projectId}`;
		} else if (projectName !== void 0) params.append("name", projectName);
		else throw new Error("Must provide projectName or projectId");
		const response = await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}${path}?${params}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "has project");
			return res;
		});
		try {
			const result = await response.json();
			if (!response.ok) return false;
			if (Array.isArray(result)) return result.length > 0;
			return true;
		} catch (_e) {
			return false;
		}
	}
	async readProject({ projectId, projectName, includeStats }) {
		let path = "/sessions";
		const params = new URLSearchParams();
		if (projectId !== void 0 && projectName !== void 0) throw new Error("Must provide either projectName or projectId, not both");
		else if (projectId !== void 0) {
			assertUuid(projectId);
			path += `/${projectId}`;
		} else if (projectName !== void 0) params.append("name", projectName);
		else throw new Error("Must provide projectName or projectId");
		if (includeStats !== void 0) params.append("include_stats", includeStats.toString());
		const response = await this._get(path, params);
		let result;
		if (Array.isArray(response)) {
			if (response.length === 0) throw new Error(`Project[id=${projectId}, name=${projectName}] not found`);
			result = response[0];
		} else result = response;
		return result;
	}
	async getProjectUrl({ projectId, projectName }) {
		if (projectId === void 0 && projectName === void 0) throw new Error("Must provide either projectName or projectId");
		const project = await this.readProject({
			projectId,
			projectName
		});
		const tenantId = await this._getTenantId();
		return `${this.getHostUrl()}/o/${tenantId}/projects/p/${project.id}`;
	}
	async getDatasetUrl({ datasetId, datasetName }) {
		if (datasetId === void 0 && datasetName === void 0) throw new Error("Must provide either datasetName or datasetId");
		const dataset = await this.readDataset({
			datasetId,
			datasetName
		});
		const tenantId = await this._getTenantId();
		return `${this.getHostUrl()}/o/${tenantId}/datasets/${dataset.id}`;
	}
	async _getTenantId() {
		if (this._tenantId !== null) return this._tenantId;
		const queryParams = new URLSearchParams({ limit: "1" });
		for await (const projects of this._getPaginated("/sessions", queryParams)) {
			this._tenantId = projects[0].tenant_id;
			return projects[0].tenant_id;
		}
		throw new Error("No projects found to resolve tenant.");
	}
	async *listProjects({ projectIds, name, nameContains, referenceDatasetId, referenceDatasetName, includeStats, datasetVersion, referenceFree, metadata } = {}) {
		const params = new URLSearchParams();
		if (projectIds !== void 0) for (const projectId of projectIds) params.append("id", projectId);
		if (name !== void 0) params.append("name", name);
		if (nameContains !== void 0) params.append("name_contains", nameContains);
		if (referenceDatasetId !== void 0) params.append("reference_dataset", referenceDatasetId);
		else if (referenceDatasetName !== void 0) {
			const dataset = await this.readDataset({ datasetName: referenceDatasetName });
			params.append("reference_dataset", dataset.id);
		}
		if (includeStats !== void 0) params.append("include_stats", includeStats.toString());
		if (datasetVersion !== void 0) params.append("dataset_version", datasetVersion);
		if (referenceFree !== void 0) params.append("reference_free", referenceFree.toString());
		if (metadata !== void 0) params.append("metadata", JSON.stringify(metadata));
		for await (const projects of this._getPaginated("/sessions", params)) yield* projects;
	}
	async deleteProject({ projectId, projectName }) {
		let projectId_;
		if (projectId === void 0 && projectName === void 0) throw new Error("Must provide projectName or projectId");
		else if (projectId !== void 0 && projectName !== void 0) throw new Error("Must provide either projectName or projectId, not both");
		else if (projectId === void 0) projectId_ = (await this.readProject({ projectName })).id;
		else projectId_ = projectId;
		assertUuid(projectId_);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/sessions/${projectId_}`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, `delete session ${projectId_} (${projectName})`, true);
			return res;
		});
	}
	async uploadCsv({ csvFile, fileName, inputKeys, outputKeys, description, dataType, name }) {
		const url = `${this.apiUrl}/datasets/upload`;
		const formData = new FormData();
		const csvBlob = new Blob([csvFile], { type: "text/csv" });
		formData.append("file", csvBlob, fileName);
		inputKeys.forEach((key) => {
			formData.append("input_keys", key);
		});
		outputKeys.forEach((key) => {
			formData.append("output_keys", key);
		});
		if (description) formData.append("description", description);
		if (dataType) formData.append("data_type", dataType);
		if (name) formData.append("name", name);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(url, {
				method: "POST",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: formData
			});
			await raiseForStatus(res, "upload CSV");
			return res;
		})).json();
	}
	async createDataset(name, { description, dataType, inputsSchema, outputsSchema, metadata } = {}) {
		const body = {
			name,
			description,
			extra: {
				source: "sdk",
				...metadata ? { metadata } : {}
			}
		};
		if (dataType) body.data_type = dataType;
		if (inputsSchema) body.inputs_schema_definition = inputsSchema;
		if (outputsSchema) body.outputs_schema_definition = outputsSchema;
		const serializedBody = JSON.stringify(body);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: serializedBody
			});
			await raiseForStatus(res, "create dataset");
			return res;
		})).json();
	}
	async readDataset({ datasetId, datasetName }) {
		let path = "/datasets";
		const params = new URLSearchParams({ limit: "1" });
		if (datasetId && datasetName) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId) {
			assertUuid(datasetId);
			path += `/${datasetId}`;
		} else if (datasetName) params.append("name", datasetName);
		else throw new Error("Must provide datasetName or datasetId");
		const response = await this._get(path, params);
		let result;
		if (Array.isArray(response)) {
			if (response.length === 0) throw new Error(`Dataset[id=${datasetId}, name=${datasetName}] not found`);
			result = response[0];
		} else result = response;
		return result;
	}
	async hasDataset({ datasetId, datasetName }) {
		try {
			await this.readDataset({
				datasetId,
				datasetName
			});
			return true;
		} catch (e) {
			if (e instanceof Error && e.message.toLocaleLowerCase().includes("not found")) return false;
			throw e;
		}
	}
	async diffDatasetVersions({ datasetId, datasetName, fromVersion, toVersion }) {
		let datasetId_ = datasetId;
		if (datasetId_ === void 0 && datasetName === void 0) throw new Error("Must provide either datasetName or datasetId");
		else if (datasetId_ !== void 0 && datasetName !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId_ === void 0) datasetId_ = (await this.readDataset({ datasetName })).id;
		const urlParams = new URLSearchParams({
			from_version: typeof fromVersion === "string" ? fromVersion : fromVersion.toISOString(),
			to_version: typeof toVersion === "string" ? toVersion : toVersion.toISOString()
		});
		return await this._get(`/datasets/${datasetId_}/versions/diff`, urlParams);
	}
	async readDatasetOpenaiFinetuning({ datasetId, datasetName }) {
		const path = "/datasets";
		if (datasetId !== void 0) {} else if (datasetName !== void 0) datasetId = (await this.readDataset({ datasetName })).id;
		else throw new Error("Must provide either datasetName or datasetId");
		return (await (await this._getResponse(`${path}/${datasetId}/openai_ft`)).text()).trim().split("\n").map((line) => JSON.parse(line));
	}
	async *listDatasets({ limit = 100, offset = 0, datasetIds, datasetName, datasetNameContains, metadata } = {}) {
		const path = "/datasets";
		const params = new URLSearchParams({
			limit: limit.toString(),
			offset: offset.toString()
		});
		if (datasetIds !== void 0) for (const id_ of datasetIds) params.append("id", id_);
		if (datasetName !== void 0) params.append("name", datasetName);
		if (datasetNameContains !== void 0) params.append("name_contains", datasetNameContains);
		if (metadata !== void 0) params.append("metadata", JSON.stringify(metadata));
		for await (const datasets of this._getPaginated(path, params)) yield* datasets;
	}
	/**
	* Update a dataset
	* @param props The dataset details to update
	* @returns The updated dataset
	*/
	async updateDataset(props) {
		const { datasetId, datasetName, ...update } = props;
		if (!datasetId && !datasetName) throw new Error("Must provide either datasetName or datasetId");
		const _datasetId = datasetId ?? (await this.readDataset({ datasetName })).id;
		assertUuid(_datasetId);
		const body = JSON.stringify(update);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${_datasetId}`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update dataset");
			return res;
		})).json();
	}
	/**
	* Updates a tag on a dataset.
	*
	* If the tag is already assigned to a different version of this dataset,
	* the tag will be moved to the new version. The as_of parameter is used to
	* determine which version of the dataset to apply the new tags to.
	*
	* It must be an exact version of the dataset to succeed. You can
	* use the "readDatasetVersion" method to find the exact version
	* to apply the tags to.
	* @param params.datasetId The ID of the dataset to update. Must be provided if "datasetName" is not provided.
	* @param params.datasetName The name of the dataset to update. Must be provided if "datasetId" is not provided.
	* @param params.asOf The timestamp of the dataset to apply the new tags to.
	* @param params.tag The new tag to apply to the dataset.
	*/
	async updateDatasetTag(props) {
		const { datasetId, datasetName, asOf, tag } = props;
		if (!datasetId && !datasetName) throw new Error("Must provide either datasetName or datasetId");
		const _datasetId = datasetId ?? (await this.readDataset({ datasetName })).id;
		assertUuid(_datasetId);
		const body = JSON.stringify({
			as_of: typeof asOf === "string" ? asOf : asOf.toISOString(),
			tag
		});
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${_datasetId}/tags`, {
				method: "PUT",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update dataset tags", true);
			return res;
		});
	}
	async deleteDataset({ datasetId, datasetName }) {
		let path = "/datasets";
		let datasetId_ = datasetId;
		if (datasetId !== void 0 && datasetName !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetName !== void 0) datasetId_ = (await this.readDataset({ datasetName })).id;
		if (datasetId_ !== void 0) {
			assertUuid(datasetId_);
			path += `/${datasetId_}`;
		} else throw new Error("Must provide datasetName or datasetId");
		await this.caller.call(async () => {
			const res = await this._fetch(this.apiUrl + path, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, `delete ${path}`, true);
			return res;
		});
	}
	async createExample(inputsOrUpdate, outputs, options) {
		if (isExampleCreate(inputsOrUpdate)) {
			if (outputs !== void 0 || options !== void 0) throw new Error("Cannot provide outputs or options when using ExampleCreate object");
		}
		let datasetId_ = outputs ? options?.datasetId : inputsOrUpdate.dataset_id;
		const datasetName_ = outputs ? options?.datasetName : inputsOrUpdate.dataset_name;
		if (datasetId_ === void 0 && datasetName_ === void 0) throw new Error("Must provide either datasetName or datasetId");
		else if (datasetId_ !== void 0 && datasetName_ !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId_ === void 0) datasetId_ = (await this.readDataset({ datasetName: datasetName_ })).id;
		const createdAt_ = (outputs ? options?.createdAt : inputsOrUpdate.created_at) || /* @__PURE__ */ new Date();
		let data;
		if (!isExampleCreate(inputsOrUpdate)) data = {
			inputs: inputsOrUpdate,
			outputs,
			created_at: createdAt_?.toISOString(),
			id: options?.exampleId,
			metadata: options?.metadata,
			split: options?.split,
			source_run_id: options?.sourceRunId,
			use_source_run_io: options?.useSourceRunIO,
			use_source_run_attachments: options?.useSourceRunAttachments,
			attachments: options?.attachments
		};
		else data = inputsOrUpdate;
		const response = await this._uploadExamplesMultipart(datasetId_, [data]);
		return await this.readExample(response.example_ids?.[0] ?? v4());
	}
	async createExamples(propsOrUploads) {
		if (Array.isArray(propsOrUploads)) {
			if (propsOrUploads.length === 0) return [];
			const uploads = propsOrUploads;
			let datasetId_ = uploads[0].dataset_id;
			const datasetName_ = uploads[0].dataset_name;
			if (datasetId_ === void 0 && datasetName_ === void 0) throw new Error("Must provide either datasetName or datasetId");
			else if (datasetId_ !== void 0 && datasetName_ !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
			else if (datasetId_ === void 0) datasetId_ = (await this.readDataset({ datasetName: datasetName_ })).id;
			const response = await this._uploadExamplesMultipart(datasetId_, uploads);
			return await Promise.all(response.example_ids.map((id) => this.readExample(id)));
		}
		const { inputs, outputs, metadata, splits, sourceRunIds, useSourceRunIOs, useSourceRunAttachments, attachments, exampleIds, datasetId, datasetName } = propsOrUploads;
		if (inputs === void 0) throw new Error("Must provide inputs when using legacy parameters");
		let datasetId_ = datasetId;
		const datasetName_ = datasetName;
		if (datasetId_ === void 0 && datasetName_ === void 0) throw new Error("Must provide either datasetName or datasetId");
		else if (datasetId_ !== void 0 && datasetName_ !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId_ === void 0) datasetId_ = (await this.readDataset({ datasetName: datasetName_ })).id;
		const formattedExamples = inputs.map((input, idx) => {
			return {
				dataset_id: datasetId_,
				inputs: input,
				outputs: outputs?.[idx],
				metadata: metadata?.[idx],
				split: splits?.[idx],
				id: exampleIds?.[idx],
				attachments: attachments?.[idx],
				source_run_id: sourceRunIds?.[idx],
				use_source_run_io: useSourceRunIOs?.[idx],
				use_source_run_attachments: useSourceRunAttachments?.[idx]
			};
		});
		const response = await this._uploadExamplesMultipart(datasetId_, formattedExamples);
		return await Promise.all(response.example_ids.map((id) => this.readExample(id)));
	}
	async createLLMExample(input, generation, options) {
		return this.createExample({ input }, { output: generation }, options);
	}
	async createChatExample(input, generations, options) {
		const finalInput = input.map((message) => {
			if (isLangChainMessage(message)) return convertLangChainMessageToExample(message);
			return message;
		});
		const finalOutput = isLangChainMessage(generations) ? convertLangChainMessageToExample(generations) : generations;
		return this.createExample({ input: finalInput }, { output: finalOutput }, options);
	}
	async readExample(exampleId) {
		assertUuid(exampleId);
		const path = `/examples/${exampleId}`;
		const { attachment_urls, ...rest } = await this._get(path);
		const example = rest;
		if (attachment_urls) example.attachments = Object.entries(attachment_urls).reduce((acc, [key, value]) => {
			acc[key.slice(11)] = {
				presigned_url: value.presigned_url,
				mime_type: value.mime_type
			};
			return acc;
		}, {});
		return example;
	}
	async *listExamples({ datasetId, datasetName, exampleIds, asOf, splits, inlineS3Urls, metadata, limit, offset, filter, includeAttachments } = {}) {
		let datasetId_;
		if (datasetId !== void 0 && datasetName !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId !== void 0) datasetId_ = datasetId;
		else if (datasetName !== void 0) datasetId_ = (await this.readDataset({ datasetName })).id;
		else throw new Error("Must provide a datasetName or datasetId");
		const params = new URLSearchParams({ dataset: datasetId_ });
		const dataset_version = asOf ? typeof asOf === "string" ? asOf : asOf?.toISOString() : void 0;
		if (dataset_version) params.append("as_of", dataset_version);
		const inlineS3Urls_ = inlineS3Urls ?? true;
		params.append("inline_s3_urls", inlineS3Urls_.toString());
		if (exampleIds !== void 0) for (const id_ of exampleIds) params.append("id", id_);
		if (splits !== void 0) for (const split of splits) params.append("splits", split);
		if (metadata !== void 0) {
			const serializedMetadata = JSON.stringify(metadata);
			params.append("metadata", serializedMetadata);
		}
		if (limit !== void 0) params.append("limit", limit.toString());
		if (offset !== void 0) params.append("offset", offset.toString());
		if (filter !== void 0) params.append("filter", filter);
		if (includeAttachments === true) [
			"attachment_urls",
			"outputs",
			"metadata"
		].forEach((field) => params.append("select", field));
		let i = 0;
		for await (const rawExamples of this._getPaginated("/examples", params)) {
			for (const rawExample of rawExamples) {
				const { attachment_urls, ...rest } = rawExample;
				const example = rest;
				if (attachment_urls) example.attachments = Object.entries(attachment_urls).reduce((acc, [key, value]) => {
					acc[key.slice(11)] = {
						presigned_url: value.presigned_url,
						mime_type: value.mime_type || void 0
					};
					return acc;
				}, {});
				yield example;
				i++;
			}
			if (limit !== void 0 && i >= limit) break;
		}
	}
	async deleteExample(exampleId) {
		assertUuid(exampleId);
		const path = `/examples/${exampleId}`;
		await this.caller.call(async () => {
			const res = await this._fetch(this.apiUrl + path, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, `delete ${path}`, true);
			return res;
		});
	}
	/**
	* Delete multiple examples by ID.
	* @param exampleIds - The IDs of the examples to delete
	* @param options - Optional settings for deletion
	* @param options.hardDelete - If true, permanently delete examples. If false (default), soft delete them.
	*/
	async deleteExamples(exampleIds, options) {
		exampleIds.forEach((id) => assertUuid(id));
		if (options?.hardDelete) {
			const path = this._getPlatformEndpointPath("datasets/examples/delete");
			await this.caller.call(async () => {
				const res = await this._fetch(`${this.apiUrl}${path}`, {
					method: "POST",
					headers: {
						...this._mergedHeaders,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						example_ids: exampleIds,
						hard_delete: true
					}),
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions
				});
				await raiseForStatus(res, "hard delete examples", true);
				return res;
			});
		} else {
			const params = new URLSearchParams();
			exampleIds.forEach((id) => params.append("example_ids", id));
			await this.caller.call(async () => {
				const res = await this._fetch(`${this.apiUrl}/examples?${params.toString()}`, {
					method: "DELETE",
					headers: this._mergedHeaders,
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions
				});
				await raiseForStatus(res, "delete examples", true);
				return res;
			});
		}
	}
	async updateExample(exampleIdOrUpdate, update) {
		let exampleId;
		if (update) exampleId = exampleIdOrUpdate;
		else exampleId = exampleIdOrUpdate.id;
		assertUuid(exampleId);
		let updateToUse;
		if (update) updateToUse = {
			id: exampleId,
			...update
		};
		else updateToUse = exampleIdOrUpdate;
		let datasetId;
		if (updateToUse.dataset_id !== void 0) datasetId = updateToUse.dataset_id;
		else datasetId = (await this.readExample(exampleId)).dataset_id;
		return this._updateExamplesMultipart(datasetId, [updateToUse]);
	}
	async updateExamples(update) {
		let datasetId;
		if (update[0].dataset_id === void 0) datasetId = (await this.readExample(update[0].id)).dataset_id;
		else datasetId = update[0].dataset_id;
		return this._updateExamplesMultipart(datasetId, update);
	}
	/**
	* Get dataset version by closest date or exact tag.
	*
	* Use this to resolve the nearest version to a given timestamp or for a given tag.
	*
	* @param options The options for getting the dataset version
	* @param options.datasetId The ID of the dataset
	* @param options.datasetName The name of the dataset
	* @param options.asOf The timestamp of the dataset to retrieve
	* @param options.tag The tag of the dataset to retrieve
	* @returns The dataset version
	*/
	async readDatasetVersion({ datasetId, datasetName, asOf, tag }) {
		let resolvedDatasetId;
		if (!datasetId) resolvedDatasetId = (await this.readDataset({ datasetName })).id;
		else resolvedDatasetId = datasetId;
		assertUuid(resolvedDatasetId);
		if (asOf && tag || !asOf && !tag) throw new Error("Exactly one of asOf and tag must be specified.");
		const params = new URLSearchParams();
		if (asOf !== void 0) params.append("as_of", typeof asOf === "string" ? asOf : asOf.toISOString());
		if (tag !== void 0) params.append("tag", tag);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${resolvedDatasetId}/version?${params.toString()}`, {
				method: "GET",
				headers: { ...this._mergedHeaders },
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "read dataset version");
			return res;
		})).json();
	}
	async listDatasetSplits({ datasetId, datasetName, asOf }) {
		let datasetId_;
		if (datasetId === void 0 && datasetName === void 0) throw new Error("Must provide dataset name or ID");
		else if (datasetId !== void 0 && datasetName !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId === void 0) datasetId_ = (await this.readDataset({ datasetName })).id;
		else datasetId_ = datasetId;
		assertUuid(datasetId_);
		const params = new URLSearchParams();
		const dataset_version = asOf ? typeof asOf === "string" ? asOf : asOf?.toISOString() : void 0;
		if (dataset_version) params.append("as_of", dataset_version);
		return await this._get(`/datasets/${datasetId_}/splits`, params);
	}
	async updateDatasetSplits({ datasetId, datasetName, splitName, exampleIds, remove = false }) {
		let datasetId_;
		if (datasetId === void 0 && datasetName === void 0) throw new Error("Must provide dataset name or ID");
		else if (datasetId !== void 0 && datasetName !== void 0) throw new Error("Must provide either datasetName or datasetId, not both");
		else if (datasetId === void 0) datasetId_ = (await this.readDataset({ datasetName })).id;
		else datasetId_ = datasetId;
		assertUuid(datasetId_);
		const data = {
			split_name: splitName,
			examples: exampleIds.map((id) => {
				assertUuid(id);
				return id;
			}),
			remove
		};
		const body = JSON.stringify(data);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/${datasetId_}/splits`, {
				method: "PUT",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update dataset splits", true);
			return res;
		});
	}
	async createFeedback(runId, key, { score, value, correction, comment, sourceInfo, feedbackSourceType = "api", sourceRunId, feedbackId, feedbackConfig, projectId, comparativeExperimentId, sessionId, startTime }) {
		if (!runId && !projectId) throw new Error("One of runId or projectId must be provided");
		if (runId && projectId) throw new Error("Only one of runId or projectId can be provided");
		const feedback_source = {
			type: feedbackSourceType ?? "api",
			metadata: sourceInfo ?? {}
		};
		if (sourceRunId !== void 0 && feedback_source?.metadata !== void 0 && !feedback_source.metadata["__run"]) feedback_source.metadata["__run"] = { run_id: sourceRunId };
		if (feedback_source?.metadata !== void 0 && feedback_source.metadata["__run"]?.run_id !== void 0) assertUuid(feedback_source.metadata["__run"].run_id);
		const feedback = {
			id: feedbackId ?? v7(),
			run_id: runId,
			key,
			score: _formatFeedbackScore(score),
			value,
			correction,
			comment,
			feedback_source,
			comparative_experiment_id: comparativeExperimentId,
			feedbackConfig,
			session_id: sessionId ?? projectId,
			start_time: startTime
		};
		const body = JSON.stringify(feedback);
		const url = `${this.apiUrl}/feedback`;
		await this.caller.call(async () => {
			const res = await this._fetch(url, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "create feedback", true);
			return res;
		});
		return feedback;
	}
	async updateFeedback(feedbackId, { score, value, correction, comment }) {
		const feedbackUpdate = {};
		if (score !== void 0 && score !== null) feedbackUpdate["score"] = _formatFeedbackScore(score);
		if (value !== void 0 && value !== null) feedbackUpdate["value"] = value;
		if (correction !== void 0 && correction !== null) feedbackUpdate["correction"] = correction;
		if (comment !== void 0 && comment !== null) feedbackUpdate["comment"] = comment;
		assertUuid(feedbackId);
		const body = JSON.stringify(feedbackUpdate);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/feedback/${feedbackId}`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update feedback", true);
			return res;
		});
	}
	async readFeedback(feedbackId) {
		assertUuid(feedbackId);
		const path = `/feedback/${feedbackId}`;
		return await this._get(path);
	}
	async deleteFeedback(feedbackId) {
		assertUuid(feedbackId);
		const path = `/feedback/${feedbackId}`;
		await this.caller.call(async () => {
			const res = await this._fetch(this.apiUrl + path, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, `delete ${path}`, true);
			return res;
		});
	}
	async *listFeedback({ runIds, feedbackKeys, feedbackSourceTypes } = {}) {
		const queryParams = new URLSearchParams();
		if (runIds) for (const runId of runIds) {
			assertUuid(runId);
			queryParams.append("run", runId);
		}
		if (feedbackKeys) for (const key of feedbackKeys) queryParams.append("key", key);
		if (feedbackSourceTypes) for (const type of feedbackSourceTypes) queryParams.append("source", type);
		for await (const feedbacks of this._getPaginated("/feedback", queryParams)) yield* feedbacks;
	}
	/**
	* Creates a presigned feedback token and URL.
	*
	* The token can be used to authorize feedback metrics without
	* needing an API key. This is useful for giving browser-based
	* applications the ability to submit feedback without needing
	* to expose an API key.
	*
	* @param runId The ID of the run.
	* @param feedbackKey The feedback key.
	* @param options Additional options for the token.
	* @param options.expiration The expiration time for the token.
	*
	* @returns A promise that resolves to a FeedbackIngestToken.
	*/
	async createPresignedFeedbackToken(runId, feedbackKey, { expiration, feedbackConfig } = {}) {
		const body = {
			run_id: runId,
			feedback_key: feedbackKey,
			feedback_config: feedbackConfig
		};
		if (expiration) {
			if (typeof expiration === "string") body["expires_at"] = expiration;
			else if (expiration?.hours || expiration?.minutes || expiration?.days) body["expires_in"] = expiration;
		} else body["expires_in"] = { hours: 3 };
		const serializedBody = JSON.stringify(body);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/feedback/tokens`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: serializedBody
			});
			await raiseForStatus(res, "create presigned feedback token");
			return res;
		})).json();
	}
	async createComparativeExperiment({ name, experimentIds, referenceDatasetId, createdAt, description, metadata, id }) {
		if (experimentIds.length === 0) throw new Error("At least one experiment is required");
		if (!referenceDatasetId) referenceDatasetId = (await this.readProject({ projectId: experimentIds[0] })).reference_dataset_id;
		if (!referenceDatasetId == null) throw new Error("A reference dataset is required");
		const body = {
			id,
			name,
			experiment_ids: experimentIds,
			reference_dataset_id: referenceDatasetId,
			description,
			created_at: (createdAt ?? /* @__PURE__ */ new Date())?.toISOString(),
			extra: {}
		};
		if (metadata) body.extra["metadata"] = metadata;
		const serializedBody = JSON.stringify(body);
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/datasets/comparative`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: serializedBody
			});
			await raiseForStatus(res, "create comparative experiment");
			return res;
		})).json();
	}
	/**
	* Retrieves a list of presigned feedback tokens for a given run ID.
	* @param runId The ID of the run.
	* @returns An async iterable of FeedbackIngestToken objects.
	*/
	async *listPresignedFeedbackTokens(runId) {
		assertUuid(runId);
		const params = new URLSearchParams({ run_id: runId });
		for await (const tokens of this._getPaginated("/feedback/tokens", params)) yield* tokens;
	}
	_selectEvalResults(results) {
		let results_;
		if ("results" in results) results_ = results.results;
		else if (Array.isArray(results)) results_ = results;
		else results_ = [results];
		return results_;
	}
	async _logEvaluationFeedback(evaluatorResponse, run, sourceInfo) {
		const evalResults = this._selectEvalResults(evaluatorResponse);
		const feedbacks = [];
		for (const res of evalResults) {
			let sourceInfo_ = sourceInfo || {};
			if (res.evaluatorInfo) sourceInfo_ = {
				...res.evaluatorInfo,
				...sourceInfo_
			};
			let runId_ = null;
			if (res.targetRunId) runId_ = res.targetRunId;
			else if (run) runId_ = run.id;
			feedbacks.push(await this.createFeedback(runId_, res.key, {
				score: res.score,
				value: res.value,
				comment: res.comment,
				correction: res.correction,
				sourceInfo: sourceInfo_,
				sourceRunId: res.sourceRunId,
				feedbackConfig: res.feedbackConfig,
				feedbackSourceType: "model",
				sessionId: run?.session_id,
				startTime: run?.start_time
			}));
		}
		return [evalResults, feedbacks];
	}
	async logEvaluationFeedback(evaluatorResponse, run, sourceInfo) {
		const [results] = await this._logEvaluationFeedback(evaluatorResponse, run, sourceInfo);
		return results;
	}
	/**
	* API for managing feedback configs
	*/
	/**
	* Create a feedback configuration on the LangSmith API.
	*
	* This upserts: if an identical config already exists, it returns it.
	* If a conflicting config exists for the same key, a 400 error is raised.
	*
	* @param options - The options for creating a feedback config
	* @param options.feedbackKey - The unique key for this feedback config
	* @param options.feedbackConfig - The config specifying type, bounds, and categories
	* @param options.isLowerScoreBetter - Whether a lower score is better
	* @returns The created FeedbackConfigSchema object
	*/
	async createFeedbackConfig(options) {
		const { feedbackKey, feedbackConfig, isLowerScoreBetter = false } = options;
		const body = {
			feedback_key: feedbackKey,
			feedback_config: feedbackConfig,
			is_lower_score_better: isLowerScoreBetter
		};
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/feedback-configs`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: JSON.stringify(body)
			});
			await raiseForStatus(res, "create feedback config");
			return res;
		})).json();
	}
	/**
	* List feedback configurations on the LangSmith API.
	* @param options - The options for listing feedback configs
	* @param options.feedbackKeys - Filter by specific feedback keys
	* @param options.nameContains - Filter by name substring
	* @param options.limit - The maximum number of configs to return
	* @returns An async iterator of FeedbackConfigSchema objects
	*/
	async *listFeedbackConfigs(options = {}) {
		const { feedbackKeys, nameContains, limit } = options;
		const params = new URLSearchParams();
		if (feedbackKeys) feedbackKeys.forEach((key) => {
			params.append("key", key);
		});
		if (nameContains) params.append("name_contains", nameContains);
		params.append("limit", (limit !== void 0 ? Math.min(limit, 100) : 100).toString());
		let count = 0;
		for await (const configs of this._getPaginated("/feedback-configs", params)) {
			yield* configs;
			count += configs.length;
			if (limit !== void 0 && count >= limit) break;
		}
	}
	/**
	* Update a feedback configuration on the LangSmith API.
	* @param feedbackKey - The key of the feedback config to update
	* @param options - The options for updating the feedback config
	* @param options.feedbackConfig - The new feedback config
	* @param options.isLowerScoreBetter - Whether a lower score is better
	* @returns The updated FeedbackConfigSchema object
	*/
	async updateFeedbackConfig(feedbackKey, options = {}) {
		const { feedbackConfig, isLowerScoreBetter } = options;
		const body = { feedback_key: feedbackKey };
		if (feedbackConfig !== void 0) body.feedback_config = feedbackConfig;
		if (isLowerScoreBetter !== void 0) body.is_lower_score_better = isLowerScoreBetter;
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/feedback-configs`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: JSON.stringify(body)
			});
			await raiseForStatus(res, "update feedback config");
			return res;
		})).json();
	}
	/**
	* Delete a feedback configuration on the LangSmith API.
	* @param feedbackKey - The key of the feedback config to delete
	*/
	async deleteFeedbackConfig(feedbackKey) {
		const params = new URLSearchParams({ feedback_key: feedbackKey });
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/feedback-configs?${params}`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "delete feedback config", true);
			return res;
		});
	}
	/**
	* API for managing annotation queues
	*/
	/**
	* List the annotation queues on the LangSmith API.
	* @param options - The options for listing annotation queues
	* @param options.queueIds - The IDs of the queues to filter by
	* @param options.name - The name of the queue to filter by
	* @param options.nameContains - The substring that the queue name should contain
	* @param options.limit - The maximum number of queues to return
	* @returns An iterator of AnnotationQueue objects
	*/
	async *listAnnotationQueues(options = {}) {
		const { queueIds, name, nameContains, limit } = options;
		const params = new URLSearchParams();
		if (queueIds) queueIds.forEach((id, i) => {
			assertUuid(id, `queueIds[${i}]`);
			params.append("ids", id);
		});
		if (name) params.append("name", name);
		if (nameContains) params.append("name_contains", nameContains);
		params.append("limit", (limit !== void 0 ? Math.min(limit, 100) : 100).toString());
		let count = 0;
		for await (const queues of this._getPaginated("/annotation-queues", params)) {
			yield* queues;
			count++;
			if (limit !== void 0 && count >= limit) break;
		}
	}
	/**
	* Create an annotation queue on the LangSmith API.
	* @param options - The options for creating an annotation queue
	* @param options.name - The name of the annotation queue
	* @param options.description - The description of the annotation queue
	* @param options.queueId - The ID of the annotation queue
	* @returns The created AnnotationQueue object
	*/
	async createAnnotationQueue(options) {
		const { name, description, queueId, rubricInstructions, rubricItems } = options;
		const body = {
			name,
			description,
			id: queueId || v4(),
			rubric_instructions: rubricInstructions,
			rubric_items: rubricItems
		};
		const serializedBody = JSON.stringify(Object.fromEntries(Object.entries(body).filter(([_, v]) => v !== void 0)));
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: serializedBody
			});
			await raiseForStatus(res, "create annotation queue");
			return res;
		})).json();
	}
	/**
	* Read an annotation queue with the specified queue ID.
	* @param queueId - The ID of the annotation queue to read
	* @returns The AnnotationQueueWithDetails object
	*/
	async readAnnotationQueue(queueId) {
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "read annotation queue");
			return res;
		})).json();
	}
	/**
	* Update an annotation queue with the specified queue ID.
	* @param queueId - The ID of the annotation queue to update
	* @param options - The options for updating the annotation queue
	* @param options.name - The new name for the annotation queue
	* @param options.description - The new description for the annotation queue
	*/
	async updateAnnotationQueue(queueId, options) {
		const { name, description, rubricInstructions, rubricItems } = options;
		const bodyObj = {};
		if (name !== void 0) bodyObj.name = name;
		if (description !== void 0) bodyObj.description = description;
		if (rubricInstructions !== void 0) bodyObj.rubric_instructions = rubricInstructions;
		if (rubricItems !== void 0) bodyObj.rubric_items = rubricItems;
		const body = JSON.stringify(bodyObj);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update annotation queue", true);
			return res;
		});
	}
	/**
	* Delete an annotation queue with the specified queue ID.
	* @param queueId - The ID of the annotation queue to delete
	*/
	async deleteAnnotationQueue(queueId) {
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}`, {
				method: "DELETE",
				headers: {
					...this._mergedHeaders,
					Accept: "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "delete annotation queue", true);
			return res;
		});
	}
	/**
	* Add runs to an annotation queue with the specified queue ID.
	* @param queueId - The ID of the annotation queue
	* @param runIds - The IDs of the runs to be added to the annotation queue
	*/
	async addRunsToAnnotationQueue(queueId, runIds) {
		const body = JSON.stringify(runIds.map((id, i) => assertUuid(id, `runIds[${i}]`).toString()));
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}/runs`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "add runs to annotation queue", true);
			return res;
		});
	}
	/**
	* Get a run from an annotation queue at the specified index.
	* @param queueId - The ID of the annotation queue
	* @param index - The index of the run to retrieve
	* @returns A Promise that resolves to a RunWithAnnotationQueueInfo object
	* @throws {Error} If the run is not found at the given index or for other API-related errors
	*/
	async getRunFromAnnotationQueue(queueId, index) {
		const baseUrl = `/annotation-queues/${assertUuid(queueId, "queueId")}/run`;
		return _normalizeRunTimestamps(await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}${baseUrl}/${index}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "get run from annotation queue");
			return res;
		})).json());
	}
	/**
	* Delete a run from an an annotation queue.
	* @param queueId - The ID of the annotation queue to delete the run from
	* @param queueRunId - The ID of the run to delete from the annotation queue
	*/
	async deleteRunFromAnnotationQueue(queueId, queueRunId) {
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}/runs/${assertUuid(queueRunId, "queueRunId")}`, {
				method: "DELETE",
				headers: {
					...this._mergedHeaders,
					Accept: "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "delete run from annotation queue", true);
			return res;
		});
	}
	/**
	* Get the size of an annotation queue.
	* @param queueId - The ID of the annotation queue
	*/
	async getSizeFromAnnotationQueue(queueId) {
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}/size`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "get size from annotation queue");
			return res;
		})).json();
	}
	async _currentTenantIsOwner(owner) {
		const settings = await this._getSettings();
		return owner == "-" || settings.tenant_handle === owner;
	}
	async _ownerConflictError(action, owner) {
		const settings = await this._getSettings();
		return /* @__PURE__ */ new Error(`Cannot ${action} for another tenant.\n
      Current tenant: ${settings.tenant_handle}\n
      Requested tenant: ${owner}`);
	}
	async _getLatestCommitHash(promptOwnerAndName) {
		const json = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/commits/${promptOwnerAndName}/?limit=1&offset=0`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "get latest commit hash");
			return res;
		})).json();
		if (json.commits.length === 0) return;
		return json.commits[0].commit_hash;
	}
	async _likeOrUnlikePrompt(promptIdentifier, like) {
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		const body = JSON.stringify({ like });
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/likes/${owner}/${promptName}`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, `${like ? "like" : "unlike"} prompt`);
			return res;
		})).json();
	}
	async _getPromptUrl(promptIdentifier) {
		const [owner, promptName, commitHash] = parseHubIdentifier(promptIdentifier);
		if (!await this._currentTenantIsOwner(owner)) if (commitHash !== "latest") return `${this.getHostUrl()}/hub/${owner}/${promptName}/${commitHash.substring(0, 8)}`;
		else return `${this.getHostUrl()}/hub/${owner}/${promptName}`;
		else {
			const settings = await this._getSettings();
			if (commitHash !== "latest") return `${this.getHostUrl()}/prompts/${promptName}/${commitHash.substring(0, 8)}?organizationId=${settings.id}`;
			else return `${this.getHostUrl()}/prompts/${promptName}?organizationId=${settings.id}`;
		}
	}
	/**
	* Check if a prompt exists.
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	* @returns A Promise that resolves to true if the prompt exists, false otherwise
	* @example
	* ```typescript
	* // Check if a prompt exists before creating a commit
	* if (await client.promptExists("my-prompt")) {
	*   await client.createCommit("my-prompt", template);
	* } else {
	*   await client.createPrompt("my-prompt");
	* }
	* ```
	*/
	async promptExists(promptIdentifier) {
		return !!await this.getPrompt(promptIdentifier);
	}
	/**
	* Like a prompt.
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	* @returns A Promise that resolves to the like response containing the updated like count
	* @example
	* ```typescript
	* // Like a prompt
	* const response = await client.likePrompt("owner/useful-prompt");
	* console.log(`Prompt now has ${response.likes} likes`);
	* ```
	*/
	async likePrompt(promptIdentifier) {
		return this._likeOrUnlikePrompt(promptIdentifier, true);
	}
	/**
	* Unlike a prompt (remove a previously added like).
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	* @returns A Promise that resolves to the like response containing the updated like count
	* @example
	* ```typescript
	* // Unlike a prompt
	* const response = await client.unlikePrompt("owner/useful-prompt");
	* console.log(`Prompt now has ${response.likes} likes`);
	* ```
	*/
	async unlikePrompt(promptIdentifier) {
		return this._likeOrUnlikePrompt(promptIdentifier, false);
	}
	/**
	* List all commits for a prompt.
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	*   - "promptName:commitHash" (commit hash is ignored, all commits are returned)
	* @returns An async iterable iterator of PromptCommit objects
	* @example
	* ```typescript
	* // List commits for a private prompt
	* for await (const commit of client.listCommits("my-prompt")) {
	*   console.log(commit);
	* }
	*
	* // List commits for a prompt with explicit owner
	* for await (const commit of client.listCommits("owner/my-prompt")) {
	*   console.log(commit);
	* }
	* ```
	*/
	async *listCommits(promptIdentifier) {
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		for await (const commits of this._getPaginated(`/commits/${owner}/${promptName}/`, new URLSearchParams(), (res) => res.commits)) yield* commits;
	}
	/**
	* List prompts by filter.
	* @param options - Optional filters for listing prompts
	* @param options.isPublic - Filter by public/private prompts. If undefined, returns all prompts.
	* @param options.isArchived - Filter by archived status. Defaults to false (non-archived prompts only).
	* @param options.sortField - Field to sort by. Defaults to "updated_at".
	* @param options.query - Search query to filter prompts by name or description.
	* @returns An async iterable iterator of Prompt objects
	* @example
	* ```typescript
	* // List all prompts
	* for await (const prompt of client.listPrompts()) {
	*   console.log(prompt);
	* }
	*
	* // List only public prompts
	* for await (const prompt of client.listPrompts({ isPublic: true })) {
	*   console.log(prompt);
	* }
	*
	* // Search for prompts
	* for await (const prompt of client.listPrompts({ query: "translation" })) {
	*   console.log(prompt);
	* }
	* ```
	*/
	async *listPrompts(options) {
		const params = new URLSearchParams();
		params.append("sort_field", options?.sortField ?? "updated_at");
		params.append("sort_direction", "desc");
		params.append("is_archived", (!!options?.isArchived).toString());
		if (options?.isPublic !== void 0) params.append("is_public", options.isPublic.toString());
		if (options?.query) params.append("query", options.query);
		for await (const prompts of this._getPaginated("/repos", params, (res) => res.repos)) yield* prompts;
	}
	/**
	* Get a prompt by its identifier.
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	*   - "promptName:commitHash" (commit hash is ignored, latest version is returned)
	* @returns A Promise that resolves to the Prompt object, or null if not found
	* @example
	* ```typescript
	* // Get a private prompt
	* const prompt = await client.getPrompt("my-prompt");
	*
	* // Get a public prompt
	* const publicPrompt = await client.getPrompt("owner/public-prompt");
	* ```
	*/
	async getPrompt(promptIdentifier) {
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		const result = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/${owner}/${promptName}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			if (res?.status === 404) return null;
			await raiseForStatus(res, "get prompt");
			return res;
		}))?.json();
		if (result?.repo) return result.repo;
		else return null;
	}
	/**
	* Create a new prompt.
	* @param promptIdentifier - The identifier for the new prompt. Can be in the format:
	*   - "promptName" (creates a private prompt)
	*   - "owner/promptName" (creates a prompt under a specific owner, must match your tenant)
	* @param options - Optional configuration for the prompt
	* @param options.description - A description of the prompt
	* @param options.readme - Markdown content for the prompt's README
	* @param options.tags - Array of tags to categorize the prompt
	* @param options.isPublic - Whether the prompt should be public. Requires a LangChain Hub handle.
	* @returns A Promise that resolves to the created Prompt object
	* @throws {Error} If creating a public prompt without a LangChain Hub handle, or if owner doesn't match current tenant
	* @example
	* ```typescript
	* // Create a private prompt
	* const prompt = await client.createPrompt("my-new-prompt", {
	*   description: "A prompt for translations",
	*   tags: ["translation", "language"]
	* });
	*
	* // Create a public prompt
	* const publicPrompt = await client.createPrompt("my-public-prompt", {
	*   description: "A public translation prompt",
	*   isPublic: true
	* });
	* ```
	*/
	async createPrompt(promptIdentifier, options) {
		const settings = await this._getSettings();
		if (options?.isPublic && !settings.tenant_handle) throw new Error(`Cannot create a public prompt without first\n
        creating a LangChain Hub handle.
        You can add a handle by creating a public prompt at:\n
        https://smith.langchain.com/prompts`);
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError("create a prompt", owner);
		const data = {
			repo_handle: promptName,
			...options?.description && { description: options.description },
			...options?.readme && { readme: options.readme },
			...options?.tags && { tags: options.tags },
			is_public: !!options?.isPublic
		};
		const body = JSON.stringify(data);
		const { repo } = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "create prompt");
			return res;
		})).json();
		return repo;
	}
	/**
	* Create a new commit for an existing prompt.
	* @param promptIdentifier - The identifier of the prompt. Can be in the format:
	*   - "promptName" (for private prompts, owner defaults to "-")
	*   - "owner/promptName" (for prompts with explicit owner)
	* @param object - The prompt object/manifest to commit (e.g., ChatPromptTemplate, messages array, etc.)
	* @param options - Optional configuration for the commit
	* @param options.parentCommitHash - The parent commit hash. Defaults to "latest" (the most recent commit).
	* @returns A Promise that resolves to the URL of the newly created commit
	* @throws {Error} If the prompt does not exist
	* @example
	* ```typescript
	* import { ChatPromptTemplate } from "@langchain/core/prompts";
	*
	* // Create a commit with a new version of the prompt
	* const template = ChatPromptTemplate.fromMessages([
	*   ["system", "You are a helpful assistant."],
	*   ["human", "{input}"]
	* ]);
	*
	* const commitUrl = await client.createCommit("my-prompt", template);
	* console.log(`Commit created: ${commitUrl}`);
	*
	* // Create a commit based on a specific parent commit
	* const commitUrl2 = await client.createCommit("my-prompt", template, {
	*   parentCommitHash: "abc123def456"
	* });
	* ```
	*/
	async createCommit(promptIdentifier, object, options) {
		if (!await this.promptExists(promptIdentifier)) throw new Error("Prompt does not exist, you must create it first.");
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		const resolvedParentCommitHash = options?.parentCommitHash === "latest" || !options?.parentCommitHash ? await this._getLatestCommitHash(`${owner}/${promptName}`) : options?.parentCommitHash;
		const payload = {
			manifest: JSON.parse(JSON.stringify(object)),
			parent_commit: resolvedParentCommitHash,
			...options?.description !== void 0 && { description: options.description }
		};
		const body = JSON.stringify(payload);
		const result = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/commits/${owner}/${promptName}`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "create commit");
			return res;
		})).json();
		return this._getPromptUrl(`${owner}/${promptName}${result.commit_hash ? `:${result.commit_hash}` : ""}`);
	}
	/**
	* Update examples with attachments using multipart form data.
	* @param updates List of ExampleUpdateWithAttachments objects to upsert
	* @returns Promise with the update response
	*/
	async updateExamplesMultipart(datasetId, updates = []) {
		return this._updateExamplesMultipart(datasetId, updates);
	}
	async _updateExamplesMultipart(datasetId, updates = []) {
		if (!await this._getDatasetExamplesMultiPartSupport()) throw new Error("Your LangSmith deployment does not allow using the multipart examples endpoint, please upgrade your deployment to the latest version.");
		const formData = new FormData();
		for (const example of updates) {
			const exampleId = example.id;
			const stringifiedExample = serialize({
				...example.metadata && { metadata: example.metadata },
				...example.split && { split: example.split }
			}, `Serializing body for example with id: ${exampleId}`);
			const exampleBlob = new Blob([stringifiedExample], { type: "application/json" });
			formData.append(exampleId, exampleBlob);
			if (example.inputs) {
				const stringifiedInputs = serialize(example.inputs, `Serializing inputs for example with id: ${exampleId}`);
				const inputsBlob = new Blob([stringifiedInputs], { type: "application/json" });
				formData.append(`${exampleId}.inputs`, inputsBlob);
			}
			if (example.outputs) {
				const stringifiedOutputs = serialize(example.outputs, `Serializing outputs whle updating example with id: ${exampleId}`);
				const outputsBlob = new Blob([stringifiedOutputs], { type: "application/json" });
				formData.append(`${exampleId}.outputs`, outputsBlob);
			}
			if (example.attachments) for (const [name, attachment] of Object.entries(example.attachments)) {
				let mimeType;
				let data;
				if (Array.isArray(attachment)) [mimeType, data] = attachment;
				else {
					mimeType = attachment.mimeType;
					data = attachment.data;
				}
				const attachmentBlob = new Blob([data], { type: `${mimeType}; length=${data.byteLength}` });
				formData.append(`${exampleId}.attachment.${name}`, attachmentBlob);
			}
			if (example.attachments_operations) {
				const stringifiedAttachmentsOperations = serialize(example.attachments_operations, `Serializing attachments while updating example with id: ${exampleId}`);
				const attachmentsOperationsBlob = new Blob([stringifiedAttachmentsOperations], { type: "application/json" });
				formData.append(`${exampleId}.attachments_operations`, attachmentsOperationsBlob);
			}
		}
		const datasetIdToUse = datasetId ?? updates[0]?.dataset_id;
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}${this._getPlatformEndpointPath(`datasets/${datasetIdToUse}/examples`)}`, {
				method: "PATCH",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: formData
			});
			await raiseForStatus(res, "update examples");
			return res;
		})).json();
	}
	/**
	* Upload examples with attachments using multipart form data.
	* @param uploads List of ExampleUploadWithAttachments objects to upload
	* @returns Promise with the upload response
	* @deprecated This method is deprecated and will be removed in future LangSmith versions, please use `createExamples` instead
	*/
	async uploadExamplesMultipart(datasetId, uploads = []) {
		return this._uploadExamplesMultipart(datasetId, uploads);
	}
	async _uploadExamplesMultipart(datasetId, uploads = []) {
		if (!await this._getDatasetExamplesMultiPartSupport()) throw new Error("Your LangSmith deployment does not allow using the multipart examples endpoint, please upgrade your deployment to the latest version.");
		const formData = new FormData();
		for (const example of uploads) {
			const exampleId = (example.id ?? v4()).toString();
			const stringifiedExample = serialize({
				created_at: example.created_at,
				...example.metadata && { metadata: example.metadata },
				...example.split && { split: example.split },
				...example.source_run_id && { source_run_id: example.source_run_id },
				...example.use_source_run_io && { use_source_run_io: example.use_source_run_io },
				...example.use_source_run_attachments && { use_source_run_attachments: example.use_source_run_attachments }
			}, `Serializing body for uploaded example with id: ${exampleId}`);
			const exampleBlob = new Blob([stringifiedExample], { type: "application/json" });
			formData.append(exampleId, exampleBlob);
			if (example.inputs) {
				const stringifiedInputs = serialize(example.inputs, `Serializing inputs for uploaded example with id: ${exampleId}`);
				const inputsBlob = new Blob([stringifiedInputs], { type: "application/json" });
				formData.append(`${exampleId}.inputs`, inputsBlob);
			}
			if (example.outputs) {
				const stringifiedOutputs = serialize(example.outputs, `Serializing outputs for uploaded example with id: ${exampleId}`);
				const outputsBlob = new Blob([stringifiedOutputs], { type: "application/json" });
				formData.append(`${exampleId}.outputs`, outputsBlob);
			}
			if (example.attachments) for (const [name, attachment] of Object.entries(example.attachments)) {
				let mimeType;
				let data;
				if (Array.isArray(attachment)) [mimeType, data] = attachment;
				else {
					mimeType = attachment.mimeType;
					data = attachment.data;
				}
				const attachmentBlob = new Blob([data], { type: `${mimeType}; length=${data.byteLength}` });
				formData.append(`${exampleId}.attachment.${name}`, attachmentBlob);
			}
		}
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}${this._getPlatformEndpointPath(`datasets/${datasetId}/examples`)}`, {
				method: "POST",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: formData
			});
			await raiseForStatus(res, "upload examples");
			return res;
		})).json();
	}
	async updatePrompt(promptIdentifier, options) {
		if (!await this.promptExists(promptIdentifier)) throw new Error("Prompt does not exist, you must create it first.");
		const [owner, promptName] = parseHubIdentifier(promptIdentifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError("update a prompt", owner);
		const payload = {};
		if (options?.description !== void 0) payload.description = options.description;
		if (options?.readme !== void 0) payload.readme = options.readme;
		if (options?.tags !== void 0) payload.tags = options.tags;
		if (options?.isPublic !== void 0) payload.is_public = options.isPublic;
		if (options?.isArchived !== void 0) payload.is_archived = options.isArchived;
		if (Object.keys(payload).length === 0) throw new Error("No valid update options provided");
		const body = JSON.stringify(payload);
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/${owner}/${promptName}`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body
			});
			await raiseForStatus(res, "update prompt");
			return res;
		})).json();
	}
	async deletePrompt(promptIdentifier) {
		if (!await this.promptExists(promptIdentifier)) throw new Error("Prompt does not exist, you must create it first.");
		const [owner, promptName, _] = parseHubIdentifier(promptIdentifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError("delete a prompt", owner);
		return (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/${owner}/${promptName}`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "delete prompt");
			return res;
		})).json();
	}
	/**
	* Generate a cache key for a prompt.
	* Format: "{identifier}" or "{identifier}:with_model"
	*/
	_getPromptCacheKey(promptIdentifier, includeModel) {
		return `${promptIdentifier}${includeModel ? ":with_model" : ""}`;
	}
	/**
	* Fetch a prompt commit directly from the API (bypassing cache).
	*/
	async _fetchPromptFromApi(promptIdentifier, options) {
		const [owner, promptName, commitHash] = parseHubIdentifier(promptIdentifier);
		const result = await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/commits/${owner}/${promptName}/${commitHash}${options?.includeModel ? "?include_model=true" : ""}`, {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "pull prompt commit");
			return res;
		})).json();
		return {
			owner,
			repo: promptName,
			commit_hash: result.commit_hash,
			manifest: result.manifest,
			examples: result.examples,
			hub_model_config: result.model_config,
			hub_model_provider: result.model_provider
		};
	}
	/**
	* Pull a prompt commit from the LangSmith API.
	*
	* Public prompts referenced by owner/name cross a trust boundary because the
	* prompt manifest may contain serialized LangChain objects and configuration
	* that affect runtime behavior. For example, a prompt can intentionally
	* configure a model with a custom base URL, headers, model name, or other
	* constructor arguments. These are supported features, but they also mean the
	* prompt contents should be treated as executable configuration rather than
	* plain text.
	*
	* Set `dangerouslyPullPublicPrompt: true` only after reviewing and trusting
	* the prompt contents, not merely the publishing account. Prompts from your
	* own or your organization's account can still be unsafe if that account or
	* prompt was compromised.
	*/
	async pullPromptCommit(promptIdentifier, options) {
		assertPullPublicPromptAllowed(promptIdentifier, options?.dangerouslyPullPublicPrompt);
		const refreshFunc = this._fetchPromptFromApi.bind(this, promptIdentifier, options);
		if (!options?.skipCache && this._promptCache) {
			const cacheKey = this._getPromptCacheKey(promptIdentifier, options?.includeModel);
			const cached = this._promptCache.get(cacheKey, refreshFunc);
			if (cached) return cached;
			const result = await refreshFunc();
			this._promptCache.set(cacheKey, result, refreshFunc);
			return result;
		}
		return this._fetchPromptFromApi(promptIdentifier, options);
	}
	/**
	* This method should not be used directly, use `import { pull } from "langchain/hub"` instead.
	* Using this method directly returns the JSON string of the prompt rather than a LangChain object.
	*
	* Public prompts referenced by owner/name cross a trust boundary because the
	* prompt manifest may contain serialized LangChain objects and configuration
	* that affect runtime behavior. For example, a prompt can intentionally
	* configure a model with a custom base URL, headers, model name, or other
	* constructor arguments. These are supported features, but they also mean the
	* prompt contents should be treated as executable configuration rather than
	* plain text.
	*
	* Set `dangerouslyPullPublicPrompt: true` only after reviewing and trusting
	* the prompt contents, not merely the publishing account. Prompts from your
	* own or your organization's account can still be unsafe if that account or
	* prompt was compromised.
	* @private
	*/
	async _pullPrompt(promptIdentifier, options) {
		const promptObject = await this.pullPromptCommit(promptIdentifier, {
			includeModel: options?.includeModel,
			skipCache: options?.skipCache,
			dangerouslyPullPublicPrompt: options?.dangerouslyPullPublicPrompt
		});
		return JSON.stringify(promptObject.manifest);
	}
	async pushPrompt(promptIdentifier, options) {
		if (await this.promptExists(promptIdentifier)) {
			if (options && Object.keys(options).some((key) => key !== "object")) await this.updatePrompt(promptIdentifier, {
				description: options?.description,
				readme: options?.readme,
				tags: options?.tags,
				isPublic: options?.isPublic
			});
		} else await this.createPrompt(promptIdentifier, {
			description: options?.description,
			readme: options?.readme,
			tags: options?.tags,
			isPublic: options?.isPublic
		});
		if (!options?.object) return await this._getPromptUrl(promptIdentifier);
		return await this.createCommit(promptIdentifier, options?.object, {
			parentCommitHash: options?.parentCommitHash,
			description: options?.commitDescription
		});
	}
	/**
	* Check if an agent repo exists.
	*/
	async agentExists(identifier) {
		const [owner, name] = parseHubIdentifier(identifier);
		return this._repoExists(owner, name);
	}
	/**
	* Check if a skill repo exists.
	*/
	async skillExists(identifier) {
		const [owner, name] = parseHubIdentifier(identifier);
		return this._repoExists(owner, name);
	}
	/**
	* Pull an agent directory from Hub.
	* @param identifier The identifier (owner/name[:version]).
	* @param options.version Commit hash or tag; overrides identifier's version.
	*/
	async pullAgent(identifier, options) {
		return await this._pullDirectory(identifier, "agent", options?.version);
	}
	/**
	* Pull a skill directory from Hub.
	*/
	async pullSkill(identifier, options) {
		return await this._pullDirectory(identifier, "skill", options?.version);
	}
	/**
	* Push an agent to Hub. Creates the repo if missing, patches metadata if
	* provided, then commits the given files.
	* @returns The URL of the resulting commit.
	*/
	async pushAgent(identifier, options) {
		return this._pushDirectory(identifier, "agent", options);
	}
	/**
	* Push a skill to Hub.
	*/
	async pushSkill(identifier, options) {
		return this._pushDirectory(identifier, "skill", options);
	}
	/**
	* Delete an agent and all its owned child file repos.
	*/
	async deleteAgent(identifier) {
		return this._deleteDirectory(identifier);
	}
	/**
	* Delete a skill and all its owned child file repos.
	*/
	async deleteSkill(identifier) {
		return this._deleteDirectory(identifier);
	}
	/**
	* List agent repos. Yields one at a time, auto-paginating.
	*/
	async *listAgents(options) {
		yield* this._listReposByType("agent", options);
	}
	/**
	* List skill repos. Yields one at a time, auto-paginating.
	*/
	async *listSkills(options) {
		yield* this._listReposByType("skill", options);
	}
	async *_listReposByType(repoType, options) {
		const params = new URLSearchParams();
		params.append("repo_type", repoType);
		params.append("is_archived", (!!options?.isArchived).toString());
		if (options?.isPublic !== void 0) params.append("is_public", options.isPublic.toString());
		if (options?.query) params.append("query", options.query);
		for await (const repos of this._getPaginated("/repos", params, (res) => res.repos)) yield* repos;
	}
	async _pullDirectory(identifier, repoType, version) {
		const [owner, name, parsedVersion] = parseHubIdentifier(identifier);
		const resolvedVersion = version ?? (parsedVersion !== "latest" ? parsedVersion : void 0);
		const url = new URL(`${this.apiUrl}/v1/platform/hub/repos/${owner}/${name}/directories`);
		url.searchParams.set("repo_type", repoType);
		if (resolvedVersion) url.searchParams.set("commit", resolvedVersion);
		return await (await this.caller.call(async () => {
			const res = await this._fetch(url.toString(), {
				method: "GET",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "pull directory");
			return res;
		})).json();
	}
	async _pushDirectory(identifier, repoType, options) {
		if (options.parentCommit !== void 0 && (options.parentCommit.length < 8 || options.parentCommit.length > 64)) throw new Error("parent_commit must be 8-64 characters");
		const [owner, name] = parseHubIdentifier(identifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError(`push ${repoType}`, owner);
		if (await this._repoExists(owner, name)) {
			if (options.description !== void 0 || options.readme !== void 0 || options.tags !== void 0 || options.isPublic !== void 0) await this._updateRepoMetadata(owner, name, options);
		} else {
			const REPO_HANDLE_PATTERN = /^[a-z][a-z0-9-_]*$/;
			if (!REPO_HANDLE_PATTERN.test(name)) throw new Error(`Invalid repo_handle ${JSON.stringify(name)}: must match ${REPO_HANDLE_PATTERN}`);
			await this._createRepo(name, repoType, options);
		}
		const body = { files: options.files };
		if (options.parentCommit) body.parent_commit = options.parentCommit;
		const commitHash = (await (await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/v1/platform/hub/repos/${owner}/${name}/directories/commits`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: JSON.stringify(body)
			});
			await raiseForStatus(res, `push ${repoType}`);
			return res;
		})).json()).commit.commit_hash;
		return `${this.getHostUrl()}/hub/${owner}/${name}:${commitHash.slice(0, 8)}`;
	}
	async _deleteDirectory(identifier) {
		const [owner, name] = parseHubIdentifier(identifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError("delete", owner);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/v1/platform/hub/repos/${owner}/${name}/directories`, {
				method: "DELETE",
				headers: this._mergedHeaders,
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions
			});
			await raiseForStatus(res, "delete directory");
			return res;
		});
	}
	async _repoExists(owner, name) {
		try {
			await this.caller.call(async () => {
				const res = await this._fetch(`${this.apiUrl}/repos/${owner}/${name}`, {
					method: "GET",
					headers: this._mergedHeaders,
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions
				});
				await raiseForStatus(res, "check repo exists");
				return res;
			});
			return true;
		} catch (e) {
			if (isLangSmithNotFoundError(e)) return false;
			throw e;
		}
	}
	async _createRepo(name, repoType, options) {
		const body = {
			repo_handle: name,
			repo_type: repoType,
			is_public: !!options.isPublic
		};
		if (options.description !== void 0) body.description = options.description;
		if (options.readme !== void 0) body.readme = options.readme;
		if (options.tags !== void 0) body.tags = options.tags;
		try {
			await this.caller.call(async () => {
				const res = await this._fetch(`${this.apiUrl}/repos/`, {
					method: "POST",
					headers: {
						...this._mergedHeaders,
						"Content-Type": "application/json"
					},
					signal: AbortSignal.timeout(this.timeout_ms),
					...this.fetchOptions,
					body: JSON.stringify(body)
				});
				await raiseForStatus(res, `create ${repoType}`);
				return res;
			});
		} catch (e) {
			if (isLangSmithConflictError(e)) return;
			throw e;
		}
	}
	async _updateRepoMetadata(owner, name, options) {
		const body = {};
		if (options.description !== void 0) body.description = options.description;
		if (options.readme !== void 0) body.readme = options.readme;
		if (options.tags !== void 0) body.tags = options.tags;
		if (options.isPublic !== void 0) body.is_public = options.isPublic;
		if (Object.keys(body).length === 0) return;
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/${owner}/${name}`, {
				method: "PATCH",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: JSON.stringify(body)
			});
			await raiseForStatus(res, "update repo metadata");
			return res;
		});
	}
	/**
	* Clone a public dataset to your own langsmith tenant.
	* This operation is idempotent. If you already have a dataset with the given name,
	* this function will do nothing.
	
	* @param {string} tokenOrUrl The token of the public dataset to clone.
	* @param {Object} [options] Additional options for cloning the dataset.
	* @param {string} [options.sourceApiUrl] The URL of the langsmith server where the data is hosted. Defaults to the API URL of your current client.
	* @param {string} [options.datasetName] The name of the dataset to create in your tenant. Defaults to the name of the public dataset.
	* @returns {Promise<void>}
	*/
	async clonePublicDataset(tokenOrUrl, options = {}) {
		const { sourceApiUrl = this.apiUrl, datasetName } = options;
		const [parsedApiUrl, tokenUuid] = this.parseTokenOrUrl(tokenOrUrl, sourceApiUrl);
		const sourceClient = new Client({
			apiUrl: parsedApiUrl,
			apiKey: "placeholder"
		});
		const ds = await sourceClient.readSharedDataset(tokenUuid);
		const finalDatasetName = datasetName || ds.name;
		try {
			if (await this.hasDataset({ datasetId: finalDatasetName })) {
				console.log(`Dataset ${finalDatasetName} already exists in your tenant. Skipping.`);
				return;
			}
		} catch (_) {}
		const examples = await sourceClient.listSharedExamples(tokenUuid);
		const dataset = await this.createDataset(finalDatasetName, {
			description: ds.description,
			dataType: ds.data_type || "kv",
			inputsSchema: ds.inputs_schema_definition ?? void 0,
			outputsSchema: ds.outputs_schema_definition ?? void 0
		});
		try {
			await this.createExamples({
				inputs: examples.map((e) => e.inputs),
				outputs: examples.flatMap((e) => e.outputs ? [e.outputs] : []),
				datasetId: dataset.id
			});
		} catch (e) {
			console.error(`An error occurred while creating dataset ${finalDatasetName}. You should delete it manually.`);
			throw e;
		}
	}
	parseTokenOrUrl(urlOrToken, apiUrl, numParts = 2, kind = "dataset") {
		try {
			assertUuid(urlOrToken);
			return [apiUrl, urlOrToken];
		} catch (_) {}
		try {
			const pathParts = new URL(urlOrToken).pathname.split("/").filter((part) => part !== "");
			if (pathParts.length >= numParts) return [apiUrl, pathParts[pathParts.length - numParts]];
			else throw new Error(`Invalid public ${kind} URL: ${urlOrToken}`);
		} catch (_error) {
			throw new Error(`Invalid public ${kind} URL or token: ${urlOrToken}`);
		}
	}
	/**
	* Cleanup resources held by the client.
	* Stops the cache's background refresh timer.
	*/
	cleanup() {
		if (this._promptCache) this._promptCache.stop();
	}
	/**
	* Awaits all pending trace batches. Useful for environments where
	* you need to be sure that all tracing requests finish before execution ends,
	* such as serverless environments.
	*
	* @example
	* ```
	* import { Client } from "langsmith";
	*
	* const client = new Client();
	*
	* try {
	*   // Tracing happens here
	*   ...
	* } finally {
	*   await client.awaitPendingTraceBatches();
	* }
	* ```
	*
	* @returns A promise that resolves once all currently pending traces have sent.
	*/
	async awaitPendingTraceBatches() {
		if (this.manualFlushMode) {
			console.warn("[WARNING]: When tracing in manual flush mode, you must call `await client.flush()` manually to submit trace batches.");
			return Promise.resolve();
		}
		/**
		* traceables use a backgrounded promise before updating runs to avoid blocking
		* and to allow waiting for child runs to end. Waiting a small amount of time
		* here ensures that they are able to enqueue their run operation before we await
		* queued run operations below:
		*
		* ```ts
		* const run = await traceable(async () => {
		*   return "Hello, world!";
		* }, { client })();
		*
		* await client.awaitPendingTraceBatches();
		* ```
		*/
		await new Promise((resolve) => setTimeout(resolve, 1));
		while (this._pendingDrains.size > 0) await Promise.all([...this._pendingDrains]);
		await Promise.all([...this.autoBatchQueue.items.map(({ itemPromise }) => itemPromise), this.batchIngestCaller.queue.onIdle()]);
		if (this.langSmithToOTELTranslator !== void 0) await getDefaultOTLPTracerComponents()?.DEFAULT_LANGSMITH_SPAN_PROCESSOR?.forceFlush();
	}
	/**
	* Returns a string representation of the Client instance.
	* This method is called when the object is converted to a string
	* or logged, ensuring sensitive information like API keys is not exposed.
	*
	* @returns A string representation of the Client.
	*/
	toString() {
		const params = [`apiUrl=${JSON.stringify(this.apiUrl)}`];
		if (this.webUrl !== void 0) params.push(`webUrl=${JSON.stringify(this.webUrl)}`);
		if (this.workspaceId !== void 0) params.push(`workspaceId=${JSON.stringify(this.workspaceId)}`);
		return `[LangSmithClient ${params.join(" ")}]`;
	}
	/**
	* Custom inspect method for Node.js.
	* This method is called when the object is inspected in the Node.js REPL
	* or with console.log, ensuring sensitive information like API keys is not exposed.
	*
	* @returns A string representation of the Client for inspection.
	*/
	[Symbol.for("nodejs.util.inspect.custom")]() {
		return this.toString();
	}
};
Object.defineProperty(Client, "_fallbackDirsCreated", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: /* @__PURE__ */ new Set()
});
function isExampleCreate(input) {
	return "dataset_id" in input || "dataset_name" in input;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/env.js
const isTracingEnabled = (tracingEnabled) => {
	if (tracingEnabled !== void 0) return tracingEnabled;
	return !!["TRACING_V2", "TRACING"].find((envVar) => getLangSmithEnvironmentVariable(envVar) === "true");
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/singletons/constants.js
const _LC_CONTEXT_VARIABLES_KEY = Symbol.for("lc:context_variables");
const _REPLICA_TRACE_ROOTS_KEY = Symbol.for("langsmith:replica_trace_roots");
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/context_vars.js
/**
* Get a context variable from a run tree instance
*/
function getContextVar(runTree, key) {
	if (_LC_CONTEXT_VARIABLES_KEY in runTree) return runTree[_LC_CONTEXT_VARIABLES_KEY][key];
}
/**
* Set a context variable on a run tree instance
*/
function setContextVar(runTree, key, value) {
	const contextVars = _LC_CONTEXT_VARIABLES_KEY in runTree ? runTree[_LC_CONTEXT_VARIABLES_KEY] : {};
	contextVars[key] = value;
	runTree[_LC_CONTEXT_VARIABLES_KEY] = contextVars;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/utils/project.js
const getDefaultProjectName = () => {
	return getLangSmithEnvironmentVariable("PROJECT") ?? getEnvironmentVariable("LANGCHAIN_SESSION") ?? "default";
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/run_trees.js
const TIMESTAMP_LENGTH = 36;
const UUID_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function getReplicaKey(replica) {
	return v5(Object.keys(replica).sort().map((key) => `${key}:${replica[key] ?? ""}`).join("|"), UUID_NAMESPACE_DNS);
}
function stripNonAlphanumeric(input) {
	return input.replace(/[-:.]/g, "");
}
function getMicrosecondPrecisionDatestring(epoch, executionOrder = 1) {
	const paddedOrder = executionOrder.toFixed(0).slice(0, 3).padStart(3, "0");
	return `${new Date(epoch).toISOString().slice(0, -1)}${paddedOrder}Z`;
}
function convertToDottedOrderFormat(epoch, runId, executionOrder = 1) {
	const microsecondPrecisionDatestring = getMicrosecondPrecisionDatestring(epoch, executionOrder);
	return {
		dottedOrder: stripNonAlphanumeric(microsecondPrecisionDatestring) + runId,
		microsecondPrecisionDatestring
	};
}
const HEADER_SAFE_REPLICA_FIELDS = new Set([
	"projectName",
	"updates",
	"reroot"
]);
function filterReplicaForHeaders(replica) {
	const filtered = {};
	for (const key of Object.keys(replica)) if (HEADER_SAFE_REPLICA_FIELDS.has(key)) filtered[key] = replica[key];
	return filtered;
}
/**
* Baggage header information
*/
var Baggage = class Baggage {
	constructor(metadata, tags, project_name, replicas) {
		Object.defineProperty(this, "metadata", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "tags", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "project_name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "replicas", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.metadata = metadata;
		this.tags = tags;
		this.project_name = project_name;
		this.replicas = replicas;
	}
	static fromHeader(value) {
		const items = value.split(",");
		let metadata = {};
		let tags = [];
		let project_name;
		let replicas;
		for (const item of items) {
			const [key, uriValue] = item.split("=");
			const value = decodeURIComponent(uriValue);
			if (key === "langsmith-metadata") metadata = JSON.parse(value);
			else if (key === "langsmith-tags") tags = value.split(",");
			else if (key === "langsmith-project") project_name = value;
			else if (key === "langsmith-replicas") replicas = JSON.parse(value).map((replica) => {
				if (Array.isArray(replica)) return replica;
				return filterReplicaForHeaders(replica);
			});
		}
		return new Baggage(metadata, tags, project_name, replicas);
	}
	toHeader() {
		const items = [];
		if (this.metadata && Object.keys(this.metadata).length > 0) items.push(`langsmith-metadata=${encodeURIComponent(JSON.stringify(this.metadata))}`);
		if (this.tags && this.tags.length > 0) items.push(`langsmith-tags=${encodeURIComponent(this.tags.join(","))}`);
		if (this.project_name) items.push(`langsmith-project=${encodeURIComponent(this.project_name)}`);
		return items.join(",");
	}
};
var RunTree = class RunTree {
	constructor(originalConfig) {
		Object.defineProperty(this, "id", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "run_type", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "project_name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "parent_run", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "parent_run_id", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "child_runs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "start_time", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "end_time", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "extra", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "tags", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "error", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "serialized", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "inputs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "outputs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "reference_example_id", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "client", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "events", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "trace_id", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "dotted_order", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "tracingEnabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "execution_order", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "child_execution_order", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/**
		* Attachments associated with the run.
		* Each entry is a tuple of [mime_type, bytes]
		*/
		Object.defineProperty(this, "attachments", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/**
		* Projects to replicate this run to with optional updates.
		*/
		Object.defineProperty(this, "replicas", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "distributedParentId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/**
		* @interface
		*/
		Object.defineProperty(this, "_serialized_start_time", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/**
		* @internal
		*/
		Object.defineProperty(this, "_awaitInputsOnPost", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		if (isRunTree(originalConfig)) {
			Object.assign(this, { ...originalConfig });
			return;
		}
		const defaultConfig = RunTree.getDefaultConfig();
		const { metadata, ...config } = originalConfig;
		const client = config.client ?? RunTree.getSharedClient();
		const dedupedMetadata = {
			...metadata,
			...config?.extra?.metadata
		};
		config.extra = {
			...config.extra,
			metadata: dedupedMetadata
		};
		if ("id" in config && config.id == null) delete config.id;
		Object.assign(this, {
			...defaultConfig,
			...config,
			client
		});
		this.execution_order ??= 1;
		this.child_execution_order ??= 1;
		if (!this.dotted_order) this._serialized_start_time = getMicrosecondPrecisionDatestring(this.start_time, this.execution_order);
		if (!this.id) this.id = uuid7FromTime(this._serialized_start_time ?? this.start_time);
		if (!this.trace_id) if (this.parent_run) this.trace_id = this.parent_run.trace_id ?? this.id;
		else this.trace_id = this.id;
		this.replicas = _ensureWriteReplicas(this.replicas);
		if (!this.dotted_order) {
			const { dottedOrder } = convertToDottedOrderFormat(this.start_time, this.id, this.execution_order);
			if (this.parent_run) this.dotted_order = this.parent_run.dotted_order + "." + dottedOrder;
			else this.dotted_order = dottedOrder;
		}
	}
	set metadata(metadata) {
		this.extra = {
			...this.extra,
			metadata: {
				...this.extra?.metadata,
				...metadata
			}
		};
	}
	get metadata() {
		return this.extra?.metadata;
	}
	static getDefaultConfig() {
		const start_time = Date.now();
		return {
			run_type: "chain",
			project_name: getDefaultProjectName(),
			child_runs: [],
			api_url: getEnvironmentVariable("LANGCHAIN_ENDPOINT") ?? "http://localhost:1984",
			api_key: getEnvironmentVariable("LANGCHAIN_API_KEY"),
			caller_options: {},
			start_time,
			serialized: {},
			inputs: {},
			extra: {}
		};
	}
	static getSharedClient() {
		if (!RunTree.sharedClient) RunTree.sharedClient = new Client();
		return RunTree.sharedClient;
	}
	createChild(config) {
		const child_execution_order = this.child_execution_order + 1;
		const inheritedReplicas = this.replicas?.map((replica) => {
			const { reroot, ...rest } = replica;
			return rest;
		});
		const childReplicas = config.replicas ?? inheritedReplicas;
		const child = new RunTree({
			...config,
			parent_run: this,
			project_name: this.project_name,
			replicas: childReplicas,
			client: this.client,
			tracingEnabled: this.tracingEnabled,
			execution_order: child_execution_order,
			child_execution_order
		});
		const parentMeta = this.extra?.metadata ?? {};
		const childMeta = child.extra?.metadata ?? {};
		if (Object.keys(parentMeta).length > 0) child.extra = {
			...child.extra,
			metadata: {
				...parentMeta,
				...childMeta
			}
		};
		if (_LC_CONTEXT_VARIABLES_KEY in this) child[_LC_CONTEXT_VARIABLES_KEY] = this[_LC_CONTEXT_VARIABLES_KEY];
		const LC_CHILD = Symbol.for("lc:child_config");
		const presentConfig = config.extra?.[LC_CHILD] ?? this.extra[LC_CHILD];
		if (isRunnableConfigLike(presentConfig)) {
			const newConfig = { ...presentConfig };
			const callbacks = isCallbackManagerLike(newConfig.callbacks) ? newConfig.callbacks.copy?.() : void 0;
			if (callbacks) {
				Object.assign(callbacks, { _parentRunId: child.id });
				callbacks.handlers?.find(isLangChainTracerLike)?.updateFromRunTree?.(child);
				newConfig.callbacks = callbacks;
			}
			child.extra[LC_CHILD] = newConfig;
		}
		const visited = /* @__PURE__ */ new Set();
		let current = this;
		while (current != null && !visited.has(current.id)) {
			visited.add(current.id);
			current.child_execution_order = Math.max(current.child_execution_order, child_execution_order);
			current = current.parent_run;
		}
		this.child_runs.push(child);
		return child;
	}
	async end(outputs, error, endTime = Date.now(), metadata) {
		this.outputs = this.outputs ?? outputs;
		this.error = this.error ?? error;
		this.end_time = this.end_time ?? endTime;
		if (metadata && Object.keys(metadata).length > 0) this.extra = this.extra ? {
			...this.extra,
			metadata: {
				...this.extra.metadata,
				...metadata
			}
		} : { metadata };
	}
	_convertToCreate(run, runtimeEnv, excludeChildRuns = true) {
		const runExtra = run.extra ?? {};
		if (runExtra?.runtime?.library === void 0) {
			if (!runExtra.runtime) runExtra.runtime = {};
			if (runtimeEnv) {
				for (const [k, v] of Object.entries(runtimeEnv)) if (!runExtra.runtime[k]) runExtra.runtime[k] = v;
			}
		}
		const parent_run_id = run.parent_run?.id ?? run.parent_run_id;
		let child_runs;
		if (!excludeChildRuns) child_runs = run.child_runs.map((child_run) => this._convertToCreate(child_run, runtimeEnv, excludeChildRuns));
		else child_runs = [];
		return {
			id: run.id,
			name: run.name,
			start_time: run._serialized_start_time ?? run.start_time,
			end_time: run.end_time,
			run_type: run.run_type,
			reference_example_id: run.reference_example_id,
			extra: runExtra,
			serialized: run.serialized,
			error: run.error,
			inputs: run.inputs,
			outputs: run.outputs,
			session_name: run.project_name,
			child_runs,
			parent_run_id,
			trace_id: run.trace_id,
			dotted_order: run.dotted_order,
			tags: run.tags,
			attachments: run.attachments,
			events: run.events
		};
	}
	_sliceParentId(parentId, run) {
		/**
		* Slice the parent id from dotted order.
		* Additionally check if the current run is a child of the parent. If so, update
		* the parent_run_id to undefined, and set the trace id to the new root id after
		* parent_id.
		*/
		if (run.dotted_order) {
			const segs = run.dotted_order.split(".");
			let startIdx = null;
			for (let idx = 0; idx < segs.length; idx++) if (segs[idx].slice(-TIMESTAMP_LENGTH) === parentId) {
				startIdx = idx;
				break;
			}
			if (startIdx !== null) {
				const trimmedSegs = segs.slice(startIdx + 1);
				run.dotted_order = trimmedSegs.join(".");
				if (trimmedSegs.length > 0) run.trace_id = trimmedSegs[0].slice(-TIMESTAMP_LENGTH);
				else run.trace_id = run.id;
			}
		}
		if (run.parent_run_id === parentId) run.parent_run_id = void 0;
	}
	_setReplicaTraceRoot(replicaKey, traceRootId) {
		const replicaTraceRoots = getContextVar(this, _REPLICA_TRACE_ROOTS_KEY) ?? {};
		replicaTraceRoots[replicaKey] = traceRootId;
		setContextVar(this, _REPLICA_TRACE_ROOTS_KEY, replicaTraceRoots);
		for (const child of this.child_runs) child._setReplicaTraceRoot(replicaKey, traceRootId);
	}
	_remapForProject(params) {
		const { projectName, runtimeEnv, excludeChildRuns = true, reroot = false, distributedParentId, apiUrl, apiKey, workspaceId } = params;
		const baseRun = this._convertToCreate(this, runtimeEnv, excludeChildRuns);
		if (projectName === this.project_name) return {
			...baseRun,
			session_name: projectName
		};
		if (reroot) {
			if (distributedParentId) this._sliceParentId(distributedParentId, baseRun);
			else {
				baseRun.parent_run_id = void 0;
				if (baseRun.dotted_order) {
					const segs = baseRun.dotted_order.split(".");
					if (segs.length > 0) {
						baseRun.dotted_order = segs[segs.length - 1];
						baseRun.trace_id = baseRun.id;
					}
				}
			}
			const replicaKey = getReplicaKey({
				projectName,
				apiUrl,
				apiKey,
				workspaceId
			});
			this._setReplicaTraceRoot(replicaKey, baseRun.id);
		}
		let ancestorRerootedTraceId;
		if (!reroot) {
			ancestorRerootedTraceId = (getContextVar(this, _REPLICA_TRACE_ROOTS_KEY) ?? {})[getReplicaKey({
				projectName,
				apiUrl,
				apiKey,
				workspaceId
			})];
			if (ancestorRerootedTraceId) {
				baseRun.trace_id = ancestorRerootedTraceId;
				if (baseRun.dotted_order) {
					const segs = baseRun.dotted_order.split(".");
					let rootIdx = null;
					for (let idx = 0; idx < segs.length; idx++) if (segs[idx].slice(-TIMESTAMP_LENGTH) === ancestorRerootedTraceId) {
						rootIdx = idx;
						break;
					}
					if (rootIdx !== null) baseRun.dotted_order = segs.slice(rootIdx).join(".");
				}
			}
		}
		const oldId = baseRun.id;
		const newId = nonCryptographicUuid7Deterministic(oldId, projectName);
		let newTraceId;
		if (baseRun.trace_id) newTraceId = nonCryptographicUuid7Deterministic(baseRun.trace_id, projectName);
		else newTraceId = newId;
		let newParentId;
		if (baseRun.parent_run_id) newParentId = nonCryptographicUuid7Deterministic(baseRun.parent_run_id, projectName);
		let newDottedOrder;
		if (baseRun.dotted_order) newDottedOrder = baseRun.dotted_order.split(".").map((seg) => {
			const remappedId = nonCryptographicUuid7Deterministic(seg.slice(-TIMESTAMP_LENGTH), projectName);
			return seg.slice(0, -TIMESTAMP_LENGTH) + remappedId;
		}).join(".");
		return {
			...baseRun,
			id: newId,
			trace_id: newTraceId,
			parent_run_id: newParentId,
			dotted_order: newDottedOrder,
			session_name: projectName
		};
	}
	async postRun(excludeChildRuns = true) {
		if (this._awaitInputsOnPost) this.inputs = await this.inputs;
		try {
			const runtimeEnv = getRuntimeEnvironment();
			if (this.replicas && this.replicas.length > 0) for (const { projectName, apiKey, apiUrl, workspaceId, reroot, client: replicaClient } of this.replicas) {
				const runCreate = this._remapForProject({
					projectName: projectName ?? this.project_name,
					runtimeEnv,
					excludeChildRuns: true,
					reroot,
					distributedParentId: this.distributedParentId,
					apiUrl,
					apiKey,
					workspaceId
				});
				await (replicaClient ?? this.client).createRun(runCreate, {
					apiKey,
					apiUrl,
					workspaceId
				});
			}
			else {
				const runCreate = this._convertToCreate(this, runtimeEnv, excludeChildRuns);
				await this.client.createRun(runCreate);
			}
			if (!excludeChildRuns) {
				warnOnce("Posting with excludeChildRuns=false is deprecated and will be removed in a future version.");
				for (const childRun of this.child_runs) await childRun.postRun(false);
			}
			this.child_runs = [];
		} catch (error) {
			console.error(`Error in postRun for run ${this.id}:`, error);
		}
	}
	async patchRun(options) {
		if (this.replicas && this.replicas.length > 0) for (const { projectName, apiKey, apiUrl, workspaceId, updates, reroot, client: replicaClient } of this.replicas) {
			const runData = this._remapForProject({
				projectName: projectName ?? this.project_name,
				runtimeEnv: void 0,
				excludeChildRuns: true,
				reroot,
				distributedParentId: this.distributedParentId,
				apiUrl,
				apiKey,
				workspaceId
			});
			const updatePayload = {
				id: runData.id,
				name: runData.name,
				run_type: runData.run_type,
				start_time: runData.start_time,
				outputs: runData.outputs,
				error: runData.error,
				parent_run_id: runData.parent_run_id,
				session_name: runData.session_name,
				reference_example_id: runData.reference_example_id,
				end_time: runData.end_time,
				dotted_order: runData.dotted_order,
				trace_id: runData.trace_id,
				events: runData.events,
				tags: runData.tags,
				extra: runData.extra,
				attachments: this.attachments,
				...updates
			};
			if (!options?.excludeInputs) updatePayload.inputs = runData.inputs;
			await (replicaClient ?? this.client).updateRun(runData.id, updatePayload, {
				apiKey,
				apiUrl,
				workspaceId
			});
		}
		else try {
			const runUpdate = {
				name: this.name,
				run_type: this.run_type,
				start_time: this._serialized_start_time ?? this.start_time,
				end_time: this.end_time,
				error: this.error,
				outputs: this.outputs,
				parent_run_id: this.parent_run?.id ?? this.parent_run_id,
				reference_example_id: this.reference_example_id,
				extra: this.extra,
				events: this.events,
				dotted_order: this.dotted_order,
				trace_id: this.trace_id,
				tags: this.tags,
				attachments: this.attachments,
				session_name: this.project_name
			};
			if (!options?.excludeInputs) runUpdate.inputs = this.inputs;
			await this.client.updateRun(this.id, runUpdate);
		} catch (error) {
			console.error(`Error in patchRun for run ${this.id}`, error);
		}
		this.child_runs = [];
	}
	toJSON() {
		return this._convertToCreate(this, void 0, false);
	}
	/**
	* Add an event to the run tree.
	* @param event - A single event or string to add
	*/
	addEvent(event) {
		if (!this.events) this.events = [];
		if (typeof event === "string") this.events.push({
			name: "event",
			time: (/* @__PURE__ */ new Date()).toISOString(),
			message: event
		});
		else this.events.push({
			...event,
			time: event.time ?? (/* @__PURE__ */ new Date()).toISOString()
		});
	}
	static fromRunnableConfig(parentConfig, props) {
		const callbackManager = parentConfig?.callbacks;
		let parentRun;
		let projectName;
		let client;
		let tracingEnabled = isTracingEnabled();
		if (callbackManager) {
			const parentRunId = callbackManager?.getParentRunId?.() ?? "";
			const langChainTracer = callbackManager?.handlers?.find((handler) => handler?.name == "langchain_tracer");
			parentRun = langChainTracer?.getRun?.(parentRunId);
			projectName = langChainTracer?.projectName;
			client = langChainTracer?.client;
			tracingEnabled = tracingEnabled || !!langChainTracer;
		}
		if (!parentRun) return new RunTree({
			...props,
			client,
			tracingEnabled,
			project_name: projectName
		});
		return new RunTree({
			name: parentRun.name,
			id: parentRun.id,
			trace_id: parentRun.trace_id,
			dotted_order: parentRun.dotted_order,
			client,
			tracingEnabled,
			project_name: projectName,
			tags: [...new Set((parentRun?.tags ?? []).concat(parentConfig?.tags ?? []))],
			extra: { metadata: {
				...parentRun?.extra?.metadata,
				...parentConfig?.metadata
			} }
		}).createChild(props);
	}
	static fromDottedOrder(dottedOrder) {
		return this.fromHeaders({ "langsmith-trace": dottedOrder });
	}
	static fromHeaders(headers, inheritArgs) {
		const rawHeaders = "get" in headers && typeof headers.get === "function" ? {
			"langsmith-trace": headers.get("langsmith-trace"),
			baggage: headers.get("baggage")
		} : headers;
		const headerTrace = rawHeaders["langsmith-trace"];
		if (!headerTrace || typeof headerTrace !== "string") return void 0;
		const parentDottedOrder = headerTrace.trim();
		const parsedDottedOrder = parentDottedOrder.split(".").map((part) => {
			const [strTime, uuid] = part.split("Z");
			return {
				strTime,
				time: Date.parse(strTime + "Z"),
				uuid
			};
		});
		const traceId = parsedDottedOrder[0].uuid;
		const config = {
			...inheritArgs,
			name: inheritArgs?.["name"] ?? "parent",
			run_type: inheritArgs?.["run_type"] ?? "chain",
			start_time: inheritArgs?.["start_time"] ?? Date.now(),
			id: parsedDottedOrder.at(-1)?.uuid,
			trace_id: traceId,
			dotted_order: parentDottedOrder
		};
		if (rawHeaders["baggage"] && typeof rawHeaders["baggage"] === "string") {
			const baggage = Baggage.fromHeader(rawHeaders["baggage"]);
			config.metadata = baggage.metadata;
			config.tags = baggage.tags;
			config.project_name = baggage.project_name;
			config.replicas = baggage.replicas;
		}
		const runTree = new RunTree(config);
		runTree.distributedParentId = runTree.id;
		return runTree;
	}
	toHeaders(headers) {
		const result = {
			"langsmith-trace": this.dotted_order,
			baggage: new Baggage(this.extra?.metadata, this.tags, this.project_name, this.replicas).toHeader()
		};
		if (headers) for (const [key, value] of Object.entries(result)) headers.set(key, value);
		return result;
	}
};
Object.defineProperty(RunTree, "sharedClient", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: null
});
function isRunTree(x) {
	return x != null && typeof x.createChild === "function" && typeof x.postRun === "function";
}
function isLangChainTracerLike(x) {
	return typeof x === "object" && x != null && typeof x.name === "string" && x.name === "langchain_tracer";
}
function containsLangChainTracerLike(x) {
	return Array.isArray(x) && x.some((callback) => isLangChainTracerLike(callback));
}
function isCallbackManagerLike(x) {
	return typeof x === "object" && x != null && Array.isArray(x.handlers);
}
function isRunnableConfigLike(x) {
	const callbacks = x?.callbacks;
	return x != null && typeof callbacks === "object" && (containsLangChainTracerLike(callbacks?.handlers) || containsLangChainTracerLike(callbacks));
}
function _getWriteReplicasFromEnv() {
	const envVar = getEnvironmentVariable("LANGSMITH_RUNS_ENDPOINTS");
	if (!envVar) return [];
	try {
		const parsed = JSON.parse(envVar);
		if (Array.isArray(parsed)) {
			const replicas = [];
			for (const item of parsed) {
				if (typeof item !== "object" || item === null) {
					console.warn(`Invalid item type in LANGSMITH_RUNS_ENDPOINTS: expected object, got ${typeof item}`);
					continue;
				}
				if (typeof item.api_url !== "string") {
					console.warn(`Invalid api_url type in LANGSMITH_RUNS_ENDPOINTS: expected string, got ${typeof item.api_url}`);
					continue;
				}
				if (typeof item.api_key !== "string") {
					console.warn(`Invalid api_key type in LANGSMITH_RUNS_ENDPOINTS: expected string, got ${typeof item.api_key}`);
					continue;
				}
				replicas.push({
					apiUrl: item.api_url.replace(/\/$/, ""),
					apiKey: item.api_key
				});
			}
			return replicas;
		} else if (typeof parsed === "object" && parsed !== null) {
			_checkEndpointEnvUnset(parsed);
			const replicas = [];
			for (const [url, key] of Object.entries(parsed)) {
				const cleanUrl = url.replace(/\/$/, "");
				if (typeof key === "string") replicas.push({
					apiUrl: cleanUrl,
					apiKey: key
				});
				else {
					console.warn(`Invalid value type in LANGSMITH_RUNS_ENDPOINTS for URL ${url}: expected string, got ${typeof key}`);
					continue;
				}
			}
			return replicas;
		} else {
			console.warn(`Invalid LANGSMITH_RUNS_ENDPOINTS – must be valid JSON array of objects with api_url and api_key properties, or object mapping url->apiKey, got ${typeof parsed}`);
			return [];
		}
	} catch (e) {
		if (isConflictingEndpointsError(e)) throw e;
		console.warn("Invalid LANGSMITH_RUNS_ENDPOINTS – must be valid JSON array of objects with api_url and api_key properties, or object mapping url->apiKey");
		return [];
	}
}
function _ensureWriteReplicas(replicas) {
	if (replicas) return replicas.map((replica) => {
		if (Array.isArray(replica)) return {
			projectName: replica[0],
			updates: replica[1]
		};
		return replica;
	});
	return _getWriteReplicasFromEnv();
}
function _checkEndpointEnvUnset(parsed) {
	if (Object.keys(parsed).length > 0 && getLangSmithEnvironmentVariable("ENDPOINT")) throw new ConflictingEndpointsError();
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.6.0_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.215_819459e3632cedc09780af3771b50d22/node_modules/langsmith/dist/index.js
const __version__ = "0.6.0";
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/core.js
var _a$1;
function $constructor(name, initializer, params) {
	function init(inst, def) {
		if (!inst._zod) Object.defineProperty(inst, "_zod", {
			value: {
				def,
				constr: _,
				traits: /* @__PURE__ */ new Set()
			},
			enumerable: false
		});
		if (inst._zod.traits.has(name)) return;
		inst._zod.traits.add(name);
		initializer(inst, def);
		const proto = _.prototype;
		const keys = Object.keys(proto);
		for (let i = 0; i < keys.length; i++) {
			const k = keys[i];
			if (!(k in inst)) inst[k] = proto[k].bind(inst);
		}
	}
	const Parent = params?.Parent ?? Object;
	class Definition extends Parent {}
	Object.defineProperty(Definition, "name", { value: name });
	function _(def) {
		var _a;
		const inst = params?.Parent ? new Definition() : this;
		init(inst, def);
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		for (const fn of inst._zod.deferred) fn();
		return inst;
	}
	Object.defineProperty(_, "init", { value: init });
	Object.defineProperty(_, Symbol.hasInstance, { value: (inst) => {
		if (params?.Parent && inst instanceof params.Parent) return true;
		return inst?._zod?.traits?.has(name);
	} });
	Object.defineProperty(_, "name", { value: name });
	return _;
}
var $ZodAsyncError = class extends Error {
	constructor() {
		super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
	}
};
var $ZodEncodeError = class extends Error {
	constructor(name) {
		super(`Encountered unidirectional transform during encode: ${name}`);
		this.name = "ZodEncodeError";
	}
};
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
	if (newConfig) Object.assign(globalConfig, newConfig);
	return globalConfig;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/util.js
function getEnumValues(entries) {
	const numericValues = Object.values(entries).filter((v) => typeof v === "number");
	return Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
}
function jsonStringifyReplacer(_, value) {
	if (typeof value === "bigint") return value.toString();
	return value;
}
function cached(getter) {
	return { get value() {
		{
			const value = getter();
			Object.defineProperty(this, "value", { value });
			return value;
		}
		throw new Error("cached value already set");
	} };
}
function nullish(input) {
	return input === null || input === void 0;
}
function cleanRegex(source) {
	const start = source.startsWith("^") ? 1 : 0;
	const end = source.endsWith("$") ? source.length - 1 : source.length;
	return source.slice(start, end);
}
const EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object, key, getter) {
	let value = void 0;
	Object.defineProperty(object, key, {
		get() {
			if (value === EVALUATING) return;
			if (value === void 0) {
				value = EVALUATING;
				value = getter();
			}
			return value;
		},
		set(v) {
			Object.defineProperty(object, key, { value: v });
		},
		configurable: true
	});
}
function assignProp(target, prop, value) {
	Object.defineProperty(target, prop, {
		value,
		writable: true,
		enumerable: true,
		configurable: true
	});
}
function mergeDefs(...defs) {
	const mergedDescriptors = {};
	for (const def of defs) Object.assign(mergedDescriptors, Object.getOwnPropertyDescriptors(def));
	return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
	return JSON.stringify(str);
}
function slugify(input) {
	return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {};
function isObject(data) {
	return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__ */ cached(() => {
	if (globalConfig.jitless) return false;
	if (typeof navigator !== "undefined" && navigator?.userAgent?.includes("Cloudflare")) return false;
	try {
		new Function("");
		return true;
	} catch (_) {
		return false;
	}
});
function isPlainObject(o) {
	if (isObject(o) === false) return false;
	const ctor = o.constructor;
	if (ctor === void 0) return true;
	if (typeof ctor !== "function") return true;
	const prot = ctor.prototype;
	if (isObject(prot) === false) return false;
	if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) return false;
	return true;
}
function shallowClone(o) {
	if (isPlainObject(o)) return { ...o };
	if (Array.isArray(o)) return [...o];
	if (o instanceof Map) return new Map(o);
	if (o instanceof Set) return new Set(o);
	return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set([
	"string",
	"number",
	"symbol"
]);
function escapeRegex(str) {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
	const cl = new inst._zod.constr(def ?? inst._zod.def);
	if (!def || params?.parent) cl._zod.parent = inst;
	return cl;
}
function normalizeParams(_params) {
	const params = _params;
	if (!params) return {};
	if (typeof params === "string") return { error: () => params };
	if (params?.message !== void 0) {
		if (params?.error !== void 0) throw new Error("Cannot specify both `message` and `error` params");
		params.error = params.message;
	}
	delete params.message;
	if (typeof params.error === "string") return {
		...params,
		error: () => params.error
	};
	return params;
}
function optionalKeys(shape) {
	return Object.keys(shape).filter((k) => {
		return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
	});
}
Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, -Number.MAX_VALUE, Number.MAX_VALUE;
function pick(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".pick() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = {};
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				newShape[key] = currDef.shape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function omit(schema, mask) {
	const currDef = schema._zod.def;
	const checks = currDef.checks;
	if (checks && checks.length > 0) throw new Error(".omit() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const newShape = { ...schema._zod.def.shape };
			for (const key in mask) {
				if (!(key in currDef.shape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				delete newShape[key];
			}
			assignProp(this, "shape", newShape);
			return newShape;
		},
		checks: []
	}));
}
function extend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to extend: expected a plain object");
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) {
		const existingShape = schema._zod.def.shape;
		for (const key in shape) if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
	}
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function safeExtend(schema, shape) {
	if (!isPlainObject(shape)) throw new Error("Invalid input to safeExtend: expected a plain object");
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const _shape = {
			...schema._zod.def.shape,
			...shape
		};
		assignProp(this, "shape", _shape);
		return _shape;
	} }));
}
function merge(a, b) {
	if (a._zod.def.checks?.length) throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
	return clone(a, mergeDefs(a._zod.def, {
		get shape() {
			const _shape = {
				...a._zod.def.shape,
				...b._zod.def.shape
			};
			assignProp(this, "shape", _shape);
			return _shape;
		},
		get catchall() {
			return b._zod.def.catchall;
		},
		checks: b._zod.def.checks ?? []
	}));
}
function partial(Class, schema, mask) {
	const checks = schema._zod.def.checks;
	if (checks && checks.length > 0) throw new Error(".partial() cannot be used on object schemas containing refinements");
	return clone(schema, mergeDefs(schema._zod.def, {
		get shape() {
			const oldShape = schema._zod.def.shape;
			const shape = { ...oldShape };
			if (mask) for (const key in mask) {
				if (!(key in oldShape)) throw new Error(`Unrecognized key: "${key}"`);
				if (!mask[key]) continue;
				shape[key] = Class ? new Class({
					type: "optional",
					innerType: oldShape[key]
				}) : oldShape[key];
			}
			else for (const key in oldShape) shape[key] = Class ? new Class({
				type: "optional",
				innerType: oldShape[key]
			}) : oldShape[key];
			assignProp(this, "shape", shape);
			return shape;
		},
		checks: []
	}));
}
function required(Class, schema, mask) {
	return clone(schema, mergeDefs(schema._zod.def, { get shape() {
		const oldShape = schema._zod.def.shape;
		const shape = { ...oldShape };
		if (mask) for (const key in mask) {
			if (!(key in shape)) throw new Error(`Unrecognized key: "${key}"`);
			if (!mask[key]) continue;
			shape[key] = new Class({
				type: "nonoptional",
				innerType: oldShape[key]
			});
		}
		else for (const key in oldShape) shape[key] = new Class({
			type: "nonoptional",
			innerType: oldShape[key]
		});
		assignProp(this, "shape", shape);
		return shape;
	} }));
}
function aborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue !== true) return true;
	return false;
}
function explicitlyAborted(x, startIndex = 0) {
	if (x.aborted === true) return true;
	for (let i = startIndex; i < x.issues.length; i++) if (x.issues[i]?.continue === false) return true;
	return false;
}
function prefixIssues(path, issues) {
	return issues.map((iss) => {
		var _a;
		(_a = iss).path ?? (_a.path = []);
		iss.path.unshift(path);
		return iss;
	});
}
function unwrapMessage(message) {
	return typeof message === "string" ? message : message?.message;
}
function finalizeIssue(iss, ctx, config) {
	const message = iss.message ? iss.message : unwrapMessage(iss.inst?._zod.def?.error?.(iss)) ?? unwrapMessage(ctx?.error?.(iss)) ?? unwrapMessage(config.customError?.(iss)) ?? unwrapMessage(config.localeError?.(iss)) ?? "Invalid input";
	const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
	rest.path ?? (rest.path = []);
	rest.message = message;
	if (ctx?.reportInput) rest.input = _input;
	return rest;
}
function getLengthableOrigin(input) {
	if (Array.isArray(input)) return "array";
	if (typeof input === "string") return "string";
	return "unknown";
}
function issue(...args) {
	const [iss, input, inst] = args;
	if (typeof iss === "string") return {
		message: iss,
		code: "custom",
		input,
		inst
	};
	return { ...iss };
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/errors.js
const initializer$1 = (inst, def) => {
	inst.name = "$ZodError";
	Object.defineProperty(inst, "_zod", {
		value: inst._zod,
		enumerable: false
	});
	Object.defineProperty(inst, "issues", {
		value: def,
		enumerable: false
	});
	inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
	Object.defineProperty(inst, "toString", {
		value: () => inst.message,
		enumerable: false
	});
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue) => issue.message) {
	const fieldErrors = {};
	const formErrors = [];
	for (const sub of error.issues) if (sub.path.length > 0) {
		fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
		fieldErrors[sub.path[0]].push(mapper(sub));
	} else formErrors.push(mapper(sub));
	return {
		formErrors,
		fieldErrors
	};
}
function formatError(error, mapper = (issue) => issue.message) {
	const fieldErrors = { _errors: [] };
	const processError = (error, path = []) => {
		for (const issue of error.issues) if (issue.code === "invalid_union" && issue.errors.length) issue.errors.map((issues) => processError({ issues }, [...path, ...issue.path]));
		else if (issue.code === "invalid_key") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else if (issue.code === "invalid_element") processError({ issues: issue.issues }, [...path, ...issue.path]);
		else {
			const fullpath = [...path, ...issue.path];
			if (fullpath.length === 0) fieldErrors._errors.push(mapper(issue));
			else {
				let curr = fieldErrors;
				let i = 0;
				while (i < fullpath.length) {
					const el = fullpath[i];
					if (!(i === fullpath.length - 1)) curr[el] = curr[el] || { _errors: [] };
					else {
						curr[el] = curr[el] || { _errors: [] };
						curr[el]._errors.push(mapper(issue));
					}
					curr = curr[el];
					i++;
				}
			}
		}
	};
	processError(error);
	return fieldErrors;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/parse.js
const _parse = (_Err) => (schema, value, _ctx, _params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	if (result.issues.length) {
		const e = new (_params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, _params?.callee);
		throw e;
	}
	return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	if (result.issues.length) {
		const e = new (params?.Err ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
		captureStackTrace(e, params?.callee);
		throw e;
	}
	return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: false
	} : { async: false };
	const result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) throw new $ZodAsyncError();
	return result.issues.length ? {
		success: false,
		error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		async: true
	} : { async: true };
	let result = schema._zod.run({
		value,
		issues: []
	}, ctx);
	if (result instanceof Promise) result = await result;
	return result.issues.length ? {
		success: false,
		error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	} : {
		success: true,
		data: result.value
	};
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
	return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
	return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
	const ctx = _ctx ? {
		..._ctx,
		direction: "backward"
	} : { direction: "backward" };
	return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
	return _safeParseAsync(_Err)(schema, value, _ctx);
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/regexes.js
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
/** ISO 8601-1 duration regex. Does not support the 8601-2 extensions like negative durations or fractional/negative components. */
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
/** A regex for any UUID-like identifier: 8-4-4-4-12 hex pattern */
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
/** Returns a regex for validating an RFC 9562/4122 UUID.
*
* @param version Optionally specify a version 1-8. If no version is specified, all versions are supported. */
const uuid = (version) => {
	if (!version) return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
	return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
/** Practical email validation */
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
	return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
	const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
	return typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
}
function time$1(args) {
	return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
	const time = timeSource({ precision: args.precision });
	const opts = ["Z"];
	if (args.local) opts.push("");
	if (args.offset) opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
	const timeRegex = `${time}(?:${opts.join("|")})`;
	return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
	const regex = params ? `[\\s\\S]{${params?.minimum ?? 0},${params?.maximum ?? ""}}` : `[\\s\\S]*`;
	return new RegExp(`^${regex}$`);
};
const number = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/checks.js
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
	var _a;
	inst._zod ?? (inst._zod = {});
	inst._zod.def = def;
	(_a = inst._zod).onattach ?? (_a.onattach = []);
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
		if (def.maximum < curr) inst._zod.bag.maximum = def.maximum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length <= def.maximum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_big",
			maximum: def.maximum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const curr = inst._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
		if (def.minimum > curr) inst._zod.bag.minimum = def.minimum;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		if (input.length >= def.minimum) return;
		const origin = getLengthableOrigin(input);
		payload.issues.push({
			origin,
			code: "too_small",
			minimum: def.minimum,
			inclusive: true,
			input,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
	var _a;
	$ZodCheck.init(inst, def);
	(_a = inst._zod.def).when ?? (_a.when = (payload) => {
		const val = payload.value;
		return !nullish(val) && val.length !== void 0;
	});
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.minimum = def.length;
		bag.maximum = def.length;
		bag.length = def.length;
	});
	inst._zod.check = (payload) => {
		const input = payload.value;
		const length = input.length;
		if (length === def.length) return;
		const origin = getLengthableOrigin(input);
		const tooBig = length > def.length;
		payload.issues.push({
			origin,
			...tooBig ? {
				code: "too_big",
				maximum: def.length
			} : {
				code: "too_small",
				minimum: def.length
			},
			inclusive: true,
			exact: true,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
	var _a, _b;
	$ZodCheck.init(inst, def);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.format = def.format;
		if (def.pattern) {
			bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
			bag.patterns.add(def.pattern);
		}
	});
	if (def.pattern) (_a = inst._zod).check ?? (_a.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: def.format,
			input: payload.value,
			...def.pattern ? { pattern: def.pattern.toString() } : {},
			inst,
			continue: !def.abort
		});
	});
	else (_b = inst._zod).check ?? (_b.check = () => {});
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		def.pattern.lastIndex = 0;
		if (def.pattern.test(payload.value)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "regex",
			input: payload.value,
			pattern: def.pattern.toString(),
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
	def.pattern ?? (def.pattern = lowercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
	def.pattern ?? (def.pattern = uppercase);
	$ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
	$ZodCheck.init(inst, def);
	const escapedRegex = escapeRegex(def.includes);
	const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
	def.pattern = pattern;
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.includes(def.includes, def.position)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "includes",
			includes: def.includes,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.startsWith(def.prefix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "starts_with",
			prefix: def.prefix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
	$ZodCheck.init(inst, def);
	const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
	def.pattern ?? (def.pattern = pattern);
	inst._zod.onattach.push((inst) => {
		const bag = inst._zod.bag;
		bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
		bag.patterns.add(pattern);
	});
	inst._zod.check = (payload) => {
		if (payload.value.endsWith(def.suffix)) return;
		payload.issues.push({
			origin: "string",
			code: "invalid_format",
			format: "ends_with",
			suffix: def.suffix,
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
	$ZodCheck.init(inst, def);
	inst._zod.check = (payload) => {
		payload.value = def.tx(payload.value);
	};
});
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/doc.js
var Doc = class {
	constructor(args = []) {
		this.content = [];
		this.indent = 0;
		if (this) this.args = args;
	}
	indented(fn) {
		this.indent += 1;
		fn(this);
		this.indent -= 1;
	}
	write(arg) {
		if (typeof arg === "function") {
			arg(this, { execution: "sync" });
			arg(this, { execution: "async" });
			return;
		}
		const lines = arg.split("\n").filter((x) => x);
		const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
		const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
		for (const line of dedented) this.content.push(line);
	}
	compile() {
		const F = Function;
		const args = this?.args;
		const lines = [...(this?.content ?? [``]).map((x) => `  ${x}`)];
		return new F(...args, lines.join("\n"));
	}
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/versions.js
const version = {
	major: 4,
	minor: 4,
	patch: 2
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/schemas.js
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
	var _a;
	inst ?? (inst = {});
	inst._zod.def = def;
	inst._zod.bag = inst._zod.bag || {};
	inst._zod.version = version;
	const checks = [...inst._zod.def.checks ?? []];
	if (inst._zod.traits.has("$ZodCheck")) checks.unshift(inst);
	for (const ch of checks) for (const fn of ch._zod.onattach) fn(inst);
	if (checks.length === 0) {
		(_a = inst._zod).deferred ?? (_a.deferred = []);
		inst._zod.deferred?.push(() => {
			inst._zod.run = inst._zod.parse;
		});
	} else {
		const runChecks = (payload, checks, ctx) => {
			let isAborted = aborted(payload);
			let asyncResult;
			for (const ch of checks) {
				if (ch._zod.def.when) {
					if (explicitlyAborted(payload)) continue;
					if (!ch._zod.def.when(payload)) continue;
				} else if (isAborted) continue;
				const currLen = payload.issues.length;
				const _ = ch._zod.check(payload);
				if (_ instanceof Promise && ctx?.async === false) throw new $ZodAsyncError();
				if (asyncResult || _ instanceof Promise) asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
					await _;
					if (payload.issues.length === currLen) return;
					if (!isAborted) isAborted = aborted(payload, currLen);
				});
				else {
					if (payload.issues.length === currLen) continue;
					if (!isAborted) isAborted = aborted(payload, currLen);
				}
			}
			if (asyncResult) return asyncResult.then(() => {
				return payload;
			});
			return payload;
		};
		const handleCanaryResult = (canary, payload, ctx) => {
			if (aborted(canary)) {
				canary.aborted = true;
				return canary;
			}
			const checkResult = runChecks(payload, checks, ctx);
			if (checkResult instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return checkResult.then((checkResult) => inst._zod.parse(checkResult, ctx));
			}
			return inst._zod.parse(checkResult, ctx);
		};
		inst._zod.run = (payload, ctx) => {
			if (ctx.skipChecks) return inst._zod.parse(payload, ctx);
			if (ctx.direction === "backward") {
				const canary = inst._zod.parse({
					value: payload.value,
					issues: []
				}, {
					...ctx,
					skipChecks: true
				});
				if (canary instanceof Promise) return canary.then((canary) => {
					return handleCanaryResult(canary, payload, ctx);
				});
				return handleCanaryResult(canary, payload, ctx);
			}
			const result = inst._zod.parse(payload, ctx);
			if (result instanceof Promise) {
				if (ctx.async === false) throw new $ZodAsyncError();
				return result.then((result) => runChecks(result, checks, ctx));
			}
			return runChecks(result, checks, ctx);
		};
	}
	defineLazy(inst, "~standard", () => ({
		validate: (value) => {
			try {
				const r = safeParse$1(inst, value);
				return r.success ? { value: r.data } : { issues: r.error?.issues };
			} catch (_) {
				return safeParseAsync$1(inst, value).then((r) => r.success ? { value: r.data } : { issues: r.error?.issues });
			}
		},
		vendor: "zod",
		version: 1
	}));
});
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = [...inst?._zod.bag?.patterns ?? []].pop() ?? string$1(inst._zod.bag);
	inst._zod.parse = (payload, _) => {
		if (def.coerce) try {
			payload.value = String(payload.value);
		} catch (_) {}
		if (typeof payload.value === "string") return payload;
		payload.issues.push({
			expected: "string",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
	$ZodCheckStringFormat.init(inst, def);
	$ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
	def.pattern ?? (def.pattern = guid);
	$ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
	if (def.version) {
		const v = {
			v1: 1,
			v2: 2,
			v3: 3,
			v4: 4,
			v5: 5,
			v6: 6,
			v7: 7,
			v8: 8
		}[def.version];
		if (v === void 0) throw new Error(`Invalid UUID version: "${def.version}"`);
		def.pattern ?? (def.pattern = uuid(v));
	} else def.pattern ?? (def.pattern = uuid());
	$ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
	def.pattern ?? (def.pattern = email);
	$ZodStringFormat.init(inst, def);
});
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		try {
			const trimmed = payload.value.trim();
			if (!def.normalize && def.protocol?.source === httpProtocol.source) {
				if (!/^https?:\/\//i.test(trimmed)) {
					payload.issues.push({
						code: "invalid_format",
						format: "url",
						note: "Invalid URL format",
						input: payload.value,
						inst,
						continue: !def.abort
					});
					return;
				}
			}
			const url = new URL(trimmed);
			if (def.hostname) {
				def.hostname.lastIndex = 0;
				if (!def.hostname.test(url.hostname)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid hostname",
					pattern: def.hostname.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.protocol) {
				def.protocol.lastIndex = 0;
				if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) payload.issues.push({
					code: "invalid_format",
					format: "url",
					note: "Invalid protocol",
					pattern: def.protocol.source,
					input: payload.value,
					inst,
					continue: !def.abort
				});
			}
			if (def.normalize) payload.value = url.href;
			else payload.value = trimmed;
			return;
		} catch (_) {
			payload.issues.push({
				code: "invalid_format",
				format: "url",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
	def.pattern ?? (def.pattern = emoji());
	$ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
	def.pattern ?? (def.pattern = nanoid);
	$ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link $ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
	def.pattern ?? (def.pattern = cuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
	def.pattern ?? (def.pattern = cuid2);
	$ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
	def.pattern ?? (def.pattern = ulid);
	$ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
	def.pattern ?? (def.pattern = xid);
	$ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
	def.pattern ?? (def.pattern = ksuid);
	$ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
	def.pattern ?? (def.pattern = datetime$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
	def.pattern ?? (def.pattern = date$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
	def.pattern ?? (def.pattern = time$1(def));
	$ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
	def.pattern ?? (def.pattern = duration$1);
	$ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
	def.pattern ?? (def.pattern = ipv4);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
	def.pattern ?? (def.pattern = ipv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.format = `ipv6`;
	inst._zod.check = (payload) => {
		try {
			new URL(`http://[${payload.value}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "ipv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv4);
	$ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
	def.pattern ?? (def.pattern = cidrv6);
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		const parts = payload.value.split("/");
		try {
			if (parts.length !== 2) throw new Error();
			const [address, prefix] = parts;
			if (!prefix) throw new Error();
			const prefixNum = Number(prefix);
			if (`${prefixNum}` !== prefix) throw new Error();
			if (prefixNum < 0 || prefixNum > 128) throw new Error();
			new URL(`http://[${address}]`);
		} catch {
			payload.issues.push({
				code: "invalid_format",
				format: "cidrv6",
				input: payload.value,
				inst,
				continue: !def.abort
			});
		}
	};
});
function isValidBase64(data) {
	if (data === "") return true;
	if (/\s/.test(data)) return false;
	if (data.length % 4 !== 0) return false;
	try {
		atob(data);
		return true;
	} catch {
		return false;
	}
}
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
	def.pattern ?? (def.pattern = base64);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64";
	inst._zod.check = (payload) => {
		if (isValidBase64(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
function isValidBase64URL(data) {
	if (!base64url.test(data)) return false;
	const base64 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
	return isValidBase64(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
	def.pattern ?? (def.pattern = base64url);
	$ZodStringFormat.init(inst, def);
	inst._zod.bag.contentEncoding = "base64url";
	inst._zod.check = (payload) => {
		if (isValidBase64URL(payload.value)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "base64url",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
	def.pattern ?? (def.pattern = e164);
	$ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
	try {
		const tokensParts = token.split(".");
		if (tokensParts.length !== 3) return false;
		const [header] = tokensParts;
		if (!header) return false;
		const parsedHeader = JSON.parse(atob(header));
		if ("typ" in parsedHeader && parsedHeader?.typ !== "JWT") return false;
		if (!parsedHeader.alg) return false;
		if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm)) return false;
		return true;
	} catch {
		return false;
	}
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	inst._zod.check = (payload) => {
		if (isValidJWT(payload.value, def.alg)) return;
		payload.issues.push({
			code: "invalid_format",
			format: "jwt",
			input: payload.value,
			inst,
			continue: !def.abort
		});
	};
});
const $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.pattern = boolean$1;
	inst._zod.parse = (payload, _ctx) => {
		if (def.coerce) try {
			payload.value = Boolean(payload.value);
		} catch (_) {}
		const input = payload.value;
		if (typeof input === "boolean") return payload;
		payload.issues.push({
			expected: "boolean",
			code: "invalid_type",
			input,
			inst
		});
		return payload;
	};
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _ctx) => {
		payload.issues.push({
			expected: "never",
			code: "invalid_type",
			input: payload.value,
			inst
		});
		return payload;
	};
});
function handleArrayResult(result, final, index) {
	if (result.issues.length) final.issues.push(...prefixIssues(index, result.issues));
	final.value[index] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!Array.isArray(input)) {
			payload.issues.push({
				expected: "array",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = Array(input.length);
		const proms = [];
		for (let i = 0; i < input.length; i++) {
			const item = input[i];
			const result = def.element._zod.run({
				value: item,
				issues: []
			}, ctx);
			if (result instanceof Promise) proms.push(result.then((result) => handleArrayResult(result, payload, i)));
			else handleArrayResult(result, payload, i);
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
	const isPresent = key in input;
	if (result.issues.length) {
		if (isOptionalIn && isOptionalOut && !isPresent) return;
		final.issues.push(...prefixIssues(key, result.issues));
	}
	if (!isPresent && !isOptionalIn) {
		if (!result.issues.length) final.issues.push({
			code: "invalid_type",
			expected: "nonoptional",
			input: void 0,
			path: [key]
		});
		return;
	}
	if (result.value === void 0) {
		if (isPresent) final.value[key] = void 0;
	} else final.value[key] = result.value;
}
function normalizeDef(def) {
	const keys = Object.keys(def.shape);
	for (const k of keys) if (!def.shape?.[k]?._zod?.traits?.has("$ZodType")) throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
	const okeys = optionalKeys(def.shape);
	return {
		...def,
		keys,
		keySet: new Set(keys),
		numKeys: keys.length,
		optionalKeys: new Set(okeys)
	};
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
	const unrecognized = [];
	const keySet = def.keySet;
	const _catchall = def.catchall._zod;
	const t = _catchall.def.type;
	const isOptionalIn = _catchall.optin === "optional";
	const isOptionalOut = _catchall.optout === "optional";
	for (const key in input) {
		if (key === "__proto__") continue;
		if (keySet.has(key)) continue;
		if (t === "never") {
			unrecognized.push(key);
			continue;
		}
		const r = _catchall.run({
			value: input[key],
			issues: []
		}, ctx);
		if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
		else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
	}
	if (unrecognized.length) payload.issues.push({
		code: "unrecognized_keys",
		keys: unrecognized,
		input,
		inst
	});
	if (!proms.length) return payload;
	return Promise.all(proms).then(() => {
		return payload;
	});
}
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
	$ZodType.init(inst, def);
	if (!Object.getOwnPropertyDescriptor(def, "shape")?.get) {
		const sh = def.shape;
		Object.defineProperty(def, "shape", { get: () => {
			const newSh = { ...sh };
			Object.defineProperty(def, "shape", { value: newSh });
			return newSh;
		} });
	}
	const _normalized = cached(() => normalizeDef(def));
	defineLazy(inst._zod, "propValues", () => {
		const shape = def.shape;
		const propValues = {};
		for (const key in shape) {
			const field = shape[key]._zod;
			if (field.values) {
				propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
				for (const v of field.values) propValues[key].add(v);
			}
		}
		return propValues;
	});
	const isObject$1 = isObject;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$1(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		payload.value = {};
		const proms = [];
		const shape = value.shape;
		for (const key of value.keys) {
			const el = shape[key];
			const isOptionalIn = el._zod.optin === "optional";
			const isOptionalOut = el._zod.optout === "optional";
			const r = el._zod.run({
				value: input[key],
				issues: []
			}, ctx);
			if (r instanceof Promise) proms.push(r.then((r) => handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut)));
			else handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
		}
		if (!catchall) return proms.length ? Promise.all(proms).then(() => payload) : payload;
		return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
	};
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
	$ZodObject.init(inst, def);
	const superParse = inst._zod.parse;
	const _normalized = cached(() => normalizeDef(def));
	const generateFastpass = (shape) => {
		const doc = new Doc([
			"shape",
			"payload",
			"ctx"
		]);
		const normalized = _normalized.value;
		const parseStr = (key) => {
			const k = esc(key);
			return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
		};
		doc.write(`const input = payload.value;`);
		const ids = Object.create(null);
		let counter = 0;
		for (const key of normalized.keys) ids[key] = `key_${counter++}`;
		doc.write(`const newResult = {};`);
		for (const key of normalized.keys) {
			const id = ids[key];
			const k = esc(key);
			const schema = shape[key];
			const isOptionalIn = schema?._zod?.optin === "optional";
			const isOptionalOut = schema?._zod?.optout === "optional";
			doc.write(`const ${id} = ${parseStr(key)};`);
			if (isOptionalIn && isOptionalOut) doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
			else if (!isOptionalIn) doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
			else doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        
        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }
        
      `);
		}
		doc.write(`payload.value = newResult;`);
		doc.write(`return payload;`);
		const fn = doc.compile();
		return (payload, ctx) => fn(shape, payload, ctx);
	};
	let fastpass;
	const isObject$2 = isObject;
	const jit = !globalConfig.jitless;
	const fastEnabled = jit && allowsEval.value;
	const catchall = def.catchall;
	let value;
	inst._zod.parse = (payload, ctx) => {
		value ?? (value = _normalized.value);
		const input = payload.value;
		if (!isObject$2(input)) {
			payload.issues.push({
				expected: "object",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		if (jit && fastEnabled && ctx?.async === false && ctx.jitless !== true) {
			if (!fastpass) fastpass = generateFastpass(def.shape);
			payload = fastpass(payload, ctx);
			if (!catchall) return payload;
			return handleCatchall([], input, payload, ctx, value, inst);
		}
		return superParse(payload, ctx);
	};
});
function handleUnionResults(results, final, inst, ctx) {
	for (const result of results) if (result.issues.length === 0) {
		final.value = result.value;
		return final;
	}
	const nonaborted = results.filter((r) => !aborted(r));
	if (nonaborted.length === 1) {
		final.value = nonaborted[0].value;
		return nonaborted[0];
	}
	final.issues.push({
		code: "invalid_union",
		input: final.value,
		inst,
		errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
	});
	return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
	defineLazy(inst._zod, "values", () => {
		if (def.options.every((o) => o._zod.values)) return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
	});
	defineLazy(inst._zod, "pattern", () => {
		if (def.options.every((o) => o._zod.pattern)) {
			const patterns = def.options.map((o) => o._zod.pattern);
			return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
		}
	});
	const first = def.options.length === 1 ? def.options[0]._zod.run : null;
	inst._zod.parse = (payload, ctx) => {
		if (first) return first(payload, ctx);
		let async = false;
		const results = [];
		for (const option of def.options) {
			const result = option._zod.run({
				value: payload.value,
				issues: []
			}, ctx);
			if (result instanceof Promise) {
				results.push(result);
				async = true;
			} else {
				if (result.issues.length === 0) return result;
				results.push(result);
			}
		}
		if (!async) return handleUnionResults(results, payload, inst, ctx);
		return Promise.all(results).then((results) => {
			return handleUnionResults(results, payload, inst, ctx);
		});
	};
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		const left = def.left._zod.run({
			value: input,
			issues: []
		}, ctx);
		const right = def.right._zod.run({
			value: input,
			issues: []
		}, ctx);
		if (left instanceof Promise || right instanceof Promise) return Promise.all([left, right]).then(([left, right]) => {
			return handleIntersectionResults(payload, left, right);
		});
		return handleIntersectionResults(payload, left, right);
	};
});
function mergeValues(a, b) {
	if (a === b) return {
		valid: true,
		data: a
	};
	if (a instanceof Date && b instanceof Date && +a === +b) return {
		valid: true,
		data: a
	};
	if (isPlainObject(a) && isPlainObject(b)) {
		const bKeys = Object.keys(b);
		const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
		const newObj = {
			...a,
			...b
		};
		for (const key of sharedKeys) {
			const sharedValue = mergeValues(a[key], b[key]);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
			};
			newObj[key] = sharedValue.data;
		}
		return {
			valid: true,
			data: newObj
		};
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return {
			valid: false,
			mergeErrorPath: []
		};
		const newArray = [];
		for (let index = 0; index < a.length; index++) {
			const itemA = a[index];
			const itemB = b[index];
			const sharedValue = mergeValues(itemA, itemB);
			if (!sharedValue.valid) return {
				valid: false,
				mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
			};
			newArray.push(sharedValue.data);
		}
		return {
			valid: true,
			data: newArray
		};
	}
	return {
		valid: false,
		mergeErrorPath: []
	};
}
function handleIntersectionResults(result, left, right) {
	const unrecKeys = /* @__PURE__ */ new Map();
	let unrecIssue;
	for (const iss of left.issues) if (iss.code === "unrecognized_keys") {
		unrecIssue ?? (unrecIssue = iss);
		for (const k of iss.keys) {
			if (!unrecKeys.has(k)) unrecKeys.set(k, {});
			unrecKeys.get(k).l = true;
		}
	} else result.issues.push(iss);
	for (const iss of right.issues) if (iss.code === "unrecognized_keys") for (const k of iss.keys) {
		if (!unrecKeys.has(k)) unrecKeys.set(k, {});
		unrecKeys.get(k).r = true;
	}
	else result.issues.push(iss);
	const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
	if (bothKeys.length && unrecIssue) result.issues.push({
		...unrecIssue,
		keys: bothKeys
	});
	if (aborted(result)) return result;
	const merged = mergeValues(left.value, right.value);
	if (!merged.valid) throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
	result.value = merged.data;
	return result;
}
const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		const input = payload.value;
		if (!isPlainObject(input)) {
			payload.issues.push({
				expected: "record",
				code: "invalid_type",
				input,
				inst
			});
			return payload;
		}
		const proms = [];
		const values = def.keyType._zod.values;
		if (values) {
			payload.value = {};
			const recordKeys = /* @__PURE__ */ new Set();
			for (const key of values) if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
				recordKeys.add(typeof key === "number" ? key.toString() : key);
				const keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (keyResult.issues.length) {
					payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const outKey = keyResult.value;
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[outKey] = result.value;
				}
			}
			let unrecognized;
			for (const key in input) if (!recordKeys.has(key)) {
				unrecognized = unrecognized ?? [];
				unrecognized.push(key);
			}
			if (unrecognized && unrecognized.length > 0) payload.issues.push({
				code: "unrecognized_keys",
				input,
				inst,
				keys: unrecognized
			});
		} else {
			payload.value = {};
			for (const key of Reflect.ownKeys(input)) {
				if (key === "__proto__") continue;
				if (!Object.prototype.propertyIsEnumerable.call(input, key)) continue;
				let keyResult = def.keyType._zod.run({
					value: key,
					issues: []
				}, ctx);
				if (keyResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
				if (typeof key === "string" && number.test(key) && keyResult.issues.length) {
					const retryResult = def.keyType._zod.run({
						value: Number(key),
						issues: []
					}, ctx);
					if (retryResult instanceof Promise) throw new Error("Async schemas not supported in object keys currently");
					if (retryResult.issues.length === 0) keyResult = retryResult;
				}
				if (keyResult.issues.length) {
					if (def.mode === "loose") payload.value[key] = input[key];
					else payload.issues.push({
						code: "invalid_key",
						origin: "record",
						issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
						input: key,
						path: [key],
						inst
					});
					continue;
				}
				const result = def.valueType._zod.run({
					value: input[key],
					issues: []
				}, ctx);
				if (result instanceof Promise) proms.push(result.then((result) => {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}));
				else {
					if (result.issues.length) payload.issues.push(...prefixIssues(key, result.issues));
					payload.value[keyResult.value] = result.value;
				}
			}
		}
		if (proms.length) return Promise.all(proms).then(() => payload);
		return payload;
	};
});
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
	$ZodType.init(inst, def);
	const values = getEnumValues(def.entries);
	const valuesSet = new Set(values);
	inst._zod.values = valuesSet;
	inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
	inst._zod.parse = (payload, _ctx) => {
		const input = payload.value;
		if (valuesSet.has(input)) return payload;
		payload.issues.push({
			code: "invalid_value",
			values,
			input,
			inst
		});
		return payload;
	};
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		const _out = def.transform(payload.value, payload);
		if (ctx.async) return (_out instanceof Promise ? _out : Promise.resolve(_out)).then((output) => {
			payload.value = output;
			return payload;
		});
		if (_out instanceof Promise) throw new $ZodAsyncError();
		payload.value = _out;
		return payload;
	};
});
function handleOptionalResult(result, input) {
	if (result.issues.length && input === void 0) return {
		issues: [],
		value: void 0
	};
	return result;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	inst._zod.optout = "optional";
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? new Set([...def.innerType._zod.values, void 0]) : void 0;
	});
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (def.innerType._zod.optin === "optional") {
			const result = def.innerType._zod.run(payload, ctx);
			if (result instanceof Promise) return result.then((r) => handleOptionalResult(r, payload.value));
			return handleOptionalResult(result, payload.value);
		}
		if (payload.value === void 0) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
	inst._zod.parse = (payload, ctx) => {
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "pattern", () => {
		const pattern = def.innerType._zod.pattern;
		return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
	});
	defineLazy(inst._zod, "values", () => {
		return def.innerType._zod.values ? new Set([...def.innerType._zod.values, null]) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		if (payload.value === null) return payload;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) {
			payload.value = def.defaultValue;
			/**
			* $ZodDefault returns the default value immediately in forward direction.
			* It doesn't pass the default value into the validator ("prefault"). There's no reason to pass the default value through validation. The validity of the default is enforced by TypeScript statically. Otherwise, it's the responsibility of the user to ensure the default is valid. In the case of pipes with divergent in/out types, you can specify the default on the `in` schema of your ZodPipe to set a "prefault" for the pipe.   */
			return payload;
		}
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleDefaultResult(result, def));
		return handleDefaultResult(result, def);
	};
});
function handleDefaultResult(payload, def) {
	if (payload.value === void 0) payload.value = def.defaultValue;
	return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
	$ZodType.init(inst, def);
	inst._zod.optin = "optional";
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		if (payload.value === void 0) payload.value = def.defaultValue;
		return def.innerType._zod.run(payload, ctx);
	};
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => {
		const v = def.innerType._zod.values;
		return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
	});
	inst._zod.parse = (payload, ctx) => {
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => handleNonOptionalResult(result, inst));
		return handleNonOptionalResult(result, inst);
	};
});
function handleNonOptionalResult(payload, inst) {
	if (!payload.issues.length && payload.value === void 0) payload.issues.push({
		code: "invalid_type",
		expected: "nonoptional",
		input: payload.value,
		inst
	});
	return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
	defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then((result) => {
			payload.value = result.value;
			if (result.issues.length) {
				payload.value = def.catchValue({
					...payload,
					error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
					input: payload.value
				});
				payload.issues = [];
			}
			return payload;
		});
		payload.value = result.value;
		if (result.issues.length) {
			payload.value = def.catchValue({
				...payload,
				error: { issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config())) },
				input: payload.value
			});
			payload.issues = [];
		}
		return payload;
	};
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "values", () => def.in._zod.values);
	defineLazy(inst._zod, "optin", () => def.in._zod.optin);
	defineLazy(inst._zod, "optout", () => def.out._zod.optout);
	defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") {
			const right = def.out._zod.run(payload, ctx);
			if (right instanceof Promise) return right.then((right) => handlePipeResult(right, def.in, ctx));
			return handlePipeResult(right, def.in, ctx);
		}
		const left = def.in._zod.run(payload, ctx);
		if (left instanceof Promise) return left.then((left) => handlePipeResult(left, def.out, ctx));
		return handlePipeResult(left, def.out, ctx);
	};
});
function handlePipeResult(left, next, ctx) {
	if (left.issues.length) {
		left.aborted = true;
		return left;
	}
	return next._zod.run({
		value: left.value,
		issues: left.issues
	}, ctx);
}
const $ZodPreprocess = /* @__PURE__ */ $constructor("$ZodPreprocess", (inst, def) => {
	$ZodPipe.init(inst, def);
	defineLazy(inst._zod, "optin", () => def.out._zod.optin);
	defineLazy(inst._zod, "optout", () => def.out._zod.optout);
});
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
	$ZodType.init(inst, def);
	defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
	defineLazy(inst._zod, "values", () => def.innerType._zod.values);
	defineLazy(inst._zod, "optin", () => def.innerType?._zod?.optin);
	defineLazy(inst._zod, "optout", () => def.innerType?._zod?.optout);
	inst._zod.parse = (payload, ctx) => {
		if (ctx.direction === "backward") return def.innerType._zod.run(payload, ctx);
		const result = def.innerType._zod.run(payload, ctx);
		if (result instanceof Promise) return result.then(handleReadonlyResult);
		return handleReadonlyResult(result);
	};
});
function handleReadonlyResult(payload) {
	payload.value = Object.freeze(payload.value);
	return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
	$ZodCheck.init(inst, def);
	$ZodType.init(inst, def);
	inst._zod.parse = (payload, _) => {
		return payload;
	};
	inst._zod.check = (payload) => {
		const input = payload.value;
		const r = def.fn(input);
		if (r instanceof Promise) return r.then((r) => handleRefineResult(r, payload, input, inst));
		handleRefineResult(r, payload, input, inst);
	};
});
function handleRefineResult(result, payload, input, inst) {
	if (!result) {
		const _iss = {
			code: "custom",
			input,
			inst,
			path: [...inst._zod.def.path ?? []],
			continue: !inst._zod.def.abort
		};
		if (inst._zod.def.params) _iss.params = inst._zod.def.params;
		payload.issues.push(issue(_iss));
	}
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/registries.js
var _a;
var $ZodRegistry = class {
	constructor() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
	}
	add(schema, ..._meta) {
		const meta = _meta[0];
		this._map.set(schema, meta);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.set(meta.id, schema);
		return this;
	}
	clear() {
		this._map = /* @__PURE__ */ new WeakMap();
		this._idmap = /* @__PURE__ */ new Map();
		return this;
	}
	remove(schema) {
		const meta = this._map.get(schema);
		if (meta && typeof meta === "object" && "id" in meta) this._idmap.delete(meta.id);
		this._map.delete(schema);
		return this;
	}
	get(schema) {
		const p = schema._zod.parent;
		if (p) {
			const pm = { ...this.get(p) ?? {} };
			delete pm.id;
			const f = {
				...pm,
				...this._map.get(schema)
			};
			return Object.keys(f).length ? f : void 0;
		}
		return this._map.get(schema);
	}
	has(schema) {
		return this._map.has(schema);
	}
};
function registry() {
	return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/api.js
/* @__NO_SIDE_EFFECTS__ */
function _string(Class, params) {
	return new Class({
		type: "string",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _email(Class, params) {
	return new Class({
		type: "string",
		format: "email",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _guid(Class, params) {
	return new Class({
		type: "string",
		format: "guid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuid(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv4(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v4",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv6(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v6",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uuidv7(Class, params) {
	return new Class({
		type: "string",
		format: "uuid",
		check: "string_format",
		abort: false,
		version: "v7",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _url(Class, params) {
	return new Class({
		type: "string",
		format: "url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _emoji(Class, params) {
	return new Class({
		type: "string",
		format: "emoji",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _nanoid(Class, params) {
	return new Class({
		type: "string",
		format: "nanoid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link _cuid2} instead.
* See https://github.com/paralleldrive/cuid.
*/
/* @__NO_SIDE_EFFECTS__ */
function _cuid(Class, params) {
	return new Class({
		type: "string",
		format: "cuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cuid2(Class, params) {
	return new Class({
		type: "string",
		format: "cuid2",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ulid(Class, params) {
	return new Class({
		type: "string",
		format: "ulid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _xid(Class, params) {
	return new Class({
		type: "string",
		format: "xid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ksuid(Class, params) {
	return new Class({
		type: "string",
		format: "ksuid",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ipv4(Class, params) {
	return new Class({
		type: "string",
		format: "ipv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _ipv6(Class, params) {
	return new Class({
		type: "string",
		format: "ipv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cidrv4(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv4",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _cidrv6(Class, params) {
	return new Class({
		type: "string",
		format: "cidrv6",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _base64(Class, params) {
	return new Class({
		type: "string",
		format: "base64",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _base64url(Class, params) {
	return new Class({
		type: "string",
		format: "base64url",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _e164(Class, params) {
	return new Class({
		type: "string",
		format: "e164",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _jwt(Class, params) {
	return new Class({
		type: "string",
		format: "jwt",
		check: "string_format",
		abort: false,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDateTime(Class, params) {
	return new Class({
		type: "string",
		format: "datetime",
		check: "string_format",
		offset: false,
		local: false,
		precision: null,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDate(Class, params) {
	return new Class({
		type: "string",
		format: "date",
		check: "string_format",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoTime(Class, params) {
	return new Class({
		type: "string",
		format: "time",
		check: "string_format",
		precision: null,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _isoDuration(Class, params) {
	return new Class({
		type: "string",
		format: "duration",
		check: "string_format",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _boolean(Class, params) {
	return new Class({
		type: "boolean",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _unknown(Class) {
	return new Class({ type: "unknown" });
}
/* @__NO_SIDE_EFFECTS__ */
function _never(Class, params) {
	return new Class({
		type: "never",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _maxLength(maximum, params) {
	return new $ZodCheckMaxLength({
		check: "max_length",
		...normalizeParams(params),
		maximum
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _minLength(minimum, params) {
	return new $ZodCheckMinLength({
		check: "min_length",
		...normalizeParams(params),
		minimum
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _length(length, params) {
	return new $ZodCheckLengthEquals({
		check: "length_equals",
		...normalizeParams(params),
		length
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _regex(pattern, params) {
	return new $ZodCheckRegex({
		check: "string_format",
		format: "regex",
		...normalizeParams(params),
		pattern
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _lowercase(params) {
	return new $ZodCheckLowerCase({
		check: "string_format",
		format: "lowercase",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _uppercase(params) {
	return new $ZodCheckUpperCase({
		check: "string_format",
		format: "uppercase",
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _includes(includes, params) {
	return new $ZodCheckIncludes({
		check: "string_format",
		format: "includes",
		...normalizeParams(params),
		includes
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _startsWith(prefix, params) {
	return new $ZodCheckStartsWith({
		check: "string_format",
		format: "starts_with",
		...normalizeParams(params),
		prefix
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _endsWith(suffix, params) {
	return new $ZodCheckEndsWith({
		check: "string_format",
		format: "ends_with",
		...normalizeParams(params),
		suffix
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _overwrite(tx) {
	return new $ZodCheckOverwrite({
		check: "overwrite",
		tx
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _normalize(form) {
	return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
/* @__NO_SIDE_EFFECTS__ */
function _trim() {
	return /* @__PURE__ */ _overwrite((input) => input.trim());
}
/* @__NO_SIDE_EFFECTS__ */
function _toLowerCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
/* @__NO_SIDE_EFFECTS__ */
function _toUpperCase() {
	return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
/* @__NO_SIDE_EFFECTS__ */
function _slugify() {
	return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
/* @__NO_SIDE_EFFECTS__ */
function _array(Class, element, params) {
	return new Class({
		type: "array",
		element,
		...normalizeParams(params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _refine(Class, fn, _params) {
	return new Class({
		type: "custom",
		check: "custom",
		fn,
		...normalizeParams(_params)
	});
}
/* @__NO_SIDE_EFFECTS__ */
function _superRefine(fn, params) {
	const ch = /* @__PURE__ */ _check((payload) => {
		payload.addIssue = (issue$2) => {
			if (typeof issue$2 === "string") payload.issues.push(issue(issue$2, payload.value, ch._zod.def));
			else {
				const _issue = issue$2;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = ch);
				_issue.continue ?? (_issue.continue = !ch._zod.def.abort);
				payload.issues.push(issue(_issue));
			}
		};
		return fn(payload.value, payload);
	}, params);
	return ch;
}
/* @__NO_SIDE_EFFECTS__ */
function _check(fn, params) {
	const ch = new $ZodCheck({
		check: "custom",
		...normalizeParams(params)
	});
	ch._zod.check = fn;
	return ch;
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/to-json-schema.js
function initializeContext(params) {
	let target = params?.target ?? "draft-2020-12";
	if (target === "draft-4") target = "draft-04";
	if (target === "draft-7") target = "draft-07";
	return {
		processors: params.processors ?? {},
		metadataRegistry: params?.metadata ?? globalRegistry,
		target,
		unrepresentable: params?.unrepresentable ?? "throw",
		override: params?.override ?? (() => {}),
		io: params?.io ?? "output",
		counter: 0,
		seen: /* @__PURE__ */ new Map(),
		cycles: params?.cycles ?? "ref",
		reused: params?.reused ?? "inline",
		external: params?.external ?? void 0
	};
}
function process$1(schema, ctx, _params = {
	path: [],
	schemaPath: []
}) {
	var _a;
	const def = schema._zod.def;
	const seen = ctx.seen.get(schema);
	if (seen) {
		seen.count++;
		if (_params.schemaPath.includes(schema)) seen.cycle = _params.path;
		return seen.schema;
	}
	const result = {
		schema: {},
		count: 1,
		cycle: void 0,
		path: _params.path
	};
	ctx.seen.set(schema, result);
	const overrideSchema = schema._zod.toJSONSchema?.();
	if (overrideSchema) result.schema = overrideSchema;
	else {
		const params = {
			..._params,
			schemaPath: [..._params.schemaPath, schema],
			path: _params.path
		};
		if (schema._zod.processJSONSchema) schema._zod.processJSONSchema(ctx, result.schema, params);
		else {
			const _json = result.schema;
			const processor = ctx.processors[def.type];
			if (!processor) throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
			processor(schema, ctx, _json, params);
		}
		const parent = schema._zod.parent;
		if (parent) {
			if (!result.ref) result.ref = parent;
			process$1(parent, ctx, params);
			ctx.seen.get(parent).isParent = true;
		}
	}
	const meta = ctx.metadataRegistry.get(schema);
	if (meta) Object.assign(result.schema, meta);
	if (ctx.io === "input" && isTransforming(schema)) {
		delete result.schema.examples;
		delete result.schema.default;
	}
	if (ctx.io === "input" && "_prefault" in result.schema) (_a = result.schema).default ?? (_a.default = result.schema._prefault);
	delete result.schema._prefault;
	return ctx.seen.get(schema).schema;
}
function extractDefs(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const idToSchema = /* @__PURE__ */ new Map();
	for (const entry of ctx.seen.entries()) {
		const id = ctx.metadataRegistry.get(entry[0])?.id;
		if (id) {
			const existing = idToSchema.get(id);
			if (existing && existing !== entry[0]) throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
			idToSchema.set(id, entry[0]);
		}
	}
	const makeURI = (entry) => {
		const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
		if (ctx.external) {
			const externalId = ctx.external.registry.get(entry[0])?.id;
			const uriGenerator = ctx.external.uri ?? ((id) => id);
			if (externalId) return { ref: uriGenerator(externalId) };
			const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
			entry[1].defId = id;
			return {
				defId: id,
				ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}`
			};
		}
		if (entry[1] === root) return { ref: "#" };
		const defUriPrefix = `#/${defsSegment}/`;
		const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
		return {
			defId,
			ref: defUriPrefix + defId
		};
	};
	const extractToDef = (entry) => {
		if (entry[1].schema.$ref) return;
		const seen = entry[1];
		const { ref, defId } = makeURI(entry);
		seen.def = { ...seen.schema };
		if (defId) seen.defId = defId;
		const schema = seen.schema;
		for (const key in schema) delete schema[key];
		schema.$ref = ref;
	};
	if (ctx.cycles === "throw") for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.cycle) throw new Error(`Cycle detected: #/${seen.cycle?.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
	}
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (schema === entry[0]) {
			extractToDef(entry);
			continue;
		}
		if (ctx.external) {
			const ext = ctx.external.registry.get(entry[0])?.id;
			if (schema !== entry[0] && ext) {
				extractToDef(entry);
				continue;
			}
		}
		if (ctx.metadataRegistry.get(entry[0])?.id) {
			extractToDef(entry);
			continue;
		}
		if (seen.cycle) {
			extractToDef(entry);
			continue;
		}
		if (seen.count > 1) {
			if (ctx.reused === "ref") {
				extractToDef(entry);
				continue;
			}
		}
	}
}
function finalize(ctx, schema) {
	const root = ctx.seen.get(schema);
	if (!root) throw new Error("Unprocessed schema. This is a bug in Zod.");
	const flattenRef = (zodSchema) => {
		const seen = ctx.seen.get(zodSchema);
		if (seen.ref === null) return;
		const schema = seen.def ?? seen.schema;
		const _cached = { ...schema };
		const ref = seen.ref;
		seen.ref = null;
		if (ref) {
			flattenRef(ref);
			const refSeen = ctx.seen.get(ref);
			const refSchema = refSeen.schema;
			if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
				schema.allOf = schema.allOf ?? [];
				schema.allOf.push(refSchema);
			} else Object.assign(schema, refSchema);
			Object.assign(schema, _cached);
			if (zodSchema._zod.parent === ref) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (!(key in _cached)) delete schema[key];
			}
			if (refSchema.$ref && refSeen.def) for (const key in schema) {
				if (key === "$ref" || key === "allOf") continue;
				if (key in refSeen.def && JSON.stringify(schema[key]) === JSON.stringify(refSeen.def[key])) delete schema[key];
			}
		}
		const parent = zodSchema._zod.parent;
		if (parent && parent !== ref) {
			flattenRef(parent);
			const parentSeen = ctx.seen.get(parent);
			if (parentSeen?.schema.$ref) {
				schema.$ref = parentSeen.schema.$ref;
				if (parentSeen.def) for (const key in schema) {
					if (key === "$ref" || key === "allOf") continue;
					if (key in parentSeen.def && JSON.stringify(schema[key]) === JSON.stringify(parentSeen.def[key])) delete schema[key];
				}
			}
		}
		ctx.override({
			zodSchema,
			jsonSchema: schema,
			path: seen.path ?? []
		});
	};
	for (const entry of [...ctx.seen.entries()].reverse()) flattenRef(entry[0]);
	const result = {};
	if (ctx.target === "draft-2020-12") result.$schema = "https://json-schema.org/draft/2020-12/schema";
	else if (ctx.target === "draft-07") result.$schema = "http://json-schema.org/draft-07/schema#";
	else if (ctx.target === "draft-04") result.$schema = "http://json-schema.org/draft-04/schema#";
	else if (ctx.target === "openapi-3.0") {}
	if (ctx.external?.uri) {
		const id = ctx.external.registry.get(schema)?.id;
		if (!id) throw new Error("Schema is missing an `id` property");
		result.$id = ctx.external.uri(id);
	}
	Object.assign(result, root.def ?? root.schema);
	const rootMetaId = ctx.metadataRegistry.get(schema)?.id;
	if (rootMetaId !== void 0 && result.id === rootMetaId) delete result.id;
	const defs = ctx.external?.defs ?? {};
	for (const entry of ctx.seen.entries()) {
		const seen = entry[1];
		if (seen.def && seen.defId) {
			if (seen.def.id === seen.defId) delete seen.def.id;
			defs[seen.defId] = seen.def;
		}
	}
	if (ctx.external) {} else if (Object.keys(defs).length > 0) if (ctx.target === "draft-2020-12") result.$defs = defs;
	else result.definitions = defs;
	try {
		const finalized = JSON.parse(JSON.stringify(result));
		Object.defineProperty(finalized, "~standard", {
			value: {
				...schema["~standard"],
				jsonSchema: {
					input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
					output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
				}
			},
			enumerable: false,
			writable: false
		});
		return finalized;
	} catch (_err) {
		throw new Error("Error converting schema to JSON.");
	}
}
function isTransforming(_schema, _ctx) {
	const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
	if (ctx.seen.has(_schema)) return false;
	ctx.seen.add(_schema);
	const def = _schema._zod.def;
	if (def.type === "transform") return true;
	if (def.type === "array") return isTransforming(def.element, ctx);
	if (def.type === "set") return isTransforming(def.valueType, ctx);
	if (def.type === "lazy") return isTransforming(def.getter(), ctx);
	if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") return isTransforming(def.innerType, ctx);
	if (def.type === "intersection") return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
	if (def.type === "record" || def.type === "map") return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
	if (def.type === "pipe") {
		if (_schema._zod.traits.has("$ZodCodec")) return true;
		return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
	}
	if (def.type === "object") {
		for (const key in def.shape) if (isTransforming(def.shape[key], ctx)) return true;
		return false;
	}
	if (def.type === "union") {
		for (const option of def.options) if (isTransforming(option, ctx)) return true;
		return false;
	}
	if (def.type === "tuple") {
		for (const item of def.items) if (isTransforming(item, ctx)) return true;
		if (def.rest && isTransforming(def.rest, ctx)) return true;
		return false;
	}
	return false;
}
/**
* Creates a toJSONSchema method for a schema instance.
* This encapsulates the logic of initializing context, processing, extracting defs, and finalizing.
*/
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
	const ctx = initializeContext({
		...params,
		processors
	});
	process$1(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
	const { libraryOptions, target } = params ?? {};
	const ctx = initializeContext({
		...libraryOptions ?? {},
		target,
		io,
		processors
	});
	process$1(schema, ctx);
	extractDefs(ctx, schema);
	return finalize(ctx, schema);
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/core/json-schema-processors.js
const formatMap = {
	guid: "uuid",
	url: "uri",
	datetime: "date-time",
	json_string: "json-string",
	regex: ""
};
const stringProcessor = (schema, ctx, _json, _params) => {
	const json = _json;
	json.type = "string";
	const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
	if (typeof minimum === "number") json.minLength = minimum;
	if (typeof maximum === "number") json.maxLength = maximum;
	if (format) {
		json.format = formatMap[format] ?? format;
		if (json.format === "") delete json.format;
		if (format === "time") delete json.format;
	}
	if (contentEncoding) json.contentEncoding = contentEncoding;
	if (patterns && patterns.size > 0) {
		const regexes = [...patterns];
		if (regexes.length === 1) json.pattern = regexes[0].source;
		else if (regexes.length > 1) json.allOf = [...regexes.map((regex) => ({
			...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
			pattern: regex.source
		}))];
	}
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
	json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
	json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {};
const enumProcessor = (schema, _ctx, json, _params) => {
	const def = schema._zod.def;
	const values = getEnumValues(def.entries);
	if (values.every((v) => typeof v === "number")) json.type = "number";
	if (values.every((v) => typeof v === "string")) json.type = "string";
	json.enum = values;
};
const customProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Custom types cannot be represented in JSON Schema");
};
const transformProcessor = (_schema, ctx, _json, _params) => {
	if (ctx.unrepresentable === "throw") throw new Error("Transforms cannot be represented in JSON Schema");
};
const arrayProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	const { minimum, maximum } = schema._zod.bag;
	if (typeof minimum === "number") json.minItems = minimum;
	if (typeof maximum === "number") json.maxItems = maximum;
	json.type = "array";
	json.items = process$1(def.element, ctx, {
		...params,
		path: [...params.path, "items"]
	});
};
const objectProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	json.properties = {};
	const shape = def.shape;
	for (const key in shape) json.properties[key] = process$1(shape[key], ctx, {
		...params,
		path: [
			...params.path,
			"properties",
			key
		]
	});
	const allKeys = new Set(Object.keys(shape));
	const requiredKeys = new Set([...allKeys].filter((key) => {
		const v = def.shape[key]._zod;
		if (ctx.io === "input") return v.optin === void 0;
		else return v.optout === void 0;
	}));
	if (requiredKeys.size > 0) json.required = Array.from(requiredKeys);
	if (def.catchall?._zod.def.type === "never") json.additionalProperties = false;
	else if (!def.catchall) {
		if (ctx.io === "output") json.additionalProperties = false;
	} else if (def.catchall) json.additionalProperties = process$1(def.catchall, ctx, {
		...params,
		path: [...params.path, "additionalProperties"]
	});
};
const unionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const isExclusive = def.inclusive === false;
	const options = def.options.map((x, i) => process$1(x, ctx, {
		...params,
		path: [
			...params.path,
			isExclusive ? "oneOf" : "anyOf",
			i
		]
	}));
	if (isExclusive) json.oneOf = options;
	else json.anyOf = options;
};
const intersectionProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const a = process$1(def.left, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			0
		]
	});
	const b = process$1(def.right, ctx, {
		...params,
		path: [
			...params.path,
			"allOf",
			1
		]
	});
	const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
	json.allOf = [...isSimpleIntersection(a) ? a.allOf : [a], ...isSimpleIntersection(b) ? b.allOf : [b]];
};
const recordProcessor = (schema, ctx, _json, params) => {
	const json = _json;
	const def = schema._zod.def;
	json.type = "object";
	const keyType = def.keyType;
	const patterns = keyType._zod.bag?.patterns;
	if (def.mode === "loose" && patterns && patterns.size > 0) {
		const valueSchema = process$1(def.valueType, ctx, {
			...params,
			path: [
				...params.path,
				"patternProperties",
				"*"
			]
		});
		json.patternProperties = {};
		for (const pattern of patterns) json.patternProperties[pattern.source] = valueSchema;
	} else {
		if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") json.propertyNames = process$1(def.keyType, ctx, {
			...params,
			path: [...params.path, "propertyNames"]
		});
		json.additionalProperties = process$1(def.valueType, ctx, {
			...params,
			path: [...params.path, "additionalProperties"]
		});
	}
	const keyValues = keyType._zod.values;
	if (keyValues) {
		const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
		if (validKeyValues.length > 0) json.required = validKeyValues;
	}
};
const nullableProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	const inner = process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	if (ctx.target === "openapi-3.0") {
		seen.ref = def.innerType;
		json.nullable = true;
	} else json.anyOf = [inner, { type: "null" }];
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	if (ctx.io === "input") json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	let catchValue;
	try {
		catchValue = def.catchValue(void 0);
	} catch {
		throw new Error("Dynamic catch values are not supported in JSON Schema");
	}
	json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	const inIsTransform = def.in._zod.traits.has("$ZodTransform");
	const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
	process$1(innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
	json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
	const def = schema._zod.def;
	process$1(def.innerType, ctx, params);
	const seen = ctx.seen.get(schema);
	seen.ref = def.innerType;
};
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/classic/iso.js
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
	$ZodISODateTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function datetime(params) {
	return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
	$ZodISODate.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function date(params) {
	return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
	$ZodISOTime.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function time(params) {
	return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
	$ZodISODuration.init(inst, def);
	ZodStringFormat.init(inst, def);
});
function duration(params) {
	return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/classic/errors.js
const initializer = (inst, issues) => {
	$ZodError.init(inst, issues);
	inst.name = "ZodError";
	Object.defineProperties(inst, {
		format: { value: (mapper) => formatError(inst, mapper) },
		flatten: { value: (mapper) => flattenError(inst, mapper) },
		addIssue: { value: (issue) => {
			inst.issues.push(issue);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		addIssues: { value: (issues) => {
			inst.issues.push(...issues);
			inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
		} },
		isEmpty: { get() {
			return inst.issues.length === 0;
		} }
	});
};
const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, { Parent: Error });
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/classic/parse.js
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
//#endregion
//#region ../../node_modules/.pnpm/zod@4.4.2/node_modules/zod/v4/classic/schemas.js
const _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
	const proto = Object.getPrototypeOf(inst);
	let installed = _installedGroups.get(proto);
	if (!installed) {
		installed = /* @__PURE__ */ new Set();
		_installedGroups.set(proto, installed);
	}
	if (installed.has(group)) return;
	installed.add(group);
	for (const key in methods) {
		const fn = methods[key];
		Object.defineProperty(proto, key, {
			configurable: true,
			enumerable: false,
			get() {
				const bound = fn.bind(this);
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: bound
				});
				return bound;
			},
			set(v) {
				Object.defineProperty(this, key, {
					configurable: true,
					writable: true,
					enumerable: true,
					value: v
				});
			}
		});
	}
}
const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
	$ZodType.init(inst, def);
	Object.assign(inst["~standard"], { jsonSchema: {
		input: createStandardJSONSchemaMethod(inst, "input"),
		output: createStandardJSONSchemaMethod(inst, "output")
	} });
	inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
	inst.def = def;
	inst.type = def.type;
	Object.defineProperty(inst, "_def", { value: def });
	inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
	inst.safeParse = (data, params) => safeParse(inst, data, params);
	inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
	inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
	inst.spa = inst.safeParseAsync;
	inst.encode = (data, params) => encode(inst, data, params);
	inst.decode = (data, params) => decode(inst, data, params);
	inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
	inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
	inst.safeEncode = (data, params) => safeEncode(inst, data, params);
	inst.safeDecode = (data, params) => safeDecode(inst, data, params);
	inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
	inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
	_installLazyMethods(inst, "ZodType", {
		check(...chks) {
			const def = this.def;
			return this.clone(mergeDefs(def, { checks: [...def.checks ?? [], ...chks.map((ch) => typeof ch === "function" ? { _zod: {
				check: ch,
				def: { check: "custom" },
				onattach: []
			} } : ch)] }), { parent: true });
		},
		with(...chks) {
			return this.check(...chks);
		},
		clone(def, params) {
			return clone(this, def, params);
		},
		brand() {
			return this;
		},
		register(reg, meta) {
			reg.add(this, meta);
			return this;
		},
		refine(check, params) {
			return this.check(refine(check, params));
		},
		superRefine(refinement, params) {
			return this.check(superRefine(refinement, params));
		},
		overwrite(fn) {
			return this.check(/* @__PURE__ */ _overwrite(fn));
		},
		optional() {
			return optional(this);
		},
		exactOptional() {
			return exactOptional(this);
		},
		nullable() {
			return nullable(this);
		},
		nullish() {
			return optional(nullable(this));
		},
		nonoptional(params) {
			return nonoptional(this, params);
		},
		array() {
			return array(this);
		},
		or(arg) {
			return union([this, arg]);
		},
		and(arg) {
			return intersection(this, arg);
		},
		transform(tx) {
			return pipe(this, transform(tx));
		},
		default(d) {
			return _default(this, d);
		},
		prefault(d) {
			return prefault(this, d);
		},
		catch(params) {
			return _catch(this, params);
		},
		pipe(target) {
			return pipe(this, target);
		},
		readonly() {
			return readonly(this);
		},
		describe(description) {
			const cl = this.clone();
			globalRegistry.add(cl, { description });
			return cl;
		},
		meta(...args) {
			if (args.length === 0) return globalRegistry.get(this);
			const cl = this.clone();
			globalRegistry.add(cl, args[0]);
			return cl;
		},
		isOptional() {
			return this.safeParse(void 0).success;
		},
		isNullable() {
			return this.safeParse(null).success;
		},
		apply(fn) {
			return fn(this);
		}
	});
	Object.defineProperty(inst, "description", {
		get() {
			return globalRegistry.get(inst)?.description;
		},
		configurable: true
	});
	return inst;
});
/** @internal */
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json, params);
	const bag = inst._zod.bag;
	inst.format = bag.format ?? null;
	inst.minLength = bag.minimum ?? null;
	inst.maxLength = bag.maximum ?? null;
	_installLazyMethods(inst, "_ZodString", {
		regex(...args) {
			return this.check(/* @__PURE__ */ _regex(...args));
		},
		includes(...args) {
			return this.check(/* @__PURE__ */ _includes(...args));
		},
		startsWith(...args) {
			return this.check(/* @__PURE__ */ _startsWith(...args));
		},
		endsWith(...args) {
			return this.check(/* @__PURE__ */ _endsWith(...args));
		},
		min(...args) {
			return this.check(/* @__PURE__ */ _minLength(...args));
		},
		max(...args) {
			return this.check(/* @__PURE__ */ _maxLength(...args));
		},
		length(...args) {
			return this.check(/* @__PURE__ */ _length(...args));
		},
		nonempty(...args) {
			return this.check(/* @__PURE__ */ _minLength(1, ...args));
		},
		lowercase(params) {
			return this.check(/* @__PURE__ */ _lowercase(params));
		},
		uppercase(params) {
			return this.check(/* @__PURE__ */ _uppercase(params));
		},
		trim() {
			return this.check(/* @__PURE__ */ _trim());
		},
		normalize(...args) {
			return this.check(/* @__PURE__ */ _normalize(...args));
		},
		toLowerCase() {
			return this.check(/* @__PURE__ */ _toLowerCase());
		},
		toUpperCase() {
			return this.check(/* @__PURE__ */ _toUpperCase());
		},
		slugify() {
			return this.check(/* @__PURE__ */ _slugify());
		}
	});
});
const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
	$ZodString.init(inst, def);
	_ZodString.init(inst, def);
	inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
	inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
	inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
	inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
	inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
	inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
	inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
	inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
	inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
	inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
	inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
	inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
	inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
	inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
	inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
	inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
	inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
	inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
	inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
	inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
	inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
	inst.datetime = (params) => inst.check(datetime(params));
	inst.date = (params) => inst.check(date(params));
	inst.time = (params) => inst.check(time(params));
	inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
	return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
	$ZodStringFormat.init(inst, def);
	_ZodString.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
	$ZodEmail.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
	$ZodGUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
	$ZodUUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
	$ZodURL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
	$ZodEmoji.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
	$ZodNanoID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
/**
* @deprecated CUID v1 is deprecated by its authors due to information leakage
* (timestamps embedded in the id). Use {@link ZodCUID2} instead.
* See https://github.com/paralleldrive/cuid.
*/
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
	$ZodCUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
	$ZodCUID2.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
	$ZodULID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
	$ZodXID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
	$ZodKSUID.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
	$ZodIPv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
	$ZodIPv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
	$ZodCIDRv4.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
	$ZodCIDRv6.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
	$ZodBase64.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
	$ZodBase64URL.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
	$ZodE164.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
	$ZodJWT.init(inst, def);
	ZodStringFormat.init(inst, def);
});
const ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
	$ZodBoolean.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json, params);
});
function boolean(params) {
	return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
	$ZodUnknown.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor(inst, ctx, json, params);
});
function unknown() {
	return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
	$ZodNever.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json, params);
});
function never(params) {
	return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
	$ZodArray.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
	inst.element = def.element;
	_installLazyMethods(inst, "ZodArray", {
		min(n, params) {
			return this.check(/* @__PURE__ */ _minLength(n, params));
		},
		nonempty(params) {
			return this.check(/* @__PURE__ */ _minLength(1, params));
		},
		max(n, params) {
			return this.check(/* @__PURE__ */ _maxLength(n, params));
		},
		length(n, params) {
			return this.check(/* @__PURE__ */ _length(n, params));
		},
		unwrap() {
			return this.element;
		}
	});
});
function array(element, params) {
	return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
	$ZodObjectJIT.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
	defineLazy(inst, "shape", () => {
		return def.shape;
	});
	_installLazyMethods(inst, "ZodObject", {
		keyof() {
			return _enum(Object.keys(this._zod.def.shape));
		},
		catchall(catchall) {
			return this.clone({
				...this._zod.def,
				catchall
			});
		},
		passthrough() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		loose() {
			return this.clone({
				...this._zod.def,
				catchall: unknown()
			});
		},
		strict() {
			return this.clone({
				...this._zod.def,
				catchall: never()
			});
		},
		strip() {
			return this.clone({
				...this._zod.def,
				catchall: void 0
			});
		},
		extend(incoming) {
			return extend(this, incoming);
		},
		safeExtend(incoming) {
			return safeExtend(this, incoming);
		},
		merge(other) {
			return merge(this, other);
		},
		pick(mask) {
			return pick(this, mask);
		},
		omit(mask) {
			return omit(this, mask);
		},
		partial(...args) {
			return partial(ZodOptional, this, args[0]);
		},
		required(...args) {
			return required(ZodNonOptional, this, args[0]);
		}
	});
});
function object(shape, params) {
	return new ZodObject({
		type: "object",
		shape: shape ?? {},
		...normalizeParams(params)
	});
}
const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
	$ZodUnion.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
	inst.options = def.options;
});
function union(options, params) {
	return new ZodUnion({
		type: "union",
		options,
		...normalizeParams(params)
	});
}
const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
	$ZodIntersection.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
	return new ZodIntersection({
		type: "intersection",
		left,
		right
	});
}
const ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
	$ZodRecord.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
	inst.keyType = def.keyType;
	inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
	if (!valueType || !valueType._zod) return new ZodRecord({
		type: "record",
		keyType: string(),
		valueType: keyType,
		...normalizeParams(valueType)
	});
	return new ZodRecord({
		type: "record",
		keyType,
		valueType,
		...normalizeParams(params)
	});
}
const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
	$ZodEnum.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json, params);
	inst.enum = def.entries;
	inst.options = Object.values(def.entries);
	const keys = new Set(Object.keys(def.entries));
	inst.extract = (values, params) => {
		const newEntries = {};
		for (const value of values) if (keys.has(value)) newEntries[value] = def.entries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
	inst.exclude = (values, params) => {
		const newEntries = { ...def.entries };
		for (const value of values) if (keys.has(value)) delete newEntries[value];
		else throw new Error(`Key ${value} not found in enum`);
		return new ZodEnum({
			...def,
			checks: [],
			...normalizeParams(params),
			entries: newEntries
		});
	};
});
function _enum(values, params) {
	return new ZodEnum({
		type: "enum",
		entries: Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values,
		...normalizeParams(params)
	});
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
	$ZodTransform.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx, json, params);
	inst._zod.parse = (payload, _ctx) => {
		if (_ctx.direction === "backward") throw new $ZodEncodeError(inst.constructor.name);
		payload.addIssue = (issue$1) => {
			if (typeof issue$1 === "string") payload.issues.push(issue(issue$1, payload.value, def));
			else {
				const _issue = issue$1;
				if (_issue.fatal) _issue.continue = false;
				_issue.code ?? (_issue.code = "custom");
				_issue.input ?? (_issue.input = payload.value);
				_issue.inst ?? (_issue.inst = inst);
				payload.issues.push(issue(_issue));
			}
		};
		const output = def.transform(payload.value, payload);
		if (output instanceof Promise) return output.then((output) => {
			payload.value = output;
			return payload;
		});
		payload.value = output;
		return payload;
	};
});
function transform(fn) {
	return new ZodTransform({
		type: "transform",
		transform: fn
	});
}
const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
	$ZodOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
	return new ZodOptional({
		type: "optional",
		innerType
	});
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
	$ZodExactOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
	return new ZodExactOptional({
		type: "optional",
		innerType
	});
}
const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
	$ZodNullable.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
	return new ZodNullable({
		type: "nullable",
		innerType
	});
}
const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
	$ZodDefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
	return new ZodDefault({
		type: "default",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
	$ZodPrefault.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
	return new ZodPrefault({
		type: "prefault",
		innerType,
		get defaultValue() {
			return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
		}
	});
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
	$ZodNonOptional.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
	return new ZodNonOptional({
		type: "nonoptional",
		innerType,
		...normalizeParams(params)
	});
}
const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
	$ZodCatch.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
	inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
	return new ZodCatch({
		type: "catch",
		innerType,
		catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
	});
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
	$ZodPipe.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
	inst.in = def.in;
	inst.out = def.out;
});
function pipe(in_, out) {
	return new ZodPipe({
		type: "pipe",
		in: in_,
		out
	});
}
const ZodPreprocess = /* @__PURE__ */ $constructor("ZodPreprocess", (inst, def) => {
	ZodPipe.init(inst, def);
	$ZodPreprocess.init(inst, def);
});
const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
	$ZodReadonly.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
	inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
	return new ZodReadonly({
		type: "readonly",
		innerType
	});
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
	$ZodCustom.init(inst, def);
	ZodType.init(inst, def);
	inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx, json, params);
});
function refine(fn, _params = {}) {
	return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
	return /* @__PURE__ */ _superRefine(fn, params);
}
function preprocess(fn, schema) {
	return new ZodPreprocess({
		type: "pipe",
		in: transform(fn),
		out: schema
	});
}
//#endregion
//#region src/config.ts
const ReplicaSchema = preprocess((value) => {
	if (value == null || typeof value !== "object" || Array.isArray(value)) return value;
	const replica = value;
	return {
		api_url: replica.api_url ?? replica.apiUrl,
		api_key: replica.api_key ?? replica.apiKey,
		project: replica.project ?? replica.projectName,
		updates: replica.updates
	};
}, object({
	api_url: string().optional(),
	api_key: string().optional(),
	project: string().optional(),
	updates: record(string(), unknown()).optional()
}));
const ConfigSchema = object({
	enabled: boolean(),
	api_key: string().optional(),
	api_url: string().optional(),
	project: string().optional(),
	metadata: record(string(), unknown()).optional(),
	replicas: array(ReplicaSchema).optional()
});
const PartialConfigSchema = ConfigSchema.partial();
function parseBoolean(value) {
	if (typeof value === "boolean") return value;
	if (typeof value !== "string") return void 0;
	const normalized = value.trim().toLowerCase();
	if ([
		"1",
		"true",
		"yes",
		"on"
	].includes(normalized)) return true;
	if ([
		"0",
		"false",
		"no",
		"off"
	].includes(normalized)) return false;
}
function parseJson(value) {
	if (typeof value !== "string") return void 0;
	if (value.trim().length === 0) return void 0;
	try {
		return JSON.parse(value);
	} catch (error) {
		return;
	}
}
const stripUndefined$1 = (value) => {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
};
async function readConfigFile(file) {
	try {
		const data = await nodeFsPromises.readFile(file, "utf-8");
		return PartialConfigSchema.parse(JSON.parse(data));
	} catch {
		return;
	}
}
function getVar(suffix, env) {
	return env[`LANGSMITH_CODEX_${suffix}`] ?? env[`LANGSMITH_${suffix}`];
}
const readConfigEnv = (env) => {
	const enabled = parseBoolean(env.TRACE_TO_LANGSMITH);
	return stripUndefined$1(PartialConfigSchema.parse({
		enabled,
		api_key: getVar("API_KEY", env),
		api_url: getVar("ENDPOINT", env),
		project: getVar("PROJECT", env),
		metadata: parseJson(getVar("METADATA", env)),
		replicas: parseJson(getVar("RUNS_ENDPOINTS", env))
	}));
};
const getHomeDir = () => process.env.HOME ?? os.homedir();
async function getConfig(options) {
	const home = options?.home ?? getHomeDir();
	const cwd = options?.cwd ?? process.cwd();
	const envConfig = readConfigEnv(options?.env ?? process.env);
	const [globalConfig, localConfig] = await Promise.all([readConfigFile(nodePath.join(home, ".codex", "langsmith.json")), readConfigFile(nodePath.join(cwd, ".codex", "langsmith.json"))]);
	return ConfigSchema.parse({
		project: "codex",
		enabled: false,
		...globalConfig,
		...localConfig,
		...envConfig
	});
}
//#endregion
//#region src/utils/findLast.ts
const findLast = (array, predicate) => {
	for (let i = array.length - 1; i >= 0; i--) if (predicate(array[i])) return array[i];
};
//#endregion
//#region src/sidecar.ts
async function loadUploadedTurnIds(rolloutFile) {
	try {
		const data = await nodeFsPromises.readFile(`${rolloutFile}.langsmith`, "utf-8");
		return new Set(data.split("\n").filter(Boolean));
	} catch (error) {
		if (error.code === "ENOENT") return /* @__PURE__ */ new Set();
		throw error;
	}
}
async function markTurnUploaded(rolloutFile, turnId) {
	try {
		await nodeFsPromises.appendFile(`${rolloutFile}.langsmith`, `${turnId}\n`, "utf-8");
		return true;
	} catch (error) {
		return false;
	}
}
//#endregion
//#region src/metadata.ts
const execFileAsync = promisify(execFile);
const LS_AGENT_KIND = "coding_agent";
const LS_INTEGRATION = "openai-codex";
const LS_AGENT_RUNTIME = "Codex";
const LS_TRACE_SCHEMA_VERSION = "coding-agent-v1";
const LS_INTEGRATION_VERSION = "0.0.3";
function stripUndefined(value) {
	return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== void 0));
}
function parseRepository(url) {
	const normalized = url?.trim();
	if (!normalized) return {};
	let host;
	let pathname;
	const scp = /^[^/@]+@([^:/]+):(.+)$/.exec(normalized);
	if (scp) {
		host = scp[1];
		pathname = scp[2];
	} else try {
		const parsed = new URL(normalized);
		host = parsed.hostname;
		pathname = parsed.pathname;
	} catch {
		return { repository_url: normalized };
	}
	const provider = (() => {
		const h = (host ?? "").toLowerCase();
		if (h.includes("github")) return "github";
		if (h.includes("gitlab")) return "gitlab";
		if (h.includes("bitbucket")) return "bitbucket";
		return h || "other";
	})();
	const name = (pathname ?? "").replace(/^\/+/, "").replace(/\.git$/, "").split("/").filter(Boolean).pop() || void 0;
	return {
		repository_url: normalized.replace(/\.git$/, ""),
		repository_provider: provider,
		repository_name: name
	};
}
async function runGit(cwd, args) {
	try {
		const { stdout } = await execFileAsync("git", args, {
			cwd,
			timeout: 2e3
		});
		const out = stdout.trim();
		return out.length > 0 ? out : void 0;
	} catch {
		return;
	}
}
const gitInfoCache = /* @__PURE__ */ new Map();
async function resolveGitInfo(cwd, sessionGit) {
	if (sessionGit != null && (sessionGit.repository_url != null || sessionGit.commit_hash != null || sessionGit.branch != null)) return sessionGit;
	if (!cwd) return void 0;
	let pending = gitInfoCache.get(cwd);
	if (pending == null) {
		pending = (async () => {
			const [repository_url, branch, commit_hash] = await Promise.all([
				runGit(cwd, [
					"remote",
					"get-url",
					"origin"
				]),
				runGit(cwd, [
					"rev-parse",
					"--abbrev-ref",
					"HEAD"
				]),
				runGit(cwd, ["rev-parse", "HEAD"])
			]);
			if (repository_url == null && branch == null && commit_hash == null) return;
			return {
				repository_url,
				branch,
				commit_hash
			};
		})();
		gitInfoCache.set(cwd, pending);
	}
	return pending;
}
function codingAgentMetadata(ctx) {
	const repo = parseRepository(ctx.git?.repository_url);
	return stripUndefined({
		ls_agent_kind: LS_AGENT_KIND,
		ls_integration: LS_INTEGRATION,
		ls_agent_runtime: LS_AGENT_RUNTIME,
		thread_id: ctx.threadId,
		ls_trace_schema_version: LS_TRACE_SCHEMA_VERSION,
		ls_integration_version: LS_INTEGRATION_VERSION,
		ls_agent_runtime_version: ctx.cliVersion,
		turn_id: ctx.turnId,
		turn_number: ctx.turnNumber,
		repository_url: repo.repository_url,
		repository_provider: repo.repository_provider,
		repository_name: repo.repository_name,
		git_branch: ctx.git?.branch,
		git_commit_sha: ctx.git?.commit_hash,
		cwd: ctx.cwd,
		sandbox_type: ctx.sandboxType
	});
}
//#endregion
//#region src/utils/isPrimitive.ts
function isPrimitive(value) {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
//#endregion
//#region src/utils/enumerate.ts
function* enumerate(arr) {
	for (let i = 0; i < arr.length; i++) yield [
		i,
		arr[i],
		arr
	];
}
//#endregion
//#region src/trace.ts
async function loadSession(name) {
	return (await nodeFsPromises.readFile(name, "utf-8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
async function findRolloutFileByThreadId(parentFileName, threadId) {
	const suffix = `-${threadId}.jsonl`;
	const root = nodePath.resolve(nodePath.dirname(parentFileName), "../../..");
	async function walk(dir) {
		let entries;
		try {
			entries = await nodeFsPromises.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = nodePath.join(dir, entry.name);
			if (entry.isDirectory()) {
				const found = await walk(full);
				if (found) return found;
			} else if (entry.isFile() && entry.name.endsWith(suffix)) return full;
		}
	}
	return walk(root);
}
function mergeMessages(result) {
	return result.reduce((acc, { message, timestamp, tokenCount, subagentThreads }) => {
		const last = acc.length > 0 ? acc[acc.length - 1] : void 0;
		if (![
			"ai",
			"user",
			"system"
		].includes(message.role) || last?.message.role !== message.role) {
			acc.push({
				message,
				timestamp: {
					start: timestamp,
					end: timestamp
				},
				tokenCount,
				subagentThreads
			});
			return acc;
		}
		const nextLast = structuredClone(last);
		nextLast.message.content.push(...message.content);
		nextLast.subagentThreads.push(...subagentThreads);
		nextLast.timestamp.start = Math.min(nextLast.timestamp.start, timestamp);
		nextLast.timestamp.end = Math.max(nextLast.timestamp.end, timestamp);
		if (tokenCount != null) nextLast.tokenCount = tokenCount;
		acc[acc.length - 1] = nextLast;
		return acc;
	}, []);
}
function convertToStandardMessages(messages) {
	return messages.map(({ message, ...rest }) => {
		if (message.type === "message") return {
			message: {
				role: (() => {
					if (message.role === "developer") return "system";
					if (message.role === "assistant") return "ai";
					return message.role;
				})(),
				content: message.content.map((c) => {
					if (c.type === "input_text") return {
						type: "text",
						text: c.text
					};
					if (c.type === "output_text") return {
						type: "text",
						text: c.text
					};
					if (c.type === "text") return {
						type: "text",
						text: c.text
					};
					if (c.type === "input_image") return {
						type: "image_url",
						image_url: c.image_url
					};
					return {
						type: "non_standard",
						value: c
					};
				})
			},
			...rest
		};
		if (message.type === "function_call") {
			const name = message.name;
			const id = message.call_id;
			const args = message.arguments;
			try {
				return {
					message: {
						role: "ai",
						content: [{
							type: "tool_call",
							name,
							id,
							args: JSON.parse(args)
						}]
					},
					...rest
				};
			} catch {
				return {
					message: {
						role: "ai",
						content: [{
							type: "tool_call_chunk",
							name,
							id,
							args
						}]
					},
					...rest
				};
			}
		}
		if (message.type === "function_call_output") return {
			message: {
				role: "tool",
				content: [{
					type: "text",
					text: typeof message.output === "string" ? message.output : JSON.stringify(message.output)
				}],
				tool_call_id: message.call_id
			},
			...rest
		};
		if (message.type === "custom_tool_call") return {
			message: {
				role: "ai",
				content: [{
					type: "tool_call",
					name: message.name,
					id: message.call_id,
					args: message.input
				}]
			},
			...rest
		};
		if (message.type === "custom_tool_call_output") return {
			message: {
				role: "tool",
				content: [{
					type: "text",
					text: typeof message.output === "string" ? message.output : JSON.stringify(message.output)
				}],
				tool_call_id: message.call_id
			},
			...rest
		};
		if (message.type === "tool_search_call") return {
			message: {
				role: "ai",
				content: [{
					type: "tool_call",
					name: message.type,
					id: message.call_id,
					args: message.arguments
				}]
			},
			...rest
		};
		if (message.type === "tool_search_output") return {
			message: {
				role: "tool",
				content: [{
					type: "text",
					text: JSON.stringify(message.tools)
				}],
				tool_call_id: message.call_id
			},
			...rest
		};
		if (message.type === "reasoning") {
			const { type: _, content: reasoningRaw, ...extras } = message;
			return {
				message: {
					role: "ai",
					content: [{
						type: "reasoning",
						reasoning: message.content ? typeof message.content === "string" ? message.content : JSON.stringify(message.content) : void 0,
						extras
					}]
				},
				...rest
			};
		}
		return {
			message: {
				role: "unknown",
				content: [{
					type: "non_standard",
					value: message
				}],
				_raw: message
			},
			...rest
		};
	});
}
const CHILD_SCOPE_RESET = {
	approval_policy: void 0,
	ls_subagent_id: void 0,
	ls_subagent_type: void 0
};
function getUsageMetadata(counts) {
	if (counts == null || Object.values(counts ?? {}).every((value) => value == null)) return;
	return {
		input_tokens: counts.input_tokens,
		output_tokens: counts.output_tokens,
		total_tokens: counts.total_tokens,
		input_token_details: {
			cache_read: counts.cached_input_tokens,
			cache_creation: counts.reasoning_output_tokens
		}
	};
}
const PROMISE_QUEUE = [];
async function postTurn(task, sessionMeta, { rolloutFile, options }) {
	const fallbackTime = Date.now();
	const getSystemMessage = (session, task) => {
		if (session?.base_instructions == null || task?.turnId == null) return [];
		return [{
			message: {
				role: "system",
				content: [{
					type: "text",
					text: session.base_instructions
				}]
			},
			timestamp: task.turnId.timestamp,
			tokenCount: void 0,
			subagentThreads: []
		}];
	};
	const messages = convertToStandardMessages(task.messages);
	const user = task.userMessageIndex != null ? messages.at(task.userMessageIndex) : void 0;
	const agent = mergeMessages(task.userMessageIndex != null ? messages.slice(task.userMessageIndex + 1) : messages);
	const parentStartTime = task.turnId?.timestamp ?? fallbackTime;
	const parentEndTime = agent.at(-1)?.timestamp.end ?? parentStartTime;
	const debugNow = options?.debugNow ?? {
		now: Date.now(),
		startTime: parentStartTime
	};
	const cwd = (typeof task.context?.cwd === "string" ? task.context.cwd : void 0) ?? sessionMeta?.cwd;
	const sandboxType = (() => {
		const policy = task.context?.sandbox_policy;
		if (typeof policy === "string") return policy;
		if (policy != null && typeof policy === "object") {
			const type = policy.type;
			if (typeof type === "string") return type;
		}
	})();
	const approvalPolicy = (() => {
		const policy = task.context?.approval_policy;
		if (typeof policy === "string") return policy;
		if (policy != null) return JSON.stringify(policy);
	})();
	const git = await resolveGitInfo(cwd, sessionMeta?.git);
	const conversationThreadId = options?.threadId ?? sessionMeta?.session_id;
	const base = codingAgentMetadata({
		threadId: conversationThreadId,
		turnId: task.turnId?.id,
		turnNumber: task.turnNumber,
		cliVersion: sessionMeta?.cli_version,
		cwd,
		git,
		sandboxType
	});
	const isSubagent = sessionMeta?.is_subagent === true;
	const parentConfig = {
		name: "openai.codex",
		client: options?.client,
		project_name: options?.projectName,
		run_type: "chain",
		replicas: options?.replicas,
		inputs: { messages: user != null ? [user.message] : [] },
		outputs: { messages: agent.map((i) => i.message) },
		start_time: parentStartTime,
		end_time: parentEndTime,
		extra: { metadata: {
			...options?.metadata,
			...task.context,
			...base,
			approval_policy: isSubagent ? void 0 : approvalPolicy,
			ls_subagent_id: isSubagent ? sessionMeta?.session_id : void 0,
			ls_subagent_type: isSubagent ? sessionMeta?.agent_role ?? sessionMeta?.agent_nickname : void 0,
			codex_cli_version: sessionMeta?.cli_version,
			ls_agent_type: isSubagent ? "subagent" : "root",
			ls_message_format: "anthropic",
			usage_metadata: getUsageMetadata(task.tokenCount?.total_token_usage)
		} }
	};
	const parent = options?.parentRunTree?.createChild(parentConfig) ?? new RunTree(parentConfig);
	PROMISE_QUEUE.push(parent.postRun());
	const fullMessages = mergeMessages([...getSystemMessage(sessionMeta, task), ...messages]);
	const outputs = fullMessages.reduce((acc, item, idx) => {
		if (item.message.role === "ai") acc.push(idx);
		return acc;
	}, []).map((start) => {
		const nonToolIdx = Array.from({ length: start + 1 }).fill(null).concat(fullMessages.slice(start + 1)).findIndex((i) => {
			const value = i;
			if (value == null) return false;
			return value?.message.role !== "tool";
		});
		if (nonToolIdx > start) return {
			start,
			length: nonToolIdx - start
		};
		return {
			start,
			length: 1
		};
	});
	for (const output of outputs) {
		const inputMessages = fullMessages.slice(0, output.start);
		const aiMessage = fullMessages.slice(output.start, output.start + 1);
		const toolMessages = fullMessages.slice(output.start + 1, output.start + output.length);
		const outputStartTime = aiMessage.at(0)?.timestamp.start ?? parentStartTime;
		const outputEndTime = aiMessage.at(-1)?.timestamp.end ?? outputStartTime;
		const tokenCounts = findLast(aiMessage, (i) => i.tokenCount != null)?.tokenCount;
		const subagentThreads = findLast(aiMessage, (i) => i.subagentThreads.length > 0)?.subagentThreads;
		const llmChild = parent.createChild({
			name: "openai.codex.turn",
			run_type: "llm",
			start_time: outputStartTime,
			end_time: outputEndTime,
			inputs: { messages: inputMessages.map((i) => i.message) },
			outputs: { messages: aiMessage.map((i) => i.message) },
			extra: { metadata: {
				...options?.metadata,
				...base,
				...CHILD_SCOPE_RESET,
				ls_model_type: "chat",
				ls_provider: sessionMeta?.model_provider,
				ls_model_name: task.context?.model,
				ls_invocation_params: task.context,
				usage_metadata: getUsageMetadata(tokenCounts)
			} }
		});
		PROMISE_QUEUE.push(llmChild.postRun());
		for (const toolMessage of toolMessages) {
			if (toolMessage.message.role !== "tool") continue;
			const toolCallId = typeof toolMessage.message.tool_call_id === "string" ? toolMessage.message.tool_call_id : void 0;
			const msgToolCall = aiMessage.at(0)?.message.content.find((c) => c.type === "tool_call" && c.id === toolCallId);
			if (toolCallId == null || msgToolCall == null) continue;
			const toolCall = task.toolCalls?.[toolCallId] ?? {
				error: void 0,
				timings: [],
				outputs: {}
			};
			const min = Math.min(toolMessage.timestamp.start, ...toolCall.timings);
			const max = Math.max(toolMessage.timestamp.end, ...toolCall.timings);
			const nativeToolName = typeof msgToolCall.name === "string" ? msgToolCall.name : void 0;
			const runName = nativeToolName ?? "openai.codex.tool";
			const toolRun = parent.createChild({
				name: runName,
				run_type: "tool",
				start_time: min,
				end_time: max,
				inputs: { input: msgToolCall.args },
				outputs: {
					...toolCall.outputs,
					messages: [toolMessage.message]
				},
				error: toolCall.error,
				extra: { metadata: {
					...options?.metadata,
					...base,
					...CHILD_SCOPE_RESET,
					ls_model_type: "chat",
					ls_provider: sessionMeta?.model_provider,
					ls_model_name: task.context?.model,
					ls_invocation_params: task.context,
					usage_metadata: getUsageMetadata(toolMessage.tokenCount),
					...nativeToolName != null && runName !== nativeToolName ? { ls_tool_name: nativeToolName } : {}
				} }
			});
			PROMISE_QUEUE.push(toolRun.postRun());
		}
		for (const subagentThread of subagentThreads ?? []) {
			const subagentFile = await findRolloutFileByThreadId(rolloutFile, subagentThread);
			if (subagentFile == null) continue;
			await convertToRunTree({
				transcript_path: subagentFile,
				turn_id: await (async () => {
					return findLast(await loadSession(subagentFile), (e) => e.type === "event_msg" && e.payload.turn_id != null)?.payload.turn_id ?? null;
				})()
			}, {
				...options,
				parentRunTree: parent,
				threadId: conversationThreadId,
				debugNow
			});
		}
	}
}
async function convertToRunTree(input, options) {
	let sessionMeta;
	let task;
	function createTask() {
		return {
			turnId: void 0,
			turnNumber: void 0,
			messages: [],
			userMessageIndex: void 0,
			context: void 0,
			tokenCount: void 0,
			toolCalls: {}
		};
	}
	let turnNumber = 0;
	const uploadedTurnIds = await loadUploadedTurnIds(input.transcript_path);
	const events = await loadSession(input.transcript_path);
	for (const [index, { type, payload, timestamp }, arr] of enumerate(events)) {
		if (type === "session_meta") {
			const source = payload.source;
			const threadSpawn = source != null && typeof source === "object" && "subagent" in source ? source.subagent?.thread_spawn : void 0;
			sessionMeta = {
				session_id: payload.id,
				model_provider: payload.model_provider ?? void 0,
				base_instructions: payload.base_instructions?.text,
				cli_version: payload.cli_version,
				cwd: payload.cwd,
				git: payload.git,
				is_subagent: threadSpawn != null,
				agent_role: threadSpawn?.agent_role ?? payload.agent_role ?? void 0,
				agent_nickname: threadSpawn?.agent_nickname ?? payload.agent_nickname ?? void 0
			};
		}
		if (type === "response_item") {
			task ??= createTask();
			const message = {
				timestamp: Date.parse(timestamp),
				message: payload,
				tokenCount: void 0,
				subagentThreads: []
			};
			task.messages.push(message);
			if (task.context != null && task.userMessageIndex == null && payload.type === "message" && payload.role === "user") task.userMessageIndex = task.messages.length - 1;
		}
		if (type === "turn_context") {
			task ??= createTask();
			task.context = payload;
		}
		if (type === "event_msg") {
			const eventTime = Date.parse(timestamp);
			if (payload.type === "task_started") {
				task = createTask();
				turnNumber += 1;
				task.turnId = {
					id: payload.turn_id,
					timestamp: eventTime
				};
				task.turnNumber = turnNumber;
			}
			if (typeof payload.call_id === "string") {
				task ??= createTask();
				task.toolCalls[payload.call_id] ??= {
					error: void 0,
					timings: [],
					outputs: {}
				};
				task.toolCalls[payload.call_id].timings.push(eventTime);
				if (payload.type.endsWith("_end")) {
					if (payload.status === "failed" || payload.status === "declined") {
						const stdout = (() => {
							if (typeof payload.aggregated_output === "string") return payload.aggregated_output || void 0;
							const bestEffort = [payload.stdout, payload.stderr].filter(Boolean).join("\n");
							if (!bestEffort) return void 0;
							return bestEffort;
						})();
						const exitCode = (() => {
							if (typeof payload.exit_code === "number") return `Exit code: ${payload.exit_code}`;
						})();
						const error = payload.error ?? payload.codex_error_info ?? stdout ?? exitCode;
						task.toolCalls[payload.call_id].error = error != null ? isPrimitive(error) ? String(error) : JSON.stringify(error) : void 0;
					}
					const outputs = { ...payload };
					delete outputs.call_id;
					delete outputs.turn_id;
					delete outputs.type;
					Object.assign(task.toolCalls[payload.call_id].outputs, outputs);
				}
			}
			if (payload.type === "token_count") {
				task ??= createTask();
				const last = task?.messages.at(-1);
				if (last != null) last.tokenCount = payload.info?.last_token_usage;
				task.tokenCount = payload.info ?? void 0;
			}
			if (payload.type === "collab_agent_spawn_end") {
				if (payload.new_thread_id != null) {
					task ??= createTask();
					task.messages.at(-1)?.subagentThreads.push(payload.new_thread_id);
				}
			}
			if (payload.type === "task_complete" || payload.type === "turn_aborted" || task != null && index === arr.length - 1 && input.turn_id != null) {
				task ??= createTask();
				const completedTurnId = task.turnId?.id ?? input.turn_id ?? void 0;
				if (task.turnId == null && completedTurnId != null) task.turnId = {
					id: completedTurnId,
					timestamp: eventTime
				};
				if (task.turnNumber == null) {
					turnNumber += 1;
					task.turnNumber = turnNumber;
				}
				if (completedTurnId == null || !uploadedTurnIds.has(completedTurnId)) {
					await postTurn(task, sessionMeta, {
						rolloutFile: input.transcript_path,
						options
					});
					if (completedTurnId != null) {
						uploadedTurnIds.add(completedTurnId);
						await markTurnUploaded(input.transcript_path, completedTurnId);
					}
				}
				task = void 0;
			}
		}
	}
	await Promise.all(PROMISE_QUEUE);
}
//#endregion
//#region src/utils/stdin.ts
function readStdin() {
	let buffer = "";
	return new Promise((resolve, reject) => {
		process.stdin.setEncoding("utf-8");
		process.stdin.on("data", (data) => buffer += data.toString("utf-8"));
		process.stdin.on("end", () => {
			try {
				resolve(JSON.parse(buffer));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				reject(/* @__PURE__ */ new Error(`Error parsing hook stdin: ${errorMessage}`));
			}
		});
		process.stdin.once("error", reject);
	});
}
//#endregion
//#region src/index.ts
async function runHook() {
	const content = await readStdin();
	const config = await getConfig();
	if (!config.enabled) return;
	await convertToRunTree(content, {
		client: new Client({
			apiKey: config.api_key,
			apiUrl: config.api_url
		}),
		projectName: config.project,
		metadata: config.metadata,
		replicas: config.replicas
	});
}
runHook();
//#endregion
export { runHook };
