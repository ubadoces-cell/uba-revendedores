/* Taxas de entrega por bairro — base Socorro R$ 1,99 e +R$ 0,25 por faixa sequencial. */
(function () {
  const DELIVERY_FEES = [
    ["Socorro", 199], ["Pitombeira", 224], ["Brotolândia", 249], ["Centro", 274],
    ["Dr José Simões", 299], ["João XXIII", 324], ["Monsenhor Otávio", 349], ["Santa Luzia", 374],
    ["Antônio Holanda", 399], ["Bom Jesus", 424], ["Limoeirinho", 449], ["Bom Nome", 474],
    ["Boa Fé", 499], ["Luis Alves de Freitas", 524], ["Ilha", 549], ["Bom Jesus do Cruzeiro", 574],
  ];

  let pixLoadingTimer = null;
  let pixLoadingProgress = 0;
  let pixLoadingStartedAt = 0;

  const moneyFromCents = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  function selectedDelivery() {
    const value = document.getElementById("deliveryNeighborhood")?.value || "";
    const match = DELIVERY_FEES.find(([name]) => name === value);
    return match ? { neighborhood: match[0], cents: match[1] } : null;
  }

  function addStyles() {
    if (document.getElementById("uba-delivery-fees-css")) return;
    const style = document.createElement("style");
    style.id = "uba-delivery-fees-css";
    style.textContent = `
      .delivery-fee-note{grid-column:1/-1;display:flex;align-items:flex-start;gap:9px;padding:11px 12px;border:1px solid #44355f;border-radius:13px;background:rgba(100,36,210,.08);color:var(--muted);font-size:10px;line-height:1.45}
      .delivery-fee-note strong{display:block;color:#d8c3ff;margin-bottom:2px}.delivery-fee-note-icon{flex:0 0 24px;width:24px;height:24px;border:1px solid #7d4be1;border-radius:999px;display:grid;place-items:center;color:#c9a8ff;font-weight:1000}
      .delivery-pix-breakdown{margin:0 0 14px;padding:14px 16px;border:1px solid var(--line);border-radius:18px;background:var(--surface2)}
      .delivery-pix-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:5px 0;color:var(--muted);font-size:11px}.delivery-pix-row b{color:var(--text)}
      .delivery-pix-row.total{margin-top:5px;padding-top:11px;border-top:1px solid var(--line);font-size:14px;font-weight:1000}.delivery-pix-row.total span,.delivery-pix-row.total b{color:#D9C2FF}

      #generatePixArea .pix-box{display:none!important}
      .uba-pix-ready-card,.uba-pix-loading{border:1px solid #3b334c;border-radius:22px;background:radial-gradient(circle at 22% 48%,rgba(130,67,225,.17),transparent 34%),linear-gradient(145deg,#17141f,#111019);overflow:hidden}
      .uba-pix-ready-card{display:grid;grid-template-columns:minmax(240px,.86fr) minmax(310px,1.14fr);gap:24px;align-items:center;padding:18px;min-height:300px}
      .uba-pix-ready-visual,.uba-pix-art{position:relative;display:grid;place-items:center;min-height:275px}
      .uba-pix-ready-ring,.uba-pix-ring{position:absolute;width:min(270px,84%);aspect-ratio:1;border-radius:50%;border:7px solid rgba(178,128,255,.18);border-top-color:#c59aff;border-right-color:#7f42e9;box-shadow:0 0 24px rgba(157,90,255,.22);animation:ubaPixRingSpin 2.25s linear infinite}
      .uba-pix-ready-ring:after,.uba-pix-ring:after{content:"";position:absolute;inset:14px;border-radius:50%;border:1px solid rgba(205,198,228,.22)}
      .uba-pix-ready-photo,.uba-pix-product{position:relative;z-index:1;width:min(245px,76%);aspect-ratio:1;border-radius:50%;object-fit:cover;object-position:52% 52%;filter:saturate(1.04) contrast(1.04) drop-shadow(0 18px 30px rgba(0,0,0,.42))}
      .uba-pix-ready-copy small{color:#bdb4c9;font-size:10px;font-weight:1000;letter-spacing:.03em}.uba-pix-ready-copy>strong{display:block;font-size:32px;margin:4px 0 18px}.uba-pix-ready-copy h5{font-size:18px;margin:0 0 7px}.uba-pix-ready-copy p{color:var(--muted);font-size:12px;line-height:1.55;margin:0}
      .uba-pix-ready-safe{margin-top:15px;padding:11px 12px;border:1px solid #45375f;border-radius:13px;background:rgba(91,49,148,.12);color:#cdbcf0;font-size:10px;line-height:1.45}.uba-pix-ready-safe b{color:#e2cfff}

      .uba-pix-loading{display:none;margin-top:0;padding:18px}.uba-pix-loading.show{display:block}.uba-pix-loading-grid{display:grid;grid-template-columns:minmax(250px,.95fr) minmax(320px,1.05fr);gap:24px;align-items:center;min-height:350px}
      .uba-pix-ring{animation-duration:1.15s}.uba-pix-copy h5{margin:0 0 18px;font-size:19px}
      .uba-pix-stage{display:grid;grid-template-columns:38px 1fr;gap:10px;align-items:center;position:relative;padding:7px 0}.uba-pix-stage:not(:last-of-type):after{content:"";position:absolute;left:18px;top:39px;width:2px;height:15px;background:#4f4564}
      .uba-pix-stage-dot{width:38px;height:38px;border-radius:50%;border:5px solid #4a4559;background:#17141f;display:grid;place-items:center;color:#fff;font-weight:1000;transition:.2s}.uba-pix-stage.done .uba-pix-stage-dot{border-color:#8650ec;background:#7b43e1;box-shadow:0 0 18px rgba(129,67,225,.45)}.uba-pix-stage.active .uba-pix-stage-dot{border-color:#aa78ff;border-top-color:#fff;animation:ubaPixRingSpin .9s linear infinite;box-shadow:0 0 16px rgba(151,91,255,.38)}
      .uba-pix-stage b{display:block;font-size:13px}.uba-pix-stage small{display:block;color:var(--muted);font-size:10px;margin-top:3px;line-height:1.4}
      .uba-pix-progress-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:14px}.uba-pix-progress{height:10px;border-radius:999px;background:#302b3b;overflow:hidden}.uba-pix-progress>span{display:block;width:0;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8b4cf0,#ad7cff);transition:width .35s ease}.uba-pix-percent{font-size:18px;color:#bb8bff;font-weight:1000;min-width:46px;text-align:right}
      .uba-pix-security{margin-top:14px;padding:12px;border:1px solid #45375f;border-radius:13px;background:rgba(91,49,148,.12);color:#cdbcf0;font-size:10px;line-height:1.45}.uba-pix-security b{color:#dcbfff}
      #step4 .next.uba-pix-wait-button{opacity:.78;pointer-events:none;display:inline-flex;align-items:center;gap:9px}#step4 .next.uba-pix-wait-button:after{content:"";width:18px;height:18px;border:3px solid rgba(255,255,255,.28);border-top-color:#fff;border-radius:50%;animation:ubaPixRingSpin .8s linear infinite}
      @keyframes ubaPixRingSpin{to{transform:rotate(360deg)}}
      @media(max-width:720px){.uba-pix-ready-card,.uba-pix-loading-grid{grid-template-columns:1fr;gap:10px}.uba-pix-ready-card,.uba-pix-loading{padding:14px}.uba-pix-ready-visual,.uba-pix-art{min-height:240px}.uba-pix-ready-ring,.uba-pix-ring{width:220px}.uba-pix-ready-photo,.uba-pix-product{width:192px}.uba-pix-ready-copy{text-align:center}.uba-pix-ready-copy>strong{font-size:28px}.uba-pix-copy h5{text-align:center;margin-top:4px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDeliveryUi() {
    addStyles();
    const step3 = document.getElementById("step3");
    const fields = step3?.querySelector(".fields");
    if (!fields) return;

    let select = document.getElementById("deliveryNeighborhood");
    if (!select) {
      const cityField = document.getElementById("deliveryCity")?.closest(".field");
      const field = document.createElement("div");
      field.className = "field";
      field.innerHTML = `<label for="deliveryNeighborhood">Bairro</label><select id="deliveryNeighborhood" autocomplete="address-level3"><option value="">Selecione o bairro</option>${DELIVERY_FEES.map(([name]) => `<option value="${name}">${name}</option>`).join("")}</select>`;
      if (cityField) cityField.after(field); else fields.prepend(field);
      select = field.querySelector("select");
    }
    if (!select.dataset.ubaDeliveryOptionsV3) {
      const current = select.value;
      select.innerHTML = `<option value="">Selecione o bairro</option>${DELIVERY_FEES.map(([name]) => `<option value="${name}">${name}</option>`).join("")}`;
      if (DELIVERY_FEES.some(([name]) => name === current)) select.value = current;
      select.dataset.ubaDeliveryOptionsV3 = "1";
    }
    if (!select.dataset.ubaDeliveryBound) {
      const saved = sessionStorage.getItem("uba-rev-delivery-neighborhood") || "";
      if (DELIVERY_FEES.some(([name]) => name === saved)) select.value = saved;
      select.addEventListener("change", () => {
        sessionStorage.setItem("uba-rev-delivery-neighborhood", select.value || "");
        const city = document.getElementById("deliveryCity");
        if (select.value && city && !city.value.trim()) city.value = "Limoeiro do Norte";
        updateDeliverySummary();
      });
      select.dataset.ubaDeliveryBound = "1";
    }

    document.getElementById("deliveryFeeBox")?.remove();
    if (!document.getElementById("deliveryFeePrivacyNote")) {
      const note = document.createElement("div");
      note.id = "deliveryFeePrivacyNote";
      note.className = "delivery-fee-note";
      note.innerHTML = `<span class="delivery-fee-note-icon">i</span><div><strong>A taxa de entrega será exibida no resumo final</strong>O valor é calculado pelo bairro selecionado e aparece somente antes de gerar o Pix.</div>`;
      fields.appendChild(note);
    }

    const step4 = document.getElementById("step4");
    const generate = document.getElementById("generatePixArea");
    if (!step4 || !generate) return;

    if (!document.getElementById("deliveryPixBreakdown")) {
      const breakdown = document.createElement("div");
      breakdown.id = "deliveryPixBreakdown";
      breakdown.className = "delivery-pix-breakdown";
      breakdown.innerHTML = `<div class="delivery-pix-row"><span>Produtos</span><b id="deliveryProductsTotal">—</b></div><div class="delivery-pix-row"><span>Entrega · <span id="deliveryPixNeighborhood">bairro</span></span><b id="deliveryPixFee">—</b></div><div class="delivery-pix-row total"><span>Total no Pix</span><b id="deliveryPixTotal">—</b></div>`;
      generate.before(breakdown);
    }

    if (!generate.dataset.ubaPixReadyV3) {
      generate.innerHTML = `<div class="uba-pix-ready-card"><div class="uba-pix-ready-visual"><div class="uba-pix-ready-ring"></div><img class="uba-pix-ready-photo" src="morango.jpg" alt="Alfajor UBA para pagamento Pix"></div><div class="uba-pix-ready-copy"><small>TOTAL DO PEDIDO</small><strong id="pixTotal">R$ 0,00</strong><h5>Pagamento Pix seguro</h5><p>Ao clicar em <b>Gerar Pix</b>, vamos preparar a cobrança, gerar o QR Code e o código copia e cola.</p><div class="uba-pix-ready-safe"><b>Você acompanhará o carregamento em tempo real.</b><br>O pedido só será confirmado depois que o Asaas identificar o pagamento.</div></div></div>`;
      generate.dataset.ubaPixReadyV3 = "1";
    }

    if (!document.getElementById("ubaPixLoading")) {
      const loading = document.createElement("div");
      loading.id = "ubaPixLoading";
      loading.className = "uba-pix-loading";
      loading.innerHTML = `<div class="uba-pix-loading-grid"><div class="uba-pix-art"><div class="uba-pix-ring"></div><img class="uba-pix-product" src="morango.jpg" alt="Alfajor UBA carregando pagamento"></div><div class="uba-pix-copy"><h5>Preparando seu Pix</h5><div class="uba-pix-stage" data-stage="1"><span class="uba-pix-stage-dot"></span><div><b>Recebendo dados do pedido</b><small>Seus dados estão sendo processados.</small></div></div><div class="uba-pix-stage" data-stage="2"><span class="uba-pix-stage-dot"></span><div><b>Criando cobrança Asaas</b><small>Gerando uma cobrança segura no Asaas.</small></div></div><div class="uba-pix-stage" data-stage="3"><span class="uba-pix-stage-dot"></span><div><b>Gerando QR Code Pix</b><small>Quase pronto! Estamos gerando seu QR Code.</small></div></div><div class="uba-pix-stage" data-stage="4"><span class="uba-pix-stage-dot"></span><div><b>Preparando código copia e cola</b><small>Finalizando os dados do seu Pix.</small></div></div><div class="uba-pix-progress-row"><div class="uba-pix-progress"><span id="ubaPixProgressBar"></span></div><div class="uba-pix-percent" id="ubaPixProgressText">0%</div></div><div class="uba-pix-security"><b>O pedido só será confirmado após o recebimento do Pix.</b><br>Assim que o pagamento for identificado pelo Asaas, você será avisado e seu pedido seguirá para produção.</div></div></div>`;
      generate.after(loading);
    }
    wrapPixGeneration();
  }

  function updateDeliverySummary() {
    const delivery = selectedDelivery();
    let productTotal = null, showPrice = true;
    try {
      const totals = typeof getTotals === "function" ? getTotals() : null;
      if (totals && Number.isFinite(Number(totals.total))) productTotal = Number(totals.total);
      if (typeof canSeePrices === "function") showPrice = Boolean(canSeePrices());
    } catch {}
    const productEl = document.getElementById("deliveryProductsTotal"), feeEl = document.getElementById("deliveryPixFee"), neighborhoodEl = document.getElementById("deliveryPixNeighborhood"), totalEl = document.getElementById("deliveryPixTotal"), pixTotal = document.getElementById("pixTotal");
    if (neighborhoodEl) neighborhoodEl.textContent = delivery?.neighborhood || "bairro";
    if (feeEl) feeEl.textContent = delivery ? moneyFromCents(delivery.cents) : "—";
    if (productTotal !== null && showPrice) {
      const totalCents = Math.round(productTotal * 100) + (delivery?.cents || 0);
      if (productEl) productEl.textContent = moneyFromCents(Math.round(productTotal * 100));
      if (totalEl) totalEl.textContent = delivery ? moneyFromCents(totalCents) : "Selecione o bairro";
      if (pixTotal) pixTotal.textContent = delivery ? moneyFromCents(totalCents) : moneyFromCents(Math.round(productTotal * 100));
    }
  }

  function setLoadingStage(stage, progress) {
    document.querySelectorAll("#ubaPixLoading .uba-pix-stage").forEach((row) => {
      const value = Number(row.dataset.stage || 0), dot = row.querySelector(".uba-pix-stage-dot");
      row.classList.toggle("done", value < stage); row.classList.toggle("active", value === stage);
      if (dot) dot.textContent = value < stage ? "✓" : "";
    });
    const bar = document.getElementById("ubaPixProgressBar"), text = document.getElementById("ubaPixProgressText");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    if (text) text.textContent = `${Math.round(progress)}%`;
  }

  function waitButton(active) {
    const button = document.querySelector("#step4 .checkout-nav .next");
    if (!button) return;
    button.classList.toggle("uba-pix-wait-button", active);
    if (active) { button.disabled = true; button.textContent = "Aguarde..."; }
  }

  function startPixLoading() {
    ensureDeliveryUi();
    clearInterval(pixLoadingTimer); pixLoadingProgress = 9; pixLoadingStartedAt = Date.now();
    document.getElementById("generatePixArea")?.classList.add("hidden");
    document.getElementById("ubaPixLoading")?.classList.add("show");
    setLoadingStage(1, pixLoadingProgress); setTimeout(() => waitButton(true), 0);
    pixLoadingTimer = setInterval(() => {
      waitButton(true);
      if (pixLoadingProgress < 92) pixLoadingProgress += pixLoadingProgress < 42 ? 4 : pixLoadingProgress < 72 ? 2.5 : 1;
      const stage = pixLoadingProgress < 28 ? 1 : pixLoadingProgress < 52 ? 2 : pixLoadingProgress < 78 ? 3 : 4;
      setLoadingStage(stage, pixLoadingProgress);
    }, 360);
  }

  async function stopPixLoading(success) {
    clearInterval(pixLoadingTimer); pixLoadingTimer = null;
    if (success) {
      setLoadingStage(5, 100);
      const remaining = 1500 - (Date.now() - pixLoadingStartedAt);
      if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
    }
    document.getElementById("ubaPixLoading")?.classList.remove("show");
    waitButton(false);
    if (!success) document.getElementById("generatePixArea")?.classList.remove("hidden");
  }

  function canShowPixLoader() {
    try {
      const customer = typeof getCustomer === "function" ? getCustomer() : null, totals = typeof getTotals === "function" ? getTotals() : null;
      const name = document.getElementById("buyerName")?.value.trim() || customer?.name || "", doc = document.getElementById("buyerDoc")?.value.trim() || customer?.doc || "";
      return Boolean(customer && !customer.isTest && Number(totals?.count || 0) >= 50 && name && [11, 14].includes(String(doc).replace(/\D/g, "").length) && selectedDelivery());
    } catch { return false; }
  }

  function wrapPixGeneration() {
    const base = window.finishDemo;
    if (typeof base !== "function" || base.__ubaPixLoaderV3) return;
    const wrapped = async function () {
      if (!canShowPixLoader()) return base.apply(this, arguments);
      startPixLoading();
      try { return await base.apply(this, arguments); }
      finally { await stopPixLoading(Boolean(document.getElementById("pixPaymentArea")?.classList.contains("show"))); }
    };
    wrapped.__ubaPixLoaderV3 = true; window.finishDemo = wrapped;
  }

  const baseGoStep = window.goStep;
  if (typeof baseGoStep === "function") window.goStep = function (step) {
    ensureDeliveryUi();
    if (Number(step) === 4 && !selectedDelivery()) { alert("Selecione o bairro antes de ir para o resumo do Pix."); return; }
    const result = baseGoStep.apply(this, arguments); setTimeout(() => { ensureDeliveryUi(); updateDeliverySummary(); }, 0); return result;
  };

  const baseUpdateCart = window.updateCart;
  if (typeof baseUpdateCart === "function") window.updateCart = function () { const result = baseUpdateCart.apply(this, arguments); updateDeliverySummary(); return result; };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    try {
      const rawUrl = typeof input === "string" ? input : input?.url || "", url = new URL(rawUrl, window.location.origin), method = String(init?.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      if (url.pathname === "/api/orders" && method === "POST" && typeof init?.body === "string") {
        const delivery = selectedDelivery(), payload = JSON.parse(init.body || "{}");
        if (delivery && payload && typeof payload === "object") { payload.delivery = payload.delivery && typeof payload.delivery === "object" ? payload.delivery : {}; payload.delivery.neighborhood = delivery.neighborhood; init = { ...init, body: JSON.stringify(payload) }; }
      }
    } catch {}
    return nativeFetch(input, init);
  };

  ensureDeliveryUi(); updateDeliverySummary();
  const observer = new MutationObserver(() => ensureDeliveryUi());
  observer.observe(document.body, { childList: true, subtree: true });
})();
