/** 
 * ============================================================ 
 * INDIMART CRM - Google Apps Script Backend (PRO UPGRADED)
 * ============================================================ 
 * SETUP INSTRUCTIONS: 
 * 1. Open Google Sheets → Extensions → Apps Script 
 * 2. Paste this ENTIRE file into the editor 
 * 3. Click "Run" → select "setupSheets" → authorize when prompted 
 * 4. Click Deploy → New Deployment → Web App 
 *    - Execute as: Me 
 *    - Who has access: Anyone 
 * 5. Copy the Deployment URL and paste it in the app's Settings page 
 * ============================================================ 
 */

const SHEET_NAMES = {
  LEADS: 'Leads',
  PRODUCTS: 'Products',
  SETTINGS: 'CompanySettings',
  INVOICES: 'Invoices',
  TEMPLATES: 'MessageTemplates',
  SYNC_LOG: 'SyncLog'
};

// ─── SETUP ──────────────────────────────────────────────────────────────────── 

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. LEADS SHEET
  let leadsSheet = ss.getSheetByName(SHEET_NAMES.LEADS);
  if (!leadsSheet) leadsSheet = ss.insertSheet(SHEET_NAMES.LEADS);
  leadsSheet.clearContents();
  const leadsHeaders = [
    'id', 'date', 'customerName', 'contact', 'gst', 'product', 'city', 'state',
    'status', 'paymentStatus', 'paymentReceivedAmount', 'transactionId', 'orderValue',
    'dispatchDate', 'dispatchMethod', 'trackingId', 'materialReachedDate',
    'followUpDate', 'lostReason', 'remarks', 'customerFeedback', 'customerRating',
    'source', 'timestamp', 'history', 'productList', 'updatedAt'
  ];
  leadsSheet.getRange(1, 1, 1, leadsHeaders.length).setValues([leadsHeaders]);
  leadsSheet.getRange(1, 1, 1, leadsHeaders.length)
    .setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold');
  leadsSheet.setFrozenRows(1);
  leadsSheet.setColumnWidth(1, 80);
  leadsSheet.setColumnWidth(3, 180);
  leadsSheet.setColumnWidth(6, 160);
  leadsSheet.setColumnWidth(9, 140);
  leadsSheet.setColumnWidth(20, 300); // remarks
  leadsSheet.setColumnWidth(25, 300); // history
  leadsSheet.setColumnWidth(26, 300); // productList

  // 2. PRODUCTS SHEET 
  let productsSheet = ss.getSheetByName(SHEET_NAMES.PRODUCTS);
  if (!productsSheet) productsSheet = ss.insertSheet(SHEET_NAMES.PRODUCTS);
  productsSheet.clearContents();
  const productsHeaders = ['id', 'name', 'price', 'hsn', 'gst', 'unit', 'category', 'updatedAt'];
  productsSheet.getRange(1, 1, 1, productsHeaders.length).setValues([productsHeaders]);
  productsSheet.getRange(1, 1, 1, productsHeaders.length)
    .setBackground('#34a853').setFontColor('#ffffff').setFontWeight('bold');
  productsSheet.setFrozenRows(1);

  // 3. COMPANY SETTINGS SHEET 
  let settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!settingsSheet) settingsSheet = ss.insertSheet(SHEET_NAMES.SETTINGS);
  settingsSheet.clearContents();
  const settingsHeaders = ['key', 'value'];
  settingsSheet.getRange(1, 1, 1, 2).setValues([settingsHeaders]);
  settingsSheet.getRange(1, 1, 1, 2)
    .setBackground('#fbbc04').setFontColor('#000000').setFontWeight('bold');
  const defaultSettings = [
    ['name', 'Miklens Bio Pvt.Ltd.'],
    ['gst', '29AAKCM6046P1ZN'],
    ['address', '# 70/1, HKK Industrial Estate, Cheemasandra, Bengaluru - 560049'],
    ['email', 'pavan@miklensbio.com'],
    ['mobile', '7813805264']
  ];
  settingsSheet.getRange(2, 1, defaultSettings.length, 2).setValues(defaultSettings);

  // 4. INVOICES SHEET 
  let invoicesSheet = ss.getSheetByName(SHEET_NAMES.INVOICES);
  if (!invoicesSheet) invoicesSheet = ss.insertSheet(SHEET_NAMES.INVOICES);
  invoicesSheet.clearContents();
  const invoiceHeaders = [
    'id', 'invoiceNumber', 'invoiceDate', 'customerName', 'customerContact',
    'customerGst', 'customerCity', 'customerState', 'leadId', 'items',
    'totalAmount', 'otherCharges', 'roundOff', 'receivedAmount', 'paymentStatus', 'status', 'versions', 'latestVersion', 'createdAt', 'updatedAt'
  ];
  invoicesSheet.getRange(1, 1, 1, invoiceHeaders.length).setValues([invoiceHeaders]);
  invoicesSheet.getRange(1, 1, 1, invoiceHeaders.length)
    .setBackground('#9334e6').setFontColor('#ffffff').setFontWeight('bold');
  invoicesSheet.setFrozenRows(1);

  // 5. MESSAGE TEMPLATES SHEET
  let templatesSheet = ss.getSheetByName(SHEET_NAMES.TEMPLATES);
  if (!templatesSheet) templatesSheet = ss.insertSheet(SHEET_NAMES.TEMPLATES);
  templatesSheet.clearContents();
  const templateHeaders = ['id', 'name', 'content', 'category', 'updatedAt'];
  templatesSheet.getRange(1, 1, 1, templateHeaders.length).setValues([templateHeaders]);
  templatesSheet.getRange(1, 1, 1, templateHeaders.length)
    .setBackground('#ff5722').setFontColor('#ffffff').setFontWeight('bold');
  templatesSheet.setFrozenRows(1);

  // 6. SYNC LOG SHEET 
  let logSheet = ss.getSheetByName(SHEET_NAMES.SYNC_LOG);
  if (!logSheet) logSheet = ss.insertSheet(SHEET_NAMES.SYNC_LOG);
  logSheet.clearContents();
  const logHeaders = ['timestamp', 'action', 'recordId', 'status', 'details'];
  logSheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
  logSheet.getRange(1, 1, 1, logHeaders.length)
    .setBackground('#ea4335').setFontColor('#ffffff').setFontWeight('bold');

  SpreadsheetApp.getUi().alert('✅ SYNC SETUP COMPLETE!\n\nRe-deploy the script now.');
}

