/* UBA Revendedores — Liquid Glass copiado da implementação atual do UBA Controles.
   Só troca os seletores da barra para não conflitar com as abas internas do portal. */
(function(){
  function injectFilter(){
    if(document.getElementById('uba-rev-liquid-glass-svg')) return;
    const wrap=document.createElement('div');
    wrap.id='uba-rev-liquid-glass-svg';
    wrap.setAttribute('aria-hidden','true');
    wrap.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
    wrap.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">
      <filter id="uba-rev-liquid-glass-warp" x="-20%" y="-40%" width="140%" height="180%">
        <feTurbulence type="fractalNoise" baseFrequency="0.009 0.025" numOctaves="2" seed="17" result="noise"/>
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="B"/>
      </filter>
    </svg>`;
    document.body.appendChild(wrap);
  }

  function initNav(){
    const tabs=document.querySelector('.uba-rev-bottom-tabs');
    if(!tabs||tabs.dataset.liquidGlassReady==='1') return;
    tabs.dataset.liquidGlassReady='1';
    injectFilter();

    const sourceButtons=Array.from(tabs.querySelectorAll(':scope > button'));
    if(!sourceButtons.length) return;

    const lens=document.createElement('div');
    lens.className='uba-rev-video-liquid-lens';
    lens.setAttribute('aria-hidden','true');

    const mirror=document.createElement('div');
    mirror.className='uba-rev-video-liquid-mirror';
    lens.appendChild(mirror);

    const mirrorButtons=sourceButtons.map(button=>{
      const clone=button.cloneNode(true);
      clone.removeAttribute('onclick');
      clone.removeAttribute('id');
      clone.setAttribute('tabindex','-1');
      clone.setAttribute('aria-hidden','true');
      clone.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
      mirror.appendChild(clone);
      return clone;
    });

    tabs.prepend(lens);

    let lensW=200,lensH=104,zoom=1.18;
    let lensX=-260,lensY=-140,targetX=lensX,targetY=lensY;
    let visible=false,raf=0,motion=0,phase=0,lastPointerX=null,lastPointerY=null;

    let dragging=false;
    let dragMoved=false;
    let dragStartX=0,dragStartY=0;
    let activePointerId=null;
    let suppressNativeClickUntil=0;
    let dispatchingSyntheticClick=false;
    let lastReleaseTarget=null;

    const isTouchMode=()=>window.matchMedia && (
      window.matchMedia('(hover:none)').matches ||
      window.matchMedia('(pointer:coarse)').matches ||
      window.innerWidth<=900
    );

    const getVisibleButtons=()=>sourceButtons.filter(button=>window.getComputedStyle(button).display!=='none');

    const getActive=()=>sourceButtons.find(button=>button.classList.contains('active')&&window.getComputedStyle(button).display!=='none')
      ||getVisibleButtons()[0]
      ||sourceButtons[0];

    const syncMirror=()=>{
      const r=tabs.getBoundingClientRect();
      const mobile=isTouchMode();
      const visibleButtons=getVisibleButtons();
      const referenceButton=visibleButtons[0]?.getBoundingClientRect();

      /* A lente tem a mesma escala visual de uma opção da barra.
         Ela não fica mais alta/larga que a navegação. */
      lensW=referenceButton
        ? Math.max(86,Math.min(118,referenceButton.width+4))
        : Math.max(86,Math.min(118,r.width/Math.max(1,visibleButtons.length)));

      lensH=Math.max(36,Math.min(46,r.height-8));
      zoom=mobile?1.07:1.09;

      lens.style.width=lensW+'px';
      lens.style.height=lensH+'px';
      mirror.style.width=r.width+'px';
      mirror.style.height=r.height+'px';

      sourceButtons.forEach((button,index)=>{
        const clone=mirrorButtons[index];
        if(!clone) return;
        clone.className=button.className;
        clone.style.display=window.getComputedStyle(button).display==='none'?'none':'';
      });
    };

    const clampTarget=(x,y)=>{
      const r=tabs.getBoundingClientRect();
      targetX=Math.max(-8,Math.min(r.width-lensW+8,x-lensW/2));
      targetY=(r.height-lensH)/2+Math.max(-2.5,Math.min(2.5,(y-r.height/2)*.08));
    };

    const paint=()=>{
      raf=0;

      const lagX=targetX-lensX;
      const lagY=targetY-lensY;
      const mobile=isTouchMode();

      lensX+=lagX*(mobile?.22:.19);
      lensY+=lagY*(mobile?.23:.21);

      const targetMotion=Math.min(1,(Math.abs(lagX)+Math.abs(lagY)*1.15)/34);
      motion+=(targetMotion-motion)*.24;
      motion*=mobile?.958:.966;
      phase+=.18+motion*.13;

      const wobble=Math.sin(phase)*motion;
      const direction=lagX>=0?1:-1;

      /* Deformação de gota d'água:
         quanto maior o movimento, mais ela alonga na direção do deslocamento
         e converge no eixo perpendicular. Ao parar, volta suavemente ao formato normal. */
      const converge=1-motion*.018;
      const scaleX=(1+motion*.095+wobble*.010)*converge;
      const scaleY=(1-motion*.070-wobble*.006)*converge;

      const skewX=Math.max(-4.2,Math.min(4.2,lagX*.040));
      const rotate=Math.max(-1.05,Math.min(1.05,lagX*.010));

      const centerX=lensX+lensW/2;
      const centerY=lensY+lensH/2;
      const mirrorTx=lensW/2-(centerX*zoom);
      const mirrorTy=lensH/2-(centerY*zoom);

      lens.style.transform=`translate3d(${lensX}px,${lensY}px,0) rotate(${rotate}deg) skewX(${skewX}deg) scale(${scaleX},${scaleY})`;
      mirror.style.transform=`translate3d(${mirrorTx}px,${mirrorTy}px,0) scale(${zoom})`;

      const radiusBase=Math.max(16,Math.min(24,lensH*.50));
      const pull=motion*6.2;
      const wave=wobble*1.2;
      const leading=radiusBase+pull+wave;
      const trailing=Math.max(12,radiusBase-pull*.58-wave*.35);

      if(direction>=0){
        lens.style.borderRadius=`${trailing}px ${leading}px ${leading-wave}px ${trailing+wave}px`;
      }else{
        lens.style.borderRadius=`${leading}px ${trailing}px ${trailing+wave}px ${leading-wave}px`;
      }

      if(visible&&(Math.abs(targetX-lensX)>.06||Math.abs(targetY-lensY)>.06||motion>.004)){
        raf=requestAnimationFrame(paint);
      }
    };

    const requestPaint=()=>{
      if(!raf) raf=requestAnimationFrame(paint);
    };

    const hideLens=()=>{
      visible=false;
      lens.classList.remove('is-visible');
      lastPointerX=null;
      lastPointerY=null;
    };

    const showAt=(clientX,clientY)=>{
      syncMirror();
      const r=tabs.getBoundingClientRect();
      clampTarget(clientX-r.left,clientY-r.top);

      if(lastPointerX!==null){
        const pointerDelta=Math.abs(clientX-lastPointerX)+Math.abs(clientY-lastPointerY)*.65;
        motion=Math.max(motion,Math.min(1,pointerDelta/32));
      }

      lastPointerX=clientX;
      lastPointerY=clientY;

      if(!visible){
        lensX=targetX;
        lensY=targetY;
        visible=true;
        lens.classList.add('is-visible');
      }

      requestPaint();
    };

    const moveLensToActiveForDesktopHover=()=>{
      if(isTouchMode()) return;
      const active=getActive();
      if(!active) return;
      const r=tabs.getBoundingClientRect();
      const ar=active.getBoundingClientRect();
      clampTarget((ar.left-r.left)+ar.width/2,(ar.top-r.top)+ar.height/2);
      requestPaint();
    };

    const buttonAtPoint=(clientX,clientY)=>{
      if(!Number.isFinite(clientX)||!Number.isFinite(clientY)) return null;
      const visibleButtons=getVisibleButtons();

      return visibleButtons.find(button=>{
        const r=button.getBoundingClientRect();

        /* Mantém o espaço horizontal entre opções como zona neutra,
           mas tolera alguns pixels acima/abaixo da barra no touch. */
        return (
          clientX>=r.left &&
          clientX<=r.right &&
          clientY>=r.top-14 &&
          clientY<=r.bottom+14
        );
      })||null;
    };

    const resetInteractionClasses=()=>{
      tabs.classList.remove('uba-lens-dragging');
      tabs.classList.remove('uba-lens-pending-selection');
    };

    const restoreBlackSelection=()=>{
      resetInteractionClasses();
      tabs.classList.remove('uba-no-selection');
    };

    const clearPointerCapture=()=>{
      if(activePointerId!==null){
        try{tabs.releasePointerCapture?.(activePointerId)}catch{}
      }
      activePointerId=null;
    };

    const cancelDrag=()=>{
      if(!dragging) return;
      dragging=false;
      clearPointerCapture();
      resetInteractionClasses();
      tabs.classList.remove('uba-no-selection');
      hideLens();
      motion=0;
    };

    const selectTarget=(target)=>{
      if(!target) return;

      const currentActive=getActive();

      restoreBlackSelection();

      if(target!==currentActive){
        dispatchingSyntheticClick=true;
        try{
          target.click();
        }finally{
          dispatchingSyntheticClick=false;
        }

        /* Evita o segundo click nativo que Safari/Chrome podem disparar
           depois do pointerup/touchend. */
        suppressNativeClickUntil=performance.now()+480;
      }

      lastReleaseTarget=target;
      hideLens();
      motion=Math.max(motion,.18);
    };

    const releaseDrag=(clientX,clientY)=>{
      if(!dragging) return;

      const target=buttonAtPoint(clientX,clientY);

      dragging=false;
      clearPointerCapture();
      tabs.classList.remove('uba-lens-dragging');
      tabs.classList.remove('uba-lens-pending-selection');

      lastPointerX=null;
      lastPointerY=null;

      if(target){
        selectTarget(target);
      }else{
        /* Soltou entre opções: limpa a seleção visual completamente. */
        tabs.classList.add('uba-no-selection');
        hideLens();
        if(dragMoved) suppressNativeClickUntil=performance.now()+380;
      }
    };

    const beginDrag=(e)=>{
      if(e.pointerType==='mouse' && e.button!==0) return;

      dragging=true;
      dragMoved=false;
      dragStartX=e.clientX;
      dragStartY=e.clientY;
      activePointerId=e.pointerId;

      /* Ao tocar/segurar, o preto some imediatamente. */
      tabs.classList.add('uba-lens-dragging');
      tabs.classList.remove('uba-no-selection');

      try{tabs.setPointerCapture?.(e.pointerId)}catch{}

      showAt(e.clientX,e.clientY);
    };

    syncMirror();

    /* MOBILE: começa limpo, sem lupa parada sobre o item ativo.
       O preto da aba ativa permanece normalmente. */
    if(isTouchMode()){
      hideLens();
    }

    tabs.addEventListener('pointerenter',e=>{
      if(isTouchMode()||dragging) return;

      const hovered=buttonAtPoint(e.clientX,e.clientY);
      if(hovered===getActive()){
        tabs.classList.add('uba-no-selection');
      }

      showAt(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('pointermove',e=>{
      if(dragging){
        const dist=Math.hypot(e.clientX-dragStartX,e.clientY-dragStartY);
        if(dist>4) dragMoved=true;
        showAt(e.clientX,e.clientY);
        return;
      }

      if(isTouchMode()){
        if(e.pointerType==='pen'){
          const hovered=buttonAtPoint(e.clientX,e.clientY);
          if(hovered===getActive()) hideLens();
          else showAt(e.clientX,e.clientY);
        }
        return;
      }

      const hovered=buttonAtPoint(e.clientX,e.clientY);

      /* No PC, a lupa passa por todas as opções, inclusive a selecionada.
         Ao cruzar a seleção preta, ela some e permanece oculta até
         selecionar uma opção ou sair da barra. */
      if(hovered===getActive()){
        tabs.classList.add('uba-no-selection');
      }

      showAt(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('pointerdown',beginDrag,{passive:true});

    tabs.addEventListener('pointerup',e=>{
      releaseDrag(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('pointercancel',()=>{
      /* Cancelamento não confirma seleção; apenas volta ao estado estável. */
      cancelDrag();
    },{passive:true});

    tabs.addEventListener('lostpointercapture',()=>{
      if(dragging){
        cancelDrag();
      }
    },{passive:true});

    /* Fallback apenas para navegadores sem Pointer Events.
       Evita dois fluxos concorrentes no Safari moderno. */
    if(!window.PointerEvent){
      tabs.addEventListener('touchstart',e=>{
        const t=e.touches?.[0];
        if(!t) return;
        beginDrag({
          pointerType:'touch',
          pointerId:1,
          button:0,
          clientX:t.clientX,
          clientY:t.clientY
        });
      },{passive:true});

      tabs.addEventListener('touchmove',e=>{
        if(!dragging||!e.touches?.length) return;
        const t=e.touches[0];
        const dist=Math.hypot(t.clientX-dragStartX,t.clientY-dragStartY);
        if(dist>4) dragMoved=true;
        showAt(t.clientX,t.clientY);
        e.preventDefault();
      },{passive:false});

      tabs.addEventListener('touchend',e=>{
        if(!dragging) return;
        const t=e.changedTouches?.[0];
        releaseDrag(Number.isFinite(t?.clientX)?t.clientX:lastPointerX, Number.isFinite(t?.clientY)?t.clientY:lastPointerY);
      },{passive:true});
    }

    tabs.addEventListener('pointerleave',()=>{
      if(dragging) return;

      if(isTouchMode()){
        hideLens();
      }else{
        restoreBlackSelection();
        hideLens();
      }
    },{passive:true});

    /* Um único interceptador de click:
       - deixa passar o click sintético usado para selecionar a nova opção;
       - bloqueia apenas o click nativo duplicado que vem logo depois. */
    tabs.addEventListener('click',e=>{
      if(dispatchingSyntheticClick) return;

      if(performance.now()<suppressNativeClickUntil){
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      const button=e.target.closest('button');
      if(button&&sourceButtons.includes(button)){
        restoreBlackSelection();

        /* No touch, um toque normal não deve deixar a lupa presa. */
        if(isTouchMode()) hideLens();
      }
    },true);

    window.addEventListener('blur',()=>{
      if(dragging) cancelDrag();
      else if(isTouchMode()) hideLens();
    },{passive:true});

    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){
        if(dragging) cancelDrag();
        else if(isTouchMode()) hideLens();
      }
    });

    window.addEventListener('resize',()=>{
      syncMirror();
      if(isTouchMode()){
        hideLens();
      }else if(visible){
        moveLensToActiveForDesktopHover();
      }
    },{passive:true});

    const obs=new MutationObserver(()=>{
      syncMirror();

      /* Atualizar .active nunca deve fazer a lupa reaparecer sozinha no celular. */
      if(isTouchMode()){
        if(!dragging) hideLens();
      }
    });

    sourceButtons.forEach(button=>{
      obs.observe(button,{attributes:true,attributeFilter:['class','style']});
    });

    const roleObs=new MutationObserver(()=>{
      syncMirror();
      if(isTouchMode()) hideLens();
    });

    roleObs.observe(document.body,{attributes:true,attributeFilter:['data-role']});

    tabs.addEventListener('click',e=>{
      const button=e.target.closest('button');
      if(!button) return;

      button.classList.remove('uba-liquid-pop');
      requestAnimationFrame(()=>{
        button.classList.add('uba-liquid-pop');
        setTimeout(()=>button.classList.remove('uba-liquid-pop'),260);
      });
    });
  }


  function init(){
    initNav();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();

  new MutationObserver(init).observe(document.documentElement,{childList:true,subtree:true});
})();
