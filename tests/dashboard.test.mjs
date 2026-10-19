import {test} from 'node:test';import assert from 'node:assert/strict';import {snapshotIsCurrent} from '../domain.mjs';
const events=[{id:1,deadline_time:'2026-08-15T17:30:00Z'}],next={id:8,deadline_time:'2026-10-23T17:30:00Z'};
test('dashboard fixture snapshot must match season and next gameweek',()=>{
 assert.equal(snapshotIsCurrent({gw:8,generated:'2026-10-18T03:00:00Z'},events,next),true);
 assert.equal(snapshotIsCurrent({gw:8,generated:'2025-10-18T03:00:00Z'},events,next),false);
 assert.equal(snapshotIsCurrent({gw:7,generated:'2026-10-18T03:00:00Z'},events,next),false);
 assert.equal(snapshotIsCurrent({gw:8,generated:'invalid'},events,next),false);
 assert.equal(snapshotIsCurrent({gw:8,generated:'2026-10-24T03:00:00Z'},events,next),false);
 assert.equal(snapshotIsCurrent(null,events,next),false);
});
