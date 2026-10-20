/**
 * @file codename-words.ts
 * @description The word lists mission codenames are built from: one adjective plus one noun.
 *
 * Tier 1 (what): `CODENAME_ADJECTIVES` and `CODENAME_NOUNS`, grouped by category. A codename is
 * `<Adjective> <Noun>` (e.g. `Snowy Spider`), displayed as `Agent: Snowy Spider`.
 * Tier 2 (why): Codenames are shown to families, including children, so every word is
 * reviewed: nothing explicit or easily read as innuendo, no relationship or status words
 * (mom, girlfriend, boss), no colors that could read as describing people (black, white, red,
 * yellow, brown), and no hyphens.
 * Tier 3 (how): Each entry is one capitalized word. `codename-words.test.ts` enforces the format,
 * uniqueness and a blocklist, so an unsafe addition fails the test suite. Add words to the
 * matching category; the pool grows by the size of the other list.
 */

/** Adjectives by category. */
export const ADJECTIVE_CATEGORIES = {
  friendly: [
    'Friendly', 'Cheerful', 'Jolly', 'Merry', 'Gentle', 'Kind', 'Happy', 'Sunny', 'Cozy', 'Brave',
    'Clever', 'Curious', 'Helpful', 'Plucky', 'Peppy', 'Chipper', 'Bright', 'Giggly', 'Polite', 'Loyal',
    'Lucky', 'Nimble', 'Swift', 'Witty', 'Zippy', 'Daring', 'Bold', 'Calm', 'Humble', 'Honest',
    'Hopeful', 'Joyful', 'Patient', 'Playful', 'Proud', 'Wise', 'Zany', 'Dapper', 'Spry', 'Snappy',
  ],
  stealthy: [
    'Silent', 'Quiet', 'Sneaky', 'Stealthy', 'Secret', 'Hidden', 'Mysterious', 'Covert', 'Undercover', 'Masked',
    'Cloaked', 'Tiptoe', 'Whispering', 'Incognito', 'Elusive', 'Shady', 'Sly', 'Nameless',
  ],
  spooky: [
    'Spooky', 'Shadowy', 'Ghostly', 'Haunted', 'Eerie', 'Misty', 'Foggy', 'Moonlit', 'Midnight', 'Cryptic',
    'Mystic', 'Spectral', 'Howling', 'Wandering', 'Gloomy', 'Batty', 'Witchy', 'Dusky', 'Cobweb', 'Starless',
  ],
  holiday: [
    'Festive', 'Twinkly', 'Sparkly', 'Glittering', 'Frosted', 'Sugarplum', 'Peppermint', 'Starry', 'Jingly', 'Yuletide',
    'Evergreen', 'Candlelit', 'Tinseled', 'Gingerbread', 'Wintergreen', 'Mistletoe', 'Wreathed', 'Ribboned', 'Cocoa', 'Eggnog',
  ],
  seasons: [
    'Wintry', 'Snowy', 'Frosty', 'Icy', 'Chilly', 'Blustery', 'Summery', 'Autumnal', 'Vernal', 'Springtime',
    'Harvest', 'Pumpkin', 'Maple', 'Blooming', 'Breezy', 'Sunlit', 'Rainy', 'Stormy', 'Thundering', 'Toasty',
    'Leafy', 'Drizzly', 'Snowbound', 'Polar', 'Arctic',
  ],
  visual: [
    'Tiny', 'Little', 'Mini', 'Mighty', 'Giant', 'Round', 'Fuzzy', 'Fluffy', 'Shiny', 'Glowing',
    'Golden', 'Silver', 'Crimson', 'Scarlet', 'Amber', 'Emerald', 'Sapphire', 'Cobalt', 'Indigo', 'Violet',
    'Purple', 'Teal', 'Turquoise', 'Ivory', 'Copper', 'Bronze', 'Striped', 'Spotted', 'Speckled', 'Plaid',
    'Checkered', 'Pastel', 'Neon', 'Glossy', 'Velvet', 'Crystal', 'Marble', 'Feathered', 'Tall', 'Gleaming',
  ],
} as const;

