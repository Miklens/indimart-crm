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
          Scan & Sync
        </button>
        <button id="debug-dom-btn" style="padding:10px; background:#475569; border:none; border-radius:6px; color:#fff; font-weight:600; cursor:pointer; font-size:13px;" title="Analyze Page elements to find target classes">
          🔍 Inspect Page
        </button>
      </div>
      <div id="sync-status" style="margin-top:12px; font-size:12px; color:#94a3b8; line-height:1.4; max-height:200px; overflow-y:auto; border-radius:6px; background:#0f172a; padding:8px; display:none;">
      </div>
    \`;
    
    document.body.appendChild(panel);
    
    const today = new Date().toISOString().split('T')[0];
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('sync-start-date').value = past7;
    document.getElementById('sync-end-date').value = today;
    
    document.getElementById('close-sync-panel').onclick = () => panel.remove();
    
    /* Debug DOM to find the exact selectors on the page */
    document.getElementById('debug-dom-btn').onclick = () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '<b>Analyzing page classes...</b><br>';
      
      const elements = Array.from(document.querySelectorAll('*'));
      const classMap = {};
      elements.forEach(el => {
        if (el.className && typeof el.className === 'string') {
          el.className.split(/\\s+/).forEach(cls => {
            if (cls) classMap[cls] = (classMap[cls] || 0) + 1;
          });
        }
      });
      
      /* Print top 20 most common classes */
      const sortedClasses = Object.entries(classMap).sort((a,b) => b[1] - a[1]).slice(0, 25);
      statusDiv.innerHTML += '<b>Common Class Names found:</b><br>';
      sortedClasses.forEach(([cls, count]) => {
        statusDiv.innerHTML += \`.\${cls} (\${count} times)<br>\`;
      });
      
      /* Look for elements containing contact names and list them */
      statusDiv.innerHTML += '<br><b>Contact List elements check:</b><br>';
      const contactContainers = Array.from(document.querySelectorAll('div, li, span')).filter(el => {
        return el.innerText && (el.innerText.includes('YERR') || el.innerText.includes('PRAV') || el.innerText.includes('Saya'));
      });
      
      if (contactContainers.length > 0) {
        statusDiv.innerHTML += \`Found \${contactContainers.length} matching text containers.<br>\`;
        contactContainers.slice(0, 5).forEach((el, idx) => {
          const tagName = el.tagName.toLowerCase();
          const className = el.className || 'no class';
          statusDiv.innerHTML += \`[\${idx}] &lt;\${tagName} class="\${className}"&gt; (text: "\${el.innerText.substring(0, 40)}...")<br>\`;
        });
      } else {
        statusDiv.innerHTML += 'No elements matched contact text names.<br>';
      }
    };
    
    document.getElementById('start-sync-btn').onclick = async () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = 'Starting scan...<br>';
      
      const startDateVal = document.getElementById('sync-start-date').value;
      const endDateVal = document.getElementById('sync-end-date').value;
      
      const startLimit = startDateVal ? new Date(startDateVal) : null;
      const endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999);
      
      /* Try both standard card selectors and list item elements */
      const selectors = [
        '.eq-card', '.lead-card', '.enq-card', '.card', '.leads-card',
        'div[class*="contact"]', 'div[class*="item"]', 'li[class*="item"]',
        'div[class*="thread"]', 'div[class*="chat"]', 'li[class*="chat"]'
      ];
      
      const leadCards = Array.from(document.querySelectorAll(selectors.join(','))).filter(el => {
        /* Filter out outer wrappers by ensuring it has relatively short text or is a distinct block */
        const text = el.innerText || '';
        return text.length > 10 && text.length < 500 && (text.includes('Karnataka') || text.includes('Bengal') || text.includes('Maharashtra') || text.match(/\\b\\d{10}\\b/) || text.match(/\\+91/));
      });
      
      statusDiv.innerHTML += \`Found \${leadCards.length} potential contact items.<br>\`;
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      for (const card of leadCards) {
        try {
          const text = card.innerText;
          
          /* Parse Contact Phone Number or default to empty since they are listed */
          const phoneMatch = text.match(/(\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/);
          const contact = phoneMatch ? phoneMatch[2] : '0000000000';
          
          let customerName = 'Unknown Buyer';
          const lines = text.split('\\n').map(l => l.trim()).filter(l => l.length > 1);
          if (lines.length > 0) customerName = lines[0];
          
          let product = 'IndiaMART Enquiry';
          /* Check if there is a product text on the card */
          if (lines.length > 2) {
            product = lines[2];
          } else if (lines.length > 1) {
            product = lines[1];
          }
          
          let city = '';
          let state = '';
          const locationLine = lines.find(l => l.includes(',') && (l.includes('Karnataka') || l.includes('Bengal') || l.includes('Maharashtra') || l.includes('India')));
          if (locationLine) {
            const parts = locationLine.split(',');
            city = parts[0]?.trim() || '';
            state = parts[1]?.trim() || '';
          }
          
          let leadDate = new Date();
          
          if (startLimit && leadDate < startLimit) { skippedCount++; continue; }
          if (endLimit && leadDate > endLimit) { skippedCount++; continue; }
          
          const formattedDate = leadDate.toISOString().split('T')[0];
          const cleanProd = product.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
          const docId = \`IM_\${contact || 'nomobile'}_\${formattedDate}_\${cleanProd}\`;
          
          const leadPayload = {
            id: docId,
            date: formattedDate,
            customerName: customerName,
            contact: contact,
            product: product,
            status: 'New Enquiry',
            followUpDate: '',
            orderValue: 0,
            remarks: 'Imported via IndiaMART MessageCentre',
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
            statusDiv.innerHTML += \`✔️ Synced: \${customerName} (\${product})<br>\`;
          } else {
            errorCount++;
          }
          
        } catch (e) {
          errorCount++;
        }
      }
      
      statusDiv.innerHTML += \`<br><strong style="color:#10b981;">Scan Done!</strong><br>Found: \${leadCards.length}<br>Synced: \${syncedCount}<br>Failed/Skipped: \${errorCount + skippedCount}\`;
    };
  })();`;

  return `javascript:${encodeURIComponent(scriptContent.replace(/\s+/g, ' '))}`;
}
