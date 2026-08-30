/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 * Enhanced with multi-selector support, adaptive scroll container detection,
 * auto-product fuzzy mapping, and live progress UI.
 */
export function generateBookmarkletCode(firebaseConfig, catalogProducts = [], crmLeads = [], sellerMobile = '') {
  const configStr = JSON.stringify({ ...firebaseConfig, sellerMobile });
  const catalogStr = JSON.stringify(catalogProducts || []);
  
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
    var config = ${configStr};
    var sellerMobileDigits = String(config.sellerMobile || '').replace(/[^0-9]/g, '').slice(-10);
    var catalogProducts = ${catalogStr};
    var existingLeads = ${existingLeadsStr};
    var nextIdNum = ${calculatedNextIdNum};
    
    var oldPanel = document.getElementById('indimart-sync-panel');
    if (oldPanel) oldPanel.remove();
    
    var panel = document.createElement('div');
    panel.id = 'indimart-sync-panel';
    panel.style.cssText = 'position:fixed; top:24px; right:24px; width:380px; z-index:9999999; background:rgba(15,23,42,0.96); color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; border:1px solid #334155; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05); padding:18px; box-sizing:border-box; backdrop-filter:blur(16px); user-select:none;';
    
    var panelHtml = '<div id="sync-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #334155; cursor:move;">' +
      '<div style="display:flex; align-items:center; gap:8px;">' +
        '<span style="font-size:18px;">🇮🇳</span>' +
        '<h3 style="margin:0; font-size:15px; color:#10b981; font-weight:700; letter-spacing:-0.01em;">IndiaMART Sync CRM</h3>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:6px;">' +
        '<span id="sync-live-badge" style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>' +
        '<button id="close-sync-panel" style="background:none; border:none; color:#94a3b8; cursor:pointer; font-size:18px; padding:2px 6px; border-radius:4px; line-height:1;">✕</button>' +
      '</div>' +
    '</div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">' +
      '<div>' +
        '<label style="display:block; font-size:11px; font-weight:600; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">Start Date</label>' +
        '<input type="date" id="sync-start-date" style="width:100%; box-sizing:border-box; padding:7px 10px; border-radius:8px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:12px; outline:none;" />' +
      '</div>' +
      '<div>' +
        '<label style="display:block; font-size:11px; font-weight:600; color:#94a3b8; margin-bottom:4px; text-transform:uppercase;">End Date</label>' +
        '<input type="date" id="sync-end-date" style="width:100%; box-sizing:border-box; padding:7px 10px; border-radius:8px; border:1px solid #475569; background:#0f172a; color:#fff; font-size:12px; outline:none;" />' +
      '</div>' +
    '</div>' +
    '<div style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;">' +
      '<button id="preset-7d" style="flex:1; padding:4px 8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">Last 7D</button>' +
      '<button id="preset-30d" style="flex:1; padding:4px 8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">Last 30D</button>' +
      '<button id="preset-today" style="flex:1; padding:4px 8px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">Today</button>' +
    '</div>' +
    '<div style="display:flex; gap:8px; margin-bottom:12px;">' +
      '<button id="start-sync-btn" style="flex:1; padding:11px; background:linear-gradient(135deg,#10b981,#059669); border:none; border-radius:8px; color:#fff; font-weight:700; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center; gap:6px;">' +
        '<span>⚡</span> Scan & Sync Leads' +
      '</button>' +
    '</div>' +
    '<div id="sync-stats-grid" style="display:none; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:12px; text-align:center;">' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">FOUND</div>' +
        '<div id="stat-found" style="font-size:14px; font-weight:700; color:#38bdf8;">0</div>' +
      '</div>' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">SYNCED</div>' +
        '<div id="stat-synced" style="font-size:14px; font-weight:700; color:#10b981;">0</div>' +
      '</div>' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">SKIPPED</div>' +
        '<div id="stat-skipped" style="font-size:14px; font-weight:700; color:#eab308;">0</div>' +
      '</div>' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">FAILED</div>' +
        '<div id="stat-failed" style="font-size:14px; font-weight:700; color:#f43f5e;">0</div>' +
      '</div>' +
    '</div>' +
    '<div id="sync-progress-bar-container" style="display:none; height:4px; background:#1e293b; border-radius:4px; overflow:hidden; margin-bottom:10px;">' +
      '<div id="sync-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#10b981,#38bdf8); transition:width 0.2s;"></div>' +
    '</div>' +
    '<div id="sync-status" style="font-size:11px; color:#94a3b8; line-height:1.5; max-height:180px; overflow-y:auto; border-radius:8px; background:#020617; padding:10px; display:none; border:1px solid #1e293b; font-family:Consolas, Monaco, monospace;"></div>';
    
    panel.innerHTML = panelHtml;
    document.body.appendChild(panel);
    
    var header = document.getElementById('sync-header');
    var isDragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    header.onmousedown = function(e) {
      if (e.target.id === 'close-sync-panel') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.onmousemove = function(me) {
        if (!isDragging) return;
        panel.style.right = 'auto';
        panel.style.left = (startLeft + (me.clientX - startX)) + 'px';
        panel.style.top = (startTop + (me.clientY - startY)) + 'px';
      };
      document.onmouseup = function() {
        isDragging = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };

    var today = new Date().toISOString().split('T')[0];
    var past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    var past30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    var startInput = document.getElementById('sync-start-date');
    var endInput = document.getElementById('sync-end-date');
    startInput.value = past30;
    endInput.value = today;

    document.getElementById('preset-7d').onclick = function() { startInput.value = past7; endInput.value = today; };
    document.getElementById('preset-30d').onclick = function() { startInput.value = past30; endInput.value = today; };
    document.getElementById('preset-today').onclick = function() { startInput.value = today; endInput.value = today; };
    document.getElementById('close-sync-panel').onclick = function() { panel.remove(); };

    function findContactCards() {
      var selectorGroups = [
        '.lftcntctnew',
        '.lftcntct',
        '[class*="lftcntct"]',
        '[class*="contactCard"]',
        '[class*="contact_card"]',
        '[class*="ContactCard"]',
        '[class*="leadCard"]',
        '[class*="lead_card"]',
        '[class*="buyerCard"]',
        '[class*="buyer_card"]',
        'div[id^="cntct_"]',
        'div[data-contact-id]',
        'div[data-glid]',
        '[data-testid*="contact"]'
      ];

      for (var s = 0; s < selectorGroups.length; s++) {
        var els = Array.from(document.querySelectorAll(selectorGroups[s]));
        if (els.length > 0) return els;
      }

      var leftCol = document.querySelector('.lms_left, [class*="left"], [class*="sidebar"], [class*="contactList"], [class*="chatList"], [class*="list-container"]');
      if (leftCol) {
        var children = Array.from(leftCol.querySelectorAll('div, li')).filter(function(el) {
          if (el.children.length > 8 || el.children.length < 1) return false;
          var txt = el.innerText || '';
          var hasTimeOrDate = /\\b(\\d{1,2}:\\d{2}\\s*(am|pm)|yesterday|today|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\b/i.test(txt);
          var hasStateOrCity = /(karnataka|maharashtra|andhra|tamil|delhi|gujarat|bengal|punjab|india|,)/i.test(txt);
          return (hasTimeOrDate || hasStateOrCity) && txt.length > 10 && txt.length < 500;
        });

        var validCards = [];
        children.forEach(function(c) {
          if (!validCards.some(function(existing) { return existing.contains(c) || c.contains(existing); })) {
            validCards.push(c);
          }
        });
        if (validCards.length > 0) return validCards;
      }

      return [];
    }

    function findScrollContainer(firstCard) {
      if (firstCard) {
        var p = firstCard.parentElement;
        while (p && p !== document.body) {
          var style = window.getComputedStyle(p);
          if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && p.scrollHeight > p.clientHeight) {
            return p;
          }
          p = p.parentElement;
        }
      }
      var candidates = document.querySelectorAll('.lms_left, [class*="left"], [class*="contactList"], [class*="scroll"], [id*="list"]');
      for (var c = 0; c < candidates.length; c++) {
        var el = candidates[c];
        var s = window.getComputedStyle(el);
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
          return el;
        }
      }
      return document.documentElement || document.body;
    }

    function parseLeadDate(dateStr) {
      var leadDate = new Date();
      if (!dateStr) return leadDate;
      var dLower = dateStr.toLowerCase().trim();
      
      if (dLower.includes('today') || dLower.includes('am') || dLower.includes('pm') || /\\b\\d{1,2}:\\d{2}\\b/.test(dLower)) {
        return new Date();
      }
      if (dLower.includes('yesterday')) {
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      
      var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      var monthRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
      var monthMatch = dLower.match(monthRegex);
      
      if (monthMatch) {
        var mIndex = months.indexOf(monthMatch[1].toLowerCase());
        var dayMatch = dLower.match(/\\b(\\d{1,2})\\b/);
        var yearMatch = dLower.match(/\\b(20\\d{2})\\b/);
        var day = dayMatch ? parseInt(dayMatch[1], 10) : 1;
        var year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();
        if (!isNaN(day) && mIndex !== -1) {
          return new Date(year, mIndex, day);
        }
      }
      
      var numDateMatch = dLower.match(/(\\d{1,2})[\\/\\-\\.](\\d{1,2})(?:[\\/\\-\\.](\\d{2,4}))?/);
      if (numDateMatch) {
        var d = parseInt(numDateMatch[1], 10);
        var m = parseInt(numDateMatch[2], 10) - 1;
        var y = numDateMatch[3] ? parseInt(numDateMatch[3], 10) : new Date().getFullYear();
        if (y < 100) y += 2000;
        return new Date(y, m, d);
      }
      
      return leadDate;
    }

    function parseLocation(lines) {
      var city = '';
      var state = '';
      var indianStates = [
        'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat',
        'haryana', 'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh',
        'maharashtra', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'odisha', 'punjab',
        'rajasthan', 'sikkim', 'tamil nadu', 'telangana', 'tripura', 'uttar pradesh',
        'uttarakhand', 'west bengal', 'delhi', 'chandigarh', 'puducherry', 'jammu and kashmir', 'ladakh'
      ];

      for (var lIdx = 0; lIdx < lines.length; lIdx++) {
        var line = lines[lIdx];
        var lLower = line.toLowerCase();
        if (line.includes(',')) {
          var parts = line.split(',').map(function(p) { return p.trim(); }).filter(function(p) {
            var low = p.toLowerCase();
            return low !== 'india' && !/^\\d{6}$/.test(low) && !low.startsWith('india -') && !/^\\d+$/.test(low);
          });
          if (parts.length >= 2) {
            var lastPart = parts[parts.length - 1];
            var stateFound = indianStates.find(function(s) { return lastPart.toLowerCase().includes(s); });
            if (stateFound) {
              state = lastPart;
              city = parts[parts.length - 2] || '';
              break;
            } else {
              city = parts[parts.length - 1];
              state = parts[0];
              break;
            }
          } else if (parts.length === 1) {
            var st = indianStates.find(function(s) { return parts[0].toLowerCase().includes(s); });
            if (st) state = parts[0];
            else city = parts[0];
            break;
          }
        } else {
          var stSingle = indianStates.find(function(s) { return lLower === s || lLower.includes(s); });
          if (stSingle) {
            state = line;
            break;
          }
        }
      }
      return { city: city, state: state };
    }

    document.getElementById('start-sync-btn').onclick = async function() {
      var btn = document.getElementById('start-sync-btn');
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>⏳</span> Syncing Leads...';

      var statusDiv = document.getElementById('sync-status');
      var statsGrid = document.getElementById('sync-stats-grid');
      var progBarContainer = document.getElementById('sync-progress-bar-container');
      var progBar = document.getElementById('sync-progress-bar');
      
      statusDiv.style.display = 'block';
      statsGrid.style.display = 'grid';
      progBarContainer.style.display = 'block';
      
      statusDiv.innerHTML = '<span style="color:#38bdf8;">[INIT] Starting IndiaMART Sync Engine...</span><br>';

      var startDateVal = document.getElementById('sync-start-date').value;
      var endDateVal = document.getElementById('sync-end-date').value;
      var startLimit = startDateVal ? new Date(startDateVal) : null;
      if (startLimit) startLimit.setHours(0, 0, 0, 0);
      var endLimit = endDateVal ? new Date(endDateVal) : null;
      if (endLimit) endLimit.setHours(23, 59, 59, 999);

      var foundCards = findContactCards();
      
      if (foundCards.length === 0) {
        statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ No contact cards detected yet. Waiting 2s for page elements to load...</span><br>';
        await new Promise(function(r) { setTimeout(r, 2000); });
        foundCards = findContactCards();
      }

      if (foundCards.length === 0) {
        statusDiv.innerHTML += '<span style="color:#ef4444; font-weight:700;">❌ No contact cards found. Please ensure you are logged into IndiaMART Message Centre (seller.indiamart.com/messagecentre).</span><br>';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<span>⚡</span> Retry Scan';
        return;
      }

      var scrollContainer = findScrollContainer(foundCards[0]);
      if (scrollContainer && scrollContainer.scrollTop !== undefined) {
        scrollContainer.scrollTop = 0;
        scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
      }
      await new Promise(function(r) { setTimeout(r, 600); });

      var syncedCount = 0;
      var skippedCount = 0;
      var errorCount = 0;
      var processedUniqueKeys = new Set();
      
      var scrollAttempts = 0;
      var noNewCardsRounds = 0;
      var reachedDateLimit = false;

      while (scrollAttempts < 120 && !reachedDateLimit) {
        var visibleCards = findContactCards();
        document.getElementById('stat-found').innerText = String(visibleCards.length);
        
        var newProcessedInRound = 0;

        for (var i = 0; i < visibleCards.length; i++) {
          var card = visibleCards[i];
          var cardText = card.innerText || '';
          var lines = cardText.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

          var customerName = 'Unknown Buyer';
          var nameEl = card.querySelector('.fs14.fwb, [class*="name"], [class*="buyer"], h4, h5, strong, b');
          if (nameEl && nameEl.innerText.trim()) {
            customerName = nameEl.innerText.trim();
          } else if (lines.length > 0) {
            customerName = lines[0];
          }

          var leadDate = new Date();
          var dateLine = lines.find(function(l) { return /\\b(\\d{1,2}:\\d{2}\\s*(am|pm)|yesterday|today|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\\d{1,2}[\\/\\-]\\d{1,2})\\b/i.test(l); }) || lines[lines.length - 1] || '';
          leadDate = parseLeadDate(dateLine);
          var formattedDate = leadDate.toISOString().split('T')[0];

          var uniqueKey = customerName.toLowerCase() + '_' + formattedDate;
          if (processedUniqueKeys.has(uniqueKey)) {
            continue;
          }
          processedUniqueKeys.add(uniqueKey);
          newProcessedInRound++;

          if (startLimit && leadDate < startLimit) {
            reachedDateLimit = true;
            statusDiv.innerHTML += '<span style="color:#eab308;">[STOP] Reached leads older than Start Date (' + formattedDate + '). Stopping.</span><br>';
            break;
          }
          if (endLimit && leadDate > endLimit) {
            skippedCount++;
            document.getElementById('stat-skipped').innerText = String(skippedCount);
            continue;
          }

          card.click();
          await new Promise(function(r) { setTimeout(r, 650); });

          var contact = '';
          for (var l = 0; l < lines.length; l++) {
            var digits = lines[l].replace(/[^0-9]/g, '');
            if (digits.length >= 10) {
              var last10 = digits.slice(-10);
              if (last10[0] >= '6' && last10[0] <= '9' && last10 !== sellerMobileDigits) {
                contact = last10;
                break;
              }
            }
          }

          if (!contact) {
            var detailArea = document.querySelector('.lms_right, [class*="right"], [class*="detail"], [class*="header"], [class*="buyerInfo"], [class*="chat"]') || document.body;
            var detailText = detailArea.innerText || '';
            var phoneMatches = detailText.match(/(?:\\+91|91)?[\\s-]*([6-9]\\d{9})\\b/g) || [];
            for (var pm = 0; pm < phoneMatches.length; pm++) {
              var cleanP = phoneMatches[pm].replace(/[^0-9]/g, '').slice(-10);
              if (cleanP !== sellerMobileDigits) {
                contact = cleanP;
                break;
              }
            }
          }

          if (!contact) {
            contact = '0000000000';
          }

          var loc = parseLocation(lines);
          var city = loc.city;
          var state = loc.state;

          var product = 'IndiaMART Enquiry';
          var rightCol = document.querySelector('.lms_right, [class*="right"], [class*="detail"]');
          if (rightCol) {
            var prodLink = rightCol.querySelector('a[href*="proddetail"], a[href*="product"], .m-pname, [class*="pname"], [class*="prod-name"], [class*="productName"]');
            if (prodLink && prodLink.innerText.trim()) {
              product = prodLink.innerText.trim();
            }
          }

          if (product === 'IndiaMART Enquiry' || !product) {
            var candidateLines = lines.filter(function(line) {
              var lStr = line.toLowerCase();
              var isName = lStr.includes(customerName.toLowerCase());
              var isLoc = lStr.includes(city.toLowerCase()) || lStr.includes(state.toLowerCase()) || lStr.includes('india');
              var isTime = /\\b(\\d{1,2}:\\d{2}|am|pm|yesterday|today|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\b/i.test(lStr);
              var isGeneric = /^(hi|hello|dear|good|thank|enquir|interest|viewed|message|reply|contact|requirements|looking|additional|call|missed|duration|gst|outgoing|incoming)\\b/i.test(lStr);
              return !isName && !isLoc && !isTime && !isGeneric && lStr.length > 2;
            });
            if (candidateLines.length > 0) {
              product = candidateLines[0];
            }
          }

          var matched = null;
          if (Array.isArray(catalogProducts) && catalogProducts.length > 0) {
            var cleanFn = function(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9\\s]/g, '').split(/\\s+/).filter(function(w) { return w.length > 2; }); };
            var scrapedTokens = cleanFn(product);
            
            var bestScore = 0;
            for (var cp = 0; cp < catalogProducts.length; cp++) {
              var pItem = catalogProducts[cp];
              var catalogTokens = cleanFn(pItem.name);
              var intersection = scrapedTokens.filter(function(t) { return catalogTokens.includes(t); });
              var unionSet = new Set(scrapedTokens.concat(catalogTokens));
              var jaccard = unionSet.size > 0 ? (intersection.length / unionSet.size) : 0;
              
              var cleanScraped = String(product || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              var cleanCatalog = String(pItem.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              var contain = 0;
              if (cleanScraped && cleanCatalog && (cleanScraped.includes(cleanCatalog) || cleanCatalog.includes(cleanScraped))) {
                contain = 0.6;
              }
              
              var finalScore = Math.max(jaccard, contain);
              if (finalScore >= 0.4 && finalScore > bestScore) {
                bestScore = finalScore;
                matched = pItem;
              }
            }
          }

          var displayProduct = product;
          var productPrice = 0;
          var productGst = '5';
          var productHsn = '';
          var syncStatus = 'New Enquiry';
          
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

          var existing = existingLeads.find(function(l) { return l.contact === contact && l.date === formattedDate; });
          var docId = existing ? existing.id : 'IM' + String(nextIdNum++).padStart(3, '0');

          var leadPayload = { 
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

          var firestoreFields = {};
          var keys = Object.keys(leadPayload);
          for (var kIdx = 0; kIdx < keys.length; kIdx++) {
            var k = keys[kIdx];
            var val = leadPayload[k];
            if (typeof val === 'string') {
              firestoreFields[k] = { stringValue: val };
            } else if (typeof val === 'number') {
              firestoreFields[k] = { doubleValue: val };
            } else if (Array.isArray(val)) {
              firestoreFields[k] = {
                arrayValue: {
                  values: val.map(function(item) {
                    var itemFields = {};
                    var itemKeys = Object.keys(item);
                    for (var ik = 0; ik < itemKeys.length; ik++) {
                      var ikKey = itemKeys[ik];
                      var v = item[ikKey];
                      itemFields[ikKey] = typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) };
                    }
                    return { mapValue: { fields: itemFields } };
                  })
                }
              };
            }
          }

          try {
            var patchUrl = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.projectId) + '/databases/(default)/documents/leads/' + encodeURIComponent(docId) + '?updateMask.fieldPaths=id&updateMask.fieldPaths=date&updateMask.fieldPaths=customerName&updateMask.fieldPaths=contact&updateMask.fieldPaths=product&updateMask.fieldPaths=status&updateMask.fieldPaths=remarks&updateMask.fieldPaths=state&updateMask.fieldPaths=city&updateMask.fieldPaths=source&updateMask.fieldPaths=timestamp&updateMask.fieldPaths=productList&updateMask.fieldPaths=history';
            var patchDocName = 'projects/' + config.projectId + '/databases/(default)/documents/leads/' + docId;
            var response = await fetch(patchUrl, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: patchDocName, fields: firestoreFields })
            });

            if (response.ok) {
              syncedCount++;
              document.getElementById('stat-synced').innerText = String(syncedCount);
              statusDiv.innerHTML += '<span style="color:#10b981;">[SYNCED] ' + customerName + ' (' + contact + ')</span><br>';
            } else {
              errorCount++;
              document.getElementById('stat-failed').innerText = String(errorCount);
              statusDiv.innerHTML += '<span style="color:#f43f5e;">[FAIL] Upload rejected for ' + customerName + '</span><br>';
            }
          } catch (err) {
            errorCount++;
            document.getElementById('stat-failed').innerText = String(errorCount);
            statusDiv.innerHTML += '<span style="color:#f43f5e;">[ERR] Network error: ' + (err.message || 'Unknown') + '</span><br>';
          }

          statusDiv.scrollTop = statusDiv.scrollHeight;
          progBar.style.width = Math.min(100, Math.round((processedUniqueKeys.size / Math.max(1, visibleCards.length)) * 100)) + '%';
        }

        if (reachedDateLimit) break;

        if (newProcessedInRound === 0) {
          noNewCardsRounds++;
          if (noNewCardsRounds >= 4) {
            statusDiv.innerHTML += '<span style="color:#94a3b8;">[DONE] End of list reached.</span><br>';
            break;
          }
        } else {
          noNewCardsRounds = 0;
        }

        if (visibleCards.length > 0) {
          var lastCard = visibleCards[visibleCards.length - 1];
          lastCard.scrollIntoView({ block: 'end', behavior: 'smooth' });
          if (scrollContainer && scrollContainer.scrollHeight) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            scrollContainer.dispatchEvent(new Event('scroll', { bubbles: true }));
          }
        }
        
        await new Promise(function(r) { setTimeout(r, 1200); });
        scrollAttempts++;
      }

      progBar.style.width = '100%';
      statusDiv.innerHTML += '<br><strong style="color:#10b981; font-size:12px;">🎉 Sync Completed!</strong><br><span style="color:#cbd5e1;">Synced: ' + syncedCount + ' | Skipped: ' + skippedCount + ' | Failed: ' + errorCount + '</span>';
      statusDiv.scrollTop = statusDiv.scrollHeight;

      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = '<span>⚡</span> Scan Again';
    };
  })();`;

  const cleanCode = scriptContent.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(cleanCode)}`;
}
