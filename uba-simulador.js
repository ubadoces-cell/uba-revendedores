/* Simulador de lucro da aba Tabelas (v3.4).
   Usa somente os dados já liberados por /api/reseller-tables para quem pode ver a tabela.
   Não grava nada: só calcula na tela e, se o cliente quiser, preenche o carrinho. */
(function(){
  const state={qty:{}};
  const STEP=5;
  const brl=c=>(Number(c)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const tierLabel=t=>t.max===null?t.min+'+ un.':t.min+'–'+t.max+' un.';
  let data=null,root=null;

  function splitName(name){
    const [a,b]=String(name).split('+').map(s=>s.trim());
    return {title:a||name,filling:b||''};
  }
  function photo(id){
    try{const p=(typeof catalog!=='undefined'?catalog:[]).find(x=>x.id===id);return p&&p.img?p.img:''}catch{return ''}
  }
  function tierIndex(count){
    return data.tiers.findIndex(t=>count>=t.min&&(t.max===null||count<=t.max));
  }
  function totals(){
    const items=data.products.filter(p=>p.available);
    const count=items.reduce((s,p)=>s+(state.qty[p.id]||0),0);
    const ti=tierIndex(count);
    let cost=0,sale=0;
    for(const p of items){
      const q=state.qty[p.id]||0;
      sale+=q*p.retailCents;
      if(ti>=0)cost+=q*p.resellerCents[ti];
    }
    return {items,count,ti,cost,sale,profit:sale-cost};
  }
  function setQty(id,value){
    const n=Number(value);
    state.qty[id]=Number.isFinite(n)?Math.max(0,Math.min(9999,Math.trunc(n))):0;
    update();
  }
  function preset(total){
    const items=data.products.filter(p=>p.available);
    let chosen=items.filter(p=>(state.qty[p.id]||0)>0);
    if(!chosen.length)chosen=items;
    items.forEach(p=>state.qty[p.id]=0);
    const base=Math.floor(total/chosen.length);let rest=total-base*chosen.length;
    chosen.forEach(p=>{state.qty[p.id]=base+(rest>0?1:0);if(rest>0)rest--;});
    render();
  }

  function rowHTML(p,ti){
    const n=splitName(p.name),q=state.qty[p.id]||0,img=photo(p.id);
    const unit=ti>=0?brl(p.resellerCents[ti]):brl(p.resellerCents[0]);
    return '<div class="uba-sim-row'+(q>0?' on':'')+'" data-id="'+esc(p.id)+'">'+
      (img?'<img class="uba-sim-thumb" src="'+esc(img)+'" alt="" loading="lazy">':'<span class="uba-sim-thumb"></span>')+
      '<div class="uba-sim-name"><strong>'+esc(n.title)+'</strong>'+(n.filling?'<span>recheio de '+esc(n.filling.toLowerCase())+'</span>':'')+
      '<small><b data-unit>'+unit+'</b>/un. · vende a '+brl(p.retailCents)+'</small></div>'+
      '<div class="uba-sim-step" role="group" aria-label="Quantidade de '+esc(p.name)+'">'+
        '<button type="button" data-act="minus" aria-label="Diminuir">−</button>'+
        '<input type="number" inputmode="numeric" min="0" step="'+STEP+'" value="'+(q||'')+'" placeholder="0" aria-label="Quantidade">'+
        '<button type="button" data-act="plus" aria-label="Aumentar">+</button>'+
      '</div></div>';
  }

  function render(){
    if(!root||!data)return;
    const t=totals();
    root.innerHTML=
      '<div class="uba-sim-head"><span class="uba-sim-icon" aria-hidden="true">↗</span><div>'+
        '<h3>Simulador de lucro</h3>'+
        '<p>Escolha os sabores e as quantidades. Veja quanto custa na UBA e quanto você pode ganhar vendendo pelo preço do cardápio.</p></div></div>'+
      '<div class="uba-sim-presets"><span>Atalho:</span>'+[25,50,100,200,400].map(v=>'<button type="button" data-preset="'+v+'">'+v+' un.</button>').join('')+
        '<button type="button" class="ghost" data-preset="0">Limpar</button></div>'+
      '<div class="uba-sim-grid">'+
        '<div class="uba-sim-list">'+t.items.map(p=>rowHTML(p,t.ti)).join('')+'</div>'+
        '<aside class="uba-sim-result" aria-live="polite"></aside>'+
      '</div>'+
      '<button type="button" class="uba-sim-mini" data-mini hidden></button>';
    update();
  }

  function update(){
    if(!root||!data)return;
    const t=totals();
    // Atualiza linhas sem recriar os campos (o cursor não sai do lugar)
    root.querySelectorAll('.uba-sim-row').forEach(row=>{
      const p=data.products.find(x=>x.id===row.dataset.id);if(!p)return;
      const q=state.qty[p.id]||0;
      row.classList.toggle('on',q>0);
      const inp=row.querySelector('input');
      if(document.activeElement!==inp)inp.value=q||'';
      row.querySelector('[data-unit]').textContent=brl(p.resellerCents[t.ti>=0?t.ti:0]);
    });
    const box=root.querySelector('.uba-sim-result');
    const min=data.tiers[0]?data.tiers[0].min:25;
    const next=t.ti>=0?data.tiers[t.ti+1]:null;
    let html='<div class="uba-sim-units"><span>'+t.count+' alfajores</span>'+
      (t.ti>=0?'<em>Faixa '+tierLabel(data.tiers[t.ti])+'</em>':'')+'</div>';
    if(t.count===0){
      html+='<p class="uba-sim-empty">Toque em <b>+</b> nos sabores ou use um atalho para começar.</p>';
    }else if(t.ti<0){
      html+='<p class="uba-sim-empty">Pedido mínimo de <b>'+min+' unidades</b>. Faltam <b>'+(min-t.count)+'</b> para ver o resultado.</p>';
    }else{
      const ret=t.cost>0?Math.round(t.profit/t.cost*1000)/10:0;
      html+=
        '<div class="uba-sim-line"><span>Você paga na UBA<small>só os produtos</small></span><strong>'+brl(t.cost)+'</strong></div>'+
        '<div class="uba-sim-line"><span>Vendendo pelo cardápio<small>preço à vista</small></span><strong>'+brl(t.sale)+'</strong></div>'+
        '<div class="uba-sim-profit"><span>Lucro estimado</span><strong>'+brl(t.profit)+'</strong>'+
          '<em>+'+ret.toLocaleString('pt-BR')+'% sobre o que você pagou</em></div>'+
        (next?'<p class="uba-sim-next">Mais <b>'+(next.min-t.count)+' unidades</b> e você entra na faixa <b>'+tierLabel(next)+'</b>, pagando menos por alfajor.</p>':'<p class="uba-sim-next">Você já está na <b>melhor faixa</b> de preço.</p>')+
        '<button type="button" class="uba-sim-cta" data-cart>Montar este pedido no carrinho</button>';
    }
    html+='<p class="uba-sim-note">Sem frete e sem custos adicionais: só o valor dos produtos. É um lucro bruto estimado, não desconta impostos, perdas ou outras despesas.</p>';
    box.innerHTML=html;
    const mini=root.querySelector('[data-mini]');
    if(mini){
      mini.hidden=t.count===0;
      mini.innerHTML=t.ti>=0
        ?'<span>'+t.count+' un. · lucro estimado</span><b>'+brl(t.profit)+'</b>'
        :'<span>'+t.count+' un.</span><span>Faltam '+(min-t.count)+' para o mínimo</span>';
    }
  }

  function sendToCart(){
    if(typeof qty==='undefined'||typeof catalog==='undefined')return;
    catalog.forEach(p=>{qty[p.id]=p.active?(state.qty[p.id]||0):0});
    if(typeof updateCart==='function')updateCart();
    if(typeof renderProducts==='function')renderProducts();
    if(typeof updatePriceVisibilityNote==='function')updatePriceVisibilityNote();
    if(typeof openCart==='function')openCart();
  }

  function bind(){
    root.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||!root.contains(b))return;
      if(b.dataset.preset!==undefined){
        const v=Number(b.dataset.preset);
        if(v===0){data.products.forEach(p=>state.qty[p.id]=0);update();}else preset(v);
        return;
      }
      if(b.hasAttribute('data-cart'))return sendToCart();
      if(b.hasAttribute('data-mini'))return root.querySelector('.uba-sim-result').scrollIntoView({behavior:'smooth',block:'start'});
      const row=b.closest('.uba-sim-row');if(!row)return;
      const id=row.dataset.id,cur=state.qty[id]||0;
      if(b.dataset.act==='plus')setQty(id,cur+STEP);
      if(b.dataset.act==='minus')setQty(id,Math.max(0,cur-STEP));
    });
    root.addEventListener('input',e=>{
      const row=e.target.closest('.uba-sim-row');
      if(row&&e.target.matches('input'))setQty(row.dataset.id,e.target.value);
    });
    root.addEventListener('focusout',e=>{
      if(e.target.matches('.uba-sim-row input'))update();
    });
  }

  window.renderUbaSimulator=function(container,tableData){
    if(!container||!tableData||!Array.isArray(tableData.products)||!Array.isArray(tableData.tiers))return;
    data=tableData;
    tableData.products.forEach(p=>{if(state.qty[p.id]===undefined)state.qty[p.id]=0});
    if(root!==container){root=container;bind();}
    render();
  };
})();
