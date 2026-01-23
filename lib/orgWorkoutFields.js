// Central place to align code with Airtable field names.
// If anything differs in Airtable, edit it here (not across 10 API files).

export const F = {
  // Organizations table fields
  ORG_TOKEN: "Token",
  ORG_NAME: "Name",

  // OrgMembers table fields
  MEMBER_EMAIL: "Email",
  MEMBER_ROLE: "Role",            // admin | trainer
  MEMBER_NAME: "Name",
  MEMBER_ACTIVE: "Active",        // checkbox
  MEMBER_ORG: "Organization",     // linked -> Organizations

  // Athletes table fields (you already have these)
  ATH_EMAIL: "Email",
  ATH_ORG: "Organization",        // linked -> Organizations

  // DailyWorkouts
  DW_ORG: "Organization",         // linked -> Organizations
  DW_ATHLETE: "Athlete",          // linked -> Athletes
  DW_DATE: "Date",                // date
  DW_TITLE: "Title",
  DW_STATUS: "Status",            // assigned | completed | draft
  DW_CREATEDBY: "CreatedBy",      // linked -> OrgMembers

  // WorkoutItems
  WI_ORG: "Organization",         // linked -> Organizations
  WI_DW: "DailyWorkout",          // linked -> DailyWorkouts
  WI_ORDER: "Order",
  WI_NAME: "ExerciseName",
  WI_SETS: "Sets",
  WI_REPS: "Reps",
  WI_LOAD: "Load",
  WI_RPE: "RPE",
  WI_REST: "Rest",
  WI_INSTRUCTIONS: "Instructions",
  WI_VIDEO: "VideoURL",
  WI_EVIDENCE: "EvidenceRequired", // none | photo | video | photo_or_video

  // WorkoutCompletions
  WC_ORG: "Organization",         // linked -> Organizations
  WC_ITEM: "WorkoutItem",         // linked -> WorkoutItems
  WC_ATHLETE: "Athlete",          // linked -> Athletes
  WC_STATUS: "Status",            // completed | pending_review | rejected
  WC_COMPLETEDAT: "CompletedAt",
  WC_REVIEWEDBY: "ReviewedBy",    // linked -> OrgMembers
  WC_REVIEWNOTE: "ReviewNote",

  // CompletionEvidence
  EV_ORG: "Organization",         // linked -> Organizations
  EV_COMPLETION: "Completion",    // linked -> WorkoutCompletions
  EV_TYPE: "Type",                // photo | video
  EV_FILEURL: "FileURL",          // url
  EV_UPLOADEDAT: "UploadedAt",
};
