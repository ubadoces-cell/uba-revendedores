(function () {
  let customerAccount = null;

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
    const purpose = document.getElementById("regPurpose").value || visitorPurpose || "commerce";
    const password = document.getElementById("regPass").value;
    if (!name || (!email && !phone) || !doc || password.length < 6) {
      setAuthMessage("Preencha nome, e-mail ou telefone, CPF/CNPJ e uma senha com pelo menos 6 caracteres.", "bad");
      return;
    }
    try {
      await request({ method: "POST", body: JSON.stringify({ action: "register", name, email, phone, doc, store, purpose, password }) });
      visitorPurpose = purpose;
      localStorage.setItem("uba-rev-purpose", purpose);
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
      if (data.account.purpose) {
        visitorPurpose = data.account.purpose;
        localStorage.setItem("uba-rev-purpose", data.account.purpose);
      }
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
    const purpose = document.getElementById("accountPurpose").value || "commerce";
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

  accounts = [];
  renderAll();
  loadCurrentCustomer();
  setInterval(() => {
    if (ceoSession && !document.hidden) loadAccounts(true);
  }, 15000);
})();
