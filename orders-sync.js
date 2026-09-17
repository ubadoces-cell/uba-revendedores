/* Pedidos de Revendedores/Eventos — banco compartilhado e painel CEO. */
(function(){
  let orders=[];
  let ordersLoading=false;

  async function ordersRequest(options={}){
    const response=await fetch('/api/orders',{credentials:'same-origin',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível processar o pedido.');
    return data
  }
  function orderMoney(cents){
    return (Number(cents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
  }
  function orderStatus(status){
    return ({novo:'Novo',confirmado:'Confirmado',em_producao:'Em produção',pronto:'Pronto',concluido:'Concluído',cancelado:'Cancelado'})[status]||status
  }
  function orderPurpose(value){return value==='event'?'Festa ou evento':'Revendedor / comércio'}
  function updateOrderCount(){
    const count=orders.filter(order=>order.status==='novo').length;
    const el=document.getElementById('mOrders');if(el)el.textContent=String(count)
  }
  window.renderOrdersPanel=function(){
    const root=document.getElementById('ordersList');if(!root)return;
    updateOrderCount();
    if(ordersLoading){root.innerHTML='<div class="orders-empty">Carregando pedidos...</div>';return}
    if(!orders.length){root.innerHTML='<div class="orders-empty">Nenhum pedido recebido ainda.</div>';return}
    root.innerHTML=orders.map(order=>{
      const customer=order.customer||{};
      const delivery=order.delivery||{};
      const items=Array.isArray(order.items)?order.items:[];
      const address=[delivery.street,delivery.number,delivery.complement,delivery.city,delivery.cep].filter(Boolean).join(' • ')||'Entrega ainda não informada';
      const contact=[customer.phone,customer.email].filter(Boolean).join(' • ')||'Sem contato';
      const when=new Date(order.createdAt).toLocaleString('pt-BR');
      return `<article class="order-card">
        <div class="order-card-head">
          <div><span class="order-code">${escapeHtml(order.code)}</span><h4>${escapeHtml(customer.name||'Cliente')}</h4><small>${escapeHtml(when)} • ${escapeHtml(orderPurpose(order.purpose))}</small></div>
          <div class="order-total"><strong>${orderMoney(order.totalCents)}</strong><span>${Number(order.units||0)} unidades</span></div>
        </div>
        <div class="order-meta"><b>${escapeHtml(customer.store||'Sem nome de loja')}</b><span>${escapeHtml(contact)}</span><span>${escapeHtml(customer.doc||'Documento não informado')}</span></div>
        <div class="order-items">${items.map(item=>`<span><b>${Number(item.quantity||0)}×</b> ${escapeHtml(item.name||item.productId)}</span>`).join('')}</div>
        <div class="order-address"><b>Entrega:</b> ${escapeHtml(address)}</div>
        <div class="order-status-row">
          <label>Status
            <select onchange="updateOrderStatus('${order.id}',this.value)">
              ${['novo','confirmado','em_producao','pronto','concluido','cancelado'].map(status=>`<option value="${status}" ${order.status===status?'selected':''}>${orderStatus(status)}</option>`).join('')}
            </select>
          </label>
          <span class="order-status ${order.status}">${orderStatus(order.status)}</span>
        </div>
      </article>`
    }).join('')
  };
  window.loadOrdersRemote=async function(silent=false){
    if(ordersLoading)return;
    ordersLoading=true;renderOrdersPanel();
    try{
      const data=await ordersRequest();
      orders=Array.isArray(data.orders)?data.orders:[]
    }catch(error){
      if(!silent)alert(error.message)
    }finally{
      ordersLoading=false;renderOrdersPanel()
    }
  };
  window.updateOrderStatus=async function(id,status){
    try{
      const data=await ordersRequest({method:'PATCH',body:JSON.stringify({id,status})});
      const index=orders.findIndex(order=>order.id===id);
      if(index>=0)orders[index]=data.order;
      renderOrdersPanel()
    }catch(error){alert(error.message);loadOrdersRemote(true)}
  };

  window.finishDemo=async function(){
    const customer=getCustomer();
    if(!customer){showPanel('step1');setAuthMessage('É necessário um login aprovado para enviar o pedido.','warn');return}
    const totals=getTotals();
    if(totals.count<50){alert('O pedido mínimo é de 50 unidades.');return}
    const buyerName=document.getElementById('buyerName')?.value.trim()||customer.name||'';
    if(!buyerName){alert('Informe o nome do comprador.');goStep(2);return}

    const button=document.querySelector('#step4 .checkout-nav .next');
    if(button){button.disabled=true;button.textContent='Enviando pedido...'}
    try{
      const payload={
        purpose:totals.purpose,
        customer:{name:customer.name,email:customer.email,phone:customer.phone,store:customer.store,doc:customer.doc},
        buyer:{
          name:buyerName,
          doc:document.getElementById('buyerDoc')?.value||'',
          store:document.getElementById('buyerStore')?.value||''
        },
        delivery:{
          cep:document.getElementById('deliveryCep')?.value||'',
          city:document.getElementById('deliveryCity')?.value||'',
          street:document.getElementById('deliveryStreet')?.value||'',
          number:document.getElementById('deliveryNumber')?.value||'',
          complement:document.getElementById('deliveryComplement')?.value||''
        },
        items:catalog.filter(product=>Number(qty[product.id]||0)>0).map(product=>({productId:product.id,quantity:Number(qty[product.id])}))
      };
      const data=await ordersRequest({method:'POST',body:JSON.stringify(payload)});
      const code=document.getElementById('successOrderCode');
      if(code)code.textContent=data.order.code;
      ['step1','pendingPanel','customerAccount','adminLogin','step2','step3','step4'].forEach(id=>document.getElementById(id)?.classList.remove('active'));
      document.getElementById('success')?.classList.add('active');
      for(let i=1;i<=4;i++)document.getElementById('dot'+i)?.classList.add('on')
    }catch(error){alert(error.message)}
    finally{if(button){button.disabled=false;button.textContent='Enviar pedido'}}
  };

  const previousSetAdminView=window.setAdminView;
  window.setAdminView=function(view){
    previousSetAdminView(view);
    if(view==='orders')loadOrdersRemote(true)
  };
  setInterval(()=>{if(ceoSession&&adminView==='orders'&&!document.hidden)loadOrdersRemote(true)},20000);
})();
