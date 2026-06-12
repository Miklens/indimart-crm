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
      <div id="sync-status" style="margin-top:12px; font-size:12px; color:#94a3b8; line-height:1.4; max-height:220px; overflow-y:auto; border-radius:6px; background:#0f172a; padding:8px; display:none;">
      </div>
    \`;
    
    document.body.appendChild(panel);
    
    const today = new Date().toISOString().split('T')[0];
    const past7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    document.getElementById('sync-start-date').value = past7;
    document.getElementById('sync-end-date').value = today;
    
    document.getElementById('close-sync-panel').onclick = () => panel.remove();
    
    document.getElementById('debug-dom-btn').onclick = () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = '<b>Deep Inspecting Contact elements...</b><br>';
      
      /* 1. Inspect elements with class .cp and .cpo */
      const cpElements = Array.from(document.querySelectorAll('.cp, .cpo'));
      statusDiv.innerHTML += \`Found \${cpElements.length} elements with class .cp or .cpo.<br>\`;
      
      cpElements.slice(0, 10).forEach((el, idx) => {
        const tagName = el.tagName.toLowerCase();
        const text = (el.innerText || '').replace(/\\s+/g, ' ').trim();
        statusDiv.innerHTML += \`cp[\${idx}]: &lt;\${tagName} class="\${el.className}"&gt; (text: "\${text.substring(0, 50)}")<br>\`;
      });
      
      /* 2. Find the smallest elements containing contact names like "YERR" or "PRAV" */
      const names = ['YERR', 'PRAV', 'Saya'];
      statusDiv.innerHTML += '<br><b>Leaf element search for names:</b><br>';
      names.forEach(name => {
        const matches = Array.from(document.querySelectorAll('*')).filter(el => {
          return el.innerText && el.innerText.includes(name) && el.children.length === 0;
        });
        if (matches.length > 0) {
          statusDiv.innerHTML += \`Matches for "\${name}": \${matches.length}<br>\`;
          matches.forEach((el, i) => {
            let parentInfo = '';
            if (el.parentElement) {
              parentInfo = \`parent: &lt;\${el.parentElement.tagName.toLowerCase()} class="\${el.parentElement.className}"&gt;\`;
              if (el.parentElement.parentElement) {
                parentInfo += \` &gt; grandparent: &lt;\${el.parentElement.parentElement.tagName.toLowerCase()} class="\${el.parentElement.parentElement.className}"&gt;\`;
              }
            }
            statusDiv.innerHTML += \`  [\${i}] &lt;\${el.tagName.toLowerCase()} class="\${el.className}"&gt; text: "\${el.innerText}"<br>   \${parentInfo}<br>\`;
          });
        } else {
          statusDiv.innerHTML += \`No leaf matches for "\${name}". Checking parents...<br>\`;
          const allMatches = Array.from(document.querySelectorAll('*')).filter(el => el.innerText && el.innerText.includes(name));
          statusDiv.innerHTML += \`  All elements containing "\${name}": \${allMatches.length}<br>\`;
        }
      });
    };
    
    document.getElementById('start-sync-btn').onclick = async () => {
      const statusDiv = document.getElementById('sync-status');
      statusDiv.style.display = 'block';
      statusDiv.innerHTML = 'Starting scan...<br>';
      
      /* We will dynamically adjust the scanner once the user sends the inspect results! */
      statusDiv.innerHTML += 'Please run "Inspect Page" first and share the logs so we can configure the target selectors.';
    };
  })();`;

  return `javascript:${encodeURIComponent(scriptContent.replace(/\s+/g, ' '))}`;
}
