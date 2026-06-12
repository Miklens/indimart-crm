/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 */
export function generateBookmarkletCode(firebaseConfig) {
  const configStr = JSON.stringify(firebaseConfig);

  // The code inside this function will run in the user's browser on the IndiaMART page.
  // We stringify the entire function and wrap it in a javascript: URL.
  const scriptContent = `(function() {
    const config = ${configStr};
    
    // 1. Create and inject a beautiful floating panel on the IndiaMART page
    if (document.getElementById('indimart-sync-panel')) {
      document.getElementById('indimart-sync-panel').remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'indimart-sync-panel';
    panel.style.cssText = 'position:fixed; top:20px; right:20px; width:340px; z-index:999999; background:#1e293b; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; border:1px solid #334155; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); padding:16px; box-sizing:border-box;';
    
    panel.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">
        <h3 style="margin:0; font-size:16px; color:#10b981; font-weight:700;">🇮🇳 IndiaMART Sync CRM</h3>
        <button id="close-sync-panel" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:4px;">START DATE</label>
        <input type="date" id="sync-start-date" style="width:100%; padding:6px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:13px;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:4px;">END DATE</label>
        <input type="date" id="sync-end-date" style="width:100%; padding:6px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:13px;" />
      </div>
      <button id="start-sync-btn" style="width:100%; padding:10px; background:#10b981; border:none; border-radius:6px; color:#fff; font-weight:600; cursor:pointer; font-size:14px; transition:background 0.2s;">
        Scan & Sync Leads
      </button>
      <div id="sync-status" style="margin-top:12px; font-size:12px; color:#94a3b8; line-height:1.4; max-height:120px; overflow-y:auto; border-radius:6px; background:#0f172a; padding:8px; display:none;">
      </div>
    \`;
    
    document.body.appendChild(panel);
    
    // Set default dates (past 7 days)
    const today = new Date().toISOString().split('T')[0];
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('sync-start-date').value = past7;
    document.getElementById('sync-end-date').value = today;
    
    document.getElementById('close-sync-panel').onclick = () => panel.remove();
    
    document.getElementById('start-sync-btn').onclick = async () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = 'Starting scan...<br>';
      
      const startDateVal = document.getElementById('sync-start-date').value;
      const endDateVal = document.getElementById('sync-end-date').value;
      
      const startLimit = startDateVal ? new Date(startDateVal) : null;
      const endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999); // include full end day
      
      // 2. Perform intelligent scraping of lead cards
      // IndiaMART Lead Manager selectors can vary, we use multiple selectors & heuristics
      const leadCards = Array.from(document.querySelectorAll([
        '.eq-card', '.lead-card', '.enq-card', '.card', '.leads-card',
        '[class*="LeadCard"]', '[class*="EnquiryCard"]', '[class*="card-enquiry"]'
      ].join(','))).filter(el => {
        // Must contain a phone number or contact-like structure
        return el.innerText.match(/\\b\\d{10}\\b/) || el.innerText.match(/\\+91/);
      });
      
      statusDiv.innerHTML += \`Found \${leadCards.length} potential lead cards on page.<br>\`;
      
      if (leadCards.length === 0) {
        // Fallback: search for blocks containing phone numbers
        statusDiv.innerHTML += 'Trying fallback page scan...<br>';
        const bodyText = document.body.innerText;
        // Let user know if they are on the wrong page
        if (!window.location.hostname.includes('indiamart.com')) {
          statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ Warning: You are not on indiamart.com</span><br>';
        }
      }
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const card of leadCards) {
        try {
          const text = card.innerText;
          
          // Parse Phone Number
          const phoneMatch = text.match(/(\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/);
          if (!phoneMatch) continue;
          const contact = phoneMatch[2]; // Clean 10-digit number
          
          // Parse Customer Name (Usually the first line or bold heading)
          let customerName = 'Unknown Buyer';
          const nameEl = card.querySelector([
            'h3', 'h4', '.name', '.buyer-name', '[class*="name"]', '[class*="BuyerName"]'
          ].join(','));
          if (nameEl && nameEl.innerText.trim()) {
            customerName = nameEl.innerText.trim();
          } else {
            // Heuristic fallback: get first non-empty line of text in card
            const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 2);
            if (lines.length > 0) customerName = lines[0];
          }
          
          // Parse Product Name
          let product = 'IndiaMART Enquiry';
          const prodEl = card.querySelector([
            '.prod-name', '.product', '[class*="product"]', '[class*="ProductName"]', 'a[href*="/proddetail"]'
          ].join(','));
          if (prodEl && prodEl.innerText.trim()) {
            product = prodEl.innerText.trim();
          } else {
            // Find lines mentioning product or search keywords
            const lines = text.split('\\n');
            const prLine = lines.find(l => l.toLowerCase().includes('requirement for') || l.toLowerCase().includes('interested in'));
            if (prLine) product = prLine.replace(/requirement for/i, '').replace(/interested in/i, '').trim();
          }
          
          // Parse Location (City/State)
          let city = '';
          let state = '';
          const locMatch = text.match(/(?:Location|City|Address|From):?\\s*([a-zA-Z\\s]+),\\s*([a-zA-Z\\s]+)/i);
          if (locMatch) {
            city = locMatch[1].trim();
            state = locMatch[2].trim();
          } else {
            // Extract from common location text elements
            const locEl = card.querySelector('[class*="location"], [class*="address"], .city');
            if (locEl) {
              const parts = locEl.innerText.split(',');
              city = parts[0]?.trim() || '';
              state = parts[1]?.trim() || '';
            }
          }
          
          // Parse Enquiry Date
          let leadDate = new Date();
          const dateEl = card.querySelector('[class*="date"], .time, .enq-date');
          if (dateEl) {
            const dateStr = dateEl.innerText.trim();
            const parsed = Date.parse(dateStr);
            if (!isNaN(parsed)) {
              leadDate = new Date(parsed);
            }
          }
          
          // Check date limits
          if (startLimit && leadDate < startLimit) { skippedCount++; continue; }
          if (endLimit && leadDate > endLimit) { skippedCount++; continue; }
          
          const formattedDate = leadDate.toISOString().split('T')[0];
          
          // Create deterministic document ID to prevent duplicates
          const cleanProd = product.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
          const docId = \`IM_\${contact}_\${formattedDate}_\${cleanProd}\`;
          
          // Construct the lead object
          const leadPayload = {
            id: docId,
            date: formattedDate,
            customerName: customerName,
            contact: contact,
            product: product,
            status: 'New Enquiry',
            followUpDate: '',
            orderValue: 0,
            remarks: 'Imported via IndiaMART Bookmarklet',
            state: state,
            city: city,
            source: 'IndiaMART Direct',
            timestamp: leadDate.getTime(),
            productList: [{ name: product, qty: 1, price: 0, gst: '5', hsn: '' }],
            history: [{ status: 'New Enquiry', timestamp: Date.now() }]
          };
          
          // Save directly to Firestore using REST API
          const url = \`https://firestore.googleapis.com/v1/projects/\${config.projectId}/databases/(default)/documents/leads/\${docId}?updateMask.fieldPaths=id&updateMask.fieldPaths=date&updateMask.fieldPaths=customerName&updateMask.fieldPaths=contact&updateMask.fieldPaths=product&updateMask.fieldPaths=status&updateMask.fieldPaths=remarks&updateMask.fieldPaths=state&updateMask.fieldPaths=city&updateMask.fieldPaths=source&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=productList&updateMask.fieldPaths=history\`;
          
          // Formulate Firestore Fields
          const firestoreFields = {};
          Object.keys(leadPayload).forEach(key => {
            const val = leadPayload[key];
            if (typeof val === 'string') {
              firestoreFields[key] = { stringValue: val };
            } else if (typeof val === 'number') {
              firestoreFields[key] = { doubleValue: val };
            } else if (Array.isArray(val)) {
              // Convert array to arrayValue
              firestoreFields[key] = {
                arrayValue: {
                  values: val.map(item => ({
                    mapValue: {
                      fields: Object.keys(item).reduce((acc, itemKey) => {
                        const v = item[itemKey];
                        acc[itemKey] = typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) };
                        return acc;
                      }, {})
                    }
                  }))
                }
              };
            }
          });
          
          const response = await fetch(url, {
            method: 'PATCH', // PATCH with updateMask creates or merges document fields
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: \`projects/\${config.projectId}/databases/(default)/documents/leads/\${docId}\`,
              fields: firestoreFields
            })
          });
          
          if (response.ok) {
            syncedCount++;
            statusDiv.innerHTML += \`✔️ Synced: \${customerName} (\${product})<br>\`;
          } else {
            errorCount++;
            const errText = await response.text();
            console.error('Firestore save failed:', errText);
            statusDiv.innerHTML += \`❌ Failed: \${customerName} (API Error)<br>\`;
          }
          
        } catch (e) {
          errorCount++;
          console.error(e);
        }
      }
      
      statusDiv.innerHTML += \`<br><strong style="color:#10b981;">Sync Complete!</strong><br>Synced: \${syncedCount}<br>Skipped (date range): \${skippedCount}<br>Failed: \${errorCount}\`;
    };
  })();`;

  return `javascript:${encodeURIComponent(scriptContent.replace(/\s+/g, ' '))}`;
}
