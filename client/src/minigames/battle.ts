import petsData from '../data/pets.json';
import skillsData from '../data/skills.json';
import type { PetDef, PetType, SkillDef } from '../types';

const pets = petsData as PetDef[];
const skills = skillsData as SkillDef[];

export interface BattlePet extends PetDef {
  maxHp: number;
  currentHp: number;
}

export interface BattleState {
  player: BattlePet;
  enemy: BattlePet;
  over: boolean;
  win: boolean | null;
  turn: number;
}

export interface BattleEvent {
  actor: 'player' | 'enemy';
  skill: SkillDef;
  damage: number;
  multiplier: number;
  targetHp: number;
}

export function petById(id: string): PetDef | undefined {
  return pets.find((p) => p.id === id);
}

export function skillById(id: string): SkillDef | undefined {
  return skills.find((s) => s.id === id);
}

export function typeMultiplier(attack: PetType, defend: PetType): number {
  if (attack === defend) return 1;
  if (attack === 'orange' && defend === 'black') return 1.5;
  if (attack === 'black' && defend === 'white') return 1.5;
  if (attack === 'white' && defend === 'orange') return 1.5;
  return 0.75;
}

export function calcDamage(attacker: BattlePet, defender: BattlePet, skill: SkillDef, rng: () => number = Math.random): number {
  const multiplier = typeMultiplier(skill.type, defender.type);
  const variance = 0.85 + rng() * 0.15;
  return Math.max(1, Math.round(skill.power * multiplier * variance - defender.defense * 0.6));
}

export function makeBattlePet(id: string): BattlePet {
  const def = petById(id);
  if (!def) throw new Error(`unknown pet: ${id}`);
  return { ...def, maxHp: def.hp, currentHp: def.hp };
}

export function createBattle(playerPetId: string, enemyPetId = 'trainer_black'): BattleState {
  return {
    player: makeBattlePet(playerPetId),
    enemy: makeBattlePet(enemyPetId),
    over: false,
    win: null,
    turn: 1,
  };
}

export function resolveTurn(state: BattleState, playerSkillId: string, rng: () => number = Math.random): BattleEvent[] {
  if (state.over) return [];
  const playerSkill = skillById(playerSkillId);
  if (!playerSkill || !state.player.skills.includes(playerSkillId)) return [];
  const enemySkillId = state.enemy.skills[Math.floor(rng() * state.enemy.skills.length)] ?? state.enemy.skills[0];
  const enemySkill = skillById(enemySkillId)!;
  const playerFirst = state.player.speed >= state.enemy.speed;
  const events: BattleEvent[] = [];

  const strike = (actor: 'player' | 'enemy'): void => {
    const attacker = actor === 'player' ? state.player : state.enemy;
    const defender = actor === 'player' ? state.enemy : state.player;
    if (attacker.currentHp <= 0 || defender.currentHp <= 0) return;
    const skill = actor === 'player' ? playerSkill : enemySkill;
    const damage = calcDamage(attacker, defender, skill, rng);
    defender.currentHp = Math.max(0, defender.currentHp - damage);
    events.push({
      actor,
      skill,
      damage,
      multiplier: typeMultiplier(skill.type, defender.type),
      targetHp: defender.currentHp,
    });
  };

  if (playerFirst) {
    strike('player');
    strike('enemy');
  } else {
    strike('enemy');
    strike('player');
  }

  state.turn += 1;
  if (state.enemy.currentHp <= 0 || state.player.currentHp <= 0) {
    state.over = true;
    state.win = state.enemy.currentHp <= 0 && state.player.currentHp > 0;
  }
  return events;
}

export function hpRatio(pet: BattlePet): number {
  return Math.max(0, pet.currentHp / pet.maxHp);
}
