import React, { useState } from 'react';
import axios from 'axios';

// 5-digit passcode (hardcoded or read from environment variable)
const FRONTEND_PASSCODE = "54321";

// Access the backend URL from .env
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function HomePage() {
  // State for passcode gate
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  // State for email campaign form
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);

  /************************************************
   * PASSCODE SCREEN
   ************************************************/
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (enteredPasscode === FRONTEND_PASSCODE) {
      setIsAuthorized(true);
    } else {
      alert("Incorrect passcode. Please try again.");
    }
  };

  /************************************************
   * EMAIL CAMPAIGN SCREEN
   ************************************************/
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSendCampaign = async (e) => {
    e.preventDefault();

    if (!file) {
      alert("Please select an Excel file first.");
      return;
    }

    // Prepare FormData
    const formData = new FormData();
    formData.append('excelFile', file);
    formData.append('subject', subject);
    formData.append('body', body);

    try {
      // Use BACKEND_URL from our .env file
      const response = await axios.post(
        `${BACKEND_URL}/upload-campaign`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      alert(response.data.message);
    } catch (error) {
      console.error(error);
      alert("Error sending campaign: " + (error.response?.data?.message || error.message));
    }
  };

  // Download URL for the Excel template in /public
  const downloadUrl = '/template.xlsx';

  /************************************************
   * RENDER LOGIC
   ************************************************/

  // If user is NOT authorized, show passcode form
  if (!isAuthorized) {
    return (
      <div style={styles.passcodeContainer}>
        <h1 style={{ marginBottom: '20px' }}>Enter 5-Digit Passcode</h1>
        <form onSubmit={handlePasscodeSubmit} style={styles.form}>
          <input
            type="password"
            maxLength={5}
            value={enteredPasscode}
            onChange={(e) => setEnteredPasscode(e.target.value)}
            style={styles.input}
            placeholder="12345"
          />
          <button type="submit" style={styles.button}>
            Submit
          </button>
        </form>
      </div>
    );
  }

  // If user IS authorized, show Email Campaign page
  return (
    <div style={styles.container}>
      <h1><a href='/sent-mails'>View sent mails</a></h1>
      <h1 style={styles.heading}>Send Email Campaign via Excel</h1>

      <form onSubmit={handleSendCampaign}>
        <div>
          <label style={styles.label}>Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={styles.input}
            placeholder="Enter email subject"
          />
        </div>

        <div>
          <label style={styles.label}>Body:</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows="4"
            style={styles.textArea}
            placeholder="Enter email body"
          />
        </div>

        <div>
          <label style={styles.label}>Select Excel File (xlsx, xls, or csv):</label>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            style={{ marginBottom: '16px' }}
          />
        </div>

        <button type="submit" style={styles.primaryButton}>
          Send Campaign
        </button>
      </form>

      <hr style={styles.divider} />
      <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>Excel Template Reference</h2>
      <p style={{ textAlign: 'center', marginBottom: '20px' }}>
        Your Excel file should have a header row with a column named <strong>“Email”</strong>.
      </p>

      <table
        border="1"
        cellPadding="5"
        style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}
      >
        <thead style={{ backgroundColor: '#f0f0f0' }}>
          <tr>
            <th>Email</th>
            <th>Name (optional)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>test1@example.com</td>
            <td>John Doe</td>
          </tr>
          <tr>
            <td>test2@example.com</td>
            <td>Alice</td>
          </tr>
          <tr>
            <td>test3@example.com</td>
            <td>Bob</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center' }}>
        <a href={downloadUrl} download="email_template.xlsx">
          <button type="button" style={styles.secondaryButton}>
            Download Excel Template
          </button>
        </a>
      </div>
    </div>
  );
}

// Inline styles for simplicity
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
  container: {
    maxWidth: '600px',
    margin: '40px auto',
    padding: '30px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
    fontFamily: 'Arial, sans-serif'
  },
  heading: {
    marginBottom: '20px',
    fontSize: '1.8rem',
    textAlign: 'center'
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 'bold'
  },
  textArea: {
    width: '100%',
    padding: '8px 10px',
    marginBottom: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px'
  },
  primaryButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  secondaryButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  divider: {
    margin: '30px 0'
  }
};

export default HomePage;
