/**
 * KovertKlaus Dynamic Presentation & Terminology Translation Layer
 * Maps generic DB entities (Exchange, User, PenaltyPoints, Milestones) to canonical Theme UI labels.
 */

export interface Terminology {
  // Theme & Mode Meta
  modeName: string; // "Klaus Mode" vs "Kovert Mode"
  toggleButtonText: string; // "🕶️ Kovert Mode" (in Light) vs "🎅 Klaus Mode" (in Dark)
  themeBannerText: string;
  themeConceptHeadline: string;
  themeConceptBody: string;

  // Canonical Roles
  organizerRole: string; // "Head Elf"
  participantRole: string; // "Elf Agent"
  organizerRoleTitle: string; // "Head Elf"

  // Naughty List & Penalty System (Coal Citations)
  naughtyListSectionHeader: string; // "Santa's Naughty List" vs "Agent Compliance Log"
  penaltyUnitSingular: string; // "Coal Citation"
  penaltyUnitPlural: string; // "Coal Citations"
  cleanStandingLabel: string; // "Clean Standing (0 Coal Citations 🟢)"
  assignPenaltyAction: string; // "Issue Coal Citation"
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

  // Canonical Domain Nomenclature
  exchangeLabel: string; // "Holiday Mission"
  exchangeCodeLabel: string; // "Mission Code"
  wishlistLabel: string; // "Wishlist Manifest"
  itemLabel: string; // "Manifest Item"
}

export function getTerminology(isDarkMode: boolean): Terminology {
  if (!isDarkMode) {
    // ☀️ Light Mode: Klaus Mode (Santa's Workshop - Whimsical)
    return {
      modeName: 'Klaus Mode',
      toggleButtonText: '🕶️ Kovert Mode',
      themeBannerText: '🎅 Whimsical Holiday Magic',
      themeConceptHeadline: 'SANTA NEEDS YOUR HELP TO DELIVER GIFTS!',
      themeConceptBody: 'Santa’s Head Elf has recruited you as an Elf Agent to execute a secret Holiday Mission for your assigned target!',
      organizerRole: 'Head Elf',
      participantRole: 'Elf Agent',
      organizerRoleTitle: 'Head Elf',
      naughtyListSectionHeader: "Santa's Naughty List",
      penaltyUnitSingular: 'Coal Citation',
      penaltyUnitPlural: 'Coal Citations',
      cleanStandingLabel: 'Clean Standing (0 Coal Citations 🟢)',
      assignPenaltyAction: 'Issue Coal Citation',
      penaltyNoticeText: 'Keep your holiday commitments to stay on Santa’s Nice List!',
      immunityWaiverLabel: "Santa's Immunity Waiver Active",
      privacySizesToggle: 'Allow your assigned Secret Santa (Elf Agent) to view clothing & shoe sizes',
      privacyMeasurementsToggle: 'Allow your assigned Secret Santa (Elf Agent) to view body measurements',
      privacyAllergiesToggle: 'Allow your assigned Secret Santa (Elf Agent) to view allergies & dietary notes',
      privacyFavoritesToggle: 'Allow your assigned Secret Santa (Elf Agent) to view favorite colors & hobbies',
      cutoffLabel: 'RSVP Cutoff Date',
      cutoffSublabel: '(Final Headcount)',
      assignmentLabel: 'Secret Santa Match',
      assignmentSublabel: '(Targets Drawn)',
      shippingLabel: "Santa's Sleigh Departure",
      shippingSublabel: '(Gifts In-Transit)',
      executionLabel: 'Holiday Mission Exchange Party',
      executionSublabel: '(Unwrapping Day)',
      exchangeLabel: 'Holiday Mission',
      exchangeCodeLabel: 'Mission Code',
      wishlistLabel: 'Wishlist Manifest',
      itemLabel: 'Manifest Item',
    };
  } else {
    // 🌙 Dark Mode: Kovert Mode (Santa's Covert Ops - Agent Mode)
    return {
      modeName: 'Kovert Mode',
      toggleButtonText: '🎅 Klaus Mode',
      themeBannerText: '🕵️‍♂️ Playful Covert Intelligence',
      themeConceptHeadline: "SANTA'S SECRET MISSION INTEL",
      themeConceptBody: "Santa's Head Elf has deployed you as a Covert Elf Agent to execute a secret Holiday Mission for your assigned target!",
      organizerRole: 'Head Elf',
      participantRole: 'Elf Agent',
      organizerRoleTitle: 'Head Elf (Director)',
      naughtyListSectionHeader: 'Elf Agent Compliance Log',
      penaltyUnitSingular: 'Coal Citation',
      penaltyUnitPlural: 'Coal Citations',
      cleanStandingLabel: 'Clean Standing (0 Coal Citations 🟢)',
      assignPenaltyAction: 'Issue Coal Citation',
      penaltyNoticeText: 'Maintain dispatch deadlines to keep clean agent clearance!',
      immunityWaiverLabel: 'Carrier Protection Waiver Active',
      privacySizesToggle: 'Allow your assigned Covert Giver (Elf Agent) to view clothing & shoe sizes',
      privacyMeasurementsToggle: 'Allow your assigned Covert Giver (Elf Agent) to view body measurements',
      privacyAllergiesToggle: 'Allow your assigned Covert Giver (Elf Agent) to view allergies & dietary notes',
      privacyFavoritesToggle: 'Allow your assigned Covert Giver (Elf Agent) to view favorite colors & hobbies',
      cutoffLabel: 'Mission Launch Cutoff',
      cutoffSublabel: '(Go/No-Go Window)',
      assignmentLabel: 'Secret Target Briefing',
      assignmentSublabel: '(Sattolo Draw)',
      shippingLabel: 'Package Dispatch Window',
      shippingSublabel: '(Tracking Proof Required)',
      executionLabel: 'Holiday Mission Execution Date',
      executionSublabel: '(Event Day)',
      exchangeLabel: 'Holiday Mission',
      exchangeCodeLabel: 'Mission Code',
      wishlistLabel: 'Wishlist Manifest',
      itemLabel: 'Manifest Item',
    };
  }
}

