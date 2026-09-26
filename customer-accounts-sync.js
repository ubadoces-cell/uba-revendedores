(function () {
  let customerAccount = null;

  function cleanupUnrequestedLabels() {
    const bubble = document.querySelector('.hero-card .bubble');
    if (bubble && /B2B/i.test(bubble.textContent || '')) bubble.remove();
    const revenueButton = document.getElementById('revenueQuickButton');
    if (revenueButton && /B2B/i.test(revenueButton.textContent || '')) revenueButton.textContent = '💰 Faturamento';
    const revenueTitle = document.querySelector('#adminRevenueView .admin-page-title h3');
    if (revenueTitle && /B2B/i.test(revenueTitle.textContent || '')) revenueTitle.textContent = 'Faturamento';
  }
  const labelObserver = new MutationObserver(cleanupUnrequestedLabels);
  labelObserver.observe(document.documentElement, { childList: true, subtree: true });
  queueMicrotask(cleanupUnrequestedLabels);

  const baseRenderAll=renderAll;
  renderAll=function(){
    baseRenderAll();
    const isTest=Boolean(customerAccount?.isTest);
    const banner=document.getElementById('testModeBanner');if(banner)banner.hidden=!isTest;
    const pay=document.querySelector('#step4 .checkout-nav .next');if(pay)pay.textContent=isTest?'Finalizar teste sem pagar':'Gerar Pix';
    ensureMyOrdersBox();
    cleanupUnrequestedLabels();
  };
  const baseGoStep=goStep;
  goStep=function(step){
    baseGoStep(step);
    if(customerAccount?.isTest){
      const values={buyerName:'Cliente de teste UBA',buyerDoc:'00000000000',buyerStore:'TESTE — não entregar',deliveryCep:'00000000',deliveryCity:'Cidade de teste',deliveryStreet:'Rua de teste',deliveryNumber:'1',deliveryComplement:'Não entregar'};
      for(const [id,value] of Object.entries(values)){const el=document.getElementById(id);if(el&&!el.value)el.value=value;}
      const button=document.querySelector('#step4 .checkout-nav .next');if(button)button.textContent='Finalizar teste sem pagar';
    }
  };

  accounts = [];
  saveAccounts = function () {};
  getCustomer = function () {
    const account = customerAccount;
    if (!account || account.status !== "approved") {
      if (customerSessionId) {
        customerSessionId = "";
        sessionStorage.removeItem("uba-rev-customer-session");
        customerAccount = null;
      }
      return null;
    }
    return account;
  };

  async function request(options = {}) {
    const url = options.url || "/api/customer-accounts";
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Não foi possível acessar os logins de clientes.");
    return data;
  }

  async function loadAccounts(silent = false) {
    try {
      const data = await request();
      accounts = Array.isArray(data.accounts) ? data.accounts : [];
      renderAccounts();
      renderAll();
    } catch (error) {
      if (!silent) alert(error.message);
    }
  }

  async function loadCurrentCustomer() {
    try {
      const data = await request({ url: "/api/customer-accounts?scope=current" });
      customerAccount = data.account || null;
      customerSessionId = customerAccount?.id || "";
      if (customerSessionId) sessionStorage.setItem("uba-rev-customer-session", customerSessionId);
      else sessionStorage.removeItem("uba-rev-customer-session");
      renderAll();
    } catch {
      customerAccount = null;
      customerSessionId = "";
      renderAll();
    }
  }

  registerCustomer = async function () {
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const doc = document.getElementById("regDoc").value.trim();
    const store = document.getElementById("regStore").value.trim();
    const purpose = "commerce";
    const password = document.getElementById("regPass").value;
    if (!name || (!email && !phone) || !doc || password.length < 6) {
      setAuthMessage("Preencha nome, e-mail ou telefone, CPF/CNPJ e uma senha com pelo menos 6 caracteres.", "bad");
      return;
    }
    try {
      await request({ method: "POST", body: JSON.stringify({ action: "register", name, email, phone, doc, store, purpose, password }) });
      visitorPurpose = "commerce";
      localStorage.setItem("uba-rev-purpose", "commerce");
      showPanel("pendingPanel");
      for (let i = 1; i <= 4; i += 1) document.getElementById(`dot${i}`).classList.toggle("on", i === 1);
    } catch (error) {
      setAuthMessage(error.message, "bad");
    }
  };

  loginCustomer = async function () {
    const login = normalizeLogin(document.getElementById("customerLogin").value);
    const password = document.getElementById("customerPass").value;
    if (!login || !password) {
      setAuthMessage("Digite seu e-mail/telefone e senha.", "bad");
      return;
    }
    try {
      const data = await request({ method: "POST", body: JSON.stringify({ action: "login", login, password }) });
      customerAccount = data.account;
      customerSessionId = data.account.id;
      sessionStorage.setItem("uba-rev-customer-session", data.account.id);
      visitorPurpose = "commerce";
      localStorage.setItem("uba-rev-purpose", "commerce");
      renderAll();
      if (getTotals().count > 0) goStep(2);
      else closeAll();
    } catch (error) {
      setAuthMessage(error.message, error.message.includes("aguardando") ? "warn" : "bad");
    }
  };

  logoutCustomer = async function () {
    try { await request({ method: "POST", body: JSON.stringify({ action: "logout" }) }); } catch {}
    customerAccount = null;
    customerSessionId = "";
    sessionStorage.removeItem("uba-rev-customer-session");
    renderAll();
    closeAll();
  };

  const previousOpenAdmin = openAdmin;
  openAdmin = function () {
    previousOpenAdmin();
    if (ceoSession) loadAccounts(true);
  };

  openLogins = async function () {
    if (!ceoSession) { openCheckout(1); showAdminLogin(); return; }
    document.getElementById("loginShell").classList.add("show");
    document.body.style.overflow = "hidden";
    setLoginTab("pending");
    await loadAccounts();
  };

  approveAccount = function (id) { return setAccountStatus(id, "approved"); };
  setAccountStatus = async function (id, status) {
    const account = accounts.find((item) => item.id === id);
    if (!account) return;
    try {
      const data = await request({ method: "PATCH", body: JSON.stringify({ ...account, id, status }) });
      const index = accounts.findIndex((item) => item.id === id);
      if (index >= 0) accounts[index] = data.account;
      renderAccounts();
      renderAll();
    } catch (error) {
      alert(error.message);
      loadAccounts();
    }
  };

  saveAccountForm = async function (event) {
    event.preventDefault();
    const id = document.getElementById("accountEditId").value;
    const name = document.getElementById("accountName").value.trim();
    const store = document.getElementById("accountStore").value.trim();
    const email = document.getElementById("accountEmail").value.trim();
    const phone = document.getElementById("accountPhone").value.trim();
    const doc = document.getElementById("accountDoc").value.trim();
    const status = document.getElementById("accountStatus").value;
    const purpose = "commerce";
    const password = document.getElementById("accountPassword").value;
    if (!name || (!email && !phone)) { alert("Informe nome e pelo menos e-mail ou telefone."); return; }
    if (!id && password.length < 6) { alert("Ao criar um login, informe uma senha com pelo menos 6 caracteres."); return; }
    if (password && password.length < 6) { alert("A nova senha precisa ter pelo menos 6 caracteres."); return; }
    try {
      const data = await request({
        method: id ? "PATCH" : "POST",
        body: JSON.stringify({ action: "create", id, name, store, email, phone, doc, status, purpose, password }),
      });
      const index = accounts.findIndex((item) => item.id === id);
      if (index >= 0) accounts[index] = data.account;
      else accounts.unshift(data.account);
      clearAccountForm();
      renderAccounts();
      renderAll();
      setLoginTab("all");
    } catch (error) {
      alert(error.message);
    }
  };

  deleteAccount = async function (id) {
    const account = accounts.find((item) => item.id === id);
    if (!account || !confirm(`Apagar definitivamente o login de ${account.name}?`)) return;
    try {
      await request({ method: "DELETE", url: `/api/customer-accounts?id=${encodeURIComponent(id)}` });
      accounts = accounts.filter((item) => item.id !== id);
      if (customerAccount?.id === id) {
        customerAccount = null;
        customerSessionId = "";
        sessionStorage.removeItem("uba-rev-customer-session");
      }
      renderAccounts();
      renderAll();
    } catch (error) {
      alert(error.message);
    }
  };

  function orderStatusLabel(status){
    return ({novo:'Pedido recebido',confirmado:'Pagamento confirmado',em_producao:'Em produção',separacao:'Em separação',pronto:'Pronto',enviado:'Enviado',retirada:'Disponível para retirada',concluido:'Entregue',cancelado:'Cancelado'})[status]||status
  }
  function paymentLabel(status){return ({aguardando_pagamento:'Aguardando Pix',confirmado_asaas:'Pix confirmado',pago:'Pago',vencido:'Pix vencido',cancelado:'Cancelado',estornado:'Estornado'})[status]||status||''}
  function ensureMyOrdersBox(){
    if(document.getElementById('myCustomerOrders'))return;
    const panel=document.getElementById('customerAccount');if(!panel)return;
    const style=document.createElement('style');style.textContent=`.customer-orders-box{margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}.customer-orders-box h5{margin:0 0 8px;font-size:15px}.customer-order-row{padding:11px;border:1px solid var(--line);border-radius:13px;background:var(--surface2);margin-top:7px}.customer-order-head{display:flex;justify-content:space-between;gap:8px}.customer-order-row small{color:var(--muted);font-size:9px}.customer-order-status{display:inline-flex;margin-top:7px;padding:5px 8px;border-radius:999px;background:#2D135B;color:#D2AEFF;font-size:8px;font-weight:1000}.customer-order-note{margin-top:8px;padding:8px 9px;border:1px solid #27425F;border-radius:10px;background:#0B1621;color:#B9D6ED;font-size:9px;line-height:1.4}`;document.head.appendChild(style);
    const box=document.createElement('div');box.id='myCustomerOrders';box.className='customer-orders-box';box.innerHTML='<h5>Meus pedidos</h5><div id="myCustomerOrdersList"><div class="muted">Abra sua conta para carregar os pedidos.</div></div>';panel.appendChild(box)
  }
  async function loadMyOrders(){
    ensureMyOrdersBox();const root=document.getElementById('myCustomerOrdersList');if(!root||!getCustomer())return;
    root.innerHTML='<div class="muted">Carregando pedidos...</div>';
    try{
      const response=await fetch('/api/orders?scope=mine',{credentials:'same-origin'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Não foi possível carregar seus pedidos.');
      const orders=Array.isArray(data.orders)?data.orders:[];
      root.innerHTML=orders.length?orders.map(order=>`<div class="customer-order-row"><div class="customer-order-head"><div><b>${escapeHtml(order.code)}</b><small>${new Date(order.createdAt).toLocaleString('pt-BR')} · ${Number(order.units||0)} unidades</small></div><b>${(Number(order.totalCents||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div><span class="customer-order-status">${escapeHtml(orderStatusLabel(order.status))} · ${escapeHtml(paymentLabel(order.paymentStatus))}</span>${order.customerNote?`<div class="customer-order-note"><b>Mensagem da UBA:</b><br>${escapeHtml(order.customerNote)}</div>`:''}</div>`).join(''):'<div class="muted">Você ainda não possui pedidos.</div>'
    }catch(error){root.innerHTML=`<div class="muted">${escapeHtml(error.message)}</div>`}
  }
  window.loadMyOrders=loadMyOrders;
  const previousOpenCustomerEntry=window.openCustomerEntry;
  window.openCustomerEntry=function(){previousOpenCustomerEntry();if(getCustomer())setTimeout(loadMyOrders,0)};

  accounts = [];
  renderAll();
  loadCurrentCustomer();
  setInterval(() => { if (ceoSession && !document.hidden) loadAccounts(true); }, 15000);
})();
