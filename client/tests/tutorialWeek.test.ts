import { afterEach, describe, expect, it, vi } from 'vitest';
import { TutorialWeek } from '../src/core/TutorialWeek';
import { gameState } from '../src/core/GameState';
import { feedRequirementKg } from '../src/sim/nutrition';
import { settleDeterministic } from '../src/sim/settlement';
import { actionStatus } from '../src/sim/rules';
import { migrateSave } from '../src/systems/SaveSystem';
import { SAVE_VERSION } from '../src/config';
import { createDefaultState } from '../src/core/defaultState';
import { tutorialPreferences, offerTutorialOnce, completeTutorial } from '../src/ui/tutorialPreferences';

afterEach(() => vi.unstubAllGlobals());

describe('独立教学周', () => {
  it('uses a valid four-cell, yak-only run with two available actions', () => {
    const session = new TutorialWeek();
    const run = session.state;
    expect(run.animals).toHaveLength(8);
    expect(run.animals.every(a => a.species === 'yak' && a.alive)).toBe(true);
    expect(run.pasture.map(c => c.id)).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(run.pasture.slice(1).every(c => c.biomassKgPerHa === 0)).toBe(true);
    expect(run.actionsLeft).toBe(2);
    expect(actionStatus(run, { kind: 'graze', cellId: 'P1' }).reason).toBeNull();
    expect(migrateSave({version:SAVE_VERSION,data:{...createDefaultState(),run}})?.data.run.animals).toHaveLength(8);
    expect(session.snapshot.needKg).toBe(feedRequirementKg(run.animals));
  });

  it('only accepts P1 grazing or the currently offered hay quantities', () => {
    const session = new TutorialWeek();
    const before = structuredClone(session.state);
    for (const action of [{kind:'graze',cellId:'P2'}, {kind:'cut-hay',cellId:'P1'}, {kind:'hire'}, {kind:'buy-hay',kg:999999}, {kind:'sell',animalIds:[before.animals[0].id]}] as const) {
      expect(session.act(action as never)).toBe(false);
      expect(session.state).toEqual(before);
    }
    expect(session.act({kind:'graze',cellId:'P1'})).toBe(true);
    expect(session.act({kind:'graze',cellId:'P1'})).toBe(false);
    expect(session.act({kind:'buy-hay',kg:session.snapshot.topUpKg})).toBe(true);
    expect(session.snapshot.gapKg).toBe(0);
    expect(session.state.actionsLeft).toBe(0);
  });

  it('settles exactly once with original deterministic rules and preserves pre-feed numbers', () => {
    const session = new TutorialWeek();
    session.act({kind:'graze',cellId:'P1'});
    session.act({kind:'buy-hay',kg:session.snapshot.topUpKg});
    const before = structuredClone(session.state);
    const snapshot = session.snapshot;
    const result = session.settle();
    expect(result.after).toEqual(settleDeterministic(before));
    expect(result.needKg).toBe(snapshot.needKg);
    expect(result.availableKg).toBe(snapshot.availableKg);
    expect(result.gapKg).toBe(0);
    expect(result.grazedKg).toBe(before.grazedKg);
    expect(result.boughtKg).toBeGreaterThan(0);
    expect(session.settle()).toBe(result);
    expect(session.act({kind:'buy-hay',kg:200})).toBe(false);
    expect(result.after.week).toBe(1);
    expect(result.after.usedEvents).toEqual([]);
  });

  it('allows settling without solving the gap and reports actual unmet need', () => {
    const session = new TutorialWeek();
    const {needKg,availableKg,gapKg} = session.snapshot;
    const result = session.settle();
    expect(gapKg).toBeGreaterThan(0);
    expect(result).toMatchObject({needKg,availableKg,gapKg});
    expect(result.sentence).toContain('仍缺');
  });

  it('does not touch global GameState or either real save slot', () => {
    const write = vi.fn();
    vi.stubGlobal('localStorage',{getItem:vi.fn(),setItem:write});
    const before = gameState.toData();
    const session = new TutorialWeek();
    session.act({kind:'graze',cellId:'P1'});
    session.settle();
    expect(gameState.toData()).toEqual(before);
    expect(write).not.toHaveBeenCalled();
  });

  it('supports a fixed purchase but cannot afford two offered purchases', () => {
    const session = new TutorialWeek();
    expect(session.act({kind:'buy-hay',kg:200})).toBe(true);
    expect(session.act({kind:'buy-hay',kg:200})).toBe(false);
    expect(session.act({kind:'buy-hay',kg:session.snapshot.topUpKg})).toBe(false);
    expect(session.act({kind:'graze',cellId:'P1'})).toBe(true);
    expect(session.snapshot.gapKg).toBe(0);
    expect(session.snapshot.availableKg).toBe(500);
  });

  it('returns state copies so an external view cannot alter the practice', () => {
    const session = new TutorialWeek();
    const copy = session.state;
    copy.money = 999999;
    copy.animals[0].weightKg = 1;
    expect(session.state.money).toBe(500);
    expect(session.state.animals[0].weightKg).toBe(300);
  });
});

describe('教学 UI 偏好', () => {
  it('rejects damaged preference data and offers the invitation only once', () => {
    const store = new Map<string,string>([['muyun-tutorial-ui-v1','{broken']]);
    vi.stubGlobal('localStorage',{getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>store.set(k,v)});
    expect(tutorialPreferences()).toEqual({offered:false,completed:false});
    expect(offerTutorialOnce()).toBe(true);
    expect(offerTutorialOnce()).toBe(false);
    expect(store.has('muyun-save')).toBe(false);
    expect(store.has('muyun-save-winter')).toBe(false);
  });

  it('stores completion in the independent UI key and does not invite again', () => {
    const store = new Map<string,string>();
    vi.stubGlobal('localStorage',{getItem:(key:string)=>store.get(key)??null,setItem:(key:string,value:string)=>store.set(key,value)});
    completeTutorial();
    expect(tutorialPreferences()).toEqual({offered:true,completed:true});
    expect(offerTutorialOnce()).toBe(false);
    expect([...store.keys()]).toEqual(['muyun-tutorial-ui-v1']);
  });

  it('falls back for missing optional flags, arrays and malformed flag types', () => {
    for (const raw of ['{}','[]','null','{"offered":"true","completed":1}']) {
      vi.stubGlobal('localStorage',{getItem:()=>raw,setItem:vi.fn()});
      expect(tutorialPreferences()).toEqual({offered:false,completed:false});
    }
  });

  it('keeps a single invitation for this page if writes are unavailable', () => {
    vi.stubGlobal('localStorage',{getItem:()=>null,setItem:()=>{throw new Error('quota');}});
    expect(offerTutorialOnce()).toBe(true);
    expect(offerTutorialOnce()).toBe(false);
    completeTutorial();
    expect(tutorialPreferences()).toEqual({offered:true,completed:true});
  });
});
