import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import NavBar from '../../components/NavBar';

export default function AthleteSignupPage() {
  const router = useRouter();
  const { token } = router.query;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch organization info based on token
  useEffect(() => {
    if (!token) return;

    const fetchOrg = async () => {
      try {
        const res = await fetch(`/api/get-org-by-token?token=${token}`);
        const data = await res.json();
        if (data.success) {
          setOrgName(data.organization);
        } else {
          setOrgName('Unknown Organization');
        }
      } catch (err) {
        console.error('Failed to fetch org:', err);
        setOrgName('Unknown Organization');
      }
    };

    fetchOrg();
  }, [token]);

  const handleSignup = async () => {
    if (!name || !email) return alert('Please fill out all fields');
    setLoading(true);

    try {
      const res = await fetch('/api/athlete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, email }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`Account created successfully for ${data.organization || 'your team'}!`);
        router.push('/ocr'); // redirect to OCR page
      } else {
        alert(data.error || 'Signup failed');
      }
    } catch (err) {
      console.error(err);
      alert('Signup failed due to server error');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <NavBar activeTab="" />
      <div className="max-w-md w-full bg-white shadow-lg rounded-xl p-8">
        <h1 className="text-2xl font-bold mb-2 text-center">Athlete Signup</h1>
        <p className="text-gray-600 mb-6 text-center">
          Join your organization's PEAK account: <strong>{orgName || 'Loading...'}</strong>
        </p>

        <input
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full mb-4 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <input
          type="email"
          placeholder="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-6 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <button
          onClick={handleSignup}
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </div>
    </div>
  );
}
