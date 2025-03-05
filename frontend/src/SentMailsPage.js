import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { toast } from 'react-toastify';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function SentMailsPage() {
  const [mails, setMails] = useState([]);

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

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>All Sent Emails</h1>
      <table style={styles.table}>
        <thead style={styles.tableHeader}>
          <tr>
            <th style={styles.th}>Order</th>
            <th style={styles.th}>Recipient</th>
            <th style={styles.th}>Subject</th>
            <th style={styles.th}>Body</th>
            <th style={styles.th}>Sent At</th>
          </tr>
        </thead>
        <tbody>
          {mails.map(mail => (
            <tr key={mail._id}>
              <td style={styles.td}>{mail.order !== undefined ? mail.order : '-'}</td>
              <td style={styles.td}>{mail.recipient}</td>
              <td style={styles.td}>{mail.subject}</td>
              <td style={styles.td} dangerouslySetInnerHTML={{ __html: mail.body }} />
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
    border: '1px solid #ccc'
  }
};

export default SentMailsPage;
