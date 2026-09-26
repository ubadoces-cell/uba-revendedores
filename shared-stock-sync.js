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
      @media(max-width:900px){.stock-independent-row{grid-template-columns:1fr .45fr .6fr}.stock-independent-actions{grid-column:1/-1}}
      @media(max-width:600px){.stock-independent-switch{grid-template-columns:1fr}.stock-independent-row{grid-template-columns:1fr 1fr}.stock-independent-row>div:first-child{grid-column:1/-1}.stock-independent-actions{grid-template-columns:1fr 1fr}.stock-independent-actions button{grid-column:1/-1}}
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
  const originalOpenAdmin=window.openAdmin;
  window.openAdmin=function(){originalOpenAdmin();if(ceoSession)loadSharedStockRemote(true)};
  if(ceoSession)loadSharedStockRemote(true);
  setInterval(()=>{if(ceoSession&&!document.hidden)loadSharedStockRemote(true)},15000);
})();
