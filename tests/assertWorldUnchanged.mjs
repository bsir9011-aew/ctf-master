import assert from 'node:assert/strict';

/** A failed virtual command must preserve every piece of world state, but the
 * session's lastExitCode is intentionally updated by the new exit-status model.
 */
export function assertWorldUnchanged(actual,expected,message){
  const {lastExitCode:ignoredActual,...actualWorld}=actual;
  const {lastExitCode:ignoredExpected,...expectedWorld}=expected;
  assert.deepEqual(actualWorld,expectedWorld,message);
}
