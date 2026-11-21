export type KidColor = "sky" | "rose" | "violet" | "amber" | "emerald" | "teal";

export type Kid = {
  id: string; // short slug, e.g. "bence"
  name: string; // display name
  fullName?: string;
  className?: string; // e.g. "3.c"
  school?: string;
  color: KidColor;
  emoji?: string;
  /** Mailing lists / Google Groups of the kid's class. Mail sent to these belongs to this kid. */
  classGroupEmails: string[];
};

export type ContactRole =
  | "class_teacher"
  | "subject_teacher"
  | "school_admin"
  | "parents_group"
  | "treasurer"
  | "club"
  | "family"
  | "other";

export type Contact = {
  id: string;
  name: string;
  emails: string[];
  role: ContactRole;
  subject?: string;
  kidIds: string[];
  note?: string;
};

export type FamilyConfig = {
  familyName: string;
  parents: { name: string; email: string }[];
  kids: Kid[];
  contacts: Contact[];
  /** Sender addresses / domains / subject markers used by the rule-based pre-classifier. */
  sources: {
    kreta: string[];
    szmk: string[];
    menza: string[];
    billers: string[];
    newsletters: string[];
    ignore: string[];
  };
  /** Free-text context for the AI (relationships, forwarding habits, house rules). */
  aiNotes: string;
};

export type Preferences = {
  /** Calendar where Family Hub writes events. */
  calendarId: string;
  /** Calendars read for the agenda and for free/busy when timeboxing. */
  readCalendarIds: string[];
  autoCalendar: boolean;
  minConfidenceForAuto: number;
  studyWindowWeekday: [string, string];
  studyWindowWeekend: [string, string];
  studyBlockMinutes: number;
  eveningPrepTime: string;
  initialSyncDays: number;
  maxEmailsPerRun: number;
  spotifyPlaylistId: string;
  spotifyPlaylistName: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  calendarId: "primary",
  readCalendarIds: ["primary"],
  autoCalendar: true,
  minConfidenceForAuto: 0.7,
  studyWindowWeekday: ["16:30", "19:30"],
  studyWindowWeekend: ["10:00", "12:00"],
  studyBlockMinutes: 30,
  eveningPrepTime: "19:30",
  initialSyncDays: 30,
  maxEmailsPerRun: 40,
  spotifyPlaylistId: "",
  spotifyPlaylistName: "Family Hub – meghallgatandó",
};

export const EMPTY_FAMILY: FamilyConfig = {
  familyName: "Család",
  parents: [],
  kids: [],
  contacts: [],
  sources: {
    kreta: ["e-kreta.hu", "ekreta.hu"],
    szmk: ["[szmk]", "szmk"],
    menza: [],
    billers: [],
    newsletters: ["substack.com"],
    ignore: [],
  },
  aiNotes: "",
};
