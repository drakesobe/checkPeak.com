import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '../components/NavBar';
import { 
  FaUserPlus, FaUpload, FaCheckCircle, FaHourglassHalf, 
  FaSearch, FaChevronLeft, FaChevronRight, FaSort, FaSortUp, FaSortDown 
} from 'react-icons/fa';

export default function OrganizationPage() {
  const [athletes, setAthletes] = useState([]);
  const [filteredAthletes, setFilteredAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sorting
  const [sortField, setSortField] = useState(null); // 'Name', 'Email', 'Status'
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

  useEffect(() => {
    fetch('/api/get-athletes')
      .then((res) => res.json())
      .then((data) => {
        const athletesData = data?.athletes || [];
        setAthletes(athletesData);
        setFilteredAthletes(athletesData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch athletes', err);
        setAthletes([]);
        setFilteredAthletes([]);
        setLoading(false);
      });
  }, []);

  // Search & Filter
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = (athletes || []).filter((a) => {
      const name = a.fields?.Name?.toLowerCase() || '';
      const email = a.fields?.Email?.toLowerCase() || '';
      const status = a.fields?.Email
        ? 'signed up'
        : a.fields?.['Invite Token']
        ? 'pending'
        : 'none';
      return name.includes(query) || email.includes(query) || status.includes(query);
    });
    setFilteredAthletes(filtered);
    setCurrentPage(1); // Reset to first page on search
  }, [searchQuery, athletes]);

  // Sorting Function
  const handleSort = (field) => {
    const isAsc = sortField === field && sortDirection === 'asc';
    setSortField(field);
    setSortDirection(isAsc ? 'desc' : 'asc');

    const sorted = [...(filteredAthletes || [])].sort((a, b) => {
      let aVal, bVal;
      if (field === 'Status') {
        const getStatus = (ath) => (ath.fields?.Email ? 2 : ath.fields?.['Invite Token'] ? 1 : 0);
        aVal = getStatus(a);
        bVal = getStatus(b);
      } else {
        aVal = (a.fields?.[field] || '').toLowerCase();
        bVal = (b.fields?.[field] || '').toLowerCase();
      }

      if (aVal < bVal) return isAsc ? 1 : -1;
      if (aVal > bVal) return isAsc ? -1 : 1;
      return 0;
    });

    setFilteredAthletes(sorted);
  };

  const generateInvite = async (athleteId) => {
    setGeneratingId(athleteId);
    try {
      const res = await fetch('/api/generate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId }),
      });
      const data = await res.json();
      if (data.link) {
        alert(`Invite link copied to clipboard:\n\n${data.link}`);
        navigator.clipboard.writeText(data.link);
        setAthletes((prev) =>
          prev.map((a) => (a.id === athleteId ? { ...a, fields: { ...a.fields, 'Invite Token': data.token } } : a))
        );
      } else {
        alert('Failed to generate invite.');
      }
    } catch (err) {
      console.error(err);
      alert('Error generating invite.');
    }
    setGeneratingId(null);
  };

  // Safe Pagination logic
  const safeFiltered = filteredAthletes || [];
  const totalPages = Math.ceil(safeFiltered.length / itemsPerPage);
  const displayedAthletes = safeFiltered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderSortIcon = (field) => {
    if (sortField !== field) return <FaSort className="inline ml-1 text-gray-400" />;
    return sortDirection === 'asc' ? <FaSortUp className="inline ml-1 text-gray-400" /> : <FaSortDown className="inline ml-1 text-gray-400" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar activeTab="SmartStack" />
      <div className="max-w-6xl mx-auto py-16 px-4">
        <h1 className="text-4xl font-bold mb-6 text-center">Organization Dashboard</h1>

        {/* Search Bar */}
        <div className="flex items-center max-w-md mx-auto mb-8">
          <FaSearch className="text-gray-400 mr-2" />
          <input
            type="text"
            placeholder="Search athletes by name, email, or status..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {loading ? (
          <p className="text-center text-gray-600">Loading athletes...</p>
        ) : (
          <>
            <table className="w-full border-collapse shadow rounded-xl overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort('Name')}>
                    Name {renderSortIcon('Name')}
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort('Email')}>
                    Email {renderSortIcon('Email')}
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer" onClick={() => handleSort('Status')}>
                    Status {renderSortIcon('Status')}
                  </th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedAthletes.map((a) => {
                  const signedUp = !!a.fields?.Email;
                  const pendingInvite = !!a.fields?.['Invite Token'] && !signedUp;
                  return (
                    <tr key={a.id} className="border-b last:border-b-0 hover:bg-gray-50 transition">
                      <td className="px-4 py-3">{a.fields?.Name || '—'}</td>
                      <td className="px-4 py-3">{a.fields?.Email || '—'}</td>
                      <td className="px-4 py-3">
                        {signedUp ? (
                          <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                            <FaCheckCircle /> Signed Up
                          </span>
                        ) : pendingInvite ? (
                          <span className="inline-flex items-center gap-1 text-yellow-600 font-semibold">
                            <FaHourglassHalf /> Pending Invite
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        {!signedUp && (
                          <button
                            onClick={() => generateInvite(a.id)}
                            disabled={generatingId === a.id}
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-white ${
                              generatingId === a.id ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <FaUserPlus /> {generatingId === a.id ? 'Generating...' : 'Generate Invite'}
                          </button>
                        )}
                        <Link href={`/upload-scan?athleteId=${a.id}`}>
                          <a className="flex items-center gap-2 px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">
                            <FaUpload /> Upload Scan
                          </a>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {displayedAthletes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-gray-500">
                      No athletes found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-6 gap-4">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                >
                  <FaChevronLeft /> Previous
                </button>
                <span className="px-3 py-1 rounded-lg bg-gray-100">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                >
                  Next <FaChevronRight />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
