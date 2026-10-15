/**
 * Serializes async operations so concurrent messages (e.g. a manual add arriving
 * while an observer snapshot is mid read-modify-write) can't race and clobber
 * each other's write to chrome.storage.local.
 */
let tail = Promise.resolve();

export function enqueue(fn) {
  const run = tail.then(fn, fn);
  tail = run.then(() => {}, () => {});
  return run;
}
