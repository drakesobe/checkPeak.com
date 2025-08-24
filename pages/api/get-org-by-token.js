import { AirtableConnect } from '@theo-dev/airtable-connect';

const airtable = new AirtableConnect({
  apiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID,
});

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ success: false, error: 'Token is required' });

  try {
    const [org] = await airtable.select('Organizations', {
      filterByFormula: `{Org Token}='${token}'`,
    });

    if (!org) return res.status(404).json({ success: false, error: 'Organization not found' });

    res.status(200).json({ success: true, organization: org.Name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch organization' });
  }
}