/** Nouns by category. */
export const NOUN_CATEGORIES = {
  animals: [
    'Penguin', 'Puffin', 'Narwhal', 'Walrus', 'Owl', 'Fox', 'Wolf', 'Hawk', 'Falcon', 'Raven',
    'Seal', 'Orca', 'Dolphin', 'Panda', 'Koala', 'Lemur', 'Llama', 'Alpaca', 'Badger', 'Hedgehog',
    'Squirrel', 'Chipmunk', 'Raccoon', 'Otter', 'Lynx', 'Bobcat', 'Tiger', 'Lion', 'Panther', 'Jaguar',
    'Cheetah', 'Elephant', 'Giraffe', 'Zebra', 'Hippo', 'Rhino', 'Turtle', 'Tortoise', 'Gecko', 'Iguana',
    'Chameleon', 'Frog', 'Toad', 'Salamander', 'Octopus', 'Squid', 'Jellyfish', 'Starfish', 'Crab', 'Lobster',
    'Shark', 'Whale', 'Manatee', 'Spider', 'Beetle', 'Firefly', 'Bumblebee', 'Butterfly', 'Moth', 'Dragonfly',
    'Ant', 'Cricket', 'Mantis', 'Bat', 'Crow', 'Magpie', 'Robin', 'Hummingbird', 'Sparrow', 'Finch',
    'Wren', 'Heron', 'Pelican', 'Flamingo', 'Toucan', 'Parrot', 'Albatross', 'Duck', 'Swan', 'Ferret',
    'Mongoose', 'Meerkat', 'Armadillo', 'Sloth', 'Yak', 'Bison', 'Caribou', 'Reindeer', 'Moose', 'Elk',
    'Goat', 'Lamb', 'Pony', 'Kangaroo', 'Wombat', 'Platypus', 'Mammoth', 'Hamster', 'Mole', 'Bear',
  ],
  roles: [
    'Agent', 'Spy', 'Operator', 'Pirate', 'Ninja', 'Detective', 'Ranger', 'Scout', 'Courier', 'Sentinel',
    'Sheriff', 'Knight', 'Wizard', 'Pilot', 'Navigator', 'Astronaut', 'Explorer', 'Inventor', 'Chef', 'Baker',
    'Lumberjack', 'Captain', 'Commander', 'Cowboy', 'Bandit', 'Samurai', 'Viking', 'Musketeer', 'Archer', 'Jester',
    'Magician', 'Sailor', 'Tracker', 'Lookout', 'Messenger', 'Watchman', 'Cartographer', 'Tinkerer', 'Codebreaker', 'Sleuth',
  ],
  imaginary: [
    'Unicorn', 'Leprechaun', 'Chupacabra', 'Elf', 'Yeti', 'Dragon', 'Griffin', 'Phoenix', 'Gnome', 'Troll',
    'Goblin', 'Pixie', 'Mermaid', 'Kraken', 'Sasquatch', 'Bigfoot', 'Ghost', 'Banshee', 'Specter', 'Golem',
    'Sprite', 'Snowman', 'Jackalope', 'Hippogriff', 'Centaur', 'Cyclops', 'Gremlin', 'Hobgoblin', 'Imp', 'Genie',
    'Ogre', 'Wyvern', 'Pegasus', 'Thunderbird', 'Mothman', 'Krampus', 'Robot', 'Wendigo', 'Basilisk', 'Kelpie',
  ],
} as const;

/** Every adjective, in category order. */
export const CODENAME_ADJECTIVES: readonly string[] = Object.values(ADJECTIVE_CATEGORIES).flat();

/** Every noun, in category order. */
export const CODENAME_NOUNS: readonly string[] = Object.values(NOUN_CATEGORIES).flat();
