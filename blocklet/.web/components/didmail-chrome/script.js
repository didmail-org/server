// DIDMail native Web Device browser component.
// Canonical application source: edit the named module sections below.
// No transpilation, preparation script or post-build HTML rewriting is required.
(function () {
var nativeQueryCore = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/index.js
  var modern_exports = {};
  __export(modern_exports, {
    CancelledError: () => CancelledError,
    InfiniteQueryObserver: () => InfiniteQueryObserver,
    Mutation: () => Mutation,
    MutationCache: () => MutationCache,
    MutationObserver: () => MutationObserver,
    QueriesObserver: () => QueriesObserver,
    Query: () => Query,
    QueryCache: () => QueryCache,
    QueryClient: () => QueryClient,
    QueryObserver: () => QueryObserver,
    dataTagErrorSymbol: () => dataTagErrorSymbol,
    dataTagSymbol: () => dataTagSymbol,
    defaultScheduler: () => defaultScheduler,
    defaultShouldDehydrateMutation: () => defaultShouldDehydrateMutation,
    defaultShouldDehydrateQuery: () => defaultShouldDehydrateQuery,
    dehydrate: () => dehydrate,
    dehydrateQuery: () => dehydrateQuery,
    environmentManager: () => environmentManager,
    experimental_streamedQuery: () => streamedQuery,
    focusManager: () => focusManager,
    hashKey: () => hashKey,
    hydrate: () => hydrate,
    isCancelledError: () => isCancelledError,
    isServer: () => isServer,
    keepPreviousData: () => keepPreviousData,
    matchMutation: () => matchMutation,
    matchQuery: () => matchQuery,
    noop: () => noop,
    notifyManager: () => notifyManager,
    onlineManager: () => onlineManager,
    partialMatchKey: () => partialMatchKey,
    replaceEqualDeep: () => replaceEqualDeep,
    shouldThrowError: () => shouldThrowError,
    skipToken: () => skipToken,
    timeoutManager: () => timeoutManager,
    unsetMarker: () => unsetMarker
  });

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/timeoutManager.js
  var defaultTimeoutProvider = {
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (timeoutId) => clearTimeout(timeoutId),
    setInterval: (callback, delay) => setInterval(callback, delay),
    clearInterval: (intervalId) => clearInterval(intervalId)
  };
  var TimeoutManager = class {
    #provider = defaultTimeoutProvider;
    #providerCalled = false;
    /**
    * `setTimeoutProvider` can be used to set a custom implementation of the
    * `setTimeout`, `clearTimeout`, `setInterval`, `clearInterval` functions,
    * called a `TimeoutProvider`.
    *
    * This may be useful if you notice event loop performance issues with
    * thousands of queries. A custom TimeoutProvider could also support timer
    * delays longer than the global `setTimeout` maximum delay value of about
    * 24 days.
    *
    * It is important to call `setTimeoutProvider` before creating a
    * QueryClient or queries, so that the same provider is used consistently
    * for all timers in the application, since different TimeoutProviders
    * cannot cancel each others' timers.
    * @param provider - The `TimeoutProvider` to use for all timers from now on.
    * @example
    * ```ts
    * import { timeoutManager, QueryClient } from '@tanstack/query-core'
    * import { CustomTimeoutProvider } from './CustomTimeoutProvider'
    *
    * timeoutManager.setTimeoutProvider(new CustomTimeoutProvider())
    *
    * export const queryClient = new QueryClient()
    * ```
    */
    setTimeoutProvider(provider) {
      if (false) {
        if (this.#providerCalled && provider !== this.#provider) console.error(`[timeoutManager]: Switching provider after calls to previous provider might result in unexpected behavior.`, {
          previous: this.#provider,
          provider
        });
      }
      this.#provider = provider;
      if (false) this.#providerCalled = false;
    }
    /**
    * `setTimeout` schedules a callback to run after approximately `delay`
    * milliseconds, like the global `setTimeout` function. The callback can be
    * canceled with `clearTimeout`.
    *
    * It returns a timer ID, which may be a number or an object that can be
    * coerced to a number via `Symbol.toPrimitive`.
    * @param callback - The function to call when the timeout elapses.
    * @param delay - The time to wait before calling `callback`, in milliseconds.
    * @returns The timer ID, to pass to {@link TimeoutManager#clearTimeout}.
    * @example
    * ```ts
    * import { timeoutManager } from '@tanstack/query-core'
    *
    * const timeoutId = timeoutManager.setTimeout(
    *   () => console.log('ran at:', new Date()),
    *   1000,
    * )
    *
    * const timeoutIdNumber: number = Number(timeoutId)
    * ```
    */
    setTimeout(callback, delay) {
      if (false) this.#providerCalled = true;
      return this.#provider.setTimeout(callback, delay);
    }
    /**
    * `clearTimeout` cancels a timeout callback scheduled with `setTimeout`,
    * like the global `clearTimeout` function. It should be called with a
    * timer ID returned by `setTimeout`.
    * @param timeoutId - The timer ID returned by `setTimeout`, or `undefined`.
    * @example
    * ```ts
    * import { timeoutManager } from '@tanstack/query-core'
    *
    * const timeoutId = timeoutManager.setTimeout(
    *   () => console.log('ran at:', new Date()),
    *   1000,
    * )
    *
    * timeoutManager.clearTimeout(timeoutId)
    * ```
    */
    clearTimeout(timeoutId) {
      this.#provider.clearTimeout(timeoutId);
    }
    /**
    * `setInterval` schedules a callback to be called approximately every
    * `delay` milliseconds, like the global `setInterval` function.
    *
    * Like `setTimeout`, it returns a timer ID, which may be a number or an
    * object that can be coerced to a number via `Symbol.toPrimitive`.
    * @param callback - The function to call on every interval.
    * @param delay - The time between calls, in milliseconds.
    * @returns The timer ID, to pass to {@link TimeoutManager#clearInterval}.
    * @example
    * ```ts
    * import { timeoutManager } from '@tanstack/query-core'
    *
    * const intervalId = timeoutManager.setInterval(
    *   () => console.log('ran at:', new Date()),
    *   1000,
    * )
    * ```
    */
    setInterval(callback, delay) {
      if (false) this.#providerCalled = true;
      return this.#provider.setInterval(callback, delay);
    }
    /**
    * `clearInterval` can be used to cancel an interval, like the global
    * `clearInterval` function. It should be called with an interval ID
    * returned by `setInterval`.
    * @param intervalId - The timer ID returned by `setInterval`, or `undefined`.
    * @example
    * ```ts
    * import { timeoutManager } from '@tanstack/query-core'
    *
    * const intervalId = timeoutManager.setInterval(
    *   () => console.log('ran at:', new Date()),
    *   1000,
    * )
    *
    * timeoutManager.clearInterval(intervalId)
    * ```
    */
    clearInterval(intervalId) {
      this.#provider.clearInterval(intervalId);
    }
  };
  var timeoutManager = new TimeoutManager();
  function systemSetTimeoutZero(callback) {
    setTimeout(callback, 0);
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/utils.js
  var isServer = typeof window === "undefined" || "Deno" in globalThis;
  function noop() {
  }
  function functionalUpdate(updater, input) {
    return typeof updater === "function" ? updater(input) : updater;
  }
  function isValidTimeout(value) {
    return typeof value === "number" && value >= 0 && value !== Infinity;
  }
  function timeUntilStale(updatedAt, staleTime) {
    return Math.max(updatedAt + (staleTime || 0) - Date.now(), 0);
  }
  function resolveQueryValue(value, query) {
    return typeof value === "function" ? value(query) : value;
  }
  function matchQuery(filters, query) {
    const { type = "all", exact, fetchStatus, predicate, queryKey, stale } = filters;
    if (queryKey) {
      if (exact) {
        if (query.queryHash !== hashQueryKeyByOptions(queryKey, query.options)) return false;
      } else if (!partialMatchKey(query.queryKey, queryKey)) return false;
    }
    if (type !== "all") {
      const isActive = query.isActive();
      if (type === "active" && !isActive) return false;
      if (type === "inactive" && isActive) return false;
    }
    if (typeof stale === "boolean" && query.isStale() !== stale) return false;
    if (fetchStatus && fetchStatus !== query.state.fetchStatus) return false;
    if (predicate && !predicate(query)) return false;
    return true;
  }
  function matchMutation(filters, mutation) {
    const { exact, status, predicate, mutationKey } = filters;
    if (mutationKey) {
      if (!mutation.options.mutationKey) return false;
      if (exact) {
        if (hashKey(mutation.options.mutationKey) !== hashKey(mutationKey)) return false;
      } else if (!partialMatchKey(mutation.options.mutationKey, mutationKey)) return false;
    }
    if (status && mutation.state.status !== status) return false;
    if (predicate && !predicate(mutation)) return false;
    return true;
  }
  function hashQueryKeyByOptions(queryKey, options) {
    return (options?.queryKeyHashFn || hashKey)(queryKey);
  }
  function hashKey(queryKey) {
    return JSON.stringify(queryKey, (_, val) => isPlainObject(val) ? Object.keys(val).sort().reduce((result, key) => {
      result[key] = val[key];
      return result;
    }, {}) : val);
  }
  function partialMatchKey(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a && b && typeof a === "object" && typeof b === "object") {
      if (Array.isArray(a) && Array.isArray(b)) {
        if (b.length > a.length) return false;
        for (let i = 0; i < b.length; i++) if (!partialMatchKey(a[i], b[i])) return false;
        return true;
      }
      const bKeys = Object.keys(b);
      for (const key of bKeys) if (!partialMatchKey(a[key], b[key])) return false;
      return true;
    }
    return false;
  }
  var hasOwn = Object.prototype.hasOwnProperty;
  function replaceEqualDeep(a, b, depth = 0) {
    if (a === b) return a;
    if (depth > 500) return b;
    const array = isPlainArray(a) && isPlainArray(b);
    if (!array && !(isPlainObject(a) && isPlainObject(b))) return b;
    const aSize = (array ? a : Object.keys(a)).length;
    const bItems = array ? b : Object.keys(b);
    const bSize = bItems.length;
    const copy = array ? new Array(bSize) : {};
    let equalItems = 0;
    for (let i = 0; i < bSize; i++) {
      const key = array ? i : bItems[i];
      const aItem = a[key];
      const bItem = b[key];
      if (aItem === bItem) {
        copy[key] = aItem;
        if (array ? i < aSize : hasOwn.call(a, key)) equalItems++;
        continue;
      }
      if (aItem === null || bItem === null || typeof aItem !== "object" || typeof bItem !== "object") {
        copy[key] = bItem;
        continue;
      }
      const v = replaceEqualDeep(aItem, bItem, depth + 1);
      copy[key] = v;
      if (v === aItem) equalItems++;
    }
    return aSize === bSize && equalItems === aSize ? a : copy;
  }
  function shallowEqualObjects(a, b) {
    if (!b || Object.keys(a).length !== Object.keys(b).length) return false;
    for (const key in a) if (a[key] !== b[key]) return false;
    return true;
  }
  function isPlainArray(value) {
    return Array.isArray(value) && value.length === Object.keys(value).length;
  }
  function isPlainObject(o) {
    if (!hasObjectPrototype(o)) return false;
    const objectPrototype = Object.getPrototypeOf(o);
    const ctor = objectPrototype?.constructor;
    if (ctor === void 0) return true;
    if (typeof ctor !== "function") return false;
    const prot = ctor.prototype;
    if (!hasObjectPrototype(prot)) return false;
    if (!prot.hasOwnProperty("isPrototypeOf")) return false;
    if (objectPrototype !== Object.prototype) return false;
    return true;
  }
  function hasObjectPrototype(o) {
    return Object.prototype.toString.call(o) === "[object Object]";
  }
  function sleep(timeout) {
    return new Promise((resolve) => {
      timeoutManager.setTimeout(resolve, timeout);
    });
  }
  function replaceData(prevData, data, options) {
    if (typeof options.structuralSharing === "function") return options.structuralSharing(prevData, data);
    else if (options.structuralSharing !== false) {
      if (false) try {
        return replaceEqualDeep(prevData, data);
      } catch (error) {
        console.error(`Structural sharing requires data to be JSON serializable. To fix this, turn off structuralSharing or return JSON-serializable data from your queryFn. [${options.queryHash}]: ${error}`);
        throw error;
      }
      return replaceEqualDeep(prevData, data);
    }
    return data;
  }
  function keepPreviousData(previousData) {
    return previousData;
  }
  function addToEnd(items, item, max = 0) {
    const newItems = [...items, item];
    return max && newItems.length > max ? newItems.slice(1) : newItems;
  }
  function addToStart(items, item, max = 0) {
    const newItems = [item, ...items];
    return max && newItems.length > max ? newItems.slice(0, -1) : newItems;
  }
  var skipToken = /* @__PURE__ */ Symbol();
  function ensureQueryFn(options, fetchOptions) {
    if (false) {
      if (options.queryFn === skipToken) console.error(`Attempted to invoke queryFn when set to skipToken. This is likely a configuration error. Query hash: '${options.queryHash}'`);
    }
    if (!options.queryFn && fetchOptions?.initialPromise) return () => fetchOptions.initialPromise;
    if (!options.queryFn || options.queryFn === skipToken) return () => Promise.reject(/* @__PURE__ */ new Error(`Missing queryFn: '${options.queryHash}'`));
    return options.queryFn;
  }
  function shouldThrowError(throwOnError, params) {
    if (typeof throwOnError === "function") return throwOnError(...params);
    return !!throwOnError;
  }
  function addConsumeAwareSignal(object, getSignal, onCancelled) {
    let consumed = false;
    let signal;
    Object.defineProperty(object, "signal", {
      enumerable: true,
      get: () => {
        signal ??= getSignal();
        if (consumed) return signal;
        consumed = true;
        if (signal.aborted) onCancelled();
        else signal.addEventListener("abort", onCancelled, { once: true });
        return signal;
      }
    });
    return object;
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/environmentManager.js
  var isServerFn = () => isServer;
  var isServer2 = () => isServerFn();
  var environmentManager = {
    isServer: isServer2,
    /**
    * Overrides the server check globally.
    * @param isServerValue - A function that returns whether the runtime should be treated as a
    * server.
    */
    setIsServer(isServerValue) {
      isServerFn = isServerValue;
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/subscribable.js
  var Subscribable = class {
    constructor() {
      this.listeners = /* @__PURE__ */ new Set();
      this.subscribe = this.subscribe.bind(this);
    }
    /**
    * Registers a listener to be called on every update this object notifies about. Returns a function
    * that removes the listener again — call it to stop listening. The base class never drops a listener
    * on its own, though some subclasses clear all of theirs in `destroy()`.
    * @param listener - Called on each update, with whatever the subclass passes to its subscribers.
    * @returns A function that removes the listener.
    * @example
    * ```ts
    * const unsubscribe = subscribable.subscribe(() => {
    *   // react to the update
    * })
    *
    * unsubscribe()
    * ```
    */
    subscribe(listener) {
      this.listeners.add(listener);
      this.onSubscribe();
      return () => {
        this.listeners.delete(listener);
        this.onUnsubscribe();
      };
    }
    /**
    * Returns `true` while at least one listener is registered, `false` once they have all unsubscribed.
    * @returns `true` if at least one listener is registered.
    */
    hasListeners() {
      return this.listeners.size > 0;
    }
    /**
    * Called after a listener is added. Does nothing here; subclasses override it, e.g. to start
    * tracking what they observe once the first listener subscribes.
    */
    onSubscribe() {
    }
    /**
    * Called after a listener is removed. Does nothing here; subclasses override it, e.g. to clean up
    * once the last listener unsubscribes.
    */
    onUnsubscribe() {
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/focusManager.js
  var FocusManager = class extends Subscribable {
    #focused;
    #cleanup;
    #setup;
    constructor() {
      super();
      this.#setup = (onFocus) => {
        if (typeof window !== "undefined" && window.addEventListener) {
          const listener = () => onFocus();
          window.addEventListener("visibilitychange", listener, false);
          return () => {
            window.removeEventListener("visibilitychange", listener);
          };
        }
      };
    }
    onSubscribe() {
      if (!this.#cleanup) this.setEventListener(this.#setup);
    }
    onUnsubscribe() {
      if (!this.hasListeners()) {
        this.#cleanup?.();
        this.#cleanup = void 0;
      }
    }
    /**
    * `setEventListener` can be used to set a custom event listener that will
    * be used to determine the focus state. The provided `setup` function
    * receives a `setFocused` callback: call it with a `boolean` to manually
    * set the focus state, or with no arguments to re-evaluate the current
    * focus state and notify subscribers.
    * @param setup - Receives the `setFocused` callback, registers the event listener, and may return
    * a cleanup function that is called when the listener is replaced or no longer needed.
    * @example
    * ```ts
    * import { focusManager } from '@tanstack/query-core'
    *
    * focusManager.setEventListener((handleFocus) => {
    *   const listener = () => handleFocus()
    *   // Listen to visibilitychange
    *   if (typeof window !== 'undefined' && window.addEventListener) {
    *     window.addEventListener('visibilitychange', listener, false)
    *   }
    *
    *   return () => {
    *     // Be sure to unsubscribe if a new handler is set
    *     window.removeEventListener('visibilitychange', listener)
    *   }
    * })
    * ```
    */
    setEventListener(setup) {
      this.#setup = setup;
      this.#cleanup?.();
      this.#cleanup = setup((focused) => {
        if (typeof focused === "boolean") this.setFocused(focused);
        else this.onFocus();
      });
    }
    /**
    * `setFocused` can be used to manually set the focus state. Set `undefined`
    * to fall back to the default focus check.
    * @param focused - The focus state, or `undefined` to use the default focus check.
    * @example
    * ```ts
    * import { focusManager } from '@tanstack/query-core'
    *
    * // Set focused
    * focusManager.setFocused(true)
    *
    * // Set unfocused
    * focusManager.setFocused(false)
    *
    * // Fallback to the default focus check
    * focusManager.setFocused(undefined)
    * ```
    */
    setFocused(focused) {
      if (this.#focused !== focused) {
        this.#focused = focused;
        this.onFocus();
      }
    }
    /**
    * `onFocus` notifies all subscribed listeners with the current focus state.
    */
    onFocus() {
      const isFocused = this.isFocused();
      this.listeners.forEach((listener) => {
        listener(isFocused);
      });
    }
    /**
    * `isFocused` can be used to get the current focus state.
    * @returns The focus state set with `setFocused`, or otherwise whether the document is visible.
    */
    isFocused() {
      if (typeof this.#focused === "boolean") return this.#focused;
      return globalThis.document?.visibilityState !== "hidden";
    }
  };
  var focusManager = new FocusManager();

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/hydration.js
  function tryResolveSync(promise) {
    let data;
    promise.then((result) => {
      data = result;
      return result;
    }, noop)?.catch?.(noop);
    if (data !== void 0) return { data };
  }
  function dehydrateMutation(mutation) {
    return {
      mutationKey: mutation.options.mutationKey,
      state: mutation.state,
      ...mutation.options.scope && { scope: mutation.options.scope },
      ...mutation.meta && { meta: mutation.meta }
    };
  }
  function dehydratePromise(query, serializeData, shouldRedactErrors) {
    const promise = query.promise?.then(serializeData).catch((error) => {
      if (shouldRedactErrors?.(error) === false) return Promise.reject(error);
      if (false) console.error(`A query that was dehydrated as pending ended up rejecting. [${query.queryHash}]: ${error}; The error will be redacted in production builds`);
      return Promise.reject(/* @__PURE__ */ new Error("redacted"));
    });
    promise?.catch(noop);
    return promise;
  }
  function dehydrateQuery(query, serializeData, shouldRedactErrors) {
    return {
      dehydratedAt: Date.now(),
      state: {
        ...query.state,
        ...query.state.data !== void 0 && { data: serializeData ? serializeData(query.state.data) : query.state.data }
      },
      queryKey: query.queryKey,
      queryHash: query.queryHash,
      ...query.state.status === "pending" && { promise: dehydratePromise(query, serializeData, shouldRedactErrors) },
      ...query.meta && { meta: query.meta },
      ...query.queryType && { queryType: query.queryType }
    };
  }
  function defaultShouldDehydrateMutation(mutation) {
    return mutation.state.isPaused;
  }
  function defaultShouldDehydrateQuery(query) {
    return query.state.status === "success";
  }
  function dehydrate(client, options = {}) {
    const filterMutation = options.shouldDehydrateMutation ?? client.getDefaultOptions().dehydrate?.shouldDehydrateMutation ?? defaultShouldDehydrateMutation;
    const mutations = client.getMutationCache().getAll().flatMap((mutation) => filterMutation(mutation) ? [dehydrateMutation(mutation)] : []);
    const filterQuery = options.shouldDehydrateQuery ?? client.getDefaultOptions().dehydrate?.shouldDehydrateQuery ?? defaultShouldDehydrateQuery;
    const shouldRedactErrors = options.shouldRedactErrors ?? client.getDefaultOptions().dehydrate?.shouldRedactErrors;
    const serializeData = options.serializeData ?? client.getDefaultOptions().dehydrate?.serializeData;
    return {
      mutations,
      queries: client.getQueryCache().getAll().flatMap((query) => filterQuery(query) ? [dehydrateQuery(query, serializeData, shouldRedactErrors)] : [])
    };
  }
  function hydrate(client, dehydratedState, options) {
    const mutationCache = client.getMutationCache();
    const queryCache = client.getQueryCache();
    const deserializeData = options?.defaultOptions?.deserializeData ?? client.getDefaultOptions().hydrate?.deserializeData;
    dehydratedState.mutations?.forEach(({ state, ...mutationOptions }) => {
      mutationCache.build(client, {
        ...client.getDefaultOptions().hydrate?.mutations,
        ...options?.defaultOptions?.mutations,
        ...mutationOptions
      }, state);
    });
    dehydratedState.queries?.forEach(({ queryKey, state, queryHash, meta, promise, dehydratedAt, queryType }) => {
      const syncData = promise ? tryResolveSync(promise) : void 0;
      const rawData = state.data === void 0 ? syncData?.data : state.data;
      const data = rawData === void 0 ? rawData : deserializeData ? deserializeData(rawData) : rawData;
      let query = queryCache.get(queryHash);
      const existingQueryIsPending = query?.state.status === "pending";
      const existingQueryIsFetching = query?.state.fetchStatus === "fetching";
      if (query) {
        const hasNewerSyncData = syncData && dehydratedAt > query.state.dataUpdatedAt;
        if (state.dataUpdatedAt > query.state.dataUpdatedAt || hasNewerSyncData) {
          const { fetchStatus: _ignored, ...serializedState } = state;
          query.setState({
            ...serializedState,
            data,
            ...state.status === "pending" && data !== void 0 && {
              status: "success",
              dataUpdatedAt: dehydratedAt,
              ...!existingQueryIsFetching && { fetchStatus: "idle" }
            }
          });
        }
      } else query = queryCache.build(client, {
        ...client.getDefaultOptions().hydrate?.queries,
        ...options?.defaultOptions?.queries,
        queryKey,
        queryHash,
        meta,
        _type: queryType
      }, {
        ...state,
        data,
        fetchStatus: "idle",
        status: state.status === "pending" && data !== void 0 ? "success" : state.status,
        ...state.status === "pending" && data !== void 0 && { dataUpdatedAt: dehydratedAt }
      });
      if (promise && !syncData && !existingQueryIsPending && !existingQueryIsFetching && dehydratedAt > query.state.dataUpdatedAt) query.fetch(void 0, { initialPromise: Promise.resolve(promise).then(deserializeData) }).catch(noop);
    });
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/notifyManager.js
  var defaultScheduler = systemSetTimeoutZero;
  function createNotifyManager() {
    let queue = [];
    let transactions = 0;
    let notifyFn = (callback) => {
      callback();
    };
    let batchNotifyFn = (callback) => {
      callback();
    };
    let scheduleFn = defaultScheduler;
    const schedule = (callback) => {
      if (transactions) queue.push(callback);
      else scheduleFn(() => {
        notifyFn(callback);
      });
    };
    const flush = () => {
      const originalQueue = queue;
      queue = [];
      if (originalQueue.length) scheduleFn(() => {
        batchNotifyFn(() => {
          originalQueue.forEach((callback) => {
            notifyFn(callback);
          });
        });
      });
    };
    return {
      /**
      * Batches all updates scheduled inside the passed callback.
      * This is mainly used internally to optimize query client updating.
      * Batches can be nested; the queue is only flushed once the outermost `batch` call finishes.
      * The return value of `callback` is passed through.
      * @param callback - The function to run in the batch.
      * @returns The return value of `callback`.
      */
      batch: (callback) => {
        let result;
        transactions++;
        try {
          result = callback();
        } finally {
          transactions--;
          if (!transactions) flush();
        }
        return result;
      },
      /**
      * All calls to the wrapped function will be batched.
      * @param callback - The function to wrap.
      * @returns A function that schedules a call to `callback` with the given arguments.
      */
      batchCalls: (callback) => {
        return (...args) => {
          schedule(() => {
            callback(...args);
          });
        };
      },
      /**
      * Schedules a function to be run on the next batch.
      * By default, the batch is run with a `setTimeout`, but this can be configured via `setScheduler`.
      */
      schedule,
      /**
      * Use this method to set a custom notify function.
      * This can be used to for example wrap notifications with `React.act` while running tests.
      * @param fn - Receives each notification callback and must call it.
      */
      setNotifyFunction: (fn) => {
        notifyFn = fn;
      },
      /**
      * Use this method to set a custom function to batch notifications together into a single tick.
      * Framework adapters use this to plug in their own batching primitive, so that a single query
      * update only triggers one re-render instead of one per subscriber.
      * @param fn - Receives a function that runs a batch of notifications and must call it.
      * @example
      * ```ts
      * import { notifyManager } from '@tanstack/query-core'
      * import { batch } from 'solid-js'
      *
      * notifyManager.setBatchNotifyFunction(batch)
      * ```
      */
      setBatchNotifyFunction: (fn) => {
        batchNotifyFn = fn;
      },
      /**
      * Configures a custom callback that schedules when the next batch runs.
      * The default behavior is `setTimeout(callback, 0)`.
      * @param fn - Receives a callback that runs the next batch, and schedules it.
      * @example
      * ```ts
      * import { notifyManager } from '@tanstack/query-core'
      *
      * // Schedule batches in the next microtask
      * notifyManager.setScheduler(queueMicrotask)
      *
      * // Schedule batches before the next frame is rendered
      * notifyManager.setScheduler(requestAnimationFrame)
      *
      * // Schedule batches some time in the future
      * notifyManager.setScheduler((cb) => setTimeout(cb, 10))
      * ```
      */
      setScheduler: (fn) => {
        scheduleFn = fn;
      }
    };
  }
  var notifyManager = createNotifyManager();

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/onlineManager.js
  var OnlineManager = class extends Subscribable {
    #online = true;
    #cleanup;
    #setup;
    constructor() {
      super();
      this.#setup = (onOnline) => {
        if (typeof window !== "undefined" && window.addEventListener) {
          const onlineListener = () => onOnline(true);
          const offlineListener = () => onOnline(false);
          window.addEventListener("online", onlineListener, false);
          window.addEventListener("offline", offlineListener, false);
          return () => {
            window.removeEventListener("online", onlineListener);
            window.removeEventListener("offline", offlineListener);
          };
        }
      };
    }
    onSubscribe() {
      if (!this.#cleanup) this.setEventListener(this.#setup);
    }
    onUnsubscribe() {
      if (!this.hasListeners()) {
        this.#cleanup?.();
        this.#cleanup = void 0;
      }
    }
    /**
    * `setEventListener` can be used to set a custom event listener that will
    * be used to determine the online state. The provided `setup` function
    * receives a `setOnline` callback that should be called with a `boolean`
    * whenever the online state changes.
    * @param setup - Receives the `setOnline` callback, registers the event listener, and may return
    * a cleanup function that is called when the listener is replaced or no longer needed.
    * @example
    * ```ts
    * import NetInfo from '@react-native-community/netinfo'
    * import { onlineManager } from '@tanstack/query-core'
    *
    * onlineManager.setEventListener((setOnline) => {
    *   return NetInfo.addEventListener((state) => {
    *     setOnline(!!state.isConnected)
    *   })
    * })
    * ```
    */
    setEventListener(setup) {
      this.#setup = setup;
      this.#cleanup?.();
      this.#cleanup = setup(this.setOnline.bind(this));
    }
    /**
    * `setOnline` can be used to manually set the online state.
    * @param online - The online state.
    * @example
    * ```ts
    * import { onlineManager } from '@tanstack/query-core'
    *
    * // Set to online
    * onlineManager.setOnline(true)
    *
    * // Set to offline
    * onlineManager.setOnline(false)
    * ```
    */
    setOnline(online) {
      if (this.#online !== online) {
        this.#online = online;
        this.listeners.forEach((listener) => {
          listener(online);
        });
      }
    }
    /**
    * `isOnline` can be used to get the current online state.
    * @returns `true` if online.
    */
    isOnline() {
      return this.#online;
    }
  };
  var onlineManager = new OnlineManager();

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/retryer.js
  function defaultRetryDelay(failureCount) {
    return Math.min(1e3 * 2 ** failureCount, 3e4);
  }
  function canFetch(networkMode) {
    return (networkMode ?? "online") === "online" ? onlineManager.isOnline() : true;
  }
  var CancelledError = class extends Error {
    constructor(options) {
      super("CancelledError");
      this.revert = options?.revert;
      this.silent = options?.silent;
    }
  };
  function isCancelledError(value) {
    return value instanceof CancelledError;
  }
  function createRetryer(config) {
    let isRetryCancelled = false;
    let failureCount = 0;
    let continueFn;
    let status = "pending";
    let promiseResolve;
    let promiseReject;
    const promise = new Promise((resolve2, reject2) => {
      promiseResolve = resolve2;
      promiseReject = reject2;
    });
    promise.catch(noop);
    const isResolved = () => status !== "pending";
    const cancel = (cancelOptions) => {
      if (!isResolved()) {
        const error = new CancelledError(cancelOptions);
        reject(error);
        config.onCancel?.(error);
      }
    };
    const cancelRetry = () => {
      isRetryCancelled = true;
    };
    const continueRetry = () => {
      isRetryCancelled = false;
    };
    const canContinue = () => focusManager.isFocused() && (config.networkMode === "always" || onlineManager.isOnline()) && config.canRun();
    const canStart = () => canFetch(config.networkMode) && config.canRun();
    const resolve = (value) => {
      if (!isResolved()) {
        continueFn?.();
        status = "resolved";
        promiseResolve(value);
      }
    };
    const reject = (value) => {
      if (!isResolved()) {
        continueFn?.();
        status = "rejected";
        promiseReject(value);
      }
    };
    const pause = (canResume) => {
      return new Promise((continueResolve) => {
        continueFn = (value) => {
          if (isResolved() || canResume()) continueResolve(value);
        };
        config.onPause?.();
      }).then(() => {
        continueFn = void 0;
        if (!isResolved()) config.onContinue?.();
      });
    };
    const run = () => {
      if (isResolved()) return;
      let promiseOrValue;
      const initialPromise = failureCount === 0 ? config.initialPromise : void 0;
      try {
        promiseOrValue = initialPromise ?? config.fn();
      } catch (error) {
        promiseOrValue = Promise.reject(error);
      }
      Promise.resolve(promiseOrValue).then(resolve).catch((error) => {
        if (isResolved()) return;
        const retry = config.retry ?? (isServer2() ? 0 : 3);
        const retryDelay = config.retryDelay ?? defaultRetryDelay;
        const delay = typeof retryDelay === "function" ? retryDelay(failureCount, error) : retryDelay;
        const shouldRetry = retry === true || typeof retry === "number" && failureCount < retry || typeof retry === "function" && retry(failureCount, error);
        if (isRetryCancelled || !shouldRetry) {
          reject(error);
          return;
        }
        failureCount++;
        config.onFail?.(failureCount, error);
        sleep(delay).then(() => {
          return canContinue() ? void 0 : pause(canContinue);
        }).then(() => {
          if (isRetryCancelled) reject(error);
          else run();
        });
      });
    };
    return {
      promise,
      status: () => status,
      cancel,
      continue: () => {
        continueFn?.();
        return promise;
      },
      cancelRetry,
      continueRetry,
      canStart,
      start: () => {
        if (canStart()) run();
        else pause(canStart).then(run);
        return promise;
      }
    };
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/removable.js
  var Removable = class {
    #gcTimeout;
    /**
    * Clears the pending garbage collection timeout, so the entry is no longer scheduled for removal.
    * A subclass may override this to release what it holds on to as well — `Query` also cancels any
    * in-flight fetch.
    */
    destroy() {
      this.clearGcTimeout();
    }
    /**
    * Schedules the entry to be removed from its cache after `gcTime`, replacing any timeout scheduled
    * before. Nothing is scheduled if `gcTime` is `Infinity`.
    */
    scheduleGc() {
      this.clearGcTimeout();
      if (isValidTimeout(this.gcTime)) this.#gcTimeout = timeoutManager.setTimeout(() => {
        this.optionalRemove();
      }, this.gcTime);
    }
    /**
    * Updates `gcTime`, keeping the longest one seen so far. Without a value, it defaults to 5 minutes
    * on the client and `Infinity` on the server.
    * @param newGcTime - The `gcTime` from the latest options, if any.
    */
    updateGcTime(newGcTime) {
      this.gcTime = Math.max(this.gcTime || 0, newGcTime ?? (isServer2() ? Infinity : 3e5));
    }
    /**
    * Cancels the scheduled removal, if there is one.
    */
    clearGcTimeout() {
      if (this.#gcTimeout !== void 0) {
        timeoutManager.clearTimeout(this.#gcTimeout);
        this.#gcTimeout = void 0;
      }
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/infiniteQueryBehavior.js
  function infiniteQueryBehavior(pages) {
    return { onFetch: (context, query) => {
      const options = context.options;
      const direction = context.fetchOptions?.meta?.fetchMore?.direction;
      const oldPages = context.state.data?.pages || [];
      const oldPageParams = context.state.data?.pageParams || [];
      let result = {
        pages: [],
        pageParams: []
      };
      let currentPage = 0;
      const fetchFn = async () => {
        let cancelled = false;
        const addSignalProperty = (object) => {
          addConsumeAwareSignal(object, () => context.signal, () => cancelled = true);
        };
        const queryFn = ensureQueryFn(context.options, context.fetchOptions);
        const fetchPage = async (data, param, previous) => {
          if (cancelled) return Promise.reject(context.signal.reason);
          if (param == null && data.pages.length) return Promise.resolve(data);
          const createQueryFnContext = () => {
            const queryFnContext2 = {
              client: context.client,
              queryKey: context.queryKey,
              pageParam: param,
              direction: previous ? "backward" : "forward",
              meta: context.options.meta
            };
            addSignalProperty(queryFnContext2);
            return queryFnContext2;
          };
          const queryFnContext = createQueryFnContext();
          const page = await queryFn(queryFnContext);
          const { maxPages } = context.options;
          const addTo = previous ? addToStart : addToEnd;
          return {
            pages: addTo(data.pages, page, maxPages),
            pageParams: addTo(data.pageParams, param, maxPages)
          };
        };
        if (direction && oldPages.length) {
          const previous = direction === "backward";
          const pageParamFn = previous ? getPreviousPageParam : getNextPageParam;
          const oldData = {
            pages: oldPages,
            pageParams: oldPageParams
          };
          result = await fetchPage(oldData, pageParamFn(options, oldData), previous);
        } else {
          const remainingPages = pages ?? oldPages.length;
          do {
            const param = currentPage === 0 ? oldPageParams[0] === void 0 ? options.initialPageParam : oldPageParams[0] : getNextPageParam(options, result);
            if (currentPage > 0 && param == null) break;
            result = await fetchPage(result, param);
            currentPage++;
          } while (currentPage < remainingPages);
        }
        return result;
      };
      if (context.options.persister) context.fetchFn = () => {
        return context.options.persister?.(fetchFn, {
          client: context.client,
          queryKey: context.queryKey,
          meta: context.options.meta,
          signal: context.signal
        }, query);
      };
      else context.fetchFn = fetchFn;
    } };
  }
  function getNextPageParam(options, { pages, pageParams }) {
    const lastIndex = pages.length - 1;
    return pages.length > 0 ? options.getNextPageParam(pages[lastIndex], pages, pageParams[lastIndex], pageParams) : void 0;
  }
  function getPreviousPageParam(options, { pages, pageParams }) {
    return pages.length > 0 ? options.getPreviousPageParam?.(pages[0], pages, pageParams[0], pageParams) : void 0;
  }
  function hasNextPage(options, data) {
    if (!data) return false;
    return getNextPageParam(options, data) != null;
  }
  function hasPreviousPage(options, data) {
    if (!data || !options.getPreviousPageParam) return false;
    return getPreviousPageParam(options, data) != null;
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/query.js
  var Query = class extends Removable {
    #queryType;
    #initialState;
    #revertState;
    #cache;
    #client;
    #retryer;
    #defaultOptions;
    #abortSignalConsumed;
    constructor(config) {
      super();
      this.#abortSignalConsumed = false;
      this.#defaultOptions = config.defaultOptions;
      this.setOptions(config.options);
      this.observers = [];
      this.#client = config.client;
      this.#cache = this.#client.getQueryCache();
      this.queryKey = config.queryKey;
      this.queryHash = config.queryHash;
      this.#initialState = getDefaultState(this.options);
      this.state = config.state ?? this.#initialState;
      this.scheduleGc();
    }
    /**
    * The `meta` object passed in the query's options, if any.
    * @returns The query's `meta`, or `undefined` if none was set.
    */
    get meta() {
      return this.options.meta;
    }
    /**
    * `'infinite'` for an infinite query, otherwise `undefined`.
    * @internal
    * @returns The type of the query, set from the `_type` option (e.g. `'infinite'`).
    */
    get queryType() {
      return this.#queryType;
    }
    /**
    * The promise for the currently in-flight fetch, if the query is fetching.
    * `undefined` when the query is not fetching.
    * @returns The promise of the in-flight fetch, or `undefined`.
    */
    get promise() {
      return this.#retryer?.promise;
    }
    /**
    * Replaces the query's options and applies their `gcTime`. If the query has no data yet, it gets
    * the `initialData` from the new options, if any.
    * @internal
    * @param options - The new query options, merged on top of the query's default options.
    */
    setOptions(options) {
      this.options = {
        ...this.#defaultOptions,
        ...options
      };
      if (options?._type) this.#queryType = options._type;
      this.updateGcTime(this.options.gcTime);
      if (this.state && this.state.data === void 0) {
        const defaultState = getDefaultState(this.options);
        if (defaultState.data !== void 0) {
          this.setState(successState(defaultState.data, defaultState.dataUpdatedAt));
          this.#initialState = defaultState;
        }
      }
    }
    optionalRemove() {
      if (!this.observers.length && this.state.fetchStatus === "idle") this.#cache.remove(this);
    }
    /**
    * Writes new data to the query and marks it as successfully fetched.
    * @internal
    * @param newData - The data to write. Structural sharing with the current data is applied.
    * @param options - Set `updatedAt` to override the timestamp, and `manual` to mark the write as
    * manual (e.g. from `queryClient.setQueryData`).
    * @returns The data that was written.
    */
    setData(newData, options) {
      const data = replaceData(this.state.data, newData, this.options);
      this.#dispatch({
        data,
        type: "success",
        dataUpdatedAt: options?.updatedAt,
        manual: options?.manual
      });
      return data;
    }
    /**
    * Merges the given partial state directly into this query's state, notifying observers. Used
    * by persistence and broadcast plugins to restore a state snapshot, and by devtools to let a
    * user manually trigger a loading/error state or edit the cached data.
    * @param state - The partial state to merge into the query's state.
    */
    setState(state) {
      this.#dispatch({
        type: "setState",
        state
      });
    }
    /**
    * Cancels the query's currently in-flight fetch, if any.
    * - Returns a promise that resolves once the cancellation has settled.
    * - If no fetch is in progress, resolves immediately.
    * @param options - Set `revert` to restore the state from before the fetch started, and `silent`
    * to suppress the cancellation error when a new fetch replaces the cancelled one.
    * @returns A promise that resolves once the cancellation has settled.
    * @example
    * ```ts
    * await query.cancel()
    * ```
    */
    cancel(options) {
      const promise = this.#retryer?.promise;
      this.#retryer?.cancel(options);
      return promise ? promise.then(noop).catch(noop) : Promise.resolve();
    }
    /**
    * Clears the query's garbage collection timeout and silently cancels any
    * in-flight fetch. Called by `QueryCache` when the query is removed from
    * the cache.
    * @see {@link Query#cancel}
    */
    destroy() {
      super.destroy();
      this.cancel({ silent: true });
    }
    /**
    * The state the query was created with.
    * @internal
    * @returns The state the query had when it was first created, used by {@link Query#reset}.
    */
    get resetState() {
      return this.#initialState;
    }
    /**
    * Resets the query back to its initial state (the state it had when it was
    * first created, e.g. any `initialData`), destroying it first to cancel any
    * in-flight fetch.
    */
    reset() {
      this.destroy();
      this.setState(this.resetState);
    }
    /**
    * Returns `true` if the query has at least one observer for which `enabled`
    * does not resolve to `false`.
    * @returns `true` if the query has an enabled observer.
    */
    isActive() {
      return this.observers.some((observer) => resolveQueryValue(observer.options.enabled, this) !== false);
    }
    /**
    * Returns `true` if the query is disabled, meaning it will not fetch
    * automatically.
    * - If the query has observers, it is disabled when none of them are active
    *   (see `isActive`).
    * - If the query has no observers, it is disabled when its `queryFn` is
    *   `skipToken` or it has never been fetched.
    * @returns `true` if the query is disabled.
    */
    isDisabled() {
      if (this.getObserversCount() > 0) return !this.isActive();
      return this.options.queryFn === skipToken || !this.isFetched();
    }
    /**
    * Returns `true` if the query has been fetched, i.e. it has resolved with
    * either data or an error at least once.
    * @returns `true` if the query has been fetched.
    */
    isFetched() {
      return this.state.dataUpdateCount + this.state.errorUpdateCount > 0;
    }
    /**
    * Returns `true` if the query has at least one observer configured with
    * `staleTime: 'static'`, meaning it is treated as never stale.
    * @returns `true` if the query is static.
    */
    isStatic() {
      if (this.getObserversCount() > 0) return this.observers.some((observer) => resolveQueryValue(observer.options.staleTime, this) === "static");
      return false;
    }
    /**
    * Returns `true` if the query is stale.
    * - If the query has observers, defers to whether any observer's current
    *   result reports `isStale` (which accounts for each observer's own
    *   `staleTime` and `enabled` state).
    * - If the query has no observers, it is considered stale when it has no
    *   data or has been invalidated.
    * @returns `true` if the query is stale.
    * @see {@link Query#isStaleByTime}
    * @example
    * ```ts
    * if (query.isStale()) {
    *   // refetch or otherwise treat the cached data as outdated
    * }
    * ```
    */
    isStale() {
      if (this.getObserversCount() > 0) return this.observers.some((observer) => observer.getCurrentResult().isStale);
      return this.state.data === void 0 || this.state.isInvalidated;
    }
    /**
    * Returns `true` if the query's data is stale relative to the given
    * `staleTime` (defaults to `0`).
    * - A query with no data is always stale.
    * - `staleTime: 'static'` is never stale.
    * - An invalidated query is always stale.
    * - Otherwise, staleness is based on elapsed time since `dataUpdatedAt`.
    * @param staleTime - The time, in milliseconds, after which data is considered stale, or
    * `'static'` to never treat existing data as stale. A query without data is stale either way.
    * @returns `true` if the query's data is stale.
    * @see {@link Query#isStale}
    * @example
    * ```ts
    * const isStale = query.isStaleByTime(1000 * 60)
    * ```
    */
    isStaleByTime(staleTime = 0) {
      if (this.state.data === void 0) return true;
      if (staleTime === "static") return false;
      if (this.state.isInvalidated) return true;
      return !timeUntilStale(this.state.dataUpdatedAt, staleTime);
    }
    /**
    * Refetches the query when the window regains focus, if an observer wants that, and continues a
    * paused fetch.
    * @internal
    */
    onFocus() {
      this.observers.find((x) => x.shouldFetchOnWindowFocus())?.refetch({ cancelRefetch: false });
      this.#retryer?.continue();
    }
    /**
    * Refetches the query when the app reconnects, if an observer wants that, and continues a paused
    * fetch.
    * @internal
    */
    onOnline() {
      this.observers.find((x) => x.shouldFetchOnReconnect())?.refetch({ cancelRefetch: false });
      this.#retryer?.continue();
    }
    /**
    * Subscribes an observer to the query and stops its garbage collection.
    * @internal
    * @param observer - The observer to add. Adding an observer that is already subscribed does
    * nothing.
    */
    addObserver(observer) {
      if (!this.observers.includes(observer)) {
        this.observers.push(observer);
        this.clearGcTimeout();
        this.#cache.notify({
          type: "observerAdded",
          query: this,
          observer
        });
      }
    }
    /**
    * Unsubscribes an observer from the query.
    * @internal
    * @param observer - The observer to remove. When the last observer is removed, the in-flight
    * fetch is cancelled if its abort signal was consumed (otherwise only its retries are stopped),
    * and garbage collection is scheduled.
    */
    removeObserver(observer) {
      const index = this.observers.indexOf(observer);
      if (index !== -1) {
        this.observers.splice(index, 1);
        if (!this.observers.length) {
          if (this.#retryer) {
            if (this.#abortSignalConsumed || this.state.fetchStatus === "paused" && this.state.status === "pending") this.#retryer.cancel({ revert: true });
            else this.#retryer.cancelRetry();
          }
          this.scheduleGc();
        }
        this.#cache.notify({
          type: "observerRemoved",
          query: this,
          observer
        });
      }
    }
    /**
    * Returns the number of observers currently subscribed to this query.
    * @returns The number of observers.
    * @example
    * ```ts
    * if (query.getObserversCount() === 0) {
    *   // no component is currently watching this query
    * }
    * ```
    */
    getObserversCount() {
      return this.observers.length;
    }
    /**
    * Marks the query as invalidated, unless it is already invalidated. This
    * updates `state.isInvalidated` and notifies observers, but does not by
    * itself trigger a refetch.
    * @example
    * ```ts
    * query.invalidate()
    * ```
    */
    invalidate() {
      if (!this.state.isInvalidated) this.#dispatch({ type: "invalidate" });
    }
    /**
    * Fetches the query, i.e. runs its `queryFn` (through any configured
    * retryer/behavior) and updates the query's state with the result.
    * - If a fetch is already in flight, returns its promise instead of
    *   starting a new one, unless `fetchOptions.cancelRefetch` is set and the
    *   query already has data, in which case the current fetch is silently
    *   cancelled first.
    * - If `options` is passed, it replaces the query's current options
    *   before fetching.
    * @param options - Query options that replace the query's current options before fetching. They
    * are not applied when an in-flight fetch is reused.
    * @param fetchOptions - Set `cancelRefetch` to cancel an in-flight fetch first (only if the query
    * already has data), and `meta` to pass extra information to the query's behavior.
    * @returns A promise that resolves with the fetched data, or rejects with the fetch error. If the
    * fetch is cancelled with `revert` while the query has data, it resolves with the restored data
    * instead.
    */
    async fetch(options, fetchOptions) {
      if (this.state.fetchStatus !== "idle" && this.#retryer?.status() !== "rejected") {
        if (this.state.data !== void 0 && fetchOptions?.cancelRefetch) this.cancel({ silent: true });
        else if (this.#retryer) {
          this.#retryer.continueRetry();
          return this.#retryer.promise;
        }
      }
      if (options) this.setOptions(options);
      if (!this.options.queryFn) {
        const observer = this.observers.find((x) => x.options.queryFn);
        if (observer) this.setOptions(observer.options);
      }
      if (false) {
        if (!Array.isArray(this.options.queryKey)) console.error(`As of v4, queryKey needs to be an Array. If you are using a string like 'repoData', please change it to an Array, e.g. ['repoData']`);
      }
      const abortController = new AbortController();
      const addSignalProperty = (object) => {
        Object.defineProperty(object, "signal", {
          enumerable: true,
          get: () => {
            this.#abortSignalConsumed = true;
            return abortController.signal;
          }
        });
      };
      const fetchFn = () => {
        const queryFn = ensureQueryFn(this.options, fetchOptions);
        const createQueryFnContext = () => {
          const queryFnContext2 = {
            client: this.#client,
            queryKey: this.queryKey,
            meta: this.meta
          };
          addSignalProperty(queryFnContext2);
          return queryFnContext2;
        };
        const queryFnContext = createQueryFnContext();
        this.#abortSignalConsumed = false;
        if (this.options.persister) return this.options.persister(queryFn, queryFnContext, this);
        return queryFn(queryFnContext);
      };
      const createFetchContext = () => {
        const context2 = {
          fetchOptions,
          options: this.options,
          queryKey: this.queryKey,
          client: this.#client,
          state: this.state,
          fetchFn
        };
        addSignalProperty(context2);
        return context2;
      };
      const context = createFetchContext();
      (this.#queryType === "infinite" ? infiniteQueryBehavior(this.options.pages) : this.options.behavior)?.onFetch(context, this);
      this.#revertState = this.state;
      if (this.state.fetchStatus === "idle" || this.state.fetchMeta !== context.fetchOptions?.meta) this.#dispatch({
        type: "fetch",
        meta: context.fetchOptions?.meta
      });
      const retryer = this.#retryer = createRetryer({
        initialPromise: fetchOptions?.initialPromise,
        fn: context.fetchFn,
        onCancel: (error) => {
          if (error instanceof CancelledError && error.revert) this.setState({
            ...this.#revertState,
            fetchStatus: "idle"
          });
          abortController.abort();
        },
        onFail: (failureCount, error) => {
          this.#dispatch({
            type: "failed",
            failureCount,
            error
          });
        },
        onPause: () => {
          this.#dispatch({ type: "pause" });
        },
        onContinue: () => {
          this.#dispatch({ type: "continue" });
        },
        retry: context.options.retry,
        retryDelay: context.options.retryDelay,
        networkMode: context.options.networkMode,
        canRun: () => true
      });
      try {
        const data = await retryer.start();
        if (data === void 0) {
          if (false) console.error(`Query data cannot be undefined. Please make sure to return a value other than undefined from your query function. Affected query key: ${this.queryHash}`);
          throw new Error(`${this.queryHash} data is undefined`);
        }
        this.setData(data);
        this.#cache.config.onSuccess?.(data, this);
        this.#cache.config.onSettled?.(data, this.state.error, this);
        return data;
      } catch (error) {
        if (error instanceof CancelledError) {
          if (error.silent) return this.#retryer.promise;
          else if (error.revert) {
            if (this.state.data === void 0) throw error;
            return this.state.data;
          }
        }
        this.#dispatch({
          type: "error",
          error
        });
        this.#cache.config.onError?.(error, this);
        this.#cache.config.onSettled?.(this.state.data, error, this);
        throw error;
      } finally {
        if (this.#retryer === retryer) this.#retryer = void 0;
        this.scheduleGc();
      }
    }
    #dispatch(action) {
      const reducer = (state) => {
        switch (action.type) {
          case "failed":
            return {
              ...state,
              fetchFailureCount: action.failureCount,
              fetchFailureReason: action.error
            };
          case "pause":
            return {
              ...state,
              fetchStatus: "paused"
            };
          case "continue":
            return {
              ...state,
              fetchStatus: "fetching"
            };
          case "fetch":
            return {
              ...state,
              ...fetchState(state.data, this.options),
              fetchMeta: action.meta ?? null
            };
          case "success":
            const newState = {
              ...state,
              ...successState(action.data, action.dataUpdatedAt),
              dataUpdateCount: state.dataUpdateCount + 1,
              ...!action.manual && {
                fetchStatus: "idle",
                fetchFailureCount: 0,
                fetchFailureReason: null
              }
            };
            this.#revertState = action.manual ? newState : void 0;
            return newState;
          case "error":
            const error = action.error;
            return {
              ...state,
              error,
              errorUpdateCount: state.errorUpdateCount + 1,
              errorUpdatedAt: Date.now(),
              fetchFailureCount: state.fetchFailureCount + 1,
              fetchFailureReason: error,
              fetchStatus: "idle",
              status: "error",
              isInvalidated: true
            };
          case "invalidate":
            return {
              ...state,
              isInvalidated: true
            };
          case "setState":
            return {
              ...state,
              ...action.state
            };
        }
      };
      this.state = reducer(this.state);
      notifyManager.batch(() => {
        this.observers.slice().forEach((observer) => {
          observer.onQueryUpdate();
        });
        this.#cache.notify({
          query: this,
          type: "updated",
          action
        });
      });
    }
  };
  function fetchState(data, options) {
    return {
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchStatus: canFetch(options.networkMode) ? "fetching" : "paused",
      ...data === void 0 && {
        error: null,
        status: "pending"
      }
    };
  }
  function successState(data, dataUpdatedAt) {
    return {
      data,
      dataUpdatedAt: dataUpdatedAt ?? Date.now(),
      error: null,
      isInvalidated: false,
      status: "success"
    };
  }
  function getDefaultState(options) {
    const data = typeof options.initialData === "function" ? options.initialData() : options.initialData;
    const hasData = data !== void 0;
    const initialDataUpdatedAt = hasData ? typeof options.initialDataUpdatedAt === "function" ? options.initialDataUpdatedAt() : options.initialDataUpdatedAt : 0;
    return {
      data,
      dataUpdateCount: 0,
      dataUpdatedAt: hasData ? initialDataUpdatedAt ?? Date.now() : 0,
      error: null,
      errorUpdateCount: 0,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      status: hasData ? "success" : "pending",
      fetchStatus: "idle"
    };
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/queryObserver.js
  var QueryObserver = class extends Subscribable {
    #client;
    #currentQuery = void 0;
    #currentQueryInitialState = void 0;
    #currentResult = void 0;
    #currentResultState;
    #currentResultOptions;
    #selectError;
    #selectFn;
    #selectResult;
    #lastQueryWithDefinedData;
    #staleTimeoutId;
    #refetchIntervalId;
    #currentRefetchInterval;
    #trackedProps = /* @__PURE__ */ new Set();
    constructor(client, options) {
      super();
      this.options = options;
      this.#client = client;
      this.#selectError = null;
      this.bindMethods();
      this.setOptions(options);
    }
    /**
    * Binds the methods of the result (`refetch`) to the observer, so they keep working when destructured
    * from it. Subclasses override it to bind their own result methods as well.
    */
    bindMethods() {
      this.refetch = this.refetch.bind(this);
    }
    onSubscribe() {
      if (this.listeners.size === 1) {
        this.#currentQuery.addObserver(this);
        if (shouldFetchOnMount(this.#currentQuery, this.options)) this.#executeFetch();
        else this.updateResult();
        this.#updateTimers();
      }
    }
    onUnsubscribe() {
      if (!this.hasListeners()) this.destroy();
    }
    /**
    * Returns whether the observed query is currently stale and configured
    * (via the `refetchOnReconnect` option) to refetch when the network
    * reconnects.
    * @returns `true` if the observer should refetch the query on reconnect.
    */
    shouldFetchOnReconnect() {
      return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnReconnect);
    }
    /**
    * Returns whether the observed query is currently stale and configured
    * (via the `refetchOnWindowFocus` option) to refetch when the window
    * regains focus.
    * @returns `true` if the observer should refetch the query on window focus.
    */
    shouldFetchOnWindowFocus() {
      return shouldFetchOn(this.#currentQuery, this.options, this.options.refetchOnWindowFocus);
    }
    /**
    * Stops observing the current query: clears all listeners, cancels the
    * stale and refetch-interval timers, and removes this observer from the
    * query it was observing.
    */
    destroy() {
      this.listeners = /* @__PURE__ */ new Set();
      this.#clearStaleTimeout();
      this.#clearRefetchInterval();
      this.#currentQuery.removeObserver(this);
    }
    /**
    * Updates the observer's options. This will re-resolve the query being
    * observed (switching to a different query if the `queryKey` changed),
    * trigger a fetch if the new options require one and the observer has
    * subscribers, recompute the current result, and reschedule the stale and
    * refetch-interval timers as needed.
    * @param options - The new observer options. They are defaulted with {@link
    * QueryClient#defaultQueryOptions} before being applied.
    * @throws {Error} If `enabled` is neither a boolean nor a function.
    * @example
    * ```ts
    * observer.setOptions({ queryKey: ['posts', 1], queryFn: () => fetchPost(1) })
    * // later: switch to a different query, reusing the same observer
    * observer.setOptions({ queryKey: ['posts', 2], queryFn: () => fetchPost(2) })
    * ```
    */
    setOptions(options) {
      const prevOptions = this.options;
      const prevQuery = this.#currentQuery;
      this.options = this.#client.defaultQueryOptions(options);
      if (this.options.enabled !== void 0 && typeof this.options.enabled !== "boolean" && typeof this.options.enabled !== "function" && typeof resolveQueryValue(this.options.enabled, this.#currentQuery) !== "boolean") throw new Error("Expected enabled to be a boolean or a callback that returns a boolean");
      this.#updateQuery();
      this.#currentQuery.setOptions(this.options);
      if (prevOptions._defaulted && !shallowEqualObjects(this.options, prevOptions)) this.#client.getQueryCache().notify({
        type: "observerOptionsUpdated",
        query: this.#currentQuery,
        observer: this
      });
      const mounted = this.hasListeners();
      if (mounted && shouldFetchOptionally(this.#currentQuery, prevQuery, this.options, prevOptions)) this.#executeFetch();
      this.updateResult();
      if (mounted && (this.#currentQuery !== prevQuery || resolveQueryValue(this.options.enabled, this.#currentQuery) !== resolveQueryValue(prevOptions.enabled, this.#currentQuery) || resolveQueryValue(this.options.staleTime, this.#currentQuery) !== resolveQueryValue(prevOptions.staleTime, this.#currentQuery))) this.#updateStaleTimeout();
      const nextRefetchInterval = this.#computeRefetchInterval();
      if (mounted && (this.#currentQuery !== prevQuery || resolveQueryValue(this.options.enabled, this.#currentQuery) !== resolveQueryValue(prevOptions.enabled, this.#currentQuery) || nextRefetchInterval !== this.#currentRefetchInterval)) this.#updateRefetchInterval(nextRefetchInterval);
    }
    /**
    * Computes the result the observer would produce for the given (already-defaulted) options
    * right now, building the underlying `Query` if it doesn't exist yet, without waiting for a
    * subscription callback. Called by framework adapters on every render (e.g. `useQuery`) so the
    * returned value is available synchronously, ahead of `setOptions` triggering an actual fetch.
    * @param options - The defaulted observer options to compute the result for.
    * @returns The result for the given options.
    */
    getOptimisticResult(options) {
      const query = this.#client.getQueryCache().build(this.#client, options);
      const result = this.createResult(query, options);
      if (!shallowEqualObjects(this.getCurrentResult(), result)) {
        this.#currentResult = result;
        this.#currentResultOptions = this.options;
        this.#currentResultState = this.#currentQuery.state;
      }
      return result;
    }
    /**
    * Returns the most recently computed `QueryObserverResult` for the
    * observed query. This is a point-in-time read; to be notified of updates
    * as they happen, subscribe to the observer instead (its inherited
    * `subscribe` method).
    * @returns The observer's latest result.
    * @example
    * ```ts
    * const result = observer.getCurrentResult()
    * console.log(result.status, result.data)
    * ```
    */
    getCurrentResult() {
      return this.#currentResult;
    }
    /**
    * Wraps a `QueryObserverResult` in a `Proxy` that records which properties are read, via
    * {@link QueryObserver#trackProp} (and an optional `onPropTracked` callback). Used by framework
    * adapters when `notifyOnChangeProps` is not set, to implement its default "only re-render on
    * properties you actually read" behavior.
    * @param result - The result to wrap.
    * @param onPropTracked - Called with the name of each property that is read.
    * @returns A proxy of `result` that tracks property reads.
    */
    trackResult(result, onPropTracked) {
      return new Proxy(result, { get: (target, key) => {
        this.trackProp(key);
        onPropTracked?.(key);
        return Reflect.get(target, key);
      } });
    }
    /**
    * Records that the given `QueryObserverResult` property was read, so a subsequent update only
    * notifies this observer if a tracked property actually changed. Normally called indirectly via
    * {@link QueryObserver#trackResult}'s proxy; exposed directly for adapters that track property
    * access themselves (e.g. through their own reactivity system) instead of via the proxy.
    * @param key - The name of the property that was read.
    */
    trackProp(key) {
      this.#trackedProps.add(key);
    }
    /**
    * Returns the `Query` instance this observer is currently observing.
    * @returns The observed query.
    */
    getCurrentQuery() {
      return this.#currentQuery;
    }
    /**
    * Refetches the observed query and returns a promise that resolves with
    * the resulting `QueryObserverResult`.
    * @param options - Set `cancelRefetch` to `false` to keep a running fetch instead of cancelling
    * it, and `throwOnError` to `true` to reject when the refetch fails.
    * @returns A promise that resolves with the result after the refetch.
    * @example
    * ```ts
    * const result = await observer.refetch({ cancelRefetch: false })
    * console.log(result.data)
    * ```
    */
    refetch({ ...options } = {}) {
      return this.fetch({ ...options });
    }
    /**
    * Fetches a query defined by the given options without affecting this
    * observer's own tracked query or result, and returns a promise that
    * resolves with the `QueryObserverResult` for that fetch. This is useful
    * for prefetching data that another observer (e.g. a query about to be
    * navigated to) will need, ahead of time.
    * @param options - The observer options of the query to fetch.
    * @returns A promise that resolves with the result for the fetched query.
    * @example
    * ```ts
    * const result = await observer.fetchOptimistic({
    *   queryKey: ['posts', 2],
    *   queryFn: () => fetchPost(2),
    * })
    * console.log(result.data)
    * ```
    */
    fetchOptimistic(options) {
      const defaultedOptions = this.#client.defaultQueryOptions(options);
      const query = this.#client.getQueryCache().build(this.#client, defaultedOptions);
      let unsubscribe = () => {
      };
      let resolveEarly;
      const cachePromise = new Promise((resolve) => {
        resolveEarly = resolve;
        unsubscribe = this.#client.getQueryCache().subscribe((event) => {
          if (event.type === "updated" && event.query.queryHash === query.queryHash && query.state.data !== void 0) {
            unsubscribe();
            resolve(this.createResult(query, defaultedOptions));
          }
        });
      });
      return Promise.race([query.fetch(defaultedOptions).then(() => {
        const result = this.createResult(query, defaultedOptions);
        resolveEarly?.(result);
        return result;
      }).finally(() => {
        unsubscribe();
      }), cachePromise]);
    }
    /**
    * Fetches the observed query and updates the result once the fetch settles. Used by `refetch` and,
    * in `InfiniteQueryObserver`, to fetch more pages.
    * @param fetchOptions - Options for this fetch. `cancelRefetch` defaults to `true`.
    * @returns A promise that resolves with the updated result.
    */
    fetch(fetchOptions) {
      return this.#executeFetch({
        ...fetchOptions,
        cancelRefetch: fetchOptions.cancelRefetch ?? true
      }).then(() => {
        this.updateResult();
        return this.#currentResult;
      });
    }
    #executeFetch(fetchOptions) {
      this.#updateQuery();
      let promise = this.#currentQuery.fetch(this.options, fetchOptions);
      if (!fetchOptions?.throwOnError) promise = promise.catch(noop);
      return promise;
    }
    #shouldScheduleTimer(timeout) {
      return !isServer2() && resolveQueryValue(this.options.enabled, this.#currentQuery) !== false && isValidTimeout(timeout);
    }
    #updateStaleTimeout() {
      this.#clearStaleTimeout();
      const staleTime = resolveQueryValue(this.options.staleTime, this.#currentQuery);
      if (this.#currentResult.isStale || !this.#shouldScheduleTimer(staleTime)) return;
      const timeout = timeUntilStale(this.#currentResult.dataUpdatedAt, staleTime) + 1;
      this.#staleTimeoutId = timeoutManager.setTimeout(() => {
        if (!this.#currentResult.isStale) this.updateResult();
      }, timeout);
    }
    #computeRefetchInterval() {
      return resolveQueryValue(this.options.refetchInterval, this.#currentQuery) ?? false;
    }
    #updateRefetchInterval(nextInterval) {
      this.#clearRefetchInterval();
      this.#currentRefetchInterval = nextInterval;
      if (this.#currentRefetchInterval === 0 || !this.#shouldScheduleTimer(this.#currentRefetchInterval)) return;
      this.#refetchIntervalId = timeoutManager.setInterval(() => {
        if (this.options.refetchIntervalInBackground || focusManager.isFocused()) this.#executeFetch();
      }, this.#currentRefetchInterval);
    }
    #updateTimers() {
      this.#updateStaleTimeout();
      this.#updateRefetchInterval(this.#computeRefetchInterval());
    }
    #clearStaleTimeout() {
      if (this.#staleTimeoutId !== void 0) {
        timeoutManager.clearTimeout(this.#staleTimeoutId);
        this.#staleTimeoutId = void 0;
      }
    }
    #clearRefetchInterval() {
      if (this.#refetchIntervalId !== void 0) {
        timeoutManager.clearInterval(this.#refetchIntervalId);
        this.#refetchIntervalId = void 0;
      }
    }
    /**
    * Computes the result for a query and options from the query's state, applying `select`,
    * `placeholderData`, and the derived flags. Subclasses override it to add their own fields.
    * @param query - The query to compute the result for.
    * @param options - The observer options to compute the result with.
    * @returns The computed result.
    */
    createResult(query, options) {
      const prevQuery = this.#currentQuery;
      const prevOptions = this.options;
      const prevResult = this.#currentResult;
      const prevResultState = this.#currentResultState;
      const prevResultOptions = this.#currentResultOptions;
      const queryInitialState = query !== prevQuery ? query.state : this.#currentQueryInitialState;
      const { state } = query;
      let newState = { ...state };
      let isPlaceholderData = false;
      let data;
      if (options._optimisticResults) {
        const mounted = this.hasListeners();
        const fetchOnMount = !mounted && shouldFetchOnMount(query, options);
        const fetchOptionally = mounted && shouldFetchOptionally(query, prevQuery, options, prevOptions);
        if (fetchOnMount || fetchOptionally) newState = {
          ...newState,
          ...fetchState(state.data, query.options)
        };
        if (options._optimisticResults === "isRestoring") newState.fetchStatus = "idle";
      }
      let { error, errorUpdatedAt, status } = newState;
      data = newState.data;
      let skipSelect = false;
      if (options.placeholderData !== void 0 && data === void 0 && status === "pending") {
        let placeholderData;
        if (prevResult?.isPlaceholderData && options.placeholderData === prevResultOptions?.placeholderData) {
          placeholderData = prevResult.data;
          skipSelect = true;
        } else placeholderData = typeof options.placeholderData === "function" ? options.placeholderData(this.#lastQueryWithDefinedData?.state.data, this.#lastQueryWithDefinedData) : options.placeholderData;
        if (placeholderData !== void 0) {
          status = "success";
          data = replaceData(prevResult?.data, placeholderData, options);
          isPlaceholderData = true;
        }
      }
      if (options.select && data !== void 0 && !skipSelect) {
        if (prevResult && data === prevResultState?.data && options.select === this.#selectFn) data = this.#selectResult;
        else try {
          this.#selectFn = options.select;
          data = options.select(data);
          data = replaceData(prevResult?.data, data, options);
          this.#selectResult = data;
          this.#selectError = null;
        } catch (selectError) {
          this.#selectError = selectError;
        }
      } else if (data === void 0) this.#selectError = null;
      if (this.#selectError) {
        error = this.#selectError;
        data = this.#selectResult;
        errorUpdatedAt = Date.now();
        status = "error";
        isPlaceholderData = false;
      }
      const isFetching = newState.fetchStatus === "fetching";
      const isPending = status === "pending";
      const isError = status === "error";
      const isLoading = isPending && isFetching;
      const hasData = data !== void 0;
      return {
        status,
        fetchStatus: newState.fetchStatus,
        isPending,
        isSuccess: status === "success",
        isError,
        isInitialLoading: isLoading,
        isLoading,
        data,
        dataUpdatedAt: newState.dataUpdatedAt,
        error,
        errorUpdatedAt,
        failureCount: newState.fetchFailureCount,
        failureReason: newState.fetchFailureReason,
        errorUpdateCount: newState.errorUpdateCount,
        isFetched: query.isFetched(),
        isFetchedAfterMount: newState.dataUpdateCount > queryInitialState.dataUpdateCount || newState.errorUpdateCount > queryInitialState.errorUpdateCount,
        isFetching,
        isRefetching: isFetching && !isPending,
        isLoadingError: isError && !hasData,
        isPaused: newState.fetchStatus === "paused",
        isPlaceholderData,
        isRefetchError: isError && hasData,
        isStale: isStale(query, options),
        refetch: this.refetch,
        isEnabled: resolveQueryValue(options.enabled, query) !== false
      };
    }
    /**
    * Recomputes and stores the current result from the current query/options, notifying listeners
    * if it changed. Framework adapters call this right after subscribing to make sure no query
    * update was missed in the gap between creating the observer and subscribing to it.
    */
    updateResult() {
      const prevResult = this.#currentResult;
      const nextResult = this.createResult(this.#currentQuery, this.options);
      this.#currentResultState = this.#currentQuery.state;
      this.#currentResultOptions = this.options;
      if (this.#currentResultState.data !== void 0) this.#lastQueryWithDefinedData = this.#currentQuery;
      if (shallowEqualObjects(nextResult, prevResult)) return;
      this.#currentResult = nextResult;
      const shouldNotifyListeners = () => {
        if (!prevResult) return true;
        const { notifyOnChangeProps } = this.options;
        const notifyOnChangePropsValue = typeof notifyOnChangeProps === "function" ? notifyOnChangeProps() : notifyOnChangeProps;
        if (notifyOnChangePropsValue === "all" || !notifyOnChangePropsValue && !this.#trackedProps.size) return true;
        const includedProps = new Set(notifyOnChangePropsValue ?? this.#trackedProps);
        if (this.options.throwOnError) includedProps.add("error");
        return Object.keys(this.#currentResult).some((key) => {
          const typedKey = key;
          return this.#currentResult[typedKey] !== prevResult[typedKey] && includedProps.has(typedKey);
        });
      };
      const notifyListeners = shouldNotifyListeners();
      notifyManager.batch(() => {
        if (notifyListeners) this.listeners.forEach((listener) => {
          listener(this.#currentResult);
        });
        this.#client.getQueryCache().notify({
          query: this.#currentQuery,
          type: "observerResultsUpdated"
        });
      });
    }
    #updateQuery() {
      const query = this.#client.getQueryCache().build(this.#client, this.options);
      if (query === this.#currentQuery) return;
      const prevQuery = this.#currentQuery;
      this.#currentQuery = query;
      this.#currentQueryInitialState = query.state;
      if (this.hasListeners()) {
        prevQuery?.removeObserver(this);
        query.addObserver(this);
      }
    }
    /**
    * Updates the observer's result when the observed query changes, and reschedules its timers if it
    * has listeners.
    * @internal
    */
    onQueryUpdate() {
      this.updateResult();
      if (this.hasListeners()) this.#updateTimers();
    }
  };
  function shouldLoadOnMount(query, options) {
    return resolveQueryValue(options.enabled, query) !== false && query.state.data === void 0 && !(query.state.status === "error" && resolveQueryValue(options.retryOnMount, query) === false);
  }
  function shouldFetchOnMount(query, options) {
    return shouldLoadOnMount(query, options) || query.state.data !== void 0 && shouldFetchOn(query, options, options.refetchOnMount);
  }
  function shouldFetchOn(query, options, field) {
    if (resolveQueryValue(options.enabled, query) !== false && resolveQueryValue(options.staleTime, query) !== "static") {
      const value = resolveQueryValue(field, query);
      return value === "always" || value !== false && isStale(query, options);
    }
    return false;
  }
  function shouldFetchOptionally(query, prevQuery, options, prevOptions) {
    return (query !== prevQuery || resolveQueryValue(prevOptions.enabled, query) === false) && (!options.suspense || query.state.status !== "error") && isStale(query, options);
  }
  function isStale(query, options) {
    return resolveQueryValue(options.enabled, query) !== false && query.isStaleByTime(resolveQueryValue(options.staleTime, query));
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/infiniteQueryObserver.js
  var InfiniteQueryObserver = class extends QueryObserver {
    constructor(client, options) {
      super(client, options);
    }
    bindMethods() {
      super.bindMethods();
      this.fetchNextPage = this.fetchNextPage.bind(this);
      this.fetchPreviousPage = this.fetchPreviousPage.bind(this);
    }
    /**
    * Updates the observer's options. Behaves the same as
    * `QueryObserver.setOptions`, additionally marking the options as
    * belonging to an infinite query before delegating to the base
    * implementation.
    * @param options - The new infinite query observer options.
    */
    setOptions(options) {
      options._type = "infinite";
      super.setOptions(options);
    }
    /**
    * The infinite-query counterpart of {@link QueryObserver#getOptimisticResult}, marking the
    * options as an infinite query before delegating to it. Called by framework adapters (e.g.
    * `useInfiniteQuery`) ahead of subscribing, to compute the current `InfiniteQueryObserverResult`
    * synchronously.
    * @param options - The defaulted infinite query observer options to compute the result for.
    * @returns The result for the given options.
    */
    getOptimisticResult(options) {
      options._type = "infinite";
      return super.getOptimisticResult(options);
    }
    /**
    * Fetches the next page of the infinite query and returns a promise that
    * resolves with the resulting `InfiniteQueryObserverResult`. The page
    * param used for the fetch is determined by `getNextPageParam`, which
    * receives the current pages/page params and whose result also determines
    * `hasNextPage`.
    * @param options - Set `cancelRefetch` to `false` to ignore the call while a fetch is running,
    * and `throwOnError` to `true` to reject when the fetch fails.
    * @returns A promise that resolves with the result after the next page is fetched. With
    * `cancelRefetch: false`, a running fetch is reused instead, so the next page may not be fetched.
    * @see {@link InfiniteQueryObserver#fetchPreviousPage}
    * @example
    * ```ts
    * const { hasNextPage } = observer.getCurrentResult()
    *
    * if (hasNextPage) {
    *   await observer.fetchNextPage()
    * }
    * ```
    */
    fetchNextPage(options) {
      return this.fetch({
        ...options,
        meta: { fetchMore: { direction: "forward" } }
      });
    }
    /**
    * Fetches the previous page of the infinite query and returns a promise
    * that resolves with the resulting `InfiniteQueryObserverResult`. The page
    * param used for the fetch is determined by `getPreviousPageParam`, which
    * receives the current pages/page params and whose result also determines
    * `hasPreviousPage`.
    * @param options - Set `cancelRefetch` to `false` to ignore the call while a fetch is running,
    * and `throwOnError` to `true` to reject when the fetch fails.
    * @returns A promise that resolves with the result after the previous page is fetched. With
    * `cancelRefetch: false`, a running fetch is reused instead, so the previous page may not be fetched.
    * @see {@link InfiniteQueryObserver#fetchNextPage}
    * @example
    * ```ts
    * const { hasPreviousPage } = observer.getCurrentResult()
    *
    * if (hasPreviousPage) {
    *   await observer.fetchPreviousPage()
    * }
    * ```
    */
    fetchPreviousPage(options) {
      return this.fetch({
        ...options,
        meta: { fetchMore: { direction: "backward" } }
      });
    }
    createResult(query, options) {
      const { state } = query;
      const parentResult = super.createResult(query, options);
      const { isFetching, isRefetching, isError, isRefetchError } = parentResult;
      const fetchDirection = state.fetchMeta?.fetchMore?.direction;
      const isFetchNextPageError = isError && fetchDirection === "forward";
      const isFetchingNextPage = isFetching && fetchDirection === "forward";
      const isFetchPreviousPageError = isError && fetchDirection === "backward";
      const isFetchingPreviousPage = isFetching && fetchDirection === "backward";
      return {
        ...parentResult,
        fetchNextPage: this.fetchNextPage,
        fetchPreviousPage: this.fetchPreviousPage,
        hasNextPage: hasNextPage(options, state.data),
        hasPreviousPage: hasPreviousPage(options, state.data),
        isFetchNextPageError,
        isFetchingNextPage,
        isFetchPreviousPageError,
        isFetchingPreviousPage,
        isRefetchError: isRefetchError && !isFetchNextPageError && !isFetchPreviousPageError,
        isRefetching: isRefetching && !isFetchingNextPage && !isFetchingPreviousPage
      };
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/mutation.js
  var Mutation = class extends Removable {
    #client;
    #observers;
    #mutationCache;
    #retryer;
    constructor(config) {
      super();
      this.#client = config.client;
      this.mutationId = config.mutationId;
      this.#mutationCache = config.mutationCache;
      this.#observers = [];
      this.state = config.state || getDefaultState2();
      this.setOptions(config.options);
      this.scheduleGc();
    }
    /**
    * Replaces the mutation's options and applies their `gcTime`.
    * @internal
    * @param options - The new mutation options.
    */
    setOptions(options) {
      this.options = options;
      this.updateGcTime(this.options.gcTime);
    }
    /**
    * The `meta` object passed in the mutation's options, if any.
    * @returns The mutation's `meta`, or `undefined` if none was set.
    */
    get meta() {
      return this.options.meta;
    }
    /**
    * Subscribes an observer to the mutation and stops its garbage collection.
    * @internal
    * @param observer - The observer to add. Adding an observer that is already subscribed does
    * nothing.
    */
    addObserver(observer) {
      if (!this.#observers.includes(observer)) {
        this.#observers.push(observer);
        this.clearGcTimeout();
        this.#mutationCache.notify({
          type: "observerAdded",
          mutation: this,
          observer
        });
      }
    }
    /**
    * Unsubscribes an observer from the mutation.
    * @internal
    * @param observer - The observer to remove. Garbage collection is scheduled afterwards.
    */
    removeObserver(observer) {
      this.#observers = this.#observers.filter((x) => x !== observer);
      this.scheduleGc();
      this.#mutationCache.notify({
        type: "observerRemoved",
        mutation: this,
        observer
      });
    }
    optionalRemove() {
      if (!this.#observers.length) {
        if (this.state.status === "pending") this.scheduleGc();
        else this.#mutationCache.remove(this);
      }
    }
    /**
    * Resumes a mutation that is currently paused or was restored from a
    * dehydrated, still-`pending` state.
    *
    * - If this mutation has an active retryer (it paused mid-attempt, e.g. due
    *   to the network mode or scope-based queuing), its retryer is resumed.
    * - Otherwise, if the mutation's status is still `pending` (e.g. it was
    *   dehydrated while an attempt was in flight and never got a retryer in
    *   this instance), `execute` is called again with the last known variables.
    * - Otherwise the mutation has already settled and this resolves immediately
    *   without running anything again.
    * @returns A promise that settles with the resumed mutation: it rejects if the mutation fails.
    * It resolves immediately if the mutation has already settled.
    * @see {@link Mutation#execute}
    * @example
    * ```ts
    * // typically driven by reconnect handling, e.g. queryClient.resumePausedMutations()
    * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
    * await mutation?.continue()
    * ```
    */
    continue() {
      return this.#retryer?.continue() ?? (this.state.status === "pending" ? this.execute(this.state.variables) : Promise.resolve());
    }
    /**
    * Runs the mutation function for the given variables through a retryer, and
    * drives the mutation's state and lifecycle callbacks through to settlement.
    *
    * If this mutation's state is already `pending` when `execute` is called
    * (i.e. it was restored, still in-flight, from a dehydrated state), the
    * `onMutate` step is skipped and a `continue` action is dispatched to
    * unpause it; otherwise a `pending` action is dispatched first, then the
    * mutation cache's `onMutate` and the mutation's own `onMutate` option are
    * awaited in that order, and the resulting context is stored.
    *
    * The mutation function is then run (subject to `retry`/`retryDelay`/
    * `networkMode`, and to the mutation cache's scope-based serialization).
    * On success, the cache's `onSuccess`/`onSettled` callbacks run before the
    * mutation's own `onSuccess`/`onSettled` options, a `success` action is
    * dispatched, and the resolved data is returned. On failure, the same
    * cache-then-option ordering is used for `onError`/`onSettled`, but each of
    * those four callbacks is individually caught so that a throwing callback
    * cannot mask the original error; an `error` action is then dispatched and
    * the original error is re-thrown.
    * @param variables - The variables passed to the `mutationFn`.
    * @returns A promise that resolves with the mutation's data, or rejects with its error.
    * @see {@link Mutation#continue}
    * @example
    * ```ts
    * // Called internally by `MutationObserver.mutate` and `Mutation.continue` —
    * // applications normally trigger mutations through those, not this method.
    * const data = await mutation.execute(variables)
    * ```
    */
    async execute(variables) {
      const onContinue = () => {
        this.#dispatch({ type: "continue" });
      };
      const mutationFnContext = {
        client: this.#client,
        meta: this.options.meta,
        mutationKey: this.options.mutationKey
      };
      const retryer = this.#retryer = createRetryer({
        fn: () => {
          if (!this.options.mutationFn) return Promise.reject(/* @__PURE__ */ new Error("No mutationFn found"));
          return this.options.mutationFn(variables, mutationFnContext);
        },
        onFail: (failureCount, error) => {
          this.#dispatch({
            type: "failed",
            failureCount,
            error
          });
        },
        onPause: () => {
          this.#dispatch({ type: "pause" });
        },
        onContinue,
        retry: this.options.retry ?? 0,
        retryDelay: this.options.retryDelay,
        networkMode: this.options.networkMode,
        canRun: () => this.#mutationCache.canRun(this)
      });
      const restored = this.state.status === "pending";
      const isPaused = !retryer.canStart();
      try {
        if (restored) onContinue();
        else {
          this.#dispatch({
            type: "pending",
            variables,
            isPaused
          });
          if (this.#mutationCache.config.onMutate) await this.#mutationCache.config.onMutate(variables, this, mutationFnContext);
          const context = await this.options.onMutate?.(variables, mutationFnContext);
          if (context !== this.state.context) this.#dispatch({
            type: "pending",
            context,
            variables,
            isPaused
          });
        }
        const data = await retryer.start();
        await this.#mutationCache.config.onSuccess?.(data, variables, this.state.context, this, mutationFnContext);
        await this.options.onSuccess?.(data, variables, this.state.context, mutationFnContext);
        await this.#mutationCache.config.onSettled?.(data, null, this.state.variables, this.state.context, this, mutationFnContext);
        await this.options.onSettled?.(data, null, variables, this.state.context, mutationFnContext);
        this.#dispatch({
          type: "success",
          data
        });
        return data;
      } catch (error) {
        try {
          await this.#mutationCache.config.onError?.(error, variables, this.state.context, this, mutationFnContext);
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.options.onError?.(error, variables, this.state.context, mutationFnContext);
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.#mutationCache.config.onSettled?.(void 0, error, this.state.variables, this.state.context, this, mutationFnContext);
        } catch (e) {
          Promise.reject(e);
        }
        try {
          await this.options.onSettled?.(void 0, error, variables, this.state.context, mutationFnContext);
        } catch (e) {
          Promise.reject(e);
        }
        this.#dispatch({
          type: "error",
          error
        });
        throw error;
      } finally {
        if (this.#retryer === retryer) this.#retryer = void 0;
        this.#mutationCache.runNext(this);
      }
    }
    #dispatch(action) {
      const reducer = (state) => {
        switch (action.type) {
          case "failed":
            return {
              ...state,
              failureCount: action.failureCount,
              failureReason: action.error
            };
          case "pause":
            return {
              ...state,
              isPaused: true
            };
          case "continue":
            return {
              ...state,
              isPaused: false
            };
          case "pending":
            return {
              ...state,
              context: action.context,
              data: void 0,
              failureCount: 0,
              failureReason: null,
              error: null,
              isPaused: action.isPaused,
              status: "pending",
              variables: action.variables,
              submittedAt: Date.now()
            };
          case "success":
            return {
              ...state,
              data: action.data,
              failureCount: 0,
              failureReason: null,
              error: null,
              status: "success",
              isPaused: false
            };
          case "error":
            return {
              ...state,
              data: void 0,
              error: action.error,
              failureCount: state.failureCount + 1,
              failureReason: action.error,
              isPaused: false,
              status: "error"
            };
        }
      };
      this.state = reducer(this.state);
      notifyManager.batch(() => {
        this.#observers.forEach((observer) => {
          observer.onMutationUpdate(action);
        });
        this.#mutationCache.notify({
          mutation: this,
          type: "updated",
          action
        });
      });
    }
  };
  function getDefaultState2() {
    return {
      context: void 0,
      data: void 0,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: "idle",
      variables: void 0,
      submittedAt: 0
    };
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/mutationCache.js
  var MutationCache = class extends Subscribable {
    #mutations;
    #scopes;
    #mutationId;
    constructor(config = {}) {
      super();
      this.config = config;
      this.#mutations = /* @__PURE__ */ new Set();
      this.#scopes = /* @__PURE__ */ new Map();
      this.#mutationId = 0;
    }
    /**
    * Creates a mutation and adds it to the cache.
    * @internal
    * @param client - The client the mutation belongs to, used to default its options.
    * @param options - The mutation options. They are defaulted with {@link
    * QueryClient#defaultMutationOptions}.
    * @param state - The initial state of the mutation, e.g. when restoring a dehydrated mutation.
    * @returns The new mutation, already added to the cache.
    */
    build(client, options, state) {
      const mutation = new Mutation({
        client,
        mutationCache: this,
        mutationId: ++this.#mutationId,
        options: client.defaultMutationOptions(options),
        state
      });
      this.add(mutation);
      return mutation;
    }
    /**
    * Adds a mutation to the cache.
    * @internal
    * @param mutation - The mutation to add. If it has a `scope`, it is queued in that scope.
    */
    add(mutation) {
      this.#mutations.add(mutation);
      const scope = scopeFor(mutation);
      if (typeof scope === "string") {
        const scopedMutations = this.#scopes.get(scope);
        if (scopedMutations) scopedMutations.push(mutation);
        else this.#scopes.set(scope, [mutation]);
      }
      this.notify({
        type: "added",
        mutation
      });
    }
    /**
    * Removes a mutation from the cache.
    * @internal
    * @param mutation - The mutation to remove, also from its scope's queue.
    */
    remove(mutation) {
      if (this.#mutations.delete(mutation)) {
        const scope = scopeFor(mutation);
        if (typeof scope === "string") {
          const scopedMutations = this.#scopes.get(scope);
          if (scopedMutations) {
            if (scopedMutations.length > 1) {
              const index = scopedMutations.indexOf(mutation);
              if (index !== -1) scopedMutations.splice(index, 1);
            } else if (scopedMutations[0] === mutation) this.#scopes.delete(scope);
          }
        }
      }
      this.notify({
        type: "removed",
        mutation
      });
    }
    /**
    * Checks whether a mutation can run now, given the other mutations in its `scope`.
    * @internal
    * @param mutation - The mutation to check.
    * @returns `true` if the mutation has no `scope`, or no other mutation in its scope is pending
    * ahead of it.
    */
    canRun(mutation) {
      const scope = scopeFor(mutation);
      if (typeof scope === "string") {
        const firstPendingMutation = this.#scopes.get(scope)?.find((m) => m.state.status === "pending");
        return !firstPendingMutation || firstPendingMutation === mutation;
      } else return true;
    }
    /**
    * Continues the next paused mutation in the same `scope` after a mutation finishes.
    * @internal
    * @param mutation - The mutation that finished.
    * @returns A promise that resolves once the next paused mutation in the same scope has continued,
    * or immediately if there is none.
    */
    runNext(mutation) {
      const scope = scopeFor(mutation);
      if (typeof scope === "string") return this.#scopes.get(scope)?.find((m) => m !== mutation && m.state.isPaused)?.continue() ?? Promise.resolve();
      else return Promise.resolve();
    }
    /**
    * Removes all mutations from the cache.
    * @example
    * ```ts
    * const mutationCache = queryClient.getMutationCache()
    *
    * mutationCache.clear()
    * ```
    */
    clear() {
      notifyManager.batch(() => {
        const mutations = this.getAll();
        this.#mutations.clear();
        this.#scopes.clear();
        mutations.forEach((mutation) => {
          this.notify({
            type: "removed",
            mutation
          });
        });
      });
    }
    /**
    * Returns all mutations within the cache.
    *
    * This is not typically needed for most applications, but can come in handy when needing more
    * information about a mutation in rare scenarios.
    * @returns Every mutation in the cache.
    * @example
    * ```ts
    * const mutationCache = queryClient.getMutationCache()
    *
    * const mutations = mutationCache.getAll()
    * ```
    */
    getAll() {
      return Array.from(this.#mutations);
    }
    /**
    * A slightly more advanced method that can be used to get an existing mutation instance from
    * the cache. If the mutation does not exist, `undefined` is returned.
    *
    * This is not typically needed for most applications, but can come in handy when needing more
    * information about a mutation in rare scenarios.
    * @param filters - The filters to match. `exact` defaults to `true`.
    * @returns The first matching mutation, or `undefined`.
    * @see {@link MutationCache#findAll}
    * @example
    * ```ts
    * const mutationCache = queryClient.getMutationCache()
    *
    * const mutation = mutationCache.find({ mutationKey: ['addPost'] })
    * ```
    */
    find(filters) {
      const defaultedFilters = {
        exact: true,
        ...filters
      };
      return this.getAll().find((mutation) => matchMutation(defaultedFilters, mutation));
    }
    /**
    * An even more advanced method that can be used to get existing mutation instances from the
    * cache that match the given filters. If no mutations match, an empty array is returned.
    *
    * This is not typically needed for most applications, but can come in handy when needing more
    * information about mutations in rare scenarios.
    * @param filters - The filters to match. Without filters, every mutation is returned.
    * @returns The matching mutations.
    * @see {@link MutationCache#find}
    * @example
    * ```ts
    * const mutationCache = queryClient.getMutationCache()
    *
    * const mutations = mutationCache.findAll({ mutationKey: ['addPost'] })
    * ```
    */
    findAll(filters = {}) {
      return this.getAll().filter((mutation) => matchMutation(filters, mutation));
    }
    /**
    * Notifies every cache listener of an event, in one batch.
    * @internal
    * @param event - The event passed to every listener.
    */
    notify(event) {
      notifyManager.batch(() => {
        this.listeners.forEach((listener) => {
          listener(event);
        });
      });
    }
    /**
    * Continues every paused mutation, e.g. when the app comes back online.
    * @internal
    * @returns A promise that resolves once every paused mutation has continued and settled.
    */
    resumePausedMutations() {
      const pausedMutations = this.getAll().filter((x) => x.state.isPaused);
      return notifyManager.batch(() => Promise.all(pausedMutations.map((mutation) => mutation.continue().catch(noop))));
    }
  };
  function scopeFor(mutation) {
    return mutation.options.scope?.id;
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/mutationObserver.js
  var MutationObserver = class extends Subscribable {
    #client;
    #currentResult = void 0;
    #currentMutation;
    #mutateOptions;
    constructor(client, options) {
      super();
      this.#client = client;
      this.setOptions(options);
      this.bindMethods();
      this.#updateResult();
    }
    /**
    * Binds the methods of the result (`mutate` and `reset`) to the observer, so they keep working when
    * destructured from it.
    */
    bindMethods() {
      this.mutate = this.mutate.bind(this);
      this.reset = this.reset.bind(this);
    }
    /**
    * Updates the observer's options.
    *
    * If the new `mutationKey` differs from the previous one (and both were
    * defined), the observer is reset, detaching it from the mutation it was
    * observing. Otherwise, if the currently observed mutation is still
    * `pending`, its options are updated in place as well.
    * @param options - The new mutation observer options. They are defaulted with {@link
    * QueryClient#defaultMutationOptions} before being applied.
    * @example
    * ```ts
    * observer.setOptions({
    *   mutationFn: (variables: { title: string }) => addPost(variables),
    *   onSuccess: (data) => console.log(data),
    * })
    * ```
    */
    setOptions(options) {
      const prevOptions = this.options;
      this.options = this.#client.defaultMutationOptions(options);
      if (!shallowEqualObjects(this.options, prevOptions)) this.#client.getMutationCache().notify({
        type: "observerOptionsUpdated",
        mutation: this.#currentMutation,
        observer: this
      });
      if (prevOptions?.mutationKey && this.options.mutationKey && hashKey(prevOptions.mutationKey) !== hashKey(this.options.mutationKey)) this.reset();
      else if (this.#currentMutation?.state.status === "pending") this.#currentMutation.setOptions(this.options);
    }
    onSubscribe() {
      if (this.listeners.size === 1 && this.#currentMutation) {
        this.#currentMutation.addObserver(this);
        this.#updateResult();
      }
    }
    onUnsubscribe() {
      if (!this.hasListeners()) this.#currentMutation?.removeObserver(this);
    }
    /**
    * Updates the observer's result when the observed mutation changes, and notifies its listeners.
    * @internal
    * @param action - The action that updated the observed mutation, passed on to the observer's
    * callbacks.
    */
    onMutationUpdate(action) {
      this.#updateResult();
      this.#notify(action);
    }
    /**
    * Returns the observer's current result, derived from the observed
    * mutation's state (or the default, `idle` state if no mutation has been
    * built yet, e.g. before the first `mutate()` call or after `reset()`).
    * @returns The observer's latest result.
    */
    getCurrentResult() {
      return this.#currentResult;
    }
    /**
    * Detaches the observer from the mutation it is currently observing (if
    * any) and resets the observed result back to its default, `idle` state.
    *
    * This does not cancel an in-flight mutation; the mutation itself keeps
    * running to completion and its own callbacks still fire, but this
    * observer stops reflecting its state and a subsequent `mutate()` call
    * will build a brand new mutation.
    * @see {@link MutationObserver#mutate}
    * @example
    * ```ts
    * observer.reset()
    * ```
    */
    reset() {
      this.#currentMutation?.removeObserver(this);
      this.#currentMutation = void 0;
      this.#updateResult();
      this.#notify();
    }
    /**
    * Builds a new `Mutation` in the `MutationCache` using the observer's
    * current options, detaches this observer from any previously observed
    * mutation, attaches it to the new one, and executes it with the given
    * variables.
    *
    * The optional per-call `options` (`onSuccess`/`onError`/`onSettled`) are
    * invoked once the mutation settles, in addition to any callbacks defined
    * on the observer's own options.
    * @param variables - The variables passed to the `mutationFn`.
    * @param options - Per-call `onSuccess`, `onError`, and `onSettled` callbacks.
    * @returns A promise that resolves with the mutation's data, or rejects with its error.
    * @example
    * ```ts
    * await observer.mutate(
    *   { title: 'New post' },
    *   { onSuccess: (data) => console.log(data) },
    * )
    * ```
    */
    mutate(variables, options) {
      this.#mutateOptions = options;
      this.#currentMutation?.removeObserver(this);
      this.#currentMutation = this.#client.getMutationCache().build(this.#client, this.options);
      this.#currentMutation.addObserver(this);
      return this.#currentMutation.execute(variables);
    }
    #updateResult() {
      const state = this.#currentMutation?.state ?? getDefaultState2();
      this.#currentResult = {
        ...state,
        isPending: state.status === "pending",
        isSuccess: state.status === "success",
        isError: state.status === "error",
        isIdle: state.status === "idle",
        mutate: this.mutate,
        reset: this.reset
      };
    }
    #notify(action) {
      notifyManager.batch(() => {
        const mutateOptions = this.#mutateOptions;
        if (mutateOptions && this.hasListeners()) {
          const variables = this.#currentResult.variables;
          const onMutateResult = this.#currentResult.context;
          const context = {
            client: this.#client,
            meta: this.options.meta,
            mutationKey: this.options.mutationKey
          };
          if (action?.type === "success") {
            try {
              mutateOptions.onSuccess?.(action.data, variables, onMutateResult, context);
            } catch (e) {
              Promise.reject(e);
            }
            try {
              mutateOptions.onSettled?.(action.data, null, variables, onMutateResult, context);
            } catch (e) {
              Promise.reject(e);
            }
          } else if (action?.type === "error") {
            try {
              mutateOptions.onError?.(action.error, variables, onMutateResult, context);
            } catch (e) {
              Promise.reject(e);
            }
            try {
              mutateOptions.onSettled?.(void 0, action.error, variables, onMutateResult, context);
            } catch (e) {
              Promise.reject(e);
            }
          }
        }
        this.listeners.forEach((listener) => {
          listener(this.#currentResult);
        });
      });
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/queriesObserver.js
  function difference(array1, array2) {
    const excludeSet = new Set(array2);
    return array1.filter((x) => !excludeSet.has(x));
  }
  var QueriesObserver = class extends Subscribable {
    #client;
    #result;
    #queries;
    #options;
    #observers;
    #combinedResult;
    #lastCombine;
    #lastResult;
    #lastQueryHashes;
    #observerMatches = [];
    constructor(client, queries, options) {
      super();
      this.#client = client;
      this.#options = options;
      this.#queries = [];
      this.#observers = [];
      this.#result = [];
      this.setQueries(queries);
    }
    onSubscribe() {
      if (this.listeners.size === 1) this.#observers.forEach((observer) => {
        observer.subscribe((result) => {
          this.#onUpdate(observer, result);
        });
      });
    }
    onUnsubscribe() {
      if (!this.listeners.size) this.destroy();
    }
    /**
    * Stops observing all queries: clears all listeners and destroys every
    * underlying `QueryObserver` this observer manages.
    */
    destroy() {
      this.listeners = /* @__PURE__ */ new Set();
      this.#observers.forEach((observer) => {
        observer.destroy();
      });
    }
    /**
    * Replaces the set of queries being observed. Existing `QueryObserver`s
    * are reused for queries that match an already-observed query hash;
    * observers for queries that are no longer present are destroyed, and new
    * observers are created and subscribed to for newly added queries.
    * @param queries - The options of the queries to observe.
    * @param options - Replaces the observer's options, e.g. its `combine` function.
    * @example
    * ```ts
    * observer.setQueries([
    *   { queryKey: ['post', 1], queryFn: fetchPost },
    *   { queryKey: ['post', 3], queryFn: fetchPost },
    * ])
    * ```
    */
    setQueries(queries, options) {
      this.#queries = queries;
      this.#options = options;
      if (false) {
        const queryHashes = queries.map((query) => this.#client.defaultQueryOptions(query).queryHash);
        if (new Set(queryHashes).size !== queryHashes.length) console.warn("[QueriesObserver]: Duplicate Queries found. This might result in unexpected behavior.");
      }
      notifyManager.batch(() => {
        const prevObservers = this.#observers;
        const newObserverMatches = this.#findMatchingObservers(this.#queries);
        newObserverMatches.forEach((match) => match.observer.setOptions(match.defaultedQueryOptions));
        const newObservers = newObserverMatches.map((match) => match.observer);
        const newResult = newObservers.map((observer) => observer.getCurrentResult());
        const hasLengthChange = prevObservers.length !== newObservers.length;
        const hasIndexChange = newObservers.some((observer, index) => observer !== prevObservers[index]);
        const hasStructuralChange = hasLengthChange || hasIndexChange;
        const hasResultChange = hasStructuralChange ? true : newResult.some((result, index) => {
          const prev = this.#result[index];
          return !prev || !shallowEqualObjects(result, prev);
        });
        if (!hasStructuralChange && !hasResultChange) return;
        if (hasStructuralChange) {
          this.#observerMatches = newObserverMatches;
          this.#observers = newObservers;
        }
        this.#result = newResult;
        if (!this.hasListeners()) return;
        if (hasStructuralChange) {
          difference(prevObservers, newObservers).forEach((observer) => {
            observer.destroy();
          });
          difference(newObservers, prevObservers).forEach((observer) => {
            observer.subscribe((result) => {
              this.#onUpdate(observer, result);
            });
          });
        }
        this.#notify();
      });
    }
    /**
    * Returns the most recently computed array of `QueryObserverResult`s, one
    * per observed query, in the same order as the queries passed to the
    * constructor or `setQueries`.
    * @returns The current results.
    * @example
    * ```ts
    * const results = observer.getCurrentResult()
    * const data = results.map((result) => result.data)
    * ```
    */
    getCurrentResult() {
      return this.#result;
    }
    /**
    * Returns the underlying `Query` instances currently being observed, in
    * the same order as the queries passed to the constructor or `setQueries`.
    * @returns The observed queries.
    */
    getQueries() {
      return this.#observers.map((observer) => observer.getCurrentQuery());
    }
    /**
    * Returns the underlying `QueryObserver` instances this observer manages,
    * in the same order as the queries passed to the constructor or
    * `setQueries`.
    * @returns The managed query observers.
    */
    getObservers() {
      return this.#observers;
    }
    /**
    * The `QueriesObserver` counterpart of {@link QueryObserver#getOptimisticResult} — computes
    * the result for the given (already-defaulted) queries right now, synchronously. Called by
    * framework adapters (e.g. `useQueries`) ahead of subscribing, returning a tuple of the raw
    * per-query results, a function to compute the combined result from them, and a function to
    * wrap the results for property-access tracking.
    * @param queries - The defaulted options of the queries to compute the result for.
    * @param combine - The `combine` function used by the returned `combineResult`, if any.
    * @returns A tuple of the per-query results, a function that computes the combined result, and a
    * function that returns the results wrapped for property-access tracking.
    */
    getOptimisticResult(queries, combine) {
      const matches = this.#findMatchingObservers(queries);
      const result = matches.map((match) => match.observer.getOptimisticResult(match.defaultedQueryOptions));
      const queryHashes = matches.map((match) => match.defaultedQueryOptions.queryHash);
      return [
        result,
        (r) => {
          return this.#combineResult(r ?? result, combine, queryHashes);
        },
        () => {
          return this.#trackResult(result, matches);
        }
      ];
    }
    #trackResult(result, matches) {
      const trackedProps = /* @__PURE__ */ new Set();
      return matches.map((match, index) => {
        const observerResult = result[index];
        return !match.defaultedQueryOptions.notifyOnChangeProps ? match.observer.trackResult(observerResult, (accessedProp) => {
          if (!trackedProps.has(accessedProp)) {
            trackedProps.add(accessedProp);
            matches.forEach((m) => {
              m.observer.trackProp(accessedProp);
            });
          }
        }) : observerResult;
      });
    }
    #combineResult(input, combine, queryHashes) {
      if (combine) {
        const lastHashes = this.#lastQueryHashes;
        const queryHashesChanged = queryHashes !== void 0 && lastHashes !== void 0 && (lastHashes.length !== queryHashes.length || queryHashes.some((hash, i) => hash !== lastHashes[i]));
        if (this.#result !== this.#lastResult || queryHashesChanged || combine !== this.#lastCombine) {
          this.#lastCombine = combine;
          this.#lastResult = this.#result;
          if (queryHashes !== void 0) this.#lastQueryHashes = queryHashes;
          this.#combinedResult = replaceEqualDeep(this.#combinedResult, combine(input));
        }
        return this.#combinedResult;
      }
      return input;
    }
    #shouldSkipCombine() {
      return !this.#options?.combine || this.#observers.some((observer, index) => {
        return observer.options.suspense && this.#result[index]?.data === void 0;
      });
    }
    #findMatchingObservers(queries) {
      const prevObserversMap = /* @__PURE__ */ new Map();
      this.#observers.forEach((observer) => {
        const key = observer.options.queryHash;
        if (!key) return;
        const previousObservers = prevObserversMap.get(key);
        if (previousObservers) previousObservers.push(observer);
        else prevObserversMap.set(key, [observer]);
      });
      const observers = [];
      queries.forEach((options) => {
        const defaultedOptions = this.#client.defaultQueryOptions(options);
        const observer = prevObserversMap.get(defaultedOptions.queryHash)?.shift() ?? new QueryObserver(this.#client, defaultedOptions);
        observers.push({
          defaultedQueryOptions: defaultedOptions,
          observer
        });
      });
      return observers;
    }
    #onUpdate(observer, result) {
      const index = this.#observers.indexOf(observer);
      if (index !== -1) {
        this.#result = this.#result.slice();
        this.#result[index] = result;
        this.#notify();
      }
    }
    #notify() {
      if (this.hasListeners()) {
        const shouldSkipCombine = this.#shouldSkipCombine();
        const previousResult = this.#combinedResult;
        const newResult = shouldSkipCombine ? previousResult : this.#combineResult(this.#trackResult(this.#result, this.#observerMatches), this.#options?.combine);
        if (shouldSkipCombine || previousResult !== newResult) notifyManager.batch(() => {
          this.listeners.forEach((listener) => {
            listener(this.#result);
          });
        });
      }
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/queryCache.js
  var QueryCache = class extends Subscribable {
    #queries;
    constructor(config = {}) {
      super();
      this.config = config;
      this.#queries = /* @__PURE__ */ new Map();
    }
    /**
    * Returns the existing `Query` instance for the given options' `queryKey`/`queryHash`, or
    * builds and adds a new one to the cache if none exists yet. Used by framework adapters and
    * plugins (e.g. broadcast/persistence) that need to get-or-create a `Query` directly, bypassing
    * the reactive `QueryObserver` machinery.
    * @param client - The client the query belongs to, used to default its options.
    * @param options - The query options, including the `queryKey`. A new query is created with the
    * options defaulted by {@link QueryClient#defaultQueryOptions}.
    * @param state - The initial state of a newly created query, e.g. when hydrating. Ignored if the
    * query already exists.
    * @returns The existing or newly created query.
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    *
    * const query = queryCache.build(queryClient, {
    *   queryKey: ['posts'],
    *   queryFn: fetchPosts,
    * })
    * ```
    */
    build(client, options, state) {
      const queryKey = options.queryKey;
      const queryHash = options.queryHash ?? hashQueryKeyByOptions(queryKey, options);
      let query = this.get(queryHash);
      if (!query) {
        query = new Query({
          client,
          queryKey,
          queryHash,
          options: client.defaultQueryOptions(options),
          state,
          defaultOptions: client.getQueryDefaults(queryKey)
        });
        this.add(query);
      }
      return query;
    }
    /**
    * Adds a query to the cache.
    * @internal
    * @param query - The query to add. If a query with the same hash is already cached, nothing
    * happens.
    */
    add(query) {
      if (!this.#queries.has(query.queryHash)) {
        this.#queries.set(query.queryHash, query);
        this.notify({
          type: "added",
          query
        });
      }
    }
    /**
    * Destroys the given `Query` and removes it from the cache, notifying subscribers with a
    * `'removed'` event. A no-op if the query is no longer the one currently stored under its hash
    * (e.g. it was already replaced). Used by plugins (e.g. the broadcast client) that mirror
    * removals across `QueryCache` instances.
    * @param query - The query to remove.
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    * const query = queryCache.find({ queryKey: ['posts'] })
    *
    * if (query) {
    *   queryCache.remove(query)
    * }
    * ```
    */
    remove(query) {
      if (this.#queries.get(query.queryHash) === query) {
        query.destroy();
        this.#queries.delete(query.queryHash);
        this.notify({
          type: "removed",
          query
        });
      }
    }
    /**
    * Removes all queries from the cache.
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    *
    * queryCache.clear()
    * ```
    */
    clear() {
      notifyManager.batch(() => {
        this.getAll().forEach((query) => {
          this.remove(query);
        });
      });
    }
    /**
    * Returns the `Query` instance stored under the given `queryHash`, or `undefined` if none
    * exists. Unlike {@link QueryCache#find}, this looks up by the already-computed hash rather
    * than by `QueryFilters`. Used by plugins (e.g. broadcast/hydration) that already have a hash
    * to look up directly.
    * @param queryHash - The hash of the query to look up.
    * @returns The query stored under the hash, or `undefined`.
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    * const queryHash = hashKey(['posts'])
    *
    * const query = queryCache.get(queryHash)
    * ```
    */
    get(queryHash) {
      return this.#queries.get(queryHash);
    }
    /**
    * Returns all queries within the cache.
    * @returns Every query in the cache.
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    *
    * const queries = queryCache.getAll()
    * ```
    */
    getAll() {
      return [...this.#queries.values()];
    }
    /**
    * A slightly more advanced method that can be used to get an existing query instance from the
    * cache. This instance not only contains all the state for the query, but all of the instances,
    * and underlying guts of the query as well. If the query does not exist, `undefined` is
    * returned.
    *
    * This is not typically needed for most applications, but can come in handy when needing more
    * information about a query in rare scenarios (e.g. looking at `query.state.dataUpdatedAt` to
    * decide whether a query is fresh enough to be used as an initial value).
    * @param filters - The filters to match, including the required `queryKey`. `exact` defaults to
    * `true`.
    * @returns The first matching query, or `undefined`.
    * @see {@link QueryCache#findAll}
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    *
    * const query = queryCache.find({ queryKey: ['posts'] })
    * ```
    */
    find(filters) {
      const defaultedFilters = {
        exact: true,
        ...filters
      };
      return this.getAll().find((query) => matchQuery(defaultedFilters, query));
    }
    /**
    * An even more advanced method that can be used to get existing query instances from the cache
    * that partially match a query key. If no queries match, an empty array is returned.
    *
    * This is not typically needed for most applications, but can come in handy when needing more
    * information about queries in rare scenarios.
    * @param filters - The filters to match. Without filters, every query is returned.
    * @returns The matching queries.
    * @see {@link QueryCache#find}
    * @example
    * ```ts
    * const queryCache = queryClient.getQueryCache()
    *
    * const queries = queryCache.findAll({ queryKey: ['posts'] })
    * ```
    */
    findAll(filters = {}) {
      const queries = this.getAll();
      return Object.keys(filters).length > 0 ? queries.filter((query) => matchQuery(filters, query)) : queries;
    }
    /**
    * Notifies every cache listener of an event, in one batch.
    * @internal
    * @param event - The event passed to every listener.
    */
    notify(event) {
      notifyManager.batch(() => {
        this.listeners.forEach((listener) => {
          listener(event);
        });
      });
    }
    /**
    * Calls {@link Query#onFocus} on every cached query, in one batch.
    * @internal
    */
    onFocus() {
      notifyManager.batch(() => {
        this.getAll().forEach((query) => {
          query.onFocus();
        });
      });
    }
    /**
    * Calls {@link Query#onOnline} on every cached query, in one batch.
    * @internal
    */
    onOnline() {
      notifyManager.batch(() => {
        this.getAll().forEach((query) => {
          query.onOnline();
        });
      });
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/queryClient.js
  var QueryClient = class {
    #queryCache;
    #mutationCache;
    #defaultOptions;
    #queryDefaults;
    #mutationDefaults;
    #mountCount;
    #unsubscribeFocus;
    #unsubscribeOnline;
    constructor(config = {}) {
      this.#queryCache = config.queryCache || new QueryCache();
      this.#mutationCache = config.mutationCache || new MutationCache();
      this.#defaultOptions = config.defaultOptions || {};
      this.#queryDefaults = /* @__PURE__ */ new Map();
      this.#mutationDefaults = /* @__PURE__ */ new Map();
      this.#mountCount = 0;
    }
    /**
    * Called by a framework adapter's `QueryClientProvider`-equivalent when it mounts, to start
    * listening for focus/online events and resume paused mutations. Ref-counted via an internal
    * mount count, so nested or multiple providers sharing the same `QueryClient` don't tear down
    * the shared listeners until the last one unmounts.
    */
    mount() {
      this.#mountCount++;
      if (this.#mountCount !== 1) return;
      this.#unsubscribeFocus = focusManager.subscribe(async (focused) => {
        if (focused) {
          await this.resumePausedMutations();
          this.#queryCache.onFocus();
        }
      });
      this.#unsubscribeOnline = onlineManager.subscribe(async (online) => {
        if (online) {
          await this.resumePausedMutations();
          this.#queryCache.onOnline();
        }
      });
    }
    /**
    * The inverse of {@link QueryClient#mount} — called by a framework adapter's
    * `QueryClientProvider`-equivalent when it unmounts. Only tears down the focus/online
    * listeners once the mount count returns to `0`.
    */
    unmount() {
      this.#mountCount--;
      if (this.#mountCount !== 0) return;
      this.#unsubscribeFocus?.();
      this.#unsubscribeFocus = void 0;
      this.#unsubscribeOnline?.();
      this.#unsubscribeOnline = void 0;
    }
    /**
    * Returns the number of queries in the cache that are currently fetching, optionally
    * matching a set of filters. This includes background-fetching, loading new pages, and
    * loading more infinite query results.
    * @param filters - Narrows down which fetching queries are counted. Without filters, every
    * fetching query is counted.
    * @returns The number of matching queries whose `fetchStatus` is `'fetching'`.
    * @example
    * ```ts
    * if (queryClient.isFetching()) {
    *   console.log('At least one query is fetching!')
    * }
    * ```
    */
    isFetching(filters) {
      return this.#queryCache.findAll({
        ...filters,
        fetchStatus: "fetching"
      }).length;
    }
    /**
    * Returns the number of mutations in the cache that are currently pending, optionally
    * matching a set of filters.
    * @param filters - Narrows down which pending mutations are counted. Without filters, every
    * pending mutation is counted.
    * @returns The number of matching mutations whose `status` is `'pending'`.
    * @example
    * ```ts
    * if (queryClient.isMutating()) {
    *   console.log('At least one mutation is pending!')
    * }
    * ```
    */
    isMutating(filters) {
      return this.#mutationCache.findAll({
        ...filters,
        status: "pending"
      }).length;
    }
    /**
    * Imperative (non-reactive) way to retrieve data for a QueryKey.
    * Should only be used in callbacks or functions where reading the latest data is necessary, e.g. for optimistic updates.
    *
    * Hint: Do not use this function inside a component, because it won't receive updates.
    * Use `useQuery` to create a `QueryObserver` that subscribes to changes.
    * @param queryKey - The query key of the query to read.
    * @returns The cached data for the query, or `undefined` if no query with this key has been observed yet.
    * @see {@link QueryClient#getQueriesData}
    */
    getQueryData(queryKey) {
      const options = this.defaultQueryOptions({ queryKey });
      return this.#queryCache.get(options.queryHash)?.state.data;
    }
    /**
    * Returns the cached data of a query, or fetches it if there is none. With `revalidateIfStale`,
    * stale cached data is also refetched in the background.
    * @param options - The query options. If the query has no cached data yet, it is fetched with
    * these options.
    * @returns A promise that resolves to the cached data, or to the fetched data if nothing was
    * cached yet.
    * @deprecated Use queryClient.query({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
    */
    ensureQueryData(options) {
      const defaultedOptions = this.defaultQueryOptions(options);
      const query = this.#queryCache.build(this, defaultedOptions);
      const cachedData = query.state.data;
      if (cachedData === void 0) return this.fetchQuery(options);
      if (options.revalidateIfStale && query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query))) this.prefetchQuery(defaultedOptions);
      return Promise.resolve(cachedData);
    }
    /**
    * Imperative (non-reactive) way to retrieve the cached data of multiple queries at once.
    * Only queries matching the given filters are returned; if none match, an empty array is
    * returned.
    *
    * Because the matched queries can hold data of different shapes (e.g. a broad filter can match
    * queries with unrelated data types), the `TQueryFnData` generic defaults to `unknown` rather
    * than being inferred. Passing a more specific type is a convenience for call sites that know
    * every matched query holds the same shape — it is not checked against the actual cache
    * contents.
    * @param filters - The filters that select which queries to read.
    * @returns An array of query key and data pairs. The data is `undefined` for a query with no cached data.
    * @see {@link QueryClient#getQueryData}
    * @example
    * ```ts
    * const data = queryClient.getQueriesData({ queryKey: ['posts'] })
    * ```
    */
    getQueriesData(filters) {
      return this.#queryCache.findAll(filters).map(({ queryKey, state }) => {
        return [queryKey, state.data];
      });
    }
    /**
    * Synchronous way to immediately update a query's cached data. If the updater (or the value
    * passed) resolves to `undefined`, the cache is left untouched and no query is created;
    * otherwise, if the query does not exist yet, it will be created. To update multiple queries
    * at once by partially matching query keys, use {@link QueryClient#setQueriesData} instead.
    *
    * Updates must be performed immutably: do not mutate `oldData`, or data previously retrieved
    * via {@link QueryClient#getQueryData}, in place.
    * @param queryKey - The query key to set data for.
    * @param updater - Either the new data, or a function that receives the current data (which
    * may be `undefined`) and returns the new data.
    * @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
    * @returns The data that was written, or `undefined` if the updater returned `undefined` — in that case
    * the write is skipped and the cache is left unchanged.
    * @example
    * ```ts
    * queryClient.setQueryData(['posts'], newPosts)
    *
    * // Or, using an updater function that receives the current data:
    * queryClient.setQueryData(['posts'], (oldPosts) => [...oldPosts, newPost])
    * ```
    */
    setQueryData(queryKey, updater, options) {
      const defaultedOptions = this.defaultQueryOptions({ queryKey });
      const prevData = this.#queryCache.get(defaultedOptions.queryHash)?.state.data;
      const data = functionalUpdate(updater, prevData);
      if (data === void 0) return;
      return this.#queryCache.build(this, defaultedOptions).setData(data, {
        ...options,
        manual: true
      });
    }
    /**
    * Synchronous way to immediately update the cached data of multiple queries at once, using
    * filters or partial query key matching. Only queries that already exist and match the given
    * filters are updated; no new cache entries are created. Internally this calls
    * {@link QueryClient#setQueryData} for each matching query.
    * @param filters - The filters that select which existing queries to update.
    * @param updater - Either the new data, or a function that receives each matched query's current
    * data (which may be `undefined`) and returns the new data.
    * @param options - Set `updatedAt` to override the timestamp the written data is recorded with.
    * @returns One `[queryKey, data]` tuple per matched query, in the same shape and with the same
    * `undefined` case as {@link QueryClient#setQueryData}.
    * @example
    * ```ts
    * queryClient.setQueriesData({ queryKey: ['posts'] }, (oldPosts) =>
    *   oldPosts ? oldPosts.filter((post) => post.id !== deletedId) : oldPosts,
    * )
    * ```
    */
    setQueriesData(filters, updater, options) {
      return notifyManager.batch(() => this.#queryCache.findAll(filters).map(({ queryKey }) => [queryKey, this.setQueryData(queryKey, updater, options)]));
    }
    /**
    * Imperative (non-reactive) way to retrieve an existing query's state. If the query does not
    * exist, `undefined` is returned.
    * @param queryKey - The query key of the query to read.
    * @returns The query's state, or `undefined` if no query with this key exists.
    * @example
    * ```ts
    * const state = queryClient.getQueryState(['posts'])
    * console.log(state?.dataUpdatedAt)
    * ```
    */
    getQueryState(queryKey) {
      const options = this.defaultQueryOptions({ queryKey });
      return this.#queryCache.get(options.queryHash)?.state;
    }
    /**
    * Removes queries from the cache that match the given filters. Unlike
    * {@link QueryClient#invalidateQueries} or {@link QueryClient#refetchQueries}, this removes
    * matching queries from the cache instead of refetching them. Without filters, every query in
    * the cache is removed.
    * @param filters - The filters that select which queries to remove. Without filters, every query
    * is removed.
    * @example
    * ```ts
    * queryClient.removeQueries({ queryKey: ['posts'], exact: true })
    * ```
    */
    removeQueries(filters) {
      const queryCache = this.#queryCache;
      notifyManager.batch(() => {
        queryCache.findAll(filters).forEach((query) => {
          queryCache.remove(query);
        });
      });
    }
    /**
    * Resets queries matching the given filters back to their initial state (e.g. any
    * `initialData`), notifying subscribers rather than removing them. Active queries among the
    * matched set are then refetched, and the returned promise resolves once that refetch settles.
    * @param filters - The filters that select which queries to reset. Without filters, every query
    * is reset.
    * @param options - Passed to the refetch of the active matched queries, e.g. `cancelRefetch` and
    * `throwOnError`.
    * @returns A promise that resolves once the refetch of the active matched queries settles.
    * @example
    * ```ts
    * await queryClient.resetQueries({ queryKey: ['posts'], exact: true })
    * ```
    */
    resetQueries(filters, options) {
      const queryCache = this.#queryCache;
      return notifyManager.batch(() => {
        const matched = queryCache.findAll(filters);
        const queriesToRefetch = new Set(matched);
        matched.forEach((query) => {
          query.reset();
        });
        return this.refetchQueries({
          type: "active",
          predicate: (query) => queriesToRefetch.has(query)
        }, options);
      });
    }
    /**
    * Cancels outgoing fetches for queries matching the given filters. Most useful when performing
    * optimistic updates, since any outgoing refetch that resolves afterwards would otherwise
    * overwrite the optimistic update. By default (`revert: true`), a cancelled query's data is
    * reverted to its state before the outgoing fetch started.
    *
    * The returned promise never rejects, even if individual cancellations fail.
    * @param filters - The filters that select which queries to cancel. Without filters, every query
    * is cancelled.
    * @param cancelOptions - Passed to each matched query's cancellation. `revert` defaults to
    * `true`.
    * @returns A promise that resolves once every cancellation has settled.
    * @example
    * ```ts
    * await queryClient.cancelQueries({ queryKey: ['posts'], exact: true })
    * ```
    */
    cancelQueries(filters, cancelOptions = {}) {
      const defaultedCancelOptions = {
        revert: true,
        ...cancelOptions
      };
      const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).map((query) => query.cancel(defaultedCancelOptions)));
      return Promise.all(promises).then(noop).catch(noop);
    }
    /**
    * Marks queries matching the given filters as invalidated. Unlike
    * {@link QueryClient#removeQueries}, invalidated queries stay in the cache.
    *
    * Unless `filters.refetchType` is `'none'`, matching queries are then refetched via
    * {@link QueryClient#refetchQueries}, using `filters.refetchType` if set, otherwise
    * `filters.type`, otherwise `'active'`.
    * @param filters - The filters that select which queries to invalidate, plus `refetchType` to
    * control which of them to refetch afterwards. Without filters, every query is invalidated.
    * @param options - Passed to {@link QueryClient#refetchQueries}, e.g. `cancelRefetch` and
    * `throwOnError`.
    * @returns A promise that resolves once the refetch settles, or immediately if `refetchType` is
    * `'none'`.
    * @example
    * ```ts
    * await queryClient.invalidateQueries({ queryKey: ['posts'], refetchType: 'active' })
    * ```
    */
    invalidateQueries(filters, options = {}) {
      return notifyManager.batch(() => {
        this.#queryCache.findAll(filters).forEach((query) => {
          query.invalidate();
        });
        if (filters?.refetchType === "none") return Promise.resolve();
        return this.refetchQueries({
          ...filters,
          type: filters?.refetchType ?? filters?.type ?? "active"
        }, options);
      });
    }
    /**
    * Refetches queries matching the given filters, regardless of whether they are stale. Without
    * filters, every query in the cache is refetched. Queries that are disabled, or static (only
    * have observers with a static `staleTime`), are never refetched.
    *
    * By default (`cancelRefetch: true`), a currently running fetch is cancelled before the new
    * one starts. The returned promise resolves once all matching queries have settled; it does
    * not reject on individual query failures unless `throwOnError` is set.
    * @param filters - The filters that select which queries to refetch. Without filters, every query
    * in the cache is included.
    * @param options - Set `cancelRefetch` to `false` to keep a running fetch instead of cancelling
    * it, and `throwOnError` to `true` to reject when a refetch fails.
    * @returns A promise that resolves once every matched query has settled.
    * @example
    * ```ts
    * // refetch all active queries partially matching a query key:
    * await queryClient.refetchQueries({ queryKey: ['posts'], type: 'active' })
    * ```
    */
    refetchQueries(filters, options = {}) {
      const fetchOptions = {
        ...options,
        cancelRefetch: options.cancelRefetch ?? true
      };
      const promises = notifyManager.batch(() => this.#queryCache.findAll(filters).filter((query) => !query.isDisabled() && !query.isStatic()).map((query) => {
        let promise = query.fetch(void 0, fetchOptions);
        if (!fetchOptions.throwOnError) promise = promise.catch(noop);
        return query.state.fetchStatus === "paused" ? Promise.resolve() : promise;
      }));
      return Promise.all(promises).then(noop);
    }
    /**
    * Asynchronous method to fetch and cache a query, resolving with the data or throwing with
    * the error.
    *
    * If the query already exists in the cache and its data is not stale (per the given
    * `staleTime`), the cached data is returned without fetching. Otherwise, the query is fetched
    * and the promise resolves once the fetch settles. If a `select` function is provided, it is
    * applied to the data in both cases (cached or freshly fetched) before it is returned.
    *
    * Unlike a reactive observer, retries are disabled by default here (`retry: false`) unless
    * explicitly configured, since there is no component to catch a thrown error and retry through
    * re-render.
    *
    * The accepted options are `QueryObserverOptions` minus the fields that only make sense for a
    * reactive observer — `enabled`, `refetchInterval`, `refetchIntervalInBackground`,
    * `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount`, `retryOnMount`,
    * `notifyOnChangeProps`, `throwOnError`, `suspense`, and `placeholderData` are not part of this
    * method's options.
    *
    * This method replaces the deprecated `fetchQuery`, and — combined with
    * `{ staleTime: 'static' }` — the deprecated `ensureQueryData`.
    * @param options - The query options, including the `queryKey` and the `queryFn` used if the
    * query needs to fetch.
    * @returns A promise that resolves to the data, or to the result of `select` if provided. It
    * rejects with the error from the fetch or from `select`.
    * @example
    * ```ts
    * try {
    *   const data = await queryClient.query({ queryKey, queryFn, staleTime: 10000 })
    * } catch (error) {
    *   console.log(error)
    * }
    * ```
    */
    async query(options) {
      const defaultedOptions = this.defaultQueryOptions(options);
      if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
      const query = this.#queryCache.build(this, defaultedOptions);
      const queryData = query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query)) ? await query.fetch(defaultedOptions) : query.state.data;
      const select = defaultedOptions.select;
      if (select) return select(queryData);
      return queryData;
    }
    /**
    * Fetches and caches a query, or returns its cached data if it isn't stale. Unlike in observers,
    * the fetch isn't retried unless `retry` is set.
    * @param options - The query options, including the `queryKey` and the `queryFn` used if the
    * query needs to fetch.
    * @returns A promise that resolves to the cached or fetched data, or rejects with the fetch
    * error.
    * @deprecated Use queryClient.query(options) instead. This method will be removed in the next major version.
    */
    fetchQuery(options) {
      const defaultedOptions = this.defaultQueryOptions(options);
      if (defaultedOptions.retry === void 0) defaultedOptions.retry = false;
      const query = this.#queryCache.build(this, defaultedOptions);
      return query.isStaleByTime(resolveQueryValue(defaultedOptions.staleTime, query)) ? query.fetch(defaultedOptions) : Promise.resolve(query.state.data);
    }
    /**
    * Fetches and caches a query like {@link QueryClient#fetchQuery}, but ignores the result and any
    * error.
    * @param options - The query options, including the `queryKey` and the `queryFn` used if the
    * query needs to fetch.
    * @returns A promise that resolves once the fetch settles. It never rejects.
    * @deprecated Use queryClient.query(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
    */
    prefetchQuery(options) {
      return this.fetchQuery(options).then(noop).catch(noop);
    }
    /**
    * Asynchronous method to fetch and cache an infinite query, resolving with an
    * {@link InfiniteData} object or throwing with the error.
    *
    * Behaves like {@link QueryClient#query}, accepting the same options (minus
    * `initialPageParam`), plus the required `initialPageParam`, and an optional `pages` /
    * `getNextPageParam` pair used to refetch a fixed number of pages from the start.
    *
    * This method replaces the deprecated `fetchInfiniteQuery`, and — combined with
    * `{ staleTime: 'static' }` — the deprecated `ensureInfiniteQueryData`.
    * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
    * `initialPageParam`.
    * @returns A promise that resolves to the {@link InfiniteData}, or to the result of `select` if
    * provided. It rejects with the error from the fetch or from `select`.
    * @example
    * ```ts
    * try {
    *   const data = await queryClient.infiniteQuery({ queryKey, queryFn, initialPageParam: 0 })
    *   console.log(data.pages)
    * } catch (error) {
    *   console.log(error)
    * }
    * ```
    */
    infiniteQuery(options) {
      options._type = "infinite";
      return this.query(options);
    }
    /**
    * Fetches and caches an infinite query, or returns its cached data if it isn't stale.
    * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
    * `initialPageParam`.
    * @returns A promise that resolves to the cached or fetched {@link InfiniteData}, or rejects with
    * the fetch error.
    * @deprecated Use queryClient.infiniteQuery(options) instead. This method will be removed in the next major version.
    */
    fetchInfiniteQuery(options) {
      options._type = "infinite";
      return this.fetchQuery(options);
    }
    /**
    * Fetches and caches an infinite query like {@link QueryClient#fetchInfiniteQuery}, but ignores
    * the result and any error.
    * @param options - The infinite query options, including the `queryKey`, the `queryFn`, and the
    * `initialPageParam`.
    * @returns A promise that resolves once the fetch settles. It never rejects.
    * @deprecated Use queryClient.infiniteQuery(options) instead. You can swallow errors with `.catch(noop)`. This method will be removed in the next major version.
    */
    prefetchInfiniteQuery(options) {
      return this.fetchInfiniteQuery(options).then(noop).catch(noop);
    }
    /**
    * Returns the cached data of an infinite query, or fetches it if there is none. With
    * `revalidateIfStale`, stale cached data is also refetched in the background.
    * @param options - The infinite query options. If the query has no cached data yet, it is fetched
    * with these options.
    * @returns A promise that resolves to the cached {@link InfiniteData}, or to the fetched data if
    * nothing was cached yet.
    * @deprecated Use queryClient.infiniteQuery({ ...options, staleTime: 'static' }) instead. This method will be removed in the next major version.
    */
    ensureInfiniteQueryData(options) {
      options._type = "infinite";
      return this.ensureQueryData(options);
    }
    /**
    * Resumes mutations that were paused because there was no network connection. Does nothing
    * (resolving immediately) if the client is currently offline.
    * @returns A promise that resolves once the resumed mutations have settled.
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * await queryClient.resumePausedMutations()
    * ```
    */
    resumePausedMutations() {
      if (onlineManager.isOnline()) return this.#mutationCache.resumePausedMutations();
      return Promise.resolve();
    }
    /**
    * Returns the query cache this client is connected to.
    * @returns The {@link QueryCache} instance.
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * const queryCache = queryClient.getQueryCache()
    * const queries = queryCache.findAll({ queryKey: ['posts'] })
    * ```
    */
    getQueryCache() {
      return this.#queryCache;
    }
    /**
    * Returns the mutation cache this client is connected to.
    * @returns The {@link MutationCache} instance.
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * const mutationCache = queryClient.getMutationCache()
    * const mutations = mutationCache.findAll({ status: 'pending' })
    * ```
    */
    getMutationCache() {
      return this.#mutationCache;
    }
    /**
    * Returns the default options that were set when creating the client, or via
    * {@link QueryClient#setDefaultOptions}.
    * @returns The client's current default options.
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * const defaultOptions = queryClient.getDefaultOptions()
    * ```
    */
    getDefaultOptions() {
      return this.#defaultOptions;
    }
    /**
    * Dynamically sets the default options for this client, overwriting any previously defined
    * default options.
    * @param options - The new default options for queries and mutations.
    * @see {@link QueryClient#getDefaultOptions}
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * queryClient.setDefaultOptions({
    *   queries: {
    *     staleTime: Infinity,
    *   },
    * })
    * ```
    */
    setDefaultOptions(options) {
      this.#defaultOptions = options;
    }
    /**
    * Sets default options for queries whose query key partially matches the given `queryKey`.
    *
    * If several registered query defaults match a given query key, they are merged together in
    * registration order by {@link QueryClient#getQueryDefaults}, so register defaults from the
    * most generic key to the least generic one — more specific defaults should be registered
    * after more generic ones so they take precedence.
    * @param queryKey - The query key that query keys are partially matched against.
    * @param options - The default options applied to matching queries.
    * @example
    * ```ts
    * queryClient.setQueryDefaults(['posts'], { queryFn: fetchPosts })
    *
    * await queryClient.query({ queryKey: ['posts'] })
    * ```
    */
    setQueryDefaults(queryKey, options) {
      this.#queryDefaults.set(hashKey(queryKey), {
        queryKey,
        defaultOptions: options
      });
    }
    /**
    * Returns the default options registered for queries whose query key partially matches the
    * given `queryKey`, via {@link QueryClient#setQueryDefaults}. If multiple registered defaults
    * match, they are merged together in registration order.
    * @param queryKey - The query key to look up registered defaults for.
    * @returns The merged default options of every registration that matches, or an empty object if
    * none match.
    * @example
    * ```ts
    * const defaultOptions = queryClient.getQueryDefaults(['posts'])
    * ```
    */
    getQueryDefaults(queryKey) {
      const defaults = [...this.#queryDefaults.values()];
      const result = {};
      defaults.forEach((queryDefault) => {
        if (partialMatchKey(queryKey, queryDefault.queryKey)) Object.assign(result, queryDefault.defaultOptions);
      });
      return result;
    }
    /**
    * Sets default options for mutations whose mutation key partially matches the given
    * `mutationKey`. As with {@link QueryClient#setQueryDefaults}, the order of registration
    * matters when several registered defaults match the same mutation key.
    * @param mutationKey - The mutation key that mutation keys are partially matched against.
    * @param options - The default options applied to matching mutations.
    * @see {@link QueryClient#getMutationDefaults}
    * @example
    * ```ts
    * queryClient.setMutationDefaults(['addPost'], { mutationFn: addPost })
    * ```
    */
    setMutationDefaults(mutationKey, options) {
      this.#mutationDefaults.set(hashKey(mutationKey), {
        mutationKey,
        defaultOptions: options
      });
    }
    /**
    * Returns the default options registered for mutations whose mutation key partially matches
    * the given `mutationKey`, via {@link QueryClient#setMutationDefaults}. If multiple registered
    * defaults match, they are merged together in registration order.
    * @param mutationKey - The mutation key to look up registered defaults for.
    * @returns The merged default options of every registration that matches, or an empty object if
    * none match.
    * @example
    * ```ts
    * const defaultOptions = queryClient.getMutationDefaults(['addPost'])
    * ```
    */
    getMutationDefaults(mutationKey) {
      const defaults = [...this.#mutationDefaults.values()];
      const result = {};
      defaults.forEach((queryDefault) => {
        if (partialMatchKey(mutationKey, queryDefault.mutationKey)) Object.assign(result, queryDefault.defaultOptions);
      });
      return result;
    }
    /**
    * Called by framework adapters (e.g. inside `useQuery`) to resolve the options passed by the
    * caller into their final, defaulted form: merging the client's own `defaultOptions.queries`,
    * then `queryClient.setQueryDefaults` for the given `queryKey`, then the caller's options on
    * top. A no-op if the options are already defaulted (`_defaulted: true`).
    * @param options - The query options passed by the caller.
    * @returns The defaulted options, with `queryHash` and dependent defaults (e.g.
    * `refetchOnReconnect`) filled in.
    */
    defaultQueryOptions(options) {
      if (options._defaulted) return options;
      const defaultedOptions = {
        ...this.#defaultOptions.queries,
        ...this.getQueryDefaults(options.queryKey),
        ...options,
        _defaulted: true
      };
      if (!defaultedOptions.queryHash) defaultedOptions.queryHash = hashQueryKeyByOptions(defaultedOptions.queryKey, defaultedOptions);
      if (defaultedOptions.refetchOnReconnect === void 0) defaultedOptions.refetchOnReconnect = defaultedOptions.networkMode !== "always";
      if (defaultedOptions.throwOnError === void 0) defaultedOptions.throwOnError = !!defaultedOptions.suspense;
      if (!defaultedOptions.networkMode && defaultedOptions.persister) defaultedOptions.networkMode = "offlineFirst";
      if (defaultedOptions.queryFn === skipToken) defaultedOptions.enabled = false;
      return defaultedOptions;
    }
    /**
    * The mutation counterpart of {@link QueryClient#defaultQueryOptions}. Called by framework
    * adapters (e.g. inside `useMutation`) to merge the client's `defaultOptions.mutations`, then
    * `queryClient.setMutationDefaults` for the given `mutationKey`, then the caller's options on
    * top. A no-op if the options are already defaulted (`_defaulted: true`).
    * @param options - The mutation options passed by the caller.
    * @returns The defaulted options.
    */
    defaultMutationOptions(options) {
      if (options?._defaulted) return options;
      return {
        ...this.#defaultOptions.mutations,
        ...options?.mutationKey && this.getMutationDefaults(options.mutationKey),
        ...options,
        _defaulted: true
      };
    }
    /**
    * Clears both the query cache and the mutation cache this client is connected to.
    * @example
    * ```ts
    * import { QueryClient } from '@tanstack/query-core'
    *
    * const queryClient = new QueryClient()
    * queryClient.clear()
    * ```
    */
    clear() {
      this.#queryCache.clear();
      this.#mutationCache.clear();
    }
  };

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/streamedQuery.js
  function streamedQuery({ streamFn, refetchMode = "reset", reducer = (items, chunk) => addToEnd(items, chunk), initialValue = [] }) {
    return async (context) => {
      const query = context.client.getQueryCache().find({
        queryKey: context.queryKey,
        exact: true
      });
      const isRefetch = !!query && query.isFetched();
      if (isRefetch && refetchMode === "reset") query.setState({
        ...query.resetState,
        fetchStatus: "fetching"
      });
      let result = initialValue;
      let cancelled = false;
      const stream = await streamFn(addConsumeAwareSignal({
        client: context.client,
        meta: context.meta,
        queryKey: context.queryKey,
        pageParam: context.pageParam,
        direction: context.direction
      }, () => context.signal, () => cancelled = true));
      const isReplaceRefetch = isRefetch && refetchMode === "replace";
      for await (const chunk of stream) {
        if (cancelled) break;
        if (isReplaceRefetch) result = reducer(result, chunk);
        else context.client.setQueryData(context.queryKey, (prev) => reducer(prev === void 0 ? initialValue : prev, chunk));
      }
      if (isReplaceRefetch && !cancelled) context.client.setQueryData(context.queryKey, result);
      const data = context.client.getQueryData(context.queryKey);
      return data === void 0 ? initialValue : data;
    };
  }

  // node_modules/.pnpm/@tanstack+query-core@5.104.5/node_modules/@tanstack/query-core/build/modern/types.js
  var dataTagSymbol = /* @__PURE__ */ Symbol();
  var dataTagErrorSymbol = /* @__PURE__ */ Symbol();
  var unsetMarker = /* @__PURE__ */ Symbol();
  return __toCommonJS(modern_exports);
})();

const nativeQrcode = (() => {
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//  http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//  http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

  //---------------------------------------------------------------------
  // qrcode
  //---------------------------------------------------------------------

  /**
   * qrcode
   * @param typeNumber 1 to 40
   * @param errorCorrectionLevel 'L','M','Q','H'
   */
  var qrcode = function(typeNumber, errorCorrectionLevel) {

    var PAD0 = 0xEC;
    var PAD1 = 0x11;

    var _typeNumber = typeNumber;
    var _errorCorrectionLevel = QRErrorCorrectionLevel[errorCorrectionLevel];
    var _modules = null;
    var _moduleCount = 0;
    var _dataCache = null;
    var _dataList = [];

    var _this = {};

    var makeImpl = function(test, maskPattern) {

      _moduleCount = _typeNumber * 4 + 17;
      _modules = function(moduleCount) {
        var modules = new Array(moduleCount);
        for (var row = 0; row < moduleCount; row += 1) {
          modules[row] = new Array(moduleCount);
          for (var col = 0; col < moduleCount; col += 1) {
            modules[row][col] = null;
          }
        }
        return modules;
      }(_moduleCount);

      setupPositionProbePattern(0, 0);
      setupPositionProbePattern(_moduleCount - 7, 0);
      setupPositionProbePattern(0, _moduleCount - 7);
      setupPositionAdjustPattern();
      setupTimingPattern();
      setupTypeInfo(test, maskPattern);

      if (_typeNumber >= 7) {
        setupTypeNumber(test);
      }

      if (_dataCache == null) {
        _dataCache = createData(_typeNumber, _errorCorrectionLevel, _dataList);
      }

      mapData(_dataCache, maskPattern);
    };

    var setupPositionProbePattern = function(row, col) {

      for (var r = -1; r <= 7; r += 1) {

        if (row + r <= -1 || _moduleCount <= row + r) continue;

        for (var c = -1; c <= 7; c += 1) {

          if (col + c <= -1 || _moduleCount <= col + c) continue;

          if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
              || (0 <= c && c <= 6 && (r == 0 || r == 6) )
              || (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
            _modules[row + r][col + c] = true;
          } else {
            _modules[row + r][col + c] = false;
          }
        }
      }
    };

    var getBestMaskPattern = function() {

      var minLostPoint = 0;
      var pattern = 0;

      for (var i = 0; i < 8; i += 1) {

        makeImpl(true, i);

        var lostPoint = QRUtil.getLostPoint(_this);

        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }

      return pattern;
    };

    var setupTimingPattern = function() {

      for (var r = 8; r < _moduleCount - 8; r += 1) {
        if (_modules[r][6] != null) {
          continue;
        }
        _modules[r][6] = (r % 2 == 0);
      }

      for (var c = 8; c < _moduleCount - 8; c += 1) {
        if (_modules[6][c] != null) {
          continue;
        }
        _modules[6][c] = (c % 2 == 0);
      }
    };

    var setupPositionAdjustPattern = function() {

      var pos = QRUtil.getPatternPosition(_typeNumber);

      for (var i = 0; i < pos.length; i += 1) {

        for (var j = 0; j < pos.length; j += 1) {

          var row = pos[i];
          var col = pos[j];

          if (_modules[row][col] != null) {
            continue;
          }

          for (var r = -2; r <= 2; r += 1) {

            for (var c = -2; c <= 2; c += 1) {

              if (r == -2 || r == 2 || c == -2 || c == 2
                  || (r == 0 && c == 0) ) {
                _modules[row + r][col + c] = true;
              } else {
                _modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    };

    var setupTypeNumber = function(test) {

      var bits = QRUtil.getBCHTypeNumber(_typeNumber);

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
      }

      for (var i = 0; i < 18; i += 1) {
        var mod = (!test && ( (bits >> i) & 1) == 1);
        _modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    };

    var setupTypeInfo = function(test, maskPattern) {

      var data = (_errorCorrectionLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);

      // vertical
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 6) {
          _modules[i][8] = mod;
        } else if (i < 8) {
          _modules[i + 1][8] = mod;
        } else {
          _modules[_moduleCount - 15 + i][8] = mod;
        }
      }

      // horizontal
      for (var i = 0; i < 15; i += 1) {

        var mod = (!test && ( (bits >> i) & 1) == 1);

        if (i < 8) {
          _modules[8][_moduleCount - i - 1] = mod;
        } else if (i < 9) {
          _modules[8][15 - i - 1 + 1] = mod;
        } else {
          _modules[8][15 - i - 1] = mod;
        }
      }

      // fixed module
      _modules[_moduleCount - 8][8] = (!test);
    };

    var mapData = function(data, maskPattern) {

      var inc = -1;
      var row = _moduleCount - 1;
      var bitIndex = 7;
      var byteIndex = 0;
      var maskFunc = QRUtil.getMaskFunction(maskPattern);

      for (var col = _moduleCount - 1; col > 0; col -= 2) {

        if (col == 6) col -= 1;

        while (true) {

          for (var c = 0; c < 2; c += 1) {

            if (_modules[row][col - c] == null) {

              var dark = false;

              if (byteIndex < data.length) {
                dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
              }

              var mask = maskFunc(row, col - c);

              if (mask) {
                dark = !dark;
              }

              _modules[row][col - c] = dark;
              bitIndex -= 1;

              if (bitIndex == -1) {
                byteIndex += 1;
                bitIndex = 7;
              }
            }
          }

          row += inc;

          if (row < 0 || _moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    };

    var createBytes = function(buffer, rsBlocks) {

      var offset = 0;

      var maxDcCount = 0;
      var maxEcCount = 0;

      var dcdata = new Array(rsBlocks.length);
      var ecdata = new Array(rsBlocks.length);

      for (var r = 0; r < rsBlocks.length; r += 1) {

        var dcCount = rsBlocks[r].dataCount;
        var ecCount = rsBlocks[r].totalCount - dcCount;

        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);

        dcdata[r] = new Array(dcCount);

        for (var i = 0; i < dcdata[r].length; i += 1) {
          dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;

        var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
        var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

        var modPoly = rawPoly.mod(rsPoly);
        ecdata[r] = new Array(rsPoly.getLength() - 1);
        for (var i = 0; i < ecdata[r].length; i += 1) {
          var modIndex = i + modPoly.getLength() - ecdata[r].length;
          ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
        }
      }

      var totalCodeCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalCodeCount += rsBlocks[i].totalCount;
      }

      var data = new Array(totalCodeCount);
      var index = 0;

      for (var i = 0; i < maxDcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < dcdata[r].length) {
            data[index] = dcdata[r][i];
            index += 1;
          }
        }
      }

      for (var i = 0; i < maxEcCount; i += 1) {
        for (var r = 0; r < rsBlocks.length; r += 1) {
          if (i < ecdata[r].length) {
            data[index] = ecdata[r][i];
            index += 1;
          }
        }
      }

      return data;
    };

    var createData = function(typeNumber, errorCorrectionLevel, dataList) {

      var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectionLevel);

      var buffer = qrBitBuffer();

      for (var i = 0; i < dataList.length; i += 1) {
        var data = dataList[i];
        buffer.put(data.getMode(), 4);
        buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
        data.write(buffer);
      }

      // calc num max data.
      var totalDataCount = 0;
      for (var i = 0; i < rsBlocks.length; i += 1) {
        totalDataCount += rsBlocks[i].dataCount;
      }

      if (buffer.getLengthInBits() > totalDataCount * 8) {
        throw 'code length overflow. ('
          + buffer.getLengthInBits()
          + '>'
          + totalDataCount * 8
          + ')';
      }

      // end code
      if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
        buffer.put(0, 4);
      }

      // padding
      while (buffer.getLengthInBits() % 8 != 0) {
        buffer.putBit(false);
      }

      // padding
      while (true) {

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD0, 8);

        if (buffer.getLengthInBits() >= totalDataCount * 8) {
          break;
        }
        buffer.put(PAD1, 8);
      }

      return createBytes(buffer, rsBlocks);
    };

    _this.addData = function(data, mode) {

      mode = mode || 'Byte';

      var newData = null;

      switch(mode) {
      case 'Numeric' :
        newData = qrNumber(data);
        break;
      case 'Alphanumeric' :
        newData = qrAlphaNum(data);
        break;
      case 'Byte' :
        newData = qr8BitByte(data);
        break;
      case 'Kanji' :
        newData = qrKanji(data);
        break;
      default :
        throw 'mode:' + mode;
      }

      _dataList.push(newData);
      _dataCache = null;
    };

    _this.isDark = function(row, col) {
      if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
        throw row + ',' + col;
      }
      return _modules[row][col];
    };

    _this.getModuleCount = function() {
      return _moduleCount;
    };

    _this.make = function() {
      if (_typeNumber < 1) {
        var typeNumber = 1;

        for (; typeNumber < 40; typeNumber++) {
          var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, _errorCorrectionLevel);
          var buffer = qrBitBuffer();

          for (var i = 0; i < _dataList.length; i++) {
            var data = _dataList[i];
            buffer.put(data.getMode(), 4);
            buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
            data.write(buffer);
          }

          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) {
            totalDataCount += rsBlocks[i].dataCount;
          }

          if (buffer.getLengthInBits() <= totalDataCount * 8) {
            break;
          }
        }

        _typeNumber = typeNumber;
      }

      makeImpl(false, getBestMaskPattern() );
    };

    _this.createTableTag = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var qrHtml = '';

      qrHtml += '<table style="';
      qrHtml += ' border-width: 0px; border-style: none;';
      qrHtml += ' border-collapse: collapse;';
      qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
      qrHtml += '">';
      qrHtml += '<tbody>';

      for (var r = 0; r < _this.getModuleCount(); r += 1) {

        qrHtml += '<tr>';

        for (var c = 0; c < _this.getModuleCount(); c += 1) {
          qrHtml += '<td style="';
          qrHtml += ' border-width: 0px; border-style: none;';
          qrHtml += ' border-collapse: collapse;';
          qrHtml += ' padding: 0px; margin: 0px;';
          qrHtml += ' width: ' + cellSize + 'px;';
          qrHtml += ' height: ' + cellSize + 'px;';
          qrHtml += ' background-color: ';
          qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
          qrHtml += ';';
          qrHtml += '"/>';
        }

        qrHtml += '</tr>';
      }

      qrHtml += '</tbody>';
      qrHtml += '</table>';

      return qrHtml;
    };

    _this.createSvgTag = function(cellSize, margin, alt, title) {

      var opts = {};
      if (typeof arguments[0] == 'object') {
        // Called by options.
        opts = arguments[0];
        // overwrite cellSize and margin.
        cellSize = opts.cellSize;
        margin = opts.margin;
        alt = opts.alt;
        title = opts.title;
      }

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      // Compose alt property surrogate
      alt = (typeof alt === 'string') ? {text: alt} : alt || {};
      alt.text = alt.text || null;
      alt.id = (alt.text) ? alt.id || 'qrcode-description' : null;

      // Compose title property surrogate
      title = (typeof title === 'string') ? {text: title} : title || {};
      title.text = title.text || null;
      title.id = (title.text) ? title.id || 'qrcode-title' : null;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var c, mc, r, mr, qrSvg='', rect;

      rect = 'l' + cellSize + ',0 0,' + cellSize +
        ' -' + cellSize + ',0 0,-' + cellSize + 'z ';

      qrSvg += '<svg version="1.1" xmlns="http://www.w3.org/2000/svg"';
      qrSvg += !opts.scalable ? ' width="' + size + 'px" height="' + size + 'px"' : '';
      qrSvg += ' viewBox="0 0 ' + size + ' ' + size + '" ';
      qrSvg += ' preserveAspectRatio="xMinYMin meet"';
      qrSvg += (title.text || alt.text) ? ' role="img" aria-labelledby="' +
          escapeXml([title.id, alt.id].join(' ').trim() ) + '"' : '';
      qrSvg += '>';
      qrSvg += (title.text) ? '<title id="' + escapeXml(title.id) + '">' +
          escapeXml(title.text) + '</title>' : '';
      qrSvg += (alt.text) ? '<description id="' + escapeXml(alt.id) + '">' +
          escapeXml(alt.text) + '</description>' : '';
      qrSvg += '<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>';
      qrSvg += '<path d="';

      for (r = 0; r < _this.getModuleCount(); r += 1) {
        mr = r * cellSize + margin;
        for (c = 0; c < _this.getModuleCount(); c += 1) {
          if (_this.isDark(r, c) ) {
            mc = c*cellSize+margin;
            qrSvg += 'M' + mc + ',' + mr + rect;
          }
        }
      }

      qrSvg += '" stroke="transparent" fill="black"/>';
      qrSvg += '</svg>';

      return qrSvg;
    };

    _this.createDataURL = function(cellSize, margin) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      return createDataURL(size, size, function(x, y) {
        if (min <= x && x < max && min <= y && y < max) {
          var c = Math.floor( (x - min) / cellSize);
          var r = Math.floor( (y - min) / cellSize);
          return _this.isDark(r, c)? 0 : 1;
        } else {
          return 1;
        }
      } );
    };

    _this.createImgTag = function(cellSize, margin, alt) {

      cellSize = cellSize || 2;
      margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;

      var img = '';
      img += '<img';
      img += '\u0020src="';
      img += _this.createDataURL(cellSize, margin);
      img += '"';
      img += '\u0020width="';
      img += size;
      img += '"';
      img += '\u0020height="';
      img += size;
      img += '"';
      if (alt) {
        img += '\u0020alt="';
        img += escapeXml(alt);
        img += '"';
      }
      img += '/>';

      return img;
    };

    var escapeXml = function(s) {
      var escaped = '';
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charAt(i);
        switch(c) {
        case '<': escaped += '&lt;'; break;
        case '>': escaped += '&gt;'; break;
        case '&': escaped += '&amp;'; break;
        case '"': escaped += '&quot;'; break;
        default : escaped += c; break;
        }
      }
      return escaped;
    };

    var _createHalfASCII = function(margin) {
      var cellSize = 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r1, r2, p;

      var blocks = {
        '██': '█',
        '█ ': '▀',
        ' █': '▄',
        '  ': ' '
      };

      var blocksLastLineNoMargin = {
        '██': '▀',
        '█ ': '▀',
        ' █': ' ',
        '  ': ' '
      };

      var ascii = '';
      for (y = 0; y < size; y += 2) {
        r1 = Math.floor((y - min) / cellSize);
        r2 = Math.floor((y + 1 - min) / cellSize);
        for (x = 0; x < size; x += 1) {
          p = '█';

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r1, Math.floor((x - min) / cellSize))) {
            p = ' ';
          }

          if (min <= x && x < max && min <= y+1 && y+1 < max && _this.isDark(r2, Math.floor((x - min) / cellSize))) {
            p += ' ';
          }
          else {
            p += '█';
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          ascii += (margin < 1 && y+1 >= max) ? blocksLastLineNoMargin[p] : blocks[p];
        }

        ascii += '\n';
      }

      if (size % 2 && margin > 0) {
        return ascii.substring(0, ascii.length - size - 1) + Array(size+1).join('▀');
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.createASCII = function(cellSize, margin) {
      cellSize = cellSize || 1;

      if (cellSize < 2) {
        return _createHalfASCII(margin);
      }

      cellSize -= 1;
      margin = (typeof margin == 'undefined')? cellSize * 2 : margin;

      var size = _this.getModuleCount() * cellSize + margin * 2;
      var min = margin;
      var max = size - margin;

      var y, x, r, p;

      var white = Array(cellSize+1).join('██');
      var black = Array(cellSize+1).join('  ');

      var ascii = '';
      var line = '';
      for (y = 0; y < size; y += 1) {
        r = Math.floor( (y - min) / cellSize);
        line = '';
        for (x = 0; x < size; x += 1) {
          p = 1;

          if (min <= x && x < max && min <= y && y < max && _this.isDark(r, Math.floor((x - min) / cellSize))) {
            p = 0;
          }

          // Output 2 characters per pixel, to create full square. 1 character per pixels gives only half width of square.
          line += p ? white : black;
        }

        for (r = 0; r < cellSize; r += 1) {
          ascii += line + '\n';
        }
      }

      return ascii.substring(0, ascii.length-1);
    };

    _this.renderTo2dContext = function(context, cellSize) {
      cellSize = cellSize || 2;
      var length = _this.getModuleCount();
      for (var row = 0; row < length; row++) {
        for (var col = 0; col < length; col++) {
          context.fillStyle = _this.isDark(row, col) ? 'black' : 'white';
          context.fillRect(row * cellSize, col * cellSize, cellSize, cellSize);
        }
      }
    }

    return _this;
  };

  //---------------------------------------------------------------------
  // qrcode.stringToBytes
  //---------------------------------------------------------------------

  qrcode.stringToBytesFuncs = {
    'default' : function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        bytes.push(c & 0xff);
      }
      return bytes;
    }
  };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['default'];

  //---------------------------------------------------------------------
  // qrcode.createStringToBytes
  //---------------------------------------------------------------------

  /**
   * @param unicodeData base64 string of byte array.
   * [16bit Unicode],[16bit Bytes], ...
   * @param numChars
   */
  qrcode.createStringToBytes = function(unicodeData, numChars) {

    // create conversion map.

    var unicodeMap = function() {

      var bin = base64DecodeInputStream(unicodeData);
      var read = function() {
        var b = bin.read();
        if (b == -1) throw 'eof';
        return b;
      };

      var count = 0;
      var unicodeMap = {};
      while (true) {
        var b0 = bin.read();
        if (b0 == -1) break;
        var b1 = read();
        var b2 = read();
        var b3 = read();
        var k = String.fromCharCode( (b0 << 8) | b1);
        var v = (b2 << 8) | b3;
        unicodeMap[k] = v;
        count += 1;
      }
      if (count != numChars) {
        throw count + ' != ' + numChars;
      }

      return unicodeMap;
    }();

    var unknownChar = '?'.charCodeAt(0);

    return function(s) {
      var bytes = [];
      for (var i = 0; i < s.length; i += 1) {
        var c = s.charCodeAt(i);
        if (c < 128) {
          bytes.push(c);
        } else {
          var b = unicodeMap[s.charAt(i)];
          if (typeof b == 'number') {
            if ( (b & 0xff) == b) {
              // 1byte
              bytes.push(b);
            } else {
              // 2bytes
              bytes.push(b >>> 8);
              bytes.push(b & 0xff);
            }
          } else {
            bytes.push(unknownChar);
          }
        }
      }
      return bytes;
    };
  };

  //---------------------------------------------------------------------
  // QRMode
  //---------------------------------------------------------------------

  var QRMode = {
    MODE_NUMBER :    1 << 0,
    MODE_ALPHA_NUM : 1 << 1,
    MODE_8BIT_BYTE : 1 << 2,
    MODE_KANJI :     1 << 3
  };

  //---------------------------------------------------------------------
  // QRErrorCorrectionLevel
  //---------------------------------------------------------------------

  var QRErrorCorrectionLevel = {
    L : 1,
    M : 0,
    Q : 3,
    H : 2
  };

  //---------------------------------------------------------------------
  // QRMaskPattern
  //---------------------------------------------------------------------

  var QRMaskPattern = {
    PATTERN000 : 0,
    PATTERN001 : 1,
    PATTERN010 : 2,
    PATTERN011 : 3,
    PATTERN100 : 4,
    PATTERN101 : 5,
    PATTERN110 : 6,
    PATTERN111 : 7
  };

  //---------------------------------------------------------------------
  // QRUtil
  //---------------------------------------------------------------------

  var QRUtil = function() {

    var PATTERN_POSITION_TABLE = [
      [],
      [6, 18],
      [6, 22],
      [6, 26],
      [6, 30],
      [6, 34],
      [6, 22, 38],
      [6, 24, 42],
      [6, 26, 46],
      [6, 28, 50],
      [6, 30, 54],
      [6, 32, 58],
      [6, 34, 62],
      [6, 26, 46, 66],
      [6, 26, 48, 70],
      [6, 26, 50, 74],
      [6, 30, 54, 78],
      [6, 30, 56, 82],
      [6, 30, 58, 86],
      [6, 34, 62, 90],
      [6, 28, 50, 72, 94],
      [6, 26, 50, 74, 98],
      [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106],
      [6, 32, 58, 84, 110],
      [6, 30, 58, 86, 114],
      [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122],
      [6, 30, 54, 78, 102, 126],
      [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134],
      [6, 34, 60, 86, 112, 138],
      [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146],
      [6, 30, 54, 78, 102, 126, 150],
      [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158],
      [6, 32, 58, 84, 110, 136, 162],
      [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ];
    var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
    var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
    var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

    var _this = {};

    var getBCHDigit = function(data) {
      var digit = 0;
      while (data != 0) {
        digit += 1;
        data >>>= 1;
      }
      return digit;
    };

    _this.getBCHTypeInfo = function(data) {
      var d = data << 10;
      while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
        d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
      }
      return ( (data << 10) | d) ^ G15_MASK;
    };

    _this.getBCHTypeNumber = function(data) {
      var d = data << 12;
      while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
        d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
      }
      return (data << 12) | d;
    };

    _this.getPatternPosition = function(typeNumber) {
      return PATTERN_POSITION_TABLE[typeNumber - 1];
    };

    _this.getMaskFunction = function(maskPattern) {

      switch (maskPattern) {

      case QRMaskPattern.PATTERN000 :
        return function(i, j) { return (i + j) % 2 == 0; };
      case QRMaskPattern.PATTERN001 :
        return function(i, j) { return i % 2 == 0; };
      case QRMaskPattern.PATTERN010 :
        return function(i, j) { return j % 3 == 0; };
      case QRMaskPattern.PATTERN011 :
        return function(i, j) { return (i + j) % 3 == 0; };
      case QRMaskPattern.PATTERN100 :
        return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
      case QRMaskPattern.PATTERN101 :
        return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
      case QRMaskPattern.PATTERN110 :
        return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
      case QRMaskPattern.PATTERN111 :
        return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

      default :
        throw 'bad maskPattern:' + maskPattern;
      }
    };

    _this.getErrorCorrectPolynomial = function(errorCorrectLength) {
      var a = qrPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i += 1) {
        a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
      }
      return a;
    };

    _this.getLengthInBits = function(mode, type) {

      if (1 <= type && type < 10) {

        // 1 - 9

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 10;
        case QRMode.MODE_ALPHA_NUM : return 9;
        case QRMode.MODE_8BIT_BYTE : return 8;
        case QRMode.MODE_KANJI     : return 8;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 27) {

        // 10 - 26

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 12;
        case QRMode.MODE_ALPHA_NUM : return 11;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 10;
        default :
          throw 'mode:' + mode;
        }

      } else if (type < 41) {

        // 27 - 40

        switch(mode) {
        case QRMode.MODE_NUMBER    : return 14;
        case QRMode.MODE_ALPHA_NUM : return 13;
        case QRMode.MODE_8BIT_BYTE : return 16;
        case QRMode.MODE_KANJI     : return 12;
        default :
          throw 'mode:' + mode;
        }

      } else {
        throw 'type:' + type;
      }
    };

    _this.getLostPoint = function(qrcode) {

      var moduleCount = qrcode.getModuleCount();

      var lostPoint = 0;

      // LEVEL1

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount; col += 1) {

          var sameCount = 0;
          var dark = qrcode.isDark(row, col);

          for (var r = -1; r <= 1; r += 1) {

            if (row + r < 0 || moduleCount <= row + r) {
              continue;
            }

            for (var c = -1; c <= 1; c += 1) {

              if (col + c < 0 || moduleCount <= col + c) {
                continue;
              }

              if (r == 0 && c == 0) {
                continue;
              }

              if (dark == qrcode.isDark(row + r, col + c) ) {
                sameCount += 1;
              }
            }
          }

          if (sameCount > 5) {
            lostPoint += (3 + sameCount - 5);
          }
        }
      };

      // LEVEL2

      for (var row = 0; row < moduleCount - 1; row += 1) {
        for (var col = 0; col < moduleCount - 1; col += 1) {
          var count = 0;
          if (qrcode.isDark(row, col) ) count += 1;
          if (qrcode.isDark(row + 1, col) ) count += 1;
          if (qrcode.isDark(row, col + 1) ) count += 1;
          if (qrcode.isDark(row + 1, col + 1) ) count += 1;
          if (count == 0 || count == 4) {
            lostPoint += 3;
          }
        }
      }

      // LEVEL3

      for (var row = 0; row < moduleCount; row += 1) {
        for (var col = 0; col < moduleCount - 6; col += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row, col + 1)
              &&  qrcode.isDark(row, col + 2)
              &&  qrcode.isDark(row, col + 3)
              &&  qrcode.isDark(row, col + 4)
              && !qrcode.isDark(row, col + 5)
              &&  qrcode.isDark(row, col + 6) ) {
            lostPoint += 40;
          }
        }
      }

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount - 6; row += 1) {
          if (qrcode.isDark(row, col)
              && !qrcode.isDark(row + 1, col)
              &&  qrcode.isDark(row + 2, col)
              &&  qrcode.isDark(row + 3, col)
              &&  qrcode.isDark(row + 4, col)
              && !qrcode.isDark(row + 5, col)
              &&  qrcode.isDark(row + 6, col) ) {
            lostPoint += 40;
          }
        }
      }

      // LEVEL4

      var darkCount = 0;

      for (var col = 0; col < moduleCount; col += 1) {
        for (var row = 0; row < moduleCount; row += 1) {
          if (qrcode.isDark(row, col) ) {
            darkCount += 1;
          }
        }
      }

      var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
      lostPoint += ratio * 10;

      return lostPoint;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // QRMath
  //---------------------------------------------------------------------

  var QRMath = function() {

    var EXP_TABLE = new Array(256);
    var LOG_TABLE = new Array(256);

    // initialize tables
    for (var i = 0; i < 8; i += 1) {
      EXP_TABLE[i] = 1 << i;
    }
    for (var i = 8; i < 256; i += 1) {
      EXP_TABLE[i] = EXP_TABLE[i - 4]
        ^ EXP_TABLE[i - 5]
        ^ EXP_TABLE[i - 6]
        ^ EXP_TABLE[i - 8];
    }
    for (var i = 0; i < 255; i += 1) {
      LOG_TABLE[EXP_TABLE[i] ] = i;
    }

    var _this = {};

    _this.glog = function(n) {

      if (n < 1) {
        throw 'glog(' + n + ')';
      }

      return LOG_TABLE[n];
    };

    _this.gexp = function(n) {

      while (n < 0) {
        n += 255;
      }

      while (n >= 256) {
        n -= 255;
      }

      return EXP_TABLE[n];
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrPolynomial
  //---------------------------------------------------------------------

  function qrPolynomial(num, shift) {

    if (typeof num.length == 'undefined') {
      throw num.length + '/' + shift;
    }

    var _num = function() {
      var offset = 0;
      while (offset < num.length && num[offset] == 0) {
        offset += 1;
      }
      var _num = new Array(num.length - offset + shift);
      for (var i = 0; i < num.length - offset; i += 1) {
        _num[i] = num[i + offset];
      }
      return _num;
    }();

    var _this = {};

    _this.getAt = function(index) {
      return _num[index];
    };

    _this.getLength = function() {
      return _num.length;
    };

    _this.multiply = function(e) {

      var num = new Array(_this.getLength() + e.getLength() - 1);

      for (var i = 0; i < _this.getLength(); i += 1) {
        for (var j = 0; j < e.getLength(); j += 1) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
        }
      }

      return qrPolynomial(num, 0);
    };

    _this.mod = function(e) {

      if (_this.getLength() - e.getLength() < 0) {
        return _this;
      }

      var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

      var num = new Array(_this.getLength() );
      for (var i = 0; i < _this.getLength(); i += 1) {
        num[i] = _this.getAt(i);
      }

      for (var i = 0; i < e.getLength(); i += 1) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
      }

      // recursive call
      return qrPolynomial(num, 0).mod(e);
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // QRRSBlock
  //---------------------------------------------------------------------

  var QRRSBlock = function() {

    var RS_BLOCK_TABLE = [

      // L
      // M
      // Q
      // H

      // 1
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],

      // 2
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],

      // 3
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],

      // 4
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],

      // 5
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],

      // 6
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],

      // 7
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],

      // 8
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],

      // 9
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],

      // 10
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],

      // 11
      [4, 101, 81],
      [1, 80, 50, 4, 81, 51],
      [4, 50, 22, 4, 51, 23],
      [3, 36, 12, 8, 37, 13],

      // 12
      [2, 116, 92, 2, 117, 93],
      [6, 58, 36, 2, 59, 37],
      [4, 46, 20, 6, 47, 21],
      [7, 42, 14, 4, 43, 15],

      // 13
      [4, 133, 107],
      [8, 59, 37, 1, 60, 38],
      [8, 44, 20, 4, 45, 21],
      [12, 33, 11, 4, 34, 12],

      // 14
      [3, 145, 115, 1, 146, 116],
      [4, 64, 40, 5, 65, 41],
      [11, 36, 16, 5, 37, 17],
      [11, 36, 12, 5, 37, 13],

      // 15
      [5, 109, 87, 1, 110, 88],
      [5, 65, 41, 5, 66, 42],
      [5, 54, 24, 7, 55, 25],
      [11, 36, 12, 7, 37, 13],

      // 16
      [5, 122, 98, 1, 123, 99],
      [7, 73, 45, 3, 74, 46],
      [15, 43, 19, 2, 44, 20],
      [3, 45, 15, 13, 46, 16],

      // 17
      [1, 135, 107, 5, 136, 108],
      [10, 74, 46, 1, 75, 47],
      [1, 50, 22, 15, 51, 23],
      [2, 42, 14, 17, 43, 15],

      // 18
      [5, 150, 120, 1, 151, 121],
      [9, 69, 43, 4, 70, 44],
      [17, 50, 22, 1, 51, 23],
      [2, 42, 14, 19, 43, 15],

      // 19
      [3, 141, 113, 4, 142, 114],
      [3, 70, 44, 11, 71, 45],
      [17, 47, 21, 4, 48, 22],
      [9, 39, 13, 16, 40, 14],

      // 20
      [3, 135, 107, 5, 136, 108],
      [3, 67, 41, 13, 68, 42],
      [15, 54, 24, 5, 55, 25],
      [15, 43, 15, 10, 44, 16],

      // 21
      [4, 144, 116, 4, 145, 117],
      [17, 68, 42],
      [17, 50, 22, 6, 51, 23],
      [19, 46, 16, 6, 47, 17],

      // 22
      [2, 139, 111, 7, 140, 112],
      [17, 74, 46],
      [7, 54, 24, 16, 55, 25],
      [34, 37, 13],

      // 23
      [4, 151, 121, 5, 152, 122],
      [4, 75, 47, 14, 76, 48],
      [11, 54, 24, 14, 55, 25],
      [16, 45, 15, 14, 46, 16],

      // 24
      [6, 147, 117, 4, 148, 118],
      [6, 73, 45, 14, 74, 46],
      [11, 54, 24, 16, 55, 25],
      [30, 46, 16, 2, 47, 17],

      // 25
      [8, 132, 106, 4, 133, 107],
      [8, 75, 47, 13, 76, 48],
      [7, 54, 24, 22, 55, 25],
      [22, 45, 15, 13, 46, 16],

      // 26
      [10, 142, 114, 2, 143, 115],
      [19, 74, 46, 4, 75, 47],
      [28, 50, 22, 6, 51, 23],
      [33, 46, 16, 4, 47, 17],

      // 27
      [8, 152, 122, 4, 153, 123],
      [22, 73, 45, 3, 74, 46],
      [8, 53, 23, 26, 54, 24],
      [12, 45, 15, 28, 46, 16],

      // 28
      [3, 147, 117, 10, 148, 118],
      [3, 73, 45, 23, 74, 46],
      [4, 54, 24, 31, 55, 25],
      [11, 45, 15, 31, 46, 16],

      // 29
      [7, 146, 116, 7, 147, 117],
      [21, 73, 45, 7, 74, 46],
      [1, 53, 23, 37, 54, 24],
      [19, 45, 15, 26, 46, 16],

      // 30
      [5, 145, 115, 10, 146, 116],
      [19, 75, 47, 10, 76, 48],
      [15, 54, 24, 25, 55, 25],
      [23, 45, 15, 25, 46, 16],

      // 31
      [13, 145, 115, 3, 146, 116],
      [2, 74, 46, 29, 75, 47],
      [42, 54, 24, 1, 55, 25],
      [23, 45, 15, 28, 46, 16],

      // 32
      [17, 145, 115],
      [10, 74, 46, 23, 75, 47],
      [10, 54, 24, 35, 55, 25],
      [19, 45, 15, 35, 46, 16],

      // 33
      [17, 145, 115, 1, 146, 116],
      [14, 74, 46, 21, 75, 47],
      [29, 54, 24, 19, 55, 25],
      [11, 45, 15, 46, 46, 16],

      // 34
      [13, 145, 115, 6, 146, 116],
      [14, 74, 46, 23, 75, 47],
      [44, 54, 24, 7, 55, 25],
      [59, 46, 16, 1, 47, 17],

      // 35
      [12, 151, 121, 7, 152, 122],
      [12, 75, 47, 26, 76, 48],
      [39, 54, 24, 14, 55, 25],
      [22, 45, 15, 41, 46, 16],

      // 36
      [6, 151, 121, 14, 152, 122],
      [6, 75, 47, 34, 76, 48],
      [46, 54, 24, 10, 55, 25],
      [2, 45, 15, 64, 46, 16],

      // 37
      [17, 152, 122, 4, 153, 123],
      [29, 74, 46, 14, 75, 47],
      [49, 54, 24, 10, 55, 25],
      [24, 45, 15, 46, 46, 16],

      // 38
      [4, 152, 122, 18, 153, 123],
      [13, 74, 46, 32, 75, 47],
      [48, 54, 24, 14, 55, 25],
      [42, 45, 15, 32, 46, 16],

      // 39
      [20, 147, 117, 4, 148, 118],
      [40, 75, 47, 7, 76, 48],
      [43, 54, 24, 22, 55, 25],
      [10, 45, 15, 67, 46, 16],

      // 40
      [19, 148, 118, 6, 149, 119],
      [18, 75, 47, 31, 76, 48],
      [34, 54, 24, 34, 55, 25],
      [20, 45, 15, 61, 46, 16]
    ];

    var qrRSBlock = function(totalCount, dataCount) {
      var _this = {};
      _this.totalCount = totalCount;
      _this.dataCount = dataCount;
      return _this;
    };

    var _this = {};

    var getRsBlockTable = function(typeNumber, errorCorrectionLevel) {

      switch(errorCorrectionLevel) {
      case QRErrorCorrectionLevel.L :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case QRErrorCorrectionLevel.M :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case QRErrorCorrectionLevel.Q :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case QRErrorCorrectionLevel.H :
        return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default :
        return undefined;
      }
    };

    _this.getRSBlocks = function(typeNumber, errorCorrectionLevel) {

      var rsBlock = getRsBlockTable(typeNumber, errorCorrectionLevel);

      if (typeof rsBlock == 'undefined') {
        throw 'bad rs block @ typeNumber:' + typeNumber +
            '/errorCorrectionLevel:' + errorCorrectionLevel;
      }

      var length = rsBlock.length / 3;

      var list = [];

      for (var i = 0; i < length; i += 1) {

        var count = rsBlock[i * 3 + 0];
        var totalCount = rsBlock[i * 3 + 1];
        var dataCount = rsBlock[i * 3 + 2];

        for (var j = 0; j < count; j += 1) {
          list.push(qrRSBlock(totalCount, dataCount) );
        }
      }

      return list;
    };

    return _this;
  }();

  //---------------------------------------------------------------------
  // qrBitBuffer
  //---------------------------------------------------------------------

  var qrBitBuffer = function() {

    var _buffer = [];
    var _length = 0;

    var _this = {};

    _this.getBuffer = function() {
      return _buffer;
    };

    _this.getAt = function(index) {
      var bufIndex = Math.floor(index / 8);
      return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
    };

    _this.put = function(num, length) {
      for (var i = 0; i < length; i += 1) {
        _this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
      }
    };

    _this.getLengthInBits = function() {
      return _length;
    };

    _this.putBit = function(bit) {

      var bufIndex = Math.floor(_length / 8);
      if (_buffer.length <= bufIndex) {
        _buffer.push(0);
      }

      if (bit) {
        _buffer[bufIndex] |= (0x80 >>> (_length % 8) );
      }

      _length += 1;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrNumber
  //---------------------------------------------------------------------

  var qrNumber = function(data) {

    var _mode = QRMode.MODE_NUMBER;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var data = _data;

      var i = 0;

      while (i + 2 < data.length) {
        buffer.put(strToNum(data.substring(i, i + 3) ), 10);
        i += 3;
      }

      if (i < data.length) {
        if (data.length - i == 1) {
          buffer.put(strToNum(data.substring(i, i + 1) ), 4);
        } else if (data.length - i == 2) {
          buffer.put(strToNum(data.substring(i, i + 2) ), 7);
        }
      }
    };

    var strToNum = function(s) {
      var num = 0;
      for (var i = 0; i < s.length; i += 1) {
        num = num * 10 + chatToNum(s.charAt(i) );
      }
      return num;
    };

    var chatToNum = function(c) {
      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      }
      throw 'illegal char :' + c;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrAlphaNum
  //---------------------------------------------------------------------

  var qrAlphaNum = function(data) {

    var _mode = QRMode.MODE_ALPHA_NUM;
    var _data = data;

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _data.length;
    };

    _this.write = function(buffer) {

      var s = _data;

      var i = 0;

      while (i + 1 < s.length) {
        buffer.put(
          getCode(s.charAt(i) ) * 45 +
          getCode(s.charAt(i + 1) ), 11);
        i += 2;
      }

      if (i < s.length) {
        buffer.put(getCode(s.charAt(i) ), 6);
      }
    };

    var getCode = function(c) {

      if ('0' <= c && c <= '9') {
        return c.charCodeAt(0) - '0'.charCodeAt(0);
      } else if ('A' <= c && c <= 'Z') {
        return c.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
      } else {
        switch (c) {
        case ' ' : return 36;
        case '$' : return 37;
        case '%' : return 38;
        case '*' : return 39;
        case '+' : return 40;
        case '-' : return 41;
        case '.' : return 42;
        case '/' : return 43;
        case ':' : return 44;
        default :
          throw 'illegal char :' + c;
        }
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qr8BitByte
  //---------------------------------------------------------------------

  var qr8BitByte = function(data) {

    var _mode = QRMode.MODE_8BIT_BYTE;
    var _data = data;
    var _bytes = qrcode.stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return _bytes.length;
    };

    _this.write = function(buffer) {
      for (var i = 0; i < _bytes.length; i += 1) {
        buffer.put(_bytes[i], 8);
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // qrKanji
  //---------------------------------------------------------------------

  var qrKanji = function(data) {

    var _mode = QRMode.MODE_KANJI;
    var _data = data;

    var stringToBytes = qrcode.stringToBytesFuncs['SJIS'];
    if (!stringToBytes) {
      throw 'sjis not supported.';
    }
    !function(c, code) {
      // self test for sjis support.
      var test = stringToBytes(c);
      if (test.length != 2 || ( (test[0] << 8) | test[1]) != code) {
        throw 'sjis not supported.';
      }
    }('\u53cb', 0x9746);

    var _bytes = stringToBytes(data);

    var _this = {};

    _this.getMode = function() {
      return _mode;
    };

    _this.getLength = function(buffer) {
      return ~~(_bytes.length / 2);
    };

    _this.write = function(buffer) {

      var data = _bytes;

      var i = 0;

      while (i + 1 < data.length) {

        var c = ( (0xff & data[i]) << 8) | (0xff & data[i + 1]);

        if (0x8140 <= c && c <= 0x9FFC) {
          c -= 0x8140;
        } else if (0xE040 <= c && c <= 0xEBBF) {
          c -= 0xC140;
        } else {
          throw 'illegal char at ' + (i + 1) + '/' + c;
        }

        c = ( (c >>> 8) & 0xff) * 0xC0 + (c & 0xff);

        buffer.put(c, 13);

        i += 2;
      }

      if (i < data.length) {
        throw 'illegal char at ' + (i + 1);
      }
    };

    return _this;
  };

  //=====================================================================
  // GIF Support etc.
  //

  //---------------------------------------------------------------------
  // byteArrayOutputStream
  //---------------------------------------------------------------------

  var byteArrayOutputStream = function() {

    var _bytes = [];

    var _this = {};

    _this.writeByte = function(b) {
      _bytes.push(b & 0xff);
    };

    _this.writeShort = function(i) {
      _this.writeByte(i);
      _this.writeByte(i >>> 8);
    };

    _this.writeBytes = function(b, off, len) {
      off = off || 0;
      len = len || b.length;
      for (var i = 0; i < len; i += 1) {
        _this.writeByte(b[i + off]);
      }
    };

    _this.writeString = function(s) {
      for (var i = 0; i < s.length; i += 1) {
        _this.writeByte(s.charCodeAt(i) );
      }
    };

    _this.toByteArray = function() {
      return _bytes;
    };

    _this.toString = function() {
      var s = '';
      s += '[';
      for (var i = 0; i < _bytes.length; i += 1) {
        if (i > 0) {
          s += ',';
        }
        s += _bytes[i];
      }
      s += ']';
      return s;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64EncodeOutputStream
  //---------------------------------------------------------------------

  var base64EncodeOutputStream = function() {

    var _buffer = 0;
    var _buflen = 0;
    var _length = 0;
    var _base64 = '';

    var _this = {};

    var writeEncoded = function(b) {
      _base64 += String.fromCharCode(encode(b & 0x3f) );
    };

    var encode = function(n) {
      if (n < 0) {
        // error.
      } else if (n < 26) {
        return 0x41 + n;
      } else if (n < 52) {
        return 0x61 + (n - 26);
      } else if (n < 62) {
        return 0x30 + (n - 52);
      } else if (n == 62) {
        return 0x2b;
      } else if (n == 63) {
        return 0x2f;
      }
      throw 'n:' + n;
    };

    _this.writeByte = function(n) {

      _buffer = (_buffer << 8) | (n & 0xff);
      _buflen += 8;
      _length += 1;

      while (_buflen >= 6) {
        writeEncoded(_buffer >>> (_buflen - 6) );
        _buflen -= 6;
      }
    };

    _this.flush = function() {

      if (_buflen > 0) {
        writeEncoded(_buffer << (6 - _buflen) );
        _buffer = 0;
        _buflen = 0;
      }

      if (_length % 3 != 0) {
        // padding
        var padlen = 3 - _length % 3;
        for (var i = 0; i < padlen; i += 1) {
          _base64 += '=';
        }
      }
    };

    _this.toString = function() {
      return _base64;
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // base64DecodeInputStream
  //---------------------------------------------------------------------

  var base64DecodeInputStream = function(str) {

    var _str = str;
    var _pos = 0;
    var _buffer = 0;
    var _buflen = 0;

    var _this = {};

    _this.read = function() {

      while (_buflen < 8) {

        if (_pos >= _str.length) {
          if (_buflen == 0) {
            return -1;
          }
          throw 'unexpected end of file./' + _buflen;
        }

        var c = _str.charAt(_pos);
        _pos += 1;

        if (c == '=') {
          _buflen = 0;
          return -1;
        } else if (c.match(/^\s$/) ) {
          // ignore if whitespace.
          continue;
        }

        _buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
        _buflen += 6;
      }

      var n = (_buffer >>> (_buflen - 8) ) & 0xff;
      _buflen -= 8;
      return n;
    };

    var decode = function(c) {
      if (0x41 <= c && c <= 0x5a) {
        return c - 0x41;
      } else if (0x61 <= c && c <= 0x7a) {
        return c - 0x61 + 26;
      } else if (0x30 <= c && c <= 0x39) {
        return c - 0x30 + 52;
      } else if (c == 0x2b) {
        return 62;
      } else if (c == 0x2f) {
        return 63;
      } else {
        throw 'c:' + c;
      }
    };

    return _this;
  };

  //---------------------------------------------------------------------
  // gifImage (B/W)
  //---------------------------------------------------------------------

  var gifImage = function(width, height) {

    var _width = width;
    var _height = height;
    var _data = new Array(width * height);

    var _this = {};

    _this.setPixel = function(x, y, pixel) {
      _data[y * _width + x] = pixel;
    };

    _this.write = function(out) {

      //---------------------------------
      // GIF Signature

      out.writeString('GIF87a');

      //---------------------------------
      // Screen Descriptor

      out.writeShort(_width);
      out.writeShort(_height);

      out.writeByte(0x80); // 2bit
      out.writeByte(0);
      out.writeByte(0);

      //---------------------------------
      // Global Color Map

      // black
      out.writeByte(0x00);
      out.writeByte(0x00);
      out.writeByte(0x00);

      // white
      out.writeByte(0xff);
      out.writeByte(0xff);
      out.writeByte(0xff);

      //---------------------------------
      // Image Descriptor

      out.writeString(',');
      out.writeShort(0);
      out.writeShort(0);
      out.writeShort(_width);
      out.writeShort(_height);
      out.writeByte(0);

      //---------------------------------
      // Local Color Map

      //---------------------------------
      // Raster Data

      var lzwMinCodeSize = 2;
      var raster = getLZWRaster(lzwMinCodeSize);

      out.writeByte(lzwMinCodeSize);

      var offset = 0;

      while (raster.length - offset > 255) {
        out.writeByte(255);
        out.writeBytes(raster, offset, 255);
        offset += 255;
      }

      out.writeByte(raster.length - offset);
      out.writeBytes(raster, offset, raster.length - offset);
      out.writeByte(0x00);

      //---------------------------------
      // GIF Terminator
      out.writeString(';');
    };

    var bitOutputStream = function(out) {

      var _out = out;
      var _bitLength = 0;
      var _bitBuffer = 0;

      var _this = {};

      _this.write = function(data, length) {

        if ( (data >>> length) != 0) {
          throw 'length over';
        }

        while (_bitLength + length >= 8) {
          _out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
          length -= (8 - _bitLength);
          data >>>= (8 - _bitLength);
          _bitBuffer = 0;
          _bitLength = 0;
        }

        _bitBuffer = (data << _bitLength) | _bitBuffer;
        _bitLength = _bitLength + length;
      };

      _this.flush = function() {
        if (_bitLength > 0) {
          _out.writeByte(_bitBuffer);
        }
      };

      return _this;
    };

    var getLZWRaster = function(lzwMinCodeSize) {

      var clearCode = 1 << lzwMinCodeSize;
      var endCode = (1 << lzwMinCodeSize) + 1;
      var bitLength = lzwMinCodeSize + 1;

      // Setup LZWTable
      var table = lzwTable();

      for (var i = 0; i < clearCode; i += 1) {
        table.add(String.fromCharCode(i) );
      }
      table.add(String.fromCharCode(clearCode) );
      table.add(String.fromCharCode(endCode) );

      var byteOut = byteArrayOutputStream();
      var bitOut = bitOutputStream(byteOut);

      // clear code
      bitOut.write(clearCode, bitLength);

      var dataIndex = 0;

      var s = String.fromCharCode(_data[dataIndex]);
      dataIndex += 1;

      while (dataIndex < _data.length) {

        var c = String.fromCharCode(_data[dataIndex]);
        dataIndex += 1;

        if (table.contains(s + c) ) {

          s = s + c;

        } else {

          bitOut.write(table.indexOf(s), bitLength);

          if (table.size() < 0xfff) {

            if (table.size() == (1 << bitLength) ) {
              bitLength += 1;
            }

            table.add(s + c);
          }

          s = c;
        }
      }

      bitOut.write(table.indexOf(s), bitLength);

      // end code
      bitOut.write(endCode, bitLength);

      bitOut.flush();

      return byteOut.toByteArray();
    };

    var lzwTable = function() {

      var _map = {};
      var _size = 0;

      var _this = {};

      _this.add = function(key) {
        if (_this.contains(key) ) {
          throw 'dup key:' + key;
        }
        _map[key] = _size;
        _size += 1;
      };

      _this.size = function() {
        return _size;
      };

      _this.indexOf = function(key) {
        return _map[key];
      };

      _this.contains = function(key) {
        return typeof _map[key] != 'undefined';
      };

      return _this;
    };

    return _this;
  };

  var createDataURL = function(width, height, getPixel) {
    var gif = gifImage(width, height);
    for (var y = 0; y < height; y += 1) {
      for (var x = 0; x < width; x += 1) {
        gif.setPixel(x, y, getPixel(x, y) );
      }
    }

    var b = byteArrayOutputStream();
    gif.write(b);

    var base64 = base64EncodeOutputStream();
    var bytes = b.toByteArray();
    for (var i = 0; i < bytes.length; i += 1) {
      base64.writeByte(bytes[i]);
    }
    base64.flush();

    return 'data:image/gif;base64,' + base64;
  };

  //---------------------------------------------------------------------
  // returns qrcode function.

  return qrcode;
}();

// multibyte support
!function() {

  qrcode.stringToBytesFuncs['UTF-8'] = function(s) {
    // http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
    function toUTF8Array(str) {
      var utf8 = [];
      for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
          utf8.push(0xc0 | (charcode >> 6),
              0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
          utf8.push(0xe0 | (charcode >> 12),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
          i++;
          // UTF-16 encodes 0x10000-0x10FFFF by
          // subtracting 0x10000 and splitting the
          // 20 bits of 0x0-0xFFFFF into two halves
          charcode = 0x10000 + (((charcode & 0x3ff)<<10)
            | (str.charCodeAt(i) & 0x3ff));
          utf8.push(0xf0 | (charcode >>18),
              0x80 | ((charcode>>12) & 0x3f),
              0x80 | ((charcode>>6) & 0x3f),
              0x80 | (charcode & 0x3f));
        }
      }
      return utf8;
    }
    return toUTF8Array(s);
  };

}();

(function (factory) {
  if (typeof define === 'function' && define.amd) {
      define([], factory);
  } else if (typeof exports === 'object') {
      module.exports = factory();
  }
}(function () {
    return qrcode;
}));

return qrcode;
})();
const modules = Object.create(null);

// ---- shared.js ----
modules["shared.js"] = (() => {
// Shared browser helpers; no framework, wallet or secret material belongs here.
 const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
 function units(value = '0', decimal = 18) {
  const raw = String(value);
  if (!/^\d+$/.test(raw) || !Number.isInteger(Number(decimal)) || decimal < 0 || decimal > 36) return '—';
  const digits = raw.padStart(Number(decimal) + 1, '0');
  if (!Number(decimal)) return BigInt(raw).toString();
  return `${BigInt(digits.slice(0, -decimal))}${digits.slice(-decimal).replace(/0+$/, '') ? '.' + digits.slice(-decimal).replace(/0+$/, '') : ''}`;
}
 function toUnits(value, decimal = 18) {
  const text = String(value);
  const precision = Number(decimal);
  if (!/^\d+(\.\d+)?$/.test(text) || !Number.isInteger(precision) || precision < 0 || precision > 36)
    throw new Error('Enter a valid token amount.');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > precision) throw new Error(`Use at most ${precision} decimal places.`);
  return BigInt(whole + fraction.padEnd(precision, '0'));
}
// Display rounding is separate from exact transaction units and form values.
 function amountText(value) {
  const text = String(value ?? '');
  const match = text.match(/^(\d+(?:\.\d+)?)(\s+[A-Za-z][A-Za-z0-9]*)?$/);
  if (!match) return text;
  const [whole, fraction = ''] = match[1].split('.');
  const scaled = BigInt(whole + fraction.slice(0, 4).padEnd(4, '0')) + (Number(fraction[4] || 0) >= 5 ? 1n : 0n);
  const digits = scaled.toString().padStart(5, '0');
  const tail = digits.slice(-4).replace(/0+$/, '');
  return BigInt(digits.slice(0, -4)).toString() + (tail ? '.' + tail : '') + (match[2] || '');
}
 function shortDid(value) {
  const address = String(value).replace(/^did:abt:/, '');
  return address.length > 10 ? address.slice(0, 6) + '...' + address.slice(-4).toUpperCase() : address;
}
 function didMarkup(value, t = (key) => key, { full = false } = {}) {
  const raw = String(value ?? '—');
  if (!/^(did:abt:[A-Za-z0-9-]+|z[1-9A-HJ-NP-Za-km-z]{20,64})$/.test(raw)) return escapeHtml(raw);
  const icon = (path) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${path}</svg>`;
  const display = full ? raw : shortDid(raw);
  return `<span class="dm-did${full ? ' dm-did-full' : ''}" dir="ltr"><button type="button" class="dm-did-value" data-did-show="${escapeHtml(raw)}" aria-label="${escapeHtml(t('DID details'))}: ${escapeHtml(display)}">${escapeHtml(display)}</button><button type="button" class="dm-did-icon" data-did-copy="${escapeHtml(raw)}" aria-label="${escapeHtml(t('Copy DID'))}">${icon('<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>')}</button><button type="button" class="dm-did-icon" data-did-show="${escapeHtml(raw)}" aria-label="${escapeHtml(t('DID QR code'))}">${icon('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/>')}</button></span>`;
}
 function tokenText(token, empty = 'NO BALANCE') {
  return token?.value != null ? `${amountText(units(token.value, token.decimal ?? 18))} ${token.symbol || ''}` : empty;
}
// Account/header display only. Transaction amounts and token selection are unchanged.
 function accountBalanceText(token, { unavailable = false, knownEmpty = false, empty = '—' } = {}) {
  const unknown = { summary: '—', exact: null };
  if (unavailable) return unknown;
  if (token == null) return knownEmpty ? { summary: empty, exact: empty } : unknown;
  const raw = token.value;
  if (
    !['string', 'bigint', 'number'].includes(typeof raw) ||
    (typeof raw === 'number' && (!Number.isSafeInteger(raw) || raw < 0)) ||
    !/^\d+$/.test(String(raw))
  ) return unknown;
  const scale = token.decimal;
  if (
    !((typeof scale === 'number' && Number.isInteger(scale)) ||
      (typeof scale === 'string' && /^(0|[1-9]\d?)$/.test(scale))) ||
    Number(scale) < 0 || Number(scale) > 36
  ) return unknown;
  const amount = units(String(raw), scale);
  if (amount === '—') return unknown;
  const suffix = token.symbol ? ` ${token.symbol}` : '';
  return { summary: amountText(amount) + suffix, exact: amount + suffix };
}
 function canAfford(tokens, cost) {
  if (!cost || !/^\d+$/.test(String(cost.value))) return false;
  const balance = tokens?.find(
    (token) =>
      (cost.address && token.address ? token.address === cost.address : token.symbol === cost.symbol) &&
      Number(token.decimal ?? 18) === Number(cost.decimal ?? 18),
  );
  return Boolean(balance && /^\d+$/.test(String(balance.value)) && BigInt(balance.value) >= BigInt(cost.value));
}
const pendingReads = new Map();
const mutationListeners = new Set();
 function onMutation(listener) {
  mutationListeners.add(listener);
  return () => mutationListeners.delete(listener);
}
async function notifyMutation(phase, path) {
  await Promise.all([...mutationListeners].map((listener) => listener(phase, path)));
}
 function request(path, options = {}) {
  if ((options.method || 'GET') !== 'GET') {
    return (async () => {
      pendingReads.clear();
      await notifyMutation('start', path);
      try {
        return await performRequest(path, options);
      } finally {
        pendingReads.clear();
        await notifyMutation('settled', path);
      }
    })();
  }
  const key = `${path}:${Boolean(options.optional404)}`;
  if (pendingReads.has(key)) return pendingReads.get(key);
  const pending = performRequest(path, options).finally(() => {
    if (pendingReads.get(key) === pending) pendingReads.delete(key);
  });
  pendingReads.set(key, pending);
  return pending;
}
async function performRequest(path, { method = 'GET', body, optional404 = false, signal } = {}) {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000)])
      : AbortSignal.timeout(method === 'GET' ? 20_000 : 120_000),
    headers:
      body instanceof FormData || body == null
        ? { accept: 'application/json' }
        : { accept: 'application/json', 'content-type': 'application/json' },
    body: body == null ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  if (optional404 && response.status === 404) return null;
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid API response (${response.status}).`);
  }
  if (!response.ok) {
    const message = [data?.message, data?.error, data?.detail].find((value) => typeof value === 'string' && value.trim());
    throw Object.assign(new Error(message || `Request failed (${response.status}).`), {
      status: response.status,
    });
  }
  return data;
}
 function svgSource(svg) {
  if (!svg) return '';
  if (/^data:image\/svg\+xml[;,]/i.test(svg)) return svg;
  if (/^\s*<(?:\?xml\b|svg\b)/i.test(svg)) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return '';
}
 function assetData(asset) {
  try {
    return typeof asset?.data?.value === 'string' ? JSON.parse(asset.data.value) : asset?.data?.value || {};
  } catch {
    return {};
  }
}

 function loadingMarkup(label, rows = 3) {
  return `<div class="dm-loading-panel" role="status" aria-label="${escapeHtml(label)}"><div class="dm-loading-caption"><span class="dm-spinner" aria-hidden="true"></span><span>${escapeHtml(label)}</span></div><div class="dm-skeleton" aria-hidden="true">${Array.from({ length: rows }, (_, index) => `<span class="dm-skeleton-line" style="width:${index === 0 ? 48 : index % 2 ? 84 : 64}%"></span>`).join('')}</div></div>`;
}

return {"escapeHtml": escapeHtml, "units": units, "toUnits": toUnits, "amountText": amountText, "shortDid": shortDid, "didMarkup": didMarkup, "tokenText": tokenText, "accountBalanceText": accountBalanceText, "canAfford": canAfford, "onMutation": onMutation, "request": request, "svgSource": svgSource, "assetData": assetData, "loadingMarkup": loadingMarkup};
})();

// ---- storage-list.js ----
modules["storage-list.js"] = (() => {

const {escapeHtml: e, didMarkup, amountText, units} = modules["shared.js"];

const states = {
  uploading: ['Preparing', 'neutral'], awaiting_signature: ['Awaiting signature', 'warning'],
  queued: ['Queued', 'warning'], payment_pending: ['Confirming payment', 'warning'],
  payment_confirmed: ['Creating mail NFT', 'warning'], index_pending: ['Creating mail NFT', 'warning'],
  delivered: ['Delivered', 'success'], rejected: ['Rejected', 'error'], expired: ['Expired', 'neutral'],
  reconciliation_required: ['Review required', 'error'],
};
const nft = (mail) => String(mail.storageKey || '').startsWith('dmp:');
const confirmed = (mail) => nft(mail) && ['payment_confirmed', 'index_pending', 'delivered'].includes(mail.sendStatus);
const shortId = (id) => String(id).length > 16 ? String(id).slice(0, 8) + '…' + String(id).slice(-4) : String(id);
 function storageStatus(mail, t) {
  if (mail.deliveryProblem && ['queued', 'payment_pending', 'payment_confirmed', 'index_pending'].includes(mail.sendStatus)) return `<span class="dm-badge" data-kind="warning">${e(t('Waiting to retry'))}</span>`;
  const [label, kind] = states[mail.sendStatus] || [nft(mail) ? 'Unknown status' : 'Historical record', 'neutral'];
  return `<span class="dm-badge" data-kind="${kind}">${e(t(label))}</span>`;
}
function amount(mail, value, symbol, exact = false) {
  if (value == null || !/^\d+(?:\.\d+)?$/.test(String(value))) return '—';
  const decimal = nft(mail) || /^\d{10,}$/.test(String(value)) ? units(value, 18) : String(value);
  if (decimal === '—') return decimal;
  let text = exact ? decimal : amountText(decimal);
  if (!exact && text === '0' && /[1-9]/.test(decimal)) text = '< 0.0001';
  return text + (symbol ? ' ' + symbol : '');
}
 function storagePayment(mail, t, symbol) {
  const label = mail.fundingMode==='node-sponsored' ? 'Node funded' : !nft(mail) ? 'Recorded amount' : confirmed(mail) ? 'Payment confirmed' : !mail.paymentTx ? 'Quoted amount' : ['queued', 'payment_pending'].includes(mail.sendStatus) ? 'Confirmation pending' : 'Review required';
  return `<strong dir="ltr">${e(amount(mail, mail.payment, symbol))}</strong><span class="dm-small dm-muted">${e(t(label))}</span>`;
}
 function storageFeeDetails(mail, t, symbol) {
  const rows = [['Total fee', mail.payment], ['Node service fee', mail.credit], ['Developer share', mail.dividend]];
  if(mail.fundingMode==='node-sponsored')rows.push(['Node-paid NFT cost',mail.sponsorCost]);
  else if (nft(mail) && [mail.payment, mail.credit, mail.dividend].every(value => /^\d+$/.test(String(value)))) {
    const indexing = BigInt(mail.payment) - BigInt(mail.credit) - BigInt(mail.dividend);
    if (indexing >= 0n) rows.push(['Indexing fee', indexing.toString()]);
  }
  return `<h3>${e(t(confirmed(mail) || !nft(mail) ? 'Fee breakdown' : 'Quote breakdown'))}</h3><dl class="dm-storage-fees">${rows.map(([label, value]) => `<div><dt>${e(t(label))}</dt><dd dir="ltr">${e(amount(mail, value, symbol, true))}</dd></div>`).join('')}</dl>`;
}
function date(value, t) {
  if (!value) return '—';
  const raw = String(value), normalized = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw;
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) return '—';
  return `<time datetime="${e(parsed.toISOString())}">${e(new Intl.DateTimeFormat(t.locale || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed))}</time>`;
}
function size(value, t) {
  const bytes = Math.max(0, Number(value) || 0), power = bytes >= 1048576 ? 2 : bytes >= 1024 ? 1 : 0;
  return new Intl.NumberFormat(t.locale || 'en', { maximumFractionDigits: power ? 1 : 0 }).format(bytes / 1024 ** power) + ' ' + ['B', 'KB', 'MB'][power];
}
function deliveryDetails(mail, t) {
  if (!nft(mail)) return '';
  const problem = mail.deliveryProblem;
  const active = ['queued', 'payment_pending', 'payment_confirmed', 'index_pending'].includes(mail.sendStatus);
  if (!problem && !active && !mail.indexAttempts?.length) return '';
  const guidance = mail.sendStatus === 'rejected' ? 'Payment was rejected. No mail NFT was created.'
    : mail.sendStatus === 'reconciliation_required' ? 'Delivery is paused for verification. Original transactions are retained.'
    : active ? 'The server retries automatically using the saved delivery task. No additional sender payment is required.' : '';
  return `<div class="dm-storage-delivery" data-storage-delivery><h3>${e(t('Delivery progress'))}</h3><dl>
    ${problem ? field('Diagnostic code', `<code dir="ltr">${e(problem.code)}</code>`, t) + field('Reason', e(t(problem.detail || '—')), t) : ''}
    ${active && mail.nextAttemptAt ? field('Next attempt', date(mail.nextAttemptAt, t), t) : ''}
    ${mail.indexAttempts?.length ? field('Previous NFT transactions', mail.indexAttempts.map(hash => `<code dir="ltr">${e(hash)}</code>`).join('<br>'), t) : ''}
  </dl>${guidance ? `<p class="dm-small dm-muted">${e(t(guidance))}</p>` : ''}</div>`;
}
const field = (label, value, t) => `<div><dt>${e(t(label))}</dt><dd>${value || '—'}</dd></div>`;
 function renderStorageTable(mails, t, symbol, search = '') {
  const headings = ['Mail', 'Participants', 'Delivery state', 'Size', 'Mail fee', 'Created', 'Details'];
  return `<div class="dm-storage-table-wrap" tabindex="0" role="region" aria-label="${e(t('Mails'))}"><table role="table" class="dm-storage-table ${mails.length ? '' : 'dm-storage-empty-table'}"><thead><tr>${headings.map(label => `<th scope="col">${e(t(label))}</th>`).join('')}</tr></thead><tbody>${mails.map((mail, index) => {
    const panel = 'storage-mail-' + index, metadata = e(JSON.stringify({ storageKey: mail.storageKey, sendStatus: mail.sendStatus, paymentTx: mail.paymentTx, payment: mail.payment, credit: mail.credit, dividend: mail.dividend }));
    const canDelete = !nft(mail) || ['delivered', 'rejected', 'expired'].includes(mail.sendStatus) || (['uploading', 'awaiting_signature'].includes(mail.sendStatus) && !mail.paymentTx);
    return `<tr class="dm-storage-mail-row" data-storage-row>
      <td class="dm-storage-id" data-label="${e(t('Mail'))}"><code dir="ltr" title="${e(mail.id)}">${e(shortId(mail.id))}</code></td>
      <td class="dm-storage-participants" data-label="${e(t('Participants'))}"><div><span>${e(t('Sender'))}</span>${didMarkup(mail.sender, t)}</div><div><span>${e(t('Receiver'))}</span>${didMarkup(mail.receiver, t)}</div></td>
      <td class="dm-storage-state" data-label="${e(t('Delivery state'))}">${storageStatus(mail, t)}</td>
      <td class="dm-storage-bytes" data-label="${e(t('Size'))}"><bdi dir="ltr">${e(size(mail.size, t))}</bdi></td>
      <td class="dm-storage-payment" data-label="${e(t('Mail fee'))}" data-mail-payment="${metadata}">${storagePayment(mail, t, symbol)}</td>
      <td class="dm-storage-date" data-label="${e(t('Created'))}">${date(mail.createdAt, t)}</td>
      <td class="dm-storage-action"><button type="button" class="dm-secondary" data-action="storage-details" aria-expanded="false" aria-controls="${panel}" aria-label="${e(t('Mail details {id}', { id: shortId(mail.id) }))}">${e(t('Details'))}</button></td>
    </tr><tr class="dm-storage-detail-row" id="${panel}" hidden><td colspan="7"><section class="dm-storage-detail" aria-label="${e(t('Mail details {id}', { id: shortId(mail.id) }))}">
      <div class="dm-storage-detail-grid"><div><h3>${e(t('Message identifiers'))}</h3><dl>${field('ID', `<code dir="ltr">${e(mail.id)}</code>`, t)}${field('Envelope', mail.envelope ? didMarkup(mail.envelope, t) : '', t)}${field('Asset', mail.asset ? didMarkup(mail.asset, t) : '', t)}${field('Download', date(mail.downloadAt, t), t)}</dl></div>
      <div><h3>${e(t('Transaction records'))}</h3><dl>${field('Content', `<code dir="ltr">${e(mail.hash || '—')}</code>`, t)}${field('PaymentTx', `<code dir="ltr">${e(mail.paymentTx || '—')}</code>`, t)}${field('AssetTx', `<code dir="ltr">${e(mail.assetTx || '—')}</code>`, t)}</dl></div>
      <div data-mail-fee-details="${metadata}">${storageFeeDetails(mail, t, symbol)}</div>${deliveryDetails(mail, t)}</div>
      <footer class="dm-storage-detail-footer"><p class="dm-small dm-muted">${e(t(canDelete ? 'Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.' : 'Delivery is in progress. Deletion is unavailable until it finishes.'))}</p><button type="button" data-action="delete-mail" data-mail-id="${e(nft(mail) ? mail.storageKey : mail.id)}" data-mail-label="${e(mail.id)}" class="dm-danger" aria-label="${e(t('Delete mail {id}', { id: mail.id }))}" ${canDelete ? '' : 'disabled'}>${e(t('Delete'))}</button></footer>
    </section></td></tr>`;
  }).join('') || `<tr><td colspan="7" class="dm-empty"><div class="dm-storage-empty"><span>${e(t(search ? 'No matching mail.' : 'No mails stored yet.'))}</span>${search ? `<button type="button" class="dm-secondary" data-action="clear-mail-search">${e(t('Clear search'))}</button>` : ''}</div></td></tr>`}</tbody></table></div>`;
}

return {"storageStatus": storageStatus, "storagePayment": storagePayment, "storageFeeDetails": storageFeeDetails, "renderStorageTable": renderStorageTable};
})();

// ---- identity.js ----
modules["identity.js"] = (() => {

const qrcode = nativeQrcode;

const {escapeHtml: e} = modules["shared.js"];


 function installIdentityUI(root, t) {
  const dialog = document.createElement('dialog');
  dialog.className = 'dm-dialog dm-identity-dialog';
  dialog.setAttribute('aria-label', t('DID details'));
  root.append(dialog);
  document.addEventListener('didmail-session-ended', () => { if (dialog.open) dialog.close(); });
  root.addEventListener('click', async (event) => {
    const copy = event.target.closest('[data-did-copy]');
    const show = event.target.closest('[data-did-show]');
    if (!copy && !show) return;
    event.preventDefault();
    event.stopPropagation();
    const raw = copy?.dataset.didCopy || show.dataset.didShow;
    if (copy) {
      try {
        await navigator.clipboard.writeText(raw);
        copy.setAttribute('aria-label', t('DID copied.'));
        copy.title = t('DID copied.');
        const feedback = document.createElement('span');
        feedback.className = 'dm-did-feedback';
        feedback.setAttribute('role', 'status');
        feedback.textContent = t('DID copied.');
        copy.parentElement.querySelector('.dm-did-feedback')?.remove();
        copy.parentElement.append(feedback);
        setTimeout(() => feedback.remove(), 2500);
      } catch {
        openDetails(raw, t('Copy failed. Copy the full DID below manually.'));
      }
      return;
    }
    openDetails(raw);
  });
  function openDetails(raw, error = '') {
    const code = qrcode(0, 'M');
    code.addData(raw);
    code.make();
    dialog.innerHTML = `<div class="dm-row"><h2>${e(t('DID details'))}</h2><button type="button" data-identity-close class="dm-secondary" aria-label="${e(t('Close'))}">×</button></div><div class="dm-identity-qr">${code.createSvgTag({ cellSize: 5, margin: 4, scalable: true })}</div><p class="dm-identity-full" dir="ltr">${e(raw)}</p>${error ? `<p role="alert">${e(error)}</p>` : ''}<button type="button" data-did-copy="${e(raw)}">${e(t('Copy DID'))}</button>`;
    dialog.querySelector('[data-identity-close]').onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
  }
}

return {"installIdentityUI": installIdentityUI};
})();

// ---- members.js ----
modules["members.js"] = (() => {

const {escapeHtml: e, request, didMarkup} = modules["shared.js"];

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const searchIcon = icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>');
const refreshIcon = icon('<path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/>');
const arrow = (next) => icon(next ? '<path d="m9 6 6 6-6 6"/>' : '<path d="m15 6-6 6 6 6"/>');
function avatar(member) {
  const hash = [...member.did].reduce((v, c) => (v * 31 + c.charCodeAt(0)) >>> 0, 0);
  const initial = [...(member.name.trim() || 'Z')][0].toLocaleUpperCase();
  return `<span class="dm-member-avatar dm-avatar-${hash % 5}" aria-hidden="true">${e(initial)}</span>`;
}
function badge(label, kind, dot = false) {
  return `<span class="dm-member-badge dm-badge-${kind}">${dot ? '<span aria-hidden="true" class="dm-member-dot"></span>' : ''}${e(label)}</span>`;
}
 function renderMembers(result, t, filtered = false) {
  return `<div class="dm-table-wrap dm-members-table" tabindex="0" role="region" aria-label="${e(t('Members'))}"><table><thead><tr><th>${e(t('Member'))}</th><th>${e(t('Role'))}</th><th>${e(t('Status'))}</th><th>${e(t('Linked mailbox'))}</th></tr></thead><tbody>${
    result.members
      .map(
        (m) => `<tr>
      <td><div class="dm-member-identity">${avatar(m)}<div class="dm-member-profile"><strong title="${e(m.name || t('Unnamed member'))}">${e(m.name || t('Unnamed member'))}</strong>${didMarkup(m.did, t)}</div></div></td>
      <td>${badge(t(m.role), m.role)}</td>
      <td>${badge(t(m.active ? 'Active' : 'Inactive'), m.active ? 'active' : 'inactive', true)}</td>
      <td><div class="dm-member-mailbox">${m.binding ? didMarkup(m.binding.mailboxId, t) : ''}${badge(t(!m.binding ? 'Not linked' : m.binding.revoked ? 'Revoked' : 'Linked'), !m.binding ? 'neutral' : m.binding.revoked ? 'revoked' : 'linked')}</div></td>
    </tr>`,
      )
      .join('') ||
    `<tr><td colspan="4"><div class="dm-members-empty">${searchIcon}<strong>${e(t('No matching members.'))}</strong><span>${e(t('Try another name, DID, or filter.'))}</span>${filtered ? `<button type="button" class="dm-secondary" data-members-clear>${e(t('Clear search'))}</button>` : ''}</div></td></tr>`
  }</tbody></table></div>
    <div class="dm-members-pagination"><span>${e(t('Page {page} · {total} members', { page: result.page, total: result.total }))}</span><div class="dm-actions"><button type="button" class="dm-secondary" data-members-page="previous" aria-label="${e(t('Previous'))}" ${result.page > 1 ? '' : 'disabled'}>${arrow(false)}</button><button type="button" class="dm-secondary" data-members-page="next" aria-label="${e(t('Next'))}" ${result.page * result.pageSize < result.total ? '' : 'disabled'}>${arrow(true)}</button></div></div>`;
}
 async function mountMembers(parent, t) {
  const panel = document.createElement('section');
  panel.className = 'dm-members-directory';
  panel.dataset.membersPanel = '';
  const select = (name, label, items) =>
    `<label class="dm-member-filter"><span class="dm-visually-hidden">${e(t(label))}</span><select name="${name}">${items.map(([value, text]) => `<option value="${value}">${e(t(text))}</option>`).join('')}</select></label>`;
  panel.innerHTML = `<div class="dm-members-toolbar"><form data-members-search class="dm-members-search" role="search"><label class="dm-members-query"><span class="dm-visually-hidden">${e(t('Search members'))}</span>${searchIcon}<input name="search" type="search" maxlength="100" placeholder="${e(t('Search members…'))}"></label>${select(
    'role',
    'Role',
    [
      ['', 'All roles'],
      ['owner', 'owner'],
      ['admin', 'admin'],
      ['member', 'member'],
      ['guest', 'guest'],
    ],
  )}${select('active', 'Status', [
    ['', 'All statuses'],
    ['active', 'Active'],
    ['inactive', 'Inactive'],
  ])}<button type="submit" class="dm-secondary dm-member-search-submit">${e(t('Search'))}</button></form><div class="dm-members-tools"><button type="button" data-members-refresh class="dm-secondary dm-members-icon" aria-label="${e(t('Refresh'))}" title="${e(t('Refresh'))}">${refreshIcon}</button><a class="dm-button dm-secondary" href="/.well-known/service/admin#members">${e(t('Manage and invite'))}</a><details class="dm-members-help"><summary aria-label="${e(t('Link a mailbox'))}" title="${e(t('Link a mailbox'))}">?</summary><div><strong>${e(t('Link a mailbox'))}</strong><p>${e(t('In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.'))}</p><p>${e(t('Only active non-guest members qualify for member benefits.'))}</p></div></details></div></div><div data-members-result aria-live="polite" aria-label="${e(t('Members'))}"></div>`;
  parent.prepend(panel);
  const box = panel.querySelector('[data-members-result]'),
    form = panel.querySelector('[data-members-search]');
  let page = 1,
    busy = false,
    queued = false,
    lastResult;
  function placeholders() {
    return `<div class="dm-members-loading" role="status">${e(t('Loading…'))}</div>`;
  }
  async function load() {
    if (busy) {
      queued = true;
      return;
    }
    busy = true;
    queued = false;
    box.setAttribute('aria-busy', 'true');
    panel.querySelector('[data-members-refresh]').disabled = true;
    if (!lastResult) box.innerHTML = placeholders();
    const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(new FormData(form)) });
    try {
      const result = await request('/api/admin/members?' + query);
      if (panel.isConnected && !queued) {
        lastResult = result;
        box.innerHTML = renderMembers(result, t, [...new FormData(form).values()].some(Boolean));
      }
    } catch {
      if (panel.isConnected && !queued) {
        lastResult = undefined;
        box.innerHTML = `<div class="dm-members-empty" role="alert"><strong>${e(t('ARC member service is unavailable. Refresh to retry.'))}</strong><button type="button" class="dm-secondary" data-members-refresh>${e(t('Retry'))}</button></div>`;
      }
    } finally {
      busy = false;
      box.setAttribute('aria-busy', 'false');
      panel.querySelector('[data-members-refresh]').disabled = false;
      if (queued && panel.isConnected) void load();
    }
  }
  panel.addEventListener('submit', (event) => {
    if (event.target !== form) return;
    event.preventDefault();
    event.stopPropagation();
    page = 1;
    void load();
  });
  panel.addEventListener('change', (event) => {
    if (!event.target.matches('select')) return;
    page = 1;
    void load();
  });
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-members-refresh], [data-members-page], [data-members-clear]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (button.hasAttribute('data-members-clear')) {
      form.reset();
      page = 1;
      form.elements.namedItem('search').focus();
    }
    if (button.dataset.membersPage) {
      if (busy) return;
      page += button.dataset.membersPage === 'next' ? 1 : -1;
    }
    void load();
  });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') panel.querySelector('.dm-members-help').open = false;
  });
  await load();
}

return {"renderMembers": renderMembers, "mountMembers": mountMembers};
})();

// ---- member-access.js ----
modules["member-access.js"] = (() => {

const {escapeHtml: e, didMarkup} = modules["shared.js"];


 function renderMemberAccess(snapshot, list, t) {
  const arc = snapshot.accessSource === 'arc',
    deny = arc || list.kind === 'deny';
  const date = (value) => {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(t.locale || 'en', { year: 'numeric', month: 'short', day: 'numeric' }).format(parsed)
      : '—';
  };
  return `<div class="dm-access-overview"><p>${e(t(deny ? 'Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.' : 'Allowlisted accounts can send through this server when access is restricted.'))}</p><button type="button" data-policy-action="refresh" class="dm-secondary dm-block-refresh" aria-label="${e(t('Refresh'))}" title="${e(t('Refresh'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/></svg></button></div>
    <details class="dm-block-rules"><summary>${e(t('How access works'))}</summary><p>${e(t('A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.'))}</p></details>
    <p data-policy-notice role="status"></p>
    <section class="dm-access-section" aria-label="${e(t(deny ? 'Blocked senders' : 'Allowed senders'))}">
      ${arc ? '' : `<label class="dm-access-kind"><span class="dm-visually-hidden">${e(t('List'))}</span><select data-policy-kind><option value="deny" ${deny ? 'selected' : ''}>${e(t('Denylist'))}</option><option value="allow" ${deny ? '' : 'selected'}>${e(t('Allowlist'))}</option></select></label>`}
      <details class="dm-block-editor" data-block-editor><summary class="dm-button dm-secondary">+ ${e(t(deny ? 'Block a sender' : 'Allow a sender'))}</summary>
        <form data-access-entry class="dm-block-form"><label>${e(t('Account DID'))}<input name="did" placeholder="did:abt:z… / z…" pattern="(did:abt:)?z[1-9A-HJ-NP-Za-km-z]{20,64}" maxlength="72" required autocomplete="off" dir="ltr"><small>${e(t('Paste a mailbox DID or ARC login DID.'))}</small></label><label>${e(t('Note (optional)'))}<input name="remark" maxlength="500" placeholder="${e(t('Why is this account listed?'))}"></label><div class="dm-block-form-actions"><button type="submit" data-entry-submit>${e(t(deny ? 'Confirm block' : 'Confirm allow'))}</button><button type="button" class="dm-secondary" data-policy-action="cancel-entry">${e(t('Cancel'))}</button></div></form>
      </details>
      ${list.entries.length ? `<div class="dm-table-wrap dm-block-table"><table><thead><tr><th>${e(t('Account DID'))}</th><th>${e(t('Remark'))}</th><th>${e(t('Added at'))}</th><th>${e(t('Action'))}</th></tr></thead><tbody>${list.entries.map((row) => `<tr><td>${didMarkup(row.did, t)}</td><td>${e(row.remark || '—')}</td><td><time datetime="${e(row.createdAt)}">${e(date(row.createdAt))}</time></td><td><div class="dm-block-row-actions"><button type="button" class="dm-secondary" data-policy-action="edit-entry" data-did="${e(row.did)}" data-remark="${e(row.remark)}">${e(t('Edit note'))}</button><button type="button" class="dm-secondary" data-policy-action="remove" data-did="${e(row.did)}">${e(t(deny ? 'Unblock' : 'Remove from allowlist'))}</button></div></td></tr>`).join('')}</tbody></table></div>` : `<div class="dm-block-empty"><strong>${e(t(deny ? 'No blocked senders' : 'No allowed senders yet'))}</strong></div>`}
      ${list.hasPrevious || list.nextCursor ? `<div class="dm-block-pagination"><button type="button" class="dm-secondary" data-policy-action="previous" ${list.hasPrevious ? '' : 'disabled'}>${e(t('Previous'))}</button><button type="button" class="dm-secondary" data-policy-action="next" ${list.nextCursor ? '' : 'disabled'}>${e(t('Next'))}</button></div>` : ''}

    </section>`;
}

return {"renderMemberAccess": renderMemberAccess};
})();

// ---- mail-policy.js ----
modules["mail-policy.js"] = (() => {

const {renderMemberAccess} = modules["member-access.js"];

const {escapeHtml: e, didMarkup} = modules["shared.js"];


 function renderMailPolicy(snapshot, list, _transport, t, activeTab = 'service', area = 'all') {
  if (area === 'members') return renderMemberAccess(snapshot,list,t);
  const p = snapshot.policy;
  const arcMembers = snapshot.accessSource === 'arc';
  const field = (label, name, value, min, max, step = 1) =>
    `<label>${e(t(label))}<input name="${name}" type="number" min="${min}" max="${max}" step="${step}" required value="${e(value)}" dir="ltr"></label>`;
  const sizeField = (label, name, bytes, min = 1) =>
    field(label, name, bytes / 1048576, min / 1048576, 64, 'any');
  const check = (label, name, checked, disabled = false) =>
    `<label class="dm-toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${e(t(label))}</label>`;
  const tabs = [['service', 'Mail service'], ['access', 'DID access lists']].filter(([id]) => area === 'all' || (area === 'members' ? id === 'access' : id !== 'access'));
  if (!tabs.some(([id]) => id === activeTab)) activeTab = tabs[0][0];
  const tabPanel = (id) => area !== 'all' ? `data-settings-panel="${id}"` : `id="settings-${id}-panel" role="tabpanel" tabindex="0" aria-labelledby="settings-${id}-tab" data-settings-panel="${id}" ${activeTab === id ? '' : 'hidden'}`;
  const accessControl = `      <fieldset class="dm-settings-section"><legend>${e(t('Sending access'))}</legend><div class="dm-form-grid">
      <label>${e(t('Sending access'))}<select name="accessMode"><option value="public" ${p.accessMode === 'public' ? 'selected' : ''}>${e(t('All senders except denylist'))}</option><option value="allowlist" ${p.accessMode === 'allowlist' ? 'selected' : ''}>${e(t(arcMembers ? 'Active ARC members only' : 'Allowlist only'))}</option></select></label>
      <p class="dm-muted">${e(t(arcMembers ? 'Denylist takes priority. Members-only sending requires an active linked ARC member.' : 'Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.'))}</p>
      </div></fieldset>`;
  return `<div class="dm-row"><h2>${e(t(area === 'members' ? 'DID access lists' : 'Mail service'))}</h2><button type="button" data-policy-action="refresh" class="dm-secondary">${e(t('Refresh'))}</button></div>
    ${area !== 'settings' ? `<p class="dm-muted">${e(t('Access lists control who can send and store mail here. External recipients can still download their mail.'))}</p>` : ''}
    <p data-policy-notice role="status"></p>
    ${area !== 'all' ? '' : `<div class="dm-settings-tabs" role="tablist" aria-label="${e(t('Settings'))}">${tabs.map(([id, label]) => `<button type="button" role="tab" id="settings-${id}-tab" aria-controls="settings-${id}-panel" aria-selected="${activeTab === id}" tabindex="${activeTab === id ? '0' : '-1'}" data-settings-tab="${id}">${e(t(label))}</button>`).join('')}</div>`}
    ${area === 'members' ? '' : `<div ${tabPanel('service')}><form data-service-policy>
      ${area === 'all' ? accessControl : ''}<fieldset class="dm-settings-section"><legend>${e(t('New mail attachment limits'))}</legend>
      ${check('Allow attachments', 'attachmentsEnabled', p.attachments.enabled)}
      <div class="dm-form-grid">${field('Maximum attachment count', 'maxCount', p.attachments.maxCount, 0, 20)}
      ${sizeField('Maximum file size (MiB)', 'maxFileMiB', p.attachments.maxFileBytes)}
      ${sizeField('Maximum total attachment size (MiB)', 'maxTotalMiB', p.attachments.maxTotalBytes)}
      ${sizeField('Maximum encrypted message size (MiB)', 'maxMessageMiB', p.maxMessageCiphertextBytes, 16)}
      </div><p class="dm-muted">${e(t('File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.'))}</p>
      <p class="dm-muted">${e(t('The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.'))}</p>
      </fieldset><div class="dm-settings-save"><button type="submit">${e(t('Save mail service policy'))}</button></div>
    </form></div>`}${area === 'settings' ? '' : `<div ${tabPanel('access')}>
      ${area === 'members' ? `<form data-member-access>${accessControl}<button type="submit">${e(t('Save sending access'))}</button></form>` : ''}
      ${area === 'members' ? '' : `<h3>${e(t('DID access lists'))}</h3>`}
      ${arcMembers ? `<p><a href="/.well-known/service/admin">${e(t('Manage ARC members and invitations'))}</a></p>` : ''}
      <label>${e(t('List'))}<select data-policy-kind>${arcMembers ? '' : `<option value="allow" ${list.kind === 'allow' ? 'selected' : ''}>${e(t('Allowlist'))}</option>`}<option value="deny" ${list.kind === 'deny' ? 'selected' : ''}>${e(t('Denylist'))}</option></select></label>
      <form data-access-entry class="dm-access-form"><label>DID<input name="did" placeholder="did:abt:…" pattern="did:abt:z[1-9A-HJ-NP-Za-km-z]{20,64}" maxlength="72" required></label><label>${e(t('Remark'))}<input name="remark" maxlength="500"></label><button type="submit">${e(t('Add or update remark'))}</button></form>
      <p class="dm-muted">${e(t('List changes do not automatically change the access mode.'))}</p>
      <div class="dm-table-wrap"><table><thead><tr><th>DID</th><th>${e(t('Remark'))}</th><th>${e(t('Added at'))}</th><th>${e(t('Action'))}</th></tr></thead><tbody>${list.entries.map((row) => `<tr><td>${didMarkup(row.did, t)}</td><td>${e(row.remark)}</td><td>${e(row.createdAt)}</td><td><button type="button" data-policy-action="remove" data-did="${e(row.did)}" class="dm-secondary">${e(t('Remove from list'))}</button></td></tr>`).join('')}</tbody></table></div>
      ${!list.entries.length ? `<p>${e(t('No DIDs in this list.'))}</p>` : ''}
      <div class="dm-actions"><button type="button" data-policy-action="previous" ${list.hasPrevious ? '' : 'disabled'}>${e(t('Previous'))}</button><button type="button" data-policy-action="next" ${list.nextCursor ? '' : 'disabled'}>${e(t('Next'))}</button></div>
    </div>`}`;
}

 async function mountMailPolicy(parent, t, area = 'settings') {
  const instancePolicy = modules["instance-config.js"].createInstanceConfigClient();
  const panel = document.createElement('section');
  panel.className = area === 'members' ? 'dm-member-access-body' : 'dm-card';
  panel.dataset.mailPolicyPanel = '';
  if (area === 'members') {
    const section = document.createElement('details');
    section.className = 'dm-card dm-member-access';
    section.innerHTML = `<summary>${e(t('Blocked senders'))}</summary>`;
    section.append(panel);
    parent.prepend(section);
  } else parent.prepend(panel);
  let snapshot,
    list,
    kind = 'allow',
    after = '',
    history = [],
    busy = false,
    activeTab = area === 'members' ? 'access' : 'service',
    policyDirty = false;
  const notify = (message, error = false) => {
    const target = panel.querySelector('[data-policy-notice]');
    if (target) {
      target.textContent = message;
      target.setAttribute('role', error ? 'alert' : 'status');
    }
  };
  const load = async () => {
    const form = panel.querySelector('[data-service-policy]');
    const draft = policyDirty && form ? [...form.elements].filter((input) => input.name && (input.type !== 'radio' || input.checked)).map((input) => ({ name: input.name, value: input.value, checked: input.checked })) : null;
    let policySnapshot;
    try { policySnapshot = await instancePolicy.mailPolicy(); }
    catch (error) {
      if (error.code !== 'AFS_NOT_FOUND') throw error;
      panel.innerHTML = `<p data-policy-notice role="status">${e(modules["instance-config.js"].initialMessage(document.documentElement.lang))}</p><button type="button" data-policy-initialize>${e(modules["instance-config.js"].initializePolicyLabel(document.documentElement.lang))}</button>`;
      return;
    }
    const result = await Promise.all([
      Promise.resolve(policySnapshot),
      area === 'members' ? instancePolicy.accessList({ kind, limit: 50, after }) : Promise.resolve({entries:[],kind}),
    ]);
    if (!panel.isConnected) return;
    [snapshot, list] = result;
    if (area === 'members' && snapshot.accessSource === 'arc' && kind !== 'deny') {
      kind = 'deny'; after = ''; history = [];
      list = await instancePolicy.accessList({ kind: 'deny', limit: 50 });
      if (!panel.isConnected) return;
    }
    panel.innerHTML = renderMailPolicy(snapshot, { ...list, hasPrevious: history.length > 0 }, {}, t, activeTab, area);
    if (draft) for (const input of draft) {
      const target = panel.querySelector('[data-service-policy]').elements.namedItem(input.name);
      target.value = input.value;
      if (target.type === 'checkbox') target.checked = input.checked;
    }
  };
  const run = async (action) => {
    if (busy) return;
    busy = true;
    panel.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
    try {
      await action();
    } catch (error) {
      if ([401, 403].includes(error.status)) {
        modules["node-state.js"].closeNodeStore({ forget: true });
        document.dispatchEvent(new Event('didmail-session-ended'));
      }
      notify(
        t(
          error.status === 409
            ? 'Policy changed or is unavailable. Refresh and review before retrying.'
            : area === 'members'
              ? error.status === 400 ? 'Enter a valid mailbox or ARC DID.' : 'Could not confirm the result. Refresh the list before retrying.'
              : error.message,
        ),
        true,
      );
    } finally {
      busy = false;
      panel.querySelectorAll('button').forEach((button) => {
        button.disabled =
          button.dataset.policyAction === 'previous'
            ? !history.length
            : button.dataset.policyAction === 'next'
              ? !list?.nextCursor
              : false;
      });
    }
  };
  panel.addEventListener('submit', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const form = event.target,
      values = Object.fromEntries(new FormData(form));
    void run(async () => {
      let message = 'Mail service settings saved.';
      if (form.matches('[data-service-policy]')) {
        const sizes = ['maxFileMiB', 'maxTotalMiB', 'maxMessageMiB'].map((name) => Number(values[name]) * 1048576);
        if (sizes.some((bytes, index) => !Number.isSafeInteger(bytes) || bytes < (index === 2 ? 16 : 1) || bytes > 67108864)) {
          throw new Error('Enter sizes that convert to whole bytes within the allowed limits.');
        }
        const policy = structuredClone(snapshot.policy);
        if (values.accessMode !== undefined) policy.accessMode = values.accessMode;
        if (form.matches('[data-service-policy]')) {
          // VC delivery is retired; retain historical terms without exposing controls.
          policy.ordinary.enabled = false;
          policy.attachments = {
            enabled: values.attachmentsEnabled === 'on',
            maxCount: Number(values.maxCount),
            maxFileBytes: sizes[0],
            maxTotalBytes: sizes[1],
          };
          policy.maxMessageCiphertextBytes = sizes[2];
        }

        await instancePolicy.editMailPolicy({ expectedRevision: snapshot.revision, policy });
        policyDirty = false;
      } else {
        const raw = values.did.trim();
        const did = raw.startsWith('z') ? 'did:abt:' + raw : raw;
        const editing = form.elements.namedItem('did').readOnly;
        message = editing ? 'Note updated.' : kind === 'deny' ? 'Sender blocked.' : 'Sender allowed.';
        await instancePolicy.updateAccessEntry({ expectedRevision: snapshot.revision, kind, did, remark: values.remark });
      }
      after = '';
      history = [];
      await load();
      notify(t(message));
    });
  });
  panel.addEventListener('input', (event) => {
    if (event.target.closest('[data-service-policy]')) { policyDirty = true; }
  });
  panel.addEventListener('change', (event) => {
    if (event.target.closest('[data-service-policy]')) { policyDirty = true; }
    if (event.target.matches('[data-policy-kind]'))
      void run(async () => {
        kind = event.target.value;
        after = '';
        history = [];
        await load();
      });
  });
  const selectTab = (tab, focus = false) => {
    activeTab = tab.dataset.settingsTab;
    panel.querySelectorAll('[data-settings-tab]').forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panel.querySelectorAll('[data-settings-panel]').forEach((item) => {
      item.hidden = item.dataset.settingsPanel !== activeTab;
    });
    if (focus) tab.focus();
  };
  panel.addEventListener('keydown', (event) => {
    const tab = event.target.closest('[data-settings-tab]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const tabs = [...panel.querySelectorAll('[data-settings-tab]')];
    const direction = getComputedStyle(panel).direction === 'rtl' ? -1 : 1;
    const step = (event.key === 'ArrowRight' ? 1 : -1) * direction;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + step + tabs.length) % tabs.length;
    selectTab(tabs[index], true);
  });
  panel.addEventListener('click', (event) => {
    if (event.target.closest('[data-policy-initialize]')) {
      event.preventDefault(); event.stopPropagation();
      void run(async () => { await instancePolicy.initializeMailPolicy(); await load(); });
      return;
    }
    const tab = event.target.closest('[data-settings-tab]');
    if (tab) {
      event.preventDefault();
      event.stopPropagation();
      selectTab(tab);
      return;
    }
    const button = event.target.closest('[data-policy-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (['edit-entry','cancel-entry'].includes(button.dataset.policyAction)) {
      const editor = panel.querySelector('[data-block-editor]'), form = editor.querySelector('form');
      form.reset();
      const editing = button.dataset.policyAction === 'edit-entry';
      form.elements.namedItem('did').readOnly = editing;
      if (editing) {
        form.elements.namedItem('did').value = button.dataset.did;
        form.elements.namedItem('remark').value = button.dataset.remark;
        form.querySelector('[data-entry-submit]').textContent = t('Save note');
      } else form.querySelector('[data-entry-submit]').textContent = t(kind === 'deny' ? 'Confirm block' : 'Confirm allow');
      editor.querySelector('summary').textContent = editing ? t('Edit note') : '+ ' + t(kind === 'deny' ? 'Block a sender' : 'Allow a sender');
      editor.open = editing;
      if (editing) form.elements.namedItem('remark').focus();
      return;
    }
    void run(async () => {
      if (button.dataset.policyAction === 'remove') {
        await instancePolicy.removeAccessEntry({ expectedRevision: snapshot.revision, kind, did: button.dataset.did });
        after = '';
        history = [];
      } else if (button.dataset.policyAction === 'next') {
        history.push(after);
        after = list.nextCursor;
      } else if (button.dataset.policyAction === 'previous') after = history.pop() || '';
      else {
        after = '';
        history = [];
      }
      await load();
      if (button.dataset.policyAction === 'remove') notify(t(kind === 'deny' ? 'Sender unblocked.' : 'Sender removed from allowlist.'));
    });
  });
  panel.innerHTML = `${area === 'members' ? '' : `<h2>${e(t('Mail service'))}</h2>`}<p data-policy-notice role="status">${e(t(area === 'members' ? 'Loading sender list…' : 'Loading mail service policy…'))}</p><button type="button" data-policy-action="refresh">${e(t('Retry'))}</button>`;
  await run(load);
}

return {"renderMailPolicy": renderMailPolicy, "mountMailPolicy": mountMailPolicy};
})();

// ---- node-state.js ----
modules["node-state.js"] = (() => {

const {QueryClient, QueryObserver} = nativeQueryCore;

const {request, onMutation} = modules["shared.js"];

 const NODE_CACHE_KEY = 'didmail:node-state:v1';
 const NODE_STALE_TIME = 15_000;
const MAX_SNAPSHOT_AGE = 300_000;
const resources = {
  account: { path: '/api/account/state', ttl: NODE_STALE_TIME },
  stake: { path: '/api/stake/state', ttl: NODE_STALE_TIME, optional404: true },
  forge: { path: '/api/forge/state', ttl: MAX_SNAPSHOT_AGE },
};
 function scopeFor(session) {
  if (!session?.authenticated || !['owner', 'admin'].includes(session.user?.role) || !session.user?.did) return null;
  const node = session.node;
  return JSON.stringify([
    session.provider || session.user.sourceProvider || 'arc',
    session.user.did,
    session.user.role,
    node?.chainId || '',
    node?.address || '',
    node?.cacheKey || '',
  ]);
}
function browserStorage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}
 function clearNodeSnapshot(storage = browserStorage()) {
  try {
    storage?.removeItem(NODE_CACHE_KEY);
  } catch {
    /* Memory-only mode when browser storage is disabled. */
  }
}
function displayData(kind, data) {
  const tokens = (list) => list?.map(({ address, symbol, value, decimal }) => ({ address, symbol, value, decimal }));
  if (kind === 'account')
    return {
      address: data.address,
      chainId: data.chainId,
      chainStatus: data.chainStatus,
      moniker: data.moniker,
      balance: data.balance,
      nonce: data.nonce,
      tokens: tokens(data.tokens),
    };
  if (kind === 'stake')
    return {
      address: data.address,
      staked: data.staked,
      assets: data.assets,
      ownerAssets: data.ownerAssets?.map(({ address, data }) => ({ address, data })),
      revokedAssets: data.revokedAssets,
      tokens: tokens(data.tokens),
      revokedTokens: tokens(data.revokedTokens),
      revokeWaitingPeriod: data.revokeWaitingPeriod,
    };
  return { address: data.address, token: data.token };
}
// Request-cache state is scoped to a freshly verified ARC identity and node.
// Hydrated values are display snapshots, never authorization or transaction input.
 function createNodeStore(session, { storage = browserStorage(), fetcher = request, now = Date.now } = {}) {
  const scope = scopeFor(session);
  if (!scope) throw new Error('Unauthorized');
  const node = session.node;
  const persistent = Boolean(node?.address && node?.chainId && node?.cacheKey);
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false },
    },
  });
  client.mount();
  const restored = new Set();
  const stops = new Set();
  let disposed = false;
  const key = (kind) => ['didmail-node', scope, kind];
  const validAccount = (data) =>
    data &&
    data.chainStatus !== 'unavailable' &&
    (!node?.address || data.address === node.address) &&
    (!node?.chainId || data.chainId === node.chainId);
  const options = (kind) => ({
    queryKey: key(kind),
    staleTime: resources[kind].ttl,
    refetchInterval: false,
    queryFn: async ({ signal }) => {
      const data = await fetcher(resources[kind].path, { signal, optional404: Boolean(resources[kind].optional404) });
      if (kind === 'account' && !validAccount(data))
        throw Object.assign(new Error('Chain data is unavailable. Balances and stake could not be verified.'), {
          diagnostic: data?.chainStatus === 'unavailable' ? data.chainError : undefined,
        });
      return data || {};
    },
  });
  if (persistent) {
    try {
      const snapshot = JSON.parse(storage?.getItem(NODE_CACHE_KEY) || 'null');
      if (snapshot?.scope !== scope) clearNodeSnapshot(storage);
      else
        for (const [kind, record] of Object.entries(snapshot.resources || {})) {
          if (
            !Object.hasOwn(resources, kind) ||
            !Number.isFinite(record.updatedAt) ||
            now() - record.updatedAt > MAX_SNAPSHOT_AGE ||
            record.updatedAt > now() + 1000 ||
            !record.data ||
            (kind === 'account' && !validAccount(record.data))
          )
            continue;
          client.setQueryData(key(kind), record.data, { updatedAt: record.updatedAt });
          restored.add(kind);
        }
    } catch {
      clearNodeSnapshot(storage);
    }
  }
  const persist = () => {
    if (!persistent || disposed) return;
    const snapshot = { scope, resources: {} };
    for (const kind of Object.keys(resources)) {
      const state = client.getQueryState(key(kind));
      if (!state?.data || state.isInvalidated || now() - state.dataUpdatedAt > MAX_SNAPSHOT_AGE || state.error)
        continue;
      const data = displayData(kind, state.data);
      if (JSON.stringify(data).length > 128 * 1024) continue;
      snapshot.resources[kind] = { updatedAt: state.dataUpdatedAt, data };
    }
    try {
      storage?.setItem(NODE_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Cache is optional. */
    }
  };
  const cacheStop = client.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && ['success', 'error'].includes(event.action.type)) {
      if (event.action.type === 'success') restored.delete(event.query.queryKey[2]);
      persist();
    }
  });
  const affected = (path) => /^\/api\/(?:stake\/|servers\/acquire|(?:envelope|namecard)\/acquire)/.test(path);
  const invalidate = async () => {
    const predicate = (query) => ['account', 'stake'].includes(query.queryKey[2]);
    await client.cancelQueries({ predicate });
    await client.invalidateQueries({ predicate, refetchType: 'none' });
    clearNodeSnapshot(storage);
    restored.clear();
  };
  const mutationStop = onMutation(async (phase, path) => {
    if (!affected(path)) return;
    await invalidate();
    // Subscribers keep their last values but see them as stale. The caller's
    // post-write refresh coalesces with this background revalidation.
    if (phase === 'settled')
      void client
        .refetchQueries({ type: 'active', predicate: (query) => ['account', 'stake'].includes(query.queryKey[2]) })
        .catch(() => {});
  });
  const get = (kind) => {
    const state = client.getQueryState(key(kind));
    return {
      data: state?.data,
      error: state?.error,
      updatedAt: state?.dataUpdatedAt || 0,
      fetching: state?.fetchStatus === 'fetching',
      stale: !state?.data || Boolean(state.isInvalidated) || now() - state.dataUpdatedAt >= resources[kind].ttl,
      restored: restored.has(kind),
    };
  };
  return {
    scope,
    node,
    get active() {
      return !disposed;
    },
    get,
    async read(kind, { force = false } = {}) {
      if (disposed) throw new Error('Node state is closed');
      if (force) await client.invalidateQueries({ queryKey: key(kind), refetchType: 'none' });
      return client.fetchQuery({ ...options(kind), staleTime: force ? 0 : resources[kind].ttl });
    },
    watch(kind, listener) {
      const observer = new QueryObserver(client, options(kind));
      const stop = observer.subscribe(() => listener(get(kind)));
      stops.add(stop);
      listener(get(kind));
      return () => {
        stop();
        stops.delete(stop);
      };
    },
    invalidate,
    dispose() {
      disposed = true;
      mutationStop();
      cacheStop();
      stops.forEach((stop) => stop());
      stops.clear();
      client.clear();
      client.unmount();
    },
  };
}
let current;
 function nodeStore(session) {
  const scope = scopeFor(session);
  if (!scope) {
    current?.dispose();
    current = undefined;
    clearNodeSnapshot();
    return null;
  }
  if (!current || current.scope !== scope) {
    current?.dispose();
    current = createNodeStore(session);
  }
  return current;
}
 function closeNodeStore({ forget = false } = {}) {
  current?.dispose();
  current = undefined;
  if (forget) clearNodeSnapshot();
}

return {"NODE_CACHE_KEY": NODE_CACHE_KEY, "NODE_STALE_TIME": NODE_STALE_TIME, "scopeFor": scopeFor, "clearNodeSnapshot": clearNodeSnapshot, "createNodeStore": createNodeStore, "nodeStore": nodeStore, "closeNodeStore": closeNodeStore};
})();

// ---- locales/config.js ----
modules["locales/config.js"] = (() => {
const defaultExport = {
  defaultLocale: 'en',
  languages: [
    { code: 'en', label: 'English' },
    { code: 'zh', label: '简体中文' },
    { code: 'ar', label: 'العربية' },
    { code: 'ja', label: '日本語' },
    { code: 'ru', label: 'Русский' },
  ],
};

return {"default": defaultExport};
})();

// ---- locales/en.js ----
modules["locales/en.js"] = (() => {
const defaultExport = {
  help: 'Help',
  nodeRecharge: 'Node recharge',
  nodeBalance: 'Balance',
  refreshNodeBalance: 'Refresh balance',
  noBalance: '0',
  balanceLoading: 'Loading…',
  balanceUnavailable: 'Balance unavailable',
  balanceUpdatedAt: 'Updated',
  cachedNodeBalance: 'Previous reading; click to refresh',
  home: 'Home',
  admin: 'Admin',
  language: 'Language',
  theme: 'Appearance',
  appearanceLight: 'Light',
  appearanceDark: 'Dark',
  switchToLight: 'Switch to light',
  switchToDark: 'Switch to dark',
  login: 'Login',
  brandHome: 'DIDMail Server home',
  navigation: 'Main navigation',
  logo: 'DIDMail logo',
  intro: 'Own your inbox. Send encrypted email with your DID, and choose the server you trust.',
  tagline: 'Get started in your browser, or run a server for your organization.',
  extension: 'Get the Extension',
  runNode: 'Run a Server Node',
  encryptionTitle: 'End-to-End Encryption',
  encryptionDescription:
    'Built on ArcBlock DID and Curve25519, every mail is encrypted for its recipient alone. Content stays unreadable in transit and at rest — even to server nodes.',
  didLink: 'ArcBlock DID',
  networkTitle: 'Decentralized Server Network',
  networkDescription:
    'Choose a server you trust, or run one for your organization. Switching servers leaves existing mail on its original server.',
  blockletsLink: 'ARC Blocklets',
  envelopesTitle: 'NFT Envelopes',
  envelopesDescription:
    'Service nodes offer NFT envelopes for external mail. Eligible members on the same server exchange mail directly without an envelope or on-chain transaction.',
  footer: 'DIDMail · Powered by ARC',
};

return {"default": defaultExport};
})();

// ---- locales/zh.js ----
modules["locales/zh.js"] = (() => {
const defaultExport = {
  help: '帮助',
  nodeRecharge: '充值',
  nodeBalance: '余额',
  refreshNodeBalance: '刷新余额',
  noBalance: '0',
  balanceLoading: '加载中…',
  balanceUnavailable: '余额暂不可用',
  balanceUpdatedAt: '更新于',
  cachedNodeBalance: '上次读取值；点击刷新',
  home: '首页',
  admin: '管理',
  language: '选择语言',
  theme: '外观',
  appearanceLight: '浅色',
  appearanceDark: '深色',
  switchToLight: '切换为明亮',
  switchToDark: '切换为深色',
  login: '登录',
  brandHome: 'DIDMail Server 首页',
  navigation: '主导航',
  logo: 'DIDMail 标志',
  intro: '掌控你的收件箱。使用 DID 发送加密邮件，自由选择你信任的服务器。',
  tagline: '从浏览器开始使用，或为你的组织运行邮件服务器。',
  extension: '获取浏览器扩展',
  runNode: '运行服务节点',
  encryptionTitle: '端到端加密',
  encryptionDescription:
    '基于 ArcBlock DID 与 Curve25519，每封邮件仅供收件人解密。无论传输还是存储，内容始终保持加密，服务节点也无法读取。',
  didLink: 'ArcBlock DID',
  networkTitle: '去中心化服务网络',
  networkDescription:
    '选择你信任的服务器，或为组织运行自己的服务器。切换服务器后，已有邮件仍保留在原服务器。',
  blockletsLink: 'ARC Blocklet',
  envelopesTitle: 'NFT 信封',
  envelopesDescription:
    '服务节点为外部邮件提供 NFT 信封。同一服务器内符合条件的成员可直接收发邮件，无需信封或链上交易。',
  footer: 'DIDMail · 由 ARC 提供支持',
};

return {"default": defaultExport};
})();

// ---- locales/ar.js ----
modules["locales/ar.js"] = (() => {
const defaultExport = {
  help: 'المساعدة',
  nodeRecharge: 'شحن العقدة',
  nodeBalance: 'الرصيد',
  refreshNodeBalance: 'تحديث الرصيد',
  noBalance: '0',
  balanceLoading: 'جارٍ التحميل…',
  balanceUnavailable: 'الرصيد غير متاح',
  balanceUpdatedAt: 'آخر تحديث',
  cachedNodeBalance: 'القراءة السابقة؛ انقر للتحديث',
  home: 'الرئيسية',
  admin: 'الإدارة',
  language: 'اللغة',
  theme: 'المظهر',
  appearanceLight: 'فاتح',
  appearanceDark: 'داكن',
  switchToLight: 'التبديل إلى المظهر الفاتح',
  switchToDark: 'التبديل إلى المظهر الداكن',
  login: 'تسجيل الدخول',
  brandHome: 'الصفحة الرئيسية لخادم DIDMail',
  navigation: 'التنقل الرئيسي',
  logo: 'شعار DIDMail',
  intro: 'امتلك بريدك الوارد. أرسل بريداً مشفراً بهويتك اللامركزية واختر الخادم الذي تثق به.',
  tagline: 'ابدأ من متصفحك، أو شغّل خادماً لمؤسستك.',
  extension: 'احصل على إضافة المتصفح',
  runNode: 'شغّل عقدة خادم',
  encryptionTitle: 'تشفير من طرف إلى طرف',
  encryptionDescription:
    'باستخدام ArcBlock DID وCurve25519، تُشفر كل رسالة لمستلمها وحده. يظل المحتوى غير قابل للقراءة أثناء النقل والتخزين، حتى لعقد الخادم.',
  didLink: 'ArcBlock DID',
  networkTitle: 'شبكة خوادم لامركزية',
  networkDescription:
    'اختر خادماً تثق به، أو شغّل خادماً لمؤسستك. عند تغيير الخادم، تبقى الرسائل السابقة على خادمها الأصلي.',
  blockletsLink: 'ARC Blocklets',
  envelopesTitle: 'أظرف NFT',
  envelopesDescription:
    'توفر عقد الخدمة أظرف NFT للبريد الخارجي. يتبادل الأعضاء المؤهلون على الخادم نفسه البريد مباشرة دون ظرف أو معاملة على السلسلة.',
  footer: 'DIDMail · بدعم من ARC',
};

return {"default": defaultExport};
})();

// ---- locales/ja.js ----
modules["locales/ja.js"] = (() => {
const defaultExport = {
  help: 'ヘルプ',
  nodeRecharge: 'ノードに入金',
  nodeBalance: '残高',
  refreshNodeBalance: '残高を更新',
  noBalance: '0',
  balanceLoading: '読み込み中…',
  balanceUnavailable: '残高を取得できません',
  balanceUpdatedAt: '更新日時',
  cachedNodeBalance: '前回の残高。クリックして更新',
  home: 'ホーム',
  admin: '管理',
  language: '言語',
  theme: '外観',
  appearanceLight: 'ライト',
  appearanceDark: 'ダーク',
  switchToLight: 'ライトに切り替え',
  switchToDark: 'ダークに切り替え',
  login: 'ログイン',
  brandHome: 'DIDMail Server ホーム',
  navigation: 'メインナビゲーション',
  logo: 'DIDMail ロゴ',
  intro: '受信箱を自分の手に。DID で暗号化メールを送り、信頼するサーバーを選べます。',
  tagline: 'ブラウザーで始めるか、組織のメールサーバーを運用しましょう。',
  extension: 'ブラウザー拡張機能を入手',
  runNode: 'サーバーノードを運用',
  encryptionTitle: 'エンドツーエンド暗号化',
  encryptionDescription:
    'ArcBlock DID と Curve25519 により、すべてのメールは受信者だけが読めるよう暗号化されます。転送中も保存中も、サーバーノードを含め第三者は内容を読めません。',
  didLink: 'ArcBlock DID',
  networkTitle: '分散型サーバーネットワーク',
  networkDescription:
    '信頼するサーバーを選ぶか、組織向けに運用できます。切り替えても、既存のメールは元のサーバーに残ります。',
  blockletsLink: 'ARC Blocklets',
  envelopesTitle: 'NFT 封筒',
  envelopesDescription:
    'サービスノードは外部宛メール用の NFT 封筒を提供します。同一サーバーの対象メンバー間では、封筒やオンチェーン取引なしでメールを直接交換できます。',
  footer: 'DIDMail · ARC により提供',
};

return {"default": defaultExport};
})();

// ---- locales/ru.js ----
modules["locales/ru.js"] = (() => {
const defaultExport = {
  help: 'Справка',
  nodeRecharge: 'Пополнить узел',
  nodeBalance: 'Баланс',
  refreshNodeBalance: 'Обновить баланс',
  noBalance: '0',
  balanceLoading: 'Загрузка…',
  balanceUnavailable: 'Баланс недоступен',
  balanceUpdatedAt: 'Обновлено',
  cachedNodeBalance: 'Предыдущее значение; нажмите для обновления',
  home: 'Главная',
  admin: 'Управление',
  language: 'Язык',
  theme: 'Оформление',
  appearanceLight: 'Светлое',
  appearanceDark: 'Тёмное',
  switchToLight: 'Включить светлую тему',
  switchToDark: 'Включить тёмную тему',
  login: 'Войти',
  brandHome: 'Главная DIDMail Server',
  navigation: 'Основная навигация',
  logo: 'Логотип DIDMail',
  intro: 'Ваша почта принадлежит вам. Отправляйте зашифрованные письма с DID и выбирайте сервер, которому доверяете.',
  tagline: 'Начните в браузере или запустите сервер для своей организации.',
  extension: 'Установить расширение',
  runNode: 'Запустить серверный узел',
  encryptionTitle: 'Сквозное шифрование',
  encryptionDescription:
    'Благодаря ArcBlock DID и Curve25519 каждое письмо шифруется только для получателя. Его содержимое недоступно при передаче и хранении — даже серверным узлам.',
  didLink: 'ArcBlock DID',
  networkTitle: 'Децентрализованная сеть серверов',
  networkDescription:
    'Выберите доверенный сервер или запустите свой для организации. При смене сервера существующие письма остаются на исходном сервере.',
  blockletsLink: 'ARC Blocklets',
  envelopesTitle: 'NFT-конверты',
  envelopesDescription:
    'Сервисные узлы предлагают NFT-конверты для внешней почты. Участники одного сервера, отвечающие условиям, обмениваются письмами напрямую без конвертов и транзакций в блокчейне.',
  footer: 'DIDMail · На базе ARC',
};

return {"default": defaultExport};
})();

// ---- locales.js ----
modules["locales.js"] = (() => {

const config = modules["locales/config.js"].default;

const en = modules["locales/en.js"].default;

const zh = modules["locales/zh.js"].default;

const ar = modules["locales/ar.js"].default;

const ja = modules["locales/ja.js"].default;

const ru = modules["locales/ru.js"].default;

const dictionaries = { en, zh, ar, ja, ru };
 const languages = config.languages;
 const defaultLocale = config.defaultLocale;
 function resolveLocale(value) {
  const locale = String(value || '').toLowerCase();
  return (
    languages.find(({ code }) => code.toLowerCase() === locale)?.code ||
    languages.find(({ code }) => code.toLowerCase() === locale.split('-')[0])?.code ||
    defaultLocale
  );
}
 function messages(locale) {
  return { ...en, ...dictionaries[resolveLocale(locale)] };
}
 function localeDirection(locale) {
  return resolveLocale(locale) === 'ar' ? 'rtl' : 'ltr';
}
 function localizedPath(path, locale) {
  const language = resolveLocale(locale);
  return language === defaultLocale ? path : `/${language}${path === '/' ? '/' : path}`;
}

return {"languages": languages, "defaultLocale": defaultLocale, "resolveLocale": resolveLocale, "messages": messages, "localeDirection": localeDirection, "localizedPath": localizedPath};
})();

// ---- theme.js ----
modules["theme.js"] = (() => {
// Serialized into the native head before paint; keep this controller self-contained.
 function themeBootstrap() {
  if (window.didmailTheme) return;
  const root = document.documentElement;
  const read = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const valid = value => value === 'light' || value === 'dark';
  let current;
  const cookie = () => {
    try { return document.cookie.match(/(?:^|;\s*)arc_mode=(light|dark)(?=;|$)/)?.[1]; } catch { return null; }
  };
  const persist = () => {
    try { localStorage.setItem('web-mode', current); } catch { /* Retain session/cookie choice. */ }
    try { document.cookie = `arc_mode=${current};path=/;max-age=31536000;SameSite=Lax`; } catch { /* Retain session choice. */ }
  };
  const resolve = () => {
    const saved = read('web-mode');
    if (valid(saved)) return saved;
    if (saved === 'system' || saved === 'auto') {
      const applied = root.getAttribute('data-mode');
      current = valid(applied) ? applied : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      persist();
      return current;
    }
    return cookie() || 'dark';
  };
  const preference = () => current;
  const apply = () => {
    root.setAttribute('data-mode', current);
    root.setAttribute('data-didmail-appearance', current);
    root.removeAttribute('data-theme');
    window.dispatchEvent(new CustomEvent('didmail-appearance-change', { detail: { choice: current, effective: current } }));
  };
  const choose = choice => {
    if (!valid(choice)) return;
    current = choice;
    persist();
    apply();
  };
  for (const [key, attribute] of [['web-tone', 'data-tone'], ['web-palette', 'data-palette']]) {
    const value = read(key);
    if (value) root.setAttribute(attribute, value);
  }
  current = resolve();
  window.didmailTheme = Object.freeze({ preference, choose, apply });
  window.addEventListener('storage', event => {
    if (event.key === 'web-mode' || event.key === null) {
      current = read('web-mode') === null ? 'dark' : resolve();
      apply();
    }
  });
  apply();
}

 function installThemeControl(header, labels) {
  const trigger = header.querySelector('[data-action-kind="theme-toggle"]');
  if (!trigger || trigger.dataset.appearanceReady) return;
  if (!window.didmailTheme) themeBootstrap();
  trigger.removeAttribute('onclick');
  trigger.onclick = null;
  trigger.removeAttribute('aria-haspopup');
  trigger.removeAttribute('aria-expanded');
  trigger.dataset.appearanceReady = 'true';
  const svg = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const icons = {
    light: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2m-3-9 1.4-1.4M3.6 20.4 5 19M5 5 3.6 3.6M19 19l1.4 1.4"/>'),
    dark: svg('<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>'),
  };
  const update = () => {
    const target = window.didmailTheme.preference() === 'dark' ? 'light' : 'dark';
    trigger.dataset.appearanceTarget = target;
    trigger.innerHTML = icons[target];
    trigger.setAttribute('aria-label', labels[target === 'dark' ? 'switchToDark' : 'switchToLight']);
    trigger.title = trigger.getAttribute('aria-label');
  };
  trigger.addEventListener('click', () => window.didmailTheme.choose(trigger.dataset.appearanceTarget));
  window.addEventListener('didmail-appearance-change', update);
  update();
}

return {"themeBootstrap": themeBootstrap, "installThemeControl": installThemeControl};
})();

// ---- brand-motion.js ----
modules["brand-motion.js"] = (() => {
// Motion belongs only to the public welcome artwork; content stays usable.
// Serialized into the home head so SSR cannot paint a mark that then disappears.
 function prepareBrandMotion(doc = document) {
  const root = doc.documentElement;
  const view = doc.defaultView;
  if (root.dataset.didmailBrandEntrance) return;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  root.dataset.didmailBrandEntrance = reduced.matches || !view.Element.prototype.animate ? 'static' : 'pending';
  view.setTimeout(() => {
    // A missing/slow enhancement must not leave meaningful artwork hidden.
    if (root.dataset.didmailBrandEntrance === 'pending') root.dataset.didmailBrandEntrance = 'static';
  }, 1000);
}

 function installBrandMotion(doc = document) {
  const emblem = doc.querySelector('.dm-home-emblem');
  if (!emblem || emblem.dataset.brandMotionReady) return;
  emblem.dataset.brandMotionReady = 'true';
  const view = doc.defaultView;
  const root = doc.documentElement;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const bounds = emblem.getBoundingClientRect();
  let inView = bounds.bottom > 0 && bounds.top < view.innerHeight && bounds.right > 0 && bounds.left < view.innerWidth;
  let animation;
  let environment;
  const light = doc.querySelector('.dm-home-light');
  let artworkReady = false;
  let disposed = false;
  const state = (phase) => { emblem.dataset.brandMotion = phase; };
  const synchronize = () => {
    if (disposed) return;
    const covered = [...doc.querySelectorAll('dialog[open], [aria-modal="true"]')].some((dialog) =>
      !dialog.hidden && dialog.getAttribute('aria-hidden') !== 'true' && dialog.getClientRects().length > 0);

    for (const current of [animation, environment]) {
      if (!current) continue;
      if (doc.hidden || !inView || covered) current.pause();
      else if (current.playState === 'paused') current.play();
    }
  };
  const float = () => {
    state('floating');
    animation = emblem.animate([
      { transform: 'translateY(0) scale(1)', opacity: 1, easing: 'ease-in-out' },
      { transform: 'translateY(-24px) scale(1.10)', opacity: 1, offset: 0.5, easing: 'ease-in-out' },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 12000, iterations: Infinity, easing: 'linear' });
    animation.id = 'didmail-brand-float';
    synchronize();
  };
  const staticArtwork = () => {
    animation?.cancel();
    environment?.cancel();
    environment = undefined;
    animation = undefined;
    state('static');
    root.dataset.didmailBrandEntrance = 'consumed';
  };
  if (!emblem.animate) { staticArtwork(); return; }
  const startEnvironment = () => {
    if (environment || !light || reduced.matches) return;
    environment = light.animate([
      { transform: 'translate3d(-2%, -1%, 0)', opacity: 0.65 },
      { transform: 'translate3d(3%, 2%, 0)', opacity: 1 },
      { transform: 'translate3d(-2%, -1%, 0)', opacity: 0.65 },
    ], { duration: 24000, iterations: Infinity, easing: 'ease-in-out' });
    environment.id = 'didmail-brand-space';
  };
  const start = () => {
    if (reduced.matches) { staticArtwork(); return; }
    startEnvironment();
    if (root.dataset.didmailBrandEntrance !== 'pending') {
      // A consumed entrance may float without hiding the artwork again.
      float();
      root.dataset.didmailBrandEntrance = 'consumed';
    } else {
      state('entrance');
      const entrance = emblem.animate([
        { transform: 'scale(0.76)', opacity: 0 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ], { duration: 1800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' });
      animation = entrance;
      root.dataset.didmailBrandEntrance = 'consumed';
      entrance.id = 'didmail-brand-entrance';
      synchronize();
      entrance.finished.then(() => {
        if (disposed || animation !== entrance || reduced.matches) return;
        // The floating timeline owns the final pose; release the entrance fill.
        float();
        entrance.cancel();
      }).catch(() => { /* Reduced motion can cancel an unfinished entrance. */ });
    }
  };
  const image = emblem.querySelector('img');
  const imageReady = async () => {
    try { await image.decode?.(); } catch { /* A failed image stays static. */ }
    if (disposed) return;
    artworkReady = image.complete && image.naturalWidth > 0;
    if (!artworkReady || root.dataset.didmailBrandEntrance === 'static') staticArtwork();
    else start();
  };
  if (reduced.matches) staticArtwork();
  else state('waiting');
  const loaded = () => { void imageReady(); };
  if (!image) staticArtwork();
  else if (image.complete) void imageReady();
  else {
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', staticArtwork, { once: true });
  }
  const preferenceChanged = () => {
    if (reduced.matches) staticArtwork();
    else if (artworkReady && !animation) { startEnvironment(); float(); } // Never replay an entrance after preference changes.
  };
  if (reduced.addEventListener) reduced.addEventListener('change', preferenceChanged);
  else reduced.addListener(preferenceChanged);
  doc.addEventListener('visibilitychange', synchronize);
  let observer;
  if (view.IntersectionObserver) {
    observer = new view.IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio > 0;
      synchronize();
    }, { threshold: [0, 0.01] });
    observer.observe(emblem);
  }
  const overlays = view.MutationObserver ? new view.MutationObserver(synchronize) : undefined;
  overlays?.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-hidden', 'aria-modal', 'style', 'class'] });
  const leaving = (event) => {
    if (event.persisted) { animation?.pause(); environment?.pause(); return; }
    disposed = true;
    animation?.cancel();
    environment?.cancel();
    observer?.disconnect();
    overlays?.disconnect();
    if (reduced.removeEventListener) reduced.removeEventListener('change', preferenceChanged);
    else reduced.removeListener(preferenceChanged);
    doc.removeEventListener('visibilitychange', synchronize);
    image?.removeEventListener('load', loaded);
    image?.removeEventListener('error', staticArtwork);
    view.removeEventListener('pageshow', synchronize);
    view.removeEventListener('pagehide', leaving);
  };
  view.addEventListener('pagehide', leaving);
  view.addEventListener('pageshow', synchronize);
}

return {"prepareBrandMotion": prepareBrandMotion, "installBrandMotion": installBrandMotion};
})();

// ---- locales/admin-zh.js ----
modules["locales/admin-zh.js"] = (() => {
const defaultExport = {
  'Single-file limit exceeds total attachment limit': '单个附件上限不能超过附件总上限。',
  'Clear search': '清除搜索',
  'Help and usage': '帮助与使用文档',
"Node funded":"节点出资",
"Node-paid NFT cost":"节点支付的 NFT 费用",

"Namecard category":"名片分类",
"Public namecard":"公开名片",
"Member-only namecard":"成员专用名片",
"Member namecards require a bound active member.":"成员专用名片仅限已绑定邮箱的活跃 ARC 成员使用。",

"Envelope category":"信封分类",
"Public envelope":"公开信封",
"Member-only envelope":"成员专用信封",
"Member envelopes require a bound active member.":"成员专用信封仅限已绑定邮箱的活跃 ARC 成员使用。",
"Envelope category saved.":"信封分类已保存。",
"Member envelope":"成员专用信封",
"Setup only":"配置准备中",
"Members send for free. The node pays the NFT minting cost.":"成员发信免费，NFT 铸造费用由节点承担。",
"Sponsorship is not enabled yet. Saving these settings does not allow free sending.":"节点代付尚未启用，保存配置不会开放免费发送。",
"Public default envelope":"公开默认信封",
"Member default envelope":"成员默认信封",
"Daily limit per member":"每位成员每日封数",
"Per-minute limit per member":"每位成员每分钟封数",
"Daily node sponsorship budget (UTC)":"节点每日代付预算（UTC 日）",
"Only a zero-price published NFT can be selected as the member envelope. Membership and mailbox binding are required.":"只能选择已发布且价格为 0 的信封 NFT。免费资格需要活跃成员身份和邮箱绑定。",
"Save configuration":"保存配置",
"Manage members":"管理成员",
"Configuration saved. Sponsorship remains disabled.":"配置已保存，节点代付仍未启用。",
"Configuration could not be saved. Refresh and try again.":"无法保存配置，请刷新后重试。",
"Member envelope configuration is unavailable.":"成员信封配置暂不可用。",
"Not configured":"未配置",
"Automatic public default":"自动选择公开默认信封",
"Mail fee":"邮件费用",
"Total fee":"费用合计",
"Mail":"邮件",
"Participants":"收发双方",
"Preparing":"准备中",
"Awaiting signature":"待签名",
"Queued":"排队中",
"Confirming payment":"付款确认中",
"Creating mail NFT":"生成邮件 NFT",
"Delivered":"已投递",
"Rejected":"已拒绝",
"Expired":"已过期",
"Review required":"待核查",
"Unknown status":"状态未知",
"Historical record":"历史记录",
"Recorded amount":"记录金额",
"Payment confirmed":"付款已确认",
"Confirmation pending":"等待确认",
"Quoted amount":"报价",
"Node service fee":"节点服务费",
"Developer share":"开发者分成",
"Indexing fee":"索引费用",
"Fee breakdown":"费用明细",
"Quote breakdown":"报价明细",
"Mail details {id}":"邮件 {id} 的详情",
"Message identifiers":"邮件标识",
"Transaction records":"交易记录",
"Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.":"删除仅清理本节点上的密文，链上记录和已下载的副本保留。",
"Delivery is in progress. Deletion is unavailable until it finishes.":"邮件正在投递，完成后才可删除。",
"Loading sender list…":"正在读取名单…",
"Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.":"屏蔽后，该账户无法通过本站发信；收信和历史邮件下载不受影响。",
"Allowlisted accounts can send through this server when access is restricted.":"启用受限发送时，允许名单内的账户可通过本站发信。",
"How access works":"规则说明",
"Enter a valid mailbox or ARC DID.":"请输入有效的邮箱 DID 或 ARC 登录 DID。",
"Could not confirm the result. Refresh the list before retrying.":"无法确认操作结果，请刷新名单核对后再重试。",

"A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.":"已有效质押 DIDMail 服务节点 NFT 时对外开放；未质押时，仅已绑定邮箱的本站活跃成员可发信。已屏蔽账户始终不可使用。",
"Any sender":"任何发件人",
"Members of this server":"仅本站成员",
"Allowlisted senders":"仅允许名单内的账户",
"These controls apply only to new mail sent through this server. Receiving and historical downloads are unaffected.":"以下设置仅影响通过本节点发送的新邮件，不影响收信和历史邮件下载。",
"Who can send through this server?":"谁可以使用本节点发信？",
"Current setting: {mode}":"当前：{mode}",
"Anyone can submit mail here, except blocked accounts. Service fees still follow your settings.":"除已屏蔽账户外，任何人都可使用本站发信。费用按邮件服务设置收取。",
"Only active non-guest ARC members with a linked mailbox can submit mail here.":"仅已绑定邮箱的活跃 ARC 成员可发信，访客不包含在内。",
"Only accounts on the allowlist can submit mail here.":"仅允许名单内的账户可使用本站发信。",
"No unsaved changes":"设置已保存",
"Unsaved changes":"有未保存的更改",
"Member permissions come from ARC. Manage members and invitations above; no separate allowlist is needed.":"成员资格由 ARC 管理。请在上方管理成员和邀请，无需另建白名单。",
"Blocked senders":"屏蔽发件人",
"Allowed senders":"允许发件人",
"Blocked accounts cannot submit new mail here, even if they are members.":"被屏蔽的账户不能通过本站发送新邮件，成员也不例外。",
"These accounts can submit mail when sending is restricted to the allowlist.":"选择“仅允许名单内的账户”时，下列账户可以发信。",
"Block a sender":"屏蔽账户",
"Allow a sender":"允许账户",
"Account DID":"账户 DID",
"Paste a mailbox DID or ARC login DID.":"可粘贴邮箱 DID 或 ARC 登录 DID。",
"Note (optional)":"备注（选填）",
"Why is this account listed?":"例如：垃圾邮件、测试账户",
"Confirm block":"确认屏蔽",
"Confirm allow":"确认允许",
"Edit note":"编辑备注",
"Unblock":"解除屏蔽",
"Remove from allowlist":"移出允许名单",
"No blocked senders":"尚未屏蔽任何账户",
"No allowed senders yet":"允许名单为空",
"To stop an account from using this server, choose Block a sender.":"如需阻止某个账户使用本站发信，点击“屏蔽账户”。",
"Add an account above before enabling allowlist-only sending.":"启用仅允许名单发信前，请先添加允许的账户。",
"Changing this list does not change the sending scope above.":"修改名单不会改变上方的发信范围。",
"Sending scope saved.":"发信范围已保存。",
"Note updated.":"备注已更新。",
"Sender blocked.":"已屏蔽此账户。",
"Sender allowed.":"已允许此账户。",
"Save note":"保存备注",
"Sender unblocked.":"已解除屏蔽。",
"Sender removed from allowlist.":"已移出允许名单。",

"Search members…":"搜索成员…",
"All roles":"所有角色",
"All statuses":"所有状态",
"Manage and invite":"管理与邀请",
"Unnamed member":"未命名成员",
"Try another name, DID, or filter.":"请尝试其他姓名、DID 或筛选条件。",
"Only active non-guest members qualify for member benefits.":"活跃的非访客成员可享成员权益。",
"Access and blocklist":"发送权限与黑名单",
"guest":"访客",

"Save sending access":"保存发送权限",
"Members":"成员",
"View ARC members and linked mailboxes.":"查看 ARC 成员及绑定邮箱。",
"Configure mail service and attachment limits.":"配置邮件服务与附件限制。",
"Members and invitations are managed in ARC. Only active non-guest members qualify for member benefits.":"成员与邀请统一在 ARC 管理。活跃的非访客成员可享成员权益。",
"Link a mailbox":"如何绑定邮箱",
"In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.":"在 DIDMail 登录邮箱，进入“服务器”，连接此私有服务器，点击“绑定邮箱”。使用对应 ARC 成员账户确认授权后，刷新此页即可查看。",
"Linking requires the mailbox signature and member consent. Administrators cannot assign another person’s mailbox.":"绑定需要邮箱签名与成员授权，管理员无法替他人指定邮箱。",
"Member":"成员",
"Role":"角色",
"Active":"活跃",
"Inactive":"停用",
"Linked mailbox":"绑定邮箱",
"Association":"绑定状态",
"Not linked":"未绑定",
"Linked":"已绑定",
"No matching members.":"没有匹配的成员。",
"Page {page} · {total} members":"第 {page} 页 · 共 {total} 名成员",
"Search members":"搜索成员",
"Name or DID":"姓名或 DID",
"ARC member service is unavailable. Refresh to retry.":"成员服务暂不可用，请刷新重试。",

"Manage ARC members and invitations":"管理 ARC 成员和邀请",
"Active ARC members pay no ordinary-mail or attachment fees. Manage membership and invitations in the ARC console. Guests are excluded.":"活跃的 ARC 成员免普通邮件和附件服务费。请在 ARC 控制台管理成员和邀请，访客不享有资格。",
"Denylist takes priority. Members-only sending requires an active linked ARC member.":"黑名单优先。仅成员发送模式要求已绑定且活跃的 ARC 成员。",
"Active ARC members only":"仅活跃的 ARC 成员",
"Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.": "黑名单优先；仅白名单发送模式下，空名单拒绝新发信，不改变节点公开状态。",

  "All senders except denylist": "除黑名单外的所有发件人",
  "Public listing depends on a staked DIDMail server node NFT. Allowlisted senders pay no ordinary-mail or attachment fees.": "公开展示取决于是否质押 DIDMail 服务节点 NFT；白名单发件人的普通邮件和附件费用均为零。",

  "DID details": "DID 详情",
  "Copy DID": "复制 DID",
  "DID QR code": "DID 二维码",
  "DID copied.": "DID 已复制。",
  "Copy failed. Copy the full DID below manually.": "复制失败，请手动复制下方完整 DID。",

  "Settings": "设置",
  "Configure mail service, access lists, and delivery operations.": "配置邮件服务、访问名单与投递运维。",
  "Mail service": "邮件服务",
  "Delivery status is unavailable. Refresh to try again.": "投递状态暂不可用，请刷新重试。",

  'Experimental ordinary mail supports free mail and signed service payments.':
    '实验普通邮件支持免费邮件和需签名确认的服务付费。',
  Message: '邮件',
  Status: '状态',
  'Mail Service and Access': '邮件服务与发送权限',
  'Access lists control who can send and store mail here. External recipients can still download their mail.':
    '名单仅限制谁能使用本节点发送和存储邮件；外部收件人仍可下载自己的邮件。',
  'Sending access': '发送权限',
  'Public node': '公开节点',
  'Allowlist only': '仅白名单',
  'Denylist takes priority. An empty allowlist never opens a restricted node.':
    '黑名单优先；受限模式下，白名单为空也不会开放节点。',
  'Ordinary mail': '普通邮件',
  'Experimental ordinary mail supports free service only.': '当前普通邮件试用仅支持免费服务。',
  'Ordinary mail is not available yet. Its terms can be prepared below.': '普通邮件尚未开放，可先配置服务条款。',
  'Enable ordinary mail': '启用普通邮件',
  'Retention in days': '保存期限（天）',
  'Base fee in native token units': '基础费（原生代币最小单位）',
  'Attachment fee per byte per day in native token units': '附件每字节每天费用（原生代币最小单位）',
  'Fees use the smallest token unit. Set both fees to zero for free mail. NFT envelope terms remain unchanged.':
    '费用以代币最小单位填写；两项费用均为 0 时免费。NFT 信封条款不受影响。',
  'New mail attachment limits': '新邮件附件限制',
  'Allow attachments': '允许附件',
  'Maximum attachment count': '附件最大数量',
  'Enter sizes that convert to whole bytes within the allowed limits.': '请输入在允许范围内且可转换为整数字节的大小。',
  'The mail NFT transaction was rejected. The server will retry without another sender payment.': '邮件 NFT 创建交易被拒绝，服务器将自动重试，无需发件人再次付款。',
  'Waiting to retry': '等待重试',
  'Delivery progress': '投递进度',
  'Diagnostic code': '诊断代码',
  'Reason': '原因',
  'Next attempt': '下次重试',
  'Previous NFT transactions': '历史 NFT 创建交易',
  'Payment was rejected. No mail NFT was created.': '付款被拒绝，未创建邮件 NFT。',
  'Delivery is paused for verification. Original transactions are retained.': '投递已暂停，等待核查。原始交易记录已保留。',
  'The server retries automatically using the saved delivery task. No additional sender payment is required.': '服务器会根据已保存的投递任务自动重试，无需发件人再次付款。',
  'Maximum file size (MiB)': '单个附件大小上限（MiB）',
  'Maximum total attachment size (MiB)': '附件总大小上限（MiB）',
  'Maximum encrypted message size (MiB)': '整封加密邮件大小上限（MiB）',
  'File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.':
    '附件限制按明文字节计算，整封邮件限制包含加密开销。已接受的邮件保持原有条款。',
  'The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.':
    '节点和发件人均须满足原生代币免手续费质押要求；下载无需质押。',
  'Save mail service policy': '保存邮件服务设置',
  'DID access lists': 'DID 名单',
  List: '名单类型',
  Allowlist: '白名单',
  Denylist: '黑名单',
  Remark: '备注',
  'Add or update remark': '添加或更新备注',
  'List changes do not automatically change the access mode.': '名单变动不会自动切换访问模式。',
  'Added at': '添加时间',
  'Remove from list': '从名单删除',
  'No DIDs in this list.': '此名单暂无 DID。',
  'Policy changed or is unavailable. Refresh and review before retrying.':
    '设置已变更或当前不可用，请刷新并核对后重试。',
  'Mail service settings saved.': '邮件服务设置已保存。',
  'Loading mail service policy…': '正在加载邮件服务设置…',
  'Server endpoint': '当前服务节点 endpoint',
  'Copy endpoint': '复制 endpoint',
  'Endpoint copied.': '已复制 endpoint。',
  'Copy failed. Select the endpoint above and copy it manually.': '复制失败，请选中上方完整 endpoint 手动复制。',
  'Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.':
    '将此 endpoint 设置到 DIDMail 客户端即可直连，无需 Node NFT。',

  'Delivery state': '投递状态',
  Amount: '金额',
  'Revoke gas stake': '解除质押',
  'Claim gas stake': '取回',
  'Pending withdrawals': '待取回资金',
  'Ready to claim': '可取回',
  'Available to claim at': '可取回时间',
  'Revoking gas stake…': '正在解除质押…',
  'Claiming gas stake…': '正在取回质押…',
  'Gas stake revocation submitted': '解除质押已提交',
  'Gas stake claim submitted': '取回质押已提交',
  'Funds return to the node account. Claiming may end gas-free eligibility.':
    '资金将返回节点账户，取回后可能不再满足免手续费要求。',
  'Gas stake changed. Refresh and review before submitting.': '质押状态已变化，请刷新后重新确认。',
  'No revocable gas stake is available.': '暂无可解除的质押。',
  'No matching gas stake withdrawal is available.': '未找到对应的待取回资金。',
  'The gas stake waiting period has not ended.': '质押等待期尚未结束。',
  'Gas stake withdrawal history could not be verified.': '无法验证解除质押与取回记录，请稍后刷新。',

  'Manage node funds, transfers, and gas staking.': '管理节点账户的充值、转账与免手续费质押。',
  'Manage your service node NFT and its stake.': '管理服务节点 NFT 的购买与质押。',
  'Refresh node NFTs': '刷新节点 NFT',
  'Node address': '节点地址',
  Back: '返回',
  'Gas stake': '质押',
  'Account operations': '账户操作',
  'Stake for gas': '免手续费质押',
  'Loading gas staking rules…': '正在查询链上质押规则…',
  'Only the node owner can stake for gas.': '仅节点所有者可以进行免手续费质押。',
  'Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.':
    '质押网络原生代币，获得免交易手续费资格。此质押与服务节点 NFT 质押独立。',
  '{count} days': '{count} 天',
  'After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.':
    '申请解除质押后，需等待 {count} 天才能领取资金。滥用网络可能导致质押被罚没。',
  'Gas stake already sufficient': '已质押',
  'Confirm gas stake': '确认免手续费质押',
  'Submitting gas stake…': '正在提交质押…',
  'Gas stake submitted': '质押已提交',
  'Gas staking rules could not be verified.': '无法验证链上免手续费质押规则。',
  'Gas stake state could not be verified.': '无法验证免手续费质押状态。',
  'Gas staking rules changed. Review the latest terms before submitting.': '链上质押规则已变化，请刷新并重新确认条款。',
  'This node already has enough gas stake.': '节点已满足免手续费质押要求。',
  'Gas stake could not be confirmed. Check the stake state before retrying.':
    '无法确认质押结果，请核对链上质押状态后再操作。',

  'Node funds': '节点资金',
  'Transfer out': '转出',
  'Only the node owner can transfer funds.': '仅节点所有者可以转出资金。',
  'Loading available balance…': '正在查询可用余额…',
  'Transfer available funds to the node owner. Staked funds cannot be transferred.':
    '将可用余额转给节点所有者。已质押资金不可转出。',
  'Recipient address': '收款地址',
  'Available balance': '可用余额',
  'Transfer amount': '转出金额',
  'Keep enough funds in the node wallet for transaction fees.': '请保留足够余额用于支付交易手续费。',
  'Review transfer': '确认转出信息',
  'Transfer amount must be greater than zero.': '转出金额必须大于 0。',
  'Insufficient available balance.': '可用余额不足。',
  'Confirm transfer': '确认转出',
  'This transfer cannot be undone.': '转账提交后无法撤销。',
  'Transfer to owner': '转给所有者',
  'Submitting transfer…': '正在提交转账…',
  'Transfer submitted': '转账已提交',
  'Transaction hash': '交易哈希',
  'Refresh the node balance to verify the result.': '请刷新节点余额确认转账结果。',
  'The owner does not have a valid recipient DID.': '所有者没有有效的收款 DID。',
  'Node balance could not be verified.': '无法验证节点余额。',
  'Transfer could not be confirmed. Check the node balance and transaction history before retrying.':
    '无法确认转账结果，请检查节点余额和交易记录后再操作。',

  'Acquiring…': '正在获取…',
  'Node balance unavailable ({code}; {stage}; {path}).': '节点余额查询失败（{code}；{stage}；{path}）。',
  transport: '连接或超时',
  http: 'HTTP 响应',
  rpc: 'AFS 查询',
  decode: '响应解析',
  'Some node data is unavailable': '部分节点数据暂不可用',
  Details: '详情',
  'Recharge on {network} to activate this node.': '在 {network} 网络充值以激活节点。',
  'Server Node Factory information': '服务节点 NFT 工厂信息',
  'NFT SVG template': 'NFT SVG 模板',
  'Server node NFT SVG template': '服务节点 NFT SVG 模板',
  'No SVG template available': '暂无 SVG 模板',
  Executive: '商务典雅',
  Tech: '科技极简',
  Creative: '创意工作室',
  Consultant: '清雅顾问',
  executiveCard: '商务典雅',
  techCard: '科技极简',
  creativeCard: '创意工作室',
  consultantCard: '清雅顾问',
  'About SVG Namecard templates': '关于 SVG 名片模板',
  'SVG Namecard template': 'SVG 名片模板',
  'Contact name.': '联系人姓名。',
  'Company or organization.': '公司或组织。',
  'Job title or position.': '职位。',
  'Phone number.': '电话号码。',
  'Email address.': '电子邮箱地址。',
  'Website URL.': '网站地址。',
  'Location.': '所在地。',
  'Background or personal introduction.': '背景或个人介绍。',
  'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.':
    'SVG 名片模板用于定义联系人名片 NFT 的外观。客户端展示名片时，会用个人资料或解密后的联系人数据替换占位变量。',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.':
    '变量名须保留完整的双花括号。请上传有效的 .svg 文件，最大 5 MB，必须包含 contact.name。可下载样例修改后再上传。字段值由客户端提供，未提供的字段显示为空；当前预览展示占位变量，不是真实联系人数据。',

  'Last chain sync:': '上次链上同步：',
  'Chain sync failed. Showing saved data; try Refresh again.': '链上同步失败，正在显示已保存的数据，请稍后再次刷新。',
  'About SVG Envelope templates': '关于 SVG 信封模板',
  'SVG Envelope template': 'SVG 信封模板',
  'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.':
    'SVG 信封模板用于定义邮件 NFT 的封面外观。客户端展示邮件时，会用邮件数据替换占位变量，不改变加密的邮件正文。',
  'Supported variables': '支持的变量',
  Required: '必需',
  Example: '示例',
  'Mail subject, filled by the client after decryption.': '邮件主题，由客户端解密后填入。',
  'Sender DID address.': '发件人的 DID 地址。',
  'Mail creation time, formatted by the client.': '邮件创建时间，格式由客户端决定。',
  'Mail expiration time, formatted by the client.': '邮件过期时间，格式由客户端决定。',
  'Envelope NFT address. Some send previews do not provide this value.': '信封 NFT 地址；部分发送预览不提供此值。',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.':
    '变量名须保留完整的双花括号。请上传有效的 .svg 文件，最大 5 MB，必须包含 mail.subject 和 mail.sender。可下载样例修改后再上传；当前预览展示模板占位变量，不是真实邮件数据。',

  'Session expired. Refresh the page to sign in again.': '会话已过期，请刷新页面重新登录。',
  envelope: '信封',
  namecard: '名片',
  owner: '所有者',
  admin: '管理员',
  member: '成员',
  'Page size': '每页数量',
  Server: '服务节点',
  Envelope: '信封',
  Namecard: '名片',
  Storage: '存储',
  Attachments: '附件',
  Envelopes: '信封',
  Namecards: '名片',
  'Manage your node identity, balance, and stake.': '管理节点身份、余额和质押。',
  'Create and publish envelope templates for your node.': '创建并发布节点的信封模板。',
  'Create and publish namecard templates for your node.': '创建并发布节点的名片模板。',
  'Search and manage encrypted mail stored on your node.': '搜索并管理节点存储的加密邮件。',
  'Manage attachment limits and storage pricing.': '管理附件限制和存储价格。',
  'DIDMail business navigation': 'DIDMail 业务导航',
  'Checking ARC session…': '正在验证 ARC 会话…',
  'Loading node account…': '正在加载节点账户…',
  'Loading page data…': '正在加载页面数据…',
  'Node account': '节点账户',
  'DIDMail · Powered by ARC': 'DIDMail · 由 ARC 提供支持',
  'DIDMail Admin': 'DIDMail 管理',
  'Sign in to manage your server node.': '登录以管理你的服务节点。',
  'Sign in with ARC': '使用 ARC 登录',
  'Permission denied: Only owner or admin can access this page, current role is {role}':
    '无权访问：仅所有者或管理员可以访问此页面，当前角色为 {role}',
  Retry: '重试',
  Cancel: '取消',
  Close: '关闭',
  'DIDMail Server Node': 'DIDMail 服务节点',
  Unknown: '未知',
  'Loading…': '加载中…',
  Staked: '已质押',
  'No Stake': '未质押',
  Revoked: '已撤销',
  'Refresh node account': '刷新节点账户',
  'Updating node data…': '正在更新节点数据…',
  'Chain data is unavailable. Balances and stake could not be verified.': '链上数据暂不可用，无法验证余额和质押状态。',
  'Stake data is unavailable: {message}': '质押数据暂不可用：{message}',
  'This node has no on-chain account yet. Recharge its address on the {network} network.':
    '此节点尚未激活链上账户，请在 {network} 网络向节点地址充值。',
  'Show node recharge QR code': '显示节点充值二维码',
  Balance: '余额',
  Unavailable: '暂不可用',
  'NO BALANCE': '暂无余额',
  'NO STAKED': '暂无质押',
  'NO REVOKED': '暂无撤销',
  'Database Used Size:': '数据库已用空间：',
  Refresh: '刷新',
  Mails: '邮件',
  Search: '搜索',
  'Search By ID/Address/Envelope/Hash': '按 ID、地址、信封或哈希搜索',
  'Loading {type} factory…': '正在加载{type}工厂…',
  '{type} List': '{type}列表',
  Clean: '清理',
  Name: '名称',
  Address: '地址',
  Description: '描述',
  Limit: '发行上限',
  Minted: '已铸造',
  'Created At': '创建时间',
  'Updated At': '更新时间',
  'Owned By': '所有者',
  Price: '价格',
  'To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.':
    '要成为 DIDMail 公共服务节点，需要购买并质押节点 NFT，才能被客户端发现并显示在服务节点列表中。',
  'DIDMail Server Node NFT Factory': 'DIDMail 服务节点 NFT 工厂',
  Acquired: '已获取',
  Acquire: '获取',
  'Acquire DIDMail server node NFT for stake': '获取 DIDMail 服务节点 NFT 以进行质押',
  'Acquired DIDMail server node NFT for stake': '已获取用于质押的 DIDMail 服务节点 NFT',
  'Loading node factory…': '正在加载节点工厂…',
  'Stake information could not be loaded. Refresh the node account to retry.': '无法加载质押信息，请刷新节点账户重试。',
  'Loading node NFTs…': '正在加载节点 NFT…',
  'No staked node NFTs yet': '暂无已质押的节点 NFT',
  'Server Node NFT': '服务节点 NFT',
  'Stake Address': '质押地址',
  'Amount to stake': '将质押金额',
  Location: '位置',
  'Revoke Waiting Period': '撤销等待期',
  '{count} seconds': '{count} 秒',
  Stake: '质押',
  Revoke: '撤销质押',
  Claim: '领取',
  'Additional stake': '追加质押数量',
  'Add Stake': '追加质押',
  'The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.':
    'NFT 的服务地址与当前应用地址不同，请先撤销并领取质押，再更新地址。',
  'App URL': '应用地址',
  'Endpoint URL': '服务地址',
  'Update Endpoint': '更新服务地址',
  'Attachment Policy': '附件策略',
  'Max File Size': '单个文件大小上限',
  'MB · Limit for a single encrypted attachment on the wire.': 'MB · 单个加密附件的传输大小上限。',
  'Max File Count': '附件数量上限',
  'Maximum attachments allowed per mail.': '每封邮件允许的最大附件数量。',
  'Price Per Byte Per Day': '每字节每天价格',
  'Storage unit price in wei (digits only).': '存储单价，单位为 wei（仅限数字）。',
  'Last updated:': '最后更新：',
  'Save Policy': '保存策略',
  '{type} Factory': '{type}工厂',
  'Upload SVG {type} template file': '上传 SVG {type}模板文件',
  Unlimited: '不限期',
  'Retention Period': '保留期限',
  'Mail retention on this server, in days; 0 means unlimited.': '邮件在服务器上的保留时长，单位：天；0 表示不限期。',
  'Factory acquisition cost:': '工厂获取费用：',
  'Creating Factory…': '创建中…',
  'Create Factory': '创建工厂',
  'Create {type} NFT Factory': '创建{type} NFT 工厂',
  '{type} Factory information': '{type}工厂信息',
  'Default Namecard': '默认名片',
  'The sender of the namecard will cover the costs.': '费用由名片发送方承担。',
  'Envelope Factory': '信封工厂',
  'Envelope Factory information': '信封工厂信息',
  'Confirmed before creation': '创建前确认',
  'Loading Envelope factory…': '正在加载信封工厂…',
  '5–80 characters.': '长度为 5–80 个字符。',
  '1–50 characters.': '长度为 1–50 个字符。',
  'The sender of the mail will cover the costs.': '费用由邮件发送方承担。',
  'Enter name': '请输入名称',
  'Enter description': '请输入描述',
  Day: '天',
  'Click or drop an SVG file · up to 5 MB': '点击或拖入 SVG 文件 · 最大 5 MB',
  'Click the preview to replace the SVG template.': '点击预览可更换 SVG 模板。',
  'Default Envelope': '默认信封',
  'Love Card': '爱心卡片',
  'Pig Card': '小猪卡片',
  'Business Card': '商务卡片',
  'Festival Card': '节日卡片',
  Preview: '预览',
  'SVG template preview': 'SVG 模板预览',
  'Select or upload an SVG template.': '选择或上传 SVG 模板。',
  'SVG {type} template samples': 'SVG {type}模板示例',
  'Use {name}': '使用{name}',
  'Download SVG': '下载 SVG',
  default: '默认模板',
  loveCard: '爱心卡片',
  pigCard: '小猪卡片',
  businessCard: '商务卡片',
  festivalCard: '节日卡片',
  'Updating in background…': '正在后台更新…',
  'Loading {type} list…': '正在加载{type}列表…',
  'Preview not available': '暂无预览',
  'Enable And Publish': '启用并发布',
  'Enable {name}': '启用{name}',
  '{count} Day': '{count} 天',
  'No {type} NFTs yet': '暂无{type} NFT',
  'Total:': '总计：',
  Previous: '上一页',
  Next: '下一页',
  'Publish setting saved.': '发布设置已保存。',
  'Loading stored mail…': '正在加载已存邮件…',
  ID: 'ID',
  Hash: '哈希',
  Size: '大小',
  Payment: '支付金额',
  Date: '日期',
  Action: '操作',
  Sender: '发件人',
  Receiver: '收件人',
  Asset: '资产',
  'View hashes': '查看哈希',
  Content: '内容',
  PaymentTx: '支付交易',
  AssetTx: '资产交易',
  Created: '创建时间',
  Download: '下载时间',
  'N/A': '暂无',
  Delete: '删除',
  'Delete mail {id}': '删除邮件 {id}',
  'No matching mail.': '未找到匹配的邮件。',
  'No mails stored yet.': '暂无已存储的邮件。',
  Page: '页码',
  'of {count}': '共 {count} 页',
  Free: '免费',
  Dividend: '分红',
  'Net Profit': '净收益',
  'Choose an SVG file.': '请选择 SVG 文件。',
  'SVG template must be at most 5 MB.': 'SVG 模板不能超过 5 MB。',
  'Invalid SVG document.': 'SVG 文档无效。',
  'The SVG file must contain {fields}': 'SVG 文件必须包含 {fields}',
  ' or ': ' 或 ',
  'Node data is updating. Please wait before submitting a transaction.': '节点数据正在更新，请稍后再提交交易。',
  'Node state could not be verified. Refresh the node data before submitting a transaction.':
    '无法验证节点状态，请刷新节点数据后再提交交易。',
  'Operation failed.': '操作失败。',
  'Recharge Node': '充值',
  Recharge: '充值',
  'Node recharge': '充值',
  'Send funds to this node address.': '请向此节点地址充值。',
  'Network:': '网络：',
  'Use the matching network in your wallet.': '请在钱包中选择对应的网络。',
  'Insufficient balance. Recharge the node first.': '余额不足，请先为节点充值。',
  'Acquire Server Node NFT': '获取服务节点 NFT',
  'The node wallet will pay {cost} and own this NFT.': '节点钱包将支付 {cost}，并持有此 NFT。',
  'Request accepted. Refresh to verify on-chain state.': '请求已受理，请刷新以确认链上状态。',
  'Stake Node NFT': '质押节点 NFT',
  'Revoke Stake': '撤销质押',
  'Claim Stake': '领取质押',
  'Revoke the staked tokens? A waiting period applies before claiming.':
    '确定撤销已质押的代币吗？撤销后需等待一段时间才能领取。',
  'Submit this operation using the node wallet?': '确定使用节点钱包提交此操作吗？',
  'Template could not be loaded.': '无法加载模板。',
  'Clean {type} cache': '清理{type}缓存',
  'Remove cached publish settings for this list? On-chain NFTs remain.':
    '确定移除此列表缓存的发布设置吗？链上 NFT 将保留。',
  'Cache cleaned.': '缓存已清理。',
  'Delete Mail': '删除邮件',
  'Delete mail {id} and its encrypted content? This action cannot be undone.':
    '确定删除邮件 {id} 及其加密内容吗？此操作无法撤销。',
  'Mail deleted.': '邮件已删除。',
  'Select a valid SVG template.': '请选择有效的 SVG 模板。',
  'Enter a valid page or page size.': '请输入有效的页码或每页数量。',
  'Enter positive file limits and a price in whole wei.': '请输入大于零的附件限制，价格须为整数 wei。',
  'Attachment policy saved successfully.': '附件策略已保存。',
  'Enter an integer stake amount within the node balance.': '请输入不超过节点余额的整数质押数量。',
  'Add {amount} tokens to the node stake?': '确定向节点追加质押 {amount} 个代币吗？',
  'Name must be 5–80 characters; description must be 1–50 characters.': '名称须为 5–80 个字符，描述须为 1–50 个字符。',
  'Price must be at least 0.001.': '价格不能低于 0.001。',
  'Retention must be a non-negative integer.': '保留期限须为非负整数。',
  'Insufficient or unavailable node balance.': '节点余额不足或暂不可用。',
  'Create {type} Factory': '创建{type}工厂',
  'The node wallet will pay the factory acquisition cost: {cost}.': '节点钱包将支付工厂获取费用：{cost}。',
  Create: '创建',
  'Factory created successfully.': '工厂创建成功。',
  'Enter a valid token amount.': '请输入有效的代币数量。',
  'Use at most {precision} decimal places.': '最多支持 {precision} 位小数。',
  'Invalid API response ({status}).': 'API 响应无效（{status}）。',
  'Request failed ({status}).': '请求失败（{status}）。',
  'The operation was aborted due to timeout': '请求超时，请稍后重试。',
  'Failed to fetch': '网络请求失败，请检查连接后重试。',
};

return {"default": defaultExport};
})();

// ---- locales/admin-ar.js ----
modules["locales/admin-ar.js"] = (() => {
const defaultExport = {
  'Single-file limit exceeds total attachment limit': 'لا يمكن أن يتجاوز حد المرفق الواحد الحد الإجمالي للمرفقات.',
  'Clear search': 'مسح البحث',
  'Help and usage': 'المساعدة ودليل الاستخدام',
"Node funded":"بتمويل العقدة",
"Node-paid NFT cost":"تكلفة NFT التي تدفعها العقدة",

"Namecard category":"فئة بطاقة التعريف",
"Public namecard":"بطاقة عامة",
"Member-only namecard":"بطاقة للأعضاء فقط",
"Member namecards require a bound active member.":"تتطلب بطاقات الأعضاء عضواً نشطاً مرتبطاً بصندوق بريد.",

"Envelope category":"تصنيف المغلف",
"Public envelope":"مغلف عام",
"Member-only envelope":"مغلف خاص بالأعضاء",
"Member envelopes require a bound active member.":"يلزم عضو ARC نشط وصندوق بريد مربوط لاستخدام مغلفات الأعضاء.",
"Envelope category saved.":"تم حفظ تصنيف المغلف.",
"Member envelope":"مغلف الأعضاء",
"Setup only":"إعداد فقط",
"Members send for free. The node pays the NFT minting cost.":"يرسل الأعضاء مجاناً وتتحمل العقدة تكلفة إصدار NFT.",
"Sponsorship is not enabled yet. Saving these settings does not allow free sending.":"دفع العقدة غير مفعّل بعد. حفظ الإعدادات لا يفعّل الإرسال المجاني.",
"Public default envelope":"المغلف العام الافتراضي",
"Member default envelope":"مغلف الأعضاء الافتراضي",
"Daily limit per member":"الحد اليومي لكل عضو",
"Per-minute limit per member":"الحد لكل دقيقة لكل عضو",
"Daily node sponsorship budget (UTC)":"ميزانية العقدة اليومية (UTC)",
"Only a zero-price published NFT can be selected as the member envelope. Membership and mailbox binding are required.":"يمكن اختيار مغلف NFT منشور بسعر صفر فقط. يلزم عضو نشط وربط صندوق البريد.",
"Save configuration":"حفظ الإعدادات",
"Manage members":"إدارة الأعضاء",
"Configuration saved. Sponsorship remains disabled.":"حُفظت الإعدادات. دفع العقدة لا يزال معطلاً.",
"Configuration could not be saved. Refresh and try again.":"تعذر الحفظ. حدّث الصفحة وأعد المحاولة.",
"Member envelope configuration is unavailable.":"إعدادات مغلف الأعضاء غير متاحة.",
"Not configured":"غير مُعدّ",
"Automatic public default":"اختيار المغلف العام تلقائياً",
"Mail fee":"رسوم الرسالة",
"Total fee":"إجمالي الرسوم",
"Mail":"الرسالة",
"Participants":"المرسل والمستلم",
"Preparing":"جارٍ التحضير",
"Awaiting signature":"بانتظار التوقيع",
"Queued":"في قائمة الانتظار",
"Confirming payment":"جارٍ تأكيد الدفع",
"Creating mail NFT":"جارٍ إنشاء NFT الرسالة",
"Delivered":"تم التسليم",
"Rejected":"مرفوض",
"Expired":"منتهي الصلاحية",
"Review required":"يتطلب مراجعة",
"Unknown status":"حالة غير معروفة",
"Historical record":"سجل سابق",
"Recorded amount":"المبلغ المسجل",
"Payment confirmed":"تم تأكيد الدفع",
"Confirmation pending":"بانتظار التأكيد",
"Quoted amount":"المبلغ المعروض",
"Node service fee":"رسوم خدمة العقدة",
"Developer share":"حصة المطور",
"Indexing fee":"رسوم الفهرسة",
"Fee breakdown":"تفاصيل الرسوم",
"Quote breakdown":"تفاصيل العرض",
"Mail details {id}":"تفاصيل الرسالة {id}",
"Message identifiers":"معرفات الرسالة",
"Transaction records":"سجلات المعاملات",
"Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.":"يحذف هذا الإجراء النسخة المشفرة على هذه العقدة فقط. تبقى سجلات السلسلة والنسخ التي تم تنزيلها.",
"Delivery is in progress. Deletion is unavailable until it finishes.":"يجري تسليم الرسالة. لا يتاح الحذف حتى الانتهاء.",
"Loading sender list…":"جارٍ تحميل القائمة…",
"Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.":"لا تستطيع الحسابات المحظورة الإرسال عبر هذا الخادم. لا يتأثر الاستلام أو تنزيل الرسائل السابقة.",
"Allowlisted accounts can send through this server when access is restricted.":"عند تقييد الإرسال، يمكن للحسابات في قائمة السماح الإرسال عبر هذا الخادم.",
"How access works":"قواعد الوصول",
"Enter a valid mailbox or ARC DID.":"أدخل DID صالحًا لصندوق البريد أو لتسجيل الدخول في ARC.",
"Could not confirm the result. Refresh the list before retrying.":"تعذّر تأكيد النتيجة. حدّث القائمة وتحقق منها قبل إعادة المحاولة.",

"A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.":"يتيح الرهن الفعّال لـNFT عقدة خدمة DIDMail الإرسال للجميع. بدونه يمكن للأعضاء المحليين النشطين المرتبطين ببريد فقط الإرسال. تُستثنى الحسابات المحظورة دائمًا.",
"Any sender":"أي مرسل",
"Members of this server":"أعضاء هذا الخادم فقط",
"Allowlisted senders":"الحسابات المسموح بها فقط",
"These controls apply only to new mail sent through this server. Receiving and historical downloads are unaffected.":"تؤثر هذه الإعدادات على الرسائل الجديدة المرسلة عبر هذا الخادم فقط، ولا تؤثر على الاستلام أو تنزيل الرسائل السابقة.",
"Who can send through this server?":"من يمكنه الإرسال عبر هذا الخادم؟",
"Current setting: {mode}":"الحالي: {mode}",
"Anyone can submit mail here, except blocked accounts. Service fees still follow your settings.":"يمكن للجميع الإرسال باستثناء الحسابات المحظورة. تُطبّق رسوم إعدادات خدمة البريد.",
"Only active non-guest ARC members with a linked mailbox can submit mail here.":"يمكن لأعضاء ARC النشطين المرتبطين بصندوق بريد الإرسال، باستثناء الضيوف.",
"Only accounts on the allowlist can submit mail here.":"يمكن للحسابات في قائمة السماح فقط الإرسال.",
"No unsaved changes":"تم حفظ الإعدادات",
"Unsaved changes":"توجد تغييرات غير محفوظة",
"Member permissions come from ARC. Manage members and invitations above; no separate allowlist is needed.":"تُدار العضوية في ARC. أدِر الأعضاء والدعوات من الأعلى، ولا حاجة لقائمة سماح منفصلة.",
"Blocked senders":"المرسلون المحظورون",
"Allowed senders":"المرسلون المسموح لهم",
"Blocked accounts cannot submit new mail here, even if they are members.":"لا يمكن للحسابات المحظورة إرسال رسائل جديدة حتى لو كانت أعضاء.",
"These accounts can submit mail when sending is restricted to the allowlist.":"يمكن لهذه الحسابات الإرسال عند تقييد الإرسال بقائمة السماح.",
"Block a sender":"حظر حساب",
"Allow a sender":"السماح لحساب",
"Account DID":"معرّف DID للحساب",
"Paste a mailbox DID or ARC login DID.":"ألصق DID لصندوق البريد أو لحساب تسجيل الدخول في ARC.",
"Note (optional)":"ملاحظة (اختيارية)",
"Why is this account listed?":"مثلًا: بريد مزعج أو حساب اختبار",
"Confirm block":"تأكيد الحظر",
"Confirm allow":"تأكيد السماح",
"Edit note":"تعديل الملاحظة",
"Unblock":"إلغاء الحظر",
"Remove from allowlist":"إزالة من قائمة السماح",
"No blocked senders":"لا توجد حسابات محظورة",
"No allowed senders yet":"قائمة السماح فارغة",
"To stop an account from using this server, choose Block a sender.":"لمنع حساب من الإرسال، اختر حظر حساب.",
"Add an account above before enabling allowlist-only sending.":"أضف حسابات مسموحًا لها قبل تفعيل الإرسال المقيد بالقائمة.",
"Changing this list does not change the sending scope above.":"تعديل القائمة لا يغيّر نطاق الإرسال أعلاه.",
"Sending scope saved.":"تم حفظ نطاق الإرسال.",
"Note updated.":"تم تحديث الملاحظة.",
"Sender blocked.":"تم حظر الحساب.",
"Sender allowed.":"تم السماح للحساب.",
"Save note":"حفظ الملاحظة",
"Sender unblocked.":"تم إلغاء الحظر.",
"Sender removed from allowlist.":"تمت الإزالة من قائمة السماح.",

"Search members…":"البحث عن الأعضاء…",
"All roles":"كل الأدوار",
"All statuses":"كل الحالات",
"Manage and invite":"الإدارة والدعوات",
"Unnamed member":"عضو بلا اسم",
"Try another name, DID, or filter.":"جرّب اسمًا أو DID أو عامل تصفية آخر.",
"Only active non-guest members qualify for member benefits.":"يستفيد الأعضاء النشطون غير الضيوف من مزايا العضوية.",
"Access and blocklist":"صلاحيات الإرسال وقائمة الحظر",
"guest":"زائر",

"Save sending access":"حفظ صلاحيات الإرسال",
"Members":"الأعضاء",
"View ARC members and linked mailboxes.":"عرض أعضاء ARC وصناديق البريد المرتبطة.",
"Configure mail service and attachment limits.":"إعداد خدمة البريد وحدود المرفقات.",
"Members and invitations are managed in ARC. Only active non-guest members qualify for member benefits.":"تُدار العضوية والدعوات في ARC. يستفيد الأعضاء النشطون غير الضيوف من مزايا العضوية.",
"Link a mailbox":"كيفية ربط صندوق بريد",
"In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.":"سجّل الدخول إلى صندوق البريد في DIDMail، وافتح الخوادم واتصل بهذا الخادم الخاص ثم اختر ربط البريد. أكّد التفويض بحساب عضو ARC المطابق ثم حدّث هذه الصفحة.",
"Linking requires the mailbox signature and member consent. Administrators cannot assign another person’s mailbox.":"يتطلب الربط توقيع صندوق البريد وموافقة العضو. لا يمكن للمسؤول تعيين صندوق بريد لشخص آخر.",
"Member":"العضو",
"Role":"الدور",
"Active":"نشط",
"Inactive":"غير نشط",
"Linked mailbox":"صندوق البريد المرتبط",
"Association":"حالة الربط",
"Not linked":"غير مرتبط",
"Linked":"مرتبط",
"No matching members.":"لا يوجد أعضاء مطابقون.",
"Page {page} · {total} members":"الصفحة {page} · {total} عضوًا",
"Search members":"البحث عن الأعضاء",
"Name or DID":"الاسم أو DID",
"ARC member service is unavailable. Refresh to retry.":"خدمة الأعضاء غير متاحة. حدّث الصفحة للمحاولة مجددًا.",

"Manage ARC members and invitations":"إدارة أعضاء ARC والدعوات",
"Active ARC members pay no ordinary-mail or attachment fees. Manage membership and invitations in the ARC console. Guests are excluded.":"لا يدفع أعضاء ARC النشطون رسوم خدمة البريد العادي أو المرفقات. تُدار العضوية والدعوات من لوحة ARC، ويُستثنى الضيوف.",
"Denylist takes priority. Members-only sending requires an active linked ARC member.":"قائمة الحظر لها الأولوية. يتطلب الإرسال للأعضاء فقط عضوية ARC نشطة مرتبطة بالحساب.",
"Active ARC members only":"أعضاء ARC النشطون فقط",
"Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.": "لقائمة الحظر الأولوية. تمنع قائمة السماح الفارغة الإرسال الجديد في الوضع المقيد ولا تغيّر حالة الإدراج العام.",

  "All senders except denylist": "جميع المرسلين باستثناء قائمة الحظر",
  "Public listing depends on a staked DIDMail server node NFT. Allowlisted senders pay no ordinary-mail or attachment fees.": "يعتمد الإدراج العام على رهن NFT لعقدة خادم DIDMail. البريد العادي والمرفقات مجانية للمرسلين في قائمة السماح.",

  "DID details": "تفاصيل DID",
  "Copy DID": "نسخ DID",
  "DID QR code": "رمز QR لـ DID",
  "DID copied.": "تم نسخ DID.",
  "Copy failed. Copy the full DID below manually.": "تعذر النسخ. انسخ DID الكامل أدناه يدويًا.",

  "Settings": "الإعدادات",
  "Configure mail service, access lists, and delivery operations.": "إعداد خدمة البريد وقوائم الوصول وعمليات التسليم.",
  "Mail service": "خدمة البريد",
  "Delivery status is unavailable. Refresh to try again.": "حالة التسليم غير متاحة. حدّث للمحاولة مجددًا.",

  'Experimental ordinary mail supports free mail and signed service payments.':
    'يدعم البريد العادي التجريبي البريد المجاني ومدفوعات الخدمة المؤكدة بالتوقيع.',
  Message: 'الرسالة',
  Status: 'الحالة',
  'Mail Service and Access': 'خدمة البريد وصلاحيات الوصول',
  'Access lists control who can send and store mail here. External recipients can still download their mail.':
    'تحدد القوائم من يمكنه الإرسال والتخزين على هذه العقدة. ويمكن للمستلمين الخارجيين تنزيل بريدهم.',
  'Sending access': 'صلاحية الإرسال',
  'Public node': 'عقدة عامة',
  'Allowlist only': 'قائمة السماح فقط',
  'Denylist takes priority. An empty allowlist never opens a restricted node.':
    'لقائمة الحظر الأولوية. لا يؤدي فراغ قائمة السماح إلى فتح عقدة مقيدة.',
  'Ordinary mail': 'البريد العادي',
  'Experimental ordinary mail supports free service only.': 'يدعم البريد العادي التجريبي الخدمة المجانية فقط.',
  'Ordinary mail is not available yet. Its terms can be prepared below.':
    'البريد العادي غير متاح بعد. يمكنك إعداد شروطه أدناه.',
  'Enable ordinary mail': 'تفعيل البريد العادي',
  'Retention in days': 'مدة الاحتفاظ بالأيام',
  'Base fee in native token units': 'الرسم الأساسي بأصغر وحدة للعملة الأصلية',
  'Attachment fee per byte per day in native token units': 'رسم المرفقات لكل بايت في اليوم بأصغر وحدة للعملة الأصلية',
  'Fees use the smallest token unit. Set both fees to zero for free mail. NFT envelope terms remain unchanged.':
    'تُكتب الرسوم بأصغر وحدة للعملة. اجعل الرسمين صفراً للبريد المجاني. لا تتغير شروط أظرف NFT.',
  'New mail attachment limits': 'حدود مرفقات البريد الجديد',
  'Allow attachments': 'السماح بالمرفقات',
  'Maximum attachment count': 'الحد الأقصى لعدد المرفقات',
  'Enter sizes that convert to whole bytes within the allowed limits.': 'أدخل أحجامًا ضمن الحدود المسموحة يمكن تحويلها إلى عدد صحيح من البايتات.',
  'The mail NFT transaction was rejected. The server will retry without another sender payment.': 'رُفضت معاملة NFT للبريد. سيعيد الخادم المحاولة دون دفع إضافي من المرسل.',
  'Waiting to retry': 'بانتظار إعادة المحاولة',
  'Delivery progress': 'تقدم التسليم',
  'Diagnostic code': 'رمز التشخيص',
  'Reason': 'السبب',
  'Next attempt': 'المحاولة التالية',
  'Previous NFT transactions': 'معاملات NFT السابقة',
  'Payment was rejected. No mail NFT was created.': 'رُفض الدفع ولم يتم إنشاء NFT للبريد.',
  'Delivery is paused for verification. Original transactions are retained.': 'تم إيقاف التسليم مؤقتًا للتحقق. تم الاحتفاظ بالمعاملات الأصلية.',
  'The server retries automatically using the saved delivery task. No additional sender payment is required.': 'يعيد الخادم المحاولة تلقائيًا باستخدام مهمة التسليم المحفوظة. لا يلزم دفع إضافي من المرسل.',
  'Maximum file size (MiB)': 'الحد الأقصى لحجم الملف (MiB)',
  'Maximum total attachment size (MiB)': 'الحد الأقصى لإجمالي حجم المرفقات (MiB)',
  'Maximum encrypted message size (MiB)': 'الحد الأقصى لحجم الرسالة المشفرة (MiB)',
  'File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.':
    'تُحسب حدود الملفات قبل التشفير، ويشمل حد الرسالة زيادة التشفير. تحتفظ الرسائل المقبولة بشروطها الأصلية.',
  'The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.':
    'يجب على العقدة والمرسل الاحتفاظ بالرهن المطلوب من العملة الأصلية للإعفاء من رسوم Gas. لا يتطلب التنزيل رهناً.',
  'Save mail service policy': 'حفظ إعدادات خدمة البريد',
  'DID access lists': 'قوائم وصول DID',
  List: 'القائمة',
  Allowlist: 'قائمة السماح',
  Denylist: 'قائمة الحظر',
  Remark: 'ملاحظة',
  'Add or update remark': 'إضافة أو تحديث الملاحظة',
  'List changes do not automatically change the access mode.': 'لا تغير تعديلات القوائم وضع الوصول تلقائياً.',
  'Added at': 'تاريخ الإضافة',
  'Remove from list': 'إزالة من القائمة',
  'No DIDs in this list.': 'لا توجد هويات DID في هذه القائمة.',
  'Policy changed or is unavailable. Refresh and review before retrying.':
    'تغيرت الإعدادات أو أصبحت غير متاحة. حدّث الصفحة وراجعها قبل المحاولة مجدداً.',
  'Mail service settings saved.': 'تم حفظ إعدادات خدمة البريد.',
  'Loading mail service policy…': 'جارٍ تحميل إعدادات خدمة البريد…',
  'Server endpoint': 'عنوان الخادم',
  'Copy endpoint': 'نسخ العنوان',
  'Endpoint copied.': 'تم نسخ العنوان.',
  'Copy failed. Select the endpoint above and copy it manually.': 'تعذر النسخ. حدد العنوان أعلاه وانسخه يدوياً.',
  'Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.':
    'استخدم هذا العنوان في تطبيقات DIDMail. لا يتطلب الاتصال المباشر NFT للعقدة.',
  'Delivery state': 'حالة الإرسال',
  Amount: 'المبلغ',
  'Revoke gas stake': 'إلغاء رهن رسوم المعاملات',
  'Claim gas stake': 'استرداد رهن رسوم المعاملات',
  'Pending withdrawals': 'الأموال قيد الاسترداد',
  'Ready to claim': 'جاهز للاسترداد',
  'Available to claim at': 'متاح للاسترداد في',
  'Revoking gas stake…': 'جارٍ إلغاء رهن رسوم المعاملات…',
  'Claiming gas stake…': 'جارٍ استرداد رهن رسوم المعاملات…',
  'Gas stake revocation submitted': 'تم إرسال طلب إلغاء الرهن',
  'Gas stake claim submitted': 'تم إرسال طلب استرداد الرهن',
  'Funds return to the node account. Claiming may end gas-free eligibility.':
    'تعود الأموال إلى حساب العقدة. قد يؤدي الاسترداد إلى فقدان أهلية الإعفاء من الرسوم.',
  'Gas stake changed. Refresh and review before submitting.': 'تغير رهن الرسوم. حدّث البيانات وراجعها قبل الإرسال.',
  'No revocable gas stake is available.': 'لا يوجد رهن رسوم متاح للإلغاء.',
  'No matching gas stake withdrawal is available.': 'لا يوجد طلب استرداد مطابق لرهن الرسوم.',
  'The gas stake waiting period has not ended.': 'لم تنتهِ فترة انتظار رهن الرسوم.',
  'Gas stake withdrawal history could not be verified.': 'تعذر التحقق من سجل استرداد رهن الرسوم.',
  'Manage node funds, transfers, and gas staking.': 'إدارة أموال العقدة والتحويلات ورهن رسوم المعاملات.',
  'Manage your service node NFT and its stake.': 'إدارة NFT عقدة الخدمة ورهنها.',
  'Refresh node NFTs': 'تحديث NFT العقدة',
  'Node address': 'عنوان العقدة',
  Back: 'رجوع',
  'Gas stake': 'رهن رسوم المعاملات',
  'Account operations': 'عمليات الحساب',
  'Stake for gas': 'الرهن للإعفاء من الرسوم',
  'Loading gas staking rules…': 'جارٍ تحميل قواعد رهن الرسوم…',
  'Only the node owner can stake for gas.': 'يمكن لمالك العقدة فقط الرهن للإعفاء من الرسوم.',
  'Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.':
    'ارهن رمز الشبكة للتأهل لمعاملات بلا رسوم. هذا الرهن منفصل عن رهن NFT عقدة الخدمة.',
  '{count} days': '{count} يوم',
  'After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.':
    'بعد الإلغاء، انتظر {count} يوم قبل استرداد الأموال. قد تؤدي إساءة استخدام الشبكة إلى مصادرة الرهن.',
  'Gas stake already sufficient': 'رهن الرسوم كافٍ بالفعل',
  'Confirm gas stake': 'تأكيد رهن الرسوم',
  'Submitting gas stake…': 'جارٍ إرسال رهن الرسوم…',
  'Gas stake submitted': 'تم إرسال رهن الرسوم',
  'Gas staking rules could not be verified.': 'تعذر التحقق من قواعد رهن الرسوم.',
  'Gas stake state could not be verified.': 'تعذر التحقق من حالة رهن الرسوم.',
  'Gas staking rules changed. Review the latest terms before submitting.':
    'تغيرت قواعد رهن الرسوم. راجع أحدث الشروط قبل الإرسال.',
  'This node already has enough gas stake.': 'لدى هذه العقدة رهن رسوم كافٍ بالفعل.',
  'Gas stake could not be confirmed. Check the stake state before retrying.':
    'تعذر تأكيد رهن الرسوم. تحقق من حالة الرهن قبل إعادة المحاولة.',
  'Node funds': 'أموال العقدة',
  'Transfer out': 'تحويل الأموال',
  'Only the node owner can transfer funds.': 'يمكن لمالك العقدة فقط تحويل الأموال.',
  'Loading available balance…': 'جارٍ تحميل الرصيد المتاح…',
  'Transfer available funds to the node owner. Staked funds cannot be transferred.':
    'حوّل الأموال المتاحة إلى مالك العقدة. لا يمكن تحويل الأموال المرهونة.',
  'Recipient address': 'عنوان المستلم',
  'Available balance': 'الرصيد المتاح',
  'Transfer amount': 'مبلغ التحويل',
  'Keep enough funds in the node wallet for transaction fees.': 'اترك في محفظة العقدة رصيداً كافياً لرسوم المعاملات.',
  'Review transfer': 'مراجعة التحويل',
  'Transfer amount must be greater than zero.': 'يجب أن يكون مبلغ التحويل أكبر من صفر.',
  'Insufficient available balance.': 'الرصيد المتاح غير كافٍ.',
  'Confirm transfer': 'تأكيد التحويل',
  'This transfer cannot be undone.': 'لا يمكن التراجع عن هذا التحويل.',
  'Transfer to owner': 'التحويل إلى المالك',
  'Submitting transfer…': 'جارٍ إرسال التحويل…',
  'Transfer submitted': 'تم إرسال التحويل',
  'Transaction hash': 'بصمة المعاملة',
  'Refresh the node balance to verify the result.': 'حدّث رصيد العقدة للتحقق من النتيجة.',
  'The owner does not have a valid recipient DID.': 'ليس لدى المالك DID صالح لاستلام الأموال.',
  'Node balance could not be verified.': 'تعذر التحقق من رصيد العقدة.',
  'Transfer could not be confirmed. Check the node balance and transaction history before retrying.':
    'تعذر تأكيد التحويل. تحقق من رصيد العقدة وسجل المعاملات قبل إعادة المحاولة.',
  'Acquiring…': 'جارٍ الحصول…',
  'Node balance unavailable ({code}; {stage}; {path}).': 'رصيد العقدة غير متاح ({code}؛ {stage}؛ {path}).',
  transport: 'الاتصال أو انتهاء المهلة',
  http: 'استجابة HTTP',
  rpc: 'استعلام AFS',
  decode: 'تحليل الاستجابة',
  'Some node data is unavailable': 'بعض بيانات العقدة غير متاحة',
  Details: 'التفاصيل',
  'Recharge on {network} to activate this node.': 'أضف رصيداً على شبكة {network} لتفعيل هذه العقدة.',
  'Server Node Factory information': 'معلومات مصنع عقد الخدمة',
  'NFT SVG template': 'قالب SVG لـ NFT',
  'Server node NFT SVG template': 'قالب SVG لـ NFT عقدة الخدمة',
  'No SVG template available': 'لا يوجد قالب SVG متاح',
  Executive: 'نمط تنفيذي',
  Tech: 'نمط تقني',
  Creative: 'نمط إبداعي',
  Consultant: 'نمط استشاري',
  executiveCard: 'نمط تنفيذي',
  techCard: 'نمط تقني',
  creativeCard: 'نمط إبداعي',
  consultantCard: 'نمط استشاري',
  'About SVG Namecard templates': 'حول قوالب بطاقات التعريف SVG',
  'SVG Namecard template': 'قالب بطاقة تعريف SVG',
  'Contact name.': 'اسم جهة الاتصال.',
  'Company or organization.': 'الشركة أو المؤسسة.',
  'Job title or position.': 'المسمى الوظيفي.',
  'Phone number.': 'رقم الهاتف.',
  'Email address.': 'عنوان البريد الإلكتروني.',
  'Website URL.': 'رابط الموقع.',
  'Location.': 'الموقع.',
  'Background or personal introduction.': 'نبذة أو تعريف شخصي.',
  'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.':
    'يحدد قالب بطاقة التعريف SVG مظهر NFT بطاقة جهة الاتصال. تستبدل التطبيقات المتغيرات ببيانات الملف الشخصي أو بيانات الاتصال المفكوكة التشفير عند العرض.',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.':
    'استخدم أسماء المتغيرات بدقة مع الأقواس المعقوفة المزدوجة. ارفع ملف .svg صالحاً بحجم لا يتجاوز 5 MB؛ الحقل contact.name مطلوب. نزّل نموذجاً وعدّله ثم ارفعه هنا. تأتي القيم من حقول الاتصال التي يوفرها التطبيق؛ وتظهر الحقول المفقودة فارغة. تعرض المعاينة المتغيرات لا بيانات الاتصال الفعلية.',
  'Last chain sync:': 'آخر مزامنة مع الشبكة:',
  'Chain sync failed. Showing saved data; try Refresh again.':
    'فشلت المزامنة مع الشبكة. تُعرض البيانات المحفوظة؛ حاول التحديث مجدداً.',
  'About SVG Envelope templates': 'حول قوالب الأظرف SVG',
  'SVG Envelope template': 'قالب ظرف SVG',
  'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.':
    'يحدد قالب الظرف SVG غلاف NFT الرسالة. تستبدل التطبيقات المتغيرات ببيانات الرسالة عند العرض؛ ولا يتغير المحتوى المشفر.',
  'Supported variables': 'المتغيرات المدعومة',
  Required: 'مطلوب',
  Example: 'مثال',
  'Mail subject, filled by the client after decryption.': 'موضوع الرسالة، يملؤه التطبيق بعد فك التشفير.',
  'Sender DID address.': 'عنوان DID للمرسل.',
  'Mail creation time, formatted by the client.': 'وقت إنشاء الرسالة بتنسيق التطبيق.',
  'Mail expiration time, formatted by the client.': 'وقت انتهاء صلاحية الرسالة بتنسيق التطبيق.',
  'Envelope NFT address. Some send previews do not provide this value.':
    'عنوان NFT الظرف. قد لا توفر بعض معاينات الإرسال هذه القيمة.',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.':
    'استخدم أسماء المتغيرات بدقة مع الأقواس المعقوفة المزدوجة. ارفع ملف .svg صالحاً بحجم لا يتجاوز 5 MB؛ الحقلان mail.subject وmail.sender مطلوبان. نزّل نموذجاً وعدّله ثم ارفعه هنا. تعرض المعاينة متغيرات القالب لا بيانات الرسالة الفعلية.',
  'Session expired. Refresh the page to sign in again.': 'انتهت الجلسة. حدّث الصفحة لتسجيل الدخول مجدداً.',
  envelope: 'ظرف',
  namecard: 'بطاقة تعريف',
  owner: 'المالك',
  admin: 'المشرف',
  member: 'عضو',
  'Page size': 'عدد العناصر في الصفحة',
  Server: 'عقدة الخدمة',
  Envelope: 'ظرف',
  Namecard: 'بطاقة تعريف',
  Storage: 'التخزين',
  Attachments: 'المرفقات',
  Envelopes: 'الأظرف',
  Namecards: 'بطاقات التعريف',
  'Manage your node identity, balance, and stake.': 'إدارة هوية العقدة ورصيدها ورهنها.',
  'Create and publish envelope templates for your node.': 'إنشاء قوالب أظرف العقدة ونشرها.',
  'Create and publish namecard templates for your node.': 'إنشاء قوالب بطاقات تعريف العقدة ونشرها.',
  'Search and manage encrypted mail stored on your node.': 'البحث في الرسائل المشفرة المخزنة على العقدة وإدارتها.',
  'Manage attachment limits and storage pricing.': 'إدارة حدود المرفقات وأسعار التخزين.',
  'DIDMail business navigation': 'التنقل في DIDMail',
  'Checking ARC session…': 'جارٍ التحقق من جلسة ARC…',
  'Loading node account…': 'جارٍ تحميل حساب العقدة…',
  'Loading page data…': 'جارٍ تحميل بيانات الصفحة…',
  'Node account': 'حساب العقدة',
  'DIDMail · Powered by ARC': 'DIDMail · بدعم من ARC',
  'DIDMail Admin': 'إدارة DIDMail',
  'Sign in to manage your server node.': 'سجّل الدخول لإدارة عقدة الخدمة.',
  'Sign in with ARC': 'تسجيل الدخول باستخدام ARC',
  'Permission denied: Only owner or admin can access this page, current role is {role}':
    'تم رفض الوصول: الصفحة متاحة للمالك أو المشرف فقط، والدور الحالي هو {role}',
  Retry: 'إعادة المحاولة',
  Cancel: 'إلغاء',
  Close: 'إغلاق',
  'DIDMail Server Node': 'عقدة خدمة DIDMail',
  Unknown: 'غير معروف',
  'Loading…': 'جارٍ التحميل…',
  Staked: 'مرهون',
  'No Stake': 'غير مرهون',
  Revoked: 'تم الإلغاء',
  'Refresh node account': 'تحديث حساب العقدة',
  'Updating node data…': 'جارٍ تحديث بيانات العقدة…',
  'Chain data is unavailable. Balances and stake could not be verified.':
    'بيانات الشبكة غير متاحة. تعذر التحقق من الرصيد والرهن.',
  'Stake data is unavailable: {message}': 'بيانات الرهن غير متاحة: {message}',
  'This node has no on-chain account yet. Recharge its address on the {network} network.':
    'ليس لهذه العقدة حساب على الشبكة بعد. أضف رصيداً إلى عنوانها على شبكة {network}.',
  'Show node recharge QR code': 'عرض رمز QR لشحن العقدة',
  Balance: 'الرصيد',
  Unavailable: 'غير متاح',
  'NO BALANCE': 'لا يوجد رصيد',
  'NO STAKED': 'لا يوجد رهن',
  'NO REVOKED': 'لا يوجد رهن ملغى',
  'Database Used Size:': 'حجم قاعدة البيانات المستخدم:',
  Refresh: 'تحديث',
  Mails: 'الرسائل',
  Search: 'بحث',
  'Search By ID/Address/Envelope/Hash': 'البحث بالمعرف أو العنوان أو الظرف أو البصمة',
  'Loading {type} factory…': 'جارٍ تحميل مصنع {type}…',
  '{type} List': 'قائمة {type}',
  Clean: 'مسح',
  Name: 'الاسم',
  Address: 'العنوان',
  Description: 'الوصف',
  Limit: 'حد الإصدار',
  Minted: 'تم سكه',
  'Created At': 'تاريخ الإنشاء',
  'Updated At': 'تاريخ التحديث',
  'Owned By': 'المالك',
  Price: 'السعر',
  'To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.':
    'لتصبح عقدة خدمة DIDMail عامة، يجب شراء NFT للعقدة ورهنه حتى تتمكن التطبيقات من اكتشافها وعرضها في قائمة عقد الخدمة.',
  'DIDMail Server Node NFT Factory': 'مصنع NFT عقد خدمة DIDMail',
  Acquired: 'تم الحصول عليه',
  Acquire: 'الحصول',
  'Acquire DIDMail server node NFT for stake': 'الحصول على NFT عقدة خدمة DIDMail للرهن',
  'Acquired DIDMail server node NFT for stake': 'تم الحصول على NFT عقدة خدمة DIDMail للرهن',
  'Loading node factory…': 'جارٍ تحميل مصنع العقد…',
  'Stake information could not be loaded. Refresh the node account to retry.':
    'تعذر تحميل معلومات الرهن. حدّث حساب العقدة لإعادة المحاولة.',
  'Loading node NFTs…': 'جارٍ تحميل NFT العقدة…',
  'No staked node NFTs yet': 'لا يوجد NFT عقدة مرهون بعد',
  'Server Node NFT': 'NFT عقدة الخدمة',
  'Stake Address': 'عنوان الرهن',
  'Amount to stake': 'المبلغ المراد رهنه',
  Location: 'الموقع',
  'Revoke Waiting Period': 'فترة انتظار الإلغاء',
  '{count} seconds': '{count} ثانية',
  Stake: 'رهن',
  Revoke: 'إلغاء الرهن',
  Claim: 'استرداد',
  'Additional stake': 'رهن إضافي',
  'Add Stake': 'إضافة رهن',
  'The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.':
    'يختلف عنوان NFT عن رابط التطبيق. ألغِ الرهن واسترده قبل التحديث.',
  'App URL': 'رابط التطبيق',
  'Endpoint URL': 'عنوان الخادم',
  'Update Endpoint': 'تحديث العنوان',
  'Attachment Policy': 'سياسة المرفقات',
  'Max File Size': 'الحد الأقصى لحجم الملف',
  'MB · Limit for a single encrypted attachment on the wire.':
    'MB · الحد الأقصى لحجم المرفق المشفر الواحد أثناء النقل.',
  'Max File Count': 'الحد الأقصى لعدد الملفات',
  'Maximum attachments allowed per mail.': 'الحد الأقصى لعدد المرفقات لكل رسالة.',
  'Price Per Byte Per Day': 'السعر لكل بايت في اليوم',
  'Storage unit price in wei (digits only).': 'سعر وحدة التخزين بـ wei (أرقام فقط).',
  'Last updated:': 'آخر تحديث:',
  'Save Policy': 'حفظ السياسة',
  '{type} Factory': 'مصنع {type}',
  'Upload SVG {type} template file': 'رفع ملف قالب SVG لـ {type}',
  Unlimited: 'بلا حدود',
  'Retention Period': 'مدة الاحتفاظ',
  'Mail retention on this server, in days; 0 means unlimited.':
    'مدة حفظ الرسائل على هذا الخادم بالأيام؛ 0 يعني بلا حدود.',
  'Factory acquisition cost:': 'تكلفة الحصول على المصنع:',
  'Creating Factory…': 'جارٍ إنشاء المصنع…',
  'Create Factory': 'إنشاء مصنع',
  'Create {type} NFT Factory': 'إنشاء مصنع NFT لـ {type}',
  '{type} Factory information': 'معلومات مصنع {type}',
  'Default Namecard': 'بطاقة التعريف الافتراضية',
  'The sender of the namecard will cover the costs.': 'يتحمل مرسل بطاقة التعريف التكاليف.',
  'Envelope Factory': 'مصنع الأظرف',
  'Envelope Factory information': 'معلومات مصنع الأظرف',
  'Confirmed before creation': 'تم التأكيد قبل الإنشاء',
  'Loading Envelope factory…': 'جارٍ تحميل مصنع الأظرف…',
  '5–80 characters.': 'من 5 إلى 80 حرفاً.',
  '1–50 characters.': 'من 1 إلى 50 حرفاً.',
  'The sender of the mail will cover the costs.': 'يتحمل مرسل الرسالة التكاليف.',
  'Enter name': 'أدخل الاسم',
  'Enter description': 'أدخل الوصف',
  Day: 'يوم',
  'Click or drop an SVG file · up to 5 MB': 'انقر أو اسحب ملف SVG · حتى 5 MB',
  'Click the preview to replace the SVG template.': 'انقر على المعاينة لاستبدال قالب SVG.',
  'Default Envelope': 'الظرف الافتراضي',
  'Love Card': 'بطاقة حب',
  'Pig Card': 'بطاقة خنزير صغير',
  'Business Card': 'بطاقة أعمال',
  'Festival Card': 'بطاقة احتفال',
  Preview: 'معاينة',
  'SVG template preview': 'معاينة قالب SVG',
  'Select or upload an SVG template.': 'اختر قالب SVG أو ارفعه.',
  'SVG {type} template samples': 'نماذج قوالب SVG لـ {type}',
  'Use {name}': 'استخدام {name}',
  'Download SVG': 'تنزيل SVG',
  default: 'القالب الافتراضي',
  loveCard: 'بطاقة حب',
  pigCard: 'بطاقة خنزير صغير',
  businessCard: 'بطاقة أعمال',
  festivalCard: 'بطاقة احتفال',
  'Updating in background…': 'جارٍ التحديث في الخلفية…',
  'Loading {type} list…': 'جارٍ تحميل قائمة {type}…',
  'Preview not available': 'المعاينة غير متاحة',
  'Enable And Publish': 'تفعيل ونشر',
  'Enable {name}': 'تفعيل {name}',
  '{count} Day': '{count} يوم',
  'No {type} NFTs yet': 'لا يوجد NFT لـ {type} بعد',
  'Total:': 'المجموع:',
  Previous: 'السابق',
  Next: 'التالي',
  'Publish setting saved.': 'تم حفظ إعدادات النشر.',
  'Loading stored mail…': 'جارٍ تحميل الرسائل المخزنة…',
  ID: 'المعرف',
  Hash: 'البصمة',
  Size: 'الحجم',
  Payment: 'الدفع',
  Date: 'التاريخ',
  Action: 'الإجراء',
  Sender: 'المرسل',
  Receiver: 'المستلم',
  Asset: 'الأصل',
  'View hashes': 'عرض البصمات',
  Content: 'المحتوى',
  PaymentTx: 'معاملة الدفع',
  AssetTx: 'معاملة الأصل',
  Created: 'الإنشاء',
  Download: 'التنزيل',
  'N/A': 'غير متوفر',
  Delete: 'حذف',
  'Delete mail {id}': 'حذف الرسالة {id}',
  'No matching mail.': 'لا توجد رسائل مطابقة.',
  'No mails stored yet.': 'لا توجد رسائل مخزنة بعد.',
  Page: 'الصفحة',
  'of {count}': 'من {count}',
  Free: 'مجاني',
  Dividend: 'الأرباح الموزعة',
  'Net Profit': 'صافي الربح',
  'Choose an SVG file.': 'اختر ملف SVG.',
  'SVG template must be at most 5 MB.': 'يجب ألا يتجاوز حجم قالب SVG ‏5 MB.',
  'Invalid SVG document.': 'مستند SVG غير صالح.',
  'The SVG file must contain {fields}': 'يجب أن يحتوي ملف SVG على {fields}',
  ' or ': ' أو ',
  'Node data is updating. Please wait before submitting a transaction.':
    'جارٍ تحديث بيانات العقدة. انتظر قبل إرسال معاملة.',
  'Node state could not be verified. Refresh the node data before submitting a transaction.':
    'تعذر التحقق من حالة العقدة. حدّث بياناتها قبل إرسال معاملة.',
  'Operation failed.': 'فشلت العملية.',
  'Recharge Node': 'شحن العقدة',
  Recharge: 'شحن',
  'Node recharge': 'شحن العقدة',
  'Send funds to this node address.': 'أرسل الأموال إلى عنوان هذه العقدة.',
  'Network:': 'الشبكة:',
  'Use the matching network in your wallet.': 'استخدم الشبكة المطابقة في محفظتك.',
  'Insufficient balance. Recharge the node first.': 'الرصيد غير كافٍ. اشحن العقدة أولاً.',
  'Acquire Server Node NFT': 'الحصول على NFT عقدة الخدمة',
  'The node wallet will pay {cost} and own this NFT.': 'ستدفع محفظة العقدة {cost} وستمتلك هذا NFT.',
  'Request accepted. Refresh to verify on-chain state.': 'تم قبول الطلب. حدّث البيانات للتحقق من الحالة على الشبكة.',
  'Stake Node NFT': 'رهن NFT العقدة',
  'Revoke Stake': 'إلغاء الرهن',
  'Claim Stake': 'استرداد الرهن',
  'Revoke the staked tokens? A waiting period applies before claiming.':
    'هل تريد إلغاء رهن الرموز؟ توجد فترة انتظار قبل الاسترداد.',
  'Submit this operation using the node wallet?': 'هل تريد إرسال هذه العملية باستخدام محفظة العقدة؟',
  'Template could not be loaded.': 'تعذر تحميل القالب.',
  'Clean {type} cache': 'مسح ذاكرة {type} المؤقتة',
  'Remove cached publish settings for this list? On-chain NFTs remain.':
    'هل تريد إزالة إعدادات النشر المخزنة مؤقتاً لهذه القائمة؟ تبقى NFT على الشبكة.',
  'Cache cleaned.': 'تم مسح الذاكرة المؤقتة.',
  'Delete Mail': 'حذف الرسالة',
  'Delete mail {id} and its encrypted content? This action cannot be undone.':
    'هل تريد حذف الرسالة {id} ومحتواها المشفر؟ لا يمكن التراجع عن هذا الإجراء.',
  'Mail deleted.': 'تم حذف الرسالة.',
  'Select a valid SVG template.': 'اختر قالب SVG صالحاً.',
  'Enter a valid page or page size.': 'أدخل رقم صفحة أو عدد عناصر صالحاً.',
  'Enter positive file limits and a price in whole wei.': 'أدخل حدود ملفات موجبة وسعراً بوحدة wei الصحيحة.',
  'Attachment policy saved successfully.': 'تم حفظ سياسة المرفقات بنجاح.',
  'Enter an integer stake amount within the node balance.': 'أدخل مبلغ رهن صحيحاً ضمن رصيد العقدة.',
  'Add {amount} tokens to the node stake?': 'هل تريد إضافة {amount} رمز إلى رهن العقدة؟',
  'Name must be 5–80 characters; description must be 1–50 characters.':
    'يجب أن يكون الاسم من 5 إلى 80 حرفاً، والوصف من 1 إلى 50 حرفاً.',
  'Price must be at least 0.001.': 'يجب ألا يقل السعر عن 0.001.',
  'Retention must be a non-negative integer.': 'يجب أن تكون مدة الاحتفاظ عدداً صحيحاً غير سالب.',
  'Insufficient or unavailable node balance.': 'رصيد العقدة غير كافٍ أو غير متاح.',
  'Create {type} Factory': 'إنشاء مصنع {type}',
  'The node wallet will pay the factory acquisition cost: {cost}.':
    'ستدفع محفظة العقدة تكلفة الحصول على المصنع: {cost}.',
  Create: 'إنشاء',
  'Factory created successfully.': 'تم إنشاء المصنع بنجاح.',
  'Enter a valid token amount.': 'أدخل مبلغ رموز صالحاً.',
  'Use at most {precision} decimal places.': 'استخدم {precision} منازل عشرية كحد أقصى.',
  'Invalid API response ({status}).': 'استجابة API غير صالحة ({status}).',
  'Request failed ({status}).': 'فشل الطلب ({status}).',
  'The operation was aborted due to timeout': 'تم إيقاف العملية لانتهاء المهلة.',
  'Failed to fetch': 'فشل طلب الشبكة. تحقق من الاتصال وأعد المحاولة.',
};

return {"default": defaultExport};
})();

// ---- locales/admin-ja.js ----
modules["locales/admin-ja.js"] = (() => {
const defaultExport = {
  'Single-file limit exceeds total attachment limit': '添付ファイル1件の上限は添付ファイルの合計上限を超えられません。',
  'Clear search': '検索をクリア',
  'Help and usage': 'ヘルプと使い方',
"Node funded":"ノード負担",
"Node-paid NFT cost":"ノード負担の NFT 費用",

"Namecard category":"名刺の種類",
"Public namecard":"公開名刺",
"Member-only namecard":"メンバー専用名刺",
"Member namecards require a bound active member.":"メンバー専用名刺にはメールボックスを連携済みの有効なメンバー資格が必要です。",

"Envelope category":"封筒の分類",
"Public envelope":"公開封筒",
"Member-only envelope":"メンバー専用封筒",
"Member envelopes require a bound active member.":"メンバー専用封筒には、紐付け済みのアクティブな ARC メンバー資格が必要です。",
"Envelope category saved.":"封筒の分類を保存しました。",
"Member envelope":"メンバー専用封筒",
"Setup only":"設定準備中",
"Members send for free. The node pays the NFT minting cost.":"メンバーの送信は無料です。NFT 発行費用はノードが負担します。",
"Sponsorship is not enabled yet. Saving these settings does not allow free sending.":"代払いはまだ有効ではありません。設定を保存しても無料送信は有効になりません。",
"Public default envelope":"公開の既定封筒",
"Member default envelope":"メンバーの既定封筒",
"Daily limit per member":"メンバーごとの一日上限",
"Per-minute limit per member":"メンバーごとの一分上限",
"Daily node sponsorship budget (UTC)":"ノードの一日代払い予算（UTC）",
"Only a zero-price published NFT can be selected as the member envelope. Membership and mailbox binding are required.":"公開済みで価格が 0 の封筒 NFT のみ選択できます。アクティブなメンバー資格とメールボックスの紐付けが必要です。",
"Save configuration":"設定を保存",
"Manage members":"メンバー管理",
"Configuration saved. Sponsorship remains disabled.":"設定を保存しました。代払いは無効のままです。",
"Configuration could not be saved. Refresh and try again.":"設定を保存できません。更新して再試行してください。",
"Member envelope configuration is unavailable.":"メンバー封筒の設定を取得できません。",
"Not configured":"未設定",
"Automatic public default":"公開の既定封筒を自動選択",
"Mail fee":"メール料金",
"Total fee":"料金合計",
"Mail":"メール",
"Participants":"送受信者",
"Preparing":"準備中",
"Awaiting signature":"署名待ち",
"Queued":"待機中",
"Confirming payment":"支払い確認中",
"Creating mail NFT":"メール NFT 作成中",
"Delivered":"配信済み",
"Rejected":"拒否済み",
"Expired":"期限切れ",
"Review required":"要確認",
"Unknown status":"状態不明",
"Historical record":"履歴",
"Recorded amount":"記録金額",
"Payment confirmed":"支払い確認済み",
"Confirmation pending":"確認待ち",
"Quoted amount":"見積額",
"Node service fee":"ノードサービス料",
"Developer share":"開発者への配分",
"Indexing fee":"インデックス料",
"Fee breakdown":"料金内訳",
"Quote breakdown":"見積内訳",
"Mail details {id}":"メール {id} の詳細",
"Message identifiers":"メール識別情報",
"Transaction records":"取引記録",
"Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.":"このノードの暗号化コピーのみ削除します。チェーン記録とダウンロード済みコピーは残ります。",
"Delivery is in progress. Deletion is unavailable until it finishes.":"配信中です。完了するまで削除できません。",
"Loading sender list…":"リストを読み込み中…",
"Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.":"拒否したアカウントはこのサーバーから送信できません。受信と過去のメールのダウンロードには影響しません。",
"Allowlisted accounts can send through this server when access is restricted.":"送信を制限した場合、許可リストのアカウントが送信できます。",
"How access works":"アクセスの仕組み",
"Enter a valid mailbox or ARC DID.":"有効なメールボックスDIDまたはARCログインDIDを入力してください。",
"Could not confirm the result. Refresh the list before retrying.":"結果を確認できません。リストを更新して確認してから再試行してください。",

"A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.":"DIDMailサービスノードNFTを有効にステーキングすると送信を公開します。未ステーキング時は連携済みメールボックスを持つ有効なメンバーのみ送信でき、拒否したアカウントは常に除外されます。",
"Any sender":"すべての送信者",
"Members of this server":"このサーバーのメンバーのみ",
"Allowlisted senders":"許可リストのアカウントのみ",
"These controls apply only to new mail sent through this server. Receiving and historical downloads are unaffected.":"この設定はこのサーバー経由の新しい送信にのみ適用され、受信と過去のメールのダウンロードには影響しません。",
"Who can send through this server?":"このサーバーから送信できる人",
"Current setting: {mode}":"現在：{mode}",
"Anyone can submit mail here, except blocked accounts. Service fees still follow your settings.":"拒否されたアカウント以外は送信できます。料金はメールサービス設定に従います。",
"Only active non-guest ARC members with a linked mailbox can submit mail here.":"メールボックスと連携済みの有効なARCメンバーのみ送信できます。ゲストは対象外です。",
"Only accounts on the allowlist can submit mail here.":"許可リストのアカウントのみ送信できます。",
"No unsaved changes":"保存済み",
"Unsaved changes":"未保存の変更があります",
"Member permissions come from ARC. Manage members and invitations above; no separate allowlist is needed.":"メンバー資格はARCで管理します。上部からメンバーと招待を管理でき、別の許可リストは不要です。",
"Blocked senders":"拒否する送信者",
"Allowed senders":"許可する送信者",
"Blocked accounts cannot submit new mail here, even if they are members.":"拒否したアカウントはメンバーでも新しいメールを送信できません。",
"These accounts can submit mail when sending is restricted to the allowlist.":"許可リスト限定の設定では、以下のアカウントが送信できます。",
"Block a sender":"アカウントを拒否",
"Allow a sender":"アカウントを許可",
"Account DID":"アカウントDID",
"Paste a mailbox DID or ARC login DID.":"メールボックスDIDまたはARCログインDIDを貼り付けます。",
"Note (optional)":"メモ（任意）",
"Why is this account listed?":"例：迷惑メール、テスト用",
"Confirm block":"拒否を確定",
"Confirm allow":"許可を確定",
"Edit note":"メモを編集",
"Unblock":"拒否を解除",
"Remove from allowlist":"許可リストから削除",
"No blocked senders":"拒否中のアカウントはありません",
"No allowed senders yet":"許可リストは空です",
"To stop an account from using this server, choose Block a sender.":"送信を拒否する場合は「アカウントを拒否」を選択してください。",
"Add an account above before enabling allowlist-only sending.":"許可リスト限定にする前に、許可するアカウントを追加してください。",
"Changing this list does not change the sending scope above.":"リストの変更は上の送信範囲を変更しません。",
"Sending scope saved.":"送信範囲を保存しました。",
"Note updated.":"メモを更新しました。",
"Sender blocked.":"アカウントを拒否しました。",
"Sender allowed.":"アカウントを許可しました。",
"Save note":"メモを保存",
"Sender unblocked.":"拒否を解除しました。",
"Sender removed from allowlist.":"許可リストから削除しました。",

"Search members…":"メンバーを検索…",
"All roles":"すべての役割",
"All statuses":"すべての状態",
"Manage and invite":"管理と招待",
"Unnamed member":"名前未設定",
"Try another name, DID, or filter.":"別の名前、DID、条件で検索してください。",
"Only active non-guest members qualify for member benefits.":"有効なゲスト以外のメンバーが特典の対象です。",
"Access and blocklist":"送信権限と拒否リスト",
"guest":"ゲスト",

"Save sending access":"送信権限を保存",
"Members":"メンバー",
"View ARC members and linked mailboxes.":"ARCメンバーと連携済みメールボックスを確認します。",
"Configure mail service and attachment limits.":"メールサービスと添付ファイル制限を設定します。",
"Members and invitations are managed in ARC. Only active non-guest members qualify for member benefits.":"メンバーと招待はARCで管理します。有効なゲスト以外のメンバーが特典の対象です。",
"Link a mailbox":"メールボックスの連携方法",
"In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.":"DIDMailでメールボックスにログインし、「サーバー」でこのプライベートサーバーに接続して「連携」を選択します。対応するARCメンバーとして承認後、このページを更新してください。",
"Linking requires the mailbox signature and member consent. Administrators cannot assign another person’s mailbox.":"連携にはメールボックスの署名とメンバーの同意が必要です。管理者が他人のメールボックスを指定することはできません。",
"Member":"メンバー",
"Role":"役割",
"Active":"有効",
"Inactive":"無効",
"Linked mailbox":"連携済みメールボックス",
"Association":"連携状態",
"Not linked":"未連携",
"Linked":"連携済み",
"No matching members.":"一致するメンバーはいません。",
"Page {page} · {total} members":"{page}ページ · 全{total}名",
"Search members":"メンバーを検索",
"Name or DID":"名前またはDID",
"ARC member service is unavailable. Refresh to retry.":"メンバーサービスを利用できません。更新して再試行してください。",

"Manage ARC members and invitations":"ARC メンバーと招待を管理",
"Active ARC members pay no ordinary-mail or attachment fees. Manage membership and invitations in the ARC console. Guests are excluded.":"有効な ARC メンバーは通常メールと添付のサービス料金が無料です。ARC コンソールでメンバーと招待を管理してください。ゲストは対象外です。",
"Denylist takes priority. Members-only sending requires an active linked ARC member.":"拒否リストが優先です。メンバー限定送信には関連付け済みの有効な ARC メンバーが必要です。",
"Active ARC members only":"有効な ARC メンバーのみ",
"Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.": "拒否リストが優先です。許可リスト限定で空の場合、新規送信は拒否されます。公開状態は変わりません。",

  "All senders except denylist": "拒否リスト以外の送信者",
  "Public listing depends on a staked DIDMail server node NFT. Allowlisted senders pay no ordinary-mail or attachment fees.": "公開一覧は DIDMail サーバーノード NFT のステークで決まります。許可リストの送信者は通常メールと添付が無料です。",

  "DID details": "DID の詳細",
  "Copy DID": "DID をコピー",
  "DID QR code": "DID QR コード",
  "DID copied.": "DID をコピーしました。",
  "Copy failed. Copy the full DID below manually.": "コピーできません。下の完全な DID を手動でコピーしてください。",

  "Settings": "設定",
  "Configure mail service, access lists, and delivery operations.": "メールサービス、アクセスリスト、配信操作を設定します。",
  "Mail service": "メールサービス",
  "Delivery status is unavailable. Refresh to try again.": "配信状況を取得できません。更新して再試行してください。",

  'Experimental ordinary mail supports free mail and signed service payments.':
    '実験的な通常メールは無料メールと署名承認するサービス料金に対応します。',
  Message: 'メール',
  Status: '状態',
  'Mail Service and Access': 'メールサービスと送信権限',
  'Access lists control who can send and store mail here. External recipients can still download their mail.':
    'リストはこのノードでの送信と保存の権限を制御します。外部の受信者も自分のメールをダウンロードできます。',
  'Sending access': '送信権限',
  'Public node': '公開ノード',
  'Allowlist only': '許可リストのみ',
  'Denylist takes priority. An empty allowlist never opens a restricted node.':
    '拒否リストが優先されます。許可リストが空でも制限付きノードは公開されません。',
  'Ordinary mail': '通常メール',
  'Experimental ordinary mail supports free service only.': '試験中の通常メールは無料サービスのみ対応しています。',
  'Ordinary mail is not available yet. Its terms can be prepared below.':
    '通常メールはまだ利用できません。以下で利用条件を準備できます。',
  'Enable ordinary mail': '通常メールを有効にする',
  'Retention in days': '保存期間（日）',
  'Base fee in native token units': '基本料金（ネイティブトークンの最小単位）',
  'Attachment fee per byte per day in native token units': '添付ファイルの1バイト1日あたりの料金（最小単位）',
  'Fees use the smallest token unit. Set both fees to zero for free mail. NFT envelope terms remain unchanged.':
    '料金はトークンの最小単位です。両方を0にすると無料です。NFT封筒の条件は変更されません。',
  'New mail attachment limits': '新規メールの添付ファイル制限',
  'Allow attachments': '添付ファイルを許可',
  'Maximum attachment count': '添付ファイルの最大数',
  'Enter sizes that convert to whole bytes within the allowed limits.': '許可された範囲内で整数バイトに変換できるサイズを入力してください。',
  'The mail NFT transaction was rejected. The server will retry without another sender payment.': 'メールNFTの作成トランザクションが拒否されました。送信者の追加支払いなしで自動再試行します。',
  'Waiting to retry': '再試行待ち',
  'Delivery progress': '配信の進行状況',
  'Diagnostic code': '診断コード',
  'Reason': '理由',
  'Next attempt': '次の再試行',
  'Previous NFT transactions': '過去のNFT作成トランザクション',
  'Payment was rejected. No mail NFT was created.': '支払いが拒否され、メールNFTは作成されませんでした。',
  'Delivery is paused for verification. Original transactions are retained.': '確認のため配信を一時停止しています。元のトランザクションは保持されています。',
  'The server retries automatically using the saved delivery task. No additional sender payment is required.': '保存済みの配信タスクを使ってサーバーが自動再試行します。送信者の追加支払いは不要です。',
  'Maximum file size (MiB)': 'ファイルの最大サイズ（MiB）',
  'Maximum total attachment size (MiB)': '添付ファイル合計の最大サイズ（MiB）',
  'Maximum encrypted message size (MiB)': '暗号化メール全体の最大サイズ（MiB）',
  'File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.':
    'ファイル制限は平文のバイト数、メール制限は暗号化の追加分を含みます。受付済みメールの条件は維持されます。',
  'The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.':
    'ノードと送信者は必要なネイティブトークンのガス用ステークを維持してください。ダウンロードにステークは不要です。',
  'Save mail service policy': 'メールサービス設定を保存',
  'DID access lists': 'DIDアクセスリスト',
  List: 'リスト',
  Allowlist: '許可リスト',
  Denylist: '拒否リスト',
  Remark: '備考',
  'Add or update remark': '追加または備考を更新',
  'List changes do not automatically change the access mode.':
    'リストの変更でアクセスモードが自動的に変わることはありません。',
  'Added at': '追加日時',
  'Remove from list': 'リストから削除',
  'No DIDs in this list.': 'このリストにDIDはありません。',
  'Policy changed or is unavailable. Refresh and review before retrying.':
    '設定が変更されたか利用できません。更新して内容を確認してから再試行してください。',
  'Mail service settings saved.': 'メールサービス設定を保存しました。',
  'Loading mail service policy…': 'メールサービス設定を読み込み中…',
  'Server endpoint': 'サーバーエンドポイント',
  'Copy endpoint': 'エンドポイントをコピー',
  'Endpoint copied.': 'エンドポイントをコピーしました。',
  'Copy failed. Select the endpoint above and copy it manually.':
    'コピーできませんでした。上のエンドポイントを選択して手動でコピーしてください。',
  'Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.':
    'DIDMail クライアントにこのエンドポイントを設定してください。直接接続にはノード NFT は不要です。',
  'Delivery state': '送信状態',
  Amount: '金額',
  'Revoke gas stake': 'ガス用ステークを解除',
  'Claim gas stake': 'ガス用ステークを受け取る',
  'Pending withdrawals': '受け取り待ちの資金',
  'Ready to claim': '受け取り可能',
  'Available to claim at': '受け取り可能日時',
  'Revoking gas stake…': 'ガス用ステークを解除中…',
  'Claiming gas stake…': 'ガス用ステークを受け取り中…',
  'Gas stake revocation submitted': 'ガス用ステークの解除を送信しました',
  'Gas stake claim submitted': 'ガス用ステークの受け取りを送信しました',
  'Funds return to the node account. Claiming may end gas-free eligibility.':
    '資金はノードアカウントに戻ります。受け取ると手数料免除の資格を失う場合があります。',
  'Gas stake changed. Refresh and review before submitting.':
    'ガス用ステークが変更されました。更新して確認してから送信してください。',
  'No revocable gas stake is available.': '解除可能なガス用ステークはありません。',
  'No matching gas stake withdrawal is available.': '該当する受け取り待ちのガス用ステークはありません。',
  'The gas stake waiting period has not ended.': 'ガス用ステークの待機期間は終了していません。',
  'Gas stake withdrawal history could not be verified.': 'ガス用ステークの解除履歴を確認できませんでした。',
  'Manage node funds, transfers, and gas staking.': 'ノードの資金、送金、ガス用ステークを管理します。',
  'Manage your service node NFT and its stake.': 'サービスノード NFT とそのステークを管理します。',
  'Refresh node NFTs': 'ノード NFT を更新',
  'Node address': 'ノードアドレス',
  Back: '戻る',
  'Gas stake': 'ガス用ステーク',
  'Account operations': 'アカウント操作',
  'Stake for gas': 'ガス用にステーク',
  'Loading gas staking rules…': 'ガス用ステークのルールを読み込み中…',
  'Only the node owner can stake for gas.': 'ガス用ステークはノード所有者のみが行えます。',
  'Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.':
    'ネットワークトークンをステークすると、取引手数料が免除されます。サービスノード NFT のステークとは別です。',
  '{count} days': '{count} 日',
  'After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.':
    '解除後、資金の受け取りまで {count} 日お待ちください。ネットワークの不正利用によりステークが没収される場合があります。',
  'Gas stake already sufficient': 'ガス用ステークは充足しています',
  'Confirm gas stake': 'ガス用ステークを確認',
  'Submitting gas stake…': 'ガス用ステークを送信中…',
  'Gas stake submitted': 'ガス用ステークを送信しました',
  'Gas staking rules could not be verified.': 'ガス用ステークのルールを確認できませんでした。',
  'Gas stake state could not be verified.': 'ガス用ステークの状態を確認できませんでした。',
  'Gas staking rules changed. Review the latest terms before submitting.':
    'ガス用ステークのルールが変更されました。送信前に最新の条件を確認してください。',
  'This node already has enough gas stake.': 'このノードは十分なガス用ステークを保有しています。',
  'Gas stake could not be confirmed. Check the stake state before retrying.':
    'ガス用ステークを確認できませんでした。再試行する前にステークの状態を確認してください。',
  'Node funds': 'ノード資金',
  'Transfer out': '送金',
  'Only the node owner can transfer funds.': '資金を送金できるのはノード所有者のみです。',
  'Loading available balance…': '利用可能残高を読み込み中…',
  'Transfer available funds to the node owner. Staked funds cannot be transferred.':
    '利用可能な資金をノード所有者に送金します。ステーク中の資金は送金できません。',
  'Recipient address': '受取人アドレス',
  'Available balance': '利用可能残高',
  'Transfer amount': '送金額',
  'Keep enough funds in the node wallet for transaction fees.':
    '取引手数料に十分な資金をノードウォレットに残してください。',
  'Review transfer': '送金内容を確認',
  'Transfer amount must be greater than zero.': '送金額は 0 より大きい値にしてください。',
  'Insufficient available balance.': '利用可能残高が不足しています。',
  'Confirm transfer': '送金を確認',
  'This transfer cannot be undone.': 'この送金は取り消せません。',
  'Transfer to owner': '所有者に送金',
  'Submitting transfer…': '送金を送信中…',
  'Transfer submitted': '送金を送信しました',
  'Transaction hash': '取引ハッシュ',
  'Refresh the node balance to verify the result.': 'ノード残高を更新して結果を確認してください。',
  'The owner does not have a valid recipient DID.': '所有者に有効な受取人 DID がありません。',
  'Node balance could not be verified.': 'ノード残高を確認できませんでした。',
  'Transfer could not be confirmed. Check the node balance and transaction history before retrying.':
    '送金を確認できませんでした。再試行する前にノード残高と取引履歴を確認してください。',
  'Acquiring…': '取得中…',
  'Node balance unavailable ({code}; {stage}; {path}).': 'ノード残高を取得できません（{code}；{stage}；{path}）。',
  transport: '接続またはタイムアウト',
  http: 'HTTP レスポンス',
  rpc: 'AFS クエリ',
  decode: 'レスポンス解析',
  'Some node data is unavailable': '一部のノードデータを取得できません',
  Details: '詳細',
  'Recharge on {network} to activate this node.': '{network} で入金して、このノードを有効化してください。',
  'Server Node Factory information': 'サービスノード工場情報',
  'NFT SVG template': 'NFT SVG テンプレート',
  'Server node NFT SVG template': 'サービスノード NFT SVG テンプレート',
  'No SVG template available': 'SVG テンプレートがありません',
  Executive: 'エグゼクティブ',
  Tech: 'テクノロジー',
  Creative: 'クリエイティブ',
  Consultant: 'コンサルタント',
  executiveCard: 'エグゼクティブ',
  techCard: 'テクノロジー',
  creativeCard: 'クリエイティブ',
  consultantCard: 'コンサルタント',
  'About SVG Namecard templates': 'SVG 名刺テンプレートについて',
  'SVG Namecard template': 'SVG 名刺テンプレート',
  'Contact name.': '連絡先名。',
  'Company or organization.': '会社または組織。',
  'Job title or position.': '役職。',
  'Phone number.': '電話番号。',
  'Email address.': 'メールアドレス。',
  'Website URL.': 'ウェブサイト URL。',
  'Location.': '所在地。',
  'Background or personal introduction.': '経歴または自己紹介。',
  'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.':
    'SVG 名刺テンプレートは連絡先カード NFT の外観を定義します。クライアントは表示時にプレースホルダーをプロフィールまたは復号済みの連絡先データに置き換えます。',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.':
    '変数名は二重波括弧を含めて正確に記述してください。有効な .svg ファイル（最大 5 MB）をアップロードし、contact.name を必ず含めてください。サンプルをダウンロードして編集できます。値はクライアントの連絡先フィールドから取得し、未指定の値は空欄になります。プレビューには実際の連絡先ではなくプレースホルダーが表示されます。',
  'Last chain sync:': '最終チェーン同期：',
  'Chain sync failed. Showing saved data; try Refresh again.':
    'チェーンの同期に失敗しました。保存済みデータを表示しています。もう一度更新してください。',
  'About SVG Envelope templates': 'SVG 封筒テンプレートについて',
  'SVG Envelope template': 'SVG 封筒テンプレート',
  'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.':
    'SVG 封筒テンプレートはメール NFT の表紙を定義します。表示時にプレースホルダーをメールデータに置き換えます。暗号化されたメール本文は変更されません。',
  'Supported variables': '対応する変数',
  Required: '必須',
  Example: '例',
  'Mail subject, filled by the client after decryption.': 'メールの件名。復号後にクライアントが設定します。',
  'Sender DID address.': '送信者の DID アドレス。',
  'Mail creation time, formatted by the client.': 'メール作成日時。クライアントが書式を設定します。',
  'Mail expiration time, formatted by the client.': 'メール有効期限。クライアントが書式を設定します。',
  'Envelope NFT address. Some send previews do not provide this value.':
    '封筒 NFT アドレス。一部の送信プレビューでは提供されません。',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.':
    '変数名は二重波括弧を含めて正確に記述してください。有効な .svg ファイル（最大 5 MB）に mail.subject と mail.sender を必ず含めてください。サンプルをダウンロードして編集後、アップロードできます。プレビューには実際のメールデータではなくプレースホルダーが表示されます。',
  'Session expired. Refresh the page to sign in again.':
    'セッションの有効期限が切れました。ページを更新して再ログインしてください。',
  envelope: '封筒',
  namecard: '名刺',
  owner: '所有者',
  admin: '管理者',
  member: 'メンバー',
  'Page size': '表示件数',
  Server: 'サービスノード',
  Envelope: '封筒',
  Namecard: '名刺',
  Storage: 'ストレージ',
  Attachments: '添付ファイル',
  Envelopes: '封筒',
  Namecards: '名刺',
  'Manage your node identity, balance, and stake.': 'ノードの識別情報、残高、ステークを管理します。',
  'Create and publish envelope templates for your node.': 'ノードの封筒テンプレートを作成・公開します。',
  'Create and publish namecard templates for your node.': 'ノードの名刺テンプレートを作成・公開します。',
  'Search and manage encrypted mail stored on your node.': 'ノードに保存された暗号化メールを検索・管理します。',
  'Manage attachment limits and storage pricing.': '添付ファイルの制限と保存料金を管理します。',
  'DIDMail business navigation': 'DIDMail メニュー',
  'Checking ARC session…': 'ARC セッションを確認中…',
  'Loading node account…': 'ノードアカウントを読み込み中…',
  'Loading page data…': 'ページデータを読み込み中…',
  'Node account': 'ノードアカウント',
  'DIDMail · Powered by ARC': 'DIDMail · ARC により提供',
  'DIDMail Admin': 'DIDMail 管理',
  'Sign in to manage your server node.': 'ログインしてサービスノードを管理します。',
  'Sign in with ARC': 'ARC でログイン',
  'Permission denied: Only owner or admin can access this page, current role is {role}':
    'アクセス拒否：所有者または管理者のみがアクセスできます。現在のロールは {role} です',
  Retry: '再試行',
  Cancel: 'キャンセル',
  Close: '閉じる',
  'DIDMail Server Node': 'DIDMail サービスノード',
  Unknown: '不明',
  'Loading…': '読み込み中…',
  Staked: 'ステーク済み',
  'No Stake': 'ステークなし',
  Revoked: '解除済み',
  'Refresh node account': 'ノードアカウントを更新',
  'Updating node data…': 'ノードデータを更新中…',
  'Chain data is unavailable. Balances and stake could not be verified.':
    'チェーンデータを取得できません。残高とステークを確認できませんでした。',
  'Stake data is unavailable: {message}': 'ステークデータを取得できません：{message}',
  'This node has no on-chain account yet. Recharge its address on the {network} network.':
    'このノードにはチェーン上のアカウントがありません。{network} ネットワークでノードアドレスに入金してください。',
  'Show node recharge QR code': 'ノード入金 QR コードを表示',
  Balance: '残高',
  Unavailable: '利用不可',
  'NO BALANCE': '残高なし',
  'NO STAKED': 'ステークなし',
  'NO REVOKED': '解除なし',
  'Database Used Size:': 'データベース使用量：',
  Refresh: '更新',
  Mails: 'メール',
  Search: '検索',
  'Search By ID/Address/Envelope/Hash': 'ID・アドレス・封筒・ハッシュで検索',
  'Loading {type} factory…': '{type}工場を読み込み中…',
  '{type} List': '{type}一覧',
  Clean: 'クリア',
  Name: '名前',
  Address: 'アドレス',
  Description: '説明',
  Limit: '発行上限',
  Minted: '発行済み',
  'Created At': '作成日時',
  'Updated At': '更新日時',
  'Owned By': '所有者',
  Price: '価格',
  'To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.':
    'DIDMail 公共サービスノードになるには、ノード NFT を購入してステークする必要があります。これによりクライアントがノードを検出し、サービスノード一覧に表示できます。',
  'DIDMail Server Node NFT Factory': 'DIDMail サービスノード NFT 工場',
  Acquired: '取得済み',
  Acquire: '取得',
  'Acquire DIDMail server node NFT for stake': 'ステーク用の DIDMail サービスノード NFT を取得',
  'Acquired DIDMail server node NFT for stake': 'ステーク用の DIDMail サービスノード NFT を取得しました',
  'Loading node factory…': 'ノード工場を読み込み中…',
  'Stake information could not be loaded. Refresh the node account to retry.':
    'ステーク情報を読み込めませんでした。ノードアカウントを更新して再試行してください。',
  'Loading node NFTs…': 'ノード NFT を読み込み中…',
  'No staked node NFTs yet': 'ステーク済みのノード NFT はありません',
  'Server Node NFT': 'サービスノード NFT',
  'Stake Address': 'ステークアドレス',
  'Amount to stake': 'ステークする数量',
  Location: '所在地',
  'Revoke Waiting Period': '解除待機期間',
  '{count} seconds': '{count} 秒',
  Stake: 'ステーク',
  Revoke: '解除',
  Claim: '受け取る',
  'Additional stake': '追加ステーク',
  'Add Stake': 'ステークを追加',
  'The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.':
    'NFT のエンドポイントがアプリ URL と異なります。更新前にステークを解除して受け取ってください。',
  'App URL': 'アプリ URL',
  'Endpoint URL': 'エンドポイント URL',
  'Update Endpoint': 'エンドポイントを更新',
  'Attachment Policy': '添付ファイルポリシー',
  'Max File Size': '最大ファイルサイズ',
  'MB · Limit for a single encrypted attachment on the wire.': 'MB · 暗号化された添付ファイル 1 件の転送サイズ上限。',
  'Max File Count': '最大ファイル数',
  'Maximum attachments allowed per mail.': 'メール 1 通あたりの添付ファイル数の上限。',
  'Price Per Byte Per Day': '1 バイト 1 日あたりの価格',
  'Storage unit price in wei (digits only).': '保存単価（wei 単位、数字のみ）。',
  'Last updated:': '最終更新：',
  'Save Policy': 'ポリシーを保存',
  '{type} Factory': '{type}工場',
  'Upload SVG {type} template file': 'SVG {type}テンプレートをアップロード',
  Unlimited: '無期限',
  'Retention Period': '保存期間',
  'Mail retention on this server, in days; 0 means unlimited.': 'このサーバーでのメール保存日数。0 は無期限です。',
  'Factory acquisition cost:': '工場取得費用：',
  'Creating Factory…': '工場を作成中…',
  'Create Factory': '工場を作成',
  'Create {type} NFT Factory': '{type} NFT 工場を作成',
  '{type} Factory information': '{type}工場情報',
  'Default Namecard': '標準の名刺',
  'The sender of the namecard will cover the costs.': '費用は名刺の送信者が負担します。',
  'Envelope Factory': '封筒工場',
  'Envelope Factory information': '封筒工場情報',
  'Confirmed before creation': '作成前の確認',
  'Loading Envelope factory…': '封筒工場を読み込み中…',
  '5–80 characters.': '5～80 文字。',
  '1–50 characters.': '1～50 文字。',
  'The sender of the mail will cover the costs.': '費用はメールの送信者が負担します。',
  'Enter name': '名前を入力',
  'Enter description': '説明を入力',
  Day: '日',
  'Click or drop an SVG file · up to 5 MB': 'クリックまたは SVG をドロップ · 最大 5 MB',
  'Click the preview to replace the SVG template.': 'プレビューをクリックして SVG テンプレートを変更します。',
  'Default Envelope': '標準の封筒',
  'Love Card': 'ラブカード',
  'Pig Card': '子豚のカード',
  'Business Card': 'ビジネスカード',
  'Festival Card': 'お祝いカード',
  Preview: 'プレビュー',
  'SVG template preview': 'SVG テンプレートのプレビュー',
  'Select or upload an SVG template.': 'SVG テンプレートを選択またはアップロードしてください。',
  'SVG {type} template samples': 'SVG {type}テンプレートのサンプル',
  'Use {name}': '{name}を使用',
  'Download SVG': 'SVG をダウンロード',
  default: '標準テンプレート',
  loveCard: 'ラブカード',
  pigCard: '子豚のカード',
  businessCard: 'ビジネスカード',
  festivalCard: 'お祝いカード',
  'Updating in background…': 'バックグラウンドで更新中…',
  'Loading {type} list…': '{type}一覧を読み込み中…',
  'Preview not available': 'プレビューできません',
  'Enable And Publish': '有効化して公開',
  'Enable {name}': '{name}を有効化',
  '{count} Day': '{count} 日',
  'No {type} NFTs yet': '{type} NFT はまだありません',
  'Total:': '合計：',
  Previous: '前へ',
  Next: '次へ',
  'Publish setting saved.': '公開設定を保存しました。',
  'Loading stored mail…': '保存済みメールを読み込み中…',
  ID: 'ID',
  Hash: 'ハッシュ',
  Size: 'サイズ',
  Payment: '支払額',
  Date: '日付',
  Action: '操作',
  Sender: '送信者',
  Receiver: '受信者',
  Asset: 'アセット',
  'View hashes': 'ハッシュを表示',
  Content: '内容',
  PaymentTx: '支払取引',
  AssetTx: 'アセット取引',
  Created: '作成日時',
  Download: 'ダウンロード日時',
  'N/A': '該当なし',
  Delete: '削除',
  'Delete mail {id}': 'メール {id} を削除',
  'No matching mail.': '一致するメールはありません。',
  'No mails stored yet.': '保存済みメールはありません。',
  Page: 'ページ',
  'of {count}': '全 {count} ページ',
  Free: '無料',
  Dividend: '配当',
  'Net Profit': '純利益',
  'Choose an SVG file.': 'SVG ファイルを選択してください。',
  'SVG template must be at most 5 MB.': 'SVG テンプレートは 5 MB 以下にしてください。',
  'Invalid SVG document.': '無効な SVG ドキュメントです。',
  'The SVG file must contain {fields}': 'SVG ファイルには {fields} が必要です',
  ' or ': ' または ',
  'Node data is updating. Please wait before submitting a transaction.':
    'ノードデータを更新中です。取引の送信までお待ちください。',
  'Node state could not be verified. Refresh the node data before submitting a transaction.':
    'ノードの状態を確認できませんでした。取引前にデータを更新してください。',
  'Operation failed.': '操作に失敗しました。',
  'Recharge Node': 'ノードに入金',
  Recharge: '入金',
  'Node recharge': 'ノードに入金',
  'Send funds to this node address.': 'このノードアドレスに送金してください。',
  'Network:': 'ネットワーク：',
  'Use the matching network in your wallet.': 'ウォレットで対応するネットワークを選択してください。',
  'Insufficient balance. Recharge the node first.': '残高が不足しています。先にノードに入金してください。',
  'Acquire Server Node NFT': 'サービスノード NFT を取得',
  'The node wallet will pay {cost} and own this NFT.': 'ノードウォレットが {cost} を支払い、この NFT を所有します。',
  'Request accepted. Refresh to verify on-chain state.':
    'リクエストを受け付けました。更新してチェーン上の状態を確認してください。',
  'Stake Node NFT': 'ノード NFT をステーク',
  'Revoke Stake': 'ステークを解除',
  'Claim Stake': 'ステークを受け取る',
  'Revoke the staked tokens? A waiting period applies before claiming.':
    'ステーク中のトークンを解除しますか？受け取りには待機期間があります。',
  'Submit this operation using the node wallet?': 'ノードウォレットでこの操作を送信しますか？',
  'Template could not be loaded.': 'テンプレートを読み込めませんでした。',
  'Clean {type} cache': '{type}キャッシュをクリア',
  'Remove cached publish settings for this list? On-chain NFTs remain.':
    'この一覧の公開設定キャッシュを削除しますか？チェーン上の NFT は保持されます。',
  'Cache cleaned.': 'キャッシュをクリアしました。',
  'Delete Mail': 'メールを削除',
  'Delete mail {id} and its encrypted content? This action cannot be undone.':
    'メール {id} と暗号化された内容を削除しますか？この操作は取り消せません。',
  'Mail deleted.': 'メールを削除しました。',
  'Select a valid SVG template.': '有効な SVG テンプレートを選択してください。',
  'Enter a valid page or page size.': '有効なページ番号または表示件数を入力してください。',
  'Enter positive file limits and a price in whole wei.':
    'ファイル制限は正の値、価格は wei 単位の整数で入力してください。',
  'Attachment policy saved successfully.': '添付ファイルポリシーを保存しました。',
  'Enter an integer stake amount within the node balance.': 'ノード残高以下の整数でステーク数量を入力してください。',
  'Add {amount} tokens to the node stake?': 'ノードのステークに {amount} トークンを追加しますか？',
  'Name must be 5–80 characters; description must be 1–50 characters.':
    '名前は 5～80 文字、説明は 1～50 文字で入力してください。',
  'Price must be at least 0.001.': '価格は 0.001 以上にしてください。',
  'Retention must be a non-negative integer.': '保存期間は 0 以上の整数にしてください。',
  'Insufficient or unavailable node balance.': 'ノード残高が不足しているか、取得できません。',
  'Create {type} Factory': '{type}工場を作成',
  'The node wallet will pay the factory acquisition cost: {cost}.':
    'ノードウォレットが工場取得費用 {cost} を支払います。',
  Create: '作成',
  'Factory created successfully.': '工場を作成しました。',
  'Enter a valid token amount.': '有効なトークン数量を入力してください。',
  'Use at most {precision} decimal places.': '小数点以下は {precision} 桁以内にしてください。',
  'Invalid API response ({status}).': '無効な API レスポンス（{status}）。',
  'Request failed ({status}).': 'リクエストに失敗しました（{status}）。',
  'The operation was aborted due to timeout': 'タイムアウトしました。後でもう一度お試しください。',
  'Failed to fetch': 'ネットワークリクエストに失敗しました。接続を確認して再試行してください。',
};

return {"default": defaultExport};
})();

// ---- locales/admin-ru.js ----
modules["locales/admin-ru.js"] = (() => {
const defaultExport = {
  'Single-file limit exceeds total attachment limit': 'Лимит одного вложения не может превышать общий лимит вложений.',
  'Clear search': 'Сбросить поиск',
  'Help and usage': 'Справка и руководство',
"Node funded":"Оплачивает узел",
"Node-paid NFT cost":"Расход узла на NFT",

"Namecard category":"Категория визитки",
"Public namecard":"Публичная визитка",
"Member-only namecard":"Визитка для участников",
"Member namecards require a bound active member.":"Визитки участников доступны активным участникам с привязанной почтой.",

"Envelope category":"Категория конверта",
"Public envelope":"Публичный конверт",
"Member-only envelope":"Конверт для участников",
"Member envelopes require a bound active member.":"Для конверта участников нужны активное членство ARC и привязанный почтовый ящик.",
"Envelope category saved.":"Категория конверта сохранена.",
"Member envelope":"Конверт для участников",
"Setup only":"Подготовка настроек",
"Members send for free. The node pays the NFT minting cost.":"Участники отправляют бесплатно. Узел оплачивает выпуск NFT.",
"Sponsorship is not enabled yet. Saving these settings does not allow free sending.":"Оплата узлом пока недоступна. Сохранение настроек не включает бесплатную отправку.",
"Public default envelope":"Публичный конверт по умолчанию",
"Member default envelope":"Конверт участников по умолчанию",
"Daily limit per member":"Суточный лимит участника",
"Per-minute limit per member":"Минутный лимит участника",
"Daily node sponsorship budget (UTC)":"Суточный бюджет узла (UTC)",
"Only a zero-price published NFT can be selected as the member envelope. Membership and mailbox binding are required.":"Можно выбрать только опубликованный NFT-конверт с нулевой ценой. Нужны активное участие и привязка почтового ящика.",
"Save configuration":"Сохранить настройки",
"Manage members":"Управление участниками",
"Configuration saved. Sponsorship remains disabled.":"Настройки сохранены. Оплата узлом остаётся выключенной.",
"Configuration could not be saved. Refresh and try again.":"Не удалось сохранить. Обновите страницу и повторите.",
"Member envelope configuration is unavailable.":"Настройки конверта участников недоступны.",
"Not configured":"Не настроено",
"Automatic public default":"Автоматический публичный конверт",
"Mail fee":"Плата за письмо",
"Total fee":"Итого",
"Mail":"Письмо",
"Participants":"Отправитель и получатель",
"Preparing":"Подготовка",
"Awaiting signature":"Ожидает подписи",
"Queued":"В очереди",
"Confirming payment":"Подтверждение оплаты",
"Creating mail NFT":"Создание NFT письма",
"Delivered":"Доставлено",
"Rejected":"Отклонено",
"Expired":"Срок истёк",
"Review required":"Требует проверки",
"Unknown status":"Статус неизвестен",
"Historical record":"Архивная запись",
"Recorded amount":"Записанная сумма",
"Payment confirmed":"Оплата подтверждена",
"Confirmation pending":"Ожидает подтверждения",
"Quoted amount":"Стоимость по смете",
"Node service fee":"Услуги узла",
"Developer share":"Доля разработчика",
"Indexing fee":"Индексация",
"Fee breakdown":"Состав платы",
"Quote breakdown":"Состав сметы",
"Mail details {id}":"Сведения о письме {id}",
"Message identifiers":"Идентификаторы письма",
"Transaction records":"Транзакции",
"Deleting removes the encrypted copy on this node. Chain records and downloaded copies remain.":"Удаляется только зашифрованная копия на этом узле. Записи в цепочке и скачанные копии сохраняются.",
"Delivery is in progress. Deletion is unavailable until it finishes.":"Письмо доставляется. Удаление станет доступно после завершения.",
"Loading sender list…":"Загрузка списка…",
"Blocked accounts cannot send through this server. Receiving and past mail downloads are unaffected.":"Заблокированные аккаунты не могут отправлять через этот сервер. Получение и скачивание старых писем сохраняются.",
"Allowlisted accounts can send through this server when access is restricted.":"При ограничении отправки аккаунты из списка разрешённых могут отправлять письма.",
"How access works":"Правила доступа",
"Enter a valid mailbox or ARC DID.":"Введите действительный DID почтового ящика или входа в ARC.",
"Could not confirm the result. Refresh the list before retrying.":"Не удалось подтвердить результат. Обновите список перед повторной попыткой.",

"A staked DIDMail service node NFT opens sending to everyone. Without one, only active local members with a linked mailbox can send. Blocked accounts are always excluded.":"Действующий стейкинг NFT узла DIDMail открывает отправку всем. Без него отправлять могут только активные участники со связанным ящиком. Заблокированные аккаунты исключены всегда.",
"Any sender":"Любой отправитель",
"Members of this server":"Только участники сервера",
"Allowlisted senders":"Только разрешённые аккаунты",
"These controls apply only to new mail sent through this server. Receiving and historical downloads are unaffected.":"Настройки влияют только на новые письма через этот сервер. Получение и скачивание старых писем сохраняются.",
"Who can send through this server?":"Кто может отправлять через этот сервер?",
"Current setting: {mode}":"Сейчас: {mode}",
"Anyone can submit mail here, except blocked accounts. Service fees still follow your settings.":"Отправлять может любой, кроме заблокированных аккаунтов. Оплата определяется настройками почтового сервиса.",
"Only active non-guest ARC members with a linked mailbox can submit mail here.":"Отправлять могут активные участники ARC со связанным ящиком, кроме гостей.",
"Only accounts on the allowlist can submit mail here.":"Отправлять могут только аккаунты из списка разрешённых.",
"No unsaved changes":"Настройки сохранены",
"Unsaved changes":"Есть несохранённые изменения",
"Member permissions come from ARC. Manage members and invitations above; no separate allowlist is needed.":"Членством управляет ARC. Управляйте участниками и приглашениями выше; отдельный список разрешённых не нужен.",
"Blocked senders":"Заблокированные отправители",
"Allowed senders":"Разрешённые отправители",
"Blocked accounts cannot submit new mail here, even if they are members.":"Заблокированные аккаунты не могут отправлять новые письма, даже если являются участниками.",
"These accounts can submit mail when sending is restricted to the allowlist.":"Эти аккаунты могут отправлять при ограничении списком разрешённых.",
"Block a sender":"Заблокировать аккаунт",
"Allow a sender":"Разрешить аккаунт",
"Account DID":"DID аккаунта",
"Paste a mailbox DID or ARC login DID.":"Вставьте DID почтового ящика или DID входа в ARC.",
"Note (optional)":"Примечание (необязательно)",
"Why is this account listed?":"Например: спам, тестовый аккаунт",
"Confirm block":"Подтвердить блокировку",
"Confirm allow":"Подтвердить разрешение",
"Edit note":"Изменить примечание",
"Unblock":"Разблокировать",
"Remove from allowlist":"Убрать из разрешённых",
"No blocked senders":"Заблокированных аккаунтов нет",
"No allowed senders yet":"Разрешённых аккаунтов пока нет",
"To stop an account from using this server, choose Block a sender.":"Чтобы запретить отправку, выберите блокировку аккаунта.",
"Add an account above before enabling allowlist-only sending.":"Перед ограничением списка добавьте разрешённые аккаунты.",
"Changing this list does not change the sending scope above.":"Изменение списка не меняет область отправки выше.",
"Sending scope saved.":"Область отправки сохранена.",
"Note updated.":"Примечание обновлено.",
"Sender blocked.":"Аккаунт заблокирован.",
"Sender allowed.":"Аккаунт разрешён.",
"Save note":"Сохранить примечание",
"Sender unblocked.":"Аккаунт разблокирован.",
"Sender removed from allowlist.":"Аккаунт убран из разрешённых.",

"Search members…":"Поиск участников…",
"All roles":"Все роли",
"All statuses":"Все статусы",
"Manage and invite":"Управление и приглашения",
"Unnamed member":"Без имени",
"Try another name, DID, or filter.":"Попробуйте другое имя, DID или фильтр.",
"Only active non-guest members qualify for member benefits.":"Привилегии доступны активным участникам, кроме гостей.",
"Access and blocklist":"Права отправки и чёрный список",
"guest":"Гость",

"Save sending access":"Сохранить права отправки",
"Members":"Участники",
"View ARC members and linked mailboxes.":"Участники ARC и связанные почтовые ящики.",
"Configure mail service and attachment limits.":"Настройка почтового сервиса и ограничений вложений.",
"Members and invitations are managed in ARC. Only active non-guest members qualify for member benefits.":"Участники и приглашения управляются в ARC. Привилегии доступны активным участникам, кроме гостей.",
"Link a mailbox":"Как связать почтовый ящик",
"In DIDMail, sign in to the mailbox, open Servers, connect this private server, then choose Link mailbox. Confirm with the matching ARC member. The association appears here after refreshing.":"Войдите в почтовый ящик DIDMail, откройте раздел серверов, подключитесь к этому частному серверу и выберите привязку ящика. Подтвердите разрешение соответствующим участником ARC и обновите эту страницу.",
"Linking requires the mailbox signature and member consent. Administrators cannot assign another person’s mailbox.":"Для привязки нужны подпись почтового ящика и согласие участника. Администратор не может назначить чужой ящик.",
"Member":"Участник",
"Role":"Роль",
"Active":"Активен",
"Inactive":"Неактивен",
"Linked mailbox":"Связанный ящик",
"Association":"Связь",
"Not linked":"Не связан",
"Linked":"Связан",
"No matching members.":"Участники не найдены.",
"Page {page} · {total} members":"Страница {page} · Участников: {total}",
"Search members":"Поиск участников",
"Name or DID":"Имя или DID",
"ARC member service is unavailable. Refresh to retry.":"Сервис участников недоступен. Обновите страницу.",

"Manage ARC members and invitations":"Управление участниками ARC и приглашениями",
"Active ARC members pay no ordinary-mail or attachment fees. Manage membership and invitations in the ARC console. Guests are excluded.":"Активные участники ARC не платят за обычные письма и вложения. Управляйте участниками и приглашениями в консоли ARC. Гости исключены.",
"Denylist takes priority. Members-only sending requires an active linked ARC member.":"Чёрный список имеет приоритет. Для отправки только участниками требуется связанная активная учётная запись ARC.",
"Active ARC members only":"Только активные участники ARC",
"Denylist takes priority. An empty allowlist blocks new sends in allowlist-only mode.": "Чёрный список имеет приоритет. Пустой белый список запрещает новую отправку в режиме ограниченного доступа, но не меняет публичный статус.",

  "All senders except denylist": "Все отправители, кроме заблокированных",
  "Public listing depends on a staked DIDMail server node NFT. Allowlisted senders pay no ordinary-mail or attachment fees.": "Публичный список определяется стейкингом NFT узла DIDMail. Для отправителей из белого списка обычная почта и вложения бесплатны.",

  "DID details": "Данные DID",
  "Copy DID": "Копировать DID",
  "DID QR code": "QR-код DID",
  "DID copied.": "DID скопирован.",
  "Copy failed. Copy the full DID below manually.": "Не удалось скопировать. Скопируйте полный DID ниже вручную.",

  "Settings": "Настройки",
  "Configure mail service, access lists, and delivery operations.": "Настройка почты, списков доступа и доставки.",
  "Mail service": "Почтовый сервис",
  "Delivery status is unavailable. Refresh to try again.": "Статус доставки недоступен. Обновите страницу.",

  'Experimental ordinary mail supports free mail and signed service payments.':
    'Экспериментальная обычная почта поддерживает бесплатную отправку и оплату услуги с подтверждением подписью.',
  Message: 'Письмо',
  Status: 'Статус',
  'Mail Service and Access': 'Почтовый сервис и доступ',
  'Access lists control who can send and store mail here. External recipients can still download their mail.':
    'Списки определяют право отправлять и хранить почту на этом узле. Внешние получатели могут скачивать свои письма.',
  'Sending access': 'Право отправки',
  'Public node': 'Открытый узел',
  'Allowlist only': 'Только список разрешённых',
  'Denylist takes priority. An empty allowlist never opens a restricted node.':
    'Список запрещённых имеет приоритет. Пустой список разрешённых не открывает доступ к закрытому узлу.',
  'Ordinary mail': 'Обычная почта',
  'Experimental ordinary mail supports free service only.':
    'Экспериментальная обычная почта поддерживает только бесплатное обслуживание.',
  'Ordinary mail is not available yet. Its terms can be prepared below.':
    'Обычная почта пока недоступна. Условия можно подготовить ниже.',
  'Enable ordinary mail': 'Включить обычную почту',
  'Retention in days': 'Срок хранения в днях',
  'Base fee in native token units': 'Базовая плата в минимальных единицах нативного токена',
  'Attachment fee per byte per day in native token units':
    'Плата за байт вложения в день в минимальных единицах токена',
  'Fees use the smallest token unit. Set both fees to zero for free mail. NFT envelope terms remain unchanged.':
    'Плата задаётся в минимальных единицах токена. Установите обе платы в 0 для бесплатной почты. Условия NFT-конвертов не меняются.',
  'New mail attachment limits': 'Ограничения вложений новых писем',
  'Allow attachments': 'Разрешить вложения',
  'Maximum attachment count': 'Максимальное число вложений',
  'Enter sizes that convert to whole bytes within the allowed limits.': 'Введите размеры в допустимых пределах, соответствующие целому числу байтов.',
  'The mail NFT transaction was rejected. The server will retry without another sender payment.': 'Транзакция почтового NFT отклонена. Сервер повторит попытку без повторной оплаты отправителем.',
  'Waiting to retry': 'Ожидание повтора',
  'Delivery progress': 'Ход доставки',
  'Diagnostic code': 'Код диагностики',
  'Reason': 'Причина',
  'Next attempt': 'Следующая попытка',
  'Previous NFT transactions': 'Предыдущие транзакции NFT',
  'Payment was rejected. No mail NFT was created.': 'Платёж отклонён. Почтовый NFT не создан.',
  'Delivery is paused for verification. Original transactions are retained.': 'Доставка приостановлена для проверки. Исходные транзакции сохранены.',
  'The server retries automatically using the saved delivery task. No additional sender payment is required.': 'Сервер автоматически повторяет сохранённое задание доставки. Повторная оплата отправителем не требуется.',
  'Maximum file size (MiB)': 'Максимальный размер файла (MiB)',
  'Maximum total attachment size (MiB)': 'Максимальный суммарный размер вложений (MiB)',
  'Maximum encrypted message size (MiB)': 'Максимальный размер зашифрованного письма (MiB)',
  'File limits count plaintext bytes; the message limit includes encryption overhead. Accepted mail keeps its existing terms.':
    'Размер файлов считается до шифрования; размер письма включает затраты шифрования. Условия принятых писем сохраняются.',
  'The node and sender must each maintain the required native-token gas stake. Downloading requires no stake.':
    'Узел и отправитель должны поддерживать необходимый стейк нативного токена для освобождения от Gas. Для скачивания стейк не нужен.',
  'Save mail service policy': 'Сохранить настройки почтового сервиса',
  'DID access lists': 'Списки доступа DID',
  List: 'Список',
  Allowlist: 'Список разрешённых',
  Denylist: 'Список запрещённых',
  Remark: 'Примечание',
  'Add or update remark': 'Добавить или обновить примечание',
  'List changes do not automatically change the access mode.':
    'Изменение списков не переключает режим доступа автоматически.',
  'Added at': 'Дата добавления',
  'Remove from list': 'Удалить из списка',
  'No DIDs in this list.': 'В этом списке нет DID.',
  'Policy changed or is unavailable. Refresh and review before retrying.':
    'Настройки изменены или недоступны. Обновите страницу и проверьте их перед повтором.',
  'Mail service settings saved.': 'Настройки почтового сервиса сохранены.',
  'Loading mail service policy…': 'Загрузка настроек почтового сервиса…',
  'Server endpoint': 'Адрес сервера',
  'Copy endpoint': 'Копировать адрес',
  'Endpoint copied.': 'Адрес скопирован.',
  'Copy failed. Select the endpoint above and copy it manually.':
    'Не удалось скопировать. Выделите адрес выше и скопируйте вручную.',
  'Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.':
    'Укажите этот адрес в клиентах DIDMail. Для прямого подключения NFT узла не нужен.',
  'Delivery state': 'Статус отправки',
  Amount: 'Сумма',
  'Revoke gas stake': 'Отозвать стейк для газа',
  'Claim gas stake': 'Забрать стейк для газа',
  'Pending withdrawals': 'Ожидающие выводы',
  'Ready to claim': 'Можно забрать',
  'Available to claim at': 'Доступно с',
  'Revoking gas stake…': 'Отзыв стейка для газа…',
  'Claiming gas stake…': 'Получение стейка для газа…',
  'Gas stake revocation submitted': 'Отзыв стейка для газа отправлен',
  'Gas stake claim submitted': 'Запрос получения стейка для газа отправлен',
  'Funds return to the node account. Claiming may end gas-free eligibility.':
    'Средства вернутся на счёт узла. Получение может лишить права на транзакции без комиссии.',
  'Gas stake changed. Refresh and review before submitting.':
    'Стейк для газа изменился. Обновите и проверьте данные перед отправкой.',
  'No revocable gas stake is available.': 'Нет стейка для газа, доступного для отзыва.',
  'No matching gas stake withdrawal is available.': 'Соответствующий вывод стейка для газа не найден.',
  'The gas stake waiting period has not ended.': 'Период ожидания стейка для газа ещё не завершён.',
  'Gas stake withdrawal history could not be verified.': 'Не удалось проверить историю вывода стейка для газа.',
  'Manage node funds, transfers, and gas staking.': 'Управление средствами узла, переводами и стейком для газа.',
  'Manage your service node NFT and its stake.': 'Управление NFT сервисного узла и его стейком.',
  'Refresh node NFTs': 'Обновить NFT узла',
  'Node address': 'Адрес узла',
  Back: 'Назад',
  'Gas stake': 'Стейк для газа',
  'Account operations': 'Операции со счётом',
  'Stake for gas': 'Внести стейк для газа',
  'Loading gas staking rules…': 'Загрузка правил стейкинга для газа…',
  'Only the node owner can stake for gas.': 'Только владелец узла может внести стейк для газа.',
  'Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.':
    'Внесите токены сети в стейк для транзакций без комиссии. Этот стейк не связан со стейком NFT сервисного узла.',
  '{count} days': '{count} дн.',
  'After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.':
    'После отзыва подождите {count} дн. до получения средств. Злоупотребление сетью может привести к конфискации стейка.',
  'Gas stake already sufficient': 'Стейка для газа уже достаточно',
  'Confirm gas stake': 'Подтвердить стейк для газа',
  'Submitting gas stake…': 'Отправка стейка для газа…',
  'Gas stake submitted': 'Стейк для газа отправлен',
  'Gas staking rules could not be verified.': 'Не удалось проверить правила стейкинга для газа.',
  'Gas stake state could not be verified.': 'Не удалось проверить состояние стейка для газа.',
  'Gas staking rules changed. Review the latest terms before submitting.':
    'Правила стейкинга для газа изменились. Проверьте актуальные условия перед отправкой.',
  'This node already has enough gas stake.': 'У этого узла уже достаточно стейка для газа.',
  'Gas stake could not be confirmed. Check the stake state before retrying.':
    'Не удалось подтвердить стейк для газа. Проверьте его состояние перед повторной попыткой.',
  'Node funds': 'Средства узла',
  'Transfer out': 'Вывести средства',
  'Only the node owner can transfer funds.': 'Только владелец узла может выводить средства.',
  'Loading available balance…': 'Загрузка доступного баланса…',
  'Transfer available funds to the node owner. Staked funds cannot be transferred.':
    'Перевод доступных средств владельцу узла. Средства в стейке вывести нельзя.',
  'Recipient address': 'Адрес получателя',
  'Available balance': 'Доступный баланс',
  'Transfer amount': 'Сумма перевода',
  'Keep enough funds in the node wallet for transaction fees.':
    'Оставьте в кошельке узла достаточно средств для комиссий.',
  'Review transfer': 'Проверить перевод',
  'Transfer amount must be greater than zero.': 'Сумма перевода должна быть больше нуля.',
  'Insufficient available balance.': 'Недостаточно доступных средств.',
  'Confirm transfer': 'Подтвердить перевод',
  'This transfer cannot be undone.': 'Этот перевод нельзя отменить.',
  'Transfer to owner': 'Перевести владельцу',
  'Submitting transfer…': 'Отправка перевода…',
  'Transfer submitted': 'Перевод отправлен',
  'Transaction hash': 'Хеш транзакции',
  'Refresh the node balance to verify the result.': 'Обновите баланс узла, чтобы проверить результат.',
  'The owner does not have a valid recipient DID.': 'У владельца нет действительного DID получателя.',
  'Node balance could not be verified.': 'Не удалось проверить баланс узла.',
  'Transfer could not be confirmed. Check the node balance and transaction history before retrying.':
    'Не удалось подтвердить перевод. Проверьте баланс узла и историю транзакций перед повторной попыткой.',
  'Acquiring…': 'Получение…',
  'Node balance unavailable ({code}; {stage}; {path}).': 'Баланс узла недоступен ({code}; {stage}; {path}).',
  transport: 'Соединение или тайм-аут',
  http: 'Ответ HTTP',
  rpc: 'Запрос AFS',
  decode: 'Разбор ответа',
  'Some node data is unavailable': 'Часть данных узла недоступна',
  Details: 'Подробнее',
  'Recharge on {network} to activate this node.': 'Пополните счёт в сети {network}, чтобы активировать узел.',
  'Server Node Factory information': 'Информация о фабрике узлов',
  'NFT SVG template': 'SVG-шаблон NFT',
  'Server node NFT SVG template': 'SVG-шаблон NFT сервисного узла',
  'No SVG template available': 'SVG-шаблон недоступен',
  Executive: 'Деловой стиль',
  Tech: 'Технологии',
  Creative: 'Творческий стиль',
  Consultant: 'Консультант',
  executiveCard: 'Деловой стиль',
  techCard: 'Технологии',
  creativeCard: 'Творческий стиль',
  consultantCard: 'Консультант',
  'About SVG Namecard templates': 'О SVG-шаблонах визиток',
  'SVG Namecard template': 'SVG-шаблон визитки',
  'Contact name.': 'Имя контакта.',
  'Company or organization.': 'Компания или организация.',
  'Job title or position.': 'Должность.',
  'Phone number.': 'Номер телефона.',
  'Email address.': 'Адрес электронной почты.',
  'Website URL.': 'URL сайта.',
  'Location.': 'Местоположение.',
  'Background or personal introduction.': 'Биография или сведения о себе.',
  'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.':
    'SVG-шаблон визитки задаёт внешний вид NFT карточки контакта. При отображении клиент заменяет переменные данными профиля или расшифрованными данными контакта.',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.':
    'Используйте точные имена переменных в двойных фигурных скобках. Загрузите корректный файл .svg размером до 5 МБ; contact.name обязателен. Скачайте образец, отредактируйте и загрузите его. Значения берутся из полей контакта клиента; отсутствующие поля остаются пустыми. Предпросмотр показывает переменные, а не реальные данные контакта.',
  'Last chain sync:': 'Последняя синхронизация с сетью:',
  'Chain sync failed. Showing saved data; try Refresh again.':
    'Синхронизация с сетью не удалась. Показаны сохранённые данные; попробуйте обновить снова.',
  'About SVG Envelope templates': 'О SVG-шаблонах конвертов',
  'SVG Envelope template': 'SVG-шаблон конверта',
  'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.':
    'SVG-шаблон конверта задаёт обложку NFT письма. При отображении клиент заменяет переменные данными письма; зашифрованное содержимое не меняется.',
  'Supported variables': 'Поддерживаемые переменные',
  Required: 'Обязательно',
  Example: 'Пример',
  'Mail subject, filled by the client after decryption.': 'Тема письма, заполняется клиентом после расшифровки.',
  'Sender DID address.': 'DID-адрес отправителя.',
  'Mail creation time, formatted by the client.': 'Время создания письма в формате клиента.',
  'Mail expiration time, formatted by the client.': 'Время истечения срока письма в формате клиента.',
  'Envelope NFT address. Some send previews do not provide this value.':
    'Адрес NFT конверта. Некоторые предпросмотры отправки не предоставляют это значение.',
  'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.':
    'Используйте точные имена переменных в двойных фигурных скобках. Загрузите корректный файл .svg размером до 5 МБ; mail.subject и mail.sender обязательны. Скачайте образец, отредактируйте и загрузите его. Предпросмотр показывает переменные шаблона, а не реальные данные письма.',
  'Session expired. Refresh the page to sign in again.': 'Сеанс истёк. Обновите страницу для повторного входа.',
  envelope: 'конверт',
  namecard: 'визитка',
  owner: 'владелец',
  admin: 'администратор',
  member: 'участник',
  'Page size': 'Размер страницы',
  Server: 'Сервисный узел',
  Envelope: 'Конверт',
  Namecard: 'Визитка',
  Storage: 'Хранилище',
  Attachments: 'Вложения',
  Envelopes: 'Конверты',
  Namecards: 'Визитки',
  'Manage your node identity, balance, and stake.': 'Управление идентификацией узла, балансом и стейком.',
  'Create and publish envelope templates for your node.': 'Создание и публикация шаблонов конвертов для узла.',
  'Create and publish namecard templates for your node.': 'Создание и публикация шаблонов визиток для узла.',
  'Search and manage encrypted mail stored on your node.': 'Поиск и управление зашифрованными письмами на узле.',
  'Manage attachment limits and storage pricing.': 'Управление ограничениями вложений и стоимостью хранения.',
  'DIDMail business navigation': 'Навигация DIDMail',
  'Checking ARC session…': 'Проверка сеанса ARC…',
  'Loading node account…': 'Загрузка счёта узла…',
  'Loading page data…': 'Загрузка данных страницы…',
  'Node account': 'Счёт узла',
  'DIDMail · Powered by ARC': 'DIDMail · На базе ARC',
  'DIDMail Admin': 'Администрирование DIDMail',
  'Sign in to manage your server node.': 'Войдите для управления сервисным узлом.',
  'Sign in with ARC': 'Войти через ARC',
  'Permission denied: Only owner or admin can access this page, current role is {role}':
    'Доступ запрещён: страница доступна только владельцу или администратору. Текущая роль: {role}',
  Retry: 'Повторить',
  Cancel: 'Отмена',
  Close: 'Закрыть',
  'DIDMail Server Node': 'Сервисный узел DIDMail',
  Unknown: 'Неизвестно',
  'Loading…': 'Загрузка…',
  Staked: 'В стейке',
  'No Stake': 'Нет стейка',
  Revoked: 'Отозвано',
  'Refresh node account': 'Обновить счёт узла',
  'Updating node data…': 'Обновление данных узла…',
  'Chain data is unavailable. Balances and stake could not be verified.':
    'Данные сети недоступны. Не удалось проверить баланс и стейк.',
  'Stake data is unavailable: {message}': 'Данные стейка недоступны: {message}',
  'This node has no on-chain account yet. Recharge its address on the {network} network.':
    'У этого узла ещё нет счёта в сети. Пополните его адрес в сети {network}.',
  'Show node recharge QR code': 'Показать QR-код пополнения узла',
  Balance: 'Баланс',
  Unavailable: 'Недоступно',
  'NO BALANCE': 'НЕТ СРЕДСТВ',
  'NO STAKED': 'НЕТ СТЕЙКА',
  'NO REVOKED': 'НЕТ ОТОЗВАННЫХ',
  'Database Used Size:': 'Занято в базе данных:',
  Refresh: 'Обновить',
  Mails: 'Письма',
  Search: 'Поиск',
  'Search By ID/Address/Envelope/Hash': 'Поиск по ID, адресу, конверту или хешу',
  'Loading {type} factory…': 'Загрузка фабрики «{type}»…',
  '{type} List': 'Список: {type}',
  Clean: 'Очистить',
  Name: 'Название',
  Address: 'Адрес',
  Description: 'Описание',
  Limit: 'Лимит выпуска',
  Minted: 'Выпущено',
  'Created At': 'Дата создания',
  'Updated At': 'Дата обновления',
  'Owned By': 'Владелец',
  Price: 'Цена',
  'To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.':
    'Чтобы стать публичным сервисным узлом DIDMail, купите NFT узла и внесите его в стейк. Тогда клиенты смогут обнаружить узел и показать его в списке сервисных узлов.',
  'DIDMail Server Node NFT Factory': 'Фабрика NFT сервисных узлов DIDMail',
  Acquired: 'Получено',
  Acquire: 'Получить',
  'Acquire DIDMail server node NFT for stake': 'Получить NFT сервисного узла DIDMail для стейкинга',
  'Acquired DIDMail server node NFT for stake': 'NFT сервисного узла DIDMail для стейкинга получен',
  'Loading node factory…': 'Загрузка фабрики узлов…',
  'Stake information could not be loaded. Refresh the node account to retry.':
    'Не удалось загрузить данные стейка. Обновите счёт узла для повторной попытки.',
  'Loading node NFTs…': 'Загрузка NFT узла…',
  'No staked node NFTs yet': 'NFT узлов в стейке пока нет',
  'Server Node NFT': 'NFT сервисного узла',
  'Stake Address': 'Адрес стейка',
  'Amount to stake': 'Сумма стейка',
  Location: 'Местоположение',
  'Revoke Waiting Period': 'Период ожидания отзыва',
  '{count} seconds': '{count} сек.',
  Stake: 'Внести в стейк',
  Revoke: 'Отозвать',
  Claim: 'Забрать',
  'Additional stake': 'Дополнительный стейк',
  'Add Stake': 'Добавить стейк',
  'The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.':
    'Адрес NFT отличается от URL приложения. Отзовите и заберите стейк перед обновлением.',
  'App URL': 'URL приложения',
  'Endpoint URL': 'URL сервера',
  'Update Endpoint': 'Обновить адрес',
  'Attachment Policy': 'Политика вложений',
  'Max File Size': 'Максимальный размер файла',
  'MB · Limit for a single encrypted attachment on the wire.':
    'МБ · Ограничение размера одного зашифрованного вложения при передаче.',
  'Max File Count': 'Максимальное число файлов',
  'Maximum attachments allowed per mail.': 'Максимальное число вложений в одном письме.',
  'Price Per Byte Per Day': 'Цена за байт в сутки',
  'Storage unit price in wei (digits only).': 'Цена хранения в wei (только цифры).',
  'Last updated:': 'Последнее обновление:',
  'Save Policy': 'Сохранить политику',
  '{type} Factory': 'Фабрика: {type}',
  'Upload SVG {type} template file': 'Загрузить SVG-шаблон: {type}',
  Unlimited: 'Без ограничений',
  'Retention Period': 'Срок хранения',
  'Mail retention on this server, in days; 0 means unlimited.':
    'Срок хранения писем на сервере в днях; 0 — без ограничений.',
  'Factory acquisition cost:': 'Стоимость получения фабрики:',
  'Creating Factory…': 'Создание фабрики…',
  'Create Factory': 'Создать фабрику',
  'Create {type} NFT Factory': 'Создать фабрику NFT: {type}',
  '{type} Factory information': 'Информация о фабрике: {type}',
  'Default Namecard': 'Стандартная визитка',
  'The sender of the namecard will cover the costs.': 'Расходы оплачивает отправитель визитки.',
  'Envelope Factory': 'Фабрика конвертов',
  'Envelope Factory information': 'Информация о фабрике конвертов',
  'Confirmed before creation': 'Подтверждено перед созданием',
  'Loading Envelope factory…': 'Загрузка фабрики конвертов…',
  '5–80 characters.': '5–80 символов.',
  '1–50 characters.': '1–50 символов.',
  'The sender of the mail will cover the costs.': 'Расходы оплачивает отправитель письма.',
  'Enter name': 'Введите название',
  'Enter description': 'Введите описание',
  Day: 'День',
  'Click or drop an SVG file · up to 5 MB': 'Нажмите или перетащите SVG-файл · до 5 МБ',
  'Click the preview to replace the SVG template.': 'Нажмите на предпросмотр, чтобы заменить SVG-шаблон.',
  'Default Envelope': 'Стандартный конверт',
  'Love Card': 'Любовная открытка',
  'Pig Card': 'Открытка с поросёнком',
  'Business Card': 'Деловая открытка',
  'Festival Card': 'Праздничная открытка',
  Preview: 'Предпросмотр',
  'SVG template preview': 'Предпросмотр SVG-шаблона',
  'Select or upload an SVG template.': 'Выберите или загрузите SVG-шаблон.',
  'SVG {type} template samples': 'Образцы SVG-шаблонов: {type}',
  'Use {name}': 'Использовать {name}',
  'Download SVG': 'Скачать SVG',
  default: 'Стандартный шаблон',
  loveCard: 'Любовная открытка',
  pigCard: 'Открытка с поросёнком',
  businessCard: 'Деловая открытка',
  festivalCard: 'Праздничная открытка',
  'Updating in background…': 'Обновление в фоне…',
  'Loading {type} list…': 'Загрузка списка: {type}…',
  'Preview not available': 'Предпросмотр недоступен',
  'Enable And Publish': 'Включить и опубликовать',
  'Enable {name}': 'Включить {name}',
  '{count} Day': '{count} дн.',
  'No {type} NFTs yet': 'NFT «{type}» пока нет',
  'Total:': 'Всего:',
  Previous: 'Назад',
  Next: 'Далее',
  'Publish setting saved.': 'Настройки публикации сохранены.',
  'Loading stored mail…': 'Загрузка сохранённых писем…',
  ID: 'ID',
  Hash: 'Хеш',
  Size: 'Размер',
  Payment: 'Платёж',
  Date: 'Дата',
  Action: 'Действие',
  Sender: 'Отправитель',
  Receiver: 'Получатель',
  Asset: 'Актив',
  'View hashes': 'Показать хеши',
  Content: 'Содержимое',
  PaymentTx: 'Транзакция платежа',
  AssetTx: 'Транзакция актива',
  Created: 'Создано',
  Download: 'Скачано',
  'N/A': 'Нет данных',
  Delete: 'Удалить',
  'Delete mail {id}': 'Удалить письмо {id}',
  'No matching mail.': 'Подходящих писем нет.',
  'No mails stored yet.': 'Сохранённых писем пока нет.',
  Page: 'Страница',
  'of {count}': 'из {count}',
  Free: 'Бесплатно',
  Dividend: 'Дивиденды',
  'Net Profit': 'Чистая прибыль',
  'Choose an SVG file.': 'Выберите SVG-файл.',
  'SVG template must be at most 5 MB.': 'Размер SVG-шаблона не должен превышать 5 МБ.',
  'Invalid SVG document.': 'Некорректный SVG-документ.',
  'The SVG file must contain {fields}': 'SVG-файл должен содержать {fields}',
  ' or ': ' или ',
  'Node data is updating. Please wait before submitting a transaction.':
    'Данные узла обновляются. Дождитесь завершения перед отправкой транзакции.',
  'Node state could not be verified. Refresh the node data before submitting a transaction.':
    'Не удалось проверить состояние узла. Обновите данные перед отправкой транзакции.',
  'Operation failed.': 'Операция не удалась.',
  'Recharge Node': 'Пополнить узел',
  Recharge: 'Пополнить',
  'Node recharge': 'Пополнение узла',
  'Send funds to this node address.': 'Отправьте средства на этот адрес узла.',
  'Network:': 'Сеть:',
  'Use the matching network in your wallet.': 'Выберите соответствующую сеть в кошельке.',
  'Insufficient balance. Recharge the node first.': 'Недостаточно средств. Сначала пополните узел.',
  'Acquire Server Node NFT': 'Получить NFT сервисного узла',
  'The node wallet will pay {cost} and own this NFT.': 'Кошелёк узла оплатит {cost} и станет владельцем этого NFT.',
  'Request accepted. Refresh to verify on-chain state.':
    'Запрос принят. Обновите данные для проверки состояния в сети.',
  'Stake Node NFT': 'Внести NFT узла в стейк',
  'Revoke Stake': 'Отозвать стейк',
  'Claim Stake': 'Забрать стейк',
  'Revoke the staked tokens? A waiting period applies before claiming.':
    'Отозвать токены из стейка? Перед получением нужно выждать установленный срок.',
  'Submit this operation using the node wallet?': 'Отправить эту операцию из кошелька узла?',
  'Template could not be loaded.': 'Не удалось загрузить шаблон.',
  'Clean {type} cache': 'Очистить кеш: {type}',
  'Remove cached publish settings for this list? On-chain NFTs remain.':
    'Удалить кеш настроек публикации для этого списка? NFT в сети сохранятся.',
  'Cache cleaned.': 'Кеш очищен.',
  'Delete Mail': 'Удалить письмо',
  'Delete mail {id} and its encrypted content? This action cannot be undone.':
    'Удалить письмо {id} и его зашифрованное содержимое? Это действие нельзя отменить.',
  'Mail deleted.': 'Письмо удалено.',
  'Select a valid SVG template.': 'Выберите корректный SVG-шаблон.',
  'Enter a valid page or page size.': 'Введите корректный номер или размер страницы.',
  'Enter positive file limits and a price in whole wei.':
    'Введите положительные ограничения файлов и цену в целых wei.',
  'Attachment policy saved successfully.': 'Политика вложений сохранена.',
  'Enter an integer stake amount within the node balance.': 'Введите целую сумму стейка в пределах баланса узла.',
  'Add {amount} tokens to the node stake?': 'Добавить {amount} токенов в стейк узла?',
  'Name must be 5–80 characters; description must be 1–50 characters.':
    'Название должно содержать 5–80 символов, описание — 1–50 символов.',
  'Price must be at least 0.001.': 'Цена должна быть не меньше 0.001.',
  'Retention must be a non-negative integer.': 'Срок хранения должен быть целым неотрицательным числом.',
  'Insufficient or unavailable node balance.': 'Баланс узла недостаточен или недоступен.',
  'Create {type} Factory': 'Создать фабрику: {type}',
  'The node wallet will pay the factory acquisition cost: {cost}.':
    'Кошелёк узла оплатит стоимость получения фабрики: {cost}.',
  Create: 'Создать',
  'Factory created successfully.': 'Фабрика создана.',
  'Enter a valid token amount.': 'Введите корректное количество токенов.',
  'Use at most {precision} decimal places.': 'Используйте не более {precision} знаков после запятой.',
  'Invalid API response ({status}).': 'Некорректный ответ API ({status}).',
  'Request failed ({status}).': 'Ошибка запроса ({status}).',
  'The operation was aborted due to timeout': 'Операция прервана по тайм-ауту.',
  'Failed to fetch': 'Не удалось выполнить сетевой запрос. Проверьте соединение и повторите попытку.',
};

return {"default": defaultExport};
})();

// ---- admin-i18n.js ----
modules["admin-i18n.js"] = (() => {

const {resolveLocale} = modules["locales.js"];

const zh = modules["locales/admin-zh.js"].default;

const ar = modules["locales/admin-ar.js"].default;

const ja = modules["locales/admin-ja.js"].default;

const ru = modules["locales/admin-ru.js"].default;

const dictionaries = { zh, ar, ja, ru };
// English source keys are the fallback; replacements run once, then the UI
// escapes at the HTML sink. Chain names, user input and payloads are not keys.
 function adminTranslator(locale) {
  const dictionary = dictionaries[resolveLocale(locale)] || {};
  const translate = (key, values = {}) =>
    String(Object.hasOwn(dictionary, key) ? dictionary[key] : key).replace(/\{(\w+)\}/g, (match, name) =>
      Object.hasOwn(values, name) ? String(values[name]) : match,
    );
  return Object.assign(translate, { locale: resolveLocale(locale) });
}
 function adminError(locale, error) {
  const t = adminTranslator(locale);
  const message = error?.message || String(error || 'Operation failed.');
  if (error?.diagnostic) {
    const detail = error.diagnostic;
    return t('Node balance unavailable ({code}; {stage}; {path}).', {
      code: [detail.code, detail.reason, detail.httpStatus].filter(Boolean).join(' / '),
      stage: t(detail.stage || 'chain'),
      path: detail.path || '/api/account/state',
    });
  }
  for (const [pattern, key, name] of [
    [/^Use at most (\d+) decimal places\.$/, 'Use at most {precision} decimal places.', 'precision'],
    [/^Invalid API response \((\d+)\)\.$/, 'Invalid API response ({status}).', 'status'],
    [/^Request failed \((\d+)\)\.$/, 'Request failed ({status}).', 'status'],
  ]) {
    const hit = message.match(pattern);
    if (hit) return t(key, { [name]: hit[1] });
  }
  return error?.name === 'TimeoutError' ? t('The operation was aborted due to timeout') : t(message);
}

return {"adminTranslator": adminTranslator, "adminError": adminError};
})();

// ---- templates.js ----
modules["templates.js"] = (() => {
const envelope = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" width=\"100%\" height=\"100%\" viewBox=\"0 0 634 400\">\n<style type=\"text/css\">\n    .c1, .c2, .c3 {\n        fill: none;\n        stroke: #172080;\n        stroke-linecap: square;\n    }\n    .c1 {\n        opacity: 0.6;\n        stroke-width: 15;\n        stroke-miterlimit: 8;\n    }\n    .c2 {\n        opacity: 0.5;\n        stroke-width: 20;\n        stroke-miterlimit: 10;\n    }\n    .c3 {\n        opacity: 0.3;\n        stroke-width: 30;\n        stroke-miterlimit: 12;\n    }\n    .st12 {\n        font-size: 32px;\n        font-family: 'Arial-BoldMT';\n        fill: #172080;\n        opacity: 0.9;\n    }\n    .st17 {\n        font-size: 26px;\n    }\n    .st18 {\n        font-size: 18px;\n    }\n    .st19 {\n        font-size: 20px;\n        font-weight: 500;\n    }\n    .st20 {\n        font-size: 16px;\n        font-weight: bold;\n        font-family: 'Verdana', Courier, monospace;\n        fill: #172080;\n        opacity: 0.4;\n    }\n</style>\n<rect x=\"0\" y=\"0\" width=\"633\" height=\"399\" fill=\"white\"/>\n<rect x=\"6\" y=\"6\" width=\"624\" height=\"390\" fill=\"none\" stroke=\"#403d84\" stroke-width=\"12\" stroke-dasharray=\"48,12\" stroke-linecap=\"butt\" />\n<rect x=\"4\" y=\"4\" width=\"626\" height=\"392\" fill=\"none\" stroke=\"#ef574c\" stroke-width=\"8\" stroke-dasharray=\"24,36\" stroke-dashoffset=\"36\" stroke-linecap=\"butt\"/>\n<g>\n    <circle class=\"c1\" cx=\"580\" cy=\"350\" r=\"100\"/>\n    <circle class=\"c2\" cx=\"580\" cy=\"350\" r=\"130\"/>\n    <circle class=\"c3\" cx=\"580\" cy=\"350\" r=\"160\"/>  \n    <text x=\"500\" y=\"380\" class=\"st12\">DIDMail</text> \n</g>\n <g>      \n    <text x=\"50\" y=\"100\" class=\"st17\">SUBJECT</text>\n    <text x=\"50\" y=\"130\" class=\"st19\">{{mail.subject}}</text>\n</g>\n<g>\n    <text x=\"50\" y=\"180\" class=\"st18\">SENDER</text>\n    <text x=\"50\" y=\"210\" class=\"st19\">{{mail.sender}}</text>\n</g>\n<g>\n    <text x=\"50\" y=\"250\" class=\"st18\">Creation Date</text>\n    <text x=\"50\" y=\"280\" class=\"st19\">{{mail.createdAt}}</text>\n</g>\n<g>\n    <text x=\"50\" y=\"320\" class=\"st18\">Expiration Date</text>\n    <text x=\"50\" y=\"350\" class=\"st19\">{{mail.expiredAt}}</text>\n</g>\n<g>\n    <text x=\"430\" y=\"40\" class=\"st20\">Power By ArcBlock</text>\n</g>\n</svg>\n";
const loveCard = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"a\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 634 400\">\n\t<style>\t\n\t\t.white {\t\t\t\n\t\t\tfill: #ffffff;\n\t\t}\n\t\t.text-xl {\n\t\t\tfont-size: 18px;\n\t\t\tfont-weight: bold;\n\t\t}\n\t\t.text-lg {\n\t\t\tfont-size: 16px;\t\t\n\t\t}\n\t</style>\n\t<defs>\n\t\t<linearGradient id=\"b\" x1=\"0\" y1=\"200\" x2=\"634\" y2=\"200\" gradientUnits=\"userSpaceOnUse\">\n\t\t\t<stop offset=\"0\" stop-color=\"#67DFDC\"/>\n\t\t\t<stop offset=\"0.3\" stop-color=\"#29a7d9\"/>\n\t\t\t<stop offset=\"0.5\" stop-color=\"#7f95e3\"/>\n\t\t\t<stop offset=\"1\" stop-color=\"#fe8c92\"/>\n\t\t</linearGradient>\n\t</defs>\n\t<rect x=\"0\" y=\"0\" width=\"634\" height=\"400\" rx=\"20\" ry=\"20\" style=\"fill:url(#b);\"/>\n\t<line x1=\"20\" y1=\"60\" x2=\"614\" y2=\"60\" opacity=\"0.4\" stroke=\"#fff\" stroke-width=\"1\" />\n\t<path id=\"love\"\n    d=\"M 10,30\n           A 20,20 0,0,1 50,30\n           A 20,20 0,0,1 90,30\n           Q 90,60 50,90\n           Q 10,60 10,30 z\" fill=\"#ffffff\" opacity=\"1\" transform=\"translate(-90, 10) rotate(5)\"/>\n\t<use xlink:href=\"#love\" transform=\"translate(650, 100) rotate(30) scale(1.1)\" opacity=\"0.3\" />\n\t<use xlink:href=\"#love\" transform=\"translate(250, 200) rotate(10) scale(0.9)\" opacity=\"0.4\" />\n\t<use xlink:href=\"#love\" transform=\"translate(450, 300) rotate(-10) scale(0.6)\" opacity=\"0.2\" />\n\t<use xlink:href=\"#love\" transform=\"translate(400, 40) rotate(-20) scale(0.8)\" opacity=\"0.3\" />\n\t<use xlink:href=\"#love\" transform=\"translate(500, 200) rotate(-15) scale(0.4)\" opacity=\"0.6\" />\n\t<use xlink:href=\"#love\" transform=\"translate(200, 250) rotate(15) scale(1.3)\" opacity=\"0.4\" />\n\t<g>      \n    <text transform=\"matrix(1 0 0 1 50 100)\" class=\"white\" font-size=\"20px\" font-weight=\"bold\">SUBJECT</text>\n    <text transform=\"matrix(1 0 0 1 50 130)\" class=\"white\" font-size=\"24px\" font-weight=\"bold\">{{mail.subject}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 180)\" class=\"white text-lg\">SENDER</text>\n    \t<text transform=\"matrix(1 0 0 1 50 200)\" class=\"white text-xl\">{{mail.sender}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 250)\" class=\"white text-lg\">Creation Date</text>\n    <text transform=\"matrix(1 0 0 1 50 270)\" class=\"white text-xl\">{{mail.createdAt}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 320)\" class=\"white text-lg\">Expiration Date</text>\n    <text transform=\"matrix(1 0 0 1 50 340)\" class=\"white text-xl\">{{mail.expiredAt}}</text>\n</g>\n<text transform=\"matrix(1 0 0 1 500 50)\" font-size=\"24px\" font-weight=\"bold\" fill=\"#ffffff\">DIDMail</text> \n<text transform=\"matrix(1 0 0 1 400 380)\" class=\"white\" font-size=\"20px\" opacity=\"0.8\">Power By ArcBlock</text>\n</svg>\n";
const pigCard = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"a\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 634 400\">\n\t<style>\t\n\t\t.white {\t\t\t\n\t\t\tfill: #ffffff;\n\t\t}\n\t\t.text-xl {\n\t\t\tfont-size: 18px;\n\t\t\tfont-weight: bold;\n\t\t}\n\t\t.text-lg {\n\t\t\tfont-size: 16px;\t\t\n\t\t}\n\t</style>\n\t<defs>\n\t\t<linearGradient id=\"b\" x1=\"0\" y1=\"200\" x2=\"634\" y2=\"200\" gradientUnits=\"userSpaceOnUse\" gradientTransform=\"rotate(5)\">\n            <stop offset=\"0\" stop-color=\"#ec4646\"/> <!-- Hot Pink -->            \n\t\t\t<stop offset=\"0.7\" stop-color=\"#ff9900\" /> <!-- Gold -->\t\n            <stop offset=\"1\" stop-color=\"#f9b754\" /> <!-- Gold -->\t\t\t\t            \t\t\t\t\n\t\t</linearGradient>\n\t</defs>\n\t<rect x=\"0\" y=\"0\" width=\"634\" height=\"400\" rx=\"20\" ry=\"20\" style=\"fill:url(#b);\"/>\n    <line x1=\"20\" y1=\"60\" x2=\"614\" y2=\"60\" opacity=\"0.4\" stroke=\"#fff\" stroke-width=\"1\" />\n\t<g transform=\"translate(20, 80)\" opacity=\"0.7\">\n    <!-- Pig's body -->\n    <path d=\"M 500,200\n             m -50,0\n             a 50,50 0 1,0 100,0\n             a 50,50 0 1,0 -100,0\"\n          fill=\"#FFB6C1\" /> <!-- Light Pink -->\n\n    <!-- Pig's left ear -->\n    <path d=\"M 470,170\n             Q 460,150 480,150\n             Q 490,150 480,170 Z\"\n          fill=\"#FFB6C1\" />\n\n    <!-- Pig's right ear -->\n    <path d=\"M 530,170\n             Q 540,150 520,150\n             Q 510,150 520,170 Z\"\n          fill=\"#FFB6C1\" />\n\n    <!-- Pig's left eye -->\n    <circle cx=\"485\" cy=\"190\" r=\"6\" fill=\"#000\" />\n\n    <!-- Pig's right eye -->\n    <circle cx=\"515\" cy=\"190\" r=\"6\" fill=\"#000\" />\n\n    <!-- Pig's snout -->\n    <ellipse cx=\"500\" cy=\"210\" rx=\"15\" ry=\"10\" fill=\"#FFCCCC\" />\n\n    <!-- Pig's nostrils -->\n    <circle cx=\"495\" cy=\"210\" r=\"3\" fill=\"#000\" opacity=\"0.6\" />\n    <circle cx=\"505\" cy=\"210\" r=\"3\" fill=\"#000\" opacity=\"0.6\" />\n\n    <!-- Pig's smile -->\n    <path d=\"M 490,220\n             Q 500,230 510,220\"\n          stroke=\"#000\" stroke-width=\"2\" fill=\"none\" opacity=\"0.7\" transform=\"translate(0, 4)\" />\n    </g>\n\t\t\t\t\t \n\t<g>      \n    <text transform=\"matrix(1 0 0 1 50 100)\" class=\"white\" font-size=\"20px\" font-weight=\"bold\">SUBJECT</text>\n    <text transform=\"matrix(1 0 0 1 50 130)\" class=\"white\" font-size=\"24px\" font-weight=\"bold\">{{mail.subject}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 180)\" class=\"white text-lg\">SENDER</text>\n    \t<text transform=\"matrix(1 0 0 1 50 200)\" class=\"white text-xl\">{{mail.sender}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 250)\" class=\"white text-lg\">Creation Date</text>\n    <text transform=\"matrix(1 0 0 1 50 270)\" class=\"white text-xl\">{{mail.createdAt}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 320)\" class=\"white text-lg\">Expiration Date</text>\n    <text transform=\"matrix(1 0 0 1 50 340)\" class=\"white text-xl\">{{mail.expiredAt}}</text>\n</g>\n<text transform=\"matrix(1 0 0 1 500 50)\" font-size=\"24px\" font-weight=\"bold\" fill=\"#ffffff\">DIDMail</text> \n<text transform=\"matrix(1 0 0 1 400 380)\" class=\"white\" font-size=\"20px\" opacity=\"0.8\">Power By ArcBlock</text>\n</svg>\n";
const businessCard = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"a\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 634 400\">\n\t<style>\t\t\t\n    .gold {\n      fill: #ffd700;\n      font-family: 'Arial', sans-serif;\n    }\n\t\t.text-xl {\n\t\t\tfont-size: 18px;\t\t\t\n\t\t}\n\t\t.text-lg {\n\t\t\tfont-size: 16px;\t\t\n\t\t}\n\t</style>\n\t<defs>\n\t\t<linearGradient id=\"b\" x1=\"0\" y1=\"200\" x2=\"634\" y2=\"200\" gradientUnits=\"userSpaceOnUse\" gradientTransform=\"rotate(15)\">\n\t\t\t<stop offset=\"0\" stop-color=\"#131414\"/>\n\t\t\t<stop offset=\"0.5\" stop-color=\"#2a3032\"/>\n\t\t\t<stop offset=\"0.9\" stop-color=\"#0c0f1d\"/>\n\t\t\t<stop offset=\"1\" stop-color=\"#130102\"/>\n\t\t</linearGradient>\n    <filter id=\"textShadow\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\">\n        <feDropShadow dx=\"2\" dy=\"2\" stdDeviation=\"2\" flood-color=\"#fff\" flood-opacity=\"0.9\"/>\n    </filter>\n\t</defs>\n\t<rect x=\"0\" y=\"0\" width=\"634\" height=\"400\" rx=\"20\" ry=\"20\" style=\"fill:url(#b);\"/>\t\n  <line x1=\"20\" y1=\"60\" x2=\"614\" y2=\"60\" opacity=\"0.8\" stroke=\"#fff\" stroke-width=\"1\" />\n\t<g>      \n    <text transform=\"matrix(1 0 0 1 50 100)\" class=\"gold\" font-size=\"20px\" font-weight=\"bold\">SUBJECT</text>\n    <text transform=\"matrix(1 0 0 1 50 130)\" class=\"gold\" font-size=\"24px\" font-weight=\"bold\">{{mail.subject}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 180)\" class=\"gold text-lg\">SENDER</text>\n    \t<text transform=\"matrix(1 0 0 1 50 200)\" class=\"gold text-xl\">{{mail.sender}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 250)\" class=\"gold text-lg\">Creation Date</text>\n    <text transform=\"matrix(1 0 0 1 50 270)\" class=\"gold text-xl\">{{mail.createdAt}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 320)\" class=\"gold text-lg\">Expiration Date</text>\n    <text transform=\"matrix(1 0 0 1 50 340)\" class=\"gold text-xl\">{{mail.expiredAt}}</text>\n</g>\n<text transform=\"matrix(1 0 0 1 500 50)\" font-size=\"24px\" font-weight=\"bold\" class=\"gold\">DIDMail</text> \n<text transform=\"matrix(1 0 0 1 430 380)\" class=\"gold\" font-size=\"18px\" opacity=\"0.5\" filter=\"url(#textShadow)\">Power By ArcBlock</text>\n</svg>\n";
const festivalCard = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg id=\"a\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" viewBox=\"0 0 634 400\">\n\t<style>\t\t\t\n    .gold {\n      fill: #ffffff;\n      font-family: 'Arial', sans-serif;\n    }\n\t\t.text-xl {\n\t\t\tfont-size: 18px;\t\t\t\n\t\t}\n\t\t.text-lg {\n\t\t\tfont-size: 16px;\t\t\n\t\t}\n\t</style>\n\t<defs>\n\t\t<linearGradient id=\"b\" x1=\"0\" y1=\"200\" x2=\"634\" y2=\"200\" gradientUnits=\"userSpaceOnUse\" gradientTransform=\"rotate(15)\">\n\t\t\t<stop offset=\"0\" stop-color=\"#f90202\"/>\n\t\t\t<stop offset=\"0.5\" stop-color=\"#dc1919\"/>\n\t\t\t<stop offset=\"0.9\" stop-color=\"#cf2626\"/>\n\t\t\t<stop offset=\"1\" stop-color=\"#cb020c\"/>\n\t\t</linearGradient>\n    <filter id=\"textShadow\" x=\"-50%\" y=\"-50%\" width=\"200%\" height=\"200%\">\n        <feDropShadow dx=\"2\" dy=\"2\" stdDeviation=\"2\" flood-color=\"#d3ee23\" flood-opacity=\"0.9\"/>\n    </filter>\n\t</defs>\n\t<rect x=\"0\" y=\"0\" width=\"634\" height=\"400\" rx=\"20\" ry=\"20\" style=\"fill:url(#b);\"/>\t\n  <line x1=\"20\" y1=\"60\" x2=\"614\" y2=\"60\" opacity=\"0.9\" stroke=\"#f5cece\" stroke-width=\"1\" />\n\t<g>      \n    <text transform=\"matrix(1 0 0 1 50 100)\" class=\"gold\" font-size=\"20px\" font-weight=\"bold\">SUBJECT</text>\n    <text transform=\"matrix(1 0 0 1 50 130)\" class=\"gold\" font-size=\"24px\" font-weight=\"bold\">{{mail.subject}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 180)\" class=\"gold text-lg\">SENDER</text>\n    \t<text transform=\"matrix(1 0 0 1 50 200)\" class=\"gold text-xl\">{{mail.sender}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 250)\" class=\"gold text-lg\">Creation Date</text>\n    <text transform=\"matrix(1 0 0 1 50 270)\" class=\"gold text-xl\">{{mail.createdAt}}</text>\n</g>\n<g>\n    <text transform=\"matrix(1 0 0 1 50 320)\" class=\"gold text-lg\">Expiration Date</text>\n    <text transform=\"matrix(1 0 0 1 50 340)\" class=\"gold text-xl\">{{mail.expiredAt}}</text>\n</g>\n<text transform=\"matrix(1 0 0 1 500 50)\" font-size=\"24px\" font-weight=\"bold\" class=\"gold\">DIDMail</text> \n<text transform=\"matrix(1 0 0 1 430 380)\" class=\"gold\" font-size=\"18px\" opacity=\"0.8\">Power By ArcBlock</text>\n</svg>\n";
const namecard = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\" viewBox=\"0 0 800 500\">\n  <title>Classic — ivory and charcoal</title>\n  <defs>\n    <linearGradient id=\"ivory\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#fffefb\"/><stop offset=\".6\" stop-color=\"#f7f5f0\"/><stop offset=\"1\" stop-color=\"#eae6dd\"/>\n    </linearGradient>\n    <linearGradient id=\"rule\" gradientUnits=\"userSpaceOnUse\" x1=\"56\" y1=\"108\" x2=\"744\" y2=\"108\">\n      <stop stop-color=\"#b0a28c\"/><stop offset=\"1\" stop-color=\"#ded8ce\"/>\n    </linearGradient>\n    <clipPath id=\"company\"><rect x=\"56\" y=\"46\" width=\"688\" height=\"36\"/></clipPath>\n    <clipPath id=\"name\"><rect x=\"56\" y=\"157\" width=\"688\" height=\"68\"/></clipPath>\n    <clipPath id=\"role\"><rect x=\"56\" y=\"237\" width=\"688\" height=\"34\"/></clipPath>\n    <clipPath id=\"phone\"><rect x=\"56\" y=\"358\" width=\"688\" height=\"32\"/></clipPath>\n    <clipPath id=\"email\"><rect x=\"56\" y=\"405\" width=\"688\" height=\"32\"/></clipPath>\n  </defs>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#ivory)\"/>\n  <rect x=\"1\" y=\"1\" width=\"798\" height=\"498\" rx=\"19\" fill=\"none\" stroke=\"#ffffff\" stroke-opacity=\".8\"/>\n  <path d=\"M56 108h688\" stroke=\"url(#rule)\"/>\n  <path d=\"M56 319h48\" stroke=\"#a5967e\" stroke-width=\"2\"/>\n  <g font-family=\"Inter, Arial, sans-serif\">\n    <text x=\"56\" y=\"73\" font-size=\"20\" font-weight=\"500\" fill=\"#514b42\" clip-path=\"url(#company)\">{{contact.company}}</text>\n    <text x=\"56\" y=\"211\" font-family=\"Georgia, 'Times New Roman', serif\" font-size=\"46\" fill=\"#282823\" clip-path=\"url(#name)\">{{contact.name}}</text>\n    <text x=\"56\" y=\"262\" font-size=\"21\" fill=\"#6b655b\" clip-path=\"url(#role)\">{{contact.position}}</text>\n    <text x=\"56\" y=\"382\" font-size=\"20\" fill=\"#514b42\" clip-path=\"url(#phone)\">{{contact.phone}}</text>\n    <text x=\"56\" y=\"429\" font-size=\"20\" fill=\"#514b42\" clip-path=\"url(#email)\">{{contact.email}}</text>\n  </g>\n</svg>\n";
const executiveCard = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\" viewBox=\"0 0 800 500\">\n  <title>Executive — navy and brass</title>\n  <defs>\n    <linearGradient id=\"navy\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#30465f\"/><stop offset=\".48\" stop-color=\"#172b43\"/><stop offset=\"1\" stop-color=\"#0b1525\"/>\n    </linearGradient>\n    <radialGradient id=\"spotlight\" cx=\".83\" cy=\".08\" r=\".8\">\n      <stop stop-color=\"#d8bc88\" stop-opacity=\".2\"/><stop offset=\"1\" stop-color=\"#d8bc88\" stop-opacity=\"0\"/>\n    </radialGradient>\n    <linearGradient id=\"brass\" x2=\"1\" y2=\".6\">\n      <stop stop-color=\"#a3834b\"/><stop offset=\".45\" stop-color=\"#f5e0ad\"/><stop offset=\"1\" stop-color=\"#bc975b\"/>\n    </linearGradient>\n    <clipPath id=\"company\"><rect x=\"48\" y=\"44\" width=\"620\" height=\"34\"/></clipPath>\n    <clipPath id=\"name\"><rect x=\"48\" y=\"155\" width=\"704\" height=\"70\"/></clipPath>\n    <clipPath id=\"role\"><rect x=\"48\" y=\"232\" width=\"704\" height=\"34\"/></clipPath>\n    <clipPath id=\"phone\"><rect x=\"48\" y=\"351\" width=\"330\" height=\"32\"/></clipPath>\n    <clipPath id=\"email\"><rect x=\"418\" y=\"351\" width=\"334\" height=\"32\"/></clipPath>\n    <clipPath id=\"website\"><rect x=\"48\" y=\"431\" width=\"610\" height=\"30\"/></clipPath>\n  </defs>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#navy)\"/>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#spotlight)\"/>\n  <rect x=\"1\" y=\"1\" width=\"798\" height=\"498\" rx=\"19\" fill=\"none\" stroke=\"#e3cc9c\" stroke-opacity=\".16\"/>\n  <path d=\"M48 114h36\" stroke=\"url(#brass)\" stroke-width=\"3\"/>\n  <path d=\"M700 48v28m12-28v28m12-28v28\" stroke=\"url(#brass)\" stroke-width=\"3\"/>\n  <g font-family=\"Inter, Arial, sans-serif\">\n    <text x=\"48\" y=\"70\" font-size=\"20\" fill=\"#d8bc88\" clip-path=\"url(#company)\">{{contact.company}}</text>\n    <text x=\"48\" y=\"209\" font-size=\"48\" font-weight=\"600\" letter-spacing=\"-1\" fill=\"#f8f4ec\" clip-path=\"url(#name)\">{{contact.name}}</text>\n    <text x=\"48\" y=\"257\" font-size=\"21\" fill=\"#b9c5d3\" clip-path=\"url(#role)\">{{contact.position}}</text>\n    <path d=\"M48 305h704\" stroke=\"#3b4a5c\"/>\n    <text x=\"48\" y=\"338\" font-size=\"10\" letter-spacing=\"2\" fill=\"#d8bc88\">PHONE</text>\n    <text x=\"418\" y=\"338\" font-size=\"10\" letter-spacing=\"2\" fill=\"#d8bc88\">EMAIL</text>\n    <text x=\"48\" y=\"375\" font-size=\"19\" fill=\"#f8f4ec\" clip-path=\"url(#phone)\">{{contact.phone}}</text>\n    <text x=\"418\" y=\"375\" font-size=\"19\" fill=\"#f8f4ec\" clip-path=\"url(#email)\">{{contact.email}}</text>\n    <text x=\"48\" y=\"452\" font-size=\"17\" fill=\"#b9c5d3\" clip-path=\"url(#website)\">{{contact.website}}</text>\n    <text x=\"752\" y=\"452\" text-anchor=\"end\" font-size=\"10\" letter-spacing=\"2\" fill=\"#d8bc88\">DIDMAIL</text>\n  </g>\n</svg>\n";
const techCard = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\" viewBox=\"0 0 800 500\">\n  <title>Tech — mint terminal</title>\n  <defs>\n    <linearGradient id=\"terminal\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#213c36\"/><stop offset=\".5\" stop-color=\"#102422\"/><stop offset=\"1\" stop-color=\"#0a1519\"/>\n    </linearGradient>\n    <radialGradient id=\"mintGlow\" cx=\".85\" cy=\".12\" r=\".85\">\n      <stop stop-color=\"#63e6bd\" stop-opacity=\".22\"/><stop offset=\"1\" stop-color=\"#63e6bd\" stop-opacity=\"0\"/>\n    </radialGradient>\n    <radialGradient id=\"indicator\" cx=\".3\" cy=\".25\" r=\".8\">\n      <stop stop-color=\"#e1ffed\"/><stop offset=\".5\" stop-color=\"#9ee2bb\"/><stop offset=\"1\" stop-color=\"#4e9e7a\"/>\n    </radialGradient>\n    <clipPath id=\"name\"><rect x=\"48\" y=\"142\" width=\"704\" height=\"60\"/></clipPath>\n    <clipPath id=\"role\"><rect x=\"48\" y=\"216\" width=\"704\" height=\"32\"/></clipPath>\n    <clipPath id=\"company\"><rect x=\"48\" y=\"254\" width=\"704\" height=\"30\"/></clipPath>\n    <clipPath id=\"email\"><rect x=\"132\" y=\"327\" width=\"620\" height=\"30\"/></clipPath>\n    <clipPath id=\"phone\"><rect x=\"132\" y=\"367\" width=\"620\" height=\"30\"/></clipPath>\n    <clipPath id=\"website\"><rect x=\"48\" y=\"435\" width=\"590\" height=\"30\"/></clipPath>\n  </defs>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#terminal)\"/>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#mintGlow)\"/>\n  <rect x=\"1\" y=\"1\" width=\"798\" height=\"498\" rx=\"19\" fill=\"none\" stroke=\"#b7e6ca\" stroke-opacity=\".15\"/>\n  <path d=\"M0 90h800\" stroke=\"#2b4140\"/>\n  <circle cx=\"48\" cy=\"46\" r=\"5\" fill=\"url(#indicator)\"/>\n  <circle cx=\"70\" cy=\"46\" r=\"5\" fill=\"#577b6c\"/>\n  <circle cx=\"92\" cy=\"46\" r=\"5\" fill=\"#354c44\"/>\n  <g font-family=\"'SFMono-Regular', Consolas, 'Liberation Mono', monospace\">\n    <text x=\"752\" y=\"51\" text-anchor=\"end\" font-size=\"14\" fill=\"#a9c4b7\">profile.ts</text>\n    <text x=\"48\" y=\"130\" font-size=\"11\" letter-spacing=\"2\" fill=\"#88bd9e\">// HELLO, WORLD</text>\n    <text x=\"48\" y=\"189\" font-size=\"36\" font-weight=\"700\" fill=\"#d4f5e2\" clip-path=\"url(#name)\">{{contact.name}}</text>\n    <text x=\"48\" y=\"239\" font-size=\"19\" fill=\"#9de2b8\" clip-path=\"url(#role)\">{{contact.position}}</text>\n    <text x=\"48\" y=\"277\" font-size=\"16\" fill=\"#a9c4b7\" clip-path=\"url(#company)\">{{contact.company}}</text>\n    <text x=\"48\" y=\"349\" font-size=\"12\" fill=\"#88bd9e\">email:</text>\n    <text x=\"132\" y=\"349\" font-size=\"17\" fill=\"#e0ebe6\" clip-path=\"url(#email)\">{{contact.email}}</text>\n    <text x=\"48\" y=\"389\" font-size=\"12\" fill=\"#88bd9e\">phone:</text>\n    <text x=\"132\" y=\"389\" font-size=\"17\" fill=\"#e0ebe6\" clip-path=\"url(#phone)\">{{contact.phone}}</text>\n    <path d=\"M48 419h704\" stroke=\"#2b4140\"/>\n    <text x=\"48\" y=\"457\" font-size=\"16\" fill=\"#9de2b8\" clip-path=\"url(#website)\">{{contact.website}}</text>\n    <text x=\"752\" y=\"457\" text-anchor=\"end\" font-size=\"14\" fill=\"#88bd9e\">&lt;/&gt;</text>\n  </g>\n</svg>\n";
const creativeCard = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\" viewBox=\"0 0 800 500\">\n  <title>Creative — coral studio</title>\n  <defs>\n    <linearGradient id=\"paper\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#fffaf1\"/><stop offset=\"1\" stop-color=\"#efdfd5\"/>\n    </linearGradient>\n    <linearGradient id=\"coral\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#ffae8a\"/><stop offset=\".5\" stop-color=\"#ef7058\"/><stop offset=\"1\" stop-color=\"#be4558\"/>\n    </linearGradient>\n    <radialGradient id=\"sphere\" cx=\".28\" cy=\".22\" r=\".85\">\n      <stop stop-color=\"#fff4ff\"/><stop offset=\".4\" stop-color=\"#d9c4f0\"/><stop offset=\"1\" stop-color=\"#8b6aa8\"/>\n    </radialGradient>\n    <radialGradient id=\"sphereShadow\">\n      <stop stop-color=\"#69273e\" stop-opacity=\".42\"/><stop offset=\"1\" stop-color=\"#69273e\" stop-opacity=\"0\"/>\n    </radialGradient>\n    <clipPath id=\"card\"><rect width=\"800\" height=\"500\" rx=\"20\"/></clipPath>\n    <clipPath id=\"company\"><rect x=\"44\" y=\"38\" width=\"465\" height=\"36\"/></clipPath>\n    <clipPath id=\"name\"><rect x=\"44\" y=\"152\" width=\"465\" height=\"68\"/></clipPath>\n    <clipPath id=\"role\"><rect x=\"44\" y=\"234\" width=\"465\" height=\"32\"/></clipPath>\n    <clipPath id=\"phone\"><rect x=\"44\" y=\"337\" width=\"465\" height=\"30\"/></clipPath>\n    <clipPath id=\"email\"><rect x=\"44\" y=\"379\" width=\"465\" height=\"30\"/></clipPath>\n    <clipPath id=\"website\"><rect x=\"44\" y=\"441\" width=\"465\" height=\"30\"/></clipPath>\n  </defs>\n  <g clip-path=\"url(#card)\">\n    <rect width=\"800\" height=\"500\" fill=\"url(#paper)\"/>\n    <rect x=\"548\" width=\"252\" height=\"500\" fill=\"url(#coral)\"/>\n    <ellipse cx=\"690\" cy=\"278\" rx=\"98\" ry=\"27\" fill=\"url(#sphereShadow)\"/>\n    <circle cx=\"674\" cy=\"194\" r=\"83\" fill=\"url(#sphere)\"/>\n    <path d=\"M588 294c0-46 38-84 84-84s84 38 84 84-38 84-84 84-84-38-84-84Z\" fill=\"none\" stroke=\"#342b36\" stroke-width=\"2\"/>\n    <path d=\"M588 294h168m-84-84v168\" stroke=\"#342b36\" stroke-width=\"2\"/>\n    <rect x=\"728\" y=\"44\" width=\"28\" height=\"28\" fill=\"#342b36\"/>\n  </g>\n  <g font-family=\"Inter, Arial, sans-serif\" fill=\"#342b36\">\n    <text x=\"44\" y=\"65\" font-size=\"17\" font-weight=\"600\" clip-path=\"url(#company)\">{{contact.company}}</text>\n    <path d=\"M44 112h56\" stroke=\"#ef7058\" stroke-width=\"5\"/>\n    <text x=\"44\" y=\"204\" font-size=\"40\" font-weight=\"800\" letter-spacing=\"-1.5\" clip-path=\"url(#name)\">{{contact.name}}</text>\n    <text x=\"44\" y=\"257\" font-size=\"20\" clip-path=\"url(#role)\">{{contact.position}}</text>\n    <text x=\"44\" y=\"359\" font-size=\"18\" clip-path=\"url(#phone)\">{{contact.phone}}</text>\n    <text x=\"44\" y=\"401\" font-size=\"18\" clip-path=\"url(#email)\">{{contact.email}}</text>\n    <text x=\"44\" y=\"462\" font-size=\"16\" clip-path=\"url(#website)\">{{contact.website}}</text>\n    <text x=\"674\" y=\"458\" text-anchor=\"middle\" font-size=\"10\" letter-spacing=\"3\">DIDMAIL</text>\n  </g>\n</svg>\n";
const consultantCard = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"100%\" height=\"100%\" viewBox=\"0 0 800 500\">\n  <title>Consultant — sage editorial</title>\n  <defs>\n    <linearGradient id=\"sage\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#faf8ed\"/><stop offset=\".5\" stop-color=\"#e9efe2\"/><stop offset=\"1\" stop-color=\"#bfcfbd\"/>\n    </linearGradient>\n    <radialGradient id=\"sunlight\" cx=\".18\" cy=\".05\" r=\".9\">\n      <stop stop-color=\"#fffef3\" stop-opacity=\".85\"/><stop offset=\"1\" stop-color=\"#fffef3\" stop-opacity=\"0\"/>\n    </radialGradient>\n    <linearGradient id=\"leaf\" x2=\"1\" y2=\"1\">\n      <stop stop-color=\"#f6f8ec\"/><stop offset=\"1\" stop-color=\"#9bb396\"/>\n    </linearGradient>\n    <clipPath id=\"company\"><rect x=\"48\" y=\"42\" width=\"580\" height=\"32\"/></clipPath>\n    <clipPath id=\"name\"><rect x=\"48\" y=\"142\" width=\"704\" height=\"65\"/></clipPath>\n    <clipPath id=\"role\"><rect x=\"48\" y=\"221\" width=\"704\" height=\"32\"/></clipPath>\n    <clipPath id=\"location\"><rect x=\"48\" y=\"264\" width=\"704\" height=\"28\"/></clipPath>\n    <clipPath id=\"phone\"><rect x=\"48\" y=\"355\" width=\"320\" height=\"30\"/></clipPath>\n    <clipPath id=\"email\"><rect x=\"418\" y=\"355\" width=\"334\" height=\"30\"/></clipPath>\n    <clipPath id=\"website\"><rect x=\"48\" y=\"435\" width=\"590\" height=\"30\"/></clipPath>\n  </defs>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#sage)\"/>\n  <rect width=\"800\" height=\"500\" rx=\"20\" fill=\"url(#sunlight)\"/>\n  <rect x=\"1\" y=\"1\" width=\"798\" height=\"498\" rx=\"19\" fill=\"none\" stroke=\"#fffdf2\" stroke-opacity=\".6\"/>\n  <g fill=\"none\" stroke=\"#728a72\" stroke-width=\"1.5\">\n    <path d=\"M48 105h704M48 314h704\"/>\n    <ellipse fill=\"url(#leaf)\" cx=\"720\" cy=\"60\" rx=\"13\" ry=\"23\" transform=\"rotate(-35 720 60)\"/>\n    <ellipse fill=\"url(#leaf)\" cx=\"734\" cy=\"60\" rx=\"13\" ry=\"23\" transform=\"rotate(35 734 60)\"/>\n    <path d=\"M727 49v38\"/>\n  </g>\n  <g font-family=\"Inter, Arial, sans-serif\" fill=\"#294736\">\n    <text x=\"48\" y=\"66\" font-size=\"18\" clip-path=\"url(#company)\">{{contact.company}}</text>\n    <text x=\"48\" y=\"194\" font-family=\"Georgia, 'Times New Roman', serif\" font-size=\"43\" clip-path=\"url(#name)\">{{contact.name}}</text>\n    <text x=\"48\" y=\"245\" font-size=\"20\" clip-path=\"url(#role)\">{{contact.position}}</text>\n    <text x=\"48\" y=\"284\" font-size=\"16\" fill=\"#526d59\" clip-path=\"url(#location)\">{{contact.location}}</text>\n    <text x=\"48\" y=\"345\" font-size=\"10\" letter-spacing=\"2\" fill=\"#526d59\">PHONE</text>\n    <text x=\"418\" y=\"345\" font-size=\"10\" letter-spacing=\"2\" fill=\"#526d59\">EMAIL</text>\n    <text x=\"48\" y=\"378\" font-size=\"18\" clip-path=\"url(#phone)\">{{contact.phone}}</text>\n    <text x=\"418\" y=\"378\" font-size=\"18\" clip-path=\"url(#email)\">{{contact.email}}</text>\n    <text x=\"48\" y=\"456\" font-size=\"17\" clip-path=\"url(#website)\">{{contact.website}}</text>\n    <text x=\"752\" y=\"456\" text-anchor=\"end\" font-size=\"10\" letter-spacing=\"2\" fill=\"#526d59\">DIDMAIL</text>\n  </g>\n</svg>\n";
 const templates = {
  envelope: { default: envelope, loveCard, pigCard, businessCard, festivalCard },
  namecard: { default: namecard, executiveCard, techCard, creativeCard, consultantCard },
};

return {"templates": templates};
})();
// Instance configuration transport. ARC authenticates the WebSocket session;
// the browser never supplies a DID, role, token or storage path in action args.
modules["instance-config.js"] = (() => {
  function createInstanceConfigClient({ origin = globalThis.location?.origin, Socket = globalThis.WebSocket, timeoutMs = 10000 } = {}) {
    const rpc = (operation, path, args) => new Promise((resolve, reject) => {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        reject(new Error('Invalid ARC origin')); return;
      }
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      url.pathname = '/'; url.search = '?blocklet=didmail-server'; url.hash = '';
      const socket = new Socket(url.href);
      let sent = false, complete = false;
      const finish = (error, value) => {
        if (complete) return;
        complete = true; clearTimeout(timer);
        socket.close();
        if (error) reject(error); else resolve(value);
      };
      const timer = setTimeout(() => finish(Object.assign(new Error('ARC configuration request timed out'), { status: 503 })), timeoutMs);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ type: 'join_session', blocklet: 'didmail-server', page: 'index' })));
      socket.addEventListener('error', () => finish(Object.assign(new Error('ARC configuration is unavailable'), { status: 503 })));
      socket.addEventListener('close', () => finish(Object.assign(new Error('ARC configuration connection closed'), { status: 503 })));
      socket.addEventListener('message', event => {
        let message;
        try { message = JSON.parse(event.data); } catch { finish(new Error('Invalid ARC response')); return; }
        if (message.type === 'session' && !sent) {
          sent = true;
          socket.send(JSON.stringify({ type: 'afs_' + operation, reqId: 'didmail-config', path, ...(args ? { args } : {}) }));
        }
        if (message.reqId !== 'didmail-config') return;
        if (message.type === 'afs_error') finish(Object.assign(new Error(['AFS_CONFLICT', 'MAIL_POLICY_CONFLICT', 'MAIL_ADMISSION_BUSY'].includes(message.code) ? 'Policy changed or is unavailable. Refresh and review before retrying.' : message.error || message.message || 'ARC configuration request failed'), {
          code: message.code, status: ['AFS_CONFLICT', 'MAIL_POLICY_CONFLICT'].includes(message.code) ? 409 : message.code === 'AFS_FORBIDDEN' ? 403 : /^INVALID_|AFS_VALIDATION_ERROR/.test(message.code) ? 400 : 503,
        }));
        else if (message.type === 'afs_result') finish(null, message.data);
      });
    });
    return {
      async session() {
        const result = await rpc('read', '/didmail-native/session.json');
        const session = JSON.parse(result.content);
        if (typeof session.authenticated !== 'boolean' || (session.authenticated && (!session.user?.did || !session.user?.role))) throw new Error('Invalid ARC session');
        return session;
      },
      async read() {
        const result = await rpc('read', '/didmail-native/attachment-config.json');
        if (typeof result.meta?.version !== 'string' || !result.meta.version) throw new Error('ARC configuration version is unavailable');
        return { config: JSON.parse(result.content), version: result.meta.version };
      },
      async mailPolicy() { return JSON.parse((await rpc('read', '/didmail-native/mail-policy.json')).content); },
      accessList(args) { return rpc('exec', '/didmail-native/.actions/list-access-entries', args); },
      editMailPolicy(args) { return rpc('exec', '/didmail-native/.actions/update-mail-policy', args); },
      updateAccessEntry(args) { return rpc('exec', '/didmail-native/.actions/update-access-entry', args); },
      removeAccessEntry(args) { return rpc('exec', '/didmail-native/.actions/remove-access-entry', args); },
      initializeMailPolicy() { return rpc('exec', '/didmail-native/.actions/initialize-mail-policy', { expectedVersion: '!absent' }); },
      update(version, config) { return rpc('exec', '/didmail-native/.actions/' + (version === '!absent' ? 'initialize' : 'update') + '-attachment-config', { version, config }); },
    };
  }
  const initialMessages = {
    en: 'Configuration has not been initialized. Review and save the initial policy.',
    zh: '配置尚未初始化。请核对并保存初始策略。',
    ar: 'لم تتم تهيئة الإعدادات. راجع السياسة الأولية واحفظها.',
    ja: '設定が初期化されていません。初期ポリシーを確認して保存してください。',
    ru: 'Конфигурация ещё не инициализирована. Проверьте и сохраните начальные настройки.',
  };
  const initializeLabels = { en: 'Initialize mail service policy', zh: '初始化邮件服务策略', ar: 'تهيئة سياسة خدمة البريد', ja: 'メールサービスポリシーを初期化', ru: 'Инициализировать политику почтовой службы' };
  return { createInstanceConfigClient, initialMessage: locale => initialMessages[locale] || initialMessages.en, initializePolicyLabel: locale => initializeLabels[locale] || initializeLabels.en };
})();
globalThis.DIDMailNativeUI = modules;
if (typeof document === "undefined") return;

// ---- node-header.js ----
modules["node-header.js"] = (() => {

const {messages, resolveLocale} = modules["locales.js"];

const {request, accountBalanceText} = modules["shared.js"];

const {nodeStore, closeNodeStore} = modules["node-state.js"];

const locale = resolveLocale(document.documentElement.lang);
const t = messages(locale);
let sessionFlight, headerStore, stopBalance;
let badge, recharge;
function hideBalance(forget = false) {
  if (badge) badge.hidden = true;
  if (recharge) recharge.hidden = true;
  stopBalance?.();
  stopBalance = undefined;
  headerStore = undefined;
  closeNodeStore({ forget });
}
function showBalance(session) {
  if (!document.querySelector('[data-didmail-admin]')) return;
  if (document.querySelector('[data-didmail-admin]:is([data-section="attachment"],[data-section="members"])')) {
    hideBalance(!session.authenticated || !['owner', 'admin'].includes(session.user?.role));
    return;
  }
  const store = nodeStore(session);
  if (!store) {
    hideBalance(true);
    return;
  }
  if (headerStore === store) return;
  stopBalance?.();
  const strip = document.querySelector('.aup-app-header-strip-right');
  if (!strip) return;
  if (!badge) {
    badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'dm-header-balance';
    badge.dataset.nodeBalance = '';
    const label = document.createElement('span');
    label.className = 'dm-header-balance-label';
    label.textContent = t.nodeBalance;
    const value = document.createElement('strong');
    value.className = 'dm-header-balance-value';
    const indicator = document.createElement('span');
    indicator.className = 'dm-header-balance-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    badge.append(label, value, indicator);
    badge.addEventListener('click', () => {
      void headerStore?.read('account', { force: true }).catch(() => {});
    });
    recharge = document.createElement('button');
    recharge.type = 'button';
    recharge.className = 'dm-header-recharge';
    recharge.dataset.nodeRecharge = '';
    recharge.setAttribute('aria-label', t.nodeRecharge);
    recharge.title = t.nodeRecharge;
    recharge.disabled = true;
    recharge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/></svg>';
    recharge.addEventListener('click', () => {
      if (headerStore?.active) document.dispatchEvent(new Event('didmail-node-recharge'));
    });
    strip.prepend(badge, recharge);
  }
  badge.hidden = false;
  recharge.hidden = false;
  headerStore = store;
  stopBalance = store.watch(
    'account',
    (state) => {
      if ([401, 403].includes(state.error?.status)) {
        hideBalance(true);
        const workspace = document.querySelector('[data-workspace]');
        if (workspace) workspace.hidden = true;
        document.dispatchEvent(new Event('didmail-session-ended'));
        return;
      }
      const account = state.data;
      const token = account?.tokens?.find((token) => token.address === session.node?.tokenId) || account?.tokens?.[0];
      const balance = account ? accountBalanceText(token, {
        unavailable: account.chainStatus === 'unavailable',
        knownEmpty: !state.error && ['ready', 'unregistered'].includes(account.chainStatus) && Array.isArray(account.tokens) && account.tokens.length === 0,
        empty: t.noBalance,
      }) : null;
      const value = account ? balance.exact === null ? t.balanceUnavailable : balance.summary : state.error ? t.balanceUnavailable : t.balanceLoading;
      recharge.disabled = !(session.node?.address || account?.address);
      badge.querySelector('strong').textContent = value;
      badge.dataset.stale = String(state.stale || Boolean(state.error));
      badge.setAttribute('aria-busy', String(state.fetching));
      badge.setAttribute('aria-label', `${t.refreshNodeBalance}: ${balance?.exact ?? value}`);
      badge.title = [
        t.nodeBalance,
        balance?.exact,
        session.node?.address,
        session.node?.chainId,
        state.updatedAt ? `${t.balanceUpdatedAt} ${new Date(state.updatedAt).toLocaleTimeString(locale)}` : '',
        state.error ? t.balanceUnavailable : state.stale ? t.cachedNodeBalance : '',
        t.refreshNodeBalance,
      ]
        .filter(Boolean)
        .join(' · ');
    },
  );
}
 function readPageSession() {
  if (!sessionFlight)
    sessionFlight = (document.querySelector('[data-didmail-admin]:is([data-section="attachment"],[data-section="members"])')
      ? modules["instance-config.js"].createInstanceConfigClient().session()
      : request('/api/runtime/session'))
      .then((session) => {
        showBalance(session);
        return session;
      })
      .catch((error) => {
        hideBalance(true);
        throw error;
      })
      .finally(() => {
        sessionFlight = undefined;
      });
  return sessionFlight;
}
// Native ARC logout owns the actual session. Clear display snapshots before the
// browser leaves, and always reverify identity on bfcache restoration.
document.addEventListener(
  'click',
  (event) => {
    const target = event.target.closest('a,button');
    if (
      target?.closest('header.aup-app-header') &&
      /logout|sign.?out/i.test(
        [target.getAttribute('href'), target.getAttribute('onclick'), target.dataset.action, target.textContent].join(
          ' ',
        ),
      )
    )
      hideBalance(true);
  },
  { capture: true },
);
window.addEventListener('pagehide', () => {
  hideBalance();
  const workspace = document.querySelector('[data-workspace]');
  if (workspace) workspace.hidden = true;
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});

return {"readPageSession": readPageSession};
})();

// ---- chrome.js ----
modules["chrome.js"] = (() => {

const {readPageSession} = modules["node-header.js"];

const {installThemeControl} = modules["theme.js"];

const {installBrandMotion} = modules["brand-motion.js"];

const {languages, messages, resolveLocale, localizedPath, localeDirection} = modules["locales.js"];

document.documentElement.setAttribute('data-didmail-ui', '');
const locale = resolveLocale(document.documentElement.lang);
document.documentElement.dir = localeDirection(locale);
const t = messages(locale);
installBrandMotion();
const header = document.querySelector('header.aup-app-header');
if (header) {
  installThemeControl(header, t);
  const strip = header.querySelector('.aup-app-header-strip-right');
  if (strip) {
    const help = document.createElement('a');
    help.className = 'aup-app-header-action dm-header-help';
    help.href = localizedPath('/help', locale);
    help.setAttribute('aria-label', t.help);
    help.title = t.help;
    help.dataset.iconOnly = 'true';
    help.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01"/></svg>';
    if (document.querySelector('[data-didmail-help]')) help.setAttribute('aria-current', 'page');
    const admin = document.createElement('a');
    admin.className = 'aup-app-header-action dm-header-admin';
    admin.href = localizedPath('/admin', locale);
    admin.setAttribute('aria-label', t.admin);
    admin.title = t.admin;
    admin.dataset.iconOnly = 'true';
    admin.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
    if (document.querySelector('[data-didmail-admin]')) admin.setAttribute('aria-current', 'page');
    const user = strip.querySelector('[data-action-kind="user-menu"]');
    strip.insertBefore(help, user?.closest('.aup-app-header-user-menu') || user || null);
    strip.insertBefore(admin, user?.closest('.aup-app-header-user-menu') || user || null);
  }
  const brand = header.querySelector('.aup-app-header-brand-link');
  if (brand) brand.setAttribute('aria-label', t.brandHome);
  const labels = [
    ['[data-role="locale-switcher"] > button', t.language],
    ['.aup-app-header-user-menu-login', t.login],
  ];
  for (const [selector, label] of labels) {
    const button = header.querySelector(selector);
    if (button) {
      button.setAttribute('aria-label', label);
      button.title = label;
    }
  }
  // The SSR menu supplies native click handlers. Add standard dismissal/keyboard
  // behavior without replacing its locale cookie or navigation implementation.
  const picker = header.querySelector('[data-role="locale-switcher"]');
  if (picker) {
    const trigger = picker.querySelector('button');
    const menu = picker.querySelector('[role="menu"]');
    const options = [...menu.querySelectorAll('[role="menuitem"]')];
    options.forEach((option, index) => {
      const code = languages[index]?.code;
      if (code) option.lang = code;
      if (code === locale) option.setAttribute('aria-current', 'true');
    });
    const close = (focus = false) => {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (focus) trigger.focus();
    };
    document.addEventListener('click', (event) => {
      if (!picker.contains(event.target)) close();
    });
    picker.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close(true);
        event.preventDefault();
      }
      if (event.key === 'Tab') {
        setTimeout(() => {
          if (!picker.contains(document.activeElement)) close();
        }, 0);
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const index = options.indexOf(document.activeElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? options.length - 1
              : index < 0
                ? event.key === 'ArrowUp'
                  ? options.length - 1
                  : 0
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
        options[next]?.focus();
      }
    });
  }
}
// Retain the chosen locale when navigating between business pages. The API URLs
// remain unchanged; all data and authorization still use the same endpoints.
for (const a of document.querySelectorAll('.dm-tabs a')) {
  const path = new URL(a.href).pathname;
  if (path.startsWith('/admin/')) a.href = localizedPath(path, locale);
}

if (document.querySelector('[data-didmail-admin]')) void readPageSession().catch(() => {});

// Keep orientation in the long public guide; links and anchors remain native.
const guide = document.querySelector('[data-didmail-help]');
if (guide) {
  const contents = guide.querySelector('.dm-help-toc');
  if (matchMedia('(max-width: 760px)').matches) contents.open = false;
  const links = [...contents.querySelectorAll('a')];
  const sections = [...guide.querySelectorAll('article section')];
  const mark = (id) => {
    for (const link of links) {
      if (link.hash === '#' + id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  };
  mark(sections.find((section) => '#' + section.id === location.hash)?.id || sections[0]?.id);
  const visible = new Map();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.set(entry.target.id, entry.target);
      else visible.delete(entry.target.id);
    }
    const current = [...visible.values()].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0];
    if (current) mark(current.id);
  }, { rootMargin: '-88px 0px -55% 0px' });
  sections.forEach((section) => observer.observe(section));
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
}

return {};
})();

// ---- admin.js ----
modules["admin.js"] = (() => {

const {renderStorageTable, storagePayment, storageFeeDetails} = modules["storage-list.js"];

const {installIdentityUI} = modules["identity.js"];

const {mountMembers} = modules["members.js"];

const {mountMailPolicy} = modules["mail-policy.js"];

const {nodeStore} = modules["node-state.js"];

const {readPageSession} = modules["node-header.js"];


const {resolveLocale, localizedPath} = modules["locales.js"];

const {adminTranslator, adminError} = modules["admin-i18n.js"];

const qrcode = nativeQrcode;

const {templates: templateFiles} = modules["templates.js"];

const {escapeHtml: e, didMarkup, amountText, toUnits, tokenText, accountBalanceText, request, svgSource, assetData, canAfford, loadingMarkup} = modules["shared.js"];


const locale = resolveLocale(document.documentElement.lang);
const t = adminTranslator(locale);
const tokenLabel = (token, empty = t('NO BALANCE')) => tokenText(token, t(empty));
const dateLabel = (value) => new Date(value).toLocaleString(locale);
const errorMessage = (error) => adminError(locale, error);
const app = document.querySelector('[data-didmail-admin]');
if (app && !app.dataset.initialized) {
  app.dataset.initialized = 'true';
  boot(app).catch((error) => {
    app.querySelector('[data-session]').textContent = errorMessage(error);
  });
}
async function boot(root) {
  const $ = (selector) => root.querySelector(selector);
  const section = root.dataset.section;
  installIdentityUI(root, t);
  const content = $('[data-content]');
  const accountBox = $('[data-account]');
  let account, stake, forge, stakeError, accountError, factory, factoryError;
  let accountPending = true,
    stakePending = section === 'server',
    accountFlight,
    store;
  let watching = false;
  let page = 1,
    pageSize = 10,
    search = '',
    cursor = '0';
  let file, previewUrl;
  let purchaseBalanceWarning = false;
  let acquirePending = false;
  let stakeAction = '';
  let ownerSession = false;
  let transferQuote;
  let gasQuote;
  let actionPending = false,
    listVersion = 0;
  const dialog = $('[data-dialog]');
  const tabs = $('.dm-tabs-inner');
  const activeTab = tabs.querySelector('[aria-current="page"]');
  const tabObserver = new ResizeObserver(() => {
    const viewport = tabs.getBoundingClientRect();
    const selected = activeTab.getBoundingClientRect();
    if (selected.left < viewport.left || selected.right > viewport.right) {
      tabs.scrollLeft += selected.left - viewport.left - (viewport.width - selected.width) / 2;
    }
  });
  tabObserver.observe(tabs);
  window.addEventListener('pagehide', () => tabObserver.disconnect(), { once: true });
  const buttonIcons = {
    'refresh-account':
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M20 12a8 8 0 1 1-2.3-5.7L20 9"/></svg>',
    recharge:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><path d="M15 15h3v3h3M15 21v-3M21 15v-3M12 3v3M12 12h3M3 12h3"/></svg>',
  };

  const button = (label, action, attrs = '') =>
    `<button type="button" data-action="${action}" ${stakeAction === action ? 'aria-busy="true"' : ''} ${attrs}>${stakeAction === action ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${buttonIcons[action] || e(label)}</button>`;
  const notice = (message = '', kind = 'error') => {
    purchaseBalanceWarning = kind === 'error' && t(message) === t('Insufficient balance. Recharge the node first.');
    $('[data-notice]').innerHTML = message
      ? `<div class="dm-alert" data-kind="${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${e(t(message))}</div>`
      : '';
  };
  const localError = (box, error, retry) => {
    box.innerHTML = `<div class="dm-alert" role="alert">${e(errorMessage(error))} ${retry ? button(t('Retry'), retry, 'class="dm-secondary dm-retry"') : ''}</div>`;
  };
  const fields = (pairs, { full = false } = {}) =>
    `<dl class="dm-fields">${pairs.map(([name, value]) => `<div><dt>${e(name)}</dt><dd>${didMarkup(value, t, { full })}</dd></div>`).join('')}</dl>`;
  function showDialog(title, html, confirmLabel, { wallet = false } = {}) {
    if (dialog.open) dialog.close();
    dialog.classList.toggle('dm-wallet-dialog', wallet);
    $('[data-dialog-body]').innerHTML =
      `<h2 id="dm-dialog-title">${e(title)}</h2>${html}${wallet && !confirmLabel ? `<button type="button" data-dialog-close class="dm-dialog-close" aria-label="${e(t('Close'))}" title="${e(t('Close'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>` : `<div class="dm-actions"><button type="button" data-dialog-close class="dm-secondary">${confirmLabel ? t('Cancel') : t('Close')}</button>${confirmLabel ? `<button type="button" data-dialog-confirm>${e(confirmLabel)}</button>` : ''}</div>`}`;
    const result = new Promise((resolve) => {
      const close = () => dialog.close('cancel');
      $('[data-dialog-close]').onclick = close;
      if (confirmLabel) $('[data-dialog-confirm]').onclick = () => dialog.close('confirm');
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
    // Native dialogs retain returnValue between openings. Escape must never
    // reuse a previous confirmation.
    dialog.returnValue = 'cancel';
    dialog.showModal();
    // A confirmation starts on its safe action, after the terms remain available
    // to screen readers and keyboard users in the dialog's reading order.
    if (confirmLabel) $('[data-dialog-close]').focus();
    return result;
  }
  const loginHref = () =>
    `/.well-known/service/login?return_to=${encodeURIComponent(location.pathname + location.search)}`;
  async function loadSession() {
    $('[data-session]').innerHTML = loadingMarkup(t('Checking ARC session…'), 2);
    try {
      const session = await readPageSession();
      if (!session.authenticated || !session.user) {
        $('[data-session]').innerHTML =
          `<div class="dm-empty"><h1>${e(t('DIDMail Admin'))}</h1><p>${e(t('Sign in to manage your server node.'))}</p><p><a class="dm-button" href="${loginHref()}">${e(t('Sign in with ARC'))}</a></p></div>`;
        return;
      }
      if (!['owner', 'admin'].includes(session.user.role)) {
        $('[data-session]').innerHTML =
          `<p class="dm-empty" role="alert">${e(t('Permission denied: Only owner or admin can access this page, current role is {role}', { role: t(session.user.role) }))}</p>`;
        return;
      }
      $('[data-session]').innerHTML = '';
      $('[data-workspace]').hidden = false;
      ownerSession = session.user.role === 'owner';
      store = ['attachment', 'members'].includes(section) ? null : nodeStore(session);
      if (!['attachment','members'].includes(section)) watchNodeState();
      await Promise.all([['attachment','members'].includes(section) ? undefined : loadAccount({ force: false }), loadSection()]);
    } catch (error) {
      localError($('[data-session]'), error, 'session-retry');
    }
  }
  function watchNodeState() {
    if (watching) return;
    watching = true;
    const update = () => {
      if (purchaseBalanceWarning && !accountPending && !accountError && account
        && account.chainStatus !== 'unavailable' && canAfford(account.tokens, factory?.token)) notice();
      renderAccount();
      syncTransactionControls();
      if (section === 'server') renderServer();
      if (section === 'storage') updateMailCurrency();
      if (['envelope', 'namecard'].includes(section)) updateTemplateCost();
      accountBox?.setAttribute('aria-busy', String(accountPending || stakePending));
    };
    store.watch('account', (state) => {
      account =
        state.data ||
        (state.error && store.node ? { ...store.node, chainStatus: 'unavailable', tokens: [] } : undefined);
      accountError = state.error;
      accountPending = state.fetching || (!state.data && !state.error);
      update();
    });
    if (section === 'server')
      store.watch(
        'stake',
        (state) => {
          stake = state.data;
          stakeError = state.error;
          stakePending = state.fetching || (!state.data && !state.error);
          update();
        },
      );
    store.watch('forge', (state) => {
      forge = state.data;
      update();
    });
  }
  function loadAccount({ force = true } = {}) {
    if (accountFlight) return accountFlight;
    accountFlight = Promise.allSettled([
      store.read('account', { force }),
      ...(section === 'server' ? [store.read('stake', { force })] : []),
    ]).finally(() => {
      accountFlight = null;
    });
    return accountFlight;
  }
  function nodeToken() {
    return account?.tokens?.find((t) => t.symbol === forge?.token?.symbol) || account?.tokens?.[0];
  }
  function renderAccount() {
    if (!accountBox) return;
    if (!account && accountPending) {
      accountBox.innerHTML = loadingMarkup(t('Loading node account…'));
      return;
    }
    const unknown = !account || Boolean(accountError) || account.chainStatus === 'unavailable';
    const refreshing = accountPending || stakePending;
    const symbol = forge?.token?.symbol;
    const issue = unknown || Boolean(stakeError);
    const diagnostics = [accountError, stakeError].filter(Boolean).map(errorMessage);
    const empty = symbol ? `0 ${symbol}` : '0';
    const unavailable = `<span aria-label="${e(t('Unavailable'))}" title="${e(t('Unavailable'))}">—</span>`;
    const balance = accountBalanceText(nodeToken(), {
      unavailable: unknown,
      knownEmpty: !unknown && ['ready', 'unregistered'].includes(account?.chainStatus) && Array.isArray(account.tokens) && account.tokens.length === 0,
      empty,
    });
    const detailsOpen = accountBox.querySelector('[data-balance-exact]')?.open === true;
    const metric = balance.exact === null ? unavailable : e(balance.summary);
    const exactDetails = balance.exact === null ? '' : `<details class="dm-account-balance-details" data-balance-exact${detailsOpen ? ' open' : ''}><summary aria-label="${e(t('Details'))}: ${e(t('Available balance'))}">${e(t('Details'))}</summary><span class="dm-account-balance-exact" data-balance-exact-value dir="ltr">${e(balance.exact)}</span></details>`;
    accountBox.innerHTML = `<div class="dm-node-body"><div class="dm-node-identity"><span class="dm-node-moniker">${e(t('Node address'))}</span><span class="dm-node-account-address">${didMarkup(account?.address || store.node?.address, t, { full: true })}</span><span class="dm-node-endpoint">${e(t('Network:'))} ${e(account?.chainId || store.node?.chainId)}</span></div><div class="dm-metrics"><div><span>${e(t('Available balance'))}</span><strong>${metric}</strong>${exactDetails}</div></div>${button('↻', 'refresh-account', `class="dm-secondary" aria-label="${e(t('Refresh node account'))}" aria-busy="${refreshing}" ${refreshing ? 'disabled' : ''}`)}</div>
      ${issue ? `<details class="dm-node-notice"><summary><span role="status">${e(t('Some node data is unavailable'))}</span><span class="dm-node-details-label">${e(t('Details'))}</span></summary><div>${e(diagnostics.join(' · ') || t('Node balance could not be verified.'))}</div></details>` : account?.chainStatus === 'unregistered' ? `<p class="dm-node-notice">${e(t('Recharge on {network} to activate this node.', { network: account.chainId }))}</p>` : ''}`;
    syncTransactionControls();
  }
  async function loadSection() {
    content.innerHTML = loadingMarkup(t('Loading page data…'), 5);
    try {
      if (section === 'account') {
        renderWalletPage();
      } else if (section === 'server') {
        await loadServerFactory();
      } else if (section === 'members') {
        content.innerHTML = '';
        await mountMailPolicy(content, t, 'members');
        await mountMembers(content, t);
      } else if (section === 'attachment') {
        content.innerHTML = '';
        await mountMailPolicy(content, t);
      } else if (section === 'storage') {
        content.innerHTML = `<section class="dm-card dm-storage-summary"><div><span class="dm-small dm-muted">${e(t('Database Used Size:'))}</span><strong data-size>${e(t('Loading…'))}</strong></div>${button(t('Refresh'), 'storage-refresh', 'class="dm-secondary"')}</section><section class="dm-card dm-storage-mails"><div class="dm-storage-toolbar"><h2>${e(t('Mails'))}</h2><form data-search class="dm-storage-search" role="search"><label><span class="dm-visually-hidden">${e(t('Search'))}</span><input type="search" name="search" placeholder="${e(t('Search By ID/Address/Envelope/Hash'))}"></label><button>${e(t('Search'))}</button></form></div><div data-list></div></section>`;
        await Promise.all([loadMails(), loadStorageSize()]);
      } else {
        const title = section === 'envelope' ? t('Envelope') : t('Namecard');
        content.innerHTML = `<div data-template-factory>${loadingMarkup(t('Loading {type} factory…', { type: title }), 5)}</div><section class="dm-template-list"><div class="dm-row dm-template-list-heading"><h2>${e(t('{type} List', { type: title }))}</h2><div class="dm-actions">${button(t('Clean'), 'clean', 'class="dm-secondary"')}${button(t('Refresh'), 'list-refresh', 'class="dm-secondary"')}</div></div><div data-list></div></section>`;
        renderTemplateForm();
        await loadTemplates();
      }
    } catch (error) {
      localError(content, error, 'section-retry');
    }
  }
  async function loadServerFactory({ refresh = false } = {}) {
    factoryError = null;
    renderServer();
    try {
      factory = await request(`/api/servers/factory${refresh ? '?refresh=1' : ''}`);
    } catch (error) {
      factoryError = error;
    }
    renderServer();
  }
  async function showServerFactory() {
    void showDialog(
      t('DIDMail Server Node NFT Factory'),
      `<div data-server-factory-info>${loadingMarkup(t('Loading node factory…'), 5)}</div>`,
    );
    const box = $('[data-server-factory-info]');
    try {
      const result = await request('/api/servers/factory?refresh=1');
      factory = result;
      factoryError = null;
      renderServer();
      const source = svgSource(result.display);
      if (dialog.open && box.isConnected)
        box.innerHTML = `${factoryFields(result)}<h3>${e(t('NFT SVG template'))}</h3>${source ? `<img class="dm-factory-preview" src="${e(source)}" alt="${e(t('Server node NFT SVG template'))}">` : `<p class="dm-muted">${e(t('No SVG template available'))}</p>`}`;
    } catch (error) {
      if (dialog.open && box.isConnected) localError(box, error, 'server-factory-info');
    }
  }
  function syncTransactionControls() {
    const submit = $('[data-template] button[type=submit], [data-template] > button');
    if (submit && !actionPending)
      submit.disabled =
        accountPending ||
        stakePending ||
        Boolean(accountError || stakeError) ||
        !account ||
        account.chainStatus === 'unavailable';
  }
  function updateTemplateCost() {
    const cost = $('[data-template-cost]');
    if (cost) cost.textContent = factory?.token ? tokenLabel(factory.token) : t('Confirmed before creation');
    const currency = $('[data-template-currency]');
    if (currency) currency.textContent = forge?.token?.symbol || factory?.token?.symbol || '';
  }
  async function readTemplateFactory() {
    const result = await request(`/api/${section}/factory`);
    factory = result;
    updateTemplateCost();
    return result;
  }
  async function showTemplateFactory() {
    void showDialog(
      t('{type} Factory', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }),
      `<div data-factory-info>${loadingMarkup(t('Loading {type} factory…', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }), 5)}</div>`,
    );
    const box = $('[data-factory-info]');
    try {
      const result = await readTemplateFactory();
      if (dialog.open && box.isConnected) box.innerHTML = factoryFields(result);
    } catch (error) {
      if (dialog.open && box.isConnected) localError(box, error, 'template-info');
    }
  }
  function showTemplateHelp() {
    const envelope = section === 'envelope';
    const variables = envelope
      ? [
          ['{{mail.subject}}', 'Mail subject, filled by the client after decryption.', true],
          ['{{mail.sender}}', 'Sender DID address.', true],
          ['{{mail.createdAt}}', 'Mail creation time, formatted by the client.', false],
          ['{{mail.expiredAt}}', 'Mail expiration time, formatted by the client.', false],
          ['{{mail.envelope}}', 'Envelope NFT address. Some send previews do not provide this value.', false],
        ]
      : [
          ['{{contact.name}}', 'Contact name.', true],
          ['{{contact.company}}', 'Company or organization.', false],
          ['{{contact.position}}', 'Job title or position.', false],
          ['{{contact.phone}}', 'Phone number.', false],
          ['{{contact.email}}', 'Email address.', false],
          ['{{contact.website}}', 'Website URL.', false],
          ['{{contact.location}}', 'Location.', false],
          ['{{contact.background}}', 'Background or personal introduction.', false],
        ];
    const description = envelope
      ? 'An SVG Envelope template defines the visual cover of a mail NFT. Clients replace the placeholders with mail data when displaying it; the encrypted message content is unchanged.'
      : 'An SVG Namecard template defines the visual appearance of a contact card NFT. Clients replace its placeholders with profile or decrypted contact data when displaying it.';
    const instructions = envelope
      ? 'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; mail.subject and mail.sender are required. Download a sample to edit, then upload it here. The preview shows the template placeholders, not real mail data.'
      : 'Use the exact double-brace variable names. Upload a valid .svg file up to 5 MB; contact.name is required. Download a sample to edit, then upload it here. Values come from the contact fields supplied by the client; missing values render blank. The preview shows placeholders, not real contact data.';

    void showDialog(
      t(envelope ? 'SVG Envelope template' : 'SVG Namecard template'),
      `<div class="dm-template-help"><p>${e(t(description))}</p>
      <h3>${e(t('Supported variables'))}</h3><dl class="dm-template-variables">${variables.map(([name, description, required]) => `<div><dt><code>${e(name)}</code>${required ? ` <span class="dm-small dm-muted">${e(t('Required'))}</span>` : ''}</dt><dd>${e(t(description))}</dd></div>`).join('')}</dl>
      <h3>${e(t('Example'))}</h3><pre><code>${e(envelope ? '<text x="24" y="48">{{mail.subject}}</text>' : '<text x="24" y="48">{{contact.name}}</text>')}</code></pre>
      <p class="dm-small dm-muted">${e(t(instructions))}</p></div>`,
    );
  }
  function factoryFields(f) {
    return fields([
      [t('Name'), f.name],
      [t('Address'), f.address],
      [t('Description'), f.description],
      [t('Limit'), f.limit],
      [t('Minted'), f.minted],
      [t('Created At'), f.created_at ? dateLabel(f.created_at) : '—'],
      [t('Updated At'), f.updated_at ? dateLabel(f.updated_at) : '—'],
      [t('Owned By'), f.owner],
      [t('Price'), amountText(f.price) || tokenLabel(f.token)],
    ]);
  }
  function renderServer() {
    const edits = [...content.querySelectorAll('[data-node-asset] [data-add-stake] input')].map((input) => ({
      asset: input.closest('[data-node-asset]').dataset.nodeAsset,
      value: input.value,
      focused: document.activeElement === input,
    }));
    const acquired = Boolean(stake?.ownerAssets?.length);
    const insufficient = !acquired && factory?.token && account && !accountError && !accountPending
      && account.chainStatus !== 'unavailable' && !canAfford(account.tokens, factory.token);
    content.innerHTML = `<section class="dm-card dm-server-endpoint" data-server-endpoint><h2>${e(t('Server endpoint'))}</h2><div class="dm-row"><code dir="ltr" data-endpoint-url>${e(location.origin)}</code>${button(t('Copy endpoint'), 'copy-endpoint', 'class="dm-secondary"')}</div><p class="dm-small dm-muted">${e(t('Use this endpoint in DIDMail clients. Direct connections do not require a Node NFT.'))}</p><p class="dm-small" data-endpoint-copy role="status" aria-live="polite"></p></section><section class="dm-card" data-server-factory><div class="dm-row"><h2>${e(t('DIDMail Server Node NFT Factory'))}</h2><div class="dm-actions">${button('↻', 'refresh-account', `class="dm-secondary" aria-label="${e(t('Refresh node NFTs'))}" aria-busy="${stakePending}" ${stakePending ? 'disabled' : ''}`)}<button type="button" data-action="server-factory-info" class="dm-secondary dm-factory-info" aria-label="${e(t('Server Node Factory information'))}" title="${e(t('Server Node Factory information'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div></div>
      <p class="dm-muted">${e(t('To successfully become a DIDMail public service node, you need to purchase and stake a node NFT in order to be discovered by the client and appear in the service node list.'))}</p>
      ${factoryError ? `<div class="dm-alert" role="alert">${e(errorMessage(factoryError))} ${button(t('Retry'), 'server-factory-retry', 'class="dm-secondary"')}</div>` : factory ? `${fields([[t('Name'), factory.name], [t('Address'), factory.address], [t('Price'), amountText(factory.price) || tokenLabel(factory.token)]])}<div class="dm-divider dm-row"><span>${e(acquired ? t('Acquired DIDMail server node NFT for stake') : t('Acquire DIDMail server node NFT for stake'))}</span>${insufficient ? `<span class="dm-muted" data-purchase-balance>${e(t('Insufficient balance. Recharge the node first.'))} ${button(t('Node recharge'), 'recharge', `class="dm-secondary" aria-label="${e(t('Node recharge'))}" title="${e(t('Node recharge'))}"`)}</span>` : ''}<button type="button" data-action="acquire" aria-label="${e(acquired ? t('Acquired') : t('Acquire'))}" aria-busy="${acquirePending}" ${acquired || actionPending || accountPending ? 'disabled' : ''}>${acquirePending ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${e(acquirePending ? t('Acquiring…') : acquired ? t('Acquired') : t('Acquire'))}</button></div>` : loadingMarkup(t('Loading node factory…'), 5)}</section>
      ${stakeError ? `<p role="alert">${e(t('Stake information could not be loaded. Refresh the node account to retry.'))}</p>` : !stake ? loadingMarkup(t('Loading node NFTs…')) : !acquired ? `<p class="dm-empty">${e(t('No staked node NFTs yet'))}</p>` : [...new Map(stake.ownerAssets.map((a) => [a.address, a])).values()].map(renderAsset).join('')}`;
    for (const edit of edits) {
      const input = [...content.querySelectorAll('[data-node-asset] [data-add-stake] input')].find(
        (el) => el.closest('[data-node-asset]').dataset.nodeAsset === edit.asset,
      );
      if (input) {
        input.value = edit.value;
        if (edit.focused) input.focus({ preventScroll: true });
      }
    }
  }
  function renderAsset(asset) {
    const data = assetData(asset);
    const staked = stake.assets?.includes(asset.address);
    const revoked = stake.revokedAssets?.includes(asset.address);
    const hasStaked = stake.tokens?.some((t) => BigInt(t.value || 0) > 0n);
    const hasRevoked = stake.revokedTokens?.some((t) => BigInt(t.value || 0) > 0n);
    const waiting = Number(stake.revokeWaitingPeriod ?? (store.node?.chainId === 'main' ? 604800 : 120));
    const dataAttr = `data-asset="${e(asset.address)}"`;
    const unavailable =
      actionPending ||
      accountPending ||
      stakePending ||
      accountError ||
      stakeError ||
      !account ||
      account.chainStatus === 'unavailable';
    return `<section class="dm-card" data-node-asset="${e(asset.address)}"><h2>${e(t('Server Node NFT'))} <span class="dm-badge" data-kind="${staked ? 'success' : revoked ? 'warning' : 'neutral'}">${staked ? t('Staked') : revoked ? t('Revoked') : t('No Stake')}</span></h2><div class="dm-grid"><img class="dm-preview" src="/api/display?assetId=${encodeURIComponent(asset.address)}" alt="${e(t('Server Node NFT'))}"><div>${fields(
      [
        ['NFT', asset.address],
        [t('Stake Address'), stake.address],
        [t('Location'), data.location],
        [t('Revoke Waiting Period'), t('{count} seconds', { count: waiting })],
        ...(!hasStaked && !hasRevoked
          ? [[t('Amount to stake'), `1 ${forge?.token?.symbol || nodeToken()?.symbol || ''}`.trim()]]
          : []),
        ...(hasStaked
          ? [
              [
                t('Staked'),
                stake.tokens
                  .filter((token) => BigInt(token.value || 0) > 0n)
                  .map((token) => tokenLabel(token))
                  .join(', '),
              ],
            ]
          : []),
        ...(hasRevoked
          ? [
              [
                t('Revoked'),
                stake.revokedTokens
                  .filter((token) => BigInt(token.value || 0) > 0n)
                  .map((token) => tokenLabel(token))
                  .join(', '),
              ],
            ]
          : []),
      ],
    )}
      <div class="dm-divider dm-stake-toolbar">
        ${hasStaked ? `<form data-add-stake class="dm-add-stake"><label><span class="dm-stake-input"><input aria-label="${e(t('Additional stake'))}" name="amount" type="number" min="1" step="1" value="1" required ${actionPending ? 'readonly' : ''}><span aria-hidden="true">${e(nodeToken()?.symbol || forge?.token?.symbol || '')}</span></span></label><button type="submit" aria-busy="${stakeAction === 'add'}" ${unavailable ? 'disabled' : ''}>${stakeAction === 'add' ? '<span class="dm-spinner" aria-hidden="true"></span>' : ''}${e(t('Add Stake'))}</button></form>` : ''}
        <div class="dm-actions dm-node-asset-actions">${!hasStaked && !hasRevoked ? button(t('Stake'), 'stake', `${dataAttr} ${staked || unavailable ? 'disabled' : ''}`) : ''}${hasStaked ? button(t('Revoke'), 'revoke', `class="dm-danger" ${unavailable ? 'disabled' : ''}`) : ''}${hasRevoked ? button(t('Claim'), 'claim', unavailable ? 'disabled' : '') : ''}</div>
      </div></div></div>
      ${
        data.endpoint?.replaceAll('&#x2F;', '/') !== location.origin
          ? `<div class="dm-divider"><p class="dm-muted">${e(t('The NFT endpoint differs from the app URL. Revoke and claim your stake before updating.'))}</p>${fields(
              [
                [t('App URL'), location.origin],
                [t('Endpoint URL'), data.endpoint],
              ],
            )}${button(t('Update Endpoint'), 'update-endpoint', `${dataAttr} ${staked || revoked || unavailable ? 'disabled' : ''}`)}</div>`
          : ''
      }</section>`;
  }
  function templateCreateForm() {
    const symbol = forge?.token?.symbol || factory?.token?.symbol || '';
    const names = {
      default: section === 'envelope' ? 'Default Envelope' : 'Default Namecard',
      loveCard: 'Love Card',
      pigCard: 'Pig Card',
      businessCard: 'Business Card',
      festivalCard: 'Festival Card',
      executiveCard: 'Executive',
      techCard: 'Tech',
      creativeCard: 'Creative',
      consultantCard: 'Consultant',
    };
    const field = (name, description, control) => {
      const hint = `${section}-${name.toLowerCase().replaceAll(' ', '-')}-hint`;
      return `<label><span class="dm-field-heading"><span>${e(t(name))}</span><small id="${hint}">${e(t(description))}</small></span>${control.replace(/<(input|textarea) /, `<$1 aria-describedby="${hint}" `)}</label>`;
    };
    return `<section class="dm-card dm-template-create"><div class="dm-row"><h2>${e(t('Create {type} NFT Factory', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}</h2><button type="button" data-action="template-info" class="dm-secondary dm-factory-info" aria-label="${e(t('{type} Factory information', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}" title="${e(t('{type} Factory information', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div><form data-template>
      <div class="dm-divider dm-template-layout"><div class="dm-template-upload"><h3 class="dm-visually-hidden">${e(t('Preview'))}</h3>
        <label class="dm-upload-zone"><input class="dm-upload-input" name="file" type="file" accept=".svg,image/svg+xml" aria-label="${e(t('Upload SVG {type} template file', { type: t(section) }))}" aria-describedby="${section}-upload-status">
          <span class="dm-upload-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/></svg><span>${e(t('Upload SVG {type} template file', { type: t(section) }))}</span></span>
          <img data-preview class="dm-preview" alt="${e(t('SVG template preview'))}" hidden>
          <span data-preview-status id="${section}-upload-status" class="dm-upload-status">${e(t('Click or drop an SVG file · up to 5 MB'))}</span>
        </label><p class="dm-small dm-muted">${e(t('Click the preview to replace the SVG template.'))}</p></div>
      <div class="dm-template-fields">
        ${field(section==='envelope'?'Envelope category':'Namecard category',section==='envelope'?'Member envelopes require a bound active member.':'Member namecards require a bound active member.',`<select name="category" aria-label="${e(t(section==='envelope'?'Envelope category':'Namecard category'))}"><option value="public">${e(t(section==='envelope'?'Public envelope':'Public namecard'))}</option><option value="members">${e(t(section==='envelope'?'Member-only envelope':'Member-only namecard'))}</option></select>`)}
        ${field('Name', '5–80 characters.', `<input name="name" aria-label="${e(t('Name'))}" minlength="5" maxlength="80" placeholder="${e(t('Enter name'))}" required>`)}
        ${field('Price', section === 'envelope' ? 'The sender of the mail will cover the costs.' : 'The sender of the namecard will cover the costs.', `<span class="dm-input-unit"><input name="price" aria-label="${e(t('Price'))}" type="number" min="${section==='envelope'?'0':'0.001'}" step="any" placeholder="0.001" required><span data-template-currency>${e(symbol)}</span></span>`)}
        ${section === 'envelope' ? field('Retention Period', 'Mail retention on this server, in days; 0 means unlimited.', `<span class="dm-input-unit"><input name="retentionPeriod" aria-label="${e(t('Retention Period'))}" type="number" min="0" step="1" required value="0"><span>${e(t('Day'))}</span></span>`) : ''}
        ${field('Description', '1–50 characters.', `<textarea name="description" aria-label="${e(t('Description'))}" maxlength="50" placeholder="${e(t('Enter description'))}" required></textarea>`)}
      </div></div>
      <div class="dm-row dm-template-samples-heading"><h3>${e(t('SVG {type} template samples', { type: t(section === 'envelope' ? 'Envelope' : 'Namecard') }))}</h3><button type="button" data-action="template-help" class="dm-secondary dm-factory-info" aria-label="${e(t(section === 'envelope' ? 'About SVG Envelope templates' : 'About SVG Namecard templates'))}" title="${e(t(section === 'envelope' ? 'About SVG Envelope templates' : 'About SVG Namecard templates'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg></button></div><div class="dm-templates dm-template-samples">${Object.entries(
        templateFiles[section],
      )
        .map(
          ([name, svg]) =>
            `<figure><button type="button" data-action="use-template" data-template-name="${name}" class="dm-template-select" aria-label="${e(t('Use {name}', { name: name === 'default' ? t(name) : t(names[name]) }))}" aria-pressed="false" title="${e(t('Use {name}', { name: name === 'default' ? t(name) : t(names[name]) }))}"><img src="${e(svgSource(svg))}" alt="${e(t(names[name]))}"></button><a class="dm-template-download" href="${e(svgSource(svg))}" download="${name}.svg" aria-label="${e(t('Download SVG'))}: ${e(t(names[name]))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/></svg> ${e(t(names[name]))}</a></figure>`,
        )
        .join('')}</div>
      <div class="dm-divider dm-template-submit"><p class="dm-muted">${e(t('Factory acquisition cost:'))} <strong data-template-cost>${e(factory?.token ? tokenLabel(factory.token) : t('Confirmed before creation'))}</strong></p><button type="submit">${e(t('Create Factory'))}</button></div>
    </form></section>`;
  }
  function renderTemplateForm() {
    $('[data-template-factory]').innerHTML = templateCreateForm();
    syncTransactionControls();
  }
  function showReadProgress(list, label) {
    list.setAttribute('aria-busy', 'true');
    if (!list.dataset.loaded) list.innerHTML = loadingMarkup(label);
    else {
      list.querySelector('[data-read-progress]')?.remove();
      list.insertAdjacentHTML(
        'afterbegin',
        `<p data-read-progress class="dm-refresh-status" role="status"><span class="dm-spinner" aria-hidden="true"></span>${e(t('Updating in background…'))}</p>`,
      );
    }
  }
  function showReadError(list, error, retry) {
    list.setAttribute('aria-busy', 'false');
    if (list.dataset.loaded) {
      list.querySelector('[data-read-progress]')?.remove();
      notice(errorMessage(error));
    } else localError(list, error, retry);
  }
  async function loadTemplates({ refresh = false } = {}) {
    const version = ++listVersion;
    const list = $('[data-list]');
    showReadProgress(list, t('Loading {type} list…', { type: t(section) }));
    try {
      const data = await request(
        `/api/${section}/list?cursor=${encodeURIComponent(cursor)}${refresh ? '&refresh=1' : ''}`,
      );
      if (version !== listVersion) return;
      const items = data[section === 'envelope' ? 'envelopes' : 'namecards'] || [];
      const paging = data.paging || { cursor: '0', next: false, total: 0 };
      list.innerHTML = items.length
        ? items
            .map((item, index) => {
              const svg = svgSource(item.display);
              return `<article class="dm-card dm-template-item"><div class="dm-grid">${svg ? `<img class="dm-preview" src="${e(svg)}" alt="${e(item.name)}">` : `<p class="dm-template-no-preview">${e(t('Preview not available'))}</p>`}<div class="dm-template-meta"><div class="dm-row"><h3>${e(item.name)}</h3>${svg ? `<label class="dm-toggle dm-publish-toggle" title="${e(t('Enable And Publish'))}"><span>${e(t('Enable And Publish'))}</span><input type="checkbox" data-publish="${index}" aria-label="${e(t('Enable {name}', { name: item.name }))}" ${item.enabled ? 'checked' : ''}><span class="dm-switch" aria-hidden="true"></span></label>` : ''}</div>${item.description && item.description !== item.name ? `<p class="dm-template-description">${e(item.description)}</p>` : ''}<div class="dm-template-category"><span>${e(t(section==='envelope'?'Envelope category':'Namecard category'))}</span><span class="dm-badge" data-template-category ${section==='envelope'?'data-envelope-category':'data-namecard-category'}>${e(t(section==='envelope'?(item.category==='members'?'Member-only envelope':'Public envelope'):(item.category==='members'?'Member-only namecard':'Public namecard')))}</span></div><div class="dm-template-address"><span>${e(t('Address'))}</span><span>${didMarkup(item.address, t)}</span></div><dl class="dm-template-facts"><div><dt>${e(t('Price'))}</dt><dd>${e(amountText(item.price))} ${e(item.token?.symbol || '')}</dd></div>${section === 'envelope' ? `<div><dt>${e(t('Retention Period'))}</dt><dd>${e(Number(item.retentionPeriod || 0) === 0 ? t('Unlimited') : t('{count} Day', { count: item.retentionPeriod }))}</dd></div>` : ''}</dl></div></div></article>`;
            })
            .join('')
        : `<p class="dm-empty">${e(t('No {type} NFTs yet', { type: t(section) }))}</p>`;
      list.insertAdjacentHTML(
        'beforeend',
        `<div class="dm-pagination"><span>${e(t('Total:'))} ${e(paging.total)}</span><div class="dm-actions">${button(t('Previous'), 'cursor-prev', `class="dm-secondary" ${Number(cursor) <= 0 ? 'disabled' : ''}`)}${button(t('Next'), 'cursor-next', `class="dm-secondary" ${!paging.next ? 'disabled' : ''}`)}</div></div>`,
      );
      if (data.cache?.syncedAt)
        list.insertAdjacentHTML(
          'afterbegin',
          `<p class="dm-small dm-muted" data-template-sync>${e(t('Last chain sync:'))} ${e(dateLabel(data.cache.syncedAt))}</p>`,
        );
      if (data.cache?.syncError)
        list.insertAdjacentHTML(
          'afterbegin',
          `<div class="dm-alert" role="alert">${e(t('Chain sync failed. Showing saved data; try Refresh again.'))}</div>`,
        );
      list.dataset.loaded = 'true';
      list.setAttribute('aria-busy', 'false');
      for (const toggle of list.querySelectorAll('[data-publish]'))
        toggle.onchange = async () => {
          const item = items[Number(toggle.dataset.publish)];
          const enabled = toggle.checked;
          toggle.disabled = true;
          try {
            await request(`/api/${section}/db/update`, {
              method: 'POST',
              body: {
                address: item.address,
                name: item.name,
                price: `${item.price} ${item.token?.symbol || ''}`,
                token: item.token,
                retentionPeriod: item.retentionPeriod,
                description: item.description,
                svg: svgSource(item.display),
                enabled,
              },
            });
            notice(t('Publish setting saved.'), 'success');
          } catch (error) {
            toggle.checked = !enabled;
            notice(errorMessage(error));
          } finally {
            toggle.disabled = false;
          }
        };
    } catch (error) {
      if (version === listVersion) showReadError(list, error, 'list-refresh');
    }
  }
  async function loadMails() {
    const version = ++listVersion;
    const list = $('[data-list]');
    showReadProgress(list, t('Loading stored mail…'));
    try {
      const data = await request(
        `/api/storage/mails?${new URLSearchParams({ page: String(page), pageSize: String(pageSize), search })}`,
      );
      if (version !== listVersion) return;
      const lastPage = Math.max(1, Number(data.totalPages) || 1);
      if (page > lastPage) { page = lastPage; return loadMails(); }
      list.innerHTML = renderStorageTable(data.mails || [], t, mailCurrency(), search) + `
        <div class="dm-pagination"><span class="dm-storage-total">${e(t('Total:'))} ${e(data.total || 0)}</span><div class="dm-pagination-controls"><label>${e(t('Page size'))}<input type="number" min="1" max="100" value="${pageSize}" data-page-size></label><div class="dm-page-position"><label>${e(t('Page'))}<input type="number" min="1" max="${Math.max(1, Number(data.totalPages) || 1)}" value="${page}" data-page></label><span>${e(t('of {count}', { count: Math.max(1, Number(data.totalPages) || 1) }))}</span></div><div class="dm-actions">${button(t('Previous'), 'page-prev', `class="dm-secondary" ${page <= 1 ? 'disabled' : ''}`)}${button(t('Next'), 'page-next', `class="dm-secondary" ${page >= Number(data.totalPages || 0) ? 'disabled' : ''}`)}</div></div></div>`;
      list.dataset.loaded = 'true';
      list.setAttribute('aria-busy', 'false');
    } catch (error) {
      if (version === listVersion) showReadError(list, error, 'storage-refresh');
    }
  }
  function mailCurrency() {
    return forge?.token?.symbol || (account?.chainId ? (account.chainId === 'main' ? 'ABT' : 'TBA') : '');
  }
  function updateMailCurrency() {
    for (const cell of content.querySelectorAll('[data-mail-payment]'))
      cell.innerHTML = storagePayment(JSON.parse(cell.dataset.mailPayment), t, mailCurrency());
    for (const detail of content.querySelectorAll('[data-mail-fee-details]'))
      detail.innerHTML = storageFeeDetails(JSON.parse(detail.dataset.mailFeeDetails), t, mailCurrency());
  }
  async function loadStorageSize() {
    const label = $('[data-size]');
    try {
      label.textContent = (await request('/api/storage/size')).size;
    } catch (error) {
      label.textContent = t('Unavailable');
      label.title = errorMessage(error);
    }
  }
  async function setTemplate(candidate) {
    if (!candidate || !candidate.name.toLowerCase().endsWith('.svg')) throw new Error(t('Choose an SVG file.'));
    if (candidate.size > 5 * 1024 * 1024) throw new Error(t('SVG template must be at most 5 MB.'));
    const text = await candidate.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg')
      throw new Error(t('Invalid SVG document.'));
    const required = section === 'envelope' ? ['{{mail.subject}}', '{{mail.sender}}'] : ['{{contact.name}}'];
    const valid =
      section === 'envelope'
        ? required.every((value) => text.includes(value))
        : required.some((value) => text.includes(value));
    if (!valid)
      throw new Error(
        t('The SVG file must contain {fields}', { fields: required.join(section === 'envelope' ? ', ' : t(' or ')) }),
      );
    file = candidate;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(candidate);
    $('[data-preview]').src = previewUrl;
    $('[data-preview]').hidden = false;
    $('[data-preview-status]').textContent = candidate.name;
    for (const button of root.querySelectorAll('.dm-template-select'))
      button.setAttribute('aria-pressed', String(templateFiles[section][button.dataset.templateName] === text));
  }
  async function mutate(path, body, method = 'POST', verifyMessage = true) {
    if (method === 'POST' && (path.startsWith('/api/stake/') || path.endsWith('/acquire'))) {
      const purchase = path.endsWith('/acquire');
      if (purchase) await store.read('account', { force: true });
      else await loadAccount();
      if (!store.active || accountError || (!purchase && stakeError) || !account || account.chainStatus === 'unavailable')
        throw new Error(t('Node state could not be verified. Refresh the node data before submitting a transaction.'));
      if (path.endsWith('/acquire') && !canAfford(account.tokens, factory?.token))
        throw new Error(t('Insufficient balance. Recharge the node first.'));
      if (
        path === '/api/stake/add' &&
        toUnits(body.amount, nodeToken()?.decimal ?? 18) > BigInt(nodeToken()?.value || 0)
      )
        throw new Error(t('Enter an integer stake amount within the node balance.'));
    }
    const result = await request(path, { method, body });
    if (
      verifyMessage &&
      result.message &&
      !['staked', 'Updated successfully', 'Cleaned successfully'].includes(result.message)
    )
      throw new Error(result.message);
    return result;
  }
  async function runAction(task) {
    if (actionPending) return;
    actionPending = true;
    const previousFocus = document.activeElement;
    root.dataset.busy = 'true';
    const controls = [...root.querySelectorAll('button,input[type=checkbox]')].filter((el) => !el.disabled);
    controls.forEach((el) => {
      el.disabled = true;
    });
    notice();
    try {
      await task();
    } catch (error) {
      if (section === 'attachment' && [401, 403].includes(error.status)) {
        modules["node-state.js"].closeNodeStore({ forget: true });
        document.dispatchEvent(new Event('didmail-session-ended'));
      } else notice(errorMessage(error) || t('Operation failed.'));
    } finally {
      actionPending = false;
      acquirePending = false;
      stakeAction = '';
      const templateSubmit = $('[data-template] button[type=submit]');
      if (templateSubmit) {
        templateSubmit.setAttribute('aria-busy', 'false');
        templateSubmit.textContent = t('Create Factory');
      }
      delete root.dataset.busy;
      controls.forEach((el) => {
        if (el.isConnected) el.disabled = false;
      });
      syncTransactionControls();
      if (section === 'server') renderServer();
      if (previousFocus?.isConnected && !previousFocus.disabled &&
          (document.activeElement === document.body || (!dialog.open && dialog.contains(document.activeElement)))) {
        previousFocus.focus({ preventScroll: true });
      }
    }
  }
  function showRecharge() {
    if (!store?.active || actionPending) return;
    if (section !== 'account') {
      location.assign(`${localizedPath('/admin/account', locale)}#recharge`);
      return;
    }
    location.hash = 'recharge';
    selectWalletPanel('wallet-recharge');
  }
  function renderWalletPage() {
    const address = store.node?.address || account?.address;
    if (!address) return;
    const code = qrcode(0, 'M');
    const did = address.startsWith('did:abt:') ? address : `did:abt:${address}`;
    code.addData(did);
    code.make();
    content.innerHTML = `<section class="dm-card dm-account-operations"><div class="dm-wallet-tabs" role="group" aria-label="${e(t('Account operations'))}"><button type="button" data-action="wallet-recharge">${e(t('Recharge'))}</button><button type="button" data-action="wallet-transfer">${e(t('Transfer out'))}</button><button type="button" data-action="wallet-gas">${e(t('Gas stake'))}</button></div><div data-wallet-recharge><div class="dm-account-recharge">${code.createSvgTag({ cellSize: 5, margin: 4, scalable: true })}<div><h2>${e(t('Recharge'))}</h2><p class="dm-muted dm-recharge-description">${e(t('Send funds to this node address.'))}</p>${fields([[t('Node address'), did], [t('Network:'), store.node?.chainId || account?.chainId || 'beta']], { full: true })}<p class="dm-muted">${e(t('Use the matching network in your wallet.'))}</p></div></div></div><div data-wallet-transfer hidden></div><div data-wallet-gas hidden></div></section>`;
    selectWalletPanel({ '#transfer': 'wallet-transfer', '#stake': 'wallet-gas' }[location.hash] || 'wallet-recharge');
  }
  function selectWalletPanel(action) {
    if (section !== 'account' || actionPending || !$('[data-wallet-recharge]')) return;
    const mapping = { 'wallet-recharge': 'recharge', 'wallet-transfer': 'transfer', 'wallet-gas': 'stake' };
    for (const [key, panel] of Object.entries({ 'wallet-recharge': 'recharge', 'wallet-transfer': 'transfer', 'wallet-gas': 'gas' }))
      $(`[data-wallet-${panel}]`).hidden = key !== action;
    root.querySelectorAll('.dm-wallet-tabs button').forEach((el) => el.setAttribute('aria-pressed', String(el.dataset.action === action)));
    history.replaceState(null, '', `#${mapping[action]}`);
    if (action === 'wallet-transfer') void showTransfer();
    if (action === 'wallet-gas') void showGasStake();
  }
  async function showTransfer() {
    const panel = $('[data-wallet-transfer]');
    if (!panel) return;
    panel.innerHTML = ownerSession ? loadingMarkup(t('Loading available balance…')) : `<p class="dm-muted">${e(t('Only the node owner can transfer funds.'))}</p>`;
    if (!ownerSession) return;
    try {
      const quote = await request('/api/account/transfer');
      if (!panel.isConnected) return;
      transferQuote = quote;
      panel.innerHTML = `<p class="dm-muted">${e(t('Transfer available funds to the node owner. Staked funds cannot be transferred.'))}</p>${fields([[t('Recipient address'), quote.recipient], [t('Network:'), quote.chainId], [t('Available balance'), tokenLabel(quote.token)]])}<form data-node-transfer><label>${e(t('Transfer amount'))}<span class="dm-stake-input"><input name="amount" type="text" inputmode="decimal" autocomplete="off" required placeholder="0"><span aria-hidden="true">${e(quote.token.symbol)}</span></span></label><p class="dm-small dm-muted">${e(t('Keep enough funds in the node wallet for transaction fees.'))}</p><div data-transfer-error role="alert"></div><div class="dm-actions"><button type="submit">${e(t('Review transfer'))}</button></div></form>`;
    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-transfer')}`;
    }
  }
  async function showGasStake() {
    const panel = $('[data-wallet-gas]');
    if (!panel) return;
    gasQuote = undefined;
    panel.innerHTML = ownerSession ? loadingMarkup(t('Loading gas staking rules…')) : `<p class="dm-muted">${e(t('Only the node owner can stake for gas.'))}</p>`;
    if (!ownerSession) return;
    try {
      const quote = await request('/api/account/gas-stake');
      if (!panel.isConnected) return;
      gasQuote = quote;
      const days = (quote.withdrawalWaitingPeriod ?? quote.waitingPeriod) / 86400;
      panel.innerHTML = `<p class="dm-muted">${e(t('Stake the network token to qualify for gas-free transactions. This is separate from the service node NFT stake.'))}</p>${fields([[t('Network:'), quote.chainId], [t('Stake Address'), quote.address], [t('Amount to stake'), tokenLabel(quote.token)], [t('Available balance'), tokenLabel({ ...quote.token, value: quote.balance })], [t('Staked'), tokenLabel({ ...quote.token, value: quote.staked })], [t('Revoke Waiting Period'), t('{count} days', { count: days })]])}<p class="dm-small dm-muted">${e(t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: days }))}</p>${BigInt(quote.revoked) > 0n ? `<p class="dm-muted">${e(t('Revoked'))}: ${e(tokenLabel({ ...quote.token, value: quote.revoked }))}</p>` : ''}<div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}${quote.canRevoke ? button(t('Revoke gas stake'), 'gas-revoke', 'class="dm-secondary"') : ''}<button type="button" data-action="gas-stake" ${quote.eligible || BigInt(quote.balance) < BigInt(quote.token.value) ? 'disabled' : ''}>${e(t(quote.eligible ? 'Gas stake already sufficient' : 'Stake for gas'))}</button></div>${!quote.eligible && BigInt(quote.balance) < BigInt(quote.token.value) ? `<p role="alert">${e(t('Insufficient available balance.'))}</p>` : ''}`;
      if (quote.withdrawals?.length) {
        const list = document.createElement('section');
        list.className = 'dm-gas-withdrawals';
        list.innerHTML = `<h3>${e(t('Pending withdrawals'))}</h3>${quote.withdrawals.map((item) => `<div class="dm-gas-withdrawal"><div><strong>${e(tokenLabel({ ...quote.token, value: item.amount }))}</strong><p class="dm-muted dm-small">${e(t(item.claimable ? 'Ready to claim' : 'Available to claim at'))}${item.claimable ? '' : ` ${e(dateLabel(item.availableAt))}`}</p></div><button type="button" data-action="gas-claim" data-evidence="${e(item.evidence)}" ${item.claimable ? '' : 'disabled'}>${e(t('Claim gas stake'))}</button></div>`).join('')}`;
        panel.append(list);
      }

    } catch (error) {
      if (panel.isConnected) panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas')}`;
    }
  }
  document.addEventListener('didmail-node-recharge', showRecharge);
  root.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'clear-mail-search') {
      search = '';
      page = 1;
      const input = $('[data-search] input');
      input.value = '';
      input.focus();
      void runAction(loadMails);
      return;
    }
    if (action === 'storage-details') {
      const panel = document.getElementById(target.getAttribute('aria-controls'));
      if (panel) { panel.hidden = !panel.hidden; target.setAttribute('aria-expanded', String(!panel.hidden)); }
      return;
    }
    if (action === 'copy-endpoint') {
      const feedback = $('[data-endpoint-copy]');
      void (async () => {
        try {
          await navigator.clipboard.writeText(location.origin);
          if (feedback?.isConnected) {
            feedback.setAttribute('role', 'status');
            feedback.textContent = t('Endpoint copied.');
          }
        } catch {
          if (feedback?.isConnected) {
            feedback.setAttribute('role', 'alert');
            feedback.textContent = t('Copy failed. Select the endpoint above and copy it manually.');
          }
        }
      })();
      return;
    }

    if (action === 'template-help') {
      showTemplateHelp();
      return;
    }
    if (action === 'template-info') {
      void showTemplateFactory();
      return;
    }
    if (['wallet-recharge', 'wallet-transfer', 'wallet-gas'].includes(action)) {
      selectWalletPanel(action);
      return;
    }
    if (['gas-revoke', 'gas-claim'].includes(action)) {
      if (!gasQuote || actionPending) return;
      const quote = gasQuote;
      const revoking = action === 'gas-revoke';
      const item = quote.withdrawals?.find((entry) => entry.evidence === target.dataset.evidence);
      if (revoking ? !quote.canRevoke : !item?.claimable) return;
      const title = t(revoking ? 'Revoke gas stake' : 'Claim gas stake');
      void runAction(async () => {
        const amount = tokenLabel({ ...quote.token, value: revoking ? quote.staked : item.amount });
        const explanation = revoking
          ? t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: quote.withdrawalWaitingPeriod / 86400 })
          : t('Funds return to the node account. Claiming may end gas-free eligibility.');
        if (!(await showDialog(title, `${fields([[t('Stake Address'), quote.address], [t('Amount'), amount], [t('Network:'), quote.chainId]])}<p class="dm-muted">${e(explanation)}</p>`, title, { wallet: true }))) return;
        const panel = $('[data-wallet-gas]');
        panel.innerHTML = loadingMarkup(t(revoking ? 'Revoking gas stake…' : 'Claiming gas stake…'));
        try {
          const result = await request(`/api/account/gas-stake/${revoking ? 'revoke' : 'claim'}`, {
            method: 'POST', body: { policyId: quote.exitPolicyId, ...(!revoking ? { evidence: item.evidence } : {}) },
          });
          notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
          panel.innerHTML = `<h2>${e(t(revoking ? 'Gas stake revocation submitted' : 'Gas stake claim submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Stake Address'), result.address]])}<p class="dm-muted">${e(explanation)}</p><div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}</div>`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas', 'class="dm-secondary"')}`;
        } finally { await loadAccount(); }
      });
      return;
    }
    if (action === 'gas-stake') {
      if (!gasQuote || actionPending) return;
      const quote = gasQuote;
      void runAction(async () => {
        if (!(await showDialog(t('Confirm gas stake'), `${fields([[t('Amount to stake'), tokenLabel(quote.token)], [t('Stake Address'), quote.address], [t('Network:'), quote.chainId]])}<p>${e(t('After revoking, wait {count} days before claiming the funds. Network abuse may result in slashing.', { count: quote.waitingPeriod / 86400 }))}</p>`, t('Stake for gas'), { wallet: true }))) return;
        const panel = $('[data-wallet-gas]');
        panel.innerHTML = loadingMarkup(t('Submitting gas stake…'));
        try {
          const result = await request('/api/account/gas-stake', { method: 'POST', body: { policyId: quote.policyId } });
          notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
          panel.innerHTML = `<h2>${e(t('Gas stake submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Stake Address'), result.address]])}<div class="dm-actions">${button(t('Refresh'), 'wallet-gas', 'class="dm-secondary"')}</div>`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Retry'), 'wallet-gas', 'class="dm-secondary"')}`;
        } finally { await loadAccount(); }
      });
      return;
    }
    if (action === 'recharge') {
      showRecharge();
      return;
    }
    if (action === 'refresh-account') {
      void loadAccount();
      return;
    }
    if (action === 'session-retry') {
      void loadSession();
      return;
    }
    if (action === 'acquire' && !actionPending) {
      acquirePending = true;
      renderServer();
    }
    void runAction(async () => {
      if (action === 'server-factory-info') await showServerFactory();
      else if (action === 'server-factory-retry') await loadServerFactory();
      else if (action === 'section-retry') await loadSection();
      else if (action === 'acquire') {
        const [freshFactory] = await Promise.all([
          request('/api/servers/factory?refresh=1'),
          store.read('account', { force: true }),
        ]);
        factory = freshFactory;
        if (!store.active || accountError || !account || account.chainStatus === 'unavailable')
          throw new Error(t('Node state could not be verified. Refresh the node data before submitting a transaction.'));
        if (!canAfford(account.tokens, factory.token))
          throw new Error(t('Insufficient balance. Recharge the node first.'));
        // The backend owns node-wallet signing; the ARC login wallet is never substituted.
        if (
          !(await showDialog(
            t('Acquire Server Node NFT'),
            `<p>${e(t('The node wallet will pay {cost} and own this NFT.', { cost: tokenLabel(factory.token) }))}</p>`,
            t('Acquire'),
          ))
        )
          return;
        await mutate('/api/servers/acquire');
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (['stake', 'revoke', 'claim', 'update-endpoint'].includes(action)) {
        const names = {
          stake: t('Stake Node NFT'),
          revoke: t('Revoke Stake'),
          claim: t('Claim Stake'),
          'update-endpoint': t('Update Endpoint'),
        };
        if (
          !(await showDialog(
            names[action],
            `<p>${action === 'revoke' ? t('Revoke the staked tokens? A waiting period applies before claiming.') : t('Submit this operation using the node wallet?')}</p>`,
            names[action],
          ))
        )
          return;
        const paths = { stake: 'asset', revoke: 'revoke', claim: 'claim', 'update-endpoint': 'update-endpoint' };
        const body =
          action === 'stake'
            ? { assetAddress: target.dataset.asset }
            : action === 'update-endpoint'
              ? { asset: target.dataset.asset }
              : undefined;
        stakeAction = action;
        renderServer();
        await mutate(`/api/stake/${paths[action]}`, body);
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (action === 'use-template') {
        const text = templateFiles[section][target.dataset.templateName];
        if (!text) throw new Error(t('Template could not be loaded.'));
        await setTemplate(new File([text], `${target.dataset.templateName}.svg`, { type: 'image/svg+xml' }));
      } else if (action === 'list-refresh') {
        cursor = '0';
        await loadTemplates({ refresh: true });
      } else if (action === 'clean') {
        if (
          !(await showDialog(
            t('Clean {type} cache', { type: t(section) }),
            `<p>${e(t('Remove cached publish settings for this list? On-chain NFTs remain.'))}</p>`,
            t('Clean'),
          ))
        )
          return;
        await mutate(`/api/${section}/clean`, undefined, 'DELETE');
        cursor = '0';
        await loadTemplates();
        notice(t('Cache cleaned.'), 'success');
      } else if (action === 'cursor-prev' || action === 'cursor-next') {
        cursor = String(Math.max(0, Number(cursor) + (action === 'cursor-next' ? 1 : -1)));
        await loadTemplates();
      } else if (action === 'storage-refresh') await Promise.all([loadMails(), loadStorageSize()]);
      else if (action === 'page-prev' || action === 'page-next') {
        page = Math.max(1, page + (action === 'page-next' ? 1 : -1));
        await loadMails();
      } else if (action === 'delete-mail') {
        if (
          !(await showDialog(
            t('Delete Mail'),
            `<p>${e(t('Delete mail {id} and its encrypted content? This action cannot be undone.', { id: target.dataset.mailLabel || target.dataset.mailId }))}</p>`,
            t('Delete'),
          ))
        )
          return;
        await mutate(
          `/api/storage/mails/delete/${encodeURIComponent(target.dataset.mailId)}`,
          undefined,
          'DELETE',
          false,
        );
        await Promise.all([loadMails(), loadStorageSize()]);
        notice(t('Mail deleted.'), 'success');
      }
    });
  });
  root.addEventListener('change', (event) => {
    const target = event.target;
    if (target.matches('input[type=file]')) {
      file = null;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      $('[data-preview]').hidden = true;
      for (const button of root.querySelectorAll('.dm-template-select')) button.setAttribute('aria-pressed', 'false');
      void setTemplate(target.files?.[0]).catch((error) => {
        notice(errorMessage(error));
        $('[data-preview-status]').textContent = t('Select a valid SVG template.');
      });
    }
    if (target.matches('[data-page],[data-page-size]')) {
      const value = Number(target.value);
      const max = target.matches('[data-page]') ? Number(target.max) : 100;
      if (!Number.isInteger(value) || value < 1 || value > max) {
        notice(t('Enter a valid page or page size.'));
        return;
      }
      if (target.matches('[data-page]')) page = value;
      else {
        pageSize = value;
        page = 1;
      }
      void runAction(loadMails);
    }
  });
  root.addEventListener('submit', (event) => {
    const form = event.target;
    event.preventDefault();
    if (form.matches('[data-search]')) {
      search = new FormData(form).get('search').trim();
      page = 1;
      void runAction(loadMails);
      return;
    }
    if (form.matches('[data-node-transfer]')) {
      const amount = String(new FormData(form).get('amount')).trim();
      try {
        if (!transferQuote) throw new Error(t('Node balance could not be verified.'));
        const value = toUnits(amount, transferQuote.token.decimal);
        if (value <= 0n) throw new Error(t('Transfer amount must be greater than zero.'));
        if (value > BigInt(transferQuote.token.value)) throw new Error(t('Insufficient available balance.'));
      } catch (error) {
        form.querySelector('[data-transfer-error]').textContent = errorMessage(error);
        return;
      }
      const quote = transferQuote;
      void runAction(async () => {
        if (!(await showDialog(t('Confirm transfer'), `${fields([[t('Transfer amount'), `${amountText(amount)} ${quote.token.symbol}`], [t('Recipient address'), quote.recipient], [t('Network:'), quote.chainId]])}<p class="dm-muted">${e(t('This transfer cannot be undone.'))}</p>`, t('Transfer to owner'), { wallet: true }))) return;
        const panel = $('[data-wallet-transfer]');
        panel.innerHTML = loadingMarkup(t('Submitting transfer…'));
        try {
          const result = await request('/api/account/transfer', { method: 'POST', body: { amount } });
          notice(t('Transfer submitted'), 'success');
          panel.innerHTML = `<h2>${e(t('Transfer submitted'))}</h2>${fields([[t('Transaction hash'), result.hash], [t('Recipient address'), result.recipient], [t('Transfer amount'), `${amountText(result.amount)} ${result.token}`]])}<p class="dm-muted">${e(t('Refresh the node balance to verify the result.'))}</p>${button(t('Back'), 'wallet-transfer', 'class="dm-secondary"')}`;
        } catch (error) {
          notice(errorMessage(error));
          panel.innerHTML = `<p role="alert">${e(errorMessage(error))}</p>${button(t('Back'), 'wallet-transfer', 'class="dm-secondary"')}`;
        } finally {
          await loadAccount();
        }
      });
      return;
    }
    void runAction(async () => {
      const values = Object.fromEntries(new FormData(form));
      if (form.matches('[data-add-stake]')) {
        const amount = Number(values.amount);
        if (!Number.isSafeInteger(amount) || amount < 1)
          throw new Error(t('Enter an integer stake amount within the node balance.'));
        if (
          !(await showDialog(
            t('Add Stake'),
            `<p>${e(t('Add {amount} tokens to the node stake?', { amount }))}</p>`,
            t('Add Stake'),
          ))
        )
          return;
        stakeAction = 'add';
        renderServer();
        await mutate('/api/stake/add', { amount });
        await loadAccount();
        notice(t('Request accepted. Refresh to verify on-chain state.'), 'success');
      } else if (form.matches('[data-template]')) {
        if (!file) throw new Error(t('Select a valid SVG template.'));
        const name = values.name.trim(),
          description = values.description.trim();
        if (name.length < 5 || name.length > 80 || !description || description.length > 50)
          throw new Error(t('Name must be 5–80 characters; description must be 1–50 characters.'));
        if (!/^\d+(\.\d+)?$/.test(values.price) || Number(values.price) < (section==='envelope'?0:0.001))
          throw new Error(t('Price must be at least 0.001.'));
        if (
          section === 'envelope' &&
          (!Number.isSafeInteger(Number(values.retentionPeriod)) || Number(values.retentionPeriod) < 0)
        )
          throw new Error(t('Retention must be a non-negative integer.'));
        await readTemplateFactory();
        if (
          !(await showDialog(
            t('Create {type} Factory', { type: t(section) }),
            `<p>${e(t('The node wallet will pay the factory acquisition cost: {cost}.', { cost: tokenLabel(factory.token) }))}</p>`,
            t('Create'),
          ))
        )
          return;
        const submit = form.querySelector('button[type=submit]');
        submit.setAttribute('aria-busy', 'true');
        submit.innerHTML = `<span class="dm-spinner" aria-hidden="true"></span>${e(t('Creating Factory…'))}`;
        const body = new FormData();
        body.append('file', file);
        body.append('name', name);
        body.append('price', values.price);
        body.append('description', description);
        body.append('category',values.category);
        if (section === 'envelope') body.append('retentionPeriod', values.retentionPeriod);
        await mutate(`/api/${section}/acquire`, body);
        form.reset();
        file = null;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        $('[data-preview]').hidden = true;
        $('[data-preview-status]').textContent = t('Select or upload an SVG template.');
        for (const button of root.querySelectorAll('.dm-template-select')) button.setAttribute('aria-pressed', 'false');
        cursor = '0';
        await Promise.all([loadAccount(), loadTemplates({ refresh: true })]);
        notice(t('Factory created successfully.'), 'success');
      }
    });
  });
  window.addEventListener(
    'pagehide',
    () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    { once: true },
  );
  document.addEventListener('didmail-session-ended', () => {
    if (dialog.open) dialog.close();
    $('[data-workspace]').hidden = true;
    $('[data-session]').textContent = t('Session expired. Refresh the page to sign in again.');
  });
  await loadSession();
}

return {};
})();
})();
