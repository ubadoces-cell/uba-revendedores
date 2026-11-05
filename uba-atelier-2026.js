/* UBA DOCES — Atelier 2026
   Camada SOMENTE visual. Não altera autenticação, preços, checkout, Pix ou tabelas.
   Efeitos baseados em posição/rolagem; desabilitados quando o usuário prefere menos movimento. */
(()=>{
  'use strict';
  const doc=document;
  const root=doc.documentElement;
  const motionAllowed=typeof matchMedia==='function' &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer=typeof matchMedia==='function' &&
    matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hero=doc.getElementById('mainResellerHero');
  const products=doc.getElementById('products');
  const topbar=doc.querySelector('.topbar');

  // O conteúdo nunca fica invisível se o navegador não suportar observers.
  let observer=null;
  const observed=new WeakSet();
  const revealTargets=[
    '#mainResellerHero',
    '#resellerCatalogView .toolbar',
    '#resellerCatalogView .section-head',
    '#resellerCatalogView .reseller-cta',
    '#resellerTablesView .reseller-tables-page'
  ];
  function watch(element,delay=0){
    if(!element||observed.has(element))return;
    observed.add(element);
    element.style.setProperty('--uba-reveal-delay',Math.min(delay,180)+'ms');
    element.classList.add('uba-reveal');
    observer?.observe(element);
  }
  if(motionAllowed && 'IntersectionObserver' in window){
    observer=new IntersectionObserver((entries)=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        entry.target.classList.add('uba-reveal-visible');
        observer.unobserve(entry.target);
      }
    },{rootMargin:'0px 0px 55px 0px',threshold:.06});
    for(const selector of revealTargets)watch(doc.querySelector(selector));
    root.classList.add('uba-motion-ready');
  }

  let pendingProducts=false;
  function refreshProductReveals(){
    if(!products||!observer)return;
    const cards=[...products.querySelectorAll(':scope > .product, :scope > .coming-soon-card')];
    for(let i=0;i<cards.length;i++)watch(cards[i],(i%4)*48);
  }
  refreshProductReveals();
  if(products && 'MutationObserver' in window){
    new MutationObserver((mutations)=>{
      if(!mutations.some(m=>m.addedNodes.length))return;
      if(pendingProducts)return;
      pendingProducts=true;
      requestAnimationFrame(()=>{
        pendingProducts=false;
        refreshProductReveals();
      });
    }).observe(products,{childList:true});
  }

  // Barra de progresso leve: informa a posição do usuário no catálogo.
  if(topbar){
    const progress=doc.createElement('div');
    progress.className='uba-scroll-progress';
    progress.setAttribute('aria-hidden','true');
    const fill=doc.createElement('span');
    progress.appendChild(fill);
    topbar.appendChild(progress);
    let queued=false;
    const onScroll=()=>{
      if(queued)return;
      queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        const scrollable=Math.max(1,doc.documentElement.scrollHeight-innerHeight);
        const fraction=Math.min(1,Math.max(0,scrollY/scrollable));
        fill.style.transform='scaleX('+fraction.toFixed(4)+')';
        topbar.classList.toggle('uba-scrolled',scrollY>26);
      });
    };
    addEventListener('scroll',onScroll,{passive:true});
    addEventListener('resize',onScroll,{passive:true});
    onScroll();
  }

  // Profundidade discreta na fotografia oficial; não movimenta o texto nem a grade.
  if(motionAllowed && finePointer && hero){
    const art=hero.querySelector('.hero-art');
    if(art){
      let frame=0;
      const update=(event)=>{
        if(frame)return;
        const rect=art.getBoundingClientRect();
        const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/Math.max(1,rect.width)*2-1));
        const y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/Math.max(1,rect.height)*2-1));
        frame=requestAnimationFrame(()=>{
          art.style.setProperty('--uba-pan-x', (x*5).toFixed(1)+'px');
          art.style.setProperty('--uba-pan-y', (y*5).toFixed(1)+'px');
          frame=0;
        });
      };
      art.addEventListener('pointermove',update,{passive:true});
      art.addEventListener('pointerleave',()=>{
        art.style.setProperty('--uba-pan-x','0px');
        art.style.setProperty('--uba-pan-y','0px');
      },{passive:true});
    }
    // Halo acompanha o ponteiro somente no card sobre o qual ele está.
    products?.addEventListener('pointermove',(event)=>{
      const card=event.target.closest('.product');
      if(!card||!products.contains(card))return;
      const rect=card.getBoundingClientRect();
      card.style.setProperty('--uba-px',(event.clientX-rect.left).toFixed(0)+'px');
      card.style.setProperty('--uba-py',(event.clientY-rect.top).toFixed(0)+'px');
    },{passive:true});
  }

  // Feedback visual ao aumentar o carrinho, sem interceptar a lógica de quantidades.
  const counter=doc.getElementById('cartCount');
  if(motionAllowed && counter && 'MutationObserver' in window){
    let previous=counter.textContent;
    new MutationObserver(()=>{
      const current=counter.textContent;
      if(current===previous)return;
      previous=current;
      counter.classList.remove('uba-pop');
      void counter.offsetWidth;
      counter.classList.add('uba-pop');
    }).observe(counter,{characterData:true,subtree:true,childList:true});
  }

  // A troca de abas também anima o banner original, sem tocar no controle de acesso.
  if(motionAllowed && hero){
    doc.addEventListener('click',(event)=>{
      if(!event.target.closest('#resellerCatalogTab,#resellerTablesTab'))return;
      requestAnimationFrame(()=>{
        hero.classList.remove('uba-scene-enter');
        void hero.offsetWidth;
        hero.classList.add('uba-scene-enter');
      });
    });
  }
})();