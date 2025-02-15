import React, { useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

// 5-digit passcode (hardcoded or read from environment variable)
const FRONTEND_PASSCODE = "54321";

// Access the backend URL from .env
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function HomePage() {
  // *******************
  // PASSCODE LOGIC
  // *******************
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (enteredPasscode === FRONTEND_PASSCODE) {
      setIsAuthorized(true);
    } else {
      alert("Incorrect passcode. Please try again.");
    }
  };

  // *******************
  // EMAIL CAMPAIGN LOGIC
  // *******************
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);

  // For parsing Excel client-side (show columns, preview)
  const [columns, setColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);

  // For error/success messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 1) Handle File Change: parse the file to show columns, preview
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setColumns([]);
    setPreviewRows([]);
    setErrorMessage('');
    setSuccessMessage('');

    if (!selectedFile) return;

    try {
      // Parse the file in the browser via SheetJS
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        setErrorMessage('Excel file is empty.');
        return;
      }

      // The first row is columns
      const headerRow = jsonData[0];
      setColumns(headerRow || []);

      // Show up to 5 data rows as a preview
      const dataRows = jsonData.slice(1, 6);
      setPreviewRows(dataRows);
    } catch (err) {
      console.error(err);
      setErrorMessage('Error parsing Excel file.');
    }
  };

  // 2) Insert placeholder into body (e.g. user clicks "NAME" -> adds "{{NAME}}")
  const insertPlaceholder = (columnName) => {
    const placeholder = `{{${columnName}}}`;
    setBody((prev) => prev + placeholder);
  };

  // 3) Send the campaign to the server
  const handleSendCampaign = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!file) {
      setErrorMessage('Please select an Excel file first.');
      return;
    }
    if (!subject) {
      setErrorMessage('Please enter a subject.');
      return;
    }
    if (!body) {
      setErrorMessage('Please enter a body (or placeholders).');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('excelFile', file);
      formData.append('subject', subject);
      formData.append('body', body);

      const response = await axios.post(
        `${BACKEND_URL}/upload-campaign`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setSuccessMessage(response.data.message || 'Emails sent successfully!');
    } catch (err) {
      console.error(err);
      setErrorMessage(err.response?.data?.message || 'Error sending campaign.');
    }
  };

  // *******************
  // RENDER
  // *******************

  // If user is NOT authorized, show passcode screen
  if (!isAuthorized) {
    return (
      <div style={styles.passcodeContainer}>
        <h1 style={styles.title}>Enter 5-Digit Passcode</h1>
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

  // If user IS authorized, show the main campaign UI
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.mainHeading}>Excel Email Campaign</h2>
        <a href="/sent-mails" style={styles.linkButton}>View Sent Mails</a>
      </header>

      {/* Error / Success Messages */}
      {errorMessage && <div style={styles.errorBox}>{errorMessage}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <form onSubmit={handleSendCampaign} style={{ marginBottom: '20px' }}>
        {/* SUBJECT */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Subject:</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={styles.input}
            placeholder="Enter email subject"
          />
        </div>
    {/* If we have columns, show them so user can insert placeholders */}
    {columns.length > 0 && (
        <div style={styles.columnSection}>
          <strong>Columns Found:</strong>
          <div style={styles.columnContainer}>
            {columns.map((colName, i) => (
              <button
                key={i}
                style={styles.columnButton}
                onClick={() => insertPlaceholder(colName)}
              >
                {colName}
              </button>
            ))}
          </div>
          <p style={styles.columnInfo}>
            Click a column to insert <code style={styles.inlineCode}>{"{{COLUMN}}"}</code> into the body.
          </p>
        </div>
      )}
        {/* BODY */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Body (placeholders allowed):</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows="4"
            style={styles.textArea}
            placeholder="Use placeholders like {{NAME}}, {{AMOUNT}}..."
          />
        </div>

        {/* FILE */}
        <div style={styles.formGroup}>
          <label style={styles.label}>Select Excel File (xlsx, xls, or csv):</label>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            style={styles.fileInput}
          />
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button type="submit" style={styles.primaryButton}>
            Send Campaign
          </button>
        </div>
      </form>

      

      {/* Preview first few rows */}
      {previewRows.length > 0 && (
        <div style={styles.previewSection}>
          <strong>Preview (first 5 rows):</strong>
          <table style={styles.table}>
            <thead style={{ backgroundColor: '#f0f0f0' }}>
              <tr>
                {columns.map((col, idx) => <th key={idx} style={styles.th}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((rowData, rowIdx) => (
                <tr key={rowIdx}>
                  {rowData.map((cell, cellIdx) => (
                    <td key={cellIdx} style={styles.td}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Excel template info */}
      <hr style={styles.divider} />
      <h3 style={styles.sectionTitle}>Excel Template Reference</h3>
      <p style={{ textAlign: 'center', marginBottom: '20px' }}>
        Your Excel file should have a header row with a column named <strong>“Email”</strong>.
      </p>

      <table style={styles.table}>
        <thead style={{ backgroundColor: '#f0f0f0' }}>
          <tr>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Name (optional)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.td}>test1@example.com</td>
            <td style={styles.td}>John Doe</td>
          </tr>
          <tr>
            <td style={styles.td}>test2@example.com</td>
            <td style={styles.td}>Alice</td>
          </tr>
          <tr>
            <td style={styles.td}>test3@example.com</td>
            <td style={styles.td}>Bob</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <a href="/template.xlsx" download="email_template.xlsx" style={styles.downloadLink}>
          <button type="button" style={styles.secondaryButton}>
            Download Excel Template
          </button>
        </a>
      </div>
    </div>
  );
}

/* Inline Styles */
const styles = {
  /* PASSCODE SCREEN STYLES */
  passcodeContainer: {
    margin: '100px auto',
    width: '90%',
    maxWidth: '320px',
    textAlign: 'center',
    fontFamily: 'sans-serif',
    border: '1px solid #ccc',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
  },
  title: {
    marginBottom: '20px',
    fontSize: '1.3rem'
  },
  form: {
    marginTop: '20px'
  },
  input: {
    padding: '10px',
    fontSize: '1rem',
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

  /* MAIN CAMPAIGN PAGE STYLES */
  container: {
    maxWidth: '850px',
    margin: '40px auto',
    padding: '30px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  mainHeading: {
    margin: 0,
    fontSize: '1.8rem',
    color: '#333'
  },
  linkButton: {
    backgroundColor: '#6c757d',
    color: '#fff',
    padding: '10px 15px',
    textDecoration: 'none',
    borderRadius: '4px',
    fontSize: '0.9rem'
  },

  errorBox: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '10px'
  },
  successBox: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '10px',
    borderRadius: '5px',
    marginBottom: '10px'
  },

  label: {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 'bold',
    color: '#333'
  },
  formGroup: {
    marginBottom: '15px'
  },
  textArea: {
    width: '100%',
    padding: '8px 10px',
    marginBottom: '5px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '1rem'
  },
  fileInput: {
    marginBottom: '5px'
  },
  primaryButton: {
    padding: '12px 30px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },

  columnSection: {
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f9f9f9',
    borderRadius: '6px',
    border: '1px solid #ccc'
  },
  columnContainer: {
    marginTop: '10px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  columnButton: {
    padding: '6px 10px',
    backgroundColor: '#ddd',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  columnInfo: {
    marginTop: '5px',
    fontSize: '0.9rem'
  },
  inlineCode: {
    backgroundColor: '#f0f0f0',
    padding: '2px 4px',
    borderRadius: '3px'
  },

  previewSection: {
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#fdfdfd',
    borderRadius: '6px',
    border: '1px solid #ccc'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '10px',
    fontSize: '0.95rem'
  },
  th: {
    padding: '8px',
    textAlign: 'left',
    border: '1px solid #ccc'
  },
  td: {
    padding: '8px',
    border: '1px solid #ccc'
  },

  divider: {
    margin: '30px 0'
  },
  sectionTitle: {
    textAlign: 'center',
    marginBottom: '10px'
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
  downloadLink: {
    textDecoration: 'none'
  }
};

export default HomePage;
