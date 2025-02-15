import React, { useState, useEffect } from 'react';
import axios from 'axios';

function SentMailsPage() {
  // Hardcoded passcode for demonstration
  const PASSCODE = "12345";
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [mails, setMails] = useState([]);

  // Once authorized, fetch the mails
  useEffect(() => {
    if (isAuthorized) {
      // Replace with your actual server endpoint
      axios.get(`${BACKEND_URL}/sent-mails`)
        .then(response => {
          setMails(response.data);
        })
        .catch(err => {
          console.error('Error fetching sent mails:', err);
        });
    }
  }, [isAuthorized]);

  // Handle passcode submission
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (enteredPasscode === PASSCODE) {
      setIsAuthorized(true);
    } else {
      alert("Incorrect passcode. Please try again.");
    }
  };

  // If not authorized, show passcode prompt
  if (!isAuthorized) {
    return (
      <div style={styles.passcodeContainer}>
        <h1 style={{ marginBottom: '20px' }}>Enter Passcode</h1>
        <form onSubmit={handlePasscodeSubmit} style={styles.form}>
          <input
            type="password"
            maxLength={10}
            value={enteredPasscode}
            onChange={(e) => setEnteredPasscode(e.target.value)}
            style={styles.input}
            placeholder="Enter passcode"
          />
          <button type="submit" style={styles.button}>
            Submit
          </button>
        </form>
      </div>
    );
  }

  // If authorized, show the table of sent mails
  return (
    <div style={{ margin: '50px' }}>
      <h1>All Sent Emails</h1>
      <table border="1" cellPadding="6" style={styles.table}>
        <thead style={{ backgroundColor: '#f0f0f0' }}>
          <tr>
            <th>Recipient</th>
            <th>Subject</th>
            <th>Body</th>
            <th>Sent At</th>
          </tr>
        </thead>
        <tbody>
          {mails.map(mail => (
            <tr key={mail._id}>
              <td>{mail.recipient}</td>
              <td>{mail.subject}</td>
              <td>{mail.body}</td>
              <td>{new Date(mail.sentAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Inline CSS for simplicity
const styles = {
  passcodeContainer: {
    margin: '100px auto',
    width: '90%',
    maxWidth: '300px',
    textAlign: 'center',
    fontFamily: 'sans-serif',
    border: '1px solid #ccc',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  form: {
    marginTop: '20px'
  },
  input: {
    padding: '10px',
    fontSize: '1rem',
    textAlign: 'center',
    width: '100%',
    marginBottom: '10px',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  button: {
    padding: '10px 20px',
    fontSize: '1rem',
    cursor: 'pointer',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: '#007bff',
    color: '#fff'
  },
  table: {
    borderCollapse: 'collapse',
    width: '100%',
    marginTop: '20px'
  }
};

export default SentMailsPage;
