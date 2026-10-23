import * as nodeFsPromises from "node:fs/promises";
import { access, chmod, link, lstat, mkdir, open, readFile, readdir, rename, rm, rmdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import * as nodeFs from "node:fs";
import { accessSync, closeSync, constants, copyFileSync, createReadStream, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, rmdirSync, statSync, writeFileSync, writeSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import * as nodePath from "node:path";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep, win32 } from "node:path";
import { performance as performance$1 } from "node:perf_hooks";
import { setTimeout as setTimeout$1 } from "node:timers/promises";
import { Worker } from "node:worker_threads";
import { execFileSync, spawn } from "node:child_process";
import * as tls from "node:tls";
import * as os from "node:os";
import { arch, homedir, platform, userInfo } from "node:os";
import { isDeepStrictEqual } from "node:util";
import { createInterface } from "node:readline";
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/errors.js
function describe(error) {
	return error instanceof Error ? error.message : String(error);
}
function errorCode(error) {
	return error !== null && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : void 0;
}
function failureStatus(error) {
	if (typeof error !== "object" || error === null) return void 0;
	const status = Reflect.get(error, "status");
	return typeof status === "number" ? status : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/constants.js
const POLICY_LOCK_TIMEOUT_MS = 2e3;
const POLICY_LOCK_TIMEOUT_ERROR = "Timed out waiting for tracing preference lock";
const POLICY_LOCK_TIMEOUT_MESSAGE = "Retry; if it persists, remove the lock only after confirming no preference writer is running.";
const POLICY_UNREADABLE_MESSAGE = "Refusing to overwrite them; repair the file or its permissions before retrying. No preferences were changed.";
const POLICY_NOT_REGULAR_MESSAGE = "Tracing preferences must be a regular, non-symlink file";
const POLICY_ASYNC_UPDATE_MESSAGE = "A policy update must change the policy synchronously";
const POLICY_FILE_ENCODING = "utf8";
const POLICY_TEMP_CLOSE_WARNING = "Temporary file close failed";
const POLICY_TEMP_CLEANUP_WARNING = "Temporary file cleanup failed";
const POLICY_DIRECTORY_CLOSE_WARNING = "Directory close cleanup failed";
const POLICY_LOCK_CLEANUP_FAILED_PREFIX = "Preference lock cleanup failed at";
const POLICY_CANNOT_READ_PREFIX = "Cannot read tracing preferences at";
const POLICY_DURABILITY_WARNING = "Preference is effective, but crash durability could not be confirmed; retry saving";
const POLICY_LOCK_RELEASE_WARNING = "Before retrying, remove the lock only after confirming no preference writer is running";
const COMPILED_BINARY_ENTRY_PREFIXES = [
	"/$bunfs/",
	"B:/~BUN/",
	"B:\\~BUN\\"
];
const WORKER_LOG_FILE_NAME = "worker.log";
const SYSTEM_CERTIFICATES_FILE_NAME = "system_certificates.pem";
const WORKER_NO_PID_MESSAGE = "Background worker did not report a process ID";
const UNAVAILABLE_ACCOUNT_FINGERPRINT = "unavailable";
const HOOK_HELP_FLAGS = ["--help", "-h"];
const HOOK_VERSION_FLAGS = ["--version", "-v"];
const POLICY_PARSE_RESULT_MESSAGE = "A policy parser must return a policy";
const HOOK_OPTIONS_INVALID_MESSAGE = "Hook options need a hooks table and onHookError and onUnknown callbacks";
const HOOK_ERROR_HANDLER_WARNING = "The hook error handler failed:";
const NOTICE_MINUTE_MS = 6e4;
const NOTICE_STATE_FILE = "notices.json";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/hook-command.js
async function dispatchHookCommand(argv, options) {
	assertHookOptions(options);
	const [argument, ...rest] = argv;
	if (argument !== void 0 && HOOK_HELP_FLAGS.includes(argument)) console.log(options.usage);
	else if (argument !== void 0 && HOOK_VERSION_FLAGS.includes(argument)) console.log(options.version);
	else if (argument !== void 0 && options.worker?.command === argument) await guarded(argument, () => options.worker.run(rest), options);
	else if (argument !== void 0 && Object.hasOwn(options.hooks, argument)) await guarded(argument, options.hooks[argument], options);
	else options.onUnknown(argument);
}
async function guarded(name, run, options) {
	try {
		await run();
	} catch (error) {
		reportHookError(name, error, options);
	}
}
function assertHookOptions(options) {
	if (options === null || typeof options !== "object" || options.hooks === null || typeof options.hooks !== "object" || typeof options.onHookError !== "function" || typeof options.onUnknown !== "function") throw new TypeError(HOOK_OPTIONS_INVALID_MESSAGE);
}
function reportHookError(name, error, options) {
	try {
		options.onHookError(name, error);
	} catch (handlerError) {
		console.warn(HOOK_ERROR_HANDLER_WARNING, describe(handlerError));
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/constants.js
const FILE_MISSING_CODE = "ENOENT";
const WINDOWS_PLATFORM = "win32";
const FILE_EXISTS_CODE = "EEXIST";
const PERMISSION_DENIED_CODE = "EPERM";
const FILE_ACCESS_DENIED_CODE = "EACCES";
const FILE_BUSY_CODE = "EBUSY";
const DIRECTORY_NOT_EMPTY_CODE = "ENOTEMPTY";
const INVALID_ARGUMENT_CODE = "EINVAL";
const TEMPLATE_PLACEHOLDER = /\{(\w+)\}/gu;
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/files/cleanup-constants.js
const CLEANUP_IGNORED_DIRECTORY_CODES = [
	FILE_MISSING_CODE,
	DIRECTORY_NOT_EMPTY_CODE,
	FILE_EXISTS_CODE,
	PERMISSION_DENIED_CODE,
	FILE_BUSY_CODE,
	FILE_ACCESS_DENIED_CODE
];
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/files/cleanup.js
async function removeFileIfPresent(path) {
	try {
		await unlink(path);
		return true;
	} catch (error) {
		if (errorCode(error) === "ENOENT") return false;
		throw error;
	}
}
async function removeDirectoryBestEffort(path, warning) {
	try {
		await rmdir(path);
	} catch (error) {
		if (errorCode(error) !== "ENOENT") console.warn(warning, describe(error));
	}
}
async function removeEmptyAncestors(directory, root) {
	for (let current = directory; current !== root && current !== dirname(current);) {
		try {
			await rmdir(current);
		} catch (error) {
			const code = errorCode(error);
			if (CLEANUP_IGNORED_DIRECTORY_CODES.some((ignored) => ignored === code)) return;
			throw error;
		}
		current = dirname(current);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/constants.js
const FILE_LOCK_CLAIM_EXTENSION = ".json";
const FILE_LOCK_DIRECTORY_SUFFIX = ".claims";
const FILE_LOCK_LEGACY_DIRECTORY_SUFFIX = ".lock";
const FILE_LOCK_TIMEOUT_ERROR_NAME = "FileLockTimeoutError";
const FILE_LOCK_TEMP_SUFFIX = ".tmp";
const FILE_LOCK_ENCODING = "utf-8";
const FILE_LOCK_TIMEOUT_MESSAGE = "Timed out waiting for file lock";
const FILE_LOCK_TICKET_LIMIT_MESSAGE = "File lock ticket limit reached";
const FILE_LOCK_RELEASE_MESSAGE = "Could not release file lock claim";
const FILE_LOCK_INVALID_TIMEOUT_MESSAGE = "timeoutMs must be a finite positive number";
const FILE_LOCK_ACQUIRE_MESSAGE = "Could not acquire file lock claim";
const FILE_LOCK_UNSAFE_DIRECTORY_MESSAGE = "Unsafe file lock claims directory";
const FILE_LOCK_STALE_CLAIM_MS = 3e3;
const FILE_LOCK_TRY_CHOOSING_WAIT_MS = 1e3;
const FILE_LOCK_DIRECTORY_CONTENTION_CODES = [PERMISSION_DENIED_CODE, FILE_ACCESS_DENIED_CODE];
const FILE_LOCK_BUSY_FILE_CODES = [...FILE_LOCK_DIRECTORY_CONTENTION_CODES, FILE_BUSY_CODE];
const FILE_LOCK_HEARTBEAT_WARNING = "Could not refresh a file lock claim:";
const FILE_LOCK_COMPATIBLE_ACQUIRE_CLEANUP_MESSAGE = "Could not release the legacy lock gate after shared lock acquisition failed";
const FILE_LOCK_COMPATIBLE_RELEASE_MESSAGE = "Could not release compatible file lock";
const FILE_LOCK_COMPATIBLE_GATE_CHANGED_MESSAGE = "Legacy file lock gate changed before release";
const FILE_LOCK_COMPATIBLE_OWNER_FILE = "owner";
const FILE_LOCK_COMPATIBLE_OWNER_MESSAGE = "Could not record the legacy file lock gate owner";
const FILE_LOCK_COMPATIBLE_OWNER_PID_PATTERN = /^[1-9]\d*$/u;
const FILE_LOCK_COMPATIBLE_STALE_SUFFIX = ".stale";
const FILE_LOCK_GATE_CLEANUP_WARNING = "Could not remove a half-created lock folder:";
const FILE_LOCK_STALE_GATE_CLEANUP_WARNING = "Could not remove an old lock folder:";
const STORAGE_NOT_WRITABLE_ERROR_NAME = "StorageNotWritableError";
const STORAGE_NOT_WRITABLE_MESSAGE = "LangSmith can't write to its storage folder";
const STORAGE_NOT_WRITABLE_FIX = "Fix that folder's permissions so your user account can create files in it, and tracing will resume.";
const STORAGE_STALE_FILE_MAX_AGE_MS = 72e5;
const STORAGE_STALE_DIRECTORY_WARNING = "Could not remove an old empty folder:";
const STORAGE_STALE_REMOVAL_WARNING = "Removed an old leftover file:";
const FILE_LOCK_LOST_MESSAGE = "The file lock was taken over before the write finished";
const STORAGE_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_ENGINE_FILE_PATTERNS = [
	new RegExp(`^\\.${STORAGE_UUID}(\\.${STORAGE_UUID})?\\.tmp$`, "u"),
	new RegExp(`^wake-[0-9a-f]{64}\\.active\\.${STORAGE_UUID}(\\.attempt\\.[1-9]\\d*)?\\.json$`, "u"),
	/^wake-[0-9a-f]{64}\.launching$/u
];
const STORAGE_CLAIM_FILE = new RegExp(`^${STORAGE_UUID}\\.json$`, "u");
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/lock-folders.js
async function removeEmptyLockFolders(lockPath, root) {
	await removeEmptyAncestors(`${lockPath}${FILE_LOCK_DIRECTORY_SUFFIX}`, root);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/constants.js
const CAPTURE_JOBS_DIRECTORY = "jobs";
const CAPTURE_SESSIONS_DIRECTORY = "sessions";
const CAPTURE_TURNS_DIRECTORY = "turns";
const CAPTURE_REMOVED_DIRECTORY_CODES = [FILE_MISSING_CODE, INVALID_ARGUMENT_CODE];
const CAPTURE_INTEGRATION = /^[a-z][a-z0-9-]{0,62}$/;
const CAPTURE_HASH = /^[0-9a-f]{64}$/u;
const CAPTURE_EVENT_FILE = /^[0-9a-f]{64}\.json$/u;
const JSON_ARRAY_INDEX_KEY = /^(0|[1-9]\d*)$/u;
const CAPTURE_EXPIRED_WARNING = "Dropped trace work that was never uploaded: {dropped} saved items were past their age limit ({ceiling} from turns that kept capturing for over 7 days, {otherSetting} saved under a different API key, endpoint, replica or redaction setting)";
const CAPTURE_HELD_EXPIRED_WARNING = "Dropped {held} saved run updates that were still waiting for their turn to finish before upload";
const CAPTURE_SKIPPED_WARNING = "Left a saved trace file alone because it could not be read:";
const CAPTURE_UNREADABLE_WARNING = "Removed a saved trace file that could not be read:";
const CAPTURE_NAMESPACE_MISMATCH_MESSAGE = "Capture namespace does not match";
const CAPTURE_RETRY_LOST_MESSAGE = "Capture disappeared before its retry was saved";
const CAPTURE_OUTCOME_INVALID_MESSAGE = "Invalid outcome";
const CAPTURE_RECORD_UNSUPPORTED_MESSAGE = "Unsupported capture record";
const CAPTURE_OUTCOME_UNSUPPORTED_MESSAGE = "Unsupported delivery outcome";
const CAPTURE_DEPENDENCIES_INVALID_MESSAGE = "Invalid capture dependencies";
const CAPTURE_DEPENDENCY_INVALID_MESSAGE = "Invalid capture dependency";
const CAPTURE_DEPENDENCY_INTEGRATION_MESSAGE = "Capture dependencies must use the same integration";
const CAPTURE_DEPENDENCY_SELF_MESSAGE = "Capture cannot depend on itself";
const CAPTURE_DEPENDENCY_UNIQUE_MESSAGE = "Capture dependencies must be unique";
const CAPTURE_VERSION_UNSUPPORTED_MESSAGE = "Unsupported capture record version";
const CAPTURE_FIELD_UNSUPPORTED_MESSAGE = "Unsupported";
const CAPTURE_MARKER_SUFFIX = ".outcome";
const CAPTURE_MARKER_FILE = /^(?:[0-9a-f]{64}|turn)\.outcome$/u;
const CAPTURE_TURN_MARKER_FILE = "turn.outcome";
const CAPTURE_MARKER_REMOVED_REASON = "removed-before-delivery";
const CAPTURE_MARKER_INVALID_MESSAGE = "Invalid outcome marker";
const CAPTURE_MARKER_INVALID_WARNING = "Removed an unreadable outcome marker:";
const CAPTURE_ROUTES_INVALID_MESSAGE = "Invalid capture destination routes";
const CAPTURE_ROUTE_INVALID_MESSAGE = "Invalid capture destination route";
const CAPTURE_ROUTE_PROJECT_INVALID_MESSAGE = "Invalid capture route project";
const CAPTURE_FILE_EXTENSION = ".json";
const CAPTURE_LOCK_EXTENSION = ".lock";
const CAPTURE_STORAGE_DIRECTORY_MESSAGE = "Capture directory must be turns or jobs";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/utils/serialization.js
function canonicalJson(value) {
	const result = JSON.stringify(canonicalValue(value, /* @__PURE__ */ new Set()));
	if (result === void 0) throw new TypeError("Value cannot be serialized as JSON");
	return result;
}
function canonicalValue(value, seen) {
	if (value === null || typeof value === "string" || typeof value === "boolean") return value;
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (Array.isArray(value)) {
		if (seen.has(value)) throw new TypeError("Cyclic data cannot be captured");
		seen.add(value);
		const descriptors = Object.getOwnPropertyDescriptors(value);
		if (Reflect.ownKeys(descriptors).some((key) => typeof key === "symbol" || key !== "length" && (!JSON_ARRAY_INDEX_KEY.test(key) || Number(key) >= value.length))) throw new TypeError("Array properties cannot be captured");
		if (Object.keys(descriptors).length - 1 < value.length) throw new TypeError("Sparse arrays cannot be captured");
		const result = [];
		for (let index = 0; index < value.length; index += 1) {
			const descriptor = descriptors[index];
			if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("Sparse arrays cannot be captured");
			result.push(canonicalValue(descriptor.value, seen));
		}
		seen.delete(value);
		return result;
	}
	if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw new TypeError("Capture data must contain only JSON values");
	if (seen.has(value)) throw new TypeError("Cyclic data cannot be captured");
	seen.add(value);
	const descriptors = Object.getOwnPropertyDescriptors(value);
	if (Reflect.ownKeys(descriptors).some((key) => typeof key === "symbol")) throw new TypeError("Symbol keys cannot be captured");
	const result = Object.create(null);
	for (const key of Object.keys(descriptors).toSorted()) {
		const descriptor = descriptors[key];
		if (!descriptor?.enumerable || !("value" in descriptor)) throw new TypeError("Capture data must use enumerable data fields");
		result[key] = canonicalValue(descriptor.value, seen);
	}
	seen.delete(value);
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/validation/objects.js
function isPlainRecord(value) {
	return value !== null && typeof value === "object" && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
function requirePlainRecord(value, name) {
	if (!isPlainRecord(value)) throw new TypeError(`${name} must be a plain object`);
	return value;
}
function ownDataField(source, key) {
	const descriptor = Object.getOwnPropertyDescriptor(source, key);
	if (!descriptor?.enumerable || !("value" in descriptor)) return { present: false };
	return {
		present: true,
		value: descriptor.value
	};
}
function requireOwnDataField(source, key) {
	const field = ownDataField(source, key);
	if (!field.present) throw new TypeError(`${key} is required`);
	return field.value;
}
function canonicalJsonValue(value) {
	return canonicalValue(value, /* @__PURE__ */ new Set());
}
function canonicalJsonObject(value, name) {
	return canonicalValue(requirePlainRecord(value, name), /* @__PURE__ */ new Set());
}
function canonicalJsonArray(value, name) {
	if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
	return canonicalValue(value, /* @__PURE__ */ new Set());
}
function requireNonBlankString(value, name) {
	if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`${name} is required`);
	return value;
}
function requireString(value, name) {
	if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
	return value;
}
function requireBoolean(value, name) {
	if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
	return value;
}
function requireStringArray(value, name) {
	const values = canonicalJsonArray(value, name);
	if (!values.every((entry) => typeof entry === "string")) throw new TypeError(`${name} must contain strings`);
	return values;
}
function requireTimestamp(value) {
	if (typeof value === "number" && Number.isFinite(value) && Number.isFinite(new Date(value).getTime())) return value;
	if (typeof value === "string" && value.trim().length > 0 && Number.isFinite(new Date(value).getTime())) return value;
	throw new TypeError("Run timestamp must be a valid date or millisecond time");
}
function requireSafeEpochMilliseconds(value, name) {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || !Number.isFinite(new Date(value).getTime())) throw new TypeError(`${name} must be a valid millisecond timestamp`);
	return value;
}
function requireNonNegativeInteger(value, name) {
	if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative safe integer`);
	return value;
}
function parseJsonObject(contents, message) {
	const value = JSON.parse(contents);
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/errors.js
var FileLockTimeoutError = class extends Error {
	blockedPath;
	constructor(blockedPath) {
		super(`${FILE_LOCK_TIMEOUT_MESSAGE}: ${resolve(blockedPath)}`);
		this.name = FILE_LOCK_TIMEOUT_ERROR_NAME;
		this.blockedPath = resolve(blockedPath);
	}
};
var StorageNotWritableError = class extends Error {
	folder;
	code;
	constructor(folder, cause) {
		super(`${STORAGE_NOT_WRITABLE_MESSAGE} ${resolve(folder)}. ${STORAGE_NOT_WRITABLE_FIX}`, { cause });
		this.name = STORAGE_NOT_WRITABLE_ERROR_NAME;
		this.folder = resolve(folder);
		this.code = errorCode(cause);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/file-lock-heartbeat.js
const heartbeats = /* @__PURE__ */ new Map();
function startHeartbeat(path, id) {
	const timer = setInterval(() => {
		const now = /* @__PURE__ */ new Date();
		utimes(path, now, now).catch(warnUnlessMissing);
	}, 500);
	timer.unref();
	heartbeats.set(id, timer);
}
function stopHeartbeat(id) {
	clearInterval(heartbeats.get(id));
	heartbeats.delete(id);
}
function warnUnlessMissing(error) {
	if (errorCode(error) !== "ENOENT") console.warn(FILE_LOCK_HEARTBEAT_WARNING, describe(error));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/file-lock-support.js
function processIsAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if (errorCode(error) === "ESRCH") return false;
		return;
	}
}
async function removeFile(filePath) {
	try {
		await unlink(filePath);
		return true;
	} catch (error) {
		if (errorCode(error) === "ENOENT") return true;
		return false;
	}
}
function isBusyFileError(error) {
	return FILE_LOCK_BUSY_FILE_CODES.includes(errorCode(error) ?? "");
}
function timeoutMs(options) {
	const value = options?.timeoutMs ?? 5e3;
	if (!Number.isFinite(value) || value <= 0) throw new RangeError(FILE_LOCK_INVALID_TIMEOUT_MESSAGE);
	return value;
}
function waitForNextScan(deadline, blockedPath) {
	const remaining = deadline - performance$1.now();
	if (remaining <= 0) return Promise.reject(new FileLockTimeoutError(blockedPath));
	return new Promise((resolvePromise) => setTimeout(resolvePromise, Math.min(10, remaining)));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/legacy-gate.js
async function createLegacyGate(gatePath) {
	await mkdir(gatePath, { mode: 448 });
	const stat = await lstat(gatePath);
	if (!stat.isDirectory()) throw new Error(FILE_LOCK_COMPATIBLE_GATE_CHANGED_MESSAGE);
	await recordLegacyGateOwner(gatePath);
	startHeartbeat(join(gatePath, FILE_LOCK_COMPATIBLE_OWNER_FILE), gatePath);
	return {
		path: gatePath,
		dev: stat.dev,
		ino: stat.ino,
		birthtimeMs: stat.birthtimeMs
	};
}
function resetMissingPermission(attempt) {
	attempt.missingPermissionError = void 0;
	attempt.windowsDeniedRetries = 0;
}
async function waitOutContention(attempt, error) {
	const { gatePath, filePath, deadline, tryAcquire } = attempt;
	const code = errorCode(error);
	const permissionDenied = FILE_LOCK_DIRECTORY_CONTENTION_CODES.includes(code ?? "");
	if (code !== "EEXIST" && !permissionDenied) throw error;
	let isContended = false;
	try {
		const gate = await lstat(gatePath);
		const isDirectory = gate.isDirectory();
		isContended = isDirectory || gate.isFile() && code === "EEXIST";
		if (isContended && await legacyGateIsAbandoned(gatePath, isDirectory, gate.mtimeMs)) {
			if (!await reclaimLegacyGate(gatePath, filePath, tryAcquire)) await waitForNextScan(deadline, gatePath);
			return;
		}
	} catch (statError) {
		if (errorCode(statError) === "ENOENT") {
			if (code === "EEXIST") {
				resetMissingPermission(attempt);
				await waitForNextScan(deadline, gatePath);
				return;
			}
			if (permissionDenied) {
				const firstRetry = attempt.missingPermissionError === void 0;
				attempt.missingPermissionError = new StorageNotWritableError(dirname(gatePath), error);
				if (firstRetry) return;
				if (process.platform !== "win32" || code !== "EPERM" || attempt.windowsDeniedRetries >= 5) throw attempt.missingPermissionError;
				attempt.windowsDeniedRetries += 1;
				const denied = attempt.missingPermissionError;
				await waitForNextScan(deadline, gatePath).catch(() => Promise.reject(denied));
				return;
			}
		}
		throw error;
	}
	if (!isContended) throw error;
	resetMissingPermission(attempt);
	await waitForNextScan(deadline, gatePath);
}
async function acquireLegacyDirectoryGate(filePath, deadline, tryAcquire) {
	const gatePath = `${filePath}${FILE_LOCK_LEGACY_DIRECTORY_SUFFIX}`;
	await mkdir(dirname(filePath), {
		recursive: true,
		mode: 448
	});
	const attempt = {
		gatePath,
		filePath,
		deadline,
		tryAcquire,
		windowsDeniedRetries: 0
	};
	for (;;) {
		if (performance$1.now() >= deadline) throw attempt.missingPermissionError ?? new FileLockTimeoutError(gatePath);
		try {
			return await createLegacyGate(gatePath);
		} catch (error) {
			await waitOutContention(attempt, error);
		}
	}
}
async function releaseLegacyDirectoryGate(gate) {
	stopHeartbeat(gate.path);
	let stat;
	try {
		stat = await lstat(gate.path);
	} catch (error) {
		if (errorCode(error) === "ENOENT") return;
		throw error;
	}
	if (!stat.isDirectory() || stat.dev !== gate.dev || stat.ino !== gate.ino || stat.birthtimeMs !== gate.birthtimeMs) throw new Error(FILE_LOCK_COMPATIBLE_GATE_CHANGED_MESSAGE);
	await removeFile(join(gate.path, FILE_LOCK_COMPATIBLE_OWNER_FILE));
	await rmdir(gate.path);
}
async function recordLegacyGateOwner(gatePath) {
	try {
		await writeFile(join(gatePath, FILE_LOCK_COMPATIBLE_OWNER_FILE), String(process.pid), {
			flag: "wx",
			mode: 384
		});
	} catch (error) {
		await removeDirectoryBestEffort(gatePath, FILE_LOCK_GATE_CLEANUP_WARNING);
		throw new Error(FILE_LOCK_COMPATIBLE_OWNER_MESSAGE, { cause: error });
	}
}
async function legacyGateIsAbandoned(gatePath, isDirectory, modifiedAtMs) {
	let contents;
	try {
		contents = await readFile(isDirectory ? join(gatePath, FILE_LOCK_COMPATIBLE_OWNER_FILE) : gatePath, FILE_LOCK_ENCODING);
	} catch (error) {
		if (errorCode(error) !== "ENOENT") return false;
		contents = "";
	}
	const pid = FILE_LOCK_COMPATIBLE_OWNER_PID_PATTERN.test(contents.trim()) ? Number(contents.trim()) : void 0;
	if (pid !== void 0 && Number.isSafeInteger(pid) && pid > 0) return processIsAlive(pid) === false || isDirectory && await ownerHeartbeatStopped(gatePath);
	return !isDirectory && Date.now() - modifiedAtMs >= 5e3;
}
async function ownerHeartbeatStopped(gatePath) {
	try {
		const owner = await lstat(join(gatePath, FILE_LOCK_COMPATIBLE_OWNER_FILE));
		return Date.now() - owner.mtimeMs >= FILE_LOCK_STALE_CLAIM_MS;
	} catch {
		return false;
	}
}
async function reclaimLegacyGate(gatePath, filePath, tryAcquire) {
	const takeover = await tryAcquire(filePath);
	if (!takeover) return false;
	try {
		let gate;
		try {
			gate = await lstat(gatePath);
		} catch (error) {
			if (errorCode(error) === "ENOENT") return true;
			throw error;
		}
		const isDirectory = gate.isDirectory();
		if (!await legacyGateIsAbandoned(gatePath, isDirectory, gate.mtimeMs)) return false;
		const stalePath = `${gatePath}.${randomUUID()}${FILE_LOCK_COMPATIBLE_STALE_SUFFIX}`;
		try {
			await rename(gatePath, stalePath);
		} catch (error) {
			if (isBusyFileError(error)) return false;
			throw error;
		}
		if (!isDirectory) {
			await removeFile(stalePath);
			return true;
		}
		await removeFile(join(stalePath, FILE_LOCK_COMPATIBLE_OWNER_FILE));
		await removeDirectoryBestEffort(stalePath, FILE_LOCK_STALE_GATE_CLEANUP_WARNING);
		return true;
	} finally {
		await takeover.release();
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/file-lock.js
function parseClaim(value, id) {
	if (!isPlainRecord(value)) return void 0;
	if (value.version !== 1 || value.id !== id || typeof value.pid !== "number" || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.choosing !== "boolean" || typeof value.ticket !== "number" || !Number.isSafeInteger(value.ticket) || value.ticket < 0 || (value.choosing ? value.ticket !== 0 : value.ticket === 0)) return;
	return value;
}
async function publishClaim(filePath, claim, create, deadline) {
	const temporaryPath = join(dirname(filePath), `.${claim.id}.${randomUUID()}${FILE_LOCK_TEMP_SUFFIX}`);
	try {
		await writeFile(temporaryPath, JSON.stringify(claim), {
			flag: "wx",
			mode: 384
		});
		if (create) await link(temporaryPath, filePath);
		else {
			const replacementDeadline = deadline ?? performance$1.now() + 100;
			for (;;) try {
				await rename(temporaryPath, filePath);
				break;
			} catch (error) {
				if (errorCode(error) !== "EPERM") throw error;
				await waitForNextScan(replacementDeadline, dirname(filePath));
			}
		}
	} finally {
		await removeFile(temporaryPath);
	}
}
async function createClaim(claimDirectory) {
	for (;;) {
		const id = randomUUID();
		const claim = {
			version: 1,
			id,
			pid: process.pid,
			choosing: true,
			ticket: 0
		};
		try {
			const path = join(claimDirectory, `${id}${FILE_LOCK_CLAIM_EXTENSION}`);
			await publishClaim(path, claim, true);
			startHeartbeat(path, id);
			return claim;
		} catch (error) {
			if (errorCode(error) !== "EEXIST") throw error;
		}
	}
}
async function scanClaims(claimDirectory, ownPath) {
	const entries = await readdir(claimDirectory, { withFileTypes: true });
	const claims = [];
	const reference = ownPath === void 0 ? void 0 : await modifiedAt(ownPath);
	const abandoned = async (path) => {
		if (reference === void 0) return false;
		const modified = await modifiedAt(path);
		if (modified === void 0 || reference - modified < 3e3) return false;
		return removeFile(path);
	};
	for (const entry of entries) {
		if (!entry.name.endsWith(".json")) continue;
		const id = entry.name.slice(0, -5);
		const path = join(claimDirectory, entry.name);
		if (!entry.isFile()) return {
			claims,
			blocked: true
		};
		let value;
		try {
			value = JSON.parse(await readFile(path, FILE_LOCK_ENCODING));
		} catch (error) {
			if (errorCode(error) === "ENOENT") continue;
			if (await abandoned(path)) continue;
			return {
				claims,
				blocked: true,
				transient: isBusyFileError(error)
			};
		}
		const claim = parseClaim(value, id);
		if (!claim) {
			if (await abandoned(path)) continue;
			return {
				claims,
				blocked: true
			};
		}
		const alive = processIsAlive(claim.pid);
		if (alive === false) {
			if (!await removeFile(path)) return {
				claims,
				blocked: true
			};
			continue;
		}
		if (await abandoned(path)) continue;
		if (alive === void 0) return {
			claims,
			blocked: true
		};
		claims.push(claim);
	}
	return {
		claims,
		blocked: false
	};
}
async function modifiedAt(path) {
	try {
		return (await lstat(path)).mtimeMs;
	} catch (error) {
		if (errorCode(error) === "ENOENT") return void 0;
		throw error;
	}
}
function claimPath(claimDirectory, id) {
	return join(claimDirectory, `${id}${FILE_LOCK_CLAIM_EXTENSION}`);
}
function hasClaimState(claims, id, choosing, ticket) {
	const claim = claims.find((peer) => peer.id === id);
	return claim?.choosing === choosing && claim.ticket === ticket;
}
function makeHandle(claimDirectory, claim) {
	let releasePromise;
	return {
		async assertHeld() {
			if (await modifiedAt(claimPath(claimDirectory, claim.id)) === void 0) throw new Error(FILE_LOCK_LOST_MESSAGE);
		},
		release() {
			stopHeartbeat(claim.id);
			releasePromise ??= removeFile(claimPath(claimDirectory, claim.id)).then((removed) => {
				if (!removed) throw new Error(FILE_LOCK_RELEASE_MESSAGE);
			});
			return releasePromise;
		}
	};
}
async function beginClaim(filePath) {
	const claimDirectory = `${resolve(filePath)}${FILE_LOCK_DIRECTORY_SUFFIX}`;
	for (;;) try {
		await assertSafeClaimDirectory(claimDirectory);
		await mkdir(claimDirectory, {
			recursive: true,
			mode: 448
		});
		await assertSafeClaimDirectory(claimDirectory);
		await chmod(claimDirectory, 448);
		return {
			claimDirectory,
			claim: await createClaim(claimDirectory)
		};
	} catch (error) {
		if (errorCode(error) !== "ENOENT") throw error;
	}
}
async function assertSafeClaimDirectory(claimDirectory) {
	let stat;
	try {
		stat = await lstat(claimDirectory);
	} catch (error) {
		if (errorCode(error) === "ENOENT") return;
		throw error;
	}
	if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(FILE_LOCK_UNSAFE_DIRECTORY_MESSAGE);
}
function isStillBusy(attempt, scan) {
	return !attempt.waitForPeers && scan.blocked && scan.transient === true && performance$1.now() < attempt.busyDeadline;
}
async function waitOrReleaseClaim(attempt) {
	if (!attempt.waitForPeers) {
		await makeHandle(attempt.claimDirectory, attempt.claim).release();
		return false;
	}
	await waitForNextScan(attempt.deadline, attempt.claimDirectory);
	return true;
}
async function observePeers(attempt, expectedChoosing, expectedTicket) {
	for (;;) {
		const scan = await scanClaims(attempt.claimDirectory, attempt.ownPath);
		if (isStillBusy(attempt, scan)) {
			await setTimeout$1(10);
			continue;
		}
		if (scan.blocked || !hasClaimState(scan.claims, attempt.claim.id, expectedChoosing, expectedTicket)) {
			if (!await waitOrReleaseClaim(attempt)) return void 0;
			continue;
		}
		return scan.claims;
	}
}
async function takeTicket(attempt) {
	const { claim, claimDirectory, ownPath, waitForPeers } = attempt;
	const claims = await observePeers(attempt, true, 0);
	if (claims === void 0) return void 0;
	if (!waitForPeers && claims.some((peer) => peer.id !== claim.id && !peer.choosing)) {
		await makeHandle(claimDirectory, claim).release();
		return;
	}
	let maxTicket = 0;
	for (const peer of claims) maxTicket = Math.max(maxTicket, peer.ticket);
	if (maxTicket >= Number.MAX_SAFE_INTEGER) throw new Error(FILE_LOCK_TICKET_LIMIT_MESSAGE);
	const ticketedClaim = {
		...claim,
		choosing: false,
		ticket: maxTicket + 1
	};
	await publishClaim(ownPath, ticketedClaim, false, waitForPeers ? attempt.deadline : attempt.busyDeadline);
	return ticketedClaim;
}
async function waitForTurn(attempt, ticketedClaim) {
	const { claim, claimDirectory, waitForPeers } = attempt;
	const choosingDeadline = performance$1.now() + FILE_LOCK_TRY_CHOOSING_WAIT_MS;
	for (;;) {
		const claims = await observePeers(attempt, false, ticketedClaim.ticket);
		if (claims === void 0) return void 0;
		const peers = claims.filter((peer) => peer.id !== claim.id);
		if (!waitForPeers && !peers.some((peer) => !peer.choosing && precedes(peer, ticketedClaim)) && peers.some((peer) => peer.choosing) && performance$1.now() < choosingDeadline) {
			await setTimeout$1(10);
			continue;
		}
		if (peers.some((peer) => precedes(peer, ticketedClaim))) {
			if (!await waitOrReleaseClaim(attempt)) return void 0;
			continue;
		}
		if (waitForPeers && performance$1.now() > attempt.deadline) throw new FileLockTimeoutError(claimDirectory);
		return {
			claimDirectory,
			claim: ticketedClaim
		};
	}
}
async function acquireClaim(filePath, waitForPeers, deadline) {
	const { claimDirectory, claim } = await beginClaim(filePath);
	const attempt = {
		filePath,
		claimDirectory,
		claim,
		ownPath: claimPath(claimDirectory, claim.id),
		waitForPeers,
		deadline,
		busyDeadline: performance$1.now() + FILE_LOCK_TRY_CHOOSING_WAIT_MS
	};
	try {
		const ticketedClaim = await takeTicket(attempt);
		if (!ticketedClaim) return void 0;
		return await waitForTurn(attempt, ticketedClaim);
	} catch (error) {
		await makeHandle(claimDirectory, claim).release();
		throw error;
	}
}
async function tryAcquireFileLock(filePath) {
	const acquired = await acquireClaim(filePath, false, 0);
	if (!acquired) return void 0;
	return makeHandle(acquired.claimDirectory, acquired.claim);
}
async function acquireCompatibleDirectoryFileLock(filePath, options) {
	const resolvedPath = resolve(filePath);
	const deadline = performance$1.now() + timeoutMs(options);
	const gate = await acquireLegacyDirectoryGate(resolvedPath, deadline, tryAcquireFileLock);
	let acquired;
	try {
		acquired = await acquireClaim(resolvedPath, true, deadline);
		if (!acquired) throw new Error(FILE_LOCK_ACQUIRE_MESSAGE);
	} catch (error) {
		try {
			await releaseLegacyDirectoryGate(gate);
		} catch (cleanupError) {
			throw new AggregateError([error, cleanupError], FILE_LOCK_COMPATIBLE_ACQUIRE_CLEANUP_MESSAGE, { cause: cleanupError });
		}
		throw error;
	}
	const sharedHandle = makeHandle(acquired.claimDirectory, acquired.claim);
	let releasePromise;
	return {
		assertHeld: () => sharedHandle.assertHeld(),
		release() {
			releasePromise ??= (async () => {
				const errors = [];
				try {
					await sharedHandle.release();
				} catch (error) {
					errors.push(error);
				}
				try {
					await releaseLegacyDirectoryGate(gate);
				} catch (error) {
					errors.push(error);
				}
				if (errors.length === 1) throw errors[0];
				if (errors.length > 1) throw new AggregateError(errors, FILE_LOCK_COMPATIBLE_RELEASE_MESSAGE);
			})();
			return releasePromise;
		}
	};
}
function precedes(left, right) {
	return left.ticket < right.ticket || left.ticket === right.ticket && left.id < right.id;
}
async function withFileLock(filePath, callback, options) {
	const waitMs = timeoutMs(options);
	const acquired = await acquireClaim(filePath, true, performance$1.now() + waitMs);
	if (!acquired) throw new Error(FILE_LOCK_ACQUIRE_MESSAGE);
	const handle = makeHandle(acquired.claimDirectory, acquired.claim);
	try {
		return await callback(handle);
	} finally {
		await handle.release();
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/policy-file.js
function readPolicyFile(path, options) {
	let raw;
	try {
		if (options.requireRegularFile && !lstatSync(path).isFile()) throw new Error(POLICY_NOT_REGULAR_MESSAGE);
		raw = readFileSync(path, POLICY_FILE_ENCODING);
	} catch (error) {
		if (errorCode(error) === "ENOENT") try {
			lstatSync(path);
		} catch (statError) {
			if (errorCode(statError) === "ENOENT") return options.empty();
			throw statError;
		}
		throw error;
	}
	const policy = options.parse(JSON.parse(raw));
	if (policy === void 0) throw new TypeError(POLICY_PARSE_RESULT_MESSAGE);
	return policy;
}
async function updatePolicyFile(path, options, update) {
	const lockPath = `${path}${FILE_LOCK_DIRECTORY_SUFFIX}`;
	const lock = await acquirePolicyLock(path);
	const warnings = [];
	try {
		const policy = readPolicyForUpdate(path, options);
		const updated = update(policy);
		if (isThenable(updated)) throw new TypeError(POLICY_ASYNC_UPDATE_MESSAGE);
		await replacePolicyFile(path, updated === void 0 ? policy : updated, warnings);
		if (process.platform !== "win32") await syncPolicyDirectory(path, warnings);
	} finally {
		await bestEffort(warnings, async () => {
			await lock.release();
			await removeEmptyLockFolders(path, dirname(path));
		}, `${POLICY_LOCK_CLEANUP_FAILED_PREFIX} ${lockPath}. ${POLICY_LOCK_RELEASE_WARNING}`);
	}
	return warnings.length ? { warning: warnings.join("; ") } : {};
}
async function bestEffort(warnings, action, message) {
	try {
		await action();
	} catch (error) {
		warnings.push(`${message}: ${describe(error)}`);
	}
}
function acquirePolicyLock(path) {
	return acquireCompatibleDirectoryFileLock(path, { timeoutMs: POLICY_LOCK_TIMEOUT_MS }).catch((error) => {
		const timeout = findLockTimeout(error);
		if (timeout !== void 0) throw new Error(`${POLICY_LOCK_TIMEOUT_ERROR} ${timeout.blockedPath}. ${POLICY_LOCK_TIMEOUT_MESSAGE}`, { cause: error });
		throw error;
	});
}
function readPolicyForUpdate(path, options) {
	try {
		return readPolicyFile(path, options);
	} catch (error) {
		throw new Error(`${POLICY_CANNOT_READ_PREFIX} ${path}. ${POLICY_UNREADABLE_MESSAGE}`, { cause: error });
	}
}
async function writePolicyTemp(tempPath, policy, warnings) {
	const temp = await open(tempPath, "wx", 384);
	try {
		await temp.writeFile(`${JSON.stringify(policy)}\n`, POLICY_FILE_ENCODING);
		await temp.sync();
	} catch (error) {
		await bestEffort(warnings, () => temp.close(), POLICY_TEMP_CLOSE_WARNING);
		throw error;
	}
	await temp.close();
}
async function replacePolicyFile(path, policy, warnings) {
	const tempPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
	try {
		await writePolicyTemp(tempPath, policy, warnings);
		await rename(tempPath, path);
	} catch (error) {
		await bestEffort(warnings, () => unlink(tempPath), POLICY_TEMP_CLEANUP_WARNING);
		throw error;
	}
}
async function syncPolicyDirectory(path, warnings) {
	await bestEffort(warnings, async () => {
		const directory = await open(dirname(path), "r");
		try {
			await directory.sync();
		} finally {
			await bestEffort(warnings, () => directory.close(), POLICY_DIRECTORY_CLOSE_WARNING);
		}
	}, POLICY_DURABILITY_WARNING);
}
function isThenable(value) {
	return typeof Reflect.get(Object(value), "then") === "function";
}
function findLockTimeout(error) {
	if (error instanceof FileLockTimeoutError) return error;
	if (!(error instanceof AggregateError)) return void 0;
	return error.errors.map(findLockTimeout).find((found) => found !== void 0);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/errors.js
var CaptureRecordInvalidError = class extends Error {};
var CaptureRecordVersionError = class extends Error {};
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/files/publish.js
function publishByRename(path, contents, tempSuffix, mode) {
	const temp = `${path}.${randomUUID()}${tempSuffix}`;
	const fd = openSync(temp, "wx", mode);
	try {
		writeSync(fd, contents);
	} finally {
		closeSync(fd);
	}
	renameSync(temp, path);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/state-constants.js
const STATE_TEMP_SUFFIX = ".state.tmp";
const STATE_CORRUPT_SUFFIX = ".corrupt";
const STATE_FILE_ENCODING = "utf-8";
const STATE_LOCK_RELEASE_WARNING = "Could not release the shared state lock";
const STATE_LOCK_BUSY_WARNING = "Another process holds the state lock, so state updates in this hook are saved for the next lock holder";
const STATE_CORRUPT_WARNING = `State was unreadable; started over and kept the old file as ${STATE_CORRUPT_SUFFIX}`;
const STATE_LOCK_WAIT_MS = 1e3;
const PENDING_STATE_DIR_SUFFIX = ".pending";
const PENDING_STATE_FILE_SUFFIX = ".json";
const PENDING_STATE_TEMP_SUFFIX = ".pending.tmp";
const STATE_CLAIM_SUFFIX = ".claim";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/state-pending.js
let sequence = 0;
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function diffValue(path, before, after, operations) {
	if (same(before, after)) return;
	if (isPlainRecord(before) && isPlainRecord(after)) {
		for (const key of Object.keys(before)) if (before[key] !== void 0 && after[key] === void 0) operations.push({
			path: [...path, key],
			unset: true
		});
		for (const [key, value] of Object.entries(after)) if (value !== void 0) diffValue([...path, key], before[key], value, operations);
	} else if (Array.isArray(before) && Array.isArray(after)) {
		const kept = new Set(after.map((item) => JSON.stringify(item)));
		const known = new Set(before.map((item) => JSON.stringify(item)));
		const add = after.filter((item) => !known.has(JSON.stringify(item)));
		const remove = before.filter((item) => !kept.has(JSON.stringify(item)));
		operations.push({
			path,
			add,
			remove
		});
	} else operations.push({
		path,
		set: after
	});
}
function diffState(before, after) {
	const patch = [];
	for (const session of Object.keys(before)) if (!Object.hasOwn(after, session)) patch.push({
		session,
		removed: true
	});
	for (const [session, next] of Object.entries(after)) {
		const operations = [];
		if (Object.hasOwn(before, session)) diffValue([], before[session], next, operations);
		else operations.push({
			path: [],
			set: next
		});
		if (operations.length > 0) patch.push({
			session,
			operations
		});
	}
	return patch;
}
function applyOperation(root, operation) {
	const { path } = operation;
	if (path.length === 0) return operation.set;
	const [key, ...rest] = path;
	const node = isPlainRecord(root) ? { ...root } : {};
	if (rest.length > 0) node[key] = applyOperation(node[key], {
		...operation,
		path: rest
	});
	else if (operation.unset) delete node[key];
	else if (operation.add || operation.remove) node[key] = mergeList(node[key], operation);
	else node[key] = operation.set;
	return node;
}
function mergeList(current, operation) {
	const removed = new Set((operation.remove ?? []).map((item) => JSON.stringify(item)));
	const list = (Array.isArray(current) ? current : []).filter((item) => !removed.has(JSON.stringify(item)));
	const present = new Set(list.map((item) => JSON.stringify(item)));
	for (const item of operation.add ?? []) if (!present.has(JSON.stringify(item))) list.push(item);
	return list;
}
function applyPatches(state, patches) {
	let result = state;
	for (const patch of patches) for (const entry of patch) {
		if (entry.removed) {
			result = Object.fromEntries(Object.entries(result).filter(([id]) => id !== entry.session));
			continue;
		}
		let session = result[entry.session];
		for (const operation of entry.operations ?? []) session = applyOperation(session, operation);
		result = {
			...result,
			[entry.session]: session
		};
	}
	return result;
}
const pendingDirectory = (stateFilePath) => `${stateFilePath}${PENDING_STATE_DIR_SUFFIX}`;
function names(directory) {
	try {
		return readdirSync(directory);
	} catch {
		return [];
	}
}
function writePending(stateFilePath, patch) {
	if (patch.length === 0) return;
	const directory = pendingDirectory(stateFilePath);
	const time = String(Date.now()).padStart(13, "0");
	const order = String(sequence++).padStart(6, "0");
	const file = join(directory, `${time}-${order}-${process.pid}${PENDING_STATE_FILE_SUFFIX}`);
	for (let attempt = 1;; attempt++) try {
		mkdirSync(directory, {
			recursive: true,
			mode: 448
		});
		publishByRename(file, JSON.stringify(patch), PENDING_STATE_TEMP_SUFFIX, 384);
		return;
	} catch (error) {
		if (attempt >= 3) throw error;
	}
}
function readPending(stateFilePath) {
	const directory = pendingDirectory(stateFilePath);
	const files = [];
	const patches = [];
	for (const name of names(directory).filter((n) => n.endsWith(PENDING_STATE_FILE_SUFFIX)).toSorted()) {
		const file = join(directory, name);
		files.push(file);
		try {
			patches.push(JSON.parse(readFileSync(file, "utf-8")));
		} catch {
			continue;
		}
	}
	return {
		files,
		patches
	};
}
function hasRecentPending(stateFilePath) {
	const directory = pendingDirectory(stateFilePath);
	return names(directory).some((name) => {
		try {
			return name.endsWith(".json") && Date.now() - statSync(join(directory, name)).mtimeMs < 3e4;
		} catch {
			return false;
		}
	});
}
function removePending(stateFilePath, files) {
	const directory = pendingDirectory(stateFilePath);
	for (const file of files) rmSync(file, { force: true });
	for (const name of names(directory)) {
		if (name.endsWith(".json")) continue;
		const file = join(directory, name);
		try {
			if (Date.now() - statSync(file).mtimeMs > 6e4) rmSync(file, { force: true });
		} catch {
			continue;
		}
	}
	if (names(directory).length > 0) return;
	try {
		rmdirSync(directory);
	} catch {
		return;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/state-store.js
function createStateStore(options) {
	const { path } = options;
	const warn = options.warn ?? console.warn;
	function read() {
		const { patches } = readPending(path);
		return applyPatches(readStateFile(path), patches);
	}
	async function update(fn) {
		const waitMs = hasRecentPending(path) ? 200 : STATE_LOCK_WAIT_MS;
		if (await withStateFileLock(path, warn, () => {
			const { files, patches } = readPending(path);
			const current = readStateFile(path, () => setAsideCorruptState(path, warn));
			publishState(path, fn(applyPatches(current, patches)));
			removePending(path, files);
		}, waitMs)) return;
		const before = read();
		writePending(path, diffState(before, fn(before)));
	}
	return {
		read,
		update
	};
}
function pruneStateEntries(state, maxAgeMs, now = Date.now()) {
	const cutoff = now - maxAgeMs;
	const pruned = {};
	for (const [id, entry] of Object.entries(state)) if ((entry.updated ? new Date(entry.updated).getTime() : 0) >= cutoff) Object.defineProperty(pruned, id, {
		value: entry,
		writable: true,
		enumerable: true,
		configurable: true
	});
	return pruned;
}
function readStateFile(path, onUnparseable) {
	let raw;
	try {
		raw = readFileSync(path, STATE_FILE_ENCODING);
	} catch {
		return {};
	}
	try {
		const parsed = JSON.parse(raw);
		return isPlainRecord(parsed) ? parsed : {};
	} catch {
		onUnparseable?.();
		return {};
	}
}
function setAsideCorruptState(path, warn) {
	try {
		renameSync(path, `${path}${STATE_CORRUPT_SUFFIX}`);
	} catch {}
	warn(STATE_CORRUPT_WARNING);
}
function publishState(path, state) {
	publishByRename(path, JSON.stringify(state, null, 2), STATE_TEMP_SUFFIX, 384);
}
async function withStateFileLock(path, warn, callback, waitMs) {
	let lock;
	try {
		lock = await acquireCompatibleDirectoryFileLock(path, { timeoutMs: waitMs });
	} catch (error) {
		if (!(error instanceof FileLockTimeoutError)) throw error;
		warn(STATE_LOCK_BUSY_WARNING);
		return false;
	}
	try {
		await callback();
	} finally {
		try {
			await lock.release();
		} catch (error) {
			warn(`${STATE_LOCK_RELEASE_WARNING}: ${error}`);
		}
	}
	return true;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/state-claim.js
async function claimStateEntry(path, key, windowMs) {
	mkdirSync(dirname(path), {
		recursive: true,
		mode: 448
	});
	const lock = await tryAcquireFileLock(`${path}${STATE_CLAIM_SUFFIX}`);
	if (lock === void 0) return false;
	try {
		const store = createStateStore({
			path,
			warn: () => void 0
		});
		const now = Date.now();
		const age = now - (store.read()[key]?.at ?? -Infinity);
		if (age > -6e4 && age < windowMs) return false;
		await store.update((state) => ({
			...state,
			[key]: { at: now }
		}));
		return true;
	} finally {
		await lock.release();
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/paths.js
function validateIntegration(value) {
	if (!CAPTURE_INTEGRATION.test(value)) throw new TypeError("Invalid integration namespace");
}
function validateIdentifier(value, name) {
	if (value.length === 0 || Buffer.byteLength(value, "utf8") > 4096 || hasControlCharacter(value)) throw new TypeError(`Invalid ${name}`);
}
function hasControlCharacter(value) {
	for (const character of value) {
		const codePoint = character.codePointAt(0);
		if (codePoint !== void 0 && (codePoint < 32 || codePoint === 127)) return true;
	}
	return false;
}
function identifierHash(value) {
	return createHash("sha256").update(value).digest("hex");
}
function captureRoot(storage) {
	return typeof storage === "string" ? resolve(storage) : storage.root;
}
function captureDirectory(storage) {
	const directory = typeof storage === "string" ? CAPTURE_TURNS_DIRECTORY : storage.directory;
	if (directory !== "turns" && directory !== "jobs") throw new TypeError(CAPTURE_STORAGE_DIRECTORY_MESSAGE);
	return directory;
}
function sessionSegments(sessionHash) {
	return [CAPTURE_SESSIONS_DIRECTORY, sessionHash];
}
function eventSegments(storage, scope) {
	const segments = [...sessionSegments(identifierHash(scope.sessionId)), captureDirectory(storage)];
	return captureDirectory(storage) === "turns" ? [...segments, identifierHash(scope.turnId)] : segments;
}
function sessionsDirectory(root, integration) {
	validateIntegration(integration);
	return join(captureRoot(root), CAPTURE_SESSIONS_DIRECTORY);
}
function turnsDirectory(root, integration, sessionHash) {
	return join(sessionsDirectory(root, integration), sessionHash, captureDirectory(root));
}
function eventsDirectory(turns, turnHash) {
	return join(turns, turnHash);
}
function eventPath(root, scope) {
	const eventId = captureDirectory(root) === "turns" ? scope.eventId : JSON.stringify([scope.turnId, scope.eventId]);
	return join(captureRoot(root), ...eventSegments(root, scope), `${identifierHash(eventId)}${CAPTURE_FILE_EXTENSION}`);
}
function recordLockPath(root, scope) {
	return `${eventPath(root, scope).slice(0, -5)}${CAPTURE_LOCK_EXTENSION}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/utils/atomic-file.js
async function ensurePrivateDirectory(root, segments) {
	return retryRemovedDirectory(() => createPrivateDirectory(root, segments));
}
async function retryRemovedDirectory(operation) {
	for (let attempt = 1;; attempt += 1) try {
		return await operation();
	} catch (error) {
		const code = errorCode(error);
		if (!CAPTURE_REMOVED_DIRECTORY_CODES.some((removed) => removed === code) || attempt >= 100) throw error;
	}
}
async function createPrivateDirectory(root, segments) {
	await mkdir(root, {
		recursive: true,
		mode: 448
	});
	const rootInfo = await lstat(root);
	if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error("Capture root must be a real directory");
	let current = root;
	for (const segment of segments) {
		current = join(current, segment);
		try {
			await mkdir(current, { mode: 448 });
		} catch (error) {
			if (errorCode(error) !== "EEXIST") throw error;
		}
		const info = await lstat(current);
		if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Capture path contains a non-directory");
		await chmod(current, 448);
		const checked = await lstat(current);
		if (!checked.isDirectory() || checked.isSymbolicLink()) throw new Error("Capture path changed during setup");
	}
	return current;
}
async function publishExclusive(path, contents, beforeCommit) {
	const directory = dirname(path);
	const stagingPath = join(directory, `.${randomUUID()}.tmp`);
	const handle = await open(stagingPath, "wx", 384);
	try {
		await handle.writeFile(contents, "utf8");
		await handle.chmod(384);
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		beforeCommit?.();
		await link(stagingPath, path);
		await syncDirectory(directory);
		return true;
	} catch (error) {
		if (errorCode(error) === "EEXIST") return false;
		throw error;
	} finally {
		await unlink(stagingPath).catch((error) => {
			if (errorCode(error) !== "ENOENT") throw error;
		});
	}
}
async function replacePrivateFile(root, path, contents, beforeCommit) {
	if (!await hasRealParentDirectories(root, path)) throw new Error("Capture record parent directory is missing");
	const original = await lstat(path);
	if (!original.isFile() || original.isSymbolicLink() || !hasPrivateFileMode(original.mode)) throw new Error("Capture record must be a private regular file");
	const directory = dirname(path);
	const stagingPath = join(directory, `.${randomUUID()}.tmp`);
	let handle;
	let stagingCreated = false;
	let operationFailed = false;
	let operationError;
	try {
		handle = await open(stagingPath, "wx", 384);
		stagingCreated = true;
		await handle.writeFile(contents, "utf8");
		await handle.chmod(384);
		await handle.sync();
		await handle.close();
		handle = void 0;
		const current = await lstat(path);
		if (!current.isFile() || current.isSymbolicLink() || current.dev !== original.dev || current.ino !== original.ino || !hasPrivateFileMode(current.mode)) throw new Error("Capture record changed during replacement");
		await beforeCommit?.();
		await rename(stagingPath, path);
		await syncDirectory(directory);
	} catch (error) {
		operationFailed = true;
		operationError = error;
	}
	const cleanupErrors = [];
	if (handle !== void 0) try {
		await handle.close();
	} catch (error) {
		cleanupErrors.push(error);
	}
	if (stagingCreated) try {
		await unlink(stagingPath);
	} catch (error) {
		if (errorCode(error) !== "ENOENT") cleanupErrors.push(error);
	}
	if (operationFailed && cleanupErrors.length > 0) throw new AggregateError([operationError, ...cleanupErrors], "Capture replacement failed");
	if (operationFailed) throw operationError;
	if (cleanupErrors.length === 1) throw cleanupErrors[0];
	if (cleanupErrors.length > 1) throw new AggregateError(cleanupErrors, "Capture replacement cleanup failed");
}
function hasPrivateFileMode(mode) {
	return process.platform === "win32" || (mode & 63) === 0;
}
async function readPrivateFile(root, path) {
	if (!await hasRealParentDirectories(root, path)) return void 0;
	let handle;
	try {
		const info = await lstat(path);
		if (!info.isFile() || info.isSymbolicLink()) throw new Error("Capture record must be a regular file");
		handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	} catch (error) {
		if (errorCode(error) === "ENOENT") return void 0;
		throw error;
	}
	try {
		if (!(await handle.stat()).isFile()) throw new Error("Capture record must be a regular file");
		return await handle.readFile("utf8");
	} finally {
		await handle.close();
	}
}
async function hasRealParentDirectories(root, path) {
	const relativeDirectory = relative(root, dirname(path));
	if (relativeDirectory === ".." || relativeDirectory.startsWith(`..${sep}`) || isAbsolute(relativeDirectory)) throw new Error("Capture path is outside storage root");
	const directories = [root];
	let current = root;
	for (const segment of relativeDirectory.split(sep).filter(Boolean)) {
		current = join(current, segment);
		directories.push(current);
	}
	for (const directory of directories) {
		let info;
		try {
			info = await lstat(directory);
		} catch (error) {
			if (errorCode(error) === "ENOENT") return false;
			throw error;
		}
		if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Capture path contains a non-directory");
	}
	return true;
}
async function syncDirectory(path) {
	if (process.platform === "win32") return;
	const handle = await open(path, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0));
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/files/private-directory.js
async function listPrivateDirectory(root, directory) {
	const storageRoot = resolve(root);
	const target = resolve(directory);
	const relativePath = relative(storageRoot, target);
	if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) throw new Error("Private directory is outside storage root");
	let current = storageRoot;
	for (const segment of ["", ...relativePath.split(sep).filter(Boolean)]) {
		if (segment) current = join(current, segment);
		const info = await lstatDirectory(current);
		if (!info) return void 0;
		if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Private path contains a non-directory");
	}
	const entries = await readdir(target, { withFileTypes: true });
	const finalInfo = await lstat(target);
	if (!finalInfo.isDirectory() || finalInfo.isSymbolicLink()) throw new Error("Private path changed during enumeration");
	return entries;
}
async function lstatDirectory(path) {
	try {
		return await lstat(path);
	} catch (error) {
		if (errorCode(error) === "ENOENT") return void 0;
		throw error;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/scope.js
function scopeOf(value) {
	return {
		integration: value.integration,
		sessionId: value.sessionId,
		turnId: value.turnId,
		eventId: value.eventId
	};
}
function scopeKey(scope) {
	return JSON.stringify([
		scope.integration,
		scope.sessionId,
		scope.turnId,
		scope.eventId
	]);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/compare.js
function compareText(left, right) {
	if (left === right) return 0;
	return left < right ? -1 : 1;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/order.js
function compareCaptureOrder(left, right) {
	if (left.capturedAtMs !== right.capturedAtMs) return left.capturedAtMs < right.capturedAtMs ? -1 : 1;
	return compareText(left.eventId, right.eventId);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/utils/digest.js
function captureContentDigest(record) {
	const content = { ...record };
	delete content.version;
	delete content.capturedAtMs;
	delete content.delivery;
	delete content.destinationRoutes;
	return createHash("sha256").update(canonicalJson(content)).digest("hex");
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/markers.js
function markerPath(root, scope) {
	const path = eventPath(root, scope);
	return join(dirname(path), `${basename(eventPath(root, scope), CAPTURE_FILE_EXTENSION)}${CAPTURE_MARKER_SUFFIX}`);
}
function turnMarkerPath(root, scope) {
	return join(dirname(eventPath(root, scope)), CAPTURE_TURN_MARKER_FILE);
}
function needsMarker(record) {
	const outcomes = Object.values(record.delivery?.outcomes ?? {});
	return outcomes.length === 0 || outcomes.some(({ outcome }) => outcome === "dropped");
}
function markerOf(records) {
	return {
		version: 1,
		entries: Object.fromEntries(records.map((record) => [identifierHash(record.eventId), {
			runId: record.runId,
			outcomes: record.delivery?.outcomes ?? {}
		}])),
		unsettled: {
			outcome: "dropped",
			reason: CAPTURE_MARKER_REMOVED_REASON,
			recordedAt: (/* @__PURE__ */ new Date()).toISOString()
		}
	};
}
async function writeOutcomeMarker(root, scope, record) {
	if (!needsMarker(record)) return;
	await publishExclusive(markerPath(root, scope), JSON.stringify(markerOf([record])));
}
async function writeTurnMarker(root, records, settled) {
	const [first] = records;
	if (first === void 0) return;
	const path = turnMarkerPath(root, first);
	const previous = await readMarker(root, path);
	const fresh = markerOf(records);
	const marker = {
		...fresh,
		entries: {
			...previous?.entries,
			...fresh.entries
		},
		...(settled ?? previous?.settled) === void 0 ? {} : { settled: settled ?? previous?.settled }
	};
	if (previous === void 0) await publishExclusive(path, JSON.stringify(marker));
	else await replacePrivateFile(captureRoot(root), path, JSON.stringify(marker));
}
async function readSettledTurn(root, scope) {
	return (await readMarker(root, join(captureRoot(root), ...eventSegments(root, scope), CAPTURE_TURN_MARKER_FILE)))?.settled;
}
function isOutcome(value) {
	return isPlainRecord(value) && (value["outcome"] === "delivered" || value["outcome"] === "dropped") && typeof value["recordedAt"] === "string";
}
function isMarkerEntry(value) {
	return isPlainRecord(value) && typeof value["runId"] === "string" && isPlainRecord(value["outcomes"]) && Object.values(value["outcomes"]).every(isOutcome);
}
function isSettledTurn(value) {
	return isPlainRecord(value) && typeof value["rootRunId"] === "string" && isPlainRecord(value["attribution"]) && Object.values(value["attribution"]).every((entry) => typeof entry === "string");
}
function isMarker(value) {
	return value["version"] === 1 && isPlainRecord(value["entries"]) && Object.values(value["entries"]).every(isMarkerEntry) && isOutcome(value["unsettled"]) && (value["settled"] === void 0 || isSettledTurn(value["settled"]));
}
function parseMarker$1(contents) {
	try {
		const value = parseJsonObject(contents, CAPTURE_MARKER_INVALID_MESSAGE);
		return isMarker(value) ? value : void 0;
	} catch {
		return;
	}
}
async function readMarker(root, path) {
	const contents = await readPrivateFile(captureRoot(root), path);
	if (contents === void 0) return void 0;
	const marker = parseMarker$1(contents);
	if (marker !== void 0) return marker;
	console.warn(CAPTURE_MARKER_INVALID_WARNING, basename(path));
	await removeFileIfPresent(path);
}
async function readMarkerOutcome(root, scope, destination) {
	for (const path of [markerPath(root, scope), turnMarkerPath(root, scope)]) {
		const marker = await readMarker(root, path);
		const entry = marker?.entries[identifierHash(scope.eventId)];
		if (marker !== void 0 && entry !== void 0) return entry.outcomes[destination] ?? marker.unsettled;
	}
}
async function readDroppedRunIds(root, scope) {
	const runIds = /* @__PURE__ */ new Set();
	const directory = join(captureRoot(root), ...eventSegments(root, scope));
	for (const path of await markersIn(root, directory)) {
		const marker = await readMarker(root, path);
		for (const { runId, outcomes } of Object.values(marker?.entries ?? {})) if (Object.values(outcomes).every(({ outcome }) => outcome === "dropped")) runIds.add(runId);
	}
	return runIds;
}
async function forgetTurnMarkers(root, scope) {
	const paths = captureDirectory(root) === "jobs" ? [markerPath(root, scope)] : await markersIn(root, dirname(eventPath(root, scope)));
	for (const path of paths) await removeFileIfPresent(path);
}
async function markersIn(root, directory) {
	return (await listPrivateDirectory(captureRoot(root), directory) ?? []).filter((entry) => entry.isFile() && CAPTURE_MARKER_FILE.test(entry.name)).map((entry) => join(directory, entry.name));
}
async function removeStaleMarkers(root, integration, modifiedBeforeMs) {
	const sessions = sessionsDirectory(root, integration);
	let removed = 0;
	for (const session of await listPrivateDirectory(captureRoot(root), sessions) ?? []) {
		if (!session.isDirectory() || !CAPTURE_HASH.test(session.name)) continue;
		const turns = turnsDirectory(root, integration, session.name);
		const directories = captureDirectory(root) === "jobs" ? [turns] : (await listPrivateDirectory(captureRoot(root), turns) ?? []).filter((turn) => turn.isDirectory() && CAPTURE_HASH.test(turn.name)).map((turn) => eventsDirectory(turns, turn.name));
		for (const directory of directories) {
			removed += await removeOldMarkers(root, directory, modifiedBeforeMs);
			await removeEmptyAncestors(directory, captureRoot(root));
		}
	}
	return removed;
}
async function removeOldMarkers(root, directory, modifiedBeforeMs) {
	let removed = 0;
	for (const path of await markersIn(root, directory)) {
		const info = await lstat(path).catch((error) => {
			if (errorCode(error) === "ENOENT") return void 0;
			throw error;
		});
		if (info === void 0 || info.mtimeMs >= modifiedBeforeMs) continue;
		if (await removeFileIfPresent(path)) removed += 1;
	}
	return removed;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/capture-store.js
function createCaptureStore(root, directory = CAPTURE_TURNS_DIRECTORY) {
	const storageRoot = {
		root: resolve(root),
		directory
	};
	captureDirectory(storageRoot);
	return {
		capture: (input) => captureEvent(storageRoot, input),
		read: (scope) => readCapture(storageRoot, scope),
		async enumerate(integration, sessionId) {
			validateIntegration(integration);
			validateIdentifier(sessionId, "session ID");
			return enumerateTurns(storageRoot, integration, identifierHash(sessionId), () => true);
		},
		async enumerateTurn(integration, sessionId, turnId) {
			validateIntegration(integration);
			validateIdentifier(sessionId, "session ID");
			validateIdentifier(turnId, "turn ID");
			const turnHash = identifierHash(turnId);
			return enumerateTurns(storageRoot, integration, identifierHash(sessionId), (name) => name === turnHash);
		},
		enumerateSessions: (integration) => enumerateIntegrationSessions(storageRoot, integration),
		recordRetry: (scope, destination, retry) => recordRetryState(storageRoot, scope, destination, retry),
		recordOutcome: (input) => recordDeliveryOutcome(storageRoot, input),
		readOutcome: (scope, destination) => readDeliveryOutcome(storageRoot, scope, destination),
		remove: (scope, options) => removeCapture(storageRoot, scope, options),
		removeTurn: (records, settled) => removeTurnWithMarker(storageRoot, records, settled),
		readSettledTurn: (integration, sessionId, turnId) => readSettledTurn(storageRoot, {
			integration,
			sessionId,
			turnId
		}),
		readDroppedRunIds: (integration, sessionId, turnId) => readDroppedRunIds(storageRoot, {
			integration,
			sessionId,
			turnId
		}),
		removeStaleMarkers: (integration, modifiedBeforeMs) => removeStaleMarkers(storageRoot, integration, modifiedBeforeMs)
	};
}
function buildCaptureRecord(input) {
	validateScope(input);
	const dependencies = normalizeDependencies(input.dependencies, input);
	validateIdentifier(input.runId, "run ID");
	validateIdentifier(input.destinationFingerprint, "destination fingerprint");
	validateIdentifier(input.eventKind, "event kind");
	return {
		version: 2,
		capturedAtMs: Date.now(),
		integration: input.integration,
		sessionId: input.sessionId,
		turnId: input.turnId,
		eventId: input.eventId,
		runId: input.runId,
		destinationFingerprint: input.destinationFingerprint,
		eventKind: input.eventKind,
		normalizedPayload: canonicalValue(input.normalizedPayload, /* @__PURE__ */ new Set()),
		turnEvidence: canonicalValue(input.turnEvidence, /* @__PURE__ */ new Set()),
		metadataProvenance: canonicalValue(input.metadataProvenance, /* @__PURE__ */ new Set()),
		...input.sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs: requireSafeEpochMilliseconds(input.sourceAgeStartedAtMs, "Source age") },
		...dependencies === void 0 ? {} : { dependencies },
		...input.destinationRoutes === void 0 ? {} : { destinationRoutes: normalizeDestinationRoutes(input.destinationRoutes) }
	};
}
async function publishCapture(root, input, record, contents) {
	const path = eventPath(root, input);
	return withRecordLock(root, input, async () => {
		if (await retryRemovedDirectory(async () => {
			await ensureEventDirectory(root, input.integration, input.sessionId, input.turnId);
			return publishExclusive(path, contents);
		})) return {
			status: "published",
			record
		};
		const previous = await readRecord(root, path);
		if (previous === void 0) return {
			status: "failed",
			code: "STORAGE_FAILED",
			message: "Published event disappeared"
		};
		if (!sameScope(previous, input)) return { status: "conflict" };
		return sameCapture(previous, record) ? {
			status: "duplicate",
			record: previous
		} : { status: "conflict" };
	});
}
async function captureEvent(root, input) {
	let record;
	let contents;
	try {
		record = buildCaptureRecord(input);
		contents = canonicalJson(record);
	} catch (error) {
		return failure("SERIALIZATION_FAILED", error);
	}
	try {
		return await publishCapture(root, input, record, contents);
	} catch (error) {
		return failure("STORAGE_FAILED", error);
	}
}
async function readCapture(root, scope) {
	validateScope(scope);
	const record = await readRecord(root, eventPath(root, scope));
	if (record === void 0) return void 0;
	if (!sameScope(record, scope)) throw new Error(CAPTURE_NAMESPACE_MISMATCH_MESSAGE);
	return record;
}
async function enumerateIntegrationSessions(root, integration) {
	validateIntegration(integration);
	const sessions = [];
	for (const directory of await listPrivateDirectory(captureRoot(root), sessionsDirectory(root, integration)) ?? []) {
		if (!directory.isDirectory() || !CAPTURE_HASH.test(directory.name)) continue;
		const captures = await enumerateTurns(root, integration, directory.name, () => true);
		if (captures.length > 0) sessions.push({
			sessionId: captures[0].record.sessionId,
			captures
		});
	}
	return sessions.toSorted((left, right) => left.sessionId === right.sessionId ? 0 : left.sessionId < right.sessionId ? -1 : 1);
}
async function recordRetryState(root, scope, destination, retry) {
	validateScope(scope);
	validateIdentifier(destination, "destination");
	requireNonNegativeInteger(retry.failures, "Delivery failures");
	requireSafeEpochMilliseconds(retry.notBeforeMs, "Retry time");
	if (retry.recordedAtMs !== void 0) requireSafeEpochMilliseconds(retry.recordedAtMs, "Retry record time");
	await withRecordLock(root, scope, async (lock) => {
		const path = eventPath(root, scope);
		const record = await readRecord(root, path);
		if (record === void 0) throw new Error(CAPTURE_RETRY_LOST_MESSAGE);
		const delivery = deliveryOf(record);
		await saveDelivery(root, path, record, {
			...delivery,
			retries: {
				...delivery.retries,
				[destination]: retry
			}
		}, lock);
	});
}
function validateOutcomeInput(input) {
	validateScope(input);
	validateIdentifier(input.destination, "destination");
	if (input.outcome !== "delivered" && input.outcome !== "dropped") throw new TypeError(CAPTURE_OUTCOME_INVALID_MESSAGE);
	if (input.reason !== void 0) validateIdentifier(input.reason, "outcome reason");
}
async function recordDeliveryOutcome(root, input) {
	try {
		validateOutcomeInput(input);
		return await withRecordLock(root, input, async (lock) => {
			const path = eventPath(root, input);
			const record = await readRecord(root, path);
			if (record === void 0) return { status: "missing-capture" };
			const delivery = deliveryOf(record);
			const previous = delivery.outcomes[input.destination];
			if (previous !== void 0) return sameOutcome(previous, input) ? {
				status: "duplicate",
				receipt: receiptOf(input, previous)
			} : { status: "conflict" };
			const outcome = {
				outcome: input.outcome,
				...input.reason === void 0 ? {} : { reason: input.reason },
				recordedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			await saveDelivery(root, path, record, {
				...delivery,
				outcomes: {
					...delivery.outcomes,
					[input.destination]: outcome
				}
			}, lock);
			return {
				status: "recorded",
				receipt: receiptOf(input, outcome)
			};
		});
	} catch (error) {
		return failure("STORAGE_FAILED", error);
	}
}
async function readDeliveryOutcome(root, scope, destination) {
	try {
		validateScope(scope);
		validateIdentifier(destination, "destination");
		const record = await readRecord(root, eventPath(root, scope));
		if (record === void 0) {
			const removed = await readMarkerOutcome(root, scope, destination);
			return removed === void 0 ? { status: "missing-capture" } : {
				status: "settled",
				receipt: receiptOf({
					...scope,
					destination
				}, removed)
			};
		}
		if (!sameScope(record, scope)) throw new Error(CAPTURE_NAMESPACE_MISMATCH_MESSAGE);
		const outcome = record.delivery?.outcomes[destination];
		return outcome === void 0 ? { status: "pending" } : {
			status: "settled",
			receipt: receiptOf({
				...scope,
				destination
			}, outcome)
		};
	} catch (error) {
		return failure("STORAGE_FAILED", error);
	}
}
async function removeTurnWithMarker(root, records, settled) {
	await writeTurnMarker(root, records, settled);
	for (const record of records) await removeCapture(root, scopeOf(record), {}, false);
}
async function removeCapture(root, scope, options = {}, leaveMarker = true) {
	validateScope(scope);
	await withRecordLock(root, scope, async () => {
		const path = eventPath(root, scope);
		const record = options.forgetTurn || !leaveMarker ? void 0 : await readRecord(root, path);
		if (record !== void 0 && captureDirectory(root) === "turns") await writeOutcomeMarker(root, scope, record);
		await removeFileIfPresent(path);
	});
	if (options.forgetTurn) await forgetTurnMarkers(root, scope);
	await removeEmptyLockFolders(recordLockPath(root, scope), captureRoot(root));
	await removeEmptyAncestors(dirname(eventPath(root, scope)), captureRoot(root));
}
async function saveDelivery(root, path, record, delivery, lock) {
	await replacePrivateFile(captureRoot(root), path, canonicalJson({
		...record,
		delivery
	}), () => lock.assertHeld());
}
async function ensureEventDirectory(root, integration, sessionId, turnId) {
	await ensurePrivateDirectory(captureRoot(root), eventSegments(root, {
		integration,
		sessionId,
		turnId
	}));
}
async function withRecordLock(root, scope, operation) {
	validateScope(scope);
	await ensurePrivateDirectory(captureRoot(root), eventSegments(root, scope));
	return withFileLock(recordLockPath(root, scope), operation);
}
function compareCaptures(left, right) {
	return compareCaptureOrder({
		capturedAtMs: left.capturedAtMs,
		eventId: left.record.eventId
	}, {
		capturedAtMs: right.capturedAtMs,
		eventId: right.record.eventId
	});
}
async function enumerateTurns(root, integration, sessionHash, wanted) {
	const turns = turnsDirectory(root, integration, sessionHash);
	const captures = [];
	if (captureDirectory(root) !== "turns") return enumerateEvents(root, turns, integration, sessionHash, wanted);
	for (const turn of await listPrivateDirectory(captureRoot(root), turns) ?? []) {
		if (!turn.isDirectory() || !CAPTURE_HASH.test(turn.name) || !wanted(turn.name)) continue;
		const eventDirectory = eventsDirectory(turns, turn.name);
		captures.push(...await enumerateEvents(root, eventDirectory, integration, sessionHash, (turnHash) => turnHash === turn.name));
	}
	return captures.toSorted(compareCaptures);
}
async function enumerateEvents(root, directory, integration, sessionHash, wanted) {
	const captures = [];
	for (const event of await listPrivateDirectory(captureRoot(root), directory) ?? []) {
		if (!event.isFile() || !CAPTURE_EVENT_FILE.test(event.name)) continue;
		const path = join(directory, event.name);
		const record = await readEvent(root, path);
		if (record === void 0 || identifierHash(record.sessionId) !== sessionHash || eventPath(root, record) !== path) {
			if (record !== void 0) await discardEvent(path, "it does not match its folder");
			continue;
		}
		if (record.integration !== integration || !wanted(identifierHash(record.turnId))) continue;
		const info = await lstat(path);
		captures.push({
			record,
			capturedAtMs: record.capturedAtMs,
			modifiedAtMs: info.mtimeMs
		});
	}
	return captures.toSorted(compareCaptures);
}
async function readEvent(root, path) {
	try {
		return await readRecord(root, path);
	} catch (error) {
		if (error instanceof CaptureRecordInvalidError) await discardEvent(path, describe(error));
		else console.warn(CAPTURE_SKIPPED_WARNING, `${basename(path)} (${describe(error)})`);
		return;
	}
}
async function discardEvent(path, reason) {
	await removeFileIfPresent(path);
	console.warn(CAPTURE_UNREADABLE_WARNING, `${basename(path)} (${reason})`);
}
function sameCapture(left, right) {
	return captureContentDigest(left) === captureContentDigest(right);
}
function deliveryOf(record) {
	return record.delivery ?? {
		retries: {},
		outcomes: {}
	};
}
function receiptOf(scope, outcome) {
	return {
		integration: scope.integration,
		sessionId: scope.sessionId,
		turnId: scope.turnId,
		eventId: scope.eventId,
		destination: scope.destination,
		...outcome
	};
}
function sameOutcome(outcome, input) {
	return outcome.outcome === input.outcome && outcome.reason === input.reason;
}
async function readRecord(root, path) {
	const contents = await readPrivateFile(captureRoot(root), path);
	if (contents === void 0) return void 0;
	let value;
	try {
		value = parseJsonObject(contents, "Invalid storage record");
	} catch (error) {
		throw new CaptureRecordInvalidError(describe(error));
	}
	if (typeof value.version === "number" && value.version !== 2) throw new CaptureRecordVersionError(`${CAPTURE_VERSION_UNSUPPORTED_MESSAGE} ${value.version}`);
	try {
		return validateRecord(value);
	} catch (error) {
		throw new CaptureRecordInvalidError(describe(error));
	}
}
function validateRecord(value) {
	if (value.version !== 2 || typeof value.capturedAtMs !== "number" || !Number.isSafeInteger(value.capturedAtMs) || !Number.isFinite(new Date(value.capturedAtMs).getTime()) || typeof value.integration !== "string" || typeof value.sessionId !== "string" || typeof value.turnId !== "string" || typeof value.eventId !== "string" || typeof value.runId !== "string" || typeof value.destinationFingerprint !== "string" || typeof value.eventKind !== "string" || !("normalizedPayload" in value) || !("turnEvidence" in value) || !("metadataProvenance" in value)) throw new Error(CAPTURE_RECORD_UNSUPPORTED_MESSAGE);
	if ("sourceAgeStartedAtMs" in value) requireSafeEpochMilliseconds(value["sourceAgeStartedAtMs"], "Stored source age");
	for (const [identifier, name] of [
		[value.runId, "run ID"],
		[value.destinationFingerprint, "destination fingerprint"],
		[value.eventKind, "event kind"]
	]) validateIdentifier(identifier, name);
	const scope = {
		integration: value.integration,
		sessionId: value.sessionId,
		turnId: value.turnId,
		eventId: value.eventId
	};
	validateScope(scope);
	const dependencies = normalizeDependencies(value.dependencies, scope);
	if ("destinationRoutes" in value) normalizeDestinationRoutes(value.destinationRoutes);
	const normalizedPayload = canonicalValue(value.normalizedPayload, /* @__PURE__ */ new Set());
	const delivery = "delivery" in value ? readDelivery(value.delivery) : void 0;
	return {
		...value,
		normalizedPayload,
		...dependencies === void 0 ? {} : { dependencies },
		...delivery === void 0 ? {} : { delivery }
	};
}
function readDelivery(value) {
	const record = parseRecordObject(value, "delivery");
	const retries = parseRecordObject(record.retries, "delivery retries");
	const outcomes = parseRecordObject(record.outcomes, "delivery outcomes");
	for (const [destination, retry] of Object.entries(retries)) {
		validateIdentifier(destination, "destination");
		const entry = parseRecordObject(retry, "delivery retry");
		requireNonNegativeInteger(entry.failures, "Stored delivery failures");
		requireSafeEpochMilliseconds(entry.notBeforeMs, "Stored retry time");
		if (entry.recordedAtMs !== void 0) requireSafeEpochMilliseconds(entry.recordedAtMs, "Stored retry record time");
	}
	for (const [destination, outcome] of Object.entries(outcomes)) {
		validateIdentifier(destination, "destination");
		const entry = parseRecordObject(outcome, "delivery outcome");
		const recordedAt = new Date(String(entry.recordedAt));
		if (entry.outcome !== "delivered" && entry.outcome !== "dropped" || "reason" in entry && typeof entry.reason !== "string" || !Number.isFinite(recordedAt.getTime()) || recordedAt.toISOString() !== entry.recordedAt) throw new Error(CAPTURE_OUTCOME_UNSUPPORTED_MESSAGE);
		if ("reason" in entry) validateIdentifier(entry.reason, "outcome reason");
	}
	return {
		retries,
		outcomes
	};
}
function parseRecordObject(value, name) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${CAPTURE_FIELD_UNSUPPORTED_MESSAGE} ${name}`);
	return value;
}
function validateScope(scope) {
	validateIntegration(scope.integration);
	validateIdentifier(scope.sessionId, "session ID");
	validateIdentifier(scope.turnId, "turn ID");
	validateIdentifier(scope.eventId, "event ID");
}
function normalizeDependencies(value, dependent) {
	if (value === void 0) return void 0;
	if (!Array.isArray(value)) throw new TypeError(CAPTURE_DEPENDENCIES_INVALID_MESSAGE);
	const seen = /* @__PURE__ */ new Set();
	return value.map((item) => {
		if (item === null || typeof item !== "object" || Array.isArray(item)) throw new TypeError(CAPTURE_DEPENDENCY_INVALID_MESSAGE);
		const candidate = item;
		if (typeof candidate.integration !== "string" || typeof candidate.sessionId !== "string" || typeof candidate.turnId !== "string" || typeof candidate.eventId !== "string") throw new TypeError(CAPTURE_DEPENDENCY_INVALID_MESSAGE);
		const dependency = {
			integration: candidate.integration,
			sessionId: candidate.sessionId,
			turnId: candidate.turnId,
			eventId: candidate.eventId
		};
		validateScope(dependency);
		if (dependency.integration !== dependent.integration) throw new TypeError(CAPTURE_DEPENDENCY_INTEGRATION_MESSAGE);
		if (sameScope(dependency, dependent)) throw new TypeError(CAPTURE_DEPENDENCY_SELF_MESSAGE);
		const key = canonicalJson(dependency);
		if (seen.has(key)) throw new TypeError(CAPTURE_DEPENDENCY_UNIQUE_MESSAGE);
		seen.add(key);
		return dependency;
	});
}
function normalizeDestinationRoutes(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(CAPTURE_ROUTES_INVALID_MESSAGE);
	const routes = {};
	for (const [destination, route] of Object.entries(value)) {
		validateIdentifier(destination, "destination");
		if (route === null || typeof route !== "object" || Array.isArray(route)) throw new TypeError(CAPTURE_ROUTE_INVALID_MESSAGE);
		const { projectName, sourceProjectName, ...extra } = route;
		if (Object.keys(extra).length > 0) throw new TypeError(CAPTURE_ROUTE_INVALID_MESSAGE);
		if (typeof projectName !== "string") throw new TypeError(CAPTURE_ROUTE_PROJECT_INVALID_MESSAGE);
		validateIdentifier(projectName, "route project");
		if (sourceProjectName !== void 0) {
			if (typeof sourceProjectName !== "string") throw new TypeError(CAPTURE_ROUTE_PROJECT_INVALID_MESSAGE);
			validateIdentifier(sourceProjectName, "route project");
		}
		routes[destination] = {
			projectName,
			...sourceProjectName === void 0 ? {} : { sourceProjectName }
		};
	}
	return routes;
}
function sameScope(record, scope) {
	return record.integration === scope.integration && record.sessionId === scope.sessionId && record.turnId === scope.turnId && record.eventId === scope.eventId;
}
function failure(code, error) {
	return {
		status: "failed",
		code: errorCode(error) ?? code,
		message: error instanceof Error ? error.message : String(error)
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/format.js
function fillTemplate(template, values) {
	return template.replace(TEMPLATE_PLACEHOLDER, (_match, key) => String(values[key]));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/account.js
function isWaitingForOtherSetting(record, accountFingerprint) {
	return record.destinationFingerprint !== accountFingerprint && Object.keys(record.delivery?.outcomes ?? {}).length === 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/expiry.js
function liveTurnSpans(captures) {
	const spans = /* @__PURE__ */ new Map();
	for (const { record, capturedAtMs } of captures) {
		if (record.sourceAgeStartedAtMs !== void 0) continue;
		const span = spans.get(record.turnId) ?? {
			firstMs: capturedAtMs,
			latestMs: capturedAtMs
		};
		spans.set(record.turnId, {
			firstMs: Math.min(span.firstMs, capturedAtMs),
			latestMs: Math.max(span.latestMs, capturedAtMs)
		});
	}
	return spans;
}
function expiryOf({ record, capturedAtMs }, spans, options) {
	const span = spans.get(record.turnId);
	if (record.sourceAgeStartedAtMs === void 0 && span !== void 0 && options.now - span.firstMs >= 6048e5) return "ceiling";
	const startedAtMs = record.sourceAgeStartedAtMs ?? span?.latestMs ?? capturedAtMs;
	return options.now - startedAtMs >= options.maxAgeMs ? "age" : void 0;
}
async function removeExpiredCaptures(options) {
	let dropped = 0;
	let pastCeiling = 0;
	let otherSetting = 0;
	let held = 0;
	for (const { captures } of await options.store.enumerateSessions(options.integration)) {
		const spans = liveTurnSpans(captures);
		const expiring = captures.flatMap((capture) => {
			const reason = expiryOf(capture, spans, options);
			return reason === void 0 ? [] : [{
				record: capture.record,
				reason
			}];
		});
		const sessionKeepsCaptures = expiring.length < captures.length;
		for (const { record, reason } of expiring) {
			if (options.heldUpdate?.(record, captures)) held += 1;
			await options.store.remove(record, { forgetTurn: !sessionKeepsCaptures });
			if (options.destinations.every((id) => record.delivery?.outcomes[id] !== void 0)) continue;
			dropped += 1;
			if (reason === "ceiling") pastCeiling += 1;
			if (options.accountFingerprint !== void 0 && isWaitingForOtherSetting(record, options.accountFingerprint)) otherSetting += 1;
		}
	}
	await options.store.removeStaleMarkers(options.integration, options.now - options.maxAgeMs);
	if (dropped > 0) console.warn(fillTemplate(CAPTURE_EXPIRED_WARNING, {
		dropped,
		ceiling: pastCeiling,
		otherSetting
	}));
	if (held > 0) console.warn(fillTemplate(CAPTURE_HELD_EXPIRED_WARNING, { held }));
	return dropped;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/background-worker/constants.js
const BACKGROUND_WORKER_LOCK_FILE = "worker";
const BACKGROUND_WORKER_PENDING_FILE = "wake.pending";
const BACKGROUND_WORKER_ACTIVE_PREFIX = "wake.active.";
const BACKGROUND_WORKER_LAUNCHING_FILE = "wake.launching";
const BACKGROUND_WORKER_STAGING_FILE = /^\.[0-9a-f-]{36}\.tmp$/u;
const BACKGROUND_WORKER_MARKER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const BACKGROUND_WORKER_ACTIVE_MARKER_NAME = /^wake\.active\.([0-9a-f-]{36})\.json$/u;
const BACKGROUND_WORKER_ATTEMPT_NAME = /^wake\.active\.([0-9a-f-]{36})\.attempt\.([1-9]\d*)\.json$/u;
const BACKGROUND_WORKER_OWNER_WAIT_MS = 5e3;
const BACKGROUND_WORKER_LAUNCH_LEASE_MS = 3e4;
const BACKGROUND_WORKER_STATE_ERROR = "Invalid background worker state";
const BACKGROUND_WORKER_LAUNCHER_MUST_RETURN_CHILD_PROCESS_ID_MESSAGE = "Background worker launcher must return a child process ID";
const BACKGROUND_WORKER_LAUNCH_IS_ALREADY_PENDING_MESSAGE = "Background worker launch is already pending";
const BACKGROUND_WORKER_MAX_ATTEMPTS_MUST_BE_POSITIVE_INTEGER_MESSAGE = "Background worker max attempts must be a positive integer";
const BACKGROUND_WORKER_RETRY_DELAY_MUST_BE_NON_NEGATIVE_MESSAGE = "Background worker retry delay must be non-negative";
const BACKGROUND_WORKER_STARTUP_WAIT_MUST_BE_POSITIVE_INTEGER_MESSAGE = "Background worker startup wait must be a positive integer";
const BACKGROUND_WORKER_ACTIVE_MARKER_ALREADY_EXISTS_MESSAGE = "Background worker active marker already exists";
const BACKGROUND_WORKER_RETRY_ATTEMPT_ALREADY_EXISTS_MESSAGE = "Background worker retry attempt already exists";
const BACKGROUND_WORKER_UNSAFE_LOCK_DIRECTORY_MESSAGE = "Unsafe background worker lock directory";
const BACKGROUND_WORKER_UNSAFE_PENDING_MARKER_MESSAGE = "Unsafe background worker pending marker";
const BACKGROUND_WORKER_UNSAFE_ACTIVE_MARKER_MESSAGE = "Unsafe background worker active marker";
const BACKGROUND_WORKER_INVALID_ACTIVE_PATH_MESSAGE = "Invalid background worker active path";
const BACKGROUND_WORKER_MULTIPLE_ACTIVE_MARKERS_MESSAGE = "Multiple background worker active markers";
const BACKGROUND_WORKER_ACTIVE_MARKER_PATH_MISMATCH_MESSAGE = "Background worker active marker path mismatch";
const BACKGROUND_WORKER_UNSAFE_RETRY_ATTEMPT_MESSAGE = "Unsafe background worker retry attempt";
const BACKGROUND_WORKER_INVALID_ATTEMPT_PATH_MESSAGE = "Invalid background worker attempt path";
const BACKGROUND_WORKER_UNSAFE_STAGING_FILE_MESSAGE = "Unsafe background worker staging file";
const BACKGROUND_WORKER_UNSAFE_LAUNCH_MARKER_MESSAGE = "Unsafe background worker launch marker";
const BACKGROUND_WORKER_UNEXPECTED_STATE_PATH_MESSAGE = "Unexpected background worker state path";
const BACKGROUND_WORKER_RETRY_SEQUENCE_HAS_GAP_MESSAGE = "Background worker retry sequence has a gap";
const BACKGROUND_WORKER_INVALID_LAUNCH_MARKER_MESSAGE = "Invalid background worker launch marker";
const BACKGROUND_WORKER_STATE_DISAPPEARED_MESSAGE = "Background worker state disappeared";
const BACKGROUND_WORKER_INVALID_MARKER_MESSAGE = "Invalid background worker marker";
const BACKGROUND_WORKER_INVALID_RETRY_ATTEMPT_MESSAGE = "Invalid background worker retry attempt";
const BACKGROUND_WORKER_FILE_PREFIX = "wake";
const BACKGROUND_WORKER_SCOPED_FILE = /^wake-[0-9a-f]{64}\.(?:pending|launching|active\.[0-9a-f-]{36}(?:\.attempt\.[1-9]\d*)?\.json)$/u;
const BACKGROUND_WORKER_SHARED_DIRECTORY = /^(?:turns|jobs|delivery\.claims|reconstruction\.claims|(?:worker|settlement)-[0-9a-f]{64}\.claims)$/u;
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/background-worker/paths.js
function validateWorkerScope(scope) {
	validateIntegration(scope.integration);
	validateIdentifier(scope.sessionId, "session ID");
	validateIdentifier(scope.accountFingerprint, "account fingerprint");
}
function workerDirectory(storageRoot, scope) {
	validateWorkerScope(scope);
	return join(resolve(storageRoot), ...sessionSegments(identifierHash(scope.sessionId)));
}
function workerLockPath(storageRoot, scope) {
	return join(workerDirectory(storageRoot, scope), `${BACKGROUND_WORKER_LOCK_FILE}-${identifierHash(scope.accountFingerprint)}`);
}
function workerPendingPath(storageRoot, scope) {
	return join(workerDirectory(storageRoot, scope), workerFileName(scope, BACKGROUND_WORKER_PENDING_FILE));
}
function workerActivePath(storageRoot, scope, markerId) {
	return join(workerDirectory(storageRoot, scope), workerFileName(scope, `${BACKGROUND_WORKER_ACTIVE_PREFIX}${markerId}.json`));
}
function workerAttemptPath(storageRoot, scope, markerId, attempt) {
	return join(workerDirectory(storageRoot, scope), workerFileName(scope, `${BACKGROUND_WORKER_ACTIVE_PREFIX}${markerId}.attempt.${attempt}.json`));
}
function workerLaunchPath(storageRoot, scope) {
	return join(workerDirectory(storageRoot, scope), workerFileName(scope, BACKGROUND_WORKER_LAUNCHING_FILE));
}
function workerFileName(scope, name) {
	return name.replace(BACKGROUND_WORKER_FILE_PREFIX, `${BACKGROUND_WORKER_FILE_PREFIX}-${identifierHash(scope.accountFingerprint)}`);
}
function scopedWorkerFileName(scope, name) {
	const prefix = `${BACKGROUND_WORKER_FILE_PREFIX}-${identifierHash(scope.accountFingerprint)}.`;
	return name.startsWith(prefix) ? `${BACKGROUND_WORKER_FILE_PREFIX}.${name.slice(prefix.length)}` : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/background-worker/utils/scope.js
async function matchesScope(resolveScope, expected) {
	const actual = await resolveScope();
	return actual.integration === expected.integration && actual.sessionId === expected.sessionId && actual.accountFingerprint === expected.accountFingerprint;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/background-worker/state.js
function assertPlainFile(entry, message) {
	if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(message);
}
async function readActiveMarker(storageRoot, directory, entry, markerId, scan) {
	assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_ACTIVE_MARKER_MESSAGE);
	if (markerId === void 0 || !BACKGROUND_WORKER_MARKER_ID_PATTERN.test(markerId)) throw new Error(BACKGROUND_WORKER_INVALID_ACTIVE_PATH_MESSAGE);
	if (scan.active) throw new Error(BACKGROUND_WORKER_MULTIPLE_ACTIVE_MARKERS_MESSAGE);
	scan.active = parseMarker(await readRequired(storageRoot, join(directory, entry.name)));
	if (scan.active.id !== markerId) throw new Error(BACKGROUND_WORKER_ACTIVE_MARKER_PATH_MISMATCH_MESSAGE);
}
async function readAttemptFile(storageRoot, directory, entry, match, scan) {
	assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_RETRY_ATTEMPT_MESSAGE);
	const markerId = match[1];
	const attemptNumber = Number(match[2]);
	if (markerId === void 0 || !BACKGROUND_WORKER_MARKER_ID_PATTERN.test(markerId) || !Number.isSafeInteger(attemptNumber)) throw new Error(BACKGROUND_WORKER_INVALID_ATTEMPT_PATH_MESSAGE);
	const attempt = parseAttempt(await readRequired(storageRoot, join(directory, entry.name)), markerId, attemptNumber);
	const markerAttempts = scan.attemptsByMarker.get(markerId) ?? [];
	markerAttempts.push(attempt);
	scan.attemptsByMarker.set(markerId, markerAttempts);
}
async function scanStateEntry(storageRoot, directory, entry, scan, scope) {
	if (BACKGROUND_WORKER_SHARED_DIRECTORY.test(entry.name)) {
		if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(BACKGROUND_WORKER_UNSAFE_LOCK_DIRECTORY_MESSAGE);
		return;
	}
	const name = scopedWorkerFileName(scope, entry.name);
	if (name === void 0 && BACKGROUND_WORKER_SCOPED_FILE.test(entry.name)) {
		assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_ACTIVE_MARKER_MESSAGE);
		return;
	}
	if (name === "wake.pending") {
		assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_PENDING_MARKER_MESSAGE);
		scan.pending = parseMarker(await readRequired(storageRoot, join(directory, entry.name)));
		return;
	}
	const activeMatch = BACKGROUND_WORKER_ACTIVE_MARKER_NAME.exec(name ?? "");
	if (activeMatch) return readActiveMarker(storageRoot, directory, entry, activeMatch[1], scan);
	const attemptMatch = BACKGROUND_WORKER_ATTEMPT_NAME.exec(name ?? "");
	if (attemptMatch) return readAttemptFile(storageRoot, directory, entry, attemptMatch, scan);
	if (BACKGROUND_WORKER_STAGING_FILE.test(entry.name)) {
		assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_STAGING_FILE_MESSAGE);
		return;
	}
	if (name === "wake.launching") {
		assertPlainFile(entry, BACKGROUND_WORKER_UNSAFE_LAUNCH_MARKER_MESSAGE);
		return;
	}
	throw new Error(BACKGROUND_WORKER_UNEXPECTED_STATE_PATH_MESSAGE);
}
function stateFromScan({ pending, active, attemptsByMarker }) {
	const attempts = active ? attemptsByMarker.get(active.id) ?? [] : [];
	attempts.sort((left, right) => left.attempt - right.attempt);
	for (let index = 0; index < attempts.length; index += 1) if (attempts[index]?.attempt !== index + 1) throw new Error(BACKGROUND_WORKER_RETRY_SEQUENCE_HAS_GAP_MESSAGE);
	const orphanedAttempts = [...attemptsByMarker.entries()].filter(([markerId]) => active?.id !== markerId).flatMap(([, markerAttempts]) => markerAttempts);
	return {
		...pending ? { pending } : {},
		...active ? { active } : {},
		attempts,
		orphanedAttempts
	};
}
async function readWorkerState(storageRoot, directory, scope) {
	const entries = await listPrivateDirectory(storageRoot, directory);
	if (!entries) return {
		attempts: [],
		orphanedAttempts: []
	};
	const scan = { attemptsByMarker: /* @__PURE__ */ new Map() };
	for (const entry of entries) await scanStateEntry(storageRoot, directory, entry, scan, scope);
	return stateFromScan(scan);
}
async function readRequired(storageRoot, path) {
	const contents = await readPrivateFile(storageRoot, path);
	if (contents === void 0) throw new Error(BACKGROUND_WORKER_STATE_DISAPPEARED_MESSAGE);
	return contents;
}
function parseMarker(contents) {
	const value = parseJsonObject(contents, BACKGROUND_WORKER_STATE_ERROR);
	if (value.version !== 1 || typeof value.id !== "string" || !BACKGROUND_WORKER_MARKER_ID_PATTERN.test(value.id) || typeof value.sourcePid !== "number" || !Number.isSafeInteger(value.sourcePid) || value.sourcePid <= 0) throw new Error(BACKGROUND_WORKER_INVALID_MARKER_MESSAGE);
	return value;
}
function parseAttempt(contents, markerId, attempt) {
	const value = parseJsonObject(contents, BACKGROUND_WORKER_STATE_ERROR);
	if (value.version !== 1 || value.markerId !== markerId || value.attempt !== attempt) throw new Error(BACKGROUND_WORKER_INVALID_RETRY_ATTEMPT_MESSAGE);
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/background-worker/worker.js
function createBackgroundWorker(options) {
	validateOptions(options);
	const context = createWorkerContext(options);
	return {
		wake: () => wakeWorker(context),
		async run() {
			try {
				return await runPasses(context);
			} finally {
				await removeEmptyLockFolders(context.lockPath, context.storageRoot);
			}
		}
	};
}
function createWorkerContext(options) {
	const storageRoot = resolve(options.storageRoot);
	const scope = Object.freeze({ ...options.scope });
	const retryPolicy = {
		maxAttempts: options.retryPolicy?.maxAttempts ?? 3,
		retryDelayMs: options.retryPolicy?.retryDelayMs ?? 100
	};
	return {
		config: {
			...options,
			storageRoot,
			scope,
			retryPolicy
		},
		storageRoot,
		scope,
		retryPolicy,
		directory: workerDirectory(storageRoot, scope),
		lockPath: workerLockPath(storageRoot, scope),
		directorySegments: sessionSegments(identifierHash(scope.sessionId))
	};
}
async function wakeWorker(context) {
	const { storageRoot, scope, lockPath } = context;
	await ensurePrivateDirectory(storageRoot, context.directorySegments);
	const marker = makeMarker(randomUUID());
	await publishExclusive(workerPendingPath(storageRoot, scope), JSON.stringify(marker));
	const lock = await tryAcquireFileLock(lockPath);
	if (!lock) return "queued";
	try {
		return await launchWorker(context);
	} finally {
		await lock.release();
	}
}
async function launchWorker(context) {
	const { config, storageRoot, scope } = context;
	const existingLaunch = await readLaunch(storageRoot, scope);
	if (existingLaunch && existingLaunch.expiresAtMs > Date.now() && processIsAlive(existingLaunch.pid) !== false) return "queued";
	if (existingLaunch) await removeFileIfPresent(workerLaunchPath(storageRoot, scope));
	const pid = await config.launchWorker();
	if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) throw new TypeError(BACKGROUND_WORKER_LAUNCHER_MUST_RETURN_CHILD_PROCESS_ID_MESSAGE);
	const createdAtMs = Date.now();
	const launch = {
		version: 1,
		pid,
		createdAtMs,
		expiresAtMs: createdAtMs + Math.max(BACKGROUND_WORKER_LAUNCH_LEASE_MS, config.startupWaitMs ?? 0)
	};
	if (!await publishExclusive(workerLaunchPath(storageRoot, scope), JSON.stringify(launch))) throw new Error(BACKGROUND_WORKER_LAUNCH_IS_ALREADY_PENDING_MESSAGE);
	return "launched";
}
async function runPasses(context) {
	const { storageRoot, directory, lockPath, retryPolicy, scope } = context;
	await ensurePrivateDirectory(storageRoot, context.directorySegments);
	const totals = {
		processed: false,
		retryExhausted: false,
		failures: 0
	};
	for (;;) {
		const result = await withOwnerLock(lockPath, () => runOwnedPasses(context, totals), { timeoutMs: BACKGROUND_WORKER_OWNER_WAIT_MS });
		if (result === "scope-mismatch" || result === "deferred" || result === "busy") return result;
		if (totals.failures >= retryPolicy.maxAttempts) return "retry-exhausted";
		if (!await hasPendingWork(storageRoot, directory, scope)) return result;
	}
}
async function passInScope(context) {
	const { config, storageRoot, scope } = context;
	if (!await matchesScope(config.resolveScope, scope)) return lockedPass({ scopeMismatch: true });
	await clearOwnedLaunch(storageRoot, scope);
	return processLocked(storageRoot, context.directory, scope, config, context.retryPolicy);
}
async function runOwnedPasses(context, totals) {
	const { config, storageRoot, scope, directory, retryPolicy } = context;
	for (;;) {
		if (!await matchesScope(config.resolveScope, scope)) return "scope-mismatch";
		const pass = await passInScope(context);
		if (pass.scopeMismatch) return "scope-mismatch";
		if (pass.deferred) return "deferred";
		totals.processed ||= pass.processed;
		totals.retryExhausted ||= pass.retryExhausted;
		if (pass.retryAttempted) totals.failures += 1;
		if (totals.failures >= retryPolicy.maxAttempts && pass.retryAttempted) return "retry-exhausted";
		if (pass.retryPending && retryPolicy.retryDelayMs > 0) await setTimeout$1(retryPolicy.retryDelayMs);
		if (!await hasPendingWork(storageRoot, directory, scope)) return totals.retryExhausted ? "retry-exhausted" : totals.processed ? "completed" : "idle";
	}
}
async function withOwnerLock(lockPath, callback, options) {
	try {
		return await withFileLock(lockPath, callback, options);
	} catch (error) {
		if (error instanceof FileLockTimeoutError) return "busy";
		throw error;
	}
}
function validateOptions(options) {
	const policy = options.retryPolicy;
	if (policy?.maxAttempts !== void 0 && (!Number.isSafeInteger(policy.maxAttempts) || policy.maxAttempts < 1)) throw new RangeError(BACKGROUND_WORKER_MAX_ATTEMPTS_MUST_BE_POSITIVE_INTEGER_MESSAGE);
	if (policy?.retryDelayMs !== void 0 && (!Number.isFinite(policy.retryDelayMs) || policy.retryDelayMs < 0)) throw new RangeError(BACKGROUND_WORKER_RETRY_DELAY_MUST_BE_NON_NEGATIVE_MESSAGE);
	if (options.startupWaitMs !== void 0 && (!Number.isSafeInteger(options.startupWaitMs) || options.startupWaitMs <= 0)) throw new RangeError(BACKGROUND_WORKER_STARTUP_WAIT_MUST_BE_POSITIVE_INTEGER_MESSAGE);
}
function makeMarker(id) {
	return {
		version: 1,
		id,
		sourcePid: process.pid
	};
}
function lockedPass(overrides = {}) {
	return {
		scopeMismatch: false,
		processed: false,
		retryExhausted: false,
		retryPending: false,
		retryAttempted: false,
		deferred: false,
		...overrides
	};
}
async function claimMarker(storageRoot, scope, state) {
	const marker = state.active ?? state.pending;
	if (!state.active && state.pending) {
		if (!await publishExclusive(workerActivePath(storageRoot, scope, state.pending.id), JSON.stringify(state.pending))) throw new Error(BACKGROUND_WORKER_ACTIVE_MARKER_ALREADY_EXISTS_MESSAGE);
		await removeFileIfPresent(workerPendingPath(storageRoot, scope));
	} else if (marker && state.pending?.id === marker.id) await removeFileIfPresent(workerPendingPath(storageRoot, scope));
	return marker;
}
async function recordAttempt(storageRoot, scope, marker, attemptNumber) {
	const attempt = {
		version: 1,
		markerId: marker.id,
		attempt: attemptNumber
	};
	if (!await publishExclusive(workerAttemptPath(storageRoot, scope, marker.id, attemptNumber), JSON.stringify(attempt))) throw new Error(BACKGROUND_WORKER_RETRY_ATTEMPT_ALREADY_EXISTS_MESSAGE);
	return attempt;
}
async function processLocked(storageRoot, directory, scope, options, retryPolicy) {
	const state = await readWorkerState(storageRoot, directory, scope);
	for (const attempt of state.orphanedAttempts) await removeFileIfPresent(workerAttemptPath(storageRoot, scope, attempt.markerId, attempt.attempt));
	const marker = await claimMarker(storageRoot, scope, state);
	if (!marker) return lockedPass();
	let attempts = state.attempts;
	if (attempts.length >= retryPolicy.maxAttempts) {
		await removeActiveMarker(storageRoot, scope, marker, attempts);
		return lockedPass({
			processed: true,
			retryExhausted: true
		});
	}
	for (;;) {
		if (!await matchesScope(options.resolveScope, scope)) return lockedPass({ scopeMismatch: true });
		const result = await runTasks(options, scope);
		if (result === "scope-mismatch" || !await matchesScope(options.resolveScope, scope)) return lockedPass({ scopeMismatch: true });
		if (result === "progressed") continue;
		if (result === "idle" || result === "deferred") {
			if (result === "idle") await removeActiveMarker(storageRoot, scope, marker, attempts);
			return lockedPass({
				processed: true,
				deferred: result === "deferred"
			});
		}
		attempts = [...attempts, await recordAttempt(storageRoot, scope, marker, attempts.length + 1)];
		if (attempts.length >= retryPolicy.maxAttempts) {
			await removeActiveMarker(storageRoot, scope, marker, attempts);
			return lockedPass({
				processed: true,
				retryExhausted: true,
				retryAttempted: true
			});
		}
		return lockedPass({
			processed: true,
			retryPending: true,
			retryAttempted: true
		});
	}
}
async function runTasks(options, scope) {
	let progressed = false;
	let deferred = false;
	if (options.reconstructPending) {
		let result;
		try {
			result = await options.reconstructPending();
		} catch {
			return "retryable-failure";
		}
		if (!await matchesScope(options.resolveScope, scope)) return "scope-mismatch";
		if (result === "retryable-failure") return result;
		progressed ||= result === "progressed";
		deferred ||= result === "deferred";
	}
	let result;
	try {
		result = await options.drainPending();
	} catch {
		return "retryable-failure";
	}
	if (result === "retryable-failure") return result;
	progressed ||= result === "progressed";
	deferred ||= result === "deferred";
	return deferred ? "deferred" : progressed ? "progressed" : "idle";
}
async function hasPendingWork(storageRoot, directory, scope) {
	return (await listPrivateDirectory(storageRoot, directory))?.some((entry) => {
		const name = scopedWorkerFileName(scope, entry.name);
		return name === "wake.pending" || BACKGROUND_WORKER_ACTIVE_MARKER_NAME.test(name ?? "");
	}) ?? false;
}
async function removeActiveMarker(storageRoot, scope, marker, attempts) {
	await removeFileIfPresent(workerActivePath(storageRoot, scope, marker.id));
	for (const attempt of attempts) await removeFileIfPresent(workerAttemptPath(storageRoot, scope, marker.id, attempt.attempt));
}
async function clearOwnedLaunch(storageRoot, scope) {
	if ((await readLaunch(storageRoot, scope))?.pid === process.pid) await removeFileIfPresent(workerLaunchPath(storageRoot, scope));
}
async function readLaunch(storageRoot, scope) {
	const contents = await readPrivateFile(storageRoot, workerLaunchPath(storageRoot, scope));
	if (contents === void 0) return void 0;
	const value = parseJsonObject(contents, BACKGROUND_WORKER_STATE_ERROR);
	if (value.version !== 1 || typeof value.pid !== "number" || !Number.isSafeInteger(value.pid) || value.pid <= 0 || typeof value.createdAtMs !== "number" || !Number.isSafeInteger(value.createdAtMs) || typeof value.expiresAtMs !== "number" || !Number.isSafeInteger(value.expiresAtMs) || value.expiresAtMs <= value.createdAtMs) throw new Error(BACKGROUND_WORKER_INVALID_LAUNCH_MARKER_MESSAGE);
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/files/missing.js
function ifMissing(fallback) {
	return (error) => {
		if (errorCode(error) === "ENOENT") return fallback;
		throw error;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/stale-files.js
async function removeStaleStorageFiles(root, folders, modifiedBeforeMs) {
	let removed = 0;
	for (const folder of folders) removed += await removeStaleChildren(join(root, folder), modifiedBeforeMs);
	return removed;
}
async function removeStaleChildren(directory, modifiedBeforeMs) {
	let removed = 0;
	for (const name of await readdir(directory).catch(ifMissing([]))) {
		const path = join(directory, name);
		const info = await lstat(path).catch(ifMissing(void 0));
		if (info === void 0) continue;
		if (info.isDirectory()) {
			removed += await removeStaleChildren(path, modifiedBeforeMs);
			if (info.mtimeMs < modifiedBeforeMs) await rmdir(path).catch(warnUnlessExpected);
		} else if (info.mtimeMs < modifiedBeforeMs && isEngineFile(path) && !await heldByLiveProcess(path)) {
			if (!await removeFileIfPresent(path)) continue;
			console.warn(STORAGE_STALE_REMOVAL_WARNING, name);
			removed += 1;
		}
	}
	return removed;
}
function isEngineFile(path) {
	const name = basename(path);
	return STORAGE_ENGINE_FILE_PATTERNS.some((pattern) => pattern.test(name)) || STORAGE_CLAIM_FILE.test(name) && basename(dirname(path)).endsWith(".claims");
}
async function heldByLiveProcess(path) {
	if (!STORAGE_CLAIM_FILE.test(basename(path))) return false;
	try {
		const claim = JSON.parse(await readFile(path, "utf8"));
		return typeof claim === "object" && claim !== null && "pid" in claim && typeof claim.pid === "number" && processIsAlive(claim.pid) === true;
	} catch {
		return false;
	}
}
function warnUnlessExpected(error) {
	const code = errorCode(error);
	if (code !== "ENOENT" && code !== "ENOTEMPTY") console.warn(STORAGE_STALE_DIRECTORY_WARNING, describe(error));
}
const DELIVERY_RETRY_MAX_MS = 18e5;
const DELIVERY_DROPPED_WARNING = "Dropped trace work:";
const DELIVERY_CAPACITY_REASON = "capacity";
const DELIVERY_REJECTED_REASON = "rejected";
const DELIVERY_DEPENDENCY_DROPPED_REASON = "dependency-dropped";
const DELIVERY_AUTH_STATUSES = [401, 403];
const DELIVERY_AUTH_HINT = "Check the LangSmith API key or CLI login and its access.";
const DELIVERY_WRITER_REQUIRED_MESSAGE = "A delivery writer is required";
const DELIVERY_DESTINATION_REQUIRED_MESSAGE = "At least one delivery destination is required";
const DELIVERY_DESTINATION_INVALID_MESSAGE = "Invalid delivery destination";
const DELIVERY_DESTINATION_DUPLICATE_MESSAGE = "Delivery destinations must be unique";
const DELIVERY_TRANSPORT_REQUIRED_MESSAGE = "A delivery transport is required";
const DELIVERY_BATCH_LIMITS_INVALID_MESSAGE = "Invalid delivery batch limits";
const DELIVERY_POLICY_INVALID_MESSAGE = "Invalid delivery policy";
const DELIVERY_PREREQUISITE_READ_MESSAGE = "Could not read prerequisite receipt:";
const DELIVERY_RECEIPT_READ_MESSAGE = "Could not read delivery receipt:";
const DELIVERY_RECEIPT_PERSIST_MESSAGE = "Could not persist delivery receipt:";
const DELIVERY_ACCOUNT_MISMATCH_WARNING = "Saved trace work was saved under a different API key, endpoint, replica or redaction setting, not uploaded with the current one. It waits until that setting returns. Files waiting: {count}";
const DELIVERY_DRAIN_LOCK = "delivery";
const DELIVERY_DROPPED_DETAIL = "{eventId} for run {runId} on destination {destination} ({reason}){hint}";
const DELIVERY_DEPENDENTS_DROPPED_WARNING = "Dropped trace work that depended on dropped work on destination {destination}: runs {runs}";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/storage/capture/retry-state.js
const PROCESS_STARTED_AT_MS = Date.now();
function isWaitingForRetry(retry, now = Date.now()) {
	return retry !== void 0 && retry.notBeforeMs > now && !(retry.recordedAtMs !== void 0 && retry.recordedAtMs < PROCESS_STARTED_AT_MS);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/batch.js
function createBatch() {
	return {
		candidates: [],
		scopes: /* @__PURE__ */ new Set(),
		runIds: /* @__PURE__ */ new Set(),
		bytes: 0
	};
}
function payloadBytes(record) {
	return Buffer.byteLength(JSON.stringify(record.normalizedPayload));
}
function canJoinBatch(batch, candidate, writer) {
	if (batch.candidates.length === 0) return true;
	const limits = writer.batchLimits;
	return batch.candidates.length < limits.maxRecords && batch.bytes + payloadBytes(candidate.entry.record) <= limits.maxBytes && !batch.runIds.has(candidate.entry.record.runId);
}
function joinBatch(batch, candidate) {
	batch.candidates.push(candidate);
	batch.scopes.add(scopeKey(scopeOf(candidate.entry.record)));
	batch.runIds.add(candidate.entry.record.runId);
	batch.bytes += payloadBytes(candidate.entry.record);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/retry.js
function isRetryable(error) {
	return error?.retryable !== false;
}
function rejection(error) {
	const status = failureStatus(error);
	return status === void 0 ? { reason: DELIVERY_REJECTED_REASON } : {
		reason: `${DELIVERY_REJECTED_REASON} (HTTP ${status})`,
		status
	};
}
function authHint(status) {
	return status !== void 0 && DELIVERY_AUTH_STATUSES.includes(status) ? ` ${DELIVERY_AUTH_HINT}` : "";
}
function nextRetry(previous, baseMs) {
	const failures = (previous?.failures ?? 0) + 1;
	return {
		failures,
		recordedAtMs: Date.now(),
		notBeforeMs: Date.now() + Math.min(baseMs * 2 ** (failures - 1), DELIVERY_RETRY_MAX_MS)
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/outcomes.js
function emptyDestinationResult() {
	return {
		delivered: 0,
		dropped: 0,
		failed: 0,
		progressed: false
	};
}
function addDestinationResult(total, part) {
	total.delivered += part.delivered;
	total.dropped += part.dropped;
	total.failed += part.failed;
	total.progressed ||= part.progressed;
}
async function dependenciesForDestination(drainCache, entry, destination, inBatch = /* @__PURE__ */ new Set()) {
	const dependent = entry.record;
	let pending = false;
	for (const dependency of dependent.dependencies ?? []) {
		if (inBatch.has(scopeKey(dependency))) continue;
		const prerequisite = await drainCache.read(dependency);
		if (prerequisite !== void 0 && prerequisite.destinationFingerprint !== dependent.destinationFingerprint) {
			pending = true;
			continue;
		}
		const outcome = await drainCache.readOutcome(dependency, destination);
		if (outcome.status === "failed") throw new Error(`${DELIVERY_PREREQUISITE_READ_MESSAGE} ${outcome.status}`);
		if (outcome.status === "pending" || outcome.status === "missing-capture") {
			pending = true;
			continue;
		}
		if (outcome.receipt.outcome === "dropped") return "dropped";
	}
	return pending ? "pending" : "ready";
}
async function recordDropped(drainCache, candidate, destination, { reason, status }) {
	const { scope, entry } = candidate;
	await drainCache.recordOutcome({
		...scope,
		destination,
		outcome: "dropped",
		reason
	});
	if (reason === "dependency-dropped") {
		const runs = drainCache.dependentDrops.get(destination) ?? /* @__PURE__ */ new Set();
		drainCache.dependentDrops.set(destination, runs.add(entry.record.runId));
		return 1;
	}
	console.warn(DELIVERY_DROPPED_WARNING, fillTemplate(DELIVERY_DROPPED_DETAIL, {
		eventId: scope.eventId,
		runId: entry.record.runId,
		destination,
		reason,
		hint: authHint(status)
	}));
	return 1;
}
function dropAsDependent(drainCache, candidate, destination) {
	return recordDropped(drainCache, candidate, destination, { reason: DELIVERY_DEPENDENCY_DROPPED_REASON });
}
async function dropDependents(drainCache, candidates) {
	let dropped = 0;
	let changed;
	do {
		changed = false;
		for (const candidate of candidates) {
			const pending = [];
			for (const destination of candidate.pending) if (await dependenciesForDestination(drainCache, candidate.entry, destination.id) === "dropped") {
				dropped += await dropAsDependent(drainCache, candidate, destination.id);
				changed = true;
			} else pending.push(destination);
			candidate.pending = pending;
		}
	} while (changed);
	return dropped;
}
async function settleDroppedDependency(drainCache, candidate, destination, result) {
	result.dropped += await dropAsDependent(drainCache, candidate, destination);
	result.progressed = true;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/deliver.js
async function trySend(context, destination, candidates) {
	const { policy, request } = context;
	const { writer } = request;
	const send = () => writer.sendBatch(candidates.map(({ entry }) => structuredClone(entry.record)), destination, writer.accountFingerprint);
	try {
		try {
			await send();
		} catch (error) {
			if (!candidates.every(({ entry }) => entry.record.delivery?.retries[destination.id] === void 0) || policy.quickRetryMs === 0 || !isRetryable(error)) throw error;
			await setTimeout$1(policy.quickRetryMs);
			await send();
		}
	} catch (error) {
		return error ?? /* @__PURE__ */ new Error();
	}
}
async function settleDelivered(context, destination, candidates) {
	const result = emptyDestinationResult();
	for (const candidate of candidates) {
		await context.drainCache.recordOutcome({
			...candidate.scope,
			destination: destination.id,
			outcome: "delivered"
		});
		result.delivered += 1;
	}
	result.progressed = true;
	return result;
}
async function settleFailed(context, destination, candidates, error) {
	const { captureStore, drainCache, policy } = context;
	const result = emptyDestinationResult();
	for (const candidate of candidates) {
		result.failed += 1;
		if (!isRetryable(error)) {
			result.dropped += await recordDropped(drainCache, candidate, destination.id, rejection(error));
			result.progressed = true;
		} else await captureStore.recordRetry(candidate.scope, destination.id, nextRetry(candidate.entry.record.delivery?.retries[destination.id], policy.retryBaseMs));
	}
	return result;
}
async function deliverOneByOne(context, destination, candidates) {
	const result = emptyDestinationResult();
	for (const candidate of candidates) {
		const state = await dependenciesForDestination(context.drainCache, candidate.entry, destination.id);
		if (state === "pending") continue;
		if (state === "dropped") {
			await settleDroppedDependency(context.drainCache, candidate, destination.id, result);
			continue;
		}
		const error = await trySend(context, destination, [candidate]);
		addDestinationResult(result, error === void 0 ? await settleDelivered(context, destination, [candidate]) : await settleFailed(context, destination, [candidate], error));
	}
	return result;
}
async function deliverBatch(context, destination, candidates) {
	const error = await trySend(context, destination, candidates);
	if (error === void 0) return settleDelivered(context, destination, candidates);
	if (candidates.length > 1 && !isRetryable(error)) return deliverOneByOne(context, destination, candidates);
	return settleFailed(context, destination, candidates, error);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/drain-cache.js
function deliveryKey(scope, destination) {
	return JSON.stringify([scopeKey(scope), destination]);
}
function createDrainCache(store) {
	const captures = /* @__PURE__ */ new Map();
	const outcomes = /* @__PURE__ */ new Map();
	return {
		dependentDrops: /* @__PURE__ */ new Map(),
		read(scope) {
			const key = scopeKey(scope);
			let record = captures.get(key);
			if (record === void 0) {
				record = store.read(scope);
				captures.set(key, record);
			}
			return record;
		},
		readOutcome(scope, destination) {
			const key = deliveryKey(scope, destination);
			let outcome = outcomes.get(key);
			if (outcome === void 0) {
				outcome = store.readOutcome(scope, destination);
				outcomes.set(key, outcome);
			}
			return outcome;
		},
		async recordOutcome(input) {
			const result = await store.recordOutcome(input);
			if (result.status !== "recorded" && result.status !== "duplicate") throw new Error(`${DELIVERY_RECEIPT_PERSIST_MESSAGE} ${input.outcome} ${result.status}`);
			outcomes.set(deliveryKey(input, input.destination), Promise.resolve({
				status: "settled",
				receipt: result.receipt
			}));
			return result.receipt;
		},
		rememberCapture(record) {
			captures.set(scopeKey(record), Promise.resolve(record));
		}
	};
}
async function requireOutcome(drainCache, scope, destination) {
	const result = await drainCache.readOutcome(scope, destination);
	if (result.status === "failed" || result.status === "missing-capture") throw new Error(`${DELIVERY_RECEIPT_READ_MESSAGE} ${result.status}`);
	return result;
}
async function countPending(drainCache, entries, destinations) {
	let count = 0;
	let nextRetryAtMs;
	for (const entry of entries) {
		const scope = scopeOf(entry.record);
		for (const destination of destinations) {
			if ((await requireOutcome(drainCache, scope, destination.id)).status !== "pending") continue;
			count += 1;
			const retry = entry.record.delivery?.retries[destination.id];
			if (retry !== void 0 && (nextRetryAtMs === void 0 || retry.notBeforeMs < nextRetryAtMs)) nextRetryAtMs = retry.notBeforeMs;
		}
	}
	return nextRetryAtMs === void 0 ? { count } : {
		count,
		nextRetryAtMs
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/drain.js
async function drainLocked(captureStore, integration, sessionId, policy, request, drainCache) {
	const eligible = (await captureStore.enumerate(integration, sessionId)).filter(({ record }) => record.destinationFingerprint === request.writer.accountFingerprint);
	for (const { record } of eligible) drainCache.rememberCapture(record);
	let dropped = 0;
	let failed = 0;
	let delivered = 0;
	const candidates = await pendingCandidates(drainCache, eligible, request.writer.destinations);
	dropped += await dropDependents(drainCache, candidates);
	let active = candidates.filter((candidate) => candidate.pending.length > 0);
	const overflowing = turnsToDrop(active, policy.maxEntries);
	if (overflowing.size > 0) {
		for (const candidate of active.filter(({ scope }) => overflowing.has(scope.turnId))) {
			dropped += await dropPending(drainCache, candidate, DELIVERY_CAPACITY_REASON);
			candidate.pending = [];
		}
		active = candidates.filter((candidate) => candidate.pending.length > 0);
	}
	const context = {
		captureStore,
		drainCache,
		policy,
		request,
		attempted: request.attempted ?? /* @__PURE__ */ new Set(),
		sendable: active
	};
	let progressed;
	do {
		progressed = false;
		for (const destination of request.writer.destinations) {
			const result = await drainDestination(context, destination);
			delivered += result.delivered;
			dropped += result.dropped;
			failed += result.failed;
			progressed ||= result.progressed;
		}
	} while (progressed);
	warnAboutDependentDrops(drainCache);
	await removeDroppedCaptures(captureStore, drainCache, eligible, request.writer.destinations);
	return {
		delivered,
		dropped,
		failed
	};
}
async function drainDestination(context, destination) {
	const { drainCache, attempted, request } = context;
	const { writer } = request;
	const result = emptyDestinationResult();
	let batch = createBatch();
	const flush = async () => {
		if (batch.candidates.length > 0) addDestinationResult(result, await deliverBatch(context, destination, batch.candidates));
		batch = createBatch();
	};
	for (const candidate of context.sendable) {
		if (!candidate.pending.some(({ id }) => id === destination.id)) continue;
		const key = deliveryKey(candidate.scope, destination.id);
		if (attempted.has(key)) continue;
		const record = candidate.entry.record;
		const dependencyState = await dependenciesForDestination(drainCache, candidate.entry, destination.id, batch.scopes);
		if (dependencyState === "pending") continue;
		const retry = record.delivery?.retries[destination.id];
		if (isWaitingForRetry(retry)) continue;
		const sendsNow = dependencyState === "ready" && record.destinationFingerprint === writer.accountFingerprint;
		if (sendsNow && !canJoinBatch(batch, candidate, writer)) {
			await flush();
			continue;
		}
		attempted.add(key);
		if (dependencyState === "dropped") {
			await settleDroppedDependency(drainCache, candidate, destination.id, result);
			continue;
		}
		if (!sendsNow) continue;
		joinBatch(batch, candidate);
	}
	await flush();
	return result;
}
function warnAboutDependentDrops(drainCache) {
	for (const [destination, runs] of drainCache.dependentDrops) console.warn(fillTemplate(DELIVERY_DEPENDENTS_DROPPED_WARNING, {
		destination,
		runs: [...runs].join(", ")
	}));
}
async function removeDroppedCaptures(captureStore, drainCache, entries, destinations) {
	for (const { record } of entries) if ((await Promise.all(destinations.map(({ id }) => drainCache.readOutcome(scopeOf(record), id)))).every((outcome) => outcome.status === "settled" && outcome.receipt.outcome === "dropped")) await captureStore.remove(scopeOf(record));
}
function turnsToDrop(active, maxEntries) {
	const sizes = /* @__PURE__ */ new Map();
	for (const { scope } of active) sizes.set(scope.turnId, (sizes.get(scope.turnId) ?? 0) + 1);
	const dropping = /* @__PURE__ */ new Set();
	let remaining = active.length;
	for (const [turnId, size] of sizes) {
		if (remaining <= maxEntries) break;
		dropping.add(turnId);
		remaining -= size;
	}
	return dropping;
}
async function pendingCandidates(drainCache, entries, destinations) {
	const candidates = [];
	for (const entry of entries) {
		const scope = scopeOf(entry.record);
		const pending = [];
		for (const destination of destinations) if ((await requireOutcome(drainCache, scope, destination.id)).status === "pending") pending.push(destination);
		if (pending.length > 0) candidates.push({
			entry,
			scope,
			pending
		});
	}
	return candidates;
}
async function dropPending(drainCache, candidate, reason) {
	let dropped = 0;
	for (const destination of candidate.pending) dropped += await recordDropped(drainCache, candidate, destination.id, { reason });
	return dropped;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/options.js
function validateDrainRequest(request) {
	if (request.writer === null || typeof request.writer !== "object") throw new TypeError(DELIVERY_WRITER_REQUIRED_MESSAGE);
	validateIdentifier(request.writer.accountFingerprint, "account fingerprint");
	if (!Array.isArray(request.writer.destinations) || request.writer.destinations.length === 0) throw new TypeError(DELIVERY_DESTINATION_REQUIRED_MESSAGE);
	const ids = /* @__PURE__ */ new Set();
	for (const destination of request.writer.destinations) {
		validateIdentifier(destination.id, "destination");
		if (ids.has(destination.id)) throw new TypeError(DELIVERY_DESTINATION_DUPLICATE_MESSAGE);
		ids.add(destination.id);
	}
	if (typeof request.writer.sendBatch !== "function") throw new TypeError(DELIVERY_TRANSPORT_REQUIRED_MESSAGE);
}
function snapshotWriter(writer) {
	if (writer === null || typeof writer !== "object") throw new TypeError(DELIVERY_WRITER_REQUIRED_MESSAGE);
	const accountFingerprint = writer.accountFingerprint;
	const sourceDestinations = writer.destinations;
	const sendBatch = writer.sendBatch;
	const batchLimits = writer.batchLimits;
	if (!Array.isArray(sourceDestinations) || sourceDestinations.length === 0) throw new TypeError(DELIVERY_DESTINATION_REQUIRED_MESSAGE);
	const destinations = sourceDestinations.map((destination) => {
		if (destination === null || typeof destination !== "object") throw new TypeError(DELIVERY_DESTINATION_INVALID_MESSAGE);
		return Object.freeze({ id: destination.id });
	});
	return Object.freeze({
		accountFingerprint,
		destinations: Object.freeze(destinations),
		sendBatch: typeof sendBatch === "function" ? sendBatch.bind(writer) : sendBatch,
		batchLimits: Object.freeze({ ...validBatchLimits(batchLimits) })
	});
}
function validBatchLimits(limits) {
	if (limits === null || typeof limits !== "object") throw new TypeError(DELIVERY_BATCH_LIMITS_INVALID_MESSAGE);
	if (!Number.isSafeInteger(limits.maxRecords) || limits.maxRecords < 1 || !(limits.maxBytes > 0)) throw new TypeError(DELIVERY_BATCH_LIMITS_INVALID_MESSAGE);
	return {
		maxRecords: limits.maxRecords,
		maxBytes: limits.maxBytes
	};
}
function resolvePolicy(policy) {
	const resolved = {
		maxAgeMs: policy?.maxAgeMs ?? 216e5,
		maxEntries: policy?.maxEntries ?? 500,
		retryBaseMs: policy?.retryBaseMs ?? 5e3,
		quickRetryMs: policy?.quickRetryMs ?? 1e3
	};
	if (!Number.isSafeInteger(resolved.maxAgeMs) || resolved.maxAgeMs <= 0 || !Number.isSafeInteger(resolved.maxEntries) || resolved.maxEntries <= 0 || !Number.isSafeInteger(resolved.retryBaseMs) || resolved.retryBaseMs < 0 || !Number.isSafeInteger(resolved.quickRetryMs) || resolved.quickRetryMs < 0) throw new TypeError(DELIVERY_POLICY_INVALID_MESSAGE);
	return resolved;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/delivery/coordinator.js
async function drainUnderLock(context, request, drainCache) {
	const { captureStore, integration, sessionId, storageRoot, policy } = context;
	const sessionDirectory = await ensurePrivateDirectory(storageRoot, sessionSegments(identifierHash(sessionId)));
	const lockPath = join(sessionDirectory, DELIVERY_DRAIN_LOCK);
	const lock = await tryAcquireFileLock(lockPath);
	if (!lock) return void 0;
	try {
		return await drainLocked(captureStore, integration, sessionId, policy, request, drainCache);
	} finally {
		await lock.release();
		await removeEmptyLockFolders(lockPath, storageRoot);
	}
}
async function summarizeDrain(context, writer, counts, drainCache) {
	const captures = await context.captureStore.enumerate(context.integration, context.sessionId);
	const { count, nextRetryAtMs } = await countPending(drainCache, captures.filter(({ record }) => record.destinationFingerprint === writer.accountFingerprint), writer.destinations);
	const accountMismatch = captures.filter(({ record }) => isWaitingForOtherSetting(record, writer.accountFingerprint)).length;
	if (accountMismatch > 0 && !context.mismatchWarned.value) {
		context.mismatchWarned.value = true;
		console.warn(fillTemplate(DELIVERY_ACCOUNT_MISMATCH_WARNING, { count: accountMismatch }));
	}
	return {
		status: "drained",
		...counts,
		pending: count,
		...nextRetryAtMs === void 0 ? {} : { nextRetryAtMs },
		accountMismatch
	};
}
function createDeliveryCoordinator(options) {
	const { integration, sessionId } = options;
	validateIntegration(integration);
	validateIdentifier(sessionId, "session ID");
	const storageRoot = resolve(options.storageRoot);
	const context = {
		integration,
		sessionId,
		storageRoot,
		policy: resolvePolicy(options.policy),
		captureStore: createCaptureStore(storageRoot),
		mismatchWarned: { value: false }
	};
	return {
		capture(input) {
			const scoped = {
				...input,
				integration,
				sessionId
			};
			return context.captureStore.capture(scoped);
		},
		async drain(request) {
			const writer = snapshotWriter(request.writer);
			const drainRequest = {
				writer,
				...request.attempted === void 0 ? {} : { attempted: request.attempted }
			};
			validateDrainRequest(drainRequest);
			const drainCache = createDrainCache(context.captureStore);
			const counts = await drainUnderLock(context, drainRequest, drainCache);
			if (counts === void 0) return { status: "busy" };
			return summarizeDrain(context, writer, counts, drainCache);
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/sdk/sdk-constants.js
const SDK_DOUBLE_QUOTED = /^"(.*)"$/;
const SDK_SINGLE_QUOTED = /^'(.*)'$/;
const SDK_PROFILE_QUOTES = /^["']|["']$/g;
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/sdk/normalize.js
function sdkSetting(value) {
	if (typeof value !== "string") return void 0;
	const trimmed = value.trim().replace(SDK_DOUBLE_QUOTED, "$1").replace(SDK_SINGLE_QUOTED, "$1");
	return trimmed.trim() === "" ? void 0 : trimmed;
}
function sdkProfileValue(value) {
	if (typeof value !== "string") return void 0;
	return value.trim().replace(SDK_PROFILE_QUOTES, "") || void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/auth/constants.js
const LOGIN_CONFIG_FILE_VARIABLE = "LANGSMITH_CONFIG_FILE";
const LOGIN_HOME_VARIABLES = ["HOME", "USERPROFILE"];
const LOGIN_API_KEY_VARIABLES = ["LANGSMITH_API_KEY", "LANGCHAIN_API_KEY"];
const LOGIN_CONFIG_DIRECTORY = ".langsmith";
const LOGIN_CONFIG_FILE_NAME = "config.json";
const LOGIN_CONFIG_KEYS = {
	profiles: "profiles",
	currentProfile: "current_profile",
	oauth: "oauth",
	refreshToken: "refresh_token",
	accessToken: "access_token",
	apiKey: "api_key",
	workspaceId: "workspace_id",
	apiUrl: "api_url"
};
const LOGIN_URL_TRAILING_PATTERN = /(\/api\/v1)?\/*$/u;
const LOGIN_TOKEN_HASH = "sha256";
const LOGIN_EXPIRED_MARKER_PREFIX = "login-expired-";
const LOGIN_CONFIG_FILE_ENCODING = "utf8";
const LOGIN_NOTICE_RULE = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";
const LOGIN_NOTICE_HEADING = "⚠️  LANGSMITH TRACING IS PAUSED";
const LOGIN_NONE_REASON = [
	LOGIN_NOTICE_RULE,
	LOGIN_NOTICE_HEADING,
	"You're not signed in to LangSmith so this session isn't being traced.",
	"▶ Run the following command: langsmith auth login",
	LOGIN_NOTICE_RULE
].join("\n");
const LOGIN_ENDPOINT_MISMATCH_REASON = [
	LOGIN_NOTICE_RULE,
	LOGIN_NOTICE_HEADING,
	"Your LangSmith login is for {loginUrl} but tracing sends to {apiUrl} so this session isn't being traced.",
	"▶ Point tracing at {loginUrl}, or set an API key for {apiUrl}",
	LOGIN_NOTICE_RULE
].join("\n");
const LOGIN_REPLICA_REFUSED_REASON = "LangSmith replicas on {urls} need their own API key, so they're skipped.";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/auth/profile.js
function readLoginProfile(env) {
	const configPath = loginConfigPath(env);
	return configPath === void 0 ? void 0 : readProfileAt(configPath, env["LANGSMITH_PROFILE"] || void 0);
}
function readProfileAt(configPath, name) {
	let config;
	try {
		config = JSON.parse(readFileSync(configPath, LOGIN_CONFIG_FILE_ENCODING));
	} catch {
		return;
	}
	if (!isPlainRecord(config)) return void 0;
	const profiles = config[LOGIN_CONFIG_KEYS.profiles];
	const current = config[LOGIN_CONFIG_KEYS.currentProfile];
	if (!isPlainRecord(profiles)) return void 0;
	const profile = name ?? (typeof current === "string" ? current || void 0 : void 0) ?? (Object.hasOwn(profiles, "default") ? "default" : void 0);
	const entry = profile !== void 0 && Object.hasOwn(profiles, profile) ? profiles[profile] : void 0;
	if (profile === void 0 || !isPlainRecord(entry)) return void 0;
	const credentials = entry[LOGIN_CONFIG_KEYS.oauth];
	const oauth = isPlainRecord(credentials) ? credentials : {};
	const secret = sdkProfileValue(oauth[LOGIN_CONFIG_KEYS.refreshToken]) ?? sdkProfileValue(oauth[LOGIN_CONFIG_KEYS.accessToken]) ?? sdkProfileValue(entry[LOGIN_CONFIG_KEYS.apiKey]);
	if (secret === void 0) return void 0;
	const accessToken = sdkProfileValue(oauth[LOGIN_CONFIG_KEYS.accessToken]);
	const workspaceId = sdkSetting(entry[LOGIN_CONFIG_KEYS.workspaceId]);
	return {
		configPath,
		profile,
		...workspaceId === void 0 ? {} : { workspaceId },
		apiUrl: sdkSetting(entry[LOGIN_CONFIG_KEYS.apiUrl]) ?? "https://api.smith.langchain.com",
		tokenHash: credentialHash(secret),
		...accessToken === void 0 ? {} : { accessTokenHash: credentialHash(accessToken) }
	};
}
function expiredMarkerPrefix(login) {
	return `${LOGIN_EXPIRED_MARKER_PREFIX}${credentialHash(`${login.configPath}\n${login.profile}`)}.`;
}
function sameServer(left, right) {
	return serverKey(left) === serverKey(right);
}
function serverKey(value) {
	try {
		const url = new URL(sdkSetting(value) ?? "");
		return `${url.origin}${url.pathname.replace(LOGIN_URL_TRAILING_PATTERN, "")}`;
	} catch {
		return value;
	}
}
function loginConfigPath(env) {
	const explicit = env[LOGIN_CONFIG_FILE_VARIABLE];
	if (explicit) return explicit;
	const home = LOGIN_HOME_VARIABLES.map((name) => env[name]).find((value) => value !== void 0);
	return home ? join(home, LOGIN_CONFIG_DIRECTORY, LOGIN_CONFIG_FILE_NAME) : void 0;
}
function credentialHash(value) {
	return createHash(LOGIN_TOKEN_HASH).update(value).digest("hex").slice(0, 16);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/auth/expiry-constants.js
const LOGIN_PAUSED_NOTICE = [
	LOGIN_NOTICE_RULE,
	LOGIN_NOTICE_HEADING,
	"Your LangSmith login expired so this session isn't being traced.",
	"▶ Run the following command: langsmith auth login",
	LOGIN_NOTICE_RULE
].join("\n");
const LOGIN_KEY_REJECTED_NOTICE = [
	LOGIN_NOTICE_RULE,
	LOGIN_NOTICE_HEADING,
	"Your LangSmith API key was rejected so this session isn't being traced.",
	"▶ Replace the key, or remove it and run: langsmith auth login",
	LOGIN_NOTICE_RULE
].join("\n");
const LOGIN_MARKER_WARNING = "Could not record the expired LangSmith login:";
const LOGIN_CLEANUP_WARNING = "Could not clear the LangSmith sign-in marker:";
const LOGIN_STATE_FILE = "sign-in.json";
const LOGIN_NOTICE_KIND = "login-expired";
const LOGIN_KEY_REJECTED_ENTRY = "api-key-rejected.";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/auth/expiry.js
const unrecorded = /* @__PURE__ */ new Set();
async function recordExpiredLogin(login, sentTokenHash, storageRoot) {
	try {
		const profile = readProfileAt(login.configPath, login.profile);
		if (profile === void 0 || profile.accessTokenHash !== sentTokenHash) return "superseded";
		const key = `${expiredMarkerPrefix(profile)}${profile.tokenHash}`;
		const claim = await claimLogin(profile, key, storageRoot);
		if (claim === "existing" || claim === "unrecorded" && unrecorded.has(key)) return "already-handled";
		if (claim === "unrecorded") unrecorded.add(key);
	} catch (error) {
		console.warn(LOGIN_MARKER_WARNING, describe(error));
	}
	console.warn(LOGIN_PAUSED_NOTICE);
	return "notice";
}
async function recordRejectedKey(key, storageRoot) {
	if (storageRoot === void 0) return;
	const path = join(storageRoot, LOGIN_STATE_FILE);
	try {
		if (!await claimStateEntry(path, rejectedKeyEntry(key), Infinity)) return;
	} catch {
		return;
	}
	console.warn(LOGIN_KEY_REJECTED_NOTICE);
}
async function clearRejectedKey(storageRoot, key) {
	const entry = key === void 0 ? LOGIN_KEY_REJECTED_ENTRY : rejectedKeyEntry(key);
	if (storageRoot !== void 0) await clearMarkers(storageRoot, entry);
}
function readLoginNotice(storageRoot, env = process.env, rejected) {
	const saved = loginStore(storageRoot).read();
	if (rejected !== void 0) return saved[rejectedKeyEntry(rejected)] === void 0 ? void 0 : LOGIN_KEY_REJECTED_NOTICE;
	const profile = readLoginProfile(env);
	if (profile === void 0) return void 0;
	const key = `${expiredMarkerPrefix(profile)}${profile.tokenHash}`;
	return unrecorded.has(key) || saved[key] !== void 0 ? LOGIN_PAUSED_NOTICE : void 0;
}
async function clearLoginExpiry(login, storageRoot) {
	const prefix = expiredMarkerPrefix(login);
	for (const key of unrecorded) if (key.startsWith(prefix)) unrecorded.delete(key);
	if (storageRoot !== void 0) await clearMarkers(storageRoot, prefix);
}
async function clearMarkers(storageRoot, prefix) {
	try {
		await forgetLogins(storageRoot, prefix, void 0);
	} catch (error) {
		console.warn(LOGIN_CLEANUP_WARNING, describe(error));
	}
}
async function claimLogin(profile, key, storageRoot) {
	if (storageRoot === void 0) return "unrecorded";
	try {
		if (!await claimStateEntry(join(storageRoot, "sign-in.json"), key, Infinity)) return "existing";
	} catch (error) {
		console.warn(LOGIN_MARKER_WARNING, describe(error));
		return "unrecorded";
	}
	await forgetLogins(storageRoot, expiredMarkerPrefix(profile), key);
	return "claimed";
}
function rejectedKeyEntry({ apiKey, apiUrl }) {
	const credential = `${sdkSetting(apiKey) ?? apiKey}\n${serverKey(apiUrl)}`;
	return `${LOGIN_KEY_REJECTED_ENTRY}${credentialHash(credential)}`;
}
async function forgetLogins(storageRoot, prefix, keep) {
	const forget = (key) => key.startsWith(prefix) && key !== keep;
	const store = loginStore(storageRoot);
	if (Object.keys(store.read()).some(forget)) await store.update((state) => Object.fromEntries(Object.entries(state).filter(([key]) => !forget(key))));
}
function loginStore(storageRoot) {
	return createStateStore({
		path: join(storageRoot, LOGIN_STATE_FILE),
		warn: () => void 0
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/constants.js
const CODING_AGENT_SCHEMA_VERSION = "coding-agent-v1";
const CODING_AGENT_PURPOSE = "coding";
const GIT_METADATA_KEYS = {
	repository: "ls_git_repo",
	repositoryUrl: "ls_git_repo_url",
	provider: "ls_repo_provider",
	branch: "ls_git_branch",
	commit: "ls_git_commit_hash"
};
const LEGACY_GIT_METADATA_KEYS = {
	repository: "repository_name",
	repositoryUrl: "repository_url",
	provider: "repository_provider",
	branch: "git_branch",
	commit: "git_commit_sha"
};
const ATTRIBUTION_IDENTIFIER_KEY = "ls_attribution_identifier";
const REPOSITORY_METADATA_KEYS = [
	GIT_METADATA_KEYS.repository,
	GIT_METADATA_KEYS.provider,
	GIT_METADATA_KEYS.repositoryUrl,
	GIT_METADATA_KEYS.branch,
	GIT_METADATA_KEYS.commit,
	LEGACY_GIT_METADATA_KEYS.repository,
	LEGACY_GIT_METADATA_KEYS.provider,
	LEGACY_GIT_METADATA_KEYS.repositoryUrl,
	LEGACY_GIT_METADATA_KEYS.branch,
	LEGACY_GIT_METADATA_KEYS.commit,
	ATTRIBUTION_IDENTIFIER_KEY
];
const CODING_AGENT_RUN_TYPES = [
	"root",
	"llm",
	"tool",
	"subagent",
	"interrupted"
];
const CODING_AGENT_RUN_SCOPES = {
	all: CODING_AGENT_RUN_TYPES,
	rootInterrupted: ["root", "interrupted"],
	subagent: ["subagent"],
	tool: ["tool"],
	llmTool: ["llm", "tool"],
	chain: [
		"root",
		"subagent",
		"interrupted"
	]
};
const CODING_AGENT_AGENT_TYPES = [
	"root",
	"subagent",
	"middleware",
	"compaction"
];
const CODING_AGENT_SCHEMA_INTEGRATIONS = [
	"claude-code",
	"openai-codex",
	"deepagents-code",
	"cursor",
	"pi"
];
const CODING_AGENT_CORE_INTEGRATIONS = [
	"claude-code",
	"cursor",
	"openai-codex"
];
const CODING_AGENT_CODEX_INTEGRATION = ["openai-codex"];
const CODING_AGENT_RUNTIME_NAMES = {
	"claude-code": "Claude Code",
	"openai-codex": "Codex",
	"deepagents-code": "Deep Agents Code",
	cursor: "Cursor",
	pi: "Pi"
};
const CODING_AGENT_INTEGRATION_POLICIES = {
	"claude-code": {
		fullModePrecedence: "custom-wins",
		metadataModeUsesDirectMetadata: true,
		metadataModePreservesToolName: false,
		legacyAliases: true
	},
	cursor: {
		fullModePrecedence: "custom-wins",
		metadataModeUsesDirectMetadata: true,
		metadataModePreservesToolName: true,
		legacyAliases: false
	},
	"openai-codex": {
		fullModePrecedence: "structural-wins",
		metadataModeUsesDirectMetadata: false,
		metadataModePreservesToolName: false,
		legacyAliases: false
	}
};
const CODING_AGENT_ALWAYS_FIELD_OPTIONS = { requirement: "always" };
const CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS = {
	requirement: "where_known",
	requiredWhereKnown: true
};
const CODING_AGENT_FIELD_DEFAULTS = {
	appliesTo: CODING_AGENT_RUN_TYPES,
	type: "string",
	allowedValues: null,
	requirement: "contextual",
	requiredWhereKnown: false,
	metadataModeIntegrations: []
};
const CODING_AGENT_STRUCTURAL_FIELD_DEFAULTS = {
	metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS,
	metadataSource: "structural"
};
const CODING_AGENT_PROVIDER_FIELD_DEFAULTS = {
	metadataSource: "provider",
	providerIntegrations: CODING_AGENT_CORE_INTEGRATIONS
};
const CODING_AGENT_METADATA_PROVENANCE_FIELDS = [
	"integration",
	"integrationVersion",
	"runtimeVersion",
	"threadId",
	"turnId",
	"turnNumber",
	"agentType",
	"runType",
	"approvalPolicy",
	"subagentId",
	"subagentType",
	"clearSubagent",
	"toolName",
	"runName",
	"skillName",
	"modelName",
	"usageMetadata",
	"providerMetadata",
	"runSpecific",
	"base"
];
const CODING_AGENT_METADATA_PROJECTION_FIELDS = [
	["integrationVersion", "ls_integration_version"],
	["runtimeVersion", "ls_agent_runtime_version"],
	["turnId", "turn_id"],
	["turnNumber", "turn_number"],
	["approvalPolicy", "approval_policy"],
	["subagentId", "ls_subagent_id"],
	["subagentType", "ls_subagent_type"],
	["skillName", "ls_skill_name"],
	["modelName", "ls_model_name"]
];
const TRUSTED_METADATA = Symbol("coding-agent trusted metadata");
const METADATA_MODE_NAME = "metadata";
const METADATA_MODE_STATUS_VALUES = [
	"running",
	"completed",
	"error"
];
const CODING_AGENT_RUNTIME_LIBRARY = "langsmith";
const CODING_AGENT_RUNTIME_SDK = "langsmith-js";
const CODING_AGENT_RELEASE_ENVIRONMENT_VARIABLES = [
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
const CODING_AGENT_ENVIRONMENT_METADATA_PREFIXES = ["LANGCHAIN_", "LANGSMITH_"];
const CODING_AGENT_ENVIRONMENT_METADATA_EXCLUDED = [
	"LANGCHAIN_API_KEY",
	"LANGCHAIN_ENDPOINT",
	"LANGCHAIN_TRACING_V2",
	"LANGCHAIN_PROJECT",
	"LANGCHAIN_SESSION",
	"LANGSMITH_API_KEY",
	"LANGSMITH_ENDPOINT",
	"LANGSMITH_TRACING_V2",
	"LANGSMITH_CONFIG_FILE",
	"LANGSMITH_PROJECT",
	"LANGSMITH_SESSION",
	"LANGSMITH_AGENT_ID",
	"LANGSMITH_AGENT_ENVIRONMENT"
];
const CODING_AGENT_ENVIRONMENT_METADATA_SENSITIVE_SUBSTRINGS = [
	"key",
	"secret",
	"token",
	"password",
	"passwd",
	"pwd",
	"credential",
	"email"
];
const CODING_AGENT_ENVIRONMENT_METADATA_ENDPOINT_SUBSTRINGS = [
	"endpoint",
	"proxy",
	"url",
	"auth",
	"header"
];
const CODING_AGENT_REVISION_ID_VARIABLE = "LANGCHAIN_REVISION_ID";
const CODING_AGENT_REVISION_ID_KEY = "revision_id";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/contract.js
function field$2(key, options = {}) {
	return {
		key,
		...CODING_AGENT_FIELD_DEFAULTS,
		...options
	};
}
const structural = (key, options = {}) => field$2(key, {
	...CODING_AGENT_STRUCTURAL_FIELD_DEFAULTS,
	...options
});
const provider = (key, options = {}) => field$2(key, {
	...CODING_AGENT_PROVIDER_FIELD_DEFAULTS,
	...options
});
const CODING_AGENT_V1_CONTRACT = {
	schemaVersion: CODING_AGENT_SCHEMA_VERSION,
	integrations: CODING_AGENT_SCHEMA_INTEGRATIONS,
	runtimeNames: CODING_AGENT_RUNTIME_NAMES,
	keys: [
		structural("ls_agent_purpose", {
			...CODING_AGENT_ALWAYS_FIELD_OPTIONS,
			allowedValues: [CODING_AGENT_PURPOSE]
		}),
		structural("ls_integration", {
			...CODING_AGENT_ALWAYS_FIELD_OPTIONS,
			allowedValues: CODING_AGENT_SCHEMA_INTEGRATIONS
		}),
		structural("ls_agent_runtime", {
			...CODING_AGENT_ALWAYS_FIELD_OPTIONS,
			allowedValues: Object.values(CODING_AGENT_RUNTIME_NAMES)
		}),
		structural("thread_id", CODING_AGENT_ALWAYS_FIELD_OPTIONS),
		structural("ls_trace_schema_version", {
			...CODING_AGENT_ALWAYS_FIELD_OPTIONS,
			allowedValues: [CODING_AGENT_SCHEMA_VERSION]
		}),
		structural("ls_agent_type", {
			...CODING_AGENT_ALWAYS_FIELD_OPTIONS,
			allowedValues: CODING_AGENT_AGENT_TYPES
		}),
		structural("ls_integration_version", CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		structural("ls_agent_runtime_version", CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		structural("turn_id", CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		structural("turn_number", {
			...CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS,
			type: "integer"
		}),
		field$2(GIT_METADATA_KEYS.repositoryUrl, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(GIT_METADATA_KEYS.provider, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(GIT_METADATA_KEYS.repository, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(GIT_METADATA_KEYS.branch, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(GIT_METADATA_KEYS.commit, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(LEGACY_GIT_METADATA_KEYS.repositoryUrl, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(LEGACY_GIT_METADATA_KEYS.provider, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(LEGACY_GIT_METADATA_KEYS.repository, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(LEGACY_GIT_METADATA_KEYS.branch, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2(LEGACY_GIT_METADATA_KEYS.commit, CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2("cwd", CODING_AGENT_WHERE_KNOWN_FIELD_OPTIONS),
		field$2("ls_skill_name", {
			appliesTo: CODING_AGENT_RUN_SCOPES.tool,
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS
		}),
		field$2(ATTRIBUTION_IDENTIFIER_KEY),
		field$2("user_id"),
		field$2("local_username"),
		field$2("user_email"),
		field$2("sandbox_type"),
		field$2("approval_policy", { appliesTo: CODING_AGENT_RUN_SCOPES.rootInterrupted }),
		field$2("ls_subagent_id", {
			appliesTo: CODING_AGENT_RUN_SCOPES.subagent,
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS
		}),
		field$2("ls_subagent_type", {
			appliesTo: CODING_AGENT_RUN_SCOPES.subagent,
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS
		}),
		field$2("ls_tool_name", {
			appliesTo: CODING_AGENT_RUN_SCOPES.tool,
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS
		}),
		provider("ls_provider", {
			appliesTo: CODING_AGENT_RUN_SCOPES.llmTool,
			metadataModeIntegrations: CODING_AGENT_CODEX_INTEGRATION
		}),
		provider("ls_model_type", {
			appliesTo: CODING_AGENT_RUN_SCOPES.llmTool,
			metadataModeIntegrations: CODING_AGENT_CODEX_INTEGRATION,
			providerIntegrations: CODING_AGENT_CODEX_INTEGRATION
		}),
		provider("ls_message_format", {
			metadataModeIntegrations: CODING_AGENT_CODEX_INTEGRATION,
			providerIntegrations: CODING_AGENT_CODEX_INTEGRATION
		}),
		provider("codex_cli_version", {
			metadataModeIntegrations: CODING_AGENT_CODEX_INTEGRATION,
			providerIntegrations: CODING_AGENT_CODEX_INTEGRATION
		}),
		provider("ls_raw_aggregated_usage", {
			appliesTo: CODING_AGENT_RUN_SCOPES.chain,
			type: "object",
			metadataModeIntegrations: CODING_AGENT_CODEX_INTEGRATION,
			providerIntegrations: CODING_AGENT_CODEX_INTEGRATION
		}),
		provider("ls_invocation_params", {
			appliesTo: CODING_AGENT_RUN_SCOPES.llmTool,
			type: "object"
		}),
		field$2("usage_metadata", {
			type: "object",
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS,
			metadataSource: "explicit"
		}),
		field$2("ls_model_name", {
			metadataModeIntegrations: CODING_AGENT_CORE_INTEGRATIONS,
			metadataSource: "explicit"
		})
	],
	runtime: {
		library: CODING_AGENT_RUNTIME_LIBRARY,
		sdk: CODING_AGENT_RUNTIME_SDK,
		releaseEnvironmentVariables: CODING_AGENT_RELEASE_ENVIRONMENT_VARIABLES,
		environmentMetadata: {
			prefixes: CODING_AGENT_ENVIRONMENT_METADATA_PREFIXES,
			excluded: CODING_AGENT_ENVIRONMENT_METADATA_EXCLUDED,
			sensitiveSubstrings: CODING_AGENT_ENVIRONMENT_METADATA_SENSITIVE_SUBSTRINGS,
			endpointSubstrings: CODING_AGENT_ENVIRONMENT_METADATA_ENDPOINT_SUBSTRINGS,
			revisionId: {
				variable: CODING_AGENT_REVISION_ID_VARIABLE,
				key: CODING_AGENT_REVISION_ID_KEY
			}
		}
	},
	integrationPolicies: CODING_AGENT_INTEGRATION_POLICIES
};
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/git-names.js
function withBothGitMetadataNames(metadata) {
	const both = { ...metadata };
	for (const role of Object.keys(GIT_METADATA_KEYS)) {
		const value = both[GIT_METADATA_KEYS[role]] ?? both[LEGACY_GIT_METADATA_KEYS[role]];
		if (value === void 0) continue;
		both[GIT_METADATA_KEYS[role]] ??= value;
		both[LEGACY_GIT_METADATA_KEYS[role]] ??= value;
	}
	return both;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/validation.js
function metadataFieldTypeIssue(field, value) {
	if (!(field.type === "string" ? typeof value === "string" && value.length > 0 : field.type === "integer" ? typeof value === "number" && Number.isSafeInteger(value) && value >= 1 : isPlainRecord(value))) return "type";
}
function metadataFieldValueIssue(field, value) {
	const typeIssue = metadataFieldTypeIssue(field, value);
	if (typeIssue) return typeIssue;
	if (field.allowedValues && !field.allowedValues.includes(value)) return "value";
}
function validateProviderMetadata(value, integration, runType) {
	if (!isPlainRecord(value)) return [{
		key: "",
		reason: "type"
	}];
	const issues = [];
	for (const [key, entry] of Object.entries(value)) {
		const field = CODING_AGENT_V1_CONTRACT.keys.find((candidate) => candidate.key === key);
		if (field?.metadataSource !== "provider") {
			issues.push({
				key,
				reason: "scope"
			});
			continue;
		}
		if (!field.providerIntegrations?.includes(integration)) {
			issues.push({
				key,
				reason: "integration"
			});
			continue;
		}
		if (!field.appliesTo.includes(runType)) {
			issues.push({
				key,
				reason: "scope"
			});
			continue;
		}
		const reason = metadataFieldValueIssue(field, entry);
		if (reason) issues.push({
			key,
			reason
		});
	}
	return issues;
}
function normalizeProviderMetadata(value, integration, runType) {
	if (!isPlainRecord(value)) return {};
	const issues = new Map(validateProviderMetadata(value, integration, runType).map((issue) => [issue.key, issue]));
	return Object.fromEntries(Object.entries(value).filter(([key, entry]) => entry !== void 0 && !issues.has(key)));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/builder.js
function buildCodingAgentMetadata(options) {
	const policy = CODING_AGENT_INTEGRATION_POLICIES[options.integration];
	const identity = {
		ls_agent_purpose: CODING_AGENT_PURPOSE,
		ls_integration: options.integration,
		ls_agent_runtime: CODING_AGENT_V1_CONTRACT.runtimeNames[options.integration],
		ls_trace_schema_version: CODING_AGENT_SCHEMA_VERSION,
		ls_agent_type: options.agentType,
		thread_id: options.threadId
	};
	if (options.integrationVersion) identity.ls_integration_version = options.integrationVersion;
	if (options.runtimeVersion) identity.ls_agent_runtime_version = options.runtimeVersion;
	if (options.turnId) identity.turn_id = options.turnId;
	if (typeof options.turnNumber === "number") identity.turn_number = options.turnNumber;
	if (options.approvalPolicy) identity.approval_policy = options.approvalPolicy;
	if (options.clearSubagent) {
		identity.ls_subagent_id = void 0;
		identity.ls_subagent_type = void 0;
	} else {
		if (options.subagentId) identity.ls_subagent_id = options.subagentId;
		if (options.subagentType) identity.ls_subagent_type = options.subagentType;
	}
	if (options.toolName) {
		if (policy.legacyAliases) identity.tool_name = options.toolName;
		if (options.runName && options.toolName !== options.runName) identity.ls_tool_name = options.toolName;
	}
	if (options.skillName) identity.ls_skill_name = options.skillName;
	if (policy.legacyAliases && options.subagentId) identity.agent_id = options.subagentId;
	if (policy.legacyAliases && options.subagentType) identity.agent_type = options.subagentType;
	const explicit = {};
	if (options.modelName !== void 0) explicit.ls_model_name = options.modelName;
	if (options.usageMetadata !== void 0) explicit.usage_metadata = options.usageMetadata;
	const provider = normalizeProviderMetadata(options.providerMetadata, options.integration, options.runType);
	const trusted = {
		...identity,
		...explicit,
		...provider
	};
	if (policy.metadataModePreservesToolName && options.toolName) trusted.ls_tool_name = options.toolName;
	const pieces = [
		identity,
		explicit,
		provider,
		options.runSpecific,
		options.base
	];
	const full = policy.fullModePrecedence === "custom-wins" ? pieces : pieces.toReversed();
	const merged = {};
	for (const piece of full) if (piece) Object.assign(merged, piece);
	const result = withBothGitMetadataNames(merged);
	Object.defineProperty(result, TRUSTED_METADATA, { value: trusted });
	return result;
}
function trustedCodingAgentMetadata(metadata) {
	return metadata?.[TRUSTED_METADATA];
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/runtime.js
function forwardsEnvironmentVariable(name, value, environmentMetadata) {
	return typeof value === "string" && environmentMetadata.prefixes.some((prefix) => name.startsWith(prefix)) && !environmentMetadata.excluded.includes(name) && ![...environmentMetadata.sensitiveSubstrings, ...environmentMetadata.endpointSubstrings].some((part) => name.toLowerCase().includes(part));
}
function buildCodingAgentRuntimeMetadata(options) {
	const { library, sdk, releaseEnvironmentVariables, environmentMetadata } = CODING_AGENT_V1_CONTRACT.runtime;
	const runtime = {
		library,
		runtime: options.runtime,
		sdk,
		sdk_version: options.sdkVersion
	};
	for (const name of releaseEnvironmentVariables) {
		const value = options.env[name];
		if (value !== void 0) runtime[name] = value;
	}
	const metadata = {};
	for (const [name, value] of Object.entries(options.env)) {
		if (!forwardsEnvironmentVariable(name, value, environmentMetadata)) continue;
		metadata[name === environmentMetadata.revisionId.variable ? environmentMetadata.revisionId.key : name] = value;
	}
	return {
		runtime,
		metadata
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/privacy.js
function projectCodingAgentMetadata(metadata, integration, status) {
	const safe = {};
	for (const [key, value] of Object.entries(metadata ?? {})) {
		const field = CODING_AGENT_V1_CONTRACT.keys.find((entry) => entry.key === key);
		if (!field?.metadataModeIntegrations.includes(integration) || value === void 0 || metadataFieldTypeIssue(field, value) !== void 0) continue;
		safe[key] = value;
	}
	safe.status = METADATA_MODE_STATUS_VALUES.includes(status) ? status : "running";
	safe.ls_tracing_mode = METADATA_MODE_NAME;
	return safe;
}
function metadataForMode(metadata, integration, mode = "full", status) {
	if (mode === "full") return metadata;
	return projectCodingAgentMetadata(trustedCodingAgentMetadata(metadata) ?? (CODING_AGENT_INTEGRATION_POLICIES[integration].metadataModeUsesDirectMetadata ? metadata : void 0), integration, status);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/metadata/provenance.js
function prepareCodingAgentMetadataProvenance(value, integration, mode, status = "running") {
	const source = requirePlainRecord(value, "Run metadata");
	const declaredIntegration = ownDataField(source, "integration");
	if (declaredIntegration.present && declaredIntegration.value !== integration) throw new TypeError("Run metadata integration does not match the lifecycle bridge");
	const selected = {};
	for (const key of CODING_AGENT_METADATA_PROVENANCE_FIELDS) {
		const field = ownDataField(source, key);
		if (field.present && field.value !== void 0) selected[key] = field.value;
	}
	selected["integration"] = integration;
	const threadId = selected["threadId"];
	if (typeof threadId !== "string" || threadId.trim().length === 0) return { status: "deferred" };
	const agentType = selected["agentType"];
	if (typeof agentType !== "string" || !CODING_AGENT_AGENT_TYPES.includes(agentType)) throw new TypeError("Run metadata has an invalid agent type");
	const runType = selected["runType"];
	if (typeof runType !== "string" || !CODING_AGENT_RUN_TYPES.includes(runType)) throw new TypeError("Run metadata has an invalid run type");
	for (const key of [
		"usageMetadata",
		"providerMetadata",
		"runSpecific",
		"base"
	]) if (selected[key] !== void 0) selected[key] = canonicalJsonObject(selected[key], `Run metadata ${key}`);
	selected["providerMetadata"] = normalizeProviderMetadata(selected["providerMetadata"], integration, runType);
	if (mode === "metadata") {
		delete selected["base"];
		delete selected["runSpecific"];
	}
	const options = selected;
	return {
		status: "ready",
		value: mode === "metadata" ? projectMetadataProvenance(options, integration, status) : options
	};
}
function projectMetadataProvenance(options, integration, status) {
	const projection = metadataForMode(buildCodingAgentMetadata(options), integration, "metadata", status) ?? {};
	const safe = {
		integration,
		threadId: projectedString(projection, "thread_id"),
		agentType: projectedString(projection, "ls_agent_type"),
		runType: options.runType
	};
	for (const [optionKey, metadataKey] of CODING_AGENT_METADATA_PROJECTION_FIELDS) if (Object.hasOwn(projection, metadataKey)) safe[optionKey] = projection[metadataKey];
	if (options.clearSubagent === true) safe["clearSubagent"] = true;
	if (typeof options.toolName === "string" && (projection["ls_tool_name"] === options.toolName || projection["tool_name"] === options.toolName)) {
		safe["toolName"] = options.toolName;
		if (typeof options.runName === "string") safe["runName"] = options.runName;
	}
	if (Object.hasOwn(projection, "usage_metadata")) safe["usageMetadata"] = projection["usage_metadata"];
	const provider = normalizeProviderMetadata(options.providerMetadata, integration, options.runType);
	const allowedProvider = Object.fromEntries(Object.entries(provider).filter(([key]) => Object.hasOwn(projection, key)));
	if (Object.keys(allowedProvider).length > 0) safe["providerMetadata"] = allowedProvider;
	return safe;
}
function projectedString(source, key) {
	const value = source[key];
	if (typeof value !== "string" || value.trim().length === 0) throw new TypeError(`Metadata projection ${key} is required`);
	return value;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/regex.js
var regex_default$1 = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/validate.js
function validate$1(uuid) {
	return typeof uuid === "string" && regex_default$1.test(uuid);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/parse.js
function parse$2(uuid) {
	if (!validate$1(uuid)) throw TypeError("Invalid UUID");
	let v;
	return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255, v / 4294967296 & 255, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/stringify.js
/**
* Convert array of 16 byte values to UUID string format of the form:
* XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
*/
const byteToHex$1 = [];
for (let i = 0; i < 256; ++i) byteToHex$1.push((i + 256).toString(16).slice(1));
function unsafeStringify$1(arr, offset = 0) {
	return (byteToHex$1[arr[offset + 0]] + byteToHex$1[arr[offset + 1]] + byteToHex$1[arr[offset + 2]] + byteToHex$1[arr[offset + 3]] + "-" + byteToHex$1[arr[offset + 4]] + byteToHex$1[arr[offset + 5]] + "-" + byteToHex$1[arr[offset + 6]] + byteToHex$1[arr[offset + 7]] + "-" + byteToHex$1[arr[offset + 8]] + byteToHex$1[arr[offset + 9]] + "-" + byteToHex$1[arr[offset + 10]] + byteToHex$1[arr[offset + 11]] + byteToHex$1[arr[offset + 12]] + byteToHex$1[arr[offset + 13]] + byteToHex$1[arr[offset + 14]] + byteToHex$1[arr[offset + 15]]).toLowerCase();
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/rng.js
const rnds8 = /* @__PURE__ */ new Uint8Array(16);
function rng() {
	return crypto.getRandomValues(rnds8);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/v4.js
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
	return unsafeStringify$1(rnds);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/sha1.js
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
function sha1$1(bytes) {
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
		const arr = /* @__PURE__ */ new Uint32Array(16);
		for (let j = 0; j < 16; ++j) arr[j] = bytes[i * 64 + j * 4] << 24 | bytes[i * 64 + j * 4 + 1] << 16 | bytes[i * 64 + j * 4 + 2] << 8 | bytes[i * 64 + j * 4 + 3];
		M[i] = arr;
	}
	M[N - 1][14] = (bytes.length - 1) * 8 / 2 ** 32;
	M[N - 1][14] = Math.floor(M[N - 1][14]);
	M[N - 1][15] = (bytes.length - 1) * 8 & 4294967295;
	for (let i = 0; i < N; ++i) {
		const W = /* @__PURE__ */ new Uint32Array(80);
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/v35.js
function stringToBytes$1(str) {
	str = unescape(encodeURIComponent(str));
	const bytes = new Uint8Array(str.length);
	for (let i = 0; i < str.length; ++i) bytes[i] = str.charCodeAt(i);
	return bytes;
}
const DNS$1 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const URL$2 = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";
function v35$1(version, hash, value, namespace, buf, offset) {
	const valueBytes = typeof value === "string" ? stringToBytes$1(value) : value;
	const namespaceBytes = typeof namespace === "string" ? parse$2(namespace) : namespace;
	if (typeof namespace === "string") namespace = parse$2(namespace);
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
	return unsafeStringify$1(bytes);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/v5.js
function v5$1(value, namespace, buf, offset) {
	return v35$1(80, sha1$1, value, namespace, buf, offset);
}
v5$1.DNS = DNS$1;
v5$1.URL = URL$2;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/uuid/src/v7.js
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
	return buf ?? unsafeStringify$1(bytes);
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
		buf = /* @__PURE__ */ new Uint8Array(16);
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/experimental/otel/constants.js
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
const GEN_AI_TOOL_NAME = "gen_ai.tool.name";
const GEN_AI_TOOL_CALL_ID = "gen_ai.tool.call.id";
const GEN_AI_TOOL_DEFINITIONS = "gen_ai.tool.definitions";
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
const LANGSMITH_USAGE_METADATA = "langsmith.usage_metadata";
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/env.js
let globalEnv;
const isBrowser = () => typeof window !== "undefined" && typeof window.document !== "undefined";
const isWebWorker = () => typeof globalThis === "object" && globalThis.constructor && globalThis.constructor.name === "DedicatedWorkerGlobalScope";
const isJsDom = () => typeof window !== "undefined" && window.name === "nodejs" || typeof navigator !== "undefined" && navigator.userAgent.includes("jsdom");
const isDeno = () => typeof globalThis.Deno !== "undefined";
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
	if (runtimeEnvironment === void 0) {
		const env = getEnv();
		const releaseEnv = getShas();
		runtimeEnvironment = {
			library: "langsmith",
			runtime: env,
			sdk: "langsmith-js",
			sdk_version: __version__,
			...releaseEnv
		};
	}
	return runtimeEnvironment;
}
const EXCLUDED_SUBSTRINGS = [
	"key",
	"secret",
	"token",
	"password",
	"passwd",
	"pwd",
	"credential",
	"email"
];
function isSensitiveEnvVarName(key) {
	const lowered = key.toLowerCase();
	return EXCLUDED_SUBSTRINGS.some((sub) => lowered.includes(sub));
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
		"LANGSMITH_CONFIG_FILE",
		"LANGSMITH_PROJECT",
		"LANGSMITH_SESSION",
		"LANGSMITH_AGENT_ID",
		"LANGSMITH_AGENT_ENVIRONMENT"
	];
	for (const [key, value] of Object.entries(allEnvVars)) if (typeof value === "string" && !excluded.includes(key) && !isSensitiveEnvVarName(key)) {
		if (key === "LANGCHAIN_REVISION_ID") envVars["revision_id"] = value;
		else envVars[key] = value;
	}
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
			for (const [key, value] of Object.entries(process.env)) if ((key.startsWith("LANGCHAIN_") || key.startsWith("LANGSMITH_")) && value != null) {
				if (isSensitiveEnvVarName(key) && typeof value === "string") envVars[key] = value.slice(0, 2) + "*".repeat(value.length - 4) + value.slice(-2);
				else envVars[key] = value;
			}
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
const _VALID_TRACING_MODES = /* @__PURE__ */ new Set(["langsmith", "otel"]);
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/singletons/otel.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/experimental/otel/translator.js
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
function isPrimitive$1(value) {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
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
		if (runInfo.extra?.metadata?.usage_metadata && typeof runInfo.extra.metadata.usage_metadata === "object") span.setAttribute(LANGSMITH_USAGE_METADATA, JSON.stringify(runInfo.extra.metadata.usage_metadata));
		if ("prompt_tokens" in runInfo && typeof runInfo.prompt_tokens === "number") span.setAttribute(GEN_AI_USAGE_INPUT_TOKENS, runInfo.prompt_tokens);
		if ("completion_tokens" in runInfo && typeof runInfo.completion_tokens === "number") span.setAttribute(GEN_AI_USAGE_OUTPUT_TOKENS, runInfo.completion_tokens);
		if ("total_tokens" in runInfo && typeof runInfo.total_tokens === "number") span.setAttribute(GEN_AI_USAGE_TOTAL_TOKENS, runInfo.total_tokens);
		this.setInvocationParameters(span, runInfo);
		if ("run_type" in runInfo && runInfo.run_type === "tool") {
			if ("name" in runInfo && runInfo.name) span.setAttribute(GEN_AI_TOOL_NAME, runInfo.name);
			const toolCallId = runInfo.extra?.tool_call_id || runInfo.extra?.metadata?.tool_call_id;
			if (toolCallId != null) span.setAttribute(GEN_AI_TOOL_CALL_ID, String(toolCallId));
		}
		const metadata = runInfo.extra?.metadata || {};
		for (const [key, value] of Object.entries(metadata)) if (value !== null && value !== void 0) span.setAttribute(`${LANGSMITH_METADATA}.${key}`, isPrimitive$1(value) ? String(value) : JSON.stringify(value));
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
		const tools = runInfo.extra?.invocation_params?.tools;
		if (Array.isArray(tools) && tools.length > 0) span.setAttribute(GEN_AI_TOOL_DEFINITIONS, JSON.stringify(tools));
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
					span.setAttribute(LANGSMITH_USAGE_METADATA, JSON.stringify(usageMetadata));
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/is-network-error/index.js
const objectToString = Object.prototype.toString;
const isError = (value) => objectToString.call(value) === "[object Error]";
const errorMessages = /* @__PURE__ */ new Set([
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/p-retry/index.js
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
	var has = Object.prototype.hasOwnProperty;
	var prefix = "~";
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/p-queue.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/async_caller.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/messages.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/uuid.js
/**
* https://stackoverflow.com/a/2117523
*/
let uuid4 = function() {
	const { crypto } = globalThis;
	if (crypto?.randomUUID) {
		uuid4 = crypto.randomUUID.bind(crypto);
		return crypto.randomUUID();
	}
	const u8 = /* @__PURE__ */ new Uint8Array(1);
	const randomByte = crypto ? () => crypto.getRandomValues(u8)[0] : () => Math.random() * 255 & 255;
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (+c ^ randomByte() & 15 >> +c / 4).toString(16));
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/errors.js
function isAbortError(err) {
	return typeof err === "object" && err !== null && ("name" in err && err.name === "AbortError" || "message" in err && String(err.message).includes("FetchRequestCanceledException"));
}
const castToError = (err) => {
	if (err instanceof Error) return err;
	if (typeof err === "object" && err !== null) {
		try {
			if (Object.prototype.toString.call(err) === "[object Error]") {
				const error = new Error(err.message, err.cause ? { cause: err.cause } : {});
				if (err.stack) error.stack = err.stack;
				if (err.cause && !error.cause) error.cause = err.cause;
				if (err.name) error.name = err.name;
				return error;
			}
		} catch {}
		try {
			return new Error(JSON.stringify(err));
		} catch {}
	}
	return new Error(err);
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/core/error.js
var LangsmithError = class extends Error {};
var APIError = class APIError extends LangsmithError {
	constructor(status, error, message, headers) {
		super(`${APIError.makeMessage(status, error, message)}`);
		/** HTTP status for the response that caused the error */
		Object.defineProperty(this, "status", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/** HTTP headers for the response that caused the error */
		Object.defineProperty(this, "headers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/** JSON body of the response that caused the error */
		Object.defineProperty(this, "error", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.status = status;
		this.headers = headers;
		this.error = error;
	}
	static makeMessage(status, error, message) {
		const msg = error?.message ? typeof error.message === "string" ? error.message : JSON.stringify(error.message) : error ? JSON.stringify(error) : message;
		if (status && msg) return `${status} ${msg}`;
		if (status) return `${status} status code (no body)`;
		if (msg) return msg;
		return "(no status code or body)";
	}
	static generate(status, errorResponse, message, headers) {
		if (!status || !headers) return new APIConnectionError({
			message,
			cause: castToError(errorResponse)
		});
		const error = errorResponse;
		if (status === 400) return new BadRequestError(status, error, message, headers);
		if (status === 401) return new AuthenticationError(status, error, message, headers);
		if (status === 403) return new PermissionDeniedError(status, error, message, headers);
		if (status === 404) return new NotFoundError(status, error, message, headers);
		if (status === 409) return new ConflictError(status, error, message, headers);
		if (status === 422) return new UnprocessableEntityError(status, error, message, headers);
		if (status === 429) return new RateLimitError(status, error, message, headers);
		if (status >= 500) return new InternalServerError(status, error, message, headers);
		return new APIError(status, error, message, headers);
	}
};
var APIUserAbortError = class extends APIError {
	constructor({ message } = {}) {
		super(void 0, void 0, message || "Request was aborted.", void 0);
	}
};
var APIConnectionError = class extends APIError {
	constructor({ message, cause }) {
		super(void 0, void 0, message || "Connection error.", void 0);
		if (cause) this.cause = cause;
	}
};
var APIConnectionTimeoutError = class extends APIConnectionError {
	constructor({ message } = {}) {
		super({ message: message ?? "Request timed out." });
	}
};
var BadRequestError = class extends APIError {};
var AuthenticationError = class extends APIError {};
var PermissionDeniedError = class extends APIError {};
var NotFoundError = class extends APIError {};
var ConflictError = class extends APIError {};
var UnprocessableEntityError = class extends APIError {};
var RateLimitError = class extends APIError {};
var InternalServerError = class extends APIError {};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/values.js
const startsWithSchemeRegexp = /^[a-z][a-z0-9+.-]*:/i;
const isAbsoluteURL = (url) => {
	return startsWithSchemeRegexp.test(url);
};
let isArray = (val) => (isArray = Array.isArray, isArray(val));
let isReadonlyArray = isArray;
/** Returns an object if the given value isn't an object, otherwise returns as-is */
function maybeObj(x) {
	if (typeof x !== "object") return {};
	return x ?? {};
}
function isEmptyObj(obj) {
	if (!obj) return true;
	for (const _k in obj) return false;
	return true;
}
function hasOwn(obj, key) {
	return Object.prototype.hasOwnProperty.call(obj, key);
}
const validatePositiveInteger = (name, n) => {
	if (typeof n !== "number" || !Number.isInteger(n)) throw new LangsmithError(`${name} must be an integer`);
	if (n < 0) throw new LangsmithError(`${name} must be a positive integer`);
	return n;
};
const safeJSON = (text) => {
	try {
		return JSON.parse(text);
	} catch (err) {
		return;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/sleep.js
const sleep$1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/version.js
const VERSION = "0.0.1";
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/detect-platform.js
/**
* Note this does not detect 'browser'; for that, use getBrowserInfo().
*/
function getDetectedPlatform() {
	if (typeof Deno !== "undefined" && Deno.build != null) return "deno";
	if (typeof EdgeRuntime !== "undefined") return "edge";
	if (Object.prototype.toString.call(typeof globalThis.process !== "undefined" ? globalThis.process : 0) === "[object process]") return "node";
	return "unknown";
}
const getPlatformProperties = () => {
	const detectedPlatform = getDetectedPlatform();
	if (detectedPlatform === "deno") return {
		"X-Stainless-Lang": "js",
		"X-Stainless-Package-Version": VERSION,
		"X-Stainless-OS": normalizePlatform(Deno.build.os),
		"X-Stainless-Arch": normalizeArch(Deno.build.arch),
		"X-Stainless-Runtime": "deno",
		"X-Stainless-Runtime-Version": typeof Deno.version === "string" ? Deno.version : Deno.version?.deno ?? "unknown"
	};
	if (typeof EdgeRuntime !== "undefined") return {
		"X-Stainless-Lang": "js",
		"X-Stainless-Package-Version": VERSION,
		"X-Stainless-OS": "Unknown",
		"X-Stainless-Arch": `other:${EdgeRuntime}`,
		"X-Stainless-Runtime": "edge",
		"X-Stainless-Runtime-Version": globalThis.process.version
	};
	if (detectedPlatform === "node") return {
		"X-Stainless-Lang": "js",
		"X-Stainless-Package-Version": VERSION,
		"X-Stainless-OS": normalizePlatform(globalThis.process.platform ?? "unknown"),
		"X-Stainless-Arch": normalizeArch(globalThis.process.arch ?? "unknown"),
		"X-Stainless-Runtime": "node",
		"X-Stainless-Runtime-Version": globalThis.process.version ?? "unknown"
	};
	const browserInfo = getBrowserInfo();
	if (browserInfo) return {
		"X-Stainless-Lang": "js",
		"X-Stainless-Package-Version": VERSION,
		"X-Stainless-OS": "Unknown",
		"X-Stainless-Arch": "unknown",
		"X-Stainless-Runtime": `browser:${browserInfo.browser}`,
		"X-Stainless-Runtime-Version": browserInfo.version
	};
	return {
		"X-Stainless-Lang": "js",
		"X-Stainless-Package-Version": VERSION,
		"X-Stainless-OS": "Unknown",
		"X-Stainless-Arch": "unknown",
		"X-Stainless-Runtime": "unknown",
		"X-Stainless-Runtime-Version": "unknown"
	};
};
function getBrowserInfo() {
	if (typeof navigator === "undefined" || !navigator) return null;
	for (const { key, pattern } of [
		{
			key: "edge",
			pattern: /Edge(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
		},
		{
			key: "ie",
			pattern: /MSIE(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
		},
		{
			key: "ie",
			pattern: /Trident(?:.*rv\:(\d+)\.(\d+)(?:\.(\d+))?)?/
		},
		{
			key: "chrome",
			pattern: /Chrome(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
		},
		{
			key: "firefox",
			pattern: /Firefox(?:\W+(\d+)\.(\d+)(?:\.(\d+))?)?/
		},
		{
			key: "safari",
			pattern: /(?:Version\W+(\d+)\.(\d+)(?:\.(\d+))?)?(?:\W+Mobile\S*)?\W+Safari/
		}
	]) {
		const match = pattern.exec(navigator.userAgent);
		if (match) return {
			browser: key,
			version: `${match[1] || 0}.${match[2] || 0}.${match[3] || 0}`
		};
	}
	return null;
}
const normalizeArch = (arch) => {
	if (arch === "x32") return "x32";
	if (arch === "x86_64" || arch === "x64") return "x64";
	if (arch === "arm") return "arm";
	if (arch === "aarch64" || arch === "arm64") return "arm64";
	if (arch) return `other:${arch}`;
	return "unknown";
};
const normalizePlatform = (platform) => {
	platform = platform.toLowerCase();
	if (platform.includes("ios")) return "iOS";
	if (platform === "android") return "Android";
	if (platform === "darwin") return "MacOS";
	if (platform === "win32") return "Windows";
	if (platform === "freebsd") return "FreeBSD";
	if (platform === "openbsd") return "OpenBSD";
	if (platform === "linux") return "Linux";
	if (platform) return `Other:${platform}`;
	return "Unknown";
};
let _platformHeaders;
const getPlatformHeaders = () => {
	return _platformHeaders ??= getPlatformProperties();
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/shims.js
function getDefaultFetch() {
	if (typeof fetch !== "undefined") return fetch;
	throw new Error("`fetch` is not defined as a global; Either pass `fetch` to the client, `new Langsmith({ fetch })` or polyfill the global, `globalThis.fetch = fetch`");
}
function makeReadableStream(...args) {
	const ReadableStream = globalThis.ReadableStream;
	if (typeof ReadableStream === "undefined") throw new Error("`ReadableStream` is not defined as a global; You will need to polyfill it, `globalThis.ReadableStream = ReadableStream`");
	return new ReadableStream(...args);
}
function ReadableStreamFrom(iterable) {
	let iter = Symbol.asyncIterator in iterable ? iterable[Symbol.asyncIterator]() : iterable[Symbol.iterator]();
	return makeReadableStream({
		start() {},
		async pull(controller) {
			const { done, value } = await iter.next();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		async cancel() {
			await iter.return?.();
		}
	});
}
/**
* Cancels a ReadableStream we don't need to consume.
* See https://undici.nodejs.org/#/?id=garbage-collection
*/
async function CancelReadableStream(stream) {
	if (stream === null || typeof stream !== "object") return;
	if (stream[Symbol.asyncIterator]) {
		await stream[Symbol.asyncIterator]().return?.();
		return;
	}
	const reader = stream.getReader();
	const cancelPromise = reader.cancel();
	reader.releaseLock();
	await cancelPromise;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/request-options.js
const FallbackEncoder = ({ headers, body }) => {
	return {
		bodyHeaders: { "content-type": "application/json" },
		body: JSON.stringify(body)
	};
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/qs/formats.js
const default_format = "RFC3986";
const default_formatter = (v) => String(v);
const formatters = {
	RFC1738: (v) => String(v).replace(/%20/g, "+"),
	RFC3986: default_formatter
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/qs/utils.js
let has = (obj, key) => (has = Object.hasOwn ?? Function.prototype.call.bind(Object.prototype.hasOwnProperty), has(obj, key));
const hex_table = /* @__PURE__ */ (() => {
	const array = [];
	for (let i = 0; i < 256; ++i) array.push("%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());
	return array;
})();
const limit = 1024;
const encode = (str, _defaultEncoder, charset, _kind, format) => {
	if (str.length === 0) return str;
	let string = str;
	if (typeof str === "symbol") string = Symbol.prototype.toString.call(str);
	else if (typeof str !== "string") string = String(str);
	if (charset === "iso-8859-1") return escape(string).replace(/%u[0-9a-f]{4}/gi, function($0) {
		return "%26%23" + parseInt($0.slice(2), 16) + "%3B";
	});
	let out = "";
	for (let j = 0; j < string.length; j += limit) {
		const segment = string.length >= limit ? string.slice(j, j + limit) : string;
		const arr = [];
		for (let i = 0; i < segment.length; ++i) {
			let c = segment.charCodeAt(i);
			if (c === 45 || c === 46 || c === 95 || c === 126 || c >= 48 && c <= 57 || c >= 65 && c <= 90 || c >= 97 && c <= 122 || format === "RFC1738" && (c === 40 || c === 41)) {
				arr[arr.length] = segment.charAt(i);
				continue;
			}
			if (c < 128) {
				arr[arr.length] = hex_table[c];
				continue;
			}
			if (c < 2048) {
				arr[arr.length] = hex_table[192 | c >> 6] + hex_table[128 | c & 63];
				continue;
			}
			if (c < 55296 || c >= 57344) {
				arr[arr.length] = hex_table[224 | c >> 12] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
				continue;
			}
			i += 1;
			c = 65536 + ((c & 1023) << 10 | segment.charCodeAt(i) & 1023);
			arr[arr.length] = hex_table[240 | c >> 18] + hex_table[128 | c >> 12 & 63] + hex_table[128 | c >> 6 & 63] + hex_table[128 | c & 63];
		}
		out += arr.join("");
	}
	return out;
};
function is_buffer(obj) {
	if (!obj || typeof obj !== "object") return false;
	return !!(obj.constructor && obj.constructor.isBuffer && obj.constructor.isBuffer(obj));
}
function maybe_map(val, fn) {
	if (isArray(val)) {
		const mapped = [];
		for (let i = 0; i < val.length; i += 1) mapped.push(fn(val[i]));
		return mapped;
	}
	return fn(val);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/qs/stringify.js
const array_prefix_generators = {
	brackets(prefix) {
		return String(prefix) + "[]";
	},
	comma: "comma",
	indices(prefix, key) {
		return String(prefix) + "[" + key + "]";
	},
	repeat(prefix) {
		return String(prefix);
	}
};
const push_to_array = function(arr, value_or_array) {
	Array.prototype.push.apply(arr, isArray(value_or_array) ? value_or_array : [value_or_array]);
};
let toISOString;
const defaults = {
	addQueryPrefix: false,
	allowDots: false,
	allowEmptyArrays: false,
	arrayFormat: "indices",
	charset: "utf-8",
	charsetSentinel: false,
	delimiter: "&",
	encode: true,
	encodeDotInKeys: false,
	encoder: encode,
	encodeValuesOnly: false,
	format: default_format,
	formatter: default_formatter,
	/** @deprecated */
	indices: false,
	serializeDate(date) {
		return (toISOString ??= Function.prototype.call.bind(Date.prototype.toISOString))(date);
	},
	skipNulls: false,
	strictNullHandling: false
};
function is_non_nullish_primitive(v) {
	return typeof v === "string" || typeof v === "number" || typeof v === "boolean" || typeof v === "symbol" || typeof v === "bigint";
}
const sentinel = {};
function inner_stringify(object, prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, sideChannel) {
	let obj = object;
	let tmp_sc = sideChannel;
	let step = 0;
	let find_flag = false;
	while ((tmp_sc = tmp_sc.get(sentinel)) !== void 0 && !find_flag) {
		const pos = tmp_sc.get(object);
		step += 1;
		if (typeof pos !== "undefined") {
			if (pos === step) throw new RangeError("Cyclic object value");
			else find_flag = true;
		}
		if (typeof tmp_sc.get(sentinel) === "undefined") step = 0;
	}
	if (typeof filter === "function") obj = filter(prefix, obj);
	else if (obj instanceof Date) obj = serializeDate?.(obj);
	else if (generateArrayPrefix === "comma" && isArray(obj)) obj = maybe_map(obj, function(value) {
		if (value instanceof Date) return serializeDate?.(value);
		return value;
	});
	if (obj === null) {
		if (strictNullHandling) return encoder && !encodeValuesOnly ? encoder(prefix, defaults.encoder, charset, "key", format) : prefix;
		obj = "";
	}
	if (is_non_nullish_primitive(obj) || is_buffer(obj)) {
		if (encoder) {
			const key_value = encodeValuesOnly ? prefix : encoder(prefix, defaults.encoder, charset, "key", format);
			return [formatter?.(key_value) + "=" + formatter?.(encoder(obj, defaults.encoder, charset, "value", format))];
		}
		return [formatter?.(prefix) + "=" + formatter?.(String(obj))];
	}
	const values = [];
	if (typeof obj === "undefined") return values;
	let obj_keys;
	if (generateArrayPrefix === "comma" && isArray(obj)) {
		if (encodeValuesOnly && encoder) obj = maybe_map(obj, encoder);
		obj_keys = [{ value: obj.length > 0 ? obj.join(",") || null : void 0 }];
	} else if (isArray(filter)) obj_keys = filter;
	else {
		const keys = Object.keys(obj);
		obj_keys = sort ? keys.sort(sort) : keys;
	}
	const encoded_prefix = encodeDotInKeys ? String(prefix).replace(/\./g, "%2E") : String(prefix);
	const adjusted_prefix = commaRoundTrip && isArray(obj) && obj.length === 1 ? encoded_prefix + "[]" : encoded_prefix;
	if (allowEmptyArrays && isArray(obj) && obj.length === 0) return adjusted_prefix + "[]";
	for (let j = 0; j < obj_keys.length; ++j) {
		const key = obj_keys[j];
		const value = typeof key === "object" && typeof key.value !== "undefined" ? key.value : obj[key];
		if (skipNulls && value === null) continue;
		const encoded_key = allowDots && encodeDotInKeys ? key.replace(/\./g, "%2E") : key;
		const key_prefix = isArray(obj) ? typeof generateArrayPrefix === "function" ? generateArrayPrefix(adjusted_prefix, encoded_key) : adjusted_prefix : adjusted_prefix + (allowDots ? "." + encoded_key : "[" + encoded_key + "]");
		sideChannel.set(object, step);
		const valueSideChannel = /* @__PURE__ */ new WeakMap();
		valueSideChannel.set(sentinel, sideChannel);
		push_to_array(values, inner_stringify(value, key_prefix, generateArrayPrefix, commaRoundTrip, allowEmptyArrays, strictNullHandling, skipNulls, encodeDotInKeys, generateArrayPrefix === "comma" && encodeValuesOnly && isArray(obj) ? null : encoder, filter, sort, allowDots, serializeDate, format, formatter, encodeValuesOnly, charset, valueSideChannel));
	}
	return values;
}
function normalize_stringify_options(opts = defaults) {
	if (typeof opts.allowEmptyArrays !== "undefined" && typeof opts.allowEmptyArrays !== "boolean") throw new TypeError("`allowEmptyArrays` option can only be `true` or `false`, when provided");
	if (typeof opts.encodeDotInKeys !== "undefined" && typeof opts.encodeDotInKeys !== "boolean") throw new TypeError("`encodeDotInKeys` option can only be `true` or `false`, when provided");
	if (opts.encoder !== null && typeof opts.encoder !== "undefined" && typeof opts.encoder !== "function") throw new TypeError("Encoder has to be a function.");
	const charset = opts.charset || defaults.charset;
	if (typeof opts.charset !== "undefined" && opts.charset !== "utf-8" && opts.charset !== "iso-8859-1") throw new TypeError("The charset option must be either utf-8, iso-8859-1, or undefined");
	let format = default_format;
	if (typeof opts.format !== "undefined") {
		if (!has(formatters, opts.format)) throw new TypeError("Unknown format option provided.");
		format = opts.format;
	}
	const formatter = formatters[format];
	let filter = defaults.filter;
	if (typeof opts.filter === "function" || isArray(opts.filter)) filter = opts.filter;
	let arrayFormat;
	if (opts.arrayFormat && opts.arrayFormat in array_prefix_generators) arrayFormat = opts.arrayFormat;
	else if ("indices" in opts) arrayFormat = opts.indices ? "indices" : "repeat";
	else arrayFormat = defaults.arrayFormat;
	if ("commaRoundTrip" in opts && typeof opts.commaRoundTrip !== "boolean") throw new TypeError("`commaRoundTrip` must be a boolean, or absent");
	const allowDots = typeof opts.allowDots === "undefined" ? !!opts.encodeDotInKeys === true ? true : defaults.allowDots : !!opts.allowDots;
	return {
		addQueryPrefix: typeof opts.addQueryPrefix === "boolean" ? opts.addQueryPrefix : defaults.addQueryPrefix,
		allowDots,
		allowEmptyArrays: typeof opts.allowEmptyArrays === "boolean" ? !!opts.allowEmptyArrays : defaults.allowEmptyArrays,
		arrayFormat,
		charset,
		charsetSentinel: typeof opts.charsetSentinel === "boolean" ? opts.charsetSentinel : defaults.charsetSentinel,
		commaRoundTrip: !!opts.commaRoundTrip,
		delimiter: typeof opts.delimiter === "undefined" ? defaults.delimiter : opts.delimiter,
		encode: typeof opts.encode === "boolean" ? opts.encode : defaults.encode,
		encodeDotInKeys: typeof opts.encodeDotInKeys === "boolean" ? opts.encodeDotInKeys : defaults.encodeDotInKeys,
		encoder: typeof opts.encoder === "function" ? opts.encoder : defaults.encoder,
		encodeValuesOnly: typeof opts.encodeValuesOnly === "boolean" ? opts.encodeValuesOnly : defaults.encodeValuesOnly,
		filter,
		format,
		formatter,
		serializeDate: typeof opts.serializeDate === "function" ? opts.serializeDate : defaults.serializeDate,
		skipNulls: typeof opts.skipNulls === "boolean" ? opts.skipNulls : defaults.skipNulls,
		sort: typeof opts.sort === "function" ? opts.sort : null,
		strictNullHandling: typeof opts.strictNullHandling === "boolean" ? opts.strictNullHandling : defaults.strictNullHandling
	};
}
function stringify(object, opts = {}) {
	let obj = object;
	const options = normalize_stringify_options(opts);
	let obj_keys;
	let filter;
	if (typeof options.filter === "function") {
		filter = options.filter;
		obj = filter("", obj);
	} else if (isArray(options.filter)) {
		filter = options.filter;
		obj_keys = filter;
	}
	const keys = [];
	if (typeof obj !== "object" || obj === null) return "";
	const generateArrayPrefix = array_prefix_generators[options.arrayFormat];
	const commaRoundTrip = generateArrayPrefix === "comma" && options.commaRoundTrip;
	if (!obj_keys) obj_keys = Object.keys(obj);
	if (options.sort) obj_keys.sort(options.sort);
	const sideChannel = /* @__PURE__ */ new WeakMap();
	for (let i = 0; i < obj_keys.length; ++i) {
		const key = obj_keys[i];
		if (options.skipNulls && obj[key] === null) continue;
		push_to_array(keys, inner_stringify(obj[key], key, generateArrayPrefix, commaRoundTrip, options.allowEmptyArrays, options.strictNullHandling, options.skipNulls, options.encodeDotInKeys, options.encode ? options.encoder : null, options.filter, options.sort, options.allowDots, options.serializeDate, options.format, options.formatter, options.encodeValuesOnly, options.charset, sideChannel));
	}
	const joined = keys.join(options.delimiter);
	let prefix = options.addQueryPrefix === true ? "?" : "";
	if (options.charsetSentinel) {
		if (options.charset === "iso-8859-1") prefix += "utf8=%26%2310003%3B&";
		else prefix += "utf8=%E2%9C%93&";
	}
	return joined.length > 0 ? prefix + joined : "";
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/query.js
function stringifyQuery(query) {
	return stringify(query, { arrayFormat: "repeat" });
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/log.js
const levelNumbers = {
	off: 0,
	error: 200,
	warn: 300,
	info: 400,
	debug: 500
};
const parseLogLevel = (maybeLevel, sourceName, client) => {
	if (!maybeLevel) return;
	if (hasOwn(levelNumbers, maybeLevel)) return maybeLevel;
	loggerFor(client).warn(`${sourceName} was set to ${JSON.stringify(maybeLevel)}, expected one of ${JSON.stringify(Object.keys(levelNumbers))}`);
};
function noop() {}
function makeLogFn(fnLevel, logger, logLevel) {
	if (!logger || levelNumbers[fnLevel] > levelNumbers[logLevel]) return noop;
	else return logger[fnLevel].bind(logger);
}
const noopLogger = {
	error: noop,
	warn: noop,
	info: noop,
	debug: noop
};
let cachedLoggers = /* @__PURE__ */ new WeakMap();
function loggerFor(client) {
	const logger = client.logger;
	const logLevel = client.logLevel ?? "off";
	if (!logger) return noopLogger;
	const cachedLogger = cachedLoggers.get(logger);
	if (cachedLogger && cachedLogger[0] === logLevel) return cachedLogger[1];
	const levelLogger = {
		error: makeLogFn("error", logger, logLevel),
		warn: makeLogFn("warn", logger, logLevel),
		info: makeLogFn("info", logger, logLevel),
		debug: makeLogFn("debug", logger, logLevel)
	};
	cachedLoggers.set(logger, [logLevel, levelLogger]);
	return levelLogger;
}
const formatRequestDetails = (details) => {
	if (details.options) {
		details.options = { ...details.options };
		delete details.options["headers"];
	}
	if (details.headers) details.headers = Object.fromEntries((details.headers instanceof Headers ? [...details.headers] : Object.entries(details.headers)).map(([name, value]) => [name, name.toLowerCase() === "authorization" || name.toLowerCase() === "api-key" || name.toLowerCase() === "x-api-key" || name.toLowerCase() === "cookie" || name.toLowerCase() === "set-cookie" || name.toLowerCase() === "x-tenant-id" ? "***" : value]));
	if ("retryOfRequestLogID" in details) {
		if (details.retryOfRequestLogID) details.retryOf = details.retryOfRequestLogID;
		delete details.retryOfRequestLogID;
	}
	return details;
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/parse.js
async function defaultParseResponse(client, props) {
	const { response, requestLogID, retryOfRequestLogID, startTime } = props;
	const body = await (async () => {
		if (response.status === 204) return null;
		if (props.options.__binaryResponse) return response;
		const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim();
		if (mediaType?.includes("application/json") || mediaType?.endsWith("+json")) {
			if (response.headers.get("content-length") === "0") return;
			return await response.json();
		}
		return await response.text();
	})();
	loggerFor(client).debug(`[${requestLogID}] response parsed`, formatRequestDetails({
		retryOfRequestLogID,
		url: response.url,
		status: response.status,
		body,
		durationMs: Date.now() - startTime
	}));
	return body;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/core/api-promise.js
var __classPrivateFieldSet$2 = function(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet$2 = function(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _APIPromise_client;
/**
* A subclass of `Promise` providing additional helper methods
* for interacting with the SDK.
*/
var APIPromise = class APIPromise extends Promise {
	constructor(client, responsePromise, parseResponse = defaultParseResponse) {
		super((resolve) => {
			resolve(null);
		});
		Object.defineProperty(this, "responsePromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: responsePromise
		});
		Object.defineProperty(this, "parseResponse", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: parseResponse
		});
		Object.defineProperty(this, "parsedPromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		_APIPromise_client.set(this, void 0);
		__classPrivateFieldSet$2(this, _APIPromise_client, client, "f");
	}
	_thenUnwrap(transform) {
		return new APIPromise(__classPrivateFieldGet$2(this, _APIPromise_client, "f"), this.responsePromise, async (client, props) => transform(await this.parseResponse(client, props), props));
	}
	/**
	* Gets the raw `Response` instance instead of parsing the response
	* data.
	*
	* If you want to parse the response body but still get the `Response`
	* instance, you can use {@link withResponse()}.
	*
	* 👋 Getting the wrong TypeScript type for `Response`?
	* Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
	* to your `tsconfig.json`.
	*/
	asResponse() {
		return this.responsePromise.then((p) => p.response);
	}
	/**
	* Gets the parsed response data and the raw `Response` instance.
	*
	* If you just want to get the raw `Response` instance without parsing it,
	* you can use {@link asResponse()}.
	*
	* 👋 Getting the wrong TypeScript type for `Response`?
	* Try setting `"moduleResolution": "NodeNext"` or add `"lib": ["DOM"]`
	* to your `tsconfig.json`.
	*/
	async withResponse() {
		const [data, response] = await Promise.all([this.parse(), this.asResponse()]);
		return {
			data,
			response
		};
	}
	parse() {
		if (!this.parsedPromise) this.parsedPromise = this.responsePromise.then((data) => this.parseResponse(__classPrivateFieldGet$2(this, _APIPromise_client, "f"), data));
		return this.parsedPromise;
	}
	then(onfulfilled, onrejected) {
		return this.parse().then(onfulfilled, onrejected);
	}
	catch(onrejected) {
		return this.parse().catch(onrejected);
	}
	finally(onfinally) {
		return this.parse().finally(onfinally);
	}
};
_APIPromise_client = /* @__PURE__ */ new WeakMap();
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/core/pagination.js
var __classPrivateFieldSet$1 = function(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet$1 = function(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _AbstractPage_client;
var AbstractPage = class {
	constructor(client, response, body, options) {
		_AbstractPage_client.set(this, void 0);
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "response", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "body", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		__classPrivateFieldSet$1(this, _AbstractPage_client, client, "f");
		this.options = options;
		this.response = response;
		this.body = body;
	}
	hasNextPage() {
		if (!this.getPaginatedItems().length) return false;
		return this.nextPageRequestOptions() != null;
	}
	async getNextPage() {
		const nextOptions = this.nextPageRequestOptions();
		if (!nextOptions) throw new LangsmithError("No next page expected; please check `.hasNextPage()` before calling `.getNextPage()`.");
		return await __classPrivateFieldGet$1(this, _AbstractPage_client, "f").requestAPIList(this.constructor, nextOptions);
	}
	async *iterPages() {
		let page = this;
		yield page;
		while (page.hasNextPage()) {
			page = await page.getNextPage();
			yield page;
		}
	}
	async *[(_AbstractPage_client = /* @__PURE__ */ new WeakMap(), Symbol.asyncIterator)]() {
		for await (const page of this.iterPages()) for (const item of page.getPaginatedItems()) yield item;
	}
};
/**
* This subclass of Promise will resolve to an instantiated Page once the request completes.
*
* It also implements AsyncIterable to allow auto-paginating iteration on an unawaited list call, eg:
*
*    for await (const item of client.items.list()) {
*      console.log(item)
*    }
*/
var PagePromise = class extends APIPromise {
	constructor(client, request, Page) {
		super(client, request, async (client, props) => new Page(client, props.response, await defaultParseResponse(client, props), props.options));
	}
	/**
	* Allow auto-paginating iteration on an unawaited list call, eg:
	*
	*    for await (const item of client.items.list()) {
	*      console.log(item)
	*    }
	*/
	async *[Symbol.asyncIterator]() {
		const page = await this;
		for await (const item of page) yield item;
	}
};
var OffsetPaginationTopLevelArray = class extends AbstractPage {
	constructor(client, response, body, options) {
		super(client, response, body, options);
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.items = body || [];
	}
	getPaginatedItems() {
		return this.items ?? [];
	}
	nextPageRequestOptions() {
		const currentCount = (this.options.query.offset ?? 0) + this.getPaginatedItems().length;
		return {
			...this.options,
			query: {
				...maybeObj(this.options.query),
				offset: currentCount
			}
		};
	}
};
var OffsetPaginationIssues = class extends AbstractPage {
	constructor(client, response, body, options) {
		super(client, response, body, options);
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.items = body || [];
	}
	getPaginatedItems() {
		return this.items ?? [];
	}
	nextPageRequestOptions() {
		const currentCount = (this.options.query.offset ?? 0) + this.getPaginatedItems().length;
		return {
			...this.options,
			query: {
				...maybeObj(this.options.query),
				offset: currentCount
			}
		};
	}
};
var OffsetPaginationOnlineEvaluators = class extends AbstractPage {
	constructor(client, response, body, options) {
		super(client, response, body, options);
		Object.defineProperty(this, "evaluators", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "total", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.evaluators = body.evaluators || [];
		this.total = body.total || 0;
	}
	getPaginatedItems() {
		return this.evaluators ?? [];
	}
	nextPageRequestOptions() {
		const currentCount = (this.options.query.offset ?? 0) + this.getPaginatedItems().length;
		return {
			...this.options,
			query: {
				...maybeObj(this.options.query),
				offset: currentCount
			}
		};
	}
};
var ItemsCursorPostPagination = class extends AbstractPage {
	constructor(client, response, body, options) {
		super(client, response, body, options);
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "next_cursor", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.items = body.items || [];
		this.next_cursor = body.next_cursor || "";
	}
	getPaginatedItems() {
		return this.items ?? [];
	}
	nextPageRequestOptions() {
		const cursor = this.next_cursor;
		if (!cursor) return null;
		return {
			...this.options,
			body: {
				...maybeObj(this.options.body),
				cursor
			}
		};
	}
};
var ItemsCursorGetPagination = class extends AbstractPage {
	constructor(client, response, body, options) {
		super(client, response, body, options);
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "next_cursor", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.items = body.items || [];
		this.next_cursor = body.next_cursor || "";
	}
	getPaginatedItems() {
		return this.items ?? [];
	}
	nextPageRequestOptions() {
		const cursor = this.next_cursor;
		if (!cursor) return null;
		return {
			...this.options,
			query: {
				...maybeObj(this.options.query),
				cursor
			}
		};
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/uploads.js
const checkFileSupport = () => {
	if (typeof File === "undefined") {
		const { process } = globalThis;
		const isOldNode = typeof process?.versions?.node === "string" && parseInt(process.versions.node.split(".")) < 20;
		throw new Error("`File` is not defined as a global, which is required for file uploads." + (isOldNode ? " Update to Node 20 LTS or newer, or set `globalThis.File` to `import('node:buffer').File`." : ""));
	}
};
/**
* Construct a `File` instance. This is used to ensure a helpful error is thrown
* for environments that don't define a global `File` yet.
*/
function makeFile(fileBits, fileName, options) {
	checkFileSupport();
	return new File(fileBits, fileName ?? "unknown_file", options);
}
function getName(value) {
	return (typeof value === "object" && value !== null && ("name" in value && value.name && String(value.name) || "url" in value && value.url && String(value.url) || "filename" in value && value.filename && String(value.filename) || "path" in value && value.path && String(value.path)) || "").split(/[\\/]/).pop() || void 0;
}
const isAsyncIterable = (value) => value != null && typeof value === "object" && typeof value[Symbol.asyncIterator] === "function";
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/to-file.js
/**
* This check adds the arrayBuffer() method type because it is available and used at runtime
*/
const isBlobLike = (value) => value != null && typeof value === "object" && typeof value.size === "number" && typeof value.type === "string" && typeof value.text === "function" && typeof value.slice === "function" && typeof value.arrayBuffer === "function";
/**
* This check adds the arrayBuffer() method type because it is available and used at runtime
*/
const isFileLike = (value) => value != null && typeof value === "object" && typeof value.name === "string" && typeof value.lastModified === "number" && isBlobLike(value);
const isResponseLike = (value) => value != null && typeof value === "object" && typeof value.url === "string" && typeof value.blob === "function";
/**
* Helper for creating a {@link File} to pass to an SDK upload method from a variety of different data formats
* @param value the raw content of the file. Can be an {@link Uploadable}, BlobLikePart, or AsyncIterable of BlobLikeParts
* @param {string=} name the name of the file. If omitted, toFile will try to determine a file name from bits if possible
* @param {Object=} options additional properties
* @param {string=} options.type the MIME type of the content
* @param {number=} options.lastModified the last modified timestamp
* @returns a {@link File} with the given properties
*/
async function toFile(value, name, options) {
	checkFileSupport();
	value = await value;
	if (isFileLike(value)) {
		if (value instanceof File) return value;
		return makeFile([await value.arrayBuffer()], value.name);
	}
	if (isResponseLike(value)) {
		const blob = await value.blob();
		name ||= new URL(value.url).pathname.split(/[\\/]/).pop();
		return makeFile(await getBytes(blob), name, options);
	}
	const parts = await getBytes(value);
	name ||= getName(value);
	if (!options?.type) {
		const type = parts.find((part) => typeof part === "object" && "type" in part && part.type);
		if (typeof type === "string") options = {
			...options,
			type
		};
	}
	return makeFile(parts, name, options);
}
async function getBytes(value) {
	let parts = [];
	if (typeof value === "string" || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) parts.push(value);
	else if (isBlobLike(value)) parts.push(value instanceof Blob ? value : await value.arrayBuffer());
	else if (isAsyncIterable(value)) for await (const chunk of value) parts.push(...await getBytes(chunk));
	else {
		const constructor = value?.constructor?.name;
		throw new Error(`Unexpected data type: ${typeof value}${constructor ? `; constructor: ${constructor}` : ""}${propsForError(value)}`);
	}
	return parts;
}
function propsForError(value) {
	if (typeof value !== "object" || value === null) return "";
	return `; props: [${Object.getOwnPropertyNames(value).map((p) => `"${p}"`).join(", ")}]`;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/core/resource.js
var APIResource = class {
	constructor(client) {
		Object.defineProperty(this, "_client", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this._client = client;
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/path.js
/**
* Percent-encode everything that isn't safe to have in a path without encoding safe chars.
*
* Taken from https://datatracker.ietf.org/doc/html/rfc3986#section-3.3:
* > unreserved  = ALPHA / DIGIT / "-" / "." / "_" / "~"
* > sub-delims  = "!" / "$" / "&" / "'" / "(" / ")" / "*" / "+" / "," / ";" / "="
* > pchar       = unreserved / pct-encoded / sub-delims / ":" / "@"
*/
function encodeURIPath(str) {
	return str.replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@]+/g, encodeURIComponent);
}
const EMPTY = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.create(null));
const createPathTagFunction = (pathEncoder = encodeURIPath) => function path(statics, ...params) {
	if (statics.length === 1) return statics[0];
	let postPath = false;
	const invalidSegments = [];
	const path = statics.reduce((previousValue, currentValue, index) => {
		if (/[?#]/.test(currentValue)) postPath = true;
		const value = params[index];
		let encoded = (postPath ? encodeURIComponent : pathEncoder)("" + value);
		if (index !== params.length && (value == null || typeof value === "object" && value.toString === Object.getPrototypeOf(Object.getPrototypeOf(value.hasOwnProperty ?? EMPTY) ?? EMPTY)?.toString)) {
			encoded = value + "";
			invalidSegments.push({
				start: previousValue.length + currentValue.length,
				length: encoded.length,
				error: `Value of type ${Object.prototype.toString.call(value).slice(8, -1)} is not a valid path parameter`
			});
		}
		return previousValue + currentValue + (index === params.length ? "" : encoded);
	}, "");
	const pathOnly = path.split(/[?#]/, 1)[0];
	const invalidSegmentPattern = /(?<=^|\/)(?:\.|%2e){1,2}(?=\/|$)/gi;
	let match;
	while ((match = invalidSegmentPattern.exec(pathOnly)) !== null) invalidSegments.push({
		start: match.index,
		length: match[0].length,
		error: `Value "${match[0]}" can\'t be safely passed as a path parameter`
	});
	invalidSegments.sort((a, b) => a.start - b.start);
	if (invalidSegments.length > 0) {
		let lastEnd = 0;
		const underline = invalidSegments.reduce((acc, segment) => {
			const spaces = " ".repeat(segment.start - lastEnd);
			const arrows = "^".repeat(segment.length);
			lastEnd = segment.start + segment.length;
			return acc + spaces + arrows;
		}, "");
		throw new LangsmithError(`Path parameters result in path with invalid segments:\n${invalidSegments.map((e) => e.error).join("\n")}\n${path}\n${underline}`);
	}
	return path;
};
/**
* URI-encodes path params and ensures no unsafe /./ or /../ path segments are introduced.
*/
const path$1 = /* @__PURE__ */ createPathTagFunction(encodeURIPath);
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/annotation-queues/items.js
var Items = class extends APIResource {
	/**
	* Add RUN or THREAD items to a single annotation queue. RUN items require run_id
	* unless they are created from a suggested example. THREAD items require thread_id
	* and project_id.
	*/
	create(queueID, params, options) {
		const { extend_trace_retention, ...body } = params;
		return this._client.post(path$1`/api/v1/platform/annotation-queues/${queueID}/items`, {
			query: { extend_trace_retention },
			body,
			...options
		});
	}
	/**
	* Partially update mutable timestamps (added_at, last_reviewed_time) for a RUN or
	* THREAD annotation queue item. Omit a field, or pass JSON null, to leave it
	* unchanged.
	*/
	update(itemID, params, options) {
		const { queue_id, ...body } = params;
		return this._client.patch(path$1`/api/v1/platform/annotation-queues/${queue_id}/items/${itemID}`, {
			body,
			...options
		});
	}
	/**
	* List RUN and THREAD items in a single annotation queue for one review status
	* section, with opaque cursor pagination. Optional item_type=RUN|THREAD filters
	* the page. direction=backward returns items before the supplied cursor. The
	* response contains item metadata only, not expanded run or thread payloads.
	* status=archived returns items whose queue review requirements have been
	* satisfied, not merely items the caller personally marked completed.
	*/
	list(queueID, query, options) {
		return this._client.getAPIList(path$1`/api/v1/platform/annotation-queues/${queueID}/items`, ItemsCursorGetPagination, {
			query,
			...options
		});
	}
	/**
	* Log the caller's reviewer status for a RUN or THREAD annotation queue item. A
	* null status re-shows the item for this reviewer.
	*/
	createStatus(queueItemID, body, options) {
		return this._client.post(path$1`/api/v1/platform/annotation-queues/items/${queueItemID}/status`, {
			body,
			...options
		});
	}
	/**
	* Remove RUN or THREAD items from a single annotation queue by item ID.
	*/
	deleteAll(queueID, body, options) {
		return this._client.post(path$1`/api/v1/platform/annotation-queues/${queueID}/items/delete`, {
			body,
			...options
		});
	}
	/**
	* Returns the number of annotation queue items for the requested reviewer-specific
	* or archived bucket.
	*/
	retrieveCount(queueID, query, options) {
		return this._client.get(path$1`/api/v1/platform/annotation-queues/${queueID}/items/count`, {
			query,
			...options
		});
	}
	/**
	* Resolve a RUN or THREAD item to its current review section and zero-based
	* position for deep linking.
	*/
	retrievePlacement(itemID, params, options) {
		const { queue_id } = params;
		return this._client.get(path$1`/api/v1/platform/annotation-queues/${queue_id}/items/${itemID}/placement`, options);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/annotation-queues/runs.js
var Runs$2 = class extends APIResource {
	/**
	* Add Runs To Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items create endpoint (POST /api/v1/platform/annotation-queues/{queue_id}/items) instead. Will be removed after Jan 31, 2027.
	*/
	create(queueID, params, options) {
		const { body, extend_trace_retention } = params;
		return this._client.post(path$1`/api/v1/annotation-queues/${queueID}/runs`, {
			query: { extend_trace_retention },
			body,
			...options
		});
	}
	/**
	* Update Run In Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items update method (PATCH /api/v1/platform/annotation-queues/{queue_id}/items/{item_id}) instead. Will be removed after Jan 31, 2027.
	*/
	update(queueRunID, params, options) {
		const { queue_id, ...body } = params;
		return this._client.patch(path$1`/api/v1/annotation-queues/${queue_id}/runs/${queueRunID}`, {
			body,
			...options
		});
	}
	/**
	* Get Runs From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items list method (GET /api/v1/platform/annotation-queues/{queue_id}/items) instead. Will be removed after Jan 31, 2027.
	*/
	list(queueID, query = {}, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${queueID}/runs`, {
			query,
			...options
		});
	}
	/**
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @deprecated Deprecated: use the annotation queue items create endpoint (POST /api/v1/platform/annotation-queues/{queue_id}/items) instead. Will be removed after Jan 31, 2027.
	*/
	createByKey(queueID, params, options) {
		const { body, extend_trace_retention } = params;
		return this._client.post(path$1`/api/v1/annotation-queues/${queueID}/runs/by-key`, {
			query: { extend_trace_retention },
			body,
			...options
		});
	}
	/**
	* Delete Runs From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items delete_all method (POST /api/v1/platform/annotation-queues/{queue_id}/items/delete) instead. Will be removed after Jan 31, 2027.
	*/
	deleteAll(queueID, body, options) {
		return this._client.post(path$1`/api/v1/annotation-queues/${queueID}/runs/delete`, {
			body,
			...options
		});
	}
	/**
	* Delete Run From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items delete_all method (POST /api/v1/platform/annotation-queues/{queue_id}/items/delete) with the item ID instead. Will be removed after Jan 31, 2027.
	*/
	deleteQueue(queueRunID, params, options) {
		const { queue_id } = params;
		return this._client.delete(path$1`/api/v1/annotation-queues/${queue_id}/runs/${queueRunID}`, options);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/annotation-queues/annotation-queues.js
var AnnotationQueues = class extends APIResource {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "runs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Runs$2(this._client)
		});
		Object.defineProperty(this, "items", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Items(this._client)
		});
	}
	/**
	* Get Annotation Queue
	*/
	retrieve(queueID, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${queueID}`, options);
	}
	/**
	* Update Annotation Queue
	*/
	update(queueID, body, options) {
		return this._client.patch(path$1`/api/v1/annotation-queues/${queueID}`, {
			body,
			...options
		});
	}
	/**
	* Delete Annotation Queue
	*/
	delete(queueID, options) {
		return this._client.delete(path$1`/api/v1/annotation-queues/${queueID}`, options);
	}
	/**
	* Create Annotation Queue
	*/
	annotationQueues(body, options) {
		return this._client.post("/api/v1/annotation-queues", {
			body,
			...options
		});
	}
	/**
	* Create Identity Annotation Queue Run Status
	*
	* @deprecated Deprecated: use the annotation queue items create_status method (POST /api/v1/platform/annotation-queues/items/{queue_item_id}/status) instead. Will be removed after Jan 31, 2027.
	*/
	createRunStatus(annotationQueueRunID, body, options) {
		return this._client.post(path$1`/api/v1/annotation-queues/status/${annotationQueueRunID}`, {
			body,
			...options
		});
	}
	/**
	* Export Annotation Queue Archived Runs
	*/
	export(queueID, body, options) {
		return this._client.post(path$1`/api/v1/annotation-queues/${queueID}/export`, {
			body,
			...options
		});
	}
	/**
	* Populate annotation queue with runs from an experiment.
	*/
	populate(body, options) {
		return this._client.post("/api/v1/annotation-queues/populate", {
			body,
			...options
		});
	}
	/**
	* Get Annotation Queues
	*/
	retrieveAnnotationQueues(query = {}, options) {
		return this._client.getAPIList("/api/v1/annotation-queues", OffsetPaginationTopLevelArray, {
			query,
			...options
		});
	}
	/**
	* Get Annotation Queues For Run
	*/
	retrieveQueues(runID, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${runID}/queues`, options);
	}
	/**
	* Get a run from an annotation queue
	*
	* @deprecated Deprecated: use the annotation queue items list and retrieve_placement methods instead, which call GET /api/v1/platform/annotation-queues/{queue_id}/items and GET /api/v1/platform/annotation-queues/{queue_id}/items/{item_id}/placement. Will be removed after Jan 31, 2027.
	*/
	retrieveRun(index, params, options) {
		const { queue_id, ...query } = params;
		return this._client.get(path$1`/api/v1/annotation-queues/${queue_id}/run/${index}`, {
			query,
			...options
		});
	}
	/**
	* Get Size From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items retrieve_count method (GET /api/v1/platform/annotation-queues/{queue_id}/items/count) with the desired status instead. Will be removed after Jan 31, 2027.
	*/
	retrieveSize(queueID, query = {}, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${queueID}/size`, {
			query,
			...options
		});
	}
	/**
	* Get Total Archived From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items retrieve_count method (GET /api/v1/platform/annotation-queues/{queue_id}/items/count?status=archived) instead. Will be removed after Jan 31, 2027.
	*/
	retrieveTotalArchived(queueID, query = {}, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${queueID}/total_archived`, {
			query,
			...options
		});
	}
	/**
	* Get Total Size From Annotation Queue
	*
	* @deprecated Deprecated: use the annotation queue items retrieve_count method (GET /api/v1/platform/annotation-queues/{queue_id}/items/count?status=all) instead. Will be removed after Jan 31, 2027.
	*/
	retrieveTotalSize(queueID, options) {
		return this._client.get(path$1`/api/v1/annotation-queues/${queueID}/total_size`, options);
	}
};
AnnotationQueues.Runs = Runs$2;
AnnotationQueues.Items = Items;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/datasets/experiment-runs.js
var ExperimentRuns = class extends APIResource {
	/**
	* Returns a paginated page of dataset examples with runs from the requested
	* experiments. Response uses the canonical `{items, next_cursor}` envelope.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*/
	query(datasetID, body, options) {
		return this._client.getAPIList(path$1`/api/v2/datasets/${datasetID}/experiment-runs`, ItemsCursorPostPagination, {
			body,
			method: "post",
			...options
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/datasets/datasets.js
var Datasets = class extends APIResource {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "experimentRuns", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new ExperimentRuns(this._client)
		});
	}
};
Datasets.ExperimentRuns = ExperimentRuns;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/info.js
var Info = class extends APIResource {
	/**
	* Returns information about the current LangSmith deployment: version, instance
	* feature flags, batch-ingest limits, and max SDK versions. Unauthenticated by
	* default; set FF_INFO_ENDPOINT_AUTH_REQUIRED=true to require auth.
	*/
	list(options) {
		return this._client.get("/api/v1/info", options);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/issues.js
var Issues = class extends APIResource {
	/**
	* **Beta:** This endpoint is in active development and may change without notice.
	*
	* Returns one issue for the authenticated tenant.
	*/
	retrieve(id, options) {
		return this._client.get(path$1`/api/v1/platform/issues/${id}`, options);
	}
	/**
	* **Beta:** This endpoint is in active development and may change without notice.
	*
	* Returns issues for the authenticated tenant, optionally filtered by session,
	* status, severity, tag, linked trace, or last modified time.
	*/
	list(query = {}, options) {
		return this._client.getAPIList("/api/v1/platform/issues", OffsetPaginationIssues, {
			query,
			...options
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/headers.js
const brand_privateNullableHeaders = /* @__PURE__ */ Symbol("brand.privateNullableHeaders");
function* iterateHeaders(headers) {
	if (!headers) return;
	if (brand_privateNullableHeaders in headers) {
		const { values, nulls } = headers;
		yield* values.entries();
		for (const name of nulls) yield [name, null];
		return;
	}
	let shouldClear = false;
	let iter;
	if (headers instanceof Headers) iter = headers.entries();
	else if (isReadonlyArray(headers)) iter = headers;
	else {
		shouldClear = true;
		iter = Object.entries(headers ?? {});
	}
	for (let row of iter) {
		const name = row[0];
		if (typeof name !== "string") throw new TypeError("expected header name to be a string");
		const values = isReadonlyArray(row[1]) ? row[1] : [row[1]];
		let didClear = false;
		for (const value of values) {
			if (value === void 0) continue;
			if (shouldClear && !didClear) {
				didClear = true;
				yield [name, null];
			}
			yield [name, value];
		}
	}
}
const buildHeaders = (newHeaders) => {
	const targetHeaders = new Headers();
	const nullHeaders = /* @__PURE__ */ new Set();
	for (const headers of newHeaders) {
		const seenHeaders = /* @__PURE__ */ new Set();
		for (const [name, value] of iterateHeaders(headers)) {
			const lowerName = name.toLowerCase();
			if (!seenHeaders.has(lowerName)) {
				targetHeaders.delete(name);
				seenHeaders.add(lowerName);
			}
			if (value === null) {
				targetHeaders.delete(name);
				nullHeaders.add(lowerName);
			} else {
				targetHeaders.append(name, value);
				nullHeaders.delete(lowerName);
			}
		}
	}
	return {
		[brand_privateNullableHeaders]: true,
		values: targetHeaders,
		nulls: nullHeaders
	};
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/online-evaluators.js
var OnlineEvaluators = class extends APIResource {
	/**
	* Create a new LLM or code evaluator for the current workspace.
	*/
	create(body, options) {
		return this._client.post("/api/v1/platform/evaluators", {
			body,
			...options
		});
	}
	/**
	* Retrieve a single evaluator by its ID.
	*/
	retrieve(evaluatorID, options) {
		return this._client.get(path$1`/api/v1/platform/evaluators/${evaluatorID}`, options);
	}
	/**
	* Update an existing evaluator's name, LLM configuration, or code configuration.
	*/
	update(evaluatorID, body, options) {
		return this._client.patch(path$1`/api/v1/platform/evaluators/${evaluatorID}`, {
			body,
			...options
		});
	}
	/**
	* List evaluators for the current workspace, with optional filtering by type,
	* name, tag, feedback key, or resource ID.
	*/
	list(query = {}, options) {
		return this._client.getAPIList("/api/v1/platform/evaluators", OffsetPaginationOnlineEvaluators, {
			query,
			...options
		});
	}
	/**
	* Delete an evaluator. When delete_run_rules is true, all run rules referencing
	* this evaluator are deleted first (same tenant). Associated llm_evaluators and
	* code_evaluators rows are removed by foreign-key cascade when the evaluator row
	* is deleted.
	*/
	delete(evaluatorID, params = {}, options) {
		const { delete_run_rules } = params ?? {};
		return this._client.delete(path$1`/api/v1/platform/evaluators/${evaluatorID}`, {
			query: { delete_run_rules },
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
	/**
	* Delete multiple evaluators by their IDs. Returns per-item success/failure.
	*/
	bulkDelete(params, options) {
		const { evaluator_ids, delete_run_rules } = params;
		return this._client.delete("/api/v1/platform/evaluators", {
			query: {
				evaluator_ids,
				delete_run_rules
			},
			...options
		});
	}
	/**
	* Returns per-day LLM evaluator spend for the requested 7-day period, grouped by
	* evaluator, resource, or run rule. Exactly one of group_by, evaluator_id,
	* session_id, or dataset_id is required. resource_id, type, feedback_key, and
	* tag_value_id may be supplied with group_by to narrow listing aggregations.
	*/
	spend(query, options) {
		return this._client.get("/api/v1/platform/evaluators/spend", {
			query,
			...options
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/public/runs.js
var Runs$1 = class extends APIResource {
	/**
	* Returns one run within the trace identified by the share token. The request
	* supplies only the run ID and that run's exact start_time coordinate.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const run = await client.public.runs.retrieve(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*   {
	*     share_token: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*     selects: ['string'],
	*     start_time: '2019-12-27T18:11:19.117Z',
	*   },
	* );
	* ```
	*/
	retrieve(runID, params, options) {
		const { share_token, Accept, ...query } = params;
		return this._client.get(path$1`/api/v2/public/${share_token}/run/${runID}`, {
			query,
			...options,
			headers: buildHeaders([{ ...Accept != null ? { Accept } : void 0 }, options?.headers])
		});
	}
	/**
	* Returns all runs within the trace identified by the share token. The share token
	* supplies the tenant, project, and trace scope.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const response = await client.public.runs.query(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	* );
	* ```
	*/
	query(shareToken, params, options) {
		const { Accept, ...body } = params;
		return this._client.post(path$1`/api/v2/public/${shareToken}/runs/query`, {
			body,
			...options,
			headers: buildHeaders([{ ...Accept != null ? { Accept } : void 0 }, options?.headers])
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/public/public.js
var Public = class extends APIResource {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "runs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Runs$1(this._client)
		});
	}
};
Public.Runs = Runs$1;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/runs/share.js
var Share = class extends APIResource {
	/**
	* Creates or returns a share token for a run. Child runs share their trace root.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const share = await client.runs.share.create(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	* );
	* ```
	*/
	create(runID, body, options) {
		return this._client.post(path$1`/api/v2/runs/${runID}/share`, {
			body,
			...options
		});
	}
	/**
	* Deletes the share token for the trace identified by trace_id and session_id.
	* Idempotent: returns 204 whether or not a share token existed.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* await client.runs.share.delete(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	* );
	* ```
	*/
	delete(traceID, body, options) {
		return this._client.delete(path$1`/api/v2/runs/${traceID}/share`, {
			body,
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/runs/runs.js
var Runs = class extends APIResource {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "share", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Share(this._client)
		});
		Object.defineProperty(this, "retrieve", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: this.retrieveV2
		});
		Object.defineProperty(this, "query", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: this.queryV2
		});
	}
	/**
	* Returns the URL to view a specific run in the LangSmith UI. The caller must
	* supply the run's project_id and trace_id as query parameters; start_time is
	* optional.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const response = await client.runs.getURL(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*   { project_id: 'project_id', trace_id: 'trace_id' },
	* );
	* ```
	*/
	getURL(runID, query, options) {
		return this._client.get(path$1`/api/v2/runs/${runID}/url`, {
			query,
			...options
		});
	}
	/**
	* Returns a paginated list of runs for the given projects within min/max
	* start_time. Supports filters, cursor pagination, and `selects` to select fields
	* to return.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* // Automatically fetches more pages as needed.
	* for await (const run of client.runs.queryV2()) {
	*   // ...
	* }
	* ```
	*/
	queryV2(params, options) {
		const { Accept, ...body } = params;
		return this._client.getAPIList("/api/v2/runs/query", ItemsCursorPostPagination, {
			body,
			method: "post",
			...options,
			headers: buildHeaders([{ ...Accept != null ? { Accept } : void 0 }, options?.headers])
		});
	}
	/**
	* Returns one run by ID for the given session. Use the `selects` query parameter
	* (repeatable) to select fields to return.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const run = await client.runs.retrieveV2(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*   { project_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
	* );
	* ```
	*/
	retrieveV2(runID, params, options) {
		const { Accept, ...query } = params;
		return this._client.get(path$1`/api/v2/runs/${runID}`, {
			query,
			...options,
			headers: buildHeaders([{ ...Accept != null ? { Accept } : void 0 }, options?.headers])
		});
	}
};
Runs.Share = Share;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/sandboxes/boxes.js
var Boxes = class extends APIResource {
	/**
	* Create a new sandbox from a snapshot. Provide at most one of `snapshot_id` or
	* `snapshot_name`; if neither is provided, the server uses the default snapshot.
	* `snapshot_name` accepts a Docker-style `name` or `name:tag` reference (a bare
	* name resolves to `name:latest`).
	*/
	create(body, options) {
		return this._client.post("/api/v2/sandboxes/boxes", {
			body,
			...options
		});
	}
	/**
	* Retrieve a sandbox by name. Stale provisioning sandboxes are auto-failed.
	*/
	retrieve(name, options) {
		return this._client.get(path$1`/api/v2/sandboxes/boxes/${name}`, options);
	}
	/**
	* Update a sandbox's display name, retention, resources, tags, or proxy
	* configuration. The name must be unique within the tenant. Proxy configuration
	* sent to a sandbox that is not running is stored and applied when it next starts.
	*/
	update(name, body, options) {
		return this._client.patch(path$1`/api/v2/sandboxes/boxes/${name}`, {
			body,
			...options
		});
	}
	/**
	* List sandboxes for the authenticated tenant, with optional filtering, sorting,
	* and pagination. Page with page_size and cursor: replay the response's
	* next_cursor until it comes back null, which is the only signal that no pages
	* remain. Cursors are opaque and only valid on this endpoint; do not parse or
	* construct one.
	*/
	list(query = {}, options) {
		return this._client.getAPIList("/api/v2/sandboxes/boxes", ItemsCursorGetPagination, {
			query,
			...options
		});
	}
	/**
	* Delete a sandbox by name or UUID. Tears down the sandbox runtime and removes the
	* DB record.
	*/
	delete(name, options) {
		return this._client.delete(path$1`/api/v2/sandboxes/boxes/${name}`, {
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
	/**
	* Create a snapshot by capturing the current state of a sandbox or promoting an
	* existing checkpoint.
	*/
	createSnapshot(name, body, options) {
		return this._client.post(path$1`/api/v2/sandboxes/boxes/${name}/snapshot`, {
			body,
			...options
		});
	}
	/**
	* Generate a tokenized link that downloads a single file from a sandbox with no
	* further authentication. This mints a token rather than creating an addressable
	* resource, so it returns 200 with no Location header. The token pins the sandbox,
	* the file path, and the response content type and disposition, so a link cannot
	* be repointed at another file. Links never expire unless expires_in_seconds is
	* set. The link is served from the sandbox service domain, not the API host.
	*/
	generateDownloadURL(name, body, options) {
		return this._client.post(path$1`/api/v2/sandboxes/boxes/${name}/download-url`, {
			body,
			...options
		});
	}
	/**
	* Create a short-lived JWT for accessing an HTTP service running on a specific
	* port inside a sandbox. Returns a browser_url (sets auth cookie via redirect), a
	* service_url (for use with the X-Langsmith-Sandbox-Service-Token header), the raw
	* token, and its expiry.
	*/
	generateServiceURL(name, body, options) {
		return this._client.post(path$1`/api/v2/sandboxes/boxes/${name}/service-url`, {
			body,
			...options
		});
	}
	/**
	* Retrieve the lightweight status of a sandbox for polling.
	*/
	getStatus(name, options) {
		return this._client.get(path$1`/api/v2/sandboxes/boxes/${name}/status`, options);
	}
	/**
	* Start a stopped or failed sandbox. This endpoint is not idempotent.
	*/
	start(name, options) {
		return this._client.post(path$1`/api/v2/sandboxes/boxes/${name}/start`, options);
	}
	/**
	* Stop a ready sandbox. This endpoint is not idempotent; the filesystem is
	* preserved for later restart.
	*/
	stop(name, options) {
		return this._client.post(path$1`/api/v2/sandboxes/boxes/${name}/stop`, {
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/sandboxes/registries.js
var Registries = class extends APIResource {
	/**
	* Create a sandbox registry for pulling private images.
	*/
	create(body, options) {
		return this._client.post("/api/v2/sandboxes/registries", {
			body,
			...options
		});
	}
	/**
	* Get a sandbox registry by name.
	*/
	retrieve(name, options) {
		return this._client.get(path$1`/api/v2/sandboxes/registries/${name}`, options);
	}
	/**
	* Update a sandbox registry's name and/or credentials.
	*/
	update(name, body, options) {
		return this._client.patch(path$1`/api/v2/sandboxes/registries/${name}`, {
			body,
			...options
		});
	}
	/**
	* List sandbox registries for pulling private images.
	*/
	list(query = {}, options) {
		return this._client.get("/api/v2/sandboxes/registries", {
			query,
			...options
		});
	}
	/**
	* Delete a sandbox registry by name.
	*/
	delete(name, options) {
		return this._client.delete(path$1`/api/v2/sandboxes/registries/${name}`, {
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/sandboxes/snapshots.js
var Snapshots = class extends APIResource {
	/**
	* Create a snapshot from a Docker image (async build).
	*/
	create(body, options) {
		return this._client.post("/api/v2/sandboxes/snapshots", {
			body,
			...options
		});
	}
	/**
	* Get a sandbox snapshot by ID or by a Docker-style reference. A bare name means
	* name:latest, falling back to the newest ready untagged snapshot of that name. To
	* list the tags under a name, use /api/v2/sandboxes/snapshots-by-name/{name}.
	*/
	retrieve(snapshotID, options) {
		return this._client.get(path$1`/api/v2/sandboxes/snapshots/${snapshotID}`, options);
	}
	/**
	* List sandbox snapshots for the authenticated tenant, with optional filtering,
	* sorting, and pagination. Page with page_size and cursor: replay the response's
	* next_cursor until it comes back null, which is the only signal that no pages
	* remain. Cursors are opaque and only valid on this endpoint; do not parse or
	* construct one.
	*/
	list(query = {}, options) {
		return this._client.getAPIList("/api/v2/sandboxes/snapshots", ItemsCursorGetPagination, {
			query,
			...options
		});
	}
	/**
	* Delete a snapshot by ID or by a Docker-style name[:tag] reference. The
	* underlying storage is reclaimed asynchronously.
	*/
	delete(snapshotID, options) {
		return this._client.delete(path$1`/api/v2/sandboxes/snapshots/${snapshotID}`, {
			...options,
			headers: buildHeaders([{ Accept: "*/*" }, options?.headers])
		});
	}
	/**
	* Get a snapshot name and every tag under it, with the snapshot each tag resolves
	* to. To fetch one snapshot, use /api/v2/sandboxes/snapshots/{snapshot_id}.
	*/
	retrieveByName(name, options) {
		return this._client.get(path$1`/api/v2/sandboxes/snapshots-by-name/${name}`, options);
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/sandboxes/sandboxes.js
var Sandboxes = class extends APIResource {
	constructor() {
		super(...arguments);
		Object.defineProperty(this, "boxes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Boxes(this._client)
		});
		Object.defineProperty(this, "registries", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Registries(this._client)
		});
		Object.defineProperty(this, "snapshots", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Snapshots(this._client)
		});
	}
};
Sandboxes.Boxes = Boxes;
Sandboxes.Registries = Registries;
Sandboxes.Snapshots = Snapshots;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/threads.js
var Threads = class extends APIResource {
	/**
	* Retrieve all traces belonging to a specific thread within a project.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* // Automatically fetches more pages as needed.
	* for await (const threadTrace of client.threads.listTraces(
	*   'thread_id',
	*   { project_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
	* )) {
	*   // ...
	* }
	* ```
	*/
	listTraces(threadID, query, options) {
		return this._client.getAPIList(path$1`/api/v2/threads/${threadID}/traces`, ItemsCursorGetPagination, {
			query,
			...options
		});
	}
	/**
	* Query threads within a project (session), with cursor-based pagination. Returns
	* threads matching the given time range and optional filters.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* // Automatically fetches more pages as needed.
	* for await (const thread of client.threads.query()) {
	*   // ...
	* }
	* ```
	*/
	query(body, options) {
		return this._client.getAPIList("/api/v2/threads/query", ItemsCursorPostPagination, {
			body,
			method: "post",
			...options
		});
	}
	/**
	* Compute aggregate stats for a single thread (turn count, latency percentiles,
	* token/cost sums, and detail breakdowns) within a project.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const threadStats = await client.threads.stats(
	*   'thread_id',
	*   {
	*     selects: ['TURNS'],
	*     session_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*   },
	* );
	* ```
	*/
	stats(threadID, query, options) {
		return this._client.get(path$1`/api/v2/threads/${threadID}/stats`, {
			query,
			...options
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/resources/traces.js
var Traces = class extends APIResource {
	/**
	* Returns runs for a trace ID within min/max start time. Optional `filter`;
	* repeatable `selects` to select fields to return.
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* const response = await client.traces.listRuns(
	*   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
	*   { project_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
	* );
	* ```
	*/
	listRuns(traceID, params, options) {
		const { Accept, ...query } = params;
		return this._client.get(path$1`/api/v2/traces/${traceID}/runs`, {
			query,
			...options,
			headers: buildHeaders([{ ...Accept != null ? { Accept } : void 0 }, options?.headers])
		});
	}
	/**
	* Returns a paginated list of traces (root runs) for a single tracing project.
	* Each item carries the trace's root run plus optional trace-wide aggregates
	* (`total_tokens`, `total_cost`, `first_token_time`) under `trace_aggregates`, so
	* clients never have to merge by `trace_id`.
	*
	* Traces are scanned within a `start_time` window: `min_start_time` defaults to 24
	* hours before the request, `max_start_time` defaults to the request time. Set
	* either explicitly to widen or narrow the window.
	*
	* Supports filters (`trace_filter`, `tree_filter`), cursor pagination (`cursor`),
	* and field projection (`selects`).
	*
	* Self-hosted deployments require LangSmith `v0.16` or later.
	*
	* @example
	* ```ts
	* // Automatically fetches more pages as needed.
	* for await (const trace of client.traces.query()) {
	*   // ...
	* }
	* ```
	*/
	query(body, options) {
		return this._client.getAPIList("/api/v2/traces/query", ItemsCursorPostPagination, {
			body,
			method: "post",
			...options
		});
	}
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/internal/utils/env.js
/**
* Read an environment variable.
*
* Trims beginning and trailing whitespace.
*
* Will return undefined if the environment variable doesn't exist or cannot be accessed.
*/
const readEnv = (env) => {
	if (typeof globalThis.process !== "undefined") return globalThis.process.env?.[env]?.trim() || void 0;
	if (typeof globalThis.Deno !== "undefined") return globalThis.Deno.env?.get?.(env)?.trim() || void 0;
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/_openapi_client/client.js
var __classPrivateFieldSet = function(receiver, state, value, kind, f) {
	if (kind === "m") throw new TypeError("Private method is not writable");
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
	return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
};
var __classPrivateFieldGet = function(receiver, state, kind, f) {
	if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
	if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
	return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _Langsmith_instances;
var _a;
var _Langsmith_encoder;
var _Langsmith_baseURLOverridden;
/**
* API Client for interfacing with the LangChain API.
*/
var Langsmith = class {
	/**
	* API Client for interfacing with the LangChain API.
	*
	* @param {string | null | undefined} [opts.apiKey=process.env['LANGSMITH_API_KEY'] ?? null]
	* @param {string | null | undefined} [opts.tenantID=process.env['LANGSMITH_TENANT_ID'] ?? null]
	* @param {string} [opts.baseURL=process.env['LANGCHAIN_BASE_URL'] ?? https://api.smith.langchain.com/] - Override the default base URL for the API.
	* @param {number} [opts.timeout=1.5 minutes] - The maximum amount of time (in milliseconds) the client will wait for a response before timing out.
	* @param {MergedRequestInit} [opts.fetchOptions] - Additional `RequestInit` options to be passed to `fetch` calls.
	* @param {Fetch} [opts.fetch] - Specify a custom `fetch` function implementation.
	* @param {number} [opts.maxRetries=2] - The maximum number of times the client will retry a request.
	* @param {HeadersLike} opts.defaultHeaders - Default headers to include with every request to the API.
	* @param {Record<string, string | undefined>} opts.defaultQuery - Default query parameters to include with every request to the API.
	*/
	constructor({ baseURL = readEnv("LANGCHAIN_BASE_URL"), apiKey = readEnv("LANGSMITH_API_KEY") ?? null, tenantID = readEnv("LANGSMITH_TENANT_ID") ?? null, ...opts } = {}) {
		_Langsmith_instances.add(this);
		Object.defineProperty(this, "apiKey", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "tenantID", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "baseURL", {
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
		Object.defineProperty(this, "timeout", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "logger", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "logLevel", {
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
		Object.defineProperty(this, "fetch", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		_Langsmith_encoder.set(this, void 0);
		Object.defineProperty(this, "idempotencyHeader", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "datasets", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Datasets(this)
		});
		Object.defineProperty(this, "runs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Runs(this)
		});
		Object.defineProperty(this, "threads", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Threads(this)
		});
		Object.defineProperty(this, "traces", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Traces(this)
		});
		Object.defineProperty(this, "onlineEvaluators", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new OnlineEvaluators(this)
		});
		Object.defineProperty(this, "public", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Public(this)
		});
		Object.defineProperty(this, "annotationQueues", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new AnnotationQueues(this)
		});
		Object.defineProperty(this, "info", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Info(this)
		});
		Object.defineProperty(this, "issues", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Issues(this)
		});
		Object.defineProperty(this, "sandboxes", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new Sandboxes(this)
		});
		const options = {
			apiKey,
			tenantID,
			...opts,
			baseURL: baseURL || `https://api.smith.langchain.com/`
		};
		this.baseURL = options.baseURL;
		this.timeout = options.timeout ?? _a.DEFAULT_TIMEOUT;
		this.logger = options.logger ?? console;
		const defaultLogLevel = "warn";
		this.logLevel = defaultLogLevel;
		this.logLevel = parseLogLevel(options.logLevel, "ClientOptions.logLevel", this) ?? parseLogLevel(readEnv("LANGCHAIN_LOG"), "process.env['LANGCHAIN_LOG']", this) ?? defaultLogLevel;
		this.fetchOptions = options.fetchOptions;
		this.maxRetries = options.maxRetries ?? 2;
		this.fetch = options.fetch ?? getDefaultFetch();
		__classPrivateFieldSet(this, _Langsmith_encoder, FallbackEncoder, "f");
		const customHeadersEnv = readEnv("LANGCHAIN_CUSTOM_HEADERS");
		if (customHeadersEnv) {
			const parsed = {};
			for (const line of customHeadersEnv.split("\n")) {
				const colon = line.indexOf(":");
				if (colon >= 0) parsed[line.substring(0, colon).trim()] = line.substring(colon + 1).trim();
			}
			options.defaultHeaders = {
				...parsed,
				...options.defaultHeaders
			};
		}
		this._options = options;
		this.apiKey = apiKey;
		this.tenantID = tenantID;
	}
	/**
	* Create a new client instance re-using the same options given to the current client with optional overriding.
	*/
	withOptions(options) {
		return new this.constructor({
			...this._options,
			baseURL: this.baseURL,
			maxRetries: this.maxRetries,
			timeout: this.timeout,
			logger: this.logger,
			logLevel: this.logLevel,
			fetch: this.fetch,
			fetchOptions: this.fetchOptions,
			apiKey: this.apiKey,
			tenantID: this.tenantID,
			...options
		});
	}
	defaultQuery() {
		return this._options.defaultQuery;
	}
	validateHeaders({ values, nulls }) {
		if (this.apiKey && values.get("x-api-key")) return;
		if (nulls.has("x-api-key")) return;
		if (this.tenantID && values.get("x-tenant-id")) return;
		if (nulls.has("x-tenant-id")) return;
		throw new Error("Could not resolve authentication method. Expected either apiKey or tenantID to be set. Or for one of the \"X-API-Key\" or \"X-Tenant-Id\" headers to be explicitly omitted");
	}
	async authHeaders(opts) {
		return buildHeaders([await this.apiKeyAuth(opts), await this.tenantIDAuth(opts)]);
	}
	async apiKeyAuth(opts) {
		if (this.apiKey == null) return;
		return buildHeaders([{ "X-API-Key": this.apiKey }]);
	}
	async tenantIDAuth(opts) {
		if (this.tenantID == null) return;
		return buildHeaders([{ "X-Tenant-Id": this.tenantID }]);
	}
	stringifyQuery(query) {
		return stringifyQuery(query);
	}
	getUserAgent() {
		return `${this.constructor.name}/JS ${VERSION}`;
	}
	defaultIdempotencyKey() {
		return `stainless-node-retry-${uuid4()}`;
	}
	makeStatusError(status, error, message, headers) {
		return APIError.generate(status, error, message, headers);
	}
	buildURL(path, query, defaultBaseURL) {
		const baseURL = !__classPrivateFieldGet(this, _Langsmith_instances, "m", _Langsmith_baseURLOverridden).call(this) && defaultBaseURL || this.baseURL;
		const url = isAbsoluteURL(path) ? new URL(path) : new URL(baseURL + (baseURL.endsWith("/") && path.startsWith("/") ? path.slice(1) : path));
		const defaultQuery = this.defaultQuery();
		const pathQuery = Object.fromEntries(url.searchParams);
		if (!isEmptyObj(defaultQuery) || !isEmptyObj(pathQuery)) query = {
			...pathQuery,
			...defaultQuery,
			...query
		};
		if (typeof query === "object" && query && !Array.isArray(query)) url.search = this.stringifyQuery(query);
		return url.toString();
	}
	/**
	* Used as a callback for mutating the given `FinalRequestOptions` object.
	*/
	async prepareOptions(options) {}
	/**
	* Used as a callback for mutating the given `RequestInit` object.
	*
	* This is useful for cases where you want to add certain headers based off of
	* the request properties, e.g. `method` or `url`.
	*/
	async prepareRequest(request, { url, options }) {}
	get(path, opts) {
		return this.methodRequest("get", path, opts);
	}
	post(path, opts) {
		return this.methodRequest("post", path, opts);
	}
	patch(path, opts) {
		return this.methodRequest("patch", path, opts);
	}
	put(path, opts) {
		return this.methodRequest("put", path, opts);
	}
	delete(path, opts) {
		return this.methodRequest("delete", path, opts);
	}
	methodRequest(method, path, opts) {
		return this.request(Promise.resolve(opts).then((opts) => {
			return {
				method,
				path,
				...opts
			};
		}));
	}
	request(options, remainingRetries = null) {
		return new APIPromise(this, this.makeRequest(options, remainingRetries, void 0));
	}
	async makeRequest(optionsInput, retriesRemaining, retryOfRequestLogID) {
		const options = await optionsInput;
		const maxRetries = options.maxRetries ?? this.maxRetries;
		if (retriesRemaining == null) retriesRemaining = maxRetries;
		await this.prepareOptions(options);
		const { req, url, timeout } = await this.buildRequest(options, { retryCount: maxRetries - retriesRemaining });
		await this.prepareRequest(req, {
			url,
			options
		});
		/** Not an API request ID, just for correlating local log entries. */
		const requestLogID = "log_" + (Math.random() * (1 << 24) | 0).toString(16).padStart(6, "0");
		const retryLogStr = retryOfRequestLogID === void 0 ? "" : `, retryOf: ${retryOfRequestLogID}`;
		const startTime = Date.now();
		loggerFor(this).debug(`[${requestLogID}] sending request`, formatRequestDetails({
			retryOfRequestLogID,
			method: options.method,
			url,
			options,
			headers: req.headers
		}));
		if (options.signal?.aborted) throw new APIUserAbortError();
		const controller = new AbortController();
		const response = await this.fetchWithTimeout(url, req, timeout, controller).catch(castToError);
		const headersTime = Date.now();
		if (response instanceof globalThis.Error) {
			const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
			if (options.signal?.aborted) throw new APIUserAbortError();
			const isTimeout = isAbortError(response) || /timed? ?out/i.test(String(response) + ("cause" in response ? String(response.cause) : ""));
			if (retriesRemaining) {
				loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - ${retryMessage}`);
				loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (${retryMessage})`, formatRequestDetails({
					retryOfRequestLogID,
					url,
					durationMs: headersTime - startTime,
					message: response.message
				}));
				return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID);
			}
			loggerFor(this).info(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} - error; no more retries left`);
			loggerFor(this).debug(`[${requestLogID}] connection ${isTimeout ? "timed out" : "failed"} (error; no more retries left)`, formatRequestDetails({
				retryOfRequestLogID,
				url,
				durationMs: headersTime - startTime,
				message: response.message
			}));
			if (isTimeout) throw new APIConnectionTimeoutError();
			throw new APIConnectionError({ cause: response });
		}
		const responseInfo = `[${requestLogID}${retryLogStr}] ${req.method} ${url} ${response.ok ? "succeeded" : "failed"} with status ${response.status} in ${headersTime - startTime}ms`;
		if (!response.ok) {
			const shouldRetry = await this.shouldRetry(response);
			if (retriesRemaining && shouldRetry) {
				const retryMessage = `retrying, ${retriesRemaining} attempts remaining`;
				await CancelReadableStream(response.body);
				loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
				loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
					retryOfRequestLogID,
					url: response.url,
					status: response.status,
					headers: response.headers,
					durationMs: headersTime - startTime
				}));
				return this.retryRequest(options, retriesRemaining, retryOfRequestLogID ?? requestLogID, response.headers);
			}
			const retryMessage = shouldRetry ? `error; no more retries left` : `error; not retryable`;
			loggerFor(this).info(`${responseInfo} - ${retryMessage}`);
			const errText = await response.text().catch((err) => castToError(err).message);
			const errJSON = safeJSON(errText);
			const errMessage = errJSON ? void 0 : errText;
			loggerFor(this).debug(`[${requestLogID}] response error (${retryMessage})`, formatRequestDetails({
				retryOfRequestLogID,
				url: response.url,
				status: response.status,
				headers: response.headers,
				message: errMessage,
				durationMs: Date.now() - startTime
			}));
			throw this.makeStatusError(response.status, errJSON, errMessage, response.headers);
		}
		loggerFor(this).info(responseInfo);
		loggerFor(this).debug(`[${requestLogID}] response start`, formatRequestDetails({
			retryOfRequestLogID,
			url: response.url,
			status: response.status,
			headers: response.headers,
			durationMs: headersTime - startTime
		}));
		return {
			response,
			options,
			controller,
			requestLogID,
			retryOfRequestLogID,
			startTime
		};
	}
	getAPIList(path, Page, opts) {
		return this.requestAPIList(Page, opts && "then" in opts ? opts.then((opts) => ({
			method: "get",
			path,
			...opts
		})) : {
			method: "get",
			path,
			...opts
		});
	}
	requestAPIList(Page, options) {
		const request = this.makeRequest(options, null, void 0);
		return new PagePromise(this, request, Page);
	}
	async fetchWithTimeout(url, init, ms, controller) {
		const { signal, method, ...options } = init || {};
		const abort = this._makeAbort(controller);
		if (signal) signal.addEventListener("abort", abort, { once: true });
		const timeout = setTimeout(abort, ms);
		const isReadableBody = globalThis.ReadableStream && options.body instanceof globalThis.ReadableStream || typeof options.body === "object" && options.body !== null && Symbol.asyncIterator in options.body;
		const fetchOptions = {
			signal: controller.signal,
			...isReadableBody ? { duplex: "half" } : {},
			method: "GET",
			...options
		};
		if (method) fetchOptions.method = method.toUpperCase();
		try {
			return await this.fetch.call(void 0, url, fetchOptions);
		} finally {
			clearTimeout(timeout);
		}
	}
	async shouldRetry(response) {
		const shouldRetryHeader = response.headers.get("x-should-retry");
		if (shouldRetryHeader === "true") return true;
		if (shouldRetryHeader === "false") return false;
		if (response.status === 408) return true;
		if (response.status === 409) return true;
		if (response.status === 429) return true;
		if (response.status >= 500) return true;
		return false;
	}
	async retryRequest(options, retriesRemaining, requestLogID, responseHeaders) {
		let timeoutMillis;
		const retryAfterMillisHeader = responseHeaders?.get("retry-after-ms");
		if (retryAfterMillisHeader) {
			const timeoutMs = parseFloat(retryAfterMillisHeader);
			if (!Number.isNaN(timeoutMs)) timeoutMillis = timeoutMs;
		}
		const retryAfterHeader = responseHeaders?.get("retry-after");
		if (retryAfterHeader && !timeoutMillis) {
			const timeoutSeconds = parseFloat(retryAfterHeader);
			if (!Number.isNaN(timeoutSeconds)) timeoutMillis = timeoutSeconds * 1e3;
			else timeoutMillis = Date.parse(retryAfterHeader) - Date.now();
		}
		if (timeoutMillis === void 0) {
			const maxRetries = options.maxRetries ?? this.maxRetries;
			timeoutMillis = this.calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries);
		}
		await sleep$1(timeoutMillis);
		return this.makeRequest(options, retriesRemaining - 1, requestLogID);
	}
	calculateDefaultRetryTimeoutMillis(retriesRemaining, maxRetries) {
		const initialRetryDelay = .5;
		const maxRetryDelay = 16;
		const numRetries = maxRetries - retriesRemaining;
		return Math.min(initialRetryDelay * Math.pow(2, numRetries), maxRetryDelay) * (1 - Math.random() * .25) * 1e3;
	}
	async buildRequest(inputOptions, { retryCount = 0 } = {}) {
		const options = { ...inputOptions };
		const { method, path, query, defaultBaseURL } = options;
		const url = this.buildURL(path, query, defaultBaseURL);
		if ("timeout" in options) validatePositiveInteger("timeout", options.timeout);
		options.timeout = options.timeout ?? this.timeout;
		const { bodyHeaders, body } = this.buildBody({ options });
		return {
			req: {
				method,
				headers: await this.buildHeaders({
					options: inputOptions,
					method,
					bodyHeaders,
					retryCount
				}),
				...options.signal && { signal: options.signal },
				...globalThis.ReadableStream && body instanceof globalThis.ReadableStream && { duplex: "half" },
				...body && { body },
				...this.fetchOptions ?? {},
				...options.fetchOptions ?? {}
			},
			url,
			timeout: options.timeout
		};
	}
	async buildHeaders({ options, method, bodyHeaders, retryCount }) {
		let idempotencyHeaders = {};
		if (this.idempotencyHeader && method !== "get") {
			if (!options.idempotencyKey) options.idempotencyKey = this.defaultIdempotencyKey();
			idempotencyHeaders[this.idempotencyHeader] = options.idempotencyKey;
		}
		const headers = buildHeaders([
			idempotencyHeaders,
			{
				Accept: "application/json",
				"User-Agent": this.getUserAgent(),
				"X-Stainless-Retry-Count": String(retryCount),
				...options.timeout ? { "X-Stainless-Timeout": String(Math.trunc(options.timeout / 1e3)) } : {},
				...getPlatformHeaders()
			},
			await this.authHeaders(options),
			this._options.defaultHeaders,
			bodyHeaders,
			options.headers
		]);
		this.validateHeaders(headers);
		return headers.values;
	}
	_makeAbort(controller) {
		return () => controller.abort();
	}
	buildBody({ options: { body, headers: rawHeaders } }) {
		if (!body) return {
			bodyHeaders: void 0,
			body: void 0
		};
		const headers = buildHeaders([rawHeaders]);
		if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer || body instanceof DataView || typeof body === "string" && headers.values.has("content-type") || globalThis.Blob && body instanceof globalThis.Blob || body instanceof FormData || body instanceof URLSearchParams || globalThis.ReadableStream && body instanceof globalThis.ReadableStream) return {
			bodyHeaders: void 0,
			body
		};
		else if (typeof body === "object" && (Symbol.asyncIterator in body || Symbol.iterator in body && "next" in body && typeof body.next === "function")) return {
			bodyHeaders: void 0,
			body: ReadableStreamFrom(body)
		};
		else if (typeof body === "object" && headers.values.get("content-type") === "application/x-www-form-urlencoded") return {
			bodyHeaders: { "content-type": "application/x-www-form-urlencoded" },
			body: this.stringifyQuery(body)
		};
		else return __classPrivateFieldGet(this, _Langsmith_encoder, "f").call(this, {
			body,
			headers
		});
	}
};
_a = Langsmith, _Langsmith_encoder = /* @__PURE__ */ new WeakMap(), _Langsmith_instances = /* @__PURE__ */ new WeakSet(), _Langsmith_baseURLOverridden = function _Langsmith_baseURLOverridden() {
	return this.baseURL !== "https://api.smith.langchain.com/";
};
Object.defineProperty(Langsmith, "Langsmith", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: _a
});
Object.defineProperty(Langsmith, "DEFAULT_TIMEOUT", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: 9e4
});
Object.defineProperty(Langsmith, "LangsmithError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: LangsmithError
});
Object.defineProperty(Langsmith, "APIError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: APIError
});
Object.defineProperty(Langsmith, "APIConnectionError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: APIConnectionError
});
Object.defineProperty(Langsmith, "APIConnectionTimeoutError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: APIConnectionTimeoutError
});
Object.defineProperty(Langsmith, "APIUserAbortError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: APIUserAbortError
});
Object.defineProperty(Langsmith, "NotFoundError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: NotFoundError
});
Object.defineProperty(Langsmith, "ConflictError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: ConflictError
});
Object.defineProperty(Langsmith, "RateLimitError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: RateLimitError
});
Object.defineProperty(Langsmith, "BadRequestError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: BadRequestError
});
Object.defineProperty(Langsmith, "AuthenticationError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: AuthenticationError
});
Object.defineProperty(Langsmith, "InternalServerError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: InternalServerError
});
Object.defineProperty(Langsmith, "PermissionDeniedError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: PermissionDeniedError
});
Object.defineProperty(Langsmith, "UnprocessableEntityError", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: UnprocessableEntityError
});
Object.defineProperty(Langsmith, "toFile", {
	enumerable: true,
	configurable: true,
	writable: true,
	value: toFile
});
Langsmith.Datasets = Datasets;
Langsmith.Runs = Runs;
Langsmith.Threads = Threads;
Langsmith.Traces = Traces;
Langsmith.OnlineEvaluators = OnlineEvaluators;
Langsmith.Public = Public;
Langsmith.AnnotationQueues = AnnotationQueues;
Langsmith.Info = Info;
Langsmith.Issues = Issues;
Langsmith.Sandboxes = Sandboxes;
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/warn.js
const warnedMessages = {};
function warnOnce$1(message, options) {
	const key = options?.code ?? message;
	if (!warnedMessages[key]) {
		warnedMessages[key] = true;
		if (options?.type && typeof process !== "undefined" && typeof process.emitWarning === "function") process.emitWarning(message, {
			type: options.type,
			code: options.code
		});
		else if (options?.type && options?.code) console.warn(`${options.type} [${options.code}]: ${message}`);
		else console.warn(message);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/xxhash/xxhash.js
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
	result64 += XXH3_mix2Accs(acc.slice(0), getView(key, 0));
	result64 += XXH3_mix2Accs(acc.slice(2), getView(key, 16));
	result64 += XXH3_mix2Accs(acc.slice(4), getView(key, 32));
	result64 += XXH3_mix2Accs(acc.slice(6), getView(key, 48));
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
	const result = /* @__PURE__ */ new Uint8Array(16);
	const view = new DataView(result.buffer);
	const low64 = hash128 & mask64;
	const high64 = hash128 >> n(64);
	view.setBigUint64(0, high64, false);
	view.setBigUint64(8, low64, false);
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/_uuid.js
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
	const bytes = /* @__PURE__ */ new Uint8Array(16);
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
* A pure function of `originalId` and `key`: it reads no ambient state, so the
* same pair always yields the same UUID, in any process, at any time. This is
* used for creating replica ids that are reproducible across distributed
* systems, including across SDK implementations.
*
* A UUID v7 original keeps its timestamp, so derived ids stay ordered by run
* start time. Any other original has none to keep, and the field is
* hash-derived: stable, but not chronological.
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
	const b = /* @__PURE__ */ new Uint8Array(16);
	if (getUuidVersion(originalId) === 7) {
		const originalBytes = uuidToBytes(originalId);
		b.set(originalBytes.slice(0, 6), 0);
	} else b.set(h.slice(10, 16), 0);
	b[6] = 112 | h[0] & 15;
	b[7] = h[1];
	b[8] = 128 | h[2] & 63;
	b.set(h.slice(3, 10), 9);
	return bytesToUuid(b);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/sampling.js
/**
* Deterministic trace sampling, kept consistent across LangSmith SDKs.
*/
const SAMPLING_HASH_MODULUS = 1000000n;
const encoder$1 = new TextEncoder();
/**
* Decide whether `identifier` is sampled in at `samplingRate`.
*
* The decision is a pure function of the identifier, so every process and
* every SDK agrees on it, and a run's create and patch never disagree.
*/
const isSampledById = (identifier, samplingRate) => {
	if (samplingRate === void 0 || samplingRate >= 1) return true;
	if (samplingRate <= 0) return false;
	if (identifier == null) return true;
	const bucket = XXH3_128(encoder$1.encode(identifier.toLowerCase())) % SAMPLING_HASH_MODULUS;
	return Number(bucket) / Number(SAMPLING_HASH_MODULUS) < samplingRate;
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/address.js
/**
* (beta) Addresses that name where runs are sent instead of a project.
* Enabled per workspace; a workspace without it rejects the runs.
*
* An address is a plain string, `lrn:agents/{id}/environments/{environment}`,
* typed as a template literal so a literal is checked at compile time. A
* dynamic `string` goes through `address.parse`, which validates it at
* runtime (JS callers are validated the same way). The environment is always
* rendered lowercase.
*
* @example
* ```ts
* import { address, traceable } from "langsmith";
*
* const support = address.agent("customer-support", "production");
* const handle = traceable(fn, { address: support });
* // or a literal: { address: "lrn:agents/customer-support/environments/staging" }
* ```
*/
const AGENT_ID_PATTERN = /^[a-z]([a-z0-9-]{0,61}[a-z0-9])?$/;
const ENVIRONMENTS = [
	"local",
	"development",
	"staging",
	"production"
];
const ADDRESS_PATTERN = /^lrn:agents\/([^/]*)\/environments\/([^/]*)$/;
const ENV_NAMES = ["LANGSMITH_AGENT_ID", "LANGSMITH_AGENT_ENVIRONMENT"];
/** The `LANGSMITH_AGENT_*` / project env vars name half an address, or both. */
var EnvAddressError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "EnvAddressError";
	}
};
/**
* (beta) Build the address of an agent's environment.
* @param agentId 1 to 63 lowercase ASCII letters, digits or hyphens, starting
*   with a letter and ending with a letter or digit.
* @param agentEnvironment One of `local`, `development`, `staging` or
*   `production`, in any case.
* @throws If a value is invalid.
*/
function agent(agentId, agentEnvironment) {
	if (typeof agentId !== "string" || !AGENT_ID_PATTERN.test(agentId)) throw new Error(`Address agent id must be 1 to 63 lowercase ASCII letters, digits, or hyphens, start with a letter, and end with a letter or digit, got ${JSON.stringify(agentId)}. Use an id such as "support-agent".`);
	const environment = typeof agentEnvironment === "string" ? agentEnvironment.toLowerCase() : void 0;
	if (environment === void 0 || !ENVIRONMENTS.includes(environment)) throw new Error(`Address environment must be one of ${ENVIRONMENTS.join(", ")}, got ${JSON.stringify(agentEnvironment)}.`);
	return `lrn:agents/${agentId}/environments/${environment}`;
}
/**
* (beta) Validate an address string, lowercasing its environment.
* Only agent addresses, `lrn:agents/{id}/environments/{environment}`, exist.
* @throws If `value` is not a valid agent address.
*/
function parse$1(value) {
	const match = typeof value === "string" ? ADDRESS_PATTERN.exec(value) : void 0;
	if (!match) throw new Error(`An address must be a string like "lrn:agents/{id}/environments/{environment}", got ${JSON.stringify(value)}.`);
	return agent(match[1], match[2]);
}
/**
* (beta) Read the address named by `LANGSMITH_AGENT_ID` and
* `LANGSMITH_AGENT_ENVIRONMENT`; `undefined` if neither is set.
* @throws {EnvAddressError} If only one is set, or a value is invalid.
*/
function fromEnv() {
	const values = ENV_NAMES.map((name) => getEnvironmentVariable(name));
	if (!values.some(Boolean)) return;
	try {
		const missing = ENV_NAMES.filter((_, i) => !values[i]);
		if (missing.length > 0) throw new Error(`An address needs ${missing.join(" and ")} as well.`);
		return agent(values[0], values[1]);
	} catch (e) {
		throw new EnvAddressError(`The LANGSMITH_AGENT_* env vars can't address a run (${ENV_NAMES.flatMap((name, i) => values[i] ? [`${name}=${JSON.stringify(values[i])}`] : []).join(", ")}): ${e.message}`);
	}
}
/** @internal The `LANGSMITH_AGENT_*` env var names an address reads. */
function envNames() {
	return ENV_NAMES;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/agent_addressing.js
/** Validate and normalise an address at an entry point; the SDK carries the result. */
function checkAddress(address) {
	return address == null ? void 0 : parse$1(address);
}
function rejectConflicting(project, address) {
	if (project && address) throw new Error(`A run is sent to a project (${JSON.stringify(project)}) or to an address (${JSON.stringify(address)}), not both.`);
}
function getEnvProject() {
	return getLangSmithEnvironmentVariable("PROJECT") || getEnvironmentVariable("LANGCHAIN_SESSION") || void 0;
}
/**
* The env's destination: its address, else its project, else "default".
* @throws {EnvAddressError} For half an address, or an address and a project.
*/
function resolveFromEnv() {
	const project = getEnvProject();
	const address = fromEnv();
	if (project && address) throw new EnvAddressError("LANGSMITH_AGENT_* and a project are both set in the environment.");
	return address ? [void 0, address] : [project ?? "default", void 0];
}
function logUntraced(error) {
	warnOnce$1(`LangSmith is not tracing this call: ${error.message}`);
}
/** Warn once, at client construction, if the env can't address runs. */
function warnOnEnv() {
	if (!envNames().some((name) => getEnvironmentVariable(name))) return;
	try {
		resolveFromEnv();
	} catch (e) {
		warnOnce$1(`${e.message} Runs that name no destination in code are not traced.`);
	}
}
/**
* Put the run's address in its payload field, as one lowercase string.
* Without one, a create naming no project takes the env address.
*
* @throws {EnvAddressError} If the env names half an address.
*/
function applyToPayload(run, { update = false } = {}) {
	const payload = run;
	let address = checkAddress(payload.address);
	delete payload.address;
	const namedProject = payload.session_id != null || payload.session_name != null;
	if (!address && !update && !namedProject) address = fromEnv();
	if (!address) return;
	warnOnce$1("Sending runs to an `address` is in beta and enabled per workspace; a workspace without it rejects the runs.");
	payload.address = address;
	if (!namedProject) {
		delete payload.session_name;
		delete payload.session_id;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/v2_migration.js
const QueryBackend = {
	CLICKHOUSE_ONLY: "clickhouse_only",
	SMITHDB_ONLY: "smithdb_only",
	DUAL: "dual"
};
/** Which backend(s) `/info`'s `instance_flags` indicate for run/trace queries. */
function getQueryBackend(instanceFlags) {
	const flags = instanceFlags ?? {};
	const chEnabled = Boolean(flags.ch_query_enabled ?? true);
	const sdbEnabled = Boolean(flags.sdb_query_enabled ?? false);
	if (!chEnabled && sdbEnabled) return QueryBackend.SMITHDB_ONLY;
	if (chEnabled && sdbEnabled) return QueryBackend.DUAL;
	return QueryBackend.CLICKHOUSE_ONLY;
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/error.js
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
	try {
		errorBody = await response.text();
	} catch (_e) {
		errorBody = "";
	}
	if (response.status === 403) {
		let errorData;
		try {
			errorData = JSON.parse(errorBody);
		} catch {}
		if (errorData?.error === "org_scoped_key_requires_workspace") errorBody = "This API key is org-scoped and requires workspace specification. Please provide 'workspaceId' parameter, or set LANGSMITH_WORKSPACE_ID environment variable.";
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/prompts.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/fs.js
/**
* File system abstraction (Node.js version).
*
* This file is swapped with fs.browser.ts for browser builds
* via the package.json browser field.
*/
const path = nodePath;
async function mkdir$1(dir) {
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
async function readdir$1(dir) {
	return nodeFsPromises.readdir(dir);
}
async function stat$1(filePath) {
	return nodeFsPromises.stat(filePath);
}
function existsSync$1(p) {
	return nodeFs.existsSync(p);
}
function mkdirSync$1(dir) {
	nodeFs.mkdirSync(dir, { recursive: true });
}
function writeFileSync$1(filePath, content) {
	nodeFs.writeFileSync(filePath, content);
}
function renameSync$1(oldPath, newPath) {
	nodeFs.renameSync(oldPath, newPath);
}
function unlinkSync(filePath) {
	nodeFs.unlinkSync(filePath);
}
function readFileSync$1(filePath) {
	return nodeFs.readFileSync(filePath, "utf-8");
}
async function mkdirExclusive(dir) {
	await nodeFsPromises.mkdir(dir, { mode: 448 });
}
function statMtimeMs(filePath) {
	try {
		return nodeFs.statSync(filePath).mtimeMs;
	} catch {
		return;
	}
}
async function rmRecursive(filePath) {
	await nodeFsPromises.rm(filePath, {
		recursive: true,
		force: true
	});
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/prompt_cache/index.js
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
		if (!existsSync$1(dir)) mkdirSync$1(dir);
		const tempPath = `${filePath}.tmp`;
		try {
			writeFileSync$1(tempPath, JSON.stringify({ entries }, null, 2));
			renameSync$1(tempPath, filePath);
		} catch (e) {
			if (existsSync$1(tempPath)) unlinkSync(tempPath);
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
		if (!existsSync$1(filePath)) return 0;
		let entries;
		try {
			const content = readFileSync$1(filePath);
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/singletons/fetch.js
const DEFAULT_FETCH_IMPLEMENTATION = (...args) => fetch(...args);
const LANGSMITH_FETCH_IMPLEMENTATION_KEY = Symbol.for("ls:fetch_implementation");
const _shouldStreamForGlobalFetchImplementation = () => {
	if (globalThis[LANGSMITH_FETCH_IMPLEMENTATION_KEY] === void 0) return true;
	return false;
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/profile-lock.js
const LOCK_POLL_INTERVAL_MS = 10;
const LOCK_STALE_AFTER_MS = 1e4;
const LOCK_METADATA_FILE = "created_at";
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
function isEEXIST(err) {
	return typeof err === "object" && err !== null && err.code === "EEXIST";
}
function lockMetadataLines(lockDir) {
	try {
		return readFileSync$1(path.join(lockDir, LOCK_METADATA_FILE)).split("\n");
	} catch {
		return;
	}
}
function lockCreatedAtMs(lockDir) {
	const lines = lockMetadataLines(lockDir);
	if (lines && lines[0] && lines[0].trim()) {
		const parsed = Date.parse(lines[0].trim());
		if (!Number.isNaN(parsed)) return parsed;
	}
	return statMtimeMs(lockDir);
}
function lockOwner(lockDir) {
	const lines = lockMetadataLines(lockDir);
	if (lines && lines.length >= 2 && lines[1].trim()) return lines[1].trim();
}
async function removeStaleLock(lockDir) {
	const createdAt = lockCreatedAtMs(lockDir);
	if (createdAt === void 0 || Date.now() - createdAt <= LOCK_STALE_AFTER_MS) return false;
	await rmRecursive(lockDir);
	return true;
}
/**
* Acquire an exclusive cross-process lock for refreshing OAuth tokens.
*
* Uses an atomic-`mkdir` directory lock at `<configPath>.oauth.lock.lock` with a
* stale-break heuristic and owner-checked release, mirroring langsmith-go's
* non-POSIX path. `deadline` is a `Date.now()`-based timestamp; acquisition
* rejects once it passes. Callers treat any rejection as "skip refresh, use the
* current token".
*/
async function acquireOAuthRefreshLock(configPath, deadline) {
	const lockDir = `${configPath}.oauth.lock.lock`;
	const parent = path.dirname(lockDir);
	if (parent) await mkdir$1(parent);
	const owner = globalThis.crypto.randomUUID();
	for (;;) {
		try {
			await mkdirExclusive(lockDir);
		} catch (err) {
			if (!isEEXIST(err)) throw err;
			if (!await removeStaleLock(lockDir)) {
				if (Date.now() >= deadline) throw new Error("timed out acquiring OAuth refresh lock");
				await sleep(Math.min(LOCK_POLL_INTERVAL_MS, Math.max(0, deadline - Date.now())));
			}
			continue;
		}
		try {
			await writeFileAtomic(path.join(lockDir, LOCK_METADATA_FILE), `${(/* @__PURE__ */ new Date()).toISOString()}\n${owner}\n`);
		} catch (err) {
			await rmRecursive(lockDir);
			throw err;
		}
		break;
	}
	return { async release() {
		if (lockOwner(lockDir) === owner) await rmRecursive(lockDir);
	} };
}
const OAUTH_CLIENT_ID = "langsmith-cli";
const TOKEN_REFRESH_LEEWAY_MS = 6e4;
const TOKEN_REFRESH_TIMEOUT_MS = 1e4;
const OAUTH_DISCOVERY_TIMEOUT_MS = 5e3;
const WELL_KNOWN_OAUTH_PATH = "/.well-known/oauth-authorization-server";
function isBrowserLikeRuntime() {
	const env = getEnv();
	return env === "browser" || env === "webworker";
}
function getProfileConfigPath() {
	const explicitPath = getEnvironmentVariable("LANGSMITH_CONFIG_FILE");
	if (explicitPath) return explicitPath;
	const home = getEnvironmentVariable("HOME") ?? getEnvironmentVariable("USERPROFILE");
	if (!home) return;
	return path.join(home, ".langsmith", "config.json");
}
function resolveProfileName(config) {
	const envProfile = getEnvironmentVariable("LANGSMITH_PROFILE");
	if (envProfile) return envProfile;
	if (config.current_profile) return config.current_profile;
	if (config.profiles?.default) return "default";
}
function loadProfileState() {
	if (isBrowserLikeRuntime()) return;
	const configPath = getProfileConfigPath();
	if (!configPath || !existsSync$1(configPath)) return;
	try {
		const config = JSON.parse(readFileSync$1(configPath));
		const profileName = resolveProfileName(config);
		const profile = profileName ? config.profiles?.[profileName] : void 0;
		if (!profileName || !profile) return;
		return {
			configPath,
			config,
			profileName,
			profile
		};
	} catch {
		return;
	}
}
function hasValue(value) {
	return value !== void 0 && value !== null && value.trim() !== "";
}
function trimConfigValue(value) {
	return value?.trim().replace(/^["']|["']$/g, "");
}
function shouldRefreshProfileToken(profile) {
	const oauth = profile.oauth;
	if (!oauth?.refresh_token) return false;
	if (!oauth.access_token) return true;
	if (!oauth.expires_at) return false;
	const expiresAt = Date.parse(oauth.expires_at);
	if (Number.isNaN(expiresAt)) return false;
	return expiresAt <= Date.now() + TOKEN_REFRESH_LEEWAY_MS;
}
function normalizeConfigUrl(apiUrl) {
	let normalized = apiUrl;
	while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
	return normalized.endsWith("/api/v1") ? normalized.slice(0, -7) : normalized;
}
/**
* Metadata base URLs to probe, most specific first: the configured mount point,
* then the self-hosted and SaaS locations, so both a bare origin and an
* explicit `/api` resolve.
*/
function oauthDiscoveryCandidates(apiUrl) {
	const given = normalizeConfigUrl(apiUrl);
	const origin = given.endsWith("/api") ? given.slice(0, -4) : given;
	const candidates = [];
	for (const candidate of [
		given,
		`${origin}/api`,
		origin
	]) if (candidate && candidate !== "/api" && !candidates.includes(candidate)) candidates.push(candidate);
	return candidates;
}
/**
* Check the document describes the deployment we probed. RFC 8414 requires the
* issuer to match the URL the well-known path was built from, and every
* endpoint must share the issuer's origin. Refresh tokens are posted to these
* endpoints, so an unvalidated document could redirect credentials elsewhere.
*/
function isTrustedOAuthMetadata(doc, base) {
	const { issuer } = doc;
	if (typeof issuer !== "string" || issuer.replace(/\/+$/, "") !== base.replace(/\/+$/, "")) return false;
	let issuerUrl;
	try {
		issuerUrl = new URL(issuer);
	} catch {
		return false;
	}
	for (const endpoint of [doc.device_authorization_endpoint, doc.token_endpoint]) {
		if (typeof endpoint !== "string" || !endpoint) return false;
		try {
			const url = new URL(endpoint);
			if (url.protocol !== issuerUrl.protocol || url.host !== issuerUrl.host) return false;
		} catch {
			return false;
		}
	}
	return true;
}
/**
* Metadata URLs for an issuer, RFC 8414 form first. RFC 8414 inserts the
* well-known segment between the origin and the issuer path, so
* `https://host/api` is described at
* `https://host/.well-known/oauth-authorization-server/api`. Deployments
* commonly also serve the appended form, and for a path-less issuer the two are
* identical.
*/
function oauthMetadataUrls(base) {
	const appended = `${base}${WELL_KNOWN_OAUTH_PATH}`;
	let inserted;
	try {
		const url = new URL(base);
		inserted = `${url.origin}${WELL_KNOWN_OAUTH_PATH}${url.pathname === "/" ? "" : url.pathname}`;
	} catch {
		return [appended];
	}
	return inserted === appended ? [inserted] : [inserted, appended];
}
async function fetchOAuthMetadata(url, base, fetchImplementation) {
	let response;
	try {
		response = await fetchImplementation(url, {
			method: "GET",
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(OAUTH_DISCOVERY_TIMEOUT_MS)
		});
	} catch {
		return;
	}
	if (!response.ok) return;
	let doc;
	try {
		doc = await response.json();
	} catch {
		return;
	}
	if (!doc || typeof doc !== "object" || !isTrustedOAuthMetadata(doc, base)) return;
	return doc;
}
/**
* Resolve the token endpoint, preferring the deployment's metadata document.
* Falls back to `<mount>/oauth/token`, keeping a trailing `/api` because
* self-hosted mounts the authorization server under it.
*/
async function resolveTokenEndpoint(apiUrl, fetchImplementation) {
	for (const base of oauthDiscoveryCandidates(apiUrl)) for (const url of oauthMetadataUrls(base)) {
		const doc = await fetchOAuthMetadata(url, base, fetchImplementation);
		if (doc) return doc.token_endpoint;
	}
	return `${normalizeConfigUrl(apiUrl)}/oauth/token`;
}
function applyTokenResponse(profile, token) {
	profile.oauth ??= {};
	if (token.access_token) profile.oauth.access_token = token.access_token;
	if (token.refresh_token) profile.oauth.refresh_token = token.refresh_token;
	if (typeof token.expires_in === "number" && token.expires_in > 0) profile.oauth.expires_at = new Date(Date.now() + token.expires_in * 1e3).toISOString();
}
function getAbortReason(signal) {
	return signal.reason ?? /* @__PURE__ */ new Error("The operation was aborted.");
}
async function waitForAbortSignal(promise, signal) {
	if (!signal) return promise;
	if (signal.aborted) throw getAbortReason(signal);
	let cleanup;
	const abortPromise = new Promise((_, reject) => {
		const onAbort = () => {
			reject(getAbortReason(signal));
		};
		signal.addEventListener("abort", onAbort, { once: true });
		cleanup = () => {
			signal.removeEventListener("abort", onAbort);
		};
	});
	try {
		return await Promise.race([promise, abortPromise]);
	} finally {
		cleanup?.();
	}
}
function loadProfileClientConfig() {
	const state = loadProfileState();
	const profile = state?.profile;
	if (!state || !profile) return {};
	const apiKey = trimConfigValue(profile.api_key);
	const oauthAccessToken = trimConfigValue(profile.oauth?.access_token);
	const oauthRefreshToken = trimConfigValue(profile.oauth?.refresh_token);
	return {
		apiUrl: profile.api_url,
		apiKey,
		workspaceId: profile.workspace_id,
		oauthAccessToken,
		oauthRefreshToken,
		profileAuth: apiKey || oauthAccessToken || oauthRefreshToken ? new ProfileAuth(state) : void 0
	};
}
var ProfileAuth = class {
	constructor(state) {
		Object.defineProperty(this, "state", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: state
		});
		Object.defineProperty(this, "refreshPromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "managedAuthorizationValue", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.rememberProfileAuthHeader(this.currentAuthHeader());
	}
	currentAuthHeader() {
		const header = currentAuthHeaderFromProfile(this.state.profile);
		this.rememberProfileAuthHeader(header);
		return header;
	}
	async getAuthHeader(fetchImplementation, signal) {
		if (shouldRefreshProfileToken(this.state.profile)) {
			if (!this.refreshPromise) this.refreshPromise = this.refreshOAuthToken(fetchImplementation).finally(() => {
				this.refreshPromise = void 0;
			});
			await waitForAbortSignal(this.refreshPromise, signal);
		}
		const header = authHeaderFromProfile(this.state.profile);
		this.rememberProfileAuthHeader(header);
		return header;
	}
	isProfileAuthorizationHeader(value) {
		return value === this.managedAuthorizationValue;
	}
	reloadProfile() {
		try {
			const config = JSON.parse(readFileSync$1(this.state.configPath));
			const profile = config.profiles?.[this.state.profileName];
			if (!profile) return;
			this.state.config = config;
			this.state.profile = profile;
			return profile;
		} catch {
			return;
		}
	}
	async refreshOAuthToken(fetchImplementation) {
		const refreshToken = this.state.profile.oauth?.refresh_token;
		if (!refreshToken) return;
		const refreshApiUrl = trimConfigValue(this.state.profile.api_url) ?? "https://api.smith.langchain.com";
		const deadline = Date.now() + TOKEN_REFRESH_TIMEOUT_MS;
		let lock;
		try {
			lock = await acquireOAuthRefreshLock(this.state.configPath, deadline);
			if (this.reloadProfile() && !shouldRefreshProfileToken(this.state.profile)) return;
			const body = new URLSearchParams({
				grant_type: "refresh_token",
				client_id: OAUTH_CLIENT_ID,
				refresh_token: this.state.profile.oauth?.refresh_token ?? refreshToken
			});
			const response = await fetchImplementation(await resolveTokenEndpoint(refreshApiUrl, fetchImplementation), {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: body.toString(),
				signal: AbortSignal.timeout(Math.max(0, deadline - Date.now()))
			});
			if (!response.ok) return;
			const token = await response.json();
			if (!token.access_token) return;
			applyTokenResponse(this.state.profile, token);
			this.state.config.profiles ??= {};
			this.state.config.profiles[this.state.profileName] = this.state.profile;
			await writeFileAtomic(this.state.configPath, `${JSON.stringify(this.state.config, null, 2)}\n`);
		} catch {
			return;
		} finally {
			await lock?.release();
		}
	}
	rememberProfileAuthHeader(header) {
		this.managedAuthorizationValue = header?.name === "Authorization" ? header.value : void 0;
	}
};
function currentAuthHeaderFromProfile(profile) {
	const oauthAccessToken = trimConfigValue(profile.oauth?.access_token);
	if (oauthAccessToken) return {
		name: "Authorization",
		value: `Bearer ${oauthAccessToken}`
	};
	if (trimConfigValue(profile.oauth?.refresh_token)) return;
	return authHeaderFromProfile(profile);
}
function authHeaderFromProfile(profile) {
	const oauthAccessToken = trimConfigValue(profile.oauth?.access_token);
	if (oauthAccessToken) return {
		name: "Authorization",
		value: `Bearer ${oauthAccessToken}`
	};
	const apiKey = trimConfigValue(profile.api_key);
	if (apiKey) return {
		name: "x-api-key",
		value: apiKey
	};
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/fast-safe-stringify/index.js
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
	if (propertyDescriptor.get !== void 0) {
		if (propertyDescriptor.configurable) {
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
	} else {
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/worker_threads.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/serialize_worker.js
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
const LARGE_STRING_THRESHOLD = 65536;
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/client.js
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
/** Index creates by id (last wins); warns when one id goes to two projects. */
function indexRunCreatesById(creates) {
	const byId = {};
	for (const run of creates) {
		if (!run.id) continue;
		const previous = byId[run.id];
		if (previous !== void 0 && previous.session_name !== run.session_name) console.warn(`LangSmith run ${run.id} was queued for two projects with the same id (${JSON.stringify(previous.session_name)} and ${JSON.stringify(run.session_name)}); only one of the projects will keep the run. This usually means two write replicas both keep the original run ids, for example a replica marked \`primary\` plus one for the run's own project.`);
		byId[run.id] = run;
	}
	return byId;
}
function mergeRuntimeEnvIntoRun(run, cachedEnvVars, omitTracedRuntimeInfo, tracingSampleRate) {
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
			...metadata,
			...tracingSampleRate !== void 0 ? { ls_tracing_sample_rate: tracingSampleRate } : {}
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
function _checkBackendVersion(backendVersion, minVersion) {
	if (!backendVersion) return;
	const parse = (v) => v.split(".").map((s) => parseInt(s, 10));
	const [maj, min, pat] = parse(backendVersion);
	const [rMaj, rMin, rPat] = parse(minVersion);
	if (isNaN(maj) || isNaN(min) || isNaN(pat) || isNaN(rMaj) || isNaN(rMin) || isNaN(rPat)) {
		console.warn(`[LANGSMITH]: Could not parse backend version ${JSON.stringify(backendVersion)} for compatibility check.`);
		return;
	}
	if (maj < rMaj || maj === rMaj && min < rMin || maj === rMaj && min === rMin && pat < rPat) console.warn(`[LANGSMITH]: Backend version ${JSON.stringify(backendVersion)} is older than the minimum version required by this SDK (${JSON.stringify(minVersion)}). Some features may not work as expected. See https://docs.langchain.com/langsmith/smithdb-sdk-migration`);
}
const SERVER_INFO_REQUEST_TIMEOUT_MS = 1e4;
/** Maximum number of operations to batch in a single request. */
const DEFAULT_BATCH_SIZE_LIMIT = 100;
/**
* Reject header names or values that could alter a request's framing.
*
* `Headers` does this for us, and does it the same way `fetch` will.
*/
function assertValidHeader(name, value) {
	new Headers({ [name]: value });
}
/** Reject a malformed header up front, before it can reach a request. */
function assertValidHeaders(headers) {
	for (const [name, value] of Object.entries(headers ?? {})) assertValidHeader(name, value);
}
/**
* Fold a `HeadersInit` into a plain object so it can be spread.
*
* Names are matched case-insensitively with the last value winning, keeping the
* first spelling seen. A plain object would instead keep both spellings, which
* `Headers` later joins into a `"first, second"` list rather than an override.
* Every name and value is validated on the way through.
*/
function normalizeHeaders(headers) {
	if (!headers) return {};
	const entries = headers instanceof Headers ? [...headers.entries()] : Array.isArray(headers) ? headers.map(([name, value]) => [name, value]) : Object.entries(headers);
	const normalized = {};
	const nameByLower = /* @__PURE__ */ new Map();
	for (const [name, value] of entries) {
		assertValidHeader(name, value);
		const lowerName = name.toLowerCase();
		const existingName = nameByLower.get(lowerName);
		if (existingName === void 0) {
			nameByLower.set(lowerName, name);
			normalized[name] = value;
		} else normalized[existingName] = value;
	}
	return normalized;
}
/**
* Merge the caller's two header channels, then drop the `reserved` names.
*
* `overrides` wins, matched case-insensitively so a header supplied through both
* channels is overridden rather than turned into a `"first, second"` list.
*/
function mergeCallerHeaders(base, overrides, reserved) {
	const merged = { ...base };
	const nameByLower = new Map(Object.keys(merged).map((name) => [name.toLowerCase(), name]));
	for (const [name, value] of Object.entries(overrides)) {
		const lowerName = name.toLowerCase();
		merged[nameByLower.get(lowerName) ?? name] = value;
	}
	for (const name of Object.keys(merged)) if (reserved.has(name.toLowerCase())) delete merged[name];
	return merged;
}
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
			workspaceId: item.workspaceId,
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
			workspaceId: it.workspaceId,
			size: it.size
		})), () => popped.forEach((it) => it.itemPromiseResolve())];
	}
};
var Client = class Client {
	get tracingMode() {
		return this._tracingMode;
	}
	get _fetch() {
		const fetchImplementation = this.fetchImplementation || _getFetchImplementation(this.debug);
		return (async (input, init) => {
			let authHeader;
			const profileManagedAuthorization = this.getProfileManagedAuthorizationHeader(init);
			if (this.apiKey !== void 0) authHeader = {
				name: "x-api-key",
				value: `${this.apiKey}`
			};
			else if (!this.hasExplicitAuthHeader(init, profileManagedAuthorization)) authHeader = await this.profileAuth?.getAuthHeader(fetchImplementation, init?.signal);
			return fetchImplementation(input, this.applyCurrentAuthHeaders(init, authHeader, profileManagedAuthorization));
		});
	}
	getProfileManagedAuthorizationHeader(init) {
		if (!init?.headers || !this.profileAuth) return;
		const authorization = new Headers(init.headers).get("Authorization");
		if (!hasValue(authorization)) return;
		return this.profileAuth.isProfileAuthorizationHeader(authorization ?? "") ? authorization ?? void 0 : void 0;
	}
	isProfileManagedAuthorizationHeader(value, profileManagedAuthorization) {
		return value === profileManagedAuthorization || this.profileAuth?.isProfileAuthorizationHeader(value) === true;
	}
	hasExplicitAuthHeader(init, profileManagedAuthorization) {
		if (!init?.headers) return false;
		const headers = new Headers(init.headers);
		if (hasValue(headers.get("x-api-key"))) return true;
		const authorization = headers.get("Authorization");
		if (!hasValue(authorization)) return false;
		return !this.isProfileManagedAuthorizationHeader(authorization ?? "", profileManagedAuthorization);
	}
	applyCurrentAuthHeaders(init, authHeader, profileManagedAuthorization) {
		if (!authHeader) return init;
		const applyAuth = (headers) => {
			if (this.apiKey !== void 0 && authHeader.name === "x-api-key") {
				headers.delete("Authorization");
				if (!headers.has("x-api-key")) headers.set("x-api-key", authHeader.value);
				return headers;
			}
			if (authHeader.name === "Authorization") {
				if (hasValue(headers.get("x-api-key"))) return headers;
				const authorization = headers.get("Authorization");
				if (hasValue(authorization) && !this.isProfileManagedAuthorizationHeader(authorization ?? "", profileManagedAuthorization)) return headers;
				headers.set("Authorization", authHeader.value);
				return headers;
			}
			const authorization = headers.get("Authorization");
			if (hasValue(authorization) && !this.isProfileManagedAuthorizationHeader(authorization ?? "", profileManagedAuthorization)) return headers;
			if (hasValue(authorization)) headers.delete("Authorization");
			if (!headers.has("x-api-key")) headers.set("x-api-key", authHeader.value);
			return headers;
		};
		if (!init) return { headers: { [authHeader.name]: authHeader.value } };
		if (init.headers instanceof Headers) return {
			...init,
			headers: applyAuth(new Headers(init.headers))
		};
		if (Array.isArray(init.headers)) return {
			...init,
			headers: applyAuth(new Headers(init.headers))
		};
		const headers = { ...init.headers ?? {} };
		const getHeaderKey = (name) => Object.keys(headers).find((key) => key.toLowerCase() === name);
		const getHeader = (name) => {
			const key = getHeaderKey(name);
			return key ? headers[key] : void 0;
		};
		const hasApiKey = hasValue(getHeader("x-api-key"));
		const authorization = getHeader("authorization");
		const hasExplicitAuthorization = hasValue(authorization) && !this.isProfileManagedAuthorizationHeader(authorization ?? "", profileManagedAuthorization);
		if (this.apiKey !== void 0 && authHeader.name === "x-api-key") {
			const authorizationKey = getHeaderKey("authorization");
			if (authorizationKey) delete headers[authorizationKey];
			if (!hasApiKey) headers["x-api-key"] = authHeader.value;
			return {
				...init,
				headers
			};
		}
		if (authHeader.name === "Authorization") {
			if (!hasApiKey && !hasExplicitAuthorization) {
				const authorizationKey = getHeaderKey("authorization");
				if (authorizationKey && authorizationKey !== "Authorization") delete headers[authorizationKey];
				headers.Authorization = authHeader.value;
			}
			return {
				...init,
				headers
			};
		}
		if (!hasExplicitAuthorization) {
			const authorizationKey = getHeaderKey("authorization");
			if (authorizationKey) delete headers[authorizationKey];
			if (!hasApiKey) headers["x-api-key"] = authHeader.value;
		}
		return {
			...init,
			headers
		};
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
		Object.defineProperty(this, "anonymizer", {
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
		/** `config.fetchOptions` without its `headers`, which are merged separately. */
		Object.defineProperty(this, "fetchOptions", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_fetchOptionsHeaders", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: {}
		});
		Object.defineProperty(this, "_openAPIClient", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "_openAPIClientSignature", {
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
		Object.defineProperty(this, "_stainlessVersionsChecked", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
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
		Object.defineProperty(this, "profileAuth", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "multipartStreamingDisabled", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: getLangSmithEnvironmentVariable("DISABLE_MULTIPART_STREAMING") === "true"
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
			value: 104857600
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
		const configuredApiKey = trimQuotes(config.apiKey ?? defaultConfig.apiKey);
		this.apiKey = hasValue(configuredApiKey) ? configuredApiKey : void 0;
		this.profileAuth = this.apiKey !== void 0 ? void 0 : defaultConfig.profileAuth;
		this.webUrl = trimQuotes(config.webUrl ?? defaultConfig.webUrl);
		if (this.webUrl?.endsWith("/")) this.webUrl = this.webUrl.slice(0, -1);
		this.workspaceId = trimQuotes(config.workspaceId ?? defaultConfig.workspaceId);
		this.timeout_ms = config.timeout_ms ?? 9e4;
		this.caller = new AsyncCaller({
			...config.callerOptions ?? {},
			maxRetries: 4,
			debug: config.debug ?? this.debug
		});
		this.traceBatchConcurrency = config.traceBatchConcurrency ?? this.traceBatchConcurrency;
		if (this.traceBatchConcurrency < 1) throw new Error("Trace batch concurrency must be positive.");
		this.debug = config.debug ?? this.debug;
		if (this.debug) {
			const source = config.apiUrl != null ? "apiUrl option" : defaultConfig.apiUrlSource;
			console.log(`LangSmith API URL ${this.apiUrl} resolved from ${source}`);
		}
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
		this.hideMetadata = config.hideMetadata ?? config.anonymizer ?? defaultConfig.hideMetadata;
		this.anonymizer = config.anonymizer;
		this.omitTracedRuntimeInfo = config.omitTracedRuntimeInfo ?? false;
		this.autoBatchTracing = config.autoBatchTracing ?? this.autoBatchTracing;
		this.autoBatchQueue = new AutoBatchQueue(maxMemory);
		this.blockOnRootRunFinalization = config.blockOnRootRunFinalization ?? this.blockOnRootRunFinalization;
		this.batchSizeBytesLimit = config.batchSizeBytesLimit;
		this.batchSizeLimit = config.batchSizeLimit;
		const { headers: fetchOptionsHeaders, ...fetchOptions } = config.fetchOptions || {};
		this.fetchOptions = fetchOptions;
		this._fetchOptionsHeaders = normalizeHeaders(fetchOptionsHeaders);
		assertValidHeaders(config.headers);
		this._customHeaders = config.headers ?? {};
		this.manualFlushMode = config.manualFlushMode ?? this.manualFlushMode;
		this._tracingMode = resolveTracingMode(config.tracingMode);
		if (this._tracingMode === "otel") this.langSmithToOTELTranslator = new LangSmithToOTELTranslator();
		this.cachedLSEnvVarsForMetadata = getLangSmithEnvVarsMetadata();
		warnOnEnv();
		if (config.cache !== void 0 && config.disablePromptCache) warnOnce$1("Both 'cache' and 'disablePromptCache' were provided. The 'cache' parameter is deprecated and will be removed in a future version. Using 'cache' parameter value.");
		if (config.cache !== void 0) {
			warnOnce$1("The 'cache' parameter is deprecated and will be removed in a future version. Use 'configureGlobalPromptCache()' to configure the global cache, or 'disablePromptCache: true' to disable caching for this client.");
			if (config.cache === false) this._promptCache = void 0;
			else if (config.cache === true) this._promptCache = promptCacheSingleton;
			else this._promptCache = config.cache;
		} else if (!config.disablePromptCache) this._promptCache = promptCacheSingleton;
	}
	static getDefaultClientConfig() {
		const profileConfig = loadProfileClientConfig();
		const envApiKey = getLangSmithEnvironmentVariable("API_KEY");
		const envApiUrl = getLangSmithEnvironmentVariable("ENDPOINT");
		const envWorkspaceId = getLangSmithEnvironmentVariable("WORKSPACE_ID");
		const envAuthSet = hasValue(envApiKey);
		const apiUrl = envApiUrl ?? profileConfig.apiUrl ?? "https://api.smith.langchain.com";
		const apiUrlSource = envApiUrl != null ? "LANGSMITH_ENDPOINT / LANGCHAIN_ENDPOINT environment variable" : profileConfig.apiUrl != null ? "profile config" : "built-in default";
		const workspaceId = envWorkspaceId ?? profileConfig.workspaceId;
		return {
			apiUrl,
			apiUrlSource,
			apiKey: envApiKey,
			webUrl: void 0,
			hideInputs: getLangSmithEnvironmentVariable("HIDE_INPUTS") === "true",
			hideOutputs: getLangSmithEnvironmentVariable("HIDE_OUTPUTS") === "true",
			hideMetadata: getLangSmithEnvironmentVariable("HIDE_METADATA") === "true",
			workspaceId,
			oauthAccessToken: !envAuthSet ? profileConfig.oauthAccessToken : void 0,
			oauthRefreshToken: !envAuthSet ? profileConfig.oauthRefreshToken : void 0,
			profileAuth: !envAuthSet ? profileConfig.profileAuth : void 0
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
	/**
	* The headers this client sets from its own config, which a caller-supplied
	* header must not replace.
	*
	* Only what the client *actually* supplies: passing an explicit `Authorization`
	* or `x-api-key` header with no configured credential is a supported way to
	* authenticate (see `hasExplicitAuthHeader`), so those must survive.
	*/
	get _sdkControlledHeaders() {
		const names = /* @__PURE__ */ new Set();
		if (this.apiKey !== void 0) names.add("x-api-key");
		else {
			const profileAuthHeader = this.profileAuth?.currentAuthHeader();
			if (profileAuthHeader) names.add(profileAuthHeader.name.toLowerCase());
		}
		if (this.workspaceId) names.add("x-tenant-id");
		return names;
	}
	/**
	* Headers supplied by the caller, through either `config.headers` or
	* `config.fetchOptions.headers`, with the ones this SDK sets removed.
	*
	* `_customHeaders` is normalized here rather than at assignment because it is
	* public and mutable: `get headers` hands back the caller's own object, so its
	* contents can change (and can become malformed) at any point.
	*/
	get _callerHeaders() {
		return mergeCallerHeaders(normalizeHeaders(this._customHeaders), this._fetchOptionsHeaders, this._sdkControlledHeaders);
	}
	get _mergedHeaders() {
		const headers = {
			"User-Agent": `langsmith-js/${__version__}`,
			...this._callerHeaders
		};
		if (this.apiKey !== void 0) headers["x-api-key"] = `${this.apiKey}`;
		else {
			const profileAuthHeader = this.profileAuth?.currentAuthHeader();
			if (profileAuthHeader) headers[profileAuthHeader.name] = profileAuthHeader.value;
		}
		if (this.workspaceId) headers["x-tenant-id"] = this.workspaceId;
		return headers;
	}
	/**
	* The options to build the generated client with: its auth, and the headers
	* it should send on every request.
	*
	* The generated client applies `defaultHeaders` *after* its own auth headers,
	* so the ones this SDK sets are already dropped from `_callerHeaders` to keep
	* the precedence of `_mergedHeaders`, where required headers win.
	*/
	get _openAPIClientOptions() {
		const headers = { ...this._callerHeaders };
		if (!Object.keys(headers).some((name) => name.toLowerCase() === "user-agent")) headers["User-Agent"] = `langsmith-js/${__version__}`;
		const callerApiKeyName = Object.keys(headers).find((name) => name.toLowerCase() === "x-api-key");
		let apiKey = this.apiKey;
		if (apiKey === void 0 && callerApiKeyName !== void 0) {
			apiKey = headers[callerApiKeyName] ?? void 0;
			delete headers[callerApiKeyName];
		}
		if (apiKey === void 0 && this.workspaceId === void 0) headers["X-API-Key"] = null;
		return {
			apiKey,
			defaultHeaders: Object.keys(headers).length > 0 ? headers : void 0
		};
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
		assertValidHeaders(value);
		this._customHeaders = value ?? {};
	}
	_getOpenAPIBaseUrl() {
		const url = this.apiUrl.replace(/\/$/, "");
		for (const suffix of ["/api/v1", "/api"]) if (url.endsWith(suffix)) return url.slice(0, -suffix.length);
		return url;
	}
	/**
	* The generated OpenAPI client, rebuilt whenever its auth or headers change.
	*
	* The generated client captures `defaultHeaders` and `apiKey` when it is
	* built, while the handwritten paths recompute `_mergedHeaders` per request.
	* Rebuilding on change keeps the two halves from diverging when the inputs
	* move underneath us — a caller mutating the object returned by
	* `get headers`, or a profile whose auth header only becomes available after
	* its token is refreshed.
	*/
	get openAPIClient() {
		const options = this._openAPIClientOptions;
		const signature = JSON.stringify([options.apiKey, options.defaultHeaders]);
		if (this._openAPIClient === void 0 || this._openAPIClientSignature !== signature) {
			this._openAPIClientSignature = signature;
			this._openAPIClient = this._newOpenAPIClient(options);
		}
		return this._openAPIClient;
	}
	_newOpenAPIClient(options = this._openAPIClientOptions) {
		const { method: _method, body: _body, signal: _signal, ...openAPIFetchOptions } = this.fetchOptions;
		return new Langsmith({
			apiKey: options.apiKey,
			tenantID: this.workspaceId,
			baseURL: this._getOpenAPIBaseUrl(),
			timeout: this.timeout_ms,
			fetch: this._fetch,
			fetchOptions: openAPIFetchOptions,
			defaultHeaders: options.defaultHeaders
		});
	}
	_getPlatformEndpointPath(path) {
		return this.apiUrl.slice(-3) !== "/v1" && this.apiUrl.slice(-4) !== "/v1/" ? `/v1/platform/${path}` : `/platform/${path}`;
	}
	get evaluators() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.onlineEvaluators;
	}
	get runs() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.runs;
	}
	/** Access the v2 sandboxes resource (registries, snapshots, boxes). */
	get sandboxes() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.sandboxes;
	}
	/** Access the v2 datasets resource (experimentRuns, etc.). */
	get datasets() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.datasets;
	}
	/** Access the annotation queues resource (runs, items). */
	get annotationQueues() {
		this._checkStainlessVersion("0.16.14");
		return this.openAPIClient.annotationQueues;
	}
	/** Access the threads resource (query, stats, listTraces). */
	get threads() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.threads;
	}
	/** Access the traces resource (query, listRuns). */
	get traces() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.traces;
	}
	/** Access the public shared-run resource. */
	get public() {
		this._checkStainlessVersion("0.16.0");
		return this.openAPIClient.public;
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
	* Apply the configured anonymizer to a run's error string.
	*
	* Unlike inputs/outputs, `error` is a plain string (an exception message or
	* traceback) that can carry credentials the user never explicitly logged --
	* e.g. an HTTP-client error whose message embeds an `Authorization` header.
	* The anonymizer is typed `(KVMap) => KVMap`, so the string is wrapped as
	* `{ error }`, scrubbed, and unwrapped. Mirrors the Python SDK's
	* `Client._hide_run_error`.
	*
	* TODO: Update anonymizer to always nest inputs/outputs/error for consistency
	*/
	async processError(error) {
		if (this.anonymizer == null) return error;
		const result = await this.anonymizer({ error });
		return typeof result?.error === "string" ? result.error : error;
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
	async prepareRunCreateOrUpdateInputs(run, options) {
		const runParams = { ...run };
		applyToPayload(runParams, { update: options?.update ?? false });
		if (runParams.inputs !== void 0) runParams.inputs = await this.processInputs(runParams.inputs);
		if (runParams.outputs !== void 0) runParams.outputs = await this.processOutputs(runParams.outputs);
		if (runParams.error !== void 0) runParams.error = await this.processError(runParams.error);
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
	_shouldSample(identifier) {
		return isSampledById(identifier, this.tracingSampleRate);
	}
	_filterForSampling(runs) {
		return runs.filter((run) => this._shouldSample(run.trace_id ?? run.dotted_order?.split(".", 1)[0].split("Z")[1] ?? run.id));
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
				const workspaceId = item.workspaceId ?? this.workspaceId;
				const batchKey = item.apiKey === this.apiKey && item.apiUrl === this.apiUrl && item.workspaceId === this.workspaceId ? "default" : `${apiUrl}|${apiKey}|${workspaceId ?? ""}`;
				if (!acc[batchKey]) acc[batchKey] = [];
				acc[batchKey].push(item);
				return acc;
			}, {});
			const batchPromises = [];
			for (const [batchKey, batch] of Object.entries(batchesByDestination)) {
				const isDefault = batchKey === "default";
				const parts = isDefault ? [] : batchKey.split("|");
				const workspaceIdPart = parts[2];
				const batchPromise = this._processBatch(batch, {
					apiUrl: isDefault ? void 0 : parts[0],
					apiKey: isDefault ? void 0 : parts[1],
					workspaceId: isDefault || !workspaceIdPart ? void 0 : workspaceIdPart
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
				await mkdir$1(directory);
				Client._fallbackDirsCreated.add(directory);
			}
			if (maxBytes !== void 0 && maxBytes > 0) try {
				const traceFiles = (await readdir$1(directory)).filter((f) => f.startsWith("trace_") && f.endsWith(".json"));
				let total = 0;
				for (const name of traceFiles) {
					const { size } = await stat$1(path.join(directory, name));
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
			if (this.langSmithToOTELTranslator !== void 0) {
				for (const item of batch) item.item = await this._maskRunMetadata(item.item);
				this._sendBatchToOTELTranslator(batch);
			} else {
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
	async _maskRunMetadata(run) {
		if (run.extra?.metadata == null) return run;
		return {
			...run,
			extra: {
				...run.extra,
				metadata: await this.processMetadata(run.extra.metadata)
			}
		};
	}
	async _mergeRuntimeEnvAndMaskMetadata(run) {
		const merged = mergeRuntimeEnvIntoRun(run, this.cachedLSEnvVarsForMetadata, this.omitTracedRuntimeInfo, this.tracingSampleRate);
		if (this.omitTracedRuntimeInfo) return merged;
		return this._maskRunMetadata(merged);
	}
	async processRunOperation(item) {
		clearTimeout(this.autoBatchTimeout);
		this.autoBatchTimeout = void 0;
		item.item = mergeRuntimeEnvIntoRun(item.item, this.cachedLSEnvVarsForMetadata, this.omitTracedRuntimeInfo, this.tracingSampleRate);
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
	_checkStainlessVersion(minVersion) {
		if (this._stainlessVersionsChecked.has(minVersion)) return;
		this._stainlessVersionsChecked.add(minVersion);
		this._ensureServerInfo().then((serverInfo) => {
			_checkBackendVersion(serverInfo?.version, minVersion);
		}).catch(() => {});
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
	async _supportsSDBQuery() {
		return (await this._ensureServerInfo()).instance_flags?.sdb_query_enabled === true;
	}
	/**
	* Throw on SmithDB-only deployments, warn elsewhere. Call only when run-level
	* feedback has no sessionId.
	*/
	async _checkFeedbackSessionId() {
		const docs = "https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#feedback-create";
		if (getQueryBackend((await this._ensureServerInfo()).instance_flags) === QueryBackend.SMITHDB_ONLY) throw new Error(`sessionId must be provided when creating feedback for a run: this deployment cannot locate the run without it. See ${docs}`);
		warnOnce$1(`Creating feedback for a run without sessionId is deprecated and will stop working in a future release. See ${docs}`);
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
		const address = checkAddress(run.address);
		const bodySessionName = run.session_name;
		rejectConflicting(run.project_name ?? bodySessionName, address);
		const session_name = run.project_name;
		delete run.project_name;
		if (!session_name && bodySessionName == null && !address) try {
			run.address = resolveFromEnv()[1];
		} catch (e) {
			if (!(e instanceof EnvAddressError)) throw e;
			logUntraced(e);
			return;
		}
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
				apiUrl: options?.apiUrl,
				workspaceId: options?.workspaceId
			}).catch(console.error);
			return;
		}
		const mergedRunCreateParam = await this._mergeRuntimeEnvAndMaskMetadata(runCreate);
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
		let preparedUpdateParams = await Promise.all(runUpdates?.map((update) => this.prepareRunCreateOrUpdateInputs(update, { update: true })) ?? []);
		const createById = indexRunCreatesById(preparedCreateParams);
		if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
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
		if (options?.workspaceId !== void 0) headers["x-tenant-id"] = options.workspaceId;
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
		for (const update of runUpdates ?? []) preparedUpdateParams.push(await this.prepareRunCreateOrUpdateInputs(update, { update: true }));
		if (preparedCreateParams.find((runCreate) => {
			return runCreate.trace_id === void 0 || runCreate.dotted_order === void 0;
		}) !== void 0) throw new Error(`Multipart ingest requires "trace_id" and "dotted_order" to be set when creating a run`);
		if (preparedUpdateParams.find((runUpdate) => {
			return runUpdate.trace_id === void 0 || runUpdate.dotted_order === void 0;
		}) !== void 0) throw new Error(`Multipart ingest requires "trace_id" and "dotted_order" to be set when updating a run`);
		const createById = indexRunCreatesById(preparedCreateParams);
		if (preparedCreateParams.length > 0 && preparedUpdateParams.length > 0) {
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
				if (options?.workspaceId !== void 0) headers["x-tenant-id"] = options.workspaceId;
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
			if ((!this.multipartStreamingDisabled || streamedAttempt) && res.status === 422 && (options?.apiUrl ?? this.apiUrl) !== "https://api.smith.langchain.com") {
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
		if (run.error) run.error = await this.processError(run.error);
		if (run.extra != null && "metadata" in run.extra) run.extra = {
			...run.extra,
			metadata: await this.processMetadata(run.extra.metadata)
		};
		if (run.events) run.events = this._filterNewTokenEvents(run.events);
		applyToPayload(run, { update: true });
		const data = {
			...run,
			id: runId
		};
		if (!this._filterForSampling([data]).length) return;
		if (this.autoBatchTracing && data.trace_id !== void 0 && data.dotted_order !== void 0) {
			const otelContext = this._cloneCurrentOTELContext();
			if (run.end_time !== void 0 && data.parent_run_id === void 0 && this.blockOnRootRunFinalization && !this.manualFlushMode) {
				await this.processRunOperation({
					action: "update",
					item: data,
					otelContext,
					apiKey: options?.apiKey,
					apiUrl: options?.apiUrl,
					workspaceId: options?.workspaceId
				}).catch(console.error);
				return;
			} else this.processRunOperation({
				action: "update",
				item: data,
				otelContext,
				apiKey: options?.apiKey,
				apiUrl: options?.apiUrl,
				workspaceId: options?.workspaceId
			}).catch(console.error);
			return;
		}
		const headers = {
			...this._mergedHeaders,
			"Content-Type": "application/json"
		};
		if (options?.apiKey !== void 0) headers["x-api-key"] = options.apiKey;
		if (options?.workspaceId !== void 0) headers["x-tenant-id"] = options.workspaceId;
		const body = serialize(run.extra ? mergeRuntimeEnvIntoRun(run, this.cachedLSEnvVarsForMetadata, this.omitTracedRuntimeInfo, this.tracingSampleRate) : run, `Serializing payload to update run with id: ${runId}`);
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
	/** @deprecated Use `client.runs.retrieve()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-runs#runs-retrieve for the migration guide. Will be removed after Jan 31, 2027. */
	async readRun(runId, { loadChildRuns } = { loadChildRuns: false }) {
		warnOnce$1("readRun() is deprecated and will be removed after Jan 31, 2027. Use client.runs.retrieve() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-runs#runs-retrieve for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_READ_RUN"
		});
		return this._readRun(runId, { loadChildRuns });
	}
	/**
	* Fetch a run without emitting the `readRun()` deprecation warning.
	*
	* Internal callers use this so that a supported method doesn't warn about a
	* deprecated one the caller never invoked.
	*
	* @internal
	*/
	async _readRun(runId, { loadChildRuns } = { loadChildRuns: false }) {
		assertUuid(runId);
		let run = _normalizeRunTimestamps(await this._get(`/runs/${runId}`));
		if (loadChildRuns) run = await this._loadChildRuns(run);
		return run;
	}
	/** @deprecated Use `client.runs.getURL()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-runs#runs-get-url for the migration guide. Will be removed after Jan 31, 2027. */
	async getRunUrl({ runId, run, projectOpts }) {
		warnOnce$1("getRunUrl() is deprecated and will be removed after Jan 31, 2027. Use client.runs.getURL() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-runs#runs-get-url for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_GET_RUN_URL"
		});
		if (run !== void 0) {
			if (!run.session_id && run.address) throw new Error("Addressed runs have no URL until read back.");
			let sessionId;
			if (run.session_id) sessionId = run.session_id;
			else if (projectOpts?.projectName) sessionId = (await this.readProject({ projectName: projectOpts?.projectName })).id;
			else if (projectOpts?.projectId) sessionId = projectOpts?.projectId;
			else sessionId = (await this.readProject({ projectName: getLangSmithEnvironmentVariable("PROJECT") || "default" })).id;
			const tenantId = await this._getTenantId();
			return `${this.getHostUrl()}/o/${tenantId}/projects/p/${sessionId}/r/${run.id}?poll=true`;
		} else if (runId !== void 0) {
			const run_ = await this._readRun(runId);
			if (!run_.app_path) throw new Error(`Run ${runId} has no app_path`);
			return `${this.getHostUrl()}${run_.app_path}`;
		} else throw new Error("Must provide either runId or run");
	}
	async _loadChildRuns(run) {
		const childRuns = await toArray(this._listRuns({
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
	* @deprecated Use `client.runs.query()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-query-runs#runs-query for the migration guide. Will be removed after Jan 31, 2027.
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
		warnOnce$1("listRuns() is deprecated and will be removed after Jan 31, 2027. Use client.runs.query() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-query-runs#runs-query for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_LIST_RUNS"
		});
		yield* this._listRuns(props);
	}
	/**
	* List runs without emitting the `listRuns()` deprecation warning.
	*
	* Internal callers use this so that a supported method doesn't warn about a
	* deprecated one the caller never invoked.
	*
	* @internal
	*/
	async *_listRuns(props) {
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
		if (body.select.includes("child_run_ids")) warnOnce$1("Deprecated: 'child_run_ids' in the listRuns select parameter is deprecated and will be removed in a future version.");
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
	/** @deprecated Use `client.threads.listTraces()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-threads#threads-list-traces for the migration guide. Will be removed after Jan 31, 2027. */
	async *readThread(props) {
		warnOnce$1("readThread() is deprecated and will be removed after Jan 31, 2027. Use client.threads.listTraces() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-threads#threads-list-traces for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_READ_THREAD"
		});
		const { threadId, projectId, projectName, isRoot = true, limit, filter: userFilter, order = "asc" } = props;
		if (!projectId && !projectName) throw new Error("threadId requires projectId or projectName");
		const threadFilter = `eq(thread_id, ${JSON.stringify(threadId)})`;
		const combinedFilter = userFilter ? `and(${threadFilter}, ${userFilter})` : threadFilter;
		yield* this._listRuns({
			projectId: projectId ?? void 0,
			projectName: projectName ?? void 0,
			isRoot,
			limit,
			filter: combinedFilter,
			order
		});
	}
	/** @deprecated Use `client.threads.query()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-threads#threads-query for the migration guide. Will be removed after Jan 31, 2027. */
	async listThreads(props) {
		warnOnce$1("listThreads() is deprecated and will be removed after Jan 31, 2027. Use client.threads.query() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-threads#threads-query for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_LIST_THREADS"
		});
		const { projectId, projectName, limit, offset = 0, filter, startTime, isRoot = true } = props;
		if (!projectId && !projectName) throw new Error("Either projectId or projectName must be provided");
		if (projectId && projectName) throw new Error("Provide exactly one of projectId or projectName");
		const sessionId = projectId ?? (await this.readProject({ projectName })).id;
		const startTimeResolved = startTime ?? /* @__PURE__ */ new Date(Date.now() - 864e5);
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
		if (projectIds_.length === 0) throw new Error("At least one of projectNames or projectIds must be provided.");
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
	/** @deprecated Use `client.runs.share.create()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide. Will be removed after Jan 31, 2027. */
	async shareRun(runId, { shareId } = {}) {
		warnOnce$1("shareRun() is deprecated and will be removed after Jan 31, 2027. Use client.runs.share.create() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_SHARE_RUN"
		});
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
	/** @deprecated Use `client.runs.share.delete()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide. Will be removed after Jan 31, 2027. */
	async unshareRun(runId) {
		warnOnce$1("unshareRun() is deprecated and will be removed after Jan 31, 2027. Use client.runs.share.delete() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_UNSHARE_RUN"
		});
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
	/** @deprecated Use `client.runs.retrieve({ selects: ["SHARE_URL"] })` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide. Will be removed after Jan 31, 2027. */
	async readRunSharedLink(runId) {
		warnOnce$1("readRunSharedLink() is deprecated and will be removed after Jan 31, 2027. Use client.runs.retrieve({ selects: [\"SHARE_URL\"] }) instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_READ_RUN_SHARED_LINK"
		});
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
	/** @deprecated Use `client.public.runs.query()` instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide. Will be removed after Jan 31, 2027. */
	async listSharedRuns(shareToken, { runIds } = {}) {
		warnOnce$1("listSharedRuns() is deprecated and will be removed after Jan 31, 2027. Use client.public.runs.query() instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#share-and-read-public-runs for the migration guide.", {
			type: "DeprecationWarning",
			code: "LANGSMITH_DEPRECATED_LIST_SHARED_RUNS"
		});
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
	async createProject({ projectName, description = null, metadata = null, upsert = false, projectExtra = null, referenceDatasetId = null, numExamples = null, numRepetitions = null, evaluatorKeys = null, tagValueIds = null }) {
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
		if (numExamples != null) body["num_examples"] = numExamples;
		if (numRepetitions != null) body["num_repetitions"] = numRepetitions;
		if (evaluatorKeys != null && evaluatorKeys.length > 0) body["evaluator_keys"] = evaluatorKeys;
		if (tagValueIds !== null) body["tag_value_ids"] = tagValueIds;
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
	async createDataset(name, { description, dataType, inputsSchema, outputsSchema, metadata, tagValueIds } = {}) {
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
		if (tagValueIds !== void 0) body.tag_value_ids = tagValueIds;
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
				presigned_url: new URL(value.presigned_url, this.apiUrl).href,
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
						presigned_url: new URL(value.presigned_url, this.apiUrl).href,
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
	async createFeedback(runIdOrParams, keyArg, optionsArg) {
		const { runId = null, key, score, value, correction, comment, sourceInfo, feedbackSourceType = "api", sourceRunId, feedbackId, feedbackConfig, projectId, traceId, comparativeExperimentId, sessionId, startTime, extendTraceRetention, address: rawAddress } = typeof runIdOrParams === "object" && runIdOrParams !== null ? runIdOrParams : {
			runId: runIdOrParams,
			key: keyArg,
			...optionsArg
		};
		const address = checkAddress(rawAddress);
		rejectConflicting(sessionId ?? projectId, address);
		if (!runId && !projectId) throw new Error("One of runId or projectId must be provided");
		if (runId && projectId) throw new Error("Only one of runId or projectId can be provided");
		if (runId && sessionId === void 0 && !address) await this._checkFeedbackSessionId();
		const feedback_source = {
			type: feedbackSourceType ?? "api",
			metadata: sourceInfo ?? {}
		};
		if (sourceRunId !== void 0 && feedback_source?.metadata !== void 0 && !feedback_source.metadata["__run"]) feedback_source.metadata["__run"] = { run_id: sourceRunId };
		if (feedback_source?.metadata !== void 0 && feedback_source.metadata["__run"]?.run_id !== void 0) assertUuid(feedback_source.metadata["__run"].run_id);
		const feedback = {
			id: feedbackId ?? v7(),
			run_id: runId,
			trace_id: traceId,
			key,
			score: _formatFeedbackScore(score),
			value,
			correction,
			comment,
			feedback_source,
			comparative_experiment_id: comparativeExperimentId,
			feedbackConfig,
			session_id: sessionId ?? projectId,
			start_time: startTime,
			extend_trace_retention: extendTraceRetention
		};
		const samplingId = traceId ?? runId;
		if (samplingId != null && !this._shouldSample(samplingId)) return feedback;
		const body = JSON.stringify(address ? {
			...feedback,
			address
		} : feedback);
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
	async _logEvaluationFeedback(evaluatorResponse, run, sourceInfo, sessionId) {
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
				sessionId: run?.session_id ?? sessionId,
				startTime: run?.start_time,
				traceId: runId_ === run?.id ? run?.trace_id : void 0
			}));
		}
		return [evalResults, feedbacks];
	}
	async logEvaluationFeedback(evaluatorResponseOrParams, run, sourceInfo, sessionId) {
		if (evaluatorResponseOrParams != null && typeof evaluatorResponseOrParams === "object" && "evaluatorResponse" in evaluatorResponseOrParams) {
			const [results] = await this._logEvaluationFeedback(evaluatorResponseOrParams.evaluatorResponse, evaluatorResponseOrParams.run, evaluatorResponseOrParams.sourceInfo, evaluatorResponseOrParams.projectId);
			return results;
		}
		const [results] = await this._logEvaluationFeedback(evaluatorResponseOrParams, run, sourceInfo, sessionId);
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
	*
	* The second argument is either:
	* - `RunKey[]` (preferred): each entry carries the run's full lookup key, so
	*   it can be located directly without a scan. Required for workspaces served
	*   by SmithDB; routes to `POST /runs/by-key`.
	* - `string[]`: a plain list of run IDs. **Deprecated**: this path will be
	*   removed after Jan 31, 2027; prefer the key form. Routes to `POST /runs`.
	*   See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#annotation-queues-add-runs.
	*
	* If every element is a string (or the list is empty) it is treated as run
	* IDs; otherwise the list is treated as `RunKey` objects.
	*
	* @param queueId - The ID of the annotation queue
	* @param runs - Either a list of run IDs (deprecated) or a list of run keys.
	*/
	async addRunsToAnnotationQueue(queueId, runs) {
		const base = `${this.apiUrl}/annotation-queues/${assertUuid(queueId, "queueId")}/runs`;
		const allStrings = runs.every((r) => typeof r === "string");
		let url;
		let body;
		if (!allStrings) {
			url = `${base}/by-key`;
			body = JSON.stringify(runs.map((run, i) => {
				const serialized = {
					run_id: assertUuid(run.runId, `runs[${i}].runId`).toString(),
					session_id: assertUuid(run.sessionId, `runs[${i}].sessionId`).toString(),
					start_time: typeof run.startTime === "string" ? run.startTime : new Date(run.startTime).toISOString()
				};
				if (run.sourceProposedExampleId != null) serialized.source_proposed_example_id = assertUuid(run.sourceProposedExampleId, `runs[${i}].sourceProposedExampleId`).toString();
				return serialized;
			}));
		} else {
			warnOnce$1("Passing run IDs as strings to addRunsToAnnotationQueue() is deprecated and will be removed after Jan 31, 2027. Use RunKey[] instead. See https://docs.langchain.com/langsmith/smithdb-sdk-migration-feedback#annotation-queues-add-runs for the migration guide.", {
				type: "DeprecationWarning",
				code: "LANGSMITH_DEPRECATED_ADD_RUNS_STRING_IDS"
			});
			url = base;
			body = JSON.stringify(runs.map((id, i) => assertUuid(id, `runs[${i}]`).toString()));
		}
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
	* List the runs in an annotation queue.
	* @param queueId - The ID of the annotation queue
	* @param options - The options for listing runs in the annotation queue
	* @param options.status - Filter runs by review status. If omitted, returns
	* runs across all review states.
	* @param options.limit - The maximum number of runs to return
	* @returns An iterator of RunWithAnnotationQueueInfo objects
	*/
	async *listRunsFromAnnotationQueue(queueId, options = {}) {
		const { status, limit: userLimit } = options;
		const params = new URLSearchParams();
		const limit = userLimit !== void 0 && Number.isFinite(userLimit) ? Math.min(userLimit, 100) : 100;
		if (status) params.append("status", status);
		params.append("limit", limit.toString());
		let count = 0;
		const path = `/annotation-queues/${assertUuid(queueId, "queueId")}/runs`;
		for await (const runs of this._getPaginated(path, params)) for (const run of runs) {
			yield _normalizeRunTimestamps(run);
			count++;
			if (count >= limit) return;
		}
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
	async _createCommitTags(promptOwnerAndName, commitId, tags) {
		const tagList = typeof tags === "string" ? [tags] : tags;
		await Promise.all(tagList.map(async (tag) => this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}/repos/${promptOwnerAndName}/tags`, {
				method: "POST",
				headers: {
					...this._mergedHeaders,
					"Content-Type": "application/json"
				},
				signal: AbortSignal.timeout(this.timeout_ms),
				...this.fetchOptions,
				body: JSON.stringify({
					tag_name: tag,
					commit_id: commitId
				})
			});
			await raiseForStatus(res, "create commit tag");
			return res;
		})));
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
		if (!await this._currentTenantIsOwner(owner)) {
			if (commitHash !== "latest") return `${this.getHostUrl()}/hub/${owner}/${promptName}/${commitHash.substring(0, 8)}`;
			else return `${this.getHostUrl()}/hub/${owner}/${promptName}`;
		} else {
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
	* @param options.tags - A tag or list of tags to apply to the commit.
	* @param options.description - A description for the commit.
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
	* // Create a commit with tags
	* const commitUrl2 = await client.createCommit("my-prompt", template, {
	*   tags: ["production", "v1"]
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
		const commit = result.commit ?? result;
		if (options?.tags) await this._createCommitTags(`${owner}/${promptName}`, commit.id, options.tags);
		return this._getPromptUrl(`${owner}/${promptName}${commit.commit_hash ? `:${commit.commit_hash}` : ""}`);
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
	*
	* When pulling a trusted external prompt, prefer pinning to a specific commit
	* rather than following a mutable latest version. Using `includeModel: true`
	* increases risk and should be avoided for public prompts or prompts outside
	* your own organization.
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
	*
	* When pulling a trusted external prompt, prefer pinning to a specific commit
	* rather than following a mutable latest version. Using `includeModel: true`
	* increases risk and should be avoided for public prompts or prompts outside
	* your own organization.
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
			if (options && [
				"description",
				"readme",
				"tags",
				"isPublic"
			].some((key) => options[key] !== void 0)) await this.updatePrompt(promptIdentifier, {
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
			tags: options?.commitTags,
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
		const url = new URL(`${this.apiUrl}${this._getPlatformEndpointPath(`hub/repos/${owner}/${name}/directories`)}`);
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
			const res = await this._fetch(`${this.apiUrl}${this._getPlatformEndpointPath(`hub/repos/${owner}/${name}/directories/commits`)}`, {
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
		const settings = await this._getSettings();
		const query = new URLSearchParams({ organizationId: settings.id });
		return `${this.getHostUrl()}/context/${name}/${commitHash.slice(0, 8)}?${query.toString()}`;
	}
	async _deleteDirectory(identifier) {
		const [owner, name] = parseHubIdentifier(identifier);
		if (!await this._currentTenantIsOwner(owner)) throw await this._ownerConflictError("delete", owner);
		await this.caller.call(async () => {
			const res = await this._fetch(`${this.apiUrl}${this._getPlatformEndpointPath(`hub/repos/${owner}/${name}/directories`)}`, {
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/env.js
const isEnvTracingEnabled = (tracingEnabled) => {
	if (tracingEnabled !== void 0) return tracingEnabled;
	return !!["TRACING_V2", "TRACING"].find((envVar) => getLangSmithEnvironmentVariable(envVar) === "true");
};
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/singletons/constants.js
const _LC_CONTEXT_VARIABLES_KEY = Symbol.for("lc:context_variables");
const _REPLICA_TRACE_ROOTS_KEY = Symbol.for("langsmith:replica_trace_roots");
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/utils/context_vars.js
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
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/run_trees.js
const UUID_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
function getReplicaKey(replica) {
	return v5$1(Object.keys(replica).sort().map((key) => `${key}:${replica[key] ?? ""}`).join("|"), UUID_NAMESPACE_DNS);
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
const HEADER_SAFE_REPLICA_FIELDS = /* @__PURE__ */ new Set([
	"projectName",
	"primary",
	"updates",
	"reroot",
	"address"
]);
const LANGSMITH_ADDRESS = "langsmith-address";
/** Validates an untrusted header address; `undefined` if unusable. */
function addressFromHeader(value) {
	if (value == null) return;
	try {
		return parse$1(value);
	} catch {
		console.warn("Ignoring an unusable address in a `baggage` header.");
		return;
	}
}
function filterReplicaForHeaders(replica) {
	const filtered = {};
	for (const key of Object.keys(replica)) {
		if (key === "primary" && typeof replica[key] !== "boolean") continue;
		if (HEADER_SAFE_REPLICA_FIELDS.has(key)) filtered[key] = replica[key];
	}
	return filtered;
}
/**
* Baggage header information
*/
var Baggage = class Baggage {
	constructor(metadata, tags, project_name, replicas, address) {
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
		Object.defineProperty(this, "address", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		this.metadata = metadata;
		this.tags = tags;
		this.project_name = project_name;
		this.replicas = replicas;
		this.address = address;
	}
	static fromHeader(value) {
		const items = value.split(",");
		let metadata = {};
		let tags = [];
		let project_name;
		let replicas;
		let address;
		for (const item of items) {
			const [key, uriValue] = item.split("=");
			const value = decodeURIComponent(uriValue);
			if (key === "langsmith-metadata") metadata = JSON.parse(value);
			else if (key === "langsmith-tags") tags = value.split(",");
			else if (key === "langsmith-project") project_name = value;
			else if (key === LANGSMITH_ADDRESS) address = addressFromHeader(value);
			else if (key === "langsmith-replicas") replicas = JSON.parse(value).flatMap((replica) => {
				if (Array.isArray(replica)) return [replica];
				const filtered = filterReplicaForHeaders(replica);
				const raw = filtered.address;
				delete filtered.address;
				const address = addressFromHeader(raw);
				if (filtered.projectName || raw == null) return [filtered];
				return address ? [{
					...filtered,
					address
				}] : [];
			});
		}
		return new Baggage(metadata, tags, project_name, replicas, address);
	}
	toHeader() {
		const items = [];
		if (this.metadata && Object.keys(this.metadata).length > 0) items.push(`langsmith-metadata=${encodeURIComponent(JSON.stringify(this.metadata))}`);
		if (this.tags && this.tags.length > 0) items.push(`langsmith-tags=${encodeURIComponent(this.tags.join(","))}`);
		if (this.project_name) items.push(`langsmith-project=${encodeURIComponent(this.project_name)}`);
		if (this.address) items.push(`${LANGSMITH_ADDRESS}=${encodeURIComponent(this.address)}`);
		return items.join(",");
	}
};
function getExcludeInputsOnPatch() {
	const value = getLangSmithEnvironmentVariable("EXCLUDE_INPUTS_ON_PATCH");
	return value === void 0 || value.toLowerCase() === "true" || value === "1";
}
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
		/** Unset for a run sent to an `address`. */
		Object.defineProperty(this, "project_name", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		/** (beta) Set instead of `project_name` for an addressed run. */
		Object.defineProperty(this, "address", {
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
		this._resolveAddressing(config);
		this.execution_order ??= 1;
		this.child_execution_order ??= 1;
		if (!this.dotted_order) this._serialized_start_time = getMicrosecondPrecisionDatestring(this.start_time, this.execution_order);
		if (!this.id) this.id = uuid7FromTime(this._serialized_start_time ?? this.start_time);
		if (!this.trace_id) {
			if (this.parent_run) this.trace_id = this.parent_run.trace_id ?? this.id;
			else this.trace_id = this.id;
		}
		this.replicas = _ensureWriteReplicas(this.replicas);
		if (!this.dotted_order) {
			const { dottedOrder } = convertToDottedOrderFormat(this.start_time, this.id, this.execution_order);
			if (this.parent_run) this.dotted_order = this.parent_run.dotted_order + "." + dottedOrder;
			else this.dotted_order = dottedOrder;
		}
	}
	/** Falls back to the env; a bad env leaves the run untraced. */
	_resolveAddressing(config) {
		const address = checkAddress(config.address);
		const project = config.project_name || void 0;
		rejectConflicting(project, address);
		if (project || address) {
			this.project_name = project;
			this.address = address;
			return;
		}
		try {
			[this.project_name, this.address] = resolveFromEnv();
		} catch (e) {
			if (!(e instanceof EnvAddressError)) throw e;
			if (isEnvTracingEnabled(this.tracingEnabled)) logUntraced(e);
			this.project_name = void 0;
			this.address = void 0;
			this.tracingEnabled = false;
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
			address: this.address,
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
			address: run.address,
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
			for (let idx = 0; idx < segs.length; idx++) if (segs[idx].slice(-36) === parentId) {
				startIdx = idx;
				break;
			}
			if (startIdx !== null) {
				const trimmedSegs = segs.slice(startIdx + 1);
				run.dotted_order = trimmedSegs.join(".");
				if (trimmedSegs.length > 0) run.trace_id = trimmedSegs[0].slice(-36);
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
	/** A replica naming neither inherits the run tree's destination. */
	_replicaAddressing(replica) {
		const address = checkAddress(replica.address);
		if (replica.projectName != null) {
			rejectConflicting(replica.projectName, address);
			return [replica.projectName, void 0];
		}
		if (address) return [void 0, address];
		return [this.project_name, this.address];
	}
	_remapForProject(params) {
		const { projectName, address, primary, runtimeEnv, excludeChildRuns = true, reroot = false, distributedParentId, apiUrl, apiKey, workspaceId } = params;
		const baseRun = this._convertToCreate(this, runtimeEnv, excludeChildRuns);
		if (primary === void 0 && !this.replicas?.some((r) => r.primary === true) && projectName === this.project_name && address === this.address) return {
			...baseRun,
			session_name: projectName,
			address
		};
		const seed = projectName ?? address ?? "agent//";
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
				projectName: seed,
				apiUrl,
				apiKey,
				workspaceId
			});
			this._setReplicaTraceRoot(replicaKey, baseRun.id);
		}
		let ancestorRerootedTraceId;
		if (!reroot) {
			ancestorRerootedTraceId = (getContextVar(this, _REPLICA_TRACE_ROOTS_KEY) ?? {})[getReplicaKey({
				projectName: seed,
				apiUrl,
				apiKey,
				workspaceId
			})];
			if (ancestorRerootedTraceId) {
				baseRun.trace_id = ancestorRerootedTraceId;
				if (baseRun.dotted_order) {
					const segs = baseRun.dotted_order.split(".");
					let rootIdx = null;
					for (let idx = 0; idx < segs.length; idx++) if (segs[idx].slice(-36) === ancestorRerootedTraceId) {
						rootIdx = idx;
						break;
					}
					if (rootIdx !== null) baseRun.dotted_order = segs.slice(rootIdx).join(".");
				}
			}
		}
		if (primary) return {
			...baseRun,
			session_name: projectName,
			address
		};
		const oldId = baseRun.id;
		const newId = nonCryptographicUuid7Deterministic(oldId, seed);
		let newTraceId;
		if (baseRun.trace_id) newTraceId = nonCryptographicUuid7Deterministic(baseRun.trace_id, seed);
		else newTraceId = newId;
		let newParentId;
		if (baseRun.parent_run_id) newParentId = nonCryptographicUuid7Deterministic(baseRun.parent_run_id, seed);
		let newDottedOrder;
		if (baseRun.dotted_order) newDottedOrder = baseRun.dotted_order.split(".").map((seg) => {
			const remappedId = nonCryptographicUuid7Deterministic(seg.slice(-36), seed);
			return seg.slice(0, -36) + remappedId;
		}).join(".");
		return {
			...baseRun,
			id: newId,
			trace_id: newTraceId,
			parent_run_id: newParentId,
			dotted_order: newDottedOrder,
			session_name: projectName,
			address
		};
	}
	async postRun(excludeChildRuns = true) {
		if (this._awaitInputsOnPost) this.inputs = await this.inputs;
		try {
			const runtimeEnv = getRuntimeEnvironment();
			if (this.replicas && this.replicas.length > 0) for (const replica of this.replicas) {
				const { primary, apiKey, apiUrl, workspaceId, reroot, client: replicaClient } = replica;
				const [projectName, address] = this._replicaAddressing(replica);
				const runCreate = this._remapForProject({
					projectName,
					address,
					primary,
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
				warnOnce$1("Posting with excludeChildRuns=false is deprecated and will be removed in a future version.");
				for (const childRun of this.child_runs) await childRun.postRun(false);
			}
			this.child_runs = [];
		} catch (error) {
			console.error(`Error in postRun for run ${this.id}:`, error);
		}
	}
	/**
	* Patch the run tree to the API.
	*
	* @param options.excludeInputs - Whether to exclude inputs from the patch
	* request. Defaults to the value of `LANGSMITH_EXCLUDE_INPUTS_ON_PATCH`
	* (or its `LANGCHAIN_` equivalent), which itself defaults to `true`.
	* An explicit value overrides the environment variable for this call.
	*
	* Unless the environment variable is disabled, inputs added after the
	* initial `postRun()` are not persisted unless this option is explicitly set
	* to `false`.
	*/
	async patchRun(options) {
		const excludeInputs = options?.excludeInputs ?? getExcludeInputsOnPatch();
		if (this.replicas && this.replicas.length > 0) for (const replica of this.replicas) {
			const { primary, apiKey, apiUrl, workspaceId, updates, reroot, client: replicaClient } = replica;
			const [projectName, address] = this._replicaAddressing(replica);
			const runData = this._remapForProject({
				projectName,
				address,
				primary,
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
				address: runData.address,
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
			if (!excludeInputs) updatePayload.inputs = runData.inputs;
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
				session_name: this.project_name,
				address: this.address
			};
			if (!excludeInputs) runUpdate.inputs = this.inputs;
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
		let tracingEnabled = isEnvTracingEnabled();
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
			project_name: props.address ? void 0 : projectName
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
			if (baggage.project_name && baggage.address) {
				console.warn("Ignoring a `baggage` header that names both a project and an address.");
				return;
			}
			if (baggage.project_name) {
				config.project_name = baggage.project_name;
				delete config.address;
			} else if (baggage.address) {
				config.address = baggage.address;
				delete config.project_name;
			}
			config.replicas = baggage.replicas;
		}
		const runTree = new RunTree(config);
		runTree.distributedParentId = runTree.id;
		return runTree;
	}
	toHeaders(headers) {
		const result = {
			"langsmith-trace": this.dotted_order,
			baggage: new Baggage(this.extra?.metadata, this.tags, this.project_name, this.replicas, this.address).toHeader()
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
				if (item.project_name !== void 0 && item.project_name !== null && typeof item.project_name !== "string") {
					console.warn(`Invalid project_name type in LANGSMITH_RUNS_ENDPOINTS: expected string, got ${typeof item.project_name}`);
					continue;
				}
				if (item.primary !== void 0 && typeof item.primary !== "boolean") {
					console.warn(`Invalid primary type in LANGSMITH_RUNS_ENDPOINTS: expected boolean, got ${typeof item.primary}`);
					continue;
				}
				replicas.push({
					apiUrl: item.api_url.replace(/\/$/, ""),
					apiKey: item.api_key,
					projectName: item.project_name ?? void 0,
					primary: item.primary ?? void 0
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
	const ensured = replicas ? replicas.map((replica) => {
		if (Array.isArray(replica)) return {
			projectName: replica[0],
			updates: replica[1]
		};
		const address = checkAddress(replica.address);
		return address ? {
			...replica,
			address
		} : replica;
	}) : _getWriteReplicasFromEnv();
	if (ensured.filter((replica) => replica.primary === true).length > 1) throw new Error("Only one replica can be marked as primary.");
	return ensured;
}
function _checkEndpointEnvUnset(parsed) {
	if (Object.keys(parsed).length > 0 && getLangSmithEnvironmentVariable("ENDPOINT")) throw new ConflictingEndpointsError();
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/uuid.js
/**
* Compute the run ID used for a secondary tracing replica.
*
* @param runId - The original UUID v7 run ID.
* @param projectName - The secondary replica's destination project name.
* @returns The run ID used in the secondary replica destination.
*/
function computeRunIdForSecondaryReplica(runId, projectName) {
	if (typeof projectName !== "string" || projectName.length === 0) throw new Error("projectName must be a non-empty string");
	assertUuid(runId, "runId");
	const normalizedRunId = runId.toLowerCase();
	if (getUuidVersion(normalizedRunId) !== 7) throw new Error("runId must be a UUID v7");
	return nonCryptographicUuid7Deterministic(normalizedRunId, projectName);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/singletons/traceable.js
var MockAsyncLocalStorage = class {
	getStore() {}
	run(_, callback) {
		return callback();
	}
};
const TRACING_ALS_KEY = Symbol.for("ls:tracing_async_local_storage");
const mockAsyncLocalStorage = new MockAsyncLocalStorage();
var AsyncLocalStorageProvider = class {
	getInstance() {
		return globalThis[TRACING_ALS_KEY] ?? mockAsyncLocalStorage;
	}
	initializeGlobalInstance(instance) {
		if (globalThis[TRACING_ALS_KEY] === void 0) globalThis[TRACING_ALS_KEY] = instance;
	}
};
new AsyncLocalStorageProvider();
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/index.js
const __version__ = "0.10.8";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/privacy/constants.js
const MUTED_TRACE_CONTENT = "[LangSmith system notice: content omitted because tracing is muted.]";
const METADATA_MODE_RUN_CONFIG_FIELDS = [
	"client",
	"id",
	"name",
	"run_type",
	"project_name",
	"start_time",
	"end_time",
	"parent_run",
	"parent_run_id",
	"trace_id",
	"dotted_order",
	"distributedParentId"
];
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/privacy/run-tree.js
function mutedContent(role) {
	return { messages: [{
		role,
		content: MUTED_TRACE_CONTENT
	}] };
}
function statusOfRun(run) {
	const metadataStatus = run.extra?.metadata?.status;
	if (run.error != null || metadataStatus === "error") return "error";
	if (run.end_time != null || metadataStatus === "completed") return "completed";
	return "running";
}
function projectReplica(replica) {
	if (!replica || typeof replica !== "object") return replica;
	if (Array.isArray(replica)) return { projectName: replica[0] };
	const { updates: _updates, ...safe } = replica;
	return safe;
}
function extraForMode(metadata, integration, status) {
	return {
		metadata,
		toJSON() {
			const currentStatus = this.metadata?.status;
			const safeStatus = currentStatus === "running" || currentStatus === "completed" || currentStatus === "error" ? currentStatus : status;
			return { metadata: projectCodingAgentMetadata(this.metadata, integration, safeStatus) };
		}
	};
}
function configForMetadataMode(config, integration, privacyContext) {
	const source = config;
	const status = privacyContext?.status ?? (source.error != null ? "error" : source.end_time != null ? "completed" : "running");
	const originalExtra = source.extra;
	const safe = {};
	for (const key of METADATA_MODE_RUN_CONFIG_FIELDS) if (key in source && source[key] !== void 0) safe[key] = source[key];
	if (Array.isArray(source.replicas)) safe.replicas = source.replicas.map(projectReplica);
	if (Array.isArray(source.tags) && source.tags.length === 0) safe.tags = [];
	safe.inputs = mutedContent("user");
	safe.outputs = mutedContent("assistant");
	safe.extra = extraForMode(metadataForMode(originalExtra?.metadata, integration, "metadata", status) ?? {}, integration, status);
	return safe;
}
function sanitizeRunTree(run, integration) {
	const status = statusOfRun(run);
	const metadata = projectCodingAgentMetadata(run.extra?.metadata, integration, status);
	run.inputs = mutedContent("user");
	run.outputs = mutedContent("assistant");
	delete run.error;
	run.serialized = {};
	if (!Array.isArray(run.tags) || run.tags.length > 0) delete run.tags;
	delete run.reference_example_id;
	delete run.attachments;
	delete run.events;
	if (run.replicas) run.replicas = run.replicas.map(projectReplica);
	for (const child of run.child_runs ?? []) sanitizeRunTree(child, integration);
	run.extra = extraForMode(metadata, integration, status);
}
function protectRunTree(run, integration) {
	sanitizeRunTree(run, integration);
	const createChild = run.createChild.bind(run);
	run.createChild = (config) => protectRunTree(createChild(configForMetadataMode(config, integration)), integration);
	const postRun = run.postRun.bind(run);
	run.postRun = async (excludeChildRuns = true) => {
		sanitizeRunTree(run, integration);
		if (!excludeChildRuns) {
			const childRuns = [...run.child_runs];
			await postRun(true);
			for (const childRun of childRuns) await childRun.postRun(false);
			return;
		}
		return postRun(excludeChildRuns);
	};
	const patchRun = run.patchRun.bind(run);
	run.patchRun = (options) => {
		sanitizeRunTree(run, integration);
		return patchRun({
			excludeInputs: false,
			...options
		});
	};
	const end = run.end.bind(run);
	run.end = (outputs, error, endTime, metadata) => {
		const status = error != null ? "error" : endTime != null ? "completed" : statusOfRun(run);
		const safeMetadata = metadataForMode(metadata, integration, "metadata", status) ?? { status };
		return end(mutedContent("assistant"), void 0, endTime, safeMetadata);
	};
	const toJSON = run.toJSON.bind(run);
	run.toJSON = () => {
		sanitizeRunTree(run, integration);
		return toJSON();
	};
	return run;
}
function preserveFullModePatchInputs(run) {
	const createChild = run.createChild.bind(run);
	run.createChild = (config) => preserveFullModePatchInputs(createChild(config));
	const patchRun = run.patchRun.bind(run);
	run.patchRun = (options) => patchRun({
		excludeInputs: false,
		...options
	});
	return run;
}
function createCodingAgentRunTree(config, integration, mode = "full", privacyContext) {
	const routed = config.replicas === void 0 ? {
		...config,
		replicas: []
	} : config;
	const run = new RunTree(mode === "metadata" ? configForMetadataMode(routed, integration, privacyContext) : routed);
	return mode === "metadata" ? protectRunTree(run, integration) : preserveFullModePatchInputs(run);
}
function survivingCodingAgentPatchFields(projectedRun, fields) {
	return fields.filter((field) => {
		const descriptor = Object.getOwnPropertyDescriptor(projectedRun, field);
		return descriptor?.enumerable === true && "value" in descriptor && descriptor.value !== void 0;
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/env.js
function withoutEnvVariables(names, run) {
	const hidden = names.flatMap((name) => {
		const value = process.env[name];
		return value === void 0 ? [] : [[name, value]];
	});
	for (const [name] of hidden) delete process.env[name];
	try {
		return run();
	} finally {
		for (const [name, value] of hidden) process.env[name] = value;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/constants.js
const UPLOAD_ACCOUNT_FINGERPRINT_PREFIX = "account_";
const UPLOAD_DESTINATION_ID_PREFIX = "destination_";
const UPLOAD_CONTROL_CHARACTER_PATTERN = /\p{Cc}/u;
const UPLOAD_API_URL_TRAILING_SLASH_PATTERN = /\/$/;
const UPLOAD_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPLOAD_REPLICA_UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPLOAD_REPLICA_UUID_V5_NAMESPACE_BYTES = Buffer.from("6ba7b810-9dad-11d1-80b4-00c04fd430c8".replaceAll("-", ""), "hex");
const UPLOAD_REPLICA_UUID_V5_DOMAIN = "langchain-upload-replica-v1";
const UPLOAD_REPLICA_IDENTITY_UPDATE_FIELDS = /* @__PURE__ */ new Set([
	"id",
	"name",
	"run_type",
	"start_time",
	"parent_run_id",
	"session_id",
	"session_name",
	"trace_id",
	"dotted_order"
]);
const UPLOAD_REPLICA_PATCH_UPDATE_FIELDS = /* @__PURE__ */ new Set([
	"inputs",
	"outputs",
	"end_time",
	"extra",
	"tags",
	"error",
	"serialized",
	"reference_example_id",
	"events"
]);
const UPLOAD_PATCH_FIELDS = /* @__PURE__ */ new Set([
	"inputs",
	"outputs",
	"end_time",
	"error",
	"tags",
	"serialized",
	"events",
	"reference_example_id"
]);
const UPLOAD_REDACTED_FIELDS = ["inputs", "outputs"];
const UPLOAD_FAILED_MESSAGE = "LangSmith upload failed";
const UPLOAD_RETRYABLE_STATUSES = [
	408,
	409,
	429
];
const UPLOAD_NODE_RUNTIME = "node";
const UPLOAD_DOTTED_ORDER_SEGMENT = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{6})Z/;
const UPLOAD_REQUEST_TIMEOUT_MS = 15e3;
const UPLOAD_SEND_DEADLINE_MS = 2e4;
const UPLOAD_BATCH_LIMITS = {
	maxRuns: 100,
	maxBytes: 8388608
};
const UPLOAD_DEADLINE_MESSAGE = "LangSmith upload did not finish in time";
const UPLOAD_RECEIPT_MISSING_MESSAGE = "The upload returned no receipt";
const UPLOAD_ERROR_NAME = "UploadError";
const UPLOAD_UNKNOWN_DESTINATION_MESSAGE = "Unknown upload destination";
const UPLOAD_SAMPLING_RATE_VARIABLES = ["LANGSMITH_TRACING_SAMPLING_RATE", "LANGCHAIN_TRACING_SAMPLING_RATE"];
const UPLOAD_SAMPLING_HASH = "sha256";
const UPLOAD_DOTTED_ORDER_ROOT_ID = /^\d{8}T\d+Z([0-9a-f-]{36})/i;
const UPLOAD_SDK_API_URL_FIELD = "apiUrl";
const UPLOAD_BEARER_PATTERN = /^Bearer /u;
const UPLOAD_LOGIN_UNUSABLE_MESSAGE = "The LangSmith SDK would not send this destination's uploads with the CLI login on its own server, so nothing is uploaded to it";
const UPLOAD_KEY_UNUSABLE_MESSAGE = "The LangSmith SDK read this destination's API key as empty, so nothing is uploaded to it";
const UPLOAD_CREDENTIAL_REQUIRED_MESSAGE = "An API key or a LangSmith CLI login is required for each upload destination";
const UPLOAD_LOGIN_INVALID_MESSAGE = "Invalid upload login";
const UPLOAD_LOGIN_FIELD_NAMES = {
	configPath: "login config path",
	profile: "login profile",
	workspaceId: "login workspace ID"
};
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/client.js
const rejectedAuthorizations = /* @__PURE__ */ new WeakMap();
function createUploadClient(options) {
	const { apiKey, apiUrl, workspaceId, login, anonymizer, redactedFields } = options;
	const config = {
		...login === void 0 ? {
			apiKey: apiKey ?? "",
			workspaceId: workspaceId ?? ""
		} : {},
		apiUrl,
		autoBatchTracing: false,
		manualFlushMode: true,
		timeout_ms: UPLOAD_REQUEST_TIMEOUT_MS,
		callerOptions: { maxRetries: 0 },
		disablePromptCache: true,
		debug: false,
		omitTracedRuntimeInfo: true,
		tracingMode: "langsmith",
		...anonymizer === void 0 ? {} : {
			anonymizer,
			hideMetadata: anonymizer
		},
		...redactedFields?.includes("inputs") ? { hideInputs: false } : {},
		...redactedFields?.includes("outputs") ? { hideOutputs: false } : {},
		fetchImplementation: async (input, init) => {
			const response = await fetch(input, init);
			if (response.status === 401) rejectedAuthorizations.set(client, new Headers(init?.headers).get("Authorization") ?? "");
			return response;
		}
	};
	const client = withoutEnvVariables(LOGIN_API_KEY_VARIABLES, () => new Client(config));
	return client;
}
function takeRejectedAccessToken(client) {
	const authorization = rejectedAuthorizations.get(client);
	rejectedAuthorizations.delete(client);
	return authorization?.replace(UPLOAD_BEARER_PATTERN, "") || void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/auth/credential.js
function resolveUploadCredential(options = {}) {
	const env = options.env ?? process.env;
	const workspaceId = sdkSetting(options.workspaceId);
	const workspace = workspaceId ? { workspaceId } : {};
	const configuredUrl = sdkSetting(options.apiUrl);
	const apiUrl = options.apiUrlIsDefault ? void 0 : configuredUrl;
	const apiKey = sdkSetting(options.apiKey);
	if (apiKey !== void 0) return keyCredential(apiKey, configuredUrl, workspace);
	const login = loginCredential(env, apiUrl, workspace);
	if (login.kind === "login") return login;
	const envKey = LOGIN_API_KEY_VARIABLES.map((name) => sdkSetting(env[name])).find(Boolean);
	return envKey === void 0 ? login : keyCredential(envKey, configuredUrl, workspace);
}
function keyCredential(apiKey, apiUrl, workspace) {
	return {
		kind: "api-key",
		apiKey,
		apiUrl: apiUrl ?? "https://api.smith.langchain.com",
		...workspace
	};
}
function loginCredential(env, apiUrl, workspace) {
	const profile = readLoginProfile(env);
	if (profile === void 0) return {
		kind: "none",
		reason: LOGIN_NONE_REASON
	};
	if (apiUrl !== void 0 && !sameServer(apiUrl, profile.apiUrl)) return {
		kind: "none",
		reason: fillTemplate(LOGIN_ENDPOINT_MISMATCH_REASON, {
			loginUrl: profile.apiUrl,
			apiUrl
		})
	};
	const { configPath, profile: name, workspaceId: loginWorkspace } = profile;
	return {
		kind: "login",
		login: {
			configPath,
			profile: name,
			...loginWorkspace === void 0 ? {} : { workspaceId: loginWorkspace }
		},
		apiUrl: apiUrl ?? profile.apiUrl,
		...workspace
	};
}
function refusedLoginReplicas(replicas, apiUrl) {
	const refused = (replicas ?? []).filter((replica) => sdkSetting(replica.apiKey) === void 0 && replica.apiUrl !== void 0).map(({ apiUrl: url }) => url).filter((url) => !sameServer(url, apiUrl));
	return refused.length === 0 ? void 0 : fillTemplate(LOGIN_REPLICA_REFUSED_REASON, {
		urls: refused.join(", "),
		apiUrl
	});
}
function loginReplicaRefusal(replicas, apiUrl) {
	const configured = replicas ?? [];
	return configured.some((replica) => sdkSetting(replica.apiKey) !== void 0 || replica.apiUrl === void 0 || sameServer(replica.apiUrl, apiUrl)) ? void 0 : refusedLoginReplicas(configured, apiUrl);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/destination-identity.js
function resolveUploadDestinationIdentities(options) {
	if (!Array.isArray(options.destinations) || options.destinations.length === 0) throw new TypeError("At least one upload destination is required");
	if (options.replicas !== void 0 && !Array.isArray(options.replicas)) throw new TypeError("Upload replicas must be an array");
	if (typeof options.redact !== "boolean") throw new TypeError("A redaction setting is required");
	const replicas = options.replicas ?? [];
	if (replicas.length > 0 && options.destinations.length !== 1) throw new TypeError("A replica upload requires exactly one primary destination");
	const primary = options.destinations[0];
	const routedReplicas = primary && typeof primary === "object" && !hasApiKey(primary.apiKey) ? replicas.filter((replica) => !replica || typeof replica !== "object" || hasApiKey(replica.apiKey) || primary.login !== void 0 && (replica.apiUrl === void 0 || sameServer(replica.apiUrl, primary.apiUrl))) : replicas;
	if (replicas.length > 0 && routedReplicas.length === 0 && primary?.login !== void 0) throw new TypeError(refusedLoginReplicas(replicas, primary.apiUrl));
	const primaryProjectName = routedReplicas.length === 0 || primary === void 0 ? void 0 : normalizeRequiredText(primary.projectName, "project name");
	const destinations = routedReplicas.length === 0 ? options.destinations.map((destination) => resolveDestination(destination)) : routedReplicas.map((replica) => resolveReplicaDestination(replica, primary, primaryProjectName));
	const ids = /* @__PURE__ */ new Set();
	for (const destination of destinations) {
		if (ids.has(destination.id)) throw new TypeError("Upload destinations must be unique");
		ids.add(destination.id);
	}
	const fingerprints = destinations.map(({ id }) => id).toSorted();
	return {
		accountFingerprint: `${UPLOAD_ACCOUNT_FINGERPRINT_PREFIX}${fingerprint(JSON.stringify({
			destinations: fingerprints,
			redact: options.redact,
			redactExtraRules: options.redactExtraRules ?? null
		}))}`,
		destinations
	};
}
function resolveDestination(config, sourceProjectName, updates, replicaProjectName) {
	if (!config || typeof config !== "object") throw new TypeError("Invalid upload destination");
	const login = hasApiKey(config.apiKey) ? void 0 : normalizeLogin(config.login);
	if (login === void 0 && !hasApiKey(config.apiKey)) throw new TypeError(UPLOAD_CREDENTIAL_REQUIRED_MESSAGE);
	const apiUrl = normalizeApiUrl(config.apiUrl);
	const projectName = normalizeRequiredText(config.projectName, "project name");
	const workspaceId = config.workspaceId === void 0 ? void 0 : sdkSetting(normalizeRequiredText(config.workspaceId, "workspace ID"));
	const identity = JSON.stringify({
		...login === void 0 ? { apiKey: config.apiKey } : { login },
		apiUrl,
		workspaceId: workspaceId ?? null,
		...sourceProjectName === void 0 ? {} : {
			projectName: replicaProjectName ?? null,
			updates: updates ?? null
		}
	});
	return {
		id: `${UPLOAD_DESTINATION_ID_PREFIX}${fingerprint(identity)}`,
		...login === void 0 ? { apiKey: config.apiKey } : { login },
		apiUrl,
		projectName,
		...workspaceId === void 0 ? {} : { workspaceId },
		...sourceProjectName === void 0 ? {} : { sourceProjectName },
		...updates === void 0 ? {} : { updates }
	};
}
function resolveReplicaDestination(replica, primary, primaryProjectName) {
	if (!replica || typeof replica !== "object") throw new TypeError("Invalid upload replica");
	const updates = snapshotReplicaUpdates(replica.updates);
	const workspaceId = replica.workspaceId ?? primary.workspaceId;
	const ownKey = hasApiKey(replica.apiKey);
	const apiKey = ownKey ? replica.apiKey : primary.apiKey;
	return resolveDestination({
		...apiKey === void 0 ? {} : { apiKey },
		...!ownKey && primary.login ? { login: primary.login } : {},
		apiUrl: replica.apiUrl ?? primary.apiUrl,
		projectName: replica.projectName ?? primary.projectName,
		...workspaceId === void 0 ? {} : { workspaceId }
	}, primaryProjectName, updates, replica.projectName === void 0 ? null : normalizeRequiredText(replica.projectName, "project name"));
}
function snapshotReplicaUpdates(value) {
	if (value === void 0) return void 0;
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Replica updates must be an object");
	let snapshot;
	try {
		snapshot = JSON.parse(JSON.stringify(value));
	} catch {
		throw new TypeError("Replica updates must be JSON serializable");
	}
	if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new TypeError("Replica updates must be an object");
	const updates = snapshot;
	for (const field of Object.keys(updates)) {
		if (UPLOAD_REPLICA_IDENTITY_UPDATE_FIELDS.has(field)) throw new TypeError("Replica updates cannot override run identity");
		if (!UPLOAD_REPLICA_PATCH_UPDATE_FIELDS.has(field)) throw new TypeError("Unsupported replica update field");
		if (field === "extra" && (updates[field] === null || typeof updates[field] !== "object" || Array.isArray(updates[field]))) throw new TypeError("Replica extra updates must be an object");
	}
	return canonicalJsonObject(updates, "Replica updates");
}
function normalizeApiUrl(value) {
	if (typeof value !== "string" || value.trim().length === 0) throw new TypeError("An API endpoint is required for each upload destination");
	let endpoint;
	try {
		endpoint = new URL(value);
	} catch {
		throw new TypeError("Invalid upload API endpoint");
	}
	if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:" || endpoint.username.length > 0 || endpoint.password.length > 0 || endpoint.search.length > 0 || endpoint.hash.length > 0) throw new TypeError("Invalid upload API endpoint");
	return endpoint.toString().replace(UPLOAD_API_URL_TRAILING_SLASH_PATTERN, "");
}
function normalizeRequiredText(value, name) {
	if (typeof value !== "string" || value.trim().length === 0 || UPLOAD_CONTROL_CHARACTER_PATTERN.test(value)) throw new TypeError(`Invalid upload ${name}`);
	return value.trim();
}
function normalizeLogin(login) {
	if (login === void 0) return void 0;
	if (!login || typeof login !== "object") throw new TypeError(UPLOAD_LOGIN_INVALID_MESSAGE);
	const workspaceId = login.workspaceId === void 0 ? void 0 : sdkSetting(normalizeRequiredText(login.workspaceId, UPLOAD_LOGIN_FIELD_NAMES.workspaceId));
	return {
		configPath: normalizeRequiredText(login.configPath, UPLOAD_LOGIN_FIELD_NAMES.configPath),
		profile: normalizeRequiredText(login.profile, UPLOAD_LOGIN_FIELD_NAMES.profile),
		...workspaceId === void 0 ? {} : { workspaceId }
	};
}
function hasApiKey(value) {
	return sdkSetting(value) !== void 0;
}
function fingerprint(value) {
	return createHash("sha256").update(value).digest("hex").slice(0, 32);
}
//#endregion
//#region ../../node_modules/.pnpm/langsmith@0.10.8_@opentelemetry+api@1.9.1_@opentelemetry+exporter-trace-otlp-proto@0.21_74c043658451e37676b684cee2e148d7/node_modules/langsmith/dist/anonymizer/index.js
function extractStringNodes(data, options) {
	const parsedOptions = {
		...options,
		maxDepth: options.maxDepth ?? 10
	};
	const queue = [[
		data,
		0,
		"",
		null,
		""
	]];
	let nextId = 0;
	const result = [];
	let head = 0;
	while (head < queue.length) {
		const [value, depth, path, parent, key] = queue[head++];
		if (typeof value === "string") result.push({
			value,
			path,
			parent,
			key,
			_id: nextId++
		});
		else if (Array.isArray(value)) {
			if (depth >= parsedOptions.maxDepth) continue;
			for (let i = 0; i < value.length; i++) queue.push([
				value[i],
				depth + 1,
				`${path}[${i}]`,
				value,
				String(i)
			]);
		} else if (typeof value === "object" && value != null) {
			if (depth >= parsedOptions.maxDepth) continue;
			for (const [k, nestedValue] of Object.entries(value)) queue.push([
				nestedValue,
				depth + 1,
				path ? `${path}.${k}` : k,
				value,
				k
			]);
		}
	}
	return result;
}
function deepClone(data) {
	return JSON.parse(JSON.stringify(data));
}
function createAnonymizer(replacer, options) {
	return (data) => {
		let mutateValue = deepClone(data);
		const nodes = extractStringNodes(mutateValue, { maxDepth: options?.maxDepth });
		const processor = Array.isArray(replacer) ? (() => {
			const replacers = replacer.map(({ pattern, type, replace }) => {
				if (type != null && type !== "pattern") throw new Error("Invalid anonymizer type");
				return [typeof pattern === "string" ? new RegExp(pattern, "g") : pattern, replace ?? "[redacted]"];
			});
			if (replacers.length === 0) throw new Error("No replacers provided");
			return { maskNodes: (nodes) => {
				return nodes.reduce((memo, item) => {
					const newValue = replacers.reduce((value, [regex, replace]) => {
						const result = value.replace(regex, replace);
						regex.lastIndex = 0;
						return result;
					}, item.value);
					if (newValue !== item.value) memo.push({
						...item,
						value: newValue
					});
					return memo;
				}, []);
			} };
		})() : typeof replacer === "function" ? { maskNodes: (nodes) => nodes.reduce((memo, item) => {
			const newValue = replacer(item.value, item.path);
			if (newValue !== item.value) memo.push({
				...item,
				value: newValue
			});
			return memo;
		}, []) } : replacer;
		const nodesById = /* @__PURE__ */ new Map();
		for (const node of nodes) nodesById.set(node._id, node);
		const toUpdate = processor.maskNodes(nodes);
		for (const node of toUpdate) if (node.path === "") mutateValue = node.value;
		else {
			const asInternal = node;
			const internal = asInternal._id !== void 0 ? nodesById.get(asInternal._id) : nodes.find((n) => n.path === node.path);
			if (internal) internal.parent[internal.key] = node.value;
		}
		return mutateValue;
	};
}
/**
* Replacement token written in place of detected secrets by
* {@link DEFAULT_SECRET_RULES} / {@link createSecretAnonymizer}.
*/
const SECRET_PLACEHOLDER = "[SECRET_DETECTED]";
/**
* A curated, high-precision rule set for detecting common credentials in
* traced data (prompts, tool inputs/outputs, file contents, shell commands).
*
* Designed to favor *low false positives* over exhaustive coverage:
*  - Provider rules are anchored to well-known key prefixes.
*  - Structural rules only fire when a sensitive *name* (api_key, token,
*    password, …) is paired with an assignment/separator, so ordinary code,
*    UUIDs, and hashes are left intact.
*
* This is NOT a port of gitleaks/secretlint; pattern shapes are drawn from
* those projects (and provider docs) as a reference only. Every rule sets an
* explicit `replace` because {@link createAnonymizer}'s default is
* `[redacted]`, whereas the shared token here is {@link SECRET_PLACEHOLDER}.
*
* Patterns are written to port 1:1 to the Python SDK preset (no lookbehind).
*/
const DEFAULT_SECRET_RULES = [
	{
		pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /sk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /sk-[A-Za-z0-9]{32,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /lsv2_(?:pt|sk)_[A-Za-z0-9]{32,}(?:_[A-Za-z0-9]+)*/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /ls__[A-Za-z0-9]{16,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /github_pat_[A-Za-z0-9_]{82}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /glpat-[A-Za-z0-9_-]{20,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /\b(?:AKIA|ASIA|ABIA|ACCA|A3T[A-Z0-9])[0-9A-Z]{16}\b/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /AIza[0-9A-Za-z_-]{35}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /ya29\.[0-9A-Za-z_-]+/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /xapp-\d-[A-Za-z0-9-]{10,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /npm_[A-Za-z0-9]{36}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /pypi-AgEIcHlwaS[A-Za-z0-9_-]{50,}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----[\s\S]+?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY(?: BLOCK)?-----/g,
		replace: SECRET_PLACEHOLDER
	},
	{
		pattern: /\b([A-Za-z0-9_.-]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|AUTH[_-]?TOKEN|CLIENT[_-]?SECRET)(?![A-Za-z0-9])(?:[_.-][A-Za-z0-9]+)*["']?\s*[:=]\s*["']?)(?:(?:bearer|token|basic)\s+)?[^\s"'&;]{6,}/gi,
		replace: `$1${SECRET_PLACEHOLDER}`
	},
	{
		pattern: /\b(authorization|x-api-key|x-auth-token)(["']?\s*[:=]\s*["']?)(bearer\s+|token\s+|basic\s+)?[A-Za-z0-9._~+/-]{8,}=*/gi,
		replace: `$1$2$3${SECRET_PLACEHOLDER}`
	},
	{
		pattern: /\b(Bearer\s+)[A-Za-z0-9._~+/-]{10,}=*/gi,
		replace: `$1${SECRET_PLACEHOLDER}`
	},
	{
		pattern: /\b([a-z][a-z0-9+.-]*:\/\/[^:@/\s]*:)[^@/\s]+(@)/gi,
		replace: `$1${SECRET_PLACEHOLDER}$2`
	}
];
/**
* Build an anonymizer pre-loaded with {@link DEFAULT_SECRET_RULES} suitable for
* passing to `new Client({ anonymizer })`. It redacts detected secrets from run
* inputs, outputs, and metadata client-side, before they are uploaded.
*
* @param options.extraRules - Additional rules appended after the defaults.
* @param options.maxDepth - Max recursion depth (default 24; higher than
*   `createAnonymizer`'s default of 10 because traced payloads nest deeply,
*   e.g. `messages[].content[].args`).
*
* @example
* ```ts
* import { Client } from "langsmith";
* import { createSecretAnonymizer } from "langsmith/anonymizer";
*
* const client = new Client({ anonymizer: createSecretAnonymizer() });
* ```
*/
function createSecretAnonymizer(options) {
	return createAnonymizer([...DEFAULT_SECRET_RULES, ...options?.extraRules ?? []], { maxDepth: options?.maxDepth ?? 24 });
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/redaction.js
function createUploadAnonymizer(enabled, extraRules) {
	if (!enabled) return void 0;
	const normalizedRules = extraRules?.map(({ pattern, replace }) => ({
		pattern,
		...replace === void 0 ? {} : { replace }
	}));
	return createSecretAnonymizer(normalizedRules === void 0 ? {} : { extraRules: normalizedRules });
}
function redactSdkOmittedFields(payload, anonymizer) {
	if (!anonymizer) return;
	if (payload["tags"] !== void 0) payload["tags"] = anonymizer(payload["tags"]);
	if (payload["serialized"] !== void 0) payload["serialized"] = anonymizer(payload["serialized"]);
	if (payload["events"] !== void 0) payload["events"] = anonymizer(payload["events"]);
}
function normalizedRedactedFields(value) {
	if (value === void 0) return [];
	if (!Array.isArray(value) || value.some((field) => !UPLOAD_REDACTED_FIELDS.includes(field)) || new Set(value).size !== value.length) throw new TypeError("Redacted fields must be unique inputs or outputs");
	return UPLOAD_REDACTED_FIELDS.filter((field) => value.includes(field));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/destinations.js
function resolveUploadDestinations(options) {
	const resolved = resolveUploadDestinationIdentities(options);
	const destinations = resolved.destinations.map((destination) => {
		const anonymizer = createUploadAnonymizer(options.redact, options.redactExtraRules);
		const client = createUploadClient({
			...destination,
			...anonymizer === void 0 ? {} : { anonymizer }
		});
		if (destination.login === void 0 && Reflect.get(client, "apiKey") === void 0) throw new TypeError(UPLOAD_KEY_UNUSABLE_MESSAGE);
		if (destination.login !== void 0 && !usesLogin(destination.login, client)) throw new TypeError(UPLOAD_LOGIN_UNUSABLE_MESSAGE);
		return {
			...destination,
			...anonymizer === void 0 ? {} : { anonymizer },
			client
		};
	});
	return {
		accountFingerprint: resolved.accountFingerprint,
		destinations
	};
}
function usesLogin(login, client) {
	if (Reflect.get(client, "apiKey") !== void 0) return false;
	const loginUrl = readProfileAt(login.configPath, login.profile)?.apiUrl;
	const clientUrl = Reflect.get(client, UPLOAD_SDK_API_URL_FIELD);
	return loginUrl === void 0 || typeof clientUrl === "string" && sameServer(clientUrl, loginUrl);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/client-cache.js
function createUploadClientCache() {
	const clientsByMode = /* @__PURE__ */ new Map();
	return { forSubmission(destination, submission) {
		const redactedFields = normalizedRedactedFields(submission.redactedFields).filter((field) => submission.privacyMode === "full" && !(submission.operation === "patch" && field === "outputs" && Object.hasOwn(destination.updates ?? {}, "outputs")));
		let client = destination.client;
		if (redactedFields.length > 0) {
			const key = JSON.stringify([destination.id, redactedFields]);
			const previous = clientsByMode.get(key);
			client = previous ?? createUploadClient({
				...destination,
				redactedFields
			});
			if (previous === void 0) clientsByMode.set(key, client);
		}
		return client;
	} };
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/errors.js
var UploadError = class extends Error {
	retryable;
	status;
	loginRejected;
	constructor(cause, login = false) {
		super(UPLOAD_FAILED_MESSAGE, { cause });
		this.name = UPLOAD_ERROR_NAME;
		const status = failureStatus(cause);
		this.status = status;
		this.loginRejected = login && status === 401;
		this.retryable = status === void 0 || status >= 500 || UPLOAD_RETRYABLE_STATUSES.includes(status);
	}
};
function isAlreadyReceived(cause) {
	return failureStatus(cause) === 409 && describe(cause).includes("already received");
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/runtime-metadata.js
function applyRuntimeMetadata(payload, privacyMode) {
	if (privacyMode !== "full") return;
	const added = buildCodingAgentRuntimeMetadata({
		env: process.env,
		runtime: "Bun" in globalThis ? "bun" : UPLOAD_NODE_RUNTIME,
		sdkVersion: __version__
	});
	const extra = payload.extra ?? {};
	const metadata = {
		...added.metadata,
		...extra["metadata"]
	};
	payload.extra = {
		...extra,
		runtime: {
			...added.runtime,
			...extra["runtime"]
		},
		metadata
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/replica-identifiers.js
function contextForDestination(context, destination) {
	if (destination.sourceProjectName === void 0) return context;
	return remapReplicaRunContext(context, destination.sourceProjectName, destination.projectName);
}
function runIdForDestination(runId, destination) {
	if (destination.sourceProjectName === void 0 || destination.sourceProjectName === destination.projectName) return runId;
	return remapReplicaRunId(runId, destination.projectName);
}
function remapReplicaRunContext(context, sourceProjectName, destinationProjectName) {
	if (sourceProjectName === destinationProjectName) return context;
	return {
		...context,
		id: remapReplicaRunId(context.id, destinationProjectName),
		...context.parent_run_id === void 0 ? {} : { parent_run_id: remapReplicaRunId(context.parent_run_id, destinationProjectName) },
		...context.trace_id === void 0 ? {} : { trace_id: remapReplicaRunId(context.trace_id, destinationProjectName) },
		...context.dotted_order === void 0 ? {} : { dotted_order: remapReplicaDottedOrder(context.dotted_order, destinationProjectName) }
	};
}
function remapReplicaRunId(runId, projectName) {
	if (!UPLOAD_UUID_PATTERN.test(runId)) throw new TypeError("Replica run IDs must be UUIDs");
	if (UPLOAD_REPLICA_UUID_V7_PATTERN.test(runId)) return computeRunIdForSecondaryReplica(runId, projectName);
	const name = JSON.stringify([
		UPLOAD_REPLICA_UUID_V5_DOMAIN,
		projectName,
		runId.toLowerCase()
	]);
	const hash = createHash("sha1").update(UPLOAD_REPLICA_UUID_V5_NAMESPACE_BYTES).update(name).digest();
	hash[6] = hash[6] & 15 | 80;
	hash[8] = hash[8] & 63 | 128;
	const value = hash.subarray(0, 16).toString("hex");
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
function remapReplicaDottedOrder(dottedOrder, projectName) {
	return dottedOrder.split(".").map((segment) => {
		const id = segment.slice(-36);
		return `${segment.slice(0, -36)}${remapReplicaRunId(id, projectName)}`;
	}).join(".");
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/replica-updates.js
function applyReplicaPatchUpdates(payload, destination, privacyMode) {
	if (privacyMode !== "full" || destination.updates === void 0) return;
	const mutablePayload = payload;
	for (const [field, value] of Object.entries(destination.updates)) {
		if (field === "inputs" || field === "end_time" && payload.end_time === void 0) continue;
		if (field === "extra") mutablePayload.extra = mergeReplicaExtra(mutablePayload.extra, value);
		else mutablePayload[field] = structuredClone(value);
	}
}
function mergeReplicaExtra(baseValue, updateValue) {
	const baseExtra = isPlainRecord(baseValue) ? baseValue : {};
	const updateExtra = isPlainRecord(updateValue) ? structuredClone(updateValue) : {};
	const baseMetadata = isPlainRecord(baseExtra["metadata"]) ? baseExtra["metadata"] : {};
	const updateMetadata = isPlainRecord(updateExtra["metadata"]) ? updateExtra["metadata"] : {};
	return {
		...baseExtra,
		...updateExtra,
		metadata: {
			...updateMetadata,
			...baseMetadata
		}
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/deadline.js
async function withDeadline(work) {
	let timer;
	const expired = new Promise((_resolve, reject) => {
		timer = setTimeout(() => reject(/* @__PURE__ */ new Error(UPLOAD_DEADLINE_MESSAGE)), UPLOAD_SEND_DEADLINE_MS);
	});
	try {
		return await Promise.race([work, expired]);
	} finally {
		clearTimeout(timer);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/sampling.js
function samplingRate(environment) {
	for (const name of UPLOAD_SAMPLING_RATE_VARIABLES) {
		const value = environment[name]?.trim();
		if (value === void 0 || value === "") continue;
		const rate = Number(value);
		return Number.isFinite(rate) ? rate : void 0;
	}
}
function isSampled(item, rate) {
	if (rate === void 0 || rate >= 1) return true;
	const traceId = traceIdOf(item.submission.run);
	return createHash(UPLOAD_SAMPLING_HASH).update(traceId.toLowerCase()).digest().readUIntBE(0, 6) / 2 ** 48 < rate;
}
function traceIdOf(run) {
	return run.trace_id ?? UPLOAD_DOTTED_ORDER_ROOT_ID.exec(run.dotted_order ?? "")?.[1] ?? run.id;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/timestamps.js
function startTimeFromDottedOrder(dottedOrder) {
	if (typeof dottedOrder !== "string") return void 0;
	const own = dottedOrder.slice(dottedOrder.lastIndexOf(".") + 1);
	const match = UPLOAD_DOTTED_ORDER_SEGMENT.exec(own);
	if (match === null) return void 0;
	const [, year, month, day, hour, minute, second, micros] = match;
	return `${year}-${month}-${day}T${hour}:${minute}:${second}.${micros}Z`;
}
function startTimeText(supplied, dottedOrder) {
	if (typeof supplied === "string") return supplied;
	if (typeof supplied === "number") return new Date(supplied).toISOString();
	return startTimeFromDottedOrder(dottedOrder);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/upload.js
function createLangSmithUploadWriter(options) {
	const resolved = resolveUploadDestinations(options);
	const destinations = resolved.destinations.map(({ id }) => Object.freeze({ id }));
	const byId = new Map(resolved.destinations.map((destination) => [destination.id, destination]));
	const clients = createUploadClientCache();
	const rate = samplingRate(process.env);
	const routes = Object.freeze(Object.fromEntries(resolved.destinations.map(({ id, projectName, sourceProjectName }) => [id, Object.freeze({
		projectName,
		...sourceProjectName === void 0 ? {} : { sourceProjectName }
	})])));
	async function sendBatch(items, destinationId) {
		const configured = byId.get(destinationId);
		if (!configured) throw new TypeError(UPLOAD_UNKNOWN_DESTINATION_MESSAGE);
		const prepared = items.map(({ submission, route }) => prepareItem(clients, route === void 0 || options.projectLocked ? configured : routedDestination(configured, route), submission));
		const clientOptions = {
			apiUrl: configured.apiUrl,
			...configured.workspaceId === void 0 ? {} : { workspaceId: configured.workspaceId }
		};
		let uploaded = false;
		for (const [client, group] of segmentByClient(prepared)) {
			const sampled = group.filter((item) => isSampled(item, rate));
			try {
				await withDeadline(client.batchIngestRuns(ingestFor(sampled), clientOptions)).catch(ignoreAlreadyReceived);
				uploaded ||= sampled.length > 0;
			} catch (error) {
				const failure = new UploadError(error, configured.login !== void 0);
				const sent = takeRejectedAccessToken(client);
				if (failure.loginRejected && configured.login !== void 0) recordExpiredLogin(configured.login, sent && credentialHash(sent), options.storageRoot);
				if (configured.apiKey !== void 0 && failure.status === 401) recordRejectedKey({
					apiKey: configured.apiKey,
					apiUrl: configured.apiUrl
				}, options.storageRoot);
				throw failure;
			}
		}
		if (uploaded && configured.login !== void 0) {
			clearLoginExpiry(configured.login, options.storageRoot);
			clearRejectedKey(options.storageRoot);
		} else if (uploaded && configured.apiKey !== void 0) clearRejectedKey(options.storageRoot, {
			apiKey: configured.apiKey,
			apiUrl: configured.apiUrl
		});
		return prepared.map(({ submission, operation }) => ({
			destinationId,
			runId: submission.run.id,
			operation
		}));
	}
	return Object.freeze({
		accountFingerprint: resolved.accountFingerprint,
		destinations: Object.freeze(destinations),
		routes,
		batchLimits: UPLOAD_BATCH_LIMITS,
		sendBatch,
		async send(submission, destinationId, route) {
			const [receipt] = await sendBatch([route === void 0 ? { submission } : {
				submission,
				route
			}], destinationId);
			if (receipt === void 0) throw new Error(UPLOAD_RECEIPT_MISSING_MESSAGE);
			return receipt;
		}
	});
}
function routedDestination(destination, route) {
	const routed = {
		...destination,
		projectName: route.projectName
	};
	if (route.sourceProjectName === void 0) delete routed.sourceProjectName;
	else routed.sourceProjectName = route.sourceProjectName;
	return routed;
}
function prepareItem(clients, destination, submission) {
	validateSubmission(submission);
	const client = clients.forSubmission(destination, submission);
	const payload = submission.operation === "post" ? preparePostRunPayload(submission, destination) : preparePatchRunPayload(submission, destination);
	if (submission.operation === "patch") applyReplicaPatchUpdates(payload, destination, submission.privacyMode);
	applyRuntimeMetadata(payload, submission.privacyMode);
	redactSdkOmittedFields(payload, destination.anonymizer);
	return {
		client,
		submission,
		payload,
		destination,
		operation: submission.operation === "post" ? "posted" : "patched"
	};
}
function segmentByClient(items) {
	const segments = [];
	for (const item of items) {
		const last = segments.at(-1);
		if (last !== void 0 && last[0] === item.client) last[1].push(item);
		else segments.push([item.client, [item]]);
	}
	return segments;
}
function ingestFor(items) {
	const runCreates = [];
	const runUpdates = [];
	for (const { payload, submission, destination, operation } of items) if (operation === "posted") runCreates.push({
		...payload,
		session_name: destination.projectName
	});
	else {
		const id = runIdForDestination(submission.run.id, destination);
		runUpdates.push({
			...payload,
			id
		});
	}
	return {
		runCreates,
		runUpdates
	};
}
function ignoreAlreadyReceived(error) {
	if (!isAlreadyReceived(error)) throw error;
}
function runConfig(context, submission, destination) {
	const metadata = buildCodingAgentMetadata(submission.metadata);
	const destinationContext = contextForDestination(context, destination);
	return {
		id: destinationContext.id,
		name: destinationContext.name,
		run_type: destinationContext.run_type,
		project_name: destination.projectName,
		inputs: {},
		extra: { metadata },
		client: destination.client,
		...destinationContext.start_time === void 0 ? {} : { start_time: destinationContext.start_time },
		...destinationContext.parent_run_id === void 0 ? {} : { parent_run_id: destinationContext.parent_run_id },
		...destinationContext.trace_id === void 0 ? {} : { trace_id: destinationContext.trace_id },
		...destinationContext.dotted_order === void 0 ? {} : { dotted_order: destinationContext.dotted_order }
	};
}
function preparePostRunPayload(submission, destination) {
	const source = submission.run;
	const config = runConfig(source, submission, destination);
	config.inputs = source.inputs;
	if (source.end_time !== void 0) config.end_time = source.end_time;
	if (source.outputs !== void 0) config.outputs = source.outputs;
	if (source.tags !== void 0) config.tags = source.tags;
	if (source.error !== void 0) config.error = source.error;
	if (source.serialized !== void 0) config.serialized = source.serialized;
	if (source.reference_example_id !== void 0) config.reference_example_id = source.reference_example_id;
	const run = createCodingAgentRunTree(config, submission.integration, submission.privacyMode, submission.privacyContext);
	if (source.events !== void 0) run.events = source.events;
	const create = JSON.parse(JSON.stringify(run.toJSON()));
	const startTime = startTimeText(source.start_time, create.dotted_order);
	if (startTime !== void 0) create.start_time = startTime;
	return create;
}
function preparePatchRunPayload(submission, destination) {
	const config = runConfig(submission.run, submission, destination);
	for (const field of submission.patch.fields) if (field === "inputs") config.inputs = submission.patch.values.inputs;
	else if (field === "outputs") config.outputs = submission.patch.values.outputs;
	else if (field === "end_time") config.end_time = submission.patch.values.end_time;
	else if (field === "error") config.error = submission.patch.values.error;
	else if (field === "tags") config.tags = submission.patch.values.tags;
	else if (field === "serialized") config.serialized = submission.patch.values.serialized;
	else if (field === "reference_example_id") config.reference_example_id = submission.patch.values.reference_example_id;
	const run = createCodingAgentRunTree(config, submission.integration, submission.privacyMode, submission.privacyContext);
	if (submission.patch.fields.includes("events")) run.events = submission.patch.values.events;
	const snapshot = JSON.parse(JSON.stringify(run.toJSON()));
	const update = {
		extra: snapshot["extra"],
		session_name: destination.projectName,
		trace_id: snapshot["trace_id"],
		dotted_order: snapshot["dotted_order"],
		...snapshot["parent_run_id"] === void 0 ? {} : { parent_run_id: snapshot["parent_run_id"] }
	};
	for (const field of submission.patch.fields) {
		const value = snapshot[field];
		if (value === void 0) continue;
		if (field === "inputs") update.inputs = value;
		else if (field === "outputs") update.outputs = value;
		else if (field === "end_time") update.end_time = value;
		else if (field === "error") update.error = value;
		else if (field === "tags") update.tags = value;
		else if (field === "serialized") update.serialized = value;
		else if (field === "events") update.events = value;
		else if (field === "reference_example_id") update.reference_example_id = value;
	}
	return update;
}
function validateSubmission(submission) {
	if (submission === null || typeof submission !== "object") throw new TypeError("A prepared run submission is required");
	if (submission.operation !== "post" && submission.operation !== "patch") throw new TypeError("Invalid upload operation");
	if (submission.metadata === null || typeof submission.metadata !== "object") throw new TypeError("Run metadata is required");
	if (submission.integration !== submission.metadata.integration) throw new TypeError("Run metadata integration does not match the submission");
	if (submission.run === null || typeof submission.run !== "object") throw new TypeError("Run data is required");
	if (Object.hasOwn(submission.run, "child_runs")) throw new TypeError("Each upload submission must contain a single run");
	if (typeof submission.run.id !== "string" || submission.run.id.trim().length === 0) throw new TypeError("A stable run ID is required");
	if (submission.privacyMode !== "full" && submission.privacyMode !== "metadata") throw new TypeError("Invalid privacy mode");
	if (submission.operation === "patch") validatePatch(submission);
}
function validatePatch(submission) {
	if (submission.patch === null || typeof submission.patch !== "object" || !Array.isArray(submission.patch.fields) || submission.patch.values === null || typeof submission.patch.values !== "object") throw new TypeError("A patch field set and values are required");
	if (typeof submission.run.name !== "string" || typeof submission.run.run_type !== "string") throw new TypeError("Patch run context must preserve its name and type");
	const selected = /* @__PURE__ */ new Set();
	for (const candidate of submission.patch.fields) {
		if (typeof candidate !== "string" || !UPLOAD_PATCH_FIELDS.has(candidate)) throw new TypeError("Invalid patch field");
		const field = candidate;
		if (selected.has(field)) throw new TypeError("Patch fields must be unique");
		if (!Object.hasOwn(submission.patch.values, field) || submission.patch.values[field] === void 0) throw new TypeError("Every selected patch field must have a value");
		selected.add(field);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/capture-wake-constants.js
const CAPTURE_WAKE_ERROR_NAME = "CaptureWakeError";
const CAPTURE_WAKE_FAILURE_MESSAGE = "Trace work was saved but its worker could not start";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/capture-wake.js
var CaptureWakeError = class extends Error {
	captureResult;
	constructor(captureResult, cause) {
		super(`${CAPTURE_WAKE_FAILURE_MESSAGE}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
		this.name = CAPTURE_WAKE_ERROR_NAME;
		this.captureResult = captureResult;
	}
};
async function wakeCapturedWork(captureResult, wake) {
	try {
		await wake();
	} catch (cause) {
		throw new CaptureWakeError(captureResult, cause);
	}
}
async function readSavedCaptureWake(error, options) {
	if (!(error instanceof CaptureWakeError)) return void 0;
	const result = structuredClone(error.captureResult);
	const { record } = result;
	if (record.integration !== options.integration || record.sessionId !== options.sessionId || record.turnId !== options.turnId || record.destinationFingerprint !== options.destinationFingerprint || options.eventId !== void 0 && record.eventId !== options.eventId || options.runId !== void 0 && record.runId !== options.runId) return void 0;
	const saved = await options.store.read({
		integration: record.integration,
		sessionId: record.sessionId,
		turnId: record.turnId,
		eventId: record.eventId
	});
	return saved !== void 0 && saved.capturedAtMs === record.capturedAtMs && captureContentDigest(saved) === captureContentDigest(record) ? {
		...result,
		record: saved
	} : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/constants.js
const DOTTED_ORDER_SEGMENT_PATTERN = /^(\d{8}T\d{12}Z)([^.]+)$/u;
const DOTTED_ORDER_STRIP_PATTERN = /[-:.]/gu;
const LIFECYCLE_POST_EVENT_KIND = "run-post";
const LIFECYCLE_PATCH_EVENT_KIND = "run-patch";
const LIFECYCLE_SETTLEMENT_EVENT_KIND = "run-settlement-patch";
const LIFECYCLE_ATTRIBUTION_READY_FIELD = "attributionReady";
const LIFECYCLE_ENGINE_FOLDERS = [CAPTURE_SESSIONS_DIRECTORY];
const LIFECYCLE_SETTLEMENT_LOCK_PREFIX = "settlement-";
const LIFECYCLE_TURN_CLOSURE_STATES = [
	"open",
	"provisional",
	"authoritative"
];
const LIFECYCLE_SWEEP_WARNING = "Could not clean up old trace files:";
const LIFECYCLE_UPLOAD_ACCOUNT_CHANGED_MESSAGE = "Upload account changed";
const LIFECYCLE_STORED_RUN_CONTEXT_IS_REQUIRED_MESSAGE = "Stored run context is required";
const LIFECYCLE_STORED_INTEGRATION_DOES_NOT_MATCH_LIFECYCLE_BRIDGE_MESSAGE = "Stored integration does not match the lifecycle bridge";
const LIFECYCLE_STORED_RUN_DATA_IS_REQUIRED_MESSAGE = "Stored run data is required";
const LIFECYCLE_STORED_RUN_ID_DOES_NOT_MATCH_ITS_CAPTURE_MESSAGE = "Stored run ID does not match its capture";
const LIFECYCLE_STORED_PRIVACY_MODE_IS_INVALID_MESSAGE = "Stored privacy mode is invalid";
const LIFECYCLE_STORED_CAPTURE_IS_MISSING_THREAD_IDENTITY_MESSAGE = "Stored capture is missing thread identity";
const LIFECYCLE_RUN_INTEGRATION_MISMATCH_MESSAGE = "Run integration does not match the lifecycle bridge";
const LIFECYCLE_INVALID_PRIVACY_MODE_MESSAGE = "Invalid privacy mode";
const LIFECYCLE_INVALID_RUN_OPERATION_MESSAGE = "Invalid run operation";
const LIFECYCLE_INVALID_CLOSURE_STATE_MESSAGE = "Lifecycle turn evidence has an invalid closure state";
const LIFECYCLE_RUN_IDENTITY_CHANGED_MESSAGE = "Run identity changed for a persisted capture";
const LIFECYCLE_PATCH_START_TIME_MESSAGE = "Patch run context must preserve its canonical start time";
const LIFECYCLE_RUN_TRACE_ORDER_MESSAGE = "Run context must preserve its canonical trace ID and dotted order";
const LIFECYCLE_INVALID_PATCH_FIELD_MESSAGE = "Invalid patch field";
const LIFECYCLE_PATCH_FIELDS_UNIQUE_MESSAGE = "Patch fields must be unique";
const LIFECYCLE_PATCH_FIELD_VALUE_MESSAGE = "Every selected patch field must have a value";
const LIFECYCLE_INVALID_PATCH_PRIVACY_STATUS_MESSAGE = "Invalid patch privacy status";
const LIFECYCLE_IDENTITY_FIELD_LABELS = [
	["parent_run_id", "Parent run ID"],
	["trace_id", "Trace ID"],
	["dotted_order", "Dotted order"]
];
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/readiness.js
async function captureReadiness(scopes, destinations, readOutcome) {
	const pending = /* @__PURE__ */ new Set();
	const dropped = /* @__PURE__ */ new Set();
	for (const scope of scopes) for (const destination of destinations) {
		const outcome = await readOutcome(scope, destination.id);
		if (outcome.status === "failed") throw new Error(`Could not read settlement receipt: ${outcome.code}`);
		if (outcome.status === "settled") {
			if (outcome.receipt.outcome === "dropped") dropped.add(destination.id);
		} else pending.add(destination.id);
	}
	return pending.size > 0 ? {
		status: "pending",
		destinations: [...pending].toSorted()
	} : dropped.size > 0 ? {
		status: "dropped",
		destinations: [...dropped].toSorted()
	} : {
		status: "delivered",
		destinations: []
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/closure.js
function deriveAttributionReadiness(value, integration) {
	const metadata = prepareCodingAgentMetadataProvenance(requireOwnDataField(requirePlainRecord(value, "Prepared run submission"), "metadata"), integration, "full");
	if (metadata.status === "deferred") return false;
	return attributionMetadataReady(buildCodingAgentMetadata(metadata.value));
}
function storedAttributionReadiness(record, integration) {
	const readiness = ownDataField(requirePlainRecord(record.turnEvidence, "Stored turn evidence"), LIFECYCLE_ATTRIBUTION_READY_FIELD);
	if (readiness.present) return requireBoolean(readiness.value, `Stored turn evidence ${LIFECYCLE_ATTRIBUTION_READY_FIELD}`);
	if (requireOwnDataField(requirePlainRecord(record.normalizedPayload, "Stored run payload"), "privacyMode") !== "full") return false;
	const metadata = prepareCodingAgentMetadataProvenance(record.metadataProvenance, integration, "full");
	if (metadata.status === "deferred") return false;
	return attributionMetadataReady(buildCodingAgentMetadata(metadata.value));
}
function indexCaptureSources(sources) {
	return new Map(sources.map((source) => [scopeKey(scopeOf(source)), source]));
}
function attributionMetadataReady(projected) {
	const repository = projected[GIT_METADATA_KEYS.repository];
	const identifier = projected[ATTRIBUTION_IDENTIFIER_KEY];
	return typeof repository === "string" && repository.length > 0 && typeof identifier === "string" && identifier.length > 0;
}
async function withholdUnresolvedEndTime(input) {
	const { record, submission, sourceSnapshot, sourceByScope, integration, destinations, readOutcome } = input;
	if (record.eventKind !== "run-post" && record.eventKind !== "run-patch") return submission;
	const evidence = requirePlainRecord(record.turnEvidence, "Stored turn evidence");
	const attributionReady = storedAttributionReadiness(record, integration);
	const closureState = requireOwnDataField(evidence, "closureState");
	if (typeof closureState !== "string" || !LIFECYCLE_TURN_CLOSURE_STATES.includes(closureState)) throw new TypeError("Stored turn evidence has an invalid closure state");
	const runType = submission.metadata.runType;
	if (runType !== "tool" && runType !== "root") return submission;
	if (!((submission.operation === "post" ? submission.run.end_time !== void 0 : submission.patch.fields.includes("end_time")) || hasPriorEndTime(record, sourceByScope)) || attributionReady) return submission;
	if (runType === "root" && !await hasMissingChildReceipts(record, evidence, sourceSnapshot, destinations, readOutcome)) return submission;
	return removeOutgoingEndTime(submission);
}
function hasPriorEndTime(record, sourceByScope) {
	const pending = [...record.dependencies ?? []];
	const visited = /* @__PURE__ */ new Set();
	while (pending.length > 0) {
		const key = scopeKey(pending.pop());
		if (visited.has(key)) continue;
		visited.add(key);
		const previous = sourceByScope.get(key);
		if (previous === void 0) continue;
		if (previous.runId === record.runId && (previous.eventKind === "run-post" || previous.eventKind === "run-patch") && recordHasEndTime(previous)) return true;
		pending.push(...previous.dependencies ?? []);
	}
	return false;
}
function recordHasEndTime(record) {
	const payload = requirePlainRecord(record.normalizedPayload, "Stored run payload");
	if (payload["operation"] === "post") {
		const endTime = ownDataField(requirePlainRecord(requireOwnDataField(payload, "run"), "Stored run snapshot"), "end_time");
		return endTime.present && endTime.value !== void 0;
	}
	if (payload["operation"] !== "patch") return false;
	const patch = requirePlainRecord(requireOwnDataField(payload, "patch"), "Stored run patch");
	if (!requireStringArray(requireOwnDataField(patch, "fields"), "Patch fields").includes("end_time")) return false;
	const endTime = ownDataField(requirePlainRecord(requireOwnDataField(patch, "values"), "Patch values"), "end_time");
	return endTime.present && endTime.value !== void 0;
}
async function hasMissingChildReceipts(record, evidence, sourceSnapshot, destinations, readOutcome) {
	const children = requireStringArray(requireOwnDataField(evidence, "childRunIds"), "Child run IDs").map((runId) => requireNonBlankString(runId, "Child run ID")).filter((runId) => runId !== record.runId);
	if (children.length === 0) return false;
	for (const childRunId of children) {
		const childCaptures = sourceSnapshot.filter((source) => source.runId === childRunId && source.destinationFingerprint === record.destinationFingerprint && source.eventKind === "run-post");
		if (childCaptures.length === 0) return true;
		for (const child of childCaptures) {
			const scope = scopeOf(child);
			for (const destination of destinations) {
				const outcome = await readOutcome(scope, destination.id);
				if (outcome.status === "failed") throw new Error(`Could not read child delivery receipt: ${outcome.code}`);
				if (outcome.status !== "settled" || outcome.receipt.outcome !== "delivered") return true;
			}
		}
	}
	return false;
}
function removeOutgoingEndTime(submission) {
	if (submission.operation === "patch") return void 0;
	const privacyContext = submission.privacyMode !== "metadata" ? void 0 : { status: submission.run.error !== void 0 || submission.privacyContext?.status === "error" ? "error" : "running" };
	const run = { ...submission.run };
	delete run.end_time;
	return {
		...submission,
		run,
		...privacyContext === void 0 ? {} : { privacyContext }
	};
}
function isHeldUpdate(record, captures, integration) {
	if (record.eventKind !== "run-patch") return false;
	if (field$1(record.metadataProvenance, "runType") !== "tool") return false;
	const fields = field$1(field$1(record.normalizedPayload, "patch"), "fields");
	if (!Array.isArray(fields) || !fields.includes("end_time")) return false;
	if (storedAttributionReadiness(record, integration)) return false;
	return !captures.some((capture) => capture.record.eventKind === "run-settlement-patch" && capture.record.runId === record.runId);
}
function field$1(value, key) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value[key] : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/identity.js
function createRunIdentity(input) {
	const id = requireNonBlankString(input.id, "Run ID");
	const start_time = requireTimestamp(input.start_time);
	const segment = dottedOrderSegment(start_time, id);
	if (input.parent === void 0) return {
		id,
		start_time,
		trace_id: id,
		dotted_order: segment
	};
	const parent = canonicalParent(input.parent);
	return {
		id,
		start_time,
		parent_run_id: parent.id,
		trace_id: parent.trace_id,
		dotted_order: `${parent.dotted_order}.${segment}`
	};
}
function canonicalParent(parent) {
	const id = requireNonBlankString(parent.id, "Parent run ID");
	const trace_id = requireNonBlankString(parent.trace_id, "Parent trace ID");
	const dotted_order = requireNonBlankString(parent.dotted_order, "Parent dotted order");
	const parent_run_id = parent.parent_run_id === void 0 ? void 0 : requireNonBlankString(parent.parent_run_id, "Parent run's parent ID");
	const segments = dotted_order.split(".").map(parseDottedOrderSegment);
	const runIds = segments.map((segment) => segment.runId);
	const lastSegment = segments.at(-1);
	const start_time = parent.start_time === void 0 ? void 0 : requireTimestamp(parent.start_time);
	if (lastSegment?.runId !== id || runIds[0] !== trace_id || parent_run_id !== void 0 && (runIds.length < 2 || runIds.at(-2) !== parent_run_id) || start_time !== void 0 && lastSegment.timestamp.slice(0, 18) !== dottedOrderTimePrefix(start_time)) throw new TypeError("Parent run identity is not canonical");
	return {
		id,
		...parent_run_id === void 0 ? {} : { parent_run_id },
		trace_id,
		dotted_order,
		...start_time === void 0 ? {} : { start_time }
	};
}
function parseDottedOrderSegment(segment) {
	const match = DOTTED_ORDER_SEGMENT_PATTERN.exec(segment);
	if (match === null || !isValidDottedOrderTime(match[1])) throw new TypeError("Parent run identity is not canonical");
	return {
		timestamp: match[1],
		runId: match[2]
	};
}
function isValidDottedOrderTime(value) {
	const time = value.slice(0, 18);
	const iso = `${time.slice(0, 4)}-${time.slice(4, 6)}-${time.slice(6, 8)}T${time.slice(9, 11)}:${time.slice(11, 13)}:${time.slice(13, 15)}.${time.slice(15, 18)}Z`;
	const parsed = new Date(iso);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString() === iso;
}
function dottedOrderTimePrefix(startTime) {
	return new Date(startTime).toISOString().slice(0, -1).replace(DOTTED_ORDER_STRIP_PATTERN, "");
}
function dottedOrderSegment(startTime, runId) {
	const epoch = new Date(startTime).getTime();
	return `${`${new Date(epoch).toISOString().slice(0, -1)}${String(1).padStart(3, "0")}Z`.replace(DOTTED_ORDER_STRIP_PATTERN, "")}${runId}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/projection.js
function projectPostSubmission(source, common, priorIdentity) {
	const { integration, privacyMode, redaction } = common;
	const run = canonicalIdentity(normalizedRunSnapshot(requireOwnDataField(source, "run")), priorIdentity);
	const suppliedPrivacyContext = ownDataField(source, "privacyContext");
	const status = run.error !== void 0 ? "error" : suppliedPrivacyContext.present ? privacyStatus(suppliedPrivacyContext.value).status : statusForPost(run);
	const metadata = prepareCodingAgentMetadataProvenance(requireOwnDataField(source, "metadata"), integration, privacyMode, status);
	if (metadata.status === "deferred") return metadata;
	return {
		status: "ready",
		value: {
			payload: {
				operation: "post",
				integration,
				privacyMode,
				...redaction,
				...privacyMode === "metadata" ? { privacyContext: { status } } : {},
				run: privacyMode === "metadata" ? projectPost(run, metadata.value, status) : run
			},
			metadata: metadata.value,
			privacyStatus: status
		}
	};
}
function projectPatchSubmission(source, common, priorIdentity) {
	const { integration, privacyMode, redaction } = common;
	const run = canonicalIdentity(normalizedRunContext(requireOwnDataField(source, "run")), priorIdentity, true);
	const patch = normalizedPatch(requireOwnDataField(source, "patch"));
	const privacyContext = privacyStatus(requireOwnDataField(source, "privacyContext"));
	const metadata = prepareCodingAgentMetadataProvenance(requireOwnDataField(source, "metadata"), integration, privacyMode, privacyContext.status);
	if (metadata.status === "deferred") return metadata;
	return {
		status: "ready",
		value: {
			payload: {
				operation: "patch",
				integration,
				privacyMode,
				...redaction,
				run,
				privacyContext,
				patch: privacyMode === "metadata" ? projectPatch(run, patch, integration, metadata.value, privacyContext) : patch
			},
			metadata: metadata.value,
			privacyStatus: privacyContext.status
		}
	};
}
function projectSubmission(value, integration, priorIdentity) {
	const source = requirePlainRecord(value, "Prepared run submission");
	if (requireOwnDataField(source, "integration") !== integration) throw new TypeError(LIFECYCLE_RUN_INTEGRATION_MISMATCH_MESSAGE);
	const privacyMode = requireOwnDataField(source, "privacyMode");
	if (privacyMode !== "full" && privacyMode !== "metadata") throw new TypeError(LIFECYCLE_INVALID_PRIVACY_MODE_MESSAGE);
	const redactedField = ownDataField(source, "redactedFields");
	const redactedFields = normalizedRedactedFields(redactedField.present ? redactedField.value : void 0);
	const common = {
		integration,
		privacyMode,
		redaction: privacyMode === "full" && redactedFields.length > 0 ? { redactedFields } : {}
	};
	const operation = requireOwnDataField(source, "operation");
	if (operation === "post") return projectPostSubmission(source, common, priorIdentity);
	if (operation === "patch") return projectPatchSubmission(source, common, priorIdentity);
	throw new TypeError(LIFECYCLE_INVALID_RUN_OPERATION_MESSAGE);
}
function projectTurnEvidence(value, mode, attributionReady) {
	const source = requirePlainRecord(value, "Lifecycle turn evidence");
	const childRunIds = requireStringArray(requireOwnDataField(source, "childRunIds"), "Child run IDs").map((runId) => requireNonBlankString(runId, "Child run ID"));
	const closureState = requireOwnDataField(source, "closureState");
	if (typeof closureState !== "string" || !LIFECYCLE_TURN_CLOSURE_STATES.includes(closureState)) throw new TypeError(LIFECYCLE_INVALID_CLOSURE_STATE_MESSAGE);
	const persisted = {
		childRunIds,
		closureState,
		[LIFECYCLE_ATTRIBUTION_READY_FIELD]: attributionReady
	};
	const rootRunId = ownDataField(source, "rootRunId");
	if (rootRunId.present && rootRunId.value !== void 0) persisted.rootRunId = requireNonBlankString(rootRunId.value, "Root run ID");
	return canonicalJsonValue(mode === "metadata" ? persisted : {
		...source,
		...persisted
	});
}
function projectPost(run, metadata, status) {
	const tree = createCodingAgentRunTree({
		id: run.id,
		name: run.name,
		run_type: run.run_type,
		...run.start_time === void 0 ? {} : { start_time: run.start_time },
		inputs: run.inputs,
		extra: { metadata: buildCodingAgentMetadata(metadata) },
		...run.end_time === void 0 ? {} : { end_time: run.end_time },
		...run.outputs === void 0 ? {} : { outputs: run.outputs },
		...run.parent_run_id === void 0 ? {} : { parent_run_id: run.parent_run_id },
		...run.trace_id === void 0 ? {} : { trace_id: run.trace_id },
		...run.dotted_order === void 0 ? {} : { dotted_order: run.dotted_order },
		...run.error === void 0 ? {} : { error: run.error },
		...run.tags === void 0 ? {} : { tags: run.tags },
		...run.serialized === void 0 ? {} : { serialized: run.serialized },
		...run.reference_example_id === void 0 ? {} : { reference_example_id: run.reference_example_id }
	}, metadata.integration, "metadata", { status });
	if (run.events !== void 0) tree.events = run.events;
	const projected = tree.toJSON();
	return {
		id: run.id,
		name: run.name,
		run_type: run.run_type,
		start_time: requireTimestamp(run.start_time),
		inputs: canonicalJsonObject(projected["inputs"], "Projected run inputs"),
		outputs: canonicalJsonObject(projected["outputs"], "Projected run outputs"),
		...run.end_time === void 0 ? {} : { end_time: run.end_time },
		...run.parent_run_id === void 0 ? {} : { parent_run_id: run.parent_run_id },
		...run.trace_id === void 0 ? {} : { trace_id: run.trace_id },
		...run.dotted_order === void 0 ? {} : { dotted_order: run.dotted_order },
		...Array.isArray(projected["tags"]) ? { tags: requireStringArray(projected["tags"], "Projected run tags") } : {}
	};
}
function projectPatch(context, patch, integration, metadata, privacyContext) {
	const tree = createCodingAgentRunTree({
		id: context.id,
		name: context.name,
		run_type: context.run_type,
		...context.start_time === void 0 ? {} : { start_time: context.start_time },
		inputs: patch.values.inputs ?? {},
		outputs: patch.values.outputs ?? {},
		extra: { metadata: buildCodingAgentMetadata(metadata) },
		...context.parent_run_id === void 0 ? {} : { parent_run_id: context.parent_run_id },
		...context.trace_id === void 0 ? {} : { trace_id: context.trace_id },
		...context.dotted_order === void 0 ? {} : { dotted_order: context.dotted_order },
		...patch.values.end_time === void 0 ? {} : { end_time: patch.values.end_time },
		...patch.values.error === void 0 ? {} : { error: patch.values.error },
		...patch.values.tags === void 0 ? {} : { tags: patch.values.tags },
		...patch.values.serialized === void 0 ? {} : { serialized: patch.values.serialized },
		...patch.values.reference_example_id === void 0 ? {} : { reference_example_id: patch.values.reference_example_id }
	}, integration, "metadata", privacyContext);
	if (patch.values.events !== void 0) tree.events = patch.values.events;
	const projected = tree.toJSON();
	const fields = survivingCodingAgentPatchFields(projected, patch.fields);
	const values = {};
	for (const field of fields) {
		const value = ownDataField(projected, field);
		if (!value.present) continue;
		values[field] = field === "inputs" || field === "outputs" ? canonicalJsonObject(value.value, `Projected patch ${field}`) : field === "tags" ? requireStringArray(value.value, `Projected patch ${field}`) : field === "events" ? canonicalJsonArray(value.value, `Projected patch ${field}`) : field === "error" || field === "reference_example_id" ? requireString(value.value, `Projected patch ${field}`) : field === "end_time" ? requireTimestamp(value.value) : canonicalJsonObject(value.value, `Projected patch ${field}`);
	}
	return {
		fields: fields.filter((field) => Object.hasOwn(values, field)),
		values
	};
}
function normalizedRunSnapshot(value) {
	const source = requirePlainRecord(value, "Normalized run snapshot");
	const run = {
		id: requiredText(source, "id", "Run ID"),
		name: requiredText(source, "name", "Run name"),
		run_type: requiredText(source, "run_type", "Run type"),
		inputs: canonicalJsonObject(requireOwnDataField(source, "inputs"), "Run inputs")
	};
	copyRunContext(source, run);
	const endTime = ownDataField(source, "end_time");
	if (endTime.present && endTime.value !== void 0) run.end_time = requireTimestamp(endTime.value);
	const outputs = ownDataField(source, "outputs");
	if (outputs.present && outputs.value !== void 0) run.outputs = canonicalJsonObject(outputs.value, "Run outputs");
	const tags = ownDataField(source, "tags");
	if (tags.present && tags.value !== void 0) run.tags = requireStringArray(tags.value, "Run tags");
	const error = ownDataField(source, "error");
	if (error.present && error.value !== void 0) run.error = requireString(error.value, "Run error");
	const serialized = ownDataField(source, "serialized");
	if (serialized.present && serialized.value !== void 0) run.serialized = canonicalJsonObject(serialized.value, "Serialized run data");
	const events = ownDataField(source, "events");
	if (events.present && events.value !== void 0) run.events = canonicalJsonArray(events.value, "Run events");
	const example = ownDataField(source, "reference_example_id");
	if (example.present && example.value !== void 0) run.reference_example_id = requireNonBlankString(example.value, "Reference example ID");
	return run;
}
function normalizedRunContext(value) {
	const source = requirePlainRecord(value, "Normalized run context");
	const run = {
		id: requiredText(source, "id", "Run ID"),
		name: requiredText(source, "name", "Run name"),
		run_type: requiredText(source, "run_type", "Run type")
	};
	copyRunContext(source, run);
	return run;
}
function copyRunContext(source, run) {
	const start = ownDataField(source, "start_time");
	if (start.present && start.value !== void 0) run.start_time = requireTimestamp(start.value);
	for (const [key, name] of LIFECYCLE_IDENTITY_FIELD_LABELS) {
		const field = ownDataField(source, key);
		if (field.present && field.value !== void 0) run[key] = requireNonBlankString(field.value, name);
	}
}
function canonicalIdentity(run, prior, requireStableIdentity = false) {
	const reusable = prior?.id === run.id && prior.parent_run_id === run.parent_run_id ? prior : void 0;
	if (reusable !== void 0 && (run.start_time !== void 0 && run.start_time !== reusable.start_time || run.trace_id !== void 0 && run.trace_id !== reusable.trace_id || run.dotted_order !== void 0 && run.dotted_order !== reusable.dotted_order)) throw new TypeError(LIFECYCLE_RUN_IDENTITY_CHANGED_MESSAGE);
	const knownStartTime = run.start_time ?? reusable?.start_time;
	if (knownStartTime === void 0 && requireStableIdentity) throw new TypeError(LIFECYCLE_PATCH_START_TIME_MESSAGE);
	const startTime = knownStartTime ?? Date.now();
	const result = {
		...run,
		start_time: startTime
	};
	const canGenerateRootIdentity = !requireStableIdentity && result.parent_run_id === void 0;
	const generatedOrder = canGenerateRootIdentity && result.dotted_order === void 0 && reusable?.dotted_order === void 0 ? createRunIdentity({
		id: result.id,
		start_time: startTime
	}).dotted_order : void 0;
	const traceId = result.trace_id ?? reusable?.trace_id ?? (canGenerateRootIdentity ? result.id : void 0);
	const order = result.dotted_order ?? reusable?.dotted_order ?? generatedOrder;
	if (traceId === void 0 || order === void 0) throw new TypeError(LIFECYCLE_RUN_TRACE_ORDER_MESSAGE);
	result.trace_id = traceId;
	result.dotted_order = order;
	return result;
}
function normalizedPatch(value) {
	const source = requirePlainRecord(value, "Normalized run patch");
	const candidates = canonicalJsonArray(requireOwnDataField(source, "fields"), "Patch field mask");
	const sourceValues = requirePlainRecord(requireOwnDataField(source, "values"), "Patch values");
	const seen = /* @__PURE__ */ new Set();
	const fields = [];
	const values = {};
	for (const candidate of candidates) {
		if (typeof candidate !== "string" || !UPLOAD_PATCH_FIELDS.has(candidate)) throw new TypeError(LIFECYCLE_INVALID_PATCH_FIELD_MESSAGE);
		const field = candidate;
		if (seen.has(field)) throw new TypeError(LIFECYCLE_PATCH_FIELDS_UNIQUE_MESSAGE);
		const selected = ownDataField(sourceValues, field);
		if (!selected.present || selected.value === void 0) throw new TypeError(LIFECYCLE_PATCH_FIELD_VALUE_MESSAGE);
		seen.add(field);
		fields.push(field);
		values[field] = field === "inputs" || field === "outputs" ? canonicalJsonObject(selected.value, `Patch ${field}`) : field === "end_time" ? requireTimestamp(selected.value) : field === "error" ? requireString(selected.value, "Patch error") : field === "reference_example_id" ? requireNonBlankString(selected.value, "Patch reference example ID") : field === "tags" ? requireStringArray(selected.value, "Patch tags") : field === "events" ? canonicalJsonArray(selected.value, "Patch events") : canonicalJsonObject(selected.value, `Patch ${field}`);
	}
	return {
		fields,
		values
	};
}
function privacyStatus(value) {
	const status = requireOwnDataField(requirePlainRecord(value, "Patch privacy context"), "status");
	if (status !== "running" && status !== "completed" && status !== "error") throw new TypeError(LIFECYCLE_INVALID_PATCH_PRIVACY_STATUS_MESSAGE);
	return { status };
}
function statusForPost(run) {
	if (run.error !== void 0) return "error";
	if (run.end_time !== void 0) return "completed";
	return "running";
}
function requiredText(source, key, name) {
	return requireNonBlankString(requireOwnDataField(source, key), name);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/projection.js
function projectCapture(record, integration) {
	const submission = projectSubmission({
		...canonicalJsonObject(record.normalizedPayload, "Stored run payload"),
		metadata: record.metadataProvenance
	}, integration);
	if (submission.status === "deferred") return void 0;
	const expectedKind = submission.value.payload.operation === "post" ? LIFECYCLE_POST_EVENT_KIND : LIFECYCLE_PATCH_EVENT_KIND;
	if (record.eventKind !== expectedKind) throw new TypeError("Capture event kind does not match its operation");
	const evidence = parseEvidence(record.turnEvidence, storedAttributionReadiness(record, integration));
	return {
		record,
		payload: submission.value.payload,
		metadata: submission.value.metadata,
		open: captureIsOpen(submission.value.payload),
		attributionReady: evidence.attributionReady
	};
}
function captureIsOpen(payload) {
	if (payload.operation === "post") return payload.run.end_time === void 0 && payload.run.error === void 0;
	if (payload.privacyContext.status === "running") return true;
	return false;
}
function patchPayload(source, metadata, integration, endTime, causalRunError, runEvents) {
	const context = source.payload.run;
	const projected = projectSubmission({
		operation: "patch",
		integration,
		privacyMode: source.payload.privacyMode,
		...source.payload.redactedFields === void 0 ? {} : { redactedFields: source.payload.redactedFields },
		metadata,
		run: {
			id: context.id,
			name: context.name,
			run_type: context.run_type,
			...context.start_time === void 0 ? {} : { start_time: context.start_time },
			...context.parent_run_id === void 0 ? {} : { parent_run_id: context.parent_run_id },
			...context.trace_id === void 0 ? {} : { trace_id: context.trace_id },
			...context.dotted_order === void 0 ? {} : { dotted_order: context.dotted_order }
		},
		privacyContext: source.payload.operation === "patch" ? {
			...source.payload.privacyContext,
			...causalRunError ? { status: "error" } : endTime !== void 0 && source.payload.privacyContext.status !== "error" ? { status: "completed" } : {}
		} : { status: causalRunError || source.payload.run.error !== void 0 || source.payload.privacyContext?.status === "error" ? "error" : endTime !== void 0 || source.payload.run.end_time !== void 0 ? "completed" : source.payload.privacyContext?.status ?? "running" },
		patch: carriedPatch(runEvents, endTime)
	}, integration);
	if (projected.status === "deferred") throw new Error("Settlement patch lost thread identity");
	return projected.value;
}
function carriedPatch(runEvents, endTime) {
	const carried = runEvents.flatMap(({ payload }) => payload.operation === "patch" ? [payload.patch] : []);
	const fields = [...new Set(carried.flatMap((patch) => patch.fields))].filter((field) => field !== "end_time");
	const values = Object.assign({}, ...carried.map((patch) => patch.values));
	delete values.end_time;
	return endTime === void 0 ? {
		fields,
		values
	} : {
		fields: [...fields, "end_time"],
		values: {
			...values,
			end_time: endTime
		}
	};
}
function addAttribution(metadata, attribution) {
	const layer = CODING_AGENT_INTEGRATION_POLICIES[metadata.integration].fullModePrecedence === "custom-wins" ? "base" : "runSpecific";
	const previous = metadata[layer] ?? {};
	return {
		...metadata,
		[layer]: {
			...previous,
			...attribution
		}
	};
}
function parseEvidence(value, attributionReady) {
	const source = requirePlainRecord(value, "Stored turn evidence");
	const childRunIds = requireStringArray(requireOwnDataField(source, "childRunIds"), "Child run IDs").map((runId) => requireNonBlankString(runId, "Child run ID"));
	const closureState = requireOwnDataField(source, "closureState");
	if (typeof closureState !== "string" || !LIFECYCLE_TURN_CLOSURE_STATES.includes(closureState)) throw new TypeError("Stored turn evidence has an invalid closure state");
	const result = {
		childRunIds,
		closureState,
		attributionReady
	};
	const rootRunId = ownDataField(source, "rootRunId");
	if (rootRunId.present && rootRunId.value !== void 0) result.rootRunId = requireNonBlankString(rootRunId.value, "Root run ID");
	return result;
}
function closureRank(state) {
	return state === "authoritative" ? 2 : state === "provisional" ? 1 : 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/constants.js
const REPOSITORY_NAME_KEY = GIT_METADATA_KEYS.repository;
const SETTLEMENT_EVENT_ID_PREFIX = "turn-settlement-";
const SETTLEMENT_DROPPED_RUN_WARNING = "Trace work for run {runId} was dropped, so it is left out; the rest of its turn is still being finished.";
const SETTLEMENT_ATTRIBUTION_LOST_MESSAGE = "Settlement metadata could not preserve attribution";
const SETTLEMENT_NEVER_ENDED_WARNING = "Turn {turnId} never ended, so it was finished with the work saved for it; its root run may stay open.";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/recorded-run.js
function recordRun(events) {
	const latest = events.at(-1);
	const run = latest.payload.run;
	return {
		run_id: latest.record.runId,
		...run.parent_run_id === void 0 ? {} : { parent_run_id: run.parent_run_id },
		trace_id: requireNonBlankString(run.trace_id, "Trace ID"),
		dotted_order: requireNonBlankString(run.dotted_order, "Dotted order"),
		name: requireNonBlankString(run.name, "Run name"),
		run_type: requireNonBlankString(run.run_type, "Run type"),
		tracing: latest.payload.privacyMode,
		open: latest.open,
		metadata: buildCodingAgentMetadata(mergeMetadataOptions(events))
	};
}
function mergeMetadataOptions(captures) {
	const first = captures[0];
	if (first === void 0) throw new Error("Run metadata is required for settlement");
	let merged = first.metadata;
	for (const { metadata } of captures.slice(1)) {
		const base = mergeMetadataObject(merged.base, metadata.base);
		const runSpecific = mergeMetadataObject(merged.runSpecific, metadata.runSpecific);
		const providerMetadata = mergeMetadataObject(merged.providerMetadata, metadata.providerMetadata);
		const usageMetadata = mergeMetadataObject(merged.usageMetadata, metadata.usageMetadata);
		merged = {
			...merged,
			...metadata,
			...base === void 0 ? {} : { base },
			...runSpecific === void 0 ? {} : { runSpecific },
			...providerMetadata === void 0 ? {} : { providerMetadata },
			...usageMetadata === void 0 ? {} : { usageMetadata }
		};
	}
	return merged;
}
function mergeMetadataObject(previous, current) {
	if (previous === void 0 && current === void 0) return void 0;
	return {
		...previous,
		...current
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/source-order.js
function uniqueScopes(scopes) {
	const unique = /* @__PURE__ */ new Map();
	for (const scope of scopes) unique.set(JSON.stringify(scope), scope);
	return [...unique.values()].toSorted(compareScopes);
}
function compareScopes(left, right) {
	return compareText(JSON.stringify(left), JSON.stringify(right));
}
function orderSourceCaptures(records) {
	const byScope = new Map(records.map((record) => [scopeKey(scopeOf(record)), record]));
	const dependents = new Map(records.map((record) => [scopeKey(scopeOf(record)), []]));
	const dependencyCounts = new Map(records.map((record) => [scopeKey(scopeOf(record)), 0]));
	for (const record of records) {
		const recordKey = scopeKey(scopeOf(record));
		for (const dependency of record.dependencies ?? []) {
			const prerequisite = byScope.get(scopeKey(dependency));
			if (prerequisite === void 0) continue;
			dependents.get(scopeKey(scopeOf(prerequisite))).push(record);
			dependencyCounts.set(recordKey, dependencyCounts.get(recordKey) + 1);
		}
	}
	const ready = [];
	for (const record of records) if (dependencyCounts.get(scopeKey(scopeOf(record))) === 0) pushOrderedCapture(ready, record);
	const ordered = [];
	while (ready.length > 0) {
		const record = popOrderedCapture(ready);
		ordered.push(record);
		for (const dependent of dependents.get(scopeKey(scopeOf(record))) ?? []) {
			const key = scopeKey(scopeOf(dependent));
			const count = dependencyCounts.get(key) - 1;
			dependencyCounts.set(key, count);
			if (count === 0) pushOrderedCapture(ready, dependent);
		}
	}
	if (ordered.length !== records.length) throw new TypeError("Source capture dependencies contain a cycle");
	return ordered;
}
function compareSourceCaptures(left, right) {
	return compareCaptureOrder(left, right) || compareScopes(scopeOf(left), scopeOf(right));
}
function pushOrderedCapture(heap, record) {
	let index = heap.length;
	heap.push(record);
	while (index > 0) {
		const parentIndex = Math.floor((index - 1) / 2);
		const parent = heap[parentIndex];
		if (compareSourceCaptures(parent, record) <= 0) break;
		heap[index] = parent;
		index = parentIndex;
	}
	heap[index] = record;
}
function popOrderedCapture(heap) {
	const first = heap[0];
	if (first === void 0) return void 0;
	const last = heap.pop();
	if (heap.length === 0) return first;
	let index = 0;
	while (index * 2 + 1 < heap.length) {
		const leftIndex = index * 2 + 1;
		const rightIndex = leftIndex + 1;
		const childIndex = rightIndex < heap.length && compareSourceCaptures(heap[rightIndex], heap[leftIndex]) < 0 ? rightIndex : leftIndex;
		const child = heap[childIndex];
		if (compareSourceCaptures(last, child) <= 0) break;
		heap[index] = child;
		index = childIndex;
	}
	heap[index] = last;
	return first;
}
function groupByTurn(records) {
	const turns = /* @__PURE__ */ new Map();
	for (const record of records) {
		const captures = turns.get(record.turnId) ?? [];
		captures.push(record);
		turns.set(record.turnId, captures);
	}
	return turns;
}
function report(turnId, status, reason, runIds = [], destinations = []) {
	return {
		turnId,
		status,
		reason,
		...runIds.length === 0 ? {} : { runIds },
		...destinations.length === 0 ? {} : { destinations },
		patches: 0
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/revision.js
function settlementEventId(turnId, runId, dependencies, rootRunId, childRunIds, attribution) {
	const revision = createHash("sha256").update(JSON.stringify({
		turnId,
		runId,
		rootRunId,
		childRunIds: [...childRunIds].toSorted(),
		dependencies: dependencies.toSorted(compareScopes),
		attribution
	})).digest("hex");
	return `${SETTLEMENT_EVENT_ID_PREFIX}${revision}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/run-state.js
function hasCausalRunError(events) {
	let hasError = false;
	for (const { payload } of events) if (payload.operation === "post") hasError = payload.run.error !== void 0 || payload.privacyContext?.status === "error";
	else if (payload.patch.fields.includes("error")) hasError = payload.patch.values.error !== void 0;
	else if (payload.privacyContext.status === "error") hasError = true;
	return hasError;
}
function capturedEndTime(event) {
	if (event.payload.operation === "post") return event.payload.run.end_time;
	if (!event.payload.patch.fields.includes("end_time")) return void 0;
	const value = event.payload.patch.values.end_time;
	return value === void 0 ? void 0 : requireTimestamp(value);
}
function retainedEndTime(events) {
	let endTime;
	for (const event of events) {
		const captured = capturedEndTime(event);
		if (captured !== void 0) endTime = captured;
	}
	return endTime;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/settlement.js
function attributionOf(metadata) {
	const carried = {};
	const named = withBothGitMetadataNames(metadata ?? {});
	for (const key of REPOSITORY_METADATA_KEYS) {
		const value = named[key];
		if (typeof value === "string" && value.length > 0) carried[key] = value;
	}
	return carried;
}
const namesARepository = (carried) => carried[REPOSITORY_NAME_KEY] !== void 0;
function turnAttribution(record) {
	const root = attributionOf(record.root?.metadata);
	const inToolCallOrder = [...record.children].sort((left, right) => left.dotted_order < right.dotted_order ? -1 : 1).map((child) => attributionOf(child.metadata));
	const source = namesARepository(root) ? root : inToolCallOrder.find((carried) => namesARepository(carried));
	const knowsWhoWorkedInSource = (carried) => carried["ls_attribution_identifier"] !== void 0 && carried[REPOSITORY_NAME_KEY] === source?.[REPOSITORY_NAME_KEY];
	const author = root["ls_attribution_identifier"] ?? source?.["ls_attribution_identifier"] ?? inToolCallOrder.find(knowsWhoWorkedInSource)?.["ls_attribution_identifier"];
	const filled = { ...source };
	if (author !== void 0) filled[ATTRIBUTION_IDENTIFIER_KEY] = author;
	return Object.keys(filled).length > 0 ? filled : void 0;
}
function metadataAfterFill(run, filled) {
	const carried = attributionOf(run.metadata);
	if (namesARepository(carried) && carried[REPOSITORY_NAME_KEY] !== filled[REPOSITORY_NAME_KEY]) return void 0;
	const missing = Object.entries(filled).filter(([key]) => carried[key] === void 0);
	if (missing.length === 0) return void 0;
	return {
		...run.metadata,
		...Object.fromEntries(missing)
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/settle-turn.js
function unsettled(settlementReport) {
	return {
		report: settlementReport,
		patches: [],
		captured: 0
	};
}
function collectTurnEvidence(events) {
	const rootRunIds = /* @__PURE__ */ new Set();
	const childRunIds = /* @__PURE__ */ new Set();
	let closureState = "open";
	for (const event of events) {
		const evidence = parseEvidence(event.record.turnEvidence, event.attributionReady);
		if (evidence.rootRunId !== void 0) rootRunIds.add(evidence.rootRunId);
		for (const childRunId of evidence.childRunIds) childRunIds.add(childRunId);
		if (closureRank(evidence.closureState) > closureRank(closureState)) closureState = evidence.closureState;
	}
	return {
		rootRunIds,
		childRunIds,
		closureState
	};
}
function evidenceResult(turnId, events, { rootRunIds, closureState }, isQuiet) {
	if (rootRunIds.size === 0) return unsettled(report(turnId, "deferred", "missing-root"));
	if (rootRunIds.size > 1) return unsettled(report(turnId, "blocked", "conflicting-root", [...rootRunIds].toSorted()));
	if (closureState === "authoritative") return void 0;
	if (!isQuiet) return unsettled(report(turnId, "deferred", closureState));
	if (!isChildTurn(events, [...rootRunIds][0])) warnAboutNeverEndedTurn(turnId);
}
function isChildTurn(events, rootRunId) {
	return events.some(({ record, payload }) => record.runId === rootRunId && payload.run.parent_run_id !== void 0);
}
const warnedNeverEndedTurns = /* @__PURE__ */ new Set();
function warnAboutNeverEndedTurn(turnId) {
	if (warnedNeverEndedTurns.has(turnId)) return;
	warnedNeverEndedTurns.add(turnId);
	console.warn(fillTemplate(SETTLEMENT_NEVER_ENDED_WARNING, { turnId }));
}
function isQuietTurn(events, now) {
	return events.length > 0 && now - Math.max(...events.map(({ record }) => record.capturedAtMs)) >= 72e5;
}
function groupByRunId(events) {
	const grouped = /* @__PURE__ */ new Map();
	for (const event of events) {
		const runEvents = grouped.get(event.record.runId) ?? [];
		runEvents.push(event);
		grouped.set(event.record.runId, runEvents);
	}
	return grouped;
}
function requiredRunEvents(requiredRunIds, rootRunId, currentByRunId, allByRunId) {
	const byRunId = /* @__PURE__ */ new Map();
	for (const runId of requiredRunIds) byRunId.set(runId, runId === rootRunId ? currentByRunId.get(runId) ?? [] : allByRunId.get(runId) ?? []);
	return byRunId;
}
function buildTurnRecord(turnId, rootRunId, requiredRunIds, recorded) {
	return {
		path: "",
		origin: "capture",
		root: recorded.get(rootRunId),
		children: requiredRunIds.filter((runId) => runId !== rootRunId).map((runId) => recorded.get(runId)),
		turnId,
		closed: true,
		delivered: new Set(requiredRunIds),
		fixed: /* @__PURE__ */ new Set()
	};
}
function planRunPatch(state, runId) {
	const { attribution, captureEvents, recorded } = state;
	const events = captureEvents.get(runId);
	const run = recorded.get(runId);
	const merged = attribution === void 0 ? void 0 : metadataAfterFill(run, attribution);
	const currentAttribution = attributionOf(run.metadata);
	const added = Object.fromEntries(Object.entries(merged === void 0 ? {} : attribution ?? {}).filter(([key]) => currentAttribution[key] === void 0));
	const endTime = retainedEndTime(events);
	const restoreEndTime = endTime !== void 0 && events.some((event) => (event.metadata.runType === "tool" || event.metadata.runType === "root") && !event.attributionReady && capturedEndTime(event) !== void 0);
	if (Object.keys(added).length === 0 && !restoreEndTime) return void 0;
	const sourceMetadata = mergeMetadataOptions(events);
	const metadata = Object.keys(added).length === 0 ? sourceMetadata : addAttribution(sourceMetadata, added);
	const updatedMetadata = buildCodingAgentMetadata(metadata);
	if (Object.entries(added).some(([key, value]) => updatedMetadata[key] !== value)) throw new Error(SETTLEMENT_ATTRIBUTION_LOST_MESSAGE);
	if (endTime === void 0 && !state.quiet) return void 0;
	return {
		metadata,
		added,
		endTime: endTime ?? lastCapturedTime(events)
	};
}
function lastCapturedTime(events) {
	return new Date(Math.max(...events.map(({ record }) => record.capturedAtMs))).toISOString();
}
const warnedDroppedRuns = /* @__PURE__ */ new Set();
function warnAboutDroppedRuns(turnId, runIds) {
	for (const runId of runIds) {
		const key = JSON.stringify([turnId, runId]);
		if (warnedDroppedRuns.has(key)) continue;
		warnedDroppedRuns.add(key);
		console.warn(fillTemplate(SETTLEMENT_DROPPED_RUN_WARNING, { runId }));
	}
}
function settlementCaptureInput(state, generated, options, runId, plan) {
	const { turnId, rootRunId, childRunIds, closureState, dependencies, captureEvents } = state;
	const events = captureEvents.get(runId);
	const latest = events.at(-1);
	const submission = patchPayload(latest, plan.metadata, options.integration, plan.endTime, hasCausalRunError(events), events);
	const eventId = settlementEventId(turnId, runId, dependencies, rootRunId, childRunIds, plan.added);
	const previous = orderSourceCaptures(generated.filter((item) => item.runId === runId && item.eventId !== eventId)).at(-1);
	const previousDependency = previous === void 0 ? [] : [scopeOf(previous)];
	return {
		scope: {
			integration: options.integration,
			sessionId: options.sessionId,
			turnId,
			eventId
		},
		input: {
			turnId,
			eventId,
			runId,
			destinationFingerprint: options.destinationFingerprint,
			eventKind: LIFECYCLE_SETTLEMENT_EVENT_KIND,
			normalizedPayload: canonicalJsonValue(submission.payload),
			metadataProvenance: canonicalJsonValue(submission.metadata),
			turnEvidence: canonicalJsonValue({
				rootRunId,
				childRunIds: [...childRunIds].toSorted(),
				closureState,
				[LIFECYCLE_ATTRIBUTION_READY_FIELD]: latest.attributionReady
			}),
			dependencies: uniqueScopes([...dependencies, ...previousDependency])
		}
	};
}
async function captureRunPatch(state, generated, options, runId, plan) {
	const { input, scope } = settlementCaptureInput(state, generated, options, runId, plan);
	const result = await options.capture(input);
	if (result.status === "failed" || result.status === "conflict") throw new Error(`Could not capture settled run ${runId}: ${result.status}`);
	return {
		patch: {
			turnId: state.turnId,
			runId,
			scope
		},
		published: result.status === "published"
	};
}
async function captureTurnPatches(state, requiredRunIds, currentByRunId, generated, options) {
	const patches = [];
	let captured = 0;
	for (const runId of requiredRunIds) {
		if (!currentByRunId.has(runId)) continue;
		const plan = planRunPatch(state, runId);
		if (plan === void 0) continue;
		const outcome = await captureRunPatch(state, generated, options, runId, plan);
		if (outcome.published) captured += 1;
		patches.push(outcome.patch);
	}
	return {
		report: {
			...report(state.turnId, patches.length === 0 ? "settled" : "pending", patches.length === 0 ? "no-change" : "settlement-pending", patches.map(({ runId }) => runId)),
			patches: patches.length,
			settled: {
				rootRunId: state.rootRunId,
				attribution: state.attribution ?? {}
			}
		},
		patches,
		captured
	};
}
function hasRootPost(events, evidence) {
	const [rootRunId] = evidence.rootRunIds;
	return evidence.rootRunIds.size === 1 && events.some(({ payload, record }) => record.runId === rootRunId && payload.operation === "post");
}
async function settleLateRuns(turnId, events, generated, settledTurn, options) {
	const currentByRunId = groupByRunId(events);
	const runIds = [...currentByRunId.keys()].filter((runId) => runId !== settledTurn.rootRunId && currentByRunId.get(runId).some(({ payload }) => payload.operation === "post"));
	return captureTurnPatches({
		turnId,
		rootRunId: settledTurn.rootRunId,
		childRunIds: new Set(runIds),
		closureState: "authoritative",
		quiet: isQuietTurn(events, options.now ?? Date.now()),
		dependencies: uniqueScopes(events.map(({ record }) => scopeOf(record))),
		attribution: Object.keys(settledTurn.attribution).length === 0 ? void 0 : settledTurn.attribution,
		recorded: new Map(runIds.map((runId) => [runId, recordRun(currentByRunId.get(runId))])),
		captureEvents: currentByRunId
	}, runIds, currentByRunId, generated, options);
}
async function settleOneTurn(turnId, events, generated, allByRunId, options) {
	const evidence = collectTurnEvidence(events);
	const settledTurn = hasRootPost(events, evidence) ? void 0 : await options.settledTurn(turnId);
	if (settledTurn !== void 0) return settleLateRuns(turnId, events, generated, settledTurn, options);
	const quiet = isQuietTurn(events, options.now ?? Date.now());
	const early = evidenceResult(turnId, events, evidence, quiet);
	if (early !== void 0) return early;
	const { childRunIds, closureState } = evidence;
	const rootRunId = [...evidence.rootRunIds][0];
	childRunIds.delete(rootRunId);
	const droppedRunIds = await options.droppedRunIds(turnId);
	if (droppedRunIds.has(rootRunId)) return unsettled(report(turnId, "blocked", "source-dropped", [rootRunId]));
	warnAboutDroppedRuns(turnId, [...childRunIds].filter((runId) => droppedRunIds.has(runId)));
	const requiredRunIds = [rootRunId, ...[...childRunIds].filter((runId) => !droppedRunIds.has(runId)).toSorted()];
	const currentByRunId = groupByRunId(events);
	const captureEvents = requiredRunEvents(requiredRunIds, rootRunId, currentByRunId, allByRunId);
	const missingRunId = requiredRunIds.find((runId) => !captureEvents.get(runId).some(({ payload }) => payload.operation === "post"));
	if (missingRunId !== void 0) return unsettled(report(turnId, "deferred", "missing-run", [missingRunId]));
	const sourceEvents = [...events];
	for (const childRunId of childRunIds) sourceEvents.push(...allByRunId.get(childRunId) ?? []);
	const sourceScopes = uniqueScopes(sourceEvents.map(({ record }) => scopeOf(record)));
	const recorded = new Map(requiredRunIds.map((runId) => [runId, recordRun(captureEvents.get(runId))]));
	return captureTurnPatches({
		turnId,
		rootRunId,
		childRunIds,
		closureState,
		quiet,
		dependencies: sourceScopes,
		attribution: turnAttribution(buildTurnRecord(turnId, rootRunId, requiredRunIds, recorded)),
		recorded,
		captureEvents
	}, requiredRunIds, currentByRunId, generated, options);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/settlement/pass.js
async function settleCapturedTurns(options) {
	if (options.destinations.length === 0) throw new TypeError("At least one settlement destination is required");
	const sourceRecords = orderSourceCaptures(options.captures.map(({ record }) => record).filter((record) => record.integration === options.integration && record.sessionId === options.sessionId && record.destinationFingerprint === options.destinationFingerprint && (record.eventKind === "run-post" || record.eventKind === "run-patch")));
	const generatedRecords = options.captures.map(({ record }) => record).filter((record) => record.integration === options.integration && record.sessionId === options.sessionId && record.destinationFingerprint === options.destinationFingerprint && record.eventKind === "run-settlement-patch");
	const projected = /* @__PURE__ */ new Map();
	const allByRunId = /* @__PURE__ */ new Map();
	for (const record of sourceRecords) {
		const capture = projectCapture(record, options.integration);
		if (capture === void 0) continue;
		const turn = projected.get(record.turnId) ?? [];
		turn.push(capture);
		projected.set(record.turnId, turn);
		const runEvents = allByRunId.get(record.runId) ?? [];
		runEvents.push(capture);
		allByRunId.set(record.runId, runEvents);
	}
	const generatedByTurn = groupByTurn(generatedRecords);
	const turns = [.../* @__PURE__ */ new Set([...projected.keys(), ...generatedByTurn.keys()])].toSorted();
	const reports = [];
	const patches = [];
	let captured = 0;
	for (const turnId of turns) {
		const result = await settleOneTurn(turnId, projected.get(turnId) ?? [], generatedByTurn.get(turnId) ?? [], allByRunId, options);
		reports.push(result.report);
		patches.push(...result.patches);
		captured += result.captured;
	}
	return {
		progress: {
			captured,
			turns: reports
		},
		patches
	};
}
async function refreshSettlementProgress(work, destinations, readOutcome) {
	const patchesByTurn = /* @__PURE__ */ new Map();
	for (const patch of work.patches) {
		const turn = patchesByTurn.get(patch.turnId) ?? [];
		turn.push(patch);
		patchesByTurn.set(patch.turnId, turn);
	}
	const turns = [];
	for (const entry of work.progress.turns) {
		const patches = patchesByTurn.get(entry.turnId) ?? [];
		if (patches.length === 0 || entry.status !== "pending" && entry.status !== "settled") {
			turns.push(entry);
			continue;
		}
		const readiness = await captureReadiness(patches.map(({ scope }) => scope), destinations, readOutcome);
		const { reason: previousReason, destinations: previousDestinations, ...unchanged } = entry;
		const reason = readiness.status === "delivered" ? previousReason === "settlement-pending" ? void 0 : previousReason : readiness.status === "dropped" ? "settlement-dropped" : "settlement-pending";
		const reportDestinations = readiness.destinations.length > 0 ? readiness.destinations : previousReason === "settlement-pending" ? void 0 : previousDestinations;
		turns.push({
			...unchanged,
			status: readiness.status === "pending" ? "pending" : "settled",
			...reason === void 0 ? {} : { reason },
			...reportDestinations === void 0 ? {} : { destinations: reportDestinations }
		});
	}
	return {
		captured: work.progress.captured,
		turns
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/validation/snapshot.js
function snapshotData(value) {
	return copySnapshot(value, /* @__PURE__ */ new WeakMap());
}
function copySnapshot(value, copies) {
	if (value === null || typeof value !== "object") return value;
	const previous = copies.get(value);
	if (previous !== void 0) return previous;
	const prototype = Object.getPrototypeOf(value);
	if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) throw new TypeError("Snapshot input must contain plain objects and arrays");
	let copy;
	if (Array.isArray(value)) {
		const array = [];
		array.length = value.length;
		copy = array;
	} else copy = Object.create(prototype);
	copies.set(value, copy);
	for (const key of Reflect.ownKeys(value)) {
		if (Array.isArray(value) && key === "length") continue;
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (descriptor === void 0 || !("value" in descriptor)) throw new TypeError("Snapshot input must use data properties");
		Object.defineProperty(copy, key, {
			value: copySnapshot(descriptor.value, copies),
			enumerable: descriptor.enumerable === true,
			configurable: true,
			writable: true
		});
	}
	return copy;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/turn-removal.js
async function removeSettledTurns(options) {
	const known = new Set(options.knownScopes.map(turnEventKey));
	const removable = /* @__PURE__ */ new Map();
	for (const turnId of options.settledTurnIds) {
		const records = (await options.store.enumerateTurn(options.integration, options.sessionId, turnId)).map(({ record }) => record).filter((record) => record.destinationFingerprint === options.destinationFingerprint);
		if (records.every((record) => known.has(turnEventKey(record)) && isSettled(record, options.destinations))) removable.set(turnId, records);
	}
	const childTurns = [];
	const removedRunIds = /* @__PURE__ */ new Set();
	for (const [turnId, records] of removable) {
		if (rootParentRunId(records) !== void 0) {
			childTurns.push([turnId, records]);
			continue;
		}
		await removeRecords(options, records, turnId);
		for (const { runId } of records) removedRunIds.add(runId);
	}
	if (childTurns.length === 0) return;
	const savedRunIds = new Set((await options.store.enumerate(options.integration, options.sessionId)).map(({ record }) => record.runId));
	let pending = childTurns;
	while (pending.length > 0) {
		const waiting = [];
		for (const [turnId, records] of pending) {
			const parent = rootParentRunId(records);
			const newest = Math.max(...records.map(({ capturedAtMs }) => capturedAtMs));
			const orphaned = !savedRunIds.has(parent) && Date.now() - newest >= 36e5;
			if (!removedRunIds.has(parent) && !orphaned) {
				waiting.push([turnId, records]);
				continue;
			}
			await removeRecords(options, records, turnId);
			for (const { runId } of records) removedRunIds.add(runId);
		}
		if (waiting.length === pending.length) return;
		pending = waiting;
	}
}
async function removeRecords(options, records, turnId) {
	await options.store.removeTurn(records, options.settledTurns?.get(turnId));
}
function turnEventKey(scope) {
	return JSON.stringify([scope.turnId, scope.eventId]);
}
function isSettled(record, destinations) {
	return destinations.every(({ id }) => record.delivery?.outcomes[id] !== void 0);
}
function rootParentRunId(records) {
	for (const record of records) {
		const rootRunId = field(record.turnEvidence, "rootRunId");
		if (typeof rootRunId !== "string" || record.runId !== rootRunId) continue;
		const parent = field(field(record.normalizedPayload, "run"), "parent_run_id");
		if (typeof parent === "string") return parent;
	}
}
function field(value, key) {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value[key] : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/lifecycle/bridge.js
function createLifecycleBridge(options) {
	const context = createBridgeContext(options);
	return Object.freeze({
		accountFingerprint: context.writer.accountFingerprint,
		capture: (input) => captureLifecycleSubmission(context, input),
		drain: (input = {}) => drainLifecycleWork(context, input)
	});
}
function createBridgeContext(options) {
	const integration = options.integration;
	const sessionId = requireNonBlankString(options.sessionId, "Session ID");
	const storageRoot = resolve(options.storageRoot);
	return {
		integration,
		sessionId,
		storageRoot,
		captureStore: createCaptureStore(storageRoot),
		coordinator: createDeliveryCoordinator({
			storageRoot,
			integration,
			sessionId,
			...options.policy === void 0 ? {} : { policy: options.policy }
		}),
		writer: createLangSmithUploadWriter({
			...options.writer,
			storageRoot: options.storageRoot
		}),
		policy: resolvePolicy(options.policy),
		wake: options.wake
	};
}
function parseCaptureRequest(input) {
	const record = requirePlainRecord(snapshotData(requirePlainRecord(input, "Lifecycle capture")), "Lifecycle capture");
	const turnId = requireNonBlankString(record["turnId"], "Turn ID");
	const eventId = requireNonBlankString(record["eventId"], "Event ID");
	const sourceAge = ownDataField(record, "sourceAgeStartedAtMs");
	return {
		record,
		turnId,
		eventId,
		sourceAgeStartedAtMs: sourceAge.present ? requireSafeEpochMilliseconds(sourceAge.value, "Source age") : void 0
	};
}
async function parentPostDependency(context, supplied, value) {
	const parentRunId = value.payload.run.parent_run_id;
	if (value.payload.operation !== "post" || parentRunId === void 0) return [];
	for (const scope of supplied ?? []) {
		const record = await context.captureStore.read(scope).catch(() => void 0);
		if (record?.runId === parentRunId && record.eventKind === "run-post") return [];
	}
	const parent = (await context.captureStore.enumerate(context.integration, context.sessionId)).find(({ record }) => record.runId === parentRunId && record.eventKind === "run-post");
	return parent === void 0 ? [] : [scopeOf(parent.record)];
}
async function captureDependencies(context, request, value) {
	const supplied = request.record["dependencies"];
	const previous = await context.captureStore.read({
		integration: context.integration,
		sessionId: context.sessionId,
		turnId: request.turnId,
		eventId: request.eventId
	});
	const suppliedKeys = new Set((supplied ?? []).map(scopeKey));
	if (previous?.dependencies?.some((scope) => !suppliedKeys.has(scopeKey(scope)))) return previous.dependencies;
	if (previous !== void 0) return supplied;
	const parent = (await parentPostDependency(context, supplied, value)).filter((scope) => !suppliedKeys.has(scopeKey(scope)));
	return parent.length === 0 ? supplied : [...supplied ?? [], ...parent];
}
async function saveProjectedSubmission(context, request, turnEvidence, value) {
	const dependencies = await captureDependencies(context, request, value);
	return context.coordinator.capture({
		turnId: request.turnId,
		eventId: request.eventId,
		runId: value.payload.run.id,
		destinationFingerprint: context.writer.accountFingerprint,
		eventKind: value.payload.operation === "post" ? LIFECYCLE_POST_EVENT_KIND : LIFECYCLE_PATCH_EVENT_KIND,
		normalizedPayload: canonicalJsonValue(value.payload),
		turnEvidence,
		metadataProvenance: canonicalJsonValue(value.metadata),
		...request.sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs: request.sourceAgeStartedAtMs },
		...dependencies === void 0 ? {} : { dependencies },
		destinationRoutes: context.writer.routes
	});
}
async function retryWithoutSuppliedIdentity(context, request, scope, turnEvidence, projected, identityPresence) {
	const winner = await context.captureStore.read(scope);
	if (winner?.runId !== projected.payload.run.id) return void 0;
	const run = { ...projected.payload.run };
	if (!identityPresence.startTime) delete run.start_time;
	if (!identityPresence.traceId) delete run.trace_id;
	if (!identityPresence.dottedOrder) delete run.dotted_order;
	const retry = projectSubmission({
		...projected.payload,
		run,
		metadata: projected.metadata
	}, context.integration, previousRunContext(winner));
	if (retry.status !== "ready") return void 0;
	return saveProjectedSubmission(context, request, turnEvidence, retry.value);
}
async function captureLifecycleSubmission(context, input) {
	const request = parseCaptureRequest(input);
	const scope = {
		integration: context.integration,
		sessionId: context.sessionId,
		turnId: request.turnId,
		eventId: request.eventId
	};
	const previous = await context.captureStore.read(scope);
	const projected = projectSubmission(request.record["submission"], context.integration, previous === void 0 ? void 0 : previousRunContext(previous));
	if (projected.status === "deferred") return {
		status: "deferred",
		reason: "missing-thread-identity"
	};
	const turnEvidence = projectTurnEvidence(request.record["turnEvidence"], projected.value.payload.privacyMode, deriveAttributionReadiness(request.record["submission"], context.integration));
	const identityPresence = projected.value.payload.operation === "post" ? suppliedRunIdentityFields(request.record["submission"]) : void 0;
	let result = await saveProjectedSubmission(context, request, turnEvidence, projected.value);
	if (result.status === "conflict" && previous === void 0 && identityPresence !== void 0 && projected.value.payload.operation === "post") result = await retryWithoutSuppliedIdentity(context, request, scope, turnEvidence, projected.value, identityPresence) ?? result;
	if (result.status === "published" || result.status === "duplicate") await wakeCapturedWork(result, () => context.wake?.());
	return result;
}
function busyDrainResult() {
	return {
		status: "busy",
		settlement: {
			captured: 0,
			turns: []
		}
	};
}
async function acquireSettlementLock(context) {
	const directory = await ensurePrivateDirectory(context.storageRoot, sessionSegments(identifierHash(context.sessionId)));
	const path = join(directory, `${LIFECYCLE_SETTLEMENT_LOCK_PREFIX}${identifierHash(context.writer.accountFingerprint)}`);
	return {
		path,
		lock: await tryAcquireFileLock(path)
	};
}
async function sweepWithWarning(fallback, sweep) {
	try {
		return await sweep();
	} catch (error) {
		console.warn(LIFECYCLE_SWEEP_WARNING, describe(error));
		return fallback;
	}
}
function sweepExpiredCaptures(context, now) {
	return sweepWithWarning(0, () => removeExpiredCaptures({
		store: context.captureStore,
		integration: context.integration,
		destinations: context.writer.destinations.map(({ id }) => id),
		accountFingerprint: context.writer.accountFingerprint,
		now,
		maxAgeMs: context.policy.maxAgeMs,
		heldUpdate: (record, captures) => isHeldUpdate(record, captures, context.integration)
	}));
}
function sweepStaleFiles(context, now) {
	return sweepWithWarning(0, () => removeStaleStorageFiles(context.storageRoot, LIFECYCLE_ENGINE_FOLDERS, now - STORAGE_STALE_FILE_MAX_AGE_MS));
}
function readCaptureOutcome(context) {
	return (scope, destination) => context.captureStore.readOutcome(scope, destination);
}
async function sendCapturedRuns(context, send) {
	const { sourceSnapshot, sourceByScope, records, destination, fingerprint } = send;
	const { integration, writer } = context;
	if (fingerprint !== writer.accountFingerprint) throw new Error(LIFECYCLE_UPLOAD_ACCOUNT_CHANGED_MESSAGE);
	const items = [];
	for (const record of records) {
		const submission = restoreSubmission(record, integration);
		const ready = await withholdUnresolvedEndTime({
			record,
			submission,
			sourceSnapshot,
			sourceByScope,
			integration,
			destinations: writer.destinations,
			readOutcome: readCaptureOutcome(context)
		}) ?? await afterSettledTurn(context, record, submission, sourceSnapshot);
		if (ready === void 0) continue;
		const route = capturedRoute(record, sourceSnapshot, destination.id);
		items.push(route === void 0 ? { submission: ready } : {
			submission: ready,
			route
		});
	}
	await writer.sendBatch(items, destination.id);
}
async function afterSettledTurn(context, record, submission, sourceSnapshot) {
	const { captureStore, integration, sessionId } = context;
	const settled = await captureStore.readSettledTurn(integration, sessionId, record.turnId);
	if (settled !== void 0) return {
		...submission,
		metadata: addAttribution(submission.metadata, settled.attribution)
	};
	return sourceSnapshot.some((source) => source.runId === record.runId && source.eventKind === "run-post") ? void 0 : submission;
}
async function drainOnce(context, attempted) {
	const { captureStore, integration, sessionId, writer } = context;
	const sourceSnapshot = (await captureStore.enumerate(integration, sessionId)).map(({ record }) => record);
	const sourceByScope = indexCaptureSources(sourceSnapshot);
	return context.coordinator.drain({
		writer: {
			accountFingerprint: writer.accountFingerprint,
			destinations: writer.destinations,
			sendBatch: (records, destination, fingerprint) => sendCapturedRuns(context, {
				sourceSnapshot,
				sourceByScope,
				records,
				destination,
				fingerprint
			}),
			batchLimits: {
				maxRecords: writer.batchLimits.maxRuns,
				maxBytes: writer.batchLimits.maxBytes
			}
		},
		attempted
	});
}
async function settleSessionTurns(context) {
	const { captureStore, coordinator, integration, sessionId, writer } = context;
	const captures = await captureStore.enumerate(integration, sessionId);
	return {
		captures,
		work: await settleCapturedTurns({
			captures,
			integration,
			sessionId,
			destinationFingerprint: writer.accountFingerprint,
			destinations: writer.destinations,
			capture: (captureInput) => coordinator.capture(captureInput),
			readOutcome: readCaptureOutcome(context),
			droppedRunIds: (turnId) => captureStore.readDroppedRunIds(integration, sessionId, turnId),
			settledTurn: (turnId) => captureStore.readSettledTurn(integration, sessionId, turnId)
		})
	};
}
function mergeDrainResults(first, second) {
	return {
		status: "drained",
		delivered: first.delivered + second.delivered,
		dropped: first.dropped + second.dropped,
		failed: first.failed + second.failed,
		pending: second.pending,
		...second.nextRetryAtMs === void 0 ? {} : { nextRetryAtMs: second.nextRetryAtMs },
		accountMismatch: second.accountMismatch
	};
}
async function drainWhileLocked(context, input) {
	const { captureStore, integration, sessionId, writer } = context;
	const attempted = /* @__PURE__ */ new Set();
	const now = input.now ?? Date.now();
	const expired = await sweepExpiredCaptures(context, now);
	await sweepStaleFiles(context, now);
	const first = await drainOnce(context, attempted);
	if (first.status === "busy") return busyDrainResult();
	const { captures, work } = await settleSessionTurns(context);
	let result = first;
	if (work.progress.captured > 0) {
		const second = await drainOnce(context, attempted);
		if (second.status === "drained") result = mergeDrainResults(first, second);
	}
	const readOutcome = readCaptureOutcome(context);
	const settlement = await refreshSettlementProgress(work, writer.destinations, readOutcome);
	await removeSettledTurns({
		integration,
		sessionId,
		destinationFingerprint: writer.accountFingerprint,
		store: captureStore,
		destinations: writer.destinations,
		settledTurnIds: settlement.turns.filter((entry) => entry.status === "settled").map((entry) => entry.turnId),
		settledTurns: new Map(settlement.turns.flatMap((entry) => entry.settled === void 0 ? [] : [[entry.turnId, entry.settled]])),
		knownScopes: [...captures.map(({ record }) => record), ...work.patches.map(({ scope }) => scope)]
	});
	return {
		...result,
		dropped: result.dropped + expired,
		settlement
	};
}
async function drainLifecycleWork(context, input) {
	const { path, lock } = await acquireSettlementLock(context);
	if (lock === void 0) return busyDrainResult();
	let drainResult;
	try {
		drainResult = await drainWhileLocked(context, input);
	} finally {
		await lock.release();
		await removeEmptyLockFolders(path, context.storageRoot);
	}
	if (drainResult.status === "drained" && drainResult.delivered + drainResult.dropped > 0) await context.wake?.();
	return drainResult;
}
function capturedRoute(record, sourceSnapshot, destination) {
	return record.destinationRoutes?.[destination] ?? sourceSnapshot.find((source) => source.runId === record.runId && source.destinationRoutes?.[destination] !== void 0)?.destinationRoutes?.[destination];
}
function suppliedRunIdentityFields(value) {
	const run = requirePlainRecord(requireOwnDataField(requirePlainRecord(value, "Prepared run submission"), "run"), "Normalized run snapshot");
	const supplied = (key) => {
		const field = ownDataField(run, key);
		return field.present && field.value !== void 0;
	};
	return {
		startTime: supplied("start_time"),
		traceId: supplied("trace_id"),
		dottedOrder: supplied("dotted_order")
	};
}
function previousRunContext(record) {
	const runField = ownDataField(requirePlainRecord(record.normalizedPayload, "Stored run payload"), "run");
	if (!runField.present) throw new TypeError(LIFECYCLE_STORED_RUN_CONTEXT_IS_REQUIRED_MESSAGE);
	const run = requirePlainRecord(runField.value, "Stored run context");
	const context = {
		id: requireNonBlankString(run["id"], "Run ID"),
		name: requireNonBlankString(run["name"], "Run name"),
		run_type: requireNonBlankString(run["run_type"], "Run type")
	};
	const startTime = ownDataField(run, "start_time");
	if (startTime.present && startTime.value !== void 0) context.start_time = requireTimestamp(startTime.value);
	const parentRunId = ownDataField(run, "parent_run_id");
	if (parentRunId.present && parentRunId.value !== void 0) context.parent_run_id = requireNonBlankString(parentRunId.value, "Parent run ID");
	const traceId = ownDataField(run, "trace_id");
	if (traceId.present && traceId.value !== void 0) context.trace_id = requireNonBlankString(traceId.value, "Trace ID");
	const dottedOrder = ownDataField(run, "dotted_order");
	if (dottedOrder.present && dottedOrder.value !== void 0) context.dotted_order = requireNonBlankString(dottedOrder.value, "Dotted order");
	return context;
}
function restoreSubmission(record, integration) {
	const payload = canonicalJsonObject(record.normalizedPayload, "Stored run payload");
	if (payload["integration"] !== integration) throw new TypeError(LIFECYCLE_STORED_INTEGRATION_DOES_NOT_MATCH_LIFECYCLE_BRIDGE_MESSAGE);
	if (payload["run"] === null || typeof payload["run"] !== "object") throw new TypeError(LIFECYCLE_STORED_RUN_DATA_IS_REQUIRED_MESSAGE);
	if (payload["run"]["id"] !== record.runId) throw new TypeError(LIFECYCLE_STORED_RUN_ID_DOES_NOT_MATCH_ITS_CAPTURE_MESSAGE);
	const mode = payload["privacyMode"];
	if (mode !== "full" && mode !== "metadata") throw new TypeError(LIFECYCLE_STORED_PRIVACY_MODE_IS_INVALID_MESSAGE);
	const projected = projectSubmission({
		...payload,
		metadata: record.metadataProvenance
	}, integration);
	if (projected.status === "deferred") throw new TypeError(LIFECYCLE_STORED_CAPTURE_IS_MISSING_THREAD_IDENTITY_MESSAGE);
	return {
		...projected.value.payload,
		metadata: projected.value.metadata
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/constants.js
const RECONSTRUCTION_DRAIN_LOCK = "reconstruction";
const RECONSTRUCTION_RUN_ID_PREFIX = "reconstruction:";
const RECONSTRUCTION_MAPPING_EVENT_ID_PREFIX = "reconstruction-map:";
const RECONSTRUCTION_JOB_KIND = "reconstruction-job-v1";
const RECONSTRUCTION_MAPPING_KIND = "reconstruction-map-v1";
const RECONSTRUCTION_CLOSURE_STATES = [
	"open",
	"provisional",
	"authoritative"
];
const RECONSTRUCTION_JOB_INPUT_KEYS = [
	"eventId",
	"privacyMode",
	"sourceRefs",
	"turnEvidence",
	"turnId"
];
const RECONSTRUCTION_JOB_OPTIONAL_INPUT_KEYS = ["sourceAgeStartedAtMs", "sourceSnapshots"];
const RECONSTRUCTION_SOURCE_SNAPSHOT_KEYS = [
	"sourceAgeStartedAtMs",
	"sourceRef",
	"submission"
];
const RECONSTRUCTION_SOURCE_SNAPSHOT_OPTIONAL_KEYS = ["attributionContext"];
const RECONSTRUCTION_STORED_JOB_KEYS = [
	"privacyMode",
	"recordVersion",
	"sourceRefs"
];
const RECONSTRUCTION_STORED_JOB_OPTIONAL_KEYS = ["sourceAgeStartedAtMs", "sourceSnapshots"];
const RECONSTRUCTION_ATTRIBUTION_CONTEXT_KEYS = ["toolOrigin"];
const RECONSTRUCTION_ATTRIBUTION_CONTEXT_OPTIONAL_KEYS = ["pinnedRepositoryKeys"];
const RECONSTRUCTION_TOOL_ORIGIN_KEYS = ["namedAPath"];
const RECONSTRUCTION_TOOL_ORIGIN_OPTIONAL_KEYS = ["cwd", "path"];
const RECONSTRUCTION_OUTPUT_KEYS = ["eventId", "submission"];
const RECONSTRUCTION_OUTPUT_OPTIONAL_KEYS = [
	"dependencies",
	"sourceRef",
	"turnEvidence"
];
const RECONSTRUCTION_TURN_EVIDENCE_KEYS = ["childRunIds", "closureState"];
const RECONSTRUCTION_TURN_EVIDENCE_KEYS_WITH_ROOT = [
	"childRunIds",
	"closureState",
	"rootRunId"
];
const RECONSTRUCTION_DEPENDENCY_KEYS = [
	"eventId",
	"integration",
	"sessionId",
	"turnId"
];
const RECONSTRUCTION_OUTPUTS_MUST_BE_ARRAY_MESSAGE = "Reconstruction outputs must be an array";
const RECONSTRUCTION_OUTPUT_HAS_UNSUPPORTED_FIELDS_MESSAGE = "Reconstruction output has unsupported fields";
const RECONSTRUCTION_EVENT_IDS_MUST_BE_UNIQUE_MESSAGE = "Reconstruction event IDs must be unique";
const RECONSTRUCTION_INTEGRATION_CHANGED_MESSAGE = "Reconstruction integration changed";
const RECONSTRUCTION_PRIVACY_MODE_IS_INVALID_MESSAGE = "Reconstruction privacy mode is invalid";
const RECONSTRUCTION_METADATA_FULL_MODE_MESSAGE = "Metadata reconstruction cannot emit full-mode captures";
const RECONSTRUCTION_DEPENDENCIES_MUST_BE_ARRAY_MESSAGE = "Reconstruction dependencies must be an array";
const RECONSTRUCTION_EVIDENCE_IDENTITY_MESSAGE = "Reconstructed turn evidence must preserve known run identities";
const RECONSTRUCTION_SNAPSHOT_OUTPUTS_REQUIRE_SOURCE_REF_MESSAGE = "Snapshot outputs require a source ref";
const RECONSTRUCTION_OUTPUT_SOURCE_REF_HAS_NO_SNAPSHOT_MESSAGE = "Output source ref has no snapshot";
const RECONSTRUCTION_OUTPUT_REF_UNKNOWN_MESSAGE = "Output source ref is not in the reconstruction job";
const RECONSTRUCTION_DEPENDENCY_SCOPE_MESSAGE = "Reconstruction dependencies must contain only capture scopes";
const RECONSTRUCTION_DEPENDENCY_INTEGRATION_MESSAGE = "Reconstruction dependencies must use the same integration";
const RECONSTRUCTION_CAPTURES_CANNOT_DEPEND_ON_THEMSELVES_MESSAGE = "Reconstruction captures cannot depend on themselves";
const RECONSTRUCTION_DEPENDENCIES_MUST_BE_UNIQUE_MESSAGE = "Reconstruction dependencies must be unique";
const RECONSTRUCTION_JOB_HAS_UNSUPPORTED_FIELDS_MESSAGE = "Reconstruction job has unsupported fields";
const RECONSTRUCTION_SOURCE_REFS_ARE_REQUIRED_MESSAGE = "Reconstruction source refs are required";
const RECONSTRUCTION_SOURCE_REFS_MUST_BE_UNIQUE_MESSAGE = "Reconstruction source refs must be unique";
const RECONSTRUCTION_SOURCE_CONFLICT_MESSAGE = "Reconstruction jobs cannot combine snapshots with a job-level source age";
const RECONSTRUCTION_SNAPSHOTS_EMPTY_MESSAGE = "Reconstruction source snapshots must be a nonempty array";
const RECONSTRUCTION_SNAPSHOT_FIELDS_MESSAGE = "Reconstruction source snapshot has unsupported fields";
const RECONSTRUCTION_SNAPSHOT_REF_MUST_BELONG_TO_JOB_MESSAGE = "Reconstruction snapshot ref must belong to the job";
const RECONSTRUCTION_SNAPSHOT_REFS_MUST_BE_UNIQUE_MESSAGE = "Reconstruction snapshot refs must be unique";
const RECONSTRUCTION_SNAPSHOT_PRIVACY_MESSAGE = "Snapshot privacy mode must match the reconstruction job";
const RECONSTRUCTION_SNAPSHOT_START_TIME_MESSAGE = "Source snapshot posts must preserve their start time";
const RECONSTRUCTION_SNAPSHOT_NOT_READY_MESSAGE = "Reconstruction snapshots must be ready for shared projection";
const RECONSTRUCTION_SNAPSHOT_COVERAGE_MESSAGE = "Source snapshots must cover every reconstruction source ref";
const RECONSTRUCTION_PATHLESS_REF_MESSAGE = "Snapshot source refs must be pathless identifiers";
const RECONSTRUCTION_CONTEXT_FIELDS_MESSAGE = "Attribution context has unsupported fields";
const RECONSTRUCTION_TOOL_ORIGIN_HAS_UNSUPPORTED_FIELDS_MESSAGE = "Tool origin has unsupported fields";
const RECONSTRUCTION_PINNED_BLANK_MESSAGE = "Pinned repository keys must be nonblank";
const RECONSTRUCTION_PINNED_UNIQUE_MESSAGE = "Pinned repository keys must be unique";
const RECONSTRUCTION_EVIDENCE_STRUCTURAL_MESSAGE = "Reconstruction turn evidence must be structural only";
const RECONSTRUCTION_CLOSURE_STATE_MESSAGE = "Reconstruction turn evidence has an invalid closure state";
const RECONSTRUCTION_STORED_NAMESPACE_MESSAGE = "Stored reconstruction job namespace does not match";
const RECONSTRUCTION_UNSUPPORTED_RECONSTRUCTION_JOB_MESSAGE = "Unsupported reconstruction job";
const RECONSTRUCTION_STORED_FIELDS_MESSAGE = "Stored reconstruction job has unsupported fields";
const RECONSTRUCTION_STORED_PRIVACY_MESSAGE = "Invalid stored reconstruction privacy mode";
const RECONSTRUCTION_STORED_REFS_EMPTY_MESSAGE = "Stored reconstruction source refs are empty";
const RECONSTRUCTION_STORED_REFS_UNIQUE_MESSAGE = "Stored reconstruction source refs are not unique";
const RECONSTRUCTION_STORED_SOURCE_CONFLICT_MESSAGE = "Stored reconstruction job combines snapshots with a job-level source age";
const RECONSTRUCTION_PROVENANCE_MESSAGE = "Reconstruction jobs cannot store metadata provenance";
const RECONSTRUCTION_JOB_DEPENDENCIES_MESSAGE = "Reconstruction jobs cannot have capture dependencies";
const RECONSTRUCTION_UNSUPPORTED_RECONSTRUCTION_MAPPING_MESSAGE = "Unsupported reconstruction mapping";
const RECONSTRUCTION_STORED_NO_OUTPUTS_MESSAGE = "Stored reconstruction mapping has no outputs";
const RECONSTRUCTION_STORED_EVENTS_UNIQUE_MESSAGE = "Stored reconstruction event IDs are not unique";
const RECONSTRUCTION_STORED_DEPENDENCIES_MESSAGE = "Stored reconstruction dependencies are invalid";
const RECONSTRUCTION_DEFERRAL_REASON_INVALID_MESSAGE = "Invalid reconstruction deferral reason";
const RECONSTRUCTION_RESULT_STATUS_INVALID_MESSAGE = "Invalid reconstruction result status";
const RECONSTRUCTION_TERMINAL_OUTCOME_MESSAGE = "Could not record terminal reconstruction outcome:";
const RECONSTRUCTION_CALLBACKS_REQUIRED_MESSAGE = "Reconstruction callbacks are required";
const RECONSTRUCTION_DRAIN_TIME_MESSAGE = "Drain time must be finite";
const RECONSTRUCTION_RECORD_UNSUPPORTED_MESSAGE = "Unsupported reconstruction record";
const RECONSTRUCTION_JOB_MISSING_MESSAGE = "Reconstruction job disappeared";
const RECONSTRUCTION_LABEL_OUTPUT = "Reconstruction output";
const RECONSTRUCTION_LABEL_EVENT_ID = "Event ID";
const RECONSTRUCTION_LABEL_EVENT_ID_FIELD = "event ID";
const RECONSTRUCTION_LABEL_SUBMISSION = "Reconstruction submission";
const RECONSTRUCTION_LABEL_RUN_ID = "Run ID";
const RECONSTRUCTION_LABEL_RUN_ID_FIELD = "run ID";
const RECONSTRUCTION_LABEL_SOURCE_REF = "Source ref";
const RECONSTRUCTION_LABEL_SOURCE_REF_FIELD = "source ref";
const RECONSTRUCTION_SUBMISSION_INVALID_MESSAGE = "Reconstruction submission is invalid";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/known-keys.js
function assertKnownKeys(record, required, optional, message) {
	const keys = Object.keys(record);
	if (required.some((key) => !keys.includes(key)) || keys.some((key) => !required.includes(key) && !optional.includes(key))) throw new TypeError(message);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/job-validation.js
function readEventId(output, seen) {
	const eventId = requireNonBlankString(requireOwnDataField(output, "eventId"), RECONSTRUCTION_LABEL_EVENT_ID);
	validateIdentifier(eventId, RECONSTRUCTION_LABEL_EVENT_ID_FIELD);
	if (seen.has(eventId)) throw new TypeError(RECONSTRUCTION_EVENT_IDS_MUST_BE_UNIQUE_MESSAGE);
	seen.add(eventId);
	return eventId;
}
function isPreparedSubmission(value) {
	const fields = value;
	return typeof fields["integration"] === "string" && (fields["privacyMode"] === "full" || fields["privacyMode"] === "metadata") && isPlainRecord(fields["run"]);
}
function readSubmission(output, job) {
	const submission = canonicalJsonObject(requirePlainRecord(requireOwnDataField(output, "submission"), RECONSTRUCTION_LABEL_SUBMISSION), RECONSTRUCTION_LABEL_SUBMISSION);
	if (requireNonBlankString(requireOwnDataField(submission, "integration"), "Integration") !== job.integration) throw new TypeError(RECONSTRUCTION_INTEGRATION_CHANGED_MESSAGE);
	const privacyMode = requireOwnDataField(submission, "privacyMode");
	if (privacyMode !== "full" && privacyMode !== "metadata") throw new TypeError(RECONSTRUCTION_PRIVACY_MODE_IS_INVALID_MESSAGE);
	if (job.privacyMode === "metadata" && privacyMode === "full") throw new TypeError(RECONSTRUCTION_METADATA_FULL_MODE_MESSAGE);
	if (!isPreparedSubmission(submission)) throw new TypeError(RECONSTRUCTION_SUBMISSION_INVALID_MESSAGE);
	return submission;
}
function readRunId(submission) {
	const runId = requireNonBlankString(requireOwnDataField(requirePlainRecord(submission.run, "Run"), "id"), RECONSTRUCTION_LABEL_RUN_ID);
	validateIdentifier(runId, RECONSTRUCTION_LABEL_RUN_ID_FIELD);
	return runId;
}
function readDependencies(output, job, eventId) {
	const field = ownDataField(output, "dependencies");
	if (!field.present) return void 0;
	if (!Array.isArray(field.value)) throw new TypeError(RECONSTRUCTION_DEPENDENCIES_MUST_BE_ARRAY_MESSAGE);
	return validateDependencies(field.value, job, eventId);
}
function readTurnEvidence(output, job) {
	const field = ownDataField(output, "turnEvidence");
	const turnEvidence = field.present ? validateTurnEvidence(field.value) : void 0;
	if (turnEvidence !== void 0 && (job.turnEvidence.rootRunId !== void 0 && turnEvidence.rootRunId !== job.turnEvidence.rootRunId || job.turnEvidence.childRunIds.some((id) => !turnEvidence.childRunIds.includes(id)))) throw new TypeError(RECONSTRUCTION_EVIDENCE_IDENTITY_MESSAGE);
	return turnEvidence;
}
function readSourceRef(output) {
	const field = ownDataField(output, "sourceRef");
	if (!field.present) return void 0;
	const sourceRef = requireNonBlankString(field.value, RECONSTRUCTION_LABEL_SOURCE_REF);
	validateIdentifier(sourceRef, RECONSTRUCTION_LABEL_SOURCE_REF_FIELD);
	return sourceRef;
}
function sourceAgeFor(job, sourceRef, jobCapturedAtMs) {
	if (job.sourceSnapshots !== void 0) {
		if (sourceRef === void 0) throw new TypeError(RECONSTRUCTION_SNAPSHOT_OUTPUTS_REQUIRE_SOURCE_REF_MESSAGE);
		const snapshot = job.sourceSnapshots.find((candidate) => candidate.sourceRef === sourceRef);
		if (snapshot === void 0) throw new TypeError(RECONSTRUCTION_OUTPUT_SOURCE_REF_HAS_NO_SNAPSHOT_MESSAGE);
		return snapshot.sourceAgeStartedAtMs;
	}
	if (sourceRef !== void 0 && !job.sourceRefs.includes(sourceRef)) throw new TypeError(RECONSTRUCTION_OUTPUT_REF_UNKNOWN_MESSAGE);
	return job.sourceAgeStartedAtMs ?? jobCapturedAtMs;
}
function validateOutput(item, job, jobCapturedAtMs, seen) {
	const output = requirePlainRecord(item, RECONSTRUCTION_LABEL_OUTPUT);
	assertKnownKeys(output, RECONSTRUCTION_OUTPUT_KEYS, RECONSTRUCTION_OUTPUT_OPTIONAL_KEYS, RECONSTRUCTION_OUTPUT_HAS_UNSUPPORTED_FIELDS_MESSAGE);
	const eventId = readEventId(output, seen);
	const submission = readSubmission(output, job);
	const runId = readRunId(submission);
	const dependencies = readDependencies(output, job, eventId);
	const turnEvidence = readTurnEvidence(output, job);
	const sourceRef = readSourceRef(output);
	const sourceAgeStartedAtMs = sourceAgeFor(job, sourceRef, jobCapturedAtMs);
	return {
		eventId,
		runId,
		submission,
		...turnEvidence === void 0 ? {} : { turnEvidence },
		...sourceRef === void 0 ? {} : { sourceRef },
		...sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs },
		...dependencies === void 0 ? {} : { dependencies }
	};
}
function validateOutputs(value, job, jobCapturedAtMs) {
	if (!Array.isArray(value)) throw new TypeError(RECONSTRUCTION_OUTPUTS_MUST_BE_ARRAY_MESSAGE);
	const seen = /* @__PURE__ */ new Set();
	return value.map((item) => validateOutput(item, job, jobCapturedAtMs, seen));
}
function validateDependencies(value, job, eventId) {
	if (!Array.isArray(value)) throw new TypeError(RECONSTRUCTION_DEPENDENCIES_MUST_BE_ARRAY_MESSAGE);
	const dependent = {
		...scopeOf(job),
		eventId
	};
	const seen = /* @__PURE__ */ new Set();
	return value.map((item) => {
		const source = requirePlainRecord(item, "Reconstruction dependency");
		if (canonicalJson(Object.keys(source).toSorted()) !== canonicalJson(RECONSTRUCTION_DEPENDENCY_KEYS)) throw new TypeError(RECONSTRUCTION_DEPENDENCY_SCOPE_MESSAGE);
		const integration = requireNonBlankString(requireOwnDataField(source, "integration"), "Dependency integration");
		if (integration !== job.integration) throw new TypeError(RECONSTRUCTION_DEPENDENCY_INTEGRATION_MESSAGE);
		const scope = {
			integration,
			sessionId: requireNonBlankString(requireOwnDataField(source, "sessionId"), "Dependency session ID"),
			turnId: requireNonBlankString(requireOwnDataField(source, "turnId"), "Dependency turn ID"),
			eventId: requireNonBlankString(requireOwnDataField(source, "eventId"), "Dependency event ID")
		};
		validateIdentifier(scope.sessionId, "dependency session ID");
		validateIdentifier(scope.turnId, "dependency turn ID");
		validateIdentifier(scope.eventId, "dependency event ID");
		if (scope.sessionId === dependent.sessionId && scope.turnId === dependent.turnId && scope.eventId === dependent.eventId) throw new TypeError(RECONSTRUCTION_CAPTURES_CANNOT_DEPEND_ON_THEMSELVES_MESSAGE);
		const key = canonicalJson(scope);
		if (seen.has(key)) throw new TypeError(RECONSTRUCTION_DEPENDENCIES_MUST_BE_UNIQUE_MESSAGE);
		seen.add(key);
		return scope;
	});
}
function validateJobInput(value, integration, sessionId, accountFingerprint) {
	const input = requirePlainRecord(snapshotData(requirePlainRecord(value, "Reconstruction job")), "Reconstruction job");
	assertKnownKeys(input, RECONSTRUCTION_JOB_INPUT_KEYS, RECONSTRUCTION_JOB_OPTIONAL_INPUT_KEYS, RECONSTRUCTION_JOB_HAS_UNSUPPORTED_FIELDS_MESSAGE);
	const turnId = requireNonBlankString(requireOwnDataField(input, "turnId"), "Turn ID");
	const eventId = requireNonBlankString(requireOwnDataField(input, "eventId"), "Event ID");
	validateIdentifier(turnId, "turn ID");
	validateIdentifier(eventId, "event ID");
	const privacyMode = requireOwnDataField(input, "privacyMode");
	if (privacyMode !== "full" && privacyMode !== "metadata") throw new TypeError(RECONSTRUCTION_PRIVACY_MODE_IS_INVALID_MESSAGE);
	const sourceRefs = requireStringArray(requireOwnDataField(input, "sourceRefs"), "Source refs");
	if (sourceRefs.length === 0) throw new TypeError(RECONSTRUCTION_SOURCE_REFS_ARE_REQUIRED_MESSAGE);
	if (new Set(sourceRefs).size !== sourceRefs.length) throw new TypeError(RECONSTRUCTION_SOURCE_REFS_MUST_BE_UNIQUE_MESSAGE);
	for (const ref of sourceRefs) {
		requireNonBlankString(ref, "Source ref");
		validateIdentifier(ref, "source ref");
	}
	const turnEvidence = validateTurnEvidence(requireOwnDataField(input, "turnEvidence"));
	const sourceSnapshotsField = ownDataField(input, "sourceSnapshots");
	const sourceAgeField = ownDataField(input, "sourceAgeStartedAtMs");
	if (sourceSnapshotsField.present && sourceAgeField.present) throw new TypeError(RECONSTRUCTION_SOURCE_CONFLICT_MESSAGE);
	const sourceAgeStartedAtMs = sourceAgeField.present ? requireSafeEpochMilliseconds(sourceAgeField.value, "Source age") : void 0;
	const sourceSnapshots = sourceSnapshotsField.present ? validateSourceSnapshots(sourceSnapshotsField.value, integration, privacyMode, sourceRefs) : void 0;
	return {
		integration,
		sessionId,
		turnId,
		eventId,
		accountFingerprint,
		sourceRefs,
		privacyMode,
		turnEvidence,
		...sourceSnapshots === void 0 ? {} : { sourceSnapshots },
		...sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs }
	};
}
function snapshotSubmission(source, integration, privacyMode) {
	const submission = canonicalJsonObject(requirePlainRecord(requireOwnDataField(source, "submission"), "Prepared submission"), "Prepared submission");
	if (requireOwnDataField(submission, "privacyMode") !== privacyMode) throw new TypeError(RECONSTRUCTION_SNAPSHOT_PRIVACY_MESSAGE);
	if (submission["operation"] === "post") {
		if (!ownDataField(requirePlainRecord(requireOwnDataField(submission, "run"), "Prepared run"), "start_time").present) throw new TypeError(RECONSTRUCTION_SNAPSHOT_START_TIME_MESSAGE);
	}
	const projected = projectSubmission(submission, integration);
	if (projected.status !== "ready") throw new TypeError(RECONSTRUCTION_SNAPSHOT_NOT_READY_MESSAGE);
	return canonicalJsonObject({
		...projected.value.payload,
		metadata: projected.value.metadata
	}, "Projected submission");
}
function validateSourceSnapshot(item, integration, privacyMode, sourceRefs, seen) {
	const source = requirePlainRecord(item, "Reconstruction source snapshot");
	assertKnownKeys(source, RECONSTRUCTION_SOURCE_SNAPSHOT_KEYS, RECONSTRUCTION_SOURCE_SNAPSHOT_OPTIONAL_KEYS, RECONSTRUCTION_SNAPSHOT_FIELDS_MESSAGE);
	const sourceRef = requireNonBlankString(requireOwnDataField(source, "sourceRef"), "Source ref");
	validatePathlessSourceRef(sourceRef);
	if (!sourceRefs.includes(sourceRef)) throw new TypeError(RECONSTRUCTION_SNAPSHOT_REF_MUST_BELONG_TO_JOB_MESSAGE);
	if (seen.has(sourceRef)) throw new TypeError(RECONSTRUCTION_SNAPSHOT_REFS_MUST_BE_UNIQUE_MESSAGE);
	seen.add(sourceRef);
	const sourceAgeStartedAtMs = requireSafeEpochMilliseconds(requireOwnDataField(source, "sourceAgeStartedAtMs"), "Source age");
	const submission = snapshotSubmission(source, integration, privacyMode);
	const attributionField = ownDataField(source, "attributionContext");
	const attributionContext = attributionField.present ? validateAttributionContext(attributionField.value, privacyMode) : void 0;
	return {
		sourceRef,
		submission,
		sourceAgeStartedAtMs,
		...attributionContext === void 0 ? {} : { attributionContext }
	};
}
function validateSourceSnapshots(value, integration, privacyMode, sourceRefs) {
	if (!Array.isArray(value) || value.length === 0) throw new TypeError(RECONSTRUCTION_SNAPSHOTS_EMPTY_MESSAGE);
	for (const ref of sourceRefs) validatePathlessSourceRef(ref);
	const seen = /* @__PURE__ */ new Set();
	const snapshots = value.map((item) => validateSourceSnapshot(item, integration, privacyMode, sourceRefs, seen));
	if (snapshots.length !== sourceRefs.length) throw new TypeError(RECONSTRUCTION_SNAPSHOT_COVERAGE_MESSAGE);
	return snapshots;
}
function validatePathlessSourceRef(sourceRef) {
	validateIdentifier(sourceRef, "source ref");
	if (sourceRef.includes("/") || sourceRef.includes("\\")) throw new TypeError(RECONSTRUCTION_PATHLESS_REF_MESSAGE);
}
function validateAttributionContext(value, privacyMode) {
	const context = requirePlainRecord(value, "Attribution context");
	assertKnownKeys(context, RECONSTRUCTION_ATTRIBUTION_CONTEXT_KEYS, RECONSTRUCTION_ATTRIBUTION_CONTEXT_OPTIONAL_KEYS, RECONSTRUCTION_CONTEXT_FIELDS_MESSAGE);
	const origin = requirePlainRecord(requireOwnDataField(context, "toolOrigin"), "Tool origin");
	assertKnownKeys(origin, RECONSTRUCTION_TOOL_ORIGIN_KEYS, RECONSTRUCTION_TOOL_ORIGIN_OPTIONAL_KEYS, RECONSTRUCTION_TOOL_ORIGIN_HAS_UNSUPPORTED_FIELDS_MESSAGE);
	const namedAPath = requireBoolean(requireOwnDataField(origin, "namedAPath"), "namedAPath");
	const pathField = ownDataField(origin, "path");
	const cwdField = ownDataField(origin, "cwd");
	const pinnedField = ownDataField(context, "pinnedRepositoryKeys");
	const toolOrigin = privacyMode === "metadata" ? { namedAPath } : {
		...pathField.present ? { path: requireNonBlankString(pathField.value, "Tool path") } : {},
		...cwdField.present ? { cwd: requireNonBlankString(cwdField.value, "Tool cwd") } : {},
		namedAPath
	};
	let pinnedRepositoryKeys;
	if (privacyMode === "full" && pinnedField.present) {
		pinnedRepositoryKeys = requireStringArray(pinnedField.value, "Pinned repository keys");
		if (pinnedRepositoryKeys.some((key) => key.trim().length === 0)) throw new TypeError(RECONSTRUCTION_PINNED_BLANK_MESSAGE);
		if (new Set(pinnedRepositoryKeys).size !== pinnedRepositoryKeys.length) throw new TypeError(RECONSTRUCTION_PINNED_UNIQUE_MESSAGE);
	}
	return {
		toolOrigin,
		...pinnedRepositoryKeys === void 0 ? {} : { pinnedRepositoryKeys }
	};
}
function validateTurnEvidence(value) {
	const evidence = requirePlainRecord(value, "Turn evidence");
	canonicalJson(evidence);
	const keys = Object.keys(evidence).toSorted();
	if (RECONSTRUCTION_TURN_EVIDENCE_KEYS.some((key) => !keys.includes(key)) || keys.some((key) => !RECONSTRUCTION_TURN_EVIDENCE_KEYS_WITH_ROOT.includes(key))) throw new TypeError(RECONSTRUCTION_EVIDENCE_STRUCTURAL_MESSAGE);
	const childRunIds = requireStringArray(requireOwnDataField(evidence, "childRunIds"), "Child run IDs");
	for (const childRunId of childRunIds) {
		requireNonBlankString(childRunId, "Child run ID");
		validateIdentifier(childRunId, "child run ID");
	}
	const rootRunIdField = ownDataField(evidence, "rootRunId");
	const rootRunId = rootRunIdField.present ? requireNonBlankString(rootRunIdField.value, "Root run ID") : void 0;
	if (rootRunId !== void 0) validateIdentifier(rootRunId, "root run ID");
	const closureState = requireOwnDataField(evidence, "closureState");
	if (typeof closureState !== "string" || !RECONSTRUCTION_CLOSURE_STATES.includes(closureState)) throw new TypeError(RECONSTRUCTION_CLOSURE_STATE_MESSAGE);
	return {
		...rootRunId === void 0 ? {} : { rootRunId },
		childRunIds,
		closureState
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/job-records.js
function snapshotJob(job) {
	return Object.freeze({
		...job,
		sourceRefs: Object.freeze([...job.sourceRefs]),
		...job.sourceSnapshots === void 0 ? {} : { sourceSnapshots: Object.freeze(job.sourceSnapshots.map((snapshot) => Object.freeze({
			...snapshot,
			submission: snapshotData(snapshot.submission),
			...snapshot.attributionContext === void 0 ? {} : { attributionContext: Object.freeze({
				toolOrigin: Object.freeze({ ...snapshot.attributionContext.toolOrigin }),
				...snapshot.attributionContext.pinnedRepositoryKeys === void 0 ? {} : { pinnedRepositoryKeys: Object.freeze([...snapshot.attributionContext.pinnedRepositoryKeys]) }
			}) }
		}))) },
		turnEvidence: Object.freeze({
			...job.turnEvidence.rootRunId === void 0 ? {} : { rootRunId: job.turnEvidence.rootRunId },
			childRunIds: Object.freeze([...job.turnEvidence.childRunIds]),
			closureState: job.turnEvidence.closureState
		})
	});
}
function jobSourceAgeStartedAtMs(job) {
	if (job.sourceSnapshots !== void 0) return Math.max(...job.sourceSnapshots.map(({ sourceAgeStartedAtMs }) => sourceAgeStartedAtMs));
	return job.sourceAgeStartedAtMs;
}
function jobRecord(job) {
	const scope = scopeOf(job);
	const sourceAgeStartedAtMs = jobSourceAgeStartedAtMs(job);
	return {
		...scope,
		runId: `${RECONSTRUCTION_RUN_ID_PREFIX}${identifierHash(canonicalJson(scope))}`,
		destinationFingerprint: job.accountFingerprint,
		eventKind: RECONSTRUCTION_JOB_KIND,
		...sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs },
		normalizedPayload: canonicalValue({
			recordVersion: 1,
			privacyMode: job.privacyMode,
			sourceRefs: [...job.sourceRefs],
			...job.sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs: job.sourceAgeStartedAtMs },
			...job.sourceSnapshots === void 0 ? {} : { sourceSnapshots: job.sourceSnapshots.map((snapshot) => ({
				sourceRef: snapshot.sourceRef,
				submission: snapshot.submission,
				sourceAgeStartedAtMs: snapshot.sourceAgeStartedAtMs,
				...snapshot.attributionContext === void 0 ? {} : { attributionContext: snapshot.attributionContext }
			})) }
		}, /* @__PURE__ */ new Set()),
		turnEvidence: canonicalValue(job.turnEvidence, /* @__PURE__ */ new Set()),
		metadataProvenance: {}
	};
}
function mappingRecord(job, outputs) {
	const scope = mappingScope(job);
	return {
		...scope,
		runId: scope.eventId,
		destinationFingerprint: job.accountFingerprint,
		eventKind: RECONSTRUCTION_MAPPING_KIND,
		normalizedPayload: {
			recordVersion: 1,
			jobEventId: job.eventId,
			outputs: outputs.map(({ eventId, runId, dependencies, sourceRef, turnEvidence }) => ({
				eventId,
				runId,
				...turnEvidence === void 0 ? {} : { turnEvidence: canonicalValue(turnEvidence, /* @__PURE__ */ new Set()) },
				...sourceRef === void 0 ? {} : { sourceRef },
				...dependencies === void 0 ? {} : { dependencies: dependencies.map((dependency) => ({
					integration: dependency.integration,
					sessionId: dependency.sessionId,
					turnId: dependency.turnId,
					eventId: dependency.eventId
				})) }
			}))
		},
		turnEvidence: canonicalValue(job.turnEvidence, /* @__PURE__ */ new Set()),
		metadataProvenance: {}
	};
}
function readStoredSources(payload, integration, privacyMode) {
	const sourceRefs = requireStringArray(payload["sourceRefs"], "Stored source refs");
	if (sourceRefs.length === 0) throw new Error(RECONSTRUCTION_STORED_REFS_EMPTY_MESSAGE);
	if (new Set(sourceRefs).size !== sourceRefs.length) throw new Error(RECONSTRUCTION_STORED_REFS_UNIQUE_MESSAGE);
	for (const ref of sourceRefs) {
		requireNonBlankString(ref, "Stored source ref");
		validateIdentifier(ref, "source ref");
	}
	const sourceSnapshotsField = ownDataField(payload, "sourceSnapshots");
	const sourceAgeField = ownDataField(payload, "sourceAgeStartedAtMs");
	if (sourceSnapshotsField.present && sourceAgeField.present) throw new Error(RECONSTRUCTION_STORED_SOURCE_CONFLICT_MESSAGE);
	const sourceAgeStartedAtMs = sourceAgeField.present ? requireSafeEpochMilliseconds(sourceAgeField.value, "Stored source age") : void 0;
	const sourceSnapshots = sourceSnapshotsField.present ? validateSourceSnapshots(sourceSnapshotsField.value, integration, privacyMode, sourceRefs) : void 0;
	return {
		sourceRefs,
		...sourceSnapshots === void 0 ? {} : { sourceSnapshots },
		...sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs }
	};
}
function readJob(record, integration) {
	if (record.integration !== integration || record.eventKind !== "reconstruction-job-v1") throw new Error(RECONSTRUCTION_STORED_NAMESPACE_MESSAGE);
	const payload = requirePlainRecord(record.normalizedPayload, "Stored reconstruction job");
	if (payload["recordVersion"] !== 1) throw new Error(RECONSTRUCTION_UNSUPPORTED_RECONSTRUCTION_JOB_MESSAGE);
	assertKnownKeys(payload, RECONSTRUCTION_STORED_JOB_KEYS, RECONSTRUCTION_STORED_JOB_OPTIONAL_KEYS, RECONSTRUCTION_STORED_FIELDS_MESSAGE);
	const privacyMode = payload["privacyMode"];
	if (privacyMode !== "full" && privacyMode !== "metadata") throw new Error(RECONSTRUCTION_STORED_PRIVACY_MESSAGE);
	const sources = readStoredSources(payload, integration, privacyMode);
	const turnEvidence = validateTurnEvidence(record.turnEvidence);
	if (Object.keys(requirePlainRecord(record.metadataProvenance, "Stored metadata provenance")).length > 0) throw new Error(RECONSTRUCTION_PROVENANCE_MESSAGE);
	if (record.dependencies !== void 0) throw new Error(RECONSTRUCTION_JOB_DEPENDENCIES_MESSAGE);
	return {
		integration,
		sessionId: record.sessionId,
		turnId: record.turnId,
		eventId: record.eventId,
		accountFingerprint: record.destinationFingerprint,
		privacyMode,
		turnEvidence,
		...sources
	};
}
function readMapping(record) {
	if (record.eventKind !== "reconstruction-map-v1") throw new Error(RECONSTRUCTION_UNSUPPORTED_RECONSTRUCTION_MAPPING_MESSAGE);
	const payload = requirePlainRecord(record.normalizedPayload, "Stored reconstruction mapping");
	if (payload["recordVersion"] !== 1) throw new Error(RECONSTRUCTION_UNSUPPORTED_RECONSTRUCTION_MAPPING_MESSAGE);
	const jobEventId = requireNonBlankString(payload["jobEventId"], "Job event ID");
	const outputs = payload["outputs"];
	if (!Array.isArray(outputs) || outputs.length === 0) throw new Error(RECONSTRUCTION_STORED_NO_OUTPUTS_MESSAGE);
	const seen = /* @__PURE__ */ new Set();
	return {
		recordVersion: 1,
		jobEventId,
		outputs: outputs.map((value) => {
			const output = requirePlainRecord(value, "Stored reconstruction output");
			const eventId = requireNonBlankString(output["eventId"], "Output event ID");
			const runId = requireNonBlankString(output["runId"], "Output run ID");
			validateIdentifier(eventId, "output event ID");
			validateIdentifier(runId, "output run ID");
			if (seen.has(eventId)) throw new Error(RECONSTRUCTION_STORED_EVENTS_UNIQUE_MESSAGE);
			seen.add(eventId);
			const dependenciesField = ownDataField(output, "dependencies");
			const sourceRefField = ownDataField(output, "sourceRef");
			const evidenceField = ownDataField(output, "turnEvidence");
			const turnEvidence = evidenceField.present ? validateTurnEvidence(evidenceField.value) : void 0;
			let sourceRef;
			if (sourceRefField.present) {
				sourceRef = requireNonBlankString(sourceRefField.value, "Output source ref");
				validateIdentifier(sourceRef, "output source ref");
			}
			let dependencies;
			if (dependenciesField.present) {
				if (!Array.isArray(dependenciesField.value)) throw new Error(RECONSTRUCTION_STORED_DEPENDENCIES_MESSAGE);
				dependencies = dependenciesField.value;
			}
			return {
				eventId,
				runId,
				...turnEvidence === void 0 ? {} : { turnEvidence },
				...sourceRef === void 0 ? {} : { sourceRef },
				...dependencies === void 0 ? {} : { dependencies }
			};
		})
	};
}
function sameOutputMapping(mapping, outputs) {
	return canonicalJson(mapping.outputs) === canonicalJson(outputs.map(({ eventId, runId, dependencies, sourceRef, turnEvidence }) => ({
		eventId,
		runId,
		...turnEvidence === void 0 ? {} : { turnEvidence },
		...sourceRef === void 0 ? {} : { sourceRef },
		...dependencies === void 0 ? {} : { dependencies }
	})));
}
function mappingScope(job) {
	const eventId = `${RECONSTRUCTION_MAPPING_EVENT_ID_PREFIX}${identifierHash(canonicalJson(scopeOf(job)))}`;
	return {
		...scopeOf(job),
		eventId
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/job-processing.js
async function processJob(candidate, context) {
	const { job, scope } = candidate;
	const retry = candidate.entry.record.delivery?.retries[job.accountFingerprint];
	if (isWaitingForRetry(retry)) return "deferred";
	const fail = async () => {
		await recordFailure(context, scope, job.accountFingerprint, retry);
		return "complete";
	};
	const interpretation = await interpretReconstruction(job, context.reconstruct);
	if (interpretation === "deferred") return "deferred";
	if (interpretation === "failed") return fail();
	const outputs = validateJobOutputs(interpretation.outputs, job, candidate.entry.capturedAtMs);
	if (outputs === void 0) return fail();
	if (outputs.length > 0 && !await saveOutputMapping(context.store, job, outputs)) return fail();
	const captured = outputs.length > 0 ? await captureOutputs(context, job, outputs) : "captured";
	if (captured === "deferred") return "deferred";
	if (captured === "failed") return fail();
	await recordTerminal(context.store, scope, job.accountFingerprint, "delivered");
	await removeJob(context.store, job);
	return "complete";
}
async function interpretReconstruction(job, reconstruct) {
	try {
		const result = requirePlainRecord(await reconstruct(snapshotJob(job)), "Reconstruction result");
		const status = requireOwnDataField(result, "status");
		if (status === "deferred") {
			if (requireOwnDataField(result, "reason") !== "missing-thread-identity") throw new TypeError(RECONSTRUCTION_DEFERRAL_REASON_INVALID_MESSAGE);
			return "deferred";
		}
		if (status !== "ready") throw new TypeError(RECONSTRUCTION_RESULT_STATUS_INVALID_MESSAGE);
		return {
			status,
			outputs: requireOwnDataField(result, "outputs")
		};
	} catch {
		return "failed";
	}
}
function validateJobOutputs(candidates, job, jobCapturedAtMs) {
	try {
		return validateOutputs(candidates, job, jobCapturedAtMs);
	} catch {
		return;
	}
}
async function saveOutputMapping(store, job, outputs) {
	const mappingResult = await store.capture(mappingRecord(job, outputs));
	if (mappingResult.status !== "published" && mappingResult.status !== "duplicate") return false;
	const storedMapping = readMapping(mappingResult.record);
	return storedMapping.jobEventId === job.eventId && sameOutputMapping(storedMapping, outputs);
}
function lifecycleCaptureInput(job, output) {
	const evidence = output.turnEvidence ?? job.turnEvidence;
	const turnEvidence = {
		...evidence.rootRunId === void 0 ? {} : { rootRunId: evidence.rootRunId },
		childRunIds: [...evidence.childRunIds],
		closureState: evidence.closureState
	};
	return {
		turnId: job.turnId,
		eventId: output.eventId,
		submission: output.submission,
		turnEvidence,
		...output.dependencies === void 0 ? {} : { dependencies: output.dependencies },
		...output.sourceAgeStartedAtMs === void 0 ? {} : { sourceAgeStartedAtMs: output.sourceAgeStartedAtMs }
	};
}
async function captureOutputs(context, job, outputs) {
	for (const output of outputs) {
		const captureInput = lifecycleCaptureInput(job, output);
		let captureStatus;
		try {
			captureStatus = requireOwnDataField(requirePlainRecord(await context.bridge.capture(captureInput), "Lifecycle capture result"), "status");
		} catch {
			return "failed";
		}
		if (captureStatus === "deferred") return "deferred";
		if (captureStatus !== "published" && captureStatus !== "duplicate") return "failed";
		if (captureStatus === "published") context.counts.captured += 1;
	}
	return "captured";
}
async function removeJob(store, job) {
	await store.remove(mappingScope(job), { forgetTurn: true });
	await store.remove(scopeOf(job), { forgetTurn: true });
}
async function recordFailure(context, scope, accountFingerprint, previous) {
	await context.store.recordRetry(scope, accountFingerprint, nextRetry(previous, context.retryBaseMs));
	context.counts.failed += 1;
}
async function recordTerminal(store, scope, accountFingerprint, outcome, reason) {
	const result = await store.recordOutcome({
		...scope,
		destination: accountFingerprint,
		outcome,
		...reason === void 0 ? {} : { reason }
	});
	if (result.status !== "recorded" && result.status !== "duplicate") throw new Error(`${RECONSTRUCTION_TERMINAL_OUTCOME_MESSAGE} ${result.status}`);
	if (outcome === "dropped" && result.status === "recorded") console.warn(DELIVERY_DROPPED_WARNING, `${scope.eventId} (${reason})`);
	return result.status === "recorded";
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/reconstruction/worker.js
function createReconstructionWorker(options) {
	const integration = options.integration;
	const sessionId = requireNonBlankString(options.sessionId, "Session ID");
	const accountFingerprint = requireNonBlankString(options.bridge.accountFingerprint, "Account fingerprint");
	const bridge = Object.freeze({
		accountFingerprint,
		capture: options.bridge.capture
	});
	const reconstruct = options.reconstruct;
	if (typeof bridge.capture !== "function" || typeof reconstruct !== "function") throw new TypeError(RECONSTRUCTION_CALLBACKS_REQUIRED_MESSAGE);
	validateIntegration(integration);
	validateIdentifier(sessionId, "session ID");
	validateIdentifier(accountFingerprint, "account fingerprint");
	const policy = resolvePolicy(options.policy);
	const storageRoot = resolve(options.storageRoot);
	const captureStore = createCaptureStore(storageRoot, CAPTURE_JOBS_DIRECTORY);
	const context = {
		integration,
		sessionId,
		accountFingerprint,
		policy,
		storageRoot,
		captureStore,
		bridge,
		reconstruct
	};
	return {
		async enqueue(input) {
			const job = validateJobInput(input, integration, sessionId, accountFingerprint);
			return captureStore.capture(jobRecord(job));
		},
		async readSavedWake(error, input) {
			const job = validateJobInput(input, integration, sessionId, accountFingerprint);
			const expected = jobRecord(job);
			const saved = await readSavedCaptureWake(error, {
				store: captureStore,
				integration,
				sessionId,
				turnId: job.turnId,
				destinationFingerprint: accountFingerprint,
				eventId: job.eventId,
				runId: expected.runId
			});
			if (saved === void 0) return void 0;
			return captureContentDigest(saved.record) === captureContentDigest(expected) ? saved : void 0;
		},
		drain: (request = {}) => drainJobs(context, request)
	};
}
async function drainJobs(context, request) {
	const now = request.now ?? Date.now();
	if (!Number.isFinite(now)) throw new RangeError(RECONSTRUCTION_DRAIN_TIME_MESSAGE);
	const lockDirectory = await ensurePrivateDirectory(context.storageRoot, sessionSegments(identifierHash(context.sessionId)));
	const lockPath = join(lockDirectory, RECONSTRUCTION_DRAIN_LOCK);
	const lock = await tryAcquireFileLock(lockPath);
	if (!lock) return { status: "busy" };
	const counts = {
		captured: 0,
		deferred: 0,
		failed: 0,
		dropped: 0
	};
	try {
		counts.dropped += await removeExpiredCaptures({
			store: context.captureStore,
			integration: context.integration,
			destinations: [context.accountFingerprint],
			accountFingerprint: context.accountFingerprint,
			now,
			maxAgeMs: context.policy.maxAgeMs
		});
		const candidates = await collectCandidates(context);
		const overCapacity = Math.max(0, candidates.length - context.policy.maxEntries);
		await dropOverCapacity(context, candidates.slice(0, overCapacity), counts);
		await processCandidates(context, candidates.slice(overCapacity), counts);
	} finally {
		await lock.release();
		await removeEmptyLockFolders(lockPath, context.storageRoot);
	}
	return {
		status: "drained",
		...counts,
		...await summarizePending(context)
	};
}
async function collectCandidates(context) {
	const { captureStore, integration, sessionId, accountFingerprint } = context;
	const entries = await captureStore.enumerate(integration, sessionId);
	const candidates = [];
	for (const entry of entries) {
		if (entry.record.eventKind === "reconstruction-map-v1") {
			readMapping(entry.record);
			continue;
		}
		if (entry.record.eventKind !== "reconstruction-job-v1") throw new Error(RECONSTRUCTION_RECORD_UNSUPPORTED_MESSAGE);
		const job = readJob(entry.record, integration);
		const scope = scopeOf(entry.record);
		const outcome = await captureStore.readOutcome(scope, job.accountFingerprint);
		if (outcome.status === "failed") throw new Error(outcome.message);
		if (outcome.status === "missing-capture") throw new Error(RECONSTRUCTION_JOB_MISSING_MESSAGE);
		if (outcome.status === "settled") {
			if (job.accountFingerprint === accountFingerprint && outcome.receipt.outcome === "delivered") await removeJob(captureStore, job);
			continue;
		}
		if (job.accountFingerprint !== accountFingerprint) continue;
		candidates.push({
			entry,
			job,
			scope
		});
	}
	return candidates;
}
async function dropOverCapacity(context, dropped, counts) {
	for (const candidate of dropped) {
		counts.dropped += Number(await recordTerminal(context.captureStore, candidate.scope, candidate.job.accountFingerprint, "dropped", DELIVERY_CAPACITY_REASON));
		await removeJob(context.captureStore, candidate.job);
	}
}
async function processCandidates(context, candidates, counts) {
	const jobContext = {
		store: context.captureStore,
		bridge: context.bridge,
		reconstruct: context.reconstruct,
		retryBaseMs: context.policy.retryBaseMs,
		counts
	};
	for (const candidate of candidates) if (await processJob(candidate, jobContext) === "deferred") counts.deferred += 1;
}
async function summarizePending(context) {
	const { captureStore, integration, sessionId, accountFingerprint } = context;
	const entries = await captureStore.enumerate(integration, sessionId);
	let pending = 0;
	let nextRetryAtMs;
	let accountMismatch = 0;
	for (const entry of entries) {
		if (entry.record.eventKind !== "reconstruction-job-v1") continue;
		const job = readJob(entry.record, integration);
		const outcome = await captureStore.readOutcome(scopeOf(entry.record), job.accountFingerprint);
		if (outcome.status === "failed") throw new Error(outcome.message);
		if (outcome.status !== "settled") {
			pending += 1;
			if (job.accountFingerprint !== accountFingerprint) accountMismatch += 1;
			const retry = entry.record.delivery?.retries[job.accountFingerprint];
			if (retry !== void 0 && (nextRetryAtMs === void 0 || retry.notBeforeMs < nextRetryAtMs)) nextRetryAtMs = retry.notBeforeMs;
		}
	}
	return {
		pending,
		...nextRetryAtMs === void 0 ? {} : { nextRetryAtMs },
		accountMismatch
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/pass-results.js
function reconstructionPassResult(result) {
	if (result.status === "busy") return "retryable-failure";
	if (waitingOnBackoff(result)) return "deferred";
	return result.captured > 0 || result.dropped > 0 ? "progressed" : "idle";
}
function lifecyclePassResult(result) {
	if (result.status === "busy") return "retryable-failure";
	if (waitingOnBackoff(result)) return "deferred";
	return result.settlement.captured > 0 || result.delivered > 0 || result.dropped > 0 ? "progressed" : "idle";
}
function waitingOnBackoff(result) {
	return result.pending > 0 && result.nextRetryAtMs !== void 0;
}
const TRACING_ENGINE_BACKGROUND_RECOVERY_REPORT_ERROR = "Background recovery report callback failed";
const TRACING_ENGINE_BACKGROUND_RECOVERY_SESSION_CALLBACK_ERROR = "Background recovery session callback is required";
const TRACING_ENGINE_BACKGROUND_RECOVERY_REPORT_CALLBACK_ERROR = "Background recovery report callback is required";
const TRACING_ENGINE_BACKGROUND_RECOVERY_MINIMUM_AGE_ERROR = "Minimum foreign session age must be a non-negative integer";
const TRACING_ENGINE_RECOVERY_TIME_MUST_BE_VALID_TIMESTAMP_MESSAGE = "Recovery time must be a valid timestamp";
const TRACING_ENGINE_SESSION_RECOVERY_OPTIONS_CALLBACK_IS_REQUIRED_MESSAGE = "Session recovery options callback is required";
const TRACING_ENGINE_RECOVERY_ACCOUNT_FINGERPRINT_DOES_NOT_MATCH_ACTIVE_SESSION_MESSAGE = "Recovery account fingerprint does not match the active session";
const TRACING_ENGINE_SESSION_RECOVERY_OPTIONS_MUST_BE_OBJECT_MESSAGE = "Session recovery options must be an object";
const TRACING_ENGINE_STORAGE_ROOT_REQUIRED_MESSAGE = "A storage folder is required";
const TRACING_ENGINE_RECOVERY_SETTLEMENT_CONFLICT_MESSAGE = "Recovery settlement capture conflicts with the current source state";
const TRACING_ENGINE_MISSING_SETTLEMENT_CAPTURE_MESSAGE = "A planned settlement capture is not saved yet";
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/options.js
function snapshotEngineOptions(options) {
	if (typeof options.storageRoot !== "string" || options.storageRoot.trim() === "") throw new TypeError(TRACING_ENGINE_STORAGE_ROOT_REQUIRED_MESSAGE);
	return Object.freeze({
		...options,
		storageRoot: resolve(options.storageRoot),
		writer: snapshotWriterOptions(options.writer)
	});
}
function snapshotSessionOptions(options) {
	if (options.backgroundRecovery !== void 0) {
		if (typeof options.backgroundRecovery.optionsForSession !== "function") throw new TypeError(TRACING_ENGINE_BACKGROUND_RECOVERY_SESSION_CALLBACK_ERROR);
		if (typeof options.backgroundRecovery.onReport !== "function") throw new TypeError(TRACING_ENGINE_BACKGROUND_RECOVERY_REPORT_CALLBACK_ERROR);
		if (options.backgroundRecovery.minimumForeignAgeMs !== void 0 && (!Number.isSafeInteger(options.backgroundRecovery.minimumForeignAgeMs) || options.backgroundRecovery.minimumForeignAgeMs < 0)) throw new RangeError(TRACING_ENGINE_BACKGROUND_RECOVERY_MINIMUM_AGE_ERROR);
	}
	return Object.freeze({
		...options,
		...options.backgroundRecovery === void 0 ? {} : { backgroundRecovery: Object.freeze({ ...options.backgroundRecovery }) }
	});
}
function snapshotWriterOptions(options) {
	return Object.freeze({
		...options,
		destinations: Object.freeze(options.destinations.map((destination) => Object.freeze({ ...destination }))),
		...options.replicas === void 0 ? {} : { replicas: Object.freeze(options.replicas.map((replica) => Object.freeze({
			...replica,
			...replica.updates === void 0 ? {} : { updates: structuredClone(replica.updates) }
		}))) },
		...options.redactExtraRules === void 0 ? {} : { redactExtraRules: Object.freeze(options.redactExtraRules.map((rule) => Object.freeze({ ...rule }))) }
	});
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/errors.js
var MissingSettlementCaptureError = class extends Error {
	constructor() {
		super(TRACING_ENGINE_MISSING_SETTLEMENT_CAPTURE_MESSAGE);
		this.name = "MissingSettlementCaptureError";
	}
};
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/recovery-settlement.js
async function hasUnsettledRecoverySettlement(options) {
	try {
		return (await refreshSettlementProgress(await settleCapturedTurns({
			captures: options.captures,
			integration: options.integration,
			sessionId: options.sessionId,
			destinationFingerprint: options.destinationFingerprint,
			destinations: options.destinations,
			capture: async (input) => {
				const scope = {
					integration: options.integration,
					sessionId: options.sessionId,
					turnId: input.turnId,
					eventId: input.eventId
				};
				const existing = await options.store.read(scope);
				if (existing === void 0) throw new MissingSettlementCaptureError();
				const existingContent = Object.fromEntries(Object.entries(existing).filter(([key]) => key !== "capturedAtMs" && key !== "delivery"));
				const plannedContent = {
					version: existing.version,
					integration: options.integration,
					sessionId: options.sessionId,
					...input
				};
				if (canonicalJson(existingContent) !== canonicalJson(plannedContent)) throw new Error(TRACING_ENGINE_RECOVERY_SETTLEMENT_CONFLICT_MESSAGE);
				return {
					status: "duplicate",
					record: existing
				};
			},
			readOutcome: (scope, destination) => options.store.readOutcome(scope, destination),
			droppedRunIds: (turnId) => options.store.readDroppedRunIds(options.integration, options.sessionId, turnId),
			settledTurn: (turnId) => options.store.readSettledTurn(options.integration, options.sessionId, turnId)
		}), options.destinations, (scope, destination) => options.store.readOutcome(scope, destination))).turns.some((turn) => turn.status === "pending");
	} catch (error) {
		if (error instanceof MissingSettlementCaptureError) return true;
		throw error;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/recovery.js
function validateRecoveryRequest(request) {
	const now = request.now ?? Date.now();
	if (!Number.isSafeInteger(now) || !Number.isFinite(new Date(now).getTime())) throw new RangeError(TRACING_ENGINE_RECOVERY_TIME_MUST_BE_VALID_TIMESTAMP_MESSAGE);
	const minimumForeignAgeMs = request.minimumForeignAgeMs ?? 72e5;
	if (!Number.isSafeInteger(minimumForeignAgeMs) || minimumForeignAgeMs < 0) throw new RangeError(TRACING_ENGINE_BACKGROUND_RECOVERY_MINIMUM_AGE_ERROR);
	if (typeof request.optionsForSession !== "function") throw new TypeError(TRACING_ENGINE_SESSION_RECOVERY_OPTIONS_CALLBACK_IS_REQUIRED_MESSAGE);
	return {
		now,
		minimumForeignAgeMs,
		optionsForSession: request.optionsForSession
	};
}
async function loadRecoveryIndex(runtime) {
	const lifecycleStore = createCaptureStore(runtime.storageRoot);
	const reconstructionStore = createCaptureStore(runtime.storageRoot, CAPTURE_JOBS_DIRECTORY);
	const [lifecycleSessions, reconstructionSessions] = await Promise.all([lifecycleStore.enumerateSessions(runtime.integration), reconstructionStore.enumerateSessions(runtime.integration)]);
	const writer = createLangSmithUploadWriter(runtime.writer);
	if (writer.accountFingerprint !== runtime.accountFingerprint) throw new Error(TRACING_ENGINE_RECOVERY_ACCOUNT_FINGERPRINT_DOES_NOT_MATCH_ACTIVE_SESSION_MESSAGE);
	return {
		lifecycleStore,
		writer,
		destinationIds: writer.destinations.map((destination) => destination.id),
		lifecycleBySession: new Map(lifecycleSessions.map((entry) => [entry.sessionId, entry.captures])),
		reconstructionBySession: new Map(reconstructionSessions.map((entry) => [entry.sessionId, entry.captures])),
		savedScopes: new Set(lifecycleSessions.flatMap(({ captures }) => captures.map(({ record }) => scopeKey(record)))),
		waitingForOtherSetting: lifecycleSessions.flatMap(({ captures }) => captures).filter(({ record }) => isWaitingForOtherSetting(record, runtime.accountFingerprint)).length
	};
}
function isDue(record, destinationId, now) {
	return record.delivery?.outcomes[destinationId] === void 0 && !isWaitingForRetry(record.delivery?.retries[destinationId], now);
}
function isLifecycleKind(kind) {
	return kind === "run-post" || kind === "run-patch" || kind === "run-settlement-patch";
}
async function assessSession(runtime, index, sessionId, now) {
	const ownEntries = (entries) => (entries ?? []).filter(({ record }) => record.destinationFingerprint === runtime.accountFingerprint);
	const lifecycle = ownEntries(index.lifecycleBySession.get(sessionId));
	const reconstruction = ownEntries(index.reconstructionBySession.get(sessionId));
	const pendingLifecycle = lifecycle.filter(({ record }) => index.destinationIds.some((id) => isDue(record, id, now)) && (record.dependencies ?? []).every((dependency) => index.savedScopes.has(scopeKey(dependency))));
	const pendingJobs = reconstruction.filter(({ record }) => record.eventKind === "reconstruction-job-v1" && isDue(record, runtime.accountFingerprint, now));
	const pending = [...pendingLifecycle, ...pendingJobs];
	const hasUnsettledTurn = lifecycle.some(({ record }) => !isLifecycleKind(record.eventKind)) || pendingLifecycle.length === 0 && lifecycle.length > 0 && await hasUnsettledRecoverySettlement({
		captures: index.lifecycleBySession.get(sessionId) ?? [],
		integration: runtime.integration,
		sessionId,
		destinationFingerprint: runtime.accountFingerprint,
		destinations: index.writer.destinations,
		store: index.lifecycleStore
	});
	return {
		hasPendingWork: pending.length > 0,
		hasUnsettledTurn,
		lastActivityAtMs: Math.max(0, ...[...lifecycle, ...reconstruction].map((e) => e.modifiedAtMs)),
		oldestPendingAtMs: Math.min(Number.POSITIVE_INFINITY, ...pending.map(({ capturedAtMs }) => capturedAtMs))
	};
}
async function wakeForeignSession(runtime, optionsForSession, sessionId, scopeGuard) {
	const callbacks = await optionsForSession(sessionId);
	if (callbacks === null || typeof callbacks !== "object") throw new TypeError(TRACING_ENGINE_SESSION_RECOVERY_OPTIONS_MUST_BE_OBJECT_MESSAGE);
	const sessionOptions = {
		...callbacks,
		sessionId
	};
	const target = runtime.createSession(sessionOptions);
	if (scopeGuard && !await scopeGuard()) return void 0;
	return {
		sessionId,
		status: await target.wake()
	};
}
function failureOf(sessionId, error) {
	return {
		sessionId,
		failed: {
			sessionId,
			message: error instanceof Error ? error.message : String(error)
		}
	};
}
function guardedStep(sessionId, wake) {
	return async () => {
		try {
			return {
				sessionId,
				scheduled: await wake()
			};
		} catch (error) {
			return failureOf(sessionId, error);
		}
	};
}
function oldestPendingFirst(left, right) {
	return left.oldestPendingAtMs - right.oldestPendingAtMs || compareText(left.sessionId, right.sessionId);
}
async function planRecoverySteps(plan) {
	const { runtime, index, request, now, minimumForeignAgeMs, wakeForeign } = plan;
	const sessionIds = /* @__PURE__ */ new Set([
		...index.lifecycleBySession.keys(),
		...index.reconstructionBySession.keys(),
		runtime.currentSessionId
	]);
	const steps = [];
	const foreign = [];
	for (const sessionId of [...sessionIds].toSorted()) {
		const isCurrentSession = sessionId === runtime.currentSessionId;
		if (request.excludeCurrentSession && isCurrentSession) continue;
		try {
			const assessment = await assessSession(runtime, index, sessionId, now);
			if (!assessment.hasUnsettledTurn && !assessment.hasPendingWork) continue;
			if (isCurrentSession) steps.push(guardedStep(sessionId, async () => ({
				sessionId,
				status: await runtime.wakeCurrent()
			})));
			else if (Math.max(0, now - assessment.lastActivityAtMs) >= minimumForeignAgeMs) foreign.push({
				sessionId,
				oldestPendingAtMs: assessment.oldestPendingAtMs
			});
		} catch (error) {
			steps.push(async () => failureOf(sessionId, error));
		}
	}
	for (const { sessionId } of foreign.toSorted(oldestPendingFirst).slice(0, 25)) steps.push(guardedStep(sessionId, () => wakeForeign(sessionId)));
	return steps;
}
async function recoverTracingSessions(runtime, request, scopeGuard) {
	const { now, minimumForeignAgeMs, optionsForSession } = validateRecoveryRequest(request);
	const index = await loadRecoveryIndex(runtime);
	if (index.waitingForOtherSetting > 0) console.warn(fillTemplate(DELIVERY_ACCOUNT_MISMATCH_WARNING, { count: index.waitingForOtherSetting }));
	const steps = await planRecoverySteps({
		runtime,
		index,
		request,
		now,
		minimumForeignAgeMs,
		wakeForeign: (id) => wakeForeignSession(runtime, optionsForSession, id, scopeGuard)
	});
	const results = await Promise.all(steps.map((step) => step()));
	const scheduled = [];
	const failed = [];
	for (const result of results) if (result.failed !== void 0) failed.push(result.failed);
	else if (result.scheduled === void 0) return {
		scheduled,
		failed
	};
	else scheduled.push(result.scheduled);
	return {
		scheduled,
		failed
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/background-recovery.js
function retryableFailure(error) {
	return {
		status: "failed",
		message: describe(error),
		retryable: true
	};
}
function worse(previous, next) {
	if (previous.kind === "failed") return previous;
	if (next.kind === "ok") return previous;
	return next.kind === "failed" || previous.kind === "ok" ? next : previous;
}
function verdictResult(verdict) {
	if (verdict.kind === "failed") return retryableFailure(verdict.error);
	return verdict.kind === "mismatch" ? { status: "scope-mismatch" } : void 0;
}
async function runBackgroundRecovery(runtime, options, scopeGuard) {
	let verdict = { kind: "ok" };
	const checkScope = scopeGuard ? async () => {
		try {
			const matches = await scopeGuard();
			verdict = worse(verdict, matches ? { kind: "ok" } : { kind: "mismatch" });
			return matches;
		} catch (error) {
			verdict = worse(verdict, {
				kind: "failed",
				error
			});
			return false;
		}
	} : void 0;
	try {
		if (checkScope && !await checkScope()) return verdictResult(verdict);
		const report = await recoverTracingSessions(runtime, {
			optionsForSession: options.optionsForSession,
			minimumForeignAgeMs: options.minimumForeignAgeMs ?? 72e5,
			now: Date.now(),
			excludeCurrentSession: true
		}, checkScope);
		if (checkScope && verdict.kind === "ok") await checkScope();
		const stopped = verdictResult(verdict);
		if (stopped !== void 0) return stopped;
		return report.failed.length === 0 ? {
			status: "completed",
			report
		} : {
			status: "partial",
			report,
			retryable: true
		};
	} catch (error) {
		return retryableFailure(error);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/retry-wait.js
async function drainThroughBackoff(drain) {
	let waitedMs = 0;
	let result = await drain();
	for (let pass = 0; pass < 8; pass += 1) {
		if (result.status !== "drained" || result.pending === 0 || result.nextRetryAtMs === void 0) break;
		const wait = Math.max(0, result.nextRetryAtMs - Date.now());
		if (waitedMs + wait > 12e4) break;
		waitedMs += wait;
		await setTimeout$1(wait);
		const waitedFor = result.nextRetryAtMs;
		result = await drain();
		if (result.status === "drained" && result.nextRetryAtMs === waitedFor) break;
	}
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/engine/engine.js
function createTracingEngine(options) {
	const config = snapshotEngineOptions(options);
	const forSession = (sessionOptions) => createSession(config, snapshotSessionOptions(sessionOptions));
	return Object.freeze({ forSession });
}
function createSession(config, session) {
	const state = { droppedWork: false };
	const lifecycleBridge = createLifecycleBridge({
		storageRoot: config.storageRoot,
		integration: config.integration,
		sessionId: session.sessionId,
		writer: config.writer,
		wake: async () => state.backgroundWorker?.wake()
	});
	const reconstructionWorker = createReconstructionWorker({
		storageRoot: config.storageRoot,
		integration: config.integration,
		sessionId: session.sessionId,
		bridge: lifecycleBridge,
		reconstruct: session.reconstruct
	});
	const context = {
		config,
		session,
		scope: Object.freeze({
			integration: config.integration,
			sessionId: session.sessionId,
			accountFingerprint: lifecycleBridge.accountFingerprint
		}),
		lifecycleBridge,
		reconstructionWorker,
		state
	};
	state.backgroundWorker = createSessionWorker(context);
	return Object.freeze({
		async capture(input) {
			return lifecycleBridge.capture(input);
		},
		async wake() {
			return state.backgroundWorker.wake();
		},
		async queueReconstruction(input) {
			const result = await reconstructionWorker.enqueue(input);
			if (result.status === "published" || result.status === "duplicate") await wakeCapturedWork(result, () => state.backgroundWorker?.wake());
			return result;
		},
		async readSavedReconstructionWake(error, input) {
			return reconstructionWorker.readSavedWake(error, input);
		},
		drain: () => drainSession(context),
		async recoverSessions(request) {
			return recoverTracingSessions(recoveryRuntime(context), request);
		}
	});
}
function createSessionWorker(context) {
	const { config, session, scope, lifecycleBridge, reconstructionWorker, state } = context;
	return createBackgroundWorker({
		storageRoot: config.storageRoot,
		scope,
		resolveScope: () => session.resolveScope(scope),
		launchWorker: session.scheduleWake,
		...session.startupWaitMs === void 0 ? {} : { startupWaitMs: session.startupWaitMs },
		reconstructPending: async () => {
			const result = await drainThroughBackoff(() => reconstructionWorker.drain());
			state.droppedWork ||= result.status === "drained" && result.dropped > 0;
			return reconstructionPassResult(result);
		},
		drainPending: async () => {
			const result = await drainThroughBackoff(() => lifecycleBridge.drain());
			state.droppedWork ||= result.status === "drained" && result.dropped > 0;
			return lifecyclePassResult(result);
		}
	});
}
function recoveryRuntime(context) {
	const { config, session, lifecycleBridge, state } = context;
	return {
		storageRoot: config.storageRoot,
		integration: config.integration,
		accountFingerprint: lifecycleBridge.accountFingerprint,
		writer: config.writer,
		currentSessionId: session.sessionId,
		wakeCurrent: () => state.backgroundWorker.wake(),
		createSession: (recoveredOptions) => createSession(config, snapshotSessionOptions({
			...recoveredOptions,
			...session.backgroundRecovery === void 0 ? {} : { backgroundRecovery: session.backgroundRecovery }
		}))
	};
}
async function reportBackgroundRecovery(context, backgroundRecovery) {
	const { session, scope } = context;
	let recoveryResult;
	const checkScope = () => matchesScope(() => session.resolveScope(scope), scope);
	try {
		recoveryResult = await checkScope() ? await runBackgroundRecovery(recoveryRuntime(context), backgroundRecovery, checkScope) : { status: "scope-mismatch" };
	} catch (error) {
		recoveryResult = {
			status: "failed",
			message: describe(error),
			retryable: true
		};
	}
	try {
		await backgroundRecovery.onReport(recoveryResult);
	} catch (error) {
		console.error(TRACING_ENGINE_BACKGROUND_RECOVERY_REPORT_ERROR, describe(error));
	}
}
async function drainSession(context) {
	const { session, state } = context;
	state.droppedWork = false;
	const run = await state.backgroundWorker.run();
	const result = state.droppedWork && (run === "completed" || run === "idle" || run === "deferred") ? "dropped" : run;
	const backgroundRecovery = session.backgroundRecovery;
	if (backgroundRecovery && (run === "completed" || run === "idle")) await reportBackgroundRecovery(context, backgroundRecovery);
	return result;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/tracing/upload/identity.js
function resolveUploadDestinationFingerprint(options) {
	return resolveUploadDestinationIdentities(options).accountFingerprint;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/session.js
function openPluginSession(options) {
	const { storageRoot, integration, sessionId, writer } = options;
	const callbacks = (id) => ({
		reconstruct: options.reconstruct,
		scheduleWake: () => options.scheduleWake(id),
		resolveScope: async (expected) => ({
			...expected,
			accountFingerprint: fingerprintOf(await options.currentWriter())
		})
	});
	return {
		session: createTracingEngine({
			storageRoot,
			integration,
			writer
		}).forSession({
			sessionId,
			...callbacks(sessionId),
			...options.startupWaitMs === void 0 ? {} : { startupWaitMs: options.startupWaitMs },
			...options.onRecoveryReport === void 0 ? {} : { backgroundRecovery: {
				optionsForSession: callbacks,
				onReport: options.onRecoveryReport
			} }
		}),
		sessionId,
		store: createCaptureStore(storageRoot),
		fingerprint: resolveUploadDestinationFingerprint(writer),
		callbacks
	};
}
function fingerprintOf(writer) {
	if (writer === void 0) return UNAVAILABLE_ACCOUNT_FINGERPRINT;
	try {
		return resolveUploadDestinationFingerprint(writer);
	} catch {
		return UNAVAILABLE_ACCOUNT_FINGERPRINT;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/binary-runtime.js
function builtAsBinary() {
	return typeof LS_COMPILED_BINARY !== "undefined";
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/tls/tls-constants.js
const EXTRA_CERTIFICATES_VARIABLE = "NODE_EXTRA_CA_CERTS";
const SYSTEM_CERTIFICATE_STORE = "system";
const CERTIFICATE_FILE_ENCODING = "utf8";
const SYSTEM_CERTIFICATES_WARNING = "Uploads will not trust this computer's certificates:";
const CERTIFICATE_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/tls/system-certificates.js
function trustSystemCertificates(file, environment, readSystem = readSystemStore) {
	const existing = environment["NODE_EXTRA_CA_CERTS"] || void 0;
	if (existing === file) return { environment };
	try {
		const system = readSystem();
		if (system.length === 0) return { environment };
		writeIfChanged(file, bundle([...existing === void 0 ? [] : [readFileSync(existing, CERTIFICATE_FILE_ENCODING)], ...system]));
		return { environment: {
			...environment,
			[EXTRA_CERTIFICATES_VARIABLE]: file
		} };
	} catch (error) {
		return {
			environment,
			warning: `${SYSTEM_CERTIFICATES_WARNING} ${describe(error)}`
		};
	}
}
function readSystemStore() {
	return typeof tls.getCACertificates === "function" ? tls.getCACertificates(SYSTEM_CERTIFICATE_STORE) : [];
}
function bundle(sources) {
	return [...new Set(sources.flatMap((source) => source.match(CERTIFICATE_PATTERN) ?? []))].map((certificate) => `${certificate}\n`).join("");
}
function writeIfChanged(file, contents) {
	if (readIfPresent(file) !== contents) writeFileSync(file, contents);
}
function readIfPresent(file) {
	try {
		return readFileSync(file, CERTIFICATE_FILE_ENCODING);
	} catch {
		return;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/worker-launch.js
function launchDetachedWorker(args, options = {}) {
	const root = options.storageRoot;
	const log = root === void 0 ? void 0 : openLog(join(root, WORKER_LOG_FILE_NAME));
	const certificates = root === void 0 ? void 0 : trustSystemCertificates(join(root, SYSTEM_CERTIFICATES_FILE_NAME), process.env);
	if (log !== void 0 && certificates?.warning !== void 0) logWarning(log, certificates.warning);
	const child = spawn(options.executable ?? process.execPath, [...scriptArguments(), ...args], {
		detached: true,
		env: certificates?.environment ?? process.env,
		stdio: log === void 0 ? "ignore" : [
			"ignore",
			log,
			log
		],
		windowsHide: true
	});
	if (log !== void 0) closeSync(log);
	return new Promise((resolve, reject) => {
		child.once("error", reject);
		child.once("spawn", () => {
			if (child.pid === void 0) {
				reject(/* @__PURE__ */ new Error(WORKER_NO_PID_MESSAGE));
				return;
			}
			child.unref();
			resolve(child.pid);
		});
	});
}
function scriptArguments() {
	const entry = process.argv[1];
	return builtAsBinary() || entry === void 0 || COMPILED_BINARY_ENTRY_PREFIXES.some((prefix) => entry.startsWith(prefix)) ? [] : [entry];
}
function openLog(path) {
	try {
		mkdirSync(dirname(path), { recursive: true });
		const flag = (statSync(path, { throwIfNoEntry: false })?.size ?? 0) > 1048576 ? "w" : "a";
		return openSync(path, flag, 384);
	} catch {
		return;
	}
}
function logWarning(log, warning) {
	try {
		writeSync(log, `${warning}\n`);
	} catch {
		return;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/plugin/notice-cooldown.js
const shownInProcess = /* @__PURE__ */ new Set();
async function shouldShowNotice(options) {
	if (options.cooldown === "off") return false;
	const windowMs = (options.cooldown ?? 2) * NOTICE_MINUTE_MS;
	const key = `${options.plugin}
${options.kind}`;
	try {
		return await claimStateEntry(join(options.storageRoot, NOTICE_STATE_FILE), key, windowMs);
	} catch {
		if (options.persistentOnly || shownInProcess.has(key)) return false;
		shownInProcess.add(key);
		return true;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/paths.js
function nearestExistingDirectory(path) {
	let current = path;
	for (;;) {
		const parent = dirname(current);
		if (parent === current) return void 0;
		try {
			if (statSync(current).isDirectory()) return current;
		} catch {}
		current = parent;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/git/constants.js
const GIT_LOCATION_ENV_KEYS = [
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_COMMON_DIR",
	"GIT_INDEX_FILE",
	"GIT_CEILING_DIRECTORIES"
];
const NOT_A_REPOSITORY = /not a git repository \(or any of the parent directories\)/i;
const REMOTE_PATH_EDGE_SLASHES = /^\/+|\/+$/g;
const REMOTE_PATH_TRAILING_SLASHES = /\/+$/;
const REMOTE_GIT_SUFFIX = /\.git$/;
const REMOTE_LINE_WHITESPACE = /\s+/;
const SCP_REMOTE_PATTERN = /^(?:[^@]+@)?([^:]+):\/?(.+)$/;
const GIT_DIRECTORY_NAME = ".git";
const GIT_FILE_POINTER = /^gitdir:\s*(.+?)\s*$/m;
const GIT_MARKERS = {
	REPOSITORY_ROOT: "repository root",
	ONLY_GIT_CAN_SAY: "only git can say",
	NOTHING_HERE: "nothing here"
};
const GIT_PROVIDERS = {
	"github.com": "github",
	"gitlab.com": "gitlab",
	"bitbucket.org": "bitbucket",
	"dev.azure.com": "devAzure"
};
const SELF_HOSTED_PROVIDER_HINTS = [
	"github",
	"gitlab",
	"bitbucket"
];
const PROVIDER_HOSTS = {
	github: "github.com",
	gitlab: "gitlab.com",
	bitbucket: "bitbucket.org",
	devAzure: "dev.azure.com"
};
const GIT_COMMAND_TIMEOUT_MS = 5e3;
const GIT_COMMAND_MISSING = "is not installed in an absolute PATH folder";
const GH_LOGIN_ARGUMENTS = [
	"api",
	"user",
	"--jq",
	".login"
];
const GH_LOGIN_TIMEOUT_MS = 5e3;
const GH_LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const DESKTOP_PATH_VARIABLES = ["PATH", "Path"];
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/utils/desktop/launch.js
function findExecutable(name, env, platform) {
	const windows = platform === WINDOWS_PLATFORM;
	const extensions = windows ? (env["PATHEXT"] ?? ".EXE;.CMD;.BAT").split(";") : [""];
	const folders = (DESKTOP_PATH_VARIABLES.map((variable) => env[variable]).find((value) => value !== void 0) ?? "").split(windows ? ";" : ":");
	const absolute = windows ? win32.isAbsolute : posix.isAbsolute;
	for (const folder of folders.filter((entry) => entry !== "" && absolute(entry))) for (const extension of extensions) {
		const candidate = join(folder, `${name}${extension}`);
		try {
			accessSync(candidate, constants.X_OK);
			if (statSync(candidate).isFile()) return candidate;
		} catch {}
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/git/repository.js
function parseRepoName(remoteUrl) {
	const value = remoteUrl.trim();
	try {
		const url = new URL(value);
		const name = url.pathname.replace(REMOTE_PATH_EDGE_SLASHES, "").replace(REMOTE_GIT_SUFFIX, "");
		const repository = repositoryOnHost(url.hostname, name);
		if (repository) return repository;
	} catch {}
	const scpMatch = value.match(SCP_REMOTE_PATTERN);
	if (scpMatch) {
		const host = scpMatch[1];
		const path = scpMatch[2];
		if (host && path) return repositoryOnHost(host, path.replace(REMOTE_PATH_TRAILING_SLASHES, "").replace(REMOTE_GIT_SUFFIX, ""));
	}
}
function repositoryOnHost(hostname, name) {
	const host = hostname.toLowerCase();
	if (!name) return void 0;
	const provider = GIT_PROVIDERS[host];
	if (provider) return {
		provider,
		name
	};
	if (!host.includes(".")) return void 0;
	return {
		provider: SELF_HOSTED_PROVIDER_HINTS.find((hint) => host.includes(hint)) ?? host,
		name,
		host
	};
}
function gitOutput(args, cwd) {
	const env = {
		...process.env,
		LC_ALL: "C",
		LANG: "C"
	};
	for (const key of GIT_LOCATION_ENV_KEYS) delete env[key];
	return execFileSync(installedCommand("git"), args, {
		cwd,
		env,
		encoding: "utf-8",
		timeout: GIT_COMMAND_TIMEOUT_MS,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		]
	});
}
function getRepoName(cwd) {
	try {
		const lines = gitOutput(["remote", "-v"], cwd).trim().split("\n").filter(Boolean);
		const remotes = [];
		for (const line of lines) {
			const parts = line.split(REMOTE_LINE_WHITESPACE);
			const name = parts[0];
			const url = parts[1];
			if (name && url && line.includes("(fetch)")) remotes.push({
				name,
				url
			});
		}
		const origin = remotes.find((remote) => remote.name === "origin");
		if (origin) {
			const name = parseRepoName(origin.url);
			if (name) return name;
		}
		for (const remote of remotes) {
			const name = parseRepoName(remote.url);
			if (name) return name;
		}
	} catch {}
}
function getRepoUrl(provider, name) {
	const host = PROVIDER_HOSTS[provider];
	return host ? `https://${host}/${name}` : void 0;
}
function getRepoRoot(cwd) {
	try {
		const root = gitOutput(["rev-parse", "--show-toplevel"], cwd).trim();
		return root ? resolve(root) : void 0;
	} catch (error) {
		const stderr = String(error?.stderr ?? "");
		return NOT_A_REPOSITORY.test(stderr) ? null : void 0;
	}
}
function getGitUserName(cwd, options) {
	try {
		const name = gitOutput(["config", "user.name"], cwd).trim();
		if (name) return name;
	} catch {}
	return options?.githubLogin?.();
}
function getGitInfo(cwd) {
	const result = {};
	try {
		const branch = gitOutput([
			"rev-parse",
			"--abbrev-ref",
			"HEAD"
		], cwd).trim();
		if (branch && branch !== "HEAD") result.branch = branch;
	} catch {}
	try {
		const commit = gitOutput(["rev-parse", "HEAD"], cwd).trim();
		if (commit) result.commit = commit;
	} catch {}
	return result;
}
function getRepositoryMetadata(cwd) {
	const metadata = {};
	const repoName = getRepoName(cwd);
	if (repoName) {
		metadata[GIT_METADATA_KEYS.repository] = repoName.name;
		metadata[GIT_METADATA_KEYS.provider] = repoName.provider;
		const url = repoName.host ? `https://${repoName.host}/${repoName.name}` : getRepoUrl(repoName.provider, repoName.name);
		if (url) metadata[GIT_METADATA_KEYS.repositoryUrl] = url;
	}
	const gitInfo = getGitInfo(cwd);
	if (gitInfo.branch) metadata[GIT_METADATA_KEYS.branch] = gitInfo.branch;
	if (gitInfo.commit) metadata[GIT_METADATA_KEYS.commit] = gitInfo.commit;
	return withBothGitMetadataNames(metadata);
}
function githubLoginLookup() {
	return execFileSync(installedCommand("gh"), GH_LOGIN_ARGUMENTS, {
		encoding: "utf-8",
		timeout: GH_LOGIN_TIMEOUT_MS,
		stdio: [
			"ignore",
			"pipe",
			"ignore"
		]
	}).trim();
}
function isGitHubLogin(printed) {
	return printed !== "null" && GH_LOGIN_PATTERN.test(printed);
}
function installedCommand(name) {
	const found = findExecutable(name, process.env, process.platform);
	if (found === void 0) throw new Error(`${name} ${GIT_COMMAND_MISSING}`);
	return found;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/git/github-login.js
function createGitHubLoginFallback(options) {
	const now = options.now ?? Date.now;
	const retryAfterMs = options.retryAfterMs ?? 864e5;
	let alreadyTried = false;
	let login;
	function failedRecently() {
		try {
			const marker = JSON.parse(readFileSync(options.markerPath, "utf-8"));
			const failed = new Date(marker.failed).getTime();
			const since = now() - failed;
			return since >= 0 && since < retryAfterMs;
		} catch {
			return false;
		}
	}
	function recordFailure() {
		try {
			mkdirSync(dirname(options.markerPath), { recursive: true });
			const partial = `${options.markerPath}.${process.pid}`;
			const marker = { failed: new Date(now()).toISOString() };
			writeFileSync(partial, JSON.stringify(marker));
			renameSync(partial, options.markerPath);
		} catch {}
	}
	return () => {
		if (alreadyTried) return login;
		alreadyTried = true;
		if (failedRecently()) return void 0;
		try {
			const printed = githubLoginLookup();
			if (isGitHubLogin(printed)) login = printed;
		} catch {}
		if (login === void 0) recordFailure();
		return login;
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/git/paths.js
function gitMarkerAt(directory) {
	const marker = join(directory, GIT_DIRECTORY_NAME);
	try {
		if (statSync(marker).isDirectory()) return GIT_MARKERS.REPOSITORY_ROOT;
	} catch {
		return GIT_MARKERS.NOTHING_HERE;
	}
	return pointsAtGitDirectory(directory, marker) ? GIT_MARKERS.REPOSITORY_ROOT : GIT_MARKERS.ONLY_GIT_CAN_SAY;
}
function pointsAtGitDirectory(directory, marker) {
	try {
		const pointer = readFileSync(marker, "utf-8").match(GIT_FILE_POINTER)?.[1];
		return pointer !== void 0 && statSync(resolve(directory, pointer)).isDirectory();
	} catch {
		return false;
	}
}
function rootFromGitMarker(directory) {
	let current = resolve(directory);
	for (;;) {
		const marker = gitMarkerAt(current);
		if (marker === GIT_MARKERS.REPOSITORY_ROOT) return current;
		if (marker === GIT_MARKERS.ONLY_GIT_CAN_SAY) return void 0;
		const parent = dirname(current);
		if (parent === current) return null;
		current = parent;
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/git/attribution.js
function createRepositoryAttributor(options) {
	const rootByDirectory = /* @__PURE__ */ new Map();
	const attributionByRoot = /* @__PURE__ */ new Map();
	const identifierByRoot = /* @__PURE__ */ new Map();
	const githubLogin = createGitHubLoginFallback({ markerPath: options.githubLoginMarkerPath });
	function rootForPath(path) {
		const directory = nearestExistingDirectory(path);
		if (!directory) return void 0;
		if (rootByDirectory.has(directory)) return rootByDirectory.get(directory);
		const walked = rootFromGitMarker(directory);
		const root = walked === void 0 ? getRepoRoot(directory) : walked;
		rootByDirectory.set(directory, root);
		return root;
	}
	function isSessionsOwnRepository(sessionCwd, root) {
		return sessionCwd ? rootForPath(sessionCwd) === root : false;
	}
	function identifierForRoot(root) {
		const cached = identifierByRoot.get(root);
		if (cached) return cached;
		const userName = getGitUserName(root, { githubLogin });
		const identifier = userName ? { ls_attribution_identifier: userName } : {};
		identifierByRoot.set(root, identifier);
		return identifier;
	}
	function attributionForRoot(root) {
		const cached = attributionByRoot.get(root);
		if (cached) return cached;
		const attribution = {
			...identifierForRoot(root),
			...getRepositoryMetadata(root)
		};
		attributionByRoot.set(root, attribution);
		return attribution;
	}
	function scopedToPath(base, origin, pinned) {
		if (origin.namedAPath && !origin.path) return base;
		const path = origin.path ?? origin.cwd;
		if (!path || !isAbsolute(path)) return base;
		const root = rootForPath(path);
		if (root === void 0) return base;
		if (root === null) return withoutRepositoryKeys(base, pinned);
		if (isSessionsOwnRepository(origin.cwd, root)) return {
			...base,
			...withoutPinnedKeys(identifierForRoot(root), pinned)
		};
		return {
			...withoutRepositoryKeys(base, pinned),
			...withoutPinnedKeys(attributionForRoot(root), pinned)
		};
	}
	function withSessionRepository(base, sessionCwd) {
		const sessionRoot = sessionCwd ? rootForPath(sessionCwd) : void 0;
		if (typeof sessionRoot !== "string") return base;
		return {
			...attributionForRoot(sessionRoot),
			...base
		};
	}
	function toolMetadata(base, origin) {
		const pinned = new Set(REPOSITORY_METADATA_KEYS.filter((key) => base?.[key] !== void 0));
		return scopedToPath(withSessionRepository(base, origin.cwd), origin, pinned);
	}
	function turnMetadata(base, cwd, toolOrigins) {
		const sessionCwd = cwd ? { cwd } : {};
		if (typeof (cwd ? rootForPath(cwd) : void 0) === "string") return toolMetadata(base, {
			...sessionCwd,
			namedAPath: false
		});
		for (const { path, namedAPath } of toolOrigins) {
			if (!path) continue;
			if (typeof rootForPath(path) === "string") return toolMetadata(base, {
				path,
				namedAPath,
				...sessionCwd
			});
		}
		return base;
	}
	return {
		toolMetadata,
		turnMetadata
	};
}
function withoutPinnedKeys(attribution, pinned) {
	if (pinned.size === 0) return { ...attribution };
	return Object.fromEntries(Object.entries(attribution).filter(([key]) => !pinned.has(key)));
}
function withoutRepositoryKeys(base, pinned) {
	const stripped = { ...base };
	for (const key of REPOSITORY_METADATA_KEYS) if (!pinned.has(key)) delete stripped[key];
	return stripped;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/constants.js
const COMMON_BOOLEAN_SETTINGS = {
	enabled: {
		default: false,
		restrictive: false
	},
	defaultMuted: {
		default: false,
		restrictive: true
	}
};
const COMMON_STRICT_BOOLEAN_FIELDS = ["redact", "strict_auth"];
const COMMON_DEFAULT_API_URL = "https://api.smith.langchain.com";
const COMMON_CONFIG_FILE_NAME = "langsmith.json";
const COMMON_CONFIG_OPEN_FLAGS = constants.O_RDONLY | (constants.O_NONBLOCK ?? 0);
const COMMON_CONFIG_ROOT_FILE_NAME = "langsmith-plugins.json";
const COMMON_CONFIG_USER_ROOT_FILE_NAME = ".langsmith-plugins.json";
const MANAGED_CONFIG_DIRECTORY = ".langsmith-plugins";
const MANAGED_CONFIG_FILE_NAME = "managed.json";
const MANAGED_CONFIG_OPEN_FLAGS = COMMON_CONFIG_OPEN_FLAGS | (constants.O_NOFOLLOW ?? 0);
const MANAGED_CONFIG_OVERRIDE_SOURCES = [
	"env",
	"harness",
	"root",
	"user",
	"userRoot"
];
const MANAGED_CONFIG_UNSAFE_OWNERSHIP = "LangSmith managed settings aren't owned by root, so tracing is off. Contact your admin.";
const MANAGED_CONFIG_INVALID = "LangSmith managed settings are invalid, so tracing is off. Contact your admin.";
const MANAGED_CONFIG_UNLOCKABLE_WARNING = "The managed config sets {fields}, which this plugin can't lock, so it is ignored.";
const MANAGED_CONFIG_OVERRIDE_WARNING = "Ignored settings the managed config locks: {overrides}.";
const ACCOUNT_LOOKUP_TIMEOUT_MS = 2e3;
const MACOS_ACCOUNT_LOOKUP = "/usr/bin/id";
const MACOS_ACCOUNT_LOOKUP_ARGUMENTS = ["-P"];
const LINUX_ACCOUNT_LIST_FILE = "/etc/passwd";
const LINUX_ACCOUNT_LOOKUPS = ["/usr/bin/getent", "/bin/getent"];
const UTF8_BOM = /^\uFEFF/;
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/utils/records.js
function object(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/parse.js
function invalid(raw) {
	return {
		status: "invalid",
		common: {
			enabled: false,
			defaultMuted: true
		},
		...raw === void 0 ? {} : { raw },
		diagnostics: ["Invalid or unreadable common config; ordinary fields discarded, privacy switches restricted."]
	};
}
function absent() {
	return {
		status: "absent",
		common: {},
		diagnostics: []
	};
}
function parseReplica(value) {
	if (!object(value)) return void 0;
	const replica = {};
	for (const [canonical, alias] of [
		["api_url", "apiUrl"],
		["api_key", "apiKey"],
		["project", "projectName"]
	]) {
		const selected = Object.hasOwn(value, canonical) ? canonical : alias;
		if (Object.hasOwn(value, selected)) {
			const entry = value[selected];
			if (typeof entry !== "string") return void 0;
			replica[canonical] = entry;
		}
	}
	if (Object.hasOwn(value, "updates")) {
		if (!object(value.updates)) return void 0;
		replica.updates = value.updates;
	}
	return replica;
}
/** Parse a decoded JSON value (not JSON text). Unknown/adapter fields do not affect common validity. */
function parseCommonConfig(value) {
	if (!object(value)) return invalid();
	const common = {};
	const diagnostics = [];
	for (const field of ["enabled", "defaultMuted"]) {
		if (!Object.hasOwn(value, field)) continue;
		const entry = value[field];
		common[field] = typeof entry === "boolean" ? entry : COMMON_BOOLEAN_SETTINGS[field].restrictive;
		if (typeof entry !== "boolean") diagnostics.push(`Invalid ${field}; using restrictive value.`);
	}
	for (const field of [
		"api_key",
		"api_url",
		"project"
	]) {
		if (!Object.hasOwn(value, field)) continue;
		if (typeof value[field] !== "string") return invalid(value);
		common[field] = value[field];
	}
	for (const field of COMMON_STRICT_BOOLEAN_FIELDS) {
		if (!Object.hasOwn(value, field)) continue;
		if (typeof value[field] !== "boolean") return invalid(value);
		common[field] = value[field];
	}
	if (Object.hasOwn(value, "notice_cooldown")) {
		const cooldown = value.notice_cooldown;
		if (!(typeof cooldown === "number" && Number.isFinite(cooldown) && cooldown >= 0) && cooldown !== "off") return invalid(value);
		common.notice_cooldown = cooldown;
	}
	if (Object.hasOwn(value, "metadata")) {
		if (!object(value.metadata)) return invalid(value);
		common.metadata = value.metadata;
	}
	if (Object.hasOwn(value, "replicas")) {
		if (!Array.isArray(value.replicas)) return invalid(value);
		const replicas = [];
		for (const entry of value.replicas) {
			const replica = parseReplica(entry);
			if (replica === void 0) return invalid(value);
			replicas.push(replica);
		}
		common.replicas = replicas;
	}
	if (Object.hasOwn(value, "redact_extra_rules")) {
		if (!Array.isArray(value.redact_extra_rules)) return invalid(value);
		const rules = [];
		for (const rule of value.redact_extra_rules) {
			if (!object(rule) || typeof rule.pattern !== "string" || !Object.hasOwn(rule, "pattern")) return invalid(value);
			const hasReplace = Object.hasOwn(rule, "replace");
			if (hasReplace && typeof rule.replace !== "string") return invalid(value);
			try {
				new RegExp(rule.pattern, "g");
			} catch {
				return invalid(value);
			}
			rules.push({
				pattern: rule.pattern,
				...hasReplace ? { replace: rule.replace } : {}
			});
		}
		common.redact_extra_rules = rules;
	}
	return {
		status: "valid",
		common,
		raw: value,
		diagnostics
	};
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/utils/account-home.js
let cachedBunHome;
function accountHomeDirectory() {
	if (process.versions.bun === void 0) return nodeAccountHome();
	cachedBunHome ??= { home: bunAccountHome() };
	return cachedBunHome.home;
}
function bunAccountHome() {
	const uid = process.getuid?.();
	if (uid === void 0) return void 0;
	if (process.platform === "darwin") return macosAccountHome(uid);
	return linuxAccountHome(uid);
}
function nodeAccountHome() {
	try {
		return userInfo().homedir;
	} catch {
		return;
	}
}
function macosAccountHome(uid) {
	return homeField(runAccountLookup(MACOS_ACCOUNT_LOOKUP, [...MACOS_ACCOUNT_LOOKUP_ARGUMENTS, String(uid)]), 8);
}
function linuxAccountHome(uid) {
	const fromFile = accountListEntry(uid);
	if (fromFile !== void 0) return homeField(fromFile, 5);
	for (const lookup of LINUX_ACCOUNT_LOOKUPS) {
		const entry = runAccountLookup(lookup, ["passwd", String(uid)]);
		if (entry !== void 0) return homeField(entry, 5);
	}
}
function accountListEntry(uid) {
	let contents;
	try {
		contents = readFileSync(LINUX_ACCOUNT_LIST_FILE, "utf8");
	} catch {
		return;
	}
	for (const line of contents.split("\n")) if (line.split(":")[2] === String(uid)) return line;
}
function runAccountLookup(command, args) {
	try {
		return execFileSync(command, args, {
			encoding: "utf8",
			timeout: ACCOUNT_LOOKUP_TIMEOUT_MS,
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		}).trim();
	} catch {
		return;
	}
}
function homeField(entry, field) {
	const home = entry?.split(":")[field];
	return home !== void 0 && isAbsolute(home) ? home : void 0;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/utils/warnings.js
const warned = /* @__PURE__ */ new Set();
function warnOnce(lines) {
	for (const line of lines) {
		if (warned.has(line)) continue;
		warned.add(line);
		console.warn(line);
	}
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/managed-config.js
function onlyOwnerCanChange(stats, ownerUid) {
	return !stats.isSymbolicLink() && stats.uid === ownerUid && (stats.mode & 18) === 0;
}
function managedConfigPath() {
	if (process.platform === "win32") return void 0;
	const accountHome = accountHomeDirectory() ?? homedir();
	return join(accountHome, MANAGED_CONFIG_DIRECTORY, MANAGED_CONFIG_FILE_NAME);
}
function rejectManagedConfig(diagnostic) {
	return {
		status: "invalid",
		common: {},
		diagnostics: [diagnostic]
	};
}
function readManagedConfigFile(options = {}) {
	const path = options.path ?? managedConfigPath();
	if (path === void 0) return absent();
	const ownerUid = options.ownerUid ?? 0;
	let fd;
	try {
		fd = openSync(path, MANAGED_CONFIG_OPEN_FLAGS);
	} catch (error) {
		const code = error.code;
		if (code === "ENOENT") return absent();
		return rejectManagedConfig(code === "ELOOP" ? MANAGED_CONFIG_UNSAFE_OWNERSHIP : MANAGED_CONFIG_INVALID);
	}
	let raw;
	try {
		const file = fstatSync(fd);
		if (!file.isFile()) return rejectManagedConfig(MANAGED_CONFIG_INVALID);
		if ((options.checkOwnership ?? true) && !(onlyOwnerCanChange(file, ownerUid) && onlyOwnerCanChange(lstatSync(dirname(path)), ownerUid))) return rejectManagedConfig(MANAGED_CONFIG_UNSAFE_OWNERSHIP);
		raw = JSON.parse(readFileSync(fd, "utf8").replace(UTF8_BOM, ""));
	} catch {
		return rejectManagedConfig(MANAGED_CONFIG_INVALID);
	} finally {
		try {
			closeSync(fd);
		} catch {}
	}
	if (!object(raw)) return rejectManagedConfig(MANAGED_CONFIG_INVALID);
	const parsed = parseCommonConfig(raw);
	if (parsed.status === "invalid") return rejectManagedConfig(MANAGED_CONFIG_INVALID);
	return {
		status: "valid",
		common: parsed.common,
		raw,
		diagnostics: parsed.diagnostics
	};
}
function lockPluginFields(managed, fields) {
	const raw = managed.raw ?? {};
	const present = (names) => names.filter((name) => Object.hasOwn(raw, name));
	const ignored = present(fields.unlockable ?? []);
	if (ignored.length > 0) warnOnce([MANAGED_CONFIG_UNLOCKABLE_WARNING.replace("{fields}", ignored.join(", "))]);
	return Object.fromEntries(present(fields.lockable).map((name) => [name, raw[name]]));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/managed-lock.js
function lockedValues(common) {
	const lock = { ...common };
	if (lock.api_key !== void 0 || lock.replicas !== void 0) lock.api_url ??= COMMON_DEFAULT_API_URL;
	if (lock.api_url !== void 0 || lock.project !== void 0) lock.replicas ??= [];
	if (lock.redact_extra_rules !== void 0) lock.redact ??= true;
	return lock;
}
function lockedFields(lock) {
	const fields = [];
	for (const field of Object.keys(lock)) if (lock[field] !== void 0) fields.push(field);
	return fields;
}
function overridesLock(value, locked) {
	if (!object(value) || !object(locked)) return !isDeepStrictEqual(value, locked);
	for (const key of Object.keys(value)) if (Object.hasOwn(locked, key) && !isDeepStrictEqual(value[key], locked[key])) return true;
	return false;
}
function overridingSources(sources, field, lock) {
	const overriding = [];
	for (const source of MANAGED_CONFIG_OVERRIDE_SOURCES) {
		const value = sources[source]?.[field];
		if (value !== void 0 && overridesLock(value, lock[field])) overriding.push(source);
	}
	return overriding;
}
function overrideDiagnostics(sources, lock) {
	const overrides = [];
	for (const field of lockedFields(lock)) {
		const overriding = overridingSources(sources, field, lock);
		if (overriding.length === 0) continue;
		overrides.push(`${field} from ${overriding.join(", ")}`);
	}
	if (overrides.length === 0) return [];
	const list = overrides.join("; ");
	return [MANAGED_CONFIG_OVERRIDE_WARNING.replace("{overrides}", list)];
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/common-config.js
/** Resolve the first supplied value from sources ordered highest priority first. */
function resolveField(sources, field) {
	return sources.find((source) => source[field] !== void 0)?.[field];
}
/**
* Metadata shallow-merges per key. envFirst opts into uniform environment-first
* precedence; by default switches retain the legacy file-first precedence.
*/
function mergeCommonConfig(sources, options = {}) {
	const { harness = {}, root = {}, user = {}, userRoot = {}, env = {}, defaults = {}, managed = readManagedConfigFile() } = sources;
	const lock = lockedValues(managed.common);
	const files = [
		harness,
		root,
		user,
		userRoot
	];
	const precedence = [
		lock,
		env,
		...files,
		defaults
	];
	const switches = options.envFirst ? precedence : [
		lock,
		...files,
		env,
		defaults
	];
	const merged = {
		enabled: false,
		defaultMuted: false,
		redact: true,
		locked: lockedFields(lock),
		defaulted: Object.keys(defaults).filter((field) => resolveField([
			lock,
			env,
			...files
		], field) === void 0),
		diagnostics: [...managed.diagnostics, ...overrideDiagnostics(sources, lock)]
	};
	for (const field of ["enabled", "defaultMuted"]) merged[field] = resolveField(switches, field) ?? COMMON_BOOLEAN_SETTINGS[field].default;
	if (managed.status === "invalid") {
		merged.enabled = false;
		if (managed.diagnostics[0] !== void 0) merged.managedConfigProblem = managed.diagnostics[0];
	}
	warnOnce(merged.diagnostics);
	merged.api_key = resolveField(precedence, "api_key");
	merged.api_url = resolveField(precedence, "api_url");
	merged.project = resolveField(precedence, "project");
	merged.replicas = resolveField(precedence, "replicas");
	merged.redact = resolveField(precedence, "redact") ?? true;
	merged.redact_extra_rules = resolveField(precedence, "redact_extra_rules");
	merged.strict_auth = resolveField(precedence, "strict_auth");
	merged.notice_cooldown = resolveField(precedence, "notice_cooldown");
	if (precedence.some((source) => source.metadata !== void 0)) merged.metadata = [...precedence].reverse().reduce((metadata, source) => ({
		...metadata,
		...source.metadata
	}), {});
	return merged;
}
/** Convert validated canonical FILE replicas only. Legacy SDK environment tuples belong to adapters. */
function toSdkReplicas(replicas) {
	return replicas?.map((replica) => ({
		...replica.api_url === void 0 ? {} : { apiUrl: replica.api_url },
		...replica.api_key === void 0 ? {} : { apiKey: replica.api_key },
		...replica.project === void 0 ? {} : { projectName: replica.project },
		...replica.updates === void 0 ? {} : { updates: replica.updates }
	}));
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/settings/config-files.js
/** Follow readable symlinks, but never read directories/devices/FIFOs. Only true ENOENT is absent. */
function readCommonConfigFile(path) {
	let fd;
	try {
		fd = openSync(path, COMMON_CONFIG_OPEN_FLAGS);
	} catch (error) {
		if (error.code === "ENOENT") try {
			lstatSync(path);
		} catch (lstatError) {
			if (lstatError.code === "ENOENT") return absent();
		}
		return invalid();
	}
	try {
		if (!fstatSync(fd).isFile()) return invalid();
		return parseCommonConfig(JSON.parse(readFileSync(fd, "utf8")));
	} catch {
		return invalid();
	} finally {
		try {
			closeSync(fd);
		} catch {}
	}
}
function readCommonConfigFiles(options) {
	const { cwd, home, harnessDirectory } = options;
	return {
		harness: readCommonConfigFile(join(cwd, harnessDirectory, COMMON_CONFIG_FILE_NAME)),
		root: readCommonConfigFile(join(cwd, COMMON_CONFIG_ROOT_FILE_NAME)),
		user: home ? readCommonConfigFile(join(home, harnessDirectory, COMMON_CONFIG_FILE_NAME)) : absent(),
		userRoot: home ? readCommonConfigFile(join(home, COMMON_CONFIG_USER_ROOT_FILE_NAME)) : absent(),
		managed: readManagedConfigFile(options.managed)
	};
}
//#endregion
//#region src/constants.ts
/** Identifies this plugin as the trace source. */
const LS_INTEGRATION = "openai-codex";
const CODEX_CONFIG_DIRECTORY = ".codex";
const PRIVACY_FILE_NAME = "langsmith_state_privacy.json";
const LEGACY_PRIVACY_FILE_NAME = "langsmith-state.privacy.json";
const SIDECAR_SUFFIX = ".langsmith";
const CHILD_SCOPE_RESET = {
	approval_policy: void 0,
	ls_is_error_interrupt: void 0,
	ls_subagent_id: void 0,
	ls_subagent_type: void 0
};
const MODE_FULL = "full";
const MODE_METADATA = "metadata";
const PLUGIN_ENV_PREFIX = "LANGSMITH_CODEX_";
const ENV_PREFIXES = [PLUGIN_ENV_PREFIX, "LANGSMITH_"];
const ENV_SUFFIXES = {
	apiKey: "API_KEY",
	apiUrl: "ENDPOINT",
	project: "PROJECT",
	metadata: "METADATA",
	replicas: "RUNS_ENDPOINTS",
	redact: "REDACT",
	redactExtraRules: "REDACT_EXTRA",
	strictAuth: "STRICT_AUTH",
	parentHeaders: "PARENT_HEADERS",
	noticeCooldown: "NOTICE_COOLDOWN"
};
const PERSON_SESSION_SOURCES = ["cli", "vscode"];
const LAUNCHER_LOOKUP_COMMAND = "/bin/ps";
const LAUNCHER_LOOKUP_ARGUMENTS = [
	"-o",
	"ppid=,args=",
	"-p"
];
const LAUNCHER_CODEX_PATTERN = /(^|\/)codex(\.js)?$/u;
const LAUNCHER_EXEC_SUBCOMMANDS = ["exec", "e"];
const LAUNCHER_LINE_PATTERN = /^\s*(\d+)\s+(.*)$/u;
const LAUNCHER_ARGUMENT_SEPARATOR = /\s+/u;
const PARENT_TRACE_HEADER = "langsmith-trace";
const ENABLED_ENV_KEYS = ["TRACE_TO_LANGSMITH"];
const DEFAULT_MUTED_ENV_KEYS = ["LANGSMITH_CODEX_DEFAULT_MUTED", "LANGSMITH_DEFAULT_MUTED"];
const ENV_TRUE_VALUES = [
	"1",
	"true",
	"yes",
	"on"
];
const ENV_FALSE_VALUES = [
	"0",
	"false",
	"no",
	"off"
];
const POLICY_THREAD_KEYS = [
	"preference",
	"turns",
	"inherited"
];
const POLICY_TOP_LEVEL_KEYS = ["version", "threads"];
const POLICY_INVALID_MESSAGE = "Invalid tracing preference format";
const PREFERENCE_WARNING_PREFIX = "Tracing preference warning:";
const LOCKED_MUTE_REPLY = "Thread tracing stays muted because your admin locked muting.";
const SUBAGENT_SCOPE_RESET = {
	approval_policy: void 0,
	ls_is_error_interrupt: void 0
};
const SKILL_SCOPE_RESET = {
	...CHILD_SCOPE_RESET,
	usage_metadata: void 0
};
const RESETTABLE_METADATA_KEYS = Object.keys(SKILL_SCOPE_RESET);
const TOOL_PATH_INPUT_KEYS = [
	"file_path",
	"path",
	"workdir",
	"cwd"
];
const PATCH_FILE_PATTERN = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/m;
const GITHUB_LOGIN_MARKER_FILE_NAME = "langsmith_gh_login.json";
const NORMALIZED_SNAPSHOT_OPTIONAL_FIELDS = [
	"start_time",
	"end_time",
	"parent_run_id",
	"trace_id",
	"dotted_order",
	"tags",
	"error",
	"serialized",
	"events",
	"reference_example_id"
];
const ENGINE_STORAGE_DIRECTORY = "langsmith_engine";
const ENGINE_WORKER_FLAG = "--engine-worker";
const TRACE_RUN_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const TRACE_RUN_ID_PREFIX = "langsmith-codex:";
const TRACE_RUN_EVENT_PREFIX = "codex-run:";
const LIVE_RUN_EVENT_PREFIX = "codex-live-run:";
const TRACE_RUN_PATCH_EVENT_PREFIX = "codex-run-patch:";
const RUN_PATCH_FIELDS = [
	"outputs",
	"end_time",
	"error"
];
const RUN_CONTEXT_FIELDS = [
	"start_time",
	"parent_run_id",
	"trace_id",
	"dotted_order"
];
const CAPTURE_SAVED_STATUSES = ["published", "duplicate"];
const LIVE_RUN_NOT_SAVED_MESSAGE = "Could not save a Codex tool run for upload:";
const TOOL_RUN_ID_SEGMENT = ":tool:";
const TOOL_OUTPUT_WAIT_MS = 3e3;
const OPEN_TURN_END = "langsmith_open_turn_end";
const TOOL_ITEM_TYPES = [
	"CommandExecution",
	"DynamicToolCall",
	"FileChange",
	"McpToolCall"
];
const FAILED_TOOL_STATUSES = ["failed", "declined"];
const OPEN_CLOSURE = "open";
const PATCH_OPERATION = "patch";
const RUN_RUNNING = "running";
const RUN_COMPLETED = "completed";
const RUN_ERROR = "error";
const RECONSTRUCTION_EVENT_PREFIX = "codex-reconstruction:";
const TRANSCRIPT_LOCATOR_PREFIX = "codex-transcript:";
const CONTEXT_LOCATOR_PREFIX = "codex-context:";
const JOB_STATE_FILE_NAME = "langsmith_state.json";
const CONTEXT_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const STATE_FILE_MAX_AGE_MS = 216e5;
const WARNING_FILE_NAME = "langsmith_warning.txt";
const NOTICE_KIND_MANAGED = "managed";
const NOTICE_KIND_CREDENTIAL = "credential";
const NOTICE_KIND_REPLICA = "replica";
const PARENT_HEADERS_FIELD = "parent_headers";
const DROPPED_WORK_WARNING = "LangSmith could not accept a Codex trace upload and dropped it. Check your LangSmith API key and endpoint; details are in the Codex LangSmith log.";
const DROPPED_LOGIN_WORK_WARNING = "LangSmith could not accept a Codex trace upload and dropped it. Run `langsmith auth login` to sign in again; details are in the Codex LangSmith log.";
/** Plugin version, or undefined outside a bundled build. */
const LS_INTEGRATION_VERSION = "0.3.0";
const SHELL_TOOL_NAMES = /* @__PURE__ */ new Set(["exec", "exec_command"]);
const TOOLS_WITH_END_EVENTS = /* @__PURE__ */ new Set([...SHELL_TOOL_NAMES, "apply_patch"]);
const SHELL_WORD = /[^\s"']+/g;
const SKILL_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const READ_COMMAND = /^\s*(?:\S*\/)?(?:cat|bat|sed|rg|grep|egrep|fgrep|head|tail|less|more|nl|awk|strings|xxd|od|hexdump)\s/;
const WRITES_TO_FILE = /(?<![-=<>!0-9])>>?\s*\S|\bsed\b[^\n]*\s-i\b/;
const QUOTED_RUN = /"[^"]*"|'[^']*'/g;
const COMMAND_LITERAL = /\bcmd["']?\s*:\s*(?:"((?:[^"\\]|\\[\s\S])*)"|'((?:[^'\\]|\\[\s\S])*)'|`((?:[^`\\]|\\[\s\S])*)`)/g;
const BACKSLASH_ESCAPE = /\\([\s\S])/g;
const STRING_ESCAPES = {
	n: "\n",
	t: "	",
	r: "\r"
};
const SHELL_SEGMENT = /(?:"[^"]*"|'[^']*'|[^;|&\n"'])+/g;
const STRICT_NOTICE_KINDS = [LOGIN_NOTICE_KIND, NOTICE_KIND_CREDENTIAL];
//#endregion
//#region src/utils/console/silence-warnings.ts
function silenceWarnings(run) {
	const warn = console.warn;
	console.warn = () => void 0;
	try {
		return run();
	} finally {
		console.warn = warn;
	}
}
//#endregion
//#region src/utils/isRecord.ts
function isRecord(value) {
	return value != null && typeof value === "object" && !Array.isArray(value);
}
//#endregion
//#region src/config.ts
function parseBoolean(value) {
	const normalized = value?.trim().toLowerCase();
	if (normalized === void 0) return void 0;
	if (ENV_TRUE_VALUES.includes(normalized)) return true;
	if (ENV_FALSE_VALUES.includes(normalized)) return false;
}
function parseCooldown(value) {
	const normalized = value?.trim().toLowerCase();
	if (normalized === void 0 || normalized === "off") return normalized;
	return normalized !== "" && Number.isFinite(Number(normalized)) ? Number(normalized) : value;
}
function parseStrictBoolean(value) {
	const normalized = value.toLowerCase();
	if (normalized === "true") return true;
	if (normalized === "false") return false;
}
function parseJson(value) {
	if (value === void 0) return void 0;
	try {
		return JSON.parse(value);
	} catch {
		return;
	}
}
function parseParentHeaders(value) {
	if (!isRecord(value) || typeof value["langsmith-trace"] !== "string") return void 0;
	const { baggage } = value;
	if (baggage !== void 0 && typeof baggage !== "string") return void 0;
	return {
		[PARENT_TRACE_HEADER]: value[PARENT_TRACE_HEADER],
		...baggage === void 0 ? {} : { baggage }
	};
}
function envSwitch(env, keys, parse, restrictive) {
	const value = keys.map((key) => env[key]).find((entry) => entry !== void 0);
	return value === void 0 ? void 0 : parse(value) ?? restrictive;
}
function nonBlank(value) {
	return value === void 0 || value.trim() === "" ? void 0 : value;
}
function envVariable(env, suffix, prefixes = ENV_PREFIXES) {
	return prefixes.map((prefix) => nonBlank(env[`${prefix}${suffix}`])).find((value) => value !== void 0);
}
function readEnvironment(env) {
	const rawParent = parseJson(envVariable(env, ENV_SUFFIXES.parentHeaders));
	const parentHeaders = rawParent === void 0 ? void 0 : parseParentHeaders(rawParent);
	const fields = {
		api_key: envVariable(env, ENV_SUFFIXES.apiKey, [PLUGIN_ENV_PREFIX]),
		api_url: envVariable(env, ENV_SUFFIXES.apiUrl),
		project: envVariable(env, ENV_SUFFIXES.project),
		metadata: parseJson(envVariable(env, ENV_SUFFIXES.metadata)),
		replicas: parseJson(envVariable(env, ENV_SUFFIXES.replicas)),
		redact: parseBoolean(envVariable(env, ENV_SUFFIXES.redact)),
		redact_extra_rules: parseJson(envVariable(env, ENV_SUFFIXES.redactExtraRules)),
		notice_cooldown: parseCooldown(envVariable(env, ENV_SUFFIXES.noticeCooldown)),
		strict_auth: parseBoolean(envVariable(env, ENV_SUFFIXES.strictAuth))
	};
	const parsed = parseCommonConfig(Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== void 0)));
	if (parsed.status !== "valid" || rawParent !== void 0 && parentHeaders === void 0) return { common: {} };
	return {
		common: parsed.common,
		parentHeaders
	};
}
async function getConfig({ home, cwd, env }) {
	const files = readCommonConfigFiles({
		cwd,
		home,
		harnessDirectory: CODEX_CONFIG_DIRECTORY
	});
	const environment = readEnvironment(env);
	const { managed } = files;
	const { diagnostics, defaulted, ...common } = silenceWarnings(() => mergeCommonConfig({
		managed,
		userRoot: files.userRoot.common,
		user: files.user.common,
		root: files.root.common,
		harness: files.harness.common,
		env: {
			...environment.common,
			enabled: envSwitch(env, ENABLED_ENV_KEYS, parseBoolean, COMMON_BOOLEAN_SETTINGS.enabled.restrictive),
			defaultMuted: envSwitch(env, DEFAULT_MUTED_ENV_KEYS, parseStrictBoolean, COMMON_BOOLEAN_SETTINGS.defaultMuted.restrictive)
		}
	}, { envFirst: true }));
	const lockedHeaders = lockPluginFields(managed, { lockable: [PARENT_HEADERS_FIELD] });
	const parentHeaders = Object.hasOwn(lockedHeaders, "parent_headers") ? parseParentHeaders(lockedHeaders[PARENT_HEADERS_FIELD]) : environment.parentHeaders ?? [
		files.harness,
		files.root,
		files.user,
		files.userRoot
	].map((file) => parseParentHeaders(file.raw?.parent_headers)).find((headers) => headers !== void 0);
	return {
		...common,
		api_key: nonBlank(common.api_key),
		api_url: nonBlank(common.api_url),
		project: nonBlank(common.project) ?? "codex",
		...parentHeaders === void 0 ? {} : { parent_headers: parentHeaders },
		...diagnostics.length === 0 ? {} : { managedConfigWarnings: diagnostics }
	};
}
//#endregion
//#region src/tracing-engine-locator.ts
function transcriptSourceRef(transcriptPath) {
	return `${TRANSCRIPT_LOCATOR_PREFIX}${Buffer.from(nodePath.resolve(transcriptPath)).toString("base64url")}`;
}
function transcriptPathFromRef(sourceRef) {
	if (!sourceRef.startsWith("codex-transcript:")) throw new Error("Codex reconstruction source is not a transcript locator");
	const value = Buffer.from(sourceRef.slice(17), "base64url").toString("utf8");
	if (!nodePath.isAbsolute(value) || transcriptSourceRef(value) !== sourceRef) throw new Error("Codex transcript locator is invalid");
	return value;
}
function reconstructionDigest(sessionId, turnId, sourceRef, mode) {
	return createHash("sha256").update(JSON.stringify([
		sessionId,
		turnId,
		sourceRef,
		mode
	])).digest("hex");
}
function reconstructionEventId(sessionId, turnId, sourceRef, mode) {
	return `${RECONSTRUCTION_EVENT_PREFIX}${reconstructionDigest(sessionId, turnId, sourceRef, mode)}`;
}
function contextSourceRef(sessionId, turnId, sourceRef, mode) {
	return `${CONTEXT_LOCATOR_PREFIX}${reconstructionDigest(sessionId, turnId, sourceRef, mode)}`;
}
function contextDigestFromRef(contextRef) {
	const digest = contextRef.startsWith("codex-context:") ? contextRef.slice(14) : "";
	if (!CONTEXT_DIGEST_PATTERN.test(digest)) throw new Error("Codex reconstruction context locator is invalid");
	return digest;
}
//#endregion
//#region src/job-context.ts
function jobStore(home) {
	return createStateStore({ path: nodePath.join(home, CODEX_CONFIG_DIRECTORY, JOB_STATE_FILE_NAME) });
}
async function saveJobContext(home, sessionId, contextRef, context) {
	const job = contextDigestFromRef(contextRef);
	await mkdir(nodePath.join(home, CODEX_CONFIG_DIRECTORY), {
		recursive: true,
		mode: 448
	});
	await jobStore(home).update((state) => {
		const fresh = pruneStateEntries(state, STATE_FILE_MAX_AGE_MS);
		const queued = Object.hasOwn(fresh, sessionId) ? fresh[sessionId].queued_jobs : {};
		return {
			...fresh,
			[sessionId]: {
				updated: (/* @__PURE__ */ new Date()).toISOString(),
				queued_jobs: {
					...queued,
					[job]: context
				}
			}
		};
	});
}
function readJobContext(home, sessionId, contextRef) {
	const state = jobStore(home).read();
	const queued = Object.hasOwn(state, sessionId) ? state[sessionId].queued_jobs : {};
	const job = contextDigestFromRef(contextRef);
	return Object.hasOwn(queued, job) ? queued[job] : void 0;
}
async function removeJobContext(home, sessionId, contextRef) {
	const job = contextDigestFromRef(contextRef);
	await jobStore(home).update((state) => {
		if (!Object.hasOwn(state, sessionId)) return state;
		const { [job]: _done, ...queued } = state[sessionId].queued_jobs;
		const { [sessionId]: session, ...others } = state;
		return Object.keys(queued).length === 0 ? others : {
			...others,
			[sessionId]: {
				...session,
				queued_jobs: queued
			}
		};
	});
}
//#endregion
//#region src/utils/findLast.ts
const findLast = (array, predicate) => {
	for (let i = array.length - 1; i >= 0; i--) if (predicate(array[i])) return array[i];
};
//#endregion
//#region src/skills.ts
function skillDirectoryInPath(word) {
	const parts = word.split(/[/\\]/);
	const name = parts.at(-2);
	if (parts.at(-1) !== "SKILL.md" || name == null || !SKILL_DIR_NAME.test(name)) return void 0;
	return parts.slice(0, -2).includes("skills") ? name : void 0;
}
function shellCommands(args) {
	if (typeof args !== "string") {
		const cmd = args?.cmd;
		return typeof cmd === "string" ? [cmd] : [];
	}
	return [...args.matchAll(COMMAND_LITERAL)].map(([, double, single, backtick]) => (double ?? single ?? backtick).replace(BACKSLASH_ESCAPE, (_, char) => STRING_ESCAPES[char] ?? char));
}
function skillNamesFromToolCall(toolName, args) {
	if (toolName == null || !SHELL_TOOL_NAMES.has(toolName)) return [];
	const segments = shellCommands(args).flatMap((command) => command.match(SHELL_SEGMENT) ?? []);
	const names = /* @__PURE__ */ new Set();
	for (const segment of segments) {
		const unquoted = segment.replace(QUOTED_RUN, " ");
		if (!READ_COMMAND.test(segment) || WRITES_TO_FILE.test(unquoted)) continue;
		for (const word of segment.match(SHELL_WORD) ?? []) {
			const name = skillDirectoryInPath(word);
			if (name != null) names.add(name);
		}
	}
	return [...names];
}
//#endregion
//#region src/utils/isPrimitive.ts
function isPrimitive(value) {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
//#endregion
//#region src/privacy.ts
const metadataProtectedRunTrees = /* @__PURE__ */ new WeakSet();
function applyMetadataResets(run, config) {
	const source = config.extra?.metadata;
	if (!source) return;
	const resets = {};
	for (const key of RESETTABLE_METADATA_KEYS) if (Object.hasOwn(source, key) && source[key] === void 0) resets[key] = void 0;
	if (Object.keys(resets).length === 0) return;
	run.extra = {
		...run.extra,
		metadata: {
			...run.extra?.metadata,
			...resets
		}
	};
}
function protectedChildRunTree(config, mode, parent, child) {
	const safeChild = createCodingAgentRunTree({
		...config,
		client: child.client,
		id: child.id,
		parent_run: parent,
		parent_run_id: child.parent_run_id,
		project_name: child.project_name,
		replicas: child.replicas,
		trace_id: child.trace_id,
		dotted_order: child.dotted_order,
		start_time: child.start_time,
		end_time: child.end_time
	}, LS_INTEGRATION, mode);
	applyMetadataResets(safeChild, config);
	safeChild.execution_order = child.execution_order;
	safeChild.child_execution_order = child.child_execution_order;
	parent.child_runs[parent.child_runs.indexOf(child)] = safeChild;
	metadataProtectedRunTrees.add(safeChild);
	return safeChild;
}
function createChildRunTree(config, mode, parent) {
	const child = parent.createChild(config);
	applyMetadataResets(child, config);
	if (mode !== "metadata" || metadataProtectedRunTrees.has(parent)) {
		if (mode === "metadata") metadataProtectedRunTrees.add(child);
		return child;
	}
	return protectedChildRunTree(config, mode, parent, child);
}
function createRunTree(config, mode = MODE_FULL, parent) {
	if (parent) return createChildRunTree(config, mode, parent);
	const run = createCodingAgentRunTree(config, LS_INTEGRATION, mode);
	if (mode === "metadata") metadataProtectedRunTrees.add(run);
	return run;
}
//#endregion
//#region src/utils/home.ts
function homeDirectory() {
	return process.env.HOME ?? os.homedir();
}
//#endregion
//#region src/utils/validation/tracing-policy.ts
function isMode(value) {
	return value === "full" || value === "metadata";
}
function isTurnMode(value) {
	return isMode(value) || value === "off";
}
function validThread(value) {
	return isRecord(value) && (!Object.hasOwn(value, "preference") || isMode(value.preference)) && isRecord(value.turns) && Object.values(value.turns).every(isTurnMode) && (value.inherited === void 0 || isTurnMode(value.inherited)) && Object.keys(value).every((key) => POLICY_THREAD_KEYS.includes(key));
}
function parsePolicy(value) {
	if (!isRecord(value) || value.version !== 1 || !isRecord(value.threads) || Object.values(value.threads).some((thread) => !validThread(thread)) || Object.keys(value).some((key) => !POLICY_TOP_LEVEL_KEYS.includes(key))) throw new Error(POLICY_INVALID_MESSAGE);
	return value;
}
//#endregion
//#region src/tracing-policy.ts
const POLICY_FILE = {
	empty: () => ({
		version: 1,
		threads: {}
	}),
	parse: parsePolicy
};
function defaultPrivacyPath() {
	return nodePath.join(homeDirectory(), CODEX_CONFIG_DIRECTORY, PRIVACY_FILE_NAME);
}
function adoptLegacyPreferences(file) {
	if (nodePath.basename(file) !== "langsmith_state_privacy.json") return file;
	try {
		copyFileSync(nodePath.join(nodePath.dirname(file), LEGACY_PRIVACY_FILE_NAME), file, constants.COPYFILE_EXCL);
	} catch {}
	return file;
}
function threadPolicy(policy, id) {
	return Object.hasOwn(policy.threads, id) ? policy.threads[id] : void 0;
}
/** No launch evidence means metadata-only, never today's sticky preference. */
function savedTurnMode(file, sessionId, turnId) {
	try {
		const thread = threadPolicy(readPolicyFile(adoptLegacyPreferences(file), POLICY_FILE), sessionId);
		if (thread?.inherited) return thread.inherited;
		return turnId && thread && Object.hasOwn(thread.turns, turnId) ? thread.turns[turnId] : MODE_METADATA;
	} catch {
		return MODE_METADATA;
	}
}
function muteLocked(config) {
	return config.defaultMuted && config.locked.includes("defaultMuted");
}
function lockedTurnMode(config, sessionId, turnId) {
	const mode = savedTurnMode(defaultPrivacyPath(), sessionId, turnId);
	return mode === "full" && muteLocked(config) ? MODE_METADATA : mode;
}
/** Exact, argument-free commands only; ordinary prompts are never interpreted. */
function parseTracingCommand(prompt) {
	if (prompt === "langsmith-tracing:mute") return "mute";
	if (prompt === "langsmith-tracing:unmute") return "unmute";
}
function requireIds(sessionId, turnId) {
	if (typeof sessionId !== "string" || !sessionId || typeof turnId !== "string" || !turnId) throw new Error("Nonempty native session_id and turn_id are required; update Codex and enable synchronous UserPromptSubmit hooks");
}
/** One atomic transaction preserves active/queued snapshots before changing preference. */
async function submitPreference(file, request) {
	const { sessionId, turnId, enabled, command, defaultMuted = false, mutedLocked = false } = request;
	const lockedMode = mutedLocked && enabled ? MODE_METADATA : void 0;
	requireIds(sessionId, turnId);
	return updatePolicyFile(adoptLegacyPreferences(file), POLICY_FILE, (policy) => {
		const thread = threadPolicy(policy, sessionId) ?? { turns: {} };
		if (!Object.hasOwn(thread.turns, turnId)) thread.turns = {
			...thread.turns,
			[turnId]: lockedMode ?? thread.inherited ?? (enabled ? thread.preference ?? (defaultMuted ? "metadata" : "full") : "off")
		};
		if (command && !(mutedLocked && command === "unmute")) thread.preference = command === "mute" ? MODE_METADATA : MODE_FULL;
		policy.threads = {
			...policy.threads,
			[sessionId]: thread
		};
	});
}
/** First launch wins, even after unmute, a direct child Stop, or sidecar deletion. */
async function inheritThreadMode(file, sessionId, mode) {
	let inherited = MODE_METADATA;
	const result = await updatePolicyFile(adoptLegacyPreferences(file), POLICY_FILE, (policy) => {
		const thread = threadPolicy(policy, sessionId) ?? { turns: {} };
		thread.inherited ??= mode;
		inherited = thread.inherited;
		policy.threads = {
			...policy.threads,
			[sessionId]: thread
		};
	});
	if (result.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${result.warning}`);
	return inherited;
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
//#region src/utils/omitKey.ts
function omitKey(value, key) {
	return Object.fromEntries(Object.entries(value ?? {}).filter(([entry]) => entry !== key));
}
//#endregion
//#region src/tool-path.ts
function toolOriginFromArgs(args, cwd) {
	const session = cwd === void 0 ? {} : { cwd };
	const named = typeof args === "string" ? [PATCH_FILE_PATTERN.exec(args)?.[1]] : isRecord(args) ? TOOL_PATH_INPUT_KEYS.map((key) => args[key]) : [];
	let namedAPath = false;
	for (const value of named) {
		if (typeof value !== "string" || value.length === 0) continue;
		namedAPath = true;
		if (isAbsolute(value)) return {
			path: value,
			namedAPath,
			...session
		};
		if (!cwd || !isAbsolute(cwd)) continue;
		const resolved = resolve(cwd, value);
		if (existsSync(resolved)) return {
			path: resolved,
			namedAPath,
			...session
		};
	}
	return {
		namedAPath,
		...session
	};
}
//#endregion
//#region src/utils/rollout.ts
async function loadSession(name) {
	return (await nodeFsPromises.readFile(name, "utf-8")).split("\n").filter(Boolean).map((line) => JSON.parse(line));
}
async function startedByPerson(file) {
	if (!file) return false;
	const lines = createInterface({
		input: createReadStream(file),
		crlfDelay: Infinity
	});
	try {
		for await (const line of lines) {
			const meta = JSON.parse(line);
			return PERSON_SESSION_SOURCES.includes(meta.payload?.source);
		}
	} catch {
		return false;
	} finally {
		lines.close();
	}
	return false;
}
function resolveSessionsRoot(parentFileName) {
	let dir = nodePath.dirname(nodePath.resolve(parentFileName));
	while (true) {
		if (nodePath.basename(dir) === "sessions") return dir;
		const up = nodePath.dirname(dir);
		if (up === dir) break;
		dir = up;
	}
	return nodePath.join(homeDirectory(), CODEX_CONFIG_DIRECTORY, "sessions");
}
async function findRolloutFileByThreadId(parentFileName, threadId) {
	const suffix = `-${threadId}.jsonl`;
	const root = resolveSessionsRoot(parentFileName);
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
//#endregion
//#region src/utils/subagents.ts
function extractSpawnedAgentId(output) {
	let obj = output;
	if (typeof output === "string") try {
		obj = JSON.parse(output);
	} catch {
		return;
	}
	if (obj != null && typeof obj === "object") {
		const id = obj.agent_id;
		if (typeof id === "string") return id;
	}
}
function extractSubagentActivities(payload) {
	const activities = [];
	if (payload.type === "sub_agent_activity" && payload.kind === "started") {
		if (typeof payload.agent_thread_id === "string") activities.push({
			threadId: payload.agent_thread_id,
			callId: typeof payload.event_id === "string" ? payload.event_id : void 0
		});
		return activities;
	}
	if (payload.type !== "item_completed" || !isRecord(payload.item)) return activities;
	const item = payload.item;
	const callId = typeof item.id === "string" ? item.id : void 0;
	if (item.type === "SubAgentActivity" && item.kind === "started" && typeof item.agent_thread_id === "string") activities.push({
		threadId: item.agent_thread_id,
		callId
	});
	if (item.type === "CollabAgentToolCall" && item.tool === "spawn_agent") {
		const ids = /* @__PURE__ */ new Set();
		if (Array.isArray(item.receiver_thread_ids)) {
			for (const id of item.receiver_thread_ids) if (typeof id === "string") ids.add(id);
		}
		if (Array.isArray(item.receiver_agents)) {
			for (const agent of item.receiver_agents) if (isRecord(agent) && typeof agent.thread_id === "string") ids.add(agent.thread_id);
		}
		for (const threadId of ids) activities.push({
			threadId,
			callId
		});
	}
	return activities;
}
//#endregion
//#region src/turn-mode.ts
function parentThreadId(meta) {
	const source = meta.payload.source;
	return source && typeof source === "object" ? source.subagent?.thread_spawn?.parent_thread_id ?? meta.payload.parent_thread_id : meta.payload.parent_thread_id;
}
function isChildSession(meta, parentId) {
	const source = meta.payload.source;
	return !!parentId || meta.payload.thread_source === "subagent" || !!source && typeof source === "object" && !!source.subagent;
}
async function launchedTurns(parentFile, sessionId) {
	let nativeTurn;
	const calls = /* @__PURE__ */ new Map();
	const launches = /* @__PURE__ */ new Set();
	for (const event of await loadSession(parentFile)) {
		if (event.type === "event_msg") {
			if (event.payload.type === "task_started") nativeTurn = event.payload.turn_id;
			const ids = extractSubagentActivities(event.payload).map((activity) => activity.threadId);
			if (event.payload.type === "collab_agent_spawn_end" && typeof event.payload.new_thread_id === "string") ids.push(event.payload.new_thread_id);
			if (nativeTurn && ids.includes(sessionId)) launches.add(nativeTurn);
			if ([
				"task_complete",
				"turn_complete",
				"turn_aborted"
			].includes(event.payload.type)) nativeTurn = void 0;
		}
		if (event.type === "response_item") {
			if (event.payload.type === "function_call" && event.payload.name === "spawn_agent" && nativeTurn) calls.set(event.payload.call_id, nativeTurn);
			if (event.payload.type === "function_call_output" && calls.has(event.payload.call_id) && extractSpawnedAgentId(event.payload.output) === sessionId) launches.add(calls.get(event.payload.call_id));
		}
	}
	return launches;
}
async function parentLaunchMode(file, sessionId, parentId, visited) {
	const parentFile = parentId ? await findRolloutFileByThreadId(file, parentId) : void 0;
	if (!parentFile || !parentId) return MODE_METADATA;
	const launches = await launchedTurns(parentFile, sessionId);
	if (launches.size !== 1) return MODE_METADATA;
	return rolloutTurnMode(parentFile, parentId, [...launches][0], visited);
}
/** A child thread's Stop uses its parent's turn mode, and falls back to metadata-only when the launch can't be matched. */
async function rolloutTurnMode(file, sessionId, turnId, visited = /* @__PURE__ */ new Set()) {
	if (visited.has(sessionId)) return MODE_METADATA;
	visited.add(sessionId);
	const meta = (await loadSession(file)).find((event) => event.type === "session_meta");
	if (meta?.type !== "session_meta" || meta.payload.id !== sessionId) return MODE_METADATA;
	const parentId = parentThreadId(meta);
	if (!isChildSession(meta, parentId)) return savedTurnMode(defaultPrivacyPath(), sessionId, turnId);
	const mode = await parentLaunchMode(file, sessionId, parentId, visited);
	try {
		return await inheritThreadMode(defaultPrivacyPath(), sessionId, mode);
	} catch {
		return MODE_METADATA;
	}
}
//#endregion
//#region src/trace.ts
function formatError(value) {
	if (value == null) return void 0;
	if (typeof value === "string") return value || void 0;
	if (isPrimitive(value)) return String(value);
	if (isRecord(value)) {
		const message = typeof value.message === "string" ? value.message : void 0;
		const details = typeof value.additional_details === "string" ? value.additional_details : void 0;
		const info = value.codex_error_info;
		const parts = [
			message,
			details,
			typeof info === "string" ? info : info != null ? JSON.stringify(info) : void 0
		].filter((part) => part != null && part.length > 0);
		if (parts.length > 0) return parts.join(" — ");
	}
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
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
function convertMessage(message) {
	return {
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
	};
}
function convertFunctionCall(message) {
	const name = message.name;
	const id = message.call_id;
	const args = message.arguments;
	try {
		return {
			role: "ai",
			content: [{
				type: "tool_call",
				name,
				id,
				args: JSON.parse(args)
			}]
		};
	} catch {
		return {
			role: "ai",
			content: [{
				type: "tool_call_chunk",
				name,
				id,
				args
			}]
		};
	}
}
function convertToolOutput(message) {
	return {
		role: "tool",
		content: [{
			type: "text",
			text: typeof message.output === "string" ? message.output : JSON.stringify(message.output)
		}],
		tool_call_id: message.call_id
	};
}
function convertCustomToolCall(message) {
	return {
		role: "ai",
		content: [{
			type: "tool_call",
			name: message.name,
			id: message.call_id,
			args: message.input
		}]
	};
}
function convertToolSearchCall(message) {
	return {
		role: "ai",
		content: [{
			type: "tool_call",
			name: message.type,
			id: message.call_id,
			args: message.arguments
		}]
	};
}
function convertToolSearchOutput(message) {
	return {
		role: "tool",
		content: [{
			type: "text",
			text: JSON.stringify(message.tools)
		}],
		tool_call_id: message.call_id
	};
}
function convertReasoning(message) {
	const { type: _, content: reasoningRaw, ...extras } = message;
	return {
		role: "ai",
		content: [{
			type: "reasoning",
			reasoning: message.content ? typeof message.content === "string" ? message.content : JSON.stringify(message.content) : void 0,
			extras
		}]
	};
}
function convertItem(message) {
	if (message.type === "message") return convertMessage(message);
	if (message.type === "function_call") return convertFunctionCall(message);
	if (message.type === "function_call_output") return convertToolOutput(message);
	if (message.type === "custom_tool_call") return convertCustomToolCall(message);
	if (message.type === "custom_tool_call_output") return convertToolOutput(message);
	if (message.type === "tool_search_call") return convertToolSearchCall(message);
	if (message.type === "tool_search_output") return convertToolSearchOutput(message);
	if (message.type === "reasoning") return convertReasoning(message);
	return {
		role: "unknown",
		content: [{
			type: "non_standard",
			value: message
		}],
		_raw: message
	};
}
function convertToStandardMessages(messages) {
	return messages.map(({ message, ...rest }) => ({
		message: convertItem(message),
		...rest
	}));
}
function buildChildRunMetadata(options, reset = CHILD_SCOPE_RESET) {
	return Object.assign(buildCodingAgentMetadata(options), reset);
}
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
function getSystemMessage(session, task) {
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
}
async function resolveTurnMode(task, sessionMeta, privacyTurnId, request) {
	const nativeMode = sessionMeta?.session_id ? await rolloutTurnMode(request.rolloutFile, sessionMeta.session_id, privacyTurnId) : MODE_METADATA;
	const mode = nativeMode === "off" ? "off" : request.options.privacyMode === "metadata" || nativeMode === "metadata" ? MODE_METADATA : MODE_FULL;
	for (const child of task.subagentThreads) try {
		await inheritThreadMode(defaultPrivacyPath(), child, mode);
	} catch {}
	return mode;
}
function turnMetadata(task, sessionMeta, options) {
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
	const isSubagent = sessionMeta?.is_subagent === true;
	const conversationThreadId = (isSubagent ? sessionMeta?.parent_thread_id : void 0) ?? sessionMeta?.session_id;
	const metadataBase = {
		...options.metadata,
		...omitKey(task.context, "approval_policy"),
		...cwd === void 0 ? {} : { cwd },
		...sandboxType === void 0 ? {} : { sandbox_type: sandboxType }
	};
	return {
		metadataContext: {
			integration: LS_INTEGRATION,
			integrationVersion: LS_INTEGRATION_VERSION,
			runtimeVersion: sessionMeta?.cli_version,
			threadId: conversationThreadId ?? "",
			turnId: task.turnId?.id,
			turnNumber: task.turnNumber,
			agentType: isSubagent ? "subagent" : "root"
		},
		metadataBase,
		isSubagent,
		approvalPolicy,
		cwd
	};
}
function parentProviderMetadata(task, sessionMeta) {
	return {
		codex_cli_version: sessionMeta?.cli_version,
		ls_message_format: "anthropic",
		ls_raw_aggregated_usage: getUsageMetadata(task.tokenCount?.total_token_usage)
	};
}
async function createParentRun(draft, user, agent) {
	const { task, sessionMeta, isSubagent, approvalPolicy, metadataContext, metadataBase } = draft;
	const { mode, parentStartTime } = draft;
	const options = draft.request.options;
	const parentEndTime = agent.at(-1)?.timestamp.end ?? parentStartTime;
	const parentMetadata = {
		...metadataContext,
		runType: task.isErrorInterrupt ? "interrupted" : "root",
		approvalPolicy: isSubagent ? void 0 : approvalPolicy,
		subagentId: isSubagent ? sessionMeta?.session_id : void 0,
		subagentType: isSubagent ? sessionMeta?.agent_role ?? sessionMeta?.agent_nickname : void 0,
		providerMetadata: parentProviderMetadata(task, sessionMeta),
		base: {
			...metadataBase,
			...task.isErrorInterrupt ? { ls_is_error_interrupt: true } : {}
		}
	};
	const parent = createRunTree({
		id: options.nextRunId(),
		name: "openai.codex",
		client: options.client,
		project_name: options.projectName,
		run_type: "chain",
		replicas: options.replicas,
		inputs: { messages: user != null ? [user.message] : [] },
		outputs: { messages: agent.map((i) => i.message) },
		error: task.error,
		start_time: parentStartTime,
		end_time: parentEndTime,
		extra: { metadata: Object.assign(buildCodingAgentMetadata(parentMetadata), isSubagent ? SUBAGENT_SCOPE_RESET : {}) }
	}, mode, options.parentRunTree);
	await options.captureRun(parent, mode, parentMetadata);
	return parent;
}
function modelSpans(fullMessages, includeOpenTurn = false) {
	return fullMessages.reduce((acc, item, idx) => {
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
		if (includeOpenTurn && nonToolIdx === -1) return {
			start,
			length: fullMessages.length - start
		};
		return {
			start,
			length: 1
		};
	});
}
async function postSubagentThread(context, subagentThread) {
	if (context.postedSubagentThreads.has(subagentThread)) return;
	context.postedSubagentThreads.add(subagentThread);
	const subagentFile = await findRolloutFileByThreadId(context.request.rolloutFile, subagentThread);
	if (subagentFile == null) return;
	const events = await loadSession(subagentFile);
	await convertToRunTree({
		transcript_path: subagentFile,
		turn_id: findLast(events, (event) => event.type === "event_msg" && event.payload.turn_id != null)?.payload.turn_id ?? null
	}, {
		...context.request.options,
		parentRunTree: context.parent,
		replayHistory: true
	});
}
async function postModelRun(context, fullMessages, output) {
	const { task, sessionMeta, metadataContext, childMetadataBase, mode, parent } = context;
	const { parentStartTime } = context;
	const options = context.request.options;
	const inputMessages = fullMessages.slice(0, output.start);
	const aiMessage = fullMessages.slice(output.start, output.start + 1);
	const toolMessages = fullMessages.slice(output.start + 1, output.start + output.length);
	const outputStartTime = inputMessages.at(-1)?.timestamp.end ?? aiMessage.at(0)?.timestamp.start ?? parentStartTime;
	const outputEndTime = Math.max(aiMessage.at(-1)?.timestamp.end ?? outputStartTime, outputStartTime);
	const tokenCounts = findLast(aiMessage, (i) => i.tokenCount != null)?.tokenCount;
	const subagentThreads = findLast(aiMessage, (message) => message.subagentThreads.length > 0)?.subagentThreads;
	const llmMetadata = {
		...metadataContext,
		runType: "llm",
		clearSubagent: true,
		modelName: typeof task.context?.model === "string" ? task.context.model : void 0,
		usageMetadata: getUsageMetadata(tokenCounts),
		providerMetadata: {
			ls_model_type: "chat",
			ls_provider: sessionMeta?.model_provider ?? void 0,
			ls_invocation_params: task.context
		},
		base: childMetadataBase
	};
	const llmChild = createRunTree({
		id: options.nextRunId(),
		name: "openai.codex.turn",
		run_type: "llm",
		start_time: outputStartTime,
		end_time: outputEndTime,
		inputs: { messages: inputMessages.map((i) => i.message) },
		outputs: { messages: aiMessage.map((i) => i.message) },
		extra: { metadata: buildChildRunMetadata(llmMetadata) }
	}, mode, parent);
	await options.captureRun(llmChild, mode, llmMetadata);
	return {
		aiMessage,
		toolMessages,
		subagentThreads
	};
}
async function postSkillRuns(context, skillNames, window, toolCall) {
	const { metadataContext, childMetadataBase, mode, parent } = context;
	const { min, max } = window;
	const options = context.request.options;
	for (const skillName of skillNames) {
		const skillMetadata = {
			...metadataContext,
			runType: "tool",
			clearSubagent: true,
			skillName,
			base: childMetadataBase
		};
		const skillRun = createRunTree({
			id: options.nextRunId(),
			name: "Skill",
			run_type: "tool",
			start_time: min,
			end_time: max,
			inputs: { input: { skill: skillName } },
			outputs: { output: {
				commandName: skillName,
				success: toolCall.error == null
			} },
			extra: { metadata: buildChildRunMetadata(skillMetadata, SKILL_SCOPE_RESET) }
		}, mode, parent);
		await options.captureRun(skillRun, mode, skillMetadata);
	}
}
async function postToolRuns(context, aiMessage, toolMessages) {
	const { task, sessionMeta, metadataContext, childMetadataBase, mode, parent } = context;
	const options = context.request.options;
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
		const callTime = aiMessage.at(0)?.timestamp.start;
		const min = Math.min(toolMessage.timestamp.start, ...callTime != null ? [callTime] : [], ...toolCall.timings);
		const max = Math.max(toolMessage.timestamp.end, ...toolCall.timings);
		const nativeToolName = typeof msgToolCall.name === "string" ? msgToolCall.name : void 0;
		const runName = nativeToolName ?? "openai.codex.tool";
		const skillNames = skillNamesFromToolCall(nativeToolName, msgToolCall.args);
		const toolMetadata = {
			...metadataContext,
			runType: "tool",
			clearSubagent: true,
			modelName: typeof task.context?.model === "string" ? task.context.model : void 0,
			usageMetadata: getUsageMetadata(toolMessage.tokenCount),
			...nativeToolName == null ? {} : {
				toolName: nativeToolName,
				runName
			},
			providerMetadata: {
				ls_model_type: "chat",
				ls_provider: sessionMeta?.model_provider ?? void 0,
				ls_invocation_params: task.context
			},
			base: toolMetadataBase(context, msgToolCall.args)
		};
		const sequentialId = options.nextRunId();
		const toolRun = createRunTree({
			id: options.toolRunId?.(toolCallId) ?? sequentialId,
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
			extra: { metadata: buildChildRunMetadata(toolMetadata) }
		}, mode, parent);
		await options.captureRun(toolRun, mode, toolMetadata);
		await postSkillRuns(context, skillNames, {
			min,
			max
		}, toolCall);
	}
}
async function postModelAndToolRuns(context, messages) {
	const fullMessages = mergeMessages([...getSystemMessage(context.sessionMeta, context.task), ...messages]);
	for (const output of modelSpans(fullMessages, context.request.includeOpenTurn)) {
		const { aiMessage, toolMessages, subagentThreads } = await postModelRun(context, fullMessages, output);
		await postToolRuns(context, aiMessage, toolMessages);
		for (const subagentThread of subagentThreads ?? []) await postSubagentThread(context, subagentThread);
	}
}
async function postTurn(task, sessionMeta, privacyTurnId, request) {
	const mode = await resolveTurnMode(task, sessionMeta, privacyTurnId, request);
	if (mode === "off") return;
	const fallbackTime = Date.now();
	const messages = convertToStandardMessages(task.messages);
	const user = task.userMessageIndex != null ? messages.at(task.userMessageIndex) : void 0;
	const agent = mergeMessages(task.userMessageIndex != null ? messages.slice(task.userMessageIndex + 1) : messages);
	const parentStartTime = task.turnId?.timestamp ?? fallbackTime;
	const unattributed = turnMetadata(task, sessionMeta, request.options);
	const attributor = mode === "full" ? request.options.attributor : void 0;
	const origins = attributor ? toolOrigins(messages, unattributed.cwd) : [];
	const draft = {
		...unattributed,
		metadataBase: attributor?.turnMetadata(unattributed.metadataBase, unattributed.cwd, origins) ?? unattributed.metadataBase,
		task,
		sessionMeta,
		request,
		mode,
		parentStartTime
	};
	const context = {
		...draft,
		childMetadataBase: childBase(draft.metadataBase, draft),
		unattributedChildBase: childBase(unattributed.metadataBase, draft),
		parent: await createParentRun(draft, user, agent),
		postedSubagentThreads: /* @__PURE__ */ new Set()
	};
	await postModelAndToolRuns(context, messages);
	for (const subagentThread of task.subagentThreads) await postSubagentThread(context, subagentThread);
}
function childBase(base, draft) {
	return draft.mode === "full" ? {
		...base,
		...omitKey(parentProviderMetadata(draft.task, draft.sessionMeta), "ls_raw_aggregated_usage")
	} : base;
}
function toolOrigins(messages, cwd) {
	return messages.flatMap(({ message }) => message.role === "ai" ? message.content.filter((c) => c.type === "tool_call").map((c) => toolOriginFromArgs(c.args, cwd)) : []);
}
function toolMetadataBase(context, args) {
	const attributor = context.mode === "full" ? context.request.options.attributor : void 0;
	if (!attributor) return context.childMetadataBase;
	const origin = toolOriginFromArgs(args, context.cwd);
	return attributor.toolMetadata(context.unattributedChildBase, origin) ?? context.childMetadataBase;
}
function createTask() {
	return {
		turnId: void 0,
		turnNumber: void 0,
		messages: [],
		userMessageIndex: void 0,
		context: void 0,
		tokenCount: void 0,
		error: void 0,
		isErrorInterrupt: false,
		subagentThreads: [],
		toolCalls: {}
	};
}
function recordSubagentThread(walk, task, threadId, callId) {
	if (!task.subagentThreads.includes(threadId)) task.subagentThreads.push(threadId);
	if (callId == null) return;
	const message = walk.spawnAgentMessages.get(callId);
	if (message != null && !message.subagentThreads.includes(threadId)) message.subagentThreads.push(threadId);
}
function readSessionMeta(payload) {
	const source = payload.source;
	const threadSpawn = source != null && typeof source === "object" && "subagent" in source ? source.subagent?.thread_spawn : void 0;
	const isSubagent = threadSpawn != null || payload.thread_source === "subagent" && typeof payload.parent_thread_id === "string";
	return {
		session_id: payload.id,
		model_provider: payload.model_provider ?? void 0,
		base_instructions: payload.base_instructions?.text,
		cli_version: payload.cli_version,
		cwd: payload.cwd,
		is_subagent: isSubagent,
		parent_thread_id: threadSpawn?.parent_thread_id ?? payload.parent_thread_id ?? void 0,
		agent_role: threadSpawn?.agent_role ?? payload.agent_role ?? void 0,
		agent_nickname: threadSpawn?.agent_nickname ?? payload.agent_nickname ?? void 0
	};
}
function recordResponseItem(walk, payload, timestamp) {
	walk.task ??= createTask();
	const task = walk.task;
	const message = {
		timestamp: Date.parse(timestamp),
		message: payload,
		tokenCount: void 0,
		subagentThreads: []
	};
	task.messages.push(message);
	if (payload.type === "function_call" && payload.name === "spawn_agent") walk.spawnAgentMessages.set(payload.call_id, message);
	else if (payload.type === "function_call_output" && walk.spawnAgentMessages.has(payload.call_id)) {
		const childId = extractSpawnedAgentId(payload.output);
		if (childId != null) recordSubagentThread(walk, task, childId, payload.call_id);
	}
	if (task.context != null && task.userMessageIndex == null && payload.type === "message" && payload.role === "user") task.userMessageIndex = task.messages.length - 1;
}
function toolCallEntry(task, callId) {
	task.toolCalls[callId] ??= {
		error: void 0,
		timings: [],
		outputs: {}
	};
	return task.toolCalls[callId];
}
function recordToolCallEnd(toolCall, payload, outputs) {
	if (FAILED_TOOL_STATUSES.includes(payload.status)) {
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
		toolCall.error = error != null ? isPrimitive(error) ? String(error) : JSON.stringify(error) : void 0;
	}
	Object.assign(toolCall.outputs, outputs);
}
function recordToolCallEvent(task, payload, eventTime) {
	const toolCall = toolCallEntry(task, payload.call_id);
	toolCall.timings.push(eventTime);
	if (payload.type.endsWith("_end")) {
		const outputs = { ...payload };
		delete outputs.call_id;
		delete outputs.turn_id;
		delete outputs.type;
		recordToolCallEnd(toolCall, payload, outputs);
	}
}
function recordToolItem(task, item, eventTime) {
	const toolCall = toolCallEntry(task, item.id);
	toolCall.timings.push(eventTime);
	const outputs = { ...item };
	delete outputs.id;
	delete outputs.type;
	recordToolCallEnd(toolCall, item, outputs);
	if (FAILED_TOOL_STATUSES.includes(item.status)) toolCall.error = toolItemErrorText(item) ?? toolCall.error ?? `Tool ${item.status}`;
}
function toolItemErrorText(item) {
	if (isRecord(item.error) && typeof item.error.message === "string") return item.error.message;
	if (!isRecord(item.result) || !Array.isArray(item.result.content)) return void 0;
	return item.result.content.filter((part) => isRecord(part) && typeof part.text === "string").map((part) => part.text).join("\n") || void 0;
}
function recordTurnError(task, payload) {
	if (payload.type === "stream_error") task.error = formatError(payload);
	if (payload.type === "task_complete" || payload.type === "turn_complete") task.error = formatError(payload.error);
	if (payload.type === "turn_aborted") {
		const explicitError = formatError(payload.error);
		if (explicitError != null) task.error = explicitError;
		else if (task.error == null && payload.reason !== "review_ended") {
			const interrupted = payload.reason === "interrupted";
			task.isErrorInterrupt = interrupted;
			task.error = interrupted ? "Turn interrupted" : `Turn aborted: ${payload.reason}`;
		}
	}
}
function recordEventMessage(walk, payload, eventTime) {
	if (payload.type === "task_started") {
		walk.task = createTask();
		walk.turnNumber += 1;
		walk.task.turnId = {
			id: payload.turn_id,
			timestamp: eventTime
		};
		walk.task.turnNumber = walk.turnNumber;
	}
	if (typeof payload.call_id === "string") {
		walk.task ??= createTask();
		recordToolCallEvent(walk.task, payload, eventTime);
	}
	if (payload.type === "item_completed" && isRecord(payload.item) && TOOL_ITEM_TYPES.includes(payload.item.type)) {
		walk.task ??= createTask();
		recordToolItem(walk.task, payload.item, eventTime);
	}
	if (payload.type === "token_count") {
		walk.task ??= createTask();
		const task = walk.task;
		const last = task?.messages.at(-1);
		if (last != null) last.tokenCount = payload.info?.last_token_usage;
		task.tokenCount = payload.info ?? void 0;
	}
	for (const activity of extractSubagentActivities(payload)) {
		walk.task ??= createTask();
		recordSubagentThread(walk, walk.task, activity.threadId, activity.callId);
	}
	if (payload.type === "collab_agent_spawn_end" && payload.new_thread_id != null) {
		walk.task ??= createTask();
		recordSubagentThread(walk, walk.task, payload.new_thread_id, payload.call_id);
	}
	if (payload.type === "stream_error" || payload.type === "task_complete" || payload.type === "turn_complete" || payload.type === "turn_aborted") {
		walk.task ??= createTask();
		recordTurnError(walk.task, payload);
	}
}
function endsTurn(walk, payload, position, input) {
	return payload.type === "task_complete" || payload.type === "turn_complete" || payload.type === "turn_aborted" || walk.task != null && position.index === position.length - 1 && input.turn_id != null;
}
async function walkCompletedTurns(input, onTurn) {
	const walk = {
		sessionMeta: void 0,
		task: void 0,
		turnNumber: 0,
		spawnAgentMessages: /* @__PURE__ */ new Map()
	};
	const events = await loadSession(input.transcript_path);
	const last = events.at(-1);
	if (input.includeOpenTurn && last !== void 0 && last.type !== "event_msg") {
		const end = {
			timestamp: last.timestamp,
			type: "event_msg",
			payload: { type: OPEN_TURN_END }
		};
		events.push(end);
	}
	for (const [index, { type, payload, timestamp }, arr] of enumerate(events)) {
		if (type === "session_meta") walk.sessionMeta = readSessionMeta(payload);
		if (type === "response_item") recordResponseItem(walk, payload, timestamp);
		if (type === "turn_context") {
			walk.task ??= createTask();
			walk.task.context = payload;
		}
		if (type === "event_msg") {
			const eventTime = Date.parse(timestamp);
			recordEventMessage(walk, payload, eventTime);
			if (endsTurn(walk, payload, {
				index,
				length: arr.length
			}, input)) {
				walk.task ??= createTask();
				const task = walk.task;
				const privacyTurnId = task.turnId?.id;
				const completedTurnId = task.turnId?.id ?? input.turn_id ?? void 0;
				if (task.turnId == null && completedTurnId != null) task.turnId = {
					id: completedTurnId,
					timestamp: eventTime
				};
				if (task.turnNumber == null) {
					walk.turnNumber += 1;
					task.turnNumber = walk.turnNumber;
				}
				await onTurn({
					task,
					sessionMeta: walk.sessionMeta,
					privacyTurnId,
					completedTurnId
				});
				walk.task = void 0;
			}
		}
	}
}
async function convertToRunTree(input, options) {
	const seenTurnIds = /* @__PURE__ */ new Set();
	const skipBacklog = options.replayHistory !== true;
	await walkCompletedTurns(input, async ({ task, sessionMeta, privacyTurnId, completedTurnId }) => {
		const alreadySeen = completedTurnId != null && seenTurnIds.has(completedTurnId);
		const isBacklog = skipBacklog && input.turn_id != null && completedTurnId !== input.turn_id;
		if (!alreadySeen && !isBacklog) await postTurn(task, sessionMeta, privacyTurnId, {
			rolloutFile: input.transcript_path,
			includeOpenTurn: input.includeOpenTurn,
			options
		});
		if (completedTurnId != null) seenTurnIds.add(completedTurnId);
	});
}
async function listCompletedTurnIds(input) {
	const turnIds = [];
	await walkCompletedTurns(input, async ({ completedTurnId }) => {
		if (completedTurnId != null && !turnIds.includes(completedTurnId)) turnIds.push(completedTurnId);
	});
	return turnIds;
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/validate.js
function validate(uuid) {
	return typeof uuid === "string" && regex_default.test(uuid);
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/parse.js
function parse(uuid) {
	if (!validate(uuid)) throw TypeError("Invalid UUID");
	let v;
	return Uint8Array.of((v = parseInt(uuid.slice(0, 8), 16)) >>> 24, v >>> 16 & 255, v >>> 8 & 255, v & 255, (v = parseInt(uuid.slice(9, 13), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(14, 18), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(19, 23), 16)) >>> 8, v & 255, (v = parseInt(uuid.slice(24, 36), 16)) / 1099511627776 & 255, v / 4294967296 & 255, v >>> 24 & 255, v >>> 16 & 255, v >>> 8 & 255, v & 255);
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/stringify.js
const byteToHex = [];
for (let i = 0; i < 256; ++i) byteToHex.push((i + 256).toString(16).slice(1));
function unsafeStringify(arr, offset = 0) {
	return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/v35.js
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
	const namespaceBytes = typeof namespace === "string" ? parse(namespace) : namespace;
	if (typeof namespace === "string") namespace = parse(namespace);
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
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/sha1.js
function sha1(bytes) {
	if (Array.isArray(bytes)) bytes = Buffer.from(bytes);
	else if (typeof bytes === "string") bytes = Buffer.from(bytes, "utf8");
	return createHash("sha1").update(bytes).digest();
}
//#endregion
//#region ../../node_modules/.pnpm/uuid@14.0.2/node_modules/uuid/dist-node/v5.js
function v5(value, namespace, buf, offset) {
	return v35(80, sha1, value, namespace, buf, offset);
}
v5.DNS = DNS;
v5.URL = URL$1;
//#endregion
//#region src/utils/plainObject.ts
function toPlainObject(value) {
	return JSON.parse(JSON.stringify(value));
}
//#endregion
//#region src/tracing-engine-payload.ts
function postSubmission(run, privacyMode, metadataOptions, status = runStatus(run)) {
	const payload = toPlainObject(run.toJSON());
	const provenance = prepareCodingAgentMetadataProvenance(toPlainObject(metadataOptions), LS_INTEGRATION, privacyMode, status);
	if (provenance.status !== "ready") throw new Error("Codex trace metadata has no trusted thread ID");
	return {
		operation: "post",
		integration: LS_INTEGRATION,
		privacyMode,
		metadata: provenance.value,
		privacyContext: { status },
		run: normalizedSnapshot(payload)
	};
}
function openRootSubmission(run, privacyMode, metadataOptions) {
	const submission = postSubmission(run, privacyMode, metadataOptions, RUN_RUNNING);
	for (const field of RUN_PATCH_FIELDS) delete submission.run[field];
	return submission;
}
function closingRootSubmission(submission) {
	const { id, name, run_type, ...run } = submission.run;
	const context = Object.fromEntries(RUN_CONTEXT_FIELDS.flatMap((field) => run[field] === void 0 ? [] : [[field, run[field]]]));
	const fields = RUN_PATCH_FIELDS.filter((field) => run[field] !== void 0);
	return {
		operation: PATCH_OPERATION,
		integration: submission.integration,
		privacyMode: submission.privacyMode,
		metadata: submission.metadata,
		privacyContext: { status: run.error === void 0 ? RUN_COMPLETED : RUN_ERROR },
		run: {
			id,
			name,
			run_type,
			...context
		},
		patch: {
			fields,
			values: Object.fromEntries(fields.map((field) => [field, run[field]]))
		}
	};
}
function toolRunIdGenerator(sessionId, turnId) {
	return (callId) => v5(`${TRACE_RUN_ID_PREFIX}${sessionId}:${turnId}${TOOL_RUN_ID_SEGMENT}${callId}`, TRACE_RUN_ID_NAMESPACE);
}
function runIdGenerator(sessionId, turnId) {
	let index = 0;
	return () => v5(`${TRACE_RUN_ID_PREFIX}${sessionId}:${turnId}:${index++}`, TRACE_RUN_ID_NAMESPACE);
}
function createRunClient(config) {
	return new Client({
		apiKey: config.api_key,
		apiUrl: config.api_url
	});
}
function normalizedSnapshot(payload) {
	if (typeof payload.id !== "string" || typeof payload.name !== "string" || typeof payload.run_type !== "string" || !isRecord(payload.inputs)) throw new Error("Codex run identity or inputs are unavailable");
	const result = {
		id: payload.id,
		name: payload.name,
		run_type: payload.run_type,
		inputs: payload.inputs
	};
	for (const key of NORMALIZED_SNAPSHOT_OPTIONAL_FIELDS) {
		const value = payload[key];
		if (value !== void 0) Object.assign(result, { [key]: value });
	}
	if (isRecord(payload.outputs)) result.outputs = payload.outputs;
	return result;
}
function runStatus(run) {
	const status = run.extra?.metadata?.status;
	if (run.error != null || status === "error") return "error";
	return run.end_time != null || status === "completed" ? "completed" : "running";
}
//#endregion
//#region src/warnings.ts
function warningPath(home) {
	return nodePath.join(home, CODEX_CONFIG_DIRECTORY, WARNING_FILE_NAME);
}
async function recordWarning(home, message) {
	await writeFile(warningPath(home), message, { mode: 384 });
}
async function showPendingWarning(home) {
	try {
		const stale = Date.now() - (await stat(warningPath(home))).mtimeMs > STATE_FILE_MAX_AGE_MS;
		const message = await readFile(warningPath(home), "utf8");
		await rm(warningPath(home), { force: true });
		if (message && !stale) console.error(message);
	} catch {
		return;
	}
}
//#endregion
//#region src/tracing-engine.ts
function engineStorageRoot(home) {
	return nodePath.join(home, CODEX_CONFIG_DIRECTORY, ENGINE_STORAGE_DIRECTORY);
}
function createCodexTracingSession(config, sessionId, cwd, home = homeDirectory()) {
	const storageRoot = engineStorageRoot(home);
	const writer = writerOptions(config, storageRoot);
	if (!writer) return void 0;
	const plugin = openPluginSession({
		storageRoot,
		integration: LS_INTEGRATION,
		sessionId,
		writer,
		currentWriter: async () => writerOptions(await getConfig({
			home,
			cwd,
			env: process.env
		}), storageRoot),
		reconstruct: (job) => reconstructTranscript(job, config, home, plugin),
		scheduleWake: (wakeSessionId) => launchDetachedWorker([
			ENGINE_WORKER_FLAG,
			wakeSessionId,
			cwd
		], { storageRoot }),
		onRecoveryReport: reportRecovery
	});
	return plugin;
}
let attributor;
async function buildLiveToolRuns(config, request, mode, home = homeDirectory()) {
	const runs = [];
	const toolRunId = toolRunIdGenerator(request.session_id, request.turn_id)(request.tool_use_id);
	await convertToRunTree({
		transcript_path: request.transcript_path,
		turn_id: request.turn_id,
		includeOpenTurn: true
	}, conversionOptions(config, request.session_id, request.turn_id, mode, runs, home));
	const [root] = runs;
	const tool = runs.find(({ run }) => run.id === toolRunId);
	if (root === void 0 || tool === void 0 || root.metadata.agentType === "subagent") return;
	return {
		root,
		tool
	};
}
async function saveLiveToolRuns(plugin, turnId, { root, tool }) {
	const rootEventId = `${LIVE_RUN_EVENT_PREFIX}${root.run.id}`;
	if (!await savedLiveRun(plugin, turnId, root.run.id)) await saveLiveRun(plugin, {
		turnId,
		eventId: rootEventId,
		submission: openRootSubmission(root.run, root.mode, root.metadata),
		turnEvidence: {
			rootRunId: root.run.id,
			childRunIds: [],
			closureState: OPEN_CLOSURE
		}
	});
	await saveLiveRun(plugin, {
		turnId,
		eventId: `${LIVE_RUN_EVENT_PREFIX}${tool.run.id}`,
		submission: postSubmission(tool.run, tool.mode, tool.metadata),
		turnEvidence: {
			childRunIds: [tool.run.id],
			closureState: OPEN_CLOSURE
		},
		dependencies: [{
			integration: LS_INTEGRATION,
			sessionId: plugin.sessionId,
			turnId,
			eventId: rootEventId
		}]
	});
}
async function saveLiveRun(plugin, input) {
	const result = await plugin.session.capture(input);
	if (!CAPTURE_SAVED_STATUSES.includes(result.status)) console.error(`${LIVE_RUN_NOT_SAVED_MESSAGE} ${result.status}`);
}
async function hasUnclosedLiveRoot(plugin, turnId) {
	const rootRunId = runIdGenerator(plugin.sessionId, turnId)();
	return await savedLiveRun(plugin, turnId, rootRunId) !== void 0 && await savedLiveRun(plugin, turnId, rootRunId, "codex-run-patch:") === void 0;
}
function savedLiveRun(plugin, turnId, runId, prefix = LIVE_RUN_EVENT_PREFIX) {
	const { sessionId } = plugin;
	return plugin.store.read({
		integration: LS_INTEGRATION,
		sessionId,
		turnId,
		eventId: `${prefix}${runId}`
	});
}
function conversionOptions(config, sessionId, turnId, privacyMode, runs, home) {
	const client = createRunClient(config);
	attributor ??= createRepositoryAttributor({ githubLoginMarkerPath: nodePath.join(home, CODEX_CONFIG_DIRECTORY, GITHUB_LOGIN_MARKER_FILE_NAME) });
	return {
		client,
		projectName: config.project,
		metadata: config.metadata,
		replicas: toSdkReplicas(config.replicas),
		parentRunTree: parentRunTreeFor(config, client),
		captureRun: async (run, mode, metadata) => {
			runs.push({
				metadata,
				run,
				mode
			});
		},
		nextRunId: runIdGenerator(sessionId, turnId),
		toolRunId: toolRunIdGenerator(sessionId, turnId),
		privacyMode,
		attributor
	};
}
function reportRecovery(result) {
	if (result.status === "completed") return;
	console.error(`Shared Codex trace recovery did not finish: ${JSON.stringify(result)}`);
}
async function runCodexEngineWorker(sessionId, cwd) {
	const home = homeDirectory();
	const config = await getConfig({
		home,
		cwd,
		env: process.env
	});
	const session = createCodexTracingSession(config, sessionId, cwd, home);
	if (!session) throw new Error("Shared Codex trace worker configuration is unavailable");
	const result = await session.session.drain();
	if (result === "retry-exhausted" || result === "dropped" || result === "scope-mismatch") {
		const warning = uploadCredential(config).kind === "login" ? DROPPED_LOGIN_WORK_WARNING : DROPPED_WORK_WARNING;
		if (result !== "scope-mismatch") await recordWarning(home, warning);
		throw new Error(`Shared Codex trace worker stopped with ${result}`);
	}
	if (result === "deferred" || result === "busy") console.error(`Shared Codex trace worker left saved work for a later run: ${result}`);
}
async function reconstructTranscript(job, workerConfig, home, plugin) {
	const [transcriptRef, contextRef, ...extra] = job.sourceRefs;
	if (transcriptRef === void 0 || contextRef === void 0 || extra.length > 0) throw new Error("Codex reconstruction needs a transcript and a context locator");
	const transcriptPath = transcriptPathFromRef(transcriptRef);
	const context = readJobContext(home, job.sessionId, contextRef);
	if (!context) console.error("Codex reconstruction context is missing; using the current settings");
	const config = context ? {
		...await getConfig({
			home,
			cwd: context.cwd,
			env: process.env
		}),
		project: context.project,
		metadata: context.metadata,
		parent_headers: context.parent_headers
	} : workerConfig;
	const runs = [];
	await convertToRunTree({
		transcript_path: transcriptPath,
		turn_id: job.turnId
	}, conversionOptions(config, job.sessionId, job.turnId, job.privacyMode, runs, home));
	const [root, ...children] = runs;
	if (root === void 0) throw new Error("Codex transcript has no completed target turn");
	const turnEvidence = {
		rootRunId: root.run.id,
		childRunIds: children.map(({ run: child }) => child.id),
		closureState: "authoritative"
	};
	const outputs = [];
	for (const { metadata, mode, run } of runs) {
		const submission = postSubmission(run, mode, metadata);
		const saved = await savedLiveRun(plugin, job.turnId, run.id);
		if (saved === void 0) outputs.push({
			eventId: `${TRACE_RUN_EVENT_PREFIX}${run.id}`,
			sourceRef: transcriptRef,
			turnEvidence,
			submission
		});
		else if (run === root.run) {
			const { integration, sessionId, turnId, eventId } = saved;
			outputs.push({
				eventId: `${TRACE_RUN_PATCH_EVENT_PREFIX}${run.id}`,
				sourceRef: transcriptRef,
				turnEvidence: {
					...turnEvidence,
					childRunIds: []
				},
				submission: closingRootSubmission(submission),
				dependencies: [{
					integration,
					sessionId,
					turnId,
					eventId
				}]
			});
		}
	}
	await removeJobContext(home, job.sessionId, contextRef);
	return {
		status: "ready",
		outputs
	};
}
function parentRunTreeFor(config, client) {
	return config.parent_headers ? RunTree.fromHeaders(config.parent_headers, {
		client,
		project_name: config.project
	}) : void 0;
}
function uploadCredential(config) {
	return resolveUploadCredential({
		apiKey: config.api_key,
		apiUrl: config.api_url
	});
}
function writerOptions(config, storageRoot) {
	if (config.managedConfigProblem !== void 0) return void 0;
	if (config.api_key !== void 0 && sdkSetting(config.api_key) === void 0) return void 0;
	const credential = uploadCredential(config);
	const keyedReplica = config.replicas?.some((replica) => sdkSetting(replica.api_key));
	if (credential.kind === "none" && !keyedReplica) return void 0;
	if ((credential.kind === "login" ? loginReplicaRefusal(toSdkReplicas(config.replicas), credential.apiUrl) : void 0) !== void 0) return void 0;
	const { kind, ...auth } = credential.kind === "none" ? {
		kind: credential.kind,
		apiKey: "",
		apiUrl: config.api_url ?? "https://api.smith.langchain.com"
	} : credential.kind === "api-key" ? {
		...credential,
		apiKey: config.api_key ?? credential.apiKey
	} : credential;
	const headerProject = config.locked.includes("project") ? void 0 : parentRunTreeFor(config)?.project_name;
	return {
		destinations: [{
			...auth,
			projectName: headerProject ?? config.project ?? "codex"
		}],
		...config.replicas?.length ? { replicas: toSdkReplicas(config.replicas) } : {},
		redact: config.redact,
		projectLocked: config.locked.includes("project"),
		storageRoot,
		...config.redact_extra_rules === void 0 ? {} : { redactExtraRules: config.redact_extra_rules }
	};
}
//#endregion
//#region src/sidecar.ts
function withSidecarLock(rolloutFile, action) {
	return withFileLock(`${rolloutFile}${SIDECAR_SUFFIX}`, action);
}
function withSidecarLockOrWithout(rolloutFile, action) {
	return withSidecarLock(rolloutFile, action).catch((error) => {
		if (!(error instanceof FileLockTimeoutError)) throw error;
		return action();
	});
}
async function loadUploadedTurnIds(rolloutFile) {
	try {
		const data = await nodeFsPromises.readFile(`${rolloutFile}${SIDECAR_SUFFIX}`, "utf-8");
		return new Set(data.split("\n").filter(Boolean));
	} catch (error) {
		if (error.code === "ENOENT") return /* @__PURE__ */ new Set();
		throw error;
	}
}
async function markTurnUploaded(rolloutFile, turnId) {
	try {
		await nodeFsPromises.appendFile(`${rolloutFile}${SIDECAR_SUFFIX}`, `${turnId}\n`, "utf-8");
		return true;
	} catch {
		return false;
	}
}
//#endregion
//#region src/turn-queue.ts
function queueCodexTurns(session, config, request) {
	return withSidecarLockOrWithout(request.transcriptPath, () => queueUnhandledTurns(session, config, request));
}
async function queueUnhandledTurns(session, config, request) {
	const handled = await loadUploadedTurnIds(request.transcriptPath);
	const firstStop = handled.size === 0;
	const completed = await listCompletedTurnIds({
		transcript_path: request.transcriptPath,
		turn_id: request.turnId
	});
	for (const turnId of completed) {
		if (handled.has(turnId) && !await hasUnclosedLiveRoot(session, turnId)) continue;
		const mode = lockedTurnMode(config, session.sessionId, turnId);
		if (mode === "off" || firstStop && turnId !== request.turnId) {
			await markTurnUploaded(request.transcriptPath, turnId);
			continue;
		}
		await queueCodexTurn(session, config, {
			...request,
			turnId
		}, mode);
	}
}
async function queueCodexTurn(session, config, request, mode) {
	const { transcriptPath, turnId } = request;
	const sourceRef = transcriptSourceRef(transcriptPath);
	const contextRef = contextSourceRef(session.sessionId, turnId, sourceRef, mode);
	await saveJobContext(homeDirectory(), session.sessionId, contextRef, {
		cwd: request.cwd,
		project: config.project,
		metadata: config.metadata,
		parent_headers: config.parent_headers
	});
	const input = {
		turnId,
		eventId: reconstructionEventId(session.sessionId, turnId, sourceRef, mode),
		sourceRefs: [sourceRef, contextRef],
		privacyMode: mode,
		turnEvidence: {
			childRunIds: [],
			closureState: "authoritative"
		}
	};
	try {
		const result = await session.session.queueReconstruction(input);
		if (result.status !== "published" && result.status !== "duplicate") throw new Error(`Shared Codex reconstruction queue failed: ${result.status}`);
	} catch (error) {
		if (!await session.session.readSavedReconstructionWake(error, input)) throw error;
		console.error(`Shared Codex reconstruction was saved but its worker wake failed: ${error}`);
	}
	await markTurnUploaded(transcriptPath, turnId);
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/constants.js
const DEFAULT_PUBLISHED_TARGETS = { darwin: ["arm64", "x64"] };
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/target.js
function resolveTarget(options) {
	for (const field of [
		"executableName",
		"repository",
		"userAgent"
	]) if (typeof options[field] !== "string" || options[field].trim() === "") throw new Error(`the binary target needs a ${field}`);
	return {
		executableName: options.executableName,
		repository: options.repository,
		userAgent: options.userAgent,
		releasesApiOverrideEnvVar: options.releasesApiOverrideEnvVar,
		publishedTargets: options.publishedTargets ?? DEFAULT_PUBLISHED_TARGETS
	};
}
function isPublishedTarget(target, platform, arch) {
	return target.publishedTargets[platform]?.includes(arch) ?? false;
}
function releaseAssetName(target, platform, arch, version) {
	return `${target.executableName}-${platform}-${arch}-${version}`;
}
//#endregion
//#region ../../node_modules/.pnpm/@langchain+plugins-base@https+++codeload.github.com+langchain-ai+langsmith-plugin-binar_c48048c4ea1439a45abf90927f8f4fa2/node_modules/@langchain/plugins-base/dist/binary.js
function defineBinaryTarget(options) {
	const target = resolveTarget(options);
	return {
		target,
		supportsHost: (platform$1 = platform(), arch$1 = arch()) => isPublishedTarget(target, platform$1, arch$1),
		assetName: (platform, arch, version) => releaseAssetName(target, platform, arch, version)
	};
}
//#endregion
//#region src/binary.ts
const binary = defineBinaryTarget({
	executableName: "langsmith-codex-tracing",
	repository: "langchain-ai/langsmith-codex-plugins",
	userAgent: "langsmith-codex",
	releasesApiOverrideEnvVar: "LANGSMITH_CODEX_RELEASE_API"
});
//#endregion
//#region src/messages.ts
function tracingFailed(error) {
	return `LangSmith tracing failed for this turn: ${error}`;
}
function usage(executableName) {
	return `Usage:
  ${executableName} --version

Options:
  --help, -h     Show this help and exit
  --version, -v  Print the version this build carries and exit`;
}
//#endregion
//#region src/post-tool-use.ts
async function handlePostToolUse(input) {
	const { session_id, turn_id, transcript_path, tool_use_id } = input;
	if (!session_id || !turn_id || !transcript_path || !tool_use_id) return;
	const config = await getConfig({
		home: homeDirectory(),
		cwd: input.cwd,
		env: process.env
	});
	if (!config.enabled) return;
	const mode = lockedTurnMode(config, session_id, turn_id);
	if (mode === "off") return;
	const plugin = createCodexTracingSession(config, session_id, input.cwd);
	if (!plugin) return;
	const runs = await waitForToolRuns(config, {
		session_id,
		turn_id,
		transcript_path,
		tool_use_id
	}, mode);
	if (!runs) return;
	await withSidecarLock(transcript_path, async () => {
		if ((await loadUploadedTurnIds(transcript_path)).has(turn_id)) return;
		await saveLiveToolRuns(plugin, turn_id, runs);
	});
}
async function waitForToolRuns(config, request, mode) {
	const deadline = Date.now() + TOOL_OUTPUT_WAIT_MS;
	for (;;) {
		const runs = await buildLiveToolRuns(config, request, mode).catch((error) => {
			if (error instanceof SyntaxError) return void 0;
			throw error;
		});
		if (runs !== void 0 && (!TOOLS_WITH_END_EVENTS.has(runs.tool.run.name) || await hasToolEndEvent(request.transcript_path, request.tool_use_id).catch(() => false))) return runs;
		if (Date.now() >= deadline) return void 0;
		await setTimeout$1(100);
	}
}
async function hasToolEndEvent(transcriptPath, callId) {
	return (await loadSession(transcriptPath)).some(({ type, payload }) => type === "event_msg" && (payload.call_id === callId && payload.type.endsWith("_end") || payload.type === "item_completed" && isRecord(payload.item) && payload.item.id === callId));
}
//#endregion
//#region src/login-notice.ts
function loginNotices(home, config, credential) {
	if (!config.enabled) return [];
	if (credential.kind === "none") return config.replicas?.some((replica) => sdkSetting(replica.api_key)) ? [] : [{
		kind: NOTICE_KIND_CREDENTIAL,
		text: credential.reason
	}];
	const saved = readLoginNotice(engineStorageRoot(home), process.env, credential.kind === "api-key" ? {
		apiKey: config.api_key ?? credential.apiKey,
		apiUrl: credential.apiUrl
	} : void 0);
	const notices = saved === void 0 ? [] : [{
		kind: LOGIN_NOTICE_KIND,
		text: saved
	}];
	if (credential.kind === "api-key") return notices;
	const skipped = refusedLoginReplicas(toSdkReplicas(config.replicas), credential.apiUrl);
	return [...notices, ...skipped === void 0 ? [] : [{
		kind: NOTICE_KIND_REPLICA,
		text: skipped
	}]];
}
//#endregion
//#region src/utils/launcher.ts
function launchedByExec(readProcess = processInfo, startId = process.ppid) {
	let id = startId;
	for (let depth = 0; depth < 8 && id > 1; depth++) {
		const info = readProcess(id);
		if (info === void 0) return true;
		const codex = info.args.findIndex((arg) => LAUNCHER_CODEX_PATTERN.test(arg));
		if (codex !== -1) return info.args.slice(codex + 1).some((arg) => LAUNCHER_EXEC_SUBCOMMANDS.includes(arg));
		id = info.parentId;
	}
	return false;
}
function processInfo(id) {
	try {
		const line = execFileSync(LAUNCHER_LOOKUP_COMMAND, [...LAUNCHER_LOOKUP_ARGUMENTS, String(id)], {
			encoding: "utf8",
			stdio: [
				"ignore",
				"pipe",
				"ignore"
			]
		});
		const match = LAUNCHER_LINE_PATTERN.exec(line.trim());
		return match ? {
			parentId: Number(match[1]),
			args: match[2].split(LAUNCHER_ARGUMENT_SEPARATOR)
		} : void 0;
	} catch {
		return;
	}
}
//#endregion
//#region src/notices.ts
async function showNotices(home, config, notices) {
	const shown = [];
	for (const { kind, text } of notices) if (await shouldShowNotice({
		plugin: "openai-codex",
		kind,
		cooldown: config.notice_cooldown,
		storageRoot: engineStorageRoot(home)
	})) shown.push(text);
	return shown;
}
//#endregion
//#region src/user-prompt-submit.ts
async function handlePromptSubmit(input) {
	const command = parseTracingCommand(input.prompt);
	try {
		const config = await getConfig({
			home: homeDirectory(),
			cwd: input.cwd,
			env: process.env
		});
		const mutedLocked = muteLocked(config);
		const result = await submitPreference(defaultPrivacyPath(), {
			sessionId: input.session_id,
			turnId: input.turn_id,
			enabled: config.enabled,
			command,
			defaultMuted: config.defaultMuted,
			mutedLocked
		});
		if (!command) {
			if (result.warning) console.error(`${PREFERENCE_WARNING_PREFIX} ${result.warning}`);
			const login = loginNotices(homeDirectory(), config, uploadCredential(config));
			const expired = login.find(({ kind }) => STRICT_NOTICE_KINDS.includes(kind));
			if (expired && config.strict_auth && lockedTurnMode(config, input.session_id, input.turn_id) === "full" && await startedByPerson(input.transcript_path) && !launchedByExec()) return {
				decision: "block",
				reason: expired.text
			};
			const managed = config.managedConfigWarnings ?? [];
			const notices = await showNotices(homeDirectory(), config, [...managed.length === 0 ? [] : [{
				kind: NOTICE_KIND_MANAGED,
				text: managed.join("\n")
			}], ...login]);
			return notices.length === 0 ? void 0 : { systemMessage: notices.join("\n") };
		}
		if (mutedLocked && command === "unmute") return {
			decision: "block",
			reason: LOCKED_MUTE_REPLY
		};
		let reason = `Thread tracing ${command === "mute" ? "muted (metadata-only)" : "unmuted (full content)"}. Preference saved for the next turn; the current turn is unchanged.`;
		if (config.managedConfigProblem !== void 0) reason += ` ${config.managedConfigProblem}`;
		else if (!config.enabled) reason += " Master tracing is disabled; this preference does not enable it.";
		if (result.warning) reason += ` Warning: ${result.warning}.`;
		return {
			decision: "block",
			reason
		};
	} catch (error) {
		const failure = `Could not save tracing preference/turn evidence: ${error instanceof Error ? error.message : String(error)}`;
		if (!command) {
			console.error(failure);
			return;
		}
		return {
			decision: "block",
			reason: `${failure}. Repair the privacy file or permissions and retry. Command blocked; no model turn was started.`
		};
	}
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
	if (content.hook_event_name === "PostToolUse") {
		await handlePostToolUse(content);
		return;
	}
	await showPendingWarning(homeDirectory());
	if (content.hook_event_name === "UserPromptSubmit") {
		const result = await handlePromptSubmit(content);
		if (result) console.log(JSON.stringify(result));
		return;
	}
	if (content.hook_event_name !== "Stop") return;
	const config = await getConfig({
		home: homeDirectory(),
		cwd: content.cwd,
		env: process.env
	});
	if (!config.enabled) return;
	if (!content.session_id || !content.turn_id || !content.transcript_path) return;
	await access(content.transcript_path, constants.R_OK);
	const session = createCodexTracingSession(config, content.session_id, content.cwd);
	if (!session) return;
	await queueCodexTurns(session, config, {
		transcriptPath: content.transcript_path,
		turnId: content.turn_id,
		cwd: content.cwd
	});
}
const USAGE = usage(binary.target.executableName);
const args = process.argv.slice(2);
if (args.length === 0) runHook().catch((error) => {
	console.error(tracingFailed(error));
});
else await dispatchHookCommand(args, {
	usage: USAGE,
	version: "0.3.0",
	hooks: {},
	worker: {
		command: ENGINE_WORKER_FLAG,
		run: ([sessionId, cwd]) => {
			if (!sessionId || !cwd) throw new Error("shared trace worker needs a session ID and working directory");
			return runCodexEngineWorker(sessionId, cwd);
		}
	},
	onHookError: (_name, error) => {
		console.error(tracingFailed(error));
		process.exitCode = 1;
	},
	onUnknown: (argument) => {
		console.error(`unknown option: ${argument}`);
		console.error(USAGE);
		process.exitCode = 1;
	}
});
//#endregion
export {};
