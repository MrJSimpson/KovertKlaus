import { getSecureRandomInt } from './security';

/**
 * Thematic Espionage & Holiday Codename Generator
 * Used by landing page registration form and AccountPreferencesModal for random codename suggestions.
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
  const index = getSecureRandomInt(CALLSIGNS.length);
  return CALLSIGNS[index];
}
