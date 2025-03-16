import React, { useState, useCallback } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { toast } from 'react-toastify';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const BACKEND_URL = 'https://email-camp-ace-backend.vercel.app'; 
// or use process.env.REACT_APP_BACKEND_URL if you prefer environment variables

function HomePage() {
  const [authorized, setAuthorized] = useState(false);
  const [passcode, setPasscode] = useState('');

  const [excelFile, setExcelFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Hardcoded passcode
  const correctPasscode = '12345';

  // Submit passcode
  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode === correctPasscode) {
      setAuthorized(true);
      toast.success('Access granted');
    } else {
      toast.error('Incorrect passcode. Please try again.');
    }
  };

  // Drag & Drop file
  const processFile = async (file) => {
    setExcelFile(file);
    setColumns([]);
    setPreviewRows([]);
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      if (jsonData.length === 0) {
        toast.error('Excel file is empty.');
        return;
      }
      const headerRow = jsonData[0];
      setColumns(headerRow || []);
      setPreviewRows(jsonData.slice(1, 6));
    } catch (err) {
      console.error('Error parsing Excel file:', err);
      toast.error('Error parsing Excel file.');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processFile(file);
  };

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
      e.dataTransfer.clearData();
    }
  }, []);

  // Insert placeholder
  const insertPlaceholder = (columnName) => {
    setBody(prev => prev + `{{${columnName}}}`);
  };

  // Send campaign
  const handleSendCampaign = async () => {
    if (!excelFile) {
      toast.error('Please select an Excel file.');
      return;
    }
    if (!subject) {
      toast.error('Please enter a subject.');
      return;
    }
    if (!body) {
      toast.error('Please enter the email body.');
      return;
    }

    const formData = new FormData();
    formData.append('excelFile', excelFile);
    formData.append('subject', subject);
    formData.append('body', body);

    try {
      console.log('Sending campaign request to:', `${BACKEND_URL}/upload-campaign`);
      const response = await axios.post(`${BACKEND_URL}/upload-campaign`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      console.log('Campaign POST response:', response);

      toast.success(response.data.message || 'Campaign sent successfully!');
    } catch (err) {
      console.error('Error in handleSendCampaign:', err);
      toast.error(err.response?.data?.message || 'Error sending campaign.');
    }
  };

  // ReactQuill config
  const modules = {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link', 'image'],
      ['clean']
    ]
  };

  if (!authorized) {
    return (
      <div style={styles.passcodeContainer}>
        <h2 style={styles.passcodeHeading}>Enter Passcode to Access</h2>
        <form onSubmit={handlePasscodeSubmit} style={styles.passcodeForm}>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            style={styles.passcodeInput}
            placeholder="Enter passcode"
          />
          <button type="submit" style={styles.passcodeButton}>
            Submit
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.mainHeading}>Excel Email Campaign</h2>
        <a href="/sent-mails" style={styles.linkButton}>View Sent Mails</a>
      </header>

      <div
        style={{
          ...styles.uploaderContainer,
          border: isDragging ? '2px dashed #0056b3' : '2px dashed #007bff'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div style={styles.excelUploader} onClick={() => document.getElementById('excelInput').click()}>
          <span style={styles.plusSign}>+</span>
          <p style={styles.uploadText}>Choose or Drag & Drop Excel File</p>
          <input
            id="excelInput"
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {columns.length > 0 && (
        <div style={styles.columnSection}>
          <strong style={styles.columnTitle}>Columns Found:</strong>
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
        </div>
      )}

      <div style={styles.formGroup}>
        <label style={styles.label}>Subject:</label>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={styles.input}
          placeholder="Enter email subject"
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Body (template editable):</label>
        <ReactQuill
          value={body}
          onChange={setBody}
          modules={modules}
          style={styles.richTextEditor}
          placeholder="Type your email template here..."
        />
      </div>

      <div style={styles.buttonContainer}>
        <button
          type="button"
          style={styles.primaryButton}
          onClick={handleSendCampaign}
        >
          Send Campaign
        </button>
      </div>

      {previewRows.length > 0 && (
        <div style={styles.previewSection}>
          <strong>Preview (first 5 rows):</strong>
          <table style={styles.table}>
            <thead style={styles.tableHeader}>
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} style={styles.th}>{col}</th>
                ))}
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

      <hr style={styles.divider} />
      <h3 style={styles.sectionTitle}>Excel Template Reference</h3>
      <p style={styles.referenceText}>
        Your Excel file should have a header row with a column named <strong>“Email”</strong>.
      </p>
      <table style={styles.table}>
        <thead style={styles.tableHeader}>
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
    </div>
  );
}

const styles = {
  passcodeContainer: {
    maxWidth: '400px',
    margin: '100px auto',
    padding: '30px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif'
  },
  passcodeHeading: {
    fontSize: '1.5rem',
    marginBottom: '20px'
  },
  passcodeForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px'
  },
  passcodeInput: {
    padding: '10px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  passcodeButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  container: {
    maxWidth: '900px',
    margin: '40px auto',
    padding: '30px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  },
  mainHeading: {
    fontSize: '1.8rem',
    color: '#333',
    margin: 0
  },
  linkButton: {
    backgroundColor: '#6c757d',
    color: '#fff',
    padding: '10px 15px',
    textDecoration: 'none',
    borderRadius: '4px'
  },
  uploaderContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px'
  },
  excelUploader: {
    border: 'none',
    width: '250px',
    height: '150px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer'
  },
  plusSign: {
    fontSize: '3rem',
    color: '#007bff',
    marginBottom: '10px'
  },
  uploadText: {
    fontSize: '1.1rem',
    color: '#007bff',
    margin: 0
  },
  columnSection: {
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#eef',
    borderRadius: '6px'
  },
  columnTitle: {
    marginBottom: '10px',
    fontSize: '1rem'
  },
  columnContainer: {
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
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#333'
  },
  input: {
    padding: '10px',
    fontSize: '1rem',
    width: '100%',
    borderRadius: '4px',
    border: '1px solid #ccc'
  },
  richTextEditor: {
    height: '300px',
    marginBottom: '10px'
  },
  buttonContainer: {
    textAlign: 'center',
    marginTop: '30px',
    paddingTop: '30px'
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
  previewSection: {
    marginBottom: '30px',
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
  tableHeader: {
    backgroundColor: '#f0f0f0'
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
  referenceText: {
    textAlign: 'center',
    marginBottom: '20px'
  }
};

export default HomePage;
