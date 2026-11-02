/* Aba Tabelas exclusiva para contas aprovadas da UBA DOCES. */
(function(){
  const catalogView=document.getElementById('resellerCatalogView');
  const tablesView=document.getElementById('resellerTablesView');
  const content=document.getElementById('resellerTablesContent');
  if(!catalogView||!tablesView||!content)return;

  let view='catalog';
  let requestId=0;
  let ready=false;
  const isApproved=()=>typeof getCustomer==='function'&&Boolean(getCustomer());
  const brlCents=(cents)=>(Number(cents)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const safeText=(value)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

  function syncAccess(){
    const approved=isApproved();
    if(!approved){
      requestId++;
      ready=false;
      content.replaceChildren();
      view='catalog';
    }
    const tablesVisible=approved&&view==='tables';
    catalogView.hidden=tablesVisible;
    tablesView.hidden=!tablesVisible;
    for(const [id,selected] of [['resellerCatalogTab',!tablesVisible],['resellerTablesTab',tablesVisible]]){
      const button=document.getElementById(id);
      if(!button)continue;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-selected',String(selected));
    }
    const badge=document.getElementById('resellerTablesLock');
    if(badge)badge.textContent=approved?'✓':'🔒';
  }

  function matrix(products,tiers){
    const heads=tiers.map(t=>'<th scope="col">'+(t.max===null?t.min+'+':t.min+'–'+t.max)+' un.</th>').join('');
    const rows=products.map(product=>{
      const values=product.resellerCents.map(c=>'<td class="td-price">'+brlCents(c)+'</td>').join('');
      return '<tr class="'+(product.available?'':'table-unavailable')+'">'+
        '<td><strong>'+safeText(product.name)+'</strong>'+(product.available?'':'<span class="table-status">Indisponível no momento</span>')+'</td>'+
        '<td class="td-price">'+brlCents(product.retailCents)+'</td>'+values+'</tr>';
    }).join('');
    return '<div class="reseller-table-scroll"><table class="reseller-price-matrix">'+
      '<thead><tr><th scope="col">Sabor e recheio</th><th scope="col">Varejo</th>'+heads+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>';
  }

  function renderTable(data){
    if(!isApproved()||view!=='tables')return;
    const tiers=Array.isArray(data.tiers)?data.tiers:[];
    const products=Array.isArray(data.products)?data.products:[];
    if(products.length!==10||tiers.length!==4||
       products.some(p=>!Array.isArray(p.resellerCents)||p.resellerCents.length!==4||
         p.resellerCents.some(c=>!Number.isSafeInteger(c)||c<0)||
         !Number.isSafeInteger(p.retailCents))){
      throw new Error('A tabela está indisponível. Não foi possível validar os valores.');
    }
    const available=products.filter(p=>p.available),unavailable=products.filter(p=>!p.available);
    content.innerHTML='<div class="reseller-table-facts">'+
      '<div class="reseller-table-fact"><span>Pedido mínimo</span><strong>'+Number(data.minimumUnits)+' unidades</strong></div>'+
      '<div class="reseller-table-fact"><span>Frete fixo · '+safeText(data.deliveryLocation)+'</span><strong>'+brlCents(data.deliveryFeeCents)+'</strong></div>'+
      '<div class="reseller-table-fact"><span>Sabores</span><strong>'+(data.mixFlavors?'Pode misturar no mesmo pedido':'Consulte as regras do pedido')+'</strong></div></div>'+
      '<h3 class="reseller-table-title">Sabores disponíveis</h3>'+matrix(available,tiers)+
      '<h3 class="reseller-table-title">Sabores indisponíveis no momento <span class="availability-mark">'+unavailable.length+' sabores</span></h3>'+
      matrix(unavailable,tiers)+
      '<p class="reseller-table-note">Preços por unidade em reais. A faixa é definida pela quantidade total do pedido, mesmo misturando sabores. Sabores indisponíveis não podem ser comprados até reposição do estoque. Valores sujeitos a atualização.</p>';
    ready=true;
  }

  async function loadTable(){
    if(!isApproved()||view!=='tables')return;
    const ticket=++requestId;
    ready=false;
    content.innerHTML='<p class="reseller-table-error">Carregando preços de revenda…</p>';
    try{
      const response=await fetch('/api/reseller-tables',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(ticket!==requestId||!isApproved()||view!=='tables')return;
      if(response.status===401){
        content.replaceChildren();
        view='catalog';
        syncAccess();
        openCustomerEntry();
        return;
      }
      if(!response.ok)throw new Error(data.error||'Não foi possível carregar a tabela.');
      renderTable(data);
    }catch(error){
      if(ticket!==requestId||!isApproved()||view!=='tables')return;
      ready=false;
      content.innerHTML='<div class="reseller-table-error">'+safeText(error.message)+
        ' <button type="button" onclick="loadResellerTables()">Tentar novamente</button></div>';
    }
  }

  window.loadResellerTables=loadTable;
  window.selectResellerView=function(destination){
    if(destination==='tables'&&!isApproved()){
      view='catalog';
      syncAccess();
      openCustomerEntry();
      return;
    }
    view=destination==='tables'?'tables':'catalog';
    if(view!=='tables'){requestId++;ready=false;content.replaceChildren();}
    syncAccess();
    if(view==='tables')loadTable();
    document.querySelector('.reseller-view-switch')?.scrollIntoView({behavior:'smooth',block:'start'});
  };
  window.printResellerTables=function(){
    if(!isApproved()||view!=='tables'||!ready){
      window.selectResellerView('tables');
      return;
    }
    window.print();
  };

  // O login/saída e a recuperação da sessão chamam renderAll().
  // A aba sempre é fechada e seus preços são apagados após sair.
  const originalRender=window.renderAll;
  window.renderAll=function(){
    originalRender();
    syncAccess();
  };
  syncAccess();
})();