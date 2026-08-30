/**
 * Generates the bookmarklet code injected with the user's specific Firebase config
 * Enhanced with:
 * - IN-PLACE DATE REWRITE ENGINE: Matches existing CRM leads by phone or buyer name and updates their date/timestamp directly in Firestore without deleting any records or breaking invoices.
 * - Multi-stage scroll & bounce triggers for complete 30-day scans.
 * - Exact date parser (20 Jul -> 2026-07-20).
 * - Safe protection for manual leads and invoice-linked leads.
 */
export function generateBookmarkletCode(firebaseConfig, catalogProducts = [], crmLeads = [], sellerMobile = '') {
  const configStr = JSON.stringify({ ...firebaseConfig, sellerMobile });
  const catalogStr = JSON.stringify(catalogProducts || []);
  
  const mappedLeads = (crmLeads || []).map(l => ({
    id: l.id,
    contact: l.contact || '',
    date: l.date || '',
    customerName: l.customerName || '',
    source: l.source || '',
    status: l.status || '',
    orderValue: l.orderValue || 0,
    remarks: l.remarks || '',
    city: l.city || '',
    state: l.state || '',
    history: l.history || []
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
    if (oldPanel) { oldPanel.remove(); }
    
    var panel = document.createElement('div');
    panel.id = 'indimart-sync-panel';
    panel.style.cssText = 'position:fixed; top:24px; right:24px; width:380px; z-index:9999999; background:rgba(15,23,42,0.96); color:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; border:1px solid #334155; border-radius:14px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05); padding:18px; box-sizing:border-box; backdrop-filter:blur(16px); user-select:none;';
    
    var panelHtml = '<div id="sync-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding-bottom:10px; border-bottom:1px solid #334155; cursor:move;">' +
      '<div style="display:flex; align-items:center; gap:8px;">' +
        '<span style="font-size:18px;">🇮🇳</span>' +
        '<h3 style="margin:0; font-size:15px; color:#10b981; font-weight:700; letter-spacing:-0.01em;">IndiaMART Sync & Date Fixer</h3>' +
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
      '<button id="preset-today" style="flex:1; padding:4px 6px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">Today</button>' +
      '<button id="preset-7d" style="flex:1; padding:4px 6px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">7D</button>' +
      '<button id="preset-30d" style="flex:1; padding:4px 6px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#cbd5e1; font-size:11px; cursor:pointer; font-weight:500;">30D</button>' +
      '<button id="preset-all" style="flex:1; padding:4px 6px; background:#1e293b; border:1px solid #334155; border-radius:6px; color:#10b981; font-size:11px; cursor:pointer; font-weight:700;">All Leads</button>' +
    '</div>' +
    '<div style="display:flex; gap:8px; margin-bottom:12px;">' +
      '<button id="start-sync-btn" style="flex:1; padding:11px; background:linear-gradient(135deg,#10b981,#059669); border:none; border-radius:8px; color:#fff; font-weight:700; cursor:pointer; font-size:13px; box-shadow:0 4px 12px rgba(16,185,129,0.3); display:flex; align-items:center; justify-content:center; gap:6px;">' +
        '<span>⚡</span> Scan & Sync Leads' +
      '</button>' +
    '</div>' +
    '<div id="sync-stats-grid" style="display:none; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:12px; text-align:center;">' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">DISCOVERED</div>' +
        '<div id="stat-found" style="font-size:14px; font-weight:700; color:#38bdf8;">0</div>' +
      '</div>' +
      '<div style="background:#1e293b; padding:8px 4px; border-radius:6px; border:1px solid #334155;">' +
        '<div style="font-size:10px; color:#94a3b8;">UPDATED/NEW</div>' +
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
    var isDragging = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;
    header.onmousedown = function(e) {
      if (e.target.id === 'close-sync-panel') { return; }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      var rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.onmousemove = function(me) {
        if (!isDragging) { return; }
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

    function setStat(id, text) {
      var el = document.getElementById(id);
      if (el) { el.innerText = String(text); }
    }

    function formatLocalDate(d) {
      var yr = d.getFullYear();
      var mo = String(d.getMonth() + 1).padStart(2, '0');
      var dy = String(d.getDate()).padStart(2, '0');
      return yr + '-' + mo + '-' + dy;
    }

    var now = new Date();
    var todayStr = formatLocalDate(now);
    var past7Str = formatLocalDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    var past30Str = formatLocalDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    
    var startInput = document.getElementById('sync-start-date');
    var endInput = document.getElementById('sync-end-date');
    startInput.value = past30Str;
    endInput.value = todayStr;

    document.getElementById('preset-today').onclick = function() { startInput.value = todayStr; endInput.value = todayStr; };
    document.getElementById('preset-7d').onclick = function() { startInput.value = past7Str; endInput.value = todayStr; };
    document.getElementById('preset-30d').onclick = function() { startInput.value = past30Str; endInput.value = todayStr; };
    document.getElementById('preset-all').onclick = function() { startInput.value = ''; endInput.value = todayStr; };
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
        if (els.length > 0) { return els; }
      }

      var allDivsAndLis = Array.from(document.querySelectorAll('div, li'));
      var timeRegex = /\\b(\\d{1,2}:\\d{2}\\s*(?:am|pm)?|yesterday|today|\\d{1,2}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\\b/i;
      
      var matchedCards = [];
      for (var i = 0; i < allDivsAndLis.length; i++) {
        var el = allDivsAndLis[i];
        if (el.id && el.id.includes('indimart-sync')) continue;
        if (el.closest && el.closest('#indimart-sync-panel')) continue;
        var rect = el.getBoundingClientRect();
        if (rect.left < 280 && rect.width >= 140 && rect.width <= 490 && rect.height >= 40 && rect.height <= 260 && rect.top >= 40) {
          var txt = el.innerText || '';
          if (timeRegex.test(txt) && txt.length >= 10 && txt.length <= 600 && !txt.startsWith('July ') && !txt.startsWith('August ')) {
            matchedCards.push(el);
          }
        }
      }

      var distinctCards = [];
      for (var m = 0; m < matchedCards.length; m++) {
        var cardCandidate = matchedCards[m];
        var isChildOfAnother = false;
        for (var d = 0; d < matchedCards.length; d++) {
          if (m !== d && matchedCards[d].contains(cardCandidate)) {
            isChildOfAnother = true;
            break;
          }
        }
        if (!isChildOfAnother && !distinctCards.includes(cardCandidate)) {
          distinctCards.push(cardCandidate);
        }
      }

      return distinctCards;
    }

    function scrollAllLeftToTop() {
      var allLeft = Array.from(document.querySelectorAll('*')).filter(function(el) {
        if (el.id && el.id.includes('indimart-sync')) return false;
        if (el.closest && el.closest('#indimart-sync-panel')) return false;
        var r = el.getBoundingClientRect();
        return r.left < 450 && r.scrollHeight > r.clientHeight && r.clientHeight > 80;
      });
      for (var i = 0; i < allLeft.length; i++) {
        allLeft[i].scrollTop = 0;
        allLeft[i].dispatchEvent(new Event('scroll', { bubbles: true }));
      }
      window.scrollTo(0, 0);
    }

    function triggerSidebarScrollDown(lastCard, pixels) {
      var px = pixels || 600;
      
      if (lastCard && typeof lastCard.scrollIntoView === 'function') {
        lastCard.scrollIntoView({ block: 'start', behavior: 'instant' });
      }

      if (lastCard) {
        var p = lastCard.parentElement;
        while (p && p !== document.body) {
          if (p.scrollHeight > p.clientHeight) {
            p.scrollTop += px;
            p.dispatchEvent(new Event('scroll', { bubbles: true }));
            p.dispatchEvent(new WheelEvent('wheel', { deltaY: px, bubbles: true, clientX: 200, clientY: 400 }));
          }
          p = p.parentElement;
        }
      }

      var allLeft = Array.from(document.querySelectorAll('*')).filter(function(el) {
        if (el.id && el.id.includes('indimart-sync')) return false;
        if (el.closest && el.closest('#indimart-sync-panel')) return false;
        var r = el.getBoundingClientRect();
        return r.left < 450 && r.scrollHeight > r.clientHeight && r.clientHeight > 80;
      });
      for (var i = 0; i < allLeft.length; i++) {
        allLeft[i].scrollTop += px;
        allLeft[i].dispatchEvent(new Event('scroll', { bubbles: true }));
        allLeft[i].dispatchEvent(new WheelEvent('wheel', { deltaY: px, bubbles: true, clientX: 200, clientY: 400 }));
      }

      var sidebarEl = document.elementFromPoint(220, 350);
      if (sidebarEl) {
        sidebarEl.dispatchEvent(new WheelEvent('wheel', { deltaY: px, bubbles: true }));
      }
    }

    function extractCardDate(cardText) {
      var n = new Date();
      if (!cardText) return n;

      var months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

      /* 1. Day Month Year: "20 Jul 2026" */
      var dmyRegex = /\\b(\\d{1,2})\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\s+(\\d{4})\\b/i;
      var dmyMatch = cardText.match(dmyRegex);
      if (dmyMatch) {
        var day = parseInt(dmyMatch[1], 10);
        var mIndex = months.indexOf(dmyMatch[2].toLowerCase().slice(0, 3));
        var year = parseInt(dmyMatch[3], 10);
        if (!isNaN(day) && mIndex !== -1) {
          return new Date(year, mIndex, day, 12, 0, 0);
        }
      }

      /* 2. Day Month: "20 Jul" or "24 Aug" */
      var dmRegex = /\\b(\\d{1,2})\\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\b/i;
      var dmMatch = cardText.match(dmRegex);
      if (dmMatch) {
        var day2 = parseInt(dmMatch[1], 10);
        var mIndex2 = months.indexOf(dmMatch[2].toLowerCase().slice(0, 3));
        var year2 = n.getFullYear();
        if (mIndex2 > n.getMonth()) {
          year2 -= 1;
        }
        if (!isNaN(day2) && mIndex2 !== -1) {
          return new Date(year2, mIndex2, day2, 12, 0, 0);
        }
      }

      /* 3. Yesterday */
      if (/\\byesterday\\b/i.test(cardText)) {
        return new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1, 12, 0, 0);
      }

      /* 4. Today / Time: "6:05 PM" or "11:08 AM" or "today" */
      if (/\\b(?:today|\\d{1,2}:\\d{2}\\s*(?:am|pm)?)\\b/i.test(cardText)) {
        return n;
      }

      return n;
    }

    function parseInputDate(str) {
      if (!str) return null;
      var parts = str.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
      }
      return new Date(str);
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
            if (st) { state = parts[0]; }
            else { city = parts[0]; }
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

    function extractPhoneNumber(card, lines) {
      var headerElements = Array.from(document.querySelectorAll('*')).filter(function(el) {
        if (el.id && el.id.includes('indimart-sync')) return false;
        if (el.closest && el.closest('#indimart-sync-panel')) return false;
        var r = el.getBoundingClientRect();
        return r.left >= 280 && r.top >= 40 && r.top <= 240 && r.width < 700;
      });

      for (var h = 0; h < headerElements.length; h++) {
        var hText = headerElements[h].innerText || '';
        var hMatch = hText.match(/(?:\\+91|91|0)?([6-9]\\d{9})\\b/);
        if (hMatch && hMatch[1] !== sellerMobileDigits) {
          return hMatch[1];
        }
      }

      var telLinks = Array.from(document.querySelectorAll('a[href^="tel:"], [data-mobile], [data-phone]'));
      for (var t = 0; t < telLinks.length; t++) {
        var href = telLinks[t].getAttribute('href') || telLinks[t].getAttribute('data-mobile') || telLinks[t].getAttribute('data-phone') || '';
        var tDigits = href.replace(/[^0-9]/g, '');
        if (tDigits.length >= 10) {
          var last10 = tDigits.slice(-10);
          if (last10[0] >= '6' && last10[0] <= '9' && last10 !== sellerMobileDigits) {
            return last10;
          }
        }
      }

      for (var l = 0; l < lines.length; l++) {
        var cardPhoneMatch = lines[l].match(/(?:\\+91|91|0)?([6-9]\\d{9})\\b/);
        if (cardPhoneMatch && cardPhoneMatch[1] !== sellerMobileDigits) {
          return cardPhoneMatch[1];
        }
      }

      var rightPane = Array.from(document.querySelectorAll('*')).filter(function(el) {
        if (el.id && el.id.includes('indimart-sync')) return false;
        if (el.closest && el.closest('#indimart-sync-panel')) return false;
        var r = el.getBoundingClientRect();
        return r.left >= 320 && r.width >= 300 && r.height > 100;
      });
      for (var rp = 0; rp < rightPane.length; rp++) {
        var rpText = rightPane[rp].innerText || '';
        var rpMatches = rpText.match(/(?:\\+91|91|0)?([6-9]\\d{9})\\b/g);
        if (rpMatches) {
          for (var m = 0; m < rpMatches.length; m++) {
            var rawM = rpMatches[m].replace(/[^0-9]/g, '').slice(-10);
            if (rawM[0] >= '6' && rawM[0] <= '9' && rawM !== sellerMobileDigits) {
              return rawM;
            }
          }
        }
      }

      return '0000000000';
    }

    document.getElementById('start-sync-btn').onclick = async function() {
      var btn = document.getElementById('start-sync-btn');
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = '<span>⏳</span> Rewriting Dates & Syncing...';

      var statusDiv = document.getElementById('sync-status');
      var statsGrid = document.getElementById('sync-stats-grid');
      var progBarContainer = document.getElementById('sync-progress-bar-container');
      var progBar = document.getElementById('sync-progress-bar');
      
      if (statusDiv) { statusDiv.style.display = 'block'; statusDiv.innerHTML = '<span style="color:#38bdf8;">[INIT] Starting In-Place Date Correction Engine...</span><br>'; }
      if (statsGrid) { statsGrid.style.display = 'grid'; }
      if (progBarContainer) { progBarContainer.style.display = 'block'; }

      var startDateVal = document.getElementById('sync-start-date') ? document.getElementById('sync-start-date').value : '';
      var endDateVal = document.getElementById('sync-end-date') ? document.getElementById('sync-end-date').value : '';
      var startLimit = startDateVal ? parseInputDate(startDateVal) : null;
      if (startLimit) { startLimit.setHours(0, 0, 0, 0); }
      var endLimit = endDateVal ? parseInputDate(endDateVal) : null;
      if (endLimit) { endLimit.setHours(23, 59, 59, 999); }

      if (statusDiv) { statusDiv.innerHTML += '<span style="color:#94a3b8;">[SCROLL] Resetting to top of message list...</span><br>'; }
      scrollAllLeftToTop();
      await new Promise(function(r) { setTimeout(r, 800); });

      var foundCards = findContactCards();
      
      if (foundCards.length === 0) {
        if (statusDiv) { statusDiv.innerHTML += '<span style="color:#ef4444;">⚠️ Waiting for contact list...</span><br>'; }
        await new Promise(function(r) { setTimeout(r, 2000); });
        foundCards = findContactCards();
      }

      if (foundCards.length === 0) {
        if (statusDiv) { statusDiv.innerHTML += '<span style="color:#ef4444; font-weight:700;">❌ No contact cards found. Please ensure you are on IndiaMART Message Centre.</span><br>'; }
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.innerHTML = '<span>⚡</span> Retry Scan';
        return;
      }

      var syncedCount = 0;
      var skippedCount = 0;
      var errorCount = 0;
      var processedUniqueKeys = new Set();
      
      var scrollAttempts = 0;
      var noNewCardsRounds = 0;
      var consecutiveOlderCount = 0;
      var reachedDateLimit = false;

      while (scrollAttempts < 500 && !reachedDateLimit) {
        var visibleCards = findContactCards();
        var newProcessedInRound = 0;

        for (var i = 0; i < visibleCards.length; i++) {
          var card = visibleCards[i];
          var cardText = card.innerText || '';
          var lines = cardText.split('\\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

          /* 1. Extract Buyer Name */
          var customerName = 'Unknown Buyer';
          var buyerEl = card.querySelector('.fs14.fwb, [class*="buyerName"], [class*="buyer_name"], [class*="contactName"], [class*="sender"]');
          if (buyerEl && buyerEl.innerText.trim()) {
            customerName = buyerEl.innerText.trim();
          } else if (lines.length > 0) {
            var firstLine = lines[0];
            customerName = firstLine.replace(/\\b(\\d{1,2}:\\d{2}\\s*(?:am|pm)?|yesterday|today|\\d{1,2}\\s+[a-z]{3})\\b/i, '').trim();
            if (!customerName && lines.length > 1) {
              customerName = lines[1];
            }
          }

          if (customerName.toLowerCase().startsWith('contact added')) {
            var altName = lines.find(function(l) {
              var low = l.toLowerCase();
              return !low.startsWith('contact added') && !low.includes('enquiry received') && !low.includes('india') && !low.includes('pari') && !low.includes('trichoderma') && !/\\d{10}/.test(l) && l.length > 2;
            });
            if (altName) { customerName = altName; }
            else { customerName = 'IndiaMART Buyer'; }
          }

          if (/^(january|february|march|april|may|june|july|august|september|october|november|december)\\s+\\d{1,2}/i.test(customerName) ||
              /^\\d{1,2}\\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(customerName)) {
            continue;
          }

          /* 2. Accurate Card Date Extraction */
          var leadDate = extractCardDate(cardText);
          var formattedDate = formatLocalDate(leadDate);

          var uniqueKey = customerName.toLowerCase() + '_' + formattedDate;
          if (processedUniqueKeys.has(uniqueKey)) {
            continue;
          }
          processedUniqueKeys.add(uniqueKey);
          newProcessedInRound++;

          setStat('stat-found', processedUniqueKeys.size);

          if (startLimit && leadDate < startLimit) {
            consecutiveOlderCount++;
            skippedCount++;
            setStat('stat-skipped', skippedCount);
            if (consecutiveOlderCount >= 20) {
              reachedDateLimit = true;
              if (statusDiv) { statusDiv.innerHTML += '<span style="color:#eab308;">[STOP] Reached 30-Day limit (' + formattedDate + ' is older than ' + startDateVal + ').</span><br>'; }
              break;
            }
            continue;
          } else {
            consecutiveOlderCount = 0;
          }

          if (endLimit && leadDate > endLimit) {
            skippedCount++;
            setStat('stat-skipped', skippedCount);
            continue;
          }

          /* Click card to open conversation details */
          card.click();
          card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          var innerEl = card.querySelector('div, p, span, h4, h5');
          if (innerEl) {
            innerEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          }
          await new Promise(function(r) { setTimeout(r, 650); });

          /* 3. Phone Number Extraction */
          var contact = extractPhoneNumber(card, lines);

          var loc = parseLocation(lines);
          var city = loc.city;
          var state = loc.state;

          /* 4. Product Extraction */
          var product = 'IndiaMART Enquiry';
          
          var candidateLines = lines.filter(function(line) {
            var lStr = line.toLowerCase();
            var isName = lStr.includes(customerName.toLowerCase());
            var isLoc = lStr.includes(city.toLowerCase()) || lStr.includes(state.toLowerCase()) || lStr.includes('india');
            var isTime = /\\b(\\d{1,2}:\\d{2}|am|pm|yesterday|today|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\b/i.test(lStr);
            var isGeneric = /^(hi|hello|dear|good|thank|enquir|interest|viewed|message|reply|contact|requirements|looking|additional|call|missed|duration|gst|outgoing|incoming)\\b/i.test(lStr);
            return !isName && !isLoc && !isTime && !isGeneric && lStr.length > 2;
          });
          if (candidateLines.length > 0) {
            product = candidateLines[candidateLines.length - 1];
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

          /* Match existing lead: by phone number first, or if phone is 0000000000 by buyer name */
          var existing = existingLeads.find(function(l) { 
            if (contact && contact !== '0000000000' && l.contact === contact) return true;
            if (l.customerName && customerName && l.customerName.toLowerCase() === customerName.toLowerCase()) return true;
            return false;
          });
          var docId = existing ? existing.id : 'IM' + String(nextIdNum++).padStart(3, '0');

          /* IN-PLACE REWRITE: If lead already exists, preserve all user edits and invoices, but rewrite DATE and TIMESTAMP! */
          var leadPayload = { 
            id: docId, 
            date: formattedDate, 
            customerName: existing ? existing.customerName : customerName, 
            contact: (contact && contact !== '0000000000') ? contact : (existing ? existing.contact : contact), 
            product: displayProduct, 
            status: (existing && existing.status) ? existing.status : syncStatus, 
            followUpDate: existing ? (existing.followUpDate || '') : '', 
            orderValue: (existing && existing.orderValue > 0) ? existing.orderValue : productPrice, 
            remarks: existing ? (existing.remarks || '') : '', 
            state: state || (existing ? existing.state : '') || '', 
            city: city || (existing ? existing.city : '') || '', 
            source: existing ? (existing.source || 'IndiaMART Direct') : 'IndiaMART Direct', 
            timestamp: leadDate.getTime(), 
            productList: [{ name: displayProduct, qty: 1, price: productPrice, gst: productGst, hsn: productHsn }], 
            history: (existing && existing.history && existing.history.length) ? existing.history : [{ status: syncStatus, timestamp: Date.now() }] 
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
              setStat('stat-synced', syncedCount);
              var actionTag = existing ? '[DATE REWRITTEN]' : '[NEW LEAD]';
              if (statusDiv) { statusDiv.innerHTML += '<span style="color:#10b981;">' + actionTag + ' ' + customerName + ' (' + docId + ') ➔ ' + formattedDate + '</span><br>'; }
            } else {
              errorCount++;
              setStat('stat-failed', errorCount);
              if (statusDiv) { statusDiv.innerHTML += '<span style="color:#f43f5e;">[FAIL] Update rejected for ' + customerName + '</span><br>'; }
            }
          } catch (err) {
            errorCount++;
            setStat('stat-failed', errorCount);
            if (statusDiv) { statusDiv.innerHTML += '<span style="color:#f43f5e;">[ERR] Network error: ' + (err.message || 'Unknown') + '</span><br>'; }
          }

          if (statusDiv) { statusDiv.scrollTop = statusDiv.scrollHeight; }
          if (progBar) { progBar.style.width = Math.min(100, Math.round((processedUniqueKeys.size / Math.max(1, visibleCards.length)) * 100)) + '%'; }
        }

        if (reachedDateLimit) { break; }

        if (newProcessedInRound === 0) {
          noNewCardsRounds++;
          if (noNewCardsRounds >= 25) {
            if (statusDiv) { statusDiv.innerHTML += '<span style="color:#94a3b8;">[DONE] End of list reached.</span><br>'; }
            break;
          }
        } else {
          noNewCardsRounds = 0;
        }

        var lastCardToScroll = visibleCards.length > 0 ? visibleCards[visibleCards.length - 1] : null;
        var scrollJump = (noNewCardsRounds > 3) ? (650 + noNewCardsRounds * 50) : 550;
        triggerSidebarScrollDown(lastCardToScroll, scrollJump);
        
        await new Promise(function(r) { setTimeout(r, 1100); });
        scrollAttempts++;
      }

      if (progBar) { progBar.style.width = '100%'; }
      if (statusDiv) {
        statusDiv.innerHTML += '<br><strong style="color:#10b981; font-size:12px;">🎉 Dates Rewritten & Sync Completed!</strong><br><span style="color:#cbd5e1;">Total Scanned: ' + processedUniqueKeys.size + ' | Updated/Synced: ' + syncedCount + ' | Skipped: ' + skippedCount + ' | Failed: ' + errorCount + '</span>';
        statusDiv.scrollTop = statusDiv.scrollHeight;
      }

      btn.disabled = false;
      btn.style.opacity = '1';
      btn.innerHTML = '<span>⚡</span> Scan Again';
    };
  })();`;

  const cleanCode = scriptContent.replace(/\s+/g, ' ').trim();
  return `javascript:${encodeURIComponent(cleanCode)}`;
}
