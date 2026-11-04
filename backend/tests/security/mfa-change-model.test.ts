import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/utils/prisma.js', () => ({ default: {} }));
type Factor = { id: string; verified: boolean };
type Flow = { id: number; step: number; old: string[]; factor: string; success: boolean; uncertain: boolean };
function run(seed: number, withReset = false) {
 let state = seed >>> 0;
 const random = (n: number) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % n; };
 const factors = new Map<string, Factor>([['original', {id:'original',verified:true}]]);
 const flows: Flow[] = Array.from({length: 2 + random(2)}, (_, id) => ({id, step:0, old:[], factor:`factor-${id}`, success:false, uncertain:false}));
 const delayed: string[] = [];
 const requests: { grant: number; factor: string }[] = [];
 const recorded = new Map<number, string[]>();
 let resetOccurred = false;
 let nextGrant = 0;
 const check = () => {
   if (resetOccurred) return;
   expect([...factors.values()].some((factor) => factor.verified)).toBe(true);
   const latest = flows.filter((flow) => flow.success).sort((a, b) => b.id - a.id)[0];
   if (latest) expect(factors.get(latest.factor)?.verified).toBe(true);
 };
 for (let i = 0; i < 100 && (flows.some((f) => f.step < 4) || delayed.length); i++) {
   if (withReset && !resetOccurred && i === 5) { factors.clear(); resetOccurred = true; }
   if (delayed.length && random(5) === 0) { factors.delete(delayed.shift()!); check(); continue; }
   const eligible = flows.filter((f) => f.step < 4);
   if (!eligible.length) { factors.delete(delayed.shift()!); check(); continue; }
   const flow = eligible[random(eligible.length)];
   if (flow.step === 0) { flow.id = ++nextGrant; flow.old = [...factors.values()].filter((f) => f.verified).map((f) => f.id); recorded.set(flow.id, [...flow.old]); if (!flow.old.length) { flow.step = 4; continue; } }
   if (flow.step === 1) factors.set(flow.factor, {id:flow.factor,verified:false});
   if (flow.step === 2) { const f = factors.get(flow.factor); if (!f) { flow.step=4; continue; } const outcome = random(4); if (outcome === 0) { flow.step=4; continue; } f.verified = true; flow.uncertain = outcome === 1; flow.success = !flow.uncertain; if (flow.uncertain) {flow.step=4; check(); continue;} }
   if (flow.step === 3 && flow.success) for (const id of flow.old) { requests.push({ grant: flow.id, factor: id }); if (random(2)) delayed.push(id); else factors.delete(id); check(); }
   flow.step++; check();
 }
 while (delayed.length) { factors.delete(delayed.shift()!); check(); }
 for (const request of requests) expect(recorded.get(request.grant)).toContain(request.factor);
}
describe('authenticator change safety model', () => {
 it('preserves a verified factor across 1000 seeded interleavings with late deletes', () => { for (let seed = 1; seed <= 1000; seed++) run(seed); });
 it('limits change deletions to recorded factors when an explicit reset interleaves', () => { for (let seed = 1; seed <= 100; seed++) run(seed, true); });
});
