import { AirtableConnect } from '@theo-dev/airtable-connect';

const airtable = new AirtableConnect({
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { orgName, contactName, email, password, token } = req.body;

  if (!orgName || !contactName || !email || !password || !token) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Check if org already exists
    const [existingOrg] = await airtable.select('Organizations', {
      filterByFormula: `{Name}='${orgName}'`,
    });

    if (existingOrg) {
      return res.status(400).json({ error: 'Organization already exists' });
    }

    // Create new org
    const newOrg = await airtable.create('Organizations', {
      Name: orgName,
      'Head Coach/Trainer': contactName,
      Email: email,
      Password: password, // TODO: hash password in production
      'Org Token': token,
    });

    res.status(200).json({ success: true, orgId: newOrg.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create organization' });
  }
}