// ─── HTTP ROUTER ────────────────────────────────────────────────────────────── 

function doGet(e) {
  const params = e.parameter;
  const action = params.action;

  let result;
  try {
    switch (action) {
      case 'getAll': result = getAll(); break;
      case 'getSettings': 
        result = { success: true, settings: getSettingsData(SpreadsheetApp.getActiveSpreadsheet(), SHEET_NAMES.SETTINGS) }; 
        break;
      default:
        result = { success: false, error: 'Unknown GET action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
  }
  return buildResponse(result);
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return buildResponse({ success: false, error: 'Invalid JSON body' });
  }

  const action = body.action;
  let result;
  try {
    switch (action) {
      case 'syncAll': result = syncAll(body); break;
      default:
        result = { success: false, error: 'Unknown POST action: ' + action };
    }
  } catch (err) {
    result = { success: false, error: err.message };
    logAction('ERROR', action, '', err.message);
  }

  return buildResponse(result);
}

function buildResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ─── SYNC OPERATIONS ────────────────────────────────────────────────────────── 

function getAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return {
    success: true,
    leads: getSheetData(ss, SHEET_NAMES.LEADS),
    products: getSheetData(ss, SHEET_NAMES.PRODUCTS),
    settings: getSettingsData(ss, SHEET_NAMES.SETTINGS),
    invoices: getSheetData(ss, SHEET_NAMES.INVOICES),
    templates: getSheetData(ss, SHEET_NAMES.TEMPLATES),
    serverTime: new Date().toISOString()
  };
}

function getSheetData(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      let val = row[i];
      // Auto-parse JSON
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (e) { }
      }
      obj[h] = val;
    });
    return obj;
  });
}

function getSettingsData(ss, name) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const settings = {};
  data.slice(1).forEach(row => {
    if (row[0]) {
      let val = row[1];
      if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
        try { val = JSON.parse(val); } catch (e) { }
      }
      settings[row[0]] = val;
    }
  });
  return settings;
}

function syncAll(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Sync Leads
  if (data.leads) {
    updateSheet(ss, SHEET_NAMES.LEADS, data.leads, [
      'id', 'date', 'customerName', 'contact', 'gst', 'product', 'city', 'state',
      'status', 'paymentStatus', 'paymentReceivedAmount', 'transactionId', 'orderValue',
      'dispatchDate', 'dispatchMethod', 'trackingId', 'materialReachedDate',
      'followUpDate', 'lostReason', 'remarks', 'customerFeedback', 'customerRating',
      'source', 'timestamp', 'history', 'productList', 'updatedAt'
    ], '#1a73e8');
  }

  // Sync Products
  if (data.products) {
    updateSheet(ss, SHEET_NAMES.PRODUCTS, data.products, ['id', 'name', 'price', 'hsn', 'gst', 'unit', 'category', 'updatedAt'], '#34a853');
  }

  // Sync Settings
  if (data.settings) {
    const settingsSheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    settingsSheet.clearContents();
    settingsSheet.getRange(1, 1, 1, 2).setValues([['key', 'value']]);
    settingsSheet.getRange(1, 1, 1, 2)
      .setBackground('#fbbc04').setFontColor('#000000').setFontWeight('bold');
    const rows = Object.entries(data.settings).map(([k, v]) => {
      let val = v;
      if (typeof val === 'object') val = JSON.stringify(val);
      return [k, val];
    });
    if (rows.length > 0) settingsSheet.getRange(2, 1, rows.length, 2).setValues(rows);
  }

  // Sync Invoices
  if (data.invoices) {
    updateSheet(ss, SHEET_NAMES.INVOICES, data.invoices, [
      'id', 'invoiceNumber', 'invoiceDate', 'customerName', 'customerContact',
      'customerGst', 'customerCity', 'customerState', 'leadId', 'items',
      'totalAmount', 'otherCharges', 'roundOff', 'receivedAmount', 'paymentStatus', 'status', 'versions', 'latestVersion', 'createdAt', 'updatedAt'
    ], '#9334e6');
  }

  // Sync Templates
  if (data.templates) {
    updateSheet(ss, SHEET_NAMES.TEMPLATES, data.templates, ['id', 'name', 'content', 'category', 'updatedAt'], '#ff5722');
  }

  logAction('FULL_SYNC', 'all', '', `Synced all data points`);
  return { success: true };
}

function updateSheet(ss, name, data, headers, headerColor) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Apply formatting to header row automatically
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold').setFontColor(headerColor === '#fbbc04' ? '#000000' : '#ffffff');
  if (headerColor) headerRange.setBackground(headerColor);
  sheet.setFrozenRows(1);

  if (data && data.length > 0) {
    const rows = data.map(item => {
      return headers.map(h => {
        let val = item[h];
        if (typeof val === 'object') return JSON.stringify(val);
        return val !== undefined ? val : '';
      });
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function logAction(action, recordId, id, details) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAMES.SYNC_LOG);
    if (sheet) sheet.appendRow([new Date().toISOString(), action, recordId, 'OK', details]);
  } catch (e) { }
}
