/* Estoques do portal Revendedores: Vendedores (consulta) + Revendedores (independente). */
(function(){
  let loadingSharedStock=false;
  async function request(url,options={}){
    const response=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível acessar o estoque do portal.');
    return data
  }
  function productList(){return Array.isArray(catalog)?catalog:[]}
  function resellerQty(id){return Number(sharedStock?.[id]?.reseller||0)}
  function sellerQty(id){return controlesStockView?.available?Number(controlesStockView.products?.[id]||0):null}
  function stockLabel(value){return value===null?'Indisponível':value===0?'Sem saldo':value<15?'Baixo':'Disponível'}
  function stockClass(value){return value===null||value===0||value<15?'stock-ind-low':'stock-ind-ok'}

  function addIndependentStockCss(){
    if(document.getElementById('independent-stock-css'))return;
    const style=document.createElement('style');style.id='independent-stock-css';style.textContent=`
      .stock-independent-switch{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
      .stock-independent-switch button{padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--text);text-align:left;font-weight:1000}
      .stock-independent-switch button.active{border-color:#7139D2;background:linear-gradient(145deg,#1D1230,#251542)}
      .stock-independent-switch span{display:block;margin-top:5px;color:var(--muted);font-size:10px;font-weight:500;line-height:1.4}
      .stock-independent-pane{display:none}.stock-independent-pane.active{display:block}
      .stock-independent-grid{display:grid;gap:8px;margin-top:10px}
      .stock-independent-row{display:grid;grid-template-columns:minmax(150px,1.3fr) .5fr .7fr minmax(290px,1.4fr);gap:9px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#0C0A14}
      .stock-independent-row b{display:block;font-size:11px}.stock-independent-row small{display:block;color:var(--muted);font-size:9px;margin-top:3px}
      .stock-independent-number{font-size:18px;font-weight:1000}
      .stock-ind-badge{justify-self:start;padding:5px 8px;border-radius:999px;font-size:8px;font-weight:1000}.stock-ind-ok{background:#123724;color:#8BE0B4}.stock-ind-low{background:#392A12;color:#FFD98A}
      .stock-independent-actions{display:grid;grid-template-columns:.8fr .7fr 1fr auto;gap:6px}.stock-independent-actions input,.stock-independent-actions select{min-width:0;padding:8px;border:1px solid var(--line);border-radius:9px;background:var(--field);color:var(--text);font-size:10px}.stock-independent-actions button{border:0;border-radius:9px;background:var(--roxo);color:#fff;padding:8px 10px;font-size:9px;font-weight:1000}
      .stock-independent-help{margin-top:10px;padding:11px 12px;border:1px dashed #45365E;border-radius:13px;background:#100C19;color:var(--muted);font-size:10px;line-height:1.5}.stock-independent-help b{color:var(--text)}
      .test-allocation-box{margin-top:12px;padding:14px;border:1px solid #6C3BC3;border-radius:16px;background:linear-gradient(145deg,#181027,#100C19)}
      .test-allocation-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:8px}.test-allocation-head h5{margin:0;color:#fff;font-size:14px}.test-allocation-head p{margin:4px 0 0;color:#AFA8C5;font-size:9px;line-height:1.4}.test-allocation-badge{padding:5px 8px;border-radius:999px;background:#392A12;color:#FFD98A;font-size:8px;font-weight:1000;white-space:nowrap}
      .test-allocation-row{display:grid;grid-template-columns:minmax(160px,1.25fr) repeat(3,.7fr) .55fr;gap:7px;align-items:end;padding:9px 0;border-top:1px solid #2E2942}.test-allocation-row b{font-size:10px}.test-allocation-row small{display:block;color:#8F879D;font-size:8px;margin-top:3px}.test-allocation-row label{display:grid;gap:4px;color:#8F879D;font-size:8px}.test-allocation-row input{width:100%;min-width:0;border:1px solid #39314E;border-radius:9px;background:#09070F;color:#fff;padding:8px;text-align:center}.test-alloc-check{font-size:8px;font-weight:1000}.test-alloc-check.ok{color:#8BE0B4}.test-alloc-check.bad{color:#FFBAC4}.test-alloc-check.warn{color:#FFD98A}
      .test-allocation-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:8px}.test-allocation-summary>div{padding:9px;border:1px solid #342D47;border-radius:11px;background:#0B0911}.test-allocation-summary small{display:block;color:#91899E;font-size:7px;font-weight:900}.test-allocation-summary b{display:block;margin-top:4px;font-size:16px}.test-allocation-save{width:100%;margin-top:9px;border:0;border-radius:11px;background:#5D24C8;color:#fff;padding:10px;font-weight:1000}
      @media(max-width:900px){.stock-independent-row{grid-template-columns:1fr .45fr .6fr}.stock-independent-actions{grid-column:1/-1}.test-allocation-row{grid-template-columns:1fr 1fr 1fr}.test-allocation-row>div:first-child,.test-allocation-row>.test-alloc-check{grid-column:1/-1}}
      @media(max-width:600px){.stock-independent-switch{grid-template-columns:1fr}.stock-independent-row{grid-template-columns:1fr 1fr}.stock-independent-row>div:first-child{grid-column:1/-1}.stock-independent-actions{grid-template-columns:1fr 1fr}.stock-independent-actions button{grid-column:1/-1}.test-allocation-head{display:block}.test-allocation-badge{display:inline-block;margin-top:8px}.test-allocation-row{grid-template-columns:1fr 1fr}.test-allocation-row>div:first-child,.test-allocation-row>.test-alloc-check{grid-column:1/-1}.test-allocation-row>label:last-of-type{grid-column:1/-1}.test-allocation-summary{grid-template-columns:1fr 1fr}}
    `;document.head.appendChild(style)
  }

  function ensureIndependentStockManager(){
    addIndependentStockCss();
    const view=document.getElementById('adminStocksView');if(!view)return null;
    let root=document.getElementById('independentStockManager');
    if(!root){
      root=document.createElement('div');root.id='independentStockManager';
      const table=view.querySelector('.stock-table-wrap');
      if(table)table.before(root);else view.appendChild(root);
      if(table)table.style.display='none';
      const explain=view.querySelector('.stock-explain');if(explain)explain.style.display='none';
    }
    return root
  }

  window.setIndependentStockView=function(mode){
    const root=ensureIndependentStockManager();if(!root)return;
    root.dataset.mode=mode;
    root.querySelectorAll('[data-stock-mode]').forEach(btn=>btn.classList.toggle('active',btn.dataset.stockMode===mode));
    root.querySelectorAll('.stock-independent-pane').forEach(pane=>pane.classList.toggle('active',pane.dataset.stockPane===mode))
  };

  function renderIndependentStockManager(){
    const root=ensureIndependentStockManager();if(!root)return;
    const current=root.dataset.mode||'reseller';
    const sellers=productList().map(p=>{
      const qty=sellerQty(p.id);return `<div class="stock-independent-row"><div><b>${escapeHtml(p.name)}</b><small>UBA Controles · somente leitura</small></div><div class="stock-independent-number">${qty===null?'—':qty}</div><span class="stock-ind-badge ${stockClass(qty)}">${stockLabel(qty)}</span><div><small>Este saldo só é baixado quando você confirma a divisão de um pedido na etapa Produção.</small></div></div>`
    }).join('');
    const resellers=productList().map(p=>{
      const qty=resellerQty(p.id);return `<div class="stock-independent-row"><div><b>${escapeHtml(p.name)}</b><small>Estoque exclusivo Revendedores</small></div><div class="stock-independent-number">${qty}</div><span class="stock-ind-badge ${stockClass(qty)}">${stockLabel(qty)}</span><div class="stock-independent-actions"><select id="stock-op-${p.id}"><option value="entrada">Entrada</option><option value="saida">Saída</option><option value="ajuste">Definir saldo</option></select><input id="stock-qty-${p.id}" type="number" min="0" inputmode="numeric" placeholder="Qtd."><input id="stock-note-${p.id}" placeholder="Observação"><button onclick="adjustResellerStock('${p.id}')">Registrar</button></div></div>`
    }).join('');
    root.innerHTML=`<div class="stock-independent-switch"><button data-stock-mode="sellers" onclick="setIndependentStockView('sellers')"><b>Estoque Vendedores</b><span>Consulta o saldo real do UBA Controles. Não é o estoque próprio deste portal.</span></button><button data-stock-mode="reseller" onclick="setIndependentStockView('reseller')"><b>Estoque Revendedores</b><span>Estoque independente com entradas, saídas e ajustes próprios.</span></button></div><div class="stock-independent-pane" data-stock-pane="sellers"><div class="stock-independent-grid">${sellers}</div><div class="stock-independent-help"><b>Faturamento separado:</b> se um pedido B2B usar alfajores dos Vendedores, apenas a origem física muda. A receita permanece no UBA Revendedores.</div></div><div class="stock-independent-pane" data-stock-pane="reseller"><div class="stock-independent-grid">${resellers}</div><div class="stock-independent-help"><b>Sem compartilhamento de saldo:</b> entradas e ajustes feitos aqui alteram somente o estoque Revendedores.</div></div>`;
    setIndependentStockView(current)
  }

  function applySharedStock(data){
    if(!data||!data.stock)return;
    sharedStock=data.stock;
    if(data.controles)controlesStockView=data.controles;
    const status=document.getElementById('controlesStockStatus');
    if(status)status.textContent=controlesStockView?.available?'Controles • somente leitura':controlesStockView?.reason==='not_configured'?'Vínculo ainda não ativado':'Consulta indisponível';
    stockHistory=Array.isArray(data.history)?data.history:[];
    saveSharedStock();
    if(typeof renderStockPanel==='function')renderStockPanel();
    renderIndependentStockManager();
    updateAdminMetrics()
  }
  async function loadSharedStockRemote(silent=false){
    if(loadingSharedStock)return;
    loadingSharedStock=true;
    try{applySharedStock(await request('/api/shared-stock'))}
    catch(error){
      if(error.message.includes('login')){ceoSession=false;sessionStorage.removeItem('uba-rev-ceo-session');updateCeoBar()}
      else if(!silent)alert(error.message)
    }finally{loadingSharedStock=false}
  }
  async function stockAction(action,payload={}){
    const data=await request('/api/shared-stock',{method:'POST',body:JSON.stringify({action,...payload})});
    applySharedStock(data);return data
  }
  window.loadSharedStockRemote=loadSharedStockRemote;
  window.stockAction=stockAction;

  window.adjustResellerStock=async function(productId){
    const operation=document.getElementById('stock-op-'+productId)?.value||'entrada';
    const quantity=Math.max(0,Math.trunc(Number(document.getElementById('stock-qty-'+productId)?.value||0)));
    const note=document.getElementById('stock-note-'+productId)?.value.trim()||'Movimentação manual pelo CEO';
    if(operation!=='ajuste'&&!quantity){alert('Informe uma quantidade maior que zero.');return}
    try{await stockAction('adjust_reseller_stock',{productId,operation,quantity,note})}catch(error){alert(error.message)}
  };

  window.adminSignIn=async function(){
    const username=document.getElementById('adminUser').value.trim();
    const password=document.getElementById('adminPass').value;
    if(!username||!password){alert('Preencha login e senha.');return}
    try{
      await request('/api/admin-session',{method:'POST',body:JSON.stringify({username,password})});
      sessionStorage.setItem('uba-rev-ceo-session','1');ceoSession=true;
      document.getElementById('adminPass').value='';closeAll();updateCeoBar();openAdmin();await loadSharedStockRemote()
    }catch(error){alert(error.message)}
  };
  window.logoutAdmin=async function(){
    if(!confirm('Sair do painel CEO nesta guia?'))return;
    try{await request('/api/admin-session',{method:'DELETE'})}catch{}
    sessionStorage.removeItem('uba-rev-ceo-session');ceoSession=false;
    document.getElementById('adminShell').classList.remove('show');document.getElementById('loginShell').classList.remove('show');document.body.style.overflow='';renderAll()
  };
  window.reserveSellerStock=async function(){alert('Use a etapa Produção do pedido para escolher quanto retirar de Vendedores, Revendedores ou Fabricar.')};
  window.registerProduction=async function(productId){
    const input=document.getElementById('produce-'+productId);const quantity=Math.max(0,Math.trunc(Number(input?.value||0)));if(!quantity)return;
    try{await stockAction('production',{productId,quantity});if(input)input.value=''}catch(error){alert(error.message)}
  };
  window.clearStockHistory=async function(){if(!confirm('Limpar apenas o histórico do portal? Os saldos não serão alterados.'))return;try{await stockAction('clear_history')}catch(error){alert(error.message)}};
  window.resetSharedStock=function(){alert('A restauração automática foi desativada. Faça ajustes pelo Estoque Revendedores.')};
  window.registerConfirmedOrderInStock=function(){return 0};

  function testProductId(name){
    const normalized=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(normalized.includes('pistache'))return 'pistache';
    if(normalized.includes('50%'))return 'chocolate50';
    if(normalized.includes('branco'))return 'branco';
    if(normalized.includes('caramelo'))return 'caramelo';
    if(normalized.includes('morango'))return 'morango';
    return ''
  }
  function testOrderId(card){
    const button=[...card.querySelectorAll('button[onclick]')].find(btn=>String(btn.getAttribute('onclick')||'').includes('saveOrderNote('));
    const match=String(button?.getAttribute('onclick')||'').match(/saveOrderNote\('([^']+)'\)/);
    return match?.[1]||''
  }
  function testItems(card){
    return [...card.querySelectorAll('.order-items span')].map(span=>{
      const text=String(span.textContent||'').trim();
      const match=text.match(/^(\d+)\s*[×x]\s*(.+)$/i);
      if(!match)return null;
      const productId=testProductId(match[2]);
      return productId?{productId,name:match[2].trim(),quantity:Number(match[1])}:null
    }).filter(Boolean)
  }
  function updateTestAllocationSummary(box){
    let sellers=0,reseller=0,toMake=0,allOk=true;
    box.querySelectorAll('.test-allocation-row').forEach(row=>{
      const need=Number(row.dataset.need||0);
      const s=Math.max(0,Math.trunc(Number(row.querySelector('[data-key="sellers"]')?.value||0)));
      const r=Math.max(0,Math.trunc(Number(row.querySelector('[data-key="reseller"]')?.value||0)));
      const f=Math.max(0,Math.trunc(Number(row.querySelector('[data-key="toMake"]')?.value||0)));
      sellers+=s;reseller+=r;toMake+=f;
      const sum=s+r+f,check=row.querySelector('.test-alloc-check');
      const realSeller=Number(row.dataset.sellerAvailable||0),realReseller=Number(row.dataset.resellerAvailable||0);
      if(sum!==need){check.textContent=sum<need?`Faltam ${need-sum}`:`Excede ${sum-need}`;check.className='test-alloc-check bad';allOk=false}
      else if(s>realSeller||r>realReseller){check.textContent='OK no teste · acima do saldo atual';check.className='test-alloc-check warn'}
      else{check.textContent='OK';check.className='test-alloc-check ok'}
    });
    const set=(key,value)=>{const el=box.querySelector(`[data-summary="${key}"]`);if(el)el.textContent=String(value)};
    set('sellers',sellers);set('reseller',reseller);set('make',toMake);set('total',sellers+reseller+toMake);
    const save=box.querySelector('.test-allocation-save');if(save)save.disabled=!allOk;
    return allOk
  }
  async function loadSavedTestAllocation(id,box){
    try{
      const data=await request('/api/test-order-allocation?id='+encodeURIComponent(id));
      for(const entry of Array.isArray(data.allocation)?data.allocation:[]){
        const row=box.querySelector(`.test-allocation-row[data-product="${entry.productId}"]`);if(!row)continue;
        for(const key of ['sellers','reseller','toMake']){const input=row.querySelector(`[data-key="${key}"]`);if(input)input.value=Number(entry[key]||0)}
      }
      updateTestAllocationSummary(box)
    }catch{}
  }
  function injectTestAllocationPanels(){
    addIndependentStockCss();
    const root=document.getElementById('ordersList');if(!root)return;
    root.querySelectorAll('.order-card').forEach(card=>{
      const code=String(card.querySelector('.order-code')?.textContent||'').trim();
      if(!code.startsWith('TESTE-')||card.querySelector('.test-allocation-box'))return;
      const id=testOrderId(card),items=testItems(card);if(!id||!items.length)return;
      const box=document.createElement('div');box.className='test-allocation-box';box.dataset.orderId=id;
      const rows=items.map(item=>{
        const s=sellerQty(item.productId),r=resellerQty(item.productId);
        const sellerAvailable=s===null?0:s;
        return `<div class="test-allocation-row" data-product="${item.productId}" data-need="${item.quantity}" data-seller-available="${sellerAvailable}" data-reseller-available="${r}"><div><b>${escapeHtml(item.name)}</b><small>Pedido ${item.quantity} · saldo atual Vendedores ${s===null?'indisponível':s} · Revendedores ${r}</small></div><label>Vendedores<input data-key="sellers" type="number" min="0" value="0"></label><label>Revendedores<input data-key="reseller" type="number" min="0" value="0"></label><label>Fabricar<input data-key="toMake" type="number" min="0" value="${item.quantity}"></label><strong class="test-alloc-check ok">OK</strong></div>`
      }).join('');
      const total=items.reduce((sum,item)=>sum+item.quantity,0);
      box.innerHTML=`<div class="test-allocation-head"><div><h5>Origem dos alfajores — simulação</h5><p>Escolha quanto sairia de Vendedores, Revendedores ou Fabricar. Pode usar 1, 2 ou as 3 opções no mesmo pedido.</p></div><span class="test-allocation-badge">TESTE · NÃO BAIXA ESTOQUE</span></div>${rows}<div class="test-allocation-summary"><div><small>Vendedores</small><b data-summary="sellers">0</b></div><div><small>Revendedores</small><b data-summary="reseller">0</b></div><div><small>Fabricar</small><b data-summary="make">${total}</b></div><div><small>Total dividido</small><b data-summary="total">${total}</b></div></div><div class="stock-independent-help"><b>Modo teste:</b> você pode simular qualquer divisão. O sistema mostra o saldo real apenas como referência, mas não desconta nenhuma unidade de Vendedores nem de Revendedores.</div><button class="test-allocation-save" onclick="saveTestOrderAllocation('${id}')">Salvar divisão de teste</button>`;
      card.appendChild(box);
      box.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>updateTestAllocationSummary(box)));
      updateTestAllocationSummary(box);loadSavedTestAllocation(id,box)
    })
  }
  window.saveTestOrderAllocation=async function(id){
    const box=document.querySelector(`.test-allocation-box[data-order-id="${id}"]`);if(!box)return;
    if(!updateTestAllocationSummary(box)){alert('A soma de Vendedores + Revendedores + Fabricar precisa bater exatamente com a quantidade de cada sabor.');return}
    const allocations=[...box.querySelectorAll('.test-allocation-row')].map(row=>({productId:row.dataset.product,sellers:Math.max(0,Math.trunc(Number(row.querySelector('[data-key="sellers"]')?.value||0))),reseller:Math.max(0,Math.trunc(Number(row.querySelector('[data-key="reseller"]')?.value||0))),toMake:Math.max(0,Math.trunc(Number(row.querySelector('[data-key="toMake"]')?.value||0)))}));
    try{await request('/api/test-order-allocation',{method:'PATCH',body:JSON.stringify({id,allocations})});alert('Divisão de teste salva. Nenhum estoque real foi alterado.')}catch(error){alert(error.message)}
  };
  const ordersRoot=document.getElementById('ordersList');
  if(ordersRoot){new MutationObserver(()=>injectTestAllocationPanels()).observe(ordersRoot,{childList:true,subtree:true});injectTestAllocationPanels()}

  const originalOpenAdmin=window.openAdmin;
  window.openAdmin=function(){originalOpenAdmin();if(ceoSession)loadSharedStockRemote(true)};
  if(ceoSession)loadSharedStockRemote(true);
  setInterval(()=>{if(ceoSession&&!document.hidden)loadSharedStockRemote(true)},15000);
})();
