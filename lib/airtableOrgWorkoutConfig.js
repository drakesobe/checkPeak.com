// lib/airtableOrgWorkoutConfig.js
import Airtable from "airtable";

export const AT = {
  apiKey: process.env.ORGANIZATIONS_API_KEY,
  baseId: "appspE640Pggw1VP9",

  tables: {
    orgs: process.env.ORGANIZATIONS_TABLE_NAME,
    orgMembers: "tblRvpw7XeVZfdKIq",

    // Workouts
    dailyWorkouts: "tblLuSkpxxrTHGhXZ",
    workoutItems: "tblhhjFTeB0I7dxjS",
    workoutCompletions: "tbljis6BzH1DasOXa",
    completionEvidence: "tbl3QN5XmZGmVh9Mn",

    // ✅ Athletes table is in THIS base
    athletes: "tblyfqbVBXKR7jPEz",
  },
};

export function base() {
  if (!AT.apiKey) throw new Error("Missing ORGANIZATIONS_API_KEY");
  if (!AT.baseId) throw new Error("Missing baseId");
  return new Airtable({ apiKey: AT.apiKey }).base(AT.baseId);
}

export function escapeAirtableString(str = "") {
  return String(str).replace(/'/g, "\\'");
}

export const F = {
  // Organizations
  ORG_TOKEN: "Token",
  ORG_NAME: "Name",

  // Athletes
  ATH_EMAIL: "Email",
  ATH_ORG: "Organization", // linked record ✅

  // Athletes
  ATH_TOKEN: "AthleteToken",

  // DailyWorkouts
  DW_ATHTOKEN: "AthleteToken",

  // WorkoutItems (optional)
  WI_ATHTOKEN: "AthleteToken",

  // OrgMembers
  MEM_EMAIL: "Email",
  MEM_ROLE: "Role",
  MEM_ORG: "Organization",
  MEM_NAME: "Name",
  MEM_ACTIVE: "Active",
  MEM_PWHASH: "PasswordHash",

  // DailyWorkouts
  DW_ORG: "Organization",
  DW_ATHLETE: "Athlete",
  DW_DATE: "Date",
  DW_TITLE: "Title",
  DW_CREATEDBY: "CreatedBy",
  DW_STATUS: "Status",

  // WorkoutItems
  WI_ORG: "Organization",
  WI_DW: "DailyWorkout",
  WI_ORDER: "Order",
  WI_NAME: "ExerciseName",
  WI_SETS: "Sets",
  WI_REPS: "Reps",
  WI_LOAD: "Load",
  WI_RPE: "RPE",
  WI_REST: "Rest",
  WI_INSTR: "Instructions",
  WI_VIDEO: "VideoURL",
  WI_EVIDENCE: "EvidenceRequired",

  // WorkoutCompletions
  WC_ORG: "Organization",
  WC_ITEM: "WorkoutItem",
  WC_ATHLETE: "Athlete",
  WC_STATUS: "Status",
  WC_COMPLETEDAT: "CompletedAt",
  WC_REVIEWNOTE: "ReviewNote",
  WC_REVIEWEDBY: "ReviewedBy",

  // CompletionEvidence
  EV_ORG: "Organization",
  EV_COMPLETION: "Completion",
  EV_TYPE: "Type",
  EV_FILEURL: "FileURL",
  EV_UPLOADEDAT: "UploadedAt",
};
