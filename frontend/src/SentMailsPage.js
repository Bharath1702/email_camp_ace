import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { toast } from 'react-toastify';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Helper component to display email body with clamping and image toggle
function EmailBody({ body }) {
  const [expanded, setExpanded] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // Detect an <img> tag and extract its src attribute
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/i;
  const imgMatch = body.match(imgRegex);
  const imageSrc = imgMatch ? imgMatch[1] : null;
  // Remove image tag from the body
  const bodyWithoutImage = imageSrc ? body.replace(imgRegex, '') : body;

  // Clamp to 3 lines if not expanded
  const clampStyle = expanded
    ? {}
    : {
        display: '-webkit-box',
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      };

  return (
    <div>
      <div style={clampStyle} dangerouslySetInnerHTML={{ __html: bodyWithoutImage }} />
      <div style={{ marginTop: '5px' }}>
        {!expanded ? (
          <button onClick={() => setExpanded(true)} style={styles.toggleButton}>
            Read more
          </button>
        ) : (
          <button onClick={() => setExpanded(false)} style={styles.toggleButton}>
            Show less
          </button>
        )}
      </div>
      {imageSrc && (
        <div style={{ marginTop: '5px' }}>
          <button onClick={() => setShowImage(!showImage)} style={styles.toggleButton}>
            {showImage ? 'Hide Image' : 'View Image'}
          </button>
          {showImage && (
            <div style={{ marginTop: '10px' }}>
              <img src={imageSrc} alt="Email content" style={{ maxWidth: '100%' }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SentMailsPage() {
  const [mails, setMails] = useState([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('');

  // Fetch sent emails from the backend
  const loadMails = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/sent-mails`);
      setMails(response.data);
    } catch (err) {
      console.error('Error fetching sent mails:', err);
      toast.error('Error fetching sent mails.');
    }
  };

  useEffect(() => {
    loadMails();
    // Connect to socket.io for real-time updates
    const socket = io(BACKEND_URL);
    socket.on('newEmail', (data) => {
      setMails(prev => [data, ...prev]);
    });
    return () => socket.disconnect();
  }, []);

  // Apply filters: date range, subject, and recipient
  const filteredMails = mails.filter(mail => {
    const sentDate = new Date(mail.sentAt);
    if (fromDate) {
      const from = new Date(fromDate);
      if (sentDate < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (sentDate > to) return false;
    }
    if (subjectFilter && !mail.subject.toLowerCase().includes(subjectFilter.toLowerCase())) {
      return false;
    }
    if (recipientFilter && !mail.recipient.toLowerCase().includes(recipientFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>All Sent Emails</h1>

      {/* Filter Section */}
      <div style={styles.filterContainer}>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>From:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>To:</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={styles.dateInput}
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Subject:</label>
          <input
            type="text"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            style={styles.textInput}
            placeholder="Filter by subject"
          />
        </div>
        <div style={styles.filterGroup}>
          <label style={styles.filterLabel}>Recipient:</label>
          <input
            type="text"
            value={recipientFilter}
            onChange={(e) => setRecipientFilter(e.target.value)}
            style={styles.textInput}
            placeholder="Filter by recipient"
          />
        </div>
      </div>

      <table style={styles.table}>
        <thead style={styles.tableHeader}>
          <tr>
            <th style={styles.th}>Order (Batch,Seq)</th>
            <th style={styles.th}>Recipient</th>
            <th style={styles.th}>Subject</th>
            <th style={styles.th}>Body</th>
            <th style={styles.th}>Sent At</th>
          </tr>
        </thead>
        <tbody>
          {filteredMails.map(mail => (
            <tr key={mail._id}>
              <td style={styles.td}>
                {mail.batch !== undefined && mail.seq !== undefined
                  ? `${mail.batch},${mail.seq}`
                  : '-'}
              </td>
              <td style={styles.td}>{mail.recipient}</td>
              <td style={styles.td}>{mail.subject}</td>
              <td style={styles.td}>
                <EmailBody body={mail.body} />
              </td>
              <td style={styles.td}>{new Date(mail.sentAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: {
    margin: '50px',
    fontFamily: 'Arial, sans-serif'
  },
  heading: {
    textAlign: 'center',
    marginBottom: '20px'
  },
  filterContainer: {
    display: 'flex',
    justifyContent: 'center',
    gap: '20px',
    flexWrap: 'wrap',
    marginBottom: '20px'
  },
  filterGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  filterLabel: {
    marginBottom: '5px',
    fontWeight: 'bold'
  },
  dateInput: {
    padding: '5px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  textInput: {
    padding: '5px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  tableHeader: {
    backgroundColor: '#f0f0f0'
  },
  th: {
    padding: '10px',
    border: '1px solid #ccc',
    textAlign: 'left'
  },
  td: {
    padding: '10px',
    border: '1px solid #ccc',
    verticalAlign: 'top'
  },
  toggleButton: {
    fontSize: '0.8rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  imageLink: {
    fontSize: '0.8rem',
    color: '#007bff',
    textDecoration: 'underline',
    cursor: 'pointer'
  }
};

export default SentMailsPage;
