/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 */
export function generateBookmarkletCode(firebaseConfig) {
  const configStr = JSON.stringify(firebaseConfig);

  const scriptContent = `(function() {
    const config = ${configStr};
    
    if (document.getElementById('indimart-sync-panel')) {
      document.getElementById('indimart-sync-panel').remove();
    }
    
    const panel = document.createElement('div');
    panel.id = 'indimart-sync-panel';
    panel.style.cssText = 'position:fixed; top:20px; right:20px; width:360px; z-index:999999; background:#1e293b; color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; border:1px solid #334155; border-radius:12px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.5); padding:16px; box-sizing:border-box;';
    
    panel.innerHTML = \`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">
        <h3 style="margin:0; font-size:16px; color:#10b981; font-weight:700;">🇮🇳 IndiaMART Sync CRM</h3>
        <button id="close-sync-panel" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:16px;">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:4px;">START DATE</label>
        <input type="date" id="sync-start-date" style="width:100%; padding:6px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:13px;" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; color:#94a3b8; margin-bottom:4px;">END DATE</label>
        <input type="date" id="sync-end-date" style="width:100%; padding:6px; border-radius:6px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:13px;" />
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button id="start-sync-btn" style="flex:1; padding:10px; background:#10b981; border:none; border-radius:6px; color:#fff; font-weight:600; cursor:pointer; font-size:13px;">
          Scan & Sync Leads
        </button>
      </div>
      <div id="sync-status" style="margin-top:12px; font-size:12px; color:#94a3b8; line-height:1.4; max-height:220px; overflow-y:auto; border-radius:6px; background:#0f172a; padding:8px; display:none;">
      </div>
    \`;
    
    document.body.appendChild(panel);
    
    const today = new Date().toISOString().split('T')[0];
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('sync-start-date').value = past7;
    document.getElementById('sync-end-date').value = today;
    
    document.getElementById('close-sync-panel').onclick = () => panel.remove();
    
    document.getElementById('start-sync-btn').onclick = async () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = 'Finding contacts on page...<br>';
      
      /* Get all contacts in the sidebar matching the targeted class .lftcntctnew */
      const leadCards = Array.from(document.querySelectorAll('.lftcntctnew'));
      
      statusDiv.innerHTML += \`Found \${leadCards.length} contacts on left panel.<br>\`;
      
      if (leadCards.length === 0) {
        statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ No contacts found. Please make sure you are on the Lead Manager / Message Centre page.</span>';
        return;
      }
      
      const startDateVal = document.getElementById('sync-start-date').value;
      const endDateVal = document.getElementById('sync-end-date').value;
      const startLimit = startDateVal ? new Date(startDateVal) : null;
      const endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999);
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      statusDiv.innerHTML += '<b>Starting auto-click sync loop...</b><br>';
      
      for (let i = 0; i < leadCards.length; i++) {
        const card = leadCards[i];
        try {
          /* Extract Name from the card */
          const nameEl = card.querySelector('.fs14.fwb');
          const customerName = nameEl ? nameEl.innerText.trim() : 'Unknown Buyer';
          
          statusDiv.innerHTML += \`Scanning [\${i+1}/\${leadCards.length}]: \${customerName}...<br>\`;
          statusDiv.scrollTop = statusDiv.scrollHeight;
          
          /* Click the contact to load details on the right panel */
          card.click();
          await new Promise(r => setTimeout(r, 700)); /* Wait for detail panel to render */
          
          /* Now scan the right side of the page (details pane) for the phone number */
          /* Find all phone numbers matching 10 digits or +91 pattern */
          const bodyText = document.body.innerText;
          const phoneRegex = /(?:\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/g;
          let phoneMatch;
          let contact = '';
          
          /* We collect phone numbers and try to get the active one (usually in the chat details) */
          /* Let's search inside elements that belong to the right column / details pane */
          const rightCol = document.querySelector('.lms_right, [class*="right"], [class*="detail"]');
          const searchArea = rightCol ? rightCol.innerText : bodyText;
          
          const matches = [];
          while ((phoneMatch = phoneRegex.exec(searchArea)) !== null) {
            matches.push(phoneMatch[1]);
          }
          
          if (matches.length > 0) {
            contact = matches[0]; /* Grab the first matching number in the detail view */
          } else {
            /* Fallback to global search if right column was not distinct */
            const globalMatches = [];
            while ((phoneMatch = phoneRegex.exec(bodyText)) !== null) {
              globalMatches.push(phoneMatch[1]);
            }
            /* Exclude typical seller number if we can, or just take the first */
            contact = globalMatches.find(num => num !== config.sellerMobile) || globalMatches[0] || '0000000000';
          }
          
          /* Extract Product from the card text */
          let product = 'IndiaMART Enquiry';
          const cardText = card.innerText;
          const lines = cardText.split('\\n').map(l => l.trim()).filter(l => l.length > 1);
          
          /* Check if there is product label or enquiry text */
          const prodLine = lines.find(l => l.toLowerCase().includes('viewed') || l.toLowerCase().includes('enquiry') || l.toLowerCase().includes('kg') || l.toLowerCase().includes('liter') || l.toLowerCase().includes('pack'));
          if (prodLine) {
            product = prodLine;
          } else if (lines.length > 2) {
            product = lines[2];
          } else if (lines.length > 1) {
            product = lines[1];
          }
          
          /* Extract Location (City/State) */
          let city = '';
          let state = '';
          const locationLine = lines.find(l => l.includes(','));
          if (locationLine) {
            const parts = locationLine.split(',');
            city = parts[0]?.trim() || '';
            state = parts[1]?.trim() || '';
          }
          
          let leadDate = new Date();
          
          /* Check date range */
          if (startLimit && leadDate < startLimit) { skippedCount++; continue; }
          if (endLimit && leadDate > endLimit) { skippedCount++; continue; }
          
          const formattedDate = leadDate.toISOString().split('T')[0];
          const cleanProd = product.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
          const docId = \`IM_\${contact}_\${formattedDate}_\${cleanProd}\`;
          
          const leadPayload = {
            id: docId,
            date: formattedDate,
            customerName: customerName,
            contact: contact,
            product: product,
            status: 'New Enquiry',
            followUpDate: '',
            orderValue: 0,
            remarks: 'Imported via IndiaMART Auto-Clicker',
            state: state,
            city: city,
            source: 'IndiaMART Direct',
            timestamp: leadDate.getTime(),
            productList: [{ name: product, qty: 1, price: 0, gst: '5', hsn: '' }],
            history: [{ status: 'New Enquiry', timestamp: Date.now() }]
          };
          
          const url = \`https://firestore.googleapis.com/v1/projects/\${config.projectId}/databases/(default)/documents/leads/\${docId}?updateMask.fieldPaths=id&updateMask.fieldPaths=date&updateMask.fieldPaths=customerName&updateMask.fieldPaths=contact&updateMask.fieldPaths=product&updateMask.fieldPaths=status&updateMask.fieldPaths=remarks&updateMask.fieldPaths=state&updateMask.fieldPaths=city&updateMask.fieldPaths=source&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=productList&updateMask.fieldPaths=history\`;
          
          const firestoreFields = {};
          Object.keys(leadPayload).forEach(key => {
            const val = leadPayload[key];
            if (typeof val === 'string') {
              firestoreFields[key] = { stringValue: val };
            } else if (typeof val === 'number') {
              firestoreFields[key] = { doubleValue: val };
            } else if (Array.isArray(val)) {
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
            method: 'PATCH',
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
            statusDiv.innerHTML += \`<span style="color:#10b981;">✔️ Synced: \${customerName} (\${contact})</span><br>\`;
          } else {
            errorCount++;
            statusDiv.innerHTML += \`<span style="color:#f43f5e;">❌ Failed to upload \${customerName}</span><br>\`;
          }
          
        } catch (e) {
          errorCount++;
          console.error(e);
        }
      }
      
      statusDiv.innerHTML += \`<br><strong style="color:#10b981;">Sync Complete!</strong><br>Synced: \${syncedCount}<br>Failed/Skipped: \${errorCount + skippedCount}\`;
      statusDiv.scrollTop = statusDiv.scrollHeight;
    };
  })();`;

  return `javascript:${encodeURIComponent(scriptContent.replace(/\s+/g, ' '))}`;
}
