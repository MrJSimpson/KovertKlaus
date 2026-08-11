/**
 * KovertKlaus Dynamic Presentation & Terminology Translation Layer
 * Maps generic DB entities (Exchange, User, PenaltyPoints, Milestones) to active Theme UI labels.
 */

export interface Terminology {
  // Theme & Mode Meta
  modeName: string; // "Klaus Mode" vs "Kovert Mode"
  toggleButtonText: string; // "🕶️ Kovert Mode" (in Light) vs "🎅 Klaus Mode" (in Dark)
  themeBannerText: string;
  themeConceptHeadline: string;
  themeConceptBody: string;

  // Roles
  organizerRole: string; // "Head Elf" vs "Director"
  participantRole: string; // "Elf Agent" (or "Agent" for short)
  organizerRoleTitle: string; // "Head Elf" vs "Director"

  // Naughty List & Penalty System
  naughtyListSectionHeader: string; // "Santa's Naughty List" vs "Agent Performance Log"
  penaltyUnitSingular: string; // "Lump of Coal" vs "Coal Point"
  penaltyUnitPlural: string; // "Lumps of Coal" vs "Coal Points"
  cleanStandingLabel: string; // "Clean Standing (0 Lumps of Coal 🟢)"
  assignPenaltyAction: string; // "Assign Lump of Coal" vs "Issue Coal Point"
  penaltyNoticeText: string; // Notice explaining penalty rules
  immunityWaiverLabel: string; // "Santa's Immunity Waiver Active" vs "Carrier Protection Waiver Active"

  // Privacy & Dossier Permission Toggles (For Assigned Giver / Secret Santa)
  privacySizesToggle: string;
  privacyMeasurementsToggle: string;
  privacyAllergiesToggle: string;
  privacyFavoritesToggle: string;

  // Milestones & Dates
  cutoffLabel: string; // "RSVP Cutoff Date" vs "Mission Launch Cutoff"
  cutoffSublabel: string; // "(Final Headcount)" vs "(Go/No-Go Window)"
  assignmentLabel: string; // "Secret Santa Match" vs "Secret Target Briefing"
  assignmentSublabel: string; // "(Targets Drawn)" vs "(Sattolo Draw)"
  shippingLabel: string; // "Santa's Sleigh Departure" vs "Package Dispatch Window"
  shippingSublabel: string; // "(Gifts In-Transit)" vs "(Tracking Proof Required)"
  executionLabel: string; // "Gift Exchange Party" vs "Mission Execution Date"
  executionSublabel: string; // "(Unwrapping Day)" vs "(Event Day)"

  // General Terminology
  exchangeLabel: string; // "Gift Exchange" vs "Operation"
  exchangeCodeLabel: string; // "Exchange Code" vs "Operation Code"
  wishlistLabel: string; // "Wishlist" vs "OpKit"
  itemLabel: string; // "Wished-For Gift" vs "OpTool"
}

export function getTerminology(isDarkMode: boolean): Terminology {
  if (!isDarkMode) {
    // ☀️ Light Mode: Klaus Mode (Santa's Workshop - Whimsical)
    return {
      modeName: 'Klaus Mode',
      toggleButtonText: '🕶️ Kovert Mode',
      themeBannerText: '🎅 Whimsical Holiday Magic',
      themeConceptHeadline: 'SANTA NEEDS YOUR HELP TO DELIVER GIFTS!',
      themeConceptBody: 'Santa’s Head Elf has recruited you as an Elf Agent to give out gifts to your assigned target!',
      organizerRole: 'Head Elf',
      participantRole: 'Elf Agent',
      organizerRoleTitle: 'Head Elf',
      naughtyListSectionHeader: "Santa's Naughty List",
      penaltyUnitSingular: 'Lump of Coal',
      penaltyUnitPlural: 'Lumps of Coal',
      cleanStandingLabel: 'Clean Standing (0 Lumps of Coal 🟢)',
      assignPenaltyAction: 'Assign Lump of Coal',
      penaltyNoticeText: 'Keep your holiday commitments to stay on Santa’s Nice List!',
      immunityWaiverLabel: "Santa's Immunity Waiver Active",
      privacySizesToggle: 'Allow your assigned Secret Santa (Giver) to view clothing & shoe sizes',
      privacyMeasurementsToggle: 'Allow your assigned Secret Santa (Giver) to view body measurements',
      privacyAllergiesToggle: 'Allow your assigned Secret Santa (Giver) to view allergies & dietary notes',
      privacyFavoritesToggle: 'Allow your assigned Secret Santa (Giver) to view favorite colors & hobbies',
      cutoffLabel: 'RSVP Cutoff Date',
      cutoffSublabel: '(Final Headcount)',
      assignmentLabel: 'Secret Santa Match',
      assignmentSublabel: '(Targets Drawn)',
      shippingLabel: "Santa's Sleigh Departure",
      shippingSublabel: '(Gifts In-Transit)',
      executionLabel: 'Gift Exchange Party',
      executionSublabel: '(Unwrapping Day)',
      exchangeLabel: 'Gift Exchange',
      exchangeCodeLabel: 'Exchange Code',
      wishlistLabel: 'Wishlist',
      itemLabel: 'Gift',
    };
  } else {
    // 🌙 Dark Mode: Kovert Mode (Santa's Covert Ops - Agent Mode)
    return {
      modeName: 'Kovert Mode',
      toggleButtonText: '🎅 Klaus Mode',
      themeBannerText: '🕵️‍♂️ Playful Covert Intelligence',
      themeConceptHeadline: "SANTA'S SECRET MISSION INTEL",
      themeConceptBody: "Santa's Director has deployed you as a Covert Elf Agent to execute a secret gift operation for your assigned target!",
      organizerRole: 'Director',
      participantRole: 'Elf Agent',
      organizerRoleTitle: 'Director',
      naughtyListSectionHeader: 'Agent Performance Log',
      penaltyUnitSingular: 'Coal Point',
      penaltyUnitPlural: 'Coal Points',
      cleanStandingLabel: 'Clean Standing (0 Coal Points 🟢)',
      assignPenaltyAction: 'Issue Coal Point',
      penaltyNoticeText: 'Maintain dispatch deadlines to keep clean agent clearance!',
      immunityWaiverLabel: 'Carrier Protection Waiver Active',
      privacySizesToggle: 'Allow your assigned Covert Giver (Agent) to view clothing & shoe sizes',
      privacyMeasurementsToggle: 'Allow your assigned Covert Giver (Agent) to view body measurements',
      privacyAllergiesToggle: 'Allow your assigned Covert Giver (Agent) to view allergies & dietary notes',
      privacyFavoritesToggle: 'Allow your assigned Covert Giver (Agent) to view favorite colors & hobbies',
      cutoffLabel: 'Mission Launch Cutoff',
      cutoffSublabel: '(Go/No-Go Window)',
      assignmentLabel: 'Secret Target Briefing',
      assignmentSublabel: '(Sattolo Draw)',
      shippingLabel: 'Package Dispatch Window',
      shippingSublabel: '(Tracking Proof Required)',
      executionLabel: 'Mission Execution Date',
      executionSublabel: '(Event Day)',
      exchangeLabel: 'Operation',
      exchangeCodeLabel: 'Operation Code',
      wishlistLabel: 'Wishlist',
      itemLabel: 'Gift',
    };
  }
}
