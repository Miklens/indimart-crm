/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 */
export function generateBookmarkletCode(firebaseConfig, catalogProducts = []) {
  const configStr = JSON.stringify(firebaseConfig);
  const catalogStr = JSON.stringify(catalogProducts);

  const scriptContent = `(function() {
    const config = ${configStr};
    const catalogProducts = ${catalogStr};
    
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
      statusDiv.innerHTML = 'Initializing sync...<br>';
      
      const startDateVal = document.getElementById('sync-start-date').value;
      const endDateVal = document.getElementById('sync-end-date').value;
      const startLimit = startDateVal ? new Date(startDateVal) : null;
      const endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999);
      
      const firstCard = document.querySelector('.lftcntctnew');
      const cardContainer = firstCard ? (firstCard.closest('.lft_scrol') || firstCard.closest('[class*="scroll"]') || firstCard.closest('[style*="overflow"]') || firstCard.parentElement) : null;
      
      if (firstCard) {
        statusDiv.innerHTML += 'Loading leads from list...<br>';
        let prevCount = 0;
        let scrollAttempts = 0;
        let noChangeCount = 0;
        
        while (scrollAttempts < 100) {
          const cards = document.querySelectorAll('.lftcntctnew');
          
          if (cards.length === prevCount) {
            noChangeCount++;
            if (noChangeCount >= 4) {
              statusDiv.innerHTML += 'No more new leads loaded. Starting sync...<br>';
              break;
            }
            await new Promise(r => setTimeout(r, 1200));
          } else {
            noChangeCount = 0;
          }
          prevCount = cards.length;
          
          if (startLimit && cards.length > 0) {
            const lastCard = cards[cards.length - 1];
            const lastCardText = lastCard.innerText;
            const lastCardLines = lastCardText.split('\\n').map(l => l.trim()).filter(l => l.length > 1);
            let lastCardDate = new Date();
            const dateLine = lastCardLines[lastCardLines.length - 1] || '';
            if (dateLine) {
              const dLower = dateLine.toLowerCase();
              if (dLower.includes('yesterday')) {
                lastCardDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
              } else if (dLower.includes('am') || dLower.includes('pm') || dLower.includes(':')) {
                lastCardDate = new Date();
              } else {
                const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                const parts = dLower.replace(/-/g, ' ').split(' ');
                const day = parseInt(parts[0]);
                const monthIndex = months.findIndex(m => parts[1]?.includes(m));
                if (!isNaN(day) && monthIndex !== -1) {
                  lastCardDate = new Date(new Date().getFullYear(), monthIndex, day);
                }
              }
            }
            if (lastCardDate < startLimit) {
              statusDiv.innerHTML += \`Reached leads older than Start Date (\${lastCardDate.toISOString().split('T')[0]}). Stopped loading.<br>\`;
              break;
            }
          }
          
          if (cards.length > 0) {
            const lastCard = cards[cards.length - 1];
            lastCard.scrollIntoView({ block: 'end' });
            
            let p = lastCard.parentElement;
            while (p && p !== document.body) {
              p.scrollTop = p.scrollHeight;
              p.dispatchEvent(new Event('scroll', { bubbles: true }));
              p = p.parentElement;
            }
          }
          
          statusDiv.innerHTML = \`Loading leads... Found \${prevCount} contacts.<br>\`;
          statusDiv.scrollTop = statusDiv.scrollHeight;
          await new Promise(r => setTimeout(r, 800));
          scrollAttempts++;
        }
      }
      
      const leadCards = Array.from(document.querySelectorAll('.lftcntctnew'));
      statusDiv.innerHTML += \`Found \${leadCards.length} contacts on left panel.<br>\`;
      
      if (leadCards.length === 0) {
        statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ No contacts found. Please make sure you are on the Lead Manager / Message Centre page.</span>';
        return;
      }
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      statusDiv.innerHTML += '<b>Starting sync loop...</b><br>';

      let nextIdNum = 1;
      const existingLeads = [];
      try {
        const fetchUrl = \`https://firestore.googleapis.com/v1/projects/\${config.projectId}/databases/(default)/documents/leads?pageSize=1000\`;
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const data = await res.json();
          const docs = data.documents || [];
          docs.forEach(d => {
            const nameParts = d.name.split('/');
            const docId = nameParts[nameParts.length - 1];
            
            const fields = d.fields || {};
            const contactVal = fields.contact?.stringValue || '';
            const dateVal = fields.date?.stringValue || '';
            
            existingLeads.push({ id: docId, contact: contactVal, date: dateVal });
            
            if (/^IM\d+$/.test(docId)) {
              const num = parseInt(docId.replace('IM', ''), 10);
              if (!isNaN(num) && num >= nextIdNum) {
                nextIdNum = num + 1;
              }
            }
          });
        }
      } catch (e) {
        console.error("Failed to fetch existing leads", e);
      }
      
      for (let i = 0; i < leadCards.length; i++) {
        const card = leadCards[i];
        try {
          const nameEl = card.querySelector('.fs14.fwb');
          const customerName = nameEl ? nameEl.innerText.trim() : 'Unknown Buyer';
          
          statusDiv.innerHTML += \`Scanning [\${i+1}/\${leadCards.length}]: \${customerName}...<br>\`;
          statusDiv.scrollTop = statusDiv.scrollHeight;
          
          card.click();
          await new Promise(r => setTimeout(r, 750));
          
          const bodyText = document.body.innerText;
          const phoneRegex = /(?:\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/g;
          let phoneMatch;
          let contact = '';
          
          const rightCol = document.querySelector('.lms_right, [class*="right"], [class*="detail"]');
          const searchArea = rightCol ? rightCol.innerText : bodyText;
          
          const matches = [];
          while ((phoneMatch = phoneRegex.exec(searchArea)) !== null) {
            matches.push(phoneMatch[1]);
          }
          
          if (matches.length > 0) {
            contact = matches[0];
          } else {
            const globalMatches = [];
            while ((phoneMatch = phoneRegex.exec(bodyText)) !== null) {
              globalMatches.push(phoneMatch[1]);
            }
            contact = globalMatches.find(num => num !== config.sellerMobile) || globalMatches[0] || '0000000000';
          }
          
          /* Read raw lines from card to parse product, location and date */
          const cardText = card.innerText;
          const lines = cardText.split('\\n').map(l => l.trim()).filter(l => l.length > 1);
          
          /* Extract Location (City/State) */
          let city = '';
          let state = '';
          const locationLine = lines.find(l => l.includes(','));
          if (locationLine) {
            const parts = locationLine.split(',');
            city = parts[0]?.trim() || '';
            state = parts[1]?.trim() || '';
          }
          
          /* Extract Enquiry Date */
          let leadDate = new Date();
          const dateLine = lines[lines.length - 1] || '';
          if (dateLine) {
            const dLower = dateLine.toLowerCase();
            if (dLower.includes('yesterday')) {
              leadDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            } else if (dLower.includes('am') || dLower.includes('pm') || dLower.includes(':')) {
              /* Time format like "11:49 AM" means today */
              leadDate = new Date();
            } else {
              /* Format like "10-Jun" or "10 Jun" */
              const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const parts = dLower.replace(/-/g, ' ').split(' ');
              const day = parseInt(parts[0]);
              const monthIndex = months.findIndex(m => parts[1]?.includes(m));
              if (!isNaN(day) && monthIndex !== -1) {
                leadDate = new Date(new Date().getFullYear(), monthIndex, day);
              }
            }
          }
          
          /* Check date range */
          if (startLimit && leadDate < startLimit) {
            statusDiv.innerHTML += \`  [Skip] Date (\${leadDate.toISOString().split('T')[0]}) is before Start Date (\${startLimit.toISOString().split('T')[0]})<br>\`;
            skippedCount++;
            continue;
          }
          if (endLimit && leadDate > endLimit) {
            statusDiv.innerHTML += \`  [Skip] Date (\${leadDate.toISOString().split('T')[0]}) is after End Date (\${endLimit.toISOString().split('T')[0]})<br>\`;
            skippedCount++;
            continue;
          }
          
          const formattedDate = leadDate.toISOString().split('T')[0];
          
          /* Extract Product Name by filtering out Name, Location, Time, and Preview Messages */
          let product = 'IndiaMART Enquiry';
           
          /* 1. Try to extract from right column details since it's the most accurate */
          if (rightCol) {
            /* A. Look for product detail link */
            const prodLink = rightCol.querySelector('a[href*="proddetail"], a[href*="product"]');
            if (prodLink && prodLink.innerText.trim()) {
              product = prodLink.innerText.trim();
            } else {
              /* B. Look for common product name classes/elements */
              const prodEl = rightCol.querySelector('.m-pname, .prod-name, .product-name, [class*="prod-name"], [class*="product-name"], [class*="pname"], [class*="prd-name"]');
              if (prodEl && prodEl.innerText.trim()) {
                product = prodEl.innerText.trim();
              }
            }
          }
           
          /* 2. If product is still default/empty or generic, try extracting from the card lines */
          if (product === 'IndiaMART Enquiry' || !product) {
            const candidateLines = lines.filter(line => {
              const l = line.toLowerCase();
              const isName = l === customerName.toLowerCase();
              const isLoc = line.includes(',') && (l.includes('karnataka') || l.includes('bengal') || l.includes('maharashtra') || l.includes('india') || l.includes('delhi'));
              const isTime = l.match(/\\b\\d{1,2}:\\d{2}\\s*(am|pm)\\b/i) || l.match(/^\\d{1,2}\\s+[a-z]{3}$/i);
              const isPreview = /^(hi|hello|dear|good\\s+day|good\\s+morning|good\\s+afternoon|good\\s+evening)\\b/i.test(l) ||
                                l.includes('thank') ||
                                l.includes('enquir') ||
                                l.includes('interest') ||
                                l.includes('viewed') ||
                                l.includes('message') ||
                                l.includes('reply') ||
                                l.includes('contact') ||
                                l.includes('requirements') ||
                                l.includes('looking for') ||
                                l.includes('additional details');
              return !isName && !isLoc && !isTime && !isPreview;
            });
            
            if (candidateLines.length > 0) {
              product = candidateLines[0];
            }
          }
           
          /* Match against catalog products */
          let matched = null;
          if (Array.isArray(catalogProducts) && catalogProducts.length > 0) {
            const cleanStr = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const scrapedClean = cleanStr(product);
             
            /* 1. Exact clean match */
            matched = catalogProducts.find(p => cleanStr(p.name) === scrapedClean);
             
            /* 2. Substring match (catalog name in scraped name) */
            if (!matched) {
              matched = catalogProducts.find(p => {
                const cClean = cleanStr(p.name);
                return cClean.length > 3 && scrapedClean.includes(cClean);
              });
            }
             
            /* 3. Substring match (scraped name in catalog name) */
            if (!matched) {
              matched = catalogProducts.find(p => {
                const cClean = cleanStr(p.name);
                return scrapedClean.length > 3 && cClean.includes(scrapedClean);
              });
            }
          }
           
          let displayProduct = product;
          let productPrice = 0;
          let productGst = '5';
          let productHsn = '';
           
          if (matched) {
            displayProduct = matched.name;
            productPrice = parseFloat(matched.price) || 0;
            productGst = matched.gst || '5';
            productHsn = matched.hsn || '';
          } else {
            /* Mark as new item if it is a valid name and not already marked */
            if (displayProduct && displayProduct !== 'IndiaMART Enquiry' && !displayProduct.startsWith('[NEW]')) {
              displayProduct = '[NEW] ' + displayProduct;
            }
          }
          
          /* Check if this contact has already been synced on this formattedDate */
          const existing = existingLeads.find(l => l.contact === contact && l.date === formattedDate);
          
          let docId = '';
          if (existing) {
            docId = existing.id;
          } else {
            docId = 'IM' + String(nextIdNum).padStart(3, '0');
            nextIdNum++;
            existingLeads.push({ id: docId, contact: contact, date: formattedDate });
          }
          
          const leadPayload = {
            id: docId,
            date: formattedDate,
            customerName: customerName,
            contact: contact,
            product: displayProduct,
            status: 'New Enquiry',
            followUpDate: '',
            orderValue: productPrice,
            remarks: 'Imported via IndiaMART Auto-Clicker',
            state: state,
            city: city,
            source: 'IndiaMART Direct',
            timestamp: leadDate.getTime(),
            productList: [{ name: displayProduct, qty: 1, price: productPrice, gst: productGst, hsn: productHsn }],
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
