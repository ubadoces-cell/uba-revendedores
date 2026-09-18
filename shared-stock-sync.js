/* Sincronização do estoque UBA entre Revendedores e UBA Controles. */
(function(){
  let loadingSharedStock=false;
  async function request(url,options={}){
    const response=await fetch(url,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível acessar o estoque compartilhado.');
    return data
  }
  function applySharedStock(data){
    if(!data||!data.stock)return;
    sharedStock=data.stock;
    stockHistory=Array.isArray(data.history)?data.history:[];
    saveSharedStock();
    if(typeof renderStockPanel==='function')renderStockPanel()
  }
  async function loadSharedStockRemote(silent=false){
    if(loadingSharedStock)return;
    loadingSharedStock=true;
    try{applySharedStock(await request('/api/shared-stock'))}
    catch(error){
      if(error.message.includes('login')){
        ceoSession=false;sessionStorage.removeItem('uba-rev-ceo-session');updateCeoBar()
      }else if(!silent)alert(error.message)
    }finally{loadingSharedStock=false}
  }
  async function stockAction(action,payload={}){
    const data=await request('/api/shared-stock',{method:'POST',body:JSON.stringify({action,...payload})});
    applySharedStock(data);return data
  }

  window.adminSignIn=async function(){
    const username=document.getElementById('adminUser').value.trim();
    const password=document.getElementById('adminPass').value;
    if(!username||!password){alert('Preencha login e senha.');return}
    try{
      await request('/api/admin-session',{method:'POST',body:JSON.stringify({username,password})});
      sessionStorage.setItem('uba-rev-ceo-session','1');ceoSession=true;
      document.getElementById('adminPass').value='';closeAll();updateCeoBar();openAdmin();
      await loadSharedStockRemote()
    }catch(error){alert(error.message)}
  };
  window.logoutAdmin=async function(){
    if(!confirm('Sair do painel CEO nesta guia?'))return;
    try{await request('/api/admin-session',{method:'DELETE'})}catch{}
    sessionStorage.removeItem('uba-rev-ceo-session');ceoSession=false;
    document.getElementById('adminShell').classList.remove('show');
    document.getElementById('loginShell').classList.remove('show');
    document.body.style.overflow='';renderAll()
  };
  window.reserveSellerStock=async function(productId){
    const input=document.getElementById('reserveSeller-'+productId);
    const quantity=Math.max(0,Math.trunc(Number(input?.value||0)));
    if(!quantity){alert('Informe a quantidade que deseja reservar.');return}
    const item=sharedStock?.[productId]||{};
    const available=Math.max(0,Math.trunc(Number(item.sellers||0)));
    if(quantity>available){alert(`Há apenas ${available} unidades deste sabor no estoque dos vendedores.`);return}
    if(!confirm(`Reservar ${quantity} unidade(s) do estoque dos vendedores para Revendedores?`))return;
    try{
      await stockAction('reserve_seller_stock',{productId,quantity});
      if(input)input.value=''
    }catch(error){alert(error.message)}
  };
  window.registerProduction=async function(productId){
    const input=document.getElementById('produce-'+productId);
    const quantity=Math.max(0,Math.trunc(Number(input?.value||0)));if(!quantity)return;
    try{await stockAction('production',{productId,quantity});if(input)input.value=''}catch(error){alert(error.message)}
  };
  window.clearStockHistory=async function(){
    if(!confirm('Limpar apenas o histórico compartilhado? Os saldos não serão alterados.'))return;
    try{await stockAction('clear_history')}catch(error){alert(error.message)}
  };
  window.resetSharedStock=function(){
    alert('A restauração de saldos foi desativada porque este é o estoque real compartilhado. Faça movimentações pelo painel.')
  };
  // O checkout atual é uma demonstração. Somente um webhook de pagamento real poderá usar order_paid.
  window.registerConfirmedOrderInStock=function(){return 0};
  const originalOpenAdmin=window.openAdmin;
  window.openAdmin=function(){originalOpenAdmin();if(ceoSession)loadSharedStockRemote(true)};
  if(ceoSession)loadSharedStockRemote(true);
  setInterval(()=>{if(ceoSession&&!document.hidden)loadSharedStockRemote(true)},15000);
})();
