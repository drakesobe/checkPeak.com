import { AirtableConnect } from '@theo-dev/airtable-connect';

const airtable = new AirtableConnect({
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, name, email } = req.body;
  if (!token || !name || !email)
    return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Find athlete by token
    const [athlete] = await airtable.select('Athletes', {
      filterByFormula: `{Invite Token}='${token}'`,
    });
    if (!athlete) return res.status(404).json({ error: 'Invalid token' });

    // Find the organization associated with this token
    const [org] = await airtable.select('Organizations', {
      filterByFormula: `{Org Token}='${token}'`,
    });

    const orgName = org ? org.Name : '';

    // Update athlete info and assign organization
    await airtable.update('Athletes', athlete.id, {
      Name: name,
      Email: email,
      'Invite Token': '',
      'Team/Organization': orgName,
    });

    res.status(200).json({ success: true, athleteId: athlete.id, organization: orgName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign up athlete' });
  }
}
