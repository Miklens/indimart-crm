/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 */
export function generateBookmarkletCode(firebaseConfig, catalogProducts = [], crmLeads = [], sellerMobile = '') {
  const configStr = JSON.stringify({ ...firebaseConfig, sellerMobile });
  const catalogStr = JSON.stringify(catalogProducts);
  
  const mappedLeads = (crmLeads || []).map(l => ({
    id: l.id,
    contact: l.contact || '',
    date: l.date || ''
  }));
  const existingLeadsStr = JSON.stringify(mappedLeads);
  
  let calculatedNextIdNum = 1;
  (crmLeads || []).forEach(l => {
    if (/^IM\d+$/.test(l.id)) {
      const num = parseInt(l.id.replace('IM', ''), 10);
      if (!isNaN(num) && num >= calculatedNextIdNum) {
        calculatedNextIdNum = num + 1;
      }
    }
  });

  const scriptContent = `(function() {
    const config = ${configStr};
    const sellerMobileDigits = String(config.sellerMobile || '').replace(/[^0-9]/g, '').slice(-10);
    const catalogProducts = ${catalogStr};
    const existingLeads = ${existingLeadsStr};
    let nextIdNum = ${calculatedNextIdNum};
    
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
      
      // Scroll list container to top first
      const firstCard = document.querySelector('.lftcntctnew');
      if (firstCard) {
        firstCard.scrollIntoView({ block: 'start' });
        let p = firstCard.parentElement;
        while (p && p !== document.body) {
          p.scrollTop = 0;
          p.dispatchEvent(new Event('scroll', { bubbles: true }));
          p = p.parentElement;
        }
      }
      await new Promise(r => setTimeout(r, 1000));
      
      const startDateVal = document.getElementById('sync-start-date').value;
      const endDateVal = document.getElementById('sync-end-date').value;
      const startLimit = startDateVal ? new Date(startDateVal) : null;
      const endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999);
      
      let syncedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      const processedContacts = new Set();
      
      statusDiv.innerHTML += '<b>Starting scroll & scan loop...</b><br>';
      let scrollAttempts = 0;
      let noNewLeadsCount = 0;
      let reachedDateLimit = false;
      
      while (scrollAttempts < 150) {
        const visibleCards = Array.from(document.querySelectorAll('.lftcntctnew'));
        if (visibleCards.length === 0) {
          statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ No contacts found. Make sure you are on Message Centre page.</span>';
          return;
        }
        
        let newLeadsInThisScroll = 0;
        
        for (let i = 0; i < visibleCards.length; i++) {
          const card = visibleCards[i];
          const nameEl = card.querySelector('.fs14.fwb');
          const customerName = nameEl ? nameEl.innerText.trim() : 'Unknown Buyer';
          const cardText = card.innerText;
          const lines = cardText.split('\\n').map(l => l.trim()).filter(l => l.length > 1);
          
          let leadDate = new Date();
          const dateLine = lines[lines.length - 1] || '';
          if (dateLine) {
            const dLower = dateLine.toLowerCase();
            if (dLower.includes('yesterday')) {
              leadDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            } else if (dLower.includes('am') || dLower.includes('pm') || dLower.includes(':')) {
              leadDate = new Date();
            } else {
              const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
              const parts = dLower.replace(/-/g, ' ').split(' ');
              const day = parseInt(parts[0]);
              const monthIndex = months.findIndex(m => parts[1]?.includes(m));
              if (!isNaN(day) && monthIndex !== -1) {
                leadDate = new Date(new Date().getFullYear(), monthIndex, day);
              }
            }
          }
          
          const uniqueKey = customerName + '_' + leadDate.toISOString().split('T')[0];
          if (processedContacts.has(uniqueKey)) continue;
          processedContacts.add(uniqueKey);
          newLeadsInThisScroll++;
          
          if (startLimit && leadDate < startLimit) {
            reachedDateLimit = true;
            statusDiv.innerHTML += \`Reached leads older than Start Date (\${leadDate.toISOString().split('T')[0]}). Stopping scroll.<br>\`;
            break;
          }
          if (endLimit && leadDate > endLimit) {
            statusDiv.innerHTML += \`  [Skip] \${customerName} Date (\${leadDate.toISOString().split('T')[0]}) is after End Date (\${endLimit.toISOString().split('T')[0]})<br>\`;
            skippedCount++;
            continue;
          }
          
          statusDiv.innerHTML += \`Scanning: \${customerName}...<br>\`;
          statusDiv.scrollTop = statusDiv.scrollHeight;
          
          card.click();
          await new Promise(r => setTimeout(r, 750));
          const bodyText = document.body.innerText;
          let contact = '';
          
          /* 1. Try to find 10-digit mobile number directly from card lines first */
          for (const line of lines) {
            const cleanDigits = line.replace(/[^0-9]/g, '');
            if (cleanDigits.length >= 10) {
              const last10 = cleanDigits.slice(-10);
              if (last10[0] >= '6' && last10[0] <= '9' && last10 !== sellerMobileDigits) {
                contact = last10;
                break;
              }
            }
          }
          
          /* 2. If not found on card, try rightCol or bodyText */
          if (!contact) {
            const phoneRegex = /(?:\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/g;
            let phoneMatch;
            const rightCol = document.querySelector('.lms_right, [class*="right"], [class*="detail"]');
            const searchArea = rightCol ? rightCol.innerText : bodyText;
            const matches = [];
            while ((phoneMatch = phoneRegex.exec(searchArea)) !== null) {
              if (phoneMatch[1] !== sellerMobileDigits) {
                matches.push(phoneMatch[1]);
              }
            }
            
            if (matches.length > 0) {
              contact = matches[0];
            } else {
              const globalMatches = [];
              while ((phoneMatch = phoneRegex.exec(bodyText)) !== null) {
                if (phoneMatch[1] !== sellerMobileDigits) {
                  globalMatches.push(phoneMatch[1]);
                }
              }
              contact = globalMatches[0] || '0000000000';
            }
          }
          
          let city = '';
          let state = '';
          const locationLine = lines.find(l => l.includes(','));
          if (locationLine) {
            const parts = locationLine.split(',');
            city = parts[0]?.trim() || '';
            state = parts[1]?.trim() || '';
          }
          
          const formattedDate = leadDate.toISOString().split('T')[0];
          let product = 'IndiaMART Enquiry';
          const rightCol = document.querySelector('.lms_right, [class*="right"], [class*="detail"]');
          if (rightCol) {
            const prodLink = rightCol.querySelector('a[href*="proddetail"], a[href*="product"]');
            if (prodLink && prodLink.innerText.trim()) {
              product = prodLink.innerText.trim();
            } else {
              const prodEl = rightCol.querySelector('.m-pname, .prod-name, .product-name, [class*="prod-name"], [class*="product-name"], [class*="pname"], [class*="prd-name"]');
              if (prodEl && prodEl.innerText.trim()) {
                product = prodEl.innerText.trim();
              }
            }
          }
          
          if (product === 'IndiaMART Enquiry' || !product) {
            const candidateLines = lines.filter(line => {
              const l = line.toLowerCase();
              const isName = l.includes(customerName.toLowerCase()) || customerName.toLowerCase().includes(l);
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
                                l.includes('additional details') ||
                                l.includes('call attempted') ||
                                l.includes('call received') ||
                                l.includes('missed call') ||
                                l.includes('duration:') ||
                                l === 'gst' ||
                                l.includes('outgoing') ||
                                l.includes('incoming');
              return !isName && !isLoc && !isTime && !isPreview;
            });
            if (candidateLines.length > 0) product = candidateLines[0];
          }
          
          let matched = null;
          if (Array.isArray(catalogProducts) && catalogProducts.length > 0) {
            const cleanStr = str => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const scrapedClean = cleanStr(product);
            matched = catalogProducts.find(p => cleanStr(p.name) === scrapedClean);
            if (!matched) matched = catalogProducts.find(p => { const cClean = cleanStr(p.name); return cClean.length > 3 && scrapedClean.includes(cClean); });
            if (!matched) matched = catalogProducts.find(p => { const cClean = cleanStr(p.name); return scrapedClean.length > 3 && cClean.includes(scrapedClean); });
          }
          
          let displayProduct = product;
          let productPrice = 0;
          let productGst = '5';
          let productHsn = '';
          let syncStatus = 'New Enquiry';
          
          if (matched) {
            displayProduct = matched.name;
            productPrice = parseFloat(matched.price) || 0;
            productGst = matched.gst || '5';
            productHsn = matched.hsn || '';
            syncStatus = 'Contacted';
          } else {
            if (displayProduct && displayProduct !== 'IndiaMART Enquiry' && !displayProduct.startsWith('[NEW]')) {
              displayProduct = '[NEW] ' + displayProduct;
            }
            syncStatus = 'New Enquiry';
          }
          
          const existing = existingLeads.find(l => l.contact === contact && l.date === formattedDate);
          let docId = existing ? existing.id : 'IM' + String(nextIdNum++).padStart(3, '0');
          
          const leadPayload = { 
            id: docId, 
            date: formattedDate, 
            customerName: customerName, 
            contact: contact, 
            product: displayProduct, 
            status: syncStatus, 
            followUpDate: '', 
            orderValue: productPrice, 
            remarks: '', 
            state: state, 
            city: city, 
            source: 'IndiaMART Direct', 
            timestamp: leadDate.getTime(), 
            productList: [{ name: displayProduct, qty: 1, price: productPrice, gst: productGst, hsn: productHsn }], 
            history: [{ status: syncStatus, timestamp: Date.now() }] 
          };
          const firestoreFields = {};
          Object.keys(leadPayload).forEach(key => {
            const val = leadPayload[key];
            if (typeof val === 'string') firestoreFields[key] = { stringValue: val };
            else if (typeof val === 'number') firestoreFields[key] = { doubleValue: val };
            else if (Array.isArray(val)) {
              firestoreFields[key] = { arrayValue: { values: val.map(item => ({ mapValue: { fields: Object.keys(item).reduce((acc, itemKey) => { const v = item[itemKey]; acc[itemKey] = typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) }; return acc; }, {}) } })) } };
            }
          });
          
          try {
            const url = \`https://firestore.googleapis.com/v1/projects/\${config.projectId}/databases/(default)/documents/leads/\${docId}?updateMask.fieldPaths=id&updateMask.fieldPaths=date&updateMask.fieldPaths=customerName&updateMask.fieldPaths=contact&updateMask.fieldPaths=product&updateMask.fieldPaths=status&updateMask.fieldPaths=remarks&updateMask.fieldPaths=state&updateMask.fieldPaths=city&updateMask.fieldPaths=source&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=productList&updateMask.fieldPaths=history\`;
            const response = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: \`projects/\${config.projectId}/databases/(default)/documents/leads/\${docId}\`, fields: firestoreFields }) });
            if (response.ok) {
              syncedCount++;
              statusDiv.innerHTML += \`<span style="color:#10b981;">✔️ Synced: \${customerName} (\${contact})</span><br>\`;
            } else {
              errorCount++;
              statusDiv.innerHTML += \`<span style="color:#f43f5e;">❌ Failed to upload \${customerName}</span><br>\`;
            }
          } catch (err) {
            errorCount++;
            statusDiv.innerHTML += \`<span style="color:#f43f5e;">❌ Network error: \${customerName}</span><br>\`;
          }
          statusDiv.scrollTop = statusDiv.scrollHeight;
        }
        
        if (reachedDateLimit) break;
        if (newLeadsInThisScroll === 0) {
          noNewLeadsCount++;
          if (noNewLeadsCount >= 5) {
            statusDiv.innerHTML += 'Finished list (no more leads loading).<br>';
            break;
          }
          await new Promise(r => setTimeout(r, 1200));
        } else {
          noNewLeadsCount = 0;
        }
        
        if (visibleCards.length > 0) {
          const lastCard = visibleCards[visibleCards.length - 1];
          lastCard.scrollIntoView({ block: 'end' });
          let p = lastCard.parentElement;
          while (p && p !== document.body) {
            p.scrollTop = p.scrollHeight;
            p.dispatchEvent(new Event('scroll', { bubbles: true }));
            p = p.parentElement;
          }
        }
        statusDiv.innerHTML += \`Loaded & processed \${processedContacts.size} leads...<br>\`;
        statusDiv.scrollTop = statusDiv.scrollHeight;
        await new Promise(r => setTimeout(r, 1000));
        scrollAttempts++;
      }
      
      statusDiv.innerHTML += \`<br><strong style="color:#10b981;">Sync Complete!</strong><br>Synced: \${syncedCount}<br>Failed/Skipped: \${errorCount + skippedCount}\`;
      statusDiv.scrollTop = statusDiv.scrollHeight;
    };
  })();`;

  return `javascript:${encodeURIComponent(scriptContent.replace(/\s+/g, ' '))}`;
}
