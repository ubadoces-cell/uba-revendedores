/* Pedidos de revendedores — Pix Asaas, etapas, observações, origem física e faturamento. */
(function(){
  let orders=[];
  let ordersLoading=false;
  let paymentPoll=null;
  const STATUS_SEQUENCE=['novo','confirmado','em_producao','separacao','enviado','concluido'];

  async function ordersRequest(options={}){
    const scope=document.getElementById('showTestOrders')?.checked?'?scope=test':'';
    const response=await fetch('/api/orders'+scope,{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível processar o pedido.');
    return data
  }
  async function statusRequest(code,token){
    const response=await fetch('/api/order-status?code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token),{credentials:'same-origin'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível consultar o pagamento.');
    return data
  }
  function orderMoney(cents){return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
  function orderStatus(status){return ({novo:'Recebido',confirmado:'Pago / confirmado',em_producao:'Em produção',separacao:'Separação',pronto:'Pronto',enviado:'Enviado',retirada:'Disponível para retirada',concluido:'Entregue / concluído',cancelado:'Cancelado'})[status]||status}
  function paymentStatus(status){return ({teste_sem_cobranca:'TESTE — sem cobrança e sem baixa de estoque',aguardando_pagamento:'Aguardando Pix',confirmado_asaas:'Pix confirmado pelo Asaas',pago:'Pago',vencido:'Pix vencido',cancelado:'Cancelado',estornado:'Estornado',estorno_em_andamento:'Estorno em andamento',contestacao:'Em contestação',erro_pagamento:'Erro no pagamento'})[status]||status||'Aguardando Pix'}
  function orderPurpose(){return 'Revendedor / comércio'}
  function updateOrderCount(){
    if(document.getElementById('showTestOrders')?.checked)return;
    const count=orders.filter(order=>order.status==='novo'&&!order.isTest).length;
    const metric=document.getElementById('mOrders');if(metric)metric.textContent=String(count);
    const quick=document.getElementById('ordersQuickCount');if(quick)quick.textContent=count?String(count):''
  }
  function sellerAvailable(productId){return controlesStockView?.available?Number(controlesStockView.products?.[productId]||0):0}
  function resellerAvailable(productId){return Number(sharedStock?.[productId]?.reseller||0)}
  function currentAllocation(order,item){
    const existing=(Array.isArray(order.productionAllocation)?order.productionAllocation:[]).find(entry=>entry.productId===item.productId);
    if(existing)return {sellers:Number(existing.sellers||0),reseller:Number(existing.reseller||0),toMake:Number(existing.toMake||0)};
    const qty=Number(item.quantity||0),reseller=Math.min(qty,resellerAvailable(item.productId));
    return {sellers:0,reseller,toMake:Math.max(0,qty-reseller)}
  }
  function allocationPanel(order){
    const items=Array.isArray(order.items)?order.items:[];
    if(order.isTest)return '<div class="orders-help">Pedido de teste: não movimenta estoque.</div>';
    if(order.stockApplied){
      const rows=(order.productionAllocation||[]).map(a=>`<div class="order-allocation-readonly"><b>${escapeHtml((items.find(i=>i.productId===a.productId)?.name)||a.productId)}</b><span>Vendedores ${Number(a.sellers||0)} · Revendedores ${Number(a.reseller||0)} · Fabricar ${Number(a.toMake||0)}</span></div>`).join('');
      return `<div class="order-production-box"><h5>Origem confirmada</h5>${rows||'<div class="muted">Origem já aplicada.</div>'}</div>`
    }
    const rows=items.map(item=>{
      const a=currentAllocation(order,item),need=Number(item.quantity||0);
      return `<div class="order-allocation-row" data-order="${order.id}" data-product="${item.productId}" data-need="${need}"><div><b>${escapeHtml(item.name||item.productId)}</b><small>Pedido ${need} · disp. Vendedores ${sellerAvailable(item.productId)} · Revendedores ${resellerAvailable(item.productId)}</small></div><label>Vendedores<input class="alloc-input" data-key="sellers" type="number" min="0" max="${sellerAvailable(item.productId)}" value="${a.sellers}"></label><label>Revendedores<input class="alloc-input" data-key="reseller" type="number" min="0" max="${resellerAvailable(item.productId)}" value="${a.reseller}"></label><label>Fabricar<input class="alloc-input" data-key="toMake" type="number" min="0" value="${a.toMake}"></label><strong class="alloc-check"></strong></div>`
    }).join('');
    return `<div class="order-production-box"><div class="order-production-head"><div><h5>Origem dos alfajores</h5><p>Escolha 1, 2 ou 3 origens e a quantidade de cada sabor.</p></div><span>Faturamento continua no Revendedores</span></div>${rows}<button class="order-production-confirm" onclick="confirmOrderAllocation('${order.id}')">Confirmar divisão e entrar em Produção</button></div>`
  }
  function statusSteps(order){
    return `<div class="order-step-buttons">${STATUS_SEQUENCE.map((status,index)=>{
      const current=STATUS_SEQUENCE.indexOf(order.status),done=current>index,active=order.status===status;
      return `<button class="${done?'done ':''}${active?'active':''}" onclick="selectOrderStage('${order.id}','${status}')">${orderStatus(status)}</button>`
    }).join('')}</div>`
  }
  function ensureOrdersCss(){
    if(document.getElementById('orders-v2-css'))return;
    const style=document.createElement('style');style.id='orders-v2-css';style.textContent=`
      .order-step-buttons{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:13px}.order-step-buttons button{border:1px solid #39314E;border-radius:10px;background:#0C0A14;color:#AFA8C5;padding:9px 5px;font-size:8px;font-weight:1000}.order-step-buttons button.done{background:#123724;color:#8BE0B4;border-color:#275F45}.order-step-buttons button.active{background:#2D135B;color:#fff;border-color:#7A3ED8}
      .order-note-editor{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:12px}.order-note-editor label{display:grid;gap:5px;color:#AFA8C5;font-size:10px;font-weight:800}.order-note-editor textarea{min-height:68px;border:1px solid #39314E;border-radius:11px;background:#0C0A14;color:#fff;padding:10px;resize:vertical}.order-note-editor button{border:0;border-radius:11px;background:#5D24C8;color:#fff;padding:11px 13px;font-weight:1000}
      .order-customer-preview{margin-top:8px;padding:9px 11px;border:1px solid #27425F;border-radius:11px;background:#0B1621;color:#B9D6ED;font-size:9px}.order-customer-preview b{color:#fff}
      .order-production-box{margin-top:12px;padding:13px;border:1px solid #4A3371;border-radius:15px;background:#120D1D}.order-production-box h5{margin:0;font-size:13px}.order-production-head{display:flex;justify-content:space-between;gap:10px}.order-production-head p{margin:3px 0 0;color:#AFA8C5;font-size:9px}.order-production-head>span{color:#D6B8FF;font-size:8px;font-weight:1000}
      .order-allocation-row{display:grid;grid-template-columns:minmax(150px,1.2fr) repeat(3,.7fr) .45fr;gap:7px;align-items:end;padding:9px 0;border-top:1px solid #2E2942}.order-allocation-row:first-of-type{margin-top:8px}.order-allocation-row b{font-size:10px}.order-allocation-row small{display:block;color:#8F879D;font-size:8px;margin-top:3px}.order-allocation-row label{display:grid;gap:4px;color:#8F879D;font-size:8px}.order-allocation-row input{width:100%;min-width:0;border:1px solid #39314E;border-radius:9px;background:#09070F;color:#fff;padding:8px;text-align:center}.alloc-check{font-size:8px}.alloc-check.ok{color:#8BE0B4}.alloc-check.bad{color:#FFBAC4}.order-production-confirm{width:100%;margin-top:9px;border:0;border-radius:11px;background:#173F2B;color:#AAF0CB;padding:10px;font-weight:1000}
      .order-allocation-readonly{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #2E2942;font-size:9px}.order-allocation-readonly span{color:#AFA8C5}
      .revenue-panel{margin-top:10px}.revenue-card{display:grid;grid-template-columns:1.2fr .7fr .8fr .8fr;gap:10px;align-items:center;padding:12px;border:1px solid #2E2942;border-radius:14px;background:#0C0A14;margin-top:7px}.revenue-card small{display:block;color:#AFA8C5;font-size:8px}.revenue-channel{padding:5px 8px;border-radius:999px;background:#2D135B;color:#D2AEFF;font-size:8px;font-weight:1000}.revenue-total-box{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px}.revenue-total-box>div{padding:13px;border:1px solid #2E2942;border-radius:14px;background:#12101D}.revenue-total-box small{color:#AFA8C5;font-size:8px}.revenue-total-box b{display:block;font-size:20px;margin-top:5px}
      @media(max-width:800px){.order-step-buttons{grid-template-columns:repeat(3,1fr)}.order-allocation-row{grid-template-columns:1fr 1fr 1fr}.order-allocation-row>div:first-child,.order-allocation-row>.alloc-check{grid-column:1/-1}.revenue-card{grid-template-columns:1fr 1fr}.revenue-total-box{grid-template-columns:1fr}}
      @media(max-width:600px){.order-note-editor{grid-template-columns:1fr}.order-step-buttons{grid-template-columns:1fr 1fr}.order-allocation-row{grid-template-columns:1fr 1fr}.order-allocation-row>label:last-of-type{grid-column:1/-1}}
    `;document.head.appendChild(style)
  }

  window.renderOrdersPanel=function(){
    ensureOrdersCss();
    const root=document.getElementById('ordersList');if(!root)return;
    updateOrderCount();
    if(ordersLoading){root.innerHTML='<div class="orders-empty">Carregando pedidos...</div>';return}
    if(!orders.length){root.innerHTML='<div class="orders-empty">Nenhum pedido recebido ainda.</div>';return}
    root.innerHTML=orders.map(order=>{
      const customer=order.customer||{},delivery=order.delivery||{},items=Array.isArray(order.items)?order.items:[];
      const address=[delivery.street,delivery.number,delivery.complement,delivery.city,delivery.cep].filter(Boolean).join(' • ')||'Entrega ainda não informada';
      const contact=[customer.phone,customer.email].filter(Boolean).join(' • ')||'Sem contato';
      const when=new Date(order.createdAt).toLocaleString('pt-BR');
      const productionVisible=order.status==='em_producao'||(!order.stockApplied&&['confirmado','em_producao'].includes(order.status));
      return `<article class="order-card"><div class="order-card-head"><div><span class="order-code">${escapeHtml(order.code)}</span><h4>${escapeHtml(customer.name||'Cliente')}</h4><small>${escapeHtml(when)} • ${escapeHtml(orderPurpose(order.purpose))}</small></div><div class="order-total"><strong>${order.isTest?'Simulado: ':''}${orderMoney(order.totalCents)}</strong><span>${Number(order.units||0)} unidades · receita UBA Revendedores</span></div></div><div class="order-meta"><b>${escapeHtml(customer.store||'Sem nome de loja')}</b><span>${escapeHtml(contact)}</span><span>${escapeHtml(customer.doc||'Documento não informado')}</span></div><div class="order-items">${items.map(item=>`<span><b>${Number(item.quantity||0)}×</b> ${escapeHtml(item.name||item.productId)}</span>`).join('')}</div><div class="order-address"><b>Entrega:</b> ${escapeHtml(address)}</div><div class="order-payment ${order.paymentStatus==='pago'?'paid':'waiting'}"><b>Pagamento:</b> ${escapeHtml(paymentStatus(order.paymentStatus))}</div>${statusSteps(order)}<div class="order-note-editor"><label>Observação visível ao cliente<textarea id="order-note-${order.id}" placeholder="Ex.: Seu pedido está sendo separado.">${escapeHtml(order.customerNote||'')}</textarea></label><button onclick="saveOrderNote('${order.id}')">Salvar observação</button></div><div class="order-customer-preview"><b>Cliente verá:</b> ${escapeHtml(orderStatus(order.status))}${order.customerNote?' · '+escapeHtml(order.customerNote):''}</div>${productionVisible?allocationPanel(order):''}</article>`
    }).join('');
    document.querySelectorAll('.order-allocation-row').forEach(row=>row.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>validateAllocationRow(row))));
    document.querySelectorAll('.order-allocation-row').forEach(validateAllocationRow)
  };
  function validateAllocationRow(row){
    const need=Number(row.dataset.need||0),values=[...row.querySelectorAll('input')].reduce((a,input)=>{a[input.dataset.key]=Math.max(0,Math.trunc(Number(input.value||0)));return a},{sellers:0,reseller:0,toMake:0});
    const sum=values.sellers+values.reseller+values.toMake,product=row.dataset.product,check=row.querySelector('.alloc-check');
    const availableSeller=sellerAvailable(product),availableReseller=resellerAvailable(product);
    let text='OK',ok=true;if(values.sellers>availableSeller||values.reseller>availableReseller){text='Sem saldo';ok=false}else if(sum<need){text='Faltam '+(need-sum);ok=false}else if(sum>need){text='Excede '+(sum-need);ok=false}
    check.textContent=text;check.className='alloc-check '+(ok?'ok':'bad');return ok
  }
  window.selectOrderStage=async function(id,status){
    const order=orders.find(o=>o.id===id);if(!order)return;
    if(status==='em_producao'&&!order.stockApplied){order.status='em_producao';renderOrdersPanel();return}
    try{
      const note=document.getElementById('order-note-'+id)?.value||order.customerNote||'';
      const data=await ordersRequest({method:'PATCH',body:JSON.stringify({id,status,customerNote:note})});
      const index=orders.findIndex(o=>o.id===id);if(index>=0)orders[index]=data.order;renderOrdersPanel();renderRevenuePanel()
    }catch(error){alert(error.message);loadOrdersRemote(true)}
  };
  window.saveOrderNote=async function(id){
    const order=orders.find(o=>o.id===id);if(!order)return;
    try{const note=document.getElementById('order-note-'+id)?.value||'';const data=await ordersRequest({method:'PATCH',body:JSON.stringify({id,status:order.status,customerNote:note})});const index=orders.findIndex(o=>o.id===id);if(index>=0)orders[index]=data.order;renderOrdersPanel()}catch(error){alert(error.message)}
  };
  window.confirmOrderAllocation=async function(id){
    const order=orders.find(o=>o.id===id);if(!order)return;
    const rows=[...document.querySelectorAll(`.order-allocation-row[data-order="${id}"]`)];if(!rows.length)return;
    if(!rows.every(validateAllocationRow)){alert('A soma de cada sabor precisa bater exatamente com a quantidade do pedido e respeitar os saldos disponíveis.');return}
    const allocations=rows.map(row=>({productId:row.dataset.product,...[...row.querySelectorAll('input')].reduce((a,input)=>{a[input.dataset.key]=Math.max(0,Math.trunc(Number(input.value||0)));return a},{})}));
    try{
      if(typeof window.stockAction!=='function')throw new Error('O módulo de estoque ainda não carregou. Atualize a página e tente novamente.');
      await window.stockAction('allocate_order',{orderId:id,allocations});
      const note=document.getElementById('order-note-'+id)?.value||'Pedido em produção.';
      await ordersRequest({method:'PATCH',body:JSON.stringify({id,status:'em_producao',customerNote:note})});
      await loadOrdersRemote(true);if(typeof window.loadSharedStockRemote==='function')await window.loadSharedStockRemote(true);alert('Origem confirmada. O pedido entrou em Produção e os estoques escolhidos foram movimentados.')
    }catch(error){alert(error.message);await loadOrdersRemote(true)}
  };

  window.loadOrdersRemote=async function(silent=false){
    if(ordersLoading)return;ordersLoading=true;renderOrdersPanel();
    try{const data=await ordersRequest();orders=Array.isArray(data.orders)?data.orders:[]}catch(error){if(!silent)alert(error.message)}finally{ordersLoading=false;renderOrdersPanel();renderRevenuePanel()}
  };
  window.updateOrderStatus=window.selectOrderStage;

  function ensureRevenueView(){
    ensureOrdersCss();
    const shell=document.getElementById('adminShell');if(!shell||document.getElementById('adminRevenueView'))return;
    const wrap=shell.querySelector('.admin-wrap');if(!wrap)return;
    const section=document.createElement('section');section.className='admin-view';section.id='adminRevenueView';section.hidden=true;section.innerHTML=`<div class="admin-page-head"><button class="admin-back" onclick="setAdminView('dashboard')">← Início</button><div class="admin-page-title"><h3>Faturamento B2B</h3><p>A receita segue o canal de venda, não a origem física dos alfajores.</p></div><button class="admin-back" onclick="loadOrdersRemote()">↻ Atualizar</button></div><div class="revenue-panel" id="revenuePanel"></div>`;wrap.appendChild(section);
    const quick=shell.querySelector('.admin-quick');if(quick&&!document.getElementById('revenueQuickButton')){const btn=document.createElement('button');btn.id='revenueQuickButton';btn.innerHTML='💰 Faturamento B2B';btn.onclick=()=>setAdminView('revenue');quick.appendChild(btn)}
  }
  function sourceLabel(order){
    const alloc=Array.isArray(order.productionAllocation)?order.productionAllocation:[];if(!alloc.length)return order.stockApplied?'Origem aplicada':'A definir';
    const sums=alloc.reduce((a,x)=>{a.s+=Number(x.sellers||0);a.r+=Number(x.reseller||0);a.f+=Number(x.toMake||0);return a},{s:0,r:0,f:0});
    return `${sums.s} Vend. · ${sums.r} Rev. · ${sums.f} fabricar`
  }
  window.renderRevenuePanel=function(){
    ensureRevenueView();const root=document.getElementById('revenuePanel');if(!root)return;
    const paid=orders.filter(o=>!o.isTest&&['pago','confirmado_asaas'].includes(o.paymentStatus)&&o.status!=='cancelado');
    const total=paid.reduce((sum,o)=>sum+Number(o.totalCents||0),0),units=paid.reduce((sum,o)=>sum+Number(o.units||0),0);
    root.innerHTML=`<div class="revenue-total-box"><div><small>Faturamento UBA Revendedores</small><b>${orderMoney(total)}</b></div><div><small>Pedidos pagos</small><b>${paid.length}</b></div><div><small>Alfajores vendidos B2B</small><b>${units}</b></div></div><div class="orders-help"><b>Regra:</b> tirar alfajores do estoque Vendedores não manda lucro para Vendedores. O estoque registra apenas a origem física; a venda e o faturamento permanecem no web app Revendedores.</div>${paid.length?paid.map(o=>`<div class="revenue-card"><div><b>${escapeHtml(o.code)}</b><small>${escapeHtml(o.customer?.store||o.customer?.name||'Cliente')}</small></div><span class="revenue-channel">UBA REVENDEDORES</span><div><b>${escapeHtml(sourceLabel(o))}</b><small>Origem física</small></div><div style="text-align:right"><b>${orderMoney(o.totalCents)}</b><small>${Number(o.units||0)} unidades</small></div></div>`).join(''):'<div class="orders-empty">Nenhum pedido pago para faturar.</div>'}`
  };
  ensureRevenueView();
  const previousSetAdminView=window.setAdminView;
  window.setAdminView=function(view){
    ensureRevenueView();
    if(view==='revenue'){
      adminView='revenue';['adminDashboardView','adminProductsView','adminStocksView','adminOrdersView'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true});const rev=document.getElementById('adminRevenueView');if(rev)rev.hidden=false;renderRevenuePanel();document.getElementById('adminShell')?.scrollTo({top:0,behavior:'smooth'});return
    }
    const rev=document.getElementById('adminRevenueView');if(rev)rev.hidden=true;previousSetAdminView(view);if(view==='orders')loadOrdersRemote(true)
  };

  window.copyPixCode=async function(){
    const value=document.getElementById('pixCopyCode')?.textContent||'';if(!value)return;
    try{await navigator.clipboard.writeText(value);const button=document.getElementById('copyPixBtn');if(button){button.textContent='✓ Código copiado';setTimeout(()=>button.textContent='Copiar código Pix',1800)}}catch{alert('Não foi possível copiar automaticamente. Selecione o código acima.')}
  };
  function showSuccess(code,isTest=false){
    const title=document.querySelector('#success h4');if(title)title.textContent=isTest?'Pedido de teste salvo':'Pedido confirmado';
    const text=document.querySelector('#success p');if(text)text.innerHTML=(isTest?'Sem cobrança, sem entrega e sem movimentação de estoque. Consulte em Pedidos → Ver somente pedidos de teste.':'Seu pedido foi confirmado. Você pode acompanhar as etapas e observações na sua conta.')+'<br><strong id="successOrderCode"></strong>';
    if(paymentPoll){clearInterval(paymentPoll);paymentPoll=null}const target=document.getElementById('successOrderCode');if(target)target.textContent=code;
    ['step1','pendingPanel','customerAccount','adminLogin','step2','step3','step4'].forEach(id=>document.getElementById(id)?.classList.remove('active'));document.getElementById('success')?.classList.add('active');for(let i=1;i<=4;i++)document.getElementById('dot'+i)?.classList.add('on')
  }
  function beginPaymentPolling(code,token){
    if(paymentPoll)clearInterval(paymentPoll);let failures=0;
    const check=async()=>{try{const data=await statusRequest(code,token);failures=0;const label=document.getElementById('pixWaitingStatus');if(label)label.textContent=paymentStatus(data.paymentStatus)+(data.customerNote?' · '+data.customerNote:'');if(data.paymentStatus==='pago')showSuccess(code);else if(['vencido','cancelado','estornado'].includes(data.paymentStatus)){if(paymentPoll){clearInterval(paymentPoll);paymentPoll=null}if(label)label.textContent=paymentStatus(data.paymentStatus)+' — gere um novo pedido para tentar novamente.'}}catch{failures+=1;if(failures>5){const label=document.getElementById('pixWaitingStatus');if(label)label.textContent='Não foi possível atualizar agora. O pedido continua salvo no painel da UBA.'}}};check();paymentPoll=setInterval(check,5000)
  }
  function showPix(order,publicToken){
    const payment=order.payment||{},qr=document.getElementById('pixQrImage');if(qr)qr.src='data:image/png;base64,'+(payment.encodedImage||'');
    const copy=document.getElementById('pixCopyCode');if(copy)copy.textContent=payment.payload||'';const orderCode=document.getElementById('pixOrderCode');if(orderCode)orderCode.textContent=order.code;const status=document.getElementById('pixWaitingStatus');if(status)status.textContent='Aguardando pagamento Pix...';document.getElementById('pixPaymentArea')?.classList.add('show');document.getElementById('generatePixArea')?.classList.add('hidden');beginPaymentPolling(order.code,publicToken)
  }

  window.finishDemo=async function(){
    const customer=getCustomer();if(!customer){showPanel('step1');setAuthMessage('É necessário um login aprovado para gerar o Pix.','warn');return}
    const totals=getTotals();if(totals.count<50){alert('O pedido mínimo é de 50 unidades.');return}
    const buyerName=document.getElementById('buyerName')?.value.trim()||customer.name||'',buyerDoc=document.getElementById('buyerDoc')?.value.trim()||customer.doc||'';
    if(!buyerName){alert('Informe o nome do comprador.');goStep(2);return}if(![11,14].includes(buyerDoc.replace(/\D/g,'').length)){alert('Informe um CPF ou CNPJ válido para gerar o Pix.');goStep(2);return}
    const button=document.querySelector('#step4 .checkout-nav .next');if(button){button.disabled=true;button.textContent=customer.isTest?'Salvando teste...':'Gerando Pix...'}
    try{
      const payload={purpose:totals.purpose,customer:{name:customer.name,email:customer.email,phone:customer.phone,store:customer.store,doc:customer.doc},buyer:{name:buyerName,doc:buyerDoc,store:document.getElementById('buyerStore')?.value||''},delivery:{cep:document.getElementById('deliveryCep')?.value||'',city:document.getElementById('deliveryCity')?.value||'',street:document.getElementById('deliveryStreet')?.value||'',number:document.getElementById('deliveryNumber')?.value||'',complement:document.getElementById('deliveryComplement')?.value||''},items:catalog.filter(product=>Number(qty[product.id]||0)>0).map(product=>({productId:product.id,quantity:Number(qty[product.id])}))};
      const data=await ordersRequest({method:'POST',body:JSON.stringify(payload)});if(data.order.isTest)showSuccess(data.order.code,true);else showPix(data.order,data.publicToken)
    }catch(error){alert(error.message)}finally{if(button){button.disabled=false;button.textContent=getCustomer()?.isTest?'Finalizar teste sem pagar':'Gerar Pix'}}
  };
  const previousOpenAdmin=window.openAdmin;
  window.openAdmin=function(){previousOpenAdmin();ensureRevenueView();if(ceoSession){loadOrdersRemote(true);if(typeof window.loadSharedStockRemote==='function')window.loadSharedStockRemote(true)}};
  const previousResetDemo=window.resetDemo;
  window.resetDemo=function(){if(paymentPoll){clearInterval(paymentPoll);paymentPoll=null}document.getElementById('pixPaymentArea')?.classList.remove('show');document.getElementById('generatePixArea')?.classList.remove('hidden');previousResetDemo()};
  setInterval(()=>{if(ceoSession&&['orders','revenue'].includes(adminView)&&!document.hidden)loadOrdersRemote(true)},20000);
})();
