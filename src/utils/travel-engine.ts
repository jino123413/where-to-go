import { DirectionId, TravelResult, TravelDataSet, DIRECTIONS } from '../types';
import { DIRECTION_POOLS } from '../data/travel-data';

function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tomorrowKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const DIRECTION_ORDER: DirectionId[] = ['east', 'west', 'south', 'north'];

export function calculateTravel(deviceId: string, dateKey?: string): TravelResult {
  const date = dateKey ?? todayKey();
  const seed = `${deviceId}@${date}`;

  const hash1 = hashString(seed);
  const dirIndex = hash1 % 4;
  const dirId = DIRECTION_ORDER[dirIndex];
  const direction = DIRECTIONS[dirId];

  const pool = DIRECTION_POOLS.find((p) => p.directionId === dirId)!;

  // Pick main spot
  const hash2 = hashString(`${seed}:spot`);
  const mainIdx = hash2 % pool.spots.length;

  // Pick sub spot (avoid same as main)
  const hash3 = hashString(`${seed}:sub`);
  let subIdx = hash3 % (pool.spots.length - 1);
  if (subIdx >= mainIdx) subIdx++;

  // Pick scenario template and fill in spot names
  const hash4 = hashString(`${seed}:scenario`);
  const template = pool.scenarios[hash4 % pool.scenarios.length];
  const scenario = template
    .replace('{main}', pool.spots[mainIdx].name)
    .replace('{sub}', pool.spots[subIdx].name);

  // Pick tip and hidden gem
  const hash5 = hashString(`${seed}:tip`);
  const hash6 = hashString(`${seed}:gem`);

  const dataSet: TravelDataSet = {
    directionId: dirId,
    scenario,
    mainSpot: pool.spots[mainIdx],
    subSpot: pool.spots[subIdx],
    narinTip: pool.narinTips[hash5 % pool.narinTips.length],
    hiddenGem: pool.hiddenGems[hash6 % pool.hiddenGems.length],
  };

  return { direction, dataSet, date };
}
