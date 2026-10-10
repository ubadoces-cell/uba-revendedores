/* UBA Revendedores — Liquid Glass bottom nav.
   Mesma interação visual do UBA Controles, com suporte a mouse e touch. */
(function(){
  function injectFilter(){
    if(document.getElementById('uba-rev-liquid-glass-svg'))return;
    const wrap=document.createElement('div');
    wrap.id='uba-rev-liquid-glass-svg';
    wrap.setAttribute('aria-hidden','true');
    wrap.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none';
    wrap.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0"><filter id="uba-rev-liquid-glass-warp" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="0.009 0.025" numOctaves="2" seed="17" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="B"/></filter></svg>';
    document.body.appendChild(wrap);
  }

  function init(){
    const tabs=document.querySelector('.uba-rev-bottom-tabs');
    if(!tabs||tabs.dataset.liquidGlassReady==='1')return;
    tabs.dataset.liquidGlassReady='1';
    injectFilter();

    const sourceButtons=Array.from(tabs.querySelectorAll(':scope > button'));
    if(!sourceButtons.length)return;

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
    let touching=false,touchMoved=false,touchStartX=0,touchStartY=0,activePointerId=null,suppressClickUntil=0;

    const isTouchMode=()=>window.matchMedia&&(
      window.matchMedia('(hover:none)').matches||
      window.matchMedia('(pointer:coarse)').matches||
      window.innerWidth<=900
    );

    const visibleButtons=()=>sourceButtons.filter(button=>window.getComputedStyle(button).display!=='none');
    const getActive=()=>visibleButtons().find(button=>button.classList.contains('active'))||visibleButtons()[0]||sourceButtons[0];

    const syncMirror=()=>{
      const r=tabs.getBoundingClientRect();
      const mobile=isTouchMode();
      const buttons=visibleButtons();
      const referenceButton=buttons[0]?.getBoundingClientRect();

      /* Mesma proporção atual da lupa do UBA Controles. */
      lensW=referenceButton
        ? Math.max(86,Math.min(118,referenceButton.width+4))
        : Math.max(86,Math.min(118,r.width/Math.max(1,buttons.length)));
      lensH=Math.max(36,Math.min(46,r.height-8));
      zoom=mobile?1.07:1.09;

      lens.style.width=lensW+'px';
      lens.style.height=lensH+'px';
      mirror.style.width=r.width+'px';
      mirror.style.height=r.height+'px';
      sourceButtons.forEach((button,index)=>{
        const clone=mirrorButtons[index];
        if(!clone)return;
        clone.className=button.className;
        clone.style.display=window.getComputedStyle(button).display==='none'?'none':'';
      });
    };

    const clampTarget=(x,y)=>{
      const r=tabs.getBoundingClientRect();
      targetX=Math.max(-8,Math.min(r.width-lensW+8,x-lensW/2));
      targetY=(r.height-lensH)/2+Math.max(-2.5,Math.min(2.5,(y-r.height/2)*.08));
    };

    const targetActive=()=>{
      syncMirror();
      const r=tabs.getBoundingClientRect();
      const active=getActive();
      if(!active)return;
      const ar=active.getBoundingClientRect();
      clampTarget((ar.left-r.left)+ar.width/2,(ar.top-r.top)+ar.height/2);
    };

    const paint=()=>{
      raf=0;
      const lagX=targetX-lensX,lagY=targetY-lensY;
      const mobile=isTouchMode();
      lensX+=lagX*(mobile?.19:.16);
      lensY+=lagY*(mobile?.20:.18);

      const targetMotion=Math.min(1,(Math.abs(lagX)+Math.abs(lagY)*1.4)/58);
      motion+=(targetMotion-motion)*.18;
      motion*=mobile?.968:.975;
      phase+=.16+motion*.10;

      const wobble=Math.sin(phase)*motion;
      const scaleX=1+motion*.024+wobble*.006;
      const scaleY=1-motion*.014-wobble*.004;
      const skewX=Math.max(-1.7,Math.min(1.7,lagX*.016));
      const rotate=Math.max(-.75,Math.min(.75,lagX*.006));

      const centerX=lensX+lensW/2,centerY=lensY+lensH/2;
      const mirrorTx=lensW/2-(centerX*zoom),mirrorTy=lensH/2-(centerY*zoom);

      lens.style.transform='translate3d('+lensX+'px,'+lensY+'px,0) rotate('+rotate+'deg) skewX('+skewX+'deg) scale('+scaleX+','+scaleY+')';
      mirror.style.transform='translate3d('+mirrorTx+'px,'+mirrorTy+'px,0) scale('+zoom+')';

      const radiusBase=Math.max(30,Math.min(42,lensH*.40));
      const radiusWave=wobble*2.1,speedShape=motion*2.5;
      lens.style.borderRadius=
        (radiusBase+radiusWave)+'px '+(radiusBase-speedShape)+'px '+(radiusBase-radiusWave)+'px '+(radiusBase+speedShape)+'px / '+
        (radiusBase-speedShape*.55)+'px '+(radiusBase+radiusWave*.7)+'px '+(radiusBase+speedShape*.55)+'px '+(radiusBase-radiusWave*.7)+'px';

      if(visible&&(Math.abs(targetX-lensX)>.10||Math.abs(targetY-lensY)>.10||motion>.008))raf=requestAnimationFrame(paint);
    };

    const showAt=(clientX,clientY)=>{
      syncMirror();
      const r=tabs.getBoundingClientRect();
      clampTarget(clientX-r.left,clientY-r.top);
      if(lastPointerX!==null){
        const delta=Math.abs(clientX-lastPointerX)+Math.abs(clientY-lastPointerY)*.65;
        motion=Math.max(motion,Math.min(1,delta/34));
      }
      lastPointerX=clientX;
      lastPointerY=clientY;
      if(!visible){
        lensX=targetX;lensY=targetY;visible=true;lens.classList.add('is-visible');
      }
      if(!raf)raf=requestAnimationFrame(paint);
    };

    const moveToActive=(immediate=false)=>{
      targetActive();
      visible=true;
      lens.classList.add('is-visible');
      if(immediate){lensX=targetX;lensY=targetY;motion=0}
      else motion=Math.max(motion,.62);
      if(!raf)raf=requestAnimationFrame(paint);
    };

    const buttonAtPoint=(clientX,clientY)=>{
      const buttons=visibleButtons();
      const direct=buttons.find(button=>{
        const r=button.getBoundingClientRect();
        return clientX>=r.left&&clientX<=r.right&&clientY>=r.top&&clientY<=r.bottom;
      });
      if(direct)return direct;
      const tr=tabs.getBoundingClientRect();
      if(clientY<tr.top-24||clientY>tr.bottom+24)return null;
      let best=null,distance=Infinity;
      buttons.forEach(button=>{
        const r=button.getBoundingClientRect();
        const d=Math.abs(clientX-(r.left+r.width/2));
        if(d<distance){distance=d;best=button}
      });
      return best;
    };

    syncMirror();
    if(isTouchMode())moveToActive(true);

    tabs.addEventListener('pointerenter',e=>{
      if(isTouchMode())return;
      showAt(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('pointermove',e=>{
      if(isTouchMode()){
        if(touching||e.pointerType==='pen'){
          if(touching&&Math.hypot(e.clientX-touchStartX,e.clientY-touchStartY)>4)touchMoved=true;
          showAt(e.clientX,e.clientY);
        }
      }else showAt(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('pointerdown',e=>{
      if(!isTouchMode())return;
      touching=true;touchMoved=false;touchStartX=e.clientX;touchStartY=e.clientY;activePointerId=e.pointerId;
      try{tabs.setPointerCapture?.(e.pointerId)}catch{}
      showAt(e.clientX,e.clientY);
    },{passive:true});

    tabs.addEventListener('touchmove',e=>{
      if(!isTouchMode()||!e.touches?.length)return;
      const t=e.touches[0];
      if(Math.hypot(t.clientX-touchStartX,t.clientY-touchStartY)>4)touchMoved=true;
      touching=true;
      showAt(t.clientX,t.clientY);
      e.preventDefault();
    },{passive:false});

    const finishTouch=e=>{
      if(!isTouchMode())return;
      const releaseX=Number.isFinite(e?.clientX)?e.clientX:lastPointerX;
      const releaseY=Number.isFinite(e?.clientY)?e.clientY:lastPointerY;
      const target=touchMoved&&releaseX!==null&&releaseY!==null?buttonAtPoint(releaseX,releaseY):null;

      if(activePointerId!==null){
        try{tabs.releasePointerCapture?.(activePointerId)}catch{}
      }
      activePointerId=null;touching=false;lastPointerX=null;lastPointerY=null;

      if(target){
        suppressClickUntil=0;
        target.click();
        suppressClickUntil=performance.now()+420;
        requestAnimationFrame(()=>moveToActive(false));
        setTimeout(()=>moveToActive(false),100);
        return;
      }

      if(touchMoved)suppressClickUntil=performance.now()+350;
      requestAnimationFrame(()=>moveToActive(false));
      setTimeout(()=>moveToActive(false),90);
    };

    tabs.addEventListener('pointerup',finishTouch,{passive:true});
    tabs.addEventListener('pointercancel',finishTouch,{passive:true});
    tabs.addEventListener('touchend',e=>{
      if(touching){const t=e.changedTouches?.[0];finishTouch(t||e)}
    },{passive:true});

    tabs.addEventListener('pointerleave',()=>{
      if(!isTouchMode()){
        visible=false;lastPointerX=null;lastPointerY=null;lens.classList.remove('is-visible');
      }
    },{passive:true});

    tabs.addEventListener('click',e=>{
      if(isTouchMode()&&performance.now()<suppressClickUntil){
        e.preventDefault();e.stopPropagation();return;
      }
      const button=e.target.closest('button');
      if(button){
        button.classList.remove('uba-liquid-pop');
        requestAnimationFrame(()=>{
          button.classList.add('uba-liquid-pop');
          setTimeout(()=>button.classList.remove('uba-liquid-pop'),260);
        });
      }
      requestAnimationFrame(()=>moveToActive(false));
      setTimeout(()=>moveToActive(false),90);
    },true);

    window.addEventListener('resize',()=>{
      syncMirror();
      if(isTouchMode())moveToActive(true);
    },{passive:true});

    const obs=new MutationObserver(()=>{
      syncMirror();
      if(isTouchMode())moveToActive(false);
    });
    sourceButtons.forEach(button=>obs.observe(button,{attributes:true,attributeFilter:['class','style']}));

    window.syncRevAdminBottomNav=function(view){
      const wanted=view||window.adminView||'dashboard';
      sourceButtons.forEach(button=>{
        const tab=button.dataset.adminTab;
        button.classList.toggle('active',tab===wanted);
      });
      syncMirror();
      if(isTouchMode())moveToActive(false);
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();