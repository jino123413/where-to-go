export type DirectionId = 'east' | 'west' | 'south' | 'north';

export interface Direction {
  id: DirectionId;
  name: string;
  label: string;
  theme: string;
  color: string;
  angle: number;
}

export interface TravelDataSet {
  directionId: DirectionId;
  scenario: string;
  mainSpot: { name: string; tag: string };
  subSpot: { name: string; tag: string };
  narinTip: string;
  hiddenGem: { name: string; desc: string };
}

export interface TravelResult {
  direction: Direction;
  dataSet: TravelDataSet;
  date: string;
}

export interface DirectionPool {
  directionId: DirectionId;
  spots: { name: string; tag: string }[];
  scenarios: string[];
  narinTips: string[];
  hiddenGems: { name: string; desc: string }[];
}

export interface JournalEntry {
  date: string;
  directionId: DirectionId;
  directionName: string;
  mainSpot: string;
  subSpot: string;
  timestamp: number;
}

export interface StampCollection {
  month: string;
  collected: DirectionId[];
}

export const DIRECTIONS: Record<DirectionId, Direction> = {
  east:   { id: 'east',   name: '동', label: '東', theme: '자연/숲/산',     color: '#2DD4BF', angle: 90 },
  west:   { id: 'west',   name: '서', label: '西', theme: '바다/해안',      color: '#64748B', angle: 270 },
  south:  { id: 'south',  name: '남', label: '南', theme: '도시/문화/축제', color: '#F97316', angle: 180 },
  north:  { id: 'north',  name: '북', label: '北', theme: '힐링/온천/고요', color: '#1E293B', angle: 0 },
};
