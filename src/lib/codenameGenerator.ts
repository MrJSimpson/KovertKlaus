/**
 * Thematic Espionage & Holiday Codename Generator
 */

const CALLSIGNS = [
  'Viper',
  'Phoenix',
  'Falcon',
  'Sovereign',
  'Sentinel',
  'Spectre',
  'Shadow',
  'Vanguard',
  'Winter',
  'Klaus-Alpha',
  'Frostbyte',
  'Evergreen',
  'Blizzard',
  'Raven',
  'Chimera',
  'Polaris',
  'Starlight',
  'Cipher',
  'Gloom',
  'Northstar',
  'Avalanche',
  'Solstice',
];

export function generateRandomCodename(): string {
  const index = Math.floor(Math.random() * CALLSIGNS.length);
  return CALLSIGNS[index];
}
