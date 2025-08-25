import Airtable from "airtable";

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export async function getUserByEmail(email) {
  try {
    const records = await base(process.env.AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: `{Email} = '${email}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (!records || records.length === 0) return null;

    const record = records[0];
    return {
      id: record.id,
      name: record.get("Name"),
      email: record.get("Email"),
      team: record.get("Team/Organization"),
      role: record.get("Role"),
      scans: record.get("Scans"),
      inviteToken: record.get("Invite Token"),
    };
  } catch (error) {
    console.error("Error fetching user from Airtable:", error);
    return null;
  }
}
